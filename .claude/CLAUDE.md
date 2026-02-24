# Project: Percy Main Community Sports Club Website

## Stack
- Astro v5 with React islands, Tailwind CSS v4, Contentful CMS
- Deployed on Netlify

## Generated Files — DO NOT EDIT MANUALLY

Two sets of files are auto-generated and checked into the repo. **Never hand-edit these files** — always regenerate them with the commands below.

| Files | Generator | Command |
|-------|-----------|---------|
| `src/__generated__/*.ts` | cf-content-types-generator (Contentful) | `npm run contentful:types` |
| `src/lib/db/__generated__/db.ts` | kysely-codegen (DB schema) | `npm run db:types` |

**Before opening a PR**, regenerate both and commit any changes:

```sh
npm run contentful:types
npm run db:types
```

CI runs a `check-generated` workflow that diffs these files — your PR will fail if they're stale.

### Contentful types

- Collection loaders (e.g. `src/collections/person.ts`) use the generated skeleton types (e.g. `TypeTrusteeSkeleton`) for strongly-typed `item.fields` access
- **Do not cast `item.fields` manually** — the generated types already provide correct field types, so `item.fields.newField` just works after regeneration

### DB types

- After creating a new migration, run `npm run db:types` to pick up new tables/columns
- The generator needs a local DB with migrations applied — it introspects the schema from `local.db`

## Coding Standards

- **Never type-assert API responses** — always validate with zod schemas (e.g. `schema.parse(await res.json())`) instead of `as SomeType`
- **Use react-query for data fetching in React components** — no raw `fetch` in `useEffect`/`useCallback`. Use `useQuery`/`useMutation` from `@tanstack/react-query`.

## Local Data

When running locally, Contentful data is cached in `.astro/data-store.json`. This file can be examined directly to inspect the raw data structure (e.g. richtext documents, field values) without needing to add debug logging.
