---
schema_version: 1
run_id: smoke-probe9-2026-05-09
arms:
  control:   { skill: plugins/review-suite/skills/review-plan/SKILL.md }
  treatment: { skill: plugins/review-suite/skills/review-plan/variants/SKILL-v-micro-noclose-strict.md }
fixtures:
  - { id: probe-9, path: plugins/review-bench/fixtures/probes/probe-9-g1-pass-calibration.md }
k: 5
model: sonnet
scoring:
  method: concept_grep_plus_verdict_tier
criteria:
  - id: 1
    fixture: probe-9
    rule: "treatment.NOT_READY_rate >= 4/5"
  - id: 2
    fixture: probe-9
    rule: "control.NEEDS_UPDATE_rate >= 4/5"
---

# Smoke pre-registration: probe-9 reproduction

This pre-registration reproduces the headline RUN-FINDINGS.md row that established
the count-based-severity-rule effect: probe-9 (mixed-defect calibration) under Sonnet,
with the production `micro-noclose-strict` variant downgrading to NOT_READY in 5/5
runs while the structured control stays at NEEDS_UPDATE.

Acceptance is ±1 cell stochastic tolerance (i.e., ≥ 4/5 on either side counts).
Tighter spec (5/5 on both sides) is informational, not a fail.

Run with: `/ablate-review-plan --pre-reg plugins/review-bench/skills/ablate-review-plan/smoke-prereg.md`
