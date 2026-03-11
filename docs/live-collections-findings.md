# Live Collections for Play Cricket Data — Findings

## Summary

This spike explored Astro v6 live collections as a replacement for the current React Query + Astro action pattern used for Play Cricket data. A proof-of-concept live loader was implemented for league tables.

## What was built

- **`src/collections/league-table.ts`** — A live loader implementing `LiveLoader<LeagueTableData, EntryFilter>` with 1-hour in-memory caching
- **`src/live.config.ts`** — Updated to register the new `leagueTable` collection
- **`src/pages/poc/league-table/[divisionId].astro`** — A demo page rendering a league table server-side via `getLiveEntry()`

## Comparison: Live Collection vs React Query

| Aspect | React Query (current) | Live Collection (PoC) |
|--------|----------------------|----------------------|
| Client JS | React + React Query (~40KB) | Zero |
| Rendering | Client-side after hydration | Server-side HTML |
| Caching | None (fetches on every mount) | 1 hour in-memory |
| Loading state | Blank until data loads | Table in initial HTML |
| SEO | Not indexed | Fully indexable |
| Data freshness | Always fresh | Up to 1 hour stale |
| Type safety | Zod at API boundary | Live collection schema + Zod |
| DX complexity | Action + component + hook | Loader + Astro template |

## Recommendations

### Migrate to live collections

**League tables** — Strong candidate. Data changes weekly, 1-hour cache is acceptable, and removing client JS is a clear win. The PoC confirms the pattern works well.

**Match scorecards** — Good candidate for completed matches (data is static after the match). In-progress matches could use a short cache TTL (5 min). Consider a hybrid: live collection for server render + optional client polling for live updates.

**Player statistics** — Already migrated via the `personStats` live collection. No action needed.

### Keep as React islands

**Live scores** — Must stay as React components. They require client-side polling (sub-minute refresh) for real-time updates during matches. Live collections fetch per-request, which doesn't suit push/poll patterns.

### Integration challenges

The main challenge is **Contentful rich text embedding**. League tables are currently rendered inside `RichText.tsx` (a React component). To use live collections:

1. The Astro page would need to pre-scan rich text for league entries
2. Pre-fetch all league table data via `getLiveEntry()` in page frontmatter
3. Pass pre-fetched data as props to `RichText`
4. `RichText` renders the table inline without useQuery

This is doable but requires refactoring the RichText component to accept pre-fetched data. For pages that already use `prerender: false` (like person pages), this is straightforward.

### Caching strategy

For production, consider:

- **In-memory cache** (current PoC) — Simple, but lost on cold starts. Fine for league tables since the API is fast.
- **DB-backed cache** — Like `play_cricket_match_cache`, persistent across restarts. Better for data that's expensive to fetch.
- **Astro route caching** — When stable, could replace loader-level caching. Set cache headers per route for CDN-level caching.

### Next steps

1. Refactor the RichText component to accept pre-fetched league table data
2. Update pages that embed league tables to pre-fetch via `getLiveEntry()`
3. Remove the `getLeagueTable` Astro action (no longer needed)
4. Remove the `LeagueTable` React component
5. Consider migrating match scorecards next
6. Remove PoC page once the real integration is in place
