import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types & Schemas
// ---------------------------------------------------------------------------

/**
 * Strict allowlisted schema for user profile updates.
 * Rejects unknown keys (such as `role`, `email`, `emailVerified`, `id`)
 * to prevent mass-assignment and privilege-escalation attacks.
 */
export const profileUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Display name is required.")
      .max(80, "Display name must be 80 characters or fewer."),
    location: z
      .string()
      .trim()
      .max(120, "Location must be 120 characters or fewer.")
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
    hostelBlock: z
      .string()
      .trim()
      .max(80, "Hostel or campus info must be 80 characters or fewer.")
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
  })
  .strict();

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export interface SafeUserProfile {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  location: string | null;
  hostelBlock: string | null;
  role: "USER" | "ADMIN";
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileCompletionStatus {
  isComplete: boolean;
  completedCount: number;
  totalCount: number;
  missingFields: string[];
}

export interface DashboardSummary {
  profile: SafeUserProfile;
  completion: ProfileCompletionStatus;
  counts: {
    listings: number;
    claims: number;
    contactRequests: number;
  };
}

const SAFE_PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  location: true,
  hostelBlock: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getProfileCompletion(
  profile: Pick<SafeUserProfile, "name" | "location">
): ProfileCompletionStatus {
  const missingFields: string[] = [];
  if (!profile.name?.trim()) {
    missingFields.push("Display name");
  }
  if (!profile.location?.trim()) {
    missingFields.push("Location");
  }

  const totalCount = 2;
  const completedCount = totalCount - missingFields.length;

  return {
    isComplete: missingFields.length === 0,
    completedCount,
    totalCount,
    missingFields,
  };
}

// ---------------------------------------------------------------------------
// Data Access Functions (always scoped to authenticated userId)
// ---------------------------------------------------------------------------

export async function getSafeUserProfile(
  userId: string
): Promise<SafeUserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_PROFILE_SELECT,
  });
  return user;
}

export async function getDashboardSummary(
  userId: string
): Promise<DashboardSummary | null> {
  const [profile, listings, claims, contactRequests] = await Promise.all([
    getSafeUserProfile(userId),
    prisma.listing.count({ where: { userId } }),
    prisma.claim.count({ where: { claimantId: userId } }),
    prisma.contactRequest.count({
      where: {
        OR: [
          { requesterId: userId },
          { listing: { userId, type: "SALE" } },
        ],
      },
    }),
  ]);

  if (!profile) return null;

  return {
    profile,
    completion: getProfileCompletion(profile),
    counts: {
      listings,
      claims,
      contactRequests,
    },
  };
}

/**
 * Validates and applies an allowlisted profile update strictly to `userId`.
 */
export async function updateOwnProfile(
  userId: string,
  rawInput: unknown
): Promise<SafeUserProfile> {
  const parsed = profileUpdateSchema.parse(rawInput);

  // Explicit allowlist — role, email, emailVerified, id are never writable here
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: parsed.name,
      location: parsed.location,
      hostelBlock: parsed.hostelBlock,
    },
    select: SAFE_PROFILE_SELECT,
  });

  return updated;
}
