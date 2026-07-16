<!-- Extracted from improve-loop SKILL.md — normative cycle law; do not rewrite casually -->

### Phase 5 — Loop decision (native; Driver update + optional lifecycle writes)

After the pulse rules below: update `## Driver` (`next_auto`, `resume_hint`, `updated`,
paths). Prefer no extra file writes beyond Driver/ledger; lifecycle steps may commit.

#### Control-channel progress pulse (required)

Before promise/terminal handling, **emit** the cycle’s progress pulse per
`contracts/progress.md`:

1. Complete fields from Phases 2–4 (outcome, test, committed, changes, learnings).  
2. After replan: **Next** = first unchecked Backlog item; blockers from Notes/Status.  
3. Progress metrics: backlog done/total, stall counters, Status.  
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
caps, always reintegrate **with merge into the launch/source branch by default**. See
`../../improve/SKILL.md` and `contracts/goal.md` / `contracts/outer-loop.md`.

A single improve-loop invocation performs **exactly one** cycle and reports. Use that for
a manual first look, and preferably to seed `IMPROVE_LOOP.md` before unattended continuous
runs.

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
   in the worktree.  
3. On success: `next_auto: destroy` (or `done` if `keep_worktree`); then `destroy` unless keep.  
   If `merge_to_launch=false`, after S11a set `blocked:open-pr` or `done` with PR hint — do
   **not** claim launch was updated.  
4. On failure: set catalog token (`blocked:rebase-continue`, `blocked:launch-dirty`, …);
   **print the resume template** (below); stop. Do not promise success. Prefer **`recover`**
   when run_json shows reintegrate failed/conflict and the worktree still exists
   (`improve-worktree.sh recover --repo … --slug …`), else manual `rebase --continue` +
   reintegrate.

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
2. Read IMPROVE_LOOP.md header + ## Driver + last Log entries
3. Prefer run_json for paths if file exists
4. Execute next_auto only:
   - cycle | reintegrate | destroy | done
   - blocked:rebase-continue → fix conflicts in worktree, git rebase --continue, reintegrate
   - reintegrate_status failed/conflict → prefer: improve-worktree.sh recover --repo … --slug …
   - blocked:destroy-failed → destroy [--force]
   - other blocked:* → fix reason in blocked_detail
5. Use test_command from ledger; never invent tests
6. Update ## Driver after the step
```


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
