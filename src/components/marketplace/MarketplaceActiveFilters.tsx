"use client";

import { X } from "lucide-react";
import {
  getAppliedFilterChips,
  type AppliedFilterChip,
  type MarketplaceFilterState,
} from "@/lib/marketplace-search";
import { Button } from "@/components/ui/button";

export interface MarketplaceActiveFiltersProps {
  state: MarketplaceFilterState;
  disabled?: boolean;
  onRemoveFilter: (key: AppliedFilterChip["key"]) => void;
  onClearAll: () => void;
}

export function MarketplaceActiveFilters({
  state,
  disabled = false,
  onRemoveFilter,
  onClearAll,
}: MarketplaceActiveFiltersProps) {
  const chips = getAppliedFilterChips(state);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Applied filters"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-[#27272A] bg-[#111113] px-4 py-2.5"
    >
      <span className="text-xs font-medium text-[#71717A] mr-1">
        Active filters ({chips.length}):
      </span>

      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          disabled={disabled}
          onClick={() => onRemoveFilter(chip.key)}
          aria-label={`Remove ${chip.label} filter (${chip.valueLabel})`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#27272A] bg-[#18181B] px-2.5 py-1 text-xs font-medium text-[#FAFAFA] transition-colors hover:border-[#3F3F46] hover:bg-[#1C1C20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] disabled:opacity-50"
        >
          <span className="text-[#A1A1AA]">{chip.label}:</span>
          <span className="font-semibold text-[#34D399] max-w-[180px] truncate">
            {chip.valueLabel}
          </span>
          <X className="h-3.5 w-3.5 text-[#71717A] shrink-0" aria-hidden="true" />
        </button>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={disabled}
        onClick={onClearAll}
        className="ml-auto text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA]"
      >
        Clear all filters
      </Button>
    </div>
  );
}
