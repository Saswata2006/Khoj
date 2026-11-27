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
 * falling back to a consistent placeholder when missing, disallowed, or broken.
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
          "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted/70 px-3 text-center text-muted-foreground",
          containerClassName
        )}
      >
        <ImageOff className="h-6 w-6 opacity-60" aria-hidden="true" />
        <span className="text-[11px] font-medium">{placeholderLabel}</span>
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
