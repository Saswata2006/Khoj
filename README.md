# Khoj

> **Find it. Sell it. Reclaim it.**

A modern, production-oriented, campus-exclusive marketplace and lost & found platform built specifically for verified college students.

---

## 1. Project Overview

**Khoj** is designed to replace chaotic campus WhatsApp groups, unverified public classifieds, and lost & found bulletin boards with a single secure, campus-gated web platform.

Enrolled college students can:
- **Buy and sell** second-hand textbooks, electronics, bicycles, and hostel room essentials directly with peers.
- **Post lost and found belongings** with precise campus location tags.
- **Submit and verify ownership claims** before releasing recovered items.
- **Request seller contact details privately** without broadcasting personal phone numbers.
- **Report inappropriate or suspicious listings** to campus moderators.

---

## 2. Problem Statement

Campus exchanges are currently plagued by major operational points of friction:
1. **WhatsApp & Telegram Chat Chaos**: Listing messages get buried within minutes under hundreds of general messages, spam posts, and unorganized chatter.
2. **Unverified Strangers & Fraud**: Public classified boards (OLX, Facebook Marketplace) invite outsiders and scammers onto campus grounds without institutional accountability.
3. **Lost Belongings Abandoned**: Lost calculators, lab kits, cycle keys, and ID cards sit unclaimed in security booths or lost in group chats with no structured recovery workflow.
4. **Awkward Hostel Lobby Negotiations**: Lack of standardized condition grading, pricing guidelines, and structured contact handshakes leads to student friction.

Khoj solves this by requiring verified college email authentication, standardizing categories and conditions, and providing a private claim-matching workflow.

---

## 3. Architecture

```mermaid
flowchart TD
    subgraph Client["Client Tier (Mobile-First Web)"]
        Landing["Branded Landing Page"]
        Nav["Responsive Layout & Navigation"]
        UI["shadcn/ui + Tailwind Design Tokens"]
    end

    subgraph Server["Application Server (Next.js 16 App Router)"]
        Routes["App Routes (/ & Metadata)"]
        HealthAPI["Health Check API (/api/health)"]
        Config["Centralized Config & Zod Validation"]
    end

    subgraph DataTier["Data Access Tier (Server-Only)"]
        PrismaClient["Prisma Client Singleton (src/lib/prisma.ts)"]
        NeonAdapter["Neon Driver Adapter (@prisma/adapter-neon)"]
    end

    subgraph Storage["Cloud Persistence (Neon PostgreSQL)"]
        Pooler["Neon Connection Pooler (DATABASE_URL)"]
        Direct["Neon Direct DDL Endpoint (DIRECT_URL)"]
        DB[("PostgreSQL Tables: users, listings, claims...")]
    end

    Client --> Routes
    Routes --> Config
    HealthAPI --> PrismaClient
    PrismaClient --> NeonAdapter
    NeonAdapter --> Pooler
    Pooler --> DB
    Server -.-> Direct
```

---

## 4. Current Implementation Status (Day 1 Complete)

| Component / Feature | Status | Notes |
| :--- | :--- | :--- |
| **Next.js 16 (Turbopack) & React 19** | Implemented ✅ | App Router, partial prefetching, zero prerender errors |
| **Tailwind CSS v4 & Theme Tokens** | Implemented ✅ | Primary (`#0F172A`), Accent (`#059669`), Background (`#F8FAFC`) |
| **shadcn/ui Components** | Implemented ✅ | Button, Card, Input, Badge, Separator, Skeleton |
| **Prisma ORM & Neon Driver Adapter** | Implemented ✅ | `@prisma/adapter-neon` via `@neondatabase/serverless` |
| **Prisma Client Singleton** | Implemented ✅ | `src/lib/prisma.ts` with `server-only` boundary |
| **Relational Database Schema** | Implemented ✅ | User, Listing, ListingImage, Claim, ContactRequest, Report |
| **Initial Database Migration** | Applied ✅ | Named migration `20261126212211_init` applied to Neon DB |
| **Health Check API (`/api/health`)** | Implemented ✅ | Lightweight `SELECT 1`, HTTP 200/503 sanitized response |
| **Centralized Config & Validation** | Implemented ✅ | `src/config/site.ts`, `campus.ts`, `env.ts` (Zod validation) |
| **Categories & Navigation Constants** | Implemented ✅ | 7 campus categories, listing types, conditions, footer nav |
| **Branded Responsive Landing Page** | Implemented ✅ | Navbar, Hero, Problem, Features, How It Works, Footer |
| **Unit Testing (Vitest)** | Implemented ✅ | 17 unit tests passing (mocked DB, zero live DB reliance) |
| **Live Database Connectivity** | Verified ✅ | Real query executed against Neon PostgreSQL (`khoj`) |
| **Campus Email Auth (Auth.js)** | Planned ⏳ | Scheduled for Day 2 |
| **Listing CRUD Operations** | Planned ⏳ | Scheduled for Day 3 |
| **Cloudinary Image Uploads** | Planned ⏳ | Scheduled for Day 3 |
| **Lost & Found Claims Engine** | Planned ⏳ | Scheduled for Day 4 |
| **Private Contact Requests** | Planned ⏳ | Scheduled for Day 5 |
| **Moderation & Flagging** | Planned ⏳ | Scheduled for Day 6 |
| **Vercel Cloud Deployment** | Planned ⏳ | Scheduled for Day 7 |

---

## 5. Technology Stack

- **Framework**: Next.js 16.4.6 (App Router with Turbopack)
- **Language**: TypeScript 5.9 (Strict mode enabled)
- **Styling**: Tailwind CSS 4.3 with CSS variables
- **Component Primitives**: shadcn/ui & Base UI
- **Database**: PostgreSQL hosted on Neon Serverless
- **ORM**: Prisma 7.10.1 with `@prisma/config`
- **Driver Adapter**: `@prisma/adapter-neon` + `@neondatabase/serverless`
- **Validation**: Zod 4.6
- **Icons**: Lucide React
- **Testing**: Vitest 5.1
- **Package Manager**: npm

---

## 6. Local Setup Instructions

### Prerequisites
- Node.js `v20.x` or `v22.x` (Recommended: `v22.14.0+`)
- npm `v10.x` or `v11.x`
- Neon PostgreSQL database instance

### 1. Clone & Enter Repository
```bash
git clone https://github.com/Saswata2006/Khoj.git
cd Khoj
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in the required database credentials:
```dotenv
NEXT_PUBLIC_APP_NAME="Khoj"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Neon pooled connection string for runtime queries
DATABASE_URL="postgresql://user:password@ep-xyz-pooler.region.aws.neon.tech/khoj?sslmode=require"

# Neon direct connection string for schema migrations
DIRECT_URL="postgresql://user:password@ep-xyz.region.aws.neon.tech/khoj?sslmode=require"

# Optional comma-separated institutional email domains (e.g. iitb.ac.in, bits-pilani.ac.in)
ALLOWED_EMAIL_DOMAINS=""
```

### 4. Run Database Migrations & Generate Prisma Client
```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Development Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server (Turbopack) |
| `npm run build` | Builds optimized production bundle |
| `npm run start` | Starts Next.js production server |
| `npm run lint` | Runs ESLint analysis |
| `npm run test` | Runs all Vitest unit tests |
| `npx tsc --noEmit` | Runs full TypeScript compiler type check |
| `npx prisma validate` | Validates Prisma schema syntax |
| `npx prisma migrate dev` | Applies pending migrations to the development database |
| `npx prisma studio` | Launches local database browser GUI |

---

## 8. Health Check API

Khoj provides a non-cached, production health check route:

```http
GET /api/health
```

**Success Response (HTTP 200)**:
```json
{
  "status": "ok",
  "database": "connected"
}
```

**Failure Response (HTTP 503)**:
```json
{
  "status": "error",
  "database": "unavailable"
}
```

---

## 9. Seven-Day Roadmap

Refer to [docs/ROADMAP.md](file:///Users/Saswata007/Developer/Khoj/docs/ROADMAP.md) for the detailed phase breakdown:
- **Day 1**: Project Foundation & Database Integration *(Completed)*
- **Day 2**: Campus Email Authentication & User Profile *(Planned)*
- **Day 3**: Marketplace Buy & Sell Listings CRUD *(Planned)*
- **Day 4**: Lost & Found Submissions & Verification *(Planned)*
- **Day 5**: Search, Filter & Private Contact Requests *(Planned)*
- **Day 6**: Moderation, Reports & Admin Oversight *(Planned)*
- **Day 7**: E2E Verification & Cloud Deployment *(Planned)*

---

## 10. Documentation Links

- [System Architecture](file:///Users/Saswata007/Developer/Khoj/docs/ARCHITECTURE.md)
- [Database Schema & Entity Relationships](file:///Users/Saswata007/Developer/Khoj/docs/DATABASE.md)
- [Full 7-Day Implementation Roadmap](file:///Users/Saswata007/Developer/Khoj/docs/ROADMAP.md)

---

## 11. Security & Community Guidelines

- **No Public Credentials**: Secrets and database connection strings are never exposed in logs, client bundles, or repository files.
- **Privacy First**: Contact details are shared only upon mutual consent between buyer and seller.
- **Zero Commission**: Designed by students, for students — completely fee-free.
