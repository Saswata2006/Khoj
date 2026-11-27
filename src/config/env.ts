import { z } from "zod";

/**
 * Schema for environment variables.
 * Designed to validate without leaking secrets or failing non-database builds.
 * Platform: Khoj — public community marketplace and lost & found.
 */
export const envSchema = z.object({
  // Public client-facing envs
  NEXT_PUBLIC_APP_NAME: z.string().default("Khoj"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_CAMPUS_NAME: z.string().default("Community"),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().optional(),

  // Server-only database credentials
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),

  // Better Auth — server-side secrets (never exposed to client)
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  // SMTP configuration — server-side only
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Runtime environment
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

let cachedEnv: ValidatedEnv | null = null;

/**
 * Validates and returns parsed environment variables.
 * Safe to call during build and runtime.
 */
export function getEnv(): ValidatedEnv {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CAMPUS_NAME: process.env.NEXT_PUBLIC_CAMPUS_NAME,
    NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!result.success) {
    // Collect error messages without logging actual env values
    const errorIssues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    // If running in production runtime, warn or throw
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Environment configuration error: ${errorIssues}`);
    }
    // In development or test, fall back to safe defaults
    return envSchema.parse({
      NEXT_PUBLIC_APP_NAME: "Khoj",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NODE_ENV: "development",
    });
  }

  cachedEnv = result.data;
  return cachedEnv;
}
