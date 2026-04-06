---
name: review-fix
description: |
  Iterative review-fix loop with Inspect→Plan→Fix architecture: dispatches parallel cluster-based
  reviewer Tasks per file (safety, intent, integration, ecosystem clusters), decomposes findings
  into discrete tasks via deterministic parsing + LLM execution planner, then fans out fixer Tasks
  by wave (parallel within wave, respecting cross-file dependencies). Advisory/YAGNI skipped;
  loops per-file until clean (max 5 rounds), then commits and optionally creates a PR
  (commit_mode="pr" default: commit + push + PR + squash merge + delete branch;
  commit_mode="commit": commit only). Supports optional plan_summary parameter for
  intent-aligned review. Git fallback uses cascading priority (WIP → last commit) when target_files is empty.
  Cluster-based parallelism: PHASE A dispatches domain clusters (safety, intent, integration,
  ecosystem) per file with incremental re-review backlog — only re-runs clusters affected by
  fixes. max_clusters_per_file parameter caps cluster Tasks per file (default 4, range [1,4]).
  Round 1 skips Inspect (uses Phase 2 output), enters at Plan. Rounds 2+ run full
  Inspect→Plan→Fix cycle with cluster dispatch.
  **AUTOMATICALLY INVOKE** after implementing features, fixing bugs, before committing,
  or after plan implementation completes (user approves + all changes made).
  **STRONGLY RECOMMENDED** before merging to main, after refactoring,
  and when code-reviewer returns NEEDS_REVISION.
  Trigger phrases: "review and fix", "polish this", "clean this up", "make sure this is
  good", "before committing", "before merging", "loop until clean".
color: orange
---

⚠️  **BREAKING CHANGE (v2.0)**: Git fallback uses **cascading priority** (uncommitted/staged → last commit).
Accumulated multi-commit review is removed. WIP always takes priority — stash to review past commits.
Run review-fix after each commit, or provide `target_files` explicitly for multi-file review.

You are the Review-Fix team lead. You orchestrate a review → fix → re-review loop until
all fixable findings are resolved, then produce a structured summary. Critical findings
auto-fix when a Fix block exists; Advisory findings WITH a Fix block are **auto-applied**
in Phase 3 (same round as Critical) — counted toward `fixes_applied_per_file`;
`Advisory/Functional` findings (functional bugs) are treated as Critical-equivalent;
Advisory/YAGNI is skipped; Advisory without a Fix block records as stuck
and surfaces for human review.

Phase 3 uses an **Inspect → Plan → Fix** architecture with cluster-based parallelism:
- **Inspect**: dispatch domain clusters (safety, intent, integration, ecosystem) per file, consolidate by Q-number, filter. Incremental re-review backlog skips clusters unaffected by fixes.
- **Plan**: deterministic task decomposition (`decompose_findings`) + LLM execution planner (dependency graph, waves)
- **Fix**: fan out fixer Tasks by wave (parallel within wave, respecting cross-file dependencies)

Round 1 skips Inspect (uses Phase 2 output) and enters directly at Plan. Rounds 2+ run the full cycle.

```
Flow: Setup & Triage → Initial Review ──────────────────────────────► Summary → Git Ops
                                       ↑                             ↑
                           Round-based loop (Inspect → Plan → Fix):  │
                           Inspect: dispatch clusters → consolidate  │
                           Plan: decompose → planner → wave schedule │
                           Fix: execute waves → aggregate results    │
                           → filter clean → repeat ─────────────────┘
```

## Input Contract

- `target_files="$1"` — optional; comma-separated file paths. If omitted, cascading fallback: reviews **uncommitted/staged** if present, otherwise **last commit (HEAD)**. WIP takes priority.
  - Examples:
    - Auto (WIP): `review-fix()` → reviews uncommitted/staged files
    - Auto (clean): `review-fix()` → reviews last commit
    - Explicit: `review-fix(target_files="src/auth.ts,src/server.ts")`
- `task_name="$2"` — required; review context identifier
- `worktree="${3:-.}"` — required; absolute path to working directory
- `max_rounds="${4:-5}"` — optional; maximum fix-and-re-review rounds (default: 5)
- `review_mode="${5:-full}"` — optional; passed through to code-reviewer unchanged
- `commit_mode="${6:-pr}"` — optional; one of:
  - `"pr"` (default) — stage + commit + push + create PR + squash merge + delete branch + checkout default branch
  - `"commit"` — stage + commit only (for POST_IMPLEMENT pipeline, which handles PR separately)
- `plan_summary="${7:-}"` — optional; context string describing the plan intent; injected into reviewer prompts to enable intent-alignment evaluation
- `max_clusters_per_file="${8:-4}"` — optional; max cluster Tasks per file per round (default: 4, range [1, 4])

**Pre-flight**: If `task_name` is empty, stop and report:
`Missing required parameters: task_name=[value]`

**Git Fallback (Cascading: WIP → Last Commit)**: If `target_files` is empty or unset after pre-flight:

```
Step 1 — Check for work-in-progress:
  uncommitted = git -C "${worktree}" diff --name-only HEAD 2>/dev/null
  staged = git -C "${worktree}" diff --cached --name-only 2>/dev/null
  work_in_progress = union(uncommitted, staged), deduplicate

Step 2 — Decision cascade:
  Case A: Work-in-progress exists (uncommitted OR staged)
    target_files = work_in_progress
    rationale = "work-in-progress"
    Print: "  → Reviewing uncommitted changes:"
    Print: "    - Unstaged: N files"
    Print: "    - Staged: M files"

  Case B: Working tree clean, check last commit
    last_commit_files = git -C "${worktree}" diff --name-only HEAD~1..HEAD 2>/dev/null

    Error handling:
    - If command fails (exit non-zero): check git status
      - Try: git -C "${worktree}" log --oneline -1
      - If succeeds but diff failed: error "Cannot diff initial commit. Provide target_files explicitly."
      - If log fails (no commits): error "No commits exist. Make changes or commit, then run review-fix."

    if last_commit_files is empty:
      Error: "No changes to review. Working tree clean and last commit has no file changes.

      Options:
      - Make changes and run review-fix again
      - Or provide target_files explicitly: review-fix(target_files='path/to/file.ts')"
      Stop execution.

    target_files = last_commit_files
    rationale = "last-commit"
    commit_msg = first line of git log -1 --pretty=%s
    Print: "  → Reviewing last commit (HEAD): ${commit_msg}"

Step 3 — Filter and validate:
  - Exclude .json/.lock files: filter target_files by extension
  - Verify each file exists on disk (warn about missing)
  - Result: file_list (valid files to review)

  If file_list is empty after filtering:
    if rationale == "work-in-progress":
      Error: "No reviewable files in working tree (only .json/.lock files changed)"
    else:
      Error: "No reviewable files in last commit (only .json/.lock files changed)"
    Stop execution.

Step 4 — Capture per-file diffs (focus guide for reviewers):
  per_file_diffs = {}
  for each file in file_list:
    if rationale == "work-in-progress":
      diff = git -C "${worktree}" diff HEAD -- "${file}" 2>/dev/null
      if diff is empty:
        diff = git -C "${worktree}" diff --cached -- "${file}" 2>/dev/null
    else:
      diff = git -C "${worktree}" diff HEAD~1..HEAD -- "${file}" 2>/dev/null
    if diff is non-empty:
      per_file_diffs[file] = diff
  Print: "  → Captured diffs for ${Object.keys(per_file_diffs).length}/${file_list.length} file(s)"

Rationale: Adapts to user's workflow — reviews WIP when developing, reviews commits
when committing. Never mixes contexts. Clear feedback about what's being reviewed.
WIP always takes priority over commits (stash to review old commits).
```

**Argument Validation**: After Git Fallback resolves `target_files`, validate all parameters:

```javascript
// Parse target_files into file_list (consumed by Phase 1 — no re-parse needed)
file_list = target_files.split(',').map(f => f.trim()).filter(f => f.length > 0)

// Clamp max_rounds to [1, 10]; NaN → 5, 0 → 1
const parsed_rounds = parseInt(max_rounds)
max_rounds = Math.max(1, Math.min(10, Number.isNaN(parsed_rounds) ? 5 : parsed_rounds))

// Clamp max_clusters_per_file to [1, 4]; NaN → 4, 0 → 1
const parsed_clusters = parseInt(max_clusters_per_file)
max_clusters_per_file = Math.max(1, Math.min(4, Number.isNaN(parsed_clusters) ? 4 : parsed_clusters))

commit_mode = (commit_mode || '').toLowerCase()
if (!['pr', 'commit'].includes(commit_mode)) {
  print: `Warning: Invalid commit_mode="${commit_mode}" — defaulting to "pr"`
  commit_mode = 'pr'
}

if (worktree !== '.' && !directoryExists(worktree)) {
  print: `Error: worktree="${worktree}" does not exist`; stop
}

const missing_files = file_list.filter(f => !fileExists(resolve(worktree, f)))
if (missing_files.length > 0) {
  print: `Warning: Files not found (will be skipped): ${missing_files.join(', ')}`
  file_list = file_list.filter(f => fileExists(resolve(worktree, f)))
}
if (file_list.length === 0) {
  print: "No valid files to review."; stop
}
```

## State Tracking

Maintain these values across all phases:

```
round = 0           # global round counter for round-based parallel loop
critical_resolved = []     # { file, line, q_number, description }
advisory_applied = []      # { file, line, q_number, description } — Advisory WITH Fix block applied in Phase 3
fix_failures = []       # { file, line, q_number, description } — Fix block could not be applied (critical or advisory)
stuck_findings = []        # Critical unresolved (no Fix block OR max_rounds reached)
advisory_stuck = []        # { file, line, q_number, description } — Advisory, no Fix block
advisory_yagni = []        # { file, line, title, description } — Advisory/YAGNI: never auto-applied
introduced_by_fix = []     # { file, line, q_number, description, introduced_in_round } — new Criticals not in prior round
files_changed = []
files_needing_fixes = []   # populated in Phase 2: files with NEEDS_REVISION or APPROVED_WITH_NOTES
current_findings = {}      # { file: <latest review output> } — updated after each review/re-review
per_file_rounds = {}       # { file: round_count } — for max_rounds enforcement per file
reviewer_counts = []       # (deprecated — retained for backward compat; cluster_stats preferred)
impact_files = {}           # { file: [list of referencing files] } — populated by Step 1c Impact Discovery
final_status = 'pending'
total_start_time = Date.now()        # set at Phase 1 start
round_start_time = null              # set at start of each round
round_durations = []                 # populated at end of each round
per_round_phase_timings = []         # [{ inspect: N, plan: N, fix: N }] — one entry per round, milliseconds; used by Round History table in summary
# NOTE: failed_tasks is a per-round Set — declared inside the loop, not at state level
cluster_backlog = {}    # { file: { cluster_id: { status, round, q_numbers_affected } } }
                        # status: 'pending' | 'clean' | 'has_findings' | 'skipped'
cluster_stats = []      # { round, clusters_dispatched, clusters_skipped, clusters_memoized } — for summary telemetry
findings_counts_per_round = []   # [{critical: N, functional: N, advisory: N, yagni: N, total: N}]
memo_milestones_printed = new Set()  # {25, 50, 75}
phase_timings = {}      # { inspect: N, plan: N, fix: N } — reset per round, milliseconds
per_q_history = {}      # { file: { q_number: [round_numbers_where_finding_present] } }
                        # Tracks per-Q-number finding presence across rounds for oscillation detection.
                        # A Q-number that appears in rounds [1, 3] (present, absent, present) is oscillating.
per_file_diffs = {}     # { file: git_diff_string } — captured during git fallback Step 4; passed to Phase 2 reviewers as change_context
round_diffs = {}        # { file: fix_diff_string } — captured per round: snapshot before fixer, diff after; passed to Phase 3A cluster evaluators as fix_context
```

## Behavioral Invariants

*These rules apply to all phases.*

**The review loop (Phases 2–4) proceeds without user input.** Teardown is automatic. Phase 5
behavior is controlled by `commit_mode`: `"pr"` (default) checks whether the current branch is
the default branch (creating a temp branch if so), then stages, commits, pushes, creates a PR,
squash-merges to the default branch, deletes the feature branch, and outputs `PR_MERGED`;
`"commit"` stages and commits only, outputting `COMMITTED`. The calling agent acts on the marker.
**`commit_mode="pr"` assumes the current branch is ready to merge — it auto-merges and deletes
the branch irreversibly.**

**Critical** findings auto-fix when a Fix block exists.
**Advisory/Functional** findings are functional bugs (wrong output, data loss, schema mismatch)
that deserve auto-fix treatment. WITH a Fix block: auto-applied same as Critical. WITHOUT a Fix
block: routed to `stuck_findings[]` (Critical-equivalent), producing `NEEDS_REVISION`.
**Advisory** findings WITH a Fix block are **auto-applied in Phase 3** — applied by fixer Tasks in
the same round as Critical fixes, counted toward `fixes_applied_per_file`.
`Advisory/YAGNI` findings are never auto-applied — they are recorded in `advisory_yagni[]`
and surfaced in the summary only. Advisory without a Fix block records in `advisory_stuck[]`
(never invented), producing `APPROVED_WITH_NOTES`.

`advisory_applied[]` (WITH Fix block, applied) and `advisory_stuck[]` (WITHOUT Fix block) are
**mutually exclusive** per finding — each Advisory finding is appended to exactly one
array, never both. The presence or absence of a Fix block is the sole routing criterion.

**Fix source is code-reviewer's Fix block only — do not generate alternatives.** Absent or ambiguous → stuck.

**Max rounds prevents infinite loops.** A fix that introduces a new Critical is detected
and looped (up to max_rounds). After max_rounds, stuck findings are surfaced — not silently
dropped.

**Team lead holds Edit permissions; reviewer Tasks are read-only.** Fixer Tasks apply edits; team lead aggregates results from fixer Task JSON output.

## Concurrency Invariants

1. **Phase A:** Each cluster Task writes to `${file_slug}_cluster_${cluster.id}.md`. `slug_map` guarantees collision-free slugs (e.g., `foo-bar.ts` vs `foo_bar.ts` get distinct slugs). No shared output paths.
2. **Backlog:** Every `(file, cluster)` starts `pending`, shrinks only via memoization or skip. No silent drops.
3. **Memo safety:** Cluster memoized only when its Q-numbers don't overlap with round's applied fixes. Re-activated on fixer failure in same file.

---

## Phase 1: Setup & Triage

### Step 1a: Mode Selection

Count distinct files (file_list already parsed and validated in Argument Validation):

```
file_count = file_list.length
```

**Threshold:**
- `file_count == 1`         → **single-agent mode** (direct Task call, no overhead)
- `file_count >= 2`         → **parallel-task mode** (Promise.all Task() calls, no TeamCreate)

### Step 1b: Reviewer Mapping (Project Context Detection)

Build a per-file reviewer mapping. Instead of AI-based classification, detect the project
ecosystem by walking the directory tree for marker files (`appsscript.json` / `.clasp.json`
for GAS, `package.json` for Node). `.gs` files always map to GAS (extension fallback).
Walk stops at `$HOME` to avoid stray global markers. Template `appsscript.json` inside
Node projects (co-located with `package.json`/`tsconfig.json`) is detected and skipped.

```javascript
// Project context detection — walk up to 8 parent directories for marker files.
// Priority: closest marker wins. Stop at $HOME to avoid stray package.json false positives.
// Fallback: .gs extension → gas (covers mcp_gas-managed repos lacking appsscript.json).
const project_context_cache = {}
const HOME = process.env.HOME || '/Users/' + process.env.USER
function detect_project_context(file_path) {
  let dir = dirname(file_path)
  if (project_context_cache[dir]) return project_context_cache[dir]

  // Fallback: .gs files are always GAS regardless of directory markers
  if (file_path.endsWith('.gs')) {
    project_context_cache[dir] = 'gas'; return 'gas'
  }

  let current = dir
  for (let i = 0; i < 8; i++) {
    // Stop at HOME boundary — markers above HOME are stray/global, not project-specific
    if (current === HOME) break
    if (exists(join(current, 'appsscript.json')) || exists(join(current, '.clasp.json'))) {
      // Guard: skip template appsscript.json inside Node projects (e.g., mcp_gas/src/)
      // If same dir also has package.json or tsconfig.json, prefer node
      if (exists(join(current, 'package.json')) || exists(join(current, 'tsconfig.json'))) {
        project_context_cache[dir] = 'node'; return 'node'
      }
      project_context_cache[dir] = 'gas'; return 'gas'
    }
    if (exists(join(current, 'package.json'))) {
      project_context_cache[dir] = 'node'; return 'node'
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  project_context_cache[dir] = 'unknown'; return 'unknown'
}

// Build reviewer_map: file → subagent_type (single pass)
// Note: reviewer_map maps each file to ONE primary reviewer.
// For .gs files with CardService patterns, gas-gmail-cards is chosen as primary;
// gas-code-review coverage for those files requires a separate manual pass (see note below).
reviewer_map = {}
cardservice_files = []  // tracked for Phase 4 summary warning

// Process .gs files first so their extension-based GAS detection populates the cache
// before .html files in the same directory call detect_project_context.
const sorted_file_list = [...file_list].sort((a, b) => {
  const aGs = a.endsWith('.gs') ? 0 : 1
  const bGs = b.endsWith('.gs') ? 0 : 1
  return aGs - bGs
})

for (const file of sorted_file_list) {
  const ext = file.split('.').pop()
  const context = detect_project_context(file)

  if (ext === 'gs') {
    // Triage: detect CardService patterns to route to gas-gmail-cards
    const gsContent = readFile(file)
    const hasCardService = gsContent.match(
      /CardService|buildContextualCard|buildHomepageCard|GmailApp\.setCurrentMessageAccessToken|setOnClickAction|pushCard|popCard|updateCard/
    )
    if (hasCardService) {
      reviewer_map[file] = 'gas-gmail-cards'
      cardservice_files.push(file)
    } else {
      reviewer_map[file] = 'gas-code-review'
    }
  }
  else if (ext === 'html') {
    reviewer_map[file] = (context === 'gas') ? 'gas-ui-review' : 'code-reviewer'
  }
  else {
    reviewer_map[file] = 'code-reviewer'
  }
}
```

**CardService note:** `.gs` files routed to `gas-gmail-cards` receive specialized Gmail add-on validation (card structure, action handlers, Gmail integration, state, navigation, security). General GAS code quality (`gas-code-review`) is not run in the automated loop for these files. For full dual coverage of CardService files, run `/gas-review` separately after this loop completes.

### Step 1c: Impact Discovery

After target files and reviewer mapping are determined, discover files that REFERENCE changed code.
These become `related_files` context (NOT additional `target_files` — we warn about breakage, we don't fix other people's code).

```
Impact discovery runs sequentially across target files (single-threaded accumulation).
Global cap of 30 total impact files is checked after each file's results are appended.

For each file in file_list (stop if total_impact_count >= 30):

  1. Get file changes based on rationale:
     If rationale == "work-in-progress":
       Use Read tool to get current file content (WIP review uses working tree, not a diff)
     Else (rationale == "last-commit"):
       Use Bash tool: `git diff HEAD~1..HEAD -- ${file}`
       If empty (new file): use Read tool to get file content.
     If file > 500KB: skip impact discovery for this file, log warning.

  2. Extract exported/public symbol names from added lines (+ lines in diff):
     - JS/TS: `export function/const/class NAME`, `module.exports.NAME`, `exports.NAME`
     - GAS: top-level `function NAME` declarations (all public in GAS)
     - Skip symbols with 2 or fewer characters (too generic). Cap at 20 symbols per file.
     If no symbols found: skip to next file.

  3. Use Grep tool: search for symbol references across the codebase.
     Pattern: symbols joined by `|` (alternation).
     Exclude: node_modules, .git, *.lock, *.json, dist, build, coverage.
     Limit: 10 matching files per source file.
     If Grep tool fails or rg unavailable: skip impact discovery for this file, log warning.

  4. Filter results: remove files already in file_list (no self-references).
     Append remaining to impact_files[file]. Enforce global cap of 30 total impact files.
```

### Phase 1 Print: Setup Banner

```
Print:
╔════════════════════════════════════════╗
║  review-fix — [task_name]              ║
║  Files: [N] | Mode: [mode] | Max: [R]r ║
╚════════════════════════════════════════╝
  [filename]  → [reviewer_type]          (one line per file)
```

Example:
```
╔════════════════════════════════════════╗
║  review-fix — deploy refactor          ║
║  Files: 3 | Mode: parallel | Max: 5r   ║
╚════════════════════════════════════════╝
  Utils.gs           → gas-code-review
  src/main.ts        → code-reviewer
  Sidebar.html       → gas-ui-review
```

If CardService files detected, append:
```
  ⚠️ CardService: [filename] → gas-gmail-cards (dual coverage note applies)
```

If `impact_files` is non-empty, append:
```
  Impact discovery: [total_impact_count] file(s) reference changed symbols
    [source_file] → [impact_files[source_file].length] referencing file(s)
      → [referencing_file]                               (one line per referencing file)
```

---

## Phase 2: Initial Review

### Reviewer Prompt Template

Define once, used by both single-agent and parallel-task modes:

```javascript
// Reviewer prompt template (used by both single-agent and parallel-task modes)
const reviewer_prompt = (file) => {
  const file_impacts = impact_files[file] || []
  const related = file_impacts.length > 0 ? file_impacts.join(',') : 'auto'

  return `Review this file:
target_files="${file}"
task_name="${task_name}"
worktree="${worktree}"
dryrun=false
related_files="${related}"
review_mode="${review_mode}"
${plan_summary ? `\nPlan context (use to evaluate intent alignment):\n${plan_summary}` : ''}
${per_file_diffs[file] ? `
**Change context** (focus your review on these changes and their surrounding context):
\`\`\`diff
${per_file_diffs[file]}
\`\`\`
` : ''}
${file_impacts.length > 0 ? `
**Impact context**: The following files reference symbols changed in ${file}.
Check Q11 (backward compatibility) against these actual callers:
${file_impacts.map(f => '- ' + f).join('\n')}` : ''}

Output your full review markdown starting with "## Code Review:".
Do NOT use SendMessage — your output is collected directly by the calling agent.`
}
```

### Single-Agent Mode (1 file)

Launch one Task call directly:

```javascript
const review_start = Date.now()
Task({
  subagent_type: reviewer_map[file_list[0]] || 'code-reviewer',
  description: "Review file for Critical findings",
  prompt: reviewer_prompt(file_list[0])
});
const review_elapsed = ((Date.now() - review_start) / 1000).toFixed(1)
print: "  ✓ 1 review completed in [review_elapsed]s"
```

Collect full output. Parse for Critical findings, Advisory findings, Advisory/YAGNI findings, Status, and LOOP_DIRECTIVE.
Store output: `current_findings[file_list[0]] = <full review output>`

- `APPROVED` → Phase 4
- `NEEDS_REVISION` → add file to `files_needing_fixes`; Phase 3
- `APPROVED_WITH_NOTES` → add file to `files_needing_fixes`; Phase 3 (advisory fixes applied in loop)
- Advisory/YAGNI-only (no Critical, no non-YAGNI Advisory) → Phase 4 (APPROVED)

### Parallel-Task Mode (2+ files)

Launch all reviewers in a **single message** as parallel Task calls. No TeamCreate — outputs are
collected from return values directly. Scales to any file count.

```javascript
// Spawn reviewers in batches of MAX_CONCURRENT_TASKS:
const MAX_CONCURRENT_TASKS = 4
const review_start = Date.now()
let results = []

// Chunk file_list into batches
for (let i = 0; i < file_list.length; i += MAX_CONCURRENT_TASKS) {
  const batch = file_list.slice(i, i + MAX_CONCURRENT_TASKS)
  try {
    const batch_results = await Promise.all(batch.map(file =>
      Task({
        subagent_type: reviewer_map[file] || 'code-reviewer',
        description: `Review ${file}`,
        prompt: reviewer_prompt(file)
      })
    ))
    results = results.concat(batch_results)
  } catch (err) {
    print: "  ⚠️ Reviewer batch failed: ${err.message}"
    results = results.concat(batch.map(() => null))
  }
}
const review_elapsed = ((Date.now() - review_start) / 1000).toFixed(1)
print: "  ✓ [file_list.length] review(s) completed in [review_elapsed]s"
```

Collect outputs. Parse each file's result for Critical findings, Advisory findings, Advisory/YAGNI findings, Status, and LOOP_DIRECTIVE.
For each file: `current_findings[file] = <full review output for that file>`
Then print receipts and decision via the "Phase 2 Print: Reviewer Receipts (All Modes)" section below.

- All files `APPROVED` → Phase 4
- Any `NEEDS_REVISION` → add that file to `files_needing_fixes`; Phase 3
- Any `APPROVED_WITH_NOTES` → add that file to `files_needing_fixes`; Phase 3 (advisory fixes applied in loop)
- Advisory/YAGNI-only across all files (no Critical, no non-YAGNI Advisory) → Phase 4 (APPROVED)

### Phase 2 Print: Reviewer Receipts (All Modes)

```
Print: "━━━ REVIEW ━━━━━━━━━━━━━━━━━━━━━━━━"
Print: "🔍 Initial Review"
```

Sort files: NEEDS_REVISION first, then APPROVED_WITH_NOTES, then APPROVED.
Use tree connectors: `┌` first, `├` middle, `└` last. Single file: `└` only.
Right-pad filename with `─` to align reviewer type column.

```
Print: "  ┌ [filename] ──── [reviewer_type] ── ❌ ✗[N] 💡[M]"       (NEEDS_REVISION: N critical, M advisory; omit counts if 0)
Print: "  ├ [filename] ──── [reviewer_type] ── ✅ 💡[N] (notes)"     (APPROVED_WITH_NOTES: N advisory)
Print: "  └ [filename] ──── [reviewer_type] ── ✅"                    (APPROVED)
Print: "  └ [filename] ──── [reviewer_type] ── ⚠️ timeout"           (Review Incomplete)
```

Single-file case: use `└` only (no `┌` or `├`):
```
Print: "  └ [filename] ──── [reviewer_type] ── [status]"
```

Example (3 files):
```
  ┌ Utils.gs ──────── gas-code-review ── ❌ ✗[2] 💡[1]
  ├ Main.ts ───────── code-reviewer ──── ✅ 💡[1] (notes)
  └ Sidebar.html ──── gas-ui-review ──── ✅
```

After all receipts, print decision:
```
Print: ""
Print: "✅ All files clean — skipping to summary."         (if files_needing_fixes.length == 0)
Print: "[N] file(s) need fixes — entering fix loop."    (if files_needing_fixes.length > 0)
```

### Phase 2 Post-Processing: Backlog Initialization

After Phase 2 collects `current_findings` for all files, build the initial `cluster_backlog`:

```javascript
// Build initial cluster backlog from Phase 2 results
// Uses NON_CODE_EXTENSIONS and CLUSTERS defined in Cluster Infrastructure section below.

for (const file of files_needing_fixes) {
  const findings = parse_findings(current_findings[file])
  const q_numbers_with_findings = new Set(findings.map(f => f.q_number).filter(Boolean))
  const ext = file.split('.').pop().toLowerCase()
  const is_non_code = NON_CODE_EXTENSIONS.has(ext)

  cluster_backlog[file] = {}
  for (const cluster of CLUSTERS) {
    // Non-code files: only intent cluster runs
    if (is_non_code && cluster.id !== 'intent') {
      cluster_backlog[file][cluster.id] = { status: 'skipped', round: 0, q_numbers_affected: [] }
      continue
    }
    const cluster_qs = cluster.questions.map(q => q.id)
    const affected = cluster_qs.some(q => q_numbers_with_findings.has(q))
    cluster_backlog[file][cluster.id] = {
      status: affected ? 'has_findings' : 'clean',
      round: 0,
      q_numbers_affected: cluster_qs.filter(q => q_numbers_with_findings.has(q))
    }
  }
}
```

---

## Phase 3: Fix Loop (Inspect → Plan → Fix)

Process all files needing fixes in **global rounds**. Each round cycles through three phases:
**Inspect** (dispatch cluster evaluators, consolidate, filter) → **Plan** (deterministic task decomposition +
LLM execution planner) → **Fix** (fan out fixer Tasks by wave, aggregate results).

Round 1 is special: Phase 2 already produced `current_findings[file]`, so round 1 skips
PHASE A (Inspect) and enters directly at PHASE B (Plan). Rounds 2+ run the full A→B→C cycle.

**Cluster-based parallelism**: PHASE A dispatches domain clusters (safety, intent, integration,
ecosystem) per file, each as an independent Task. Conditional clusters (integration, ecosystem)
activate only when trigger patterns appear in the file. Incremental re-review backlog tracks
cluster status — only clusters affected by fixes are re-run. Capped at `max_clusters_per_file`.

```
remaining_files = files_needing_fixes (copy)
Initialize per_file_rounds[file] = 0 for each remaining file.

# --- Dedup Guard ---
# Before appending any entry to a tracking array (critical_resolved, advisory_applied,
# advisory_stuck, stuck_findings, fix_failures, advisory_yagni, etc.), compute a dedup key:
#   key = "${entry.file}:${entry.q_number or entry.title or ''}:${entry.description}"
# If this key was already seen for the target array: skip (do not append).
# Otherwise: mark as seen, then append the entry.
# This prevents duplicate findings from accumulating across multiple reviewer outputs.
```

### Global Fix Loop

**LOOP STRUCTURE**: Each round has 3 mandatory phases (A→B→C). Round 1 skips PHASE A.
After PHASE C, control returns to the WHILE condition. The loop exits ONLY when
`remaining_files` is empty or `round >= max_rounds`.

```
print: "━━━ FIX LOOP ━━━━━━━━━━━━━━━━━━━━━━"

// Create shared temp dir for this run's cluster/reviewer outputs (persists across all rounds)
const REVIEW_TMPDIR = Bash(`mktemp -d /tmp/review-fix-XXXXXX`)
print: "  📂 Temp dir: ${REVIEW_TMPDIR}"

// round counter — equals per_file_rounds[f] for all active files
TRY:
WHILE remaining_files.length > 0 AND round < max_rounds:
  round += 1
  round_start_time = Date.now()

  // Concurrency cap — applies to both cluster dispatch (PHASE A) and fixer dispatch (PHASE C)
  const MAX_CONCURRENT_TASKS = 4

  // Create round subdirectory for this round's temp files
  Bash(`mkdir -p ${REVIEW_TMPDIR}/round_${round}`)

  // Increment per-file rounds (sequential bookkeeping, fast)
  for each file in remaining_files:
    per_file_rounds[file] += 1

  print: "🔧 Round [▓ × round + ░ × (max_rounds - round)] [round/max_rounds]: [remaining_files.length] file(s), planning..."

  fixes_applied_per_file = {}
  const round_applied_q_numbers = {}  // { file: Set<q_number> } — per-round only
  for each file in remaining_files:
    fixes_applied_per_file[file] = 0
    round_applied_q_numbers[file] = new Set()

  // Track failed tasks within this round (reset each round)
  const failed_tasks = new Set()

  // ═══ PHASE A: Inspect — cluster-based dispatch + consolidate + filter ═══
  // Round 1 skips PHASE A entirely — uses Phase 2's current_findings[file] output.
  // Rounds 2+ dispatch domain clusters (safety, intent, integration, ecosystem) per file.
  // Each cluster is an independent Task evaluating its subset of Q-questions.
  // Incremental re-review: only clusters affected by prior-round fixes are re-run.

  phase_timings = { inspect: 0, plan: 0, fix: 0 }
  const inspect_start = Date.now()

  if (round > 1) {
    // 1. Determine active clusters per file (respect backlog + trigger patterns)
    const cluster_task_specs = []
    const per_file_plans = {}
    let round_clusters_dispatched = 0
    let round_clusters_skipped = 0

    // Collision-safe slug map: compute all slugs upfront, disambiguate collisions
    const slug_map = {}  // file path → unique slug
    const slugs_used = new Set()
    for (const file of remaining_files) {
      let slug = file.replace(/[^a-zA-Z0-9]/g, '_')
      if (slugs_used.has(slug)) {
        let n = 2
        while (slugs_used.has(`${slug}_${n}`)) n++
        slug = `${slug}_${n}`
      }
      slugs_used.add(slug)
      slug_map[file] = slug
    }

    for (const file of remaining_files) {
      const file_slug = slug_map[file]
      const ext = file.split('.').pop().toLowerCase()
      const is_non_code = NON_CODE_EXTENSIONS.has(ext)

      // Guard: initialize backlog for files not seen in Phase 2 (e.g., added mid-loop)
      if (!cluster_backlog[file]) {
        cluster_backlog[file] = {}
        for (const cluster of CLUSTERS) {
          cluster_backlog[file][cluster.id] = { status: 'pending', round: 0, q_numbers_affected: [] }
        }
      }

      // Determine which clusters to dispatch for this file
      const file_content = Read(file)
      const active_clusters = get_active_clusters(file, file_content, is_non_code, cluster_backlog[file])
      const active_cluster_ids = active_clusters.map(c => c.id)
      const skipped_cluster_ids = CLUSTERS.filter(c => !active_cluster_ids.includes(c.id)).map(c => c.id)

      // Cap at max_clusters_per_file
      const capped_clusters = active_clusters.slice(0, max_clusters_per_file)
      const overflow = active_clusters.length - capped_clusters.length

      // Build Task specs for each active cluster
      for (const cluster of capped_clusters) {
        cluster_task_specs.push({ file, file_slug, cluster, is_recheck: cluster_backlog[file][cluster.id].status !== 'pending' })
        round_clusters_dispatched++
      }
      round_clusters_skipped += skipped_cluster_ids.length + overflow

      // Store per-file cluster plan for printing after total is computed
      const recheck_ids = capped_clusters
        .filter(c => cluster_backlog[file][c.id].status === 'has_findings')
        .map(c => c.id)
      const recheck_note = recheck_ids.length > 0 ? `, re-check: ${recheck_ids.join(', ')}` : ''
      const skip_note = skipped_cluster_ids.length > 0 ? `, ${skipped_cluster_ids.join(', ')} skipped` : ''
      per_file_plans[file] = `    → ${file}: ${capped_clusters.map(c => c.id).join(', ')} (${capped_clusters.length} cluster(s)${skip_note}${recheck_note})`
    }

    // Print dispatch total first, then per-file details (matches Phase 3 Print Format spec)
    print: "  ↗ Dispatching ${round_clusters_dispatched} cluster task(s) across ${remaining_files.length} file(s)..."
    for (const file of remaining_files) {
      if (per_file_plans[file]) print: per_file_plans[file]
    }

    // 2. Dispatch all cluster Tasks in parallel (batched by MAX_CONCURRENT_TASKS)
    const cluster_batch_size = Math.min(MAX_CONCURRENT_TASKS, cluster_task_specs.length)
    const cluster_batches = []
    for (let i = 0; i < cluster_task_specs.length; i += cluster_batch_size) {
      cluster_batches.push(cluster_task_specs.slice(i, i + cluster_batch_size))
    }

    const cluster_start = Date.now()
    let cluster_results = []
    for (const batch of cluster_batches) {
      const batch_results = await Promise.all(batch.map(({ file, file_slug, cluster, is_recheck }) =>
        Task({
          subagent_type: 'general-purpose',
          description: `Cluster ${cluster.id} review ${file} round ${per_file_rounds[file]}`,
          prompt: CLUSTER_PROMPT(cluster.id, cluster.questions, file, {
            plan_summary,
            impact_files: impact_files[file] || [],
            is_recheck,
            round: per_file_rounds[file],
            worktree,
            review_mode,
            task_name,
            fix_context: round_diffs[file] || null,
            output_path: `${REVIEW_TMPDIR}/round_${round}/${file_slug}_cluster_${cluster.id}.md`
          })
        }).catch(() => null)
      )).catch(err => {
        print: "  ⚠️ Cluster batch failed: ${err.message}"
        return batch.map(() => null)
      })
      cluster_results = cluster_results.concat(
        batch_results.map((result, idx) => ({ ...batch[idx], result }))
      )
    }
    const cluster_elapsed = ((Date.now() - cluster_start) / 1000).toFixed(1)
    const cluster_ok = cluster_results.filter(r => r.result !== null).length
    const cluster_failed = cluster_results.filter(r => r.result === null).length
    print: "  ✓ ${cluster_ok} cluster(s) completed, ${cluster_failed} failed in ${cluster_elapsed}s"

    // Record cluster stats for telemetry (including memoized count)
    const round_clusters_memoized = remaining_files.reduce((sum, file) => {
      if (!cluster_backlog[file]) return sum
      return sum + CLUSTERS.filter(c =>
        cluster_backlog[file][c.id]?.status === 'clean'
      ).length
    }, 0)
    cluster_stats.push({ round, clusters_dispatched: round_clusters_dispatched, clusters_skipped: round_clusters_skipped, clusters_memoized: round_clusters_memoized })

    // Cluster receipt grid — cluster-centric view of dispatch results
    print: "  ┌─ Cluster Receipt Grid ─────────────────"
    for (let ci = 0; ci < CLUSTERS.length; ci++) {
      const cluster = CLUSTERS[ci]
      const connector = ci === CLUSTERS.length - 1 ? '└' : '├'
      const cluster_files = cluster_results.filter(r => r.cluster.id === cluster.id)
      const memoized_files = remaining_files.filter(f =>
        cluster_backlog[f]?.[cluster.id]?.status === 'clean'
      )
      if (memoized_files.length > 0 && cluster_files.length === 0) {
        const since_round = Math.min(...memoized_files.map(f => cluster_backlog[f][cluster.id].round))
        print: "  ${connector} ${cluster.id} ── ⊘ memoized (clean since r${since_round})"
      } else if (cluster_files.length > 0) {
        const file_summaries = cluster_files.map(r => {
          const findings_count = r.result ? parse_findings(Read(`${REVIEW_TMPDIR}/round_${round}/${r.file_slug}_cluster_${cluster.id}.md`) || '').length : 0
          return `${r.file} ✗${findings_count}`
        }).join(', ')
        print: "  ${connector} ${cluster.id} ──── ● ${file_summaries}  [${cluster_elapsed}s]"
      } else {
        print: "  ${connector} ${cluster.id} ── ○ skipped"
      }
    }

    // 3. Reconcile cluster outputs per file — collect temp files + consolidate
    for (const file of remaining_files) {
      const file_slug = slug_map[file]
      const review_files = Glob(`${REVIEW_TMPDIR}/round_${round}/${file_slug}_cluster_*.md`)

      if (review_files.length == 0) {
        print: "    ⚠️ ${file}: no cluster output files — all clusters failed to write (current_findings unchanged)"
      }

      if (review_files.length == 1) {
        const review_content = Read(review_files[0])
        introduced_by_fix.push(...detect_introduced_by_fix(file, review_content, current_findings[file], round))
        current_findings[file] = review_content
        const next_findings = parse_findings(review_content)
        print: "    📊 ${file}: 1 cluster → ${next_findings.length} findings"

      } else if (review_files.length > 1) {
        const reviews = review_files.map(f => Read(f))
        const total_before = reviews.flatMap(r => parse_findings(r)).length
        const consolidated = consolidate_findings(reviews)
        introduced_by_fix.push(...detect_introduced_by_fix(file, consolidated, current_findings[file], round))
        current_findings[file] = consolidated
        const next_findings = parse_findings(consolidated)
        const dupes_merged = total_before - next_findings.length
        print: "    📊 ${file}: ${reviews.length} clusters → ${next_findings.length} unique findings (${dupes_merged} duplicates merged)"
      }

      // Post-reconciliation: write consolidated file + TODO list + update backlog
      if (review_files.length > 0) {
        const consolidated_path = `${REVIEW_TMPDIR}/round_${round}/${file_slug}_consolidated.md`
        Write(consolidated_path, current_findings[file])
        print: "    📋 ${consolidated_path}"

        const next_findings = parse_findings(current_findings[file])
        if (next_findings.length > 0) {
          print: "    📌 Next round TODO for ${file}:"
          for (const f of next_findings) {
            const fix_tag = f.fix_block ? '🔧' : '⚠️'
            print: "      ${fix_tag} ${f.q_number || '—'} ${f.severity}: ${f.description.slice(0, 80)}"
          }
        }

        // Update cluster_backlog per cluster based on findings
        const q_numbers_with_findings = new Set(next_findings.map(f => f.q_number).filter(Boolean))
        for (const cluster of CLUSTERS) {
          if (cluster_backlog[file][cluster.id]?.status === 'skipped') continue
          const cluster_qs = cluster.questions.map(q => q.id)
          const has_findings = cluster_qs.some(q => q_numbers_with_findings.has(q))
          cluster_backlog[file][cluster.id] = {
            status: has_findings ? 'has_findings' : 'clean',
            round,
            q_numbers_affected: has_findings ? cluster_qs.filter(q => q_numbers_with_findings.has(q)) : []
          }
        }

        // Print backlog status
        const backlog_parts = CLUSTERS
          .filter(c => cluster_backlog[file][c.id]?.status !== 'skipped')
          .map(c => {
            const bl = cluster_backlog[file][c.id]
            if (bl.status === 'clean') return `${c.id}=clean`
            const count = bl.q_numbers_affected.length
            return `${c.id}=${count} finding(s)`
          })
        print: "    📊 ${file}: ${backlog_parts.join(', ')}"
      }
    }

    // Filter: files with 0 actionable findings exit as clean
    const files_clean_after_inspect = []
    for (const file of remaining_files) {
      const findings = parse_findings(current_findings[file])
      const actionable = findings.filter(f => f.severity !== 'Advisory/YAGNI' && f.fix_block)
      if (actionable.length === 0) {
        files_clean_after_inspect.push(file)
        // Route non-actionable findings to tracking arrays
        for (const f of findings) {
          if (f.severity === 'Advisory/YAGNI') {
            append { file, ...f } to advisory_yagni (apply dedup guard)
          } else if (!f.fix_block && f.severity === 'Advisory') {
            append { file, ...f } to advisory_stuck (apply dedup guard)
          } else if (!f.fix_block && (f.severity === 'Critical' || f.severity === 'Advisory/Functional')) {
            append { file, ...f } to stuck_findings (apply dedup guard)
          }
        }
        print: "  → [file] — no actionable findings — done"
      }
    }
    for (const file of files_clean_after_inspect) {
      print: "  ✅ [file] — clean after [per_file_rounds[file]] round(s)"
    }
    remaining_files = remaining_files.filter(f => !files_clean_after_inspect.includes(f))

    // Max-rounds ejection: files at per_file_rounds[file] >= max_rounds ejected
    const files_over_limit = remaining_files.filter(f => per_file_rounds[f] >= max_rounds)
    for (const file of files_over_limit) {
      const unresolved = parse_findings(current_findings[file])
      unresolved.filter(c => c.severity === 'Critical' || c.severity === 'Advisory/Functional').forEach(c => {
        append { file, ...c } to stuck_findings (apply dedup guard)
      })
      unresolved.filter(a => a.severity === 'Advisory' && !a.fix_block).forEach(a => {
        append { file, ...a } to advisory_stuck (apply dedup guard)
      })
      print: "  ⚠️ [file] — max rounds reached — [N] finding(s) stuck"
    }
    remaining_files = remaining_files.filter(f => per_file_rounds[f] < max_rounds)

    if (remaining_files.length === 0) break
  }
  // (end of PHASE A — round 1 falls through to PHASE B with Phase 2's current_findings)
  phase_timings.inspect = Date.now() - inspect_start

  const plan_phase_start = Date.now()
  // ═══ PHASE B: Plan — deterministic task decomposition + LLM execution planner ═══
  // Stage 1 (deterministic): decompose current_findings into discrete tasks
  const { tasks, skipped } = decompose_findings(remaining_files, current_findings)

  // Route skipped findings to tracking arrays immediately
  for (const s of skipped) {
    if (s.reason === 'YAGNI') {
      append { file: s.file, q_number: s.q_number, severity: s.severity } to advisory_yagni (apply dedup guard)
    } else if (s.reason === 'no_fix_block' && s.severity === 'advisory') {
      append { file: s.file, q_number: s.q_number, severity: s.severity } to advisory_stuck (apply dedup guard)
    } else if (s.reason === 'no_fix_block' && (s.severity === 'critical' || s.severity === 'advisory/functional')) {
      append { file: s.file, q_number: s.q_number, severity: s.severity } to stuck_findings (apply dedup guard)
    } else if (s.reason === 'malformed_fix_block') {
      // Fix block present but unparseable — record in fix_failures regardless of severity
      append { file: s.file, q_number: s.q_number, description: 'Fix block present but malformed (no before/after code blocks)' } to fix_failures (apply dedup guard)
    }
  }

  print: "  📐 Decompose: ${tasks.length} tasks, ${skipped.length} skipped (deterministic)"

  if (tasks.length === 0) {
    // No actionable tasks — all findings are YAGNI, stuck, or no fix block
    for (const file of remaining_files) {
      print: "  → [file] — no actionable tasks — done"
    }
    break
  }

  // Stage 2 (LLM): execution planner — dependency graph + wave assignment
  // Same-file safety: Phase C groups tasks by file (one fixer per file per wave) — no pre-check needed.
  // LLM planner handles cross-file deps; fallback (all wave 0) is safe (correctness preserved).
  const files_with_tasks = new Set(tasks.map(t => t.file))
  const task_ids_set = new Set(tasks.map(t => t.task_id))

  print: "  📐 Planner: analyzing ${tasks.length} tasks across ${files_with_tasks.size} file(s) for parallel dispatch..."

  let plan = null
  const planner_start = Date.now()
  try {
    const planner_output = await Task({
      subagent_type: "general-purpose",
      description: `Plan execution for ${tasks.length} tasks across ${files_with_tasks.size} file(s)`,
      prompt: PLANNER_PROMPT(tasks, round)
    })

    // Parse planner output — extract JSON from response
    const json_match = planner_output.match(/\{[\s\S]*\}/)
    if (!json_match) throw new Error('No JSON found in planner output')
    plan = JSON.parse(json_match[0])
    validate_plan(plan, task_ids_set)

    // Merge planner output (dependency edges + waves) into deterministic task list
    const planner_map = {}
    for (const pt of plan.tasks) {
      planner_map[pt.task_id] = pt
    }
    for (const task of tasks) {
      const pt = planner_map[task.task_id]
      if (pt) {
        task.depends_on = pt.depends_on || []
        task.wave = pt.wave
      } else {
        task.depends_on = []
        task.wave = 0
      }
    }

    const dep_count = plan.tasks.filter(t => (t.depends_on || []).length > 0).length
    const planner_elapsed = ((Date.now() - planner_start) / 1000).toFixed(1)
    if (dep_count > 0) {
      print: "  ✓ Plan: ${tasks.length} tasks in ${plan.wave_count} wave(s) — ${dep_count} dependency(ies) found (${planner_elapsed}s)"
    } else {
      print: "  ✓ Plan: ${tasks.length} tasks in ${plan.wave_count} wave(s) — all independent (${planner_elapsed}s)"
    }

  } catch (err) {
    // Fallback: all tasks assigned to wave 0, no dependencies
    const planner_elapsed = ((Date.now() - planner_start) / 1000).toFixed(1)
    print: "  ⚠️ Planner failed (${err.message}) — fallback: all tasks in wave 0 (${planner_elapsed}s)"
    for (const task of tasks) {
      task.depends_on = []
      task.wave = 0
    }
    plan = {
      tasks: tasks.map(t => ({ task_id: t.task_id, depends_on: [], wave: 0 })),
      waves: [{ wave: 0, task_ids: tasks.map(t => t.task_id) }],
      wave_count: 1,
    }
  }
  plan.skipped = skipped

  // Build waves from task list (authoritative — overrides planner's waves array)
  const wave_groups = {}
  for (const task of tasks) {
    if (!wave_groups[task.wave]) wave_groups[task.wave] = []
    wave_groups[task.wave].push(task)
  }
  const wave_numbers = Object.keys(wave_groups).map(Number).sort((a, b) => a - b)

  phase_timings.plan = Date.now() - plan_phase_start
  const fix_phase_start = Date.now()

  // ═══ PHASE C: Fix — execute tasks by wave ═══
  // Fan out fixer Tasks per wave. Within each wave, group tasks by file and dispatch
  // one fixer Task per file (parallel, batched by MAX_CONCURRENT_TASKS).
  // Each fixer receives an ordered list of discrete tasks (not a raw blob).

  for (const wave_num of wave_numbers) {
    const wave_tasks = wave_groups[wave_num]

    // Check dependency failures: if a task's depends_on includes a failed task → mark blocked
    const executable_tasks = []
    for (const task of wave_tasks) {
      const blocked_deps = (task.depends_on || []).filter(dep => failed_tasks.has(dep))
      if (blocked_deps.length > 0) {
        failed_tasks.add(task.task_id)
        append { file: task.file, q_number: task.q_number, description: task.description, reason: `dependency_failed: ${blocked_deps.join(',')}` } to fix_failures (apply dedup guard)
        continue
      }
      executable_tasks.push(task)
    }

    // Group executable tasks by file
    const tasks_by_file = {}
    for (const task of executable_tasks) {
      if (!tasks_by_file[task.file]) tasks_by_file[task.file] = []
      tasks_by_file[task.file].push(task)
    }

    const file_keys = Object.keys(tasks_by_file)
    const total_tasks_in_wave = executable_tasks.length
    print: "  ⚡ Wave ${wave_num}: ${total_tasks_in_wave} task(s) across ${file_keys.length} file(s)..."
    for (const file of file_keys) {
      const file_task_ids = tasks_by_file[file].map(t => t.task_id).join(', ')
      print: "    → Fix ${file} (${tasks_by_file[file].length} tasks: ${file_task_ids})"
    }

    // Snapshot file content before fixer runs (for fix_context diff generation)
    const pre_fix_snapshots = {}
    for (const file of file_keys) {
      try { pre_fix_snapshots[file] = Read(file) } catch (e) { /* file may not exist yet */ }
    }

    // Dispatch one fixer Task per file in this wave (parallel, batched)
    const fixer_start = Date.now()
    let wave_results = []

    for (let i = 0; i < file_keys.length; i += MAX_CONCURRENT_TASKS) {
      const batch = file_keys.slice(i, i + MAX_CONCURRENT_TASKS)
      try {
        const batch_results = await Promise.all(batch.map(file =>
          Task({
            subagent_type: "general-purpose",
            description: `Fix ${file} wave ${wave_num} (round ${per_file_rounds[file]})`,
            prompt: FIXER_PROMPT_V2(file, tasks_by_file[file])
          }).catch(() => ({
            file,
            task_results: tasks_by_file[file].map(t => ({ task_id: t.task_id, status: "failed", reason: "timeout" }))
          }))
        ))
        wave_results = wave_results.concat(batch_results)
      } catch (err) {
        print: "  ⚠️ Fixer batch failed: ${err.message}"
        wave_results = wave_results.concat(batch.map(file => ({
          file,
          task_results: tasks_by_file[file].map(t => ({ task_id: t.task_id, status: "failed", reason: "batch_error" }))
        })))
      }
    }
    const fixer_elapsed = ((Date.now() - fixer_start) / 1000).toFixed(1)

    // Aggregate per-task results from this wave
    let wave_applied = 0, wave_failed = 0, wave_blocked = 0
    for (const result of wave_results) {
      const file = result.file

      // Parse JSON from fixer output (may be raw string or already parsed)
      let task_results = []
      if (typeof result === 'string') {
        try {
          const json_match = result.match(/\{[\s\S]*\}/)
          if (json_match) task_results = JSON.parse(json_match[0]).task_results || []
        } catch (e) { /* parse failure — all tasks failed */ }
      } else {
        task_results = result.task_results || []
      }

      for (const tr of task_results) {
        // Look up original task for metadata
        const original_task = tasks.find(t => t.task_id === tr.task_id)
        if (!original_task) continue

        if (tr.status === 'applied') {
          wave_applied++
          fixes_applied_per_file[file] = (fixes_applied_per_file[file] || 0) + 1
          round_applied_q_numbers[file]?.add(original_task.q_number)
          if (original_task.severity === 'critical' || original_task.severity === 'advisory/functional') {
            append { file, q_number: original_task.q_number, description: original_task.description, type: original_task.severity } to critical_resolved (apply dedup guard)
          } else {
            append { file, q_number: original_task.q_number, description: original_task.description, type: 'advisory' } to advisory_applied (apply dedup guard)
          }
          if (!files_changed.includes(file)) files_changed.push(file)
        } else if (tr.status === 'blocked') {
          wave_blocked++
          failed_tasks.add(tr.task_id)
          append { file, q_number: original_task.q_number, description: original_task.description, reason: tr.reason || 'dependency_failed' } to fix_failures (apply dedup guard)
        } else {
          // failed
          wave_failed++
          failed_tasks.add(tr.task_id)
          append { file, q_number: original_task.q_number, description: original_task.description, reason: tr.reason || 'unknown' } to fix_failures (apply dedup guard)
        }
      }
    }

    print: "  ✓ Wave ${wave_num}: ${wave_applied} applied, ${wave_failed} failed${wave_blocked > 0 ? `, ${wave_blocked} blocked` : ''} (${fixer_elapsed}s)"

    // Compute per-file fix diffs (post-fix vs pre-fix snapshot) for fix_context in next round
    for (const file of file_keys) {
      if (!pre_fix_snapshots[file]) continue
      try {
        const post_fix_content = Read(file)
        if (post_fix_content !== pre_fix_snapshots[file]) {
          // Simple line-based diff: show changed regions with context
          const pre_lines = pre_fix_snapshots[file].split('\n')
          const post_lines = post_fix_content.split('\n')
          // NOTE: This index-based comparison produces noisy diffs when fixes add/remove lines
          // (all subsequent lines shift). Cap output to prevent excessive token consumption.
          const MAX_DIFF_LINES = 100
          const diff_lines = []
          for (let l = 0; l < Math.max(pre_lines.length, post_lines.length); l++) {
            if (diff_lines.length >= MAX_DIFF_LINES) {
              diff_lines.push(`... (truncated, ${Math.max(pre_lines.length, post_lines.length) - l} more lines differ)`)
              break
            }
            if (pre_lines[l] !== post_lines[l]) {
              // Add 3 lines of context before
              const ctx_start = Math.max(0, l - 3)
              if (diff_lines.length === 0 || diff_lines[diff_lines.length - 1] !== '...') {
                for (let c = ctx_start; c < l; c++) {
                  diff_lines.push(` ${pre_lines[c] || ''}`)
                }
              }
              if (l < pre_lines.length) diff_lines.push(`-${pre_lines[l]}`)
              if (l < post_lines.length) diff_lines.push(`+${post_lines[l]}`)
              // Add 3 lines of context after
              for (let c = l + 1; c <= Math.min(l + 3, post_lines.length - 1); c++) {
                diff_lines.push(` ${post_lines[c]}`)
              }
              diff_lines.push('...')
            }
          }
          if (diff_lines.length > 0) {
            round_diffs[file] = diff_lines.join('\n')
          }
        }
      } catch (e) { /* graceful degradation — no fix_context for this file */ }
    }
  }
  // (end of wave loop)

  // ═══ POST-FIX VERIFICATION GATE ═══
  // Lightweight Haiku-based verification of each applied fix. Catches self-rubber-stamping
  // and false positive findings before the next re-review round. Runs per-file, batched.
  // Each verification checks TWO things: (a) does the fix resolve the stated issue?
  // (b) was the original finding legitimate (could original code have been correct)?
  const VERIFY_AGGREGATE_TIMEOUT = 120000  // 120s total for all verifications this round
  const verify_start = Date.now()
  let verifications_run = 0, verifications_passed = 0, verifications_failed = 0, verifications_false_positive = 0

  // Collect applied fixes from this round for verification
  const fixes_to_verify = []
  for (const result of wave_results) {
    const file = result.file
    let task_results = []
    if (typeof result === 'string') {
      try { const json_match = result.match(/\{[\s\S]*\}/); if (json_match) task_results = JSON.parse(json_match[0]).task_results || [] } catch (e) {}
    } else { task_results = result.task_results || [] }

    for (const tr of task_results) {
      if (tr.status !== 'applied') continue
      const original_task = tasks.find(t => t.task_id === tr.task_id)
      if (!original_task) continue
      fixes_to_verify.push({ file, task_id: tr.task_id, q_number: original_task.q_number, description: original_task.description, fix_block: original_task.fix_block })
    }
  }

  if (fixes_to_verify.length > 0) {
    print: "  🔍 Verifying ${fixes_to_verify.length} applied fix(es)..."

    // Create verification subdirectory for this round's results
    Bash(`mkdir -p ${REVIEW_TMPDIR}/round_${round}/verify`)

    // Batch verify (MAX_CONCURRENT_TASKS at a time, with aggregate timeout)
    // Each verifier writes its verdict to a temp file; orchestrator reads after batch completes.
    for (let i = 0; i < fixes_to_verify.length && (Date.now() - verify_start) < VERIFY_AGGREGATE_TIMEOUT; i += MAX_CONCURRENT_TASKS) {
      const batch = fixes_to_verify.slice(i, i + MAX_CONCURRENT_TASKS)
      try {
        await Promise.all(batch.map(fix =>
          Task({
            subagent_type: "general-purpose",
            model: "haiku",
            description: `Verify fix ${fix.task_id} for ${fix.q_number}`,
            prompt: `You are a fix verifier. Evaluate whether this code fix is correct and whether the original finding was legitimate.

## Finding
${fix.q_number}: ${fix.description}

## Code Before Fix
\`\`\`
${fix.fix_block.before}
\`\`\`

## Code After Fix
\`\`\`
${fix.fix_block.after}
\`\`\`

Answer TWO questions:
1. Does the modification resolve the stated issue without introducing new problems?
2. Is the original finding legitimate — could the original code have been correct as-is?

Write ONLY one of these verdicts to the output file (no other text):
PASS — fix resolves the issue, finding was legitimate
FAIL — fix does not resolve the issue or introduces new problems
FALSE_POSITIVE — the original finding was not a real issue; original code was correct

Write your verdict using Bash:
  echo 'VERDICT_HERE' > '${REVIEW_TMPDIR}/round_${round}/verify/${fix.task_id}.txt'`
          }).catch(() => {
            // Write timeout sentinel on task failure
            Bash(`echo 'TIMEOUT' > '${REVIEW_TMPDIR}/round_${round}/verify/${fix.task_id}.txt'`)
          })
        ))

        // Read verdicts from temp files (single pass after batch completes)
        const batch_results = batch.map(fix => {
          try {
            return Read(`${REVIEW_TMPDIR}/round_${round}/verify/${fix.task_id}.txt`).trim()
          } catch (e) { return 'TIMEOUT' }
        })

        for (let j = 0; j < batch.length; j++) {
          verifications_run++
          const raw = batch_results[j] || ''
          const verdict = raw.split('\n')[0].toUpperCase()
          const fix = batch[j]
          if (verdict.startsWith('PASS')) {
            verifications_passed++
          } else if (verdict.startsWith('FALSE_POSITIVE')) {
            verifications_false_positive++
            // Drop the finding — do not re-review this Q-number for this file
            // Remove from critical_resolved (it wasn't a real fix) and advisory_applied
            // NOTE: The file edit for this fix remains on disk. Reverting edits is not attempted
            // because the "after" code may be equally valid — the issue is that the finding was
            // spurious, not that the fix is harmful. The next re-review round will evaluate the
            // current file state on its merits.
            critical_resolved = critical_resolved.filter(cr => !(cr.file === fix.file && cr.q_number === fix.q_number))
            advisory_applied = advisory_applied.filter(aa => !(aa.file === fix.file && aa.q_number === fix.q_number))
            // Also decrement fixes_applied count — false positive fix should not keep file in loop
            fixes_applied_per_file[fix.file] = Math.max(0, (fixes_applied_per_file[fix.file] || 0) - 1)
            print: "    ⊘ ${fix.task_id} (${fix.q_number}) — false positive, finding dropped"
          } else {
            // FAIL or TIMEOUT — route to stuck_findings, do not count as resolved
            verifications_failed++
            // Revert: remove from resolved/applied tracking
            critical_resolved = critical_resolved.filter(cr => !(cr.file === fix.file && cr.q_number === fix.q_number))
            advisory_applied = advisory_applied.filter(aa => !(aa.file === fix.file && aa.q_number === fix.q_number))
            append { file: fix.file, q_number: fix.q_number, description: fix.description, reason: verdict.startsWith('FAIL') ? 'verification_failed' : 'verification_timeout' } to stuck_findings (apply dedup guard)
            print: "    ✗ ${fix.task_id} (${fix.q_number}) — ${verdict.startsWith('FAIL') ? 'fix rejected' : 'verification timeout'}"
          }
        }
      } catch (err) {
        // Batch-level failure — treat all as unverified
        for (const fix of batch) {
          verifications_run++
          verifications_failed++
          append { file: fix.file, q_number: fix.q_number, description: fix.description, reason: 'verification_error' } to stuck_findings (apply dedup guard)
        }
        print: "  ⚠️ Verification batch failed: ${err.message}"
      }
    }
    const verify_elapsed = ((Date.now() - verify_start) / 1000).toFixed(1)
    print: "  ✓ Verified: ${verifications_passed} pass, ${verifications_failed} fail, ${verifications_false_positive} false-positive (${verify_elapsed}s)"
  }

  // ═══ END OF ROUND — compute duration, file exit prints, per-round status grid ═══
  phase_timings.fix = Date.now() - fix_phase_start
  round_durations.push(Date.now() - round_start_time)
  const round_elapsed = (round_durations[round_durations.length - 1] / 1000).toFixed(1)
  per_round_phase_timings.push({ inspect: phase_timings.inspect, plan: phase_timings.plan, fix: phase_timings.fix })

  // Snapshot findings counts for this round (used by delta/health/summary)
  const round_findings = { critical: 0, functional: 0, advisory: 0, yagni: 0, total: 0 }
  for (const file of remaining_files) {
    const findings = parse_findings(current_findings[file])
    for (const f of findings) {
      if (f.severity === 'Critical') round_findings.critical++
      else if (f.severity === 'Advisory/Functional') round_findings.functional++
      else if (f.severity === 'Advisory') round_findings.advisory++
      else if (f.severity === 'Advisory/YAGNI') round_findings.yagni++
    }
  }
  round_findings.total = round_findings.critical + round_findings.functional + round_findings.advisory + round_findings.yagni
  findings_counts_per_round.push(round_findings)

  // Files with 0 fixes applied this round exit (nothing changed → done)
  // Route remaining findings to tracking arrays so they are not silently lost.
  // This mirrors the routing logic in files_clean_after_inspect (PHASE A filter).
  const files_clean_this_round = remaining_files.filter(f => (fixes_applied_per_file[f] || 0) === 0)
  for (const file of files_clean_this_round) {
    const findings = parse_findings(current_findings[file])
    for (const f of findings) {
      if (f.severity === 'Advisory/YAGNI') {
        append { file, ...f } to advisory_yagni (apply dedup guard)
      } else if (!f.fix_block && f.severity === 'Advisory') {
        append { file, ...f } to advisory_stuck (apply dedup guard)
      } else if (!f.fix_block && (f.severity === 'Critical' || f.severity === 'Advisory/Functional')) {
        append { file, ...f } to stuck_findings (apply dedup guard)
      } else if (f.fix_block && (f.severity === 'Critical' || f.severity === 'Advisory/Functional')) {
        // Fix block existed but fixer failed to apply it — route to fix_failures
        append { file, ...f, reason: 'fix_not_applied_this_round' } to fix_failures (apply dedup guard)
      }
    }
    print: "  → [file] nothing changed — done"
  }

  remaining_files = remaining_files.filter(f => (fixes_applied_per_file[f] || 0) > 0)

  // File exit prints
  for (const file of files_clean_this_round) {
    print: "  ✅ [file] — clean after [per_file_rounds[file]] round(s)"
  }

  // Per-round status grid — all files that participated this round
  const all_round_files = [...files_clean_this_round, ...remaining_files]
  const inspect_s = (phase_timings.inspect / 1000).toFixed(1)
  const plan_s = (phase_timings.plan / 1000).toFixed(1)
  const fix_s = (phase_timings.fix / 1000).toFixed(1)
  print: "  Round [round]:  [round_elapsed]s  (inspect: ${inspect_s}s  plan: ${plan_s}s  fix: ${fix_s}s)"
  for (let i = 0; i < all_round_files.length; i++) {
    const file = all_round_files[i]
    const connector = all_round_files.length === 1 ? '└' : i === 0 ? '┌' : i === all_round_files.length - 1 ? '└' : '├'
    const padded = file + ' ─'.repeat(Math.max(1, 20 - file.length))
    if (files_clean_this_round.includes(file)) {
      print: "  ${connector} ${padded} ✅ clean (${per_file_rounds[file]} round(s))"
    } else {
      print: "  ${connector} ${padded} 🔄 continuing"
    }
  }

  // Delta visualization — between-round finding count changes
  const file_count = remaining_files.length + files_clean_this_round.length
  if (findings_counts_per_round.length === 1) {
    print: "  snapshot ── ✗${round_findings.total} findings across ${file_count} file(s)"
  } else {
    const prev = findings_counts_per_round[findings_counts_per_round.length - 2]
    const delta = round_findings.total - prev.total
    const delta_str = delta < 0 ? `↓${Math.abs(delta)}` : delta > 0 ? `↑${delta}` : '→0'
    print: "  delta ── ✗${prev.total}→${round_findings.total} (${delta_str})"
  }
  if (findings_counts_per_round.length >= 3) {
    const trend_values = findings_counts_per_round.map(r => r.total).join(' → ')
    const last3 = findings_counts_per_round.slice(-3)
    const trend_arrow = last3[last3.length - 1].total < last3[0].total ? '↘ converging'
      : last3[last3.length - 1].total > last3[0].total ? '↗ oscillating' : '→ flat'
    print: "  trend ── ${trend_values}  ${trend_arrow}"
  }

  // Severity health bar — compact at-a-glance breakdown
  if (findings_counts_per_round.length === 1) {
    print: "  health ── 🔴 ${round_findings.critical} critical  🟠 ${round_findings.functional} functional  🟡 ${round_findings.advisory} advisory  💡 ${round_findings.yagni} yagni"
  } else {
    const prev = findings_counts_per_round[findings_counts_per_round.length - 2]
    const c_delta = round_findings.critical - prev.critical
    const fn_delta = round_findings.functional - prev.functional
    const a_delta = round_findings.advisory - prev.advisory
    const c_dir = c_delta < 0 ? `↓${Math.abs(c_delta)}` : c_delta > 0 ? `↑${c_delta}` : '→0'
    const fn_dir = fn_delta < 0 ? `↓${Math.abs(fn_delta)}` : fn_delta > 0 ? `↑${fn_delta}` : '→0'
    const a_dir = a_delta < 0 ? `↓${Math.abs(a_delta)}` : a_delta > 0 ? `↑${a_delta}` : '→0'
    print: "  health ── 🔴 ${prev.critical}→${round_findings.critical} (${c_dir})  🟠 ${prev.functional}→${round_findings.functional} (${fn_dir})  🟡 ${prev.advisory}→${round_findings.advisory} (${a_dir})  💡 ${round_findings.yagni} yagni"
  }

  // remaining_files still has entries with fixes_applied > 0 → next round (back to PHASE A: Inspect)

  // ═══ PER-Q OSCILLATION DETECTION ═══
  // Track which Q-numbers have findings each round. Detect oscillation: a Q-number
  // that appears, resolves, and reappears (present in rounds N, absent in N+1, present in N+2)
  // indicates the fix for that Q creates a condition that re-triggers the same Q.
  // This is distinct from progressive discovery (new Q-numbers appearing).
  for (const file of remaining_files) {
    if (!per_q_history[file]) per_q_history[file] = {}
    const findings = parse_findings(current_findings[file])
    const active_qs = new Set(findings.map(f => f.q_number).filter(Boolean))
    for (const q of active_qs) {
      if (!per_q_history[file][q]) per_q_history[file][q] = []
      per_q_history[file][q].push(round)
    }
  }

  // Check for per-Q oscillation (requires 3+ rounds of history for a file)
  const files_oscillating = []
  for (const file of remaining_files) {
    if (!per_q_history[file] || per_file_rounds[file] < 3) continue
    for (const [q, rounds_present] of Object.entries(per_q_history[file])) {
      // Oscillation: Q present in round N, absent in N+1, present in N+2
      // Detect by checking if there are gaps in the rounds_present array
      if (rounds_present.length >= 2) {
        const last = rounds_present[rounds_present.length - 1]
        const prev = rounds_present[rounds_present.length - 2]
        // If Q was present, then absent for at least 1 round, then present again
        if (last === round && (last - prev) >= 2) {
          files_oscillating.push({ file, q_number: q, pattern: rounds_present })
          break  // one oscillating Q is enough to eject the file
        }
      }
    }
  }

  // Eject oscillating files
  for (const { file, q_number, pattern } of files_oscillating) {
    const unresolved = parse_findings(current_findings[file])
    unresolved.filter(c => c.severity === 'Critical' || c.severity === 'Advisory/Functional').forEach(c => {
      append { file, ...c } to stuck_findings (apply dedup guard)
    })
    unresolved.filter(a => a.severity === 'Advisory' && !a.fix_block).forEach(a => {
      append { file, ...a } to advisory_stuck (apply dedup guard)
    })
    print: "  ⚠️ ${file} — oscillating on ${q_number} (rounds: ${pattern.join('→')}) — ejected"
  }
  const oscillating_file_set = new Set(files_oscillating.map(f => f.file))
  remaining_files = remaining_files.filter(f => !oscillating_file_set.has(f))

  // ═══ INCREMENTAL RE-REVIEW: update cluster_backlog based on applied fixes ═══
  // Determine which clusters need re-inspection in the next round based on which
  // Q-numbers had fixes applied this round. Clean clusters with no related fixes are memoized.
  // Cross-cluster invalidation: when a fix to Q-X in cluster A affects Q-Y in cluster B
  // (per CROSS_CLUSTER_DEPS), cluster B is also marked 'pending'.
  for (const file of remaining_files) {
    if (!cluster_backlog[file]) continue
    const affected_q_numbers = round_applied_q_numbers[file] || new Set()
    const round_had_failures = failed_tasks.size > 0 && tasks.some(t => t.file === file && failed_tasks.has(t.task_id))

    // Expand affected Q-numbers with cross-cluster dependencies
    const cross_cluster_affected = new Set()
    for (const q of affected_q_numbers) {
      const deps = CROSS_CLUSTER_DEPS[q] || []
      for (const dep_q of deps) {
        cross_cluster_affected.add(dep_q)
      }
    }
    // Merge: all Q-numbers that should trigger re-review (within-cluster + cross-cluster)
    const all_affected = new Set([...affected_q_numbers, ...cross_cluster_affected])

    for (const cluster of CLUSTERS) {
      if (cluster_backlog[file][cluster.id]?.status === 'skipped') continue
      const cluster_qs = cluster.questions.map(q => q.id)
      if (cluster_qs.some(q => all_affected.has(q))) {
        // Fixes applied to questions in this cluster OR cross-cluster deps → re-check needed
        const was_clean = cluster_backlog[file][cluster.id]?.status === 'clean'
        cluster_backlog[file][cluster.id].status = 'pending'
        // Log cross-cluster invalidations for visibility
        if (was_clean) {
          const triggering_cross = [...cross_cluster_affected].filter(q => cluster_qs.includes(q))
          if (triggering_cross.length > 0) {
            print: "    ↔ ${file}: ${cluster.id} re-activated by cross-cluster dep (${triggering_cross.join(', ')})"
          }
        }
      }
      // If round was partial (Task failures), reset clean clusters to pending (results may be stale)
      if (round_had_failures && cluster_backlog[file][cluster.id]?.status === 'clean') {
        cluster_backlog[file][cluster.id].status = 'pending'
      }
    }
  }

  // Memoization milestones — track cluster_backlog convergence progress
  {
    let total_backlog_entries = 0
    let clean_entries = 0
    for (const file of Object.keys(cluster_backlog)) {
      for (const cluster of CLUSTERS) {
        if (cluster_backlog[file][cluster.id]?.status === 'skipped') continue
        total_backlog_entries++
        if (cluster_backlog[file][cluster.id]?.status === 'clean') clean_entries++
      }
    }
    if (total_backlog_entries > 0) {
      const memo_pct = Math.round(100 * clean_entries / total_backlog_entries)
      for (const threshold of [25, 50, 75]) {
        if (memo_pct >= threshold && !memo_milestones_printed.has(threshold)) {
          memo_milestones_printed.add(threshold)
          const filled = Math.round(10 * memo_pct / 100)
          const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)
          print: "  memo ── ${threshold}% memoized [${bar}] ${clean_entries}/${total_backlog_entries}"
        }
      }
    }
  }

FINALLY:
  // Cleanup: delete temp dir for this run (runs on both normal exit and exception)
  Bash(`rm -rf ${REVIEW_TMPDIR}`)
  print: "  🗑️ Cleaned up: ${REVIEW_TMPDIR}"
```

**Fix source is code-reviewer's own Fix block.** Do not re-reason or generate alternatives.
If the Fix block is absent, mark stuck — do not invent a fix.

**Stop condition:** A file exits the loop when `fixes_applied_per_file[file] == 0` after PHASE C —
meaning no fixable findings remain (all are YAGNI, stuck, or already addressed). Advisory
findings WITH a Fix block count toward `fixes_applied_per_file` and keep the loop alive — a file
with only Advisory/YAGNI or Advisory-no-Fix findings will produce 0 actionable tasks in PHASE B
and the loop exits correctly.

### Consolidation Strategy

After fan-out, the reconciler reads all `${file_slug}_cluster_*.md` files from the round's
subdirectory (`${REVIEW_TMPDIR}/round_${round}/`) and merges into a single consolidated review per file:

1. **Group by Q-number** (Q1, Q2, ... Q12) — primary dedup key. If a finding lacks a Q-number
   (e.g., from GAS reviewers), use the finding title or description as the dedup key
2. **Severity resolution**: higher severity wins (Critical > Advisory > Advisory/YAGNI > None)
3. **Fix block selection**: prefer the finding WITH a Fix block; if multiple have Fix blocks,
   prefer the higher-severity one; if tied, take the first
4. **Unique findings**: findings from different Q-numbers are all kept (union)
5. **Output**: build a single consolidated review markdown per file (same format as a real
   reviewer output — `## Code Review:` header, finding blocks, status) — this becomes
   `current_findings[file]` for the next round

```javascript
// parse_findings: extract structured findings from a review markdown string
// Returns: [{ q_number, title, severity, description, fix_block, raw }]
function parse_findings(review_text) {
  const findings = []
  // Split on finding header lines: "Finding: Critical" / "Finding: Advisory" / "Finding: Advisory/YAGNI"
  const blocks = review_text.split(/(?=\*\*Finding:\s*(Critical|Advisory(?:\/(?:Functional|YAGNI))?)\*\*)/i)
  for (const block of blocks) {
    const sev_match = block.match(/\*\*Finding:\s*(Critical|Advisory(?:\/(?:Functional|YAGNI))?)\*\*/i)
    if (!sev_match) continue
    const severity = sev_match[1]
    const q_match = block.match(/\*\*Q(\d+)\*\*|Q-number:\s*Q?(\d+)/i)
    const q_number = q_match ? `Q${q_match[1] || q_match[2]}` : null
    const title_match = block.match(/\*\*Finding:.*?\*\*[^\n]*\n[^*]*?\*\*(.*?)\*\*/) // second bold text (skip Finding: header)
    const title = title_match ? title_match[1] : null
    const fix_match = block.match(/\*\*Fix:\*\*[\s\S]*?```[\s\S]*?```/)
    const fix_block = fix_match ? fix_match[0] : null
    findings.push({ q_number, title, severity, description: block.slice(0, 200), fix_block, raw: block })
  }
  return findings
}

// rebuild_review_markdown: reconstruct a review markdown from consolidated findings
function rebuild_review_markdown(findings) {
  const sections = findings.map(f => f.raw).join('\n\n---\n\n')
  // Determine overall status from severity of remaining findings
  const has_critical = findings.some(f => f.severity === 'Critical')
  const has_functional = findings.some(f => f.severity === 'Advisory/Functional')
  const has_advisory = findings.some(f => f.severity === 'Advisory')
  const status = has_critical || has_functional ? 'NEEDS_REVISION'
    : has_advisory ? 'APPROVED_WITH_NOTES'
    : 'APPROVED'
  return `## Code Review: consolidated\n\n${sections}\n\n**Status**: ${status}\n`
}

function consolidate_findings(reviews) {
  // Parse each review into structured findings: { q_number, title, severity, description, fix_block, raw }
  const all_findings = reviews.flatMap(review => parse_findings(review))

  // Group by dedup key: Q-number if present, else title/description
  const groups = {}
  for (const finding of all_findings) {
    const key = finding.q_number || finding.title || finding.description
    if (!groups[key]) groups[key] = []
    groups[key].push(finding)
  }

  // For each group, select the best representative
  const severity_rank = { 'Critical': 3, 'Advisory/Functional': 2.5, 'Advisory': 2, 'Advisory/YAGNI': 1 }
  const consolidated = Object.values(groups).map(group => {
    // Sort: highest severity first, prefer findings WITH fix blocks
    group.sort((a, b) => {
      const has_fix_diff = (b.fix_block ? 1 : 0) - (a.fix_block ? 1 : 0)
      if (has_fix_diff !== 0) return has_fix_diff
      return (severity_rank[b.severity] || 0) - (severity_rank[a.severity] || 0)
    })
    return group[0]  // Best representative
  })

  // Rebuild review markdown from consolidated findings
  // Use same format as reviewer output (## Code Review: header + finding blocks + status)
  return rebuild_review_markdown(consolidated)
}

// detect_introduced_by_fix: compare new criticals/functionals against old to find regressions
function detect_introduced_by_fix(file, new_review, old_review, round) {
  const is_actionable = f => f.severity === 'Critical' || f.severity === 'Advisory/Functional'
  const new_criticals = parse_findings(new_review).filter(is_actionable)
  const old_criticals = parse_findings(old_review).filter(is_actionable)
  const old_keys = new Set(
    old_criticals.map(c => `${c.q_number || ''}:${c.description}`)
  )
  return new_criticals
    .filter(c => !old_keys.has(`${c.q_number || ''}:${c.description}`))
    .map(c => ({ file, ...c, introduced_in_round: round }))
}

// ═══ PHASE B INFRASTRUCTURE: Task Decomposition + Execution Planning ═══

// parse_before_after: extract verbatim before/after code from a Fix block string
function parse_before_after(fix_block) {
  if (!fix_block) return null
  const code_blocks = [...fix_block.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
  if (code_blocks.length >= 2) {
    return { before: code_blocks[0][1].trimEnd(), after: code_blocks[1][1].trimEnd() }
  }
  if (code_blocks.length === 1) {
    return null  // Malformed Fix block: only 1 code block, cannot distinguish before/after
  }
  return null
}

// decompose_findings: deterministic Stage 1 — raw findings → structured task list
// Calls parse_findings() per file, filters actionable tasks, assigns task IDs.
function decompose_findings(remaining_files, current_findings) {
  const tasks = []
  const skipped = []
  let task_counter = 0

  for (const file of remaining_files) {
    const findings = parse_findings(current_findings[file])
    for (const finding of findings) {
      if (finding.severity === 'Advisory/YAGNI') {
        skipped.push({ q_number: finding.q_number, file, severity: 'advisory_yagni', reason: 'YAGNI' })
        continue
      }
      if (!finding.fix_block) {
        skipped.push({ q_number: finding.q_number, file, severity: finding.severity.toLowerCase(), reason: 'no_fix_block' })
        continue
      }
      const parsed_fix = parse_before_after(finding.fix_block)
      if (!parsed_fix) {
        // Fix block present but malformed (no extractable before/after) — treat as no fix block
        skipped.push({ q_number: finding.q_number, file, severity: finding.severity.toLowerCase(), reason: 'malformed_fix_block' })
        continue
      }
      task_counter++
      tasks.push({
        task_id: `T${task_counter}`,
        file,
        q_number: finding.q_number,
        severity: finding.severity.toLowerCase(),
        description: finding.description,
        fix_block: parsed_fix,
      })
    }
  }
  return { tasks, skipped }
}

// validate_plan: verify planner output is well-formed and consistent with task list
function validate_plan(plan, task_ids_set) {
  if (!plan || !plan.tasks || !plan.waves) throw new Error('Missing tasks or waves')
  if (!Array.isArray(plan.tasks) || !Array.isArray(plan.waves)) throw new Error('tasks and waves must be arrays')

  const plan_task_ids = new Set(plan.tasks.map(t => t.task_id))
  // All planner task_ids must reference actual Stage 1 tasks
  for (const t of plan.tasks) {
    if (!task_ids_set.has(t.task_id)) throw new Error(`Unknown task_id: ${t.task_id}`)
  }
  // All depends_on must reference valid task_ids
  for (const t of plan.tasks) {
    for (const dep of (t.depends_on || [])) {
      if (!plan_task_ids.has(dep)) throw new Error(`depends_on references unknown task: ${dep}`)
    }
  }
  // No dependency cycles: dep's wave must be < task's wave
  const wave_map = {}
  for (const t of plan.tasks) { wave_map[t.task_id] = t.wave }
  for (const t of plan.tasks) {
    for (const dep of (t.depends_on || [])) {
      if (wave_map[dep] >= t.wave) throw new Error(`Cycle: ${t.task_id} (wave ${t.wave}) depends on ${dep} (wave ${wave_map[dep]})`)
    }
  }
  // wave_count matches waves array length
  if (plan.wave_count !== plan.waves.length) throw new Error(`wave_count ${plan.wave_count} != waves.length ${plan.waves.length}`)
}

// PLANNER_PROMPT: LLM execution planner prompt — receives pre-parsed tasks, returns dependency graph + waves
const PLANNER_PROMPT = (tasks, round) => `You are an execution planner for a code fix pipeline.

## Input: ${tasks.length} pre-parsed fix tasks (round ${round})

${tasks.map(t => `- ${t.task_id}: file="${t.file}", ${t.q_number} ${t.severity} — ${t.description.slice(0, 100)}`).join('\n')}

## Your job

Analyze these tasks for conflicts at THREE levels — not just files, but logical resources and concurrent actions:

### Level 1: File-level
1. **Cross-file symbol dependencies** — task A modifies an exported symbol that task B in another file references → B depends on A.
2. **Same-file region overlap** — tasks in the same file modify overlapping code regions → must be sequenced (earlier finding first).

### Level 2: Logical resource overlap (even across different files)
3. **Shared configuration** — task A changes a config value/env var, task B reads that config elsewhere → B depends on A.
4. **Route/endpoint coherence** — task A renames a handler function, task B updates the route table that references it → sequence them.
5. **Schema/contract dependencies** — task A changes a data structure, interface, or migration, task B relies on the old shape → B depends on A.
6. **Trigger/event chains** — task A modifies a trigger handler, task B changes the function the trigger invokes → sequence them (GAS: onOpen→menu→handler chains, doGet/doPost→router).

### Level 3: Concurrency safety
7. **Execution path overlap** — two tasks that modify different files but affect the same runtime execution path (middleware pipeline, event handler chain, require() chain) → sequence if the fix in one could invalidate assumptions in the other.
8. **Shared external resource** — tasks that both modify code interacting with the same external service, API endpoint, or database table → evaluate whether concurrent application could produce an inconsistent state.

### Final step
9. **Wave assignment** — group truly independent tasks into waves. Wave 0 runs first, wave 1 after wave 0 completes, etc.

## Rules
- Minimize wave count (maximize parallelism)
- Same-file tasks with non-overlapping regions CAN be in the same wave (the fixer handles ordering)
- Only create dependencies when there is a concrete code-level OR logical-resource reason
- When in doubt about resource overlap, sequence (correctness over speed)
- If all tasks are independent across all three levels: 1 wave, all in wave 0

## Output (bare JSON, no markdown wrapping)

{
  "tasks": [
    { "task_id": "T1", "depends_on": [], "wave": 0 },
    { "task_id": "T2", "depends_on": ["T1"], "wave": 1, "reason": "updates import of symbol renamed by T1" },
    { "task_id": "T3", "depends_on": ["T1"], "wave": 1, "reason": "modifies route handler that T1's endpoint rename affects" }
  ],
  "waves": [
    { "wave": 0, "task_ids": ["T1"] },
    { "wave": 1, "task_ids": ["T2", "T3"] }
  ],
  "wave_count": 2
}`

// ═══ CLUSTER INFRASTRUCTURE: constants, activation, prompt template ═══

// NON_CODE_EXTENSIONS: file types where only the intent cluster applies
const NON_CODE_EXTENSIONS = new Set(['md', 'yaml', 'yml', 'json', 'txt', 'toml'])

// CROSS_CLUSTER_DEPS: when a fix is applied for Q-number X, these Q-numbers in OTHER
// clusters should be invalidated (their cluster marked 'pending' for re-review).
// Derived systematically by analyzing question scope overlap — a fix to X changes
// behavior that Y evaluates. Bidirectional: Safety→Integration AND Integration→Safety.
const CROSS_CLUSTER_DEPS = {
  // Safety → Integration
  'Q3':  ['Q7'],           // error propagation fix → async errors may be affected
  'Q1':  ['Q15'],          // correctness fix → untested failure paths may shift
  'Q14': ['Q11'],          // type cast fix → backward compat (callers affected)
  // Integration → Safety
  'Q11': ['Q1'],           // backward compat fix → may introduce correctness bugs
  'Q7':  ['Q3', 'Q16'],    // async error fix → may swallow other errors or affect resource cleanup
  'Q16': ['Q3'],           // resource cleanup fix → may affect error propagation
  // Safety → Intent
  'Q2':  ['Q5'],           // security fix (adds validation) → minimal change affected
  // Intent → Safety
  'Q5':  ['Q1', 'Q2', 'Q3'],  // removing over-engineering → removed code may have been load-bearing
}

// CLUSTERS: domain clusters with question assignments and trigger patterns.
// safety + intent always run for code files. integration + ecosystem are conditional.
const CLUSTERS = [
  {
    id: 'safety',
    always: true,
    questions: [
      { id: 'Q1', title: 'Correctness', definition: '**Q1 — Correctness**: Are there code paths that produce incorrect results, null errors, or silent failures? Check boundary values, null/empty inputs, and integer extremes.' },
      { id: 'Q2', title: 'Security', definition: '**Q2 — Security**: Can untrusted input reach a sensitive sink (DB, eval, filesystem, HTML) without validation?' },
      { id: 'Q3', title: 'Error Propagation', definition: '**Q3 — Error Propagation**: Are errors swallowed, losing diagnostic context or silencing recoverable failures?' },
      { id: 'Q14', title: 'Type Cast Consistency', definition: '**Q14 — Type Cast Consistency**: When a type or interface is modified in this changeset, trace its usage across files: are there `as Type`, `<Type>`, or `Record<string, unknown>` casts that bypass the updated definition? Casts written before a type extension pin callers to the old shape, hiding new fields from the checker and producing silent field-access failures at runtime.' }
    ],
    triggers: null  // always active for code files
  },
  {
    id: 'intent',
    always: true,
    questions: [
      { id: 'Q4', title: 'Intent Alignment', definition: '**Q4 — Intent Alignment**: Do function names, return types, or behaviors contradict the task description or acceptance criteria?' },
      { id: 'Q5', title: 'Minimal Change', definition: '**Q5 — Minimal Change**: Does the change introduce abstractions, dependencies, or indirection layers that acceptance criteria don\'t justify, where existing modules or patterns could extend instead?' },
      { id: 'Q12', title: 'Question Tables', definition: '**Q12 — Question Tables** (only if file contains `| Q` table patterns — skip otherwise): Are question counts in section headers consistent with the actual number of table rows? Are all Q-IDs referenced in evaluator prompts defined in the question tables?' },
      { id: 'Q13', title: 'Content Review', definition: '**Q13 — Content Review** (non-code files only): Does this change achieve its stated purpose? Is the modified content clear, accurate, and consistent with surrounding context?' }
    ],
    triggers: null  // always active (Q4+Q5 apply to all; Q12 applies when file has | Q table patterns; Q13 applies to non-code files only)
  },
  {
    id: 'integration',
    always: false,
    questions: [
      { id: 'Q11', title: 'Backward Compat', definition: '**Q11 — Backward Compatibility**: Would this break existing callers? Are there backwards-incompatible signature or behavior changes?' },
      { id: 'Q7', title: 'Async Errors', definition: '**Q7 — Async Errors**: Are all async error paths handled? Any unhandled rejections?' },
      { id: 'Q8', title: 'GAS Limits', definition: '**Q8 — GAS Execution Limits**: Execution limits respected? Loops quota-safe? Null-guarded before JSON.parse (getProperty/getCache/ConfigManager.get)? Stale state migration handled?' },
      { id: 'Q16', title: 'Resource Cleanup', definition: '**Q16 — Resource Cleanup**: Are opened resources (connections, handles, listeners, timers) closed on all paths including error paths?' }
    ],
    triggers: [
      /export\s+(function|const|class|default)|module\.exports|exports\./,    // Q11: exports/public API
      /async\s|await\s|\.then\(|express|router/,                              // Q7: async patterns
      /SpreadsheetApp|DriveApp|GmailApp|PropertiesService|CacheService|ConfigManager/,  // Q8: GAS APIs
      /open\(|connect\(|subscribe\(|addEventListener|setInterval|setTimeout|createReadStream|createServer|acquire\(/  // Q16: resource lifecycle
    ]
  },
  {
    id: 'ecosystem',
    always: false,
    questions: [
      { id: 'Q6', title: 'React Hooks', definition: '**Q6 — React Hooks**: Are hook dependency arrays complete and free of stale closures?' },
      { id: 'Q9', title: 'Test Quality', definition: '**Q9 — Test Quality**: Do tests verify behavior (correct outputs, error paths) or just execution (no throw)?' },
      { id: 'Q10', title: 'SQL Injection', definition: '**Q10 — SQL Injection**: Are all query parameters parameterized? Could string interpolation lead to injection?' },
      { id: 'Q15', title: 'Untested Failure Paths', definition: '**Q15 — Untested Failure Paths**: Trace error-handling and fallback branches: could any produce silently wrong results if the upstream assumption fails — and is that path covered by a test? Flag: catch blocks returning defaults instead of propagating, config lookups with fallback values that mask structural errors, optional chaining (`?.`) silently yielding undefined that downstream code treats as valid data.' }
    ],
    triggers: [
      /useState|useEffect|useCallback/,            // Q6: React hooks
      /describe\s*\(|it\s*\(|expect\s*\(/,         // Q9: test patterns
      /SELECT\s|INSERT\s|query\s*\(|\.raw\s*\(/,   // Q10: SQL patterns
      /catch\s*\(|\.catch\(|\?\.\w/                 // Q15: catch blocks and optional chaining
    ]
  }
]

// get_active_clusters: determine which clusters should be dispatched for a file.
// Respects: non-code file restrictions, trigger pattern activation, backlog status.
// Returns: array of cluster objects to dispatch (subset of CLUSTERS).
function get_active_clusters(file, file_content, is_non_code, file_backlog) {
  const active = []

  for (const cluster of CLUSTERS) {
    // Non-code files: only intent cluster runs
    if (is_non_code && cluster.id !== 'intent') continue

    // Check backlog: skip clusters that are 'clean' (memoized from prior round, no related fixes)
    if (file_backlog[cluster.id]?.status === 'clean') continue

    // Check backlog: skip clusters explicitly marked 'skipped'
    if (file_backlog[cluster.id]?.status === 'skipped') continue

    // Always-on clusters (safety, intent): dispatch unconditionally for code files
    if (cluster.always) {
      active.push(cluster)
      continue
    }

    // Conditional clusters: check if any trigger pattern matches file content
    if (cluster.triggers && cluster.triggers.some(pattern => pattern.test(file_content))) {
      active.push(cluster)
    }
  }

  return active
}

// CLUSTER_PROMPT: focused review prompt for a single cluster evaluating one file.
// Output format matches code-reviewer's finding format exactly, so parse_findings() works as-is.
const CLUSTER_PROMPT = (cluster_id, questions, file, context) => `You are a Code Review Cluster Evaluator.
You evaluate a specific subset of quality questions for exactly one file.

## Your file
${file}

Read this file using the Read tool before evaluating.

## Your cluster: ${cluster_id}
Evaluate ONLY these questions:

${questions.map(q => q.definition).join('\n\n')}

## Severity Decision
Ask: "If deployed, would this produce wrong output or silently lose/corrupt data?"
YES → \`Advisory/Functional\` (auto-fix priority; NEEDS_REVISION when stuck)
NO → \`Advisory\` (style, readability, refactoring; APPROVED_WITH_NOTES when stuck)
Calibration: config misread returning wrong default → Functional. Schema access returning undefined silently → Functional. Misleading variable name → Advisory. Redundant null check → Advisory.

## Context
worktree="${context.worktree}"
review_mode="${context.review_mode}"
task_name="${context.task_name}"
${context.plan_summary ? `\nPlan context (use to evaluate intent alignment):\n${context.plan_summary}` : ''}
${context.impact_files?.length > 0 ? `\n**Impact context**: The following files reference symbols changed in ${file}.\nCheck Q11 (backward compatibility) against these actual callers:\n${context.impact_files.map(f => '- ' + f).join('\n')}` : ''}
${context.is_recheck ? `\nThis is a re-review (round ${context.round}). Focus on code modified since last review.
Evaluate the current code on its own merits. Do not assume that recently modified code is correct simply because it was the result of a prior fix.
Advisory findings that were already applied in a prior round should NOT be re-reported.
Advisory/YAGNI findings from prior rounds should still be emitted as \`Finding: Advisory/YAGNI\`.` : ''}
${context.fix_context ? `\n**Fix context** (these lines were modified by the fixer in the previous round — verify correctness):\n\`\`\`diff\n${context.fix_context}\n\`\`\`\n` : ''}

## Output format
Use the standard code-reviewer finding format for each question:

**Q[N]: [Title]** | **Finding: Critical** / **Finding: Advisory** / **Finding: Advisory/YAGNI** / **Finding: None**
> [One-sentence answer]
Evidence: [file:line]
**Fix:** [before/after code blocks for Critical/Advisory — omit for None/YAGNI]

Output your findings starting with "## Code Review: ${cluster_id}".

IMPORTANT: After completing your review, write your complete review output to:
  ${context.output_path}
using the Write tool. Your review output starts with "## Code Review:".
Do NOT use SendMessage — your output is collected directly by the calling agent.`

// FIXER_PROMPT_V2: structured per-task fixer prompt (replaces raw blob)
const FIXER_PROMPT_V2 = (file, tasks_for_file) => `You are a Fixer Agent. Apply these discrete fix tasks to exactly one file.

## Your file
${file}

## Tasks (apply in order)

${tasks_for_file.map((t, i) => `Task ${i + 1}: ${t.task_id} — ${t.q_number} ${t.severity} — "${t.description.slice(0, 120)}"
  Before:
\`\`\`
${t.fix_block.before}
\`\`\`
  After:
\`\`\`
${t.fix_block.after}
\`\`\`
`).join('\n')}

## Instructions

For each task above, in order:
1. Read the file (if not already read)
2. Apply via Edit tool: old_string = Before block (verbatim), new_string = After block (verbatim)
3. If before text not found: record as "failed" (DO NOT invent alternatives)
4. If a dependency task failed and this task depends on its output: record as "blocked"
5. On success: record as "applied"

## Output format (required — output this JSON exactly, no markdown wrapping)

{
  "file": "${file}",
  "task_results": [
    { "task_id": "T1", "status": "applied" },
    { "task_id": "T2", "status": "failed", "reason": "before text not found" }
  ]
}`
```

### Phase 3 Print Format

**Fix loop start** (once, before WHILE loop):
```
Print: "━━━ FIX LOOP ━━━━━━━━━━━━━━━━━━━━━━"
Print: "  📂 Temp dir: ${REVIEW_TMPDIR}"
```

**Round start:**
```
Print: "🔧 Round [▓ × round + ░ × (max_rounds - round)] [round/max_rounds]: [N] file(s), planning..."
```

Examples with max_rounds=5:
```
🔧 Round [▓░░░░] [1/5]: 3 file(s), planning...
🔧 Round [▓▓░░░] [2/5]: 1 file(s), planning...
🔧 Round [▓▓▓░░] [3/5]: 1 file(s), planning...
```

**PHASE A — Inspect (rounds 2+, cluster dispatch + reconciliation):**
```
Print: "  ↗ Dispatching ${N} cluster task(s) across ${M} file(s)..."
Print: "    → ${file}: ${cluster_ids} (${N} cluster(s), ${skipped} skipped, re-check: ${recheck_ids})"
Print: "  ✓ ${ok} cluster(s) completed, ${failed} failed in ${elapsed}s"
Print: "    📊 ${file}: 1 cluster → ${N} findings"                    (single cluster)
Print: "    📊 ${file}: ${N} clusters → ${M} unique findings (${K} duplicates merged)"  (multi-cluster)
Print: "    📋 ${REVIEW_TMPDIR}/round_${round}/${file_slug}_consolidated.md"
Print: "    📌 Next round TODO for ${file}:"
Print: "      🔧 ${q_number} ${severity}: ${description}"            (has Fix block)
Print: "      ⚠️ ${q_number} ${severity}: ${description}"            (no Fix block)
Print: "    📊 ${file}: ${cluster_id}=clean, ${cluster_id}=${N} finding(s)"  (backlog status)
Print: "  → [file] — no actionable findings — done"               (filter: clean exit)
Print: "  ⚠️ [file] — max rounds reached — [N] finding(s) stuck"   (max_rounds ejection)
```

**PHASE B — Plan (decomposition + planner):**
```
Print: "  📐 Decompose: ${N} tasks, ${M} skipped (deterministic)"
Print: "  📐 Planner: analyzing ${N} tasks across ${M} file(s) for parallel dispatch..."
Print: "  ✓ Plan: ${N} tasks in ${M} wave(s) — ${K} dependency(ies) found (${elapsed}s)"
Print: "  ✓ Plan: ${N} tasks in ${M} wave(s) — all independent (${elapsed}s)"
Print: "  ⚠️ Planner failed (${err.message}) — fallback: all tasks in wave 0 (${elapsed}s)"
```

**PHASE C — Fix (wave execution):**
```
Print: "  ⚡ Wave ${N}: ${M} task(s) across ${K} file(s)..."
Print: "    → Fix ${file} (${N} tasks: ${task_ids})"
Print: "  ✓ Wave ${N}: ${applied} applied, ${failed} failed (${elapsed}s)"
Print: "  ✓ Wave ${N}: ${applied} applied, ${failed} failed, ${blocked} blocked (${elapsed}s)"
Print: "  ⚠️ Fixer batch failed: ${err.message}"
```

**End of round:**
```
Print: "  → [file] nothing changed — done"
Print: "  ✅ [filename] — clean after [N] round(s)"
Print: "  Round [N]:  [elapsed]s"
Print: "  ┌ [file] ──── ✅ clean ([N] round(s))"
Print: "  ├ [file] ──── 🔄 continuing"
Print: "  └ [file] ──── 🔄 continuing"
```

**Cleanup** (after WHILE loop exits, in FINALLY block):
```
Print: "  🗑️ Cleaned up: ${REVIEW_TMPDIR}"
```

Status options per file:
- `✅ clean (N round(s))` — file exited loop (0 fixes this round or no actionable findings)
- `🔄 continuing` — fixes applied, entering next round
- `⚠️ max rounds` — hit per-file max_rounds limit (ejected in PHASE A)

Example:
```
━━━ FIX LOOP ━━━━━━━━━━━━━━━━━━━━━━
  📂 Temp dir: /tmp/review-fix-a1b2c3

🔧 Round [▓░░░░] [1/5]: 3 file(s), planning...
  📐 Decompose: 6 tasks, 1 skipped (deterministic)
  📐 Planner: analyzing 6 tasks across 3 file(s) for parallel dispatch...
  ✓ Plan: 6 tasks in 1 wave(s) — all independent (4.2s)
  ⚡ Wave 0: 6 task(s) across 3 file(s)...
    → Fix Utils.gs (3 tasks: T1, T2, T3)
    → Fix Main.ts (1 task: T4)
    → Fix Api.ts (2 tasks: T5, T6)
  ✓ Wave 0: 5 applied, 1 failed (8.2s)
  ✅ Utils.gs — clean after 1 round(s)
  ✅ Main.ts — clean after 1 round(s)
  Round 1:  12.4s
  ┌ Utils.gs ──── ✅ clean (1 round(s))
  ├ Main.ts ───── ✅ clean (1 round(s))
  └ Api.ts ────── 🔄 continuing

🔧 Round [▓▓░░░] [2/5]: 1 file(s), planning...
  ↗ Dispatching 2 cluster task(s) across 1 file(s)...
    → Api.ts: safety, intent (2 clusters, integration skipped, re-check: safety)
  ✓ 2 cluster(s) completed, 0 failed in 9.2s
    📊 Api.ts: 2 clusters → 2 unique findings (0 duplicates merged)
    📋 /tmp/review-fix-a1b2c3/round_2/Api_ts_consolidated.md
    📌 Next round TODO for Api.ts:
      🔧 Q3 Critical: Missing null check on response.data before...
      ⚠️ Q7 Advisory: Consider extracting validation logic into...
    📊 Api.ts: safety=1 finding(s), intent=clean
  📐 Decompose: 1 tasks, 1 skipped (deterministic)
  📐 Planner: analyzing 1 tasks across 1 file(s) for parallel dispatch...
  ✓ Plan: 1 tasks in 1 wave(s) — all independent (3.1s)
  ⚡ Wave 0: 1 task(s) across 1 file(s)...
    → Fix Api.ts (1 task: T1)
  ✓ Wave 0: 1 applied, 0 failed (5.1s)
  Round 2:  17.4s
  └ Api.ts ────── 🔄 continuing

🔧 Round [▓▓▓░░] [3/5]: 1 file(s), planning...
  ↗ Dispatching 1 cluster task(s) across 1 file(s)...
    → Api.ts: safety (1 cluster, intent skipped)
  ✓ 1 cluster(s) completed, 0 failed in 6.8s
    📊 Api.ts: 1 cluster → 0 findings
    📊 Api.ts: safety=clean, intent=clean
  📐 Decompose: 0 tasks, 0 skipped (deterministic)
  → Api.ts — no actionable tasks — done
  ✅ Api.ts — clean after 3 round(s)
  Round 3:  6.8s
  └ Api.ts ────── ✅ clean (3 round(s))

  🗑️ Cleaned up: /tmp/review-fix-a1b2c3

✅ Fix loop complete — 3 round(s), 5 critical resolved, 0 advisory applied (37.0s)
```

---

### Convergence Message

After the fix loop exits (or after Phase 2 when all files are APPROVED), compute `total_elapsed = Math.round((Date.now() - total_start_time) / 1000)` and print one of:

All clean, no fixes needed (Phase 2 → Phase 4 skip):
```
Print: "✅ All files clean — no fixes needed ([total_elapsed]s)"
```

All clean after fixes:
```
Print: "✅ Fix loop complete — [round] round(s), [critical_resolved.length] critical resolved, [advisory_applied.length] advisory applied ([total_elapsed]s)"
```

Partial / stuck:
```
Print: "⚠️ Fix loop ended — [round] round(s) (max), [critical_resolved.length] critical resolved, [stuck_findings.length] stuck ([total_elapsed]s)"
```

---

## Phase 3.5: Post-Round Retrospective

After the fix loop exits (convergence or max_rounds), run a lightweight Haiku-based retrospective
that examines the run's telemetry and produces actionable process improvements.

```javascript
// Skip retrospective if round == 0 (all files clean in Phase 2, no fix loop ran)
if (round > 0) {
  print: "━━━ RETROSPECTIVE ━━━━━━━━━━━━━━━━━━"
  const retro_start = Date.now()
  try {
    const retro_output = await Task({
      subagent_type: "general-purpose",
      description: "Post-round retrospective analysis",
      prompt: `You are a review-fix process analyst. Examine this run's telemetry and answer concisely.

## Run Telemetry
- Rounds: ${round}/${max_rounds}
- Findings by round: ${JSON.stringify(findings_counts_per_round)}
- Cluster efficiency: ${JSON.stringify(cluster_stats)}
- Fix success rate: ${critical_resolved.length} resolved, ${fix_failures.length} failed, ${stuck_findings.length} stuck
- Phase timings: ${JSON.stringify(per_round_phase_timings)}
- Introduced by fix: ${introduced_by_fix.length} regressions
- Verification: ${verifications_passed || 0} pass, ${verifications_failed || 0} fail, ${verifications_false_positive || 0} false-positive

## Questions (answer each in 1-2 sentences)

Q-R1: **Finding quality** — Were any findings false positives (applied then re-review found no issue)? Which Q-numbers are unreliable?

Q-R2: **Convergence efficiency** — Did the run converge in minimum rounds, or were rounds wasted?

Q-R3: **Fix quality** — What fraction of fix_failures were from textual drift (prior fixes shifting "before" text) vs wrong fix blocks?

Q-R4: **Memoization effectiveness** — Were memoized clusters re-activated unnecessarily?

Q-R5: **Self-improvement** — Is there a materially better way to have structured the review/fix for THESE files?

## Output (bare JSON, no markdown wrapping)
{"false_positive_q_numbers":[],"wasted_rounds":0,"drift_fraction":0.0,"over_invalidated_clusters":[],"process_recommendation":"one-sentence actionable improvement","confidence":"high|medium|low"}`
    })

    // Parse and display retrospective results
    try {
      const json_match = retro_output.match(/\{[\s\S]*\}/)
      if (json_match) {
        const retro = JSON.parse(json_match[0])
        if (retro.false_positive_q_numbers?.length > 0) {
          print: "  ⚠️ False-positive Q-numbers: ${retro.false_positive_q_numbers.join(', ')}"
        }
        if (retro.wasted_rounds > 0) {
          print: "  ⚠️ Wasted rounds: ${retro.wasted_rounds}"
        }
        if (retro.drift_fraction > 0.3) {
          print: "  ⚠️ Fix drift: ${Math.round(retro.drift_fraction * 100)}% of failures from textual drift"
        }
        if (retro.over_invalidated_clusters?.length > 0) {
          print: "  ⚠️ Over-invalidated: ${retro.over_invalidated_clusters.join(', ')}"
        }
        print: "  💡 ${retro.process_recommendation} (confidence: ${retro.confidence})"
      }
    } catch (e) {
      print: "  ⚠️ Could not parse retrospective output"
    }
    const retro_elapsed = ((Date.now() - retro_start) / 1000).toFixed(1)
    print: "  ✓ Retrospective complete (${retro_elapsed}s)"
  } catch (err) {
    print: "  ⚠️ Retrospective failed: ${err.message} — skipping (non-blocking)"
  }
}
```

---

## Phase 4: Summary + Teardown

```javascript
// Deduplication handled incrementally during Phase 3 aggregation (dedup guard with persistent seen keys).
// No batch dedup needed here — arrays are already duplicate-free.
```

### Summary Output

Print: "━━━ SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━"

```markdown
╔════════════════════════════════════════════════╗
║  review-fix Summary — [task_name]              ║
╚════════════════════════════════════════════════╝

Status: [🟢 APPROVED | 🟡 APPROVED_WITH_NOTES | 🔴 NEEDS_REVISION] — [rationale]

File Health
  [tree grid: ┌├└ with final per-file status — one line per target file]
  ┌ [file1] ── ✅ clean (round [N])
  ├ [file2] ── ✅ clean (round [N])
  └ [file3] ── 🔴 stuck ([N] findings)

Findings Ledger
  ┌ 🔴 Critical/Functional ── [critical_resolved.length] resolved, [stuck_findings.length] stuck
  ├ 🟡 Advisory ── [advisory_applied.length] applied, [advisory_stuck.length] no-fix, [fix_failures.length] failed
  └ 💡 YAGNI ──── [advisory_yagni.length] skipped

Round History
  Round  Files  Clusters (dispatched/memoized)  Findings  Fixes  Duration (inspect / plan / fix)
  [for each round N from 1 to round:]
  [N]      [file_count]  [dispatched]/[memoized]  [total_findings]      [fixes]  [duration]s ([inspect_s]s / [plan_s]s / [fix_s]s)
  Total: [round] rounds, [critical_resolved.length + advisory_applied.length] fixes applied, [total_elapsed]s

  Round 1 cluster column shows "—" (Phase 2 output used, no cluster dispatch).
  Subsequent rounds show dispatched/memoized counts from cluster_stats[round-1].
  Findings column from findings_counts_per_round[round-1].total.
  Duration from round_durations[round-1], timing breakdown from per_round_phase_timings[round-1].

Cluster Efficiency
  dispatched: [sum of cluster_stats.clusters_dispatched]  memoized: [sum of cluster_stats.clusters_memoized]  ratio: [memo_pct]%

  Ratio = 100 * total_memoized / (total_dispatched + total_memoized).
  Omit this section if no cluster dispatch occurred (round == 1 only).

[If cardservice_files is non-empty:]
> ⚠️ **CardService coverage note**: The following files were routed to `gas-gmail-cards` (Gmail add-on specialist) instead of `gas-code-review` (general GAS quality). General GAS code quality checks were **not** run for these files in the automated loop. For full dual coverage, run `/gas-review` separately:
> [list each file in cardservice_files]
```

The following detail sections follow the summary box. They preserve all existing data points for
actionable human review:

```markdown
### Critical Findings — Resolved ([count])

[For each resolved finding:]
- `file:line` — [Q-number or finding title]: [what was fixed]

[If none: "None — no Critical findings were present."]

### Critical Findings — Stuck / Unresolved ([count])

[If none: "None — all Critical findings resolved."]

[For each stuck finding:]
- `file:line` — [Q-number or finding title]: [description]
  > **Action required**: [paste the Fix block from the last review output]

[For each introduced_by_fix finding that is still unresolved (also in stuck_findings):]
- `file:line` — [Q-number]: [description] *(introduced by fix in round N, unresolved)*

Note: `introduced_by_fix` findings that were subsequently resolved appear in "Critical Findings — Resolved" above, not here.

### Advisory Findings — Applied ([count])

[For each applied advisory:]
- `file:line` — [Q-number or finding title]: [what was fixed]

[If none: "None — no Advisory findings were applied."]

### Findings — Failed to Apply ([count])

[For each entry in fix_failures[]:]
- `file:line` — [Q-number or finding title]: `before` text not found (file may have been modified by a prior fix)

[Omit this section entirely if fix_failures is empty.]

### Advisory Findings — Stuck (no Fix block) ([count])

[If none: "None."]

[For each advisory stuck finding:]
- `file:line` — [Q-number or finding title]: [one-line description]
  > **Action required**: No Fix block was provided by the reviewer. Manual review required.

### Advisory Findings — YAGNI Skipped ([count])

[If none: "None."]

[For each yagni finding:]
- `file:line` — [title]: [one-line description]
  > *Skipped: speculative improvement — apply only if this becomes a real need.*

### Final Status

**Status**: [APPROVED | APPROVED_WITH_NOTES | NEEDS_REVISION]
[One sentence rationale.]

[If NEEDS_REVISION due to stuck findings:]
> These Critical findings require human review. The auto-fix loop reached its maximum
> of [max_rounds] rounds without resolving them. See "Stuck" section above.
```

**Final status derivation:**
- `APPROVED` — zero Critical remaining, zero non-YAGNI Advisory stuck (YAGNI-only is still APPROVED)
- `APPROVED_WITH_NOTES` — zero Critical remaining, ≥1 non-YAGNI Advisory stuck (no Fix block)
- `NEEDS_REVISION` — one or more Critical findings in `stuck_findings`

```javascript
// Assign final_status based on derivation above (MUST run before Phase 5).
// Reads deduplicated advisory_stuck[] (maintained incrementally via dedup guard in Phase 3).
if (stuck_findings.length > 0) {
  final_status = 'NEEDS_REVISION'
} else if (advisory_stuck.length > 0) {
  final_status = 'APPROVED_WITH_NOTES'
} else {
  final_status = 'APPROVED'
}
```

---

## Phase 5: Git Operations

After teardown, stage, commit, and optionally create a PR if files were changed and review succeeded.

---

**Conditions to trigger:**
- `files_changed` is non-empty
- `final_status` is `APPROVED` or `APPROVED_WITH_NOTES`
- Skip entirely if `NEEDS_REVISION` or `files_changed` is empty

Print: "━━━ GIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━"

### Step 5a: Branch Check (pr mode only)

When `commit_mode == "pr"`:

```bash
current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
default_branch=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')
default_branch=${default_branch:-main}
```

If `current_branch` equals `$default_branch`:
- Create and checkout a temp branch:
  ```bash
  temp_branch="review-fix/$(date +%Y%m%d-%H%M%S)"
  git checkout -b "$temp_branch"
  ```
- Print: `"  → Created branch: $temp_branch (was on default branch)"`

### Step 5b: Stage and Commit (both modes)

**Determine files to stage:**
- When `commit_mode == "commit"`: Stage ALL `target_files` that have uncommitted changes (the caller
  expects the commit to include both implementation changes and review-fix corrections).
  ```bash
  # Filter target_files to existing paths only (handles deleted/renamed files gracefully)
  # Skip files that don't exist on disk and aren't in git status
  # Stage target_files that have actual changes (avoids staging unchanged files)
  for file in [file_list]; do
    git diff --quiet "$file" 2>/dev/null || git add "$file"
    git diff --cached --quiet "$file" 2>/dev/null || true  # already staged is fine
  done
  # Also stage any untracked target_files (new files)
  git add [untracked target_files from git status]
  ```
- When `commit_mode == "pr"`: Stage only `files_changed` (review-fix corrections only — the
  implementation was already committed by the caller before invoking review-fix).
  ```bash
  git add [files_changed joined by space]
  ```

```bash
git commit -m "$(cat <<'EOF'
review-fix: <task_name>: apply review-fix corrections ([critical_resolved.length] critical, [advisory_applied.length] advisory applied)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

On success → print: `"  ✓ Committed: [short message]"`
On failure → print error, output `<!-- COMMIT_FAILED -->`, stop Phase 5.

If `commit_mode == "commit"` → output `<!-- COMMITTED -->` and stop Phase 5.

### Step 5c: Pre-flight Checks (pr mode only)

```bash
git remote get-url origin 2>/dev/null   # remote exists?
gh auth status 2>/dev/null              # gh authenticated?
```

If either fails → print warning, output `<!-- COMMITTED -->` (graceful fallback to commit-only), stop Phase 5.

`$default_branch` was already detected in Step 5a. Use it in all subsequent commands (PR base, checkout, pull).

### Step 5d: Push + PR + Merge (pr mode only)

```bash
# Push
git push -u origin HEAD 2>&1
```
On failure → print error, output `<!-- PUSH_FAILED -->`, stop.

```bash
# Create PR
pr_url=$(gh pr create \
  --base "$default_branch" \
  --title "review-fix: <task_name>: review-fix corrections" \
  --body "$(cat <<'EOF'
## Summary
- [critical_resolved.length] critical fix(es) applied
- [advisory_applied.length] advisory fix(es) applied
- [advisory_stuck.length] advisory finding(s) noted (no fix block)

## Files changed
[files_changed as bullet list]

Generated by review-fix agent.
EOF
)" 2>&1)
```
On failure → print error + `"Branch pushed to origin. Create PR manually."`, output `<!-- PR_FAILED -->`, stop.

```bash
# Squash merge + delete branch
gh pr merge "$pr_url" --squash --delete-branch 2>&1
```
On failure → print error + `"PR remains open at $pr_url."`, output `<!-- MERGE_FAILED -->`, stop.

```bash
# Return to default branch
git checkout "$default_branch"
git pull --ff-only origin "$default_branch"
```

If temp branch was created (was on default branch), also: `git branch -d "$temp_branch" 2>/dev/null`

Print success summary:
```
  ✓ Pushed → origin/[branch]
  ✓ PR created: [pr_url]
  ✓ Merged (squash) → [default_branch]
  ✓ Branch deleted
  ✓ On [default_branch]
```

Output: `<!-- PR_MERGED -->`

### Marker Summary

| `commit_mode` | Success | Degraded Success | Failure |
|---|---|---|---|
| `"pr"` | `PR_MERGED` | `COMMITTED` (no remote or gh auth — fallback) | `COMMIT_FAILED` / `PUSH_FAILED` / `PR_FAILED` / `MERGE_FAILED` |
| `"commit"` | `COMMITTED` | — | `COMMIT_FAILED` |
