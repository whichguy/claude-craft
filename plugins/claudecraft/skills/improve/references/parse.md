<!-- NL parse for continuous improve driver -->

# Parse free-form improve invocation

Arguments after the skill invoke are **free-form**. Prefer natural language; flags override.

## Fields

| Field | Required? | Default | Cues |
|---|---|---|---|
| `repo` | no | cwd git root | path tokens that pass `git rev-parse`; `in <path>`, `in the <name> repo` |
| `target` | yes* | resume from existing `IMPROVE_LOOP.md` title | residual prose after stripping other fields |
| `until` | no | — | `until …`, `stop when …`, `done when …`, `keep going until …` |
| `tests` | yes* | resume ledger / ask once | `tests via …`, `using pytest…`, backticks |
| `mode` | no | continuous if until/keep going else once | `once`, `one cycle` / `keep going`, `iterate` |
| `worktree` | no | on if continuous | `no worktree`, `in a worktree` |
| `keep_worktree` | no | false | `keep worktree`, `debug worktree` |
| `carry_wip` | no | carry if launch dirty | `clean start`, `include my WIP` |
| `max_cycles` | no | 10 continuous / 1 once | `max N cycles`, `at most N` |
| `max_elapsed` | no | unset | `for 45m`, `timebox 1h` |
| `merge_to_launch` | no | **true** | default auto-merge; opt out: `no merge`, `open a PR`, `--no-merge-to-launch` |
| `critique` | no | on at seed | `skip plan review` |

\*Unattended: abort if target or tests missing and no ledger to resume.  
**Never invent** a test command from project type alone.

## Algorithm

1. Flag pass (`--repo`, `--until`, `--tests`, …)  
2. Path pass (existing dir + git root)  
3. Cue-phrase pass (until / tests / mode / caps)  
4. Residual → target  
5. Defaults  
6. Echo parse card; confirm if low confidence (interactive)

## Parse card

```text
improve parse
  repo:      …
  target:    …
  until:     …
  tests:     …
  mode:      continuous|once   max_cycles=…  max_elapsed=…
  worktree:  yes|no   keep=…  carry=…  merge_to_launch=…
```
