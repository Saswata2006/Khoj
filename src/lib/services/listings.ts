import "server-only";
import type { Category, Condition, ListingStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  changeMarketplaceStatusSchema,
  createMarketplaceListingSchema,
  listMarketplaceQuerySchema,
  listingIdSchema,
  myListingsQuerySchema,
  updateMarketplaceListingSchema,
  type ListMarketplaceQuery,
} from "@/lib/validators/listing";

// ---------------------------------------------------------------------------
// Error Type
// ---------------------------------------------------------------------------

export class ListingServiceError extends Error {
  public readonly status: 400 | 403 | 404 | 409;

  constructor(message: string, status: 400 | 403 | 404 | 409) {
    super(message);
    this.name = "ListingServiceError";
    this.status = status;
  }
}

export function isListingServiceError(
  error: unknown
): error is ListingServiceError {
  return error instanceof ListingServiceError;
}

// ---------------------------------------------------------------------------
// Public DTO & Safe Prisma Projection (never exposes private seller fields)
// ---------------------------------------------------------------------------

export interface PublicListingSeller {
  id: string;
  name: string | null;
  image: string | null;
}

export interface PublicListingImage {
  id: string;
  imageUrl: string;
  createdAt: Date;
}

export interface MarketplaceListingDTO {
  id: string;
  title: string;
  description: string;
  type: "SALE";
  category: Category;
  condition: Condition | null;
  price: number;
  location: string;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
  seller: PublicListingSeller;
  images: PublicListingImage[];
}

export interface MarketplaceListingCardDTO {
  id: string;
  title: string;
  type: "SALE";
  category: Category;
  condition: Condition | null;
  price: number;
  location: string;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
  images: PublicListingImage[];
}

export interface PaginatedMarketplaceListings {
  listings: MarketplaceListingDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface PaginatedMarketplaceListingCards {
  listings: MarketplaceListingCardDTO[];
  pagination: PaginatedMarketplaceListings["pagination"];
}

/**
 * Explicit Prisma select projection for marketplace listings.
 * Never selects seller email, emailVerified, role, sessions, or accounts.
 */
const MARKETPLACE_LISTING_SELECT = {
  id: true,
  title: true,
  description: true,
  type: true,
  category: true,
  condition: true,
  price: true,
  location: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
  images: {
    select: {
      id: true,
      imageUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

/**
 * Minimal projection for `/marketplace` product grid cards.
 * Omits `@db.Text` `description` (avoiding TOAST fetches and RSC bloat),
 * omits unused `user` join, and limits thumbnail selection to 1 primary photo.
 */
const MARKETPLACE_CARD_SELECT = {
  id: true,
  title: true,
  type: true,
  category: true,
  condition: true,
  price: true,
  location: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  images: {
    select: {
      id: true,
      imageUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: 1,
  },
} as const;

type SelectedListingCardRow = {
  id: string;
  title: string;
  type: "SALE" | "LOST" | "FOUND";
  category: Category;
  condition: Condition | null;
  price: Prisma.Decimal | number | string | null;
  location: string;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
  images: PublicListingImage[];
};

type SelectedListingRow = SelectedListingCardRow & {
  description: string;
  user: PublicListingSeller;
};

function toMarketplaceCardDTO(
  row: SelectedListingCardRow
): MarketplaceListingCardDTO {
  return {
    id: row.id,
    title: row.title,
    type: "SALE",
    category: row.category,
    condition: row.condition,
    price: row.price !== null ? Number(row.price) : 0,
    location: row.location,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    images: row.images.slice(0, 1).map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      createdAt: img.createdAt,
    })),
  };
}

function toMarketplaceDTO(row: SelectedListingRow): MarketplaceListingDTO {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: "SALE",
    category: row.category,
    condition: row.condition,
    price: row.price !== null ? Number(row.price) : 0,
    location: row.location,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    seller: {
      id: row.user.id,
      name: row.user.name,
      image: row.user.image,
    },
    images: row.images.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      createdAt: img.createdAt,
    })),
  };
}

function buildOrderBy(
  sort: "newest" | "oldest" | "price_asc" | "price_desc"
): Prisma.ListingOrderByWithRelationInput[] {
  if (sort === "oldest") {
    return [{ createdAt: "asc" }, { id: "asc" }];
  }
  if (sort === "price_asc") {
    return [{ price: "asc" }, { createdAt: "desc" }, { id: "desc" }];
  }
  if (sort === "price_desc") {
    return [{ price: "desc" }, { createdAt: "desc" }, { id: "desc" }];
  }
  return [{ createdAt: "desc" }, { id: "desc" }];
}

function buildPaginationMeta(page: number, limit: number, total: number) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Creates a new marketplace listing (`type: "SALE"`, `status: "ACTIVE"`)
 * owned strictly by the authenticated `userId`.
 */
export async function createMarketplaceListing(
  userId: string,
  rawInput: unknown
): Promise<MarketplaceListingDTO> {
  const parsed = createMarketplaceListingSchema.parse(rawInput);

  const created = await prisma.listing.create({
    data: {
      userId,
      title: parsed.title,
      description: parsed.description,
      type: "SALE",
      category: parsed.category,
      condition: parsed.condition,
      price: parsed.price.toFixed(2),
      location: parsed.location,
      status: "ACTIVE",
    },
    select: MARKETPLACE_LISTING_SELECT,
  });

  return toMarketplaceDTO(created);
}

function buildPublicMarketplaceWhere(
  query: ListMarketplaceQuery
): Prisma.ListingWhereInput {
  return {
    type: "SALE",
    status: "ACTIVE",
    ...(query.category ? { category: query.category } : {}),
    ...(query.condition ? { condition: query.condition } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { description: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.location
      ? {
          location: { contains: query.location, mode: "insensitive" },
        }
      : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          price: {
            ...(query.minPrice !== undefined
              ? { gte: query.minPrice.toFixed(2) }
              : {}),
            ...(query.maxPrice !== undefined
              ? { lte: query.maxPrice.toFixed(2) }
              : {}),
          },
        }
      : {}),
  };
}

/**
 * Retrieves paginated public marketplace listings (`type: "SALE"`, `status: "ACTIVE"`)
 * with full API projection (`description`, `seller`, all images) for `GET /api/listings`.
 * Lost & Found records and REMOVED/SOLD listings are strictly excluded.
 */
export async function getPublicMarketplaceListings(
  rawQuery: unknown
): Promise<PaginatedMarketplaceListings> {
  const query = listMarketplaceQuerySchema.parse(rawQuery ?? {});
  const where = buildPublicMarketplaceWhere(query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      select: MARKETPLACE_LISTING_SELECT,
      orderBy: buildOrderBy(query.sort),
      skip,
      take: query.limit,
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    listings: rows.map(toMarketplaceDTO),
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

/**
 * Retrieves paginated public marketplace cards (`type: "SALE"`, `status: "ACTIVE"`)
 * using `MARKETPLACE_CARD_SELECT` for `/marketplace` SSR pages (omits `@db.Text`
 * `description`, skips unused `users` join, and fetches at most 1 primary image).
 */
export async function getPublicMarketplaceListingCards(
  rawQuery: unknown
): Promise<PaginatedMarketplaceListingCards> {
  const query = listMarketplaceQuerySchema.parse(rawQuery ?? {});
  const where = buildPublicMarketplaceWhere(query);
  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      select: MARKETPLACE_CARD_SELECT,
      orderBy: buildOrderBy(query.sort),
      skip,
      take: query.limit,
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    listings: rows.map(toMarketplaceCardDTO),
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

/**
 * Retrieves a single public marketplace listing by ID (`type: "SALE"`).
 * Returns null for missing listings, Lost & Found records, or REMOVED listings.
 */
export async function getPublicMarketplaceListingById(
  rawId: string
): Promise<MarketplaceListingDTO | null> {
  const id = listingIdSchema.parse(rawId);

  const row = await prisma.listing.findFirst({
    where: {
      id,
      type: "SALE",
      status: { not: "REMOVED" },
    },
    select: MARKETPLACE_LISTING_SELECT,
  });

  return row ? toMarketplaceDTO(row) : null;
}

export type EditableListingCheckResult =
  | { status: "ok"; listing: MarketplaceListingDTO }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "not_editable"; listingStatus: ListingStatus };

/**
 * Loads a marketplace listing for the Edit page, enforcing ownership,
 * SALE type separation, and ACTIVE editable status server-side.
 */
export async function getOwnedMarketplaceListingForEdit(
  rawId: string,
  userId: string
): Promise<EditableListingCheckResult> {
  const parsedId = listingIdSchema.safeParse(rawId);
  if (!parsedId.success) {
    return { status: "not_found" };
  }

  const row = await prisma.listing.findUnique({
    where: { id: parsedId.data },
    select: {
      ...MARKETPLACE_LISTING_SELECT,
      userId: true,
    },
  });

  if (!row || row.type !== "SALE") {
    return { status: "not_found" };
  }

  if (row.userId !== userId) {
    return { status: "forbidden" };
  }

  if (row.status !== "ACTIVE") {
    return { status: "not_editable", listingStatus: row.status };
  }

  return { status: "ok", listing: toMarketplaceDTO(row) };
}

/**
 * Retrieves paginated marketplace listings (`type: "SALE"`) belonging
 * strictly to the authenticated `userId`.
 */
export async function getUserMarketplaceListings(
  userId: string,
  rawQuery: unknown
): Promise<PaginatedMarketplaceListings> {
  const query = myListingsQuerySchema.parse(rawQuery ?? {});
  const where: Prisma.ListingWhereInput = {
    userId,
    type: "SALE",
    ...(query.status ? { status: query.status } : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      select: MARKETPLACE_LISTING_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    listings: rows.map(toMarketplaceDTO),
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

function isPrismaNotFoundOrConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}

/**
 * Updates an owned marketplace listing inside a serializable transaction.
 * Enforces ownership (`403`), marketplace type (`404` if Lost/Found or missing),
 * and atomic status guards (`409` if already `REMOVED`).
 */
export async function updateOwnedMarketplaceListing(
  rawId: string,
  userId: string,
  rawInput: unknown
): Promise<MarketplaceListingDTO> {
  const id = listingIdSchema.parse(rawId);
  const parsed = updateMarketplaceListingSchema.parse(rawInput);

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.listing.findUnique({
        where: { id },
        select: { id: true, userId: true, type: true, status: true },
      });

      if (!existing || existing.type !== "SALE") {
        throw new ListingServiceError("Marketplace listing not found.", 404);
      }

      if (existing.userId !== userId) {
        throw new ListingServiceError(
          "You do not have permission to update this listing.",
          403
        );
      }

      if (existing.status === "REMOVED") {
        throw new ListingServiceError(
          "Removed listings cannot be modified.",
          409
        );
      }

      if (existing.status === "SOLD") {
        throw new ListingServiceError(
          "Sold listings cannot be modified.",
          409
        );
      }

      try {
        const updated = await tx.listing.update({
          where: {
            id: existing.id,
            userId,
            type: "SALE",
            status: "ACTIVE",
          },
          data: {
            ...(parsed.title !== undefined ? { title: parsed.title } : {}),
            ...(parsed.description !== undefined
              ? { description: parsed.description }
              : {}),
            ...(parsed.price !== undefined
              ? { price: parsed.price.toFixed(2) }
              : {}),
            ...(parsed.category !== undefined
              ? { category: parsed.category }
              : {}),
            ...(parsed.condition !== undefined
              ? { condition: parsed.condition }
              : {}),
            ...(parsed.location !== undefined
              ? { location: parsed.location }
              : {}),
            ...(parsed.status !== undefined ? { status: parsed.status } : {}),
          },
          select: MARKETPLACE_LISTING_SELECT,
        });

        return toMarketplaceDTO(updated);
      } catch (error) {
        if (isPrismaNotFoundOrConflict(error)) {
          throw new ListingServiceError(
            "Listing status changed concurrently. Please refresh and try again.",
            409
          );
        }
        throw error;
      }
    },
    { isolationLevel: "Serializable" }
  );
}

/**
 * Transitions an owned marketplace listing from `ACTIVE` to `SOLD` atomically.
 * Rejects `REMOVED` or already-`SOLD` listings with `409 Conflict`.
 */
export async function markMarketplaceListingSold(
  rawId: string,
  userId: string
): Promise<MarketplaceListingDTO> {
  const id = listingIdSchema.parse(rawId);
  const { status: targetStatus } = changeMarketplaceStatusSchema.parse({
    status: "SOLD",
  });

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.listing.findUnique({
        where: { id },
        select: { id: true, userId: true, type: true, status: true },
      });

      if (!existing || existing.type !== "SALE") {
        throw new ListingServiceError("Marketplace listing not found.", 404);
      }

      if (existing.userId !== userId) {
        throw new ListingServiceError(
          "You do not have permission to update this listing.",
          403
        );
      }

      if (existing.status === "REMOVED") {
        throw new ListingServiceError(
          "Removed listings cannot be marked as sold.",
          409
        );
      }

      if (existing.status === "SOLD") {
        throw new ListingServiceError(
          "Listing is already marked as sold.",
          409
        );
      }

      try {
        const updated = await tx.listing.update({
          where: {
            id: existing.id,
            userId,
            type: "SALE",
            status: "ACTIVE",
          },
          data: { status: targetStatus },
          select: MARKETPLACE_LISTING_SELECT,
        });

        return toMarketplaceDTO(updated);
      } catch (error) {
        if (isPrismaNotFoundOrConflict(error)) {
          throw new ListingServiceError(
            "Listing status changed concurrently. Please refresh and try again.",
            409
          );
        }
        throw error;
      }
    },
    { isolationLevel: "Serializable" }
  );
}

/**
 * Archives (soft-deletes) an owned marketplace listing by setting `status: "REMOVED"`.
 * Enforces ownership and non-removed status atomically.
 */
export async function removeOwnedMarketplaceListing(
  rawId: string,
  userId: string
): Promise<MarketplaceListingDTO> {
  const id = listingIdSchema.parse(rawId);

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.listing.findUnique({
        where: { id },
        select: { id: true, userId: true, type: true, status: true },
      });

      if (!existing || existing.type !== "SALE") {
        throw new ListingServiceError("Marketplace listing not found.", 404);
      }

      if (existing.userId !== userId) {
        throw new ListingServiceError(
          "You do not have permission to delete this listing.",
          403
        );
      }

      if (existing.status === "REMOVED") {
        throw new ListingServiceError("Listing has already been removed.", 409);
      }

      try {
        const archived = await tx.listing.update({
          where: {
            id: existing.id,
            userId,
            type: "SALE",
            status: { not: "REMOVED" },
          },
          data: { status: "REMOVED" },
          select: MARKETPLACE_LISTING_SELECT,
        });

        return toMarketplaceDTO(archived);
      } catch (error) {
        if (isPrismaNotFoundOrConflict(error)) {
          throw new ListingServiceError(
            "Listing status changed concurrently. Please refresh and try again.",
            409
          );
        }
        throw error;
      }
    },
    { isolationLevel: "Serializable" }
  );
}
