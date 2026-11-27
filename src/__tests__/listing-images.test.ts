import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

// ---------------------------------------------------------------------------
// Mocks — no real Cloudinary uploads, no live database, no live auth
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

const mockTx = {
  listing: {
    findUnique: vi.fn(),
  },
  listingImage: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: {
    listing: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    ),
  },
  prisma: {
    listing: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    ),
  },
}));

vi.mock("@/lib/authorization", async () => {
  const { AuthorizationError, isAuthorizationError } = await vi.importActual<
    typeof import("@/lib/authorization")
  >("@/lib/authorization");
  return {
    getCurrentUser: vi.fn(),
    requireUser: vi.fn(),
    requireAdmin: vi.fn(),
    AuthorizationError,
    isAuthorizationError,
  };
});

vi.mock("@/lib/cloudinary", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cloudinary")>(
    "@/lib/cloudinary"
  );
  return {
    getCloudinaryEnvironment: actual.getCloudinaryEnvironment,
    getCloudinaryNamespace: actual.getCloudinaryNamespace,
    getCloudinaryPublicDeliveryPolicy: actual.getCloudinaryPublicDeliveryPolicy,
    uploadMarketplaceImage: vi.fn(),
    deleteCloudinaryAsset: vi.fn(),
  };
});

import prisma from "@/lib/prisma";
import { AuthorizationError, requireUser } from "@/lib/authorization";
import {
  deleteCloudinaryAsset,
  getCloudinaryNamespace,
  getCloudinaryPublicDeliveryPolicy,
  uploadMarketplaceImage,
} from "@/lib/cloudinary";
import { validateAndSanitizeUploadedImage } from "@/lib/image-sanitizer";
import {
  ImageValidationError,
  MAX_IMAGE_BYTES,
  validateImageBuffer,
} from "@/lib/validators/image";
import {
  deleteImageFromOwnedListing,
  uploadImageToOwnedListing,
} from "@/lib/services/listing-images";
import { POST as uploadImagePost } from "@/app/api/listings/[id]/images/route";
import { DELETE as deleteImageDelete } from "@/app/api/listings/[id]/images/[imageId]/route";

// ---------------------------------------------------------------------------
// Binary Fixtures (header fixtures + real decodable PNG/JPEG/WebP buffers)
// ---------------------------------------------------------------------------

let REAL_PNG_BYTES: Uint8Array;
let REAL_JPEG_BYTES: Uint8Array;
let REAL_WEBP_BYTES: Uint8Array;

beforeAll(async () => {
  REAL_PNG_BYTES = new Uint8Array(
    await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: { r: 15, g: 23, b: 42 },
      },
    })
      .png()
      .toBuffer()
  );
  REAL_JPEG_BYTES = new Uint8Array(
    await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: { r: 5, g: 150, b: 105 },
      },
    })
      .jpeg({ quality: 80 })
      .toBuffer()
  );
  REAL_WEBP_BYTES = new Uint8Array(
    await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: { r: 248, g: 250, b: 252 },
      },
    })
      .webp({ quality: 80 })
      .toBuffer()
  );
});

function makeValidPngBytes(width = 200, height = 150): Uint8Array {
  const buf = new Uint8Array(32);
  // PNG signature
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  // IHDR chunk length & type
  buf.set([0x00, 0x00, 0x00, 0x0d], 8);
  buf.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(buf.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return buf;
}

function makeValidJpegBytes(width = 640, height = 480): Uint8Array {
  // SOI (FF D8) + SOF0 (FF C0, length 11, precision 8, height, width)
  const buf = new Uint8Array(20);
  buf.set([0xff, 0xd8, 0xff, 0xc0], 0);
  const view = new DataView(buf.buffer);
  view.setUint16(4, 11, false); // segment length
  buf[6] = 8; // precision
  view.setUint16(7, height, false);
  view.setUint16(9, width, false);
  buf[11] = 3; // components
  buf.set([0xff, 0xd9], 18);
  return buf;
}

function makeValidWebpBytes(width = 800, height = 600): Uint8Array {
  const buf = new Uint8Array(32);
  // RIFF .... WEBP VP8  (lossy)
  buf.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  buf.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  buf.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
  buf.set([0x9d, 0x01, 0x2a], 23); // start code
  const view = new DataView(buf.buffer);
  view.setUint32(4, 24, true); // RIFF chunk size = totalBytes - 8
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);
  return buf;
}

function makeUploadRequest(
  fileOrFiles: Array<{ name: string; bytes: Uint8Array; type: string }>
) {
  const form = new FormData();
  fileOrFiles.forEach((entry, idx) => {
    const copy = new Uint8Array(entry.bytes);
    const file = new File([copy.buffer], entry.name, { type: entry.type });
    form.append(idx === 0 ? "file" : `file_${idx}`, file);
  });
  return new Request("http://localhost:3000/api/listings/cm1abc1234567890/images", {
    method: "POST",
    body: form,
  });
}

// ---------------------------------------------------------------------------
// 1. Binary Image Validation & Namespace
// ---------------------------------------------------------------------------

describe("Binary image validation & Cloudinary namespace", () => {
  it("accepts valid PNG, JPEG, and WebP binary signatures with dimensions", () => {
    expect(validateImageBuffer(makeValidPngBytes(200, 150), "image/png")).toEqual({
      format: "png",
      mimeType: "image/png",
      width: 200,
      height: 150,
      byteLength: 32,
    });

    expect(validateImageBuffer(makeValidJpegBytes(640, 480), "image/jpeg")).toEqual({
      format: "jpeg",
      mimeType: "image/jpeg",
      width: 640,
      height: 480,
      byteLength: 20,
    });

    expect(validateImageBuffer(makeValidWebpBytes(800, 600), "image/webp")).toEqual({
      format: "webp",
      mimeType: "image/webp",
      width: 800,
      height: 600,
      byteLength: 32,
    });
  });

  it("rejects spoofed/invalid formats, empty buffers, oversized files, and extreme dimensions", () => {
    const gifHeader = new TextEncoder().encode("GIF89a..........");
    expect(() => validateImageBuffer(gifHeader, "image/jpeg")).toThrow(
      ImageValidationError
    );
    expect(() => validateImageBuffer(new Uint8Array(0))).toThrow(
      ImageValidationError
    );
    expect(() =>
      validateImageBuffer(new Uint8Array(MAX_IMAGE_BYTES + 1), "image/png")
    ).toThrow(ImageValidationError);
    expect(() =>
      validateImageBuffer(makeValidPngBytes(16, 16), "image/png")
    ).toThrow(ImageValidationError);
    expect(() =>
      validateImageBuffer(makeValidPngBytes(12000, 200), "image/png")
    ).toThrow(ImageValidationError);
  });

  it("uses khoj/development namespace outside production", () => {
    expect(getCloudinaryNamespace()).toBe("khoj/development");
  });
});

// ---------------------------------------------------------------------------
// 2. POST /api/listings/[id]/images
// ---------------------------------------------------------------------------

describe("POST /api/listings/[id]/images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated uploads with 401", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(
      new AuthorizationError("Authentication required.", 401)
    );

    const res = await uploadImagePost(
      makeUploadRequest([
        { name: "photo.png", bytes: REAL_PNG_BYTES, type: "image/png" },
      ]),
      { params: Promise.resolve({ id: "cm1abc1234567890" }) }
    );
    expect(res.status).toBe(401);
    expect(uploadMarketplaceImage).not.toHaveBeenCalled();
  });

  it("rejects uploading more than one image in a single request", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);

    const res = await uploadImagePost(
      makeUploadRequest([
        { name: "a.png", bytes: makeValidPngBytes(), type: "image/png" },
        { name: "b.png", bytes: makeValidPngBytes(), type: "image/png" },
      ]),
      { params: Promise.resolve({ id: "cm1abc1234567890" }) }
    );
    expect(res.status).toBe(400);
    expect(uploadMarketplaceImage).not.toHaveBeenCalled();
  });

  it("rejects non-owners with 403 and does not upload to Cloudinary", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_attacker",
      email: "attacker@example.com",
      role: "USER",
    } as never);
    vi.mocked(prisma.listing.findUnique).mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
      _count: { images: 0 },
    } as never);

    const res = await uploadImagePost(
      makeUploadRequest([
        { name: "photo.png", bytes: REAL_PNG_BYTES, type: "image/png" },
      ]),
      { params: Promise.resolve({ id: "cm1abc1234567890" }) }
    );
    expect(res.status).toBe(403);
    expect(uploadMarketplaceImage).not.toHaveBeenCalled();
  });

  it("rejects non-editable SOLD listings with 409", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    vi.mocked(prisma.listing.findUnique).mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "SOLD",
      _count: { images: 1 },
    } as never);

    const res = await uploadImagePost(
      makeUploadRequest([
        { name: "photo.png", bytes: REAL_PNG_BYTES, type: "image/png" },
      ]),
      { params: Promise.resolve({ id: "cm1abc1234567890" }) }
    );
    expect(res.status).toBe(409);
    expect(uploadMarketplaceImage).not.toHaveBeenCalled();
  });

  it("enforces maximum 5 images per listing before upload (409)", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    vi.mocked(prisma.listing.findUnique).mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
      _count: { images: 5 },
    } as never);

    const res = await uploadImagePost(
      makeUploadRequest([
        { name: "photo.png", bytes: REAL_PNG_BYTES, type: "image/png" },
      ]),
      { params: Promise.resolve({ id: "cm1abc1234567890" }) }
    );
    expect(res.status).toBe(409);
    expect(uploadMarketplaceImage).not.toHaveBeenCalled();
  });

  it("uploads valid image, stores ListingImage, and returns 201 with no-store header", async () => {
    const now = new Date("2026-11-28T02:00:00.000Z");
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    vi.mocked(prisma.listing.findUnique).mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
      _count: { images: 2 },
    } as never);
    vi.mocked(uploadMarketplaceImage).mockResolvedValueOnce({
      secureUrl: "https://res.cloudinary.com/demo/image/upload/khoj/development/img_1.png",
      publicId: "khoj/development/listings/cm1abc1234567890/img_1",
    });
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });
    mockTx.listingImage.count.mockResolvedValueOnce(2);
    mockTx.listingImage.create.mockResolvedValueOnce({
      id: "cm1img1234567890",
      imageUrl: "https://res.cloudinary.com/demo/image/upload/khoj/development/img_1.png",
      createdAt: now,
    });

    const res = await uploadImagePost(
      makeUploadRequest([
        { name: "photo.png", bytes: REAL_PNG_BYTES, type: "image/png" },
      ]),
      { params: Promise.resolve({ id: "cm1abc1234567890" }) }
    );
    const json = (await res.json()) as {
      image: { id: string; imageUrl: string };
    };

    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(json.image.id).toBe("cm1img1234567890");
    expect(deleteCloudinaryAsset).not.toHaveBeenCalled();
  });

  it("handles concurrent uploads exceeding 5 images by compensatingly deleting orphan Cloudinary upload", async () => {
    let serializedCount = 4;
    let txLock: Promise<void> = Promise.resolve();

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const prev = txLock;
      let release!: () => void;
      txLock = new Promise<void>((resolve) => {
        release = resolve;
      });
      await prev;
      try {
        return await fn(mockTx as never);
      } finally {
        release();
      }
    });

    vi.mocked(prisma.listing.findUnique).mockResolvedValue({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
      _count: { images: 4 },
    } as never);

    vi.mocked(uploadMarketplaceImage)
      .mockResolvedValueOnce({
        secureUrl: "https://res.cloudinary.com/demo/img_a.png",
        publicId: "khoj/development/img_a",
      })
      .mockResolvedValueOnce({
        secureUrl: "https://res.cloudinary.com/demo/img_b.png",
        publicId: "khoj/development/img_b",
      });

    mockTx.listing.findUnique.mockResolvedValue({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });

    mockTx.listingImage.count.mockImplementation(async () => serializedCount);
    mockTx.listingImage.create.mockImplementation(async ({ data }) => {
      serializedCount++;
      return {
        id: `img_${serializedCount}`,
        imageUrl: data.imageUrl,
        createdAt: new Date(),
      };
    });

    const results = await Promise.allSettled([
      uploadImageToOwnedListing(
        "cm1abc1234567890",
        "usr_seller_1",
        REAL_PNG_BYTES,
        "image/png"
      ),
      uploadImageToOwnedListing(
        "cm1abc1234567890",
        "usr_seller_1",
        REAL_PNG_BYTES,
        "image/png"
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ status: 409 });
    expect(deleteCloudinaryAsset).toHaveBeenCalledTimes(1);
    expect(deleteCloudinaryAsset).toHaveBeenCalledWith("khoj/development/img_b");
  });

  it("retries bounded Serializable P2034 conflicts and compensates on DB persistence failure", async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn(mockTx as never)
    );
    vi.mocked(prisma.listing.findUnique).mockResolvedValue({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
      _count: { images: 1 },
    } as never);
    vi.mocked(uploadMarketplaceImage).mockResolvedValue({
      secureUrl: "https://res.cloudinary.com/demo/img_retry.png",
      publicId: "khoj/development/img_retry",
    });

    // Simulate one P2034 serialization conflict then DB write error -> triggers compensating delete
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce({ code: "P2034" })
      .mockRejectedValueOnce(new Error("DB connection dropped"));

    await expect(
      uploadImageToOwnedListing(
        "cm1abc1234567890",
        "usr_seller_1",
        REAL_PNG_BYTES,
        "image/png"
      )
    ).rejects.toThrow("DB connection dropped");

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(deleteCloudinaryAsset).toHaveBeenCalledWith(
      "khoj/development/img_retry"
    );
  });

  it("returns sanitized 500 when Cloudinary upload fails without inserting DB rows", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    vi.mocked(prisma.listing.findUnique).mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
      _count: { images: 0 },
    } as never);
    vi.mocked(uploadMarketplaceImage).mockRejectedValueOnce(
      new Error("secret_api_key invalid")
    );

    const res = await uploadImagePost(
      makeUploadRequest([
        { name: "photo.png", bytes: REAL_PNG_BYTES, type: "image/png" },
      ]),
      { params: Promise.resolve({ id: "cm1abc1234567890" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("secret_api_key");
    expect(mockTx.listingImage.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. DELETE /api/listings/[id]/images/[imageId]
// ---------------------------------------------------------------------------

describe("DELETE /api/listings/[id]/images/[imageId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated delete with 401", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(
      new AuthorizationError("Authentication required.", 401)
    );

    const res = await deleteImageDelete(
      new Request(
        "http://localhost:3000/api/listings/cm1abc1234567890/images/cm1img1234567890",
        { method: "DELETE" }
      ),
      {
        params: Promise.resolve({
          id: "cm1abc1234567890",
          imageId: "cm1img1234567890",
        }),
      }
    );
    expect(res.status).toBe(401);
  });

  it("prevents cross-listing image deletion (404 when image belongs to another listing)", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });
    // findFirst with { id: imageId, listingId } returns null because image belongs to listing B
    mockTx.listingImage.findFirst.mockResolvedValueOnce(null);

    const res = await deleteImageDelete(
      new Request(
        "http://localhost:3000/api/listings/cm1abc1234567890/images/cm1otherlistimg1",
        { method: "DELETE" }
      ),
      {
        params: Promise.resolve({
          id: "cm1abc1234567890",
          imageId: "cm1otherlistimg1",
        }),
      }
    );

    expect(res.status).toBe(404);
    expect(mockTx.listingImage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cm1otherlistimg1", listingId: "cm1abc1234567890" },
      })
    );
    expect(mockTx.listingImage.deleteMany).not.toHaveBeenCalled();
    expect(deleteCloudinaryAsset).not.toHaveBeenCalled();
  });

  it("deletes an owned image row and removes the Cloudinary asset", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });
    mockTx.listingImage.findFirst.mockResolvedValueOnce({
      id: "cm1img1234567890",
      publicId: "khoj/development/listings/cm1abc1234567890/img_1",
    });
    mockTx.listingImage.deleteMany.mockResolvedValueOnce({ count: 1 });

    const res = await deleteImageDelete(
      new Request(
        "http://localhost:3000/api/listings/cm1abc1234567890/images/cm1img1234567890",
        { method: "DELETE" }
      ),
      {
        params: Promise.resolve({
          id: "cm1abc1234567890",
          imageId: "cm1img1234567890",
        }),
      }
    );

    expect(res.status).toBe(200);
    expect(mockTx.listingImage.deleteMany).toHaveBeenCalledWith({
      where: { id: "cm1img1234567890", listingId: "cm1abc1234567890" },
    });
    expect(deleteCloudinaryAsset).toHaveBeenCalledWith(
      "khoj/development/listings/cm1abc1234567890/img_1"
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Phase C Backend Hardening Checks
// ---------------------------------------------------------------------------

describe("Phase C image upload hardening checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejects oversized Content-Length before calling request.formData() (413)", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);

    const formDataSpy = vi.fn();
    const request = {
      headers: new Headers({
        "content-length": String(MAX_IMAGE_BYTES + 128 * 1024),
      }),
      formData: formDataSpy,
    } as unknown as Request;

    const res = await uploadImagePost(request, {
      params: Promise.resolve({ id: "cm1abc1234567890" }),
    });

    expect(res.status).toBe(413);
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(uploadMarketplaceImage).not.toHaveBeenCalled();
  });

  it("isolates Vercel Preview environment uploads in khoj/preview namespace", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(getCloudinaryNamespace()).toBe("khoj/preview");

    vi.stubEnv("VERCEL_ENV", "production");
    expect(getCloudinaryNamespace()).toBe("khoj/production");

    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// 5. Phase F Security Hardening Regression Suite
// ---------------------------------------------------------------------------

describe("Phase F image security, streaming bounds & asset lifecycle regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejects decompression bombs (>25 MP) in header check and corrupt/truncated payloads in full decode", async () => {
    // 8000x8000 = 64 MP > 25 MP cap -> blocked before decode
    expect(() =>
      validateImageBuffer(makeValidPngBytes(8000, 8000), "image/png")
    ).toThrow(ImageValidationError);

    // Header-only PNG / JPEG without compressed pixel bitstream -> rejected by sharp decoder
    await expect(
      validateAndSanitizeUploadedImage(makeValidPngBytes(200, 150), "image/png")
    ).rejects.toThrow(ImageValidationError);
    await expect(
      validateAndSanitizeUploadedImage(makeValidJpegBytes(640, 480), "image/jpeg")
    ).rejects.toThrow(ImageValidationError);
  });

  it("decodes valid JPEG/PNG/WebP images cleanly and strips EXIF metadata before upload", async () => {
    const jpegWithExif = await sharp(Buffer.from(REAL_JPEG_BYTES))
      .withMetadata({ exif: { IFD0: { Make: "ConfidentialPhone", Model: "SecretCAM" } } })
      .jpeg()
      .toBuffer();

    const preMeta = await sharp(jpegWithExif).metadata();
    expect(preMeta.exif).toBeDefined();

    const sanitized = await validateAndSanitizeUploadedImage(
      new Uint8Array(jpegWithExif),
      "image/jpeg"
    );
    const postMeta = await sharp(sanitized.buffer).metadata();
    expect(postMeta.exif).toBeUndefined();
    expect(sanitized.metadata.width).toBe(80);
    expect(sanitized.metadata.height).toBe(80);

    const pngOut = await validateAndSanitizeUploadedImage(REAL_PNG_BYTES, "image/png");
    expect(pngOut.metadata.format).toBe("png");

    const webpOut = await validateAndSanitizeUploadedImage(REAL_WEBP_BYTES, "image/webp");
    expect(webpOut.metadata.format).toBe("webp");
  });

  it("rejects oversized chunked streams without Content-Length using bounded reader (413) and cancels stream", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);

    let cancelled = false;
    let pullCount = 0;
    const hugeChunk = new Uint8Array(1024 * 1024).fill(0x41);
    const bodyStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount++;
        if (pullCount <= 50) {
          controller.enqueue(hugeChunk);
        } else {
          controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    });

    const req = new Request(
      "http://localhost:3000/api/listings/cm1abc1234567890/images",
      {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=----khoj" },
        body: bodyStream,
        // Required by Undici/Node Request for ReadableStream body
        ...({ duplex: "half" } as object),
      } as RequestInit
    );

    const res = await uploadImagePost(req, {
      params: Promise.resolve({ id: "cm1abc1234567890" }),
    });

    expect(res.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pullCount).toBeLessThan(10);
    expect(uploadMarketplaceImage).not.toHaveBeenCalled();
  });

  it("refuses deleting Cloudinary assets outside active environment and surfaces sanitized remoteCleanupPending", async () => {
    const actualCloudinary = await vi.importActual<
      typeof import("@/lib/cloudinary")
    >("@/lib/cloudinary");

    vi.stubEnv("NODE_ENV", "development");
    await expect(
      actualCloudinary.deleteCloudinaryAsset(
        "khoj/production/listings/cm1abc1234567890/img_1"
      )
    ).rejects.toThrow("outside the active environment");

    // Public policy omits secrets cleanly when unconfigured
    vi.stubEnv("CLOUDINARY_API_KEY", "secret_key_never_exposed");
    vi.stubEnv("CLOUDINARY_API_SECRET", "secret_val_never_exposed");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "khojcloud");
    const policy = getCloudinaryPublicDeliveryPolicy();
    expect(policy).toEqual({ cloudName: "khojcloud", environment: "development" });
    expect(JSON.stringify(policy)).not.toContain("secret");

    // Failed remote cleanup logs warning cleanly and sets remoteCleanupPending without masking DB success
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });
    mockTx.listingImage.findFirst.mockResolvedValueOnce({
      id: "cm1img1234567890",
      publicId: "khoj/development/listings/cm1abc1234567890/img_1",
    });
    mockTx.listingImage.deleteMany.mockResolvedValueOnce({ count: 1 });
    vi.mocked(deleteCloudinaryAsset).mockRejectedValueOnce(
      new Error("cloudinary_secret_api_error")
    );

    const deleteRes = await deleteImageDelete(
      new Request(
        "http://localhost:3000/api/listings/cm1abc1234567890/images/cm1img1234567890",
        { method: "DELETE" }
      ),
      {
        params: Promise.resolve({
          id: "cm1abc1234567890",
          imageId: "cm1img1234567890",
        }),
      }
    );
    const body = (await deleteRes.json()) as {
      deleted: boolean;
      remoteCleanupPending?: boolean;
      notice?: string;
    };

    expect(deleteRes.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(body.remoteCleanupPending).toBe(true);
    expect(body.notice).toContain("reconciliation");
    expect(JSON.stringify(body)).not.toContain("cloudinary_secret_api_error");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();

    // Also test direct service return flag
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });
    mockTx.listingImage.findFirst.mockResolvedValueOnce({
      id: "cm1img1234567890",
      publicId: "khoj/development/listings/cm1abc1234567890/img_1",
    });
    mockTx.listingImage.deleteMany.mockResolvedValueOnce({ count: 1 });
    vi.mocked(deleteCloudinaryAsset).mockResolvedValueOnce(undefined);
    expect(
      await deleteImageFromOwnedListing(
        "cm1abc1234567890",
        "cm1img1234567890",
        "usr_seller_1"
      )
    ).toEqual({ id: "cm1img1234567890", remoteCleanupPending: false });
  });
});
