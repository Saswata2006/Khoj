import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// Mocks (Vitest Node SSR + mocked Prisma & authorization; NOT a live browser E2E run)
// ---------------------------------------------------------------------------

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({
    push: pushMock,
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
  default: (props: { src: string; alt: string; className?: string }) =>
    React.createElement("img", {
      src: props.src,
      alt: props.alt,
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

vi.mock("@/lib/auth-client", () => ({
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  getSession: vi.fn().mockResolvedValue(null),
  signOut: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authorization";
import {
  applyMarketplaceFilterPatch,
  buildMarketplaceHref,
  buildPaginationPageItems,
  clearAllMarketplaceFilters,
  countAppliedPanelFilters,
  countTotalAppliedFilters,
  DEFAULT_MARKETPLACE_FILTER_STATE,
  getAppliedFilterChips,
  parseMarketplaceSearchParams,
  removeIndividualMarketplaceFilter,
  serializeMarketplaceSearchParams,
  validateKeywordFilterInput,
  validateLocationFilterInput,
  validatePriceFilterInputs,
} from "@/lib/marketplace-search";
import { FOOTER_NAV_SECTIONS } from "@/constants/navigation";
import { MarketplaceActiveFilters } from "@/components/marketplace/MarketplaceActiveFilters";
import { MarketplaceCatalogClient } from "@/components/marketplace/MarketplaceCatalogClient";
import { MarketplaceFilterPanel } from "@/components/marketplace/MarketplaceFilterPanel";
import { MarketplacePagination } from "@/components/marketplace/MarketplacePagination";
import { MarketplaceSearchBar } from "@/components/marketplace/MarketplaceSearchBar";
import { MarketplaceSortSelect } from "@/components/marketplace/MarketplaceSortSelect";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import MarketplacePage from "@/app/marketplace/page";

function makeDbListingRow(overrides?: Record<string, unknown>) {
  const now = new Date("2026-11-28T10:00:00.000Z");
  return {
    id: "cm1searchui000001",
    title: "Casio fx-991EX Scientific Calculator",
    description: "Good condition engineering calculator.",
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

function makeClientListing(overrides?: Record<string, unknown>) {
  const now = "2026-11-28T10:00:00.000Z";
  return {
    id: "cm1searchui000001",
    title: "Casio fx-991EX Scientific Calculator",
    description: "Good condition engineering calculator.",
    type: "SALE" as const,
    category: "ELECTRONICS",
    condition: "LIKE_NEW",
    price: 850,
    location: "North Campus Library",
    status: "ACTIVE" as const,
    createdAt: now,
    updatedAt: now,
    images: [],
    ...overrides,
  };
}

async function renderServerMarketplacePage(
  searchParams: Record<string, string | string[] | undefined>
): Promise<string> {
  const pageEl = MarketplacePage({
    searchParams: Promise.resolve(searchParams),
  });
  const child = pageEl.props.children as React.ReactElement;
  const ChildComponent = child.type as (
    props: unknown
  ) => Promise<React.ReactElement>;
  const resolved = await ChildComponent(child.props);
  return renderToStaticMarkup(resolved);
}

// ---------------------------------------------------------------------------
// 1. Search Validation, URL Serialization & Filter State Transitions
// ---------------------------------------------------------------------------

describe("Marketplace search URL state & validation helpers", () => {
  it("serializes and parses query state while omitting empty and default parameters", () => {
    expect(buildMarketplaceHref(DEFAULT_MARKETPLACE_FILTER_STATE)).toBe(
      "/marketplace"
    );
    expect(
      serializeMarketplaceSearchParams({
        q: "  casio   calculator  ",
        category: "ELECTRONICS",
        condition: "LIKE_NEW",
        minPrice: "500.00",
        maxPrice: "1500.5",
        location: "  North   Campus  ",
        sort: "newest",
        page: 1,
      })
    ).toBe(
      "q=casio+calculator&category=ELECTRONICS&condition=LIKE_NEW&minPrice=500&maxPrice=1500.5&location=North+Campus"
    );

    const parsed = parseMarketplaceSearchParams(
      "?q=casio+calculator&category=ELECTRONICS&condition=LIKE_NEW&minPrice=500&maxPrice=1500.5&location=North+Campus&sort=price_asc&page=2"
    );
    expect(parsed.warnings).toEqual([]);
    expect(parsed.state).toEqual({
      q: "casio calculator",
      category: "ELECTRONICS",
      condition: "LIKE_NEW",
      minPrice: "500",
      maxPrice: "1500.5",
      location: "North Campus",
      sort: "price_asc",
      page: 2,
      limit: 12,
    });
    expect(parsed.backendQuery).toEqual({
      q: "casio calculator",
      category: "ELECTRONICS",
      condition: "LIKE_NEW",
      minPrice: 500,
      maxPrice: 1500.5,
      location: "North Campus",
      sort: "price_asc",
      page: 2,
      limit: 12,
    });
  });

  it("validates keyword, location, and min/max price filters before applying", () => {
    expect(validateKeywordFilterInput("valid keyword")).toBeNull();
    expect(validateKeywordFilterInput("bad\u0000text")).toContain(
      "control characters"
    );
    expect(validateKeywordFilterInput("x".repeat(101))).toContain("100");

    expect(validateLocationFilterInput("Hostel 4")).toBeNull();
    expect(validateLocationFilterInput("bad\u0007loc")).toContain(
      "control characters"
    );

    expect(validatePriceFilterInputs("-10", "")).toMatchObject({
      valid: false,
      minError: "Minimum price cannot be negative.",
    });
    expect(validatePriceFilterInputs("100abc", "")).toMatchObject({
      valid: false,
      minError: "Minimum price must be a valid number.",
    });
    expect(validatePriceFilterInputs("99.999", "")).toMatchObject({
      valid: false,
      minError: "Minimum price can have at most 2 decimal places.",
    });
    expect(validatePriceFilterInputs("1500", "500")).toMatchObject({
      valid: false,
      rangeError: "Maximum price must be greater than or equal to minimum price.",
    });
    expect(validatePriceFilterInputs("500", "500")).toEqual({
      valid: true,
      minPrice: 500,
      maxPrice: 500,
    });
  });

  it("resets pagination to page 1 on filter or sort changes, and supports individual removal and clear all", () => {
    const pagedState = {
      ...DEFAULT_MARKETPLACE_FILTER_STATE,
      q: "desk",
      category: "OTHER" as const,
      condition: "GOOD" as const,
      minPrice: "200",
      maxPrice: "1500",
      location: "Main Gate",
      sort: "price_desc" as const,
      page: 4,
    };

    // Changing search/filter/sort resets page to 1 while keeping other filters
    const updatedSearch = applyMarketplaceFilterPatch(pagedState, {
      q: "lamp",
    });
    expect(updatedSearch.page).toBe(1);
    expect(updatedSearch.category).toBe("OTHER");
    expect(updatedSearch.sort).toBe("price_desc");

    const updatedSort = applyMarketplaceFilterPatch(pagedState, {
      sort: "oldest",
    });
    expect(updatedSort.page).toBe(1);
    expect(updatedSort.q).toBe("desk");

    // Individual filter removal resets page cleanly
    const removedCategory = removeIndividualMarketplaceFilter(
      pagedState,
      "category"
    );
    expect(removedCategory.category).toBe("");
    expect(removedCategory.q).toBe("desk");
    expect(removedCategory.page).toBe(1);

    // Chip labels & counts
    expect(countAppliedPanelFilters(pagedState)).toBe(5);
    expect(countTotalAppliedFilters(pagedState)).toBe(6);
    expect(getAppliedFilterChips(pagedState).map((c) => c.key)).toEqual([
      "q",
      "category",
      "condition",
      "minPrice",
      "maxPrice",
      "location",
    ]);

    // Clear all filters returns to clean defaults
    expect(clearAllMarketplaceFilters(pagedState)).toEqual(
      DEFAULT_MARKETPLACE_FILTER_STATE
    );
  });

  it("handles unknown, legacy search=, duplicate, malformed, and inverted URL params gracefully", () => {
    const parsed = parseMarketplaceSearchParams({
      search: "legacy-param",
      isNegotiable: "true",
      category: ["BOOKS", "CYCLES"],
      condition: "BROKEN",
      minPrice: "1200",
      maxPrice: "300",
      sort: "popular",
      page: "-2",
      limit: "999",
      q: "calculator",
    });

    // Legacy `search` param is ignored and not forwarded to `q`
    expect(parsed.ignoredUnknownKeys).toEqual(["search", "isNegotiable"]);
    expect(parsed.state).toEqual({
      q: "calculator",
      category: "",
      condition: "",
      minPrice: "",
      maxPrice: "",
      location: "",
      sort: "newest",
      page: 1,
      limit: 12,
    });
    expect(parsed.warnings.length).toBeGreaterThanOrEqual(5);
    expect(parsed.backendQuery).toEqual({
      q: "calculator",
      sort: "newest",
      page: 1,
      limit: 12,
    });
  });

  it("builds bounded ellipsis pagination sequences accurately", () => {
    expect(buildPaginationPageItems(1, 1)).toEqual([]);
    expect(buildPaginationPageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPaginationPageItems(5, 12)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      12,
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. Responsive UI & Component Rendering Checks (Node SSR via renderToStaticMarkup)
// ---------------------------------------------------------------------------

describe("Marketplace search, filter, sort, and pagination UI rendering", () => {
  it("renders MarketplaceSearchBar with keyword value, clear action, and accessible search semantics", () => {
    const html = renderToStaticMarkup(
      React.createElement(MarketplaceSearchBar, {
        appliedQ: "calculator",
        appliedKey: "q=calculator",
        onSearchApply: () => {},
      })
    );

    expect(html).toContain('role="search"');
    expect(html).toContain('name="q"');
    expect(html).toContain('value="calculator"');
    expect(html).toContain("Clear search query");

    // Simulating URL transition back to cleared state updates rendered value immediately
    const restoredHtml = renderToStaticMarkup(
      React.createElement(MarketplaceSearchBar, {
        appliedQ: "",
        appliedKey: "",
        onSearchApply: () => {},
      })
    );
    expect(restoredHtml).toContain('value=""');
    expect(restoredHtml).not.toContain("Clear search query");
  });

  it("renders MarketplaceSortSelect with all four server sort modes", () => {
    const html = renderToStaticMarkup(
      React.createElement(MarketplaceSortSelect, {
        value: "price_asc",
        onChange: () => {},
      })
    );

    expect(html).toContain('value="newest"');
    expect(html).toContain("Newest first");
    expect(html).toContain('value="oldest"');
    expect(html).toContain("Oldest first");
    expect(html).toContain('value="price_asc"');
    expect(html).toContain("Price: Low to High");
    expect(html).toContain('value="price_desc"');
    expect(html).toContain("Price: High to Low");
  });

  it("renders desktop sidebar and mobile filter panel controls, active chips, and preserves filters across pagination", () => {
    const activeState = {
      ...DEFAULT_MARKETPLACE_FILTER_STATE,
      q: "calculator",
      category: "ELECTRONICS" as const,
      condition: "LIKE_NEW" as const,
      minPrice: "500",
      maxPrice: "1500",
      location: "North Campus",
      sort: "price_desc" as const,
      page: 2,
    };

    const desktopPanelHtml = renderToStaticMarkup(
      React.createElement(MarketplaceFilterPanel, {
        mode: "desktop",
        appliedState: activeState,
        appliedKey: serializeMarketplaceSearchParams(activeState),
        onApplyPatch: () => {},
        onClearAll: () => {},
      })
    );
    expect(desktopPanelHtml).toContain("Books &amp; Study Material");
    expect(desktopPanelHtml).toContain("Electronics &amp; Gadgets");
    expect(desktopPanelHtml).toContain("Brand New");
    expect(desktopPanelHtml).toContain("Apply Price &amp; Location");
    expect(desktopPanelHtml).toContain("Clear All Filters");
    expect(desktopPanelHtml).not.toContain("Negotiable");

    const mobilePanelHtml = renderToStaticMarkup(
      React.createElement(MarketplaceFilterPanel, {
        mode: "mobile",
        appliedState: activeState,
        appliedKey: serializeMarketplaceSearchParams(activeState),
        onApplyPatch: () => {},
        onClearAll: () => {},
      })
    );
    expect(mobilePanelHtml).toContain("Apply Filters");
    expect(mobilePanelHtml).toContain("Clear All Filters");

    const chipsHtml = renderToStaticMarkup(
      React.createElement(MarketplaceActiveFilters, {
        state: activeState,
        onRemoveFilter: () => {},
        onClearAll: () => {},
      })
    );
    expect(chipsHtml).toContain("Active filters (6):");
    expect(chipsHtml).toContain("Clear all filters");
    expect(chipsHtml).toContain("Remove Search filter");
    expect(chipsHtml).toContain("Remove Category filter");

    const paginationHtml = renderToStaticMarkup(
      React.createElement(MarketplacePagination, {
        state: activeState,
        pagination: {
          page: 2,
          limit: 12,
          total: 30,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      })
    );
    expect(paginationHtml).toContain("q=calculator");
    expect(paginationHtml).toContain("category=ELECTRONICS");
    expect(paginationHtml).toContain("sort=price_desc");
    expect(paginationHtml).toContain("page=3");
  });

  it("renders responsive desktop sidebar + mobile Filters button badge count + out-of-range recovery in MarketplaceCatalogClient", () => {
    const filteredState = {
      ...DEFAULT_MARKETPLACE_FILTER_STATE,
      category: "BOOKS" as const,
      minPrice: "100",
      page: 5,
    };

    const html = renderToStaticMarkup(
      React.createElement(MarketplaceCatalogClient, {
        appliedState: filteredState,
        appliedQueryString: serializeMarketplaceSearchParams(filteredState),
        listings: [],
        pagination: {
          page: 5,
          limit: 12,
          total: 18,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true,
        },
        loadError: null,
      })
    );

    expect(html).toContain('aria-label="Desktop marketplace filters"');
    expect(html).toContain("Filters");
    expect(html).toContain("2 active");
    expect(html).toContain("No listings on this page");
    expect(html).toContain("Back to Page 1");
    expect(html).toContain("Go to Page 2");
    expect(html).toContain("/marketplace?category=BOOKS&amp;minPrice=100");
    expect(html).toContain(
      "/marketplace?category=BOOKS&amp;minPrice=100&amp;page=2"
    );
  });

  it("renders no-results state when filters match zero listings cleanly", () => {
    const state = {
      ...DEFAULT_MARKETPLACE_FILTER_STATE,
      q: "unobtainium",
    };

    const html = renderToStaticMarkup(
      React.createElement(MarketplaceCatalogClient, {
        appliedState: state,
        appliedQueryString: serializeMarketplaceSearchParams(state),
        listings: [],
        pagination: {
          page: 1,
          limit: 12,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        loadError: null,
      })
    );

    expect(html).toContain("No matching listings found");
    expect(html).toContain("Clear Filters");
    expect(html).toContain("0 matching listings");
  });
});

// ---------------------------------------------------------------------------
// 3. Server Page Integration & Footer Category Links (Mocked Prisma)
// ---------------------------------------------------------------------------

describe("/marketplace Server Page search & navigation integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes q, filters, sort, and page from URL searchParams to backend service while keeping SALE + ACTIVE isolation", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([
      makeDbListingRow(),
    ] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(15);

    const html = await renderServerMarketplacePage({
      q: "calculator",
      category: "ELECTRONICS",
      condition: "LIKE_NEW",
      minPrice: "500",
      maxPrice: "1500",
      location: "North Campus",
      sort: "price_asc",
      page: "1",
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
          price: { gte: "500.00", lte: "1500.00" },
        },
        orderBy: [{ price: "asc" }, { createdAt: "desc" }, { id: "desc" }],
      })
    );

    expect(html).toContain("Showing 1–1 of 15 results");
    expect(html).toContain("Next");
    expect(html).toContain("q=calculator");
    expect(html).toContain("sort=price_asc");
    expect(html).toContain("page=2");
  });

  it("handles malformed or unknown URL parameters on /marketplace without crashing and renders clean warning notice", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    vi.mocked(prisma.listing.findMany).mockResolvedValueOnce([
      makeDbListingRow(),
    ] as never);
    vi.mocked(prisma.listing.count).mockResolvedValueOnce(1);

    const html = await renderServerMarketplacePage({
      search: "legacy",
      isNegotiable: "true",
      category: "INVALID_CAT",
      minPrice: "2000",
      maxPrice: "100",
    });

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: "SALE", status: "ACTIVE" },
      })
    );
    expect(html).toContain("Some invalid URL parameters were ignored");
    expect(html).toContain("Clean URL");
    expect(html).toContain("Casio fx-991EX Scientific Calculator");
  });

  it("links Footer category shortcuts directly to /marketplace?category=... and preserves landing CTAs", () => {
    const categorySection = FOOTER_NAV_SECTIONS.find(
      (section) => section.title === "Categories"
    );
    expect(categorySection).toBeDefined();
    expect(
      categorySection?.links.every(
        (link) =>
          link.disabled === false && link.href.startsWith("/marketplace?category=")
      )
    ).toBe(true);

    const footerHtml = renderToStaticMarkup(React.createElement(Footer));
    expect(footerHtml).toContain('href="/marketplace?category=BOOKS"');
    expect(footerHtml).toContain('href="/marketplace?category=ELECTRONICS"');
    expect(footerHtml).not.toContain('href="/#marketplace"');

    const heroHtml = renderToStaticMarkup(React.createElement(HeroSection));
    expect(heroHtml).toContain('href="/marketplace"');
    expect(heroHtml).toContain('href="/login"');

    const featuresHtml = renderToStaticMarkup(
      React.createElement(FeaturesSection)
    );
    expect(featuresHtml).toContain('href="/marketplace"');
    expect(featuresHtml).toContain('href="/marketplace/create"');
    expect(makeClientListing().type).toBe("SALE");
  });
});
