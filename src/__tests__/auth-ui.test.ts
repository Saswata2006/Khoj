import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock next/navigation for SSR component rendering tests
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock next/link to render standard anchor tags in SSR tests
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/authorization", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

// Mock auth-client so no real network/OTP calls happen
vi.mock("@/lib/auth-client", () => ({
  sendOtp: vi.fn().mockResolvedValue({ success: true }),
  verifyOtp: vi.fn().mockResolvedValue({ success: true }),
  getSession: vi.fn().mockResolvedValue(null),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

import {
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
  POST_AUTH_REDIRECT_PATH,
  applyOtpBackspace,
  applyOtpDigitChange,
  applyOtpPaste,
  clearPendingVerification,
  createEmptyOtpDigits,
  extractOtpDigits,
  getRemainingCooldownSeconds,
  isValidEmailInput,
  loadPendingVerification,
  normalizeEmailInput,
  savePendingVerification,
} from "@/lib/auth-ui";
import { sendOtp, verifyOtp } from "@/lib/auth-client";
import { LoginForm } from "@/components/auth/LoginForm";
import { VerifyOtpForm } from "@/components/auth/VerifyOtpForm";
import { OtpInput } from "@/components/auth/OtpInput";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

// ---------------------------------------------------------------------------
// 1. Email validation & normalization (no college-domain restriction)
// ---------------------------------------------------------------------------

describe("Login email validation", () => {
  it("accepts personal and institutional email addresses", () => {
    expect(isValidEmailInput("user@gmail.com")).toBe(true);
    expect(isValidEmailInput("alex@outlook.com")).toBe(true);
    expect(isValidEmailInput("student@iitb.ac.in")).toBe(true);
    expect(isValidEmailInput("alumni@mit.edu")).toBe(true);
    expect(isValidEmailInput("  MixedCase@Domain.ORG  ")).toBe(true);
  });

  it("rejects malformed email addresses", () => {
    expect(isValidEmailInput("")).toBe(false);
    expect(isValidEmailInput("not-an-email")).toBe(false);
    expect(isValidEmailInput("missing@domain")).toBe(false);
    expect(isValidEmailInput("@example.com")).toBe(false);
    expect(isValidEmailInput("user name@example.com")).toBe(false);
  });

  it("normalizes email by trimming and lowercasing", () => {
    expect(normalizeEmailInput("  User.Name@Gmail.COM  ")).toBe(
      "user.name@gmail.com"
    );
  });
});

// ---------------------------------------------------------------------------
// 2. OTP input behavior (digit entry, paste, backspace, focus)
// ---------------------------------------------------------------------------

describe("OTP input behavior", () => {
  it("extracts up to 6 numeric digits from noisy input", () => {
    expect(extractOtpDigits("123-456")).toBe("123456");
    expect(extractOtpDigits("12 34 56 78")).toBe("123456");
    expect(extractOtpDigits("abc")).toBe("");
  });

  it("advances focus on single-digit entry", () => {
    const start = createEmptyOtpDigits();
    const res1 = applyOtpDigitChange(start, 0, "4");
    expect(res1.digits).toEqual(["4", "", "", "", "", ""]);
    expect(res1.nextFocusIndex).toBe(1);

    const resLast = applyOtpDigitChange(["4", "2", "3", "4", "5", ""], 5, "9");
    expect(resLast.digits).toEqual(["4", "2", "3", "4", "5", "9"]);
    expect(resLast.nextFocusIndex).toBe(5);
  });

  it("supports full 6-digit paste from any box", () => {
    const start = createEmptyOtpDigits();
    const pasted = applyOtpPaste(start, "987-654", 2);
    expect(pasted.digits).toEqual(["9", "8", "7", "6", "5", "4"]);
    expect(pasted.nextFocusIndex).toBe(OTP_LENGTH - 1);
  });

  it("navigates backward on backspace when current box is empty", () => {
    const current = ["1", "2", "", "", "", ""];
    const res = applyOtpBackspace(current, 2);
    expect(res.digits).toEqual(["1", "", "", "", "", ""]);
    expect(res.nextFocusIndex).toBe(1);
  });

  it("clears current box without moving back when current box is filled", () => {
    const current = ["1", "2", "3", "", "", ""];
    const res = applyOtpBackspace(current, 2);
    expect(res.digits).toEqual(["1", "2", "", "", "", ""]);
    expect(res.nextFocusIndex).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Resend cooldown & ephemeral sessionStorage state (no OTP stored)
// ---------------------------------------------------------------------------

describe("Resend cooldown and pending verification storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "window", {
      value: {
        sessionStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => {
            store.set(k, v);
          },
          removeItem: (k: string) => {
            store.delete(k);
          },
        },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("computes remaining 60-second cooldown accurately", () => {
    const now = 1_700_000_000_000;
    const cooldownUntil = now + RESEND_COOLDOWN_SECONDS * 1000;
    expect(getRemainingCooldownSeconds(cooldownUntil, now)).toBe(60);
    expect(getRemainingCooldownSeconds(cooldownUntil, now + 15_500)).toBe(45);
    expect(getRemainingCooldownSeconds(cooldownUntil, now + 60_000)).toBe(0);
    expect(getRemainingCooldownSeconds(null, now)).toBe(0);
  });

  it("stores only pending email and cooldown in sessionStorage, never OTPs", () => {
    const now = 1_700_000_000_000;
    savePendingVerification("  User@Example.COM ", now);

    const loaded = loadPendingVerification();
    expect(loaded.email).toBe("user@example.com");
    expect(loaded.cooldownUntilMs).toBe(now + 60_000);
    expect(loaded.redirectTo).toBe("/dashboard");
    expect(Array.from(store.keys())).toEqual([
      "khoj_pending_verify_email",
      "khoj_otp_cooldown_until",
    ]);

    clearPendingVerification();
    expect(loadPendingVerification()).toEqual({
      email: null,
      cooldownUntilMs: null,
      redirectTo: "/dashboard",
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Mocked auth client contract & UI rendering checks
// ---------------------------------------------------------------------------

describe("Auth client contract & SSR UI rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses existing sendOtp and verifyOtp client contracts", async () => {
    vi.mocked(sendOtp).mockResolvedValueOnce({ success: true });
    vi.mocked(verifyOtp).mockResolvedValueOnce({
      success: false,
      error: "Invalid or expired verification code.",
    });

    const sendRes = await sendOtp("user@example.com");
    expect(sendRes).toEqual({ success: true });

    const verifyRes = await verifyOtp("user@example.com", "000000");
    expect(verifyRes).toEqual({
      success: false,
      error: "Invalid or expired verification code.",
    });
    expect(POST_AUTH_REDIRECT_PATH).toBe("/dashboard");
  });

  it("renders LoginForm with Khoj branding copy, email input, passwordless copy, and back-to-home link", () => {
    const html = renderToStaticMarkup(React.createElement(LoginForm));
    expect(html).toContain("Sign in to Khoj");
    expect(html).toContain("Passwordless Sign-In");
    expect(html).toContain('type="email"');
    expect(html).toContain("Send OTP");
    expect(html).toContain("Back to home");
    expect(html).toContain('href="/"');
  });

  it("renders VerifyOtpForm gracefully when initializing without exposing email in URL", () => {
    const html = renderToStaticMarkup(React.createElement(VerifyOtpForm));
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toMatch(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  });

  it("renders OtpInput with 6 numeric inputs and mobile keyboard attributes", () => {
    const html = renderToStaticMarkup(
      React.createElement(OtpInput, {
        digits: createEmptyOtpDigits(),
        onChange: () => {},
        hasError: true,
      })
    );
    expect(html).toContain("grid-cols-6");
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('autoComplete="one-time-code"');
    expect(html).toContain('aria-label="Digit 1 of 6"');
    expect(html).toContain('aria-label="Digit 6 of 6"');
    expect(html).toContain('aria-invalid="true"');
  });

  it("renders Navbar Sign In link pointing to /login without GitHub link, and Footer with GitHub link", () => {
    const navHtml = renderToStaticMarkup(React.createElement(Navbar));
    expect(navHtml).toContain('href="/login"');
    expect(navHtml).toContain("Sign In");
    expect(navHtml).not.toContain("Sign In (Coming Soon)");
    expect(navHtml).not.toContain("GitHub");

    const footerHtml = renderToStaticMarkup(React.createElement(Footer));
    expect(footerHtml).toContain("https://github.com/Saswata2006/Khoj");
    expect(footerHtml).toContain("GitHub");
  });
});
