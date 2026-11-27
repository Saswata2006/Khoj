import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAuthorizationError } from "@/lib/authorization";
import { isListingServiceError } from "@/lib/services/listings";
import { ImageValidationError } from "@/lib/validators/image";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

export const MAX_LISTING_JSON_BYTES = 64 * 1024; // 64 KiB cap for JSON listing payloads

/**
 * Extracts URL query parameters into a plain object, omitting empty values
 * so optional Zod filters fall back to `undefined` cleanly.
 */
export function searchParamsToRecord(
  requestUrl: string
): Record<string, string> {
  const url = new URL(requestUrl);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    if (value !== "") {
      query[key] = value;
    }
  });
  return query;
}

/**
 * Reads a `Request` stream up to `maxBytes`, aborting immediately if
 * `Content-Length` or incoming streamed chunks exceed the limit (HTTP 413).
 * Falls back cleanly (`bytes: null`) when `request.body` is null/unstreamed.
 */
export async function readBoundedRequestBytes(
  request: Request,
  maxBytes: number,
  tooLargeMessage: string
): Promise<
  | { ok: true; bytes: Uint8Array | null }
  | { ok: false; response: NextResponse }
> {
  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength !== null && rawContentLength.trim() !== "") {
    const contentLength = Number(rawContentLength.trim());
    if (!Number.isInteger(contentLength) || contentLength < 0) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid Content-Length header." },
          { status: 400, headers: NO_STORE_HEADERS }
        ),
      };
    }

    if (contentLength > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: tooLargeMessage },
          { status: 413, headers: NO_STORE_HEADERS }
        ),
      };
    }
  }

  if (!request.body) {
    return { ok: true, bytes: null };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return {
          ok: false,
          response: NextResponse.json(
            { error: tooLargeMessage },
            { status: 413, headers: NO_STORE_HEADERS }
          ),
        };
      }

      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to read request body." },
        { status: 400, headers: NO_STORE_HEADERS }
      ),
    };
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes: combined };
}

/**
 * Safely parses bounded JSON from an incoming request body.
 */
export async function parseJsonBody(
  request: Request
): Promise<
  { ok: true; data: unknown } | { ok: false; response: NextResponse }
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
    if (bounded.bytes === null) {
      const data: unknown = await request.json();
      return { ok: true, data };
    }

    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      bounded.bytes
    );
    const data: unknown = JSON.parse(decoded);
    return { ok: true, data };
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
 * Maps known authorization, service, and Zod errors to sanitized HTTP responses.
 * Never exposes database error messages, internal IDs, or stack traces.
 */
export function handleListingsRouteError(
  error: unknown,
  fallbackMessage: string,
  headers: HeadersInit = NO_STORE_HEADERS
): NextResponse {
  if (isAuthorizationError(error)) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers }
    );
  }

  if (isListingServiceError(error)) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers }
    );
  }

  if (error instanceof ImageValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400, headers }
    );
  }

  if (error instanceof ZodError) {
    const message =
      error.issues[0]?.message ?? "Invalid listing request parameters.";
    return NextResponse.json({ error: message }, { status: 400, headers });
  }

  return NextResponse.json(
    { error: fallbackMessage },
    { status: 500, headers }
  );
}
