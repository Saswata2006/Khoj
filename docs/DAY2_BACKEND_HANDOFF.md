# Khoj — Day 2 Backend Handoff (Authentication & Authorization)

This document defines the authentication and authorization contracts produced in Day 2 Phase A for Phase B frontend integration.

---

## 1. Architecture Overview

- **Provider:** Better Auth (`1.7.28`, latest verified release with `atomicVerifyOTP` and `revokeUnprovenAccountAccess`) with the `emailOTP` plugin and official `prismaAdapter` (PostgreSQL on Neon).
- **Authentication Mode:** Passwordless 6-digit Email OTP (`type: "sign-in"`) only. Passwords, magic links, password-reset, email-change, and unused OTP endpoints (`/email-otp/check-verification-otp`, `/email-otp/verify-email`) are disabled via `emailAndPassword: { enabled: false }` and `disabledPaths`.
- **OTP Storage:** Keyed HMAC-SHA256 via Better Auth's custom `storeOTP: { hash: hashOtp }` using server-side `OTP_HASH_SECRET` (minimum 32 characters required in production).
- **Email Delivery:** Nodemailer SMTP transporter (`src/lib/email.ts`) on port `587` with `requireTLS: true` (STARTTLS).
- **Sessions & Caching:** 7-day PostgreSQL database-backed sessions (`sessions` table), refreshed every 24 h (`updateAge`), `cookieCache` disabled (`enabled: false`), explicit `Cache-Control: no-store` on `/api/auth/*` and `/api/profile`, `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- **Rate Limiting:** Persistent, atomic PostgreSQL counters (`rate_limits` table via `INSERT ... ON CONFLICT ("key") DO UPDATE`) enforced server-side on `/api/auth/*` via Better Auth `rateLimit.customStorage` (IP limits) and `hooks.before` (per-email cooldown and hourly cap).

---

## 2. Client Authentication Functions (`src/lib/auth-client.ts`)

Import from `@/lib/auth-client` in `"use client"` components:

```ts
import { sendOtp, verifyOtp, getSession, signOut, authClient } from "@/lib/auth-client";
```

### `sendOtp(email: string): Promise<SendOtpResult>`
Requests a 6-digit sign-in OTP for any valid email address (no college-domain restriction).
- **Parameters:** `email: string`
- **Returns:** `{ success: boolean; error?: string }`

### `verifyOtp(email: string, otp: string): Promise<VerifyOtpResult>`
Verifies the 6-digit OTP and creates a 7-day session. Automatically registers new users with `role: "USER"` and `emailVerified: true` **only after** OTP verification succeeds.
- **Parameters:** `email: string`, `otp: string`
- **Returns:**
  ```ts
  {
    success: boolean;
    user?: {
      id: string;
      name: string | null;
      email: string;
      emailVerified: boolean;
      image: string | null;
      role: string; // "USER" | "ADMIN"
      hostelBlock: string | null;
      location: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    error?: string;
  }
  ```

### `getSession(): Promise<SessionData | null>`
Reads the current session from `/api/auth/get-session`.
- **Returns:** `{ session, user } | null`

### `signOut(): Promise<void>`
Invalidates the current database session and clears the session cookie.

---

## 3. HTTP Endpoints & Contracts (`/api/auth/[...all]`)

Mounted via `toNextJsHandler(auth)` in `src/app/api/auth/[...all]/route.ts`.

### Send OTP
- **Endpoint:** `POST /api/auth/email-otp/send-verification-otp`
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "type": "sign-in"
  }
  ```
- **Success (`200 OK`):**
  ```json
  { "success": true }
  ```
- **Rate Limits Enforced Server-Side:**
  - `60s` resend cooldown per normalized email (`Retry-After` header returned on `429`).
  - `5` requests per hour per normalized email.
  - `10` requests per hour per client IP.

### Verify OTP & Sign In
- **Endpoint:** `POST /api/auth/sign-in/email-otp`
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otp": "123456",
    "name": "Optional Display Name"
  }
  ```
  *(Note: `role` is `input: false` on the server and cannot be supplied by clients.)*
- **Success (`200 OK`):** Sets `HttpOnly` session cookie and returns:
  ```json
  {
    "token": "<session-token>",
    "user": { "id": "...", "email": "user@example.com", "emailVerified": true, "role": "USER", "..." : "..." }
  }
  ```
- **Security Controls Enforced Server-Side:**
  - Strict 6-digit numeric OTP format check (`/^\d{6}$/`) before consuming attempts.
  - `300s` (5-minute) OTP expiration.
  - Maximum `3` verification attempts per issued OTP.
  - Single-use consumption (replay fails).
  - Previous OTP invalidated on resend (`resendStrategy: "rotate"`).
  - `20` verification requests per hour per client IP.

### Get Session
- **Endpoint:** `GET /api/auth/get-session`
- **Success (`200 OK`):** `{ "session": { ... }, "user": { ... } }` or `null`.

### Sign Out
- **Endpoint:** `POST /api/auth/sign-out`
- **Success (`200 OK`):** `{ "success": true }` and clears session cookie.

---

## 4. Error Codes

| HTTP Status | Better Auth / Hook Code | Cause | Recommended UI Message |
| :--- | :--- | :--- | :--- |
| `400` | `INVALID_EMAIL` / hook validation | Malformed email or non-6-digit OTP | `"Please enter a valid email address."` / `"Invalid or expired verification code."` |
| `400` | `INVALID_OTP` | Wrong or already-consumed OTP | `"Invalid or expired verification code."` |
| `400` | `OTP_EXPIRED` | OTP older than 5 minutes | `"Invalid or expired verification code."` |
| `403` | `TOO_MANY_ATTEMPTS` | Exceeded 3 failed attempts for current OTP | `"Too many failed attempts. Please request a new code."` |
| `429` | Rate limit exceeded | Hit 60s cooldown, 5/hr email cap, or IP cap (`Retry-After` header) | `"Too many requests. Please wait before trying again."` |
| `404` | Disabled path | Request to disabled password/reset/email-change route | Generic not found |

*(Wrapper helpers in `src/lib/auth-client.ts` intentionally return generic messages to prevent account enumeration.)*

---

## 5. Session Structure

Database model `Session` (`sessions` table):
- `id`: `string` (`cuid`)
- `userId`: `string` (FK -> `users.id`, `onDelete: Cascade`)
- `token`: `string` (unique)
- `expiresAt`: `DateTime` (7 days from creation, extended when older than 24 h)
- `ipAddress`: `string | null`
- `userAgent`: `string | null`
- `createdAt`: `DateTime`
- `updatedAt`: `DateTime`

Cookie attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `NODE_ENV === "production"`.

---

## 6. Server-Side Authorization Helpers (`src/lib/authorization.ts`)

Server-only (`import "server-only"`). Safe for Server Components, Server Actions, and Route Handlers:

- `getCurrentUser(): Promise<AuthUser | null>` — Reads session via `auth.api.getSession({ headers: await headers() })`; returns `null` if unauthenticated or invalid.
- `requireUser(): Promise<AuthUser>` — Returns authenticated user or throws `AuthorizationError` (`status: 401`).
- `requireAdmin(): Promise<AuthUser>` — Returns authenticated user with `role === "ADMIN"`, or throws `AuthorizationError` (`401` if unauthenticated, `403` if `role !== "ADMIN"`).
- `isAuthorizationError(error: unknown): error is AuthorizationError` — Type guard for catching `401`/`403` errors in API routes.

Example in a Route Handler:
```ts
import { requireAdmin, isAuthorizationError } from "@/lib/authorization";

export async function POST() {
  try {
    const admin = await requireAdmin();
    return Response.json({ ok: true, adminId: admin.id });
  } catch (err) {
    if (isAuthorizationError(err)) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

## 7. Frontend Integration Instructions (Phase B)

1. **Sign-in / Register page (e.g., `/login`):**
   - Step 1: Email input -> call `sendOtp(email)`. Show a 60-second countdown timer on success (matches backend cooldown).
   - Step 2: 6-digit OTP input -> call `verifyOtp(email, otp)` (or `authClient.signIn.emailOtp({ email, otp, name })` if collecting optional display name on sign-up).
   - Redirect on `result.success === true`.
2. **Session-aware navigation & protected routes:**
   - Server Components / layouts: use `getCurrentUser()` or `requireUser()` from `@/lib/authorization`.
   - Client components: use `getSession()` / `signOut()` or `authClient.useSession()` from `@/lib/auth-client`.
3. **Profile completion:**
   - `hostelBlock` and `location` are optional on `User`; prompt optionally after sign-in rather than blocking registration.

---

## 8. Security Hardening & Known Limitations

1. **Keyed OTP Storage (`OTP_HASH_SECRET`):** OTPs are hashed with HMAC-SHA256 keyed by `OTP_HASH_SECRET` via Better Auth's custom `storeOTP: { hash: hashOtp }`. In production, `OTP_HASH_SECRET` must be at least 32 characters (see `.env.example`).
2. **Unused OTP Endpoints Disabled:** `/email-otp/check-verification-otp` and `/email-otp/verify-email` are disabled in `disabledPaths` (`404`), and `/email-otp/send-verification-otp` accepts only `type: "sign-in"`, preventing restore-mode or existence-oracle bypasses.
3. **No Shared Caching of Auth Data:** `session.cookieCache` is disabled, `/api/auth/*` and `/api/profile` return `Cache-Control: no-store`, and protected Server Components (`/dashboard`, `/profile`, `/admin`) read `headers()` inside `<Suspense>` without `use cache`.
4. **SMTP Delivery Error Handling:** Better Auth's `runInBackgroundOrAwait` catches and logs errors thrown by `sendVerificationOTP` rather than failing the HTTP response. `sendOtpEmail` throws a sanitized `"Failed to send verification email."` message (never exposing SMTP credentials or OTPs), meaning a transient SMTP outage returns `200 { success: true }` to the client while logging the sanitized failure server-side.
5. **Client IP Spoofing:** Rate limiting relies on `x-real-ip` / `x-forwarded-for` headers. Deploy behind a trusted reverse proxy (e.g., Vercel) that overwrites/strips client-supplied forwarding headers.
6. **Credential Rotation & Live Testing:** Rotate previously exposed Neon/SMTP credentials and configure `OTP_HASH_SECRET` in `.env` before live authentication testing.

---

## 9. Migration Risks for Existing Users

The applied migration `20261127110932_add_authentication` has two destructive/strict behaviors if ever run against a database that already contains Day 1 rows:

1. **`emailVerified` Reset to `false`:** The migration executes `DROP COLUMN "emailVerified"` followed by `ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false`. On a database with pre-existing verified users, their verification status would be lost (reset to `false`). Any future production migration of Day 1 data should instead use `ALTER COLUMN "emailVerified" TYPE BOOLEAN USING ("emailVerified" IS NOT NULL)`.
2. **`UserRole` Enum Conversion (`STUDENT` -> `USER`):** The migration casts `"role"::text::"UserRole_new"` where `'STUDENT'` is no longer in `UserRole_new`. If any existing rows have `role = 'STUDENT'`, that migration fails unless `'STUDENT'` rows are mapped to `'USER'` first via `CASE WHEN "role"::text = 'STUDENT' THEN 'USER' ELSE "role"::text END`.
