# PR Body Template (verbatim)

The orchestrator's `open-pr` task reads this file, substitutes the placeholders below,
writes the result to a tempfile, and passes it via `gh pr create --body-file`.

Substitutions:
- `{plan_path}` — source plan file path (Branch A) or the literal string `Branch B (session learnings)`
- `{integration_branch}` — the schedule-cut integration branch (`schedule/<slug>-<short-sha>`)
- `{upstream_branch}` — the user's starting branch (PR base)
- `{task_summary_table}` — markdown table of every delivery-agent task: ID, subject, RESULT
- `{commit_log}` — output of `git -C "$REPO_ROOT" log --reverse --pretty=format:'%n### %s%n%n%b' "$UPSTREAM_BRANCH..$INTEGRATION_BRANCH"`
- `{verify_summary}` — aggregated `VERIFY_CMD` lines extracted from each task's commit body
- `{review_notes}` — aggregated `Critical applied` / `Advisory deferred` lines from each task's commit body. Append a final line referencing the learnings file: `Run learnings aggregated to: $REPO_ROOT/.skill-learnings-<short-sha>.md` (replaced with `(local-only path: see $REPO_ROOT/.schedule-summary-<short-sha>.md)` when the orchestrator took the local-only branch)

---

```markdown
## Summary

This PR integrates **N tasks** scheduled from `{plan_path}` into
`{integration_branch}` for review against `{upstream_branch}`.

## Why this change

<Pulled from the plan's Context section, or for Branch B from the reviewer
output's rationale.>

## Tasks merged

{task_summary_table}

## Story (per-task detail)

{commit_log}

## Verification

The following commands were run and passed:

{verify_summary}

## Review notes

{review_notes}

🤖 Generated with [Claude Code](https://claude.com/claude-code) via
schedule-plan-tasks.
```
