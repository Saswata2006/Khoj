import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (mocked Prisma, auth, and PostgreSQL rate limiter; NOT live DB concurrency)
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

const mockTx = {
  listing: {
    findUnique: vi.fn(),
  },
  contactRequest: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    listing: {
      count: vi.fn(),
    },
    claim: {
      count: vi.fn(),
    },
    contactRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    rateLimit: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    ),
  },
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    listing: {
      count: vi.fn(),
    },
    claim: {
      count: vi.fn(),
    },
    contactRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    rateLimit: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
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
import { getDashboardSummary } from "@/lib/profile";
import { getContactRequestCounts } from "@/lib/services/contact-requests";
import { POST as createContactRequestPost } from "@/app/api/listings/[id]/contact-requests/route";
import { GET as incomingRequestsGet } from "@/app/api/contact-requests/incoming/route";
import { GET as outgoingRequestsGet } from "@/app/api/contact-requests/outgoing/route";
import {
  GET as singleRequestGet,
  PATCH as singleRequestPatch,
} from "@/app/api/contact-requests/[id]/route";

// ---------------------------------------------------------------------------
// Helpers & Fixtures
// ---------------------------------------------------------------------------

function makeUser(id: string, email: string) {
  return {
    id,
    email,
    name: id === "usr_seller_1" ? "Aarav Seller" : "Riya Buyer",
    role: "USER",
    emailVerified: true,
  };
}

function makeDbContactRequestRow(overrides?: Record<string, unknown>) {
  const now = new Date("2026-11-28T12:00:00.000Z");
  return {
    id: "creq_1234567890",
    listingId: "cm1listing_123456",
    requesterId: "usr_buyer_1",
    status: "PENDING" as const,
    createdAt: now,
    updatedAt: now,
    requester: {
      id: "usr_buyer_1",
      name: "Riya Buyer",
      image: null,
    },
    listing: {
      id: "cm1listing_123456",
      userId: "usr_seller_1",
      title: "Casio fx-991EX Scientific Calculator",
      type: "SALE" as const,
      category: "ELECTRONICS" as const,
      condition: "LIKE_NEW" as const,
      price: "850.00",
      location: "North Campus Library",
      status: "ACTIVE" as const,
      user: {
        id: "usr_seller_1",
        name: "Aarav Seller",
        image: null,
      },
      images: [
        {
          imageUrl:
            "https://res.cloudinary.com/demo/image/upload/v1/khoj/development/listings/cm1listing_123456/img_1.webp",
        },
      ],
    },
    ...overrides,
  };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockAllowedRateLimits() {
  vi.mocked(prisma.$queryRaw).mockResolvedValue([
    {
      count: 1,
      windowStart: new Date(),
      lastAttemptAt: new Date(),
    },
  ]);
}

// ---------------------------------------------------------------------------
// 1. Creation, Validation, Self-Contact, Duplicates & Rate Limiting
// ---------------------------------------------------------------------------

describe("POST /api/listings/[id]/contact-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue(
      makeUser("usr_buyer_1", "buyer.private@example.com") as never
    );
    mockAllowedRateLimits();
  });

  it("rejects unauthenticated callers with 401 and no-store cache headers", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(
      new AuthorizationError("Authentication required.", 401)
    );

    const res = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_123456/contact-requests",
        { method: "POST" }
      ),
      makeParams("cm1listing_123456")
    );

    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("creates a PENDING contact request for an ACTIVE SALE listing without exposing emails", async () => {
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1listing_123456",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });
    mockTx.contactRequest.findUnique.mockResolvedValueOnce(null);
    mockTx.contactRequest.create.mockResolvedValueOnce(
      makeDbContactRequestRow({
        requester: {
          id: "usr_buyer_1",
          name: "Riya Buyer",
          image: null,
          email: "buyer.private@example.com",
          hostelBlock: "Hostel 2",
        },
      })
    );

    const res = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_123456/contact-requests",
        {
          method: "POST",
          headers: {
            "x-real-ip": "203.0.113.10",
          },
        }
      ),
      makeParams("cm1listing_123456")
    );
    const json = (await res.json()) as {
      contactRequest: Record<string, unknown>;
    };

    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(json.contactRequest.status).toBe("PENDING");
    expect(json.contactRequest.viewerRole).toBe("BUYER");
    expect(json.contactRequest.requesterId).toBe("usr_buyer_1");
    expect(mockTx.contactRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          listingId: "cm1listing_123456",
          requesterId: "usr_buyer_1",
          status: "PENDING",
        },
      })
    );

    const rawBody = JSON.stringify(json);
    expect(rawBody).not.toContain("buyer.private@example.com");
    expect(rawBody).not.toContain("Hostel 2");
    expect(rawBody).not.toContain("email");
  });

  it("blocks self-contact requests with 400", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce(
      makeUser("usr_seller_1", "seller.private@example.com") as never
    );
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1listing_123456",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });

    const res = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_123456/contact-requests",
        { method: "POST" }
      ),
      makeParams("cm1listing_123456")
    );

    expect(res.status).toBe(400);
    expect(mockTx.contactRequest.create).not.toHaveBeenCalled();
  });

  it("prevents duplicate requests both via pre-check and DB P2002 unique constraint conflict (409)", async () => {
    mockTx.listing.findUnique.mockResolvedValue({
      id: "cm1listing_123456",
      userId: "usr_seller_1",
      type: "SALE",
      status: "ACTIVE",
    });
    mockTx.contactRequest.findUnique.mockResolvedValueOnce({
      id: "creq_existing",
      status: "PENDING",
    });

    const dupRes = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_123456/contact-requests",
        { method: "POST" }
      ),
      makeParams("cm1listing_123456")
    );
    expect(dupRes.status).toBe(409);

    // Simulated mocked P2002 race from PostgreSQL @@unique([listingId, requesterId])
    mockTx.contactRequest.findUnique.mockResolvedValueOnce(null);
    mockTx.contactRequest.create.mockRejectedValueOnce({ code: "P2002" });

    const raceRes = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_123456/contact-requests",
        { method: "POST" }
      ),
      makeParams("cm1listing_123456")
    );
    expect(raceRes.status).toBe(409);
  });

  it("rejects SOLD, REMOVED, and LOST/FOUND listings cleanly", async () => {
    // SOLD -> 409
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1listing_sold",
      userId: "usr_seller_1",
      type: "SALE",
      status: "SOLD",
    });
    const soldRes = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_sold/contact-requests",
        { method: "POST" }
      ),
      makeParams("cm1listing_sold")
    );
    expect(soldRes.status).toBe(409);

    // REMOVED -> 404
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1listing_removed",
      userId: "usr_seller_1",
      type: "SALE",
      status: "REMOVED",
    });
    const removedRes = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_removed/contact-requests",
        { method: "POST" }
      ),
      makeParams("cm1listing_removed")
    );
    expect(removedRes.status).toBe(404);

    // LOST / FOUND -> 404
    mockTx.listing.findUnique.mockResolvedValueOnce({
      id: "cm1listing_lost",
      userId: "usr_seller_1",
      type: "LOST",
      status: "ACTIVE",
    });
    const lostRes = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_lost/contact-requests",
        { method: "POST" }
      ),
      makeParams("cm1listing_lost")
    );
    expect(lostRes.status).toBe(404);
  });

  it("rejects mass-assignment fields (status, requesterId, unsupported message), malformed JSON, and oversized bodies", async () => {
    const spoofRes = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_123456/contact-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requesterId: "usr_victim",
            status: "ACCEPTED",
            message: "Unsupported column",
          }),
        }
      ),
      makeParams("cm1listing_123456")
    );
    expect(spoofRes.status).toBe(400);

    const badJsonRes = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_123456/contact-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{not-json",
        }
      ),
      makeParams("cm1listing_123456")
    );
    expect(badJsonRes.status).toBe(400);

    const oversizedRes = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_123456/contact-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ junk: "a".repeat(70 * 1024) }),
        }
      ),
      makeParams("cm1listing_123456")
    );
    expect(oversizedRes.status).toBe(413);
  });

  it("enforces PostgreSQL anti-spam rate limiting with 429 and Retry-After", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValueOnce({
      count: 10,
      windowStart: new Date(Date.now() - 20 * 60_000),
      lastAttemptAt: new Date(Date.now() - 2_000),
    } as never);
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValueOnce({
      count: 1,
      windowStart: new Date(),
      lastAttemptAt: new Date(),
    } as never);

    const res = await createContactRequestPost(
      new Request(
        "http://localhost:3000/api/listings/cm1listing_123456/contact-requests",
        {
          method: "POST",
          headers: { "x-real-ip": "198.51.100.5" },
        }
      ),
      makeParams("cm1listing_123456")
    );

    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mockTx.contactRequest.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Incoming/Outgoing Queries, Authorization, Decisions & Privacy
// ---------------------------------------------------------------------------

describe("Contact request retrieval, decisions, privacy & dashboard counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes incoming seller requests and outgoing buyer requests with pagination & status validation", async () => {
    vi.mocked(requireUser).mockResolvedValue(
      makeUser("usr_seller_1", "seller@example.com") as never
    );
    vi.mocked(prisma.contactRequest.findMany).mockResolvedValueOnce([
      makeDbContactRequestRow(),
    ] as never);
    vi.mocked(prisma.contactRequest.count).mockResolvedValueOnce(15);

    const incomingRes = await incomingRequestsGet(
      new Request(
        "http://localhost:3000/api/contact-requests/incoming?status=PENDING&page=2&limit=10"
      )
    );
    const incomingJson = (await incomingRes.json()) as {
      contactRequests: Array<{ viewerRole: string }>;
      pagination: { total: number; totalPages: number; page: number };
    };

    expect(incomingRes.status).toBe(200);
    expect(incomingRes.headers.get("Cache-Control")).toContain("no-store");
    expect(incomingJson.contactRequests[0].viewerRole).toBe("SELLER");
    expect(incomingJson.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 15,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
    expect(prisma.contactRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          listing: { userId: "usr_seller_1", type: "SALE" },
          status: "PENDING",
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 10,
        take: 10,
      })
    );

    // Outgoing query
    vi.mocked(requireUser).mockResolvedValueOnce(
      makeUser("usr_buyer_1", "buyer@example.com") as never
    );
    vi.mocked(prisma.contactRequest.findMany).mockResolvedValueOnce([
      makeDbContactRequestRow({ status: "ACCEPTED" }),
    ] as never);
    vi.mocked(prisma.contactRequest.count).mockResolvedValueOnce(1);

    const outgoingRes = await outgoingRequestsGet(
      new Request("http://localhost:3000/api/contact-requests/outgoing")
    );
    const outgoingJson = (await outgoingRes.json()) as {
      contactRequests: Array<{
        viewerRole: string;
        contactDisclosure: { canRevealContact: boolean; status: string };
      }>;
    };

    expect(outgoingRes.status).toBe(200);
    expect(outgoingJson.contactRequests[0].viewerRole).toBe("BUYER");
    expect(outgoingJson.contactRequests[0].contactDisclosure.canRevealContact).toBe(
      false
    );
    expect(outgoingJson.contactRequests[0].contactDisclosure.status).toBe(
      "DEFERRED_CONSENT_SCHEMA_REQUIRED"
    );
    expect(prisma.contactRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          requesterId: "usr_buyer_1",
          listing: { type: "SALE" },
        },
      })
    );

    // Invalid query key / status / limit -> 400
    const badQueryRes = await incomingRequestsGet(
      new Request(
        "http://localhost:3000/api/contact-requests/incoming?status=CANCELLED"
      )
    );
    expect(badQueryRes.status).toBe(400);
  });

  it("allows only the buyer or seller to GET /api/contact-requests/[id] (blocks unrelated users 403)", async () => {
    vi.mocked(prisma.contactRequest.findUnique).mockResolvedValue(
      makeDbContactRequestRow() as never
    );

    // Unrelated user -> 403
    vi.mocked(requireUser).mockResolvedValueOnce(
      makeUser("usr_stranger_9", "stranger@example.com") as never
    );
    const strangerRes = await singleRequestGet(
      new Request("http://localhost:3000/api/contact-requests/creq_1234567890"),
      makeParams("creq_1234567890")
    );
    expect(strangerRes.status).toBe(403);

    // Buyer -> 200 without private seller email
    vi.mocked(requireUser).mockResolvedValueOnce(
      makeUser("usr_buyer_1", "buyer@example.com") as never
    );
    const buyerRes = await singleRequestGet(
      new Request("http://localhost:3000/api/contact-requests/creq_1234567890"),
      makeParams("creq_1234567890")
    );
    const buyerJson = await buyerRes.json();
    expect(buyerRes.status).toBe(200);
    expect(JSON.stringify(buyerJson)).not.toContain("@example.com");
  });

  it("enforces seller-only ACCEPTED/REJECTED decisions, blocks buyer self-acceptance, and locks terminal states atomically", async () => {
    // Buyer attempting to self-accept -> 403
    vi.mocked(requireUser).mockResolvedValueOnce(
      makeUser("usr_buyer_1", "buyer@example.com") as never
    );
    mockTx.contactRequest.findUnique.mockResolvedValueOnce({
      id: "creq_1234567890",
      status: "PENDING",
      requesterId: "usr_buyer_1",
      listing: {
        id: "cm1listing_123456",
        userId: "usr_seller_1",
        type: "SALE",
        status: "ACTIVE",
      },
    });

    const buyerPatchRes = await singleRequestPatch(
      new Request("http://localhost:3000/api/contact-requests/creq_1234567890", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACCEPTED" }),
      }),
      makeParams("creq_1234567890")
    );
    expect(buyerPatchRes.status).toBe(403);
    expect(mockTx.contactRequest.update).not.toHaveBeenCalled();

    // Seller accepting PENDING request on ACTIVE SALE listing -> 200 without leaking login emails
    vi.mocked(requireUser).mockResolvedValueOnce(
      makeUser("usr_seller_1", "seller.login@example.com") as never
    );
    mockTx.contactRequest.findUnique.mockResolvedValueOnce({
      id: "creq_1234567890",
      status: "PENDING",
      requesterId: "usr_buyer_1",
      listing: {
        id: "cm1listing_123456",
        userId: "usr_seller_1",
        type: "SALE",
        status: "ACTIVE",
      },
    });
    mockTx.contactRequest.update.mockResolvedValueOnce(
      makeDbContactRequestRow({ status: "ACCEPTED" })
    );

    const sellerAcceptRes = await singleRequestPatch(
      new Request("http://localhost:3000/api/contact-requests/creq_1234567890", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACCEPTED" }),
      }),
      makeParams("creq_1234567890")
    );
    const acceptJson = (await sellerAcceptRes.json()) as {
      contactRequest: {
        status: string;
        contactDisclosure: { canRevealContact: boolean };
      };
    };

    expect(sellerAcceptRes.status).toBe(200);
    expect(acceptJson.contactRequest.status).toBe("ACCEPTED");
    expect(acceptJson.contactRequest.contactDisclosure.canRevealContact).toBe(
      false
    );
    expect(JSON.stringify(acceptJson)).not.toContain("seller.login@example.com");
    expect(mockTx.contactRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "creq_1234567890",
          status: "PENDING",
          listing: {
            userId: "usr_seller_1",
            type: "SALE",
            status: "ACTIVE",
          },
        },
        data: { status: "ACCEPTED" },
      })
    );

    // Concurrent or repeat update against already-ACCEPTED request -> 409
    vi.mocked(requireUser).mockResolvedValueOnce(
      makeUser("usr_seller_1", "seller@example.com") as never
    );
    mockTx.contactRequest.findUnique.mockResolvedValueOnce({
      id: "creq_1234567890",
      status: "ACCEPTED",
      requesterId: "usr_buyer_1",
      listing: {
        id: "cm1listing_123456",
        userId: "usr_seller_1",
        type: "SALE",
        status: "ACTIVE",
      },
    });
    const repeatRes = await singleRequestPatch(
      new Request("http://localhost:3000/api/contact-requests/creq_1234567890", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      }),
      makeParams("creq_1234567890")
    );
    expect(repeatRes.status).toBe(409);

    // Attempting ACCEPT on SOLD listing -> 409
    vi.mocked(requireUser).mockResolvedValueOnce(
      makeUser("usr_seller_1", "seller@example.com") as never
    );
    mockTx.contactRequest.findUnique.mockResolvedValueOnce({
      id: "creq_1234567890",
      status: "PENDING",
      requesterId: "usr_buyer_1",
      listing: {
        id: "cm1listing_123456",
        userId: "usr_seller_1",
        type: "SALE",
        status: "SOLD",
      },
    });
    const soldAcceptRes = await singleRequestPatch(
      new Request("http://localhost:3000/api/contact-requests/creq_1234567890", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACCEPTED" }),
      }),
      makeParams("creq_1234567890")
    );
    expect(soldAcceptRes.status).toBe(409);

    // Concurrent P2025 conflict during update -> 409
    vi.mocked(requireUser).mockResolvedValueOnce(
      makeUser("usr_seller_1", "seller@example.com") as never
    );
    mockTx.contactRequest.findUnique.mockResolvedValueOnce({
      id: "creq_1234567890",
      status: "PENDING",
      requesterId: "usr_buyer_1",
      listing: {
        id: "cm1listing_123456",
        userId: "usr_seller_1",
        type: "SALE",
        status: "ACTIVE",
      },
    });
    mockTx.contactRequest.update.mockRejectedValueOnce({ code: "P2025" });

    const p2025Res = await singleRequestPatch(
      new Request("http://localhost:3000/api/contact-requests/creq_1234567890", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      }),
      makeParams("cm1_conflict")
    );
    expect(p2025Res.status).toBe(409);
  });

  it("returns sanitized 500 error on internal DB failures and computes user-scoped dashboard contact counts", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce(
      makeUser("usr_buyer_1", "buyer@example.com") as never
    );
    vi.mocked(prisma.contactRequest.findMany).mockRejectedValueOnce(
      new Error("postgresql://dbuser:topsecret@ep-db.neon.tech/khoj")
    );

    const errRes = await outgoingRequestsGet(
      new Request("http://localhost:3000/api/contact-requests/outgoing")
    );
    const errJson = await errRes.json();
    expect(errRes.status).toBe(500);
    expect(JSON.stringify(errJson)).not.toContain("topsecret");
    expect(JSON.stringify(errJson)).not.toContain("neon.tech");

    // Detailed contact request counts
    vi.mocked(prisma.contactRequest.count)
      .mockResolvedValueOnce(2) // incomingPending
      .mockResolvedValueOnce(5) // incomingTotal
      .mockResolvedValueOnce(1) // outgoingPending
      .mockResolvedValueOnce(3) // outgoingAccepted
      .mockResolvedValueOnce(4); // outgoingTotal

    const counts = await getContactRequestCounts("usr_seller_1");
    expect(counts).toEqual({
      incomingPending: 2,
      incomingTotal: 5,
      outgoingPending: 1,
      outgoingAccepted: 3,
      outgoingTotal: 4,
      total: 9,
    });

    // Dashboard summary counts both sent & received marketplace requests
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "usr_seller_1",
      name: "Seller",
      email: "seller@example.com",
      emailVerified: true,
      image: null,
      location: "Campus",
      hostelBlock: null,
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(2);
    vi.mocked(prisma.claim.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.contactRequest.count).mockResolvedValueOnce(9);

    const summary = await getDashboardSummary("usr_seller_1");
    expect(summary?.counts.contactRequests).toBe(9);
    expect(prisma.contactRequest.count).toHaveBeenLastCalledWith({
      where: {
        OR: [
          { requesterId: "usr_seller_1" },
          { listing: { userId: "usr_seller_1", type: "SALE" } },
        ],
      },
    });
  });
});
