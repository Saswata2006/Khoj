# Khoj — Day 4 Search & Discovery Handoff (`Phase A`)

This document specifies the advanced Marketplace (`type: "SALE"`, `status: "ACTIVE"`) search, filtering, sorting, and bounded pagination backend for `feat/day-4-search-filters`, along with database index analysis and Phase B frontend integration instructions.

---

## 1. Existing Search Audit Findings (Pre-Phase A)

Inspection of the Day 3 codebase identified these gaps in the prior baseline:

1. **Service Location:** Listing queries reside in `src/lib/services/listings.ts` (there is no `src/lib/listings.ts` module). Phase A extends `getPublicMarketplaceListings` cleanly in place rather than duplicating services.
2. **Mismatched Keyword Param & Mixed Scope:** `listMarketplaceQuerySchema` previously accepted `search` (not `q`), and `getPublicMarketplaceListings` matched `search` across `title`, `description`, **and** `location` in a single `OR` clause with no independent `location` filter.
3. **Missing `oldest` Sort & Tie-Breaker:** `MARKETPLACE_SORT_OPTIONS` supported `"newest"`, `"price_asc"`, and `"price_desc"`, omitting `"oldest"`, and `buildOrderBy` lacked a unique primary-key tie-breaker (`id`), making multi-page offset pagination non-deterministic when rows share timestamps or prices.
4. **Non-Strict Query Parsing & Weak Coercion:**
   - `listMarketplaceQuerySchema` did not call `.strict()`, silently ignoring unsupported parameters (`isNegotiable`, `type`, `status`, `userId`, unknown keys).
   - `z.coerce.number()` coerced whitespace strings (`"   "`) to `0` and did not restrict excessive decimal digits on `minPrice`/`maxPrice` or integer formatting on `page`/`limit`.
   - `searchParamsToRecord` in `src/lib/api/listings-http.ts` silently overwrote duplicate keys (`?category=BOOKS&category=CYCLES`) instead of rejecting ambiguous inputs.
5. **Single-Column Database Indexes Only:** `listings` currently has only individual B-tree indexes on `userId`, `type`, `category`, `status`, and `createdAt`, with no composite indexes, no `condition`/`price` indexes, and no trigram/full-text index for `ILIKE '%...%'` queries.

---

## 2. Updated Search Validation & Service Implementation

### Updated Files
- **Query Validator:** `src/lib/validators/listing.ts` (`listMarketplaceQuerySchema`, `MARKETPLACE_SORT_OPTIONS`)
- **HTTP Helper:** `src/lib/api/listings-http.ts` (`searchParamsToRecord`)
- **Search Service:** `src/lib/services/listings.ts` (`getPublicMarketplaceListings`, `buildOrderBy`)
- **Route Handler:** `src/app/api/listings/route.ts` (`GET /api/listings`)

### Supported Query Parameters (`GET /api/listings`)

| Parameter | Type | Default | Constraints & Behavior |
| :--- | :--- | :--- | :--- |
| `q` | `string` (optional) | `undefined` | Trimmed, consecutive whitespace collapsed; control chars rejected (`400`); max `100` chars; whitespace-only treated as `undefined`; case-insensitive substring match across `title` OR `description`. |
| `category` | Enum (optional) | `undefined` | Must match Prisma `Category`: `BOOKS`, `ELECTRONICS`, `CYCLES`, `ACCESSORIES`, `STATIONERY`, `CLOTHING`, `OTHER`. |
| `condition` | Enum (optional) | `undefined` | Must match Prisma `Condition`: `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`. |
| `minPrice` | Decimal (optional) | `undefined` | Finite number `>= 0` and `<= 10,000,000` INR, at most 2 decimal places (`gte` filter). Rejects whitespace, booleans, `NaN`, `Infinity`, and malformed strings. |
| `maxPrice` | Decimal (optional) | `undefined` | Same constraints as `minPrice` (`lte` filter). Must satisfy `maxPrice >= minPrice`. |
| `location` | `string` (optional) | `undefined` | Trimmed, consecutive whitespace collapsed; control chars rejected (`400`); max `120` chars; whitespace-only treated as `undefined`; case-insensitive substring filter against `Listing.location`. |
| `sort` | Enum | `"newest"` | Strictly allowlisted: `"newest" \| "oldest" \| "price_asc" \| "price_desc"`. |
| `page` | Integer | `1` | Strict integer string/number `1..1000`. |
| `limit` | Integer | `12` | Strict integer string/number `1..50` (`MAX_MARKETPLACE_LIMIT`). |

### Validation & Isolation Invariants

- **Strict Unknown-Key Rejection (`.strict()`):** Unsupported keys (`isNegotiable`, `type`, `status`, `userId`, legacy `search`, arbitrary keys — even when empty `?foo=`) return HTTP `400`.
- **Empty Known Filters Allowed:** Empty string values for valid optional keys (e.g., `?q=&category=&minPrice=`) from HTML forms are omitted safely by `searchParamsToRecord`.
- **Duplicate Parameters Rejected:** Passing a non-empty parameter multiple times (`?category=BOOKS&category=CYCLES`) preserves array values in `searchParamsToRecord` so Zod rejects the request cleanly with `400`.
- **Type, Status & Privacy Isolation:** `getPublicMarketplaceListings` unconditionally fixes `type: "SALE"` and `status: "ACTIVE"` inside Prisma `where`, never exposing `SOLD`, `REMOVED`, `LOST`, `FOUND`, or private seller fields (`seller` projects only `{ id, name, image }`).
- **No Caching Across Dynamic Queries:** `GET /api/listings` sets `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.

---

## 3. Deterministic Sorting & Pagination Behavior

Every sort mode ends with a unique primary-key tie-breaker (`Listing.id`) so offset pagination never shuffles or duplicates rows when items share identical timestamps or prices:

| `sort` value | Prisma `orderBy` |
| :--- | :--- |
| `"newest"` (default) | `[{ createdAt: "desc" }, { id: "desc" }]` |
| `"oldest"` | `[{ createdAt: "asc" }, { id: "asc" }]` |
| `"price_asc"` | `[{ price: "asc" }, { createdAt: "desc" }, { id: "desc" }]` |
| `"price_desc"` | `[{ price: "desc" }, { createdAt: "desc" }, { id: "desc" }]` |

`prisma.listing.findMany` and `prisma.listing.count` share the exact same `where` predicate, returning:

```json
{
  "listings": [
    {
      "id": "cm1search12345678",
      "title": "Casio fx-991EX Scientific Calculator",
      "description": "Lightly used engineering calculator with original slide case and manual.",
      "type": "SALE",
      "category": "ELECTRONICS",
      "condition": "LIKE_NEW",
      "price": 850,
      "location": "North Campus Library",
      "status": "ACTIVE",
      "createdAt": "2026-11-28T10:00:00.000Z",
      "updatedAt": "2026-11-28T10:00:00.000Z",
      "seller": {
        "id": "usr_seller_1",
        "name": "Aarav Sharma",
        "image": null
      },
      "images": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### Example API Requests

1. **Combined Advanced Search:**
   `GET /api/listings?q=calculator&category=ELECTRONICS&condition=LIKE_NEW&minPrice=500&maxPrice=1500&location=North%20Campus&sort=price_asc&page=1&limit=12`
   -> `200 OK` returning filtered listings + `{ page: 1, limit: 12, total, totalPages, hasNextPage, hasPreviousPage }`.
2. **Invalid Price Range (`400 Bad Request`):**
   `GET /api/listings?minPrice=1000&maxPrice=500`
   -> `400 Bad Request`: `{ "error": "Maximum price must be greater than or equal to minimum price." }`.
3. **Unsupported Field (`400 Bad Request`):**
   `GET /api/listings?isNegotiable=true`
   -> `400 Bad Request`: `{ "error": "Unrecognized key: \"isNegotiable\"" }`.

---

## 4. Database Performance Review & Index Recommendations

> **Measurement Note:** No live PostgreSQL `EXPLAIN ANALYZE` benchmarks were executed in Phase A; the recommendations below derive from inspecting `prisma/schema.prisma` and generated migration DDL. No schema changes or migrations were created or applied during Phase A.

### Current Indexes on `listings`
- Single-column B-tree indexes on `userId`, `type`, `category`, `status`, and `createdAt`.
- **No composite indexes**, **no indexes on `condition` or `price`**, and **no text/trigram indexes**.

### Observed Bottlenecks & Proposed PostgreSQL Improvements (Deferred Additive Migration)

1. **Feed Isolation + Default Ordering (`(type, status, createdAt)` / `(type, status, price)`):**
   Every marketplace feed query scopes `WHERE "type" = 'SALE' AND "status" = 'ACTIVE'`. Adding partial or composite B-tree indexes avoids merging multiple single-column bitmaps or filtering out `SOLD`/`REMOVED`/`LOST`/`FOUND` rows during sorts:
   ```sql
   CREATE INDEX "listings_sale_active_created_idx"
     ON "listings"("type", "status", "createdAt" DESC, "id" DESC);

   CREATE INDEX "listings_sale_active_price_idx"
     ON "listings"("type", "status", "price" ASC, "createdAt" DESC, "id" DESC);

   CREATE INDEX "listings_type_status_cat_cond_price_idx"
     ON "listings"("type", "status", "category", "condition", "price");
   ```
2. **Case-Insensitive Keyword & Location Substring Scans (`ILIKE '%...%'`):**
   Prisma `{ contains, mode: "insensitive" }` compiles to `ILIKE '%term%'`, which cannot use standard B-tree indexes and triggers sequential/heap filtering as `listings` grows.
   - **Recommended for Phase C / Scale Migration (`pg_trgm` GIN):** Preserves substring matches (e.g., model numbers like `"fx-991"` or location substrings):
     ```sql
     CREATE EXTENSION IF NOT EXISTS pg_trgm;
     CREATE INDEX "listings_title_trgm_idx" ON "listings" USING GIN ("title" gin_trgm_ops);
     CREATE INDEX "listings_description_trgm_idx" ON "listings" USING GIN ("description" gin_trgm_ops);
     CREATE INDEX "listings_location_trgm_idx" ON "listings" USING GIN ("location" gin_trgm_ops);
     ```
   - **Complementary Option (PostgreSQL Full-Text Search `tsvector`):** Consider a stored generated `tsvector` column + GIN index if multi-word relevance ranking or English stemming is later required, paired with `pg_trgm` for partial token matching.
3. **Pagination Scalability:**
   Current `OFFSET` (`skip`) up to `page <= 1000` must traverse and discard preceding rows on deep pages. When catalog size grows significantly, upgrade infinite scroll or "Next" navigation to keyset/cursor pagination using `(createdAt, id)` or `(price, createdAt, id)` (already deterministic via `buildOrderBy`), while bounding `COUNT(*)` impact if needed.

---

## 5. Phase B Implementation: Frontend Search, Filters & Sorting UI

### Frontend Component & State Structure

- **URL State & Validation Helpers (`src/lib/marketplace-search.ts`)**:
  - `parseMarketplaceSearchParams`: Safely parses server `searchParams`, query strings, or `URLSearchParams` into `MarketplaceFilterState` + strict `ListMarketplaceQuery`, normalizing `q` and `location`, checking enums/prices/integers, dropping malformed/unknown/duplicate/inverted parameters cleanly with user-facing `warnings`, and ignoring legacy `search=` params.
  - `serializeMarketplaceSearchParams` & `buildMarketplaceHref`: Builds canonical shareable `/marketplace` URLs omitting empty values and defaults (`sort=newest`, `page=1`, `limit=12`).
  - `applyMarketplaceFilterPatch`, `removeIndividualMarketplaceFilter`, `clearAllMarketplaceFilters`: Ensures every non-page filter or sort change resets pagination to `page: 1`, supports single-chip removal, and counts panel filters (`category`, `condition`, `minPrice`, `maxPrice`, `location`) vs total active facets.
- **Accessible Sheet Primitive (`src/components/ui/sheet.tsx`)**:
  - Wraps `@base-ui/react/dialog` (`Dialog`) with focus management, backdrop dismissal, `Escape` closing, and responsive slide-over drawer styling for mobile filtering.
- **Modular Marketplace Search UI (`src/components/marketplace/`)**:
  - `MarketplaceSearchBar.tsx`: Keyword search (`q`) with `400ms` debounce, immediate `Enter` / Search submit (cancelling pending debounce), clear button, inline validation (`max 100` chars / control-char guard), spinner loading feedback, and external-URL resync/stale-timer cancellation.
  - `MarketplaceFilterPanel.tsx`: Shared Category (`CATEGORY_LIST`), Condition (`CONDITIONS`), INR Min/Max Price (`validatePriceFilterInputs` rejecting negative, malformed, >2-decimal, `> 10,000,000`, and inverted `minPrice > maxPrice`), and General Location controls supporting `"desktop"` and `"mobile"` modes.
  - `MarketplaceSortSelect.tsx`: Server-backed sort dropdown (`newest`, `oldest`, `price_asc`, `price_desc`).
  - `MarketplaceActiveFilters.tsx`: Removable applied filter chips + `Clear all filters` trigger.
  - `MarketplacePagination.tsx`: Preserves all active query filters and sort order across `Previous`, numbered page buttons (bounded ellipsis window), and `Next` `<Link>` elements.
  - `MarketplaceCatalogClient.tsx`: Coordinates search/filter/sort/clear/error/skeleton/empty/no-results/out-of-range states via `useTransition` + `router.push(..., { scroll: false })` while preventing redundant navigations when the serialized query matches `appliedQueryString`.
- **Route & Navigation Wiring**:
  - `src/app/marketplace/page.tsx` & `src/app/marketplace/loading.tsx`: Parses `await searchParams` inside `<Suspense>`, fetches via `getPublicMarketplaceListings`, preserves `SALE` + `ACTIVE` isolation, renders `MarketplaceListingCard`, and includes sanitized failure UI without leaking DB errors.
  - `src/constants/navigation.ts`: Connects Footer category links directly to `/marketplace?category=BOOKS|ELECTRONICS|CYCLES|STATIONERY`; landing page search CTAs preserve `/marketplace` and authentication flows without redesign.

### URL Query-State & Interaction Patterns

- **URL as Single Source of Truth:** Applied search keywords, filters, sort order, and page numbers live exclusively in `/marketplace?...` query parameters (`q`, `category`, `condition`, `minPrice`, `maxPrice`, `location`, `sort`, `page`, `limit`). Refreshing, sharing, or navigating with Browser Back/Forward restores state from updated server-parsed `appliedState` props while canceling pending debounce timers.
- **Desktop Layout:** Left persistent filter sidebar (`270px`) paired with main results column containing top keyword SearchBar, results range count + Sort toolbar, active filter chips, 1/2/3-column responsive card grid, and pagination. Clicking a category/condition pill updates immediately; INR Price Range & Location submit together via `Apply Price & Location` (or `Enter`) after client-side validation.
- **Mobile Layout:** Full-width SearchBar above the toolbar, compact `Filters` trigger button displaying active panel filter badge count (`N`), opening `Sheet` drawer with staged filter controls, inline validation, `Clear All Filters`, and `Apply Filters` buttons.

### Known Limitations & Testing Boundaries

1. **Automated Testing vs Live Browser Verification:** Phase B unit/SSR tests (`src/__tests__/marketplace-search-ui.test.ts`) verify URL parsing/serialization, validation, filter resets, footer/landing integration, and Server/Client HTML output via `vitest` (`renderToStaticMarkup` with mocked Prisma/auth/router in Node). Real client DOM hydration events (`400ms` live debounce timing, interactive Sheet portal focus trapping, Back/Forward history stack clicks) and live Neon/Cloudinary calls remain deferred to manual browser E2E testing.
2. **Legacy Category Filter Casing:** URL `?category=` and `?condition=` follow backend Zod enum casing strictly (`BOOKS`, `LIKE_NEW`); non-canonical casing is ignored gracefully with a warning notice rather than silently coercing.
3. **Scroll Behavior on Pagination:** Filter/search/sort `router.push` calls pass `{ scroll: false }` to avoid jumping mid-typing; `<Link>` pagination transitions scroll normally.

---

## 6. Phase C Database Performance Audit, Indexing Strategy & Optimization

> **Live Execution Note:** Neither live PostgreSQL queries nor `EXPLAIN (ANALYZE, BUFFERS)` benchmarks were executed against Neon in Phase C. `prisma/schema.prisma` and `prisma/migrations/` were left unmodified, and no PostgreSQL extensions or indexes were applied.

### 1. Query Audit Findings (`src/lib/services/listings.ts` & Schema)

Inspection of Prisma queries and migration SQL (`20261126212211_init`, `20261127110932_add_authentication`) identified:

1. **Existing Index Coverage on `listings` & `listing_images`:**
   - `listings`: Primary key `listings_pkey` (`id`), plus five single-column B-tree indexes: `listings_userId_idx`, `listings_type_idx`, `listings_category_idx`, `listings_status_idx`, `listings_createdAt_idx`.
   - `listing_images`: Single-column index `listing_images_listingId_idx` (`listingId`).
   - **Gaps:** No composite `(type, status, ...)` or partial `SALE + ACTIVE` indexes, no `price` or `condition` indexes, no user+status composite index (`userId, type, status, createdAt, id`), and no `pg_trgm` GIN indexes for leading-wildcard `ILIKE '%...%'` searches.
2. **Card Browse Over-Fetching (`findMany` Projection Overhead):**
   - `/marketplace` browse cards (`MarketplaceListingCard`) only display `id`, `title`, `category`, `condition`, `price`, `location`, `status`, timestamps, and the first photo (`images[0]`), yet previously reused `MARKETPLACE_LISTING_SELECT`, fetching `@db.Text description` (up to `3,000` chars/row + TOAST fetches), an unused `users` join (`seller`), and up to `5` child `listing_images` rows per card across 12–50 cards per page.
3. **Owner Listings Non-Deterministic Tie-Breaking:**
   - `getUserMarketplaceListings` sorted solely by `[{ createdAt: "desc" }]` without a `{ id: "desc" }` tie-breaker.
4. **Concurrency, N+1 & Pagination Patterns:**
   - Prisma 7 relation `select` batches child `images`/`user` rows in `WHERE "listingId" IN (...)` rather than N+1 per-row queries. `getPublicMarketplaceListings` and `getPublicMarketplaceListingCards` run `findMany` + `count` concurrently via `Promise.all`; note that this issues two separate concurrent database queries over pooled connections rather than a single combined database round trip.
   - Deep `OFFSET` (`skip`) up to `page = 1000` remains expensive on large catalogs, and filtered `count` scans all matching rows.

### 2. Proposed Index Strategy (Review-Only Proposal)

See [docs/DAY4_INDEX_MIGRATION_PROPOSAL.sql](./DAY4_INDEX_MIGRATION_PROPOSAL.sql) for the complete review-only DDL, locking notes, Prisma schema sync steps, and rollback SQL:

- **Minimal Partial Composite B-Tree Indexes (scoped `WHERE "type" = 'SALE' AND "status" = 'ACTIVE'`):**
  1. `listings_sale_active_created_id_idx` on `("createdAt" DESC, "id" DESC)` — serves `newest` (forward) and `oldest` (reverse index scan) without indexing `SOLD`/`REMOVED`/`LOST`/`FOUND` rows.
  2. `listings_sale_active_category_created_id_idx` on `("category", "createdAt" DESC, "id" DESC)` — serves Category-filtered browse + default time sort. (`Condition` has only 4 values, so omitting standalone/permuted `condition` indexes avoids redundant write/storage bloat.)
  3. `listings_sale_active_price_asc_idx` on `("price" ASC, "createdAt" DESC, "id" DESC)` — accelerates INR `minPrice`/`maxPrice` range scans and `price_asc` Top-N retrieval (`price_desc` uses `price` range + bounded Top-N heap sort on identical-price ties to avoid duplicate mirrored indexes).
- **Composite Operational B-Tree Indexes:**
  4. `listings_user_type_status_created_id_idx` on `("userId", "type", "status", "createdAt" DESC, "id" DESC)` — serves `/dashboard/listings` and can supersede single-column `listings_userId_idx`.
  5. `listing_images_listing_created_id_idx` on `("listingId", "createdAt" ASC, "id" ASC)` — accelerates ordered `take: 1` primary thumbnails & gallery loads, superseding `listing_images_listingId_idx`.
- **PostgreSQL `pg_trgm` GIN Substring Indexes (Neon Compatible):**
  6. Partial GIN indexes (`listings_sale_active_title_trgm_idx`, `listings_sale_active_desc_trgm_idx`, `listings_sale_active_location_trgm_idx`) using `gin_trgm_ops` `WHERE "type" = 'SALE' AND "status" = 'ACTIVE'` — preserves exact `q` (`title` OR `description`) and `location` `ILIKE '%...%'` semantics with zero external search engine, bounded to active marketplace listings.
  - **Trade-offs & Caveats:** GIN indexes add `INSERT`/`UPDATE` write amplification (`fastupdate = on` helps batch updates), `pg_trgm` lacks selectivity on 1–2 char substrings, and partial/GIN indexes require custom SQL migrations alongside Prisma schema maintenance.

### 3. Application-Level Optimizations Implemented (Schema-Free)

- Added `MARKETPLACE_CARD_SELECT`, `toMarketplaceCardDTO`, and `getPublicMarketplaceListingCards` in `src/lib/services/listings.ts` (`src/lib/marketplace-ui.ts` adds `MarketplaceListingCardDTO`) and wired `src/app/marketplace/page.tsx` to use it:
  - Omits `@db.Text` `description` projection (still searchable in `WHERE`) and eliminates the unused `users` join on `/marketplace` cards.
  - Bounds `images` relation query to `take: 1` ordered by `createdAt ASC`.
  - Reduces DB row transfer and Next.js RSC payload size cleanly while leaving `GET /api/listings` (`getPublicMarketplaceListings`) and `MarketplaceListingDTO` 100% intact.
- Extracted shared `buildPublicMarketplaceWhere(query)` to guarantee identical `findMany` and `count` filter predicates across card and API paths.
- Added `{ id: "desc" }` deterministic tie-breaker to `getUserMarketplaceListings`.

### 4. Migration Approval Requirements

1. Review [docs/DAY4_INDEX_MIGRATION_PROPOSAL.sql](./DAY4_INDEX_MIGRATION_PROPOSAL.sql) before modifying `prisma/schema.prisma` or `prisma/migrations/`.
2. Approve whether to use partial SQL indexes (custom raw SQL via `npx prisma migrate dev --create-only`) or Prisma-native full composite `@@index(...)` declarations, and approve enabling `pg_trgm` on Neon.
3. Run index creation tests on a disposable Neon development branch via unpooled `DIRECT_URL`, noting lock duration (`SHARE` lock inside `prisma migrate deploy` transactions vs `CREATE INDEX CONCURRENTLY` outside transactions with `lock_timeout`).

### 5. Future Performance Benchmarking Procedure (Neon Development Database)

1. **Seed Representative Synthetic Data (Dev Branch Only):** Populate non-production synthetic rows (e.g., `10k–50k` mixed `SALE`/`LOST`/`FOUND` & `ACTIVE`/`SOLD`/`REMOVED` listings with realistic `200–2500` byte descriptions and `1–5` `listing_images` rows per listing) and run `ANALYZE listings; ANALYZE listing_images;`.
2. **Capture Baseline Query Plans:** Execute `EXPLAIN (ANALYZE, BUFFERS)` for:
   - Default browse (`LIMIT 12 OFFSET 0`), deep offset (`OFFSET 600` / page `51`)
   - Category + Condition + Price range + `price_asc` & `price_desc`
   - Keyword `q` (common 3+ char word, selective 6+ char term, short 2-char term) and `location` filter
   - Exact matching `SELECT COUNT(*)` queries
3. **Apply Proposal & Compare:** Apply `docs/DAY4_INDEX_MIGRATION_PROPOSAL.sql` cleanly on the dev branch, run `ANALYZE listings; ANALYZE listing_images;`, and re-run identical `EXPLAIN (ANALYZE, BUFFERS)` queries.
4. **Verify Index Usage, Storage & Write Cost:** Record execution times (ms), shared buffer reads vs hits, sequential vs index/bitmap-heap scan choices, short-term selectivity behavior, offset scan cost, and storage footprint (`pg_indexes_size('listings')`, `pg_stat_user_indexes.idx_scan`).

### 6. Remaining Performance Limitations

- No live Neon PostgreSQL latency or buffer benchmarks have been measured yet.
- Offset pagination (`OFFSET (page - 1) * limit`) remains linear in skipped rows for deep pages until cursor/keyset pagination replaces deep page jumps.
- Sub-3-character search inputs (`q` or `location` with 1–2 characters) gain minimal benefit from `pg_trgm` GIN indexes.
- `GET /api/listings` continues returning full `description`, `seller`, and up to `5` images per item to preserve existing public REST API contracts.

---

## 7. Phase D Implementation: GitHub Actions Continuous Integration

- **Workflow File:** `.github/workflows/ci.yml` (`Khoj CI`), triggered on pushes (`main`, `feat/**`, `fix/**`, `chore/**`) and pull requests targeting `main`, with `contents: read`, ref concurrency cancellation, and `timeout-minutes: 15`.
- **Pinned Runtime & Dependencies:** Uses `ubuntu-latest`, `actions/checkout@v4`, `actions/setup-node@v4` pinned to Node.js `22.14.0` (`package.json` `engines.node >=22.12.0 <23`), npm lockfile caching, and `sharp@0.35.5` declared explicitly as a runtime dependency with Linux platform binaries in `package-lock.json`.
- **Sequential Quality Gates (`npm ci` -> `npx prisma generate` -> `npx prisma validate` -> `npx tsc --noEmit` -> `npm run lint` -> `npm run test` -> `npm run build`):** Fail-fast with zero `continue-on-error` bypasses.
- **Safe Non-Secret Environment Configuration:** Passes CI-only local placeholder values (`DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `OTP_HASH_SECRET`, `localhost` URLs) with `SMTP_*` and `CLOUDINARY_*` omitted and no `.env` access.
- **Build-Time External Connection Prevention:** Added `await connection()` before the database query in `src/app/api/health/route.ts` (under Next.js 16 `cacheComponents: true`) and moved `await headers()` outside `try/catch` in `src/lib/authorization.ts` so build-time prerendering stops cleanly without invoking Prisma against live/placeholder databases.
- **Pending Verification Follow-up:** Index benchmarking and migration approval for `docs/DAY4_INDEX_MIGRATION_PROPOSAL.sql` remain pending, and remote GitHub Actions CI execution remains unverified until pushed to GitHub.

---

## 8. Phase E Closure & Day 5 Readiness

- **Completed Day 4 Deliverables:**
  - Advanced Marketplace search backend (`q`, `category`, `condition`, INR `minPrice`/`maxPrice`, `location`, `sort`, bounded pagination, `.strict()` validation, deterministic tie-breaking).
  - Responsive `/marketplace` search/filter/sorting UI (400ms debounced `MarketplaceSearchBar`, Desktop sidebar & Mobile Base UI `Sheet` filter panel, removable chips, URL synchronization, footer category shortcuts).
  - Schema-free query optimization (`MARKETPLACE_CARD_SELECT`, `getPublicMarketplaceListingCards`, `getUserMarketplaceListings` tie-breaker) + review-only PostgreSQL index proposal (`docs/DAY4_INDEX_MIGRATION_PROPOSAL.sql`).
  - Reproducible GitHub Actions pipeline (`.github/workflows/ci.yml`) + build-time external DB isolation fixes (`/api/health` `connection()`, `getCurrentUser()` `await headers()` handling).
- **Verified Automated Suite:** **206 automated tests pass across 14 test files** in Vitest (mocked DB/Auth/SMTP/Cloudinary), plus clean `prisma generate`, `prisma validate`, `tsc --noEmit`, `eslint`, and Next.js 16 production `build`.
- **Deferred Verification (Unchanged Status):** PostgreSQL composite/`pg_trgm` index approval and `EXPLAIN (ANALYZE, BUFFERS)` benchmarks, live Neon/SMTP/Cloudinary integration checks, and live headless/manual browser interaction checks remain unexecuted.
- **Day 5 Next Requirements:** Implement **private buyer-seller contact requests** backed by the existing Prisma `ContactRequest` model for authenticated buyers on `ACTIVE` `SALE` listings, preserving seller email/location privacy and building seller consent/inbox controls cleanly.


