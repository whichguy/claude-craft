---
name: improve-loop
description: >-
  Run a worktree-isolated improvement campaign until terminal, then emit one end report:
  default is autonomous multi-cycle in a single invoke (execute, test, learn, multi-model
  replan, commit, loop). Use --once for a single gated cycle. Invoke for "/improve <target>",
  "/improve --once <target>", "/claudecraft:improve-loop <target>", "/improve-loop <target>",
  "improve this project iteratively", or "run a tested improvement cycle".
---

# Improve loop

## Campaign architecture (logical separation)

| Layer | Owns | Does not own |
|---|---|---|
| **L0 `/goal` (host, optional)** | Session visibility; max-turns/budget if operator opens goal | Multi-cycle engine (not required for autonomy) |
| **L1 Entry (`/improve`)** | Resolve target; **campaign driver** (default: loop L2 until terminal/cap/block); end report | Phase internals of a single cycle |
| **L2 Cycle kernel (Phases 0–5)** | One gated cycle: execute → test → learn → replan → commit → signal | Multi-cycle iteration (L1 owns the loop) |
| **L3 Scripts** (`scripts/`) | Shell probe, worktree enter, pointer RMW, ledger-status, merge-back | Advisor judgment, thesis prose |

```text
/improve <target>                    # default: autonomous campaign
  → L1 resolve TARGET/REPO/CMD + mode (autonomous | once)
  → loop (autonomous) or once:
      L3 shell-probe + worktree-enter  → WORKSPACE
      L2 one cycle (Phases 0–5)
      active + autonomous + under caps → continue loop (do NOT stop for user)
      terminal+landed → merge-back → exit loop
      blocked / max-cycles → exit loop
  → L1 Campaign report (once)
```

**Default: one campaign per invocation** — L1 loops L2 until Status is terminal **and** the
iteration commit landed, or until a hard stop / cap. **`--once`:** exactly one L2 cycle
(debug / step-through). L2 itself never self-loops inside Phases 0–5 — **one L2 cycle per
loop iteration**. Cap: `MAX_CYCLES` default **8** (env `IMPROVE_LOOP_MAX_CYCLES`).

**Do not** wrap improve-loop in ralph-loop as the primary multi-cycle driver. **Do not** stop
after the first `active` cycle waiting for the user when mode is autonomous.

**Workspace rule (non-negotiable):** For the duration of **one `/improve` invoke**, all
campaign edits live in **one ephemeral worktree** on `improve/<slug>` under
`LAUNCH/.worktrees/`. Launch is read-only mid-run. Merge-back once at end (terminal land).

**Self-contained cycles (product default):** Each L2 cycle is self-contained. **Git commit
bodies are the durable ledger** (Thesis/Outcome/Notes/Next backlog). There is **no
cross-invoke resume** by default: entry **discards stale** pointer/worktree, then cold-starts.
In-session multi-cycle reuses the **same invoke’s** worktree only. Opt-in crash recovery:
`--resume` on `worktree-enter` / invocation. Optional ephemeral `IMPROVE_LOOP.md` during a
run for advisors — never the recovery surface.

**Package paths** (resolve relative to this skill directory):

```text
SKILL_DIR/references/goal-objective.template.md   # optional host /goal body
SKILL_DIR/scripts/shell-probe.sh
SKILL_DIR/scripts/worktree-enter.js
SKILL_DIR/scripts/campaign-teardown.js
SKILL_DIR/scripts/pointer.js
SKILL_DIR/scripts/ledger-status.js
SKILL_DIR/scripts/merge-back.js
SKILL_DIR/scripts/contract-check.js
```

**Outer goal protocol (optional host signal):** Only **Phase 5** / L1 may call `update_goal`
(progress each cycle, `completed` only on terminal+landed when a goal is Active). Phases 0–4
never claim the objective is met. Host `/goal` is **optional observability** — multi-cycle
does **not** depend on host re-drive. On stop/veto: report; do not false-complete.

### L1 — Campaign driver (before Phase 0 work)

After resolving `TARGET` / `TARGET_REPO` / test command (see Invocation):

1. **Capture home cwd:** `ORIGINAL_CWD` = absolute path of the host shell CWD at entry
   (`/bin/pwd -P` or equivalent). This is often a **different** repo than the target (e.g.
   Grok Build opened in `c-thru` while improving `backchain`). Never assume session cwd is
   `TARGET_REPO`.
2. **Enter destination repo (durable sticky):** once `TARGET_REPO` is known and exists,
   outer sticky CWD **must** become the target checkout root for the whole campaign:
   `cd "$TARGET_REPO"` (or `LAUNCH` once known — same durable tree). Prefer running shell
   work **from that repo** so relative paths (`make test`, `git status`, fixture paths) are
   not ambiguous with the Grok session repo. Still use absolute `SKILL_DIR` / `--repo` /
   `git -C` when the path is not under the current sticky root.
3. **Mode:** `autonomous` (default) unless the invocation has `--once` / `once` / “single cycle”
   / “one cycle only” → then `once`.
4. **Caps:** `MAX_CYCLES` = env `IMPROVE_LOOP_MAX_CYCLES` if a positive integer, else **8**.
   Also honor ledger stop counters (no-progress ×3, same-error ×3 → Status stopped inside L2).
5. **Optional host goal:** if a compatible improve `/goal` is already Active, or `update_goal`
   works, best-effort progress/complete signaling. **Do not wait** for host re-drive. Do not
   require opening `/goal` to multi-cycle.
6. **Driver loop:**
   - `cycle_count = 0`
   - **loop:**
     - If `cycle_count >= MAX_CYCLES` → exit with Result `capped (max-cycles)`; do not start
       another L2 cycle.
     - Run **exactly one L2 cycle** (Phases 0–5). Increment `cycle_count` when a full or
       short-circuit cycle was attempted (including ledger-flush / merge-back-only).
     - If blocked (shell unavailable, launch/worktree dirty, secret veto, commit failed with
       unclean stop, ambiguous repo, …) → **exit loop** (no thrash).
     - If terminal Status **and** iteration landed → Phase 5 merge-back already ran (or run
       it) → **exit loop**.
     - If `once` mode → **exit loop** after this cycle (even if Status still `active`).
     - If Status still `active` and mode is **autonomous** → **immediately run another L2
       cycle** — **DO NOT stop for the user**, do not ask “continue?”, do not end the turn.
7. **When the loop exits:** emit the **Campaign report** once (see Status reporting). Optional
   `update_goal(completed: true)` only if terminal+landed and a goal is Active (ignore tool
   errors if goal was never Active).
8. **Always teardown isolation for this invoke:**
   - Terminal+landed → `merge-back.js` (FF + worktree/branch/pointer remove).
   - Blocked / capped / fail → `campaign-teardown.js --repo "$TARGET_REPO"` best-effort
     (no FF; clear pointer + remove worktree/branch so next `/improve` is clean).
9. **Homecoming:** `cd "$ORIGINAL_CWD"` when it still exists; else leave sticky on
   `TARGET_REPO`/`LAUNCH`. Never leave sticky under deleted `.worktrees/*`.

Never emit ralph promise tags. Never bare-`cd` the host into `.worktrees/*`.

## Shell CWD discipline (mandatory)

Grok local sessions (≥0.2.102) **keep the current directory across** `run_terminal_command`
calls. Two hazards:

1. **Wrong-repo stickiness:** session opens in repo A (Grok Build cwd) while `/improve`
   targets skill/repo B elsewhere — relative `make`/`git`/`test` silently hit A.
2. **Dead worktree stickiness:** sticky CWD under a later-deleted `.worktrees/<slug>` → bare
   ENOENT on every spawn while file tools still work.

### Pin destination, not session cwd

| Path | Role | Outer sticky CWD? |
|---|---|---|
| `ORIGINAL_CWD` | Where Grok was when `/improve` started (save at L1 entry) | Only **after** campaign exit (homecoming) |
| `TARGET_REPO` / `LAUNCH` | Destination git root for the improve target | **Yes — for the whole campaign** after resolve |
| `WORKSPACE` | Disposable campaign worktree under `LAUNCH/.worktrees/` | **Never** as outer sticky |
| `SKILL_DIR` | improve-loop package (may be under `~/.claude/skills/…`) | Never required as sticky; always absolute |

**Mandatory order:**

1. Save `ORIGINAL_CWD` (absolute, preferably physical/`pwd -P`).
2. Resolve `TARGET_REPO` (Invocation). If it differs from session cwd, treat that as expected —
   **do not** run campaign ops from the Grok Build repo by accident.
3. Outer sticky: `cd "$TARGET_REPO"` (or `LAUNCH` once known). Mid-campaign host sticky stays
   on that durable root.
4. Worktree ops: **subshell only** — `(cd "$WORKSPACE" && …)` or `git -C "$WORKSPACE"` /
   `make -C "$WORKSPACE"`. Never bare outer `cd "$WORKSPACE"`.
5. After merge-back / teardown: sticky on `suggested_cwd`/`LAUNCH`/`TARGET_REPO` briefly if
   needed, then **homecoming** `cd "$ORIGINAL_CWD"` when L1 exits (path must still exist).
6. Spawn ENOENT before any output → hard-stop `shell unavailable`; operator restarts Grok from
   a real path.

### Command priority (during campaign, sticky already on TARGET_REPO/LAUNCH)

1. Prefer commands that are correct **from the destination root** (relative product paths).
2. Still use absolute paths for anything outside that root (`SKILL_DIR`, other repos).
3. Always `git -C "$WORKSPACE"` / `git -C "$LAUNCH"` when both trees matter.
4. Temporary WORKSPACE only via subshell `(cd "$WORKSPACE" && …)`.

**Disallowed:** outer sticky under `.worktrees/*`; leaving sticky on TARGET after exit without
attempting restore to `ORIGINAL_CWD`; assuming relative paths refer to the Grok session repo
when `TARGET_REPO` is different.

**pushd/popd:** non-preferred. Prefer explicit `ORIGINAL_CWD` + outer `cd` for durable moves,
subshells for WORKSPACE. **Subshells cannot heal an already-dead sticky CWD.**

## Status reporting (user-facing — mandatory)

Operators must always know **where** the campaign lives, **which phase** is running, and
**what to do next** — including after short-circuits. Do **not** bury status in tool noise
or end with only a commit hash. Emit the blocks below as plain markdown the user can scan
in chat (emoji optional; keep labels stable so grepping logs works).

### Live phase banner (every phase entry)

When entering a phase (or a Phase 0 short-circuit branch), print **one** short line first:

```text
▸ improve · Phase <0–5 | short-circuit name> · <one-line action>
```

Examples:

```text
▸ improve · Phase 0 · cold-start worktree improve/backchain-skill-…-a1b2c3
▸ improve · Phase 0 · resume WORKSPACE (pointer active)
▸ improve · Phase 0 · migrate-or-discard (legacy launch ledger)
▸ improve · Phase 0 · short-circuit: ledger-flush (not landed, clean tree)
▸ improve · Phase 1 · execute: <first 80 chars of backlog item>
▸ improve · Phase 1 · test: `make test-fast`
▸ improve · Phase 3 · advisors: Round 1 (codex + grok) | native-only
▸ improve · Phase 4 · commit improve-loop: iteration 3 — …
▸ improve · Phase 5 · merge-back ff-only → main
```

On any hard stop / veto, print immediately:

```text
▸ improve · STOP · <reason code> — <one human sentence>
```

Reason codes (use these strings when they apply): `shell unavailable`,
`ambiguous target repo`, `no test command`, `legacy tracked ledger`,
`launch code-dirty`, `worktree code-dirty`, `code-dirty veto`, `secret veto`,
`commit failed`, `reintegrate_blocked`, `scope violation`.

### Kickoff card (once Phase 0 has resolved WORKSPACE — or on early STOP)

```markdown
### 🔄 Improve · kickoff
| | |
|---|---|
| **Target** | <plain-language target> |
| **Repo** | `<TARGET_REPO>` |
| **Mode** | cold-start \| resume \| migrate \| discard → cold-start \| merge-back-only \| short-circuit |
| **Launch** | `<LAUNCH>` · branch `<launch_branch\|detached>` |
| **Workspace** | `<WORKSPACE>` |
| **Campaign branch** | `improve/<slug>` |
| **Pointer** | `<POINTER>` · state `active\|reintegrate_blocked` |
| **Test command** | `<cmd>` |
| **Iteration N** | <n or — if not yet allocated> |
| **Backlog open** | <count> · next: <short item or _(empty)_> |
| **Driver** | autonomous \| once |
| **Max cycles** | <MAX_CYCLES> |
| **Session cwd (home)** | `<ORIGINAL_CWD>` |
| **Sticky during campaign** | `<TARGET_REPO>` / `<LAUNCH>` (not WORKSPACE, not Grok session if different) |
| **Outer goal** | yes \| no (optional) |
```

If Phase 0 stops before WORKSPACE exists, still emit this card with Mode = stop and fill
only the fields you know; put the STOP reason in a final **Blocker** row.

### Mid-cycle beats (concise)

- **Phase 1 select:** one line: item + why (or `empty-backlog · no Phase 1 execute`).
- **After test:** `Test · PASS|FAIL` + ≤2-line summary (or first error signature).
- **Phase 3:** `Advisors · usable K/M` + `Round 2 · yes|skipped (<why>)` + one-line
  replan direction (or `Backlog unchanged`).
- **Phase 4:** `Commit · yes <short-sha> · subject` **or** `Commit · no — <reason>`.

Do not paste full suite logs into chat; keep tails for the ledger only.

### Closing card (Phase 5 — `--once` mode, or mid-run optional)

In **`--once`** mode, end the invoke with this card (including stops/vetoes). In
**autonomous** mode, prefer one-line mid-cycle progress only; the full end artifact is the
**Campaign report** (below). You may still emit a brief cycle line after each L2 cycle.

```markdown
### ✅ Improve · cycle result
| | |
|---|---|
| **Result** | active · continue \| complete · done \| stopped (<reason>) \| blocked (<reason>) |
| **Iteration** | N=<n> · Outcome `confirmed\|disproven\|partial\|blocked` · Test `PASS\|FAIL\|n/a` |
| **Thesis** | <one line> |
| **What landed** | <paths or _no code_> |
| **Commit** | `yes` `<short-sha>` · `improve-loop: iteration N — …` **or** `no — <reason>` |
| **Status (ledger)** | `active\|complete\|stopped (…)` |
| **Stop counters** | no-progress=<i> · same-error=<j> · sig=`<none\|…>` |
| **Backlog** | open <k> · checked this cycle <list or —> |
| **Advisors** | <who responded / native-only / skipped> |
| **Merge-back** | n/a (still active) \| ok → main \| blocked · run: `git -C <LAUNCH> merge --ff-only <branch>` |
| **Workspace** | `<WORKSPACE>` (kept) \| removed after merge-back |
| **Pointer** | `active` \| `reintegrate_blocked` \| deleted |
| **Next** | autonomous+active: L1 continues next L2 cycle now · once+active: re-invoke `/improve` or drop `--once` · terminal: done · blocked (shell unavailable): quit Grok, `cd` to a real repo path, restart, `/bin/pwd` probe, re-invoke · other blocked: <operator action> |
```

### Campaign report (mandatory when L1 driver exits)

Emit **once** when the L1 campaign driver exits (autonomous or once-after-terminal, or any
block/cap). Do not omit.

```markdown
### 📋 Improve · campaign report
| | |
|---|---|
| **Target** | <plain-language target> |
| **Repo** | `<TARGET_REPO>` |
| **Result** | complete \| stopped (<reason>) \| blocked (<reason>) \| capped (max-cycles) \| once-active |
| **Cycles run** | <K> (iterations <first N>–<last N> or short-circuits) |
| **Commits** | `<sha>` · <subject> (one line each, or _none_) |
| **What landed** | <union of paths or ledger-only / no code> |
| **Final Status** | `complete\|stopped (…)\|active\|—` |
| **Merge-back** | ok → <branch> \| blocked · `<cmd>` \| n/a |
| **Workspace** | removed \| kept at `<path>` |
| **Pointer** | cleared \| active \| reintegrate_blocked |
| **Stop counters (last)** | no-progress=<i> · same-error=<j> |
| **Backlog at end** | open <k> · … |
| **Test command** | `<cmd>` · last `PASS\|FAIL\|n/a` |
| **CWD homecoming** | restored `<ORIGINAL_CWD>` \| left on `<TARGET_REPO>` (home missing) \| n/a |
| **Next** | done \| <operator action> |
```

**Learnings** (3–8 bullets): distill from this run’s iteration commit bodies / Log Notes;
call out any `disproven` theses.

Tone: confident, scannable, no filler. Prefer tables over walls of prose. When Result is
`blocked` or `stopped`, **Next** must be a concrete operator action (not “try again” alone).

### Progress line (autonomous, each L2 cycle)

After each successful active cycle under autonomous mode, emit one line (and best-effort
`update_goal(message: …)` if a goal is Active):

```text
improve iter N active · open backlog <k> · commit <short-sha|none> · cycle K/MAX · continuing
```

Only L1/Phase 5 may call `update_goal(completed: true, …)` (terminal + landed, goal Active).

## Invocation

```
/improve <target, described in plain language>
/improve --once <target>
```

Also: `/improve-loop`, `/claudecraft:improve-loop` (plugin namespace). Examples:
`/improve "error handling in scripts/ingest.py, tests via pytest"` (autonomous campaign);
`/improve --once "…"` (single L2 cycle).

**Flags:** `--once` / word `once` in the same turn → single cycle. Cap override: env
`IMPROVE_LOOP_MAX_CYCLES` (positive int; default 8). Test command: reuse from invocation,
goal objective, pointer, or existing ledger. If still missing — **interactive:** ask once;
**cannot ask** (headless / unattended): `Status: stopped (no test command)`, write a Log
entry (Thesis `no test command supplied…`, Outcome `blocked`, `Committed: pending`), Phase 4
land (ledger-only), Phase 5. Prefer seeding the command in the goal objective or invocation.

**Target repository (do not assume session cwd is the campaign repo).** Resolve the **target
repo root** before Phase 0 step 1a when any of these apply:
1. The invocation names an absolute path under a git checkout.
2. The target names a skill or project with a known path (e.g. `backchain skill` →
   `$HOME/src/backchain` or the path from install docs / user context) — often **outside**
   the Grok Build session cwd.
3. The goal objective names a repo path.
Otherwise default to `git rev-parse --show-toplevel` from the current tool cwd.
All of COMMON_GIT / LAUNCH / INVOKE_ROOT / POINTER / worktree creation use that **target
repo root**, not an unrelated session workspace. If resolution is ambiguous, **interactive:**
ask once; **unattended:** `Status: stopped (ambiguous target repo)`, ledger-only if a WORKSPACE
already exists, else report only.

**Session vs destination conflict:** when `ORIGINAL_CWD` and `TARGET_REPO` differ, the
campaign sticky CWD and product-relative commands must use **TARGET_REPO**, not the Grok
Build tree. L1 still returns to `ORIGINAL_CWD` at exit.

**Test command for skill/doc-only targets.** When the change set is a skill or markdown
contract (no product suite), the recorded command may be a **structural smoke** the repo
already owns (e.g. `make test-fast`, a `bash -n`/`node --check` script, or a tiny
`rg`-based contract test checked into the skill repo). Never invent a flaky e2e; prefer a
deterministic local gate.

**Legacy discard phrases** (optional, in the target or same-turn user text): `discard legacy`,
`clear ledger`, `clear IMPROVE_LOOP` force **discard** of a launch-root leftover ledger
instead of migrate (see Phase 0 step 1a.3). Default for Status `active` is **migrate**.

**Sibling skill.** `grok-review-converge` is related (one round per invoke by default;
multi-round may still prefer `/goal`). Improve-loop’s **primary multi-cycle is L1
autonomous campaign driver**, not host re-drive. Ralph remains optional legacy only on
converge when promise-tag Stop-hooks are required — never improve-loop’s primary path.

## Preconditions

Fail fast in Phase 0. Do not half-run a cycle.

- **Shell must spawn.** Run L3 `scripts/shell-probe.sh --repo "$TARGET_REPO"` (or equivalent
  git checks). If the tool **fails to spawn** (e.g. host `IO Error: No such file or
  directory`) or the probe exits non-zero: **stop immediately** — report
  `blocked (shell unavailable)`, include the host/probe error, and state that
  worktree/test/commit cannot proceed. Do **not** thrash: no scheduler loops, no
  multi-subagent delete cascades. File-only tools cannot complete this skill.
  **Host sticky-CWD hazard (Grok ≥0.2.102):** local sessions **keep the current directory
  across shell commands**. If a prior turn `cd`'d into a campaign worktree (or subagent
  worktree) that was later **removed** (merge-back teardown, `git worktree remove`), the
  host may fail **every** later spawn with bare ENOENT — even `/bin/echo` — while file tools
  still work. **Operator recovery:** fully quit Grok (not only `/clear`), restart from a
  directory that exists (`cd /path/to/repo && grok`), probe with `/bin/pwd && /bin/echo ok`,
  then re-invoke. Closing **Next** on this stop must say so explicitly.
- The working tree must be inside a **non-bare** git repository: `git rev-parse --show-toplevel`
  succeeds and `git rev-parse --is-bare-repository` is not `true`. Commits are the durable
  ledger; without git there is no Phase 4. `git worktree` must work (refuse if
  `git worktree list` fails).
- **Paths** (resolved in Phase 0 step 1a):
  - `ORIGINAL_CWD` — host sticky path at `/improve` entry (L1); restored on L1 exit.
  - `TARGET_REPO` / `LAUNCH` — destination checkout; **outer sticky CWD for the campaign**
    (may differ from Grok Build session). Prefer product-relative commands from here.
  - `WORKSPACE` — the **single** campaign worktree (`$LAUNCH/.worktrees/<slug>`). **This is
    where the entire `/improve` campaign tree lives** (ledger, code, tests, commits). Access
    via absolute paths + `git -C` / **subshells** only — never outer sticky into WORKSPACE.
  - `POINTER` — `$COMMON_GIT/improve-loop/active.json` where
    `COMMON_GIT=$(git rev-parse --path-format=absolute --git-common-dir)`. Ensures resume
    re-enters the **same** WORKSPACE (never a second worktree).
  While pointer `state: active`, launch must not receive campaign ledger, code, or commits.
- **`.worktrees/` must be gitignored.** L3 `worktree-enter.js` ensures an exact `.worktrees/`
  line on the **campaign WORKSPACE** `.gitignore` after `worktree add` (not on LAUNCH — writing
  launch would leave merge-blocking dirt). Stage/commit that `.gitignore` on the **campaign
  branch** in the first Phase 4 that lands (or a ledger-only cycle if no code yet) so the
  ignore rule is durable. Do **not** leave campaign paths as unignored litter.
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

## Durable state: git commits (self-contained cycles)

**Git is the only durable ledger.** Each cycle’s Phase 4 commit body carries Thesis, Outcome,
test evidence, advisor consolidation, Notes, stop-condition state, and **`Next backlog:`**
checklist lines (or `Next backlog: (empty) → complete`). The next cycle rebuilds continuity
from:

```bash
git -C "$WORKSPACE" log --grep="improve-loop: iteration" -n 15 --format="%H%n%s%n%b%n---"
```

**Not durable / not for recovery:**

- Pointer `active.json` — **run lock for this invoke only**; discarded on entry of the next
  `/improve` (default) and cleared on exit.
- `IMPROVE_LOOP.md` — **optional ephemeral** file during a run (advisors / local notes). May
  be committed mid-campaign or terminal-archived, but **must not** be required to resume a
  later invoke. Prefer deriving backlog from the latest commit’s `Next backlog:` block.

**Default entry:** `worktree-enter` **discards stale** isolation then **cold-starts**.  
**Opt-in:** `--resume` only when the operator explicitly wants crash recovery of a live pointer.

**Terminal cycles:** Status `complete` / `stopped (...)` → merge-back teardown. An old
complete commit on `main` tip must **not** prevent a new campaign from seeding (no
“tip has archive → refuse reseed” gate on cold-start).

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

   **1a. Enter the one campaign worktree (before any ledger or dirty check) — via L3 scripts.**

   First resolve **target repo root** (Invocation: Target repository). If L1 has not yet
   sticky-cd'd there, do so now (`cd "$TARGET_REPO"`). Then run L3 with absolute paths:

   ```bash
   SKILL_DIR="$(dirname path/to/this/SKILL.md)"   # skill package root (absolute)
   bash "$SKILL_DIR/scripts/shell-probe.sh" --repo "$TARGET_REPO"
   # on non-zero or spawn failure → STOP blocked (shell unavailable)

   DISCARD=()
   # if invocation/same-turn text has discard legacy / clear ledger / clear IMPROVE_LOOP:
   #   DISCARD=(--discard-legacy)
   RESUME=()
   # only if operator explicitly asked to resume a crashed run:
   #   RESUME=(--resume)

   node "$SKILL_DIR/scripts/worktree-enter.js" \
     --repo "$TARGET_REPO" --target "$TARGET" \
     ${TEST_COMMAND:+--test-command "$TEST_COMMAND"} \
     "${DISCARD[@]}" "${RESUME[@]}"
   ```

   Parse the JSON stdout (exact keys from `worktree-enter.js`):

   ```
   WORKSPACE        = json.workspace
   LAUNCH           = json.launch
   COMMON_GIT       = json.common_git
   POINTER          = json.pointer
   campaign_branch  = json.campaign_branch
   launch_branch    = json.launch_branch
   mode             = json.mode
     # cold-start | discard-stale-cold-start | resume (--resume only) |
     # migrate | discard-cold-start | merge-back-only (--resume + reintegrate_blocked)
   suggested_cwd    = json.suggested_cwd   # durable LAUNCH — not WORKSPACE
   notes            = json.notes           # may include discarded-stale-campaign:…
   ```

   Exit-code map (worktree-enter): `3` lock busy → stop; `4` launch code-dirty → stop
   `launch code-dirty`; `5` tracked legacy ledger → stop (operator `git rm`); `6` path
   traversal → stop; `7` worktree create/repair failed → stop; `8` bare → stop.

   If `mode == merge-back-only`: run Phase 5 merge-back only (L3 `merge-back.js`); stop.

   **Default is discard-stale + cold-start** — never freehand resume. Use `--resume` only when
   the operator asked. Random 6-hex slugs + `.worktrees/` gitignore stay required.

   Optional status snapshot for kickoff card:

   ```bash
   node "$SKILL_DIR/scripts/ledger-status.js" --workspace "$WORKSPACE"
   ```

   **After WORKSPACE is set:** outer sticky CWD stays on **LAUNCH / TARGET_REPO** (destination
   repo). Do **not** bare-`cd` into WORKSPACE; do **not** leave sticky on the original Grok
   session repo if it differs.
   - Prefer product commands **from TARGET_REPO/LAUNCH** sticky root (reduces relative-path risk).
   - Campaign tree: `git -C "$WORKSPACE"` / `(cd "$WORKSPACE" && eval "$TEST_COMMAND")` /
     `make -C "$WORKSPACE" …`.
   - Subagents: absolute WORKSPACE as tool `cwd` / paths; same no-sticky-in-worktree rule.
   - See **Shell CWD discipline** (pin destination, homecoming on L1 exit).


2. If this is a **new cold-start / discard-stale-cold-start** (default): seed an ephemeral
   backlog from the **git digest** (step 7) + target, even when main tip is an old
   `improve-loop: … complete` archive. **Do not** refuse reseed because of historical
   terminal archives — those are prior campaigns' learnings, not this run's resume file.
   Optionally write ephemeral `$WORKSPACE/IMPROVE_LOOP.md` for advisors; or keep backlog
   in-memory and encode `Next backlog:` in the cycle commit body. Never enter Phase 1 with
   an empty backlog (seed 1–3 items). Set `N = 1` for the first cycle of this invoke.
   Skip 3a–4; go to step 5.

   If mode is **`--resume`** and ledger is absent after terminal land on **this** worktree:
   merge-back-only / stop (true same-campaign recovery).

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

- Then the orchestrator (native) runs the recorded test command **exactly once** with
  process CWD = **WORKSPACE**, without sticking the host session there — e.g.
  `(cd "$WORKSPACE" && eval "$TEST_COMMAND")` or `make -C "$WORKSPACE" …` — even if the
  executor believes nothing changed. Capture full output to a temp file; keep a tail
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
  - **Next backlog** — required for self-contained cycles. Emit a block the next cycle (or
    next `/improve` digest) can parse:

    ```
    Next backlog:
    - [ ] <item> — <rationale>
    - [x] <done item> — done
    ```

    Or `Next backlog: (empty) → complete` when Status is terminal / no open work.
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

Apply the **Outer goal protocol** (optional host signal). Land first; merge-back second and
best-effort; never merge mid-campaign. Phase banners + kickoff card earlier are required when
Phase 0 ran. **Reporting:**

- **Autonomous mode:** progress line after active cycles; full **Campaign report** when L1
  exits (not a full Closing card every cycle).
- **`--once` mode:** **Closing card** at end of the single cycle (and Campaign report if
  that cycle already terminated the campaign).

| Condition | Action |
|---|---|
| Terminal + landed | Merge-back; best-effort `update_goal(completed)` if goal Active; L1 exits → Campaign report |
| Terminal + not landed | Do **not** complete host goal; L1 exits → report blocked/stopped |
| Active after cycle, **autonomous** | Progress line; **L1 continues next L2 cycle now** (do not stop for user) |
| Active after cycle, **`--once`** | Closing card; L1 exits (Result once-active) |
| Dirty/veto before Phase 5 | Report only (never invent terminal Status over dirty code); L1 exits if blocked |

`stopped (...)` and `complete` are both **finished campaigns** once landed.

**Same-turn landed** (resume file may already be gone after terminal archive) iff:

1. Status is `complete` or `stopped (...)`,
2. `PHASE4_COMMIT_OK=true` (or prior land via leftover/short-circuit), and
3. `git -C "$WORKSPACE" log --grep="improve-loop: iteration N —" -n 1` finds the commit.

- **Terminal + landed → merge-back once (best-effort) via L3:**

  ```bash
  node "$SKILL_DIR/scripts/merge-back.js" --repo "$TARGET_REPO"
  # After teardown: durable sticky (not deleted worktree), then L1 will homecoming
  cd "${SUGGESTED_CWD:-$LAUNCH}" 2>/dev/null || cd "$TARGET_REPO" 2>/dev/null || true
  ```

  Parse JSON: `merge_back` is `ok` | `blocked` | `skipped_detached` | `teardown_partial`;
  `suggested_cwd` is the durable path (LAUNCH). On blocked/skipped, leave WORKSPACE; print
  the FF command from notes/error. Land is durable even if merge-back fails. Prefer the
  script over freehand FF so teardown order (FF → remove worktree → delete branch → delete
  pointer) stays correct. **Never** leave sticky under a removed `.worktrees/*`.

- **Merge-back-only** (`reintegrate_blocked` or re-invoke after land with no ledger): no
  Phases 1–4; run `merge-back.js` on the same pointer. Success clears pointer.

- **Active + autonomous:** do **not** end the user turn waiting for re-invoke; L1 driver
  starts the next L2 cycle immediately (under `MAX_CYCLES`); sticky stays on TARGET_REPO/LAUNCH.
- **Active + `--once`:** end after Closing card; L1 homecoming to `ORIGINAL_CWD`; operator
  may re-invoke without `--once` to continue (pointer resume).
- **L1 exit (all modes):** after Campaign report (or once Closing card), restore
  `cd "$ORIGINAL_CWD"` when it still exists (see Shell CWD homecoming).

## Multi-cycle: L1 campaign driver (not host re-drive)

Default `/improve` = **autonomous L1 loop** of L2 cycles until terminal+landed, blocked, or
`MAX_CYCLES`. Host `/goal` is optional (template at `references/goal-objective.template.md`
for operators who want session-level visibility/caps). Primary multi-cycle does **not**
depend on “goal continues next turn.”

**Do not** wrap improve-loop in ralph-loop as the primary multi-cycle driver (promise tags,
`.claude/ralph-loop.local.md` are deprecated for this skill). Sibling `grok-review-converge`
may still document ralph as optional legacy.

**Hard caps:**
- Skill: `IMPROVE_LOOP_MAX_CYCLES` (default 8) + ledger stop counters.
- Host (optional outer wall): max-turns / max-budget / Esc when unattended.

Merge-back left blocked → next `/improve` (or resume autonomous) runs merge-back-only.

**Verify package contracts:**

```bash
node "$SKILL_DIR/scripts/contract-check.js"
bash "$SKILL_DIR/tests/scripts.test.sh"
```

This skill makes no assumptions about language, layout, or test framework — always use the
recorded test command.
