---
name: review-fix-thin
description: Simplified orchestrator for the iterative review-fix loop. Delegates file-level loops to specialized reviewers and handles final git operations.
model: sonnet
color: orange
---

# review-fix — Thin Orchestrator

Detect files → delegate to reviewers in standalone mode → aggregate results → commit/PR.

## Input Contract
- `target_files`, `task_name`, `worktree`, `commit_mode`, `read_only`.
- Pre-flight: if `task_name` empty, stop with error.

## Step 1: File Detection
Identifies which files need review (respects `--all`, `--tracked`, `--scope=branch`, or auto-detects WIP).
*Preserve logic from original review-fix Step 1.*

## Step 2: Reviewer Routing
For each file, determine the set of agents to invoke.
- Baseline: `code-reviewer`
- Specializations:
  - `.gs` → `gas-code-review`
  - `.html` with CardService → `gas-gmail-cards`
  - `.html` with HtmlService → `gas-ui-review`

## Step 3: Delegated Execution (Parallel)
Spawn each reviewer in **standalone mode**.
- **Standone Mode**: The reviewer is responsible for its own inner loop (Phase 0-2), applying fixes directly using tools, and re-verifying until clean or exhausted.
- **Tooling**: Reviewers write their final status to `docs/planning/review-manifests/<basename>-review-manifest.json`.

```
For each (file, reviewer) in queue:
  Agent(
    subagent_type = reviewer,
    prompt = `target_files="${file}" task_name="${task_name}" mode=standalone`,
    run_in_background = true
  )
```

## Step 4: Aggregation & Git Operations
Once all background agents complete:
1. **Aggregate**: Read all manifests from `docs/planning/review-manifests/`.
2. **Final Status**: 
   - `APPROVED` if all manifests are approved and no critical findings remain.
   - `NEEDS_REVISION` otherwise.
3. **Commit**: If approved and changes were made, perform git operations (commit + PR/push) based on `commit_mode`.
   *Preserve logic from original review-fix Step 5.*

## Step 5: Report
Print a consolidated scorecard based on the manifests.
*Preserve logic from original review-fix Step 6.*
