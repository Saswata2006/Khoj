import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authorization";
import {
  NO_STORE_HEADERS,
  handleListingsRouteError,
  readBoundedRequestBytes,
} from "@/lib/api/listings-http";
import { uploadImageToOwnedListing } from "@/lib/services/listing-images";
import { MAX_IMAGE_BYTES } from "@/lib/validators/image";

interface ListingImagesRouteContext {
  params: Promise<{ id: string }>;
}

export const MAX_MULTIPART_IMAGE_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

/**
 * POST /api/listings/[id]/images
 * Uploads and attaches one validated image (JPEG, PNG, or WebP, <= 3 MiB)
 * to an owned ACTIVE marketplace listing. Max 5 images per listing.
 *
 * Enforces bounded streaming body reading before parsing multipart FormData so
 * oversized chunked requests fail cleanly with HTTP 413 without buffering
 * unbounded payloads in memory.
 */
export async function POST(
  request: Request,
  context: ListingImagesRouteContext
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const bounded = await readBoundedRequestBytes(
      request,
      MAX_MULTIPART_IMAGE_BODY_BYTES,
      "Image upload request exceeds the 3 MiB limit."
    );
    if (!bounded.ok) {
      return bounded.response;
    }

    let formData: FormData;
    try {
      if (bounded.bytes === null) {
        formData = await request.formData();
      } else {
        const contentType = request.headers.get("content-type");
        if (
          !contentType ||
          !contentType.toLowerCase().includes("multipart/form-data")
        ) {
          return NextResponse.json(
            { error: "Expected multipart/form-data upload request." },
            { status: 400, headers: NO_STORE_HEADERS }
          );
        }

        const copy = new Uint8Array(bounded.bytes);
        formData = await new Response(copy.buffer, {
          headers: { "content-type": contentType },
        }).formData();
      }
    } catch {
      return NextResponse.json(
        { error: "Expected multipart/form-data upload request." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const entries = Array.from(formData.values());
    const fileEntries = entries.filter(
      (entry): entry is File => typeof File !== "undefined" && entry instanceof File
    );

    // Fallback check for mocked FormData environments where entries may expose arrayBuffer()
    const uploadCandidates =
      fileEntries.length > 0
        ? fileEntries
        : entries.filter(
            (entry): entry is File =>
              typeof entry === "object" &&
              entry !== null &&
              "arrayBuffer" in entry &&
              typeof (entry as { arrayBuffer?: unknown }).arrayBuffer ===
                "function"
          );

    if (uploadCandidates.length === 0) {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (uploadCandidates.length > 1 || entries.length > 1) {
      return NextResponse.json(
        { error: "Upload only one image per request." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const file = uploadCandidates[0];
    if (typeof file.size === "number" && file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds the 3 MiB size limit." },
        { status: 413, headers: NO_STORE_HEADERS }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds the 3 MiB size limit." },
        { status: 413, headers: NO_STORE_HEADERS }
      );
    }

    const image = await uploadImageToOwnedListing(
      id,
      user.id,
      bytes,
      file.type ?? ""
    );

    return NextResponse.json(
      { image },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return handleListingsRouteError(
      error,
      "Unable to upload listing image."
    );
  }
}
