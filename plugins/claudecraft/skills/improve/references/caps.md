# Caps and stop reasons

| Cap | Stops | Default |
|---|---|---|
| `max_cycles` | S8 | 10 continuous / 1 once |
| `max_elapsed` | S8 (wall clock of inner loop, not reintegrate) | unset |
| token / usd budget | S8 | unset (host may still cap) |
| improve-loop Status | S8 | complete / stopped (…) |
| `until` | S8 when satisfied | continuous default: **no material P0/P1 for 2 consecutive cycles (green tests)** |
| `consecutive-non-material-cycles` | feeds until | on disk under Stop-condition tracking |

After S8 stops for **any** reason including budget/time: **S11 reintegrate** if worktree exists, then S12 per keep flag.

Host max-turns / max-budget must be **looser** than these caps so S11 can run. Prefer driver-owned caps over relying only on host kill.

## S8 break order (evaluate after each improve-loop cycle)

Read **disk** (`IMPROVE_LOOP.md` Status + Stop-condition + Driver), not chat.

1. Hard block: Driver `next_auto` is `blocked:*` that needs human (rebase-continue, etc.) → break to S9 (blocked).  
2. `max_cycles` / `max_elapsed` / budget exceeded → break (`stopped (max_cycles)` / … on ledger if not already).  
3. Status already `stopped (same-error ×3)` or `stopped (no-progress ×3)` → break.  
4. **Until satisfied:** Driver/header `until` is the default P0/P1×2 language (or any until that means the same) **and** `consecutive-non-material-cycles >= 2` **and** last suite green → treat as success stop; ensure Status `complete` if still active, then break.  
5. Status `complete` (backlog empty + green, or until) → break.  
6. Else continue S8 (another improve-loop cycle).

## Non-material streak (disk)

Owned by improve-loop Phase 2; improve S8 only **reads** it.

- **Material cycle:** non-ledger P0/P1 fix landed → streak reset to 0.  
- **Non-material cycle:** suite PASS; no material P0/P1 land → streak +1.  
- See improve-loop `phase-2-learn.md` and `ledger-schema.md`.

Persist `until` and `max_cycles` on the ledger at campaign start so rehydrate does not re-prompt.
