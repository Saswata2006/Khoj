"use client";

import { ArrowUpDown } from "lucide-react";
import { MARKETPLACE_SORT_OPTIONS } from "@/lib/validators/listing";
import {
  MARKETPLACE_SORT_LABELS,
  type MarketplaceSortOption,
} from "@/lib/marketplace-search";
import { cn } from "@/lib/utils";

export interface MarketplaceSortSelectProps {
  value: MarketplaceSortOption;
  disabled?: boolean;
  onChange: (nextSort: MarketplaceSortOption) => void;
  className?: string;
}

export function MarketplaceSortSelect({
  value,
  disabled = false,
  onChange,
  className,
}: MarketplaceSortSelectProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label
        htmlFor="marketplace-sort-select"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground whitespace-nowrap"
      >
        <ArrowUpDown className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        <span>Sort by</span>
      </label>

      <select
        id="marketplace-sort-select"
        name="sort"
        aria-label="Sort marketplace listings"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as MarketplaceSortOption)}
        className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {MARKETPLACE_SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {MARKETPLACE_SORT_LABELS[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
