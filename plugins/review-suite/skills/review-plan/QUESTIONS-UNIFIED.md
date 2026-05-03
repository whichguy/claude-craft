# Unified Plan Review Question Definitions

This file serves as the single source of truth for all plan review questions across all domains (General, GAS, Node.js, UI).

## Gate Weight Reference
Gate 1 (blocking, weight 3) | Gate 2 (important, weight 2) | Gate 3 (advisory, weight 1)
N/A counts as PASS for gate evaluation.

---

## Layer 1: General Quality
*27 questions (Q-G1, Q-G4 through Q-G7, Q-G10 through Q-G14, Q-G16 through Q-G32). Applies to every plan, every domain.*

### Gate 1 — Blocking (weight 3)

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G1 | Approach soundness | Right solution? Simpler alternatives with valid rejection? Flag fallacies (false dichotomy, straw man, authority). Flag: (1) unsubstantiated constraints (need test/error/doc evidence); (2) manual steps when automatable; (3) additive path when replacement shrinks maintenance; (4) new dependency when native suffices. | never |
| Q-G11 | Existing code examined | Cites code read: paths, function names, current behavior. Flag: vague refs without names. GAS: .gs names or mcp_gas cat cited. | pure new-file work only |

### Gate 2 — Important (weight 2)

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G4 | Unintended consequences | Off-site side effects: broken workflows, behavioral/perf regressions, security shifts? | trivial isolated change |
| Q-G5 | Scope focus | On-target, no scope creep? | never |
| Q-G10 | Assumption exposure | Flag implicit high-risk assumptions (environment, APIs, data, third-party). Targets: "should work", unvalidated env deps, TBD markers, evidence-free "won't work" claims. Stated assumptions acceptable if explicit; unvalidated constraints need cited evidence (test, error, doc, platform limit). Unresolved decisions → flag unless investigation steps or low-risk annotation present. Rules: "assume X" → flag if high-risk; "TBD" → always flag; contradictions → flag. | no external calls/deps/data assumptions; no TBD markers |
| Q-G12 | Code consolidation | Substantive overlap addressed? If overlap: consolidate or defer with reason. Flag: touches near-identical logic without acknowledging. | purely additive with no substantively similar existing implementations |
| Q-G13 | Phased decomposition | Phases group distinct concerns, each completing implement→test→commit before next? Flag: (1) flat list mixing concerns; (2) commit before test; (3) implicit cross-phase deps; (4) per-phase `/review`. | single atomic concern |
| Q-G14 | Codebase style adherence | Changes follow existing patterns; deviations stated with reason. Flag: unacknowledged divergence from comparable code. | doc-only or brand new project with no existing comparable code |
| Q-G18 | Pre-condition verification | Edit without prior read? OK: "Read X to confirm Y"/"verify Z before". EDIT: unverified → `[EDIT: before step N: "Read [path], verify [expectation]"]` | pure new-file creation or doc-only change |
| Q-G20 | Story arc coherence | 4 story-arc elements explicit? (1) problem/need, (2) approach + rationale, (3) expected outcome, (4) testable verification. | IS_TRIVIAL |
| Q-G21 | Internal logic consistency | Cross-phase premise consistency? Flag: contradictory premises, circular reasoning, incompatible state assumptions. | single-phase plan; IS_TRIVIAL |
| Q-G22 | Cross-phase dependency explicitness | Cross-phase deps verified? Flag: ref to artifact missing from prior phase outputs; no pre-consumption check. | single-phase plan; phases are purely additive |
| Q-G23 | Proportionality | Effort proportional to problem? Flag: over-engineering, multi-phase for single-phase work, single-use abstractions. | IS_TRIVIAL; complex problem |
| Q-G24 | Core-vs-derivative ordering | Foundation specified before derivatives (functions before callers, core questions before derivatives)? | doc or config-only plan |
| Q-G25 | Feedback loop completeness | Flag: output consumed by another tool without rejection/partial-success/quality handling. | terminal output only |
| Q-G26 | Domain convention alignment | Follows domain conventions (REST, OAuth, idioms)? New domain → research step? | trivial; pure refactoring; conventions already established |
| Q-G27 | Assumption validation spike | Unproven risky claims (API behavior, perf, compat) need spike/POC before dependents? | all assertions backed by evidence; IS_TRIVIAL |
| Q-G30 | Experiments Required Before Execution | Does the plan rest on unverified empirical assumption whose resolution could materially change plan structure (perf, API behavior, classifier capability)? | all assumptions backed by evidence; IS_TRIVIAL |
| Q-G31 | Accidental Feature Removal | Does plan disable code reachable via async/event entry points (triggers, listeners, webhooks) or dynamic dispatch? | purely additive |

### Gate 3 — Advisory (weight 1)

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-G6 | Naming consistency | New names match codebase style? | no new names |
| Q-G7 | Documentation | MEMORY.md/CLAUDE.md/README affected? | no behavior changes |
| Q-G16 | LLM comment breadcrumbs | LLM-navigable comments at key points for complex changes? | doc/config only; trivial fix |
| Q-G17 | Phase preambles | >=2 phases: 1-3 sentence intent preamble per phase. | single-phase plan |
| Q-G19 | Phase failure recovery | Multi-phase: partial-commit risk addressed (independently safe, revert steps, or gates)? | single-phase; purely additive |
| Q-G28 | Context skills invoked | Domain decisions sans project context when retrieval skills available? | no context skills; purely mechanical |
| Q-G29 | File/State Organization | Align with naming/subdirectory/state conventions? | purely additive new-dir; organization addressed |
| Q-G32 | Source-path tracking | Branch context carried to consumption point via tracking flag for multi-branch variables? | single upstream path |

---

## Layer 2: Technical Rigor
*36 questions organized into 5 concern clusters. (UI cluster moved to Layer 3).*

### Cluster 1: Impact & Architecture (Always Active)

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C3 | 1 | Impact analysis | Other callers/features affected? Cross-ref call sites checked? | fully isolated |
| Q-C8 | 2 | Interface consistency | Modified signatures match siblings; callers updated? | no sig changes |
| Q-C12 | 3 | Duplication | No reimplementation of existing utilities? | no new functions |
| Q-C14 | 2 | Bolt-on vs integrated | Extend existing modules vs parallel bolt-ons? Flag duplication of existing concern. | purely additive; HAS_EXISTING_INFRA=false |
| Q-C26 | 2 | Migration tasks | Persistent data/config/API changes need migration? | no change to data formats/state |
| Q-C27 | 2 | Backward compatibility | Public API/CLI breaking changes: migration path or versioning included? | internal-only |
| Q-C32 | 2 | Bulk data safety | Unbounded data chunked/streamed/paginated? | HAS_UNBOUNDED_DATA=false |
| Q-C35 | 2 | Agent cognitive load | Analytical load calibrated (>6 reasoning Qs vs >500 lines)? | no analytical agent calls |
| Q-C37 | 2 | Translation boundary spec | Abstract→concrete steps specified with methodology/examples? | no translation steps |
| Q-C38 | 2 | Cross-boundary API contract | Assumed signature matches independently-versioned target's current def? | single-repo/package change |
| Q-C39 | 2 | Data access vs schema | Key paths match schema? CLI output parsing version-pinned? | no data reads; verified by Read |
| Q-C40 | 2 | Guidance-implementation consistency | Every behavioral claim in narrative/comments has implementing step? | no guidance text/comments |

### Cluster 2: Testing & Plan Quality (Always Active)

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C4 | 2 | Tests updated | Tests for changed signatures, new error paths, bug fixes? | pure visual |
| Q-C5 | 2 | Incremental verification | Each step has a checkpoint (not all-testing-at-end)? | single atomic |
| Q-C9 | 2 | Step ordering | Explicit DAG; no refs to uncreated files? | single step |
| Q-C10 | 2 | Empty code | No stubs/TODOs without full spec? | no placeholders |
| Q-C11 | 3 | Dead code | Old implementations marked for removal? | nothing replaced |
| Q-C29 | 2 | Test strategy defined | Acceptance criteria/named cases stated upfront? | cosmetic/doc-only; single-line fix |
| Q-C43 | 2 | Test-blast radius | Tests cover all callers/workflows identified as affected? | no callers affected |

### Cluster 3: State & Data Integrity (Active when HAS_STATE=true)

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C13 | 2 | State edge cases | Persistent storage: state-exists + state-absent covered? | no storage |
| Q-C18 | 2 | Concurrency | Shared state locked; background tasks: concurrency plan? | read-only |
| Q-C19 | 2 | Idempotency | Retry-safe operations; mutations deduped? | read-only |
| Q-C24 | 2 | Local↔remote sync | Local→remote sync strategy explicit? Stale reads avoided? | local-only |
| Q-C36 | 2 | Persistence staleness | Persisted artifact reuse: staleness check (hash/timestamp)? | no persistent artifacts |

### Cluster 4: Security & Reliability (Always Active)

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C15 | 2 | Input validation | Untrusted inputs sanitized at trust boundaries? | no untrusted input |
| Q-C16 | 2 | Error handling | Try/catch external calls; actionable errors; fail-loud? | no new error paths |
| Q-C22 | 2 | Auth/permission additions | New API services/OAuth scopes — user impact/re-auth noted? | no new services |
| Q-C30 | 2 | Async error completeness | Every async path has error handler? | no async operations |
| Q-C31 | 2 | Resource lifecycle cleanup | Shutdown/error paths clear timers, close connections/procs? | no persistent resources |
| Q-C33 | 2 | Configuration validation | New config deps: startup fail-fast/schema check? | no new config deps |
| Q-C34 | 2 | External call timeouts | Timeouts on all outbound calls (HTTP, DB, APIs)? | no outbound calls |

### Cluster 5: Operations & Deployment (Active when HAS_DEPLOYMENT=true)

| Q | Gate | Question | Criteria | N/A |
|---|------|----------|----------|-----|
| Q-C6 | 2 | Deployment defined | Push steps, target env, verification specified? | local-only |
| Q-C7 | 2 | Rollback plan | Recovery path if deployment fails? | no deployment |
| Q-C20 | 3 | Logging | Informative but compact; no sensitive data? | no server changes |
| Q-C23 | 3 | External rate limits | API quotas/throttling accounted for? | no new API calls |
| Q-C28 | 3 | Observability | Monitoring/alerting addressed? | local-only |
| Q-C41 | 2 | Feature rollback | Post-merge prod reversal strategy (flag/down-migration)? | trivially revertible |
| Q-C44 | 3 | Change observability | Production verification strategy (logs/metrics)? | no prod behavior change |

---

## Layer 3: UI Specialization
*11 questions. Active when HAS_UI=true.*

| Q | Question | Criteria | N/A |
|---|----------|----------|-----|
| Q-U1 | Component structure | Reusable UI components? No monolithic HTML/duplicated patterns. | no new components |
| Q-U2 | State management | UI states (loading/error/empty/data) explicit? Spinners/copy? | purely presentational |
| Q-U3 | Interaction feedback | Disable-during-submit, progress indicator, success/error toast. | no interactive elements |
| Q-U4 | Responsive constraints | Container-aware (Sidebar=300px)? No overflow/fixed widths. | no layout changes |
| Q-U5 | Accessibility basics | labels, id/for, logical tab order, keyboard nav. | no new interactive elements |
| Q-U6 | Visual consistency | Matches design system (fonts, colors, spacing)? | no visual changes |
| Q-U7 | UI design narrative | Narrative titled UI Design Narrative (2-5 sentences on flow/intent). | purely presentational |
| Q-U8 | Iterative UI verification | visual verification step (devtools/screenshot) included? | no visual UI changes |
| Q-U9 | CSS/HTML organization | Inline styles avoided; separation of layout/theme/component. | no CSS/HTML changes |
| Q-C17 | Event listener cleanup | Listeners removed to prevent accumulation/leaks? (Gate 2) | no new listeners |
| Q-C25 | UI error boundary | Client error boundary for silent failures? window.onerror. (Gate 3) | no new client logic |

---

## Layer 4: Platform - Google Apps Script
*54 questions. Active when IS_GAS=true.*

**Shared Overlaps:** Many GAS questions are specializations of Layer 1/2.
- Q13 (Standards) → Q-G14
- Q15 (Simplicity) → Q-G1
- Q16 (Interfaces) → Q-C8
- Q18 (Impact) → Q-C3
- Q27 (Input) → Q-C15
- Q28 (Errors) → Q-C16
- Q38 (Unintended) → Q-G4
- Q39 (Duplication) → Q-C12/Q-G12
- Q41 (Integration) → Q-C14

### Gate 1 — Blocking (weight 3)
| Q | Topic | Criteria |
|---|-------|----------|
| Q1 | Branching Strategy | Plan must name branch and include merge-to-main + push-to-remote. |
| Q2 | Branching Usage | Incremental commits following project conventions (feat/fix/chore). |
| Q13 | Standards | Shared modules (common-js), HTML (raw:true), `__events__`, loadNow. |
| Q15 | Simplicity | Avoid over-engineering (premature abstractions) or under-engineering (missing error handling). |
| Q18 | Impact Analysis | Cross-ref changed modules against all callers (grep `require`). |
| Q42 | Post-impl Review | Mandatory section: `/review` loop, build, tests. |

### Gate 2 — Important (weight 2)
- **Workflow:** Q3 (Sync local/remote), Q4 (Folder/Order), Q5 (Right tools), Q6 (Exec verify), Q7 (Common-js sync), Q49 (V8 parsing order).
- **Process:** Q9 (Deployment), Q10 (Rollback), Q11 (Tests), Q12 (Incremental verify), Q16 (Interfaces), Q17 (Step ordering), Q19 (Empty code), Q20 (Dead code).
- **Runtime:** Q21 (Concurrency), Q22 (6-min limit), Q23 (OAuth scopes), Q24 (Idempotency), Q40 (State exists/absent), Q50 (Namespace collision), Q52 (Exec mechanism), Q53 (Container-bound separation), Q54 (GCP association).
- **Security/Reliability:** Q27 (Input validation), Q28 (Error handling), Q29 (Logging).
- **Gmail/CardService:** Q44 (Stateless structure), Q45 (Action handlers), Q46 (Access token), Q47 (Nav balance), Q48 (Triggers).
- **UI:** Q32 (Listener cleanup).

### Gate 3 — Advisory (weight 1)
- **Details:** Q8 (Isolated state), Q14 (Naming), Q25 (Quotas), Q26 (Storage limits), Q30 (UX feedback), Q31 (Accessibility), Q33 (Error boundary), Q34 (CSS conflicts), Q35 (LLM comments), Q36 (Breadcrumbs), Q37 (Doc), Q43 (Legibility), Q51 (Debug logging).

---

## Layer 5: Platform - Node.js / TypeScript
*38 questions. Active when IS_NODE=true.*

**Shared Overlaps:**
- N8 (Concurrency) → Q-C18
- N20/N21 (Naming/Doc) → Q-G6/Q-G7

### Gate 1 — Blocking (weight 3)
| Q | Topic | Criteria |
|---|-------|----------|
| N1 | TypeScript Build | Plan must include `tsc --noEmit` or equivalent compile step. |

### Gate 2 — Important (weight 2)
- **TypeScript/Deps:** N2 (npm changes), N3 (Lock file), N4 (Type safety), N5 (tsconfig), N11 (Module system), N12 (Circular deps), N30 (Monorepo phantoms), N37 (Declaration output).
- **Async/Runtime:** N6 (Async errors), N7 (Floating promises), N8 (Concurrency), N14 (Memory/Streaming), N22 (Event loop), N23 (ReDoS), N24 (Stream pipeline), N25 (EventEmitter), N27 (Child procs/Workers), N28 (HTTP timeouts).
- **Lifecycle/Env:** N9 (Env vars), N10 (Config hygiene), N13 (Graceful shutdown), N33 (Secrets), N35 (Crash safety), N36 (K8s/Container shutdown).
- **Framework/Ops:** N15 (Framework integration), N16 (Node version), N17 (Security surface), N18 (Database migrations).

### Gate 3 — Advisory (weight 1)
- **Quality:** N19 (Test isolation), N26 (Timer cleanup), N29 (Path handling), N31 (Docker concerns), N32 (Native addon compat), N34 (API contract drift), N38 (Health checks).

---

## Post-Convergence & Epilogue
*Evaluated once after convergence loop.*

| Q | Question | When |
|---|----------|------|
| Q-G9 | Organization Pass (Sequential clarity, Concurrency labeling, Scannability, DAG visibility) | After convergence |
| Q-E1 | Git lifecycle (Branch name, add+commit per phase, Push, Merge) | Epilogue |
| Q-E2 | Post-implementation workflow (Review-fix loop, build, tests) | Epilogue |
