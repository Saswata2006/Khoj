import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import {
  createMarketplaceListing,
  getPublicMarketplaceListings,
} from "@/lib/services/listings";
import {
  NO_STORE_HEADERS,
  handleListingsRouteError,
  parseJsonBody,
  searchParamsToRecord,
} from "@/lib/api/listings-http";

/**
 * GET /api/listings
 * Returns paginated active public marketplace listings (`type: "SALE"`).
 */
export async function GET(request: Request) {
  try {
    const query = searchParamsToRecord(request.url);
    const result = await getPublicMarketplaceListings(query);
    return NextResponse.json(result, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    return handleListingsRouteError(
      error,
      "Unable to load marketplace listings."
    );
  }
}

/**
 * POST /api/listings
 * Creates a new marketplace listing owned by the authenticated user.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const listing = await createMarketplaceListing(user.id, parsedBody.data);
    return NextResponse.json(
      { listing },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleListingsRouteError(
      error,
      "Unable to create marketplace listing."
    );
  }
}
