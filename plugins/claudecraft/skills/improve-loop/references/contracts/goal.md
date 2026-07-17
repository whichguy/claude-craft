<!-- Host-agnostic contract — continuous runs bind stop predicates here -->

# Contract: Goal (continuous objective)

Improve’s **continuous** outer loop is harness-neutral. **Host goal** is the preferred
multi-cycle host: the goal **iterates** until a stop predicate, and each iteration runs
**exactly one** improve-loop cycle. If the host has no goal facility, the **`improve` driver**
runs an equivalent **native** S8 loop with the same stop semantics.

```text
goal.start(objective, stop_predicate, caps?)   # finite caps required unattended
  while not stop:
    improve-loop one cycle (or Phase 0 short-circuit / ledger-flush)
    goal.report(progress)
  goal.complete(summary) | goal.blocked(reason)
```

## Capability

```text
goal.start(objective, stop_predicate, caps?)
goal.report(progress)           # progress pulse — see progress.md (this directory)
goal.complete(summary)          # success-shaped terminal (Status terminal + landed)
goal.blocked(reason)            # stall / budget / error terminal
```

### Progress reporting (required cadence when continuous)

When a host provides goal (or the `improve` driver runs continuous S8), emit **progress pulses**
per `progress.md` (sibling contract):

- After **each** improve-loop cycle (learnings, changes, backlog/caps progress)
- After reintegrate / final done

`goal.report(progress)` is the preferred binding; if the host has no goal API, still emit the
same markdown as a **user-visible control-channel message**. Reporting never replaces the
ledger and never blocks reintegrate.

## Stop predicate (shared)

The continuous run stops when **any** of:

1. `IMPROVE_LOOP.md` **Status** is `complete` or `stopped (...)` **and** the latest Log entry is **landed** (Committed yes + greppable commit), or a clean short-circuit with no work  
2. **Until on disk** satisfied (header/Driver `until` non-empty and not `none`) — evaluate
   **after every improve-loop cycle** on **disk facts**, whether the outer host is a **goal**
   facility or native improve S8 (same procedure; mirror `improve/references/caps.md`):  
   - **Default P0/P1×2 form** (`no material P0/P1 for 2 consecutive cycles (green tests)`,
     or phase-3 substring match): if `consecutive-non-material-cycles >= 2` **and** last
     suite green → until met; set Status `complete` if still active; stop reason
     `until: no-P0/P1×2`.  
   - **Custom until** (any other non-empty string): the host goal turn (or improve S8)
     **must evaluate the until text against disk** (Status, backlog, counters, test PASS,
     landed paths, Stop-condition). If clearly met → set Status `complete` (or
     `stopped (until: <short>)`); stop reason `until: <short>`. Do **not** ignore custom
     until, re-ask for a stop condition already on disk, or wait only for max_cycles.  
   - improve-loop Phase 3 auto-completes **only** the default P0/P1×2 form; custom until
     is always outer-host (goal or S8) responsibility.  
3. Caps: `max_cycles`, `max_elapsed`, token/usd budget, and/or host max-turns / max-budget  
4. Unrecoverable block (no test command, code-dirty veto without resolution, etc.)

Until/mode/max_cycles live on the ledger header + `## Driver` (same values). Hosts must not
invent a different stop string in chat after seed.

**After** any stop that used a worktree: always **reintegrate** (and destroy unless keep-worktree / reintegrate failed). Teardown is not optional when the host “completes goal.”

## Host mappings (informative)

| Host | Binding |
|---|---|
| Claude Code | Built-in goal + progress tools **or** native S8 (`/claudecraft:improve`) |
| Grok | Host goal mode + `update_goal` **or** native S8 |
| Codex / headless | Native S8 + process max-turns/budget as host backstop |

## Rules

1. Skills **must not** require nested slash-invocation of a product-specific goal command as the only continuous path.  
2. Prefer host goal **UI** when present; **semantics** always match this contract.  
3. Host process caps (max-turns, max-budget) must be **looser** than driver caps so reintegrate can run.  
4. No Claude-, Grok-, or Codex-only names are required to implement this contract.  
5. After context compaction or a new turn: **rehydrate from disk** (`IMPROVE_LOOP.md` `## Driver` +
   `.git/improve-runs` + git) per improve-loop Phase 0 — not from goal chat history alone.
   If `next_auto` is `reintegrate`/`destroy`, prefer a teardown-only turn before more cycles.
6. **Finite caps only** for unattended continuous goals — unlimited outer iteration is unsupported
   (dirty-tree stop-and-report cannot self-exit without a false complete).
