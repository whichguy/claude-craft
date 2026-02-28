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
model: sonnet
allowed-tools: all
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
       IS_TRIVIAL=true|false
     """
   )
   Parse output → set IS_GAS, IS_NODE, HAS_UI, HAS_DEPLOYMENT, HAS_STATE, IS_TRIVIAL
   IF Haiku timeout or malformed output → all flags false (IS_TRIVIAL=false)
     (fallback activates git, impact, testing, security clusters unconditionally)

   Compute cluster activation:
   ```
   IF IS_GAS:
     # All L2 clusters superseded by gas-evaluator except impact (for Q-C26 — no gas equivalent)
     active_clusters = ["impact"]  # always active — Q-C26 evaluates here
   ELSE:
     active_clusters = ["git", "impact", "testing"]  # always active
     if HAS_STATE:       active_clusters.append("state")
     active_clusters.append("security")              # always active (3 questions, low overhead)
     if HAS_DEPLOYMENT:  active_clusters.append("operations")
     # Client cluster (Q-C17, Q-C25) merged into ui-evaluator when HAS_UI=true — no separate client-evaluator
   ```

   IF IS_TRIVIAL:
     Print: "──── FAST PATH ──────────"
     Print: "⚡ Trivial plan: 1 file ([ext]), additive only"
     Print: "  questions: Q-G1, Q-G2, Q-G5, Q-NEW, Q-C1, Q-G11"
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
           Q-NEW (Post-implementation workflow — N/A for IS_GAS)
           Q-C1 (Git lifecycle — never N/A)
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
           Q-NEW Post-implementation      ✅
           Q-C1  Git lifecycle            ✅
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
         # Do not jump here — fall through to Steps 4–5 below (tracking init + TeamCreate) before entering convergence loop

   Print: "──── CONFIG ─────────────"
   Print mode based on flags:
     IS_GAS + HAS_UI:     "📋 Review mode: GAS + UI (gas-eval + impact cluster + ui-evaluator, [N] active)"
     IS_GAS only:         "📋 Review mode: GAS (gas-eval + impact cluster for Q-C26, [N] active)"
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
   memoized_l1_questions = set()   # {Q-G11, Q-G6, Q-G7, Q-G18} once confirmed stable PASS or N/A (Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G19, Q-G20, Q-NEW are not memoizable)
   prev_pass_results = {}          # Q-ID → PASS/NEEDS_UPDATE/N/A from previous pass (for stability-based memoization)
   spawned_evaluators = []         # names of all evaluator agents actually launched (for precise teardown)
   memo_file = "~/.claude/.review-plan-memo-" + plan_slug + "-" + timestamp + ".json"
   # memo_file: checkpoint written after each pass for context-compression resilience.
   # If state is lost mid-loop (long reviews): re-read memo_file at start of next pass.
   ```

5. **Team setup (always):**
   ```
   team_name = "review-plan-" + timestamp
   TeamCreate({team_name, description: "review-plan — parallel L1/cluster/ecosystem evaluators"})
   ```
   Print: "──── REVIEW ─────────────"

6. **Error handling:** Wrap the entire convergence loop:
   ```
   IF any unrecoverable error during convergence loop:
     Send shutdown_request to any active evaluators, then TeamDelete
     Surface error to user via AskUserQuestion
     Do not leave orphaned team processes.
   ```

---

## Convergence Loop

```
DO:
  -- DO NOT call TeamCreate here. Team was created once in Step 0 and persists across all passes. --

  -- Context-compression recovery: if memoized state appears lost, restore from checkpoint --
  _recovered_this_pass = false
  IF memo_file exists AND (memoized_clusters is empty AND memoized_l1_questions is empty AND pass_count == 0):
    Read memo_file → restore memoized_clusters, memoized_since, memoized_l1_questions,
                     prev_needs_update_set, pass1_needs_update_set, prev_pass_results,
                     total_changes_all_passes, pass_count,
                     needs_update_counts_per_pass, pass_durations,
                     total_applicable_questions, memo_milestones_printed
    _recovered_this_pass = true
    Print: "⚠️ Context recovery: restored memoized state from checkpoint (pass [pass_count])"

  IF NOT _recovered_this_pass:
    pass_count += 1
  pass_start_time = Date.now()
  changes_this_pass = 0
  l1_changes = 0
  cluster_changes = {}            # maps cluster_name → change count this pass
  cluster_changes_total = 0
  gas_plan_changes = 0
  node_plan_changes = 0
  ui_plan_changes = 0

  Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count/5]: evaluating..."  # 5 = max passes ceiling (pass_count >= 5 in CONVERGENCE CHECK)

  [Substitute plan_path, questions_path, questions_l3_path, gas_eval_path, and node_eval_path (all derived in Step 0) into evaluator prompts before spawning]
  [In a SINGLE message, spawn all evaluators in parallel:
   L1 always + one Task per active cluster + ecosystem if IS_GAS/IS_NODE + ui-evaluator if HAS_UI.
   Practical maximums: IS_GAS mode = L1 + impact cluster + gas-eval + UI = 4.
   Non-GAS full-stack (6 clusters + UI) = L1 + 6 + UI = 8.
   (Client cluster merged into ui-evaluator — no separate agent.)
   If Task concurrency limits are hit, batch clusters into 2 waves (Gate 1 clusters first).]
  [After spawning each evaluator, append its name to spawned_evaluators]

  --- L1 Evaluator ---
  Task(
    subagent_type = "general-purpose",
    model = "sonnet",
    team_name = <team_name>,
    name = "l1-evaluator-p" + pass_count,
    prompt = """
      You are evaluating a plan for general quality (Layer 1: 18 questions).

      Question definitions: Read <questions_path> (Layer 1 section)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ALL L1 questions: Q-G1, Q-G2, Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-NEW, Q-G10, Q-G11, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19, Q-G20
      Apply triage (mark N/A per the N/A column).
      Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
      or <!-- node-plan -->.
      [IF memoized_l1_questions is non-empty, append to prompt:]
      Memoized questions — SKIP, already stable (PASS or N/A): [comma-separated memoized_l1_questions]
      These were confirmed PASS or N/A in a prior pass and are structurally stable.
      Do not re-evaluate them; treat as PASS in your output.

      Output contract — send ONE message to team-lead:
        FINDINGS FROM l1-evaluator
        Q-G1: PASS | NEEDS_UPDATE | N/A — [finding]
        [EDIT: instruction if NEEDS_UPDATE]
        Q-G2: ...
        ... (all 18 questions: Q-G1, Q-G2, Q-G4–G8, Q-NEW, Q-G10–G14, Q-G16–G20)

      Constraints:
      - Do not use Edit, Write, or Bash tools — read-only
      - Do not call ExitPlanMode or touch marker files
      - Send exactly ONE message to team-lead

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  --- Cluster Evaluators (one Task per active cluster) ---
  For each cluster_name in active_clusters:
    IF cluster_name in memoized_clusters:
      Print: "  ⏭️ <cluster_name>-evaluator — MEMOIZED (all PASS/N/A since pass [memoized_since[cluster_name]])"
      # Memoized clusters have 0 NEEDS_UPDATE by definition — no carry-forward needed.
      # NEEDS_UPDATE tracking is unaffected by PASS/N/A questions (they never enter the set).
      CONTINUE to next cluster
  Task(
    subagent_type = "general-purpose",
    model = "sonnet",
    team_name = <team_name>,
    name = "<cluster_name>-evaluator-p" + pass_count,
    prompt = """
      You are evaluating a plan for <cluster_description> (<N> questions in this cluster).

      Question definitions: Read <questions_path>,
        section "### Cluster <N>: <cluster_name>".
      Skip content marked <!-- review-plan --> or <!-- gas-plan --> or <!-- node-plan -->.

      Context flags (substituted by team-lead at spawn time):
        IS_NODE=<IS_NODE>   IS_GAS=<IS_GAS>

      IS_NODE suppression (apply only when IS_NODE=true above):
        Q-C16 (Security cluster, →N6), Q-C18 (State cluster, →N8), Q-C21 (Operations cluster, →N22)
        are N/A-superseded when IS_NODE=true.
      IS_GAS note: if you are the impact-evaluator and IS_GAS=true above, evaluate Q-C26 only;
        Q-C3, Q-C8, Q-C12, Q-C14, Q-C27 are N/A-superseded (covered by gas-evaluator).
        State cluster (Q-C13, Q-C18, Q-C19, Q-C24) is fully superseded when IS_GAS=true.

      Output contract — send ONE message to team-lead:
        FINDINGS FROM <cluster_name>-evaluator
        <Q-ID>: PASS | NEEDS_UPDATE | N/A — [finding]
        [EDIT: instruction if NEEDS_UPDATE]
        ... (all questions in this cluster)

      Constraints:
      - Do not use Edit, Write, or Bash tools — read-only
      - Do not call ExitPlanMode or touch marker files
      - Send exactly ONE message to team-lead

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  IF IS_GAS:
    --- GAS Evaluator ---
    Task(
      subagent_type = "general-purpose",
      model = "sonnet",
      team_name = <team_name>,
      name = "gas-evaluator-p" + pass_count,
      prompt = """
        You are the gas-eval running inside review-plan's team. Follow the instructions in
        <gas_eval_path> exactly.

        Plan to evaluate: <plan_path>

        Constraints: read-only — do not edit the plan, do not call ExitPlanMode, do not
        call TeamCreate. Send exactly ONE message to team-lead with all findings.
      """
    )
  ELSE IF IS_NODE:
    --- Node Evaluator ---
    Task(
      subagent_type = "general-purpose",
      model = "sonnet",
      team_name = <team_name>,
      name = "node-evaluator-p" + pass_count,
      prompt = """
        You are the node-eval running inside review-plan's team. Follow the instructions in
        <node_eval_path> exactly.

        Plan to evaluate: <plan_path>

        Constraints: read-only — do not edit the plan, do not call ExitPlanMode, do not
        call TeamCreate. Send exactly ONE message to team-lead with all findings.
      """
    )

  IF HAS_UI:
    --- UI Evaluator (includes merged Client cluster: Q-C17, Q-C25) ---
    Task(
      subagent_type = "ui-designer",
      model = "sonnet",
      team_name = <team_name>,
      name = "ui-evaluator-p" + pass_count,
      prompt = """
        You are the ui-evaluator running inside review-plan's team. Evaluate the plan for
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

        Output contract — send ONE message to team-lead:
          FINDINGS FROM ui-evaluator
          Q-U1: PASS | NEEDS_UPDATE | N/A — [finding]
          [EDIT: instruction if NEEDS_UPDATE]
          ... (all 9 questions: Q-U1 through Q-U7, Q-C17, Q-C25)

        Constraints:
        - Do not use Edit, Write, or Bash tools — read-only
        - Do not call ExitPlanMode or touch marker files
        - Send exactly ONE message to team-lead

        Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
      """
    )

  Wait for all evaluator messages (90s reminder; after 120s mark ⚠️ Evaluator Incomplete
  for any non-responding evaluator and proceed with available findings).
  Incomplete evaluator rule: An Incomplete evaluator contributes ZERO findings for its
  questions only. Pass CAN converge if responding evaluators returned 0 NEEDS_UPDATE AND
  the Incomplete evaluator returned 0 NEEDS_UPDATE in the immediately prior pass. If the
  Incomplete evaluator had NEEDS_UPDATE last pass: do NOT converge; spawn it again next pass.
  Incomplete cluster evaluator: its cluster's questions treated as same NEEDS_UPDATE status
  as their previous pass (other cluster evaluators' findings are unaffected).

  pass_elapsed = Math.round((Date.now() - pass_start_time) / 1000)
  pass_durations.append(pass_elapsed)

  Print evaluator status grid (tree diagram with aligned columns):
    # Compute per-evaluator elapsed time from spawn to response (approximate: total pass time
    # is known; per-evaluator is estimated as pass_elapsed unless individual timestamps available).
    # Symbol key: ● = completed, ⊘ = memoized (not spawned), ◌ = timeout (incomplete)
    # Columns: name (right-pad with dashes to col 16) + symbol + ✗/✓/— counts + [Ns]
    # Skipped clusters (not in active_clusters) are omitted entirely.
    # Build list of evaluator lines, then print with tree connectors (┌ first, ├ middle, └ last).
    evaluator_lines = []

    If l1 responded:   evaluator_lines.append("l1 ─────── ● ✗[n] ✓[m] —[k]  [{elapsed}s]")
    If l1 incomplete:  evaluator_lines.append("l1 ─────── ◌ timeout")
    For each cluster_name in active_clusters:
      If responded:   evaluator_lines.append("<cluster_name> ── ● ✗[n] ✓[m] —[k]  [{elapsed}s]")
      If memoized:    evaluator_lines.append("<cluster_name> ── ⊘ memoized p[memoized_since[cluster_name]]")
      If incomplete:  evaluator_lines.append("<cluster_name> ── ◌ timeout")
    If IS_GAS:
      If gas responded:   evaluator_lines.append("gas-eval ── ● ✗[n] ✓[m] —[k]  [{elapsed}s]")
      If gas incomplete:  evaluator_lines.append("gas-eval ── ◌ timeout")
    If IS_NODE:
      If node responded:  evaluator_lines.append("node-eval ─ ● ✗[n] ✓[m] —[k]  [{elapsed}s]")
      If node incomplete: evaluator_lines.append("node-eval ─ ◌ timeout")
    If HAS_UI:
      If ui responded:    evaluator_lines.append("ui ──────── ● ✗[n] ✓[m] —[k]  [{elapsed}s]")
      If ui incomplete:   evaluator_lines.append("ui ──────── ◌ timeout")

    Print tree (where n = len(evaluator_lines) - 1):
      If n == 0: "  └ " + evaluator_lines[0]   (only 1 evaluator — no ┌/├)
      Else:
        "  ┌ " + evaluator_lines[0]
        For i in 1..n-1: "  ├ " + evaluator_lines[i]  (middle lines, inclusive range)
        "  └ " + evaluator_lines[n]

  -- Merge & Apply --
  COLLECT all NEEDS_UPDATE findings from L1, cluster evaluators, ecosystem evaluator, and ui-evaluator
  l1_results = {Q-ID: status}  # built from l1-evaluator's message: parse each "Q-Gn: PASS|NEEDS_UPDATE|N/A" line
  IF IS_GAS:
    Remove true duplicates (same concern raised by both cluster evaluator and gas-evaluator —
    keep gas-evaluator's more specific GAS framing)
  IF IS_NODE:
    Remove true duplicates (same concern raised by both cluster evaluator and node-evaluator —
    keep node-evaluator's more specific Node/TS framing)
  IF HAS_UI:
    Remove true duplicates between ui-evaluator and cluster evaluators (keep ui-evaluator's
    more specific UI framing); remove duplicates between ui-evaluator and gas-evaluator if
    IS_GAS (keep gas-evaluator's GAS-specific framing for GAS UI concerns)

  Before applying edits, print a summary using this exact format:
    Print: "Applying [N] changes:"
    Print: "  1. [question short name] ([ID]): [verb] [object]"
    Print: "  2. ..."
    Then proceed with Edit calls.
  Example:
    Applying 3 changes:
      1. Git lifecycle (Q-C1): adding branch + commit steps
      2. Step ordering (Q-C9): reordering steps 3-4 for dependency correctness
      3. Post-implementation (Q-NEW): adding exec verification after push steps
  (If changes_this_pass == 0, skip the summary entirely.)

  APPLY edits — for each [EDIT: ...] instruction in any evaluator message:
    Call the Edit tool on the plan file to insert/modify the specified content.
    Mark each insertion <!-- review-plan -->.
    Each Edit call = 1 change. Do not count findings you only described in text.
  CONSOLIDATE: merge overlapping findings, remove duplicate annotations
    Keep-exemption: content annotated <!-- keep: [reason] --> is EXEMPT from consolidation removal.
    "Key flow" = any implementation step, ordering dependency, error path, rollback step, or
    verification checkpoint. Prose trimming is OK. Removing or merging steps is NOT.
  REGRESSION CHECK: before RE-READ, verify no key flow, corner case, or condition was
    removed during this pass — restore any dropped logic and annotate <!-- keep: [reason] -->
  RE-READ the full consolidated plan

  l1_changes = count of L1 NEEDS_UPDATE edits applied
  cluster_changes = {cluster_name: count of edits applied for each active cluster}
  cluster_changes_total = sum of all cluster evaluator NEEDS_UPDATE edits applied
  IF IS_GAS: gas_plan_changes = count of gas-evaluator NEEDS_UPDATE edits applied
  IF IS_NODE: node_plan_changes = count of node-evaluator NEEDS_UPDATE edits applied
  IF HAS_UI: ui_plan_changes = count of ui-evaluator NEEDS_UPDATE edits applied
  changes_this_pass = l1_changes + cluster_changes_total + gas_plan_changes + node_plan_changes + ui_plan_changes
  total_changes_all_passes += changes_this_pass

  # Memoization update (post-pass, one-way — once memoized, never removed)
  # Memoization principle: memoize only criteria that check "additive-only" structural
  # properties — once met, subsequent plan edits cannot make the criterion fail again.
  # Memoizable: Q-G11 (file paths cited), git cluster (branch/commit steps).
  # NOT memoizable: criteria that check evolving properties (scope, assumptions, phase structure, etc.)
  # Q-G1 (Approach soundness): NOT memoizable — plan edits can alter approach scope/complexity
  # Q-G2 (Standards compliance): NOT memoizable — new steps can introduce directive violations
  # Q-NEW is NOT memoizable — mandatory framing can change as plan is revised.
  # Git cluster: safe to memoize (additive-only — branch + commit steps cannot be removed by edits)
  IF "git" in active_clusters AND "git" NOT in memoized_clusters:
    IF git-evaluator-p<pass_count> returned 0 NEEDS_UPDATE (all PASS or N/A):
      memoized_clusters.add("git")
      memoized_since["git"] = pass_count
      newly_memoized.append("git")  # track for milestone display
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
  # Q-C27, Q-C28, Q-C29: not individually memoizable by design (their clusters — impact, operations,
  # testing — are not currently added to memoized_clusters; only the git cluster is memoized)
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
          IF Q-ID is Gate 2 or Gate 3 L1 question:  # never Gate 1 (Q-G1, Q-G2, Q-G11, Q-NEW); cluster questions handled by memoized_clusters
            IF Q-ID NOT in memoized_l1_questions:
              memoized_l1_questions.add(Q-ID)
              newly_memoized.append(Q-ID)  # track for milestone display (stability-locked)
  prev_pass_results = l1_results  # update for next pass (L1 results only; cluster stability tracked separately)

  # Memoization milestone output (Enhancement E)
  # Print individual lock events (cap at 3 per pass, then "+N more")
  newly_memoized = []  # collect items memoized THIS pass for display
  # (Populate newly_memoized during the memoization logic above: append each Q-ID or cluster
  #  name when it is added to memoized_l1_questions or memoized_clusters this pass.)
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
    total_applicable_questions = 18 + sum(questions per active cluster) + (51 if IS_GAS else 0) + (38 if IS_NODE else 0) + (9 if HAS_UI else 0)
  total_memo_count = len(memoized_l1_questions) + sum(questions in each memoized_cluster)
  memo_pct = Math.round(100 * total_memo_count / total_applicable_questions)
  FOR threshold in [25, 50, 75]:
    IF memo_pct >= threshold AND threshold NOT in memo_milestones_printed:
      memo_milestones_printed.add(threshold)
      accel_label = IF threshold == 25: "picking up speed" ELSE IF threshold == 50: "accelerating" ELSE: "almost locked"
      Print: "  memo: [threshold]% of questions locked — [accel_label]"

  current_needs_update_set = {set of Q/N numbers with NEEDS_UPDATE this pass across all evaluators}

  IF pass_count == 1:
    pass1_needs_update_set = current_needs_update_set  # snapshot for resolved_questions computation

  -- Checkpoint: persist memoized state for context-compression resilience --
  Write memo_file with JSON: {
    pass_count, memoized_clusters: [...memoized_clusters],
    memoized_since, memoized_l1_questions: [...memoized_l1_questions],
    prev_needs_update_set: [...current_needs_update_set],
    pass1_needs_update_set: [...pass1_needs_update_set],
    prev_pass_results,
    total_changes_all_passes,
    needs_update_counts_per_pass,
    pass_durations,
    total_applicable_questions,
    memo_milestones_printed: [...memo_milestones_printed]
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
    Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count/5] — 0 changes  [{pass_elapsed}s]"
  else:
    Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count/5] — [changes_this_pass] changes  ([join(breakdown_parts, ' ')])  [{pass_elapsed}s]"

  # Delta visualization (Enhancement C)
  IF pass_count == 1:
    Print: "  snapshot: ✗[current_nu_count] questions need work"
  ELSE:
    prev_nu = needs_update_counts_per_pass[pass_count - 2]  # previous pass count
    delta = current_nu_count - prev_nu
    delta_str = IF delta < 0: "(↓[abs(delta)])" ELSE IF delta > 0: "(↑[delta])" ELSE: "(→0)"
    memo_count = len(memoized_l1_questions) + sum(questions in each memoized_cluster)
    # Use question count (not cluster count) to match milestone math at total_memo_count computation
    IF memo_count <= 3:
      memo_names = comma-separated list of memoized Q-IDs and cluster names
      Print: "  delta: ✗ [prev_nu]→[current_nu_count] [delta_str]  memoized: [memo_names]"
    ELSE:
      Print: "  delta: ✗ [prev_nu]→[current_nu_count] [delta_str]  memoized: [memo_count] questions locked"
    IF pass_count >= 3:
      trend_values = join(needs_update_counts_per_pass, " → ")
      last3 = needs_update_counts_per_pass[-3:]
      trend_arrow = IF last3[-1] < last3[0]: "↘ converging" ELSE IF last3[-1] > last3[0]: "↗ oscillating" ELSE: "→ flat"
      Print: "  trend: [trend_values]  [trend_arrow]"

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
  Print: "  gates: [🔴 [gate1_sym]] [🟡 [gate2_sym]] [💡 [gate3_noted]]"  # outer [...] are literal printed brackets; inner [gate1_sym] etc. are substituted values

  Gate2_stable = (prev_needs_update_set == current_needs_update_set)  # set equality: order-independent; compare BEFORE updating prev
  prev_needs_update_set = current_needs_update_set  # update AFTER Gate2_stable check; placed before CONVERGENCE CHECK so CONTINUE paths don't leave stale state
  -- CONVERGENCE CHECK (gate-aware) --
  IF IS_GAS:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G11,
                       Q1, Q2, Q13, Q15, Q18, Q42
                       (Q-NEW is N/A for IS_GAS — covered by Q42; L2 cluster questions are N/A-superseded by gas-evaluator)
  ELSE IF IS_NODE:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-NEW, Q-G11, Q-C1, Q-C3,
                       N1
  ELSE:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-NEW, Q-G11, Q-C1, Q-C3

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
        - Git lifecycle (Q-C1): no feature branch or merge-to-main step defined
        - Impact analysis (Q-C3): callers/features affected but not addressed
      Looping for pass 2...
    CONTINUE (do NOT exit when Gate 1 is still open, even if changes_this_pass == 0)
  IF changes_this_pass == 0 OR Gate2_stable:
    total_elapsed = Math.round((Date.now() - timestamp) / 1000)
    IF pass_count == 1:
      Print: "✅ Converged — no issues found (pass 1, [total_elapsed]s)"
    ELSE:
      resolved_questions = pass1_needs_update_set - current_needs_update_set  # Q-IDs fixed since pass 1
      Print: "✅ Converged after [pass_count] passes ([total_elapsed]s total | [total_changes_all_passes] changes)"
      IF resolved_questions is non-empty:
        Print: "  resolved: [comma-separated resolved_questions sorted by ID]"
      Print: "  gates: [🔴 ✅] [🟡 ✅ [count of Gate2 PASS]] [💡 [count of Gate3 noted]]"
    BREAK → proceed to "After Review Completes"
  -- END CHECK --

WHILE TRUE

-- Convergence complete. Proceed to "After Review Completes" below: Q-G9 → scorecard output → marker cleanup → teardown → ExitPlanMode. --
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

L1 per-pass count: 18 questions (Q-G1 through Q-G8 + Q-NEW + Q-G10 through Q-G14 + Q-G16 through Q-G20).
Count L1 edits → `l1_changes += count` (combined into `changes_this_pass` in Convergence Loop)

### Q-G9 Post-Convergence Organization Pass

*Runs once after the convergence loop exits. Not part of per-pass L1 evaluation.*
*L1 per-pass count stays at 18 (Q-G1 through Q-G8 + Q-NEW + Q-G10 through Q-G14 + Q-G16 through Q-G20). Q-G9 is not included in*
*convergence loop scoring. N/A if plan has fewer than 3 implementation steps.*

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

For each NEEDS_UPDATE finding: apply the edit to the plan immediately. Mark <!-- review-plan -->.
Print result after applying any edits:
  Organization: ✅ inline (5/5)              ← all PASS
  Organization: ⚠️ inline (N/5) — K flagged  ← K sub-questions had NEEDS_UPDATE

Q-G9 results are included in the scorecard output (step 3 of "After Review Completes"; see Organization Quality section below).

---

## Layer 2: Code Change Quality

Question definitions are in QUESTIONS.md — cluster evaluators read that file directly. Team-lead
only parses evaluator output (`Q-ID: PASS/NEEDS_UPDATE/N/A`). 28 questions organized into 7
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

In IS_GAS mode, gas-plan runs as part of the parallel evaluator team each pass (see Convergence
Loop above). The gas-evaluator Task follows evaluate mode (as defined in `<gas_eval_path>`), which means:
- gas-plan runs a SINGLE evaluation pass (no internal convergence loop)
- Returns all 51-question findings via SendMessage to team-lead
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence

In IS_NODE mode (mutually exclusive with IS_GAS), node-plan runs as part of the parallel
evaluator team each pass. The node-evaluator Task follows evaluate mode (as defined in `<node_eval_path>`), which means:
- node-plan runs a SINGLE evaluation pass (no internal convergence loop)
- Returns all 38-question findings via SendMessage to team-lead
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence

When neither IS_GAS nor IS_NODE, no ecosystem evaluator is invoked.

**IS_GAS Cluster Suppression:**

| Cluster | Superseded? | Gas-evaluator equivalents |
|---------|-------------|--------------------------|
| Git (1) | **fully** | Q1, Q2 |
| Impact (2) | **partially** — Q-C26 has no gas equivalent (evaluates via impact cluster) | Q18, Q16, Q39, Q41; Q-C27 N/A (no external API consumers in GAS projects) |
| Testing (3) | **fully** | Q11, Q12, Q17, Q19, Q20; Q-C29 N/A (gas-evaluator Q11/Q12 cover test strategy) |
| State (4) | **fully** (Q-C26 promoted to Impact cluster) | Q40, Q21, Q24, Q3 (for Q-C13/18/19/24) |
| Security (5) | **fully** | Q27, Q28, Q23 |
| Operations (6) | **fully** | Q9, Q10, Q29, Q22, Q25; Q-C28 N/A (exec verification + Q6/Q12 cover GAS observability) |
| Client (7) | **merged into ui-evaluator** when HAS_UI=true; **fully superseded** by gas-evaluator Q32, Q33 when IS_GAS | Q32, Q33 |

Result: When IS_GAS=true, skip ALL cluster evaluators EXCEPT Impact cluster (always active — Q-C26
has no gas equivalent). Q-C17 and Q-C25 are handled by ui-evaluator when HAS_UI=true (not a
separate cluster evaluator). Mark all other IS_GAS-superseded questions N/A-superseded in the scorecard.

**IS_NODE Individual Suppressions (3 questions span multiple clusters):**
Cluster-level suppression does not apply for IS_NODE. Mark these 3 questions N/A-superseded
within their respective cluster evaluators when IS_NODE=true:
  Q-C16 (Security cluster, →N6), Q-C18 (State cluster, →N8), Q-C21 (Operations cluster, →N22)

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
- Returns all 9-question findings (Q-U1 through Q-U7, Q-C17, Q-C25) via SendMessage to team-lead
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence
- No separate client-evaluator is spawned when HAS_UI=true

HAS_UI is orthogonal to IS_GAS/IS_NODE: a GAS project with a sidebar will have
IS_GAS=true, HAS_UI=true → spawns L1 + gas-evaluator + impact cluster (always active for Q-C26) + ui-evaluator.

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
appear as a suffix for referenceability (user can say "fix Q-C1").

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
  💡 [Question short name] ([Q-ID])

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
  ✅ [N]/5 sub-questions clean
  OR
  ⚠️ [N]/5 — [K] flagged:
  [list only flagged sub-questions — omit PASS items]
    ❌ [Q-G9x] ([sub-question name]): [finding]

Triaged N/A                            ← omit entirely if total N/A count across all gates == 0
  [K] questions skipped:
  [list each N/A question, indent 2 spaces:]
    [Question name] ([Q-ID]): [one-phrase reason]
  [Note: Q-G9 is skipped at the section level when plan has < 3 steps — do not list it here as individual N/A items]
```

---

## After Review Completes

After the convergence loop exits (scorecard not yet printed):

1. **REWORK gate** (handled inside the convergence loop — not a post-loop step): By the time
   the loop exits, Gate 1 is either clean (→ READY/SOLID/GAPS rating) or still has unresolved
   issues after max passes (→ REWORK rating). Both paths proceed to the scorecard (step 3)
   and ExitPlanMode (step 8). Do not re-run the REWORK check here.

2. **Q-G9 organization pass** (post-convergence structural check, inline):
   Print: "──── ORGANIZE ───────────"
   N/A if plan has fewer than 3 implementation steps — skip this step entirely.
   Evaluate Q-G9 inline as specified in the "Q-G9 Post-Convergence Organization Pass"
   subsection in Layer 1 (no Task spawn — team-lead evaluates directly). Apply any NEEDS_UPDATE
   edits immediately. Q-G9 results will be included in the scorecard output in step 3.

3. Print: "──── SCORECARD ──────────"
   **Output the final scorecard** (incorporating Q-G9 results from step 2). See "Output: Unified
   Scorecard" section for the full template. Include the "Organization Quality (Q-G9)" section
   when Q-G9 ran (plan had >= 3 implementation steps).

4. **Cleanup plan markers:** Use the Edit tool with `replace_all=true` on the plan file to
   strip all self-referential markers that served their purpose during the convergence loop
   (including any added by Q-G9 in step 2):
   - `" <!-- review-plan -->"` → `""` (remove)
   - `" <!-- gas-plan -->"` → `""` (remove)
   - `" <!-- node-plan -->"` → `""` (remove)
   This delivers a clean plan file to the user for implementation (no stray HTML comments).
   Only strip the markers — do not remove the content they annotated.

5. Use the Bash tool to run:
   ```
   touch "~/.claude/.plan-reviewed-${plan_slug}"
   rm -f <memo_file>
   ```
   First command writes the gate marker so ExitPlanMode will pass.
   Second command removes the convergence checkpoint (no longer needed after loop exits).

6. **Team teardown (always):** Send shutdown_request to all agents in `spawned_evaluators`
   (only agents that were actually launched — memoized clusters were not spawned and will not
   be in spawned_evaluators). Then call TeamDelete. (Teardown must complete before ExitPlanMode —
   the session context needed for TeamDelete is not available after exiting plan mode.)
   Reference: spawned_evaluators will contain entries like `l1-evaluator-p<N>`,
   `<cluster_name>-evaluator-p<N>`, `gas-evaluator-p<N>`, `node-evaluator-p<N>`,
   `ui-evaluator-p<N>`. All per-pass evaluators use `-p<pass_count>` suffix to prevent
   name collisions on re-spawn. Q-G9 is inline (no agent to shut down).

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
