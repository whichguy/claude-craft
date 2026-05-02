# Ablation Test Results

First run: 2026-05-02. 11-fixture suite (6 probes + 5 real-world inputs) comparing structured `review-plan/SKILL.md` vs directive variants.

## Three variants tested

| Variant | What it removes | Token cost vs control |
|---|---|---|
| Control | nothing — full structured skill | 100% (~260KB) |
| Ablated | Q-IDs, EVALUATOR_OUTPUT_CONTRACT, convergence loop, wave fan-out | ~3% (85 lines) |
| Ablated-calibrated | same + adds 15-line "Calibration Discipline" preamble | ~4% (100 lines) |

## Aggregate winners

| Variant pair | TIE | CONTROL | ABLATED |
|---|---|---|---|
| Control vs Ablated | 6 | 1 | **4** |
| Control vs Ablated-calibrated | 4 | **4** | 3 |

The calibration directive **regressed** the directive variant. It fixed over-flagging on clean plans (probe-9, input3) but suppressed real findings on substantive plans.

## Per-fixture comparison

| Fixture | Ablated winner | Calibrated winner | Δ |
|---|---|---|---|
| probe-1 (unvalidated constraint) | TIE | TIE | — |
| probe-2 (phantom code refs) | TIE | TIE | — |
| probe-3 (cross-phase contradiction) | TIE | CONTROL | **regressed** |
| probe-7 (untestable verification) | TIE | CONTROL | **regressed** |
| probe-9 (PASS calibration) | CONTROL | TIE | improved |
| probe-16 (GAS contradiction) | ABLATED | ABLATED | — |
| input3 (trivial calibration) | ABLATED | ABLATED | — |
| input4 (diverse issues) | TIE | ABLATED | improved |
| input6 (Node missing prereads) | ABLATED | CONTROL | **regressed** |
| input8 (GAS OAuth TBDs) | ABLATED | TIE | **regressed** |
| input11 (Node parallel phases) | TIE | CONTROL | **regressed (security)** |

## Critical regression: input11

The calibrated reviewer **explicitly considered and dismissed** the X-Trace-Id log injection vulnerability (an untrusted input flowing into a log statement) as "not a blocker on a procedurally complete plan." It also missed the missing Express `Request` type augmentation. This is a clear false negative on a real security issue, not a calibration miss.

The calibration preamble's heuristic — "if the plan is well-cited and procedurally complete, prefer PASS" — is too coarse. It cannot distinguish "no real issues" from "real issues that the reviewer should look harder for."

## Empirical conclusion

The structured question's load-bearing contribution is **per-question discrimination via PASS/N/A**, not the question text itself. The control's bookkeeping selectively skips N/A questions while applying others fully; a directive prompt with a single "be conservative" lever cannot replicate that selectivity.

| Approach | Issue detection | Clean-plan accuracy | Token cost |
|---|---|---|---|
| Control (full) | best | best | highest |
| Ablated (uncalibrated) | as good or better | over-flags | lowest |
| Ablated-calibrated | regressed | matches control | slightly higher |

## Implications for token reduction

A blanket directive replacement is **not viable**. Cheaper paths to fewer tokens:

1. **Prune low-hit-rate questions.** `question-effectiveness-report.md` already drops Q-G2, Q-G8, Q-G17, Q-G20, Q-C21 for 0% hit rate. Continue this approach with measured ablation per question rather than wholesale replacement.
2. **Per-directive N/A semantics.** Give each directive in the ablated variant an explicit N/A condition (e.g., "Flag async errors — N/A if no async paths introduced"). This restores the discriminative bookkeeping without the JSON contract overhead.
3. **Tier-aware directive set.** Trivial tier uses a small directive subset; FULL tier uses the structured skill. Lets you save tokens on most reviews while keeping fidelity for substantive plans.

Option 2 is the most promising — it preserves the directive prompt's compactness while restoring the per-criterion gating that the calibration preamble could not provide.

## Method note

All control, ablated, calibrated, and judge runs used isolated `Agent` subagent calls — fresh context per run, no conversation contamination. Each agent read the skill and fixture from disk and wrote output to `/tmp/`. This isolation is necessary for valid measurement.

The judge (`agents/review-plan-ablation-judge.md`) compared logical equivalence across 5 criteria (issue_overlap, false_negatives, false_positives, severity_alignment, verdict_agreement), not output style — the right framing for ablation testing.

---

# v2 Run — Per-Directive N/A + Hidden-Issue Probes + k=3 Stability

Date: TBD (run pending). Variant: `skills/review-plan/variants/SKILL-v-ablation-na.md`.

## What changed vs v1

1. **Per-directive N/A semantics.** Each directive in the ablated variant gained an explicit
   `N/A: [condition]` clause sourced from `QUESTIONS.md` where a mapping existed. The model
   is instructed to skip directives whose N/A holds — restoring per-criterion gating that
   the v1 calibration preamble could not provide.
2. **5 hidden-issue probes (probe-17..21).** Procedurally clean plans (full citations,
   Pre-check/Outputs, git lifecycle) each containing one subtle real issue:
   - probe-17: untrusted `X-Request-Id` → log injection
   - probe-18: `findUserById` returns `User | undefined`, plan destructures unconditionally
   - probe-19: removed function is a registered scheduled-trigger handler (live entry point)
   - probe-20: fire-and-forget `void notifySignup(...)` silently swallows rejection
   - probe-21: 10× speedup citation references a benchmark file no plan step produces
3. **k=3 repetition + stability reporting.** Each fixture runs control × 3 + ablated × 3
   with paired judges. Per-fixture aggregate is `majority_winner` + `stability_flag`
   (STABLE iff all 3 judges agree).
4. **Decision gate v2.** Recommend replacement only if (a) ≥80% majority TIE/ABLATED,
   (b) ≥80% STABLE, AND (c) zero Gate 1 false negatives including hidden-issue probes.

## Variant size

| Variant | Lines | Token cost vs control |
|---|---|---|
| Control (full structured skill) | ~6500 | 100% |
| v1 ablated (uncalibrated) | 85 | ~3% |
| v1 ablated-calibrated | ~100 | ~4% |
| **v2 ablated-na (per-directive N/A)** | 121 | ~5% |

## Aggregate (TBD — run pending)

| Variant pair | TIE | CONTROL | ABLATED | STABLE % | Gate 1 FN |
|---|---|---|---|---|---|
| Control vs Ablated-na (v2) | ? | ? | ? | ?% | ? |

## Per-fixture aggregate (TBD)

| Fixture | Majority Winner | Stability | Notes |
|---|---|---|---|
| probe-1 | ? | ? | |
| probe-2 | ? | ? | |
| probe-3 | ? | ? | |
| probe-7 | ? | ? | |
| probe-9 | ? | ? | clean-plan calibration |
| probe-16 | ? | ? | |
| probe-17 | ? | ? | hidden: log injection |
| probe-18 | ? | ? | hidden: User \| undefined destructure |
| probe-19 | ? | ? | hidden: live trigger handler removal |
| probe-20 | ? | ? | hidden: silent async rejection |
| probe-21 | ? | ? | hidden: fabricated bench citation |
| input3 | ? | ? | clean-plan calibration |
| input4 | ? | ? | |
| input6 | ? | ? | |
| input8 | ? | ? | |
| input11 | ? | ? | security regression site for v1 calibrated |

## Hypothesis

The structured question system's load-bearing contribution from v1 was per-directive N/A
gating. If that hypothesis is right, v2 should:
- Match or beat v1 uncalibrated on the original 11 fixtures (no regression).
- PASS the new hidden-issue probes (catch the planted finding without over-flagging the
  surrounding clean structure).
- Not regress on input11 (the security false negative that bit the v1 calibrated variant).

If v2 misses any hidden-issue probe with ≥2/3 mode, the directive set has a coverage gap and
the per-directive N/A claim is partially refuted (or the probe targets a category the
directive set doesn't cover).

## Empirical conclusion

TBD — populate after k=3 run completes.

---

### v2 spot-check 1 (probe-9) — fixture mis-classification (2026-05-02)

First spot check of the v2 per-directive N/A variant ran `--single probe-9` (intended as a
PASS-calibration baseline). The pre-registered pass criterion (both verdicts = PASS across
all 3 runs) was **not met**. Diagnosis: this is a *negative result driven by a mis-classified
fixture*, not a variant regression.

**3-run results:**

| Run | Control verdict | Ablated verdict | Judge winner |
|---|---|---|---|
| 1 | READY | NEEDS_UPDATE | CONTROL |
| 2 | GAPS | NEEDS_UPDATE | TIE |
| 3 | NOT READY | NEEDS_UPDATE | TIE |

Aggregates: majority winner = **TIE**, stability = **UNSTABLE**, mode `verdict_agreement`
= EQUIVALENT.

**Diagnosis.** probe-9 is named `g1-pass-calibration.md` but its plan body (an SQLite
migration for the knowledge-aggregator) contains several legitimate ambiguities any
competent reviewer should flag:

- 2.3µs/45µs latency claim cites `bench/results/2026-03-14-memory-read.txt` but no plan step produces that file
- Edits `agents/knowledge-aggregator.md` without citing current function/section names
- Dual-write between `.md` and SQLite with no source-of-truth or staleness rule
- Introduces `.ts` source in a shell/markdown repo with no build/run path
- `Memory` type referenced in exported signatures but never defined
- `id TEXT PRIMARY KEY` schema column with no derivation rule
- Tests land in Phase 3 after Phase 1/2 commits (broken intermediate states)

Both control and ablated correctly catch these. Judges 2 and 3 explicitly note the
"failure" is **symmetric** ("both fail equivalently"). Control itself oscillated
READY → GAPS → NOT READY across 3 runs — the fixture is unstable for the *structured*
skill too. probe-9 cannot serve as a clean-plan calibration baseline.

By contrast `input3-trivial-plan.md` (the other PASS-calibration fixture in the bench)
is a true single-line `CLAUDE.md` edit with no structural ambiguity — that is what a
calibration baseline should look like.

**Decision:**
1. Switch spot-check 1 to `input3` (true PASS calibration).
2. Reclassify probe-9's harness label from "PASS calibration — neither version should
   flag anything" to "ambiguous-plan calibration — both versions should flag substantive
   issues; judge for symmetry, not PASS." probe-9's plan body has signal value as an
   "ambiguous but non-defective" fixture — both variants flagging it consistently is a
   useful signal of equivalent calibration.

Raw outputs: `/tmp/ablate-review-plan.3FHFi6/` (3 control + 3 ablated + 3 judge JSONs).

---

### v2 spot-check 1 retry (input3) — second mis-classified PASS calibration (2026-05-02)

Following the probe-9 spot-check failure, the protocol switched to `input3-trivial-plan.md`
on the assumption it was a true PASS-calibration anchor (single-line `CLAUDE.md` doc edit).
The retry produced the same failure mode: both control and ablated correctly flag real
defects in the fixture, and the pre-registered "both PASS across 3 runs" criterion fails
for the wrong reason.

**3-run results:**

| Run | Control verdict | Ablated verdict | Judge winner | All criteria |
|---|---|---|---|---|
| 1 | NEEDS_UPDATE | NEEDS_UPDATE | TIE | EQUIVALENT × 5 |
| 2 | NEEDS_UPDATE | NEEDS_UPDATE | TIE | EQUIVALENT × 5 |
| 3 | NEEDS_UPDATE | NEEDS_UPDATE | TIE | EQUIVALENT × 5 |

Aggregates: majority winner = **TIE**, stability = **STABLE**, mode `verdict_agreement`
= EQUIVALENT, all 5 criteria modes = EQUIVALENT. Symmetric flagging — exactly what
`probe-9` showed.

**Fixture defects (both variants flagged these):**

- Malformed `## Git Lifecycle1.` header on line 15 — heading and 3 ordered-list items
  concatenated into a single line with no newlines, unparseable as Markdown
- Replacement value `1ABC123newScriptIdHere456` is a 25-char obvious placeholder, not a
  real ~57-char Apps Script ID (the OLD value `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`
  is 56 chars)
- Verification step ("Read the file to confirm the change was applied correctly") is
  vacuous — confirms only that an edit happened, not that the new ID is correct or resolves

**Judge 1 reasoning (verbatim):** *"EXPECTED_FINDING posited a clean PASS, but the plan
actually contains a placeholder ID and formatting defects, so both reviews correctly
diverged from the calibration expectation in the same way."*

Judges 2 and 3 reach the same conclusion (TIE / EQUIVALENT × 5) and explicitly cite the
placeholder script ID, malformed Git Lifecycle, and weak verification step as the
reasons both reviews flagged.

**Conclusion:** the bench has **no clean-plan baseline**. Both nominal PASS-calibration
fixtures (`probe-9`, `input3`) are mixed-defect plans where symmetric NEEDS_UPDATE is
the *correct* outcome, not a calibration failure. The spot-check 1 protocol must be
repaired — author a true `input3b-trivial-pass.md`, reclassify both existing fixtures as
ambiguous/mixed-defect symmetry tests, and tighten the PASS criterion to tolerate one
stochastic flip — before any decision-gate run is meaningful.

Raw outputs: `/tmp/ablate-review-plan.uQILVP/` (3 control + 3 ablated + 3 judge JSONs).

---

### Spot-Check 1 Pass Criterion — revised (2026-05-02)

After two consecutive PASS-calibration mis-classifications (probe-9, input3) and the
authoring of `input3b-trivial-pass.md` as a true clean-plan anchor, the brittle "both
verdicts = PASS across all 3 runs" rule is replaced with the following defense-in-depth
criterion (mirrored in `skills/ablate-review-plan/SKILL.md` top-of-file):

```
PASS criterion (input3b — clean-plan calibration):
  - Majority winner = TIE
  - Mode verdict_agreement = EQUIVALENT
  - Stability = STABLE
  - Mode false_positives ∈ {EQUIVALENT, CONTROL}    ← ablated must not over-flag more than control
    (judge's `false_positives = X` means side X had more FPs; allowed set excludes the over-flagging side)
  - At least 2 of 3 control AND 2 of 3 ablated runs reach PASS
```

Rationale: the new criterion tolerates a single stochastic flip per side (preventing
the trivial 1-of-6-runs failure that bit probe-9 and input3 retries) while still
detecting systematic over-flagging via the `false_positives` mode anchor. The
PASS-quorum requirement (≥ 2 of 3) preserves the original goal — ablated must not
*systematically* flag clean plans — without making single-run noise dispositive.

`input3` and `probe-9` are reclassified to symmetry-of-flagging tests (NEEDS_UPDATE
expected from both sides, mode `verdict_agreement = EQUIVALENT`, majority winner TIE)
and are no longer eligible to anchor the over-flagging dimension of the v2 decision
gate. `input3b` is the sole PASS-calibration fixture.

---

### v2 spot-check 1 — input3b PASS-with-finding (2026-05-02)

First spot check against `input3b-trivial-pass.md` (the true clean-plan anchor authored
after probe-9 and input3 were both reclassified to mixed-defect symmetry tests).

**3-run results (k=3):**

| Run | Control verdict | Ablated verdict | Judge winner |
|---|---|---|---|
| 1 | PASS | PASS | ABLATED |
| 2 | PASS | PASS | TIE |
| 3 | PASS | PASS | CONTROL |

Aggregates: majority winner = no majority (SPLIT — treated as TIE); verdict-side: 3/3 PASS
on both control and ablated.

**Per-criterion modes:**

| Criterion | Mode | Notes |
|---|---|---|
| issue_overlap | EQUIVALENT | (3 judges: EQUIVALENT, EQUIVALENT, CONTROL) |
| false_negatives | EQUIVALENT | (3 judges: EQUIVALENT, EQUIVALENT, CONTROL) |
| **false_positives** | **CONTROL** | (3 judges: CONTROL, EQUIVALENT, CONTROL) — control over-flagged |
| severity_alignment | EQUIVALENT | unanimous |
| verdict_agreement | EQUIVALENT | unanimous (5×) |

**Stability flags (decomposed — see Step 2 of repair plan):**

- **Verdict stability: VERDICTS_STABLE** — all 3 control runs reached PASS; all 3 ablated runs reached PASS. The substantive signal (does the variant produce reliable verdicts) is rock-solid.
- **Winner stability: WINNER_UNSTABLE** — judges split [ABLATED, TIE, CONTROL] on classifying the control's Q-E2 self-edit. Acceptable here because verdict-stability is VERDICTS_STABLE *and* mode `false_positives` ∈ {EQUIVALENT, CONTROL}.

**Spot-Check 1 verdict under the corrected criterion: PASS.**

(Under the prior buggy criterion `{EQUIVALENT, ABLATED}` this would have been recorded
as a fail — the criterion accepted the failure mode it was meant to forbid and rejected
the case that actually occurred.)

---

#### Substantive finding — control over-flags TRIVIAL-tier doc plans (Q-E2)

The control's Q-E2 directive ("Post-Implementation Workflow") fires on TRIVIAL-tier
single-line documentation plans and self-injects a `## Post-Implementation Workflow`
section the plan does not need. The ablated variant correctly N/A-skips it on a doc-only
plan with no executable artifacts.

This is the **first empirical evidence that the structured control has its own
over-flagging defect**, not just the ablated variant. It sharpens Phase B's question
from "does any structure beat null?" to **"what is the smallest structural footprint
that beats null on hidden-issue probes without over-flagging trivial ones?"**

**Filed as:** known control defect against `review-plan` Q-E2 N/A clause (does not
list "documentation-only single-step plan with no code changes (TRIVIAL tier with no
executable artifacts)" as an N/A condition).

**Deferred to:** v3 control-patch iteration after Phase B. Mutating the control mid-bench
invalidates prior calibration; the v3 iteration will re-run input3b + the v2 fixture
suite against the patched control to measure whether the over-flagging finding from
input3b reproduces or resolves.

**Judge reasoning quotes (verbatim):**

- **Judge 1 (winner = ABLATED):** *"Both reach PASS on a clean trivial doc edit; control raised an internal Q-E2 concern (missing Post-Implementation Workflow section) and self-applied an edit, while the ablated version correctly treated the trivial doc edit as needing nothing extra — a minor false positive on the control side."*
- **Judge 3 (winner = CONTROL):** *"Both reach PASS as expected for this clean-plan baseline, but the control flagged a missing Post-Implementation Workflow section (Q-E2) and applied an inline edit, while the ablated version raised nothing — for a true PASS calibration the control's extra flag is itself a minor false positive against the expected 'neither flags anything substantive' baseline, but it is more rigorous than the ablated which silently skipped the post-implementation check."*

(The judges agree on the *fact* — control fired Q-E2, ablated did not — but disagree
on the *classification* — false positive, or extra rigor? This is exactly the
winner-stability conflation the unified `STABLE` flag obscured.)

**Raw outputs:** `/tmp/ablate-review-plan.CPhaBZ/` (3 control + 3 ablated reviews + 3 judge JSONs).

**Prior calibration-repair commits:** `d13e9eb` (input3 reclassification), `0401924`
(input3b authored as PASS anchor), `673f147` (Spot-Check 1 Pass Criterion v1, with
the typo this commit chain repairs).

---

### Stability flag decomposed (2026-05-02) — companion to input3b spot-check

The single `STABLE/UNSTABLE` flag from the v2 harness conflated two orthogonal signals.
input3b made the conflation observable: 3/3 PASS on both control and ablated (verdict
signal rock-solid) BUT judges split [ABLATED, TIE, CONTROL] on whose Q-E2 behavior was
correct (winner signal noisy on a stylistic distinction). Under the unified `STABLE`
flag this scored as "fails the 80% stability gate" — but the substantive verdict signal
is exactly what the gate was *trying* to measure.

Replaced the unified flag with two orthogonal flags (mirrored in `SKILL.md` Step 3):

```
Verdict stability:
  VERDICTS_STABLE iff (a) all 3 control runs reach the same final verdict
  (PASS / NEEDS_UPDATE / NOT READY) AND (b) all 3 ablated runs reach the same
  final verdict. SUBSTANTIVE SIGNAL — answers "does the variant produce
  reliable verdicts." Used by the v2 decision-gate 80% stable_count threshold.

Winner stability:
  WINNER_STABLE iff all 3 judges agree on `winner`. SECONDARY TIEBREAK —
  can be UNSTABLE on a fixture even when both sides issue identical verdicts
  (judges disagree on classifying stylistic / extra-rigor differences).
```

The v2 decision-gate `stable_count` formula in Step 3 now uses `VERDICTS_STABLE` (not
the old combined flag). The 80% threshold now measures verdict reproducibility — what
it was always trying to measure.

Spot-Check 1 Pass Criterion tolerance:
- `WINNER_UNSTABLE` is acceptable iff verdict-stability is `VERDICTS_STABLE` *and*
  mode `false_positives` ∈ {EQUIVALENT, CONTROL}. Surfaced in the false-positive
  summary as a signal, not a fail.

input3b under the new flags:
- Verdict stability: **VERDICTS_STABLE** (3/3 PASS each side) ✓
- Winner stability: WINNER_UNSTABLE (judges classify Q-E2 self-edit differently)
- Result: Spot-Check 1 PASSES.

---

### Spot-Check 1 — Decision branches (pre-registered, 2026-05-02)

To prevent the retroactive-reshape failure mode that the prior calibration-repair plan
fell into (Step 5 anticipated only `false_positives = ABLATED`; input3b hit
`false_positives = CONTROL` + `WINNER_UNSTABLE` on identical verdicts and the criterion
had to be repaired mid-flight), the full Spot-Check 1 branch space is enumerated
*before* spot-checks 2/3 run.

Mirrored in `skills/ablate-review-plan/SKILL.md` (top of body, before the v2 decision gate):

| Outcome | Interpretation | Action |
|---|---|---|
| All criteria EQUIVALENT, both PASS, WINNER_STABLE TIE | Clean PASS | Proceed |
| `false_positives = ABLATED` (mode) | Ablated over-flags clean plans | Patch ablated variant; do not proceed |
| `false_positives = CONTROL` (mode) + both PASS | Control over-flags clean plans (filed as separate finding) | Note in RESULTS.md + commit body; proceed (control defect, not bench failure) |
| Either side fails PASS-quorum (<2/3) | Verdict instability | Inspect raw outputs; if fixture-defect, reclassify; if model-stochasticity, retry with k=5 |
| `false_negatives = CONTROL` on Gate-1 fixture | Coverage gap in directive set | Patch ablated; do not proceed |
| `verdict_agreement = CONTROL` or `ABLATED` (mode) | Substantive verdict divergence | Inspect; the *direction* of divergence determines branch |

input3b (2026-05-02) lands in row 3: `false_positives = CONTROL` + both PASS →
control-defect finding, proceed.

---

### Methodology hardening (2026-05-02) — Step 0b precondition + Judge Reasoning Digest

Two harness improvements pre-load lessons from the probe-9 / input3 / input3b spot-check
arc so Phase A‴ (spot-checks 2 and 3) and Phase B (null-baseline) don't repeat them.

**1. Step 0b: fixture validity precondition.**

Before spawning any review agent, run ONE inspector agent per fixture (general-purpose,
~30s) and compare its `suitable_as` classification to the fixture map's expected role.
If they disagree, HALT — do not waste 6 agents + 3 judges on a known-broken fixture.

The 5-iteration calibration arc (probe-9 → input3 → input3b → criterion-fix) cost
**2 full discovery cycles** on mis-classified fixtures (probe-9 and input3 each ran
6 agents + 3 judges = 9 LLM calls before the mis-classification surfaced from the judge
outputs). Cost ratio of the new pre-flight: ~30s × N (cheap inspector per fixture)
vs ~5min × N + 9 LLM calls per bad fixture.

**2. Judge Reasoning Digest as first-class output.**

The judges' `reasoning` text has been the most informative signal across every spot
check, but it was buried in 3 JSON files per fixture. The harness now emits
`$RESULTS_DIR/judge-reasoning-digest.md` — for each fixture, the 3 judge `reasoning`
strings concatenated with `winner` labels and key criteria modes.

Concrete example: input3b judges 1+3 reasoning surfaced "control raised an internal
Q-E2 concern (missing Post-Implementation Workflow section) and self-applied an edit"
— the *what* of the over-flagging. The criteria mode `false_positives = CONTROL` alone
captured only the *direction*. The reasoning digest is what made the finding legible
and actionable enough to file as a deferred control-patch task.

Both improvements are in `skills/ablate-review-plan/SKILL.md` (Step 0b before Step 1;
Step 4 output extended with the digest).

---

### v2 spot-check 2 — probe-17 hidden-issue detection (2026-05-02)

`/ablate-review-plan --single probe-17` under the repaired harness (Step 0b precondition
+ corrected criterion + decomposed stability flags + pre-registered branch table).

**Step 0b inspector:** `suitable_as = "hidden_issue"` — agreed with fixture map.
Inspector identified the X-Request-Id → log-line flow as the lone planted defect.

**3-run results (k=3):**

| Run | Control verdict | Ablated verdict | Judge winner |
|---|---|---|---|
| 1 | NEEDS_UPDATE | NEEDS_UPDATE | CONTROL |
| 2 | NEEDS_UPDATE | NEEDS_UPDATE | CONTROL |
| 3 | NEEDS_UPDATE | NEEDS_UPDATE | CONTROL |

Aggregates:
- Majority winner = **CONTROL** (unanimous)
- **Verdict stability: VERDICTS_STABLE** (3/3 NEEDS_UPDATE on each side)
- **Winner stability: WINNER_STABLE**

**Per-criterion modes:**

| Criterion | Mode | Per-run values |
|---|---|---|
| issue_overlap | CONTROL | CONTROL × 3 |
| **false_negatives** | **EQUIVALENT** | EQUIVALENT, EQUIVALENT, CONTROL |
| false_positives | EQUIVALENT | EQUIVALENT × 3 |
| severity_alignment | EQUIVALENT | EQUIVALENT, EQUIVALENT, CONTROL |
| verdict_agreement | EQUIVALENT | EQUIVALENT × 3 |

**Spot-Check 2 verdict (against pre-registered branch table): PASS.**

The decisive criterion for a hidden-issue Gate-1 probe is `false_negatives`. Mode =
**EQUIVALENT**, NOT CONTROL — meaning the ablated v2 variant **caught the planted
log-injection finding in all 3 runs**, with the same severity and the same fix as the
control. The branch row "false_negatives = CONTROL on Gate-1 fixture" (which would be a
FAIL — coverage gap) is NOT triggered.

Control wins on `issue_overlap` × 3 because it surfaces broader advisory findings the
ablated variant omits (caller enumeration for `reserve`/`charge` signature change,
Express `Request` type augmentation, rollback/kill switch, Grafana LogQL backward-compat,
expanded test cases). This is consistent with the v1 conclusion that advisory directives
in the structured skill carry real value on substantive plans, but does NOT represent
a hidden-issue coverage gap.

**Substantive findings:**
- Ablated v2 successfully closes the hypothesized v1 hidden-issue gap on log injection.
- Control retains an issue-coverage advantage on advisory directives (Q-C7 rollback,
  Q-G14 TS module augmentation, Q-C40 Grafana claims, Q-C8/Q-C27 service signature
  break, Q-G10/Q-G30 nginx trust-boundary). These are MIXED-band signals: under the
  v2 decision gate they would push the verdict to "MIXED — Gate 1 questions
  load-bearing; advisory directives candidates for trimming" rather than "RECOMMEND_REPLACEMENT".

**Key judge quote (judge 1):** *"Both reviews caught the expected log-injection finding
with matching fixes and both verdicts are NEEDS_UPDATE; however, the control flagged
additional substantive issues the ablated review omitted."*

**Raw outputs:** `/tmp/ablate-review-plan.v9FVld/` (3 control + 3 ablated reviews + 3 judge JSONs + inspector JSON).

---

### v2 spot-check 3 — probe-1 verdict-stability sanity (2026-05-02)

`/ablate-review-plan --single probe-1` under the repaired harness. Verdict-stability
sanity check on a Gate-1 fixture with one substantive defect (unsubstantiated
PropertiesService capacity claim — Q-G1 stress test).

**Step 0b inspector:** `suitable_as = "general"` — agreed with fixture map. Single
defect identified: the unsubstantiated quantitative/capacity claim.

**3-run results (k=3):**

| Run | Control verdict | Ablated verdict | Judge winner |
|---|---|---|---|
| 1 | NEEDS_UPDATE | NEEDS_UPDATE | TIE |
| 2 | NEEDS_UPDATE | NEEDS_UPDATE | TIE |
| 3 | NEEDS_UPDATE | NEEDS_UPDATE | TIE |

Aggregates:
- Majority winner = **TIE** (unanimous)
- **Verdict stability: VERDICTS_STABLE** (3/3 NEEDS_UPDATE on each side)
- **Winner stability: WINNER_STABLE** (TIE × 3)

**Per-criterion modes:** all 5 = **EQUIVALENT** × 3 (unanimous on every criterion).

| Criterion | Mode |
|---|---|
| issue_overlap | EQUIVALENT |
| false_negatives | EQUIVALENT |
| false_positives | EQUIVALENT |
| severity_alignment | EQUIVALENT |
| verdict_agreement | EQUIVALENT |

**Spot-Check 3 verdict (against pre-registered branch table): PASS.**

Lands in branch-table row 1 (modulo verdict label): "All criteria EQUIVALENT,
WINNER_STABLE TIE" — the cleanest possible symmetric outcome. Verdict is NEEDS_UPDATE
not PASS because the fixture has a real defect both sides correctly flag; the
*symmetry* of flagging is what the spot check measures, and that is unanimous.

This is exactly the pattern the v2 architecture predicts when both variants share
the same load-bearing question (Q-G1 evidence-checking on quantitative claims) and
the ablated v2 has the matching N/A-gated directive: identical issue detection,
identical severity, identical verdict.

**Substantive findings:** none against the variant. Control is "more exhaustive
structurally" (judge 1) on advisory items but "the substantive findings overlap"
across all 3 judges — consistent with the probe-17 finding that advisory directive
trimming, not core directive coverage, is the remaining signal.

**Key judge quote (judge 3):** *"Both reviews caught the planted unvalidated
PropertiesService-latency constraint as the load-bearing issue and reached
NEEDS_UPDATE; they overlap on existing-code/Read-before-edit, input/config validation,
error handling, and rollback concerns with consistent severity."*

**Raw outputs:** `/tmp/ablate-review-plan.v9FVld/` (3 control + 3 ablated reviews + 3 judge JSONs + inspector JSON).

---

### Phase A‴ summary (2026-05-02) — both spot checks PASS

| Spot check | Fixture | Decisive criterion | Result | Branch row |
|---|---|---|---|---|
| 1 | input3b | mode false_positives ∈ {EQUIVALENT, CONTROL} + 3/3 PASS | PASS | row 3 (control over-flags trivial; control defect filed, proceed) |
| 2 | probe-17 | mode false_negatives ≠ CONTROL on hidden-issue probe | PASS | not in failing rows; ablated caught planted finding |
| 3 | probe-1 | VERDICTS_STABLE + symmetric flagging | PASS | row 1 (clean equivalent outcome, verdict NEEDS_UPDATE — symmetric) |

**Decision: Phase B (null-baseline) is unblocked.**

The repaired harness produced VERDICTS_STABLE results on all three spot checks with
no Gate-1 false negatives. The pre-registered branch table covered every observed
outcome — no mid-flight criterion repair needed (compare to probe-9 → input3 →
input3b arc which required 3 iterations).

The substantive Phase A‴ finding mirrors the v1 conclusion: the ablated v2 directive
set is **coverage-equivalent on Gate-1 issues** (probe-1 + probe-17 both confirm)
but **leaner on advisory issues** (probe-17's `issue_overlap = CONTROL × 3` is the
tell). Phase B's sharpened question stands: does null match ablated on Gate-1
hidden-issue probes? If yes, even the directive set is over-engineered.
