---
name: ablate-review-plan
description: |
  Ablation test harness for the review-plan skill. Runs the structured question-based
  control (SKILL.md) and the directive-based ablated variant
  (SKILL-v-ablation-na.md, per-directive N/A semantics) against the same fixture set
  with k=3 repetition, then uses the review-plan-ablation-judge to compare outputs
  for logical equivalence and reports per-fixture stability.

  Answers: do the structured question IDs add meaningful signal, or does a directive
  prompt achieve equivalent issue detection?

  Spot-Check 1 Pass Criterion (input3b — clean-plan calibration anchor):
    - Majority winner = TIE (or SPLIT, treated as TIE)
    - Mode verdict_agreement = EQUIVALENT
    - Verdict stability = VERDICTS_STABLE  (all 3 control runs same verdict AND all 3 ablated runs same verdict)
    - Winner stability = WINNER_STABLE OR WINNER_UNSTABLE (the latter is acceptable iff
      verdict-stability is VERDICTS_STABLE AND mode false_positives ∈ {EQUIVALENT, CONTROL};
      surface in the false-positive summary as a signal, not a fail)
    - Mode false_positives in {EQUIVALENT, CONTROL}  (ablated must not over-flag more than control;
      false_positives = X means side X had more FPs, so the allowed set excludes the over-flagging side)
    - >= 2 of 3 control AND >= 2 of 3 ablated runs reach PASS
  Tolerates one stochastic flip per side; detects systematic over-flagging via the
  false_positives mode. Brittle "all 3 PASS" rule replaced after probe-9/input3
  calibration repair (see RESULTS.md 2026-05-02 entries).

  AUTOMATICALLY INVOKE when user mentions:
  - "ablation test", "ablate review-plan", "test directive variant"
  - "does the question structure matter", "directive vs questions"

argument-hint: "[--fixtures <probe-N,...|input-N,...>] [--single <fixture>]"
allowed-tools: Agent, Bash, Read, Glob, Write, Edit
---

# ablate-review-plan Skill

Measures whether the structured question-based control (`skills/review-plan/SKILL.md`)
produces materially better issue detection than the directive-based ablated variant
(`skills/review-plan/variants/SKILL-v-ablation-na.md` — per-directive N/A semantics, v2).

**Architecture (v2 — k=3):** For each fixture, run control × 3 and ablated × 3 in parallel,
then run the judge × 3 (paired by index) once outputs land. Aggregate into a per-fixture
**majority winner** + **stability flag** + per-criterion mode. The judge evaluates for
logical equivalence (same issues found, same verdict) — not output quality. k=3 distinguishes
stochastic noise from real regressions.

**Spot-Check 1 failure-mode branch table (pre-registered):**

The original v2 plan anticipated only `false_positives = ABLATED`. input3b hit
`false_positives = CONTROL` + `WINNER_UNSTABLE` on identical verdicts — a mode the plan
didn't enumerate, which forced a mid-flight retroactive criterion reshape. To prevent
recurrence, the full branch space is enumerated *before* spot-checks 2/3 run:

| Outcome | Interpretation | Action |
|---|---|---|
| All criteria EQUIVALENT, both PASS, WINNER_STABLE TIE | Clean PASS | Proceed |
| `false_positives = ABLATED` (mode) | Ablated over-flags clean plans | Patch ablated variant; do not proceed |
| `false_positives = CONTROL` (mode) + both PASS | Control over-flags clean plans (filed as separate finding) | Note in RESULTS.md + commit body; proceed (control defect, not bench failure) |
| Either side fails PASS-quorum (<2/3) | Verdict instability | Inspect raw outputs; if fixture-defect, reclassify; if model-stochasticity, retry with k=5 |
| `false_negatives = CONTROL` on Gate-1 fixture | Coverage gap in directive set | Patch ablated; do not proceed |
| `verdict_agreement = CONTROL` or `ABLATED` (mode) | Substantive verdict divergence | Inspect; the *direction* of divergence determines branch |

Pre-registration matters: deciding the branch *after* seeing the result is how plans get
retroactively reshaped to fit the data. Step 5 of the prior calibration-repair plan did
exactly that when it hit `false_positives = CONTROL`; this table closes that loophole.

---

**Decision gate (pre-registered, v2 — requires stability):**

| Result | Interpretation |
|--------|---------------|
| ≥80% majority TIE/ABLATED + ≥80% VERDICTS_STABLE + 0 Gate 1 false negatives | Recommend replacement — ablated v2 is sufficient |
| ≥2 Gate 1 false negatives (incl. hidden-issue probes 17–21) | Questions are load-bearing — keep structured evaluation |
| <80% VERDICTS_STABLE | Variant is stochastically unreliable — not deployable regardless of mean performance |
| Mixed (false negatives on advisory but not Gate 1) | Partial — Gate 1 directives load-bearing; trim advisory directives |

---

## Step 0: Parse Arguments

Read the invocation arguments. Supported forms:

```
/ablate-review-plan                                        # full 16-fixture suite × k=3
/ablate-review-plan --single probe-9                       # single fixture × k=3
/ablate-review-plan --fixtures probe-1,probe-9,input3      # comma-separated subset × k=3
```

**Fixture short-name → path map:**

| Short name | Path | Expected finding (ground truth) |
|------------|------|----------------------------------|
| `probe-1` | `skills/review-plan/probes/probe-1-unvalidated-constraint.md` | Q-G1: asserts PropertiesService rejected without benchmarks |
| `probe-2` | `skills/review-plan/probes/probe-2-phantom-code-references.md` | Q-G11: no file paths or function names cited |
| `probe-3` | `skills/review-plan/probes/probe-3-cross-phase-contradiction.md` | Q-G21/G22: cross-phase contradiction + undefined field |
| `probe-7` | `skills/review-plan/probes/probe-7-untestable-verification.md` | Q-G20: verification section has no runnable commands |
| `probe-9` | `skills/review-plan/probes/probe-9-g1-pass-calibration.md` | ambiguous-plan calibration — both versions should flag substantive issues; judge for symmetry, not PASS (see RESULTS.md 2026-05-02 spot-check 1) |
| `probe-16` | `skills/review-plan/probes/probe-16-gas-chatservice-wrapper.md` | Q-G21: internal contradiction in step scoping |
| `probe-17` | `skills/review-plan/probes/probe-17-untrusted-log-injection.md` | Hidden issue: untrusted X-Request-Id header → log injection (read first-line `<!-- expected-finding: ... -->`) |
| `probe-18` | `skills/review-plan/probes/probe-18-silent-type-mismatch.md` | Hidden issue: cited fn returns `User \| undefined`, plan destructures unconditionally |
| `probe-19` | `skills/review-plan/probes/probe-19-live-entry-point-removal.md` | Hidden issue: removed function is a registered scheduled trigger (live external entry point) |
| `probe-20` | `skills/review-plan/probes/probe-20-silent-async-rejection.md` | Hidden issue: fire-and-forget `void notifySignup(...)` silently swallows rejection |
| `probe-21` | `skills/review-plan/probes/probe-21-procedurally-clean-false-claim.md` | Hidden issue: 10× speedup citation references a benchmark file no plan step produces |
| `input3` | `skills/review-plan/inputs/input3-trivial-plan.md` | mixed-defect calibration — both versions should flag malformed `## Git Lifecycle1.` header + placeholder script ID + vacuous verification symmetrically (EQUIVALENT mode); not a clean-plan baseline (see RESULTS.md 2026-05-02 spot-check 1 retry) |
| `input3b` | `skills/review-plan/inputs/input3b-trivial-pass.md` | PASS calibration — neither version should flag anything substantive (true clean-plan baseline; one-line CLAUDE.md doc edit cited verbatim with runnable verification) |
| `input4` | `skills/review-plan/inputs/input4-plan-with-issues.md` | Structural problems (diverse) |
| `input6` | `skills/review-plan/inputs/input6-node-refactor-missing-prereads.md` | Phantom code references (Node.js) |
| `input8` | `skills/review-plan/inputs/input8-gas-oauth-tbd-markers.md` | Unresolved TBD markers |
| `input11` | `skills/review-plan/inputs/input11-node-parallel-phases.md` | Complex parallel phases |

For probes that ship with a top-of-file `<!-- expected-finding: ... -->` HTML comment (probes 17–21), read the comment text and use it verbatim as the EXPECTED_FINDING for the judge. The comment is the ground-truth target finding.

Default fixture set (no args): all 17 above.

Recommended verification order:
1. Start with `--single input3b` (true PASS calibration — confirms harness wiring + over-flagging dimension before full run)
2. Then `--single probe-17` (hidden-issue detection sanity) and `--single probe-1` (k=3 stability sanity)
3. Then full suite

---

## Step 1: Setup

```bash
RESULTS_DIR=$(mktemp -d /tmp/ablate-review-plan.XXXXXX)
echo "Results dir: $RESULTS_DIR"
```

**k=3 repetition:** for each fixture, run control × 3 + ablated × 3 (six agents per fixture, all parallel-eligible). The judge compares pair-by-index — `(control-1, ablated-1)`, `(control-2, ablated-2)`, `(control-3, ablated-3)` — producing 3 judge JSONs per fixture. Stability across the 3 runs is reported alongside the majority winner in Step 3.

For each fixture in the active set, create temp file paths for k=3 runs:
- `$RESULTS_DIR/<fixture>-control-{1,2,3}.md` — control review outputs (3 runs)
- `$RESULTS_DIR/<fixture>-ablated-{1,2,3}.md` — ablated review outputs (3 runs)
- `$RESULTS_DIR/<fixture>-judge-{1,2,3}.json` — judge verdicts (one per paired run)

**Variant under test:** the ablated variant in v2 is `skills/review-plan/variants/SKILL-v-ablation-na.md` (per-directive N/A semantics). Earlier variants (`SKILL-v-ablation.md`, `SKILL-v-ablation-calibrated.md`) are kept for reference but are not the default ablation target.

---

## Step 2: Run Each Fixture (k=3)

For each fixture, run Steps 2a and 2b for each repetition `i ∈ {1,2,3}`. The 6 runs per
fixture (3 control, 3 ablated) are mutually independent — spawn them as parallel Agents.
Once outputs are written, run Step 2c (judge) per index pair (also parallelizable across
indices once both that pair's outputs exist).

### Step 2a: Control runs (i=1,2,3)

For each `i ∈ {1,2,3}`, spawn an Agent with the full text of `skills/review-plan/SKILL.md`
as the system prompt and the fixture file content as the input. Write the agent's complete
review output to `$RESULTS_DIR/<fixture>-control-<i>.md`.

Agent prompt template:
```
You are running the review-plan skill in control mode.

<SKILL>
[full contents of skills/review-plan/SKILL.md]
</SKILL>

Review this plan:

<PLAN>
[full contents of fixture file]
</PLAN>

Output your complete review. Do not truncate.
```

### Step 2b: Ablated runs (i=1,2,3)

For each `i ∈ {1,2,3}`, spawn an Agent with `skills/review-plan/variants/SKILL-v-ablation-na.md`
as the system prompt and the same fixture content. Write output to
`$RESULTS_DIR/<fixture>-ablated-<i>.md`.

Agent prompt template:
```
You are running the review-plan skill in ablated directive mode (per-directive N/A variant).

<SKILL>
[full contents of skills/review-plan/variants/SKILL-v-ablation-na.md]
</SKILL>

Review this plan:

<PLAN>
[full contents of fixture file]
</PLAN>

Output your complete review. Do not truncate.
```

### Step 2c: Judge (k=3, paired by index)

For each `i ∈ {1,2,3}`, read `<fixture>-control-<i>.md` and `<fixture>-ablated-<i>.md`.
Spawn `review-plan-ablation-judge` agent with:

```
<CONTROL_REVIEW>
[contents of $RESULTS_DIR/<fixture>-control-<i>.md]
</CONTROL_REVIEW>

<ABLATED_REVIEW>
[contents of $RESULTS_DIR/<fixture>-ablated-<i>.md]
</ABLATED_REVIEW>

<EXPECTED_FINDING>
[expected finding string from fixture map. For probes 17–21, read the top-of-file
`<!-- expected-finding: ... -->` HTML comment from the probe file and use the comment
text verbatim. Otherwise pass empty string.]
</EXPECTED_FINDING>
```

Parse the single-line JSON response. Write it to `$RESULTS_DIR/<fixture>-judge-<i>.json`.

The 3 judge calls per fixture are mutually independent — run them in parallel as soon as
both outputs for the corresponding index exist.

**Parallelism:** all 6 control/ablated agent runs for a given fixture, and all 3 judges,
are independent and parallel-eligible. Across fixtures, the runs are also independent. The
upper bound on parallelism is your Agent capacity, not data dependencies. Within capacity,
prefer to dispatch all runs in a single message of parallel `Agent` tool uses, then dispatch
all judges in a second parallel batch once outputs land.

---

## Step 3: Aggregate Results (k=3 majority + stability)

After all fixtures complete, read all judge JSON files and compute per-fixture aggregates
across the 3 paired runs.

### Per-fixture aggregation

For each fixture, collapse the 3 judge JSONs into:
- **Majority winner**: the most common value of `winner` across the 3 judges. Examples:
  `[CONTROL, TIE, CONTROL] → CONTROL`; `[TIE, TIE, ABLATED] → TIE`; `[CONTROL, TIE, ABLATED] → no
  majority — record as `SPLIT` and treat as TIE for decision-gate aggregation`.
- **Verdict stability**: `VERDICTS_STABLE` if (a) all 3 control runs reach the same final
  verdict (PASS / NEEDS_UPDATE / NOT READY) AND (b) all 3 ablated runs reach the same final
  verdict. This is the substantive signal — it answers "does the variant produce reliable
  verdicts." `VERDICTS_UNSTABLE` otherwise.
- **Winner stability**: `WINNER_STABLE` if all 3 judges agree on `winner`; `WINNER_UNSTABLE`
  otherwise. This is a secondary tiebreak; can be UNSTABLE even when both sides issue
  identical verdicts (judges disagree on whose extra-flagging counts as the better
  calibration — see input3b 2026-05-02 for the canonical case).
- **Per-criterion mode**: for each of the 5 criteria (`issue_overlap`, `false_negatives`,
  `false_positives`, `severity_alignment`, `verdict_agreement`), the mode value across the 3
  judges. If all three differ on a criterion, record `SPLIT`.

### Per-fixture winner + stability table

| Fixture | Majority Winner | Verdict Stability | Winner Stability | issue_overlap | false_negatives | false_positives | severity_alignment | verdict_agreement |
|---------|-----------------|-------------------|------------------|---------------|-----------------|-----------------|-------------------|-------------------|
| probe-1 | ? | VERDICTS_STABLE/UNSTABLE | WINNER_STABLE/UNSTABLE | ? | ? | ? | ? | ? |
| ... | | | | | | | | |

### Per-criterion win rates

For each criterion, count across all fixtures using the per-criterion **mode**:
- Control wins: N
- Ablated wins: N
- Equivalent: N

### Stability summary

- Total fixtures: N
- VERDICTS_STABLE: N (%)   ← substantive signal: verdict reproducibility
- VERDICTS_UNSTABLE: N (%)
- WINNER_STABLE: N (%)     ← secondary tiebreak signal
- WINNER_UNSTABLE: N (%)

A high VERDICTS_UNSTABLE rate (>20%) is a signal that the ablated prompt is not robust
enough to deploy regardless of mean performance. WINNER_UNSTABLE alone is acceptable iff
verdict-stability is VERDICTS_STABLE *and* mode `false_positives` ∈ {EQUIVALENT, CONTROL};
surface it in the false-positive summary as a signal, not a fail.

### False negative summary

List each fixture where the **mode** of `false_negatives` is `CONTROL`, with the expected
finding and a one-line note on what the ablated review missed. For probes 17–21, the expected
finding comes from the probe's top-of-file `<!-- expected-finding: ... -->` comment.

### Overall verdict (decision gate v2 — requires stability)

Apply the pre-registered decision gate. The recommendation that the ablated variant should
replace the structured skill in production requires **all three** conditions:

```
total_fixtures        = len(active_fixtures)
tie_or_ablated_count  = count(majority_winner ∈ {TIE, ABLATED})
stable_count          = count(verdict_stability == VERDICTS_STABLE)   # measures verdict reproducibility — what the 80% gate was always trying to measure
fn_count              = count(mode(false_negatives) == "CONTROL")

# Gate 1 probes — original L1 probes plus the 5 hidden-issue probes from v2
gate1_probes = {probe-1, probe-2, probe-3, probe-7, probe-9, probe-16,
                probe-17, probe-18, probe-19, probe-20, probe-21}
gate1_fn_count = count(mode(false_negatives) == "CONTROL" AND fixture IN gate1_probes)

if (tie_or_ablated_count / total_fixtures >= 0.80
    AND stable_count / total_fixtures >= 0.80
    AND gate1_fn_count == 0):
    verdict = "RECOMMEND_REPLACEMENT — ablated v2 matches/beats control with stable verdicts and zero Gate 1 false negatives"
elif gate1_fn_count >= 2:
    verdict = "CONTROL_BETTER — Gate 1 hidden-issue probes regress under ablated v2 (≥2 false negatives)"
elif stable_count / total_fixtures < 0.80:
    verdict = "UNSTABLE — variant prompt is stochastically unreliable; not deployable regardless of mean performance"
elif fn_count >= 2 AND gate1_fn_count == 0:
    verdict = "MIXED — Gate 1 questions load-bearing; advisory directives candidates for trimming"
elif fn_count == 1:
    verdict = "MIXED — single false negative; review manually before deciding"
else:
    verdict = "INCONCLUSIVE — no Gate 1 false negatives but TIE/ABLATED rate below 80% threshold"
```

---

## Step 4: Output

Print the aggregate table, per-criterion win rates, false negative summary, and overall verdict.

Then print:
```
Results saved to: $RESULTS_DIR
```

Cleanup is NOT automatic — leave the results dir so the user can inspect raw outputs.

---

## Manual Verification Checklist

After running the full suite, verify:

1. `input3b` (PASS calibration — true clean-plan anchor): the Spot-Check 1 Pass Criterion (top-of-file) applies — majority winner TIE, mode `verdict_agreement` EQUIVALENT, VERDICTS_STABLE (WINNER_UNSTABLE tolerated under the conditions in the criterion), mode `false_positives` ∈ {EQUIVALENT, CONTROL}, and ≥ 2 of 3 control AND ≥ 2 of 3 ablated runs reach PASS. Mode `false_positives == ABLATED` here means the ablated variant is over-flagging clean plans (likely tighten Q-G6/Q-G7 N/A clauses for one-line doc edits); mode `false_positives == CONTROL` means the structured control over-flags trivial plans (filed as a control defect — see RESULTS.md 2026-05-02 input3b finding for the Q-E2 case).

   `input3` and `probe-9` (mixed-defect / ambiguous-plan calibration — symmetry-of-flagging tests, NOT PASS baselines): both control and ablated should land at NEEDS_UPDATE-or-worse with overlapping issue clusters; the per-fixture mode of `verdict_agreement` should be `EQUIVALENT` and majority winner TIE. These fixtures test that both variants flag substantive defects (input3: malformed Git Lifecycle header + placeholder script ID + vacuous verification; probe-9: fabricated benchmark citation + dual-write ambiguity + undefined `Memory` type) symmetrically, not that either side issues PASS (see RESULTS.md 2026-05-02 entries for diagnoses).

2. `probe-1` (unvalidated constraint): the ablated review should flag the unsubstantiated PropertiesService claim in at least 2 of 3 runs. Mode `false_negatives == "CONTROL"` here means the per-directive N/A variant is missing the evidence-checking directive.

3. Hidden-issue probes (17–21): each must surface its targeted finding in at least 2 of 3 ablated runs. Inspect any probe where the mode is `false_negatives == "CONTROL"` — that's a coverage gap in the directive set the v2 variant is meant to close.

4. Read at least 2 fixtures where the mode of `false_negatives` is `CONTROL` side by side against the expected finding to confirm the judge is discriminating correctly.

5. Read at least 1 VERDICTS_UNSTABLE or WINNER_UNSTABLE fixture's three judge JSONs — confirm the disagreement reflects model stochasticity (not a deterministic harness bug like wrong fixture text being passed). For WINNER_UNSTABLE-only cases (verdicts identical on each side, judges differ on classifying stylistic differences), this is informational not blocking — see Spot-Check 1 Pass Criterion.
