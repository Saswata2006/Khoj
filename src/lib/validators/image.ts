// ---------------------------------------------------------------------------
// Image Upload Validation Constants
// ---------------------------------------------------------------------------

export const MAX_IMAGES_PER_LISTING = 5;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MiB
export const MIN_IMAGE_DIMENSION = 50;
export const MAX_IMAGE_DIMENSION = 8000;
export const MAX_IMAGE_PIXELS = 25_000_000; // 25 megapixels max decoded bitmap budget

export type SupportedImageFormat = "jpeg" | "png" | "webp";

export interface ValidatedImageMetadata {
  format: SupportedImageFormat;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  byteLength: number;
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

const ALLOWED_DECLARED_MIME_TYPES = new Set([
  "",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// ---------------------------------------------------------------------------
// Binary Signature & Dimension Parsers (no trust in filename/MIME alone)
// ---------------------------------------------------------------------------

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[start + i] ?? 0);
  }
  return out;
}

function parsePng(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG 8-byte signature: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.byteLength < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ihdrLength = view.getUint32(8, false);
  if (ihdrLength !== 13 || readAscii(bytes, 12, 4) !== "IHDR") {
    throw new ImageValidationError("Malformed PNG image header.");
  }

  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

function parseJpeg(bytes: Uint8Array): { width: number; height: number } | null {
  // JPEG SOI marker: FF D8 FF
  if (
    bytes.byteLength < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff
  ) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 1 < bytes.byteLength) {
    while (offset < bytes.byteLength && bytes[offset] === 0xff) {
      offset++;
    }
    if (offset >= bytes.byteLength) break;

    const marker = bytes[offset++];

    // Standalone markers without length prefix
    if (
      marker === 0x00 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd8)
    ) {
      continue;
    }
    // EOI or SOS before finding SOF -> invalid/unparseable dimensions
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (offset + 2 > bytes.byteLength) {
      throw new ImageValidationError("Malformed JPEG image segment.");
    }
    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) {
      throw new ImageValidationError("Corrupted JPEG segment length.");
    }

    // SOF0..SOF15 (excluding DHT=0xC4, JPG=0xC8, DAC=0xCC)
    const isSofMarker =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isSofMarker) {
      if (segmentLength < 7 || offset + 7 > bytes.byteLength) {
        throw new ImageValidationError("Malformed JPEG frame header.");
      }
      const height = view.getUint16(offset + 3, false);
      const width = view.getUint16(offset + 5, false);
      return { width, height };
    }

    offset += segmentLength;
  }

  throw new ImageValidationError("Missing dimensions in JPEG image.");
}

function parseWebp(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.byteLength < 12) return null;
  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WEBP") {
    return null;
  }
  if (bytes.byteLength < 30) {
    throw new ImageValidationError("Malformed WebP image file.");
  }

  const chunk = readAscii(bytes, 12, 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffSize = view.getUint32(4, true);
  if (riffSize < 12 || riffSize + 8 > bytes.byteLength) {
    throw new ImageValidationError("Corrupted WebP container length.");
  }

  if (chunk === "VP8 ") {
    // Lossy VP8: frame start code 9D 01 2A at offset 23..25
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      throw new ImageValidationError("Malformed WebP VP8 bitstream.");
    }
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    return { width, height };
  }

  if (chunk === "VP8L") {
    // Lossless VP8L: signature byte 0x2F at offset 20, packed 14-bit dims at 21..24
    if (bytes[20] !== 0x2f) {
      throw new ImageValidationError("Malformed WebP VP8L header.");
    }
    const bits = view.getUint32(21, true);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }

  if (chunk === "VP8X") {
    // Extended VP8X: 24-bit width-1 at 24..26, height-1 at 27..29
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }

  throw new ImageValidationError("Unsupported WebP chunk layout.");
}

function assertValidDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_IMAGE_DIMENSION ||
    height < MIN_IMAGE_DIMENSION
  ) {
    throw new ImageValidationError(
      `Image dimensions must be at least ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION} pixels.`
    );
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new ImageValidationError(
      `Image dimensions cannot exceed ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixels.`
    );
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new ImageValidationError(
      `Image pixel count cannot exceed ${MAX_IMAGE_PIXELS.toLocaleString("en-US")} pixels.`
    );
  }
}

// ---------------------------------------------------------------------------
// Public Validator Entry Point
// ---------------------------------------------------------------------------

/**
 * Validates raw binary image bytes against size limits (<= 3 MiB),
 * real JPEG/PNG/WebP magic signatures, and reasonable pixel dimensions.
 */
export function validateImageBuffer(
  bytes: Uint8Array,
  declaredMimeType?: string
): ValidatedImageMetadata {
  if (
    declaredMimeType !== undefined &&
    !ALLOWED_DECLARED_MIME_TYPES.has(declaredMimeType.toLowerCase().trim())
  ) {
    throw new ImageValidationError(
      "Unsupported image format. Only JPEG, PNG, and WebP images are allowed."
    );
  }

  if (bytes.byteLength === 0) {
    throw new ImageValidationError("Uploaded image file is empty.");
  }

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageValidationError("Image exceeds the 3 MiB size limit.");
  }

  const pngDims = parsePng(bytes);
  if (pngDims) {
    assertValidDimensions(pngDims.width, pngDims.height);
    return {
      format: "png",
      mimeType: "image/png",
      width: pngDims.width,
      height: pngDims.height,
      byteLength: bytes.byteLength,
    };
  }

  const jpegDims = parseJpeg(bytes);
  if (jpegDims) {
    assertValidDimensions(jpegDims.width, jpegDims.height);
    return {
      format: "jpeg",
      mimeType: "image/jpeg",
      width: jpegDims.width,
      height: jpegDims.height,
      byteLength: bytes.byteLength,
    };
  }

  const webpDims = parseWebp(bytes);
  if (webpDims) {
    assertValidDimensions(webpDims.width, webpDims.height);
    return {
      format: "webp",
      mimeType: "image/webp",
      width: webpDims.width,
      height: webpDims.height,
      byteLength: bytes.byteLength,
    };
  }

  throw new ImageValidationError(
    "Unsupported or malformed image. Only valid JPEG, PNG, and WebP files are accepted."
  );
}
