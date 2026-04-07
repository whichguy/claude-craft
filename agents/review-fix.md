---
name: review-fix
description: |
  Iterative review-fix loop: dispatches code-reviewer per file, applies Fix blocks,
  rechecks until clean (max 5 rounds), then commits/PRs.
  commit_mode="pr" (default): commit + push + PR + squash merge + delete branch.
  commit_mode="commit": commit only (POST_IMPLEMENT pipeline).
  Git fallback: WIP → last commit when target_files empty.
  **AUTOMATICALLY INVOKE** after implementing features, fixing bugs, before committing,
  or after plan implementation completes (user approves + all changes made).
  **STRONGLY RECOMMENDED** before merging to main, after refactoring,
  and when code-reviewer returns NEEDS_REVISION.
  Trigger phrases: "review and fix", "polish this", "clean this up", "make sure this is
  good", "before committing", "before merging", "loop until clean".
color: orange
---

# review-fix — Narrow Orchestrator

Detect files → dispatch code-reviewer per file → apply Fix blocks → loop until clean → commit.
code-reviewer (Q1-Q36) owns all evaluation. This agent only orchestrates.

## Input Contract

- `target_files` — optional; comma-separated file paths/dirs/globs. If omitted: WIP → last commit fallback.
  - `--all` flag: all tracked files via `git ls-files`
- `task_name` — required; review context identifier
- `worktree` — required; absolute path to working directory (default: ".")
- `max_rounds` — optional; max fix-and-recheck rounds (default: 5)
- `read_only` — optional; if true, report findings without applying fixes
- `commit_mode` — optional:
  - `"pr"` (default) — stage + commit + push + PR + squash merge + delete branch
  - `"commit"` — stage + commit only (POST_IMPLEMENT)
  - `"none"` — no git operations
- `plan_summary` — optional; plan context for Q34 intent alignment

Pre-flight: if `task_name` empty, stop with error.

Orphan cleanup at startup:
```bash
find /tmp -maxdepth 1 -name 'review-fix.*' -mmin +60 -exec rm -rf {} + 2>/dev/null
```

## Step 1: File Detection

```
If --all:
  file_list = git ls-files (respect .gitignore)
  If .claspignore exists: filter through its patterns
Else if target_files provided:
  file_list = expand globs, validate paths exist
Else (auto-detect):
  uncommitted = git diff --name-only HEAD
  staged = git diff --cached --name-only
  work_in_progress = union(uncommitted, staged)

  If work_in_progress non-empty:
    file_list = work_in_progress
    rationale = "work-in-progress"
  Else:
    file_list = git diff --name-only HEAD~1..HEAD
    rationale = "last-commit"
    If empty: error "No changes to review"

Filter: exclude .json, .lock unless explicitly named
Validate: each file exists on disk (warn about missing)
If file_list empty after filtering: error "No reviewable files"

Capture per-file diffs for change context:
  per_file_diffs = { file: git diff HEAD -- file }
```

Print file list with rationale.

## Step 2: Impact Discovery

For files with exported functions/classes: grep codebase for callers.

```
impact_files = {}
For each file in file_list:
  exports = grep for export/module.exports patterns in file
  If exports found:
    callers = grep -r across worktree for each exported name
    impact_files[file] = unique caller files (excluding self)
```

This feeds Q11 (backward compatibility) with real caller evidence.

## Step 3: Initial Review (parallel per-file)

```
MAX_CONCURRENT = 12

reviewer_prompt = (file) => `
  target_files="${file}"
  task_name="${task_name}"
  worktree="${worktree}"
  mode=evaluate
  ${plan_summary ? 'Plan context:\n' + plan_summary : ''}
  ${per_file_diffs[file] ? '**Change context:**\n```diff\n' + per_file_diffs[file] + '\n```' : ''}
  ${impact_files[file]?.length > 0 ? '**Impact context** (callers for Q11):\n' + impact_files[file].map(f => '- ' + f).join('\n') : ''}
`

waves = chunk(file_list, MAX_CONCURRENT)
For each wave:
  Spawn parallel Tasks (one per file, single message):
    Task(subagent_type="code-reviewer", prompt=reviewer_prompt(file))

  Collect results: parse each Task output for findings and LOOP_DIRECTIVE
  Print per-file status:
    ├ file.ts          ● APPROVED
    ├ other.js         ◐ NEEDS_REVISION (2C 1A)
    └ config.yaml      ● APPROVED_WITH_NOTES (0C 3A)
```

### Finding Parser

Extract from code-reviewer's output:
```
For each "**Q[N]: [Title]** | Finding: [severity]" block:
  Extract: q_number, title, severity, description
  If Fix block present (Before/After code blocks): extract fix_block
  Store: { q_number, severity, description, fix_block, file, line }

Extract LOOP_DIRECTIVE: APPLY_AND_RECHECK or COMPLETE
```

## Step 4: Fix Loop

```
round = 0
DO:
  round += 1
  recheck_files = files where LOOP_DIRECTIVE == APPLY_AND_RECHECK

  IF recheck_files empty: BREAK (all clean)
  IF round > max_rounds: BREAK (exhausted)
  IF read_only: BREAK (report only mode)

  Print: "┌ Fix round [round]/[max_rounds] — [count] files"

  For each recheck file:
    findings = current findings for this file
    fix_tasks = findings with Fix blocks, sorted: Critical first, then Advisory

    For each fix_task:
      Apply via Edit tool:
        old_string = fix_task.fix_block.before (verbatim)
        new_string = fix_task.fix_block.after (verbatim)
      If Edit succeeds: record as applied
      If Edit fails (old_string not found): record as failed, continue

    Track: files_changed += file (if any fix applied)

  Re-dispatch code-reviewer Tasks for recheck files (same wave logic as Step 3)
  Update findings and LOOP_DIRECTIVE for each file

  applied = count of successful fixes this round
  remaining = count of files still APPLY_AND_RECHECK
  Print: "└ Round [round] — [applied] fixes applied, [remaining] files remaining"
WHILE recheck_files non-empty AND round <= max_rounds
```

## Step 5: Git Operations

**Conditions**: files_changed non-empty AND final_status is APPROVED or APPROVED_WITH_NOTES.
Skip entirely if NEEDS_REVISION or no changes or commit_mode == "none".

### Step 5a: Branch Check (pr mode only)

```bash
current_branch=$(git rev-parse --abbrev-ref HEAD)
default_branch=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')
default_branch=${default_branch:-main}
```

If on default branch, create temp branch: `review-fix/YYYYMMDD-HHMMSS`

### Step 5b: Stage and Commit

```
commit_mode == "commit": stage all target_files with changes (implementation + fixes)
commit_mode == "pr": stage only files_changed (fix corrections only)

git commit -m "review-fix: <task_name>: apply corrections ([N] critical, [M] advisory)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

If commit_mode == "commit" → output `<!-- COMMITTED -->`, stop.

### Step 5c: Pre-flight (pr mode only)

```bash
git remote get-url origin   # remote exists?
gh auth status              # gh authenticated?
```

If either fails → `<!-- COMMITTED -->` (graceful fallback), stop.

### Step 5d: Push + PR + Merge (pr mode only)

```bash
git push -u origin HEAD
pr_url=$(gh pr create --base "$default_branch" --title "review-fix: corrections" --body "...")
gh pr merge "$pr_url" --squash --delete-branch
git checkout "$default_branch" && git pull --ff-only
```

Output `<!-- PR_MERGED -->` on success. Print PR URL.

## Step 6: Report

```
## Review Report

[N] files reviewed | [R] rounds | [F] fixes applied

### Per-File Status
| File | Status | Critical | Advisory | Fixes |
|------|--------|----------|----------|-------|
| ... | APPROVED / NEEDS_REVISION | N | N | N |

### Overall: [APPROVED | APPROVED_WITH_NOTES | NEEDS_REVISION]
[Most severe status across all files]
```

## Step 7: Self-Reflection (after report)

After printing the report, reflect on the review process itself:

```
### Prompt Improvement Signals
- Were any questions consistently None across all files? (may indicate low-value triggers)
- Did any Advisory findings lack Fix blocks? (question may need clearer fix guidance)
- Were fixes rejected by Edit tool? (Fix block format may not match actual code)
- Did any file require all 5 rounds without converging? (question criteria may be ambiguous)
- Were the same Q-IDs flagged across multiple files? (may indicate systemic codebase issue, not per-file)

Print 0-3 recommendations if signals fire. Otherwise: "No prompt improvements identified."
```

This creates a learning loop — each review run surfaces whether the Q1-Q36 framework or the orchestration should evolve.

Cleanup: remove any temp files.
