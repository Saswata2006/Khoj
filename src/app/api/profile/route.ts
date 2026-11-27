import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isAuthorizationError, requireUser } from "@/lib/authorization";
import { getSafeUserProfile, updateOwnProfile } from "@/lib/profile";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

/**
 * GET /api/profile
 * Returns the authenticated user's safe profile fields.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const profile = await getSafeUserProfile(user.id);

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json({ profile }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      { error: "Unable to load profile." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

/**
 * PATCH /api/profile
 * Validates and updates only allowlisted profile fields for the
 * currently authenticated user. Rejects unknown/privileged fields.
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const profile = await updateOwnProfile(user.id, body);
    return NextResponse.json({ profile }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: NO_STORE_HEADERS }
      );
    }
    if (error instanceof ZodError) {
      const firstMessage =
        error.issues[0]?.message ?? "Invalid profile fields provided.";
      return NextResponse.json(
        { error: firstMessage },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      { error: "Unable to update profile." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
