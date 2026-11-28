"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Plus,
  RotateCcw,
  SearchX,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import {
  CATEGORY_LIST,
} from "@/constants/categories";
import {
  applyMarketplaceFilterPatch,
  buildMarketplaceHref,
  clearAllMarketplaceFilters,
  countAppliedPanelFilters,
  countTotalAppliedFilters,
  removeIndividualMarketplaceFilter,
  serializeMarketplaceSearchParams,
  type AppliedFilterChip,
  type MarketplaceFilterState,
  type MarketplaceSortOption,
} from "@/lib/marketplace-search";
import type {
  CloudinaryDeliveryPolicy,
  MarketplaceListingCardDTO,
} from "@/lib/marketplace-ui";
import { MarketplaceActiveFilters } from "@/components/marketplace/MarketplaceActiveFilters";
import { MarketplaceFilterPanel } from "@/components/marketplace/MarketplaceFilterPanel";
import { MarketplaceListingCard } from "@/components/marketplace/MarketplaceListingCard";
import {
  MarketplacePagination,
  type MarketplacePaginationMeta,
} from "@/components/marketplace/MarketplacePagination";
import { MarketplaceSearchBar } from "@/components/marketplace/MarketplaceSearchBar";
import { MarketplaceSortSelect } from "@/components/marketplace/MarketplaceSortSelect";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface MarketplaceCatalogClientProps {
  appliedState: MarketplaceFilterState;
  appliedQueryString: string;
  listings: MarketplaceListingCardDTO[];
  pagination: MarketplacePaginationMeta | null;
  loadError: string | null;
  queryWarnings?: string[];
  deliveryPolicy?: CloudinaryDeliveryPolicy;
}

export function MarketplaceCatalogClient({
  appliedState,
  appliedQueryString,
  listings,
  pagination,
  loadError,
  queryWarnings = [],
  deliveryPolicy,
}: MarketplaceCatalogClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const panelFilterCount = countAppliedPanelFilters(appliedState);
  const totalFilterCount = countTotalAppliedFilters(appliedState);
  const hasAnyFilters = totalFilterCount > 0 || appliedState.sort !== "newest";
  const hasActiveFacetFilters = totalFilterCount > 0;

  const navigateWithState = (nextState: MarketplaceFilterState) => {
    const nextQuery = serializeMarketplaceSearchParams(nextState);
    if (nextQuery === appliedQueryString) {
      return;
    }

    const nextHref = buildMarketplaceHref(nextState);
    startTransition(() => {
      router.push(nextHref, { scroll: false });
    });
  };

  const handleSearchApply = (nextQ: string) => {
    navigateWithState(
      applyMarketplaceFilterPatch(appliedState, {
        q: nextQ,
        page: 1,
      })
    );
  };

  const handleApplyPatch = (patch: Partial<MarketplaceFilterState>) => {
    navigateWithState(applyMarketplaceFilterPatch(appliedState, patch));
  };

  const handleSortChange = (nextSort: MarketplaceSortOption) => {
    navigateWithState(
      applyMarketplaceFilterPatch(appliedState, {
        sort: nextSort,
        page: 1,
      })
    );
  };

  const handleRemoveFilter = (key: AppliedFilterChip["key"]) => {
    navigateWithState(removeIndividualMarketplaceFilter(appliedState, key));
  };

  const handleClearAll = () => {
    navigateWithState(clearAllMarketplaceFilters(appliedState));
  };

  const resultsRangeSummary = (() => {
    if (!pagination) return null;
    if (pagination.total === 0) {
      return "0 matching listings";
    }
    if (listings.length === 0) {
      return `${pagination.total} ${
        pagination.total === 1 ? "active item" : "active items"
      }`;
    }
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = start + listings.length - 1;
    return `Showing ${start}–${end} of ${pagination.total} ${
      pagination.total === 1 ? "result" : "results"
    }`;
  })();

  const isOutOfRangePage =
    !loadError &&
    pagination !== null &&
    listings.length === 0 &&
    pagination.total > 0 &&
    appliedState.page > pagination.totalPages;

  return (
    <div className="space-y-6">
      {/* Keyword Search & Instant Category Navigation Strip */}
      <section aria-label="Search marketplace" className="space-y-3">
        <MarketplaceSearchBar
          appliedQ={appliedState.q}
          appliedKey={appliedQueryString}
          isPending={isPending}
          onSearchApply={handleSearchApply}
        />

        <div
          aria-label="Quick category filters"
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          <button
            type="button"
            disabled={isPending}
            aria-pressed={appliedState.category === ""}
            onClick={() => handleApplyPatch({ category: "" })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]",
              appliedState.category === ""
                ? "border-[#10B981]/40 bg-[#10B981]/15 text-[#34D399]"
                : "border-[#27272A] bg-[#111113] text-[#A1A1AA] hover:border-[#3F3F46] hover:text-[#FAFAFA]"
            )}
          >
            All Categories
          </button>

          {CATEGORY_LIST.map((cat) => {
            const isSelected = appliedState.category === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                disabled={isPending}
                aria-pressed={isSelected}
                onClick={() => handleApplyPatch({ category: cat.value })}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]",
                  isSelected
                    ? "border-[#10B981]/40 bg-[#10B981]/15 text-[#34D399]"
                    : "border-[#27272A] bg-[#111113] text-[#A1A1AA] hover:border-[#3F3F46] hover:text-[#FAFAFA]"
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Query Parameter Sanitization Notice (malformed/unknown/inverted URL params) */}
      {queryWarnings.length > 0 && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-xs text-[#FCD34D]"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#F59E0B]" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-semibold text-[#FAFAFA]">Some invalid URL parameters were ignored</p>
              <p className="text-[#FDE68A]/90">{queryWarnings.join(" ")}</p>
            </div>
          </div>
          <Link
            href={buildMarketplaceHref(appliedState)}
            className={cn(
              buttonVariants({ variant: "outline", size: "xs" }),
              "shrink-0"
            )}
          >
            Clean URL
          </Link>
        </div>
      )}

      {/* Desktop Left Sidebar + Responsive Results Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:items-start">
        {/* Sticky Desktop Filter Sidebar */}
        <aside
          aria-label="Desktop marketplace filters"
          className="hidden lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto rounded-2xl border border-[#27272A] bg-[#111113] p-5 surface-specular"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal
                className="h-4 w-4 text-[#10B981]"
                aria-hidden="true"
              />
              <h2 className="font-heading text-sm font-semibold text-[#FAFAFA]">
                Filters
              </h2>
            </div>
            {panelFilterCount > 0 && (
              <Badge variant="accent" className="text-[11px] font-semibold">
                {panelFilterCount} active
              </Badge>
            )}
          </div>

          <MarketplaceFilterPanel
            mode="desktop"
            appliedState={appliedState}
            appliedKey={appliedQueryString}
            isPending={isPending}
            onApplyPatch={handleApplyPatch}
            onClearAll={handleClearAll}
          />
        </aside>

        {/* Results Column */}
        <div className="min-w-0 space-y-5">
          {/* Toolbar: Results Count + Mobile Filter Sheet Trigger + Sorting */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#27272A] bg-[#111113] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Mobile Filter Sheet Trigger */}
              <div className="lg:hidden">
                <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
                  <SheetTrigger
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "inline-flex items-center gap-1.5 text-xs font-semibold"
                    )}
                  >
                    <SlidersHorizontal
                      className="h-3.5 w-3.5 text-[#10B981]"
                      aria-hidden="true"
                    />
                    <span>Filters</span>
                    {panelFilterCount > 0 && (
                      <Badge variant="accent" className="ml-0.5 h-4 px-1.5 text-[10px]">
                        {panelFilterCount}
                      </Badge>
                    )}
                  </SheetTrigger>

                  <SheetContent side="left" className="overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Filter Marketplace</SheetTitle>
                      <SheetDescription>
                        Narrow active items by category, condition, price in
                        INR, or meetup location.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="p-4">
                      <MarketplaceFilterPanel
                        mode="mobile"
                        appliedState={appliedState}
                        appliedKey={appliedQueryString}
                        isPending={isPending}
                        onApplyPatch={handleApplyPatch}
                        onClearAll={handleClearAll}
                        onMobileDone={() => setMobileSheetOpen(false)}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              <p className="text-xs sm:text-sm font-medium text-[#A1A1AA]">
                {resultsRangeSummary ?? "Marketplace catalog"}
              </p>
            </div>

            <MarketplaceSortSelect
              value={appliedState.sort}
              disabled={isPending}
              onChange={handleSortChange}
            />
          </div>

          {/* Applied Filter Chips */}
          <MarketplaceActiveFilters
            state={appliedState}
            disabled={isPending}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAll}
          />

          {/* Sanitized Error State */}
          {loadError && (
            <div
              role="alert"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-6 text-sm text-[#FCA5A5]"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-[#EF4444]" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold text-[#FAFAFA]">Failed to load listings</p>
                  <p className="text-xs text-[#FCA5A5]">{loadError}</p>
                </div>
              </div>
              <Link
                href={buildMarketplaceHref(appliedState)}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "shrink-0"
                )}
              >
                Try Again
              </Link>
            </div>
          )}

          {/* Transition Loading Skeletons */}
          {!loadError && isPending && (
            <div
              role="status"
              aria-label="Loading marketplace search results"
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
            >
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-72 rounded-xl" />
              ))}
            </div>
          )}

          {/* Out-of-Range Page State (valid filters exist, page exceeds totalPages) */}
          {!isPending && isOutOfRangePage && pagination && (
            <section className="rounded-xl border border-dashed border-[#27272A] bg-[#111113] p-10 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-[#A1A1AA]">
                <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h2 className="font-heading text-lg font-semibold text-[#FAFAFA]">
                  No listings on this page
                </h2>
                <p className="text-sm text-[#A1A1AA]">
                  Page {appliedState.page} exceeds the {pagination.totalPages}{" "}
                  available{" "}
                  {pagination.totalPages === 1 ? "page" : "pages"} for the
                  current marketplace query.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={buildMarketplaceHref({ ...appliedState, page: 1 })}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Back to Page 1
                </Link>
                {pagination.totalPages > 1 && (
                  <Link
                    href={buildMarketplaceHref({
                      ...appliedState,
                      page: pagination.totalPages,
                    })}
                    className={buttonVariants({ variant: "accent", size: "sm" })}
                  >
                    Go to Page {pagination.totalPages}
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* No-Results State (Filters / Search Active -> 0 matches) */}
          {!isPending &&
            !loadError &&
            pagination &&
            listings.length === 0 &&
            pagination.total === 0 &&
            hasActiveFacetFilters && (
              <section className="rounded-xl border border-dashed border-[#27272A] bg-[#111113] p-10 text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-[#A1A1AA]">
                  <SearchX className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h2 className="font-heading text-lg font-semibold text-[#FAFAFA]">
                    No matching listings found
                  </h2>
                  <p className="text-sm text-[#A1A1AA]">
                    Try adjusting your search keywords, widening your price
                    range, or clearing one or more active filters.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>Clear Filters</span>
                  </Button>
                  <Link
                    href="/marketplace/create"
                    className={cn(
                      buttonVariants({ variant: "accent", size: "sm" }),
                      "inline-flex items-center gap-1.5"
                    )}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Sell an Item</span>
                  </Link>
                </div>
              </section>
            )}

          {/* Empty Marketplace State (No Filters Active -> 0 active items total) */}
          {!isPending &&
            !loadError &&
            pagination &&
            listings.length === 0 &&
            pagination.total === 0 &&
            !hasActiveFacetFilters && (
              <section className="rounded-xl border border-dashed border-[#27272A] bg-[#111113] p-10 text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-[#A1A1AA]">
                  <ShoppingBag className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h2 className="font-heading text-lg font-semibold text-[#FAFAFA]">
                    No active listings yet
                  </h2>
                  <p className="text-sm text-[#A1A1AA]">
                    Be the first member to post a textbook, gadget, cycle, or
                    essential for sale.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {hasAnyFilters && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearAll}
                    >
                      Reset Sorting
                    </Button>
                  )}
                  <Link
                    href="/marketplace/create"
                    className={cn(
                      buttonVariants({ variant: "accent", size: "sm" }),
                      "inline-flex items-center gap-1.5"
                    )}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Sell an Item</span>
                  </Link>
                </div>
              </section>
            )}

          {/* Product Results Grid + Preserved-Filter Pagination */}
          {!isPending && !loadError && pagination && listings.length > 0 && (
            <>
              <section
                aria-label="Marketplace listings"
                className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
              >
                {listings.map((listing) => (
                  <MarketplaceListingCard
                    key={listing.id}
                    listing={listing}
                    deliveryPolicy={deliveryPolicy}
                  />
                ))}
              </section>

              <MarketplacePagination
                state={appliedState}
                pagination={pagination}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
