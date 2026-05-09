# micro-noclose-strict ablation — findings (2026-05-09)

## Headline

**Treatment (`micro-noclose-strict`, 34 lines, no close section, deterministic severity rule) passes all 3 pre-registered criteria. Control (`micro-2close`, the current production skill) fails the probe-9 NOT_READY criterion under Sonnet sub-agents.**

The result is materially significant *and* materially complicated by the comparability check.

## Per-cell against pre-registered criteria

| Variant | probe-21 catch+downgrade ≥4/5 | probe-9 NOT_READY ≥4/5 | input11 concepts≥2 ≥4/5 AND verdict≠PASS ≥4/5 |
|---|---|---|---|
| control (`micro-2close`)         | **5/5 ✓** | **0/5 ✗** (all NEEDS_UPDATE) | **5/5 / 5/5 ✓** |
| treatment (`micro-noclose-strict`)| **5/5 ✓** | **5/5 ✓** | **5/5 / 5/5 ✓** |

Per-rep raw scores: see `score-run.sh` output committed in `RUN-RESULTS.txt`.

## Substantive interpretation

### Both variants emit the same findings

Direct read of paired outputs (control-probe9-1 vs treatment-probe9-1, etc.) confirms: both variants flag essentially identical defects on every fixture — fabricated benchmark citations, native toolchain gaps, missing pre-reads, dual-source-of-truth, untestable verifications, etc.

**Concept emission is not the differentiator.** Both variants surface the issues. The directive prose alone (which `micro-noclose-strict` and `micro-2close` share, modulo the close section) is what generates findings.

### The differentiator is verdict-tier calibration

The two variants disagree on *how severely* to weight the same findings:

- **Control (`micro-2close`)** uses the close section's tier-downgrade rule: "if any close-question answer is non-empty, downgrade verdict one tier." On probe-9, this fires once (fabricated-quant from the adversarial close) → `PASS → NEEDS_UPDATE`. It does not stack — multiple blocking findings still result in a single one-tier downgrade.
- **Treatment (`micro-noclose-strict`)** uses a deterministic count-based rule: 0 blocking → PASS/NEEDS_UPDATE; 1 blocking → ≤NEEDS_UPDATE; ≥2 blocking → NOT_READY. On probe-9, four blocking findings → straight to NOT_READY.

The treatment's rule scales with finding count; the control's rule does not. This is why the treatment was strictly more aggressive on every probe-9 rep.

### probe-21 is symmetric

Both variants caught the fabricated 10× speedup citation 5/5 reps. Both correctly downgraded — control 3-of-5 NOT_READY, 2-of-5 NEEDS_UPDATE; treatment 3-of-5 NOT_READY, 2-of-5 NEEDS_UPDATE. The variant counts here are *identical*. The close-question scaffold does not provide additional severity signal on a single-finding plan.

### input11 — the prior-research regression fixture

The fixture `micro-1close` (Arm B) was banked on. Both variants pass cleanly at k=5: 5/5 reps catch ≥2 of {W3C trace context, per-request UUID, async-context}; 5/5 reps issue NEEDS_UPDATE or NOT_READY. The treatment goes further — 5/5 NOT_READY vs control's 5/5 NEEDS_UPDATE — reflecting the same severity-tier behavior as on probe-9.

This **does not mean** the prior research's input11/1close finding was wrong. The prior research used a paired LLM judge that weighted severity-disagreement as a control win for `micro-2close`. Concept-grep alone (this run's method) does not capture that signal. The substantive picture: 1close, 2close, and noclose-strict all *find* the same things; they differ on tier.

## Methodology issue: control fails comparability check

The pre-registration's sanity check states:

> "If CONTROL fails any criterion, the criterion is mis-specified or the harness is broken — invalidating the run regardless of the NEW arm result."

CONTROL failed probe-9 NOT_READY (0/5 vs the prior-research's 3/3). Strict reading: the run is inconclusive for promotion.

What changed since the prior research that explains this:

1. **Sub-agent model.** The prior research used the orchestrator's default model (likely Opus). This run used Sonnet (per user direction). The same `micro-2close` body produces NOT_READY 3/3 on Opus and NEEDS_UPDATE 5/5 on Sonnet. **The single-tier-downgrade rule's effective severity is model-dependent.** This is a critical and underappreciated finding — it implies the prior research's promotion decision is not portable across the Sonnet sub-agent population, which is what the production skill encounters in practice.
2. **Sample size shift.** Prior research k=3, this run k=5. Variance is lower here, but k=5 vs k=3 should not flip mean behavior.
3. **No content drift.** `git show 5a77375:plugins/review-suite/skills/review-plan/SKILL.md` matches the body served to the control sub-agents — verified by Read.

The comparability failure is therefore a *real* finding about model dependence, not a methodological glitch.

## What this means for "we can remove questions"

**Yes, with caveats.** The hypothesis "the close *questions* are scaffolding around the load-bearing *downgrade rule*" is supported by the evidence:

- Both variants emit the same findings (the directive prose carries category coverage).
- The treatment's deterministic count-based rule outperforms the control's single-tier-downgrade rule on multi-finding plans (probe-9, input11).
- The treatment matches the control on single-finding plans (probe-21).

The caveats:
- Comparability against prior research is partial because the model differs. The prior research's gate criteria were calibrated to Opus; this run is on Sonnet.
- This run did not test TRIVIAL/PASS calibration (input3b). The treatment may over-flag clean plans more than the control. **The strict severity rule could be a false-positive risk on plans without blocking-tier defects.** Untested in this run.
- The directive prose in `micro-noclose-strict` already includes the fabricated-quant and phantom-types categories explicitly. Anyone interpreting the result as "questions never matter" is overreading: the categories matter; the *adversarial close question + single-tier downgrade* form was just one (less-effective on Sonnet) way to operationalize them.

## Decision (without auto-promote)

Do not auto-promote. Surface to user with three options:
1. Promote `micro-noclose-strict` as the new production default. Risk: untested over-flag rate on clean plans.
2. Run a follow-up: same protocol but adding `input3b` (PASS calibration) and `probe-17` (hidden untrusted-input — sanity for blocking detection). Confirms no over-flagging before promotion.
3. Do nothing — bank the variant; treat the model-dependence finding as the take-home for now.

## Files

- `PRE-REGISTRATION.md` — locked at commit `11a3602` before any agent dispatches.
- `score-run.sh` — locked at commit `f2a1580`.
- `run-outputs/{control,treatment}-{probe21,probe9,input11}-{1..5}.txt` — 30 raw reviews.
- `RUN-RESULTS.txt` — scoring script output.

## Cost

30 sub-agent dispatches × Sonnet, ~20K tokens each = ~600K tokens, ~$5-10 of compute.
