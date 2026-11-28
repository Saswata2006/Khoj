import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/authorization";
import { getCloudinaryPublicDeliveryPolicy } from "@/lib/cloudinary";
import {
  parseMyListingsStatusParam,
  parsePositivePageParam,
} from "@/lib/marketplace-ui";
import { getUserMarketplaceListings } from "@/lib/services/listings";
import { DEFAULT_MARKETPLACE_LIMIT } from "@/lib/validators/listing";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { MyListingsManager } from "@/components/marketplace/MyListingsManager";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Listings — Khoj",
  description:
    "Manage your Khoj marketplace items, availability statuses, edits, and removals.",
};

interface MyListingsPageProps {
  searchParams: Promise<{
    page?: string | string[];
    status?: string | string[];
  }>;
}

async function MyListingsContent({ searchParams }: MyListingsPageProps) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);

  if (!user) {
    redirect("/login?redirectTo=/dashboard/listings");
  }

  const page = parsePositivePageParam(params.page);
  const status = parseMyListingsStatusParam(params.status);

  let result: Awaited<ReturnType<typeof getUserMarketplaceListings>> | null =
    null;
  let loadError: string | null = null;

  try {
    result = await getUserMarketplaceListings(user.id, {
      page,
      limit: DEFAULT_MARKETPLACE_LIMIT,
      ...(status ? { status } : {}),
    });
  } catch {
    loadError =
      "Unable to load your marketplace listings right now. Please refresh and try again.";
  }

  const fallbackPagination = {
    page,
    limit: DEFAULT_MARKETPLACE_LIMIT,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  const rows = result?.listings ?? [];
  const pagination = result?.pagination ?? fallbackPagination;
  const managerKey = `${status ?? "ALL"}-${pagination.page}`;
  const deliveryPolicy = getCloudinaryPublicDeliveryPolicy();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar
        activePath="/dashboard/listings"
        initialUser={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role ?? undefined,
        }}
      />

      <main className="flex-1">
        <WorkspaceShell
          active="listings"
          user={{
            name: user.name,
            email: user.email,
            role: user.role ?? undefined,
          }}
        >
          <div className="flex flex-col gap-4 rounded-2xl border border-[#27272A] bg-[#111113] p-6 sm:flex-row sm:items-center sm:justify-between surface-specular">
            <div className="space-y-1.5">
              <h1 className="font-heading text-section-heading text-[#FAFAFA]">
                My Marketplace Listings
              </h1>
              <p className="text-sm text-[#A1A1AA]">
                View, edit, mark as sold, or remove your marketplace items.
              </p>
            </div>

            <Link
              href="/marketplace/create"
              className={cn(
                buttonVariants({ variant: "accent", size: "default" }),
                "w-fit inline-flex items-center gap-1.5"
              )}
            >
              <Plus className="h-4 w-4" />
              <span>Sell an Item</span>
            </Link>
          </div>

          <MyListingsManager
            key={managerKey}
            initialListings={rows}
            initialPagination={pagination}
            activeStatusFilter={status}
            initialError={loadError}
            deliveryPolicy={deliveryPolicy}
          />
        </WorkspaceShell>
      </main>

      <Footer />
    </div>
  );
}

function MyListingsSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 sm:p-10 max-w-7xl mx-auto space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function MyListingsPage({ searchParams }: MyListingsPageProps) {
  return (
    <Suspense fallback={<MyListingsSkeleton />}>
      <MyListingsContent searchParams={searchParams} />
    </Suspense>
  );
}
