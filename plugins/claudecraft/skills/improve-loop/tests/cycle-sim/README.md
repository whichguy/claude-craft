# improve-loop cycle-sim

A deterministic simulator for the **pure decision-law** portion of improve-loop.
It is intentionally isolated under `tests/cycle-sim/`.

## Verification layers

| Layer | Path | Proves | Does not prove |
|---|---|---|---|
| soft case-bank | `tests/cases` | Spec soft-check codes | Campaigns |
| cycle-sim | `tests/cycle-sim` | Phase-2/R9/complete/stop pure law | Real testee suites / LLM |
| scenarios | `tests/scenarios` | Testee red→green + residual sequencing + oracle | A substitute for product campaigns |
| operator card | `docs/improve-loop-testee-operator-card.md` | Campaign habit | Package law |

Cycle-sim has no LLM, worktree, network, or live-ledger writes. It evaluates
pre-seeded JSON input only.

```text
pre-seeded cycle snapshot
        ↓
phase2-counters.js
        ↓
complete-gate.js
        ↓
improve-stop-decision.js
        ↓
assert expect.* fields
```

The `expected_changes` fixture field is documentary. Assertions are the explicit
`expect.*` fields.

For deterministic mini-repositories with red/green suites, use
[scenario harness](../scenarios/README.md). For an actual product campaign, use the
[testee operator card](../../../../../../docs/improve-loop-testee-operator-card.md).
A green cycle-sim run does not establish testee quality or autonomous-campaign quality.

## What it covers

`run.js` wires these existing pure components together:

- `phase2-counters.js`: Phase-2 rows, material reset/hold behavior, and R9
  honest-empty handling;
- `scripts/complete-gate.js`: residual×2 completion gate;
- `tools/improve-stop-decision.js`: `continue`, `confirm`, `complete`, or `stop`.

It does not run a product test suite, edit code, write a real
`IMPROVE_LOOP.md`, classify a surprise, or judge LLM reasoning.

## Commands

From the repository root:

```bash
CS=plugins/claudecraft/skills/improve-loop/tests/cycle-sim

node "$CS/run.js"
node "$CS/run.js" --list
node "$CS/run.js" --case two-honest-empty-to-complete
node "$CS/run.js" --json
node "$CS/phase2-counters.js" self-test
```

`run.js` also accepts `--cases-dir <path>`. Its exit codes are `0` for all passing,
`1` for usage, and `2` when one or more cases fail. The Phase-2 module’s accepted
standalone command is exactly `node phase2-counters.js self-test`.

`tests/scripts.test.sh` already invokes both:

```bash
node "$CS/run.js" --skip-self-test
node "$CS/phase2-counters.js" self-test
```

## Fixture shape

A single-step fixture supplies the pre-seeded law inputs and expected decision
outputs:

```json
{
  "id": "blank-residual-no-attest",
  "input": {
    "status": "PASS",
    "outcome": "partial",
    "changedPaths": [],
    "notes": "",
    "openP0P1": 0,
    "counters": {
      "consecutive_no_progress": 0,
      "consecutive_same_error": 0,
      "consecutive_non_material_cycles": 0,
      "error_signature": "none"
    }
  },
  "expect": {
    "row": "empty_changed_paths",
    "counters": { "consecutive_non_material_cycles": 0 },
    "notesAppendIncludes": "honest-empty missing",
    "complete": false,
    "gate_reason": "residual_streak_lt_2",
    "stop_decision": "continue",
    "stop_reason": "none"
  }
}
```

A fixture with `"chain": true` may use multiple `steps`; later steps inherit prior
counters unless they set `inherit_counters: false`.

## Shipped cases

| Case group | Cases |
|---|---|
| Honest-empty and residual progression | `blank-residual-no-attest`, `empty-paths-with-honest-empty`, `two-honest-empty-to-complete`, `double-empty-without-attest-never-completes`, `synthetic-streak-without-attest-refused` |
| Material/deferred behavior | `material-land-resets-streak`, `p2-yagni-without-attest-hold`, `p2-yagni-with-honest-empty` |
| Failure and blocked behavior | `fail-same-signature-stall`, `fail-new-signature`, `blocked-holds-streak` |
| Empty-backlog lightweight behavior | `lightweight-r9-default-until`, `lightweight-no-attest-hold` |
| Completion exclusions | `open-backlog-blocks-complete`, `all-v-pass-alone-not-complete` |

The runner currently executes 15 shipped fixture cases.

## Important gate distinction

`improve-stop-decision` uses counter state and does not read Notes.
`complete-gate` can separately refuse completion when
`honestEmptyAttested` is false.

`synthetic-streak-without-attest-refused` demonstrates the distinction:

- Phase 2 holds the streak because there is no new R9 attestation;
- stop-decision may still report `complete` from an already-high streak;
- complete-gate returns `complete: false` with `honest_empty_missing`.

A real orchestrator must consult the completion gate, or re-attest, before it writes
a terminal complete status. This simulator verifies that law relationship; it does
not verify the orchestrator’s live write path.
