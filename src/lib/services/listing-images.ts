import "server-only";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  deleteCloudinaryAsset,
  getCloudinaryEnvironment,
  uploadMarketplaceImage,
} from "@/lib/cloudinary";
import { validateAndSanitizeUploadedImage } from "@/lib/image-sanitizer";
import {
  ListingServiceError,
  type PublicListingImage,
} from "@/lib/services/listings";
import { MAX_IMAGES_PER_LISTING } from "@/lib/validators/image";
import { listingIdSchema } from "@/lib/validators/listing";

const MAX_SERIALIZATION_RETRIES = 3;

function isSerializationConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2034" || code === "40001";
}

async function runSerializableWithRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = MAX_SERIALIZATION_RETRIES
): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await prisma.$transaction(fn, { isolationLevel: "Serializable" });
    } catch (error) {
      if (isSerializationConflict(error) && attempt < maxAttempts) {
        continue;
      }
      if (isSerializationConflict(error)) {
        throw new ListingServiceError(
          "Concurrent image update conflict. Please retry.",
          409
        );
      }
      throw error;
    }
  }
}

async function tryDeleteRemoteAsset(
  publicId: string,
  context: { action: "compensate_upload" | "delete_image"; listingId: string; imageId?: string }
): Promise<boolean> {
  try {
    await deleteCloudinaryAsset(publicId);
    return true;
  } catch {
    // Emit sanitized diagnostic log without leaking Cloudinary credentials or raw error objects
    console.warn("[cloudinary:asset-cleanup-pending]", {
      action: context.action,
      listingId: context.listingId,
      imageId: context.imageId ?? null,
      environment: getCloudinaryEnvironment(),
    });
    return false;
  }
}

function assertListingEditable(
  listing: {
    id: string;
    userId: string;
    type: string;
    status: string;
  } | null,
  userId: string
): asserts listing is {
  id: string;
  userId: string;
  type: "SALE";
  status: "ACTIVE";
} {
  if (!listing || listing.type !== "SALE") {
    throw new ListingServiceError("Marketplace listing not found.", 404);
  }
  if (listing.userId !== userId) {
    throw new ListingServiceError(
      "You do not have permission to modify images for this listing.",
      403
    );
  }
  if (listing.status !== "ACTIVE") {
    throw new ListingServiceError(
      "Images can only be modified on active marketplace listings.",
      409
    );
  }
}

/**
 * Validates, decodes, strips metadata, and uploads one marketplace image to
 * Cloudinary, then persists the `ListingImage` record atomically inside a
 * Serializable transaction.
 */
export async function uploadImageToOwnedListing(
  rawListingId: string,
  userId: string,
  bytes: Uint8Array,
  declaredMimeType?: string
): Promise<PublicListingImage> {
  const listingId = listingIdSchema.parse(rawListingId);

  // 1. Validate signature/dimensions/pixels, fully decode, and strip metadata locally
  const sanitized = await validateAndSanitizeUploadedImage(
    bytes,
    declaredMimeType
  );

  // 2. Fast pre-flight read outside any transaction (avoid wasting Cloudinary uploads)
  const preflight = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      userId: true,
      type: true,
      status: true,
      _count: { select: { images: true } },
    },
  });

  assertListingEditable(preflight, userId);

  if (preflight._count.images >= MAX_IMAGES_PER_LISTING) {
    throw new ListingServiceError(
      `A listing can have at most ${MAX_IMAGES_PER_LISTING} images.`,
      409
    );
  }

  // 3. Upload metadata-stripped buffer to Cloudinary outside database transaction
  const uploaded = await uploadMarketplaceImage(sanitized.buffer, listingId);

  // 4. Recheck ownership/status/count and persist atomically; compensate on failure
  try {
    return await runSerializableWithRetry(async (tx) => {
      const current = await tx.listing.findUnique({
        where: { id: listingId },
        select: { id: true, userId: true, type: true, status: true },
      });

      assertListingEditable(current, userId);

      const imageCount = await tx.listingImage.count({
        where: { listingId },
      });
      if (imageCount >= MAX_IMAGES_PER_LISTING) {
        throw new ListingServiceError(
          `A listing can have at most ${MAX_IMAGES_PER_LISTING} images.`,
          409
        );
      }

      return tx.listingImage.create({
        data: {
          listingId,
          imageUrl: uploaded.secureUrl,
          publicId: uploaded.publicId,
        },
        select: {
          id: true,
          imageUrl: true,
          createdAt: true,
        },
      });
    });
  } catch (error) {
    await tryDeleteRemoteAsset(uploaded.publicId, {
      action: "compensate_upload",
      listingId,
    });
    throw error;
  }
}

export interface DeleteListingImageResult {
  id: string;
  remoteCleanupPending: boolean;
}

/**
 * Deletes an image belonging to an owned active marketplace listing.
 * Enforces both listing ownership and cross-listing image containment before
 * deleting the Cloudinary asset within the active environment namespace.
 */
export async function deleteImageFromOwnedListing(
  rawListingId: string,
  rawImageId: string,
  userId: string
): Promise<DeleteListingImageResult> {
  const listingId = listingIdSchema.parse(rawListingId);
  const imageId = listingIdSchema.parse(rawImageId);

  const deletedRecord = await runSerializableWithRetry(async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      select: { id: true, userId: true, type: true, status: true },
    });

    assertListingEditable(listing, userId);

    // Explicitly scope lookup to both imageId AND listingId to block IDOR/cross-listing deletes
    const image = await tx.listingImage.findFirst({
      where: { id: imageId, listingId },
      select: { id: true, publicId: true },
    });

    if (!image) {
      throw new ListingServiceError("Listing image not found.", 404);
    }

    const deleted = await tx.listingImage.deleteMany({
      where: { id: image.id, listingId },
    });

    if (deleted.count === 0) {
      throw new ListingServiceError("Listing image not found.", 404);
    }

    return image;
  });

  let remoteDeleted = true;
  if (deletedRecord.publicId) {
    remoteDeleted = await tryDeleteRemoteAsset(deletedRecord.publicId, {
      action: "delete_image",
      listingId,
      imageId: deletedRecord.id,
    });
  }

  return {
    id: deletedRecord.id,
    remoteCleanupPending: !remoteDeleted,
  };
}
