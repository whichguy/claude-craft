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

## Stop predicate (shared) — canonical table

**Precedence (first match wins):** existing terminal status → same-error ×3 → no-progress ×3
→ driver/host caps → until classification. Caps and outer-loop docs **reference** this table;
Phase 3 keeps executing numbered rules that implement it.

**Pure helpers (preferred when Node is available):**
`plugins/claudecraft/tools/improve-stop-decision.js`

1. **`classifyUntilKind(untilString, mode)`** — caller-side; maps ledger until text →
   `default|custom|none` using the **canonical** continuous default string
   `no material P0/P1 for 2 consecutive cycles (green tests)` (same as parse.md / Phase 0
   restore / Phase 3 default-form match). Single source: exported `DEFAULT_UNTIL`.
2. **`deriveStopDecision(snapshot)`** — pure encoding of this table. Snapshot carries
   `until_kind` (never string-matches until text inside derive). Output
   `{ decision, reason }` with `decision` ∈ `continue|confirm|complete|stop`.

Recipe: `until_kind = classifyUntilKind(header.until, mode)` then
`deriveStopDecision({ …, until_kind, suite_this_cycle, … })`.
This Markdown table remains the no-Node fallback and the semantic source derive encodes.
S8 checks `next_auto: blocked:*` **before** consulting the stop helper.

| Condition | Result |
|---|---|
| Existing `complete` or `stopped (...)` (and landed when required) | Preserve it |
| Same error ≥3 | `stopped (same-error ×3)` |
| No progress ≥3 | `stopped (no-progress ×3)` |
| Driver/host cap (`max_cycles` / `max_elapsed` / budget) | `stopped (<cap>)` |
| Default P0/P1×2: zero unchecked P0/P1 + streak ≥2 + **current-cycle PASS** | Complete (`until: no-P0/P1×2`) |
| Default P0/P1×2: zero unchecked P0/P1 + streak ≥2 + **no current-cycle suite** | **Confirm** — stay active; next cycle is a verification cycle (Phase 1 runs the recorded suite despite empty backlog); re-evaluate. Consecutive confirm with suite still absent increments no-progress |
| Default P0/P1×2: eligible + current-cycle FAIL | Continue (seed regression work) |
| Custom until unmet | Continue, regardless of backlog |
| Custom until met + current-cycle PASS | Complete (`until: <short>`) |
| Custom until met + no current-cycle suite | Confirm (as above) |
| Custom until met + FAIL | Continue |
| Once mode (`until: none`): empty backlog + PASS / none / FAIL | Complete / Confirm / Continue |

Do **not** complete on "last non-material cycle was PASS" alone — that is non-current
verification and routes to **Confirm**, never Complete.

Evaluate **after every improve-loop cycle** on **disk facts** (goal facility or native S8;
mirror `improve/references/caps.md`):

1. Status already terminal and landed (or clean short-circuit with no work).  
2. **Until on disk** (header/Driver `until` non-empty and not `none`):  
   - **Default P0/P1×2 form** (`no material P0/P1 for 2 consecutive cycles (green tests)`,
     or phase-3 substring match): requires **all** of zero unchecked P0/P1, streak ≥ 2, and
     current-cycle suite PASS to complete. Empty backlog alone is **not** enough — Phase 3
     rule 4 is suppressed under this default.  
   - **Custom until**: outer host (goal turn or improve S8) **must evaluate the until text
     against disk**. Met + current-cycle PASS → complete; met + no suite → Confirm; unmet →
     continue. Custom until is an authoritative product decision — never auto-complete from
     empty backlog alone.  
   - improve-loop Phase 3 auto-completes **only** the default form (rule 3); rule 4
     empty-backlog complete is **once-mode (`until: none`) only**.  
3. Caps: `max_cycles`, `max_elapsed`, token/usd budget, and/or host max-turns / max-budget.  
4. Unrecoverable block (no test command, code-dirty veto without resolution, etc.).

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
