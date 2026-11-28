import { z } from "zod";
import { makeBoundedIntQuerySchema } from "@/lib/validators/listing";

// ---------------------------------------------------------------------------
// Contact Request Constants (aligned strictly with Prisma ContactStatus)
// ---------------------------------------------------------------------------

export const CONTACT_REQUEST_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
] as const;

export const CONTACT_REQUEST_DECISION_STATUSES = [
  "ACCEPTED",
  "REJECTED",
] as const;

export const DEFAULT_CONTACT_REQUEST_PAGE = 1;
export const DEFAULT_CONTACT_REQUEST_LIMIT = 12;
export const MAX_CONTACT_REQUEST_LIMIT = 50;

// ---------------------------------------------------------------------------
// Field & Payload Schemas (.strict() prevents mass assignment / unsupported fields)
// ---------------------------------------------------------------------------

export const contactRequestIdSchema = z
  .string({ error: "Contact request ID is required." })
  .trim()
  .min(8, "Invalid contact request identifier.")
  .max(64, "Invalid contact request identifier.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid contact request identifier.");

/**
 * ContactRequest creation currently has no client-supplied database fields:
 * `listingId` comes from the route path and `requesterId` from the session.
 * Rejecting any unexpected keys (including `status`, `requesterId`, `sellerId`,
 * or unsupported `message` until migrated) blocks mass-assignment safely.
 */
export const createContactRequestSchema = z.object({}).strict();

export const decideContactRequestSchema = z
  .object({
    status: z.enum(CONTACT_REQUEST_DECISION_STATUSES, {
      error: "Decision status must be ACCEPTED or REJECTED.",
    }),
  })
  .strict();

export const listContactRequestsQuerySchema = z
  .object({
    status: z
      .enum(CONTACT_REQUEST_STATUSES, {
        error: "Invalid contact request status.",
      })
      .optional(),
    page: makeBoundedIntQuerySchema(
      "Page",
      1,
      1000,
      DEFAULT_CONTACT_REQUEST_PAGE
    ),
    limit: makeBoundedIntQuerySchema(
      "Limit",
      1,
      MAX_CONTACT_REQUEST_LIMIT,
      DEFAULT_CONTACT_REQUEST_LIMIT
    ),
  })
  .strict();

export type ContactRequestStatusValue =
  (typeof CONTACT_REQUEST_STATUSES)[number];
export type ContactRequestDecisionInput = z.infer<
  typeof decideContactRequestSchema
>;
export type ListContactRequestsQuery = z.infer<
  typeof listContactRequestsQuerySchema
>;
