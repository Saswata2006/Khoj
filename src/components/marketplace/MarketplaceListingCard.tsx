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
      className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]"
    >
      <Card className="flex h-full flex-col rounded-2xl border-[#27272A] bg-[#111113] py-0 overflow-hidden card-interactive">
        {/* Large Stable Product Photography Frame */}
        <div className="relative aspect-4/3 w-full overflow-hidden border-b border-[#27272A] bg-[#141417]">
          <MarketplaceImage
            src={primaryImage?.imageUrl}
            alt={listing.title}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            deliveryPolicy={deliveryPolicy}
            className="transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent"
          />

          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <Badge
              variant="secondary"
              className="border-[#27272A] bg-[#09090B]/85 text-[#FAFAFA] backdrop-blur-md text-[11px] font-medium"
            >
              {categoryLabel}
            </Badge>

            {showStatus && (
              <Badge
                variant="secondary"
                className={cn(
                  "backdrop-blur-md text-[11px] font-semibold",
                  isSold
                    ? "border-[#F59E0B]/40 bg-[#F59E0B] text-[#09090B]"
                    : isRemoved
                      ? "border-[#27272A] bg-[#1C1C20]/90 text-[#A1A1AA]"
                      : "border-[#10B981]/35 bg-[#09090B]/85 text-[#34D399]"
                )}
              >
                {isSold ? "Sold" : isRemoved ? "Removed" : "Available"}
              </Badge>
            )}
          </div>
        </div>

        {/* Product Details & Meta */}
        <CardContent className="flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-heading text-xl font-semibold text-[#FAFAFA] price-tabular transition-colors group-hover:text-[#34D399]">
                {formattedPrice}
              </p>
              {conditionMeta && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#27272A] bg-[#18181B] px-2 py-0.5 text-[11px] font-medium text-[#A1A1AA] shrink-0">
                  <Tag className="h-3 w-3 text-[#10B981]" aria-hidden="true" />
                  <span>{conditionMeta.label}</span>
                </span>
              )}
            </div>

            <h2 className="font-heading text-sm sm:text-[15px] font-medium leading-snug text-[#FAFAFA] line-clamp-2">
              {listing.title}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 border-t border-[#27272A]/80 pt-3 text-xs text-[#A1A1AA]">
            <MapPin
              className="h-3.5 w-3.5 shrink-0 text-[#10B981]"
              aria-hidden="true"
            />
            <span className="truncate">{listing.location}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
