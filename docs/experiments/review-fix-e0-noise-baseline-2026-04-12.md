---
experiment: E0
title: Noise Baseline
status: pre-registered
registered: 2026-04-12
branch: exp/review-fix-efficiency
---

# E0 — Noise Baseline

## Hypothesis

Before any treatment can be measured, the intrinsic variance of the review-fix pipeline must be quantified. Repeated runs of the same reviewer on identical code produce slightly different F1 scores due to LLM sampling temperature and non-determinism. This experiment characterizes that noise floor so that all subsequent experiments (E1–E5) can be calibrated against a meaningful minimum detectable effect (MDE). Without E0, any observed ΔF1 in E1–E5 cannot be distinguished from noise.

## Variants

- **V_A (sole condition)**: Run code-reviewer.md (pinned model version) on the current 10-fixture suite, 10 runs per fixture, with no changes to prompts, thresholds, or infrastructure. All parameters held constant. Log per-fixture F1 for each run.

## Pre-registered Gates

### ADOPT if:
- N/A — E0 is calibration only. No ADOPT verdict.

### REJECT if:
- N/A — E0 is calibration only. No REJECT verdict.

### INCONCLUSIVE if:
- N/A — E0 always produces a result. If stddev is unexpectedly high (σ > 0.10 on any fixture), flag as a blocker requiring investigation before E1–E5 proceed.

## Methodology

- N: 10 fixtures × 10 runs = 100 total evaluations
- Statistical test: Compute per-fixture mean F1 and stddev σ. MDE = 2σ (pooled across fixtures).
- Bonferroni correction: no — single condition, no hypothesis testing

## Implementation Intent (QI checks)

- QI-1: Pin exact claude model version string (e.g., `claude-sonnet-4-6`) to the results file alongside each run timestamp. Model version must not change mid-experiment.
- QI-2: Record per-fixture stddev independently — do not aggregate across fixtures before computing σ. Fixtures with high individual variance must be flagged separately.
- QI-3: Compute MDE = 2σ (pooled) and write it to the results file. E1–E5 must reference this MDE when interpreting effect sizes.
- QI-4: Store raw per-run F1 vectors (not just summary stats) in the results artifact for post-hoc analysis.

## Audit Trail

E0 has not been run before because the fixture suite and harness were under active development. This pre-registration establishes the required calibration step now that the fixture suite is stabilizing (see E6). E0 must complete before any E1–E5 ADOPT/REJECT verdict is recorded — results from prior ad-hoc runs are inadmissible because the model version and fixture set were not locked.
