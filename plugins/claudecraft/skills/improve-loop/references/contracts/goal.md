<!-- Host-agnostic contract — improve continuous runs bind stop predicates here -->

# Contract: Goal (continuous objective)

Improve’s **continuous** outer loop is harness-neutral. Hosts **may** provide a goal facility; if they do not, the driver runs an equivalent **native** loop.

## Capability

```text
goal.start(objective, stop_predicate, caps?)
goal.report(progress)           # progress pulse — see progress.md (this directory)
goal.complete(summary)          # success-shaped terminal
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

The run’s inner improve-loop cycles stop when **any** of:

1. `IMPROVE_LOOP.md` **Status** is `complete` or `stopped (...)` **and** the latest Log entry is **landed** (Committed yes + greppable commit), or a clean short-circuit with no work  
2. User **until** condition (if any) is satisfied (only required for success-shaped complete when declared)  
3. Caps: `max_cycles`, `max_elapsed`, token/usd budget  
4. Unrecoverable block (no test command, code-dirty veto without resolution, etc.)

**After** any stop that used a worktree: always **reintegrate** (and destroy unless keep-worktree / reintegrate failed). Teardown is not optional when the host “completes goal.”

## Host mappings (informative)

| Host | Binding |
|---|---|
| Claude Code | Built-in goal + progress tools **or** native S8 driver loop |
| Grok | Host goal mode + `update_goal` **or** native S8 |
| Codex / headless | Native S8 + process max-turns/budget as host backstop |
| ralph-style re-invoke | Outer re-prompt with completion promise = terminal+landed (optional) |

## Rules

1. Skills **must not** require nested slash-invocation of a product-specific goal command as the only continuous path.  
2. Prefer host goal **UI** when present; **semantics** always match this contract.  
3. Host process caps (max-turns, max-budget) must be **looser** than driver caps so reintegrate can run.  
4. No Claude-, Grok-, or Codex-only names are required to implement this contract.
