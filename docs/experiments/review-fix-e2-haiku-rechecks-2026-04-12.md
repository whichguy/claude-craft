---
experiment: E2
title: Haiku vs Sonnet Rechecks
status: pre-registered
registered: 2026-04-12
branch: exp/review-fix-efficiency
---

# E2 — Haiku vs Sonnet Rechecks

## Hypothesis

The recheck round in review-fix (second pass after fixes are applied) is structurally simpler than the initial review: it verifies that prior Critical findings have been resolved rather than discovering new ones. A weaker model (Haiku) may be sufficient for this verification task at a fraction of the cost, with minimal TP loss on recheck-round findings. If true, `recheck_model=haiku` would reduce per-file recheck cost by ~85% while catching ≥90% of the true positives caught by Sonnet rechecks.

## Variants

- **V_A (control)**: `recheck_model=null` — recheck round uses the same model as the initial review (Sonnet). This is the current state after the PR #143→#145 revert cycle confirmed that null is empirically safer until data exists.
- **V_B (treatment)**: `recheck_model=haiku` — recheck round uses claude-haiku. Initial review model unchanged (Sonnet).

## Pre-registered Gates

### ADOPT if:
- Recheck-round `TP_V_B ≥ 0.90 × TP_V_A` (Haiku catches ≥90% of Sonnet's true positives in the recheck round) AND
- `$_V_B ≤ 0.15 × $_V_A` (cost ≤15% of Sonnet recheck cost) AND
- `FP_V_B ≤ 1.20 × FP_V_A` (false positive rate not more than 20% higher than Sonnet)

### REJECT if:
- `TP_V_B < 0.90 × TP_V_A` → verdict: "null default empirically justified — Haiku insufficient for recheck verification"
- `FP_V_B > 1.50 × FP_V_A` → Haiku is hallucinating new findings in the recheck round

### INCONCLUSIVE if:
- Insufficient two-round fixtures in E6 suite to compute recheck-round metrics separately from initial-round metrics (< 5 fixtures force a second round)
- TP and FP thresholds met but cost savings < 60% (unexpected — investigate model routing)

## Methodology

- N: E6 two-round-forcing fixtures (target ≥5) × 3 runs per variant
- Statistical test: Paired Wilcoxon signed-rank on recheck-round F1 per fixture
- Bonferroni correction: no — single primary comparison
- Critical constraint: Metrics must be computed on **recheck-round-only** findings (not aggregate across all rounds). Initial-round findings are out of scope for this experiment — only the delta between round 1 and round 2 is evaluated.

## Implementation Intent (QI checks)

- QI-1: Harness must log which round each finding was first reported. Recheck-round metrics = findings that appear (or disappear) in round 2 only.
- QI-2: E6 must include ≥5 fixtures that force a second round (i.e., the initial review produces Critical findings that the fixture's "fix" resolves). Without these, E2 has no signal.
- QI-3: Tabulate recheck-round TP, FP, FN separately from initial-round metrics. Do not pool rounds before computing the ADOPT gate.
- QI-4: Model versions for both Sonnet (V_A initial) and Haiku (V_B recheck) must be pinned and recorded in results.
- QI-5 (default protection): Do NOT change `recheck_model` default in code-reviewer.md or review-fix without an explicit ADOPT verdict from this experiment. The PR #143→#145 revert cycle (where haiku was added then reverted due to insufficient evidence) is the documented prior. This gate exists to prevent recurrence.

## Audit Trail

The `recheck_model` parameter was added in PR #143, set to haiku, then reverted in PR #145 after review identified insufficient justification for the haiku default. The revert established `recheck_model=null` as the safe default. E2 is the formal experiment that will either justify reinstating haiku (ADOPT) or permanently document why null is correct (REJECT). The two-round fixtures required by E2 are being created in E6, making E2 execution dependent on E6 completion.
