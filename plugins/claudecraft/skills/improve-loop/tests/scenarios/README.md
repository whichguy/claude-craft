# improve-loop scenario harness

**Testee-level** scenarios: isolated mini-repos with known defects → improve sequencing → oracle.

| Layer | Proves |
|-------|--------|
| `../cycle-sim/` | Decision law (Phase-2 / R9 / complete / stop) on JSON fixtures |
| **This harness** | Real suite behavior + residual×2 + operator-card diagnostics on a **testee clone** |

No LLM required for CI: use **smokes** + **scripted campaigns** + **oracle self-test**.

## Scenarios (incremental)

| ID | Sequencing under test | Seed suite | Extra seed signal |
|----|----------------------|------------|-------------------|
| `greeter-bug` | Red→green single defect + residual×2 | **fail** | — |
| `boundary-age` | **False-green / test debt**: suite green, acceptance probe fails | **pass** | probe **fail** at age 18 |
| `dual-defect` | Partial material land (suite still red) then second material **resets** residual streak | **fail** (2 tests) | — |

Negative oracle fixtures (`fixtures/_negative/`):

| ID | Must reject |
|----|-------------|
| `open-backlog` | Status complete with open P0 |
| `no-honest-empty` | Status complete with streak 2 but no honest-empty attests |

## Commands

```bash
SC=plugins/claudecraft/skills/improve-loop/tests/scenarios

bash $SC/run-scenario.sh --list
bash $SC/run-scenario.sh --smoke-all          # all fixtures: seed + golden
node $SC/validate-outcome.js --self-test      # negative oracles
bash $SC/run-scripted-campaign.sh --all       # full scripted improve paths + oracle

# One scenario
bash $SC/run-scenario.sh --scenario boundary-age --smoke-seed
bash $SC/run-scripted-campaign.sh --scenario dual-defect

# Agent path (real skill run)
bash $SC/run-scenario.sh --scenario greeter-bug --prepare
# … improve continuous in workspace …
bash $SC/run-scenario.sh --scenario greeter-bug --validate --workspace <path>
```

## Layout

```text
scenarios/
  run-scenario.sh
  run-scripted-campaign.sh
  validate-outcome.js
  fixtures/<id>/
    scenario.json
    seed/
    golden/          # files overlaid for smoke-fixed + scripted material land
  fixtures/_negative/
    open-backlog/
    no-honest-empty/
```

## Adding a scenario

1. Copy a fixture dir; edit `seed/` so suite/probe match `seed_suite_exit` / `seed_probe_exit`.
2. Add `golden/` overlays for the known-good end state.
3. Fill `scenario.json` oracle (status, streak, honest-empty count, src patterns, optional probe/test-debt).
4. Extend `run-scripted-campaign.sh` if sequencing is multi-step (see `dual-defect`).
5. `bash run-scenario.sh --smoke-all && bash run-scripted-campaign.sh --scenario <id>`.

## Why more scenarios

| Complexity | Covered by |
|------------|------------|
| Simple fix + residual×2 | greeter-bug |
| Suite green ≠ acceptance (CLASS test-gap / debt) | boundary-age |
| Material mid-campaign resets non-material streak | dual-defect |
| Complete with open P0 must fail oracle | _negative/open-backlog |
| Complete without R9 honest-empty must fail | _negative/no-honest-empty |
