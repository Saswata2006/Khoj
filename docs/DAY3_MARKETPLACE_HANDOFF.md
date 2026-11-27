# Khoj — Day 3 Marketplace Backend Handoff

This document defines the Marketplace (`type: "SALE"`) validation, service layer, Cloudinary image upload pipeline, REST APIs, authorization rules, schema audit, and frontend integration guidelines.

---

## 1. Existing Schema Compatibility & Audit Findings

The existing `prisma/schema.prisma` (`Listing` and `ListingImage`) was reused without schema edits or new migrations:

- **Compatible Fields on `Listing` (`listings`):**
  - `id` (`cuid()`), `userId` (`users.id` FK, `onDelete: Cascade`), `title`, `description` (`@db.Text`), `type` (`ListingType` — scoped strictly to `"SALE"` for marketplace APIs), `category` (`Category`), `condition` (`Condition?` — required on marketplace creation), `price` (`Decimal? @db.Decimal(10, 2)` — required and `> 0` INR for marketplace listings), `location`, `status` (`ListingStatus` — `"ACTIVE" | "SOLD" | "REMOVED"` for marketplace; `"RESOLVED"` is reserved for Lost & Found and rejected here), `createdAt`, `updatedAt`.
- **Compatible `ListingImage` (`listing_images`):**
  - `id`, `listingId`, `imageUrl` (stores Cloudinary `secure_url`), `publicId` (stores server-generated Cloudinary `public_id`), `createdAt`.
- **Schema Gap Found (Negotiable Pricing):**
  - `Listing` does **not** currently contain an `isNegotiable` column. No unmapped database field was invented and no migration was applied. Any client sending `isNegotiable` receives `400` from `.strict()` validation until the proposed migration in Section 8 is approved and applied.

---

## 2. Listing & Image Validation

### Listing Validators (`src/lib/validators/listing.ts`)
All payload schemas use `.strict()` to reject unexpected/mass-assignment fields (`userId`, `id`, `type`, `role`, etc.):
- **`listingIdSchema`**: trimmed `8..64` chars matching `/^[a-zA-Z0-9_-]+$/`.
- **`createMarketplaceListingSchema`**: `title` (`3..120`), `description` (`10..3000`), `price` (`> 0` to `10,000,000` INR, up to 2 decimal places), `category`, `condition`, `location` (`2..120`).
- **`updateMarketplaceListingSchema`**: partial updatable fields plus optional `status` (`"ACTIVE" | "SOLD" | "REMOVED"`), minimum 1 field.
- **`listMarketplaceQuerySchema` / `myListingsQuerySchema`**: bounded pagination `page` (`1..1000`, default `1`), `limit` (`1..50`, default `12`), category/condition/price/search/sort filters.

### Binary Image Validator (`src/lib/validators/image.ts`)
Validates raw bytes (not just filenames or browser MIME strings):
- **Max Images per Listing:** `5`
- **Max File Size:** `3 MiB` (`3,145,728` bytes), empty files rejected
- **Supported Formats:** JPEG, PNG, and WebP verified via binary magic signatures (`FF D8 FF`, `89 50 4E 47 0D 0A 1A 0A`, `RIFF....WEBP`)
- **Dimension Bounds:** `50x50` min to `8000x8000` max pixels parsed directly from SOF/IHDR/VP8/VP8L/VP8X headers
- **One Image per Request:** Multipart upload endpoint rejects missing files or requests containing multiple files/entries (`400`)

---

## 3. Cloudinary Configuration (`src/lib/cloudinary.ts`)

- Guarded by `import "server-only"` with lazy configuration from `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` (safe for builds and mocked tests).
- **Asset Namespaces:** `khoj/development/listings/<listingId>` outside production; `khoj/production/listings/<listingId>` in production.
- **Signed Server-Side Uploads Only:** Uses `cloudinary.uploader.upload_stream` (no unsigned presets or client-supplied `public_id` / external URLs).
- **Metadata & Optimization:** Automatically strips EXIF/profile metadata (`flags: "strip_profile"`, `image_metadata: false`), caps dimensions (`1600x1600` limit), and applies `quality: "auto:good"`, `fetch_format: "auto"`.
- **Asset Removal:** `deleteCloudinaryAsset(publicId)` deletes with `invalidate: true`.

---

## 4. Service Layer & Security Controls

### Marketplace Listing Service (`src/lib/services/listings.ts`)
- Functions: `createMarketplaceListing`, `getPublicMarketplaceListings`, `getPublicMarketplaceListingById`, `getUserMarketplaceListings`, `updateOwnedMarketplaceListing`, `markMarketplaceListingSold`, `removeOwnedMarketplaceListing`.
- **Atomic Ownership & Status Enforcement:** Mutations run under `Serializable` transactions and apply filtered unique `where` predicates (`{ id, userId, type: "SALE", status: ... }`), mapping concurrent `P2025` conflicts to `409 Conflict`.
- **Public Seller Privacy:** Public responses project **only** `seller: { id, name, image }`. Seller `email`, `emailVerified`, `role`, `hostelBlock`, `location`, sessions, and accounts are **never** returned in public API payloads.

### Listing Image Service (`src/lib/services/listing-images.ts`)
- Functions: `uploadImageToOwnedListing`, `deleteImageFromOwnedListing`.
- **No Long DB Locks:** Pre-flight checks run outside transactions, Cloudinary network I/O completes outside transactions, and DB persistence uses a `Serializable` transaction with bounded `P2034`/`40001` retries (max 3 attempts).
- **Compensating Cleanup:** If DB persistence fails (e.g., concurrent 5th-image conflict, listing status changed to `SOLD`/`REMOVED`, or DB error), `deleteCloudinaryAsset(uploaded.publicId)` is invoked immediately.
- **Cross-Listing Delete Prevention:** `deleteImageFromOwnedListing` queries and deletes with `{ id: imageId, listingId }` strictly after verifying listing ownership (`403`) and `ACTIVE` status (`409`).

---

## 5. API Endpoints & Contracts

All routes enforce `Cache-Control: no-store`.

| Method & Path | Auth & Rules | Request | Response | Errors |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/listings` | Public (`SALE` + `ACTIVE`) | Query filters & pagination | `200`: `{ listings, pagination }` | `400`, `500` |
| `POST /api/listings` | `requireUser()` | JSON listing payload | `201`: `{ listing }` | `400`, `401`, `500` |
| `GET /api/listings/me` | `requireUser()` | Query: `page`, `limit`, `status` | `200`: `{ listings, pagination }` | `400`, `401`, `500` |
| `GET /api/listings/[id]` | Public (`SALE`, non-`REMOVED`) | Path: `id` | `200`: `{ listing }` | `400`, `404`, `500` |
| `PATCH /api/listings/[id]` | `requireUser()` + Owner | Partial JSON update / `status` | `200`: `{ listing }` | `400`, `401`, `403`, `404`, `409`, `500` |
| `DELETE /api/listings/[id]` | `requireUser()` + Owner | Path: `id` | `200`: `{ listing }` (`REMOVED`) | `400`, `401`, `403`, `404`, `409`, `500` |
| `POST /api/listings/[id]/images` | `requireUser()` + Owner + `ACTIVE` | `multipart/form-data` (1 file: JPEG/PNG/WebP `<= 3 MiB`) | `201`: `{ image: { id, imageUrl, createdAt } }` | `400`, `401`, `403`, `404`, `409`, `500` |
| `DELETE /api/listings/[id]/images/[imageId]` | `requireUser()` + Owner + `ACTIVE` | Path: `id`, `imageId` | `200`: `{ deleted: true, imageId }` | `400`, `401`, `403`, `404`, `409`, `500` |

---

## 6. Image Lifecycle & Orphan Cleanup Strategy

1. **Upload Abort on Pre-Flight Failure:** Invalid binary/size/ownership/status/5-image quota fails before any Cloudinary request is sent.
2. **DB Failure Compensation:** Any `Serializable` persistence failure calls `deleteCloudinaryAsset(publicId)` immediately.
3. **Deleted Images & Listing Archival:** Deleting an image removes the DB row atomically first, then invokes Cloudinary `destroy(..., { invalidate: true })`. Archiving a listing (`REMOVED`) preserves `ListingImage` rows for audit/recovery; future scheduled cleanup can reconcile Cloudinary assets under `khoj/<env>/listings/*` that are absent from `listing_images` (excluding active in-flight uploads newer than 15 minutes).

---

## 7. Frontend Integration Instructions

1. Create listing first via `POST /api/listings` to obtain `listing.id`.
2. Upload images sequentially (or concurrently up to remaining `5 - images.length` slots) using `FormData` with one `file` per `POST /api/listings/[id]/images` request.
3. On listing edit, use `DELETE /api/listings/[id]/images/[imageId]` to remove existing photos (only while `status === "ACTIVE"`).
4. Render `listing.images[].imageUrl`, display `listing.seller.name` / `listing.seller.image`, format `listing.price` via `formatPrice`, and never expect `seller.hostelBlock` or `seller.email`.

---

## 8. Remaining Live Integration Tests & Future Migration

- **Live End-to-End Integration Pending:** Automated tests mock Cloudinary, Prisma, and Better Auth. Manually verify real signed upload, Cloudinary optimization (`khoj/development`), 5-image limit, delete invalidation, and `DATABASE_URL` Neon persistence using `.env` dev credentials.
- **Proposed Future Migration (Unapplied):**
  ```sql
  ALTER TABLE "listings" ADD COLUMN "isNegotiable" BOOLEAN NOT NULL DEFAULT false;
  CREATE INDEX "listings_type_status_createdAt_idx" ON "listings"("type", "status", "createdAt");
  ```


---

## Phase C: Create & Edit Marketplace Listing UI & Backend Hardening Review

### 1. Implemented Frontend Routes & Components

- **Create Listing (`/marketplace/create`)** — `src/app/marketplace/create/page.tsx` & `src/components/marketplace/CreateListingForm.tsx`
  - Server-side `getCurrentUser()` check inside `<Suspense>` redirects unauthenticated visitors to `/login?redirectTo=/marketplace/create`.
  - Uses existing Zod rules (`createMarketplaceListingSchema`, `MAX_PRICE_INR`, category/condition constants) via `validateListingFormValues`.
  - Creates listing first (`POST /api/listings`) -> captures `createdListingId` immediately + maintains synchronous `inFlightRef` lock so retries or partial upload failures never create duplicate listings -> uploads queued images (`POST /api/listings/[id]/images`) with bounded concurrency (max 2 concurrent requests).
  - Supports partial upload failure recovery (per-image Retry button, batch Retry button, queued item removal, or deletion of already uploaded images) and updates details via `PATCH /api/listings/[id]` if edited before retry.
  - Explicitly informs sellers that publishing sets status to `ACTIVE` immediately (no draft mode) and omits unsupported `isNegotiable` pricing.
- **Edit Listing (`/marketplace/[id]/edit`)** — `src/app/marketplace/[id]/edit/page.tsx` & `src/components/marketplace/EditListingForm.tsx`
  - Server-side `getCurrentUser()` check redirects unauthenticated visitors to `/login?redirectTo=/marketplace/[id]/edit` before querying listings.
  - Uses `getOwnedMarketplaceListingForEdit(id, user.id)` (`src/lib/services/listings.ts`) to distinguish:
    - `not_found` -> 404 UI (`Listing Not Found (404)`)
    - `forbidden` -> 403 UI (`Access Denied (403)`)
    - `not_editable` (`SOLD` / `REMOVED`) -> 409 lock UI (`Editing Locked`)
    - `ok` -> Pre-filled `EditListingForm`
  - Supports updating fields & availability (`ACTIVE` <-> `SOLD`) via `PATCH /api/listings/[id]`, queuing/uploading additional images (`POST /api/listings/[id]/images`, guarded against setting `SOLD` with unuploaded items still queued), deleting existing photos with inline two-step confirmation (`DELETE /api/listings/[id]/images/[imageId]`), and archiving the listing (`DELETE /api/listings/[id]`) with confirmation.
- **Reusable Shared Components & Client Helpers**
  - `src/components/marketplace/ListingFormFields.tsx` — Shared title, category (`CATEGORY_LIST`), condition (`CONDITIONS`), INR fixed price (`₹`), general location, description, and optional Edit availability fields.
  - `src/components/marketplace/ListingImageUploader.tsx` — Drag-and-drop / multi-file picker, local blob preview management (`URL.createObjectURL` + unmount/removal `URL.revokeObjectURL`), 5-image and 3 MiB client pre-checks (`validateSelectedImageFiles`), individual upload status badges (`queued`, `uploading`, `uploaded`, `error`), retry button, and inline delete confirmation.
  - `src/lib/marketplace-ui.ts` — Shared validation wrappers, API fetch clients, bounded concurrency runner (`runWithBoundedConcurrency`), and `executeCreateListingWorkflow`.
- **Dashboard Integration** — `src/app/dashboard/page.tsx`
  - Added **Sell an Item** and **Create Listing** CTAs linking directly to `/marketplace/create` in the header action bar, Marketplace card, and My Listings section without adding broken links to unbuilt Phase D pages.

### 2. Focused Backend Security & Hardening Review Summary

1. **Pre-parse Request Size Guard (`413`)** — Added a `Content-Length` check (`MAX_IMAGE_BYTES + 64 * 1024`) in `src/app/api/listings/[id]/images/route.ts` prior to `await request.formData()` so oversized uploads fail early before buffering large payloads. Note: chunked transfers without `Content-Length` still rely on server runtime limits before `file.size` / `bytes.byteLength` enforcement.
2. **Vercel Preview Cloudinary Namespace Isolation** — Updated `getCloudinaryNamespace()` in `src/lib/cloudinary.ts` so `VERCEL_ENV === "preview"` resolves to `"khoj/preview"` rather than writing preview test assets into `"khoj/production"`.
3. **Malformed Image Validation Boundary** — `validateImageBuffer` in `src/lib/validators/image.ts` validates exact magic bytes and structural JPEG/PNG/WebP dimensions locally; full pixel transcoding and EXIF/metadata stripping (`quality: "auto:good"`, `fetch_format: "auto"`, `flags: "strip_profile"`) happen inside Cloudinary upload processing.
4. **Remote Orphan Asset Trade-off** — `safeCompensateDeleteAsset` cleans up Cloudinary objects on failed transactions and swallows remote delete errors so database conflict errors are not masked. Transient Cloudinary destroy errors can still leave orphaned objects in storage, warranting periodic prefix reconciliation in later operations hardening.

### 3. Implemented Phase D Routes, Components & Configuration

- **Public Marketplace Browse (`/marketplace`)** — `src/app/marketplace/page.tsx`, `src/app/marketplace/loading.tsx`, `src/components/marketplace/MarketplaceListingCard.tsx`
  - Public access without authentication (`getCurrentUser()` is used only to hydrate `<Navbar />` when signed in).
  - Queries `getPublicMarketplaceListings({ page, limit: 12 })` (`type: "SALE"`, `status: "ACTIVE"`) inside a `<Suspense>` boundary for Next.js Cache Components compatibility. Never displays `SOLD`, `REMOVED`, or `LOST`/`FOUND` records.
  - Parses `?page=` safely into `1..1000` (`parsePositivePageParam`), renders a responsive product grid with INR pricing (`formatMarketplacePrice`), category, condition grade, general location, availability badge, **Sell an Item** CTA (`/marketplace/create`), empty states, and sanitized error handling.
  - Advanced search, filters, and sorting remain deferred to Day 4.

- **Public Product Details (`/marketplace/[id]`)** — `src/app/marketplace/[id]/page.tsx`, `src/app/marketplace/[id]/not-found.tsx`, `src/app/marketplace/[id]/loading.tsx`, `src/components/marketplace/ListingGallery.tsx`
  - Public access backed by `getPublicMarketplaceListingById(id)` (`type: "SALE"`, `status: { not: "REMOVED" }`). Validates IDs via `listingIdSchema` and invokes `notFound()` outside `try/catch` for invalid, missing, `LOST`/`FOUND`, or `REMOVED` listings.
  - Renders clickable photo gallery thumbnails (`ListingGallery`) with eager primary loading and responsive `sizes`, INR price, category, condition description, full item description, general location, published date, seller display name + initials/safe Cloudinary avatar (`computeUserInitials`), and Back to Marketplace navigation.
  - Enforces public privacy: never exposes seller `email`, `hostelBlock`, role, or phone numbers.
  - Shows **Edit Listing** (`/marketplace/[id]/edit`) + **Manage in My Listings** (`/dashboard/listings`) only to the authenticated owner when `status === "ACTIVE"`. Shows prominent **Sold — Unavailable** banners/status when `status === "SOLD"`, and shows **Contact Seller — Coming Soon** (disabled) for other visitors.

- **Protected My Listings Management (`/dashboard/listings`)** — `src/app/dashboard/listings/page.tsx`, `src/app/dashboard/listings/loading.tsx`, `src/components/marketplace/MyListingsManager.tsx`
  - Enforces `getCurrentUser()` inside `<Suspense>` and redirects unauthenticated visitors to `/login?redirectTo=/dashboard/listings` before querying DB.
  - Uses `getUserMarketplaceListings(user.id, { page, limit, status })` with allowlisted status tabs (`All`, `Active`, `Sold`, `Removed`) via `parseMyListingsStatusParam`.
  - Scopes row controls to valid server states: **View** (`/marketplace/[id]`) when not `REMOVED`, **Edit** (`/marketplace/[id]/edit`) and **Mark as Sold** (`PATCH /api/listings/[id]`) when `ACTIVE`, and **Remove** (`DELETE /api/listings/[id]` soft-delete) when not `REMOVED`.
  - Requires an accessible `role="alertdialog"` confirmation modal with Escape/Cancel support before marking Sold or removing, updates row state + dashboard counts via `router.refresh()`, and handles empty/error/conflict (`409`) responses.

- **Cloudinary Image Rendering & `next.config.ts`** — `src/components/marketplace/MarketplaceImage.tsx`, `next.config.ts`
  - Configures `images.remotePatterns` strictly for `https://res.cloudinary.com` with path patterns `/*/image/upload/*/khoj/**` and `/*/image/upload/khoj/**` (`port: ""`, `search: ""`). Never allows arbitrary external image hosts or exposes Cloudinary credentials to the client.
  - Uses `next/image` with responsive `sizes`, `loading="lazy"` on cards/thumbnails, `loading="eager"` (`fetchPriority="high"`) on main product gallery photo (avoiding deprecated `priority`), and `isAllowedCloudinaryImageUrl` + `onError` client fallback placeholder for missing/invalid/failed images.

- **Navigation & Flow Integration**
  - Updated `src/constants/navigation.ts`, `src/config/site.ts`, `src/components/layout/Navbar.tsx`, `src/components/layout/Footer.tsx`, `src/components/landing/HeroSection.tsx`, `src/components/landing/FeaturesSection.tsx`, `src/components/landing/HowItWorksSection.tsx`, and `src/app/dashboard/page.tsx` to link live `/marketplace`, `/marketplace/create`, and `/dashboard/listings` routes while keeping Lost & Found, Claims, and Contact Requests clearly marked as upcoming.
  - Updated `CreateListingForm` to navigate to `/marketplace/[id]?created=1` once listing creation and all queued uploads complete, preserving in-page retry/recovery UI without redirecting on partial image failures.
  - Updated `EditListingForm` back/cancel/save links to integrate with `/dashboard/listings` and `/marketplace/[id]`.

### 4. Remaining Technical Limitations (Pending Phase E Review)

1. **Duplicate Listings on Refresh / Lost Response:** Client-side `createdListingId` + `inFlightRef` guard prevents rapid double-clicks and duplicate creation across partial-failure retries, but refreshing the browser or losing the `POST /api/listings` response mid-flight can still create a duplicate listing because server-side idempotency keys are not implemented.
2. **Header-Only Local Image Validation:** `validateImageBuffer` inspects binary signatures and structural headers/dimensions before Cloudinary upload; full pixel stream decoding is delegated to Cloudinary upload processing.
3. **Orphan Remote Assets on Delete Failure:** `safeCompensateDeleteAsset` and remote deletes swallow transient Cloudinary errors to avoid masking database outcomes, which can leave unused Cloudinary objects requiring periodic reconciliation.
4. **Partial Publishing Visibility:** Because the database schema has no `DRAFT` status, listings become `ACTIVE` and publicly visible on `/marketplace` as soon as `POST /api/listings` commits, before queued photo uploads complete.
5. **Chunked Request Body Sizes:** Early `413` pre-checks depend on `Content-Length`; chunked upload requests without `Content-Length` still rely on hosting/runtime body limits prior to buffer size checks.

### 5. Phase E Manual Verification Checklist

- Test full end-to-end flow with live Neon DB and Cloudinary dev credentials:
  1. Sign in via Email OTP (`/login` -> `/verify`), create a listing with multiple photos on `/marketplace/create`, verify redirect to `/marketplace/[id]?created=1` and optimized image delivery from `res.cloudinary.com/.../khoj/development/...`.
  2. Verify `/marketplace` pagination and confirm `SOLD` and `REMOVED` listings do not appear in browse results, while `SOLD` detail pages display prominent Sold state with disabled visitor inquiries.
  3. Verify non-owner cannot access `/marketplace/[id]/edit` (`403`) and cannot see seller email or `hostelBlock` on `/marketplace/[id]`.
  4. Verify `/dashboard/listings` status filters (`All`, `Active`, `Sold`, `Removed`), `Mark as Sold`, confirmation dialogs, and soft-delete `Remove` workflow update DB and dashboard counts accurately.


---

## Phase F: Final Security Hardening & Closure

### 1. Security Hardening Summary

1. **Full Image Decoding, Bomb Cap & Local Metadata Stripping (`src/lib/validators/image.ts`, `src/lib/image-sanitizer.ts`, `next.config.ts`)**
   - Added `MAX_IMAGE_PIXELS = 25_000_000` (25 megapixels) alongside PNG `IHDR` length (`13`) and WebP RIFF size verification in synchronous `validateImageBuffer`.
   - Added `"server-only"` `validateAndSanitizeUploadedImage` reusing Next.js 16's `sharp` (`^0.35.5`, externalized via `serverExternalPackages: ["sharp"]` in `next.config.ts`): performs full bitstream decoding (`limitInputPixels: 25_000_000`, `failOn: "error"`), rejects multi-frame/animated files (`pages > 1`), auto-orients pixels safely (`.rotate()`), and re-encodes without `.withMetadata()` so EXIF/GPS/XMP/IPTC/polyglot trailing bytes are stripped locally before reaching Cloudinary.
2. **Bounded Multipart & JSON Request Reading (`src/lib/api/listings-http.ts`, `src/app/api/listings/[id]/images/route.ts`)**
   - Added `readBoundedRequestBytes()` verifying `Content-Length` headers and streaming `request.body.getReader()` with immediate reader cancellation + `413 Payload Too Large` when incoming bytes exceed limits (`3 MiB + 64 KiB` for multipart image uploads; `64 KiB` for JSON listing requests), closing chunked memory-exhaustion gaps even when `Content-Length` is omitted.
   - Note remaining runtime boundary: Next.js / Vercel hosting reverse-proxy limits apply upstream before route code executes, and `Request` mocks without `request.body` fall back safely after header checks.
3. **Refresh Recovery & Ambiguous Network Handling (`src/lib/marketplace-ui.ts`, `src/components/marketplace/CreateListingForm.tsx`)**
   - Added tab-scoped `sessionStorage` recovery (`PENDING_LISTING_RECOVERY_KEY`, 30-minute TTL) using hydration-safe `useSyncExternalStore` so reloading mid-partial-failure lets users resume their already-created `listingId` instead of duplicating `POST /api/listings`.
   - Added 15s request timeout (`AbortSignal.timeout(15_000)` when supported) and explicit ambiguous network error messaging linking users to `/dashboard/listings` before retrying. Durable cross-browser exactly-once creation remains deferred to a future additive `idempotencyKey` schema migration (`docs/DATABASE.md`).
4. **Strict Cloudinary Account & Environment Scoping (`next.config.ts`, `src/lib/cloudinary.ts`, `src/lib/marketplace-ui.ts`)**
   - Configured `next.config.ts` `images.remotePatterns` dynamically from `CLOUDINARY_CLOUD_NAME` and active `development` / `preview` / `production` environment (`/${cloudName}/image/upload/[*/]khoj/${activeAssetEnv}/listings/**`), failing closed (`[]`) when `CLOUDINARY_CLOUD_NAME` is unset so builds remain safe without live credentials and arbitrary external optimization is blocked.
   - Passed only non-secret `CloudinaryPublicDeliveryPolicy` (`{ cloudName, environment }`) from Server Components to `MarketplaceImage` (`isAllowedCloudinaryImageUrl`), verifying strict `https://res.cloudinary.com/<cloudName>/image/upload/[v<digits>/]khoj/<env>/listings/<id>/<asset>` format with zero API secrets client-side.
5. **SOLD Edit Lock & Safe Asset Deletion Lifecycle (`src/lib/services/listings.ts`, `src/lib/cloudinary.ts`, `src/lib/services/listing-images.ts`, `src/app/api/listings/[id]/images/[imageId]/route.ts`)**
   - Locked `updateOwnedMarketplaceListing` (`PATCH /api/listings/[id]`) so already-`SOLD` listings return `409 Conflict` consistently with `/marketplace/[id]/edit`, `POST/DELETE images`, and `markMarketplaceListingSold` (archival via `DELETE /api/listings/[id]` remains allowed on `SOLD` listings).
   - Restricted `deleteCloudinaryAsset(publicId)` to reject cross-environment `publicId`s (`!trimmed.startsWith("${getCloudinaryNamespace()}/")`) and verify destroy responses (`"ok" | "not found"`). Updated `deleteImageFromOwnedListing` to log sanitized diagnostic cleanup warnings without credentials and expose `remoteCleanupPending: true` / `notice` when remote cleanup fails.

### 2. Safe Orphaned Cloudinary Asset Reconciliation Procedure (Manual / Scheduled Cron)

1. Determine `targetNamespace = getCloudinaryNamespace()` (`khoj/development`, `khoj/preview`, or `khoj/production`). **Never list or delete keys outside the active environment prefix.**
2. Fetch all Cloudinary image resources under `${targetNamespace}/listings/*` older than a **15-minute grace window** (prevents racing with in-flight uploads between Cloudinary return and DB commit).
3. Query `listing_images.publicId` for those candidate `publicId`s (do **not** auto-delete assets still referenced by `REMOVED` listings unless an explicit archival retention policy expires `REMOVED` rows first).
4. Log dry-run candidate counts (`environment`, `orphanCount`), re-verify each candidate lacks a DB `listing_images` row, and invoke `deleteCloudinaryAsset(publicId)` cleanly within that single environment.

### 3. Deferred Live Verification Checklist

- See [docs/DAY3_TESTING_CHECKLIST.md](./DAY3_TESTING_CHECKLIST.md) for all pending manual Neon DB, Gmail SMTP, Cloudinary upload/EXIF/deletion, cross-user IDOR, and responsive UI checks.
