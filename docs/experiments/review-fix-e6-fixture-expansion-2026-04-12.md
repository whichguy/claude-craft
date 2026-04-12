---
experiment: E6
title: Fixture Expansion
status: pre-registered
registered: 2026-04-12
branch: exp/review-fix-efficiency
---

# E6 — Fixture Expansion

## Hypothesis

E6 is prerequisite infrastructure, not a hypothesis experiment. The current fixture suite (10 fixtures) is insufficient to power E1–E5: too small for a train/test split (E3), lacks round-forcing cases (E2, E4), lacks `.gs` specialist coverage (E5), and lacks large-file stress tests. Expanding to 24–28 fixtures with diverse characteristics unblocks the full experiment program.

## Variants

- **V_A (sole condition)**: Fixture expansion work — no A/B comparison. The "treatment" is the new fixture set itself.

## Pre-registered Gates

### ADOPT if:
- ≥17 fixtures exist with complete ground truth annotations (TP/FP/FN labeled per finding)
- The review-fix benchmark harness passes on each fixture individually (no fixture causes harness errors)
- The expanded suite includes all required fixture types (see Implementation Intent)

### REJECT if:
- N/A — if fixture creation stalls, reduce target and proceed with what exists. Minimum viable set is 17 fixtures.

### INCONCLUSIVE if:
- N/A — E6 either delivers fixtures or it doesn't. Partial delivery is acceptable (proceed with ≥17).

## Methodology

- N: N/A — infrastructure work, not a statistical experiment
- Statistical test: N/A
- Bonferroni correction: N/A

## Implementation Intent (QI checks)

- QI-1 (large file fixtures): Add ≥3 fixtures with source files 300–800 lines. These stress Q19 (cohesion), Q25 (complexity), and harness timeout behavior.
- QI-2 (FP-only fixtures): Add ≥3 fixtures where the ground truth contains zero true bugs — only false positive opportunities. These calibrate the FP rate measurement across all experiments.
- QI-3 (HTML fixture): Add ≥1 `.html` fixture (GAS HtmlService template or vanilla HTML). Required for Q35 coverage and E5 routing validation.
- QI-4 (two-round-forcing fixture): Add ≥1 fixture designed to require exactly 2 review rounds — initial review finds Critical, provided fix is valid, recheck confirms resolution. Required for E2 (recheck model evaluation) and E4 (round ablation).
- QI-5 (GAS .gs fixtures): Expand to ≥8 `.gs` fixtures with Q8-specific ground truth annotations. Required for E5 (dual-reviewer ROI).
- QI-6 (bench validation): Run the full benchmark harness on each new fixture before merging. No fixture may be added without a passing bench run documenting its ground truth.
- QI-7: Document fixture metadata in a manifest file (fixture name, file type, line count, expected round count, TP count, FP opportunities, special properties). This manifest is referenced by E1–E5 experiment scripts.

## Audit Trail

E6 is being implemented in the current PR (branch: exp/review-fix-efficiency). It is listed as a pre-registered experiment rather than just implementation work because (1) the fixture expansion decisions (what types to add, how many) constitute pre-registered choices that should not be changed post-hoc, and (2) the success gate (≥17 fixtures with passing bench) provides an objective completion criterion that downstream experiments depend on. E6 status is IN PROGRESS.
