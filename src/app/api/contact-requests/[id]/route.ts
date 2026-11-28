import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { parseJsonBody } from "@/lib/api/listings-http";
import {
  decideContactRequest,
  getContactRequestById,
} from "@/lib/services/contact-requests";
import {
  handleContactRequestRouteError,
  NO_STORE_HEADERS,
} from "@/lib/api/contact-requests-http";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/contact-requests/[id]
 * Returns an individual marketplace contact request only for its buyer or seller.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const contactRequest = await getContactRequestById(id, user.id);
    return NextResponse.json(
      { contactRequest },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleContactRequestRouteError(
      error,
      "Unable to load contact request."
    );
  }
}

/**
 * PATCH /api/contact-requests/[id]
 * Transitions a `PENDING` contact request to `ACCEPTED` or `REJECTED` strictly
 * by the authenticated seller of the associated active listing.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const contactRequest = await decideContactRequest(
      id,
      user.id,
      parsedBody.data
    );

    return NextResponse.json(
      { contactRequest },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleContactRequestRouteError(
      error,
      "Unable to update contact request."
    );
  }
}
