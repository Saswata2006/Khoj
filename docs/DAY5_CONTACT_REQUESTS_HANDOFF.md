# Khoj — Day 5 Contact Requests Handoff (`Phase A`)

This document specifies the consent-based private buyer-seller contact request backend (`type: "SALE"`) implemented on branch `feat/day-5-contact-requests`.

---

## 1. Existing Schema Audit (`prisma/schema.prisma`)

Inspection of `ContactRequest`, `ContactStatus`, `User`, and `Listing` confirmed:

1. **Supported Columns on `ContactRequest` (`contact_requests`):**
   - `id` (`cuid()`), `listingId`, `requesterId`, `status` (`ContactStatus`: `"PENDING" | "ACCEPTED" | "REJECTED"`), `createdAt`, `updatedAt`.
   - Constraint: `@@unique([listingId, requesterId])` plus single-column indexes on `listingId`, `requesterId`, `status`.
2. **Identified Schema Gaps (Unapplied — Requires Future Additive Migration):**
   - **No Contact-Sharing Consent or Channel Fields:** Neither `User` nor `ContactRequest` currently stores an explicit contact-sharing opt-in boolean (e.g. `shareContactWithAcceptedBuyers`), dedicated non-login contact fields (`contactPhone`, `contactEmail`), or `respondedAt`. `User.email` is exclusively the authentication/OTP login identifier.
   - **No `message` Column:** `ContactRequest` has no optional intro-note/message column.
   - **No `CANCELLED` Status:** `ContactStatus` has only `PENDING`, `ACCEPTED`, and `REJECTED`.
   - **Single-Row Uniqueness Limitation:** `@@unique([listingId, requesterId])` enforces at most one `ContactRequest` row per `(listingId, requesterId)` regardless of status, preventing a second row after `REJECTED` unless migrated later to a partial unique index `WHERE "status" = 'PENDING'`.

---

## 2. Business Rules & Status Transitions

- **Initiation (`(none) -> PENDING`):**
  - Strictly requires authenticated user (`requireUser() -> 401`).
  - `buyerId` is taken strictly from `session.user.id`; seller ownership is derived strictly from `listing.userId`.
  - Target listing must satisfy `type === "SALE"` (`LOST` / `FOUND` / missing / `REMOVED` -> `404`), `status === "ACTIVE"` (`SOLD` -> `409`), and `listing.userId !== buyerId` (self-contact -> `400`).
  - Request payload is strictly `.strict()` (`createContactRequestSchema = z.object({}).strict()`); arbitrary keys (including `status`, `requesterId`, `listingId`, or unsupported `message`) fail cleanly with `400`, and payloads exceeding `64 KiB` return `413`.
- **Seller Decisions (`PENDING -> ACCEPTED | REJECTED`):**
  - Strictly seller-only (`listing.userId === sellerId`, else `403`). Buyers and third parties cannot accept/reject requests.
  - `PENDING -> ACCEPTED` requires underlying listing to still have `type === "SALE"` and `status === "ACTIVE"` (`409` if `SOLD` or `REMOVED`).
  - `PENDING -> REJECTED` is allowed for `ACTIVE` or `SOLD` listings (letting sellers dismiss pending inbox items), and blocked (`409`) for `REMOVED` listings.
  - `ACCEPTED` and `REJECTED` are **terminal** states; subsequent transitions return `409 Conflict`.
- **Listing Lifecycle Interaction (`SOLD` / `REMOVED`):**
  - Existing listing lifecycle transitions (`markMarketplaceListingSold`, `removeOwnedMarketplaceListing`) are left untouched.
  - Existing `ContactRequest` rows remain readable to the buyer and seller (carrying `listing.status` for `"Sold"` / `"Removed"` context badges), while new requests and pending acceptances are rejected cleanly (`409` / `404`).

---

## 3. Contact Information Privacy & Consent Policy

- **Public Listings:** Public browse and detail payloads never include seller `email`, `emailVerified`, `role`, profile `location`, or `hostelBlock`.
- **Before Acceptance (`PENDING` / `REJECTED`):** Only participants (`requesterId` or `listing.userId`) may inspect the request; third parties receive `403`. Both participants project strictly `{ id, name, image }` (`CONTACT_REQUEST_SELECT` never queries `email`, `location`, `hostelBlock`, sessions, or accounts).
- **After Acceptance (`ACCEPTED`):** Because the current Prisma schema lacks explicit contact-sharing consent columns or dedicated non-login contact channels, **login `User.email` is NOT disclosed automatically upon acceptance**. Each DTO includes:
  ```json
  "contactDisclosure": {
    "canRevealContact": false,
    "consentRecorded": false,
    "status": "DEFERRED_CONSENT_SCHEMA_REQUIRED",
    "message": "Seller accepted this request. Direct email/phone sharing remains disabled until an explicit consent-sharing schema migration is applied."
  }
  ```

---

## 4. Rate Limiting Strategy (`src/lib/rate-limit.ts`)

Backed by atomic PostgreSQL `INSERT ... ON CONFLICT ("key") DO UPDATE ... WHERE ... RETURNING` (`rate_limits` table):
- **Per-Buyer User Limit (`checkContactRequestUserRateLimit`):** `10` requests per hour (`CONTACT_REQUEST_MAX_PER_HOUR`) plus `10`-second burst cooldown (`CONTACT_REQUEST_COOLDOWN_SECONDS`), key `contact:req:user:<userId>`.
- **Per-IP Limit (`checkContactRequestIpRateLimit`):** `25` requests per hour (`CONTACT_REQUEST_IP_MAX_PER_HOUR`), key `contact:req:ip:<ip>`.
- Exceeded limits return `429 Too Many Requests` with `Retry-After` seconds and `Cache-Control: no-store`.

---

## 5. Service Layer & API Endpoints

### Server-Only Service Functions (`src/lib/services/contact-requests.ts`)
- `createContactRequest(rawListingId, buyerId, rawBody?, clientIp?)`
- `getIncomingContactRequests(sellerId, rawQuery?)`
- `getOutgoingContactRequests(buyerId, rawQuery?)`
- `getContactRequestById(rawRequestId, actorUserId)`
- `decideContactRequest(rawRequestId, sellerId, rawInput)`
- `getContactRequestCounts(userId)` (`incomingPending`, `incomingTotal`, `outgoingPending`, `outgoingAccepted`, `outgoingTotal`, `total`)

### Dashboard Summary Integration (`src/lib/profile.ts`)
- Updated `getDashboardSummary(userId)` `counts.contactRequests` filter to scope accurately to BOTH sent requests (`requesterId: userId`) and incoming marketplace seller requests (`listing: { userId, type: "SALE" }`).

### REST Endpoints (`Cache-Control: no-store` on every response)

| Method & Path | Auth | Behavior & Validation | Responses |
| :--- | :--- | :--- | :--- |
| `POST /api/listings/[id]/contact-requests` | `requireUser()` | Empty JSON `{}` (`.strict()`); creates `PENDING` request for `ACTIVE` `SALE` listing | `201`: `{ contactRequest }` \| `400`, `401`, `404`, `409`, `413`, `429`, `500` |
| `GET /api/contact-requests/incoming` | `requireUser()` | Seller inbox (`status?`, `page=1..1000`, `limit=1..50`) | `200`: `{ contactRequests, pagination }` \| `400`, `401`, `500` |
| `GET /api/contact-requests/outgoing` | `requireUser()` | Buyer sent requests (`status?`, `page=1..1000`, `limit=1..50`) | `200`: `{ contactRequests, pagination }` \| `400`, `401`, `500` |
| `GET /api/contact-requests/[id]` | `requireUser()` + Participant | Returns single request for buyer or seller only | `200`: `{ contactRequest }` \| `400`, `401`, `403`, `404`, `500` |
| `PATCH /api/contact-requests/[id]` | `requireUser()` + Seller | `.strict()` `{ status: "ACCEPTED" \| "REJECTED" }` atomic update from `PENDING` | `200`: `{ contactRequest }` \| `400`, `401`, `403`, `404`, `409`, `413`, `500` |

---

## 6. Concurrency Protection & Remaining Limitations

- **Atomic Concurrency Guards:** Creation runs in `Serializable` transaction + PostgreSQL `@@unique([listingId, requesterId])` (`P2002` / `P2034` -> `409`). Decisions run in `Serializable` transaction + filtered `update({ where: { id, status: "PENDING", listing: { userId, type: "SALE", ... } } })` (`P2025` / `P2034` -> `409`).
- **Mocked Test Boundary:** Automated tests in `src/__tests__/contact-requests.test.ts` mock Prisma transactions and PostgreSQL `P2002`/`P2025` error codes; real Neon concurrency & `rate_limits` row locking remain pending live DB testing.
- **Proposed Future Migration (Not Applied):**
  ```sql
  -- Add optional buyer inquiry note & explicit seller contact-sharing consent
  ALTER TABLE "contact_requests"
    ADD COLUMN "message" TEXT,
    ADD COLUMN "sellerSharedContact" TEXT,
    ADD COLUMN "sellerConsentAt" TIMESTAMP(3),
    ADD COLUMN "respondedAt" TIMESTAMP(3);

  -- Optional partial unique index (replaces @@unique([listingId, requesterId]) only if re-requesting after REJECTED is desired):
  -- CREATE UNIQUE INDEX "contact_requests_pending_unique_idx"
  --   ON "contact_requests" ("listingId", "requesterId") WHERE "status" = 'PENDING';
  ```

---

## 7. Phase B: Contact Seller UI Architecture (Implemented)

### Server-Side Buyer Request State (`src/lib/services/contact-requests.ts`)
- Added `getBuyerContactRequestForListing(rawListingId, buyerId)`:
  - Scoped strictly to `@@unique([listingId, requesterId])` using `CONTACT_REQUEST_SELECT` (never queries `email`, `location`, `hostelBlock`, `sessions`, or `accounts`).
  - Only invoked in [marketplace/[id]/page.tsx](file:///Users/Saswata007/Developer/Khoj/src/app/marketplace/[id]/page.tsx) when an authenticated non-owner views the listing—skipping unnecessary DB queries for anonymous visitors and listing owners.
  - Runs dynamically inside the `<Suspense>` boundary without caching private per-user state.

### Client UI & Confirmation Flow (`src/components/marketplace/ContactSellerAction.tsx`, `src/lib/contact-request-ui.ts`)
- **State Matrix on `/marketplace/[id]`:**
  - **Listing Owner:** Contact Seller UI is hidden; existing owner edit/manage controls remain intact.
  - **SOLD / REMOVED (no prior request):** New contact requests are blocked (`Sold — Item No Longer Available`).
  - **Anonymous Visitor (`ACTIVE` listing):** Renders `Sign in to contact seller` linking to `/login?redirectTo=%2Fmarketplace%2F<id>` validated via `sanitizeRedirectPath`.
  - **Authenticated Buyer (`ACTIVE` listing, no request):** Renders `Request Contact` CTA opening the dark Base UI `Dialog` displaying listing title, formatted INR price, seller display name/initials, and explicit non-disclosure consent notice (no unsupported message input).
  - **`PENDING`:** Renders `Request Sent — Awaiting Response` (`Pending` badge).
  - **`ACCEPTED`:** Renders `Request Accepted` with explicit disclosure notice clarifying that direct email/phone sharing is not yet available until a future consent-sharing schema migration.
  - **`REJECTED`:** Renders `Request Declined` (`Declined` badge) without allowing duplicate submissions.
- **API Integration & Recovery:**
  - Calls `POST /api/listings/[id]/contact-requests` with strict `{}` body and a synchronous `inFlightRef` double-submit guard.
  - Explicitly handles `201`, `400`, `401` (re-auth link), `403`, `404`, `409`, `429` (`Retry-After` cooldown feedback), and `500` sanitized errors.
  - On ambiguous network failures or `409` conflicts, `recoverExistingBuyerContactRequest` queries `GET /api/contact-requests/outgoing?limit=50` and triggers `router.refresh()` before permitting another submission.

---

## 8. Instructions for Phase C Frontend Implementation (Incoming & Outgoing Dashboard)

1. Promote the `Contact Requests` slot in [WorkspaceShell.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/layout/WorkspaceShell.tsx) to `/dashboard/contact-requests` and link the `/dashboard` Contact Requests summary card to it.
2. Build the authenticated inbox/sent tabs consuming `getIncomingContactRequests`, `getOutgoingContactRequests`, and `getContactRequestCounts`.
3. Render status badges (`Pending`, `Accepted`, `Declined`), seller **Accept** / **Decline** confirmation dialogs (`PATCH /api/contact-requests/[id]`), listing availability context (`Sold` / `Removed`), and clear consent-deferred messaging when `contactDisclosure.canRevealContact === false`.
