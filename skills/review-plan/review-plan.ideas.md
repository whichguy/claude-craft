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
