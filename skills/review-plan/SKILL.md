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

3. **Set context flags** (scan plan text for patterns):
   ```
   IS_GAS = any of: .gs refs | mcp__gas__ | scriptId | SpreadsheetApp | DriveApp |
            GmailApp | ScriptApp | HtmlService | __events__ | __global__ |
            google.script.run | createGasServer | appsscript.json | "Apps Script" |
            "Google Apps Script"

   IS_NODE = (NOT IS_GAS) AND any of: package.json | tsconfig.json | .ts refs |
             npm | yarn | pnpm | bun | Express | Fastify | NestJS | Next.js |
             TypeScript | "Node.js" | jest | vitest | mocha | webpack | esbuild |
             tsc | node_modules

   HAS_UI = any of: sidebar | dialog | HTML | CSS | UI | frontend | client-side

   [future: IS_SEC, HAS_API]
   ```

4. **Initialize tracking:**
   ```
   pass_count = 0
   timestamp = Date.now()
   ```

5. **Team setup (IS_GAS or IS_NODE):**
   ```
   IF IS_GAS OR IS_NODE:
     team_name = "review-plan-" + timestamp
     TeamCreate({team_name, description: "review-plan — parallel L1/L2/ecosystem evaluators"})
   ```

6. **Error handling:** Wrap the entire convergence loop:
   ```
   IF any unrecoverable error during convergence loop:
     IF IS_GAS OR IS_NODE: Send shutdown_request to any active evaluators, then TeamDelete
     Surface error to user via AskUserQuestion
     Do NOT leave orphaned team processes.
   ```

---

## Convergence Loop

### Mode: IS_GAS or IS_NODE (Team mode — 3 parallel evaluators per pass)

```
DO:
  pass_count += 1
  changes_this_pass = 0
  l1_changes = 0
  l2_changes = 0
  gas_plan_changes = 0
  node_plan_changes = 0

  Print: "Pass [pass_count/5]: evaluating..."

  [In a SINGLE message, spawn 3 parallel Task calls]:

  --- L1 Evaluator ---
  Task(
    subagent_type = "general-purpose",
    team_name = <team_name>,
    name = "l1-evaluator",
    prompt = """
      You are evaluating a plan for general quality (Layer 1: 8 questions).

      Plan file: <plan_path> — read it with the Read tool
      Question definitions: Read ~/.claude/skills/review-plan/SKILL.md (Layer 1 section)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ALL L1 questions: Q-G1, Q-G2, Q-G3, Q-G4, Q-G5, Q-G6, Q-G7, Q-G8
      Apply triage (mark N/A per the N/A column).
      Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
      or <!-- node-plan -->.

      Output contract — send ONE message to team-lead:
        FINDINGS FROM l1-evaluator
        Q-G1: PASS | NEEDS_UPDATE | N/A — [finding]
        [EDIT: instruction if NEEDS_UPDATE]
        Q-G2: ...
        ... (all 8 questions)

      Constraints:
      - Do NOT use Edit, Write, or Bash tools — read-only
      - Do NOT call ExitPlanMode or touch marker files
      - Send exactly ONE message to team-lead
    """
  )

  --- L2 Evaluator ---
  Task(
    subagent_type = "general-purpose",
    team_name = <team_name>,
    name = "l2-evaluator",
    prompt = """
      You are evaluating a plan for code change quality (Layer 2: 25 questions).

      Plan file: <plan_path> — read it with the Read tool
      Question definitions: Read ~/.claude/skills/review-plan/SKILL.md (Layer 2 section)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ALL L2 questions: Q-C1 through Q-C25
      Apply triage shortcuts (bulk N/A per the triage table in the SKILL.md).
      Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
      or <!-- node-plan -->.

      Output contract — send ONE message to team-lead:
        FINDINGS FROM l2-evaluator
        Q-C1: PASS | NEEDS_UPDATE | N/A — [finding]
        [EDIT: instruction if NEEDS_UPDATE]
        Q-C2: ...
        ... (all 25 questions)

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

        You are the gas-evaluator running inside review-plan's team. Evaluate the plan for GAS
        specialization (all 42 GAS questions, both perspectives). Return findings via SendMessage
        to team-lead.

        Do NOT edit the plan. Do NOT touch .plan-reviewed. Do NOT call ExitPlanMode.
      """
    )
  ELSE (IS_NODE):
    --- Node Evaluator ---
    Task(
      subagent_type = "node-plan",
      team_name = <team_name>,
      name = "node-evaluator",
      prompt = """
        Review plan at <plan_path>. mode=evaluate.

        You are the node-evaluator running inside review-plan's team. Evaluate the plan for
        Node.js/TypeScript specialization (all 35 Node questions, both perspectives). Return
        findings via SendMessage to team-lead.

        Do NOT edit the plan. Do NOT touch .plan-reviewed. Do NOT call ExitPlanMode.
      """
    )

  Wait for all 3 evaluator messages (90s reminder; after 120s mark ⚠️ Evaluator Incomplete for
  any non-responding evaluator and proceed with available findings).

  -- Merge & Apply --
  COLLECT all NEEDS_UPDATE findings from L1, L2, and ecosystem evaluator messages
  IF IS_GAS:
    Remove true duplicates (same concern raised by both L2 and gas-evaluator — keep
    gas-evaluator's more specific GAS framing)
  IF IS_NODE:
    Remove true duplicates (same concern raised by both L2 and node-evaluator — keep
    node-evaluator's more specific Node/TS framing)
  APPLY all NEEDS_UPDATE edits to plan; mark <!-- review-plan -->
  CONSOLIDATE: merge overlapping findings, remove duplicate annotations
  REGRESSION CHECK: before RE-READ, verify no key flow, corner case, or condition was
    removed during this pass — restore any dropped logic and annotate <!-- keep: [reason] -->
  RE-READ the full consolidated plan

  l1_changes = count of L1 NEEDS_UPDATE edits applied
  l2_changes = count of L2 NEEDS_UPDATE edits applied
  IF IS_GAS: gas_plan_changes = count of gas-evaluator NEEDS_UPDATE edits applied
  IF IS_NODE: node_plan_changes = count of node-evaluator NEEDS_UPDATE edits applied
  changes_this_pass = l1_changes + l2_changes + gas_plan_changes + node_plan_changes

  Print: "Pass [pass_count] complete — [changes_this_pass] changes  (L1: [l1_changes], L2: [l2_changes], gas-plan: [gas_plan_changes] | node-plan: [node_plan_changes])"

WHILE changes_this_pass > 0 AND pass_count < 5

OUTPUT final scorecard
(Teardown and ExitPlanMode handled in "After Review Completes" section below.)
```

### Mode: non-GAS (Simple mode — L1 inline + L2 Task per pass)

```
DO:
  pass_count += 1
  changes_this_pass = 0
  l1_changes = 0
  l2_changes = 0

  Print: "Pass [pass_count/5]: evaluating..."

  [ Layer 1: Evaluate inline ]
  Evaluate all 8 L1 questions yourself (fast — no agent overhead for 8 questions).
  Apply triage (mark N/A per the N/A column).
  Skip content marked <!-- review-plan --> or <!-- gas-plan --> or <!-- node-plan -->.
  IF any NEEDS_UPDATE: edit plan, mark <!-- review-plan -->
  l1_changes = count of L1 edits
  changes_this_pass += l1_changes

  [In a SINGLE message, spawn 1 parallel Task call]:

  --- L2 Evaluator ---
  Task(
    subagent_type = "general-purpose",
    prompt = """
      You are evaluating a plan for code change quality (Layer 2: 25 questions).

      Plan file: <plan_path> — read it with the Read tool
      Question definitions: Read ~/.claude/skills/review-plan/SKILL.md (Layer 2 section)
      Standards: Read ~/.claude/CLAUDE.md as needed

      Evaluate ALL L2 questions: Q-C1 through Q-C25
      Apply triage shortcuts (bulk N/A per the triage table).
      Self-referential protection: skip content marked <!-- review-plan --> or <!-- gas-plan -->
      or <!-- node-plan -->.

      Return your findings as a plain text list (not via SendMessage — no team in non-GAS mode):
        Q-C1: PASS | NEEDS_UPDATE | N/A — [finding]
        [EDIT: instruction if NEEDS_UPDATE]
        ... (all 25 questions)
    """
  )

  Wait for L2 evaluator result.

  APPLY all L2 NEEDS_UPDATE edits to plan; mark <!-- review-plan -->
  CONSOLIDATE: merge overlapping findings, remove duplicate annotations
  REGRESSION CHECK: before RE-READ, verify no key flow, corner case, or condition was
    removed during this pass — restore any dropped logic and annotate <!-- keep: [reason] -->
  RE-READ the full consolidated plan

  l2_changes = count of L2 NEEDS_UPDATE edits applied
  changes_this_pass += l2_changes

  Print: "Pass [pass_count] complete — [changes_this_pass] changes  (L1: [l1_changes], L2: [l2_changes])"

WHILE changes_this_pass > 0 AND pass_count < 5

OUTPUT final scorecard
(no team teardown needed in simple mode)
```

**Self-referential protection:** Mark all additions with `<!-- review-plan -->` suffix.
Do NOT re-evaluate content already marked `<!-- review-plan -->`, `<!-- gas-plan -->`, or
`<!-- node-plan -->`.

---

## Layer 1: General Quality

*8 questions. Applies to every plan, every domain.*

For each question: evaluate → **PASS** / **NEEDS_UPDATE** / **N/A**
- PASS: criterion is met
- NEEDS_UPDATE: criterion is missing or incomplete → edit the plan, mark `<!-- review-plan -->`
- N/A: see N/A column

**Gate 1 — Blocking (weight 3):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G1 | Approach soundness | Right solution? Simpler alternatives considered? Not over/under-engineered? | never |
| Q-G2 | Standards compliance | Follows CLAUDE.md directives and MEMORY.md conventions? | never |
| Q-G3 | Quality review changes | Plan includes an explicit step to quality review all changes after implementation? Use `/review-fix` (general/Node), `/gas-review` (GAS). Step must be named "quality review changes" or equivalent, placed after **all** code changes are applied, and not bundled with or before implementation steps. | never |

**Gate 2 — Important (weight 2):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G4 | Unintended consequences | Side effects: broken workflows, behavior changes, regressions, security shifts? | trivial isolated change |
| Q-G5 | Scope focus | Plan stays on target, no scope creep? | never |
| Q-G8 | Agent teams & Task usage | Does the plan make maximal use of agent teams and parallel Task calls for independent work? Flag: sequential steps that could run in parallel, missing TeamCreate for multi-agent coordination, evaluations that could be parallelized, or sub-tasks that would benefit from specialized subagents. | plan involves only a single atomic change with no parallelizable steps |

**Gate 3 — Advisory (weight 1):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G6 | Naming consistency | New identifiers follow codebase conventions? | no new names |
| Q-G7 | Documentation | MEMORY.md / CLAUDE.md / README affected by this change? | no behavior changes |

Count L1 edits → `l1_changes += count`; `changes_this_pass += l1_changes`

---

## Layer 2: Code Change Quality

*25 questions. Applies to every plan (code changes assumed).*

**Triage shortcuts — mark N/A proactively:**
- no UI/client logic → N/A Q-C17, Q-C25
- no deployment → N/A Q-C6, Q-C7
- single atomic change → N/A Q-C5, Q-C9
- read-only ops → N/A Q-C18, Q-C19
- no new APIs/services → N/A Q-C22, Q-C23
- local-only changes → N/A Q-C24

**Gate 1 — Blocking (weight 3):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-C1 | Branching strategy | Branch named, merge target, PR workflow defined? | never |
| Q-C2 | Branching usage | Steps actually use feature branch + incremental commits? | never |
| Q-C3 | Impact analysis | Other callers/features affected? Cross-ref call sites checked? | fully isolated |

**Gate 2 — Important (weight 2):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-C4 | Tests updated | Interface/bug/new-function changes have matching test updates? | pure visual |
| Q-C5 | Incremental verification | Each step has a checkpoint (not all-testing-at-end)? | single atomic |
| Q-C6 | Deployment defined | Push steps, target env, verification specified? | local-only |
| Q-C7 | Rollback plan | Recovery path if deployment fails? | no deployment |
| Q-C8 | Interface consistency | Modified signatures consistent with siblings; callers updated? | no sig changes |
| Q-C9 | Step ordering | Explicit DAG; no refs to uncreated files, no deploy-before-push? | single step |
| Q-C10 | Empty code | No stubs/TODOs without full spec (phased OK if explicit)? | no placeholders |
| Q-C11 | Dead code | Old implementations marked for removal? | nothing replaced |
| Q-C12 | Duplication | No reimplementation of existing utilities? | no new functions |
| Q-C13 | State edge cases | State-exists AND state-absent cases covered for persistent storage? | no storage |
| Q-C14 | Bolt-on vs integrated | New code extends existing modules; not isolated additions? | purely additive |
| Q-C15 | Input validation | Untrusted inputs sanitized at trust boundaries? | no untrusted input |
| Q-C16 | Error handling | Try/catch on external calls; actionable messages; fail-loud noted? | no new error paths |
| Q-C17 | Event listener cleanup | Listeners removed to prevent accumulation/leaks? | no new listeners |
| Q-C18 | Concurrency | Shared state locked; background tasks have concurrency plan? | read-only |
| Q-C19 | Idempotency | Operations safe to retry; data mutations deduped? | read-only |
| Q-C20 | Logging | Informative but compact; no sensitive data? | no server changes |
| Q-C21 | Runtime constraints | Execution time/memory/platform limits addressed? Unbounded ops chunked? | bounded ops |
| Q-C22 | Auth/permission additions | New scopes or permissions noted with user impact? | no new services |
| Q-C24 | Local↔remote sync | Sync strategy explicit for local→remote pushes? Stale reads avoided? | local-only |

**Gate 3 — Advisory (weight 1):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-C23 | External rate limits | API quotas/throttling accounted for? | no new API calls |
| Q-C25 | UI error boundary | Client-side error handler for silent failures? (window.onerror, try/catch around init) | no new client logic |

Count L2 edits → `l2_changes += count`; `changes_this_pass += l2_changes`

---

## Key Questions: Sub-Skill Invocations

### Q-GAS / Q-NODE: Ecosystem Specialization

In IS_GAS mode, gas-plan runs as part of the parallel evaluator team each pass (see Convergence
Loop above). The gas-evaluator Task is spawned with `mode=evaluate`, which means:
- gas-plan runs a SINGLE evaluation pass (no internal convergence loop)
- Returns all 42-question findings via SendMessage to team-lead
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence

In IS_NODE mode (mutually exclusive with IS_GAS), node-plan runs as part of the parallel
evaluator team each pass. The node-evaluator Task is spawned with `mode=evaluate`, which means:
- node-plan runs a SINGLE evaluation pass (no internal convergence loop)
- Returns all 35-question findings via SendMessage to team-lead
- Does NOT edit the plan or call ExitPlanMode
- The outer review-plan loop handles convergence

In neither-GAS-nor-Node mode, no ecosystem evaluator is invoked (simple mode).

**Deduplication (IS_GAS):** After collecting gas-evaluator findings, remove true duplicates
where both L2 and gas-evaluator flag the same concern. Keep gas-plan's more specific GAS
framing where both are present.

**Deduplication (IS_NODE):** After collecting node-evaluator findings, remove true duplicates
where both L2 and node-evaluator flag the same concern. Keep node-plan's more specific Node/TS
framing where both are present.

### Q-SEC, Q-UI (future)
Reserved slots — follow same pattern as Q-GAS / Q-NODE when implemented.

---

## Exit Criteria

**Converge** when ANY of:
- `changes_this_pass == 0` (all layers + sub-skills quiet in same pass)
- `pass_count == 5` (max reached)

---

## Output: Unified Scorecard

```
## review-plan Scorecard

### Passes: [N] (converged / max reached)

### Gate 1 — Blocking
[PASS] or [N NEEDS_UPDATE remaining]
- Q-G1 Approach soundness: [status]
- Q-G2 Standards compliance: [status]
- Q-G3 Quality review changes: [status]
- Q-C1 Branching strategy: [status]
- Q-C2 Branching usage: [status]
- Q-C3 Impact analysis: [status]

### Gate 2 — Important
[PASS] or [N NEEDS_UPDATE remaining]
[list applicable questions with status]

### Gate 3 — Advisory
[N noted]
[list applicable questions]

### GAS Specialization (gas-plan)
[NOT INVOKED — no GAS patterns detected]
OR
[PASS — converged after N gas-plan passes]
OR
[N NEEDS_UPDATE remaining]

### Node Specialization (node-plan)
[NOT INVOKED — no Node.js/TypeScript patterns detected]
OR
[PASS — converged after N node-plan passes]
OR
[N NEEDS_UPDATE remaining]

### Rating
READY   — Gate 1 + Gate 2 all PASS
SOLID   — Gate 1 PASS, ≤ 2 Gate 2 NEEDS_UPDATE
GAPS    — Gate 1 PASS, > 2 Gate 2 NEEDS_UPDATE
REWORK  — any Gate 1 NEEDS_UPDATE

### Post-convergence Quality Check
[Pending — review-fix Task spawned after scorecard]
OR
[CLEAN — no Critical findings]
OR
[N Critical applied, M Advisory noted]
```

---

## After Review Completes

After outputting the Final Scorecard:

1. **Post-convergence quality review (separate Task context):**
   Spawn a review-fix Task on the plan file in its own context — clean of convergence
   history, focused only on the final plan state:
   ```
   Task(
     subagent_type = "review-fix",
     prompt = """
       Quality-review all changes applied to the plan at <plan_path>.
       Check: no key flows removed, no regressions introduced by consolidation,
       all edits are clear and actionable, no contradictions between sections.
       Self-referential protection: skip content marked <!-- review-plan -->,
       <!-- gas-plan -->, or <!-- node-plan -->.
     """
   )
   ```
   Collect the result and append a **Post-convergence Quality Check** section to the
   scorecard output. If the review-fix Task finds Critical issues, apply them before
   proceeding. Advisory findings are noted only.

2. Use the Bash tool to run: `touch ~/.claude/.plan-reviewed` — writes the gate marker so ExitPlanMode will pass

3. **Team teardown (IS_GAS or IS_NODE mode):** Send shutdown_request to all evaluator agents by name
   (`l1-evaluator`, `l2-evaluator`, and `gas-evaluator` if IS_GAS or `node-evaluator` if IS_NODE),
   then call TeamDelete. (Teardown must complete before ExitPlanMode — the session context needed for
   TeamDelete is not available after exiting plan mode.)

4. **Call ExitPlanMode immediately.** Do not pause, do not ask the user "should I present the plan?"

The PreToolUse hook on ExitPlanMode checks for this marker and consumes it on success.
