---
experiment: E5
title: GAS Dual-Reviewer ROI
status: pre-registered
registered: 2026-04-12
branch: exp/review-fix-efficiency
---

# E5 — GAS Dual-Reviewer ROI

## Hypothesis

For `.gs` files, review-fix currently dispatches both `code-reviewer` (general) and `gas-code-review` (specialist) in parallel, then merges findings. The dual-reviewer approach improves recall on GAS-specific bugs (Q8 triggers) but doubles reviewer cost per file. The hypothesis is that `gas-code-review` alone captures ≥98% of the dual-reviewer's TP on `.gs` fixtures, making the general reviewer redundant for GAS files and justifying a specialist-only routing rule.

## Variants

- **V_A (dual, control)**: Both `code-reviewer` + `gas-code-review` dispatched in parallel on `.gs` fixtures. Current behavior. Establishes TP ceiling for dual routing.
- **V_B (specialist solo)**: `gas-code-review` only on `.gs` fixtures. Primary treatment.
- **V_C (general solo)**: `code-reviewer` only on `.gs` fixtures. Establishes how much the specialist adds relative to the general reviewer.

## Pre-registered Gates

### SWITCH TO specialist-only (V_B) if:
- `TP(V_B) ≥ 0.98 × TP(V_A)` on `.gs` fixtures AND
- `FP(V_B) ≤ FP(V_A)` (specialist does not introduce more noise than dual)

### KEEP DUAL (V_A) if:
- Either solo variant (V_B or V_C) misses Critical findings on ≥2 `.gs` fixtures that the dual catches — dual routing is earning its cost
- `TP(V_B) < 0.98 × TP(V_A)` — specialist alone is insufficient

### INCONCLUSIVE if:
- Fewer than 5 `.gs` fixtures in E6 suite (insufficient GAS-specific signal)
- V_B and V_C have nearly identical TP (neither reviewer adds unique signal — investigate reviewer overlap)

## Methodology

- N: E6 `.gs` fixtures (target ≥8) × 3 runs per variant
- Statistical test: Paired Wilcoxon signed-rank on F1(V_B) vs F1(V_A) per `.gs` fixture
- Bonferroni correction: no — single primary comparison (V_A vs V_B); V_C is diagnostic
- Effort estimate: ~5 hours total (fixture preparation dominates — existing `.gs` fixtures need GAS-specific ground truth annotations for Q8 findings)

## Implementation Intent (QI checks)

- QI-1: Only `.gs` files are in scope. Do not run V_B/V_C on non-GAS fixtures.
- QI-2: Ground truth for `.gs` fixtures must include GAS-specific findings (Q8: CacheService getUserCache, CommonJS _main params, execution limits, etc.). Generic JS findings are out of scope for measuring specialist value.
- QI-3: If SWITCH TO V_B: update review-fix routing logic to dispatch `gas-code-review` only for `.gs` files (not dual). Document the routing change and reference this experiment's ADOPT verdict.
- QI-4: Model versions for both `code-reviewer` and `gas-code-review` must be pinned separately — they may use different defaults.
- QI-5: Requires E6 expanded `.gs` fixture set. E5 is blocked on E6 completion.

## Audit Trail

The dual-reviewer routing for `.gs` files was added to maximize GAS-specific coverage without a cost-benefit analysis. As the `.gs` fixture suite expands in E6, a formal evaluation becomes feasible. E5 has not been run before because the existing `.gs` fixture set (fewer than 3 files) was too small to distinguish specialist vs general reviewer contributions. The ~5h effort estimate reflects that most time is fixture preparation, not experiment execution.
