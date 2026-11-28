"use client";

import { ArrowUpDown } from "lucide-react";
import { MARKETPLACE_SORT_OPTIONS } from "@/lib/validators/listing";
import {
  MARKETPLACE_SORT_LABELS,
  type MarketplaceSortOption,
} from "@/lib/marketplace-search";
import { Select } from "@/components/ui/select";
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
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A1A1AA] whitespace-nowrap"
      >
        <ArrowUpDown className="h-3.5 w-3.5 text-[#10B981]" aria-hidden="true" />
        <span>Sort by</span>
      </label>

      <Select
        id="marketplace-sort-select"
        name="sort"
        aria-label="Sort marketplace listings"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as MarketplaceSortOption)}
        className="h-8 bg-[#18181B] text-xs font-medium pr-8 pl-2.5"
      >
        {MARKETPLACE_SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {MARKETPLACE_SORT_LABELS[option]}
          </option>
        ))}
      </Select>
    </div>
  );
}
