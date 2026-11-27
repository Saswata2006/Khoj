import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock external dependencies — no real emails, no real database, no real clock
// ---------------------------------------------------------------------------

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    rateLimit: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
  prisma: {
    rateLimit: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

// Mock nodemailer — prevent any real SMTP calls
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "mock-id" }),
      verify: vi.fn().mockResolvedValue(true),
    })),
  },
}));

// Mock next/headers (server-only module)
vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}));

// Mock server-only (no-op)
vi.mock("server-only", () => ({}));

// Mock better-auth/adapters/prisma
vi.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: vi.fn(() => vi.fn()),
}));

// Mock better-auth
vi.mock("better-auth", () => ({
  betterAuth: vi.fn(() => ({
    api: {
      getSession: vi.fn(),
    },
    $Infer: { Session: { user: {} } },
    handler: vi.fn(),
  })),
}));

// Mock better-auth/plugins
vi.mock("better-auth/plugins", () => ({
  emailOTP: vi.fn(() => ({ id: "email-otp" })),
}));

// Mock better-auth/client and client plugins at top level
vi.mock("better-auth/client", () => ({
  createAuthClient: vi.fn(() => ({
    emailOtp: {
      sendVerificationOtp: vi.fn().mockResolvedValue({ error: { message: "user not found" } }),
    },
    signIn: {
      emailOtp: vi.fn().mockResolvedValue({ error: { message: "invalid otp" } }),
    },
    getSession: vi.fn().mockResolvedValue({ data: null }),
    signOut: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("better-auth/client/plugins", () => ({
  emailOTPClient: vi.fn(() => ({})),
  inferAdditionalFields: vi.fn(() => ({})),
}));

import { normalizeEmail, hashOtp } from "@/lib/auth";
import { createHash } from "crypto";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import {
  sendOtpEmail,
  verifySmtpConnection,
  _resetTransporterForTest,
} from "@/lib/email";
import {
  checkEmailSendRateLimit,
  checkIpSendRateLimit,
  checkIpVerifyRateLimit,
  createBetterAuthRateLimitStorage,
  resetEmailRateLimits,
} from "@/lib/rate-limit";
import {
  getCurrentUser,
  requireUser,
  requireAdmin,
  AuthorizationError,
  isAuthorizationError,
} from "@/lib/authorization";
import { auth } from "@/lib/auth";
import { sendOtp, verifyOtp } from "@/lib/auth-client";

// Capture module-initialization options before describe blocks call vi.clearAllMocks()
const capturedEmailOtpOptions = vi.mocked(emailOTP).mock.calls[0]?.[0];
const capturedAuthOptions = vi.mocked(betterAuth).mock.calls[0]?.[0];

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

function makeRateLimitRow(overrides?: {
  id?: string;
  key?: string;
  count?: number;
  windowStart?: Date;
  lastAttemptAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const now = new Date();
  return {
    id: overrides?.id ?? "rl_1",
    key: overrides?.key ?? "k",
    count: overrides?.count ?? 1,
    windowStart: overrides?.windowStart ?? now,
    lastAttemptAt: overrides?.lastAttemptAt ?? now,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
  };
}

// ---------------------------------------------------------------------------
// 1. Email normalization
// ---------------------------------------------------------------------------

describe("Email normalization", () => {
  it("lowercases the entire email address", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("handles already-normalized email unchanged", () => {
    expect(normalizeEmail("user@example.com")).toBe("user@example.com");
  });

  it("handles mixed-case with whitespace", () => {
    expect(normalizeEmail("  ADMIN@KHOJ.APP  ")).toBe("admin@khoj.app");
  });
});

// ---------------------------------------------------------------------------
// 2. OTP email — no real emails sent
// ---------------------------------------------------------------------------

describe("sendOtpEmail", () => {
  beforeEach(() => {
    _resetTransporterForTest();
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "test@example.com";
    process.env.SMTP_PASS = "test-pass";
    process.env.EMAIL_FROM = "noreply@khoj.app";
  });

  it("resolves without throwing when nodemailer mock succeeds", async () => {
    await expect(sendOtpEmail("user@example.com", "123456")).resolves.toBeUndefined();
  });

  it("throws a sanitized error when SMTP rejects without leaking credentials", async () => {
    const nodemailer = await import("nodemailer");
    const mockTransport = {
      sendMail: vi
        .fn()
        .mockRejectedValueOnce(new Error("AUTH failed for test-pass on smtp.gmail.com")),
      verify: vi.fn().mockResolvedValue(true),
    };
    vi.mocked(nodemailer.default.createTransport).mockReturnValueOnce(
      mockTransport as unknown as ReturnType<typeof nodemailer.default.createTransport>
    );

    await expect(sendOtpEmail("user@example.com", "123456")).rejects.toThrow(
      "Failed to send verification email."
    );
  });
});

describe("verifySmtpConnection", () => {
  beforeEach(() => {
    _resetTransporterForTest();
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "test@example.com";
    process.env.SMTP_PASS = "test-pass";
  });

  it("returns true when SMTP verify succeeds", async () => {
    const result = await verifySmtpConnection();
    expect(result).toBe(true);
  });

  it("returns false instead of throwing when SMTP verify fails", async () => {
    const nodemailer = await import("nodemailer");
    vi.mocked(nodemailer.default.createTransport).mockReturnValueOnce({
      sendMail: vi.fn(),
      verify: vi.fn().mockRejectedValueOnce(new Error("Connection refused")),
    } as unknown as ReturnType<typeof nodemailer.default.createTransport>);

    const result = await verifySmtpConnection();
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Rate limiting — per-email send limits (atomic $queryRaw + lastAttemptAt)
// ---------------------------------------------------------------------------

describe("Email send rate limiting", () => {
  let prisma: Awaited<typeof import("@/lib/prisma")>["default"];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T10:00:00.000Z"));
    const mod = await import("@/lib/prisma");
    prisma = mod.default;
    vi.clearAllMocks();
    vi.mocked(prisma.rateLimit.deleteMany).mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first OTP request when atomic upsert returns a row", async () => {
    const now = new Date();
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { count: 1, windowStart: now, lastAttemptAt: now },
    ]);

    const result = await checkEmailSendRateLimit("user@example.com");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("blocks the second request within the 60-second cooldown window", async () => {
    const now = new Date();
    // Atomic upsert returns [] (blocked by WHERE clause), then findUnique inspects lastAttemptAt
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValueOnce(
      makeRateLimitRow({
        key: "email:otp:user@example.com",
        count: 1,
        windowStart: now,
        lastAttemptAt: new Date(now.getTime() - 10_000), // 10s ago -> 50s remaining
      })
    );

    const result = await checkEmailSendRateLimit("user@example.com");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(50);
  });

  it("blocks when hourly limit of 5 is reached even after cooldown elapsed", async () => {
    const now = new Date();
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValueOnce(
      makeRateLimitRow({
        key: "email:otp:user@example.com",
        count: 5,
        windowStart: new Date(now.getTime() - 20 * 60_000), // 20 min ago -> 40 min left
        lastAttemptAt: new Date(now.getTime() - 120_000), // 2 min ago (cooldown passed)
      })
    );

    const result = await checkEmailSendRateLimit("user@example.com");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(40 * 60);
  });

  it("allows the 5th request per hour (boundary)", async () => {
    const now = new Date();
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        count: 5,
        windowStart: new Date(now.getTime() - 10 * 60_000),
        lastAttemptAt: now,
      },
    ]);

    const result = await checkEmailSendRateLimit("user@example.com");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("resetEmailRateLimits deletes only the target normalized email key", async () => {
    await resetEmailRateLimits("user@example.com");
    expect(prisma.rateLimit.deleteMany).toHaveBeenCalledWith({
      where: { key: "email:otp:user@example.com" },
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Rate limiting — per-IP limits & Better Auth storage adapter
// ---------------------------------------------------------------------------

describe("IP send rate limiting", () => {
  let prisma: Awaited<typeof import("@/lib/prisma")>["default"];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T10:00:00.000Z"));
    const mod = await import("@/lib/prisma");
    prisma = mod.default;
    vi.clearAllMocks();
    vi.mocked(prisma.rateLimit.deleteMany).mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows when IP is null (no IP available)", async () => {
    const result = await checkIpSendRateLimit(null);
    expect(result.allowed).toBe(true);
  });

  it("allows when IP is undefined", async () => {
    const result = await checkIpSendRateLimit(undefined);
    expect(result.allowed).toBe(true);
  });

  it("allows when IP count is below limit", async () => {
    const now = new Date();
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { count: 10, windowStart: now, lastAttemptAt: now },
    ]);

    const result = await checkIpSendRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("blocks when IP send count reaches 10", async () => {
    const now = new Date();
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValueOnce(
      makeRateLimitRow({
        key: "ip:send:1.2.3.4",
        count: 10,
        windowStart: new Date(now.getTime() - 10 * 60_000),
        lastAttemptAt: now,
      })
    );

    const result = await checkIpSendRateLimit("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(50 * 60);
  });
});

describe("IP verify rate limiting", () => {
  let prisma: Awaited<typeof import("@/lib/prisma")>["default"];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T10:00:00.000Z"));
    const mod = await import("@/lib/prisma");
    prisma = mod.default;
    vi.clearAllMocks();
    vi.mocked(prisma.rateLimit.deleteMany).mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows when IP verify count is below limit", async () => {
    const now = new Date();
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { count: 20, windowStart: now, lastAttemptAt: now },
    ]);

    const result = await checkIpVerifyRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("blocks when IP verify count reaches 20", async () => {
    const now = new Date();
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValueOnce(
      makeRateLimitRow({
        key: "ip:verify:1.2.3.4",
        count: 20,
        windowStart: new Date(now.getTime() - 5 * 60_000),
        lastAttemptAt: now,
      })
    );

    const result = await checkIpVerifyRateLimit("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(55 * 60);
  });

  it("createBetterAuthRateLimitStorage adapts consumeRateLimit for Better Auth", async () => {
    const now = new Date();
    const storage = createBetterAuthRateLimitStorage();

    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { count: 1, windowStart: now, lastAttemptAt: now },
    ]);
    const allowedRes = await storage.consume("1.2.3.4:/sign-in/email-otp", {
      window: 3600,
      max: 20,
    });
    expect(allowedRes).toEqual({ allowed: true, retryAfter: null });

    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValueOnce(
      makeRateLimitRow({
        key: "ba:1.2.3.4:/sign-in/email-otp",
        count: 20,
        windowStart: new Date(now.getTime() - 30 * 60_000),
        lastAttemptAt: now,
      })
    );
    const blockedRes = await storage.consume("1.2.3.4:/sign-in/email-otp", {
      window: 3600,
      max: 20,
    });
    expect(blockedRes).toEqual({ allowed: false, retryAfter: 30 * 60 });
  });
});

// ---------------------------------------------------------------------------
// 5. Authorization helpers
// ---------------------------------------------------------------------------

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no session exists", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("returns the user from a valid session", async () => {
    const mockUser = {
      id: "usr_1",
      email: "user@example.com",
      name: "Test",
      role: "USER",
      emailVerified: true,
    };
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: mockUser,
      session: {},
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    const user = await getCurrentUser();
    expect(user).toEqual(mockUser);
  });

  it("returns null when getSession throws an error", async () => {
    vi.mocked(auth.api.getSession).mockRejectedValueOnce(new Error("DB error"));
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user when authenticated", async () => {
    const mockUser = {
      id: "usr_1",
      email: "user@example.com",
      name: "Test",
      role: "USER",
      emailVerified: true,
    };
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({
      user: mockUser,
      session: {},
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    const user = await requireUser();
    expect(user).toEqual(mockUser);
  });

  it("throws AuthorizationError with status 401 when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);
    await expect(requireUser()).rejects.toThrow(AuthorizationError);
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user when authenticated as ADMIN", async () => {
    const mockAdmin = {
      id: "usr_admin",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      emailVerified: true,
    };
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: mockAdmin,
      session: {},
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    const user = await requireAdmin();
    expect(user).toEqual(mockAdmin);
  });

  it("throws AuthorizationError with status 403 for non-admin USER", async () => {
    const mockUser = {
      id: "usr_1",
      email: "user@example.com",
      name: "Test",
      role: "USER",
      emailVerified: true,
    };
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: mockUser,
      session: {},
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("throws AuthorizationError with status 401 when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });

  it("prevents privilege escalation — USER role cannot access admin endpoints", async () => {
    const mockUser = {
      id: "usr_1",
      email: "user@example.com",
      name: "Test",
      role: "USER",
      emailVerified: true,
    };
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: mockUser,
      session: {},
    } as Awaited<ReturnType<typeof auth.api.getSession>>);

    let thrownError: unknown;
    try {
      await requireAdmin();
    } catch (err) {
      thrownError = err;
    }

    expect(isAuthorizationError(thrownError)).toBe(true);
    expect((thrownError as AuthorizationError).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 6. AuthorizationError class
// ---------------------------------------------------------------------------

describe("AuthorizationError", () => {
  it("constructs with the correct status and message", () => {
    const err = new AuthorizationError("Not allowed", 403);
    expect(err.message).toBe("Not allowed");
    expect(err.status).toBe(403);
    expect(err.name).toBe("AuthorizationError");
  });

  it("is an instance of Error", () => {
    const err = new AuthorizationError("Unauthorized", 401);
    expect(err instanceof Error).toBe(true);
    expect(err instanceof AuthorizationError).toBe(true);
  });

  it("isAuthorizationError returns true for AuthorizationError", () => {
    expect(isAuthorizationError(new AuthorizationError("x", 401))).toBe(true);
  });

  it("isAuthorizationError returns false for plain Error", () => {
    expect(isAuthorizationError(new Error("plain"))).toBe(false);
  });

  it("isAuthorizationError returns false for non-Error values", () => {
    expect(isAuthorizationError("string")).toBe(false);
    expect(isAuthorizationError(null)).toBe(false);
    expect(isAuthorizationError(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Generic error response — no account enumeration
// ---------------------------------------------------------------------------

describe("Generic error responses", () => {
  it("sendOtp and verifyOtp return generic messages on failure — not 'user not found'", async () => {
    const sendResult = await sendOtp("nonexistent@example.com");
    expect(sendResult.success).toBe(false);
    expect(sendResult.error).not.toContain("user not found");
    expect(sendResult.error).not.toContain("not registered");

    const verifyResult = await verifyOtp("nonexistent@example.com", "000000");
    expect(verifyResult.success).toBe(false);
    expect(verifyResult.error).not.toContain("invalid otp");
  });

  it("verifyOtp rejects malformed non-6-digit OTPs before hitting the API", async () => {
    const result = await verifyOtp("user@example.com", "abc");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid or expired verification code.");
  });
});

// ---------------------------------------------------------------------------
// 8. Phase C1 Hardening: Keyed HMAC-SHA256 OTP Hashing & Unused Endpoint Lock
// ---------------------------------------------------------------------------

describe("Keyed HMAC-SHA256 OTP hashing (OTP_HASH_SECRET)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("produces a keyed HMAC-SHA256 base64url digest rather than plaintext or unkeyed SHA-256", async () => {
    process.env.OTP_HASH_SECRET = "a-dedicated-32-character-minimum-secret-1234";
    const otp = "482910";
    const digest = await hashOtp(otp);

    expect(digest).not.toBe(otp);
    const unkeyedSha256 = createHash("sha256").update(otp).digest("base64url");
    expect(digest).not.toBe(unkeyedSha256);

    // Deterministic for the same key and OTP
    expect(await hashOtp(otp)).toBe(digest);
  });

  it("produces different digests when OTP_HASH_SECRET changes", async () => {
    process.env.OTP_HASH_SECRET = "secret-one-with-at-least-32-characters-0001";
    const digestA = await hashOtp("123456");

    process.env.OTP_HASH_SECRET = "secret-two-with-at-least-32-characters-0002";
    const digestB = await hashOtp("123456");

    expect(digestA).not.toBe(digestB);
  });

  it("throws in production when OTP_HASH_SECRET is missing or under 32 characters", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.OTP_HASH_SECRET;
    await expect(hashOtp("123456")).rejects.toThrow("OTP_HASH_SECRET");

    process.env.OTP_HASH_SECRET = "too-short";
    await expect(hashOtp("123456")).rejects.toThrow("OTP_HASH_SECRET");
  });
});

describe("Better Auth hardening configuration", () => {
  it("configures custom HMAC storeOTP, disables unused OTP endpoints, and disables cookieCache", () => {
    expect(capturedEmailOtpOptions).toBeDefined();
    expect(capturedEmailOtpOptions?.otpLength).toBe(6);
    expect(capturedEmailOtpOptions?.expiresIn).toBe(300);
    expect(capturedEmailOtpOptions?.allowedAttempts).toBe(3);
    expect(capturedEmailOtpOptions?.resendStrategy).toBe("rotate");
    expect(capturedEmailOtpOptions?.storeOTP).toEqual({ hash: hashOtp });

    expect(capturedAuthOptions).toBeDefined();
    expect(capturedAuthOptions?.emailAndPassword?.enabled).toBe(false);
    expect(capturedAuthOptions?.session?.cookieCache?.enabled).toBe(false);
    expect(capturedAuthOptions?.disabledPaths).toContain(
      "/email-otp/check-verification-otp"
    );
    expect(capturedAuthOptions?.disabledPaths).toContain(
      "/email-otp/verify-email"
    );
    expect(capturedAuthOptions?.disabledPaths).toContain("/sign-in/email");
  });

  it("sets Cache-Control: no-store on /api/auth/[...all] responses", async () => {
    const { GET, POST } = await import("@/app/api/auth/[...all]/route");
    vi.mocked(auth.handler).mockResolvedValue(
      new Response(JSON.stringify({ session: null }), { status: 200 })
    );

    const getRes = await GET(new Request("http://localhost:3000/api/auth/get-session"));
    expect(getRes.headers.get("Cache-Control")).toContain("no-store");
    expect(getRes.headers.get("Pragma")).toBe("no-cache");

    const postRes = await POST(
      new Request("http://localhost:3000/api/auth/sign-out", { method: "POST" })
    );
    expect(postRes.headers.get("Cache-Control")).toContain("no-store");
  });
});
