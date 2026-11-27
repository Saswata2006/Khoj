import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
  MARKETPLACE_STATUSES,
  createMarketplaceListingSchema,
  type CreateMarketplaceListingInput,
  type UpdateMarketplaceListingInput,
} from "@/lib/validators/listing";
import { CATEGORIES, CONDITIONS, LISTING_STATUSES } from "@/constants/categories";
import {
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_BYTES,
} from "@/lib/validators/image";

export {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
  MARKETPLACE_STATUSES,
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_BYTES,
};

export interface ListingFormValues {
  title: string;
  description: string;
  category: string;
  condition: string;
  price: string;
  location: string;
}

export type ListingFormFieldErrors = Partial<
  Record<keyof ListingFormValues, string>
>;

export interface UploadedImageSummary {
  id: string;
  imageUrl: string;
  createdAt: Date | string;
}

export type QueuedUploadStatus = "queued" | "uploading" | "uploaded" | "error";

export interface QueuedUploadItem {
  id: string;
  file: File;
  previewUrl: string;
  status: QueuedUploadStatus;
  error?: string;
  uploadedImage?: UploadedImageSummary;
}

const ALLOWED_CLIENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/**
 * Validates listing form inputs using the authoritative Zod creation schema
 * so frontend validation matches server rules exactly.
 */
export function validateListingFormValues(values: ListingFormValues): {
  valid: boolean;
  fieldErrors: ListingFormFieldErrors;
  data?: CreateMarketplaceListingInput;
} {
  const numericPrice =
    values.price.trim() === "" ? Number.NaN : Number(values.price.trim());

  const result = createMarketplaceListingSchema.safeParse({
    title: values.title,
    description: values.description,
    category: values.category,
    condition: values.condition,
    price: numericPrice,
    location: values.location,
  });

  if (result.success) {
    return {
      valid: true,
      fieldErrors: {},
      data: result.data,
    };
  }

  const fieldErrors: ListingFormFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof ListingFormValues | undefined;
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return {
    valid: false,
    fieldErrors,
  };
}

/**
 * Validates newly selected image files against count (max 5), type
 * (JPEG/PNG/WebP), and size (<= 3 MiB). Client-side UX guard only;
 * server-side magic-byte and Serializable checks remain authoritative.
 */
export function validateSelectedImageFiles(
  incomingFiles: File[],
  existingAndQueuedCount: number
): {
  accepted: File[];
  errors: string[];
} {
  const accepted: File[] = [];
  const errors: string[] = [];
  let slotsLeft = Math.max(0, MAX_IMAGES_PER_LISTING - existingAndQueuedCount);

  if (slotsLeft === 0 && incomingFiles.length > 0) {
    return {
      accepted: [],
      errors: [
        `Maximum of ${MAX_IMAGES_PER_LISTING} images per listing reached. Remove an image to add another.`,
      ],
    };
  }

  for (const file of incomingFiles) {
    const mime = file.type.toLowerCase().trim();
    if (!ALLOWED_CLIENT_MIME_TYPES.has(mime)) {
      errors.push(
        `"${file.name}" is not supported. Please select a JPEG, PNG, or WebP image.`
      );
      continue;
    }

    if (file.size <= 0) {
      errors.push(`"${file.name}" is empty and cannot be uploaded.`);
      continue;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      errors.push(
        `"${file.name}" exceeds the 3 MiB size limit.`
      );
      continue;
    }

    if (slotsLeft <= 0) {
      errors.push(
        `Maximum of ${MAX_IMAGES_PER_LISTING} images allowed per listing. Extra files were skipped.`
      );
      break;
    }

    accepted.push(file);
    slotsLeft--;
  }

  return { accepted, errors };
}

/**
 * Executes async tasks with bounded concurrency.
 */
export async function runWithBoundedConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const safeConcurrency = Math.max(1, concurrency);
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(safeConcurrency, items.length) },
    () => runWorker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Uploads one image to an owned marketplace listing via POST /api/listings/[id]/images.
 */
export async function uploadListingImageRequest(
  listingId: string,
  file: File
): Promise<{ ok: true; image: UploadedImageSummary } | { ok: false; error: string }> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/listings/${listingId}/images`, {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      image?: UploadedImageSummary;
      error?: string;
    };

    if (!response.ok || !payload.image) {
      return {
        ok: false,
        error: payload.error ?? "Failed to upload image.",
      };
    }

    return { ok: true, image: payload.image };
  } catch {
    return {
      ok: false,
      error: "Network error while uploading image.",
    };
  }
}

export interface MarketplaceListingClientDTO {
  id: string;
  title: string;
  description: string;
  type: "SALE";
  category: string;
  condition: string | null;
  price: number;
  location: string;
  status: "ACTIVE" | "SOLD" | "RESOLVED" | "REMOVED";
  createdAt: Date | string;
  updatedAt: Date | string;
  images: UploadedImageSummary[];
}

export interface CloudinaryDeliveryPolicy {
  cloudName?: string;
  environment?: "development" | "preview" | "production";
}

export interface ListingMutationFailure {
  ok: false;
  status: number;
  error: string;
  isAmbiguousNetworkError?: boolean;
}

export type ListingMutationResult =
  | { ok: true; listing: MarketplaceListingClientDTO }
  | ListingMutationFailure;

/**
 * Calls POST /api/listings to create a new ACTIVE marketplace listing.
 * Uses a 15s request timeout where supported and labels network/timeout
 * failures as ambiguous so users can check My Listings before retrying.
 */
export async function createListingRequest(
  input: CreateMarketplaceListingInput
): Promise<ListingMutationResult> {
  try {
    const signal =
      typeof AbortSignal !== "undefined" &&
      typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(15_000)
        : undefined;

    const response = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      ...(signal ? { signal } : {}),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      listing?: MarketplaceListingClientDTO;
      error?: string;
    };

    if (!response.ok || !payload.listing) {
      return {
        ok: false,
        status: response.status,
        error: payload.error ?? "Unable to create listing. Please try again.",
      };
    }

    return { ok: true, listing: payload.listing };
  } catch {
    return {
      ok: false,
      status: 0,
      isAmbiguousNetworkError: true,
      error:
        "Connection was interrupted before confirmation was received. Check My Listings before retrying to avoid creating a duplicate listing.",
    };
  }
}

/**
 * Calls PATCH /api/listings/[id] to update details or availability status.
 */
export async function updateListingRequest(
  listingId: string,
  input: UpdateMarketplaceListingInput
): Promise<ListingMutationResult> {
  try {
    const response = await fetch(`/api/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      listing?: MarketplaceListingClientDTO;
      error?: string;
    };

    if (!response.ok || !payload.listing) {
      return {
        ok: false,
        status: response.status,
        error: payload.error ?? "Unable to update listing. Please try again.",
      };
    }

    return { ok: true, listing: payload.listing };
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Network error while updating listing. Please try again.",
    };
  }
}

/**
 * Calls DELETE /api/listings/[id] to archive (soft-delete) a listing.
 */
export async function archiveListingRequest(
  listingId: string
): Promise<ListingMutationResult> {
  try {
    const response = await fetch(`/api/listings/${listingId}`, {
      method: "DELETE",
    });

    const payload = (await response.json().catch(() => ({}))) as {
      listing?: MarketplaceListingClientDTO;
      error?: string;
    };

    if (!response.ok || !payload.listing) {
      return {
        ok: false,
        status: response.status,
        error: payload.error ?? "Unable to remove listing. Please try again.",
      };
    }

    return { ok: true, listing: payload.listing };
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Network error while removing listing. Please try again.",
    };
  }
}

/**
 * Calls DELETE /api/listings/[id]/images/[imageId] to remove a saved image.
 */
export async function deleteListingImageRequest(
  listingId: string,
  imageId: string
): Promise<
  | { ok: true; imageId: string; notice?: string }
  | { ok: false; status: number; error: string }
> {
  try {
    const response = await fetch(
      `/api/listings/${listingId}/images/${imageId}`,
      { method: "DELETE" }
    );

    const payload = (await response.json().catch(() => ({}))) as {
      deleted?: boolean;
      imageId?: string;
      notice?: string;
      error?: string;
    };

    if (!response.ok || !payload.deleted) {
      return {
        ok: false,
        status: response.status,
        error: payload.error ?? "Unable to delete image. Please try again.",
      };
    }

    return {
      ok: true,
      imageId: payload.imageId ?? imageId,
      ...(payload.notice ? { notice: payload.notice } : {}),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Network error while deleting image. Please try again.",
    };
  }
}

export interface BatchImageUploadCallbacks {
  onItemStart?: (queueId: string) => void;
  onItemSuccess?: (queueId: string, image: UploadedImageSummary) => void;
  onItemError?: (queueId: string, error: string) => void;
}

export interface BatchImageUploadResult {
  uploaded: Array<{ queueId: string; image: UploadedImageSummary }>;
  failed: Array<{ queueId: string; error: string }>;
}

/**
 * Uploads queued/errored images sequentially in bounded concurrency (default 2)
 * against POST /api/listings/[id]/images.
 */
export async function uploadPendingListingImages(
  listingId: string,
  items: QueuedUploadItem[],
  callbacks: BatchImageUploadCallbacks = {},
  concurrency = 2
): Promise<BatchImageUploadResult> {
  const uploaded: Array<{ queueId: string; image: UploadedImageSummary }> = [];
  const failed: Array<{ queueId: string; error: string }> = [];

  if (items.length === 0) {
    return { uploaded, failed };
  }

  await runWithBoundedConcurrency(items, concurrency, async (item) => {
    callbacks.onItemStart?.(item.id);
    const res = await uploadListingImageRequest(listingId, item.file);
    if (res.ok) {
      uploaded.push({ queueId: item.id, image: res.image });
      callbacks.onItemSuccess?.(item.id, res.image);
    } else {
      failed.push({ queueId: item.id, error: res.error });
      callbacks.onItemError?.(item.id, res.error);
    }
  });

  return { uploaded, failed };
}

export interface CreateListingWorkflowResult {
  stage: "validation" | "create" | "update" | "images" | "done";
  ok: boolean;
  listingId: string | null;
  fieldErrors?: ListingFormFieldErrors;
  error?: string;
  isAmbiguousNetworkError?: boolean;
  uploadedCount: number;
  failedCount: number;
}

/**
 * Coordinates duplicate-safe listing creation (and optional detail update if
 * already created prior to retrying failed image uploads) followed by bounded
 * concurrent image uploads.
 */
export async function executeCreateListingWorkflow(params: {
  values: ListingFormValues;
  existingListingId: string | null;
  lastSavedSnapshot: string | null;
  queuedImages: QueuedUploadItem[];
  onListingSaved: (
    listing: MarketplaceListingClientDTO,
    snapshot: string
  ) => void;
  uploadCallbacks?: BatchImageUploadCallbacks;
  concurrency?: number;
}): Promise<CreateListingWorkflowResult> {
  const validation = validateListingFormValues(params.values);
  if (!validation.valid || !validation.data) {
    return {
      stage: "validation",
      ok: false,
      listingId: params.existingListingId,
      fieldErrors: validation.fieldErrors,
      error: "Please fix the highlighted form errors before continuing.",
      uploadedCount: 0,
      failedCount: 0,
    };
  }

  const serializedInput = JSON.stringify(validation.data);
  let targetListingId = params.existingListingId;

  if (!targetListingId) {
    const createRes = await createListingRequest(validation.data);
    if (!createRes.ok) {
      return {
        stage: "create",
        ok: false,
        listingId: null,
        error: createRes.error,
        isAmbiguousNetworkError: createRes.isAmbiguousNetworkError,
        uploadedCount: 0,
        failedCount: 0,
      };
    }

    targetListingId = createRes.listing.id;
    params.onListingSaved(createRes.listing, serializedInput);
  } else if (params.lastSavedSnapshot !== serializedInput) {
    const updateRes = await updateListingRequest(
      targetListingId,
      validation.data
    );
    if (!updateRes.ok) {
      return {
        stage: "update",
        ok: false,
        listingId: targetListingId,
        error: updateRes.error,
        uploadedCount: 0,
        failedCount: 0,
      };
    }

    params.onListingSaved(updateRes.listing, serializedInput);
  }

  const pendingItems = params.queuedImages.filter(
    (item) => item.status === "queued" || item.status === "error"
  );

  const uploadRes = await uploadPendingListingImages(
    targetListingId,
    pendingItems,
    params.uploadCallbacks,
    params.concurrency ?? 2
  );

  if (uploadRes.failed.length > 0) {
    return {
      stage: "images",
      ok: false,
      listingId: targetListingId,
      error: `Your listing is saved as Active, but ${uploadRes.failed.length} ${
        uploadRes.failed.length === 1 ? "image" : "images"
      } failed to upload. Retry or remove failed photos below.`,
      uploadedCount: uploadRes.uploaded.length,
      failedCount: uploadRes.failed.length,
    };
  }

  return {
    stage: "done",
    ok: true,
    listingId: targetListingId,
    uploadedCount: uploadRes.uploaded.length,
    failedCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Phase D Helpers: Formatting, Cloudinary Delivery Validation, Query Parsing
// ---------------------------------------------------------------------------

/**
 * Formats a marketplace INR price cleanly in `en-IN` grouping while preserving
 * exact decimal precision up to 2 decimal places when fractional rupees exist.
 */
export function formatMarketplacePrice(
  price: number | string | null | undefined
): string {
  if (price === null || price === undefined || price === "") {
    return "Price unavailable";
  }

  const numericValue = typeof price === "string" ? Number(price.trim()) : price;
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "Price unavailable";
  }

  const hasFraction = Math.abs(numericValue - Math.round(numericValue)) >= 0.005;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

/**
 * Validates that an external image URL targets Khoj's Cloudinary delivery host,
 * expected cloud account (when configured), active asset environment, and
 * `khoj/<env>/listings/<id>/<asset>` path structure without credentials, queries,
 * or path traversal.
 */
export function isAllowedCloudinaryImageUrl(
  url: string | null | undefined,
  policy?: CloudinaryDeliveryPolicy
): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== "res.cloudinary.com") return false;
    if (parsed.port !== "") return false;
    if (parsed.search !== "" || parsed.hash !== "") return false;
    if (parsed.username !== "" || parsed.password !== "") return false;
    if (parsed.pathname.includes("..")) return false;

    const match =
      /^\/([a-zA-Z0-9_-]+)\/image\/upload\/(?:v\d+\/)?khoj\/(development|preview|production)\/listings\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.exec(
        parsed.pathname
      );
    if (!match) return false;

    const [, cloudName, envSegment] = match;
    if (policy?.cloudName && cloudName !== policy.cloudName) {
      return false;
    }
    if (policy?.environment && envSegment !== policy.environment) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function getCategoryLabel(category: string): string {
  if (category in CATEGORIES) {
    return CATEGORIES[category as keyof typeof CATEGORIES].label;
  }
  return CATEGORIES.OTHER.label;
}

export function getConditionMeta(
  condition: string | null | undefined
): { label: string; description: string } | null {
  if (condition && condition in CONDITIONS) {
    return CONDITIONS[condition as keyof typeof CONDITIONS];
  }
  return null;
}

export function getListingStatusLabel(status: string): string {
  if (status in LISTING_STATUSES) {
    return LISTING_STATUSES[status as keyof typeof LISTING_STATUSES].label;
  }
  return status;
}

/**
 * Parses a URL `page` search parameter safely into bounded integer `1..1000`.
 */
export function parsePositivePageParam(
  rawPage: string | string[] | undefined
): number {
  const raw = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  if (!raw) return 1;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, 1000);
}

export type MarketplaceOwnerStatusFilter = "ACTIVE" | "SOLD" | "REMOVED";

/**
 * Validates an owner status filter query param strictly against allowed
 * marketplace listing statuses.
 */
export function parseMyListingsStatusParam(
  rawStatus: string | string[] | undefined
): MarketplaceOwnerStatusFilter | undefined {
  const raw = (Array.isArray(rawStatus) ? rawStatus[0] : rawStatus)
    ?.trim()
    .toUpperCase();
  if (!raw) return undefined;
  if (
    raw === "ACTIVE" ||
    raw === "SOLD" ||
    raw === "REMOVED"
  ) {
    return raw;
  }
  return undefined;
}

/**
 * Transitions an owned ACTIVE listing to SOLD via PATCH /api/listings/[id].
 */
export async function markListingSoldRequest(
  listingId: string
): Promise<ListingMutationResult> {
  return updateListingRequest(listingId, { status: "SOLD" });
}

/**
 * Builds a clean URL for `/dashboard/listings` preserving optional status filter and page.
 */
export function buildMyListingsHref(options?: {
  status?: MarketplaceOwnerStatusFilter;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (options?.status) {
    params.set("status", options.status);
  }
  if (options?.page && options.page > 1) {
    params.set("page", String(options.page));
  }
  const qs = params.toString();
  return qs ? `/dashboard/listings?${qs}` : "/dashboard/listings";
}

/**
 * Updates local My Listings rows after a verified server status mutation
 * (`SOLD` or `REMOVED`), filtering out rows that no longer belong to the
 * active status tab.
 */
export function applyMyListingsMutation(
  listings: MarketplaceListingClientDTO[],
  updatedListing: MarketplaceListingClientDTO,
  activeStatusFilter?: MarketplaceOwnerStatusFilter
): MarketplaceListingClientDTO[] {
  if (activeStatusFilter && updatedListing.status !== activeStatusFilter) {
    return listings.filter((item) => item.id !== updatedListing.id);
  }

  return listings.map((item) =>
    item.id === updatedListing.id ? updatedListing : item
  );
}

// ---------------------------------------------------------------------------
// Phase F Helpers: Tab-Scoped Refresh Recovery for Listing Creation
// ---------------------------------------------------------------------------

export const PENDING_LISTING_RECOVERY_KEY = "khoj_pending_create_listing";
export const PENDING_LISTING_RECOVERY_TTL_MS = 30 * 60 * 1000;

export interface PendingListingRecoveryDraft {
  listingId: string;
  title: string;
  values: ListingFormValues;
  snapshot: string;
  savedAtMs: number;
}

const VALID_RECOVERY_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export function savePendingListingRecovery(
  draft: Omit<PendingListingRecoveryDraft, "savedAtMs">,
  nowMs: number = Date.now()
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PendingListingRecoveryDraft = {
      ...draft,
      savedAtMs: nowMs,
    };
    window.sessionStorage.setItem(
      PENDING_LISTING_RECOVERY_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function readPendingListingRecoveryRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(PENDING_LISTING_RECOVERY_KEY);
  } catch {
    return null;
  }
}

export function parsePendingListingRecoveryRaw(
  raw: string | null,
  nowMs: number = Date.now()
): PendingListingRecoveryDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingListingRecoveryDraft>;
    if (
      !parsed ||
      typeof parsed.listingId !== "string" ||
      !VALID_RECOVERY_ID_RE.test(parsed.listingId) ||
      typeof parsed.title !== "string" ||
      typeof parsed.snapshot !== "string" ||
      typeof parsed.savedAtMs !== "number" ||
      !parsed.values ||
      typeof parsed.values.title !== "string"
    ) {
      return null;
    }

    if (nowMs - parsed.savedAtMs > PENDING_LISTING_RECOVERY_TTL_MS) {
      return null;
    }

    return parsed as PendingListingRecoveryDraft;
  } catch {
    return null;
  }
}

export function clearPendingListingRecovery(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_LISTING_RECOVERY_KEY);
  } catch {
    // Ignore storage failures
  }
}
