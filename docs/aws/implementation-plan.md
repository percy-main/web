# Implementation Plan

Detailed phased plan for migrating Percy Main CSC infrastructure to AWS. Phases are sequential — each builds on the previous — but can overlap where noted.

---

## Phase 1: AWS Foundation & Database

**Goal:** Establish the AWS account structure and migrate the database from SQLite to PostgreSQL.

**Tasks:**
- AWS Organization setup (production + staging accounts)
- VPC configuration with public and private subnets
- NAT Gateway for private subnet internet access
- Route 53 DNS for percymain.org
- SES domain verification (SPF/DKIM/DMARC)
- S3 buckets for frontend and asset storage
- RDS PostgreSQL provisioning (db.t4g.micro, single-AZ)
- Database migration:
  - Port Kysely ORM dialect from `LibsqlDialect` to `PostgresDialect`
  - Replace `@libsql/client` dependency with `pg`
  - Port 47 migration files (most are dialect-agnostic; ~5–10 need SQLite-specific SQL rewritten)
  - Key SQL changes: `strftime()` → `to_char()`, `SUBSTR()`/`INSTR()` → `SPLIT_PART()`/`SUBSTRING()`, integer booleans → native `boolean`
  - Update auth library config from `type: "sqlite"` to `type: "postgres"`
  - Regenerate database types via `kysely-codegen`
- Data migration from Turso to RDS (35 tables, small data volume — scripted export/transform/import)
- Docker Compose setup for local development (PostgreSQL container)

**Estimated effort:** 3–5 days for database migration. 1–2 days for AWS account and networking setup.

---

## Phase 2: Backend Service

**Goal:** Extract the backend into a standalone API service running on ECS Fargate.

**Tasks:**
- Extract service layer from 19 Astro action handler files (~9,550 lines)
- Build Node.js API service using Express or Fastify
- Containerise with Docker (ARM-based image for Graviton)
- Push to ECR (Elastic Container Registry)
- Deploy to ECS Fargate behind ALB:
  - Production: 2 tasks for availability during rolling deployments
  - Health check endpoint for ALB target group
- Migrate Stripe webhook handling to the API service
- Migrate scheduled jobs to EventBridge → ECS scheduled tasks:
  - Play Cricket data sync (currently Sun/Fri 3am)
  - Fantasy reminder emails (currently Thu 6pm)
- Configure CloudWatch log groups for the ECS service
- Set up initial CloudWatch alarms (error rates, health check failures)
- Keep existing Astro frontend calling the new API during transition

**Estimated effort:** 1–2 weeks. Can proceed incrementally — extract one domain at a time (e.g., fantasy first, then matchday, then admin).

---

## Phase 3: Data Pipeline Modernisation

**Goal:** Decouple external data ingestion from the API request path into independent, resilient ETL pipelines.

Moving data pipelines earlier — immediately after the backend service exists — is deliberate. Once the API is extracted and pipeline logic is separated from request handling, the frontend migration becomes much simpler: it's a pure presentation rewrite with no architectural untangling mixed in.

**Current state:**

The Play Cricket data sync runs as a single monolithic background function (currently limited to 15 minutes execution time) on a cron schedule. It:
1. Fetches all team definitions from the Play Cricket API
2. Fetches match summaries for the current season
3. Iterates through each unprocessed match, fetching full scorecards
4. Parses batting, bowling, and fielding performances into database rows
5. Calculates fantasy cricket scores from the raw performance data
6. All within a single execution context — if one step fails, the entire sync fails

Additional on-demand API calls happen at request time for live scores (cached 5 minutes) and league tables (cached 30 minutes), placing external API reliability directly in the user request path.

**Proposed architecture:**

```
                    ┌─────────────────────────────────────────┐
                    │           EventBridge Scheduler          │
                    └──────┬──────────────┬───────────────────┘
                           │              │
              ┌────────────▼───┐   ┌──────▼──────────────┐
              │  ECS Task:     │   │  ECS Task:          │
              │  Play Cricket  │   │  Fantasy Scoring     │
              │  Data Ingest   │   │  Pipeline            │
              └────────┬───────┘   └──────────┬──────────┘
                       │                      │
                       ▼                      ▼
              ┌────────────────────────────────────────────┐
              │              RDS PostgreSQL                 │
              │  ┌──────────┐  ┌────────────┐  ┌────────┐ │
              │  │ Raw match │  │ Performance│  │ Fantasy│ │
              │  │ cache     │  │ stats      │  │ scores │ │
              │  └──────────┘  └────────────┘  └────────┘ │
              └────────────────────────────────────────────┘
                       ▲
                       │
              ┌────────┴───────┐
              │  API Service   │ ← serves pre-computed data to frontend
              │  (ECS Fargate) │   (no external API calls in request path)
              └────────────────┘
```

**Tasks:**

- Separate the monolithic sync into independent pipeline stages:
  - **Play Cricket Ingest** — fetches raw match data, stores in staging tables, handles API rate limits and partial failures independently
  - **Fantasy Scoring Pipeline** — triggered after ingest completes, reads raw performance data, applies scoring rules, writes aggregated scores
  - **Cache Refresh** — pre-computes league tables and leaderboards into database tables, eliminating request-time API calls
- Implement EventBridge scheduling:
  - Play Cricket ingest: runs every 6 hours with retry on failure
  - Fantasy scoring: triggered by successful ingest completion (EventBridge event pattern)
  - Cache refresh: runs after scoring, or independently on a shorter schedule for live data
- Make each stage idempotent and resumable — checkpoint progress so partial failures recover on next run
- Set up CloudWatch metrics per pipeline stage: matches processed, records written, duration, errors
- Configure CloudWatch Alarms for pipeline failures and data staleness (e.g., no new match data in 7 days during season)

**AWS Glue consideration:** Glue is designed for large-scale ETL across diverse data sources (S3 data lakes, JDBC sources, streaming). For our use case — a single REST API producing modest data volumes (~50 matches/season, ~200 players) — ECS tasks with custom Node.js scripts are a better fit: same language as the rest of the codebase, simpler to develop and debug, and more cost-effective at our scale. If data sources grow in future (e.g., integrating additional cricket leagues or adding new sports), Glue or Step Functions become more attractive.

**Estimated effort:** 3–5 days.

---

## Phase 4: Frontend Migration

**Goal:** Migrate from Astro to a React + Vite SPA deployed to S3 + CloudFront.

By this point, the backend API and data pipelines are already running independently. The frontend migration is now a pure presentation rewrite — no architectural untangling required.

**Tasks:**
- Scaffold React + Vite project
- Implement React Router for client-side routing
- Set up root-level providers (auth context, React Query)
- Migrate React island components (~60% by complexity) — these move as-is into React Router routes
- Migrate Astro-native components (~40%) — these require conversion:
  - **Astro layouts/slots** (headers, footers, navigation, page shells) → React layout components
  - **Astro content collections** (`getCollection()` in frontmatter) → React Query hooks calling API endpoints
  - **Server-side data loading** (DB queries or API calls in frontmatter) → API endpoints + React Query
  - **File-based routing** (dynamic segments like `[slug].astro`, `[...path].astro`) → React Router route definitions
  - **Astro middleware** (auth checks, redirects) → client-side route guards or API middleware
- Replace Astro actions with API calls to the backend service
- Deploy to S3 with CloudFront distribution:
  - Configure CloudFront custom error response for SPA routing (all paths → index.html)
  - CloudFront Function for Open Graph meta tags on public routes (link previews for social sharing)
  - HTTPS via ACM certificate
- CI/CD pipeline: GitHub Actions → `vite build` → S3 sync → CloudFront cache invalidation
- Configure deploy preview infrastructure (per-PR S3 prefixes or separate CloudFront behaviours)

**Estimated effort:** 1–2 weeks.

---

## Phase 5: Content Migration

**Goal:** Remove Contentful and inline editorial content directly as React components.

Content is edited by a single developer. The current workflow already requires a deploy to publish (Astro fetches Contentful at build time), so inlining content as components is zero regression — same "edit → commit → deploy" pipeline, without the external dependency.

**Tasks:**
- Inline existing Contentful content as React components:
  - Pages, news articles, events, people/trustees, locations
  - Image assets → S3 (referenced directly from components)
  - Preserve URL slugs/routes for continuity
- Remove Contentful dependencies (6 npm packages, 4 API tokens, type generation pipeline)
- Remove Contentful collection loaders and generated skeleton types

**Estimated effort:** 2–3 days.

---

## Phase 6: Cutover & Environments

**Goal:** Provision staging, complete DNS cutover, decommission old services.

**Tasks:**
- Staging environment provisioning (mirrors production):
  - VPC + NAT Gateway
  - ECS Fargate (1 task)
  - ALB
  - RDS PostgreSQL (seeded from production snapshot)
  - S3 + CloudFront
  - CloudWatch
- Deploy preview infrastructure:
  - Per-PR PostgreSQL schemas within the staging RDS instance (zero incremental cost)
  - Per-PR S3 prefixes for frontend builds
  - GitHub Actions workflow for preview lifecycle (create on PR open, destroy on close)
  - **Preview schema hygiene** — this strategy is viable but requires operational discipline:
    - Deterministic schema naming (e.g. `preview_pr_123`) to avoid collisions
    - Automatic cleanup on PR close (GitHub Actions workflow drops schema)
    - Scheduled cleanup job for abandoned schemas (PRs closed without triggering cleanup)
    - CI-scoped database credentials with permissions limited to the PR's schema
    - Migration isolation — each preview schema runs its own migrations independently
- WAF configuration on production CloudFront and ALB
- DNS cutover:
  - Lower TTL on current DNS records in advance
  - Switch percymain.org to point at CloudFront
  - Run both old and new infrastructure in parallel during propagation
- Update Stripe webhook URLs to point at the ECS API service
- End-to-end verification across all environments
- Decommission:
  - Netlify (hosting, functions, blobs, edge functions)
  - Turso (database)
  - Mailgun (email)
  - Contentful (CMS)

**Estimated effort:** 1 week.

---

## Rollback Strategy

The existing Netlify/Turso stack remains the production platform until the final DNS cutover in Phase 6. All earlier phases build and test against AWS infrastructure but do not serve production traffic from it. This means everything before Phase 6 is reversible by simply staying on the current stack.

**Key rollback boundaries:**

| Phase | Rollback | Detail |
|-------|----------|--------|
| **Phases 1–5** | Stay on Netlify/Turso | No production traffic hits AWS until DNS cutover. All work is additive. |
| **Phase 6 (cutover)** | Re-runnable data lift | A Turso→PostgreSQL data lift tool is built in Phase 1 for testing. It is idempotent and re-runnable, so it can be executed again immediately before go-live to capture all interim data. If issues are discovered post-cutover, DNS can be pointed back to Netlify and the existing stack resumes serving traffic. |

**Data lift tool:** Built early in Phase 1 as a scripted export/transform/import from Turso to RDS. Used repeatedly throughout the migration for testing with realistic data. Run one final time during the cutover window to ensure data consistency.

---

## Challenges & Mitigations

| Challenge | Detail | Mitigation |
|-----------|--------|------------|
| **Database migration** | 47 migration files, ~5–10 with SQLite-specific SQL | Most use dialect-agnostic Kysely schema builder; manual changes localised to a few query files |
| **Deploy preview databases** | RDS does not have branch database equivalents | Per-PR PostgreSQL schemas within a shared staging RDS instance — zero incremental cost |
| **Frontend SPA routing** | Client-side routing requires all paths to serve index.html | Standard CloudFront custom error response configuration |
| **Build plugin rewrite** | Custom Netlify migration plugin tied to Netlify APIs | Rewrite as platform-agnostic pre-build script |
| **DNS cutover** | Propagation period during switch | Lower TTL in advance; run both platforms in parallel during transition |
| **Local development** | Currently uses SQLite file; will need local PostgreSQL | Docker Compose with PostgreSQL container |
| **Data migration** | 35 tables of production data to transfer | Small data volumes; scripted export/transform/import with testing |
