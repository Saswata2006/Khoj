import { describe, it, expect } from "vitest";
import { envSchema } from "@/config/env";

describe("Environment Validation Schema", () => {
  it("should apply safe defaults for missing client variables", () => {
    const parsed = envSchema.parse({});
    expect(parsed.NEXT_PUBLIC_APP_NAME).toBe("Khoj");
    expect(parsed.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.ALLOWED_EMAIL_DOMAINS).toEqual([]);
  });

  it("should parse comma-separated email domains into a clean trimmed array", () => {
    const parsed = envSchema.parse({
      ALLOWED_EMAIL_DOMAINS: "iitb.ac.in, bits-pilani.ac.in,  campus.edu ",
    });
    expect(parsed.ALLOWED_EMAIL_DOMAINS).toEqual([
      "iitb.ac.in",
      "bits-pilani.ac.in",
      "campus.edu",
    ]);
  });

  it("should handle empty or whitespace email domain strings gracefully", () => {
    const parsed = envSchema.parse({
      ALLOWED_EMAIL_DOMAINS: "  ",
    });
    expect(parsed.ALLOWED_EMAIL_DOMAINS).toEqual([]);
  });

  it("should validate valid database URLs", () => {
    const parsed = envSchema.parse({
      DATABASE_URL: "postgresql://user:pass@ep-host.neon.tech/khoj?sslmode=require",
      DIRECT_URL: "postgresql://user:pass@ep-host.neon.tech/khoj?sslmode=require",
    });
    expect(parsed.DATABASE_URL).toBeDefined();
    expect(parsed.DIRECT_URL).toBeDefined();
  });
});
