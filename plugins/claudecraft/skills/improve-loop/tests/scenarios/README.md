# improve-loop scenario harness

Isolated **testee-fixture** checks: seed mini-repos with known defects, run a
suite/probe, apply deterministic golden/scripted changes, then inspect the resulting
workspace with an oracle.

## Verification layers

| Layer | Path | Proves | Does not prove |
|---|---|---|---|
| soft case-bank | `tests/cases` | Spec soft-check codes | Campaigns |
| cycle-sim | `tests/cycle-sim` | Phase-2/R9/complete/stop pure law | Real testee suites / LLM |
| scenarios | `tests/scenarios` | Testee red→green + residual sequencing + oracle | A substitute for product campaigns |
| operator card | `docs/improve-loop-testee-operator-card.md` | Campaign habit | Package law |

```text
fixture seed
  ├─ smoke-seed: expected suite/probe signal
  ├─ smoke-fixed: golden overlay makes suite/probe green
  └─ scripted campaign: known deterministic sequence + workspace oracle

real agent path (separate, non-hermetic)
  prepare workspace → run improve skill → validate resulting workspace
```

`--smoke-all` runs only fixture seed and golden checks. `--all` on the scripted
runner applies known fixture edits and writes deterministic fixture commits before
calling the oracle. Neither command invokes an LLM or proves that an autonomous
multi-cycle `/improve` campaign will make good decisions.

For real-campaign diagnostic habits—Expected effects, acceptance and preservation
probes, CLASS, durable carriers, and honest-empty discipline—use the
[operator card](../../../../../../docs/improve-loop-testee-operator-card.md).

## Scenarios

| ID | Verified seed signal | Deterministic path/oracle focus |
|---|---|---|
| `greeter-bug` | suite exits `1` | Fix `greet`, then two honest-empty residual cycles before complete |
| `boundary-age` | suite exits `0`; `node scripts/acceptance-probe.js` exits `1` | False-green/test-debt case: fix `isAdult(18)`, add boundary coverage, then residual×2 |
| `dual-defect` | suite exits `1` | First material fix leaves suite red; second material fix resets the non-material streak; only later residual×2 completes |

Negative fixtures live under `fixtures/_negative/` and are executed by
`validate-outcome.js --self-test`.

| Fixture | Deliberately invalid state the self-test must reject |
|---|---|
| `open-backlog` | `Status: complete` with an unchecked P0 item |
| `no-honest-empty` | `Status: complete`, streak `2`, but no required honest-empty attestations |

## Commands

Run from the repository root:

```bash
SC=plugins/claudecraft/skills/improve-loop/tests/scenarios

bash "$SC/run-scenario.sh" --list
bash "$SC/run-scenario.sh" --smoke-all
node "$SC/validate-outcome.js" --self-test
bash "$SC/run-scripted-campaign.sh" --all
```

One fixture:

```bash
bash "$SC/run-scenario.sh" --scenario boundary-age --smoke-seed
bash "$SC/run-scenario.sh" --scenario boundary-age --smoke-fixed
bash "$SC/run-scripted-campaign.sh" --scenario dual-defect
```

Prepare a testee workspace for a real skill run, then validate its final state:

```bash
bash "$SC/run-scenario.sh" --scenario greeter-bug --prepare
# Run the improve skill in the printed workspace.
bash "$SC/run-scenario.sh" --scenario greeter-bug --validate --workspace <path>
```

Additional accepted run-scenario mode:

```bash
bash "$SC/run-scenario.sh" --scenario greeter-bug --agent-runbook
```

`run-scenario.sh` exits `0` on success, `1` for usage/fixture errors, and `2` for
smoke or oracle failures. `validate-outcome.js` exits `0` on oracle pass, `1` for
usage, and `2` for oracle failure. `run-scripted-campaign.sh` exits `0` on oracle
pass and `2` for a scripted/oracle failure.

## What the oracle checks

The fixture `scenario.json` supplies the test command and oracle requirements.
Depending on the scenario, `validate-outcome.js` checks:

- final suite exit, and required acceptance probe;
- final ledger status, open P0/P1 count, and non-material streak;
- honest-empty attestations in the ledger plus Git commit bodies;
- fixed source patterns;
- greppable `CLASS:` evidence;
- boundary-age test-debt evidence;
- no unconsumed `UNINTENDED:`, `FALSE_GREEN:`, or `TEST_GAP:` tag at complete.

This is a post-state oracle. It does not inspect the reasoning that produced the
workspace, so a passing oracle is not evidence of an LLM’s planning quality.

## Layout

```text
scenarios/
  run-scenario.sh
  run-scripted-campaign.sh
  validate-outcome.js
  fixtures/<id>/
    scenario.json
    seed/
    golden/
  fixtures/_negative/
    open-backlog/
    no-honest-empty/
```

`golden/` is overlaid by `--smoke-fixed`; the scripted runner also uses it for
known-good material lands.

## Adding a scenario

1. Add `fixtures/<id>/seed/` and `scenario.json`.
2. Set `seed_suite_exit`; if a probe distinguishes a false-green, set
   `seed_probe` and `seed_probe_exit`.
3. Add `golden/` with the known-good overlay required by `--smoke-fixed`.
4. Define the oracle conservatively: final status, suite/probe result, residual
   requirements, and only evidence the validator actually parses.
5. Extend `run-scripted-campaign.sh` when the sequencing itself matters.
6. Run the four checks in the Commands section.

Keep fixture claims narrow: a scenario is a reproducible testee-and-oracle example,
not a replacement for a campaign on the product repository.
