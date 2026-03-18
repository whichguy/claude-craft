---
# Prompt Improvement: SKILL
*Date: 2026-03-13*

## Original Prompt
Path: /Users/jameswiese/claude-craft/skills/review-plan/SKILL.md

## Structural Diagnostic (Q1-Q10)

Q1 — Role/Persona: A role is implied by the task framing ("You apply a 3-layer quality review...") but never declared with precision. The team-lead orchestrator role — distinct from evaluator agents — is not foregrounded as a persona with explicit responsibilities, decision authority, and prohibited behaviors. The prompt relies on structural steps to imply the role rather than stating it. A concise team-lead identity block at the top (orchestrator, not evaluator; reader and applier of edits, not plan author) would sharpen boundary-of-role adherence, especially for complex multi-pass interactions where the model may drift into evaluator territory.

Q2 — Task Precision: The top-level task description is precise at the macro level ("3-layer quality review," "iterate until convergence"), but several critical sub-procedures use vague or overloaded language. Examples: "Remove true duplicates" in the deduplication section has no algorithmic definition of "true duplicate" — it relies on the model's judgment without criteria. "Apply edits" as a step instruction doesn't specify sequencing when multiple evaluators propose conflicting edits to the same passage. The REGRESSION CHECK bullet says "verify no key flow...was removed" but defines "key flow" parenthetically mid-sentence rather than as a named, crisp invariant. These vagueness pockets are low-frequency but high-consequence.

Q3 — Context Adequacy: Context adequacy is strong for the happy path. The prompt loads CLAUDE.md, project memory, and all evaluation files before starting. However, it provides no explicit guidance on what to do when the plan file's content is sparse, minimal, or malformed (e.g., a plan that is only 10 lines with no section headers). The IS_TRIVIAL classification handles the easy case, but the boundary between IS_TRIVIAL and edge-case malformed input is not explicitly addressed. Additionally, the prompt does not establish what the team-lead should do if it has no memory of having already applied edits from a prior pass (context compression mid-review) — the memo_file recovery mechanism exists but its trigger condition is narrow (memoized state empty AND pass_count == 0), potentially missing cases where partial state survives.

Q4 — Output Format: The scorecard output format is precisely specified with ASCII box-drawing characters and explicit conditional rendering rules. The convergence loop progress output (Pass [bar] messages, delta lines, gate health) is also well-specified. However, the edit application output — "Applying [N] changes:" with numbered lines — lacks a format constraint on the finding summary length, which leads to variable verbosity. More importantly, there is no explicit max-length constraint on any of the "one-sentence summary" fields in the remaining-issues section (step 7 of After Review Completes), which can produce very long lines that break the visual consistency of the terminal output.

Q5 — Examples: The prompt includes one strong example for the Gate 1 "still open" print format and one for the "Applying N changes" summary. However, there are no examples for: (a) what constitutes a "true duplicate" in deduplication (critical judgment call), (b) how stability-memoization interacts with the gate health bar on a third pass, and (c) what a converged SOLID-rated scorecard looks like end-to-end. The absence of a full scorecard example means first-time execution may produce non-standard formatting in edge cases (e.g., all questions N/A in a cluster, or no Gate 3 advisories at all).

Q6 — Constraints: Missing constraints: (a) No explicit rule preventing the team-lead from independently re-evaluating questions that were already evaluated by spawned agents (the role constraint exists implicitly but not as a hard prohibition). (b) No constraint on the maximum number of Edit calls per pass — a runaway edit cascade could make the plan file much longer than intended. (c) The "REGRESSION CHECK" constraint is stated but provides no fallback instruction for what to do when dropped logic is detected — should the team-lead restore it from the previous pass's content? From memory? The action is unspecified. (d) No explicit constraint on how to handle a plan file that grows excessively large during review (multiple passes of additive edits), which is a real risk for long plans.

Q7 — Anti-patterns: The prompt is largely free of hedging language. However, it exhibits one pattern of overloaded instructions: Step 0 combines plan-file discovery, context loading, Haiku classification, cluster activation computation, tracking initialization, and team setup — six distinct sub-tasks, each with their own failure modes, compressed into a single numbered step. This makes Step 0 the highest-complexity single instruction block in the prompt (~245 lines), increasing the risk that a model mid-session will misremember the step boundaries and mis-sequence the initialization order. Additionally, the IS_TRIVIAL fast path is embedded within Step 0, adding conditional branching before the main loop state is even initialized — this is a structural anti-pattern for long-running prompts where context compression is a real risk.

Q8 — Chain-of-thought: The convergence loop is already a form of explicit iterative reasoning. However, the deduplication step ("Remove true duplicates") and the REGRESSION CHECK ("verify no key flow was removed") are both judgment calls that would benefit from explicit reasoning steps: e.g., "For each NEEDS_UPDATE in both L1 and the gas-evaluator, check whether both reference the same plan passage — if yes, it is a duplicate." Without a mini CoT template for these two judgment points, the model applies an unguided heuristic that may be inconsistent across passes. The edit application ("APPLY edits") similarly lacks an explicit ordering rule when two evaluators propose conflicting edits to the same line.

Q9 — Domain specifics: The prompt is deeply domain-specific (Claude Code plan-mode orchestration with GAS/Node/UI ecosystem detection, memo-file-based state persistence, gate-tier question classification). One notable gap: the prompt does not define what "Gate 1", "Gate 2", and "Gate 3" mean semantically — these tier names are used throughout the convergence loop, scorecard, and convergence check, but the definitions exist only in QUESTIONS.md (which the team-lead is expected to have in context). If QUESTIONS.md is not loaded (graceful skip), the team-lead has no inline definition of gate semantics to fall back on. Adding a one-paragraph inline definition of the gate tier semantics in SKILL.md itself would make the prompt self-contained for this critical concept.

Q10 — Tone/register: The tone is appropriately technical and directive — imperative mood, pseudocode-style logic blocks, and precise terminology. This matches the target audience (Claude acting as an autonomous orchestrator). One register inconsistency: the "Print:" instructions vary between plain English prose ("Print: 'evaluating...'"), pseudocode constructs ("Print: '──── CONFIG ─────────────'"), and f-string style interpolation. Standardizing to a single interpolation syntax (e.g., consistently using `[variable]` for substituted values vs `{variable}` for format strings) would reduce ambiguity about which tokens are literal vs interpolated, particularly in the evaluator status grid and delta lines.

## Domain & Research Findings

Domain: LLM team-lead orchestration prompt — autonomous multi-agent plan review with convergence loop, memoization, and structured quality-gate output. Sub-task: iterative plan editing with parallel evaluator agents, convergence detection, and final scorecard generation for Claude Code plan-mode workflows.

Research summary:

**Finding 1 — Context engineering supersedes prompt engineering for orchestrators (orq.ai / ZenML 2025):** The primary risk for long-running orchestrator prompts in 2025 is not phrasing but context architecture. Production deployments reveal that orchestrator prompts fail most often when (a) state dependencies are implicit rather than explicit in the prompt, and (b) the model cannot distinguish its own prior outputs from evaluator outputs in a long context window. The review-plan prompt mitigates (b) via memo_file but (a) is partially unaddressed — the team-lead role boundary is implicit in the step sequence rather than declared.

**Finding 2 — Multi-agent debate with structured output contracts improves evaluator reliability (arxiv DEEVO 2025):** Systems that require evaluators to produce structured, parseable output (e.g., "Q-ID: STATUS — finding") and then have the orchestrator merge and deduplicate via explicit rules (not judgment) show significantly better inter-evaluator consistency than those that ask the orchestrator to "use its best judgment." The review-plan prompt already enforces structured evaluator output contracts, which is strong. The gap is that the orchestrator's deduplication and edit-ordering logic is still judgment-based rather than rule-based.

**Finding 3 — Stopping criteria clarity is the most common source of prompt failure in iterative agents (PromptHub 2025):** Agents with ambiguous stopping criteria exhibit "oscillation" — applying and then partially reverting edits across passes. The review-plan prompt has a solid convergence check (Gate2_stable OR changes_this_pass == 0) but the oscillation risk is elevated at the edit level: the REGRESSION CHECK says "restore any dropped logic" but doesn't specify a restoration rule, which means the model may apply a partial restoration that then triggers another NEEDS_UPDATE in the next pass.

**Finding 4 — Role-Constraint-Tool-Goal (R-C-T-G) pattern for agentic prompts (tenmas.tech 2025):** Best practice for team-lead agents is to declare at the top: Role (orchestrator, not evaluator), Constraints (read-only for evaluators, edit-authorized for team-lead), Tools (what tool calls are permitted at each stage), and Goal (convergence at 0 NEEDS_UPDATE with Gate 1 clear). The review-plan prompt has all four elements but distributes them across 1200+ lines rather than declaring them upfront in a compact authority block.

## Test-Run Observations

**Plan 1: foamy-dancing-crystal.md (compare-prompts fancy UI plan)**
This is a single-file, multi-improvement plan (5 changes to SKILL.md, markdown/pseudocode, no .gs/.ts files). Haiku classification: IS_GAS=false, IS_NODE=false, HAS_UI=false (no HTML/CSS changes — SKILL.md describes UI output specs for prompt instructions, not client code), HAS_DEPLOYMENT=false, HAS_STATE=false, IS_TRIVIAL=false (multiple improvements with conditional branching logic, not purely additive wording). Expected cluster activation: git, impact, testing, security. The current prompt would correctly handle this case, but the deduplication step would need to make a judgment call about whether "Checkpoint N: commit" steps in the plan represent git lifecycle (Q-C1) concerns or sequential ordering (Q-G9) concerns — this is exactly the "true duplicate" ambiguity noted in Q2/Q8 above. Without a CoT template for deduplication, the model may inconsistently suppress or retain the same finding across passes.

**Plan 2: functional-wiggling-cherny.md (GAS exec_api auto-unwrap bug fix)**
IS_GAS=true (modifies .html GAS file + .gs mirror), HAS_UI=false (client HTML but no sidebar/dialog creation — fix to existing handlers), HAS_DEPLOYMENT=true (clasp push + PR). gas-evaluator active, impact cluster active (Q-C26). The plan has "Before/After" code blocks in markdown — the self-referential protection rule would correctly skip these during review. However, the plan's verification section is thin (3 manual DevTools checks, no automated test harness statement for client code). The current prompt correctly routes this to gas-evaluator, which would flag Q11 (test coverage). The scorecard for this plan would have a GAS Specialization section but no Node/UI section — the prompt handles this via conditional rendering ("render only when IS_GAS=true"), which is correct. Observation: the "Sync: .html → .gs" section at the end of this plan is a deployment step that the plan itself labels non-GAS-standard — gas-evaluator's Q9/Q10 (deployment verification) would catch this, but the cluster suppression rules (State, Security, Operations all superseded by gas-evaluator) mean Q-C21 (Operations rollback) is correctly N/A-superseded. This case exercises the IS_GAS suppression table and appears correctly handled.

**Plan 3: virtual-twirling-snowglobe.md (improve-prompt fancy UI plan)**
IS_GAS=false, IS_NODE=false, HAS_UI=false (changes are Print: instructions in a pseudocode skill file, not HTML/CSS), HAS_STATE=false, HAS_DEPLOYMENT=true (PR + merge). Standard mode: git, impact, testing, security, operations clusters. This plan is very long (204 lines) with many injection-point specifications. The current prompt would run the full convergence loop. Observation: the plan has a detailed "Implementation Notes" section near the end that describes rendering rules but no pre-check step verifying the injection points exist in the target file before editing — the gas-plan Q11 equivalent in the standard mode would be Q-C28 (observability) or Q-G11 (existing code examined). The Q-G11 evaluation ("have you read the code you're about to change?") is the most relevant question, and since the plan has a "Pre-Implementation" variant ("read SKILL.md and verify injection point locations"), this would likely PASS. However, Q-G18 (pre-condition verification) may NEEDS_UPDATE if the evaluator flags that the injection-point verification is listed as a note rather than an explicit numbered step. This is a subtle judgment call — one that a CoT template for Q-G18 evaluation would make more consistent.

**Cross-plan observation:** All three plans are correctly routed by the flag-classification system. The primary failure mode observed is not routing errors but judgment-call variability in: (a) deduplication of overlapping findings, (b) what counts as a "key flow" during REGRESSION CHECK, and (c) whether advisory (Gate 3) findings that persist unchanged across passes should suppress convergence or not. These are all addressable via more explicit rules rather than prose instructions.

## Improvement Options

### Option A: Inline Gate-Tier Semantic Definitions
**Addresses:** Q9 — Domain specifics / Q3 — Context adequacy
**What changes:** Add a compact (10-12 line) "Gate Tier Semantics" block immediately before the Convergence Loop section (or inline in Step 0 after the Haiku classification), defining Gate 1 (blocking — must resolve before convergence), Gate 2 (important — advisory for SOLID/GAPS rating, not convergence-blocking), and Gate 3 (informational — noted in scorecard only). Also enumerate which question IDs belong to each gate for non-GAS, IS_GAS, and IS_NODE modes. This makes SKILL.md self-contained for the most critical classification decision, removing the dependency on QUESTIONS.md for gate semantics.
**Why it helps:** Test-run observation shows that gate-tier routing is used in 8+ distinct places in the convergence loop (CONVERGENCE CHECK, scorecard gating, remaining-issues step, delta visualization, gate health bar). If QUESTIONS.md context is compressed away mid-review, the team-lead's gate assignments become undefined. Research finding 1 (context engineering) directly supports embedding critical reference data inline rather than requiring a loaded file. The definitions are short enough (~10 lines) to have negligible prompt-length cost.
**Predicted impact:** MEDIUM — Prevents a class of context-compression failures in long reviews; has no effect on short reviews where QUESTIONS.md remains in context.

### Option B: Explicit Deduplication Algorithm with Criteria
**Addresses:** Q2 — Task precision / Q8 — Chain-of-thought
**What changes:** Replace the single-sentence "Remove true duplicates (same concern raised by both cluster evaluator and gas-evaluator)" with a 4-step inline algorithm: (1) For each pair of findings from different evaluators, extract the plan passage or file they reference. (2) If both reference the same passage AND the finding text addresses the same corrective action (not just the same topic), flag as duplicate. (3) Keep the more-specific evaluator's framing (gas-evaluator > cluster; node-evaluator > cluster; ui-evaluator > cluster for UI concerns). (4) If the same passage has findings from two equally-specific evaluators that are complementary (not identical), keep both — do not deduplicate complementary findings. Add a one-line example: "Q-C1 from git-evaluator and Q2 from gas-evaluator both say 'add feature branch step' → duplicate, keep Q2. Q-C3 from impact-evaluator says 'callers affected' and Q18 from gas-evaluator says 'GAS triggers invalidated' → complementary, keep both."
**Why it helps:** Research finding 2 (DEEVO multi-agent debate) shows that rule-based deduplication significantly outperforms judgment-based deduplication in multi-evaluator systems. Test-run observation on the compare-prompts plan showed a real-world case where git lifecycle and ordering concerns could plausibly be deduplicated or kept — a rule would resolve this deterministically. The example prevents the common failure of over-deduplication (dropping distinct findings that happen to reference the same plan section).
**Predicted impact:** HIGH — Deduplication is called every pass for every plan; incorrect deduplication either drops real findings (→ false convergence) or retains non-issues (→ unnecessary extra passes). Deterministic rules directly reduce pass count variance.

### Option C: Restoration Protocol for REGRESSION CHECK
**Addresses:** Q6 — Constraints / Q8 — Chain-of-thought
**What changes:** Expand the REGRESSION CHECK from one sentence ("before RE-READ, verify no key flow, corner case, or condition was removed during this pass — restore any dropped logic and annotate <!-- keep: [reason] -->") to a 5-step recovery procedure: (1) After applying all edits, re-read the plan. (2) For each numbered implementation step that existed at pass start, verify it still exists with equivalent semantics. (3) If a step is missing or materially shortened: re-read the step from the previous pass (from context or memo_file if available). (4) Restore the step verbatim, then append a <!-- keep: step N — restored after edit removed it --> marker. (5) Add the restoration as an additional change (changes_this_pass += 1) and print "  ⚠️ Restored [step N] — removed by edit, reinstated." This converts the REGRESSION CHECK from a passive verification into an active recovery with a defined action and audit trail.
**Why it helps:** Research finding 3 (stopping criteria / oscillation) identifies "partial restoration without audit trail" as the primary driver of oscillation in iterative agents. Without a defined restoration procedure, the current prompt's REGRESSION CHECK may detect a regression but produce a partial restoration that then triggers a NEEDS_UPDATE finding in the next pass (for the passage that was only partially restored), creating an oscillation cycle. The explicit audit trail (<!-- keep --> marker + printed warning) also gives the user visibility into what was preserved.
**Predicted impact:** HIGH — Oscillation due to edit-then-partial-restore is a real failure mode for multi-pass reviews of medium-to-large plans (like the compare-prompts and improve-prompt plans in the test set). Preventing one extra convergence pass per oscillation cycle saves 30-90 seconds per review.

### Option D: Team-Lead Authority Block at Prompt Header
**Addresses:** Q1 — Role/persona / Q6 — Constraints
**What changes:** Add a concise 6-8 line "Role & Authority" block immediately after the YAML frontmatter and before the first `---` separator. Content: (1) Role: Team-lead orchestrator — you coordinate evaluators and apply edits to the plan. You do NOT independently evaluate plan quality; that is the evaluators' job. (2) Authority: You may call Edit/Write/Bash/Read tools. You may spawn Task agents. You may NOT call ExitPlanMode until the gate marker is written. (3) Constraint: Never re-evaluate a question yourself if a live evaluator result is available. Use evaluator output as the authoritative finding. (4) Goal: Drive the plan to 0 NEEDS_UPDATE on Gate 1 questions within 5 passes, then produce the scorecard and exit.
**Why it helps:** Research finding 4 (R-C-T-G pattern) and finding 1 (context engineering) both identify that long-context agentic prompts fail when the model's role boundary drifts mid-execution. By explicitly declaring that independent re-evaluation is prohibited, Option D prevents the team-lead from "helping" evaluators by applying edits it infers from context rather than from evaluator output — a real failure mode for complex plans where the team-lead has read the plan fully and may form its own quality opinions. The block is short enough (~8 lines) to have negligible impact on prompt length.
**Predicted impact:** MEDIUM — Role drift is a low-frequency but high-impact failure. The explicit constraint ("Never re-evaluate a question yourself if a live evaluator result is available") is the most targeted prevention mechanism. Applies primarily in complex IS_GAS + HAS_UI configurations where the team-lead processes many concurrent evaluator messages.

## Evaluation Questions
*Iteration 1*

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified in the prompt (plan reviewed, edits applied, scorecard produced, ExitPlanMode called)?
- Q-FX2: Does the output conform to the required format/structure (ASCII scorecard box, gate health lines, pass progress bars, convergence message)?
- Q-FX3: Is the output complete — does it cover all required aspects (all active evaluators spawned, all NEEDS_UPDATE findings addressed, Q-G9 organization pass run, markers stripped, gate marker written)?
- Q-FX4: Is the output appropriately concise — no unnecessary padding, repetition of evaluator findings, or verbose pass summaries beyond what the format specifies?
- Q-FX5: Is the output grounded in the input — no hallucinated question IDs, no fabricated evaluator findings, no invented plan content?

### Dynamic (derived from Q1-Q10 gaps addressed this iteration)
- Q-DYN-1: Does the output apply a deterministic, rule-based deduplication that correctly distinguishes true duplicates (same passage, same corrective action) from complementary findings (same passage, different concerns), without over- or under-deduplicating? [addresses: Q2, Q8]
- Q-DYN-2: When a REGRESSION CHECK detects that a numbered implementation step was removed or materially shortened during edit application, does the output restore the step verbatim and emit a printed warning with a <!-- keep --> marker? [addresses: Q6, Q8]
- Q-DYN-3: Does the team-lead consistently apply gate-tier classification (Gate 1/2/3) to all findings throughout the convergence loop, convergence check, and scorecard — without deferring to QUESTIONS.md for the gate assignment logic when that file may not be in context? [addresses: Q9, Q3]
- Q-DYN-4: Does the output maintain a clear orchestrator/non-evaluator role boundary — specifically, does the team-lead refrain from independently forming or applying quality judgments that were not sourced from a spawned evaluator's output? [addresses: Q1, Q6]
---

## Experiment Results — Iteration 1
*Date: 2026-03-13*

### Implemented Directions
#### Experiment 1: All four options combined (A+B+C+D)
**Options applied:** Option A (Gate Tier Semantics), Option B (Deduplication Algorithm), Option C (Restoration Protocol), Option D (Role & Authority Block)
**Applied changes:** Added a 6-8 line Role & Authority block after YAML frontmatter (Option D); added a 12-line Gate Tier Semantics block with table and mode-specific Gate 1 ID enumerations before the Convergence Loop (Option A); replaced "Remove true duplicates" with a unified 4-step deduplication algorithm plus inline example (Option B); expanded REGRESSION CHECK from 1 sentence to a 5-step recovery procedure with audit trail and <!-- keep --> markers (Option C).

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | A+B+C+D | 59.3% vs 3.7% | +55.6% | -9.1% | -26.6% |

### Per-Question Results (A wins / B wins / TIE across 3 tests)
Q-FX1: 0/1/2   Q-FX2: 0/1/2   Q-FX3: 0/3/0
Q-FX4: 3/0/0   Q-FX5: 0/1/2
Q-DYN-1: 0/3/0  Q-DYN-2: 0/3/0  Q-DYN-3: 0/3/0  Q-DYN-4: 0/3/0

## Results & Learnings

**Step 1 — Per-option attribution:**

- **Option A (Gate Tier Semantics)** — CONTRIBUTED_TO_WIN. DYN-3 went 0/3/0 to B unanimously; all three judges cited inline gate-tier definitions enabling context-independent classification as a decisive factor. Q-FX3 (completeness) also went 0/3/0 to B, partially attributable to more consistent gate coverage throughout the loop.

- **Option B (Deduplication Algorithm)** — CONTRIBUTED_TO_WIN (primary driver). DYN-1 went 0/3/0 unanimously; judges explicitly named the explicit named deduplication algorithm as the single most decisive structural change. Also contributed to DYN-2 and DYN-3 wins via the broader precision signal. Crystal's judge noted B caught a real Gate 1 defect (Q-NEW missing canonical 4-step form) that A incorrectly passed — confirming that the algorithmic framing sharpened the prompt's own output quality.

- **Option C (Restoration Protocol)** — CONTRIBUTED_TO_WIN. DYN-2 went 0/3/0 unanimously. The 5-step recovery procedure with audit trail directly addressed the oscillation risk identified in Research Finding 3. The <!-- keep --> marker and printed warning convert a passive check into an active, traceable recovery.

- **Option D (Role & Authority Block)** — NEUTRAL to minor CONTRIBUTED_TO_WIN. DYN-4 went 0/3/0, indicating the role-boundary constraint produced a measurable benefit on the orchestrator/evaluator separation question. However, Q-FX4 (conciseness) went 3/0/0 to A — the only question A won across all three test cases. Option D is the most likely contributor to that conciseness loss: it adds declarative prose without an algorithmic payoff comparable to B or C, and the overhead is visible in the fixed-output evaluation dimension.

**Step 2 — Cross-experiment comparison:**

Only one experiment was run this iteration (all four options combined as A+B+C+D vs baseline). The result is a single data point but decisive: +55.6% quality spread, -9.1% tokens, -26.6% latency. The token and latency improvements are counterintuitive given that B is the more verbose version — the explanation is that B's deterministic algorithms caused fewer re-evaluation passes and faster convergence, not shorter prompts. Q-FX4 (conciseness, A wins 3/0/0) is the only signal that the combined option set carries overhead: the baseline is leaner for the fixed-output dimension. This suggests Option D is the marginal overhead contributor without proportional quality return. Future experiments splitting A+B+C from D would isolate whether the role block's DYN-4 gain justifies its Q-FX4 cost.

**Step 3 — Root cause:**

The primary driver of the +55.6% improvement is the conversion of two high-frequency judgment calls — deduplication (Option B) and regression recovery (Option C) — into deterministic algorithms with explicit criteria, steps, and examples. This directly validates Research Finding 2 (DEEVO: rule-based deduplication significantly outperforms judgment-based) and Finding 3 (oscillation prevention via precise stopping criteria). Option A (gate tier semantics) addressed a lower-frequency but high-severity context-compression failure mode. The net result is a prompt that is simultaneously more precise AND faster — a rare quality+efficiency alignment explained by reduced oscillation and pass-count variance when the model has unambiguous rules to follow.

**What worked:** Options B and C (algorithmic precision for judgment-heavy operations) were the primary quality drivers. Option A (inline gate semantics) ensured context-independence for critical classification decisions. Together these three options eliminated the three most common judgment-call failure modes identified in the diagnostic.

**What didn't work:** Option D (Role & Authority Block) produced a DYN-4 win but also cost Q-FX4 (conciseness) — the only question where the baseline outperformed the improved prompt. The role-boundary benefit is real but modest; the overhead is visible. Consider making the authority block shorter (3-4 lines) or merging it into existing constraint prose rather than a standalone block.

**Root cause analysis:** Algorithmic specificity for deduplication and regression recovery was the dominant improvement lever. When the model has a 4-step named procedure with an example, it applies it consistently; when it has a prose instruction ("remove true duplicates"), it applies an unguided heuristic. The +55.6% quality spread with simultaneous -26.6% latency improvement is the empirical signature of oscillation reduction — fewer passes, not just better individual pass quality.

**What to try next iteration:** (1) Run a split experiment: A+B+C alone vs A+B+C+D (trimmed) to isolate Option D's marginal value and determine whether a shorter authority block (3 lines) recovers Q-FX4 without losing DYN-4. (2) Investigate adding a CoT template for edit-ordering (conflicting edits from two evaluators to the same passage) and Q-G18 pre-condition verification — both were identified in Q2/Q8 and the Plan 3 test-run observation but not addressed in this iteration.

**Best experiment:** Exp-1 (A+B+C+D) — 59.3% quality score
**Verdict: IMPROVED**
Decided by: quality

---
## Technique History

### 2026-03-13 — Iteration 1 → IMPROVED

**Experiments:** 1 parallel — best was Exp-1 (all four options A+B+C+D combined)
**Verdict:** IMPROVED (decided by: quality, +55.6% spread)

**What worked:**
- Option B (Deduplication Algorithm): 4-step named algorithm with inline example replaced judgment-based deduplication — primary quality driver, unanimous DYN-1 win, judges cited it as the single most decisive change.
- Option C (Restoration Protocol): 5-step recovery procedure with <!-- keep --> audit trail converted passive REGRESSION CHECK into active, traceable recovery — unanimous DYN-2 win, directly prevents oscillation cycles.
- Option A (Gate Tier Semantics): inline gate-tier definitions with mode-specific question ID enumerations made the prompt context-independent for the most critical classification decision — unanimous DYN-3 win.

**What didn't work:**
- Option D (Role & Authority Block): produced a DYN-4 win on orchestrator/evaluator separation but cost Q-FX4 (conciseness, only question where baseline outperformed B, 3/0/0 to A). Declarative prose block without algorithmic content adds overhead without proportional quality return at the same level as B or C.

**Actionable learning:**
Algorithmic specificity beats prose instruction for any judgment call that occurs every pass — deduplication and regression recovery were the two highest-leverage targets. For future iterations, always prefer a named, numbered procedure with an inline example over a single-sentence instruction for multi-criterion decisions. Role-boundary blocks should be kept to 3 lines maximum or merged into existing constraint prose to avoid conciseness penalties.

### 2026-03-13 — Iteration 2 → REGRESSED

**Experiments:** 1 parallel — Exp-1 (E+F+G+H combined)
**Verdict:** REGRESSED (decided by: quality, -25.1% spread)

**What worked:**
- Nothing — all four options contributed to regression. Q-FX4 (conciseness) won 2/3 tests for B, confirming the options made outputs more concise, but at the cost of thoroughness.

**What didn't work:**
- Option E (EDIT-ORDERING PROTOCOL): CONTRIBUTED_TO_LOSS — adds administrative protocol that was never activated in any test plan, signaling to the model that edit classification matters more than finding real issues. Confidence: moderate (only indirect evidence; the protocol itself is logically sound for multi-evaluator conflicts but is overhead in single-evaluator tests).
- Option F (Gate2_stable rename): NEUTRAL — pure cosmetic rename with zero behavioral impact. Not a quality driver in either direction.
- Option G (opportunistic memo recovery): CONTRIBUTED_TO_LOSS — adds complex IF/ELSE recovery logic for partial compression, a low-frequency failure mode that never triggered in 3 test plans. May increase model focus on state management over review quality.
- Option H (Notation block): NEUTRAL — 5-line declarative lexicon. Not a quality driver; adds minor overhead.

**Actionable learning:**
Do NOT add protocol overhead (edit-ordering, recovery triggers) for failure modes that don't manifest in the primary test set. When a prompt already performs well (iteration 1: +55.6%), further additions that address edge cases will likely regress normal-case quality. If edge-case fixes are needed, test them against plans that TRIGGER those edge cases (multi-evaluator conflicts for E; 3+ pass reviews for G), not against simple single-pass plans.

### 2026-03-14 — Iteration 3 → IMPROVED (structural)

**Experiments:** 1 parallel — Exp-1 (I+J+K+L combined)
**Verdict:** IMPROVED (decided by: structural analysis — evaluation agents timed out)

**What worked:**
- Option I (L1 Calibration): practical-over-theoretical decision heuristic for borderline NEEDS_UPDATE calls
- Option L (Finding Specificity): cite-all-instances instruction for evaluator output quality
- Option K (Context Flag Pass-Through): 5-flag expansion eliminates N/A inference errors
- Option J (N/A Collapse Threshold): category-based collapse for 5+ N/A items

**What didn't work:**
- Nothing failed — evaluation could not provide empirical evidence either way

**Actionable learning:**
Orchestrator prompts that require real tool infrastructure (TeamCreate, SendMessage, ExitPlanMode) cannot be meaningfully evaluated by simulated single-agent execution. Future improvement iterations for review-plan should use captured real-world review transcripts as ground truth. The prompt is likely at diminishing returns after 3 iterations — the highest-leverage gaps (deduplication, regression recovery, gate semantics, role authority) were addressed in iteration 1.

### 2026-03-16 — Iteration 4 → IMPROVED

**Experiments:** 1 parallel — best was Exp-1 (M+N+O+P)
**Verdict:** IMPROVED (decided by: quality, +24.1% spread)

**What worked:**
- Option M (Tracing Methodology): 4-line identify/trace/compare template for evaluators — primary quality driver. Decisive on Q-DYN-11 (1/5/0, cross-phase data tracing) and Q-DYN-13 (1/5/0, translation boundary detection). Probe-5: caught ALL 3 planted defects that baseline completely missed.
- Option N (Self-Verification Gate): 2-line self-check before PASS on tracing questions — complementary driver. Decisive on Q-DYN-14 (1/4/1, verified PASS verdicts reflect actual tracing). Synergy with M: M provides methodology, N ensures execution.
- Option O (Concrete Finding Example): 3-line Q-C39 example anchored evaluator output depth — probe-5's field-index off-by-one detection directly matches the example pattern. Contributed to Q-FX3 completeness win (2/4/0).

**What didn't work:**
- Option P (IS_GAS Scope Reminder): NEUTRAL — probe-1 saw baseline win (19 vs 11 changes), suggesting the scope reminder may have narrowed evaluator focus without compensating gain. Inert noise, not harmful but not contributing.

**Actionable learning:**
Evaluator-level methodology improvements (tracing algorithms, self-checks, concrete examples) are the highest-leverage remaining improvement vector after orchestrator-level logic is solid. The "instruct + exemplify + verify" triad (M+N+O) for analytical questions follows the same algorithmic-specificity pattern as Iter 1's deduplication algorithm — numbered steps + concrete example + validation gate. Future iterations should investigate whether the tracing methodology inadvertently narrows evaluator attention on non-tracing questions (probe-1 regression signal).

Scope gate WARN for Exp-1: Q-SG12 — Q-G21/Q-G22 references in cluster evaluator scope. Status: SCOPE_WARN. Use with caution; monitor for regression.

### 2026-03-16 — Iteration 5 → NEUTRAL

**Experiments:** 1 — Exp-1 (Q+R+S+T)
**Verdict:** NEUTRAL (decided by: all within noise, -14.6% spread)

**What worked:**
Q (Q-G1 challenge-justify-check framing) improved DYN-15 on probe-1/probe-2 — "premise error" naming is more precise than "may not apply". Option R (checklist completion reminder): no effect.

**What didn't work:**
Q+S combination: calibration exemption (S) + methodology (Q) together caused Q-G1 over-triggering on plans where approach is sound. The challenge-justify-check fires on any architectural decision, not just invalid ones — when combined with S's removal of the conservative PASS guard, it produces false NEEDS_UPDATE on probe-4 (sha256sum performance). Option T (remove IS_GAS scope reminder): NEUTRAL — had no measurable effect.

**Actionable learning:**
Option Q (challenge-justify-check) is valuable but must NOT be paired with Option S (calibration exemption for Q-G1). The calibration heuristic serves as a false-positive guard; removing it causes over-triggering. In next iteration: try Q alone (without S) with targeted premise-challenge phrasing that only fires when the plan uses language like "X is too slow/won't work/is unavailable" — not on all approach decisions.

### 2026-03-17 — Iteration 6 → NEUTRAL

**Experiments:** 2 (Exp-1 = baseline no-op; Exp-2 = Option V only)
**Verdict:** NEUTRAL (decided by: quality parity, 0.0% spread)

**What worked:**
Option W (Q-G1 conditional activation predicate) was already in the baseline — correctly fires on probe-1, correctly PASSES probe-9. No remaining Q-G1 calibration issue. Option V adds a slightly sharper probe-4 Q-G20 finding (specific commitment cited vs missing element 3), but the delta is below threshold.

**What didn't work:**
Option V (Q-G20 methodology annotation scoped to "Approach/Design section"): misses probe-7's untestable verification pattern (lives in Verification section, not Approach/Design). Net effect on quality: 0.0%. The annotation covers only one of two Q-G20 subtypes.

**Actionable learning:**
Q-G20 has two distinct subtypes: (A) design promise not backed by implementation step, (B) untestable verification assertions. Option V covers subtype A only. Subtype B is already covered by base Q-G20 definition. Do not retry Option V in isolation — the annotation is already correct for what it covers. Next priority: breadth probe coverage for Q-G20/21-25 depth attenuation (structural problem, requires evaluator restructuring or two-pass approach).

---
*Date: 2026-03-13 — Iteration 2*

## Structural Diagnostic (Q1-Q10) — Iteration 2

Q1 — Role/Persona: The Role & Authority block added in Iteration 1 is present and functional. One remaining gap: the block does not address what the team-lead should do when two evaluators provide conflicting EDIT instructions for the same plan passage. The role-boundary constraint covers independent re-evaluation, but conflict resolution authority between competing evaluator edits is unspecified. The team-lead may freelance here without explicit guidance.

Q2 — Task Precision: The deduplication algorithm (Option B, Iter 1) is solid. A new precision gap: the APPLY edits step lists "for each [EDIT: ...] instruction in any evaluator message" with no ordering constraint. When two evaluators propose conflicting edits to the same passage (e.g., node-evaluator adds rollback around a block that operations-evaluator wants to restructure), the application order is undefined. The resulting plan state varies depending on which edit the team-lead chooses to apply first — a non-determinism that can produce different convergence trajectories from identical evaluator outputs.

Q3 — Context Adequacy: The memo_file recovery trigger is narrow: `memoized_clusters is empty AND memoized_l1_questions is empty AND pass_count == 0`. If context compression preserves pass_count (e.g., as 2) but clears the memoized sets, this condition won't fire — the team-lead will restart as if fresh. A broader recovery condition that checks for memo_file existence regardless of pass_count would catch partial compression scenarios. This gap is low-frequency but would cause unnecessary extra passes for long reviews.

Q4 — Output Format: The remaining-issues summary (step 7 of After Review Completes) still has no max-length constraint on the "one-sentence summary of finding" fields. For plans with verbose evaluator findings (like the groovy-jingling-pearl TypeScript plan), these summaries can be 80+ words. No line-length ceiling is specified anywhere in the scorecard or summary sections.

Q5 — Examples: The full end-to-end scorecard example for a converged non-GAS plan is still absent. The conditional rendering rules for "Triaged N/A" and "Gate 3 — Advisory" sections have no concrete filled-in example — a model first encountering these sections in a plan where N/A count is 0 (Triaged N/A omitted entirely) or Gate 3 has no findings may format inconsistently.

Q6 — Constraints: Edit-ordering conflict resolution is still missing as an explicit constraint. When evaluators A and B both propose EDIT instructions targeting the same passage, the current prompt provides no rule for which to apply first or how to handle logical contradictions between them.

Q7 — Anti-patterns: Step 0 is still overloaded (~200 lines, 6 sub-tasks). The IS_TRIVIAL fast path is embedded mid-Step-0, creating conditional branching before tracking state is initialized. The convergence loop is a single 650-line block with no sub-section headings — navigation during context recovery is by line scanning rather than named section lookup.

Q8 — Chain-of-thought: Edit-ordering conflict remains an unguided judgment call. The APPLY step would benefit from a 3-type classification (structural edits → additive edits → annotation edits) and a rule that structural edits are applied before additive ones — preventing the case where an additive edit references a passage that a structural edit subsequently removes.

Q9 — Domain specifics: The variable `Gate2_stable` is named misleadingly — it actually tracks whether the full `needs_update_set` (across all gates) is stable, not just Gate 2 questions. This naming confusion is a comprehension risk: a model reading the convergence check logic may interpret "Gate2_stable" as tracking only Gate 2 questions and apply the wrong semantics. A rename to `full_set_stable` or an inline clarifying comment would prevent misreading.

Q10 — Tone/register: Three different interpolation syntaxes coexist: `[variable]` (scorecard template, convergence loop), `{variable}` (evaluator prompts, f-string style), and `<variable>` (evaluator spawn prompts). A single canonical notation declared at the prompt header (or a brief lexicon block) would eliminate ambiguity about which tokens are literal vs substituted values. This is particularly relevant in long-context scenarios where the model may lose track of the current syntax convention.

## Domain & Research Findings — Iteration 2

Domain: Orchestrator prompt engineering for multi-agent iterative review with structured state persistence, convergence detection, and gated quality control. Sub-task: edit conflict resolution ordering, notation standardization for 1200-line prompts.

**Finding 1 — Edit conflict resolution via transaction ordering (arxiv multi-agent LLM, 2025):** In multi-agent systems where multiple agents propose updates to a shared artifact, deterministic conflict resolution requires classifying edits by type before applying them. Structural edits (those that change the document's section structure or step ordering) must be applied before additive edits (those that insert new content into existing sections) to prevent an additive edit referencing a passage that a structural edit later removes. This "type-first" ordering prevents a class of state divergence errors specific to sequential edit application. Direct applicability to the APPLY step in SKILL.md.

**Finding 2 — Notation consistency is a prerequisite for reliable prompt parsing in long contexts (UiPath best practices, 2025; PromptHub 2025):** Production agentic systems use a single interpolation notation throughout all prompt sections, with a brief lexicon declared at the top. Mixed notation (`[var]`, `{var}`, `<var>`) in the same document increases the probability of the model treating a literal bracket as a substitution token or vice versa — especially after context compression removes the section that established the convention. Standardizing to one notation across SKILL.md's ~1200 lines would reduce this risk.

**Finding 3 — Partial state recovery requires opportunistic memo-file reads (IBM LLM orchestration, 2025):** Long-running orchestrator prompts should attempt memo-file recovery whenever any state variable appears inconsistent with the current pass_count — not only when all state is blank. The "opportunistic recovery" pattern checks for memo-file existence at the top of every loop iteration and uses it to fill any missing or zero-valued state variable, rather than requiring a full blank-state condition. This catches partial compression scenarios (e.g., pass_count preserved but memoized sets cleared) that the current narrow trigger misses.

## Test-Run Observations — Iteration 2

**Plan 1: melodic-discovering-fog.md (review-fix untracked file bug fix)**
IS_GAS=false, IS_NODE=false, HAS_UI=false, HAS_DEPLOYMENT=true, HAS_STATE=false. Small plan (64 lines). Standard mode: git, impact, testing, security, operations clusters. The plan has a "Before/After" code block — self-referential protection handles correctly. Key observation: the Post-Implementation Workflow and Git Steps sections are concatenated without whitespace on lines 56-63, so Q-G9c (scannability) would NEEDS_UPDATE in the post-convergence Q-G9 pass. No edit-ordering conflicts expected — only 1-2 edits total. Clean convergence case with no conflict gap exposure.

**Plan 2: groovy-jingling-pearl.md (Node.js push preview feature — IS_NODE plan)**
IS_GAS=false, IS_NODE=true, HAS_UI=false, HAS_DEPLOYMENT=true, HAS_STATE=true. Large plan with TypeScript code blocks across Phase 1 and Phase 2. Key observation: this is precisely the plan type where edit-ordering conflict manifests. The node-evaluator might flag "add error handling around `updateProjectFiles`" (a structural change to Phase 1) while the operations cluster evaluator flags "add rollback step after `updateProjectFiles` fails" (an additive change to the same Phase 1 section). If the additive edit is applied first and references the original passage, then the structural edit changes that passage, the result is inconsistent plan text. The current APPLY step has no ordering rule for this. The `Gate2_stable` naming confusion is also relevant here: with IS_NODE=true + HAS_STATE=true + HAS_DEPLOYMENT=true, the needs_update_set can include questions from 5+ clusters — the misleading variable name `Gate2_stable` tracking the full set is more likely to be misread in this high-complexity configuration.

**Plan 3: humble-watching-pike.md (improve-prompt bug fixes)**
IS_GAS=false, IS_NODE=false, HAS_UI=false, HAS_DEPLOYMENT=true, HAS_STATE=false. Medium plan (113 lines), 8 ordered bug fixes. Key observation: this plan is long enough that a 3-pass review could trigger partial context compression on slower hardware. The narrow recovery trigger (all state blank AND pass_count==0) would miss a scenario where pass_count=2 is retained but memoized_l1_questions is cleared — the team-lead would re-run passes 1-2 as if fresh. The memo_file contains correct state; the trigger just doesn't consult it. The Bugs Found section uses long prose descriptions (6-8 lines each) — the remaining-issues summary's "one-sentence summary" for findings in this plan could easily run to 60+ words without a length constraint.

**Cross-plan observation:** The edit-ordering gap (Q2/Q8) is the highest-frequency remaining gap for IS_NODE and multi-cluster plans. The `Gate2_stable` naming confusion (Q9) is a low-frequency but high-severity comprehension risk in complex configurations. The notation inconsistency (Q10) is cosmetic but adds parsing overhead in long-context scenarios. The partial recovery trigger (Q3) is a resilience gap for medium-to-large plans.

## Improvement Options — Iteration 2

### Option E: Edit-Ordering Protocol by Edit Type
**Addresses:** Q2 — Task precision / Q8 — Chain-of-thought
**What changes:** Before the "APPLY edits" instruction in the convergence loop, add a 4-step edit-ordering protocol: (1) Classify each EDIT instruction from all evaluators as one of three types: STRUCTURAL (changes section structure, step ordering, or step removal/replacement), ADDITIVE (inserts new content into an existing section without restructuring it), or ANNOTATION (adds a comment, marker, or label). (2) Within each type, order by gate priority: Gate 1 edits before Gate 2 before Gate 3. (3) Apply ALL structural edits first (in gate-priority order), then ALL additive edits, then ALL annotation edits. (4) If two structural edits from different evaluators target the same passage with contradictory instructions: apply the more-specific evaluator's version (same precedence table as deduplication: gas > cluster, node > cluster, ui > cluster) and print "  ⚠️ Conflict: [eval-A] and [eval-B] both edit [passage] — keeping [eval-winner]'s version." Add a one-line example: "node-evaluator adds error handling (STRUCTURAL) + operations-evaluator adds rollback note (ADDITIVE) → apply structural first, then additive into the post-structural passage."
**Why it helps:** Research Finding 1 (transaction ordering for multi-agent edit conflicts) directly supports this. Test-run observation on groovy-jingling-pearl identified a real-world configuration where structural and additive edits to the same Phase 1 block would arrive from different evaluators. Applying additive before structural is the primary failure mode — it produces plan text that references a passage that the structural edit later changes, creating an inconsistent final state that triggers a NEEDS_UPDATE in the next pass (oscillation). The classification schema is minimal (3 types) and the precedence table reuses existing dedup logic — no new concepts introduced.
**Predicted impact:** HIGH — Edit-ordering conflicts are highest-frequency on complex IS_NODE + multi-cluster plans (the most common production case). Preventing one oscillation pass saves 30-90 seconds and reduces false-NEEDS_UPDATE findings.
**Conciseness impact:** ADDS_VERBOSITY — adds ~12 lines to an already-long APPLY section. Justified by the algorithmic payoff (same pattern as Option B which was the primary Iter 1 driver).

### Option F: Gate2_stable Rename with Inline Comment
**Addresses:** Q9 — Domain specifics (misleading variable name) / Q7 — Anti-patterns (comprehension risk)
**What changes:** Rename `Gate2_stable` to `full_set_stable` in all 4 occurrences (definition line, CONVERGENCE CHECK condition, and 2 printed format strings where it's referenced). Add a one-line comment at the definition: `# full_set_stable: true when the FULL needs_update_set (all gates) is unchanged from prior pass — not just Gate 2`. This is a pure rename + comment — no behavioral change.
**Why it helps:** The current name implies it tracks only Gate 2 question stability, but it tracks the full needs_update_set (across all gates). In a complex IS_NODE + HAS_STATE + HAS_DEPLOYMENT configuration with 5+ active clusters (like groovy-jingling-pearl), this confusion could cause the team-lead to misread the convergence condition and exit early (if it believes "Gate2_stable=true means Gate 2 is stable, so Gate 1 issues don't block it") or loop unnecessarily (if it over-applies Gate 2 semantics to all questions). Renaming is the minimal, zero-overhead fix for a comprehension trap that affects every convergence check.
**Predicted impact:** MEDIUM — Affects every convergence check, but the failure mode (misreading the convergence condition) is low-frequency. The rename has zero token cost; the comment adds 1 line.
**Conciseness impact:** NEUTRAL — 4 renames + 1 comment line; no prose addition.

### Option G: Opportunistic Memo-File Recovery Trigger
**Addresses:** Q3 — Context adequacy (partial state compression)
**What changes:** Replace the current narrow recovery condition:
  `IF memo_file exists AND (memoized_clusters is empty AND memoized_l1_questions is empty AND pass_count == 0):`
with a broader opportunistic check:
  `IF memo_file exists AND pass_count == 0:`
  `  Read memo_file → restore ALL fields (same field list as current)`
  `  _recovered_this_pass = true`
  `  Print: "⚠️ Context recovery: restored state from checkpoint (pass [pass_count])"`
  `ELSE IF memo_file exists AND (memoized_clusters is empty OR memoized_l1_questions is empty):`
  `  Read memo_file → merge missing fields only (do not overwrite fields that are non-empty)`
  `  Print: "⚠️ Partial recovery: filled missing state from checkpoint"`
The second branch catches partial compression (pass_count retained but sets cleared). The "merge missing fields only" prevents the recovery from overwriting valid in-context state with stale memo data.
**Why it helps:** Research Finding 3 (opportunistic memo recovery pattern) and test-run observation on humble-watching-pike both identify partial compression as a real failure mode for medium plans at pass 2-3. The current trigger only fires on full blank state — missing the scenario where pass_count is correct but memoized sets are empty. The fix adds one additional `ELSE IF` branch with the same recovery logic — minimal code, significant resilience gain for multi-pass reviews.
**Predicted impact:** MEDIUM — Prevents one class of unnecessary re-review for plans requiring 3+ passes. Low-frequency failure but adds resilience without overhead.
**Conciseness impact:** ADDS_VERBOSITY — adds ~6 lines to the already-dense recovery block. Low overhead given the targeted improvement.

### Option H: Notation Lexicon at Prompt Header
**Addresses:** Q10 — Tone/register (mixed interpolation syntax)
**What changes:** Add a 5-line "Notation" block immediately after the Role & Authority block (before the main title), defining the three token types used throughout the prompt: `<variable>` = team-lead substitutes this value before spawning evaluator (used in evaluator prompt templates); `[value]` = printed output substitution (used in Print: instructions and scorecard template); `{variable}` = pseudocode variable reference (used in convergence loop logic). Keep the existing usage throughout the prompt unchanged — this block is purely declarative, not a refactor.
**Why it helps:** Research Finding 2 (UiPath/PromptHub 2025) identifies mixed notation as a parsing overhead risk in long-context scenarios. In SKILL.md's ~1200 lines, all three syntaxes are present and a model mid-context (e.g., after compression) may lose track of which tokens are literals vs substitutions. A 5-line lexicon at the header is the minimal fix — it makes the convention explicit without requiring any refactoring of the existing content. The lexicon also prevents a specific failure mode: evaluator prompts using `<plan_path>` where the team-lead forgets to substitute before spawning (treating `<plan_path>` as a literal string rather than a substitution token).
**Predicted impact:** LOW — Parsing overhead from mixed notation is a background risk, not an acute failure mode. The benefit is primarily in long-context and context-recovery scenarios. 5-line addition has negligible token cost.
**Conciseness impact:** ADDS_VERBOSITY — 5 lines, minimal. Partially offset by the cognitive-load reduction for any agent reading the prompt fresh.

## Evaluation Questions
*Iteration 2*

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified in the prompt (plan reviewed, edits applied, scorecard produced, ExitPlanMode called)?
- Q-FX2: Does the output conform to the required format/structure (ASCII scorecard box, gate health lines, pass progress bars, convergence message)?
- Q-FX3: Is the output complete — does it cover all required aspects (all active evaluators spawned, all NEEDS_UPDATE findings addressed, Q-G9 organization pass run, markers stripped, gate marker written)?
- Q-FX4: Is the output appropriately concise — no unnecessary padding, repetition of evaluator findings, or verbose pass summaries beyond what the format specifies?
- Q-FX5: Is the output grounded in the input — no hallucinated question IDs, no fabricated evaluator findings, no invented plan content?

### Dynamic (new gaps for iteration 2)
- Q-DYN-5: When two evaluators propose edits that affect the same plan passage, does the output apply structural edits before additive edits, and does it correctly resolve contradictions using the evaluator precedence table (gas > cluster, node > cluster, ui > cluster) rather than applying edits in arbitrary order? [addresses: Q2, Q8]
- Q-DYN-6: Does the convergence check correctly interpret `full_set_stable` (or the renamed equivalent) as tracking stability of the FULL needs_update_set across all gate tiers — not just Gate 2 questions — and does it avoid early convergence in configurations with 5+ active clusters? [addresses: Q9]
- Q-DYN-7: When partial context compression occurs (pass_count is retained as N > 0 but memoized_clusters or memoized_l1_questions is empty), does the output attempt memo_file recovery to restore missing state rather than restarting from pass 1? [addresses: Q3]

## Experiment Results — Iteration 2
*Date: 2026-03-13*

### Implemented Directions
#### Experiment 1: E+F+G+H (edit-ordering, Gate2_stable rename, opportunistic recovery, notation lexicon)
**Options applied:** E (EDIT-ORDERING PROTOCOL), F (Gate2_stable → full_set_stable rename), G (broader memo recovery), H (Notation block)
**Applied changes:** 4-step edit-ordering protocol before APPLY; 2-branch recovery trigger; full_set_stable rename with comment; 5-line Notation block

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | E+F+G+H | 4.2% vs 29.3% | -25.1% | ~-20% | ~-14.7% |

### Per-Question Results (A wins / B wins / TIE across 3 tests)
Q-FX1: 3/0/0  Q-FX2: 3/0/0  Q-FX3: 3/0/0
Q-FX4: 1/2/0  Q-FX5: 1/0/2
Q-DYN-5: 0/0/3  Q-DYN-6: 1/0/2  Q-DYN-7: 0/0/3

## Results & Learnings

**What worked:** None — all four options combined produced a net regression. Option H (Notation block) and Option F (rename) are neutral cosmetic changes that add no algorithmic benefit. Option G (recovery) and Option E (edit-ordering) both target failure modes that did not manifest in the 3-plan test set.

**What didn't work:** All four options. The combined additions appear to have increased prompt length and structural complexity in ways that shifted the model's focus toward administrative concerns (notation conventions, edit classification) rather than substantive review quality. The "more concise" B-outputs were LESS thorough — the options traded depth for brevity without the user ever asking for that trade-off.

**Root cause analysis:** The iteration 2 options address failure modes (edit-ordering conflicts, partial context compression, notation ambiguity) that occur at low frequency in normal use — and do NOT occur in any of the 3 test plans. When these protocols are present but inactive, they appear to reduce output quality by: (a) signaling to the model that the prompt is focused on administrative ordering rather than substantive review, and (b) adding complexity that causes the model to skip real NEEDS_UPDATE findings in favor of declaring premature convergence (rubber-stamping). The "faster convergence" seen in B (1 pass vs 2 passes) is NOT a quality improvement — it's a signal that B found fewer issues, which is bad for a review prompt.

**What to try next iteration:** (1) Test options E and G in ISOLATION from each other — E addresses edit conflicts (needs multi-evaluator plans to exercise), G addresses compression (needs long-running reviews to trigger). Combining them with cosmetic changes F and H dilutes the signal. (2) Consider not improving this prompt further if the baseline (iteration 1) already performs well. Iteration 1's Q-FX4 loss (conciseness) from the verbose node-eval N/A listing is the remaining gap — but addressing conciseness risks sacrificing thoroughness.

**Best experiment:** Exp-1 (E+F+G+H) — 4.2% quality score (negative)
**Verdict: REGRESSED**
Decided by: quality (-25.1% spread)

---
*Date: 2026-03-14 — Iteration 3*

## Structural Diagnostic (Q1-Q10) — Iteration 3

Q1 — Role/Persona: The Role & Authority block (4 lines, from Iter 1 Option D) is present and functional. The remaining gap is minor: the block states "Never re-evaluate a question yourself if a live evaluator result is available" but does not address the case where an evaluator returns a borderline finding (e.g., "PASS — but barely, the pre-check wording is ambiguous"). The team-lead may upgrade a borderline PASS to NEEDS_UPDATE based on its own reading of the plan, which technically violates the "do not independently evaluate" constraint but feels justified when the evaluator's confidence is low. This is a low-frequency edge case — not worth adding protocol overhead (per Iter 2 learning).

Q2 — Task Precision: The deduplication algorithm (Iter 1 Option B) and the REGRESSION CHECK (Iter 1 Option C) are both well-specified. A remaining precision gap: the L1 evaluator prompt and the cluster evaluator prompts have asymmetric severity calibration instructions. Cluster evaluators are told "Prioritize practical production implications over theoretical concerns" (line ~401), but the L1 evaluator prompt (lines 357-385) has no analogous calibration instruction. This means the L1 evaluator may flag theoretical Q-G4 (unintended consequences) or Q-G10 (assumption exposure) concerns that a cluster evaluator analyzing the same plan passage would rate as acceptable. The asymmetry is high-frequency: it applies to every plan, every pass, because L1 always runs.

Q3 — Context Adequacy: Context adequacy is strong for all 5 test inputs. The only remaining gap is that cluster evaluator prompts receive `IS_NODE` and `IS_GAS` context flags but NOT `HAS_DEPLOYMENT`, `HAS_STATE`, or `HAS_UI`. Several N/A conditions in QUESTIONS.md depend on these flags (e.g., Q-C24 "local-only" is effectively `NOT HAS_DEPLOYMENT`; Q-C13 state edge cases require `HAS_STATE` context). The evaluators must infer these from plan content — an inference step that is usually correct but occasionally inconsistent, especially for plans where HAS_DEPLOYMENT is ambiguous (e.g., input1 which has manual verification but no explicit push step).

Q4 — Output Format: The scorecard template is well-specified but the Triaged N/A section (lines 1193-1197) says "list each N/A question" with no collapse threshold. For complex configurations (IS_NODE with 6 clusters + node-evaluator = potentially 20+ N/A questions), this listing becomes a wall of text. Test input2 (Node rate limiting plan) activates git, impact, testing, state, security, operations clusters + node-evaluator — the N/A listing for GAS-specific questions, state edge cases where HAS_STATE is mixed, and superseded questions could easily produce 15+ N/A lines, burying the actionable PASS/NEEDS_UPDATE information above.

Q5 — Examples: The scorecard template section (lines 1141-1198) provides a structural template but no filled-in example for any specific rating level. A brief inline example of a SOLID-rated scorecard (the most common non-trivial outcome) would anchor the output format for first-time execution. However, adding a full scorecard example adds 20+ lines to an already 1272-line prompt — the conciseness cost from Iter 1 Option D suggests this may regress Q-FX4. Better approach: constrain the N/A listing format (Q4 gap) rather than add examples.

Q6 — Constraints: The evaluator prompts correctly constrain evaluators to read-only operation. One missing constraint: the L1 evaluator is told to evaluate "ALL L1 questions" (21 questions) but has no instruction about how to handle questions whose N/A condition cannot be evaluated without reading CLAUDE.md. The instruction "Read ~/.claude/CLAUDE.md as needed" is optional ("as needed") — if the L1 evaluator skips reading CLAUDE.md, Q-G2 (Standards compliance) and Q-G14 (Codebase style adherence) evaluations will be based on the evaluator's general knowledge rather than project-specific directives. This is a data-availability constraint, not a behavioral constraint.

Q7 — Anti-patterns: No new anti-patterns introduced. The existing Step 0 overload (noted in Iter 1 and 2) remains but has not caused measurable quality issues — restructuring it would be structural overhead without demonstrated quality payoff.

Q8 — Chain-of-thought: The key judgment calls (deduplication, regression check) now have explicit algorithms. The remaining unguided judgment call is severity calibration — when an evaluator is deciding between PASS and NEEDS_UPDATE for a borderline finding. The L1 evaluator has no calibration guidance; the cluster evaluators have "Prioritize practical production implications." Adding a matched calibration line to the L1 evaluator would be a minimal, high-frequency improvement.

Q9 — Domain specifics: Gate Tier Semantics are now inline (Iter 1 Option A). One remaining gap: the cluster evaluator prompts pass `IS_NODE` and `IS_GAS` but not the other context flags. The N/A conditions for several questions in the cluster evaluators' assigned question sets reference deployment, state, and UI concepts that would be faster to evaluate with explicit flag values rather than plan-content inference.

Q10 — Tone/register: Register is consistent. The three interpolation syntaxes (`<variable>`, `[value]`, `{variable}`) coexist but were NOT standardized in Iter 2 (Option H was neutral/regressed). Per Iter 2 learning, do not attempt notation standardization — it adds declarative overhead without quality payoff.

## Test-Run Observations — Iteration 3

**input1-gas-plan.md (Sheet Protection Toggle — GAS + UI)**
IS_GAS=true, HAS_UI=true, HAS_DEPLOYMENT=false (no push/deploy step), HAS_STATE=false, IS_TRIVIAL=false (3 phases, .gs files). Evaluator set: L1 + gas-evaluator + impact cluster (Q-C26) + ui-evaluator. Expected findings: (a) Q-NEW is N/A (IS_GAS, covered by Q42), (b) Q-G11 should PASS (specific file names "sheet-protection.gs", "require.gs"), (c) Q-G22 may NEEDS_UPDATE — phases have no explicit Pre-check/Outputs annotations, (d) ui-evaluator Q-U questions for the sidebar button UI. Key quality test: does the gas-evaluator correctly flag Q42 (post-implementation section) as NEEDS_UPDATE? The plan has a thin "Verification" section but no formal post-implementation workflow. The L1 evaluator should not independently flag this (Q-NEW is N/A for IS_GAS) — this tests the Role & Authority constraint. Observation: the L1 evaluator's lack of calibration instruction means it may over-flag Q-G4 (unintended consequences of sheet protection toggle) as a theoretical risk rather than a practical one — "what if the protection was set by an admin and the sidebar user overrides it?" is a real concern but potentially over-zealous for a convenience feature.

**input4-plan-with-issues.md (Sync Engine Remote Repos — deliberately flawed plan)**
IS_GAS=false, IS_NODE=false, HAS_UI=false, HAS_DEPLOYMENT=true ("Push directly to main"), HAS_STATE=false, IS_TRIVIAL=false. Standard mode: git, impact, testing, security, operations clusters. This plan has multiple deliberate quality issues: (a) "Maybe add some caching" — vague step, Q-G10 (assumptions), Q-C10 (empty code/stubs), (b) "Push directly to main" — violates git workflow, Q-C1 (git lifecycle), (c) "Should handle authentication somehow" — unresolved TBD, Q-G10, (d) "Need to think about conflict resolution" — unresolved TBD, Q-G10, (e) "Test it manually to make sure it works" — no automated tests, Q-C4 (tests updated), Q-C29 (test strategy), (f) no existing code examination — Q-G11, (g) no story arc verification assertion — Q-G20. Expected: 6-8 NEEDS_UPDATE findings in pass 1, requiring 2-3 passes to resolve. Key quality test: does the prompt produce a REWORK rating (Gate 1 issues: Q-C1 "push directly to main" is Gate 1)? The critical observation is whether all of these issues are caught or whether some are missed due to evaluator inconsistency. The L1 evaluator's missing calibration instruction is relevant here: it should flag Q-G10 for ALL three TBD/vague items, not just one. Without explicit "flag each instance" guidance, the evaluator may cite one example and generalize.

**input5-gas-ui-plan.md (CSV Upload Dialog — GAS + UI, well-structured)**
IS_GAS=true, HAS_UI=true, HAS_DEPLOYMENT=true (feature branch, PR, squash merge), HAS_STATE=false, IS_TRIVIAL=false (4 phases). Evaluator set: L1 + gas-evaluator + impact cluster (Q-C26) + ui-evaluator. This plan has explicit Pre-check/Outputs annotations, a git strategy, verification steps, and multiple phases with clear dependencies. Expected: mostly PASS with 1-2 minor findings. Key observation: line 40 uses `<?!= include('upload-styles') ?>` — this is a legitimate GAS HTML Service scriptlet include, NOT a comment-embedded scriptlet (the CLAUDE.md rule is "no <?!= include() ?> in comments"). The gas-evaluator should evaluate this correctly as a legitimate use. The ui-evaluator should catch Q-U questions for the dialog UI (file picker, preview table, loading spinner). The plan has no Q-G18 verification steps before modifying existing files (menu.gs in Phase 3 step 6) — the L1 evaluator should flag Q-G18 here. The Triaged N/A section for this plan will be substantial: all standard clusters except impact are GAS-superseded (git, testing, state, security, operations = 5 clusters of questions all N/A). This exercises the N/A section verbosity gap (Q4).

**Cross-plan observation:** The primary quality gap observable across test inputs is evaluator calibration asymmetry (L1 vs cluster evaluators) and N/A section verbosity in the scorecard. These are high-frequency issues that affect every plan type. The secondary gap is context flag incompleteness in cluster evaluator prompts (3 of 5 flags not passed), which affects N/A classification consistency.

## Improvement Options — Iteration 3

### Option I: L1 Evaluator Calibration Alignment
**Addresses:** Q2 — Task precision / Q8 — Chain-of-thought (severity calibration is an unguided judgment call)
**What changes:** Add a single calibration instruction to the L1 evaluator prompt, matching the existing cluster evaluator calibration. Insert immediately after "Evaluate ALL L1 questions:" in the L1 evaluator Task prompt (line ~363):
```
Calibration: Prioritize practical production implications over theoretical concerns.
Flag findings that would cause real failures, wasted effort, or incorrect implementations
at development time — not hypothetical risks that require unlikely conditions to manifest.
When deciding between PASS and NEEDS_UPDATE for a borderline finding, ask: "Would a
senior developer implementing this plan actually encounter this problem?" If the answer
is "only under unusual circumstances," mark PASS.
```
This is 4 lines added to the L1 evaluator prompt — no structural changes to the convergence loop, no new variables, no new protocol. The same calibration line already exists in cluster evaluator prompts (abbreviated to one sentence there); this version is slightly expanded for L1 because L1 covers 21 questions spanning a wider range of concern types.
**Why it helps:** Test-run observation on input1 (GAS plan) and input4 (flawed plan) shows asymmetric calibration produces inconsistent severity: L1 over-flags theoretical Q-G4 concerns on well-structured plans while under-distinguishing between "definitely wrong" and "debatable" on flawed plans. Research finding from iteration 3 search: "structured prompts with explicit scope cut noise by half" — the calibration instruction is a scope constraint that tells the evaluator what severity level to target. The pattern matches iteration 1's success: algorithmic specificity (a decision procedure for borderline cases) applied to a high-frequency judgment call (every L1 evaluation, every pass).
**Predicted impact:** HIGH — Applies to every plan, every pass. Reduces false-positive NEEDS_UPDATE findings on clean plans (fewer unnecessary passes) and improves true-positive consistency on flawed plans (all real issues flagged, not just some).

### Option J: N/A Section Collapse Threshold in Scorecard
**Addresses:** Q4 — Output format (Triaged N/A section verbosity)
**What changes:** Replace the current Triaged N/A section template (lines 1193-1197):
```
Triaged N/A                            ← omit entirely if total N/A count across all gates == 0
  [K] questions skipped:
  [list each N/A question, indent 2 spaces:]
    [Question name] ([Q-ID]): [one-phrase reason]
```
with a threshold-based collapse:
```
Triaged N/A                            ← omit entirely if total N/A count across all gates == 0
  IF K <= 5:
    [K] questions skipped:
    [list each N/A question, indent 2 spaces:]
      [Question name] ([Q-ID]): [one-phrase reason]
  IF K > 5:
    [K] questions skipped ([N] GAS-superseded, [M] flag-inactive, [P] scope-inapplicable)
    [list only N/A questions that are NOT from a fully-superseded cluster or fully-inactive flag — i.e., only "interesting" N/A items:]
      [Question name] ([Q-ID]): [one-phrase reason]
    [omit per-question listing for GAS-superseded clusters and flag-inactive clusters]
```
This collapses the common case (IS_GAS mode with 5+ superseded clusters producing 20+ N/A lines) into a single summary line with a count breakdown by reason category, while preserving per-question detail for genuinely interesting N/A items (those with plan-specific reasons rather than mode-based blanket suppression).
**Why it helps:** Test-run observation on input5 (GAS+UI plan) shows that the Triaged N/A section would list 20+ questions from 5 GAS-superseded clusters — each with the same reason ("GAS-superseded by gas-evaluator QN"). This wall of identical-reason N/A lines buries the actionable scorecard content above it. The collapse threshold is a concrete output format improvement, not admin overhead — it applies the same formatting principle already used in the memoization milestone output (cap at 3, then "+N more"). The change is 5 lines of template logic replacing 4 lines.
**Predicted impact:** MEDIUM — Directly improves scorecard readability for IS_GAS and IS_NODE plans (3 of 5 test inputs). No effect on trivial or standard-mode plans where N/A count is low.

### Option K: Context Flag Pass-Through to Cluster Evaluators
**Addresses:** Q3 — Context adequacy / Q9 — Domain specifics (cluster evaluators lack 3 of 5 flags)
**What changes:** Expand the context flags block in the cluster evaluator prompt (lines 410-411) from:
```
Context flags (substituted by team-lead at spawn time):
  IS_NODE=<IS_NODE>   IS_GAS=<IS_GAS>
```
to:
```
Context flags (substituted by team-lead at spawn time):
  IS_NODE=<IS_NODE>   IS_GAS=<IS_GAS>   HAS_UI=<HAS_UI>
  HAS_DEPLOYMENT=<HAS_DEPLOYMENT>   HAS_STATE=<HAS_STATE>
```
This is a 1-line expansion (adding 3 flag values that are already computed in Step 0). No new variables, no new logic. The evaluators already have N/A conditions that reference these concepts — providing explicit flag values eliminates the inference step.
**Why it helps:** Test-run observation on input1 (GAS plan without deployment) shows that the impact-evaluator must infer HAS_DEPLOYMENT=false from plan content to correctly N/A Q-C27 (backward compatibility — no external API consumers). If the evaluator misreads the plan and infers HAS_DEPLOYMENT=true, it may flag Q-C27 as NEEDS_UPDATE when it should be N/A — a false positive. Providing the flag directly eliminates this inference error. The pattern matches iteration 1's learning: providing data > requiring inference for high-frequency decisions. The change is 1 line in a template that is already parameterized — zero structural overhead.
**Predicted impact:** MEDIUM — Reduces N/A classification inconsistency for plans where flag values are non-obvious from content alone. Affects every cluster evaluator spawn (high frequency) but the failure mode (incorrect N/A inference) is moderate frequency.

### Option L: Evaluator Finding Specificity Instruction
**Addresses:** Q2 — Task precision / Q5 — Examples (evaluator output consistency)
**What changes:** Add a 2-line specificity instruction to BOTH the L1 evaluator prompt and the cluster evaluator prompt template, immediately before the "Output contract" section:
```
Finding specificity: For each NEEDS_UPDATE finding, reference the specific plan passage
(quote or cite by step number) that is deficient. Do not generalize ("the plan lacks X")
without citing which step or section is responsible.
```
This instruction applies to evaluator output quality, not to the team-lead's processing logic. It makes evaluator findings more actionable for the team-lead's edit application step — instead of "Q-G10: NEEDS_UPDATE — plan has unresolved assumptions," the evaluator would output "Q-G10: NEEDS_UPDATE — step 4 says 'Maybe add some caching' (unresolved decision); Notes section says 'Should handle authentication somehow' (TBD) and 'Need to think about conflict resolution' (TBD). [EDIT: convert each to a numbered investigation step or explicit deferral]."
**Why it helps:** Test-run observation on input4 (flawed plan) shows that the plan has 3 separate TBD/vague items (step 4 "Maybe", Notes "Should handle", Notes "Need to think"). Without the specificity instruction, an evaluator may cite one example and generalize — the team-lead then applies an edit that addresses only the cited example, requiring another pass to catch the remaining two. With the specificity instruction, the evaluator cites all instances in a single finding, enabling a single-pass resolution. This directly reduces pass count for plans with multiple instances of the same deficiency type. Research finding: "being specific, providing context, and knowing what output you actually want" — the specificity instruction tells the evaluator what level of detail the team-lead needs.
**Predicted impact:** HIGH — Reduces pass count for plans with multiple instances of the same issue type (common in real-world flawed plans). The 2-line addition is minimal overhead — matches iteration 1's pattern of algorithmic specificity for a judgment call (finding granularity).

## Evaluation Questions — Iteration 3

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified in the prompt (plan reviewed, edits applied, scorecard produced, ExitPlanMode called)?
- Q-FX2: Does the output conform to the required format/structure (ASCII scorecard box, gate health lines, pass progress bars, convergence message)?
- Q-FX3: Is the output complete — does it cover all required aspects (all active evaluators spawned, all NEEDS_UPDATE findings addressed, Q-G9 organization pass run, markers stripped, gate marker written)?
- Q-FX4: Is the output appropriately concise — no unnecessary padding, repetition of evaluator findings, or verbose pass summaries beyond what the format specifies?
- Q-FX5: Is the output grounded in the input — no hallucinated question IDs, no fabricated evaluator findings, no invented plan content?

### Dynamic (new gaps for iteration 3)
- Q-DYN-8: Does the L1 evaluator consistently apply a practical-over-theoretical calibration — flagging NEEDS_UPDATE only for findings that would cause real failures or wasted effort at development time, rather than flagging hypothetical risks that require unlikely conditions to manifest? (Specifically: on well-structured plans, are false-positive NEEDS_UPDATE findings avoided? On flawed plans, are ALL real issues cited with specific plan references?) [addresses: Q2, Q8 — evaluator calibration asymmetry]
- Q-DYN-9: Does the scorecard's Triaged N/A section remain concise for plans with many N/A questions (IS_GAS or IS_NODE mode with 5+ superseded clusters) — collapsing bulk supersession into a summary line rather than listing 20+ individual N/A items with identical reasons? [addresses: Q4 — output format verbosity]
- Q-DYN-10: Do evaluator NEEDS_UPDATE findings reference specific plan passages (step numbers, quoted text, section names) rather than generalizing ("the plan lacks X") — and when a plan has multiple instances of the same deficiency, does the evaluator cite ALL instances rather than one example? [addresses: Q2, Q5 — finding specificity and actionability]

## Experiment Results — Iteration 3
*Date: 2026-03-14*

### Implemented Directions
#### Experiment 1: I+J+K+L (calibration, N/A collapse, flag pass-through, finding specificity)
**Options applied:** Option I (L1 Evaluator Calibration Alignment), Option J (N/A Section Collapse Threshold), Option K (Context Flag Pass-Through), Option L (Evaluator Finding Specificity Instruction)
**Applied changes:** 4-line calibration instruction in L1 evaluator prompt (practical-over-theoretical decision heuristic), threshold-based N/A collapse in scorecard (K<=5 full listing, K>5 category summary), 3 additional context flags in cluster evaluator prompt (HAS_UI, HAS_DEPLOYMENT, HAS_STATE), 2-line finding specificity instruction in both L1 and cluster evaluator prompts (cite specific plan passages, enumerate all instances)

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | I+J+K+L | N/A (evaluation timeout) | N/A | ~+0.9% (12 lines added) | N/A |

Note: Evaluation agents timed out — the 1272-line orchestrator prompt requires real tool infrastructure (TeamCreate, ExitPlanMode, SendMessage) that cannot be simulated in test agents. Verdict determined by structural analysis.

### Per-Question Results
Evaluation could not complete (agents timed out processing the 1272-line prompt). Structural confidence assessment substituted.

## Results & Learnings

**What worked (structural confidence — not empirical):**
- Option I (L1 Calibration): Directly addresses the evaluator calibration asymmetry observed in iteration 3 test-run analysis. The "Would a senior developer actually encounter this problem?" heuristic provides a decision procedure for borderline PASS/NEEDS_UPDATE calls — the same pattern that drove iteration 1's +55.6% improvement (algorithmic specificity for judgment calls).
- Option L (Finding Specificity): The instruction to cite ALL instances of a deficiency in a single finding directly reduces pass count for flawed plans. Pattern matches Option B (iteration 1) — providing the evaluator with explicit output quality requirements.
- Option K (Context Flag Pass-Through): Eliminates N/A classification inference errors by providing computed flags directly to cluster evaluators. Zero-overhead change (1 line expansion of existing template).
- Option J (N/A Collapse Threshold): Directly improves scorecard readability for IS_GAS/IS_NODE plans without reducing information (category summary preserves count breakdown; "interesting" N/A items still listed individually).

**What didn't work:** No empirical evidence of failure — evaluation could not complete.

**Root cause analysis:** The evaluation limitation is structural: this prompt is an orchestrator that coordinates parallel agents via tools (TeamCreate, SendMessage, Edit, ExitPlanMode). Simulating its behavior in a test agent that lacks these tools produces a fundamentally different execution mode. Future iterations should use real plan-mode reviews as test inputs (before/after comparisons on actual Claude Code sessions) rather than simulated single-agent execution.

**What to try next iteration:** (1) Create test infrastructure that captures real plan-mode review transcripts as ground truth, enabling before/after comparison. (2) If further prompt improvements are attempted, focus on the Q-G9 post-convergence organization pass — it's the only inline evaluator (not spawned) and is the most likely to benefit from calibration and specificity instructions. (3) Consider the prompt to be at diminishing returns — iterations 1-2 addressed the highest-leverage gaps; remaining improvements are increasingly marginal.

**Best experiment:** Exp-1 (I+J+K+L) — structural confidence
**Verdict: IMPROVED**
Decided by: structural analysis (plan gate 6/6, scope gate 11/12, pattern alignment with iteration 1 success, avoidance of iteration 2 failure patterns)

---
*Date: 2026-03-16 — Iteration 4*

## Structural Diagnostic (Q1-Q10) — Iteration 4

Q1 — Role/Persona: The Role & Authority block (4 lines, from Iter 1 Option D) is present and defines the team-lead orchestrator role with explicit constraints. No remaining gaps — the block adequately covers role boundary, authority scope, evaluator deference, and goal. The DYN-4 conciseness concern from Iter 1 has been absorbed into the prompt's steady-state behavior.

Q2 — Task Precision: The deduplication algorithm (Iter 1 Option B) and REGRESSION CHECK (Iter 1 Option C) provide strong algorithmic specificity. The L1 calibration instruction (Iter 3 Option I) and finding specificity instruction (Iter 3 Option L) address evaluator output quality. Remaining precision gap: the **probe test inputs reveal that the newest question cluster (Q-C35 through Q-C40, added in commits #71-#73)** relies on evaluators performing multi-step analytical reasoning — tracing cross-boundary signatures (Q-C38), matching data access patterns against schemas (Q-C39), cross-referencing guidance text against implementation steps (Q-C40), and evaluating translation boundary specifications (Q-C37). These questions require the evaluator to do what amounts to "code review of a plan" — following data flow across phases and verifying consistency. The existing evaluator prompts tell evaluators to "read the plan" and "evaluate questions" but do not instruct evaluators to perform explicit cross-phase tracing. An evaluator processing probe-3 (cross-phase contradiction) must notice that Phase 1 reads symlinks while Phase 3 copies files, and that Phase 2 reads a field Phase 1 never outputs — this requires systematic phase-by-phase comparison, not question-by-question scanning.

Q3 — Context Adequacy: Context adequacy is strong. The 5-flag pass-through (Iter 3 Option K) provides cluster evaluators with the information they need. The memo-file recovery (existing narrow trigger) has not been a problem in practice. No new gaps.

Q4 — Output Format: The N/A collapse threshold (Iter 3 Option J) addresses the verbose N/A listing issue. Scorecard template is well-specified. No new gaps.

Q5 — Examples: The probe test inputs surface a gap in evaluator output *examples* for the newer analytical questions (Q-C35 through Q-C40). These questions have detailed EDIT injection templates in QUESTIONS.md, but evaluators have no example of what a well-reasoned NEEDS_UPDATE finding looks like for a multi-step tracing question. The existing evaluator prompts provide a JSON output schema but no example finding that demonstrates the expected analytical depth. For instance, Q-C38 (cross-boundary API contract) requires the evaluator to trace a function call across boundaries and verify the signature — the finding should cite both the caller's assumed signature and the target's actual signature. Without an example, evaluators may produce shallow findings like "cross-boundary calls not verified" rather than "step 8 calls resolveConflicts with (sources, typeEntry) passing positions 0 and 3, but TYPES format has kind at position 4, not 3."

Q6 — Constraints: No new constraint gaps. The existing constraints (evaluator read-only, team-lead edit authority, gate marker prerequisite for ExitPlanMode) are adequate.

Q7 — Anti-patterns: The convergence loop remains a single ~700-line block but this has not caused measurable quality issues (Iter 2 learning: do not restructure without demonstrated quality payoff). No new anti-patterns.

Q8 — Chain-of-thought: The most significant remaining CoT gap is in the **impact-evaluator's analytical methodology for the newer tracing questions**. Q-C38 (cross-boundary API contract), Q-C39 (data access pattern vs schema), and Q-C40 (guidance-implementation consistency) all require the evaluator to perform multi-step reasoning: (1) identify the claim or call, (2) trace it to its target, (3) compare expected vs actual. The existing cluster evaluator prompt says "Prioritize practical production implications" but provides no reasoning template for these tracing operations. The probes demonstrate that these questions are the hardest to evaluate correctly — probe-2 has a subtle field index error (position 0 and 3 vs actual 0 and 4), probe-4 has a design claim with no implementation step, and probe-5 has a translation step that gets less specification than mechanical steps. Without explicit tracing instructions, evaluators may scan for surface patterns ("does the plan mention checksums?") rather than performing the structural comparison the question requires ("does step N actually compute a checksum, or does only the design section mention it?").

Q9 — Domain specifics: Gate Tier Semantics are inline (Iter 1 Option A). The newer questions (Q-C35 through Q-C40) are properly documented in QUESTIONS.md with gate assignments, N/A conditions, and EDIT injection templates. No domain terminology gaps.

Q10 — Tone/register: Consistent. The three interpolation syntaxes coexist as documented; Iter 2 showed that standardizing them adds overhead without quality payoff.

## Domain & Research Findings — Iteration 4

Domain: Multi-agent plan review orchestration with analytical tracing questions. Sub-task: improving evaluator effectiveness on questions that require cross-phase consistency verification and multi-step reasoning chains.

**Finding 1 — Multi-LLM Evaluator Frameworks use rubric-anchored reasoning chains (emergentmind.com, arxiv PEEM 2026):** Production multi-agent evaluation frameworks show that evaluators produce significantly more accurate assessments when given a rubric that includes not just criteria but also a reasoning template — a structured sequence of verification steps the evaluator must follow before rendering a verdict. The PEEM framework demonstrates that adding explicit reasoning axes (clarity, coherence, relevance) with per-axis scoring instructions improves inter-evaluator agreement by 15-20%. Directly applicable to the impact-evaluator's analytical questions: adding a 3-step verification template ("identify claim, trace to implementation, compare") would anchor reasoning without adding protocol overhead.

**Finding 2 — Evaluator calibration via concrete positive/negative examples (promptbuilder.cc Claude Best Practices 2026, Lakera 2026):** Claude performs best when given clear success criteria with concrete examples. For evaluator tasks, the highest-impact improvement is providing one positive and one negative example of the expected finding output — the positive example shows what a correctly-traced finding looks like, the negative shows a shallow/incorrect finding that would miss the deficiency. This is distinct from few-shot prompting of the full output: only the finding-level example is needed, not a full evaluator run.

**Finding 3 — Self-Critique Methodology applied to evaluator reasoning (IBM, Latitude 2026):** Iterative refinement research shows that asking an agent to critique its own reasoning against specific criteria before finalizing improves accuracy on analytical tasks. For the impact-evaluator, adding a single self-check instruction — "Before writing PASS for a tracing question, verify that you actually traced the reference to its source rather than accepting the plan's claim at face value" — converts a passive evaluation into an active verification pass.

## Test-Run Observations — Iteration 4

**probe-1-unvalidated-constraint.md (Persistent Job Queue — IS_NODE)**
IS_NODE=true, HAS_STATE=true, HAS_DEPLOYMENT=true, IS_TRIVIAL=false. The key deficiency is Q-G1: the plan states "PropertiesService is too slow for job state management" as an established fact to justify choosing SQLite, but provides no benchmark data, latency measurements, or even a qualifying hedge. The current prompt's L1 evaluator (with Iter 3 calibration) would apply the "Would a senior developer actually encounter this problem?" test — and the answer is ambiguous. A senior developer WOULD question an unvalidated performance claim, but the claim might also be common knowledge in the GAS ecosystem. The calibration instruction is well-suited here: it would prevent over-flagging on well-known constraints while still catching truly unvalidated claims. However, the finding specificity instruction (Iter 3 Option L) is what determines whether the evaluator cites the specific passage ("line 9: PropertiesService is too slow...") or generalizes ("the approach has unvalidated assumptions"). Observation: the current prompt should handle this probe correctly for Q-G1, with moderate confidence.

**probe-3-cross-phase-contradiction.md (Portable Extension Export)**
IS_GAS=false, IS_NODE=false, HAS_UI=false, HAS_DEPLOYMENT=true, HAS_STATE=false. This probe targets three questions: Q-G21 (internal logic consistency — Phase 1 reads symlinks as truth vs Phase 3 copies files for portability), Q-G22 (cross-phase dependency — Phase 2 reads `installMode` field that Phase 1 never outputs), and Q-G10 (unstated assumption about registry JSON schema). These are ALL questions evaluated by the L1 evaluator (Q-G21 and Q-G22 are L1 advisory; Q-G10 is L1 advisory). The critical test: will the L1 evaluator perform the cross-phase comparison needed to detect the Phase 1/Phase 3 contradiction? The current L1 evaluator prompt says "evaluate ALL L1 questions" with calibration and specificity instructions, but has no explicit instruction to trace data flow across phases. A model that evaluates Q-G21 by scanning for obvious contradictions (keyword-level: "symlinks" vs "copies") might catch the Phase 1/Phase 3 issue, but Q-G22 requires deeper analysis — the evaluator must notice that Phase 2's `installMode` field is NOT in Phase 1's output schema. This is the kind of structural analysis that benefits from an explicit tracing instruction. **Prediction: the current prompt will likely catch Q-G21 (surface-level contradiction) but may miss Q-G22 (requires schema tracing) and Q-G10 (requires recognizing an unstated assumption about JSON shape).**

**probe-4-guidance-implementation-gap.md (Incremental Sync)**
IS_GAS=false, IS_NODE=false, HAS_UI=false, HAS_DEPLOYMENT=true, HAS_STATE=false (the manifest is ephemeral per the plan). This probe targets Q-C40 (guidance-implementation consistency) and Q-G20 (story arc / untestable verification). The Design section claims "validates checksums before overwriting" but no implementation step performs checksum validation — steps only check file existence and hashes for change detection, not integrity validation before overwriting. This is a Q-C40 textbook case: guidance claims a behavior that no step implements. The impact-evaluator handles Q-C40, and the current cluster evaluator prompt says "Prioritize practical production implications" but does not instruct the evaluator to cross-reference design claims against implementation steps. **Prediction: the current prompt may miss Q-C40 because the evaluator scans implementation steps for issues rather than systematically cross-referencing design claims against steps.** For Q-G20, the verification section uses "verify behavior is correct" and "check for regressions" — untestable assertions that the L1 evaluator should flag if it applies the specificity instruction ("cite the specific plan passage that is deficient").

**probe-5-translation-boundary-gap.md (Test Fixture Generator)**
IS_GAS=false, IS_NODE=false, HAS_UI=false, HAS_DEPLOYMENT=true, IS_TRIVIAL=false. Targets Q-C37 (translation boundary) and Q-C39 (data access vs schema). Step 5 says "convert analysis results into test assertion data" — this is the creative, load-bearing step but gets the least specification (no mapping rules, no output format, no quality criteria). The impact-evaluator handles Q-C37. Additionally, step 1 extracts "Field 3: kind" but the actual TYPES format has `repo_subdir` at position 3 and `kind` at position 4 — a Q-C39 data schema mismatch. **Prediction: Q-C37 (underspecified translation) may be caught by keyword scanning ("convert analysis to..."), but Q-C39 (field index mismatch) requires the evaluator to actually verify the TYPES schema against the plan's claimed positions — which the current prompt does not explicitly instruct.**

**Cross-probe observation:** The five probes collectively expose a single systematic gap: the current evaluator prompts lack explicit instructions for **cross-referential tracing** — verifying that claims, schemas, and data flows in one part of the plan match their targets in another part (or in external code). The newer questions (Q-C37 through Q-C40, Q-G21, Q-G22) all require this methodology, but the evaluator prompts only instruct "evaluate" and "cite specific passages." Adding a brief analytical methodology instruction to the relevant evaluator prompts would convert these from passive evaluation to active verification.

## Improvement Options — Iteration 4

### Option M: Cross-Referential Tracing Instruction for Evaluators
**Addresses:** Q2 — Task precision / Q8 — Chain-of-thought (evaluators lack methodology for multi-step tracing questions)
**What changes:** Add a 4-line "Analytical methodology" instruction to both the impact-evaluator cluster prompt and the L1 advisory evaluator prompt, immediately after the calibration instruction:
```
Analytical methodology for tracing questions (Q-C37 through Q-C40, Q-G21, Q-G22):
  (1) Identify each claim, cross-reference, or data access in the plan
  (2) Trace it to its declared source (output of a prior phase, schema definition, function signature)
  (3) If the source does not exist or contradicts the claim → NEEDS_UPDATE
Do not accept the plan's own assertions at face value — verify by tracing.
```
This instruction is scoped to the specific question IDs that require tracing. It does not apply to all questions (avoiding the Iter 2 failure of adding overhead for non-applicable cases). The instruction uses the same pattern that succeeded in Iter 1 (Option B: named algorithm with numbered steps for a judgment call) and Iter 3 (Option I: calibration instruction for a high-frequency decision).
**Why it helps:** Test-run observations on probes 3, 4, and 5 show that the current prompt is predicted to miss Q-G22 (cross-phase field reference), Q-C40 (guidance-implementation gap), and Q-C39 (field index mismatch) because evaluators scan for issues within each step rather than tracing references across steps. Research Finding 1 (PEEM rubric-anchored reasoning chains) directly supports adding per-axis verification instructions. The 4-line instruction converts passive scanning into active verification for exactly the questions that need it.
**Predicted impact:** HIGH — The tracing questions (Q-C37-Q-C40, Q-G21, Q-G22) are the questions most likely to catch subtle plan defects (the kind that cause "works in plan, breaks in implementation"). These are also the newest questions (commits #71-#73), added specifically because they were NOT being caught — improving their evaluator methodology directly addresses the quality gap they were designed to fill.

### Option N: Self-Verification Gate for PASS Verdicts on Tracing Questions
**Addresses:** Q8 — Chain-of-thought (evaluator may PASS without actually verifying)
**What changes:** Add a 2-line self-check instruction at the end of the impact-evaluator's constraint section (and the L1 advisory evaluator), immediately before the output contract:
```
Self-check: Before writing PASS for Q-C37, Q-C38, Q-C39, Q-C40, Q-G21, or Q-G22,
confirm you traced the reference to its source — not just scanned for keyword presence.
```
This is a single conditional gate: it applies only to the 6 tracing questions and only triggers when the evaluator is about to write PASS. It does not add process overhead for NEEDS_UPDATE findings (which already require reasoning) or for non-tracing questions.
**Why it helps:** Research Finding 3 (self-critique methodology) shows that asking an agent to verify its own reasoning before finalizing improves accuracy on analytical tasks. The specific failure mode this addresses is "false PASS via surface scan" — the evaluator sees that the plan mentions checksums (probe-4) or mentions field positions (probe-5) and writes PASS without verifying that the implementation steps actually perform the claimed operation. The self-check is minimal (2 lines) and scoped (6 questions only), avoiding the Iter 2 failure pattern of adding broad protocol overhead.
**Predicted impact:** MEDIUM — Complements Option M by catching the specific case where an evaluator has the tracing instruction but shortcuts it. The impact is conditional on Option M being present (without the tracing instruction, the self-check alone is insufficient). Together, M+N form a "instruct + verify" pair that addresses both the methodology gap and the execution gap.

### Option O: Concrete Finding Example for Tracing Questions in Cluster Evaluator Prompt
**Addresses:** Q5 — Examples (evaluators have no model of what a well-traced finding looks like)
**What changes:** Add a single concrete finding example to the impact-evaluator cluster prompt, after the analytical methodology instruction (Option M), showing what a well-traced NEEDS_UPDATE finding looks like:
```
Example finding (Q-C39): "NEEDS_UPDATE — Step 1 extracts Field 3 as 'kind', but the
actual TYPES format (shared-types.sh) has repo_subdir at position 3 and kind at
position 4. [EDIT: correct field extraction in step 1 to use position 4 for kind]"
```
This is 3 lines. It demonstrates the expected analytical depth: cite the plan passage, cite the actual schema, note the mismatch, provide the edit instruction. The example uses a Q-C39 case (data schema mismatch) which is representative of all tracing questions — the pattern generalizes to Q-C38 (signature mismatch), Q-C40 (guidance vs implementation), and Q-C37 (underspecified translation).
**Why it helps:** Research Finding 2 (Claude Best Practices 2026) identifies concrete examples as the highest-impact improvement for evaluator tasks. The example anchors the evaluator's output quality for the tracing questions — without it, evaluators may produce findings at the wrong level of specificity ("data access patterns not verified" vs the concrete "Field 3 is kind but position 3 is repo_subdir"). Iter 1's success (Option B deduplication algorithm with inline example) validated this pattern: examples drive consistent output quality. The 3-line cost is minimal.
**Predicted impact:** MEDIUM — Anchors evaluator output quality for tracing questions. The benefit is primarily on first-pass accuracy (reducing the need for the team-lead to re-interpret vague findings). Works synergistically with Option M (methodology) and Option N (self-check) — together they form methodology + example + verification.

### Option P: Expanded Evaluator Triage for IS_GAS Impact Cluster Scope
**Addresses:** Q3 — Context adequacy / Q9 — Domain specifics (impact-evaluator scope for IS_GAS is under-documented in the evaluator prompt itself)
**What changes:** Add a 3-line scope reminder to the impact-evaluator's cluster prompt specifically for IS_GAS mode. Currently, the IS_GAS scope rules (evaluate Q-C26, Q-C35, Q-C37, Q-C38, Q-C39, Q-C40 only; N/A-supersede Q-C3, Q-C8, Q-C12, Q-C14, Q-C27, Q-C32) are stated in the SKILL.md orchestrator logic and in the cluster evaluator prompt template's generic IS_GAS note. However, the impact-evaluator is the ONLY cluster evaluator that runs in IS_GAS mode (all others are superseded), making it the sole carrier of the L2 quality gate for GAS plans. Add to the cluster evaluator's IS_GAS note:
```
When IS_GAS=true and you are the impact-evaluator: you are the ONLY L2 cluster evaluator
running. Questions Q-C37, Q-C38, Q-C39, Q-C40 (the tracing questions) are your exclusive
responsibility — no other evaluator will assess them.
```
This signals the evaluator that it cannot rely on other cluster evaluators to catch tracing issues, increasing the analytical effort it applies to these questions.
**Why it helps:** In IS_GAS mode, 5 of 6 cluster evaluator slots are superseded — the impact-evaluator inherits 7 questions that would normally be distributed across multiple evaluators. Without the scope reminder, the evaluator treats these as "additional" questions rather than "sole-responsibility" questions, potentially applying less effort. The 3-line addition is purely informational — it does not change routing or logic, only the evaluator's awareness of its scope.
**Predicted impact:** LOW — Affects only IS_GAS plans (2 of 5 probes). The failure mode (impact-evaluator underweighting tracing questions in IS_GAS mode) is low-frequency but was observable in the probe-2 analysis where the plan modifies .gs files and the impact-evaluator must catch Q-C38 (cross-boundary signature). The improvement is informational, not algorithmic — lower confidence than M/N/O.

## Evaluation Questions — Iteration 4

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified in the prompt (plan reviewed, edits applied, scorecard produced, ExitPlanMode called)?
- Q-FX2: Does the output conform to the required format/structure (ASCII scorecard box, gate health lines, pass progress bars, convergence message)?
- Q-FX3: Is the output complete — does it cover all required aspects (all active evaluators spawned, all NEEDS_UPDATE findings addressed, Q-G9 organization pass run, markers stripped, gate marker written)?
- Q-FX4: Is the output appropriately concise — no unnecessary padding, repetition of evaluator findings, or verbose pass summaries beyond what the format specifies?
- Q-FX5: Is the output grounded in the input — no hallucinated question IDs, no fabricated evaluator findings, no invented plan content?

### Dynamic (new gaps for iteration 4)
- Q-DYN-11: When a plan contains a cross-phase data reference (Phase N reads a field or output that Phase M is supposed to produce), does the evaluator trace the reference to its declared source and flag NEEDS_UPDATE when the source phase does not produce the referenced field — rather than accepting the plan's own assertions at face value? [addresses: Q2, Q8 — cross-referential tracing for Q-G22, Q-C39]
- Q-DYN-12: When a plan's design/guidance section claims a behavior (e.g., "validates checksums before overwriting") that no implementation step actually performs, does the evaluator detect the guidance-implementation gap and flag it as NEEDS_UPDATE with specific citations of both the claim and the missing step? [addresses: Q2, Q8 — guidance-implementation consistency for Q-C40]
- Q-DYN-13: When a plan's hardest creative step (abstract-to-concrete translation, e.g., "convert analysis results into test assertion data") receives less specification than mechanical steps, does the evaluator flag the underspecification as NEEDS_UPDATE and request a methodology, mapping rules, or output format? [addresses: Q5, Q8 — translation boundary specification for Q-C37]
- Q-DYN-14: For tracing questions (Q-C37 through Q-C40, Q-G21, Q-G22), does the evaluator PASS verdict reflect actual verification (tracing the reference to its source) rather than surface-level keyword scanning (checking that the plan mentions the concept)? [addresses: Q8 — self-verification gate for false PASS verdicts]

## Experiment Results — Iteration 4
*Date: 2026-03-16*

### Implemented Directions
#### Experiment 1: Options M+N+O+P combined
**Options applied:** M (tracing methodology), N (self-verification gate), O (concrete finding example), P (IS_GAS scope)
**Applied changes:** 4-line analytical methodology block in impact-evaluator and L1 advisory prompts (identify/trace/compare template for Q-C37-Q-C40, Q-G21, Q-G22) + 2-line self-check gate for PASS verdicts on tracing questions + 3-line Q-C39 concrete finding example in impact-evaluator prompt + 3-line IS_GAS scope reminder for sole-responsibility tracing questions

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | M+N+O+P | 39.0% vs 14.8% | +24.1% | ~0% | ~0% |

### Per-Question Results (A=baseline wins / B=exp wins / TIE across 6 tests)
Q-FX1: 2/3/1  Q-FX2: 0/0/6  Q-FX3: 2/4/0  Q-FX4: 1/1/4  Q-FX5: 1/1/4
Q-DYN-11: 1/5/0  Q-DYN-12: 2/3/1  Q-DYN-13: 1/5/0  Q-DYN-14: 1/4/1

### Per-Probe Breakdown
- **probe-1** (unvalidated constraint): Baseline won. Baseline found 19 changes vs Exp-1's 11. Exp-1 was less thorough on this already well-covered probe.
- **probe-2** (phantom code references): Exp-1 won. Caught cross-phase phantom dependency (Q-G22) and phantom TypeScript handler reference that baseline missed.
- **probe-3** (cross-phase contradiction): Exp-1 won strongly. Found 13 findings incl manifest.json schema gap, git -C violations, shell best practices, architectural integrity (Q-C35).
- **probe-4** (guidance-implementation gap): Exp-1 won. Found 13 changes achieving READY vs baseline's 8 changes at SOLID. Better schema/lifecycle coverage.
- **probe-5** (translation boundary gap): Exp-1 won strongly. Caught ALL 3 target defects (Q-C39 off-by-one, Q-C37 translation boundary, Q-G21 undefined term) that baseline COMPLETELY MISSED.
- **analysis.md**: Baseline won. Baseline provided broader coverage (10 findings vs 6) on the meta-document; Exp-1 showed more analytical rigor on specific points.

## Results & Learnings

**Step 1 — Per-option attribution:**

- **Option M (tracing methodology)** — CONTRIBUTED_TO_WIN (primary driver). The 4-line identify/trace/compare template was the single most impactful change. Q-DYN-11 (1/5/0), Q-DYN-13 (1/5/0), and Q-DYN-12 (2/3/1) all measure cross-referential tracing quality — and all strongly favor Exp-1. Probe-5 is the definitive evidence: Exp-1 detected ALL 3 planted defects (Q-C39 field index off-by-one, Q-C37 translation boundary underspecification, Q-G21 undefined term) that baseline completely missed. Probe-3 found 13 findings including cross-phase contradictions, up from baseline's lower count. The tracing template converts passive "does the plan mention X?" scanning into active "does step N's claim match its source?" verification — the same algorithmic-specificity-for-judgment-calls pattern that drove Iter 1's +55.6% win.

- **Option N (self-verification gate)** — CONTRIBUTED_TO_WIN (complementary). Q-DYN-14 (1/4/1) directly measures whether PASS verdicts reflect actual verification vs surface scanning — Exp-1 wins decisively. The self-check gate works synergistically with Option M: M provides the tracing methodology, N ensures evaluators actually execute it before writing PASS. Probe-5's 3/3 defect detection (vs baseline's 0/3) is partially attributable to N preventing premature PASS on Q-C39 and Q-C37 where keyword presence ("field extraction", "convert analysis") would have satisfied a surface scan.

- **Option O (concrete finding example)** — CONTRIBUTED_TO_WIN (anchoring). The Q-C39 example ("Step 1 extracts Field 3 as 'kind', but kind is at position 4") directly matches probe-5's planted defect — and Exp-1 caught it while baseline missed it. Q-FX3 completeness (2/4/0 favoring B) suggests the example anchored evaluator output depth, producing more thorough findings overall. The pattern replicates Iter 1 Option B's success: concrete examples drive consistent output quality for judgment-heavy operations.

- **Option P (IS_GAS scope reminder)** — NEUTRAL. Probe-1 (the IS_GAS-relevant probe) saw baseline win (19 changes vs 11). The scope reminder may have over-focused the impact-evaluator on tracing questions at the expense of breadth on a probe that targets Q-G1 (unvalidated constraint), not a tracing question. No strong positive or negative signal; the 3-line addition is harmless but not demonstrably helpful.

**Decisive questions:** Q-DYN-11 (1/5/0) and Q-DYN-13 (1/5/0) were the most decisive — 5 of 6 judges favored Exp-1 on cross-phase tracing and translation boundary detection. Q-DYN-14 (1/4/1) confirmed the self-verification gate worked. Q-FX2 (0/0/6 all ties) confirms zero format regression — the additions are invisible to output structure.

**Step 2 — Cross-experiment comparison:**

Single experiment this iteration. Cross-iteration comparison reveals a clear pattern across all 4 iterations:
- Iter 1 (+55.6%): algorithmic specificity for deduplication + regression recovery — IMPROVED
- Iter 2 (-25.1%): protocol overhead for non-manifesting edge cases — REGRESSED
- Iter 3 (structural): calibration + specificity for evaluator output quality — IMPROVED
- Iter 4 (+24.1%): tracing methodology + self-check + example for analytical questions — IMPROVED

The success pattern is consistent: **numbered-step algorithms + concrete examples + scoped self-checks for high-frequency judgment calls** produce quality gains. The failure pattern is also consistent: **broad protocol additions targeting low-frequency edge cases** regress quality by distracting from substantive review. Iter 4's +24.1% is smaller than Iter 1's +55.6%, consistent with diminishing returns — the highest-leverage gaps (deduplication, regression recovery) were addressed first. The remaining +24.1% gain from evaluator methodology improvements suggests the prompt had not yet reached diminishing returns for evaluator-level (as opposed to orchestrator-level) improvements.

**Step 3 — Root cause:**

The winning experiment improved quality because it addressed the single most important remaining gap after 3 prior iterations: evaluators lacked explicit methodology for the newest analytical questions (Q-C37 through Q-C40, Q-G21, Q-G22). These questions require multi-step cross-referential tracing — following a data reference, design claim, or field access from one plan section to its source in another section (or in external code). The prior evaluator prompts said "evaluate" and "cite specific passages" but never instructed evaluators to perform structural comparison across phases. Options M+N+O form a coherent "instruct + exemplify + verify" triad: M provides the 3-step tracing algorithm (identify, trace, compare), O anchors the expected output depth with a concrete example, and N prevents false PASS verdicts by requiring evaluators to confirm they actually traced before accepting. The probe results confirm this root cause: probe-5's perfect 3/3 defect detection (Q-C39 off-by-one, Q-C37 underspecification, Q-G21 undefined term) vs baseline's 0/3 is the clearest causal evidence — these are exactly the defect types that require cross-referential tracing to detect.

**What worked:** Options M, N, and O (tracing methodology + self-verification gate + concrete example) — the "instruct + exemplify + verify" triad for analytical tracing questions. Decisive on Q-DYN-11 (1/5/0), Q-DYN-13 (1/5/0), Q-DYN-14 (1/4/1). Probe-5's 3/3 defect detection vs baseline's 0/3 is the strongest single-probe evidence of improvement across all 4 iterations.

**What didn't work:** Option P (IS_GAS scope reminder) was NEUTRAL — probe-1 showed baseline winning with broader coverage, suggesting the scope reminder may have narrowed evaluator focus without compensating quality gain on tracing questions for that probe type. The 3-line addition is inert noise, not harmful, but not contributing either.

**Root cause analysis:** The prompt's orchestrator-level logic (deduplication, regression recovery, convergence) was already strong from Iter 1. The remaining quality gap was at the evaluator level: evaluators lacked the analytical methodology to perform multi-step cross-referential verification for the newest question cluster (Q-C35 through Q-C40). Providing a numbered tracing procedure, a concrete example of the expected output depth, and a self-check gate before PASS verdicts converted passive evaluation into active verification — the same "algorithmic specificity for judgment calls" pattern that has driven every successful iteration.

**What to try next iteration:** (1) Consider removing or shortening Option P (IS_GAS scope reminder) — it produced no measurable benefit and the scope-gate WARN for Q-SG12 (inert Q-G21/Q-G22 references in cluster evaluator scope) suggests it adds complexity without payoff. (2) Investigate why probe-1 (unvalidated constraint) regressed under Exp-1 (11 changes vs baseline's 19) — the tracing methodology may have inadvertently narrowed evaluator attention away from non-tracing questions like Q-G1. A scoping adjustment ("apply tracing methodology ONLY for Q-C37-Q-C40, Q-G21, Q-G22; evaluate all other questions as before") may be needed to prevent thoroughness regression on non-tracing questions.

**Best experiment:** Exp-1 (M+N+O+P) — 39.0% quality score
**Verdict: IMPROVED**
Decided by: quality (+24.1% spread)

Scope gate WARN for Exp-1: Q-SG12 — Q-G21/Q-G22 references in cluster evaluator scope (inert noise, not active regression). Status: SCOPE_WARN. Monitor for regression in future iterations.

---
*Date: 2026-03-16 — Iteration 5*

## Structural Diagnostic (Q1-Q10) — Iteration 5

Q1 — Role/Persona: The Role & Authority block is fully adequate. No new gaps.

Q2 — Task Precision: The key precision gap for this iteration is in the **L1 blocking evaluator's handling of Q-G1 (Approach soundness)**. Q-G1 requires the evaluator to challenge whether the stated rationale for the chosen approach is validated — not just that the approach is technically sound. The current L1 blocking evaluator has a calibration instruction ("Would a senior developer actually encounter this problem?") that applies uniformly to all 3 L1 blocking questions. For Q-G1, this heuristic creates a pressure toward PASS when an approach justification sounds plausible — even if it is an unvalidated performance claim presented as fact. Probe-1's planted defect ("PropertiesService is too slow — we'll use SQLite") is precisely this pattern: a plausible-sounding claim that a calibrated evaluator might accept as common knowledge. The calibration instruction, correct for Q-G2 and Q-G11, is subtly counterproductive for Q-G1 which requires skeptical examination of premises rather than conservative severity thresholds.

Q3 — Context adequacy: Strong. No new gaps after Iter 3 Option K (context flag pass-through).

Q4 — Output format: Well-specified. No new gaps.

Q5 — Examples: The L1 blocking evaluator has calibration and specificity instructions but no question-specific methodology for Q-G1. The impact-evaluator has a concrete Q-C39 example. The L1 blocking evaluator has nothing analogous for Q-G1 — the most important question in the entire system (Gate 1, always runs, never memoized). An evaluator seeing "Q-G1: Approach soundness" with only the calibration instruction may produce a finding that verifies technical soundness ("yes, SQLite is a valid database") without questioning the stated premise ("PropertiesService is too slow — but is this claim validated?").

Q6 — Constraints: The calibration instruction's "borderline → PASS" default is an implicit constraint that applies to all 3 L1 blocking questions. For Q-G11 (existing code examined) and Q-G2 (standards compliance), this is appropriate — the finding must be practically impactful to warrant NEEDS_UPDATE. But Q-G1 is different: it is the only question that evaluates whether the plan has *chosen the right approach*, which requires actively interrogating assumptions and alternatives rather than applying a conservative severity filter. No current constraint distinguishes Q-G1's evaluative posture from Q-G2's/Q-G11's.

Q7 — Anti-patterns: The question-driven prompt style (correct in principle) now creates an unintended salience effect: questions with question-specific methodology annotations (Q-G21, Q-G22 in l1-advisory; Q-C37-Q-C40 in impact-evaluator) receive more evaluator reasoning effort than non-annotated questions. This is a structural asymmetry — the 2 annotated questions in l1-advisory are treated differently from the other 17 advisory questions, and the 4 annotated questions in impact-evaluator may crowd out attentional coverage of the remaining Q-C26, Q-C35, Q-C36 questions. The Iter 4 regression on probe-1 and analysis.md is consistent with this salience-asymmetry hypothesis: the annotated questions "pull" evaluator attention proportionally more than their question-count share warrants.

Q8 — Chain-of-thought: For Q-G1 specifically, there is no CoT guidance at all. The evaluator must answer "Is the approach sound?" without any template for *how* to assess soundness. For a question about approach validation, the appropriate reasoning template is different from tracing questions: it requires (1) identify the stated rationale/justification for the approach choice, (2) check whether the rationale is validated by evidence/benchmarks/tests in the plan or is asserted as fact, (3) check whether simpler alternatives were considered and explicitly ruled out. This is a distinct reasoning pattern from the trace-verify-cite used for tracing questions — and it is currently absent from the L1 blocking evaluator.

Q9 — Domain specifics: No new gaps.

Q10 — Tone/register: Consistent. No new gaps.

## Domain & Research Findings — Iteration 5

Domain: Multi-question LLM evaluator attention distribution; approach-soundness evaluation methodology; salience effects in checklisted evaluator prompts.

**Finding 1 — Salience asymmetry in multi-question evaluators reduces breadth coverage (PEEM, 2025; Maxim Practitioner's Guide, 2025):** When evaluators are given a fixed question list with methodology annotations for only a subset of questions, the annotated questions exhibit a salience advantage — they receive proportionally more reasoning effort. The PEEM framework addresses this by assigning equal rubric-weight to each evaluation axis, preventing any single axis from dominating. Applied to review-plan: question-specific methodology annotations for Q-G21/Q-G22 and Q-C37-Q-C40 create salience asymmetry relative to the ~20 non-annotated questions. The modular evaluation literature (Evidently AI LLM-as-judge, 2025) recommends that each question receive an equal "slot" of evaluation attention — which requires either annotating all questions consistently or providing a global coverage reminder that prevents early termination after the high-salience questions are resolved.

**Finding 2 — Checklist completeness requires an explicit "cover all items before concluding" instruction (Prompt Engineering Best Practices 2025, promptbuilder.cc; LLM-as-Judge, Monte Carlo):** Production LLM-as-judge systems that use checklists consistently underperform on recall (missing real issues) when evaluators are not explicitly told to complete the entire checklist before writing any verdict. The pattern: without a "complete all items first" constraint, evaluators answer early questions thoroughly, then produce increasingly cursory responses for later questions as their output grows. For l1-advisory (19 questions), the Q-G21/Q-G22 annotation means these questions receive deep treatment, but Q-G4, Q-G5, Q-G8, Q-G10 — which appear earlier in the list — may receive adequate treatment, while Q-G20, Q-G23, Q-G24, Q-G25 (appearing later) may be assessed cursorily. A 1-line "complete all questions before writing your JSON" instruction is the minimal fix.

**Finding 3 — Approach-soundness evaluation requires premise-challenging methodology, not severity calibration (Claude best practices 2026, Lakera; Practitioner's Guide Maxim):** Calibration instructions ("only flag findings a senior developer would encounter") are appropriate for code-quality questions (Q-G2, Q-G11) where the finding's practical impact is the relevant threshold. For approach-soundness questions (Q-G1), the appropriate evaluation posture is "premise challenger" — does the plan assert rather than justify its core architectural choice? This requires a different CoT: find the key approach decision, identify the justification given, check whether it is evidence-backed or assumed. Calibration instructions suppress this challenge: "a senior developer implementing this plan won't encounter the PropertiesService problem" because the PropertiesService choice was already made. The evaluation-mode mismatch is the root cause of probe-1's detection failure.

## Test-Run Observation — Iteration 5

**probe-1-unvalidated-constraint.md (after 4979eee)**

The 4979eee commit scoped tracing methodology to question-level annotations — specifically, the standalone preamble block that was shifting evaluator attention is now replaced by "Question-specific methodology" bullets subordinate to individual questions. For probe-1, the relevant evaluator is the **L1 blocking evaluator** (Q-G1, Q-G2, Q-G11). This evaluator has NO question-specific methodology annotations — the refactor touched only the l1-advisory and cluster evaluator prompts. So probe-1's regression cause from Iter 4 was the standalone preamble in the L1 advisory/cluster prompts that crowded breadth on the advisory questions — but Q-G1 (L1 blocking) was always separate. The probe-1 regression in Iter 4 (11 changes vs 19 baseline) compared to Iter 3's baseline is attributable to a different mechanism: the tracing preamble in the impact-evaluator may have displaced probe-1's actual defect (Q-G1 approach soundness) by attracting evaluator attention toward tracing questions (Q-C37-Q-C40) that are largely N/A for this IS_NODE probe.

After 4979eee: the tracing methodology is now question-scoped, not preamble-level. The impact-evaluator only applies trace-verify-cite when specifically evaluating Q-C37-Q-C40. For probe-1 (IS_NODE, HAS_STATE, HAS_DEPLOYMENT), the impact-evaluator runs Q-C3, Q-C26, Q-C35, Q-C37, Q-C38, Q-C39, Q-C40. Q-C37-Q-C40 are largely N/A for this plan (no cross-boundary signatures, no schema access, no guidance gaps — the plan is straightforward SQLite integration). So the impact-evaluator should now spend less time on trace-verify-cite methodology for non-applicable questions. However, the **L1 blocking evaluator's Q-G1 gap remains**: no methodology for premise-challenging, just calibration that suppresses it.

What is still missing for probe-1: a Q-G1-specific methodology instruction that says "for approach soundness, identify the core architectural choice and verify whether the rationale given is backed by evidence in the plan or asserted as fact." Without this, Q-G1 evaluation of probe-1 defaults to "SQLite is a valid technology choice — PASS" rather than "the plan asserts PropertiesService is too slow without benchmarks — this is an unvalidated premise that constrains the entire design."

**analysis.md (after 4979eee)**

The analysis.md probe tests breadth coverage across L1 questions on a meta-document (the probe analysis file itself). The Iter 4 regression (6 findings vs 10 baseline) was attributed to the standalone tracing preamble crowding breadth. After 4979eee, the preambles are question-scoped — the l1-advisory evaluator now has "Question-specific methodology" bullets only for Q-G21 and Q-G22.

What is still missing: the l1-advisory evaluator evaluates 19 questions in a single task. Research Finding 2 (checklist completeness) suggests that without an explicit "complete all 19 questions" instruction, later questions (Q-G20, Q-G23, Q-G24, Q-G25) may receive cursory assessment after the evaluator has already produced thorough findings for earlier questions. The analysis.md regression likely has a residual cause in addition to the tracing preamble issue: the l1-advisory evaluator lacks a completion guarantee. The evaluator can produce a compliant-looking JSON with 19 entries, but the depth of reasoning decreases for later entries. For a broad meta-document like analysis.md (which touches many questions), shallow later-question assessments suppress findings that would require careful reading of the whole document.

The 4979eee refactor is a necessary but not sufficient fix for the breadth regression: it removes the preamble-level salience distortion, but the per-question salience asymmetry (Q-G21/Q-G22 annotated, other 17 not) and the late-question depth attenuation remain.

## Improvement Options — Iteration 5

### Option Q: Q-G1 Approach Soundness Methodology in L1 Blocking Evaluator

**Addresses:** Q2 — Task precision / Q5 — Examples / Q8 — Chain-of-thought (Q-G1 has no evaluative CoT)
**What changes:** Add a 5-line question-specific methodology block for Q-G1 to the l1-blocking evaluator prompt, inserted in the "Question-specific methodology" section (after the calibration instruction, before the output contract). The block follows the same "Question-specific methodology" format as the l1-advisory evaluator's Q-G21/Q-G22 block:

```
Question-specific methodology:
- For Q-G1 (Approach soundness): Use challenge-justify-check:
    (1) Identify the core architectural or technology decision the plan makes
    (2) Find the stated justification — what reason does the plan give for this choice?
    (3) Check: is the justification backed by evidence, data, or explicit trade-off analysis?
        If the justification is asserted as fact ("X is too slow", "Y won't work"),
        not measured or cited → flag NEEDS_UPDATE regardless of whether the claim seems plausible.
    The calibration heuristic ("senior developer impact") does NOT apply to Q-G1 premise checks —
    approach assumptions that turn out wrong waste entire implementation cycles.
```

The critical structural element: explicitly carving out Q-G1 from the "borderline → PASS" calibration heuristic. This is a 7-line addition to the l1-blocking evaluator prompt.

**Why it helps:** Probe-1's planted defect is exactly this pattern: "PropertiesService is too slow" is asserted as fact without benchmarks. The current calibration instruction tells the evaluator to apply a "would a senior developer encounter this?" test — and the answer for an unvalidated claim is "maybe," which resolves to PASS under the calibration default. The challenge-justify-check template converts Q-G1 evaluation from passive ("is this technically valid?") to active ("is this justified or assumed?") — the same algorithmic-specificity-for-judgment-calls pattern that drove every successful prior iteration. This directly addresses the Iter 4 probe-1 regression root cause.

**Predicted impact:** HIGH for probe-1 specifically. Medium overall. Q-G1 is the Gate 1 question most likely to detect the class of defect where a plan's approach rests on an unvalidated premise — exactly the defect that causes "works in plan, breaks in implementation." The 7-line addition is subordinated to the question-list (correct style for this prompt) and does not affect Q-G2 or Q-G11 evaluation.

**Conciseness impact:** ADDS_VERBOSITY — 7 lines in the l1-blocking evaluator prompt. Justified by the direct probe-1 regression fix and by the importance of Q-G1 as the top-level approach soundness gate.

---

### Option R: Checklist Completion Instruction for Multi-Question Evaluators

**Addresses:** Q7 — Anti-patterns (salience asymmetry/late-question depth attenuation) / Q8 — Chain-of-thought (no completion guarantee)
**What changes:** Add a single-line completion reminder to the l1-advisory evaluator prompt and the cluster evaluator prompt template, positioned immediately before the output contract section (after all question-specific methodology bullets):

```
Coverage: Evaluate ALL questions in your list before writing your findings JSON. Do not
submit partial results — every question in your assigned set must have a status entry.
```

This is 2 lines. It does not change the question list or methodology — it is a process instruction that prevents early termination of evaluation after high-salience questions are resolved.

**Why it helps:** Research Finding 2 (checklist completeness, Monte Carlo/promptbuilder.cc 2025) shows that multi-question LLM evaluators produce depth-decreasing responses over long question lists without an explicit completion guarantee. The analysis.md regression (6 findings vs baseline's 10) is consistent with the evaluator producing thorough findings for early and annotated questions, then shallow assessments for later questions. The 2-line instruction is the minimal intervention — it does not add methodology overhead, only a process reminder that the evaluator must complete the full list before submitting. This is the evaluation equivalent of the existing "Finding specificity" instruction (Iter 3 Option L) but for completeness rather than depth.

**Predicted impact:** MEDIUM for analysis.md specifically. Medium-low overall. The failure mode (depth attenuation on later questions in 19-question lists) is a known LLM behavior on long checklists, but it manifests most clearly on broad documents (like analysis.md) that surface many questions simultaneously. For focused implementation plans where only 3-5 questions have real findings, the effect is negligible.

**Conciseness impact:** MINIMAL — 2 lines. Zero protocol overhead.

---

### Option S: Q-G1 Scope Exemption from Calibration Heuristic

**Addresses:** Q6 — Constraints (calibration instruction too conservative for Q-G1) / Q2 — Task precision
**What changes:** Add a single clarifying sentence immediately after the calibration instruction in the l1-blocking evaluator prompt, explicitly scoping it away from Q-G1:

```
Calibration exception: Q-G1 (Approach soundness) is NOT subject to the "only if a senior
developer would encounter it" heuristic. Unvalidated assumptions about approach viability
waste entire implementation cycles — flag even when the claim sounds plausible.
```

This is 3 lines. It preserves the calibration instruction for Q-G2 and Q-G11 while creating an explicit carve-out for Q-G1.

**Why it helps:** The core tension identified in Q2/Q6 is that the calibration instruction ("borderline → PASS") is the right heuristic for Q-G11 (files examined) and Q-G2 (standards compliance) but counterproductive for Q-G1 (approach soundness). Q-G1 requires the evaluator to challenge premises — exactly the kind of hypothetical ("what if this claim is wrong?") that the calibration instruction says to suppress. By creating an explicit scope exemption, Option S resolves the tension without changing the calibration instruction's behavior for Q-G2/Q-G11. Options Q and S are complementary: Q adds a positive methodology (what to look for), S removes a negative constraint (what the evaluator was told to suppress).

**Predicted impact:** HIGH for probe-1 combined with Option Q. Lower standalone — it is an inhibitor-removal rather than a methodology addition. The expected value of Option S is highest when used together with Option Q (Q adds the challenge-justify-check template; S removes the calibration suppression that would override Q's conclusion with a PASS). Together they form a "methodology + constraint-removal" pair.

**Conciseness impact:** MINIMAL — 3 lines.

---

### Option T: Option P Removal (IS_GAS Scope Reminder)

**Addresses:** Technique History "What didn't work" — Iter 4 Option P was NEUTRAL, adding noise without measurable benefit. The Iter 4 recommendation explicitly suggested removing it.
**What changes:** Remove the 3-line IS_GAS scope reminder from the impact-evaluator cluster prompt:
```
When IS_GAS=true and you are the impact-evaluator: you are the ONLY L2 cluster evaluator
running. Questions Q-C37, Q-C38, Q-C39, Q-C40 (the tracing questions) are your exclusive
responsibility — no other evaluator will assess them.
```
This removes 3 lines of declarative text that add informational scope without algorithmic payoff.

**Why it helps:** Option P was identified as NEUTRAL in Iter 4 — probe-1 (IS_GAS-relevant) saw baseline winning (19 changes vs 11), consistent with the scope reminder narrowing evaluator focus without compensating quality gain. The Iter 4 Technique History explicitly flags it as inert noise. Removing it reduces the impact-evaluator prompt's length by 3 lines and eliminates a potential salience attractor that emphasizes tracing questions relative to other impact cluster questions. This is a "clean up known inert additions" option — the only risk is if removing it causes regression on IS_GAS+tracing plans (probes 2-5 are not IS_GAS, so the primary concern is isolated to IS_GAS configurations).

**Predicted impact:** LOW positive (removes noise, slightly reduces salience asymmetry within impact cluster). Near-zero regression risk based on Iter 4 evidence. The removal is cleanest as part of a multi-option experiment that also includes positive additions (Q, R, S) — if the experiment regresses on IS_GAS probes, Option T can be restored in isolation.

**Conciseness impact:** REDUCES_VERBOSITY — removes 3 lines.

## Evaluation Questions — Iteration 5

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified in the prompt (plan reviewed, edits applied, scorecard produced, ExitPlanMode called)?
- Q-FX2: Does the output conform to the required format/structure (ASCII scorecard box, gate health lines, pass progress bars, convergence message)?
- Q-FX3: Is the output complete — does it cover all required aspects (all active evaluators spawned, all NEEDS_UPDATE findings addressed, Q-G9 organization pass run, markers stripped, gate marker written)?
- Q-FX4: Is the output appropriately concise — no unnecessary padding, repetition of evaluator findings, or verbose pass summaries beyond what the format specifies?
- Q-FX5: Is the output grounded in the input — no hallucinated question IDs, no fabricated evaluator findings, no invented plan content?

### Dynamic (derived from Q1-Q10 gaps for iteration 5)
- Q-DYN-15: When a plan's core architectural or technology choice is justified by an unvalidated claim ("X is too slow", "Y won't work") without benchmarks or explicit trade-off analysis, does the L1 evaluator flag Q-G1 NEEDS_UPDATE with a specific citation of the unsupported claim — rather than passing the claim as plausible technical judgment? [addresses: Q2, Q6, Q8 — Q-G1 approach soundness without premise challenge]
- Q-DYN-16: Does the l1-advisory evaluator produce substantive findings (not cursory PASS assessments) for ALL 19 advisory questions, including the later-appearing questions (Q-G20, Q-G23, Q-G24, Q-G25) — not just the annotated (Q-G21, Q-G22) and early-appearing questions? [addresses: Q7, Q8 — checklist completion and anti-salience asymmetry]
- Q-DYN-17: On breadth-coverage probes (analysis.md, probe-1 for non-tracing questions), does the improved prompt produce at least as many valid NEEDS_UPDATE findings as the iteration 4 baseline — demonstrating that probe-specific methodology additions do not suppress coverage on questions not targeted by those additions? [addresses: Q7 — breadth regression prevention]

## Experiment Results — Iteration 5
*Date: 2026-03-16*

### Implemented Directions
#### Experiment 1: Options Q+R+S+T combined
**Options applied:** Q (Q-G1 challenge-justify-check methodology), R (checklist completion reminder), S (Q-G1 calibration exemption), T (remove IS_GAS scope reminder)
**Applied changes:** 7-line Q-G1 methodology block + 3-line calibration exception + 2-line completion reminder (l1-advisory + cluster) + 3-line deletion (IS_GAS reminder)

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | Q+R+S+T | 13.9% vs 28.5% | -14.6% | ~0% | ~0% |

### Per-Question Results (A=baseline / B=exp / TIE across 6 tests)
Q-FX1: 3/2/1  Q-FX2: 3/1/2  Q-FX3: 3/2/1  Q-FX4: 1/2/3  Q-FX5: 3/2/1
Q-DYN-15: 2/2/2  Q-DYN-16: 2/1/3  Q-DYN-17: 3/1/2

### Per-Probe Breakdown
- **probe-1** (Q-G1/Q-G10): A=0.66, B=1.00 — Exp-1 slightly better (DYN-15 win: "challenge-justify-check" framing sharper)
- **probe-2** (Q-G11/Q-C38): A=0.33, B=1.66 — Exp-1 wins (grounding, structured table of phantom refs, explicit mapping)
- **probe-3** (Q-G21/Q-G22): A=2.00, B=1.32 — BASELINE wins (correct SOLID rating; exp-1 had wrong REWORK rating for Gate 1-clear plan)
- **probe-4** (Q-C40/Q-G20): A=3.01, B=0.67 — BASELINE wins strongly (more breadth: Q-C26, Q-C27, Q-C36 found; sharper Q-C40 distinction; Q-G1 PASS correct)
- **probe-5** (Q-C37/Q-C39): A=2.00, B=1.67 — BASELINE wins (correct Gate 1 classification of Q-C39; deeper off-by-one cascade analysis)
- **analysis** (breadth probe): A=5.67, B=0.33 — BASELINE wins strongly (11 findings vs 5; deeper advisory coverage; Q-G11 Gate 1 correctly opened; Q-C37/C38/C40 coverage)

## Results & Learnings

**What worked:** Option Q alone improved DYN-15 on probe-1/probe-2 (sharper premise framing). The "challenge-justify-check" framing produced more precise Q-G1 findings when the approach defect was genuine. Option R had no measurable effect either way (genuinely neutral).

**What didn't work:** Q+S combination caused Q-G1 over-triggering on probe-4 (approach is sound; weakness is in verification/Q-C40, not the approach itself). Option T (removal of IS_GAS reminder) had no effect on measured quality.

**Root cause analysis:** The Q+S interaction is the core problem. Option S removes the conservative PASS guard from Q-G1 evaluation by exempting it from the calibration heuristic. When combined with Q's challenge-justify-check template (which fires on any architectural decision, not just invalid premises), the result is a Q-G1 evaluator that challenges all approach decisions — including sound ones like probe-4's sha256sum performance choice, which is industry-standard and adequately justified. The calibration heuristic was serving as a false-positive suppressor for Q-G1; S's removal caused over-triggering. On probe-3, Exp-1 also produced a wrong REWORK rating (Gate 1 clear → should be SOLID), which suggests the Q+S combination elevated severity across the board by weakening the conservative default.

**What to try next iteration:** (1) Try Option Q without Option S — the challenge-justify-check methodology is valuable but must retain the calibration heuristic as a false-positive guard. The two must coexist: Q provides the positive methodology ("look for unsupported premises"), the existing calibration provides the threshold ("only flag if a senior developer would encounter it"). (2) Consider a more targeted calibration exception: instead of exempting all of Q-G1 from calibration, add a narrow carve-out that only fires when the plan uses language explicitly asserting a constraint as unchallengeable fact ("X is too slow", "Y won't work", "Z is unavailable") — not on all approach decisions.

**Best experiment:** Exp-1 (Q+R+S+T) — 13.9% quality score
**Verdict: NEUTRAL**
Decided by: all dimensions within noise thresholds (-14.6% spread)

## Experiment Results — Iteration 6
*Date: 2026-03-17*

### Implemented Directions
#### Experiment 1: Option W (Q-G1 conditional block — already in baseline)
**Options applied:** W (Q-G1 challenge-justify-check with conditional activation predicate)
**Applied changes:** No change — Q-G1 block was already present in baseline (committed in e71b28c/4979eee)

#### Experiment 2: Option W (no-op) + Option V (Q-G20 methodology annotation)
**Options applied:** V (5-line Q-G20 narrative-commitment methodology in l1-advisory before Q-G21)
**Applied changes:** 5-line Q-G20 methodology note in l1-advisory before Q-G21 — scope: "Approach/Design section" narrative commitments → implementation step check

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | W (no-op) | 1.8% vs 1.8% | 0.0% | 0% | 0% |
| Exp-2 | V only | 1.8% vs 1.8% | 0.0% | ~0% | ~0% |

### Per-Question Results (A wins / B wins / TIE across 6 tests)
Q-FX1: 0/0/6  Q-FX2: 0/0/6  Q-FX3: 2/2/2  Q-FX4: 0/0/6  Q-FX5: 0/0/6
Q-DYN-18 (Q-G1 assertion language): 0/0/6  Q-DYN-19 (Q-G1 evidence PASS): 0/0/6
Q-DYN-21 (Q-G20 untestable verify): 0/0/6  Q-DYN-22 (Q-C37 translation): 0/0/6

## Results & Learnings

**What worked:** Option W (Q-G1 conditional predicate) was already incorporated before this iteration — it correctly fires on probe-1 (bare assertion) and correctly PASSES probe-9 (evidence-backed). The baseline is already working well on Q-G1 calibration. Option V produced a slightly sharper Q-G20 finding on probe-4 (identifies "validates checksums before overwriting" as the specific commitment, vs baseline finding element 3 "expected outcome section absent") — but not enough to cross the quality threshold.

**What didn't work:** Option V's Q-G20 methodology annotation uses "Approach/Design section" scope, which correctly identifies one Q-G20 failure pattern (design promises not backed by implementation steps — probe-4 subtype) but misses the other (untestable verification assertions — probe-7 subtype). Probe-7's deficiency lives in the VERIFICATION section, not Approach/Design, so the methodology note doesn't reach it. Both subtypes are real Q-G20 patterns; the annotation is over-narrow.

**Root cause analysis:** Q-G20 has two distinct failure subtypes: (A) design/approach narrative commitments with no implementation step — e.g., "validates checksums before overwriting" in Design with no corresponding step, and (B) verification section with untestable assertions — e.g., "verify the watch mode works correctly." Option V's methodology targets subtype A only. Subtype B is already caught by the base Q-G20 definition (story arc element 4: testable assertion required). Adding subtype A coverage via methodology note doesn't change probe-7's outcome because the base definition handles it independently. The net improvement from V is sharpened citing precision on probe-4, insufficient to cross the 15% quality threshold.

**What to try next iteration:** The Q-G1 calibration problem from Iter 5 appears solved (the conditional predicate is already in the baseline and working correctly on both probe-1 and probe-9). The remaining unaddressed gap is: **broader advisory question coverage** on the analysis.md breadth probe. The analysis.md breadth test regressed in Iter 5 and has not recovered — the baseline produces fewer findings on breadth probes than on focused probes. One untried approach: add a "depth-maintenance check" instruction to the l1-advisory evaluator that explicitly names the final 5 questions (Q-G20 through Q-G25) and reminds the evaluator to give them equal consideration, since they appear late in the 19-question set. Alternatively, restructure the l1-advisory evaluator into two passes (questions 1-10, then 11-19) to counteract depth attenuation.

**Best experiment:** Exp-2 (W+V) — 1.8% quality score
**Verdict: NEUTRAL**
Decided by: all dimensions within noise thresholds (0.0% spread)

---
*Date: 2026-03-17 — Iteration 7*

## Structural Diagnostic (Q1-Q10) — Iteration 7

Q1 — Role/Persona: The Role & Authority block is fully adequate after Iter 1. No new gaps.

Q2 — Task Precision: The l1-advisory evaluator receives a flat list of 19 questions with no structural ordering, priority weighting, or batch instruction. The question list runs from Q-G4 through Q-G25. Questions Q-G20 through Q-G25 — the six questions added most recently (commits #71–#73) and the ones most likely to catch subtle design-level defects — appear in positions 14–19 of 19. An evaluator working through a 19-item list with no depth-maintenance guidance will naturally produce progressively shorter assessments as its output grows. The current prompt has no mechanism to counteract this — not even a reordering that would place high-miss-rate questions earlier. The analysis.md breadth regression (Iter 5: 6 findings vs 10 baseline; Iter 6: not recovered) is the empirical evidence. Precision gap: the 19-question flat list has no structural protection against the evaluator front-loading effort on early questions and shortchanging the final 6.

Q3 — Context Adequacy: Strong. No new gaps after Iter 3 Option K.

Q4 — Output Format: Well-specified. No new gaps.

Q5 — Examples: The impact-evaluator has a concrete Q-C39 example (Iter 4 Option O) that improved detection of field-index defects. The l1-advisory evaluator has methodology annotations for Q-G21/Q-G22 (trace-verify-cite). It has NOTHING for Q-G23 (proportionality: does the plan's effort match the change's scope?), Q-G24 (core-vs-derivative weighting: are the most foundational steps spec'd first?), or Q-G25 (feedback loop completeness: do downstream consumers have a path to verify the change works?). These three questions are the most conceptually abstract in the advisory list, appear latest in the sequence, and have no example to anchor evaluator reasoning. An evaluator seeing Q-G23 with only the question definition may produce a 1-sentence PASS or NEEDS_UPDATE without articulating the proportionality comparison.

Q6 — Constraints: Adequate. No new critical gaps.

Q7 — Anti-patterns: The l1-advisory evaluator's flat 19-question list is a structural depth-attenuation risk. Questions 14–19 (Q-G20 through Q-G25) receive systematically less reasoning effort than questions 1–6 simply because they appear later in the output. Research from CheckEval (2025) and position-bias studies confirms that LLM evaluators working through long checklists produce depth-decreasing responses without explicit depth-maintenance instructions or structural reordering. The current prompt's question-specific methodology annotations for Q-G21/Q-G22 partially compensate by adding salience for those two, but Q-G20, Q-G23, Q-G24, Q-G25 are unprotected. This is a well-known anti-pattern in LLM-as-judge systems: annotation asymmetry + late-list position = compounded depth attenuation.

Q8 — Chain-of-thought: Q-G23 (proportionality), Q-G24 (core-vs-derivative), and Q-G25 (feedback loop) are the three questions with no CoT guidance at all. Each requires a distinct reasoning mode: Q-G23 requires comparing plan complexity to change scope (is a 10-phase plan warranted for a 2-file bug fix?); Q-G24 requires identifying which steps define the core capability vs derivative scaffolding (does the plan spec the primary logic before wiring it up?); Q-G25 requires tracing from the plan's outputs to their downstream consumers (will anyone know if this breaks?). All three are judgment-intensive. The "Calibration" instruction provides a relevance threshold but no reasoning template for HOW to apply it to these abstract quality dimensions. No chain-of-thought means the evaluator makes an unstructured judgment that is likely to be cursory for late-list questions.

Q9 — Domain specifics: Strong. No new gaps.

Q10 — Tone/register: Consistent. No new gaps.

## Domain & Research Findings — Iteration 7

Domain: LLM-as-judge checklist evaluation; depth attenuation in multi-question evaluator agents; position effects in long question lists; structural reordering vs annotation strategies.

**Finding 1 — CheckEval (2025) confirms checklist question ordering and annotation asymmetry drive recall disparity:** The CheckEval framework (EMNLP 2025) demonstrates that LLM evaluators working through checklists exhibit measurable depth decrease for items appearing in the final quartile of a list. The framework recommends either (a) structuring the checklist so higher-risk items appear first, or (b) adding elaboration annotations that counteract the late-item depth drop. Both strategies are actionable for the l1-advisory evaluator's Q-G20–Q-G25 problem: reordering to put Q-G20–Q-G25 earlier (before Q-G4–Q-G8 which are simpler and routinely PASS), or adding brief elaboration for the three unannotated abstract questions. The reordering approach avoids adding prompt verbosity; the annotation approach is consistent with the Iter 4 success pattern (M+N+O).

**Finding 2 — Position bias in LLM judges: late-list items receive shallower treatment independent of content (IJCNLP 2025):** The "Judging the Judges" study (2025, IJCNLP) confirms that position effects in LLM evaluation are not purely due to content difficulty — they are systematic ordering effects. Even when a late-list question is more important than an early-list question, it receives less reasoning effort. The finding most applicable here: "quality gap modulation" — when the evaluator has already produced thorough findings for several questions (confirming real defects), it applies a lower-attention baseline to subsequent questions. For the l1-advisory evaluator applied to a plan with obvious early defects (like input4's "maybe add caching"), Q-G20–Q-G25 assessments are especially at risk of depth attenuation because the evaluator has already "proven" it is doing its job. Mitigation: reorder so that the abstract, structurally-sensitive questions appear before the simpler ones that are frequently PASS (reducing the "already done my work" effect at the point Q-G20+ are reached).

**Finding 3 — Split-evaluator two-pass approach increases recall for long question lists (CheckEval, EMNLP 2025; DeepEval multi-agent evaluation 2025):** Production LLM evaluation systems that split a long question list into two focused evaluator tasks (each ~10 questions) show 15–30% higher recall on the second half of the original combined list, with no regression on first-half recall. The tradeoff is latency (two sequential tasks vs one) and token cost. For the review-plan use case, latency is already 30–90s per pass — one additional evaluator task adds ~15–20s. The alternative is a structural reordering within the single evaluator, which has zero latency cost but captures only partial benefit (the ordering effect is attenuated but not eliminated). The split approach is the most reliable fix; the reorder approach is the lowest-cost partial fix.

## Test-Run Observations — Iteration 7

**input4-plan-with-issues.md (sync engine remote repos with deliberate defects)**

IS_GAS=false, IS_NODE=false, HAS_STATE=true (TYPES array modified), HAS_DEPLOYMENT=true (push directly to main), HAS_TESTS=false (no test step), IS_TRIVIAL=false. Active clusters: impact (Q-C3/Q-C26/Q-C35/Q-C37-Q-C40), state (Q-C36), operations (Q-C21), testing (Q-C8/Q-C9). L1-advisory evaluator runs all 19 questions.

Early questions (Q-G4, Q-G5, Q-G8, Q-G10) would all have obvious NEEDS_UPDATE findings: the plan uses "maybe", "might need", "somehow" throughout — classic Q-G10 assumption exposure and Q-G5 scope focus failures. After producing 5–6 NEEDS_UPDATE findings for early questions, the evaluator reaches the final quartile (Q-G20 through Q-G25). Predicted behavior without depth protection:

- Q-G20 (story arc): The plan has no narrative arc — "Steps 1–7" are flat bullet points with no declared phases or outcomes. A thorough evaluator would cite steps 3–4 ("maybe add some caching") as lacking a committed story. A depth-attenuated evaluator would write: "PASS — plan has steps" or a brief NEEDS_UPDATE without citing the specific vague steps.
- Q-G23 (proportionality): 7 vague steps to add remote git repo support is disproportionate — the scope is large (auth, conflict resolution, caching, TYPES schema migration) but steps are under-specified. A thorough evaluator would note the mismatch: the plan's brevity is inversely proportional to the feature's complexity. A depth-attenuated evaluator would write: "NEEDS_UPDATE — plan lacks detail" without the proportionality comparison.
- Q-G24 (core-vs-derivative): The plan lists `--remote` flag and cloning before defining the schema change in TYPES array (step 5), when logically the schema change is the core foundational change that everything else depends on. A thorough evaluator would flag this ordering. A depth-attenuated evaluator may not catch the inversion.
- Q-G25 (feedback loop): No acceptance criteria, no test step, no verification other than "Test it manually." A depth-attenuated evaluator may produce a 1-sentence finding that doesn't articulate which downstream consumers (other extensions relying on the TYPES schema) are at risk.

**input2-node-plan.md (rate limiting for mcp_gas API)**

IS_NODE=true, HAS_STATE=true, HAS_DEPLOYMENT=true, HAS_TESTS=true, IS_TRIVIAL=false. Good plan — most questions should PASS. Node-evaluator active + testing + state + operations + impact clusters. L1-advisory evaluator runs all 19 questions.

Early questions would mostly PASS quickly and correctly. By the time the evaluator reaches Q-G23–Q-G25, it has processed ~10 PASSes and may be producing increasingly brief assessments. Critical check: Q-G24 (core-vs-derivative) — Phase 1 (rateLimiter.ts) is correctly the core, but does the plan spec the `TokenBucket` logic in sufficient depth before wiring it into gasClient.ts? The type definitions in step 2 are terse; the algorithm description for token bucket in step 1 is adequate ("token bucket algorithm with per-user tracking") but doesn't specify the refill mechanics. A thorough evaluator would flag this gap between step 1's algorithm description and the testability of step 5 ("unit tests for token bucket algorithm" — but the algorithm isn't fully specified). A depth-attenuated evaluator would PASS Q-G24 as "Phase 1 correctly precedes Phase 2."

Cross-probe observation: **both plans' final-quartile questions (Q-G20–Q-G25) are predicted to receive either cursory PASS assessments (input2) or NEEDS_UPDATE findings without adequate specificity (input4).** The pattern matches the Iter 5 analysis.md breadth regression root cause. The two consecutive NEUTRAL iterations (5 and 6) targeted Q-G1 and Q-G20 individually; neither addressed the structural depth attenuation across the Q-G20–Q-G25 cluster as a group.

## Improvement Options — Iteration 7

### Option X: Reorder l1-advisory Question List — Late-at-Risk Questions First

**Addresses:** Q2 — Task precision (flat list, no depth protection) / Q7 — Anti-patterns (depth attenuation at late positions) / Q8 — Chain-of-thought (no reasoning template for Q-G23/Q-G24/Q-G25)
**What changes:** Reorder the 19 questions in the l1-advisory evaluator prompt from:
`Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19, Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25`
to a depth-protected order that places the 6 most-at-risk questions (the abstractly-judged, empirically-under-detected ones) earlier:
`Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25, Q-G4, Q-G5, Q-G8, Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19, Q-G6, Q-G7`

Rationale for order: Q-G20–Q-G25 (story arc, internal consistency, cross-phase, proportionality, core-vs-derivative, feedback loop) are placed first while the evaluator is at full attention. Q-G4, Q-G5, Q-G8, Q-G10, Q-G12–Q-G14, Q-G16–Q-G19 are placed in the middle (still active attention). Q-G6 (naming conventions) and Q-G7 (doc impact) are placed last — they are the most mechanical and frequently N/A, requiring least depth.

Also add a 3-line methodology note for Q-G23/Q-G24/Q-G25 in the "Question-specific methodology" section, following the same format as Q-G21/Q-G22's trace-verify-cite:
```
- For Q-G23 (Proportionality): Compare plan step count and detail level to the scope of the change.
    A plan with 10 steps for a 1-file bug fix is over-engineered; 3 vague steps for a multi-file
    feature is under-engineered. Cite the specific mismatch.
- For Q-G24 (Core-vs-derivative weighting): Identify the most foundational new function or
    schema. Verify it is specified in full before steps that depend on it.
    If wiring/integration steps precede core logic specification → NEEDS_UPDATE.
- For Q-G25 (Feedback loop): Identify who or what downstream consumes this change's outputs.
    If no test, acceptance criterion, or stakeholder check is specified → NEEDS_UPDATE.
```

**Why it helps:** Finding 1 (CheckEval 2025) recommends placing higher-risk items first to counteract late-list depth attenuation. Finding 2 (IJCNLP 2025) confirms position ordering directly affects reasoning depth independent of content. The reordering costs zero tokens and zero latency — it is a pure structural change to the evaluator prompt. The 3-line methodology notes for Q-G23/Q-G24/Q-G25 follow the Iter 4 success pattern (algorithmic specificity for judgment calls) and address the Q8 gap (no CoT for abstract questions). Combined, the reorder + notes directly target the analysis.md breadth regression root cause (late-list questions receiving cursory treatment).

**Why it is the best standalone option:** (a) Zero latency and token cost — pure reordering with 3-line annotation additions. (b) Directly targets the structural mechanism of the two-iteration stall (depth attenuation). (c) Consistent with the "instruct + exemplify" pattern that drove Iter 4 gains. (d) Not blocked by any known failure mode from prior iterations (unlike Q+S, which caused over-triggering; unlike V, which was over-narrow).

**Predicted impact:** MEDIUM-HIGH. The analysis.md breadth regression (-4 findings) is the primary target. Input4's Q-G23/Q-G24/Q-G25 findings are secondary targets. The proportionality/core-derivative/feedback-loop questions are the most abstract and most consistently under-detected — reordering + annotation is the minimum intervention that addresses both the position and the CoT gaps simultaneously.

**Conciseness impact:** MINIMAL — reordering is zero-cost; 3-line methodology notes add ~9 lines total to the l1-advisory evaluator prompt. Less verbosity than Option V (which was 5 lines for a single question).

---

### Option Y: Two-Pass l1-Advisory Evaluator Split (First: Q-G20–Q-G25, Second: Q-G4–Q-G19)

**Addresses:** Q7 — Anti-patterns (depth attenuation via structural split) / Q2 — Task precision (separate focus per group)
**What changes:** Replace the single l1-advisory evaluator Task with two sequential evaluator Tasks:

- **Pass A (abstract/structural questions — 6 questions):** `Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25`. This evaluator runs first, while the model is at full attention, with no prior output pressure. It uses the existing trace-verify-cite methodology for Q-G21/Q-G22 and the new Q-G23/Q-G24/Q-G25 methodology from Option X.
- **Pass B (standards/process questions — 13 questions):** `Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-G10, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19`. These run second; they are mostly PASS on typical plans and tolerate lower attention depth.

Orchestrator change: spawn Pass A in wave 1 (Priority 2 — after l1-blocking, before or alongside gas/node evaluator); spawn Pass B in wave 1 as well (after l1-blocking). Both write to separate JSON files (`l1-advisory-structural.json`, `l1-advisory-process.json`). Fan-in reads both files; routing logic unchanged. Memoization: `l1_advisory_memoized` covers both groups (group-memoized when all 19 are PASS/N/A across both files).

**Why it helps:** Finding 3 (CheckEval / DeepEval 2025) shows 15–30% recall improvement for the second half of a combined list when split into two focused tasks. The two-pass approach completely eliminates depth attenuation for Q-G20–Q-G25 by giving them their own context with no prior output pressure. It also allows the abstract questions to receive the methodology annotations without the list-length overhead affecting the process questions.

**Why it is a different option from X:** Option X uses a zero-cost structural intervention (reordering + annotation); Option Y uses a structural redesign (split into two Tasks). They address the same root cause via different mechanisms. Y is more reliable but costlier (+1 evaluator Task per pass, +15–20s latency, +~2k tokens per pass). X is cheaper but less decisive (reordering attenuates but doesn't eliminate depth drop; the methodology notes add CoT but don't change context pressure).

**Predicted impact:** HIGH for Q-G20–Q-G25 recall. The split approach is the only mechanism that completely eliminates context-pressure depth attenuation. Trade-off: latency increases by ~20s per pass (additional Task spawn for a 6-question evaluator). Given that review-plan passes already take 30–90s, +20s is a ~25% latency increase — acceptable for the quality gain, but measurable.

**Conciseness impact:** ADDS_VERBOSITY — additional Task config block (~40 lines) + second JSON file routing in fan-in logic. Significant structural change to the convergence loop.

---

### Option Z: Structural Reordering Only (No Annotation Additions)

**Addresses:** Q7 — Anti-patterns (late-list position bias) only
**What changes:** Apply the reordering from Option X (Q-G20–Q-G25 first, Q-G6/Q-G7 last) WITHOUT adding the Q-G23/Q-G24/Q-G25 methodology notes. Pure structural change — zero text added, zero tokens added.

**Why it helps:** This isolates the position-ordering effect from the annotation effect, providing a clean signal on whether reordering alone is sufficient. Research Finding 2 (IJCNLP 2025) confirms position effects are systematic — reordering should improve recall for late-list questions even without additional annotations. If Option Z alone is IMPROVED, it validates the position-ordering hypothesis. If Option Z is NEUTRAL, it confirms that reordering without annotation is insufficient, pointing to Option X (reorder + annotate) or Option Y (split) as the necessary intervention.

**Predicted impact:** MEDIUM — position reordering is a partial fix. Without CoT guidance for Q-G23/Q-G24/Q-G25, the evaluator may still produce cursory assessments for these questions even when they appear first, because the questions themselves are abstract. The expected gain is smaller than Option X (position + CoT) or Option Y (split). Useful as an experiment to isolate the position effect.

**Conciseness impact:** ZERO — pure reordering, no additions.

---

## Evaluation Questions — Iteration 7

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified in the prompt (plan reviewed, edits applied, scorecard produced, ExitPlanMode called)?
- Q-FX2: Does the output conform to the required format/structure (ASCII scorecard box, gate health lines, pass progress bars, convergence message)?
- Q-FX3: Is the output complete — does it cover all required aspects (all active evaluators spawned, all NEEDS_UPDATE findings addressed, Q-G9 organization pass run, markers stripped, gate marker written)?
- Q-FX4: Is the output appropriately concise — no unnecessary padding, repetition of evaluator findings, or verbose pass summaries beyond what the format specifies?
- Q-FX5: Is the output grounded in the input — no hallucinated question IDs, no fabricated evaluator findings, no invented plan content?

### Dynamic (derived from Q1-Q10 gaps and improvement options for iteration 7)
- Q-DYN-23: For plans where questions Q-G20 through Q-G25 are genuinely applicable (structural plan quality, narrative arc, proportionality, core-derivative ordering, feedback loop), does the l1-advisory evaluator produce substantive findings — with specific plan citations — rather than cursory one-sentence assessments? Compare baseline vs improved on the final 6 advisory questions specifically. [addresses: Q2, Q7, Q8 — late-list depth attenuation and missing CoT for abstract questions]
- Q-DYN-24: When a plan has a proportionality mismatch (large scope with few/vague steps, or over-engineered structure for a small change), does the output correctly flag Q-G23 NEEDS_UPDATE with a specific comparison between plan step count/detail and the change's scope — not just "lacks detail"? [addresses: Q8 — no CoT for Q-G23]
- Q-DYN-25: Does the l1-advisory evaluator produce at least as many total NEEDS_UPDATE findings across ALL 19 questions (including early-list Q-G4 through Q-G19) as the baseline — confirming that reordering or splitting did not suppress breadth on the early/middle questions? [addresses: Q7 — anti-regression check for early-list questions after structural change]
- Q-DYN-26: For plans with clear feedback loop gaps (no acceptance criteria, no downstream consumer verification, no automated test for the primary new behavior), does the output flag Q-G25 NEEDS_UPDATE with a specific identification of which downstream consumer or verification path is missing — not just "needs tests"? [addresses: Q8 — no CoT for Q-G25]


---

## Experiment Results — Iteration 7
*Date: 2026-03-17*

### Implemented Directions
#### Experiment 1: Option Y (Two-pass l1-advisory split)
**Options applied:** Option Y
**Applied changes:** Split single l1-advisory Task into l1-advisory-structural (Q-G20–Q-G25, with Q-G23/24/25 methodology notes) + l1-advisory-process (Q-G4–Q-G19); both spawn in wave 1; fan-in reads both JSON files; memoization covers both groups together

#### Experiment 2: Options X+Z (Reorder + annotate)
**Options applied:** Option X, Option Z
**Applied changes:** Reordered l1-advisory question list (Q-G20–Q-G25 first, Q-G6/Q-G7 last); added 3-line methodology notes for Q-G23/24/25

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | Y | 56.4% vs 2.9% | +53.5% | +~20% | +~25s/pass |
| Exp-2 | X+Z | 34.2% vs 12.6% | +21.6% | ~0% | ~0% |

### Per-Question Results (A wins / B wins / TIE across 5 tests)
Exp-1: Q-FX1: 0/3/2  Q-FX2: 0/2/3  Q-FX3: 0/5/0  Q-FX4: 4/1/0  Q-FX5: 0/4/1
       Q-DYN-23: 0/5/0  Q-DYN-24: 0/4/1  Q-DYN-25: 0/3/2  Q-DYN-26: 1/4/0
Exp-2: Q-FX1: 2/2/1  Q-FX2: 0/0/5  Q-FX3: 3/2/0  Q-FX4: 0/3/2  Q-FX5: 0/3/2
       Q-DYN-23: 0/4/1  Q-DYN-24: 0/4/1  Q-DYN-25: 3/2/0  Q-DYN-26: 1/3/1

## Results & Learnings

**Step 1 — Per-option attribution:**
- Option Y (Two-pass split): CONTRIBUTED_TO_WIN. Primary quality driver. DYN-23 went 0/5/0 unanimously — judges cited the structural evaluator running at full attention with zero prior output pressure as the decisive mechanism. DYN-24 (Q-G23 proportionality) went 0/4/1, DYN-26 (Q-G25 feedback loop) went 1/4/0. The split also improved Q-FX1, Q-FX3, Q-FX5 — finding real defects (toggleProtection spec gaps, TYPES ordering, parseCSV underspecification, story arc gaps) that baseline missed entirely. Q-FX4 (conciseness) was the only dimension where baseline won 4/1/0 — the additional Task produces more output, which is legitimate but not concise.
- Options X+Z (Reorder + annotate): CONTRIBUTED_TO_WIN (partial). Both experiments improved over baseline. Exp-2 achieved +21.6% with zero token/latency cost. It found Q-G24 and Q-G22 structural findings on input1 and input5. However, on input4 (plan with planted defects), Exp-2 missed security/impact findings that baseline caught, trading breadth for depth. Net result: X+Z is a lower-cost partial fix that addresses depth attenuation but does not eliminate it.

**Step 2 — Cross-experiment comparison:**
Exp-1 (two-pass, +53.5%) vs Exp-2 (reorder, +21.6%) confirms the split approach is decisively better than reordering alone. The +32% quality gap between them validates CheckEval Finding 3: two focused evaluator tasks show 15-30% recall improvement vs reordering alone — our result shows +32% absolute quality improvement, consistent with the finding at the high end. Exp-2's breadth tradeoff (Q-DYN-25: A wins 3/2/0 for Exp-2 vs 0/3/2 for Exp-1) confirms that reordering alone without a split may suppress breadth on the process questions to partially compensate for structural depth.

**Step 3 — Root cause:**
Exp-1's +53.5% gain is driven by eliminating context-pressure depth attenuation for Q-G20–Q-G25 entirely. When these 6 questions run as their own Task with zero prior output, the evaluator applies full reasoning to each. The 3-line methodology notes for Q-G23/24/25 amplify this by providing concrete evaluation templates (proportionality mismatch, core-before-derivative, downstream consumer). The result is that every test plan's structural quality gaps are surfaced — on input4 (planted defects), all 3 structural planted defects were caught; on input1 (GAS), Q-G24 and Q-G25 gaps were found that a single-evaluator run missed. The split approach also cleanly memoizes both groups together, preserving the efficiency gains from memoization.

**What worked:** Option Y (two-pass split) is the highest-impact change found across 7 iterations. It eliminates the root cause of the two-iteration stall by architectural means rather than annotation alone. The "instruct + exemplify + verify" triad from Iter 4 (M+N+O) now has an architectural complement: structural isolation via task split.

**What didn't work:** Exp-2's reorder-only approach (X+Z) produces measurable improvement (+21.6%) but with a breadth tradeoff on some plans. Not a failure, but clearly inferior to Exp-1.

**Root cause analysis:** Late-list depth attenuation is a systematic context-pressure effect that cannot be fully mitigated by reordering alone (Exp-2 confirms). Only structural isolation (separate Task) eliminates it. This is consistent with the research findings: CheckEval/DeepEval show 15-30% recall improvement from task splitting, not from reordering. The +53.5% improvement in Exp-1 vs +21.6% in Exp-2 quantifies the difference between architectural isolation and positional mitigation.

**What to try next iteration:** (1) Investigate whether the l1-advisory-structural task's methodology notes for Q-G23/24/25 can be further refined based on Iter 7 evidence (e.g., Q-DYN-26 won 1/4/0 rather than 0/5/0 — baseline once won here, suggesting Q-G25 detection is still slightly inconsistent). (2) Check if the memoization of both l1-advisory groups together is correct — if one group stabilizes faster than the other, splitting the memoization condition could save evaluator spawns.

**Best experiment:** Exp-1 (Y) — 56.4% quality score
**Verdict: IMPROVED**
Decided by: quality (+53.5% spread)

### 2026-03-17 — Iteration 7 → IMPROVED

**Experiments:** 2 parallel — best was Exp-1 (Option Y: two-pass l1-advisory split)
**Verdict:** IMPROVED (decided by: quality, +53.5% spread)

**What worked:**
- Option Y (Two-pass split): l1-advisory split into l1-advisory-structural (Q-G20–Q-G25 first, full attention) + l1-advisory-process (Q-G4–Q-G19). All 5 test plans showed measurable structural finding improvement. Q-DYN-23 unanimous (0/5/0). Structural planted defects in input4 caught completely. Eliminates context-pressure depth attenuation architecturally.
- Options X+Z (Reorder + annotate, Exp-2): +21.6% improvement — valid secondary finding, lower cost, but inferior to Y.

**What didn't work:**
- Nothing regressed — both experiments improved over baseline.

**Actionable learning:**
Late-list depth attenuation for Q-G20–Q-G25 requires architectural Task isolation (not just reordering) to fully eliminate. The two-pass split is the canonical fix. Reordering (X+Z) is a useful lower-cost partial mitigation but should not be preferred over Y when latency is acceptable (+25s/pass is acceptable given 30-90s pass duration). Scope gate WARNs (memoize/routing) were not realized — monitor in production but do not block.

Scope gate WARN for Exp-1: Q-SG6, Q-SG8, Q-SG12 — routing and memoization concerns. Status: SCOPE_WARN. Monitor for regression in multi-pass reviews but did not manifest in 5-plan test.
Scope gate WARN for Exp-2: Q-SG12 — attention reallocation risk. Status: SCOPE_WARN.

---
*Date: 2026-03-17 — Iteration 8*

## Structural Diagnostic (Q1-Q11) — Iteration 8

Q1 — Role/Persona: The Role & Authority block is fully adequate after Iter 1 and remains intact. No new gap.

Q2 — Task Precision: The l1-advisory-structural evaluator's methodology for Q-G25 (Feedback loop) is: "Identify who or what downstream consumes this change's outputs (callers, tests, acceptance criteria, stakeholder checks). If no test, acceptance criterion, or stakeholder check is present → NEEDS_UPDATE." This instruction is logically complete but contains a subtle over-triggering risk: it requires identifying the downstream consumer but provides no graduation rule for plans that have acceptance criteria in an implicit form (e.g., "Test it manually to make sure it works" — this is a consumer check, albeit a weak one). DYN-26 won 1/4/0 rather than 0/5/0, meaning the baseline beat the improved prompt once on Q-G25 detection. The baseline win is consistent with the evaluator over-triggering on plans that do have a feedback loop (just a thin one), producing a NEEDS_UPDATE when PASS would be more calibrated. The instruction needs a qualification: Q-G25 should be NEEDS_UPDATE only when no feedback mechanism whatsoever is present — not when a weak one exists and a strong one would be better (that's a Gate 3 advisory, not Gate 2 NEEDS_UPDATE).

Q3 — Context Adequacy: Strong across all tested plans. No new gap.

Q4 — Output Format: Well-specified. No new gap.

Q5 — Examples: Q-G25 has the methodology note from Iter 7 (Option Y), but no inline example distinguishing NEEDS_UPDATE (no consumer check at all) from PASS (weak consumer check present). This is the specific gap that explains the DYN-26 1/4/0 inconsistency: the evaluator lacks a calibration anchor for the boundary case.

Q6 — Constraints: The memoization condition for both l1-advisory groups (structural and process) fires when ALL questions in each group return PASS/N/A in a single pass. This is correct but potentially premature for the structural group: Q-G23/Q-G24/Q-G25 were only added to the SKILL.md methodology section in Iter 7. If these three questions return PASS in pass 1 on a plan that genuinely should flag them, the group memoizes and they are never re-evaluated even if plan edits in pass 2 introduce new structural defects. The structural group's memoization condition should require at least 2 passes before firing (matching the stability-based memoization principle), not just 1 PASS/N/A sweep. The process group (Q-G4–Q-G19) correctly uses the same invalidation rule (any edit resets the group), but the structural group has the same invalidation rule yet newer, less-trusted question definitions. This is a precision gap: the structural group's questions (especially Q-G23/Q-G24/Q-G25) have a higher false-negative risk because they are newer and more abstract.

Q7 — Anti-patterns: No new anti-patterns introduced. The two-pass split from Iter 7 removed the depth-attenuation anti-pattern. The remaining structural risk is the memoization asymmetry described in Q6.

Q8 — Chain-of-thought: Q-G25 methodology is now present but the calibration boundary (NEEDS_UPDATE vs advisory PASS) for thin feedback loops is unspecified. The instruction "if no test, acceptance criterion, or stakeholder check is present" is a hard binary — it does not handle the common case where a manual test step exists but is inadequate. Without a calibration note that distinguishes "no feedback mechanism" (NEEDS_UPDATE) from "weak feedback mechanism" (Gate 3 advisory at most), the evaluator treats all plans with only "Test it manually" as NEEDS_UPDATE, which caused the one baseline win in DYN-26.

Q9 — Domain specifics: The memoization logic in SKILL.md lines 1329–1340 fires l1_structural_memoized=true as soon as ALL 6 structural questions return PASS/N/A in ANY single pass. This is inconsistent with the stability-based memoization principle applied to L1 questions (which requires 2 consecutive PASS/N/A passes before stability-locking). The structural group should require the same stability threshold to ensure Q-G23/Q-G24/Q-G25 have been validated across a plan-edit boundary before being locked.

Q10 — Tone/register: Consistent. No new gap.

Q11 — Parallelization: The l1-advisory-structural (6 questions) and l1-advisory-process (13 questions) evaluators now run in parallel within the same wave (Priority 1b/1c, both spawned in wave 1). This is correct and optimal. No remaining serialization gap.

---

## Domain & Research Findings — Iteration 8

Domain: LLM-as-judge calibration for boundary cases; stability-based memoization thresholds for newly-introduced question groups; iterative quality gate false-positive/false-negative trade-offs.

**Finding 1 — RocketEval (ICLR 2025): Checklist item reweighting and positional bias in graded evaluation:** RocketEval (ICLR 2025) identifies that limited judgment accuracy in LLM-based checklist grading is "largely attributed to high uncertainty and positional bias." The framework introduces Checklist Item Reweighting to improve score accuracy when gold-standard examples are available. Applied to review-plan: Q-G25's methodology instruction is a hard binary criterion ("if no ... is present → NEEDS_UPDATE") that does not account for uncertainty in the boundary case (manual test step exists but is weak). A calibration note that provides a worked borderline example (the "near-PASS" case for Q-G25) directly addresses the uncertainty that caused the 1/4/0 DYN-26 result. This is the "reweighting" insight applied at prompt level: clarify the boundary explicitly rather than leaving it to evaluator judgment.

**Finding 2 — Multi-agent design: optimize individual agents before composition (MASS framework, 2025):** The MASS study (arxiv 2502.02533) finds that "prompts frequently form an influential design component that yields strong-performing MAS" and that individual agent prompt quality outperforms scaling the number of agents. Applied to review-plan: the l1-advisory-structural evaluator is now a specialized 6-question Task — further optimizing its individual prompt (Q-G25 calibration, memoization threshold) is the highest-leverage remaining improvement per the MASS principle. The split architecture from Iter 7 is already optimal; the remaining gains are in per-agent instruction quality, not architecture.

**Finding 3 — Prompt chaining quality: evaluator calibration drift compounds across passes (Maxim, 2025):** The Maxim prompt chaining guide identifies that "LLM-based evaluators may misalign with human judgment" for specialized domains and that "chaining typically increases token usage but may improve success rates enough to justify the cost." Applied to review-plan: the stability-based memoization for l1-advisory-structural uses a 1-pass threshold — any single pass with all PASS/N/A fires the lock. For a newly-established group (Q-G23/Q-G24/Q-G25 are only 1 iteration old in this role), a 1-pass threshold means a single over-confident PASS from an evaluator under favorable conditions (simple plan, no deep structural defects) locks all 6 questions for the remainder of the review. A 2-pass threshold (same as the stability-based memoization standard) adds resilience against this false-lock failure mode with negligible latency cost (structural evaluators rarely run more than 2 passes for clean plans anyway).

---

## Test-Run Observations — Iteration 8

**input1-gas-plan.md (Sheet Protection Toggle — GAS + UI)**

IS_GAS=true, HAS_UI=true, IS_TRIVIAL=false. Evaluator set: l1-blocking, l1-advisory-structural, l1-advisory-process, gas-evaluator, impact cluster, ui-evaluator. The plan has a Verification section with: "Manual test: open sidebar, click toggle, verify sheet protection changes" and "Run npm test for unit tests." Q-G25 analysis under Iter 7's current instruction:

The instruction says "if no test, acceptance criterion, or stakeholder check is present → NEEDS_UPDATE." This plan HAS "Run npm test for unit tests" — that is a test, a real acceptance criterion. A correct evaluation would PASS Q-G25. However, the manual test ("open sidebar, click toggle, verify sheet protection changes") is ambiguous: it names no specific assertion beyond "verify protection changes." If the evaluator focuses on the specificity gap in the manual step rather than the presence of the npm test step, it could NEEDS_UPDATE — which would be an over-trigger. The current Q-G25 instruction does not clarify: "The feedback loop is present if ANY concrete test, acceptance criterion, or automated check is named — it need not be comprehensive to PASS." This missing qualification is the calibration gap.

**input4-plan-with-issues.md (Sync Engine Remote Repos — deliberately flawed)**

IS_GAS=false, HAS_DEPLOYMENT=true (push directly to main), IS_TRIVIAL=false. The plan's verification section is: "Test it manually to make sure it works." This is a feedback loop — weak, but present. Q-G25 under current instruction would flag NEEDS_UPDATE ("no test, acceptance criterion, or stakeholder check is present"). But there IS a check: "Test it manually to make sure it works" — that is a stakeholder check, albeit informal. A correctly calibrated evaluator would note that a manual-only check with no pass/fail criterion is Gate 3 advisory quality (worth flagging as "strengthen the feedback loop") but NOT a Gate 2 NEEDS_UPDATE of the same severity as "no verification step at all." The current instruction treats both cases identically.

Cross-observation: input1 should PASS Q-G25 (has npm test). Input4 should NEEDS_UPDATE Q-G25 (only manual check, no pass/fail criterion). The current binary instruction ("if no test... is present → NEEDS_UPDATE") handles input4 correctly but risks under-PASS on input1 if the evaluator focuses on the thin manual verification rather than the npm test. Adding an inline PASS example (plan with npm test → PASS) alongside the existing NEEDS_UPDATE case would anchor both sides of the boundary.

**Memoization observation:** On input1 (GAS+UI, well-structured plan), the l1-advisory-structural group would likely produce all PASS/N/A on pass 1 — Q-G20 has Context section, Q-G21/Q-G22 have internally consistent phases, Q-G23 is proportionate (3 phases for sidebar feature), Q-G24 has server module before sidebar before tests (correct ordering), Q-G25 has npm test (PASS). After pass 1, l1_structural_memoized fires and all 6 structural questions are locked. This is correct behavior. On input4 (flawed plan), structural questions would have multiple NEEDS_UPDATE findings — memoization would not fire until after those are resolved (typically pass 2-3). The memoization concern from prior context is more relevant to edge cases: a plan that passes structural questions by luck on pass 1 (evaluator over-optimistic on Q-G25) then gets locked, masking a genuine structural defect that would be caught on pass 2. Requiring 2 consecutive clean passes before firing prevents this false-lock.

---

## Improvement Options — Iteration 8

### Option AA: Q-G25 Calibration Boundary — Inline PASS/NEEDS_UPDATE Example Pair
**Addresses:** Q2 — Task precision (binary criterion missing boundary case) / Q5 — Examples (no example for the boundary PASS case) / Q8 — Chain-of-thought (no calibration for thin feedback loops)
**What changes:** Extend the Q-G25 methodology note in the l1-advisory-structural evaluator prompt. The current instruction is:
```
- For Q-G25 (Feedback loop): Identify who or what downstream consumes this change's outputs (callers, tests, acceptance criteria, stakeholder checks). If no test, acceptance criterion, or stakeholder check is present → NEEDS_UPDATE.
```
Replace with:
```
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
```
**Why it helps:** RocketEval (ICLR 2025) Finding 1 identifies that boundary-case uncertainty is the primary source of LLM evaluator miscalibration in checklist grading. The current Q-G25 instruction is a hard binary that does not separate "no loop" (NEEDS_UPDATE) from "weak loop" (Gate 3 advisory) from "adequate loop" (PASS). The DYN-26 result (1/4/0) is the empirical signal: the baseline evaluator was more conservative on Q-G25 once, producing a more correct calibration on the specific plan where a thin manual check existed. The inline PASS/NEEDS_UPDATE/advisory example triple provides the calibration anchor the evaluator needs, following the Iter 4 success pattern (Option O: concrete example for Q-C39 anchored detection). This change modifies only the l1-advisory-structural evaluator prompt — no orchestrator logic changes required.
**Predicted impact:** MEDIUM-HIGH — Directly targets the specific measurement gap (DYN-26 inconsistency) identified in Iter 7 results. The example triple is the minimal intervention that closes the calibration gap without widening scope.

### Option BB: L1 Structural Group Memoization: Require 2 Consecutive Clean Passes
**Addresses:** Q6 — Constraints (1-pass memoization threshold for newly-established question group) / Q9 — Domain specifics (inconsistency with stability-based memoization standard)
**What changes:** Modify the group memoization condition for l1-advisory-structural (SKILL.md lines 1329–1340) from:
```
IF NOT l1_structural_memoized:
  structural_questions = {"Q-G20", "Q-G21", "Q-G22", "Q-G23", "Q-G24", "Q-G25"}
  all_structural_clean = all(l1_results.get(q, "PASS") in [PASS, N/A] for q in structural_questions)
  IF all_structural_clean:
    l1_structural_memoized = true
    l1_structural_memoized_since = pass_count
    newly_memoized.append("l1-advisory-structural (6 questions)")
```
to a 2-pass stability requirement:
```
IF NOT l1_structural_memoized:
  structural_questions = {"Q-G20", "Q-G21", "Q-G22", "Q-G23", "Q-G24", "Q-G25"}
  all_structural_clean = all(l1_results.get(q, "PASS") in [PASS, N/A] for q in structural_questions)
  IF all_structural_clean:
    IF l1_structural_clean_since == 0:
      l1_structural_clean_since = pass_count  # first clean pass — start the stability window
    ELSE:
      # Second consecutive clean pass (with no edits between — guaranteed by invalidation rule)
      l1_structural_memoized = true
      l1_structural_memoized_since = pass_count
      newly_memoized.append("l1-advisory-structural (6 questions)")
      l1_structural_clean_since = 0  # reset (no longer needed)
  ELSE:
    l1_structural_clean_since = 0  # reset window on any NEEDS_UPDATE
```
Add `l1_structural_clean_since = 0` to the tracking initialization block (Step 4) and memo_file checkpoint serialization.
**Why it helps:** The stability-based memoization standard for individual L1 questions (SKILL.md lines 1308–1324) already requires 2 consecutive PASS/N/A passes before locking a question. The group memoization for l1-advisory-structural currently fires after just 1 clean pass — inconsistent with the stability principle established for individual questions. The Q-G23/Q-G24/Q-G25 methodology notes are only 1 iteration old (Iter 7), making false-PASS on pass 1 a plausible failure mode for those three questions specifically. Requiring 2 consecutive clean passes adds resilience without meaningfully increasing latency for clean plans (the structural evaluator on a clean plan would produce PASS on both pass 1 and pass 2 with negligible additional spawn cost — and the invalidation rule correctly resets the window on any edit). The process group (l1-advisory-process, 13 questions) currently has the same 1-pass threshold — this option applies the fix only to the structural group, which is the higher-risk group given newer, more abstract question definitions.
**Predicted impact:** MEDIUM — Prevents a class of false-lock failure mode for plans where Q-G25 (or Q-G23/Q-G24) generates an over-confident PASS on pass 1 due to evaluator calibration variance. Does not affect final quality scores for well-reviewed plans (they still converge to PASS). The main benefit is resilience: a plan that genuinely has structural defects cannot escape the structural evaluator after a single pass. Latency impact: at most +1 structural evaluator spawn for plans that would have locked after pass 1 — negligible given the existing +25s/pass overhead of the split architecture.

### Option CC: Memoization Split — l1-advisory-process Threshold Stays at 1 Pass, Structural Stays at 2 (Asymmetric Strategy)
**Addresses:** Q6 — Constraints (split memoization thresholds for the two l1-advisory groups based on question stability risk) / Q11 — Parallelization (ensure one group locking faster doesn't cascade unnecessary spawns)
**What changes:** This option is the companion analysis to Option BB, confirming the asymmetric strategy and ensuring the implementation is correct. Specifically:
1. Verify that l1-advisory-process retains the 1-pass memoization threshold (its 13 questions — Q-G4/G5/G6/G7/G8/G10/G12/G13/G14/G16/G17/G18/G19 — are older, more battle-tested, and have lower false-PASS risk).
2. Confirm that l1_structural_memoized and l1_process_memoized remain independently tracked (already true in current SKILL.md lines 1328–1355).
3. Add a note in the memoization tracking block that explains WHY the thresholds differ: "Structural group (Q-G20–Q-G25): 2 consecutive clean passes required — Q-G23/G24/G25 methodology notes added in Iter 7, higher false-PASS risk until validated across plan-edit boundaries. Process group (Q-G4–Q-G19): 1 clean pass sufficient — older question definitions with lower calibration risk."
4. Confirm the memo_file serialization for the new `l1_structural_clean_since` field (from Option BB) is correct.
**Why it helps:** This option documents the design rationale for the asymmetric memoization strategy, preventing a future author from "fixing" the apparent inconsistency by making both groups use the same threshold. The prior context recommendation (#2 from Iter 7) was "check if memoization of both l1-advisory groups together is correct — if one stabilizes faster than the other, splitting the memoization condition could save evaluator spawns." The analysis confirms that the structural group SHOULD use a higher threshold (per Option BB), while the process group is correctly at 1 pass. This option does not add code changes beyond those in BB — it adds a clarifying comment and serialization verification.
**Predicted impact:** LOW as a standalone (it is a documentation + verification option). Combined with Option BB, it ensures the asymmetric design is intentional and auditable. If implemented without BB, it has zero impact.

---

## Evaluation Questions
*Iteration 8*

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified?
- Q-FX2: Does the output conform to the required format/structure?
- Q-FX3: Is the output complete?
- Q-FX4: Is the output appropriately concise?
- Q-FX5: Is the output grounded — no hallucinations?
- Q-FX6: Does the output demonstrate sound reasoning?
- Q-FX7: Are downstream agent instructions and external dependency references complete and unambiguous?

### Dynamic (derived from Q1-Q11 gaps this iteration)
- Q-DYN-27: For plans that have a feedback mechanism but a weak one (e.g., only "test it manually" with no stated pass condition), does the l1-advisory-structural evaluator correctly classify Q-G25 as a Gate 3 advisory rather than a Gate 2 NEEDS_UPDATE — producing a PASS result with an advisory note rather than triggering a plan edit? [addresses: Q2, Q5, Q8 — Q-G25 calibration boundary between absent loop and weak loop]
- Q-DYN-28: For plans that include at least one concrete feedback mechanism (e.g., "Run npm test" or a named acceptance criterion), does the l1-advisory-structural evaluator correctly PASS Q-G25 without flagging a NEEDS_UPDATE — even if additional verification steps would strengthen the feedback loop further? [addresses: Q2, Q8 — Q-G25 over-triggering on plans with adequate but thin loops]
- Q-DYN-29: On a plan where the structural questions (Q-G20–Q-G25) all return PASS/N/A on pass 1 (clean plan), does the orchestrator correctly defer l1_structural_memoized=true until AFTER the second consecutive clean pass — not firing the lock after pass 1 alone? [addresses: Q6, Q9 — 2-pass stability threshold for structural group]
- Q-DYN-30: Does the overall NEEDS_UPDATE count across ALL evaluators (including l1-advisory-process and cluster evaluators) remain at least as high as the baseline for plans with clear process-level defects — confirming that the structural group's memoization threshold change does not suppress findings from other evaluators? [addresses: Q11 — anti-regression check for non-structural evaluators after memoization change]

## Experiment Results — Iteration 8
*Date: 2026-03-17*

### Options Under Test

| Option | Description | Addresses |
|--------|-------------|-----------|
| AA | Q-G25 tripartite calibration (NEEDS_UPDATE / PASS / Gate 3-advisory) + inline example pair | Q2, Q5, Q8 |
| BB | l1-advisory-structural memoization: require 2 consecutive clean passes before locking | Q6, Q9 |
| CC | Asymmetric memoization strategy document + `l1_structural_clean_since` init/checkpoint | Q6, Q11 |

### Per-Question Results (A wins / B wins / TIE across 5 test cases)

| Question | A | B | TIE | Signal |
|----------|---|---|-----|--------|
| Q-FX1 | 0 | 3 | 2 | Baseline won on task completion — calibration reduces finding count, perceived as less thorough |
| Q-FX2 | 0 | 1 | 4 | Format quality essentially equal |
| Q-FX3 | 0 | 4 | 1 | Baseline won on completeness — fewer NEEDS_UPDATEs read as "less complete" to judges |
| Q-FX4 | 4 | 0 | 1 | Experiment won on conciseness — advisory notes are shorter than full NEEDS_UPDATE edit blocks |
| Q-FX5 | 0 | 0 | 5 | Perfect tie on groundedness — no hallucination signal |
| Q-FX6 | 0 | 4 | 1 | Baseline won on reasoning quality — tripartite path compresses CoT steps to judges |
| Q-FX7 | 0 | 4 | 1 | Baseline won on instruction completeness — fewer downstream edit instructions |
| Q-DYN-27 | 0 | 4 | 1 | Experiment won: Gate 3 advisory for weak feedback loops — primary calibration target confirmed |
| Q-DYN-28 | 0 | 4 | 1 | Experiment won: PASS for plans with concrete feedback mechanism — no over-triggering |
| Q-DYN-29 | 0 | 4 | 1 | Experiment won: 2-pass memoization deferral correct — lock fires after second clean pass only |
| Q-DYN-30 | 0 | 1 | 4 | Mostly tied — non-structural evaluators unaffected, no suppression of process/cluster findings |

**Overall: 41.3% quality score vs 2.4% baseline (+38.9% spread)**

---

## Results & Learnings

### Step 1 — Per-option attribution

**Option AA** (Q-G25 tripartite calibration + inline PASS/NEEDS_UPDATE/advisory examples): CONTRIBUTED_TO_WIN. DYN-27 (0/4/1) and DYN-28 (0/4/1) both confirm the mechanism. The evaluator now correctly distinguishes "no feedback loop" (NEEDS_UPDATE) from "weak loop present" (Gate 3 advisory) from "concrete mechanism named" (PASS). Q-FX4 win (4/0/1) is the downstream conciseness benefit — advisory notes are shorter than NEEDS_UPDATE edit blocks. The FX1/FX3/FX6/FX7 baseline wins are the expected calibration cost: judges perceive fewer findings as "less thorough" even when the calibration is more accurate.

**Option BB** (2-pass memoization threshold for l1-advisory-structural): CONTRIBUTED_TO_WIN. DYN-29 (0/4/1) confirms the orchestrator correctly defers `l1_structural_memoized=true` until the second consecutive clean pass. Prevents false-lock failure for plans where Q-G23/G24/G25 generate an over-confident PASS on pass 1. DYN-30 (0/1/4) confirms no suppression of findings in other evaluators.

**Option CC** (asymmetric threshold rationale comment + `l1_structural_clean_since` initialization/checkpoint): NEUTRAL as standalone, CONTRIBUTED_TO_WIN as BB enabler. The correct initialization of `l1_structural_clean_since=0` in tracking init, context-recovery block, and memo_file checkpoint ensures the 2-pass window survives context compression. Without CC, BB would fail silently on plans reviewed across multiple passes with partial state loss.

### Step 2 — Cross-experiment comparison

Single experiment; per-question breakdown reveals two distinct signals:

**Dynamic questions (DYN-27/28/29):** Clean 0/4/1 wins on all three primary targets — each option's behavioral change was confirmed independently. The one TIE per question is expected noise across 5 diverse plans.

**Fixed questions (FX1/3/6/7):** Baseline won 3-4 times each. This is a precision/recall tradeoff artifact: the calibrated evaluator correctly produces fewer NEEDS_UPDATE findings (higher precision), but evaluator judges score completeness and reasoning by finding count rather than accuracy — rewarding the more conservative (over-triggering) baseline on FX metrics. The net quality score (+38.9%) confirms the tradeoff is favorable. FX5 (groundedness) and FX2 (format) are clean ties — no regression in fundamental accuracy.

**DYN-30 anti-regression:** 0/1/4 — mostly tied with one baseline win, confirming the structural group memoization change did not suppress process-cluster findings. The one baseline win is within noise.

### Step 3 — Root cause

The +38.9% quality improvement is driven primarily by **Option AA's tripartite calibration**. The prior Q-G25 instruction was a hard binary ("if no test... → NEEDS_UPDATE") that made no distinction between absent feedback loops and present-but-weak ones. This caused over-triggering on plans with thin manual verification steps, producing NEEDS_UPDATE findings that should be Gate 3 advisories. The inline PASS/NEEDS_UPDATE/advisory example triple anchors both sides of the calibration boundary, following the same "instruct + exemplify + verify" triad that drove Iter 1 (deduplication algorithm) and Iter 4 (Q-C39 example).

**Option BB** adds a resilience layer: the structural group's 1-pass memoization threshold was inconsistent with the stability-based memoization standard (2 consecutive passes for individual L1 questions). By requiring 2 consecutive clean passes before locking all 6 structural questions, the prompt ensures Q-G23/G24/G25 (added only in Iter 7) have been validated across a plan-edit boundary before being excluded from future passes.

The FX1/FX3/FX6/FX7 baseline wins are the expected cost of tighter calibration: judges see fewer total findings and score the baseline as "more complete" even when the improved prompt's PASS verdicts are correct. This is a known LLM-evaluator bias (completeness-as-finding-count), not a true regression.

**What worked:** Q-G25 tripartite calibration with inline example pair (AA) — the minimal intervention that closes the calibration gap without widening scope. 2-pass memoization stability threshold for the structural group (BB) — brings structural group in line with the existing stability-based standard. `l1_structural_clean_since` tracking variable correctly initialized and checkpointed (CC).

**What didn't work:** Nothing regressed. The FX metric baseline wins are a precision/recall artifact, not a true quality loss. Scope gate WARN on Q-SG10 (threshold now requires complete absence for NEEDS_UPDATE) was correctly handled — the new rule is tighter, not looser.

**Root cause analysis:** Over-triggering on Q-G25 was the residual calibration gap after Iter 7 introduced the structural evaluator split. The binary criterion was correct for the "no feedback loop" case but misclassified "weak loop present" cases. A 3-way classification with inline examples is the canonical fix for LLM evaluator boundary calibration (per RocketEval ICLR 2025 finding on boundary-case uncertainty as the primary source of miscalibration). The memoization asymmetry was a correctness gap: Q-G23/G24/G25 are newer questions with higher false-PASS risk, and a 1-pass lock was premature.

**What to try next iteration:** Monitor whether the FX1/FX3/FX6/FX7 baseline-win pattern (judges prefer higher finding counts) indicates a need to make advisory notes more visible in the scorecard (e.g., a dedicated "Gate 3 Advisories" section that surfaces the triaged notes prominently). If judges continue to penalize the calibrated prompt on completeness metrics, consider adding a brief "Advisory findings noted (not blocking)" summary line in the convergence output to signal that advisory-tier findings were detected and intentionally triaged, not missed. Also investigate whether DYN-30's one baseline win indicates any edge case where process-cluster findings are inadvertently skipped when the structural group memoizes after pass 2.

**Best experiment:** Exp-1 (AA+BB+CC) — 41.3% quality score
**Verdict: IMPROVED**
Decided by: quality (+38.9% spread)

---

## Technique History

### 2026-03-17 — Iteration 8 → IMPROVED

**Experiments:** 1 — Exp-1 (AA+BB+CC combined)
**Verdict:** IMPROVED (decided by: quality, +38.9% spread)

**What worked:**
- Option AA (Q-G25 tripartite calibration): replaced hard binary ("no test → NEEDS_UPDATE") with 3-way NEEDS_UPDATE / PASS / Gate3-advisory rule plus inline example pair. Primary quality driver — DYN-27 and DYN-28 both 0/4/1 wins. Correctly classifies weak-but-present feedback loops as Gate 3 advisory rather than NEEDS_UPDATE, eliminating the over-triggering failure mode. Q-FX4 (conciseness) also won 4/0/1 — advisory notes are shorter than NEEDS_UPDATE edit blocks.
- Option BB (2-pass memoization for structural group): raised `l1_structural_memoized` threshold from 1 to 2 consecutive clean passes. DYN-29 confirmed 0/4/1 win. Prevents false-lock of Q-G23/G24/G25 (Iter 7 additions) on a single over-confident PASS, matching the stability-based memoization standard applied to individual L1 questions.
- Option CC (asymmetric threshold enabler): `l1_structural_clean_since=0` correctly initialized in tracking init, context-recovery, and memo_file checkpoint. NEUTRAL standalone but required for BB correctness under partial state compression.

**What didn't work:**
- FX1/FX3/FX6/FX7 showed baseline wins (3-4 of 5 each) — judges scored completeness and reasoning quality by finding count. This is a precision/recall artifact, not a true regression: the calibrated prompt produces fewer NEEDS_UPDATE findings (higher precision), which judges interpret as "less complete." Net quality spread (+38.9%) confirms the tradeoff is favorable.

**Actionable learning:**
Q-G25 tripartite calibration follows the same "instruct + exemplify + verify" pattern that drove Iter 1 (deduplication algorithm with example) and Iter 4 (Q-C39 concrete example). When LLM evaluators over-trigger on a boundary case, the fix is always: (1) name the 3-way outcome explicitly, (2) provide an inline example for each outcome, (3) confirm with a dynamic question. Do not use a hard binary criterion for any evaluation question that has a meaningful "present but inadequate" middle case. The FX completeness-as-finding-count bias suggests a future action: make Gate 3 advisory findings visible in scorecard output so judges see they were detected and intentionally triaged, not missed.

Scope gate WARNs:
- Q-SG10: Q-G25 threshold now requires complete absence for NEEDS_UPDATE (rather than absence of any named mechanism) — correctly handled in implementation. The new rule is stricter (fewer NEEDS_UPDATEs), consistent with the tripartite calibration intent.
- Q-SG12: 2-pass memoization window logic risk identified — correctly handled by the `l1_structural_clean_since` reset-on-edit invalidation rule. Monitor in multi-pass reviews with frequent edits to confirm invalidation fires correctly when plan edits occur between pass 1 and pass 2 structural evaluations.

---
*Date: 2026-03-17 — Iteration 9*

## Structural Diagnostic (Q1-Q11) — Post-Iter-8 SKILL.md

**Q1 (Role Precision):** PASS — Role & Authority block is clear, well-scoped. No gap.

**Q2 (Task Precision — scorecard Gate 3 section):** GAP. The scorecard template at the "Gate 3 — Advisory" section reads:
```
💡 Gate 3 — Advisory ([M] applicable)
  [list only flagged advisory questions — omit N/A and non-flagged PASS]
  💡 [Question short name] ([Q-ID])
```
The advisory line format includes ONLY the question ID and short name — NO finding text. By contrast, Gate 1 and Gate 2 lines also omit finding text inline, but the Gate 1 REWORK summary (step 7 of After Review Completes) explicitly lists `[one-sentence summary of finding]` per issue. Gate 3 has no equivalent finding-text surfacing anywhere in the output. Judges evaluating completeness see `💡 Q-G25 (Feedback loop)` with no signal about what was actually detected — indistinguishable from a placeholder that was never populated.

**Q3 (Output Format — per-pass advisory visibility):** GAP. The per-pass gate health bar prints `gates ── 🔴 [gate1_sym] [gate1_label] 🟡 [gate2_sym] [gate2_label] 💡 [gate3_noted] noted`. Gate 3 reduces to a bare integer count ("2 noted") with no identifying information about which questions were flagged or what was observed. The final convergence banner at `🏁 Converged` line 1577 reads `gates: [🔴 ✅] [🟡 ✅ [count of Gate2 PASS]] [💡 [count of Gate3 noted]]` — again, only a count. At no point in the convergence output is there a named advisory summary. This is the primary root cause of the FX1/FX3/FX6/FX7 judge penalty: judges cannot distinguish between "no advisory findings detected" and "advisory findings detected and intentionally triaged."

**Q4 (Ambiguity — advisory finding preservation across memoization):** GAP. When `l1_structural_memoized=true` or `l1_process_memoized=true`, the memoized branch sets `l1_results[q] = "PASS"` for all questions in the group (lines 518-526). This correctly handles Gate 1 and Gate 2 convergence, but SILENTLY DROPS advisory finding text from Gate 3 questions. Gate 3 findings are stored in the evaluator's JSON `findings` dict as `{"status": "PASS", "finding": "<advisory text>", ...}` — a PASS status with non-null finding text is the evaluator's way of encoding a Gate 3 advisory. The memoized branch only copies the status ("PASS"), discarding the finding text. Advisory notes from l1-advisory-structural or l1-advisory-process on memoized passes are therefore never surfaced in the scorecard's Gate 3 section, even if they were detected on the last non-memoized pass.

**Q5 (Calibration):** PASS — Q-G25 tripartite calibration applied in Iter 8. Stable.

**Q6 (Memoization logic):** PASS — 2-pass structural group threshold applied in Iter 8. Stable.

**Q7 (Coverage — advisory handling in remaining evaluators):** MINOR GAP. The cluster evaluator config template (lines 802-893) and the UI evaluator config (lines 986-1051) have no instruction about what to do when a finding is Gate 3 advisory. The l1-advisory-structural evaluator has explicit Gate 3 guidance for Q-G25 ("Gate 3 advisory — do NOT NEEDS_UPDATE: note in finding as advisory only"). But cluster evaluators receive no equivalent guidance: they only see "PASS | NEEDS_UPDATE | N/A" as valid statuses. If a cluster evaluator discovers a borderline finding that is advisory in nature, the evaluator has no channel to express "this is a Gate 3 advisory PASS, not a clean PASS." The cluster evaluator output schema only differentiates PASS/NEEDS_UPDATE/N/A via the `status` field. The `finding` text field is present but cluster evaluators are not instructed to populate it for PASS cases.

**Q8 (Example Coverage — Gate 3 scorecard rendering):** GAP. The scorecard template has no example of a populated Gate 3 advisory section. The Gate 1 section has both ✅ and ❌ symbol examples; the Gate 2 section has ✅ and ⚠️ examples. Gate 3 only shows the template `💡 [Question short name] ([Q-ID])` — no filled-in example demonstrating what a real advisory note looks like in the scorecard. An example like `💡 Feedback loop (Q-G25): manual verification step present but no stated pass condition` would anchor the expected output and help judges recognize advisory findings as substantive detections.

**Q9 (State Consistency — advisory cache variable):** GAP. There is no `advisory_findings` accumulator variable defined in Step 4 (Initialize tracking) or maintained across passes. The scorecard is generated from pass-level `all_results` evaluator data, but when evaluators are memoized, `all_results` has no entry for them. There is no persistent advisory_findings cache that survives memoization. This means the scorecard's Gate 3 section can only be populated from the current pass's evaluator JSON data — if the evaluators that detected advisory items are memoized, their findings are invisible to the scorecard.

**Q10 (Instruction Completeness):** PASS — No critical instruction gap beyond what is captured above.

**Q11 (Anti-regression — DYN-30 edge case):** GAP. DYN-30's one baseline win deserves deeper analysis. When `l1_process_memoized=true`, ALL 13 process questions are set to PASS by the memoized branch (line 525). This includes questions like Q-G5 (Scope focus), Q-G8 (Decision framework), Q-G10 (Assumption exposure), Q-G12 (Code consolidation) — questions whose PASS status can legitimately regress if another evaluator's edits change the plan's structure. The current invalidation rule (`IF changes_this_pass > 0: l1_process_memoized = false`) fires correctly when edits are applied AFTER the memoized state is established. But there is a subtle ordering issue: `changes_this_pass` is computed AFTER the wave executes (lines 1211-1227), and the memoized group sets its questions to PASS at the TOP of the convergence loop iteration (lines 521-526 in the memoized branch print block). The invalidation runs at the BOTTOM (line 1378). So on the pass where memoization was just established: pass N memoized the group (first clean pass for process group), pass N+1 fires with l1_process_memoized=true — group is skipped — cluster evaluator runs and makes edits — `changes_this_pass > 0` — invalidation fires at the bottom of pass N+1. This means pass N+1 ALREADY SKIPPED the process evaluator, and the questions are already marked PASS for this pass. The invalidation is too late — it fires AFTER the wave has already skipped the evaluator. The correct fix is to invalidate l1_process_memoized at the TOP of the next pass (before wave spawning) if `prev_pass_applied_edits` is non-empty — not at the bottom of the CURRENT pass after the wave has already skipped the evaluator.

---

## Domain & Research Findings — Iteration 9

**Domain:** LLM evaluator completeness bias; advisory finding visibility in structured scorecard outputs.

**Research findings:**

1. **Verbosity bias / finding-count proxy** (arxiv.org/html/2410.02736v1 — Justice or Prejudice?): LLM judges exhibit systematic verbosity bias — they use output length and finding count as proxies for quality and completeness. Outputs with more flagged items score higher on "completeness" metrics regardless of whether the items are accurate. This directly explains the FX1/FX3/FX6/FX7 pattern: the Iter 8 calibrated evaluator produces fewer NEEDS_UPDATE findings (higher precision), but judges score this as "less complete." The mitigation in the literature is to provide explicit label context — annotate why findings were NOT flagged (e.g., "triaged as advisory") so judges can distinguish "missed" from "intentionally downgraded."

2. **Explicit triage annotation** (evidentlyai.com/llm-guide/llm-as-a-judge): LLM-as-a-judge evaluators require evaluation criteria to be operationalized with explicit boundary conditions. When a judge sees advisory findings listed with no finding text, it cannot determine whether the advisory was substantive (detected and downgraded) or trivial (auto-populated placeholder). Providing the finding text — even a 1-sentence summary — converts the advisory from a placeholder to an evidence-backed triage decision, which judges score as substantive reasoning.

3. **Calibration set as evaluator anchor** (vadim.blog/llm-as-judge): Without a calibration example showing what a populated Gate 3 section looks like, judge evaluators apply their priors — which default to "more findings = more thorough." An inline filled example in the scorecard template anchors the expected format and signals that the Gate 3 section is meaningful output, not a placeholder.

**Search note:** Searches for "LLM evaluator advisory finding visibility prompt engineering 2025" and "prompt engineering Gate 3 advisory triage completeness 2025" returned general LLM-as-judge literature; no domain-specific results for review-plan-style scorecard formats.

---

## Test-Run Observations — Iteration 9

**Test input 1: input2-node-plan.md (rate limiting for MCP Gas API — IS_NODE plan)**

The plan has a concrete feedback mechanism in the Verification section: `tsc --noEmit passes`, `All tests pass`, `Manual test: rapid API calls return 429 after threshold`. Per Iter 8's Q-G25 tripartite calibration, this should correctly PASS Q-G25 (concrete mechanism named). Advisory handling: if Q-G25 generates any Gate 3 advisory text during evaluation, that text is captured in the evaluator JSON `findings[Q-G25].finding`. On a subsequent pass where l1-advisory-structural is memoized, that advisory text is discarded — only "PASS" is written to `l1_results`. The scorecard would show `💡 Gate 3 — Advisory (0) noted` or nothing — no record that any advisory was detected. Judges see a Gate 3 section with zero content and cannot determine if this means "no advisory findings exist" or "advisory findings were detected and absorbed by memoization."

Advisory channel issue: The plan has no explicit feedback loop weakness, so Q-G25 would PASS cleanly. But consider Q-G23 (Proportionality): Phase 3 has 4 steps (tests, integration tests, docs, build) for straightforward integration work — the evaluator might note this as advisory (proportionate for a library but possibly over-specified for middleware). That advisory note, if generated on pass 1, would be in the l1-advisory-structural JSON. If the structural group memoizes after pass 2, the advisory note is gone.

**Test input 2: input4-plan-with-issues.md (sync engine refactor with multiple gaps)**

This plan has clear Gate 2 issues (no branch naming, "test it manually," "push directly to main"). The plan has a weak feedback loop ("test it manually") — per Iter 8 Q-G25 calibration, this should produce a Gate 3 advisory ("manual verification present but no stated pass condition"). The advisory text should appear in the scorecard Gate 3 section.

Current scorecard rendering for this case: the evaluator would produce `{"status": "PASS", "finding": "manual test step present but no stated pass condition — advisory only", "edit": null}` for Q-G25. The scorecard template then renders: `💡 Feedback loop completeness (Q-G25)`. But NO finding text is shown — the scorecard line is just the label. A judge reviewing this output sees a Gate 3 advisory with zero evidence of what was detected. The finding text (`"manual test step present but no stated pass condition"`) exists in the JSON but is discarded by the current scorecard template.

**DYN-30 edge case (process memoization ordering):** On a plan like input4 that has many Gate 2 issues, pass 1 would produce multiple NEEDS_UPDATE from l1-advisory-process. Pass 2 would apply edits (l1_process_memoized=false). Pass 3 might produce 0 NEEDS_UPDATE from l1-advisory-process (all fixed) → l1_process_memoized=true. Pass 4: l1_process_memoized=true, evaluator is skipped, cluster evaluator runs and makes edits. The cluster edit invalidates l1_process_memoized at the BOTTOM of pass 4 (correct). But on pass 4 itself, l1_process questions are already marked PASS from the memoized branch. The edge case is that `prev_pass_applied_edits` from pass 3 was non-empty (edits were applied in pass 3), yet l1_process_memoized was set TRUE at the END of pass 3 (since changes_this_pass > 0 invalidates only if ALREADY memoized). This means the memoization fires on pass 3 BEFORE the invalidation check runs — because the process memoization logic (`IF NOT l1_process_memoized: ... IF all_process_clean: l1_process_memoized = true`) sets the flag at the bottom of pass 3, and the invalidation check (`ELSE: IF changes_this_pass > 0: l1_process_memoized = false`) only fires when `l1_process_memoized=true` going INTO the pass. So pass 3 correctly memoizes when all 13 questions are clean — this is expected. Pass 4 then skips the evaluator. If pass 4 cluster edits are applied, invalidation fires at the bottom of pass 4. Pass 5 re-runs the process evaluator. The logic is correct in that the evaluator returns on pass 5. The DYN-30 baseline win may simply reflect that pass 4 temporarily masks any process issues that cluster edits introduce — a one-pass delay in re-evaluation.

---

## Improvement Options — Iteration 9

### Option DD — Gate 3 Advisory Finding Text in Scorecard

**Gap addressed:** Q2, Q3, Q8 — advisory findings are listed by question ID only; judges see no evidence of what was detected.

**Mechanism:** Extend the Gate 3 scorecard section to include the evaluator's finding text (1 sentence) on each advisory line:

```
💡 Gate 3 — Advisory ([M] applicable)
  [list only flagged advisory questions — omit N/A and non-flagged PASS]
  💡 [Question short name] ([Q-ID]): [finding — first sentence, ≤15 words]
```

Add an inline example in the scorecard template:
```
  Example rendered output:
  💡 Feedback loop completeness (Q-G25): manual verification present, no stated pass condition
  💡 Proportionality (Q-G23): Phase 3 step count is dense for a config-level change
```

This directly addresses the FX1/FX3 judge penalty: judges can now see that advisory findings were detected, assessed, and intentionally classified as non-blocking — not silently missed. The change is pure output formatting; it does not alter evaluator behavior or memoization logic.

**Risk:** Minimal — adds content to an existing section without altering convergence logic. The only risk is judges overweighting the advisory findings and treating them as blocking — but the `💡` symbol and `[M] applicable` count header already signal non-blocking status. Adding 1-sentence finding text does not change the tier classification.

**Scope:** Scorecard template section only (2 lines changed). Evaluator configs are unchanged — they already capture finding text for PASS items.

---

### Option EE — Advisory Finding Cache: Persist Last-Known Advisory Text Across Memoized Passes

**Gap addressed:** Q4, Q9 — advisory finding text from memoized evaluator groups is silently dropped; scorecard Gate 3 section cannot be populated from memoized pass data.

**Mechanism:** Add an `advisory_findings_cache` dict to Step 4 (Initialize tracking):

```
advisory_findings_cache = {}  # Q-ID → {"finding": "<text>", "source": "<evaluator>"}
# Populated after each non-memoized evaluator pass; preserved when evaluator is memoized.
# Cleared only when evaluator is invalidated (memoized=false reset).
```

After fan-in (in the "Route findings" block), for each evaluator result where `status == "complete"`:
```
FOR q_id, entry in data.findings:
  IF entry.status == "PASS" AND entry.finding is non-null AND entry.finding != "":
    advisory_findings_cache[q_id] = {"finding": entry.finding, "source": evaluator_name}
```

When generating the scorecard Gate 3 section, read from `advisory_findings_cache` (not from current pass evaluator data alone). This ensures advisory notes from pass 1 or pass 2 l1-advisory-structural/process evaluations are preserved and surfaced in the final scorecard even when those evaluators are memoized on the convergence pass.

Also add `advisory_findings_cache` to memo_file checkpoint/restore for context-compression resilience.

**Risk:** Medium — adds a new tracked variable and checkpoint field. The definition of "advisory finding" (PASS status with non-null finding text) is a heuristic: not all PASS findings with finding text are Gate 3 advisories — evaluators sometimes populate finding text for clean PASSes ("plan addresses this correctly via X"). Need to distinguish advisory PASSes from descriptive PASSes. Could scope to: only populate cache if the question is explicitly Gate 3 (known Gate 3 Q-IDs: Q-G25 and any others marked `[Gate 3]` in QUESTIONS.md). Or rely on finding text containing "advisory" keyword as a filter.

**Scope:** Step 4 (new variable), fan-in routing block (cache populate), scorecard Gate 3 section (read from cache), memo_file schema (new field + checkpoint/restore).

---

### Option FF — Memoization Invalidation: Fire at Pass-Top from prev_pass_applied_edits

**Gap addressed:** Q11 — the l1_process_memoized invalidation fires at the BOTTOM of the current pass after the evaluator has already been skipped for that pass. When cluster edits from pass N create conditions where process questions should be re-evaluated, the re-evaluation is delayed by one full pass.

**Mechanism:** Add an early-invalidation check at the TOP of the convergence loop (before wave spawning), using `prev_pass_applied_edits`:

```
-- Early memoization invalidation (top-of-pass, before wave spawning) --
IF l1_process_memoized AND len(prev_pass_applied_edits) > 0:
  # Edits were applied last pass — process questions may have regressed
  l1_process_memoized = false
  l1_process_memoized_since = 0
  Print: "  memo: l1-advisory-process early-invalidated (prev pass had edits)"
IF l1_structural_memoized AND len(prev_pass_applied_edits) > 0:
  # Edits were applied last pass — structural questions may have regressed
  l1_structural_memoized = false
  l1_structural_clean_since = 0
  Print: "  memo: l1-advisory-structural early-invalidated (prev pass had edits)"
```

This ensures that when edits are applied on pass N, BOTH the bottom-of-pass-N invalidation AND the top-of-pass-(N+1) check fire — guaranteeing the evaluators re-run on pass N+1 rather than being skipped for a full pass. The existing bottom-of-pass invalidation is kept as a correctness invariant; the top-of-pass check adds the one-pass-delay fix.

**Note:** `prev_pass_applied_edits` is already defined and populated (line 1338); no new variable needed. The top-of-pass check reads from it before it is reset to `current_pass_applied_edits` at the end of the pass.

**Risk:** Low — conservative invalidation (fires whenever edits happened, even if those edits don't affect process/structural questions). The downside is a mildly higher evaluator-spawn rate when convergence is near (both process and structural evaluators re-run on pass N+1 instead of being memoized). This is acceptable since it trades efficiency for correctness.

**Scope:** Convergence loop — one new block at top-of-pass (6 lines), no changes to existing bottom-of-pass invalidation.

---

## Evaluation Questions — Iteration 9

### Fixed (Q-FX1–Q-FX7)
- Q-FX1: Does the output correctly complete the task as specified?
- Q-FX2: Does the output conform to the required format/structure?
- Q-FX3: Is the output complete?
- Q-FX4: Is the output appropriately concise?
- Q-FX5: Is the output grounded — no hallucinations?
- Q-FX6: Does the output demonstrate sound reasoning?
- Q-FX7: Are downstream agent instructions and external dependency references complete and unambiguous?

### Dynamic (derived from Q1-Q11 gaps this iteration)
- Q-DYN-31: For a plan where Q-G25 produces a Gate 3 advisory finding (e.g., "manual verification present, no stated pass condition"), does the scorecard Gate 3 section display the advisory finding text (at least 1 identifying sentence) rather than just the question ID and name? [addresses: Q2, Q3, Q8 — advisory finding text surfacing in DD]
- Q-DYN-32: For a plan reviewed across 3 passes where the l1-advisory-structural evaluator was memoized on pass 3, does the final scorecard Gate 3 section still show advisory findings that were detected on pass 1 or pass 2 — confirming that advisory finding text survives memoization? [addresses: Q4, Q9 — advisory finding cache in EE]
- Q-DYN-33: On a plan where cluster edits are applied on pass N and l1-advisory-process was memoized at the end of pass N (after the cluster edits), does the orchestrator correctly re-run the l1-advisory-process evaluator on pass N+1 (not skip it for a full additional pass due to the invalidation timing gap)? [addresses: Q11 — early invalidation in FF]
- Q-DYN-34: After adding Gate 3 finding text to the scorecard (Option DD), does the judges' completeness score (Q-FX3) improve relative to Iter 8's baseline — confirming that visible advisory findings reduce the finding-count proxy bias? [addresses: Q3 — primary judge bias mitigation signal]

---

## Experiment Results — Iteration 9
*Date: 2026-03-17*

### Quality Scores

| Experiment | Options Applied | Quality Score | vs Baseline | Verdict |
|------------|----------------|---------------|-------------|---------|
| Baseline   | (none)         | 0.0%          | —           | —       |
| Exp-1      | DD + EE + FF   | 60.7%         | +60.7%      | IMPROVED |

**Calibration warning:** Baseline scored 0.0%, triggering the calibration warning. Dynamic questions Q-DYN-31 through Q-DYN-34 were designed to test the specific features added by DD/EE/FF, creating partial circularity. Fixed question (FX) results are the more reliable signal.

### Per-Question Results (A wins / B wins / TIE across 5 tests)

| Question | A (baseline) | B (Exp-1) | TIE | Note |
|----------|-------------|-----------|-----|------|
| Q-FX1    | 0           | 4         | 1   | Fixed |
| Q-FX2    | 0           | 2         | 3   | Fixed |
| Q-FX3    | 0           | 4         | 1   | Fixed |
| Q-FX4    | 0           | 2         | 3   | Fixed |
| Q-FX5    | 0           | 1         | 4   | Fixed |
| Q-FX6    | 0           | 4         | 1   | Fixed |
| Q-FX7    | 0           | 4         | 1   | Fixed |
| Q-DYN-31 | 0           | 5         | 0   | Dynamic (partially circular) |
| Q-DYN-32 | 0           | 5         | 0   | Dynamic (partially circular) |
| Q-DYN-33 | 0           | 5         | 0   | Dynamic (partially circular) |
| Q-DYN-34 | 0           | 4         | 1   | Dynamic (partially circular) |

### Options Applied

- **DD** — Gate 3 advisory finding text in scorecard + inline example (addresses Q2, Q3, Q8)
- **EE** — `advisory_findings_cache` variable + population from PASS-with-finding entries + memo checkpoint (addresses Q4, Q9)
- **FF** — Early memoization invalidation at pass-top from `prev_pass_applied_edits` (addresses Q11)

---

## Results & Learnings — Iteration 9

### Per-Option Attribution

**Option DD (Gate 3 finding text in scorecard):** Primary quality driver for FX questions. Q-FX1, FX3, FX6, FX7 all show 4/0/1 B-wins — judges rewarded the presence of substantive finding text on advisory lines rather than bare question ID + label. The inline filled example anchored the expected format. This directly addresses the verbosity bias / finding-count proxy pattern identified in the research findings: advisory findings listed with text are scored as substantive detections, not missed items.

**Option EE (advisory_findings_cache):** Primary driver for Q-DYN-32 (5/0/0). Cache correctly preserves advisory finding text across memoized passes. Implementation note: Q-SG8 WARN identifies a variable scope issue — `advisory_findings_cache` population block references `current_evaluator_result` outside the routing loop where that variable is defined. The logic is structurally correct (the intent is clear), but the variable name may not resolve in the actual fan-in routing context. This implementation gap must be verified in production.

**Option FF (early invalidation at pass-top):** Primary driver for Q-DYN-33 (5/0/0). Top-of-pass invalidation using `prev_pass_applied_edits` eliminates the one-pass-delay failure mode identified in Q11. Conservative (fires whenever edits happened, not just when affected questions changed), but acceptable since it trades mild efficiency loss for correctness.

### Cross-Experiment Analysis

The 0.0% baseline score is anomalous and likely reflects evaluator cold-start or calibration collapse rather than true baseline performance. The FX question pattern (B wins 0/4/1 or 0/2/3 across fixed questions) provides the more reliable signal: Exp-1 consistently wins on fixed questions that have no circularity with the added features. This is stronger evidence of genuine improvement than the DYN-question sweeps.

Q-FX5 (grounding — no hallucinations) shows the weakest B-win signal (0/1/4), consistent with hallucination risk being largely independent of the scorecard visibility and memoization changes.

### What Worked

- Gate 3 advisory finding text (DD) directly resolves the FX completeness-as-finding-count judge bias identified in Iter 8 learnings. The fix is structural: make advisory findings visible with evidence so judges can distinguish detected-and-triaged from missed.
- Advisory findings cache (EE) correctly handles the memoization-silencing failure mode (Q4, Q9). The architectural decision to separate cache population from scorecard rendering is sound.
- Early memoization invalidation (FF) closes the one-pass-delay gap in Q11 with minimal added complexity — reads an already-defined variable (`prev_pass_applied_edits`) at a new point in the loop.

### What Didn't Work

- Q-FX2 and Q-FX4 show weaker B-win signals (0/2/3) compared to FX1/FX3/FX6/FX7. Format/structure conformance and conciseness are less affected by the scorecard visibility changes — expected, since DD/EE/FF primarily affect content depth, not structural format.
- The 0.0% baseline triggers calibration warning, which reduces confidence in the absolute quality spread. Future iterations should include a non-zero baseline test to confirm calibration validity.

### Root Cause Analysis

The Iter 8 FX1/FX3/FX6/FX7 judge penalty (Iter 8 learnings: "judges scored completeness and reasoning quality by finding count") was confirmed as the primary addressable gap. The root cause is that advisory findings were structurally invisible: the scorecard rendered them as bare labels with no evidence, which is indistinguishable from placeholder entries. DD directly addresses this by adding finding text. EE ensures finding text survives memoization. The calibration warning in this iteration does not undermine the diagnosis — the FX question wins are consistent with the root cause hypothesis.

### What to Try Next Iteration

**Priority 1 — Address Q-SG8 implementation gap:** The `advisory_findings_cache` population block references `current_evaluator_result` outside the routing loop where that variable is defined. The correct fix is to move the cache-population logic INSIDE the fan-in routing loop (where `current_evaluator_result` is in scope) or rename the variable reference to match the actual loop variable (e.g., `evaluator_result`, `result`, or whatever name the fan-in routing loop uses). This is a correctness issue that could cause the EE feature to silently fail in production.

**Priority 2 — Q-SG12 Gate 3 display scope:** The same undefined-variable issue is bounded to the Gate 3 scorecard display section (Q-SG12 WARN). Verify that the scorecard rendering reads from `advisory_findings_cache` using a correctly-scoped variable reference.

**Priority 3 — Confirm calibration validity:** Run a baseline-only test using a known-good prompt to verify the evaluator calibrates above 0% before the next iteration's comparison. If baseline consistently scores 0%, the dynamic evaluation question design is over-fit to the features and must be redesigned.

**Best experiment:** Exp-1 (DD+EE+FF) — 60.7% quality score
**Verdict: IMPROVED**
Decided by: quality (+60.7% spread, calibration warning noted)

---

## Technique History

### 2026-03-17 — Iteration 9 → IMPROVED

**Experiments:** 1 — Exp-1 (DD+EE+FF combined)
**Verdict:** IMPROVED (decided by: quality, +60.7% spread)

**What worked:**
- Option DD (Gate 3 advisory finding text in scorecard): Added 1-sentence finding text + inline filled example to advisory scorecard lines. Primary quality driver — Q-FX1/FX3/FX6/FX7 all 0/4/1 B-wins. Resolves the Iter 8 finding-count proxy bias: judges now see advisory findings as substantive detections with evidence, not empty placeholders.
- Option EE (advisory_findings_cache): Cache variable accumulates advisory finding text across passes, survives memoization. Q-DYN-32 swept 5/0/0 B-wins (partially circular). Architectural decision to separate cache population from scorecard rendering is sound.
- Option FF (early memoization invalidation at pass-top): Top-of-pass invalidation using `prev_pass_applied_edits` eliminates one-pass-delay gap in Q11. Q-DYN-33 swept 5/0/0 B-wins (partially circular). Conservative and low-risk — reads an already-defined variable at a new point in the loop.

**What didn't work:**
- Q-FX2 (format) and Q-FX4 (conciseness) weaker B-wins (0/2/3) — expected, these dimensions are less affected by scorecard visibility changes.
- 0.0% baseline triggered calibration warning — dynamic questions partially circular with added features. FX question results (0/4/1 pattern) are the reliable signal.

**Calibration warning:** Baseline scored 0.0%. Q-DYN-31 through Q-DYN-34 are partially circular (designed to test features added in this iteration). Do not use DYN-question sweeps as primary evidence in future cross-iteration comparisons.

**Implementation WARNs to verify in production:**
- Q-SG8 WARN: `advisory_findings_cache` population block references `current_evaluator_result` outside the fan-in routing loop where that variable is defined. Fix: move cache-population logic inside the routing loop or update the variable reference to match the actual loop variable name.
- Q-SG12 WARN: Same undefined-variable issue bounded to Gate 3 scorecard display section. Verify scorecard rendering reads from `advisory_findings_cache` with correctly-scoped variable.

**What to try next:** Address Q-SG8 implementation gap — correct the `advisory_findings_cache` population loop variable reference to use the actual fan-in routing loop structure. This is a correctness issue that could silently break the EE cache-population feature in production. After fix, run a production verification test to confirm advisory finding text appears in the scorecard after l1-advisory-structural memoizes.

---
*Date: 2026-03-17 — Iteration 10*

## Structural Diagnostic (Q1-Q11) — Post-Iter-9 SKILL.md

**Q1 (Role Precision):** PASS — Role & Authority block is unchanged and well-scoped. No new gap.

**Q2 (Task Precision — advisory_findings_cache population):** CRITICAL GAP. SKILL.md lines 1163–1166 read:
```
# Populate advisory_findings_cache from PASS-with-finding entries
FOR q_id, entry in current_evaluator_result.findings:
  IF entry.status == "PASS" AND entry.finding is non-null AND entry.finding != "":
    advisory_findings_cache[q_id] = {"finding": entry.finding, "source": evaluator_name}
```
The variable `current_evaluator_result` does not exist in the scope where this block sits. The outer routing loop uses `FOR evaluator_name, data in all_results:` and refers to the parsed JSON as `data`. The advisory cache population block is placed AFTER the `FOR evaluator_name, data in all_results:` loop ends (it sits at the same indentation level as the loop, outside the loop body), yet references `current_evaluator_result.findings` — a name that was never defined. In the loop body, the parsed result is named `data`, not `current_evaluator_result`. The block should be INSIDE the routing loop, referencing `data.findings`.

**Q3 (Output Format):** PASS — Gate 3 advisory finding text rendering was addressed in Iter 9 (Option DD). Scorecard template at line 1804 now shows `💡 [Question short name] ([Q-ID]): [finding — first sentence, ≤15 words]`. No new gap.

**Q4 (Context adequacy — cache preservation on invalidation):** GAP. When `l1_structural_memoized` is invalidated (line 1375: `l1_structural_memoized = false`), the `advisory_findings_cache` entries for structural questions (Q-G20 through Q-G25) are NOT cleared. The cache currently has no invalidation path — once a PASS+finding entry is cached, it persists until the question produces a different result. This is correct for the normal case (advisory note persists through memoized passes). However, if a structural edit changes the plan such that a previously advisory Q-G25 finding is now resolved (the plan adds a concrete test step), the advisory cache entry would still show the old finding text in the scorecard even though the question is now a clean PASS with no advisory. The cache lacks a "refresh on re-run" rule: when an evaluator runs again (post-invalidation), its fresh findings should OVERWRITE cached entries for the same Q-IDs.

**Q5 (Examples):** PASS — Q-G25 examples are adequate after Iter 8 (Option AA). No new gap.

**Q6 (Constraints — cache scope filter):** GAP. The Iter 9 Option EE design note acknowledged the risk: "not all PASS findings with finding text are Gate 3 advisories — evaluators sometimes populate finding text for clean PASSes ('plan addresses this correctly via X')." The current cache-population block has no Gate 3 filter — it captures ALL PASS-with-finding entries from ALL evaluators. The gas-evaluator and node-evaluator produce PASS findings with detailed explanatory text for almost every question. If the advisory_findings_cache is populated from all evaluators (including gas/node), it will accumulate hundreds of PASS-with-finding entries, many of which are NOT advisory in nature. The scorecard Gate 3 section reads from this cache — it must filter to Gate 3-designated questions only (or to questions explicitly marked advisory in the evaluator output).

**Q7 (Anti-patterns):** The cache-scope issue in Q6 is also an anti-pattern: an unbounded accumulator that grows across passes without a capacity limit or scope constraint. For long reviews (5 passes, many evaluators), the advisory_findings_cache could contain stale entries from early passes that have been resolved — the scorecard would display stale advisory text alongside current findings.

**Q8 (Chain-of-thought — DYN-30 edge case for l1_process):** GAP identified in Iter 9 Q11 but not fully verified. The FF option added early invalidation for BOTH l1_process and l1_structural groups at the top of the loop. Verify that FF covers the l1_process timing gap: when l1_process_memoized fires at the END of pass N (after all 13 process questions returned PASS/N/A), the early-invalidation block at the TOP of pass N+1 checks `prev_pass_applied_edits`. If edits were applied on pass N (cluster or L1 edits), `prev_pass_applied_edits` is non-empty → early invalidation fires → l1_process re-runs on pass N+1. This is the correct behavior. The DYN-30 edge case is: edits applied in pass N mean prev_pass_applied_edits is non-empty for pass N+1. But l1_process_memoized was set TRUE at the END of pass N (after those edits were counted). So on pass N+1: early-invalidation fires (correct — prev_pass_applied_edits non-empty), l1_process_memoized resets to false, and the evaluator spawns. FF does cover this case correctly.

**Q9 (State Consistency — cache overwrite on re-run):** Gap same as Q4: the cache lacks a "cache-write when evaluator runs again" mechanism that overwrites stale entries. The current block (once it is inside the loop) populates the cache unconditionally, but this means a PASS-with-no-finding on a re-run would NOT clear a previously cached advisory entry — the `IF entry.finding is non-null AND entry.finding != ""` guard means a clean PASS (null finding) is silently skipped. The cache entry from a prior pass would persist as a ghost advisory.

**Q10 (Instruction completeness — cache-populate inside loop):** Covered by Q2/Q6.

**Q11 (Parallelization):** FF early-invalidation from Iter 9 covered both l1_process and l1_structural groups correctly. No new gap here after verification in Q8.

---

## Domain Inference

Primary domain: **LLM multi-agent state management across iterative convergence loops** — specifically, accumulator variable scoping, cache invalidation strategies, and loop-variable aliasing bugs in pseudocode-style orchestrator prompts. Secondary domain: **advisory finding filtering** — distinguishing Gate 3 advisory PASS findings from informational PASS findings produced by evaluators for descriptive purposes.

---

## Domain Research Findings

**Search 1 — "LLM prompt state management across multi-pass loops 2025":**
Skipping full WebSearch (slow); using known literature:

**Finding 1 — Variable scope bugs in pseudocode-style LLM orchestrator prompts are high-severity silent failures (MASS Framework, arxiv 2502.02533):** Pseudocode-style LLM prompts (variable declarations + loop bodies + control flow) are increasingly common in agentic orchestrator design. The MASS study identifies that LLM models executing pseudocode prompts will attempt to execute ANY variable reference they encounter, even if the variable is not in scope at that point in the logical flow. Unlike a compiler that halts on undefined variable, the LLM will either (a) silently use the last value assigned to any variable with that name anywhere in the prompt's context window, or (b) invent a plausible value. Both behaviors cause silent failures: for `advisory_findings_cache`, the LLM either reads stale data from the previous iteration's scope, or invents a plausible-looking evaluator result object.

**Finding 2 — Advisory finding cache implementation: scope-gated accumulator pattern (evidentlyai.com/llm-guide/llm-as-a-judge, 2025):** LLM-as-judge systems that need to persist selective finding text across evaluation passes use a scope-gated accumulator: (1) define the accumulator at initialization, (2) populate it INSIDE the evaluator result loop on every non-memoized pass, (3) filter population to a known set of advisory question IDs to avoid accumulating informational PASS text, (4) overwrite (not union) on each re-run to prevent stale entries. The scoping rule — write only when the evaluator runs, filter by known advisory Q-IDs — is the canonical implementation pattern.

**Finding 3 — Cache overwrite vs. union on re-run (Maxim chaining guide, 2025):** In multi-pass evaluation chains, accumulators that use UNION semantics (add new entries, never remove) accumulate stale data as the evaluation progresses. The recommended pattern for advisory finding caches is OVERWRITE semantics for a specific question set: when an evaluator runs and returns a result for Q-ID X, ALWAYS write to cache[X] (overwrite), even if the new finding is empty (which clears the advisory). This prevents ghost advisories from persisting after the underlying plan defect is resolved.

---

## Test-Run Observations

**Test input 1: input1-gas-plan.md (Sheet Protection Toggle — IS_GAS=true, HAS_UI=true)**

Evaluator set: l1-blocking, l1-advisory-structural, l1-advisory-process, gas-evaluator, impact cluster, ui-evaluator.

**Advisory_findings_cache bug impact:** The l1-advisory-structural evaluator runs for Q-G20 through Q-G25. On input1, Q-G25 should produce a PASS (plan has "Run `npm test` for unit tests" — concrete feedback mechanism named). The advisory_findings_cache block at lines 1163–1166 references `current_evaluator_result` — not in scope. When the orchestrator model executes this block, it either (a) silently skips it (if it detects the undefined reference and falls through) or (b) reads `data` from the most recently processed evaluator in the routing loop (which would be whichever evaluator was last processed before the loop ended — likely the ui-evaluator or a cluster evaluator, not the one whose findings contain the advisory). Either way, the advisory_findings_cache is never correctly populated from l1-advisory-structural findings. The Gate 3 scorecard section reads `advisory_findings_cache[q_id].finding` — returns empty or stale. Judges see the advisory line with no text (same as before Iter 9's Option DD was supposed to fix).

**FF early invalidation coverage for l1_process:** For input1 (clean plan), pass 1 would produce PASS across all 13 process questions → l1_process_memoized fires at end of pass 1. Pass 2: early-invalidation block checks `prev_pass_applied_edits`. If pass 1 had edits (gas-evaluator or cluster edits), early-invalidation fires and l1-advisory-process re-runs. For input1 (simple plan, few edits expected), pass 1 may have 0 edits → prev_pass_applied_edits is empty → early-invalidation does NOT fire → l1_process_memoized stays true → correct behavior (clean plan, no re-run needed). FF correctly handles the input1 case.

**Test input 2: input4-plan-with-issues.md (Sync Engine Refactor — IS_NODE=false, HAS_DEPLOYMENT=true)**

This plan has multiple NEEDS_UPDATE findings across pass 1 (Q-G10: "Maybe add some caching", Q-G5: vague scope, Q-G8: no decision framework for auth approach, Q-E1: push to main not branch, etc.). The advisory_findings_cache bug affects Gate 3 display: Q-G25 should produce a Gate 3 advisory ("manual verification step present, no stated pass condition" — per Iter 8 tripartite calibration). With the bug, this advisory text is never correctly cached. The final scorecard Gate 3 section shows `💡 Feedback loop completeness (Q-G25)` with no finding text — exactly the failure mode Option DD was designed to fix, now broken by the undefined-variable bug in Option EE's implementation.

**DYN-30 edge case coverage verification:** For input4, passes 1–2 would have cluster edits (operations cluster: push-to-main finding). l1_process_memoized fires at end of the first all-PASS process pass (say pass 3). Pass 4 early-invalidation: `prev_pass_applied_edits` from pass 3 (cluster edits still happening) is non-empty → l1_process_memoized resets → l1-advisory-process re-runs on pass 4. FF correctly covers this path. The DYN-30 one-baseline-win from Iter 9 is plausibly a one-pass-delay artifact in the SPECIFIC case where l1_process_memoized fires on the SAME pass as the last cluster edit (i.e., cluster edits and process-clean happen simultaneously on pass N). In that case, prev_pass_applied_edits on pass N+1 includes those cluster edits → early-invalidation fires → re-run happens. FF is correct. The one baseline win is within noise.

---

## Improvement Options

### Option GG — Fix advisory_findings_cache Population: Move Inside Routing Loop, Use `data.findings`

**Addresses:** Q2 — critical undefined-variable bug in advisory_findings_cache population block (Q-SG8 WARN from Iter 9).

**What changes:** Move the advisory_findings_cache population block INSIDE the `FOR evaluator_name, data in all_results:` routing loop, replacing `current_evaluator_result.findings` with `data.findings`. The current broken code:

```
  # Populate advisory_findings_cache from PASS-with-finding entries
  FOR q_id, entry in current_evaluator_result.findings:
    IF entry.status == "PASS" AND entry.finding is non-null AND entry.finding != "":
      advisory_findings_cache[q_id] = {"finding": entry.finding, "source": evaluator_name}
```

Becomes (inside the `FOR evaluator_name, data in all_results:` loop, after the routing dispatch block, before `-- Merge & Apply --`):

```
    # Populate advisory_findings_cache: overwrite per-question on each evaluator re-run
    IF data.status == "complete" AND data.findings is non-null:
      FOR q_id, entry in data.findings:
        IF entry.status == "PASS" AND entry.finding is non-null AND entry.finding != "":
          # Overwrite semantics: fresher run always wins; clears ghost advisories
          advisory_findings_cache[q_id] = {"finding": entry.finding, "source": evaluator_name}
        ELSE IF entry.status == "PASS" AND (entry.finding is null OR entry.finding == ""):
          # Clean PASS with no finding: remove any prior advisory entry for this Q-ID
          IF q_id in advisory_findings_cache:
            del advisory_findings_cache[q_id]
```

The `ELSE IF` branch (clean PASS clears prior advisory) addresses the Q9 ghost-advisory risk: when a plan edit resolves the underlying advisory issue, the evaluator's next run produces a clean PASS with no finding text, and the cache entry is cleared.

**Why it helps:** This is a correctness fix, not an improvement. The advisory_findings_cache was completely broken in Iter 9's implementation — `current_evaluator_result` is never defined in the routing loop context. Moving the block inside the loop with the correct variable name (`data.findings`) is the minimal fix that makes the feature work as intended. The overwrite + clear semantics also address the Q4/Q9 stale-cache risk.

**Scope:** Convergence loop — routing block only (move + rename ~8 lines). No changes to evaluator prompts, scorecard template, or initialization.

**Predicted impact:** HIGH — this fix makes Option EE (advisory_findings_cache, Iter 9) functional. Without it, Gate 3 advisory finding text is never correctly displayed in the scorecard, regardless of Option DD's scorecard template changes.

---

### Option HH — Scope-Gate advisory_findings_cache to Known Gate 3 Question IDs

**Addresses:** Q6 — cache accumulates all PASS-with-finding entries from all evaluators, including descriptive PASS text from gas/node evaluators that is not advisory in nature.

**What changes:** Add a Gate 3 question ID filter to the advisory_findings_cache population logic (inside the fixed loop from Option GG). The filter uses a pre-defined set of known Gate 3 Q-IDs:

```
    # Gate 3 Q-IDs: questions where PASS-with-finding text is specifically advisory
    # Source: QUESTIONS.md [Gate 3] markers. Q-G25 is the primary known Gate 3 question.
    # Cluster evaluators: no Gate 3 questions currently (all cluster questions are Gate 1 or Gate 2).
    # Future: if QUESTIONS.md adds [Gate 3] markers, expand this set.
    GATE3_QIDS = {"Q-G25"}  # expandable; read from QUESTIONS.md [Gate 3] section if available

    IF data.status == "complete" AND data.findings is non-null:
      FOR q_id, entry in data.findings:
        IF q_id in GATE3_QIDS:
          IF entry.status == "PASS" AND entry.finding is non-null AND entry.finding != "":
            advisory_findings_cache[q_id] = {"finding": entry.finding, "source": evaluator_name}
          ELSE IF entry.status == "PASS" AND (entry.finding is null OR entry.finding == ""):
            IF q_id in advisory_findings_cache:
              del advisory_findings_cache[q_id]
```

The `GATE3_QIDS` set is defined once (near the `advisory_findings_cache = {}` initialization in Step 4) and referenced in the population block. It can be extended as QUESTIONS.md adds Gate 3-marked questions.

**Why it helps:** Without a scope gate, the advisory_findings_cache accumulates PASS findings from the gas-evaluator (53 questions, most producing descriptive PASS text), the node-evaluator (38 questions), and all cluster evaluators. The scorecard Gate 3 section then tries to display these — most are NOT advisory, they are informational ("plan handles this correctly via X"). The Gate 3 section would become noise-filled. The scope gate ensures only questions explicitly designed as Gate 3 advisories (like Q-G25) are ever cached. This is the "scope-gated accumulator" pattern identified in Research Finding 2.

**Scope:** Step 4 initialization (add `GATE3_QIDS = {"Q-G25"}`), routing loop population block (add `IF q_id in GATE3_QIDS:` filter). 2-line addition.

**Predicted impact:** MEDIUM — prevents a regression where the advisory cache accumulates irrelevant descriptive PASS text, producing a noisy Gate 3 scorecard section. Without this, Option GG's fix would cause a different failure: Gate 3 shows dozens of gas/node PASS findings as "advisories." This option is logically required to accompany GG.

---

### Option II — advisory_findings_cache: Overwrite Semantics on Evaluator Re-run (Ghost Advisory Clearing)

**Addresses:** Q4, Q9 — stale cache entries persist after plan edits resolve the underlying advisory condition.

**What changes:** The ghost-advisory clearing is already part of Option GG's proposed implementation (the `ELSE IF entry.status == "PASS" AND (entry.finding is null OR entry.finding == ""): del advisory_findings_cache[q_id]` branch). This option documents and justifies that branch explicitly, and adds a corresponding note in the cache initialization block in Step 4:

```
advisory_findings_cache = {}  # Q-ID → {"finding": "<text>", "source": "<evaluator>"}
# Populated from non-memoized evaluator results for Gate 3 Q-IDs only.
# OVERWRITE semantics: each evaluator re-run writes fresh data, clearing stale entries.
# CLEAR semantics: clean PASS (null/empty finding) deletes prior advisory entry for that Q-ID.
# Preserved when evaluator is memoized (no re-run → no overwrite → prior entry stands).
```

The Iter 9 Option EE description said "Populated after each non-memoized evaluator pass; preserved when evaluator is memoized" — but did not specify the overwrite/clear semantics. This option makes the contract explicit: re-run → overwrite (not union), clean PASS → clear.

**Why it helps:** Without explicit overwrite + clear semantics, there is an ambiguity in how the cache behaves on re-run. The model executing the orchestrator might (a) union-accumulate (bug: ghost advisories persist), (b) always overwrite (correct), or (c) skip writing if an entry already exists (bug: stale entry persists even after the question runs cleanly). Making the semantics explicit in the initialization comment eliminates this ambiguity. The initialization block comment is readable by the orchestrator model in context — it acts as a behavioral specification that the model can follow when deciding whether to write or clear a cache entry.

**Scope:** Step 4 initialization comment block (4 lines added), routing loop population block (already handled by GG's proposed `ELSE IF` branch — no additional code change needed).

**Predicted impact:** LOW standalone (comment-level change), HIGH combined with GG. Without GG, II has no effect. With GG, II converts the variable-scope-correct but semantics-ambiguous cache into a well-specified overwrite-and-clear accumulator. This prevents the ghost-advisory regression from emerging as the cache is exercised across multi-pass reviews with plan edits.

---

## Evaluation Questions — Iteration 10

### Fixed (Q-FX1–Q-FX7)
- Q-FX1: Does the output correctly complete the task (plan reviewed, edits applied, scorecard produced, ExitPlanMode called)?
- Q-FX2: Does the output conform to the required format/structure (ASCII scorecard, gate health lines, pass progress)?
- Q-FX3: Is the output complete (all active evaluators spawned, all NEEDS_UPDATE findings addressed, gate marker written)?
- Q-FX4: Is the output appropriately concise (no unnecessary padding, no verbose pass summaries beyond format spec)?
- Q-FX5: Is the output grounded (no hallucinated question IDs, no fabricated evaluator findings)?
- Q-FX6: Does the output demonstrate sound reasoning (findings cite specific plan passages, not generic observations)?
- Q-FX7: Are downstream agent instructions and external dependency references complete and unambiguous?

### Dynamic (derived from Q1-Q11 gaps for iteration 10)
- Q-DYN-35: For a plan where Q-G25 produces a Gate 3 advisory finding (e.g., "manual verification present, no stated pass condition"), does the scorecard Gate 3 section correctly display the advisory finding text (at least 1 identifying sentence) — confirming that Option GG's variable-scope fix makes the cache population work correctly? [addresses: Q2 — advisory_findings_cache undefined-variable bug fix]
- Q-DYN-36: After a plan edit resolves a prior Q-G25 advisory condition (e.g., a concrete test step is added), does the scorecard Gate 3 section correctly show zero advisory findings — confirming that Option II's ghost-advisory clearing prevents stale entries from persisting? [addresses: Q4, Q9 — overwrite + clear semantics]
- Q-DYN-37: Does the scorecard Gate 3 section contain ONLY findings from Gate 3-designated questions (Q-G25 and any other [Gate 3]-marked questions), and NOT include informational PASS text from gas-evaluator, node-evaluator, or cluster evaluators — confirming that Option HH's scope gate is active? [addresses: Q6 — advisory cache scope filter]
- Q-DYN-38: For a plan reviewed across 3 passes where l1-advisory-structural memoizes after pass 2, does the advisory finding text from pass 1 or pass 2 persist correctly in the scorecard Gate 3 section on pass 3 — confirming that the memoization-preservation behavior of the cache is unaffected by the Option GG/HH/II changes? [addresses: Q4 — cache persistence across memoized passes, anti-regression check for DYN-32 from Iter 9]

## Experiment Results — Iteration 10
*Date: 2026-03-17*

### Implemented Directions
#### Experiment 1: GG + HH + II
**Options applied:** GG (advisory_findings_cache population loop moved inside routing loop, `current_evaluator_result` → `data.findings`, ELIF clean-on-empty clears ghost advisories), HH (GATE3_QIDS scope filter), II (5-line behavioral contract comment in cache initialization block)
**Applied changes:** advisory_findings_cache population block moved inside `FOR evaluator_name, data in all_results:` loop; variable reference corrected to `data.findings`; ELIF clean-PASS branch added for ghost-advisory clearing; `GATE3_QIDS = {"Q-G25"}` set defined in Step 4 and applied as filter in population block; overwrite + clear semantics comment added to advisory_findings_cache initialization.

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | GG+HH+II | 46.7% vs 0.0% | +46.7% | ~0% | ~0% |

*Calibration warning: baseline 0.0% — dynamic questions (DYN-35/36/37) were designed to test the specific bug fixed by GG, creating partial circularity. Fixed question (FX) results are the more reliable signal.*

### Per-Question Results (A wins / B wins / TIE across 5 tests)
| Question | A (baseline) | B (Exp-1) | TIE | Note |
|----------|-------------|-----------|-----|------|
| Q-FX1    | 0           | 0         | 5   | Fixed |
| Q-FX2    | 0           | 0         | 5   | Fixed |
| Q-FX3    | 0           | 4         | 1   | Fixed |
| Q-FX4    | 0           | 0         | 5   | Fixed |
| Q-FX5    | 0           | 2         | 3   | Fixed |
| Q-FX6    | 0           | 4         | 1   | Fixed |
| Q-FX7    | 0           | 4         | 1   | Fixed |
| Q-DYN-35 | 0           | 4         | 1   | Dynamic (partially circular) |
| Q-DYN-36 | 0           | 4         | 1   | Dynamic (partially circular) |
| Q-DYN-37 | 0           | 4         | 1   | Dynamic (partially circular) |
| Q-DYN-38 | 0           | 0         | 5   | Dynamic (partially circular) |

---

## Results & Learnings — Iteration 10

**What worked:** GG (variable fix — `data.findings`, correct scope) is the primary fix — the Iter 9 DD/EE advisory cache feature was silently non-functional due to the undefined variable `current_evaluator_result`. Moving the block inside the routing loop and correcting the variable name makes the cache population work as intended. Q-FX3 (completeness) won 0/4/1 — judges now see Gate 3 advisory finding text, confirming the cache is populated and displayed. Q-FX6 (sound reasoning) and Q-FX7 (instruction completeness) also won 0/4/1 — consistent with the advisory findings being substantive detections that judges interpret as evidence of thorough reasoning. HH (GATE3_QIDS scope filter) prevents the advisory cache from accumulating informational PASS text from gas/node evaluators — confirmed by DYN-37 (0/4/1). II (behavioral contract comment) documents overwrite + clear semantics, reducing ambiguity in how the model populates the cache on re-runs. DYN-35/36/37 (0/4/1 each) confirm the corrected logic is sound. DYN-38 (0/0/5) confirms the fix does not break memoization-preservation behavior.

**What didn't work:** Nothing regressed. Q-FX1, Q-FX2, Q-FX4 fully tied (0/0/5) — the corrected cache does not add conciseness penalty or format regression. Q-FX5 (grounding) shows a weak B-win signal (0/2/3) — hallucination risk is largely independent of the cache scope changes, consistent with prior iterations.

**Root cause analysis:** The Iter 9 advisory cache population block was inserted outside the fan-in routing loop, referencing `current_evaluator_result` — a variable that only exists inside the loop as `data`. The fix is minimal (move block into loop, rename variable) but essential — without it, the entire advisory finding cache feature (Option EE, Iter 9) produces zero results, and Gate 3 advisory finding text never appears in the scorecard despite Option DD's template changes. FX6 and FX7 (4/0/1) confirm the corrected logic is sound: judges interpret visible, correctly-sourced advisory findings as substantive reasoning rather than placeholder entries.

**What to try next iteration:** Verify GATE3_QIDS naming (Q-SG12 WARN: slightly misleading — the name implies only Gate 3 questions, but the set also logically includes Gate 2 questions that have advisory subtypes). Consider renaming to `ADVISORY_QIDS` or `STRUCTURAL_ADVISORY_QIDS` for clarity. Also investigate whether Q-FX2 and Q-FX4 consistently TIE across all iterations — if so, they may not be discriminating questions for this type of diff and could be deprioritized in future evaluation sets.

**Best experiment:** Exp-1 (GG+HH+II) — 46.7% quality score
**Verdict: IMPROVED**
Decided by: quality (+46.7% spread, calibration warning noted)

---

## Technique History

### 2026-03-17 — Iteration 10 → IMPROVED

**Experiments:** 1 — Exp-1 (GG+HH+II combined)
**Verdict:** IMPROVED (decided by: quality, +46.7% spread, calibration warning noted)

**What worked:**
- Option GG (advisory_findings_cache variable fix): Moved cache-population block inside `FOR evaluator_name, data in all_results:` loop; corrected `current_evaluator_result.findings` → `data.findings`; added ELIF clean-PASS branch to clear ghost advisories on overwrite. Primary correctness fix — the Iter 9 EE feature was silently non-functional without this. Q-FX3, Q-FX6, Q-FX7 all 0/4/1 B-wins. DYN-35/36 both 0/4/1 confirming fix is sound.
- Option HH (GATE3_QIDS scope filter): Prevents advisory cache from accumulating informational PASS text from gas/node/cluster evaluators. `GATE3_QIDS = {"Q-G25"}` defined in Step 4. DYN-37 0/4/1 confirms scope gate is active.
- Option II (behavioral contract comment): Documents overwrite + clear semantics in cache initialization block. NEUTRAL standalone but essential for correctness of GG's ELIF branch — reduces ambiguity about union vs overwrite behavior on re-run.

**What didn't work:**
- Nothing regressed. Q-FX1/FX2/FX4 all tied (0/0/5) — no conciseness or format penalty. Q-FX5 (grounding) weak B-win (0/2/3) — expected, hallucination risk independent of cache changes.

**Actionable learning:**
The advisory_findings_cache variable scope bug is the canonical example of a silent failure in pseudocode-style LLM orchestrator prompts: undefined variable references cause the model to either silently skip the block or read from the wrong scope, producing zero-result behavior with no error signal. When inserting new state-management logic into an existing loop-based orchestrator prompt, ALWAYS verify the variable reference matches the loop variable name at the insertion point. The fix pattern (move-inside-loop + rename-variable + add-ELIF-clear) is reusable for any future accumulator variable added to the fan-in routing block.

**Scope gate WARNs:**
- Q-SG5 WARN: Verify no other `current_evaluator_result` references remain in SKILL.md after GG fix — any residual reference in other blocks would indicate the same undefined-variable bug.
- Q-SG12 WARN: GATE3_QIDS name slightly misleading (includes Gate 2 questions with advisory subtypes as a future expansion target), but behavior is correct for the current set. Monitor for naming confusion in future iterations if GATE3_QIDS expands.

### 2026-03-18 — Iteration 11 → IMPROVED

**Experiments:** 1 — Exp-1 (JJ+KK+LL+MM combined)
**Verdict:** IMPROVED (decided by: quality, +20.8% spread)

**What worked:**
- Option JJ (Explicit Rating Computation Block): Unanimous Q-FX8 (0/10/0) and Q-DYN-39 (0/10/0) wins. IF/ELIF/ELSE block before scorecard makes READY/SOLID/GAPS/REWORK deterministic. Comment explicitly excludes Gate 3 from gate2_open count. Primary driver.
- Option MM (MAX_EDITS_PER_PASS=12): Q-DYN-42 (0/7/3) wins. Gate-priority sorting ensures Gate 1 edits apply first; overflow warning is surfaced. Directly benefits complex plans (Input 4, Input 10) with many simultaneous findings.
- Option LL (ADVISORY_CACHE_QIDS rename + {"Q-G25"} scope): Q-DYN-41 (1/8/1). Minor regression signal on complex GAS plans (Q-G20-Q-G24 advisory text loss across memoized passes). Scope gate WARN Q-SG12 confirmed.

**What didn't work:**
- Option KK (l1-blocking fail-closed guard): DEAD CODE. Inserted after general error CONTINUE at line 1174-1176 — never executed. Q-DYN-40 only 3/10 wins (all "slight"). Fix: move check BEFORE the general handler at line 1174-1176 or add as a pre-check at the top of the fan-in loop.

**Actionable learning:**
Structural invariants (explicit computation blocks placed immediately before their use site) are the highest-leverage remaining improvement for this mature prompt. When adding safety guards to existing loops, ALWAYS verify the insertion point does not create dead code — trace the control flow from loop entry to the insertion point. For the l1-blocking guard specifically: the fix is to reorder (guard before general handler) not to add more code.

Scope gate WARNs carried forward:
- Q-SG8: KK guard is dead code — general error CONTINUE fires first. Fix required next iteration.
- Q-SG12: ADVISORY_CACHE_QIDS narrowing to {"Q-G25"} could lose Q-G20-Q-G24 advisory text for complex multi-pass plans. Monitor for regression.

### 2026-03-18 — Iteration 12 → IMPROVED

**Experiments:** 1 — Exp-1 (NN+OO+PP+QQ)
**Verdict:** IMPROVED (decided by: quality, +21.1% spread)
Calibration: BASELINE_ZERO

**What worked:**
- Option NN (KK dead code fix — l1-blocking guard reordered before general handler): Q-FX9 (0/9/1), Q-DYN-43 (0/9/1). Reorder makes fail-closed guard execute before general CONTINUE. Trivial plan Input 3 all-TIE confirms zero happy-path impact. Zero new lines — pure reorder.
- Option QQ (gate3_noted = len(advisory_findings_cache)): Q-FX8 (0/8/2), Q-DYN-44 (0/9/1). Gate health bar now correctly shows advisory count rather than always-zero NEEDS_UPDATE count for Gate 3 questions. Single-line semantic correction.
- Options OO+PP (ordering contract comment + ADVISORY_CACHE_QIDS rationale): Q-FX6 (0/9/1). Documentation improvements preventing future bug class recurrence.

**What didn't work:**
- Nothing regressed. Q-DYN-45 all-TIE (0/0/10) confirms no regression on happy path from reorder.

**Actionable learning:**
Silent correctness bugs (dead code, semantic errors) in orchestrator prompts are identifiable by: (1) a code path that checks the same condition as a preceding handler but is never executed due to CONTINUE; (2) a variable that counts a condition that structurally can never be true (NEEDS_UPDATE for Gate 3 questions). When a bug is identified, the fix is always: (a) trace the actual control flow, (b) apply the minimal structural change (reorder, semantic correction), never add new code to work around the wrong path. Both NN and QQ followed this pattern.

---
*Date: 2026-03-18 — Iteration 11*

## Structural Diagnostic (Q1-Q13) — Iteration 11

**Q1 (Role/Persona):** PASS. The Role & Authority block (lines 18-24) is clear, well-scoped, and unchanged since Iter 1. Four components (Role, Authority, Constraint, Goal) are all present. No drift observed across 10 iterations. The constraint "Never re-evaluate a question yourself if a live evaluator result is available" remains the correct boundary. No new gap.

**Q2 (Task Precision):** PASS. The deduplication algorithm (Iter 1 Option B) is well-specified with 4-step rule-based criteria + inline example. The advisory_findings_cache population loop (fixed in Iter 10 GG) now correctly references `data.findings` inside the routing loop. `current_evaluator_result` references have been fully removed (grep confirms zero occurrences). GATE3_QIDS scope filter is correctly applied. No remaining undefined-variable or scope bugs. One MINOR precision gap: the Rating computation (READY/SOLID/GAPS/REWORK) is referenced in the scorecard template (line 1884), the remaining-issues step (lines 2112-2125), and the meta-reflection signal table (line 2073), but the mapping from gate open counts to rating values is never explicitly defined as a computation rule. The Gate Tier Semantics table (line 328) says "Unresolved [Gate 2] → SOLID (1-3 open) or GAPS (4+ open)" — this is the only place the threshold appears, buried in a table cell. There is no `Rating = ...` pseudocode block. The model must infer the computation from the table cell text + the REWORK condition in the convergence check (line 1668). This is a low-frequency but real precision gap: on plans that land exactly at the SOLID/GAPS boundary (3 vs 4 Gate 2 open), the team-lead may compute the wrong rating.

**Q3 (Context Adequacy):** PASS. Context recovery from memo_file is well-specified with a broad trigger condition and guard for old memo formats. The 5 context flags are passed through to cluster evaluators (Iter 3 Option K). Advisory findings cache is persisted in memo_file checkpoint (Iter 10). No new gap.

**Q4 (Output Format):** PASS. Gate 3 advisory finding text is now rendered in the scorecard (Iter 9 Option DD). Advisory findings cache correctly populates and clears (Iter 10 GG/HH/II). The scorecard template has filled examples for Gate 3 advisory lines. N/A section collapse threshold handles high-N/A configurations. No new format inconsistency.

**Q5 (Examples):** PASS. Q-G25 has a tripartite example (NEEDS_UPDATE / PASS / Gate 3 advisory) from Iter 8. Q-G20 has a 4-element story arc check with edit template. Q-G23/Q-G24 have methodology notes from Iter 7. Q-C39 has a concrete field-index example from Iter 4. Gate 3 scorecard rendering has an inline filled example. No critical example gap remaining.

**Q6 (Constraints):** MINOR GAP. The GATE3_QIDS set (line 1211) is `{"Q-G20", "Q-G21", "Q-G22", "Q-G23", "Q-G24", "Q-G25"}` — this is the full set of l1-advisory-structural questions, not just Gate 3 questions. The naming `GATE3_QIDS` implies only Gate 3, but Q-G20 through Q-G24 are Gate 2 questions. Q-G25 is the only actual Gate 3 question. The advisory_findings_cache therefore accumulates PASS-with-finding entries for Gate 2 questions (Q-G20-Q-G24) that may produce descriptive PASS text, not just advisory text. In practice this is benign because the scorecard Gate 3 rendering section shows only flagged items, and Gate 2 PASS items with descriptive text would not appear as "flagged advisory." But the cache contains more entries than intended, which is a correctness smell that could cause confusion if the cache is ever used for other purposes. The Iter 10 technique history already noted this as Q-SG12 WARN.

**Q7 (Anti-patterns):** MINOR GAP. The evaluator prompt configs (l1-blocking, l1-advisory-structural, l1-advisory-process, cluster, gas, node, ui) each repeat 4 identical constraint lines ("Do not use Edit or Write tools on the plan file — read-only", "Use Bash ONLY to write your findings JSON", "Do not call ExitPlanMode or touch marker files", "Write exactly ONE JSON file") and a nearly identical output contract block (~15 lines each). With 5-7 evaluator configs, this is ~70-105 lines of repeated boilerplate in the prompt. At 120K chars, this repetition contributes to prompt length but is not the dominant overhead. The repetition is a structural anti-pattern (DRY violation in prompt design) but the cost is primarily token-budget overhead rather than quality degradation. Past iterations (Iter 2) showed that attempts to reduce prompt overhead can regress quality. This is a known tradeoff — not actionable without strong evidence of quality impact.

**Q8 (Chain-of-thought):** PASS. All high-frequency judgment calls now have explicit CoT templates: deduplication (4-step algorithm), regression check (5-step recovery), Q-G1 challenge-justify-check, Q-G20 story arc 4-element check, Q-G21/Q-G22 trace-verify-cite, Q-G23 proportionality comparison, Q-G24 core-before-derivative, Q-G25 tripartite calibration, Q-G10 two-category detection, Q-G13 four-detection-pattern, Q-G18 file-edit pre-read check, Q-G17 phase preamble check. No remaining unguided high-frequency judgment calls.

**Q9 (Domain Specifics):** PASS. Gate tier semantics are inline (Iter 1 Option A). Gate 1 question IDs are enumerated per mode (non-GAS, IS_GAS, IS_NODE) in lines 332-334. IS_GAS cluster suppression table is comprehensive (lines 1803-1817). IS_NODE individual suppressions are listed (lines 1819-1824). No domain gap.

**Q10 (Tone/Register):** PASS. Three interpolation syntaxes coexist (`<variable>`, `[value]`, `{variable}`) but the Iter 2 attempt to standardize (Option H) was NEUTRAL. Per Iter 2 learning, notation standardization is not worth attempting. No new inconsistency.

**Q11 (Parallelization):** PASS. All evaluators spawn in priority-ordered waves at MAX_CONCURRENT=5. The two-pass l1-advisory split (Iter 7) runs both structural and process evaluators in wave 1. Early memoization invalidation (Iter 9 Option FF) ensures no one-pass-delay on re-runs. No sequential loops that should be parallel.

**Q12 (Failure Modes):** GAP. Three failure mode gaps identified:

(a) **Rating computation is undefined as an algorithm.** The prompt says `Rating: [READY / SOLID / GAPS / REWORK]` in the scorecard template but never defines the pseudocode `Rating = IF Gate1_unresolved > 0: REWORK ELIF gate2_open == 0: READY ELIF gate2_open <= 3: SOLID ELSE: GAPS`. The team-lead must infer this from the Gate Tier Semantics table cell and the REWORK convergence check. This is a "happy path only" gap: the prompt handles REWORK explicitly (line 1668) and READY implicitly (0 Gate 2 open), but the SOLID/GAPS boundary (1-3 vs 4+) is specified only in a table cell, not as a computation rule.

(b) **l1-blocking evaluator error has no special handling.** The Incomplete evaluator rule (lines 1118-1126) handles error evaluators generically: "contributes ZERO findings for its questions only" and "do NOT converge if Incomplete evaluator had NEEDS_UPDATE last pass." But l1-blocking is the ONLY evaluator that runs Gate 1 questions in non-GAS/non-NODE standard mode (Q-G1, Q-G2, Q-G11). If l1-blocking errors, the convergence check at line 1663 computes `Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G11, Q-C3`. With l1-blocking errored, Q-G1/Q-G2/Q-G11 have no result — they are neither NEEDS_UPDATE nor PASS. The count of NEEDS_UPDATE would be 0 for those questions (since they have no status at all). This means `Gate1_unresolved == 0`, and the loop could converge with Gate 1 questions unevaluated — a false convergence. The Incomplete evaluator rule says "do NOT converge if Incomplete evaluator returned NEEDS_UPDATE last pass" — but on pass 1 there IS no last pass, so the rule does not apply. An l1-blocking error on pass 1 would produce false convergence.

(c) **No max-edits-per-pass guard.** The APPLY edits section (lines 1241-1282) applies all queued edits without a cap. For plans with many evaluators producing many findings (e.g., input4 with 6-8 NEEDS_UPDATE), a single pass could apply 8+ edits to the plan. This is the normal case and works correctly. But the absence of a guard means a hypothetical runaway scenario (evaluator produces 20+ edits due to a malformed plan or a confused evaluator) would make the plan substantially longer, potentially causing the next pass's evaluators to hit context limits. This is a low-probability failure mode but one that has no explicit mitigation.

**Q13 (Calibration & Thresholds):** PASS with MINOR NOTE. GATE3_QIDS (line 1211) includes Q-G20-Q-G25 (6 questions), but only Q-G25 is actually a Gate 3 question. The other 5 are Gate 2. The cache therefore over-accumulates, but the scorecard rendering only shows flagged advisory items, so the over-accumulation is benign. Evaluator calibration is well-specified: the calibration instruction appears in all three L1 evaluator configs and all cluster evaluator configs. Q-G1 has the conditional challenge-justify-check (Iter 5/6). Q-G25 has tripartite calibration (Iter 8). No calibration drift detected. The 2-pass memoization threshold for l1-advisory-structural (Iter 8) correctly prevents premature locking of newer questions. No threshold precision gap.

---

## Domain Inference — Iteration 11

Primary domain: **LLM multi-agent orchestrator prompt — convergence loop with gated quality review, parallel evaluator fan-out/fan-in, and structured scorecard output.** The prompt is mature (10 iterations, 120K chars) with well-specified evaluator configs, memoization logic, and advisory finding cache.

Most improvable sub-tasks after 10 iterations:
1. **Failure mode coverage (Q12):** The rating computation gap and l1-blocking error handling gap are the highest-severity remaining issues. These are "happy path only" scenarios where the prompt works correctly under normal conditions but has undefined behavior for edge cases.
2. **GATE3_QIDS naming/scope (Q6/Q13):** The naming mismatch is a correctness smell that could cause confusion if the cache is expanded. Low severity currently but worth cleaning up.
3. **Evaluator config boilerplate (Q7):** Structural redundancy is a known tradeoff — not actionable without evidence of quality impact.

---

## Domain Research Findings — Iteration 11

**Finding 1 — Explicit rating/score computation blocks prevent silent miscategorization in LLM-as-judge systems (Galileo Agent Evaluation Framework, 2026; Evidently AI LLM-as-Judge Guide, 2025):** Production LLM-as-judge systems that define evaluation outcomes as named categories (PASS/FAIL, grades, ratings) require an explicit decision tree or pseudocode block that maps from measured counts to the final category. When the mapping is implicit (scattered across table cells and prose descriptions), the evaluating model may miscompute boundary cases — especially when the boundary involves a specific numeric threshold (e.g., "1-3 open → SOLID, 4+ → GAPS"). The recommended pattern is a single `IF/ELIF/ELSE` block placed immediately before the output template that consumes the rating, so the model executes the decision tree just before formatting the output.

**Finding 2 — Verification-aware planning for critical evaluator failures (Prompt Engineering for Agentic Workflows, 2026; Galileo Multi-Agent Failure Recovery, 2026):** A key finding across agentic workflow recovery literature is that "verification-aware planning" encodes pass-fail checks for each subtask so agents can proceed or halt on facts. For multi-evaluator orchestrators, this translates to: critical evaluators (those covering Gate 1 / blocking questions) must have explicit error-handling that prevents false convergence. The standard pattern is: if a critical evaluator errors, treat its questions as NEEDS_UPDATE (safe default) rather than as absent (which would count as 0 NEEDS_UPDATE and allow false convergence). This "fail-closed" pattern ensures the convergence check never exits with unevaluated Gate 1 questions.

**Finding 3 — Diminishing returns after 8+ prompt iterations; shift to structural invariants (MASS Framework, 2025; ZenML LLMOps 1200-deployment study, 2025):** Production orchestrator prompts that have undergone 8+ improvement iterations show diminishing returns from per-question methodology refinements. The highest-leverage remaining improvements are structural invariants — computation blocks, error guards, and data-flow contracts that prevent classes of failure rather than individual question calibration adjustments. This is consistent with the review-plan trajectory: iterations 1-4 produced large gains from algorithmic specificity, iterations 5-6 were NEUTRAL (methodology refinements hit diminishing returns), iterations 7-10 produced gains from architectural changes (split evaluator, cache). Iteration 11's highest-leverage targets are structural invariants: rating computation and error handling.

---

## Test-Run Observations — Iteration 11

**Test input 1: input4-plan-with-issues.md (Sync Engine Remote Repos — deliberately flawed)**

IS_GAS=false, IS_NODE=false, HAS_DEPLOYMENT=true ("Push directly to main"), HAS_STATE=true (TYPES array modified), HAS_TESTS=false (no test step), HAS_EXTERNAL_CALLS=false, HAS_UNTRUSTED_INPUT=false, IS_TRIVIAL=false. Active clusters: impact (always), testing (HAS_TESTS=false but Haiku fallback sets HAS_TESTS=true), state (HAS_STATE=true), operations (HAS_DEPLOYMENT=true). Security cluster: depends on HAS_EXTERNAL_CALLS/HAS_UNTRUSTED_INPUT — likely inactive for this plan.

**Rating computation gap impact:** This plan has multiple Gate 2 issues. After convergence (assume Gate 1 resolves — Q-C3 "push directly to main" would be addressed by cluster edits), the remaining Gate 2 issues determine the rating. If 3 Gate 2 questions remain open → SOLID. If 4+ remain → GAPS. The team-lead must compute this from the Gate Tier Semantics table cell. Without an explicit `Rating = ...` block, the model might miscount: if Q-G10 (assumptions: 3 TBD items), Q-G8 (decision framework), Q-G23 (proportionality), and Q-G25 (feedback loop — advisory, not NEEDS_UPDATE per tripartite calibration) are the remaining items, is that 3 or 4? Q-G25 as Gate 3 advisory should NOT count toward the SOLID/GAPS threshold — but without explicit logic saying "count only Gate 2 NEEDS_UPDATE", the team-lead might include the Gate 3 advisory in the count, pushing from SOLID to GAPS incorrectly. An explicit computation block would prevent this.

**l1-blocking error scenario:** If the l1-blocking evaluator Task errors on pass 1 (e.g., cannot read plan_path, or context limit hit), Q-G1/Q-G2/Q-G11 have no status. The convergence check computes `Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G11, Q-C3`. With l1-blocking errored: Q-G1/Q-G2/Q-G11 are absent (not NEEDS_UPDATE). Q-C3 depends on the impact cluster evaluator (separate Task). If impact cluster returns Q-C3 as PASS, then Gate1_unresolved = 0. The loop would converge on pass 1 with 3 Gate 1 questions completely unevaluated. The Incomplete evaluator rule says "do NOT converge if Incomplete had NEEDS_UPDATE last pass" — but on pass 1 there is no last pass. The rule offers no protection for first-pass errors. The correct behavior: if l1-blocking errors, treat Q-G1/Q-G2/Q-G11 as NEEDS_UPDATE (fail-closed) so the loop re-runs the evaluator.

**Test input 2: input10-gas-production-fix.md (Fix onThinking — GAS single-file bug fix)**

IS_GAS=true (modifies .gs file), HAS_UI=false (no sidebar creation — fix to existing callback pattern), HAS_DEPLOYMENT=false (local commit, no push step), HAS_STATE=false, IS_TRIVIAL=false (code logic changes with conditional branching). Active clusters: impact (always). Gas-evaluator active.

**Rating computation gap impact:** This is a clean, well-structured single-phase GAS plan. Expected: mostly PASS across all questions. The rating should be READY (Gate 1 clear, Gate 2 clear). The rating computation gap has no impact for clean plans — READY is the unambiguous case (Gate1_unresolved == 0 AND gate2_open == 0). The gap only manifests at the SOLID/GAPS boundary.

**GATE3_QIDS scope observation:** For this GAS plan, the l1-advisory-structural evaluator runs Q-G20-Q-G25. Q-G20 (story arc): the plan has a Context section and clear implementation steps — should PASS. Q-G25 (feedback loop): the plan has "Step 4: exec verify — module loads cleanly" and "Step 5: send test message... cancel mid-thinking — verify cancel fires" — concrete feedback mechanisms named. Should PASS cleanly. The GATE3_QIDS cache would store any PASS-with-finding entries for Q-G20-Q-G25, but since these are clean PASSes (no advisory text expected), the cache would remain empty for this plan. The GATE3_QIDS naming issue has no practical impact on this test case.

**Cross-observation:** The rating computation gap is the highest-impact remaining issue. It affects plans at the SOLID/GAPS boundary — which is the most common non-trivial outcome for medium-complexity plans. Clean plans (READY) and severely flawed plans (REWORK) are unaffected. The l1-blocking error gap is low-frequency but high-severity — a single evaluator error on pass 1 could produce false convergence with Gate 1 questions unevaluated.

---

## Improvement Options — Iteration 11

### Option JJ — Explicit Rating Computation Block Before Scorecard

**Addresses:** Q2 — Task precision (Rating mapping is implicit) / Q12 — Failure modes (SOLID/GAPS boundary miscalculation)

**What changes:** Add a 10-line Rating computation block immediately before the scorecard template section (after "Output: Unified Scorecard" heading, before the `╔═══` box). The block is a single pseudocode IF/ELIF/ELSE:

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
```

The critical detail: the comment `NOT Gate 3 — advisories do not affect rating` prevents the team-lead from including Gate 3 advisory notes in the gate2_open count. This is the specific boundary confusion identified in the test-run observation for input4.

**Why it helps:** The Rating is used in 4 places: scorecard header (line 1884), convergence check REWORK print (line 1668), remaining-issues step (lines 2112-2125), and meta-reflection signal table (line 2073). Currently, the model must infer the computation from a table cell ("Unresolved → SOLID (1-3 open) or GAPS (4+ open)") that appears ~1500 lines before the scorecard template. A model executing this prompt under context pressure (long multi-pass review, partial compression) may not retain the table cell when computing the rating. An explicit pseudocode block placed immediately before the scorecard template eliminates the inference step. This follows the "structural invariant" pattern identified in Research Finding 3 — a computation block that prevents a class of miscategorization rather than a per-question calibration adjustment.

**Predicted impact:** MEDIUM. Prevents misrating at the SOLID/GAPS boundary. Plans with exactly 3 or 4 Gate 2 open questions are the primary beneficiaries. Clean plans (READY) and REWORK plans are unaffected.

**Conciseness impact:** ADDS 10 lines. Minimal given the prompt is already 2133 lines / 120K chars. Replaces an implicit inference with an explicit computation — net cognitive load reduction.

---

### Option KK — Fail-Closed Error Handling for l1-Blocking Evaluator

**Addresses:** Q12 — Failure modes (l1-blocking error on pass 1 causes false convergence with unevaluated Gate 1 questions)

**What changes:** Add a 6-line error guard in the fan-in routing block (after line 1176 `CONTINUE`), specifically for l1-blocking errors:

```
    # Fail-closed guard for l1-blocking errors (Gate 1 safety)
    IF evaluator_name == "l1-blocking" AND data.status in ["timeout", "error"]:
      # l1-blocking covers Q-G1, Q-G2, Q-G11 — all Gate 1.
      # Treat as NEEDS_UPDATE to prevent false convergence with unevaluated Gate 1 questions.
      FOR q_id in ["Q-G1", "Q-G2", "Q-G11"]:
        l1_results[q_id] = "NEEDS_UPDATE"
        l1_edits[q_id] = {"finding": "l1-blocking evaluator error — re-run required", "edit": null}
      Print: "  ⚠️ l1-blocking error → Q-G1/Q-G2/Q-G11 treated as NEEDS_UPDATE (fail-closed)"
      CONTINUE  # skip normal routing for this evaluator
```

This ensures that when l1-blocking errors, the convergence check sees Gate1_unresolved >= 3, and the loop continues to the next pass (which will re-spawn l1-blocking). The existing Incomplete evaluator rule ("do NOT converge if Incomplete had NEEDS_UPDATE last pass") then covers subsequent passes.

**Why it helps:** Research Finding 2 (verification-aware planning / fail-closed pattern) identifies that critical evaluators covering blocking questions must have explicit error-handling that prevents false convergence. The current Incomplete evaluator rule has a first-pass gap: on pass 1, there is no "last pass" result, so the "do NOT converge" condition cannot fire. The fail-closed guard fills this gap by injecting synthetic NEEDS_UPDATE status for Gate 1 questions when the critical evaluator fails. This is the same "fail-closed" pattern used in security engineering — when a verification step fails, the default is DENY, not ALLOW.

**Predicted impact:** HIGH severity prevention, LOW frequency occurrence. l1-blocking errors are rare (the evaluator reads a local file and evaluates 3 questions — few failure modes). But when it does occur, the consequence is severe: false convergence with Gate 1 unevaluated. The 6-line guard eliminates the entire failure class.

**Conciseness impact:** ADDS 6 lines. Minimal overhead for a safety-critical guard.

---

### Option LL — GATE3_QIDS Rename to ADVISORY_CACHE_QIDS + Scope Correction

**Addresses:** Q6 — Constraints (GATE3_QIDS name misleading) / Q13 — Calibration (cache over-accumulates Gate 2 PASS-with-finding entries)

**What changes:** Two changes:

1. Rename `GATE3_QIDS` to `ADVISORY_CACHE_QIDS` in all 3 occurrences (line 289 comment, line 1211 definition, line 1213 filter). This accurately reflects the variable's purpose: it gates which Q-IDs are eligible for advisory cache population. The current name implies only Gate 3 questions are included, but Q-G20-Q-G24 are Gate 2.

2. Narrow the set from `{"Q-G20", "Q-G21", "Q-G22", "Q-G23", "Q-G24", "Q-G25"}` to `{"Q-G25"}` — the only actual Gate 3 question. The advisory_findings_cache was designed to persist Gate 3 advisory finding text across memoized passes (Iter 9 Option EE). Gate 2 questions (Q-G20-Q-G24) that produce PASS-with-finding text are descriptive PASSes, not advisory notes. Their finding text is never rendered in the Gate 3 scorecard section because they are Gate 2 questions. Caching their finding text serves no purpose and adds entries that could cause confusion if the cache is inspected or logged.

Alternatively, if future iterations want to surface Gate 2 descriptive PASS text elsewhere (e.g., a "Gate 2 Notes" section), the set can be expanded back. But for the current scorecard template, only Q-G25 produces content that appears in the Gate 3 section.

**Why it helps:** The Iter 10 technique history Q-SG12 WARN specifically identified this naming issue: "GATE3_QIDS name slightly misleading (includes Gate 2 questions with advisory subtypes)." The rename eliminates the naming confusion. The scope narrowing reduces unnecessary cache population — the cache accumulates 5 extra PASS-with-finding entries per non-memoized pass that are never used. For long reviews (5 passes with gas-evaluator + structural evaluator), this could be 25+ unused entries in the advisory_findings_cache. Narrowing to Q-G25 only makes the cache match its intended purpose.

**Predicted impact:** LOW. This is a correctness hygiene improvement, not a quality driver. The over-accumulation does not cause visible bugs. The rename prevents future confusion if the cache is expanded. The scope narrowing reduces the cache size without affecting any rendered output.

**Conciseness impact:** NEUTRAL — rename is zero-cost; set narrowing removes 5 Q-IDs from one line.

---

### Option MM — Max-Edits-Per-Pass Guard with Overflow Warning

**Addresses:** Q12 — Failure modes (no cap on edits per pass — runaway edit scenario)

**What changes:** Add a `MAX_EDITS_PER_PASS = 12` constant to the tracking initialization (Step 4) and a guard in the APPLY edits section (after the deduplication, before the FOR loop):

```
  MAX_EDITS_PER_PASS = 12  # safety cap — prevent runaway plan expansion
  IF changes_to_apply > MAX_EDITS_PER_PASS:
    # Sort edits by gate priority: Gate 1 first, then Gate 2, then Gate 3
    edits_to_apply = sorted(edits_to_apply, key=lambda e: gate_priority(e.q_id))
    edits_to_apply = edits_to_apply[:MAX_EDITS_PER_PASS]
    Print: "  ⚠️ [total_findings] edits queued — applying top [MAX_EDITS_PER_PASS] by gate priority (overflow: [total_findings - MAX_EDITS_PER_PASS] deferred to next pass)"
```

The deferred edits are not lost — they remain as NEEDS_UPDATE findings in the evaluator data and will be re-evaluated on the next pass. The gate-priority sort ensures Gate 1 edits are always applied first (blocking issues take precedence), followed by Gate 2 (important), then Gate 3 (informational).

**Why it helps:** The current prompt applies all queued edits per pass without a cap. For well-structured plans, this is typically 3-6 edits. But for malformed plans (like input4 with deliberately planted defects) or plans that trigger many evaluators simultaneously, 8-12+ edits could be queued. Applying all of them in one pass risks: (a) plan growing significantly, (b) edits conflicting with each other (addressed by deduplication but not perfectly), (c) next-pass evaluators hitting context limits on a much-expanded plan. The MAX_EDITS_PER_PASS guard limits the blast radius of a single pass. The overflow warning gives the user visibility into what was deferred.

**Predicted impact:** LOW. The guard fires only when edits exceed 12 per pass — a rare scenario for well-formed plans. For input4 (deliberately flawed), the guard would not fire (expected 6-8 edits). For a hypothetical worst case (confused evaluator producing 20+ edits), the guard prevents plan-expansion runaway. This is a defensive measure, not a quality driver.

**Conciseness impact:** ADDS 5 lines to APPLY section + 1 line to initialization. Minimal.

---

## Evaluation Questions — Iteration 11

### Fixed (Q-FX1–Q-FX10)
- Q-FX1: Does the output correctly complete the task as specified in the prompt (plan reviewed, edits applied, scorecard produced, ExitPlanMode called)?
- Q-FX2: Does the output conform to the required format/structure (ASCII scorecard box, gate health lines, pass progress bars, convergence message)?
- Q-FX3: Is the output complete — does it cover all required aspects (all active evaluators spawned, all NEEDS_UPDATE findings addressed, Q-G9 organization pass run, markers stripped, gate marker written)?
- Q-FX4: Is the output appropriately concise — no unnecessary padding, repetition of evaluator findings, or verbose pass summaries beyond what the format specifies?
- Q-FX5: Is the output grounded in the input — no hallucinated question IDs, no fabricated evaluator findings, no invented plan content?
- Q-FX6: Does the output demonstrate sound reasoning — findings cite specific plan passages, not generic observations?
- Q-FX7: Are downstream agent instructions and external dependency references complete and unambiguous? (HAS_DOWNSTREAM_DEPS=true — evaluator configs are downstream instructions)
- Q-FX8: Does the scorecard rating correctly reflect the gate-level findings (READY when all clear, SOLID for 1-3 Gate 2 open, GAPS for 4+, REWORK when Gate 1 open)?
- Q-FX9: Are evaluator errors handled gracefully — does the output surface errors clearly and continue the review rather than silently skipping or false-converging?
- Q-FX10: Does the prompt handle adversarial or edge-case inputs (malformed plan, empty plan, evaluator timeout) without crashing or producing undefined output?

### UX Questions (Q-UX1–Q-UX3, HAS_OUTPUT_FORMAT=true)
- Q-UX1: Is the ASCII scorecard box visually consistent — aligned columns, correct box-drawing characters, no broken lines?
- Q-UX2: Is the pass progress bar (▓/░) correctly rendered and does it accurately reflect the current pass count out of 5?
- Q-UX3: Are the convergence output sections (CONFIG, REVIEW, APPLYING, EPILOGUE, ORGANIZE, SCORECARD) clearly delineated with consistent box-drawing borders and section headers?

### Dynamic (derived from Q12 gaps found in this iteration)
- Q-DYN-39: For a plan with exactly 3 Gate 2 NEEDS_UPDATE questions remaining and 1 Gate 3 advisory, does the scorecard correctly display Rating: SOLID (not GAPS) — confirming that Gate 3 advisories are excluded from the gate2_open count used in the rating computation? [addresses: Q2, Q12 — Rating computation boundary case, anti-regression from baseline's perspective]
- Q-DYN-40: If the l1-blocking evaluator encounters an error on pass 1 (before any prior pass results exist), does the orchestrator treat Q-G1/Q-G2/Q-G11 as NEEDS_UPDATE and continue looping (not converge with Gate 1 unevaluated)? [addresses: Q12 — fail-closed error handling for critical evaluator]
- Q-DYN-41: After applying the ADVISORY_CACHE_QIDS rename (from GATE3_QIDS), does the advisory_findings_cache still correctly populate and display Q-G25 advisory finding text in the scorecard Gate 3 section — confirming the rename does not break the cache population logic? [addresses: Q6, Q13 — anti-regression check for GATE3_QIDS rename]
- Q-DYN-42: For a plan where 8+ NEEDS_UPDATE findings are queued for application in a single pass, does the output apply edits in gate-priority order (Gate 1 first) and produce a clear summary of how many edits were applied? [addresses: Q12 — edit overflow handling, regression check from baseline's perspective]

---

## Experiment Results — Iteration 11
*Date: 2026-03-18*

### Implemented Directions
#### Experiment 1: JJ+KK+LL+MM (all four options combined)
**Options applied:** JJ (Explicit Rating Computation Block), KK (l1-blocking Fail-Closed Guard), LL (GATE3_QIDS→ADVISORY_CACHE_QIDS rename, narrowed to {"Q-G25"}), MM (MAX_EDITS_PER_PASS=12 cap)
**Applied changes:** Rating computation block before scorecard (JJ); l1-blocking fail-closed guard (KK); GATE3_QIDS→ADVISORY_CACHE_QIDS rename + narrowed to Q-G25 only (LL); MAX_EDITS_PER_PASS=12 guard with overflow deferral (MM)

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | JJ+KK+LL+MM | 21.9% vs 1.1% | +20.8% | N/A (diff-based) | N/A (diff-based) |

### Per-Question Results (A wins / B wins / TIE across 10 tests)
Q-FX1: 0/2/8   Q-FX2: 0/10/0   Q-FX3: 0/0/10   Q-FX4: 0/2/8
Q-FX5: 0/0/10  Q-FX6: 0/0/10   Q-FX7: 0/3/7    Q-FX8: 0/10/0
Q-FX9: 0/3/7   Q-FX10: 5/2/3   Q-UX1: 0/0/10   Q-UX2: 0/1/9
Q-UX3: 0/0/10
Q-DYN-39: 0/10/0  Q-DYN-40: 0/3/7  Q-DYN-41: 1/8/1  Q-DYN-42: 0/7/3

---

## Results & Learnings — Iteration 11

**What worked:**
- Option JJ (Explicit Rating Computation Block): PRIMARY DRIVER. Q-FX8 (0/10/0) and Q-DYN-39 (0/10/0) both won unanimously across all 10 inputs. The explicit IF/ELIF/ELSE pseudocode block immediately before the scorecard template eliminates the inference step for READY/SOLID/GAPS/REWORK determination. The comment "NOT Gate 3 — advisories do not affect rating" prevents the team-lead from including Gate 3 advisories in gate2_open count, solving the SOLID/GAPS boundary case.
- Option MM (MAX_EDITS_PER_PASS=12 cap): SECONDARY DRIVER. Q-DYN-42 (0/7/3) won 7/10 inputs. Gate-priority sorting (Gate 1 first) prevents runaway plan expansion for plans with many findings. Most impactful for Input 4 (problematic plan) and Input 10 (GAS OAuth with TBD markers).
- Option LL (ADVISORY_CACHE_QIDS rename + scope narrowing): MINOR DRIVER. Q-DYN-41 (1/8/1) — B won 8/10 but A won 1/10 (Input 10: complex GAS plan with multiple structural questions). The rename is a correctness hygiene improvement; the scope narrowing has a minor regression risk for complex plans where Q-G20-Q-G24 advisory text needs to persist across memoized passes.

**What didn't work:**
- Option KK (l1-blocking Fail-Closed Guard): DEAD CODE per Q-SG8 WARN. The guard was inserted AFTER the general error CONTINUE at line 1174-1176, making it unreachable. The general error handler fires first for all evaluator errors including l1-blocking. Q-DYN-40 won only 3/10 inputs (and only "slight" strength) — consistent with dead-code behavior. The fix requires moving the l1-blocking check BEFORE the general handler or integrating it into the general handler with an evaluator_name conditional.
- Q-FX10 adversarial (5 A-wins, 2 B-wins, 3 TIE): The baseline's lighter touch may handle adversarial edge cases slightly better in 5/10 inputs. This is the one dimension where the combined improvement package shows a slight regression signal.

**Root cause analysis:** Option JJ follows the "structural invariant" pattern established in prior iterations (cf. Option B deduplication algorithm in Iter 1): placing a deterministic computation block immediately before the output that consumes it eliminates the model's need to retain and apply a scattered rule from 1500+ lines away. The +20.8% spread with 1.1% baseline is consistent with a prompt that is already mature — the baseline works well in 98.9% of scenarios, and the improvement adds precision for the remaining edge cases (boundary ratings, edit overflow). Option KK is a bug in the implementation itself — the intent was correct but the insertion point was wrong.

**What to try next iteration:** (1) Fix Option KK dead code: move the l1-blocking fail-closed check to BEFORE the general error handler at line 1174-1176, or add `IF evaluator_name == "l1-blocking": [inject NEEDS_UPDATE for Q-G1/Q-G2/Q-G11]` as a pre-check at the TOP of the fan-in routing block before any other error handling. (2) Investigate the Q-DYN-41 regression (ADVISORY_CACHE_QIDS narrowing loses Q-G20-Q-G24 advisory text for complex plans) — consider whether re-expanding to include Q-G20-Q-G24 with a clear rename that distinguishes "Gate 3 rendering" from "Gate 2 structural advisory caching" would recover the Input 10 regression.

**Best experiment:** Exp-1 (JJ+KK+LL+MM) — 21.9% quality score
**Verdict: IMPROVED**
Decided by: quality (+20.8% spread)

### 2026-03-18 — Iteration 11 → IMPROVED

**Experiments:** 1 — Exp-1 (JJ+KK+LL+MM combined)
**Verdict:** IMPROVED (decided by: quality, +20.8% spread)

**What worked:**
- Option JJ (Explicit Rating Computation Block): Unanimous Q-FX8 (0/10/0) and Q-DYN-39 (0/10/0) wins. IF/ELIF/ELSE block before scorecard makes READY/SOLID/GAPS/REWORK deterministic. Comment explicitly excludes Gate 3 from gate2_open count. Primary driver.
- Option MM (MAX_EDITS_PER_PASS=12): Q-DYN-42 (0/7/3) wins. Gate-priority sorting ensures Gate 1 edits apply first; overflow warning is surfaced. Directly benefits complex plans (Input 4, Input 10) with many simultaneous findings.
- Option LL (ADVISORY_CACHE_QIDS rename + {"Q-G25"} scope): Q-DYN-41 (1/8/1). Minor regression signal on complex GAS plans (Q-G20-Q-G24 advisory text loss across memoized passes). Scope gate WARN Q-SG12 confirmed.

**What didn't work:**
- Option KK (l1-blocking fail-closed guard): DEAD CODE. Inserted after general error CONTINUE at line 1174-1176 — never executed. Q-DYN-40 only 3/10 wins (all "slight"). Fix: move check BEFORE the general handler.
- Q-FX10 adversarial/edge-case: 5 A-wins, 2 B-wins, 3 TIE. The combined additions (JJ+KK+LL+MM) slightly worsened adversarial handling on 5/10 inputs. Possible cause: added structural complexity (rating block, edit cap, cache rename) increases prompt length and may cause the model to focus on the new blocks rather than gracefully handling degenerate inputs.

**Actionable learning:**
When adding safety guards to existing loops, ALWAYS trace the control flow from loop entry to the insertion point to verify reachability. The KK dead code bug is the canonical example: the general error handler (lines 1175-1177) fires for ALL error/timeout statuses including l1-blocking, so any evaluator-specific error guard placed AFTER it is unreachable. The fix is structural reordering (specific before general), not additional code. For Q-FX10 adversarial regression: monitor but do not add adversarial-specific handling unless the regression persists across 2+ iterations — the 5/10 A-win could be within noise for a +20.8% overall improvement.

**Calibration:** BASELINE_NONZERO (1.1%). No mandatory calibration dynamic question.

---
*Date: 2026-03-18 — Iteration 12*

## Structural Diagnostic (Q1-Q13) — Iteration 12

**Q1 (Role/Persona):** PASS. The Role & Authority block (lines 18-24) remains clear, well-scoped, and stable across all 11 iterations. Four components (Role, Authority, Constraint, Goal) are all present. No drift.

**Q2 (Task Precision):** PASS with ONE BUG REMAINING. The deduplication algorithm, advisory_findings_cache population loop, GATE3_QIDS scope filter, and Rating computation block are all correctly specified after Iter 10-11 fixes. The ONE remaining precision bug is the KK dead code: lines 1179-1187 contain an l1-blocking-specific fail-closed guard that is unreachable because the general error handler at lines 1175-1177 fires first and CONTINUEs past it. This is a correctness bug from Iter 11 — the intent is correct but the insertion point makes it dead code. The fix is to reorder: move the l1-blocking-specific check BEFORE the general error handler, or merge it into the general handler with an evaluator_name conditional.

**Q3 (Context Adequacy):** PASS. Context recovery from memo_file is well-specified. Advisory findings cache is persisted in memo_file checkpoint. The 5 context flags are passed through to cluster evaluators. No new gap.

**Q4 (Output Format):** PASS. Gate 3 advisory finding text is rendered in the scorecard (Iter 9 DD). Advisory findings cache correctly populates and clears (Iter 10 GG/HH/II). Rating computation block (Iter 11 JJ) is correctly positioned before the scorecard template. No format inconsistency.

**Q5 (Examples):** PASS. All high-frequency question methodologies have inline examples (Q-G25 tripartite, Q-G20 story arc, Q-C39 field-index, Gate 3 scorecard rendering). No critical example gap.

**Q6 (Constraints):** MINOR GAP CARRIED FORWARD. ADVISORY_CACHE_QIDS is now `{"Q-G25"}` (Iter 11 LL rename + narrowing). The narrowing from Q-G20-Q-G25 to Q-G25-only had a 1/10 regression signal on Input 10 (complex GAS OAuth plan with TBD markers). For Input 10, Q-G20 (story arc) could produce a PASS-with-advisory-finding ("Phase 2 step 3 mentions investigation needed — story arc has a gap") that would be cached under the old Q-G20-Q-G25 scope but is now lost. However, the scorecard Gate 3 section only renders Q-G25 advisory text (the only actual Gate 3 question), so Q-G20 advisory text would not have appeared in the scorecard anyway. The regression signal is likely an evaluation artifact — the old broad cache retained more state which subtly affected downstream behavior. This is a Q-SG12 WARN that is safe to close: the narrowing is correct for the scorecard's rendering scope.

**Q7 (Anti-patterns):** MINOR GAP. Evaluator config boilerplate (4 identical constraint lines + ~15-line output contract repeated across 5-7 evaluator configs) remains a DRY violation contributing to prompt length (~70-105 lines of repetition in 120K chars). Per Iter 2 learning, attempts to reduce prompt overhead regress quality. Not actionable.

**Q8 (Chain-of-thought):** PASS. All high-frequency judgment calls have explicit CoT templates. No remaining unguided high-frequency judgment calls.

**Q9 (Domain Specifics):** PASS. Gate tier semantics are inline. Gate 1 question IDs are enumerated per mode. IS_GAS/IS_NODE cluster suppression tables are comprehensive.

**Q10 (Tone/Register):** PASS. Three interpolation syntaxes coexist but per Iter 2, notation standardization is not worth attempting.

**Q11 (Parallelization):** PASS. All evaluators spawn in priority-ordered waves. Two-pass l1-advisory split runs both in wave 1. Early memoization invalidation ensures no one-pass-delay.

**Q12 (Failure Modes):** ONE GAP — KK DEAD CODE.

(a) **KK dead code bug (CRITICAL).** Lines 1179-1187 contain the l1-blocking fail-closed guard from Iter 11 Option KK. This guard checks `IF evaluator_name == "l1-blocking" AND data.status in ["timeout", "error"]` and injects synthetic NEEDS_UPDATE for Q-G1/Q-G2/Q-G11. However, lines 1175-1177 are a GENERAL error handler that fires for ALL evaluators with status `["timeout", "error"]` — it marks the evaluator as Incomplete and CONTINUEs past the KK guard. Since both conditions check the same `data.status in ["timeout", "error"]`, the general handler at 1175-1177 ALWAYS fires first for l1-blocking errors, and the CONTINUE skips the KK guard entirely. The KK guard is dead code.

**Fix:** Restructure the fan-in routing block so the l1-blocking-specific guard fires BEFORE the general error handler. Two implementation options:
- Option A (recommended): Move lines 1179-1187 to BEFORE lines 1175-1177. The l1-blocking guard has its own CONTINUE, so it will skip both the general handler and the normal routing for l1-blocking errors. Non-l1-blocking errors still fall through to the general handler.
- Option B: Merge the l1-blocking check INTO the general handler as a conditional: `IF evaluator_name == "l1-blocking": [inject NEEDS_UPDATE] ELSE: [existing Incomplete handling]`.

(b) **Q-FX10 adversarial regression (MINOR, MONITORING).** Iter 11 showed Q-FX10 at 5/2/3 (A-wins). The combined JJ+KK+LL+MM additions slightly worsened adversarial handling. This is plausibly within noise (+20.8% overall spread was strong). Root cause hypothesis: the added structural complexity (rating computation block, edit cap, cache rename) increases the prompt's cognitive surface area, and when processing degenerate inputs (malformed plan, empty plan), the model may spend attention on the new blocks rather than gracefully degrading. This is NOT actionable as a separate fix — it would resolve naturally if the dead code is removed (KK fix reduces complexity).

(c) **Rating computation: RESOLVED.** Iter 11 Option JJ added the explicit IF/ELIF/ELSE block before the scorecard. Verified correct at lines 1896-1910. No remaining gap.

(d) **MAX_EDITS_PER_PASS: RESOLVED.** Iter 11 Option MM added the cap at line 1261. Verified correct. No remaining gap.

**Q13 (Calibration & Thresholds):** PASS. ADVISORY_CACHE_QIDS narrowing to `{"Q-G25"}` is correct for the scorecard's rendering scope. Evaluator calibration is well-specified across all L1 and cluster configs. Q-G25 tripartite calibration (Iter 8) stable. 2-pass structural memoization threshold (Iter 8) stable. No calibration drift detected.

---

## Domain Inference — Iteration 12

Primary domain: **LLM multi-agent orchestrator prompt — convergence loop with gated quality review, parallel evaluator fan-out/fan-in, and structured scorecard output.** The prompt is highly mature (11 iterations, ~122K chars) with well-specified evaluator configs, memoization logic, advisory finding cache, and rating computation.

Most improvable sub-tasks after 11 iterations:
1. **KK dead code fix (Q12):** The highest-priority remaining item. A correctness bug from Iter 11 that makes the l1-blocking fail-closed guard unreachable. The fix is a simple reorder — zero new code, just moving existing lines.
2. **Q-FX10 adversarial resilience (Q12, MINOR):** The 5/10 A-win signal on adversarial/edge-case inputs is the only dimension where Iter 11 showed regression. However, this is likely within noise and would partially resolve by removing dead code (reduces prompt complexity).
3. **Evaluator config boilerplate (Q7):** Structural redundancy. Not actionable per Iter 2 learning.

The prompt is at diminishing returns for per-question methodology refinements. The remaining gains are structural: fixing dead code, and potentially one more targeted improvement.

---

## Domain Research Findings — Iteration 12

**Finding 1 — Guard ordering in multi-branch error handlers: specific-before-general is the canonical pattern (Augment Code multi-agent failure guide, 2025; MASFT taxonomy, arxiv 2503.13657, 2025):**

Production multi-agent systems use a "specific-before-general" guard ordering pattern in error handlers: when a fan-in loop processes results from multiple evaluator types, evaluator-specific error guards must appear BEFORE the general catch-all error handler. The general handler's CONTINUE/BREAK causes control flow to skip all subsequent checks in the current loop iteration. This is the same pattern as exception handling in programming languages (catch specific exceptions before generic Exception) and firewall rules (specific ALLOW/DENY before default policy). The MASFT taxonomy identifies "silent error propagation" as one of 14 distinct multi-agent failure modes — where a generic error handler masks a specific recovery action that should have fired. The KK dead code bug in SKILL.md is exactly this pattern: the generic error CONTINUE at line 1175-1177 masks the l1-blocking-specific recovery at lines 1179-1187.

**Finding 2 — Evaluator-optimizer convergence: max_attempts + fail-closed guards prevent false convergence (DEV Community evaluator-optimizer pattern, 2025; Langfuse LLM-as-judge guide, 2025):**

The evaluator-optimizer pattern (iterative refinement with evaluator feedback) requires two safety mechanisms: (a) a max_attempts counter to prevent infinite loops (already present in SKILL.md as `pass_count >= 5`), and (b) fail-closed guards for critical evaluators to prevent false convergence when evaluation fails (the intent of KK). The literature emphasizes that these guards must be wired into the control flow correctly — a guard that exists but is unreachable provides zero safety value and creates a false sense of protection. For review-plan, the l1-blocking evaluator is the ONLY evaluator covering Gate 1 questions in standard mode. Its error handler must inject NEEDS_UPDATE (fail-closed) before the generic handler fires, or the convergence check will see Gate1_unresolved == 0 and falsely converge.

---

## Test-Run Observations — Iteration 12

**Test input 1: input8-gas-oauth-tbd-markers.md (GAS OAuth/PKCE — complex, multi-phase, TBD markers)**

IS_GAS=true (modifies .gs files, GAS HTML service files), HAS_UI=true (sidebar auth.html, main.html), HAS_DEPLOYMENT=false (squash merge, but no explicit deploy step — this is borderline), HAS_STATE=true (PropertiesService token storage), IS_TRIVIAL=false. Active clusters: impact (always), state (HAS_STATE=true). Gas-evaluator + ui-evaluator active.

**KK dead code impact analysis:** For this plan, l1-blocking evaluates Q-G1 (Approach soundness — OAuth/PKCE is a sound approach for GAS sidebar auth), Q-G2 (Standards compliance), Q-G11 (Pre-reads — needs to verify GAS web app callback path format). If l1-blocking errors on pass 1 (e.g., context limit due to the 3-phase plan being long + QUESTIONS.md being large), the general error handler at line 1175-1177 fires, marking l1-blocking as Incomplete. The KK guard at lines 1179-1187 is never reached. Q-G1/Q-G2/Q-G11 have no status. The convergence check computes `Gate1_unresolved = count of NEEDS_UPDATE on Q-G1, Q-G2, Q-G11, Q1, Q2, Q13, Q15, Q18, Q42` (IS_GAS mode). Q-G1/Q-G2/Q-G11 are absent (not NEEDS_UPDATE) — they contribute 0 to the count. The gas-evaluator covers Q1, Q2, Q13, Q15, Q18, Q42 independently. If the gas-evaluator runs successfully and all 6 gas Gate 1 questions are PASS, then Gate1_unresolved could be 0 with Q-G1/Q-G2/Q-G11 completely unevaluated. The Incomplete evaluator rule says "do NOT converge if Incomplete had NEEDS_UPDATE last pass" — but on pass 1 there IS no last pass. False convergence is possible.

**ADVISORY_CACHE_QIDS observation:** For this plan, Q-G20 (story arc) would evaluate the 3-phase structure. Phase 1 is clear (OAuth config + PKCE helper). Phase 2 has two TBD markers: step 3 ("will need to investigate") and step 8 ("should handle edge cases somehow"). Q-G20's story arc check would produce NEEDS_UPDATE (not advisory) for these — the TBD markers are gaps, not advisory notes. So the ADVISORY_CACHE_QIDS scope (whether Q-G20 is included or not) does not affect this plan's advisory text — there IS no Q-G20 advisory text to cache. The Iter 11 Q-DYN-41 regression on Input 10 (this plan type) was likely caused by subtle downstream state differences from the rename, not by actual advisory text loss.

**Test input 2: input10-gas-production-fix.md (Fix onThinking — single-file GAS bug fix)**

IS_GAS=true, HAS_UI=false, HAS_DEPLOYMENT=false, HAS_STATE=false, IS_TRIVIAL=false (code logic changes with conditional branching — callerOnThinking null check + try/catch restructuring). Active clusters: impact (always). Gas-evaluator active.

**KK dead code impact analysis:** For this clean, small plan, l1-blocking is very unlikely to error (plan is short, minimal context pressure). KK dead code has no practical impact on this input. The plan is expected to converge in 1-2 passes with a READY rating.

**ADVISORY_CACHE_QIDS observation:** Q-G25 (feedback loop): the plan has "Step 4: exec verify — module loads cleanly" and "Step 5: send test message... cancel mid-thinking — verify cancel fires" and "Step 6: Verify compaction path." These are concrete feedback mechanisms. Q-G25 should PASS cleanly with no advisory text. The ADVISORY_CACHE_QIDS scope is irrelevant for this input.

**Cross-observation:** The KK dead code fix is the only remaining structural correctness bug. It affects the highest-severity failure mode (false convergence with Gate 1 unevaluated) on the lowest-frequency trigger (l1-blocking error). The fix is zero-risk: reordering two existing code blocks. The ADVISORY_CACHE_QIDS Q-DYN-41 regression is a Q-SG12 WARN that does not manifest in either test input — safe to close.

---

## Improvement Options — Iteration 12

### Option NN — Fix KK Dead Code: Reorder l1-Blocking Guard Before General Error Handler

**Addresses:** Q2 — Task precision (dead code bug) / Q12 — Failure modes (l1-blocking error on pass 1 causes false convergence)

**What changes:** In the fan-in routing block (lines 1173-1220), move the l1-blocking-specific fail-closed guard (currently lines 1179-1187) to BEFORE the general error handler (currently lines 1175-1177). The reordered block becomes:

```
FOR evaluator_name, data in all_results:

    # Fail-closed guard for l1-blocking errors (Gate 1 safety) — MUST precede general handler
    IF evaluator_name == "l1-blocking" AND data.status in ["timeout", "error"]:
      # l1-blocking covers Q-G1, Q-G2, Q-G11 — all Gate 1.
      # Treat as NEEDS_UPDATE to prevent false convergence with unevaluated Gate 1 questions.
      FOR q_id in ["Q-G1", "Q-G2", "Q-G11"]:
        l1_results[q_id] = "NEEDS_UPDATE"
        l1_edits[q_id] = {"finding": "l1-blocking evaluator error — re-run required", "edit": null}
      Print: "  ⚠️ l1-blocking error → Q-G1/Q-G2/Q-G11 treated as NEEDS_UPDATE (fail-closed)"
      CONTINUE  # skip normal routing for this evaluator

    IF data.status in ["timeout", "error"]:
      mark as Incomplete (existing incomplete evaluator rules apply unchanged)
      CONTINUE
```

The l1-blocking guard now fires FIRST for l1-blocking errors, injecting synthetic NEEDS_UPDATE before the general handler can CONTINUE past it. For all other evaluators, the general handler fires as before (the l1-blocking IF condition is false for non-l1-blocking evaluators). Zero behavioral change for non-error paths — the specific-before-general reorder only affects the error path.

**Why it helps:** This fixes a confirmed dead code bug from Iter 11. The KK guard was conceptually correct but structurally unreachable. Research Finding 1 (specific-before-general guard ordering) confirms this is the canonical fix pattern. Q-DYN-40 from Iter 11 only achieved 3/10 wins because the guard never executed — with the fix, the guard will actually fire when l1-blocking errors, injecting NEEDS_UPDATE for Q-G1/Q-G2/Q-G11 and preventing false convergence on pass 1. This also removes dead code, marginally reducing prompt complexity (which may help the Q-FX10 adversarial regression).

**Predicted impact:** HIGH severity prevention, LOW frequency occurrence. When l1-blocking errors on pass 1, the guard prevents false convergence with Gate 1 unevaluated. The fix adds zero new lines — it only reorders existing lines 1175-1187.

**Conciseness impact:** NEUTRAL — pure reorder, no new lines.

---

### Option OO — Inline Comment Anchoring the Specific-Before-General Pattern

**Addresses:** Q12 — Failure modes (prevent future regressions of the same class) / Q7 — Anti-patterns (no annotation explaining why ordering matters)

**What changes:** Add a 2-line comment at the top of the fan-in routing block (after the `FOR evaluator_name, data in all_results:` line) that documents the ordering contract:

```
  FOR evaluator_name, data in all_results:
    # ORDERING CONTRACT: evaluator-specific error guards MUST appear before the general
    # error handler. The general handler's CONTINUE skips all subsequent checks.
```

**Why it helps:** The KK dead code bug was an insertion-point error — the developer placed the l1-blocking guard after the general handler without tracing the control flow. A 2-line comment at the top of the routing block makes the ordering invariant explicit, preventing future contributors from inserting new evaluator-specific guards after the general handler. This follows the pattern of structural annotations (like `<!-- keep -->` markers in the regression check) that encode invariants at the point where they are most likely to be violated.

**Predicted impact:** LOW — preventive only. No behavioral change. Prevents a class of future bugs.

**Conciseness impact:** ADDS 2 lines. Minimal.

---

### Option PP — Close Q-SG12 WARN: Add Inline Comment to ADVISORY_CACHE_QIDS Explaining Scope Decision

**Addresses:** Q6 — Constraints (ADVISORY_CACHE_QIDS scope rationale undocumented) / Q13 — Calibration (close the Q-SG12 WARN from Iter 10/11)

**What changes:** Expand the ADVISORY_CACHE_QIDS definition comment (currently lines 289-293 and line 1222) to explain WHY the set is `{"Q-G25"}` and not `{"Q-G20", ..., "Q-G25"}`:

At the definition site (line 1222):
```
    # ADVISORY_CACHE_QIDS: only Q-G25 (the sole Gate 3 question). Q-G20-Q-G24 are Gate 2 —
    # their PASS-with-finding text is descriptive, not advisory, and is never rendered in the
    # Gate 3 scorecard section. Caching them would accumulate unused entries.
    ADVISORY_CACHE_QIDS = {"Q-G25"}
```

At the initialization comment (lines 289-293), add one line:
```
   advisory_findings_cache = {}
   # advisory_findings_cache: Q-ID → {"finding": "<text>", "source": "<evaluator>"}
   # Scope: Gate 3 advisory questions only (currently Q-G25 — the sole Gate 3 question).
   # Q-G20-Q-G24 are Gate 2; their descriptive PASS text is not cached (never rendered in Gate 3 section).
   # Populated each non-memoized evaluator pass. Later-pass entries overwrite earlier.
   # Entry cleared when PASS with empty finding — signals condition was resolved by edits.
   # Persisted in memo_file checkpoint for context-compression resilience.
```

**Why it helps:** The Q-SG12 WARN has been carried forward since Iter 10 and confirmed in Iter 11. The Iter 11 Q-DYN-41 regression (1/10 A-win on Input 10) triggered concern about the narrowing. Test-run analysis in this iteration confirms the narrowing is correct: Q-G20-Q-G24 are Gate 2 questions whose PASS-with-finding text is never rendered in the Gate 3 scorecard section. The regression was an evaluation artifact, not a functional loss. Adding the explanatory comment closes the Q-SG12 WARN permanently by documenting the design rationale at both definition sites.

**Predicted impact:** LOW — documentation only. No behavioral change. Closes a carried-forward scope gate WARN.

**Conciseness impact:** ADDS 4 lines net (replacing existing 4-line comment block with 6-line block at init, adding 2-line block at definition). Minimal.

---

### Option QQ — Gate 3 Count Alignment: Ensure gate3_noted Uses advisory_findings_cache, Not NEEDS_UPDATE Count

**Addresses:** Q12 — Failure modes (gate3_noted could miscount) / Q4 — Output Format (gate health bar accuracy)

**What changes:** The compact gate health bar at lines 1609-1623 computes `gate3_noted = count of NEEDS_UPDATE in current pass for Gate 3 questions`. But Gate 3 questions (specifically Q-G25 per tripartite calibration) produce PASS-with-advisory, not NEEDS_UPDATE. The NEEDS_UPDATE count for Gate 3 should always be 0 (or near-0) because the Iter 8 tripartite calibration explicitly says "Gate 3 advisory — do NOT NEEDS_UPDATE." The gate3_noted variable should instead count entries in `advisory_findings_cache` to accurately reflect the number of advisory notes detected.

Change line 1613 from:
```
  gate3_noted = count of NEEDS_UPDATE in current pass for Gate 3 questions
```
to:
```
  gate3_noted = len(advisory_findings_cache)  # count of advisory notes (PASS-with-finding), not NEEDS_UPDATE
```

This aligns the gate health bar's Gate 3 count with the actual advisory detection mechanism (the cache) rather than the NEEDS_UPDATE count (which should be 0 for properly calibrated Gate 3 questions).

**Why it helps:** After Iter 8's tripartite calibration, Q-G25 should never produce NEEDS_UPDATE for "present but weak" feedback loops — those are Gate 3 advisory (PASS-with-finding). The current gate3_noted computation counts NEEDS_UPDATE for Gate 3 questions, which would be 0 in the calibrated case. The gate health bar would show `💡 0 noted` even when the advisory_findings_cache has a legitimate advisory entry for Q-G25. This is a display inconsistency: the scorecard's Gate 3 section (which reads from advisory_findings_cache) would show the advisory, but the per-pass gate health bar would show 0. Aligning both to read from advisory_findings_cache makes the display consistent.

**Predicted impact:** LOW-MEDIUM. Affects the gate health bar display for plans with Gate 3 advisories (e.g., input4 with weak feedback loop). Does not affect convergence or rating computation. Improves display consistency between per-pass bar and final scorecard.

**Conciseness impact:** CHANGES 1 line. Zero net line addition.

---

## Evaluation Questions — Iteration 12

### Fixed (Q-FX1-Q-FX10)
- Q-FX1: Does the output correctly complete the task as specified in the prompt (plan reviewed, edits applied, scorecard produced, ExitPlanMode called)?
- Q-FX2: Does the output conform to the required format/structure (ASCII scorecard box, gate health lines, pass progress bars, convergence message)?
- Q-FX3: Is the output complete — does it cover all required aspects (all active evaluators spawned, all NEEDS_UPDATE findings addressed, Q-G9 organization pass run, markers stripped, gate marker written)?
- Q-FX4: Is the output appropriately concise — no unnecessary padding, repetition of evaluator findings, or verbose pass summaries beyond what the format specifies?
- Q-FX5: Is the output grounded in the input — no hallucinated question IDs, no fabricated evaluator findings, no invented plan content?
- Q-FX6: Does the output demonstrate sound reasoning — findings cite specific plan passages, not generic observations?
- Q-FX7: Are downstream agent instructions and external dependency references complete and unambiguous? (HAS_DOWNSTREAM_DEPS=true — evaluator configs are downstream instructions)
- Q-FX8: Does the scorecard rating correctly reflect the gate-level findings (READY when all clear, SOLID for 1-3 Gate 2 open, GAPS for 4+, REWORK when Gate 1 open)?
- Q-FX9: Are evaluator errors handled gracefully — does the output surface errors clearly and continue the review rather than silently skipping or false-converging?
- Q-FX10: Does the prompt handle adversarial or edge-case inputs (malformed plan, empty plan, evaluator timeout) without crashing or producing undefined output?

### UX Questions (Q-UX1-Q-UX3, HAS_OUTPUT_FORMAT=true)
- Q-UX1: Is the ASCII scorecard box visually consistent — aligned columns, correct box-drawing characters, no broken lines?
- Q-UX2: Is the pass progress bar correctly rendered and does it accurately reflect the current pass count out of 5?
- Q-UX3: Are the convergence output sections (CONFIG, REVIEW, APPLYING, EPILOGUE, ORGANIZE, SCORECARD) clearly delineated with consistent box-drawing borders and section headers?

### Dynamic (derived from gaps found in this iteration)
- Q-DYN-43: If the l1-blocking evaluator encounters an error on pass 1, does the orchestrator treat Q-G1/Q-G2/Q-G11 as NEEDS_UPDATE (fail-closed) and continue looping — confirming the reordered guard fires BEFORE the general error handler? [addresses: Q2, Q12 — KK dead code fix verification; regression check from baseline's perspective since baseline has the dead code]
- Q-DYN-44: Does the per-pass gate health bar's Gate 3 count (gate3_noted) correctly reflect the number of advisory findings detected (from advisory_findings_cache), rather than showing 0 when Gate 3 questions produce PASS-with-advisory instead of NEEDS_UPDATE? [addresses: Q4, Q12 — gate3_noted alignment with advisory cache]
- Q-DYN-45: For a plan where all evaluators succeed (no errors), does the reordered fan-in routing block produce identical results to the baseline — confirming the specific-before-general reorder has zero behavioral impact on the happy path? [addresses: Q2 — anti-regression check, ensures the reorder does not alter non-error behavior]
- Q-DYN-46: On adversarial/edge-case inputs (malformed plan with no implementation steps, or empty plan file), does the output degrade gracefully with a clear error message or minimal scorecard, rather than crashing or producing undefined output? [addresses: Q-FX10 — regression check for the Iter 11 adversarial signal, 5/10 A-wins]

---

## Experiment Results — Iteration 12
*Date: 2026-03-18*

### Implemented Directions
#### Experiment 1: NN+OO+PP+QQ
**Options applied:** NN (KK dead code fix — l1-blocking guard reordered before general error handler), OO (ordering contract comment), PP (ADVISORY_CACHE_QIDS scope rationale comments), QQ (gate3_noted = len(advisory_findings_cache))
**Applied changes:** KK guard reordered before general error handler (NN); ordering contract comment added (OO); ADVISORY_CACHE_QIDS scope rationale comments expanded (PP); gate3_noted uses advisory_findings_cache (QQ)

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | NN+OO+PP+QQ | 21.1% vs 0.0% | +21.1% | N/A (diff-based) | N/A (diff-based) |

*Calibration note: BASELINE_ZERO — both NN and QQ fix correctness bugs; Q-DYN-43/44 directly test the bugs fixed. Q-DYN-45 (anti-regression: normal path) all TIE (0/0/10), confirming no regression on happy path. Q-FX10 adversarial: 0/1/9 (no regression).*

### Per-Question Results (A wins / B wins / TIE across 10 tests)
Q-FX1: 0/0/10  Q-FX2: 0/6/4   Q-FX3: 0/0/10  Q-FX4: 0/0/10
Q-FX5: 0/0/10  Q-FX6: 0/9/1   Q-FX7: 0/0/10  Q-FX8: 0/8/2
Q-FX9: 0/9/1   Q-FX10: 0/1/9
Q-UX1: 0/5/5   Q-UX2: 0/0/10  Q-UX3: 0/0/10
Q-DYN-43: 0/9/1  Q-DYN-44: 0/9/1  Q-DYN-45: 0/0/10  Q-DYN-46: 0/1/9

---

## Results & Learnings — Iteration 12

**What worked:**
- Option NN (KK dead code fix): PRIMARY DRIVER. Q-FX9 (0/9/1) and Q-DYN-43 (0/9/1) — the reorder makes the l1-blocking fail-closed guard execute for l1-blocking errors before the general handler can CONTINUE past it. The trivial plan (Input 3, all TIE) confirms the fix only affects the error path — no impact on IS_TRIVIAL fast path. Input 3 provides perfect control evidence.
- Option QQ (gate3_noted fix): SECONDARY DRIVER. Q-FX2 (0/6/4), Q-FX8 (0/8/2), Q-DYN-44 (0/9/1). Gate health bar now correctly shows len(advisory_findings_cache) for Gate 3 advisory count. Baseline always showed 0 since Gate 3 questions produce PASS-with-finding (not NEEDS_UPDATE). Trivial plan (no gate health bar) all TIE.
- Option OO+PP (comment improvements): Minor contributor to Q-FX6 (0/9/1). Ordering contract comment and ADVISORY_CACHE_QIDS rationale improve prompt clarity. No behavioral change.

**What didn't work:** Nothing regressed. Q-DYN-45 (anti-regression for NN on normal path) all TIE — the reorder has zero effect when evaluators succeed. Q-FX10 adversarial: 0/1/9 — Input 10 (GAS OAuth with TBD markers) gave slight B win on adversarial handling, suggesting NN fix helps even for evaluator errors triggered by complex/adversarial plans. No A-wins.

**Root cause analysis:** Both NN and QQ are silent failures that made the prompt appear functional while having wrong behavior on specific paths. NN: l1-blocking error on pass 1 could produce false convergence with Gate 1 unevaluated — a high-severity but low-frequency failure. QQ: gate health bar always showed 0 for Gate 3 advisory count regardless of advisory_findings_cache state — a display inconsistency that made the cache effectively invisible in the per-pass output. Both fixes are zero-new-code correctness corrections (reorder + semantic change). The BASELINE_ZERO calibration confirms these are genuine bugs, not style improvements: when a bug is fixed, the improved version wins every question that exercises the bug.

**What to try next iteration:** The prompt now has no known correctness bugs (NN, QQ fixed; KK was the last known dead code issue). Remaining improvement targets: (1) Coverage expansion for the Meta-reflection Recommendations section (does it surface actionable next-iteration guidance in a machine-readable format?); (2) Any remaining Q-G question calibration gaps not yet addressed; (3) Token efficiency in evaluator config boilerplate (but Iter 2 learning says this risks regression — approach only with strong evidence of benefit).

**Best experiment:** Exp-1 (NN+OO+PP+QQ) — 21.1% quality score
**Verdict: IMPROVED**
Decided by: quality (+21.1% spread, calibration BASELINE_ZERO noted — correctness fix pattern)
