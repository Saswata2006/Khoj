"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import {
  isAllowedCloudinaryImageUrl,
  type CloudinaryDeliveryPolicy,
} from "@/lib/marketplace-ui";
import { cn } from "@/lib/utils";

export interface MarketplaceImageProps {
  src?: string | null;
  alt: string;
  sizes: string;
  eager?: boolean;
  className?: string;
  containerClassName?: string;
  placeholderLabel?: string;
  deliveryPolicy?: CloudinaryDeliveryPolicy;
}

/**
 * Renders a responsive Cloudinary marketplace photo via `next/image` using
 * `remotePatterns` and optional configured-account/environment constraints,
 * falling back to an editorial dark missing-image frame when absent or broken.
 */
export function MarketplaceImage({
  src,
  alt,
  sizes,
  eager = false,
  className,
  containerClassName,
  placeholderLabel = "No photo available",
  deliveryPolicy,
}: MarketplaceImageProps) {
  const [hasError, setHasError] = useState(false);

  const canRenderRemote =
    Boolean(src) && isAllowedCloudinaryImageUrl(src, deliveryPolicy) && !hasError;

  if (!canRenderRemote || !src) {
    return (
      <div
        role="img"
        aria-label={alt || placeholderLabel}
        className={cn(
          "relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden bg-[#141417] px-3 text-center text-[#A1A1AA]",
          containerClassName
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-khoj-dots opacity-45"
        />
        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-[#71717A]">
          <ImageOff className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <span className="relative text-[11px] font-medium text-[#71717A]">
          {placeholderLabel}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      className={cn("object-cover", className)}
      onError={() => setHasError(true)}
    />
  );
}
