# Ablation Test Results

First run: 2026-05-02. 11-fixture suite (6 probes + 5 real-world inputs) comparing structured `review-plan/SKILL.md` vs directive variants.

## Three variants tested

| Variant | What it removes | Token cost vs control |
|---|---|---|
| Control | nothing — full structured skill | 100% (~260KB) |
| Ablated | Q-IDs, EVALUATOR_OUTPUT_CONTRACT, convergence loop, wave fan-out | ~3% (85 lines) |
| Ablated-calibrated | same + adds 15-line "Calibration Discipline" preamble | ~4% (100 lines) |

## Aggregate winners

| Variant pair | TIE | CONTROL | ABLATED |
|---|---|---|---|
| Control vs Ablated | 6 | 1 | **4** |
| Control vs Ablated-calibrated | 4 | **4** | 3 |

The calibration directive **regressed** the directive variant. It fixed over-flagging on clean plans (probe-9, input3) but suppressed real findings on substantive plans.

## Per-fixture comparison

| Fixture | Ablated winner | Calibrated winner | Δ |
|---|---|---|---|
| probe-1 (unvalidated constraint) | TIE | TIE | — |
| probe-2 (phantom code refs) | TIE | TIE | — |
| probe-3 (cross-phase contradiction) | TIE | CONTROL | **regressed** |
| probe-7 (untestable verification) | TIE | CONTROL | **regressed** |
| probe-9 (PASS calibration) | CONTROL | TIE | improved |
| probe-16 (GAS contradiction) | ABLATED | ABLATED | — |
| input3 (trivial calibration) | ABLATED | ABLATED | — |
| input4 (diverse issues) | TIE | ABLATED | improved |
| input6 (Node missing prereads) | ABLATED | CONTROL | **regressed** |
| input8 (GAS OAuth TBDs) | ABLATED | TIE | **regressed** |
| input11 (Node parallel phases) | TIE | CONTROL | **regressed (security)** |

## Critical regression: input11

The calibrated reviewer **explicitly considered and dismissed** the X-Trace-Id log injection vulnerability (an untrusted input flowing into a log statement) as "not a blocker on a procedurally complete plan." It also missed the missing Express `Request` type augmentation. This is a clear false negative on a real security issue, not a calibration miss.

The calibration preamble's heuristic — "if the plan is well-cited and procedurally complete, prefer PASS" — is too coarse. It cannot distinguish "no real issues" from "real issues that the reviewer should look harder for."

## Empirical conclusion

The structured question's load-bearing contribution is **per-question discrimination via PASS/N/A**, not the question text itself. The control's bookkeeping selectively skips N/A questions while applying others fully; a directive prompt with a single "be conservative" lever cannot replicate that selectivity.

| Approach | Issue detection | Clean-plan accuracy | Token cost |
|---|---|---|---|
| Control (full) | best | best | highest |
| Ablated (uncalibrated) | as good or better | over-flags | lowest |
| Ablated-calibrated | regressed | matches control | slightly higher |

## Implications for token reduction

A blanket directive replacement is **not viable**. Cheaper paths to fewer tokens:

1. **Prune low-hit-rate questions.** `question-effectiveness-report.md` already drops Q-G2, Q-G8, Q-G17, Q-G20, Q-C21 for 0% hit rate. Continue this approach with measured ablation per question rather than wholesale replacement.
2. **Per-directive N/A semantics.** Give each directive in the ablated variant an explicit N/A condition (e.g., "Flag async errors — N/A if no async paths introduced"). This restores the discriminative bookkeeping without the JSON contract overhead.
3. **Tier-aware directive set.** Trivial tier uses a small directive subset; FULL tier uses the structured skill. Lets you save tokens on most reviews while keeping fidelity for substantive plans.

Option 2 is the most promising — it preserves the directive prompt's compactness while restoring the per-criterion gating that the calibration preamble could not provide.

## Method note

All control, ablated, calibrated, and judge runs used isolated `Agent` subagent calls — fresh context per run, no conversation contamination. Each agent read the skill and fixture from disk and wrote output to `/tmp/`. This isolation is necessary for valid measurement.

The judge (`agents/review-plan-ablation-judge.md`) compared logical equivalence across 5 criteria (issue_overlap, false_negatives, false_positives, severity_alignment, verdict_agreement), not output style — the right framing for ablation testing.
