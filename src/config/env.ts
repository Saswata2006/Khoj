import { z } from "zod";

/**
 * Schema for environment variables.
 * Designed to validate without leaking secrets or failing non-database builds.
 */
export const envSchema = z.object({
  // Public client-facing envs
  NEXT_PUBLIC_APP_NAME: z.string().default("Khoj"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_CAMPUS_NAME: z.string().default("Campus Community"),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().optional(),

  // Server-only database credentials
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),

  // Campus email restrictions (comma-separated domains)
  ALLOWED_EMAIL_DOMAINS: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === "") return [];
      return val
        .split(",")
        .map((domain) => domain.trim())
        .filter(Boolean);
    }),

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
    ALLOWED_EMAIL_DOMAINS: process.env.ALLOWED_EMAIL_DOMAINS,
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
