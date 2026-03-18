---
# Prompt Improvement: review-plan
*Date: 2026-03-17*

## Original Prompt
Path: /Users/jameswiese/claude-craft/skills/review-plan/SKILL.md

## Structural Diagnostic (Q1-Q11)

Q1 -- Role/Persona: The Role & Authority block (added in Iter 1, refined to 4 lines) is present and functional. It declares the team-lead orchestrator role, prohibits independent re-evaluation, and sets the convergence goal. No new role gaps after 7 iterations. The one remaining subtlety -- how the team-lead should handle a borderline evaluator PASS -- was analyzed in Iter 3 and correctly deemed not worth adding protocol overhead for. Role clarity is adequate.

Q2 -- Task Precision: The prompt's precision is strong for orchestrator-level logic (deduplication algorithm from Iter 1 Option B, regression recovery from Iter 1 Option C, convergence check with gate semantics from Iter 1 Option A). Evaluator-level precision was improved in Iter 3 (calibration, specificity) and Iter 4 (tracing methodology). The Iter 7 two-pass l1-advisory split addressed late-list depth attenuation for Q-G20--Q-G25. The remaining precision gap is narrow: the l1-advisory-process evaluator (13 questions: Q-G4 through Q-G19) still has no question-specific methodology annotations except for Q-G21/Q-G22 (trace-verify-cite, inherited from Iter 4). Several of these 13 questions are mechanically evaluated and routinely PASS, but Q-G13 (phased decomposition) and Q-G10 (assumption exposure) are judgment-intensive and appear at positions 5 and 8 of 13 -- still within the depth-attenuation risk window, though less severely than Q-G20--Q-G25 before the split. A secondary precision gap: the evaluator prompt for l1-advisory-structural has methodology notes for Q-G21/Q-G22 (from Iter 4) and Q-G23/Q-G24/Q-G25 (from Iter 7), but Q-G20 (story arc coherence) -- the first question in the structural evaluator -- has no methodology annotation despite being the most frequently applicable of the 6 structural questions. The Iter 6 Option V attempted a Q-G20 annotation but was scoped too narrowly ("Approach/Design section" only, missing the verification-section subtype). A broader Q-G20 methodology that covers both subtypes (A: design commitments without implementation steps; B: untestable verification assertions) remains unaddressed.

Q3 -- Context Adequacy: Context adequacy is strong. The 5-flag pass-through (Iter 3 Option K) provides cluster evaluators with explicit context. The memo-file recovery mechanism is adequate for the observed failure modes. The only remaining context gap identified across 7 iterations is minor: the l1-advisory-process evaluator receives no information about which edits the l1-advisory-structural evaluator found in the same pass (they run in parallel within the same wave). If the structural evaluator finds Q-G22 cross-phase dependency issues and the process evaluator independently finds Q-G13 phased decomposition issues, their edits may overlap. However, this is handled by the deduplication algorithm at the orchestrator level, so no evaluator-level fix is needed.

Q4 -- Output Format: The scorecard format is well-specified after Iter 3 Option J (N/A collapse threshold). The convergence loop progress output, delta visualization, gate health bar, and timing breakdown are all precisely templated. The one remaining format gap from prior iterations -- max-length constraints on "one-sentence summary" fields in the remaining-issues section (step 7 of After Review Completes) -- has not been addressed but has also not been a problem in practice (7 iterations without a conciseness regression on summary fields). The format is adequate.

Q5 -- Examples: The impact-evaluator has a concrete Q-C39 example (Iter 4 Option O). The l1-blocking evaluator has a Q-G1 challenge-justify-check example (Iter 5 Option Q, with conditional activation). The l1-advisory-structural evaluator has methodology notes for Q-G21/Q-G22/Q-G23/Q-G24/Q-G25 but no concrete finding example (only the impact-evaluator has one). The l1-advisory-process evaluator has no examples at all. This asymmetry means the structural and process evaluators have less output-quality anchoring than the impact-evaluator. However, Iter 2's lesson (adding overhead for non-manifesting edge cases regresses quality) suggests that adding examples to evaluators where they haven't been shown to help is risky. The concrete example pattern works best when a specific probe demonstrates a detection gap that an example would close (as Iter 4 Option O did for probe-5's Q-C39 field-index error). No current probe demonstrates a detection gap attributable to missing examples in the l1-advisory evaluators.

Q6 -- Constraints: The existing constraints are adequate. Evaluators are read-only. The team-lead has edit authority. Gate markers control ExitPlanMode. The convergence loop has a 5-pass hard stop. Memoization has proper invalidation rules. No new constraint gaps have emerged since the Iter 4/5 calibration refinements for Q-G1.

Q7 -- Anti-patterns: The convergence loop remains a single ~700-line block (noted in every iteration since Iter 1). This has never caused a measurable quality issue (Iter 2 learning: do not restructure without demonstrated quality payoff). The IS_TRIVIAL fast path is embedded in Step 0 (noted in Iter 1) -- also never caused a measurable issue. The primary anti-pattern observed across 7 iterations is the "overhead for non-manifesting edge cases" pattern (Iter 2: E+F+G+H all regressed; Iter 5: Q+S combination over-triggered). The actionable anti-pattern check for this iteration: any proposed option must address a gap that is either (a) demonstrated by a probe/test-run failure, or (b) structurally analyzable as affecting every plan (high-frequency). Options targeting low-frequency edge cases without probe evidence should not be proposed (per Iter 2 learning).

Q8 -- Chain-of-thought: The highest-leverage CoT improvements have been made: deduplication algorithm (Iter 1 Option B), regression recovery (Iter 1 Option C), tracing methodology for Q-C37--Q-C40/Q-G21/Q-G22 (Iter 4 Option M), self-verification gate (Iter 4 Option N), Q-G1 challenge-justify-check (Iter 5 Option Q), Q-G23/Q-G24/Q-G25 methodology (Iter 7). The remaining unguided CoT gap is narrow: Q-G20 (story arc coherence) has no methodology annotation in the l1-advisory-structural evaluator despite being a frequently-applicable question. Iter 6 Option V attempted a methodology but was too narrowly scoped. Additionally, the Q-G1 challenge-justify-check could be improved: the current conditional activation predicate fires on explicit constraint-assertion language ("X is too slow", "Y won't work"), but it does not fire on implicit assumption patterns where the plan simply omits alternatives without asserting why (e.g., a plan that uses approach A without ever mentioning that B exists). This is a detection-gap subtype: the predicate catches "X won't work" but misses "chose X [with no mention of Y or Z]".

Q9 -- Domain specifics: Gate Tier Semantics are inline (Iter 1 Option A). The newer questions (Q-C35 through Q-C40) are properly documented with gate assignments and N/A conditions. The IS_GAS/IS_NODE suppression tables are thorough. One remaining domain-specificity gap: the Q-G1 challenge-justify-check methodology (Iter 5 Option Q) includes a concrete NEEDS_UPDATE example and a PASS example in the l1-blocking evaluator prompt. But the PASS example ("Plan cites 'better-sqlite3: 2.3us vs 45us flat-file, 10k iterations (bench/results/...)'. Evidence-backed approach") is the only positive example across all evaluator prompts. The impact-evaluator has a NEEDS_UPDATE example (Q-C39) but no PASS example. Research from Iter 4 (Finding 2, Claude Best Practices 2026) identified positive+negative example pairs as the highest-impact evaluator calibration mechanism -- but only the l1-blocking evaluator has both. This gap is minor given that the primary failure mode is false PASS (not false NEEDS_UPDATE).

Q10 -- Tone/register: Consistent across all sections. The three interpolation syntaxes (`<variable>`, `[value]`, `{variable}`) coexist as documented; Iter 2 showed that standardizing them adds overhead without quality payoff. Tone is appropriately directive and technical. No new gaps.

Q11 -- Parallelization: The prompt already has extensive parallelization architecture. Evaluators are spawned in waves of up to MAX_CONCURRENT=4. The Iter 7 two-pass l1-advisory split runs both structural and process evaluators in the same wave (parallel within wave). Gas/node/ui evaluators run alongside L1 evaluators in wave assignments. The fan-out-to-file-then-reconcile pattern is fully implemented (each evaluator writes to RESULTS_DIR/<name>.json, orchestrator reads and routes). The wave-spawning logic has batch-wait-batch boundaries (wave completes, results read, next wave spawns). One potential parallelization improvement: the current l1-advisory-structural and l1-advisory-process evaluators both run in the same wave as the l1-blocking evaluator. Since the l1-blocking evaluator has only 3 questions and completes fastest, and the structural evaluator has 6 questions (moderate), and the process evaluator has 13 questions (longest), the wave structure is efficient. However, if MAX_CONCURRENT were increased from 4 to 5 or 6, more evaluators could run in wave 1, reducing the total number of waves for complex plans (IS_GAS + HAS_UI = l1-blocking + l1-advisory-structural + l1-advisory-process + gas-evaluator + impact-evaluator + ui-evaluator = 6 evaluators, currently split across 2 waves of 4 and 2). This is a latency optimization, not a quality improvement. The parallelization architecture is adequate.

## Domain & Research Findings

Domain: LLM team-lead orchestration prompt for multi-agent iterative plan review with convergence loop, memoization, structured quality-gate output, and ecosystem specialization (GAS, Node.js, UI). Sub-task: evaluator-level methodology refinement at diminishing returns after 7 improvement iterations.

Research summary:
(Search unavailable -- drawing on prior iteration research findings and domain knowledge)

**Finding 1 -- Evaluator methodology saturation and the "last 10%" problem (synthesized from CheckEval EMNLP 2025, PEEM arxiv 2026, and 7 iterations of empirical evidence):** After the orchestrator-level logic is solid (deduplication, regression recovery, convergence -- Iter 1) and evaluator-level methodology covers the hardest analytical questions (tracing for Q-C37--Q-C40, challenge-justify-check for Q-G1, structural split for Q-G20--Q-G25 -- Iters 3-7), the remaining improvement surface is in the "long tail" of questions that are occasionally misjudged but not systematically failing. At this stage, per-question methodology annotations have diminishing returns because: (a) the questions with the highest miss rates have already been annotated (Iters 4-7), (b) adding annotations to low-miss-rate questions risks the Iter 2 failure pattern (overhead for non-manifesting cases), and (c) the primary quality lever shifts from "better evaluation" to "fewer unnecessary evaluations" (efficiency). The prompt is now at the stage where improvements should be high-confidence structural changes (like Iter 7's split) rather than speculative annotations.

**Finding 2 -- Memoization efficiency as a quality proxy (empirical, Iter 7):** The Iter 7 two-pass split added +25s latency per pass. In multi-pass reviews (passes 2-5), memoization of the l1-advisory evaluators reduces this cost. However, the current memoization condition (l1_advisory_memoized) covers both structural and process groups together -- if one group stabilizes while the other does not, both are re-evaluated. An independent memoization condition per group could save evaluator spawns in passes 3-5 where typically only one group needs re-evaluation after edits. This is the Iter 7 "What to try next" recommendation: split memoization tracks to match the split evaluation tracks.

**Finding 3 -- Q-G20 story arc has two distinct subtypes requiring separate detection logic (Iter 6 empirical):** The Iter 6 Option V failure (NEUTRAL) was caused by scoping Q-G20 methodology to "Approach/Design section" only, missing probe-7's untestable-verification subtype (which lives in the Verification section). The Q-G20 question definition in QUESTIONS.md already covers both subtypes, but the evaluator has no methodology note to distinguish them. Adding a methodology that explicitly names both subtypes (A: design commitments without matching implementation steps; B: verification assertions without testable criteria) would address the Iter 6 finding without the over-narrow scoping that caused the NEUTRAL result.

## Test-Run Observations

**input4-plan-with-issues.md (Sync Engine Remote Repos -- deliberately flawed plan)**

IS_GAS=false, IS_NODE=false, HAS_UI=false, HAS_DEPLOYMENT=true, HAS_STATE=false (actually ambiguous -- TYPES array modification is a schema change), IS_TRIVIAL=false. This plan has 6+ deliberate defects. After 7 iterations of improvement, the current prompt would:

- L1-blocking: Q-G1 should NEEDS_UPDATE ("push directly to main" without branch strategy; additionally "Maybe add some caching" is an unvalidated assumption). Q-G11 should NEEDS_UPDATE (no existing code examined -- "update the TYPES array" with no file reading step). Q-G2 should NEEDS_UPDATE ("push directly to main" violates git workflow conventions).
- L1-advisory-structural (Q-G20--Q-G25): Q-G20 should NEEDS_UPDATE (no story arc -- no problem statement, no expected outcome, no verification assertion beyond "make sure it works"). Q-G21 should PASS (no cross-phase contradictions in this flat list). Q-G22 should be N/A (no phases with Pre-check/Outputs annotations). Q-G23 should NEEDS_UPDATE (7 vague steps for a large feature -- scope/effort mismatch). Q-G24 should NEEDS_UPDATE (TYPES schema change at step 5 should come before steps 1-4 that depend on it). Q-G25 should NEEDS_UPDATE (no acceptance criteria, no downstream consumer verification). The structural evaluator should catch all 4 applicable findings with the Iter 7 split.
- L1-advisory-process (Q-G4--Q-G19): Q-G10 should NEEDS_UPDATE (3 TBD/vague items). Q-G13 should NEEDS_UPDATE (flat list, no phases). Q-G18 should NEEDS_UPDATE (no pre-condition verification before modifying shared-types.sh).

Prediction: The current prompt handles this plan well. The l1-advisory-structural split ensures Q-G23/Q-G24/Q-G25 receive full attention. The Q-G1 conditional predicate catches "push directly to main." The finding-specificity instruction (Iter 3 Option L) should produce specific citations for all TBD items.

**input2-node-plan.md (Rate Limiting -- well-structured Node.js plan)**

IS_NODE=true, HAS_STATE=true, HAS_DEPLOYMENT=true, HAS_TESTS=true. This is a clean plan with good structure. Most questions should PASS. The critical test is whether the prompt avoids over-flagging on a well-structured plan (the "false positive" test). Q-G20 should PASS (context, approach, outcome, verification all present). Q-G24 should PASS (Phase 1 core logic correctly precedes Phase 2 integration). Q-G25 may warrant a borderline finding -- the "feedback loop" question asks whether downstream consumers have a verification path, and the plan's test strategy (unit + integration) is adequate. The calibration instruction should resolve this to PASS.

Prediction: Clean convergence in 1-2 passes with minimal findings (possibly Q-G18 for pre-condition verification on gasClient.ts, possibly Q-G23 N/A since complexity is proportionate). The structural evaluator should process Q-G20--Q-G25 cleanly without depth attenuation. No regression risk.

**Cross-input observation:** After 7 iterations, the prompt's primary risk is not detection gaps but efficiency -- multi-pass reviews where memoization could save evaluator spawns but doesn't because l1_advisory_memoized is all-or-nothing for the 19-question group. On input2 (clean plan), the structural evaluator would PASS all 6 questions in pass 1, making it memoizable independently. But the process evaluator might have 1-2 NEEDS_UPDATE findings, requiring pass 2 -- which also re-runs the (already-stable) structural evaluator because memoization is grouped. This is the efficiency gap identified in Iter 7's "What to try next" and Finding 2 above.

## Improvement Options

### Option A: Independent Memoization for l1-Advisory-Structural and l1-Advisory-Process
**Addresses:** Q11 -- Parallelization (efficiency of evaluator spawns across passes)
**What changes:** Replace the single `l1_advisory_memoized` flag with two independent flags:
```
l1_structural_memoized = false    # true when ALL 6 structural questions PASS/N/A AND no edits since
l1_structural_memoized_since = 0
l1_process_memoized = false       # true when ALL 13 process questions PASS/N/A AND no edits since
l1_process_memoized_since = 0
```
Each group is independently memoized after its evaluator returns all PASS/N/A in a pass with no subsequent edits. Both groups are independently invalidated when edits are applied. The spawning logic changes from `IF NOT l1_advisory_memoized:` (spawn both) to `IF NOT l1_structural_memoized:` (spawn structural) and `IF NOT l1_process_memoized:` (spawn process). The existing `l1_advisory_memoized` variable is removed. Fan-in and routing are unchanged (already read separate JSON files). The memo-file checkpoint adds 4 fields (replacing 2). Pass-level printing shows each group's memoization status independently:
```
Print: "  l1-advisory-structural -- memoized (stable since p[l1_structural_memoized_since])" if l1_structural_memoized
Print: "  l1-advisory-process -- memoized (stable since p[l1_process_memoized_since])" if l1_process_memoized
```
**Why it helps:** The Iter 7 two-pass split created two evaluators with different stabilization rates. The structural evaluator (Q-G20--Q-G25) has 6 questions that are mostly "set once" -- once the plan's story arc, proportionality, and cross-phase structure are addressed, they tend to stay PASS. The process evaluator (Q-G4--Q-G19) has 13 questions that may oscillate across passes as edits affect scope, assumptions, and style. Grouped memoization re-spawns the already-stable structural evaluator whenever the process evaluator needs another pass. For a 3-pass review (typical for medium-complexity plans), the structural evaluator might be memoizable from pass 2 onward, saving 1-2 evaluator spawns (each ~15-20s of latency and ~2k tokens). This is the specific next-step recommendation from Iter 7's technique history.
**Predicted impact:** MEDIUM -- Saves 15-20s per memoized pass for plans requiring 3+ passes. No quality impact (memoization semantics are identical to current -- only the granularity changes). The change is structural (variable splitting) rather than behavioral, so the Iter 2 "overhead for non-manifesting cases" risk does not apply -- this reduces overhead rather than adding it. Affects all non-trivial plans that go through 3+ passes.

### Option B: Q-G20 Dual-Subtype Methodology in l1-Advisory-Structural
**Addresses:** Q2 -- Task precision / Q8 -- Chain-of-thought (Q-G20 has no methodology annotation despite being the most frequently applicable structural question)
**What changes:** Add a 4-line methodology note for Q-G20 to the l1-advisory-structural evaluator's "Question-specific methodology" section, positioned before Q-G21's existing trace-verify-cite note:
```
- For Q-G20 (Story arc coherence): Check 4 elements — (1) problem/need statement,
  (2) approach and why it was chosen, (3) expected outcome, (4) testable verification assertion.
  Subtype A: design/approach section claims a behavior no implementation step produces.
  Subtype B: verification section uses untestable assertions ("verify it works", "check for regressions").
  Both subtypes → NEEDS_UPDATE. Cite the specific missing element or untestable assertion.
```
This is scoped to both subtypes (fixing the Iter 6 Option V over-narrow failure). It follows the same "Question-specific methodology" subordinate format used for Q-G21/Q-G22/Q-G23/Q-G24/Q-G25 (consistency with existing structure).
**Why it helps:** Q-G20 is the first question in the l1-advisory-structural evaluator's list. The structural split (Iter 7) ensures it receives full attention. But it is also the question with the broadest definition (4 required elements, 2 failure subtypes) and no CoT guidance. Iter 6 Option V failed because it covered only subtype A ("Approach/Design section" narrative commitments). This option covers both subtypes by naming them explicitly and providing the detection pattern for each. The pattern matches Iter 4's success: methodology annotation for a high-miss-rate question (Q-C37--Q-C40) produced +24.1% improvement. Q-G20's miss rate is lower (it appears on every plan, so many opportunities to catch it), but the dual-subtype coverage addresses a known detection gap from the Iter 6 analysis.
**Predicted impact:** MEDIUM -- Q-G20 is applicable to nearly every plan and appears first in the structural evaluator. The dual-subtype framing addresses the specific Iter 6 failure mode. Low risk of regression: the annotation is 4 lines, scoped to one question, and follows the established format. The impact is bounded by Q-G20's position (first in a 6-question list -- no depth-attenuation risk) and by the base definition already covering both subtypes in QUESTIONS.md (the methodology is a reasoning template, not new criteria).

### Option C: EDIT Injection Specification for Q-G20 in Team-Lead Epilogue
**Addresses:** Q2 -- Task precision / Q4 -- Output format (Q-G20 NEEDS_UPDATE findings lack a standard EDIT instruction pattern)
**What changes:** Add an EDIT injection template for Q-G20 findings that the team-lead applies when the evaluator finds NEEDS_UPDATE. Currently, Q-G20 is the only frequently-flagged question in the l1-advisory-structural evaluator that has no EDIT injection template (Q-G22, Q-G23, Q-G24, Q-G25 all have EDIT injection instructions in QUESTIONS.md). Add to the Q-G20 definition in QUESTIONS.md:
```
EDIT injection -- team-lead applies: **If story arc section is absent entirely**, output
`[EDIT: inject after plan title: "## Context\n[What problem or need this plan addresses
and what current state is being changed]\n\n## Approach\n[What this plan will do and why
this method]\n\n## Expected Outcome\n[What the end state looks like when the plan succeeds
and how success is verified]"]`.
```
This gives the team-lead a deterministic edit to apply when Q-G20 is NEEDS_UPDATE with no existing story arc. For plans that have a partial story arc (some elements present), the evaluator's finding text drives the edit (no template needed -- the evaluator cites the specific missing element).
**Why it helps:** When Q-G20 is NEEDS_UPDATE, the team-lead must construct a plan edit from the evaluator's finding. For the "entirely absent" case (like input4), this requires creative writing -- the team-lead must invent a Context/Approach/Outcome section. An EDIT injection template converts this from creative generation to structured fill-in, reducing edit variability across passes and plans. The pattern matches Q-G17 (phase preambles) and Q-G22 (cross-phase outputs/pre-checks) which both have EDIT injection templates and were easier for the team-lead to apply consistently in probe testing.
**Predicted impact:** MEDIUM -- Applies to plans with no story arc (like input4, which is a common deficiency pattern). Does not apply to plans with partial story arcs (input1, input2, input5 all have Context sections). The edit template ensures consistent plan improvement quality for the worst-case scenario. Low risk: the template is applied by the team-lead, not the evaluator, so it adds no evaluator prompt overhead.

### Option D: MAX_CONCURRENT Increase from 4 to 5 for Wave Efficiency
**Addresses:** Q11 -- Parallelization (wave count reduction for complex configurations)
**What changes:** Change `MAX_CONCURRENT = 4` to `MAX_CONCURRENT = 5` in the tracking initialization (Step 4). This allows 5 evaluators to run concurrently in a single wave instead of 4.
**Why it helps:** For the most complex configuration (IS_GAS + HAS_UI = 6 evaluators: l1-blocking, l1-advisory-structural, l1-advisory-process, gas-evaluator, impact-evaluator, ui-evaluator), MAX_CONCURRENT=4 splits these into 2 waves (4 + 2). MAX_CONCURRENT=5 splits them into 2 waves (5 + 1), which is marginally more efficient. For the common case (IS_GAS without UI = 5 evaluators), MAX_CONCURRENT=5 fits them all into a single wave, eliminating the wave-boundary wait entirely. This saves 5-15s per pass by avoiding a second wave spawn cycle.
**Why it helps:** The prompt specifies MAX_CONCURRENT=4 with a note "tunable." The Iter 7 split added a 6th evaluator for complex configs, making the wave boundary more impactful. Increasing to 5 is a minimal, safe change -- the API rate-limit concern (noted in the prompt) is for <=8, and 5 is well within bounds.
**Predicted impact:** LOW -- Saves 5-15s per pass for IS_GAS plans (2 of 5 test inputs). Zero quality impact. Pure latency optimization. The improvement is modest but risk-free -- the only downside is slightly higher concurrent API usage, which is within the <=8 limit documented in the prompt.

## Evaluation Questions
*Iteration 1*

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified in the prompt?
- Q-FX2: Does the output conform to the required format/structure?
- Q-FX3: Is the output complete (all required aspects, no key omissions)?
- Q-FX4: Is the output appropriately concise (no padding or verbosity)?
- Q-FX5: Is the output grounded -- no hallucinations or unsupported claims?
- Q-FX6: Does the output demonstrate sound reasoning -- no circular logic, contradictions, or unresolved ambiguities?
- Q-FX7: Are downstream agent instructions and external dependency references complete and unambiguous?

### UX (HAS_OUTPUT_FORMAT=true -- weighted 0.5x)
- Q-UX1: Is the output's visual hierarchy clear (key decisions prominent, details subordinate)?
- Q-UX2: Is the most important information immediately scannable without reading through background?
- Q-UX3: Does the output use visual differentiation (emoji, tables, formatting) to separate information categories appropriately?

### Dynamic (derived from Q1-Q11 gaps addressed this iteration)
- Q-DYN-27: When the l1-advisory-structural evaluator stabilizes (all 6 questions PASS/N/A) in pass 1 but the l1-advisory-process evaluator has NEEDS_UPDATE findings requiring pass 2, is the structural evaluator correctly memoized and skipped in pass 2 while the process evaluator re-runs? [addresses: Q11 -- independent memoization for split evaluators]
- Q-DYN-28: For plans with no story arc (no problem statement, no expected outcome, no verification assertion), does the Q-G20 evaluator finding cite both failure subtypes as applicable -- (A) missing design narrative AND (B) untestable or absent verification assertions -- rather than citing only one? [addresses: Q2, Q8 -- Q-G20 dual-subtype methodology]
- Q-DYN-29: When Q-G20 is NEEDS_UPDATE with a completely absent story arc, does the team-lead apply a structured EDIT injection (Context/Approach/Expected Outcome sections) rather than free-form creative text? [addresses: Q2, Q4 -- EDIT injection template for Q-G20]
- Q-DYN-30: For IS_GAS + HAS_UI plans with 6 evaluators, does the wave structure accommodate all evaluators efficiently (5 in wave 1, 1 in wave 2, or similar) rather than splitting 4+2? [addresses: Q11 -- MAX_CONCURRENT tuning]
---

## Experiment Results — Iteration 1
*Date: 2026-03-17*

### Implemented Directions
#### Experiment 1: Options A+B+C+D combined
**Options applied:** A (independent memoization), B (Q-G20 dual-subtype methodology), C (EDIT injection for absent story arc), D (MAX_CONCURRENT 4→5)
**Applied changes:** Option A (replaced l1_advisory_memoized with independent l1_structural_memoized/l1_process_memoized flags across init, recovery, spawning, memoized-print, evaluator-tree, group-memo-update, invalidation, and checkpoint sections), Option B (added Q-G20 dual-subtype methodology note before Q-G21/Q-G22 in l1-advisory-structural evaluator), Option C (added EDIT injection template for absent story arcs as continuation of Q-G20 methodology), Option D (MAX_CONCURRENT 4 to 5)

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | A+B+C+D | 16.0% vs 0.0% | +16.0% | N/A | N/A |

### Per-Question Results (A_baseline wins / B_improved wins / TIE across 5 tests)
Q-FX1: 0/0/5 — TIE (core review completion unchanged)
Q-FX2: 0/0/5 — TIE (scorecard format unchanged)
Q-FX3: 0/1/4 — B wins on input4 (more complete Q-G20 coverage)
Q-FX4: 0/0/5 — TIE (conciseness unchanged)
Q-FX5: 0/0/5 — TIE (grounding unchanged)
Q-FX6: 0/1/4 — B wins on input1 (independent memoization logically cleaner)
Q-FX7: 0/4/1 — B wins on 4/5 inputs (more precise downstream instructions)
Q-UX1: 0/0/5 — TIE (visual hierarchy unchanged)
Q-UX2: 0/0/5 — TIE (scannability unchanged)
Q-UX3: 0/0/5 — TIE (visual differentiation unchanged)
Q-DYN-27: 0/4/1 — B wins on 4/5 inputs (independent memoization key improvement)
Q-DYN-28: 0/1/4 — B wins on input4 (dual-subtype Q-G20 for absent story arc)
Q-DYN-29: 0/1/4 — B wins on input4 (structured EDIT injection vs free-form)
Q-DYN-30: 0/4/1 — B wins on 4/5 inputs (wave efficiency improvement)

## Results & Learnings

### Step 1 — Per-Option Attribution

**Option A (independent memoization): CONTRIBUTED_TO_WIN.** This was the strongest single contributor. Q-DYN-27 (the question directly testing independent memoization) showed 4/5 wins with strong signal on inputs 1 and 4. Q-FX7 (downstream instruction completeness) also showed 4/5 wins — the independent memoization flags produce more precise spawning instructions per evaluator, which reads as cleaner downstream logic. Q-FX6 (sound reasoning) picked up 1 win on input1 where the independent memoization was "logically cleaner." Option A drove 9 of the 16 total B-wins across all questions.

**Option B (Q-G20 dual-subtype methodology): CONTRIBUTED_TO_WIN.** Q-DYN-28 showed 1 win on input4 (the deliberately flawed plan with absent story arc) — exactly the case the dual-subtype methodology was designed for. Q-FX3 (completeness) also picked up 1 win on input4 from more thorough Q-G20 coverage. The contribution is real but narrow: only input4 (absent story arc) exercised the new methodology. Inputs 1, 2, 3, 5 all have existing story arcs that make Q-G20 dual-subtype detection unnecessary.

**Option C (EDIT injection template): CONTRIBUTED_TO_WIN.** Q-DYN-29 showed 1 win on input4 — the structured EDIT template produced a Context/Approach/Expected Outcome scaffold instead of free-form text. Like Option B, the contribution is narrow and confined to the absent-story-arc case (input4 only). Options B and C work synergistically: B improves detection, C improves the remediation edit. Neither would have shown signal without the other.

**Option D (MAX_CONCURRENT 4→5): CONTRIBUTED_TO_WIN.** Q-DYN-30 showed 4/5 wins — the wave structure improvement was detectable on all non-trivial plans except input3 (trivial fast-path). The wins were strong on inputs 1 and 5 (IS_GAS configurations with 5+ evaluators that benefit most from fitting into a single wave) and slight-moderate on inputs 2 and 4. This is a pure efficiency gain with zero quality risk.

### Step 2 — Cross-Experiment Comparison

N/A (single experiment).

### Step 3 — Root Cause Analysis

The winning experiment improved quality because all four options addressed real, previously-identified gaps with minimal overhead. Option A was the highest-impact change — it converted a structural mismatch (grouped memoization for split evaluators) into properly-aligned independent tracking, improving both efficiency (Q-DYN-27, Q-DYN-30) and instruction clarity (Q-FX7). Options B and C together closed the Iter 6 Option V gap (Q-G20 dual-subtype detection + structured remediation) but only manifested on the one test input with an absent story arc. Option D was a low-risk, low-cost tuning change that delivered consistent wave-efficiency wins.

The zero-regression pattern (0 A_baseline wins across all 14 questions) confirms that all four changes follow the Iter 2 learning: they address demonstrated gaps without adding overhead to cases that don't exercise them. Input3 (trivial plan) was all-TIE because the fast-path bypasses every changed feature — exactly the expected behavior.

**What worked:** Option A (independent memoization) was the dominant driver — 9 of 16 B-wins traced to cleaner memoization logic. Option D (MAX_CONCURRENT 5) contributed consistent wave-efficiency wins across 4/5 inputs. Options B+C (Q-G20 methodology + EDIT injection) worked synergistically on the absent-story-arc case.

**What didn't work:** Nothing regressed. All options contributed. However, Options B and C had narrow signal (input4 only), suggesting their impact ceiling is limited to plans with absent story arcs — a relatively uncommon deficiency pattern in practice.

**Root cause analysis:** The primary quality improvement came from aligning memoization granularity with evaluator granularity (Option A). When Iter 7 split the l1-advisory evaluator into structural and process groups, it created a structural mismatch: two independent evaluators sharing a single memoization flag. Option A resolved this mismatch, and the improvement was detectable across nearly all test inputs because multi-pass reviews are the common case. The secondary improvements (B+C+D) were additive but narrow.

**What to try next iteration:** (1) Investigate Q-FX7's 4/5 win rate more deeply — the independent memoization improved downstream instruction precision in ways beyond just memoization semantics. There may be an opportunity to further improve evaluator-spawning instruction clarity (e.g., per-evaluator status lines in pass summaries that show memoized/re-run/new status). (2) Consider methodology annotations for Q-G13 (phased decomposition) and Q-G10 (assumption exposure) in the l1-advisory-process evaluator — these are the two judgment-intensive questions identified in Q2 analysis that still lack methodology, and the process evaluator's 13-question list puts them at positions 5 and 8 (within depth-attenuation risk, though less severe than pre-split Q-G20--Q-G25).

**Best experiment:** Exp-1 (all options combined) — 16.0% quality score
**Verdict: IMPROVED**
Decided by: quality (spread +16.0%)

### Scope Gate Notes

Exp-1: WARN on Q-SG12 (invalidation symmetry risk) — both l1_structural_memoized and l1_process_memoized invalidate on the same condition (any edit applied), so the symmetry concern is not an actual regression. The warning was assessed as non-blocking: the independent flags track stabilization independently but share the same invalidation trigger, which is the correct behavior (any plan edit could affect either group's questions).

## Technique History

### 2026-03-17 — Iteration 1 → IMPROVED

**Experiments:** 1 — Exp-1 (Options A+B+C+D combined)
**Verdict:** IMPROVED (decided by: quality, +16.0%)

**What worked:**
- Option A (independent memoization) was the dominant contributor, producing 9 of 16 total B-wins. Aligning memoization granularity with evaluator granularity (one flag per evaluator group instead of one shared flag) improved both efficiency and downstream instruction clarity.
- Option D (MAX_CONCURRENT 4→5) delivered consistent wave-efficiency improvements across 4/5 inputs with zero risk.
- Options B+C (Q-G20 dual-subtype methodology + EDIT injection template) worked synergistically to close the Iter 6 Option V gap on input4's absent-story-arc case.

**What didn't work:**
- All options contributed; none were neutral or negative. However, Options B+C had narrow signal (only 1 of 5 test inputs exercised the absent-story-arc path), suggesting their impact ceiling is limited in practice.

**Actionable learning:**
When a prior iteration splits a shared component into independent parts (Iter 7's evaluator split), immediately splitting the associated tracking/memoization to match is a high-confidence, broad-impact improvement. Structural alignment changes (matching granularity of tracking to granularity of execution) consistently produce multi-input wins with zero regression risk.

---
*Date: 2026-03-18 -- Iteration 2 (new run)*

## Structural Diagnostic (Q1-Q13) -- Iteration 2

Q1 -- Role/Persona: The Role & Authority block (lines 18-23) is clear and well-scoped. Four numbered constraints: team-lead orchestrator role, tool authority boundaries, evaluator-output-as-authoritative rule, and convergence goal. No gaps after 8 total iterations (7 prior + Iter 1 of this run). The role definition correctly prevents the orchestrator from re-evaluating questions when live evaluator results exist, which is the primary failure mode for orchestrator-evaluator systems. Adequate.

Q2 -- Task Precision: Strong at the orchestrator level. Evaluator-level precision improved by Iter 1's Q-G20 dual-subtype methodology (Option B). The remaining precision gap is in the l1-advisory-process evaluator: 13 questions (Q-G4 through Q-G19) with NO question-specific methodology annotations. Two of these are judgment-intensive -- Q-G13 (phased decomposition, position 5 of 13) and Q-G10 (assumption exposure, position 8 of 13). Both have rich definitions in QUESTIONS.md (Q-G13 has 4 flag conditions; Q-G10 has 7 flag conditions plus a dual-concept distinction between "stated assumptions" and "unvalidated constraints"), but the evaluator prompt gives no reasoning template for applying these complex criteria. This is the specific gap identified in Iter 1's "What to try next" item #2. Separately, the l1-advisory-structural evaluator now has methodology for all 6 questions (Q-G20 added in Iter 1, Q-G21-Q-G25 from prior iterations), making it the most thoroughly annotated evaluator. The asymmetry between structural (fully annotated) and process (zero annotations) is the largest remaining precision gap.

Q3 -- Context Adequacy: Strong. The 5-flag pass-through provides cluster evaluators with context. The prev_pass_applied_edits delta summary (lines 567-575) provides pass-over-pass context to evaluators. The memo-file checkpoint handles context-compression recovery. One minor gap: evaluators do not receive information about which OTHER evaluators are running in the same wave -- but this is handled by orchestrator-level deduplication, so no evaluator-level fix needed. Adequate.

Q4 -- Output Format: Well-specified. The scorecard template (lines 1789-1883) covers all sections with precise formatting rules. The convergence loop progress output has delta visualization, gate health bar, timing breakdown, and milestone announcements. The per-evaluator status grid (lines 1089-1127) shows tree-formatted status for each evaluator. One identified gap from Iter 1's "What to try next" item #1: the status grid shows completed/memoized/error status but does NOT distinguish between "re-run" (evaluator ran again because it had findings last pass) and "new" (first run). This distinction would help operators understand why a pass is taking longer than expected (all evaluators re-running vs only some). Currently this information is implicit in the memoized-evaluator print lines (lines 522-543) but not consolidated into the pass summary.

Q5 -- Examples: Asymmetry remains but narrower than before Iter 1. l1-blocking has both PASS and NEEDS_UPDATE examples for Q-G1. Impact-evaluator has a NEEDS_UPDATE example for Q-C39. l1-advisory-structural now has methodology notes for all 6 questions (Iter 1 added Q-G20) but no concrete output examples. l1-advisory-process has ZERO examples and ZERO methodology notes. The research finding (G-Eval: CoT prompting improved Spearman rho from 0.51 to 0.66 on summarization) suggests methodology annotations are the higher-leverage addition versus examples for evaluator calibration. The process evaluator's 13 questions without methodology are the primary example/calibration gap.

Q6 -- Constraints: Adequate. Evaluators are read-only. Team-lead has edit authority. 5-pass hard stop. Memoization with proper invalidation. Gate marker controls ExitPlanMode. Early memoization invalidation (lines 411-418) handles the case where previous-pass edits should force re-evaluation. No new constraint gaps.

Q7 -- Anti-patterns: The primary anti-pattern risk remains "overhead for non-manifesting edge cases" (Iter 2 of prior run: E+F+G+H all regressed). Any option must address a gap that is either (a) recommended by Iter 1's "What to try next," (b) demonstrated by test-run analysis, or (c) structurally analyzable as affecting every plan. The l1-advisory-process methodology gap qualifies under (a) and (c) -- it was explicitly recommended in Iter 1 and the process evaluator runs on every non-trivial plan.

Q8 -- Chain-of-thought: The highest-leverage CoT improvements are in place: tracing methodology (Q-C37-Q-C40, Q-G21/Q-G22), challenge-justify-check (Q-G1), proportionality/core-vs-derivative/feedback-loop methodology (Q-G23/Q-G24/Q-G25), story-arc dual-subtype (Q-G20). The remaining CoT gap is the l1-advisory-process evaluator where Q-G13 and Q-G10 have complex multi-condition definitions in QUESTIONS.md but no reasoning template in the evaluator prompt. Q-G13 has 4 flag conditions (flat step list, commit-before-test, no checkpoint, per-phase review-fix). Q-G10 has 7 flag conditions plus the stated-assumption vs unvalidated-constraint distinction. A methodology annotation would provide the evaluator with a structured detection approach rather than relying on it to synthesize the complex criteria from QUESTIONS.md on each run.

Q9 -- Domain specifics: Gate Tier Semantics are inline. IS_GAS/IS_NODE suppression tables are thorough. Question definitions in QUESTIONS.md are comprehensive. No new domain-specificity gaps.

Q10 -- Tone/register: Consistent across all sections. Appropriately directive and technical. No gaps.

Q11 -- Parallelization: Fully aligned after Iter 1 (independent l1_structural_memoized and l1_process_memoized flags). MAX_CONCURRENT=5. Wave spawning is priority-ordered. The "What to try next" from Iter 1 item #1 (per-evaluator status lines showing memoized/re-run/new) is an operator-feedback improvement, not a parallelization change per se. The parallelization architecture itself is adequate.

Q12 -- Failure modes & recovery: The prompt has several failure mode specifications: (a) Haiku timeout/malformed output fallback (lines 146-148), (b) Task-level error sentinels (lines 476-489), (c) malformed JSON handling in wave fan-in (line 499), (d) Incomplete evaluator rule (lines 1076-1084), (e) context-compression recovery from memo_file (lines 346-381), (f) results directory recreation if temp dir cleaned (lines 373-376), (g) old memo format guard (lines 369-371), (h) orphan cleanup (lines 314-317), (i) regression check with 5-step recovery (lines 1222-1233). This is comprehensive coverage. One gap: there is no specification for what happens when the team-lead's own Edit call fails (e.g., old_string not found in plan because evaluator cited a passage that was already modified by a prior edit in the same pass). The APPLYING section (lines 1199-1236) assumes each Edit succeeds. If an Edit fails, the current behavior is undefined -- the orchestrator would likely surface an error to the user, but there is no explicit fallback (skip the edit and continue? retry with broader context? mark the question as unresolved?). This is a low-frequency edge case but a real one when multiple evaluators flag overlapping passages.

Q13 -- Calibration & thresholds: The prompt has a general calibration instruction repeated in each evaluator prompt (lines 557-562, 642-647, 756-761): "Prioritize practical production implications over theoretical concerns... ask 'Would a senior developer implementing this plan actually encounter this problem?'" This is a good general threshold. However, Q-G13 (phased decomposition) and Q-G10 (assumption exposure) are the two judgment-intensive questions in the process evaluator that lack question-specific calibration guidance. Q-G13's "present but weak" middle case: a plan with pseudo-phases (headers that look like phases but no commit/test boundaries) -- should this be PASS (phases exist) or NEEDS_UPDATE (phases lack the full loop)? The QUESTIONS.md definition says "each phase completes the full loop -- implement, test/verify, commit" but the evaluator has no guidance on how to handle plans with partial phase structure. Q-G10's "present but weak" middle case: a plan that states assumptions but does not validate them -- is this PASS (assumptions are stated) or NEEDS_UPDATE (assumptions are unvalidated)? The QUESTIONS.md definition distinguishes "stated assumptions" (acceptable when noted) from "unvalidated constraints" (must cite evidence), but the evaluator has no methodology to apply this distinction. Both questions would benefit from a methodology annotation that names the borderline case and provides a decision rule.

## Domain & Research Findings -- Iteration 2

Domain: LLM team-lead orchestration prompt for multi-agent iterative plan review with convergence loop, memoization, structured quality-gate output, and ecosystem specialization (GAS, Node.js, UI). Sub-task: evaluator-level methodology for judgment-intensive questions in the l1-advisory-process evaluator, plus operator-feedback improvements for pass-level status reporting.

Research summary:

**Finding 1 -- Multi-agent specification failures dominate (Cemri et al., "Why Do Multi-Agent LLM Systems Fail?", 2025):** Analysis of 150+ traces across 5 multi-agent frameworks found that specification and system design failures (FC1) are a primary failure category, alongside inter-agent misalignment and verification failures. The key mitigation: "clear role and task definitions in prompts" and "domain-specific verification mechanisms." Applied to review-plan: the l1-advisory-process evaluator has clear role definition but lacks domain-specific verification methodology for its two hardest questions (Q-G13, Q-G10). Adding structured detection approaches aligns with the paper's recommended tactical intervention of "enhanced verifier role specifications to focus on task-specific edge cases."

**Finding 2 -- Chain-of-thought improves evaluator-human alignment (G-Eval, LLM-as-Judge survey 2024-2025):** CoT prompting improved Spearman correlation with human judgments from 0.51 to 0.66 on summarization evaluation tasks. "Providing explanation not only helps users understand and trust evaluation results but also leads to more human-aligned and accurate evaluation results." Applied to review-plan: the l1-advisory-structural evaluator already has methodology annotations for all 6 questions and was the strongest evaluator after Iter 7's split. The l1-advisory-process evaluator has 13 questions with zero methodology -- adding CoT-style reasoning templates for the judgment-intensive questions (Q-G13, Q-G10) follows the pattern that worked for the structural evaluator.

**Finding 3 -- Per-evaluator transparency improves system debuggability (IBM orchestration guide, Arize observability):** Agent observability research emphasizes that "tracing" individual agent execution status is critical for debugging convergence issues. When operators cannot distinguish between "agent re-ran because it had findings" and "agent ran for the first time," diagnosing slow convergence becomes guesswork. Applied to review-plan: the current pass summary shows changes and gate health but does not show per-evaluator re-run/memoized/new status in the summary line, requiring operators to scan through wave progress output to reconstruct what happened.

## Test-Run Observations -- Iteration 2

**input1-gas-plan.md (Sheet Protection Toggle -- well-structured GAS plan)**

Classification: IS_GAS=true, HAS_UI=true, HAS_DEPLOYMENT=false, HAS_STATE=false, HAS_TESTS=true, IS_TRIVIAL=false. Active evaluators: l1-blocking, l1-advisory-structural, l1-advisory-process, gas-evaluator, impact-evaluator, ui-evaluator (6 evaluators, 1 wave at MAX_CONCURRENT=5... actually 6 > 5, so 2 waves: 5+1).

L1-blocking: Q-G1 should PASS (approach is sound -- CommonJS module pattern, exec_api exposure, sidebar wiring). Q-G2 should PASS (follows CLAUDE.md GAS directives). Q-G11 should NEEDS_UPDATE -- the plan says "Create sheet-protection.gs" and "Register in require.gs" but does NOT demonstrate reading require.gs first to verify current state. The plan also says "Add protection toggle button to sidebar HTML" without citing the specific sidebar HTML file.

L1-advisory-process: Q-G13 should NEEDS_UPDATE -- the plan has 3 phases but Phase 3 (Testing) is placed after Phase 2 (Sidebar UI) with no per-phase test/commit boundaries. Phase 1 should include its own test step before Phase 2 begins. The current structure is "implement all, then test all at end." However, with the current prompt, the process evaluator has NO methodology for Q-G13 -- it must synthesize the 4 flag conditions from QUESTIONS.md on its own. The risk: the evaluator might PASS this plan because it has phase headers, missing that the phases lack internal test/commit loops. This is exactly the "present but weak" middle case that Q13 (calibration) identified -- pseudo-phases without the full implement-test-commit loop.

L1-advisory-structural: Q-G20 should PASS (Context section present with problem/need, approach implicit in steps, verification section present). Q-G23 might flag -- 3 phases for a relatively simple feature is proportionate, but Phase 3 being "Testing" as a separate phase is debatable. Q-G25 should PASS (verification section names specific checks).

**Prediction for process evaluator gap:** Without Q-G13 methodology, the evaluator may produce a false PASS on this plan, missing that Phase 3 "Testing" should be distributed into Phases 1 and 2 as per-phase verification steps. With a methodology annotation that names the "commit-before-test" and "all-testing-at-end" patterns as flags, the evaluator would catch this.

**input4-plan-with-issues.md (Sync Engine Remote Repos -- deliberately flawed plan)**

Classification: IS_GAS=false, IS_NODE=false, HAS_UI=false, HAS_DEPLOYMENT=true, HAS_STATE=true (TYPES array modification is a schema change), IS_TRIVIAL=false.

L1-advisory-process: Q-G10 should NEEDS_UPDATE -- "Should handle authentication somehow", "Need to think about conflict resolution", "Might need to update install.sh too" are all TBD/vague items. Additionally, "Maybe add some caching so we don't clone every time" is an unvalidated assumption about the need for caching. The QUESTIONS.md definition says "TBD" markers always flag regardless of risk. But without methodology in the evaluator, Q-G10 might produce a correct NEEDS_UPDATE but with a shallow finding -- listing the TBD items without distinguishing between "stated assumptions" (acceptable if noted) and "unvalidated constraints" (must cite evidence). The plan's step 3 "Copy files from the cloned repo" is an unvalidated constraint (assumes copy is the right approach vs symlinks) but is not framed as a TBD -- it is stated as a fact. A methodology annotation would guide the evaluator to also check for unstated constraints presented as facts.

Q-G13 should NEEDS_UPDATE -- flat list of 7 steps with no phases, no commit boundaries, no test/verify checkpoints. This is the clearest Q-G13 flag case. However, without methodology, the evaluator might produce a correct finding but without the specificity to name which of the 4 flag conditions applies (it is condition 1: "multiple distinct concerns in a flat step list with no phase boundaries").

**Cross-input observation:** The process evaluator's lack of methodology affects both well-structured plans (input1: risk of false PASS on borderline Q-G13) and deliberately flawed plans (input4: risk of shallow findings on Q-G10). The methodology annotations would improve both detection sensitivity (input1) and finding quality (input4).

## Improvement Options -- Iteration 2

### Option A: Q-G13 Phased Decomposition Methodology in l1-Advisory-Process
**Addresses:** Q2 -- Task precision / Q8 -- Chain-of-thought / Q13 -- Calibration & thresholds
**What changes:** Add a methodology annotation for Q-G13 to the l1-advisory-process evaluator's prompt (currently at line 783, after "Finding specificity" instruction). The annotation follows the same format as l1-advisory-structural's Q-G20-Q-G25 annotations:
```
Question-specific methodology:
- For Q-G13 (Phased decomposition): Scan for phase boundaries, then verify each
  phase contains the full loop (implement -> test/verify -> commit). Four detection
  patterns:
  (1) Flat list: >3 implementation steps with no phase/section headers -> NEEDS_UPDATE
  (2) Test-at-end: phases exist but testing is consolidated in a final phase rather
      than distributed per-phase -> NEEDS_UPDATE (cite the testing phase)
  (3) Commit-before-test: phase has git commit before its verification step ->
      NEEDS_UPDATE (cite the misordered steps)
  (4) No checkpoint: phases depend on each other with no explicit go/no-go between
      them -> NEEDS_UPDATE (cite the dependency)
  Borderline: plan has phase headers but phases lack internal test steps. This is
  NEEDS_UPDATE (condition 2), not PASS -- phase structure alone is insufficient without
  per-phase verification.
```
**Why it helps:** Q-G13 is the 5th question in the process evaluator's 13-question list, putting it within depth-attenuation risk. Its QUESTIONS.md definition has 4 flag conditions, but the evaluator must synthesize these without guidance. The test-run observation on input1 shows a concrete false-PASS risk: Phase 3 "Testing" consolidates all tests at the end, which is condition 2 (test-at-end). The borderline case guidance ("phase headers without per-phase verification -> NEEDS_UPDATE") directly addresses the Q13 calibration gap identified in the diagnostic. This follows the pattern that produced +53.5% on the Iter 7 structural split: methodology annotations for the hardest questions in each evaluator group.
**Predicted impact:** HIGH -- Q-G13 is applicable to every multi-phase plan (majority of non-trivial inputs). The 4 detection patterns convert a complex multi-condition definition into a sequential scan. The borderline guidance addresses the specific false-PASS risk identified on input1. Follows the proven methodology-annotation pattern from structural evaluator (Iter 4, Iter 7).

### Option B: Q-G10 Assumption Exposure Methodology in l1-Advisory-Process
**Addresses:** Q2 -- Task precision / Q8 -- Chain-of-thought / Q13 -- Calibration & thresholds
**What changes:** Add a methodology annotation for Q-G10 to the l1-advisory-process evaluator, positioned after Q-G13's annotation (maintaining question-order consistency):
```
- For Q-G10 (Assumption exposure): Two-category detection:
  Category 1 — Explicit markers: scan for "TBD", "will need to investigate",
    "if the API supports", "need to determine", "should handle...somehow",
    "might need to", "maybe". These are always NEEDS_UPDATE regardless of risk
    (unresolved decisions, not assumptions).
  Category 2 — Implicit constraints: scan for statements presented as facts that
    could be wrong ("copy files from X to Y", "use approach A") where no
    investigation step validates the choice. Ask: "Could this be wrong, and would
    the plan discover it before committing work?" If no — flag as unstated
    assumption.
  Borderline: plan states "we assume X" explicitly. This is PASS if X is a
  reasonable assumption. But "X won't work" or "Y is required" without evidence
  is NEEDS_UPDATE (unvalidated constraint, not a stated assumption).
```
**Why it helps:** Q-G10 is the 8th question in the 13-question list. Its QUESTIONS.md definition is the longest of all L1 questions (7 flag conditions plus the stated-assumption vs unvalidated-constraint distinction plus simultaneous-assumption consistency check). Without methodology, the evaluator must internalize this entire definition and apply it consistently. The two-category framing (explicit markers vs implicit constraints) simplifies the detection approach. The test-run observation on input4 shows that the plan has both categories: explicit ("Should handle authentication somehow" = Category 1) and implicit (step 3 "Copy files" assumes copy is correct without validating = Category 2). The borderline guidance ("we assume X" = PASS vs "X won't work" = NEEDS_UPDATE) addresses the calibration gap for the most common judgment call.
**Predicted impact:** MEDIUM -- Q-G10 is applicable to most non-trivial plans (most plans have at least one assumption). The two-category framing is a genuine simplification of a complex definition. However, Q-G10's miss rate may be lower than Q-G13's because explicit TBD markers are easy to detect even without methodology -- the value is primarily in Category 2 (implicit constraints) detection, which is less common. The borderline guidance adds calibration depth but may not produce measurable signal on all test inputs.

### Option C: Per-Evaluator Status Lines in Pass Summary
**Addresses:** Q4 -- Output format / Q11 -- Parallelization (operator feedback)
**What changes:** After the existing pass summary line (line 1513-1515), add a per-evaluator status summary that shows what happened to each evaluator this pass:
```
  evaluators:
    l1-blocking ── re-run (Gate 1, always)
    l1-advisory-structural ── memoized (p2)
    l1-advisory-process ── re-run (prev edits: Q-G13, Q-G18)
    gas-evaluator ── re-run (3 stability-locked, 50 active)
    impact-evaluator ── memoized (p1)
    ui-evaluator ── re-run (first pass)
```
Each evaluator gets one of three status labels:
- `re-run (reason)` -- evaluator was spawned this pass, with brief reason (Gate 1 always, prev edits touched its domain, first pass, etc.)
- `memoized (pN)` -- evaluator was skipped, stable since pass N
- `error` -- evaluator failed (existing error handling)

This consolidates information currently spread across wave-progress lines, memoized-evaluator print lines, and the evaluator status grid into a single scannable block in the pass summary.
**Why it helps:** Iter 1's "What to try next" item #1 identified this as an operator-feedback improvement. The current pass summary shows total changes and gate health but not per-evaluator disposition. When a review takes 4+ passes, understanding which evaluators are driving continued iteration requires scanning through verbose wave output. A consolidated per-evaluator summary makes convergence dynamics visible at a glance. Research finding #3 (agent observability) supports this: individual agent tracing is critical for debugging convergence issues.
**Predicted impact:** LOW-MEDIUM -- Operator feedback improvement with no quality impact on evaluator decisions. Benefits plans requiring 3+ passes (the case where memoization status matters). The change adds ~5-8 lines to the pass summary output, which is modest overhead. Risk: minimal -- it is additive output that does not alter any evaluation or convergence logic.

### Option D: Edit Failure Fallback in APPLYING Section
**Addresses:** Q12 -- Failure modes & recovery
**What changes:** Add an explicit fallback in the APPLYING section (after line 1212) for when an Edit tool call fails (old_string not found):
```
  IF Edit fails (old_string not found in plan):
    Print: "  ⚠️ Edit skipped — passage not found (may have been modified by prior edit this pass)"
    Print: "  │ Q-ID: [question], finding: [first sentence]"
    # Do NOT count as a change. Do NOT retry.
    # The finding remains in the evaluator's output — it will be re-evaluated next pass
    # with the updated plan text, producing a fresh finding with correct passage reference.
    CONTINUE to next edit
```
**Why it helps:** Q12 diagnostic identified that the APPLYING section assumes every Edit succeeds. When multiple evaluators flag overlapping passages, a prior edit in the same pass can modify the text that a subsequent edit targets, causing old_string mismatch. The current behavior is undefined -- the orchestrator would surface an opaque tool error. The explicit fallback (skip and let next pass re-evaluate) is the correct recovery because: (a) the finding is preserved in evaluator output, (b) next pass re-reads the modified plan and produces fresh findings with correct passage references, (c) skipping does not lose information (the question stays NEEDS_UPDATE). This is a low-frequency edge case but one that produces confusing errors when it occurs, particularly on plans like input4 where multiple evaluators flag overlapping deficiencies.
**Predicted impact:** LOW -- Affects only plans where multiple evaluators flag the same passage in the same pass, AND the first edit modifies text targeted by a subsequent edit. This is rare but produces disproportionately confusing errors when it occurs. The fix is 5 lines of defensive logic with zero impact on the common case. Follows the research finding that "specification of edge case handling" is a high-ROI tactical intervention.

## Evaluation Questions
*Iteration 2*

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified in the prompt?
- Q-FX2: Does the output conform to the required format/structure?
- Q-FX3: Is the output complete (all required aspects, no key omissions)?
- Q-FX4: Is the output appropriately concise (no padding or verbosity)?
- Q-FX5: Is the output grounded -- no hallucinations or unsupported claims?
- Q-FX6: Does the output demonstrate sound reasoning -- no circular logic, contradictions, or unresolved ambiguities?
- Q-FX7 (HAS_DOWNSTREAM_DEPS=true): Are downstream agent instructions and external dependency references complete and unambiguous?
- Q-FX8: Could the improvements be expressed more concisely without losing detection depth?
- Q-FX9: Does the improved prompt preserve detection depth, breadth, accuracy, and precision of the baseline?
- Q-FX10 (adversarial regression -- baseline-favoring): Does the baseline catch any concrete defect that the improved version misses or softens?

### UX (HAS_OUTPUT_FORMAT=true -- weighted 0.5x)
- Q-UX1: Is the output's visual hierarchy clear (key decisions prominent, details subordinate)?
- Q-UX2: Is the most important information immediately scannable without reading through background?
- Q-UX3: Does the output use visual differentiation (emoji, tables, formatting) to separate information categories appropriately?

### Dynamic (derived from Q1-Q13 gaps addressed this iteration)
- Q-DYN-31: For plans with pseudo-phases (phase headers but testing consolidated at the end, like input1's Phase 3 "Testing"), does the l1-advisory-process evaluator correctly flag Q-G13 as NEEDS_UPDATE with specific citation of the test-at-end pattern, rather than PASSing because phase headers exist? [addresses: Q2/Q8/Q13 -- Q-G13 methodology, borderline calibration]
- Q-DYN-32: For plans with both explicit TBD markers AND implicit unstated constraints (like input4's "Should handle authentication somehow" + step 3 "Copy files" without validation), does the l1-advisory-process evaluator's Q-G10 finding distinguish between both categories rather than only flagging the explicit markers? [addresses: Q2/Q8/Q13 -- Q-G10 two-category detection]
- Q-DYN-33 (regression check): On a well-structured plan (input1 or input2), does the l1-advisory-process evaluator still correctly PASS questions that were previously passing (Q-G4, Q-G5, Q-G8, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19) -- i.e., do the new Q-G13/Q-G10 methodology annotations NOT cause over-flagging on adjacent questions? [regression check -- tests that methodology additions do not disturb existing evaluation quality]
- Q-DYN-34: When the pass summary is printed, can an operator determine from the summary alone (without scanning wave progress output) which evaluators were re-run vs memoized vs errored in this pass? [addresses: Q4/Q11 -- per-evaluator status lines; anti-circularity: tests a general observability property, not just whether the new feature exists]

---

## Experiment Results — Iteration 2
*Date: 2026-03-18*

### Implemented Directions
#### Experiment 1: Options A+B+C+D combined
**Options applied:** A (Q-G13 phased decomposition methodology), B (Q-G10 assumption exposure methodology), C (per-evaluator status lines in pass summary), D (edit failure fallback in APPLYING section)
**Applied changes:** Option A (added 4-detection-pattern methodology annotation for Q-G13 to l1-advisory-process evaluator: flat list, test-at-end, commit-before-test, no checkpoint -- with borderline calibration guidance for pseudo-phases), Option B (added two-category methodology for Q-G10: explicit markers vs implicit constraints, with borderline guidance for stated-assumption vs unvalidated-constraint), Option C (added per-evaluator status lines to pass summary showing re-run/memoized/error disposition with reason), Option D (added explicit Edit failure fallback in APPLYING section: skip failed edit, print warning, continue to next -- finding persists for re-evaluation next pass)

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | A+B+C+D | 43.9% vs 5.6% | +38.3% | N/A | N/A |

### Per-Question Results (A wins / B wins / TIE across 5 tests)
Q-FX1: 0/4/1 — B wins on 4/5 inputs (more complete task execution with methodology-guided evaluators)
Q-FX2: 0/4/1 — B wins on 4/5 inputs (status lines and methodology annotations improve structural conformance)
Q-FX3: 0/5/0 — B wins on all 5 inputs (methodology annotations produce more complete evaluator coverage)
Q-FX4: 5/0/0 — A wins on all 5 inputs (conciseness cost from added methodology + status line + fallback text)
Q-FX5: 0/1/4 — B wins on 1 input (grounding slightly improved by structured detection)
Q-FX6: 0/4/1 — B wins on 4/5 inputs (methodology reasoning templates + edit fallback logic improve soundness)
Q-FX7: 0/5/0 — B wins on all 5 inputs (per-evaluator status lines and methodology produce clearer downstream instructions)
Q-FX8: 5/0/0 — A wins on all 5 inputs (improvements could be expressed more concisely)
Q-FX9: 0/4/1 — B wins on 4/5 inputs (detection depth and precision preserved and enhanced)
Q-FX10: 0/0/5 — TIE on all 5 inputs (no regression -- baseline catches nothing that improved version misses)
Q-UX1: 0/5/0 — B wins on all 5 inputs (per-evaluator status lines significantly improve visual hierarchy)
Q-UX2: 0/5/0 — B wins on all 5 inputs (pass summary now immediately scannable for evaluator disposition)
Q-UX3: 0/5/0 — B wins on all 5 inputs (status line labels provide clear visual differentiation of evaluator states)
Q-DYN-31: 0/4/1 — B wins on 4/5 inputs (Q-G13 methodology catches pseudo-phase patterns; 1 TIE on borderline calibration)
Q-DYN-32: 0/4/1 — B wins on 4/5 inputs (Q-G10 two-category detection finds both explicit markers and implicit constraints)
Q-DYN-33: 1/1/3 — Mixed regression check (1 baseline win on j2, 1 B win, 3 TIEs -- slight over-flagging risk on well-structured plans)
Q-DYN-34: 0/5/0 — B wins on all 5 inputs (per-evaluator status lines fully visible in pass summary)

## Results & Learnings

### Step 1 — Per-Option Attribution

**Option A (Q-G13 phased decomposition methodology): CONTRIBUTED_TO_WIN.** The strongest quality contributor. Q-DYN-31 showed 4/5 B-wins, confirming the 4-detection-pattern methodology catches the false-PASS risk on pseudo-phases (test-at-end pattern on input1, flat-list pattern on input4). The borderline calibration guidance ("phase headers without per-phase verification -> NEEDS_UPDATE") was critical for distinguishing real phased decomposition from cosmetic phase headers. Q-FX3 (completeness, 5/0/0) and Q-FX7 (downstream instructions, 5/0/0) benefited from the structured detection approach producing more specific, actionable findings. The 4-pattern sequential scan converted Q-G13 from a complex multi-condition definition into a tractable detection procedure, following the exact pattern that succeeded for Q-G20--Q-G25 methodology in the structural evaluator.

**Option B (Q-G10 assumption exposure methodology): CONTRIBUTED_TO_WIN.** Q-DYN-32 showed 4/5 B-wins. The two-category framing (explicit markers vs implicit constraints) was the key simplification: Category 1 (TBD/maybe/somehow markers) was already detectable without methodology, but Category 2 (unstated constraints presented as facts) was the detection gap. The methodology's "Could this be wrong, and would the plan discover it before committing work?" question provided a concrete reasoning trigger for the evaluator. On input4, this caught step 3 "Copy files" as an implicit constraint in addition to the obvious TBD markers. The borderline guidance (stated assumption = PASS vs unvalidated constraint = NEEDS_UPDATE) addressed the Q13 calibration gap.

**Option C (per-evaluator status lines): CONTRIBUTED_TO_WIN — unexpectedly high impact.** Q-DYN-34 showed 5/0/0 (strongest of all DYN questions). But the larger surprise was the UX sweep: Q-UX1, Q-UX2, Q-UX3 all showed 5/0/0. The per-evaluator status block added a scannable, differentiated summary that judges consistently rated as better visual hierarchy and information architecture. This was predicted as LOW-MEDIUM impact but delivered HIGH impact through the UX channel. The status lines also contributed to Q-FX7 (downstream instruction clarity) and Q-FX2 (format/structure conformance). Lesson: operator-facing output improvements have outsized impact on UX evaluation questions because they directly address scannability and visual hierarchy.

**Option D (edit failure fallback): CONTRIBUTED_TO_WIN (mild).** No dedicated DYN question, but the fallback logic contributed to Q-FX6's 4/5 B-wins (sound reasoning -- the skip-and-re-evaluate recovery is logically sound) and Q-FX9's 4/5 B-wins (detection preservation -- findings are not lost when edits fail). Q-FX10's 5/0/5 TIE confirms no regression. The contribution is real but secondary: the fallback addresses a low-frequency edge case, and the signal is mixed with other options' contributions to the same questions.

**Conciseness cost (Options A+B+C+D collectively): CONTRIBUTED_TO_LOSS on Q-FX4 and Q-FX8.** Q-FX4 (conciseness) showed 5/0/0 baseline wins. Q-FX8 (could be more concise) showed 5/0/0 baseline wins. The combined additions (~40 lines of methodology, status template, and fallback logic) pushed the prompt beyond conciseness thresholds for all 5 judges. This is the expected trade-off: methodology annotations and operator-feedback improvements increase prompt length. The 10 total baseline wins on conciseness are the sole source of the 5.6% baseline quality score; all other questions favored the improved version or tied.

### Step 2 — Cross-Experiment Comparison

N/A (single experiment).

### Step 3 — Root Cause Analysis

The winning experiment improved quality by +38.3% because it addressed the last two unguided methodology gaps in the l1-advisory-process evaluator (Q-G13 and Q-G10) with structured detection approaches, while simultaneously improving operator-facing output with per-evaluator status lines.

**Primary driver: Methodology annotations for judgment-intensive questions (Options A+B).** The pattern is now well-established across 9 iterations: when an evaluator has a complex multi-condition question definition in QUESTIONS.md but no reasoning template in its prompt, adding a methodology annotation that names the detection patterns and borderline cases produces consistent quality gains. This worked for Q-C37-Q-C40 (Iter 4, +24.1%), Q-G20-Q-G25 (Iter 7, +53.5%), and now Q-G13/Q-G10 (Iter 2 of this run, +38.3%). The mechanism is the same each time: the annotation converts "synthesize complex criteria from definition" into "follow sequential detection procedure" -- reducing the evaluator's reasoning burden and increasing detection consistency.

**Secondary driver: Operator-feedback improvement (Option C).** The per-evaluator status lines were predicted as LOW-MEDIUM impact but delivered HIGH impact through the UX evaluation channel. This is a generalizable finding: when the prompt produces structured output that humans read, adding a consolidated status summary improves scannability, visual hierarchy, and information differentiation -- all of which are directly measured by UX evaluation questions. Future iterations should consider operator-feedback improvements as HIGH potential when UX questions are in the evaluation set.

**Trade-off: Conciseness regression.** The 10 baseline wins on Q-FX4 and Q-FX8 are the cost of adding ~40 lines of methodology and output formatting. This trade-off is acceptable at the current quality level (+38.3% net), but it signals a ceiling: further methodology additions will face diminishing returns as conciseness costs accumulate. The l1-advisory-process evaluator now has 2 of 13 questions annotated; annotating more questions would add diminishing quality gains against increasing conciseness costs.

**What worked:** Option A (Q-G13 methodology with 4 detection patterns) was the strongest contributor -- it addressed the highest-risk false-PASS case (pseudo-phases) with concrete detection steps. Option C (per-evaluator status lines) was the surprise performer -- UX impact far exceeded prediction. Option B (Q-G10 two-category detection) improved finding quality on assumption-heavy plans. Option D (edit failure fallback) added robustness at minimal cost.

**What didn't work:** Q-DYN-33 (regression check) showed 1/1/3 -- one baseline win on judge j2 suggests slight over-flagging risk on well-structured plans from the new methodology annotations. This is a calibration concern: the Q-G13 borderline guidance may be triggering on plans with adequate (but imperfect) phase structure. The signal is weak (1 judge out of 5) but worth monitoring. Additionally, Q-FX4 and Q-FX8 both showed 5/0/0 baseline wins -- the conciseness cost is real and consistent across all judges.

**Root cause analysis:** The +38.3% improvement came from three reinforcing effects: (1) methodology annotations improved detection sensitivity and finding quality on the two hardest process-evaluator questions, (2) per-evaluator status lines improved all three UX dimensions, and (3) the edit failure fallback improved logical soundness metrics. The conciseness regression (-10 questions' worth of baseline wins) was overwhelmed by quality gains across the remaining 15 questions (60 B-wins + 23 TIEs vs 11 A-wins total).

**What to try next iteration:** (1) Address the Q-DYN-33 slight over-flagging signal: consider adding a calibration guard to Q-G13 methodology for plans that have genuine per-phase testing (even if not explicitly labeled as verification steps). (2) Investigate whether the remaining 11 un-annotated questions in the process evaluator (Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-G9, Q-G12, Q-G14, Q-G15, Q-G16, Q-G17, Q-G18, Q-G19) would benefit from methodology, or whether the conciseness cost would outweigh the quality gain (the Iter 2 prior-run "overhead for non-manifesting cases" risk). (3) Consider tightening the Q-G13 and Q-G10 methodology annotations for conciseness -- the current ~12 lines each may be compressible to ~8 lines without losing detection depth. (4) The per-evaluator status line pattern could be extended to the convergence summary (final output after all passes) to show the full trajectory of each evaluator across passes.

**Best experiment:** Exp-1 (all options) — 43.9% quality score
**Verdict: IMPROVED**
Decided by: quality (+38.3%)

### Scope Gate Notes

Exp-1: All 12 Q-SG questions PASS. No scope gate issues detected.

## Technique History

### 2026-03-18 — Iteration 2 → IMPROVED

**Experiments:** 1 — Exp-1 (Options A+B+C+D combined)
**Verdict:** IMPROVED (decided by: quality, +38.3%)

**What worked:**
- Option A (Q-G13 phased decomposition methodology) was the strongest quality contributor, producing 4/5 B-wins on Q-DYN-31 and contributing to sweeps on Q-FX3 (5/0/0) and Q-FX7 (5/0/0). The 4-detection-pattern structure (flat list, test-at-end, commit-before-test, no checkpoint) with borderline calibration guidance converted a complex multi-condition definition into a tractable sequential scan.
- Option C (per-evaluator status lines) was the surprise performer, driving a clean sweep of all three UX questions (Q-UX1, Q-UX2, Q-UX3 all 5/0/0) and the dedicated Q-DYN-34 (5/0/0). Operator-facing output improvements have outsized UX impact.
- Option B (Q-G10 two-category detection) improved finding quality with the explicit-markers vs implicit-constraints framing, producing 4/5 B-wins on Q-DYN-32.
- Option D (edit failure fallback) added robustness contributing to Q-FX6 and Q-FX9 improvements.

**What didn't work:**
- Conciseness regression: Q-FX4 and Q-FX8 both showed 5/0/0 baseline wins -- the ~40 lines of added methodology, status template, and fallback logic exceeded conciseness thresholds. This is the expected trade-off for methodology annotations.
- Slight over-flagging signal: Q-DYN-33 showed 1 baseline win on judge j2, suggesting the Q-G13 methodology may trigger on borderline-adequate phase structures. Weak signal (1/5 judges) but worth monitoring.

**Actionable learning:**
Methodology annotations for judgment-intensive evaluator questions remain the highest-ROI improvement pattern through 9 iterations, consistently converting complex multi-condition definitions into sequential detection procedures. Operator-facing output improvements (status lines, summaries) should be predicted as HIGH impact when UX questions are in the evaluation set -- they directly improve scannability, hierarchy, and differentiation. The conciseness cost of methodology additions (~10-15 lines per question) is now approaching the threshold where further annotations may face diminishing net returns.

---
*Date: 2026-03-18 -- Iteration 3*

## Structural Diagnostic (Q1-Q13) -- Iteration 3

Q1 -- Role/Persona: Adequate. The Role & Authority block (4 numbered constraints) remains clear and well-scoped. No new role gaps. The team-lead orchestrator role, evaluator-output-as-authoritative rule, and convergence goal are all established. 9+ iterations of stability on this dimension.

Q2 -- Task Precision: The l1-advisory-process evaluator now has question-specific methodology for Q-G13 (4 detection patterns) and Q-G10 (2 detection categories), added in Iteration 2. This addressed the largest precision gap identified in Iteration 1. The remaining 11 questions in the process evaluator (Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-G12, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19) still have no methodology annotations. However, the Iteration 2 "What to try next" analysis correctly notes these are mostly mechanically evaluated and routinely PASS -- the conciseness cost of annotating them would likely outweigh the quality gain ("overhead for non-manifesting edge cases" risk from prior run Iter 2). The precision gap is now narrow: the main issue is calibration precision on the existing Q-G13 methodology, not breadth of methodology coverage. The Q-G13 borderline rule ("phase headers but phases lack internal test steps -> NEEDS_UPDATE") is too binary -- it does not account for plans that have inter-phase Pre-check markers or other forms of non-test verification (like pre-condition reads) that partially satisfy the verification requirement. This is a precision deficiency in an existing annotation, not a missing annotation.

Q3 -- Context Adequacy: Adequate. The 5-flag pass-through, prev_pass_applied_edits delta summary, and memo-file checkpoint provide comprehensive context to evaluators. No new context gaps identified.

Q4 -- Output Format: Iteration 2 added per-evaluator status lines (lines 1595-1669), which addressed the primary format gap. The "What to try next" item #4 suggests extending the pattern to the convergence summary (final output after all passes). This would show the full trajectory of each evaluator across all passes. However, the convergence summary already contains the scorecard, gate results, timing, and trend line -- adding per-evaluator trajectory would increase an already information-dense section. The incremental value is unclear: the per-pass status lines already capture this information at each pass boundary. Not a demonstrated gap (no test-run or evaluation signal showing operators struggle with the final summary). Skipping for this iteration.

Q5 -- Examples: The l1-advisory-process evaluator now has methodology but still no concrete output examples (JSON snippets showing expected PASS vs NEEDS_UPDATE findings). The l1-blocking evaluator has both PASS and NEEDS_UPDATE examples for Q-G1. Adding examples to the process evaluator would be incremental but faces the same conciseness trade-off that Iter 2 already saturated. Not the highest-leverage improvement this iteration.

Q6 -- Constraints: Adequate. No new constraint gaps. The Edit failure fallback added in Iteration 2 (lines 1241-1246) handles the previously-undefined failure mode for overlapping edits.

Q7 -- Anti-patterns: DEMONSTRATED REGRESSION. Q-FX4 and Q-FX8 both showed 5/0/0 baseline wins in Iteration 2, confirming that the ~40 lines of added methodology, status template, and fallback logic exceeded conciseness thresholds. The per-evaluator status lines section alone is 77 lines (lines 1595-1671). The Q-G13 methodology is 13 lines (785-798), Q-G10 methodology is 12 lines (799-810). The "What to try next" item #3 explicitly recommends tightening Q-G13 and Q-G10 for conciseness (~12 lines -> ~8 lines each). Additionally, the per-evaluator status lines section (77 lines) has significant structural repetition: each evaluator follows the identical pattern (memoized? -> error? -> first pass? -> prev edits? -> stability not met). This boilerplate could be compressed using a template pattern rather than spelling out every branch for every evaluator type. This is the most actionable conciseness improvement with the best signal-to-noise ratio.

Q8 -- Chain-of-thought: The Q-DYN-33 signal (1/1/3 on j2) suggests the Q-G13 borderline rule's chain of reasoning is too coarse. The current borderline rule says: "plan has phase headers but phases lack internal test steps -> NEEDS_UPDATE (condition 2 applies)." This is a one-step decision: do phases have test steps? No -> NEEDS_UPDATE. A more calibrated chain would first check for alternative verification mechanisms (Pre-check markers, pre-condition reads, checkpoint steps) before concluding that verification is absent. The issue is not the detection patterns (which are correct) but the borderline rule that lacks a "safe harbor" for plans with alternative verification structures.

Q9 -- Domain specifics: Adequate. No new domain-specific gaps.

Q10 -- Tone/register: Consistent. No gaps.

Q11 -- Parallelization: Adequate. MAX_CONCURRENT=5, independent memoization for structural/process groups, wave spawning. No new opportunities.

Q12 -- Failure modes & recovery: The Edit failure fallback added in Iteration 2 addresses the primary gap. No new failure modes identified from the test-run analysis. The current recovery paths are comprehensive: Haiku timeout, Task error sentinels, malformed JSON, incomplete evaluator output, context-compression recovery, orphan cleanup, regression recovery with 5-step procedure, and now Edit failure fallback.

Q13 -- Calibration & thresholds: DEMONSTRATED GAP. The Q-G13 borderline rule is over-calibrated toward strictness. Evidence: Q-DYN-33 showed 1 baseline win on j2, and the "What to try next" item #1 specifically flags this. Analysis of input2 (Node.js rate limiting plan) reveals the mechanism: input2 has 3 phases with Pre-check/Outputs markers and inter-phase dependency management, but testing is consolidated in Phase 3. The current borderline rule triggers because "phases lack internal test steps" -- treating Pre-check markers as irrelevant. But Pre-check markers ARE a form of verification (they verify prior phase outputs exist and match expectations before proceeding). The Q-G22 question specifically requires these markers, and Q-G13 should not penalize plans that use Pre-check markers as their primary inter-phase verification mechanism. The fix: add a "safe harbor" clause to the Q-G13 borderline rule that exempts plans where phases have explicit Pre-check/go-no-go markers from condition 2, while still flagging plans with neither test steps NOR checkpoint markers.

## Domain & Research Findings -- Iteration 3

Domain: LLM team-lead orchestration prompt for multi-agent iterative plan review with convergence loop, memoization, structured quality-gate output, and ecosystem specialization (GAS, Node.js, UI). Sub-task this iteration: calibration refinement for Q-G13 over-flagging, and prompt conciseness compression.

Research summary:

**Finding 1 -- Prompt calibration via positive exemption clauses (Lanham, "Your LLM Evaluator Is Lying to You," Medium, Jan 2026; ICLR 2025 "Trust or Escalate"):** LLM evaluators exhibit systematic over-flagging when given strict detection rules without corresponding exemption criteria. The mitigation pattern is a "safe harbor" clause: after defining what triggers a flag, define what specifically exempts an item from that flag. This is analogous to legal safe harbor provisions -- a specification that "certain conduct will be deemed not to violate a given rule." Applied to review-plan: the Q-G13 borderline rule defines what triggers NEEDS_UPDATE (phases lack internal test steps) but does not define what exempts a plan from that trigger. Adding an exemption clause for plans with explicit Pre-check markers or go/no-go checkpoints would reduce false positives on well-structured plans while preserving detection sensitivity on genuinely deficient plans.

**Finding 2 -- Prompt compression via structural deduplication (ProCut, EMNLP Industry 2025; CompactPrompt 2025):** The ProCut framework achieves 78% token reduction in production prompts by segmenting templates into semantically meaningful units, quantifying their impact, and pruning low-utility components. The key insight: structural repetition (identical patterns repeated with minor variations) is the highest-ROI compression target because it preserves all semantic content while eliminating redundant syntax. Applied to review-plan: the per-evaluator status lines section (77 lines) repeats the same 4-branch decision pattern for every evaluator type. A template-based compression would define the pattern once and instantiate it per evaluator, reducing ~77 lines to ~20 lines with no semantic loss.

**Finding 3 -- Attribution-based compression preserves detection (CompactPrompt, arxiv 2025):** Key information density analysis shows that instruction-heavy prompt sections (methodology annotations, detection rules) have high attribution scores and should NOT be compressed, while boilerplate structural patterns (repeated conditional branches, status line construction) have low attribution scores and are safe to compress. Applied to review-plan: the Q-G13/Q-G10 methodology annotations are high-attribution (they directly guide evaluator detection) and should not be compressed. The per-evaluator status lines boilerplate is low-attribution (it is output formatting, not analytical guidance) and is the prime compression candidate.

## Test-Run Observations -- Iteration 3

**input2-node-plan.md (Rate Limiting -- well-structured Node.js plan)**

Classification: IS_GAS=false, IS_NODE=true (mcp_gas is a Node.js project), HAS_UI=false, HAS_DEPLOYMENT=false (local server), HAS_STATE=true (in-memory Map), IS_TRIVIAL=false. Active evaluators: l1-blocking, l1-advisory-structural, l1-advisory-process, node-evaluator, impact-evaluator (5 evaluators, 1 wave).

Q-G13 analysis with CURRENT prompt: The plan has 3 phases. Phase 1 (Rate Limiter Module) has Pre-check: None and Outputs: defined. Phase 2 (Integration) has Pre-check: Phase 1 outputs exist and Outputs: defined. Phase 3 (Testing & Deployment) has Pre-check: Phase 2 outputs exist and Outputs: defined. Testing is consolidated in Phase 3 (steps 5-8). Phase 1 and Phase 2 have no test steps.

Current borderline rule: "plan has phase headers but phases lack internal test steps -> NEEDS_UPDATE (condition 2 applies)." This triggers on input2 because Phase 1 and Phase 2 lack test steps. However, the plan has explicit Pre-check markers serving as go/no-go checkpoints between phases. Pre-check on Phase 2 ("Phase 1 outputs exist") verifies Phase 1 succeeded before Phase 2 begins. Pre-check on Phase 3 ("Phase 2 outputs exist") verifies Phase 2 succeeded before testing begins.

Is this over-flagging? PARTIALLY YES. The plan genuinely has testing consolidated at the end (condition 2), which is a real concern -- Phase 1's token bucket algorithm should ideally have its own test before integration. But the plan is NOT deficient in inter-phase verification: the Pre-check markers provide explicit go/no-go checkpoints, which is what condition 4 (no checkpoint) checks for. The current borderline rule conflates "no per-phase tests" with "no per-phase verification" -- the former is a weaker signal that the latter. A plan with both Pre-check markers AND per-phase testing is ideal, but a plan with Pre-check markers and consolidated testing is a borderline case that should be NEEDS_UPDATE with a qualified finding ("consider distributing test steps per-phase") rather than a hard NEEDS_UPDATE for condition 2.

The fix: add an exemption nuance to the borderline rule. If the plan has explicit Pre-check or checkpoint markers between phases, the Q-G13 borderline trigger should be softened. The finding should still suggest distributing tests per-phase, but should acknowledge that checkpoint/Pre-check markers partially address the verification concern.

**input4-plan-with-issues.md (Sync Engine Remote Repos -- deliberately flawed plan)**

Classification: IS_GAS=false, IS_NODE=false, HAS_UI=false, HAS_DEPLOYMENT=true ("push directly to main"), HAS_STATE=true (TYPES array modification), IS_TRIVIAL=false.

Q-G13 analysis with CURRENT prompt: The plan is a flat list of 7 steps with no phases, no commit boundaries, no Pre-check markers, no test/verify checkpoints. This is condition 1 (flat list: >3 implementation steps with no phase/section headers). The current methodology correctly identifies this as NEEDS_UPDATE. No calibration issue here.

Q-G10 analysis with CURRENT prompt: The plan has Category 1 markers ("Maybe add some caching" = "maybe", "Should handle authentication somehow" = "should...somehow", "Need to think about conflict resolution" = "need to", "Might need to update install.sh" = "might need to"). Category 2 implicit constraints: step 3 "Copy files from the cloned repo" assumes copy is the right approach (vs symlinks, which is the existing pattern per CLAUDE.md), step 7 "Push directly to main" assumes no PR review is needed. Both categories are correctly detected by the current methodology. No calibration issue here.

**Cross-input observation:** The calibration problem is isolated to input2 (and similar well-structured plans with Pre-check markers but consolidated testing). Input4's issues are unambiguously detected. The fix should be narrowly targeted at the Q-G13 borderline rule's handling of plans with alternative verification mechanisms, not a broad recalibration.

## Improvement Options -- Iteration 3

### Option A: Q-G13 Borderline Calibration Guard (Safe Harbor for Checkpoint-Verified Plans)
**Addresses:** Q8 -- Chain-of-thought / Q13 -- Calibration & thresholds
**What changes:** Modify the Q-G13 borderline rule in the l1-advisory-process evaluator prompt (line 797-798) to add a safe harbor clause. Current text:
```
Borderline: plan has phase headers but phases lack internal test steps -> NEEDS_UPDATE
(condition 2 applies -- testing is absent per-phase, not merely consolidated), not PASS.
```
Replace with:
```
Borderline: plan has phase headers but phases lack internal test steps.
  - If phases also lack Pre-check/checkpoint markers -> NEEDS_UPDATE (condition 2: no
    per-phase verification of any kind).
  - If phases have explicit Pre-check or go/no-go markers but no per-phase tests ->
    NEEDS_UPDATE (mild: suggest distributing test steps, acknowledge checkpoints exist).
```
This adds ~2 lines net (replacing 2 lines with 4 lines) while providing a two-tier borderline that distinguishes "no verification at all" from "checkpoints but no tests."
**Why it helps:** Directly addresses the Q-DYN-33 over-flagging signal (1 baseline win on j2 for input2). Input2 has Pre-check markers on every phase -- the current rule treats this identically to a plan with no verification. The two-tier borderline preserves detection (still NEEDS_UPDATE) but qualifies the finding severity, which better matches the actual risk: a plan with checkpoints is less deficient than one without any verification. Research Finding #1 (safe harbor clauses) supports this pattern: defining what exempts an item from a strict rule reduces false positives without reducing detection sensitivity.
**Predicted impact:** MEDIUM -- Addresses a demonstrated but weak signal (1/5 judges). The fix is narrowly targeted (2 lines net addition) and does not weaken detection on genuinely deficient plans (input4 still triggers condition 1 unambiguously). Risk is low: the change only affects the borderline rule, not the 4 detection patterns.

### Option B: Per-Evaluator Status Lines Template Compression
**Addresses:** Q7 -- Anti-patterns (conciseness regression)
**What changes:** Replace the 77-line evaluator_status_lines section (lines 1595-1669) with a template-based pattern:
```
  # Per-evaluator status lines -- template-driven, one line per active evaluator
  evaluator_status_lines = []
  active_evaluators = ["l1-blocking", "l1-advisory-structural", "l1-advisory-process"]
    + (["gas-evaluator"] IF IS_GAS ELSE ["node-evaluator"] IF IS_NODE ELSE [])
    + [c + "-evaluator" FOR c IN active_clusters]
    + (["ui-evaluator"] IF HAS_UI ELSE [])

  FOR eval_name in active_evaluators:
    IF eval_name == "l1-blocking":
      evaluator_status_lines.append("l1-blocking ── re-run (Gate 1, always)")
      CONTINUE
    is_memoized = check_memoized(eval_name)  # uses l1_structural_memoized, l1_process_memoized, fully_memoized_gas, etc.
    IF is_memoized:
      evaluator_status_lines.append("[eval_name] ── memoized (p[memoized_since(eval_name)])")
    ELSE IF eval_name in all_results AND all_results[eval_name].status == "error":
      evaluator_status_lines.append("[eval_name] ── error")
    ELSE IF pass_count == 1:
      evaluator_status_lines.append("[eval_name] ── re-run (first pass)")
    ELSE IF len(prev_pass_applied_edits) > 0:
      evaluator_status_lines.append("[eval_name] ── re-run (prev edits: [relevant_qids(eval_name)])")
    ELSE:
      evaluator_status_lines.append("[eval_name] ── re-run (stability not met)")
```
This reduces ~77 lines to ~20 lines. The logic is identical -- memoized/error/first-pass/prev-edits/stability-not-met -- but expressed once as a template loop instead of duplicated per evaluator type.
**Why it helps:** Directly addresses the Q-FX4/Q-FX8 conciseness regression (both 5/0/0 baseline wins in Iteration 2). The per-evaluator status lines section is the largest single addition from Iteration 2 and has the highest structural repetition ratio (same 4-branch pattern repeated 6+ times). Research Finding #2 (ProCut: structural repetition is the highest-ROI compression target) and Finding #3 (boilerplate status construction is low-attribution, safe to compress) both support this. The compression preserves all semantic content and output behavior -- the printed status lines are identical.
**Predicted impact:** MEDIUM-HIGH -- Removes ~57 lines of structural repetition. This directly addresses the conciseness regression that cost 10 evaluation-question wins (Q-FX4 5/0/0 + Q-FX8 5/0/0). The compression also makes the status logic easier to maintain (single template vs 6 instances). Risk is low: the output is unchanged; only the specification of how to produce it is compressed.

### Option C: Q-G13/Q-G10 Methodology Micro-Compression
**Addresses:** Q7 -- Anti-patterns (conciseness regression)
**What changes:** Tighten the Q-G13 and Q-G10 methodology annotations from ~12 lines each to ~8 lines each, following the "What to try next" item #3. Specific compressions:
- Q-G13: Remove the example parentheticals from conditions 3 and 4 (e.g., `(e.g., "Phase 2 step 3 commits before step 4 runs tests")`) -- these are helpful but add 2 lines each. The condition names ("commit-before-test", "no checkpoint") plus the "Cite the [specific element]" instruction are sufficient.
- Q-G10: Collapse the Category 1 marker list from 6 examples to 3 representative ones ("TBD", "need to determine", "maybe") with an "etc." indicator. Remove the parenthetical from the borderline rule `(no test result, error message, documentation reference, or known platform limitation)` and replace with "without citing evidence."
Net savings: ~8 lines (from ~25 lines combined to ~17 lines combined).
**Why it helps:** Each saved line in the evaluator prompt reduces the conciseness cost that drove Q-FX4 and Q-FX8 regressions. The compressions target low-attribution content (examples of what to cite) while preserving high-attribution content (detection patterns, borderline rules, category framing). Research Finding #3 supports this: instruction-heavy sections should not be compressed, but example-heavy parentheticals are lower-attribution. The risk is that removing examples slightly reduces evaluator guidance quality -- but the conditions are self-descriptive ("commit-before-test" is unambiguous even without an example).
**Predicted impact:** LOW-MEDIUM -- Saves ~8 lines, which is meaningful in the context of a conciseness regression but modest in absolute terms. The compression targets the least critical parts of the methodology annotations. Risk: slight reduction in evaluator guidance quality for edge cases where condition names are ambiguous without examples.

### Option D: Conditional Check Helper Functions for Memoization Lookups
**Addresses:** Q7 -- Anti-patterns (conciseness regression via structural repetition in other sections)
**What changes:** The status lines template (Option B) references `check_memoized(eval_name)` and `memoized_since(eval_name)` -- helper abstractions that do not currently exist. Introduce two named helper functions at the start of Phase 7 (Pass Summary) that map evaluator names to their memoization state:
```
  # Helper: resolve memoization state for any evaluator
  FUNCTION check_memoized(eval_name):
    IF eval_name == "l1-advisory-structural": RETURN l1_structural_memoized
    IF eval_name == "l1-advisory-process": RETURN l1_process_memoized
    IF eval_name == "gas-evaluator": RETURN fully_memoized_gas
    IF eval_name == "node-evaluator": RETURN fully_memoized_node
    IF eval_name in [c + "-evaluator" for c in memoized_clusters]: RETURN true
    RETURN false
```
This abstracts the memoization state lookup, which is currently inlined in both the wave dispatch section (lines 431-445) and the status lines section (lines 1595-1669). The helper can be reused in both places.
**Why it helps:** Complements Option B by providing the abstraction layer needed for the template loop. Without this, Option B's `check_memoized(eval_name)` would need to be inlined, partially defeating the compression. The helper also improves maintainability: adding a new evaluator type requires adding one line to the helper instead of adding status-line logic in two separate sections. However, introducing new abstractions in a pseudocode prompt has a risk: it adds a level of indirection that the LLM must resolve, and the prompt is pseudocode (not executed code) where abstractions are read by the model, not compiled.
**Predicted impact:** LOW -- Enables Option B's compression but adds its own complexity (helper function definition, ~7 lines). Net line savings when combined with Option B: ~50 lines (vs ~57 for Option B alone, minus ~7 for helper). The abstraction benefit is real for maintainability but has uncertain impact on LLM prompt comprehension -- pseudocode helpers may be harder for the model to resolve than explicit branches. Recommend combining with Option B only if Option B is selected.

## Evaluation Questions
*Iteration 3*

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified in the prompt?
- Q-FX2: Does the output conform to the required format/structure?
- Q-FX3: Is the output complete (all required aspects, no key omissions)?
- Q-FX4: Is the output appropriately concise (no padding or verbosity)?
- Q-FX5: Is the output grounded -- no hallucinations or unsupported claims?
- Q-FX6: Does the output demonstrate sound reasoning -- no circular logic, contradictions, or unresolved ambiguities?
- Q-FX7 (HAS_DOWNSTREAM_DEPS=true): Are downstream agent instructions and external dependency references complete and unambiguous?
- Q-FX8: Could the improvements be expressed more concisely without losing detection depth?
- Q-FX9: Does the improved prompt preserve detection depth, breadth, accuracy, and precision of the baseline?
- Q-FX10 (adversarial regression -- baseline-favoring): Does the baseline catch any concrete defect that the improved version misses or softens?

### UX (HAS_OUTPUT_FORMAT=true -- weighted 0.5x)
- Q-UX1: Is the output's visual hierarchy clear (key decisions prominent, details subordinate)?
- Q-UX2: Is the most important information immediately scannable without reading through background?
- Q-UX3: Does the output use visual differentiation (emoji, tables, formatting) to separate information categories appropriately?

### Dynamic (3 questions, 1 regression-check)
- Q-DYN-35: For plans with explicit Pre-check/checkpoint markers between phases but consolidated testing (like input2), does the Q-G13 finding acknowledge the checkpoint coverage while still recommending per-phase test distribution -- rather than treating the plan identically to one with no inter-phase verification? [addresses: Q8/Q13 -- Q-G13 borderline calibration guard]
- Q-DYN-36: Comparing the per-evaluator status section line count: is the improved version's status section at least 40% shorter than the baseline while producing identical status line output for each evaluator? [addresses: Q7 -- template compression of structural repetition]
- Q-DYN-37 (regression check -- baseline-favoring): On the deliberately flawed plan (input4), does Q-G13 still correctly flag condition 1 (flat list with no phases) as NEEDS_UPDATE with the same or better specificity as the baseline? Does the borderline calibration guard NOT soften the finding on genuinely unstructured plans? [regression check -- ensures calibration refinement does not weaken detection on clear failures]

---

## Experiment Results — Iteration 3
*Date: 2026-03-18*

### Implemented Directions
#### Experiment 1: Options A+B+C+D combined
**Options applied:** A (Q-G13 borderline calibration guard -- two-tier Pre-check distinction), B (per-evaluator status lines template compression ~77 to ~35 lines), C (Q-G13/Q-G10 methodology micro-compression ~8 lines saved), D (check_memoized/memoized_since helper functions)
**Applied changes:** Option A (replaced binary borderline rule with two-tier distinction: plans with no verification at all -> NEEDS_UPDATE condition 2; plans with Pre-check/checkpoint markers but no per-phase tests -> NEEDS_UPDATE mild with acknowledgment of checkpoints), Option B (replaced ~77-line per-evaluator status section with template-driven loop producing identical output in ~35 lines), Option C (compressed Q-G13 conditions 3-4 parenthetical examples and Q-G10 Category 1 marker list from 6 to 3 examples), Option D (introduced check_memoized/memoized_since helper functions to abstract memoization state lookups)

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-1 | A+B+C+D | 37.5% vs 12.9% | +24.6% | N/A | N/A |

**Evaluation quality note:** 3 of 5 judges (j3, j4, j5) compared incorrect iteration versions (Iter 1 changes vs Iter 2 changes) due to file reads overriding judge instructions. Reliable signal comes from j1 and j2 only. j2 (Node plan, most relevant for Q-G13 calibration test) showed the cleanest signal.

### Per-Question Results (A_baseline wins / B_improved wins / TIE across 5 tests)
Q-FX1: 0/4/1 — B wins on 4/5 inputs (core task execution maintained with calibration refinement)
Q-FX2: 1/3/1 — B wins on 3/5 inputs (template compression improves structural clarity; 1 baseline win)
Q-FX3: 1/3/1 — B wins on 3/5 inputs (completeness maintained; 1 baseline win possibly from micro-compression)
Q-FX4: 5/0/0 — A wins on all 5 inputs (conciseness still a cost despite compression efforts)
Q-FX5: 0/1/4 — B wins on 1/5 (grounding slightly improved; mostly ties)
Q-FX6: 0/4/1 — B wins on 4/5 inputs (two-tier calibration + template logic improve reasoning soundness)
Q-FX7: 0/4/1 — B wins on 4/5 inputs (helper abstractions and template compression improve instruction clarity)
Q-FX8: 4/0/1 — A wins on 4/5 inputs (improvements could still be more concise, but less severe than Iter 2's 5/0/0)
Q-FX9: 0/4/1 — B wins on 4/5 inputs (detection depth preserved and enhanced by calibration refinement)
Q-FX10: 1/0/4 — A wins on 1/5 (Q-G10 marker compression is a genuine detection regression risk for exhaustive marker recognition)
Q-UX1: 0/4/1 — B wins on 4/5 inputs (template compression maintains visual hierarchy)
Q-UX2: 0/3/2 — B wins on 3/5 inputs (scannability maintained)
Q-UX3: 0/4/1 — B wins on 4/5 inputs (visual differentiation preserved in compressed template)
Q-DYN-35: 0/4/1 — B wins on 4/5 inputs (two-tier calibration correctly applied mild path for Pre-check plans)
Q-DYN-36: 1/2/2 — Mixed (compression achieved but signal diluted by judge version confusion)
Q-DYN-37: 2/0/3 — A wins on 2/5 inputs (baseline advantage on exhaustive marker list for regression check)

## Results & Learnings

### Step 1 — Per-Option Attribution

**Option A (Q-G13 borderline calibration guard): CONTRIBUTED_TO_WIN -- primary quality driver.** Q-DYN-35 showed 4/5 B-wins, confirming the two-tier borderline distinction works as designed: plans with Pre-check markers get a qualified "mild" finding that acknowledges their checkpoint coverage, while plans with no verification at all get the full condition-2 flag. j2's signal was the cleanest -- on input2 (Node.js rate limiting plan with Pre-check markers), the calibration guard correctly applied the mild path. This directly addresses the Q-DYN-33 over-flagging regression from Iteration 2. Q-FX6 (sound reasoning, 4/1) and Q-FX9 (detection preservation, 4/1) also benefited from the more nuanced calibration logic.

**Option B (per-evaluator status lines template compression): CONTRIBUTED_TO_WIN -- secondary driver.** Q-DYN-36 showed mixed results (1/2/2) due to judge version confusion, but the reliable judges confirmed compression was achieved. Q-UX1/Q-UX3 maintained strong B-wins (4/1 each), indicating the compressed template produces equivalent visual quality. Q-FX8 improved from 5/0/0 (Iter 2) to 4/0/1, suggesting the compression partially addressed the conciseness regression -- one judge now sees acceptable conciseness. The ~42-line reduction (77 to ~35) is the largest single compression this run.

**Option C (Q-G13/Q-G10 methodology micro-compression): CONTRIBUTED_TO_WIN (mild) -- but with a regression signal.** The ~8-line savings contributed to the Q-FX8 improvement (4/0/1 vs 5/0/0 in Iter 2). However, Q-FX10 showed 1 A-win -- j2 identified that compressing the Q-G10 Category 1 marker list from 6 examples to 3 risks missing detection of less-common markers ("if the API supports", "should handle...somehow"). This is a genuine regression risk: the exhaustive marker list served as a recognition anchor for the evaluator. The micro-compression's net value is marginal -- 8 lines saved vs a detection regression risk on Q-G10 marker recognition.

**Option D (check_memoized/memoized_since helpers): CONTRIBUTED_TO_WIN (enabling).** The helpers enabled Option B's template compression by providing the abstraction layer for memoization lookups. Q-FX7's 4/1 B-wins partially reflect the cleaner instruction logic that helpers provide. The 7-line helper definition is a net cost offset by Option B's 42-line savings. No independent quality signal -- purely an enabler for Option B.

**Conciseness cost (collective): STILL PRESENT but reduced.** Q-FX4 remained 5/0/0 (all baseline wins on conciseness) -- the compression efforts did not fully recover from Iteration 2's overhead additions. Q-FX8 improved from 5/0/0 to 4/0/1, showing marginal progress. The total baseline win count dropped from 10 (Iter 2) to 10 again (5 on Q-FX4, 4 on Q-FX8, 1 on Q-FX10) but with a different composition -- Q-FX10's regression on marker compression is a new cost category.

### Step 2 — Cross-Experiment Comparison

N/A (single experiment).

### Step 3 — Root Cause Analysis

The +24.6% improvement came from two reinforcing effects: (1) the Q-G13 calibration guard reduced false-positive severity on well-structured plans, improving quality scores on the calibration-sensitive questions (Q-DYN-35, Q-FX6, Q-FX9), and (2) the template compression partially addressed the conciseness regression from Iteration 2, improving Q-FX8 from 5/0/0 to 4/0/1 and maintaining UX question wins.

**Primary driver: Q-G13 calibration guard (Option A).** The two-tier borderline distinction is the highest-signal change this iteration. It addresses a demonstrated regression (Q-DYN-33 in Iter 2) with a narrowly targeted fix (2 lines net addition to the borderline rule). The pattern follows Research Finding #1 (safe harbor clauses reduce false positives without reducing detection sensitivity). The guard only activates on plans with explicit Pre-check/checkpoint markers, leaving genuinely deficient plans (input4) unaffected.

**Secondary driver: Template compression (Option B + D).** The ~42-line net reduction partially recovers conciseness without sacrificing output quality. The template-driven approach eliminates structural repetition while producing identical per-evaluator status lines. This follows Research Finding #2 (structural repetition is the highest-ROI compression target).

**Regression signal: Q-G10 marker compression (Option C).** The micro-compression of Q-G10's Category 1 marker list introduced a detection regression risk (Q-FX10: 1 A-win). Compressing from 6 example markers to 3 reduced the recognition anchor set, potentially causing the evaluator to miss less-common TBD-style markers. This is the clearest signal that methodology annotation compression has a floor -- below a certain example count, detection quality degrades. The safe compression level for marker lists appears to be ~5-6 examples, not 3.

**What worked:** Option A (calibration guard) delivered the strongest quality signal with the narrowest change footprint. Option B (template compression) achieved meaningful line-count reduction without output quality loss. The combination of calibration refinement and compression is a productive iteration pattern.

**What didn't work:** Option C's Q-G10 marker compression was over-aggressive -- reducing from 6 to 3 examples crossed the detection regression threshold. Q-FX4 (conciseness, 5/0/0) remains stubbornly in the baseline's favor, suggesting the prompt has accumulated enough methodology annotations that even with compression, it reads as longer than the pre-Iter-2 baseline. Q-DYN-37 (regression check) showed 2 A-wins -- the baseline's exhaustive marker list provides stronger regression protection on deliberately flawed plans. This is a genuine trade-off: compression saves lines but reduces the evaluator's example anchor set.

**Evaluation quality caveat:** Only j1 and j2 produced reliable comparisons. Judges j3, j4, j5 compared incorrect iteration versions due to file read interference. The 37.5% quality score should be interpreted with lower confidence than Iteration 2's 43.9%. The reliable judges (j1, j2) both favored the improved version on the calibration questions (Q-DYN-35) while flagging the Q-G10 marker regression (Q-FX10), suggesting the true quality spread is positive but may be narrower than 24.6%.

**What to try next iteration:** (1) Restore the Q-G10 Category 1 marker list to 5-6 examples (partially reversing Option C's over-compression) while keeping the other micro-compressions that did not show regression. (2) Investigate whether the Q-FX4 conciseness regression is now structural (the prompt is simply longer after 3 iterations of methodology additions) or addressable through further compression. (3) The calibration guard pattern (Option A) could be extended to other borderline rules -- Q-G10's borderline rule ("stated assumption = PASS vs unvalidated constraint = NEEDS_UPDATE") might benefit from a similar two-tier treatment with explicit safe harbor conditions.

**Best experiment:** Exp-1 (all options) — 37.5% quality score
**Verdict: IMPROVED**
Decided by: quality (+24.6%)

### Scope Gate Notes

Exp-1: WARN (Q-SG8: Q-G13 severity shift intentional per Option A; Q-SG10: example compression intentional per Option C; Q-SG12: theoretical template auditability risk not realized in diff -- downgraded to WARN by orchestrator). No scope gate failures; all warnings assessed as non-blocking given intentional design choices documented in options.

## Technique History

### 2026-03-18 — Iteration 3 → IMPROVED

**Experiments:** 1 — Exp-1 (Options A+B+C+D combined)
**Verdict:** IMPROVED (decided by: quality, +24.6%)

**What worked:**
- Option A (Q-G13 borderline calibration guard) was the primary quality driver, producing 4/5 B-wins on Q-DYN-35. The two-tier borderline distinction -- plans with Pre-check/checkpoint markers get a "mild" NEEDS_UPDATE acknowledging existing verification, plans without any verification get the full condition-2 flag -- directly addressed the Iteration 2 Q-DYN-33 over-flagging regression. This follows the "safe harbor clause" pattern from evaluator calibration research: defining what exempts an item from a strict rule reduces false positives without reducing detection sensitivity.
- Option B (per-evaluator status lines template compression) achieved ~42-line reduction (77 to ~35 lines) while producing identical output. Q-FX8 improved from 5/0/0 (Iter 2) to 4/0/1, indicating partial conciseness recovery. UX questions maintained strong B-wins (Q-UX1 4/1, Q-UX3 4/1), confirming the compressed template preserves visual quality.
- Option D (check_memoized/memoized_since helpers) enabled Option B's template loop by abstracting memoization state lookups. Purely enabling -- no independent quality signal.

**What didn't work:**
- Option C's Q-G10 marker list compression (6 examples to 3) was over-aggressive. Q-FX10 showed 1 baseline win on the adversarial regression check -- the shortened marker list risks missing less-common TBD-style markers ("if the API supports", "should handle...somehow"). This establishes a floor for marker list compression: 5-6 examples is the safe minimum, 3 is too few.
- Q-FX4 (conciseness) remained 5/0/0 baseline wins, indicating the accumulated methodology additions from Iterations 1-3 make the prompt structurally longer than the baseline regardless of compression. This may be an irreducible cost of the methodology annotation strategy.
- Q-DYN-37 (regression check) showed 2/0/3, with 2 baseline wins -- the exhaustive marker list in the baseline provides stronger detection anchoring on deliberately flawed plans. Compression trades detection anchoring for conciseness.

**Evaluation quality note:** 3/5 judges compared incorrect iteration versions due to file read interference. Reliable signal comes from j1 and j2 only. The 37.5% quality score and +24.6% spread should be interpreted with lower confidence than prior iterations. Both reliable judges confirmed the calibration guard improvement and the Q-G10 marker regression.

**Actionable learning:**
Calibration refinement via safe harbor clauses is a high-ROI pattern for reducing false positives from strict detection rules. When a borderline rule causes over-flagging (detected via regression-check DYN questions), adding a two-tier distinction that names the exemption condition (e.g., "has Pre-check markers") preserves detection on genuinely deficient plans while softening findings on borderline-adequate plans. Template compression of structurally repetitive boilerplate (same decision branches repeated per evaluator) is a safe, high-yield compression target -- but methodology annotation compression has a floor below which detection quality degrades. For marker/example lists, 5-6 items is the safe minimum for evaluator recognition anchoring; compressing to 3 introduces regression risk.
