---
name: improve-loop
description: >-
  Run one evidence-led improvement cycle for a plain-language target in any git repository:
  execute a bounded backlog item, test it, record deterministic learnings, replan through a
  multi-model advisory panel, and commit the durable ledger. Invoke for "/claudecraft:improve-loop <target>",
  "improve this project iteratively", or "run a tested improvement cycle"; combine with
  ralph-loop when an unattended, hard-capped outer quota is needed.
---

# Improve loop

Run exactly one improvement cycle per invocation. The cycle executes (or deliberately
skips) a bounded piece of work, runs the target's recorded test command, captures the
evidence and thesis in `IMPROVE_LOOP.md`, replans from a multi-model advisory panel, and
commits the result. Git commits are the durable, reviewable ledger: future cycles read
both the state file and relevant history.

This skill does not contain its own repeat mechanism. Use it once for a manual cycle, or
compose it with `ralph-loop` for an outer quota with a hard `--max-iterations` cap. The
ralph quota and this skill's per-target iteration counter are independent.

## Invocation

Invoke as free text:

```
/claudecraft:improve-loop <target, described in plain language>
```

For example:

```
/claudecraft:improve-loop "error handling in scripts/ingest.py, tests via pytest"
```

As a plugin skill the slash command is namespaced `/claudecraft:improve-loop`. A local
`/planning-suite:alias improve-loop /claudecraft:improve-loop` restores the bare `/improve-loop` form.

Use no skill flags. If the invocation does not state the target's test command, ask for
it once in conversation (this interactive ask applies only to a standalone, human-present
run), then record it in `IMPROVE_LOOP.md`. Reuse the command already recorded for that
target; never assume a project's test convention. **Exception for unattended runs:** if an
active `ralph-loop` is driving this session (its state file is present, see Phase 0 step 1)
and no test command is recorded and none was passed in the wrapper prompt, do **not** block
waiting for a human answer — there is no one to answer. Instead terminate cleanly with a
*committable* ledger so ralph stops rather than burning iterations re-hitting this: create
`IMPROVE_LOOP.md` if absent, **write a real Log entry** — `### Iteration 1` (or the next
`N` on an existing file), Thesis `no test command supplied for an unattended run`, Test
result `FAIL`, Outcome `blocked`, `Committed: pending` — set header `Status: stopped (no
test command)`, then run Phase 4 to commit that ledger (ledger-only; the tree is otherwise
clean so the code-dirty veto does not fire) and Phase 5 to emit the promise (terminal +
landed). Report it. The user seeds the command and restarts. This is why the recommended
flow seeds `IMPROVE_LOOP.md` with a standalone run first.

## Preconditions

Fail fast in Phase 0. Do not half-run a cycle.

- The working tree must be inside a git repository: `git rev-parse --show-toplevel` must
  succeed. Commits are the durable ledger; without git there is no Phase 4. Stop and say
  so rather than inventing a second persistence path. Resolve and remember this repo root
  now — every later step depends on it.
- `IMPROVE_LOOP.md` at the repository root must not be gitignored. Check with
  `git check-ignore -q IMPROVE_LOOP.md`. If it is ignored, commits of the state file can
  silently skip or fail depending on hook setup; refuse clearly so the user can un-ignore
  it or later choose a different marker file.
- **Test artifacts must not litter the tracked tree.** The recorded test command may write
  transient files (byte-code caches, coverage data, snapshots, build output). Recommend the
  target repo **gitignore** these — `git status --porcelain` omits gitignored paths, so
  ignored artifacts never trip the dirty-tree guards. Un-ignored persistent test output is a
  real hazard: this skill excludes it from the *current* turn's guards (see the shared
  code-dirty definition in Phase 0 step 4 and the turn-level `TEST_ARTIFACT_PATHS` set), but a
  *later* invocation's fresh Phase 0 dirty-tree guard will see it as dirt and stop. If that happens
  the skill reports it and asks the operator to gitignore or clean those paths; it never
  permanently teaches itself to ignore arbitrary paths.
- Ensure the tools required for the path being taken are present: `git`, a shell capable
  of running the recorded test command, and, for the 1b path, an available `codex-worker`
  Agent type. If the live tier is Sonnet/Opus/Fable and `codex-worker` is missing or
  unavailable, fall back to native implementation in 1a and note the fallback in the Log;
  do not hard-fail the cycle because that plugin is missing. (Determine the live tier from
  the running session's own self-identification of its active model — this is ambient
  context every session already carries, not something to look up externally.)

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
and Log cannot drift. Do not derive `N` from ralph-loop's `iteration` frontmatter field:
that is the outer quota. A standalone run and a ralph-wrapped run for one target share the
same sequence in `IMPROVE_LOOP.md`.

## The cycle

### Phase 0 — Resume (native, cheap)

1. Resolve the repository root and enforce all Preconditions: a git repository and a
   non-ignored state file. Initialize the **turn-level** set `TEST_ARTIFACT_PATHS` to empty
   now — it accumulates test-command side effects across this turn's suite runs (see Phase 1's
   shared capture rule) and is excluded from the shared code-dirty definition. It resets every
   turn and is never persisted, so it cannot go stale.

   **Fail fast on an unbounded ralph quota — here, before any dirty-stop path.** The hazard
   this guards against is not a normal cycle under `max_iterations: 0`; it is a **Phase 0
   stop-and-report** (step 4's not-landed+code-dirty stop, or step 6's pre-cycle dirty-tree
   stop) that ends the turn with no promise and no landed commit, so ralph's Stop hook simply
   re-feeds the same prompt forever. Those stops happen *before* step 8, so a fail-fast placed
   there is unreachable on exactly the paths it needs to guard — check it here instead, before
   any other step. Read only what this check needs from
   `<repo root>/.claude/ralph-loop.local.md` (root-anchored, not a bare relative path; ignore
   the stale `.claude/.ralph-loop.local.md` spelling in the plugin's help file): presence,
   `session_id`, and `max_iterations`. Determine whether the ralph Stop hook is actually
   **driving this session** using the *same predicate the hook itself uses* (mirror
   `stop-hook.sh`, not a plain equality check) — driving is true unless the state file's
   `session_id` is **both non-empty and different from** this session's id; an **empty or
   absent** `session_id` is the hook's legacy fall-through and counts as driving *every*
   session. If the state file is present, the hook is driving this session by that predicate,
   and `max_iterations == 0` (unlimited), fail-fast immediately: report that unlimited is
   unsupported for this composition and ask the operator to re-launch with a finite
   `--max-iterations`. Do this **before** any other action this step or later steps would take
   — no ledger create/repair, no dirty-tree check, no cycle work. Reuse the same driving
   predicate at step 8 for Phase 3's ralph-max-iterations terminal check, so a stale
   *mismatched* state file cannot mis-stop a session it isn't actually driving.

2. If `IMPROVE_LOOP.md` is absent, create it with the target description, test command
   (ask once if missing), Status `active`, an empty Log, and zeroed counters. Seed the
   Backlog immediately. This is a short native step, or a tiny one-shot native Agent call
   only when the target is too vague to turn into one to three concrete, testable unchecked
   items without judgment. Never leave the Backlog empty on a fresh file and then enter
   Phase 1. On this fresh create, skip 3a–4 and go to step 5 with `N = 1`.

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
   `git log --grep="improve-loop: iteration <that entry's N> —" -n 1` finds no commit,
   the previous cycle wrote pre-commit `yes` but never landed a commit (crash, kill, or
   hook abort before object creation). Correct it to
   `Committed: no — commit never landed` and append one Notes line. Do not invent a
   backfill commit here: this is an honesty repair only, and step 4 may still need a
   ledger flush.

   3b. **Stuck `Committed: pending` recovery.** If the latest Log entry still says
   `pending`, the cycle died after Phase 2 wrote it but before Phase 4's pre-commit `yes`
   write, including a Phase-4 code-dirty veto that never staged. Correct it to
   `Committed: no — cycle interrupted before commit` and append one Notes line. This is
   likewise honesty only.

4. Decide **landed vs short-circuit vs ledger-flush**. The dirty-tree guard deliberately
   ignores `IMPROVE_LOOP.md`; a bookkeeping-only crash can leave terminal Status on disk
   with no git commit, so Status alone must not short-circuit and burn the outer run with
   an empty ledger.

   - Define **landed** for the latest entry as: its `Committed:` line is `yes` **and**
     `git log --grep="improve-loop: iteration <that entry's N> —" -n 1` finds a commit.
     Always evaluate this after 3a/3b. The grep must include the em-dash after `N`.
   - Define **code-dirty** (the single shared definition used by this step, step 6, Phase 3's
     post-panel check, and Phase 4's veto) by set subtraction: a path is code-dirty **iff**
     `git status --porcelain` lists it **and** it is **not** in
     `{IMPROVE_LOOP.md} ∪ TEST_ARTIFACT_PATHS` — the turn-level set initialized empty in step 1
     and extended after every orchestrator suite run this turn (Phase 1's shared capture rule).
     `git status --porcelain` already omits gitignored files, so gitignored test artifacts
     never count. On a fresh turn, before any suite has run, `TEST_ARTIFACT_PATHS` is empty, so
     un-gitignored artifacts left by a prior cycle *do* count here — intentionally (see the
     Test-artifacts precondition): report them and ask the operator to gitignore/clean rather
     than proceeding.
   - If Status is `complete` or `stopped (...)` **and landed**, do not start a new cycle.
     Report that state and, under ralph-loop, emit the completion promise in Phase 5. This
     prevents a quota burn when a finished, committed run is fed to the wrapper once more.
   - If the latest entry is **not landed** and the tree is **code-dirty**, whether Status
     is active or terminal, stop and report now. Do not promise, do not enter Phase 1, and
     do not allocate a new `N`. A PASS cycle that crashed after Phase 1 often has this
     shape. Automatically flushing only `IMPROVE_LOOP.md` would land a terminal Status and
     allow ralph to promise-exit while abandoning the code diff. The user must commit,
     discard, or finish the prior cycle's intent before continuing.
   - If the latest entry is **not landed** and the tree is **not code-dirty** (only
     `IMPROVE_LOOP.md` is dirty, or the tree is clean), do a **ledger flush**: skip
     Phases 1–3; run Phase 4 using the latest entry's iteration number as `N` without
     allocating a new number; then run Phase 5. This covers terminal-without-commit and
     active bookkeeping-only interruptions. Phase 5 emits the promise only if Status is
     terminal and this flush landed.
   - Otherwise, if the latest entry is landed and Status is `active`, continue to step 5
     for a real new cycle and allocate the next `N` only then. The zero-Log case never
     reaches this branch because step 3 routed it directly to step 5.

5. If the Backlog has no unchecked items while Status is `active`, skip **Phase 1 execute
   only**. Do not skip the rest of Phase 0: steps 6–8 still run because Phase 3 needs git
   history and the ralph iteration count regardless of execution, and Phase 4 bookkeeping
   must still occur. Allocate this cycle's `N` if the zero-Log path did not already set it.
   After step 8 use lightweight Phase 2, then Phase 3, Phase 4, and Phase 5. Do not invent
   an ad-hoc code task to fill the cycle; replanning can reopen work or declare completion.

   For the **lightweight Phase 2** empty-backlog/no-execute path, append an entry with
   `Committed: pending`, Thesis such as `empty-backlog replan (no Phase 1 execute)`, Test
   result `PASS` (the suite was intentionally not re-run because no change set exists),
   Outcome `partial`, and Error signature `none`. Hold both stop-condition counters and
   the stored error signature *exactly* as they were. Do not apply the normal PASS/partial
   matrix row; resetting `consecutive-no-progress` for this no-op would hide a real stall.
   Set the header counter to `N`, then run Phase 3 normally.

6. For turns that will run Phases 1–3, apply the dirty-tree guard using the **shared
   code-dirty definition** (step 4): if anything code-dirty is present, stop and report rather
   than folding unrelated pre-existing work into this cycle's commit. (This is a fresh turn, so
   `TEST_ARTIFACT_PATHS` is empty and only gitignored artifacts are excluded — un-ignored test
   litter from a prior cycle trips here on purpose; report it and ask the operator to
   gitignore/clean.) This also includes intentional dirty state left by an earlier mid-commit
   failure. Do not auto-stash. Ledger-flush turns already branched at step 4 and never reach
   this guard for a new cycle.

7. Build a **prior-learnings digest** for this target from git history (git commits are the
   durable, reviewable ledger; this is what makes learnings reviewable across cycles).

   - Fetch the **full commit bodies** of the last 15 prior improve-loop iterations for this
     target:
     `git log --grep="improve-loop: iteration" -n 15 --format="%H%n%s%n%b%n---"`.
     This is a **bulk prefix match** against the literal `improve-loop: iteration` — it
     matches every improve-loop commit. **No number and no em-dash belongs in this
     pattern.** (The per-iteration lookups used elsewhere in the skill,
     `--grep="improve-loop: iteration N —"`, are a *different* pattern and already carry the
     em-dash to stop `iteration 1` matching `10`; do not conflate them. Adding an em-dash
     here would match **zero** commits, since real subjects put a number between `iteration`
     and `—`.)
   - Separately run `git log --oneline -20` for the target repo's own (non-improve-loop)
     recent history and pass it as a pointer for general context.
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

8. If step 1's driving predicate found the ralph state file, re-read it here for the fuller
   set Phase 3 needs: frontmatter fields `active`, `iteration`, `session_id`,
   `max_iterations` (`0` means unlimited; step 1 already fail-fasted before reaching here if
   this session is driving and it was `0` — see step 1), `completion_promise` (`null` or a
   quoted string), and `started_at`. Phase 3's terminal check #4 needs `iteration` and
   `max_iterations`, gated on the **same driving predicate as step 1** (not a plain
   `session_id` equality — a stale, non-empty, mismatched `session_id` means the hook isn't
   driving this session and must not mis-stop it): treat the final permitted outer turn as
   *driving* **AND** `max_iterations > 0 AND iteration >= max_iterations`. ralph starts at
   iteration 1, increments only when continuing, and its Stop hook checks that condition
   before incrementing at the top of each firing. `/cancel-ralph` deletes this file; that
   requires no action here.

### Phase 1 — Execute

This is the fresh-agent context-clearing step. Select the next unchecked Backlog item. As a
backstop, before selecting, skip any unchecked item that re-asserts a prior disproven thesis
**unless** the item's Backlog-line rationale explicitly re-opens it with a stated reason (per
Phase 3's reason-in-rationale rule). This catches a disproven re-attempt that survived into
the Backlog despite Phase 3's guard. It reads the same disproven-theses list carried from
Phase 0 step 7 (a thesis is "disproven" only if its most-recent recorded outcome was
`disproven`) and judges semantically, not by substring match.

- **1a, always, native:** Dispatch a fresh `general-purpose` Agent, never
  `codex-worker`, with the next unchecked Backlog item and pointers to
  `IMPROVE_LOOP.md` and recent git history (paths/refs, not inlined content). **Instruct it
  explicitly: do not commit, do not `git add`/stage, and do not edit `IMPROVE_LOOP.md` —
  just modify the working tree and report what changed.** A 1a commit or stage would bypass
  this cycle's scope check, secret scan, and exactly-one-commit discipline, and a
  stray staged file would ride along on the next commit. The `general-purpose` agent
  normally has all tools, including Skill. When the item names an existing Claude Code skill,
  instruct it to use the Skill tool when that tool is in its toolset. If Skill is unavailable
  in an unusual restricted configuration, perform the equivalent work directly by reading the
  skill file if needed; do not block the cycle on subagent Skill-tool availability.

  If the live tier is Sonnet/Opus/Fable (checked fresh each cycle from the dispatching
  session's own self-identification of its active model, per the Preconditions note
  above), a bounded code change is needed, and `codex-worker` is available, have 1a stop
  short of writing code and return a scoped implementation specification: goal, exact file
  list, acceptance criteria, and `Do not commit`. Otherwise, have 1a implement or
  investigate itself.

- **1b, conditional:** Only when 1a returned that scoped specification, dispatch
  `codex-worker` without worktree isolation; this loop is single-threaded in the same
  tree. Give it the bounded brief: goal, exact file scope, constraints, acceptance
  criteria, and the exact instruction `Do not commit; leave changes in the working tree.`
  It should report structured `done`/`partial`/`blocked`/`failed` status, git-verified
  changed files, what it verified, risks, and, when blocked with open questions, enough
  context to resume the same underlying Codex thread rather than launching a fresh one.
  This clarify-and-resume exchange happens entirely within this same Phase 1 dispatch,
  using `codex-worker`'s own built-in protocol (answer the open questions, then resume the
  same thread, capped at two rounds before deciding or escalating) — it is resolved before
  1b reports back, never something threaded across cycles via the Log.
- **Scope check on 1b's report:** `codex-worker`'s own structured report already lists
  git-verified changed files against its declared scope and flags any mismatch as a risk —
  read that flag. If it reports any changed path outside the file scope declared in its
  brief, do not silently fold that path into this cycle's commit: note it in the Log
  (`scope violation: <path> was outside the declared file scope`) and set this cycle's
  Outcome to `blocked` rather than accepting an unreviewed out-of-scope change. Phase 4's
  code-dirty veto then refuses a ledger-only commit over the unresolved diff, exactly as
  any other blocked-and-dirty state is handled.

- **The orchestrator — not the executor — owns the test run, the STATUS, and the revert.**
  The 1a/1b dispatch settles and returns; that subagent is then gone and cannot run a
  post-settle suite or revert later. So the executor's structured report carries only what
  it can know at return time: `WHAT_CHANGED` (paths it touched), `THESIS` (one line), and a
  *suggested* `OUTCOME`. It does **not** establish the authoritative STATUS.

- Ground file identity in git, not an LLM report, and capture it **before running the
  test** — otherwise files the *test* creates (coverage reports, snapshots, generated
  fixtures, local caches) would land in the change set and get committed as if they were the
  work. So the moment the executor returns and before the test runs, compute `CHANGED_PATHS`
  as a **set of pathnames** from `git status --porcelain`: strip the two-column status code
  and its following space from each line; for a rename line (`R  old -> new`) take the `new`
  path; unquote any path git quoted (paths with spaces/special characters are wrapped in
  double quotes with C-style escapes). Drop `IMPROVE_LOOP.md` (Phase 1 must not edit it;
  Phase 4 handles it separately). This is the executor's change set; anything that becomes
  dirty *only after* the test run is test output and is never staged. Phase 4 stages code
  paths only from this git-grounded, parsed, pre-test set — never from the executor's
  `WHAT_CHANGED` alone.

- Then the orchestrator (native) runs the recorded test command **exactly once** — even if
  the executor believes nothing changed. Capture full output to a temp file; keep a tail
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
  `pre_suite := parse(git status --porcelain)` — then, once it finishes, **extend** (never
  replace) the turn-level set: `TEST_ARTIFACT_PATHS += parse(git status --porcelain now) −
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

  - For tracked paths, use `git restore --staged --worktree -- <path>` (i.e. `git restore
    -SW`, or `git checkout -- <path>` **after** `git restore --staged`) for every path in
    `CHANGED_PATHS` — a plain `git restore -- <path>`/`git checkout -- <path>` only rewrites
    the worktree and leaves a staged copy behind, so an executor that ran `git add` would
    leave the tree non-clean and trip Phase 4's veto. Restoring staged **and** worktree
    clears both.
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

Use a configurable advisor list, defaulting to two advisors:

- `codex:codex-rescue`
- `grok-cc:grok-rescue`

Dispatch each through the **Agent tool** with the listed `subagent_type`, and let the Agent
tool provide the concurrency and async (see Budget and usability below) — do not hand-roll
background jobs or poll companion scripts. Both advisors are thin one-shot forwarders
(codex-rescue → `codex-companion.mjs task`, grok-rescue → `grok-companion.mjs task`) that
return their review text as the agent's result. They have full access to the worktree and
are expected to see uncommitted diffs and the full `IMPROVE_LOOP.md` Log (this cycle's
Phase 2 entry included). The scope boundary is not filesystem privacy — it is that (a)
advisors never edit, and (b) consolidation keeps new Backlog items scoped to the stated
target (out-of-scope observations go in Log Notes, not Backlog bullets). The list may grow
by adding advisors; the mechanism is unchanged.

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

For every advisor with usable Round-1 text, **resume that exact advisor with `SendMessage`
to its recorded Agent id** — not a fresh dispatch, and not a companion `--resume` (which
means only "the latest session for this tool/cwd" and can attach to the wrong session).
SendMessage continues the specific Round-1 advisor from its own transcript, which is the
true per-advisor resume this panel wants; even if the advisor's underlying tool thread
can't be reattached, the agent still has its own Round-1 review in context. Send it its own
Round-1 position plus the Round-1 consolidation, all advisors in parallel:

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
the terminal test below evaluate only counters and ralph state; do not invent `complete`
from a wiped list.

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
4. Ralph-loop is **driving this session** (Phase 0 step 1/8's predicate — not a plain
   `session_id` equality) and `max_iterations > 0` and `iteration >= max_iterations` →
   `stopped (ralph max iterations)`
5. Otherwise leave Status `active`.

Advisors never edit counters, so a panel that wants to continue cannot override a counter
stop. The order matters: every FAIL increments no-progress, so three identical FAILs reach
both thresholds together; checking same-error first preserves the more specific reason.
Update Status before Phase 4 so the terminal note is in the same commit as the cycle.

### Phase 4 — Commit (native)

Attempt exactly one commit for a cycle, or for a ledger-flush turn that reaches this phase
with a writable tree, unless the code-dirty veto below fires. Pure bookkeeping cycles still
commit `IMPROVE_LOOP.md` when permitted, so the ledger advances.

- Use this cycle's Log iteration number for `N`: the number just written in Phase 2 for a
  normal cycle, including empty-backlog lightweight Phase 2; or the latest existing entry's
  number for a Phase-0 step-4 ledger flush. Never use `count + 1` on a flush, which would
  orphan the greppable marker from the existing Log heading.

- Apply the **code-dirty veto before staging**. Classify a turn with the same staging rule
  below. A **ledger-only** turn would stage only `IMPROVE_LOOP.md`: STATUS is not PASS, **or
  Outcome is `blocked`** (even when STATUS is PASS — e.g. a scope violation caught in Phase 1
  leaves green tests but an untrusted diff), or STATUS is PASS but `CHANGED_PATHS` is empty,
  or it is a Phase-0 ledger flush or an empty-backlog replan. A **non-ledger-only** turn is
  STATUS PASS **and Outcome not `blocked`** with a non-empty post-Phase-1 `CHANGED_PATHS`
  intersection that remains dirty. Those code paths should be dirty and must not be vetoed.
  (Making `Outcome: blocked` always ledger-only is what routes a blocked-with-dirty-code
  cycle — scope violation, or a failed FAIL revert — into the veto below instead of silently
  committing the untrusted diff on a green test run.)

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

- One light safety check before committing (this loop commits unattended): scan the
  content of every path about to be committed — the staged code paths **and
  `IMPROVE_LOOP.md`** (the ledger embeds `TEST_OUTPUT_TAIL` and raw error text, so a
  test-printed token could otherwise land in it) — for secret-shaped strings
  (`AKIA[0-9A-Z]{16}`, `ghp_[A-Za-z0-9]{36}`, `sk-[A-Za-z0-9]{20,}`, `AIza[0-9A-Za-z_-]{35}`,
  `-----BEGIN [A-Z ]*PRIVATE KEY-----`, and similar). On a match, don't commit: set the
  latest Log entry's `Committed:` to `no — secret-shaped string detected in <path>`, append
  a Notes line, and stop and report for the user to scrub. **Also scan the composed
  commit-message body string** (the second `git commit -m "<body>"` argument) for the same
  patterns before running `git commit`: the body now carries the advisor-consolidation
  narrative (see the body rule below), which is not written into `IMPROVE_LOOP.md` and so is
  not covered by the file-content scan above. On a match in the message body, don't commit:
  set `Committed:` to `no — secret-shaped string detected in commit message`, append a Notes
  line, and stop and report.

- Stage this cycle's own paths and commit — the plain `git add` + `git commit`, with one
  discipline: **stage explicit paths only, never `git add -A`/`add .`** (a standing
  convention, and the reason Phase 0's dirty-tree guard already ensured nothing unrelated is
  dirty). Build the path list:
  - Always include `IMPROVE_LOOP.md`.
  - **Only when STATUS is PASS, Outcome is not `blocked`, and `CHANGED_PATHS` is non-empty**,
    also include the code paths in this cycle's change set that are still dirty (the parsed
    post-Phase-1 `CHANGED_PATHS` set intersected with the currently-dirty paths).
  - Otherwise — STATUS FAIL after a successful revert, `Outcome: blocked` on a clean tree,
    empty-backlog replan, PASS with empty `CHANGED_PATHS`, or a ledger flush — the path list
    is **only** `IMPROVE_LOOP.md`.

  Then `git add -- <path> [<path> …]` (the `--` and exact names also pick up a brand-new
  untracked file) and commit with both a subject and a body, e.g.
  `git commit -m "improve-loop: iteration N — <summary>" -m "<body>"`.

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

  Only a **pure ledger flush** (which has no panel) may use a short summary such as
  `ledger flush after interrupt`. An **empty-backlog replan has a real panel**, so its body
  still records the Advisor consolidation field like any normal cycle; its summary line may
  prefix `empty-backlog replan → complete|reopened` but must still carry the panel
  consolidation and a one-line rationale. Even a ledger-flush short-form body must carry a
  one-line rationale so the learning is still reviewable.

- Before attempting the commit, set the latest Log entry's `Committed:` to `yes` and stage
  that edit. This is the narrow append-only exception: a successful commit freezes the
  truthful label, while a post-success patch would recreate the chicken-and-egg problem.
  If the process dies before the object exists, Phase 0 step 3a repairs it. Skip this
  pre-commit write when the code-dirty veto already wrote `Committed: no`.

- If `git commit` fails or is interrupted—hook rejection, lock contention, an empty commit,
  or otherwise—do not treat the cycle as successful. Correct that entry to
  `Committed: no — <raw error>` and append the raw failure to Notes. Leave this correction
  uncommitted; the tree was already going to remain dirty for the next cycle or user.

  Apply the commit-fail counter correction natively, but do not re-score the whole cycle:
  increase `consecutive-no-progress` by one **only if Phase 2 reset it to 0 this cycle**.
  That is PASS + confirmed/partial **with non-empty `CHANGED_PATHS`** only. Do not increase it
  for PASS + disproven or for PASS with **empty `CHANGED_PATHS`** (both already `+1`'d
  no-progress and did not reset), and do not do it for empty-backlog lightweight Phase 2, which
  held counters. Do not change `consecutive-same-error` or the signature: a commit or hook
  failure is not a test error. On a ledger flush with no Phase 2 this turn, skip this
  correction. Never use it for the code-dirty veto, which never attempts `git commit`.
  Do not invent a second commit attempt in the same cycle.

- If STATUS is PASS and the only staged file is `IMPROVE_LOOP.md` with no content change,
  that should not happen after Phase 2/3; if git reports `nothing to commit`, handle it as
  the commit failure above.

### Phase 5 — Loop decision (native, no further file writes)

Phase 3 set terminal Status on a full cycle and Phase 4 attempted the ledger commit. Act
only on a **committed** terminal state.

- If Status is `complete` or `stopped (...)` **and** the latest Log entry is **landed**—it
  has `Committed: yes` and
  `git log --grep="improve-loop: iteration N —"` finds the commit—then:

  - Under active ralph-loop, end the turn with `<promise>IMPROVE_LOOP_DONE</promise>` as the
    **final line**, with the tag's contents matching the configured completion promise
    literally. A one-line human summary *before* that final line is fine — the Stop hook
    extracts the contents of the first `<promise>…</promise>` tag found in the last assistant
    text block, trims outer whitespace, collapses internal whitespace, and compares with
    exact bash `=` equality (after stripping the configured phrase's surrounding quotes), so
    a preceding summary line does not interfere. What is **not** fine: emitting the bare
    phrase without the tags, or wrapping the tag mid-sentence inside other prose on the same
    line.
  - Standalone, report the outcome to the user and do not emit a promise tag.

- If Status is terminal but not landed because Phase 4 failed or the code-dirty veto fired,
  do not emit the promise. Report the failure or veto and leave the dirty tree for the user
  or next turn's stop-and-report/ledger-flush path. A promise here would end ralph-loop
  while its ledger remained uncommitted.

- Two related stops end *before* this phase, each with its own attribution: the **Phase 0
  not-landed + code-dirty stop** (step 4) ends inside Phase 0, and a **Phase 4 secret /
  code-dirty veto** stops and reports inside Phase 4 (its promise-suppression is already
  covered by the not-landed bullet above). Neither may set a `stopped (...)` Status (committing
  a terminal note over dirty code is exactly what the code-dirty veto forbids) and neither may
  emit the promise (that would be false success over an uncommitted tree). Under ralph-loop the
  turn simply ends with a report; ralph's Stop hook then advances the outer `iteration`, so
  `max_iterations` — which **must be a finite `> 0`** (Phase 0 step 1 fails fast otherwise; see
  "Running it on a quota") — is the hard backstop that bounds an unresolvable dirty-tree state.
  The operator resolves the tree (commit or discard) to let the loop resume real cycles.

- Otherwise Status is active. End normally. Under ralph-loop, its Stop hook invokes the
  wrapper again with the same prompt; Phase 0 always re-derives state from the on-disk
  ledger regardless of what triggered the turn.

## Running it on a quota

A single `/claudecraft:improve-loop <target>` (or the bare `/improve-loop` if you have
aliased it locally) performs exactly one cycle and reports. Use this for a
manual first look, and preferably to seed `IMPROVE_LOOP.md` before running unattended.
Then wrap the skill with the already-installed `ralph-loop` plugin:

```
/ralph-loop "Invoke the claudecraft:improve-loop skill (via the Skill tool) for one cycle (or its Phase 0 short-circuit / ledger-flush path). If ./IMPROVE_LOOP.md exists, resume from it (do not re-ask for the target or test command). If it does not exist, create it for target: <TARGET> with test command: <CMD>. Don't just describe the procedure — actually run the skill. Emit <promise>IMPROVE_LOOP_DONE</promise> only when the skill's Phase 5 instructs you to (Status terminal AND the latest Log entry's commit has landed) — never from reading Status alone, and never if Phase 4 failed. If the outer max iterations is exhausted mid-run, the skill should set Status to stopped (ralph max iterations) and commit via Phase 4 before Phase 5 emits the promise." --max-iterations N --completion-promise "IMPROVE_LOOP_DONE"
```

- The wrapper must name the target and test command for cold start; `against
  ./IMPROVE_LOOP.md` alone is insufficient when no file has been seeded.
- `N` in the wrapper is ralph's outer `max_iterations` quota, independent of
  improve-loop's Log counter. It **must be a finite integer `> 0`.** ralph treats
  `max_iterations: 0` as *unlimited*, which is **unsupported** for this composition: an
  unresolvable Phase-0 stop-and-report (e.g. a code-dirty tree the operator has not cleaned)
  ends each turn cleanly but cannot self-terminate without either resolving the tree or
  emitting a false-success promise, so a finite `N` is the only backstop that bounds it. Keep
  `N` modest.
- The wrapper must not promise-exit after casually seeing `Status: complete`; that races
  the ledger-flush path when only `IMPROVE_LOOP.md` is dirty. Phase 5 alone authorizes the
  promise.
- This uses existing ralph-loop infrastructure rather than adding new loop-driving code.
- In `claude -p`, the namespaced form `/ralph-loop:ralph-loop` may be required; interactive
  sessions use `/ralph-loop`.

This skill makes no assumptions about any project's language, layout, test framework, or
build tool. Ask for and record the target test command rather than inferring one.
