import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Edit3,
  MapPin,
  MessageSquare,
  Package,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { getCurrentUser } from "@/lib/authorization";
import { getCloudinaryPublicDeliveryPolicy } from "@/lib/cloudinary";
import { computeUserInitials } from "@/lib/auth-ui";
import {
  formatMarketplacePrice,
  getCategoryLabel,
  getConditionMeta,
  isAllowedCloudinaryImageUrl,
} from "@/lib/marketplace-ui";
import { getPublicMarketplaceListingById } from "@/lib/services/listings";
import { formatDate } from "@/lib/utils";
import { listingIdSchema } from "@/lib/validators/listing";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MarketplaceImage } from "@/components/marketplace/MarketplaceImage";
import { ListingGallery } from "@/components/marketplace/ListingGallery";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Listing Details — Khoj Marketplace",
  description:
    "View marketplace product details, photos, condition grade, and local meetup area on Khoj.",
};

interface ListingDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ created?: string | string[] }>;
}

async function ListingDetailContent({
  params,
  searchParams,
}: ListingDetailPageProps) {
  const emptySearchParams: { created?: string | string[] } = {};
  const [{ id }, query, user] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(emptySearchParams),
    getCurrentUser(),
  ]);

  const parsedId = listingIdSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  let listing: Awaited<ReturnType<typeof getPublicMarketplaceListingById>> =
    null;
  let loadFailed = false;

  try {
    listing = await getPublicMarketplaceListingById(parsedId.data);
  } catch {
    loadFailed = true;
  }

  if (loadFailed) {
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
        <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive space-y-3"
          >
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-5 w-5" />
              <span>Unable to load this listing right now</span>
            </div>
            <p className="text-xs opacity-90">
              Please refresh the page or return to the Marketplace.
            </p>
            <Link
              href="/marketplace"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to Marketplace
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!listing) {
    notFound();
  }

  const isOwner = Boolean(user && user.id === listing.seller.id);
  const isSold = listing.status === "SOLD";
  const showCreatedBanner =
    isOwner &&
    (Array.isArray(query.created)
      ? query.created[0] === "1"
      : query.created === "1");

  const categoryLabel = getCategoryLabel(listing.category);
  const conditionMeta = getConditionMeta(listing.condition);
  const sellerDisplayName =
    listing.seller.name?.trim() || "Community Member";
  const sellerInitials = computeUserInitials(listing.seller.name, undefined);
  const deliveryPolicy = getCloudinaryPublicDeliveryPolicy();
  const hasSafeSellerAvatar = isAllowedCloudinaryImageUrl(
    listing.seller.image,
    deliveryPolicy
  );

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

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        {/* Back Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Marketplace</span>
          </Link>

          {isOwner && (
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary text-xs font-medium"
            >
              Your Listing
            </Badge>
          )}
        </div>

        {/* Post-Creation Confirmation Banner */}
        {showCreatedBanner && (
          <div
            role="status"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-900"
          >
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
              <span>Your listing has been published and is now live.</span>
            </div>
            <Link
              href="/dashboard/listings"
              className="font-semibold underline underline-offset-2 text-emerald-800 hover:text-emerald-950"
            >
              Manage in My Listings
            </Link>
          </div>
        )}

        {/* Prominent SOLD Banner */}
        {isSold && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3.5 text-sm text-amber-950"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">This item has been sold</p>
              <p className="text-xs text-amber-900/90">
                The seller has marked this listing as Sold. It is no longer
                available for purchase.
              </p>
            </div>
          </div>
        )}

        {/* Product Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Gallery + Description */}
          <div className="lg:col-span-7 space-y-6">
            <ListingGallery
              title={listing.title}
              images={listing.images}
              isSold={isSold}
              deliveryPolicy={deliveryPolicy}
            />

            <Card className="border-border bg-card shadow-2xs py-5">
              <CardHeader className="px-6 pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  Item Description
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="px-6 pt-4">
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line break-words">
                  {listing.description}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Price, Metadata, Actions & Seller Card */}
          <div className="lg:col-span-5 space-y-5">
            <Card className="border-border bg-card shadow-2xs py-6">
              <CardHeader className="px-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-muted text-foreground text-xs"
                  >
                    {categoryLabel}
                  </Badge>

                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs font-semibold",
                      isSold
                        ? "bg-amber-500/20 text-amber-900 border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-800 border-emerald-500/20"
                    )}
                  >
                    {isSold ? "Sold — Unavailable" : "Available"}
                  </Badge>
                </div>

                <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words">
                  {listing.title}
                </h1>

                <p className="font-heading text-3xl font-extrabold text-primary">
                  {formatMarketplacePrice(listing.price)}
                </p>
              </CardHeader>

              <Separator />

              <CardContent className="px-6 pt-4 space-y-3.5 text-sm">
                {conditionMeta && (
                  <div className="flex items-start gap-3">
                    <Tag className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">
                        Condition: {conditionMeta.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conditionMeta.description}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">
                      General location
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {listing.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Published</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(listing.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Owner vs Visitor Actions */}
            <Card className="border-border bg-card shadow-2xs py-5">
              <CardContent className="px-6 space-y-3">
                {isOwner ? (
                  <>
                    {!isSold ? (
                      <Link
                        href={`/marketplace/${listing.id}/edit`}
                        className={cn(
                          buttonVariants({ size: "lg" }),
                          "w-full bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 font-medium"
                        )}
                      >
                        <Edit3 className="h-4 w-4" />
                        <span>Edit Listing</span>
                      </Link>
                    ) : (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900">
                        This listing is marked as Sold and can no longer be
                        edited.
                      </p>
                    )}

                    <Link
                      href="/dashboard/listings"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "default" }),
                        "w-full inline-flex items-center justify-center gap-2"
                      )}
                    >
                      <Package className="h-4 w-4" />
                      <span>Manage in My Listings</span>
                    </Link>
                  </>
                ) : isSold ? (
                  <div className="space-y-2 text-center">
                    <Button
                      type="button"
                      size="lg"
                      disabled
                      className="w-full"
                    >
                      Sold — Item No Longer Available
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Browse more active items on the{" "}
                      <Link
                        href="/marketplace"
                        className="underline font-medium text-foreground"
                      >
                        Marketplace
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <Button
                      type="button"
                      size="lg"
                      disabled
                      className="w-full inline-flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Contact Seller — Coming Soon</span>
                    </Button>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Private seller contact requests are coming in an upcoming
                      release so you can connect without broadcasting personal
                      phone numbers or emails.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seller Summary Card (Strictly public fields only: name + avatar/initials) */}
            <Card className="border-border bg-card shadow-2xs py-5">
              <CardHeader className="px-6 pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Seller Information
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Email-verified Khoj community account
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pt-2">
                <div className="flex items-center gap-3">
                  {hasSafeSellerAvatar && listing.seller.image ? (
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                      <MarketplaceImage
                        src={listing.seller.image}
                        alt={sellerDisplayName}
                        sizes="44px"
                        placeholderLabel={sellerInitials}
                        deliveryPolicy={deliveryPolicy}
                      />
                    </div>
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      {sellerInitials}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {sellerDisplayName}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                      <span>Verified Community Member</span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function ListingDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 sm:p-10 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-5 w-36" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Skeleton className="aspect-4/3 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
        <div className="lg:col-span-5 space-y-5">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function ListingDetailPage({
  params,
  searchParams,
}: ListingDetailPageProps) {
  return (
    <Suspense fallback={<ListingDetailSkeleton />}>
      <ListingDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
