# Review-Fix Q-Ordering: Existence-Proof Audit

**Date:** 2026-04-19
**Branch:** exp/review-fix-q-ordering
**Plan:** Review-Fix Question Ordering Efficiency Investigation

## Objective

Before investing in Steps 1–5 (fire-rate audit, change-magnitude categorization, reorder proposal, E7 experiment), verify that the re-work mechanism the hypothesis targets actually occurs in practice: a surface fix applied in Round N that gets re-done or made redundant by a structural fix in Round N+1.

## What Was Checked

Grepped all existing bench run outputs under `results/`:

- `results/baseline-2026-04-19.json` — 19 runs
- `results/baseline-2026-04-19-2.json` — 19 runs

### Bench schema

`raw_runs` entries contain: `fixture`, `run`, `precision`, `recall`, `f1`, `completeness`, `true_positives`, `fp_count`, `false_negatives`, `tokens_estimate`, cost fields.

**No `rounds` field exists.** These baselines measure reviewer accuracy (true positives / false positives / false negatives) against ground-truth fixtures. They do not run the iterative review-fix loop and do not record rounds-to-converge.

All 38 runs omit the `rounds` field entirely. There are no multi-round fixtures because this benchmark architecture does not exercise the round loop at all.

### Rounds distribution

| Baseline file | Total runs | rounds absent | rounds=1 | rounds=2 | rounds>2 |
|---|---|---|---|---|---|
| baseline-2026-04-19.json | 19 | 19 | 0 | 0 | 0 |
| baseline-2026-04-19-2.json | 19 | 19 | 0 | 0 | 0 |

## Decision

**Zero multi-round examples found.** The re-work mechanism the hypothesis targets — a surface fix in Round N being re-done or obviated by a structural fix in Round N+1 — cannot be empirically confirmed from existing bench data. The bench architecture does not produce round-level telemetry.

Per the plan's decision rule:

> If zero examples found across ~10 multi-round fixtures, the re-work mechanism the hypothesis targets does not empirically occur at current scale, and Steps 1–5 are theatre. Record result here. Decision: ≥1 clear example → proceed to Step 1; 0 examples → stop and archive the plan.

**Decision: stop. Steps 1–5 archived.**

## Root Cause

The existing benchmark (`tools/review-fix-bench.sh`) runs the *code-reviewer agent* in single-pass mode to measure reviewer accuracy, not the full iterative review-fix loop. To measure rounds-to-converge, a different harness would need to invoke the *review-fix agent* (not just the reviewer) and record how many rounds each fixture required before reaching zero findings.

## What Would Change This Decision

To revisit: run the full review-fix loop harness on the 19 fixtures, record per-fixture round counts, identify fixtures converging in ≥3 rounds, and manually inspect whether a surface fix in an early round was later re-worked by a structural fix in a later round. If ≥1 clear example exists, re-open Steps 1–5.

Per the plan's MDE pre-req: this would also require computing σ_rounds and MDE_rounds before E7 could be run with statistical validity.
