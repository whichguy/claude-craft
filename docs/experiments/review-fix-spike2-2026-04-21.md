# Spike 2 — Haiku Freeform Pre-Pass Round-Reduction

**Status:** Pre-registered (infrastructure landed, bench not yet run)
**Date:** 2026-04-21
**Owner:** review-fix agent maintainers
**Related:**
- `agents/review-fix.md` Step 2.6 (pre-pass implementation)
- `agents/review-fix.md` Step 4 (Q1-Q37 structured fix loop)
- `docs/experiments/review-fix-e1-prompt-caching-2026-04-12.md` (prior no-go)

## Hypothesis

> The Haiku freeform senior-engineer pre-pass (Step 2.6) resolves enough trivial
> findings before Q1-Q37 runs that the structured fix loop converges in **1 round**
> instead of the current **2-3 rounds**, at materially lower total cost.

## Motivation

Step 2.6 already runs but Q1-Q37 always runs after it regardless of pre-pass
output. The round-reduction hypothesis has never been measured. Without a control
arm (`skip_prepass=true`), we cannot attribute round reductions to the pre-pass
vs. normal variance.

## Design

**Control arm:** `skip_prepass=true` — Step 2.6 short-circuits with a skip notice.
**Treatment arm:** `skip_prepass=false` (current default) — Step 2.6 runs.

Both arms run the full Q1-Q37 structured reviewer in Step 3 and the standard
fix-and-recheck loop in Step 4. The only difference is whether Step 2.6 executes.

## Fixtures

Three purpose-built fixtures live under `test/fixtures/review-fix/`:

| Fixture | Mix | Purpose |
|---|---|---|
| `spike2-trivial-dominant.ts` | ~70% trivial, ~30% substantive | Pre-pass should resolve most findings; treatment should show large round savings |
| `spike2-substantive-dominant.ts` | ~20% trivial, ~80% substantive | Pre-pass has little to resolve; treatment round count should match control |
| `spike2-multi-round.ts` | Mixed, designed to force 2 rounds without pre-pass | Round-count delta is the primary signal |

Ground-truth JSON for each fixture includes a `trivial_ids` array identifying
issues a freeform senior-engineer review should plausibly resolve. Issues NOT in
`trivial_ids` are **substantive** and must still appear in Q1-Q37 output after
pre-pass runs — this is the regression check.

Existing fixtures without `trivial_ids` default to `trivial_ids = []` (all
substantive); they are not part of Spike 2 metric calculation.

## Pass Criteria

All four criteria must hold for the pre-pass to be validated:

1. **Trivial-resolution rate** — ≥50% of `trivial_ids` findings resolved pre-Step-3
   in the treatment arm (measured by diff between fixture and post-pre-pass file).
2. **Cost ceiling** — pre-pass token cost ≤15% of baseline Sonnet Step 3 cost
   in the control arm (on the same fixture).
3. **Structural FP rate** — <5% of total pre-pass edits are structural false
   positives (function removal, signature change, or edits to substantive
   `trivial_ids` non-members). Measured by comparing pre-pass edits to fixture
   ground truth.
4. **Zero regressions** — every substantive (non-`trivial_ids`) ground-truth
   issue still appears in Q1-Q37 output in the treatment arm. The pre-pass must
   not mask substantive issues.

Pass all 4 → pre-pass is validated. Fail any → per-criterion pivot rules (wiki
entry b4aeb177) apply: criterion 1 fail suggests the pre-pass prompt needs
stronger fix instructions; criterion 2 fail suggests narrower scope or smaller
model; criterion 3 fail suggests forbidding structural changes in the prompt;
criterion 4 fail is a hard blocker — pre-pass must be disabled until fixed.

## Bench Configuration

```
tools/review-fix-bench.sh \
  --fixtures test/fixtures/review-fix/ \
  --runs 3 \
  --arms control:skip_prepass=true,treatment:skip_prepass=false
```

- 3 runs per arm per fixture to dampen LLM nondeterminism
- Per-fixture metrics: rounds-to-converge, pre-pass token cost, Step 3 token
  cost, findings-count delta, substantive-issue recall
- Aggregate metrics: control vs. treatment round-count distribution per fixture

## Decision Rules

- **Pass all 4 criteria** → pre-pass stays on by default. Update review-fix
  summary to call out round savings.
- **Fail criterion 1 or 2** → iterate on pre-pass prompt; rerun Spike 2.
- **Fail criterion 3** → add explicit "do not refactor, rename, or delete
  functions" instruction to pre-pass prompt; rerun Spike 2.
- **Fail criterion 4** → change `skip_prepass` default to `true`; file bug.

## Out of Scope

- Running Spike 2 itself — infrastructure landed here enables it but does not
  execute it. Spike 2 is a separate bench invocation.
- Benchmarking against code-reviewer variants (`t70`/`t75`/`t80`/`t85`) —
  that is E3, tracked separately.

## Artifacts

- Fixture files: `test/fixtures/review-fix/spike2-*.ts` + `.ground-truth.json`
- Bench harness: `tools/review-fix-bench.sh` (must parse `trivial_ids` optionally)
- Agent param: `agents/review-fix.md` Input Contract `skip_prepass`
- Step 2.6 guard: `agents/review-fix.md` Step 2.6 header
