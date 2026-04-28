---
name: review-fix
description: |
  Simplified orchestrator for the iterative review-fix loop. 
  Detects files → delegates to specialized reviewers in standalone mode → aggregates results → commits/PRs.
  Reviewers (code-reviewer, etc.) handle their own inner loops, auto-fixes, and re-verification.
  **AUTOMATICALLY INVOKE** after implementing features, fixing bugs, before committing,
  or after plan implementation completes.
color: orange
model: sonnet
loop_agent: true
---

# review-fix — Thin Orchestrator

Detect files → delegate to autonomous reviewers with global context → aggregate results → commit.

## Input Contract

- `target_files` — optional; comma-separated file paths/dirs/globs. 
  - **DEFAULT**: If omitted, reviews ALL git-tracked files in the repository (exhaustive audit).
  - `--all` flag: all files in worktree (including untracked).
  - `--tracked` flag: git-tracked files only (standard exhaustive mode).
  - `--scope=branch` flag: files changed in branch-local commits only.
- `task_name` — required; review context identifier.
- `worktree` — required; absolute path to working directory (default: ".").
- `commit_mode` — optional: `"pr"` (default), `"commit"`, or `"none"`.
- `read_only` — optional; if true, reviewers will not apply fixes.

Pre-flight: if `task_name` empty, stop with error.

## Step 1: File Detection & Context Generation

1. **Global Context**: Generate a `repo_map` (list of all tracked files) to provide to reviewers.
   ```bash
   git ls-files
   ```

2. **File Selection**:
```
If --all:
  file_list = git ls-files --cached --others --exclude-standard
Else if target_files provided:
  file_list = expand globs, validate paths exist
Else if --scope=branch:
  base = git symbolic-ref refs/remotes/origin/HEAD (strip "refs/remotes/") OR "origin/main"
  merge_base = git merge-base HEAD "$base"
  file_list = git diff --name-only "$merge_base"...HEAD
Else (Default / Auto-detect):
  staged = git diff --cached --name-only
  unstaged = git diff --name-only
  untracked = git ls-files --others --exclude-standard
  
  If staged non-empty:
    file_list = staged
  Else if union(unstaged, untracked) non-empty:
    file_list = union(unstaged, untracked) | sort -u
  Else:
    file_list = git diff --name-only HEAD~1..HEAD

If file_list is empty:
  Stop and report: "No files found for review."
```

Filter `file_list` through `~/.claude/reviewignore`.
Validate: each file exists on disk.

Print setup banner:
`review-fix: [N] files · autonomous parallel review · global repo context · [commit_mode] mode`

## Step 2: Reviewer Routing

Determine the set of agents to invoke for each file:
- Baseline: `code-reviewer`
- Specializations:
  - `.gs` → `gas-code-review`
  - `.html` with CardService → `gas-gmail-cards`
  - `.html` with HtmlService → `gas-ui-review`

## Step 3: Delegated Execution (Parallel)

Spawn each reviewer in **standalone mode** with the `repo_map` for architectural awareness.

```
For each (file, reviewer) in queue:
  Agent(
    subagent_type = reviewer,
    name = sanitize(file) + "--" + reviewer,
    prompt = `
      target_files="${file}" 
      task_name="${task_name}" 
      worktree="${worktree}" 
      mode=standalone 
      read_only=${read_only}
      repo_map="${repo_map}"
    `,
    run_in_background = true
  )
```

Wait for ALL background agents to complete.

## Step 4: Aggregation & Git Operations

1. **Aggregate Results**:
   Read all manifests from `<worktree>/docs/planning/review-manifests/`.
   - `total_critical = sum(manifest.critical_count)`
   - `total_advisory = sum(manifest.advisory_count)`
   - `all_approved = all(manifest.approval_status == "APPROVED" or "APPROVED_WITH_NOTES")`

2. **Final Status**:
   `final_status = "APPROVED"` if all_approved, else `"NEEDS_REVISION"`.

3. **Git Operations**:
   Skip if `read_only=true`, `commit_mode="none"`, or `final_status="NEEDS_REVISION"`.
   
   - **Pre-flight index check**: run `git diff --cached --name-status`. Collect any `R`/`D`/`A` entries not in `target_files` as `pre_staged_entries` — include them in the commit unchanged (preserves caller's `git mv`/`git rm` operations).
   - **Stage**: If `"commit"`, stage all `target_files`. If `"pr"`, stage only files actually modified by reviewers. Always include `pre_staged_entries`.
   - **Commit**: `git commit -m "review-fix: <task_name>: apply corrections ([total_critical] critical, [total_advisory] advisory)\n[If pre_staged_entries non-empty]: Pre-staged entries from caller: <list>"`
   - **PR (if "pr")**: `git push`, `gh pr create`, `gh pr merge --squash`.

## Step 5: Report

Compute health_bar from overall status:
- APPROVED: `██████ ██████ ██████ ██████ ██████ ██████`
- NEEDS_REVISION: `░░░░░░ ░░░░░░ ░░░░░░ ░░░░░░ ░░░░░░ ░░░░░░`

```
╔══════════════════════════════════════════════════════╗
║      [health_bar]                                    ║
║         review-fix Scorecard                         ║
║         Rating: [final_status]                       ║
╚══════════════════════════════════════════════════════╝

  Per-File Status (from manifests)
  ─────────────────────────────────────
    [✅|❌]  [filename]  ([Nc] Critical, [Na] Advisory)

  Git Summary
  ─────────────────────────────────────
    [Commit Message / PR URL]
```

Output `<!-- PR_MERGED -->` or `<!-- COMMITTED -->` to trigger pipeline completion.
