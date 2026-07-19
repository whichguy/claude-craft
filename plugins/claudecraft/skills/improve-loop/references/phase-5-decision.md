<!-- Extracted from improve-loop SKILL.md — normative cycle law; do not rewrite casually -->

### Phase 5 — Loop decision (native; Driver update + optional lifecycle writes)

After the pulse rules below: update `## Driver` (`next_auto`, `resume_hint`, `updated`,
paths). Prefer no extra file writes beyond Driver/ledger; lifecycle steps may commit.

#### Control-channel progress pulse (required)

Before terminal / host-goal handling, **emit** the cycle’s progress pulse per
`contracts/progress.md`:

1. Complete fields from Phases 2–4 (outcome, test, committed, changes, learnings).  
2. After replan: **Next** = **one** resolved handoff (first open item slug or residual/continue/stop).  
3. Progress metrics (**PLAN_PROGRESS_ALIGN**): open P0/P1, residual streak, cycle K +
   iter N, optional Validation line; stall counters; Status. Prefer open P0/P1 over
   checked/total backlog counts.  
4. **Prefer the pure formatter** when Node is available so the pulse matches the schema:
   build a JSON object of the fields above, then
   `node <plugin>/tools/improve-progress-format.js --file <pulse.json>`
   (or stdin). If Node is unavailable, hand-author the same markdown shape from
   `contracts/progress.md` (heading must be `## Improve progress`).  
5. Emit via host goal progress if available, else **user-visible markdown** from step 4.  
6. Never skip solely because Outcome was `blocked` or commit vetoed — those are exactly
   when operators need visibility.

Mid-cycle optional pulse: only if Phase 1 is still running past a soft wall-clock budget
(one “still executing …” line max).

---

Phase 3 set terminal Status on a full cycle and Phase 4 attempted the ledger commit. Act
only on a **committed** terminal state for **host goal complete/blocked**; progress pulses
already cover active/blocked/veto cases above.

- If Status is `complete` or `stopped (...)` **and** the latest Last cycle is **landed**—it
  has `Committed: yes` and
  `git log --grep="improve-loop: iteration N —"` finds the commit—then:

  - Under a host **goal** continuous run (per `contracts/goal.md`), with a short summary:
    - Status `complete` → **`goal.complete`**
    - Status `stopped (...)` (stall, same-error, no-progress, user stop, caps, etc.) →
      **`goal.blocked`** (do not call complete on a stop reason)
    Do **not** invent product-specific completion-promise tags.
  - Standalone (single improve-loop invoke) or under the **`improve` driver** without a
    goal API: report the outcome to the user (and let the driver exit S8 → S9–S13).

- If Status is terminal but not landed because Phase 4 failed or the code-dirty veto fired,
  do **not** call `goal.complete` **or** `goal.blocked`. Report the failure or veto and leave
  the dirty tree (and host goal open) for the user or next turn's stop-and-report/ledger-flush
  path. Completing or blocking the host goal here would end continuous work while the ledger
  remained uncommitted.

- Two related stops end *before* this phase, each with its own attribution: the **Phase 0
  not-landed + code-dirty stop** (step 4) ends inside Phase 0, and a **Phase 4 secret /
  code-dirty veto** stops and reports inside Phase 4 (no host-goal complete/blocked — same as
  not-landed above). Neither may set a `stopped (...)` Status over dirty code (the
  code-dirty veto forbids that) and neither may complete or block the host goal. The continuous host
  (goal or improve) must use **finite** caps so an unresolvable dirty tree cannot spin
  forever; the operator resolves the tree (commit or discard) to resume real cycles.

- Otherwise Status is active. End normally. Under a host **goal**, the host may start
  another turn (each turn rehydrates from disk via Phase 0). Under the `improve` driver,
  continue S8 or exit to reintegrate per driver caps.

- **R8d (pulse emission):** if Phase 3v seeded any `validate V<k>` (or write-section) work,
  Status is still `active` — pulse/discovery must say **continuing** (cycle K+1), never
  campaign “done”. 3v fail is never a terminal Status and never an L1/host exit reason
  (see `phase-3v-validate.md` R8).

## Continuous / quota composition

**Prefer (host-agnostic multi-cycle):** host **goal** iterating one improve-loop cycle per
turn (`contracts/goal.md`). **Secondary:** **`improve` driver** — native S0–S13 loop,
worktree, caps, always reintegrate **with merge into the launch/source branch by default**.
See `../../improve/SKILL.md` and `contracts/outer-loop.md`.

A single improve-loop invocation performs **exactly one** cycle and reports. That is the
atomic unit — **not** a full continuous campaign. Seed `IMPROVE_LOOP.md` with one cycle
(or create under continuous S4), then let goal/`improve` iterate.

### Worktree end (auto — once mode or when continuous driver is not taking S11)

**Anti-double-teardown:** If the continuous **`improve` driver** owns this run and will run
S11–S12 itself, improve-loop Phase 5 **must not** also reintegrate/destroy — only update
Driver `next_auto: reintegrate` (or leave for S11). If `reintegrate_status` is already `ok`
and worktree is gone, skip teardown (no-op).

If an improve worktree is in play and the outer continuous driver is **not** taking S11
(typical **once** improve-loop), the orchestrator **must automatically** finish lifecycle
after the pulse — do not wait for the user:

0. Update `## Driver` with `next_auto: reintegrate` (or `blocked:…`).  
1. If porcelain is **only** `IMPROVE_LOOP.md`, auto-commit
   `improve-loop: driver — next_auto reintegrate` (ledger-schema only-ledger rule).  
2. `reintegrate` — **S11a** rebase onto source tip; **S11b** merge tip → source when
   `merge_to_launch` (default true). Conflicts may include `IMPROVE_LOOP.md` itself — resolve
   in the worktree. Prefer `improve-worktree.sh status` after each step (`suggested_next`,
   `tip_on_launch`, `resume_hint`).  
3. On success with tip **on launch** (`tip_on_launch=yes` / S11b merged): `next_auto: destroy`
   (or `done` if `keep_worktree`); then `destroy` unless keep. **Do not** pass `--force` unless
   the operator explicitly wants to discard uncommitted dirt.  
   If `merge_to_launch=false` **or** tip still unmerged after S11a: set **`blocked:open-pr`**
   (not `done`, even with `keep_worktree`) — do **not** claim launch was updated; do **not**
   auto-destroy the tip.  
4. On failure: set catalog token (`blocked:rebase-continue`, `blocked:launch-dirty`,
   `blocked:worktree-dirty`, …); **print the resume template** (below); stop. Do not mark
   the host goal complete. Prefer **`recover`** when run_json shows reintegrate
   failed/conflict and the worktree still exists (`improve-worktree.sh recover --repo …
   --slug …`) — recover **does not** force-destroy dirty worktrees. Else manual
   `rebase --continue` + reintegrate.

**Status `complete` does not skip teardown** while a worktree still needs reintegrate.

### Resume template (print on blocked or when a human must re-prompt)

```text
Resume improve from disk (ignore chat history).

repo: <repo>
slug: <slug>
worktree_path: <path|none>
run_json: <path|none>
next_auto: <value>
blocked_detail: <or none>

Steps:
1. cd worktree_path if set, else repo
2. Read IMPROVE_LOOP.md header + ## Driver + ## Last cycle
3. Prefer run_json for paths if file exists; run improve-worktree.sh status --repo … --slug … for summary
4. Execute next_auto only:
   - cycle | reintegrate | destroy | done
   - blocked:open-pr → open PR from tip, or reintegrate --merge-to-launch; never claim merged
   - blocked:rebase-continue → fix conflicts in worktree, git rebase --continue, reintegrate
   - reintegrate_status failed/conflict → prefer: improve-worktree.sh recover --repo … --slug …
   - blocked:worktree-dirty → commit/stash non-ledger dirt (destroy/recover will refuse otherwise)
   - blocked:destroy-failed → destroy; use --force only when discarding intentionally
   - other blocked:* → fix reason in blocked_detail
5. Use test_command from ledger; never invent tests
6. Update ## Driver after the step (recompute next_auto from disk / improve-next-auto.js)
```


### Multi-cycle hosts (not re-invoke plugins)

Use **host goal** (preferred) or **`/claudecraft:improve`** for continuous campaigns. Rules:

- Name target + test command on cold start (ledger path alone is insufficient when missing).
- Outer caps **must be finite** — unlimited is unsupported (dirty-tree stop-and-report
  cannot self-exit without a false complete).
- Do not call `goal.complete` from Status alone; Phase 5 authorizes host complete only when
  terminal **and** landed.
- Prefer the `improve` driver when worktree + reintegrate + destroy orchestration is needed
  in-process without a goal UI.

This skill makes no assumptions about any project's language, layout, test framework, or
build tool. Ask for and record the target test command rather than inferring one.
