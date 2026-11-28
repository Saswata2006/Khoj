import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// Mocks (no live DB, no live emails, no network requests)
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    contactRequest: {
      findUnique: vi.fn(),
    },
  },
  prisma: {
    contactRequest: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkContactRequestUserRateLimit: vi.fn(),
  checkContactRequestIpRateLimit: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { getBuyerContactRequestForListing } from "@/lib/services/contact-requests";
import {
  buildContactLoginHref,
  formatContactRateLimitMessage,
  recoverExistingBuyerContactRequest,
  submitContactRequest,
  type ContactRequestClientDTO,
} from "@/lib/contact-request-ui";
import { ContactSellerAction } from "@/components/marketplace/ContactSellerAction";

function makeClientContactRequest(
  overrides: Partial<ContactRequestClientDTO> = {}
): ContactRequestClientDTO {
  return {
    id: "req_1234567890",
    listingId: "cm1abc1234567890",
    status: "PENDING",
    createdAt: "2026-11-28T12:00:00.000Z",
    updatedAt: "2026-11-28T12:00:00.000Z",
    contactDisclosure: {
      canRevealContact: false,
      consentRecorded: false,
      status: "PENDING_SELLER_RESPONSE",
      message:
        "Contact details stay hidden until the seller accepts and explicit consent sharing is available.",
    },
    ...overrides,
  };
}

describe("Day 5 Phase B: Contact Seller UI & Server Lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders Sign in to contact seller with safe return URL for anonymous visitors", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContactSellerAction, {
        listingId: "cm1abc1234567890",
        listingTitle: "Casio Calculator",
        formattedPrice: "₹850",
        listingStatus: "ACTIVE",
        sellerDisplayName: "Ananya Rao",
        sellerInitials: "AR",
        isAuthenticated: false,
        isOwner: false,
        initialRequest: null,
      })
    );

    expect(html).toContain("Sign in to contact seller");
    expect(html).toContain(
      'href="/login?redirectTo=%2Fmarketplace%2Fcm1abc1234567890"'
    );
    expect(buildContactLoginHref("cm1abc1234567890")).toBe(
      "/login?redirectTo=%2Fmarketplace%2Fcm1abc1234567890"
    );
    expect(buildContactLoginHref("evil\npath")).toBe(
      "/login?redirectTo=%2Fmarketplace"
    );
  });

  it("hides Contact Seller controls when viewer is listing owner", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContactSellerAction, {
        listingId: "cm1abc1234567890",
        listingTitle: "Casio Calculator",
        formattedPrice: "₹850",
        listingStatus: "ACTIVE",
        sellerDisplayName: "Ananya Rao",
        sellerInitials: "AR",
        isAuthenticated: true,
        isOwner: true,
        initialRequest: null,
      })
    );

    expect(html).toBe("");
  });

  it("renders Request Contact CTA for authenticated buyer without existing request and blocks SOLD/REMOVED listings", () => {
    const activeBuyerHtml = renderToStaticMarkup(
      React.createElement(ContactSellerAction, {
        listingId: "cm1abc1234567890",
        listingTitle: "Casio Calculator",
        formattedPrice: "₹850",
        listingStatus: "ACTIVE",
        sellerDisplayName: "Ananya Rao",
        sellerInitials: "AR",
        isAuthenticated: true,
        isOwner: false,
        initialRequest: null,
      })
    );

    expect(activeBuyerHtml).toContain("Request Contact");
    expect(activeBuyerHtml).toContain("does not automatically expose");
    expect(activeBuyerHtml).not.toContain("<textarea");

    const soldHtml = renderToStaticMarkup(
      React.createElement(ContactSellerAction, {
        listingId: "cm1abc1234567890",
        listingTitle: "Casio Calculator",
        formattedPrice: "₹850",
        listingStatus: "SOLD",
        sellerDisplayName: "Ananya Rao",
        sellerInitials: "AR",
        isAuthenticated: true,
        isOwner: false,
        initialRequest: null,
      })
    );

    expect(soldHtml).toContain("Sold — Item No Longer Available");
    expect(soldHtml).not.toContain("Request Contact");

    const removedHtml = renderToStaticMarkup(
      React.createElement(ContactSellerAction, {
        listingId: "cm1abc1234567890",
        listingTitle: "Casio Calculator",
        formattedPrice: "₹850",
        listingStatus: "REMOVED",
        sellerDisplayName: "Ananya Rao",
        sellerInitials: "AR",
        isAuthenticated: true,
        isOwner: false,
        initialRequest: null,
      })
    );

    expect(removedHtml).not.toContain("Request Contact");
  });

  it("renders PENDING, ACCEPTED (without leaking private contact info), and REJECTED request states", () => {
    const pendingHtml = renderToStaticMarkup(
      React.createElement(ContactSellerAction, {
        listingId: "cm1abc1234567890",
        listingTitle: "Casio Calculator",
        formattedPrice: "₹850",
        listingStatus: "ACTIVE",
        sellerDisplayName: "Ananya Rao",
        sellerInitials: "AR",
        isAuthenticated: true,
        isOwner: false,
        initialRequest: makeClientContactRequest({ status: "PENDING" }),
      })
    );
    expect(pendingHtml).toContain("Request Sent — Awaiting Response");
    expect(pendingHtml).toContain("Pending");
    expect(pendingHtml).not.toContain("Request Contact");

    const acceptedHtml = renderToStaticMarkup(
      React.createElement(ContactSellerAction, {
        listingId: "cm1abc1234567890",
        listingTitle: "Casio Calculator",
        formattedPrice: "₹850",
        listingStatus: "ACTIVE",
        sellerDisplayName: "Ananya Rao",
        sellerInitials: "AR",
        isAuthenticated: true,
        isOwner: false,
        initialRequest: makeClientContactRequest({
          status: "ACCEPTED",
          contactDisclosure: {
            canRevealContact: false,
            consentRecorded: false,
            status: "DEFERRED_CONSENT_SCHEMA_REQUIRED",
            message:
              "Seller accepted this request. Direct email/phone sharing remains disabled until an explicit consent-sharing schema migration is applied.",
          },
        }),
      })
    );
    expect(acceptedHtml).toContain("Request Accepted");
    expect(acceptedHtml).toContain("direct contact sharing is not yet available");
    expect(acceptedHtml).not.toContain("@example.com");

    const rejectedHtml = renderToStaticMarkup(
      React.createElement(ContactSellerAction, {
        listingId: "cm1abc1234567890",
        listingTitle: "Casio Calculator",
        formattedPrice: "₹850",
        listingStatus: "ACTIVE",
        sellerDisplayName: "Ananya Rao",
        sellerInitials: "AR",
        isAuthenticated: true,
        isOwner: false,
        initialRequest: makeClientContactRequest({
          status: "REJECTED",
          contactDisclosure: {
            canRevealContact: false,
            consentRecorded: false,
            status: "REQUEST_REJECTED",
            message: "This contact request was declined by the seller.",
          },
        }),
      })
    );
    expect(rejectedHtml).toContain("Request Declined");
    expect(rejectedHtml).toContain("declined by the seller");
    expect(rejectedHtml).not.toContain("Request Contact");
  });

  it("submits POST /api/listings/[id]/contact-requests and handles 201, 409, 429, 500, and ambiguous network errors", async () => {
    const createdDto = makeClientContactRequest();

    const fetchMock = vi
      .fn()
      // 1. 201 Created
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ contactRequest: createdDto }), {
          status: 201,
        })
      )
      // 2. 409 Duplicate / Conflict
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "Contact request already exists." }),
          { status: 409 }
        )
      )
      // 3. 429 Rate Limit with Retry-After header
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429,
          headers: { "Retry-After": "45" },
        })
      )
      // 4. 500 Sanitized Server Error
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "Internal stack trace secret" }),
          { status: 500 }
        )
      )
      // 5. Network failure (ambiguous)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      // 6. Recovery outgoing lookup finds existing request
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ contactRequests: [createdDto] }), {
          status: 200,
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    // 201 success
    const okRes = await submitContactRequest("cm1abc1234567890");
    expect(okRes.ok).toBe(true);
    if (okRes.ok) {
      expect(okRes.contactRequest.status).toBe("PENDING");
    }
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/listings/cm1abc1234567890/contact-requests",
      expect.objectContaining({
        method: "POST",
        body: "{}",
      })
    );

    // 409 duplicate
    const conflictRes = await submitContactRequest("cm1abc1234567890");
    expect(conflictRes.ok).toBe(false);
    if (!conflictRes.ok) {
      expect(conflictRes.status).toBe(409);
      expect(conflictRes.shouldRefreshState).toBe(true);
    }

    // 429 rate limit
    const rateRes = await submitContactRequest("cm1abc1234567890");
    expect(rateRes.ok).toBe(false);
    if (!rateRes.ok) {
      expect(rateRes.status).toBe(429);
      expect(rateRes.retryAfterSeconds).toBe(45);
      expect(rateRes.error).toContain("45 seconds");
    }

    // 500 sanitized
    const serverRes = await submitContactRequest("cm1abc1234567890");
    expect(serverRes.ok).toBe(false);
    if (!serverRes.ok) {
      expect(serverRes.status).toBe(500);
      expect(serverRes.error).not.toContain("Internal stack trace secret");
    }

    // Ambiguous network error + recovery check
    const netRes = await submitContactRequest("cm1abc1234567890");
    expect(netRes.ok).toBe(false);
    if (!netRes.ok) {
      expect(netRes.ambiguous).toBe(true);
    }

    const recovery = await recoverExistingBuyerContactRequest(
      "cm1abc1234567890"
    );
    expect(recovery.checked).toBe(true);
    expect(recovery.contactRequest?.id).toBe("req_1234567890");

    expect(formatContactRateLimitMessage(1)).toContain("1 second");
  });

  it("scopes getBuyerContactRequestForListing to buyer + listingId and filters out non-SALE/REMOVED rows", async () => {
    expect(await getBuyerContactRequestForListing("bad", "usr_buyer")).toBeNull();
    expect(
      await getBuyerContactRequestForListing("cm1abc1234567890", "   ")
    ).toBeNull();
    expect(prisma.contactRequest.findUnique).not.toHaveBeenCalled();

    vi.mocked(prisma.contactRequest.findUnique).mockResolvedValueOnce({
      id: "req_abc12345",
      listingId: "cm1abc1234567890",
      requesterId: "usr_buyer",
      status: "ACCEPTED",
      createdAt: new Date("2026-11-28T10:00:00.000Z"),
      updatedAt: new Date("2026-11-28T11:00:00.000Z"),
      requester: {
        id: "usr_buyer",
        name: "Rohan",
        image: null,
      },
      listing: {
        id: "cm1abc1234567890",
        userId: "usr_seller",
        title: "Casio Calculator",
        type: "SALE",
        category: "ELECTRONICS",
        condition: "GOOD",
        price: 850,
        location: "Main Gate",
        status: "ACTIVE",
        user: {
          id: "usr_seller",
          name: "Ananya",
          image: null,
        },
        images: [],
      },
    } as never);

    const dto = await getBuyerContactRequestForListing(
      "cm1abc1234567890",
      "usr_buyer"
    );
    expect(dto).not.toBeNull();
    expect(dto?.status).toBe("ACCEPTED");
    expect(dto?.contactDisclosure.canRevealContact).toBe(false);
    expect(prisma.contactRequest.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          listingId_requesterId: {
            listingId: "cm1abc1234567890",
            requesterId: "usr_buyer",
          },
        },
      })
    );
  });
});
