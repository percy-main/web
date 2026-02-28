---
name: devit
description: Fetches GitHub issues ready for development and works through them using the standard CLAUDE.md workflow, with parallel orchestration where appropriate.
metadata:
  tags: github, issues, development, orchestration
---

# Dev It

Fetch GitHub issues and develop them end-to-end using the standard project workflow.

## When to Use

Use this skill when the user wants to:

- Develop one or more GitHub issues
- Work through the backlog of issues marked `ready for dev`
- Implement a specific issue by number

## Arguments

This skill takes an optional variadic argument: one or more issue numbers (e.g. `/devit 42 43 57`).

- If issue numbers are provided, only those issues are considered.
- If no arguments are provided, all applicable open issues are fetched.

## Workflow

### Step 1: Fetch and categorise issues

Fetch open issues from GitHub:

```bash
gh issue list --state open --json number,title,labels,body,comments,assignees --limit 100
```

If specific issue numbers were provided as arguments, filter to only those issues.

Categorise each issue into one of three buckets:

| Category | Condition | Action |
|----------|-----------|--------|
| **Skip** | Has `backlog` label | Ignore entirely |
| **Ready** | Has `ready for dev` label | Proceed to development |
| **Not ready** | No `ready for dev` label | Report status to user (see below) |

For issues that are **not ready**, advise the user what's needed:

- If the issue has a `triaged` label but no `ready for dev` → it likely needs clarification. Suggest: _"Issue #N needs clarification before development. Run `/clarify N` to resolve open questions."_
- If the issue has neither `triaged` nor `ready for dev` → it needs triage first. Suggest: _"Issue #N has not been triaged. Run `/triage` to triage it first."_
- If the user explicitly requested that issue number, do **not** silently skip it — always report the status.

### Step 2: Present the plan

Before starting any work, present a summary to the user:

| # | Title | Status |
|---|-------|--------|
| 42 | Add user profile page | Ready — will develop |
| 43 | Fix login redirect | Ready — will develop |
| 44 | Improve dashboard | Needs clarification (`/clarify 44`) |
| 45 | Redesign homepage | Needs triage (`/triage`) |
| 46 | Update deps | Skipped (backlog) |

Wait for the user to confirm before proceeding. Use `AskUserQuestion` to ask:

> "I found N issues ready for development. Shall I proceed with developing them?"

Provide options like "Yes, develop all", "Let me pick which ones", and let the user customise.

### Step 3: Develop issues

For each issue to be developed, follow the **full development workflow from CLAUDE.md** (steps 1–13). This means for each issue:

1. Read the ticket thoroughly (body + all comments)
2. Create a feature branch and worktree (branch name includes issue number)
3. Analyse current behaviour
4. Clarify ambiguities (make pragmatic decisions, note assumptions)
5. Build a plan
6. Execute the plan (commit frequently, ensure lint/test/build pass)
7. Open a PR against `main` (include `Closes #N`)
8. Review the PR using a code-reviewer agent
9. Address review comments
10. Test the deploy preview
11. Finalise the PR (checks pass, reviews addressed)
12. Clean up (stop processes, delete worktree)
13. Report to user with summary and PR link

**Do NOT merge PRs** — only prepare them for the user's review and approval.

### Parallel execution

When multiple issues are being developed:

- Use **team orchestration** (TeamCreate + Agent tool) to work on independent issues in parallel
- Each issue gets its own worktree and feature branch, so there are no file conflicts
- Create a team with tasks for each issue, and assign them to agents working in isolated worktrees
- The orchestrator (main conversation) coordinates:
  - Monitors progress across all agents
  - Ensures no two agents modify the same files
  - Handles any conflicts or dependencies between issues
  - Collects results and presents a final summary

If issues have dependencies (e.g. one builds on another), develop them sequentially in dependency order.

### Step 4: Final summary

After all issues are developed (or attempted), present a summary:

| # | Title | Result | PR |
|---|-------|--------|----|
| 42 | Add user profile page | PR ready for review | #101 |
| 43 | Fix login redirect | PR ready for review | #102 |
| 44 | Improve dashboard | Skipped — needs clarification | — |

Include links to each PR for easy access.

## Guidelines

- Follow all project conventions from CLAUDE.md (shadcn/ui, react-query, zod, etc.)
- Never commit directly to `main` — always use feature branches and PRs
- Never merge PRs — only the user should merge after review
- Copy `.env` to each worktree before building
- Regenerate types (`npm run contentful:types` and `npm run db:types`) if migrations or content types change
- Use unique migration timestamps with full millisecond precision
- Keep the user informed of progress — don't go silent during long operations
