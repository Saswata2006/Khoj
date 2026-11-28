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
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-2xs"
    >
      <span className="text-xs font-medium text-muted-foreground mr-1">
        Active filters ({chips.length}):
      </span>

      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          disabled={disabled}
          onClick={() => onRemoveFilter(chip.key)}
          aria-label={`Remove ${chip.label} filter (${chip.valueLabel})`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <span className="text-muted-foreground">{chip.label}:</span>
          <span className="font-semibold text-foreground max-w-[180px] truncate">
            {chip.valueLabel}
          </span>
          <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        </button>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={disabled}
        onClick={onClearAll}
        className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Clear all filters
      </Button>
    </div>
  );
}
