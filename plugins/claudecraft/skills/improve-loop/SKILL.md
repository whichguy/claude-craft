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
| **L3 Scripts** (`scripts/`) | Shell probe, worktree enter, resolve-target-repo, pointer RMW, ledger-status, merge-back | Advisor judgment, thesis prose |

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

**Default complete rule (P0/P1 residual discipline):** Plan from git digest; classify open
work as **P0/P1**; complete **only** after **two consecutive** cycles with **zero open
P0/P1 after replan** (plus green suite). Empty backlog after one cycle is **not** enough
to complete. The cycle that **finishes the last P1** and replans empty still counts as
streak **1** (Status stays `active`); the next cycle is residual-only and must reach
streak **2**. See [P0/P1 residual discipline](#p0p1-residual-discipline-default).

**Do not** wrap improve-loop in ralph-loop as the primary multi-cycle driver. **Do not** stop
after the first `active` cycle waiting for the user when mode is autonomous.

**Workspace rule (non-negotiable):** For the duration of **one `/improve` invoke**, all
campaign edits live in **one ephemeral worktree** on `improve/<slug>` under
`LAUNCH/.worktrees/`. Launch is read-only mid-run. Merge-back once at end (terminal land).

**Self-contained cycles (product default):** Each L2 cycle is self-contained. **Git commit
bodies are the durable ledger and learnings store** (Thesis / Outcome / Test evidence /
What landed / Advisor consolidation / Notes / open-only `Next backlog` / `Next deferred` /
stop state). Phase 0 digests those fields for anti-reseed and replan. There is **no
cross-invoke resume** by default: entry **discards stale** pointer/worktree, then cold-starts.
In-session multi-cycle reuses the **same invoke’s** worktree only. Opt-in crash recovery:
`--resume` on `worktree-enter` / invocation. Optional ephemeral `IMPROVE_LOOP.md` during a
run for advisors — never the recovery surface.

**Package paths** (resolve relative to this skill directory):

```text
SKILL_DIR/references/goal-objective.template.md   # optional host /goal body
SKILL_DIR/scripts/shell-probe.sh
SKILL_DIR/scripts/worktree-enter.js
SKILL_DIR/scripts/resolve-target-repo.js   # ~/.claude install symlink → real git root
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
   host session opened in `c-thru` while improving `backchain`). Never assume session cwd is
   `TARGET_REPO`.
2. **Enter destination repo (durable sticky):** once `TARGET_REPO` is known and exists,
   outer sticky CWD **must** become the target checkout root for the whole campaign:
   `cd "$TARGET_REPO"` (or `LAUNCH` once known — same durable tree). Prefer running shell
   work **from that repo** so relative paths (`make test`, `git status`, fixture paths) are
   not ambiguous with the host session repo. Still use absolute `SKILL_DIR` / `--repo` /
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
7. **When the loop exits:** emit the **Campaign report** once (goal restated, cycles-at-a-glance,
   summary — see Status reporting). Optional `update_goal(completed: true)` only if
   terminal+landed and a goal is Active (ignore tool errors if goal was never Active).
8. **Always teardown isolation for this invoke:**
   - Terminal+landed → `merge-back.js` (FF + worktree/branch/pointer remove).
   - Blocked / capped / fail → `campaign-teardown.js --repo "$TARGET_REPO"` best-effort
     (no FF; clear pointer + remove worktree/branch so next `/improve` is clean).
9. **Homecoming:** `cd "$ORIGINAL_CWD"` when it still exists; else leave sticky on
   `TARGET_REPO`/`LAUNCH`. Never leave sticky under deleted `.worktrees/*`.

Never emit ralph promise tags. Never bare-`cd` the host into `.worktrees/*`.

## P0/P1 residual discipline (default)

Applies to **every** `/improve` target (code, skill, docs). Goal: plan improvements from
evidence, do material work, and only sign off after a second independent residual pass.

### Backlog = open work only (pure eval context — non-negotiable)

`## Backlog` is the **work queue**, not a history log. Finished items **must not** stay in
the live backlog as `- [x] …` peers — that pollutes replan/advisor context. Historical
knowledge (what improved, why, what failed) lives in **git commit bodies** and the Phase 0
**prior-learnings digest**.

| Form | Meaning | Phase 1 execute? | Residual / open-P0/P1 count? |
|---|---|---|---|
| `- [ ] P0:` / `- [ ] P1:` | **Open** — still material | yes (selectable) | counts as open |
| `- [x] …` in Backlog | **Legacy / invalid** — strip on sight (do not keep) | never | does not count |

```text
- [ ] P1: <item> — <why this is material>     ← only form allowed in live ## Backlog
```

**Complete-item rule (Phase 2 — delete from work queue):** when STATUS is PASS, Outcome is
`confirmed`, and `CHANGED_PATHS` is non-empty, the orchestrator **removes** the selected
open line from `## Backlog` entirely (do not flip to `[x]` and leave it). Record the finish
in the Log entry (Thesis / Outcome / Notes) so Phase 4’s commit body banks the learning.
Leave the line **open** (`[ ]`) on FAIL, `disproven`, `blocked`, or `partial` so replan can
refine remaining work. Deleting only on confirmed+landed paths prevents re-select this cycle;
anti-reseed across cycles is **git digest**, not a done checkbox.

**Done memory = git commit metadata (mandatory, not backlog `[x]`).** Every improve commit
body already carries the durable learnings surface. Phase 0 step 7 **must** pull and use:

| Commit-body field | Use when evaluating / seeding / replanning |
|---|---|
| **Thesis** | What was tried and why we thought it would help |
| **Outcome** | `confirmed` / `disproven` / `partial` / `blocked` + disproof evidence |
| **Test evidence** | STATUS + signature / suite summary |
| **What landed** | paths or `no code landed` |
| **Advisor consolidation** | agreements, risks, chosen direction |
| **Notes for next cycle** | forward-looking constraints |
| **Next backlog** | **open** P0/P1 only (or empty + streak) — work queue snapshot |
| **Next deferred** | open P2 consider-later list |
| **Stop-condition state** | counters / Status |

Build an in-memory **COMPLETED_SET** (semantic short lines) from iterations whose most-recent
Outcome was `confirmed` (and optionally `partial` with non-empty What landed), plus a
**DISPROVEN_SET** from most-recent `disproven` theses. Advisors and seed/replan receive both
sets **alongside** the open Backlog — never by stuffing finished work back into `## Backlog`.

**Anti-reseed rule (residual + cold-start + replan):** must **not** propose open P0/P1 that
semantically restates work already in **COMPLETED_SET** or a most-recent **disproven** thesis
without a stated re-open reason. Prefer new gaps from target inspection; if none, leave open
P0/P1 empty (residual path). Notes on drop: `replan re-opened completed work — dropped` or
the existing disproven-thesis Notes line.

**Material** = open (`- [ ]`) Backlog lines matching `P0:` or `P1:` only.  
Replan candidates with open Backlog items lacking P0/P1 tags are **invalid** — rewrite or
drop with Notes `replan item missing P0/P1 tag — rewritten/dropped`. Do **not** put `P2:`
lines in `## Backlog`. Do **not** put `- [x]` lines in `## Backlog` (strip with Notes
`legacy [x] stripped from Backlog — memory is git digest`).

**Deferred (P2) — consider later, not residual blockers.** Open-only under
`## Deferred (P2)` / `Next deferred:` (same purity rule — drop finished deferred; history is
git + Notes):

```text
- [ ] P2: <item> — <why deferred / not material this campaign>
```

Unchecked `P2:` lines are **not** material, are **never** selected for Phase 1 execute, and
**do not** reset or block `consecutive-non-material-cycles`. Cap ~8–12 open deferred lines;
dedupe/drop stale with a Notes line. One-off observations that are not “consider later” may
stay in Log Notes only.

### Planning (every Phase 3) — live open queue **and** git history (mandatory)

Planning always uses **both** surfaces when available — open queue for “what next?”, git
for “what we already learned”:

1. **Git prior-learnings digest** (Phase 0 step 7): last 15 improve **commit bodies** —
   full Thesis / Outcome / Test evidence / What landed / Advisor consolidation / Notes /
   **`Next backlog:`** (**open** P0/P1 only) / **`Next deferred:`** / stop state. Explicitly
   flag `disproven` outcomes and build **COMPLETED_SET** + **DISPROVEN_SET** from those
   fields (not from backlog `[x]` lines).
2. **Live ledger** when `IMPROVE_LOOP.md` exists: Log + **open** `## Backlog` + open
   `## Deferred (P2)` + stop counters (advisors get the path; orchestrator reads sections).
3. Advisors / native-replanner produce **two bodies** (not whole-file rewrites):
   - **Backlog body** — **open only** `- [ ] P0:` / `- [ ] P1:` (material; residual streak).
     **Never** emit `- [x]` in Backlog. Do **not** re-propose COMPLETED_SET / DISPROVEN_SET
     items without re-open rationale.
   - **Deferred body** — open `- [ ] P2:` only (or `Next deferred: (none)`).
4. Prefer concrete P0/P1 from target inspection + digest **gaps** over vague residual-only
   seeds — **excluding** semantic overlap with COMPLETED_SET / unexcused DISPROVEN_SET.
5. **Do not auto-promote** Deferred → P0/P1. Promote only when residual survey / advisors
   judge an item newly material; Notes line `promoted P2→P1: <short>`.
6. Disproven-thesis guard applies to open P0/P1 proposals (digest DISPROVEN_SET).
7. Cold-start with no live ledger: seed **1–3 open** P0/P1 from target + digest, **minus**
   COMPLETED_SET / unexcused DISPROVEN_SET. **Carry forward** prior open `Next deferred:`
   only (dedupe). **Do not** seed done `[x]` lines into Backlog. Empty deferred is fine.

### Residual streak

Track in ephemeral ledger / commit body:

```text
consecutive-non-material-cycles: <n>
```

Update **after Phase 3 replan** (before Phase 4), independent of the Phase 2 no-progress matrix:

| After replan | `consecutive-non-material-cycles` |
|---|---|
| Open P0/P1 count = 0 | **+1** |
| Open P0/P1 count ≥ 1 | **reset → 0** |

A cycle that lands the last P1 and then replans empty still **+1**s the streak (that cycle
counts as non-material for residual purposes). Status stays **`active`** until streak ≥ 2.
Operator-facing phrasing: residual ×2 is **two consecutive post-replan empty P0/P1 cycles**,
not necessarily two pure residual-only cycles after all work — the finishing cycle is streak 1.

Recover streak from the latest improve commit body when ephemeral state is missing.

### When Status becomes `complete`

Set `complete` **only if all** of:

1. Open P0/P1 count = 0 after replan.
2. `consecutive-non-material-cycles >= 2`.
3. Green suite gate (Phase 3 cases a/b/c below).

If open P0/P1 = 0 and streak is **1**: leave Status **`active`**. Next cycle is
**residual-only** (skip Phase 1 execute / investigation Thesis
`residual survey (non-material streak 1→2)`); Phase 3 re-surveys; if still zero open P0/P1 →
streak 2 → complete. Do **not** invent fake P0/P1 to force work.

If open P0/P1 = 0 and streak ≥ 2 but suite fails confirmation: do **not** complete (existing
completion-gate rules).

### Seed (cold-start)

Seed **1–3 open (`[ ]`) P0/P1-tagged** items from digest + target. Prefer concrete material
gaps that are **not** semantic duplicates of **COMPLETED_SET** / unexcused **DISPROVEN_SET**
built from prior improve **commit bodies** (Thesis / Outcome / What landed / Notes). If none
are obvious, seed at least:

```text
- [ ] P1: Residual survey — classify any remaining material P0/P1 for <target>
```

**Do not** seed `- [x]` done lines into `## Backlog` — finished work is remembered via the
git digest, not as backlog clutter. **Also seed Deferred (P2)** from the digest’s union of
prior **open** `Next deferred:` / archived open Deferred (dedupe; cap 8–12). Do not invent
P2s just to fill the section — empty is fine. Never enter Phase 1 with an empty open
**P0/P1** list on a fresh cold-start (Deferred alone does not satisfy that rule).

### Caps

`MAX_CYCLES` / no-progress ×3 / same-error ×3 still bind. Hitting max-cycles with streak &lt; 2
→ `stopped (max-cycles)`, not `complete`.

## Shell CWD discipline (mandatory)

Some **host local sessions** (e.g. Grok Build ≥0.2.102) **keep the current directory across**
`run_terminal_command` calls. Two hazards:

1. **Wrong-repo stickiness:** session opens in repo A (host cwd) while `/improve`
   targets skill/repo B elsewhere — relative `make`/`git`/`test` silently hit A.
2. **Dead worktree stickiness:** sticky CWD under a later-deleted `.worktrees/<slug>` → bare
   ENOENT on every spawn while file tools still work.

### Pin destination, not session cwd

| Path | Role | Outer sticky CWD? |
|---|---|---|
| `ORIGINAL_CWD` | Where the host session was when `/improve` started (save at L1 entry) | Only **after** campaign exit (homecoming) |
| `TARGET_REPO` / `LAUNCH` | Destination git root for the improve target | **Yes — for the whole campaign** after resolve |
| `WORKSPACE` | Disposable campaign worktree under `LAUNCH/.worktrees/` | **Never** as outer sticky |
| `SKILL_DIR` | improve-loop package (may be under `~/.claude/skills/…`) | Never required as sticky; always absolute |

**Mandatory order:**

1. Save `ORIGINAL_CWD` (absolute, preferably physical/`pwd -P`).
2. Resolve `TARGET_REPO` (Invocation). If it differs from session cwd, treat that as expected —
   **do not** run campaign ops from the host session repo by accident.
3. Outer sticky: `cd "$TARGET_REPO"` (or `LAUNCH` once known). Mid-campaign host sticky stays
   on that durable root.
4. Worktree ops: **subshell only** — `(cd "$WORKSPACE" && …)` or `git -C "$WORKSPACE"` /
   `make -C "$WORKSPACE"`. Never bare outer `cd "$WORKSPACE"`.
5. After merge-back / teardown: sticky on `suggested_cwd`/`LAUNCH`/`TARGET_REPO` briefly if
   needed, then **homecoming** `cd "$ORIGINAL_CWD"` when L1 exits (path must still exist).
6. Spawn ENOENT before any output → hard-stop `shell unavailable`; operator restarts the host from
   a real path.

### Command priority (during campaign, sticky already on TARGET_REPO/LAUNCH)

1. Prefer commands that are correct **from the destination root** (relative product paths).
2. Still use absolute paths for anything outside that root (`SKILL_DIR`, other repos).
3. Always `git -C "$WORKSPACE"` / `git -C "$LAUNCH"` when both trees matter.
4. Temporary WORKSPACE only via subshell `(cd "$WORKSPACE" && …)`.

**Disallowed:** outer sticky under `.worktrees/*`; leaving sticky on TARGET after exit without
attempting restore to `ORIGINAL_CWD`; assuming relative paths refer to the host session repo
when `TARGET_REPO` is different.

**pushd/popd:** non-preferred. Prefer explicit `ORIGINAL_CWD` + outer `cd` for durable moves,
subshells for WORKSPACE. **Subshells cannot heal an already-dead sticky CWD.**

## Status reporting (user-facing — mandatory)

Operators must always see **what goal this campaign set**, **how many cycles are budgeted
and used**, **what each cycle discovered**, and a **final summary** — not only tool noise or
a commit hash. Emit the blocks below as plain markdown the user can scan in chat (emoji
optional; keep labels stable so grepping logs works).

**Illustrative bar (non-negotiable):** every autonomous campaign must make the *story*
visible while it runs — goal at kickoff, discoveries per cycle, summary at exit. Thin
progress lines alone are not enough.

**Reasoning trail (non-negotiable):** while the campaign runs, also surface **decision
logic** — not only phase banners. Operators must be able to answer, from chat alone:

1. **What is the skill considering?** (inputs, candidates, constraints under review)
2. **What does it evaluate as true?** (facts/gates that just resolved — counts, dirt, PASS/FAIL, streak)
3. **What is it about to do?** (next concrete action before tool work)
4. **When a unit completes, what did it do?** (short trail of decisions that unit made)

Silent multi-tool stretches without a reasoning beat are a contract miss. Keep beats short
(2–6 bullets); never dump full suite logs or advisor transcripts into the trail.

### Reasoning trail (live insight — mandatory)

Emit **Reasoning beats** at every **decision gate** (before acting on the gate, and once
after key evaluations). Use stable labels so operators can skim:

```text
· considering · <what options / evidence / rules are in play>
· evaluates   · <predicate> → true|false · <one-line evidence>
· about to    · <next action in plain language>
· decided     · <choice> · because <one line>
```

**Minimum gates (must emit at least one beat each):**

| Gate | considering | evaluates (examples) | about to |
|---|---|---|---|
| L1 entry | target → path → repo; mode autonomous\|once | TARGET_REPO known; sticky on destination | shell-probe / worktree-enter |
| Phase 0 enter | cold-start vs resume vs discard-stale | mode = …; launch code-dirt = none\|paths; ambient ignored = … | create/reuse WORKSPACE |
| Phase 0 residual branch | open P0/P1 vs residual-only | open count = k; streak = m | execute item **or** skip Phase 1 execute |
| Phase 1 select | open P0/P1 candidates; COMPLETED_SET / DISPROVEN_SET from git | selected = …; skipped reseed of completed/disproven = … | implement / investigate |
| Phase 1 post-test | STATUS + CHANGED_PATHS + suggested Outcome | PASS\|FAIL; paths empty? → reconcile Outcome; hygiene gate (confirmed\|partial + non-empty)? | on gate: **post-PASS hygiene** then delete/leave open; on FAIL: revert |
| Phase 2 counters | STATUS × Outcome matrix row | no-progress / same-error / non-material after update | append Log; **remove** completed item from Backlog |
| Phase 3 replan | digest + ledger + advisors usable K/M | Round 2 yes\|skip; open P0/P1 after = k; streak → m | surgical Backlog/Deferred apply |
| Phase 3 complete gate | residual ×2 + suite green | streak ≥ 2? open = 0? suite gate a\|b\|c | set Status complete\|active\|stopped |
| Phase 4 | ledger-only vs code paths; secret scan | code-dirty veto? secret? | commit **or** refuse + report |
| Phase 5 / L1 | terminal+landed? autonomous continue? | merge-back needed? cycle_count vs MAX | merge-back **or** next cycle **or** campaign report |

**Rules for beats:**

- Prefer **evaluates** lines for hard facts the skill already computed (open P0/P1 count,
  streak, STATUS, dirt lists, advisor usable K/M). Do not invent soft confidence.
- **about to** always precedes the consequential tool action (test run, commit, merge-back,
  starting cycle K+1).
- On hard stop / veto, emit `· evaluates · <gate> → true · <reason code>` then
  `· decided · STOP · because …` **before** the STOP phase banner (or immediately with it).
- Do **not** replace phase banners, mid-cycle beats, or discovery cards — the trail
  **layers on** them. Banners say *where*; the trail says *why / what’s next*.

**Per-cycle Decision trail** (end of every L2 cycle — part of the cycle discovery card
below, or immediately after it if the card is already long):

```markdown
**Decision trail (this cycle)**
1. considered: …
2. evaluated true: … → acted: …
3. evaluated true: … → acted: …
4. completed as: <Result> · next: <continue cycle K+1 | campaign report | operator action>
```

3–6 numbered steps max. Cover select → test/outcome → replan/streak → commit/Status.
Omit steps that never ran (e.g. residual-only skips execute).

**Campaign “what we did”** (inside Campaign report Summary — mandatory):

```markdown
**What this campaign did (arc)**
1. Kickoff: goal was …; seeded open P0/P1 …; mode …
2. Cycle 1: tried … → outcome … → landed …
3. Cycle 2: …
…
N. Exit: Result … because … (residual×2 | open remain | cap | block | once)
```

This is the completion answer to “what has it been doing?” — chronological, decision-shaped,
not a second full discovery dump.

### Live phase banner (every phase entry)

When entering a phase (or a Phase 0 short-circuit branch), print **one** short line first:

```text
▸ improve · Phase <0–5 | short-circuit name> · cycle K/MAX · <one-line action>
```

Include `cycle K/MAX` once L1 has a cycle count (omit on pure Phase-0 setup before the
first L2 cycle starts). Examples:

```text
▸ improve · Phase 0 · cold-start worktree improve/backchain-skill-…-a1b2c3
▸ improve · Phase 0 · discard-stale → cold-start
▸ improve · Phase 0 · short-circuit: ledger-flush (not landed, clean tree)
▸ improve · Phase 1 · cycle 2/8 · execute: <first 80 chars of backlog item>
▸ improve · Phase 1 · cycle 2/8 · test: `make test-fast`
▸ improve · Phase 3 · cycle 2/8 · advisors: Round 1 (optional tools) | native-only
▸ improve · Phase 4 · cycle 2/8 · commit improve-loop: iteration 3 — …
▸ improve · Phase 5 · cycle 3/8 · merge-back ff-only → main
```

On any hard stop / veto, print immediately:

```text
▸ improve · STOP · cycle K/MAX · <reason code> — <one human sentence>
```

Reason codes (use these strings when they apply): `shell unavailable`,
`ambiguous target repo`, `no test command`, `legacy tracked ledger`,
`wip carry failed`, `carried-wip-discard-blocked`, `worktree code-dirty`, `code-dirty veto`,
`secret veto`, `commit failed`, `reintegrate_blocked`, `scope violation`, `symlink broken`,
`launch code-dirty` (merge-back / mid-campaign only — enter carries then cleans launch WIP).

### Kickoff card (once Phase 0 has resolved WORKSPACE — or on early STOP)

Emit **once** after Phase 0 has enough context. Lead with the **campaign goal** so the
operator knows what success looks like before any cycle runs.

```markdown
### 🔄 Improve · kickoff

#### Campaign goal
| | |
|---|---|
| **Goal** | <1–3 sentences: what this campaign will improve and why it was opened> |
| **Target** | <plain-language target from the user invoke> |
| **Done when** | Status `complete` after **2 consecutive** post-replan empty P0/P1 cycles + green suite · or `stopped` / blocked / max-cycles |
| **Driver** | autonomous (loop until done) \| once (single cycle) |
| **Cycle budget** | max **MAX_CYCLES** L2 cycles this invoke (env `IMPROVE_LOOP_MAX_CYCLES`, default 8) |
| **Material rule** | open work must be P0/P1; residual-only passes count toward the ×2 complete streak |
| **Residual rule** | complete after **2 consecutive** post-replan empty P0/P1 cycles (the cycle that finishes the last P1 counts as streak **1**; next residual-only must reach streak **2**) |

#### Setup
| | |
|---|---|
| **Repo** | `<TARGET_REPO>` |
| **Install path** | `<CAND under ~/.claude if any>` · symlink followed yes\|no · resolved `<REAL>` (omit row if n/a) |
| **Mode** | cold-start \| discard-stale → cold-start \| resume \| migrate \| merge-back-only \| short-circuit \| stop |
| **Launch** | `<LAUNCH>` · branch `<launch_branch\|detached>` |
| **Workspace** | `<WORKSPACE>` |
| **Campaign branch** | `improve/<slug>` |
| **Pointer** | `<POINTER>` · state `active\|reintegrate_blocked` |
| **Test command** | `<cmd>` |
| **Seed backlog** | open P0/P1 count · next: <short item or _(empty)_> |
| **Deferred carried** | open P2 count from digest/seed · _(none)_ if empty |
| **Launch WIP carry** | none \| carried `<n>` paths into WORKSPACE then cleaned on launch (`carried-launch-wip:N`) — never freehand-stash |
| **Session cwd (home)** | `<ORIGINAL_CWD>` |
| **Sticky during campaign** | `<TARGET_REPO>` / `<LAUNCH>` (not WORKSPACE; not host session if different) |
| **Outer host goal** | yes \| no (optional observability only) |
```

If Phase 0 stops before WORKSPACE exists, still emit this card with Mode = stop and fill
only the fields you know; put the STOP reason in a final **Blocker** row under Setup.

### Mid-cycle beats (concise, during the cycle)

While a cycle is in flight (not a substitute for the discovery card below). Pair each
status beat with a **reasoning beat** (considering / evaluates / about to) at the same gate:

- **Phase 1 select:** one line: item + why (or `empty-backlog · residual-only / no Phase 1 execute`).
  Plus: `· considering · open candidates …` / `· evaluates · open P0/P1 = k · residual_only = …` /
  `· about to · execute | skip Phase 1 execute`.
- **After test:** `Test · PASS|FAIL` + ≤2-line summary (or first error signature).
  Plus: `· evaluates · STATUS · CHANGED_PATHS empty|n · Outcome → …` /
  **only when hygiene gate open** (PASS + `confirmed`|`partial` + non-empty
  `CHANGED_PATHS`): `· considering · docs stale? · scoped tech-debt/artifacts?` /
  `· about to · apply post-PASS hygiene | no-op`; otherwise `· about to · skip hygiene
  (gate closed) | delete completed item | leave open | revert`.
- **Phase 3:** `Advisors · usable K/M` + `Round 2 · yes|skipped (<why>)` + one-line
  replan direction (or `Backlog unchanged`).
  Plus: `· evaluates · open after replan = k · streak m→m'` /
  `· about to · set Status active|complete|stopped · reason`.
- **Phase 4:** `Commit · yes <short-sha> · subject` **or** `Commit · no — <reason>`.
  Plus: `· considering · ledger-only vs code paths` / `· evaluates · veto/secret?` /
  `· about to · commit | refuse`.

Do not paste full suite logs into chat; keep tails for the ledger only.

### Cycle discovery card (mandatory after every L2 cycle)

Emit **after each L2 cycle finishes** (Phases 0–5 for that iteration), in **both**
autonomous and `--once` modes — including short-circuits, residual-only, stops, and
vetoes. This is the live “what did we learn this iteration?” surface. Keep it scannable:
prefer bullets over essays; 3–7 discovery bullets max.

```markdown
### 🔍 Improve · cycle K/MAX · iteration N

| | |
|---|---|
| **Campaign goal (reminder)** | <same one-line goal as kickoff, or tightened if refined> |
| **Result** | active · continue \| complete · done \| stopped (<reason>) \| blocked (<reason>) |
| **Thesis tried** | <one line from Phase 1 / lightweight Phase 2> |
| **Outcome** | `confirmed\|disproven\|partial\|blocked` · Test `PASS\|FAIL\|n/a` |
| **What landed** | <paths or _no code_ / ledger-only> |
| **Commit** | `yes` `<short-sha>` · `improve-loop: iteration N — …` **or** `no — <reason>` |
| **Open P0/P1** | <k after replan> · non-material streak `<m>` |
| **Residual meter** | streak **m/2** · open P0/P1 **k** · execute **yes\|no** · residual_only **yes\|no** |
| **Why not complete** | _(omit if complete)_ need residual cycle 2/2 · open P0/P1 remain · suite gate · … |
| **Stop counters** | no-progress=<i> · same-error=<j> · sig=`<none\|…>` |
| **Advisors** | <who responded / native-only / skipped> |

**Discovered this cycle**
- <key finding, confirmation, disproof, risk, or replan insight #1>
- <…>
- <…>

**Backlog delta**
- Completed & removed from queue: <items or —> (learning banked in commit Thesis/Outcome)
- Newly opened / rewritten P0/P1: <items or —>
- Still open (next up): <short list or _(empty — residual streak m)_>
- Anti-reseed from git: blocked re-open of COMPLETED_SET / DISPROVEN_SET · <n or —>

**Deferred (P2)**
- Open deferred: <n> · <one-line list or _(none)_>
- Delta this cycle: added / dropped / promoted-to-P1 (or —)

**Decision trail (this cycle)**
1. considered: …
2. evaluated true: … → acted: …
3. evaluated true: … → acted: …
4. completed as: <Result> · next: <continue | report | operator action>

**Next**
- autonomous + active → L1 starts cycle **K+1/MAX** now (do not wait for user)
- once + active → re-invoke `/improve` or drop `--once`
- terminal → campaign report next
- blocked → <concrete operator action>
```

Also emit a **one-line progress line** (and best-effort `update_goal(message: …)` if a host
goal is Active) so logs stay greppable — **mandatory every cycle**, including residual-only:

```text
improve cycle K/MAX · iter N · <active|complete|stopped|blocked> · open P0/P1 <k> · non-material=<m>/2 · residual_only=<yes|no> · deferred=<n> · commit <short-sha|none> · <continuing|done>
```

Only L1/Phase 5 may call `update_goal(completed: true, …)` (terminal + landed, goal Active).

### Closing card (`--once` mode — alias of cycle discovery)

In **`--once`** mode the cycle discovery card **is** the end-of-invoke cycle artifact
(title may use `### ✅ Improve · cycle result` as an alias, but must still include
**Campaign goal (reminder)**, **Discovered this cycle**, **Backlog delta**,
**Deferred (P2)**, and cycle `K/MAX` when known). In **autonomous** mode, do **not** skip
discovery cards — emit one per cycle; the full end artifact is still the **Campaign report**.

### Campaign report (mandatory when L1 driver exits)

Emit **once** when the L1 campaign driver exits (autonomous complete/stop/block/cap, or
`--once` after the single cycle). Do not omit. Restate the goal, show cycle count, walk
the discovery arc, then summarize.

```markdown
### 📋 Improve · campaign report

#### Goal (what this campaign set out to do)
| | |
|---|---|
| **Goal** | <same campaign goal as kickoff — what we intended to improve> |
| **Target** | <plain-language target> |
| **Repo** | `<TARGET_REPO>` |
| **Driver / budget** | autonomous \| once · **K** of **MAX** cycles used |
| **Result** | complete \| stopped (<reason>) \| blocked (<reason>) \| capped (max-cycles) \| once-active |
| **Final Status** | `complete\|stopped (…)\|active\|—` |

#### Cycles at a glance
| Cycle | Iter N | Thesis (short) | Outcome | Test | Commit | Open P0/P1 after | Key discovery (one line) |
|---|---|---|---|---|---|---|---|
| 1/MAX | N | … | confirmed\|… | PASS\|… | `sha`\|— | k | … |
| 2/MAX | … | … | … | … | … | … | … |
| … | … | … | … | … | … | … | … |

(One row per L2 cycle actually run this invoke, including residual-only and short-circuits.
If a cycle had no commit, put `—` in Commit.)

#### What landed
| | |
|---|---|
| **Commits** | `<sha>` · <subject> (one line each, or _none_) |
| **Paths** | <union of paths or ledger-only / no code> |
| **Merge-back** | ok → <branch> \| blocked · first error · retry? \| n/a |
| **Workspace** | removed \| kept at `<path>` |
| **Pointer** | cleared \| active \| reintegrate_blocked |
| **Ambient dirt** | ignored at merge: <paths or _(none)_> |

#### Summary
**Outcome in plain language:** <2–5 sentences: did we hit the goal? what changed for the
target? what remains? why did we stop (complete vs residual×2 vs cap vs block)?>

**What this campaign did (arc)** — chronological decision trail for the whole invoke:
1. Kickoff: …
2. Cycle 1: …
3. …
N. Exit: Result … because …

**Learnings** (3–8 bullets from this run’s commit bodies / Log Notes; **always call out
any `disproven` theses**):
- …
- …

**Residual / still open**
- Open P0/P1 at end: <k> · <list or _(none)_>
- Non-material streak (last): <m>
- Stop counters (last): no-progress=<i> · same-error=<j>

**Deferred (P2) for later** (from final `Next deferred:` / ledger — does **not** block complete):
- <open P2 bullets, or _(none)_>
- Note: durable in git commit bodies; no product file change required to park these.

**Ops**
| | |
|---|---|
| **Test command** | `<cmd>` · last `PASS\|FAIL\|n/a` |
| **CWD homecoming** | restored `<ORIGINAL_CWD>` \| left on `<TARGET_REPO>` (home missing) \| n/a |
| **Next** | done \| <concrete operator action> |
```

Tone: confident, scannable, no filler. Prefer tables + short bullets over walls of prose.
When Result is `blocked` or `stopped`, **Next** must be a concrete operator action (not
“try again” alone). The **Summary** section is required even on short blocked campaigns
(explain what the goal was and why no cycles or partial cycles ran).

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
repo root** before Phase 0 step 1a, in this order:

1. **Map the target to a filesystem path** when possible: absolute path from the invoke; skill /
   agent / command / hook under `$HOME/.claude/skills|agents|commands|hooks/<name>` (or
   `…/SKILL.md`); known project path (e.g. `backchain skill` → `$HOME/src/backchain`); goal
   objective path. Prefer an install-surface `CAND` under `$HOME/.claude/…` when the user
   named a skill/agent/command/hook by name (so step 2 can follow install symlinks); use a
   known product checkout path when they named a repo/project explicitly.
2. **Claude-home install resolve (mandatory when `CAND` is under `$HOME/.claude`).**
   Always run L3 when the candidate lives on the install surface — do **not** require the
   leaf path itself to be a symlink. Common shapes:

   - package dir symlink: `~/.claude/skills/<name> → $repo/skills/<name>`
   - file symlink: `…/SKILL.md → $repo/…/SKILL.md`
   - path *inside* a package-dir symlink: `~/.claude/skills/<name>/SKILL.md` (leaf is a real
     file; ancestor dir is the install symlink)

   Many installers (e.g. backchain `install.sh`) use the package-dir form. Prefer L3:

   ```bash
   node "$SKILL_DIR/scripts/resolve-target-repo.js" --target-path "$CAND"
   # exit 0 → always use json.target_repo as TARGET_REPO
   #          json.symlink_followed / json.resolved_path are observability (kickoff)
   # exit 3 → STOP broken symlink (leaf or intermediate)
   # exit 4 → no git root on resolved path; fall through to steps 3–5
   ```

   On **exit 0**, campaign sticky / worktree-enter / merge-back **must** use
   `json.target_repo` (not `~/.claude`, not session cwd). `symlink_followed` is for the
   kickoff **Install path** row only — never a gate to ignore `target_repo`.  
   **Do not invent** a different repo when L3 reports `symlink_followed: false` and
   `target_repo` is still under `~/.claude` (real install tree, not a product symlink).
   Broken symlink → stop with reason `symlink broken`.
3. Absolute path already under a non-`~/.claude` checkout → that checkout’s git toplevel.
4. Goal objective names a repo path → that path’s git toplevel.
5. Else default to `git rev-parse --show-toplevel` from the current tool cwd.

All of COMMON_GIT / LAUNCH / INVOKE_ROOT / POINTER / worktree creation use that **target
repo root**, not an unrelated session workspace or the bare `~/.claude` install surface when
a symlink pointed at a product repo. If resolution is ambiguous, **interactive:** ask once;
**unattended:** `Status: stopped (ambiguous target repo)`, ledger-only if a WORKSPACE already
exists, else report only.

**Session vs destination conflict:** when `ORIGINAL_CWD` and `TARGET_REPO` differ, the
campaign sticky CWD and product-relative commands must use **TARGET_REPO**, not the host
session tree. L1 still returns to `ORIGINAL_CWD` at exit.

**Test command for skill/doc-only targets.** When the change set is a skill or markdown
contract (no product suite), the recorded command may be a **structural smoke** the repo
already owns (e.g. `make test-fast`, a `bash -n`/`node --check` script, or a tiny
`rg`-based contract test checked into the skill repo). Never invent a flaky e2e; prefer a
deterministic local gate.

**Legacy discard phrases** (optional, in the target or same-turn user text): `discard legacy`,
`clear ledger`, `clear IMPROVE_LOOP` force **discard** of a launch-root leftover ledger
instead of migrate (see Phase 0 step 1a.3). Default for Status `active` is **migrate**.

### Improvement loop family (shared contracts)

| Skill | Unit | Material unit | Complete when |
|---|---|---|---|
| **improve-loop** (`/improve`) | L2 cycle | Open **P0/P1** backlog items | **2 consecutive** cycles with zero open P0/P1 + green suite |
| **review-converge** (`/review-converge`; legacy `/grok-review-converge`) | Review round | Reviewer **material** findings (vs minor) | **2 consecutive clean rounds** (zero material findings) |

Shared family rules (both skills):

1. **Git history–aware planning** — digest prior loop **commit bodies** (Thesis / Outcome /
   What landed / Notes / open Next backlog — *why* things improved or failed) **and** the
   live open Log/ledger before inventing work (both when available).
2. **Material vs non-material** — only material work blocks complete; minor / prompt-depth /
   “consider later” goes to a structured **Deferred (P2)** list (and Notes), not open P0/P1.
3. **Two consecutive non-material passes** before `complete` (not one empty residual).
4. **Pathspec commits** — never `git add -A`; explicit paths only. Deferred needs **no product
   file changes** — ledger / commit-message metadata only.
5. **Outer multi-unit drive** — improve-loop: L1 autonomous by default; converge: one round per
   invoke, multi-round under `/goal` (or optional ralph). Ralph never primary for improve-loop.
6. **Destination CWD** — when the target repo ≠ host session cwd, sticky to the **target repo**
   for product commands; never sticky into disposable worktrees.
7. **Post-PASS hygiene (directive, not a phase)** — after a green suite with **real product
   land** (`confirmed`/`partial` + non-empty `CHANGED_PATHS`), **consider** updating consumer
   docs and cleaning scoped stale artifacts / tech-debt litter from this change. Fold into
   the same cycle’s `CHANGED_PATHS` when warranted; no-op is fine. Skip on empty no-ops,
   `disproven`, FAIL, residual-only. Hygiene re-run FAIL reverts **hygiene only** (product
   land kept). **Hard:** never edit already-landed product paths without a pre-hygiene
   content snapshot; no-snapshot deletes are **untracked junk only** (never clean tracked
   product); if isolation is impossible, leave contaminated paths **unstaged** and set
   Outcome **`partial`**. Prefer new paths / untracked-junk deletes.
   **Not** a new phase banner or L2 step.

**Sibling skill.** `review-converge` implements the review/fix specialization of this
family (material/minor + clean-streak ×2; native-first, optional tools). Improve-loop’s
multi-cycle is L1 autonomous campaign driver, not host re-drive. Legacy invoke name
`grok-review-converge` is a deprecation alias only.

## Preconditions

Fail fast in Phase 0. Do not half-run a cycle.

- **Shell must spawn.** Run L3 `scripts/shell-probe.sh --repo "$TARGET_REPO"` (or equivalent
  git checks). If the tool **fails to spawn** (e.g. host `IO Error: No such file or
  directory`) or the probe exits non-zero: **stop immediately** — report
  `blocked (shell unavailable)`, include the host/probe error, and state that
  worktree/test/commit cannot proceed. Do **not** thrash: no scheduler loops, no
  multi-subagent delete cascades. File-only tools cannot complete this skill.
  **Host sticky-CWD hazard:** some local sessions **keep the current directory
  across shell commands** (e.g. Grok Build ≥0.2.102). If a prior turn `cd`'d into a campaign worktree (or subagent
  worktree) that was later **removed** (merge-back teardown, `git worktree remove`), the
  host may fail **every** later spawn with bare ENOENT — even `/bin/echo` — while file tools
  still work. **Operator recovery:** fully quit the host session (not only `/clear`), restart
  from a directory that exists (`cd /path/to/repo && <host>`), probe with `/bin/pwd && /bin/echo ok`,
  then re-invoke. Closing **Next** on this stop must say so explicitly.
- The working tree must be inside a **non-bare** git repository: `git rev-parse --show-toplevel`
  succeeds and `git rev-parse --is-bare-repository` is not `true`. Commits are the durable
  ledger; without git there is no Phase 4. `git worktree` must work (refuse if
  `git worktree list` fails).
- **Paths** (resolved in Phase 0 step 1a):
  - `ORIGINAL_CWD` — host sticky path at `/improve` entry (L1); restored on L1 exit.
  - `TARGET_REPO` / `LAUNCH` — destination checkout; **outer sticky CWD for the campaign**
    (may differ from host session). Prefer product-relative commands from here.
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
- **Launch WIP is carried into WORKSPACE on cold-start (L3).** `worktree-enter` creates the
  campaign worktree from `HEAD`, then **snapshots non-ignored launch WIP** into WORKSPACE
  (`git diff HEAD --binary` + apply for tracked changes; copy untracked `exclude-standard`
  files). **Renames** include both old and new paths (porcelain `R`/`RM … -> …`) so the
  delete half lands. Isolation paths (`.worktrees/`, `IMPROVE_LOOP.md`, `.gitignore`) are
  **not** carried (ledger migrate is separate). **Ignored** files are not carried. On
  success, those same paths are **cleaned on launch** (tracked restored to `HEAD` or removed
  if not in HEAD; untracked carried files removed) so launch stays merge-back-clean. Apply
  failure leaves launch dirty and tears down the new worktree (exit **9**). If launch clean
  fails **after** a successful apply, WORKSPACE is **kept** (only copy of WIP) and exit **9**
  without teardown. Resume (`--resume`) does **not** re-carry.
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
- **Launch dirt (L3 — carry, do not freehand-stash).** On **enter**, non-ignored launch WIP
  (tracked + untracked) is **carried into WORKSPACE** then **cleaned from launch** (see
  preconditions above). Isolation paths are never freehand-stashed or carried as WIP.
  `merge-back` still classifies any *remaining* launch porcelain into:
  - **isolation** — `.gitignore`, `IMPROVE_LOOP.md`, `.worktrees/` (non-blocking)
  - **ambient** — paths under prefixes from env `IMPROVE_LOOP_AMBIENT_PREFIXES`
    (default when unset: `cron/,wiki/`; set to empty or `-` for strict no ambient)
  - **code** — everything else (blocks merge-back if still dirty after enter)

  After a successful enter, launch should be free of carried product/ambient WIP. New dirt
  that appears on launch **mid-campaign** still blocks merge-back (exit 3). **Do not**
  `git stash` launch dirt to force enter or merge — use L3 carry on enter; for mid-run
  launch dirt, operator commit/discard/move.

## Durable state: git commits (self-contained cycles)

**Git is the only durable ledger.** Each cycle’s Phase 4 commit body carries Thesis, Outcome,
test evidence, What landed, advisor consolidation, Notes, stop-condition state (including
**consecutive-non-material-cycles**), **`Next backlog:`** **open-only** `- [ ] P0/P1:` lines
(or empty + streak — **no** done `[x]` lines in the work queue), and **`Next deferred:`**
open P2 lines (or `Next deferred: (none)`). Finished work and *why* it was an improvement
are recovered from **Thesis / Outcome / What landed / Notes** of prior improve commits — not
from backlog checkboxes. Deferred is metadata only — no product code required. The next
cycle rebuilds continuity from:

```bash
git -C "$WORKSPACE" log --grep="improve-loop: iteration" -n 15 --format="%H%n%s%n%b%n---"
```

**Not durable / not for recovery:**

- Pointer `active.json` — **run lock for this invoke only**; discarded on entry of the next
  `/improve` (default) and cleared on exit.
- `IMPROVE_LOOP.md` — **optional ephemeral** file during a run (advisors / local notes). May
  be committed mid-campaign or terminal-archived, but **must not** be required to resume a
  later invoke. Prefer deriving backlog from the latest commit’s `Next backlog:` block and
  deferred from `Next deferred:` (or archived `## Deferred (P2)`).

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
<!-- open P0/P1 only — completed items are deleted; memory is git commit bodies -->
- [ ] P0: <item> — <why material>
- [ ] P1: <item> — <why material>

## Deferred (P2)
<!-- open P2 only -->
- [ ] P2: <item> — <why deferred / not material this campaign>

## Stop-condition tracking
- consecutive-no-progress: 0
- consecutive-same-error: 0 (signature: none)
- consecutive-non-material-cycles: 0

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

   Exit-code map (worktree-enter): `3` lock busy → stop; `4` reserved (legacy dirty-block;
   product dirt is now carried into WORKSPACE); `5` tracked legacy ledger → stop
   (operator `git rm`); `6` path traversal → stop; `7` worktree create/repair failed → stop;
   `8` bare → stop; `9` launch WIP carry failed (launch left dirty; worktree torn down) → stop;
   **`10` `carried-wip-discard-blocked`** — a live pointer exists and default discard-stale would
   destroy the **only** copy of carried launch WIP and/or non-isolation campaign dirt
   (launch was cleaned after carry). **Worktree and pointer are kept.** Operator must
   `--resume` the same campaign, or recover WIP from the worktree then
   `campaign-teardown` / merge-back. **Never** re-invoke bare `worktree-enter` without
   `--resume` while a post-carry pointer is active.

   If `mode == merge-back-only`: run Phase 5 merge-back only (L3 `merge-back.js`); stop.

   **Default is discard-stale + cold-start** — never freehand resume — **except** when
   discard would lose carried WIP (exit **10**, fail-closed). Use `--resume` only when
   the operator asked **or** when continuing after carry (exit 10 recovery). Random 6-hex
   slugs + `.worktrees/` gitignore stay required.

   Optional status snapshot for kickoff card:

   ```bash
   node "$SKILL_DIR/scripts/ledger-status.js" --workspace "$WORKSPACE"
   ```

   **After WORKSPACE is set:** outer sticky CWD stays on **LAUNCH / TARGET_REPO** (destination
   repo). Do **not** bare-`cd` into WORKSPACE; do **not** leave sticky on the original host
   session repo if it differs.
   - Prefer product commands **from TARGET_REPO/LAUNCH** sticky root (reduces relative-path risk).
   - Campaign tree: `git -C "$WORKSPACE"` / `(cd "$WORKSPACE" && eval "$TEST_COMMAND")` /
     `make -C "$WORKSPACE" …`.
   - Subagents: absolute WORKSPACE as tool `cwd` / paths; same no-sticky-in-worktree rule.
   - See **Shell CWD discipline** (pin destination, homecoming on L1 exit).


2. If this is a **new cold-start / discard-stale-cold-start** (default): seed an ephemeral
   backlog **and Deferred** from the **git digest** (step 7) + target, even when main tip is
   an old `improve-loop: … complete` archive. **Do not** refuse reseed because of historical
   terminal archives — those are prior campaigns' learnings, not this run's resume file.
   Optionally write ephemeral `$WORKSPACE/IMPROVE_LOOP.md` for advisors; or keep state
   in-memory and encode `Next backlog:` + `Next deferred:` in the cycle commit body. Seed
   **1–3 P0/P1-tagged** items (see residual discipline); **also seed `## Deferred (P2)`** from
   the digest’s union of prior `Next deferred:` / archived Deferred (dedupe, cap 8–12;
   empty OK — see Seed). Never enter Phase 1 with zero open P0/P1 on cold-start (Deferred
   alone does not satisfy that). Init `consecutive-non-material-cycles: 0` (or recover from
   latest commit body if present). Set `N = 1`. Skip 3a–4; go to step 5.

   If mode is **`--resume`** and ledger is absent after terminal land on **this** worktree:
   merge-back-only / stop (true same-campaign recovery).

3. Otherwise read the Backlog, **Deferred (P2)** (create empty section if missing),
   Stop-condition block, and last two or three Log entries.
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

5. If the Backlog has no unchecked **P0/P1** items while Status is `active`, skip **Phase 1
   execute only** (residual-only cycle — common when non-material streak is 1). Do not skip
   the rest of Phase 0: steps 6–7 still run; Phase 3 must re-survey. Allocate this cycle's
   `N` if needed. After step 7 use lightweight Phase 2, then Phase 3, Phase 4, and Phase 5.
   Do **not** invent fake P0/P1 to force execute work.

   For the **lightweight Phase 2** residual/empty-execute path, append an entry with
   `Committed: pending`, Thesis such as `residual survey (non-material streak k→k+1)` or
   `empty-backlog replan (no Phase 1 execute)`, Test result `PASS` (suite not re-run for
   execute; Phase 3 may run confirmation), **Outcome `partial` only** (hard — **never**
   `confirmed` when no product land / empty `CHANGED_PATHS`; residual is bookkeeping, not a
   proven fix), Error signature `none`. Hold no-progress / same-error counters *exactly* as
   they were (do not apply PASS/partial reset). Set the header counter to `N`, then run
   Phase 3 normally.

   **Commit-body-only residual (no `IMPROVE_LOOP.md`):** when the campaign keeps state only in
   git commit bodies (ephemeral ledger never written), Phase 4 may use
   `git commit --allow-empty` **only** for residual-only / empty-execute cycles, and **only**
   with the full enumerated body (Thesis, Outcome **`partial`**, Test evidence, What landed
   `no code landed`, Advisor consolidation, Notes, **Next backlog** empty+streak, **Next
   deferred** required — list or `(none)`, stop state). Prefer an ephemeral ledger when
   advisors need a file; allow-empty is allowed, not preferred. Never ship a residual commit
   with a subject-only / empty message body.

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
   - From the 15 bodies, extract a compact, in-memory digest: per iteration, its **Thesis**,
     **Outcome** (explicitly flag any `disproven` and any `confirmed` success with *why*),
     **Test evidence** (STATUS + signature summary), **What landed** (paths / no code),
     **Advisor consolidation** (if present), **Notes for next cycle**, open-only
     **`Next backlog:`** P0/P1 lines (ignore legacy `[x]` if present in old commits — treat
     them as COMPLETED_SET candidates, not work-queue lines), and **`Next deferred:`** /
     any archived open `## Deferred (P2)` block.
   - **Build COMPLETED_SET** (semantic short lines) from iterations whose most-recent
     Outcome was `confirmed` (Thesis + What landed + one-line why), and from legacy
     `- [x]` Next-backlog lines if any appear in older bodies. **Build DISPROVEN_SET**
     from most-recent `disproven` theses (with disproof evidence). These sets are the
     anti-reseed memory — **not** live Backlog `[x]` lines.
   - **Union open Deferred** across newest-first deferred blocks (dedupe semantically) so
     cold-start and residual surveys can **carry forward** prior open P2s. Do not
     auto-promote those into Backlog P0/P1.
   - **Supplement, don't prefer-git.** Use the git body as the primary source, but for any
     field absent or clearly incomplete in the body — notably commits written before the
     Phase 4 enumerated-body rule, whose bodies are thin prose while the `IMPROVE_LOOP.md`
     Log entry for the same iteration has the structured Thesis/Outcome/Error-signature/Notes
     — supplement that field from the Log. Only if git and the Log *conflict on a factual
     claim* (Thesis or Outcome) do you note the discrepancy in this cycle's Log Notes; mere
     verbosity differences are not a conflict. The Log is already visible to advisors via
     `IMPROVE_LOOP.md`, so they see both sources regardless. When the live ledger has
     `## Deferred (P2)`, treat it as authoritative for *this* run and merge with digest
     deferred (ledger wins on conflicts for open P2 lines).
   - Carry this digest forward into Phase 3 (Round 1 and the consolidation guard) and Phase 1
     (selection backstop — **P0/P1 only**; never execute Deferred). It is in-memory for the
     turn, like `TEST_ARTIFACT_PATHS`; do not persist the digest blob into `IMPROVE_LOOP.md`
     (the Deferred *section* is the persisted form).
   - **Bounded lookback:** a thesis disproven more than 15 iterations ago is outside the
     digest and is not guarded; 15 is a pragmatic bound, not a completeness guarantee.

   Pass paths or pointers into agents rather than inlining a large log dump; the digest
   itself is small enough to pass as a compact summary.

### Phase 1 — Execute

Select the next **open** (`- [ ]`) **Backlog** item (`P0:` / `P1:` only). If any legacy
`- [x]` line still appears in Backlog, strip it first (memory is git digest) and do not
select it. **Never** select a `## Deferred (P2)` / `P2:` line for execute. As a backstop,
before selecting, skip any open Backlog item that re-asserts **COMPLETED_SET** work or a
prior **disproven** thesis **unless** the item's rationale explicitly re-opens it with a
stated reason (per Phase 3). This catches reseed that survived replan. It reads
COMPLETED_SET / DISPROVEN_SET from Phase 0 step 7 (git commit-body metadata) and judges
semantically, not by substring match.

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
  output and is never staged — **except** post-PASS hygiene paths intentionally extended
  below. Phase 4 stages code paths only from this git-grounded set (pre-test plus any
  post-PASS hygiene extension) — never from the executor's `WHAT_CHANGED` alone.

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
  deletes the item from the queue nor counts the no-op as progress (see the empty-
  `CHANGED_PATHS` matrix row). This is deliberate policy for pure "confirm X is already
  correct" investigation items: they legitimately land zero paths, stay `partial`/open, and
  must not be treated as completed on a later cycle.

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

- **Post-PASS hygiene (directive — not a separate phase).** Run **only** when all hold:
  `STATUS` is **PASS**, Outcome is `confirmed` or `partial` (not `blocked` / not `disproven`),
  and pre-hygiene `CHANGED_PATHS` is **non-empty** (real product land — not a green no-op).
  **Skip** residual-only / empty-execute, empty-`CHANGED_PATHS` investigations, FAIL, and
  disproven (do not document or polish a failed thesis). For **`partial`**, only hygiene that
  documents *already-landed* behavior or removes litter the partial work created — never
  aspirational docs for unfinished remaining work. **Before Phase 2**, the orchestrator
  **considers** (judgment only — not mandatory work every cycle):

  1. **Documentation** — did this cycle’s landed behavior leave any *consumed* docs stale or
     incomplete (README, AGENTS.md, SKILL.md, architecture notes, generated doc regions the
     repo already owns)? Prefer updating those surfaces over inventing new doc systems.
  2. **Repo / git cleanup** — did this change, merge, or consolidation leave removable tech-debt
     litter in scope (`.bak`, superseded dual copies, dead paths the thesis retired, other
     stale artifacts clearly obsolete now)? Pathspec-safe only; **never** broad `git clean -fd`,
     freehand stash, or whole-repo archaeology.

  Emit a short reasoning beat: `· considering · docs + scoped cleanup` /
  `· evaluates · gate open? · stale docs? · removable debt?` / `· about to · apply | no-op | skip`.

  **If action is warranted** (cheap, in-scope, clearly correct):
  1. Snapshot `HYGIENE_BASE := CHANGED_PATHS` (product paths before hygiene). Init
     `HYGIENE_TOUCHED := ∅` and `HYGIENE_SNAPSHOTS := {}` (path → pre-hygiene bytes).
  2. **Path class rule (hard — not optional):**
     - **Allowed without snapshot:** create **new** (previously non-existent) paths not in
       `HYGIENE_BASE`; or delete **untracked** junk / known litter only (e.g. `*.bak`, `*~`,
       `*.orig`, dual-copy leftovers that `git status` shows as `??`). **Never**
       `git rm` / delete a **tracked, clean** path outside `HYGIENE_BASE` as “hygiene” —
       that is out-of-scope product deletion, not post-PASS cleanup.
     - **Allowed only with snapshot:** edit or delete a path already in `HYGIENE_BASE` —
       first copy pre-hygiene content into `HYGIENE_SNAPSHOTS[path]`, then edit/delete.
       Without that snapshot, **do not apply** the edit (skip that path; Notes
       `post-PASS hygiene skipped product-path edit without snapshot: <path>`).
     Prefer new paths / untracked-junk deletes so FAIL isolation stays trivial.
  3. Apply the allowed edits/deletes under WORKSPACE. Add every created / deleted /
     content-edited path to `HYGIENE_TOUCHED`.
  4. Re-parse porcelain and **extend** `CHANGED_PATHS` with any new hygiene paths (still drop
     `IMPROVE_LOOP.md` and paths in `TEST_ARTIFACT_PATHS`). Let
     `HYGIENE_PATHS := CHANGED_PATHS − HYGIENE_BASE` (net-new paths this fold-in added).
  5. Pure prose docs or deletes do **not** re-run the suite by default. If hygiene edits
     **executable contract** sources the recorded command covers, re-run the suite **once**
     and re-apply the shared `TEST_ARTIFACT_PATHS` capture **before Phase 2**.
  6. **Hygiene re-run FAIL:** do **not** treat the original green product thesis as FAIL.
     Revert hygiene isolation only:
     - Every path in `HYGIENE_PATHS` (new): `git restore -SW` / delete untracked.
     - Every `HYGIENE_BASE` path in `HYGIENE_TOUCHED` that has `HYGIENE_SNAPSHOTS[path]`:
       restore file bytes from that snapshot (not a blind `git restore` to HEAD — that would
       drop product land).
     - Restore `CHANGED_PATHS := HYGIENE_BASE`; keep STATUS **PASS** and the pre-hygiene
       Outcome; Notes
       `post-PASS hygiene re-run FAIL — hygiene paths reverted; product land kept`.
     - **Fail-closed if any product-path hygiene lacks a snapshot** (agent violated the hard
       rule; isolation impossible for those paths):
       1. Still revert every isolatable path (`HYGIENE_PATHS` + snapshotted `HYGIENE_BASE`
          touches) as above.
       2. Let `CONTAMINATED := (HYGIENE_TOUCHED ∩ HYGIENE_BASE) − keys(HYGIENE_SNAPSHOTS)`.
       3. **Do not stage `CONTAMINATED`:** set
          `CHANGED_PATHS := HYGIENE_BASE − CONTAMINATED` for Phase 4 (product paths that
          hygiene never touched still land). Leave `CONTAMINATED` dirty in the worktree so
          the next Phase 0 dirty-tree guard surfaces them — do **not** fold contaminated
          content into the iteration commit.
       4. Keep STATUS **PASS**. **Set Outcome to `partial`** whenever `CONTAMINATED` is
          non-empty (never leave pre-hygiene `confirmed` when isolation failed — the Log must
          not claim full land while contaminated product is unstaged). Notes
          `post-PASS hygiene re-run FAIL — cannot isolate <paths>; left unstaged; Outcome
          partial`. Do **not** invent a full product FAIL revert.
     Do **not** invent a second full FAIL revert of product code. Proceed to Phase 2.

  **If nothing material:** optional Notes
  `post-PASS hygiene: considered docs + repo cleanup; no changes`. Do **not** invent P0/P1
  solely for hygiene theater.

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
code actually landed this cycle), **remove** the selected open line from `## Backlog`
entirely (open-only work queue — do **not** flip to `[x]` and leave it). Capture Thesis /
Outcome / What landed / Notes on the Log entry so Phase 4 banks the learning in the
**commit body** (that is the durable done memory). Without the delete, Phase 1 could
re-select the same open line later this campaign; without the commit-body fields, the next
invoke would lose *why* it was improved. Leave the line **open** (`[ ]`) on FAIL,
`disproven`, `blocked`, or `partial` — for `partial`, progress landed but the item is not
fully done, so it stays for the Phase 3 panel to refine (rewrite remaining work) or a later
cycle to finish. Never delete a `partial` item as if complete.

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
cross-exposure/rebuttal when needed, final consolidation, then a surgical **Backlog +
Deferred (P2)** update. It prevents an unattended loop from drifting silently.

#### Advisor configuration and non-edit authority

Use a **configurable optional advisor list** (0..N tools). **Default: empty** — run
Consolidation 1's **native-replanner fallback** only. When the operator or session has
configured advisors (or clearly wants multi-model review this cycle), dispatch each available
advisor; examples of fill-ins if installed: `general-purpose` (read-only ask),
`codex:codex-rescue`, `grok-cc:grok-rescue`, or any other read-only agent/CLI. **Never**
hard-fail Phase 3 because a named vendor plugin is missing.

**Advisors are optional.** Zero usable advisors is fine: native-replanner still produces a
Backlog. Dispatch each available advisor through the host's agent/CLI mechanism and let that
mechanism provide concurrency — do not hand-roll background jobs. They have full access to
WORKSPACE and should see uncommitted diffs and the full `IMPROVE_LOOP.md` Log (this cycle's
Phase 2 entry included). Scope: (a) advisors never edit, (b) consolidation keeps new Backlog
items scoped to the stated target; (c) “consider later” / non-material follow-ups go in
**Deferred (P2)** (preferred); out-of-scope one-offs may stay in Log Notes. The list may grow
or shrink; the mechanism is unchanged.

**Read-only dispatch.** In every advisor prompt, ask for read-only behavior in plain
language: `This is a read-only advisory review. Do not make any edits or run any write
commands. Diagnose and recommend only.` Prefer tool-native read-only modes when available;
do not require any specific vendor flag. The read-only ask is a natural-language heuristic,
not a hard sandbox guarantee — the post-panel tree check further below is the backstop if it
ever misfires and an advisor writes anyway.

#### Budget and usability

Let the host **Agent/tool runtime own the async** — it runs advisors and returns each
one's text when finished (no hand-rolled job polling). Prefer a fresh dispatch per advisor
round unless the host provides a reliable resume handle. Give each advisor round a soft
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
advisor). Give each the target description; the path to `IMPROVE_LOOP.md` (**live ledger** —
**open** Backlog, **open Deferred (P2)**, Log, counters for this run); the
**prior-learnings digest** built in Phase 0 step 7 from **git commit bodies** (last 15
iterations' Thesis / Outcome / Test evidence / What landed / Advisor consolidation /
Notes / open **Next backlog** / **Next deferred**, plus **COMPLETED_SET** and
**DISPROVEN_SET**), plus a pointer to general non-improve-loop history
(`git log --oneline -20`); and this cycle's Phase 1 report, or the lightweight empty-backlog
Thesis/Outcome. Planning **must** use both the open work queue and git learnings metadata.
Pass pointers and paths rather than inlining all content; each advisor has repository access.
Ask independently:

> Does the recent work—and the open Backlog's direction—still serve the stated purpose?
> What do you recommend next as **material open P0/P1**? What belongs only in **Deferred
> (P2)** (consider later)? What risks or concerns exist? Review the **git commit-body
> learnings** in the digest (Thesis, Outcome, What landed, Notes — why something improved
> or was disproven). Do **not** re-propose work in COMPLETED_SET or a most-recent disproven
> thesis unless you give a concrete re-open reason (new evidence, changed conditions, or
> flawed prior disproof). Do not auto-promote Deferred to P0/P1 without stating why it is
> now material. Propose **open checklist lines only** (`- [ ] P0/P1` / `- [ ] P2`) — never
> `- [x]` done lines in Backlog or Deferred.

The **native-replanner fallback** (Consolidation 1, below) receives the same inputs as Round
1, so it gets the digest **and** ledger automatically; COMPLETED_SET / DISPROVEN_SET guards
below apply to its Backlog candidate identically.

Prefer a structured response with recommended next **open** Backlog bullets **and** open
Deferred (P2) bullets, but accept free prose. **Every open Backlog item must be tagged
`P0:` or `P1:`**; open deferred items use **`P2:`** under Deferred only. Record per advisor
its returned text (or failure) **and its Agent id/name** — that id is how Round 2 resumes
that exact advisor.

#### Consolidation 1 — native

Do this synthesis in the orchestrating context, not another dispatch. Identify agreement,
disagreement, and the range of recommendations. If zero advisors produced usable Round-1
text, skip Round 2 and use the **native-replanner fallback** for this cycle only. Give that
single native replanner the same inputs Round 1 received and require a **Backlog body** (P0/P1)
**and** a **Deferred body** (P2 or none). Append one line to the latest Log Notes recording
the full-panel failure. Do not allow advisor infrastructure flakiness to stall the loop.

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
fallback—must be **two section bodies** (not a free-form essay or whole-file rewrite):

1. **Backlog body** — **open only** `- [ ]` lines tagged `P0:` or `P1:` (empty OK when residual
   complete path). **Never** include `- [x]` lines.
2. **Deferred body** — **open only** `- [ ] P2:` for `## Deferred (P2)`, or explicit empty
   (`(none)` / no open P2 lines). Cap ~8–12 open P2s; dedupe.

Apply surgically and natively: replace only the `## Backlog` body through the next `## `
heading, and only the `## Deferred (P2)` body through the next `## ` heading (create the
Deferred heading if missing). Never ask an advisor or fallback replanner to rewrite the
whole file; that can clobber deterministic counters and the append-only Log.

**Open-only + anti-reseed strip (native, before surgical apply).** Before applying:

1. Drop any candidate line matching `- [x]` / `- [X]` with Notes
   `legacy [x] stripped from Backlog — memory is git digest`.
2. If a proposed `- [ ]` is a semantic duplicate of **COMPLETED_SET** (from git commit
   Thesis/Outcome/What landed) without re-open rationale: drop with Notes
   `replan re-opened completed work — dropped`.
3. Apply the disproven-thesis guard (below) against **DISPROVEN_SET** from git.

**P2-in-Backlog strip (native, before surgical apply).** If any open candidate Backlog
line contains `P2:`, move it into the Deferred body (or drop with rationale) and append Notes
`P2 line removed from Backlog → Deferred`. Residual and Phase 1 only see open P0/P1 in Backlog.

**Deferred replan failure (native, parallel to Backlog).** If the Deferred body is missing,
unparseable, or would wipe a formerly non-empty open-P2 list without explicit drop/complete
rationale: **keep prior Deferred**, append
`deferred replan unusable; Deferred unchanged` to Notes, and still apply a valid Backlog
(or keep prior Backlog under its own rule). Deferred failure **must not** reset residual
streak, invent P0/P1, or block Status complete.

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
- This guard operates on open (`- [ ]`) proposals only. If the guard drops *every* proposed
  item, the candidate is empty and the validation below may fire intentional empty-backlog
  (residual) **or** `replan output unusable; Backlog unchanged` when a wipe lacked
  complete/stop rationale; append
  `all proposed items re-asserted disproven theses; Backlog unchanged` when that is the
  cause so it is legible (filtered, not unparseable).

Before replacing, validate the candidate is **open-only** checklist lines matching
`^- \[ \] ` with `P0:`/`P1:`, **or** an intentional empty-backlog completion: clearly stated
`no remaining work` / zero open items / residual complete path. Advisors and the
native-replanner may add, reprioritize, or drop open items freely. If the candidate is
unparseable, or would wipe a formerly non-empty open Backlog **without** explicit
complete/stop/residual rationale, do not apply it. Keep the prior Backlog, append
`replan output unusable; Backlog unchanged` to the latest Notes, and let the terminal test
below evaluate only counters; do not invent `complete` from a wiped list.

After the rounds and surgical apply or deliberate non-apply, re-check for code-dirtiness
using the **shared code-dirty definition** (Phase 0 step 4; excludes `IMPROVE_LOOP.md` and
this turn's `TEST_ARTIFACT_PATHS`). Advisors are read-only. If any code path is newly dirty
relative to the post-Phase-1/post-revert baseline and is not already accounted for in this
cycle's PASS `CHANGED_PATHS`, treat it as an infrastructure fault:
do not stage it and append `unexpected dirty paths after advisor panel: …` to Notes. On a
ledger-only turn, Phase 4's code-dirty veto will correctly refuse to commit; on a PASS
turn, leave unexpected paths unstaged so the next invocation's Phase 0 dirty-tree guard
stops. Never fold advisor-side dirt into the cycle commit.

Immediately after surgical apply or deliberate non-apply, and without a subagent, update
**residual streak** then Status *in this exact order*:

0. **Open P0/P1 count** after replan = number of unchecked **Backlog** lines containing
   `P0:` or `P1:` (**ignore** `## Deferred (P2)` / `P2:` lines entirely).
   - If count = 0 → `consecutive-non-material-cycles` **+1**.
   - If count ≥ 1 → `consecutive-non-material-cycles` **reset → 0**.
1. `consecutive-same-error >= 3` → `stopped (same-error ×3)`
2. `consecutive-no-progress >= 3` → `stopped (no-progress ×3)`
3. Open P0/P1 = 0 **and** `consecutive-non-material-cycles >= 2` → candidate `complete`,
   **but gate on a green suite** — never sign off without a green suite. Sub-cases:
   - **(a) Normal PASS cycle with non-empty `CHANGED_PATHS` this cycle:** suite already green
     → set `complete`.
   - **(b) Residual-only / empty-execute lightweight path** (suite not run for execute): run
     the recorded test command once now as confirmation — snapshot `pre_suite` before,
     **extend `TEST_ARTIFACT_PATHS`** after (Phase 1 shared capture), *before* Phase 4 veto.
     PASS → `complete`. FAIL → do **not** complete: leave Status `active`; append
     `- [ ] P1: fix regression surfaced by completion check: <short error>`; **correct** this
     cycle's not-yet-committed lightweight entry in place: `Test result` → `FAIL`,
     `Outcome` → `blocked`, `Error signature` → real signature; apply completion-gate counter
     rule once here: `consecutive-no-progress` **+1**; `consecutive-same-error` by FAIL-row
     semantics; **reset `consecutive-non-material-cycles` → 0** (open P0/P1 reopened).
   - **(c) FAIL cycle, successful revert, open P0/P1 = 0, streak ≥ 2, tree not code-dirty:**
     run confirmation suite on reverted baseline (shared capture). PASS → `complete` without
     resetting no-progress. FAIL → leave `active`, append P1 regression item, do not
     double-count FAIL matrix; reset non-material streak → 0.
4. Open P0/P1 = 0 **and** `consecutive-non-material-cycles == 1` → leave Status **`active`**
   (need one more residual cycle). Do **not** complete.
5. Otherwise leave Status `active`.

Advisors never edit counters. Order matters: same-error before no-progress; residual streak
before complete. Update Status before Phase 4 so the terminal note is in the same commit.

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
    is a first-class learning, not an omission. **Residual / empty-execute / empty
    `CHANGED_PATHS` bookkeeping → `partial` only** (never `confirmed` without real product
    land).
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
  - **Next backlog** — required. **Open work queue only** — `- [ ] P0:` / `- [ ] P1:` lines
    still open after replan. **Do not** emit `- [x]` done lines here (finished work + *why*
    are already in Thesis / Outcome / What landed / Notes above; next cycle’s COMPLETED_SET
    is built from those fields):

    ```
    Next backlog:
    - [ ] P1: <still open> — <rationale>
    ```

    When open P0/P1 count = 0:

    ```
    Next backlog:
    (open: empty) — consecutive-non-material-cycles: <n>
    ```

    Equivalent short form `Next backlog: (empty) — consecutive-non-material-cycles: <n>` is
    also fine. Status `complete` only if n ≥ 2 and suite green; else still active.
  - **Next deferred** — required on **every** cycle (including residual-only, empty-tree
    allow-empty residual, and terminal). Open items **must** be `P2:`. No product file
    changes are required to land deferred metadata (ledger-only / terminal archive /
    commit-body-only residual is enough). Residual empty-tree commits **must still** emit
    this field so P2s remain greppable:

    ```
    Next deferred:
    - [ ] P2: <item> — <why deferred>
    ```

    Or when none: `Next deferred: (none)`.
    Terminal commits still include this block **and** the full ledger archive when a ledger
    file existed (so after `IMPROVE_LOOP.md` is removed, deferred remains greppable in git
    history).
  - **Stop-condition state** — `consecutive-no-progress` / `consecutive-same-error` /
    `consecutive-non-material-cycles` after this cycle, and any terminal `Status` set this
    cycle.
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
  one-line rationale **and** must still emit **`Next deferred:`** copied from on-disk
  `## Deferred (P2)` (or `Next deferred: (none)` if absent/empty) — never drop deferred on
  flush. A terminal empty-backlog or ledger-flush that sets Status terminal still must
  include the full-ledger archive block and remove the file.

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
Phase 0 ran. **Reporting (illustrative — see Status reporting):**

- **Every L2 cycle (both modes):** emit a **Cycle discovery card** (goal reminder, thesis,
  outcome, **Residual meter**, **Discovered this cycle**, backlog delta, **Deferred (P2)**,
  **Decision trail**) plus the greppable progress line (include `non-material=<m>/2`,
  `residual_only=`, `deferred=<n>`). Mid-cycle: **Reasoning beats** at each decision gate.
- **Autonomous mode:** after active cycles, L1 continues; full **Campaign report** (goal +
  cycles-at-a-glance + summary + **What this campaign did (arc)**) when L1 exits.
- **`--once` mode:** discovery/closing card at end of the single cycle; still emit
  **Campaign report** when L1 exits (even if Result is once-active).

| Condition | Action |
|---|---|
| Terminal + landed | Merge-back; emit **Merge-back card**; best-effort `update_goal(completed)` if goal Active; L1 exits → Campaign report |
| Terminal + not landed | Do **not** complete host goal; L1 exits → report blocked/stopped |
| Active after cycle, **autonomous** | Cycle discovery card + progress line; **L1 continues next L2 cycle now** (do not stop for user) |
| Active after cycle, **`--once`** | Cycle discovery / closing card; L1 exits → Campaign report (Result once-active) |
| Dirty/veto before Phase 5 | Discovery card (blocked) + report; never invent terminal Status over dirty code; L1 exits if blocked |

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
  `suggested_cwd` is the durable path (LAUNCH); also `worktree_removed`, `branch_deleted`,
  `pointer_cleared`, `ignored_ambient`, `blocking_dirt`. On blocked/skipped, leave WORKSPACE;
  print the FF command from notes/error. Land is durable even if merge-back fails. Prefer the
  script over freehand FF so teardown order (FF → remove worktree → delete branch → delete
  pointer) stays correct. **Never** leave sticky under a removed `.worktrees/*`.
  **Never freehand-stash** launch dirt to force merge — L3 ignores ambient prefixes; real
  code dirt requires operator commit/discard.

  Emit a **Merge-back card** (mandatory after the L3 call, success or fail):

  ```markdown
  ### 🔗 Improve · merge-back

  | | |
  |---|---|
  | **Result** | ok \| blocked \| skipped_detached \| teardown_partial |
  | **FF into** | `<launch_branch>` · campaign `<campaign_branch>` |
  | **SHAs** | `<short tip after FF or —>` |
  | **Worktree removed** | yes \| no |
  | **Branch deleted** | yes \| no |
  | **Pointer cleared** | yes \| no |
  | **Ambient ignored** | <paths or _(none)_> |
  | **Blocking dirt** | <paths or _(none)_> |
  | **Error** | <one line or —> |
  | **Next if blocked** | clean/commit blocking paths · re-run `merge-back.js` / `/improve` merge-back-only |
  ```

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
`.claude/ralph-loop.local.md` are deprecated for this skill). Sibling `review-converge`
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
