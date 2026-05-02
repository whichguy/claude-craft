---
name: ablate-review-plan
description: |
  Ablation test harness for the review-plan skill. Runs the structured question-based
  control (SKILL.md) and the directive-based ablated variant (SKILL-v-ablation.md)
  against the same fixture set, then uses the review-plan-ablation-judge to compare
  outputs for logical equivalence.

  Answers: do the structured question IDs add meaningful signal, or does a directive
  prompt achieve equivalent issue detection?

  AUTOMATICALLY INVOKE when user mentions:
  - "ablation test", "ablate review-plan", "test directive variant"
  - "does the question structure matter", "directive vs questions"

argument-hint: "[--fixtures <probe-N,...|input-N,...>] [--single <fixture>]"
allowed-tools: Agent, Bash, Read, Glob, Write, Edit
---

# ablate-review-plan Skill

Measures whether the structured question-based control (`skills/review-plan/SKILL.md`)
produces materially better issue detection than the directive-based ablated variant
(`skills/review-plan/variants/SKILL-v-ablation.md`).

**Architecture:** For each fixture, run control → capture output, run ablated → capture
output, spawn judge to compare. Aggregate into a per-fixture winner table and per-criterion
win rates. The judge evaluates for logical equivalence (same issues found, same verdict) —
not output quality.

**Decision gate (pre-registered):**

| Result | Interpretation |
|--------|---------------|
| ≥80% TIE + 0 false negatives on probes | Questions add no signal — directive approach is sufficient |
| ≥2 false negatives on Gate 1 probes | Questions are load-bearing — keep structured evaluation |
| Mixed (false negatives on advisory but not Gate 1) | Partial — Gate 1 questions load-bearing; advisory Qs are candidates for removal |

---

## Step 0: Parse Arguments

Read the invocation arguments. Supported forms:

```
/ablate-review-plan                          # full 11-fixture suite
/ablate-review-plan --single probe-9         # single fixture by short name
/ablate-review-plan --fixtures probe-1,probe-9,input3  # comma-separated subset
```

**Fixture short-name → path map:**

| Short name | Path | Expected finding (ground truth) |
|------------|------|----------------------------------|
| `probe-1` | `skills/review-plan/probes/probe-1-unvalidated-constraint.md` | Q-G1: asserts PropertiesService rejected without benchmarks |
| `probe-2` | `skills/review-plan/probes/probe-2-phantom-code-references.md` | Q-G11: no file paths or function names cited |
| `probe-3` | `skills/review-plan/probes/probe-3-cross-phase-contradiction.md` | Q-G21/G22: cross-phase contradiction + undefined field |
| `probe-7` | `skills/review-plan/probes/probe-7-untestable-verification.md` | Q-G20: verification section has no runnable commands |
| `probe-9` | `skills/review-plan/probes/probe-9-g1-pass-calibration.md` | PASS calibration — neither version should flag anything |
| `probe-16` | `skills/review-plan/probes/probe-16-gas-chatservice-wrapper.md` | Q-G21: internal contradiction in step scoping |
| `input3` | `skills/review-plan/inputs/input3-trivial-plan.md` | PASS calibration |
| `input4` | `skills/review-plan/inputs/input4-plan-with-issues.md` | Structural problems (diverse) |
| `input6` | `skills/review-plan/inputs/input6-node-refactor-missing-prereads.md` | Phantom code references (Node.js) |
| `input8` | `skills/review-plan/inputs/input8-gas-oauth-tbd-markers.md` | Unresolved TBD markers |
| `input11` | `skills/review-plan/inputs/input11-node-parallel-phases.md` | Complex parallel phases |

Default fixture set (no args): all 11 above.

Recommended verification order:
1. Start with `--single probe-9` (PASS calibration — confirms harness wiring before full run)
2. Then full suite

---

## Step 1: Setup

```bash
RESULTS_DIR=$(mktemp -d /tmp/ablate-review-plan.XXXXXX)
echo "Results dir: $RESULTS_DIR"
```

For each fixture in the active set, create two temp file paths:
- `$RESULTS_DIR/<fixture>-control.md` — control review output
- `$RESULTS_DIR/<fixture>-ablated.md` — ablated review output
- `$RESULTS_DIR/<fixture>-judge.json` — judge verdict

---

## Step 2: Run Each Fixture

For each fixture, run Steps 2a and 2b sequentially (control before ablated to avoid
context contamination), then Step 2c (judge).

### Step 2a: Control run

Spawn an Agent with the full text of `skills/review-plan/SKILL.md` as the system prompt
and the fixture file content as the input. Write the agent's complete review output to
`$RESULTS_DIR/<fixture>-control.md`.

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

### Step 2b: Ablated run

Spawn a second Agent with `skills/review-plan/variants/SKILL-v-ablation.md` as the
system prompt and the same fixture content. Write output to `$RESULTS_DIR/<fixture>-ablated.md`.

Agent prompt template:
```
You are running the review-plan skill in ablated directive mode.

<SKILL>
[full contents of skills/review-plan/variants/SKILL-v-ablation.md]
</SKILL>

Review this plan:

<PLAN>
[full contents of fixture file]
</PLAN>

Output your complete review. Do not truncate.
```

### Step 2c: Judge

Read both output files. Spawn `review-plan-ablation-judge` agent with:

```
<CONTROL_REVIEW>
[contents of $RESULTS_DIR/<fixture>-control.md]
</CONTROL_REVIEW>

<ABLATED_REVIEW>
[contents of $RESULTS_DIR/<fixture>-ablated.md]
</ABLATED_REVIEW>

<EXPECTED_FINDING>
[expected finding string from fixture map, or empty string if none]
</EXPECTED_FINDING>
```

Parse the single-line JSON response. Write it to `$RESULTS_DIR/<fixture>-judge.json`.

**Parallelism:** Steps 2a and 2b for a single fixture must run sequentially. However,
once you have both outputs for fixture N, you can run the judge for fixture N in parallel
with 2a+2b for fixture N+1 if you have capacity.

---

## Step 3: Aggregate Results

After all fixtures complete, read all judge JSON files and compute:

### Per-fixture winner table

| Fixture | Winner | issue_overlap | false_negatives | false_positives | severity_alignment | verdict_agreement |
|---------|--------|---------------|-----------------|-----------------|-------------------|-------------------|
| probe-1 | ? | ? | ? | ? | ? | ? |
| ... | | | | | | |

### Per-criterion win rates

For each of the 5 criteria, count across all fixtures:
- Control wins: N
- Ablated wins: N
- Equivalent: N

### False negative summary

List each fixture where `false_negatives == "CONTROL"`, with the expected finding and
a one-line note on what the ablated review missed.

### Overall verdict

Apply the pre-registered decision gate:

```
total_fixtures = len(active_fixtures)
tie_count = count(winner == "TIE")
fn_count = count(false_negatives == "CONTROL")

gate1_probes = {probe-1, probe-2, probe-3, probe-7, probe-9, probe-16}
gate1_fn_count = count(false_negatives == "CONTROL" AND fixture IN gate1_probes)

if tie_count / total_fixtures >= 0.80 AND fn_count == 0:
    verdict = "EQUIVALENT — directive approach is sufficient"
elif gate1_fn_count >= 2:
    verdict = "CONTROL_BETTER — questions are load-bearing (≥2 Gate 1 false negatives)"
elif fn_count >= 2 AND gate1_fn_count == 0:
    verdict = "MIXED — Gate 1 questions load-bearing; advisory Qs are candidates for removal"
elif fn_count == 1:
    verdict = "MIXED — single false negative; review manually before deciding"
else:
    verdict = "EQUIVALENT — no false negatives; TIE rate below 80% but no control advantage"
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

1. `probe-9` and `input3` (PASS calibrations): both control and ablated should output PASS — judge should score `verdict_agreement == "EQUIVALENT"`. If either scores CONTROL or ABLATED, the harness wiring is off.

2. `probe-1` (unvalidated constraint): the ablated review should flag the unsubstantiated PropertiesService claim. If `false_negatives == "CONTROL"` on this fixture, the directive version is missing the evidence-checking directive — inspect `SKILL-v-ablation.md` for coverage.

3. Read at least 2 fixtures where the judge scored `false_negatives == "CONTROL"` side by side against the expected finding to confirm the judge is discriminating correctly.
