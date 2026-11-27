import "server-only";
import { randomUUID } from "crypto";
import { v2 as cloudinary } from "cloudinary";

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------

export type CloudinaryEnvironment = "development" | "preview" | "production";

export interface CloudinaryPublicDeliveryPolicy {
  cloudName?: string;
  environment: CloudinaryEnvironment;
}

export interface UploadedCloudinaryAsset {
  secureUrl: string;
  publicId: string;
}

let isConfigured = false;

// ---------------------------------------------------------------------------
// Lazy Configuration & Environment Isolation
// ---------------------------------------------------------------------------

/**
 * Resolves the active deployment asset environment strictly separating
 * development, Vercel preview, and production namespaces.
 */
export function getCloudinaryEnvironment(): CloudinaryEnvironment {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "preview") {
    return "preview";
  }
  if (
    process.env.NODE_ENV === "production" &&
    (!vercelEnv || vercelEnv === "production")
  ) {
    return "production";
  }
  return "development";
}

/**
 * Returns the root Cloudinary folder namespace for the active environment.
 */
export function getCloudinaryNamespace(): string {
  return `khoj/${getCloudinaryEnvironment()}`;
}

/**
 * Returns ONLY public, non-secret delivery host policy (`cloudName` and
 * `environment`) for image URL allowlisting. Never exposes API keys/secrets.
 */
export function getCloudinaryPublicDeliveryPolicy(): CloudinaryPublicDeliveryPolicy {
  const rawCloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const validCloudName =
    rawCloudName && /^[a-z0-9_-]+$/i.test(rawCloudName)
      ? rawCloudName
      : undefined;

  return {
    cloudName: validCloudName,
    environment: getCloudinaryEnvironment(),
  };
}

function ensureCloudinaryConfigured(): typeof cloudinary {
  if (isConfigured) {
    return cloudinary;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Image upload service is not configured.");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  isConfigured = true;
  return cloudinary;
}

/**
 * Resets cached Cloudinary configuration state (for unit tests only).
 */
export function _resetCloudinaryForTest(): void {
  isConfigured = false;
}

// ---------------------------------------------------------------------------
// Upload & Delete Operations (signed server-side only)
// ---------------------------------------------------------------------------

/**
 * Uploads a validated & sanitized image buffer to Cloudinary using signed upload_stream.
 * - Uses a server-generated unique public_id under `khoj/<env>/listings/<id>`.
 * - Strips profile/EXIF metadata (`strip_profile`) and caps dimensions.
 * - Never exposes API secrets or accepts client-controlled public IDs/URLs.
 */
export async function uploadMarketplaceImage(
  buffer: Buffer,
  listingId: string
): Promise<UploadedCloudinaryAsset> {
  const client = ensureCloudinaryConfigured();
  const namespace = getCloudinaryNamespace();
  const folder = `${namespace}/listings/${listingId}`;
  const publicId = `img_${randomUUID()}`;

  return new Promise<UploadedCloudinaryAsset>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        resource_type: "image",
        folder,
        public_id: publicId,
        overwrite: false,
        unique_filename: false,
        image_metadata: false,
        transformation: [
          { width: 1600, height: 1600, crop: "limit" },
          { quality: "auto:good", fetch_format: "auto", flags: "strip_profile" },
        ],
      },
      (error, result) => {
        if (error || !result?.secure_url || !result?.public_id) {
          reject(new Error("Failed to store uploaded image."));
          return;
        }
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    stream.on("error", () => {
      reject(new Error("Failed to stream uploaded image."));
    });

    stream.end(buffer);
  });
}

/**
 * Deletes a Cloudinary image asset by server-stored `public_id`.
 * Enforces environment namespace isolation so one environment can never
 * delete assets belonging to another environment (`development`/`preview`/`production`).
 */
export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  const trimmed = publicId.trim();
  if (!trimmed) return;

  const expectedPrefix = `${getCloudinaryNamespace()}/`;
  if (!trimmed.startsWith(expectedPrefix)) {
    throw new Error(
      "Refused to delete remote image asset outside the active environment namespace."
    );
  }

  const client = ensureCloudinaryConfigured();
  const res = (await client.uploader.destroy(trimmed, {
    resource_type: "image",
    invalidate: true,
  })) as { result?: string } | undefined;

  if (res?.result && res.result !== "ok" && res.result !== "not found") {
    throw new Error("Failed to delete remote image asset.");
  }
}
