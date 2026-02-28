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
- **Use shadcn/ui components where possible** - avoid writing our own components unless necessary. Consider how their colours fit with our theme always. Compose smaller components to make larger components.
- **Use `NULL` for unset/missing values in the database** — never use empty string `""` to represent "no value". Empty string should only mean a genuinely empty string. For nullable columns, use `NULL`; for Zod schemas, use `.optional()` not `.optional().default("")`.

## Local Data

When running locally, Contentful data is cached in `.astro/data-store.json`. This file can be examined directly to inspect the raw data structure (e.g. richtext documents, field values) without needing to add debug logging.

We use SQLite, with a file based store locally in `local.db`. This file is disposable and can be deleted. If you do this, then you will need to run DB migrations prior to running the app or generating DB types.

## Development workflow

When beginning work on a ticket, follow these steps:

1. **Read the ticket file**
   - Tickets are managed in Github and are the source of truth.
   - Read the entire ticket including comments to understand the goal, acceptance criteria, and any context provided

2. **Create a feature branch and a worktree**
   - Branch from `main`, using a local worktree to allow parallel work
   - Include the ticket number in the branch name (e.g., `18-add-user-profile`)

3. **Analyse current behaviour**
   - If the ticket involves existing functionality, completely understand current behaviour first
   - Use Chrome tools to observe the UI/UX if needed
   - Check related code to understand the current implementation
   - Note any edge cases or existing bugs that may be relevant

4. **Clarify with the user**
    - For ambiguous requirements, make pragmatic decisions and note your assumptions
    - If user input is truly blocking, comment on the ticket and pause
    - Raise any concerns about scope or approach early

5. **Build a plan**
   - Identify which files need to be created or modified
   - Break the work into logical steps
   - Consider test coverage and how to verify the changes
   - Use available tools such as clear-thought and sequential thinking to organize your thoughts and approach
   - For important user-facing flows, especially those involving payments, consider if E2E tests would be valuable

6. **Execute the plan**
   - Follow the plan step-by-step
   - Commit changes frequently with meaningful messages
   - Ensure each commit is self-contained and testable
   - Ensure changes lint, test and build locally, and the app starts locally before proceeding

7. **Open a pull request**
   - When implementation is complete, open a PR against `main`
   - Include e.g. "Closes #18" if merging the PR will resolve the ticket

8. **Review the PR**
   - Use an appropriate agent (e.g., **code-reviewer**) to review the PR
   - **Always instruct the reviewer to read files locally** (using Read/Glob/Grep tools) rather than fetching from GitHub via WebFetch — local reads are much faster
   - The subagent cannot post comments themselves, so ask for their review to be provided in a structured form
   - The supervising agent should ensure the review is posted on the PR
   - Comments MUST BE recorded on the pull request itself - check if the code-reviewer has recorded their comments, and if not, record them yourself. Use one comment per issue, ideally linked to the specific line of code, unless it is a broader more general comment.

9. **Address review comments**
   - Address all comments, including minor ones
   - Commit fixes and push to the PR branch
   - Reply to each comment on the PR explaining the resolution

10. **Test the deploy preview**
   - Netlify will comment on the PR with the URL of a deploy preview, e.g. https://deploy-preview-111.preview.percymain.org/
   - Using chrome and/or playwright, verify expected behaviour changes on the deploy preview
   - If there are any issues, then fix the issues, push, and re-test the new preview.

11. **FInalising PR**
    - Ensure all PR checks pass
      - Check the status of the checks and ensure they are all passing, not pending or failed.
    - Ensure all review comments are addressed

12. **Clean up**
    - Ensure any local running frontend app processes are stopped
    - Ensure any local running backend app processes are stopped
    - Delete the local branch and worktree

13. **Report to user**
    - Notify the user that the PR is ready for merge after their review and approval.
    - Give them a short summary of the changes made and the issues addressed.
    - Provide a link to the PR for easy access.
