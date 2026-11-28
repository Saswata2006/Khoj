import { z } from "zod";

// ---------------------------------------------------------------------------
// Marketplace Enums & Constants (strictly aligned with Prisma schema)
// ---------------------------------------------------------------------------

export const MARKETPLACE_CATEGORIES = [
  "BOOKS",
  "ELECTRONICS",
  "CYCLES",
  "ACCESSORIES",
  "STATIONERY",
  "CLOTHING",
  "OTHER",
] as const;

export const MARKETPLACE_CONDITIONS = [
  "NEW",
  "LIKE_NEW",
  "GOOD",
  "FAIR",
] as const;

export const MARKETPLACE_STATUSES = ["ACTIVE", "SOLD", "REMOVED"] as const;

export const MARKETPLACE_SORT_OPTIONS = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
] as const;

export const MAX_SEARCH_QUERY_LENGTH = 100;
export const MAX_LOCATION_FILTER_LENGTH = 120;

export const DEFAULT_MARKETPLACE_PAGE = 1;
export const DEFAULT_MARKETPLACE_LIMIT = 12;
export const MAX_MARKETPLACE_LIMIT = 50;
export const MAX_PRICE_INR = 10_000_000;

// ---------------------------------------------------------------------------
// Reusable Field Validators
// ---------------------------------------------------------------------------

export const listingIdSchema = z
  .string({ error: "Listing ID is required." })
  .trim()
  .min(8, "Invalid listing identifier.")
  .max(64, "Invalid listing identifier.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid listing identifier.");

export const listingTitleSchema = z
  .string({ error: "Title is required." })
  .trim()
  .min(3, "Title must be at least 3 characters.")
  .max(120, "Title must be 120 characters or fewer.");

export const listingDescriptionSchema = z
  .string({ error: "Description is required." })
  .trim()
  .min(10, "Description must be at least 10 characters.")
  .max(3000, "Description must be 3000 characters or fewer.");

export const listingLocationSchema = z
  .string({ error: "Location is required." })
  .trim()
  .min(2, "Location must be at least 2 characters.")
  .max(120, "Location must be 120 characters or fewer.");

export const listingCategorySchema = z.enum(MARKETPLACE_CATEGORIES, {
  error: "Invalid marketplace category.",
});

export const listingConditionSchema = z.enum(MARKETPLACE_CONDITIONS, {
  error: "Invalid item condition.",
});

export const marketplaceStatusSchema = z.enum(MARKETPLACE_STATUSES, {
  error: "Invalid marketplace listing status.",
});

/**
 * Positive monetary value in INR with up to 2 decimal places
 * (compatible with Prisma Decimal(10, 2)).
 */
export const listingPriceInrSchema = z
  .number({ error: "Price in INR must be a valid number." })
  .finite("Price must be a finite number.")
  .gt(0, "Price must be greater than 0 INR.")
  .max(MAX_PRICE_INR, `Price cannot exceed ${MAX_PRICE_INR.toLocaleString("en-IN")} INR.`)
  .refine(
    (val) => Math.abs(val * 100 - Math.round(val * 100)) < 1e-6,
    { message: "Price can have at most 2 decimal places." }
  )
  .transform((val) => Math.round(val * 100) / 100);

// ---------------------------------------------------------------------------
// Request Payload Schemas (.strict() prevents mass assignment)
// ---------------------------------------------------------------------------

export const createMarketplaceListingSchema = z
  .object({
    title: listingTitleSchema,
    description: listingDescriptionSchema,
    price: listingPriceInrSchema,
    category: listingCategorySchema,
    condition: listingConditionSchema,
    location: listingLocationSchema,
  })
  .strict();

export const updateMarketplaceListingSchema = z
  .object({
    title: listingTitleSchema.optional(),
    description: listingDescriptionSchema.optional(),
    price: listingPriceInrSchema.optional(),
    category: listingCategorySchema.optional(),
    condition: listingConditionSchema.optional(),
    location: listingLocationSchema.optional(),
    status: marketplaceStatusSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

export const changeMarketplaceStatusSchema = z
  .object({
    status: marketplaceStatusSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// Query Parameter Helpers & Schemas (strictly validated)
// ---------------------------------------------------------------------------

const HAS_CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/;
const STRICT_NON_NEGATIVE_PRICE_RE = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const STRICT_INT_STRING_RE = /^-?\d+$/;

function parseBoundedIntQueryValue(
  raw: unknown,
  min: number,
  max: number
): unknown {
  if (raw === undefined) return undefined;

  let parsed: number;
  if (typeof raw === "number") {
    parsed = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!STRICT_INT_STRING_RE.test(trimmed)) {
      return Number.NaN;
    }
    parsed = Number(trimmed);
  } else {
    return Number.NaN;
  }

  if (!Number.isInteger(parsed)) return Number.NaN;
  if (parsed < min || parsed > max) return parsed;
  return parsed;
}

export function makeBoundedIntQuerySchema(
  label: string,
  min: number,
  max: number,
  defaultValue: number
) {
  return z.preprocess(
    (raw) => parseBoundedIntQueryValue(raw, min, max),
    z
      .number({ error: `${label} must be an integer.` })
      .int(`${label} must be an integer.`)
      .min(min, `${label} must be at least ${min}.`)
      .max(max, `${label} cannot exceed ${max}.`)
      .default(defaultValue)
  );
}

function makeOptionalQueryPriceSchema(label: string) {
  return z.preprocess(
    (raw): unknown => {
      if (raw === undefined) return undefined;
      if (typeof raw === "number") return raw;
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!STRICT_NON_NEGATIVE_PRICE_RE.test(trimmed)) {
          return Number.NaN;
        }
        return Number(trimmed);
      }
      return Number.NaN;
    },
    z
      .number({ error: `${label} must be a valid number.` })
      .finite(`${label} must be a finite number.`)
      .min(0, `${label} cannot be negative.`)
      .max(
        MAX_PRICE_INR,
        `${label} cannot exceed ${MAX_PRICE_INR.toLocaleString("en-IN")} INR.`
      )
      .refine((val) => Math.abs(val * 100 - Math.round(val * 100)) < 1e-6, {
        message: `${label} can have at most 2 decimal places.`,
      })
      .transform((val) => Math.round(val * 100) / 100)
      .optional()
  );
}

function makeOptionalNormalizedTextFilterSchema(
  label: string,
  maxLength: number
) {
  return z
    .string({ error: `${label} must be a text string.` })
    .max(500, `${label} must be ${maxLength} characters or fewer.`)
    .refine((val) => !HAS_CONTROL_CHARS_RE.test(val), {
      message: `${label} contains unsupported control characters.`,
    })
    .transform((val) => val.trim().replace(/\s+/g, " "))
    .refine((val) => val.length <= maxLength, {
      message: `${label} must be ${maxLength} characters or fewer.`,
    })
    .transform((val) => (val.length > 0 ? val : undefined))
    .optional();
}

export const listMarketplaceQuerySchema = z
  .object({
    q: makeOptionalNormalizedTextFilterSchema(
      "Search query",
      MAX_SEARCH_QUERY_LENGTH
    ),
    category: listingCategorySchema.optional(),
    condition: listingConditionSchema.optional(),
    minPrice: makeOptionalQueryPriceSchema("Minimum price"),
    maxPrice: makeOptionalQueryPriceSchema("Maximum price"),
    location: makeOptionalNormalizedTextFilterSchema(
      "Location filter",
      MAX_LOCATION_FILTER_LENGTH
    ),
    sort: z
      .enum(MARKETPLACE_SORT_OPTIONS, {
        error: "Unsupported sort option.",
      })
      .default("newest"),
    page: makeBoundedIntQuerySchema("Page", 1, 1000, DEFAULT_MARKETPLACE_PAGE),
    limit: makeBoundedIntQuerySchema(
      "Limit",
      1,
      MAX_MARKETPLACE_LIMIT,
      DEFAULT_MARKETPLACE_LIMIT
    ),
  })
  .strict()
  .refine(
    (q) =>
      q.minPrice === undefined ||
      q.maxPrice === undefined ||
      q.maxPrice >= q.minPrice,
    {
      message: "Maximum price must be greater than or equal to minimum price.",
      path: ["maxPrice"],
    }
  );

export const myListingsQuerySchema = z.object({
  page: makeBoundedIntQuerySchema("Page", 1, 1000, DEFAULT_MARKETPLACE_PAGE),
  limit: makeBoundedIntQuerySchema(
    "Limit",
    1,
    MAX_MARKETPLACE_LIMIT,
    DEFAULT_MARKETPLACE_LIMIT
  ),
  status: marketplaceStatusSchema.optional(),
});

export type CreateMarketplaceListingInput = z.infer<
  typeof createMarketplaceListingSchema
>;
export type UpdateMarketplaceListingInput = z.infer<
  typeof updateMarketplaceListingSchema
>;
export type ChangeMarketplaceStatusInput = z.infer<
  typeof changeMarketplaceStatusSchema
>;
export type ListMarketplaceQuery = z.infer<typeof listMarketplaceQuerySchema>;
export type MyListingsQuery = z.infer<typeof myListingsQuerySchema>;
