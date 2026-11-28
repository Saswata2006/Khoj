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
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-2xs"
    >
      <p className="text-xs text-muted-foreground">
        Page{" "}
        <span className="font-semibold text-foreground">{pagination.page}</span>{" "}
        of{" "}
        <span className="font-semibold text-foreground">
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
                  buttonVariants({ variant: "default", size: "sm" }),
                  "min-w-8 bg-primary text-primary-foreground pointer-events-none"
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
