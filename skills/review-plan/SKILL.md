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
model: opus
allowed-tools: all
---

# Universal Plan Review: Convergence Loop

You apply a 3-layer quality review to any implementation plan: general quality, code change
quality, and conditional GAS specialization via gas-plan when GAS patterns are detected.
You iterate until all layers and sub-skills report zero changes in the same pass.

**You MUST loop. NEVER output the final scorecard until exit criteria are met.**

---

## Step 0: Locate Plan and Load Context

1. **Find the plan file:**
   - If an argument was passed (file path), use it directly
   - Otherwise: `Glob("~/.claude/plans/*.md")` → pick the most recently modified
   - Read the plan file fully

2. **Load standards context:**
   - Read `~/.claude/CLAUDE.md` for directives and conventions
   - Read `~/.claude/projects/-Users-jameswiese/memory/MEMORY.md` for patterns

3. **Set context flags** (Haiku classification):
   Task(
     subagent_type = "general-purpose",
     model = "haiku",
     prompt = """
       Read the plan at <plan_path>.

       Classify based on what files the plan CREATES or MODIFIES — not what it
       mentions in descriptions, evaluator prompts, or documentation.

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

       Key: "modifies code in that domain" vs "mentions that domain in prose."
       Example: a plan editing .md files that runs npm test → IS_NODE=false.

       Output ONLY (no explanation):
       IS_GAS=true|false
       IS_NODE=true|false
       HAS_UI=true|false
       HAS_DEPLOYMENT=true|false
       HAS_STATE=true|false
     """
   )
   Parse output → set IS_GAS, IS_NODE, HAS_UI, HAS_DEPLOYMENT, HAS_STATE
   IF Haiku timeout or malformed output → all flags false
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

   Print mode based on flags:
     IS_GAS + HAS_STATE:  "📋 Review mode: GAS + State cluster (gas-evaluator + state cluster, [N] active)"
     IS_GAS only:         "📋 Review mode: GAS (all L2 clusters superseded by gas-evaluator)"
     IS_NODE only:        "📋 Review mode: Node.js ([N] clusters: [names] + node-evaluator)"
     IS_NODE + HAS_UI:    "📋 Review mode: Node.js + UI ([N] clusters: [names] + node-evaluator + ui-evaluator)"
     HAS_UI only:         "📋 Review mode: Standard + UI ([N] clusters: [names] + ui-evaluator)"
     All false:           "📋 Review mode: Standard ([N] clusters: [names])"
   (Raw flag debug line "IS_GAS=[v] IS_NODE=[v] HAS_UI=[v] HAS_DEPLOYMENT=[v] HAS_STATE=[v]"
   is printed only when pass_count >= 3, as a diagnostic aid for slow-convergence reviews.)
   Flags are set once and do NOT change between passes (evaluator set changes mid-loop
   would invalidate convergence state tracking).
   [future: IS_SEC, HAS_API]
   HAS_UI is active — triggers client cluster and/or ui-evaluator in the convergence loop

4. **Initialize tracking:**
   ```
   pass_count = 0
   timestamp = Date.now()
   prev_needs_update_set = {}
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
     Do NOT leave orphaned team processes.
   ```

---

## Convergence Loop

```
DO:
  -- DO NOT call TeamCreate here. Team was created once in Step 0 and persists across all passes. --

  pass_count += 1
  changes_this_pass = 0
  l1_changes = 0
  cluster_changes_total = 0
  gas_plan_changes = 0
  node_plan_changes = 0
  ui_plan_changes = 0

  Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count/5]: evaluating..."

  [In a SINGLE message, spawn all evaluators in parallel:
   L1 always + one Task per active cluster + ecosystem if IS_GAS/IS_NODE + ui-evaluator if HAS_UI.
   Practical maximums: IS_GAS mode = L1 + state cluster + gas-evaluator + UI = 4.
   Non-GAS full-stack (all 7 clusters) = L1 + 7 + UI = 9.
   If Task concurrency limits are hit, batch clusters into 2 waves (Gate 1 clusters first).]

  --- L1 Evaluator ---
  Task(
    subagent_type = "general-purpose",
    model = "opus",
    team_name = <team_name>,
    name = "l1-evaluator",
    prompt = """
      You are evaluating a plan for general quality (Layer 1: 9 questions).

      Plan file: <plan_path> — read it with the Read tool
      Question definitions: Read ~/.claude/skills/review-plan/SKILL.md (Layer 1 section)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ALL L1 questions: Q-G1, Q-G2, Q-G3, Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-NEW
      Apply triage (mark N/A per the N/A column).
      Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
      or <!-- node-plan -->.

      Output contract — send ONE message to team-lead:
        FINDINGS FROM l1-evaluator
        Q-G1: PASS | NEEDS_UPDATE | N/A — [finding]
        [EDIT: instruction if NEEDS_UPDATE]
        Q-G2: ...
        ... (all 9 questions including Q-NEW)

      Constraints:
      - Do NOT use Edit, Write, or Bash tools — read-only
      - Do NOT call ExitPlanMode or touch marker files
      - Send exactly ONE message to team-lead
    """
  )

  --- Cluster Evaluators (one Task per active cluster) ---
  For each cluster_name in active_clusters:
  Task(
    subagent_type = "general-purpose",
    model = "opus",
    team_name = <team_name>,
    name = "<cluster_name>-evaluator",
    prompt = """
      You are evaluating a plan for <cluster_description> (<N> questions in this cluster).

      Plan file: <plan_path> — read it with the Read tool.
      Question definitions: Read ~/.claude/skills/review-plan/SKILL.md,
        section "### Cluster <N>: <cluster_name>".

      Evaluate all questions in this cluster. Apply N/A per the N/A column in that section.
      Skip content marked <!-- review-plan --> or <!-- gas-plan --> or <!-- node-plan -->.

      IS_NODE suppression (apply if IS_NODE=true):
        Q-C16 (Security cluster, →N6), Q-C18 (State cluster, →N8), Q-C21 (Operations cluster, →N22)
        are N/A-superseded when IS_NODE=true.
      IS_GAS note: if you are the state-evaluator in IS_GAS mode, evaluate Q-C26 only;
        Q-C13, Q-C18, Q-C19, Q-C24 are N/A-superseded (covered by gas-evaluator).

      Output contract — send ONE message to team-lead:
        FINDINGS FROM <cluster_name>-evaluator
        <Q-ID>: PASS | NEEDS_UPDATE | N/A — [finding]
        [EDIT: instruction if NEEDS_UPDATE]
        ... (all questions in this cluster)

      Constraints:
      - Do NOT use Edit, Write, or Bash tools — read-only
      - Do NOT call ExitPlanMode or touch marker files
      - Send exactly ONE message to team-lead
    """
  )

  IF IS_GAS:
    --- GAS Evaluator ---
    Task(
      subagent_type = "gas-plan",
      team_name = <team_name>,
      name = "gas-evaluator",
      prompt = """
        Review plan at <plan_path>. mode=evaluate.

        MODE=evaluate (MANDATORY). This string controls gas-plan's behavior. Its absence
        triggers standalone mode and creates a circular ExitPlanMode conflict. Do not remove
        or alter this string.

        You are the gas-evaluator running inside review-plan's team. Evaluate the plan for GAS
        specialization (all 43 GAS questions, both perspectives). Return findings via SendMessage
        to team-lead.

        Do NOT edit the plan. Do NOT touch .plan-reviewed. Do NOT call ExitPlanMode.
        Do NOT call TeamCreate — you are already inside a team.
      """
    )
  ELSE IF IS_NODE:
    --- Node Evaluator ---
    Task(
      subagent_type = "node-plan",
      team_name = <team_name>,
      name = "node-evaluator",
      prompt = """
        Review plan at <plan_path>. mode=evaluate.

        MODE=evaluate (MANDATORY). This string controls node-plan's behavior. Its absence
        triggers standalone mode and creates a circular ExitPlanMode conflict. Do not remove
        or alter this string.

        You are the node-evaluator running inside review-plan's team. Evaluate the plan for
        Node.js/TypeScript specialization (all 35 Node questions, both perspectives). Return
        findings via SendMessage to team-lead.

        Do NOT edit the plan. Do NOT touch .plan-reviewed. Do NOT call ExitPlanMode.
        Do NOT call TeamCreate — you are already inside a team.
      """
    )

  IF HAS_UI:
    --- UI Evaluator ---
    Task(
      subagent_type = "ui-designer",
      model = "opus",
      team_name = <team_name>,
      name = "ui-evaluator",
      prompt = """
        Review plan at <plan_path>. mode=evaluate.

        You are the ui-evaluator running inside review-plan's team. Evaluate the plan for
        UI specialization (Q-U1 through Q-U6). Return findings via SendMessage to team-lead.

        Do NOT edit the plan. Do NOT touch .plan-reviewed. Do NOT call ExitPlanMode.
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
    Print: "  ✅ l1-evaluator — [n] NEEDS_UPDATE"
    For each cluster_name in active_clusters:
      If responded:   Print: "  ✅ <cluster_name>-evaluator — [n] NEEDS_UPDATE"
      If incomplete:  Print: "  ⚠️ <cluster_name>-evaluator — INCOMPLETE (timeout)"
    For each skipped cluster (not in active_clusters):
      Print: "  ⏭️ <cluster_name>-evaluator — SKIPPED (<reason>)"
      Reasons: HAS_STATE=false | HAS_DEPLOYMENT=false | HAS_UI=false | IS_GAS superseded
    Print: "  ✅ gas-evaluator — [n] NEEDS_UPDATE"   (if IS_GAS)
    Print: "  ✅ node-evaluator — [n] NEEDS_UPDATE"  (if IS_NODE)
    Print: "  ✅ ui-evaluator — [n] NEEDS_UPDATE"    (if HAS_UI)
    Print: "  ⚠️ [name] — INCOMPLETE (timeout)"      (if incomplete)

  -- Merge & Apply --
  COLLECT all NEEDS_UPDATE findings from L1, cluster evaluators, ecosystem evaluator, and ui-evaluator
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
    Each Edit call = 1 change. Do NOT count findings you only described in text.
  CONSOLIDATE: merge overlapping findings, remove duplicate annotations
    Keep-exemption: content annotated <!-- keep: [reason] --> is EXEMPT from consolidation removal.
    "Key flow" = any implementation step, ordering dependency, error path, rollback step, or
    verification checkpoint. Prose trimming is OK. Removing or merging steps is NOT.
  REGRESSION CHECK: before RE-READ, verify no key flow, corner case, or condition was
    removed during this pass — restore any dropped logic and annotate <!-- keep: [reason] -->
  RE-READ the full consolidated plan

  l1_changes = count of L1 NEEDS_UPDATE edits applied
  cluster_changes_total = sum of all cluster evaluator NEEDS_UPDATE edits applied
  IF IS_GAS: gas_plan_changes = count of gas-evaluator NEEDS_UPDATE edits applied
  IF IS_NODE: node_plan_changes = count of node-evaluator NEEDS_UPDATE edits applied
  IF HAS_UI: ui_plan_changes = count of ui-evaluator NEEDS_UPDATE edits applied
  changes_this_pass = l1_changes + cluster_changes_total + gas_plan_changes + node_plan_changes + ui_plan_changes

  current_needs_update_set = {set of Q/N numbers with NEEDS_UPDATE this pass across all evaluators}

  Print: "Pass [▓ × pass_count + ░ × (5-pass_count)] [pass_count/5] — [changes_this_pass] changes  (L1: [l1_changes], clusters: [cluster_changes_total], gas-plan: [gas_plan_changes] | node-plan: [node_plan_changes] | ui-plan: [ui_plan_changes])"

  -- CONVERGENCE CHECK (gate-aware) --
  IF IS_GAS:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G3,
                       Q1, Q2, Q13, Q15, Q18, Q42
                       (L2 cluster questions are N/A-superseded by gas-evaluator)
  ELSE IF IS_NODE:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G3, Q-C1, Q-C2, Q-C3,
                       N1
  ELSE:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G3, Q-C1, Q-C2, Q-C3
  Gate2_stable = (prev_needs_update_set == current_needs_update_set)  # set equality: order-independent

  IF pass_count >= 5:
    IF Gate1_unresolved > 0:
      AskUserQuestion to resolve Gate 1 issues, then BREAK
    ELSE:
      Print: "✅ Converged (max passes reached, Gate 1 clear)."
      BREAK → proceed to OUTPUT final scorecard
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
    Print: "✅ Converged — no changes this pass ([elapsed]s total)"
    BREAK → proceed to OUTPUT final scorecard

  prev_needs_update_set = current_needs_update_set
  -- END CHECK --

WHILE TRUE

OUTPUT final scorecard
(Teardown and ExitPlanMode handled in "After Review Completes" section below.)
```

**Self-referential protection:** Mark all additions with `<!-- review-plan -->` suffix.
Do NOT re-evaluate content already marked `<!-- review-plan -->`, `<!-- gas-plan -->`, or
`<!-- node-plan -->`. Canonical policy: `~/.claude/skills/shared/self-referential-protection.md`.
If shared file is not found, use inline policy: mark all `<!-- skill-name -->` content as review metadata, not production code.

---

## Layer 1: General Quality

*9 questions (Q-G1 through Q-G8 + Q-NEW). Applies to every plan, every domain.*

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

**Gate 2 — Important (weight 2):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G4 | Unintended consequences | Side effects: broken workflows, behavior changes, regressions, security shifts? | trivial isolated change |
| Q-G5 | Scope focus | Plan stays on target, no scope creep? | never |
| Q-G8 | Task & team usage | Does the plan use the right level of agent coordination? Evaluate against the Q-G8 Decision Framework below. Flag plans that: run heavy/independent work inline when Task calls would provide context isolation; use sequential Task calls when parallel would work; or miss TeamCreate for multi-agent coordination of interdependent concerns. | plan involves only a single atomic change with no parallelizable steps and no heavy operations |
| Q-NEW | Post-implementation workflow | Does the plan include an explicit post-implementation section specifying: (1) run quality review changes (`/review-fix`) — loop until clean, (2) run build/compile if applicable, (3) run tests? Section must appear after all implementation steps and must not be bundled with or before them. If absent, output `[EDIT: inject ## Post-Implementation Workflow\n1. Run quality review changes (/review-fix) — loop until clean\n2. Run build if applicable (e.g. npm run build, tsc --noEmit)\n3. Run tests\n(Steps 4–5 of CLAUDE.md POST_IMPLEMENT — fail recovery and COMMIT_SUGGESTED deferral — apply at runtime regardless of plan text.)]` — team-lead applies. (Note to evaluators: you are read-only; emit the EDIT instruction, do not write directly.) Q-NEW supplements Q-G3 — does not duplicate it; Q-G3 checks for the quality review step specifically, Q-NEW checks for the full build + test workflow. | never |

**Gate 3 — Advisory (weight 1):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G6 | Naming consistency | New identifiers follow codebase conventions? | no new names |
| Q-G7 | Documentation | MEMORY.md / CLAUDE.md / README affected by this change? | no behavior changes |

Count L1 edits → `l1_changes += count`; `changes_this_pass += l1_changes`

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
*L1 per-pass count stays at 9 (Q-G1 through Q-G8 + Q-NEW). Q-G9 is not included in*
*convergence loop scoring. N/A if plan has fewer than 3 implementation steps.*

After convergence exits (and after step 1 REWORK gate if applicable), spawn:
Task(
  subagent_type = "general-purpose",
  model = "opus",
  team_name = <team_name>,
  name = "q-g9-evaluator",
  prompt = """
    Read the plan at <plan_path>.

    Evaluate 5 structural presentation questions (Q-G9a through Q-G9e).
    This is a post-convergence organization check — focus on how well the plan
    reads as execution instructions, not on content correctness.

    Q-G9a: Sequential clarity — are implementation steps numbered and unambiguous in order?
    Q-G9b: Concurrency labeling — are parallel steps explicitly marked (e.g. "[parallel]",
           "In a SINGLE message", "spawn in parallel")?
    Q-G9c: Scannability — does the plan use headers and bullets (no prose walls >5 sentences)?
    Q-G9d: Conditional structure — are IF/ELSE branches visually distinct from sequential steps?
    Q-G9e: Checkpoint visibility — are commit/verification checkpoints clearly visible
           (not buried mid-paragraph)?

    Output contract — send ONE message to team-lead:
      FINDINGS FROM q-g9-evaluator
      Q-G9a: PASS | NEEDS_UPDATE — [finding]
      [EDIT: instruction if NEEDS_UPDATE]
      Q-G9b: PASS | NEEDS_UPDATE — [finding]
      [EDIT: instruction if NEEDS_UPDATE]
      ... (all 5 sub-questions)

    Constraints:
    - Do NOT use Edit, Write, or Bash tools — read-only
    - Do NOT call ExitPlanMode or touch marker files
    - Send exactly ONE message to team-lead
  """
)
Apply any NEEDS_UPDATE instructions from q-g9-evaluator. Mark changes <!-- review-plan -->.
Add Q-G9 results to the scorecard (see Organization Quality section below).

---

## Layer 2: Code Change Quality

*26 questions organized into 7 concern clusters. Cluster-level triage activates/deactivates
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

*4 questions. Always active.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C3 | 1 | Impact analysis | Other callers/features affected? Cross-ref call sites checked? | fully isolated |
| Q-C8 | 2 | Interface consistency | Modified signatures consistent with siblings; callers updated? | no sig changes |
| Q-C12 | 3 | Duplication | No reimplementation of existing utilities? | no new functions |
| Q-C14 | 2 | Bolt-on vs integrated | New code extends existing modules; not isolated additions? | purely additive |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q18, Q16, Q39, Q41).
IS_NODE: not superseded — evaluate normally.

### Cluster 3: Testing & Plan Quality

*5 questions. Always active.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C4 | 2 | Tests updated | Interface/bug/new-function changes have matching test updates? | pure visual |
| Q-C5 | 2 | Incremental verification | Each step has a checkpoint (not all-testing-at-end)? | single atomic |
| Q-C9 | 2 | Step ordering | Explicit DAG; no refs to uncreated files, no deploy-before-push? | single step |
| Q-C10 | 2 | Empty code | No stubs/TODOs without full spec (phased OK if explicit)? | no placeholders |
| Q-C11 | 3 | Dead code | Old implementations marked for removal? | nothing replaced |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q11, Q12, Q17, Q19, Q20).
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

*5 questions. Active when HAS_DEPLOYMENT=true. Skip entire cluster when HAS_DEPLOYMENT=false.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C6 | 2 | Deployment defined | Push steps, target env, verification specified? | local-only |
| Q-C7 | 2 | Rollback plan | Recovery path if deployment fails? | no deployment |
| Q-C20 | 3 | Logging | Informative but compact; no sensitive data? | no server changes |
| Q-C21 | 2 | Runtime constraints | Execution time/memory/platform limits addressed? Unbounded ops chunked? | bounded ops |
| Q-C23 | 3 | External rate limits | API quotas/throttling accounted for? | no new API calls |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q9, Q10, Q29, Q22, Q25).
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

Count cluster edits → `cluster_changes_total += count`; `changes_this_pass += cluster_changes_total`

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
- Returns all 35-question findings via SendMessage to team-lead
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence

When neither IS_GAS nor IS_NODE, no ecosystem evaluator is invoked.

**IS_GAS Cluster Suppression:**

| Cluster | Superseded? | Gas-evaluator equivalents |
|---------|-------------|--------------------------|
| Git (1) | **fully** | Q1, Q2 |
| Impact (2) | **fully** | Q18, Q16, Q39, Q41 |
| Testing (3) | **fully** | Q11, Q12, Q17, Q19, Q20 |
| State (4) | **partially** — Q-C26 has no gas equivalent | Q40, Q21, Q24, Q3 (for Q-C13/18/19/24) |
| Security (5) | **fully** | Q27, Q28, Q23 |
| Operations (6) | **fully** | Q9, Q10, Q29, Q22, Q25 |
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

Full overlap table: `~/.claude/skills/shared/question-cross-reference.md`

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

### 🔴 Gate 1 — Blocking
[✅ PASS (M applicable, K triaged N/A)] or [❌ N NEEDS_UPDATE remaining (M applicable, K triaged N/A)]
[list only PASS and NEEDS_UPDATE questions — omit N/A items]
Example line: Branching strategy (Q-C1): ✅ PASS
Example line: Impact analysis (Q-C3): ❌ NEEDS_UPDATE

### 🟡 Gate 2 — Important
[✅ PASS (M applicable, K triaged N/A)] or [❌ N NEEDS_UPDATE remaining (M applicable, K triaged N/A)]
[list only PASS and NEEDS_UPDATE questions — omit N/A items]

### 💡 Gate 3 — Advisory
[N noted (M applicable, K flagged)] or [0 noted (M applicable, 0 flagged)]
[list only flagged advisory questions — omit N/A and non-flagged PASS]

[Only render the following specialization sections when the corresponding flag is TRUE.
 Omit the section entirely when the flag is false — do NOT write "NOT INVOKED" placeholders.]

### GAS Specialization (gas-plan)  ← render only when IS_GAS=true
[PASS — converged after N passes (43 questions, K triaged N/A)]
OR
[N NEEDS_UPDATE remaining (43 questions, K triaged N/A)]

### Node Specialization (node-plan)  ← render only when IS_NODE=true
[PASS — converged after N passes (35 questions, K triaged N/A)]
OR
[N NEEDS_UPDATE remaining (35 questions, K triaged N/A)]

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

### Rating
🟢 READY   — Gate 1 + Gate 2 all PASS
🟡 SOLID   — Gate 1 PASS, ≤ 2 Gate 2 NEEDS_UPDATE
🟠 GAPS    — Gate 1 PASS, > 2 Gate 2 NEEDS_UPDATE
🔴 REWORK  — any Gate 1 NEEDS_UPDATE

```

---

## After Review Completes

After outputting the Final Scorecard:

1. **REWORK gate:** If Rating is REWORK (any Gate 1 NEEDS_UPDATE remaining after convergence):
   AskUserQuestion with the Gate 1 issues listed. User must explicitly resolve each issue or
   override before proceeding. Do NOT call ExitPlanMode or write the marker until the user
   responds.
   If user resolves: apply edits and re-evaluate Gate 1 questions only (cluster and ecosystem
     evaluators do not re-run in this step). Recompute Rating using the standard thresholds.
     If new Rating is READY, SOLID, or GAPS: proceed to step 2 (step 6 will apply for SOLID/GAPS).
     If Gate 1 is still not resolved: return to AskUserQuestion.
   If user overrides: note override in scorecard and proceed.

2. **Cleanup plan markers:** Use the Edit tool with `replace_all=true` on the plan file to
   strip all self-referential markers that served their purpose during the convergence loop:
   - `" <!-- review-plan -->"` → `""` (remove)
   - `" <!-- gas-plan -->"` → `""` (remove)
   - `" <!-- node-plan -->"` → `""` (remove)
   This delivers a clean plan file to the user for implementation (no stray HTML comments).
   Only strip the markers — do NOT remove the content they annotated.

3. **Q-G9 organization pass** (post-convergence structural check):
   N/A if plan has fewer than 3 implementation steps — skip this step entirely.
   Spawn q-g9-evaluator Task as specified in the "Q-G9 Post-Convergence Organization Pass"
   subsection in Layer 1. Wait for response. Apply any NEEDS_UPDATE instructions.
   Add Q-G9 results to the scorecard under "Organization Quality (Q-G9)".

4. Use the Bash tool to run: `touch ~/.claude/.plan-reviewed` — writes the gate marker so ExitPlanMode will pass

5. **Team teardown (always):** Send shutdown_request to all evaluator agents:
   - Always: `l1-evaluator`
   - Each active cluster: `<cluster_name>-evaluator` for each cluster in active_clusters
   - If IS_GAS: `gas-evaluator`
   - If IS_NODE: `node-evaluator`
   - If HAS_UI: `ui-evaluator`
   Then call TeamDelete. (Teardown must complete before ExitPlanMode —
   the session context needed for TeamDelete is not available after exiting plan mode.)

6. **Remaining issues summary (non-READY ratings):**
   ```
   IF Rating == READY:
     Proceed to ExitPlanMode immediately (plan is fully clean)
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

7. **Call ExitPlanMode immediately.** Do not pause, do not ask the user "should I present the plan?"

The PreToolUse hook on ExitPlanMode checks for this marker and consumes it on success.
