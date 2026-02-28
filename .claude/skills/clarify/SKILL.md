---
name: clarify
description: Reads a triaged GitHub issue and interactively walks through its open questions with the user, updating the ticket as answers are resolved.
metadata:
  tags: github, issues, triage, clarification
---

# Clarify

Interactively resolve open questions on a triaged GitHub issue.

## When to Use

Use this skill when the user wants to:

- Work through open questions on a triaged issue before starting development
- Clarify requirements or approach for a specific ticket

## Arguments

This skill takes a single argument: the issue number (e.g. `/clarify 42`).

## Workflow

### Step 1: Read the issue

Fetch the issue including all comments:

```bash
gh issue view <number> --json number,title,body,comments,labels
```

If the issue is not triaged, report that back to the user and stop:

> Issue #42 is not triaged. Please triage it first with /triage

### Step 2: Find open questions

Look through the issue comments for a triage comment (marked with `*Triaged by Claude*`). Extract any open questions — these are checkbox items under the `### Open questions` heading:

```markdown
- [ ] Unanswered question
- [x] Already answered question
```

If there is no triage comment, or there are no open questions (all checked or section absent), report that back to the user and stop:

> No open questions on #42. This issue is ready for development.

### Step 3: Walk through each question

For each unanswered question (`- [ ]`), present it to the user one at a time using `AskUserQuestion`. Provide options where you can infer sensible choices from the codebase, and always allow a free-text "Other" response.

Before presenting each question, briefly explore the codebase if it helps you offer better options. For example, if the question is about where to place a component, check the existing component structure first.

### Step 4: Update the issue

Once all questions are resolved, post a new comment on the issue summarising the decisions:

```markdown
## Clarifications

| Question | Decision |
|----------|----------|
| Should X use approach A or B? | Approach A — because ... |
| ... | ... |

---
*Clarified by Claude*
```

Then update the triage comment to check off the resolved questions. Use `gh api` to edit the existing triage comment:

1. Find the triage comment ID from the comments JSON
2. For each resolved question, replace `- [ ]` with `- [x]` in the comment body
3. Update the comment:

```bash
gh api repos/{owner}/{repo}/issues/comments/{comment_id} -X PATCH -f body='...'
```

Add the `ready for dev` label to the issue:

```bash
gh issue edit <number> --add-label "ready for dev"
```

### Step 5: Report

Tell the user the issue is now clarified and ready for development, or note if any questions remain unresolved.
