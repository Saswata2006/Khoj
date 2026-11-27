import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import { getUserMarketplaceListings } from "@/lib/services/listings";
import {
  NO_STORE_HEADERS,
  handleListingsRouteError,
  searchParamsToRecord,
} from "@/lib/api/listings-http";

/**
 * GET /api/listings/me
 * Returns paginated marketplace listings (`type: "SALE"`) belonging to the
 * currently authenticated user. Never cached across users.
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = searchParamsToRecord(request.url);
    const result = await getUserMarketplaceListings(user.id, query);
    return NextResponse.json(result, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    return handleListingsRouteError(
      error,
      "Unable to load your marketplace listings."
    );
  }
}
