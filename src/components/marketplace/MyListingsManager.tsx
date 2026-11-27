"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Loader2,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import {
  applyMyListingsMutation,
  archiveListingRequest,
  buildMyListingsHref,
  formatMarketplacePrice,
  getCategoryLabel,
  getListingStatusLabel,
  markListingSoldRequest,
  type CloudinaryDeliveryPolicy,
  type MarketplaceListingClientDTO,
  type MarketplaceOwnerStatusFilter,
} from "@/lib/marketplace-ui";
import { formatDate, cn } from "@/lib/utils";
import { MarketplaceImage } from "@/components/marketplace/MarketplaceImage";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PendingConfirmationAction {
  type: "mark_sold" | "remove";
  listingId: string;
  title: string;
}

export interface MyListingsManagerProps {
  initialListings: MarketplaceListingClientDTO[];
  initialPagination: PaginationMeta;
  activeStatusFilter?: MarketplaceOwnerStatusFilter;
  initialError?: string | null;
  deliveryPolicy?: CloudinaryDeliveryPolicy;
}

const STATUS_TABS: Array<{
  label: string;
  value: MarketplaceOwnerStatusFilter | undefined;
}> = [
  { label: "All", value: undefined },
  { label: "Active", value: "ACTIVE" },
  { label: "Sold", value: "SOLD" },
  { label: "Removed", value: "REMOVED" },
];

export function MyListingsManager({
  initialListings,
  initialPagination,
  activeStatusFilter,
  initialError = null,
  deliveryPolicy,
}: MyListingsManagerProps) {
  const router = useRouter();
  const [listings, setListings] =
    useState<MarketplaceListingClientDTO[]>(initialListings);
  const [totalCount, setTotalCount] = useState(initialPagination.total);
  const [pendingAction, setPendingAction] =
    useState<PendingConfirmationAction | null>(null);
  const [mutatingListingId, setMutatingListingId] = useState<string | null>(
    null
  );
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationSuccess, setMutationSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingAction) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !mutatingListingId) {
        setPendingAction(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingAction, mutatingListingId]);

  const handleConfirmMutation = async () => {
    if (!pendingAction || mutatingListingId) return;

    const { type, listingId, title } = pendingAction;
    setMutatingListingId(listingId);
    setMutationError(null);
    setMutationSuccess(null);

    try {
      const result =
        type === "mark_sold"
          ? await markListingSoldRequest(listingId)
          : await archiveListingRequest(listingId);

      if (!result.ok) {
        setMutationError(result.error);
        setPendingAction(null);
        if (result.status === 409) {
          router.refresh();
        }
        return;
      }

      const nextRows = applyMyListingsMutation(
        listings,
        result.listing,
        activeStatusFilter
      );
      setListings(nextRows);

      if (activeStatusFilter && result.listing.status !== activeStatusFilter) {
        setTotalCount((prev) => Math.max(0, prev - 1));
      }

      setMutationSuccess(
        type === "mark_sold"
          ? `"${title}" has been marked as Sold.`
          : `"${title}" has been removed from public Marketplace visibility.`
      );
      setPendingAction(null);
      router.refresh();
    } finally {
      setMutatingListingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Tabs */}
      <nav
        aria-label="Filter your listings by status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-2 shadow-2xs"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((tab) => {
            const isActive = activeStatusFilter === tab.value;
            return (
              <Link
                key={tab.label}
                href={buildMyListingsHref({ status: tab.value })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <span className="px-2 text-xs text-muted-foreground">
          {totalCount} {totalCount === 1 ? "listing" : "listings"}
        </span>
      </nav>

      {/* Initial Fetch Error */}
      {initialError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{initialError}</span>
        </div>
      )}

      {/* Mutation Status Feedback */}
      {mutationError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{mutationError}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setMutationError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {mutationSuccess && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
          <span>{mutationSuccess}</span>
        </div>
      )}

      {/* Empty State */}
      {!initialError && listings.length === 0 && (
        <Card className="border-dashed border-border bg-card py-10">
          <CardContent className="text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Package className="h-6 w-6" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                {activeStatusFilter
                  ? `No ${getListingStatusLabel(activeStatusFilter).toLowerCase()} listings`
                  : "You haven't posted any listings yet"}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {activeStatusFilter
                  ? `You do not have any ${getListingStatusLabel(activeStatusFilter).toLowerCase()} marketplace listings matching this view.`
                  : "List pre-owned books, gadgets, cycles, or everyday essentials for sale."}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5">
              {activeStatusFilter && (
                <Link
                  href="/dashboard/listings"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  View All Listings
                </Link>
              )}
              <Link
                href="/marketplace/create"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-primary text-primary-foreground inline-flex items-center gap-1.5"
                )}
              >
                <Plus className="h-4 w-4" />
                <span>Create Listing</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Owned Listings List */}
      {!initialError && listings.length > 0 && (
        <div className="space-y-4">
          {listings.map((listing) => {
            const primaryImage = listing.images[0] ?? null;
            const isActive = listing.status === "ACTIVE";
            const isSold = listing.status === "SOLD";
            const isRemoved = listing.status === "REMOVED";
            const isRowBusy = mutatingListingId === listing.id;

            return (
              <Card
                key={listing.id}
                className="border-border bg-card shadow-2xs py-4 overflow-hidden"
              >
                <CardContent className="px-4 sm:px-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  {/* Thumbnail + Listing Summary */}
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="relative h-20 w-24 sm:h-24 sm:w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      <MarketplaceImage
                        src={primaryImage?.imageUrl}
                        alt={listing.title}
                        sizes="112px"
                        placeholderLabel="No photo"
                        deliveryPolicy={deliveryPolicy}
                      />
                    </div>

                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[11px] font-semibold",
                            isActive && "bg-emerald-500/15 text-emerald-800",
                            isSold && "bg-amber-500/20 text-amber-900",
                            isRemoved && "bg-muted text-muted-foreground"
                          )}
                        >
                          {getListingStatusLabel(listing.status)}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          {getCategoryLabel(listing.category)}
                        </Badge>
                      </div>

                      <h2 className="font-heading text-base font-semibold text-foreground truncate">
                        {listing.title}
                      </h2>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-primary text-sm">
                          {formatMarketplacePrice(listing.price)}
                        </span>
                        <span>&bull;</span>
                        <span>Posted {formatDate(listing.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Allowed Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
                    {!isRemoved && (
                      <Link
                        href={`/marketplace/${listing.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "inline-flex items-center gap-1.5 text-xs"
                        )}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>View</span>
                      </Link>
                    )}

                    {isActive && (
                      <Link
                        href={`/marketplace/${listing.id}/edit`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "inline-flex items-center gap-1.5 text-xs"
                        )}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </Link>
                    )}

                    {isActive && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={Boolean(mutatingListingId)}
                        onClick={() =>
                          setPendingAction({
                            type: "mark_sold",
                            listingId: listing.id,
                            title: listing.title,
                          })
                        }
                        className="inline-flex items-center gap-1.5 text-xs bg-amber-500/15 text-amber-900 hover:bg-amber-500/25"
                      >
                        {isRowBusy &&
                        pendingAction?.type === "mark_sold" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>Mark as Sold</span>
                      </Button>
                    )}

                    {!isRemoved && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={Boolean(mutatingListingId)}
                        onClick={() =>
                          setPendingAction({
                            type: "remove",
                            listingId: listing.id,
                            title: listing.title,
                          })
                        }
                        className="inline-flex items-center gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        {isRowBusy && pendingAction?.type === "remove" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span>Remove</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!initialError && initialPagination.totalPages > 1 && (
        <nav
          aria-label="My listings pagination"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
        >
          <p className="text-xs text-muted-foreground">
            Page{" "}
            <span className="font-semibold text-foreground">
              {initialPagination.page}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">
              {initialPagination.totalPages}
            </span>
          </p>

          <div className="flex items-center gap-2">
            {initialPagination.hasPreviousPage ? (
              <Link
                href={buildMyListingsHref({
                  status: activeStatusFilter,
                  page: initialPagination.page - 1,
                })}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex items-center gap-1"
                )}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "pointer-events-none opacity-50 inline-flex items-center gap-1"
                )}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </span>
            )}

            {initialPagination.hasNextPage ? (
              <Link
                href={buildMyListingsHref({
                  status: activeStatusFilter,
                  page: initialPagination.page + 1,
                })}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex items-center gap-1"
                )}
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "pointer-events-none opacity-50 inline-flex items-center gap-1"
                )}
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </nav>
      )}

      {/* Accessible Confirmation Dialog for Consequential / Destructive Actions */}
      {pendingAction && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-listing-action-title"
          aria-describedby="confirm-listing-action-description"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <Card className="w-full max-w-md border-border bg-card shadow-lg py-6">
            <CardContent className="px-6 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    pendingAction.type === "remove"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-500/15 text-amber-700"
                  )}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3
                    id="confirm-listing-action-title"
                    className="font-heading text-base font-bold text-foreground"
                  >
                    {pendingAction.type === "mark_sold"
                      ? "Mark listing as Sold?"
                      : "Remove listing from Marketplace?"}
                  </h3>
                  <p
                    id="confirm-listing-action-description"
                    className="text-xs leading-relaxed text-muted-foreground"
                  >
                    {pendingAction.type === "mark_sold"
                      ? `Marking "${pendingAction.title}" as Sold marks it unavailable to buyers and locks further edits.`
                      : `Removing "${pendingAction.title}" archives it (status: Removed) and hides it from the public marketplace.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={Boolean(mutatingListingId)}
                  onClick={() => setPendingAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={
                    pendingAction.type === "remove" ? "destructive" : "default"
                  }
                  size="sm"
                  disabled={Boolean(mutatingListingId)}
                  onClick={handleConfirmMutation}
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    pendingAction.type === "mark_sold" &&
                      "bg-primary text-primary-foreground"
                  )}
                >
                  {mutatingListingId && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>
                    {pendingAction.type === "mark_sold"
                      ? "Confirm Mark as Sold"
                      : "Confirm Remove"}
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
