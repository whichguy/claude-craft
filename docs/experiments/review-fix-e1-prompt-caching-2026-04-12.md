---
experiment: E1
title: Prompt Caching
status: complete-no-go
registered: 2026-04-12
infrastructure_completed: 2026-04-18
results: docs/experiments/review-fix-e1-2026-04-19.md
branch: exp/review-fix-efficiency
---

<!-- Infrastructure status (2026-04-18, session fbf421ed):
  - agents/variants/code-reviewer-cached.md: cache_control markers present (treatment arm V_B)
  - agents/variants/code-reviewer-t70/75/80/85.md: cache_control markers applied for completeness
  - tools/review-fix-bench.sh: --perturb-prefix (V_C per-invocation perturbation, QI-7) + --max-cost 20.0 (cost abort) added
  - 19 fixtures in test/fixtures/review-fix/ (bench runs against all 19)
  - Awaiting bench run authorization (~$12, ~45 min). Run with:
      ./tools/review-fix-bench.sh --run --label baseline --runs 3
      ./tools/review-fix-bench.sh --run --label e1-treatment --agent-file agents/variants/code-reviewer-cached.md --runs 3
      ./tools/review-fix-bench.sh --run --label e1-vc-control --agent-file agents/variants/code-reviewer-cached.md --perturb-prefix --runs 3
  - Results go to a new dated file: docs/experiments/review-fix-e1-YYYY-MM-DD.md
-->


# E1 — Prompt Caching

## Hypothesis

The static prefix of code-reviewer.md (Phase 1 through Phase 3a header) constitutes the majority of input tokens on every review invocation. Adding `cache_control: {"type": "ephemeral"}` breakpoints at the boundary between static and dynamic content should reduce effective input token cost by ≥40% when cache hit rate is high, while leaving review quality (F1) unchanged. The hypothesis is that caching the static prefix is a free efficiency win with no quality tradeoff.

## Variants

- **V_A (control)**: code-reviewer.md with no cache_control markers. Baseline token cost.
- **V_B (treatment)**: code-reviewer-cached.md — identical to V_A with `cache_control: {"type": "ephemeral"}` markers added at two breakpoints: after `## Phase 3: Quality Questions (Tiered)` and after `### Phase 3a — Safety Tier`. Same fixtures, same model, same harness.
- **V_C (cache-poisoning control)**: V_B with a single whitespace change injected into the static prefix before each run to verify cache invalidates correctly. Expected: no cache hit, cost ≈ V_A. If V_C cost < V_A, the caching implementation is broken.
- **V_D (identity control)**: V_A run twice on the same fixture in immediate succession. Verifies harness determinism and establishes run-to-run noise floor for token counts.

## Pre-registered Gates

### ADOPT if:
- `(input_tokens_V_B + 0.10 × cache_read_tokens_V_B) ≤ 0.60 × input_tokens_V_A` (effective cost ≤60% of control) AND
- `|ΔF1(V_B − V_A)| < 0.02` across all fixtures AND
- Cache hit rate for V_B ≥ 80% across the fixture suite

### REJECT if:
- `ΔF1(V_B − V_A) < -0.02` on aggregate — cache markers degraded review quality
- V_C cache hit rate > 5% — cache is not invalidating correctly (implementation bug, do not ship)

### INCONCLUSIVE if:
- Cache hit rate for V_B < 80% (infrastructure issue, not a quality signal — retry with corrected implementation)
- ΔF1 within [-0.02, +0.02] but cost reduction < 40% (caching working but insufficient prefix coverage)

## Methodology

- N: post-E6 fixture suite (target 24–28 fixtures) × 3 runs per variant = ~75–84 evaluations per variant
- Statistical test: Paired Wilcoxon signed-rank on F1(V_B) vs F1(V_A) per fixture
- Bonferroni correction: no — single primary comparison (V_A vs V_B); V_C and V_D are validation controls, not hypothesis tests

## Implementation Intent (QI checks)

- QI-1: Model version must be identical across V_A, V_B, V_C, V_D. Pin version string in results file.
- QI-2: Record `input_tokens`, `cache_creation_tokens`, `cache_read_tokens` per invocation from the API response. Do not infer from prompt length.
- QI-3: V_D identity check must run before V_B to confirm harness is not introducing token-count artifacts.
- QI-4: V_C must use the same whitespace injection location across all fixtures. Document the injection site in the results artifact.
- QI-5: The variant file `agents/variants/code-reviewer-cached.md` is the sole source of truth for V_B. Do not modify code-reviewer.md.
- QI-6: Report effective cost as `input_tokens + 0.10 × cache_read_tokens` (Anthropic pricing: cache reads are 0.1× full input token price).
- QI-7 (mandatory cache-poisoning control): ADOPT verdict is blocked if V_C shows cache hit rate > 5%. This verifies the cache invalidation mechanism before shipping.

## Audit Trail

Prompt caching has not been evaluated in review-fix before because (1) the fixture suite was too small to measure token costs reliably and (2) the cache_control marker placement required a stable prompt structure. Now that code-reviewer.md has stabilized and E6 is expanding the fixture suite, E1 can be run on a representative sample. The PR #143→#145 revert cycle (recheck_model) demonstrated the cost of shipping efficiency changes without pre-registered gates — E1 establishes the gates first.
