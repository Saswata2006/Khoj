"use client";

import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

// ---------------------------------------------------------------------------
// Auth client instance
// ---------------------------------------------------------------------------

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [emailOTPClient()],
});

// ---------------------------------------------------------------------------
// Typed helper functions
// ---------------------------------------------------------------------------

export interface SendOtpResult {
  success: boolean;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  user?: {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean;
    image: string | null;
    role: string;
    hostelBlock: string | null;
    location: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  error?: string;
}

/**
 * Sends a 6-digit OTP to the provided email address.
 * Returns a generic error message on failure (no account enumeration).
 */
export async function sendOtp(email: string): Promise<SendOtpResult> {
  try {
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });

    if (result.error) {
      return {
        success: false,
        error: "Failed to send verification code. Please try again.",
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: "Failed to send verification code. Please try again.",
    };
  }
}

/**
 * Verifies the OTP and signs in the user.
 * Creates an account automatically if the user does not exist.
 * Returns a generic error message on failure (no account enumeration).
 */
export async function verifyOtp(
  email: string,
  otp: string
): Promise<VerifyOtpResult> {
  try {
    const result = await authClient.signIn.emailOtp({
      email,
      otp,
    });

    if (result.error) {
      return {
        success: false,
        error: "Invalid or expired verification code.",
      };
    }

    return {
      success: true,
      user: result.data?.user as VerifyOtpResult["user"],
    };
  } catch {
    return {
      success: false,
      error: "Verification failed. Please try again.",
    };
  }
}

/**
 * Returns the current authenticated session, or null if unauthenticated.
 */
export async function getSession() {
  try {
    const result = await authClient.getSession();
    return result.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Signs out the current user and invalidates the session.
 */
export async function signOut(): Promise<void> {
  try {
    await authClient.signOut();
  } catch {
    // Swallow — the UI should redirect regardless
  }
}

// Re-export the raw client for advanced usage in UI components
export { authClient };
