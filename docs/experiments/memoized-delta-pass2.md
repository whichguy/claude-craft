# Experiment: Memoized-delta convergence for review-plan FULL tier (pass 2+)

**Status:** IN PROGRESS  
**Branch:** `perf/review-plan-memoized-delta-pass2`  
**Registered:** 2026-04-20 (before any code change)

---

## Hypothesis

FULL tier with memoized-delta pass 2+ produces scorecard-equivalent output to FULL tier without
memoized-delta, while reducing pass-2+ evaluator question-load by ≥50%.

---

## Gates (three-way conjunction — all must pass)

1. **Scorecard-rating equivalence:** on all 3 fixtures, final scorecard rating must match the
   pre-change baseline exactly.
2. **Pass-count equivalence:** `|pass_count_new - pass_count_baseline|` avg across fixtures ≤ 0.5.
3. **Test-window assertions:** `test/review-plan-fanout.test.js` passes — both positive-appearance
   and negative-non-appearance strings for the pass-2+ narrowing branch.

**Failure action:** if any gate fails → revert the change, do not rationalize.

---

## Chosen fixtures (3 from 18-plan bench bank)

- **Good (1 pass expected):** `bench-go-cli-tool.md`
- **Medium (2 passes expected):** `bench-nextjs-feature.md`
- **Adversarial (3+ passes expected):** `bench-adversarial-bolt-on.md`

---

## Baseline (pre-change)

_To be captured by running `/review-plan` on each fixture before the code change is merged._

| Fixture | Rating | pass_count | Notes |
|---|---|---|---|
| bench-go-cli-tool.md | TBD | TBD | |
| bench-nextjs-feature.md | TBD | TBD | |
| bench-adversarial-bolt-on.md | TBD | TBD | |

---

## Post-change results

_To be captured after merging._

| Fixture | Rating | pass_count | Pass-2 delta Q-IDs dispatched | Reduction vs baseline |
|---|---|---|---|---|
| bench-go-cli-tool.md | TBD | TBD | TBD | TBD |
| bench-nextjs-feature.md | TBD | TBD | TBD | TBD |
| bench-adversarial-bolt-on.md | TBD | TBD | TBD | TBD |

---

## Gate verdict

- [ ] Scorecard-rating equivalence
- [ ] Pass-count equivalence (avg delta ≤ 0.5)
- [ ] npm test passes

**Overall:** PENDING

---

## Notes

_Post-run observations and any post-mortem if gates fail._
