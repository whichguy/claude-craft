# Caps and stop reasons

| Cap | Stops | Default |
|---|---|---|
| `max_cycles` | S8 | 10 continuous / 1 once |
| `max_elapsed` | S8 (wall clock of inner loop, not reintegrate) | unset |
| token / usd budget | S8 | unset (host may still cap) |
| improve-loop Status | S8 | complete / no-progress×3 / same-error×3 / … |
| user `until` | success gate when complete | unset |

After S8 stops for **any** reason including budget/time: **S11 reintegrate** if worktree exists, then S12 per keep flag.

Host max-turns / max-budget must be **looser** than these caps so S11 can run. Prefer driver-owned caps over relying only on host kill.
