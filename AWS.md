# AWS Migration Plan — Percy Main Community Sports Club

## About Us

Percy Main CSC is a registered non-profit community sports club based in North Tyneside, England. We run a website and web application serving ~200 members, handling membership subscriptions, payment processing, fantasy cricket, match statistics, and club administration.

We currently run on a mix of third-party services (Netlify, Turso, Mailgun, Contentful) funded personally by a trustee. We are looking to consolidate onto AWS for professional infrastructure, proper environments, and long-term sustainability — and are applying for AWS non-profit credits to support this migration.

---

## Current Architecture

| Component | Current Provider | Notes |
|-----------|-----------------|-------|
| **Hosting & CDN** | Netlify | Static site generation + serverless functions, deploy previews per PR |
| **Database** | Turso (libsql/SQLite) | Kysely ORM, per-PR branch databases for previews |
| **Email** | Mailgun | Transactional email (verification, receipts, reminders) |
| **Blob Storage** | Netlify Blobs | File storage for user uploads |
| **Scheduled Jobs** | Netlify Scheduled Functions | External data sync, automated reminders |
| **Edge Functions** | Netlify Edge | Stripe webhook proxy for deploy previews |
| **CMS** | Contentful | Content delivery, preview, and management APIs |
| **Payments** | Stripe | Subscriptions, one-off payments, webhook handling |
| **Auth** | Better Auth (open-source library) | Email/password, Google OAuth, passkeys, 2FA |
| **External Data** | Play Cricket API | Match results, player statistics, league tables |
| **Notifications** | Slack Webhooks | Trustee notifications for payments and enquiries |
| **Maps** | Google Maps API | Venue locations, address lookup |

---

## Proposed AWS Architecture

```
                         ┌─────────────────────────────────────────┐
                         │              CloudFront                  │
                         │         (CDN + SPA routing)              │
                         └──────┬──────────────┬───────────────────┘
                                │              │
                    ┌───────────▼──┐    ┌──────▼──────────┐
                    │  S3 Bucket   │    │  ALB            │
                    │  (React SPA) │    │  (API routing)  │
                    └──────────────┘    └──────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  ECS Fargate        │
                                    │  (API Service)      │
                                    │  2 tasks, ARM-based │
                                    └──────────┬──────────┘
                                               │
                              ┌────────────────┼────────────────┐
                              │                │                │
                    ┌─────────▼───┐  ┌─────────▼───┐  ┌────────▼────┐
                    │  RDS        │  │  S3          │  │  SES        │
                    │  PostgreSQL │  │  (Assets)    │  │  (Email)    │
                    └─────────────┘  └─────────────┘  └─────────────┘

        EventBridge ──────▶ ECS (scheduled tasks: data sync, reminders)
        Stripe ────────────▶ ECS (webhook endpoint)
```

### AWS Services Used

| Component | AWS Service | Replaces |
|-----------|------------|----------|
| **Frontend hosting** | S3 + CloudFront | Netlify |
| **API service** | ECS Fargate + ALB | Netlify serverless functions |
| **Database** | RDS PostgreSQL (db.t4g.micro) | Turso (libsql/SQLite) |
| **Email** | Amazon SES | Mailgun |
| **File storage** | S3 | Netlify Blobs |
| **Scheduled jobs** | EventBridge + ECS | Netlify Scheduled Functions |
| **Secrets** | SSM Parameter Store + Secrets Manager | Environment variables |
| **DNS** | Route 53 | Third-party DNS |
| **Monitoring** | CloudWatch (logs, metrics, alarms) | None (new capability) |
| **Security** | WAF + VPC + Security Groups | None (new capability) |
| **Networking** | VPC + NAT Gateway | Managed by Netlify |
| **Container registry** | ECR | N/A |

### External Services (unchanged)

| Service | Role |
|---------|------|
| **Stripe** | Payment processing (webhook URLs updated to point at ECS) |
| **Play Cricket API** | Cricket match data, player statistics, league tables |
| **Google Maps** | Client-side location services |
| **Slack** | Outbound trustee notifications |

---

## Database Migration: SQLite → PostgreSQL

The largest single piece of work. Our current database is Turso (a managed libsql/SQLite service). We'll migrate to RDS PostgreSQL for tighter AWS integration, proper relational features, and a single platform.

### What Changes

1. **ORM dialect swap** — Kysely `LibsqlDialect` → `PostgresDialect` (~5 lines in connection config)
2. **Dependencies** — replace `@libsql/client` with `pg`
3. **47 migration files** — most use the Kysely schema builder (dialect-agnostic). ~5–10 use raw SQL with SQLite-specific functions:
   - `strftime('%Y-%m', ...)` → `to_char(..., 'YYYY-MM')`
   - `SUBSTR()` + `INSTR()` → `SPLIT_PART()` / `SUBSTRING()`
   - Integer booleans → native `boolean` type
   - `CURRENT_TIMESTAMP` — compatible with both, no change needed
4. **Auth library config** — `type: "sqlite"` → `type: "postgres"`
5. **Type generation** — point `kysely-codegen` at PostgreSQL connection string, regenerate
6. **Deploy preview databases** — replace Turso branch DB strategy with per-PR PostgreSQL schemas (create schema, run migrations, seed test data; drop on PR close)
7. **Data migration** — export from Turso, transform, import to RDS (35 tables, small data volume)

### Estimated Effort

3–5 days.

---

## Architectural Evolution

This migration is also an opportunity to modernise our application architecture. The site has grown from a content-focused website into a full application with membership management, payment processing, a fantasy cricket game, and match administration. The current architecture reflects this evolution — and benefits from being rethought.

### Frontend: Astro → React + Vite SPA

**Current state:** The site uses Astro (a static site generator) with React "islands" for interactive features. By the numbers:
- 127 components: 104 React, 23 Astro
- ~60% of features by complexity are full React applications (Fantasy league, Admin dashboard, Membership signup, Junior registration, Auth flows) wrapped in thin Astro shells
- Every page loads a React island just for the authenticated navigation header

**Proposed:** Migrate to a **React + Vite single-page application**, deployed as static files to S3 and served via CloudFront. The backend API service on ECS handles all server-side concerns.

**Benefits:**
- Single framework — eliminates the Astro/React split and associated complexity
- Shared application state — auth context, data caching, and React Query providers work across the entire app
- Standard tooling — React Router for client-side routing, Vite for builds
- Simple deployment — static assets on S3, no server-side rendering infrastructure needed

**SEO consideration:** The genuinely static content (news articles, leaderboards, player profiles) will no longer be pre-rendered HTML. For a community sports club where the majority of traffic is authenticated members using application features, this is an acceptable trade-off. If SEO for specific public pages becomes important, the API service can serve pre-rendered HTML for those routes.

### Backend: Astro Actions → Node.js API Service on ECS

**Current state:** 19 action handler files containing ~9,550 lines of backend logic, including database queries, business rules, email sending, and Stripe interactions — all running inside Astro's serverless action system with no service layer separation.

**Proposed:** Extract into a standalone **Node.js API service** (Express or Fastify) running on ECS Fargate:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Frontend       │────▶│   API Service    │────▶│  RDS        │
│   (React/Vite    │     │   (Node.js on    │     │  PostgreSQL │
│    on S3 + CF)   │     │    ECS Fargate)  │     │             │
└─────────────────┘     └──────────────────┘     └─────────────┘
                              │
                         ┌────┴────┐
                         │ Shared  │
                         │ by:     │
                         │ - Web   │
                         │ - Cron  │
                         │ - Hooks │
                         └─────────┘
```

**Benefits:**
- **Service layer reuse** — scheduled jobs, webhooks, and the frontend all use the same business logic
- **Independent scaling** — API scales separately from frontend delivery
- **Connection pooling** — persistent service enables proper PostgreSQL connection pooling
- **Framework-agnostic** — frontend can change without affecting the backend
- **Testable** — plain request/response handlers with no framework coupling

### CMS: Contentful → PostgreSQL + Admin Panel

**Current state:** Contentful manages ~6 content types (news articles, pages, events, people, locations, game annotations) via 4 API tokens, 6 npm packages, and a type generation pipeline. All dynamic data (match stats, members, payments, fantasy) already lives in our database.

**Proposed:** Move editorial content into PostgreSQL and manage it through the existing admin panel:
- Rich text stored as Markdown
- Images stored in S3
- Admin UI extended with content editing screens

**Benefits:**
- Single data source — all content and application data in PostgreSQL
- Simplified stack — removes 4 API tokens, 6 packages, and the type generation pipeline
- Content always fresh — no build-time fetching or cache invalidation
- Faster builds — no external API calls during CI/CD

### Account Structure & Environments

```
Percy Main AWS Organization
├── Production Account
│   ├── VPC + NAT Gateway
│   ├── ECS Fargate (API service, 2 tasks)
│   ├── ALB (API routing + health checks)
│   ├── RDS PostgreSQL (production data)
│   ├── S3 (frontend assets + user uploads)
│   ├── CloudFront (CDN)
│   ├── SES (transactional email)
│   ├── Route 53 (DNS)
│   ├── CloudWatch (monitoring + alerting)
│   └── WAF (application firewall)
│
├── Staging Account
│   ├── VPC + NAT Gateway
│   ├── ECS Fargate (API service, 1 task)
│   ├── ALB
│   ├── RDS PostgreSQL (staging data, seeded from production snapshot)
│   ├── S3 + CloudFront (frontend)
│   └── CloudWatch
│
└── Preview (shared with Staging)
    ├── Per-PR PostgreSQL schemas (within staging RDS instance)
    └── Per-PR S3 prefixes for frontend builds
```

**Why separate accounts:**
- Blast radius isolation between environments
- Independent IAM policies per environment
- Per-environment cost visibility via AWS Organizations
- Currently we have no staging environment — deploy previews are our only pre-production testing

---

## Migration Phases

### Phase 1: AWS Foundation & Database
- AWS Organization setup (production + staging accounts)
- VPC configuration with public and private subnets
- Route 53 DNS for percymain.org
- SES domain verification (SPF/DKIM/DMARC)
- S3 buckets for frontend and asset storage
- RDS PostgreSQL provisioning
- Database migration: port Kysely dialect, migrations, and queries from SQLite to PostgreSQL
- Data migration from Turso to RDS
- Docker Compose for local development (PostgreSQL container)

### Phase 2: Backend Service
- Extract service layer from Astro action handlers
- Build Node.js API service (Express/Fastify)
- Deploy to ECS Fargate behind ALB (2 tasks for availability)
- Migrate webhook handling (Stripe) to the API service
- Migrate scheduled jobs to EventBridge → ECS scheduled tasks
- Keep existing Astro frontend calling the new API during transition

### Phase 3: Frontend Migration
- Migrate from Astro to React + Vite SPA
- Implement React Router for client-side routing
- Root-level providers (auth, React Query)
- Replace Astro collections and actions with API calls
- Deploy to S3 + CloudFront
- CI/CD: GitHub Actions → Vite build → S3 sync → CloudFront invalidation

### Phase 4: Content Migration
- Create PostgreSQL tables for editorial content (pages, news, events, people)
- Extend admin panel with content editing UI
- Migrate content from Contentful to PostgreSQL
- Migrate image assets from Contentful to S3
- Remove Contentful dependencies

### Phase 5: Cutover & Environments
- Staging environment provisioning (mirrors production)
- Deploy preview infrastructure (per-PR schemas + S3 prefixes)
- DNS cutover (lower TTL in advance, switch to CloudFront)
- Update Stripe webhook URLs
- End-to-end verification
- Decommission Netlify, Turso, Mailgun, Contentful

### Phase 6: Data Pipeline Modernisation

Our application relies heavily on external data — particularly from the Play Cricket API for match results, player statistics, and league tables. This data feeds directly into our fantasy cricket scoring engine, leaderboards, and player profiles.

**Current state:**

The Play Cricket sync runs as a single monolithic background function (currently limited to 15 minutes execution time) on a cron schedule (Sunday and Friday at 3am). It:
1. Fetches all team definitions from the Play Cricket API
2. Fetches match summaries for the current season
3. Iterates through each unprocessed match, fetching full scorecards
4. Parses batting, bowling, and fielding performances into database rows
5. Calculates fantasy cricket scores from the raw performance data
6. All within a single execution context — if one step fails, the entire sync fails

Additional on-demand API calls happen at request time for live scores (cached 5 minutes) and league tables (cached 30 minutes), placing external API reliability directly in the user request path.

**Proposed: Separation into core service and ETL pipelines**

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

**Key changes:**

1. **Decouple ingestion from serving.** The API service reads from the database only — it never calls the Play Cricket API during a user request. External data is ingested by background ECS tasks on a schedule.

2. **Separate pipelines per concern:**
   - **Play Cricket Ingest** — fetches raw match data, stores in staging tables, handles API rate limits and partial failures independently
   - **Fantasy Scoring Pipeline** — triggered after ingest completes, reads raw performance data, applies scoring rules, writes aggregated scores
   - **Cache Refresh** — pre-computes league tables and leaderboards into database tables, eliminating request-time API calls entirely

3. **Resilient scheduling with EventBridge:**
   - Play Cricket ingest: runs every 6 hours (more frequent than current Sun/Fri schedule), with EventBridge handling retries on failure
   - Fantasy scoring: triggered by successful ingest completion (EventBridge event pattern)
   - Cache refresh: runs after scoring, or independently on a shorter schedule for live data

4. **Idempotent and resumable.** Each pipeline stage writes checkpoints. If a sync fails partway through (e.g., Play Cricket API timeout after processing 30 of 50 matches), the next run picks up where it left off rather than re-processing everything.

5. **Observability.** Each pipeline run logs to CloudWatch with structured metrics: matches processed, records written, duration, errors. CloudWatch Alarms alert on pipeline failures or data staleness (e.g., no new match data in 7 days during season).

**AWS Glue consideration:** AWS Glue is designed for large-scale ETL across diverse data sources (S3 data lakes, JDBC sources, streaming). For our use case — a single REST API producing modest data volumes (~50 matches/season, ~200 players) — Glue would be over-provisioned. ECS tasks with custom Node.js scripts are a better fit: same language as the rest of the codebase, simpler to develop and debug, and significantly cheaper at our scale. Glue's minimum billing of 1 DPU ($0.44/hr, 10-minute minimum) would cost more per run than a Fargate task processing the same data.

**If data sources grow** (e.g., integrating additional cricket leagues, ingesting historical archives, or adding new sports), Glue or Step Functions become more attractive for orchestrating multi-source pipelines with built-in schema discovery and transformation libraries.

---

## Challenges

| Challenge | Detail | Mitigation |
|-----------|--------|------------|
| **Database migration** | 47 migration files, ~5–10 with SQLite-specific SQL | Most use dialect-agnostic Kysely schema builder; manual changes are localised to a few query files |
| **Deploy preview databases** | RDS does not have branch database equivalents | Per-PR PostgreSQL schemas within a shared staging RDS instance — zero incremental cost |
| **Frontend SPA routing** | Client-side routing requires all paths to serve index.html | Standard CloudFront custom error response configuration |
| **Build plugin rewrite** | Custom Netlify migration plugin tied to Netlify APIs | Rewrite as platform-agnostic pre-build script — simpler and more portable |
| **DNS cutover** | Brief propagation period during switch | Lower TTL in advance; run both platforms in parallel during transition |
| **Local development** | Currently uses SQLite file; will need local PostgreSQL | Docker Compose with PostgreSQL container — standard pattern |
| **Data migration** | 35 tables of production data to transfer | Small data volumes; scripted export/transform/import with thorough testing |

---

## Benefits

| Benefit | Detail |
|---------|--------|
| **Sustainable funding** | AWS non-profit credits would replace personal trustee funding, securing infrastructure long-term |
| **Professional monitoring** | CloudWatch metrics, alarms, and dashboards — currently no monitoring capability |
| **Application security** | WAF, VPC, Security Groups, IAM, encryption at rest — enterprise-grade protections |
| **Automated backups** | RDS automated daily snapshots with 35-day point-in-time recovery |
| **PostgreSQL** | Full-text search, JSON operators, proper boolean types, window functions, CTEs, mature ecosystem |
| **Environment parity** | Production, staging, and preview environments — currently no staging |
| **Scalability** | Scale ECS tasks, upgrade RDS instance, or add read replicas as membership grows |
| **Consolidated billing** | Single AWS account replaces Netlify, Turso, Mailgun, and Contentful subscriptions |
| **Data pipeline resilience** | Decoupled ingestion and serving — external API issues don't affect user experience |
| **Operational maturity** | Structured logging, alerting, and environment isolation |

---

## Detailed Cost Analysis

All prices: eu-west-2 (London) region, USD. Based on ~200 members, typical traffic of a few hundred requests/day with spikes during fantasy cricket gameweeks.

### Compute — ECS Fargate

The API service runs on ARM/Graviton-based Fargate tasks. Production runs 2 tasks for availability during rolling deployments and to handle concurrent requests. Staging runs 1 task.

| Item | Spec | Unit Price | Monthly |
|------|------|-----------|---------|
| vCPU (prod, 2 tasks) | 0.25 vCPU × 2 | $0.03725/vCPU-hr | $13.60 |
| Memory (prod, 2 tasks) | 0.5 GB × 2 | $0.00409/GB-hr | $2.99 |
| vCPU (staging, 1 task) | 0.25 vCPU | $0.03725/vCPU-hr | $6.80 |
| Memory (staging, 1 task) | 0.5 GB | $0.00409/GB-hr | $1.49 |
| **Subtotal** | | | **$24.88** |

Note: Scheduled ECS tasks (data pipelines) run on-demand and cost fractions of a cent per execution at this scale.

### Networking

ECS tasks in private subnets require a NAT Gateway to reach external services (Stripe, Play Cricket, SES, Slack). Each environment needs its own NAT Gateway within its VPC.

**NAT Gateway**

| Item | Unit Price | Monthly |
|------|-----------|---------|
| NAT Gateway (prod) | $0.048/hr | $35.04 |
| NAT Gateway (staging) | $0.048/hr | $35.04 |
| Data processing (prod, ~10 GB/mo) | $0.048/GB | $0.48 |
| Data processing (staging, ~5 GB/mo) | $0.048/GB | $0.24 |
| **Subtotal** | | **$70.80** |

**Application Load Balancer**

Required for routing traffic to ECS tasks and performing health checks.

| Item | Unit Price | Monthly |
|------|-----------|---------|
| ALB (prod) | $0.02646/hr | $19.32 |
| ALB (staging) | $0.02646/hr | $19.32 |
| LCU usage (low traffic) | ~$0.01/hr | ~$1.00 |
| **Subtotal** | | **$39.64** |

**VPC Endpoints**

S3 Gateway endpoints are free and avoid routing S3 traffic through the NAT Gateway.

| Item | Unit Price | Monthly |
|------|-----------|---------|
| S3 Gateway endpoint (prod) | Free | $0 |
| S3 Gateway endpoint (staging) | Free | $0 |
| **Subtotal** | | **$0** |

**Cross-AZ data transfer**

| Item | Rate | Monthly |
|------|------|---------|
| ECS ↔ RDS (if cross-AZ) | $0.01/GB each way | ~$1.00 |

### Database — RDS PostgreSQL

Single-AZ instances are appropriate for our availability requirements. Automated backups provide data durability.

| Item | Spec | Unit Price | Monthly |
|------|------|-----------|---------|
| Instance (prod) | db.t4g.micro, single-AZ | $0.018/hr | $13.14 |
| Instance (staging) | db.t4g.micro, single-AZ | $0.018/hr | $13.14 |
| Storage (prod) | 20 GB gp3 | $0.133/GB | $2.66 |
| Storage (staging) | 20 GB gp3 | $0.133/GB | $2.66 |
| Backup storage | Within free allocation | $0 | $0 |
| **Subtotal** | | | **$31.60** |

### Secrets & Configuration

| Item | Approach | Monthly |
|------|----------|---------|
| SSM Parameter Store (Standard) | ~20 params × 2 envs | **$0** (free for up to 10,000 standard parameters) |
| Secrets Manager | 2–4 secrets requiring rotation (e.g., RDS credentials) | **$0.80–1.60** ($0.40/secret/month) |
| **Subtotal** | | **~$1.00** |

### Logging & Monitoring — CloudWatch

| Item | Estimate | Unit Price | Monthly |
|------|----------|-----------|---------|
| Log ingestion (prod, ~2 GB/mo) | 2 GB | $0.5985/GB | $1.20 |
| Log ingestion (staging, ~1 GB/mo) | 1 GB | $0.5985/GB | $0.60 |
| Log storage (6 months retention, ~15 GB cumulative) | 15 GB | $0.0315/GB | $0.47 |
| Custom metrics | First 10 free | $0 | $0 |
| Alarms (health checks, error rates) | First 10 free | $0 | $0 |
| Dashboards | First 3 free | $0 | $0 |
| Additional metrics/alarms/dashboards | ~20 metrics, ~15 alarms, 2 extra dashboards | Various | ~$10.00 |
| **Subtotal** | | | **~$12.27** |

### Frontend Hosting — S3 + CloudFront

| Item | Estimate | Unit Price | Monthly |
|------|----------|-----------|---------|
| S3 storage (frontend + assets, ~5 GB) | 5 GB | $0.024/GB | $0.12 |
| CloudFront transfer | ~20 GB/mo (within 1 TB free tier) | Free | $0 |
| CloudFront HTTPS requests | ~500k/mo (within 10M free tier) | Free | $0 |
| S3 origin fetch requests | ~50k/mo | $0.00042/1k GET | $0.02 |
| **Subtotal** | | | **~$0.14** |

### Email — SES

| Item | Estimate | Unit Price | Monthly |
|------|----------|-----------|---------|
| Outbound emails | ~500/mo | $0.10/1,000 | $0.05 |
| **Subtotal** | | | **~$0.05** |

### DNS — Route 53

| Item | Count | Unit Price | Monthly |
|------|-------|-----------|---------|
| Hosted zone | 1 | $0.50/zone | $0.50 |
| Queries | ~100k/mo | $0.40/million | $0.04 |
| **Subtotal** | | | **~$0.54** |

### Container Registry — ECR

| Item | Estimate | Unit Price | Monthly |
|------|----------|-----------|---------|
| Image storage (5 images retained) | ~1 GB | $0.10/GB | $0.10 |
| **Subtotal** | | | **~$0.10** |

### WAF

| Item | Count | Unit Price | Monthly |
|------|-------|-----------|---------|
| Web ACL | 1 | $5.00/mo | $5.00 |
| Rules | 5 | $1.00/rule | $5.00 |
| Requests | ~500k/mo | $0.60/million | $0.30 |
| **Subtotal** | | | **~$10.30** |

### Elastic IPs

| Item | Notes | Monthly |
|------|-------|---------|
| EIP for NAT Gateway (prod) | Included in NAT Gateway cost | $0 |
| EIP for NAT Gateway (staging) | Included in NAT Gateway cost | $0 |
| **Subtotal** | | **$0** |

### EventBridge + Lambda (Scheduling)

| Item | Notes | Monthly |
|------|-------|---------|
| EventBridge rules | ~5 rules | Free |
| Lambda invocations (trigger ECS tasks) | ~500/mo | Free (1M/mo free tier) |
| **Subtotal** | | **$0** |

---

### Cost Summary — Production + Staging

| Category | Monthly Cost |
|----------|-------------|
| NAT Gateway (2 envs) | $70.80 |
| ALB (2 envs) | $39.64 |
| RDS PostgreSQL (2 envs) | $31.60 |
| ECS Fargate (2 envs, 3 tasks total) | $24.88 |
| CloudWatch (logs, metrics, alarms) | $12.27 |
| WAF | $10.30 |
| Secrets Manager | $1.00 |
| Cross-AZ transfer | $1.00 |
| Route 53 | $0.54 |
| S3 + CloudFront | $0.14 |
| ECR | $0.10 |
| SES | $0.05 |
| EventBridge + Lambda | $0 |
| SSM Parameter Store | $0 |
| **Total** | **~$192/month** |

### Cost Summary — Production Only

| Category | Monthly Cost |
|----------|-------------|
| NAT Gateway | $35.28 |
| ALB | $19.82 |
| RDS PostgreSQL | $15.80 |
| ECS Fargate (2 tasks) | $16.59 |
| CloudWatch | $7.00 |
| WAF | $10.30 |
| Everything else | $2.83 |
| **Total** | **~$108/month** |

### Annual Cost Projection

| Scenario | Monthly | Annual |
|----------|---------|--------|
| Production + Staging (full plan) | ~$192 | ~$2,304 |
| Production only (initial phase) | ~$108 | ~$1,296 |

Costs are conservative estimates based on current usage patterns. Actual costs may be lower in early phases before all services are provisioned, and may increase modestly as monitoring and pipeline maturity grows.

### Cost Drivers

| Rank | Service | Monthly (2 envs) | % of Total | Notes |
|------|---------|-----------------|------------|-------|
| 1 | **NAT Gateway** | $70.80 | 37% | Required for private subnet internet access. One per VPC. |
| 2 | **ALB** | $39.64 | 21% | Required for ECS service routing and health checks. One per environment. |
| 3 | **RDS** | $31.60 | 16% | Always-on instances. Could share a single instance (separate databases) to reduce. |
| 4 | **ECS Fargate** | $24.88 | 13% | Actual application compute. |
| 5 | **CloudWatch** | $12.27 | 6% | Grows with monitoring maturity. |
| 6 | **WAF** | $10.30 | 5% | Optional but recommended. |
| 7 | **Everything else** | $2.83 | 1% | S3, CloudFront, SES, Route 53, ECR, SSM, EventBridge |

### Cost Optimisation Options

| Option | Potential Savings | Trade-off |
|--------|------------------|-----------|
| **Single RDS instance** for prod + staging (separate databases) | ~$16/mo | Shared resource; staging load could affect production |
| **Fargate Spot** for staging tasks | ~$8/mo | Tasks can be interrupted (acceptable for non-production) |
| **Reserved Instances** for RDS (1-year no-upfront) | ~30% on RDS (~$10/mo) | Upfront commitment |
| **Compute Savings Plans** (1-year) | ~20% on Fargate (~$5/mo) | Upfront commitment |
| **Share NAT Gateway** across prod + staging via VPC peering | ~$35/mo | Cross-account networking complexity |

---

## Phased Cost Build-Up

Not all costs are incurred from day one. Infrastructure is provisioned incrementally across migration phases:

| Phase | New AWS Services Added | Incremental Monthly Cost | Cumulative Monthly Cost |
|-------|----------------------|-------------------------|------------------------|
| **Phase 1: Foundation & Database** | RDS (prod), Route 53, SES, S3, VPC + NAT (prod) | ~$50 | ~$50 |
| **Phase 2: Backend Service** | ECS Fargate (prod, 2 tasks), ALB (prod), ECR, CloudWatch, WAF | ~$58 | ~$108 |
| **Phase 3: Frontend Migration** | CloudFront (frontend) — mostly free tier | ~$1 | ~$109 |
| **Phase 4: Content Migration** | No new services (uses existing RDS + S3) | $0 | ~$109 |
| **Phase 5: Staging Environment** | RDS (staging), ECS (staging, 1 task), ALB (staging), NAT (staging), CloudWatch (staging) | ~$83 | ~$192 |
| **Phase 6: Data Pipelines** | ECS scheduled tasks (on-demand, minimal cost) | ~$1 | ~$193 |

The initial migration (Phases 1–2) can run on approximately **$108/month**. Full production + staging with all services reaches approximately **$193/month**.

---

## Credits Request

Based on the infrastructure plan above, we are requesting AWS non-profit credits to cover:

| Item | Annual Cost |
|------|-----------|
| **Year 1: Migration + full infrastructure** | ~$2,300 |
| **Contingency for migration experimentation** (testing configurations, parallel running during cutover, trial services) | ~$700 |
| **Year 1 total request** | **~$3,000** |

Year 1 includes one-off migration costs (running old and new infrastructure in parallel during cutover, experimentation with instance sizes and configurations). Subsequent years would be approximately **$2,300/year** for steady-state operations.

A credit allocation of **$5,000/year** would comfortably cover our planned infrastructure with room for growth as membership increases and we explore additional AWS services (e.g., larger RDS instances, additional environments, or expanded monitoring).
