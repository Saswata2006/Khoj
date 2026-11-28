import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  buildMarketplaceHref,
  buildPaginationPageItems,
  type MarketplaceFilterState,
} from "@/lib/marketplace-search";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MarketplacePaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface MarketplacePaginationProps {
  state: MarketplaceFilterState;
  pagination: MarketplacePaginationMeta;
}

export function MarketplacePagination({
  state,
  pagination,
}: MarketplacePaginationProps) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  const pageItems = buildPaginationPageItems(
    pagination.page,
    pagination.totalPages
  );

  const prevPage = Math.max(1, pagination.page - 1);
  const nextPage = Math.min(pagination.totalPages, pagination.page + 1);

  return (
    <nav
      aria-label="Marketplace pagination"
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#27272A] bg-[#111113] px-4 py-3"
    >
      <p className="text-xs text-[#A1A1AA]">
        Page{" "}
        <span className="font-mono font-semibold text-[#FAFAFA]">{pagination.page}</span>{" "}
        of{" "}
        <span className="font-mono font-semibold text-[#FAFAFA]">
          {pagination.totalPages}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {pagination.hasPreviousPage ? (
          <Link
            href={buildMarketplaceHref({ ...state, page: prevPage })}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex items-center gap-1"
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
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
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span>Previous</span>
          </span>
        )}

        <div className="hidden sm:flex items-center gap-1">
          {pageItems.map((item, idx) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                aria-hidden="true"
                className="px-1.5 text-xs text-muted-foreground"
              >
                ...
              </span>
            ) : item === pagination.page ? (
              <span
                key={item}
                aria-current="page"
                className={cn(
                  buttonVariants({ variant: "accent", size: "sm" }),
                  "min-w-8 pointer-events-none"
                )}
              >
                {item}
              </span>
            ) : (
              <Link
                key={item}
                href={buildMarketplaceHref({ ...state, page: item })}
                aria-label={`Go to page ${item}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "min-w-8"
                )}
              >
                {item}
              </Link>
            )
          )}
        </div>

        {pagination.hasNextPage ? (
          <Link
            href={buildMarketplaceHref({ ...state, page: nextPage })}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex items-center gap-1"
            )}
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
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
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
