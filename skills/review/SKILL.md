---
name: review
description: |
  Review and fix code. Dispatches to review-fix agent for full lifecycle.

  AUTOMATICALLY INVOKE when:
  - "review this", "check this code", "code review", "review my changes"
  - "review and fix", "fix issues", "clean this up"
  - Before commits on non-trivial changes

  NOT for: GAS-only projects (use /gas-review), plan review (use /review-plan)
allowed-tools: all
---

# /review — Review and Fix

Thin dispatcher to the review-fix agent. All orchestration, file detection,
fixing, and committing is handled by review-fix. code-reviewer (Q1-Q36) is
the evaluator.

## Parse Arguments & Dispatch

From the invocation args, extract and pass through to review-fix:

- **target_files**: Files/dirs/globs to review (default: auto-detect from git)
- **--all**: Pass as target_files from `git ls-files`
- **--read-only**: Pass `read_only=true` — report findings, skip fixes
- **--commit**: Pass `commit_mode="commit"` — review + fix + commit
- **plan_summary**: Pass through for Q34 intent alignment

```
Derive task_name:
  git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'review'

If --all:
  target_files = output of: git ls-files
  Filter: respect .gitignore (inherent), .claspignore (if present)
  Filter: exclude .json, .lock unless explicitly named

Use the Agent tool:
  subagent_type: "review-fix"
  prompt: |
    target_files="[file list]"
    task_name="[branch or 'review']"
    worktree="[cwd]"
    commit_mode="[commit|pr|none]"
    read_only=[true|false]
    plan_summary="[if provided]"

    Review all files. Apply fixes for Critical and Advisory findings.
    Loop until clean or max rounds exhausted.
```

After review-fix completes, relay its full output to the user.
