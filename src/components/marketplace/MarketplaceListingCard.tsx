import Link from "next/link";
import { MapPin, Tag } from "lucide-react";
import {
  formatMarketplacePrice,
  getCategoryLabel,
  getConditionMeta,
  type CloudinaryDeliveryPolicy,
  type MarketplaceListingCardDTO,
} from "@/lib/marketplace-ui";
import { MarketplaceImage } from "@/components/marketplace/MarketplaceImage";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MarketplaceListingCardProps {
  listing: MarketplaceListingCardDTO;
  showStatus?: boolean;
  deliveryPolicy?: CloudinaryDeliveryPolicy;
}

export function MarketplaceListingCard({
  listing,
  showStatus = true,
  deliveryPolicy,
}: MarketplaceListingCardProps) {
  const primaryImage = listing.images[0] ?? null;
  const categoryLabel = getCategoryLabel(listing.category);
  const conditionMeta = getConditionMeta(listing.condition);
  const formattedPrice = formatMarketplacePrice(listing.price);
  const isSold = listing.status === "SOLD";
  const isRemoved = listing.status === "REMOVED";

  return (
    <Link
      href={`/marketplace/${listing.id}`}
      aria-label={`${listing.title} — ${formattedPrice}`}
      className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full border-border bg-card shadow-2xs transition-all group-hover:border-slate-300 group-hover:shadow-sm py-0 overflow-hidden">
        {/* Primary Product Image */}
        <div className="relative aspect-4/3 w-full overflow-hidden bg-muted border-b border-border">
          <MarketplaceImage
            src={primaryImage?.imageUrl}
            alt={listing.title}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            deliveryPolicy={deliveryPolicy}
            className="transition-transform duration-300 group-hover:scale-[1.02]"
          />

          <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
            <Badge
              variant="secondary"
              className="bg-background/90 text-foreground backdrop-blur-xs text-[11px] font-medium shadow-2xs"
            >
              {categoryLabel}
            </Badge>

            {showStatus && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-[11px] font-semibold shadow-2xs backdrop-blur-xs",
                  isSold
                    ? "bg-amber-500 text-slate-950"
                    : isRemoved
                      ? "bg-muted text-muted-foreground"
                      : "bg-emerald-600 text-white"
                )}
              >
                {isSold ? "Sold" : isRemoved ? "Removed" : "Available"}
              </Badge>
            )}
          </div>
        </div>

        {/* Listing Details */}
        <CardContent className="flex flex-1 flex-col justify-between gap-3 p-4">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-heading text-lg font-bold tracking-tight text-primary">
                {formattedPrice}
              </p>
              {conditionMeta && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground shrink-0">
                  <Tag className="h-3 w-3 text-accent" aria-hidden="true" />
                  <span>{conditionMeta.label}</span>
                </span>
              )}
            </div>

            <h2 className="font-heading text-sm sm:text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-accent transition-colors">
              {listing.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 pt-2 border-t border-border/60 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            <span className="truncate">{listing.location}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
