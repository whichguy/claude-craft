<!-- ADDING A QUESTION: (1) add row here with gate weight, (2) update Gate1_unresolved
     formula in SKILL.md if weight=3, (3) add Q-ID to evaluator's assigned list in
     SKILL.md loop body. All 3 steps required. -->

# Review-Plan Question Definitions

## Gate Weight Reference
Gate 1 (blocking, weight 3) | Gate 2 (important, weight 2) | Gate 3 (advisory, weight 1)
N/A counts as PASS for gate evaluation.

---

## Layer 1: General Quality

*20 questions (Q-G1 through Q-G8 + Q-G10 through Q-G14 + Q-G16 through Q-G23). Applies to every plan, every domain.*

For each question: evaluate → **PASS** / **NEEDS_UPDATE** / **N/A**
- PASS: criterion is met
- NEEDS_UPDATE: criterion is missing or incomplete → edit the plan, mark `<!-- review-plan -->`
- N/A: see N/A column
(These are the only valid evaluator outputs — no other statuses.)

**Gate 1 — Blocking (weight 3):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G1 | Approach soundness | Right solution? Simpler alternatives considered? Not over/under-engineered? If the plan explicitly rejects alternative approaches, is the rejection reasoning valid? Flag: false dichotomy (presenting only two options when more exist), straw man (misrepresenting the rejected alternative to make it easy to dismiss), appeal to authority without specifics ("best practice says X" without context). | never |
| Q-G2 | Standards compliance | Follows CLAUDE.md directives and MEMORY.md conventions? (For IS_GAS plans: focus on non-GAS directives in CLAUDE.md — Verification Protocol, Agent Teams, Tool Preferences. GAS-specific CLAUDE.md directives are covered by gas-evaluator Q13.) | never |
| Q-G11 | Existing code examined | Plan demonstrates the code being modified was read: specific file paths, function names, "currently does X" language. Flag: "update the module/handler/function" without specific names when modifying existing code. GAS: mcp_gas cat output cited or .gs function names referenced. | pure new-file work only |
**Gate 2 — Important (weight 2):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G4 | Unintended consequences | Side effects: broken workflows, behavior changes, regressions, security shifts? (Excluding call-site impact — cross-referencing specific callers/features affected is covered by Q-C3. Q-G4 focuses on behavioral and security-level side effects not caught by call-site analysis.) | trivial isolated change |
| Q-G5 | Scope focus | Plan stays on target, no scope creep? | never |
| Q-G8 | Task & team usage | Does the plan use the right level of agent coordination (see Decision Framework below)? Flag plans that: run heavy/independent work inline when Task calls would provide context isolation; use sequential Task calls when parallel would work; or miss TeamCreate for multi-agent coordination of interdependent concerns. | plan involves only a single atomic change with no parallelizable steps and no heavy operations |
| Q-G10 | Assumption exposure | Does the plan make high-risk implicit assumptions about environment state, APIs, data pre-conditions, or third-party behavior? If so, are they stated explicitly? Flag: plan contains phrases like "should work", "assume X exists", or has unvalidated environmental dependencies that, if false, would cause silent failure or significant rework. Also flag open-question markers in implementation steps: "TBD", "will need to investigate", "if the API supports", "need to determine". These are unresolved decisions (not assumptions about known facts) — each must either become a numbered investigation step with a defined outcome, or be annotated as low-risk with a stated reason. (Evaluator note: "assume X" = known assumption, flag if high-risk; "TBD: X" = unknown decision, always flag regardless of risk.) Additionally: if the plan states multiple assumptions, do they hold simultaneously? Flag: assumptions that individually seem reasonable but together create contradictions (e.g., "data is immutable" in one section and "update cache on write" in another). (This is a lightweight consistency check — deep cross-phase analysis is covered by Q-G21.) | no external calls, no environment-specific dependencies, no pre-existing data assumptions; and no open-question markers (TBD / will need to investigate) in implementation steps |
| Q-G12 | Code consolidation | When the plan modifies or extends existing code — are there substantively overlapping implementations elsewhere in the codebase that should be consolidated as part of this work? If a consolidation opportunity exists, the plan must include consolidation steps or explicitly defer with a noted reason. Flag: plan touches near-identical logic elsewhere but neither consolidation nor deferral is mentioned. (Scope: structural consolidation of overlapping implementations. Reimplementation of existing utility functions is covered by Q-C12.) | purely additive (new file / new feature) with no substantively similar existing implementations |
| Q-G13 | Phased decomposition | Are the plan's concerns organized into phases where each phase completes the full loop — implement → /review-fix (loop until clean) → test/verify → commit — before the next phase begins? Flag: (1) multiple distinct concerns in a flat step list with no phase boundaries; (2) phase commits placed before review-fix or testing for that phase; (3) later phases implicitly depend on earlier ones without an explicit go/no-go checkpoint. | single atomic concern with no cross-phase dependencies (e.g. fix exactly one bug, rename one identifier, add one isolated function) |
| Q-G14 | Codebase style adherence | Do proposed code changes follow existing codebase patterns and conventions? If the plan intentionally deviates (new error handling, different module structure, new abstraction), is the deviation explicitly stated with a reason? Flag: plan uses different patterns from comparable existing code without acknowledging the intentional change. | documentation-only change with no proposed code; or brand new project with no existing comparable code to inherit style from |
| Q-G18 | Pre-condition verification | Before modifying existing files, does the plan include a step to read and verify the current state matches expectations? Flag: plan proceeds directly to editing without confirming current file contents, line numbers, or function signatures. Acceptable: explicit "Read file X to confirm Y" step, or "verify Z before proceeding" instruction. EDIT injection: IF no verification step precedes a file edit, output `[EDIT: add before step N: "Read [file path] and verify [specific expectation — e.g., function X exists at line ~Y, config contains key Z] before modifying"]`. | pure new-file creation with no existing files to verify; or plan modifies only documentation where current state is irrelevant |
| Q-G20 | Story arc coherence | Does the plan articulate a coherent story arc covering: (1) the problem or need being addressed — what prompted this work and what current state is being changed, (2) the approach and why it will work — what the plan will do and why this method was chosen over alternatives, (3) expected outcome — what the end state should look like when the plan succeeds, (4) verification of success — at least one testable assertion that could be confirmed or denied after implementation. Acceptable: "test X passes", "endpoint returns Y when called with Z", "sidebar renders [component] in under N seconds", "exec returns success:true with result containing [field]". Not sufficient: "it works", "no errors", "check that everything is fine", "observable state changes" without specifying which states or what change. All 4 elements must be present — distributed across sections is acceptable (e.g., Context + Test Strategy sections) but each must be explicitly stated, not implied. Flag: plan jumps to implementation steps without establishing any of the 4 elements, or covers some but omits others (common: describes the problem but never defines the expected outcome or how success is verified). EDIT injection — team-lead applies: **If story arc section is absent entirely**, output `[EDIT: inject after plan title: "## Context\n[What problem or need this plan addresses and what current state is being changed]\n\n## Approach\n[What this plan will do and why this method]\n\n## Expected Outcome\n[What the end state looks like when the plan succeeds and how success is verified]"]`. | IS_TRIVIAL; or change is self-evidently scoped (e.g., "fix typo in line 42 of README") where all 4 elements are implicit in a single sentence |
| Q-G21 | Internal logic consistency | Are the plan's stated assumptions and reasoning premises mutually consistent across sections and phases? Flag: (1) contradictory premises between phases (e.g., "cache for performance" in Phase 1 + "data changes every request" in Phase 3), (2) circular reasoning where step A justifies step B and vice versa, (3) phases that make incompatible assumptions about system state (e.g., one assumes stateless, another introduces session state), (4) false dichotomies in approach justification ("we must use A because B won't work" — with no evidence B won't work). Consequence: contradictory assumptions cause one or more phases to produce incorrect results at implementation time, discovered only after significant work is committed. EDIT injection: `[EDIT: flag contradiction between [section/phase X] assumption "[quoted text]" and [section/phase Y] assumption "[quoted text]" — resolve by [aligning to one or adding investigation step]]`. | single-phase plan with no stated assumptions or premises; IS_TRIVIAL |
| Q-G22 | Cross-phase dependency explicitness | When a phase depends on specific outputs, artifacts, intermediate state, or interface contracts from a prior phase — is the dependency explicitly stated with a verification step? Flag: (1) Phase N references files, functions, config schemas, or data formats that Phase M must produce, without Phase M listing that artifact as an output, (2) Phase N proceeds without verifying the artifact exists and matches expected format, (3) implicit "this should exist by now" assumptions, (4) phases that would silently produce wrong results if prior phase output differs from expectation. Consequence: implicit inter-phase contracts are the primary cause of "Phase 3 worked in planning but broke at implementation" failures. EDIT injection: `[EDIT: add to end of Phase [M]: "**Outputs:** [artifact list]" and add to start of Phase [N]: "**Pre-check:** verify [artifact] exists and matches [expected format]"]`. | single-phase plan; phases are purely additive with no inter-phase data/artifact/interface dependencies. (Format contract: Q-G9f parses the exact `**Outputs:**` and `**Pre-check:**` markers injected by this question's EDIT. Changes to these marker names must update Q-G9f's algorithm step (a) in both QUESTIONS.md and SKILL.md. When this question is N/A, Q-G9f is also N/A — no Outputs/Pre-check annotations exist to parse.) |
| Q-G23 | Proportionality | Is the plan's scope and complexity proportional to the problem being solved? A single bug fix should not require 5 phases with team coordination. A minor enhancement should not restructure existing modules. A one-time operation should not introduce a new abstraction layer. Flag: (1) effort/complexity significantly exceeds what the problem's severity or scope requires, (2) multi-phase plans for changes achievable in one phase, (3) new abstractions introduced for single-use operations, (4) TeamCreate for work achievable with parallel Tasks or inline, (5) phase-per-file when a single phase could handle all files. Consequence: over-engineered plans consume disproportionate review time (each unnecessary phase triggers Q-G13/Q-G17/Q-G19 findings), increase implementation time, and increase bug surface area with no corresponding benefit. EDIT injection: `[EDIT: consolidate Phases [X] and [Y] — both modify [same concern]. Replace with single phase: "[consolidated description]"]`. | IS_TRIVIAL; plan is already single-phase; problem is explicitly complex (new system, multi-service integration, architectural migration) |

**Gate 3 — Advisory (weight 1):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G6 | Naming consistency | New identifiers follow codebase conventions? | no new names |
| Q-G7 | Documentation | MEMORY.md / CLAUDE.md / README affected by this change? | no behavior changes |
| Q-G16 | LLM comment breadcrumbs | For plans creating or significantly modifying complex code (new modules, logic, architectural changes) — does the plan include a directive to add brief LLM-navigable comments at key locations (function entry points, module purpose, non-obvious branches)? Acceptable: "add brief comments at function boundaries", "include navigation comments for key logic". Flag: complex code changes with no mention of documentation or navigation aids. | documentation-only change; configuration change; trivial single-line/single-function fix; or plan explicitly defers documentation to a separate task |
| Q-G17 | Phase preambles | For plans with ≥ 2 distinct implementation phases: does each phase have a brief intent preamble — 1–3 sentences before the numbered steps — explaining why this phase exists and what it sets up for subsequent phases? Flag: multi-phase plan where phases go straight to numbered steps without any per-phase narrative context. EDIT injection — team-lead applies: **If per-phase preamble is absent for a phase**, `[EDIT: add before Phase N steps: "> Intent: [why this phase exists and what it sets up for subsequent phases]"]`. One EDIT per missing preamble. | single-phase plan (requires ≥ 2 distinct phases); IS_TRIVIAL |
| Q-G19 | Phase failure recovery | For multi-phase plans where each phase commits independently: does the plan address what happens if a later phase fails after earlier phases committed? Acceptable: explicit "earlier phases are safe to keep independently" statement, revert instructions, or "stop and assess before continuing" checkpoint between dependent phases. Flag: multi-phase plan with inter-phase dependencies where a Phase N failure would leave Phases 1..N-1 commits in an inconsistent state, with no acknowledgment of this risk. | single-phase plan; or phases are purely additive with no inter-dependency (each phase's commit is independently valid) |

Count L1 edits → `l1_changes += count` (20 questions total, combined into `changes_this_pass` in Convergence Loop)

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
*L1 per-pass count stays at 20 (Q-G1 through Q-G8 + Q-G10 through Q-G14 + Q-G16 through Q-G23). Q-G9 is not included in*
*convergence loop scoring. Q-E1 and Q-E2 are post-convergence epilogue questions (not per-pass). N/A if plan has fewer than 3 implementation steps.*

**Sub-question definitions:**

| Sub-Q | Question | Criteria |
|-------|----------|----------|
| Q-G9a | Sequential clarity | Are implementation steps numbered and unambiguous in order? Steps must be numbered sequentially; ordering must be legible at a glance. |
| Q-G9b | Concurrency labeling | Are parallel steps explicitly marked (e.g. "[parallel]", "In a SINGLE message", "spawn in parallel")? |
| Q-G9c | Scannability | Does the plan use headers and bullets (no prose walls >5 sentences)? |
| Q-G9d | Conditional structure | Are IF/ELSE branches visually distinct from sequential steps? |
| Q-G9e | Checkpoint visibility | Are commit/verification checkpoints clearly visible (not buried mid-paragraph)? |
| Q-G9f | Execution graph | For plans with 3+ implementation phases: does the plan include an execution schedule that identifies which phases can run in parallel? Parse each phase's **Outputs** (artifacts produced) and **Pre-check** (artifacts required from prior phases) to build a dependency graph. Algorithm: (a) For each phase, extract Outputs list and Pre-check references. (b) Build adjacency: Phase N depends on Phase M if N's Pre-check references any artifact in M's Outputs. (c) Group into execution waves: Wave 1 = phases with no dependencies; Wave 2 = phases whose dependencies are all in Wave 1; etc. (d) Within each wave, phases can execute in parallel. EDIT injection: IF no execution schedule present and parallelism exists, output `[EDIT: add after last phase: "## Execution Schedule\nWave 1: Phase [X] (no dependencies)\nWave 2 [parallel]: Phases [Y], [Z] (both depend only on Wave 1)\nWave 3: Phase [W] (depends on [Y] and [Z])\n\nParallel execution: In a SINGLE message, spawn Phase [Y] and Phase [Z] as parallel Tasks after Phase [X] completes."]`. IF all phases are strictly sequential (each depends on the previous), output PASS with note: "All phases sequential — no parallelism available." N/A: fewer than 3 phases; or Q-G22 is N/A (no inter-phase dependencies — no Outputs/Pre-check annotations to parse). |

---

## Layer 2: Code Change Quality

*32 questions organized into 6 concern clusters. Cluster-level triage activates/deactivates
entire clusters based on Haiku pre-classification. Active clusters are listed in active_clusters
computed in Step 0.*

### Cluster 1: Impact & Architecture

*7 questions. Always active.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C3 | 1 | Impact analysis | Other callers/features affected? Cross-ref call sites checked? | fully isolated |
| Q-C8 | 2 | Interface consistency | Modified signatures consistent with siblings; callers updated? | no sig changes |
| Q-C12 | 3 | Duplication | No reimplementation of existing utilities? (Scope: reimplementation of existing utility/library functions. Broader structural consolidation is covered by Q-G12.) | no new functions |
| Q-C14 | 2 | Bolt-on vs integrated | New code extends existing modules; not isolated additions? | purely additive |
| Q-C26 | 2 | Migration tasks | If the change alters data formats, config schemas, storage keys, API contracts, or persistent state structure from a previous design, does the plan include a one-time migration step? Flag: renamed properties/keys without migration, changed data shapes in storage without conversion, removed features without cleanup of stored state, schema changes without forward/backward migration. | no change to existing data formats or persistent state |
| Q-C27 | 2 | Backward compatibility | If the change modifies public-facing APIs, CLI interfaces, published package exports, event schemas, or config formats consumed externally — does the plan flag the breaking change and include a migration path or versioning step (e.g. v2 endpoint, semver bump, deprecation notice)? | internal-only change, no external API consumers |
| Q-C32 | 2 | Bulk data safety | When the plan processes collections of unbounded or potentially large size (API paginated results, database query results, file system listings, spreadsheet ranges, log entries), does it use streaming, pagination, or chunking? Flag: (1) loads entire dataset into memory without size guard, (2) no upper bound on loop iterations, (3) accumulates results in growing array without limit, (4) processes user-submitted data without size validation. Consequence: unbounded data operations cause OOM crashes, execution timeouts, or quota exhaustion. EDIT injection: `[EDIT: add chunking/pagination for [operation] in step N: "Process [data source] in batches of [N] with [progress tracking]"]`. (Scope: data-volume patterns regardless of deployment context. Platform-imposed runtime limits are covered by Q-C21.) | all operations are bounded by design (fixed-size config, known-small dataset, single-record lookup) |

IS_GAS: **partially superseded** — Q-C3 (→Q18), Q-C8 (→Q16), Q-C12 (→Q39), Q-C14 (→Q41) are superseded; Q-C27 N/A (no external API consumers in GAS projects); Q-C32 (→Q22/Q25/Q26) superseded. **Q-C26 has no gas equivalent — evaluate Q-C26 normally** (always active via impact cluster).
IS_NODE: Q-C32 → N/A-superseded (node N14). All other questions: not superseded — evaluate normally.

### Cluster 2: Testing & Plan Quality

*6 questions. Always active.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C4 | 2 | Tests updated | Does the plan include test updates for interface changes, bug fixes, and new functions? Flag: (1) plan modifies function signatures without updating callers' tests, (2) adds new error paths without negative test cases, (3) fixes a bug without a regression test that would catch recurrence. Consequence: tests pass on the old interface, then fail silently or unexpectedly after implementation. EDIT injection: IF tests not mentioned for a modified interface, output `[EDIT: add test update step after implementation step N: "Update tests for [function] — cover new signature/behavior"]`. | pure visual |
| Q-C5 | 2 | Incremental verification | Each step has a checkpoint (not all-testing-at-end)? | single atomic |
| Q-C9 | 2 | Step ordering | Explicit DAG; no refs to uncreated files, no deploy-before-push? | single step |
| Q-C10 | 2 | Empty code | No stubs/TODOs without full spec (phased OK if explicit)? | no placeholders |
| Q-C11 | 3 | Dead code | Old implementations marked for removal? | nothing replaced |
| Q-C29 | 2 | Test strategy defined upfront | Does the plan state, prior to or alongside implementation steps, what tests will verify the change is correct? Acceptable: naming specific test cases, stating what behaviors the test suite must cover, or explicitly confirming existing tests cover the new behavior without modification. Flag: plan implements non-trivial logic changes with no pre-stated acceptance criteria or test scope — leaving "does this work?" undefined until post-implementation. | cosmetic/doc-only change; single-line fix where correctness is self-evident; existing test suite explicitly confirmed as sufficient |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q11, Q12, Q17, Q19, Q20; Q-C29 N/A — test strategy covered by gas-evaluator Q11/Q12).
IS_NODE: not superseded — evaluate normally.

### Cluster 3: State & Data Integrity

*4 questions. Active when HAS_STATE=true. Skip entire cluster when HAS_STATE=false.*
*(Q-C26 promoted to Cluster 2: Impact & Architecture — always active.)*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C13 | 2 | State edge cases | State-exists AND state-absent cases covered for persistent storage? | no storage |
| Q-C18 | 2 | Concurrency | Shared state locked; background tasks have concurrency plan? | read-only |
| Q-C19 | 2 | Idempotency | Operations safe to retry; data mutations deduped? | read-only |
| Q-C24 | 2 | Local↔remote sync | Sync strategy explicit for local→remote pushes? Stale reads avoided? | local-only |

IS_GAS: **fully superseded** — Q-C13 (→Q40), Q-C18 (→Q21), Q-C19 (→Q24), Q-C24 (→Q3).
  Skip this cluster entirely when IS_GAS=true (Q-C26 now in impact cluster, always active).
IS_NODE: **Q-C18 → N/A-superseded** (covered by node-evaluator N8).

### Cluster 4: Security & Reliability

*7 questions. Always active (low overhead).*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C15 | 2 | Input validation | Untrusted inputs sanitized at trust boundaries? | no untrusted input |
| Q-C16 | 2 | Error handling | Try/catch on external calls; actionable messages; fail-loud noted? (Scope: synchronous error handling and general try/catch patterns. Async-specific error paths — promise rejections, unhandled async exceptions — are covered by Q-C30.) | no new error paths |
| Q-C22 | 2 | Auth/permission additions | When the plan adds new API services, OAuth scopes, or permission requirements — are they explicitly noted with user impact? Flag: (1) adds new GAS services (DriveApp, GmailApp) without noting scope addition, (2) adds OAuth scopes without acknowledging re-authorization requirement, (3) changes permission model without impact note. Consequence: users are forced to re-authorize unexpectedly, causing confusion or support overhead. EDIT injection: IF new scope/permission detected without impact note, output `[EDIT: add to Context or relevant phase: "**Scope change:** adds [scope] — existing users will need to re-authorize"]`. | no new services |
| Q-C30 | 2 | Async error completeness | When the plan introduces or modifies async operations (promises, callbacks, event handlers, background tasks), does every async path have an explicit error handler? Flag: (1) new async functions without try/catch or .catch(), (2) fire-and-forget promises without intentional annotation, (3) event handlers that can throw without a boundary, (4) background/scheduled tasks without error reporting. Consequence: unhandled async errors cause silent failures — no error log, no user feedback, data corruption without detection. EDIT injection: `[EDIT: add error handler for async operation in step N: "wrap [async call] in try/catch with [error reporting mechanism]"]`. | no async operations introduced or modified |
| Q-C31 | 2 | Resource lifecycle cleanup | When the plan creates persistent resources (server connections, file handles, database pools, timers/intervals, child processes, event subscriptions), does it include cleanup in shutdown/error paths? Flag: (1) opens connection/handle without corresponding close in finally/shutdown, (2) creates timer/interval without clearTimeout/clearInterval in cleanup, (3) spawns child processes without termination in shutdown handler, (4) subscribes to external events without unsubscribe in teardown. Consequence: resource leaks cause memory growth, port exhaustion, orphan processes, or stale connections that accumulate over time. EDIT injection: `[EDIT: add cleanup step for [resource] created in step N: "In shutdown/error handler: [close/clear/terminate] [resource]"]`. | no persistent resources created (purely computational, no I/O, no subscriptions); IS_GAS (isolated execution — no persistent processes) |
| Q-C33 | 2 | Configuration validation | When the plan introduces new configuration dependencies (environment variables, config files, feature flags, external service credentials, runtime parameters), does it include startup validation that fails fast on missing or malformed values? Flag: (1) references new env vars/config keys without ensuring they exist at startup, (2) reads config without schema validation, (3) defers configuration errors to runtime (first-use failure instead of startup failure), (4) no documentation of new config keys (.env.example, README, or inline). Consequence: missing config causes failures at unpredictable runtime points — potentially after partial operations have already modified state. EDIT injection: `[EDIT: add config validation for [new config key] in step N: "Validate [key] exists and matches [expected format] at startup — fail with descriptive error if missing"]`. | no new configuration dependencies introduced |
| Q-C34 | 2 | External call timeouts | When the plan makes outbound HTTP/API calls, database queries, or external service requests, does it specify timeout constraints? Flag: (1) HTTP client calls without connect/response timeout, (2) database queries without statement timeout, (3) external API calls without deadline, (4) retry logic without maximum duration cap. Consequence: calls without timeouts hang indefinitely, consuming resources and blocking dependent operations. EDIT injection: `[EDIT: add timeout for external call in step N: "Set [timeout type] timeout of [N]s for [external call]. On timeout: [fallback behavior]"]`. | no outbound external calls introduced |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q27, Q28, Q23; Q-C30→Q28, Q-C31→N/A isolated exec, Q-C33→Q8, Q-C34→Q22).
IS_NODE: **Q-C16, Q-C30, Q-C31, Q-C33, Q-C34 → N/A-superseded** (Q-C16→N6, Q-C30→N6/N7, Q-C31→N13/N27, Q-C33→N9/N10, Q-C34→N28). Q-C15 and Q-C22 remain active.

### Cluster 5: Operations & Deployment

*6 questions. Active when HAS_DEPLOYMENT=true. Skip entire cluster when HAS_DEPLOYMENT=false.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C6 | 2 | Deployment defined | Push steps, target env, verification specified? | local-only |
| Q-C7 | 2 | Rollback plan | Recovery path if deployment fails? | no deployment |
| Q-C20 | 3 | Logging | Informative but compact; no sensitive data? | no server changes |
| Q-C21 | 2 | Runtime constraints | Execution time/memory/platform limits addressed? Unbounded ops chunked? (Scope: platform-imposed runtime constraints for deployed services. Data-volume patterns regardless of deployment context are covered by Q-C32.) | bounded ops |
| Q-C23 | 3 | External rate limits | API quotas/throttling accounted for? | no new API calls |
| Q-C28 | 3 | Observability | For deployments to shared or production environments: does the plan reference or add monitoring/alerting coverage for the deployed change? Acceptable: referencing existing dashboards, adding a log-based alert, or noting that existing monitoring covers the new behavior. | local-only or dev-environment-only deployment |

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
