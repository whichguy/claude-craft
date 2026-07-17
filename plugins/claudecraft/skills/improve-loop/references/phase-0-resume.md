<!-- Extracted from improve-loop SKILL.md — normative cycle law; do not rewrite casually -->
<!-- Outer continuous loop: prefer improve driver or host goal (contracts/goal.md, outer-loop.md).
     Ralph-loop probes below apply only when that optional re-invoke adapter is driving. -->

### Phase 0 — Resume (native, cheap)

#### Rehydration (every turn — including after context compaction)

**Chat and compacted summaries are not authoritative.** Re-derive control flow from disk
before Phase 1. Prefer a small in-context working set: header + `## Driver` + last **2–3**
Log entries + Stop-condition lines + unchecked Backlog (or first few items) — never the full
historical Log.

**Priority when sources disagree** (first match wins):

1. **Hard git/runtime stops** — mid-rebase → `blocked:rebase-continue`; worktree dirty
   (more than ledger) → `blocked:worktree-dirty`; launch tracked dirty when S11b needed →
   `blocked:launch-dirty`; worktree path missing but run JSON active →
   `blocked:worktree-missing`. (Full token list: `ledger-schema.md` `blocked:<token>` catalog.)  
2. **`run_json`** (if file exists) — slug, worktree_path, launch_branch, merge_to_launch,
   reintegrate_status.  
3. **Ledger header** — Status, test command, iteration counter / Log consistency.  
4. **`## Driver`** — hints only (`next_auto`, `resume_hint`); never override (1)–(3). If the
   section is **malformed** (unparseable keys/values), treat as **missing**.  
5. **Chat / user prose** — intent only; never invent a test command or mark complete.
   User “finish” / “stop the run” while Status active → set Status `stopped (user)` and
   derive teardown (`reintegrate` if worktree remains). Incomplete cold-resume paste
   missing repo/slug (and cwd not inside a worktree) → **ask once** interactively, or
   `blocked:ambiguous-run` unattended.

**Resolve active tree (R1):** worktree_path from prompt/Driver/JSON if that directory exists;
else cwd if under `…/.claude/worktrees/improve-*`; else launch root. If a live improve
worktree exists for the run, **do Phase 1 work there**, not on launch. If Driver `repo`
paths don’t match `git rev-parse` on this machine → rewrite from run_json/slug or
`blocked:path-relocated`.

**`next_auto` derivation (summary):** Prefer the pure helper when Node is available:

```bash
node <plugin>/tools/improve-next-auto.js --file snapshot.json
# → { next_auto, blocked_detail, resume_hint, auto_commit_ledger }
```

Build `snapshot.json` from git/Driver/run_json facts (see tool header). Include
`tip_on_launch` from `improve-worktree.sh status` when a worktree exists. Otherwise apply the
same order by hand: mid-rebase → `blocked:rebase-continue`; else worktree dirty (non-ledger)
→ `blocked:worktree-dirty`; else only-ledger dirty before reintegrate/destroy → auto-commit
driver ledger; else no test command unattended → `blocked:no-tests`; else cold target ≠
ledger title without “resume existing” → `blocked:ledger-target-mismatch`; else Status
active under caps → `cycle`; else worktree present and reintegrate not ok → `reintegrate`
(**even if Status is complete**); if after reintegrate ok the tip is **not** on launch
(`merge_to_launch=false` **or** `tip_on_launch=no`) → `blocked:open-pr` (do not claim merged
to launch; **even with keep_worktree**); else reintegrate ok and not keep_worktree →
`destroy` (destroy refuses uncommitted dirt without `--force`; fail →
`blocked:destroy-failed` / `blocked:worktree-dirty`); else `done`. Recompute every turn; do
not trust a stale `resume_hint` for control flow.

**Ambiguous runs:** multiple non-destroyed `.git/improve-runs/*.json` without a clear slug →
`blocked:ambiguous-run` (do not guess).

Then continue with the numbered steps below.

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
   (ask once if missing), Status `active`, an empty Log, zeroed counters, and a `## Driver`
   stub (`next_auto: cycle` or seed intent; paths `none` until worktree create). Seed the
   Backlog immediately. This is a short native step, or a tiny one-shot native Agent call
   only when the target is too vague to turn into one to three concrete, testable unchecked
   items without judgment. Never leave the Backlog empty on a fresh file and then enter
   Phase 1. On this fresh create, skip 3a–4 and go to step 5 with `N = 1`.

3. Otherwise read the header, **`## Driver`** (if present), Backlog, Stop-condition block,
   and last two or three Log entries only.
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
