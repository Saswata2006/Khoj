"use client";

import { useState } from "react";
import type {
  CloudinaryDeliveryPolicy,
  UploadedImageSummary,
} from "@/lib/marketplace-ui";
import { MarketplaceImage } from "@/components/marketplace/MarketplaceImage";
import { cn } from "@/lib/utils";

export interface ListingGalleryProps {
  title: string;
  images: UploadedImageSummary[];
  isSold?: boolean;
  deliveryPolicy?: CloudinaryDeliveryPolicy;
}

export function ListingGallery({
  title,
  images,
  isSold = false,
  deliveryPolicy,
}: ListingGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const safeIndex =
    images.length === 0 ? 0 : Math.min(selectedIndex, images.length - 1);
  const activeImage = images[safeIndex] ?? null;

  return (
    <div className="space-y-3">
      {/* Main Image Frame */}
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-border bg-muted shadow-2xs">
        <MarketplaceImage
          key={activeImage?.imageUrl ?? "placeholder"}
          src={activeImage?.imageUrl}
          alt={
            images.length > 1
              ? `${title} — photo ${safeIndex + 1} of ${images.length}`
              : title
          }
          sizes="(max-width: 1024px) 100vw, 58vw"
          eager
          placeholderLabel="No photos uploaded for this listing"
          deliveryPolicy={deliveryPolicy}
        />

        {isSold && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-sm">
            Sold
          </div>
        )}
      </div>

      {/* Clickable Thumbnails */}
      {images.length > 1 && (
        <div
          className="grid grid-cols-5 gap-2.5"
          role="group"
          aria-label="Product photo thumbnails"
        >
          {images.map((image, index) => {
            const isActive = index === safeIndex;
            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-label={`View photo ${index + 1} of ${images.length}`}
                aria-pressed={isActive}
                className={cn(
                  "relative aspect-square w-full overflow-hidden rounded-lg border bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-accent ring-2 ring-accent"
                    : "border-border opacity-80 hover:opacity-100"
                )}
              >
                <MarketplaceImage
                  src={image.imageUrl}
                  alt={`${title} thumbnail ${index + 1}`}
                  sizes="120px"
                  placeholderLabel={`Photo ${index + 1}`}
                  deliveryPolicy={deliveryPolicy}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
