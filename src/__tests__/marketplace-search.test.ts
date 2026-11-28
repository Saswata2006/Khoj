import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (no live Neon database or network calls)
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  default: {
    listing: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  prisma: {
    listing: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
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
import { searchParamsToRecord } from "@/lib/api/listings-http";
import {
  getPublicMarketplaceListingCards,
  getPublicMarketplaceListings,
  getUserMarketplaceListings,
} from "@/lib/services/listings";
import {
  listMarketplaceQuerySchema,
  MAX_PRICE_INR,
} from "@/lib/validators/listing";
import { GET as listGet } from "@/app/api/listings/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDbListingRow(overrides?: Record<string, unknown>) {
  const now = new Date("2026-11-28T10:00:00.000Z");
  return {
    id: "cm1search12345678",
    title: "Casio fx-991EX Scientific Calculator",
    description:
      "Lightly used engineering calculator with original slide case and manual.",
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

// ---------------------------------------------------------------------------
// 1. Advanced Query Validation & Normalization
// ---------------------------------------------------------------------------

describe("Advanced marketplace search validation (listMarketplaceQuerySchema)", () => {
  it("trims and normalizes keyword search q and location filter", () => {
    const parsed = listMarketplaceQuerySchema.parse({
      q: "  casio   fx-991ex   calculator  ",
      location: "  North    Campus   Gate  ",
    });

    expect(parsed.q).toBe("casio fx-991ex calculator");
    expect(parsed.location).toBe("North Campus Gate");
    expect(parsed.sort).toBe("newest");
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(12);
  });

  it("normalizes whitespace-only q and location cleanly to undefined", () => {
    const parsed = listMarketplaceQuerySchema.parse({
      q: "     ",
      location: "   ",
    });

    expect(parsed.q).toBeUndefined();
    expect(parsed.location).toBeUndefined();
  });

  it("rejects control characters and excessive length in q or location", () => {
    expect(() =>
      listMarketplaceQuerySchema.parse({ q: "calc\u0000bomb" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ location: "gate\u0007test" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ q: "a".repeat(101) })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ location: "b".repeat(121) })
    ).toThrow();
  });

  it("rejects malformed, negative, >2-decimal, excessive, and inverted INR price ranges", () => {
    expect(() =>
      listMarketplaceQuerySchema.parse({ minPrice: "-10" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ maxPrice: "-0.01" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ minPrice: "100abc" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ maxPrice: "Infinity" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ minPrice: "   " })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ minPrice: "99.999" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ maxPrice: String(MAX_PRICE_INR + 1) })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ minPrice: "1500", maxPrice: "1000" })
    ).toThrow();

    // Valid inclusive bounds & rounding
    const valid = listMarketplaceQuerySchema.parse({
      minPrice: "0",
      maxPrice: "1500.5",
    });
    expect(valid.minPrice).toBe(0);
    expect(valid.maxPrice).toBe(1500.5);
  });

  it("validates supported enums and rejects invalid categories, conditions, sort options, and pagination bounds", () => {
    expect(() =>
      listMarketplaceQuerySchema.parse({ category: "REAL_ESTATE" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ condition: "BROKEN" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ sort: "most_popular" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ page: "1.5" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ page: "1001" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ limit: "0" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ limit: "51" })
    ).toThrow();
  });

  it("strictly rejects unsupported parameters (isNegotiable, type, status, userId, unknown keys)", () => {
    expect(() =>
      listMarketplaceQuerySchema.parse({ isNegotiable: "true" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ type: "LOST" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ status: "REMOVED" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ userId: "usr_1" })
    ).toThrow();
    expect(() =>
      listMarketplaceQuerySchema.parse({ search: "legacy" })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Search Service Queries, Isolation & Deterministic Sorting
// ---------------------------------------------------------------------------

describe("getPublicMarketplaceListings search behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.listing.findMany).mockResolvedValue([
      makeDbListingRow(),
    ] as never);
    vi.mocked(prisma.listing.count).mockResolvedValue(1);
  });

  it("searches keyword q case-insensitively across title and description while keeping SALE + ACTIVE isolation", async () => {
    await getPublicMarketplaceListings({ q: "  Scientific   Calculator " });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: "SALE",
          status: "ACTIVE",
          OR: [
            {
              title: {
                contains: "Scientific Calculator",
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: "Scientific Calculator",
                mode: "insensitive",
              },
            },
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      })
    );
  });

  it("supports independent category, condition, price range, and location filtering", async () => {
    await getPublicMarketplaceListings({
      category: "BOOKS",
      condition: "GOOD",
      minPrice: "150",
      maxPrice: "600.5",
      location: "  Hostel 4  ",
    });

    const expectedWhere = {
      type: "SALE",
      status: "ACTIVE",
      category: "BOOKS",
      condition: "GOOD",
      location: { contains: "Hostel 4", mode: "insensitive" },
      price: { gte: "150.00", lte: "600.50" },
    };

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere })
    );
    expect(prisma.listing.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it("combines all filters simultaneously and computes exact filtered pagination metadata", async () => {
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(27);

    const result = await getPublicMarketplaceListings({
      q: "calculator",
      category: "ELECTRONICS",
      condition: "LIKE_NEW",
      minPrice: "500",
      maxPrice: "1200",
      location: "North Campus",
      sort: "price_asc",
      page: "2",
      limit: "10",
    });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: "SALE",
          status: "ACTIVE",
          category: "ELECTRONICS",
          condition: "LIKE_NEW",
          OR: [
            { title: { contains: "calculator", mode: "insensitive" } },
            { description: { contains: "calculator", mode: "insensitive" } },
          ],
          location: { contains: "North Campus", mode: "insensitive" },
          price: { gte: "500.00", lte: "1200.00" },
        },
        orderBy: [{ price: "asc" }, { createdAt: "desc" }, { id: "desc" }],
        skip: 10,
        take: 10,
      })
    );

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 27,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it("applies deterministic unique tie-breaker sorting for all four sort options", async () => {
    await getPublicMarketplaceListings({ sort: "newest" });
    expect(prisma.listing.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      })
    );

    await getPublicMarketplaceListings({ sort: "oldest" });
    expect(prisma.listing.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
    );

    await getPublicMarketplaceListings({ sort: "price_asc" });
    expect(prisma.listing.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ price: "asc" }, { createdAt: "desc" }, { id: "desc" }],
      })
    );

    await getPublicMarketplaceListings({ sort: "price_desc" });
    expect(prisma.listing.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ price: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      })
    );
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/listings Route Contract, Privacy & Error Handling
// ---------------------------------------------------------------------------

describe("GET /api/listings HTTP integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with filtered results, pagination metadata, no-store header, and stripped seller privacy fields", async () => {
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([
      makeDbListingRow({
        user: {
          id: "usr_seller_1",
          name: "Aarav Sharma",
          image: null,
          email: "private@example.com",
          hostelBlock: "Hostel 7",
          role: "USER",
        },
      }),
    ] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(1);

    const res = await listGet(
      new Request(
        "http://localhost:3000/api/listings?q=casio&category=ELECTRONICS&condition=LIKE_NEW&minPrice=500&maxPrice=1000&location=North%20Campus&sort=oldest&page=1&limit=12"
      )
    );
    const json = (await res.json()) as {
      listings: Array<{ price: number; seller: Record<string, unknown> }>;
      pagination: { total: number; page: number; totalPages: number };
    };

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(json.listings).toHaveLength(1);
    expect(json.listings[0].price).toBe(850);
    expect(json.listings[0].seller).toEqual({
      id: "usr_seller_1",
      name: "Aarav Sharma",
      image: null,
    });
    expect(json.pagination).toEqual({
      page: 1,
      limit: 12,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it("allows empty known optional params cleanly while rejecting unknown or duplicated params (400)", async () => {
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(0);

    // Blank HTML form fields are tolerated cleanly
    const cleanBlankRes = await listGet(
      new Request(
        "http://localhost:3000/api/listings?q=&category=&condition=&minPrice=&maxPrice=&location=&sort=newest"
      )
    );
    expect(cleanBlankRes.status).toBe(200);

    // Unsupported parameter (non-empty or empty) -> 400
    const badUnknownRes = await listGet(
      new Request("http://localhost:3000/api/listings?foo=")
    );
    expect(badUnknownRes.status).toBe(400);

    // Duplicate non-empty parameter -> 400
    const duplicateRes = await listGet(
      new Request(
        "http://localhost:3000/api/listings?category=BOOKS&category=CYCLES"
      )
    );
    expect(duplicateRes.status).toBe(400);
    expect(
      searchParamsToRecord("http://localhost:3000/api/listings?q=book&foo=")
    ).toEqual({ q: "book", foo: "" });
  });

  it("returns 400 for invalid minPrice > maxPrice and sanitized 500 on database failures", async () => {
    const badRangeRes = await listGet(
      new Request("http://localhost:3000/api/listings?minPrice=900&maxPrice=200")
    );
    expect(badRangeRes.status).toBe(400);
    expect(prisma.listing.findMany).not.toHaveBeenCalled();

    vi.mocked(prisma.listing.findMany).mockRejectedValueOnce(
      new Error("postgresql://neondb_owner:secret123@ep-host.neon.tech/khoj")
    );
    const errRes = await listGet(
      new Request("http://localhost:3000/api/listings?q=cycle")
    );
    const errJson = await errRes.json();

    expect(errRes.status).toBe(500);
    expect(JSON.stringify(errJson)).not.toContain("neondb_owner");
    expect(JSON.stringify(errJson)).not.toContain("secret123");
    expect(JSON.stringify(errJson)).not.toContain("neon.tech");
  });
});

// ---------------------------------------------------------------------------
// 4. Phase C Query Optimization Regression Tests (Summary Projection & Tie-Breakers)
// ---------------------------------------------------------------------------

describe("Phase C query optimizations (getPublicMarketplaceListingCards & owner orderBy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses lightweight card select (omits description & seller join, limits images to 1) while keeping SALE + ACTIVE isolation", async () => {
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([
      makeDbListingRow({
        images: [
          {
            id: "img_1",
            imageUrl:
              "https://res.cloudinary.com/demo/image/upload/v1/khoj/development/listings/cm1search12345678/1.jpg",
            createdAt: new Date("2026-11-28T10:00:00.000Z"),
          },
          {
            id: "img_2",
            imageUrl:
              "https://res.cloudinary.com/demo/image/upload/v1/khoj/development/listings/cm1search12345678/2.jpg",
            createdAt: new Date("2026-11-28T10:01:00.000Z"),
          },
        ],
      }),
    ] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(14);

    const res = await getPublicMarketplaceListingCards({
      q: "calculator",
      category: "ELECTRONICS",
      condition: "LIKE_NEW",
      minPrice: "500",
      maxPrice: "1500",
      location: "Library",
      sort: "price_desc",
      page: "2",
      limit: "12",
    });

    const findManyCall = vi.mocked(prisma.listing.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      orderBy: Array<Record<string, string>>;
      skip: number;
      take: number;
    };

    expect(findManyCall.where).toEqual({
      type: "SALE",
      status: "ACTIVE",
      category: "ELECTRONICS",
      condition: "LIKE_NEW",
      OR: [
        { title: { contains: "calculator", mode: "insensitive" } },
        { description: { contains: "calculator", mode: "insensitive" } },
      ],
      location: { contains: "Library", mode: "insensitive" },
      price: { gte: "500.00", lte: "1500.00" },
    });
    expect(findManyCall.select).not.toHaveProperty("description");
    expect(findManyCall.select).not.toHaveProperty("user");
    expect(findManyCall.select.images).toMatchObject({
      take: 1,
      orderBy: { createdAt: "asc" },
    });
    expect(findManyCall.orderBy).toEqual([
      { price: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(findManyCall.skip).toBe(12);
    expect(findManyCall.take).toBe(12);

    // Count receives identical `where` filter
    expect(prisma.listing.count).toHaveBeenCalledWith({
      where: findManyCall.where,
    });

    // Summary DTO strips description and seller completely while retaining primary thumbnail only
    expect(res.listings).toHaveLength(1);
    expect(res.listings[0]).not.toHaveProperty("description");
    expect(res.listings[0]).not.toHaveProperty("seller");
    expect(res.listings[0].images).toHaveLength(1);
    expect(res.listings[0].images[0].id).toBe("img_1");
    expect(res.pagination).toEqual({
      page: 2,
      limit: 12,
      total: 14,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it("applies deterministic createdAt + id tie-breaker sorting on getUserMarketplaceListings", async () => {
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(0);

    await getUserMarketplaceListings("usr_owner_1", {
      status: "ACTIVE",
      page: 1,
      limit: 12,
    });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "usr_owner_1", type: "SALE", status: "ACTIVE" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      })
    );
  });
});
