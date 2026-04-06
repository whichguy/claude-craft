<!-- ADDING A QUESTION: (1) add row here with gate weight, (2) update Gate1_unresolved
     formula in SKILL.md if weight=3, (3) add Q-ID to evaluator's assigned list in
     SKILL.md loop body. All 3 steps required. -->

# Review-Plan Question Definitions

## Gate Weight Reference
Gate 1 (blocking, weight 3) | Gate 2 (important, weight 2) | Gate 3 (advisory, weight 1)
N/A counts as PASS for gate evaluation.

---

## Layer 1: General Quality

*22 questions (Q-G1 through Q-G8 + Q-G10 through Q-G14 + Q-G16 through Q-G25). Applies to every plan, every domain.*

For each question: evaluate → **PASS** / **NEEDS_UPDATE** / **N/A**
- PASS: criterion is met
- NEEDS_UPDATE: criterion is missing or incomplete → edit the plan, mark `<!-- review-plan -->`
- N/A: see N/A column
(These are the only valid evaluator outputs — no other statuses.)

**Gate 1 — Blocking (weight 3):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G1 | Approach soundness | Right solution? Simpler alternatives considered? Not over/under-engineered? If rejecting alternatives, is reasoning valid? Flag: false dichotomy (only two options when more exist), straw man (misrepresenting rejected alternative), appeal to authority without specifics ("best practice says X" sans context). Also flag: (1) stated constraints ('X won't work', 'Y required', 'Z unavailable') without empirical evidence (test results, error messages, docs links) — constraints must be validated, not assumed; (2) execution mechanism requires per-project manual steps (auth flows, config wizards, browser consent) when an alternative could eliminate them; (3) parallel path added alongside existing mechanism when new one could replace it entirely, reducing maintenance surface. | never |
| Q-G2 | Standards compliance | Follows CLAUDE.md directives and MEMORY.md conventions? (IS_GAS: focus on non-GAS CLAUDE.md directives — Verification Protocol, Agent Teams, Tool Preferences. GAS-specific directives covered by gas-evaluator Q13.) | never |
| Q-G11 | Existing code examined | Plan shows code was read: specific file paths, function names, "currently does X" language. Flag: vague "update the module/handler/function" without names. GAS: mcp_gas cat output or .gs function names cited. | pure new-file work only |
**Gate 2 — Important (weight 2):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G4 | Unintended consequences | Side effects: broken workflows, behavior changes, regressions, security shifts? (Excludes call-site impact per Q-C3. Focus: behavioral/security side effects not caught by call-site analysis.) | trivial isolated change |
| Q-G5 | Scope focus | Plan stays on target, no scope creep? | never |
| Q-G8 | Task & team usage | Does the plan use the right agent coordination level (see Decision Framework)? Flag: heavy/independent work inline when Task calls would isolate context; sequential Tasks when parallel would work; missing TeamCreate for multi-agent coordination of interdependent concerns. | plan involves only a single atomic change with no parallelizable steps and no heavy operations |
| Q-G10 | Assumption exposure | Does the plan make high-risk implicit assumptions about environment state, APIs, data pre-conditions, or third-party behavior without stating them explicitly? Flag: "should work", "assume X exists", unvalidated environmental dependencies risking silent failure or significant rework. Flag open-question markers: "TBD", "will need to investigate", "if the API supports", "need to determine". Distinguish *stated assumptions* ("we assume X") from *unvalidated constraints* ("X won't work", "Y is required"). Stated assumptions acceptable when explicit. Unvalidated constraints MUST cite evidence (test result, error message, doc reference, or known platform limitation). Flag constraints treated as facts without evidence — "API X doesn't support Y" sans test/doc link, "mechanism Z requires manual step W" without verifying alternatives. Unresolved decisions must become numbered investigation steps with defined outcomes, or be annotated low-risk with reason. (Evaluator: "assume X" = known assumption, flag if high-risk; "TBD: X" = unknown decision, always flag.) Flag mutually contradictory assumptions (e.g., "data is immutable" + "update cache on write"). (Lightweight consistency check — deep cross-phase analysis in Q-G21.) | no external calls, no environment-specific dependencies, no pre-existing data assumptions; and no open-question markers (TBD / will need to investigate) in implementation steps |
| Q-G12 | Code consolidation | Does the plan consolidate substantively overlapping implementations elsewhere in the codebase? If overlap exists: plan must include consolidation steps or explicitly defer with reason. Flag: touches near-identical logic without mentioning consolidation or deferral. (Scope: structural overlap only. Reimplementation of existing utilities covered by Q-C12.) | purely additive (new file / new feature) with no substantively similar existing implementations |
| Q-G13 | Phased decomposition | Are concerns organized into phases each completing implement → test/verify → commit before the next begins? Flag: (1) distinct concerns in flat step list without phase boundaries; (2) commits before testing; (3) implicit inter-phase dependencies without go/no-go checkpoints; (4) per-phase `/review-fix` invocations (belongs in post-implementation — see Q-E2). | single atomic concern with no cross-phase dependencies (e.g. fix exactly one bug, rename one identifier, add one isolated function) |
| Q-G14 | Codebase style adherence | Do proposed code changes follow existing codebase patterns? If the plan intentionally deviates (error handling, module structure, abstraction), is the deviation stated with a reason? Flag: uses different patterns from comparable existing code without acknowledging the change. | documentation-only change with no proposed code; or brand new project with no existing comparable code to inherit style from |
| Q-G18 | Pre-condition verification | Before modifying existing files, does the plan verify current state matches expectations? Flag: proceeds directly to editing without confirming file contents, line numbers, or function signatures. Acceptable: explicit "Read file X to confirm Y" or "verify Z before proceeding" step. EDIT: IF no verification precedes a file edit, `[EDIT: add before step N: "Read [file path] and verify [specific expectation — e.g., function X exists at line ~Y, config contains key Z] before modifying"]`. | pure new-file creation with no existing files to verify; or plan modifies only documentation where current state is irrelevant |
| Q-G20 | Story arc coherence | Does the plan articulate a coherent story arc with all 4 elements: (1) problem/need — what prompted this work and what current state changes, (2) approach and rationale — what the plan does and why this method over alternatives, (3) expected outcome — end state when plan succeeds, (4) verification — at least one testable assertion confirmable after implementation. Acceptable verification: "test X passes", "endpoint returns Y with Z", "renders [component] in under N seconds", "returns success:true with [field]". Insufficient: "it works", "no errors", "check everything is fine", "observable state changes" without specifying which/what. All 4 elements required — may be distributed across sections (e.g., Context + Test Strategy) but each must be explicit, not implied. Flag: plan jumps to implementation without establishing any element, or covers some but omits others (common: problem stated but no expected outcome or verification). EDIT injection — team-lead: **If story arc absent entirely**, output `[EDIT: inject after plan title: "## Context\n[What problem or need this plan addresses and what current state is being changed]\n\n## Approach\n[What this plan will do and why this method]\n\n## Expected Outcome\n[What the end state looks like when the plan succeeds and how success is verified]"]`. | IS_TRIVIAL; or change is self-evidently scoped (e.g., "fix typo in line 42 of README") where all 4 elements are implicit in a single sentence |
| Q-G21 | Internal logic consistency | Are stated assumptions and reasoning premises mutually consistent across sections/phases? Flag: (1) contradictory premises between phases (e.g., "cache for performance" in Phase 1 vs "data changes every request" in Phase 3), (2) circular reasoning where A justifies B and vice versa, (3) phases making incompatible system-state assumptions (e.g., one assumes stateless, another introduces sessions), (4) false dichotomies ("must use A because B won't work" without evidence). Consequence: contradictions cause phases to produce incorrect results at implementation, discovered only after significant work. EDIT: `[EDIT: flag contradiction between [phase X] "[quoted]" and [phase Y] "[quoted]" — resolve by [aligning or adding investigation step]]`. | single-phase plan with no stated assumptions or premises; IS_TRIVIAL |
| Q-G22 | Cross-phase dependency explicitness | When a phase depends on outputs, artifacts, state, or interface contracts from a prior phase — is the dependency explicitly stated with a verification step? Flag: (1) Phase N references files/functions/schemas/formats Phase M must produce, without M listing that artifact as output, (2) Phase N proceeds without verifying artifact exists and matches expected format, (3) implicit "should exist by now" assumptions, (4) phases that silently produce wrong results if prior output differs from expectation. Consequence: implicit inter-phase contracts cause "Phase 3 worked in planning but broke at implementation" failures. EDIT: `[EDIT: add to Phase [M] end: "**Outputs:** [artifact list]" and Phase [N] start: "**Pre-check:** verify [artifact] exists and matches [expected format]"]`. | single-phase plan; phases are purely additive with no inter-phase data/artifact/interface dependencies. (Format contract: Q-G9f parses the exact `**Outputs:**` and `**Pre-check:**` markers injected by this question's EDIT. Changes to these marker names must update Q-G9f's algorithm step (a) in both QUESTIONS.md and SKILL.md. When this question is N/A, Q-G9f is also N/A — no Outputs/Pre-check annotations exist to parse.) |
| Q-G23 | Proportionality | Is scope proportional to problem severity? Flag: (1) effort far exceeds problem scope (bug fix requiring 5 phases/team coordination, minor enhancement restructuring modules, one-time op adding abstraction layer), (2) multi-phase for single-phase work, (3) new abstractions for single-use ops, (4) TeamCreate for parallel-Tasks-or-inline work, (5) phase-per-file when one phase suffices. Consequence: over-engineering triggers cascading Q-G13/Q-G17/Q-G19 findings, increases implementation time and bug surface with no benefit. EDIT injection: `[EDIT: consolidate Phases [X] and [Y] — both modify [same concern]. Replace with single phase: "[consolidated description]"]`. | IS_TRIVIAL; plan is already single-phase; problem is explicitly complex (new system, multi-service integration, architectural migration) |
| Q-G24 | Core-vs-derivative question weighting | When a plan defines question/criteria batteries, do foundational questions (those downstream steps depend on) receive proportionally deeper specification than derivative ones? Flag: uniform depth across questions of vastly different analytical weight — core questions with one-line criteria, derivative ones with multi-paragraph detail, or all equally shallow. EDIT: `[EDIT: expand specification for foundational question(s) [Q-IDs] in step N: add evaluation criteria, worked examples, or allocate dedicated processing]`. | plan defines no question batteries or evaluation criteria |
| Q-G25 | Feedback loop completeness | When plan output feeds another tool/skill, does it account for return signals? Flag: generates inputs for downstream consumer without specifying how rejection, partial success, or quality signals are consumed to adjust the producing step. EDIT: `[EDIT: add after step N: "Read [downstream tool] output signals and adjust [upstream artifact] if [quality threshold] not met"]`. | plan output is terminal (user-facing only, not consumed by another tool/skill); plan is self-contained with no downstream integration |

**Gate 3 — Advisory (weight 1):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G6 | Naming consistency | New identifiers follow codebase conventions? | no new names |
| Q-G7 | Documentation | MEMORY.md / CLAUDE.md / README affected by this change? | no behavior changes |
| Q-G16 | LLM comment breadcrumbs | For plans creating/modifying complex code (new modules, logic, architecture) — does the plan direct adding brief LLM-navigable comments at key locations (function entries, module purpose, non-obvious branches)? Acceptable: "comments at function boundaries", "navigation comments for key logic". Flag: complex code changes with no mention of documentation or navigation aids. | documentation-only change; configuration change; trivial single-line/single-function fix; or plan explicitly defers documentation to a separate task |
| Q-G17 | Phase preambles | For plans with ≥ 2 phases: does each phase have a brief intent preamble (1–3 sentences before numbered steps) explaining why it exists and what it sets up for subsequent phases? Flag: multi-phase plan where phases go straight to steps without per-phase narrative context. EDIT — team-lead applies: **If preamble absent**, `[EDIT: add before Phase N steps: "> Intent: [why this phase exists and what it sets up for subsequent phases]"]`. One EDIT per missing preamble. | single-phase plan (requires ≥ 2 distinct phases); IS_TRIVIAL |
| Q-G19 | Phase failure recovery | For multi-phase plans with independent commits: does the plan address later-phase failure after earlier phases committed? Acceptable: "earlier phases safe independently" statement, revert instructions, or stop-and-assess checkpoints. Flag: inter-phase dependencies where Phase N failure leaves Phases 1..N-1 in inconsistent state with no risk acknowledgment. | single-phase plan; or phases are purely additive with no inter-dependency (each phase's commit is independently valid) |

Count L1 edits → `l1_changes += count` (22 questions total, combined into `changes_this_pass` in Convergence Loop)

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
*L1 per-pass count stays at 22 (Q-G1 through Q-G8 + Q-G10 through Q-G14 + Q-G16 through Q-G25). Q-G9 is not included in*
*convergence loop scoring. Q-E1 and Q-E2 are post-convergence epilogue questions (not per-pass).*
*Q-G9 is N/A if plan has fewer than 3 implementation steps.*

**Sub-question definitions:**

| Sub-Q | Question | Criteria |
|-------|----------|----------|
| Q-G9a | Sequential clarity | Are steps numbered sequentially with unambiguous ordering, legible at a glance? |
| Q-G9b | Concurrency labeling | Parallel steps marked (e.g. "[parallel]", "In a SINGLE message", "spawn in parallel")? |
| Q-G9c | Scannability | Headers+bullets used (no prose walls >5 sentences)? |
| Q-G9d | Conditional structure | Are IF/ELSE branches visually distinct from sequential steps? |
| Q-G9e | Checkpoint visibility | Commit/verification checkpoints visible (not buried mid-paragraph)? |
| Q-G9f | Execution graph | Plans with 3+ phases: execution schedule showing which phases parallelize? Parse each phase's **Outputs** and **Pre-check** to build dependency graph: (a) Extract Outputs and Pre-check per phase. (b) Phase N depends on M if N's Pre-check references M's Outputs. (c) Wave assignment: Wave 1 = no deps; Wave K = all deps in prior waves. (d) Same-wave phases run parallel. EDIT: IF no schedule and parallelism exists: `[EDIT: add after last phase: "## Execution Schedule\nWave 1: Phase [X] (no dependencies)\nWave 2 [parallel]: Phases [Y], [Z] (depend only on Wave 1)\nWave 3: Phase [W] (depends on [Y], [Z])\n\nParallel execution: In a SINGLE message, spawn Phase [Y] and Phase [Z] as parallel Tasks after Phase [X] completes."]`. IF strictly sequential: PASS — "All phases sequential — no parallelism available." N/A: <3 phases; or Q-G22 N/A (no Outputs/Pre-check annotations). |

---

## Layer 2: Code Change Quality

*38 questions organized into 6 concern clusters. Cluster-level triage activates/deactivates
entire clusters based on Haiku pre-classification. Active clusters are listed in active_clusters
computed in Step 0.*

### Cluster 1: Impact & Architecture

*12 questions. Always active.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C3 | 1 | Impact analysis | Other callers/features affected? Cross-ref call sites checked? | fully isolated |
| Q-C8 | 2 | Interface consistency | Modified signatures consistent with siblings; callers updated? | no sig changes |
| Q-C12 | 3 | Duplication | No reimplementation of existing utilities? (Scope: utility/library reimplementation. Structural consolidation see Q-G12.) | no new functions |
| Q-C14 | 2 | Bolt-on vs integrated | Does new code extend existing modules rather than bolt on isolated additions? If the plan adds a parallel execution path alongside an existing one, could the new mechanism replace it entirely? Flag: new file/module for functionality an existing module handles, without evaluating extension or supersession. (Scope: integration decisions only. Mechanism correctness validated by Q-G1.) | purely additive |
| Q-C26 | 2 | Migration tasks | If the change alters data formats, config schemas, storage keys, API contracts, or persistent state: does the plan include a migration step? Flag: renamed keys without migration, changed storage shapes without conversion, removed features without state cleanup, schema changes without forward/backward migration. | no change to existing data formats or persistent state |
| Q-C27 | 2 | Backward compatibility | If modifying public APIs, CLIs, package exports, event schemas, or external config formats — does the plan flag breaking changes with a migration path or versioning step (v2 endpoint, semver bump, deprecation notice)? | internal-only change, no external API consumers |
| Q-C32 | 2 | Bulk data safety | When processing unbounded/large collections (paginated API results, DB query results, file listings, spreadsheet ranges, log entries): does it use streaming, pagination, or chunking? Flag: (1) entire dataset loaded into memory without size guard, (2) no upper bound on loop iterations, (3) results accumulated in growing array without limit, (4) user-submitted data processed without size validation. Consequence: OOM crashes, execution timeouts, or quota exhaustion. EDIT: `[EDIT: add chunking/pagination for [operation] in step N: "Process [data source] in batches of [N] with [progress tracking]"]`. (Scope: data-volume patterns. Platform runtime limits: Q-C21.) | all operations are bounded by design (fixed-size config, known-small dataset, single-record lookup) |
| Q-C35 | 2 | Agent cognitive load | When the plan dispatches an agent with N analytical questions, is N calibrated to source material complexity? Flag: >6 deep-reasoning questions against >500-line input in a single call. Consequence: overloaded agents produce shallow analysis or hallucinate. EDIT: `[EDIT: split step N into [K] sub-tasks, each covering [question subset] against [relevant portion]]`. | plan does not dispatch agents; or all agent calls are simple retrieval/read operations with no analytical burden |
| Q-C37 | 2 | Translation boundary specification | Plan step transforms abstract analysis into concrete artifacts (e.g., "boundary analysis → test files") — translation step specified with enough structure for agent execution without improvising methodology? Flag: hardest creative step gets least specification — says "convert analysis to [artifact]" without mapping rules, output format, or quality criteria. EDIT: `[EDIT: expand step N translation spec: "**Methodology:** [structured approach for converting [abstract input] to [concrete output]]" with input→output examples]`. | no abstract-to-concrete translation steps; all outputs are trivially derivable from inputs |
| Q-C38 | 2 | Cross-boundary API contract | For each cross-boundary call (functions/APIs in a different repo, package, or independently-versioned module): does the assumed signature (arg count, types, order, return shape) match the target's current definition? Flag: (1) signature recalled from memory, not cited from a Read step, (2) arg count/order mismatch between caller and callee, (3) return value destructured with properties the target doesn't provide, (4) adapter that papers over an unverified signature gap. Consequence: cross-boundary signature mismatches are #1 "works in plan, breaks in implementation" cause — silent in dynamic languages, masked by type casts in TS. (Scope: inter-repo/inter-package. Intra-module: Q-C8.) EDIT: `[EDIT: add before step N: "Read [target repo/module] and verify [function] signature: [expected args] → [expected return shape]"]`. | single-repo change with no cross-boundary function calls; all called interfaces are defined within the same package/repo |
| Q-C39 | 2 | Data access pattern vs schema | For each data read from config files, databases, API responses, or structured stores: does the access pattern (key paths, property names, nesting depth) match the schema cited in a Read step or type definition? Flag: (1) accessing root-level property on a `{[id]: object}` dictionary schema, (2) reading nonexistent property on actual type, (3) assuming flat structure for nested data or vice versa, (4) fallback default for a structurally impossible key — masking schema misunderstanding as "not configured." Consequence: schema-shape mismatches return `undefined` silently; fallback logic treats developer-error as missing-optional. (Scope: read-path validation. Write-path: Q-C26.) EDIT: `[EDIT: add before step N: "Read [data source] schema and verify access pattern: [key path] exists with shape [expected type]"]`. | no data reads from structured sources; or all access patterns verified by a Read step in the plan |
| Q-C40 | 2 | Guidance-implementation consistency | Cross-reference every behavioral claim in guidance/narrative/comments against actual implementation steps. Does each claim about function behavior, data flow, or interactions have a step producing it? Flag: (1) guidance says "X reads Y" but no step modifies X, (2) documented capability with no implementing step, (3) comments contradict the code, (4) narrative claims side effect ("also updates Z") with no step. Consequence: guidance-implementation drift — future implementers follow wrong docs over correct code, causing hard-to-diagnose bugs. (Scope: plan-internal consistency only.) EDIT: `[EDIT: in [guidance section], remove or correct claim "[quoted text]" — no step produces this behavior]`. | plan contains no guidance text, documentation sections, or inline comment descriptions |

IS_GAS: **partially superseded** — Q-C3 (→Q18), Q-C8 (→Q16), Q-C12 (→Q39), Q-C14 (→Q41) are superseded; Q-C27 N/A (no external API consumers in GAS projects); Q-C32 (→Q22/Q25/Q26) superseded. **Q-C26, Q-C35, Q-C37, Q-C38, Q-C39, Q-C40 have no gas equivalent — evaluate normally** (always active via impact cluster).
IS_NODE: Q-C32 → N/A-superseded (node N14). Q-C35, Q-C37, Q-C38, Q-C39, Q-C40: not superseded — evaluate normally. All other questions: not superseded — evaluate normally.

### Cluster 2: Testing & Plan Quality

*6 questions. Always active.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C4 | 2 | Tests updated | Are tests updated for interface changes, bug fixes, and new functions? Flag: (1) modified signatures without updating callers' tests, (2) new error paths without negative tests, (3) bug fixes without regression tests. Consequence: tests pass on old interface, fail unexpectedly post-implementation. EDIT: IF tests missing for modified interface, `[EDIT: add test step after step N: "Update tests for [function] — cover new signature/behavior"]`. | pure visual |
| Q-C5 | 2 | Incremental verification | Each step has a checkpoint (not all-testing-at-end)? | single atomic |
| Q-C9 | 2 | Step ordering | Explicit DAG; no refs to uncreated files, no deploy-before-push? | single step |
| Q-C10 | 2 | Empty code | No stubs/TODOs without full spec (phased OK if explicit)? | no placeholders |
| Q-C11 | 3 | Dead code | Old implementations marked for removal? | nothing replaced |
| Q-C29 | 2 | Test strategy defined upfront | Does the plan state upfront what tests verify correctness? Acceptable: named test cases, stated behavior coverage, or explicit confirmation existing tests suffice. Flag: non-trivial logic changes with no pre-stated acceptance criteria — "does this work?" undefined until post-implementation. | cosmetic/doc-only change; single-line fix where correctness is self-evident; existing test suite explicitly confirmed as sufficient |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q11, Q12, Q17, Q19, Q20; Q-C29 N/A — test strategy covered by gas-evaluator Q11/Q12).
IS_NODE: not superseded — evaluate normally.

### Cluster 3: State & Data Integrity

*5 questions. Active when HAS_STATE=true. Skip entire cluster when HAS_STATE=false.*
*(Q-C26 promoted to Cluster 2: Impact & Architecture — always active.)*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C13 | 2 | State edge cases | State-exists AND state-absent cases covered for persistent storage? | no storage |
| Q-C18 | 2 | Concurrency | Shared state locked; background tasks have concurrency plan? | read-only |
| Q-C19 | 2 | Idempotency | Operations safe to retry; data mutations deduped? | read-only |
| Q-C24 | 2 | Local↔remote sync | Sync strategy explicit for local→remote pushes? Stale reads avoided? | local-only |
| Q-C36 | 2 | Persistence staleness | Plan persists intermediate artifacts (analysis files, cached results, config) for reuse across runs — staleness detection (hash, timestamp, version) included? Flag: cached artifact reused without checking source input changed. Consequence: stale artifacts produce silently incorrect results — dangerous when artifact encodes analytical conclusions downstream steps treat as ground truth. EDIT: `[EDIT: add staleness check for [artifact] in step N: "Before reusing [artifact], verify [source] unchanged since generation (compare [hash/timestamp/version])"]`. | no persistent intermediate artifacts; all artifacts are ephemeral within a single run |

IS_GAS: **partially superseded** — Q-C13 (→Q40), Q-C18 (→Q21), Q-C19 (→Q24), Q-C24 (→Q3).
  **Q-C36 has no gas equivalent — evaluate Q-C36 normally** when IS_GAS=true AND HAS_STATE=true (activate state cluster; mark Q-C13/Q-C18/Q-C19/Q-C24 as N/A-superseded within evaluator).
IS_NODE: **Q-C18 → N/A-superseded** (covered by node-evaluator N8).

### Cluster 4: Security & Reliability

*7 questions. Always active (low overhead).*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C15 | 2 | Input validation | Untrusted inputs sanitized at trust boundaries? | no untrusted input |
| Q-C16 | 2 | Error handling | Try/catch on external calls; actionable messages; fail-loud noted? (Scope: synchronous error handling. Async error paths — promise rejections, unhandled exceptions — see Q-C30.) | no new error paths |
| Q-C22 | 2 | Auth/permission additions | Plan adds new API services, OAuth scopes, or permissions — explicitly noted with user impact? Flag: (1) new GAS services (DriveApp, GmailApp) without noting scope addition, (2) OAuth scopes without acknowledging re-auth requirement, (3) permission model change without impact note. Consequence: users forced to re-authorize unexpectedly, causing confusion/support overhead. EDIT: IF new scope/permission without impact note: `[EDIT: add to Context or phase: "**Scope change:** adds [scope] — existing users need re-authorization"]`. | no new services |
| Q-C30 | 2 | Async error completeness | Plan introduces/modifies async operations (promises, callbacks, event handlers, background tasks) — every async path has explicit error handler? Flag: (1) async functions without try/catch or .catch(), (2) fire-and-forget promises without intentional annotation, (3) event handlers that throw without boundary, (4) background/scheduled tasks without error reporting. Consequence: unhandled async errors cause silent failures — no log, no feedback, data corruption undetected. EDIT: `[EDIT: add error handler for async op in step N: "wrap [async call] in try/catch with [error reporting]"]`. | no async operations introduced or modified |
| Q-C31 | 2 | Resource lifecycle cleanup | Plan creates persistent resources (connections, file handles, DB pools, timers/intervals, child processes, event subscriptions) — cleanup in shutdown/error paths? Flag: (1) connection/handle without close in finally/shutdown, (2) timer/interval without clear in cleanup, (3) child process without termination in shutdown, (4) event subscription without unsubscribe in teardown. Consequence: leaks cause memory growth, port exhaustion, orphan processes, stale connections. EDIT: `[EDIT: add cleanup step for [resource] in step N: "In shutdown/error handler: [close/clear/terminate] [resource]"]`. | no persistent resources created (purely computational, no I/O, no subscriptions); IS_GAS (isolated execution — no persistent processes) |
| Q-C33 | 2 | Configuration validation | When introducing new config dependencies (env vars, config files, feature flags, credentials, runtime params): does the plan validate at startup, failing fast on missing/malformed values? Flag: (1) new env vars/config keys referenced without startup existence check, (2) config read without schema validation, (3) config errors deferred to runtime (first-use failure vs startup failure), (4) new config keys undocumented (.env.example, README, or inline). Consequence: missing config fails at unpredictable runtime points — potentially after partial state modifications. EDIT: `[EDIT: add config validation for [new config key] in step N: "Validate [key] exists and matches [expected format] at startup — fail with descriptive error if missing"]`. | no new configuration dependencies introduced |
| Q-C34 | 2 | External call timeouts | For outbound HTTP/API calls, DB queries, or external service requests: are timeout constraints specified? Flag: (1) HTTP calls without connect/response timeout, (2) DB queries without statement timeout, (3) API calls without deadline, (4) retries without max duration cap. Consequence: missing timeouts hang indefinitely, blocking dependents. EDIT: `[EDIT: add timeout in step N: "Set [timeout type] timeout of [N]s for [call]. On timeout: [fallback]"]`. | no outbound external calls introduced |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q27, Q28, Q23; Q-C30→Q28, Q-C31→N/A isolated exec, Q-C33→Q8, Q-C34→Q22).
IS_NODE: **Q-C16, Q-C30, Q-C31, Q-C33, Q-C34 → N/A-superseded** (Q-C16→N6, Q-C30→N6/N7, Q-C31→N13/N27, Q-C33→N9/N10, Q-C34→N28). Q-C15 and Q-C22 remain active.

### Cluster 5: Operations & Deployment

*6 questions. Active when HAS_DEPLOYMENT=true. Skip entire cluster when HAS_DEPLOYMENT=false.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C6 | 2 | Deployment defined | Push steps, target env, verification specified? | local-only |
| Q-C7 | 2 | Rollback plan | Recovery path if deployment fails? | no deployment |
| Q-C20 | 3 | Logging | Informative but compact; no sensitive data? | no server changes |
| Q-C21 | 2 | Runtime constraints | Execution time/memory/platform limits addressed? Unbounded ops chunked? (Scope: platform runtime constraints for deployed services. Data-volume patterns see Q-C32.) | bounded ops |
| Q-C23 | 3 | External rate limits | API quotas/throttling accounted for? | no new API calls |
| Q-C28 | 3 | Observability | For shared/production deployments: does the plan address monitoring/alerting for the change? Acceptable: referencing existing dashboards, adding log-based alerts, or noting current monitoring covers the new behavior. | local-only or dev-environment-only deployment |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q9, Q10, Q29, Q22, Q25); Q-C28 N/A (exec verification + Q6/Q12 cover GAS observability).
IS_NODE: **Q-C21 → N/A-superseded** (covered by node-evaluator N22).

### Cluster 6: Client & UI

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

*7 questions (Q-U1 through Q-U7). Active when HAS_UI=true. Evaluated by ui-evaluator each pass.*

*For each question: evaluate → **PASS** / **NEEDS_UPDATE** / **N/A***

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-U1 | Component structure | Is the UI decomposed into logical, reusable components? Flag: monolithic HTML blobs, duplicated UI patterns, no separation between layout, state, and interaction. | no new UI components |
| Q-U2 | State management | Is UI state (loading, error, empty, data) handled explicitly? Loading spinner/skeleton, error display, empty-state copy all accounted for? | purely presentational changes with no dynamic state |
| Q-U3 | Interaction feedback | Do user actions (form submission, button click, async calls) provide immediate feedback? Disable-during-submission, progress indicator, success/error toast. | no interactive elements |
| Q-U4 | Responsive & layout constraints | Does the UI respect container constraints? GAS sidebars are 300px fixed; dialogs are 600px max. No overflow assumptions, no fixed pixel widths that break at sidebar dimensions. | no layout/sizing changes |
| Q-U5 | Accessibility basics | Interactive elements have accessible labels (`aria-label`, `for`/`id` pairs on form inputs). Tab order is logical. Keyboard navigation not broken. | no new interactive elements |
| Q-U6 | Visual consistency | New UI matches the existing design language (fonts, colors, spacing, button styles from the project's CSS baseline). No one-off inline styles that diverge from established patterns. | no visual changes or the project has no existing baseline |
| Q-U7 | UI design narrative | Does the plan include a UI design narrative describing the user experience: what does the user see and do, what interaction states they move through (loading, error, success, empty), and why the UI is designed this way? Acceptable: a `## UI Design Narrative`, `## User Experience`, or `## Design Intent` section with 2–5 sentences. Flag: plan goes straight to component/HTML implementation steps without any user-facing design rationale. EDIT injection — team-lead applies: `[EDIT: inject ## UI Design Narrative section: "## UI Design Narrative\n**User experience**: [what the user sees and does — the interaction flow]\n**Design intent**: [why this UI approach; what workflow or feeling it supports]\n**State transitions**: [how loading, error, empty, and success states are handled]"]`. | purely presentational changes with no interaction or new components; plan explicitly references an existing design spec |

Count ui-evaluator edits → `ui_plan_changes += count` (combined into `changes_this_pass` in Convergence Loop)

---

## Post-Convergence Questions

*3 questions. Evaluated once after convergence loop exits.
Not part of per-pass evaluation or convergence scoring.*

| Q | Gate | Question | When |
|---|------|----------|------|
| Q-G9 | — | Organization pass | inline (team-lead) |
| Q-E1 | 1 | Git lifecycle | epilogue (team-lead) |
| Q-E2 | 1 | Post-implementation workflow | epilogue (team-lead) |

Q-G9 sub-questions (Q-G9a through Q-G9f) are defined in the Layer 1 section above.

### Q-E1: Git lifecycle (was Q-C1)

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-E1 | 1 | Git lifecycle | Branch named? Each implementation phase ends with explicit `git add` + `git commit` steps? Push-to-remote step present? Merge/PR to main step present? Commit messages follow project conventions? | never |

IS_GAS: N/A — covered by gas-evaluator Q1, Q2.

### Q-E2: Post-implementation workflow (was Q-NEW)

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-E2 | 1 | Post-implementation workflow | Does the plan include an explicit post-implementation section specifying all 4 steps: (1) `/review-fix` — iterative loop: run → apply fixes → re-run until 0 findings, (2) run build/compile if applicable, (3) run tests (if any), (4) if build or tests fail: fix issues → re-run `/review-fix` (back to step 1) → re-run build/tests — repeat until passing? Section must appear after all implementation steps and must not be bundled with or before them. Two cases for EDIT injection — team-lead applies in epilogue: **If section is absent entirely**, inject `## Post-Implementation Workflow` with all 4 steps. **If section is present but missing step 4 only**, append step 4. Each step in the post-implementation workflow must be an imperative instruction, not user-optional. Flag: "optionally run /review-fix", "ask user before running tests", any step requiring user confirmation. | IS_GAS (covered by Q42 in gas-plan) |

IS_GAS: N/A — covered by gas-evaluator Q42.
