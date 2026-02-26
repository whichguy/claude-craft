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
   - Path variables — derive at runtime from the path this file was read from; substitute into evaluator prompts at spawn time (same as `<plan_path>`):
     - `<questions_path>`: sibling QUESTIONS.md — replace `SKILL.md` with `QUESTIONS.md` in this file's path
     - `<gas_eval_path>`:  peer skill — replace `review-plan/SKILL.md` with `gas-plan/EVALUATE.md` in this file's path
     - `<node_eval_path>`: peer skill — replace `review-plan/SKILL.md` with `node-plan/EVALUATE.md` in this file's path

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
                       environments, or release process. False for local-only changes.
       HAS_STATE: true if plan modifies persistent storage, databases, config files,
                  state schemas, or stateful operations. False for read-only or
                  ephemeral changes.

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
     # All L2 clusters superseded by gas-evaluator except state (for Q-C26 only)
     active_clusters = ["state"] if HAS_STATE else []
   ELSE:
     active_clusters = ["git", "impact", "testing"]  # always active
     if HAS_STATE:       active_clusters.append("state")
     active_clusters.append("security")              # always active (3 questions, low overhead)
     if HAS_DEPLOYMENT:  active_clusters.append("operations")
     if HAS_UI:          active_clusters.append("client")
   ```

   IF IS_TRIVIAL:
     Print: "⚡ Trivial plan detected — running fast-path review (single pass, 7 questions)"
     Run single Task(
       subagent_type = "general-purpose",
       model = "sonnet",
       prompt = """
         Read the plan at <plan_path>.
         Read ~/.claude/CLAUDE.md for standards context.

         Evaluate ONLY these 7 questions (definitions in <questions_path>):
           Q-G1 (Approach soundness — never N/A)
           Q-G2 (Standards compliance — never N/A)
           Q-G3 (Quality review step — never N/A)
           Q-G5 (Scope focus — never N/A)
           Q-NEW (Post-implementation workflow — never N/A)
           Q-C1 (Branching strategy — never N/A)
           Q-G11 (Existing code examined — N/A for doc-only plans)

         Output for each: PASS | NEEDS_UPDATE — [finding]
         If NEEDS_UPDATE: include [EDIT: instruction]
         Do not use Edit/Write/Bash tools — read-only.
       """
     )

     If all 7 PASS:
       Write gate marker: Bash "touch ~/.claude/.plan-reviewed"
       Output simplified scorecard:
         ## review-plan Scorecard (Fast Path)
         ⚡ IS_TRIVIAL: single .md file, additive change
         [Q-G1/G2/G3/G5/NEW/C1/G11 results — one line each]
         ### Rating: 🟢 READY
       Strip <!-- review-plan --> markers (Edit with replace_all=true → "")
       Call ExitPlanMode
       STOP — skip convergence loop entirely

     If any NEEDS_UPDATE:
       Apply edits inline (no team).
       Re-evaluate the same 7 questions once (same Task format above).
       If all 7 now PASS:
         Write gate marker, output simplified scorecard (Rating 🟢 READY), strip markers, ExitPlanMode. STOP.
       If still NEEDS_UPDATE:
         Print: "⚡ Fast-path could not resolve all issues — falling through to full review"
         IS_TRIVIAL = false  # force full convergence loop
         # Do not jump here — fall through to Steps 4–5 below (tracking init + TeamCreate) before entering convergence loop

   Print mode based on flags:
     IS_GAS + HAS_UI + HAS_STATE: "📋 Review mode: GAS + UI + State cluster (gas-eval + ui-evaluator + state cluster, [N] active)"
     IS_GAS + HAS_UI:     "📋 Review mode: GAS + UI (gas-eval + ui-evaluator, [N] active)"
     IS_GAS + HAS_STATE:  "📋 Review mode: GAS + State cluster (gas-eval + state cluster, [N] active)"
     IS_GAS only:         "📋 Review mode: GAS (all L2 clusters superseded by gas-eval)"
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
   memoized_clusters = set()       # clusters where all questions were PASS/N/A in their last pass
   memoized_since = {}             # pass_count when each cluster was memoized
   memoized_l1_questions = set()   # Q-G3, Q-NEW, Q-G11 once confirmed stable PASS or N/A (Q-G10, Q-G12 are not memoizable)
   spawned_evaluators = []         # names of all evaluator agents actually launched (for precise teardown)
   memo_file = "~/.claude/.review-plan-memo-" + timestamp + ".json"
   # memo_file: checkpoint written after each pass for context-compression resilience.
   # If state is lost mid-loop (long reviews): re-read memo_file at start of next pass.
   ```

5. **Team setup (always):**
   ```
   team_name = "review-plan-" + timestamp
   TeamCreate({team_name, description: "review-plan — parallel L1/cluster/ecosystem evaluators"})
   ```

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
  IF memo_file exists AND (memoized_clusters is empty AND memoized_l1_questions is empty AND pass_count > 1):
    Read memo_file → restore memoized_clusters, memoized_since, memoized_l1_questions,
                     prev_needs_update_set, pass1_needs_update_set, total_changes_all_passes, pass_count
    _recovered_this_pass = true
    Print: "⚠️ Context recovery: restored memoized state from checkpoint (pass [pass_count])"

  IF NOT _recovered_this_pass:
    pass_count += 1
  changes_this_pass = 0
  l1_changes = 0
  cluster_changes = {}            # maps cluster_name → change count this pass
  cluster_changes_total = 0
  gas_plan_changes = 0
  node_plan_changes = 0
  ui_plan_changes = 0

  Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count/5]: evaluating..."
  Print: "  Spawning: l1" + for each active cluster_name " · <cluster_name>" + (IS_GAS: " · gas-eval") + (IS_NODE: " · node-eval") + (HAS_UI: " · ui")

  [In a SINGLE message, spawn all evaluators in parallel:
   L1 always + one Task per active cluster + ecosystem if IS_GAS/IS_NODE + ui-evaluator if HAS_UI.
   Practical maximums: IS_GAS mode = L1 + state cluster + gas-eval + UI = 4.
   Non-GAS full-stack (all 7 clusters) = L1 + 7 + UI = 9.
   If Task concurrency limits are hit, batch clusters into 2 waves (Gate 1 clusters first).]
  [After spawning each evaluator, append its name to spawned_evaluators]

  --- L1 Evaluator ---
  Task(
    subagent_type = "general-purpose",
    model = "sonnet",
    team_name = <team_name>,
    name = "l1-evaluator-p" + pass_count,
    prompt = """
      You are evaluating a plan for general quality (Layer 1: 12 questions).

      Question definitions: Read <questions_path> (Layer 1 section)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ALL L1 questions: Q-G1, Q-G2, Q-G3, Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-NEW, Q-G10, Q-G11, Q-G12
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
        ... (all 12 questions including Q-NEW, Q-G10, Q-G11, Q-G12)

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
      # Carry forward prior pass PASS/N/A results for convergence tracking — do NOT spawn Task
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
      IS_GAS note: if you are the state-evaluator and IS_GAS=true above, evaluate Q-C26 only;
        Q-C13, Q-C18, Q-C19, Q-C24 are N/A-superseded (covered by gas-evaluator).

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
    --- UI Evaluator ---
    Task(
      subagent_type = "ui-designer",
      model = "sonnet",
      team_name = <team_name>,
      name = "ui-evaluator-p" + pass_count,
      prompt = """
        You are the ui-evaluator running inside review-plan's team. Evaluate the plan for
        UI specialization (Q-U1 through Q-U6).

        Question definitions: Read <questions_path>
          (Layer 3: UI Specialization section, Q-U1 through Q-U6).

        Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
        or <!-- node-plan -->.

        Output contract — send ONE message to team-lead:
          FINDINGS FROM ui-evaluator
          Q-U1: PASS | NEEDS_UPDATE | N/A — [finding]
          [EDIT: instruction if NEEDS_UPDATE]
          ... (all 6 questions)

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

  Print receipt for each evaluator:
    # Symbol key: ✗ = NEEDS_UPDATE, ✓ = PASS, — = N/A
    If l1 responded:   Print: "  ✅ l1      ✗[n] ✓[m] —[k]"
    If l1 incomplete:  Print: "  ⚠️ l1      timeout"
    For each cluster_name in active_clusters:
      If responded:   Print: "  ✅ <cluster_name>  ✗[n] ✓[m] —[k]"
      If memoized:    Print: "  ⏭️ <cluster_name>  ⏭️ p[memoized_since[cluster_name]]"
      If incomplete:  Print: "  ⚠️ <cluster_name>  timeout"
    For each skipped cluster (not in active_clusters):
      Print: "  ⏭️ <cluster_name>  skipped"
    If IS_GAS:
      If gas responded:   Print: "  ✅ gas-eval   ✗[n] ✓[m] —[k]"
      If gas incomplete:  Print: "  ⚠️ gas-eval   timeout"
    If IS_NODE:
      If node responded:  Print: "  ✅ node-eval  ✗[n] ✓[m] —[k]"
      If node incomplete: Print: "  ⚠️ node-eval  timeout"
    If HAS_UI:
      If ui responded:    Print: "  ✅ ui    ✗[n] ✓[m] —[k]"
      If ui incomplete:   Print: "  ⚠️ ui    timeout"

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
      1. Branching strategy (Q-C1): adding feature branch section
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
  # Git cluster: safe to memoize (additive-only — branch + commit steps cannot be removed by edits)
  IF "git" in active_clusters AND "git" NOT in memoized_clusters:
    IF git-evaluator-p<pass_count> returned 0 NEEDS_UPDATE (all PASS or N/A):
      memoized_clusters.add("git")
      memoized_since["git"] = pass_count
  # L1 Q-G3 and Q-NEW: safe to memoize individually (additive structural steps)
  IF l1_results["Q-G3"] in [PASS, N/A] AND "Q-G3" NOT in memoized_l1_questions:
    memoized_l1_questions.add("Q-G3")
  IF l1_results["Q-NEW"] in [PASS, N/A] AND "Q-NEW" NOT in memoized_l1_questions:
    memoized_l1_questions.add("Q-NEW")
  # L1 Q-G11: safe to memoize individually (cited file paths/function names don't regress during editing)
  IF l1_results["Q-G11"] in [PASS, N/A] AND "Q-G11" NOT in memoized_l1_questions:
    memoized_l1_questions.add("Q-G11")
  # Q-G10 (Assumption Exposure): NOT safe to memoize — assumptions evolve as plan is edited; must re-evaluate every pass
  # Q-G12 (Code consolidation): NOT safe to memoize — consolidation opportunities shift as plan scope evolves; must re-evaluate every pass
  # Q-C27, Q-C28, Q-C29: cluster-level memoization only (whole cluster, not individual questions)
  # Only Q-G3, Q-NEW, and Q-G11 are individually memoizable L1 questions

  current_needs_update_set = {set of Q/N numbers with NEEDS_UPDATE this pass across all evaluators}

  IF pass_count == 1:
    pass1_needs_update_set = current_needs_update_set  # snapshot for resolved_questions computation

  -- Checkpoint: persist memoized state for context-compression resilience --
  Write memo_file with JSON: {
    pass_count, memoized_clusters: [...memoized_clusters],
    memoized_since, memoized_l1_questions: [...memoized_l1_questions],
    prev_needs_update_set: [...current_needs_update_set],
    pass1_needs_update_set: [...pass1_needs_update_set],
    total_changes_all_passes
  }

  # Build breakdown suffix — only non-zero counts
  breakdown_parts = []
  if l1_changes > 0:        breakdown_parts.append(f"l1:{l1_changes}")
  for c in active_clusters:
    if cluster_changes.get(c, 0) > 0: breakdown_parts.append(f"{c}:{cluster_changes[c]}")
  if IS_GAS and gas_plan_changes > 0:   breakdown_parts.append(f"gas:{gas_plan_changes}")
  if IS_NODE and node_plan_changes > 0: breakdown_parts.append(f"node:{node_plan_changes}")
  if HAS_UI and ui_plan_changes > 0:    breakdown_parts.append(f"ui:{ui_plan_changes}")
  if not breakdown_parts:
    Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count/5] — 0 changes"
  else:
    Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count/5] — [changes_this_pass] changes  ([join(breakdown_parts, ' ')])"

  Gate2_stable = (prev_needs_update_set == current_needs_update_set)  # set equality: order-independent; compare BEFORE updating prev
  prev_needs_update_set = current_needs_update_set  # update AFTER Gate2_stable check; placed before CONVERGENCE CHECK so CONTINUE paths don't leave stale state
  -- CONVERGENCE CHECK (gate-aware) --
  IF IS_GAS:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G3, Q-G11,
                       Q1, Q2, Q13, Q15, Q18, Q42
                       (L2 cluster questions are N/A-superseded by gas-evaluator)
  ELSE IF IS_NODE:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G3, Q-G11, Q-C1, Q-C2, Q-C3,
                       N1
  ELSE:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G3, Q-G11, Q-C1, Q-C2, Q-C3

  IF pass_count >= 5:
    IF Gate1_unresolved > 0:
      AskUserQuestion to resolve Gate 1 issues, then BREAK
    ELSE:
      Print: "✅ Converged (max passes reached, Gate 1 clear)."
      BREAK → proceed to "After Review Completes"
  IF Gate1_unresolved > 0:
    Print using this exact format:
      "⚠️ Gate 1 still open — [Gate1_unresolved] blocking:"
      "  - [question short name] ([ID]): [first sentence of evaluator finding]"
      (one line per unresolved Gate 1 question)
      "Looping for pass [pass_count + 1]..."
    Example:
      ⚠️ Gate 1 still open — 2 blocking:
        - Branching strategy (Q-C1): no feature branch or merge-to-main step defined
        - Branching usage (Q-C2): steps don't reference a branch or include commits
      Looping for pass 2...
    CONTINUE (do NOT exit when Gate 1 is still open, even if changes_this_pass == 0)
  IF changes_this_pass == 0 OR Gate2_stable:
    elapsed = Math.round((Date.now() - timestamp) / 1000)
    IF pass_count == 1:
      Print: "✅ Converged — no issues found (pass 1, [elapsed]s)"
    ELSE:
      resolved_questions = pass1_needs_update_set - current_needs_update_set  # Q-IDs fixed since pass 1
      Print: "✅ Converged after [pass_count] passes ([elapsed]s | [total_changes_all_passes] total changes)"
      IF resolved_questions is non-empty:
        Print: "Resolved: [comma-separated resolved_questions sorted by ID]"
      Print: "Gate 1: ✅ Clean | Gate 2: ✅ [count of Gate2 PASS] PASS | Advisory: [count of Gate3 noted] noted"
    BREAK → proceed to "After Review Completes"
  -- END CHECK --

WHILE TRUE

-- Convergence complete. Proceed to "After Review Completes" below: Q-G9 → scorecard output → marker cleanup → teardown → ExitPlanMode. --
```

**Self-referential protection:** Mark all additions with `<!-- review-plan -->` suffix.
Do not re-evaluate content already marked `<!-- review-plan -->`, `<!-- gas-plan -->`, or
`<!-- node-plan -->`. Canonical policy: `shared/self-referential-protection.md` (sibling directory — derive: replace `review-plan/SKILL.md` with `shared/self-referential-protection.md` in this file's path).
If shared file is not found, use inline policy: mark all `<!-- skill-name -->` content as review metadata, not production code.

---

## Layer 1: General Quality

*12 questions (Q-G1 through Q-G8 + Q-NEW + Q-G10 + Q-G11 + Q-G12). Applies to every plan, every domain.*

For each question: evaluate → **PASS** / **NEEDS_UPDATE** / **N/A**
- PASS: criterion is met
- NEEDS_UPDATE: criterion is missing or incomplete → edit the plan, mark `<!-- review-plan -->`
- N/A: see N/A column

**Gate 1 — Blocking (weight 3):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G1 | Approach soundness | Right solution? Simpler alternatives considered? Not over/under-engineered? | never |
| Q-G2 | Standards compliance | Follows CLAUDE.md directives and MEMORY.md conventions? | never |
| Q-G3 | Quality review changes | Plan includes an explicit step to quality review all changes after implementation? Use `/review-fix` (preferred for all types — routes GAS files to GAS-specific reviewers automatically via Phase 1 file-type triage). `/gas-review` is also acceptable for GAS-only projects. Step must be named "quality review changes" or equivalent, placed after **all** code changes are applied, and not bundled with or before implementation steps. | never |
| Q-G11 | Existing code examined | Plan demonstrates the code being modified was read: specific file paths, function names, "currently does X" language. Flag: "update the module/handler/function" without specific names when modifying existing code. GAS: mcp_gas cat output cited or .gs function names referenced. | pure new-file work only |

**Gate 2 — Important (weight 2):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G4 | Unintended consequences | Side effects: broken workflows, behavior changes, regressions, security shifts? | trivial isolated change |
| Q-G5 | Scope focus | Plan stays on target, no scope creep? | never |
| Q-G8 | Task & team usage | Does the plan use the right level of agent coordination? Evaluate against the Q-G8 Decision Framework below. Flag plans that: run heavy/independent work inline when Task calls would provide context isolation; use sequential Task calls when parallel would work; or miss TeamCreate for multi-agent coordination of interdependent concerns. | plan involves only a single atomic change with no parallelizable steps and no heavy operations |
| Q-NEW | Post-implementation workflow | Does the plan include an explicit post-implementation section specifying: (1) run quality review changes (`/review-fix`) — loop until clean, (2) run build/compile if applicable, (3) run tests? Section must appear after all implementation steps and must not be bundled with or before them. If absent, output `[EDIT: inject ## Post-Implementation Workflow\n1. Run quality review changes (/review-fix) — loop until clean\n2. Run build if applicable (e.g. npm run build, tsc --noEmit)\n3. Run tests\n(Steps 4–5 of CLAUDE.md POST_IMPLEMENT — fail recovery and COMMIT_SUGGESTED deferral — apply at runtime regardless of plan text.)]` — team-lead applies. (Note to evaluators: you are read-only; emit the EDIT instruction, do not write directly.) Q-NEW supplements Q-G3 — does not duplicate it; Q-G3 checks for the quality review step specifically, Q-NEW checks for the full build + test workflow. | never |
| Q-G10 | Assumption exposure | Does the plan make high-risk implicit assumptions about environment state, external API availability, data pre-conditions, or third-party behavior? If so, are they stated explicitly? Flag: plan contains phrases like "should work", "assume X exists", or has unvalidated environmental dependencies that, if false, would cause silent failure or significant rework. Also flag open-question markers in implementation steps: "TBD", "will need to investigate", "will need to check", "if the API supports", "need to determine". These are unresolved decisions (not assumptions about known facts) — each must either become a numbered investigation step with a defined outcome, or be annotated as low-risk with a stated reason. (Evaluator note: "assume X" = known assumption, flag if high-risk; "TBD: X" = unknown decision, always flag regardless of risk.) | no external calls, no environment-specific dependencies, no pre-existing data assumptions; and no open-question markers (TBD / will need to check) in implementation steps |
| Q-G12 | Code consolidation | When the plan modifies or extends existing code — are there substantively overlapping implementations elsewhere in the codebase that should be consolidated or unified as part of this work? If a consolidation opportunity exists, the plan must either include consolidation steps or explicitly defer with a noted reason. Flag: plan touches module A which has near-identical logic to module B, but neither consolidation nor deferral is mentioned. | purely additive (new file / new feature) with no substantively similar existing implementations |

**Gate 3 — Advisory (weight 1):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G6 | Naming consistency | New identifiers follow codebase conventions? | no new names |
| Q-G7 | Documentation | MEMORY.md / CLAUDE.md / README affected by this change? | no behavior changes |

Count L1 edits → `l1_changes += count` (combined into `changes_this_pass` in Convergence Loop)

### Q-G8 Decision Framework: Task Calls & Agent Teams

Evaluate plans against three levels. Each level subsumes the previous.

**Level 1 — Task calls for context isolation**
Use Task (no team) when a step is independent but would pollute the main context:
- Broad codebase exploration or file reads (>5 files)
- Output-heavy operations (large grep results, full file dumps)
- Research/investigation that produces intermediate artifacts not needed in main context
- Long-running operations where progress doesn't need real-time visibility

Flag: plan runs heavy exploration or multi-file reads inline instead of via Task.
Note: context isolation is a valid reason to use Task even for sequential (non-parallel) work.

**Level 2 — Parallel Task calls for independent work**
Use multiple Task calls in a single message when steps are independent:
- Editing multiple independent files (each file in its own Task)
- Running tests while continuing other work (run_in_background: true)
- Exploration from multiple angles simultaneously (up to 3 Explore agents)
- Independent verification steps (lint + test + type-check in parallel)

Flag: sequential steps that could run in parallel; steps that wait for results
they don't depend on.

**Level 3 — Agent teams (TeamCreate/SendMessage) for coordinated work**
Use TeamCreate when multiple agents need to share findings or coordinate:
- Multi-concern implementations (e.g., backend agent + frontend agent, with
  team-lead merging results and resolving conflicts)
- Iterative convergence (multiple evaluators per pass, like review-plan itself)
- Parallel hypothesis testing (debugging with competing theories)
- Complex features spanning 5+ files with cross-cutting concerns

Flag: plans with 3+ agents working on related concerns without team coordination;
plans where Agent A's output feeds into Agent B's work but there's no team structure;
multi-file features where cross-file consistency needs a coordinator.

**When NOT to escalate:**
- Single file, simple change → no agents needed (inline)
- 2 independent files, no shared concerns → Level 2 (parallel Tasks, no team)
- Purely additive changes with no cross-file dependencies → Level 2

### Q-G9 Post-Convergence Organization Pass

*Runs once after the convergence loop exits. Not part of per-pass L1 evaluation.*
*L1 per-pass count stays at 12 (Q-G1 through Q-G8 + Q-NEW + Q-G10 + Q-G11 + Q-G12). Q-G9 is not included in*
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

*29 questions organized into 7 concern clusters. Cluster-level triage activates/deactivates
entire clusters based on Haiku pre-classification. Active clusters are listed in active_clusters
computed in Step 0.*

### Cluster 1: Git & Branching

*2 questions. Always active unless IS_GAS (fully superseded by gas-evaluator Q1, Q2).*
*IS_NODE: not superseded — evaluate normally.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C1 | 1 | Branching strategy | Branch named? Push-to-remote step included? Merge-to-main step included? | never |
| Q-C2 | 1 | Branching usage | Steps actually use feature branch + incremental commits? Each implementation step has an explicit `git add` + `git commit` checkpoint (not just described in prose)? Commit messages follow project conventions (e.g. conventional commits)? | never |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q1, Q2).
IS_NODE: not superseded — evaluate normally.

### Cluster 2: Impact & Architecture

*5 questions. Always active.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C3 | 1 | Impact analysis | Other callers/features affected? Cross-ref call sites checked? | fully isolated |
| Q-C8 | 2 | Interface consistency | Modified signatures consistent with siblings; callers updated? | no sig changes |
| Q-C12 | 3 | Duplication | No reimplementation of existing utilities? | no new functions |
| Q-C14 | 2 | Bolt-on vs integrated | New code extends existing modules; not isolated additions? | purely additive |
| Q-C27 | 2 | Backward compatibility | If the change modifies public-facing APIs, CLI interfaces, published package exports, event schemas, or config formats consumed externally — does the plan flag the breaking change and include a migration path or versioning step (e.g. v2 endpoint, semver bump, deprecation notice)? | internal-only change, no external API consumers |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q18, Q16, Q39, Q41); Q-C27 N/A (no external API consumers in GAS projects).
IS_NODE: not superseded — evaluate normally.

### Cluster 3: Testing & Plan Quality

*6 questions. Always active.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C4 | 2 | Tests updated | Interface/bug/new-function changes have matching test updates? | pure visual |
| Q-C5 | 2 | Incremental verification | Each step has a checkpoint (not all-testing-at-end)? | single atomic |
| Q-C9 | 2 | Step ordering | Explicit DAG; no refs to uncreated files, no deploy-before-push? | single step |
| Q-C10 | 2 | Empty code | No stubs/TODOs without full spec (phased OK if explicit)? | no placeholders |
| Q-C11 | 3 | Dead code | Old implementations marked for removal? | nothing replaced |
| Q-C29 | 2 | Test strategy defined upfront | Does the plan state, prior to or alongside implementation steps, what tests will verify the change is correct? Acceptable: naming specific test cases, stating what behaviors the test suite must cover, or explicitly confirming existing tests cover the new behavior without modification. Flag: plan implements non-trivial logic changes with no pre-stated acceptance criteria or test scope — leaving "does this work?" undefined until post-implementation. | cosmetic/doc-only change; single-line fix where correctness is self-evident; existing test suite explicitly confirmed as sufficient |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q11, Q12, Q17, Q19, Q20; Q-C29 N/A — test strategy covered by gas-evaluator Q11/Q12).
IS_NODE: not superseded — evaluate normally.

### Cluster 4: State & Data Integrity

*5 questions. Active when HAS_STATE=true. Skip entire cluster when HAS_STATE=false.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C13 | 2 | State edge cases | State-exists AND state-absent cases covered for persistent storage? | no storage |
| Q-C18 | 2 | Concurrency | Shared state locked; background tasks have concurrency plan? | read-only |
| Q-C19 | 2 | Idempotency | Operations safe to retry; data mutations deduped? | read-only |
| Q-C24 | 2 | Local↔remote sync | Sync strategy explicit for local→remote pushes? Stale reads avoided? | local-only |
| Q-C26 | 2 | Migration tasks | If the change alters data formats, config schemas, storage keys, API contracts, or persistent state structure from a previous design, does the plan include a one-time migration step? Flag: renamed properties/keys without migration, changed data shapes in storage without conversion, removed features without cleanup of stored state, schema changes without forward/backward migration. | no change to existing data formats or persistent state |

IS_GAS: **partially superseded** — Q-C13 (→Q40), Q-C18 (→Q21), Q-C19 (→Q24), Q-C24 (→Q3) are
  superseded. **Q-C26 has no gas equivalent — evaluate Q-C26 normally when HAS_STATE=true.**
  Spawn state cluster evaluator only if HAS_STATE=true, and only to evaluate Q-C26.
IS_NODE: **Q-C18 → N/A-superseded** (covered by node-evaluator N8).

### Cluster 5: Security & Reliability

*3 questions. Always active (low overhead).*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C15 | 2 | Input validation | Untrusted inputs sanitized at trust boundaries? | no untrusted input |
| Q-C16 | 2 | Error handling | Try/catch on external calls; actionable messages; fail-loud noted? | no new error paths |
| Q-C22 | 2 | Auth/permission additions | New scopes or permissions noted with user impact? | no new services |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q27, Q28, Q23).
IS_NODE: **Q-C16 → N/A-superseded** (covered by node-evaluator N6).

### Cluster 6: Operations & Deployment

*6 questions. Active when HAS_DEPLOYMENT=true. Skip entire cluster when HAS_DEPLOYMENT=false.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C6 | 2 | Deployment defined | Push steps, target env, verification specified? | local-only |
| Q-C7 | 2 | Rollback plan | Recovery path if deployment fails? | no deployment |
| Q-C20 | 3 | Logging | Informative but compact; no sensitive data? | no server changes |
| Q-C21 | 2 | Runtime constraints | Execution time/memory/platform limits addressed? Unbounded ops chunked? | bounded ops |
| Q-C23 | 3 | External rate limits | API quotas/throttling accounted for? | no new API calls |
| Q-C28 | 3 | Observability | For deployments to shared or production environments: does the plan reference or add monitoring/alerting coverage for the deployed change? Acceptable: referencing existing dashboards, adding a log-based alert, or noting that existing monitoring covers the new behavior. | local-only or dev-environment-only deployment |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q9, Q10, Q29, Q22, Q25); Q-C28 N/A (exec verification + Q6/Q12 cover GAS observability).
IS_NODE: **Q-C21 → N/A-superseded** (covered by node-evaluator N22).

### Cluster 7: Client & UI

*2 questions. Active when HAS_UI=true. Skip entire cluster when HAS_UI=false.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C17 | 2 | Event listener cleanup | Listeners removed to prevent accumulation/leaks? | no new listeners |
| Q-C25 | 3 | UI error boundary | Client-side error handler for silent failures? (window.onerror, try/catch around init) | no new client logic |

IS_GAS: **fully superseded when HAS_UI=true** (gas-evaluator Q32, Q33).
  When HAS_UI=false and IS_GAS=true, no cluster evaluator is spawned for this cluster.
IS_NODE: not superseded — evaluate normally.

Count cluster edits → `cluster_changes_total += count` (combined into `changes_this_pass` in Convergence Loop)

---

## Layer 3: UI Specialization

*6 questions (Q-U1 through Q-U6). Active when HAS_UI=true. Evaluated by ui-evaluator each pass.*

*For each question: evaluate → **PASS** / **NEEDS_UPDATE** / **N/A***

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-U1 | Component structure | Is the UI decomposed into logical, reusable components? Flag: monolithic HTML blobs, duplicated UI patterns, no separation between layout, state, and interaction. | no new UI components |
| Q-U2 | State management | Is UI state (loading, error, empty, data) handled explicitly? Loading spinner/skeleton, error display, empty-state copy all accounted for? | purely presentational changes with no dynamic state |
| Q-U3 | Interaction feedback | Do user actions (form submission, button click, async calls) provide immediate feedback? Disable-during-submission, progress indicator, success/error toast. | no interactive elements |
| Q-U4 | Responsive & layout constraints | Does the UI respect container constraints? GAS sidebars are 300px fixed; dialogs are 600px max. No overflow assumptions, no fixed pixel widths that break at sidebar dimensions. | no layout/sizing changes |
| Q-U5 | Accessibility basics | Interactive elements have accessible labels (`aria-label`, `for`/`id` pairs on form inputs). Tab order is logical. Keyboard navigation not broken. | no new interactive elements |
| Q-U6 | Visual consistency | New UI matches the existing design language (fonts, colors, spacing, button styles from the project's CSS baseline). No one-off inline styles that diverge from established patterns. | no visual changes or the project has no existing baseline |

Count ui-evaluator edits → `ui_plan_changes += count` (combined into `changes_this_pass` in Convergence Loop)

---

## Key Questions: Sub-Skill Invocations

### Q-GAS / Q-NODE: Ecosystem Specialization

In IS_GAS mode, gas-plan runs as part of the parallel evaluator team each pass (see Convergence
Loop above). The gas-evaluator Task is spawned with `mode=evaluate`, which means:
- gas-plan runs a SINGLE evaluation pass (no internal convergence loop)
- Returns all 43-question findings via SendMessage to team-lead
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence

In IS_NODE mode (mutually exclusive with IS_GAS), node-plan runs as part of the parallel
evaluator team each pass. The node-evaluator Task is spawned with `mode=evaluate`, which means:
- node-plan runs a SINGLE evaluation pass (no internal convergence loop)
- Returns all 36-question findings via SendMessage to team-lead
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence

When neither IS_GAS nor IS_NODE, no ecosystem evaluator is invoked.

**IS_GAS Cluster Suppression:**

| Cluster | Superseded? | Gas-evaluator equivalents |
|---------|-------------|--------------------------|
| Git (1) | **fully** | Q1, Q2 |
| Impact (2) | **fully** | Q18, Q16, Q39, Q41; Q-C27 N/A (no external API consumers in GAS projects) |
| Testing (3) | **fully** | Q11, Q12, Q17, Q19, Q20; Q-C29 N/A (gas-evaluator Q11/Q12 cover test strategy) |
| State (4) | **partially** — Q-C26 has no gas equivalent | Q40, Q21, Q24, Q3 (for Q-C13/18/19/24) |
| Security (5) | **fully** | Q27, Q28, Q23 |
| Operations (6) | **fully** | Q9, Q10, Q29, Q22, Q25; Q-C28 N/A (exec verification + Q6/Q12 cover GAS observability) |
| Client (7) | **fully** (only when HAS_UI) | Q32, Q33 |

Result: When IS_GAS=true, skip ALL cluster evaluators except State cluster (only for Q-C26,
only if HAS_STATE=true). Mark all other IS_GAS-superseded questions N/A-superseded in the scorecard.

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

### Q-UI: UI Specialization

In HAS_UI mode, ui-designer runs as part of the evaluator set each pass (see Convergence Loop
above). The ui-evaluator Task is spawned with `mode=evaluate`, which means:
- ui-designer runs a SINGLE evaluation pass (no internal convergence loop)
- Returns all 6-question findings (Q-U1 through Q-U6) via SendMessage to team-lead
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence

HAS_UI is orthogonal to IS_GAS/IS_NODE: a GAS project with a sidebar will have
IS_GAS=true, HAS_UI=true → spawns L1 + gas-evaluator + state cluster (if HAS_STATE) + ui-evaluator.

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
- `pass_count >= 5` AND `Gate1_unresolved > 0` → AskUserQuestion, then BREAK
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
## review-plan Scorecard — Pass [N]

### Rating
[🟢 READY / 🟡 SOLID / 🟠 GAPS / 🔴 REWORK]  — [criterion phrase]

| Gate | Status | Open |
|------|--------|------|
| 🔴 Gate 1 — Blocking  | ✅ PASS / ❌ n open | [n] |
| 🟡 Gate 2 — Important | ✅ PASS / ⚠️ n open | [n] |
| 💡 Gate 3 — Advisory  | [n] noted           | —  |

---

### 🔴 Gate 1 — Blocking
[✅ PASS (M applicable)] or [❌ N NEEDS_UPDATE remaining (M applicable)]
[list only PASS and NEEDS_UPDATE questions — omit N/A items]
Example line: Branching strategy (Q-C1): ✅ PASS
Example line: Impact analysis (Q-C3): ❌ NEEDS_UPDATE

### 🟡 Gate 2 — Important
[✅ PASS (M applicable)] or [❌ N NEEDS_UPDATE remaining (M applicable)]
[list only PASS and NEEDS_UPDATE questions — omit N/A items]

### 💡 Gate 3 — Advisory
[N noted (M applicable)] or [0 noted (M applicable)]
[list only flagged advisory questions — omit N/A and non-flagged PASS]

[Only render the following specialization sections when the corresponding flag is TRUE.
 Omit the section entirely when the flag is false — do NOT write "NOT INVOKED" placeholders.]

### GAS Specialization (gas-plan)  ← render only when IS_GAS=true
[PASS — converged after N passes (46 questions, K triaged N/A)]
OR
[N NEEDS_UPDATE remaining (46 questions, K triaged N/A)]

### Node Specialization (node-plan)  ← render only when IS_NODE=true
[PASS — converged after N passes (36 questions, K triaged N/A)]
OR
[N NEEDS_UPDATE remaining (36 questions, K triaged N/A)]

### UI Specialization (ui-designer)  ← render only when HAS_UI=true
[PASS — converged after N passes (6 questions, K triaged N/A)]
OR
[N NEEDS_UPDATE remaining]
[list only PASS and NEEDS_UPDATE UI questions — omit N/A items]
Example line: Component structure (Q-U1): ✅ PASS

### Organization Quality (Q-G9)  ← render only when plan has ≥ 3 implementation steps
[✅ PASS — no structural issues (5 sub-questions)]
OR
[N sub-questions flagged:]
[list only flagged sub-questions — omit PASS items]
Example line: Q-G9b (Concurrency labeling): ❌ NEEDS_UPDATE — parallel steps not labeled

### Triaged N/A  ← omit this section entirely if total N/A count across all gates == 0
[K questions skipped — not applicable to this plan:]
- [Question name] ([Q-ID]): [one-phrase reason, e.g. "fully isolated change", "HAS_STATE=false"]
[list all N/A questions across Gate 1, Gate 2, Gate 3; omit section when K == 0]
[Note: Q-G9 is skipped at the section level when plan has < 3 steps — do not list it here as individual N/A items]

```

---

## After Review Completes

After the convergence loop exits (scorecard not yet printed):

1. **REWORK gate** (handled inside the convergence loop — not a post-loop step): Gate 1 is
   resolved by the `pass_count >= 5` branch inside the loop. By the time the loop exits, Gate 1
   is either clean or the user has been asked and responded (with edits applied or override noted).
   Do not re-run the REWORK check here — it was already handled inside the loop.

2. **Q-G9 organization pass** (post-convergence structural check, inline):
   N/A if plan has fewer than 3 implementation steps — skip this step entirely.
   Evaluate Q-G9 inline as specified in the "Q-G9 Post-Convergence Organization Pass"
   subsection in Layer 1 (no Task spawn — team-lead evaluates directly). Apply any NEEDS_UPDATE
   edits immediately. Q-G9 results will be included in the scorecard output in step 3.

3. **Output the final scorecard** (incorporating Q-G9 results from step 2). See "Output: Unified
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
   touch ~/.claude/.plan-reviewed
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
     Handled in step 1 above (AskUserQuestion before reaching this point)
   ```
   This is a single approval point: the user sees remaining issues in printed text, then
   ExitPlanMode is the one decision point. No double-approval friction.

8. **Call ExitPlanMode immediately.** Do not pause, do not ask the user "should I present the plan?"

The PreToolUse hook on ExitPlanMode checks for this marker and consumes it on success.
