import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { createContactRequest } from "@/lib/services/contact-requests";
import {
  extractContactRequestClientIp,
  handleContactRequestRouteError,
  NO_STORE_HEADERS,
  parseOptionalJsonObjectBody,
} from "@/lib/api/contact-requests-http";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/listings/[id]/contact-requests
 * Initiates a consent-based PENDING buyer contact request for an ACTIVE SALE
 * listing. Never reveals seller contact details or accepts client-spoofed IDs.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const parsedBody = await parseOptionalJsonObjectBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const clientIp = extractContactRequestClientIp(request);
    const contactRequest = await createContactRequest(
      id,
      user.id,
      parsedBody.data,
      clientIp
    );

    return NextResponse.json(
      { contactRequest },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleContactRequestRouteError(
      error,
      "Unable to send contact request."
    );
  }
}
