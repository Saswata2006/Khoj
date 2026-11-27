/**
 * Pure UI helpers and ephemeral sessionStorage state for the passwordless
 * email-OTP authentication flow and safe navigation.
 *
 * Security notes:
 * - OTP values are NEVER stored in sessionStorage, localStorage, or URLs.
 * - Only the pending verification email, resend-cooldown timestamp, and an
 *   optional validated internal redirect path are kept in tab-scoped
 *   sessionStorage.
 */

export const OTP_LENGTH = 6;
export const RESEND_COOLDOWN_SECONDS = 60;
export const POST_AUTH_REDIRECT_PATH = "/dashboard";

const PENDING_EMAIL_KEY = "khoj_pending_verify_email";
const COOLDOWN_UNTIL_KEY = "khoj_otp_cooldown_until";
const REDIRECT_TO_KEY = "khoj_post_auth_redirect";

const EMAIL_INPUT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailInput(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailInput(email: string): boolean {
  const normalized = normalizeEmailInput(email);
  return normalized.length <= 254 && EMAIL_INPUT_REGEX.test(normalized);
}

/**
 * Validates that a redirect target is a safe internal relative path.
 * Blocks open redirects (`https://...`, `//evil.com`, `/\evil.com`,
 * `javascript:...`, control characters, or loops back to /login or /verify).
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback: string = POST_AUTH_REDIRECT_PATH
): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();

  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\") ||
    /[\x00-\x1F\x7F]/.test(trimmed)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return fallback;
    }
    if (parsed.pathname === "/login" || parsed.pathname === "/verify") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function computeUserInitials(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return trimmedName.slice(0, 2).toUpperCase();
  }

  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    return trimmedEmail.slice(0, 2).toUpperCase();
  }

  return "U";
}

export function extractOtpDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export function createEmptyOtpDigits(): string[] {
  return Array.from({ length: OTP_LENGTH }, () => "");
}

export function applyOtpDigitChange(
  current: string[],
  index: number,
  rawValue: string
): { digits: string[]; nextFocusIndex: number } {
  const cleaned = rawValue.replace(/\D/g, "");
  const next = [...current];

  if (!cleaned) {
    next[index] = "";
    return { digits: next, nextFocusIndex: index };
  }

  if (cleaned.length > 1) {
    return applyOtpPaste(current, cleaned, index);
  }

  next[index] = cleaned;
  const nextFocusIndex = Math.min(index + 1, OTP_LENGTH - 1);
  return { digits: next, nextFocusIndex };
}

export function applyOtpPaste(
  current: string[],
  pastedText: string,
  startIndex = 0
): { digits: string[]; nextFocusIndex: number } {
  const digitsOnly = extractOtpDigits(pastedText);
  if (!digitsOnly) {
    return { digits: [...current], nextFocusIndex: startIndex };
  }

  const origin = digitsOnly.length === OTP_LENGTH ? 0 : startIndex;
  const next = [...current];

  let lastWritten = origin;
  for (let i = 0; i < digitsOnly.length && origin + i < OTP_LENGTH; i++) {
    next[origin + i] = digitsOnly[i];
    lastWritten = origin + i;
  }

  const nextFocusIndex = Math.min(lastWritten + 1, OTP_LENGTH - 1);
  return { digits: next, nextFocusIndex };
}

export function applyOtpBackspace(
  current: string[],
  index: number
): { digits: string[]; nextFocusIndex: number } {
  const next = [...current];
  if (next[index]) {
    next[index] = "";
    return { digits: next, nextFocusIndex: index };
  }

  if (index > 0) {
    next[index - 1] = "";
    return { digits: next, nextFocusIndex: index - 1 };
  }

  return { digits: next, nextFocusIndex: 0 };
}

export function getRemainingCooldownSeconds(
  cooldownUntilMs: number | null,
  nowMs: number = Date.now()
): number {
  if (!cooldownUntilMs || cooldownUntilMs <= nowMs) return 0;
  return Math.ceil((cooldownUntilMs - nowMs) / 1000);
}

export function savePendingVerification(
  email: string,
  nowMs: number = Date.now(),
  redirectTo?: string | null
): number {
  const normalized = normalizeEmailInput(email);
  const cooldownUntil = nowMs + RESEND_COOLDOWN_SECONDS * 1000;
  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, normalized);
    window.sessionStorage.setItem(COOLDOWN_UNTIL_KEY, String(cooldownUntil));
    if (redirectTo !== undefined) {
      const safeTarget = sanitizeRedirectPath(redirectTo);
      window.sessionStorage.setItem(REDIRECT_TO_KEY, safeTarget);
    }
  }
  return cooldownUntil;
}

export function loadPendingVerification(): {
  email: string | null;
  cooldownUntilMs: number | null;
  redirectTo: string;
} {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return {
      email: null,
      cooldownUntilMs: null,
      redirectTo: POST_AUTH_REDIRECT_PATH,
    };
  }

  const email = window.sessionStorage.getItem(PENDING_EMAIL_KEY);
  const rawCooldown = window.sessionStorage.getItem(COOLDOWN_UNTIL_KEY);
  const rawRedirect = window.sessionStorage.getItem(REDIRECT_TO_KEY);
  const parsedCooldown = rawCooldown ? Number(rawCooldown) : NaN;

  return {
    email: email && isValidEmailInput(email) ? email : null,
    cooldownUntilMs: Number.isFinite(parsedCooldown) ? parsedCooldown : null,
    redirectTo: sanitizeRedirectPath(rawRedirect),
  };
}

export function clearPendingVerification(): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
    window.sessionStorage.removeItem(COOLDOWN_UNTIL_KEY);
    window.sessionStorage.removeItem(REDIRECT_TO_KEY);
  }
}
