import { describe, it, expect } from "vitest";
import { envSchema } from "@/config/env";

describe("Environment Validation Schema", () => {
  it("should apply safe defaults for missing variables", () => {
    const parsed = envSchema.parse({});
    expect(parsed.NEXT_PUBLIC_APP_NAME).toBe("Khoj");
    expect(parsed.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(parsed.NEXT_PUBLIC_CAMPUS_NAME).toBe("Community");
    expect(parsed.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(parsed.SMTP_PORT).toBe(587);
    expect(parsed.NODE_ENV).toBe("development");
  });

  it("should coerce SMTP_PORT strings to a positive integer and reject invalid ports", () => {
    const parsed = envSchema.parse({ SMTP_PORT: "587" });
    expect(parsed.SMTP_PORT).toBe(587);

    expect(() => envSchema.parse({ SMTP_PORT: "-1" })).toThrow();
    expect(() => envSchema.parse({ SMTP_PORT: "abc" })).toThrow();
  });

  it("should validate auth URL and email fields", () => {
    const parsed = envSchema.parse({
      BETTER_AUTH_URL: "https://khoj.example.com",
      BETTER_AUTH_SECRET: "a-sufficiently-long-secret-placeholder",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_USER: "sender@example.com",
      EMAIL_FROM: "noreply@khoj.app",
    });

    expect(parsed.BETTER_AUTH_URL).toBe("https://khoj.example.com");
    expect(parsed.SMTP_HOST).toBe("smtp.gmail.com");
    expect(parsed.EMAIL_FROM).toBe("noreply@khoj.app");

    expect(() => envSchema.parse({ BETTER_AUTH_URL: "not-a-url" })).toThrow();
    expect(() => envSchema.parse({ EMAIL_FROM: "not-an-email" })).toThrow();
  });

  it("should validate valid database URLs", () => {
    const parsed = envSchema.parse({
      DATABASE_URL: "postgresql://user:pass@ep-host.neon.tech/khoj?sslmode=require",
      DIRECT_URL: "postgresql://user:pass@ep-host.neon.tech/khoj?sslmode=require",
    });
    expect(parsed.DATABASE_URL).toBeDefined();
    expect(parsed.DIRECT_URL).toBeDefined();
  });

  it("should validate OTP_HASH_SECRET minimum length when provided", () => {
    expect(envSchema.parse({ OTP_HASH_SECRET: "" }).OTP_HASH_SECRET).toBe("");
    expect(
      envSchema.parse({
        OTP_HASH_SECRET: "0123456789abcdef0123456789abcdef",
      }).OTP_HASH_SECRET
    ).toBe("0123456789abcdef0123456789abcdef");

    expect(() =>
      envSchema.parse({ OTP_HASH_SECRET: "short-secret" })
    ).toThrow();
  });
});
