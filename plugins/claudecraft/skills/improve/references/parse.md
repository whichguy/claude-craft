<!-- NL parse for continuous improve driver -->

# Parse free-form improve invocation

Arguments after the skill invoke are **free-form**. Prefer natural language; flags override.

## Fields

| Field | Required? | Default | Cues |
|---|---|---|---|
| `repo` | no | cwd git root | path tokens that pass `git rev-parse`; `in <path>`, `in the <name> repo` |
| `target` | yes* | resume from existing `IMPROVE_LOOP.md` title | residual prose after stripping other fields |
| `until` | no | see **Defaults** | `until …`, `stop when …`, `done when …`, `keep going until …` |
| `tests` | yes* | resume ledger / ask once | `tests via …`, `using pytest…`, backticks |
| `mode` | no | see **Defaults** | `once`, `one cycle` / `keep going`, `iterate`, `continuous` |
| `worktree` | no | **on** (once and continuous) | opt out: `no worktree`, `--no-worktree` |
| `keep_worktree` | no | false | `keep worktree`, `debug worktree` |
| `carry_wip` | no | carry if launch dirty | `clean start`, `include my WIP` |
| `max_cycles` | no | 10 continuous / 1 once | `max N cycles`, `at most N` |
| `max_elapsed` | no | unset | `for 45m`, `timebox 1h` |
| `merge_to_launch` | no | **true** | merge detached tip → source branch; opt out: `no merge`, `open a PR`, `--no-merge-to-launch` |
| `critique` | no | on at seed | `skip plan review` |

\*Unattended: abort if target or tests missing and no ledger to resume.  
**Never invent** a test command from project type alone.

## Defaults (autonomous continuous)

After fields are resolved:

1. **`mode`**  
   - **`once`** only if the user said `once`, `one cycle`, `single cycle`, or equivalent.  
   - Otherwise, if **target is clear** (non-empty residual or resumable ledger title) → **`continuous`**.  
   - Do **not** require “until” / “keep going” to select continuous.

2. **`until`** (continuous only; when user did not pass an until string)  
   - Default string (persist verbatim to ledger header + Driver):  
     **`no material P0/P1 for 2 consecutive cycles (green tests)`**  
   - This is the **no-criteria default**: iterate until two consecutive non-material
     green cycles (Phase 3 rule 3). Empty P0/P1 backlog after one cycle is not enough.  
   - Once mode: `until` is `none` unless user passed one.

3. **`max_cycles`**  
   - Continuous: **10** if unset. Once: **1** if unset.

4. **Interactive**  
   - Echo the parse card, then **proceed** unless target or tests are still missing (ask once for tests; abort unattended if still missing).  
   - Do **not** wait for “confirm parse” approval when confidence is normal.

## Algorithm

1. Flag pass (`--repo`, `--until`, `--tests`, …)  
2. Path pass (existing dir + git root)  
3. Cue-phrase pass (until / tests / mode / caps)  
4. Residual → target  
5. Apply **Defaults** above  
6. Echo parse card; proceed (or ask only for missing target/tests)  
7. **Persist to disk ASAP** (S2/S4): write `mode`, `until`, `max_cycles`, `test_command` into `IMPROVE_LOOP.md` header **and** `## Driver` so improve-loop rehydrates without chat (see ledger-schema).

## Parse card

```text
improve parse
  repo:      …
  target:    …
  until:     …          # default P0/P1×2 when continuous
  tests:     …
  mode:      continuous|once   max_cycles=…  max_elapsed=…
  worktree:  yes|no   keep=…  carry=…  merge_to_launch=…
```
