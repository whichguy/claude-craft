---
schema_version: 1
run_id: micro-noclose-strict-followup-2026-05-09
arms:
  control:   { skill: plugins/review-suite/skills/review-plan/SKILL.md }
  treatment: { skill: plugins/review-suite/skills/review-plan/variants/SKILL-v-micro-noclose-strict.md }
fixtures:
  - { id: input3b,  path: plugins/review-bench/fixtures/inputs/input3b-trivial-pass.md }
  - { id: probe-17, path: plugins/review-bench/fixtures/probes/probe-17-untrusted-log-injection.md }
k: 5
model: sonnet
scoring:
  method: concept_grep_plus_verdict_tier
criteria:
  - id: 4
    fixture: input3b
    rule: "treatment.PASS_rate >= 4/5 AND treatment.PASS_rate >= control.PASS_rate"
  - id: 5
    fixture: probe-17
    rule: "treatment.concept_rate >= 4/5 AND treatment.verdict_not_PASS >= 4/5"
---

# Pre-Registration: micro-noclose-strict ablation — follow-up
**Date:** 2026-05-09 (after main run)
**Purpose:** Close two unaddressed gaps from the main run before promotion: (1) over-flag risk on clean plans; (2) hidden-issue detection on a fixture that exercises blocking-tier defects via untrusted input.

## Variant under test (unchanged)

`SKILL-v-micro-noclose-strict.md` — same body as the main-run variant. No changes.

## New fixtures

| Fixture | Path | Role |
|---|---|---|
| input3b | `plugins/review-bench/fixtures/inputs/input3b-trivial-pass.md` | PASS-calibration. One-line doc edit citing CLAUDE.md line 24 verbatim, with a runnable verification (`grep -n test:bench`). Both variants' TRIVIAL N/A clause should fire. Tests false-positive risk of treatment's strict severity rule. |
| probe-17 | `plugins/review-bench/fixtures/probes/probe-17-untrusted-log-injection.md` | Hidden-issue detection. Untrusted X-Request-Id header flows into log statement without sanitization → CRLF log injection. Tests blocking-tier detection via the directive prose's "untrusted inputs reaching trust boundaries" category. |

## Protocol

- 2 arms (control = current SKILL.md = `micro-2close`; treatment = `micro-noclose-strict`).
- 2 fixtures × 5 reps × 2 arms = **20 sub-agent dispatches**.
- Same Sonnet sub-agent model as the main run.
- Same prompt template, output paths `run-outputs/<variant>-<fixture>-<rep>.txt`.
- Deterministic concept-grep + verdict-tier scoring; no LLM judge.

## Falsifiable pass criteria

### Criterion 4 — input3b (over-flag guard)

The treatment must NOT over-flag a clean trivial-tier plan. **Both** of:
- Treatment PASS-rate ≥ 4/5 (must correctly identify input3b as clean / TRIVIAL).
- Treatment PASS-rate ≥ control PASS-rate (no regression vs. status quo).

Rationale: input3b is the canonical PASS-calibration anchor. The strict severity rule would be a false-positive risk if it produces NEEDS_UPDATE / NOT_READY on plans the directive itself cannot find blocking issues in. The variant's TRIVIAL N/A clause already exempts the severity rule on doc-only plans; this criterion verifies the model honors that exemption.

### Criterion 5 — probe-17 (hidden-issue detection)

Both variants must detect the log-injection defect. For each variant:
- ≥4/5 reps emit the log-injection / untrusted-input-at-trust-boundary concept (regex below).
- ≥4/5 reps verdict ∈ {NEEDS_UPDATE, NOT_READY} (i.e., not PASS).

Concept regex (case-insensitive, OR-joined): `log.?injection|inject.*log|crlf|carriage.?return|sanitiz.*(header|input|trace|request[- ]id)|untrusted.*(input|header|trace|request[- ]id)|trust[ -]?bound|x-request-id.*(sanitiz|valid|escape)|forged log`

## Decision rule

- All criteria 1–5 pass for treatment AND treatment is at-least-as-good as control on every cell → propose promotion of `micro-noclose-strict` (separate decision, not auto).
- Treatment fails Criterion 4 (over-flag) → bank; the strict severity rule has unacceptable false-positive risk on clean plans.
- Treatment fails Criterion 5 (probe-17 detection) → bank; the directive prose alone can't carry untrusted-input detection without close-section scaffolding.
- Control fails Criterion 5 → flag in commit body but do not block treatment promotion (a control regression on probe-17 means the production skill has its own gap, separate from this experiment).

## Lock

This file is committed before any dispatches for the follow-up run. The criteria are immutable for the follow-up; same anti-reshape posture as the main run.
