<!-- Host-specific agent names: prefer contracts/executor.md; preserve behavioral rules below. -->
<!-- Extracted from improve-loop SKILL.md — normative cycle law; do not rewrite casually -->

### Phase 1 — Execute

**PLAN_ORIENT:** on entry emit the orientation triplet (banner + `improve goal ·` + pulse);
re-banner `(cont)` after substantial sub-actions; mid-cycle turn ends with pulse `· on: <slug>`.
See `contracts/progress.md` PLAN_ORIENT.

This is the fresh-agent context-clearing step. Select the next unchecked Backlog item.

**R2 mechanical (PLAN_VALIDATE):** if any open product item’s Acceptance references `V<k>`
and that V-row’s Proof artifact is **not on disk**, select the open test-authoring item for
`V<k>` first (T0 exploratory may skip). Prefer quarantined proof tests so default suite stays
green (`contracts/planning.md` quarantine).

**PLAN_BACKCHAIN order (soft, after R2 / runtime investigation priority):** when this
campaign’s ledger Notes include a `backchain: order …` line (from `0-backchain` /
`3-backchain`), among remaining open P0/P1 prefer an item with no open supplier in that
order, else the earliest open supplier. Never invent items solely for order. R2 and
PLAN_RUNTIME_CONTRACT investigation select still outrank.

**Pure-test items:** Outcome `confirmed` when the artifact exists, parses/runs, and the
**quarantine-respecting** suite is green — deliberate red proof status is expected and
Notes-only, not `failed` (U-new-3).

**`validate V<k>` items:** may be resolved by fixing **product or proof** (R6 / U-new-6).

As a backstop, before selecting, skip any unchecked item that re-asserts a prior disproven thesis
**unless** the item's Backlog-line rationale explicitly re-opens it with a stated reason (per
Phase 3's reason-in-rationale rule). This catches a disproven re-attempt that survived into
the Backlog despite Phase 3's guard. It reads the same disproven-theses list carried from
Phase 0 step 7 (a thesis is "disproven" only if its most-recent recorded outcome was
`disproven`) and judges semantically, not by substring match.

**Confirm / empty-backlog verification:** when Phase 0 took the Confirm exception
(`confirm: verification cycle required` despite empty backlog), this phase still owns the
orchestrator suite run (or Phase 0 already ran it before lightweight Phase 2 — do not
double-run). See phase-0-resume step 5 Confirm exception.

Executor requirements (portable): **Read** `contracts/executor.md`. In short: implement
without committing, staging for commit, or editing `IMPROVE_LOOP.md`.

**Material intent handoff (normative):** when the selected item is a **material** kind
(six-clause form per `ledger-schema.md` / `contracts/planning.md`), pass **Change**,
**Decision**, **Preserve**, and **Acceptance** into the planner/executor **unchanged**
(greppable `P1: [kind]` or legacy `[P1][kind]`). The executor may report
**contradictory evidence** (source/runtime fact that falsifies Decision or makes Preserve
impossible) but must **not** silently reinterpret Decision or violate Preserve. On
contradiction, set Outcome `blocked` or `partial` with Notes that name the conflict, and
leave Decision/Preserve for Phase 3 amendment — do not “fix it another way” without a
Backlog rewrite. Residual thin items hand off **Evidence** + **Acceptance** only
(investigation path when Unknown ≠ none or residual survey).

- **1a, always:** Dispatch a fresh host **executor** (general-purpose write agent; never a
  specialized committer). Give the next unchecked Backlog item and pointers to
  `IMPROVE_LOOP.md` and recent git history (paths/refs, not inlined content). For material
  items, include the Decision / Preserve / Acceptance clauses in the brief (not a
  paraphrase that drops them). **Instruct it explicitly: do not commit, do not `git add`/
  stage, and do not edit `IMPROVE_LOOP.md` — just modify the working tree and report what
  changed.** A 1a commit or stage would bypass this cycle's scope check, secret scan, and
  exactly-one-commit discipline, and a stray staged file would ride along on the next
  commit. If the host agent can invoke other skills/tools for a named skill in the backlog
  item, it may do so when available; otherwise implement directly. Do not block the cycle
  on skill-tool availability.

  **Optional host split (e.g. Claude + codex-worker):** if the live model tier prefers a
  separate implementer and that implementer is available, 1a may stop short of writing code
  and return a scoped implementation specification: goal, exact file list, **Decision**,
  **Preserve**, acceptance criteria (item Acceptance + suite), and `Do not commit`.
  Otherwise 1a implements or investigates itself.

- **1b, conditional:** Only when 1a returned that scoped specification, dispatch the host
  implementer (e.g. `codex-worker` when present) without worktree isolation; this loop is
  single-threaded in the same tree. Give it the bounded brief: goal, exact file scope,
  constraints, **Decision**, **Preserve**, acceptance criteria, and
  `Do not commit; leave changes in the working tree.` It should report structured
  `done`/`partial`/`blocked`/`failed` status, git-verified changed files, what it
  verified, risks, and, when blocked with open questions, enough context to resume the
  same implementer thread rather than launching a fresh one. Clarify-and-resume stays
  inside this Phase 1 dispatch (cap ~two rounds), resolved before 1b reports back — never
  threaded across cycles via multi-entry diary (land notes in this cycle's ## Last cycle at Phase 2).
- **Scope check on 1b's report:** if the implementer reports any changed path outside the
  file scope declared in its brief, do not silently fold that path into this cycle's commit:
  carry in-memory and land in ## Last cycle Notes at Phase 2 (`scope violation: <path> was outside the declared file scope`) and set
  Outcome to `blocked`. Phase 4's code-dirty veto then refuses a ledger-only commit over the
  unresolved diff.

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

- **Lint (orchestrator-owned, before the suite).** Do **not** invent a second test command.
  After `CHANGED_PATHS` is known, run path-scoped linters via the plugin tool (discover +
  cache under `<repo>/.git/improve-runs/lint-map.json`):

  ```bash
  bash <plugin>/tools/improve-lint.sh run --repo <repo> --paths <CHANGED_PATHS…>
  # or: --paths-file <tmp list>
  ```

  | Case | `LINT_STATUS` | Next |
  |---|---|---|
  | `CHANGED_PATHS` empty | `skipped` (no paths) | proceed to suite |
  | No matching / available tools | `skipped` (no tools) | proceed to suite |
  | Tool(s) exit 0 | `PASS` | proceed to suite |
  | Any tool exit non-zero | `FAIL` | **fail-fast:** set `STATUS=FAIL`; do **not** run the suite this cycle; capture lint tail for signature |

  Discovery is dynamic (package.json `lint`, eslint config, ruff, biome, Makefile `lint`
  residual for source-ish paths only, shellcheck, clippy, go vet — only tools already on
  PATH / local `node_modules/.bin`). Bins are re-resolved every run (cache is fingerprint
  only; `--force-refresh` is for debug/corrupt cache, not required after `npm install`).
  Extensionless files match only via shebang. If eslint/biome is declared but the bin is
  missing, do **not** fall back to `make lint` (often soft-passes) — skip instead.
  Never `npm install` / brew install.
  Snapshot porcelain before/after the lint run and extend `TEST_ARTIFACT_PATHS` the same
  way as the suite (eslint caches, etc.).

  Record for Phase 2 Last cycle: `**Lint:** PASS \| FAIL \| skipped` and `**Lint tools:** … \| none`.

- Then the orchestrator (native) runs the recorded test command **exactly once** — even if
  the executor believes nothing changed — **unless** lint already set `STATUS=FAIL`
  (fail-fast: skip suite). Capture full output to a temp file; keep a tail
  (e.g. last 80 lines) for Last cycle Notes. From that authoritative run derive `STATUS`
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
