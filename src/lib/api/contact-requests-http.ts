import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAuthorizationError } from "@/lib/authorization";
import {
  MAX_LISTING_JSON_BYTES,
  NO_STORE_HEADERS,
  readBoundedRequestBytes,
} from "@/lib/api/listings-http";
import { isContactRequestServiceError } from "@/lib/services/contact-requests";

export { NO_STORE_HEADERS };

/**
 * Parses URL query parameters into a plain record for contact-request list
 * routes, preserving unknown/duplicate keys so strict Zod schemas reject them
 * cleanly with HTTP 400 while ignoring empty optional filter keys.
 */
export function contactRequestSearchParamsToRecord(
  requestUrl: string
): Record<string, string | string[]> {
  const url = new URL(requestUrl);
  const optionalKeys = new Set(["status", "page", "limit"]);
  const query: Record<string, string | string[]> = {};

  for (const key of new Set(url.searchParams.keys())) {
    const rawValues = url.searchParams.getAll(key);
    const values = optionalKeys.has(key)
      ? rawValues.filter((value) => value !== "")
      : rawValues;

    if (values.length === 1) {
      query[key] = values[0];
    } else if (values.length > 1) {
      query[key] = values;
    }
  }

  return query;
}

/**
 * Safely reads and parses an optional bounded JSON object body.
 * An empty POST body resolves to `{}`; malformed JSON, arrays/primitives, or
 * payloads exceeding `MAX_LISTING_JSON_BYTES` fail cleanly with `400` or `413`.
 */
export async function parseOptionalJsonObjectBody(
  request: Request
): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; response: NextResponse }
> {
  const bounded = await readBoundedRequestBytes(
    request,
    MAX_LISTING_JSON_BYTES,
    "JSON request body exceeds maximum allowed size."
  );
  if (!bounded.ok) {
    return bounded;
  }

  try {
    const rawText =
      bounded.bytes !== null
        ? new TextDecoder("utf-8", { fatal: true }).decode(bounded.bytes)
        : await request.text();

    if (rawText.trim() === "") {
      return { ok: true, data: {} };
    }

    const parsed: unknown = JSON.parse(rawText);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Request body must be a JSON object." },
          { status: 400, headers: NO_STORE_HEADERS }
        ),
      };
    }

    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400, headers: NO_STORE_HEADERS }
      ),
    };
  }
}

/**
 * Extracts normalized client IP from standard proxy headers for rate limiting.
 */
export function extractContactRequestClientIp(request: Request): string | null {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 64);
  }
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp.slice(0, 64);
    }
  }
  return null;
}

/**
 * Maps authorization, service, rate-limit, and Zod errors to sanitized
 * `Cache-Control: no-store` HTTP error responses without leaking internals.
 */
export function handleContactRequestRouteError(
  error: unknown,
  fallbackMessage: string
): NextResponse {
  if (isAuthorizationError(error)) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: NO_STORE_HEADERS }
    );
  }

  if (isContactRequestServiceError(error)) {
    const headers: Record<string, string> = {
      ...NO_STORE_HEADERS,
      ...(error.status === 429 && error.retryAfterSeconds !== undefined
        ? { "Retry-After": String(error.retryAfterSeconds) }
        : {}),
    };
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers }
    );
  }

  if (error instanceof ZodError) {
    const message =
      error.issues[0]?.message ?? "Invalid contact request parameters.";
    return NextResponse.json(
      { error: message },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    { error: fallbackMessage },
    { status: 500, headers: NO_STORE_HEADERS }
  );
}
