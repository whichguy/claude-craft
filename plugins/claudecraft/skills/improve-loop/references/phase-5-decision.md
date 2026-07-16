<!-- Extracted from improve-loop SKILL.md — normative cycle law; do not rewrite casually -->

### Phase 5 — Loop decision (native, no further file writes)

#### Control-channel progress pulse (required)

Before promise/terminal handling, **emit** the cycle’s progress pulse per
`contracts/progress.md`:

1. Complete fields from Phases 2–4 (outcome, test, committed, changes, learnings).  
2. After replan: **Next** = first unchecked Backlog item; blockers from Notes/Status.  
3. Progress metrics: backlog done/total, stall counters, Status.  
4. Emit via host goal progress if available, else **user-visible markdown** starting with
   `## Improve progress`.  
5. Never skip solely because Outcome was `blocked` or commit vetoed — those are exactly
   when operators need visibility.

Mid-cycle optional pulse: only if Phase 1 is still running past a soft wall-clock budget
(one “still executing …” line max).

---

Phase 3 set terminal Status on a full cycle and Phase 4 attempted the ledger commit. Act
only on a **committed** terminal state for **promises**; progress pulses already cover
active/blocked/veto cases above.

- If Status is `complete` or `stopped (...)` **and** the latest Log entry is **landed**—it
  has `Committed: yes` and
  `git log --grep="improve-loop: iteration N —"` finds the commit—then:

  - Under an **active re-invoke outer loop** that uses a completion promise (e.g. ralph-style),
    end the turn with `<promise>IMPROVE_LOOP_DONE</promise>` as the **final line**, with the
    tag's contents matching the configured completion promise literally. A one-line human
    summary *before* that final line is fine — the host Stop hook typically extracts the
    first `<promise>…</promise>` tag in the last assistant text block, trims outer whitespace,
    collapses internal whitespace, and compares with exact equality (after stripping the
    configured phrase's surrounding quotes). What is **not** fine: emitting the bare phrase
    without the tags, or wrapping the tag mid-sentence inside other prose on the same line.
  - Standalone (or continuous driver without a promise protocol), report the outcome to the
    user and do not emit a promise tag.

- If Status is terminal but not landed because Phase 4 failed or the code-dirty veto fired,
  do not emit the promise. Report the failure or veto and leave the dirty tree for the user
  or next turn's stop-and-report/ledger-flush path. A promise here would end an outer
  re-invoke loop while its ledger remained uncommitted.

- Two related stops end *before* this phase, each with its own attribution: the **Phase 0
  not-landed + code-dirty stop** (step 4) ends inside Phase 0, and a **Phase 4 secret /
  code-dirty veto** stops and reports inside Phase 4 (its promise-suppression is already
  covered by the not-landed bullet above). Neither may set a `stopped (...)` Status (committing
  a terminal note over dirty code is exactly what the code-dirty veto forbids) and neither may
  emit the promise (that would be false success over an uncommitted tree). Under a re-invoke
  outer loop the turn simply ends with a report; the outer iteration advances, so a
  **finite** max-iterations backstop (Phase 0 fails fast on unlimited when that adapter is
  driving — see phase-0) bounds an unresolvable dirty-tree state. The operator resolves the
  tree (commit or discard) to let the loop resume real cycles.

- Otherwise Status is active. End normally. Under a re-invoke outer loop, the host invokes
  the wrapper again with the same prompt; Phase 0 always re-derives state from the on-disk
  ledger regardless of what triggered the turn. Under the `improve` driver, continue S8 or
  exit to reintegrate per driver caps.

## Continuous / quota composition

**Prefer (host-agnostic):** the **`improve` driver** skill — native S0–S13 loop, worktree,
caps, always reintegrate. See `../../improve/SKILL.md` and `contracts/goal.md` /
`contracts/outer-loop.md`.

A single improve-loop invocation performs **exactly one** cycle and reports. Use that for
a manual first look, and preferably to seed `IMPROVE_LOOP.md` before unattended continuous
runs.

### Optional: finite re-invoke wrappers (adapter example)

If the host has a ralph-style Stop re-invoke plugin, it may wrap one cycle at a time with a
**finite** max iterations and a completion promise only when Phase 5 allows (terminal
**and** landed). Example shape (Claude Craft packaging):

```
/ralph-loop "Invoke the improve-loop skill for one cycle (or Phase 0 short-circuit / ledger-flush). If ./IMPROVE_LOOP.md exists, resume from it. If not, create it for target: <TARGET> with test command: <CMD>. Emit <promise>IMPROVE_LOOP_DONE</promise> only when Phase 5 instructs (Status terminal AND latest Log commit landed). If outer max iterations exhausted mid-run, set Status to stopped (ralph max iterations), Phase 4 commit, then Phase 5 promise." --max-iterations N --completion-promise "IMPROVE_LOOP_DONE"
```

Rules for any re-invoke wrapper:

- Name target + test command on cold start (ledger path alone is insufficient when missing).
- Outer max iterations **must be finite `> 0`** — unlimited is unsupported (dirty-tree
  stop-and-report cannot self-exit without a false promise).
- Do not promise-exit from Status alone; Phase 5 authorizes the promise only when landed.
- Prefer the `improve` driver when worktree + reintegrate + destroy are needed.

This skill makes no assumptions about any project's language, layout, test framework, or
build tool. Ask for and record the target test command rather than inferring one.
