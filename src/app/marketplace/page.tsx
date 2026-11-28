import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus, ShoppingBag } from "lucide-react";
import { getCurrentUser } from "@/lib/authorization";
import { getCloudinaryPublicDeliveryPolicy } from "@/lib/cloudinary";
import { parseMarketplaceSearchParams } from "@/lib/marketplace-search";
import { getPublicMarketplaceListingCards } from "@/lib/services/listings";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MarketplaceCatalogClient } from "@/components/marketplace/MarketplaceCatalogClient";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Marketplace — Khoj",
  description:
    "Search and filter pre-owned textbooks, electronics, cycles, and everyday essentials from community sellers.",
};

interface MarketplacePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function MarketplaceContent({ searchParams }: MarketplacePageProps) {
  const [user, rawParams] = await Promise.all([getCurrentUser(), searchParams]);
  const parsedSearch = parseMarketplaceSearchParams(rawParams);
  const deliveryPolicy = getCloudinaryPublicDeliveryPolicy();

  let data: Awaited<ReturnType<typeof getPublicMarketplaceListingCards>> | null =
    null;
  let loadError: string | null = null;

  try {
    data = await getPublicMarketplaceListingCards(parsedSearch.backendQuery);
  } catch {
    loadError =
      "Unable to load marketplace listings right now. Please refresh and try again.";
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar
        activePath="/marketplace"
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

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Catalog Header & Primary Action */}
        <section className="relative overflow-hidden flex flex-col gap-4 rounded-2xl border border-[#27272A] bg-[#111113] p-6 sm:flex-row sm:items-center sm:justify-between surface-specular">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#10B981]/8 blur-3xl"
          />
          <div className="relative space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent" className="gap-1.5">
                <ShoppingBag className="h-3 w-3" aria-hidden="true" />
                <span>Community Marketplace</span>
              </Badge>
              {data && (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {data.pagination.total}{" "}
                  {data.pagination.total === 1 ? "active item" : "active items"}
                </Badge>
              )}
            </div>

            <h1 className="font-heading text-section-heading text-[#FAFAFA]">
              Browse Marketplace
            </h1>
            <p className="text-sm text-[#A1A1AA] max-w-2xl">
              Discover pre-owned books, electronics, cycles, and everyday
              essentials listed by community sellers.
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
                buttonVariants({ variant: "accent", size: "default" }),
                "inline-flex items-center gap-1.5"
              )}
            >
              <Plus className="h-4 w-4" />
              <span>Sell an Item</span>
            </Link>
          </div>
        </section>

        {/* Coordinated Search, Responsive Filters, Sorting & Results */}
        <MarketplaceCatalogClient
          appliedState={parsedSearch.state}
          appliedQueryString={parsedSearch.canonicalSearch}
          listings={data?.listings ?? []}
          pagination={data?.pagination ?? null}
          loadError={loadError}
          queryWarnings={parsedSearch.warnings}
          deliveryPolicy={deliveryPolicy}
        />
      </main>

      <Footer />
    </div>
  );
}

export function MarketplaceSkeleton() {
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        <Skeleton className="hidden lg:block h-[460px] rounded-xl" />
        <div className="space-y-5">
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-72 rounded-xl" />
            ))}
          </div>
        </div>
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
