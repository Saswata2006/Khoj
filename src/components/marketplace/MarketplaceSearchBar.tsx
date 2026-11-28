"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Search, X } from "lucide-react";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/validators/listing";
import {
  MARKETPLACE_SEARCH_DEBOUNCE_MS,
  normalizeSearchTextInput,
  validateKeywordFilterInput,
} from "@/lib/marketplace-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MarketplaceSearchBarProps {
  appliedQ: string;
  appliedKey: string;
  isPending?: boolean;
  onSearchApply: (nextQ: string) => void;
  className?: string;
}

export function MarketplaceSearchBar({
  appliedQ,
  appliedKey,
  isPending = false,
  onSearchApply,
  className,
}: MarketplaceSearchBarProps) {
  const [draftState, setDraftState] = useState<{
    syncedKey: string;
    value: string;
  }>({
    syncedKey: appliedKey,
    value: appliedQ,
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latestAppliedKeyRef = useRef(appliedKey);
  const latestAppliedQRef = useRef(appliedQ);
  const latestOnSearchApplyRef = useRef(onSearchApply);

  useEffect(() => {
    latestAppliedKeyRef.current = appliedKey;
    latestAppliedQRef.current = appliedQ;
    latestOnSearchApplyRef.current = onSearchApply;
  });

  // Cancel pending debounced updates if external URL navigation happened
  // (e.g. Clear All, chip removal, category select, or browser Back/Forward)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [appliedKey]);

  const inputValue =
    draftState.syncedKey === appliedKey ? draftState.value : appliedQ;
  const displayedError =
    draftState.syncedKey === appliedKey ? validationError : null;

  const clearPendingDebounce = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const commitKeywordSearch = (rawValue: string) => {
    clearPendingDebounce();

    const error = validateKeywordFilterInput(rawValue);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    const normalized = normalizeSearchTextInput(rawValue);
    if (normalized === latestAppliedQRef.current) {
      return;
    }

    latestOnSearchApplyRef.current(normalized);
  };

  const handleInputChange = (nextRawValue: string) => {
    setDraftState({
      syncedKey: appliedKey,
      value: nextRawValue,
    });

    const error = validateKeywordFilterInput(nextRawValue);
    setValidationError(error);
    clearPendingDebounce();

    if (error) {
      return;
    }

    const scheduledKey = appliedKey;
    const scheduledValue = nextRawValue;
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      // Do not navigate using stale debounced input if URL already changed
      if (scheduledKey !== latestAppliedKeyRef.current) return;
      const normalized = normalizeSearchTextInput(scheduledValue);
      if (normalized === latestAppliedQRef.current) return;
      latestOnSearchApplyRef.current(normalized);
    }, MARKETPLACE_SEARCH_DEBOUNCE_MS);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitKeywordSearch(inputValue);
  };

  const handleClear = () => {
    clearPendingDebounce();
    setValidationError(null);
    setDraftState({
      syncedKey: appliedKey,
      value: "",
    });
    if (latestAppliedQRef.current !== "") {
      latestOnSearchApplyRef.current("");
    }
    inputRef.current?.focus();
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <form
        role="search"
        aria-label="Search marketplace listings"
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1 min-w-0">
          <label htmlFor="marketplace-search-input" className="sr-only">
            Search marketplace items by title or description
          </label>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </span>

          <Input
            ref={inputRef}
            id="marketplace-search-input"
            name="q"
            type="search"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            maxLength={MAX_SEARCH_QUERY_LENGTH + 20}
            aria-label="Search items by title or description"
            aria-invalid={Boolean(displayedError)}
            aria-describedby={
              displayedError ? "marketplace-search-error" : undefined
            }
            placeholder="Search items by title or description (e.g., calculator, DBMS, cycle)..."
            className="h-10 w-full bg-card pl-9 pr-10 text-sm"
          />

          {inputValue.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search query"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="submit"
            size="lg"
            disabled={isPending && inputValue.trim() === appliedQ}
            className="h-10 w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 px-5 font-medium"
          >
            <Search className="h-4 w-4 mr-1.5" aria-hidden="true" />
            <span>Search</span>
          </Button>
        </div>
      </form>

      {displayedError && (
        <p
          id="marketplace-search-error"
          role="alert"
          className="text-xs font-medium text-destructive"
        >
          {displayedError}
        </p>
      )}

      {isPending && (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          Updating marketplace results...
        </p>
      )}
    </div>
  );
}
