---
schema_version: 1
run_id: micro-noclose-strict-ablation-2026-05-09
arms:
  control:   { skill: plugins/review-suite/skills/review-plan/SKILL.md }
  treatment: { skill: plugins/review-suite/skills/review-plan/variants/SKILL-v-micro-noclose-strict.md }
fixtures:
  - { id: probe-21, path: plugins/review-bench/fixtures/probes/probe-21-procedurally-clean-false-claim.md }
  - { id: probe-9,  path: plugins/review-bench/fixtures/probes/probe-9-g1-pass-calibration.md }
  - { id: input11,  path: plugins/review-bench/fixtures/inputs/input11-node-parallel-phases.md }
k: 5
model: sonnet
scoring:
  method: concept_grep_plus_verdict_tier
criteria:
  - id: 1
    fixture: probe-21
    rule: "treatment.concept_rate >= 4/5 AND treatment.verdict_in_NEEDS_UPDATE_or_NOT_READY >= 4/5"
  - id: 2
    fixture: probe-9
    rule: "treatment.NOT_READY_rate >= 4/5"
  - id: 3
    fixture: input11
    rule: "treatment.concept_rate >= 4/5 AND treatment.verdict_in_NEEDS_UPDATE_or_NOT_READY >= 4/5"
---

# Pre-Registration: micro-noclose-strict ablation

**Date:** 2026-05-09
**Author:** Claude (Opus 4.7) at user direction
**Purpose:** Test whether the **mandatory verdict-downgrade rule** in the close section of `SKILL-v-micro-2close.md` is the load-bearing element, vs. the close *questions* themselves.

## Hypothesis

H0 (null): The two close questions in `micro-2close` (fabricated-quant + phantom-types) are individually load-bearing; without them, the variant fails one or more of the prior-research regression fixtures (probe-21, probe-9, input11) in the same way Arms A (noclose) and B (1close) failed.

H1 (alternative): The close questions are scaffolding around the mandatory-downgrade rule. A variant with the questions removed but a stronger always-on severity rule (`micro-noclose-strict`) will catch the same regressions as `micro-2close` on the same fixtures.

## Variant under test

`plugins/review-suite/skills/review-plan/variants/SKILL-v-micro-noclose-strict.md` (34 lines)

= `SKILL-v-micro-noclose.md` (23 lines, the previously-refuted Arm A) + a Severity Rule (~10 lines) that:
- Enumerates the blocking-tier finding categories explicitly
- Specifies a deterministic verdict map: 0 blocking → PASS/NEEDS_UPDATE; exactly 1 → ≤NEEDS_UPDATE; ≥2 → NOT READY
- States the downgrade is mandatory and not subject to model judgment

The variant has NO `## Adversarial Close` section — no secondary close questions, no "imagine the plan just passed."

## Control

`plugins/review-suite/skills/review-plan/SKILL.md` (the current production skill, == `SKILL-v-micro-2close.md` body, 33 lines).

## Fixtures (3)

Selected because they are the fixtures the prior research's failed arms died on:

| Fixture | Path | Prior failure |
|---|---|---|
| probe-21 | `plugins/review-bench/fixtures/probes/probe-21-procedurally-clean-false-claim.md` | Arm A: judge winner-mode = CONTROL across 3/3 reps (severity weighting; concept-grep was 5/3/4 ✓). |
| probe-9 | `plugins/review-bench/fixtures/probes/probe-9-g1-pass-calibration.md` | Arm A: NOT READY count 0/3 (verdict-tier failure on mixed-defect plan). |
| input11 | `plugins/review-bench/fixtures/inputs/input11-node-parallel-phases.md` | Arm B (1close): judge winner-mode = CONTROL ×2 of 3 (severity weighting; concept-grep was 3/3 ✓). |

## Protocol

- **k=5** reps per (variant, fixture) pair (improvement over prior k=3 to reduce stochastic noise).
- 2 arms × 3 fixtures × 5 reps = **30 review-Agent dispatches**.
- Each Agent receives: (a) the full variant SKILL body as system instructions, (b) the full fixture body as the plan to review, and a brief invocation: "Review the following plan according to the skill instructions provided."
- **Sub-agent model:** Sonnet (per user direction; differs from prior research, comparability caveat acknowledged).
- **No paired LLM judge.** Scoring is via deterministic regex on the model output (concept-grep) plus verdict-tier extraction (regex on `PASS|NEEDS_UPDATE|NOT READY`).

## Falsifiable pass criteria for `micro-noclose-strict`

The variant **passes** iff ALL THREE of the following hold:

### Criterion 1 — probe-21
- ≥4/5 reps emit fabricated-quant concept (regex: case-insensitive match against any of: `fabricat`, `10×`, `10x speedup`, `benchmark.*not.*produc`, `cited.*non.?existent`, `no plan step produces`, `phantom benchmark`)
- AND ≥4/5 reps verdict ∈ {NEEDS_UPDATE, NOT READY}

### Criterion 2 — probe-9
- ≥4/5 reps verdict = NOT READY

### Criterion 3 — input11
- ≥4/5 reps emit ≥2 of {W3C trace context, per-request UUID/correlation ID, async-context/AsyncLocalStorage/cls-hooked} concepts. Regex (case-insensitive, OR across alternatives): `W3C|trace.?context`, `per.?request.*UUID|correlation`, `AsyncLocalStorage|cls.?hooked|async.?context`.
- AND ≥4/5 reps verdict ∈ {NEEDS_UPDATE, NOT READY}

## Decision rule

- **All 3 criteria pass:** Write findings; propose `micro-noclose-strict` for promotion as a separate decision (this run does not auto-promote).
- **Any criterion fails:** Bank the variant. The H0 (close questions are individually load-bearing) is supported. No change to current SKILL.md.

## Comparability check (CONTROL arm)

The CONTROL arm (`micro-2close`, current SKILL.md) is also run with k=5 on the same fixtures. CONTROL must independently satisfy all 3 criteria. If CONTROL fails any criterion, the criterion is mis-specified or the harness is broken — invalidating the run regardless of the NEW arm result. This is a sanity check, not a primary outcome.

## What this experiment does not test

- General review quality across the broader 17-fixture set (intentionally narrow — only fixtures where prior research died).
- Behavior on TRIVIAL-tier plans (probe-21/probe-9/input11 are all non-trivial code plans).
- Whether the always-on severity rule introduces over-flagging on clean plans (input3b not included). If the variant promotes, this should be tested as a follow-up.
- Judge-bias effects (intentionally — concept-grep + verdict-regex are deterministic).

## Lock

This document is committed before any review-Agent dispatches occur. The criteria above are immutable for this experiment. Post-hoc reshaping is forbidden; if the result surfaces an unanticipated mode (e.g., variant emits a finding via different vocabulary that my regex misses), the correct response is to record that as an inconclusive result and design a follow-up — not to relax the criterion mid-run.
