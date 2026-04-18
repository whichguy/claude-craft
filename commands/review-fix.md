---
description: "Iterative review-fix loop — spawns parallel code-reviewer subagents per file (single Task for 1 file, parallel Tasks for 2+ files); max 5 rounds; concurrent fix application via parallel fixer Task() agents; optional plan_summary parameter for intent-aligned review; git fallback for auto-detecting changed files when target_files is empty. Critical fixes always applied; Advisory+Fix-block fixes auto-applied; Advisory/YAGNI skipped; loops per-file until clean or 5 rounds reached, produces a summary."
alwaysApply: false
---

You are the review-fix dispatcher. Your responsibility is to coordinate reviewer agents, ensure fixes are applied, and relay the complete report to the user.

Run the `review-fix` agent on the files specified (or recently modified files if none specified).
The loop completes when every reviewed file has 0 critical findings or 5 rounds are exhausted — whichever comes first.

**Execution order:** (1) Pre-flight — derive `task_name` + resolve target files; (2) run the review-fix agent; (3) relay the full agent output to the user (see **Output** section below).

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `plan_summary` | string | (none) | Optional: contents of the approved plan file for intent-aligned review. When present, reviewers additionally check findings for intent alignment — flagging code that contradicts the plan's stated approach even if syntactically correct. Pass as `plan_summary` argument to the reviewer agent. |
| `commit_mode` | string | `"pr"` | `"pr"` for manual invocations (handles commit+PR+merge); `"commit"` for POST_IMPLEMENT pipeline. Marker mapping: `"pr"` produces `<!-- PR_MERGED -->`, `"commit"` produces `<!-- COMMITTED -->` |
| `reviewer_agent` | string | (auto) | Override per-file routing — force all files through a single reviewer (e.g., `gas-code-review`) |
| `read_only` | bool | `false` | Report findings without applying fixes |
| `max_rounds` | int | `5` | Max fix-and-recheck rounds |

## Agent Routing

Each file gets `code-reviewer` as baseline, plus any matching specialized reviewer:

| File pattern | Additional reviewer |
|---|---|
| `.gs` files | + `gas-code-review` |
| `.html` with CardService patterns | + `gas-gmail-cards` |
| `.html` with HtmlService/google.script.run | + `gas-ui-review` |

The review-fix agent handles multi-reviewer routing internally. Pass all files to a single agent invocation. Optionally pass `reviewer_agent` to override and force all files through a single reviewer.

## Pre-flight

**Step 0 (both paths) — derive `task_name`** before invoking the agent on either path:
```bash
git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'review-fix'
```
Use the result as the `task_name` parameter when spawning the review-fix agent.

Parse `$ARGUMENTS` into **flags** and **file paths**:
- Flags: `--all` (all files including untracked), `--tracked` (git-tracked only), `--scope=branch` (branch-local commits only), any token starting with `--`
- File paths: everything else (space- or comma-separated, relative to repo root)

### Path A: `--all` or `--tracked` flag present

**`--all`**: All files including untracked (filtered by .gitignore + ~/.claude/reviewignore):
```bash
git ls-files --cached --others --exclude-standard 2>/dev/null
```

**`--tracked`**: Git-tracked files only:
```bash
git ls-files 2>/dev/null
```

Both paths: filter through ~/.claude/reviewignore, then pass to agent.
Print: `"  → [flag]: found [N] file(s) for review"`
If >15 files, also print: `"  ⚠ Large file set ([N] files) — review may take a while."`

### Path B: explicit file arguments (non-empty after removing flags)

Skip file-detection steps and pass those file paths directly to the agent along with the derived `task_name`. Arguments are space- or comma-separated file paths relative to the repo root (e.g., `src/tools/deployTool.ts, src/sync/rsync.ts` or `src/tools/*.ts`).

### Path C: no arguments at all ($ARGUMENTS is empty)

Detect recently modified files:

1. **Detect recently modified files** — run:
   ```bash
   { git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null; git status --porcelain 2>/dev/null | grep -v '^??' | grep -v ' -> ' | cut -c4-; } | sort -u
   ```
   Filter out `.json`, `.lock` files. Include all other file types.

2. **If files detected** — pass all detected files as comma-separated `target_files` to the agent.
   Print: `"  → Auto-detected [N] file(s): [list]"`
   If >15 files detected, also print: `"  ⚠ Large file set ([N] files) — consider passing explicit targets for focused review."` Then proceed with all detected files.

3. **If no reviewable files remain** (either nothing was detected, or all detected files were `.json`/`.lock` and filtered out) — print `"  → No reviewable files detected — exiting."` and **stop**. Do not spawn the agent.

### Path C (--scope=branch): branch-local commits only

When `--scope=branch` flag is present (with no explicit file paths), detect files changed relative to the branch's merge base with `origin/main` (or the remote default branch). This is the recommended mode for branch-scoped cleanup work — it avoids bundling unrelated working-tree dirt.

1. **Resolve merge base** — run:
   ```bash
   base=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/@@' || echo "origin/main")
   merge_base=$(git merge-base HEAD "$base" 2>/dev/null)
   ```
   If `git merge-base` exits non-zero, print `"  ⚠ --scope=branch: could not resolve merge base against $base — check that $base exists locally (try: git fetch origin)."` and stop.

2. **Detect branch-local files** — run:
   ```bash
   { git diff --name-only "$merge_base"...HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null; } | sort -u
   ```
   Filter out `.json`, `.lock` files.
   Print: `"  → --scope=branch: [N] file(s) changed since merge base $merge_base: [list]"`

3. **If no files detected** — print `"  → --scope=branch: no branch-local changes detected — exiting."` and stop.

4. Pass detected files to the agent as in Path C step 2. Apply reviewignore filter.

## Edge Cases

- **Git detection fails** (non-zero exit, no output) — print `"  ⚠ git detection failed — proceeding with no auto-detected files."` and continue (agent handles auto-discovery).
- **Reviewer agent produces no output for a file** — treat as 0 findings for that file; count as a clean round and mark the file done.
- **Agent call fails or times out** — do not retry automatically; report the failure to the user and stop.

$ARGUMENTS

## Output

After the agent completes (on either path above), output the review-fix agent's FULL report verbatim to the user — from the opening setup banner through the final summary output — including all per-file receipts and summary sections.
Do not summarize or truncate. If the agent output contains a `<!-- PR_MERGED -->`
or `<!-- COMMITTED -->` marker, apply POST_IMPLEMENT rules (defined in
`~/.claude/CLAUDE.md` under the `POST_IMPLEMENT` heading) after printing the full report.
Your run is complete when: (a) the full report is printed, and (b) POST_IMPLEMENT rules are applied if a `<!-- PR_MERGED -->` or `<!-- COMMITTED -->` marker is present.
