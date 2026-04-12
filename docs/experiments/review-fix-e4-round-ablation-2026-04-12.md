---
experiment: E4
title: Round Count Ablation
status: pre-registered
registered: 2026-04-12
branch: exp/review-fix-efficiency
---

# E4 — Round Count Ablation

## Hypothesis

The review-fix loop currently allows up to 5 rounds. Each additional round adds latency and cost. If the majority of true positives are captured in rounds 1–2, permitting rounds 3–5 adds cost with diminishing quality returns. The hypothesis is that a lower default max_rounds (likely 2 or 3) captures ≥95% of cumulative TP at round 5, at proportionally lower cost, without increasing false negatives in final output.

## Variants

- **V_A (N=1)**: Single-round review, no recheck. Maximum speed, no iterative correction.
- **V_B (N=2)**: Two rounds — initial review + one recheck. Expected to capture most TP gains.
- **V_C (N=3)**: Three rounds. Baseline for current common behavior.
- **V_D (N=5, control)**: Five rounds — current maximum. Establishes cumulative TP ceiling.

## Pre-registered Gates

### ADOPT lower default N* if:
- `cumulative_TP(N*) ≥ 0.95 × cumulative_TP(N=5)` on aggregate across fixtures AND
- `cumulative_FP(N*) ≤ cumulative_FP(N=5)` (no FP inflation at reduced round count)

The lowest N meeting both criteria becomes the new recommended default. If N=2 and N=3 both meet the gate, prefer N=2 (minimum cost).

### KEEP N=5 if:
- Each round adds ≥3% marginal TP relative to the previous round's cumulative TP (rounds are earning their cost)
- OR any variant (N=1, N=2, N=3) misses Critical findings that N=5 catches on ≥2 fixtures

### INCONCLUSIVE if:
- Per-round logging is unavailable in the harness (cannot decompose cumulative TP by round)
- E6 round-forcing fixtures are insufficient (< 5 fixtures produce findings in rounds 3+)

## Methodology

- N: 10 fixtures × 3 runs per variant = 30 evaluations per round count
- Statistical test: Paired Wilcoxon signed-rank on cumulative F1 at each round count vs V_D (N=5)
- Bonferroni correction: yes — α = 0.05 / 4 variants = 0.0125 per comparison

## Implementation Intent (QI checks)

- QI-1: Harness must log findings per round (not just final output). Cumulative TP at round N = count of true positives present in the output after N rounds, regardless of which round first surfaced them.
- QI-2: E6 must include fixtures designed to require 3+ rounds (i.e., initial review finds Critical, fix introduces new issue, second recheck finds it). Without round-forcing fixtures, V_D has no advantage over V_B.
- QI-3: Watch for FP oscillation: a finding present in round 1, absent in round 2, present again in round 3 indicates instability. Log oscillation events separately — they are an urgent signal requiring a fix to the review-fix loop logic, independent of the ADOPT/REJECT verdict.
- QI-4: Model version must be identical across all round-count variants. Pin in results.
- QI-5: Do NOT change `max_rounds` default in review-fix without ADOPT verdict. Per QI-3: if FP oscillation is detected in any variant, file a bug and block the ADOPT decision pending resolution.

## Audit Trail

The max_rounds=5 default was chosen conservatively without ablation data. As the fixture suite grows (E6) and per-round logging is added to the harness, this experiment becomes feasible. E4 has not been run before because (1) per-round logging did not exist, (2) the fixture suite lacked round-forcing cases, and (3) E0 noise calibration was not yet established. E4 is blocked on E6 infrastructure and E0 calibration.
