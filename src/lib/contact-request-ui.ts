import { sanitizeRedirectPath } from "@/lib/auth-ui";

export type ContactRequestClientStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface ContactDisclosureClientDTO {
  canRevealContact: false;
  consentRecorded: false;
  status:
    | "PENDING_SELLER_RESPONSE"
    | "DEFERRED_CONSENT_SCHEMA_REQUIRED"
    | "REQUEST_REJECTED";
  message: string;
}

export interface ContactRequestClientDTO {
  id: string;
  listingId: string;
  status: ContactRequestClientStatus;
  createdAt: string;
  updatedAt: string;
  contactDisclosure: ContactDisclosureClientDTO;
}

export type SubmitContactRequestResult =
  | {
      ok: true;
      status: 201;
      contactRequest: ContactRequestClientDTO;
    }
  | {
      ok: false;
      status: number;
      error: string;
      retryAfterSeconds?: number;
      requiresAuth?: boolean;
      shouldRefreshState?: boolean;
      ambiguous: boolean;
    };

export interface RecoverContactRequestResult {
  checked: boolean;
  contactRequest: ContactRequestClientDTO | null;
}

/**
 * Builds a safe `/login?redirectTo=...` URL returning the visitor to the
 * specific marketplace listing page after authentication.
 */
export function buildContactLoginHref(listingId: string): string {
  const safePath = sanitizeRedirectPath(
    `/marketplace/${listingId}`,
    "/marketplace"
  );
  return `/login?redirectTo=${encodeURIComponent(safePath)}`;
}

/**
 * Formats a Retry-After duration into a user-readable cooldown string.
 */
export function formatContactRateLimitMessage(retryAfterSeconds?: number): string {
  if (
    typeof retryAfterSeconds === "number" &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds > 0
  ) {
    const rounded = Math.ceil(retryAfterSeconds);
    return `Too many contact requests sent recently. Please wait ${rounded} ${
      rounded === 1 ? "second" : "seconds"
    } before trying again.`;
  }
  return "Too many contact requests sent recently. Please wait a moment before trying again.";
}

function parseRetryAfterHeader(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const parsed = Number(headerValue.trim());
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.ceil(parsed);
  }
  return undefined;
}

function isValidClientContactRequest(
  value: unknown
): value is ContactRequestClientDTO {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.listingId === "string" &&
    (candidate.status === "PENDING" ||
      candidate.status === "ACCEPTED" ||
      candidate.status === "REJECTED") &&
    candidate.contactDisclosure !== null &&
    typeof candidate.contactDisclosure === "object"
  );
}

/**
 * Submits `POST /api/listings/[id]/contact-requests` using the strict `{}` body
 * contract and maps every HTTP response into explicit UI feedback.
 */
export async function submitContactRequest(
  listingId: string
): Promise<SubmitContactRequestResult> {
  let response: Response;

  try {
    response = await fetch(
      `/api/listings/${encodeURIComponent(listingId)}/contact-requests`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
  } catch {
    return {
      ok: false,
      status: 0,
      error:
        "Network interruption while sending your request. Checking whether it was already recorded...",
      ambiguous: true,
    };
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (
    response.status === 201 &&
    payload &&
    isValidClientContactRequest(payload.contactRequest)
  ) {
    return {
      ok: true,
      status: 201,
      contactRequest: payload.contactRequest,
    };
  }

  const serverError =
    payload && typeof payload.error === "string" ? payload.error : null;

  if (response.status === 401) {
    return {
      ok: false,
      status: 401,
      error: serverError || "Please sign in to contact the seller.",
      requiresAuth: true,
      ambiguous: false,
    };
  }

  if (response.status === 400) {
    return {
      ok: false,
      status: 400,
      error: serverError || "This contact request cannot be submitted.",
      ambiguous: false,
    };
  }

  if (response.status === 403) {
    return {
      ok: false,
      status: 403,
      error:
        serverError ||
        "You do not have permission to request contact for this listing.",
      ambiguous: false,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      status: 404,
      error: serverError || "This listing is no longer available.",
      ambiguous: false,
    };
  }

  if (response.status === 409) {
    return {
      ok: false,
      status: 409,
      error:
        serverError ||
        "A contact request already exists for this listing, or the item is no longer active.",
      shouldRefreshState: true,
      ambiguous: false,
    };
  }

  if (response.status === 429) {
    const retryAfter =
      parseRetryAfterHeader(response.headers.get("Retry-After")) ??
      (payload && typeof payload.retryAfterSeconds === "number"
        ? payload.retryAfterSeconds
        : undefined);

    return {
      ok: false,
      status: 429,
      retryAfterSeconds: retryAfter,
      error: formatContactRateLimitMessage(retryAfter),
      ambiguous: false,
    };
  }

  if (response.status >= 500) {
    return {
      ok: false,
      status: response.status,
      error:
        "We could not process your contact request right now. Please try again shortly.",
      ambiguous: false,
    };
  }

  return {
    ok: false,
    status: response.status,
    error: serverError || "Unable to send contact request.",
    ambiguous: false,
  };
}

/**
 * Checks existing server-recorded outgoing contact requests for `listingId`
 * after an ambiguous network failure or 409 conflict before allowing another attempt.
 */
export async function recoverExistingBuyerContactRequest(
  listingId: string
): Promise<RecoverContactRequestResult> {
  try {
    const response = await fetch("/api/contact-requests/outgoing?limit=50", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return { checked: false, contactRequest: null };
    }

    const payload = (await response.json()) as {
      contactRequests?: unknown[];
    };

    if (!Array.isArray(payload.contactRequests)) {
      return { checked: false, contactRequest: null };
    }

    const match = payload.contactRequests.find(
      (item): item is ContactRequestClientDTO =>
        isValidClientContactRequest(item) && item.listingId === listingId
    );

    return {
      checked: true,
      contactRequest: match ?? null,
    };
  } catch {
    return { checked: false, contactRequest: null };
  }
}
