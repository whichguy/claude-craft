# Caps and stop reasons

| Cap | Stops | Default |
|---|---|---|
| `max_cycles` | S8 | 8 continuous / 1 once |
| `max_elapsed` | S8 (wall clock of inner loop, not reintegrate) | unset |
| token / usd budget | S8 | unset (host may still cap) |
| improve-loop Status | S8 | complete / stopped (…) |
| `until` | S8 when satisfied | continuous default: **no material P0/P1 for 2 consecutive cycles (green tests)** |
| `consecutive-non-material-cycles` | feeds until | on disk under Stop-condition tracking |

After S8 stops for **any** reason including budget/time: **S11 reintegrate** if worktree exists, then S12 per keep flag.

Host max-turns / max-budget must be **looser** than these caps so S11 can run. Prefer driver-owned caps over relying only on host kill.

## S8 break order (evaluate after each improve-loop cycle)

Read **disk** (`IMPROVE_LOOP.md` Status + Stop-condition + Driver), not chat.

Prefer `node <plugin>/tools/improve-stop-decision.js` with a fact snapshot when Node is
available (see `contracts/goal.md`). Build `until_kind` with **`classifyUntilKind`** from
ledger until + mode (canonical default string shared with parse/Phase 0), then
**`deriveStopDecision`**. Map `decision`/`reason` onto Status + S9 text. Still apply step 1
**before** the helper: hard `blocked:*` is lifecycle, not stop-table.

1. Hard block: Driver `next_auto` is `blocked:*` that needs human (rebase-continue, etc.) → break to S9 (blocked).  
2. `max_cycles` / `max_elapsed` / budget exceeded → break (`stopped (max_cycles)` / … on ledger if not already).  
3. Status already `stopped (same-error ×3)` or `stopped (no-progress ×3)` → break.  
4. **Until** (header/Driver `until` non-empty and not `none`) — see canonical table in
   `law/improve-loop/contracts/goal.md` (precedence: terminal → stalls → caps → until):  
   - **Default P0/P1×2 form** (substring match per phase-3): success stop only when
     **zero unchecked P0/P1** **and** `consecutive-non-material-cycles >= 2` **and**
     **current-cycle** suite PASS. Do **not** complete on carried/last non-material PASS
     alone (Confirm: stay active; next cycle runs the suite). Under this default, **do not**
     treat “backlog empty of P0/P1 after one green cycle” as done — Phase 3 rule 4 is suppressed;
     only the streak≥2 + zero open + current-cycle green path completes.  
   - **Custom until** (any other non-empty string): after each cycle, the **outer host**
     (native improve S8 **or** host **goal** turn — same rule; see
     `law/improve-loop/contracts/goal.md`) **must evaluate the until text**
     against disk facts (Status, backlog, counters, test PASS, Landed paths). If clearly
     met **and** current-cycle suite PASS → set Status `complete` (or stop reason
     `until: <short>`) and break. Met without a current-cycle suite → Confirm (continue
     one verification cycle). Do not ignore custom until, re-ask for a stop condition
     already on disk, or auto-complete from empty backlog alone.  
   - On success stop: ensure Status `complete` if still active, then break.  
5. Status `complete` (until satisfied, or once-mode rule-4 empty-backlog complete with
   current-cycle PASS) → break.  
6. Else continue S8 (another improve-loop cycle).

**`max_cycles` vs `cycle_index`:** Driver `cycle_index` starts at 0; before each cycle if
`cycle_index >= max_cycles` stop; else increment then run (so max_cycles=8 runs 8 cycles).

## Non-material streak (disk)

Owned by improve-loop Phase 2; improve S8 only **reads** it.

- **Material cycle (default):** non-ledger paths landed → streak reset to 0.  
- **Non-material cycle:** suite PASS; empty non-ledger CHANGED_PATHS or explicit P2/YAGNI-only Notes → streak +1.  
- See improve-loop `phase-2-learn.md` and `ledger-schema.md`.

Persist `until` and `max_cycles` on the ledger at campaign start so rehydrate does not re-prompt.
