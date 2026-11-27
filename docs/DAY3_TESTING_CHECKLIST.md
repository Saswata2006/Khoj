# Khoj — Day 3 Live Integration & Manual Testing Checklist (Deferred)

> **Status:** All checks below are **deferred and unexecuted**. Automated Vitest suites mock PostgreSQL, Better Auth, Nodemailer, and Cloudinary. Do not mark items complete until tested against a live Neon database, Gmail SMTP credentials, and Cloudinary dev environment.

---

## 1. Environment & Database Readiness

- [ ] Verify `.env` contains isolated development credentials for `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `OTP_HASH_SECRET` (>= 32 chars), SMTP (`587` STARTTLS), and Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).
- [ ] Run `npx prisma validate` and verify `npx prisma migrate status` shows no pending migrations against Neon development DB.
- [ ] Verify `GET /api/health` returns `{ status: "ok", db: "connected" }`.

---

## 2. Authentication & Session Baseline (Prerequisites)

- [ ] Sign in on `/login` -> `/verify` with a personal email address (e.g. Gmail) and receive real 6-digit OTP email.
- [ ] Verify an unauthenticated visitor visiting `/marketplace/create`, `/marketplace/[id]/edit`, and `/dashboard/listings` is redirected to `/login?redirectTo=...`.

---

## 3. Marketplace CRUD & Neon Persistence

- [ ] Create a listing on `/marketplace/create` with valid title, description, category, condition, positive INR price, and meetup location.
- [ ] Verify DB record in Neon `listings` table has `type = 'SALE'`, `status = 'ACTIVE'`, decimal `price`, and `userId` matching signed-in user.
- [ ] Edit the listing on `/marketplace/[id]/edit` and verify updated fields persist in Postgres and appear immediately on `/marketplace/[id]`.
- [ ] Mark an `ACTIVE` listing as `SOLD` via `/dashboard/listings` confirmation modal (`PATCH /api/listings/[id]`) and confirm:
  - Item disappears from public `/marketplace` browse grid.
  - Item detail page `/marketplace/[id]` prominently shows **Sold — Unavailable** and disables visitor inquiries.
  - Subsequent `PATCH`, image `POST`/`DELETE`, and `/marketplace/[id]/edit` requests return `409` / locked state.
- [ ] Soft-delete (`Remove`) a listing via `/dashboard/listings` (`DELETE /api/listings/[id]`) and verify:
  - DB status updates to `REMOVED` (row preserved for audit, not hard-deleted).
  - `/marketplace/[id]` returns 404 Not Found.

---

## 4. Real Cloudinary Uploads, Validation & Deletions

- [ ] Upload valid JPEG, PNG, and WebP images (<= 3 MiB) to an `ACTIVE` listing via `/marketplace/create` and `/marketplace/[id]/edit`.
- [ ] Verify Cloudinary console stores assets strictly under `khoj/development/listings/<listingId>/img_<uuid>` and EXIF/GPS metadata from phone photos is stripped cleanly.
- [ ] Attempt uploading a corrupted file (e.g., renamed text file or truncated JPEG), an unsupported format (GIF/PDF/SVG), and an oversized file (> 3 MiB), confirming server rejects with `400` / `413` before Cloudinary upload.
- [ ] Attempt uploading 6th image (or two concurrent uploads at 4/5 count) and confirm 5-image cap (`409`) and compensating cleanup leave zero orphan DB mismatches.
- [ ] Delete a saved image via inline confirmation on `/marketplace/[id]/edit` (`DELETE /api/listings/[id]/images/[imageId]`) and verify both Neon `listing_images` row removal and Cloudinary CDN asset invalidation/removal.

---

## 5. Cross-User Authorization & Privacy (IDOR Checks)

- [ ] Sign in as User B in a separate browser session and inspect User A's listing on `/marketplace/[id]`:
  - Verify `Edit Listing` is hidden and User A's `email`, `hostelBlock`, and role are absent from HTML and `GET /api/listings/[id]` JSON.
- [ ] Send direct `PATCH /api/listings/<userA_id>`, `DELETE /api/listings/<userA_id>`, `POST /api/listings/<userA_id>/images`, and `DELETE /api/listings/<userA_id>/images/<imgId>` as User B and confirm `403 Forbidden`.
- [ ] Visit `/marketplace/<userA_id>/edit` as User B and confirm **Access Denied (403)** renders without revealing private listing details.
- [ ] Verify User B's `/dashboard/listings` returns only User B's listings (`404` / no cross-listing image delete when supplying User A's `imageId` under User B's `listingId`).

---

## 6. UI, Responsiveness & Failure Recovery

- [ ] Test **Partial Upload Failure Recovery** on `/marketplace/create` (simulate network failure on 2nd photo via DevTools offline toggle):
  - Confirm `POST /api/listings` is not re-sent when clicking **Retry Upload**.
  - Refresh the browser tab (`F5`) mid-recovery and confirm the `sessionStorage` recovery banner restores access to the already-created listing without prompting duplicate creation.
- [ ] Verify Next.js `<Image>` optimization renders Cloudinary photos smoothly across `/marketplace`, `/marketplace/[id]`, and `/dashboard/listings` on both desktop (`>= 1024px`) and mobile (`~375px`) viewports without console errors or `remotePatterns` failures.
- [ ] Verify missing-image fallback placeholder renders cleanly when a listing has `0` photos.
