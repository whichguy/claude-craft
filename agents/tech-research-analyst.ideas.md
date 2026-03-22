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
