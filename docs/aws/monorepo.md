# Monorepo Structure

Application code (frontend, backend, shared libraries) and infrastructure (Terraform) live in a single repository. This enables atomic changes across the stack, unified code review, and a single context for AI-assisted development.

---

## Workspace Layout

```
percy-main/
├── apps/
│   ├── web/               # React + Vite SPA (frontend)
│   └── api/               # Node.js API service (backend)
│
├── packages/
│   ├── shared/            # Shared types, constants, validation schemas (Zod)
│   ├── db/                # Kysely schema, migrations, generated types
│   └── email/             # React Email templates
│
├── infra/                 # Terraform (see infrastructure-as-code.md)
│   ├── modules/
│   └── environments/
│
├── .github/workflows/     # CI/CD pipelines
├── package.json           # Root workspace config
└── pnpm-workspace.yaml    # Workspace package definitions
```

### What Goes Where

| Package | Contents | Deploys To |
|---------|----------|------------|
| `apps/web` | React components, routes, pages, client-side logic | S3 + CloudFront |
| `apps/api` | Express/Fastify handlers, middleware, service layer | ECS Fargate (Docker) |
| `packages/shared` | Zod schemas, TypeScript types, constants used by both apps | Not deployed (build dependency) |
| `packages/db` | Kysely config, migrations, generated types, query helpers | Not deployed (build dependency) |
| `packages/email` | React Email templates | Not deployed (imported by API) |
| `infra` | Terraform modules and environment configs | AWS (via `terraform apply`) |

---

## Shared Code Strategy

The main benefit of the monorepo is sharing code between frontend and backend without publishing packages.

**Key shared artefacts:**

- **Zod schemas** — defined once in `packages/shared`, used for API request/response validation on both sides. The API validates incoming requests; the frontend validates before sending. One source of truth.
- **TypeScript types** — API route types, domain models, enums, constants. No drift between what the frontend expects and what the API returns.
- **Database layer** — `packages/db` is imported by `apps/api` and by migration scripts, but never by the frontend. The frontend only talks to the API.
- **Email templates** — `packages/email` is imported by `apps/api` for rendering. Could also be used for preview tooling.

This replaces the current pattern where types and validation are implicitly shared through Astro's co-located frontend/backend.

---

## Tooling

**pnpm workspaces** — already our package manager, handles everything we need:

- Cross-package dependency resolution (packages can import each other)
- `pnpm --filter api build` to run scripts in specific packages
- `pnpm -r run test` to run scripts across all packages

No additional build orchestrator is needed at our scale (2 apps, 3 shared packages). If CI times grow in future, Turborepo can be added on top of pnpm workspaces with minimal effort — it's a single config file and a dev dependency, no restructuring required.

---

## CI/CD Pipeline Design

Each deployable unit has its own pipeline, triggered by path filters:

| Trigger Path | Pipeline | Action |
|-------------|----------|--------|
| `apps/web/**`, `packages/shared/**` | Frontend Deploy | `build` → `aws s3 sync` → CloudFront invalidation |
| `apps/api/**`, `packages/shared/**`, `packages/db/**`, `packages/email/**` | API Deploy | `build` → Docker build → ECR push → ECS rolling update |
| `infra/**` | Terraform | `plan` on PR → `apply` on merge |
| `packages/db/migrations/**` | DB Migration | Runs automatically on API service startup |

Changes to `packages/shared` trigger both frontend and API pipelines, since both depend on it. The build orchestrator handles this automatically — it knows the dependency graph.

### Pipeline Stages

```
PR opened/updated:
  1. Install dependencies
  2. Lint (all affected packages)
  3. Type check (all affected packages)
  4. Test (all affected packages)
  5. Build (all affected packages)
  6. Terraform plan (if infra changed)
  7. Deploy preview (frontend to preview S3 prefix, API to staging)

Merge to main:
  1. Build affected packages
  2. Deploy staging (automatic)
  3. Deploy production (manual approval gate)
  4. Terraform apply (if infra changed, manual approval for production)
```

---

## Migration Path

The monorepo structure is established incrementally, not all at once:

| Migration Phase | Monorepo Change |
|----------------|-----------------|
| **Phase 1: Foundation** | Add `infra/` and `packages/db/` (extract DB layer from current `src/lib/db/`) |
| **Phase 2: Backend** | Add `apps/api/` (extract service layer from Astro actions), add `packages/shared/` (extract shared types/schemas) |
| **Phase 3: Frontend** | Rename/restructure current frontend into `apps/web/` as React + Vite SPA |
| **Phase 4: Content** | Add content management to `apps/api/`, remove Contentful packages |

The current Astro app continues to work throughout — it just gradually shrinks as pieces are extracted into their own packages.

---

## Docker Strategy

The Dockerfile lives in `apps/api/` alongside the service code it packages. The Docker build context is the repo root (to allow COPY of shared packages):

```dockerfile
# apps/api/Dockerfile — built from repo root: docker build -f apps/api/Dockerfile .
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/email/package.json packages/email/
RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/api/ apps/api/
RUN pnpm --filter api build
```

Key considerations:
- **Build context is the repo root** — allows COPY of shared packages, even though the Dockerfile lives in `apps/api/`
- **Multi-stage build** — install dependencies and build in one stage, copy output to a slim runtime stage
- **ARM-based image** — for Graviton-based Fargate tasks (cost savings)
- **pnpm deploy** — can produce a standalone output directory with only production dependencies, keeping the image small

---

## Constraints and Trade-offs

| Trade-off | Notes |
|-----------|-------|
| **Repo size** | Terraform state files are NOT in the repo (remote S3 backend). Docker images are NOT in the repo (ECR). Repo stays lean. |
| **Permission boundaries** | Anyone with repo access can see infra config. Fine for our team size. For larger orgs, CODEOWNERS can gate infra changes. |
| **CI time** | Without caching, every PR runs everything. Build orchestrator caching makes this manageable — only affected packages are rebuilt. |
| **Terraform in same repo** | Terraform has no awareness of pnpm workspaces and vice versa. They coexist but don't interact — CI path filters keep them independent. |
