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

## Phase 3: Frontend Migration

**Goal:** Migrate from Astro to a React + Vite SPA deployed to S3 + CloudFront.

**Tasks:**
- Scaffold React + Vite project
- Implement React Router for client-side routing
- Set up root-level providers (auth context, React Query)
- Migrate page components from Astro wrappers to React Router routes
  - Most React components move as-is — the Astro layer is primarily routing
- Replace Astro collections and actions with API calls to the backend service
- Deploy to S3 with CloudFront distribution:
  - Configure CloudFront custom error response for SPA routing (all paths → index.html)
  - HTTPS via ACM certificate
- CI/CD pipeline: GitHub Actions → `vite build` → S3 sync → CloudFront cache invalidation
- Configure deploy preview infrastructure (per-PR S3 prefixes or separate CloudFront behaviours)

**Estimated effort:** 1–2 weeks.

---

## Phase 4: Content Migration

**Goal:** Move editorial content from Contentful to PostgreSQL and the admin panel.

**Tasks:**
- Create PostgreSQL tables for editorial content:
  - Pages (slug, title, body as Markdown, published status)
  - News articles (title, body, author, published date)
  - Events (title, description, date range, location)
  - People/trustees (name, role, bio, photo URL)
  - Locations (name, address, coordinates)
- Extend the existing admin panel with content editing screens
- Migrate content from Contentful:
  - Rich text → Markdown conversion
  - Image assets → S3 (with CloudFront URLs)
  - Preserve URL slugs for continuity
- Update frontend to fetch content from the API instead of Contentful
- Remove Contentful dependencies (6 npm packages, 4 API tokens, type generation pipeline)

**Estimated effort:** 1 week.

---

## Phase 5: Cutover & Environments

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

## Phase 6: Data Pipeline Modernisation

**Goal:** Decouple external data ingestion from the API request path into independent, resilient ETL pipelines.

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
