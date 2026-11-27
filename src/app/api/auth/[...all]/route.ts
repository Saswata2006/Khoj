import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better Auth catch-all route handler.
 *
 * Mounts all authentication endpoints under /api/auth/:
 *   POST /api/auth/sign-in/email-otp
 *   POST /api/auth/email-otp/send-verification-otp
 *   POST /api/auth/sign-out
 *   GET  /api/auth/get-session
 *   ... and additional internal Better Auth endpoints
 *
 * The handler is created by Better Auth's official Next.js integration.
 * Rate limiting for OTP send/verify is enforced inside the emailOTP plugin
 * configuration (allowedAttempts, resendStrategy) and supplemented by the
 * application-level rate limiter in src/lib/rate-limit.ts, which should be
 * called by any UI-facing Server Action or API wrapper before invoking
 * authClient.emailOtp.sendVerificationOtp().
 */
export const { GET, POST } = toNextJsHandler(auth);
