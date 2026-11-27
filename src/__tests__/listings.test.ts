import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — no live database, no live auth sessions
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

const mockTx = {
  listing: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: {
    listing: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    ),
  },
  prisma: {
    listing: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
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

import prisma from "@/lib/prisma";
import { AuthorizationError, requireUser } from "@/lib/authorization";
import {
  createMarketplaceListingSchema,
  updateMarketplaceListingSchema,
  listMarketplaceQuerySchema,
  listingIdSchema,
} from "@/lib/validators/listing";
import {
  markMarketplaceListingSold,
  ListingServiceError,
} from "@/lib/services/listings";
import { GET as listGet, POST as listPost } from "@/app/api/listings/route";
import { GET as myListingsGet } from "@/app/api/listings/me/route";
import {
  GET as listingDetailGet,
  PATCH as listingPatch,
  DELETE as listingDelete,
} from "@/app/api/listings/[id]/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDbListingRow(overrides?: Record<string, unknown>) {
  const now = new Date("2026-11-28T00:00:00.000Z");
  return {
    id: "cm1abc1234567890",
    title: "Casio fx-991EX Scientific Calculator",
    description: "Lightly used engineering calculator in great working condition.",
    type: "SALE" as const,
    category: "ELECTRONICS" as const,
    condition: "LIKE_NEW" as const,
    price: "850.00",
    location: "North Campus Library",
    status: "ACTIVE" as const,
    createdAt: now,
    updatedAt: now,
    user: {
      id: "usr_seller_1",
      name: "Aarav Sharma",
      image: null,
    },
    images: [],
    ...overrides,
  };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// 1. Validation Schemas
// ---------------------------------------------------------------------------

describe("Marketplace listing validation schemas", () => {
  it("validates a valid creation payload and rounds valid 2-decimal INR price", () => {
    const parsed = createMarketplaceListingSchema.parse({
      title: "  Data Structures Textbook  ",
      description: "Clean edition with zero torn pages and minimal notes.",
      price: 450.5,
      category: "BOOKS",
      condition: "GOOD",
      location: "  Main Gate  ",
    });

    expect(parsed).toEqual({
      title: "Data Structures Textbook",
      description: "Clean edition with zero torn pages and minimal notes.",
      price: 450.5,
      category: "BOOKS",
      condition: "GOOD",
      location: "Main Gate",
    });
  });

  it("rejects zero, negative, non-finite, and >2-decimal prices", () => {
    const base = {
      title: "Valid Item Title",
      description: "Valid detailed item description here.",
      category: "BOOKS",
      condition: "GOOD",
      location: "Campus Gate",
    };

    expect(() =>
      createMarketplaceListingSchema.parse({ ...base, price: 0 })
    ).toThrow();
    expect(() =>
      createMarketplaceListingSchema.parse({ ...base, price: -150 })
    ).toThrow();
    expect(() =>
      createMarketplaceListingSchema.parse({ ...base, price: Number.NaN })
    ).toThrow();
    expect(() =>
      createMarketplaceListingSchema.parse({ ...base, price: 99.999 })
    ).toThrow();
  });

  it("rejects invalid categories, invalid conditions, and Lost & Found status RESOLVED", () => {
    expect(() =>
      createMarketplaceListingSchema.parse({
        title: "Valid Item Title",
        description: "Valid detailed item description here.",
        price: 300,
        category: "FURNITURE_INVALID",
        condition: "GOOD",
        location: "Main Gate",
      })
    ).toThrow();

    expect(() =>
      updateMarketplaceListingSchema.parse({ status: "RESOLVED" })
    ).toThrow();
    expect(() => updateMarketplaceListingSchema.parse({})).toThrow();
  });

  it("rejects unexpected / mass-assignment fields (userId, type, isNegotiable)", () => {
    const base = {
      title: "Valid Item Title",
      description: "Valid detailed item description here.",
      price: 300,
      category: "BOOKS",
      condition: "GOOD",
      location: "Main Gate",
    };

    expect(() =>
      createMarketplaceListingSchema.parse({ ...base, userId: "usr_other" })
    ).toThrow();
    expect(() =>
      createMarketplaceListingSchema.parse({ ...base, type: "LOST" })
    ).toThrow();
    expect(() =>
      createMarketplaceListingSchema.parse({ ...base, isNegotiable: true })
    ).toThrow();
  });

  it("validates bounded pagination and listing identifiers", () => {
    expect(listMarketplaceQuerySchema.parse({}).limit).toBe(12);
    expect(() => listMarketplaceQuerySchema.parse({ limit: "100" })).toThrow();
    expect(() => listMarketplaceQuerySchema.parse({ page: "0" })).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ minPrice: "500", maxPrice: "100" })
    ).toThrow();

    expect(listingIdSchema.parse("cm1abc1234567890")).toBe("cm1abc1234567890");
    expect(() => listingIdSchema.parse("../etc")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Listing Creation & Auth Enforcement
// ---------------------------------------------------------------------------

describe("POST /api/listings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated creation with 401", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(
      new AuthorizationError("Authentication required.", 401)
    );

    const req = new Request("http://localhost:3000/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Laptop Stand",
        description: "Aluminum foldable stand for laptops.",
        price: 700,
        category: "ELECTRONICS",
        condition: "GOOD",
        location: "Block B",
      }),
    });

    const res = await listPost(req);
    expect(res.status).toBe(401);
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  it("creates a SALE listing owned by the authenticated session user (201)", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);

    vi.mocked(prisma.listing.create).mockResolvedValueOnce(
      makeDbListingRow() as never
    );

    const req = new Request("http://localhost:3000/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Casio fx-991EX Scientific Calculator",
        description:
          "Lightly used engineering calculator in great working condition.",
        price: 850,
        category: "ELECTRONICS",
        condition: "LIKE_NEW",
        location: "North Campus Library",
      }),
    });

    const res = await listPost(req);
    const json = (await res.json()) as {
      listing: { type: string; price: number; seller: Record<string, unknown> };
    };

    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(json.listing.type).toBe("SALE");
    expect(json.listing.price).toBe(850);
    expect(json.listing.seller.email).toBeUndefined();
    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "usr_seller_1",
          type: "SALE",
          status: "ACTIVE",
          price: "850.00",
        }),
      })
    );
  });

  it("returns sanitized 500 on unexpected database errors without leaking credentials", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    vi.mocked(prisma.listing.create).mockRejectedValueOnce(
      new Error("postgresql://secret:pass@ep-db.neon.tech/khoj crashed")
    );

    const req = new Request("http://localhost:3000/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Laptop Stand",
        description: "Aluminum foldable stand for laptops.",
        price: 700,
        category: "ELECTRONICS",
        condition: "GOOD",
        location: "Block B",
      }),
    });

    const res = await listPost(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("neon.tech");
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});

// ---------------------------------------------------------------------------
// 3. Public Listings, Pagination, Private Data & Type Separation
// ---------------------------------------------------------------------------

describe("Public marketplace GET endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated ACTIVE SALE listings without private seller fields", async () => {
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([
      makeDbListingRow(),
    ] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(25);

    const req = new Request(
      "http://localhost:3000/api/listings?page=2&limit=10&category=ELECTRONICS"
    );
    const res = await listGet(req);
    const json = (await res.json()) as {
      listings: Array<{ seller: Record<string, unknown> }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };

    expect(res.status).toBe(200);
    expect(json.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
    expect(json.listings).toHaveLength(1);
    expect(json.listings[0].seller).not.toHaveProperty("email");
    expect(json.listings[0].seller).not.toHaveProperty("role");
    expect(json.listings[0].seller).not.toHaveProperty("hostelBlock");
    expect(json.listings[0].seller).not.toHaveProperty("location");
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "SALE",
          status: "ACTIVE",
          category: "ELECTRONICS",
        }),
        skip: 10,
        take: 10,
      })
    );
  });

  it("rejects out-of-bounds pagination parameters with 400", async () => {
    const req = new Request("http://localhost:3000/api/listings?limit=500");
    const res = await listGet(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when a listing is missing or belongs to Lost & Found", async () => {
    vi.mocked(prisma.listing.findFirst).mockResolvedValueOnce(null);

    const res = await listingDetailGet(
      new Request("http://localhost:3000/api/listings/cm1lostitem12345"),
      makeParams("cm1lostitem12345")
    );
    expect(res.status).toBe(404);
    expect(prisma.listing.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "cm1lostitem12345",
          type: "SALE",
          status: { not: "REMOVED" },
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 4. User Listings (/api/listings/me)
// ---------------------------------------------------------------------------

describe("GET /api/listings/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests with 401", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(
      new AuthorizationError("Authentication required.", 401)
    );
    const res = await myListingsGet(
      new Request("http://localhost:3000/api/listings/me")
    );
    expect(res.status).toBe(401);
  });

  it("returns only the authenticated user's SALE listings with no-store header", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([
      makeDbListingRow({ status: "SOLD" }),
    ] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(1);

    const res = await myListingsGet(
      new Request("http://localhost:3000/api/listings/me?status=SOLD")
    );
    const json = (await res.json()) as { listings: Array<{ status: string }> };

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(json.listings[0].status).toBe("SOLD");
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "usr_seller_1", type: "SALE", status: "SOLD" },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Ownership Enforcement, Status Changes & Soft Deletion
// ---------------------------------------------------------------------------

describe("PATCH & DELETE /api/listings/[id] + status transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated PATCH and DELETE with 401", async () => {
    vi.mocked(requireUser).mockRejectedValue(
      new AuthorizationError("Authentication required.", 401)
    );

    const patchRes = await listingPatch(
      new Request("http://localhost:3000/api/listings/cm1abc1234567890", {
        method: "PATCH",
        body: JSON.stringify({ price: 500 }),
      }),
      makeParams("cm1abc1234567890")
    );
    expect(patchRes.status).toBe(401);

    const deleteRes = await listingDelete(
      new Request("http://localhost:3000/api/listings/cm1abc1234567890", {
        method: "DELETE",
      }),
      makeParams("cm1abc1234567890")
    );
    expect(deleteRes.status).toBe(401);
  });

  it("forbids non-owners from updating or deleting another user's listing (403 IDOR guard)", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "usr_attacker_2",
      email: "attacker@example.com",
      role: "USER",
    } as never);

    mockTx.listing.findUnique.mockResolvedValue({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });

    const patchRes = await listingPatch(
      new Request("http://localhost:3000/api/listings/cm1abc1234567890", {
        method: "PATCH",
        body: JSON.stringify({ price: 1 }),
      }),
      makeParams("cm1abc1234567890")
    );
    expect(patchRes.status).toBe(403);
    expect(mockTx.listing.update).not.toHaveBeenCalled();

    const deleteRes = await listingDelete(
      new Request("http://localhost:3000/api/listings/cm1abc1234567890", {
        method: "DELETE",
      }),
      makeParams("cm1abc1234567890")
    );
    expect(deleteRes.status).toBe(403);
    expect(mockTx.listing.update).not.toHaveBeenCalled();
  });

  it("treats LOST or FOUND records as 404 in marketplace mutation endpoints", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);

    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1lostitem12345",
      userId: "usr_seller_1",
      type: "LOST",
      status: "ACTIVE",
    });

    const res = await listingPatch(
      new Request("http://localhost:3000/api/listings/cm1lostitem12345", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated Title" }),
      }),
      makeParams("cm1lostitem12345")
    );
    expect(res.status).toBe(404);
    expect(mockTx.listing.update).not.toHaveBeenCalled();
  });

  it("allows owner to update fields and mark listing as SOLD, and rejects editing REMOVED listings (409)", async () => {
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
    mockTx.listing.update.mockResolvedValueOnce(
      makeDbListingRow({ price: "799.00", status: "SOLD" })
    );

    const patchRes = await listingPatch(
      new Request("http://localhost:3000/api/listings/cm1abc1234567890", {
        method: "PATCH",
        body: JSON.stringify({ price: 799, status: "SOLD" }),
      }),
      makeParams("cm1abc1234567890")
    );
    const patchJson = (await patchRes.json()) as {
      listing: { price: number; status: string };
    };
    expect(patchRes.status).toBe(200);
    expect(patchJson.listing.price).toBe(799);
    expect(patchJson.listing.status).toBe("SOLD");

    // Attempt to update REMOVED listing -> 409 Conflict
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "REMOVED",
    });

    const conflictRes = await listingPatch(
      new Request("http://localhost:3000/api/listings/cm1abc1234567890", {
        method: "PATCH",
        body: JSON.stringify({ status: "ACTIVE" }),
      }),
      makeParams("cm1abc1234567890")
    );
    expect(conflictRes.status).toBe(409);
  });

  it("archives an owned listing via DELETE and rejects duplicate removal (409)", async () => {
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
    mockTx.listing.update.mockResolvedValueOnce(
      makeDbListingRow({ status: "REMOVED" })
    );

    const deleteRes = await listingDelete(
      new Request("http://localhost:3000/api/listings/cm1abc1234567890", {
        method: "DELETE",
      }),
      makeParams("cm1abc1234567890")
    );
    expect(deleteRes.status).toBe(200);
    expect(mockTx.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "REMOVED" },
      })
    );
  });

  it("markMarketplaceListingSold rejects already-SOLD listings with 409 Conflict", async () => {
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "SOLD",
    });

    await expect(
      markMarketplaceListingSold("cm1abc1234567890", "usr_seller_1")
    ).rejects.toMatchObject({ status: 409 });

    // Non-owner also throws 403 ListingServiceError
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });

    await expect(
      markMarketplaceListingSold("cm1abc1234567890", "usr_other")
    ).rejects.toThrow(ListingServiceError);
  });

  it("rejects PATCH edits on already-SOLD listings (409) and oversized JSON bodies (413)", async () => {
    // 1. Direct API attempt to modify/reopen a SOLD listing -> 409 Conflict
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_seller_1",
      type: "SALE",
      status: "SOLD",
    });

    const soldPatchRes = await listingPatch(
      new Request("http://localhost:3000/api/listings/cm1abc1234567890", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: 1, status: "ACTIVE" }),
      }),
      makeParams("cm1abc1234567890")
    );
    expect(soldPatchRes.status).toBe(409);
    expect(mockTx.listing.update).not.toHaveBeenCalled();

    // 2. Oversized streamed JSON body without Content-Length -> 413 Payload Too Large
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: "usr_seller_1",
      email: "seller@example.com",
      role: "USER",
    } as never);
    const oversizedJsonStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(70 * 1024).fill(0x61));
        controller.close();
      },
    });
    const oversizedReq = new Request("http://localhost:3000/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversizedJsonStream,
      ...({ duplex: "half" } as object),
    } as RequestInit);

    const jsonTooLargeRes = await listPost(oversizedReq);
    expect(jsonTooLargeRes.status).toBe(413);
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });
});
