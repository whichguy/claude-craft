---
name: improve-loop
description: >-
  Run one evidence-led improvement cycle for a plain-language target in any git repository:
  execute a bounded backlog item, test it, record deterministic learnings, replan through a
  multi-model advisory panel, and commit the durable ledger. Invoke for "/improve <target>",
  "/claudecraft:improve-loop <target>", "/improve-loop <target>", "improve this project
  iteratively", or "run a tested improvement cycle"; compose with /goal for multi-cycle
  campaigns (host max-turns/budget for unattended hard caps).
---

# Improve loop

Run exactly one improvement cycle per invocation. The cycle executes (or deliberately
skips) a bounded piece of work, runs the target's recorded test command, captures the
evidence and thesis in `IMPROVE_LOOP.md`, replans from a multi-model advisory panel, and
commits the result. Git commit messages are the durable, reviewable ledger. While a
campaign is active, the on-disk `IMPROVE_LOOP.md` is only the resume surface; after a
terminal cycle that file is archived into the terminal commit message and removed.

**Workspace rule (non-negotiable):** From cold-start until terminal **merge-back**, **all**
improve work (ledger, code, tests, commits) happens in **exactly one** campaign worktree on
branch `improve/<slug>` under the launch checkout's `.worktrees/`. The launch checkout is
**read-only for campaign purposes** mid-run — no campaign commits, no `IMPROVE_LOOP.md`, no
campaign code edits on launch. Merge into the launch branch happens **only once**, after a
terminal iteration lands on the campaign branch — never per-cycle, never mid-campaign.
Resume always re-enters **that same** worktree (pointer), never a second one. Two absolute
paths exist only as plumbing (`WORKSPACE` = the campaign worktree; `LAUNCH` = primary
checkout for cold-start and end-of-campaign FF) — the campaign does **not** “run on launch.”

This skill does not contain its own repeat mechanism. Use it once for a manual cycle, or
compose with **`/goal`** for multi-cycle (objective = terminal Status **and** iteration
commit landed). Outer hard caps are host **max-turns / max-budget** (or Esc) — not this
skill. Log `N` is independent of goal turns.

**Outer goal protocol (single rule):** Only **Phase 5** signals the outer goal. Phases 0–4
never call `update_goal`, never claim the objective is met, and never emit promise tags.
Complete the goal **only** when Status is terminal **and** the iteration commit has landed
(merge-back best-effort, reported, not required). On any stop/veto before that: report only.

## Invocation

```
/improve <target, described in plain language>
```

Also: `/improve-loop`, `/claudecraft:improve-loop` (plugin namespace). Example:
`/improve "error handling in scripts/ingest.py, tests via pytest"`.

No skill flags. Test command: reuse from invocation, goal objective, pointer, or existing
ledger. If still missing — **interactive:** ask once; **cannot ask** (headless / unattended):
`Status: stopped (no test command)`, write a Log entry (Thesis `no test command supplied…`,
Outcome `blocked`, `Committed: pending`), Phase 4 land (ledger-only), Phase 5. Prefer seeding
the command in the goal objective or a first interactive `/improve`.

**Target repository (do not assume session cwd is the campaign repo).** Resolve the **target
repo root** before Phase 0 step 1a when any of these apply:
1. The invocation names an absolute path under a git checkout.
2. The target names a skill or project with a known path (e.g. `backchain skill` →
   `$HOME/src/backchain` or the path from install docs / user context).
3. The goal objective names a repo path.
Otherwise default to `git rev-parse --show-toplevel` from the current tool cwd.
All of COMMON_GIT / LAUNCH / INVOKE_ROOT / POINTER / worktree creation use that **target
repo root**, not an unrelated session workspace. If resolution is ambiguous, **interactive:**
ask once; **unattended:** `Status: stopped (ambiguous target repo)`, ledger-only if a WORKSPACE
already exists, else report only.

**Test command for skill/doc-only targets.** When the change set is a skill or markdown
contract (no product suite), the recorded command may be a **structural smoke** the repo
already owns (e.g. `make test-fast`, a `bash -n`/`node --check` script, or a tiny
`rg`-based contract test checked into the skill repo). Never invent a flaky e2e; prefer a
deterministic local gate.

**Legacy discard phrases** (optional, in the target or same-turn user text): `discard legacy`,
`clear ledger`, `clear IMPROVE_LOOP` force **discard** of a launch-root leftover ledger
instead of migrate (see Phase 0 step 1a.3). Default for Status `active` is **migrate**.

**Sibling skill.** `grok-review-converge` is the same shape (one round per invocation + outer
driver). Prefer **`/goal`** for multi-cycle on both; ralph remains an optional legacy outer
driver on grok-review-converge only when the operator explicitly wants promise-tag Stop-hook
quotas — never as improve-loop’s primary path.

## Preconditions

Fail fast in Phase 0. Do not half-run a cycle.

- **Shell must spawn.** This skill needs a working shell for `git`, worktree create, and the
  recorded test command. In Phase 0 step 1a, probe once (`true` or
  `git rev-parse --is-inside-work-tree`). If the tool **fails to spawn** (e.g. host
  `IO Error: No such file or directory` before any command runs) or returns unusable
  output with no exit path: **stop immediately** — report `blocked (shell unavailable)`,
  include the host error text if any, and state that worktree/test/commit cannot proceed.
  Do **not** thrash: no scheduler loops, no multi-subagent delete cascades, no further
  Phase 0 work that requires shell. File-only tools cannot complete this skill.
- The working tree must be inside a **non-bare** git repository: `git rev-parse --show-toplevel`
  succeeds and `git rev-parse --is-bare-repository` is not `true`. Commits are the durable
  ledger; without git there is no Phase 4. `git worktree` must work (refuse if
  `git worktree list` fails).
- **Paths** (resolved in Phase 0 step 1a):
  - `WORKSPACE` — the **single** campaign worktree (`$LAUNCH/.worktrees/<slug>`). **This is
    where the entire `/improve` campaign runs** (ledger, code, tests, commits). After resolve,
    `cd "$WORKSPACE"` (or set tool cwd) for all cycle work.
  - `LAUNCH` — primary worktree (`dirname` of absolute `--git-common-dir`). Used **only** for
    cold-start `worktree add` and **end-of-campaign** FF merge-back — not for mid-campaign
    edits.
  - `POINTER` — `$COMMON_GIT/improve-loop/active.json` where
    `COMMON_GIT=$(git rev-parse --path-format=absolute --git-common-dir)`. Ensures resume
    re-enters the **same** WORKSPACE (never a second worktree).
  While pointer `state: active`, launch must not receive campaign ledger, code, or commits.
- Recommend the target repo **gitignore** `.worktrees/` (launch checkout must not list campaign
  paths as litter). Do not auto-edit `.gitignore` unless a backlog item asks.
- `IMPROVE_LOOP.md` at **WORKSPACE** must not be gitignored. Check with
  `git -C "$WORKSPACE" check-ignore -q IMPROVE_LOOP.md` once WORKSPACE exists.
  If it is ignored, refuse clearly so the user can un-ignore it.
- **Test artifacts must not litter the tracked tree** (evaluated under WORKSPACE). The
  recorded test command may write transient files (byte-code caches, coverage data, snapshots,
  build output). Recommend the target repo **gitignore** these — `git status --porcelain`
  omits gitignored paths, so ignored artifacts never trip the dirty-tree guards. Un-ignored
  persistent test output is a real hazard: this skill excludes it from the *current* turn's
  guards (see the shared code-dirty definition in Phase 0 step 4 and the turn-level
  `TEST_ARTIFACT_PATHS` set), but a *later* invocation's fresh Phase 0 dirty-tree guard will
  see it as dirt and stop. If that happens the skill reports it and asks the operator to
  gitignore or clean those paths; it never permanently teaches itself to ignore arbitrary paths.
- Ensure the tools required for the path being taken are present: `git` and a shell capable
  of running the recorded test command. **Phase 1 execution does not depend on `codex-worker`
  (or any other external implementer).** The orchestrator implements natively (or via a
  generic agent) by default. Optional implementers are never required for the cycle to
  proceed.

## Durable state: `IMPROVE_LOOP.md`

Write one state file at **`$WORKSPACE/IMPROVE_LOOP.md`** (never on LAUNCH during an active
campaign). It is the **active-campaign resume surface** only: header, Backlog, and Log for
the campaign currently in progress. Resume from any cwd uses the **pointer** at
`$COMMON_GIT/improve-loop/active.json` (not a tracked file) to re-enter the **same**
WORKSPACE. The long-term, reviewable ledger is **git commit messages**:

- Every cycle's Phase 4 iteration commit body carries Thesis, Outcome, test evidence, advisor
  consolidation, Notes, and stop-condition state (always).
- On a **terminal** cycle (`complete` or `stopped (...)`), that same Phase 4 commit also
  embeds a **verbatim full-file archive** of `IMPROVE_LOOP.md` in the message body and
  **removes the file from the tree** in that commit — no second clear commit. The next
  `/improve` cold-starts. Prior learnings remain via
  `git log --grep="improve-loop: iteration"` (Phase 0 step 7 digest).

While active, the file has a rewritable header and Backlog plus a strictly
append-only Log, with two narrow exceptions on the *latest, not-yet-committed* entry only:
(1) its `Committed` and `Notes` fields as Phase 4 specifies, and (2) its `Test result` /
`Outcome` / `Error signature` and the Stop-condition tracking lines, as Phase 3's completion
gate specifies (when a completion-confirmation suite fails). Phase 0 steps 3a and 3b may also
repair a false `yes` or stuck `pending` after an interrupted prior cycle.

```markdown
# Improve Loop: <target description>

**Test command:** `<cmd>`
**Started:** <date>          **Status:** active | complete | stopped (<reason>)
**Iteration counter:** N     <!-- derived; next cycle uses N+1; must match Log -->

## Isolation
- **launch_root:** <LAUNCH>
- **campaign_branch:** improve/<slug>
- **worktree_path:** <WORKSPACE>

## Backlog
- [x] <item> — done <date> (commit: `git log --grep="improve-loop: iteration 1 —"`)
- [ ] <item> — <why it matters>

## Stop-condition tracking
- consecutive-no-progress: 0
- consecutive-same-error: 0 (signature: none)

## Log
(append-only — newest entry at the bottom; earlier entries are never edited.
 Two narrow exceptions, both on the *latest, not-yet-committed* entry only:
 (1) as Phase 4 specifies — set `Committed: yes` *before* the commit attempt so a
 successful commit freezes the truth (active cycles keep it on disk; terminal cycles
 freeze it in the commit-message archive after the file is removed); on commit failure
 restore the file if needed, correct that same entry to `no — <reason>`, and append Notes;
 never patch after a successful commit.
 (2) as Phase 3's completion gate specifies — when a completion-confirmation suite
 fails, correct that entry's `Test result` / `Outcome` / `Error signature` and the
 Stop-condition tracking lines in place. No other field, and no already-committed
 entry, is ever edited.)

### Iteration 1 — <date>
**Thesis:** what we tried and why we thought it would help
**Test result:** PASS | FAIL
**Outcome:** confirmed | disproven | partial | blocked
**Error signature:** <none | exact short string — see Phase 2>
**Committed:** pending | yes | no — <reason>
**Notes for next cycle:** …
```

Do not put an iteration's own commit SHA in its Backlog line or Log entry. That SHA does
not exist when the file is written (and a terminal iteration's commit **deletes** the
resume file rather than leaving it in the tree tip). Instead, always use the commit
subject `improve-loop: iteration N — <summary>` and look it up with the stable marker
`git log --grep="improve-loop: iteration N —"`. The em-dash after `N` is required: a bare
`… iteration N` is a prefix of longer numbers under git's default basic regex, so
iteration `1` could falsely match `10`, `11`, and later iterations.

Compute `N` deterministically, never freehand:

```
N = (number of `### Iteration` headings already in the Log) + 1
```

At the start of Phase 2, rewrite `**Iteration counter:**` to that same `N` so the header
and Log cannot drift. `N` comes only from Log headings — never from host turn counts.

## The cycle

### Phase 0 — Resume (native, cheap)

1. Resolve the **single campaign WORKSPACE** (and LAUNCH plumbing), then enforce
   Preconditions. Initialize the **turn-level** set `TEST_ARTIFACT_PATHS` to empty now — it
   accumulates test-command side effects across this turn's suite runs (see Phase 1's shared
   capture rule) and is excluded from the shared code-dirty definition. It resets every turn
   and is never persisted.

   **1a. Enter the one campaign worktree (before any ledger or dirty check).**

   First resolve **target repo root** (Invocation: Target repository). Then, **from that
   root** (or `git -C "$TARGET_REPO"`):

   ```
   TARGET_REPO = abs(resolved target repo root)   # not necessarily session cwd
   COMMON_GIT  = abs(git -C "$TARGET_REPO" rev-parse --git-common-dir)
   LAUNCH      = dirname(COMMON_GIT)    # refuse bare repos
   INVOKE_ROOT = abs(git -C "$TARGET_REPO" rev-parse --show-toplevel)
   POINTER     = $COMMON_GIT/improve-loop/active.json
   ```

   Refuse if bare. **Shell probe (once):** run `true` (or
   `git -C "$TARGET_REPO" rev-parse --is-inside-work-tree`). On spawn failure or unusable
   result → stop with `blocked (shell unavailable)` per Preconditions; do not continue 1a.
   Require `git -C "$TARGET_REPO" worktree list` to succeed.

   **Cold-start helper** (used by step 4 and by migrate in step 3 — same rules, one worktree):

   - Single-flight: `mkdir "$COMMON_GIT/improve-loop/lock"` must succeed; if it fails,
     another start is in progress or crashed — stop and report.
   - `slug` = short slug from target + `YYYYMMDD-HHMMSS` + **always** a random
     suffix: `-` + **6 hex** (from `/dev/urandom` or equivalent — never omit the
     random part; never rely on timestamp uniqueness alone). Branch
     `improve/<slug>`; path `$LAUNCH/.worktrees/<slug>`. The random suffix is
     mandatory on every cold-start so concurrent sessions and second-scale
     restarts cannot collide on a predictable path/branch. On residual
     branch/path collision (astronomically rare), append another `-` + 4 hex
     once; if still colliding, stop.
   - `mkdir -p "$LAUNCH/.worktrees"` then
     `git -C "$LAUNCH" worktree add -b "improve/<slug>" "$path" HEAD`.
   - Record `launch_branch` only if LAUNCH is not detached HEAD; else `launch_branch: null`
     and store `launch_head` SHA (no auto FF later).
   - Write `POINTER` (`version: 1`, `state: active`, launch_root, launch_branch, launch_head,
     campaign_branch, worktree_path, target, test_command when known, created_at,
     reintegrate_error: null). Remove the lock dir after the pointer is written (or on
     failure after cleanup).
   - Set `WORKSPACE = path`.

   **Active campaign detection (first match wins) — always the same WORKSPACE:**

   1. If `POINTER` exists and parses as JSON:
      - Require `worktree_path` is under `$LAUNCH/.worktrees/` (path-traversal guard;
        reject otherwise and stop).
      - If `state == reintegrate_blocked`: do **not** start a new cycle; run **Phase 5
        merge-back only** (below) and report. Stop. Still the same worktree until merge
        succeeds — never create a second one.
      - If the worktree directory exists and `git -C worktree_path rev-parse` works → set
        `WORKSPACE = worktree_path` (resume **same** workspace).
      - Else if `campaign_branch` ref exists → repair the **same** path:
        `git -C "$LAUNCH" worktree add "$worktree_path" "$campaign_branch"`; on failure
        stop and report. On success set `WORKSPACE`.
      - Else (branch and worktree gone) → delete pointer; fall through to cold-start.
   2. Else if `INVOKE_ROOT` is under `$LAUNCH/.worktrees/`, branch matches `improve/*`,
      and `$INVOKE_ROOT/IMPROVE_LOOP.md` exists → set `WORKSPACE = INVOKE_ROOT` and
      **repair** the pointer from live state (`state: active`) — already inside the one workspace.
   3. Else if `$LAUNCH/IMPROVE_LOOP.md` exists (legacy in-place campaign on launch) **and**
      no usable POINTER worktree → **migrate-or-discard** (do **not** hard-stop; do **not**
      leave a second campaign on launch):

      **Safety first:** if LAUNCH has **code-dirty** paths other than `IMPROVE_LOOP.md`
      (same shared code-dirty idea, under LAUNCH), **stop and report** — do not migrate or
      discard over unrelated dirty work. Operator must clean or commit first.

      **Classify** (first match wins):
      - **Discard** if any of: invocation/target/same-turn user text contains a legacy
        discard phrase (`discard legacy` / `clear ledger` / `clear IMPROVE_LOOP`); **or**
        Status is `complete` or `stopped (...)`; **or** the ledger has zero Log entries
        and is untracked (`git -C "$LAUNCH" ls-files --error-unmatch IMPROVE_LOOP.md` fails).
      - **Else Migrate** (default for Status `active` with a real Log).

      **Discard path:** delete `$LAUNCH/IMPROVE_LOOP.md` only when untracked (`rm`). If
      tracked (`git -C "$LAUNCH" ls-files -- IMPROVE_LOOP.md` non-empty), stop and report —
      operator must `git rm` / commit; do not invent a discard commit. Then fall through to
      step 4 cold-start for the **current** `/improve` target (fresh campaign).

      **Migrate path:**
      1. If launch ledger is tracked, **stop and report** (same as discard tracked case) —
         migrate only untracked launch leftovers.
      2. Read full ledger text into memory (`LEGACY_SNAPSHOT`).
      3. Run **Cold-start helper** (random 6-hex worktree + POINTER).
      4. Write `$WORKSPACE/IMPROVE_LOOP.md` from `LEGACY_SNAPSHOT`. If `## Isolation` is
         missing, inject it after the header block (before `## Backlog`):
         `launch_root`, `campaign_branch`, `worktree_path` set to this WORKSPACE.
      5. `rm` `$LAUNCH/IMPROVE_LOOP.md` (untracked only — already gated).
      6. Continue Phase 0 from step 2 onward **inside WORKSPACE** (resume path — do not
         reseed a blank ledger over the migrated content).

      Report one line in the cycle Notes later if Phase 2 runs: `migrated legacy launch
      ledger → WORKSPACE` or `discarded legacy launch ledger`.
   4. Else → **cold-start the one workspace** (only when no active pointer): run the
      **Cold-start helper** above.

   Never nest worktrees under a secondary feature worktree cwd — always
   `$LAUNCH/.worktrees/<slug>`. Never create a second improve worktree while a pointer is
   `active` or `reintegrate_blocked`.

   **After WORKSPACE is set:** `cd "$WORKSPACE"` (or set every tool/subagent working
   directory to WORKSPACE) for the rest of this turn's cycle work. Prefer real cwd so tests
   and agents stay in the one workspace; use `git -C "$LAUNCH"` only for pointer writes and
   end-of-campaign merge-back.

2. If `$WORKSPACE/IMPROVE_LOOP.md` is absent, **do not assume a brand-new campaign**. First
   distinguish **terminal land already committed** (resume file removed by design) from a
   true fresh workspace:

   - Inspect the most recent improve-loop commit on the campaign branch:
     `git -C "$WORKSPACE" log --grep="improve-loop: iteration" -n 1 --format="%s%n%b"`
     and/or leftover archive subjects
     `git -C "$WORKSPACE" log --grep="improve-loop: archive leftover ledger" -n 1 --format="%s"`.
   - If that tip commit's body contains
     `--- full IMPROVE_LOOP.md (terminal archive) ---`, **or** its subject is
     `improve-loop: archive leftover ledger after …`, the campaign is already **terminal +
     landed** and the resume file was intentionally deleted. Do **not** reseed. Run **Phase 5
     merge-back only** (same as `reintegrate_blocked`) and stop.
   - Otherwise create `$WORKSPACE/IMPROVE_LOOP.md` (target, test command per Invocation,
     Status `active`, Isolation header, empty Log, zeroed counters). Seed the Backlog
     immediately (native, or a tiny Agent call if the target is too vague for 1–3 items).
     Never enter Phase 1 with an empty Backlog. Skip 3a–4; go to step 5 with `N = 1`. Update
     pointer `test_command` / `target` when filled.

   **Resume rule:** absence of `IMPROVE_LOOP.md` on LAUNCH must **not** cold-start when a
   valid active pointer exists — step 1a already re-entered the **same** WORKSPACE.

3. Otherwise read the Backlog, Stop-condition block, and last two or three Log entries.
   If the Log has zero entries, the file was created by an earlier invocation that crashed
   before Phase 1 produced a Log entry. This is not the same-turn fresh-create case, but
   needs identical treatment: skip 3a–4 and go to step 5 with `N = 1`. There is no latest
   Log entry for 3a, 3b, or 4 to inspect; running those steps would incorrectly enter the
   ledger-flush branch instead of reaching this fallback. Otherwise, do not allocate a new
   `N` yet. First decide whether the turn repairs the ledger, short-circuits terminally,
   or starts a real cycle in steps 3a–4. Allocate
   `N = (number of ### Iteration headings) + 1` only when entering a new Phase 1–3 cycle
   after step 4 clears continuation.

   3a. **Orphaned `Committed: yes` recovery.** If the latest Log entry says
   `Committed: yes` but
   `git -C "$WORKSPACE" log --grep="improve-loop: iteration <that entry's N> —" -n 1`
   finds no commit, the previous cycle wrote pre-commit `yes` but never landed a commit
   (crash, kill, or hook abort before object creation). Correct it to
   `Committed: no — commit never landed` and append one Notes line. Do not invent a
   backfill commit here: this is an honesty repair only, and step 4 may still need a
   ledger flush.

   3b. **Stuck `Committed: pending` recovery.** If the latest Log entry still says
   `pending`, the cycle died after Phase 2 wrote it but before Phase 4's pre-commit `yes`
   write, including a Phase-4 code-dirty veto that never staged. Correct it to
   `Committed: no — cycle interrupted before commit` and append one Notes line. This is
   likewise honesty only.

4. Decide **landed vs short-circuit vs ledger-flush**. Status on disk without a landed
   commit is not done — do not short-circuit on Status alone (avoids burning a multi-cycle
   goal on an empty ledger). Outer-goal signals stay in Phase 5 only (see Outer goal protocol).

   - **Landed** (latest entry, after 3a/3b): on-disk `Committed: yes` **and**
     `git -C "$WORKSPACE" log --grep="improve-loop: iteration <N> —" -n 1` finds a commit
     (em-dash required). Same-turn terminal after archive uses Phase 5's landed rule (file
     already removed).
   - **Code-dirty** (shared with step 6, Phase 3 post-panel, Phase 4 veto): under WORKSPACE,
     path is code-dirty **iff** `git -C "$WORKSPACE" status --porcelain` lists it **and** it
     is **not** in `{IMPROVE_LOOP.md} ∪ TEST_ARTIFACT_PATHS`. Ignore LAUNCH dirt. Fresh turn
     has empty `TEST_ARTIFACT_PATHS`, so un-ignored prior test litter counts — report and ask
     operator to gitignore/clean (see Test-artifacts precondition).
   - Status terminal **and landed**: do not start a new cycle. If the resume file still
     exists, run **leftover-ledger archive** (below), then Phase 5. Do not seed a fresh
     ledger. (Modern terminal archive already removed the file; next `/improve` cold-starts
     via step 2.)

     **Leftover-ledger archive** (terminal + landed + file still present): one commit,
     pathspec only `IMPROVE_LOOP.md`. Subject
     `improve-loop: archive leftover ledger after <Status>` (not an iteration subject). Body:
     one line that iteration `N` already landed, plus:

     ```
     --- full IMPROVE_LOOP.md (terminal archive) ---
     <verbatim current file contents>
     --- end IMPROVE_LOOP.md ---
     ```

     Secret-scan, then `git -C "$WORKSPACE" rm -- IMPROVE_LOOP.md` (or delete if untracked)
     and commit on the campaign branch. On archive-commit fail: restore (Phase 4 rule), leave
     file; Phase 5 may still complete if the *iteration* commit already landed. On success →
     Phase 5 merge-back (best-effort).
   - **Not landed + code-dirty:** stop and report (no Phase 1, no new `N`). Operator must
     commit/discard/finish the prior diff — do not ledger-flush over abandoned code.
   - **Not landed + not code-dirty:** **ledger flush** — skip Phases 1–3; Phase 4 with the
     latest entry's `N` (no new allocation); then Phase 5.
   - **Landed + Status `active`:** continue to step 5; allocate next `N` then. (Zero-Log
     already went to step 5 from step 3.)

5. If the Backlog has no unchecked items while Status is `active`, skip **Phase 1 execute
   only**. Do not skip the rest of Phase 0: steps 6–7 still run because Phase 3 needs git
   history regardless of execution, and Phase 4 bookkeeping must still occur. Allocate this
   cycle's `N` if the zero-Log path did not already set it. After step 7 use lightweight
   Phase 2, then Phase 3, Phase 4, and Phase 5. Do not invent an ad-hoc code task to fill
   the cycle; replanning can reopen work or declare completion.

   For the **lightweight Phase 2** empty-backlog/no-execute path, append an entry with
   `Committed: pending`, Thesis such as `empty-backlog replan (no Phase 1 execute)`, Test
   result `PASS` (the suite was intentionally not re-run because no change set exists),
   Outcome `partial`, and Error signature `none`. Hold both stop-condition counters and
   the stored error signature *exactly* as they were. Do not apply the normal PASS/partial
   matrix row; resetting `consecutive-no-progress` for this no-op would hide a real stall.
   Set the header counter to `N`, then run Phase 3 normally.

6. For turns that will run Phases 1–3, apply the dirty-tree guard (shared **code-dirty**
   definition, step 4): if anything code-dirty is present, stop and report — do not fold
   pre-existing work into this cycle. Do not auto-stash. Ledger-flush turns already branched
   at step 4.

7. Build a **prior-learnings digest** for this target from git history (git commits are the
   durable, reviewable ledger; this is what makes learnings reviewable across cycles).

   - Fetch the **full commit bodies** of the last 15 prior improve-loop iterations for this
     target (from WORKSPACE; shared object DB):
     `git -C "$WORKSPACE" log --grep="improve-loop: iteration" -n 15 --format="%H%n%s%n%b%n---"`.
     This is a **bulk prefix match** against the literal `improve-loop: iteration` — it
     matches every improve-loop commit. **No number and no em-dash belongs in this
     pattern.** (The per-iteration lookups used elsewhere in the skill,
     `--grep="improve-loop: iteration N —"`, are a *different* pattern and already carry the
     em-dash to stop `iteration 1` matching `10`; do not conflate them. Adding an em-dash
     here would match **zero** commits, since real subjects put a number between `iteration`
     and `—`.)
   - Separately run `git -C "$WORKSPACE" log --oneline -20` for recent history and pass
     it as a pointer for general context.
   - From the 15 bodies, extract a compact, in-memory digest: per iteration, its `Thesis`,
     `Outcome` (explicitly flag any `disproven`), a one-line test-evidence summary, and
     `Notes for next cycle`.
   - **Supplement, don't prefer-git.** Use the git body as the primary source, but for any
     field absent or clearly incomplete in the body — notably commits written before the
     Phase 4 enumerated-body rule, whose bodies are thin prose while the `IMPROVE_LOOP.md`
     Log entry for the same iteration has the structured Thesis/Outcome/Error-signature/Notes
     — supplement that field from the Log. Only if git and the Log *conflict on a factual
     claim* (Thesis or Outcome) do you note the discrepancy in this cycle's Log Notes; mere
     verbosity differences are not a conflict. The Log is already visible to advisors via
     `IMPROVE_LOOP.md`, so they see both sources regardless.
   - Carry this digest forward into Phase 3 (Round 1 and the consolidation guard) and Phase 1
     (selection backstop). It is in-memory for the turn, like `TEST_ARTIFACT_PATHS`; do not
     persist it into `IMPROVE_LOOP.md`.
   - **Bounded lookback:** a thesis disproven more than 15 iterations ago is outside the
     digest and is not guarded; 15 is a pragmatic bound, not a completeness guarantee.

   Pass paths or pointers into agents rather than inlining a large log dump; the digest
   itself is small enough to pass as a compact summary.

### Phase 1 — Execute

Select the next unchecked Backlog item. As a backstop, before selecting, skip any unchecked
item that re-asserts a prior disproven thesis **unless** the item's Backlog-line rationale
explicitly re-opens it with a stated reason (per Phase 3's reason-in-rationale rule). This
catches a disproven re-attempt that survived into the Backlog despite Phase 3's guard. It
reads the same disproven-theses list carried from Phase 0 step 7 (a thesis is "disproven"
only if its most-recent recorded outcome was `disproven`) and judges semantically, not by
substring match.

**Implementation is native by default — this skill does not depend on `codex-worker`.**
Execute the selected item in WORKSPACE using whichever of these is available, in order:

1. **Orchestrator-native (preferred default):** the session running this skill implements or
   investigates the item itself under WORKSPACE.
2. **Fresh generic agent (optional):** dispatch `general-purpose` (or equivalent) with the
   item and pointers to `IMPROVE_LOOP.md` and recent git history (paths/refs, not inlined).
3. **Optional external implementer (never required):** only if the operator or session
   explicitly wants one *and* such an agent is available (e.g. `codex-worker`, Grok rescue,
   or another coding agent). Missing or failing optional implementers **must not** block the
   cycle — fall back to (1) or (2) and note the fallback in the Log.

**Hard rules for every executor path (native or agent):**

- Do **not** commit, do **not** `git add`/stage, and do **not** edit `IMPROVE_LOOP.md` —
  only modify the working tree and report what changed. A commit or stage would bypass this
  cycle's scope check, secret scan, and exactly-one-commit discipline.
- Stay in WORKSPACE (no nested worktree isolation; WORKSPACE already is the campaign tree).
- When the item names an existing skill and the Skill tool is available, use it; otherwise
  read the skill file and do the equivalent work. Do not block on Skill-tool availability.
- If using a subagent, pass `cwd`/paths under WORKSPACE. If it returns a structured scope
  report, honor mismatches: any changed path outside a declared file scope → Log
  `scope violation: <path>…` and set Outcome `blocked` (Phase 4 code-dirty veto applies).
- Optional implementers that support clarify-and-resume may use that protocol **within this
  same Phase 1** (cap two rounds), then return; never thread open questions across cycles.

After the work lands (or the investigation finishes), the executor reports only what it can
know at return time: `WHAT_CHANGED` (paths), `THESIS` (one line), and a *suggested*
`OUTCOME`. It does **not** establish the authoritative STATUS.

- **The orchestrator — not the executor — owns the test run, the STATUS, and the revert.**
  Any subagent has returned and cannot run a post-settle suite or revert later.

- Ground file identity in git, not an LLM report, and capture it **before running the
  test** — otherwise files the *test* creates (coverage reports, snapshots, generated
  fixtures, local caches) would land in the change set and get committed as if they were the
  work. So the moment the executor returns and before the test runs, compute `CHANGED_PATHS`
  as a **set of pathnames** from `git -C "$WORKSPACE" status --porcelain`: strip the
  two-column status code and its following space from each line; for a rename line
  (`R  old -> new`) take the `new` path; unquote any path git quoted (paths with
  spaces/special characters are wrapped in double quotes with C-style escapes). Drop
  `IMPROVE_LOOP.md` (Phase 1 must not edit it; Phase 4 handles it separately). This is the
  executor's change set; anything that becomes dirty *only after* the test run is test
  output and is never staged. Phase 4 stages code paths only from this git-grounded, parsed,
  pre-test set — never from the executor's `WHAT_CHANGED` alone.

- Then the orchestrator (native) runs the recorded test command **exactly once** from
  **WORKSPACE** — even if the executor believes nothing changed. Capture full output to a temp file; keep a tail
  (e.g. last 80 lines) for the Log. From that authoritative run derive `STATUS`
  (`PASS`/`FAIL`) and the `ERROR_SIGNATURE` (`none` on PASS; see Phase 2), and finalize
  `OUTCOME` by reconciling the executor's suggestion against STATUS — e.g. an executor's
  `confirmed` cannot stand if the authoritative run is FAIL. Reconciliation only ever
  downgrades: a `blocked` already set this cycle (a Phase-1 scope violation, or a failed
  revert) is a hard state and is **never** upgraded to `confirmed`/`partial` just because
  the test run is green. `TEST_OUTPUT_TAIL`, `STATUS`, and `ERROR_SIGNATURE` are all products
  of this orchestrator run, not the executor's report. Also downgrade on a **no-op**: if
  STATUS is PASS but `CHANGED_PATHS` is **empty** (the executor landed no code — an
  already-green suite, or an investigation item that touched nothing), a green run does not
  prove a fix, so reconcile `OUTCOME` to `partial`, never `confirmed`. Phase 2 then neither
  checks the item off nor counts the no-op as progress (see the empty-`CHANGED_PATHS` matrix
  row). This is deliberate policy for pure "confirm X is already correct" investigation
  items: they legitimately land zero paths, stay `partial`/unchecked, and must not be
  re-`confirmed` into a check-off on a later cycle.

- **Record this turn's test artifacts — shared rule, applied after *every* orchestrator suite
  run this turn** (here in Phase 1, and again in Phase 3 sub-cases (b) and (c)). Around each
  suite run, snapshot the live tree immediately **before** running it —
  `pre_suite := parse(git -C "$WORKSPACE" status --porcelain)` — then, once it finishes,
  **extend** (never replace) the turn-level set:
  `TEST_ARTIFACT_PATHS += parse(git -C "$WORKSPACE" status --porcelain now) −
  pre_suite − {IMPROVE_LOOP.md}`. Only paths that **became** dirty *during* the suite are
  captured; any dirt that pre-existed the run stays **out** of the set and therefore stays
  subject to Phase 4's veto. Extend on **PASS and FAIL** alike. Do this capture **before** any
  Status/counter/Backlog write that follows the run, so an implementer never mistakes the suite
  for bookkeeping-only. For this Phase 1 run, `pre_suite` is the pre-test snapshot (equivalently
  the executor's pre-test `CHANGED_PATHS`). These captured paths are test-command side effects
  (caches, coverage, snapshots, logs); the shared code-dirty definition (Phase 0 step 4)
  excludes them, so this turn's own guards (Phase 3 post-panel, Phase 4 veto) do not trip on the
  suite's own litter. The set is in-memory only — never written to `IMPROVE_LOOP.md` — so it
  cannot go stale and wrongly mask a real edit on a future cycle. If these artifacts are not
  gitignored they resurface as dirt on the next invocation's fresh Phase 0 guard; after
  committing, if un-ignored artifacts remain, report them and recommend the operator gitignore
  or clean them.

- If STATUS is FAIL and there is nothing further to try this cycle, the orchestrator (the
  executor has already returned) reverts the attempted changes so code is clean before
  Phase 2:

  - For tracked paths, use `git -C "$WORKSPACE" restore --staged --worktree -- <path>`
    (i.e. `git restore -SW`, or `git checkout -- <path>` **after** `git restore --staged`) for
    every path in `CHANGED_PATHS` — a plain `git restore -- <path>`/`git checkout -- <path>`
    only rewrites the worktree and leaves a staged copy behind, so an executor that ran
    `git add` would leave the tree non-clean and trip Phase 4's veto. Restoring staged **and**
    worktree clears both.
  - Explicitly delete untracked files or directories the executor created; restore does not
    remove them. Delete only paths in `CHANGED_PATHS` / `WHAT_CHANGED`, never with a broad
    `git clean -fd`.
  - If reverting fails, leave the tree as-is, set Outcome to `blocked` rather than
    pretending STATUS is a clean FAIL, and still proceed to Phase 2 to log the blocked
    cycle. Do no further execution work this cycle. Phase 4's code-dirty veto refuses to
    commit over abandoned code and Phase 0 step 4 catches the same state next invocation.

### Phase 2 — Learn and deterministic bookkeeping (native)

Append a Log entry from Phase 1's report with `Committed: pending`, or the lightweight
empty-backlog entry defined in Phase 0 step 5. Set the header iteration counter to this
cycle's `N`. Update stop-condition counters using plain comparison and arithmetic, never
by asking an LLM to freehand-edit them. The empty-backlog path holds counters exactly as
specified and does not apply the PASS/partial reset row.

If STATUS was PASS, Outcome was `confirmed`, **and `CHANGED_PATHS` was non-empty** (real
code actually landed this cycle), also mark the Backlog item Phase 1 selected as done:
change its `- [ ]` line to
``- [x] <item text> — done <date> (commit: `git log --grep="improve-loop: iteration N —"`)``,
using this cycle's own `N`. Without this step, Phase 1's "select the next unchecked item"
rule could re-select and re-execute work already implemented and committed in a prior
cycle. Leave the item **unchecked** on FAIL, `disproven`, `blocked`, or `partial` — for
`partial`, progress landed but the item is not fully done, so it stays open for the
Phase 3 panel to refine (the panel may rewrite an unchecked item to reflect what remains)
or for a later cycle to finish; checking a `partial` item off as done risks a premature
`complete` that would end the whole loop before the work actually is.

Use this explicit matrix:

| Test STATUS | Outcome | `consecutive-no-progress` | `consecutive-same-error` |
|---|---|---|---|
| PASS | confirmed / partial, **`CHANGED_PATHS` non-empty** | reset → 0 | reset → 0, signature → none |
| PASS | **`CHANGED_PATHS` empty** (no code landed; reconciled to `partial`) | **+1** (a no-op is not progress) | reset → 0, signature → none |
| PASS | disproven (tests still green but thesis wrong) | +1 | reset → 0 |
| FAIL | any, signature **equals** prior entry's signature | +1 | +1 (keep signature) |
| FAIL | any, signature **differs** from prior (or prior was none) | +1 | reset → 1 with new signature |
| — | blocked (could not run meaningfully) | +1 | hold counter and signature exactly as they were — neither increment nor reset |

**Precedence (evaluate top to bottom; first match wins):**
1. Outcome `blocked` — key it on the **Outcome, not on whether tests ran**: use the blocked
   row whenever Outcome is `blocked` for *any* reason, regardless of STATUS. That covers both
   "tests never ran meaningfully" (missing command, broken environment, executor abort before
   a real suite result, a failed revert that left the tree dirty) *and* the case where tests
   ran green but the cycle is blocked anyway (a Phase-1 scope violation: STATUS PASS, Outcome
   `blocked`). Do not mint a signature from setup noise or from a green run; hold the prior
   signature string and `consecutive-same-error` exactly as they were, while increasing only
   `consecutive-no-progress`.
2. **STATUS PASS with empty `CHANGED_PATHS`** (reconciled to `partial` in Phase 1) — use the
   empty-`CHANGED_PATHS` row: `consecutive-no-progress` **+1** (a green no-op is not progress
   and must **not** reset the stall counter), `consecutive-same-error` reset → 0 / signature
   none. This row is why forcing Outcome to `partial` alone is not enough — without it, the
   generic PASS/partial row would wrongly reset the stall counter and hide a no-op streak.
3. Then the normal PASS/FAIL rows above.
4. Separately, the empty-backlog lightweight path (Phase 0 step 5) holds *both* counters and
   the signature and must not fall through into any PASS/partial reset.

Derive an error signature deterministically. Prefer the first failing test node id or
file+line greppable from `TEST_OUTPUT_TAIL`, using language-agnostic lines matching
`FAIL`, `ERROR`, `Error:`, `failed`, or `AssertionError`. Otherwise use the first 12 hex
characters of the SHA-256 of the last 20 non-empty tail lines. Store the exact string in
the Log's `**Error signature:**` field; the next cycle compares by string equality, not
fuzzy “same-ish” judgment.

### Phase 3 — Advisor Panel and replan

Run this phase on every full cycle that reaches Phase 3, including empty-backlog
lightweight cycles. Ledger-flush turns skip Phases 1–3. The panel is deliberately
multi-model and more expensive every cycle: independent review, native consolidation,
cross-exposure/rebuttal when needed, final consolidation, then a surgical Backlog update.
It prevents an unattended loop from drifting silently.

#### Advisor configuration and non-edit authority

Use a configurable advisor list. Defaults when those Agent types exist:

- `codex:codex-rescue` (optional — omit if unavailable)
- `grok-cc:grok-rescue` (optional — omit if unavailable)

**Advisors are optional.** Zero usable advisors is fine: Consolidation 1's
**native-replanner fallback** still produces a Backlog. Do not hard-fail Phase 3 because
Codex/Grok plugins are missing. Dispatch each available advisor through the **Agent tool**
with the listed `subagent_type`, and let the Agent tool provide concurrency and async — do
not hand-roll background jobs. Thin forwarders return review text as the agent result. They
have full access to WORKSPACE and should see uncommitted diffs and the full `IMPROVE_LOOP.md`
Log (this cycle's Phase 2 entry included). Scope: (a) advisors never edit, (b) consolidation
keeps new Backlog items scoped to the stated target (out-of-scope observations go in Log
Notes). The list may grow or shrink; the mechanism is unchanged.

**Read-only dispatch.** In every advisor prompt, ask for read-only behavior in plain
language: `This is a read-only advisory review. Do not make any edits or run any write
commands. Diagnose and recommend only.` That plain-language request — not a flag you pass —
is what both tools key off, though they honor it differently:

- `codex:codex-rescue` has **no `--read` flag**; its wrapper omits the underlying `--write`
  when the prompt asks for read-only/review/no-edits, so the request above is what makes it
  non-editing. Do not embed `--background`, `--fresh`, or `--resume` tokens: the codex-rescue
  agent treats `--background` as Claude-side-only and **strips it** (so any "poll the job id"
  instruction would never see a job), and a fresh Agent dispatch is already a fresh thread.
  Leave `--effort`/`--model` unset unless the skill user asked for one.
- `grok-cc:grok-rescue` has a real `--read` flag its wrapper adds when the prompt asks for
  read-only. Don't embed `--fresh`/`--worktree`; a new dispatch is already fresh.

The read-only ask is a natural-language heuristic, not a hard sandbox guarantee — the
post-panel tree check further below is the backstop if it ever misfires and an advisor
writes anyway.

#### Budget and usability

Let the **Agent tool own the async** — it runs advisors in the background and returns each
one's text when it finishes, so there is no companion job to poll, no log file to tail, and
no `--background`/`--resume` tokens to pass (the codex-rescue agent strips `--background`
anyway, and a fresh Agent call is already a fresh advisor). Give each advisor round a soft
wall-clock budget of ~**180 s** (a documented skill constant may raise it). "Polling" is
just waiting for the agent to return: if an advisor has not returned usable text within the
budget, or returns an error, mark it **failed for that round** and proceed. Advisor
flakiness — a timeout, a silent death, a resume collision — must never stall the cycle;
continue with whichever advisors responded.

An advisor result is **usable** only when it is non-empty review text that addresses the
ask (not an error stack, not an empty string).

#### Round 1 — independent parallel review

Launch every configured advisor **in parallel — put all the Agent calls in a single
message** so they run concurrently — as a fresh dispatch (never continue a prior cycle's
advisor). Give each the target description; the path to `IMPROVE_LOOP.md`, which already
includes this cycle's Phase 2 entry and counters; the **prior-learnings digest** built in
Phase 0 step 7 (the last 15 iterations' Thesis/Outcome/evidence/Notes extracted from git
history, with any disproven theses highlighted), plus a pointer to general non-improve-loop
history (the `git log --oneline -20` retained for repo context); and this cycle's Phase 1
report, or the lightweight empty-backlog Thesis/Outcome. Pass pointers and paths rather than
inlining all content; each advisor has repository access. Ask independently:

> Does the recent work—and the Backlog's overall direction—still serve the stated purpose?
> What do you recommend next? What risks or concerns exist? Review the learnings from prior
> iterations in the digest. Do not recommend re-attempting a thesis whose most-recent
> recorded outcome was disproven, unless you give a concrete reason the prior disproof does
> not hold (new evidence, changed conditions, or the prior disproof was flawed).

The **native-replanner fallback** (Consolidation 1, below) receives the same inputs as Round
1, so it gets the digest automatically; the disproven-thesis guard below applies to its
candidate identically.

Prefer a structured response with recommended next Backlog bullets, but accept free prose.
Tell every advisor explicitly: any already-`[x]`-checked Backlog item, including the one
just completed this cycle, must be preserved verbatim in a proposed Backlog — never
deleted or unchecked; only unchecked (`- [ ]`) items may be added, reprioritized, or
dropped. Record per advisor its returned text (or failure) **and its Agent id/name** — that
id is how Round 2 resumes that exact advisor.

#### Consolidation 1 — native

Do this synthesis in the orchestrating context, not another dispatch. Identify agreement,
disagreement, and the range of recommendations. If zero advisors produced usable Round-1
text, skip Round 2 and use the **native-replanner fallback** for this cycle only. Give that
single native replanner the same inputs Round 1 received and require a Backlog body only.
Append one line to the latest Log Notes recording the full-panel failure. Do not allow
advisor infrastructure flakiness to stall the loop.

When usable Round-1 advisors show strong agreement—all recommend the same direction, have
no risk disagreement, make the same continue-versus-stop call, and have no material
conflict on next Backlog items—skip Round 2 and treat Consolidation 1 as final. This is a
cost-control early exit, not a change to the panel's purpose. When any risk-level or
direction disagreement exists, Round 2 is mandatory.

#### Round 2 — rebuttal

**Skip Round 2** (treat Consolidation 1 as final) when any of: host has no per-agent resume
tool (`SendMessage` or equivalent), Round 1 already showed strong agreement (above), or
zero usable Round-1 advisors. Do not invent a second full-panel failure from a missing
resume tool — note `Round 2 skipped (no resume tool)` in Notes if that is the reason.

When resume **is** available: for every advisor with usable Round-1 text, **resume that
exact advisor with `SendMessage` to its recorded Agent id** — not a fresh dispatch, and not
a companion `--resume` (which means only "the latest session for this tool/cwd" and can
attach to the wrong session). SendMessage continues the specific Round-1 advisor from its
own transcript. Send it its own Round-1 position plus the Round-1 consolidation, all
advisors in parallel:

> Here's what you said, here's the consolidated view across all advisors—final pass,
> revise or stand by your recommendation.

Apply the same ~180 s budget. Do not resume advisors that failed Round 1. If a Round-2
resume fails or times out (e.g. the underlying tool hits a resume collision), keep that
advisor's Round-1 position, mark it in Consolidation 2 as `no rebuttal (resume failed)`,
and proceed. A Round-2 failure is not a full-panel failure and never triggers the
native-replanner fallback; only zero usable Round-1 text does.

#### Consolidation 2 and surgical apply

Synthesize rebuttal text plus Round-1-only/no-rebuttal positions in the main context. If
advisors still disagree, expose that disagreement in the Backlog rationale rather than
silently choosing a side. Lean conservative when the disagreement is about risk rather
than merely backlog priority.

The final product—Consolidation 2, Consolidation 1 on early exit, or native-replanner
fallback—must be a **Backlog body only**: markdown checklist lines (`- [ ]` or `- [x]`)
with short rationale phrases on the same lines. It must not be a free-form essay or a
whole-file rewrite.

Apply it surgically and natively: replace only the `## Backlog` body through the next
`## ` heading in `IMPROVE_LOOP.md`. Never ask an advisor or fallback replanner to rewrite
the whole file; that can clobber deterministic counters and the append-only Log.

**Disproven-thesis guard (native, before the surgical apply).** Before applying the
candidate Backlog, the orchestrator — the LLM context running this phase, not a subagent —
runs these native steps so the loop does not burn cycles re-trying approaches already shown
not to work:

- Build the **disproven-theses list** from the Phase 0 step 7 digest. Include a thesis
  **only if its most-recent recorded outcome was `disproven`**: scan the digest newest-first,
  and once an iteration addresses a thesis, ignore older outcomes for that same thesis. This
  stops a stale disproven record from blocking a thesis that a later iteration confirmed.
- For each proposed *unchecked* (`- [ ]`) item in the candidate, judge **semantically** —
  not by substring match — whether it re-asserts a thesis on the disproven-theses list, and
  whether its rationale states a concrete reason the prior disproof no longer holds. This is
  a judgment call; a naive substring check would miss paraphrases and must not be used.
- If the item re-asserts a disproven thesis **without** a stated reason: drop or rewrite the
  item and append one line to the latest Log Notes:
  `replanner proposed re-attempt of disproven thesis (iter K): <short> — dropped/rewritten`.
- If the item re-asserts a disproven thesis **with** a stated reason: keep the item and
  **write that reason into the surviving Backlog line's rationale phrase**, e.g.
  `- [ ] <item> — re-opened: <one-line reason prior disproof may not hold>`, so the Phase 1
  selection backstop can detect it.
- This guard operates on **unchecked** items only, so it never conflicts with the rule that
  `[x]` items are preserved verbatim. If the guard drops *every* proposed item, the
  candidate is empty and the validation below fires
  `replan output unusable; Backlog unchanged`; append a clarifying Notes line
  `all proposed items re-asserted disproven theses; Backlog unchanged` so the cause is
  legible (the output was filtered, not unparseable).

Before replacing, validate the candidate contains at least one checklist line matching
`^- \[[ xX]\] ` (accept both `- [x]` and `- [X]`), **or** is an intentional empty-backlog
completion: a clearly stated
explicit `no remaining work` or zero-item complete call. Advisors and the native-replanner
fallback may add, reprioritize, or drop *unchecked* (`- [ ]`) items freely, but must never
delete or uncheck an already-`[x]`-checked item, including the one Phase 2 just checked
off this cycle — the Round-1 prompt above must say so explicitly. If the candidate drops
or unchecks a previously-checked item, restore that entry before applying the rest of the
candidate. Separately, if it is empty, unparseable, or would wipe a formerly non-empty
Backlog without explicit complete/stop rationale, do not apply it at all. Keep the prior
Backlog, append `replan output unusable; Backlog unchanged` to the latest Notes, and let
the terminal test below evaluate only counters; do not invent `complete` from a wiped list.

After the rounds and surgical apply or deliberate non-apply, re-check for code-dirtiness
using the **shared code-dirty definition** (Phase 0 step 4; excludes `IMPROVE_LOOP.md` and
this turn's `TEST_ARTIFACT_PATHS`). Advisors are read-only. If any code path is newly dirty
relative to the post-Phase-1/post-revert baseline and is not already accounted for in this
cycle's PASS `CHANGED_PATHS`, treat it as an infrastructure fault:
do not stage it and append `unexpected dirty paths after advisor panel: …` to Notes. On a
ledger-only turn, Phase 4's code-dirty veto will correctly refuse to commit; on a PASS
turn, leave unexpected paths unstaged so the next invocation's Phase 0 dirty-tree guard
stops. Never fold advisor-side dirt into the cycle commit.

Immediately after surgical apply or deliberate non-apply, and without a subagent, use the
counters Phase 2 already wrote to update Status *in this exact order*:

1. `consecutive-same-error >= 3` → `stopped (same-error ×3)`
2. `consecutive-no-progress >= 3` → `stopped (no-progress ×3)`
3. Backlog has zero unchecked items after replan → `complete`, **but gate it on a green
   suite** — a "tested improvement" loop must never sign off, or record a green result,
   without a green suite. Three sub-cases, by what happened *this* cycle:
   - **(a) A normal PASS cycle that just checked off its last item** (the suite already ran
     and PASSED this cycle, with non-empty `CHANGED_PATHS`): that green run is the
     confirmation → set `complete`.
   - **(b) The empty-backlog / no-execute lightweight path** (suite not run this cycle): run
     the recorded test command once now as the confirmation — snapshot `pre_suite` immediately
     before it and **extend `TEST_ARTIFACT_PATHS`** immediately after (Phase 1's shared capture
     rule), *before* the Phase 4 veto, so the confirmation suite's own litter is not mistaken
     for abandoned dirt (this path has no clean-tree precondition, so a live `pre_suite`
     snapshot — not a hard-coded empty set — is what keeps any pre-existing dirt subject to the
     veto). PASS → `complete`. FAIL → do
     **not** complete: leave Status `active`; append one unchecked item (`- [ ] fix
     regression surfaced by completion check: <short error>`); **correct this cycle's
     not-yet-committed lightweight entry in place** (the Phase-3 completion-gate exception):
     rewrite `Test result` → `FAIL`, `Outcome` → `blocked`, `Error signature` → the real
     signature (Phase 2 derivation). The lightweight Phase 2 *held* the counters, so **apply
     the completion-gate counter rule now, once, here in Phase 3** (do not re-enter Phase 2's
     matrix): `consecutive-no-progress` **+1**; set `consecutive-same-error` by **FAIL-row
     semantics** — if the new signature **equals** the prior entry's signature → +1, else →
     reset to 1 with the new signature. Do **not** use the blocked-row "hold signature
     `none`" here: holding `none` would never let repeated completion-gate failures trip a
     same-error stop.
   - **(c) A FAIL cycle whose revert succeeded and whose replan emptied the Backlog** (STATUS
     was FAIL this cycle, the tree is **not** code-dirty under the shared definition in
     Phase 0, and zero unchecked items remain after replan): run the recorded test command
     once now on the reverted baseline as the confirmation (same shared capture rule — snapshot
     `pre_suite` before, extend `TEST_ARTIFACT_PATHS` after). PASS → `complete`, and do **not**
     reset the counters — this cycle's FAIL already `+1`'d `consecutive-no-progress`, which is
     the honest record that no fix landed. FAIL → leave Status `active`, append the same
     failure Backlog item, add a Notes line with the confirmation tail, and do **not** apply
     case (b)'s counter package — this entry was already FAIL-scored in Phase 2, so re-scoring
     would double-count. **Precondition:** if the revert failed, Outcome is `blocked`, or the
     tree is code-dirty, do **not** complete here — leave it to Phase 4's code-dirty veto and
     Phase 0's next-invocation guard.
4. Otherwise leave Status `active`.

Advisors never edit counters, so a panel that wants to continue cannot override a counter
stop. The order matters: every FAIL increments no-progress, so three identical FAILs reach
both thresholds together; checking same-error first preserves the more specific reason.
Update Status before Phase 4 so the terminal note is in the same commit as the cycle.

### Phase 4 — Commit (native)

Attempt exactly one commit for a cycle, or for a ledger-flush turn that reaches this phase
with a writable tree, unless the code-dirty veto below fires. Pure bookkeeping cycles still
touch `IMPROVE_LOOP.md` when permitted. **Terminal cycles** (`complete` or `stopped (...)`)
still use that single commit: archive the full ledger in the **commit message body** and
**remove** `IMPROVE_LOOP.md` from the tree in the same commit (see staging and body rules
below). No second clear commit.

- Use this cycle's Log iteration number for `N`: the number just written in Phase 2 for a
  normal cycle, including empty-backlog lightweight Phase 2; or the latest existing entry's
  number for a Phase-0 step-4 ledger flush. Never use `count + 1` on a flush, which would
  orphan the greppable marker from the existing Log heading.

- Apply the **code-dirty veto before staging**. Classify a turn with the same staging rule
  below. A **ledger-only** turn stages only the resume-file path (an add/modify of
  `IMPROVE_LOOP.md` when Status is `active`, or a **deletion** of `IMPROVE_LOOP.md` when
  Status is terminal): STATUS is not PASS, **or Outcome is `blocked`** (even when STATUS is
  PASS — e.g. a scope violation caught in Phase 1 leaves green tests but an untrusted
  diff), or STATUS is PASS but `CHANGED_PATHS` is empty, or it is a Phase-0 ledger flush or
  an empty-backlog replan. A **non-ledger-only** turn is STATUS PASS **and Outcome not
  `blocked`** with a non-empty post-Phase-1 `CHANGED_PATHS` intersection that remains dirty.
  Those code paths should be dirty and must not be vetoed. (Making `Outcome: blocked` always
  ledger-only is what routes a blocked-with-dirty-code cycle — scope violation, or a failed
  FAIL revert — into the veto below instead of silently committing the untrusted diff on a
  green test run.)

  - On a ledger-only turn, re-check code dirtiness using the **shared code-dirty definition**
    (Phase 0 step 4; excludes `IMPROVE_LOOP.md` and this turn's `TEST_ARTIFACT_PATHS`). If any
    code path is dirty, do not commit anything. Leave all files as-is, including Phase 2/3 state edits. Set the
    latest Log entry to
    `Committed: no — code-dirty veto (refused ledger-only commit over dirty code)` and
    append one Notes line. This correction stays uncommitted. Do not set `Committed: yes`
    and do not perform commit-fail counter correction: no commit was attempted, and Phase
    2 already scored the cycle (blocked used the blocked row; empty-backlog held counters).
    Stop and report. The next invocation's Phase 0 step 4 handles this as not-landed plus
    code-dirty. Do not race past it with a clean-looking ledger commit over abandoned code.
  - On a non-ledger-only turn, skip this veto and stage code paths as below. Unexpected
    extra dirty files outside `CHANGED_PATHS` remain unstaged for the next cycle's Phase-0
    dirty-tree guard.

- **Commit procedure — fixed order (do not reorder).** This loop commits unattended. Secret
  patterns: `AKIA[0-9A-Z]{16}`, `ghp_[A-Za-z0-9]{36}`, `sk-[A-Za-z0-9]{20,}`,
  `AIza[0-9A-Za-z_-]{35}`, `-----BEGIN [A-Z ]*PRIVATE KEY-----`, and similar.

  1. **Pre-commit `Committed: yes`.** Set the latest Log entry's `Committed:` to `yes` in
     the on-disk file (narrow append-only exception). Skip when the code-dirty veto already
     wrote `Committed: no`. Leave the file on disk until step 5 succeeds.
  2. **Snapshot.** Read the full final `IMPROVE_LOOP.md` text into memory (`LEDGER_SNAPSHOT`).
     Required for terminal archive and for commit-fail restore.
  3. **Compose the commit body** (subject/body rules below). For terminal Status, append the
     full-ledger archive block using `LEDGER_SNAPSHOT`.
  4. **Secret-scan before staging.** Scan (a) every code path that will be staged from
     `CHANGED_PATHS` (if any), (b) `LEDGER_SNAPSHOT` (covers the resume file whether it will
     be added or deleted), and (c) the **composed commit-message body string**. On a match:
     set `Committed: no — secret-shaped string detected in <path|commit message>`, append
     Notes, leave the file on disk, do **not** `git rm`, stop and report. Do not attempt
     commit.
  5. **Stage explicit paths only under WORKSPACE — never `git add -A` / `add .`.**
     - **Non-terminal (Status `active`):** `git -C "$WORKSPACE" add -- IMPROVE_LOOP.md`.
       Also, when STATUS is PASS, Outcome is not `blocked`, and `CHANGED_PATHS` is non-empty,
       add the still-dirty code paths from `CHANGED_PATHS`.
     - **Terminal (`complete` or `stopped (...)`):**
       `git -C "$WORKSPACE" rm -- IMPROVE_LOOP.md` if tracked; if untracked, delete the
       file and do not add it. Also add still-dirty code paths from `CHANGED_PATHS` when
       STATUS is PASS, Outcome is not `blocked`, and that set is non-empty. A ledger-only
       terminal commit may stage **only** the deletion of `IMPROVE_LOOP.md` (not a re-add of
       its contents).
  6. **Commit once on the campaign branch:**
     `git -C "$WORKSPACE" commit -m "improve-loop: iteration N — <summary>" -m "<body>"`.
     Record success in-memory for Phase 5 (`PHASE4_COMMIT_OK=true`, this cycle's `N`).
     (Crash before Phase 5 after a terminal commit: Phase 0 step 2 recovers from the archive
     in the commit body.)

- The subject is always `improve-loop: iteration N — <summary>` — the em-dash marker after
  `N` is load-bearing (grep lookups depend on it). The **body** must contain **every** of the
  following (ordinary prose, may use short labeled lines) — these are the key learnings and
  none is droppable; this is what makes learnings and disproven theses reviewable in git
  history, and what the next cycle's Phase 0 step 7 digest reads back. **Both a proven
  (confirmed) thesis and a disproven thesis are valuable learnings and must always be
  recorded** — a disproven / negative result (an approach that was tried and shown not to
  work, and why) is exactly what stops a future cycle from wasting effort re-attempting it,
  so never omit or minimize it; it is not a failure to hide but a result to bank.

  - **Thesis** — what was tried and why (from the Log `Thesis`); state it whether it was
    ultimately proven or disproven.
  - **Outcome** — `confirmed` / `disproven` / `partial` / `blocked`; for `disproven`, state
    what the disproof showed (the evidence that the thesis was wrong) — this negative result
    is a first-class learning, not an omission.
  - **Test evidence** — STATUS plus a one- or two-line summary of the suite result; the
    `Error signature` on FAIL.
  - **What landed** — `CHANGED_PATHS`, or `no code landed` for a no-op / ledger-only cycle.
  - **Advisor consolidation** — Phase 3's key agreements, disagreements/risks, and the
    chosen next direction. **Every cycle that runs Phase 3 has a real panel**, including
    empty-backlog lightweight cycles (the skill runs Phase 3 on those too) — record their
    consolidation. Only a **ledger flush** has no panel; for that one case write
    `no panel this cycle (ledger flush)` plus a one-line rationale. Never write
    `no panel this cycle` for an empty-backlog lightweight cycle — that would drop its real
    advisor consolidation.
  - **Notes for next cycle** — the Log `Notes for next cycle` field, verbatim or closely
    paraphrased.
  - **Stop-condition state** — `consecutive-no-progress` / `consecutive-same-error` values
    after this cycle, and any terminal `Status` set this cycle.
  - **Full ledger archive (terminal commits only)** — when Status is `complete` or
    `stopped (...)`, append the verbatim `LEDGER_SNAPSHOT` under fixed delimiters
    (required; this is the durable campaign archive once the file is removed):

    ```
    --- full IMPROVE_LOOP.md (terminal archive) ---
    <LEDGER_SNAPSHOT as of pre-commit Committed: yes>
    --- end IMPROVE_LOOP.md ---
    ```

    Non-terminal commits must **not** include this block (the file remains the resume surface).

  Only a **pure ledger flush** (which has no panel) may use a short summary such as
  `ledger flush after interrupt`. An **empty-backlog replan has a real panel**, so its body
  still records the Advisor consolidation field like any normal cycle; its summary line may
  prefix `empty-backlog replan → complete|reopened` but must still carry the panel
  consolidation and a one-line rationale. Even a ledger-flush short-form body must carry a
  one-line rationale so the learning is still reviewable. A terminal empty-backlog or
  ledger-flush that sets Status terminal still must include the full-ledger archive block
  and remove the file.

- If `git commit` fails or is interrupted—hook rejection, lock contention, an empty commit,
  or otherwise—do not treat the cycle as successful. **Restore first if a terminal `git rm`
  already ran or the worktree file is missing:**
  `git -C "$WORKSPACE" restore --staged --worktree -- IMPROVE_LOOP.md` when git still
  knows the path; if that cannot recreate the file, rewrite
  `$WORKSPACE/IMPROVE_LOOP.md` from `LEDGER_SNAPSHOT`. Then correct the latest Log entry
  to `Committed: no — <raw error>` and append the raw failure to Notes. Leave this
  correction uncommitted. Never leave a successful-looking terminal deletion without a
  commit object.

  Apply the commit-fail counter correction natively, but do not re-score the whole cycle:
  increase `consecutive-no-progress` by one **only if Phase 2 reset it to 0 this cycle**.
  That is PASS + confirmed/partial **with non-empty `CHANGED_PATHS`** only. Do not increase it
  for PASS + disproven or for PASS with **empty `CHANGED_PATHS`** (both already `+1`'d
  no-progress and did not reset), and do not do it for empty-backlog lightweight Phase 2, which
  held counters. Do not change `consecutive-same-error` or the signature: a commit or hook
  failure is not a test error. On a ledger flush with no Phase 2 this turn, skip this
  correction. Never use it for the code-dirty veto, which never attempts `git commit`.
  Do not invent a second commit attempt in the same cycle.

- If STATUS is PASS and the only staged change is a no-op on `IMPROVE_LOOP.md` with no
  content change (active path only), that should not happen after Phase 2/3; if git reports
  `nothing to commit`, handle it as the commit failure above. A terminal deletion is always
  a real change and must not be treated as a no-op.

### Phase 5 — Outer signal + **merge-back (end of campaign only)**

Apply the **Outer goal protocol**. Land first; merge-back second and best-effort; never merge
mid-campaign.

**GOAL_MODE:** an outer `/goal` is active. If the `update_goal` tool exists, use it for
complete/progress. Else (Claude goal without that tool): state objective met in prose and
stop further improve cycles. Standalone `/improve` → report only. Ambiguous → treat as
standalone (never false-complete).

| Condition | Action |
|---|---|
| Terminal + landed | Report + merge-back; if GOAL_MODE → **complete** (include Status + `merge-back: ok\|blocked`) |
| Terminal + not landed | Report failure/veto; **do not** complete |
| Active after cycle | Report; optional short progress if GOAL_MODE; **do not** complete |
| Dirty/veto before Phase 5 | Report only (never invent terminal Status over dirty code) |

`stopped (...)` and `complete` are both **finished campaigns** once landed — complete the
goal with the reason so multi-cycle does not re-open forever.

**Same-turn landed** (resume file may already be gone after terminal archive) iff:

1. Status is `complete` or `stopped (...)`,
2. `PHASE4_COMMIT_OK=true` (or prior land via leftover/short-circuit), and
3. `git -C "$WORKSPACE" log --grep="improve-loop: iteration N —" -n 1` finds the commit.

- **Terminal + landed → merge-back once (best-effort):**
  1. `launch_branch` null → skip FF; pointer `reintegrate_blocked`; keep WORKSPACE.
  2. Else require LAUNCH clean (`status --porcelain` empty); checkout `launch_branch` if needed.
  3. `git -C "$LAUNCH" merge --ff-only "$campaign_branch"`.
  4. **ok:** worktree remove → `branch -d` → delete POINTER. Report `merge-back: ok`.
  5. **fail:** pointer `reintegrate_blocked` + error; leave WORKSPACE; print the FF command.
     Report `merge-back: blocked`. Still complete goal if GOAL_MODE (land is durable).
  Teardown order fixed: FF → remove worktree → delete branch → delete pointer. Never
  delete the campaign branch before a successful FF.

- **Merge-back-only** (`reintegrate_blocked` or re-invoke after land with no ledger): no
  Phases 1–4; retry merge-back on the same worktree. Success clears pointer (post-goal cleanup
  if goal already completed on land).

- **Active:** end turn; pointer stays `active`; resume via pointer next turn. Under multi-cycle
  goal: **one improve cycle per assistant turn**.

## Multi-cycle: `/goal`

One `/improve` = one cycle. Multi-cycle = outer **`/goal`** (at most one cycle per turn).
**Do not** wrap improve-loop in ralph-loop as the primary multi-cycle driver — that path is
deprecated for this skill (promise tags, `.claude/ralph-loop.local.md`). Sibling skill
`grok-review-converge` still documents ralph as an *optional* legacy outer quota; improve-loop
does not.

```
/goal Run improve-loop for target: <TARGET> in repo: <TARGET_REPO_PATH> with test command: <CMD>.
Each turn: /improve once (or short-circuit / ledger-flush / merge-back-only / migrate-or-discard).
One worktree via $(git -C <TARGET_REPO> rev-parse --git-common-dir)/improve-loop/active.json.
Done when Status terminal AND iteration commit landed (merge-back optional).
```

**Unattended hard caps (host, not this skill):**
- Claude: `claude -p "/goal …" --max-turns N --max-budget-usd $` (keep `N` modest — advisors cost).
- Grok (or any host with goal mode): open `/goal` with the same objective and enforce
  session **max-turns / max-budget** (or Esc). Signal completion only via Phase 5
  (`update_goal` when the tool exists; else prose “objective met” and stop further improve
  cycles). Never emit ralph promise tags from this skill.

Seed **target + target repo path + test command** in the objective. Merge-back left blocked →
re-invoke improve (merge-back-only) or a separate merge goal.

This skill makes no assumptions about language, layout, or test framework — always use the
recorded test command.
