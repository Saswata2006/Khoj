import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { getOutgoingContactRequests } from "@/lib/services/contact-requests";
import {
  contactRequestSearchParamsToRecord,
  handleContactRequestRouteError,
  NO_STORE_HEADERS,
} from "@/lib/api/contact-requests-http";

/**
 * GET /api/contact-requests/outgoing
 * Returns paginated contact requests sent by the authenticated buyer
 * across marketplace listings (`type: "SALE"`). Never cached.
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = contactRequestSearchParamsToRecord(request.url);
    const result = await getOutgoingContactRequests(user.id, query);
    return NextResponse.json(result, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    return handleContactRequestRouteError(
      error,
      "Unable to load outgoing contact requests."
    );
  }
}
