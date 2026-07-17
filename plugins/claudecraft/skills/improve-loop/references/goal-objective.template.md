# Improve-loop campaign objective (canonical `/goal` body)

Fill placeholders, then pass the result as the `/goal` objective. Single source of truth —
do not invent a second multi-cycle wrapper text in skill prose.

```
Improve-loop campaign for target: <TARGET>
Repo: <TARGET_REPO_ABS>
Test command: <CMD>

Each turn:
  1. Invoke the improve-loop skill for exactly one cycle (or Phase-0 short-circuit /
     ledger-flush / merge-back-only / migrate-or-discard).
  2. Resume the same campaign worktree via
     $(git -C <TARGET_REPO_ABS> rev-parse --path-format=absolute --git-common-dir)/improve-loop/active.json
     — never create a second improve worktree while pointer is active.

Done when Phase 5 reports: Status terminal (complete OR stopped(...))
AND the iteration commit has landed. Merge-back is best-effort; land is required.
On active after a successful cycle: update_goal progress only — do not complete.
```

## Placeholder rules

| Token | Meaning |
|---|---|
| `<TARGET>` | Plain-language improvement target from the user |
| `<TARGET_REPO_ABS>` | Absolute path to the target git repo root |
| `<CMD>` | Recorded test command (must be non-empty for unattended) |
