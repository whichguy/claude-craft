# improve-loop soft case-bank

Deterministic `ledger.md → soft-check codes` examples for Spec-quality checks.

## Verification layers

| Layer | Path | Proves | Does not prove |
|---|---|---|---|
| soft case-bank | `tests/cases` | Spec soft-check codes | Campaigns |
| cycle-sim | `tests/cycle-sim` | Phase-2/R9/complete/stop pure law | Real testee suites / LLM |
| scenarios | `tests/scenarios` | Testee red→green + residual sequencing + oracle | A substitute for product campaigns |
| operator card | `docs/improve-loop-testee-operator-card.md` | Campaign habit | Package law |

```text
written ledger/spec
      ↓
run-case-bank.js
      ↓
softCheckSpecBundle()
      ↓
expected warning-code comparison
```

The case bank does not invoke an LLM or execute an `/improve` campaign. It also does
not replace the scenario harness: scenarios now exist under `tests/scenarios/`, but
they test a different boundary.

## What this bank checks

Each `*.ledger.md` fixture is passed to `softCheckSpecBundle`; its sibling
`*.expected.json` names the expected `ok` result and warning-code set.

| File | Intended result |
|---|---|
| `thin-habitat-spec.ledger.md` | Soft-check warnings for a thin Spec/Habitat claim |
| `good-t2-spec.ledger.md` | `ok: true` with no warning codes |

The runner also smoke-checks metadata parsing for the thin Habitat fixture.

## Commands

From the improve-loop skill root:

```bash
node scripts/run-case-bank.js
node scripts/run-case-bank.js --cases-dir path/to/cases
```

For one written plan, run the underlying soft-check command:

```bash
node scripts/spec-validate.js soft-check \
  --plan-file tests/cases/thin-habitat-spec.ledger.md
```

The case-bank runner exits `0` when all cases pass, `1` for usage, and `2` when one
or more cases fail.

## Related checks, with boundaries

| Check | What it adds | Still does not establish |
|---|---|---|
| `spec-sync-matrix.test.js` | PLAN_SPEC_SYNC row-operation goldens | LLM Spec derivation quality |
| `complete-gate.js self-test` | R7 residual×2 truth table | Live orchestrator Status writes |
| `spec-validate.js self-test` | 3v seed/dedupe and soft-check composition | Agent Phase-3v application |
| `tests/scripts.test.sh` soft-check block | CLI JSON/exit behavior and plan-byte identity | Autonomous campaign behavior |
| `tests/cycle-sim/run.js` | Phase-2/R9/complete/stop decisions on JSON | A real suite or agent edits |
| `tests/scenarios/run-scenario.sh` and scripted runner | Fixture testee suite/probe plus post-state oracle | Product-repository campaign quality |

A green package suite says the checked scripts and fixtures satisfy their asserted
contracts. It does not say an agent executed a good multi-cycle campaign.

For scenario commands, see [the scenario README](../scenarios/README.md). For real
campaign diagnostics—Expected effects, suite delta, CLASS, durable carriers, and
honest-empty discipline—use the
[testee operator card](../../../../../../docs/improve-loop-testee-operator-card.md).

## Adding a soft-check case

1. Add `name.ledger.md` in this directory.
2. Add `name.expected.json`, for example:

   ```json
   { "ok": false, "codes": ["SUITE_ONLY_PROOFS"] }
   ```

3. Run `node scripts/run-case-bank.js`.

Do not put ledger-status or cycle-counter goldens in this directory. Those belong in
the script suite or cycle-sim, respectively.
