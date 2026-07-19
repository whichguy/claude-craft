<!-- Extracted from improve-loop SKILL.md — normative cycle law; do not rewrite casually -->

## Durable state: `IMPROVE_LOOP.md`

Write one state file at the target repository root returned by
`git rev-parse --show-toplevel`. It has a rewritable header and Backlog plus a strictly
**## Last cycle** (replace each cycle — not an append-only diary), with two narrow in-place exceptions on the *current, not-yet-committed* Last cycle only:
(1) its `Committed` and `Notes` fields as Phase 4 specifies, and (2) its `Test result` /
`Outcome` / `Error signature` and the Stop-condition tracking lines, as Phase 3's completion
gate specifies (when a completion-confirmation suite fails). Phase 0 steps 3a and 3b may also
repair a false `yes` or stuck `pending` after an interrupted prior cycle.

```markdown
# Improve Loop: <target description>

**Test command:** `<cmd>`
**Started:** <date>          **Status:** active | complete | stopped (<reason>)
**Iteration counter:** N     <!-- sole live N; must match Last cycle **N:** after Phase 2 -->
**Until:** <string|none>     <!-- continuous default: no material P0/P1 for 2 consecutive cycles (green tests) -->
**Max cycles:** <n|none>     <!-- continuous default 10 -->
**Seed mode:** defect | product | mixed
**Product residual survey:** pending | done | n/a (defect)
**Plan tier:** 0 | 0p | 1 | 2
**Spec validation:** n/a | pending | pass   <!-- PLAN_VALIDATE header flag; see phase-3v-validate.md -->
**Habitat claimed:** yes | no
**Habitat probe:** <cmd or n/a>
**Habitat probe result:** ok | fail | n/a | skipped
**Habitat probe evidence:** <≤120 chars or none>
**Operator done-when:** <text or (none)>   <!-- honesty only — never a residual×2 complete predicate -->
**Install mechanism:** copy | symlink | bind-required | unknown | n/a

## Driver
- **mode:** continuous | once
- **until:** <same as header Until|none>
- **max_cycles:** <n|none>
- **cycle_index:** <n|none>
- **slug:** <slug|none>
- **repo:** <absolute launch git root|none>
- **launch_branch:** <branch|none>
- **worktree_path:** <absolute path|none>
- **run_json:** <absolute path to .git/improve-runs/<slug>.json|none>
- **test_command:** <same as header|none>
- **next_auto:** cycle | reintegrate | destroy | blocked:<token> | done
- **blocked_detail:** <one line|none>
- **resume_hint:** <one imperative line for cold resume|none>
- **updated:** <ISO-8601Z|none>

## Campaign brief
<!-- After ## Driver, before ## Backlog (PLAN_BRIEF). Orchestrator-only surgical rewrite
     through next ## . Success/Done when restates skill law only — no new complete predicates.
     Canonical field list: contracts/planning.md § PLAN_BRIEF / PLAN_RUNTIME_CONTRACT. -->
- **Target:** <plain-language target>
- **Problem / opportunity:** …
- **In scope:** …
- **Out of scope / waived:** …
- **Constraints:** test command, package rules, safety…
- **Sources inspected / Open questions:** paths / digest / habitat… / none
- **Surface types / Fidelity preference:** … | n/a — headless
- **Criteria map:** … (PLAN_CRITERIA; ≤6 non-none)
- **Operator post-land:** none | …
- **Runtime contract:** n/a | filled | investigation-P1:<id>
- **Runtime record:** … (if filled; 4–6 lines)
- **T2 challenge:** native | advisor | skipped — <why> | n/a
- **Success / Done when:** residual×2 + green suite (restate skill law only)
- **Plan tier:** 0 | 0p | 1 | 2

## Spec validation
<!-- PLAN_VALIDATE + PLAN_SPEC_SYNC — after brief, before Backlog. Optional T0; required T2.
     Derived from plan statements/assumptions; re-sync when plan diverges since marker.
     <!-- spec-sync: iter N -->  (ledger iter axis only — never L1 cycle K)
     Phase 3 apply order: brief → Backlog → Deferred → Spec (disk re-read) → 3v prove.
     Unintended-change check-in: Preserve / regression / scope. See planning.md + progress.md. -->
| ID | Intention | Kind | Artifact(s) | Proof | Status |
|---|---|---|---|---|---|
| V1 | Feature: … (plan/work-spec anchor) | suite \| L3-test \| skill-law \| prose-sweep \| dual-home \| habitat \| manual | path(s) | executable cmd + success semantics | pending \| pass \| fail \| n/a |

## Backlog
- [x] <item> — done <date> (commit: `git log --grep="improve-loop: iteration 1 —"`)
- [ ] <item> — <why it matters>

### Backlog item contract (P0/P1)

Every unchecked **P0/P1** item uses a kind tag in brackets. Structure and replan
discriminate **on the kind tag** — not prose judgment. Full planning design:
`contracts/planning.md` (tiers, promote-class PLAN_CLASSIFY, multi-line PLAN_APPLY).

**Material kinds** (`defect` | `product-choice` | `architecture` | `implementation`)
require **six clauses** under the title line (PLAN_CLAUSES).

**Greppable form (preferred new seeds — PLAN_TAG):**

```markdown
- [ ] P1: [defect] <change> (<path/symbol>) — <why>
  - Evidence: <current source/runtime fact>
  - Decision: <selected observable behavior or approach, and why>
  - Preserve: <behavior, interface, state, or safety boundary that must not change>
  - Unknown: <branch-changing question, or none>
  - Acceptance: <specific observable result or verification command>
```

**Legacy A form (still valid — PLAN_LEGACY_A; continuous open-count still counts these):**

```markdown
- [ ] [P1][defect|product-choice|architecture|implementation] <change> (<path/symbol>)
  - Evidence: <current source/runtime fact>
  - Decision: <selected observable behavior or approach, and why>
  - Preserve: <behavior, interface, state, or safety boundary that must not change>
  - Unknown: <branch-changing question, or none>
  - Acceptance: <specific observable result or verification command>
```

**Residual kind** (`residual`) is the structural residual survey form — **thin template
only** (Evidence + Acceptance). No invented Decision/Preserve (anti-theater) (PLAN_RESIDUAL):

```markdown
- [ ] P1: [residual] <finding> (<path/symbol>)
  - Evidence: <structural fact observed>
  - Acceptance: <verification command or observable>
```

Legacy residual: `- [ ] [P1][residual] …` with the same thin clauses.

| Kind | Meaning |
|---|---|
| `defect` | Violates an existing contract |
| `product-choice` | Multiple defensible behaviors; selected semantics explicit |
| `architecture` | Authority / ownership / data flow / extension boundary |
| `implementation` | Realizes already-decided behavior without changing contract |
| `residual` | Structural residual survey finding; thin template |

**P2 / optional / YAGNI** items stay **one-line** (no six-clause or thin residual form)
and do not count as open P0/P1 for until/stop. Count every other unchecked item as P0/P1.

Rules:

- Alternatives required only for `product-choice` / `architecture` when a material
  alternative was considered (fold into Decision).
- Unknown only if answers would change scope, approach, interface, sequencing, or tests;
  otherwise write `none`.
- Global **Test command** is the verification floor; item **Acceptance** is
  item-specific proof on top of that floor.
- Do **not** invent fake Decision/Preserve on residual items to look complete.

## Stop-condition tracking
- consecutive-no-progress: 0
- consecutive-same-error: 0 (signature: none)
- consecutive-non-material-cycles: 0

## Next
<!-- Soft hint only — not authority for flush / residual / stop. -->
- **Action:** execute | residual survey | product residual survey | ledger-flush | stop
- **Item:** <open title or _(none)_>
- **Why:** <≤1 line>

## Last cycle
<!-- REPLACE each Phase 2 — field form only; no ### Iteration headings.
     History = git commit bodies. Narrow in-place on current cycle only:
     (1) Phase 4 Committed yes/no; (2) Phase 3 completion-gate FAIL fields. -->
**N:** <integer>
**Date:** <date>
**Thesis:** what we tried and why we thought it would help
**Lint:** PASS | FAIL | skipped (no paths | no tools)
**Lint tools:** <comma ids | none>
**Test result:** PASS | FAIL | n/a
**Outcome:** confirmed | disproven | partial | blocked
**Error signature:** <none | exact short string — see Phase 2>
**Committed:** pending | yes | no — <reason>
**Notes for next cycle:** …
```

`**Lint:**` / `**Lint tools:**` are optional on older entries; new cycles should write them.
Lint is orchestrator-owned via `tools/improve-lint.sh` (see phase-1-execute); it is **not**
folded into `test_command`.

### `## Driver` (rewritable; automation + rehydration)

**Purpose:** cold-resume after context compaction or a user re-prompt without trusting chat.
This is **not** a second ledger — one file only. Lifecycle machine fields also live in
`.git/improve-runs/<slug>.json` (canonical for paths/flags when the file exists).

| Rule | Detail |
|---|---|
| Placement | After header (`Status` / `Iteration counter`), **before** `## Backlog` |
| Keys | Bold `**key:**` + space + value; ignore unknown keys |
| Absent values | Literal `none` (not empty, not em-dash) |
| Paths | Absolute |
| `until` / `max_cycles` / `cycle_index` | Campaign stop fields; **improve** writes at S2/S4; improve-loop **must not invent** until; rehydrate from header/Driver only |
| `next_auto` | Enum only: `cycle` \| `reintegrate` \| `destroy` \| `blocked:<token>` \| `done` |
| `resume_hint` | One imperative line for a cold agent/human — UX only; **recompute next_auto** from disk before trusting hint |
| Rewrites | Entire `## Driver` section may be replaced each boundary (S2/S8/S11–S13 / Phase 5); preserve until/max_cycles/mode unless improve is rewriting intentionally |
| Legacy / malformed | Missing **or unparseable** `## Driver` → treat as absent; derive from Status + run JSON + git |
| Secrets | No tokens, full test logs, or multi-paragraph dumps |

**`blocked:<token>` catalog** (use only these tokens; do not invent synonyms):

| Token | Meaning |
|---|---|
| `rebase-continue` | Mid-rebase in worktree; resolve, `git rebase --continue`, re-run reintegrate |
| `rebase-aborted` | Operator/agent aborted rebase; tip not on source — decide retry or abandon |
| `worktree-dirty` | Uncommitted non-ledger files in worktree |
| `launch-dirty` | Launch has tracked changes; clean before S11b merge |
| `worktree-missing` | run_json active but worktree path gone |
| `ambiguous-run` | Multiple non-destroyed improve-runs without a clear slug |
| `path-relocated` | Driver absolute paths don’t match this machine; rewrite from run_json or stop |
| `ledger-target-mismatch` | Existing ledger title/target ≠ this invoke’s target (need explicit resume-existing) |
| `no-tests` | Unattended and no test command in ledger/header |
| `open-pr` | Tip not on launch (`merge_to_launch=false` and/or `tip_on_launch=no` after S11a); open PR / `--merge-to-launch`; **not** `done` even if `keep_worktree` |
| `destroy-failed` | reintegrate ok but destroy failed; retry destroy; `--force` only to discard intentionally |
| `worktree-dirty` | Also used when destroy/recover refuse uncommitted dirt (tip may already be on launch) |

**Only-ledger auto-commit (narrow):** when the next automatic step is `reintegrate` or
`destroy` and `git status` shows **only** `IMPROVE_LOOP.md` dirty, commit bookkeeping with
subject `improve-loop: driver — next_auto <value>` so the dirty-worktree reintegrate guard
does not false-block. Do **not** auto-commit other paths.

Do not put an iteration's own commit SHA in its Backlog line or Last cycle. That commit
includes `IMPROVE_LOOP.md`, so its SHA does not exist when the file is written. Instead,
always use the commit subject `improve-loop: iteration N — <summary>` and look it up with
the stable marker `git log --grep="improve-loop: iteration N —"`. The em-dash after `N`
is required: a bare `… iteration N` is a prefix of longer numbers under git's default
basic regex, so iteration `1` could falsely match `10`, `11`, and later iterations.

Compute `N` via **allocate_N** (see phase-0-resume / improve-loop plan-file law), never
freehand and never from host turn counts / `max_cycles`:

```
cold-start → N := 1
else if latest not landed → reuse Last cycle / header N
else → N := max(header, Last cycle **N:**, optional git max) + 1
```

At Phase 2: **replace** entire `## Last cycle` for `N`, set header counter to same `N`.
Standalone and continuous runs for one target share the same sequence in `IMPROVE_LOOP.md`.

**Legacy:** if `## Log` / `### Iteration` present on resume, collapse to Last cycle (max N)
before 3a/3b — orchestrator only; L3 dual-detects for migrate/discard via hasCycleState.
