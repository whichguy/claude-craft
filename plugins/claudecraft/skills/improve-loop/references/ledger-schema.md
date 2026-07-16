<!-- Extracted from improve-loop SKILL.md — normative cycle law; do not rewrite casually -->

## Durable state: `IMPROVE_LOOP.md`

Write one state file at the target repository root returned by
`git rev-parse --show-toplevel`. It has a rewritable header and Backlog plus a strictly
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

## Driver
- **mode:** continuous | once
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
 successful commit freezes the truth; on commit failure correct that same entry to
 `no — <reason>` and append Notes; never patch after a successful commit.
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
| `next_auto` | Enum only: `cycle` \| `reintegrate` \| `destroy` \| `blocked:<token>` \| `done` |
| `resume_hint` | One imperative line for a cold agent/human — UX only; **recompute next_auto** from disk before trusting hint |
| Rewrites | Entire `## Driver` section may be replaced each boundary (S2/S8/S11–S13 / Phase 5) |
| Legacy | Missing `## Driver` is OK; derive next step from Status + run JSON + git |
| Secrets | No tokens, full test logs, or multi-paragraph dumps |

**Only-ledger auto-commit (narrow):** when the next automatic step is `reintegrate` or
`destroy` and `git status` shows **only** `IMPROVE_LOOP.md` dirty, commit bookkeeping with
subject `improve-loop: driver — next_auto <value>` so the dirty-worktree reintegrate guard
does not false-block. Do **not** auto-commit other paths.

Do not put an iteration's own commit SHA in its Backlog line or Log entry. That commit
includes `IMPROVE_LOOP.md`, so its SHA does not exist when the file is written. Instead,
always use the commit subject `improve-loop: iteration N — <summary>` and look it up with
the stable marker `git log --grep="improve-loop: iteration N —"`. The em-dash after `N`
is required: a bare `… iteration N` is a prefix of longer numbers under git's default
basic regex, so iteration `1` could falsely match `10`, `11`, and later iterations.

Compute `N` deterministically, never freehand:

```
N = (number of `### Iteration` headings already in the Log) + 1
```

At the start of Phase 2, rewrite `**Iteration counter:**` to that same `N` so the header
and Log cannot drift. Do not derive `N` from any outer-loop iteration counter (host goal,
re-invoke wrapper, etc.) — that is a separate quota. Standalone and continuous runs for one
target share the same sequence in `IMPROVE_LOOP.md`.
