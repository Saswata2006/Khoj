import "server-only";
import { createHmac } from "crypto";
import { z } from "zod";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import prisma from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";
import {
  checkEmailSendRateLimit,
  createBetterAuthRateLimitStorage,
  IP_MAX_REQUESTS_PER_HOUR,
  IP_MAX_VERIFY_PER_HOUR,
} from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Helpers & Validators
// ---------------------------------------------------------------------------

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const otpSchema = z.string().trim().regex(/^\d{6}$/);
const DEV_FALLBACK_OTP_HASH_SECRET =
  "khoj-dev-only-otp-hmac-secret-not-for-production";

function getOtpHashSecret(): string {
  const secret = process.env.OTP_HASH_SECRET?.trim();
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OTP_HASH_SECRET must be configured with at least 32 characters in production."
    );
  }
  return DEV_FALLBACK_OTP_HASH_SECRET;
}

/**
 * Keyed HMAC-SHA256 hash function passed to Better Auth `storeOTP: { hash }`.
 * Prevents offline rainbow-table brute-forcing of 6-digit OTPs if storage is leaked.
 */
export async function hashOtp(otp: string): Promise<string> {
  return createHmac("sha256", getOtpHashSecret())
    .update(otp)
    .digest("base64url");
}

/**
 * Normalizes an email address for consistent storage and comparison.
 * Lowercases and trims whitespace.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Returns configured trusted origins.
 * Always includes BETTER_AUTH_URL (and NEXT_PUBLIC_APP_URL if distinct);
 * never falls back to wildcard.
 */
function getTrustedOrigins(): string[] {
  const origins = new Set<string>();
  if (process.env.BETTER_AUTH_URL) origins.add(process.env.BETTER_AUTH_URL);
  if (process.env.NEXT_PUBLIC_APP_URL) origins.add(process.env.NEXT_PUBLIC_APP_URL);
  return Array.from(origins);
}

// ---------------------------------------------------------------------------
// Better Auth instance
// ---------------------------------------------------------------------------

export const auth = betterAuth({
  // ---- Core settings -------------------------------------------------------
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // ---- Database adapter ----------------------------------------------------
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // ---- Trusted origins (CORS + redirect validation) -----------------------
  trustedOrigins: getTrustedOrigins(),

  // ---- Passwordless only: disable password & unused auth/OTP endpoints ----
  emailAndPassword: {
    enabled: false,
  },
  disabledPaths: [
    "/sign-up/email",
    "/sign-in/email",
    "/reset-password",
    "/request-password-reset",
    "/forget-password",
    "/change-password",
    "/set-password",
    "/email-otp/request-password-reset",
    "/email-otp/reset-password",
    "/forget-password/email-otp",
    "/email-otp/request-email-change",
    "/email-otp/change-email",
    "/email-otp/check-verification-otp",
    "/email-otp/verify-email",
  ],

  // ---- Persistent, concurrency-safe IP rate limiting -----------------------
  rateLimit: {
    enabled: true,
    customStorage: createBetterAuthRateLimitStorage(),
    window: 60,
    max: 30,
    customRules: {
      "/email-otp/send-verification-otp": {
        window: 3600,
        max: IP_MAX_REQUESTS_PER_HOUR,
      },
      "/sign-in/email-otp": {
        window: 3600,
        max: IP_MAX_VERIFY_PER_HOUR,
      },
    },
  },

  // ---- Session configuration (strict DB-backed 7-day sessions) -------------
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // Refresh session if older than 24 h
    storeSessionInDatabase: true,
    cookieCache: {
      enabled: false,            // Ensure immediate DB session revocation on logout
    },
  },

  // ---- User configuration --------------------------------------------------
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "USER",
        input: false,            // Not settable by the client (prevents escalation)
        returned: true,
      },
      hostelBlock: {
        type: "string",
        required: false,
        returned: true,
      },
      location: {
        type: "string",
        required: false,
        returned: true,
      },
    },
  },

  // ---- Hooks: enforce validation, normalization & per-email rate limits ----
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const body = ctx.body as Record<string, unknown> | undefined;

      if (ctx.path === "/email-otp/send-verification-otp") {
        const emailParsed = emailSchema.safeParse(body?.email);
        if (!emailParsed.success) {
          throw new APIError("BAD_REQUEST", {
            message: "Please provide a valid email address.",
          });
        }

        if (body?.type !== "sign-in") {
          throw new APIError("BAD_REQUEST", {
            message: "Invalid verification request type.",
          });
        }

        const normalizedEmail = emailParsed.data;
        const emailLimit = await checkEmailSendRateLimit(normalizedEmail);
        if (!emailLimit.allowed) {
          throw new APIError(
            "TOO_MANY_REQUESTS",
            { message: "Too many verification requests. Please wait before trying again." },
            { "Retry-After": String(emailLimit.retryAfterSeconds) }
          );
        }

        return {
          context: {
            body: {
              ...body,
              email: normalizedEmail,
            },
          },
        };
      }

      if (ctx.path === "/sign-in/email-otp") {
        const emailParsed = emailSchema.safeParse(body?.email);
        if (!emailParsed.success) {
          throw new APIError("BAD_REQUEST", {
            message: "Invalid or expired verification code.",
          });
        }

        const otpParsed = otpSchema.safeParse(body?.otp);
        if (!otpParsed.success) {
          throw new APIError("BAD_REQUEST", {
            message: "Invalid or expired verification code.",
          });
        }

        return {
          context: {
            body: {
              ...body,
              email: emailParsed.data,
              otp: otpParsed.data,
            },
          },
        };
      }
    }),
  },

  // ---- Plugins -------------------------------------------------------------
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      allowedAttempts: 3,
      storeOTP: { hash: hashOtp },
      resendStrategy: "rotate", // New OTP invalidates previous OTP
      disableSignUp: false,     // Auto-create account only after OTP verification

      sendVerificationOTP: async (data) => {
        const normalizedEmail = normalizeEmail(data.email);
        await sendOtpEmail(normalizedEmail, data.otp);
      },
    }),
    nextCookies(),
  ],

  // ---- Advanced options ----------------------------------------------------
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
    ipAddress: {
      ipAddressHeaders: ["x-real-ip", "x-forwarded-for"],
    },
    database: {
      generateId: false, // Let Prisma @default(cuid()) handle ID generation
    },
  },
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
