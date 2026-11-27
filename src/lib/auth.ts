import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import prisma from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes an email address for consistent storage and comparison.
 * Lowercases and trims whitespace.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Returns configured trusted origins.
 * Always includes BETTER_AUTH_URL; never falls back to wildcard.
 */
function getTrustedOrigins(): string[] {
  const authUrl = process.env.BETTER_AUTH_URL;
  const origins: string[] = [];
  if (authUrl) origins.push(authUrl);
  return origins;
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

  // ---- Session configuration -----------------------------------------------
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // Refresh session if older than 24 h
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,            // 5-minute cookie cache
    },
  },

  // ---- User configuration --------------------------------------------------
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "USER",
        input: false,            // Not settable by the client
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

  // ---- Plugins -------------------------------------------------------------
  plugins: [
    emailOTP({
      /**
       * Better Auth handles OTP generation and storage in the verifications
       * table. We supply only the send function.
       *
       * Security configuration:
       * - otpLength: 6 digits
       * - expiresIn: 300 s (5 min)
       * - allowedAttempts: 3
       * - storeOTP: "hashed" (bcrypt-hashed, not plaintext)
       * - resendStrategy: "rotate" (new OTP invalidates previous)
       * - disableSignUp: false (auto-create account on first OTP)
       */
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      storeOTP: "hashed",
      resendStrategy: "rotate",
      disableSignUp: false,

      /**
       * Called by Better Auth after generating the OTP.
       * We receive the OTP in plaintext here and hand it off to the email
       * sender. We must NOT log `data.otp`.
       */
      sendVerificationOTP: async (data) => {
        const normalizedEmail = normalizeEmail(data.email);
        // Fire-and-forget on serverless: use waitUntil if available.
        await sendOtpEmail(normalizedEmail, data.otp);
      },
    }),
  ],

  // ---- Advanced options ----------------------------------------------------
  advanced: {
    // Use secure HttpOnly cookies; Secure flag is set automatically in
    // production by Better Auth based on the baseURL scheme.
    useSecureCookies: process.env.NODE_ENV === "production",
    // Normalize emails consistently before storage
    generateId: false, // Let Prisma default IDs (cuid) handle generation
  },
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
