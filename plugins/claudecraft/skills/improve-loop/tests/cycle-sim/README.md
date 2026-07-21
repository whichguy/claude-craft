# improve-loop cycle-sim (API-free e2e of pure law)

Isolated under `tests/cycle-sim/` so it does **not** alter campaign scripts,
law docs, or package required-file lists until you graduate pieces deliberately.

## What this is

A **repeatable, hermetic** simulator of one improve-loop cycle (or a short
multi-cycle chain):

```text
pre-seeded cycle snapshot
        ↓
  phase2-counters.js     (Phase-2 matrix + R9 honest-empty)
        ↓
  complete-gate.js       (R7 residual×2 + optional R9 flag)
        ↓
  improve-stop-decision  (continue | confirm | complete | stop)
        ↓
  assert expect.* + report expected_changes (documentary)
```

No LLM. No worktree. No network. Deterministic JSON fixtures.

## What this is not

| Not covered | Why |
|---|---|
| Agent Phase-1 code edits | LLM-owned |
| Full `/improve` multi-hour campaign | Needs prompt harness + tokens |
| Live `IMPROVE_LOOP.md` writes | Orchestrator-owned; this checks *decision law* |
| Weakness-bar *classification* quality | Needs LLM; we only check counter effects of P2/YAGNI Notes |

## Run

From the improve-loop skill root (or any cwd):

```bash
# all cases
node plugins/claudecraft/skills/improve-loop/tests/cycle-sim/run.js

# one case
node plugins/claudecraft/skills/improve-loop/tests/cycle-sim/run.js --case two-honest-empty-to-complete

# list
node plugins/claudecraft/skills/improve-loop/tests/cycle-sim/run.js --list

# machine-readable
node plugins/claudecraft/skills/improve-loop/tests/cycle-sim/run.js --json

# phase-2 module only
node plugins/claudecraft/skills/improve-loop/tests/cycle-sim/phase2-counters.js self-test
```

Exit: `0` all pass · `2` one or more case failures · `1` usage.

## Fixture shape

Single-step:

```json
{
  "id": "blank-residual-no-attest",
  "description": "…",
  "tags": ["r9", "blank"],
  "expected_changes": ["human-readable major effects"],
  "input": {
    "status": "PASS",
    "outcome": "partial",
    "changedPaths": [],
    "notes": "…",
    "openP0P1": 0,
    "pathKind": "normal",
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

Multi-step (`"chain": true` inherits counters unless `inherit_counters: false`):

```json
{
  "id": "two-honest-empty-to-complete",
  "chain": true,
  "steps": [
    { "input": { … }, "expect": { … } },
    { "inherit_counters": true, "input": { … }, "expect": { "complete": true } }
  ]
}
```

### Pre-seeded state catalog (shipped cases)

| Case | Starting condition | Intent |
|---|---|---|
| `blank-residual-no-attest` | Blank residual, no R9 | Streak must not inflate |
| `empty-paths-with-honest-empty` | First clean residual | Streak 0→1 |
| `two-honest-empty-to-complete` | Multi-cycle clean residual | Earn complete |
| `double-empty-without-attest-never-completes` | Two empty without R9 | No false complete |
| `material-land-resets-streak` | Partial: code landed after streak 1 | Material resets nm |
| `p2-yagni-without-attest-hold` | Deferred-only land, no R9 | Hold nm |
| `p2-yagni-with-honest-empty` | Deferred-only + R9 | Advance / may complete |
| `fail-same-signature-stall` | Red suite thrash | same-error stop |
| `fail-new-signature` | New failure mode | Reset same-error to 1 |
| `blocked-holds-streak` | Scope block | Hold nm + signature |
| `lightweight-r9-default-until` | Empty backlog lightweight + R9 | Stalls held, nm +1 |
| `lightweight-no-attest-hold` | Lightweight without R9 | Hold nm |
| `synthetic-streak-without-attest-refused` | Streak 2 but missing attest this cycle | Gate refuses |
| `open-backlog-blocks-complete` | Streak 2 but open P0/P1 | Continue |
| `all-v-pass-alone-not-complete` | Spec/V green, streak 1 | R7 sole path |

## Evaluate results → fix → re-run

1. Run `run.js` (or a single `--case`).
2. Read `FAIL:` lines: actual vs expected counters / complete / stop.
3. Decide whether **law encoding** (`phase2-counters.js`) or **fixture expect** is wrong.
4. If product law (SKILL / phase-2-learn) must change, edit law + update fixtures in the same pass.
5. Re-run until green. Prefer pathspec commits of only this tree until graduated.

`expected_changes` is **documentary** (what a human should see as major effects). Hard
asserts live under `expect.*`.

## Special note: stop-decision vs complete-gate

`improve-stop-decision` trusts `consecutive_non_material_cycles` and does **not**
read Notes. `complete-gate` can refuse when `honestEmptyAttested: false`.

Case `synthetic-streak-without-attest-refused` intentionally shows:

- Phase-2 holds streak (no +1 without attest)
- **stop** may still say `complete` (streak already ≥2)
- **gate** says `complete: false` / `honest_empty_missing`

Orchestrators should consult the gate (or re-attest) before writing Status complete.

## Graduating into ship set

When stable:

1. Move `phase2-counters.js` → `scripts/phase2-counters.js` (like `complete-gate.js`).
2. Point runner at the new path; rsync B↔M; optional contract-check pin.
3. Add one line to `tests/scripts.test.sh` invoking this runner.

Until then, keep everything under `tests/cycle-sim/`.
