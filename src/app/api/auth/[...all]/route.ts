import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

function withNoStoreHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  headers.set("Pragma", "no-cache");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Better Auth catch-all route handler with explicit no-store caching headers
 * on every auth/session response so user session payloads are never shared
 * across CDN/proxy/browser caches.
 */
export async function GET(request: Request): Promise<Response> {
  return withNoStoreHeaders(await handler.GET(request));
}

export async function POST(request: Request): Promise<Response> {
  return withNoStoreHeaders(await handler.POST(request));
}
