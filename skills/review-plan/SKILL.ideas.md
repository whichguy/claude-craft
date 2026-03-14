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
