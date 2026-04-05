---
# Prompt Improvement: tech-research-analyst
*Date: 2026-03-22*

## Original Prompt
Path: agents/tech-research-analyst.md

## Structural Diagnostic (Q1-Q13)

Q1 — Role/Persona: The prompt defines a clear role ("technology research specialist conducting thorough, unbiased analysis") with a well-scoped primary function. However, the persona is generic — it lacks expertise framing that would differentiate rigorous research from surface-level feature comparison. No mention of what makes this agent's output better than a simple list of pros/cons. The role description does not convey the depth of analytical rigor expected (e.g., evidence-grounded, bias-aware, methodology-explicit).

Q2 — Task Precision: The 7-phase process (Phase 0-6) is well-structured with clear inputs and outputs per phase. Two precision gaps: (1) the "Decision Scope" field (Phase 0) distinguishes "quick comparison" from "deep dive" but provides no operational definition of what changes — which phases to abbreviate or skip, what output length is appropriate for each scope. (2) Ambiguous verbs: "think deeply" (Phase 0) and "ultrathink" (Phase 5) are aspirational rather than instructional. Neither specifies what cognitive operations to perform (enumerate constraints? identify hidden assumptions? stress-test conclusions?).

Q3 — Context Adequacy: Strong on working environment (worktree isolation, file ops protocol) and tool mapping. Three gaps: (1) no guidance for multi-decision requests where the user asks about several technology categories simultaneously (e.g., stream processing + OLAP + orchestration), (2) no handling for when the user's request doesn't fit the single-research-question framework (e.g., "recommend 2-3 coherent stack configurations"), (3) no instruction for what happens when WebSearch returns no useful results — does the agent fall back to training data, explicitly note the gap, or retry with different queries?

Q4 — Output Format: Well-specified with three output documents (main research doc, decision doc, reconciliation JSON), a markdown skeleton template, and per-phase output targets. The main document skeleton provides clear section structure. Gap: no length guidance for the main research document — a "quick comparison" and a "deep dive" would produce the same structure, just with undefined levels of depth. The scoring matrix format (Phase 4) says "1-5 or 1-10" without picking one, introducing inconsistency.

Q5 — Examples: No few-shot examples provided. Given 7 phases, 6 gates, and 3 output documents, the agent must infer expected depth/format from descriptions alone. Most impactful example targets: (a) a sample scoring matrix row showing the expected justification style, (b) a sample "choose this when..." entry demonstrating appropriate specificity, (c) a sample trade-off statement showing the format "A excels at X but sacrifices Y." Adding full phase examples would bloat the already-long prompt (~317 lines); targeted micro-examples at key ambiguity points would be more effective.

Q6 — Constraints: Missing constraints: (1) no scope control for "quick comparison" — how many phases to run, how deep to go, target document length, (2) no constraint on when to stop researching vs. retry with different search queries when data is sparse, (3) no handling of user's preferred candidate being clearly dominant — should analysis still maintain artificial balance? (4) no explicit constraint against introducing candidates the user didn't request without justification, (5) no token/length budget awareness — the full 7-phase process could produce 3000+ lines without a stopping heuristic.

Q7 — Anti-patterns: (1) "Think deeply" and "Ultrathink" are vague hedging — they signal desired depth without specifying operations. (2) "comprehensive enough to support confident technology decisions" is a circular definition of quality. (3) The six-gate system with retry logic adds substantial process overhead that may not pay off for simple requests, but there is no mechanism to reduce ceremony for lower-stakes decisions. (4) Minor: the instruction "Do NOT rely solely on training data" is good but the fallback behavior when external sources fail is unspecified.

Q8 — Chain-of-thought: The phased structure implicitly enforces sequential reasoning. Phase 4 includes excellent explicit reflection ("Are there clear winners emerging? Where is the data weakest? What biases might be influencing the assessment?") and Phase 5 has steel-manning. However, Phases 1-3 lack mid-phase reflection prompts — the agent could complete data gathering mechanically without synthesizing cross-candidate patterns. Adding a brief synthesis step before each gate ("What patterns emerge from the data gathered? What surprised you?") would improve analytical depth.

Q9 — Domain specifics: Good coverage of web technology domains (frontend/backend frameworks). Missing: (1) no guidance for non-web domains (ML frameworks, databases, infrastructure tools, DevOps, data engineering) — the examples skew heavily toward JS/web, (2) no reference to established technology evaluation methodologies (ATAM for architecture trade-offs, Gartner quadrant positioning, ThoughtWorks Radar classifications), (3) no mention of compliance/regulatory evaluation beyond generic "risk matrix" — domains like fintech (PCI DSS), health-tech (HIPAA), or regulated industries need specific security/compliance evaluation patterns, (4) no guidance for evaluating managed services vs. self-hosted trade-offs, which is a distinct evaluation dimension from the current four (Technical/Business/Team/Future).

Q10 — Tone/register: Appropriate professional-analytical tone for the dual audience (technical team + business stakeholders). The two-document output strategy (full research + decision summary) correctly addresses the audience split. No issues here.

Q11 — Parallelization: The 7 phases are strictly sequential (each depends on prior phase output), which is appropriate. However, within phases, significant parallelization potential exists: Phase 1 market research per candidate (3-5 parallel WebSearch batches), Phase 2 technical evaluation per candidate (independent evaluations), Phase 6 reference verification (embarrassingly parallel URL checks). No MAX_CONCURRENT limit is specified, and no guidance on batching within-phase work is provided. For a prompt running on Sonnet that may spawn tool calls, this is a missed optimization.

Q12 — Failure modes & recovery: The gate system handles phase-level failures well (2 retries then user escalation). Missing failure modes: (1) WebSearch/WebFetch returns no useful results for a candidate — no fallback specified, (2) contradictory data from different sources — no resolution guidance (prefer more recent? prefer official sources? document both?), (3) candidate technology too new to have benchmark data — proceed without or exclude? (4) user request doesn't fit single-question framework (multi-decision requests) — no decomposition or routing strategy, (5) research scope creep — no instruction to stay within the original research question if interesting tangents emerge.

Q13 — Calibration & thresholds: Gate thresholds are precisely defined (PASS >= 80%, CONDITIONAL 60-79%, FAIL < 60%) with clear iteration limits and escalation paths — this is a strength. Gap: the scoring matrix scale in Phase 4 is ambiguous ("1-5 or 1-10") instead of prescribing one. No calibration anchors are provided for what constitutes a "1" vs "5" on any evaluation criterion (e.g., what does a "3" for performance mean? Average for the category? Meets requirements?). Without anchors, scores are subjective and incomparable across analyses. The maturity classifications in Phase 1 (Emerging/Growing/Mature/Declining) have brief definitions, which is good.

## Domain & Research Findings
Domain: Multi-phase technology evaluation agent with gated quality control, producing stakeholder-ready decision support documents from web research and codebase analysis.

Research summary:

1. **ReAct pattern (Reasoning + Acting)**: Agent research from Lilian Weng and the Prompt Engineering Guide highlights that interleaving explicit reasoning traces ("Thought") with tool actions ("Action") and result interpretation ("Observation") significantly improves research quality. The current prompt has phases and gates but lacks explicit Thought-Observation cycles within phases — the agent gathers data and writes output without a mandated synthesis/interpretation step between data collection and gate evaluation. Adding a brief "Interpret" step before each gate would force the agent to extract meaning from raw data rather than just passing it through.

2. **Self-reflection for research quality**: The Reflexion pattern (detecting reasoning loops, evaluating trajectory quality) applies directly. The prompt has good reflection in Phases 4-5 but none in Phases 1-3. Research shows that mid-process reflection catches systematic biases earlier — e.g., the agent might unconsciously favor the most-documented technology because it has more data, not because it's better.

3. **Planning decomposition for multi-faceted requests**: The complex test input (3 distinct technology decisions) reveals that the prompt assumes a single research question. LLM+P and similar planning patterns suggest that complex requests should first be decomposed into independent sub-questions, each processed through the evaluation framework, then synthesized. The current prompt lacks this decomposition capability.

4. **Calibration anchors for scoring consistency**: Prompt engineering research consistently shows that numerical scoring without anchored rubrics produces inconsistent results across runs. Providing concrete anchor descriptions (what a "1" and "5" look like) for each scoring dimension dramatically improves consistency.

## Test-Run Observations

**Simple input (CSS framework, quick comparison, 3-person team)**: The user explicitly asks for "a quick comparison and give us a recommendation." The current prompt would over-deliver catastrophically — running all 7 phases with 6 gates, producing a multi-thousand-line document with market analysis, business analysis, talent pool data, and risk matrices for a straightforward CSS framework choice. The "Decision Scope" field in Phase 0 captures the user's intent as "quick comparison" but there are no operational instructions that reduce the subsequent phases. The agent would either (a) dutifully execute all phases, wasting significant time and tokens, or (b) inconsistently skip phases without clear guidance on which to skip and how to compress. Neither outcome serves the user well.

**Moderate input (backend framework, deep dive, fintech)**: Best fit for the current prompt. Four candidates with ranked priorities, rich context, clear stakeholder audience. The prompt would handle this well. Potential shortcoming: the PCI DSS compliance requirement is critical but the prompt's risk matrix (Phase 3) provides only generic categories (adoption risk, technical risk, vendor risk) without specific guidance on evaluating regulatory compliance capabilities — a critical dimension for fintech, health-tech, and government contexts.

**Complex input (3 technology decisions, stack configurations)**: The prompt would fail to serve this request effectively. (1) The user asks for 3 distinct evaluations (stream processing, OLAP, orchestration) but the prompt assumes a single "research question." No decomposition strategy exists. (2) The user requests "2-3 coherent stack configurations" representing different trade-off profiles — this is a synthesis/architecture task that cuts across individual technology comparisons, but the prompt's output format is per-technology, not per-configuration. (3) The user asks to "validate or challenge" a specific assumption ("just use Kafka for everything") — the prompt has no guidance for addressing stakeholder hypotheses or pre-existing biases. The agent would likely either pick one of the three decisions to evaluate deeply (ignoring the others) or produce an unfocused document that doesn't map to any of the three output templates.

## Improvement Options

### Option A: Scope-Adaptive Execution Paths
**Addresses:** Q2, Q6, Q7 — Task Precision, Constraints, Anti-patterns (no operational difference between quick and deep modes)
**What changes:** Replace the implicit quick/deep distinction with explicit execution profiles. After Phase 0 Requirements Extraction, add a decision point: (1) **Quick Mode** (user wants "quick comparison" or request is straightforward): execute Phases 0, 2-abbreviated, 4-abbreviated, 5 only. Skip market landscape (Phase 1), business analysis (Phase 3), reference compilation (Phase 6). Produce only the Decision Document. Gates reduced to a single combined quality check. Target: <800 lines of output. (2) **Standard Mode**: full 7-phase execution as currently specified. (3) **Multi-Decision Mode** (request contains multiple distinct technology decisions): decompose into independent sub-questions in Phase 0, execute Standard or Quick mode for each, then add a Synthesis phase producing "stack configurations" that combine recommendations across sub-questions. Add explicit criteria for mode selection based on Phase 0 signals (number of candidates, user's stated scope, number of distinct decisions).
**Why it helps:** The simple test input explicitly asks for "quick comparison" but would get the full 7-phase treatment. The complex test input asks for 3 decisions but would get forced into a single-question framework. This change makes the prompt responsive to actual request complexity rather than always running at maximum depth.
**Predicted impact:** HIGH — directly addresses the most common failure mode (scope mismatch between user request and prompt execution) and the most severe test-run observation (complex multi-decision requests).

### Option B: Mid-Phase Reflection and Contradiction Handling
**Addresses:** Q8, Q12 — Chain-of-thought (no reflection in Phases 1-3), Failure modes (no contradictory data handling)
**What changes:** Add a "Synthesize" step before each gate in Phases 1-3: "Before evaluating the gate, answer: (1) What patterns emerge across candidates? (2) Does any data point contradict another? If so, note both sources and state which you weight more heavily and why. (3) What's the most surprising finding so far?" Also add explicit failure-mode handling: when WebSearch returns no useful results for a candidate, state the gap explicitly in the output and note reduced confidence for that candidate. When sources contradict, document both with dates and prefer more recent, primary sources over secondary summaries.
**Why it helps:** Research on agent reasoning shows that forced mid-process reflection catches systematic biases earlier (e.g., favoring better-documented technologies) and produces more nuanced analysis. The contradiction handling addresses a real failure mode where the agent currently has no guidance and might silently pick whichever data point it encountered last.
**Predicted impact:** MEDIUM — improves analytical depth and evidence quality but doesn't address the structural scope-mismatch issue.

### Option C: Scoring Calibration Anchors and Scale Standardization
**Addresses:** Q4, Q13 — Output Format (ambiguous 1-5 or 1-10 scale), Calibration (no anchor definitions)
**What changes:** Standardize on a 1-5 scale with explicit anchor definitions: 1 = "Significant weakness; would likely cause problems for this project"; 2 = "Below average; workable but a notable disadvantage"; 3 = "Adequate; meets basic needs without distinction"; 4 = "Strong; clear advantage in this area"; 5 = "Exceptional; best-in-class for this criterion among candidates evaluated." Require the scoring matrix to include a one-sentence justification per cell referencing specific evidence from Phases 1-3. Add an example scoring matrix row to demonstrate the expected format.
**Why it helps:** The current "1-5 or 1-10" ambiguity means different runs could use different scales, making results incomparable. Without anchors, a "3" is meaningless — it could mean "average among all technologies ever" or "adequate for this use case." Calibration anchors ground scores in the project context and force evidence-based justification.
**Predicted impact:** MEDIUM — improves consistency and defensibility of the comparative analysis (Phase 4) and downstream recommendation (Phase 5), but is a narrower fix than Options A or B.

### Option D: Compliance and Regulatory Evaluation Dimension
**Addresses:** Q9, Q12 — Domain specifics (no regulatory/compliance guidance), Failure modes (fintech/health-tech requests under-served)
**What changes:** Add a fifth evaluation dimension — **Compliance/Security** — that activates when the user mentions regulatory requirements (PCI DSS, HIPAA, SOC 2, GDPR, FedRAMP, etc.) or operates in a regulated industry. When active, Phase 3 Business Analysis gains specific evaluation criteria: (1) Does the technology/vendor offer a BAA, SLA, or compliance certification? (2) What is the security track record (CVE history, security audit frequency)? (3) Does it support required controls (encryption at rest/in transit, audit logging, access controls)? (4) Is there precedent for this technology being used in the same regulatory context? Add corresponding gate criteria to Gate 3 when this dimension is active.
**Why it helps:** Both the moderate test input (PCI DSS) and complex test input (HIPAA) involve regulatory constraints that the current prompt handles only through a generic "risk matrix." Regulated-industry technology decisions often hinge on compliance capability, not just performance or developer experience. Without specific evaluation guidance, the agent under-weights this critical dimension.
**Predicted impact:** MEDIUM — addresses an important domain gap that affects a significant subset of real-world technology decisions, but is additive rather than structural.

## Evaluation Questions
*Iteration 1*

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified?
- Q-FX2: Does the output conform to the required format/structure?
- Q-FX3: Is the output complete (all required aspects, no key omissions)?
- Q-FX4: Is the output appropriately concise (no padding or verbosity)?
- Q-FX5: Is the output grounded — no hallucinations or unsupported claims?
- Q-FX6: Does the output demonstrate sound reasoning — no circular logic, contradictions, or unresolved ambiguities?
- Q-FX8: Could the improvements be expressed more concisely — do the changes achieve the same quality gain without adding unnecessary prompt verbosity?
- Q-FX9: Does the improved prompt preserve detection depth, breadth, accuracy, and precision — does it not sacrifice evaluator thoroughness for calibration, conciseness, or format changes?
- Q-FX10 (adversarial regression — baseline-favoring): Does the baseline catch any concrete defect or requirement the improved version misses or softens? (A wins if yes, TIE if equivalent, B only if improved also catches everything A catches.)

### UX (weighted 0.5x)
- Q-UX1: Is the output's visual hierarchy clear (key decisions prominent, details subordinate)?
- Q-UX2: Is the most important information immediately scannable without reading through background?
- Q-UX3: Does the output use visual differentiation (emoji, tables, formatting) to separate information categories appropriately?

### Dynamic (derived from Q1-Q13 gaps addressed this iteration)
- Q-DYN-1: When given a "quick comparison" request (simple test input), does the prompt produce a proportionally scoped output rather than running all 7 phases at full depth? [addresses: Q2, Q6]
- Q-DYN-2: When given a multi-decision request (complex test input with 3+ distinct technology choices), does the prompt decompose the request into manageable sub-questions rather than forcing a single-research-question framework? [addresses: Q3, Q12]
- Q-DYN-3: Does the scoring matrix use a single, clearly defined scale with calibration anchors, producing consistent and defensible comparative scores? [addresses: Q4, Q13]
- Q-DYN-4 (regression check — baseline perspective): Does the improved prompt preserve the baseline's strong gate system (precise thresholds, retry limits, debt markers, user escalation) without diluting gate rigor? [addresses: Q13 — regression guard]

## Experiment Results — Iteration 1
*Date: 2026-03-22*

### Implemented Directions

#### Experiment 1: All Options A+B+C+D Combined
**Options applied:** A (Scope-Adaptive Execution Paths), B (Mid-Phase Reflection + Contradiction Handling), C (Scoring Calibration Anchors), D (Compliance/Security Dimension)
**Applied changes:** Three execution modes (Quick/Standard/Multi-Decision) with explicit phase-skip rules; Synthesize Before Gate subsections with 3 reflection questions before Gates 1-3; 1-5 scoring scale with anchor definition table + per-cell one-sentence justification + example row; conditional Compliance/Security dimension with 4-criteria evaluation activated by regulatory context

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Delta | Latency Delta |
|------------|---------|---------------------|--------|-------------|---------------|
| Exp-1 | A+B+C+D | 42.6% vs 5.3% | +37.3% | +9.6% | -2.1% |

### Per-Question Results (A wins / B wins / TIE across 3 tests)

| Question | A wins | B wins | TIE | Key Pattern |
|----------|--------|--------|-----|-------------|
| Q-FX1 (task completion) | 0 | 2 | 1 | B wins on simple (Quick Mode proportional) and complex (multi-decision decomposition); TIE on moderate |
| Q-FX2 (format conformance) | 1 | 1 | 1 | Baseline slightly better structured on moderate; Exp-1 better on complex |
| Q-FX3 (completeness) | 1 | 2 | 0 | Baseline catches moderate detail; Exp-1 more complete on simple and complex |
| Q-FX4 (conciseness) | 1 | 2 | 0 | Baseline slightly more concise on complex; Exp-1 more concise on simple and moderate |
| Q-FX5 (groundedness) | 0 | 2 | 1 | Exp-1 explicitly documents search gaps and contradictions |
| Q-FX6 (reasoning quality) | 0 | 3 | 0 | Exp-1 consistently better reasoning across ALL inputs — strongest signal |
| Q-FX8 (prompt verbosity justified) | 1 | 2 | 0 | Exp-1 additions largely justified; one moderate-case concern |
| Q-FX9 (detection depth preserved) | 0 | 2 | 1 | Exp-1 adds depth; baseline doesn't have more |
| Q-FX10 (adversarial regression) | 2 | 0 | 1 | Baseline catches MUI DataGrid licensing (simple) and operational detail (moderate) — REGRESSION SIGNAL |
| Q-UX1 (visual hierarchy) | 0 | 3 | 0 | Exp-1 better across all inputs |
| Q-UX2 (scannability) | 0 | 3 | 0 | Exp-1 better across all inputs |
| Q-UX3 (visual differentiation) | 0 | 3 | 0 | Exp-1 better across all inputs |
| Q-DYN-1 (quick mode scoping) | 0 | 1 | 2 | Exp-1 clearly better on simple; others N/A |
| Q-DYN-2 (multi-decision decomposition) | 0 | 1 | 2 | Exp-1 clearly better on complex; others N/A |
| Q-DYN-3 (scoring calibration) | 0 | 3 | 0 | Exp-1 wins across all inputs — baseline has no scoring scale |
| Q-DYN-4 (gate rigor preserved) | 0 | 1 | 2 | Exp-1 preserves and extends rigor |

### Scope Gate Warnings
- Q-SG3: Quick Mode introduces implicit exclusion constraints for phases — justified by Option A assignment.
- Q-SG8: Quick Mode gate criteria interaction with full gate checklists could cause minor confusion due to separate abbreviated criteria definitions.
- Q-SG12: Phase 0 "Decision Scope" item replaced by "Decision Count", with scope determination moved to Execution Mode Decision section — minor structural change.

## Results & Learnings

### Per-Option Attribution

| Option | Verdict | Evidence |
|--------|---------|----------|
| A (Scope-Adaptive Execution Paths) | CONTRIBUTED_TO_WIN | Q-DYN-1 (quick mode: B wins on simple), Q-DYN-2 (multi-decision: B wins on complex), Q-FX1 (task completion: B wins on simple + complex). Directly addressed the most severe failure mode — scope mismatch. However, Q-FX10 regression on simple input (MUI DataGrid licensing missed) suggests Quick Mode phase-skipping can drop detail. |
| B (Mid-Phase Reflection + Contradiction Handling) | CONTRIBUTED_TO_WIN | Q-FX6 (reasoning quality: B wins ALL 3 — strongest signal in entire evaluation), Q-FX5 (groundedness: B wins 2/3 with explicit gap/contradiction documentation). Synthesize Before Gate steps forced interpretation rather than mechanical data pass-through. |
| C (Scoring Calibration Anchors) | CONTRIBUTED_TO_WIN | Q-DYN-3 (scoring calibration: B wins ALL 3 — baseline had no defined scale). Clean addition with minimal token cost. Transformed subjective numbers into evidence-grounded assessments. |
| D (Compliance/Security Dimension) | NEUTRAL-TO-POSITIVE | No isolated dynamic question measured compliance directly. Q-FX3 completeness improvement on simple and complex may partially reflect compliance additions. Moderate test (fintech/PCI DSS) showed completeness going to baseline — the conditional activation may not have triggered optimally, or competing detail displaced compliance focus. |

### Root Cause Analysis

The +37.3% quality spread is driven by three reinforcing mechanisms operating at different levels of the prompt:

1. **Structural scope matching (Option A)** eliminated catastrophic over-delivery on simple requests and under-delivery on complex multi-decision requests. The prompt now responds proportionally to request complexity instead of always running maximum depth. This is the highest-leverage change because it affects whether the output even addresses the right question.

2. **Analytical depth through reflection (Option B)** forced the agent to synthesize and interpret data rather than mechanically collecting and forwarding it. Q-FX6 (reasoning quality) was the only functional metric with unanimous B wins across all three test inputs, indicating that mid-phase reflection is a universally beneficial technique regardless of input complexity.

3. **Scoring calibration (Option C)** transformed the comparative analysis from ambiguous numbers into defensible, evidence-grounded assessments. This is a narrower fix but it directly improved the most user-facing artifact (the scoring matrix and recommendation).

The UX metrics (Q-UX1, Q-UX2, Q-UX3) showed unanimous improvement across all inputs, suggesting the structural changes also improved output organization and readability as a side effect.

**What worked:**
- Scope-adaptive execution modes (Quick/Standard/Multi-Decision) with explicit phase-skip rules — directly addressed the most common failure mode
- "Synthesize Before Gate" reflection steps with 3 specific questions — produced the strongest single-metric improvement (Q-FX6: unanimous wins)
- Standardized 1-5 scoring scale with anchor definitions and example row — eliminated ambiguity at low token cost
- Search failure handling protocol (explicitly state gaps, note reduced confidence) — improved groundedness
- Contradictory source resolution rules (prefer recent, prefer primary, document both) — improved evidence quality
- All UX dimensions improved unanimously — structural improvements cascaded into better readability

**What didn't work:**
- Q-FX10 adversarial regression (2A/0B/1TIE): Quick Mode's phase-skipping dropped detail-level findings that the full baseline process caught (MUI DataGrid licensing concern on simple input, operational detail on moderate input). The abbreviated execution path trades thoroughness for proportionality — this trade-off needs refinement.
- Option D (Compliance/Security) showed no clear isolated signal. The conditional activation design may need stronger trigger criteria or more prominent placement to ensure it fires reliably when regulatory context is present.
- Q-SG8 scope gate warning: Quick Mode gate criteria defined separately from full gate checklists creates minor ambiguity about which criteria apply when.

**Root cause analysis:** The experiment succeeded because it addressed three distinct failure layers simultaneously: (1) the prompt's inability to match output scope to request complexity (structural), (2) the agent's tendency toward mechanical data collection without synthesis (analytical), and (3) the scoring system's lack of grounding (evaluative). These three fixes are complementary — scope matching ensures the right phases run, reflection ensures those phases produce insight rather than data dumps, and calibration ensures the comparative output is defensible. The +9.6% token increase is modest relative to the +37.3% quality gain, confirming the additions are cost-effective.

**What to try next iteration:**
1. **Mitigate Quick Mode regression:** Add a "Quick Mode detail check" step that explicitly scans for licensing, cost, and operational gotchas even when skipping full Phase 1/3 analysis — addresses the Q-FX10 adversarial regression signal.
2. **Strengthen Option D activation:** Make compliance dimension activation more explicit by adding keyword detection in Phase 0 ("If the user mentions any of: PCI DSS, HIPAA, SOC 2, GDPR, FedRAMP, or states they work in fintech/healthcare/government, ACTIVATE compliance evaluation") with a louder signal than current conditional gate items.

**Best experiment:** Exp-1 (A+B+C+D) — 42.6% quality score
**Verdict: IMPROVED**
Decided by: quality

---
## Technique History

### 2026-03-22 — Iteration 1 -> IMPROVED

**Experiments:** 1 parallel — best was Exp-1 (A+B+C+D)
**Verdict:** IMPROVED (decided by: quality)

**What worked:**
- Scope-adaptive execution modes (Quick/Standard/Multi-Decision) eliminated catastrophic scope mismatch between user intent and prompt execution
- Mid-phase "Synthesize Before Gate" reflection steps with 3 targeted questions produced unanimous reasoning quality improvement across all test inputs
- Standardized 1-5 scoring scale with anchor definitions and example row eliminated ambiguity at minimal token cost
- Explicit search failure handling and contradictory source resolution improved groundedness

**What didn't work:**
- Quick Mode phase-skipping introduced adversarial regression: detail-level findings (licensing concerns, operational specifics) dropped when phases were abbreviated
- Compliance/Security dimension (Option D) showed no isolated positive signal — conditional activation may be too subtle

**Actionable learning:**
Scope-adaptive execution paths and mid-phase reflection are high-leverage, complementary techniques: scope matching ensures the right work happens, reflection ensures that work produces insight rather than data dumps. The primary risk of scope reduction is detail regression — any abbreviated mode needs explicit safety checks for licensing, cost, and operational gotchas that would otherwise surface in skipped phases.

---
*Date: 2026-03-22 — Iteration 2*

## Structural Diagnostic (Q1-Q13) — Iteration 2

Q1 — Role/Persona: The iteration 1 prompt retains the same generic opening: "You are a technology research specialist conducting thorough, unbiased analysis." This was flagged in iteration 1 diagnostics but not addressed. Research on ExpertPrompting (Xu et al., 2023) demonstrates that enriched expert persona descriptions — specifying the expert's methodology, epistemic standards, and what distinguishes their analysis from a generalist's — measurably improve output quality. The current prompt describes *what* the agent does (market analysis, technical evaluation, etc.) but not *how it thinks* as an expert (evidence-weighting, bias-awareness, methodology-explicit reasoning). Adding 2-3 sentences establishing the agent's analytical identity — an expert who prioritizes primary sources over secondary summaries, who explicitly quantifies uncertainty, who steel-mans alternatives before recommending — would ground the persona in epistemic commitments rather than task descriptions.

Q2 — Task Precision: RESOLVED by iteration 1. Scope-adaptive execution modes (Quick/Standard/Multi-Decision) with explicit phase-skip rules replaced the ambiguous quick/deep distinction. "Think deeply" and "Ultrathink" remain as phrasing but are now contextualized by operational reflection questions. Residual concern: "Think deeply" in Phase 0 still lacks operational specificity — it could be replaced with concrete cognitive operations ("enumerate hidden constraints, identify unstated assumptions, articulate what would change the recommendation").

Q3 — Context Adequacy: MOSTLY RESOLVED by iteration 1. Multi-Decision Mode handles multi-decision requests; search failure handling addresses WebSearch gaps. Residual gap: no guidance for handling stakeholder pre-existing biases or hypotheses the user wants validated/challenged (the complex test input explicitly asks to "validate or challenge" the CTO's Kafka assumption — the prompt has no instruction for this pattern).

Q4 — Output Format: RESOLVED by iteration 1. Standardized 1-5 scale, example scoring matrix row, per-mode output specifications with length targets. No remaining gaps.

Q5 — Examples: PARTIALLY addressed. One example scoring matrix row was added in iteration 1. However, the prompt still lacks examples at two other key ambiguity points: (a) no example of a "choose this when..." entry showing expected specificity level, (b) no example of a trade-off statement showing the format "A excels at X but sacrifices Y." These are the exact micro-examples identified in the iteration 1 diagnostic as "most impactful" but only one of three was implemented. The scoring matrix row example proved effective (Q-DYN-3 won unanimously); adding the remaining two micro-examples would extend the same benefit to trade-off documentation and candidate selection guidance — two output elements with no format anchoring.

Q6 — Constraints: MOSTLY RESOLVED by iteration 1. Quick Mode has phase-skip rules and <800 line target. OPEN REGRESSION: Q-FX10 results showed Quick Mode drops detail-level findings (licensing concerns, operational specifics). The "What to try next iteration" section from iteration 1 explicitly recommended: "Add a Quick Mode detail check step that explicitly scans for licensing, cost, and operational gotchas even when skipping full Phase 1/3 analysis." This has not yet been implemented. Additional residual: no constraint against scope creep — no instruction to stay within the original research question if interesting tangents emerge during data gathering.

Q7 — Anti-patterns: MOSTLY RESOLVED. The gate ceremony adapts via execution mode. "Think deeply" (Phase 0) and "Ultrathink" (Phase 5) remain as vague hedging — they are aspirational direction words rather than operational instructions. "Comprehensive enough to support confident technology decisions" (closing paragraph) is still a circular quality definition. These are minor issues now that the structural problems are solved.

Q8 — Chain-of-thought: RESOLVED by iteration 1. "Synthesize Before Gate" reflection steps with 3 targeted questions (Patterns, Contradictions, Surprise) added to Phases 1-3. Phase 4 reflection and Phase 5 steel-manning preserved. No remaining gaps.

Q9 — Domain specifics: PARTIALLY addressed. Compliance/Security dimension added for regulated industries. Still missing: (1) examples skew heavily JS/web — Phase 1 mentions "State of JS/CSS surveys," Phase 2 mentions "js-framework-benchmark," and the example scoring row references "TechEmpower" and "js-framework-benchmark." No equivalent examples for databases (db-benchmarks.com, TPC benchmarks), infrastructure (CNCF landscape), ML frameworks (MLPerf), or data engineering (Decodable benchmarks). The complex test input evaluates stream processing, OLAP databases, and orchestration tools — none of which match the JS-centric examples. (2) No guidance for managed vs. self-hosted evaluation, which is a primary decision axis for the complex test input ("we can't babysit complex distributed systems — managed/serverless preferred where possible, but we need escape hatches").

Q10 — Tone/register: No change needed. Appropriate professional-analytical tone maintained.

Q11 — Parallelization: NOT addressed in iteration 1. Within Phases 1-2, candidate evaluations are independent and could be parallelized. The prompt provides no guidance on batching tool calls per-candidate vs. per-dimension. While this is a performance optimization rather than a quality improvement, for a Sonnet-model agent running 3-5 WebSearch calls per candidate across 4+ candidates, explicit batching guidance could significantly reduce latency. The prompt currently sequences tool calls implicitly by listing tasks in order, which encourages serial execution.

Q12 — Failure modes & recovery: MOSTLY RESOLVED. Search failures, contradictory sources, and multi-decision decomposition all handled. Residual: (1) no guidance for handling stakeholder hypotheses ("our CTO thinks we should just use Kafka") — the agent might ignore the hypothesis, or validate it without rigor, or challenge it without addressing the stakeholder's reasoning. (2) No scope-creep prevention — the agent could discover an interesting tangent during Phase 2 research and pursue it outside the original research question. (3) No guidance for when a candidate is too new to have any external data (no benchmarks, no surveys, no case studies) — should it be flagged as high-uncertainty or excluded?

Q13 — Calibration & thresholds: RESOLVED by iteration 1. 1-5 scale with labeled anchors, example row, per-cell justification requirement. Gate thresholds preserved. No remaining gaps.

## Test-Run Observations — Iteration 2

**Simple input (CSS framework, quick comparison)** — With iteration 1 changes, the prompt would correctly activate Quick Mode, skip Phases 1/3/6, produce only the Decision Document at <800 lines. The Q-FX10 regression concern remains: Quick Mode skips Phase 3 (Business Analysis), which is where licensing and cost evaluation happens. For the CSS framework comparison, this could miss that MUI (Material UI) has a paid tier for advanced DataGrid components — a practical detail that would surprise the user if discovered after adoption. The current Quick Mode has no compensating mechanism to catch such licensing/cost gotchas. Adding a brief "practical gotchas" check to Quick Mode's abbreviated Phase 2 or combined gate would address this without reintroducing full Phase 3 overhead.

**Moderate input (backend framework, fintech, PCI DSS)** — Standard Mode with compliance_active: true. The prompt would handle this well. The compliance evaluation criteria (certifications, CVE history, required controls, regulatory precedent) are well-specified. One subtle gap: the user asks for "migration considerations since we'll be running the new framework alongside existing Flask services during transition." Phase 4 includes migration assessment in Standard Mode, but the migration guidance is generic ("what would it take to switch from the user's current stack to each candidate?"). For the fintech case, migration must also address compliance continuity — ensuring the transition period doesn't create compliance gaps. This is a domain-specific concern that the current prompt doesn't surface. The role/persona lacks framing that would prioritize this kind of risk-aware thinking.

**Complex input (3 technology decisions, health-tech, HIPAA)** — Multi-Decision Mode would activate, decomposing into 3 sub-questions. The Synthesis Phase would produce 2-3 stack configurations. This matches the user's request well. Remaining gaps: (1) The user explicitly asks to "validate or challenge" the CTO's "just use Kafka for everything" assumption — the prompt has no instruction for testing stakeholder hypotheses against evidence. The agent might ignore this request or address it superficially. (2) The user specifies a $180K/year budget constraint — the prompt's Phase 3 cost analysis says "estimate relative infrastructure costs (low/medium/high)" but has no guidance for evaluating against a specific dollar budget. (3) The managed vs. self-hosted axis ("we can't babysit complex distributed systems") is a primary decision criterion but doesn't appear in the evaluation framework dimensions. The agent would need to infer this as a sub-criterion of "Technical" or "Business" rather than having explicit guidance.

## Improvement Options — Iteration 2

### Option A: Quick Mode Safety Net for Licensing, Cost, and Operational Gotchas
**Addresses:** Q6 — Constraints (Quick Mode detail regression identified as adversarial regression in iteration 1)
**What changes:** Add a "Practical Gotchas Check" step within Quick Mode's abbreviated Phase 2, executed after the architecture overview and before the combined gate. The step instructs: "Even though Phases 1, 3, and 6 are skipped in Quick Mode, briefly check each candidate for three common surprise factors: (1) Licensing traps — does any candidate have paid tiers, per-seat licensing, or commercial-use restrictions that affect the user's context? (2) Operational cost cliffs — does any candidate have known cost scaling concerns (e.g., pricing that jumps at scale, heavy resource requirements)? (3) Known operational pain points — are there widely-reported production issues, breaking changes in recent versions, or deprecation warnings? One WebSearch per candidate targeting '{candidate} licensing issues OR pricing gotchas OR production problems {current year}' is sufficient. Document any findings; if none found, state 'no licensing, cost, or operational flags found for {candidate}.'" Add a corresponding gate criterion to the combined Quick Mode gate: "Licensing, cost, and operational gotchas checked for each candidate."
**Why it helps:** Directly addresses the Q-FX10 adversarial regression from iteration 1 where Quick Mode missed MUI DataGrid licensing and operational details. This is the explicit recommendation from "What to try next iteration" in the prior results. The fix is lightweight (1 search per candidate, 3-5 sentences of output) but prevents the most impactful category of detail loss. The simple test input's CSS framework comparison would catch MUI's paid tier, which the current Quick Mode misses.
**Predicted impact:** HIGH — directly mitigates the only regression signal from iteration 1 while adding minimal overhead to Quick Mode's lean execution path.

### Option B: Enriched Expert Persona with Epistemic Commitments
**Addresses:** Q1 — Role/Persona (generic persona that doesn't convey analytical rigor or methodology)
**What changes:** Replace the opening paragraph ("You are a technology research specialist conducting thorough, unbiased analysis...") with an enriched persona that specifies epistemic commitments and analytical identity: "You are a senior technology research analyst with deep experience in technical due diligence for engineering organizations. Your analysis is distinguished by three commitments: (1) Evidence over intuition — you cite specific benchmarks, adoption data, and production case studies rather than making general claims. When data is unavailable, you state the gap and its impact on confidence rather than filling it with plausible-sounding assertions. (2) Decision-relevant framing — every finding is connected to the user's specific decision context. A benchmark result without interpretation ('what does this mean for YOUR scale/team/timeline?') is incomplete. (3) Steel-manned alternatives — before recommending, you construct the strongest possible case for each alternative. Your recommendation survives this adversarial test." Also replace "Think deeply" (Phase 0) with "Enumerate the hidden constraints, unstated assumptions, and second-order consequences of this decision. What would change the recommendation?" and replace "Ultrathink" (Phase 5) with "Construct the strongest possible argument against your primary recommendation. What conditions would make the runner-up the better choice? What would a skeptical CTO challenge in your reasoning?"
**Why it helps:** ExpertPrompting research (Xu et al., 2023) demonstrates that enriched expert persona descriptions improve output quality by grounding the model's behavior in specific expert commitments rather than generic task descriptions. The current prompt tells the agent what to do (market analysis, technical evaluation) but not how to think. The epistemic commitments — evidence-grounding, decision-relevance, steel-manning — target the exact quality dimensions that matter most for technology evaluation. Replacing "Think deeply" and "Ultrathink" with operational instructions eliminates the last two vague hedging anti-patterns (Q7).
**Predicted impact:** MEDIUM — improves analytical depth and reasoning quality across all inputs. The effect is diffuse (influences every phase) rather than targeted (like Option A which fixes one specific regression). Research suggests persona enrichment has a multiplicative effect on reasoning quality but is harder to isolate in A/B testing.

### Option C: Micro-Examples for Trade-offs and "Choose This When" Guidance
**Addresses:** Q5 — Examples (only 1 of 3 identified high-impact micro-examples implemented in iteration 1)
**What changes:** Add two targeted micro-examples at the exact ambiguity points identified in the iteration 1 diagnostic: (1) In Phase 4, after the "choose this when..." instruction, add an example: `Example: "Choose FastAPI when: your team is Python-native, you prioritize development velocity over raw throughput, and your service handles <10k concurrent connections. Choose Go/Gin when: latency at the p99 is a hard requirement, you're building a small number of high-throughput services, and your team has 3+ months runway before shipping."` (2) In Phase 4, after the trade-off documentation instruction, add an example: `Example: "FastAPI offers 40% faster development cycles (based on team velocity benchmarks from existing Flask services) but sacrifices ~3x throughput versus Go/Gin under concurrent load. This trade-off favors FastAPI when the service is I/O-bound (database queries, API calls) rather than CPU-bound (data processing, serialization)."` These examples are compact (2-3 sentences each) and demonstrate the expected level of specificity — grounded in evidence, connected to the user's context, with clear conditions.
**Why it helps:** The scoring matrix row example added in iteration 1 produced unanimous wins on Q-DYN-3. The same mechanism — showing the model what good output looks like — should apply to trade-off documentation and candidate selection guidance. These two output elements currently have no format anchoring, leaving the agent to infer expected depth and specificity. Micro-examples at ambiguity points have a high ratio of consistency improvement to token cost. The moderate and complex test inputs both involve trade-offs that require this level of specificity (fintech: performance vs. developer productivity; health-tech: managed simplicity vs. operational control).
**Predicted impact:** MEDIUM — extends the proven micro-example technique to two additional output elements. Effect is narrower than Option A (only improves Phase 4 output quality) but improves the most user-facing part of the analysis.

### Option D: Stakeholder Hypothesis Testing and Managed-vs-Self-Hosted Dimension
**Addresses:** Q3, Q9, Q12 — Context Adequacy (no handling of stakeholder pre-existing assumptions), Domain specifics (no managed vs. self-hosted guidance), Failure modes (no hypothesis validation pattern)
**What changes:** Two additions: (1) In Phase 0 Requirements Extraction, add item 8: "**Stakeholder Hypotheses**: Does the user or a stakeholder have a pre-existing assumption or preferred candidate? (e.g., 'our CTO thinks we should just use Kafka for everything'). If so, document the hypothesis and ensure the analysis explicitly addresses it — either validating with evidence or challenging with specific counter-evidence. Do not ignore stated hypotheses." (2) In Phase 3 Business Analysis, add a deployment model evaluation sub-section: "**Deployment Model** *(when candidates span managed and self-hosted options)*: For each candidate, evaluate the managed vs. self-hosted trade-off: (a) Managed offering availability and maturity (GA vs. beta, feature parity with self-hosted), (b) Operational burden of self-hosting (cluster management, upgrades, monitoring, on-call), (c) Vendor lock-in risk and data portability, (d) Cost trajectory at the user's projected scale. This is particularly relevant when the user mentions team size constraints, operational concerns, or preference for managed/serverless."
**Why it helps:** The complex test input explicitly asks to "validate or challenge" the CTO's Kafka assumption, and the managed vs. self-hosted axis is the primary decision tension ("we can't babysit complex distributed systems"). The current prompt has no mechanism for either. The stakeholder hypothesis pattern is common in technology decision-making — users frequently arrive with a preferred candidate and want an analysis that either confirms or corrects their intuition. Without explicit handling, the agent might ignore the hypothesis (failing to address the user's actual need) or validate it without rigor. The managed vs. self-hosted dimension fills a gap for infrastructure/data engineering decisions where the choice is often not "which technology" but "which deployment model of the same technology."
**Predicted impact:** MEDIUM — directly improves handling of the complex test input and addresses common real-world patterns. The stakeholder hypothesis pattern is additive (a few sentences in Phase 0) and the deployment model evaluation extends Phase 3 with a targeted sub-section.

## Evaluation Questions
*Iteration 2*

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified?
- Q-FX2: Does the output conform to the required format/structure?
- Q-FX3: Is the output complete (all required aspects, no key omissions)?
- Q-FX4: Is the output appropriately concise (no padding or verbosity)?
- Q-FX5: Is the output grounded — no hallucinations or unsupported claims?
- Q-FX6: Does the output demonstrate sound reasoning — no circular logic, contradictions, or unresolved ambiguities?
- Q-FX8: Could the improvements be expressed more concisely — do the changes achieve the same quality gain without adding unnecessary prompt verbosity?
- Q-FX9: Does the improved prompt preserve detection depth, breadth, accuracy, and precision — does it not sacrifice evaluator thoroughness for calibration, conciseness, or format changes?
- Q-FX10 (adversarial regression — baseline-favoring): Does the baseline catch any concrete defect or requirement the improved version misses or softens? (A wins if yes, TIE if equivalent, B only if improved also catches everything A catches.)

### UX (weighted 0.5x)
- Q-UX1: Is the output's visual hierarchy clear (key decisions prominent, details subordinate)?
- Q-UX2: Is the most important information immediately scannable without reading through background?
- Q-UX3: Does the output use visual differentiation (emoji, tables, formatting) to separate information categories appropriately?

### Dynamic (derived from Q1-Q13 gaps addressed this iteration)
- Q-DYN-5 (adversarial regression check — REQUIRED by anti-circularity rule): Does the improved version miss any defect or requirement in the domain targeted by this iteration's improvements — specifically one the baseline would have caught? Focus on: does the Quick Mode safety net actually prevent the licensing/cost detail loss that the baseline (iteration 1) exhibited, or does it introduce a new blind spot?
- Q-DYN-6: When given a request with an explicit stakeholder hypothesis to validate or challenge (e.g., "our CTO thinks we should just use Kafka"), does the prompt produce a direct, evidence-grounded response to that hypothesis rather than ignoring it or addressing it tangentially? [addresses: Q3, Q12]
- Q-DYN-7: Does the enriched expert persona produce observably deeper analytical reasoning — citing specific evidence, connecting findings to the user's decision context, and steel-manning alternatives — compared to the generic persona? [addresses: Q1]
- Q-DYN-8: Do the micro-examples for "choose this when..." and trade-off statements produce more specific, context-grounded output compared to the instruction-only version? [addresses: Q5]
