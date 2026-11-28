import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthUser = typeof auth.$Infer.Session.user;

// ---------------------------------------------------------------------------
// Server-side authorization helpers
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated user from the current request session,
 * or null if the request is unauthenticated or the session is invalid.
 *
 * Safe to call in Server Components, Route Handlers, and Server Actions.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const requestHeaders = await headers();
  try {
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the authenticated user or throws a structured error if
 * the request is unauthenticated.
 *
 * Use in protected Server Actions and Route Handlers.
 *
 * @throws {AuthorizationError} with status 401 when unauthenticated.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError("Authentication required.", 401);
  }
  return user;
}

/**
 * Returns the authenticated user only if they have the ADMIN role.
 * Throws a structured error for unauthenticated or non-admin requests.
 *
 * @throws {AuthorizationError} with status 401 when unauthenticated.
 * @throws {AuthorizationError} with status 403 when the user lacks ADMIN role.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if ((user as AuthUser & { role?: string }).role !== "ADMIN") {
    throw new AuthorizationError("Admin access required.", 403);
  }
  return user;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * Structured authorization error that includes an HTTP status code.
 * Callers can inspect `error.status` to construct the correct HTTP response.
 */
export class AuthorizationError extends Error {
  public readonly status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

/**
 * Returns true if the error is an AuthorizationError.
 */
export function isAuthorizationError(
  error: unknown
): error is AuthorizationError {
  return error instanceof AuthorizationError;
}
