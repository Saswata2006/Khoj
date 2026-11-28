import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// Mocks (no live DB, no live emails, no Cloudinary uploads, no Next server)
// ---------------------------------------------------------------------------

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  notFound: () => notFoundMock(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
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

vi.mock("next/image", () => ({
  default: (props: {
    src: string;
    alt: string;
    sizes?: string;
    loading?: string;
    fetchPriority?: string;
    className?: string;
  }) =>
    React.createElement("img", {
      src: props.src,
      alt: props.alt,
      "data-sizes": props.sizes,
      loading: props.loading,
      "data-fetch-priority": props.fetchPriority,
      className: props.className,
    }),
}));

vi.mock("server-only", () => ({}));

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

vi.mock("@/lib/prisma", () => ({
  default: {
    listing: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    claim: { count: vi.fn() },
    contactRequest: { count: vi.fn() },
  },
  prisma: {
    listing: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    claim: { count: vi.fn() },
    contactRequest: { count: vi.fn() },
  },
}));

vi.mock("@/lib/profile", async () => {
  const actual = await vi.importActual<typeof import("@/lib/profile")>(
    "@/lib/profile"
  );
  return {
    ...actual,
    getDashboardSummary: vi.fn(),
  };
});

vi.mock("@/lib/auth-client", () => ({
  sendOtp: vi.fn().mockResolvedValue({ success: true }),
  verifyOtp: vi.fn().mockResolvedValue({ success: true }),
  getSession: vi.fn().mockResolvedValue(null),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authorization";
import { getDashboardSummary } from "@/lib/profile";
import {
  applyMyListingsMutation,
  archiveListingRequest,
  buildMyListingsHref,
  createListingRequest,
  formatMarketplacePrice,
  isAllowedCloudinaryImageUrl,
  markListingSoldRequest,
  parseMyListingsStatusParam,
  parsePendingListingRecoveryRaw,
  parsePositivePageParam,
  PENDING_LISTING_RECOVERY_TTL_MS,
  type MarketplaceListingClientDTO,
} from "@/lib/marketplace-ui";
import { MarketplaceImage } from "@/components/marketplace/MarketplaceImage";
import { MarketplaceListingCard } from "@/components/marketplace/MarketplaceListingCard";
import { ListingGallery } from "@/components/marketplace/ListingGallery";
import { MyListingsManager } from "@/components/marketplace/MyListingsManager";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { EditListingForm } from "@/components/marketplace/EditListingForm";
import MarketplacePage from "@/app/marketplace/page";
import ListingDetailPage from "@/app/marketplace/[id]/page";
import ListingNotFound from "@/app/marketplace/[id]/not-found";
import MyListingsPage from "@/app/dashboard/listings/page";
import DashboardPage from "@/app/dashboard/page";

// ---------------------------------------------------------------------------
// Fixtures & Test Helpers
// ---------------------------------------------------------------------------

const VALID_CLOUDINARY_URL =
  "https://res.cloudinary.com/khojcloud/image/upload/v1732761000/khoj/development/listings/cm1abc1234567890/img_1.webp";
const VALID_CLOUDINARY_URL_2 =
  "https://res.cloudinary.com/khojcloud/image/upload/v1732761001/khoj/development/listings/cm1abc1234567890/img_2.jpg";

function makeSessionUser(overrides?: {
  id?: string;
  name?: string;
  email?: string;
  role?: string | null;
}) {
  const now = new Date("2026-11-28T00:00:00.000Z");
  return {
    id: overrides?.id ?? "usr_seller_1",
    name: overrides?.name ?? "Ananya Rao",
    email: overrides?.email ?? "ananya.private@example.com",
    emailVerified: true,
    role: overrides?.role ?? "USER",
    image: null,
    location: null,
    hostelBlock: "Secret Hostel 9",
    createdAt: now,
    updatedAt: now,
  };
}

function makeDbListingRow(overrides?: Record<string, unknown>) {
  const now = new Date("2026-11-28T00:00:00.000Z");
  return {
    id: "cm1abc1234567890",
    title: "Casio fx-991EX Scientific Calculator",
    description:
      "Well maintained scientific calculator with protective case and manual.",
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
      name: "Ananya Rao",
      image: null,
    },
    images: [
      {
        id: "cm1img_1",
        imageUrl: VALID_CLOUDINARY_URL,
        createdAt: now,
      },
    ],
    ...overrides,
  };
}

function makeClientListing(
  overrides?: Partial<MarketplaceListingClientDTO>
): MarketplaceListingClientDTO {
  const now = "2026-11-28T00:00:00.000Z";
  return {
    id: "cm1abc1234567890",
    title: "Casio fx-991EX Scientific Calculator",
    description: "Well maintained scientific calculator.",
    type: "SALE",
    category: "ELECTRONICS",
    condition: "LIKE_NEW",
    price: 850,
    location: "North Campus Library",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    images: [
      {
        id: "cm1img_1",
        imageUrl: VALID_CLOUDINARY_URL,
        createdAt: now,
      },
    ],
    ...overrides,
  };
}

async function renderServerPageInner(
  pageElement: React.ReactElement
): Promise<string> {
  const props = pageElement.props as { children?: React.ReactElement };
  if (!props.children) {
    throw new Error("Expected Suspense child element");
  }
  const child = props.children;
  const ChildComponent = child.type as (
    p: unknown
  ) => Promise<React.ReactElement>;
  const resolved = await ChildComponent(child.props);
  return renderToStaticMarkup(resolved);
}

// ---------------------------------------------------------------------------
// 1. Price Formatting & Cloudinary Image Validation / Fallbacks
// ---------------------------------------------------------------------------

describe("Marketplace formatting & Cloudinary image rendering", () => {
  it("formats INR prices accurately including whole and fractional rupee values", () => {
    expect(formatMarketplacePrice(850)).toContain("₹");
    expect(formatMarketplacePrice(850)).toContain("850");
    expect(formatMarketplacePrice(125000)).toContain("1,25,000");
    expect(formatMarketplacePrice("850.5")).toContain("850.50");
    expect(formatMarketplacePrice(null)).toBe("Price unavailable");
    expect(formatMarketplacePrice(0)).toBe("Price unavailable");
    expect(formatMarketplacePrice("invalid")).toBe("Price unavailable");
  });

  it("allows only intended Khoj Cloudinary URLs and blocks external/unmatched hosts", () => {
    expect(isAllowedCloudinaryImageUrl(VALID_CLOUDINARY_URL)).toBe(true);
    expect(
      isAllowedCloudinaryImageUrl(
        "https://res.cloudinary.com/demo/image/upload/khoj/production/listings/cm1/a.jpg"
      )
    ).toBe(true);

    expect(
      isAllowedCloudinaryImageUrl(
        "http://res.cloudinary.com/demo/image/upload/v1/khoj/dev/a.jpg"
      )
    ).toBe(false);
    expect(
      isAllowedCloudinaryImageUrl("https://evil.example.com/payload.jpg")
    ).toBe(false);
    expect(
      isAllowedCloudinaryImageUrl(
        "https://res.cloudinary.com/demo/image/upload/v1/other-app/a.jpg"
      )
    ).toBe(false);
    expect(
      isAllowedCloudinaryImageUrl(`${VALID_CLOUDINARY_URL}?token=secret`)
    ).toBe(false);
  });

  it("renders optimized lazy <Image> for valid Cloudinary URL and placeholder on missing/invalid URL", () => {
    const validHtml = renderToStaticMarkup(
      React.createElement(MarketplaceImage, {
        src: VALID_CLOUDINARY_URL,
        alt: "Calculator photo",
        sizes: "(max-width: 640px) 100vw, 33vw",
      })
    );
    expect(validHtml).toContain(`src="${VALID_CLOUDINARY_URL}"`);
    expect(validHtml).toContain('loading="lazy"');

    const fallbackHtml = renderToStaticMarkup(
      React.createElement(MarketplaceImage, {
        src: "https://untrusted.example.com/bad.jpg",
        alt: "Fallback item",
        sizes: "100vw",
      })
    );
    expect(fallbackHtml).toContain("No photo available");
    expect(fallbackHtml).not.toContain("untrusted.example.com");
  });

  it("renders MarketplaceListingCard with price, category, condition, location, status, and fallback placeholder", () => {
    const htmlWithPhoto = renderToStaticMarkup(
      React.createElement(MarketplaceListingCard, {
        listing: makeClientListing({ price: 1450 }),
      })
    );
    expect(htmlWithPhoto).toContain('href="/marketplace/cm1abc1234567890"');
    expect(htmlWithPhoto).toContain("Casio fx-991EX Scientific Calculator");
    expect(htmlWithPhoto).toContain("1,450");
    expect(htmlWithPhoto).toContain("Electronics &amp; Gadgets");
    expect(htmlWithPhoto).toContain("Like New");
    expect(htmlWithPhoto).toContain("North Campus Library");
    expect(htmlWithPhoto).toContain("Available");

    const htmlNoPhoto = renderToStaticMarkup(
      React.createElement(MarketplaceListingCard, {
        listing: makeClientListing({ images: [], status: "SOLD" }),
      })
    );
    expect(htmlNoPhoto).toContain("No photo available");
    expect(htmlNoPhoto).toContain("Sold");
  });
});

// ---------------------------------------------------------------------------
// 2. Public Marketplace Page (/marketplace) & Bounded Pagination
// ---------------------------------------------------------------------------

describe("Public /marketplace page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses page parameters safely inside bounded limits", () => {
    expect(parsePositivePageParam(undefined)).toBe(1);
    expect(parsePositivePageParam("abc")).toBe(1);
    expect(parsePositivePageParam("-4")).toBe(1);
    expect(parsePositivePageParam("3")).toBe(3);
    expect(parsePositivePageParam("50000")).toBe(1000);
  });

  it("renders publicly without authentication using ACTIVE SALE listings only", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([
      makeDbListingRow(),
    ] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(1);

    const html = await renderServerPageInner(
      MarketplacePage({ searchParams: Promise.resolve({}) })
    );

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: "SALE", status: "ACTIVE" },
      })
    );
    expect(html).toContain("Browse Marketplace");
    expect(html).toContain('href="/marketplace/create"');
    expect(html).toContain("Sell an Item");
    expect(html).toContain("Casio fx-991EX Scientific Calculator");
    expect(html).toContain("850");
    expect(html).not.toContain("ananya.private@example.com");
  });

  it("renders pagination controls when multiple pages exist", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([
      makeDbListingRow(),
    ] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(28);

    const html = await renderServerPageInner(
      MarketplacePage({ searchParams: Promise.resolve({ page: "2" }) })
    );

    expect(html).toContain("Page");
    expect(html).toContain("2");
    expect(html).toContain("3");
    expect(html).toContain('href="/marketplace"');
    expect(html).toContain('href="/marketplace?page=3"');
  });

  it("renders clear empty state and sanitized error state", async () => {
    // Empty state
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(0);

    const emptyHtml = await renderServerPageInner(
      MarketplacePage({ searchParams: Promise.resolve({}) })
    );
    expect(emptyHtml).toContain("No active listings yet");
    expect(emptyHtml).toContain('href="/marketplace/create"');

    // Sanitized DB failure state
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    vi.mocked(prisma.listing.findMany).mockRejectedValueOnce(
      new Error("postgresql://secret:pass@db.internal:5432 failed")
    );

    const errorHtml = await renderServerPageInner(
      MarketplacePage({ searchParams: Promise.resolve({}) })
    );
    expect(errorHtml).toContain("Failed to load listings");
    expect(errorHtml).not.toContain("secret:pass");
    expect(errorHtml).not.toContain("db.internal");
  });
});

// ---------------------------------------------------------------------------
// 3. Public Product Details Page (/marketplace/[id]) & Seller Privacy
// ---------------------------------------------------------------------------

describe("Public /marketplace/[id] page & gallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound() for malformed, missing, non-marketplace, or REMOVED listings", async () => {
    // Invalid ID
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    await expect(
      renderServerPageInner(
        ListingDetailPage({
          params: Promise.resolve({ id: "bad" }),
        })
      )
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prisma.listing.findFirst).not.toHaveBeenCalled();

    // Missing / REMOVED (service query enforces type: SALE, status: { not: REMOVED })
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    vi.mocked(prisma.listing.findFirst).mockResolvedValueOnce(null);

    await expect(
      renderServerPageInner(
        ListingDetailPage({
          params: Promise.resolve({ id: "cm1removed123456" }),
        })
      )
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(prisma.listing.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "cm1removed123456",
          type: "SALE",
          status: { not: "REMOVED" },
        },
      })
    );

    const notFoundHtml = renderToStaticMarkup(
      React.createElement(ListingNotFound)
    );
    expect(notFoundHtml).toContain("Listing Not Found");
    expect(notFoundHtml).toContain('href="/marketplace"');
  });

  it("renders public details, gallery, seller initials without private fields, and sign-in Contact Seller link for guests", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    vi.mocked(prisma.listing.findFirst).mockResolvedValueOnce(
      makeDbListingRow({
        images: [
          {
            id: "img_1",
            imageUrl: VALID_CLOUDINARY_URL,
            createdAt: new Date(),
          },
          {
            id: "img_2",
            imageUrl: VALID_CLOUDINARY_URL_2,
            createdAt: new Date(),
          },
        ],
      }) as never
    );

    const html = await renderServerPageInner(
      ListingDetailPage({
        params: Promise.resolve({ id: "cm1abc1234567890" }),
      })
    );

    expect(html).toContain('href="/marketplace"');
    expect(html).toContain("Back to Marketplace");
    expect(html).toContain("Casio fx-991EX Scientific Calculator");
    expect(html).toContain("850");
    expect(html).toContain("Available");
    expect(html).toContain("North Campus Library");
    expect(html).toContain("Ananya Rao");
    expect(html).toContain("AR");
    expect(html).toContain("Sign in to contact seller");
    expect(html).toContain(
      'href="/login?redirectTo=%2Fmarketplace%2Fcm1abc1234567890"'
    );
    expect(html).toContain("View photo 2 of 2");
    expect(html).not.toContain('href="/marketplace/cm1abc1234567890/edit"');
    // Privacy guards: private fields never appear
    expect(html).not.toContain("ananya.private@example.com");
    expect(html).not.toContain("Secret Hostel 9");
  });

  it("renders Edit Listing button only for authenticated owner when ACTIVE, and locks SOLD view", async () => {
    // Owner + ACTIVE
    vi.mocked(getCurrentUser).mockResolvedValueOnce(
      makeSessionUser({ id: "usr_seller_1" })
    );
    vi.mocked(prisma.listing.findFirst).mockResolvedValueOnce(
      makeDbListingRow({ status: "ACTIVE" }) as never
    );

    const ownerActiveHtml = await renderServerPageInner(
      ListingDetailPage({
        params: Promise.resolve({ id: "cm1abc1234567890" }),
        searchParams: Promise.resolve({ created: "1" }),
      })
    );
    expect(ownerActiveHtml).toContain("Your listing has been published");
    expect(ownerActiveHtml).toContain(
      'href="/marketplace/cm1abc1234567890/edit"'
    );
    expect(ownerActiveHtml).toContain("Edit Listing");
    expect(ownerActiveHtml).not.toContain("Sign in to contact seller");
    expect(ownerActiveHtml).not.toContain("Request Contact");

    // Visitor viewing SOLD listing
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    vi.mocked(prisma.listing.findFirst).mockResolvedValueOnce(
      makeDbListingRow({ status: "SOLD" }) as never
    );

    const soldHtml = await renderServerPageInner(
      ListingDetailPage({
        params: Promise.resolve({ id: "cm1abc1234567890" }),
      })
    );
    expect(soldHtml).toContain("This item has been sold");
    expect(soldHtml).toContain("Sold — Unavailable");
    expect(soldHtml).toContain("Sold — Item No Longer Available");
    expect(soldHtml).not.toContain(">Available<");

    // Owner viewing SOLD listing still sees NO Edit Listing link
    vi.mocked(getCurrentUser).mockResolvedValueOnce(
      makeSessionUser({ id: "usr_seller_1" })
    );
    vi.mocked(prisma.listing.findFirst).mockResolvedValueOnce(
      makeDbListingRow({ status: "SOLD" }) as never
    );

    const ownerSoldHtml = await renderServerPageInner(
      ListingDetailPage({
        params: Promise.resolve({ id: "cm1abc1234567890" }),
      })
    );
    expect(ownerSoldHtml).not.toContain(
      'href="/marketplace/cm1abc1234567890/edit"'
    );
  });

  it("renders ListingGallery empty placeholder cleanly when no photos exist", () => {
    const html = renderToStaticMarkup(
      React.createElement(ListingGallery, {
        title: "Desk Chair",
        images: [],
      })
    );
    expect(html).toContain("No photos uploaded for this listing");
  });
});

// ---------------------------------------------------------------------------
// 4. Protected My Listings Page (/dashboard/listings) & Owner Mutations
// ---------------------------------------------------------------------------

describe("Protected /dashboard/listings page & status management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates owner status filter params and builds filter URLs safely", () => {
    expect(parseMyListingsStatusParam(undefined)).toBeUndefined();
    expect(parseMyListingsStatusParam("active")).toBe("ACTIVE");
    expect(parseMyListingsStatusParam("SOLD")).toBe("SOLD");
    expect(parseMyListingsStatusParam("REMOVED")).toBe("REMOVED");
    expect(parseMyListingsStatusParam("RESOLVED")).toBeUndefined();
    expect(parseMyListingsStatusParam("UNKNOWN")).toBeUndefined();

    expect(buildMyListingsHref()).toBe("/dashboard/listings");
    expect(buildMyListingsHref({ status: "SOLD" })).toBe(
      "/dashboard/listings?status=SOLD"
    );
    expect(buildMyListingsHref({ status: "ACTIVE", page: 2 })).toBe(
      "/dashboard/listings?status=ACTIVE&page=2"
    );
  });

  it("redirects unauthenticated visitors to /login?redirectTo=/dashboard/listings before querying DB", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

    await expect(
      renderServerPageInner(
        MyListingsPage({ searchParams: Promise.resolve({}) })
      )
    ).rejects.toThrow("NEXT_REDIRECT:/login?redirectTo=/dashboard/listings");

    expect(prisma.listing.findMany).not.toHaveBeenCalled();
  });

  it("loads user-scoped listings and renders status-appropriate owner controls", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(
      makeSessionUser({ id: "usr_owner_9" })
    );
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([
      makeDbListingRow({ id: "cm1active_item_1", status: "ACTIVE" }),
      makeDbListingRow({ id: "cm1sold_item_2", status: "SOLD", title: "Sold Bike" }),
      makeDbListingRow({
        id: "cm1removed_item_3",
        status: "REMOVED",
        title: "Archived Desk",
      }),
    ] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(3);

    const html = await renderServerPageInner(
      MyListingsPage({ searchParams: Promise.resolve({}) })
    );

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "usr_owner_9", type: "SALE" },
      })
    );

    expect(html).toContain("My Marketplace Listings");
    expect(html).toContain('href="/marketplace/cm1active_item_1"');
    expect(html).toContain('href="/marketplace/cm1active_item_1/edit"');
    expect(html).toContain("Mark as Sold");
    expect(html).toContain("Remove");

    // SOLD listing allows View, disallows Edit
    expect(html).toContain('href="/marketplace/cm1sold_item_2"');
    expect(html).not.toContain('href="/marketplace/cm1sold_item_2/edit"');

    // REMOVED listing disallows public View and Edit
    expect(html).not.toContain('href="/marketplace/cm1removed_item_3"');
    expect(html).not.toContain('href="/marketplace/cm1removed_item_3/edit"');
  });

  it("renders empty and error states in MyListingsManager cleanly", () => {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(MyListingsManager, {
        initialListings: [],
        initialPagination: {
          page: 1,
          limit: 12,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        activeStatusFilter: "SOLD",
      })
    );
    expect(emptyHtml).toContain("No sold listings");
    expect(emptyHtml).toContain('href="/dashboard/listings"');
    expect(emptyHtml).toContain('href="/marketplace/create"');

    const errorHtml = renderToStaticMarkup(
      React.createElement(MyListingsManager, {
        initialListings: [],
        initialPagination: {
          page: 1,
          limit: 12,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        initialError: "Unable to load your marketplace listings right now.",
      })
    );
    expect(errorHtml).toContain(
      "Unable to load your marketplace listings right now."
    );
  });

  it("executes Mark as Sold and soft-delete Remove requests and updates filtered UI state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            listing: makeClientListing({
              id: "cm1active_item_1",
              status: "SOLD",
            }),
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "Listing has already been removed.",
          }),
          { status: 409 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            listing: makeClientListing({
              id: "cm1active_item_1",
              status: "REMOVED",
            }),
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const soldRes = await markListingSoldRequest("cm1active_item_1");
    expect(soldRes.ok).toBe(true);
    if (soldRes.ok) {
      expect(soldRes.listing.status).toBe("SOLD");
    }

    const activeRow = makeClientListing({
      id: "cm1active_item_1",
      status: "ACTIVE",
    });

    // Under "All" tab -> item updates in place
    expect(
      applyMyListingsMutation(
        [activeRow],
        { ...activeRow, status: "SOLD" },
        undefined
      )[0].status
    ).toBe("SOLD");

    // Under "ACTIVE" tab -> transitioned SOLD item leaves Active list cleanly
    expect(
      applyMyListingsMutation(
        [activeRow],
        { ...activeRow, status: "SOLD" },
        "ACTIVE"
      )
    ).toEqual([]);

    // Conflict error handling
    const conflictRemove = await archiveListingRequest("cm1active_item_1");
    expect(conflictRemove).toEqual({
      ok: false,
      status: 409,
      error: "Listing has already been removed.",
    });

    // Successful soft-delete archive
    const okRemove = await archiveListingRequest("cm1active_item_1");
    expect(okRemove.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/listings/cm1active_item_1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Updated Navigation Integration Across App Shell & Landing
// ---------------------------------------------------------------------------

describe("Marketplace navigation integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links Marketplace to /marketplace without Coming Soon badge in Navbar and Footer", () => {
    const guestNavHtml = renderToStaticMarkup(React.createElement(Navbar));
    expect(guestNavHtml).toContain('href="/marketplace"');
    expect(guestNavHtml).not.toContain('href="#marketplace"');
    expect(guestNavHtml).toContain("Lost &amp; Found");

    const authNavHtml = renderToStaticMarkup(
      React.createElement(Navbar, {
        initialUser: {
          id: "usr_1",
          name: "Aarav",
          email: "aarav@example.com",
          role: "USER",
        },
      })
    );
    expect(authNavHtml).toContain('href="/dashboard/listings"');
    expect(authNavHtml).toContain("My Listings");

    const footerHtml = renderToStaticMarkup(React.createElement(Footer));
    expect(footerHtml).toContain('href="/marketplace"');
    expect(footerHtml).toContain("Browse Marketplace");
    expect(footerHtml).toContain('href="/marketplace/create"');
  });

  it("updates Landing Hero, Features, and HowItWorks to link live Marketplace routes", () => {
    const heroHtml = renderToStaticMarkup(React.createElement(HeroSection));
    expect(heroHtml).toContain('href="/marketplace"');
    expect(heroHtml).toContain("Browse Marketplace");

    const featuresHtml = renderToStaticMarkup(
      React.createElement(FeaturesSection)
    );
    expect(featuresHtml).toContain("Live Now");
    expect(featuresHtml).toContain('href="/marketplace"');
    expect(featuresHtml).toContain('href="/marketplace/create"');
    // Lost & Found stays Coming Soon
    expect(featuresHtml).toContain("Coming Soon");

    const howHtml = renderToStaticMarkup(
      React.createElement(HowItWorksSection)
    );
    expect(howHtml).toContain("Browse or Post Items");
  });

  it("updates Dashboard shortcuts and EditListingForm cancel/return navigation", async () => {
    const now = new Date("2026-11-28T00:00:00.000Z");
    vi.mocked(getCurrentUser).mockResolvedValueOnce(makeSessionUser());
    vi.mocked(getDashboardSummary).mockResolvedValueOnce({
      profile: {
        id: "usr_1",
        name: "Riya Das",
        email: "riya@example.com",
        emailVerified: true,
        image: null,
        location: "North Campus",
        hostelBlock: null,
        role: "USER",
        createdAt: now,
        updatedAt: now,
      },
      completion: {
        isComplete: true,
        completedCount: 2,
        totalCount: 2,
        missingFields: [],
      },
      counts: {
        listings: 1,
        claims: 0,
        contactRequests: 0,
      },
    });

    const dashboardHtml = await renderServerPageInner(DashboardPage());
    expect(dashboardHtml).toContain('href="/marketplace"');
    expect(dashboardHtml).toContain('href="/marketplace/create"');
    expect(dashboardHtml).toContain('href="/dashboard/listings"');
    expect(dashboardHtml).toContain("Manage My Listings");

    const editHtml = renderToStaticMarkup(
      React.createElement(EditListingForm, {
        listing: makeClientListing(),
      })
    );
    expect(editHtml).toContain('href="/dashboard/listings"');
    expect(editHtml).toContain("Back to My Listings");
    expect(editHtml).toContain('href="/marketplace/cm1abc1234567890"');
    expect(editHtml).toContain("Cancel");
  });
});

// ---------------------------------------------------------------------------
// 6. Phase F Hardening: Account/Env Image Policy & Refresh/Network Recovery
// ---------------------------------------------------------------------------

describe("Phase F delivery policy & refresh recovery checks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enforces configured Cloudinary cloud account and environment isolation on image URLs", () => {
    const prodUrl =
      "https://res.cloudinary.com/khojprod/image/upload/v1732761000/khoj/production/listings/cm1abc1234567890/img_1.webp";

    expect(
      isAllowedCloudinaryImageUrl(prodUrl, {
        cloudName: "khojprod",
        environment: "production",
      })
    ).toBe(true);

    // Reject another Cloudinary tenant account
    expect(
      isAllowedCloudinaryImageUrl(
        "https://res.cloudinary.com/attacker-cloud/image/upload/v1/khoj/production/listings/cm1abc1234567890/img_1.webp",
        { cloudName: "khojprod", environment: "production" }
      )
    ).toBe(false);

    // Reject cross-environment URL (development asset rendered in production)
    expect(
      isAllowedCloudinaryImageUrl(VALID_CLOUDINARY_URL, {
        cloudName: "khojcloud",
        environment: "production",
      })
    ).toBe(false);

    // Reject URLs with credentials, fragments, or traversal segments
    expect(
      isAllowedCloudinaryImageUrl(
        "https://user:pass@res.cloudinary.com/khojprod/image/upload/v1/khoj/production/listings/cm1abc/img_1.webp"
      )
    ).toBe(false);
    expect(
      isAllowedCloudinaryImageUrl(
        "https://res.cloudinary.com/khojprod/image/upload/v1/khoj/production/listings/../secret/img_1.webp"
      )
    ).toBe(false);

    // MarketplaceImage falls back to placeholder when URL violates deliveryPolicy
    const blockedImgHtml = renderToStaticMarkup(
      React.createElement(MarketplaceImage, {
        src: VALID_CLOUDINARY_URL,
        alt: "Cross env test",
        sizes: "100vw",
        deliveryPolicy: { cloudName: "othercloud", environment: "production" },
      })
    );
    expect(blockedImgHtml).toContain("No photo available");
  });

  it("validates refresh-recovery drafts, rejects expired/tampered drafts, and flags ambiguous network failures", async () => {
    const baseNow = 1_700_000_000_000;
    const validRaw = JSON.stringify({
      listingId: "cm1recovered12345",
      title: "Recovered Lamp",
      values: {
        title: "Recovered Lamp",
        description: "Warm desk lamp in great condition.",
        category: "OTHER",
        condition: "GOOD",
        price: "350",
        location: "Main Gate",
      },
      snapshot: "{}",
      savedAtMs: baseNow - 5_000,
    });

    expect(parsePendingListingRecoveryRaw(validRaw, baseNow)?.listingId).toBe(
      "cm1recovered12345"
    );

    // Expired TTL
    expect(
      parsePendingListingRecoveryRaw(
        validRaw,
        baseNow + PENDING_LISTING_RECOVERY_TTL_MS + 1000
      )
    ).toBeNull();

    // Tampered / malformed listingId
    expect(
      parsePendingListingRecoveryRaw(
        JSON.stringify({
          listingId: "../etc",
          title: "Bad",
          values: { title: "Bad" },
          snapshot: "{}",
          savedAtMs: baseNow,
        }),
        baseNow
      )
    ).toBeNull();

    // Network/timeout failure returns ambiguous flag advising Check My Listings
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("ECONNRESET"))
    );

    const netFail = await createListingRequest({
      title: "Desk Chair",
      description: "Comfortable wooden study chair.",
      category: "OTHER",
      condition: "GOOD",
      price: 1200,
      location: "Hostel 1",
    });

    expect(netFail.ok).toBe(false);
    if (!netFail.ok) {
      expect(netFail.status).toBe(0);
      expect(netFail.isAmbiguousNetworkError).toBe(true);
      expect(netFail.error).toContain("My Listings");
    }
  });
});
