<!-- Extracted from improve-loop SKILL.md — normative cycle law; do not rewrite casually -->

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
    latest Last cycle to
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
  latest Last cycle's `Committed:` to `no — secret-shaped string detected in <path>`, append
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

  - **Thesis** — what was tried and why (from Last cycle `Thesis`); state it whether it was
    ultimately proven or disproven.
  - **Outcome** — `confirmed` / `disproven` / `partial` / `blocked`; for `disproven`, state
    what the disproof showed (the evidence that the thesis was wrong) — this negative result
    is a first-class learning, not an omission.
  - **Test evidence** — STATUS plus a one- or two-line summary of the suite result; when
    Phase 3v fired this cycle, also fold
    `Validation: N pass / M fail (V…) / K n/a [unverified manual: k]`
    (pending omitted: post-gate executable rows are pass|fail; manual pending is the
    bracket); the `Error signature` on FAIL.
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
  - **Stop-condition state** — `consecutive-no-progress` / `consecutive-same-error` values
    after this cycle, and any terminal `Status` set this cycle.

  Only a **pure ledger flush** (which has no panel) may use a short summary such as
  `ledger flush after interrupt`. An **empty-backlog replan has a real panel**, so its body
  still records the Advisor consolidation field like any normal cycle; its summary line may
  prefix `empty-backlog replan → complete|reopened` but must still carry the panel
  consolidation and a one-line rationale. Even a ledger-flush short-form body must carry a
  one-line rationale so the learning is still reviewable.

- Before attempting the commit, set **## Last cycle** `Committed:` to `yes` and stage
  that edit. This is the narrow in-place exception on current Last cycle: a successful commit freezes the
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

#### Progress pulse (finalize commit fields)

Update the draft pulse from Phase 2:

- Set **Committed** to Last cycle’s final value (`yes` / `no — …`).
- Refresh **key changes** from landed commit paths or remaining dirty veto paths.
- Note stop-condition Status if Phase 3 already set a terminal Status.

Emit is still allowed to wait for Phase 5 so a single pulse includes Next after replan;
if this cycle ends without Phase 5 (hard abort), emit the finalized pulse here.
