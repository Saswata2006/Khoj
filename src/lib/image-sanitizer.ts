import "server-only";
import sharp from "sharp";
import {
  ImageValidationError,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  MIN_IMAGE_DIMENSION,
  validateImageBuffer,
  type ValidatedImageMetadata,
} from "@/lib/validators/image";

export interface SanitizedImageResult {
  buffer: Buffer;
  metadata: ValidatedImageMetadata;
}

/**
 * Validates raw upload bytes using signature/header rules AND performs full
 * pixel decoding + re-encoding via `sharp` to reject corrupt/truncated images,
 * guard against decompression bombs, block multi-frame images, and strip
 * EXIF/XMP/IPTC/GPS metadata before storing to Cloudinary.
 */
export async function validateAndSanitizeUploadedImage(
  bytes: Uint8Array,
  declaredMimeType?: string
): Promise<SanitizedImageResult> {
  // 1. Synchronous signature, dimension, and pixel-budget pre-check
  const headerMeta = validateImageBuffer(bytes, declaredMimeType);

  const inputBuffer = Buffer.from(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );

  try {
    // 2. Full decode with strict pixel limit & fail-on-error
    const decoder = sharp(inputBuffer, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: "error",
      animated: false,
    });

    const meta = await decoder.metadata();
    if (
      !meta.format ||
      meta.format !== headerMeta.format ||
      !meta.width ||
      !meta.height
    ) {
      throw new ImageValidationError(
        "Uploaded file could not be decoded as a valid image."
      );
    }

    if (meta.pages && meta.pages > 1) {
      throw new ImageValidationError(
        "Animated or multi-frame images are not supported."
      );
    }

    if (
      meta.width < MIN_IMAGE_DIMENSION ||
      meta.height < MIN_IMAGE_DIMENSION ||
      meta.width > MAX_IMAGE_DIMENSION ||
      meta.height > MAX_IMAGE_DIMENSION ||
      meta.width * meta.height > MAX_IMAGE_PIXELS
    ) {
      throw new ImageValidationError(
        "Decoded image dimensions are outside allowed safety limits."
      );
    }

    // 3. Re-encode normalized bitmap without `.withMetadata()`, auto-orienting first
    //    to strip EXIF/GPS/comments/polyglot trailing payloads locally.
    const pipeline = sharp(inputBuffer, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: "error",
      animated: false,
    }).rotate();

    let sanitizedBuffer: Buffer;
    if (headerMeta.format === "png") {
      sanitizedBuffer = await pipeline.png().toBuffer();
    } else if (headerMeta.format === "webp") {
      sanitizedBuffer = await pipeline.webp({ quality: 90 }).toBuffer();
    } else {
      sanitizedBuffer = await pipeline.jpeg({ quality: 90 }).toBuffer();
    }

    if (
      sanitizedBuffer.byteLength === 0 ||
      sanitizedBuffer.byteLength > MAX_IMAGE_BYTES
    ) {
      throw new ImageValidationError(
        "Processed image exceeds the 3 MiB size limit."
      );
    }

    return {
      buffer: sanitizedBuffer,
      metadata: {
        format: headerMeta.format,
        mimeType: headerMeta.mimeType,
        width: meta.width,
        height: meta.height,
        byteLength: sanitizedBuffer.byteLength,
      },
    };
  } catch (error) {
    if (error instanceof ImageValidationError) {
      throw error;
    }
    throw new ImageValidationError(
      "Corrupt or unreadable image file. Please choose another JPEG, PNG, or WebP photo."
    );
  }
}
