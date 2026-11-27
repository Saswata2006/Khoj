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
  "price_asc",
  "price_desc",
] as const;

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
// Query Parameter Schemas
// ---------------------------------------------------------------------------

export const listMarketplaceQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int("Page must be an integer.")
      .min(1, "Page must be at least 1.")
      .max(1000, "Page is out of bounds.")
      .default(DEFAULT_MARKETPLACE_PAGE),
    limit: z.coerce
      .number()
      .int("Limit must be an integer.")
      .min(1, "Limit must be at least 1.")
      .max(MAX_MARKETPLACE_LIMIT, `Limit cannot exceed ${MAX_MARKETPLACE_LIMIT}.`)
      .default(DEFAULT_MARKETPLACE_LIMIT),
    category: listingCategorySchema.optional(),
    condition: listingConditionSchema.optional(),
    search: z
      .string()
      .trim()
      .max(100, "Search query must be 100 characters or fewer.")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    minPrice: z.coerce
      .number()
      .finite()
      .min(0, "Minimum price cannot be negative.")
      .max(MAX_PRICE_INR)
      .optional(),
    maxPrice: z.coerce
      .number()
      .finite()
      .min(0, "Maximum price cannot be negative.")
      .max(MAX_PRICE_INR)
      .optional(),
    sort: z.enum(MARKETPLACE_SORT_OPTIONS).default("newest"),
  })
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
  page: z.coerce
    .number()
    .int("Page must be an integer.")
    .min(1, "Page must be at least 1.")
    .max(1000, "Page is out of bounds.")
    .default(DEFAULT_MARKETPLACE_PAGE),
  limit: z.coerce
    .number()
    .int("Limit must be an integer.")
    .min(1, "Limit must be at least 1.")
    .max(MAX_MARKETPLACE_LIMIT, `Limit cannot exceed ${MAX_MARKETPLACE_LIMIT}.`)
    .default(DEFAULT_MARKETPLACE_LIMIT),
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
