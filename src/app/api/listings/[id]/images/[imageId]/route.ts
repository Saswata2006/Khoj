import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import {
  NO_STORE_HEADERS,
  handleListingsRouteError,
} from "@/lib/api/listings-http";
import { deleteImageFromOwnedListing } from "@/lib/services/listing-images";

interface ListingImageItemRouteContext {
  params: Promise<{ id: string; imageId: string }>;
}

/**
 * DELETE /api/listings/[id]/images/[imageId]
 * Removes an image from an owned ACTIVE marketplace listing and deletes
 * the remote Cloudinary asset. Prevents cross-listing image deletion.
 */
export async function DELETE(
  _request: Request,
  context: ListingImageItemRouteContext
) {
  try {
    const user = await requireUser();
    const { id, imageId } = await context.params;

    const deleted = await deleteImageFromOwnedListing(id, imageId, user.id);
    return NextResponse.json(
      {
        deleted: true,
        imageId: deleted.id,
        ...(deleted.remoteCleanupPending
          ? {
              remoteCleanupPending: true,
              notice:
                "Photo removed from your listing. Remote asset cleanup could not be confirmed immediately and is flagged for reconciliation.",
            }
          : {}),
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleListingsRouteError(
      error,
      "Unable to delete listing image."
    );
  }
}
