import type { Category, Condition } from "@prisma/client";
import { CATEGORIES, CONDITIONS } from "@/constants/categories";
import {
  DEFAULT_MARKETPLACE_LIMIT,
  DEFAULT_MARKETPLACE_PAGE,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
  MARKETPLACE_SORT_OPTIONS,
  MAX_LOCATION_FILTER_LENGTH,
  MAX_MARKETPLACE_LIMIT,
  MAX_PRICE_INR,
  MAX_SEARCH_QUERY_LENGTH,
  listMarketplaceQuerySchema,
  type ListMarketplaceQuery,
} from "@/lib/validators/listing";

export type MarketplaceSortOption = (typeof MARKETPLACE_SORT_OPTIONS)[number];

export const MARKETPLACE_SORT_LABELS: Record<MarketplaceSortOption, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
};

export const MARKETPLACE_SEARCH_DEBOUNCE_MS = 400;

export interface MarketplaceFilterState {
  q: string;
  category: Category | "";
  condition: Condition | "";
  minPrice: string;
  maxPrice: string;
  location: string;
  sort: MarketplaceSortOption;
  page: number;
  limit: number;
}

export const DEFAULT_MARKETPLACE_FILTER_STATE: MarketplaceFilterState = {
  q: "",
  category: "",
  condition: "",
  minPrice: "",
  maxPrice: "",
  location: "",
  sort: "newest",
  page: DEFAULT_MARKETPLACE_PAGE,
  limit: DEFAULT_MARKETPLACE_LIMIT,
};

export interface AppliedFilterChip {
  key: "q" | "category" | "condition" | "minPrice" | "maxPrice" | "location";
  label: string;
  valueLabel: string;
}

export interface PriceValidationResult {
  valid: boolean;
  minPrice?: number;
  maxPrice?: number;
  minError?: string;
  maxError?: string;
  rangeError?: string;
  error?: string;
}

export type RawSearchParamsInput =
  | Record<string, string | string[] | undefined>
  | URLSearchParams
  | string
  | null
  | undefined;

export interface ParsedMarketplaceSearchResult {
  state: MarketplaceFilterState;
  backendQuery: ListMarketplaceQuery;
  warnings: string[];
  ignoredUnknownKeys: string[];
  canonicalSearch: string;
}

const KNOWN_QUERY_KEYS = new Set([
  "q",
  "category",
  "condition",
  "minPrice",
  "maxPrice",
  "location",
  "sort",
  "page",
  "limit",
]);

const HAS_CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/;
const STRICT_NON_NEGATIVE_PRICE_RE = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const STRICT_INT_STRING_RE = /^-?\d+$/;

const CATEGORY_SET = new Set<string>(MARKETPLACE_CATEGORIES);
const CONDITION_SET = new Set<string>(MARKETPLACE_CONDITIONS);
const SORT_SET = new Set<string>(MARKETPLACE_SORT_OPTIONS);

/**
 * Trims surrounding whitespace and collapses consecutive spaces cleanly.
 */
export function normalizeSearchTextInput(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Validates keyword query `q` before debounced or manual URL updates.
 */
export function validateKeywordFilterInput(value: string): string | null {
  if (HAS_CONTROL_CHARS_RE.test(value)) {
    return "Search query contains unsupported control characters.";
  }
  const normalized = normalizeSearchTextInput(value);
  if (normalized.length > MAX_SEARCH_QUERY_LENGTH) {
    return `Search query must be ${MAX_SEARCH_QUERY_LENGTH} characters or fewer.`;
  }
  return null;
}

/**
 * Validates general location filter before applying to URL state.
 */
export function validateLocationFilterInput(value: string): string | null {
  if (HAS_CONTROL_CHARS_RE.test(value)) {
    return "Location filter contains unsupported control characters.";
  }
  const normalized = normalizeSearchTextInput(value);
  if (normalized.length > MAX_LOCATION_FILTER_LENGTH) {
    return `Location filter must be ${MAX_LOCATION_FILTER_LENGTH} characters or fewer.`;
  }
  return null;
}

function parseSinglePriceFilter(
  rawValue: string,
  label: string
): { valid: boolean; value?: number; error?: string } {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { valid: true, value: undefined };
  }

  if (!STRICT_NON_NEGATIVE_PRICE_RE.test(trimmed)) {
    return { valid: false, error: `${label} must be a valid number.` };
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return { valid: false, error: `${label} must be a finite number.` };
  }

  if (numeric < 0) {
    return { valid: false, error: `${label} cannot be negative.` };
  }

  if (numeric > MAX_PRICE_INR) {
    return {
      valid: false,
      error: `${label} cannot exceed ${MAX_PRICE_INR.toLocaleString("en-IN")} INR.`,
    };
  }

  if (Math.abs(numeric * 100 - Math.round(numeric * 100)) >= 1e-6) {
    return {
      valid: false,
      error: `${label} can have at most 2 decimal places.`,
    };
  }

  return { valid: true, value: Math.round(numeric * 100) / 100 };
}

/**
 * Validates minimum and maximum price inputs in INR before URL updates.
 */
export function validatePriceFilterInputs(
  minRaw: string,
  maxRaw: string
): PriceValidationResult {
  const minParsed = parseSinglePriceFilter(minRaw, "Minimum price");
  const maxParsed = parseSinglePriceFilter(maxRaw, "Maximum price");

  if (!minParsed.valid || !maxParsed.valid) {
    return {
      valid: false,
      minError: minParsed.error,
      maxError: maxParsed.error,
      error: minParsed.error ?? maxParsed.error,
    };
  }

  if (
    minParsed.value !== undefined &&
    maxParsed.value !== undefined &&
    maxParsed.value < minParsed.value
  ) {
    const rangeError =
      "Maximum price must be greater than or equal to minimum price.";
    return {
      valid: false,
      rangeError,
      error: rangeError,
    };
  }

  return {
    valid: true,
    minPrice: minParsed.value,
    maxPrice: maxParsed.value,
  };
}

function normalizePriceNumberForState(value: number | undefined): string {
  if (value === undefined) return "";
  return String(value);
}

function collectRawEntries(
  input: RawSearchParamsInput
): Array<[string, string[]]> {
  if (!input) return [];

  if (typeof input === "string") {
    const query = input.startsWith("?") ? input.slice(1) : input;
    const params = new URLSearchParams(query);
    return collectRawEntries(params);
  }

  if (input instanceof URLSearchParams) {
    const grouped = new Map<string, string[]>();
    for (const [key, value] of input.entries()) {
      const list = grouped.get(key) ?? [];
      list.push(value);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries());
  }

  return Object.entries(input).map(([key, value]) => {
    if (value === undefined) return [key, []];
    return [key, Array.isArray(value) ? value : [value]];
  });
}

function parseSingleKnownParamValue(
  key: string,
  values: string[],
  warnings: string[]
): string | undefined {
  if (values.length === 0) return undefined;

  const nonEmptyValues = values.filter((val) => val.trim() !== "");
  if (nonEmptyValues.length === 0) {
    return undefined;
  }

  if (nonEmptyValues.length > 1) {
    warnings.push(
      `Multiple values for "${key}" were ignored because only one value is supported.`
    );
    return undefined;
  }

  return nonEmptyValues[0];
}

function parseBoundedIntParam(
  raw: string | undefined,
  label: string,
  min: number,
  max: number,
  defaultValue: number,
  warnings: string[]
): number {
  if (raw === undefined) return defaultValue;

  const trimmed = raw.trim();
  if (!STRICT_INT_STRING_RE.test(trimmed)) {
    warnings.push(`Invalid "${label}" value was reset to default.`);
    return defaultValue;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    warnings.push(
      `Out-of-range "${label}" value was reset to ${defaultValue}.`
    );
    return defaultValue;
  }

  return parsed;
}

/**
 * Safely parses URL search parameters into UI state and backend-compatible
 * `ListMarketplaceQuery`, tolerating unknown, malformed, duplicate, legacy, or
 * inverted URL parameters gracefully without failing page renders.
 */
export function parseMarketplaceSearchParams(
  rawInput: RawSearchParamsInput
): ParsedMarketplaceSearchResult {
  const entries = collectRawEntries(rawInput);
  const warnings: string[] = [];
  const ignoredUnknownKeys: string[] = [];
  const rawMap = new Map<string, string[]>();

  for (const [key, values] of entries) {
    if (!KNOWN_QUERY_KEYS.has(key)) {
      if (values.length > 0) {
        ignoredUnknownKeys.push(key);
      }
      continue;
    }
    rawMap.set(key, values);
  }

  if (ignoredUnknownKeys.length > 0) {
    warnings.push(
      `Unsupported parameter${ignoredUnknownKeys.length > 1 ? "s" : ""} ignored: ${ignoredUnknownKeys.join(", ")}.`
    );
  }

  const state: MarketplaceFilterState = {
    ...DEFAULT_MARKETPLACE_FILTER_STATE,
  };

  // q
  const rawQ = parseSingleKnownParamValue(
    "q",
    rawMap.get("q") ?? [],
    warnings
  );
  if (rawQ !== undefined) {
    const qError = validateKeywordFilterInput(rawQ);
    if (qError) {
      warnings.push(qError);
    } else {
      const normalized = normalizeSearchTextInput(rawQ);
      if (normalized) {
        state.q = normalized;
      }
    }
  }

  // category
  const rawCategory = parseSingleKnownParamValue(
    "category",
    rawMap.get("category") ?? [],
    warnings
  );
  if (rawCategory !== undefined) {
    const trimmed = rawCategory.trim();
    if (CATEGORY_SET.has(trimmed)) {
      state.category = trimmed as Category;
    } else {
      warnings.push(`Unsupported category "${trimmed}" was ignored.`);
    }
  }

  // condition
  const rawCondition = parseSingleKnownParamValue(
    "condition",
    rawMap.get("condition") ?? [],
    warnings
  );
  if (rawCondition !== undefined) {
    const trimmed = rawCondition.trim();
    if (CONDITION_SET.has(trimmed)) {
      state.condition = trimmed as Condition;
    } else {
      warnings.push(`Unsupported condition "${trimmed}" was ignored.`);
    }
  }

  // minPrice & maxPrice
  const rawMinPrice = parseSingleKnownParamValue(
    "minPrice",
    rawMap.get("minPrice") ?? [],
    warnings
  );
  const rawMaxPrice = parseSingleKnownParamValue(
    "maxPrice",
    rawMap.get("maxPrice") ?? [],
    warnings
  );
  const minParsed =
    rawMinPrice !== undefined
      ? parseSinglePriceFilter(rawMinPrice, "Minimum price")
      : { valid: true, value: undefined };
  const maxParsed =
    rawMaxPrice !== undefined
      ? parseSinglePriceFilter(rawMaxPrice, "Maximum price")
      : { valid: true, value: undefined };

  if (!minParsed.valid && minParsed.error) {
    warnings.push(minParsed.error);
  }
  if (!maxParsed.valid && maxParsed.error) {
    warnings.push(maxParsed.error);
  }

  if (
    minParsed.valid &&
    maxParsed.valid &&
    minParsed.value !== undefined &&
    maxParsed.value !== undefined &&
    maxParsed.value < minParsed.value
  ) {
    warnings.push(
      "Price range was ignored because minimum price exceeded maximum price."
    );
  } else {
    if (minParsed.valid && minParsed.value !== undefined) {
      state.minPrice = normalizePriceNumberForState(minParsed.value);
    }
    if (maxParsed.valid && maxParsed.value !== undefined) {
      state.maxPrice = normalizePriceNumberForState(maxParsed.value);
    }
  }

  // location
  const rawLocation = parseSingleKnownParamValue(
    "location",
    rawMap.get("location") ?? [],
    warnings
  );
  if (rawLocation !== undefined) {
    const locError = validateLocationFilterInput(rawLocation);
    if (locError) {
      warnings.push(locError);
    } else {
      const normalized = normalizeSearchTextInput(rawLocation);
      if (normalized) {
        state.location = normalized;
      }
    }
  }

  // sort
  const rawSort = parseSingleKnownParamValue(
    "sort",
    rawMap.get("sort") ?? [],
    warnings
  );
  if (rawSort !== undefined) {
    const trimmed = rawSort.trim();
    if (SORT_SET.has(trimmed)) {
      state.sort = trimmed as MarketplaceSortOption;
    } else {
      warnings.push(
        `Unsupported sort option "${trimmed}" was reset to Newest first.`
      );
    }
  }

  // page & limit
  state.page = parseBoundedIntParam(
    parseSingleKnownParamValue("page", rawMap.get("page") ?? [], warnings),
    "page",
    1,
    1000,
    DEFAULT_MARKETPLACE_PAGE,
    warnings
  );
  state.limit = parseBoundedIntParam(
    parseSingleKnownParamValue("limit", rawMap.get("limit") ?? [], warnings),
    "limit",
    1,
    MAX_MARKETPLACE_LIMIT,
    DEFAULT_MARKETPLACE_LIMIT,
    warnings
  );

  // Build strict backend query validated through authoritative Zod schema
  const candidateQuery: Record<string, unknown> = {
    sort: state.sort,
    page: state.page,
    limit: state.limit,
  };
  if (state.q) candidateQuery.q = state.q;
  if (state.category) candidateQuery.category = state.category;
  if (state.condition) candidateQuery.condition = state.condition;
  if (state.minPrice) candidateQuery.minPrice = Number(state.minPrice);
  if (state.maxPrice) candidateQuery.maxPrice = Number(state.maxPrice);
  if (state.location) candidateQuery.location = state.location;

  const backendQuery = listMarketplaceQuerySchema.parse(candidateQuery);

  return {
    state,
    backendQuery,
    warnings,
    ignoredUnknownKeys,
    canonicalSearch: serializeMarketplaceSearchParams(state),
  };
}

/**
 * Serializes marketplace filter state into a clean canonical query string,
 * omitting empty values and default `sort=newest`, `page=1`, `limit=12`.
 */
export function serializeMarketplaceSearchParams(
  partialState: Partial<MarketplaceFilterState>
): string {
  const merged: MarketplaceFilterState = {
    ...DEFAULT_MARKETPLACE_FILTER_STATE,
    ...partialState,
  };

  const params = new URLSearchParams();

  const normalizedQ = normalizeSearchTextInput(merged.q);
  if (normalizedQ) {
    params.set("q", normalizedQ);
  }

  if (merged.category && CATEGORY_SET.has(merged.category)) {
    params.set("category", merged.category);
  }

  if (merged.condition && CONDITION_SET.has(merged.condition)) {
    params.set("condition", merged.condition);
  }

  const priceValidation = validatePriceFilterInputs(
    merged.minPrice,
    merged.maxPrice
  );
  if (priceValidation.valid) {
    if (priceValidation.minPrice !== undefined) {
      params.set("minPrice", normalizePriceNumberForState(priceValidation.minPrice));
    }
    if (priceValidation.maxPrice !== undefined) {
      params.set("maxPrice", normalizePriceNumberForState(priceValidation.maxPrice));
    }
  }

  const normalizedLocation = normalizeSearchTextInput(merged.location);
  if (normalizedLocation) {
    params.set("location", normalizedLocation);
  }

  if (merged.sort && SORT_SET.has(merged.sort) && merged.sort !== "newest") {
    params.set("sort", merged.sort);
  }

  if (
    Number.isInteger(merged.page) &&
    merged.page > DEFAULT_MARKETPLACE_PAGE &&
    merged.page <= 1000
  ) {
    params.set("page", String(merged.page));
  }

  if (
    Number.isInteger(merged.limit) &&
    merged.limit >= 1 &&
    merged.limit <= MAX_MARKETPLACE_LIMIT &&
    merged.limit !== DEFAULT_MARKETPLACE_LIMIT
  ) {
    params.set("limit", String(merged.limit));
  }

  return params.toString();
}

/**
 * Builds a clean shareable `/marketplace` URL preserving active filters/sorting.
 */
export function buildMarketplaceHref(
  partialState: Partial<MarketplaceFilterState> = {}
): string {
  const qs = serializeMarketplaceSearchParams(partialState);
  return qs ? `/marketplace?${qs}` : "/marketplace";
}

/**
 * Computes next state for search/filter/sort changes, resetting pagination to
 * page 1 whenever non-page filter criteria change.
 */
export function applyMarketplaceFilterPatch(
  current: MarketplaceFilterState,
  patch: Partial<MarketplaceFilterState>
): MarketplaceFilterState {
  const hasNonPageChange =
    ("q" in patch &&
      normalizeSearchTextInput(patch.q ?? "") !==
        normalizeSearchTextInput(current.q)) ||
    ("category" in patch && (patch.category ?? "") !== current.category) ||
    ("condition" in patch && (patch.condition ?? "") !== current.condition) ||
    ("minPrice" in patch && (patch.minPrice ?? "") !== current.minPrice) ||
    ("maxPrice" in patch && (patch.maxPrice ?? "") !== current.maxPrice) ||
    ("location" in patch &&
      normalizeSearchTextInput(patch.location ?? "") !==
        normalizeSearchTextInput(current.location)) ||
    ("sort" in patch && (patch.sort ?? "newest") !== current.sort) ||
    ("limit" in patch && (patch.limit ?? DEFAULT_MARKETPLACE_LIMIT) !== current.limit);

  const next: MarketplaceFilterState = {
    ...current,
    ...patch,
  };

  if (hasNonPageChange && !("page" in patch)) {
    next.page = DEFAULT_MARKETPLACE_PAGE;
  } else if (hasNonPageChange && patch.page === undefined) {
    next.page = DEFAULT_MARKETPLACE_PAGE;
  }

  return next;
}

/**
 * Clears all active search keywords, filters, sort (back to newest), and page
 * (back to 1), preserving only non-default `limit` if configured.
 */
export function clearAllMarketplaceFilters(
  current?: MarketplaceFilterState
): MarketplaceFilterState {
  return {
    ...DEFAULT_MARKETPLACE_FILTER_STATE,
    limit: current?.limit ?? DEFAULT_MARKETPLACE_LIMIT,
  };
}

/**
 * Removes one individual search or filter key and resets page to 1.
 */
export function removeIndividualMarketplaceFilter(
  current: MarketplaceFilterState,
  key: AppliedFilterChip["key"]
): MarketplaceFilterState {
  return applyMarketplaceFilterPatch(current, {
    [key]: "",
    page: DEFAULT_MARKETPLACE_PAGE,
  });
}

function formatInrChipValue(rawPrice: string): string {
  const num = Number(rawPrice);
  if (!Number.isFinite(num)) return rawPrice;
  const hasFraction = Math.abs(num - Math.round(num)) >= 0.005;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Builds removable applied-filter chips for active search & filter facets.
 */
export function getAppliedFilterChips(
  state: MarketplaceFilterState
): AppliedFilterChip[] {
  const chips: AppliedFilterChip[] = [];

  if (state.q) {
    chips.push({
      key: "q",
      label: "Search",
      valueLabel: `"${state.q}"`,
    });
  }

  if (state.category && state.category in CATEGORIES) {
    chips.push({
      key: "category",
      label: "Category",
      valueLabel: CATEGORIES[state.category].label,
    });
  }

  if (state.condition && state.condition in CONDITIONS) {
    chips.push({
      key: "condition",
      label: "Condition",
      valueLabel: CONDITIONS[state.condition].label,
    });
  }

  if (state.minPrice) {
    chips.push({
      key: "minPrice",
      label: "Min Price",
      valueLabel: formatInrChipValue(state.minPrice),
    });
  }

  if (state.maxPrice) {
    chips.push({
      key: "maxPrice",
      label: "Max Price",
      valueLabel: formatInrChipValue(state.maxPrice),
    });
  }

  if (state.location) {
    chips.push({
      key: "location",
      label: "Location",
      valueLabel: state.location,
    });
  }

  return chips;
}

/**
 * Counts active sidebar/sheet filter facets (`category`, `condition`,
 * `minPrice`, `maxPrice`, `location`), shown cleanly on Mobile Filters button.
 */
export function countAppliedPanelFilters(state: MarketplaceFilterState): number {
  let count = 0;
  if (state.category) count++;
  if (state.condition) count++;
  if (state.minPrice) count++;
  if (state.maxPrice) count++;
  if (state.location) count++;
  return count;
}

/**
 * Counts all active search + filter facets (including keyword `q`).
 */
export function countTotalAppliedFilters(state: MarketplaceFilterState): number {
  return countAppliedPanelFilters(state) + (state.q ? 1 : 0);
}

/**
 * Builds a bounded list of page numbers (with `"ellipsis"` markers) for
 * desktop & mobile pagination navigation.
 */
export function buildPaginationPageItems(
  currentPage: number,
  totalPages: number
): Array<number | "ellipsis"> {
  if (totalPages <= 1) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    items.push("ellipsis");
  }

  for (let p = windowStart; p <= windowEnd; p++) {
    items.push(p);
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis");
  }

  items.push(totalPages);
  return items;
}
