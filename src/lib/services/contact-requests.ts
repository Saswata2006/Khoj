import "server-only";
import type {
  Category,
  Condition,
  ContactStatus,
  ListingStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  checkContactRequestIpRateLimit,
  checkContactRequestUserRateLimit,
} from "@/lib/rate-limit";
import { listingIdSchema } from "@/lib/validators/listing";
import {
  contactRequestIdSchema,
  createContactRequestSchema,
  decideContactRequestSchema,
  listContactRequestsQuerySchema,
} from "@/lib/validators/contact-request";

// ---------------------------------------------------------------------------
// Error Type
// ---------------------------------------------------------------------------

export class ContactRequestServiceError extends Error {
  public readonly status: 400 | 403 | 404 | 409 | 429;
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    status: 400 | 403 | 404 | 409 | 429,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ContactRequestServiceError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isContactRequestServiceError(
  error: unknown
): error is ContactRequestServiceError {
  return error instanceof ContactRequestServiceError;
}

// ---------------------------------------------------------------------------
// Safe Privacy-First DTOs & Prisma Projections
// ---------------------------------------------------------------------------

export interface ContactParticipantDTO {
  id: string;
  name: string | null;
  image: string | null;
}

export interface ContactRequestListingSummaryDTO {
  id: string;
  title: string;
  category: Category;
  condition: Condition | null;
  price: number;
  location: string;
  status: ListingStatus;
  primaryImageUrl: string | null;
}

export interface ContactDisclosureStatus {
  canRevealContact: false;
  consentRecorded: false;
  status:
    | "PENDING_SELLER_RESPONSE"
    | "DEFERRED_CONSENT_SCHEMA_REQUIRED"
    | "REQUEST_REJECTED";
  message: string;
}

export interface ContactRequestDTO {
  id: string;
  listingId: string;
  requesterId: string;
  status: ContactStatus;
  viewerRole: "BUYER" | "SELLER";
  createdAt: Date;
  updatedAt: Date;
  requester: ContactParticipantDTO;
  seller: ContactParticipantDTO;
  listing: ContactRequestListingSummaryDTO;
  contactDisclosure: ContactDisclosureStatus;
}

export interface PaginatedContactRequests {
  contactRequests: ContactRequestDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ContactRequestCountsSummary {
  incomingPending: number;
  incomingTotal: number;
  outgoingPending: number;
  outgoingAccepted: number;
  outgoingTotal: number;
  total: number;
}

/**
 * Explicit Prisma select projection for ContactRequest rows.
 * NEVER selects `email`, `emailVerified`, `role`, `location`, `hostelBlock`,
 * `sessions`, or `accounts` on either buyer (`requester`) or seller (`listing.user`).
 */
const CONTACT_REQUEST_SELECT = {
  id: true,
  listingId: true,
  requesterId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  requester: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
  listing: {
    select: {
      id: true,
      userId: true,
      title: true,
      type: true,
      category: true,
      condition: true,
      price: true,
      location: true,
      status: true,
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      images: {
        select: {
          imageUrl: true,
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  },
} as const;

type SelectedContactRequestRow = {
  id: string;
  listingId: string;
  requesterId: string;
  status: ContactStatus;
  createdAt: Date;
  updatedAt: Date;
  requester: ContactParticipantDTO;
  listing: {
    id: string;
    userId: string;
    title: string;
    type: "SALE" | "LOST" | "FOUND";
    category: Category;
    condition: Condition | null;
    price: unknown;
    location: string;
    status: ListingStatus;
    user: ContactParticipantDTO;
    images: Array<{ imageUrl: string }>;
  };
};

function buildContactDisclosureStatus(
  status: ContactStatus
): ContactDisclosureStatus {
  if (status === "ACCEPTED") {
    return {
      canRevealContact: false,
      consentRecorded: false,
      status: "DEFERRED_CONSENT_SCHEMA_REQUIRED",
      message:
        "Seller accepted this request. Direct email/phone sharing remains disabled until an explicit consent-sharing schema migration is applied.",
    };
  }

  if (status === "REJECTED") {
    return {
      canRevealContact: false,
      consentRecorded: false,
      status: "REQUEST_REJECTED",
      message: "This contact request was declined by the seller.",
    };
  }

  return {
    canRevealContact: false,
    consentRecorded: false,
    status: "PENDING_SELLER_RESPONSE",
    message:
      "Contact details stay hidden until the seller accepts and explicit consent sharing is available.",
  };
}

function toContactRequestDTO(
  row: SelectedContactRequestRow,
  viewerRole: "BUYER" | "SELLER"
): ContactRequestDTO {
  return {
    id: row.id,
    listingId: row.listingId,
    requesterId: row.requesterId,
    status: row.status,
    viewerRole,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    requester: {
      id: row.requester.id,
      name: row.requester.name,
      image: row.requester.image,
    },
    seller: {
      id: row.listing.user.id,
      name: row.listing.user.name,
      image: row.listing.user.image,
    },
    listing: {
      id: row.listing.id,
      title: row.listing.title,
      category: row.listing.category,
      condition: row.listing.condition,
      price: row.listing.price !== null ? Number(row.listing.price) : 0,
      location: row.listing.location,
      status: row.listing.status,
      primaryImageUrl: row.listing.images[0]?.imageUrl ?? null,
    },
    contactDisclosure: buildContactDisclosureStatus(row.status),
  };
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

function getPrismaErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Service Operations
// ---------------------------------------------------------------------------

/**
 * Initiates a new buyer contact request (`PENDING`) for an `ACTIVE` `SALE` listing.
 * - Derives buyer identity strictly from `buyerId` (session).
 * - Derives seller ownership strictly from the target listing (`listing.userId`).
 * - Blocks self-contact, Lost/Found listings, SOLD/REMOVED listings, duplicates,
 *   mass assignment, and request spam via PostgreSQL atomic rate limiting.
 */
export async function createContactRequest(
  rawListingId: string,
  buyerId: string,
  rawBody: unknown = {},
  clientIp?: string | null
): Promise<ContactRequestDTO> {
  const listingId = listingIdSchema.parse(rawListingId);
  createContactRequestSchema.parse(rawBody ?? {});

  const [userRateLimit, ipRateLimit] = await Promise.all([
    checkContactRequestUserRateLimit(buyerId),
    checkContactRequestIpRateLimit(clientIp),
  ]);

  if (!userRateLimit.allowed || !ipRateLimit.allowed) {
    const retryAfterSeconds = Math.max(
      userRateLimit.allowed ? 0 : userRateLimit.retryAfterSeconds,
      ipRateLimit.allowed ? 0 : ipRateLimit.retryAfterSeconds
    );
    throw new ContactRequestServiceError(
      "Too many contact requests sent. Please wait before trying again.",
      429,
      retryAfterSeconds
    );
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const listing = await tx.listing.findUnique({
          where: { id: listingId },
          select: { id: true, userId: true, type: true, status: true },
        });

        if (!listing || listing.type !== "SALE" || listing.status === "REMOVED") {
          throw new ContactRequestServiceError(
            "Marketplace listing not found.",
            404
          );
        }

        if (listing.userId === buyerId) {
          throw new ContactRequestServiceError(
            "You cannot send a contact request for your own listing.",
            400
          );
        }

        if (listing.status !== "ACTIVE") {
          throw new ContactRequestServiceError(
            "Contact requests can only be sent for active marketplace listings.",
            409
          );
        }

        const existing = await tx.contactRequest.findUnique({
          where: {
            listingId_requesterId: {
              listingId,
              requesterId: buyerId,
            },
          },
          select: { id: true, status: true },
        });

        if (existing) {
          const duplicateMessage =
            existing.status === "ACCEPTED"
              ? "Your contact request for this listing has already been accepted."
              : existing.status === "REJECTED"
                ? "Your previous contact request for this listing was declined."
                : "You already have a pending contact request for this listing.";

          throw new ContactRequestServiceError(duplicateMessage, 409);
        }

        const created = await tx.contactRequest.create({
          data: {
            listingId,
            requesterId: buyerId,
            status: "PENDING",
          },
          select: CONTACT_REQUEST_SELECT,
        });

        return toContactRequestDTO(created, "BUYER");
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (isContactRequestServiceError(error)) {
      throw error;
    }

    const code = getPrismaErrorCode(error);
    if (code === "P2002" || code === "P2034") {
      throw new ContactRequestServiceError(
        "A contact request already exists for this listing or conflicted concurrently.",
        409
      );
    }

    throw error;
  }
}

/**
 * Lists incoming contact requests for marketplace (`type: "SALE"`) listings
 * owned by the authenticated seller (`sellerId`).
 */
export async function getIncomingContactRequests(
  sellerId: string,
  rawQuery: unknown = {}
): Promise<PaginatedContactRequests> {
  const query = listContactRequestsQuerySchema.parse(rawQuery ?? {});

  const where = {
    listing: {
      userId: sellerId,
      type: "SALE" as const,
    },
    ...(query.status ? { status: query.status } : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.contactRequest.findMany({
      where,
      select: CONTACT_REQUEST_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.contactRequest.count({ where }),
  ]);

  return {
    contactRequests: rows.map((row) => toContactRequestDTO(row, "SELLER")),
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

/**
 * Lists outgoing contact requests initiated by the authenticated buyer (`buyerId`)
 * on marketplace (`type: "SALE"`) listings.
 */
export async function getOutgoingContactRequests(
  buyerId: string,
  rawQuery: unknown = {}
): Promise<PaginatedContactRequests> {
  const query = listContactRequestsQuerySchema.parse(rawQuery ?? {});

  const where = {
    requesterId: buyerId,
    listing: {
      type: "SALE" as const,
    },
    ...(query.status ? { status: query.status } : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [rows, total] = await Promise.all([
    prisma.contactRequest.findMany({
      where,
      select: CONTACT_REQUEST_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.contactRequest.count({ where }),
  ]);

  return {
    contactRequests: rows.map((row) => toContactRequestDTO(row, "BUYER")),
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

/**
 * Retrieves a single marketplace contact request authorized strictly for
 * either the buyer (`requesterId`) or listing seller (`listing.userId`).
 */
export async function getContactRequestById(
  rawRequestId: string,
  actorUserId: string
): Promise<ContactRequestDTO> {
  const id = contactRequestIdSchema.parse(rawRequestId);

  const row = await prisma.contactRequest.findUnique({
    where: { id },
    select: CONTACT_REQUEST_SELECT,
  });

  if (!row || row.listing.type !== "SALE") {
    throw new ContactRequestServiceError("Contact request not found.", 404);
  }

  const isSeller = row.listing.userId === actorUserId;
  const isBuyer = row.requesterId === actorUserId;

  if (!isSeller && !isBuyer) {
    throw new ContactRequestServiceError(
      "You do not have permission to view this contact request.",
      403
    );
  }

  return toContactRequestDTO(row, isSeller ? "SELLER" : "BUYER");
}

/**
 * Transitions a `PENDING` marketplace contact request to `ACCEPTED` or `REJECTED`.
 * Strictly seller-only, atomic (`Serializable` + filtered `PENDING` update), and
 * refuses acceptance if the underlying listing is `SOLD` or `REMOVED`.
 */
export async function decideContactRequest(
  rawRequestId: string,
  sellerId: string,
  rawInput: unknown
): Promise<ContactRequestDTO> {
  const id = contactRequestIdSchema.parse(rawRequestId);
  const parsed = decideContactRequestSchema.parse(rawInput);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.contactRequest.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            requesterId: true,
            listing: {
              select: {
                id: true,
                userId: true,
                type: true,
                status: true,
              },
            },
          },
        });

        if (!existing || existing.listing.type !== "SALE") {
          throw new ContactRequestServiceError(
            "Contact request not found.",
            404
          );
        }

        if (existing.listing.userId !== sellerId) {
          throw new ContactRequestServiceError(
            "Only the listing seller can accept or reject this contact request.",
            403
          );
        }

        if (existing.status !== "PENDING") {
          throw new ContactRequestServiceError(
            `This contact request has already been ${existing.status.toLowerCase()}.`,
            409
          );
        }

        if (existing.listing.status === "REMOVED") {
          throw new ContactRequestServiceError(
            "Contact requests cannot be modified for a removed listing.",
            409
          );
        }

        if (
          parsed.status === "ACCEPTED" &&
          existing.listing.status !== "ACTIVE"
        ) {
          throw new ContactRequestServiceError(
            "Contact requests cannot be accepted because this listing is no longer active.",
            409
          );
        }

        const updated = await tx.contactRequest.update({
          where: {
            id: existing.id,
            status: "PENDING",
            listing: {
              userId: sellerId,
              type: "SALE",
              ...(parsed.status === "ACCEPTED"
                ? { status: "ACTIVE" }
                : { status: { not: "REMOVED" } }),
            },
          },
          data: { status: parsed.status },
          select: CONTACT_REQUEST_SELECT,
        });

        return toContactRequestDTO(updated, "SELLER");
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (isContactRequestServiceError(error)) {
      throw error;
    }

    const code = getPrismaErrorCode(error);
    if (code === "P2025" || code === "P2034") {
      throw new ContactRequestServiceError(
        "Contact request status or listing availability changed concurrently. Please refresh and try again.",
        409
      );
    }

    throw error;
  }
}

/**
 * Returns user-scoped incoming & outgoing marketplace contact request counts
 * for dashboard cards and navigation badges.
 */
export async function getContactRequestCounts(
  userId: string
): Promise<ContactRequestCountsSummary> {
  const [
    incomingPending,
    incomingTotal,
    outgoingPending,
    outgoingAccepted,
    outgoingTotal,
  ] = await Promise.all([
    prisma.contactRequest.count({
      where: {
        status: "PENDING",
        listing: { userId, type: "SALE" },
      },
    }),
    prisma.contactRequest.count({
      where: {
        listing: { userId, type: "SALE" },
      },
    }),
    prisma.contactRequest.count({
      where: {
        requesterId: userId,
        status: "PENDING",
        listing: { type: "SALE" },
      },
    }),
    prisma.contactRequest.count({
      where: {
        requesterId: userId,
        status: "ACCEPTED",
        listing: { type: "SALE" },
      },
    }),
    prisma.contactRequest.count({
      where: {
        requesterId: userId,
        listing: { type: "SALE" },
      },
    }),
  ]);

  return {
    incomingPending,
    incomingTotal,
    outgoingPending,
    outgoingAccepted,
    outgoingTotal,
    total: incomingTotal + outgoingTotal,
  };
}

/**
 * Narrowly scoped server-only lookup for the authenticated buyer's existing
 * contact request on a specific public SALE listing.
 * Never queries private seller/buyer fields (`email`, `location`, `hostelBlock`).
 */
export async function getBuyerContactRequestForListing(
  rawListingId: string,
  buyerId: string
): Promise<ContactRequestDTO | null> {
  const parsedListingId = listingIdSchema.safeParse(rawListingId);
  const trimmedBuyerId = buyerId.trim();
  if (!parsedListingId.success || !trimmedBuyerId) {
    return null;
  }

  const row = await prisma.contactRequest.findUnique({
    where: {
      listingId_requesterId: {
        listingId: parsedListingId.data,
        requesterId: trimmedBuyerId,
      },
    },
    select: CONTACT_REQUEST_SELECT,
  });

  if (!row || row.listing.type !== "SALE" || row.listing.status === "REMOVED") {
    return null;
  }

  return toContactRequestDTO(row, "BUYER");
}
