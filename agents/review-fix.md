---
name: review-fix
description: |
  Iterative review-fix loop: routes each file to the appropriate reviewer (code-reviewer,
  gas-code-review, gas-ui-review, gas-gmail-cards), applies Fix blocks,
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
model: sonnet
loop_agent: true
---

# review-fix — Narrow Orchestrator

Detect files → route each file to the appropriate reviewer → apply Fix blocks → loop until clean → commit.
Reviewer selection is per-file (see Reviewer Routing). This agent only orchestrates.

## Input Contract

- `target_files` — optional; comma-separated file paths/dirs/globs. If omitted: WIP → last commit fallback.
  - `--all` flag: all files in worktree (including untracked; filtered by .gitignore + .claspignore + ~/.claude/reviewignore)
  - `--tracked` flag: git-tracked files only (filtered by ~/.claude/reviewignore)
  - `--scope=branch` flag: files changed in branch-local commits only (relative to `origin/HEAD` merge base); recommended for branch-scoped cleanup to avoid bundling unrelated working-tree dirt
- `reviewer_agent` — optional; override reviewer for ALL files (skips per-file routing)
- `task_name` — required; review context identifier
- `worktree` — required; absolute path to working directory (default: ".")
- `max_rounds` — optional; max fix-and-recheck rounds (default: 5)
- `read_only` — optional; if true, report findings without applying fixes
- `commit_mode` — optional:
  - `"pr"` (default) — stage + commit + push + PR + squash merge + delete branch
  - `"commit"` — stage + commit only (POST_IMPLEMENT)
  - `"none"` — no git operations
- `plan_summary` — optional; plan context for Q34 intent alignment
- `skip_prepass` — optional; if true, Step 2.6 Haiku pre-pass is skipped (for Spike 2 control arm). Default: false.
- `recheck_model` — optional; model override for recheck rounds (default: null, inherits reviewer frontmatter = sonnet). Set to "haiku" to trade discovery depth for speed/cost. **INTENTIONAL DEFAULT: null.** Haiku tiering was removed (PR #145) because rechecks must run full Q1-Q37 to catch bugs introduced by fixes — not just verify prior findings. Restoring "haiku" as default breaks the convergence guarantee.

Pre-flight: if `task_name` empty, stop with error.

Orphan cleanup at startup:
```bash
find /tmp -maxdepth 1 -name 'review-fix.*' -mmin +60 -exec rm -rf {} + 2>/dev/null
```

## Step 1: File Detection

```
If --all:
  file_list = git ls-files --cached --others --exclude-standard (tracked + untracked, respects .gitignore)
  If .claspignore exists: filter through its patterns
  explicit_target_files = false
Else if --tracked:
  file_list = git ls-files (respect .gitignore)
  If .claspignore exists: filter through its patterns
  explicit_target_files = false
Else if target_files provided:
  file_list = expand globs, validate paths exist
  explicit_target_files = true
Else if --scope=branch:
  base = git symbolic-ref refs/remotes/origin/HEAD (strip "refs/remotes/") OR "origin/main" if unavailable
  merge_base = git merge-base HEAD "$base"
  If merge-base fails: error "could not resolve merge base against $base — git fetch origin and retry"
  branch_files = git diff --name-only "$merge_base"...HEAD
  staged = git diff --cached --name-only
  file_list = union(branch_files, staged)
  rationale = "branch-scope"
  If empty: error "No branch-local changes detected"
  explicit_target_files = false
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
  explicit_target_files = false

# Apply reviewignore filter ONLY for auto-detected, --all, and --tracked paths.
# Skip when target_files were explicitly provided (user chose those files deliberately).
If NOT explicit_target_files:
  Filter file_list through ~/.claude/reviewignore (gitignore syntax):
    ```bash
    if [ -f ~/.claude/reviewignore ]; then
      tmp_git=$(mktemp -d)
      git init -q "$tmp_git"
      cp ~/.claude/reviewignore "$tmp_git/.gitignore"
      filtered=$(printf '%s\n' "${file_list[@]}" | \
        git -C "$tmp_git" check-ignore --no-index --stdin -v -n 2>/dev/null | \
        grep '^::\t' | cut -f2)
      rm -rf "$tmp_git"
      file_list=($filtered)
    fi
    ```
    If ~/.claude/reviewignore missing: warn and skip filtering.
Validate: each file exists on disk (warn about missing)
If file_list empty after filtering: error "No reviewable files"

Capture per-file diffs for change context:
  per_file_diffs = { file: git diff HEAD -- file }
```

Print setup banner:
```
review-fix: [N] files ([rationale]) · [reviewer breakdown e.g. "code-reviewer: N, gas-code-review: M"] · [review + fix | read-only] · max [max_rounds] rounds[if recheck_model explicitly set: " · sonnet → [recheck_model] (recheck)"]
```

## Step 1.5: Lint Pre-flight

Detect lint config files, run deterministic auto-fixes before LLM review, and defer missing-binary recommendations to end of run.

Read the LINTER_TABLE from `~/.claude/agents/review-fix-linter-table.md` when applicable candidates exist. The table is the contract — use it verbatim; do not paraphrase it at runtime.

```
# Detect applicable tools from LINTER_TABLE by matching config signals + file extensions
# Table path is absolute — agent files live in ~/.claude/agents/, not in the reviewed worktree
applicable = [rows from Read("~/.claude/agents/review-fix-linter-table.md") where config
              signal exists at worktree root AND extension overlaps file_list]

# Check if binary/node_modules is available for each applicable tool
For each tool in applicable:
  If tool.binary:
    tool.installed = (which tool.binary) exits 0
  Else (npm-based):
    tool.installed = node_modules/.bin directory exists at worktree root
  tool.autoformat_ok = (tool.fix_category == "lint") OR
                       (.review-fix-autoformat file exists at worktree root)

ready    = [t for t in applicable if t.installed]
needs_dl = [t for t in applicable if NOT t.installed]

# invocation-scoped state (reset each run, no disk persistence)
files_touched_by_lint = []   # files modified by lint auto-fix this run
missing_linters = []         # { label, install_hint } collected for end-of-run Recommendations
```

If `applicable` is empty: skip silently, continue to Step 2.

**Run installed tools; apply auto-fix then report residual:**

```
worktree_pre_lint_files = git diff --name-only HEAD   # snapshot before any lint fix

For each tool in ready:
  Print: "  ▸ [label] running..."

  If tool.fix_cmd AND tool.autoformat_ok:
    Run tool.fix_cmd via Bash (cwd=worktree, capture+discard output)
  # else: formatter without .review-fix-autoformat → skip fix_cmd, run check-only

  Run tool.cmd via Bash (cwd=worktree), capture stdout+stderr, note exit_code, record elapsed

  If exit_code == 0 AND output contains no residual issues:
    If fix_cmd ran AND files were modified:
      Print: "  ▸ [label]: auto-fixed [N] file(s) ([elapsed]s)"
    Else:
      Print: "  ▸ [label]: clean ([elapsed]s)"
    [do NOT print the full output block]
  Else (exit_code != 0 OR residual issues):
    Print:
      ── [label] ──────────────────────────────────────────
      [raw output, max 60 lines; "… [N] more lines" if longer]
      Exit [exit_code] — [N issue(s) | clean]
      [if fix_cmd ran]:               "  ▸ [label] auto-fix applied (residual issues shown above)"
      [if formatter check-only mode]: "  ▸ [label] check-only (add .review-fix-autoformat to enable auto-fix)"

files_touched_by_lint = (git diff --name-only HEAD) MINUS worktree_pre_lint_files
If files_touched_by_lint non-empty:
  Print: "  ▸ lint auto-fixed [N] file(s): [list, max 5]"
  Recompute per_file_diffs[f] = git diff HEAD -- f  for each f in files_touched_by_lint
  Record: lint_round_entry = "Round 0 — lint auto-fix: [N] file(s)" (included in Step 6 Review History)
```

**Collect missing-linter recommendations (no inline prompt):**

```
For each tool in needs_dl:
  missing_linters.append({ label: tool.label, install_hint: tool's "Binary check / install hint" column from the table })
If missing_linters non-empty:
  Print: "  ▸ [len(missing_linters)] lint tool(s) detected but not installed — will recommend at end of run."
```

# Invariant: Step 2 runs exactly once per review-fix invocation; impact_files is reused verbatim
# in every recheck round. Callers of a file's exported symbols do not shift due to a same-file edit,
# so the `impact_files[file]` entry remains valid even when the file content changes between rounds.

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

## Reviewer Routing

Determine ALL applicable reviewers for each file. Every file gets `code-reviewer` as baseline,
plus any specialized reviewers that match extension/content patterns.

```
resolve_reviewers(file):
  If reviewer_agent param is set: return [reviewer_agent]

  reviewers = ["code-reviewer"]   # baseline for all files

  ext = file extension (lowercase)
  If ext == ".gs":
    reviewers.append("gas-code-review")
  If ext == ".html":
    content = Read first 200 lines of file
    If content matches /CardService|newCardBuilder|newCardSection/:
      reviewers.append("gas-gmail-cards")
    If content matches /HtmlService|google\.script\.run|createGasServer/:
      reviewers.append("gas-ui-review")

  return reviewers
```

## Step 2.6: Freeform Senior-Engineer Pre-Pass

Cheap haiku freeform pass to resolve trivial findings before the full Q1-Q37 structured review.
Max 1 pre-pass per run. Does NOT loop. Structured reviewers (Step 3) always run after it regardless of result.
Round counters (`round_hashes`, `resolved_findings`) do NOT start until Step 4.

```
If skip_prepass:
  Print: "  ▸ Pre-pass: skipped (skip_prepass=true)"
  files_touched_by_pre_pass = []
  [continue to Step 3]

MAX_CONCURRENT_PREPASS = 12

prepass_prompt = (file) => `
  As a senior engineer, review and update the code in ${file}.
  Fix any issues you find — bugs, style violations, dead code, naming problems,
  missing error handling, off-by-one errors, security issues.
  Apply fixes directly with the Edit tool. Be selective: only fix issues that
  are clear improvements. Do not refactor arbitrarily.
  After editing, output a one-line summary per fix: [FIX: <Q-category> — <description>].
  If no issues found, output: CLEAN.
`

# Dispatch concurrently — one freeform agent per file
pre_pass_agents = {}
For each file in file_list:
  name = "prepass--" + sanitize(file)
  Agent(
    subagent_type = "general-purpose",
    model = "haiku",
    name = name,
    run_in_background = true,
    prompt = prepass_prompt(file)
  )
  pre_pass_agents[name] = file

# Fan-in: collect results
pre_pass_fixes = {}   # file → list of FIX lines (or ["CLEAN"])
files_touched_by_pre_pass = []

For each completion from pre_pass_agents:
  file = pre_pass_agents[completed_name]
  fix_lines = parse FIX: lines from output; if none → ["CLEAN"]
  pre_pass_fixes[file] = fix_lines
  If any fix_lines contain "[FIX:": files_touched_by_pre_pass.append(file)

# Recompute diffs for files the pre-pass touched
For each f in files_touched_by_pre_pass:
  per_file_diffs[f] = git diff HEAD -- f

# Detect structural changes: function removal or signature change in FIX lines
structural_flags = [f for f in files_touched_by_pre_pass
                    if any("removed" in fix or "signature" in fix or "delete" in fix
                           for fix in pre_pass_fixes[f])]

If len(files_touched_by_pre_pass) == 0 AND structural_flags is empty:
  [skip banner entirely — silent no-op]
Else:
  Print pre-pass banner:
    ── Pre-pass ─────────────────────────────────────────────────────
      [len(files_touched_by_pre_pass)] files fixed   [len(file_list) - len(files_touched_by_pre_pass)] clean   (haiku freeform, [elapsed]s)
      [per-file: file → "N fix(es)" or "clean"]
      [for f in structural_flags: "  ⚠ structural change in [f] — review before proceeding"]
    ──────────────────────────────────────────────────────────────────
```

## Step 3: Initial Review (parallel per-file)

```
MAX_CONCURRENT = 12
# INTENTIONAL: recheck_model defaults to null (sonnet via frontmatter inheritance).
# recheck_prompt was deliberately removed in PR #145. Each recheck round runs the
# full Q1-Q37 framework via reviewer_prompt() — not a verification-only checklist.
# Rationale: fixes can introduce NEW bugs not in prior findings; a verification-only
# checklist misses them. Do NOT restore recheck_prompt or change default to "haiku".
recheck_model = params.recheck_model ?? null   # null = inherit frontmatter (sonnet)

reviewer_prompt = (file) => `
  target_files="${file}"
  task_name="${task_name}"
  worktree="${worktree}"
  mode=evaluate
  ${plan_summary ? 'Plan context:\n' + plan_summary : ''}
  ${per_file_diffs[file] ? '**Change context:**\n```diff\n' + per_file_diffs[file] + '\n```' : ''}
  ${impact_files[file]?.length > 0 ? '**Impact context** (callers for Q11):\n' + impact_files[file].map(f => '- ' + f).join('\n') : ''}
`
```

### Producer-Consumer Dispatch

Use `run_in_background: true` agents as the concurrency mechanism. This keeps all
MAX_CONCURRENT slots filled continuously — when one agent completes, the next file
starts immediately without waiting for the entire wave.

```
# Build queue: one entry per (file, reviewer) pair
queue = []
for file in file_list:
  reviewers = resolve_reviewers(file)
  for reviewer in reviewers:
    queue.append({ file, reviewer })

active = {}                      # name → {file, reviewer} mapping for in-flight agents
results = {}                     # file → [parsed findings + LOOP_DIRECTIVE per reviewer]
completed = 0
total = len(queue)

# Fill initial slots
While queue non-empty AND len(active) < MAX_CONCURRENT:
  entry = queue.shift()
  name = sanitize(entry.file) + "--" + entry.reviewer   # unique per file+reviewer
  Agent(
    subagent_type = entry.reviewer,
    name = name,
    run_in_background = true,
    prompt = reviewer_prompt(entry.file)
  )
  active[name] = entry

# Process completions as they arrive
# Background agents notify automatically when done — do NOT poll.
# When notified of completion:
For each completion notification:
  entry = active[completed_name]   # {file, reviewer}
  Parse agent output → findings + LOOP_DIRECTIVE
  # Merge findings into per-file results (multiple reviewers contribute to same file)
  If results[entry.file] not exists: results[entry.file] = { findings: [], loop_directive: "COMPLETE" }
  # Tag findings with source reviewer for dedup
  for f in parsed_findings: f.source_reviewer = entry.reviewer
  results[entry.file].findings.push(...parsed_findings)
  If loop_directive == "APPLY_AND_RECHECK": results[entry.file].loop_directive = "APPLY_AND_RECHECK"

  # Deduplicate: when multiple reviewers flag same Q-ID + same line on same file,
  # keep the specialized reviewer (gas-code-review > code-reviewer, gas-ui-review > code-reviewer)
  seen = {}  # key: "Q{N}:{line}" → finding
  deduped = []
  REVIEWER_PRIORITY = { "gas-code-review": 2, "gas-ui-review": 2, "gas-gmail-cards": 2, "code-reviewer": 1 }
  for f in results[entry.file].findings:
    key = f.q_number + ":" + (f.line or "0")
    if key in seen:
      if REVIEWER_PRIORITY.get(f.source_reviewer, 0) > REVIEWER_PRIORITY.get(seen[key].source_reviewer, 0):
        deduped.remove(seen[key])
        deduped.append(f)
        seen[key] = f
    else:
      seen[key] = f
      deduped.append(f)
  results[entry.file].findings = deduped
  Remove from active
  completed += 1

  # Print progress inline
  status_icon = loop_directive == "COMPLETE" ? "●" : "◐"
  Print: "  [status_icon] [entry.file] → [entry.reviewer] — [status] ([Nc]C [Na]A) [elapsed]s   [{completed}/{total}]"

  # Refill: dispatch next from queue if slots available
  If queue non-empty AND len(active) < MAX_CONCURRENT:
    next_entry = queue.shift()
    name = sanitize(next_entry.file) + "--" + next_entry.reviewer
    Agent(
      subagent_type = next_entry.reviewer,
      name = name,
      run_in_background = true,
      prompt = reviewer_prompt(next_entry.file)
    )
    active[name] = next_entry

# All complete when: queue empty AND active empty
Print: "  fan-in ── ●[approved]  ◐[needs_work]   [{total_elapsed}s]"
```

**Fallback**: If background dispatch is unavailable, fall back to wave-based dispatch:
chunk files into waves of MAX_CONCURRENT, spawn all in single message, wait for wave, repeat.

### Finding Parser

Extract from reviewer output (code-reviewer, gas-code-review, gas-ui-review, or gas-gmail-cards):
```
For each "**Q[N]: [Title]** | Finding: [severity]" block:
  Extract: q_number, title, severity, description
  If Fix block present (Before/After code blocks): extract fix_block
  line = parsed line number if found in output, else 0   # enforce sentinel at origin
  Store: { q_number, severity, description, fix_block, file, line }

Extract LOOP_DIRECTIVE: APPLY_AND_RECHECK or COMPLETE
```

## Data Structures

Canonical field definitions for all structs referenced throughout Steps 3–7.
Use these as the single source of truth — do not invent aliases.

### Finding
```
{
  q_number:        string   # e.g. "Q12" — matches Q[N] in reviewer output
  title:           string   # short description from reviewer heading
  severity:        string   # "Critical" | "Advisory" (may be mutated to "advisory"
                            # by oscillation-forced-advisory logic in Step 4)
  description:     string   # full finding text from reviewer
  fix_block:       object | null  # { before: string, after: string } when Fix block present
  file:            string   # file path this finding belongs to
  line:            int   # line number; 0 when absent (enforced by Finding Parser)
  source_reviewer: string   # e.g. "code-reviewer", "gas-code-review" (set post-parse)
}
```

A **fix_task** is a Finding where `fix_block` is non-null. No separate type — fix_tasks
are filtered from `findings` and share all fields above.

### results[file]
```
{
  findings:       Finding[]  # deduplicated across all reviewers for this file
  loop_directive: string     # "COMPLETE" | "APPLY_AND_RECHECK"
}
```

### LOOP_DIRECTIVE values
- `APPLY_AND_RECHECK` — reviewer found actionable issues; fix and re-dispatch
- `COMPLETE` — reviewer found no issues (or only advisory with no fix blocks)

## Step 4: Fix Loop

```
# invocation-scoped state (reset per run, no disk persistence)
round_hashes = {}           # round → { file → sha256 of file content }
resolved_findings = {}      # file → set of (q_number, line) confirmed fixed by prior recheck
exhausted_no_fix = []       # files where all Fix blocks failed/skipped with no content change
exhausted_no_fix_q_ids = {} # file → [q_numbers] whose Fix blocks failed (for Step 7 feedback)
exhausted_no_fix_details = {} # file → [{q_number, old_string_preview}] captured at failure time
per_q_status_history = {}   # q_number → ["present"|"absent", ...] per round (oscillation detection)

# Compute initial hashes for all files before any fix is applied
round_hashes[0] = { file: sha256(Read(file)) for file in file_list }

round = 0
DO:
  round += 1
  per_file_failed_q_ids = {}   # file → [q_numbers] that failed this round's fix pass
  this_round_applied = {}      # file → set of (q_number, line) where Edit succeeded this round
  recheck_files = files where LOOP_DIRECTIVE == APPLY_AND_RECHECK

  IF recheck_files empty: BREAK (all clean)
  IF round > max_rounds: BREAK (exhausted)
  IF read_only: BREAK (report only mode)

  Print fix round banner:
  ```
  ┌──────────────────────────────────────────────────────┐
  │  Fix Round [round]/[max_rounds] — [count] files      │
  └──────────────────────────────────────────────────────┘
  ```

  For each recheck file:
    findings = current findings for this file
    fix_tasks = findings with Fix blocks, sorted: Critical first, then Advisory

    Print per-file fix progress:
    ```
      ┌ [filename]
      │  [i]/[N] ┌ [Q-ID] [title] — [first sentence of fix]
      │          └ ✓ applied | ✗ failed (old_string not found)
      ...
    ```

    failed_fix_q_ids_this_file = []
    For each fix_task:
      Apply via Edit tool:
        old_string = fix_task.fix_block.before (verbatim)
        new_string = fix_task.fix_block.after (verbatim)
      If Edit succeeds:
        record as applied, print ✓
        this_round_applied.setdefault(file, set()).add((fix_task.q_number, fix_task.line))
      If Edit fails (old_string not found):
        record as failed, print ✗
        failed_fix_q_ids_this_file.append(fix_task.q_number)
        # Capture preview of old_string that didn't match — enables Step 7 to surface
        # actionable Fix-block content, not just the Q-ID list.
        exhausted_no_fix_details.setdefault(file, []).append({
          "q_number": fix_task.q_number,
          "old_string_preview": "\n".join(fix_task.fix_block.before.splitlines()[:3])
        })

    per_file_failed_q_ids[file] = failed_fix_q_ids_this_file  # capture before next iteration
    Track: files_changed += file (if any fix applied)

  # Content-hash guard: skip recheck for files whose content is unchanged after fix attempts
  round_hashes[round] = { file: sha256(Read(file)) for file in recheck_files }
  actually_changed = [f for f in recheck_files if round_hashes[round][f] != round_hashes[round-1][f]]
  unchanged_recheck = [f for f in recheck_files if f not in actually_changed]
  For f in unchanged_recheck:
    results[f].loop_directive = "COMPLETE"
    exhausted_no_fix.append(f)
    exhausted_no_fix_q_ids[f] = per_file_failed_q_ids.get(f, [])  # per-file, not last-iteration
    Print: "  ◐ [f] — all fixes skipped/failed; marking exhausted (no recheck)"
  recheck_files = actually_changed

  Print fix summary:
  ```
  ──────────────────────────────────────────────────────
    [applied] applied   [skipped] skipped   [failed] failed   [len(unchanged_recheck)] exhausted-no-fix
    Re-dispatching [N] files for recheck...
  ```

  prev_findings_count = sum of all findings across recheck_files
```

> **MANDATORY RECHECK — do NOT skip this step.**
> Fixes are unverified until rechecked. A fix can introduce new issues or fail to
> resolve the original finding. You MUST re-dispatch reviewers for every file that
> had fixes applied, even if all edits succeeded. The loop terminates ONLY when
> reviewers return `LOOP_DIRECTIVE == COMPLETE` on a **recheck pass** — never after
> a fix-only pass. Skipping recheck is the single most common failure mode of this agent.

```
  Re-dispatch ALL applicable reviewers for recheck_files using the same
  producer-consumer pattern, resolve_reviewers(), and reviewer_prompt() as Step 3.
  # INTENTIONAL: rechecks use reviewer_prompt (full Q1-Q37), NOT a verification checklist.
  # Each round must discover NEW bugs introduced by fixes, not just verify prior findings.
  # recheck_model is null by default (sonnet). Set explicitly only as a conscious tradeoff.

  For each recheck (file, reviewer) pair:
    Agent(
      subagent_type = reviewer,
      model = recheck_model,        # null by default (inherits sonnet frontmatter)
      name = sanitize(file) + "--" + reviewer,
      run_in_background = true,
      prompt = reviewer_prompt(file)   # full Q1-Q37, same as initial review
    )

  Wait for ALL reviewer agents to complete before proceeding.

  # Cross-round finding dedup with explicit oscillation precedence
  For each recheck result (file, findings, loop_directive):
    # File-level invalidation: clear resolved_findings when content changed
    # (a fix elsewhere in the file can cause a prior finding's root cause to re-emerge)
    If round_hashes[round][file] != round_hashes[round-1][file]:
      resolved_findings[file] = set()

    new_findings = []
    For each finding f in findings:
      key = (f.q_number, f.line)
      # Order of precedence — evaluate in this order:
      If per_q_status_history[f.q_number] shows oscillation (pattern ["present","absent","present"]):
        f.severity = "advisory"   # oscillation-forced-advisory wins; keep finding
        new_findings.append(f)
      Elif key in resolved_findings.get(file, set()):
        pass   # confirmed resolved by prior recheck; drop duplicate
      Else:
        new_findings.append(f)

    Update results[file].findings = new_findings
    Update results[file].loop_directive = loop_directive

    # Record confirmed fixes into resolved_findings for future cross-round dedup
    # this_round_applied = set of (q_id, line) where Edit succeeded in the fix pass above
    If loop_directive == "COMPLETE":
      For each (q_id, line) in this_round_applied.get(file, set()):
        resolved_findings.setdefault(file, set()).add((q_id, line))

  # Populate per_q_status_history AFTER all recheck results are merged for this round.
  # Must run once per round (not per file) to avoid cross-file contamination: if Q12
  # appears in file A but not file B, processing file B inside the per-file loop would
  # append "absent" for Q12 in the same round that file A appended "present", producing
  # a spurious [present, absent] pattern that trips the [X,Y,X] oscillation check prematurely.
  round_present_q_ids = {f.q_number for file in recheck_files for f in results[file].findings}
  for q_id in round_present_q_ids:
    per_q_status_history.setdefault(q_id, []).append("present")
  for q_id in list(per_q_status_history):
    if q_id not in round_present_q_ids:
      per_q_status_history[q_id].append("absent")

  current_findings_count = sum of all findings across recheck_files

  Print round summary:
  ```
  ──────────────────────────────────────────────────────
    Round [round]/[max_rounds]  [━×N][╌×M]  [fixes] fixes   [[elapsed]s]
    Findings  [prev_findings_count] → [current_findings_count] (Δ[±N])
    Gates     [❌N critical | ✅]   [⚠️N advisory | ✅]
    [omit if 0:] Exhausted  [E] file(s) — no content change after fix attempts (see Recommendations)
  ──────────────────────────────────────────────────────
  ```
WHILE recheck_files non-empty AND round <= max_rounds
```

**Invariant**: If any fixes were applied in the final round but no recheck was performed,
the loop has a bug. Every round that applies fixes MUST end with a recheck pass before
the WHILE condition is evaluated. The round count in convergence output must reflect
recheck passes, not fix-only passes.

When fix loop exits (all COMPLETE or max rounds), print convergence:
```
╔══════════════════════════════════════════════╗
║  🏁 CONVERGED                              ║
╚══════════════════════════════════════════════╝
  Rounds    [round]/[max_rounds]
  Duration  [total_elapsed]s
  Fixes     [applied] applied, [skipped] skipped
```

## Step 5: Git Operations

Derive final_status from fix loop results:
```
If ALL files have loop_directive == "COMPLETE" AND no Critical findings remain:
  final_status = "APPROVED"
Else if max_rounds exhausted AND no Critical findings remain (only Advisory):
  final_status = "APPROVED_WITH_NOTES"
Else (any Critical findings remain, or max_rounds exhausted with Critical findings):
  final_status = "NEEDS_REVISION"
```

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

Pre-flight index check: before staging reviewed files, inspect the current index for entries NOT in the agent's reviewed file list:
```bash
git diff --cached --name-status
```
If any `R` (rename), `D` (delete), or `A` (add) entries exist that are not in `files_changed`:
- Collect them as `pre_staged_entries`
- Include them in the commit (do not unstage)
- Add a breadcrumb to the commit message: `Pre-staged entries from caller included: <list of paths>`

This preserves `git mv` / `git rm` operations staged by the caller before invoking review-fix, which would otherwise be silently dropped by per-file staging.

```
commit_mode == "commit": stage all target_files with changes (implementation + fixes) + include pre_staged_entries
commit_mode == "pr": stage only files_changed (fix corrections only) + include pre_staged_entries

git commit -m "review-fix: <task_name>: apply corrections ([N] critical, [M] advisory)
[If pre_staged_entries non-empty]: Pre-staged entries from caller: <list>

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

Print git operation badges:
```
━━━ GIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Staged [N] files
  ✓ Committed: [short message]
  ✓ Pushed to origin/[branch]        (pr mode only)
  ✓ PR created: [url]                (pr mode only)
  ✓ Squash merged to [default_branch] (pr mode only)
  ✓ Branch deleted                    (pr mode only)
```
Output `<!-- PR_MERGED -->` on success (pr mode) or `<!-- COMMITTED -->` (commit mode).

## Step 6: Report

Compute health_bar from overall status:
- APPROVED: `██████ ██████ ██████ ██████ ██████ ██████`
- APPROVED_WITH_NOTES: `██████ ██████ ██████ ██████ ░░░░░░ ░░░░░░`
- NEEDS_REVISION: `░░░░░░ ░░░░░░ ░░░░░░ ░░░░░░ ░░░░░░ ░░░░░░`

```
╔══════════════════════════════════════════════════════╗
║                                                      ║
║      [health_bar]       ║
║                                                      ║
║         review-fix Scorecard                          ║
║                                                      ║
║         Rating: [🟢 APPROVED | 🟡 WITH_NOTES | 🔴 NEEDS_REVISION]
║         [N] files [clean | with notes | need revision]║
║                                                      ║
╚══════════════════════════════════════════════════════╝

  Per-File Status
  ─────────────────────────────────────
    [✅|⚠️|❌]  [filename]              [status] [(fixed RN) if fixed]
    [only when findings > 0:]
      ├─ Q[n] [title] — [critical|advisory] [applied|failed|no-fix-block]
      └─ Q[m] [title] — [advisory] [applied]
    [cap at 5 findings; if more: "  … +N more"]
    [clean files: one-liner only, no finding list]

  Summary
  ─────────────────────────────────────
    Files     [N] reviewed
    Rounds    [R]
    Fixes     [F] applied, [S] skipped
    Duration  [T]s

  Recommendations                         ← omit block entirely if both lists empty
  ─────────────────────────────────────

  [only if missing_linters non-empty:]
  ▸ Install (for future runs)
      [label]: [install_hint]              # copy-paste ready
      ...

  [only if exhausted_no_fix non-empty:]
  ▸ Manual fixes needed (automatic fix failed)
      [file] — [N] finding(s)
        Q[n] [title] — see Step 4 output
      ...

  Review History                          ← omit if only 1 round
  ─────────────────────────────────────────────
  Round │ Files │ Fixes │ Critical │ Advisory │ Time
  ──────┼───────┼───────┼──────────┼──────────┼──────
  [per round row]
  ──────┴───────┴───────┴──────────┴──────────┴──────
  Total: [R] rounds   [F] fixes   [T]s
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
- Were any files marked exhausted-no-fix? If yes: for each exhausted file, list each failed
  Fix block with its Q-ID and the first 3 lines of the old_string that didn't match current
  content. Example output:
    exhausted_no_fix in foo.ts:
      Q12 — old_string mismatch:
        ```
        const val = computeOld(
          a, b
        ```
      Q24 — old_string mismatch:
        ```
        cache.push(item)
        ```
  This allows the Fix block template for these questions to be hardened against this file's
  actual content pattern.

Print 0-3 recommendations if signals fire. Otherwise: "No prompt improvements identified."
```

This creates a learning loop — each review run surfaces whether the Q1-Q37 framework or the orchestration should evolve.

Cleanup: remove any temp files.
