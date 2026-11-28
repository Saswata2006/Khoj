import "server-only";
import { randomUUID } from "crypto";
import type { BetterAuthRateLimitStorage } from "better-auth";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum OTP send requests per hour per normalized email. */
export const EMAIL_MAX_REQUESTS_PER_HOUR = 5;

/** Minimum seconds between OTP send requests (resend cooldown). */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Maximum OTP requests per hour per IP address. */
export const IP_MAX_REQUESTS_PER_HOUR = 10;

/** Maximum verification attempts per hour per IP address. */
export const IP_MAX_VERIFY_PER_HOUR = 20;

/** Maximum buyer-initiated contact requests per hour per user. */
export const CONTACT_REQUEST_MAX_PER_HOUR = 10;

/** Minimum seconds between contact requests sent by the same user. */
export const CONTACT_REQUEST_COOLDOWN_SECONDS = 10;

/** Maximum buyer-initiated contact requests per hour per IP address. */
export const CONTACT_REQUEST_IP_MAX_PER_HOUR = 25;

const HOURLY_WINDOW_SECONDS = 60 * 60;
const MS_PER_SECOND = 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the request is allowed again (0 if allowed). */
  retryAfterSeconds: number;
}

interface RateLimitConsumeOptions {
  windowSeconds: number;
  max: number;
  cooldownSeconds?: number;
}

interface AtomicUpsertRow {
  count: number;
  windowStart: Date;
  lastAttemptAt: Date;
}

// ---------------------------------------------------------------------------
// Core atomic PostgreSQL rate-limiter
// ---------------------------------------------------------------------------

/**
 * Atomically checks and consumes one unit for `key` using a single PostgreSQL
 * `INSERT ... ON CONFLICT ("key") DO UPDATE ... WHERE ... RETURNING` query.
 *
 * Concurrency & serverless guarantees:
 * - Row-level lock on `"rate_limits"."key"` prevents TOCTOU race conditions
 *   across concurrent Vercel/serverless invocations.
 * - Cooldown (when specified) is measured from the exact `lastAttemptAt`
 *   timestamp, preventing fixed-minute boundary bypasses.
 * - Blocked requests do NOT increment `count` or advance `lastAttemptAt`.
 */
export async function consumeRateLimit(
  key: string,
  options: RateLimitConsumeOptions
): Promise<RateLimitResult> {
  const now = new Date();
  const windowMs = options.windowSeconds * MS_PER_SECOND;
  const cooldownMs = (options.cooldownSeconds ?? 0) * MS_PER_SECOND;
  const windowCutoff = new Date(now.getTime() - windowMs);
  const cooldownCutoff = new Date(now.getTime() - cooldownMs);
  const newId = randomUUID();

  const updated = await prisma.$queryRaw<AtomicUpsertRow[]>`
    INSERT INTO "rate_limits" ("id", "key", "count", "windowStart", "lastAttemptAt", "createdAt", "updatedAt")
    VALUES (${newId}, ${key}, 1, ${now}, ${now}, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limits"."windowStart" <= ${windowCutoff} THEN 1
        ELSE "rate_limits"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "rate_limits"."windowStart" <= ${windowCutoff} THEN ${now}
        ELSE "rate_limits"."windowStart"
      END,
      "lastAttemptAt" = ${now},
      "updatedAt" = ${now}
    WHERE (
      (${cooldownMs} = 0 OR "rate_limits"."lastAttemptAt" <= ${cooldownCutoff})
      AND ("rate_limits"."windowStart" <= ${windowCutoff} OR "rate_limits"."count" < ${options.max})
    )
    RETURNING "count", "windowStart", "lastAttemptAt";
  `;

  if (updated.length > 0) {
    // Best-effort pruning of stale entries older than 2 hours
    pruneExpiredCounters().catch(() => {});
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Request was blocked — inspect current row to compute accurate Retry-After
  const existing = await prisma.rateLimit.findUnique({
    where: { key },
    select: { windowStart: true, lastAttemptAt: true, count: true },
  });

  if (!existing) {
    // Row disappeared concurrently — conservative 1s retry
    return { allowed: false, retryAfterSeconds: 1 };
  }

  let retryAfterMs = 0;

  if (cooldownMs > 0) {
    const cooldownUnlockAt = existing.lastAttemptAt.getTime() + cooldownMs;
    if (cooldownUnlockAt > now.getTime()) {
      retryAfterMs = Math.max(retryAfterMs, cooldownUnlockAt - now.getTime());
    }
  }

  if (existing.count >= options.max) {
    const windowUnlockAt = existing.windowStart.getTime() + windowMs;
    if (windowUnlockAt > now.getTime()) {
      retryAfterMs = Math.max(retryAfterMs, windowUnlockAt - now.getTime());
    }
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / MS_PER_SECOND)),
  };
}

/**
 * Best-effort cleanup of rate-limit rows older than 2 hours.
 */
async function pruneExpiredCounters(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 2 * HOURLY_WINDOW_SECONDS * MS_PER_SECOND);
    await prisma.rateLimit.deleteMany({
      where: {
        windowStart: { lt: cutoff },
        lastAttemptAt: { lt: cutoff },
      },
    });
  } catch {
    // Non-critical cleanup — never fail the auth request
  }
}

// ---------------------------------------------------------------------------
// Public domain-specific rate-limit checks
// ---------------------------------------------------------------------------

/**
 * Checks and enforces per-email OTP send rate limits atomically:
 * - 60-second resend cooldown (sliding from lastAttemptAt)
 * - Maximum 5 OTP requests per hour per normalized email
 */
export async function checkEmailSendRateLimit(
  normalizedEmail: string
): Promise<RateLimitResult> {
  return consumeRateLimit(`email:otp:${normalizedEmail}`, {
    windowSeconds: HOURLY_WINDOW_SECONDS,
    max: EMAIL_MAX_REQUESTS_PER_HOUR,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
  });
}

/**
 * Checks and enforces per-IP OTP send rate limits atomically:
 * - Maximum 10 OTP send requests per hour per IP
 */
export async function checkIpSendRateLimit(
  ip: string | null | undefined
): Promise<RateLimitResult> {
  if (!ip) return { allowed: true, retryAfterSeconds: 0 };
  return consumeRateLimit(`ip:send:${ip}`, {
    windowSeconds: HOURLY_WINDOW_SECONDS,
    max: IP_MAX_REQUESTS_PER_HOUR,
  });
}

/**
 * Checks and enforces per-IP OTP verification rate limits atomically:
 * - Maximum 20 OTP verification attempts per hour per IP
 */
export async function checkIpVerifyRateLimit(
  ip: string | null | undefined
): Promise<RateLimitResult> {
  if (!ip) return { allowed: true, retryAfterSeconds: 0 };
  return consumeRateLimit(`ip:verify:${ip}`, {
    windowSeconds: HOURLY_WINDOW_SECONDS,
    max: IP_MAX_VERIFY_PER_HOUR,
  });
}

/**
 * Creates a Better Auth compatible persistent rate-limit storage backed
 * by PostgreSQL `rate_limits` via `consumeRateLimit`.
 */
export function createBetterAuthRateLimitStorage(): BetterAuthRateLimitStorage {
  return {
    async consume(key, rule) {
      const result = await consumeRateLimit(`ba:${key}`, {
        windowSeconds: rule.window,
        max: rule.max,
      });
      return {
        allowed: result.allowed,
        retryAfter: result.allowed ? null : result.retryAfterSeconds,
      };
    },
  };
}

/**
 * Checks and enforces per-user contact request anti-spam rate limits atomically:
 * - 10-second burst cooldown between requests
 * - Maximum 10 contact requests per hour per authenticated user
 */
export async function checkContactRequestUserRateLimit(
  userId: string
): Promise<RateLimitResult> {
  return consumeRateLimit(`contact:req:user:${userId}`, {
    windowSeconds: HOURLY_WINDOW_SECONDS,
    max: CONTACT_REQUEST_MAX_PER_HOUR,
    cooldownSeconds: CONTACT_REQUEST_COOLDOWN_SECONDS,
  });
}

/**
 * Checks and enforces per-IP contact request anti-spam rate limits atomically:
 * - Maximum 25 contact requests per hour per IP
 */
export async function checkContactRequestIpRateLimit(
  ip: string | null | undefined
): Promise<RateLimitResult> {
  if (!ip) return { allowed: true, retryAfterSeconds: 0 };
  return consumeRateLimit(`contact:req:ip:${ip}`, {
    windowSeconds: HOURLY_WINDOW_SECONDS,
    max: CONTACT_REQUEST_IP_MAX_PER_HOUR,
  });
}

/**
 * Resets rate-limit counters for a single normalized email (testing helper).
 */
export async function resetEmailRateLimits(
  normalizedEmail: string
): Promise<void> {
  await prisma.rateLimit.deleteMany({
    where: { key: `email:otp:${normalizedEmail}` },
  });
}
