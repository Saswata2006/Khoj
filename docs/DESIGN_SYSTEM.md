# Khoj Dark Design System (V2)

Khoj uses a dark-first, charcoal-neutral visual language combining the precision of Linear, Vercel, and Raycast with contemporary consumer marketplace composition. Color is restrained intentionally so primary actions, product photography, tabular prices, and clear state transitions remain effortless to scan.

---

## 1. Color Palette & Surface Elevation

All semantic tokens live in [globals.css](file:///Users/Saswata007/Developer/Khoj/src/app/globals.css) with `dark` enabled by default in [layout.tsx](file:///Users/Saswata007/Developer/Khoj/src/app/layout.tsx) and `color-scheme: dark` set globally.

| Token | Hex Value | Role & Usage |
| :--- | :--- | :--- |
| `--background` | `#09090B` | Main application canvas (`html`, `body`, page backdrop) |
| `--card` | `#111113` | Primary content cards, forms, filter sidebar, listing cards |
| `--elevated` / `--popover` | `#18181B` | Elevated panels, dialogs, dropdown options, nested containers |
| `--surface-secondary` / `--muted` | `#1C1C20` | Secondary badges, progress tracks, avatar chips |
| `--border` / `--input` | `#27272A` | 1px structural hairline dividers and control outlines (`#3F3F46` on hover) |
| `--accent` | `#10B981` | Emerald accent: primary CTAs, active nav states, focus rings, `Available` states |
| `--accent-hover` | `#34D399` | Emerald hover state and high-contrast positive text on `#09090B` / `#111113` |
| `--accent-foreground` | `#052E16` | High-contrast dark ink on solid `#10B981` emerald CTA surfaces |
| `--foreground` | `#FAFAFA` | Primary headings, body copy, listing titles, active controls |
| `--muted-foreground` | `#A1A1AA` | Secondary descriptions, metadata, labels, helper copy |
| `--subtle-foreground` | `#71717A` | Tertiary captions, monospace code/metadata tags, placeholders |
| `--destructive` | `#EF4444` | Error borders and destructive triggers (paired with `#FCA5A5` readable text) |
| `--warning` | `#F59E0B` | `Sold` status pills, admin role badges, URL sanitization notices (`#FCD34D` / `#FBBF24` text) |

### Selective Accent Rule
- **Do NOT paint large regions emerald.** Keep structural surfaces charcoal (`#09090B`, `#111113`, `#18181B`).
- Reserve `#10B981` / `#34D399` for:
  1. Primary CTA buttons (`Button variant="accent"`)
  2. Active navigation dots, workspace sidebar active pills, and current pagination items
  3. Focus outlines (`focus-visible:border-[#10B981] focus-visible:ring-[#10B981]/25`)
  4. Verified email indicator chips & `Available` marketplace indicators

---

## 2. Expressive Typography & Scale

Fonts use existing `Geist` (`--font-sans`) and `Geist_Mono` (`--font-geist-mono`) configured via `next/font/google` in [layout.tsx](file:///Users/Saswata007/Developer/Khoj/src/app/layout.tsx), avoiding external network bloat during offline or CI builds.

| Role | Class / CSS Token | Behavior |
| :--- | :--- | :--- |
| Hero Display H1 | `.text-display-hero` | `clamp(2.55rem, 5.6vw, 4.5rem)`, `line-height: 0.98`, `letter-spacing: -0.04em` |
| Section / Page H1–H2 | `.text-section-heading` | `clamp(1.65rem, 3vw, 2.35rem)`, `line-height: 1.12`, `letter-spacing: -0.025em` |
| Price Readouts | `.price-tabular` | `font-variant-numeric: tabular-nums; letter-spacing: -0.02em;` across cards and summary rails |
| Card Title | `font-heading text-base font-semibold` | Scannable neutral `#FAFAFA` heading inside [card.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/ui/card.tsx) |
| Technical Labels / Counts | `font-mono text-[10px..11px] uppercase tracking-widest` | Used strictly for step numbers, query param hints, OTP digits, pagination, and count pills |

---

## 3. Visual Depth, Motion & Surface Utilities

Defined in [globals.css](file:///Users/Saswata007/Developer/Khoj/src/app/globals.css):
- **`.surface-specular`**: Subtle `inset 0 1px 0 0 rgba(255,255,255,0.05)` top edge highlight with deep soft shadow for card separation against `#09090B`.
- **`.card-interactive`**: Restrained `translateY(-2px)` hover lift + `#3F3F46` border brightening used on category tiles and marketplace listing cards.
- **`.bg-khoj-grid` & `.bg-khoj-dots`**: Low-opacity architectural grid and dot-matrix backdrops used selectively in Hero, AuthShell, Showcase artwork, and missing-image placeholders.
- **Staggered Entrance & Shimmer**: `.animate-khoj-enter`, `.animate-khoj-stagger-1..3`, and `.khoj-skeleton-shimmer` for smooth page reveal and loading feedback.
- **`prefers-reduced-motion`**: Collapses keyframe durations, hover lifts, and smooth-scroll automatically when enabled by the OS.

---

## 4. V2 Navigation, Landing & Workspace Patterns

- **Floating Navigation Header ([Navbar.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/layout/Navbar.tsx)):** Sticky `rounded-2xl` floating bar (`bg-[#0C0C0F]/88 backdrop-blur-xl`), explicit `activePath` highlighting, non-redundant authenticated nav, and keyboard-accessible **Account Dropdown** (`[initials]`, `Escape` / click-outside closure, `Profile Settings`, `Manage Listings`, `Logout`).
- **Editorial Hero & Abstract Showcase ([HeroSection.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/landing/HeroSection.tsx), [HeroShowcase.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/landing/HeroShowcase.tsx)):** `clamp()` headline spotlighting *"Find it. Sell it. Reclaim it."*, functional search wired to `/marketplace?q=...`, valid category pills (`BOOKS`, `ELECTRONICS`, `CYCLES`, `ACCESSORIES`, `STATIONERY`), and original SVG/CSS UI composition replacing text-heavy cards without fabricating listings or stats.
- **Category Discovery ([CategoryDiscoverySection.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/landing/CategoryDiscoverySection.tsx)):** Maps all 7 `CATEGORY_LIST` entries directly to `/marketplace?category=<VALUE>`.
- **Asymmetric Bento & Honest Trust ([FeaturesSection.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/landing/FeaturesSection.tsx)):** Varied 7/5 and 4/4/4 column Bento tiles accurately communicating email OTP ownership checks, initials-only public privacy, validated photo uploads, and upcoming Lost & Found support.
- **Marketplace Catalog & Details ([MarketplaceCatalogClient.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/marketplace/MarketplaceCatalogClient.tsx), [ListingGallery.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/marketplace/ListingGallery.tsx)):** Quick horizontal category rail, sticky desktop sidebar, mobile `Sheet` filter drawer, `4:3` hover-zoom photography cards, gallery photo count badge, and sticky detail summary rail.
- **Unified Workspace Shell ([WorkspaceShell.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/layout/WorkspaceShell.tsx)):** Sticky desktop sidebar (`256px`) with compact mobile navigation bar shared across `/dashboard`, `/dashboard/listings`, `/profile`, and `/admin`—plus clean reserved roadmap slots (`Contact Requests`, `Lost & Found`).

---

## 5. Extending for Day 5–7 Milestones

- **Day 5 (Contact Requests UI):** Activate the buyer contact inquiry trigger on `/marketplace/[id]` using `Button variant="accent"` + [Dialog](file:///Users/Saswata007/Developer/Khoj/src/components/ui/dialog.tsx), and promote the `Contact Requests` slot inside [WorkspaceShell.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/layout/WorkspaceShell.tsx) to an interactive route link.
- **Day 6 (Lost & Found) & Day 7 (Moderation):** Reuse [MarketplaceCatalogClient.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/marketplace/MarketplaceCatalogClient.tsx) search/filter URL patterns, [StatePanel](file:///Users/Saswata007/Developer/Khoj/src/components/ui/state-panel.tsx), and [WorkspaceShell.tsx](file:///Users/Saswata007/Developer/Khoj/src/components/layout/WorkspaceShell.tsx).
