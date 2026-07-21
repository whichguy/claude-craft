# improve-loop scenario harness

**Testee-level** scenarios: isolated mini-repos with known bugs → run improve → oracle.

| Layer | Proves |
|-------|--------|
| `../cycle-sim/` | Decision law (Phase-2 / R9 / complete / stop) on JSON fixtures |
| **This harness** | Real suite red→green + residual×2 + operator-card diagnostics on a **testee clone** |

Does **not** auto-invoke the LLM. The agent/operator runs improve in the prepared workspace; the oracle is deterministic.

## Quick start

```bash
SC=plugins/claudecraft/skills/improve-loop/tests/scenarios

# Hermetic smokes (no improve)
bash $SC/run-scenario.sh --scenario greeter-bug --smoke-seed    # must FAIL suite
bash $SC/run-scenario.sh --scenario greeter-bug --smoke-fixed   # golden fix must PASS

# Full path
bash $SC/run-scenario.sh --scenario greeter-bug --prepare
# → workspace=/tmp/improve-scenario-greeter-bug.XXXX
# run improve-loop continuous in that workspace (see --agent-runbook)
bash $SC/run-scenario.sh --scenario greeter-bug --validate --workspace <path>
```

## Layout

```text
scenarios/
  run-scenario.sh
  validate-outcome.js
  fixtures/<id>/
    scenario.json
    seed/                 # initial broken testee
    expected/acceptance.md
```

## Adding a scenario

1. Copy `fixtures/greeter-bug` → `fixtures/<id>`.
2. Edit seed so `test_command` **fails** on seed and can be fixed with a small change.
3. Fill `scenario.json` oracle fields.
4. Run smoke-seed / smoke-fixed before any agent campaign.
