---
experiment: E3
title: Confidence Threshold Sweep
status: pre-registered
registered: 2026-04-12
branch: exp/review-fix-efficiency
---

# E3 — Confidence Threshold Sweep

## Hypothesis

The current confidence threshold of 75 in code-reviewer.md was set heuristically. A higher threshold suppresses more low-quality findings (reducing FP rate and review noise) while risking recall loss. A lower threshold admits more findings (increasing recall) at the cost of more FP noise. The optimal threshold balances F1 across the fixture suite. The expected optimum is 80, which is hypothesized to improve precision by ≥10% relative to 75 while holding recall above 85% of the 75-baseline.

## Variants

- **V_A (T=70)**: `code-reviewer-t70.md` — confidence threshold lowered to 70. Expected: highest recall, highest FP rate.
- **V_B (T=75, baseline)**: `code-reviewer-t75.md` — current production threshold. Establishes the within-experiment baseline for paired comparison.
- **V_C (T=80)**: `code-reviewer-t80.md` — threshold raised to 80. Expected optimum.
- **V_D (T=85)**: `code-reviewer-t85.md` — threshold raised to 85. Expected: lowest FP, lowest recall.

## Pre-registered Gates

### ADOPT new threshold T* if:
- `F1(T*) > F1(75) + 0.02` AND `recall(T*) ≥ recall(75) − 0.05`
  — F1 improvement with acceptable recall loss, OR
- `precision(T*) > precision(75) + 0.10` AND `recall(T*) ≥ 0.85 × recall(75)`
  — Large precision gain with recall held above 85% of baseline

Only one threshold may be ADOPTed. If multiple thresholds meet the gate, select the one with highest F1 on the held-out validation fixtures (see QI-4 train/test split).

### REJECT if:
- No threshold beats T=75 by ≥0.02 F1 on both train and validation fixtures → keep current threshold
- T=80 meets the gate on train fixtures but fails on held-out validation → overfit, REJECT

### INCONCLUSIVE if:
- All thresholds within ±0.02 F1 of each other (threshold has no measurable effect on this fixture suite — revisit after fixture expansion)
- Bonferroni-corrected p-value > 0.0125 for the best candidate threshold

## Methodology

- N: 10 fixtures × 3 runs per variant = 30 evaluations per threshold
- Statistical test: Paired Wilcoxon signed-rank comparing each threshold to V_B (T=75), per fixture
- Bonferroni correction: yes — α = 0.05 / 4 thresholds = 0.0125 per comparison
- Train/test split: Hold out 4 fixtures for validation before running any variant. Train metrics computed on 6 fixtures; ADOPT verdict must replicate on held-out 4. Held-out fixtures selected randomly before experiment begins (document seed in results file) — QI-4.

## Implementation Intent (QI checks)

- QI-1: Each threshold variant file must be a clean copy of code-reviewer.md with only the threshold line changed. No other diffs. Verify with `diff` before running.
- QI-2: The threshold line to change is exactly: `**Confidence filtering**: Only report findings with Confidence >= 75.` — change `75` to the variant value. No other text in this line may change.
- QI-3: Bonferroni correction is mandatory. Do not report a threshold as ADOPT without corrected p-values.
- QI-4: Train/test split must be performed and documented before any variant is run. Post-hoc fixture selection invalidates the experiment. Record the 4 held-out fixture names in the pre-run results artifact.
- QI-5: Model version must be identical across all 4 variants. Pin version string in results.
- QI-6: Do NOT change the threshold in production code-reviewer.md until ADOPT verdict is confirmed on both train and held-out validation fixtures.

## Audit Trail

The confidence threshold of 75 was set during initial code-reviewer.md authoring without empirical validation. The threshold directly controls the precision/recall tradeoff of every review invocation, making it a high-leverage parameter. This experiment was not run earlier because the fixture suite was too small (< 10 fixtures) to support a meaningful train/test split. The E6 expansion to 24–28 fixtures creates sufficient data for a properly powered sweep.
