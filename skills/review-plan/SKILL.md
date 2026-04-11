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
allowed-tools: all
---

## Role & Authority

1. **Role:** Team-lead orchestrator — you coordinate evaluators and apply edits to the plan. You do NOT independently evaluate plan quality; that is the evaluators' job.
2. **Authority:** You may call Edit, Write, Bash, Read, and AskUserQuestion tools. You may spawn Task agents. After each review pass, use AskUserQuestion to let the user continue editing or confirm exit. Only call ExitPlanMode when the user explicitly confirms they are done (see step 8).
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
   - If no plan file found (glob returns empty AND no file path argument provided):
     Print: "❌ No plan file found — nothing to review."
     Print: "  Pass a file path as argument, or run from a directory with ~/.claude/plans/*.md"
     STOP — do not proceed
   - Read the plan file fully
   - **Escape hatch:** To bypass review-plan and exit plan mode directly, the user can run:
     `Bash "touch /tmp/.review-ready-$(basename $(ls -t ~/.claude/plans/*.md | head -1) .md)"`
     — this creates the gate file for the current plan, allowing ExitPlanMode to proceed without review.

2. **Load standards context:**
   - Read `~/.claude/CLAUDE.md` for directives and conventions
   - Find and read the project memory file:
     `Glob("~/.claude/projects/*/memory/MEMORY.md")` → read most recently modified
     (skip gracefully if none found)
   - Path variables — derive now and cache as named variables; used in all evaluator spawning (fast-path and loop):
     - `plan_path` = absolute path of the plan file found in step 1
     - `plan_slug` = filename stem of plan_path (no extension); scopes memo file
       ```
       plan_slug = basename(plan_path, ".md")
       # Example: /Users/jameswiese/.claude/plans/snug-jumping-yao.md → snug-jumping-yao
       # Used to scope memo file to this specific plan invocation.
       ```
     - `questions_path` = `~/.claude/skills/review-plan/QUESTIONS.md`
     - `questions_l3_path` = `~/.claude/skills/review-plan/QUESTIONS-L3.md`
     - `gas_eval_path`  = `~/.claude/skills/gas-plan/EVALUATE.md`
     - `node_eval_path` = `~/.claude/skills/node-plan/EVALUATE.md`
       (`~` makes all four portable across users — no hardcoded username.
       Update here if the install base changes; all evaluator spawns below use these variables.)

3. **Set context flags** (Sonnet classification — Haiku was tested but failed on HAS_EXISTING_INFRA discrimination, 2 of 3 wrong in 2026-04-10 spike):
   Task(
     subagent_type = "general-purpose",
     # No model override: use default (Sonnet). Phase 2 spike of
     # skills/review-plan/question-effectiveness-report.md recommendations
     # showed Haiku inverting the HAS_EXISTING_INFRA concept — Sonnet got 3/3 right.
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

       ## Step 1: Domain flags

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

       ## Step 1b: Conditional question gates (per question-effectiveness-report.md 2026-04-10)

       These flags gate specific L2 impact-cluster questions that only apply to plans
       with matching patterns. Evaluate based on what the plan actually does, not prose.

       HAS_EXISTING_INFRA: true if the plan creates a NEW module/file/system/endpoint
               where existing code already serves an overlapping concern, AND the plan
               does NOT evaluate extending/replacing the existing code.
               Positive indicators:
                 - Plan creates src/realtime/ when email notification system already exists for user alerts
                 - Plan adds a new queue library when a queue already exists for other purposes
                 - Plan builds a parallel auth flow when the codebase already has auth
                 - Plan creates a new cron job that overlaps with existing schedulers
                 Key: the NEW code could have been an EXTENSION of existing code, but the plan doesn't discuss that
               Negative indicators:
                 - Plan EXTENDS an existing file (e.g., "add exportCSV to userController.js") — extension is integration, not bolt-on
                 - Plan is purely additive in a brand-new domain (first-time WebSocket with no existing real-time infra)
                 - Plan explicitly states "cannot extend X because Y" with justification
               Gates: Q-C14 (Bolt-on vs integrated).

       HAS_UNBOUNDED_DATA: true if the plan contains queries, fetches, or iterations
               without explicit size limits or pagination.
               Positive indicators:
                 - User.find({}) or db.query("SELECT * FROM users") without LIMIT
                 - for user in all_users without slicing/batching
                 - fs.readdir() without pagination, processing all files
                 - Loading entire file into memory without size check
                 - Caching full filtered result sets "at our scale" without pagination
               Negative indicators:
                 - Pagination, LIMIT clauses, batch sizes explicit ("in batches of 100")
                 - Single-record lookups by ID
               Gates: Q-C32 (Bulk data safety).

       ## Step 2: Review tier

       Assess the plan's overall review needs holistically:

       REVIEW_TIER:
         TRIVIAL — ALL of: exactly 1 non-code file (.md, .txt, .json OK;
                   .gs/.ts/.js/.py/.html disqualify), purely additive wording/
                   description (no architectural decisions, no removal, no new
                   behavioral logic), no branching decisions or conditional paths.
                   Default to SMALL when uncertain.
         SMALL — 1-3 files, straightforward changes, no risk escalation.
                 ESCALATE TO FULL if any of:
                   - Plan touches trust boundaries (new endpoints, auth, permissions)
                   - Combined high-risk domains (security + external_calls + state)
                   - Schema/format changes consumed by files NOT in the plan
                   - Complex conditional implementation paths
                 Default to FULL when uncertain.
         FULL — Everything else.

       Key: "modifies code in that domain" vs "mentions that domain in prose."
       Example: a plan editing .md files that runs npm test → IS_NODE=false.

       ## Step 3: Active risk domains (for SMALL and FULL tiers; skip for TRIVIAL)

       List which risk domains the plan's implementation steps actually touch:
         security — new endpoints, user input handling, auth changes, API keys,
                    injection risk, permission model changes
         testing — function signature changes, new logic needing test coverage,
                   bug fixes (regression test needed)
         state — config file changes, persistent storage, caching, schema changes,
                 any file with a defined format that downstream code consumes
                 (key test: if structure changed, would consumers break?)
         operations — deployment/push/release steps, logging changes, monitoring,
                      env var additions (key test: will others see this change
                      without pulling it themselves?)
         external_calls — outbound HTTP/API calls, database queries, external
                          service integrations, OAuth flows, third-party library
                          usage with network I/O

       Output ONLY (no explanation):
       REVIEW_TIER=TRIVIAL|SMALL|FULL
       ACTIVE_RISKS=comma,separated,list (or "none")
       IS_GAS=true|false
       IS_NODE=true|false
       HAS_UI=true|false
       HAS_EXISTING_INFRA=true|false
       HAS_UNBOUNDED_DATA=true|false
     """
   )
   Parse output → set REVIEW_TIER, ACTIVE_RISKS (as set of strings), IS_GAS, IS_NODE, HAS_UI, HAS_EXISTING_INFRA, HAS_UNBOUNDED_DATA
   IF classifier timeout or malformed output → REVIEW_TIER=FULL, IS_GAS=false, IS_NODE=false, HAS_UI=false,
     HAS_EXISTING_INFRA=false, HAS_UNBOUNDED_DATA=false,
     ACTIVE_RISKS={"testing", "security", "external_calls"}
     (fallback activates impact, testing, security clusters unconditionally; Q-C14 and Q-C32
      evaluate as N/A per conditional gates, consistent with their default being inactive
      when flags absent)

   Compute cluster activation (for FULL tier; SMALL uses its own question selection):
   ```
   IF IS_GAS:
     # All L2 clusters superseded by gas-evaluator except impact (for Q-C26/Q-C35/Q-C37/Q-C38/Q-C39/Q-C40 — no gas equivalent)
     active_clusters = ["impact"]  # always active — Q-C26/Q-C35/Q-C37/Q-C38/Q-C39/Q-C40 evaluate here
     if "state" in ACTIVE_RISKS:  active_clusters.append("state")  # Q-C36 has no gas equivalent; Q-C13/18/19/24 → N/A-superseded within evaluator
   ELSE:
     active_clusters = ["impact"]                              # always active (Gate 1 Q-C3)
     if "testing" in ACTIVE_RISKS:        active_clusters.append("testing")
     if "state" in ACTIVE_RISKS:          active_clusters.append("state")
     if "security" in ACTIVE_RISKS or "external_calls" in ACTIVE_RISKS:
                                          active_clusters.append("security")
     if "operations" in ACTIVE_RISKS:     active_clusters.append("operations")
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

   IF REVIEW_TIER == TRIVIAL:
     Print: "╔══════════════════════════════════════════════╗"
     Print: "║  ⚡ FAST PATH                     TRIVIAL  ║"
     Print: "╚══════════════════════════════════════════════╝"
     Print: "  Scope       1 file ([ext]), additive only"
     Print: "  Questions   5"
     [Substitute plan_path and questions_path (resolved in step 2) before spawning]
     Run single Task(
       subagent_type = "general-purpose",
       prompt = """
         Read the plan at <plan_path>.
         Read ~/.claude/CLAUDE.md for standards context.
         Read <questions_path> for question definitions (Layer 1 section).

         Evaluate ONLY these 5 questions (definitions in <questions_path>):
           Q-G1 (Approach soundness — never N/A)
           Q-G5 (Scope focus — never N/A)
           Q-E2 (Post-implementation workflow — N/A for IS_GAS)
           Q-E1 (Git lifecycle — never N/A)
           Q-G11 (Existing code examined — N/A for doc-only plans)

         Output for each: PASS | NEEDS_UPDATE — [finding]
         If NEEDS_UPDATE: include [EDIT: instruction]
         Do not use Edit/Write/Bash tools — read-only.
       """
     )

     If all 5 PASS:
       Output terminal-native fast-path scorecard:
         ╔══════════════════════════════════════════════════════╗
         ║                                                      ║
         ║      ██████ ██████ ██████ ██████ ██████ ██████       ║
         ║                                                      ║
         ║         review-plan Scorecard — Fast Path            ║
         ║                                                      ║
         ║         Rating: 🟢 READY                            ║
         ║         5/5 clear                                    ║
         ║                                                      ║
         ╚══════════════════════════════════════════════════════╝

           ✅  Approach soundness              Q-G1
           ✅  Scope focus                     Q-G5
           ✅  Post-implementation workflow    Q-E2
           ✅  Git lifecycle                   Q-E1
           ✅  Existing code examined          Q-G11
         (Replace ✅ with ❌ for any NEEDS_UPDATE — but this branch is all-PASS.)
       → Proceed to step 8 (interactive completion prompt).
       # Gate file is written in step 8 only when the user confirms exit — not here.

     If any NEEDS_UPDATE:
       Apply edits inline (no team).
       Re-evaluate the same 5 questions once (same Task format above,
       including substitution of plan_path and questions_path).
       If all 5 now PASS:
         Output terminal-native fast-path scorecard (same format as above, Rating 🟢 READY). → Proceed to step 8.
         # Gate file is written in step 8 only when the user confirms exit — not here.
       If still NEEDS_UPDATE:
         Print: "⚡ Fast-path could not resolve — falling through to full review"
         REVIEW_TIER = FULL  # force full convergence loop
         # Do not jump here — fall through to Steps 4–5 below (tracking init + results dir setup) before entering convergence loop.
         # Step 8 (interactive prompt) is only reached after the convergence loop exits — no special guard needed here.

   IF REVIEW_TIER == SMALL:
     # Build question set: 8 core + risk-activated conditional questions
     small_questions = [
       "Q-G1",   # Approach soundness (Gate 1)
       "Q-G11",  # Existing code examined (Gate 1)
       "Q-C3",   # Blast radius / call-site cross-ref (Gate 1)
       "Q-G4",   # Assumptions / unintended consequences (Gate 2)
       "Q-G5",   # Scope focus (Gate 2)
       "Q-C26",  # Proportionality / migration tasks (Gate 2)
       "Q-E1",   # Git lifecycle (Gate 2)
       "Q-E2",   # Post-implementation workflow (Gate 2)
     ]
     risk_questions = {}  # risk_domain → [question IDs]
     if "security" in ACTIVE_RISKS:
       small_questions.extend(["Q-C15", "Q-C22"])  # input validation, auth/permission
       risk_questions["security"] = ["Q-C15", "Q-C22"]
     if "testing" in ACTIVE_RISKS:
       small_questions.extend(["Q-C4"])             # tests updated
       risk_questions["testing"] = ["Q-C4"]
     if "state" in ACTIVE_RISKS:
       small_questions.extend(["Q-C33"])            # config validation
       risk_questions["state"] = ["Q-C33"]
     if "operations" in ACTIVE_RISKS:
       small_questions.extend(["Q-C20"])            # logging / sensitive data
       risk_questions["operations"] = ["Q-C20"]
     if "external_calls" in ACTIVE_RISKS:
       small_questions.extend(["Q-C30", "Q-C34"])   # async errors, timeouts
       risk_questions["external_calls"] = ["Q-C30", "Q-C34"]
     # Dedup (guards against future overlap if risk domains share question IDs)
     small_questions = list(dict.fromkeys(small_questions))
     total_q = len(small_questions)
     risk_count = total_q - 8

     Print: "╔══════════════════════════════════════════════╗"
     Print: "║  ⚡ FAST PATH                       SMALL  ║"
     Print: "╚══════════════════════════════════════════════╝"
     Print: "  Scope       single-pass review"
     Print: "  Questions   [total_q] (8 core + [risk_count] risk-activated)"
     IF risk_questions:
       Print: "  Risks       [comma-separated ACTIVE_RISKS]"

     # Build question list string for evaluator prompt
     question_list_str = "\n".join(f"  {qid}" for qid in small_questions)

     [Substitute plan_path and questions_path (resolved in step 2) before spawning]
     Run single Task(
       subagent_type = "general-purpose",
       prompt = """
         Read the plan at <plan_path>.
         Read ~/.claude/CLAUDE.md for standards context.
         Read <questions_path> for question definitions.

         Context flags (substituted by team-lead at spawn time):
           IS_GAS=<IS_GAS>   IS_NODE=<IS_NODE>   HAS_UI=<HAS_UI>

         Evaluate ONLY these [total_q] questions (definitions in <questions_path>):
         [question_list_str]

         Gate 1 (blocking): Q-G1, Q-G11, Q-C3
         Gate 2 (important): all others listed above

         N/A-supersession rules (apply based on context flags above):
           IF IS_GAS=true: Q-C3 → N/A (covered by gas-evaluator Q18/Q16/Q39/Q41),
             Q-E1 → N/A (covered by Q1/Q2), Q-E2 → N/A (covered by Q42)
           IF IS_NODE=true: Q-C3 remains active (not superseded for Node)

         For each question:
           - Look up its full definition in <questions_path>
           - Evaluate against the plan (mark N/A per supersession rules above)
           - Output: Q-ID PASS | NEEDS_UPDATE | N/A — [finding]
           - If NEEDS_UPDATE: include [EDIT: instruction]
         Do not use Edit/Write/Bash tools — read-only.
       """
     )

     If all PASS or N/A (no NEEDS_UPDATE):
       na_count = count of N/A results; applicable_count = total_q - na_count
       Output terminal-native small fast-path scorecard:
         ╔══════════════════════════════════════════════════════╗
         ║                                                      ║
         ║      ██████ ██████ ██████ ██████ ██████ ██████       ║
         ║                                                      ║
         ║       review-plan Scorecard — Small Fast Path        ║
         ║                                                      ║
         ║       Rating: 🟢 READY                             ║
         ╚══════════════════════════════════════════════════════╝
         [applicable_count]/[applicable_count] clear + [na_count] N/A

           Gate 1 (Blocking)
           ─────────────────────────────────────
             ✅  Approach soundness              Q-G1
             ✅  Existing code examined          Q-G11
             ✅  Blast radius                    Q-C3   [or —  N/A if IS_GAS]

           Gate 2 (Important)
           ─────────────────────────────────────
             ✅  Assumptions stated              Q-G4
             ✅  Scope focus                     Q-G5
             ✅  Proportionality                 Q-C26
             ✅  Git lifecycle                   Q-E1   [or —  N/A if IS_GAS]
             ✅  Post-implementation             Q-E2   [or —  N/A if IS_GAS]

           Risk-Activated (if any)
           ─────────────────────────────────────
             [for each risk_questions entry:]
             ✅  [Name]                          [Q-ID]  [domain]
         (Replace ✅ with ❌ for any NEEDS_UPDATE. Show — for N/A.)
       → Proceed to step 8 (interactive completion prompt).
       # Gate file is written in step 8 only when the user confirms exit — not here.

     If any NEEDS_UPDATE:
       Apply edits inline (no team — orchestrator applies directly).
       Build re_eval_questions: only Q-IDs that returned NEEDS_UPDATE (not PASS or N/A).
       Always include Gate 1 questions (Q-G1, Q-G11, Q-C3) in re-eval regardless
       of prior status (Gate 1 must be verified after edits).
       # Note: edits to fix NEEDS_UPDATE questions may introduce regressions in
       # previously-passing questions. The Gate 1 inclusion mitigates the highest-risk
       # regressions. Remaining risk is accepted as a tradeoff for token savings — the
       # SMALL tier is already a fast-path for low-complexity plans where cross-question
       # regression is unlikely.
       Re-evaluate re_eval_questions once (same Task format, substituting
       re_eval_questions for question_list_str).
       If all now PASS or N/A:
         Output small fast-path scorecard (same format, Rating 🟢 READY). → Proceed to step 8 (interactive completion prompt).
         # Gate file is written in step 8 only when the user confirms exit — not here.
       If still NEEDS_UPDATE:
         Print: "⚡ Small fast-path could not resolve — falling through to full review"
         REVIEW_TIER = FULL  # force full convergence loop
         # Do not jump here — fall through to Steps 4–5 below (tracking init + results dir setup) before entering convergence loop.
         # Step 8 (interactive prompt) is only reached after the convergence loop exits — no special guard needed here.

   Print: "╔══════════════════════════════════════════════╗"
   Print: "║  ◆ CONFIG                            FULL   ║"
   Print: "╚══════════════════════════════════════════════╝"
   Print mode based on flags (key-value layout):
     IS_GAS + HAS_UI:     "  Review mode  GAS + UI (gas-eval + impact cluster + ui-evaluator)"
     IS_GAS only:         "  Review mode  GAS (gas-eval + impact + state? clusters)"
     IS_NODE only:        "  Review mode  Node.js ([N] clusters: [names] + node-eval)"
     IS_NODE + HAS_UI:    "  Review mode  Node.js + UI ([N] clusters: [names] + node-eval + ui-evaluator)"
     HAS_UI only:         "  Review mode  Standard + UI ([N] clusters: [names] + ui-evaluator)"
     All false:           "  Review mode  Standard ([N] clusters: [names])"
   Print: "  Clusters     [N] active: [comma-separated cluster names]"
   # Surface conditional gate flags so users can validate classifier decisions at pass 1.
   # Rendered as question-gate decisions (not raw booleans) to make misclassification obvious.
   Print: "  Gates        Q-C14 [✓ active | — N/A (HAS_EXISTING_INFRA=false)]"  # pick one branch based on flag
   Print: "               Q-C32 [✓ active | — N/A (HAS_UNBOUNDED_DATA=false)]"  # pick one branch based on flag
   (Raw flag debug line "REVIEW_TIER=[v] ACTIVE_RISKS=[v] IS_GAS=[v] IS_NODE=[v] HAS_UI=[v] HAS_EXISTING_INFRA=[v] HAS_UNBOUNDED_DATA=[v]"
   is printed during the convergence loop when pass_count >= 3, as a diagnostic aid for slow-convergence reviews.)
   Flags are set once and do NOT change between passes (evaluator set changes mid-loop
   would invalidate convergence state tracking).

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
   memoized_l1_questions = set()   # {Q-G11, Q-G6, Q-G7, Q-G18, Q-G28} once confirmed stable PASS or N/A (Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G19, Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25, Q-G26, Q-G27 are not memoizable)
   l1_structural_memoized = false    # true when ALL 6 structural questions PASS/N/A for 2 consecutive passes AND no edits since
   l1_structural_memoized_since = 0
   l1_structural_clean_since = 0    # pass_count when first consecutive clean pass was observed (0 = not yet started)
   l1_process_memoized = false       # true when ALL 16 process questions PASS/N/A AND no edits since
   l1_process_memoized_since = 0
   prev_pass_results = {}          # Q-ID → PASS/NEEDS_UPDATE/N/A from previous pass (for stability-based memoization)
   memoized_gas_questions = set()    # gas Q-IDs confirmed stable (structural + stability-based)
   memoized_gas_since = {}           # Q-ID → pass_count when memoized
   memoized_node_questions = set()   # node N-IDs confirmed stable
   memoized_node_since = {}          # N-ID → pass_count when memoized
   prev_gas_results = {}             # Q-ID → PASS/NEEDS_UPDATE/N/A from previous pass
   prev_node_results = {}            # N-ID → PASS/NEEDS_UPDATE/N/A from previous pass
   per_q_status_history = {}        # Q-ID → [status_per_pass] e.g. {"Q-G20": ["NEEDS_UPDATE", "PASS", "NEEDS_UPDATE"]}
                                    # Tracks per-question status across passes for oscillation detection.
                                    # A Q-ID with pattern [X, Y, X] (status flips twice) is oscillating.
   prev_pass_applied_edits = []   # list of {q_id, evaluator, summary} from previous pass
   MAX_CONCURRENT = 10             # max parallel evaluator tasks per wave; tunable (increased from 5 — typical FULL review spawns 5-7 evaluators, all fit in single wave)
   MAX_EDITS_PER_PASS = 12         # safety cap — prevent runaway plan expansion
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
   # Scope: Gate 3 advisory questions only (Q-G25, Q-G28).
   # Q-G20-Q-G24 are Gate 2; their descriptive PASS text is not cached (never rendered in Gate 3 section).
   # Populated each non-memoized evaluator pass (Gate 3 advisory questions only, per ADVISORY_CACHE_QIDS).
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
   Print: "  Results      $RESULTS_DIR"
   ```
   Print: "╔══════════════════════════════════════════════╗"
   Print: "║  ◆ REVIEW                     convergence   ║"
   Print: "╚══════════════════════════════════════════════╝"
   Print: "  Beginning convergence loop — evaluating plan quality across all active layers"

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
- **Non-GAS / Non-NODE (standard):** Q-G1, Q-G11, Q-C3 (loop); Q-E1, Q-E2 (epilogue)
- **IS_GAS mode:** Q-G1, Q-G11 (L1); Q1, Q2, Q13, Q15, Q18, Q42 (gas-evaluator). Q-E1 and Q-E2 are N/A for IS_GAS (covered by Q1/Q2 and Q42).
- **IS_NODE mode:** Q-G1, Q-G11, Q-C3 (loop); Q-E1, Q-E2 (epilogue); N1 (node-evaluator)

**Gate 2** comprises all remaining questions not listed above and not designated Gate 3.
**Gate 3** questions are explicitly marked in QUESTIONS.md with `[Gate 3]`; when QUESTIONS.md is unavailable, treat all unlisted questions as Gate 2.

---

<!-- Question set updated 2026-04-10 per skills/review-plan/question-effectiveness-report.md:
     Dropped Q-G2, Q-G8, Q-C21 (0% hit rate across 18 plans including 6 adversarial).
     Conditional Q-C14 (HAS_EXISTING_INFRA), Q-C32 (HAS_UNBOUNDED_DATA).
     L1 per-pass count: 25 → 23. Gate 1 count: 3 → 2 questions (Q-G1, Q-G11).
     Classifier: Haiku → Sonnet (Haiku failed HAS_EXISTING_INFRA discrimination in Phase 2 spike). -->

## Convergence Loop

```
DO:
  -- Context-compression recovery: if memoized state appears lost, restore from checkpoint --
  _recovered_this_pass = false
  IF memo_file exists AND (memoized_clusters is empty AND memoized_l1_questions is empty AND pass_count == 0):
    TRY:
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
       advisory_findings_cache (default {}),
       per_q_status_history (default {})
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
    CATCH (JSON parse error or read failure):
      Print: "⚠️ Memo file unreadable — starting fresh (removed stale checkpoint)"
      Bash: rm -f <memo_file_path>
      # All memoized state remains at defaults; fall through

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

  Print: "┌──────────────────────────────────────────────────────┐"
  Print: "│  Pass [pass_count]/5  —  evaluating…                  │"
  Print: "└──────────────────────────────────────────────────────┘"
  Print: "  [━ × (pass_count*2)][╌ × (10-pass_count*2)]  Spawning evaluators — collecting findings"

  -- Early memoization invalidation (top-of-pass, before wave spawning) --
  IF l1_process_memoized AND len(prev_pass_applied_edits) > 0:
    l1_process_memoized = false
    l1_process_memoized_since = 0
    Print: "  memo: l1-advisory-process early-invalidated (prev pass had edits)"
  IF l1_structural_memoized AND len(prev_pass_applied_edits) > 0:
    l1_structural_memoized = false
    l1_structural_clean_since = 0
    Print: "  memo: l1-advisory-structural early-invalidated (prev pass had edits)"

  [Substitute plan_path, questions_path, questions_l3_path, gas_eval_path, node_eval_path, and RESULTS_DIR (all derived in Step 0/5) into evaluator prompts before spawning.
  For evaluators referencing [See: EVALUATOR_OUTPUT_CONTRACT above], expand the reference inline — copy the full contract block into the Task prompt, replacing EVALUATOR_NAME with the evaluator's name and RESULTS_DIR with the actual results directory path.]

  -- Build evaluator list (priority-ordered for wave assignment) --
  evaluators_to_spawn = []  # list of {name, task_prompt}

  # Priority 1a: L1 blocking (Gate 1, always runs, 2 questions)
  evaluators_to_spawn.append({name: "l1-blocking", task_config: <l1_blocking_config below>})

  # Priority 1b: L1 advisory structural (Gate 2/3, 6 questions — skip if group-memoized)
  IF NOT l1_structural_memoized:
    evaluators_to_spawn.append({name: "l1-advisory-structural", task_config: <l1_advisory_structural_config below>})

  # Priority 1c: L1 advisory process (Gate 2/3, 15 questions — skip if group-memoized)
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
  Print: "  Building evaluator wave schedule"
  Print: "  evaluators: [total_evaluators] across [len(waves)] wave(s) (max [MAX_CONCURRENT] concurrent)"

  FOR wave_idx, wave in enumerate(waves):
    wave_names = [e.name for e in wave]
    Print: "  ┌ Wave [wave_idx+1]/[len(waves)] ── [len(wave)] evaluators"

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

      # Print progress using tree connectors
      # Use ├── for all but last in wave, └── for last
      connector = IF wave_progress_idx < len(wave_names): "├──" ELSE: "└──"
      IF data.status == "complete":
        nu = data.counts.needs_update; p = data.counts.pass; na = data.counts.na
        status_icon = IF nu == 0: "●" ELSE: "◐"
        Print: "  [connector] [name] [right-pad to col 30]  [status_icon]  [nu]F  [p]P  [na]S    [data.elapsed_s]s"
      ELSE IF data.status == "error":
        Print: "  [connector] [name] [right-pad to col 30]  ✗  error: [data.error]"
    # Accumulate into pass-level collection
    FOR name, data in wave_results:
      all_results[name] = data

    Print: "       [wave_idx+1]/[len(waves)] complete ── [len(wave_results)]/[len(wave_names)] reported"

  fanin_start_time = Date.now()

  -- Print memoized evaluators (not spawned) --
  FOR each cluster_name in memoized_clusters:
    Print: "  ⏭ [cluster_name]-evaluator          locked since p[memoized_since[cluster_name]]"
  IF IS_GAS AND fully_memoized_gas:
    Print: "  ⏭ gas-evaluator                     locked (all [applicable_gas_count] questions stable)"
    gas_plan_changes = 0
    gas_results = {q_id: "PASS" for q_id in memoized_gas_questions}
  IF IS_NODE AND fully_memoized_node:
    Print: "  ⏭ node-evaluator                    locked (all [applicable_node_count] questions stable)"
    node_plan_changes = 0
    node_results = {n_id: "PASS" for n_id in memoized_node_questions}
  IF l1_structural_memoized:
    structural_questions = {"Q-G20", "Q-G21", "Q-G22", "Q-G23", "Q-G24", "Q-G25"}
    FOR q in structural_questions:
      l1_results[q] = "PASS"  # group-memoized — all were PASS/N/A
    Print: "  ⏭ l1-advisory-structural            locked since p[l1_structural_memoized_since]"
  IF l1_process_memoized:
    process_questions = {"Q-G4", "Q-G5", "Q-G6", "Q-G7", "Q-G10",
      "Q-G12", "Q-G13", "Q-G14", "Q-G16", "Q-G17", "Q-G18", "Q-G19", "Q-G26", "Q-G27", "Q-G28"}
    FOR q in process_questions:
      l1_results[q] = "PASS"  # group-memoized — all were PASS/N/A
    Print: "  ⏭ l1-advisory-process               locked since p[l1_process_memoized_since]"

  --- EVALUATOR_OUTPUT_CONTRACT (shared by l1-blocking, l1-advisory-structural, l1-advisory-process, cluster, and ui evaluators) ---
  # Referenced as [See: EVALUATOR_OUTPUT_CONTRACT] in each evaluator config below.
  # Gas-evaluator and node-evaluator use their own output contracts (defined in external eval files).
  #
  # Output contract — write findings to JSON file:
  #   Write your findings to: <RESULTS_DIR>/EVALUATOR_NAME.json
  #
  #   JSON schema:
  #   {
  #     "evaluator": "EVALUATOR_NAME",
  #     "pass": <pass_count>,
  #     "status": "complete",
  #     "elapsed_s": <seconds_from_start>,
  #     "findings": {
  #       "<Q-ID>": {"status": "PASS|NEEDS_UPDATE|N/A", "finding": "<text>", "edit": "<instruction or null>"},
  #       ...
  #     },
  #     "counts": {"pass": N, "needs_update": N, "na": N}
  #   }
  #
  #   Write atomically using Bash (ensures clean reads by orchestrator):
  #     cat > '<RESULTS_DIR>/EVALUATOR_NAME.json.tmp' << 'EVAL_EOF'
  #     <json>
  #     EVAL_EOF
  #     mv '<RESULTS_DIR>/EVALUATOR_NAME.json.tmp' '<RESULTS_DIR>/EVALUATOR_NAME.json'
  #
  #   If you encounter an error reading inputs, write:
  #     {"evaluator": "EVALUATOR_NAME", "pass": <pass_count>, "status": "error", "error": "<message>"}
  #
  # Constraints:
  #   - Do not use Edit or Write tools on the plan file — read-only
  #   - Use Bash ONLY to write your findings JSON to the specified path
  #   - Do not call ExitPlanMode, AskUserQuestion, or touch marker files
  #   - Write exactly ONE JSON file

  --- L1 Blocking Evaluator Config (Gate 1: 2 questions, always runs, never memoized) ---
  l1_blocking_config = Task(
    subagent_type = "general-purpose",
    name = "l1-blocking-p" + pass_count,
    prompt = """
      You are evaluating a plan for critical quality (Layer 1 Gate 1: 2 questions).

      Question definitions: Read <questions_path> (Layer 1, Gate 1 section)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ONLY these 2 questions: Q-G1, Q-G11
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

      [See: EVALUATOR_OUTPUT_CONTRACT above, with EVALUATOR_NAME = "l1-blocking" and RESULTS_DIR = <RESULTS_DIR>]

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  --- L1 Advisory Structural Evaluator Config (Gate 2/3: 6 abstract/structural questions, group-memoizable) ---
  --- Pass A runs first (while model is at full attention): Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25 ---
  l1_advisory_structural_config = Task(
    subagent_type = "general-purpose",
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

      [See: EVALUATOR_OUTPUT_CONTRACT above, with EVALUATOR_NAME = "l1-advisory-structural" and RESULTS_DIR = <RESULTS_DIR>]

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  --- L1 Advisory Process Evaluator Config (Gate 2/3: 15 standards/process questions, group-memoizable) ---
  --- Pass B runs second: Q-G4, Q-G5, Q-G6, Q-G7, Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19, Q-G26, Q-G27, Q-G28 ---
  l1_advisory_process_config = Task(
    subagent_type = "general-purpose",
    name = "l1-advisory-process-p" + pass_count,
    prompt = """
      You are evaluating a plan for standards/process quality (Layer 1 Gate 2/3: 15 questions).

      Question definitions: Read <questions_path> (Layer 1, Gate 2 and Gate 3 sections)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ONLY these 15 standards/process questions: Q-G4, Q-G5, Q-G6, Q-G7, Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19, Q-G26, Q-G27, Q-G28
      Calibration: Prioritize practical production implications over theoretical concerns.
      Flag findings that would cause real failures, wasted effort, or incorrect implementations
      at development time — not hypothetical risks that require unlikely conditions to manifest.
      When deciding between PASS and NEEDS_UPDATE for a borderline finding, ask: "Would a
      senior developer implementing this plan actually encounter this problem?" If the answer
      is "only under unusual circumstances," mark PASS.
      Apply triage (mark N/A per the N/A column).
      Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
      or <!-- node-plan -->.
      [IF memoized_l1_questions intersects {Q-G4, Q-G5, Q-G6, Q-G7, Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19, Q-G26, Q-G27, Q-G28} is non-empty, append to prompt:]
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
              "should handle...somehow", "might need to", "will need to investigate",
              "if the API supports", and similar uncertainty markers → always NEEDS_UPDATE.
              Cite the marker and its location.
          Category 2 — Implicit constraints: scan for statements presented as facts that could
              be wrong where no investigation step validates the choice. Ask: "Could this be wrong,
              and would the plan discover it before committing work?" If no → flag as unstated
              assumption. Cite the statement and explain why it is unvalidated.
              Recognition anchors for implicit constraints: action-without-investigation verbs
              ('Copy files from X', 'Update Y directly', 'Use approach Z') where the approach
              could be wrong but the plan has no discovery step.
        Borderline: plan states "we assume X" explicitly → PASS if the assumption is reasonable
        and stated. "X won't work" or "Y is required" without citing evidence → NEEDS_UPDATE
        (unvalidated constraint presented as established fact).
      - For Q-G18 (Pre-condition verification): Scan for file-edit steps. For each, check
          whether a preceding Read or "verify current state" step exists that names the specific
          file AND what to confirm (function name, line range, config key). Pattern:
          "edit/modify/update [file]" without a prior "read [file] and verify [X]" step →
          NEEDS_UPDATE. N/A: new-file creation steps with no existing file to verify.
      - For Q-G17 (Phase preambles): Only activates on plans with ≥ 2 distinct phases.
          For each phase: check whether 1-3 narrative sentences appear BEFORE the numbered
          steps, explaining the phase intent. A phase header alone ('## Phase 2') does not
          qualify — the preamble must convey why this phase exists and what it sets up.
          N/A: single-phase plans.
      - For Q-G4 (Unintended consequences): Apply a two-layer scan:
          Layer 1 — Behavioral side effects: for each file the plan modifies, ask "Does any
              other workflow, cron trigger, or user-facing path read or depend on this file's
              behavior?" If yes and the plan does not mention that dependent path, NEEDS_UPDATE.
              Cite the modified file and the unaddressed dependent path.
          Layer 2 — Security surface shift: for each new endpoint, permission change, or
              data-flow alteration, ask "Does this expand who or what can access the data?"
              If yes and no security consideration is mentioned, NEEDS_UPDATE.
          Borderline: plan modifies a shared utility but all callers pass through unchanged
              code paths → PASS (no behavioral change at call sites).
          Example — NEEDS_UPDATE: "Plan modifies shared-types.sh TYPES array schema but does
              not mention uninstall.sh or other scripts that parse TYPES.
              [EDIT: add step to verify all TYPES array consumers handle the new format]"
          Example — PASS: "Plan adds a new optional field to getConfig() — existing callers
              ignore unknown fields. No behavioral side effect."
      - For Q-G14 (Codebase style adherence): Apply a pattern-match-then-compare algorithm:
          (1) Identify: list each new code pattern the plan introduces (error handling style,
              module structure, naming convention, import pattern, git workflow steps).
          (2) Compare: for each, check whether comparable existing code in the same codebase
              uses a different pattern. Source: codebase conventions in CLAUDE.md, or patterns
              visible in files the plan references.
          (3) If deviation exists AND the plan does not acknowledge it → NEEDS_UPDATE. If
              deviation is acknowledged with a reason → PASS.
          N/A: brand-new project with no existing patterns to compare.
          Example — NEEDS_UPDATE: "Plan uses 'Push directly to main' (step 7) but CLAUDE.md
              requires feature branches. Deviation not acknowledged.
              [EDIT: change to feature branch workflow, or add note explaining direct-push justification]"
          Example — PASS: "Plan introduces try/catch in new module; existing modules use bare
              calls. Plan justifies: 'hardened against transient CacheService errors.'
              Acknowledged → PASS."
      - For Q-G26 (Domain convention alignment): Check if the plan's technical approach
          follows established patterns for the domain it operates in. Look for: REST verbs
          misused (GET for mutations, POST for idempotent reads), auth protocols reinvented,
          framework conventions bypassed, or standard library features reimplemented.
          If the domain is unfamiliar to the plan author (stated or implied), flag absence of
          a research step. N/A when Q-G14 already covers the conventions in question
          (intra-codebase patterns vs. domain-wide standards).
      - For Q-G27 (Assumption validation spike): For each technical assertion the plan builds
          on (API supports batch ops, library handles X, performance meets Y), check: is it
          backed by cited evidence? If not, does the plan include a validation step (spike,
          POC, benchmark) BEFORE the dependent implementation? Distinguish from Q-G10:
          Q-G10 flags the missing evidence; Q-G27 flags the missing validation step.
          Low-risk assertions (well-documented APIs, standard library features) → N/A.

      [See: EVALUATOR_OUTPUT_CONTRACT above, with EVALUATOR_NAME = "l1-advisory-process" and RESULTS_DIR = <RESULTS_DIR>]

      Plan to evaluate: <plan_path> — read it with the Read tool, then evaluate the questions above.
    """
  )

  --- Cluster Evaluator Config (template for each active, non-memoized cluster) ---
  cluster_config(cluster_name) = Task(
    subagent_type = "general-purpose",
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
        HAS_EXISTING_INFRA=<HAS_EXISTING_INFRA>   HAS_UNBOUNDED_DATA=<HAS_UNBOUNDED_DATA>
        ACTIVE_RISKS=<ACTIVE_RISKS>

      IS_NODE suppression (apply only when IS_NODE=true above):
        Q-C16 (Security cluster, →N6), Q-C18 (State cluster, →N8),
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

      Conditional question gates (per question-effectiveness-report.md 2026-04-10):
        Q-C14 (Bolt-on vs integrated) → N/A when HAS_EXISTING_INFRA=false. Only evaluate
          when the plan's classifier marked it true. Applies only in non-GAS mode (IS_GAS
          already supersedes Q-C14).
        Q-C32 (Bulk data safety) → N/A when HAS_UNBOUNDED_DATA=false. Applies only in
          non-GAS/non-NODE mode (IS_GAS and IS_NODE already supersede Q-C32).

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

      [See: EVALUATOR_OUTPUT_CONTRACT above, with EVALUATOR_NAME = "<cluster_name>-evaluator" and RESULTS_DIR = <RESULTS_DIR>]

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

      Constraints: read-only — do not edit the plan, do not call ExitPlanMode or AskUserQuestion.
      Write exactly ONE JSON file to the results_dir.
    """
  )

  --- Node Evaluator Config ---
  node_config = Task(
    subagent_type = "general-purpose",
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

      Constraints: read-only — do not edit the plan, do not call ExitPlanMode or AskUserQuestion.
      Write exactly ONE JSON file to the results_dir.
    """
  )

  --- UI Evaluator Config (includes merged Client cluster: Q-C17, Q-C25) ---
  ui_config = Task(
    subagent_type = "ui-designer",
    name = "ui-evaluator-p" + pass_count,
    prompt = """
      You are the ui-evaluator running inside a review-plan evaluator task. Evaluate the plan for
      UI specialization and client concerns (11 questions in this cluster).

      Question definitions: Read <questions_l3_path>
        (Q-U1 through Q-U9, plus Q-C17 and Q-C25 — merged from Client cluster).

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

      [See: EVALUATOR_OUTPUT_CONTRACT above, with EVALUATOR_NAME = "ui-evaluator" and RESULTS_DIR = <RESULTS_DIR>]

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
        status_icon = IF nu == 0: "●" ELSE: "◐"
        evaluator_lines.append("[name] [right-pad to col 30]  [status_icon]  [nu]F  [p]P  [na]S    [elapsed]s")
      ELSE IF data.status == "error":
        evaluator_lines.append("[name] [right-pad to col 30]  ✗  error")

    # Add memoized clusters/evaluators (not in all_results — never spawned)
    FOR each cluster_name in memoized_clusters:
      evaluator_lines.append("[cluster_name] [right-pad to col 30]  🔒  locked (p[memoized_since[cluster_name]])")
    IF IS_GAS AND fully_memoized_gas:
      evaluator_lines.append("gas-evaluator [right-pad to col 30]  🔒  locked (all stable)")
    IF IS_NODE AND fully_memoized_node:
      evaluator_lines.append("node-evaluator [right-pad to col 30]  🔒  locked (all stable)")
    IF l1_structural_memoized:
      evaluator_lines.append("l1-advisory-structural [right-pad to col 30]  🔒  locked (p[l1_structural_memoized_since])")
    IF l1_process_memoized:
      evaluator_lines.append("l1-advisory-process [right-pad to col 30]  🔒  locked (p[l1_process_memoized_since])")

    Print tree (where n = len(evaluator_lines) - 1):
      If n == 0: "  └ " + evaluator_lines[0]   (only 1 evaluator — no ┌/├)
      Else:
        "  ┌ " + evaluator_lines[0]
        For i in 1..n-1: "  ├ " + evaluator_lines[i]  (middle lines, inclusive range)
        "  └ " + evaluator_lines[n]

  Print: "  >> Routing evaluator findings to their respective layers"
  -- Route findings from all_results (already read during wave fan-in — no second file read) --
  FOR evaluator_name, data in all_results:
    # ORDERING CONTRACT: evaluator-specific error guards MUST appear before the general
    # error handler. The general handler's CONTINUE skips all subsequent checks.

    # Fail-closed guard for l1-blocking errors (Gate 1 safety) — MUST precede general handler
    IF evaluator_name == "l1-blocking" AND data.status in ["timeout", "error"]:
      # l1-blocking covers Q-G1, Q-G11 — all Gate 1.
      # Treat as NEEDS_UPDATE to prevent false convergence with unevaluated Gate 1 questions.
      FOR q_id in ["Q-G1", "Q-G11"]:
        l1_results[q_id] = "NEEDS_UPDATE"
        l1_edits[q_id] = {"finding": "l1-blocking evaluator error — re-run required", "edit": null}
      Print: "  ⚠️ l1-blocking error → Q-G1/Q-G11 treated as NEEDS_UPDATE (fail-closed)"
      CONTINUE  # skip normal routing for this evaluator

    # Fail-closed guard for gas-evaluator errors (Gate 1 safety — IS_GAS mode) — MUST precede general handler
    IF evaluator_name == "gas-evaluator" AND data.status in ["timeout", "error"]:
      # gas-evaluator covers Q1, Q2, Q13, Q15, Q18, Q42 — all Gate 1 in IS_GAS mode.
      # Treat as NEEDS_UPDATE to prevent false convergence with unevaluated Gate 1 questions.
      FOR q_id in ["Q1", "Q2", "Q13", "Q15", "Q18", "Q42"]:
        gas_results[q_id] = "NEEDS_UPDATE"
        gas_edits[q_id] = {"finding": "gas-evaluator error — re-run required", "edit": null}
      Print: "  ⚠️ gas-evaluator error → Q1/Q2/Q13/Q15/Q18/Q42 treated as NEEDS_UPDATE (fail-closed)"
      CONTINUE

    # Fail-closed guard for node-evaluator errors (Gate 1 safety — IS_NODE mode) — MUST precede general handler
    IF evaluator_name == "node-evaluator" AND data.status in ["timeout", "error"]:
      # node-evaluator covers N1 — Gate 1 in IS_NODE mode.
      # Treat as NEEDS_UPDATE to prevent false convergence with unevaluated Gate 1 questions.
      node_results["N1"] = "NEEDS_UPDATE"
      node_edits = {"N1": {"finding": "node-evaluator error — re-run required", "edit": null}}
      Print: "  ⚠️ node-evaluator error → N1 treated as NEEDS_UPDATE (fail-closed)"
      CONTINUE

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

    # ADVISORY_CACHE_QIDS: Gate 3 questions only (Q-G25, Q-G28). Q-G20-Q-G24 are Gate 2 —
    # their PASS-with-finding text is descriptive, not advisory, and is never rendered in the
    # Gate 3 scorecard section. Caching them would accumulate unused entries.
    ADVISORY_CACHE_QIDS = {"Q-G25", "Q-G28"}
    FOR q_id, entry in data.findings:
      IF q_id not in ADVISORY_CACHE_QIDS:
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
    Print: "╔══════════════════════════════════════════════╗"
    Print: "║  ◆ APPLYING                                 ║"
    Print: "╚══════════════════════════════════════════════╝"
    Print: "  Found [total_findings_before_dedup]  →  Deduped [dedup_removed]  →  Queued [changes_to_apply]"

  IF changes_to_apply > 0:
    apply_start_time = Date.now()
  APPLY edits — for each finding with edit != null in any evaluator's JSON data:
    IF changes_to_apply > MAX_EDITS_PER_PASS:
      # Sort edits by gate priority: Gate 1 first, then Gate 2, then Gate 3
      edits_to_apply = sorted(edits_to_apply, key=lambda e: gate_priority(e.q_id))
      edits_to_apply = edits_to_apply[:MAX_EDITS_PER_PASS]
      Print: "  ⚠️ [changes_to_apply] edits queued — applying top [MAX_EDITS_PER_PASS] by gate priority (overflow: [changes_to_apply - MAX_EDITS_PER_PASS] deferred to next pass)"
    Print: ""
    FOR idx, edit in enumerate(edits_to_apply):
      Print: "  [idx+1]/[N] ┌ [question short name] ([ID])"
      Print: "        │ [verb] [object — first sentence of edit instruction]"
      Call the Edit tool on the plan file to insert/modify the specified content.
      IF Edit fails (old_string not found in plan):
        Print: "        └ ⚠ skipped — passage not found"
        # Do NOT count as a change. Do NOT retry.
        # The finding remains in evaluator output — it will be re-evaluated next pass.
        CONTINUE to next edit
      Mark each insertion <!-- review-plan -->.
      Each Edit call = 1 change. Do not count findings you only described in text.
      Print: "        └ ✓"
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
    Print: "──────────────────────────────────────────────────────"
    Print: "  [applied_count] applied   [skipped_count] skipped   [restorations] restored"
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
  # Q-G28: safe to memoize (matches Q-G18 rationale)
  IF l1_results["Q-G28"] in [PASS, N/A] AND "Q-G28" NOT in memoized_l1_questions:
    memoized_l1_questions.add("Q-G28")
    newly_memoized.append("Q-G28")  # track for milestone display
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
  # Individually memoizable L1 questions (structural): {Q-G11, Q-G6, Q-G7, Q-G18, Q-G28}

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
          IF Q-ID is Gate 2 or Gate 3 L1 question AND Q-ID NOT in {"Q-G10", "Q-G12", "Q-G13", "Q-G14", "Q-G16", "Q-G17", "Q-G19", "Q-G20", "Q-G21", "Q-G22", "Q-G23", "Q-G24", "Q-G25", "Q-G26", "Q-G27"}:
            # never Gate 1 (Q-G1, Q-G11); cluster questions handled by memoized_clusters
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

  # Group memoization for l1-advisory-process (15 questions — independently tracked)
  IF NOT l1_process_memoized:
    process_questions = {"Q-G4", "Q-G5", "Q-G6", "Q-G7", "Q-G10",
      "Q-G12", "Q-G13", "Q-G14", "Q-G16", "Q-G17", "Q-G18", "Q-G19", "Q-G26", "Q-G27", "Q-G28"}
    all_process_clean = all(l1_results.get(q, "PASS") in [PASS, N/A] for q in process_questions)
    IF all_process_clean:
      l1_process_memoized = true
      l1_process_memoized_since = pass_count
      newly_memoized.append("l1-advisory-process (15 questions)")
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
    # L1 per-pass count: 2 (l1-blocking) + 6 (l1-advisory-structural) + 15 (l1-advisory-process) = 23
    total_applicable_questions = 23 + sum(questions per active cluster) + (53 if IS_GAS else 0) + (38 if IS_NODE else 0) + (11 if HAS_UI else 0)
    # 53 = gas evaluate mode scope (Q43 is post-loop only, not evaluated in review-plan integration)
    # Conditional question decrements (per question-effectiveness-report.md 2026-04-10):
    # Q-C14 and Q-C32 are counted in the impact cluster sum above but evaluate N/A when
    # their gate flags are false. Subtract from denominator so memo coverage % reflects
    # actually-applicable questions for this run.
    IF "impact" in active_clusters AND NOT IS_GAS AND NOT HAS_EXISTING_INFRA:
      total_applicable_questions -= 1  # Q-C14 inactive this run
    IF "impact" in active_clusters AND NOT IS_GAS AND NOT IS_NODE AND NOT HAS_UNBOUNDED_DATA:
      total_applicable_questions -= 1  # Q-C32 inactive this run
  total_memo_count = len(memoized_l1_questions) + sum(questions in each memoized_cluster) + len(memoized_gas_questions) + len(memoized_node_questions)
  memo_pct = Math.round(100 * total_memo_count / total_applicable_questions)
  FOR threshold in [25, 50, 75]:
    IF memo_pct >= threshold AND threshold NOT in memo_milestones_printed:
      memo_milestones_printed.add(threshold)
      accel_label = IF threshold == 25: "picking up speed" ELSE IF threshold == 50: "accelerating" ELSE: "almost locked"
      filled = Math.round(10 * memo_pct / 100)
      progress_bar = "▰" × filled + "▱" × (10 - filled)
      Print: "  ╶─ Memo [threshold]%  [progress_bar]  [total_memo_count]/[total_applicable_questions]  [accel_label] ─╴"

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
    advisory_findings_cache,
    per_q_status_history
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

  # Phase-level timing breakdown
  dispatch_elapsed = ((fanin_start_time - dispatch_start_time) / 1000).toFixed(1)
  # apply_start_time is 0 when changes_to_apply == 0 (apply block was skipped entirely)
  fanin_elapsed = apply_start_time > 0 ? ((apply_start_time - fanin_start_time) / 1000).toFixed(1) : ((Date.now() - fanin_start_time) / 1000).toFixed(1)
  apply_elapsed = apply_start_time > 0 ? ((Date.now() - apply_start_time) / 1000).toFixed(1) : "—"
  pass_phase_timings.append({dispatch: dispatch_elapsed, fanin: fanin_elapsed, apply: apply_elapsed, total: pass_elapsed})

  # Pass summary dashboard
  Print: "──────────────────────────────────────────────────────"
  if not breakdown_parts:
    Print: "  Pass [pass_count]/5  [━ × (pass_count*2)][╌ × (10-pass_count*2)]  0 changes   [{pass_elapsed}s]"
  else:
    Print: "  Pass [pass_count]/5  [━ × (pass_count*2)][╌ × (10-pass_count*2)]  [changes_this_pass] changes   [{pass_elapsed}s]"
    Print: "            [join(breakdown_parts, '  ')]"
  Print: "  Timing    dispatch [dispatch_elapsed]s   fan-in [fanin_elapsed]s   apply [apply_elapsed]s"

  # Delta visualization (Enhancement C)
  IF pass_count == 1:
    Print: "  Delta     ✗[current_nu_count] need work"
  ELSE:
    prev_nu = needs_update_counts_per_pass[pass_count - 2]  # previous pass count
    delta = current_nu_count - prev_nu
    delta_str = IF delta < 0: "(↓[abs(delta)])" ELSE IF delta > 0: "(↑[delta])" ELSE: "(→0)"
    memo_count = len(memoized_l1_questions) + sum(questions in each memoized_cluster) + len(memoized_gas_questions) + len(memoized_node_questions)
    # Use question count (not cluster count) to match milestone math at total_memo_count computation
    Print: "  Delta     ✗[prev_nu]→[current_nu_count] [delta_str]                    🔒 [memo_count] locked"
    IF pass_count >= 3:
      trend_values = join(needs_update_counts_per_pass, " → ")
      last3 = needs_update_counts_per_pass[-3:]
      trend_arrow = IF last3[-1] < last3[0]: "↘ converging" ELSE IF last3[-1] > last3[0]: "↗ oscillating" ELSE: "→ flat"
      Print: "  Trend     [trend_values]  [trend_arrow]"

  # Compact gate health bar (Enhancement G)
  # Compute gate-level counts from current_needs_update_set for quick inline display
  gate1_open = count of NEEDS_UPDATE in current pass for Gate 1 questions
  gate2_open = count of NEEDS_UPDATE in current pass for Gate 2 questions
  gate3_noted = len(advisory_findings_cache)  # count of advisory notes (PASS-with-finding), not NEEDS_UPDATE
  gate1_sym = IF gate1_open == 0: "✅" ELSE: "❌[gate1_open]"
  gate2_sym = IF gate2_open == 0: "✅" ELSE: "⚠️[gate2_open]"
  IF pass_count >= 2:
    prev_gate2 = count of Gate 2 NEEDS_UPDATE from previous pass
    gate2_delta = gate2_open - prev_gate2
    IF gate2_delta != 0:
      gate2_sym += IF gate2_delta < 0: "↓[abs(gate2_delta)]" ELSE: "↑[gate2_delta]"
  gate1_label = IF gate1_open == 0: "clear" ELSE: "open"
  gate2_label = IF gate2_open == 0: "clear" ELSE: "open"
  Print: "  Gates     🔴 [gate1_sym] [gate1_label]   🟡 [gate2_sym] [gate2_label]   💡 [gate3_noted] noted"

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
  Print: "──────────────────────────────────────────────────────"
  Print: "  Evaluators"
  FOR line in evaluator_status_lines:
    Print: "    [line]"
  Print: "──────────────────────────────────────────────────────"

  Gate2_stable = (prev_needs_update_set == current_needs_update_set)  # set equality: order-independent; compare BEFORE updating prev
  prev_needs_update_set = new Set(current_needs_update_set)  # COPY — update AFTER Gate2_stable check; placed before CONVERGENCE CHECK so CONTINUE paths don't leave stale state

  -- PER-Q OSCILLATION DETECTION --
  # Track each question's status this pass. Detect oscillation pattern [X, Y, X] in last 3 passes.
  # Force oscillating Gate 2/3 questions to advisory (stop re-evaluating). Gate 1 exempt.
  # Guard: only spread evaluator result maps that exist for the current context.
  const all_q_results = {
    ...l1_results,
    ...(Object.keys(cluster_results).length > 0 ? Object.fromEntries(
      Object.values(cluster_results).flatMap(cr => Object.entries(cr).map(([qid, entry]) => [qid, entry.status || entry]))
    ) : {}),
    ...(IS_GAS ? gas_results : {}),
    ...(IS_NODE ? node_results : {}),
    ...(HAS_UI && ui_results ? Object.fromEntries(
      Object.entries(ui_results).map(([qid, entry]) => [qid, entry.status || entry])
    ) : {})
  }
  for (const [q_id, status] of Object.entries(all_q_results)) {
    if (!per_q_status_history[q_id]) per_q_status_history[q_id] = []
    per_q_status_history[q_id].push(status)
  }

  const oscillating_questions = new Set()
  if (pass_count >= 3) {
    for (const [q_id, history] of Object.entries(per_q_status_history)) {
      if (history.length >= 3) {
        const last3 = history.slice(-3)
        if (last3[0] === last3[2] && last3[0] !== last3[1]) {
          oscillating_questions.add(q_id)
        }
      }
    }
  }

  # Derive gate1_question_set from current mode for Gate 1 exemption
  IF IS_GAS:
    gate1_question_set = {"Q-G1", "Q-G11", "Q1", "Q2", "Q13", "Q15", "Q18", "Q42"}
  ELSE IF IS_NODE:
    gate1_question_set = {"Q-G1", "Q-G11", "Q-C3", "N1"}
  ELSE:
    gate1_question_set = {"Q-G1", "Q-G11", "Q-C3"}

  if (oscillating_questions.size > 0) {
    for (const q_id of oscillating_questions) {
      if (!gate1_question_set.has(q_id)) {
        current_needs_update_set.delete(q_id)
        advisory_findings_cache[q_id] = {
          "finding": `Oscillating (${per_q_status_history[q_id].slice(-3).join('→')}) — forced stable as advisory`,
          "source": "oscillation-detector"
        }
        print: "  ⚠️ ${q_id} oscillating (${per_q_status_history[q_id].slice(-3).join('→')}) — forced stable as advisory"
      } else {
        print: "  ⚠️ ${q_id} oscillating (Gate 1 — cannot force-stabilize, will continue looping)"
      }
    }
  }

  -- CONVERGENCE CHECK (gate-aware) --
  IF IS_GAS:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G11,
                       Q1, Q2, Q13, Q15, Q18, Q42
                       (Q-E1 and Q-E2 are N/A for IS_GAS; L2 cluster questions are N/A-superseded by gas-evaluator)
  ELSE IF IS_NODE:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G11, Q-C3,
                       N1
  ELSE:
    Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G11, Q-C3

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
    total_elapsed = Math.round((Date.now() - timestamp) / 1000)
    resolved_questions = pass1_needs_update_set - current_needs_update_set  # Q-IDs fixed since pass 1
    Print: "╔══════════════════════════════════════════════╗"
    Print: "║  🏁 CONVERGED                              ║"
    Print: "╚══════════════════════════════════════════════╝"
    Print: "  Passes    [pass_count]"
    Print: "  Duration  [total_elapsed]s"
    Print: "  Changes   [total_changes_all_passes] applied"
    IF resolved_questions is non-empty:
      Print: "  Resolved  [comma-separated resolved_questions sorted by ID]"
    Print: "  Gates     🔴 ✅   🟡 ✅ [count of Gate2 PASS]   💡 [count of Gate3 noted]"
    BREAK → proceed to "After Review Completes"
  -- END CHECK --

WHILE TRUE

-- Convergence complete. Proceed to "After Review Completes" below: epilogue (Q-E1, Q-E2) → Q-G9 → scorecard output → marker cleanup → teardown → STOP. --
```

**Self-referential protection:** Mark all additions with `<!-- review-plan -->` suffix.
Do not re-evaluate content already marked `<!-- review-plan -->`, `<!-- gas-plan -->`, or
`<!-- node-plan -->`. Canonical policy: `shared/self-referential-protection.md` — read at `~/.claude/skills/shared/self-referential-protection.md` (skip gracefully if not found).
If not found, use inline policy: mark all `<!-- skill-name -->` content as review metadata, not production code.

---

## Layer 1: General Quality

Question definitions are in QUESTIONS.md — evaluators read that file directly. Team-lead only
parses evaluator output (`Q-ID: PASS/NEEDS_UPDATE/N/A`). Q-G9 sub-questions follow below
(team-lead evaluates inline post-convergence).

L1 per-pass count: 23 questions (Q-G1, Q-G4 through Q-G7, Q-G10 through Q-G14, Q-G16 through Q-G28).
Count L1 edits → `l1_changes += count` (combined into `changes_this_pass` in Convergence Loop)

### Q-G9 Post-Convergence Organization Pass

*Runs once after the convergence loop exits. Not part of per-pass L1 evaluation.*
*L1 per-pass count stays at 23 (Q-G1, Q-G4 through Q-G7, Q-G10 through Q-G14, Q-G16 through Q-G28). Q-G9 is not included in*
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
concern clusters. Cluster-level triage activates/deactivates entire clusters based on Sonnet
pre-classification. Active clusters are listed in `active_clusters` computed in Step 0.

Count cluster edits → `cluster_changes_total += count` (combined into `changes_this_pass` in Convergence Loop)

---

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-C1 | Branching strategy | Branch named, merge target, PR workflow defined? Merge strategy specified (squash / rebase / merge commit)? Push-to-remote step included? | never |
| Q-C2 | Branching usage | Steps actually use feature branch + incremental commits? Commit messages follow project conventions (e.g. conventional commits)? | never |
| Q-C3 | Impact analysis | Other callers/features affected? Cross-ref call sites checked? | fully isolated |

## Layer 3: UI Specialization

Question definitions are in QUESTIONS-L3.md — ui-evaluator reads that file directly. 11 questions:
Q-U1 through Q-U9 plus Q-C17 and Q-C25 (merged from Client cluster). Active when HAS_UI=true.
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
| State (3) | **partially** — Q-C36 has no gas equivalent (evaluate via state cluster when "state" in ACTIVE_RISKS) | Q40, Q21, Q24, Q3 (for Q-C13/18/19/24) |
| Security (4) | **fully** | Q27, Q28, Q23; Q-C30→Q28, Q-C31→N/A isolated exec, Q-C33→Q8, Q-C34→Q22 |
| Operations (5) | **fully** | Q9, Q10, Q29, Q22, Q25; Q-C28 N/A (exec verification + Q6/Q12 cover GAS observability) |
| Client (6) | **merged into ui-evaluator** when HAS_UI=true; **fully superseded** by gas-evaluator Q32, Q33 when IS_GAS | Q32, Q33 |

Result: When IS_GAS=true, skip ALL cluster evaluators EXCEPT Impact cluster (always active — Q-C26/Q-C35/Q-C37/Q-C38/Q-C39/Q-C40
have no gas equivalent) and State cluster when "state" in ACTIVE_RISKS (Q-C36 has no gas equivalent; Q-C13/18/19/24 → N/A-superseded).
Q-C17 and Q-C25 are handled by ui-evaluator when HAS_UI=true (not a separate cluster evaluator). Mark all other IS_GAS-superseded questions N/A-superseded in the scorecard.

**IS_NODE Individual Suppressions (7 questions span multiple clusters):**
Cluster-level suppression does not apply for IS_NODE. Mark these 7 questions N/A-superseded
within their respective cluster evaluators when IS_NODE=true:
  Q-C16 (Security cluster, →N6), Q-C18 (State cluster, →N8),
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
above). The ui-evaluator reads QUESTIONS-L3.md (not the full QUESTIONS.md) and covers 11 questions:
Q-U1 through Q-U9 (UI specialization) plus Q-C17 and Q-C25 (merged from Client cluster). This means:
- ui-designer runs a SINGLE evaluation pass (no internal convergence loop)
- Writes all 11-question findings (Q-U1 through Q-U9, Q-C17, Q-C25) to a JSON file in RESULTS_DIR
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
-- Compute Rating from gate-level counts --
# gate2_open: count of Gate 2 NEEDS_UPDATE questions (NOT Gate 3 — advisories do not affect rating)
# Gate1_unresolved: computed in CONVERGENCE CHECK above
IF Gate1_unresolved > 0:
  Rating = "🔴 REWORK"
  criterion_phrase = "[Gate1_unresolved] Gate 1 blocking issue(s)"
ELIF gate2_open == 0:
  Rating = "🟢 READY"
  criterion_phrase = "all gates clear"
ELIF gate2_open <= 3:
  Rating = "🟡 SOLID"
  criterion_phrase = "[gate2_open] Gate 2 advisory issue(s)"
ELSE:
  Rating = "🟠 GAPS"
  criterion_phrase = "[gate2_open] Gate 2 issue(s) — review recommended"

╔═══════════════════════════════════╗
║  review-plan Scorecard — Pass [N] ║
╚═══════════════════════════════════╝

-- Compute health_bar from Rating --
IF Rating == "🟢 READY":   health_bar = "██████ ██████ ██████ ██████ ██████ ██████"
ELIF Rating == "🟡 SOLID":  health_bar = "██████ ██████ ██████ ██████ ░░░░░░ ░░░░░░"
ELIF Rating == "🟠 GAPS":   health_bar = "██████ ██████ ░░░░░░ ░░░░░░ ░░░░░░ ░░░░░░"
ELIF Rating == "🔴 REWORK": health_bar = "░░░░░░ ░░░░░░ ░░░░░░ ░░░░░░ ░░░░░░ ░░░░░░"

╔══════════════════════════════════════════════════════╗
║                                                      ║
║      [health_bar]       ║
║                                                      ║
║          review-plan Scorecard                        ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
  Pass [N]   Rating: [EMOJI] [RATING]
  [criterion phrase]

┌──────────────────────────────────────────────────────┐
│  Gate Health                                          │
└──────────────────────────────────────────────────────┘
  🔴 Gate 1  Blocking      [✅ M/M clear] or [❌ n open (M clear)]
  🟡 Gate 2  Important     [✅ M/M clear] or [⚠️ n open (M clear)]
  💡 Gate 3  Advisory      [n] noted

  🔴 Gate 1 — Blocking ([M] applicable)
  ─────────────────────────────────────
  [list only PASS and NEEDS_UPDATE questions — omit N/A items]
  [indent 4 spaces, three-column layout: status icon, name, Q-ID right-aligned:]
    ✅  [Question short name]              [Q-ID]
    ❌  [Question short name]              [Q-ID]

  🟡 Gate 2 — Important ([M] applicable)
  ─────────────────────────────────────
  [list only PASS and NEEDS_UPDATE questions — omit N/A items]
    ✅  [Question short name]              [Q-ID]
    ⚠️  [Question short name]              [Q-ID]

  💡 Gate 3 — Advisory ([M] applicable)
  ─────────────────────────────────────
  [list only flagged advisory questions — omit N/A and non-flagged PASS]
    💡  [Question short name]              [Q-ID]
        [finding — first sentence, ≤15 words]

  Example rendered:
    💡  Feedback loop completeness         Q-G25
        manual verification present, no stated pass condition
    💡  Proportionality                    Q-G23
        Phase 3 step count is dense for a config-level change

  Note: Read advisory finding text from `advisory_findings_cache[q_id].finding` (persists across memoized passes) rather than only from current-pass evaluator data.

[Only render the following specialization sections when the corresponding flag is TRUE.
 Omit the section entirely when the flag is false — do NOT write "NOT INVOKED" placeholders.]

  GAS Specialization                    ← render only when IS_GAS=true
  ─────────────────────────────────────
    ✅  [M] questions — [P] PASS, [K] N/A (converged pass [N])
    OR
    ⚠️  [N] NEEDS_UPDATE remaining ([M] questions, [K] N/A)

  Node Specialization                   ← render only when IS_NODE=true
  ─────────────────────────────────────
    ✅  [M] questions — [P] PASS, [K] N/A (converged pass [N])
    OR
    ⚠️  [N] NEEDS_UPDATE remaining ([M] questions, [K] N/A)

  UI Specialization                     ← render only when HAS_UI=true
  ─────────────────────────────────────
    [list only PASS and NEEDS_UPDATE UI questions — omit N/A items]
    ✅  [Question short name]              [Q-ID]
    ⚠️  [Question short name]              [Q-ID]

  Organization Quality (Q-G9)           ← render only when plan has >= 3 implementation steps
  ─────────────────────────────────────
    ✅  [N]/6 sub-questions clean
    OR
    ⚠️  [N]/6 — [K] flagged:
    [list only flagged sub-questions — omit PASS items]
      ❌  [sub-question name]              [Q-G9x]

  Triaged N/A                           ← omit entirely if total N/A count across all gates == 0
  ─────────────────────────────────────
  IF K <= 5:
    [K] questions skipped:
      [Question name] ([Q-ID]): [one-phrase reason]
  IF K > 5:
    [K] questions skipped ([N] GAS-superseded, [M] flag-inactive, [P] scope-inapplicable)
    [list only N/A questions that are NOT from a fully-superseded cluster or fully-inactive flag:]
      [Question name] ([Q-ID]): [one-phrase reason]
  [Note: Q-G9 is skipped at the section level when plan has < 3 steps — do not list it here as individual N/A items]

  Review History                          ← omit if pass_count == 1 (single-pass convergence)
  ─────────────────────────────────────────────────────────────────────────
  Pass │ Changes │ Memo      │ Gate 1   │ Gate 2   │ Time │ Phases
  ─────┼─────────┼───────────┼──────────┼──────────┼──────┼────────────────
  [for each pass N from 1 to pass_count:]
  [N]  │  [changes_this_pass]  │ [memo_count]/[total_applicable_questions] │ [gate1_open] open or ✅ │ [gate2_open] open or ✅ │ [pass_durations[N-1]]s │ [dispatch_Ns]/[fanin_Ns]/[apply_Ns]
  ─────┴─────────┴───────────┴──────────┴──────────┴──────┴────────────────
  Total: [pass_count] passes   [total_changes_all_passes] changes   [total_elapsed]s

  Changes from needs_update_counts_per_pass difference (pass N changes = changes applied that pass).
  Memoized = locked question count at end of that pass.
  Gate 1/Gate 2 open counts from needs_update_counts_per_pass breakdown.
  Duration from pass_durations[N-1]. Timing from pass_phase_timings[N-1].

  Efficiency                              ← omit if pass_count == 1
  ─────────────────────────────────────
    Spawned    [evaluators_spawned_total] evaluators / [pass_count] passes
    Skipped    [total memoized evaluator-passes] (memoized)
    Coverage   [pct]%  [▰ × filled][▱ × empty]  [locked_questions]/[total_applicable_questions]

  Memoized evaluator-passes = sum of evaluators NOT spawned each pass due to memoization.
  Memo coverage = 100 * locked_questions / total_applicable_questions at final pass.

  📊 Prompt Improvement Recommendations  ← always rendered (even when "None")
  ─────────────────────────────────────
    ▸ [signal label]: [recommendation ≤25 words]
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
   and the interactive prompt (step 8). Do not re-run the REWORK check here.

2. **Boilerplate epilogue (Q-E1, Q-E2)** — one-time injection, **parallel**:
   Print: "╔══════════════════════════════════════════════╗"
   Print: "║  ◆ EPILOGUE                                 ║"
   Print: "╚══════════════════════════════════════════════╝"

   **Q-E1 + Q-E2: Parallel epilogue evaluation**

   Spawn Q-E1 and Q-E2 as two parallel Tasks in a SINGLE message:

   ```
   epilogue_e2 = Task(
     subagent_type = "general-purpose",
     prompt = """
       Read the plan at <plan_path>.
       IS_GAS = <IS_GAS>

       Evaluate Q-E2 (Post-implementation workflow):
       IF NOT IS_GAS:
         Scan plan for "## Post-Implementation Workflow" section (or equivalent heading).
         IF section absent entirely:
           Output: "NEEDS_INJECT: full_section"
         ELSE IF section present but missing step 4 (fail-fix-rerun cycle):
           Output: "NEEDS_INJECT: step_4_only"
         ELSE:
           Output: "PASS"
       ELSE:
         Output: "N/A"
     """
   )

   epilogue_e1 = Task(
     subagent_type = "general-purpose",
     prompt = """
       Read the plan at <plan_path>.
       IS_GAS = <IS_GAS>

       Evaluate Q-E1 (Git lifecycle):
       IF NOT IS_GAS:
         Scan plan for: (a) named feature branch, (b) per-phase git add+commit,
                         (c) push-to-remote, (d) merge/PR to main.
         Output: "MISSING: [comma-separated list of a-d not found]" or "PASS"
       ELSE:
         Output: "N/A"
     """
   )
   ```

   Parse results from both Tasks. Apply any injections sequentially after both complete:
   - Q-E2 NEEDS_INJECT → inject Post-Implementation Workflow section. Mark <!-- review-plan -->.
   - Q-E1 MISSING → inject missing git elements. Mark <!-- review-plan -->.
   - Both N/A → skip injection.

   Print status for each:
     "  Q-E1  Git lifecycle                    ✅ [injected/present] | —  N/A"
     "  Q-E2  Post-implementation workflow     ✅ [injected/present] | —  N/A"

   Insert epilogue results into findings for scorecard:
   `findings["Q-E1"] = {"status": epilogue_q_e1, "gate": 1}`
   `findings["Q-E2"] = {"status": epilogue_q_e2, "gate": 1}`

3. **Q-G9 organization pass** (post-convergence structural check, inline):
   Print: "╔══════════════════════════════════════════════╗"
   Print: "║  ◆ ORGANIZE                           Q-G9  ║"
   Print: "╚══════════════════════════════════════════════╝"
   Print: "  Structural organization check on finalized plan"
   N/A if plan has fewer than 3 implementation steps — skip this step entirely.
   Evaluate Q-G9 inline as specified in the "Q-G9 Post-Convergence Organization Pass"
   subsection in Layer 1 (no Task spawn — team-lead evaluates directly). Apply any NEEDS_UPDATE
   edits immediately. Q-G9 results will be included in the scorecard output in step 4.
   **Why after epilogue:** Q-G9 checks structural organization (sequential clarity, checkpoint
   visibility). Git commit steps and post-impl section are structural elements Q-G9 should see.

4. Print: "╔══════════════════════════════════════════════╗"
   Print: "║  ◆ SCORECARD                                ║"
   Print: "╚══════════════════════════════════════════════╝"
   Print: "  >> Compiling final scorecard from all evaluator findings"
   **Output the final scorecard** (incorporating epilogue Q-E1/Q-E2 and Q-G9 results). See
   "Output: Unified Scorecard" section for the full template. Include the "Organization Quality
   (Q-G9)" section when Q-G9 ran (plan had >= 3 implementation steps). Include Q-E1 and Q-E2
   in the Gate 1 section of the scorecard.

5. **Meta-Reflection Pass** (inline, no agent spawn):
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
   | Question flip-flop | `needs_update_counts_per_pass`: same Q-ID alternates PASS→NEEDS_UPDATE→PASS (or reverse) across 3 consecutive passes | Any Q-ID has ≥2 status transitions in 3 passes | "[Q-ID] flip-flopped across passes — edit instruction may create a condition that triggers another question's NEEDS_UPDATE; add mutual-exclusion guard" |

   **Distinction from "unresolved across 3+ passes" signal:** That signal catches persistent NEEDS_UPDATE (stuck). Flip-flop catches oscillation (unstable) — the fix creates a new problem that undoes the fix.

   **Rules:**
   - Generate 0–5 recommendations (fewer is better — only surface real signals)
   - Skip signals that only apply to REVIEW_TIER=TRIVIAL plans
   - Do NOT recommend changes that would alter Gate 1 blocking status
   - Each recommendation format: `[Signal label]: [recommendation ≤25 words]`
   - If no signals fire, output: `None — prompt appears well-calibrated for this plan type`

   Print the `📊 Prompt Improvement Recommendations` section immediately after the scorecard:
   ```
   📊 Prompt Improvement Recommendations
   ─────────────────────────────────────
     ▸ [signal label]: [recommendation ≤25 words]
     ...
     — or —
     None — prompt appears well-calibrated for this plan type
   ```

   **Actionable follow-up (conditional — only if ≥1 signal fired):**

   IF any signals fired above:
     Analyze the fired signals and determine the single highest-impact skill change.
     Categorize it:
       - QUESTION_EDIT: an existing question's criteria needs refinement
         → "Run `/optimize-questions [Q-ID]` to refine criteria"
       - QUESTION_NEW: a gap in coverage was detected
         → "Add a new question covering [topic] to QUESTIONS.md"
       - EDIT_TEMPLATE: an injection or edit instruction is too weak
         → "Strengthen edit template for [Q-ID] in SKILL.md"
       - SIGNAL_NOISE: a signal fires too often without actionable output
         → "Consider raising threshold or adding scoping condition for [signal]"

     Print:
     ```
     🔧 Recommended Skill Improvement
     ─────────────────────────────────
       Category: [QUESTION_EDIT | QUESTION_NEW | EDIT_TEMPLATE | SIGNAL_NOISE]
       Target:   [Q-ID or signal name]
       Action:   [one-sentence recommendation with specific slash command or file to edit]
       Why:      [which signal(s) drove this, ≤15 words]
     ```

   ELSE:
     Do not print the recommendation block (the "None" line from the signals section is sufficient).

6. **Cleanup and teardown** (parallel — no dependencies between these): In a SINGLE message, run all three:
   a. **Marker cleanup:** Use the Edit tool with `replace_all=true` on the plan file to
      strip all self-referential markers that served their purpose during the convergence loop
      (including any added by the epilogue in step 2 and Q-G9 in step 3):
      - `" <!-- review-plan -->"` → `""` (remove)
      - `" <!-- gas-plan -->"` → `""` (remove)
      - `" <!-- node-plan -->"` → `""` (remove)
      This delivers a clean plan file to the user for implementation (no stray HTML comments).
      Only strip the markers — do not remove the content they annotated.
   b. **Gate file:** Written in step 8 when the user confirms exit — not here.
      (Deferring ensures no stale gate file exists if the user chooses "Continue editing" in step 8.)
   c. **File teardown:** Use the Bash tool to run:
      ```
      rm -f <memo_file> && rm -rf "$RESULTS_DIR"
      ```
      First command removes the convergence checkpoint (no longer needed after loop exits).
      Second command removes the temp results directory.

7. **Remaining issues summary (non-READY ratings):**
   ```
   IF Rating == READY:
     No issues to print — proceed directly to step 8
   IF Rating == SOLID or GAPS:
     Print: "┌──────────────────────────────────────────────────────┐"
     Print: "│  ℹ️ [N] Gate 2 issues remaining (not blocking)         │"
     Print: "└──────────────────────────────────────────────────────┘"
     For each remaining Gate 2 NEEDS_UPDATE question:
       Print: "  ⚠️  [question short name] ([ID])"
       Print: "     [one-sentence summary of finding]"
     Print: "──────────────────────────────────────────────────────"
     # Fall through to step 8 — user decides whether to proceed or keep editing
   IF Rating == REWORK:
     Print: "╔══════════════════════════════════════════════════════╗"
     Print: "║  🔴 [N] Gate 1 issues remaining — BLOCKING            ║"
     Print: "╚══════════════════════════════════════════════════════╝"
     For each remaining Gate 1 NEEDS_UPDATE question:
       Print: "  ❌  [question short name] ([ID])"
       Print: "     [one-sentence summary of finding]"
     Print: "══════════════════════════════════════════════════════"
     # Fall through to step 8 — user must describe fixes; ExitPlanMode blocked until READY/SOLID/GAPS
   ```

8. **Interactive completion prompt.** After every review pass (all tiers), ask the user what to do next:
   ```
   IF Rating == READY:
     AskUserQuestion(
       question = "Plan is READY — all checks pass. Proceed to implementation, or make further changes?",
       options = ["Exit to implementation", "Continue editing"]
     )
   IF Rating == SOLID or GAPS:
     AskUserQuestion(
       question = "Plan has [N] non-blocking issue(s). Proceed to implementation anyway, or continue editing?",
       options = ["Exit to implementation (proceed with warnings)", "Continue editing"]
     )
   IF Rating == REWORK:
     AskUserQuestion(
       question = "Gate 1 issues block exit. Describe the changes you want to make, or abandon.",
       options = ["Describe changes", "Abandon review"]
     )

   IF user chooses to exit (first option for READY/SOLID/GAPS):
     Write gate file: Bash "echo '<plan_path>' > /tmp/.review-ready-${plan_slug}"
     # Gate file written here — after user confirms — so no stale file exists during editing cycles.
     # Do NOT delete the gate file — the ExitPlanMode PostToolUse hook removes it after successful exit.
     ExitPlanMode(allowedPrompts=[{tool:"Bash",prompt:"run tests"},{tool:"Bash",prompt:"run build"},{tool:"Bash",prompt:"run linter"},{tool:"Bash",prompt:"git add and commit"},{tool:"Bash",prompt:"git status"},{tool:"Bash",prompt:"git diff"},{tool:"Bash",prompt:"git push to remote"}])

   IF user chooses to continue editing (or is in REWORK and describes changes):
     Apply the user's requested changes to the plan file.
     Re-run review from Step 3 (re-classify and re-evaluate — do not skip the classifier).
     # This loop repeats until user confirms exit or abandons. No hard cap — user controls termination.

   IF user chooses "Abandon review" (REWORK only):
     Print: "Review abandoned. Plan is unchanged and still has Gate 1 issues."
     Print: "You remain in plan mode — make changes and run /review-plan again when ready."
     STOP  # ExitPlanMode is NOT called — user stays in plan mode to fix or manually exit
   ```
