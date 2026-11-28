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
    <div className="space-y-3.5">
      {/* Main Immersive Photo Frame */}
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-[#27272A] bg-[#141417] surface-specular">
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
          <div className="pointer-events-none absolute left-3.5 top-3.5 rounded-full border border-[#F59E0B]/40 bg-[#F59E0B] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#09090B] shadow-md">
            Sold
          </div>
        )}

        {images.length > 1 && (
          <div className="pointer-events-none absolute right-3.5 bottom-3.5 rounded-full border border-[#27272A] bg-[#09090B]/85 px-2.5 py-1 font-mono text-[11px] font-medium text-[#FAFAFA] backdrop-blur-md">
            {safeIndex + 1} / {images.length}
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
                  "relative aspect-square w-full overflow-hidden rounded-xl border bg-[#141417] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]",
                  isActive
                    ? "border-[#10B981] ring-2 ring-[#10B981]/50 opacity-100 scale-[1.01]"
                    : "border-[#27272A] opacity-65 hover:opacity-100 hover:border-[#3F3F46]"
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
