import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import {
  getPublicMarketplaceListingById,
  removeOwnedMarketplaceListing,
  updateOwnedMarketplaceListing,
} from "@/lib/services/listings";
import {
  NO_STORE_HEADERS,
  handleListingsRouteError,
  parseJsonBody,
} from "@/lib/api/listings-http";

interface ListingRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/listings/[id]
 * Returns public marketplace listing details (`type: "SALE"`, not `REMOVED`).
 */
export async function GET(_request: Request, context: ListingRouteContext) {
  try {
    const { id } = await context.params;
    const listing = await getPublicMarketplaceListingById(id);

    if (!listing) {
      return NextResponse.json(
        { error: "Marketplace listing not found." },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      { listing },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleListingsRouteError(
      error,
      "Unable to load marketplace listing."
    );
  }
}

/**
 * PATCH /api/listings/[id]
 * Updates an owned marketplace listing (`ACTIVE` or `SOLD` transitions allowed;
 * `REMOVED` listings return 409).
 */
export async function PATCH(request: Request, context: ListingRouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const listing = await updateOwnedMarketplaceListing(
      id,
      user.id,
      parsedBody.data
    );
    return NextResponse.json(
      { listing },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleListingsRouteError(
      error,
      "Unable to update marketplace listing."
    );
  }
}

/**
 * DELETE /api/listings/[id]
 * Archives (soft-deletes) an owned marketplace listing by setting `status: "REMOVED"`.
 */
export async function DELETE(_request: Request, context: ListingRouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const listing = await removeOwnedMarketplaceListing(id, user.id);
    return NextResponse.json(
      { listing },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleListingsRouteError(
      error,
      "Unable to remove marketplace listing."
    );
  }
}
