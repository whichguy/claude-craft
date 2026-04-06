<!-- ADDING A QUESTION: (1) add row here with gate weight, (2) update Gate1_unresolved
     formula in SKILL.md if weight=3, (3) add Q-ID to evaluator's assigned list in
     SKILL.md loop body. All 3 steps required. -->

# Review-Plan Question Definitions

## Gate Weight Reference
Gate 1 (blocking, weight 3) | Gate 2 (important, weight 2) | Gate 3 (advisory, weight 1)
N/A counts as PASS for gate evaluation.

---

## Layer 1: General Quality

*24 questions (Q-G1 through Q-G8 + Q-G10 through Q-G14 + Q-G16 through Q-G27). Applies to every plan, every domain.*

For each question: evaluate → **PASS** / **NEEDS_UPDATE** / **N/A**
- PASS: criterion is met
- NEEDS_UPDATE: criterion is missing or incomplete → edit the plan, mark `<!-- review-plan -->`
- N/A: see N/A column
(These are the only valid evaluator outputs — no other statuses.)

**Gate 1 — Blocking (weight 3):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G1 | Approach soundness | Right solution? Simpler alternatives considered with valid rejection reasoning? Flag fallacies (false dichotomy, straw man, appeal to authority). Flag: (1) constraints stated as facts sans evidence (tested, error received, doc link); (2) manual per-project steps (auth flows, config wizards) when automatable; (3) parallel path added alongside existing mechanism when replacement would shrink maintenance surface; (4) new dependency when native/existing solution suffices. | never |
| Q-G2 | Standards compliance | Follows CLAUDE.md directives and MEMORY.md conventions? (IS_GAS: non-GAS only — Verification Protocol, Agent Teams, Tool Preferences; GAS directives → gas-evaluator Q13.) | never |
| Q-G11 | Existing code examined | Plan cites code read: file paths, function names, "currently does X". Flag: vague "update the module/handler" without names. GAS: mcp_gas cat or .gs names cited. | pure new-file work only |
**Gate 2 — Important (weight 2):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G4 | Unintended consequences | Side effects beyond call-site scope: broken workflows, behavioral/performance regressions, security shifts? | trivial isolated change |
| Q-G5 | Scope focus | Plan stays on target, no scope creep? | never |
| Q-G8 | Task & team usage | Correct coordination scope per Decision Framework? Flag: inline heavy work (Tasks isolates context), sequential Tasks (parallel works), missing TeamCreate (interdependent agents). | plan involves only a single atomic change with no parallelizable steps and no heavy operations |
| Q-G10 | Assumption exposure | Flag implicit high-risk assumptions about environment, APIs, data, or third-party behavior. Targets: "should work", unvalidated env deps, TBD/open-question markers, "X won't work" claims without evidence (test result, error msg, doc, or platform limitation). Distinguish: *stated assumptions* ("we assume X") acceptable if explicit; *unvalidated constraints* require cited evidence. Unresolved decisions → flag unless accompanied by investigation steps or low-risk annotation. Heuristics: "assume X" = flag if high-risk; "TBD: X" = always flag. Also flag contradictory assumptions. (Lightweight — deep cross-phase: Q-G21.) | no external calls, no environment-specific dependencies, no pre-existing data assumptions; and no open-question markers (TBD / will need to investigate) in implementation steps |
| Q-G12 | Code consolidation | Does the plan address substantively overlapping implementations? If overlap exists: must consolidate or defer with reason. Flag: touches near-identical logic without mentioning either. (Scope: structural overlap only; utility reimplementation → Q-C12.) | purely additive (new file / new feature) with no substantively similar existing implementations |
| Q-G13 | Phased decomposition | Concerns organized into phases each completing implement→test→commit before the next? Flag: (1) distinct concerns in flat list without phase boundaries; (2) commits before testing; (3) implicit inter-phase dependencies without checkpoints; (4) per-phase `/review-fix` (belongs in post-implementation — Q-E2). | single atomic concern with no cross-phase dependencies (e.g. fix exactly one bug, rename one identifier, add one isolated function) |
| Q-G14 | Codebase style adherence | Code changes match existing patterns. Intentional deviations (error handling, module structure, abstraction) stated with reason. Flag: pattern divergence from comparable code without acknowledgment. | documentation-only change with no proposed code; or brand new project with no existing comparable code to inherit style from |
| Q-G18 | Pre-condition verification | Files edited without prior read/verify? Acceptable: "Read X to confirm Y" or "verify Z before". EDIT: IF unverified edit → [EDIT: before step N: "Read [path] and verify [expectation — e.g., fn X at ~line Y]"] | pure new-file creation with no existing files to verify; or plan modifies only documentation where current state is irrelevant |
| Q-G20 | Story arc coherence | All 4 story-arc elements explicit? (1) problem/need — trigger + current-state delta, (2) approach + rationale, (3) expected outcome, (4) testable verification. Acceptable: "test X passes", "endpoint returns Y for input Z", "renders [component] in <Ns". Insufficient: "it works", "no errors", "observable state changes". Elements may span sections but each must be explicit. Flag: missing elements; jumping to implementation. EDIT: `[EDIT: inject after title: "## Context\n[Problem and current-state]\n\n## Approach\n[Method and rationale]\n\n## Expected Outcome\n[Success state and verification]"]`. | IS_TRIVIAL; or change is self-evidently scoped (e.g., "fix typo in line 42 of README") where all 4 elements are implicit in a single sentence |
| Q-G21 | Internal logic consistency | Cross-phase assumption/premise consistency? Flag: (1) contradictory premises between phases ("cache for perf" vs "data changes every request"), (2) circular reasoning, (3) incompatible state assumptions (stateless + sessions), (4) evidence-free false dichotomies. EDIT: `[EDIT: flag: [phase X] "[quoted]" vs [phase Y] "[quoted]" — resolve by [align or investigate]]`. | single-phase plan with no stated assumptions or premises; IS_TRIVIAL |
| Q-G22 | Cross-phase dependency explicitness | Inter-phase deps explicitly stated with verification? Flag: (1) Phase N refs artifact Phase M doesn't list as output; (2) no artifact verification before consumption; (3) "should exist by now" assumptions; (4) silent wrong-result if prior output differs. EDIT: `[EDIT: Phase [M] end: "**Outputs:** [list]" | Phase [N] start: "**Pre-check:** verify [artifact] exists, matches [format]"]`. | single-phase plan; phases are purely additive with no inter-phase data/artifact/interface dependencies. (Format contract: Q-G9f parses the exact `**Outputs:**` and `**Pre-check:**` markers injected by this question's EDIT. Changes to these marker names must update Q-G9f's algorithm step (a) in both QUESTIONS.md and SKILL.md. When this question is N/A, Q-G9f is also N/A — no Outputs/Pre-check annotations exist to parse.) |
| Q-G23 | Proportionality | Scope proportional to problem? Flag: (1) effort vastly exceeds problem (bug fix→5 phases, minor→restructure, one-off→abstraction), (2) multi-phase for single-phase work, (3) single-use abstractions, (4) TeamCreate for Tasks/inline work, (5) phase-per-file. EDIT: `[EDIT: consolidate Phases [X]+[Y] — same concern. Single phase: "[description]"]`. | IS_TRIVIAL; plan is already single-phase; problem is explicitly complex (new system, multi-service integration, architectural migration) |
| Q-G24 | Core-vs-derivative question weighting | Question/criteria batteries: foundational Qs (downstream deps) deeper than derivatives? Flag: uniform depth across different analytical weights; core one-line, derivatives multi-paragraph, or all equally shallow. EDIT: `[EDIT: expand foundational Q(s) [Q-IDs] in step N: add criteria, worked examples, or dedicated processing]`. | plan defines no question batteries or evaluation criteria |
| Q-G25 | Feedback loop completeness | Flag: downstream output fed to another tool/skill without specifying how rejection, partial success, or quality signals adjust the producing step. EDIT: `[EDIT: after step N: "Read [downstream tool] output; adjust [upstream artifact] if [quality threshold] not met"]` | plan output is terminal (user-facing only, not consumed by another tool/skill); plan is self-contained with no downstream integration |
| Q-G26 | Domain convention alignment | Approach follows established domain conventions (REST semantics, OAuth, framework idioms)? Unfamiliar domain → research step? Flag: reinventing solved patterns sans justification, tech used against its conventions, or new domain entered sans research. | trivial change; pure refactoring; domain conventions already established in codebase and checked by Q-G14 |
| Q-G27 | Assumption validation spike | Unproven high-risk assertions (API capabilities, performance, compatibility) validated via spike/POC before building on them? Q-G10 detects missing evidence; this requires generating it. Flag: implementation built on unverified claims sans validation step. EDIT: `[EDIT: before step N: "Spike: [assertion] — test in temp confirming [expected behavior]"]`. | all assertions backed by cited evidence (docs, test results, prior codebase experience); IS_TRIVIAL |

**Gate 3 — Advisory (weight 1):**

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G6 | Naming consistency | New identifiers follow codebase conventions? | no new names |
| Q-G7 | Documentation | MEMORY.md / CLAUDE.md / README affected by this change? | no behavior changes |
| Q-G16 | LLM comment breadcrumbs | Complex code changes (new modules, logic, architecture): plan includes LLM-navigable comments at key points? Acceptable: "comments at function boundaries", "navigation comments". Flag: complex changes with no documentation/navigation aids mentioned. | documentation-only change; configuration change; trivial single-line/single-function fix; or plan explicitly defers documentation to a separate task |
| Q-G17 | Phase preambles | Plans >=2 phases: each phase needs 1-3 sentence intent preamble before steps — why it exists, what it enables downstream. Flag: phases jumping to steps without narrative context. EDIT: **If absent**, `[EDIT: before Phase N steps: "> Intent: [why this phase exists and what it sets up]"]`. One EDIT per missing preamble. | single-phase plan (requires ≥ 2 distinct phases); IS_TRIVIAL |
| Q-G19 | Phase failure recovery | Does the plan acknowledge partial-commit risk in multi-phase work? Acceptable: phases are independently safe, revert instructions, or stop-and-assess checkpoints. Flag: Phase N failure leaves earlier commits inconsistent with no risk acknowledgment. | single-phase plan; or phases are purely additive with no inter-dependency (each phase's commit is independently valid) |

Count L1 edits → `l1_changes += count` (24 questions total, combined into `changes_this_pass` in Convergence Loop)

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
*L1 per-pass count stays at 24 (Q-G1 through Q-G8 + Q-G10 through Q-G14 + Q-G16 through Q-G27). Q-G9 is not included in*
*convergence loop scoring. Q-E1 and Q-E2 are post-convergence epilogue questions (not per-pass).*
*Q-G9 is N/A if plan has fewer than 3 implementation steps.*

**Sub-question definitions:**

| Sub-Q | Question | Criteria |
|-------|----------|----------|
| Q-G9a | Sequential clarity | Steps numbered sequentially, unambiguous ordering, legible at a glance? |
| Q-G9b | Concurrency labeling | Parallel steps marked (e.g. "[parallel]", "In a SINGLE message", "spawn in parallel")? |
| Q-G9c | Scannability | Headers+bullets used (no prose walls >5 sentences)? |
| Q-G9d | Conditional structure | Are IF/ELSE branches visually distinct from sequential steps? |
| Q-G9e | Checkpoint visibility | Commit/verification checkpoints visible (not buried mid-paragraph)? |
| Q-G9f | Execution graph | 3+ phases: dep graph from **Outputs**/**Pre-check**: (a) extract per phase, (b) N deps M if Pre-check refs Outputs, (c) wave assign (W1=no deps, WK=all prior), (d) same-wave=parallel. EDIT if parallelism sans schedule: inject `## Execution Schedule\nWave 1: [X]\nWave 2 [parallel]: [Y],[Z]\n\nSpawn [Y]+[Z] as parallel Tasks after [X]`. Sequential → PASS. N/A: <3 phases or Q-G22 N/A. |

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
| Q-C12 | 3 | Duplication | No reimplementation of existing utilities? (Scope: utility/library; structural consolidation: Q-G12.) | no new functions |
| Q-C14 | 2 | Bolt-on vs integrated | New code extends existing modules vs bolting on parallel additions? If adding alongside, could it replace rather than duplicate? Flag: new file/module for what existing module handles without evaluating extension or supersession. (Scope: integration decisions. Mechanism: Q-G1.) | purely additive |
| Q-C26 | 2 | Migration tasks | Data format, config schema, storage key, API contract, or persistent state changes: migration included? Flag: renamed keys, changed shapes, removed features, schema changes — each without migration/conversion/cleanup. | no change to existing data formats or persistent state |
| Q-C27 | 2 | Backward compatibility | Breaking changes to public APIs, CLIs, exports, event schemas, or external configs — migration path or versioning included (v2 endpoint, semver bump, deprecation)? | internal-only change, no external API consumers |
| Q-C32 | 2 | Bulk data safety | Unbounded data (paginated APIs, DB results, file/log listings): chunked/streamed/paginated? Flag: full load sans guard; unbounded loops; uncapped accumulation; user data sans validation. EDIT: `[EDIT: step N: "Process [source] in batches of [N] with [progress tracking]"]`. | all operations are bounded by design (fixed-size config, known-small dataset, single-record lookup) |
| Q-C35 | 2 | Agent cognitive load | Is agent analytical load calibrated to input complexity? Flag: >6 deep-reasoning questions against >500-line input in one call. Consequence: overloaded agents produce shallow analysis or hallucinate. EDIT: `[EDIT: split step N into [K] sub-tasks, each covering [question subset] against [relevant portion]]`. | plan does not dispatch agents; or all agent calls are simple retrieval/read operations with no analytical burden |
| Q-C37 | 2 | Translation boundary specification | Abstract→concrete steps specified for agent execution? Flag: hardest creative step gets least spec ("convert analysis to [artifact]" sans mapping/format/criteria). EDIT: `[EDIT: step N: "**Methodology:** [approach: [abstract input]→[concrete output]]" + examples]` | no abstract-to-concrete translation steps; all outputs are trivially derivable from inputs |
| Q-C38 | 2 | Cross-boundary API contract | For each cross-boundary call (different repo/package/independently-versioned module): assumed signature (args, types, order, return shape) matches target's current def? Flag: (1) from memory sans Read; (2) arg count/order mismatch; (3) destructuring nonexistent return props; (4) adapter masking unverified gap. Silent in dynamic langs, masked by TS casts — #1 "works in plan, breaks in impl" cause. Scope: inter-repo; intra-module: Q-C8. EDIT: `[EDIT: before step N: "Read [target], verify [function] signature: [args] → [return]"]`. | single-repo change with no cross-boundary function calls; all called interfaces are defined within the same package/repo |
| Q-C39 | 2 | Data access pattern vs schema | Config/DB/API/store reads: key paths and nesting match schema or type def? Flag: (1) root-level access on `{[id]: object}` dict; (2) access on nonexistent property; (3) flat/nested mismatch; (4) fallback on structurally impossible key — `undefined`-silent access masking schema error as "not configured." Scope: read-path; write-path: Q-C26. EDIT: `[EDIT: before step N: "Read [source] schema, verify [key path] exists with [expected shape]"]`. | no data reads from structured sources; or all access patterns verified by a Read step in the plan |
| Q-C40 | 2 | Guidance-implementation consistency | Each behavioral claim in guidance/narrative/comments has an implementing step? Flag: (1) "X reads Y" but no step touches X; (2) documented capability sans step; (3) comment-code contradiction; (4) claimed side effect sans step. Consequence: dual-truth — implementers follow wrong docs. (Scope: plan-internal.) EDIT: `[EDIT: in [section], remove/correct "[quoted]" — no step produces this behavior]`. | plan contains no guidance text, documentation sections, or inline comment descriptions |

IS_GAS: **partially superseded** — Q-C3 (→Q18), Q-C8 (→Q16), Q-C12 (→Q39), Q-C14 (→Q41) are superseded; Q-C27 N/A (no external API consumers in GAS projects); Q-C32 (→Q22/Q25/Q26) superseded. **Q-C26, Q-C35, Q-C37, Q-C38, Q-C39, Q-C40 have no gas equivalent — evaluate normally** (always active via impact cluster).
IS_NODE: Q-C32 → N/A-superseded (node N14). Q-C35, Q-C37, Q-C38, Q-C39, Q-C40: not superseded — evaluate normally. All other questions: not superseded — evaluate normally.

### Cluster 2: Testing & Plan Quality

*6 questions. Always active.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C4 | 2 | Tests updated | Tests updated for interface changes, bug fixes, new functions? Flag: (1) signature changes without test updates; (2) new error paths untested; (3) bug fixes without regression tests. EDIT: `[EDIT: add test step after step N: "Update tests for [function] — cover new signature/behavior"]`. | pure visual |
| Q-C5 | 2 | Incremental verification | Each step has a checkpoint (not all-testing-at-end)? | single atomic |
| Q-C9 | 2 | Step ordering | Explicit DAG; no refs to uncreated files, no deploy-before-push? | single step |
| Q-C10 | 2 | Empty code | No stubs/TODOs without full spec (phased OK if explicit)? | no placeholders |
| Q-C11 | 3 | Dead code | Old implementations marked for removal? | nothing replaced |
| Q-C29 | 2 | Test strategy defined upfront | Test strategy stated upfront? Acceptable: named test cases, behavior coverage, or confirmation existing tests suffice. Flag: non-trivial logic changes without pre-stated acceptance criteria — correctness undefined until post-implementation. | cosmetic/doc-only change; single-line fix where correctness is self-evident; existing test suite explicitly confirmed as sufficient |
| Q-C43 | 2 | Test-blast radius alignment | Test plan covers callers/workflows the plan identifies as affected? Flag: impact analysis names N affected consumers but tests only cover the changed function. EDIT: `[EDIT: in test section: "Verify [affected caller from impact analysis] still works"]`. | no callers/workflows identified as affected; self-contained change |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q11, Q12, Q17, Q19, Q20; Q-C29 N/A — test strategy covered by gas-evaluator Q11/Q12). **Q-C43 has no gas equivalent — evaluate normally** when IS_GAS=true AND testing cluster is active.
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
| Q-C36 | 2 | Persistence staleness | Reused persisted artifacts include staleness detection (hash/timestamp/version)? Flag: reuse without checking source changed → silently incorrect downstream. EDIT: `[EDIT: step N: "Before reusing [artifact], verify [source] unchanged (compare [hash/timestamp/version])"]`. | no persistent intermediate artifacts; all artifacts are ephemeral within a single run |

IS_GAS: **partially superseded** — Q-C13 (→Q40), Q-C18 (→Q21), Q-C19 (→Q24), Q-C24 (→Q3).
  **Q-C36 has no gas equivalent — evaluate Q-C36 normally** when IS_GAS=true AND HAS_STATE=true (activate state cluster; mark Q-C13/Q-C18/Q-C19/Q-C24 as N/A-superseded within evaluator).
IS_NODE: **Q-C18 → N/A-superseded** (covered by node-evaluator N8).

### Cluster 4: Security & Reliability

*7 questions. Always active (low overhead).*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C15 | 2 | Input validation | Untrusted inputs sanitized at trust boundaries? | no untrusted input |
| Q-C16 | 2 | Error handling | Try/catch on external calls; actionable error messages; fail-loud noted? (Sync only; async: Q-C30.) | no new error paths |
| Q-C22 | 2 | Auth/permission additions | New API services, OAuth scopes, or permissions — user impact noted? Flag: (1) GAS services (DriveApp, GmailApp) sans scope note; (2) OAuth scopes sans re-auth acknowledgment; (3) permission changes sans impact note. EDIT: `[EDIT: add to Context or phase: "**Scope change:** adds [scope] — existing users need re-authorization"]`. | no new services |
| Q-C30 | 2 | Async error completeness | Every async path (promises, callbacks, event handlers, background tasks) has error handler? Flag: (1) async sans try/catch/.catch(); (2) fire-and-forget sans annotation; (3) event handlers sans boundary; (4) scheduled tasks sans error reporting. EDIT: `[EDIT: step N: "wrap [async call] in try/catch with [error reporting]"]`. | no async operations introduced or modified |
| Q-C31 | 2 | Resource lifecycle cleanup | Persistent resources (connections, handles, pools, timers, child procs, subscriptions) — cleanup in shutdown/error paths? Flag: (1) no close in finally/shutdown, (2) timer sans clear, (3) child proc sans termination, (4) subscription sans unsubscribe. EDIT: `[EDIT: step N: "In shutdown/error handler: [close/clear/terminate] [resource]"]`. | no persistent resources created (purely computational, no I/O, no subscriptions); IS_GAS (isolated execution — no persistent processes) |
| Q-C33 | 2 | Configuration validation | New config deps (env vars, files, flags, credentials): startup fail-fast validation? Flag: (1) no startup check; (2) no schema validation; (3) first-use-deferred errors; (4) undocumented keys. Consequence: runtime failure at unpredictable points. EDIT: `[EDIT: step N: "Validate [key] at startup — fail descriptively if missing/malformed"]`. | no new configuration dependencies introduced |
| Q-C34 | 2 | External call timeouts | Timeouts for all outbound calls (HTTP, DB, APIs)? Flag: (1) HTTP sans connect/response timeout; (2) DB sans statement timeout; (3) API sans deadline; (4) retries sans max duration. Missing timeouts block dependents indefinitely. EDIT: `[EDIT: step N: "Set [timeout type] timeout of [N]s for [call]. On timeout: [fallback]"]`. | no outbound external calls introduced |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q27, Q28, Q23; Q-C30→Q28, Q-C31→N/A isolated exec, Q-C33→Q8, Q-C34→Q22).
IS_NODE: **Q-C16, Q-C30, Q-C31, Q-C33, Q-C34 → N/A-superseded** (Q-C16→N6, Q-C30→N6/N7, Q-C31→N13/N27, Q-C33→N9/N10, Q-C34→N28). Q-C15 and Q-C22 remain active.

### Cluster 5: Operations & Deployment

*6 questions. Active when HAS_DEPLOYMENT=true. Skip entire cluster when HAS_DEPLOYMENT=false.*

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C6 | 2 | Deployment defined | Push steps, target env, verification specified? | local-only |
| Q-C7 | 2 | Rollback plan | Recovery path if deployment fails? | no deployment |
| Q-C20 | 3 | Logging | Informative but compact; no sensitive data? | no server changes |
| Q-C21 | 2 | Runtime constraints | Execution time/memory/platform limits addressed? Unbounded ops chunked? (Scope: runtime; data-volume: Q-C32.) | bounded ops |
| Q-C23 | 3 | External rate limits | API quotas/throttling accounted for? | no new API calls |
| Q-C28 | 3 | Observability | Plan addresses monitoring/alerting? Acceptable: reference existing dashboards, add log-based alerts, or note current monitoring covers new behavior. | local-only or dev-environment-only deployment |
| Q-C41 | 2 | Feature rollback | If this feature causes production issues post-merge, how is it reversed? Flag: irreversible data migrations sans rollback script, no feature flag for risky behavior changes, schema changes with no down-migration. EDIT: `[EDIT: add to Context: "**Rollback:** [strategy — feature flag / revert commit / down-migration / manual steps]"]`. | change is trivially revertible (config tweak, doc-only, additive with no data migration) |
| Q-C44 | 3 | Change observability | How will you confirm this change works in production? Flag: behavior change with no logging, metric, or alert. Acceptable: existing monitoring confirmed sufficient, new log line, or dashboard update. | no production-observable behavior change; local/dev-only |

IS_GAS: **fully superseded** — skip this cluster when IS_GAS=true (gas-evaluator Q9, Q10, Q29, Q22, Q25); Q-C28 N/A (exec verification + Q6/Q12 cover GAS observability). **Q-C41 has no gas equivalent — evaluate normally** when IS_GAS=true AND operations cluster is active.
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
| Q-U4 | Responsive & layout constraints | UI respects container constraints? GAS sidebars 300px fixed; dialogs 600px max. No overflow or fixed widths breaking at sidebar size. | no layout/sizing changes |
| Q-U5 | Accessibility basics | Interactive elements have accessible labels (`aria-label`, `for`/`id` pairs on form inputs). Tab order is logical. Keyboard navigation not broken. | no new interactive elements |
| Q-U6 | Visual consistency | New UI matches design system (fonts, colors, spacing, buttons from CSS baseline). No one-off inline styles diverging from patterns. | no visual changes or the project has no existing baseline |
| Q-U7 | UI design narrative | UI design narrative present? Acceptable: `## UI Design Narrative`/`## User Experience`/`## Design Intent`, 2-5 sentences on user flow, states, rationale. Flag: jumps to impl sans narrative. EDIT: inject `## UI Design Narrative\n**User experience**: [flow]\n**Design intent**: [rationale]\n**State transitions**: [loading/error/empty/success]`. | purely presentational changes with no interaction or new components; plan explicitly references an existing design spec |

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
| Q-E1 | 1 | Git lifecycle | Branch named? Each phase ends with explicit `git add` + `git commit`? Push-to-remote present? Merge/PR to main present? Commit messages follow conventions? | never |

IS_GAS: N/A — covered by gas-evaluator Q1, Q2.

### Q-E2: Post-implementation workflow (was Q-NEW)

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-E2 | 1 | Post-implementation workflow | Post-implementation section present (after impl steps, not bundled) with all 4: (1) `/review-fix` loop until 0 findings, (2) build/compile if applicable, (3) run tests if any, (4) if fail: fix → re-run `/review-fix` → re-run, repeat until passing? Each step imperative, not user-optional. Flag: "optionally run /review-fix", "ask user before running tests", any step requiring user confirmation. EDIT: absent → inject `## Post-Implementation Workflow` with all 4 steps; present but missing step 4 → append step 4. | IS_GAS (covered by Q42 in gas-plan) |

IS_GAS: N/A — covered by gas-evaluator Q42.
