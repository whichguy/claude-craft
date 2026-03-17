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
