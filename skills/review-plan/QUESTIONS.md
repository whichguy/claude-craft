<!-- ADDING A QUESTION: (1) add row here with gate weight, (2) update Gate1_unresolved
     formula in SKILL.md if weight=3, (3) add Q-ID to evaluator's assigned list in
     SKILL.md loop body. All 3 steps required. -->

# Review-Plan Question Definitions

## Gate Weight Reference
Gate 1 (blocking, weight 3) | Gate 2 (important, weight 2) | Gate 3 (advisory, weight 1)
N/A counts as PASS for gate evaluation.

---

## Layer 1: General Quality

*14 questions (Q-G1 through Q-G8 + Q-NEW + Q-G10 through Q-G14 + Q-G16). Applies to every plan, every domain.*

For each question: evaluate → **PASS** / **NEEDS_UPDATE** / **N/A**
- PASS: criterion is met
- NEEDS_UPDATE: criterion is missing or incomplete → edit the plan, mark `<!-- review-plan -->`
- N/A: see N/A column

**Gate 1 — Blocking (weight 3):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G1 | Approach soundness | Right solution? Simpler alternatives considered? Not over/under-engineered? | never |
| Q-G2 | Standards compliance | Follows CLAUDE.md directives and MEMORY.md conventions? | never |
| Q-G11 | Existing code examined | Plan demonstrates the code being modified was read: specific file paths, function names, "currently does X" language. Flag: "update the module/handler/function" without specific names when modifying existing code. GAS: mcp_gas cat output cited or .gs function names referenced. | pure new-file work only |
| Q-NEW | Post-implementation workflow | Does the plan include an explicit post-implementation section specifying all 4 steps: (1) `/review-fix` — iterative loop: run → apply fixes → re-run until 0 findings, (2) run build/compile if applicable, (3) run tests (if any), (4) if build or tests fail: fix issues → re-run `/review-fix` (back to step 1) → re-run build/tests — repeat until passing? Section must appear after all implementation steps and must not be bundled with or before them. Two cases for EDIT injection — team-lead applies: **If section is absent entirely**, output `[EDIT: inject ## Post-Implementation Workflow\n1. /review-fix — loop until clean (run → fix → re-run until 0 findings)\n2. Run build if applicable (e.g. npm run build, tsc --noEmit)\n3. Run tests (if any)\n4. If build or tests fail: fix issues → re-run /review-fix (step 1) → re-run build/tests — repeat until passing]`. **If section is present but missing step 4 only**, output `[EDIT: add to Post-Implementation Workflow: step 4 — "If build or tests fail: fix issues → re-run /review-fix (step 1) → re-run build/tests — repeat until passing"]`. (Note to evaluators: you are read-only; emit the EDIT instruction, do not write directly.) Each step in the post-implementation workflow must be an imperative instruction, not user-optional. Flag: "optionally run /review-fix", "ask user before running tests", any step requiring user confirmation. | IS_GAS (covered by Q42 in gas-plan) |

**Gate 2 — Important (weight 2):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G4 | Unintended consequences | Side effects: broken workflows, behavior changes, regressions, security shifts? | trivial isolated change |
| Q-G5 | Scope focus | Plan stays on target, no scope creep? | never |
| Q-G8 | Task & team usage | Does the plan use the right level of agent coordination (see Decision Framework below)? Flag plans that: run heavy/independent work inline when Task calls would provide context isolation; use sequential Task calls when parallel would work; or miss TeamCreate for multi-agent coordination of interdependent concerns. | plan involves only a single atomic change with no parallelizable steps and no heavy operations |
| Q-G10 | Assumption exposure | Does the plan make high-risk implicit assumptions about environment state, APIs, data pre-conditions, or third-party behavior? If so, are they stated explicitly? Flag: plan contains phrases like "should work", "assume X exists", or has unvalidated environmental dependencies that, if false, would cause silent failure or significant rework. Also flag open-question markers in implementation steps: "TBD", "will need to investigate", "if the API supports", "need to determine". These are unresolved decisions (not assumptions about known facts) — each must either become a numbered investigation step with a defined outcome, or be annotated as low-risk with a stated reason. (Evaluator note: "assume X" = known assumption, flag if high-risk; "TBD: X" = unknown decision, always flag regardless of risk.) | no external calls, no environment-specific dependencies, no pre-existing data assumptions; and no open-question markers (TBD / will need to investigate) in implementation steps |
| Q-G12 | Code consolidation | When the plan modifies or extends existing code — are there substantively overlapping implementations elsewhere in the codebase that should be consolidated as part of this work? If a consolidation opportunity exists, the plan must include consolidation steps or explicitly defer with a noted reason. Flag: plan touches near-identical logic elsewhere but neither consolidation nor deferral is mentioned. | purely additive (new file / new feature) with no substantively similar existing implementations |
| Q-G13 | Phased decomposition | Are the plan's concerns organized into phases where each phase completes the full loop — implement → /review-fix (loop until clean) → test/verify → commit — before the next phase begins? Flag: (1) multiple distinct concerns in a flat step list with no phase boundaries; (2) phase commits placed before review-fix or testing for that phase; (3) later phases implicitly depend on earlier ones without an explicit go/no-go checkpoint. | single atomic concern with no cross-phase dependencies (e.g. fix exactly one bug, rename one identifier, add one isolated function) |
| Q-G14 | Codebase style adherence | Do proposed code changes follow existing codebase patterns and conventions? If the plan intentionally deviates (new error handling, different module structure, new abstraction), is the deviation explicitly stated with a reason? Flag: plan uses different patterns from comparable existing code without acknowledging the intentional change. | documentation-only change with no proposed code; or brand new project with no existing comparable code to inherit style from |

**Gate 3 — Advisory (weight 1):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G6 | Naming consistency | New identifiers follow codebase conventions? | no new names |
| Q-G7 | Documentation | MEMORY.md / CLAUDE.md / README affected by this change? | no behavior changes |
| Q-G16 | LLM comment breadcrumbs | For plans creating or significantly modifying complex code (new modules, logic, architectural changes) — does the plan include a directive to add brief LLM-navigable comments at key locations (function entry points, module purpose, non-obvious branches)? Acceptable: "add brief comments at function boundaries", "include navigation comments for key logic". Flag: complex code changes with no mention of documentation or navigation aids. | documentation-only change; configuration change; trivial single-line/single-function fix; or plan explicitly defers documentation to a separate task |

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
*L1 per-pass count stays at 14 (Q-G1 through Q-G8 + Q-NEW + Q-G10 through Q-G14 + Q-G16). Q-G9 is not included in*
*convergence loop scoring. N/A if plan has fewer than 3 implementation steps.*

**Sub-question definitions:**

| Sub-Q | Question | Criteria |
|-------|----------|----------|
| Q-G9a | Sequential clarity | Are implementation steps numbered and unambiguous in order? Steps must be numbered sequentially; ordering must be legible at a glance. |
| Q-G9b | Concurrency labeling | Are parallel steps explicitly marked (e.g. "[parallel]", "In a SINGLE message", "spawn in parallel")? |
| Q-G9c | Scannability | Does the plan use headers and bullets (no prose walls >5 sentences)? |
| Q-G9d | Conditional structure | Are IF/ELSE branches visually distinct from sequential steps? |
| Q-G9e | Checkpoint visibility | Are commit/verification checkpoints clearly visible (not buried mid-paragraph)? |

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
