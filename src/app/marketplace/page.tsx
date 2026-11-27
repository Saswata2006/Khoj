import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { getCurrentUser } from "@/lib/authorization";
import { getCloudinaryPublicDeliveryPolicy } from "@/lib/cloudinary";
import { parsePositivePageParam } from "@/lib/marketplace-ui";
import { getPublicMarketplaceListings } from "@/lib/services/listings";
import { DEFAULT_MARKETPLACE_LIMIT } from "@/lib/validators/listing";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MarketplaceListingCard } from "@/components/marketplace/MarketplaceListingCard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Marketplace — Khoj",
  description:
    "Browse pre-owned textbooks, electronics, cycles, and everyday essentials from community sellers.",
};

interface MarketplacePageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

async function MarketplaceContent({ searchParams }: MarketplacePageProps) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const page = parsePositivePageParam(params.page);
  const deliveryPolicy = getCloudinaryPublicDeliveryPolicy();

  let data: Awaited<ReturnType<typeof getPublicMarketplaceListings>> | null =
    null;
  let loadError: string | null = null;

  try {
    data = await getPublicMarketplaceListings({
      page,
      limit: DEFAULT_MARKETPLACE_LIMIT,
    });
  } catch {
    loadError =
      "Unable to load marketplace listings right now. Please refresh and try again.";
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar
        initialUser={
          user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role ?? undefined,
              }
            : null
        }
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header & Primary Action */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-xs font-medium inline-flex items-center gap-1"
              >
                <ShoppingBag className="h-3 w-3 text-accent" />
                <span>Community Marketplace</span>
              </Badge>
              {data && (
                <Badge variant="outline" className="text-xs">
                  {data.pagination.total}{" "}
                  {data.pagination.total === 1 ? "active item" : "active items"}
                </Badge>
              )}
            </div>

            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Browse Marketplace
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Discover pre-owned books, electronics, cycles, and everyday
              essentials listed by verified community members.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {user && (
              <Link
                href="/dashboard/listings"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "inline-flex items-center gap-1.5"
                )}
              >
                <Package className="h-4 w-4" />
                <span>My Listings</span>
              </Link>
            )}
            <Link
              href="/marketplace/create"
              className={cn(
                buttonVariants({ size: "default" }),
                "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 font-medium"
              )}
            >
              <Plus className="h-4 w-4" />
              <span>Sell an Item</span>
            </Link>
          </div>
        </section>

        {/* Sanitized Error State */}
        {loadError && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Failed to load listings</p>
                <p className="text-xs opacity-90">{loadError}</p>
              </div>
            </div>
            <Link
              href="/marketplace"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "shrink-0 bg-background text-foreground"
              )}
            >
              Try Again
            </Link>
          </div>
        )}

        {/* Empty State */}
        {!loadError && data && data.listings.length === 0 && (
          <section className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                {data.pagination.total > 0 && page > 1
                  ? "No listings on this page"
                  : "No active listings yet"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {data.pagination.total > 0 && page > 1
                  ? "You have reached past the last available page of active marketplace listings."
                  : "Be the first member to post a textbook, gadget, cycle, or essential for sale."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {data.pagination.total > 0 && page > 1 && (
                <Link
                  href="/marketplace"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Back to Page 1
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
                <span>Sell an Item</span>
              </Link>
            </div>
          </section>
        )}

        {/* Active Marketplace Product Grid */}
        {!loadError && data && data.listings.length > 0 && (
          <>
            <section
              aria-label="Marketplace listings"
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {data.listings.map((listing) => (
                <MarketplaceListingCard
                  key={listing.id}
                  listing={listing}
                  deliveryPolicy={deliveryPolicy}
                />
              ))}
            </section>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <nav
                aria-label="Marketplace pagination"
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
              >
                <p className="text-xs text-muted-foreground">
                  Page{" "}
                  <span className="font-semibold text-foreground">
                    {data.pagination.page}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-foreground">
                    {data.pagination.totalPages}
                  </span>
                </p>

                <div className="flex items-center gap-2">
                  {data.pagination.hasPreviousPage ? (
                    <Link
                      href={
                        data.pagination.page - 1 <= 1
                          ? "/marketplace"
                          : `/marketplace?page=${data.pagination.page - 1}`
                      }
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

                  {data.pagination.hasNextPage ? (
                    <Link
                      href={`/marketplace?page=${data.pagination.page + 1}`}
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
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export function MarketplaceSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 sm:p-10 max-w-7xl mx-auto space-y-8">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function MarketplacePage({ searchParams }: MarketplacePageProps) {
  return (
    <Suspense fallback={<MarketplaceSkeleton />}>
      <MarketplaceContent searchParams={searchParams} />
    </Suspense>
  );
}
