# Plan: Ablated-v3 Adversarial-Calibration Test

Date: 2026-05-02. Status: ready to execute. Predecessor plans landed in commits
`11dc860`..`24579bc` (Phase A′/A″/A‴/B of the calibration repair).

## Context

Phase B of the calibration repair (commit `24579bc`) revealed three failure modes
that none of the existing variants solve simultaneously:

| Failure mode | Structured control | Ablated-v2 | Null one-liner |
|---|---|---|---|
| Hidden-issue detection (probe-17, probe-21) | catches | catches | catches |
| Cross-file build deps (input11) | catches via Q-G14/Q-C3 | catches | misses 2/3 |
| **Mixed-defect plans (probe-9)** | **PASS/READY × 3 — under-flags** | not measured | catches 2/3 |
| **TRIVIAL doc plan calibration (input3b)** | **fires Q-E2 unnecessarily** | clean PASS | clean PASS |
| Verdict stability on substantive plans | stable | stable × 3 | UNSTABLE 3/6 |

Sharpened question: what's the smallest structural addition to ablated-v2 that beats
the structured control on probe-9 (mixed-defect under-flagging) WITHOUT regressing
on probe-17/21/input11/input3b?

## Hypothesis

The structured control under-flags mixed-defect plans because every directive is
evaluated *independently*: each Q passes (citations look fine, structure looks
clean) so the verdict is PASS, but the plan-as-a-whole has substantive defects no
single Q catches. A single **adversarial closing directive** — explicitly framed
as "imagine this PASSed Gate 1; what's still wrong?" — should close the gap with
minimal token cost.

The 5 adversarial questions in `SKILL-v-ablation-na-adversarial.md` are the
ground-truth probe-9 defect list reframed as predicates:

1. Fabricated quantitative evidence (probe-9: latency citation to bench file no plan step produces)
2. Phantom types/symbols (probe-9: `Memory` type referenced in exports, never defined)
3. Dual-source-of-truth (probe-9: `.md` ↔ SQLite dual-write with no source-of-truth)
4. Broken intermediate state (probe-9: tests in Phase 3 after Phase 1/2 commits)
5. Implicit new toolchain (probe-9: `.ts` source in a shell/markdown repo with no build path)

If a variant with these 5 explicit checks STILL doesn't catch probe-9, the hypothesis
is empirically refuted, which is itself a useful finding.

## Test plan

### Step 1 — Variant authored (DONE in this commit chain)

`skills/review-plan/variants/SKILL-v-ablation-na-adversarial.md` created. Identical
to `SKILL-v-ablation-na.md` plus the Adversarial Close section + verdict
"NOT READY" tier (downgrade target). TRIVIAL-tier N/A clause is built in from the
start (input3b lesson pre-empted, not retro-fitted).

The `--variant` table in `skills/ablate-review-plan/SKILL.md` is updated to
include `ablation-na-adversarial`.

### Step 2 — Spot-check 1 (probe-9 — does the new directive catch what control misses?)

```
/ablate-review-plan --variant ablation-na-adversarial --single probe-9
```

Pre-registered branches:

| Outcome | Verdict |
|---|---|
| ≥2/3 ablated runs reach NEEDS_UPDATE or NOT READY (catching ≥3 of the 5 adversarial-close categories) | PASS — proceed to spot-check 2 |
| ≥2/3 ablated runs reach PASS (same regression as the structured control) | FAIL — hypothesis refuted, halt |
| Inconclusive (verdict-unstable, 1/3 split) | retry with k=5 before halting |

Cost: ~10 LLM calls (1 inspector + 6 reviews + 3 judges).

### Step 3 — Spot-check 2 (input3b — TRIVIAL N/A clause prevents over-flagging)

```
/ablate-review-plan --variant ablation-na-adversarial --single input3b
```

Pre-registered branches (same as the corrected Spot-Check 1 criterion in the v2 harness):

| Outcome | Verdict |
|---|---|
| Spot-Check 1 Pass Criterion met (TIE majority, mode `verdict_agreement = EQUIVALENT`, VERDICTS_STABLE, mode `false_positives ∈ {EQUIVALENT, CONTROL}`, ≥2/3 PASS each side) | PASS — proceed to full suite |
| Mode `false_positives = ABLATED` (adversarial-v3 fires the close on a doc plan) | FAIL — TRIVIAL-tier N/A clause needs tightening; iterate the N/A condition; do not promote |
| Both PASS but adversarial close downgrades to NEEDS_UPDATE on a clean plan | FAIL — same direction as above |

Cost: ~10 LLM calls.

### Step 4 — Full v2 fixture suite (only if both spot checks PASS)

```
/ablate-review-plan --variant ablation-na-adversarial
```

Runs against all 17 v2 fixtures with k=3 under the repaired harness (Step 0b
inspector, decomposed stability flags, pre-registered branch table, Reasoning Digest).

Cost: ~170 LLM calls (17 fixtures × 10).

### Decision-gate (full-suite, pre-registered)

| Outcome | Action |
|---|---|
| Adversarial-v3 catches probe-9 (≥2/3 NEEDS_UPDATE) AND matches ablated-v2 on probe-17/21/input11 AND matches both on input3b | **Promote to default** in the `--variant` flag default; ablated-v2 stays as the legacy reference |
| Adversarial-v3 catches probe-9 BUT regresses on input3b (over-flags trivial doc) | TRIVIAL-tier N/A clause needs tightening; do not promote |
| Adversarial-v3 catches probe-9 BUT regresses on hidden-issue probes (false_negatives = CONTROL on probe-17 or probe-21) | Adversarial close is suppressing earlier directives; restructure as additive scoring not verdict downgrade |
| Adversarial-v3 misses probe-9 (verdict PASS × 2 like control) | Hypothesis refuted — mixed-defect under-flagging not solvable by adversarial framing alone; needs question-level redesign |
| Adversarial-v3 introduces new false positives on the 11 v1 fixtures (mode `false_positives = ABLATED` on plans that were previously TIE) | Adversarial close is too aggressive; trim to 3 questions; retry |

### Step 5 — Results commit

Append a `Phase v3 — Adversarial-Calibration Run` section to `RESULTS.md` with:
- Per-fixture aggregate (winner, verdict-stability, winner-stability, all 5 criteria modes)
- Control vs ablated-v2 vs null vs adversarial-v3 verdict matrix
- Decision-gate verdict applied
- Per-fixture surprises and key judge reasoning quotes
- Pointer to `/tmp/` raw outputs

## Why this is sharper than v1/v2/null

1. **First test that targets the control's weakness, not the variant's.** Phase A through B
   established control over-engineers TRIVIAL plans and under-flags mixed-defect plans.
   v1 and v2 ignored that. v3 directly tests "can a directive variant beat the structured
   control on calibration as well as on coverage?"
2. **The adversarial questions ARE the ground-truth defect list reframed as predicates.**
   Not coincidence — it's what we learned was missed. Hypothesis-refutation is well-defined.
3. **TRIVIAL-tier N/A is pre-empted, not retro-fitted.** input3b's lesson built in from
   the start.

## Out of scope (deferred)

- Tier-aware variant dispatch (TRIVIAL → null, FULL → adversarial-v3) — premature without
  first measuring whether v3 alone closes the gap.
- Question-level redesign of the structured control's Q-E2 N/A clause and mixed-defect
  under-flagging — patching the control still requires re-running the v2 fixture suite,
  which is the same cost as testing v3.
- Formal precision/recall measurement against hand-labeled ground truth per fixture
  (would replace the LLM-as-judge layer with a deterministic comparator). Worth doing
  once the variant lineup stabilizes; not yet.

## Critical files

| Role | Path |
|---|---|
| New variant (created) | `skills/review-plan/variants/SKILL-v-ablation-na-adversarial.md` |
| --variant table (updated) | `skills/ablate-review-plan/SKILL.md` |
| Plan doc (this file) | `skills/ablate-review-plan/PLAN-v3-adversarial.md` |
| Results doc (append after run) | `skills/ablate-review-plan/RESULTS.md` |

## Estimated cost

- Spot checks: 2 × 10 = 20 LLM calls
- Full suite (gated on spot checks): 17 × 10 = 170 LLM calls
- Total upper bound: ~190 LLM calls (comparable to Phase B, which was ~54 calls + the
  reused Phase A‴ controls)

## Verification

- `git show <sha> -- skills/review-plan/variants/SKILL-v-ablation-na-adversarial.md`
  shows the file with the Adversarial Close section and TRIVIAL-tier N/A clause.
- `grep ablation-na-adversarial skills/ablate-review-plan/SKILL.md` returns the new
  row in the variant table.
- After Step 2: `/tmp/ablate-review-plan.<id>/probe-9-judge-{1,2,3}.json` exists and
  the spot-check commit cites the per-run verdict + adversarial-close categories
  caught.
- After Step 3: same for input3b; commit cites verdict-stability and `false_positives`
  mode.
- After Step 4: full-suite commit cites the per-fixture matrix and the decision-gate
  verdict applied.
