# Project: Percy Main Community Sports Club Website

## Stack
- Astro v5 with React islands, Tailwind CSS v4, Contentful CMS
- Deployed on Netlify

## Contentful Types

Generated TypeScript types live in `src/__generated__/`. When the Contentful data model changes:

1. Run `npm run contentful:types` to regenerate types
2. Collection loaders (e.g. `src/collections/person.ts`) use these generated skeleton types (e.g. `TypeTrusteeSkeleton`) for strongly-typed `item.fields` access
3. **Do not cast `item.fields` manually** - the generated types already provide correct field types, so `item.fields.newField` just works after regeneration

## Local Data

When running locally, Contentful data is cached in `.astro/data-store.json`. This file can be examined directly to inspect the raw data structure (e.g. richtext documents, field values) without needing to add debug logging.
