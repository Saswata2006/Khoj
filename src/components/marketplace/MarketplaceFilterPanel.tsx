"use client";

import { useState, type FormEvent } from "react";
import type { Category, Condition } from "@prisma/client";
import { IndianRupee, MapPin, RotateCcw } from "lucide-react";
import { CATEGORY_LIST, CONDITIONS } from "@/constants/categories";
import {
  MARKETPLACE_CONDITIONS,
  MAX_LOCATION_FILTER_LENGTH,
  MAX_PRICE_INR,
} from "@/lib/validators/listing";
import {
  normalizeSearchTextInput,
  validateLocationFilterInput,
  validatePriceFilterInputs,
  type MarketplaceFilterState,
} from "@/lib/marketplace-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface MarketplaceFilterDraft {
  category: Category | "";
  condition: Condition | "";
  minPrice: string;
  maxPrice: string;
  location: string;
}

export interface MarketplaceFilterPanelProps {
  mode: "desktop" | "mobile";
  appliedState: MarketplaceFilterState;
  appliedKey: string;
  isPending?: boolean;
  onApplyPatch: (patch: Partial<MarketplaceFilterState>) => void;
  onClearAll: () => void;
  onMobileDone?: () => void;
}

function draftFromState(state: MarketplaceFilterState): MarketplaceFilterDraft {
  return {
    category: state.category,
    condition: state.condition,
    minPrice: state.minPrice,
    maxPrice: state.maxPrice,
    location: state.location,
  };
}

export function MarketplaceFilterPanel({
  mode,
  appliedState,
  appliedKey,
  isPending = false,
  onApplyPatch,
  onClearAll,
  onMobileDone,
}: MarketplaceFilterPanelProps) {
  const [draftState, setDraftState] = useState<{
    syncedKey: string;
    draft: MarketplaceFilterDraft;
  }>(() => ({
    syncedKey: appliedKey,
    draft: draftFromState(appliedState),
  }));
  const [formError, setFormError] = useState<string | null>(null);

  const activeDraft =
    draftState.syncedKey === appliedKey
      ? draftState.draft
      : draftFromState(appliedState);
  const displayedError =
    draftState.syncedKey === appliedKey ? formError : null;

  const updateDraft = (patch: Partial<MarketplaceFilterDraft>) => {
    setFormError(null);
    setDraftState({
      syncedKey: appliedKey,
      draft: {
        ...activeDraft,
        ...patch,
      },
    });
  };

  const handleCategorySelect = (category: Category | "") => {
    if (mode === "desktop") {
      onApplyPatch({ category });
    } else {
      updateDraft({ category });
    }
  };

  const handleConditionSelect = (condition: Condition | "") => {
    if (mode === "desktop") {
      onApplyPatch({ condition });
    } else {
      updateDraft({ condition });
    }
  };

  const validateAndBuildPriceLocationPatch = (): {
    valid: boolean;
    patch?: Partial<MarketplaceFilterState>;
    error?: string;
  } => {
    const priceCheck = validatePriceFilterInputs(
      activeDraft.minPrice,
      activeDraft.maxPrice
    );
    if (!priceCheck.valid) {
      return {
        valid: false,
        error: priceCheck.error ?? "Invalid price range.",
      };
    }

    const locationError = validateLocationFilterInput(activeDraft.location);
    if (locationError) {
      return {
        valid: false,
        error: locationError,
      };
    }

    return {
      valid: true,
      patch: {
        minPrice:
          priceCheck.minPrice !== undefined ? String(priceCheck.minPrice) : "",
        maxPrice:
          priceCheck.maxPrice !== undefined ? String(priceCheck.maxPrice) : "",
        location: normalizeSearchTextInput(activeDraft.location),
      },
    };
  };

  const handleApplySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checked = validateAndBuildPriceLocationPatch();
    if (!checked.valid || !checked.patch) {
      setFormError(checked.error ?? "Please verify filter values.");
      return;
    }

    setFormError(null);
    if (mode === "mobile") {
      onApplyPatch({
        category: activeDraft.category,
        condition: activeDraft.condition,
        ...checked.patch,
      });
      onMobileDone?.();
    } else {
      onApplyPatch(checked.patch);
    }
  };

  const handleClearClick = () => {
    setFormError(null);
    setDraftState({
      syncedKey: appliedKey,
      draft: {
        category: "",
        condition: "",
        minPrice: "",
        maxPrice: "",
        location: "",
      },
    });
    onClearAll();
    if (mode === "mobile") {
      onMobileDone?.();
    }
  };

  const selectedCategory =
    mode === "desktop" ? appliedState.category : activeDraft.category;
  const selectedCondition =
    mode === "desktop" ? appliedState.condition : activeDraft.condition;

  const hasAnyDraftOrApplied =
    Boolean(selectedCategory) ||
    Boolean(selectedCondition) ||
    Boolean(activeDraft.minPrice.trim()) ||
    Boolean(activeDraft.maxPrice.trim()) ||
    Boolean(activeDraft.location.trim()) ||
    Boolean(appliedState.q);

  const idPrefix = mode === "mobile" ? "mobile-filter" : "desktop-filter";

  return (
    <form
      onSubmit={handleApplySubmit}
      aria-label="Marketplace filters"
      className="flex flex-col gap-5"
    >
      {/* Category Filter */}
      <fieldset className="space-y-2.5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Category
        </legend>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={isPending && mode === "desktop"}
            aria-pressed={selectedCategory === ""}
            onClick={() => handleCategorySelect("")}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedCategory === ""
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>All Categories</span>
          </button>

          {CATEGORY_LIST.map((cat) => {
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                disabled={isPending && mode === "desktop"}
                aria-pressed={isSelected}
                onClick={() => handleCategorySelect(cat.value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="truncate">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Separator />

      {/* Product Condition Filter */}
      <fieldset className="space-y-2.5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Condition
        </legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={isPending && mode === "desktop"}
            aria-pressed={selectedCondition === ""}
            onClick={() => handleConditionSelect("")}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedCondition === ""
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All Conditions
          </button>

          {MARKETPLACE_CONDITIONS.map((condKey) => {
            const isSelected = selectedCondition === condKey;
            return (
              <button
                key={condKey}
                type="button"
                disabled={isPending && mode === "desktop"}
                aria-pressed={isSelected}
                onClick={() => handleConditionSelect(condKey)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {CONDITIONS[condKey].label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Separator />

      {/* Price Range (INR) */}
      <fieldset className="space-y-2.5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Price Range (INR)
        </legend>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label
              htmlFor={`${idPrefix}-min-price`}
              className="block text-[11px] font-medium text-muted-foreground"
            >
              Min (₹)
            </label>
            <div className="relative">
              <IndianRupee
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id={`${idPrefix}-min-price`}
                name="minPrice"
                type="number"
                inputMode="decimal"
                min="0"
                max={String(MAX_PRICE_INR)}
                step="0.01"
                value={activeDraft.minPrice}
                onChange={(e) => updateDraft({ minPrice: e.target.value })}
                placeholder="0"
                className="h-9 bg-background pl-7 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor={`${idPrefix}-max-price`}
              className="block text-[11px] font-medium text-muted-foreground"
            >
              Max (₹)
            </label>
            <div className="relative">
              <IndianRupee
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id={`${idPrefix}-max-price`}
                name="maxPrice"
                type="number"
                inputMode="decimal"
                min="0"
                max={String(MAX_PRICE_INR)}
                step="0.01"
                value={activeDraft.maxPrice}
                onChange={(e) => updateDraft({ maxPrice: e.target.value })}
                placeholder="Any"
                className="h-9 bg-background pl-7 text-xs"
              />
            </div>
          </div>
        </div>
      </fieldset>

      <Separator />

      {/* General Location */}
      <div className="space-y-2">
        <label
          htmlFor={`${idPrefix}-location`}
          className="block text-xs font-semibold uppercase tracking-wider text-foreground"
        >
          General Location
        </label>
        <div className="relative">
          <MapPin
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${idPrefix}-location`}
            name="location"
            type="text"
            maxLength={MAX_LOCATION_FILTER_LENGTH + 20}
            value={activeDraft.location}
            onChange={(e) => updateDraft({ location: e.target.value })}
            placeholder="e.g., Library, Hostel 4, South Gate"
            className="h-9 bg-background pl-8 text-xs"
          />
        </div>
      </div>

      {/* Inline Validation Alert */}
      {displayedError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          {displayedError}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="submit"
          size="default"
          disabled={isPending && mode === "desktop"}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
        >
          {mode === "mobile" ? "Apply Filters" : "Apply Price & Location"}
        </Button>

        {hasAnyDraftOrApplied && (
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={handleClearClick}
            className="w-full text-xs inline-flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear All Filters</span>
          </Button>
        )}
      </div>
    </form>
  );
}
