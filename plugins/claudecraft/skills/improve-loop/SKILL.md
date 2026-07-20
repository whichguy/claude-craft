---
name: improve-loop
description: >-
  Run a worktree-isolated improvement campaign until terminal, then emit one end report:
  default is autonomous multi-cycle in a single invoke (execute, test, learn, multi-model
  replan, commit, loop). Use --once for a single gated cycle; use --product / product / ux /
  integration / roadmap for product/UX seed mode (limitations + deferred P2 + operator surfaces,
  not residual-empty-only). Invoke for "/improve <target>", "/improve --once <target>",
  "/improve --product <target>", "/claudecraft:improve-loop <target>", "/improve-loop <target>",
  "improve this project iteratively", or "run a tested improvement cycle".
---

# Improve loop

> **Home B (runtime monolith).** This tree is the campaign runtime (`SKILL.md` + `scripts/` + `tests/` + goal template). Marketplace mirror is **M** (allowlist copy of B). Normative **law source** is home **A** (`…/claude-craft/…/skills/improve-loop` thin SKILL + `references/**`). **Edit A first for law-text changes**, then mirror here, then M (`dual-home.md` / H15–H18). Sole document H1 is this title; `#` lines inside fenced templates are examples, not outline headings.

## Section map (scan first)

| Section | Tag | Role |
|---|---|---|
| [Campaign architecture](#campaign-architecture-logical-separation) | **LAW** | L0/L1/L2/L3, Status continue, dual-home shape |
| [Planning contracts](#planning-contracts-tiers--multi-line-backlog) | **LAW** | PLAN_* summary, HYBRID spine, soft≠seed |
| [P0/P1 residual discipline](#p0p1-residual-discipline-default) | **LAW** | residual×2 complete, seed, product mode, caps |
| [Shell CWD discipline](#shell-cwd-discipline-mandatory) | **OPERATIONAL** | Sticky TARGET_REPO, worktree subshells |
| [Status reporting](#status-reporting-user-facing--mandatory) | **TEMPLATE** + **OPERATIONAL** | Kickoff / discovery / campaign cards + PLAN_ORIENT |
| [Invocation](#invocation) | **ENTRY** | Flags, target-repo resolve, test command |
| [Preconditions](#preconditions) | **ENTRY** | Shell probe, dirty intent, landing priority |
| [Durable state vs live ledger](#durable-state-vs-live-ledger-self-contained-cycles) | **TEMPLATE** + **LAW** | IMPROVE_LOOP.md shape (fenced example) |
| [The cycle](#the-cycle) | **LAW** | Phases 0–5 + 3v (mirrors A phase refs) |
| [Phase 3v — Spec validation gate](#phase-3v--spec-validation-gate-before-complete-rules) | **LAW** | 3v prove; R8 auto-continue; seeds validate V-k; never terminal |
| [Multi-cycle: L1](#multi-cycle-l1-campaign-driver-not-host-re-drive) | **LAW** | Cap / verify package contracts |

*Tags: **LAW** sections govern on any conflict; **OPERATIONAL** describes execution; **TEMPLATE** is copy-source; **ENTRY** is a landing point.*

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

**Self-contained cycles (product default):** Each L2 cycle is self-contained.

- **Git commit bodies** are the **durable ledger** across invokes (Thesis / Outcome / Test
  evidence / What landed / Advisor consolidation / Notes / open-only `Next backlog` /
  `Next deferred` / stop state). Phase 0 digests those fields for anti-reseed and replan.
- **`IMPROVE_LOOP.md` is the live plan (working memory; aka live ledger in older pins)** —
  **required mid-campaign** (must write on cold-start; maintain every cycle). Survives
  context-window compaction and is the `--resume` recovery surface for **this**
  pointer/worktree. It is **not** required on product `main` after terminal land (archived
  into the commit body, then removed).

There is **no cross-invoke resume** by default: entry **discards stale** pointer/worktree,
then cold-starts (new worktree + **new** live ledger from git digest). In-session multi-cycle
reuses the **same invoke’s** worktree only. Opt-in crash recovery: `--resume` on
`worktree-enter` / invocation.

**Package paths** (resolve relative to this skill directory):

```text
SKILL_DIR/references/goal-objective.template.md   # optional host /goal body (only references/* on B/M)
SKILL_DIR/scripts/shell-probe.sh
SKILL_DIR/scripts/worktree-enter.js
SKILL_DIR/scripts/resolve-target-repo.js   # ~/.claude install symlink → real git root
SKILL_DIR/scripts/campaign-teardown.js
SKILL_DIR/scripts/pointer.js
SKILL_DIR/scripts/ledger-status.js
SKILL_DIR/scripts/merge-back.js
SKILL_DIR/scripts/lib-paths.js
SKILL_DIR/scripts/carry-launch-wip.js
SKILL_DIR/scripts/backlog-blocks.js
SKILL_DIR/scripts/spec-validate.js
SKILL_DIR/scripts/complete-gate.js         # R7 pure complete evaluator (WP1)
SKILL_DIR/scripts/package-parity.js        # B↔M only — never A (H15–H18, WP0)
SKILL_DIR/scripts/contract-check.js
SKILL_DIR/scripts/run-case-bank.js         # S1 soft-check illustrative cases
SKILL_DIR/scripts/spec-sync-matrix.test.js # S2 Spec-sync matrix goldens (checker)
SKILL_DIR/tests/scripts.test.sh
SKILL_DIR/tests/cases/                     # S1 case-bank ledgers + expected.json
```

*Package-shape map: A `references/dual-home.md` (H15–H18) — ship-procedure law starts in A.*

**Dual-home shape (H16):** package **B** (this tree) and marketplace **M** are monolith
SKILL + `scripts/` + `tests/` + **only** `references/goal-objective.template.md`. Package **A**
(thin SKILL + full `references/`) is law text only — never rsync A `references/` into B/M.
**A carries references law only; scripts live in B and mirror to M.** `package-parity.js`
compares **B↔M only** (allowlist above) — never A, never claims A/script sync (WP0).
Ship SKILL + scripts + tests for a behavior in one atomic commit per home (H15). After B
script changes, copy to M and run `node scripts/package-parity.js --skill-dir "$SKILL_DIR"`.

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
3. **Cycle mode:** `autonomous` (default) unless the invocation has `--once` / `once` / “single
   cycle” / “one cycle only” → then `once`.
3b. **Seed mode (`SEED_MODE`):** resolve **before** Phase 0 seed (independent of once/autonomous):

   | `SEED_MODE` | Triggers (same-turn invoke text) | Cold-start seed |
   |---|---|---|
   | `defect` | default; or `defect only` / `residual only` / `defect-mode` | Today’s gap/residual rules; residual-empty seed OK when no material gaps |
   | `product` | `--product` / `--ux` or words `product`, `ux`, `integration`, `roadmap` (not only inside a quoted path) | **Must** seed 1–3 open P0/P1 from documented limitations, open Deferred P2, operator/UX surfaces, habitat integration — **cannot** cold-start with only residual survey |
   | `mixed` | target is a **skill** (path under `skills/`, named skill, or `SKILL.md`) **and** no explicit defect-only — default for skills | Prefer product seed rules; operator may force `defect` |

   Kickoff card **Setup** row: **Seed mode** = `defect|product|mixed`. Record `SEED_MODE` in the
   live ledger header (e.g. `**Seed mode:** product`) and every Phase 4 body as
   `Seed mode: <mode>`.
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
       **R8:** this includes after Phase 3v Spec validation **fail** (seeded `validate V<k>`
       items). 3v fail is **never** a terminal Status and **never** an L1 exit reason —
       keep coding/fixing until Spec validation is clean (header pass or vacuous n/a)
       **and** residual×2 complete, **or** hard stop (same-error/no-progress/max-cycles/blocked).
7. **When the loop exits:** emit the **Campaign report** once (goal restated, cycles-at-a-glance,
   summary — see Status reporting). Optional `update_goal(completed: true)` only if
   terminal+landed and a goal is Active (ignore tool errors if goal was never Active).
8. **Isolation teardown (ordered — do not collapse into “always teardown”):**
   ```text
   if terminal Status AND PHASE4_COMMIT_OK (landed):
     run merge-back.js
     if merge_back in {ok, ok_teardown_advisory, teardown_partial}:
       done  # merge-back already tore down; do NOT campaign-teardown
     if merge_back in {blocked, skipped_detached}
        OR process exit in {3, 4}
        OR pointer.state == reintegrate_blocked after merge-back:
       STOP; keep pointer/worktree/branch
       print: --resume → merge-back-only, or campaign-teardown --force-drop-reintegrate
       DO NOT call campaign-teardown.js
   elif mid-campaign block / cap / fail:
     if reintegrate-protected (unmerged improve-loop commits on campaign tip
        OR reintegrate_blocked with non-empty improve range):
       keep pointer; report; DO NOT teardown unless --force-drop-reintegrate
     else:
       campaign-teardown.js --repo "$TARGET_REPO"  # best-effort clear
   ```
   **Rationale:** merge-back exit 3/4 (and `skipped_detached`) already set
   `reintegrate_blocked` and keep the recovery surface. Calling `campaign-teardown`
   next destroys pointer/worktree and forces cherry-pick archaeology. Detached launch
   (`skipped_detached`, exit 0) is still protected — do not teardown.
9. **Homecoming:** `cd "$ORIGINAL_CWD"` when it still exists; else leave sticky on
   `TARGET_REPO`/`LAUNCH`. Never leave sticky under deleted `.worktrees/*`.

Never emit ralph promise tags. Never bare-`cd` the host into `.worktrees/*`.



## Planning contracts (tiers + multi-line backlog)

*Mirror of A `references/contracts/planning.md` (PLAN_* + HYBRID spine) — law changes start in A (`dual-home.md`). This section is the runtime summary.*

*R-coverage in this monolith (full table: A `contracts/planning.md` § Sequencing rules): R1 → HYBRID spine step order (derive V-rows before code) · R2 → “R2 mechanical” below · R3 → PLAN_SPEC_SYNC anchor citing · R4/R5 → Phase 3v gate (open P0/P1 = 0; fail seeds `validate V<k>`) · R6 → 3v re-seed `fix target: product | proof` · R7 → P0/P1 residual discipline (sole complete) · R8/R8b–d → “R8 — never treat 3v fail as terminal” + L1 driver. PLAN_SPEC_STATUS / PLAN_ORIENT / PLAN_PROGRESS_ALIGN law homes: A `contracts/progress.md`; PLAN_T2_CHALLENGE / PLAN_HABITAT_META runtime body: this monolith (B/M). planning.md registers planning-owned pins + a routing line. PLAN_LEGACY_A is A-dialect only (not summarized here).*

Elaborate planning without Spec Kit dependency. Summary of **PLAN_*** contracts:

| Pin | Meaning |
|---|---|
| **PLAN_TAG** | Greppable titles: `P0:` / `P1:` + kind `[defect]`…`[residual]` |
| **PLAN_CLAUSES** | Material six-clause: Evidence, Decision, Preserve, Unknown, Acceptance |
| **PLAN_RESIDUAL** | Residual thin Evidence+Acceptance only — no invented Decision/Preserve |
| **PLAN_BRIEF** | `## Campaign brief` after Isolation, before Backlog; **work-spec anchors** (Target; skill-law Done when) — no second `## Work Spec` table |
| **PLAN_CRITERIA** | Orchestrator **Criteria scan** preflight (not a 6th advisor block): surfaces, habitat claim, runtime, C1–C12 → promote\|P2\|waive (≤6); soft never auto-seeds; **+ design-time N&S** (simplify/overdesign/layer) on material seed & promote; soft only; prefer `simplify`\|`defer` |
| **PLAN_RUNTIME_CONTRACT** | Habitat claim + runtime state `n/a`\|`filled`\|`investigation-P1:<id>` as work-spec anchors. **When `investigation-P1:<id>`: Select that investigation before packaging-only items.** Close → rewrite brief to `filled` or scoped waiver Notes. Selection only — never residual×2 / Status gate |
| **PLAN_VALIDATE** | `## Spec validation` = **Validation Spec** (derived prove view); V-rows + Proofs; Phase **3v** prove gate |
| **PLAN_SPEC_SYNC** | Validation Spec **derived** from **work-spec** anchors; re-sync when plan diverges since `spec-sync: iter N` |
| **PLAN_SPEC_STATUS** | Control channel: step ids + Spec sync/prove evidence + one `Validation:` line |
| **PLAN_SPEC_SOFT** | **Must** run `spec-validate.js soft-check` after `3-spec-sync` and `3v-prove` (Node available): `softCheckSpecBundle` / `softCheckCoverageMix` / `softCheckHabitatCoverage`; never auto-seed P1; never alone blocks residual×2. Coverage-mix is **not** anti-mirror (row-class diversity only) |
| **PLAN_T2_CHALLENGE** | T2: native 5-block in Last cycle Notes when advisors fail/unconfigured (prefer always on T2); apply **work-spec** revisions **before** PLAN_SPEC_SYNC; degrade only if ledger unwritable |
| **PLAN_HABITAT_META** | Header `**Habitat claimed:**` + probe fields; residual/soft-check read ledger, not invoke text |
| **PLAN_ORIENT** | Tab-switch mid-cycle orientation: long-phase triplet, `(cont)` heartbeat, `· on:` footer |
| **PLAN_APPLY** | Multi-line contiguous blocks; complete = delete title+clauses; `backlog-blocks.js` |
| **PLAN_CLASSIFY** | promote / keep P2 / waive + Notes `classify: …` |

**Plan tiers:** T0 (defect residual thin cold-start), T0p (product post-scan empty promote), T2 (promote-class or `--plan-deep`), T1 (mid-campaign replan). Mid-campaign residual×2 may empty open P0/P1 (H11).

**HYBRID spine (intention → work-spec → Validation Spec → proof → code → 3v):**
(1) Normalize operator intention into **work-spec** = Campaign brief + material Backlog
(+ runtime contract when habitat claimed). (2) **Derive** `## Spec validation` V-rows from
those anchors (not free-authored product intent; not generic boilerplate) + proof artifacts
when R2. (3) Code. (4) Phase **3v** prove — fail seeds
`- [ ] P1: [defect] validate V<k>: …`. If proof design finds a hole: **revise work-spec first**,
then PLAN_SPEC_SYNC. **R8:** see “R8 — never treat 3v fail as terminal” (Phase 3).
residual×2 remains sole `complete` law
(never “all V pass ⇒ complete” alone). Soft ≠ seed. Rules R1–R8 + quarantine: package A
`contracts/planning.md` / `phase-3v-validate.md` (normative).

**PLAN_SPEC_SYNC (live Validation Spec):** each V-row Intention cites a **work-spec anchor**
(`Feature:` / `Preserve:` / `Regression:` / `Scope:` / `Assumption:`). Re-sync after Phase 3
apply when plan diverged since `<!-- spec-sync: iter N -->` (ledger iter axis only). Apply
order: brief → Backlog → Deferred → **Spec (re-read disk)** → soft → 3v. Skip path: required
Notes `spec sync n/a: plan unchanged since iter <N>` (leave header `**Spec validation:**`
untouched). Exclude residual-thin and `validate V<k>` lifecycle from thrash triggers.
Update matrix (machine strings): item complete → Feature `n/a: item complete`, keep
Preserve; plan drops claim → row `n/a: plan dropped claim` **and same pass** drop open
`validate V<k>:` with Notes `validate V<k> dropped: plan dropped claim`. Stable V-IDs never
renumber. After sync: header `pending` if any executable non-pass; only 3v sets `pass`.

**Unintended-change check-in (planning-time):** when writing `## Spec validation`, cover more
than the new feature — **Preserve** / **Regression** / **Scope**. Prefer executable Proofs;
pure `manual` Scope never alone blocks complete. Not a second complete predicate (R7).

**Kind `dual-home` Proof (self-improve / skill campaigns):** when both user package and
marketplace install exist:

```bash
node "$SKILL_DIR/scripts/package-parity.js" --skill-dir "$SKILL_DIR"
# or: diff -rq "$HOME/.claude/skills/improve-loop/scripts" \
#   "$HOME/.claude/plugins/marketplaces/claude-craft/plugins/claudecraft/skills/improve-loop/scripts"
# success: exit 0 / no diff output
```

**R2 mechanical:** if open product Acceptance refs `V<k>` and Proof artifact missing on disk,
select test-authoring item for `V<k>` first (T0 may skip).

**Open-count (B):** unchecked **title** lines under `## Backlog` matching `^- \[ \] .*P[01]:` (not sub-bullets).

## P0/P1 residual discipline (default)

*Mirror of A residual×2 / seed / complete law (planning + phase-3/3v) — law changes start in A. R7 sole complete; soft≠seed.*

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
- [ ] P1: [defect|product-choice|architecture|implementation] <change> (<path>) — <why>
  - Evidence: …
  - Decision: …
  - Preserve: …
  - Unknown: none | …
  - Acceptance: …
- [ ] P1: [residual] <finding> (<path>)
  - Evidence: …
  - Acceptance: …
```

**Only open (`- [ ]`) forms are allowed in live `## Backlog`.** Material kinds use **six clauses**
(PLAN_CLAUSES); residual uses thin Evidence+Acceptance only — **Do not** invent Decision/Preserve
for residual. Prefer greppable `P0:`/`P1:` title tokens (open-count). See [Planning contracts](#planning-contracts-tiers--multi-line-backlog).

**Complete-item rule (Phase 2 — delete from work queue):** when STATUS is PASS, Outcome is
`confirmed`, and `CHANGED_PATHS` is non-empty, the orchestrator **removes** the selected
item's **entire contiguous block** (title line **and** its clause sub-bullets) from
`## Backlog` — do not flip to `[x]` and leave it; do not leave orphan `Evidence:` lines.
Prefer `node "$SKILL_DIR/scripts/backlog-blocks.js" delete --body-file … --title-substr …`
for mechanical delete (PLAN_APPLY). Record the finish in **## Last cycle** (Thesis / Outcome /
Notes) so Phase 4's commit body banks the learning. Leave the item **open** (`[ ]`) on FAIL,
`disproven`, `blocked`, or `partial` so replan can refine remaining work. Deleting only on
confirmed+landed paths prevents re-select this cycle; anti-reseed across cycles is **git
digest**, not a done checkbox.

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
stay in Last cycle Notes only.

### Planning (every Phase 3) — live open queue **and** git history (mandatory)

Planning always uses **both** surfaces when available — open queue for “what next?”, git
for “what we already learned”:

1. **Git prior-learnings digest** (Phase 0 step 7): last 15 improve **commit bodies** —
   full Thesis / Outcome / Test evidence / What landed / Advisor consolidation / Notes /
   **`Next backlog:`** (**open** P0/P1 only) / **`Next deferred:`** / stop state. Explicitly
   flag `disproven` outcomes and build **COMPLETED_SET** + **DISPROVEN_SET** from those
   fields (not from backlog `[x]` lines).
2. **Live plan** (`IMPROVE_LOOP.md` — **required while Status is active**): **## Last cycle**
   + **## Next** + open `## Backlog` + open `## Deferred (P2)` + stop counters (advisors get
   the path; orchestrator reads sections). Create on cold-start; do not run Phases 1–3 with
   only in-memory backlog.
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
7. Cold-start: **must write** live ledger, then seed **1–3 open** P0/P1 from target + digest,
   **minus** COMPLETED_SET / unexcused DISPROVEN_SET. **Carry forward** prior open
   `Next deferred:` only (dedupe). **Do not** seed done `[x]` lines into Backlog. Empty
   deferred is fine.

### Residual streak

Track in live ledger **and** commit body:

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

Recover streak from the **live ledger** when present (same campaign / `--resume`). On
**cold-start**, streak always starts at **0** — do **not** copy
`consecutive-non-material-cycles` from a prior invoke’s terminal complete commit (anti-reseed
uses COMPLETED_SET; residual×2 must re-earn on every new campaign).

### When Status becomes `complete`

Set `complete` **only if all** of:

1. Open P0/P1 count = 0 after replan.
2. `consecutive-non-material-cycles >= 2` (**consecutive** residual×2).
3. Green suite gate (Phase 3 cases a/b/c below).

**R7 layer honesty (WP1):** there is **no Status CLI**. The orchestrator writes Status into
the live ledger following this law. Pure evaluator + truth table:
`node "$SKILL_DIR/scripts/complete-gate.js" self-test` (`evaluateComplete`). All-V-pass and
Spec header pass alone never unlock complete. Transitions only (hand-edited complete on
disk is not auto-refused).

If open P0/P1 = 0 and streak is **1**: leave Status **`active`**. Next cycle is
**residual-only** (skip Phase 1 execute / investigation Thesis
`residual survey (non-material streak 1→2)`); Phase 3 re-surveys; if still zero open P0/P1 →
streak 2 → complete. Do **not** invent fake P0/P1 to force work.

If open P0/P1 = 0 and streak ≥ 2 but suite fails confirmation: do **not** complete (existing
completion-gate rules).

### Seed (cold-start)

**Decision order:** (1) SEED_MODE (2) inspect + digest + habitat (3) classify each candidate
`promote|keep P2|waive` with Notes `classify: … — <why>` (PLAN_CLASSIFY) (4) choose plan tier
T0/T0p/T2 (5) write `## Campaign brief` when required (6) seed Backlog.

**Promote-class** = candidates that (a) appear in scan, (b) not COMPLETED_SET/unexcused DISPROVEN,
(c) not `limitation waived:` this campaign, (d) implementable in ≤1 cycle under the suite.
**T2** if promote-class non-empty or `--plan-deep`. **T0p** if product/mixed and promote-class
empty after full scan. **T0** if defect and no promote-class.

Seed **1–3 open (`[ ]`) P0/P1-tagged** items from digest + target (T2 seed cap for six-clause
material). Prefer concrete material gaps that are **not** semantic duplicates of
**COMPLETED_SET** / unexcused **DISPROVEN_SET**. **Cold-start never leaves open P0/P1 empty.**

**Design-time N&S (cold-start material seed):** before writing open **material** P0/P1, run
design-time N&S (≤3 bullets total; bullets only where outcome changes; prefer
`simplify`|`defer`). Residual-only survey seed may skip. Soft only — never blocks residual×2
or Status. Optional Notes only on change: `design: simplify | re-layer | defer | drop — …`.

**When `SEED_MODE` is `defect` and promote-class empty (T0):** seed thin residual (not empty):

```text
- [ ] P1: [residual] Residual survey — classify any remaining material P0/P1 for <target>
  - Evidence: inspect found no promote-class gaps beyond COMPLETED_SET
  - Acceptance: residual×2 may complete when open hits 0 mid-campaign after replan
```

**When `SEED_MODE` is `product` or `mixed`:** scan is mandatory (see product mode). Residual-only
*without scan* is **forbidden**. If promote-class non-empty → T2 six-clause seeds (1–3).
If every candidate is COMPLETED_SET or waived → **T0p** (not six-clause theater):

```text
- [ ] P1: [residual] Product residual survey — operator/UX/integration gaps for <target>
  - Evidence: post-scan promote-class empty; waivers: …
  - Acceptance: mid-campaign product residual gate still pending until open hits 0
```

Header: `**Product residual survey:** pending | done | n/a (defect)`. T0p leaves **pending**
(T0p seed does **not** consume the one mid-campaign product residual survey budget).

**Unknown gate:** at most **one** cold-start seed may have `Unknown:` other than `none`; that
item → investigation Thesis first (no fabricated Decision). When `**Habitat claimed:** yes`
and install/mount/discovery mechanism is still unknown after the habitat probe, prefer that
one Unknown investigation over all-`none` packaging-only seeds.

**PLAN_RUNTIME_CONTRACT (operational):** after habitat claim predicate:

| Runtime contract | Selection / seed effect |
|---|---|
| `n/a` | Habitat not claimed — no contract work required |
| `filled` | Compact runtime record present — packaging P1s allowed |
| `investigation-P1:<id>` | **Select that investigation before packaging-only items** |

Close investigation: rewrite brief `Runtime contract:` → `filled` **or** Notes
`runtime waiver: <reason>` (scoped). Never leave `investigation-P1` with zero open work.
**Not a Status gate** — selection/classify only; never residual×2 or terminal Status alone.

**Do not** seed `- [x]` done lines into `## Backlog` — finished work is remembered via the
git digest, not as backlog clutter. **Also seed Deferred (P2)** from the digest’s union of
prior **open** `Next deferred:` / archived open Deferred (dedupe; cap 8–12). Do not invent
P2s just to fill the section — empty is fine. Never enter Phase 1 with an empty open
**P0/P1** list on a fresh cold-start (Deferred alone does not satisfy that rule).

### Product / UX campaign mode (`SEED_MODE`)

Defect residual answers: *“any remaining bug/gap under a green suite?”*  
Product mode answers: *“what should we build next for authors/operators/integration?”*

#### Documented limitations → seed candidates (not auto-skip)

On cold-start and every Phase 3 replan when `SEED_MODE` ∈ {`product`,`mixed`}, scan the
target for:

- headings `## Current limitations` / `## Known limitations` (and similar) under the target tree
- open `Next deferred:` / ledger `## Deferred (P2)` from the digest
- operator-facing surfaces: CLI entrypoints, doctor/setup scripts, inspect/status UX, habitat
  tables, skillhub/docker paths named in SKILL/README

For each candidate line, classify:

| Class | Action |
|---|---|
| **promote** | cheap, in-scope, not COMPLETED_SET → open `- [ ] P1:` (or P0 if broken proof) |
| **keep P2** | real but deferred → `- [ ] P2:` under Deferred with why |
| **drop / waive** | intentional forever (security boundary, out-of-scope substrate) → Notes `limitation waived: <short>` — required before product-mode residual×2 complete if promote-class was skipped |

**Forbidden:** Status `complete` in product/mixed mode while any **promote**-class limitation
remains open **without** a Notes `limitation waived: …` this campaign (or a landed commit
whose What landed clearly addresses it → COMPLETED_SET).

#### Suite SKIP is material (not green)

When evaluating STATUS for product/mixed mode **or** when the target is skillhub/docker/hermes:

- A suite that prints `SKIP …` for a **claimed proof spine** (e.g. `SKIP test_prompt_workflow.py
  (PyYAML unavailable…)`) while the habitat *could* run that spine (venv present, docker
  skillhub, `HERMES_PYTHON`) → treat as **open P1 material** until fixed or waived.
  Do **not** call that a clean residual complete.
- Catalog gates that only `test -f SKILL.md` / smoke without habitat probe are **invalid
  product-mode complete** for skillhub skills — reseed habitat/proof P1 or Notes waive.

#### Habitat probe (skillhub / docker / hermes targets)

When target path is under `skills/`, `~/.hermes`, or the invoke mentions `docker` /
`skillhub` / `hermes`, Phase 0 **must** run a cheap habitat probe (inline shell OK):

- bare `python3 -c "import yaml"` vs known venv (`/opt/hermes/.venv/bin/python`,
  `$HERMES_PYTHON`, `/opt/data/.venv/bin/python`)
- whether the recorded test command is host vs `docker exec …`
- optional: container running (`docker ps`) when docker is claimed

**Durable claim (PLAN_HABITAT_META):** set live-ledger headers (not only kickoff chat):

- `**Habitat claimed:** yes` when this campaign targets habitat integration; else `no`
- `**Habitat probe:**` the command run (or `n/a`)
- `**Habitat probe result:**` `ok` | `fail` | `n/a` | `skipped`
- `**Habitat probe evidence:**` ≤120 chars

Later residual surveys and `soft-check` **read these headers** (via
`parseCampaignMeta` / plan file) — do **not** re-infer solely from the original invoke text.
Gaps from probe → open P0/P1 or investigation `Unknown:`, not silent residual.

**Habitat Spec kind:** prefer Proof rows with kind `habitat` (or docker/hermes in Proof) when
Habitat claimed is yes. Runnable habitat Proof **fail** is material (3v seed and/or residual
promote + streak reset). Env missing → Status `n/a`/`skipped`, not green pass.

#### Product residual survey (before residual×2 complete)

When open defect-style P0/P1 hit **0** after replan and `SEED_MODE` ∈ {`product`,`mixed`}:

1. If `consecutive-non-material-cycles` would become **1** (or is already 1) and a product
   residual survey has **not** run this campaign, do **not** treat the next cycle as pure
   empty residual. Run **one** cycle with Thesis  
   `product residual survey — operator/UX/integration gaps beyond COMPLETED_SET`  
   (may skip code execute if inspection-only; Outcome `partial` if no code).
2. **Criteria trail (required before residual none):** Last cycle Notes
   `criteria: C#: gap → promote|P2|waive …` (≤6 non-none from PLAN_CRITERIA scan). Sticky P2
   reclassify once this campaign.
3. Survey asks: remaining promote-class limitations? deferred P2 newly material? habitat
   SKIP? CLI/docs/doctor/inspect gaps?
4. **If `**Habitat claimed:** yes` (ledger header):** **re-run** the cheap habitat probe,
   update `**Habitat probe result:**` / `**Habitat probe evidence:**`, record a **probe
   outcome**, then classify each candidate `promote | keep P2 | waive` with rationale.
   Soft-check may also flag `HABITAT_CLAIMED_NO_PROOF` if Spec still lacks a habitat-relevant
   row — do not invent P1 from the word “docker” alone; use probe evidence.

   | Probe outcome | Effect |
   |---|---|
   | `pass` | Supports residual none |
   | `reachable-fail` | R5/R8 seed if prove path; else classify promote/P2/waive |
   | `unavailable` | Notes `unverified (habitat unavailable)` + P2/waive — **not** residual×2 block |
   | `manual/out-of-scope` | Unverified pulse; classify only |

   Probes **never** write Status or streak.
5. **Promote edge (mandatory):** any **promote**-class result **must** seed or reopen open
   `- [ ] P0/P1:` item(s) with Evidence from the probe/scan, and **reset**
   `consecutive-non-material-cycles` → **0**. Residual×2 must **not** complete in the same
   cycle that discovers a promote-class habitat failure without reopening work.
6. If material items found (including promote from step 5) → open P0/P1, streak **0**.
7. If none → Notes `product residual survey: none` **only after** criteria trail (step 2);
   streak may advance; residual×2 still required. Frontmatter/docs-only packaging is not a
   substitute for a failed habitat probe when Habitat claimed is yes.
8. Cap: **one** product residual survey per campaign (unless new evidence lands).  
   `SEED_MODE=defect`: skip this step (catalog residual-only remains valid).

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
5. **L3 JSON I/O (noisy hosts):** some agent shells dump huge zsh state into tool
   transcripts. Redirect L3 stdout/stderr to `/tmp/improve-*.json` (or similar) and
   **read the file** with the file tool — do not rely on truncated shell capture for
   `worktree-enter` / `merge-back` / `campaign-teardown` JSON.

**Disallowed:** outer sticky under `.worktrees/*`; leaving sticky on TARGET after exit without
attempting restore to `ORIGINAL_CWD`; assuming relative paths refer to the host session repo
when `TARGET_REPO` is different.

**pushd/popd:** non-preferred. Prefer explicit `ORIGINAL_CWD` + outer `cd` for durable moves,
subshells for WORKSPACE. **Subshells cannot heal an already-dead sticky CWD.**

## Status reporting (user-facing — mandatory)

*Operator templates + PLAN_ORIENT shapes mirror A `references/contracts/progress.md` — law/shape changes start in A. Progress-line dialect map (Pulse / PLAN_SPEC_STATUS / PLAN_ORIENT): A `contracts/progress.md` § Dialect map — B emits those shapes here.*

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
| Phase 2 counters | STATUS × Outcome matrix row | no-progress / same-error / non-material after update | replace Last cycle; **remove** completed item from Backlog |
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
▸ improve · Phase <0–5 | short-circuit name> · cycle K/MAX · iter N · <step-id> · <one-line action> (from <prev-id>)
```

**One banner dialect only** (PLAN_SPEC_STATUS). Include `cycle K/MAX` once L1 has a cycle
count (omit on pure Phase-0 setup before the first L2 cycle starts). Print `iter N` when
ledger counter exists. Step ids: `0-resume` · `1-execute` · `2-learn` · `3-replan` ·
`3-apply` · `3-spec-sync` · `3v-prove` · `4-commit` · `5-signal`. `(from <prev-id>)`
required entering `3-spec-sync`, `3v-prove`, `5-signal`. Examples:

```text
▸ improve · Phase 0 · 0-resume · cold-start worktree improve/backchain-skill-…-a1b2c3
▸ improve · Phase 1 · cycle 2/8 · iter 2 · 1-execute · execute: <first 80 chars of item>
▸ improve · Phase 3 · cycle 2/8 · iter 2 · 3-spec-sync · derive Spec from applied plan (from 3-apply)
▸ improve · Phase 3 · cycle 2/8 · iter 2 · 3v-prove · run Proofs (from 3-spec-sync)
▸ improve · Phase 4 · cycle 2/8 · iter 2 · 4-commit · commit improve-loop: iteration 2 — …
▸ improve · Phase 5 · cycle 3/8 · iter 3 · 5-signal · merge-back ff-only → main
```

On any hard stop / veto, print the STOP banner **and immediately the pulse line** (PLAN_ORIENT P1-2):

```text
▸ improve · STOP · cycle K/MAX · <reason code> — <one human sentence>
improve cycle K/MAX · iter N · stopped (<reason>) · open P0/P1 k · non-material=m/2 · residual_only=… · deferred=n · commit none · report next
```

Reason codes (use these strings when they apply): `shell unavailable`,
`ambiguous target repo`, `no test command`, `legacy tracked ledger`,
`wip carry failed`, `carried-wip-discard-blocked`, `worktree code-dirty`, `code-dirty veto`,
`secret veto`, `commit failed`, `reintegrate_blocked`, `scope violation`, `symlink broken`,
`launch code-dirty` (merge-back / mid-campaign only — enter carries then cleans launch WIP).

### PLAN_ORIENT — tab-switch / mid-cycle orientation (mandatory)

Cycle-boundary cards orient well; **intra-cycle** re-entry is the gap. Fancy = density +
recurrence, not a second dialect. A authors the block in package A `contracts/progress.md`;
B quotes verbatim shape here.

**P0-1 Orientation triplet** — at entry to long phases `1-execute` and `3-replan` only,
emit banner **then** goal line **then** pulse (three lines, no box rulers):

```text
▸ improve · Phase 1 · cycle K/MAX · iter N · 1-execute · execute: <item ≤80 chars> (from 0-resume)
improve goal · <campaign goal ≤100 chars> · done-when residual×2 + green suite
improve cycle K/MAX · iter N · active · open P0/P1 k · non-material=m/2 · residual_only=… · deferred=n · commit none · continuing
```

- Greppable label: `improve goal ·` (ASCII pin). Goal line = R7 *done-when rule text*, never
  a live complete status.  
- Other steps keep bare one-line `▸` only.  
- **Do not** pack goal/Status/open/residual onto the `▸` line (anti-bloat).

**P0-2 Re-banner heartbeat** — inside long phases, after substantial sub-actions (suite done,
revert, hygiene, advisor round back), re-emit `▸` with updated action and `(cont)`:

```text
▸ improve · Phase 1 · cycle K/MAX · iter N · 1-execute · test suite finished — reconciling Outcome (cont)
```

Rule of thumb: no stretch of more than ~8 tool calls without a coordinate-bearing `▸` line.

**P1-1 Turn-end pulse footer** — any mid-cycle assistant turn that does **not** end on a
discovery card or campaign report ends with the pulse line + `· on:` item slug (≤60 chars):

```text
improve cycle K/MAX · iter N · active · open P0/P1 k · non-material=m/2 · residual_only=… · deferred=n · commit none · continuing · on: <item slug ≤60 chars>
```

- Digests tolerate legacy pulses without `· on:`. Footer never invents status (3v fail →
  `active · continuing`).  
- **Item slug:** short stable id derived at selection (`P1:validate-V2`, `residual-survey`,
  …); carry through footers/heartbeats; not resume authority.

**P1-3 Resolved Next** — discovery **Next** and `5-signal` state **one** chosen branch only
(not a four-branch menu). On 3v fail: name seeded item + `continuing cycle K+1` (R8d).

| Moment | Emit | Required? |
|---|---|---|
| Enter `1-execute` / `3-replan` | Orientation triplet | **Yes** |
| Sub-action in long phase | `▸` re-banner `(cont)` | **Yes** when >8 tools since last `▸` |
| Mid-cycle turn end | Pulse footer `· on:` | **Yes** |
| STOP | STOP banner + pulse | **Yes** |
| Discovery Next | One resolved handoff | **Yes** |

Non-goals: no second banner system, no % progress bars, no emoji meters on greppable lines,
no mid-cycle dashboard cards, no status synthesis claiming `complete`/`done`.

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
| **Seed mode** | `defect` \| `product` \| `mixed` |
| **Plan tier** | `0` \| `0p` \| `1` \| `2` · brief one-liner (kickoff is chat summary only; complete predicates stay skill law) |
| **Launch** | `<LAUNCH>` · branch `<launch_branch\|detached>` |
| **Workspace** | `<WORKSPACE>` |
| **Campaign branch** | `improve/<slug>` |
| **Pointer** | `<POINTER>` · state `active\|reintegrate_blocked` |
| **Test command** | `<cmd>` |
| **Habitat probe** | n/a \| bare yaml yes/no · venv yaml yes/no · docker … (skillhub/hermes targets) |
| **Seed backlog** | open P0/P1 count · next: <short item or _(empty)_> |
| **Deferred carried** | open P2 count from digest/seed · _(none)_ if empty |
| **Live ledger** | `$WORKSPACE/IMPROVE_LOOP.md` · created yes (required mid-campaign) \| missing → STOP |
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
| **Residual meter** | streak **m/2** · open P0/P1 **k** · execute **yes\|no** · residual_only **yes\|no** |
| **Result** | active · continue \| complete · done \| stopped (<reason>) \| blocked (<reason>) |
| **Thesis tried** | <one line from Phase 1 / lightweight Phase 2> |
| **Outcome** | `confirmed\|disproven\|partial\|blocked` · Test `PASS\|FAIL\|n/a` |
| **What landed** | <paths or _no code_ / ledger-only> |
| **Commit** | `yes` `<short-sha>` · `improve-loop: iteration N — …` **or** `no — <reason>` |
| **Why not complete** | _(omit if complete)_ need residual cycle 2/2 · open P0/P1 remain · suite gate · … |
| **Stop counters** | _(omit row when both counters are 0)_ no-progress=<i> · same-error=<j> · sig=`<none\|…>` |
| **Advisors** | _(omit when native-only/skip and no disagreement)_ <who responded / degraded / decision-relevant> |

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
4. completed as: <Result> · next: <one resolved handoff>

**Next** (PLAN_ORIENT — **one resolved branch only**, not a menu of every possibility)
- <e.g. continuing cycle K+1/MAX · next open: P1:validate-V2>
- <or once-active → re-invoke `/improve` without `--once`>
- <or terminal → campaign report · merge-back>
- <or blocked → concrete operator action>
```

(PLAN_ORIENT: **Residual meter** under **Campaign goal**. Discovery slim: open P0/P1
lives only in Residual meter — do not re-print a separate Open row; omit zero Stop
counters; omit Advisors unless degraded/decision-relevant; omit empty Backlog/Deferred
subsections; **Next** is one resolved handoff only.)

Also emit a **one-line progress line** (and best-effort `update_goal(message: …)` if a host
goal is Active) so logs stay greppable — **mandatory every cycle**, including residual-only.
Cycle-end pulse omits `· on:` (item settled for the cycle). Mid-cycle footers **add**
`· on: <slug>` (PLAN_ORIENT P1-1):

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

**Learnings** (3–8 bullets from this run’s commit bodies / Last cycle Notes; **always call out
any `disproven` theses**):
- …
- …

**Residual / still open**
- Open P0/P1 at end: <k> · <list or _(none)_>
- Non-material streak (last): <m>
- Stop counters (last): no-progress=<i> · same-error=<j>

**Further improve?** (does **not** reopen residual×2 or invent complete predicates)
- <≤5 ranked bullets from open Deferred / waived limitations / criteria map — or _(none)_>

**Deferred (P2) for later** (from final `Next deferred:` / ledger — does **not** block complete):
- <open P2 bullets, or _(none)_>
- Note: durable in git commit bodies; no product file change required to park these.

**Ops**
| | |
|---|---|
| **Test command** | `<cmd>` · last `PASS\|FAIL\|n/a` |
| **CWD homecoming** | restored `<ORIGINAL_CWD>` \| left on `<TARGET_REPO>` (home missing) \| n/a |
| **Operator done-when** | met \| unmet: \<short\> \| n/a (from ledger header if set) |
| **Next** | done \| <concrete operator action> |
```

Operator done-when is **honesty only** — it does **not** change residual×2 complete.

Tone: confident, scannable, no filler. Prefer tables + short bullets over walls of prose.
When Result is `blocked` or `stopped`, **Next** must be a concrete operator action (not
“try again” alone). The **Summary** section is required even on short blocked campaigns
(explain what the goal was and why no cycles or partial cycles ran).

## Invocation

```
/improve <target, described in plain language>
/improve --once <target>
/improve --product <target>
/improve --product --once <target>
```

Also: `/improve-loop`, `/claudecraft:improve-loop` (plugin namespace). Examples:
`/improve "error handling in scripts/ingest.py, tests via pytest"` (autonomous, defect seed);
`/improve --product "resumable-script skillhub UX"` (autonomous, product seed);
`/improve --once "…"` (single L2 cycle).

**Flags:**

| Flag / words | Effect |
|---|---|
| `--once` / `once` / “single cycle” / “one cycle only” | Cycle mode `once` |
| `--product` / `--ux` / words `product`, `ux`, `integration`, `roadmap` | `SEED_MODE=product` |
| `defect only` / `residual only` / `defect-mode` | Force `SEED_MODE=defect` (even for skills) |

Cap override: env `IMPROVE_LOOP_MAX_CYCLES` (positive int; default 8). Test command: reuse from
invocation, goal objective, pointer, or existing ledger. If still missing — **interactive:**
ask once; **cannot ask** (headless / unattended): `Status: stopped (no test command)`, write a
Last cycle (Thesis `no test command supplied…`, Outcome `blocked`, `Committed: pending`),
Phase 4 land (ledger-only), Phase 5. Prefer seeding the command in the goal objective or
invocation.

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
   live plan (Last cycle + open queue) before inventing work (both when available).
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
  - `RUN_STATE` — `$WORKSPACE/.improve-loop/state.json` (gitignored; never staged). Per-run
    control lives **inside** the campaign worktree. Resume discovers via scan of
    `.worktrees/*/.improve-loop/state.json` (or `--workspace`). Legacy
    `$COMMON_GIT/improve-loop/active.json` is migrated once then cleared.
  While run state is `active`, launch must not receive campaign ledger, code, or commits.
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
  build output). Prefer gitignoring them. This turn’s suite litter is tracked in
  `TEST_ARTIFACT_PATHS` and is **not** dirty for this turn’s guards (see **Dirty — intent**
  below). Persistent un-ignored litter left after the campaign can show up on a later
  enter as unexpected product dirt — report and ask the operator to gitignore/clean;
  never permanently teach the skill to ignore arbitrary paths.
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
  - **ambient** — runtime noise (non-blocking):
    - If `IMPROVE_LOOP_AMBIENT_PREFIXES` is **set** (incl. empty/`-`): that list fully
      overrides profile prefixes **and** path allowlists (`-` = strict, no ambient).
    - If PREFIXES **unset**: `IMPROVE_LOOP_AMBIENT_PROFILE` applies:
      - `none` (default) → legacy prefixes `cron/`, `wiki/` only
      - `agent-home` → `cron/`, `wiki/`, `memories/` plus path-qualified
        `scripts/hermes_release_watch.py` (not that basename anywhere else)
    - **Never** ambient: `skills/**`, arbitrary `scripts/*`
  - **litter** — ephemeral temps via `IMPROVE_LOOP_LITTER_GLOBS` (default:
    `.bundled_manifest_*.tmp`, `*~`, `.*.tmp` basenames; Hermes skill bundle temps).
    Untracked litter is **auto-cleaned** before the blocking check. Non-blocking.
  - **code** — everything else (blocks merge-back if still dirty after enter)

  Ambient ≠ not carried: enter still carries non-isolation launch WIP; ambient only
  affects merge-back/enter **block** classification.

  After a successful enter, launch should be free of carried product/ambient WIP. New
  **unexpected product** dirt on launch mid-campaign still blocks merge-back (exit 3).
  **Do not** `git stash` to force enter or merge — use L3 carry on enter; for mid-run
  launch product dirt, operator commit/discard/move.

### Dirty — intent (keep this simple)

**Dirty is only about unexpected uncommitted product paths.** It is not a general
“anything changed” sensor and must not impede a clean re-run or mid-campaign residual.

| Never dirty | Why |
|---|---|
| **`IMPROVE_LOOP.md` (live ledger)** | Required working memory across **every** iteration of this campaign; written/updated every cycle; pathspec-staged or terminal-deleted on purpose |
| **Prior commits / git history** | Already landed; not in porcelain; digest/COMPLETED_SET is **learning**, not dirt |
| **Isolation plumbing** | `.worktrees/`, campaign `.gitignore` for worktrees |
| **Enter-carried baseline** | Paths launch WIP brought into WORKSPACE at cold-start (`pointer.carried_paths`); expected; left unstaged unless this cycle’s thesis intentionally changes them |
| **This turn’s test litter** | `TEST_ARTIFACT_PATHS` — suite side effects, not product work |
| **Launch ambient** (merge-back) | profile `none`: `cron/`, `wiki/`; `agent-home` adds `memories/` + `scripts/hermes_release_watch.py`; PREFIXES overrides |
| **Launch litter** (merge-back) | untracked temps (`.bundled_manifest_*.tmp`, `*~`, `.*.tmp`) — auto-cleaned / non-blocking |

| Is dirty (blocks) | Why |
|---|---|
| **Unexpected uncommitted product** on WORKSPACE (not in the never-dirty set) | Abandoned half-work that must not be pathspec-committed by accident or treated as a clean residual baseline |
| **Unexpected product on LAUNCH** at merge-back | Would mix foreign WIP into FF / conflict with reintegrate |

**Rules of thumb:** (1) porcelain only — commits are never dirty; (2) ledger is always
expected mid-campaign; (3) enter-carry is expected until teardown restores it; (4) pathspec
commits stage only this cycle’s product `CHANGED_PATHS` + ledger — they never need a
“clean tree.” Do not invent extra dirty categories.

### Landing priority (product over polish)

**Primary goal of every cycle that lands code:** put the improvement into git history on
the campaign branch and, when terminal, **FF merge-back onto launch**. That is more
important than an empty porcelain tree or a soft-removed worktree.

| Priority | What “success” means |
|---|---|
| **1. Product land** | Thesis work is in `CHANGED_PATHS` (edits **and new files**), green suite, pathspec-committed on `improve/<slug>` |
| **2. Merge-back** | Terminal: FF campaign tip into launch so main/launch **has** those commits |
| **3. Hygiene / dirt** | Ignore ambient/litter; block only *unexpected foreign* product WIP; teardown is advisory |

**New files are first-class product.** Creating, staging, and committing new paths under
WORKSPACE is normal and expected (tests, modules, docs, scripts). Do **not**:

- skip pathspec-staging untracked product (`??` in porcelain) to “keep the tree clean”
- treat a new intentional product path as test litter, launch litter, or enter-carried baseline
- refuse a cycle solely because porcelain is non-empty after a good product commit

**Do** pathspec-stage every still-dirty path in this cycle’s `CHANGED_PATHS` (including
paths that were untracked when first written). `git add -A` stays forbidden; explicit
paths that *include new files* is required.

## Durable state vs live ledger (self-contained cycles)

Two layers — do not collapse them:

| Layer | What | When required |
|---|---|---|
| **Durable (git commit bodies)** | Learnings + open Next backlog/deferred snapshot per cycle | Every Phase 4 land; sole source for **next invoke** cold-start seed / anti-reseed |
| **Live plan (`IMPROVE_LOOP.md`)** | Working memory: Campaign brief, open Backlog/Deferred, stop counters, **## Next** (soft), **## Last cycle** (replace each cycle — not append-only diary) | **Every active campaign** — create on cold-start; maintain every cycle; `--resume` for this worktree |

**Git is the durable ledger across campaigns.** Each cycle’s Phase 4 commit body carries
Thesis, Outcome, test evidence, What landed, advisor consolidation, Notes, stop-condition
state (including **consecutive-non-material-cycles**), **`Next backlog:`** **open-only**
`- [ ] P0/P1:` lines (or empty + streak — **no** done `[x]` lines in the work queue), and
**`Next deferred:`** open P2 lines (or `Next deferred: (none)`). Finished work and *why* it
was an improvement are recovered from **Thesis / Outcome / What landed / Notes** of prior
improve commits — not from backlog checkboxes. Deferred is metadata only — no product code
required. Cold-start / next cycle after compact rebuilds continuity from:

```bash
git -C "$WORKSPACE" log --grep="improve-loop: iteration" -n 15 --format="%H%n%s%n%b%n---"
```

**Live ledger is required mid-campaign (context survival).** Context windows can run out
mid-cycle or between cycles; chat is not a store. **`IMPROVE_LOOP.md` must be written** at
WORKSPACE on cold-start (template below) and updated through Phase 2–4 so open queue,
counters, Next, and Last cycle survive compaction and support `--resume` for **this** pointer. Terminal
cycles archive the full file into the commit body and **remove** it from the tree — it must
**not** be required on product `main` to start a later `/improve`.

**Not durable across invokes / not the long-term store:**

- Worktree run state (`.improve-loop/state.json`) — **run lock for this invoke only**;
  discarded with the worktree on entry of the next `/improve` (default) and cleared on exit.
- `IMPROVE_LOOP.md` after terminal land — gone from tree; history lives in the terminal
  archive block + iteration commit bodies. Next cold-start creates a **new** file.

**Default entry:** `worktree-enter` **discards stale** isolation then **cold-starts**.  
**Opt-in:** `--resume` only when the operator explicitly wants crash recovery of a live pointer.

**Terminal cycles:** Status `complete` / `stopped (...)` → merge-back teardown. An old
complete commit on `main` tip must **not** prevent a new campaign from seeding (no
“tip has archive → refuse reseed” gate on cold-start).

```markdown
# Improve Loop: <target description>

**Test command:** `<cmd>`
**Started:** <date>          **Status:** active | complete | stopped (<reason>)
**Iteration counter:** N     <!-- sole live N; must match Last cycle **N:** after Phase 2 -->
**Seed mode:** defect | product | mixed
**Product residual survey:** pending | done | n/a (defect)
**Plan tier:** 0 | 0p | 1 | 2
**Spec validation:** n/a | pending | pass
**Habitat claimed:** yes | no
**Habitat probe:** <cmd or n/a>
**Habitat probe result:** ok | fail | n/a | skipped
**Habitat probe evidence:** <≤120 chars or none>
**Operator done-when:** <text or (none)>
**Install mechanism:** copy | symlink | bind-required | unknown | n/a

## Campaign brief
<!-- Work-spec anchors (PLAN_BRIEF). Orchestrator-only. No second ## Work Spec table.
     Success/Done when = skill law only. Runtime: PLAN_RUNTIME_CONTRACT. -->
- **Target:** <plain-language target / desired outcome>
- **Problem / opportunity:** …
- **In scope:** …
- **Out of scope / waived:** …
- **Constraints:** test command, package rules…
- **Sources inspected / Open questions:** … / none
- **Surface types / Fidelity preference:** … | n/a — headless
- **Criteria map:** … (PLAN_CRITERIA Criteria scan; ≤6 non-none)
- **Operator post-land:** none | …
- **Runtime contract:** n/a | filled | investigation-P1:<id>
- **Runtime record:** … (if filled; 4–6 lines)
- **T2 challenge:** native | advisor | skipped — <why> | n/a
- **Success / Done when:** residual×2 + green suite (skill law only) — Must not invent new complete predicates
- **Plan tier:** 0 | 0p | 1 | 2

## Spec validation
<!-- Validation Spec (PLAN_VALIDATE + PLAN_SPEC_SYNC) — derived from work-spec anchors.
     Soft-check after sync: disposition only, never auto-seed. <!-- spec-sync: iter N -->
     Apply: brief → Backlog → Deferred → Spec (disk) → soft → 3v. -->
| ID | Intention | Kind | Artifact(s) | Proof | Status |
|---|---|---|---|---|---|
| V1 | Feature: … (work-spec anchor) | suite \| L3-test \| skill-law \| prose-sweep \| dual-home \| habitat \| manual | path(s) | executable cmd + success semantics | pending \| pass \| fail \| n/a |
| V2 | Preserve: … | suite \| prose-sweep \| skill-law | path(s) | cmd / rg | pending |
| V3 | Regression: recorded suite green | suite | — | `<Test command>` exit 0 | pending |

## Backlog
<!-- open P0/P1 only — completed items are deleted as title+clause contiguous block;
     memory is git commit bodies; use backlog-blocks.js for mechanical parse/delete -->
- [ ] P1: [defect] <change> (<path>) — <why material>
  - Evidence: …
  - Decision: …
  - Preserve: …
  - Unknown: none
  - Acceptance: …

## Deferred (P2)
<!-- open P2 only -->
- [ ] P2: <item> — <why deferred / not material this campaign>

## Stop-condition tracking
- consecutive-no-progress: 0
- consecutive-same-error: 0 (signature: none)
- consecutive-non-material-cycles: 0

## Next
<!-- Soft hint only — not authority for flush / residual / stop. Rewrite after Phase 1
     select and Phase 3 replan; recompute if missing/stale. -->
- **Action:** execute | residual survey | product residual survey | ledger-flush | stop
- **Item:** <open title or _(none)_>
- **Why:** <≤1 line>

## Last cycle
<!-- REPLACE entire section each Phase 2 (and residual lightweight) — not append-only.
     Field form only; no ### Iteration headings. History lives in git commit bodies.
     Narrow in-place edits (latest cycle only, before land):
     (1) Phase 4: set Committed: yes before commit attempt; on failure → no — <reason>
     (2) Phase 3 completion-gate FAIL: correct Test result / Outcome / Error signature
         and Stop-condition tracking lines. -->
**N:** <integer — same as Iteration counter>
**Date:** <date>
**Thesis:** what we tried and why we thought it would help
**Test result:** PASS | FAIL | n/a
**Outcome:** confirmed | disproven | partial | blocked
**Error signature:** <none | exact short string — see Phase 2>
**Committed:** pending | yes | no — <reason>
**Notes for next cycle:** …
```

Do not put an iteration's own commit SHA in its Backlog line or Last cycle. That SHA does
not exist when the file is written (and a terminal iteration's commit **deletes** the
resume file rather than leaving it in the tree tip). Instead, always use the commit
subject `improve-loop: iteration N — <summary>` and look it up with the stable marker
`git log --grep="improve-loop: iteration N —"`. The em-dash after `N` is required: a bare
`… iteration N` is a prefix of longer numbers under git's default basic regex, so
iteration `1` could falsely match `10`, `11`, and later iterations.

Compute `N` deterministically via **allocate_N**, never freehand from host
`cycle_count` / `MAX_CYCLES`:

```
cold-start / discard-stale-cold-start → N := 1
else:
  n_header := parse **Iteration counter:** if integer else null
  n_last   := parse ## Last cycle **N:** if integer else null
  n_git    := max N from campaign-branch subjects matching
              /improve-loop: iteration (\d+) —/   (optional safety; null if none)
  n_base   := max(non-null among n_header, n_last, n_git) else 0
  if latest NOT landed (Committed pending|no|repaired no):
    reuse that N (ledger-flush / continue repair) — do not allocate
  else:
    N := n_base + 1   # if n_base==0 → N := 1

ledger-flush / leftover-archive: never allocate; use Last cycle **N:**
```

At the start of Phase 2: **replace** entire `## Last cycle` body with fields for this `N`
and `Committed: pending`, then set header `**Iteration counter:**` to the same `N`.
Header and Last cycle must not drift.

**Legacy Log collapse (Phase 0, orchestrator only — before 3a/3b):** if `## Log` with
`### Iteration` exists: parse latest by max N → write `## Last cycle` field form → set
header counter ≥ that N → delete `## Log` → Notes `legacy Log collapsed to Last cycle`
(+ dropped unlanded count if any) → then 3a/3b. L3 enter may copy legacy Log; does not collapse.

## The cycle

*Phase corpus mirrors A `references/phase-0-resume.md` … `phase-5-decision.md` + `phase-3v-validate.md` — law changes start in A; keep phase-specific ops here.*

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
   **`10` `carried-wip-discard-blocked`** — a live pointer exists for the **same target**
   and default discard-stale would destroy the **only** copy of carried launch WIP and/or
   non-isolation campaign dirt (launch was cleaned after carry). **Worktree and pointer
   are kept.** Operator must `--resume` the same campaign, or recover WIP from the worktree
   then `campaign-teardown` / merge-back. **Never** re-invoke bare `worktree-enter` without
   `--resume` while a post-carry pointer is active **for that same target**.
   **`11` `reintegrate-protected-discard-blocked`** — default discard would destroy the
   reintegrate recovery path (unmerged `improve-loop:` commits and/or non-empty-range
   `reintegrate_blocked`). **Same or different target.** Use `--resume` (merge-back-only)
   or `--force-drop-reintegrate` to abandon. Distinct from exit 10 (carried WIP only).

   **Different target:** if the live pointer's `target` (normalized) differs from this
   invoke's `--target`, L3 **does not** exit 10 for carried WIP alone — it runs discard-stale
   (restore WIP to launch, then force-remove worktree) then cold-starts, with notes
   `discard-stale-different-target:<old>→<new>` — **unless** reintegrate-protected (exit 11).
   Catalog skill-by-skill `/improve` must recover or pass `--force-drop-reintegrate` when
   a prior skill left reintegrate_blocked with unmerged improve commits.

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


2. If this is a **new cold-start / discard-stale-cold-start** (default): seed backlog
   **and Deferred** from the **git digest** (step 7) + target, even when main tip is
   an old `improve-loop: … complete` archive. **Do not** refuse reseed because of historical
   terminal archives — those are prior campaigns' learnings, not this run's resume file.
   **Must write** live plan `$WORKSPACE/IMPROVE_LOOP.md` (template in Durable state
   section) **before** Phase 1 — **live plan required** for context survival; do **not**
   keep backlog/counters only in-memory. On T2/design-change: write `## Spec validation` +
   header `**Spec validation:**` (**primary**; 3v U6 seed is fallback only). Prefer
   test-authoring seeds for missing Proof artifacts before product (R2). Seed **1–3
   P0/P1-tagged** items into `## Backlog` (see residual discipline); **also seed
   `## Deferred (P2)`** from the digest’s union of prior `Next deferred:` / archived Deferred
   (dedupe, cap 8–12; empty OK — see Seed). Never enter Phase 1 with zero open P0/P1 on
   cold-start (Deferred alone does not satisfy that).
   **Always** init `consecutive-non-material-cycles: 0` on cold-start / discard-stale-cold-start
   — **never** inherit streak from a prior campaign’s terminal `complete` commit body (that
   would short-circuit residual×2 and impede a clean re-run on the same target). Recover
   streak only from the **live ledger** on `--resume` of *this* worktree (step 3).
   Set `N = 1`. Skip 3a–4; go to step 5.

   If mode is **`--resume`** and ledger is absent after terminal land on **this** worktree:
   merge-back-only / stop (true same-campaign recovery).

3. Otherwise read the Backlog, **Deferred (P2)** (create empty section if missing),
   Stop-condition block, **## Next**, and **## Last cycle** (after any legacy Log collapse).
   If **## Last cycle** is empty / missing `**N:**` and no Thesis/Committed (zero cycle
   state — including cold template), treat like a crash-before-Phase-2 create: skip 3a–4
   and go to step 5 with `N = 1`. There is no latest cycle block for 3a/3b/4. Otherwise do
   not allocate a new `N` yet. First decide repair / short-circuit / real cycle in steps
   3a–4. Allocate via **allocate_N** only when entering a new Phase 1–3 cycle after step 4.

   3a. **Orphaned `Committed: yes` recovery.** If **## Last cycle** says
   `Committed: yes` but
   `git -C "$WORKSPACE" log --grep="improve-loop: iteration <that entry's N> —" -n 1`
   finds no commit, the previous cycle wrote pre-commit `yes` but never landed a commit
   (crash, kill, or hook abort before object creation). Correct it to
   `Committed: no — commit never landed` and append one Notes line. Do not invent a
   backfill commit here: this is an honesty repair only, and step 4 may still need a
   ledger flush.

   3b. **Stuck `Committed: pending` recovery.** If **## Last cycle** still says
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
   - **Code-dirty** (shared with step 6, Phase 3 post-panel, Phase 4 ledger-only veto) —
     see **Dirty — intent** above. Under WORKSPACE, a path is code-dirty **iff** it is
     listed in `git -C "$WORKSPACE" status --porcelain` **and** it is **not** one of:
     `IMPROVE_LOOP.md`, isolation (`.worktrees/`, campaign `.gitignore`), this turn’s
     `TEST_ARTIFACT_PATHS`, or enter-carried baseline (`pointer.carried_paths` / enter notes
     `carried-paths:`). **Ledger and prior commits are never dirty.** Ignore LAUNCH dirt
     here (merge-back classifies launch separately).
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
   - **Landed + Status `active`:** continue to step 5; allocate next `N` then. (Zero Last cycle already went to step 5 from step 3.)

5. If the Backlog has no unchecked **P0/P1** items while Status is `active`, skip **Phase 1
   execute only** (residual-only cycle — common when non-material streak is 1). Do not skip
   the rest of Phase 0: steps 6–7 still run; Phase 3 must re-survey. Allocate this cycle's
   `N` if needed. After step 7 use lightweight Phase 2, then Phase 3, Phase 4, and Phase 5.
   Do **not** invent fake P0/P1 to force execute work.

   **Product residual survey gate:** when `SEED_MODE` ∈ {`product`,`mixed`}, open P0/P1 = 0,
   and this campaign has **not** yet run a product residual survey, use Thesis  
   `product residual survey — operator/UX/integration gaps beyond COMPLETED_SET`  
   (not bare `residual survey (non-material streak …)`). Phase 3 must classify limitations /
   deferred / habitat SKIP / operator surfaces; may open new P0/P1 (reset streak) or Notes
   `product residual survey: none` then allow streak advance. One survey per campaign max.

   For the **lightweight Phase 2** residual/empty-execute path, **replace** entire
   `## Last cycle` with `Committed: pending`, Thesis such as
   `residual survey (non-material streak k→k+1)`, `product residual survey — …`, or
   `empty-backlog replan (no Phase 1 execute)`, Test result `PASS` (suite not re-run for
   execute; Phase 3 may run confirmation), **Outcome `partial` only** (hard — **never**
   `confirmed` when no product land / empty `CHANGED_PATHS`; residual is bookkeeping, not a
   proven fix), Error signature `none`. Hold no-progress / same-error counters *exactly* as
   they were (do not apply PASS/partial reset). Set header counter and Last cycle `**N:**` to
   `N`, then run Phase 3 normally.

   **Residual / empty-execute land (normal path):** **replace** the lightweight Last cycle entry on the
   **live plan** (must already exist), replan on the file, then Phase 4 **ledger-only**
   commit staging `IMPROVE_LOOP.md` (Outcome **`partial`**, full enumerated body including
   **Next deferred**). Do not rely on chat-only state.

   **Emergency allow-empty residual:** `git commit --allow-empty` is allowed **only** if the
   live ledger truly cannot be written (filesystem error) and **only** for residual-only /
   empty-execute, with the full enumerated body (Thesis, Outcome **`partial`**, Test
   evidence, What landed `no code landed`, Advisor consolidation, Notes, **Next backlog**
   empty+streak, **Next deferred** required — list or `(none)`, stop state). Notes must
   record `ledger write failed — emergency allow-empty residual`. Never ship a residual
   commit with a subject-only / empty message body.

6. For turns that will run Phases 1–3, apply the dirty-tree guard (shared **code-dirty**,
   step 4): stop only if **unexpected uncommitted product** is present. Do **not** stop for
   ledger, enter-carry baseline, isolation, or this turn’s test litter. Do not auto-stash.
   Ledger-flush turns already branched at step 4.

7. Build a **prior-learnings digest** for this target from git history (git commits are the
   durable, reviewable ledger; this is what makes learnings reviewable across cycles).

   - Fetch prior improve-loop commit bodies for **this target** (from WORKSPACE; shared
     object DB). Multi-skill repos (e.g. `~/.hermes`) interleave many targets on one
     history — **scope the digest**:
     1. Prefer commits whose body contains a stable `Target: <text>` line matching this
        campaign target (normalized whitespace/case), **or** whose body/subject mentions
        the target path/slug from kickoff.
     2. Pull a wider window then filter: e.g.
        `git -C "$WORKSPACE" log --grep="improve-loop: iteration" -n 40 --format="%H%n%s%n%b%n---"`
        then keep the newest **15** matching this target.
     3. If fewer than 1 match after filter, fall back to unfiltered last 15 and Notes
        `digest unscoped — multi-target noise` (still build COMPLETED_SET carefully).
     The bulk prefix is the literal `improve-loop: iteration` — **no number and no em-dash
     in that pattern.** (Per-iteration lookups `--grep="improve-loop: iteration N —"` are
     different and keep the em-dash so `iteration 1` does not match `10`.)
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
     Last cycle for the same iteration N has the structured Thesis/Outcome/Error-signature/Notes
     — supplement that field from **## Last cycle only when Last cycle `**N:**` equals the
     commit's iteration N**. Else use git body alone. Only if git and Last cycle *conflict on a
     factual claim* (Thesis or Outcome) note it in this cycle's Last cycle Notes. Multi-entry
     in-file diary is not a recovery store — git bodies are durable history. When the live ledger has
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

**PLAN_ORIENT:** on entry emit orientation triplet; re-banner `(cont)` after substantial
sub-actions; mid-cycle turns end with pulse `· on: <slug>` (see Status reporting).

Select the next **open** (`- [ ]`) **Backlog** item (`P0:` / `P1:` only — title line).

**PLAN_RUNTIME_CONTRACT select:** if brief `Runtime contract:` is `investigation-P1:<id>`
(or an open item’s Acceptance promises the unsettled runtime), **Select that investigation
before packaging-only items** (install/docs/frontmatter-only P1s wait). Prefer the open
item whose id/title matches `<id>` or the habitat Unknown investigation.

**R2 mechanical:** if any open product Acceptance refs `V<k>` and that V-row’s Proof artifact
is not on disk, select the open test-authoring item for `V<k>` first (T0 may skip).
**Pure-test:** `confirmed` when artifact exists + quarantine-respecting suite green.
**`validate V<k>`:** may fix product **or** proof.

If any
legacy `- [x]` line still appears in Backlog, strip it first (memory is git digest) and do
not select it. **Never** select a `## Deferred (P2)` / `P2:` line for execute. As a backstop,
before selecting, skip any open Backlog item that re-asserts **COMPLETED_SET** work or a
prior **disproven** thesis **unless** the item's rationale explicitly re-opens it with a
stated reason (per Phase 3). This catches reseed that survived replan. It reads
COMPLETED_SET / DISPROVEN_SET from Phase 0 step 7 (git commit-body metadata) and judges
semantically, not by substring match.

**Material intent handoff:** for six-clause material kinds, pass **Decision**, **Preserve**,
and **Acceptance** into the executor **unchanged** (do not silently reinterpret). Residual
thin / non-none Unknown → investigation path with Evidence + Acceptance only. Malformed
material (missing clauses) → **block execute** (do not soft-invent Decision during code).

**Implementation is native by default — this skill does not depend on `codex-worker`.**
Execute the selected item in WORKSPACE using whichever of these is available, in order:

1. **Orchestrator-native (preferred default):** the session running this skill implements or
   investigates the item itself under WORKSPACE.
2. **Fresh generic agent (optional):** dispatch `general-purpose` (or equivalent) with the
   item and pointers to `IMPROVE_LOOP.md` and recent git history (paths/refs, not inlined).
3. **Optional external implementer (never required):** only if the operator or session
   explicitly wants one *and* such an agent is available (e.g. `codex-worker`, Grok rescue,
   or another coding agent). Missing or failing optional implementers **must not** block the
   cycle — fall back to (1) or (2) and note the fallback in Last cycle Notes.

**Hard rules for every executor path (native or agent):**

- Do **not** commit, do **not** `git add`/stage, and do **not** edit `IMPROVE_LOOP.md` —
  only modify the working tree and report what changed. A commit or stage would bypass this
  cycle's scope check, secret scan, and exactly-one-commit discipline.
- Stay in WORKSPACE (no nested worktree isolation; WORKSPACE already is the campaign tree).
- When the item names an existing skill and the Skill tool is available, use it; otherwise
  read the skill file and do the equivalent work. Do not block on Skill-tool availability.
- If using a subagent, pass `cwd`/paths under WORKSPACE. If it returns a structured scope
  report, honor mismatches: any changed path outside a declared file scope → in-memory then Last cycle Notes
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
  spaces/special characters are wrapped in double quotes with C-style escapes). **Include
  untracked (`??`) paths** — new files/dirs the thesis created are product land, not dirt
  to ignore. Drop `IMPROVE_LOOP.md` (Phase 1 must not edit it; Phase 4 handles it
  separately). This is the executor's change set; anything that becomes dirty *only after*
  the test run is test output and is never staged — **except** post-PASS hygiene paths
  intentionally extended below. Phase 4 stages code paths only from this git-grounded set
  (pre-test plus any post-PASS hygiene extension) — never from the executor's
  `WHAT_CHANGED` alone.

- Then the orchestrator (native) runs the recorded test command **exactly once** with
  process CWD = **WORKSPACE**, without sticking the host session there — e.g.
  `(cd "$WORKSPACE" && eval "$TEST_COMMAND")` or `make -C "$WORKSPACE" …` — even if the
  executor believes nothing changed. Capture full output to a temp file; keep a tail
  (e.g. last 80 lines) for Last cycle Notes (tail only — not suite dump). From that authoritative run derive `STATUS`
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
          non-empty (never leave pre-hygiene `confirmed` when isolation failed — Last cycle must
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

**Replace** entire `## Last cycle` from Phase 1's report with `Committed: pending`, or the
lightweight empty-backlog entry defined in Phase 0 step 5. Set header `**Iteration counter:**`
and Last cycle `**N:**` to this cycle's `N`. Update stop-condition counters using plain
comparison and arithmetic, never by asking an LLM to freehand-edit them. The empty-backlog
path holds counters exactly as specified and does not apply the PASS/partial reset row.
Mid-cycle notes (scope violation, lint record, test tail) carried in-memory from Phase 1
land here in Notes / fields — not in a multi-entry diary.

If STATUS was PASS, Outcome was `confirmed`, **and `CHANGED_PATHS` was non-empty** (real
code actually landed this cycle), **remove** the selected item’s **entire contiguous block**
(title + clause sub-bullets) from `## Backlog` (open-only work queue — do **not** flip to
`[x]`; use `backlog-blocks.js` delete when practical). Capture Thesis / Outcome / What
landed / Notes on **## Last cycle** so Phase 4 banks the learning in the **commit body** (that
is the durable done memory). Without the delete, Phase 1 could re-select the same open
line later this campaign; without the commit-body fields, the next invoke would lose *why*
it was improved. Leave the item **open** (`[ ]`) on FAIL, `disproven`, `blocked`, or
`partial` — for `partial`, progress landed but the item is not fully done, so it stays for
the Phase 3 panel to refine (rewrite remaining work) or a later cycle to finish. Never
delete a `partial` item as if complete.

Use this explicit matrix:

| Test STATUS | Outcome | `consecutive-no-progress` | `consecutive-same-error` |
|---|---|---|---|
| PASS | confirmed / partial, **`CHANGED_PATHS` non-empty** | reset → 0 | reset → 0, signature → none |
| PASS | **`CHANGED_PATHS` empty** (no code landed; reconciled to `partial`) | **+1** (a no-op is not progress) | reset → 0, signature → none |
| PASS | disproven (tests still green but thesis wrong) | +1 | reset → 0 |
| FAIL | any, signature **equals** stop-counter signature (at Phase 2 start) | +1 | +1 (keep signature) |
| FAIL | any, signature **differs** from stop-counter (or stop-counter was none) | +1 | reset → 1 with new signature |
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
Last cycle's `**Error signature:**` for in-cycle display. **Cross-cycle** same-error compare
uses **## Stop-condition tracking** `consecutive-same-error: … (signature: …)` as of **start
of Phase 2** (before this cycle's matrix write) — not a prior diary entry (there is only one
Last cycle). String equality, not fuzzy “same-ish” judgment.

### Phase 3 — Advisor Panel and replan

**PLAN_ORIENT:** on entry to `3-replan` emit orientation triplet; re-banner `(cont)` after
advisor rounds return; mid-cycle turns end with pulse `· on:`.

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
WORKSPACE and should see uncommitted diffs and the live plan `IMPROVE_LOOP.md` (Last cycle + open queue; this cycle's
Phase 2 Last cycle included). Scope: (a) advisors never edit, (b) consolidation keeps new Backlog
items scoped to the stated target; (c) “consider later” / non-material follow-ups go in
**Deferred (P2)** (preferred); out-of-scope one-offs may stay in Last cycle Notes. The list may grow
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
**open** Backlog, **open Deferred (P2)**, **## Next**, **## Last cycle**, counters for this run); the
**prior-learnings digest** built in Phase 0 step 7 from **git commit bodies** (last 15
iterations' Thesis / Outcome / Test evidence / What landed / Advisor consolidation /
Notes / open **Next backlog** / **Next deferred**, plus **COMPLETED_SET** and
**DISPROVEN_SET**), plus a pointer to general non-improve-loop history
(`git log --oneline -20`); and this cycle's Phase 1 report, or the lightweight empty-backlog
Thesis/Outcome. Planning **must** use both the open work queue and git learnings metadata.
Pass pointers and paths rather than inlining all content; each advisor has repository access.
**Advisor throttle (B):** Residual / T0 / T0p / T1 steady cycles default to **native-replanner
only** (same 5-block schema). On **T2** cold-start / `--plan-deep` / stall / disagreement:
dispatch multi-model **when advisors are configured**; otherwise the **native 5-block is the
T2 challenge** (PLAN_T2_CHALLENGE — required in Last cycle Notes). Soft input cap: open
Backlog + Deferred + Campaign brief + ## Next + ## Last cycle + compact COMPLETED/DISPROVEN
(not full diary dump).

Ask independently (structured **5-block** preferred):

> 1. Purpose fit — does recent work + open Backlog still serve the stated purpose?
> 2. Material recommendations — each with class `must-fix|decision|simplify|defer`, kind
>    `defect|product-choice|architecture|implementation|residual`, and full six-clause or
>    residual thin (Evidence+Acceptance only — no invented Decision/Preserve on residual).
>    Before promoting material work, apply aggregate design-time N&S (orch owns; prefer
>    simplify|defer; advisory only — do not alter residual×2/Status).
> 3. Deferred P2 — one-line each.
> 4. Risks / stop concerns.
> 5. Anti-reseed — COMPLETED_SET / DISPROVEN_SET considered and rejected (or none).
> Do **not** re-propose COMPLETED_SET or most-recent disproven theses without re-open reason.
> Do not auto-promote Deferred without stating why newly material. Open checklist only —
> never `- [x]` in Backlog or Deferred. Prefer greppable `P0:`/`P1:` titles + clause sub-bullets.

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
**and** a **Deferred body** (P2 or none). Append one line to **## Last cycle** Notes recording
the full-panel failure. Do not allow advisor infrastructure flakiness to stall the loop.

When usable Round-1 advisors show strong agreement—all recommend the same direction, have
no risk disagreement, make the same continue-versus-stop call, and have no material
conflict on next Backlog items—skip Round 2 and treat Consolidation 1 as final. This is a
cost-control early exit, not a change to the panel's purpose. When any risk-level or
direction disagreement exists, Round 2 is mandatory.

**T2 challenge:** when Plan tier is 2, Last cycle Notes must include
`T2 challenge: native|advisor|skipped — <why>`. Apply work-spec (brief/Backlog) revisions
**before** PLAN_SPEC_SYNC.

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

1. **Backlog body** — **open only** multi-line item blocks: title `- [ ]` with `P0:`/`P1:` plus
   kind, then clause sub-bullets (six-clause material or residual thin). Empty OK when
   residual complete path. **Never** include `- [x]` lines.
2. **Deferred body** — **open only** `- [ ] P2:` for `## Deferred (P2)`, or explicit empty
   (`(none)` / no open P2 lines). Cap ~8–12 open P2s; dedupe.

**Multi-line grammar (PLAN_APPLY):** a contiguous **item block** = title + immediate
sub-bullets matching `Evidence:|Decision:|Preserve:|Unknown:|Acceptance:` (2–4 spaces).
Block ends at next title, next `## `, or blank then non-clause. Residual may not carry
Decision/Preserve (strip + Notes). Orphan clause lines strip on apply. One line per clause
(≤200 chars soft). Prefer `backlog-blocks.js` parse/open-count/residual-forbidden.

#### Surgical apply order (PLAN_SPEC_SYNC)

Apply surgically and natively **in this order** (after strips/guards — PLAN_SPEC_SYNC):

1. **`## Campaign brief`** (if rewritten) through next `## `
2. **`## Backlog`** body through next `## `
3. **`## Deferred (P2)`** body through next `## ` (create heading if missing)
4. **`## Spec validation`** — **re-read applied ledger from disk**; derive V-rows from
   **work-spec** anchors; write `<!-- spec-sync: iter N -->` or Notes
   `spec sync n/a: plan unchanged since iter <N>` (required on skip). Step id `3-spec-sync`.
   Row ops / n/a statuses (item complete, drop claim, validate drop Notes): see
   **PLAN_SPEC_SYNC** update matrix above — do not invent free-form `n/a`. Never sync from
   pre-guard candidate Backlog. Then optional PLAN_SPEC_SOFT (`softCheckSpecBundle`) —
   disposition Notes `soft: <code> → addressed|waived|unresolved`; **never auto-seed** from
   soft warnings alone.

Advisors recommend deltas, never whole-file rewrite. Never ask an advisor or fallback
replanner to rewrite the whole file; that can clobber deterministic counters and
**## Last cycle** / stop tracking.

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
  item and append one line to **## Last cycle** Notes:
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

After the rounds and surgical apply or deliberate non-apply, re-check for **unexpected
product** dirt (shared code-dirty, Phase 0 step 4 — ledger / enter-carry / test litter
never count). Advisors are read-only. If any path is newly dirty relative to the
post-Phase-1/post-revert baseline and is not already in this cycle's PASS `CHANGED_PATHS`,
treat it as an infrastructure fault: do not stage it; Notes
`unexpected dirty paths after advisor panel: …`. Never fold advisor-side product into the
cycle commit (pathspec only).

Immediately after surgical apply or deliberate non-apply, and without a subagent:

#### Phase 3v — Spec validation gate (before complete rules)

Step id `3v-prove`. When open
P0/P1 = 0 after replan and same-error/no-progress stops have not fired: if product residual
survey still pending (product/mixed), run that first. Else run Spec validation Proofs
(orchestrator-native; `scripts/spec-validate.js` for parse/seed/dedupe). Suite-kind Proofs
reuse this cycle’s suite or one Confirm run (never two). Capture proof litter into
`TEST_ARTIFACT_PATHS`. Write V-row Status cells + header `**Spec validation:**`. On
executable fail: seed deduped on colon-token `validate V<k>:` (not bare V1 matching V10) `- [ ] P1: [defect] validate V<k>: <short> (<artifact>)`
(never uncheck done items); on re-seed Notes `fix target: product | proof`. Manual rows
never block unattended. Vacuous pass if section missing/all n/a; T2 missing section → seed
write-section once (fallback). Re-run all executable rows every firing.

**Control channel (PLAN_SPEC_STATUS):** on step entry use one `▸` dialect with step id:
`▸ improve · Phase 3 · cycle K/MAX · iter N · 3v-prove · <action> (from 3-spec-sync)`.
End of sync: Spec sync card **or** skip one-liner. End of 3v: **Spec prove** card — non-pass
rows only in evidence table; Loop effect never “done”. Validation line (pulse/commit/discovery):
`Validation: N pass / M fail (V…) / W pending / K n/a … · sync=iter J | skip@J`.

**PLAN_SPEC_SOFT (mandatory invoke, soft result — non-blocking for residual×2):** when Node
is available, after **`3-spec-sync` and `3v-prove`**, run:

```bash
node "$SKILL_DIR/scripts/spec-validate.js" soft-check --plan-file "$WORKSPACE/IMPROVE_LOOP.md"
# JSON: { ok, meta, warnings: [{ code, id?, message }] }
```

Emit reasoning beats with **stable codes** (e.g. `SUITE_ONLY_PROOFS`, `MISSING_PRESERVE`,
`HABITAT_CLAIMED_NO_PROOF`, `ASSUMPTION_NOTES_ONLY_PROOF`). If any warnings: Notes
`spec soft-check: CODE[,CODE]…`. **Never auto-seed P1 from soft-warn.** Never alone set
Status complete/fail or change residual×2. Codes/API: `softCheckSpecBundle` /
`WARNING_CODES` in `scripts/spec-validate.js`.

**PLAN_T2_CHALLENGE:** on T2 cold-start and each T2 Phase 3, if advisors are unconfigured or
zero usable Round-1 text, **always** write a native 5-block under Last cycle Notes:

```text
T2 challenge (native):
1. Purpose fit — …
2. Material recommendations — …
   (apply design-time N&S before promote: simplify|defer; orch owns; soft only)
3. Deferred P2 — …
4. Risks / stop — …
5. Anti-reseed — …
```

Prefer writing the native block even when advisors ran (cheap durable artifact). Notes
`T2 challenge degraded: …` **only** if the live ledger cannot be written. Never claim
multi-model advisors when only native ran.

*R7/R8 definitions (canonical summary): [P0/P1 residual discipline](#p0p1-residual-discipline-default) + [Planning contracts](#planning-contracts-tiers--multi-line-backlog); full table in package A `contracts/planning.md` § Sequencing rules. Phase ops below — do not paraphrase R7/R8 law here.*

**R8 — never treat 3v fail as terminal:** Status stays `active` after seeds; in
**autonomous** mode L1 **immediately** starts the next L2 cycle (do not ask the user, do not
emit campaign “done”). Exit only when Spec validation pass/n/a **and** residual×2 complete,
or hard stop. **`--once`:** seed + active + exit (operator re-invokes). Pulse/discovery
**verbatim:** `Validation fail → seeded V… → continuing cycle K+1`.

Then update **residual streak** then Status *in this exact order*:

0. **Open P0/P1 count** after replan **and 3v seeds** = number of unchecked **Backlog** lines containing
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
     semantics against **stop-counter signature** (not a prior diary entry); **reset
     `consecutive-non-material-cycles` → 0** (open P0/P1 reopened).
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

- Use this cycle's Last cycle / header `N`: the number just written in Phase 2 for a
  normal cycle, including empty-backlog lightweight Phase 2; or the existing Last cycle `**N:**`
  for a Phase-0 step-4 ledger flush. Never allocate a new N on a flush.

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

  - On a ledger-only turn, re-check **unexpected product** dirt only (shared code-dirty,
    Phase 0 step 4). **Ledger, enter-carry baseline, isolation, and test litter do not
    veto.** If unexpected product is dirty, do not commit: leave all files as-is (including
    Phase 2/3 ledger edits), set
    `Committed: no — code-dirty veto (refused ledger-only commit over dirty code)`, Notes,
    stop and report. No commit was attempted — do not invent commit-fail counter correction.
  - On a non-ledger-only turn, skip this veto and stage pathspec product from
    `CHANGED_PATHS` as below. Extra unexpected product outside `CHANGED_PATHS` stays
    unstaged (next guard can surface it).

- **Commit procedure — fixed order (do not reorder).** This loop commits unattended. Secret
  patterns: `AKIA[0-9A-Z]{16}`, `ghp_[A-Za-z0-9]{36}`, `sk-[A-Za-z0-9]{20,}`,
  `AIza[0-9A-Za-z_-]{35}`, `-----BEGIN [A-Z ]*PRIVATE KEY-----`, and similar.

  1. **Pre-commit `Committed: yes`.** Set **## Last cycle** `Committed:` to `yes` in
     the on-disk file (narrow in-place exception on the current cycle only). Skip when the code-dirty veto already
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
     Pathspec **must** include new product files: for each path in `CHANGED_PATHS` that is
     still dirty (modified, added, or **untracked `??`**), run
     `git -C "$WORKSPACE" add -- <path>` so `git commit` records the blob. Skipping
     untracked product “to stay clean” is a contract miss.
     - **Non-terminal (Status `active`):** `git -C "$WORKSPACE" add -- IMPROVE_LOOP.md`.
       Also, when STATUS is PASS, Outcome is not `blocked`, and `CHANGED_PATHS` is non-empty,
       add the still-dirty code paths from `CHANGED_PATHS` (edits **and** new files).
     - **Terminal (`complete` or `stopped (...)`):**
       `git -C "$WORKSPACE" rm -f -- IMPROVE_LOOP.md` if tracked (`-f` required when the
       ledger was edited after the prior iteration commit — plain `rm` refuses local
       modifications and leaves IMPROVE_LOOP.md on the campaign branch). If untracked,
       delete the file and do not add it. Also add still-dirty code paths from
       `CHANGED_PATHS` when STATUS is PASS, Outcome is not `blocked`, and that set is
       non-empty (same rule: **new files included**). A ledger-only terminal commit may
       stage **only** the deletion of `IMPROVE_LOOP.md` (not a re-add of its contents).
       **Do not** run merge-back if this `git commit` fails (`PHASE4_COMMIT_OK` stays false).
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

  - **Target** — required stable line `Target: <TARGET>` (plain-language target from the
    invoke / pointer). Phase 0 digests filter multi-skill repos on this field.
  - **Thesis** — what was tried and why (from Last cycle `Thesis`); state it whether it was
    ultimately proven or disproven.
  - **Outcome** — `confirmed` / `disproven` / `partial` / `blocked`; for `disproven`, state
    what the disproof showed (the evidence that the thesis was wrong) — this negative result
    is a first-class learning, not an omission. **Residual / empty-execute / empty
    `CHANGED_PATHS` bookkeeping → `partial` only** (never `confirmed` without real product
    land).
  - **Test evidence** — STATUS plus a one- or two-line summary of the suite result; the
    `Error signature` on FAIL; when Phase 3v fired:
    `Validation: N pass / M fail (V…) / K n/a [unverified manual: k]`.
  - **What landed** — `CHANGED_PATHS`, or `no code landed` for a no-op / ledger-only cycle.
  - **Advisor consolidation** — Phase 3's key agreements, disagreements/risks, and the
    chosen next direction. **Every cycle that runs Phase 3 has a real panel**, including
    empty-backlog lightweight cycles (the skill runs Phase 3 on those too) — record their
    consolidation. Only a **ledger flush** has no panel; for that one case write
    `no panel this cycle (ledger flush)` plus a one-line rationale. Never write
    `no panel this cycle` for an empty-backlog lightweight cycle — that would drop its real
    advisor consolidation.
  - **Notes for next cycle** — the Last cycle `Notes for next cycle` field, verbatim or closely
    paraphrased.
  - **Next backlog** — required. **Open work queue only** — `- [ ] P0:` / `- [ ] P1:` **title
    lines** still open after replan (clause blocks may be title-only in the commit body this
    arc). **Do not** emit `- [x]` done lines here (finished work + *why* are already in
    Thesis / Outcome / What landed / Notes above; next cycle’s COMPLETED_SET is built from
    those fields). For each still-open **six-clause material** title, also put in Notes/body:
    `open intent: <short> | Decision: … | Preserve: …` (intent digest for next cold-start).

    ```
    Next backlog:
    - [ ] P1: [defect] <still open> — <rationale>
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
  `$WORKSPACE/IMPROVE_LOOP.md` from `LEDGER_SNAPSHOT`. Then correct **## Last cycle**
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
| Active after cycle, **autonomous** | Cycle discovery card + progress line; **L1 continues next L2 cycle now** (do not stop for user) — **including after 3v Spec validation fail** (R8) |
| Active after cycle, **`--once`** | Cycle discovery / closing card; L1 exits → Campaign report (Result once-active); if 3v seeded, report pending validation (R8c) |
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

  Parse JSON: `merge_back` is `ok` | `ok_teardown_advisory` | `blocked` | `skipped_detached` |
  `teardown_partial`; `suggested_cwd` is the durable path (LAUNCH); also `worktree_removed`,
  `worktree_kept`, `branch_deleted`, `pointer_cleared`, `ignored_ambient`, `blocking_dirt`.
  On blocked/skipped, leave WORKSPACE; print the FF command from notes/error. Land is durable
  even if teardown is incomplete. Prefer the script over freehand FF so order
  (FF → advisory teardown) stays correct. **Never** leave sticky under a removed
  `.worktrees/*`. **Never freehand-stash** launch dirt to force merge — L3 ignores ambient
  prefixes; real code dirt requires operator commit/discard.

  **Diverged launch (main moved mid-campaign):** if `--ff-only` fails, L3 may
  **rebase-then-FF** when the campaign range is a **linear** stack of only
  `improve-loop: iteration …` / `improve-loop: archive …` commits, with a shared
  merge-base, and at most `IMPROVE_LOOP_MERGE_REBASE_MAX` commits (default 24).
  JSON sets `rebase_then_ff: true`; notes include `rebase-then-ff:rebased …` +
  `rebase-then-ff:ff-ok`. Refuse (stay `reintegrate_blocked`, exit 4) on:
  non-safe subjects, merge commits, no merge-base, range over cap, rebase
  conflicts, or `IMPROVE_LOOP_MERGE_REBASE=0`. Do **not** freehand `rebase`
  outside L3 unless recovering a blocked pointer.

  **Teardown is housekeeping after product land (not product recovery):** merge-back and
  campaign-teardown (1) **restore** borrowed non-isolation WIP onto launch best-effort
  ("give mail/keys back to the counter"), then (2) **always remove the worktree** with
  `git worktree remove --force` (the worktree is a disposable tray; restore is copy-out so
  it stays dirty — soft-remove without force was the orphan farm), then (3) `git branch -d`
  only — never `-D`. Skip-exists / ambient races: **launch wins**; force-remove still runs;
  notes record skips. `worktree_kept` only if remove fails (e.g. lock) — that is
  **teardown incomplete**, not a soft success. **FF success is product land** regardless.
  **Never** call merge-back unless this cycle's Phase 4 commit landed (`PHASE4_COMMIT_OK=true`).

  Emit a **Merge-back card** (mandatory after the L3 call, success or fail):

  ```markdown
  ### 🔗 Improve · merge-back

  | | |
  |---|---|
  | **Result** | ok \| ok_teardown_advisory \| blocked \| skipped_detached \| teardown_partial |
  | **Rebase-then-FF** | yes (diverged launch, improve-only range) \| no |
  | **FF into** | `<launch_branch>` · campaign `<campaign_branch>` |
  | **SHAs** | `<short tip after FF or —>` |
  | **Worktree removed** | yes (expected) \| no only if remove failed |
  | **Worktree kept** | no (expected) \| yes = **teardown incomplete** (lock?) — product already FF'd |
  | **Branch deleted** | yes \| no (`-d` only) |
  | **Pointer cleared** | yes \| no |
  | **Ambient ignored** | <paths or _(none)_> |
  | **Litter cleaned/ignored** | <paths or _(none)_> |
  | **Blocking dirt** | <paths or _(none)_> |
  | **Error** | <one line or —> |
  | **Next if blocked** | clean/commit blocking paths · `worktree-enter --resume` → merge-back-only · re-run `merge-back.js` · **do not** `campaign-teardown` without `--force-drop-reintegrate` |
  | **Next if worktree kept** | product already landed — run operator `git worktree remove --force <path>` from notes |
  ```

  **Reintegrate protect (L3):** `campaign-teardown` and default `worktree-enter` (same **or**
  different target) **refuse** when the pointer is reintegrate-protected — unmerged
  `improve-loop: iteration|archive` commits on the campaign tip, or `state:
  reintegrate_blocked` that is not an empty-range exception. Teardown refuse → exit **3**
  (`teardown: refused_reintegrate_blocked`). Enter refuse → exit **11**. Abandon only with
  explicit `--force-drop-reintegrate` (notes record branch + commit count). Empty-range
  exception: `reintegrate_blocked` but tip already ancestor of launch → discard/teardown OK.
  Exit **10** remains carried-WIP only (not reintegrate).

- **Merge-back-only** (`reintegrate_blocked` or re-invoke after land with no ledger): no
  Phases 1–4; run `merge-back.js` on the same pointer. Success clears pointer. Requires
  `--resume` on enter (default enter does **not** auto merge-back-only).

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
# optional hard B↔M parity (also auto when peer exists): IMPROVE_LOOP_PARITY=1
node "$SKILL_DIR/scripts/package-parity.js" --skill-dir "$SKILL_DIR"
bash "$SKILL_DIR/tests/scripts.test.sh"
```

This skill makes no assumptions about language, layout, or test framework — always use the
recorded test command.
