---
name: review
description: |
  Review and fix code. Default: review + apply fixes + recheck until clean.
  Dispatches parallel code-reviewer Tasks per file (MAX_CONCURRENT=12).

  AUTOMATICALLY INVOKE when:
  - "review this", "check this code", "code review", "review my changes"
  - "review and fix", "fix issues", "clean this up"
  - Before commits on non-trivial changes

  NOT for: GAS projects (use /gas-review), plan review (use /review-plan)
allowed-tools: all
---

# /review — Review and Fix

Review files and apply fixes by default. Each file gets its own code-reviewer Task
with full Q1-Q34 evaluation. Files with fixable issues get automatic recheck rounds
(max 3). Use `--read-only` for report-only mode.

## Step 0 — Parse Arguments & Setup

From the invocation args, extract:
- **target_files**: Specific files/dirs/globs to review. If empty, detect from git.
- **--all**: Review all tracked files in the repo (full-repo audit)
- **--read-only**: Report findings without applying fixes (default: review + fix)
- **--commit**: Review + fix + commit (used by POST_IMPLEMENT pipeline)

File detection (when no target_files specified):
```bash
# --all flag: every tracked file
git ls-files

# Default: uncommitted + staged + untracked (excluding .gitignore'd)
{ git diff --name-only HEAD; git diff --cached --name-only; git status --porcelain | grep -v '^??' | cut -c4-; } | sort -u
```
Filter out `.json`, `.lock` files unless explicitly named in target_files.
Respect `.gitignore` and `.claspignore` — never review files matched by either. `git ls-files` inherently respects `.gitignore`; for `.claspignore`, check if file exists at repo root and filter results through its patterns.

Setup:
```bash
# Orphan cleanup (stale results from prior crashed reviews)
find /tmp -maxdepth 1 -name 'review.*' -mmin +60 -exec rm -rf {} + 2>/dev/null

RESULTS_DIR=$(mktemp -d /tmp/review.XXXXXX)
MAX_CONCURRENT=12
MAX_RECHECK_ROUNDS=3
```

**Error handling**: If any unrecoverable error occurs during review, run `rm -rf "$RESULTS_DIR"` before surfacing the error. The orphan cleanup above catches any missed cases on the next run.

## Step 1 — Dispatch

**Default behavior**: Review all files, apply fixes, recheck until clean (Phase A → B → C).

**If --read-only**: Skip Phase B (no fixes applied). Phase A → C only.

**If --commit**: After Phase C, commit all changes:
```bash
git add [files with applied fixes]
git commit -m "fix: apply code review findings ([N] critical, [M] advisory)"
```

### Phase A — Review Waves

Route each file to the appropriate reviewer agent:
- `.gs` files → `gas-code-review`
- `.html` with GAS patterns (HtmlService, google.script.run) → `gas-ui-review`
- All other files → `code-reviewer`

Chunk files into waves of ≤ MAX_CONCURRENT (12).

```
For each wave:
  Print: "┌ Wave [W]/[N] — [count] files"

  Spawn parallel code-reviewer Tasks (one per file, single message).
  Each Task prompt includes:
    target_files="<single file>"
    task_name="review"
    worktree="<working directory>"

  Each Task writes findings to: <RESULTS_DIR>/<sanitized-filename>.json
  Output contract (same as review-plan evaluators):
    {
      "file": "<path>",
      "status": "APPROVED|APPROVED_WITH_NOTES|NEEDS_REVISION|error",
      "critical_count": N,
      "advisory_count": N,
      "findings": [...],
      "loop_directive": "APPLY_AND_RECHECK|COMPLETE"
    }

  After wave completes, read each JSON and print per-file status:
    ├ file.ts          ● APPROVED
    ├ other.js         ◐ NEEDS_REVISION (2C 1A)
    └ config.yaml      ● APPROVED_WITH_NOTES (0C 3A)

  Print: "└ Wave [W] complete — [approved]/[total] clean"
```

### Phase B — Error/Recheck Pass

```
round = 0
DO:
  round += 1
  Read all <RESULTS_DIR>/*.json
  recheck_files = files where loop_directive == "APPLY_AND_RECHECK" or status == "error"

  IF recheck_files is empty: BREAK (all clean)
  IF round > MAX_RECHECK_ROUNDS: BREAK (exhausted)

  Print: "┌ Recheck round [round]/[MAX_RECHECK_ROUNDS] — [count] files"

  For files with APPLY_AND_RECHECK:
    Apply fixes from findings (Critical first, then Advisory with Fix blocks)

  Re-queue recheck_files through another wave cycle (same wave logic as Phase A)
  Updated results overwrite previous JSON in RESULTS_DIR

  Print: "└ Round [round] complete — [resolved] resolved, [remaining] remaining"
WHILE recheck_files is non-empty AND round <= MAX_RECHECK_ROUNDS
```

### Phase C — Final Report

```
Read all <RESULTS_DIR>/*.json (final state)

Print unified report:

## Code Review Report

[N] files reviewed | [W] waves | [R] recheck rounds

### Critical Findings
[Per-file critical findings with file:line references]

### Advisory Findings
[Per-file advisory findings]

### Per-File Status
| File | Status | Critical | Advisory |
|------|--------|----------|----------|
| ... | APPROVED / NEEDS_REVISION | N | N |

### Overall: [APPROVED | APPROVED_WITH_NOTES | NEEDS_REVISION]
[Most severe status across all files]
```

Cleanup:
```bash
rm -rf "$RESULTS_DIR"
```
