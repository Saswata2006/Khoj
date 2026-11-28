-- ============================================================================
-- Khoj — Day 4 Phase C Database Index & Search Performance Migration Proposal
-- ============================================================================
-- STATUS: REVIEW-ONLY PROPOSAL (NOT AN APPLIED MIGRATION)
-- TARGET BRANCH: feat/day-4-search-filters
-- TARGET DATABASE: PostgreSQL (Neon Serverless / Direct Unpooled Migration URL)
--
-- IMPORTANT SAFETY NOTICE:
--   1. Do NOT run blindly in production or modify `prisma/migrations/` until
--      reviewed, approved, and verified via `EXPLAIN (ANALYZE, BUFFERS)` on a
--      representative development branch/database.
--   2. Prisma's `prisma/schema.prisma` has NOT been modified in Phase C.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SECTION 1: PostgreSQL Extension Requirement (Substring Search Optimization)
-- ----------------------------------------------------------------------------
-- Prisma `{ contains: term, mode: "insensitive" }` compiles to `ILIKE '%term%'`.
-- Standard B-tree indexes cannot accelerate leading-wildcard substring matches.
-- Neon PostgreSQL natively bundles `pg_trgm` without external search SaaS.
--
-- Short-term caveat:
--   Trigram extraction requires >= 3 characters for optimal selectivity; 1-2
--   character queries (`q=tv`) remain bounded by active partial filters or heap checks.

CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ----------------------------------------------------------------------------
-- SECTION 2: Minimal Proposed Indexes (Rationale & Trade-offs)
-- ----------------------------------------------------------------------------

-- 1) Public Marketplace Feed + Time Ordering (`newest` & `oldest`)
-- Query served:
--   WHERE "type" = 'SALE' AND "status" = 'ACTIVE'
--   ORDER BY "createdAt" DESC, "id" DESC   (or ASC, ASC via backward scan)
-- Rationale:
--   A partial B-tree index scoped strictly to `ACTIVE` `SALE` listings excludes
--   `SOLD`, `REMOVED`, `LOST`, and `FOUND` rows, keeping index footprint small in
--   Neon shared buffers and accelerating both `newest` (forward scan) and `oldest`
--   (PostgreSQL native backward B-tree scan) without a duplicate ASC index.
CREATE INDEX IF NOT EXISTS "listings_sale_active_created_id_idx"
  ON "listings" ("createdAt" DESC, "id" DESC)
  WHERE "type" = 'SALE' AND "status" = 'ACTIVE';


-- 2) Category Filter + Default Marketplace Sort
-- Query served:
--   WHERE "type" = 'SALE' AND "status" = 'ACTIVE' AND "category" = $1
--   ORDER BY "createdAt" DESC, "id" DESC
-- Rationale:
--   Allows direct index range + pre-sorted Top-N retrieval for the primary
--   category filter pills without heap sorting matching rows.
--   Note on `condition`: `Condition` has only 4 enum values (`NEW`, `LIKE_NEW`,
--   `GOOD`, `FAIR`). Omitting standalone or `(category, condition, ...)` index
--   permutations prevents write/storage bloat; when combined with `category`,
--   Postgres efficiently heap-filters the small `condition` subset.
CREATE INDEX IF NOT EXISTS "listings_sale_active_category_created_id_idx"
  ON "listings" ("category", "createdAt" DESC, "id" DESC)
  WHERE "type" = 'SALE' AND "status" = 'ACTIVE';


-- 3) INR Price Range Filter & Low-to-High Price Sort (`minPrice`, `maxPrice`, `price_asc`)
-- Query served:
--   WHERE "type" = 'SALE' AND "status" = 'ACTIVE'
--     [AND "price" >= $1] [AND "price" <= $2]
--   ORDER BY "price" ASC, "createdAt" DESC, "id" DESC
-- Rationale:
--   Accelerates INR price range scans and satisfies `price_asc` Top-N retrieval
--   with zero sort step.
--   Trade-off on `price_desc`: `price_desc` orders `price DESC, createdAt DESC, id DESC`,
--   whose tie-breaker directions differ from a backward scan of `(price ASC, createdAt DESC)`.
--   Only a single ASC partial index is proposed to avoid doubling price index
--   writes; PostgreSQL still leverages `price` bounds via index scan + bounded Top-N sort.
CREATE INDEX IF NOT EXISTS "listings_sale_active_price_asc_idx"
  ON "listings" ("price" ASC, "createdAt" DESC, "id" DESC)
  WHERE "type" = 'SALE' AND "status" = 'ACTIVE';


-- 4) Seller Dashboard / My Listings Queries (`getUserMarketplaceListings` + `profile.ts`)
-- Query served:
--   WHERE "userId" = $1 AND "type" = 'SALE' [AND "status" = $2]
--   ORDER BY "createdAt" DESC, "id" DESC
-- Rationale:
--   Leading column `"userId"` preserves fast user-level counts (`prisma.listing.count({ where: { userId } })`),
--   so once applied this index can safely supersede the older single-column `listings_userId_idx`.
CREATE INDEX IF NOT EXISTS "listings_user_type_status_created_id_idx"
  ON "listings" ("userId", "type", "status", "createdAt" DESC, "id" DESC);


-- 5) Primary Listing Thumbnail / Gallery Ordering (`listing_images`)
-- Query served:
--   WHERE "listingId" IN (...) ORDER BY "createdAt" ASC, "id" ASC LIMIT 1
-- Rationale:
--   Enables ordered primary-image retrieval without per-listing sort steps;
--   leading `"listingId"` preserves FK lookup efficiency and can supersede `listing_images_listingId_idx`.
CREATE INDEX IF NOT EXISTS "listing_images_listing_created_id_idx"
  ON "listing_images" ("listingId", "createdAt" ASC, "id" ASC);


-- 6) Partial `pg_trgm` GIN Indexes for Substring `q` & `location` Filters
-- Queries served:
--   WHERE "type" = 'SALE' AND "status" = 'ACTIVE'
--     AND ("title" ILIKE '%term%' OR "description" ILIKE '%term%')
--   WHERE "type" = 'SALE' AND "status" = 'ACTIVE'
--     AND "location" ILIKE '%area%'
-- Rationale:
--   Scoping trigram GIN indexes via `WHERE "type" = 'SALE' AND "status" = 'ACTIVE'`
--   avoids indexing inactive (`SOLD`, `REMOVED`) and Lost & Found descriptions,
--   meaningfully limiting GIN posting-list storage and write amplification.
-- Trade-off:
--   GIN indexes carry higher INSERT/UPDATE maintenance cost (mitigated by
--   PostgreSQL `fastupdate = on`) and should be validated against real dataset scale.
CREATE INDEX IF NOT EXISTS "listings_sale_active_title_trgm_idx"
  ON "listings" USING GIN ("title" gin_trgm_ops)
  WHERE "type" = 'SALE' AND "status" = 'ACTIVE';

CREATE INDEX IF NOT EXISTS "listings_sale_active_desc_trgm_idx"
  ON "listings" USING GIN ("description" gin_trgm_ops)
  WHERE "type" = 'SALE' AND "status" = 'ACTIVE';

CREATE INDEX IF NOT EXISTS "listings_sale_active_location_trgm_idx"
  ON "listings" USING GIN ("location" gin_trgm_ops)
  WHERE "type" = 'SALE' AND "status" = 'ACTIVE';


-- ----------------------------------------------------------------------------
-- SECTION 3: Safe Deployment & Index Locking Considerations
-- ----------------------------------------------------------------------------
-- 1. Prisma Migrate Locking Behavior:
--    Standard `prisma migrate deploy` executes each `migration.sql` inside an
--    implicit transaction block (`BEGIN ... COMMIT`). Plain `CREATE INDEX`
--    acquires a `SHARE` table lock (reads allowed; INSERT/UPDATE/DELETE blocked)
--    for the duration of the build.
--
-- 2. Zero-Downtime `CONCURRENTLY` Option (Large Live Tables):
--    `CREATE INDEX CONCURRENTLY` cannot execute inside a transaction block.
--    For larger live tables, run `CREATE INDEX CONCURRENTLY ...` directly against
--    unpooled `DIRECT_URL` (never `-pooler` endpoints) prior to finalizing the
--    matching Prisma migration history entry, setting explicit `lock_timeout`:
--      SET lock_timeout = '3s';
--      CREATE INDEX CONCURRENTLY IF NOT EXISTS ...;
--
-- 3. Optional Redundant Legacy Single-Column Cleanup (After Approval & Verify):
--    Once index usage is confirmed in production (`pg_stat_user_indexes`),
--    legacy low-value single-column `listings_type_idx` / `listings_status_idx` /
--    `listings_userId_idx` / `listing_images_listingId_idx` may be evaluated
--    for removal via `schema.prisma` to reclaim write throughput.


-- ----------------------------------------------------------------------------
-- SECTION 4: Prisma Schema Synchronization Requirements
-- ----------------------------------------------------------------------------
-- - Prisma Schema Language (`@@index`) natively supports standard composite
--   indexes with sort direction, e.g.:
--     @@index([userId, type, status, createdAt(sort: Desc), id(sort: Desc)])
-- - Prisma PSL does NOT natively express partial index `WHERE` predicates or all
--   custom `gin_trgm_ops` partial index clauses cleanly without drift warnings.
-- - Recommended workflow once approved:
--     1. Update `prisma/schema.prisma` with any standard composite `@@index` entries.
--     2. Run `npx prisma migrate dev --create-only --name add_marketplace_search_indexes`.
--     3. Append the reviewed `CREATE EXTENSION` + partial/GIN DDL statements
--        to that generated `migration.sql`.
--     4. Test on a disposable Neon development branch (`npx prisma migrate deploy`
--        + `EXPLAIN (ANALYZE, BUFFERS)`) before deploying to production.


-- ----------------------------------------------------------------------------
-- SECTION 5: Rollback SQL
-- ----------------------------------------------------------------------------
-- Execute in reverse order if index rollback is needed (safe; leaves table data intact).
-- Add `CONCURRENTLY` outside transactions on busy production databases:
--
-- DROP INDEX IF EXISTS "listings_sale_active_location_trgm_idx";
-- DROP INDEX IF EXISTS "listings_sale_active_desc_trgm_idx";
-- DROP INDEX IF EXISTS "listings_sale_active_title_trgm_idx";
-- DROP INDEX IF EXISTS "listing_images_listing_created_id_idx";
-- DROP INDEX IF EXISTS "listings_user_type_status_created_id_idx";
-- DROP INDEX IF EXISTS "listings_sale_active_price_asc_idx";
-- DROP INDEX IF EXISTS "listings_sale_active_category_created_id_idx";
-- DROP INDEX IF EXISTS "listings_sale_active_created_id_idx";
-- -- Drop pg_trgm extension ONLY if no other objects in the database depend on it:
-- -- DROP EXTENSION IF EXISTS pg_trgm;
