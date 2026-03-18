---
name: review-plan
description: |
  Universal plan review: 3 layers (general quality, code change quality, ecosystem
  specialization). Invokes gas-plan for GAS plans or node-plan for Node.js/TypeScript
  plans, conditionally based on detected patterns.

  AUTOMATICALLY INVOKE when:
  - MANDATORY_PRE_EXIT_PLAN directive applies (before ExitPlanMode)
  - User says "review plan", "check plan", "plan ready?"
  - Any plan file needs review (GAS or non-GAS)

  NOT for: Code review of existing files (use /gas-review or /review-fix)
model: claude-sonnet-4-6
allowed-tools: all
---

## Role & Authority

1. **Role:** Team-lead orchestrator — you coordinate evaluators and apply edits to the plan. You do NOT independently evaluate plan quality; that is the evaluators' job.
2. **Authority:** You may call Edit, Write, Bash, and Read tools. You may spawn Task agents. You may NOT call ExitPlanMode until the gate marker is written.
3. **Constraint:** Never re-evaluate a question yourself if a live evaluator result is available. Use evaluator output as the authoritative finding. If no evaluator has run yet (first pass, pre-spawn), proceed to spawn — do not pre-judge.
4. **Goal:** Drive the plan to 0 NEEDS_UPDATE on Gate 1 questions within 5 passes, then produce the scorecard and exit.

---

# Universal Plan Review: Convergence Loop

You apply a 3-layer quality review to any implementation plan: general quality, code change
quality, and conditional GAS specialization via gas-plan when GAS patterns are detected.
You iterate until all layers and sub-skills report zero changes in the same pass.

**Loop until convergence. Do not output the final scorecard until exit criteria are met.**

---

## Step 0: Locate Plan and Load Context

1. **Find the plan file:**
   - If an argument was passed (file path), use it directly
   - Otherwise: `Glob("~/.claude/plans/*.md")` → pick the most recently modified
   - Read the plan file fully

2. **Load standards context:**
   - Read `~/.claude/CLAUDE.md` for directives and conventions
   - Find and read the project memory file:
     `Glob("~/.claude/projects/*/memory/MEMORY.md")` → read most recently modified
     (skip gracefully if none found)
   - Path variables — derive now and cache as named variables; used in all evaluator spawning (fast-path and loop):
     - `plan_path` = absolute path of the plan file found in step 1
     - `plan_slug` = filename stem of plan_path (no extension); scopes gate marker and memo file
       ```
       plan_slug = basename(plan_path, ".md")
       # Example: /Users/jameswiese/.claude/plans/snug-jumping-yao.md → snug-jumping-yao
       # Used to scope gate marker and memo file to this specific plan invocation.
       ```
     - `questions_path` = `~/.claude/skills/review-plan/QUESTIONS.md`
     - `questions_l3_path` = `~/.claude/skills/review-plan/QUESTIONS-L3.md`
     - `gas_eval_path`  = `~/.claude/skills/gas-plan/EVALUATE.md`
     - `node_eval_path` = `~/.claude/skills/node-plan/EVALUATE.md`
       (`~` makes all four portable across users — no hardcoded username.
       Update here if the install base changes; all evaluator spawns below use these variables.)

3. **Set context flags** (Haiku classification):
   Task(
     subagent_type = "general-purpose",
     model = "haiku",
     prompt = """
       Read the plan at <plan_path>.

       Classify based on what files the plan CREATES or MODIFIES — not what it
       mentions in descriptions, evaluator prompts, or documentation.
       Scan the plan's implementation steps for file extension patterns (.gs, .ts,
       .js, .html), API/framework names (SpreadsheetApp, Express, React, etc.), and
       change types (schema migration, deployment, etc.) to determine flags. If the
       plan's implementation steps reference GAS files, Node modules, or UI patterns
       — set the corresponding flag regardless of what file type the plan document
       itself is.

       IS_GAS: true if plan creates/modifies .gs files, appsscript.json, GAS
               CommonJS modules, or GAS HTML service files.
               False if plan only references GAS concepts in prose or skill metadata.
       IS_NODE: true if plan creates/modifies .ts/.js application files, package.json
                dependencies, or Node.js server code. Always false if IS_GAS is true.
                False if plan only runs npm test for verification or mentions Node
                tooling in passing.
       HAS_UI: true if plan creates/modifies HTML/CSS files, sidebar code, dialog
               implementations, or client-side JavaScript.
               False if plan only describes UI concepts in evaluator questions or
               architectural context.
       HAS_DEPLOYMENT: true if plan includes push/deploy/release steps, target
                       environments, or release process; or pushing code to a shared
                       repository others depend on (git push to main/shared branches,
                       clasp push, npm publish). Key test: will other people or systems
                       see this change without pulling it themselves?
                       False for local-only changes.
       HAS_STATE: true if plan modifies persistent storage, databases, config files,
                  state schemas, or stateful operations; or any file with a defined
                  schema/format that downstream code consumes (e.g., QUESTIONS.md read
                  by evaluators, config.json parsed by tools, template files included
                  by other templates). Key test: if the file's structure changed, would
                  consumers break? False for read-only or ephemeral changes.

       HAS_TESTS: true if plan creates/modifies test files, modifies function
                  signatures that have existing tests, fixes bugs (regression test
                  needed), or adds new functions that need test coverage.
                  False if plan is documentation-only, cosmetic, or explicitly confirms
                  existing tests are sufficient without modification.
       HAS_EXTERNAL_CALLS: true if plan introduces or modifies outbound HTTP/API
                           calls, database queries, external service integrations,
                           OAuth flows, or third-party library usage with network I/O.
                           False if plan operates purely on local files, in-memory
                           data, or internal function calls.
       HAS_UNTRUSTED_INPUT: true if plan handles user-submitted data, URL parameters,
                            form inputs, external API responses parsed into application
                            logic, or file uploads.
                            False if all inputs are from trusted internal sources
                            (config files, hardcoded values, internal APIs with
                            authenticated callers).

       IS_TRIVIAL: true only if ALL of the following:
         (1) Plan modifies exactly ONE file
         (2) That file has no code extension (.md, .txt, .json are OK;
             .gs/.ts/.js/.py/.html disqualify)
         (3) The change is purely additive wording/description (no architectural
             decisions, no removal of existing content, no new behavioral logic described)
         (4) Plan contains no branching decisions or conditional implementation paths
         False when uncertain — default to false (full review).

       Key: "modifies code in that domain" vs "mentions that domain in prose."
       Example: a plan editing .md files that runs npm test → IS_NODE=false.

       Output ONLY (no explanation):
       IS_GAS=true|false
       IS_NODE=true|false
       HAS_UI=true|false
       HAS_DEPLOYMENT=true|false
       HAS_STATE=true|false
       HAS_TESTS=true|false
       HAS_EXTERNAL_CALLS=true|false
       HAS_UNTRUSTED_INPUT=true|false
       IS_TRIVIAL=true|false
     """
   )
   Parse output → set IS_GAS, IS_NODE, HAS_UI, HAS_DEPLOYMENT, HAS_STATE, HAS_TESTS, HAS_EXTERNAL_CALLS, HAS_UNTRUSTED_INPUT, IS_TRIVIAL
   IF Haiku timeout or malformed output → all domain flags false, IS_TRIVIAL=false,
     HAS_TESTS=true, HAS_EXTERNAL_CALLS=true, HAS_UNTRUSTED_INPUT=true
     (fallback activates impact, testing, security clusters unconditionally)

   Compute cluster activation:
   ```
   IF IS_GAS:
     # All L2 clusters superseded by gas-evaluator except impact (for Q-C26/Q-C35/Q-C37/Q-C38/Q-C39/Q-C40 — no gas equivalent)
     active_clusters = ["impact"]  # always active — Q-C26/Q-C35/Q-C37/Q-C38/Q-C39/Q-C40 evaluate here
     if HAS_STATE:      active_clusters.append("state")  # Q-C36 has no gas equivalent; Q-C13/18/19/24 → N/A-superseded within evaluator
   ELSE:
     active_clusters = ["impact"]                    # always active (Gate 1 Q-C3)
     if HAS_TESTS:      active_clusters.append("testing")
     if HAS_STATE:      active_clusters.append("state")
     if HAS_EXTERNAL_CALLS or HAS_UNTRUSTED_INPUT:
                         active_clusters.append("security")
     if HAS_DEPLOYMENT:  active_clusters.append("operations")
     # Client cluster (Q-C17, Q-C25) merged into ui-evaluator when HAS_UI=true — no separate client-evaluator
   ```

   ```
   # Gate 1 ecosystem sets (for stability-memoization exclusion — Gate 1 never stability-memoized)
   gate1_gas = {"Q1", "Q2", "Q13", "Q15", "Q18", "Q42"}
   gate1_node = {"N1"}

   # Structurally memoizable ecosystem questions (additive-only — matches standalone patterns)
   # gas-plan: Q1, Q2 (branching steps), Q42 (post-impl section) — from gas-plan/SKILL.md:312-320
   # node-plan: N1 (tsc build check) — from node-plan/SKILL.md (parallel pattern)
   struct_memo_gas = {"Q1", "Q2", "Q42"}
   struct_memo_node = {"N1"}
   ```

   IF IS_TRIVIAL:
     Print: "╭─── FAST PATH ──────────────────╮"
     Print: "⚡ Trivial plan: 1 file ([ext]), additive only"
     Print: "  questions: Q-G1, Q-G2, Q-G5, Q-E2, Q-E1, Q-G11"
     [Substitute plan_path and questions_path (resolved in step 2) before spawning]
     Run single Task(
       subagent_type = "general-purpose",
       model = "sonnet",
       prompt = """
         Read the plan at <plan_path>.
         Read ~/.claude/CLAUDE.md for standards context.
         Read <questions_path> for question definitions (Layer 1 section).

         Evaluate ONLY these 6 questions (definitions in <questions_path>):
           Q-G1 (Approach soundness — never N/A)
           Q-G2 (Standards compliance — never N/A)
           Q-G5 (Scope focus — never N/A)
           Q-E2 (Post-implementation workflow — N/A for IS_GAS)
           Q-E1 (Git lifecycle — never N/A)
           Q-G11 (Existing code examined — N/A for doc-only plans)

         Output for each: PASS | NEEDS_UPDATE — [finding]
         If NEEDS_UPDATE: include [EDIT: instruction]
         Do not use Edit/Write/Bash tools — read-only.
       """
     )

     If all 6 PASS:
       Write gate marker: Bash "touch ~/.claude/.plan-reviewed-${plan_slug}"
       Output terminal-native fast-path scorecard:
         ╔═══════════════════════════════════╗
         ║  Scorecard (Fast Path)            ║
         ╚═══════════════════════════════════╝
         Rating: 🟢 READY — 6/6 clear

           Q-G1  Approach soundness       ✅
           Q-G2  Standards compliance     ✅
           Q-G5  Scope focus              ✅
           Q-E2  Post-implementation      ✅
           Q-E1  Git lifecycle            ✅
           Q-G11 Existing code examined   ✅
         (Replace ✅ with ❌ for any NEEDS_UPDATE — but this branch is all-PASS.)
       Strip <!-- review-plan --> markers (Edit with replace_all=true → "")
       Call ExitPlanMode
       STOP — skip convergence loop entirely

     If any NEEDS_UPDATE:
       Apply edits inline (no team).
       Re-evaluate the same 6 questions once (same Task format above,
       including substitution of plan_path and questions_path).
       If all 6 now PASS:
         Write gate marker, output terminal-native fast-path scorecard (same format as above, Rating 🟢 READY), strip markers, ExitPlanMode. STOP.
       If still NEEDS_UPDATE:
         Print: "⚡ Fast-path could not resolve — falling through to full review"
         IS_TRIVIAL = false  # force full convergence loop
         # Do not jump here — fall through to Steps 4–5 below (tracking init + results dir setup) before entering convergence loop

   Print: "╭─── CONFIG ─────────────────────╮"
   Print mode based on flags:
     IS_GAS + HAS_UI:     "📋 Review mode: GAS + UI (gas-eval + impact cluster + ui-evaluator, [N] active)"
     IS_GAS only:         "📋 Review mode: GAS (gas-eval + impact + state? clusters, [N] active)"
     IS_NODE only:        "📋 Review mode: Node.js ([N] clusters: [names] + node-eval)"
     IS_NODE + HAS_UI:    "📋 Review mode: Node.js + UI ([N] clusters: [names] + node-eval + ui-evaluator)"
     HAS_UI only:         "📋 Review mode: Standard + UI ([N] clusters: [names] + ui-evaluator)"
     All false:           "📋 Review mode: Standard ([N] clusters: [names])"
   (Raw flag debug line "IS_GAS=[v] IS_NODE=[v] HAS_UI=[v] HAS_DEPLOYMENT=[v] HAS_STATE=[v]"
   is printed during the convergence loop when pass_count >= 3, as a diagnostic aid for slow-convergence reviews.)
   Flags are set once and do NOT change between passes (evaluator set changes mid-loop
   would invalidate convergence state tracking).
   [future: IS_SEC, HAS_API]

4. **Initialize tracking:**
   ```
   pass_count = 0
   timestamp = Date.now()
   prev_needs_update_set = set()
   pass1_needs_update_set = set()  # snapshot of NEEDS_UPDATE set after pass 1 (for resolved_questions)
   total_changes_all_passes = 0    # running sum of changes_this_pass across all passes
   needs_update_counts_per_pass = []   # [7, 3, 2, ...] total NEEDS_UPDATE per pass
   pass_start_time = 0                 # reset at top of each loop iteration
   pass_durations = []                 # seconds per pass
   total_applicable_questions = 0      # computed from active_clusters + flags (set after first pass)
   memo_milestones_printed = set()     # {25, 50, 75} — each printed once
   memoized_clusters = set()       # clusters where all questions were PASS/N/A in their last pass
   memoized_since = {}             # pass_count when each cluster was memoized
   memoized_l1_questions = set()   # {Q-G11, Q-G6, Q-G7, Q-G18} once confirmed stable PASS or N/A (Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G19, Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25 are not memoizable)
   l1_structural_memoized = false    # true when ALL 6 structural questions PASS/N/A for 2 consecutive passes AND no edits since
   l1_structural_memoized_since = 0
   l1_structural_clean_since = 0    # pass_count when first consecutive clean pass was observed (0 = not yet started)
   l1_process_memoized = false       # true when ALL 13 process questions PASS/N/A AND no edits since
   l1_process_memoized_since = 0
   prev_pass_results = {}          # Q-ID → PASS/NEEDS_UPDATE/N/A from previous pass (for stability-based memoization)
   memoized_gas_questions = set()    # gas Q-IDs confirmed stable (structural + stability-based)
   memoized_gas_since = {}           # Q-ID → pass_count when memoized
   memoized_node_questions = set()   # node N-IDs confirmed stable
   memoized_node_since = {}          # N-ID → pass_count when memoized
   prev_gas_results = {}             # Q-ID → PASS/NEEDS_UPDATE/N/A from previous pass
   prev_node_results = {}            # N-ID → PASS/NEEDS_UPDATE/N/A from previous pass
   prev_pass_applied_edits = []   # list of {q_id, evaluator, summary} from previous pass
   MAX_CONCURRENT = 5              # max parallel evaluator tasks per wave; tunable
   dispatch_start_time = 0    # set before wave spawning
   fanin_start_time = 0       # set after all waves complete
   apply_start_time = 0       # set before edit application
   pass_phase_timings = []    # [{dispatch: Ns, fanin: Ns, apply: Ns, total: Ns}] per pass
   evaluators_spawned_total = 0  # running sum of evaluators spawned across all passes
   memo_file = "~/.claude/.review-plan-memo-" + plan_slug + ".json"
   # memo_file: checkpoint written after each pass for context-compression resilience.
   # Path is stable (no timestamp) so context recovery always finds the right file.
   # If state is lost mid-loop (long reviews): re-read memo_file at start of next pass.
   advisory_findings_cache = {}
   # advisory_findings_cache: Q-ID → {"finding": "<text>", "source": "<evaluator>"}
   # Populated each non-memoized evaluator pass (Gate 3 advisory questions only, per GATE3_QIDS).
   # Later-pass entries overwrite earlier — preserves freshest advisory text.
   # Entry cleared when PASS with empty finding — signals condition was resolved by edits.
   # Persisted in memo_file checkpoint for context-compression resilience.
   ```

5. **Results directory setup:**
   ```
   RESULTS_DIR = Bash: mktemp -d /tmp/review-plan.XXXXXX
   # NOTE: use RESULTS_DIR, not $TMPDIR (macOS system env — do not overwrite)
   IF memo_file exists:
     Merge memo_file: write/update {results_dir: RESULTS_DIR} field (preserve other fields — pass_count, etc.)
   ELSE:
     Write memo_file with JSON: {results_dir: RESULTS_DIR, pass_count: 0}
   Print: "  results: $RESULTS_DIR"
   ```
   Print: "╭─── REVIEW ─────────────────────╮"
   Print: "  >> Beginning convergence loop — evaluating plan quality across all active layers"

6. **Error handling:** Wrap the entire convergence loop:
   ```
   IF any unrecoverable error during convergence loop:
     Bash: rm -rf "$RESULTS_DIR"
     Surface error to user via AskUserQuestion
   ```
   Orphan cleanup (run once at setup, before the loop):
   ```
   Bash: find /tmp -maxdepth 1 -name 'review-plan.*' -mmin +60 -exec rm -rf {} + 2>/dev/null
   ```

---

## Gate Tier Semantics

Gate tiers classify findings by severity and convergence impact. These definitions are canonical — do not defer to QUESTIONS.md if it is not in context.

| Tier | Label | Convergence role | SOLID/GAPS rating impact |
|------|-------|-----------------|--------------------------|
| **Gate 1** | Blocking | MUST resolve before convergence (loop continues even if changes_this_pass == 0) | Unresolved → REWORK rating |
| **Gate 2** | Important | Advisory for rating; NOT convergence-blocking once Gate 1 is clear | Unresolved → SOLID (1-3 open) or GAPS (4+ open) |
| **Gate 3** | Informational | Noted in scorecard only; never affects convergence or rating | Counted in scorecard advisory section only |

**Gate 1 question IDs by mode:**
- **Non-GAS / Non-NODE (standard):** Q-G1, Q-G2, Q-G11, Q-C3 (loop); Q-E1, Q-E2 (epilogue)
- **IS_GAS mode:** Q-G1, Q-G2, Q-G11 (L1); Q1, Q2, Q13, Q15, Q18, Q42 (gas-evaluator). Q-E1 and Q-E2 are N/A for IS_GAS (covered by Q1/Q2 and Q42).
- **IS_NODE mode:** Q-G1, Q-G2, Q-G11, Q-C3 (loop); Q-E1, Q-E2 (epilogue); N1 (node-evaluator)

**Gate 2** comprises all remaining questions not listed above and not designated Gate 3.
**Gate 3** questions are explicitly marked in QUESTIONS.md with `[Gate 3]`; when QUESTIONS.md is unavailable, treat all unlisted questions as Gate 2.

---

## Convergence Loop

```
DO:
  -- Context-compression recovery: if memoized state appears lost, restore from checkpoint --
  _recovered_this_pass = false
  IF memo_file exists AND (memoized_clusters is empty AND memoized_l1_questions is empty AND pass_count == 0):
    Read memo_file → restore memoized_clusters, memoized_since, memoized_l1_questions,
                     l1_structural_memoized (default false), l1_structural_memoized_since (default 0),
                     l1_structural_clean_since (default 0),
                     l1_process_memoized (default false), l1_process_memoized_since (default 0),
                     prev_needs_update_set, pass1_needs_update_set, prev_pass_results,
                     prev_pass_applied_edits (default []),
                     total_changes_all_passes, pass_count,
                     needs_update_counts_per_pass, pass_durations,
                     total_applicable_questions, memo_milestones_printed,
                     memoized_gas_questions (default set()),
                     memoized_gas_since (default {}),
                     memoized_node_questions (default set()),
                     memoized_node_since (default {}),
                     prev_gas_results (default {}),
                     prev_node_results (default {}),
                     pass_phase_timings (default []),
                     evaluators_spawned_total (default 0),
     advisory_findings_cache (default {})
    results_dir = memo_data.results_dir
    # Guard for old memo format (written before task fan-out refactor)
    IF results_dir is null or empty:
      IF memo_data.team_name is present:
        Print: "⚠️ Old memo format detected — starting fresh (team-based memo not compatible)"
      results_dir = Bash: mktemp -d /tmp/review-plan.XXXXXX
    # Verify temp dir still exists (macOS /tmp cleanup)
    ELSE IF NOT Bash: test -d "$results_dir":
      results_dir = Bash: mktemp -d /tmp/review-plan.XXXXXX
      Print: "⚠️ Results dir gone — created new: $results_dir"
    RESULTS_DIR = results_dir
    # Guard: old memo files may contain "git" which is no longer a loop cluster
    memoized_clusters = memoized_clusters.intersection(active_clusters)
    memoized_since = {k: v for k, v in memoized_since.items() if k in memoized_clusters}
    _recovered_this_pass = true
    Print: "⚠️ Context recovery: restored state from checkpoint (pass [pass_count])"

  IF NOT _recovered_this_pass:
    pass_count += 1
  pass_start_time = Date.now()

  -- Clear previous pass results from RESULTS_DIR --
  IF pass_count > 1:
    Bash: rm -f "$RESULTS_DIR"/*.json
    # Fresh files each pass — prevents stale results from prior pass
    Print: "  cleared pass [pass_count - 1] results"
  changes_this_pass = 0
  l1_changes = 0
  cluster_changes = {}            # maps cluster_name → change count this pass
  cluster_changes_total = 0
  gas_plan_changes = 0
  node_plan_changes = 0
  ui_plan_changes = 0
  gas_results = {}    # populated by fully-memoized branch or evaluator parse block; empty = error/no response
  node_results = {}   # same pattern
  l1_results = {}
  l1_edits = {}
  cluster_results = {}
  ui_results = {}
  all_results = {}    # pass-level accumulator — each wave appends; routing + status grid read from this

  Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count]/5 ─── evaluating…"  # 5 = max passes ceiling (pass_count >= 5 in CONVERGENCE CHECK)
  Print: "  >> Spawning evaluators to assess the plan — collecting findings"

  -- Early memoization invalidation (top-of-pass, before wave spawning) --
  IF l1_process_memoized AND len(prev_pass_applied_edits) > 0:
    l1_process_memoized = false
    l1_process_memoized_since = 0
    Print: "  memo: l1-advisory-process early-invalidated (prev pass had edits)"
  IF l1_structural_memoized AND len(prev_pass_applied_edits) > 0:
    l1_structural_memoized = false
    l1_structural_clean_since = 0
    Print: "  memo: l1-advisory-structural early-invalidated (prev pass had edits)"

  [Substitute plan_path, questions_path, questions_l3_path, gas_eval_path, node_eval_path, and RESULTS_DIR (all derived in Step 0/5) into evaluator prompts before spawning]

  -- Build evaluator list (priority-ordered for wave assignment) --
  evaluators_to_spawn = []  # list of {name, task_prompt}

  # Priority 1a: L1 blocking (Gate 1, always runs, 3 questions)
  evaluators_to_spawn.append({name: "l1-blocking", task_config: <l1_blocking_config below>})

  # Priority 1b: L1 advisory structural (Gate 2/3, 6 questions — skip if group-memoized)
  IF NOT l1_structural_memoized:
    evaluators_to_spawn.append({name: "l1-advisory-structural", task_config: <l1_advisory_structural_config below>})

  # Priority 1c: L1 advisory process (Gate 2/3, 13 questions — skip if group-memoized)
  IF NOT l1_process_memoized:
    evaluators_to_spawn.append({name: "l1-advisory-process", task_config: <l1_advisory_process_config below>})

  # Priority 2: Ecosystem evaluator (largest question set after L1)
  IF IS_GAS AND NOT fully_memoized_gas:
    evaluators_to_spawn.append({name: "gas-evaluator", task_config: <gas_config below>})
  ELSE IF IS_NODE AND NOT fully_memoized_node:
    evaluators_to_spawn.append({name: "node-evaluator", task_config: <node_config below>})

  # Priority 3: Impact cluster (always active, Q-C3/Q-C26/Q-C35/Q-C37/Q-C38/Q-C39/Q-C40)
  IF "impact" in active_clusters AND "impact" NOT in memoized_clusters:
    evaluators_to_spawn.append({name: "impact-evaluator", task_config: <cluster_config("impact")>})

  # Priority 4: Remaining clusters by question count descending
  FOR each remaining cluster in [security, state, testing, operations]:
    IF cluster in active_clusters AND cluster NOT in memoized_clusters:
      evaluators_to_spawn.append({name: "<cluster>-evaluator", task_config: <cluster_config(cluster)>})

  # Priority 5: UI evaluator (last — rarely blocking)
  IF HAS_UI:
    evaluators_to_spawn.append({name: "ui-evaluator", task_config: <ui_config below>})

  -- Concurrency invariants --
  # Each evaluator writes to <RESULTS_DIR>/<name>.json (unique by construction). No shared paths.
  # Evaluators are read-only on the plan — all edits applied by orchestrator after fan-in.

  -- Wave spawning --
  dispatch_start_time = Date.now()
  total_evaluators = len(evaluators_to_spawn)
  evaluators_spawned_total += total_evaluators
  waves = chunk(evaluators_to_spawn, MAX_CONCURRENT)
  Print: "  >> Building evaluator wave schedule"
  Print: "  evaluators: [total_evaluators] across [len(waves)] wave(s) (max [MAX_CONCURRENT] concurrent)"

  FOR wave_idx, wave in enumerate(waves):
    wave_names = [e.name for e in wave]
    Print: "  ⟫ wave [wave_idx+1]/[len(waves)]: [comma-sep wave_names]"

    [In a SINGLE message, spawn all evaluator Tasks in this wave]
    # Tasks are foreground — this message blocks until all Tasks in the wave complete.
    # Each Task tool call returns a result (success text or error).

    -- Check Task return status before reading results --
    # After all Tasks return, inspect each tool result:
    FOR each task_result in wave task results:
      evaluator_name = extract name from task_result  # matches wave entry
      IF task_result indicates tool-level failure (error, crash, context limit):
        # Write error sentinel immediately — fail fast on task errors
        Bash: echo '{"evaluator":"[evaluator_name]","pass":[pass_count],"status":"error","error":"Task failed: [brief error]"}' > '<RESULTS_DIR>/[evaluator_name].json'
        Print: "    ✗ [evaluator_name] — task failed: [brief error]"
      ELSE:
        # Task completed successfully at tool level.
        # Verify the JSON file was actually written (defense-in-depth):
        IF NOT Bash: test -f '<RESULTS_DIR>/[evaluator_name].json':
          # Task returned success but didn't write its file — treat as error
          Bash: echo '{"evaluator":"[evaluator_name]","pass":[pass_count],"status":"error","error":"Task completed but no JSON file written"}' > '<RESULTS_DIR>/[evaluator_name].json'
          Print: "    ✗ [evaluator_name] — no output file (task returned successfully but wrote nothing)"

    -- Read wave results and print progress (single-read fan-in) --
    # All Tasks are foreground — by this point every Task has completed and written its JSON.
    # No polling needed; read once immediately.
    wave_results = {}  # name → parsed JSON
    wave_progress_idx = 0
    FOR each name in wave_names:
      IF file <RESULTS_DIR>/<name>.json exists:
        TRY: data = Read <RESULTS_DIR>/<name>.json → parse JSON
        CATCH: data = {evaluator: name, status: "error", error: "malformed JSON"}
      ELSE:
        # Should not happen (Task status check writes sentinels), but guard:
        data = {evaluator: name, status: "error", error: "no output file"}

      wave_results[name] = data
      wave_progress_idx += 1

      # Print progress
      IF data.status == "complete":
        nu = data.counts.needs_update; p = data.counts.pass; na = data.counts.na
        Print: "    [[wave_progress_idx]/[len(wave_names)]] ✓ [name] — ✗[nu] ✓[p] —[na]  [[data.elapsed_s]s]"
      ELSE IF data.status == "error":
        Print: "    [[wave_progress_idx]/[len(wave_names)]] ✗ [name] — error: [data.error]"
    # Accumulate into pass-level collection
    FOR name, data in wave_results:
      all_results[name] = data

    Print: "  ── wave [wave_idx+1] complete: [len(wave_results)]/[len(wave_names)]"
    Print: "  >> Wave [wave_idx+1] finished — merging results into pass accumulator"

  fanin_start_time = Date.now()

  -- Print memoized evaluators (not spawned) --
  FOR each cluster_name in memoized_clusters:
    Print: "  ⏭ [cluster_name]-evaluator ── memoized (stable since p[memoized_since[cluster_name]])"
  IF IS_GAS AND fully_memoized_gas:
    Print: "  gas-eval ── ⏭ fully memoized (all [applicable_gas_count] questions stable)"
    gas_plan_changes = 0
    gas_results = {q_id: "PASS" for q_id in memoized_gas_questions}
  IF IS_NODE AND fully_memoized_node:
    Print: "  node-eval ── ⏭ fully memoized (all [applicable_node_count] questions stable)"
    node_plan_changes = 0
    node_results = {n_id: "PASS" for n_id in memoized_node_questions}
  IF l1_structural_memoized:
    structural_questions = {"Q-G20", "Q-G21", "Q-G22", "Q-G23", "Q-G24", "Q-G25"}
    FOR q in structural_questions:
      l1_results[q] = "PASS"  # group-memoized — all were PASS/N/A
    Print: "  ⏭ l1-advisory-structural ── memoized (6 questions stable since p[l1_structural_memoized_since])"
  IF l1_process_memoized:
    process_questions = {"Q-G4", "Q-G5", "Q-G6", "Q-G7", "Q-G8", "Q-G10",
      "Q-G12", "Q-G13", "Q-G14", "Q-G16", "Q-G17", "Q-G18", "Q-G19"}
    FOR q in process_questions:
      l1_results[q] = "PASS"  # group-memoized — all were PASS/N/A
    Print: "  ⏭ l1-advisory-process ── memoized (13 questions stable since p[l1_process_memoized_since])"

  --- L1 Blocking Evaluator Config (Gate 1: 3 questions, always runs, never memoized) ---
  l1_blocking_config = Task(
    subagent_type = "general-purpose",
    model = "sonnet",
    name = "l1-blocking-p" + pass_count,
    prompt = """
      You are evaluating a plan for critical quality (Layer 1 Gate 1: 3 questions).

      Question definitions: Read <questions_path> (Layer 1, Gate 1 section)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ONLY these 3 questions: Q-G1, Q-G2, Q-G11
      Calibration: Prioritize practical production implications over theoretical concerns.
      Flag findings that would cause real failures, wasted effort, or incorrect implementations
      at development time — not hypothetical risks that require unlikely conditions to manifest.
      When deciding between PASS and NEEDS_UPDATE for a borderline finding, ask: "Would a
      senior developer implementing this plan actually encounter this problem?" If the answer
      is "only under unusual circumstances," mark PASS.
      Apply triage (mark N/A per the N/A column).
      Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
      or <!-- node-plan -->.

      [IF pass_count > 1 AND prev_pass_applied_edits is non-empty, append:]
      Previous pass applied [N] edit(s):
        - [Q-ID] ([evaluator]): [summary]
        ...
      Focus verification on plan sections touched by these edits.
      Confirm fixes resolve flagged issues without introducing new problems.

      [IF pass_count > 1 AND prev_pass_applied_edits is empty:]
      Previous pass applied 0 edits — plan unchanged. Verify your questions still PASS.

      Finding specificity: For each NEEDS_UPDATE finding, reference the specific plan passage
      (quote or cite by step number) that is deficient. Do not generalize ("the plan lacks X")
      without citing which step or section is responsible.

      Question-specific methodology:
      - For Q-G1 (Approach soundness): When the plan uses explicit constraint-assertion language
        ("X is too slow", "Y won't work", "Z is unavailable", "X has too much overhead") to
        justify an architectural choice — apply challenge-justify-check:
          (1) Identify the constrained choice and the assertion used to justify it
          (2) Check whether the assertion is backed by measurement, benchmark, or cited evidence
          (3) If assertion is bare (no evidence) → NEEDS_UPDATE; if evidence is cited → PASS
        If the plan does NOT use constraint-assertion language, skip this check entirely.
        Example — NEEDS_UPDATE: "Plan states 'PropertiesService is too slow' with no benchmark.
          [EDIT: add measured latency or justify the choice on architectural grounds]"
        Example — PASS: "Plan cites 'better-sqlite3: 2.3µs vs 45µs flat-file, 10k iterations
          (bench/results/...)'. Evidence-backed approach — no challenge needed."

      Output contract — write findings to JSON file:
        Write your findings to: <RESULTS_DIR>/l1-blocking.json

        JSON schema:
        {
          "evaluator": "l1-blocking",
          "pass": <pass_count>,
          "status": "complete",
          "elapsed_s": <seconds_from_start>,
          "findings": {
            "<Q-ID>": {"status": "PASS|NEEDS_UPDATE|N/A", "finding": "<text>", "edit": "<instruction or null>"},
            ...
          },
          "counts": {"pass": N, "needs_update": N, "na": N}
        }

        Write atomically using Bash (ensures clean reads by orchestrator):
          cat > '<RESULTS_DIR>/l1-blocking.json.tmp' << 'EVAL_EOF'
          <json>
          EVAL_EOF
          mv '<RESULTS_DIR>/l1-blocking.json.tmp' '<RESULTS_DIR>/l1-blocking.json'

        If you encounter an error reading inputs, write:
          {"evaluator": "l1-blocking", "pass": <pass_count>, "status": "error", "error": "<message>"}

      Constraints:
      - Do not use Edit or Write tools on the plan file — read-only
      - Use Bash ONLY to write your findings JSON to the specified path
      - Do not call ExitPlanMode or touch marker files
      - Write exactly ONE JSON file

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  --- L1 Advisory Structural Evaluator Config (Gate 2/3: 6 abstract/structural questions, group-memoizable) ---
  --- Pass A runs first (while model is at full attention): Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25 ---
  l1_advisory_structural_config = Task(
    subagent_type = "general-purpose",
    model = "sonnet",
    name = "l1-advisory-structural-p" + pass_count,
    prompt = """
      You are evaluating a plan for abstract/structural quality (Layer 1 Gate 2/3: 6 questions).

      Question definitions: Read <questions_path> (Layer 1, Gate 2 and Gate 3 sections)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ONLY these 6 abstract/structural questions: Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25
      Calibration: Prioritize practical production implications over theoretical concerns.
      Flag findings that would cause real failures, wasted effort, or incorrect implementations
      at development time — not hypothetical risks that require unlikely conditions to manifest.
      When deciding between PASS and NEEDS_UPDATE for a borderline finding, ask: "Would a
      senior developer implementing this plan actually encounter this problem?" If the answer
      is "only under unusual circumstances," mark PASS.
      Apply triage (mark N/A per the N/A column).
      Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
      or <!-- node-plan -->.
      [IF memoized_l1_questions intersects {Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25} is non-empty, append to prompt:]
      Memoized questions — SKIP, already stable (PASS or N/A): [comma-separated relevant memoized_l1_questions]
      These were confirmed PASS or N/A in a prior pass and are structurally stable.
      Do not re-evaluate them; treat as PASS in your output.

      [IF pass_count > 1 AND prev_pass_applied_edits is non-empty, append:]
      Previous pass applied [N] edit(s):
        - [Q-ID] ([evaluator]): [summary]
        ...
      Focus verification on plan sections touched by these edits.
      Confirm fixes resolve flagged issues without introducing new problems.

      [IF pass_count > 1 AND prev_pass_applied_edits is empty:]
      Previous pass applied 0 edits — plan unchanged. Verify your questions still PASS.

      Finding specificity: For each NEEDS_UPDATE finding, reference the specific plan passage
      (quote or cite by step number) that is deficient. Do not generalize ("the plan lacks X")
      without citing which step or section is responsible.

      Question-specific methodology:
      - For Q-G20 (Story arc coherence): Check 4 elements — (1) problem/need statement,
        (2) approach and why it was chosen, (3) expected outcome, (4) testable verification assertion.
        Subtype A: design/approach section claims a behavior no implementation step produces.
        Subtype B: verification section uses untestable assertions ("verify it works", "check for regressions").
        Both subtypes → NEEDS_UPDATE. Cite the specific missing element or untestable assertion.
        If story arc is entirely absent, produce edit: "[EDIT: inject after plan title:
        '## Context\n[What problem or need this addresses and what current state changes]\n\n
        ## Approach\n[What this plan will do and why this method]\n\n
        ## Expected Outcome\n[What success looks like and how it is verified]']"
        For partial story arcs, cite the specific missing element in your finding.
      - For Q-G21 (internal logic consistency) and Q-G22 (cross-phase dependency):
        Use trace-verify-cite: (1) identify each claim, cross-reference, or data access
        (2) trace it to its declared source (prior phase output, schema, function signature)
        (3) if source does not exist or contradicts the claim → NEEDS_UPDATE.
        Before writing PASS, confirm you traced the reference to its source — not just
        scanned for keyword presence.
      - For Q-G23 (Proportionality): Compare plan step count and detail level to the scope of
        the change. Cite the specific mismatch (e.g., "Phase 3 has 12 sub-steps for a one-line
        config change"). If step density is proportionate to complexity → PASS.
      - For Q-G24 (Core-vs-derivative): Identify the most foundational new function or schema
        introduced by the plan. Verify it is fully specified before steps that depend on it
        (wiring, callers, tests). If wiring or derivative steps precede the core logic
        specification → NEEDS_UPDATE.
      - For Q-G25 (Feedback loop): Identify who or what downstream consumes this change's outputs
        (callers, automated tests, named acceptance criteria, or stakeholder verification steps).
        NEEDS_UPDATE: No feedback mechanism of any kind is present — no test step, no acceptance
        criterion, no named verification path (e.g., plan ends with "deploy and monitor" with no
        stated pass/fail condition).
        PASS: At least one concrete feedback mechanism is named — an automated test step, a specific
        acceptance criterion with a pass condition, or an integration test. A manual verification step
        with a stated pass condition also qualifies.
        Gate 3 advisory (do NOT NEEDS_UPDATE): A feedback mechanism is present but weak (e.g., only
        "run it manually and see" with no criterion). Note in finding as advisory only.
        Example — NEEDS_UPDATE: "Plan's Steps section lists deploy steps with no verification step.
          [EDIT: add '## Verification\n- Run npm test\n- Confirm no regressions in CI']"
        Example — PASS: "Plan includes 'Run npm test for unit tests' in Verification — feedback loop present."

      Output contract — write findings to JSON file:
        Write your findings to: <RESULTS_DIR>/l1-advisory-structural.json

        JSON schema:
        {
          "evaluator": "l1-advisory-structural",
          "pass": <pass_count>,
          "status": "complete",
          "elapsed_s": <seconds_from_start>,
          "findings": {
            "<Q-ID>": {"status": "PASS|NEEDS_UPDATE|N/A", "finding": "<text>", "edit": "<instruction or null>"},
            ...
          },
          "counts": {"pass": N, "needs_update": N, "na": N}
        }

        Write atomically using Bash (ensures clean reads by orchestrator):
          cat > '<RESULTS_DIR>/l1-advisory-structural.json.tmp' << 'EVAL_EOF'
          <json>
          EVAL_EOF
          mv '<RESULTS_DIR>/l1-advisory-structural.json.tmp' '<RESULTS_DIR>/l1-advisory-structural.json'

        If you encounter an error reading inputs, write:
          {"evaluator": "l1-advisory-structural", "pass": <pass_count>, "status": "error", "error": "<message>"}

      Constraints:
      - Do not use Edit or Write tools on the plan file — read-only
      - Use Bash ONLY to write your findings JSON to the specified path
      - Do not call ExitPlanMode or touch marker files
      - Write exactly ONE JSON file

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  --- L1 Advisory Process Evaluator Config (Gate 2/3: 13 standards/process questions, group-memoizable) ---
  --- Pass B runs second: Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19 ---
  l1_advisory_process_config = Task(
    subagent_type = "general-purpose",
    model = "sonnet",
    name = "l1-advisory-process-p" + pass_count,
    prompt = """
      You are evaluating a plan for standards/process quality (Layer 1 Gate 2/3: 13 questions).

      Question definitions: Read <questions_path> (Layer 1, Gate 2 and Gate 3 sections)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ONLY these 13 standards/process questions: Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19
      Calibration: Prioritize practical production implications over theoretical concerns.
      Flag findings that would cause real failures, wasted effort, or incorrect implementations
      at development time — not hypothetical risks that require unlikely conditions to manifest.
      When deciding between PASS and NEEDS_UPDATE for a borderline finding, ask: "Would a
      senior developer implementing this plan actually encounter this problem?" If the answer
      is "only under unusual circumstances," mark PASS.
      Apply triage (mark N/A per the N/A column).
      Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
      or <!-- node-plan -->.
      [IF memoized_l1_questions intersects {Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19} is non-empty, append to prompt:]
      Memoized questions — SKIP, already stable (PASS or N/A): [comma-separated relevant memoized_l1_questions]
      These were confirmed PASS or N/A in a prior pass and are structurally stable.
      Do not re-evaluate them; treat as PASS in your output.

      [IF pass_count > 1 AND prev_pass_applied_edits is non-empty, append:]
      Previous pass applied [N] edit(s):
        - [Q-ID] ([evaluator]): [summary]
        ...
      Focus verification on plan sections touched by these edits.
      Confirm fixes resolve flagged issues without introducing new problems.

      [IF pass_count > 1 AND prev_pass_applied_edits is empty:]
      Previous pass applied 0 edits — plan unchanged. Verify your questions still PASS.

      Finding specificity: For each NEEDS_UPDATE finding, reference the specific plan passage
      (quote or cite by step number) that is deficient. Do not generalize ("the plan lacks X")
      without citing which step or section is responsible.

      Question-specific methodology:
      - For Q-G13 (Phased decomposition): Apply four detection patterns in order:
          (1) Flat list: plan has >3 implementation steps with no phase/section headers →
              NEEDS_UPDATE. Cite the flat list and its step count.
          (2) Test-at-end: phases exist but testing is consolidated in a final phase rather
              than distributed per-phase → NEEDS_UPDATE. Cite the testing phase
              (e.g., "Phase 4 consolidates all testing — each phase should verify its own work").
          (3) Commit-before-test: a phase has a git commit step before its verification/test
              step → NEEDS_UPDATE. Cite the misordered steps.
          (4) No checkpoint: phases depend on each other with no explicit go/no-go between
              them → NEEDS_UPDATE. Cite the dependency.
        Borderline: plan has phase headers but phases lack internal test steps:
        - If phases also lack Pre-check/go-no-go markers → NEEDS_UPDATE (condition 2: no
          per-phase verification of any kind). Cite the absent verification.
        - If phases have explicit Pre-check or go/no-go markers but no per-phase tests →
          NEEDS_UPDATE (mild: suggest distributing test steps, acknowledge checkpoints exist).
      - For Q-G10 (Assumption exposure): Apply two detection categories:
          Category 1 — Explicit markers: scan for "TBD", "need to determine", "maybe",
              and similar uncertainty markers → always NEEDS_UPDATE. Cite the marker and its location.
          Category 2 — Implicit constraints: scan for statements presented as facts that could
              be wrong where no investigation step validates the choice. Ask: "Could this be wrong,
              and would the plan discover it before committing work?" If no → flag as unstated
              assumption. Cite the statement and explain why it is unvalidated.
        Borderline: plan states "we assume X" explicitly → PASS if the assumption is reasonable
        and stated. "X won't work" or "Y is required" without citing evidence → NEEDS_UPDATE
        (unvalidated constraint presented as established fact).

      Output contract — write findings to JSON file:
        Write your findings to: <RESULTS_DIR>/l1-advisory-process.json

        JSON schema:
        {
          "evaluator": "l1-advisory-process",
          "pass": <pass_count>,
          "status": "complete",
          "elapsed_s": <seconds_from_start>,
          "findings": {
            "<Q-ID>": {"status": "PASS|NEEDS_UPDATE|N/A", "finding": "<text>", "edit": "<instruction or null>"},
            ...
          },
          "counts": {"pass": N, "needs_update": N, "na": N}
        }

        Write atomically using Bash (ensures clean reads by orchestrator):
          cat > '<RESULTS_DIR>/l1-advisory-process.json.tmp' << 'EVAL_EOF'
          <json>
          EVAL_EOF
          mv '<RESULTS_DIR>/l1-advisory-process.json.tmp' '<RESULTS_DIR>/l1-advisory-process.json'

        If you encounter an error reading inputs, write:
          {"evaluator": "l1-advisory-process", "pass": <pass_count>, "status": "error", "error": "<message>"}

      Constraints:
      - Do not use Edit or Write tools on the plan file — read-only
      - Use Bash ONLY to write your findings JSON to the specified path
      - Do not call ExitPlanMode or touch marker files
      - Write exactly ONE JSON file

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  --- Cluster Evaluator Config (template for each active, non-memoized cluster) ---
  cluster_config(cluster_name) = Task(
    subagent_type = "general-purpose",
    model = "sonnet",
    name = "<cluster_name>-evaluator-p" + pass_count,
    prompt = """
      You are evaluating a plan for <cluster_description> (<N> questions in this cluster).
      Prioritize practical production implications over theoretical concerns.
      Flag real-world risks (deployment failures, data loss, breaking changes)
      that a checklist review would miss.

      Question definitions: Read <questions_path>,
        section "### Cluster <N>: <cluster_name>".
      Skip content marked <!-- review-plan --> or <!-- gas-plan --> or <!-- node-plan -->.

      Context flags (substituted by team-lead at spawn time):
        IS_NODE=<IS_NODE>   IS_GAS=<IS_GAS>   HAS_UI=<HAS_UI>
        HAS_DEPLOYMENT=<HAS_DEPLOYMENT>   HAS_STATE=<HAS_STATE>

      IS_NODE suppression (apply only when IS_NODE=true above):
        Q-C16 (Security cluster, →N6), Q-C18 (State cluster, →N8), Q-C21 (Operations cluster, →N22),
        Q-C30 (Security, →N6/N7), Q-C31 (Security, →N13/N27), Q-C32 (Impact, →N14),
        Q-C33 (Security, →N9/N10), Q-C34 (Security, →N28)
        are N/A-superseded when IS_NODE=true.
      IS_GAS note: if you are the impact-evaluator and IS_GAS=true above, evaluate Q-C26, Q-C35, Q-C37, Q-C38, Q-C39, Q-C40 only;
        Q-C3, Q-C8, Q-C12, Q-C14, Q-C27, Q-C32 are N/A-superseded (covered by gas-evaluator).
        When IS_GAS=true and you are the impact-evaluator: you are the ONLY L2 cluster evaluator
        running. Questions Q-C37, Q-C38, Q-C39, Q-C40 (the tracing questions) are your exclusive
        responsibility — no other evaluator will assess them.
        If you are the state-evaluator and IS_GAS=true above, evaluate Q-C36 only;
        Q-C13, Q-C18, Q-C19, Q-C24 are N/A-superseded (covered by gas-evaluator).

      [IF pass_count > 1 AND prev_pass_applied_edits is non-empty, append:]
      Previous pass applied [N] edit(s):
        - [Q-ID] ([evaluator]): [summary]
        ...
      Focus verification on plan sections touched by these edits.
      Confirm fixes resolve flagged issues without introducing new problems.

      [IF pass_count > 1 AND prev_pass_applied_edits is empty:]
      Previous pass applied 0 edits — plan unchanged. Verify your questions still PASS.

      Finding specificity: For each NEEDS_UPDATE finding, reference the specific plan passage
      (quote or cite by step number) that is deficient. Do not generalize ("the plan lacks X")
      without citing which step or section is responsible.

      Question-specific methodology (apply only to questions in YOUR cluster):
      - For Q-C37, Q-C38, Q-C39, Q-C40 (tracing questions, impact cluster):
        Use trace-verify-cite: (1) identify each claim, cross-reference, or data access
        (2) trace it to its declared source (prior phase output, schema, function signature)
        (3) if source does not exist or contradicts the claim → NEEDS_UPDATE.
        Before writing PASS on these questions, confirm you traced the reference to its
        source — not just scanned for keyword presence.
      [IF cluster_name == "impact", append:]
        Example (Q-C39): "NEEDS_UPDATE — Step 1 extracts Field 3 as 'kind', but the
        actual TYPES format (shared-types.sh) has repo_subdir at position 3 and kind at
        position 4. [EDIT: correct field extraction in step 1 to use position 4 for kind]"

      Output contract — write findings to JSON file:
        Write your findings to: <RESULTS_DIR>/<cluster_name>-evaluator.json

        JSON schema:
        {
          "evaluator": "<cluster_name>-evaluator",
          "pass": <pass_count>,
          "status": "complete",
          "elapsed_s": <seconds_from_start>,
          "findings": {
            "<Q-ID>": {"status": "PASS|NEEDS_UPDATE|N/A", "finding": "<text>", "edit": "<instruction or null>"},
            ...
          },
          "counts": {"pass": N, "needs_update": N, "na": N}
        }

        Write atomically using Bash (ensures clean reads by orchestrator):
          cat > '<RESULTS_DIR>/<cluster_name>-evaluator.json.tmp' << 'EVAL_EOF'
          <json>
          EVAL_EOF
          mv '<RESULTS_DIR>/<cluster_name>-evaluator.json.tmp' '<RESULTS_DIR>/<cluster_name>-evaluator.json'

        If you encounter an error reading inputs, write:
          {"evaluator": "<cluster_name>-evaluator", "pass": <pass_count>, "status": "error", "error": "<message>"}

      Constraints:
      - Do not use Edit or Write tools on the plan file — read-only
      - Use Bash ONLY to write your findings JSON to the specified path
      - Do not call ExitPlanMode or touch marker files
      - Write exactly ONE JSON file

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  --- Cluster Evaluators (one Task per active cluster) ---
  For each cluster_name in active_clusters:
    IF cluster_name in memoized_clusters:
      Print: "  ⏭ [cluster_name]-evaluator ── memoized (stable since p[memoized_since[cluster_name]])"
      # Memoized clusters have 0 NEEDS_UPDATE by definition — no carry-forward needed.
      # NEEDS_UPDATE tracking is unaffected by PASS/N/A questions (they never enter the set).
      CONTINUE to next cluster
  [Cluster evaluator task uses cluster_config(cluster_name) — see config above]

  IF IS_GAS:
    # Build gas memoization directive (mirrors gas-plan/SKILL.md:130-135)
    gas_memo_directive = ""
    IF memoized_gas_questions is non-empty:
      ids = comma-sep sorted memoized_gas_questions
      gas_memo_directive = "Memoized questions — SKIP (stable PASS): " + ids + "\nOutput these as \"Q{N}: PASS (memoized)\" without re-evaluating."

    applicable_gas_count = 53  # total gas questions in evaluate mode (Q43 is post-loop only)
    fully_memoized_gas = len(memoized_gas_questions) >= applicable_gas_count

  ELSE IF IS_NODE:
    # Build node memoization directive (same pattern as gas)
    node_memo_directive = ""
    IF memoized_node_questions is non-empty:
      ids = comma-sep sorted memoized_node_questions
      node_memo_directive = "Memoized questions — SKIP (stable PASS): " + ids + "\nOutput these as \"N{N}: PASS (memoized)\" without re-evaluating."

    applicable_node_count = 38  # total node questions
    fully_memoized_node = len(memoized_node_questions) >= applicable_node_count

  --- GAS Evaluator Config ---
  gas_config = Task(
    subagent_type = "general-purpose",
    model = "sonnet",
    name = "gas-evaluator-p" + pass_count,
    prompt = """
      You are the gas-eval running inside a review-plan evaluator task. Follow the instructions in
      <gas_eval_path> exactly.

      results_dir = <RESULTS_DIR>
      evaluator_name = gas-evaluator

      [IF gas_memo_directive is non-empty, append it here]

      [IF pass_count > 1 AND prev_pass_applied_edits is non-empty, append:]
      Previous pass applied [N] edit(s):
        - [Q-ID] ([evaluator]): [summary]
        ...
      Focus verification on plan sections touched by these edits.
      Confirm fixes resolve flagged issues without introducing new problems.

      [IF pass_count > 1 AND prev_pass_applied_edits is empty:]
      Previous pass applied 0 edits — plan unchanged. Verify your questions still PASS.

      Plan to evaluate: <plan_path>

      Constraints: read-only — do not edit the plan, do not call ExitPlanMode.
      Write exactly ONE JSON file to the results_dir.
    """
  )

  --- Node Evaluator Config ---
  node_config = Task(
    subagent_type = "general-purpose",
    model = "sonnet",
    name = "node-evaluator-p" + pass_count,
    prompt = """
      You are the node-eval running inside a review-plan evaluator task. Follow the instructions in
      <node_eval_path> exactly.

      results_dir = <RESULTS_DIR>
      evaluator_name = node-evaluator

      [IF node_memo_directive is non-empty, append it here]

      [IF pass_count > 1 AND prev_pass_applied_edits is non-empty, append:]
      Previous pass applied [N] edit(s):
        - [Q-ID] ([evaluator]): [summary]
        ...
      Focus verification on plan sections touched by these edits.
      Confirm fixes resolve flagged issues without introducing new problems.

      [IF pass_count > 1 AND prev_pass_applied_edits is empty:]
      Previous pass applied 0 edits — plan unchanged. Verify your questions still PASS.

      Plan to evaluate: <plan_path>

      Constraints: read-only — do not edit the plan, do not call ExitPlanMode.
      Write exactly ONE JSON file to the results_dir.
    """
  )

  --- UI Evaluator Config (includes merged Client cluster: Q-C17, Q-C25) ---
  ui_config = Task(
    subagent_type = "ui-designer",
    model = "sonnet",
    name = "ui-evaluator-p" + pass_count,
    prompt = """
      You are the ui-evaluator running inside a review-plan evaluator task. Evaluate the plan for
      UI specialization and client concerns (9 questions in this cluster).

      Question definitions: Read <questions_l3_path>
        (Q-U1 through Q-U7, plus Q-C17 and Q-C25 — merged from Client cluster).

      Context flags (substituted by team-lead at spawn time):
        IS_NODE=<IS_NODE>   IS_GAS=<IS_GAS>

      IS_GAS note: if IS_GAS=true above, Q-C17 and Q-C25 are N/A-superseded
        (gas-evaluator Q32, Q33 cover these). Still evaluate Q-U1 through Q-U7 normally.
      IS_NODE note: Q-C17 and Q-C25 are not superseded — evaluate normally.

      Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
      or <!-- node-plan -->.

      [IF pass_count > 1 AND prev_pass_applied_edits is non-empty, append:]
      Previous pass applied [N] edit(s):
        - [Q-ID] ([evaluator]): [summary]
        ...
      Focus verification on plan sections touched by these edits.
      Confirm fixes resolve flagged issues without introducing new problems.

      [IF pass_count > 1 AND prev_pass_applied_edits is empty:]
      Previous pass applied 0 edits — plan unchanged. Verify your questions still PASS.

      Output contract — write findings to JSON file:
        Write your findings to: <RESULTS_DIR>/ui-evaluator.json

        JSON schema:
        {
          "evaluator": "ui-evaluator",
          "pass": <pass_count>,
          "status": "complete",
          "elapsed_s": <seconds_from_start>,
          "findings": {
            "<Q-ID>": {"status": "PASS|NEEDS_UPDATE|N/A", "finding": "<text>", "edit": "<instruction or null>"},
            ...
          },
          "counts": {"pass": N, "needs_update": N, "na": N}
        }

        Write atomically using Bash (ensures clean reads by orchestrator):
          cat > '<RESULTS_DIR>/ui-evaluator.json.tmp' << 'EVAL_EOF'
          <json>
          EVAL_EOF
          mv '<RESULTS_DIR>/ui-evaluator.json.tmp' '<RESULTS_DIR>/ui-evaluator.json'

        If you encounter an error reading inputs, write:
          {"evaluator": "ui-evaluator", "pass": <pass_count>, "status": "error", "error": "<message>"}

      Constraints:
      - Do not use Edit or Write tools on the plan file — read-only
      - Use Bash ONLY to write your findings JSON to the specified path
      - Do not call ExitPlanMode or touch marker files
      - Write exactly ONE JSON file

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  -- Pass-level summary (from all_results accumulator) --
  total_completed = count entries in all_results with status=="complete"
  total_error = count entries in all_results with status=="error"
  Print: "  >> All evaluators reported — assembling pass-level summary"
  Print: "  fan-in ─── ●[total_completed] ✗[total_error]"

  Incomplete evaluator rule: An Incomplete (error) evaluator contributes ZERO findings for its
  questions only. Pass CAN converge if responding evaluators returned 0 NEEDS_UPDATE AND
  the Incomplete evaluator returned 0 NEEDS_UPDATE in the immediately prior pass. If the
  Incomplete evaluator had NEEDS_UPDATE last pass: do NOT converge; spawn it again next pass.
  Incomplete cluster evaluator: its cluster's questions treated as same NEEDS_UPDATE status
  as their previous pass (other cluster evaluators' findings are unaffected).
  (Timeout is theoretical — foreground Tasks block until complete. The routing guard
  at the "Route findings" block defensively checks for both ["timeout", "error"]
  in case future Task tool changes introduce timeout semantics.)

  pass_elapsed = Math.round((Date.now() - pass_start_time) / 1000)
  pass_durations.append(pass_elapsed)

  Print evaluator status grid (tree diagram with aligned columns):
    # Data source: all_results dict (populated during wave fan-in — single read, no re-read from disk)
    # Symbol key: ● = completed, ⊘ = memoized (not spawned), ✗ = error
    # Columns: name (right-pad with dashes to col 16) + symbol + ✗/✓/— counts + [Ns]
    # Skipped clusters (not in active_clusters) are omitted entirely.
    # Build list of evaluator lines, then print with tree connectors (┌ first, ├ middle, └ last).
    evaluator_lines = []

    FOR each evaluator_name in all_results (in priority order: l1, ecosystem, impact, remaining clusters, ui):
      data = all_results[evaluator_name]
      name = data.evaluator
      IF data.status == "complete":
        elapsed = data.elapsed_s
        nu = data.counts.needs_update
        p = data.counts.pass
        na = data.counts.na
        evaluator_lines.append("[name] ── ● ✗[nu] ✓[p] —[na]  [[elapsed]s]")
      ELSE IF data.status == "error":
        evaluator_lines.append("[name] ── ✗ error")

    # Add memoized clusters/evaluators (not in all_results — never spawned)
    FOR each cluster_name in memoized_clusters:
      evaluator_lines.append("[cluster_name] ── ⊘ memoized p[memoized_since[cluster_name]]")
    IF IS_GAS AND fully_memoized_gas:
      evaluator_lines.append("gas-eval ── ⏭ fully memoized")
    IF IS_NODE AND fully_memoized_node:
      evaluator_lines.append("node-eval ─ ⏭ fully memoized")
    IF l1_structural_memoized:
      evaluator_lines.append("l1-advisory-structural ── ⊘ memoized p[l1_structural_memoized_since]")
    IF l1_process_memoized:
      evaluator_lines.append("l1-advisory-process ── ⊘ memoized p[l1_process_memoized_since]")

    Print tree (where n = len(evaluator_lines) - 1):
      If n == 0: "  └ " + evaluator_lines[0]   (only 1 evaluator — no ┌/├)
      Else:
        "  ┌ " + evaluator_lines[0]
        For i in 1..n-1: "  ├ " + evaluator_lines[i]  (middle lines, inclusive range)
        "  └ " + evaluator_lines[n]

  Print: "  >> Routing evaluator findings to their respective layers"
  -- Route findings from all_results (already read during wave fan-in — no second file read) --
  FOR evaluator_name, data in all_results:

    IF data.status in ["timeout", "error"]:
      mark as Incomplete (existing incomplete evaluator rules apply unchanged)
      CONTINUE

    # Route findings — specific evaluators checked BEFORE wildcard to prevent silent misrouting
    IF evaluator_name == "l1-blocking":
      FOR q_id, entry in data.findings:
        l1_results[q_id] = entry.status
        IF entry.status == "NEEDS_UPDATE":
          l1_edits[q_id] = entry

    ELSE IF evaluator_name == "l1-advisory-structural":
      FOR q_id, entry in data.findings:
        l1_results[q_id] = entry.status
        IF entry.status == "NEEDS_UPDATE":
          l1_edits[q_id] = entry

    ELSE IF evaluator_name == "l1-advisory-process":
      FOR q_id, entry in data.findings:
        l1_results[q_id] = entry.status
        IF entry.status == "NEEDS_UPDATE":
          l1_edits[q_id] = entry

    ELSE IF evaluator_name == "gas-evaluator":
      gas_results = {q_id: entry.status for q_id, entry in data.findings}

    ELSE IF evaluator_name == "node-evaluator":
      node_results = {n_id: entry.status for n_id, entry in data.findings}

    ELSE IF evaluator_name == "ui-evaluator":
      ui_results = data.findings

    ELSE IF evaluator_name matches "*-evaluator" (cluster):
      cluster_name = evaluator_name minus "-evaluator" suffix
      cluster_results[cluster_name] = data.findings

    # Populate advisory_findings_cache from PASS-with-finding entries (Gate 3 advisory notes)
    GATE3_QIDS = {"Q-G20", "Q-G21", "Q-G22", "Q-G23", "Q-G24", "Q-G25"}
    FOR q_id, entry in data.findings:
      IF q_id not in GATE3_QIDS:
        continue  # only cache advisory-tier questions
      IF entry.status == "PASS" AND entry.finding is non-null AND entry.finding != "":
        advisory_findings_cache[q_id] = {"finding": entry.finding, "source": evaluator_name}
      ELIF entry.status == "PASS" AND (entry.finding is null OR entry.finding == ""):
        advisory_findings_cache.pop(q_id, None)  # clear stale entry if condition resolved

  -- Merge & Apply --
  COLLECT all NEEDS_UPDATE findings from all_results (L1, cluster, ecosystem, and ui evaluators)
  -- Deduplication algorithm (apply for each active ecosystem/UI evaluator) --
  FOR each pair of findings (A from evaluator-X, B from evaluator-Y) where X ≠ Y:
    (1) Extract the plan passage or file that each finding references.
    (2) If both reference the same passage AND both address the same corrective action
        (not just the same topic), flag as duplicate.
    (3) Keep the more-specific evaluator's framing using this precedence:
          gas-evaluator > cluster evaluator (for GAS concerns)
          node-evaluator > cluster evaluator (for Node/TS concerns)
          ui-evaluator > cluster evaluator (for UI concerns)
          gas-evaluator > ui-evaluator (for GAS UI concerns when IS_GAS=true)
    (4) If same passage but findings address complementary (not identical) concerns → keep both.
        Do not deduplicate findings that are merely co-located — they must share a corrective action.
  Example: Q-C26 from impact-evaluator and Q40 from gas-evaluator both flag "migration step for
    changed config schema" → duplicate, keep Q40 (gas-evaluator wins over cluster). Q-C3 from
    impact-evaluator says "callers affected" and Q18 from gas-evaluator says "GAS triggers
    invalidated" → complementary, keep both.

  (If changes_this_pass == 0, skip the entire APPLYING section — no banner, no narration.)

  IF changes_to_apply > 0:
    dedup_removed = total_findings_before_dedup - changes_to_apply
    Print: "╭─── APPLYING ───────────────────╮"
    Print: "  [total_findings_before_dedup] findings → [dedup_removed] deduped → [changes_to_apply] edits queued"
    Print: "  >> Applying edits to the plan — each change will be verified"

  IF changes_to_apply > 0:
    apply_start_time = Date.now()
  APPLY edits — for each finding with edit != null in any evaluator's JSON data:
    Print: ""
    FOR idx, edit in enumerate(edits_to_apply):
      Print: "  ┌ [[idx+1]/[N]] [question short name] ([ID])"
      Print: "  │ [verb] [object — first sentence of edit instruction]"
      Call the Edit tool on the plan file to insert/modify the specified content.
      IF Edit fails (old_string not found in plan):
        Print: "  ⚠️ Edit skipped — passage not found (may have been modified by prior edit this pass)"
        Print: "  │ Q-ID: [ID], finding: [first sentence of edit.finding]"
        # Do NOT count as a change. Do NOT retry.
        # The finding remains in evaluator output — it will be re-evaluated next pass.
        CONTINUE to next edit
      Mark each insertion <!-- review-plan -->.
      Each Edit call = 1 change. Do not count findings you only described in text.
      Print: "  └ ✓ applied"
    Print: ""
  CONSOLIDATE: merge overlapping findings, remove duplicate annotations
    Print: "  consolidating overlapping annotations…"
    Keep-exemption: content annotated <!-- keep: [reason] --> is EXEMPT from consolidation removal.
    "Key flow" = any implementation step, ordering dependency, error path, rollback step, or
    verification checkpoint. Prose trimming is OK. Removing or merging steps is NOT.
  REGRESSION CHECK (5-step recovery procedure):
    (1) After applying all edits, re-read the plan.
    (2) For each numbered implementation step that existed at pass start, verify it still exists
        with equivalent semantics (content may be expanded but must not be absent or materially shortened).
    (3) If a step is missing or materially shortened: re-read the step from the previous pass
        (from context or memo_file if available — memo_file stores pass_count but not full plan text;
        use context window's prior read of the plan if still available).
    (4) Restore the step verbatim, then append a <!-- keep: step N — restored after edit removed it --> marker.
    (5) Add the restoration as an additional change: changes_this_pass += 1 and print:
          "  ⚠️ Restored [step N] — removed by edit, reinstated."
    IF restorations > 0:
      Print: "  ⚠️ [restorations] step(s) restored (removed by edit, reinstated)"
    Print: "╰─── [N] edits applied ──────────╯"
    Print: "  >> Edits applied — updating memoization state and checking convergence"
  RE-READ the full consolidated plan

  l1_changes = count of L1 NEEDS_UPDATE edits applied
  cluster_changes = {cluster_name: count of edits applied for each active cluster}
  cluster_changes_total = sum of all cluster evaluator NEEDS_UPDATE edits applied
  IF IS_GAS: gas_plan_changes = count of gas-evaluator NEEDS_UPDATE edits applied
  IF IS_NODE: node_plan_changes = count of node-evaluator NEEDS_UPDATE edits applied
  IF HAS_UI: ui_plan_changes = count of ui-evaluator NEEDS_UPDATE edits applied

  # Gas/Node results already routed in "Route findings from all_results" block above.
  # Enforce memoized status: override any evaluator contradiction for locked questions
  IF IS_GAS AND gas_results is non-empty:
    FOR q_id in memoized_gas_questions:
      gas_results[q_id] = "PASS"  # unconditional — memoization takes priority over evaluator output

  IF IS_NODE AND node_results is non-empty:
    FOR n_id in memoized_node_questions:
      node_results[n_id] = "PASS"  # unconditional — memoization takes priority over evaluator output
  changes_this_pass = l1_changes + cluster_changes_total + gas_plan_changes + node_plan_changes + ui_plan_changes
  total_changes_all_passes += changes_this_pass

  # Build delta summary for next pass's evaluators
  current_pass_applied_edits = []
  FOR each applied edit in this pass:
    current_pass_applied_edits.append({
      "q_id": edit.q_id,
      "evaluator": edit.source_evaluator,
      "summary": first_sentence(edit.instruction)
    })

  newly_memoized = []  # collect items memoized THIS pass for milestone display

  # Invalidation: L1/cluster edits may make stability-locked ecosystem questions stale
  # Do NOT invalidate when only gas/node evaluators made edits (domain-local, not plan-structural)
  # Structurally-memoized questions (Q1, Q2, Q42, N1) are NEVER invalidated — additive-only property is invariant.
  IF (l1_changes + cluster_changes_total) > 0:
    stability_memo_gas = memoized_gas_questions - struct_memo_gas
    IF stability_memo_gas:
      Print: "  memo: invalidating [len(stability_memo_gas)] gas stability locks (plan structure changed)"
      memoized_gas_questions -= stability_memo_gas
      FOR q_id in stability_memo_gas:
        del memoized_gas_since[q_id]
        if q_id in prev_gas_results: del prev_gas_results[q_id]  # break stability chain
        if q_id in gas_results: del gas_results[q_id]            # prevent stale carry-forward
    stability_memo_node = memoized_node_questions - struct_memo_node
    IF stability_memo_node:
      Print: "  memo: invalidating [len(stability_memo_node)] node stability locks (plan structure changed)"
      memoized_node_questions -= stability_memo_node
      FOR n_id in stability_memo_node:
        del memoized_node_since[n_id]
        if n_id in prev_node_results: del prev_node_results[n_id]  # break stability chain
        if n_id in node_results: del node_results[n_id]            # prevent stale carry-forward

  # Memoization update (post-pass, one-way — once memoized, never removed)
  # Memoization principle: memoize only criteria that check "additive-only" structural
  # properties — once met, subsequent plan edits cannot make the criterion fail again.
  # Memoizable: Q-G11 (file paths cited).
  # NOT memoizable: criteria that check evolving properties (scope, assumptions, phase structure, etc.)
  # Q-G1 (Approach soundness): NOT memoizable — plan edits can alter approach scope/complexity
  # Q-G2 (Standards compliance): NOT memoizable — new steps can introduce directive violations
  # L1 Q-G11: safe to memoize individually (cited file paths/function names don't regress during editing)
  IF l1_results["Q-G11"] in [PASS, N/A] AND "Q-G11" NOT in memoized_l1_questions:
    memoized_l1_questions.add("Q-G11")
    newly_memoized.append("Q-G11")  # track for milestone display
  # Q-G6: safe to memoize (naming conventions set during plan creation; review-plan edits don't introduce new identifier names)
  IF l1_results["Q-G6"] in [PASS, N/A] AND "Q-G6" NOT in memoized_l1_questions:
    memoized_l1_questions.add("Q-G6")
    newly_memoized.append("Q-G6")  # track for milestone display
  # Q-G7: safe to memoize (doc impact determined by plan scope; review-plan edits don't alter implementation scope)
  IF l1_results["Q-G7"] in [PASS, N/A] AND "Q-G7" NOT in memoized_l1_questions:
    memoized_l1_questions.add("Q-G7")
    newly_memoized.append("Q-G7")  # track for milestone display
  # Q-G18: safe to memoize (once pre-condition verification steps are stated, review-plan edits don't remove them)
  IF l1_results["Q-G18"] in [PASS, N/A] AND "Q-G18" NOT in memoized_l1_questions:
    memoized_l1_questions.add("Q-G18")
    newly_memoized.append("Q-G18")  # track for milestone display
  # Structural memoization for gas questions (mirrors gas-plan/SKILL.md:312-320)
  IF IS_GAS:
    FOR q_id in struct_memo_gas:
      IF gas_results.get(q_id) in [PASS, N/A] AND q_id NOT in memoized_gas_questions:
        memoized_gas_questions.add(q_id)
        memoized_gas_since[q_id] = pass_count
        newly_memoized.append("gas:" + q_id)

  # Structural memoization for node questions
  IF IS_NODE:
    FOR n_id in struct_memo_node:
      IF node_results.get(n_id) in [PASS, N/A] AND n_id NOT in memoized_node_questions:
        memoized_node_questions.add(n_id)
        memoized_node_since[n_id] = pass_count
        newly_memoized.append("node:" + n_id)

  # Q-G19 (Phase failure recovery): NOT safe to memoize — failure recovery scope evolves as phases are added/modified
  # Q-G20 (Story arc coherence): NOT safe to memoize — story arc framing evolves as plan is restructured
  # NOT memoizable (explicitly evaluated and rejected):
  # Q-G17: review-plan Q-G13 edits add phases — can create new preamble needs
  # Q-G16: review-plan edits can add implementation phases — changes breadcrumb scope
  # Q-C12: review-plan edits can alter plan scope — changes consolidation opportunities
  # Q-G10 (Assumption Exposure): NOT safe — assumptions evolve as plan is edited
  # Q-G12 (Code consolidation): NOT safe — consolidation opportunities shift as plan scope evolves
  # Q-G13 (Phased decomposition): NOT safe — phase structure evolves as plan scope and steps are edited
  # Q-G14 (Codebase style adherence): NOT safe — code style concerns may emerge or be resolved as the plan evolves
  # Q-G21 (Internal logic consistency): NOT safe — consistency evolves as plan is restructured
  # Q-G22 (Cross-phase dependency explicitness): NOT safe — inter-phase contracts evolve as phases change
  # Q-G23 (Proportionality): NOT safe — scope/complexity assessment changes as plan expands or contracts
  # Q-G24 (Core-vs-derivative weighting): NOT safe — specification depth changes as plan is edited
  # Q-G25 (Feedback loop completeness): NOT safe — downstream consumer relationships evolve as plan scope changes
  # Q-C27, Q-C28, Q-C29: not individually memoizable by design (their clusters — impact, operations,
  # testing — are not currently added to memoized_clusters; no loop cluster is currently memoized at the cluster level)
  # Individually memoizable L1 questions (structural): {Q-G11, Q-G6, Q-G7, Q-G18}

  # Stability-based memoization (post-pass 2 only)
  # If a Gate 2 or Gate 3 question returned PASS/N/A in BOTH the previous pass AND this pass
  # (with plan edits applied between them), it's empirically stable — safe to memoize for pass 3+.
  # Gate 1 questions are NEVER stability-memoized (too important to skip based on heuristic).
  IF pass_count >= 2:
    current_pass_results = l1_results  # Q-ID → status built from evaluator messages (L1 questions only: Q-G*)
    # Note: cluster questions (Q-C*) are memoized at the whole-cluster level (memoized_clusters above),
    # not per-question. Stability promotion here applies to L1 (Q-G*) questions only.
    FOR each Q-ID in current_pass_results:
      IF Q-ID in prev_pass_results:
        IF prev_pass_results[Q-ID] in [PASS, N/A] AND current_pass_results[Q-ID] in [PASS, N/A]:
          IF Q-ID is Gate 2 or Gate 3 L1 question AND Q-ID NOT in {"Q-G10", "Q-G12", "Q-G13", "Q-G14", "Q-G16", "Q-G17", "Q-G19", "Q-G20", "Q-G21", "Q-G22", "Q-G23", "Q-G24", "Q-G25"}:
            # never Gate 1 (Q-G1, Q-G2, Q-G11); cluster questions handled by memoized_clusters
            # non-memoizable Gate 2/3 questions explicitly excluded (evolving properties — see comments below)
            IF Q-ID NOT in memoized_l1_questions:
              memoized_l1_questions.add(Q-ID)
              newly_memoized.append(Q-ID)  # track for milestone display (stability-locked)
  prev_pass_results = l1_results  # update for next pass (L1 results only; cluster stability tracked separately)
  prev_pass_applied_edits = current_pass_applied_edits  # carry delta summary to next pass's evaluators

  # Group memoization for l1-advisory-structural (6 questions — independently tracked)
  IF NOT l1_structural_memoized:
    structural_questions = {"Q-G20", "Q-G21", "Q-G22", "Q-G23", "Q-G24", "Q-G25"}
    all_structural_clean = all(l1_results.get(q, "PASS") in [PASS, N/A] for q in structural_questions)
    IF all_structural_clean:
      IF l1_structural_clean_since == 0:
        l1_structural_clean_since = pass_count  # first clean pass — start the stability window
      ELSE:
        # Second consecutive clean pass
        l1_structural_memoized = true
        l1_structural_memoized_since = pass_count
        newly_memoized.append("l1-advisory-structural (6 questions)")
        l1_structural_clean_since = 0  # reset
    ELSE:
      l1_structural_clean_since = 0  # reset window on any NEEDS_UPDATE
  ELSE:
    # Invalidate if ANY edit was applied this pass (edits can affect structural questions)
    IF changes_this_pass > 0:
      l1_structural_memoized = false
      l1_structural_clean_since = 0  # reset stability window on invalidation
      Print: "  memo: l1-advisory-structural invalidated (edits applied)"

  # Memoization thresholds — intentionally asymmetric:
  # Structural group (Q-G20–Q-G25): 2 consecutive clean passes required.
  #   Q-G23/G24/G25 methodology notes added in Iter 7; higher false-PASS risk until
  #   question calibration is validated across plan-edit boundaries.
  # Process group (Q-G4–Q-G19): 1 clean pass sufficient.
  #   Older question definitions with lower calibration risk.

  # Group memoization for l1-advisory-process (13 questions — independently tracked)
  IF NOT l1_process_memoized:
    process_questions = {"Q-G4", "Q-G5", "Q-G6", "Q-G7", "Q-G8", "Q-G10",
      "Q-G12", "Q-G13", "Q-G14", "Q-G16", "Q-G17", "Q-G18", "Q-G19"}
    all_process_clean = all(l1_results.get(q, "PASS") in [PASS, N/A] for q in process_questions)
    IF all_process_clean:
      l1_process_memoized = true
      l1_process_memoized_since = pass_count
      newly_memoized.append("l1-advisory-process (13 questions)")
  ELSE:
    # Invalidate if ANY edit was applied this pass (edits can affect process questions)
    IF changes_this_pass > 0:
      l1_process_memoized = false
      Print: "  memo: l1-advisory-process invalidated (edits applied)"

  # Stability-based memoization for gas Gate 2/3 questions
  # Runs AFTER Phase 6 invalidation — so newly-cleared questions can re-earn stability this pass
  IF IS_GAS AND pass_count >= 2:
    FOR q_id in gas_results:
      IF q_id in prev_gas_results:
        IF prev_gas_results[q_id] in [PASS, N/A] AND gas_results[q_id] in [PASS, N/A]:
          IF q_id NOT in gate1_gas:  # Gate 1 never stability-memoized
            IF q_id NOT in memoized_gas_questions:
              memoized_gas_questions.add(q_id)
              memoized_gas_since[q_id] = pass_count
              newly_memoized.append("gas:" + q_id)
  prev_gas_results = gas_results  # Set LAST — after stability check reads it

  # Stability-based memoization for node Gate 2/3 questions (same pattern)
  IF IS_NODE AND pass_count >= 2:
    FOR n_id in node_results:
      IF n_id in prev_node_results:
        IF prev_node_results[n_id] in [PASS, N/A] AND node_results[n_id] in [PASS, N/A]:
          IF n_id NOT in gate1_node:  # Gate 1 never stability-memoized
            IF n_id NOT in memoized_node_questions:
              memoized_node_questions.add(n_id)
              memoized_node_since[n_id] = pass_count
              newly_memoized.append("node:" + n_id)
  prev_node_results = node_results  # Set LAST

  # Memoization milestone output (Enhancement E)
  # Print individual lock events (cap at 3 per pass, then "+N more")
  # newly_memoized was initialized before the memoization update block above;
  # .append() calls within that block populate it as items lock in.
  IF len(newly_memoized) > 0:
    shown = 0
    FOR each item in newly_memoized:
      IF shown < 3:
        IF item is a cluster name:
          Print: "  memo: +[item] cluster ([N] questions) locked at pass [pass_count]"
        ELSE IF item was stability-locked (pass_count >= 2):
          Print: "  memo: +[item] stable across 2 passes — locked"
        ELSE:
          Print: "  memo: +[item] ([question short name]) locked at pass [pass_count]"
        shown += 1
    IF len(newly_memoized) > 3:
      Print: "  memo: +[len(newly_memoized) - 3] more locked"

  # Milestone announcements (25/50/75% of total_applicable_questions locked)
  IF total_applicable_questions == 0:
    # Compute on first pass from active evaluator question counts
    total_applicable_questions = 20 + sum(questions per active cluster) + (53 if IS_GAS else 0) + (38 if IS_NODE else 0) + (9 if HAS_UI else 0)
    # 53 = gas evaluate mode scope (Q43 is post-loop only, not evaluated in review-plan integration)
  total_memo_count = len(memoized_l1_questions) + sum(questions in each memoized_cluster) + len(memoized_gas_questions) + len(memoized_node_questions)
  memo_pct = Math.round(100 * total_memo_count / total_applicable_questions)
  FOR threshold in [25, 50, 75]:
    IF memo_pct >= threshold AND threshold NOT in memo_milestones_printed:
      memo_milestones_printed.add(threshold)
      accel_label = IF threshold == 25: "picking up speed" ELSE IF threshold == 50: "accelerating" ELSE: "almost locked"
      filled = Math.round(10 * memo_pct / 100)
      progress_bar = "█" × filled + "░" × (10 - filled)
      Print: "  memo ── [threshold]% locked [[progress_bar]] [total_memo_count]/[total_applicable_questions] ── [accel_label]"

  current_needs_update_set = {set of Q/N numbers with NEEDS_UPDATE this pass across all evaluators}

  IF pass_count == 1:
    pass1_needs_update_set = current_needs_update_set  # snapshot for resolved_questions computation

  -- Checkpoint: persist memoized state for context-compression resilience --
  Write memo_file with JSON: {
    results_dir: RESULTS_DIR,
    pass_count, memoized_clusters: [...memoized_clusters],
    memoized_since, memoized_l1_questions: [...memoized_l1_questions],
    l1_structural_memoized, l1_structural_memoized_since, l1_structural_clean_since,
    l1_process_memoized, l1_process_memoized_since,
    prev_needs_update_set: [...current_needs_update_set],
    pass1_needs_update_set: [...pass1_needs_update_set],
    prev_pass_results,
    prev_pass_applied_edits,
    total_changes_all_passes,
    needs_update_counts_per_pass,
    pass_durations,
    total_applicable_questions,
    memo_milestones_printed: [...memo_milestones_printed],
    memoized_gas_questions: [...memoized_gas_questions],
    memoized_gas_since,
    memoized_node_questions: [...memoized_node_questions],
    memoized_node_since,
    prev_gas_results,
    prev_node_results,
    pass_phase_timings,
    evaluators_spawned_total,
    advisory_findings_cache
  }

  # Build breakdown suffix — only non-zero counts
  breakdown_parts = []
  if l1_changes > 0:        breakdown_parts.append(f"l1:{l1_changes}")
  for c in active_clusters:
    if cluster_changes.get(c, 0) > 0: breakdown_parts.append(f"{c}:{cluster_changes[c]}")
  if IS_GAS and gas_plan_changes > 0:   breakdown_parts.append(f"gas:{gas_plan_changes}")
  if IS_NODE and node_plan_changes > 0: breakdown_parts.append(f"node:{node_plan_changes}")
  if HAS_UI and ui_plan_changes > 0:    breakdown_parts.append(f"ui:{ui_plan_changes}")
  current_nu_count = len(current_needs_update_set)
  needs_update_counts_per_pass.append(current_nu_count)

  if not breakdown_parts:
    Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count]/5 ─── 0 changes  [{pass_elapsed}s]"
  else:
    Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count]/5 ─── [changes_this_pass] changes ([join(breakdown_parts, ' ')])  [{pass_elapsed}s]"

  # Phase-level timing breakdown
  dispatch_elapsed = ((fanin_start_time - dispatch_start_time) / 1000).toFixed(1)
  # apply_start_time is 0 when changes_to_apply == 0 (apply block was skipped entirely)
  fanin_elapsed = apply_start_time > 0 ? ((apply_start_time - fanin_start_time) / 1000).toFixed(1) : ((Date.now() - fanin_start_time) / 1000).toFixed(1)
  apply_elapsed = apply_start_time > 0 ? ((Date.now() - apply_start_time) / 1000).toFixed(1) : "—"
  pass_phase_timings.append({dispatch: dispatch_elapsed, fanin: fanin_elapsed, apply: apply_elapsed, total: pass_elapsed})
  Print: "  timing ── dispatch: ${dispatch_elapsed}s  fan-in: ${fanin_elapsed}s  apply: ${apply_elapsed}s  total: ${pass_elapsed}s"

  # Delta visualization (Enhancement C)
  IF pass_count == 1:
    Print: "  snapshot ── ✗[current_nu_count] need work"
  ELSE:
    prev_nu = needs_update_counts_per_pass[pass_count - 2]  # previous pass count
    delta = current_nu_count - prev_nu
    delta_str = IF delta < 0: "(↓[abs(delta)])" ELSE IF delta > 0: "(↑[delta])" ELSE: "(→0)"
    memo_count = len(memoized_l1_questions) + sum(questions in each memoized_cluster) + len(memoized_gas_questions) + len(memoized_node_questions)
    # Use question count (not cluster count) to match milestone math at total_memo_count computation
    IF memo_count <= 3:
      memo_names = comma-separated list of memoized Q-IDs and cluster names
      Print: "  delta ── ✗[prev_nu]→[current_nu_count] [delta_str]  🔒[memo_names]"
    ELSE:
      Print: "  delta ── ✗[prev_nu]→[current_nu_count] [delta_str]  🔒[memo_count] locked"
    IF pass_count >= 3:
      trend_values = join(needs_update_counts_per_pass, " → ")
      last3 = needs_update_counts_per_pass[-3:]
      trend_arrow = IF last3[-1] < last3[0]: "↘ converging" ELSE IF last3[-1] > last3[0]: "↗ oscillating" ELSE: "→ flat"
      Print: "  trend ── [trend_values]  [trend_arrow]"

  # Compact gate health bar (Enhancement G)
  # Compute gate-level counts from current_needs_update_set for quick inline display
  gate1_open = count of NEEDS_UPDATE in current pass for Gate 1 questions
  gate2_open = count of NEEDS_UPDATE in current pass for Gate 2 questions
  gate3_noted = count of NEEDS_UPDATE in current pass for Gate 3 questions
  gate1_sym = IF gate1_open == 0: "✅" ELSE: "❌[gate1_open]"
  gate2_sym = IF gate2_open == 0: "✅" ELSE: "⚠️[gate2_open]"
  IF pass_count >= 2:
    prev_gate2 = count of Gate 2 NEEDS_UPDATE from previous pass
    gate2_delta = gate2_open - prev_gate2
    IF gate2_delta != 0:
      gate2_sym += IF gate2_delta < 0: "↓[abs(gate2_delta)]" ELSE: "↑[gate2_delta]"
  gate1_label = IF gate1_open == 0: "clear" ELSE: "open"
  gate2_label = IF gate2_open == 0: "clear" ELSE: "open"
  Print: "  gates ── 🔴 [gate1_sym] [gate1_label]  🟡 [gate2_sym] [gate2_label]  💡 [gate3_noted] noted"

  # Helper functions for evaluator status lines
  FUNCTION check_memoized(eval_name):
    IF eval_name == "l1-advisory-structural": RETURN l1_structural_memoized
    IF eval_name == "l1-advisory-process": RETURN l1_process_memoized
    IF eval_name == "gas-evaluator": RETURN fully_memoized_gas
    IF eval_name == "node-evaluator": RETURN fully_memoized_node
    IF eval_name in [c + "-evaluator" FOR c IN memoized_clusters]: RETURN true
    RETURN false
  FUNCTION memoized_since(eval_name):
    IF eval_name == "l1-advisory-structural": RETURN l1_structural_memoized_since
    IF eval_name == "l1-advisory-process": RETURN l1_process_memoized_since
    IF eval_name == "gas-evaluator": RETURN max(memoized_gas_since.values())
    IF eval_name == "node-evaluator": RETURN max(memoized_node_since.values())
    RETURN max(memoized_since[c] FOR c IN memoized_clusters IF c + "-evaluator" == eval_name)

  # Per-evaluator status lines — shows what happened to each evaluator this pass
  active_evaluators = ["l1-blocking", "l1-advisory-structural", "l1-advisory-process"]
  active_evaluators += [c + "-evaluator" FOR c IN active_clusters]
  IF IS_GAS: active_evaluators.append("gas-evaluator")
  ELSE IF IS_NODE: active_evaluators.append("node-evaluator")
  IF HAS_UI: active_evaluators.append("ui-evaluator")

  evaluator_status_lines = []
  FOR eval_name IN active_evaluators:
    IF eval_name == "l1-blocking":
      evaluator_status_lines.append("l1-blocking ── re-run (Gate 1, always)")
      CONTINUE
    IF check_memoized(eval_name):
      evaluator_status_lines.append("[eval_name] ── memoized (p[memoized_since(eval_name)])")
    ELSE IF eval_name in all_results AND all_results[eval_name].status == "error":
      evaluator_status_lines.append("[eval_name] ── error")
    ELSE IF pass_count == 1:
      evaluator_status_lines.append("[eval_name] ── re-run (first pass)")
    ELSE IF len(prev_pass_applied_edits) > 0:
      edited_qids = [e.q_id for e in prev_pass_applied_edits]
      evaluator_status_lines.append("[eval_name] ── re-run (prev edits: [join(edited_qids, ', ')])")
    ELSE:
      evaluator_status_lines.append("[eval_name] ── re-run (stability not met)")
  Print: "  evaluators:"
  FOR line in evaluator_status_lines:
    Print: "    [line]"

  Gate2_stable = (prev_needs_update_set == current_needs_update_set)  # set equality: order-independent; compare BEFORE updating prev
  prev_needs_update_set = current_needs_update_set  # update AFTER Gate2_stable check; placed before CONVERGENCE CHECK so CONTINUE paths don't leave stale state

  -- CONVERGENCE CHECK (gate-aware) --
  IF IS_GAS:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G11,
                       Q1, Q2, Q13, Q15, Q18, Q42
                       (Q-E1 and Q-E2 are N/A for IS_GAS; L2 cluster questions are N/A-superseded by gas-evaluator)
  ELSE IF IS_NODE:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G11, Q-C3,
                       N1
  ELSE:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G11, Q-C3

  IF pass_count >= 5:
    total_elapsed = Math.round((Date.now() - timestamp) / 1000)
    IF Gate1_unresolved > 0:
      Print: "⚠️ Max passes reached ([total_elapsed]s) — [Gate1_unresolved] Gate 1 issue(s) still open. Proceeding to scorecard (Rating: 🔴 REWORK). Reject plan approval to continue fixing."
      BREAK → proceed to "After Review Completes"
    ELSE:
      Print: "✅ Converged (max passes, Gate 1 clear, [total_elapsed]s)."
      BREAK → proceed to "After Review Completes"
  IF Gate1_unresolved > 0:
    Print using this exact format:
      "⚠️ Gate 1 still open — [Gate1_unresolved] blocking:"
      "  - [question short name] ([ID]): [first sentence of evaluator finding]"
      (one line per unresolved Gate 1 question)
      "Looping for pass [pass_count + 1]..."
    Example:
      ⚠️ Gate 1 still open — 2 blocking:
        - Approach soundness (Q-G1): simpler alternative not considered
        - Impact analysis (Q-C3): callers/features affected but not addressed
      Looping for pass 2...
    CONTINUE (do NOT exit when Gate 1 is still open, even if changes_this_pass == 0)
  IF changes_this_pass == 0 OR Gate2_stable:
    Print: "  >> All gates clear and no new changes — convergence achieved"
    total_elapsed = Math.round((Date.now() - timestamp) / 1000)
    IF pass_count == 1:
      Print: "🏁 Converged ── pass 1, [total_elapsed]s ── 0 issues"
    ELSE:
      resolved_questions = pass1_needs_update_set - current_needs_update_set  # Q-IDs fixed since pass 1
      Print: "🏁 Converged ── [pass_count] passes, [total_elapsed]s total ── [total_changes_all_passes] changes applied"
      IF resolved_questions is non-empty:
        Print: "  resolved: [comma-separated resolved_questions sorted by ID]"
      Print: "  gates: [🔴 ✅] [🟡 ✅ [count of Gate2 PASS]] [💡 [count of Gate3 noted]]"
    BREAK → proceed to "After Review Completes"
  -- END CHECK --

WHILE TRUE

-- Convergence complete. Proceed to "After Review Completes" below: epilogue (Q-E1, Q-E2) → Q-G9 → scorecard output → marker cleanup → teardown → ExitPlanMode. --
```

**Self-referential protection:** Mark all additions with `<!-- review-plan -->` suffix.
Do not re-evaluate content already marked `<!-- review-plan -->`, `<!-- gas-plan -->`, or
`<!-- node-plan -->`. Canonical policy: `shared/self-referential-protection.md` — read at `~/.claude/skills/shared/self-referential-protection.md` (skip gracefully if not found).
If not found, use inline policy: mark all `<!-- skill-name -->` content as review metadata, not production code.

---

## Layer 1: General Quality

Question definitions are in QUESTIONS.md — evaluators read that file directly. Team-lead only
parses evaluator output (`Q-ID: PASS/NEEDS_UPDATE/N/A`). Q-G8 Decision Framework is in
QUESTIONS.md (Layer 1 section). Q-G9 sub-questions follow below (team-lead evaluates inline
post-convergence).

L1 per-pass count: 22 questions (Q-G1 through Q-G8 + Q-G10 through Q-G14 + Q-G16 through Q-G25).
Count L1 edits → `l1_changes += count` (combined into `changes_this_pass` in Convergence Loop)

### Q-G9 Post-Convergence Organization Pass

*Runs once after the convergence loop exits. Not part of per-pass L1 evaluation.*
*L1 per-pass count stays at 22 (Q-G1 through Q-G8 + Q-G10 through Q-G14 + Q-G16 through Q-G25). Q-G9 is not included in*
*convergence loop scoring. Q-E1 and Q-E2 are post-convergence epilogue questions (not per-pass). N/A if plan has fewer than 3 implementation steps.*

After convergence exits, evaluate Q-G9 inline (no Task spawn — team-lead evaluates directly
using the plan already in context):

Re-read the plan at <plan_path> if needed, then evaluate:
  Q-G9a: Sequential clarity — are implementation steps numbered and unambiguous in order?
         Steps must be numbered sequentially; ordering must be legible at a glance.
  Q-G9b: Concurrency labeling — are parallel steps explicitly marked (e.g. "[parallel]",
         "In a SINGLE message", "spawn in parallel")?
  Q-G9c: Scannability — does the plan use headers and bullets (no prose walls >5 sentences)?
  Q-G9d: Conditional structure — are IF/ELSE branches visually distinct from sequential steps?
  Q-G9e: Checkpoint visibility — are commit/verification checkpoints clearly visible
         (not buried mid-paragraph)?
  Q-G9f pre-check: if l1_results["Q-G22"] == "N/A", mark Q-G9f as N/A (no Outputs/Pre-check
         annotations to parse). Otherwise, proceed with Q-G9f evaluation.
  Q-G9f: Execution graph — for plans with 3+ phases: parse each phase's Outputs and
         Pre-check annotations. Build dependency adjacency list. Group into parallel
         execution waves. Inject [parallel] markers and execution schedule if parallelism
         exists. If all phases are strictly sequential, PASS with note.
         Algorithm:
           (a) Extract: for each "## Phase N" section, find "**Outputs:**" and "**Pre-check:**"
           (b) Build edges: Phase N → Phase M if N's Pre-check cites M's Outputs
           (c) Topological grouping: assign each phase to earliest wave where all dependencies
               are in prior waves
           (d) Emit: execution schedule section + [parallel] markers on independent phases
         N/A: fewer than 3 phases; or Q-G22 is N/A (no inter-phase dependencies).

For each NEEDS_UPDATE finding: apply the edit to the plan immediately. Mark <!-- review-plan -->.
Print result after applying any edits:
  Organization: ✅ inline (6/6)              ← all PASS
  Organization: ⚠️ inline (N/6) — K flagged  ← K sub-questions had NEEDS_UPDATE

Q-G9 results are included in the scorecard output (step 4 of "After Review Completes"; see Organization Quality section below).

---

## Layer 2: Code Change Quality

Question definitions are in QUESTIONS.md — cluster evaluators read that file directly. Team-lead
only parses evaluator output (`Q-ID: PASS/NEEDS_UPDATE/N/A`). 38 questions organized into 6
concern clusters. Cluster-level triage activates/deactivates entire clusters based on Haiku
pre-classification. Active clusters are listed in `active_clusters` computed in Step 0.

Count cluster edits → `cluster_changes_total += count` (combined into `changes_this_pass` in Convergence Loop)

---

## Layer 3: UI Specialization

Question definitions are in QUESTIONS-L3.md — ui-evaluator reads that file directly. 9 questions:
Q-U1 through Q-U7 plus Q-C17 and Q-C25 (merged from Client cluster). Active when HAS_UI=true.
Evaluated by ui-evaluator each pass (no separate client-evaluator spawned).

Count ui-evaluator edits → `ui_plan_changes += count` (combined into `changes_this_pass` in Convergence Loop)

---

## Key Questions: Sub-Skill Invocations

### Q-GAS / Q-NODE: Ecosystem Specialization

In IS_GAS mode, gas-plan runs as part of the parallel evaluator wave each pass (see Convergence
Loop above). The gas-evaluator Task follows evaluate mode (as defined in `<gas_eval_path>`), which means:
- gas-plan runs a SINGLE evaluation pass (no internal convergence loop)
- Writes all 53-question findings to a JSON file in RESULTS_DIR (Q43 is post-loop only, not included in evaluate mode)
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence

In IS_NODE mode (mutually exclusive with IS_GAS), node-plan runs as part of the parallel
evaluator wave each pass. The node-evaluator Task follows evaluate mode (as defined in `<node_eval_path>`), which means:
- node-plan runs a SINGLE evaluation pass (no internal convergence loop)
- Writes all 38-question findings to a JSON file in RESULTS_DIR
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence

When neither IS_GAS nor IS_NODE, no ecosystem evaluator is invoked.

**IS_GAS Cluster Suppression:**

| Cluster | Superseded? | Gas-evaluator equivalents |
|---------|-------------|--------------------------|
| Git | **epilogue** — Q-E1 evaluated post-convergence; IS_GAS: N/A (Q1, Q2) | Q1, Q2 |
| Impact (1) | **partially** — Q-C26, Q-C35, Q-C37, Q-C38, Q-C39, Q-C40 have no gas equivalent (evaluate via impact cluster) | Q18, Q16, Q39, Q41; Q-C27 N/A (no external API consumers in GAS projects); Q-C32 (→Q22/Q25/Q26) superseded |
| Testing (2) | **fully** | Q11, Q12, Q17, Q19, Q20; Q-C29 N/A (gas-evaluator Q11/Q12 cover test strategy) |
| State (3) | **partially** — Q-C36 has no gas equivalent (evaluate via state cluster when HAS_STATE) | Q40, Q21, Q24, Q3 (for Q-C13/18/19/24) |
| Security (4) | **fully** | Q27, Q28, Q23; Q-C30→Q28, Q-C31→N/A isolated exec, Q-C33→Q8, Q-C34→Q22 |
| Operations (5) | **fully** | Q9, Q10, Q29, Q22, Q25; Q-C28 N/A (exec verification + Q6/Q12 cover GAS observability) |
| Client (6) | **merged into ui-evaluator** when HAS_UI=true; **fully superseded** by gas-evaluator Q32, Q33 when IS_GAS | Q32, Q33 |

Result: When IS_GAS=true, skip ALL cluster evaluators EXCEPT Impact cluster (always active — Q-C26/Q-C35/Q-C37/Q-C38/Q-C39/Q-C40
have no gas equivalent) and State cluster when HAS_STATE=true (Q-C36 has no gas equivalent; Q-C13/18/19/24 → N/A-superseded).
Q-C17 and Q-C25 are handled by ui-evaluator when HAS_UI=true (not a separate cluster evaluator). Mark all other IS_GAS-superseded questions N/A-superseded in the scorecard.

**IS_NODE Individual Suppressions (8 questions span multiple clusters):**
Cluster-level suppression does not apply for IS_NODE. Mark these 8 questions N/A-superseded
within their respective cluster evaluators when IS_NODE=true:
  Q-C16 (Security cluster, →N6), Q-C18 (State cluster, →N8), Q-C21 (Operations cluster, →N22),
  Q-C30 (Security, →N6/N7), Q-C31 (Security, →N13/N27), Q-C32 (Impact, →N14),
  Q-C33 (Security, →N9/N10), Q-C34 (Security, →N28)

**Deduplication (IS_GAS):** After collecting gas-evaluator findings, remove true duplicates
where both a cluster evaluator and gas-evaluator flag the same concern. Keep gas-plan's more
specific GAS framing where both are present. (Rationale: "specialization wins" — ecosystem
evaluator has superior domain context vs cluster generic questions.)

**Deduplication (IS_NODE):** After collecting node-evaluator findings, remove true duplicates
where both a cluster evaluator and node-evaluator flag the same concern. Keep node-plan's more
specific Node/TS framing where both are present. (Rationale: "specialization wins.")

### Q-UI: UI Specialization (includes merged Client cluster)

In HAS_UI mode, ui-designer runs as part of the evaluator set each pass (see Convergence Loop
above). The ui-evaluator reads QUESTIONS-L3.md (not the full QUESTIONS.md) and covers 9 questions:
Q-U1 through Q-U7 (UI specialization) plus Q-C17 and Q-C25 (merged from Client cluster). This means:
- ui-designer runs a SINGLE evaluation pass (no internal convergence loop)
- Writes all 9-question findings (Q-U1 through Q-U7, Q-C17, Q-C25) to a JSON file in RESULTS_DIR
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence
- No separate client-evaluator is spawned when HAS_UI=true

HAS_UI is orthogonal to IS_GAS/IS_NODE: a GAS project with a sidebar will have
IS_GAS=true, HAS_UI=true → spawns L1 + gas-evaluator + impact cluster (always active for Q-C26/Q-C35/Q-C37/Q-C38/Q-C39/Q-C40) + ui-evaluator.

**Deduplication (HAS_UI + IS_GAS):** GAS UI concerns (sidebar, dialog) may overlap between
gas-evaluator and ui-evaluator. Keep gas-evaluator's GAS-specific framing in those cases.

**Deduplication (HAS_UI + cluster evaluators):** Remove duplicates between ui-evaluator and
cluster evaluators; keep ui-evaluator's more specific UI framing.

### Q-SEC (future)
Reserved slot — follows same pattern as Q-GAS / Q-NODE when implemented.

---

## Exit Criteria

**Converge** when (gate-aware):
- `pass_count >= 5` AND `Gate1_unresolved == 0` → BREAK (hard stop, clean)
- `pass_count >= 5` AND `Gate1_unresolved > 0` → BREAK (hard stop, proceed to REWORK scorecard)
- `Gate1_unresolved > 0` → CONTINUE regardless of change count (never exit with Gate 1 open)
- `changes_this_pass == 0` OR `Gate2_stable` → BREAK (converged, Gate 1 already clear)

---

## Output: Unified Scorecard

The scorecard is generated by the team-lead after merging all evaluator findings. N/A items are
collapsed to a count — only PASS and NEEDS_UPDATE questions appear as line items. Question IDs
appear as a suffix for referenceability (user can say "fix Q-E1").

Evaluator-to-team-lead output contracts are UNCHANGED — evaluators still list every question
individually with IDs. The collapsing happens only in this final user-facing scorecard.

```
╔═══════════════════════════════════╗
║  review-plan Scorecard — Pass [N] ║
╚═══════════════════════════════════╝

Rating: [🟢 READY / 🟡 SOLID / 🟠 GAPS / 🔴 REWORK] — [criterion phrase]

Gate Health
  🔴 Gate 1 — Blocking   [✅ M/M clear] or [❌ n open (M clear)]
  🟡 Gate 2 — Important  [✅ M/M clear] or [⚠️ n open (M clear)]
  💡 Gate 3 — Advisory   [n] noted

🔴 Gate 1 — Blocking ([M] applicable)
  [list only PASS and NEEDS_UPDATE questions — omit N/A items]
  [indent 2 spaces, one line each:]
  ✅ [Question short name] ([Q-ID])
  ❌ [Question short name] ([Q-ID])

🟡 Gate 2 — Important ([M] applicable)
  [list only PASS and NEEDS_UPDATE questions — omit N/A items]
  ✅ [Question short name] ([Q-ID])
  ⚠️ [Question short name] ([Q-ID])

💡 Gate 3 — Advisory ([M] applicable)
  [list only flagged advisory questions — omit N/A and non-flagged PASS]
  💡 [Question short name] ([Q-ID]): [finding — first sentence, ≤15 words]

  Example rendered:
  💡 Feedback loop completeness (Q-G25): manual verification present, no stated pass condition
  💡 Proportionality (Q-G23): Phase 3 step count is dense for a config-level change

  Note: Read advisory finding text from `advisory_findings_cache[q_id].finding` (persists across memoized passes) rather than only from current-pass evaluator data.

[Only render the following specialization sections when the corresponding flag is TRUE.
 Omit the section entirely when the flag is false — do NOT write "NOT INVOKED" placeholders.]

GAS Specialization (gas-plan)          ← render only when IS_GAS=true
  ✅ [M] questions — [P] PASS, [K] N/A (converged pass [N])
  OR
  ⚠️ [N] NEEDS_UPDATE remaining ([M] questions, [K] N/A)

Node Specialization (node-plan)        ← render only when IS_NODE=true
  ✅ [M] questions — [P] PASS, [K] N/A (converged pass [N])
  OR
  ⚠️ [N] NEEDS_UPDATE remaining ([M] questions, [K] N/A)

UI Specialization (ui-designer)        ← render only when HAS_UI=true
  [list only PASS and NEEDS_UPDATE UI questions — omit N/A items]
  ✅ [Question short name] ([Q-ID])
  ⚠️ [Question short name] ([Q-ID])

Organization Quality (Q-G9)            ← render only when plan has >= 3 implementation steps
  ✅ [N]/6 sub-questions clean
  OR
  ⚠️ [N]/6 — [K] flagged:
  [list only flagged sub-questions — omit PASS items]
    ❌ [Q-G9x] ([sub-question name]): [finding]

Triaged N/A                            ← omit entirely if total N/A count across all gates == 0
  IF K <= 5:
    [K] questions skipped:
    [list each N/A question, indent 2 spaces:]
      [Question name] ([Q-ID]): [one-phrase reason]
  IF K > 5:
    [K] questions skipped ([N] GAS-superseded, [M] flag-inactive, [P] scope-inapplicable)
    [list only N/A questions that are NOT from a fully-superseded cluster or fully-inactive flag — i.e., only "interesting" N/A items:]
      [Question name] ([Q-ID]): [one-phrase reason]
    [omit per-question listing for GAS-superseded clusters and flag-inactive clusters]
  [Note: Q-G9 is skipped at the section level when plan has < 3 steps — do not list it here as individual N/A items]

Review History                           ← omit if pass_count == 1 (single-pass convergence)
  Pass  Changes  Memoized         Gate 1  Gate 2  Duration  Timing (dispatch / fan-in / apply)
  [for each pass N from 1 to pass_count:]
  [N]   [changes_this_pass]     [memo_count]/[total_applicable_questions]   [gate1_open] open  [gate2_open] open  [pass_durations[N-1]]s  [dispatch_Ns] / [fanin_Ns] / [apply_Ns]
  Total: [pass_count] passes, [total_changes_all_passes] changes, [total_elapsed]s

  Changes from needs_update_counts_per_pass difference (pass N changes = changes applied that pass).
  Memoized = locked question count at end of that pass.
  Gate 1/Gate 2 open counts from needs_update_counts_per_pass breakdown.
  Duration from pass_durations[N-1]. Timing from pass_phase_timings[N-1].

Efficiency                               ← omit if pass_count == 1
  evaluators spawned: [evaluators_spawned_total] across [pass_count] pass(es)
  memoized/skipped: [total memoized evaluator-passes]
  memo coverage: [pct]% ([locked_questions]/[total_applicable_questions] questions)

  Memoized evaluator-passes = sum of evaluators NOT spawned each pass due to memoization.
  Memo coverage = 100 * locked_questions / total_applicable_questions at final pass.

📊 Prompt Improvement Recommendations   ← always rendered (even when "None")
  [signal label]: [recommendation ≤25 words]
  ...
  — or if no signals fire —
  None — prompt appears well-calibrated for this plan type
```

---

## After Review Completes

After the convergence loop exits (scorecard not yet printed):

1. **REWORK gate** (handled inside the convergence loop — not a post-loop step): By the time
   the loop exits, Gate 1 is either clean (→ READY/SOLID/GAPS rating) or still has unresolved
   issues after max passes (→ REWORK rating). Both paths proceed to the scorecard (step 4)
   and ExitPlanMode (step 8). Do not re-run the REWORK check here.

2. **Boilerplate epilogue (Q-E1, Q-E2)** — one-time injection, inline:
   Print: "╭─── EPILOGUE ───────────────────╮"
   Print: "  >> Checking boilerplate sections — git lifecycle and post-implementation workflow"

   **Q-E2: Post-implementation workflow**
   ```
   IF NOT IS_GAS:  # IS_GAS: N/A — covered by Q42
     Scan plan for "## Post-Implementation Workflow" section (or equivalent heading).
     IF section absent entirely:
       Inject at END of plan (after all implementation phases):
         ## Post-Implementation Workflow <!-- review-plan -->
         1. `/review-fix` — loop until clean <!-- review-plan -->
         2. Run build if applicable <!-- review-plan -->
         3. Run tests (if any) <!-- review-plan -->
         4. If build or tests fail: fix → re-run `/review-fix` → re-run build/tests — repeat <!-- review-plan -->
       epilogue_q_e2 = "PASS"
       Print: "  Q-E2: injected Post-Implementation Workflow"
     ELSE IF section present but missing step 4:
       Append step 4.
       epilogue_q_e2 = "PASS"
       Print: "  Q-E2: added step 4 (fail → re-run cycle)"
     ELSE:
       epilogue_q_e2 = "PASS"
       Print: "  Q-E2: ✅ present"
   ELSE:
     epilogue_q_e2 = "N/A"
     Print: "  Q-E2: — (IS_GAS, covered by Q42)"
   ```

   **Q-E1: Git lifecycle**
   ```
   IF NOT IS_GAS:  # IS_GAS: N/A — covered by Q1, Q2
     Scan plan for: (a) named feature branch, (b) per-phase git add+commit,
                     (c) push-to-remote, (d) merge/PR to main.
     missing = list of (a)-(d) not found
     IF missing is non-empty:
       Inject missing elements: per-phase commit steps within phases,
       branch/push/merge at end (before Post-Implementation). Mark <!-- review-plan -->.
       epilogue_q_e1 = "PASS"
       Print: "  Q-E1: injected [missing elements]"
     ELSE:
       epilogue_q_e1 = "PASS"
       Print: "  Q-E1: ✅ present"
   ELSE:
     epilogue_q_e1 = "N/A"
     Print: "  Q-E1: — (IS_GAS, covered by Q1/Q2)"
   ```

   Insert epilogue results into findings for scorecard:
   `findings["Q-E1"] = {"status": epilogue_q_e1, "gate": 1}`
   `findings["Q-E2"] = {"status": epilogue_q_e2, "gate": 1}`

   Print: "╰─── epilogue complete ──────────╯"
   Print: "  >> Epilogue complete — proceeding to organization pass"

3. **Q-G9 organization pass** (post-convergence structural check, inline):
   Print: "╭─── ORGANIZE ───────────────────╮"
   Print: "  >> Running structural organization check (Q-G9) on the finalized plan"
   N/A if plan has fewer than 3 implementation steps — skip this step entirely.
   Evaluate Q-G9 inline as specified in the "Q-G9 Post-Convergence Organization Pass"
   subsection in Layer 1 (no Task spawn — team-lead evaluates directly). Apply any NEEDS_UPDATE
   edits immediately. Q-G9 results will be included in the scorecard output in step 4.
   **Why after epilogue:** Q-G9 checks structural organization (sequential clarity, checkpoint
   visibility). Git commit steps and post-impl section are structural elements Q-G9 should see.

4. Print: "╭─── SCORECARD ──────────────────╮"
   Print: "  >> Compiling final scorecard from all evaluator findings"
   **Output the final scorecard** (incorporating epilogue Q-E1/Q-E2 and Q-G9 results). See
   "Output: Unified Scorecard" section for the full template. Include the "Organization Quality
   (Q-G9)" section when Q-G9 ran (plan had >= 3 implementation steps). Include Q-E1 and Q-E2
   in the Gate 1 section of the scorecard.

4b. **Meta-Reflection Pass** (inline, no agent spawn):
   Analyze signals accumulated during the convergence loop to surface 0–5 concise
   recommendations for improving review-plan's question set or prompt structure. This step
   is read-only — no edits to the plan file.

   **Signal table — evaluate each; generate a recommendation only if the signal fires:**

   | Signal | Data source | Fires when | Example recommendation |
   |--------|-------------|------------|------------------------|
   | High N/A rate (>40%) for a cluster | `cluster_results`: count findings with status "N/A" per cluster vs total questions in that cluster | Any active cluster has >40% N/A | "Impact cluster had 5/6 N/A — consider a flag-gate or scoping condition to reduce noise" |
   | Question unresolved across 3+ passes | `needs_update_counts_per_pass`: same Q-ID in NEEDS_UPDATE for 3+ consecutive passes | Any Q-ID oscillates ≥3 passes | "[Q-ID] oscillated across passes — criteria may be ambiguous; add concrete thresholds" |
   | Gate 3 advisory with empty/vague edit instruction | `advisory_findings_cache`: check for null or short (<10 chars) edit fields | Any Gate 3 entry has no actionable edit | "[Q-ID] advisory fires often but produces no actionable edit — consider removing or promoting" |
   | Max passes hit with Gate 1 still open | `pass_count == 5 AND gate1_open > 0` at final pass | Loop hit ceiling without resolving Gate 1 | "[Q-ID] edit instructions may need stronger prescriptive templates to converge within max passes" |
   | Low memo coverage (<30%) | `total_memo_count / total_applicable_questions` at final pass | Coverage below 30% | "Low memoization coverage suggests evaluator inconsistency — consider explicit stability criteria" |
   | Plan topic with zero question coverage | Scan plan headings/topics against all evaluated question IDs | A substantive plan section has no matching question | "No question covers [topic] found in this plan — consider a new question or cluster extension" |
   | Gate 2 persistently open (>3) at GAPS rating | `gate2_open > 3 AND rating == GAPS` | GAPS rating with many open Gate 2 items | "Gate 2 edit instructions for [Q-IDs] appear non-prescriptive — strengthen with concrete edit templates" |

   **Rules:**
   - Generate 0–5 recommendations (fewer is better — only surface real signals)
   - Skip signals that only apply to IS_TRIVIAL plans
   - Do NOT recommend changes that would alter Gate 1 blocking status
   - Each recommendation format: `[Signal label]: [recommendation ≤25 words]`
   - If no signals fire, output: `None — prompt appears well-calibrated for this plan type`

   Print the `📊 Prompt Improvement Recommendations` section immediately after the scorecard:
   ```
   📊 Prompt Improvement Recommendations
     [signal label]: [recommendation ≤25 words]
     ...
     — or —
     None — prompt appears well-calibrated for this plan type
   ```

5. **Cleanup plan markers:** Use the Edit tool with `replace_all=true` on the plan file to
   strip all self-referential markers that served their purpose during the convergence loop
   (including any added by the epilogue in step 2 and Q-G9 in step 3):
   - `" <!-- review-plan -->"` → `""` (remove)
   - `" <!-- gas-plan -->"` → `""` (remove)
   - `" <!-- node-plan -->"` → `""` (remove)
   This delivers a clean plan file to the user for implementation (no stray HTML comments).
   Only strip the markers — do not remove the content they annotated.

6. Use the Bash tool to run:
   ```
   touch "~/.claude/.plan-reviewed-${plan_slug}"
   rm -f <memo_file>
   rm -rf "$RESULTS_DIR"
   ```
   First command writes the gate marker so ExitPlanMode will pass.
   Second command removes the convergence checkpoint (no longer needed after loop exits).
   Third command removes the temp results directory.

7. **Remaining issues summary (non-READY ratings):**
   ```
   IF Rating == READY:
     No issues to print — proceed directly to step 8 (ExitPlanMode)
   IF Rating == SOLID or GAPS:
     Print: "ℹ️ [N] Gate 2 issues remaining (not blocking):"
     For each remaining Gate 2 NEEDS_UPDATE question:
       Print: "  - [question short name] ([ID]): [one-sentence summary of finding]"
     Print: "These are advisory — reject the plan approval to address them."
     Proceed to ExitPlanMode (user can reject ExitPlanMode if they want to fix issues first)
   IF Rating == REWORK:
     Print: "🔴 [N] Gate 1 issue(s) remaining after maximum passes:"
     For each remaining Gate 1 NEEDS_UPDATE question:
       Print: "  - [question short name] ([ID]): [one-sentence summary of finding]"
     Print: "These are BLOCKING — reject plan approval to continue fixing before implementation."
     Proceed to ExitPlanMode
   ```
   This is a single approval point: the user sees remaining issues in printed text, then
   ExitPlanMode is the one decision point. No double-approval friction.

8. **Call ExitPlanMode immediately.** Do not pause, do not ask the user "should I present the plan?"

The PreToolUse hook on ExitPlanMode checks for this marker and consumes it on success.
