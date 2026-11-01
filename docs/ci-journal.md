# CI journal

Living record of what was investigated, changed, and believed about this repo's CI. Design and
how-to live in [ci.md](ci.md). Edit entries rather than deleting them: mark a claim *superseded*
with the date and reason. Evidence is in [ci-evidence/](ci-evidence/) (exported, compact).

Status vocabulary: **firm** (reproduced / measured, would repeat), **interim** (measured once or on
one platform), **exploratory** (hypothesis), **superseded** (kept for history).

## Round 1 — 2026-10-31 — full audit of local + remote CI, then rebuild

Method: read `.github/`, `.githooks/`, `tools/`, `package.json` at **`origin/main` 88fad7d**
(the maintainer's checkout was 112 commits behind; the first read of `ci.yml` came from that stale
copy and was redone). Pulled the last 100 Actions runs and the logs of 31 failures with step data,
queried repo/Actions/branch-protection settings, reproduced every CI step locally in a clean
environment, then changed things and re-measured. Local machine: macOS 27, Node 26.12.1, bash 3.2.57,
18 cores, `env -i`-style clean HOME unless stated.

### Findings

| ID | Finding | Status | Evidence |
|---|---|---|---|
| F1 | `main` is red more than green: of 75 `main` pushes, 37 failed, 34 passed, 4 were cancelled (52% of decided runs red; 9 consecutive reds 07-18 → 07-20). Where step data survives (31 of 49 failures) it is Mocha 23, improve-loop shell suite 5, smoke 2, hermes staleness 1. The ones inspected were real regressions pushed without running the checks (cross-reference lint, `contract-check`, a handler missing its exec bit). | firm (rates) / interim (18 failures have no retained step data) | `ci-evidence/run-history-2026-10-31.tsv` |
| F2 | CI gates nothing. No branch protection, no rulesets, no required checks; of the last 100 runs 72 are direct commits to `main`, 3 are PR merges and 25 are PR runs. | firm | `gh api …/branches/main/protection` → 404, `…/rulesets` → `[]` |
| F3 | The pre-commit secret scan could never block. The hook calls `simple-secrets-scan.sh <file> false`, which the script defines as "report-only, always exit 0", so "COMMIT BLOCKED" was unreachable while the hook printed "passed". Enabling it costs nothing: a strict scan of every tracked file flags only 2 files, both fake keys under `test/`. | firm | `ci-evidence/static-analysis-baseline-2026-10-31.txt`; mutation test E8 |
| F4 | `package-lock.json` has been git-ignored since 2025-09-02 (d6089c0), so CI had to run floating `npm install`. | firm | `.gitignore`, `git log -S` |
| F5 | The improve-loop mocha suite ran twice per CI run (`npm test` globs `test/**`, which contains `test/plugins/claudecraft`, then `npm run test:improve-loop` ran it again): ~40 of 163 s. | firm | `ci-evidence/baseline-timing-2026-10-31.txt` |
| F6 | Three suites were never run by anything: `plugins/claudecraft/tools/improve-lint.test.js` and the two `plan-*-gate.test.sh`. | firm | grep for references (none) |
| F7 | `plan-worktree-gate.test.sh`: 14 of 26 cases fail when `CLAUDE_PLAN_WORKTREE_GATE=0` is exported (the maintainer's shell has it) and pass in a clean env. A hermeticity bug in the test, not drift in the gate. | firm | E5 |
| F8 | `test/mocha.opts` is dead config: mocha ≥ 8 ignores it (this repo is on 10.8.2), so its `--timeout 10000` and `--exit` never applied. | firm | mocha changelog; `.mocharc.json` now carries them |
| F9 | `wiki-hooks › wiki-stop.sh concurrency` is a race. Both session ids shared their first 8 characters, the hook's dedup key, so the test passed only if both processes got past the dedup `grep` together. 2/20 failures under CPU load before the fix, 0/40 after. | firm | `ci-evidence/flake-and-stress-2026-10-31.txt` |
| F10 | The old concurrency group cancelled in-progress runs on `main`: 4 of 75 main pushes never got a verdict. | firm | run history |
| F11 | `harness-smoke` had `if: … \|\| true` (a no-op gate whose comment claimed filtering); `harness-real` only echoed text while its dispatch input claimed it "costs $$$". | firm | old `ci.yml` |
| F12 | The CI failure message pointed at `plugins/planning-suite/handlers/SYNC.md`, which does not exist; the procedure lives in hermes. | firm | `git ls-files`; hermes contents API |
| F13 | The hermes staleness check made every push depend on another repo's `main`. It has failed CI once (2026-07-27). hermes's documented intent is that claude-craft CI fails on divergence, so the fix keeps blocking where drift can be introduced (changes touching the handlers) and moves the rest to a weekly strict run. | firm | hermes `SYNC.md` |
| F14 | Node 20 actions are deprecated ("forced to Node 24") and Node 20 is EOL; `ubuntu-latest` is migrating to Ubuntu 26.04 between 2026-10-19 and 2026-11-19, so a floating label can change OS between two runs. | firm | run annotations; runner-images issue 14748 |
| F15 | Generated files were tracked: 3 `.nyc_output/*` and 6 compiled `.pyc` under test fixtures. | firm | `git ls-files` |
| F16 | zizmor (auditor persona) on the old workflow: 11 findings (5 high: unpinned actions; 3 medium: `persist-credentials`; 3 info). actionlint: clean. | firm | `ci-evidence/static-analysis-baseline-2026-10-31.txt` |
| F17 | Test time is concentrated: 3 files are 84 of 90 test-seconds (`improve-worktree` 50 s, `security` 21 s, `wiki-hooks` 13 s). | interim (one machine) | `ci-evidence/test-timing-2026-10-31.tsv` |
| F18 | `mocha --parallel` is safe here: identical 627 passing / 24 pending in two runs, 43–68 s vs 81–93 s serial. | interim (macOS only until the remote matrix reports) | E4 |
| F19 | My first `ci.sh` env-scrub used `sed '\|'` alternation, which BSD sed (macOS) does not support, making it a silent no-op on exactly the machine that needed it. Caught by a test; replaced with `compgen -e \| grep -E`. | firm | `ci-tools.test.js` |
| F20 | Shipped Python (10 files) parses under macOS's stock Python 3.9.6; shipped shell has 0 shellcheck errors (the 4 errors are in deliberately bad fixtures) and 35 warnings. | firm | real `/usr/bin/python3` 3.9.6 parsed all 10 files with 0 failures; `tools/ci.sh run python-syntax shellcheck`. Note `ast` `feature_version` alone is best-effort (F27) |
| F22 | `plan_slug()` (Python, per character) and a shell `tr -c … \| cut` slug disagree for non-ASCII plan names wherever `tr` is byte-oriented: GNU `tr` (Linux, in every locale, verified on coreutils 9.7) and BSD `tr` in the C locale. `plan-unknowns-gate.test.sh › slug-unicode` assumed otherwise, passed only on macOS under a UTF-8 locale, and failed both Linux legs the moment CI ran it. The test now skips that case visibly; the gap is real but low severity (Claude Code generates ASCII plan names) and the Python is hermes-owned. | firm (cause) / exploratory (production impact) | first PR run; Debian container check |
| F23 | Wiring orphaned suites into CI is how latent platform assumptions surface; the first remote run found F22 in minutes. A Linux userland is the missing local check for a macOS maintainer: `docker run debian:stable-slim` reproduced it in seconds. | firm | first PR run |
| F24 | Five `npm run test:*` scripts pointed at test directories that do not exist (`gas-suite`, `slides-suite`, `comms`, `form990`, `plan-red-team`) and fail with "No test files found", implying coverage those bundles do not have. Not used by CI. Removed, and a test now fails if a `test:*` script matches no tests. | firm | `mocha --dry-run` per script |
| F25 | **Found by the independent review, reproduced, fixed.** git exports `GIT_DIR=<repo>/.git/worktrees/<name>` to hooks run from a *linked worktree* (not from the main checkout). The pre-push hook passed it on to `ci.sh`, so any test that builds a throwaway repo (`git init && git commit`) wrote into the developer's real repository: the pushed branch gained a `FIXTURE-FROM-TEST <ci>` commit and the worktree was rewritten (the reviewer also saw the shared `.git/config` mis-authored by a test). It would have bitten on the first push after `tools/install-hooks.sh` from any worktree. Fix: the hook and `ci.sh` both strip `git rev-parse --local-env-vars`, and the hook tests a clean checkout of the pushed commit. | firm | E14; `pre-push-hook.test.js` (without the strip, 2 tests fail) |
| F26 | An exit code is not a safe skip signal. `ci.sh` treated exit 77 as SKIP, but mocha exits with its failure count, so exactly 77 failing core tests read as `SKIP` and the run passed. Skips are now a marker file (`ci_skip`), never an exit code. | firm | `ci-tools.test.js` (fake `npm` exiting 77) |
| F27 | `ast.parse(feature_version=(3, 9))` on a newer interpreter is best-effort: it accepts PEP 701 nested same-quote f-strings and parenthesised `with`, which stock macOS Python 3.9.6 rejects at import time (a hook that fails on every call for those users). `python-syntax` now prefers a real 3.9 (macOS legs, and any machine with one) and says which mode it used. | firm | `ci-tools.test.js` (runs only where a real 3.9 exists) |
| F28 | The pre-push hook was weaker than its comment claimed: shard selection ignored deletions and the *source* of a rename, `.mocharc.json` and other shared files selected only `core`, it tested the working tree (dirty edits could fail an unrelated push, and a forgotten `git add` passed locally then failed in CI), it did not even warn about untracked files, and with no `node_modules` it skipped the static checks too. Now: a clean checkout of the pushed commit, selection counts deletions/rename sources/shared infrastructure, static checks always run, and the comment says it is a heuristic. | firm | `pre-push-hook.test.js`, `ci-tools.test.js` (pre-push phase) |
| F29 | Four more holes in the secret gate, now that it blocks: type changes (`T`: a symlink replaced by a file holding a key) were skipped by both the hook and CI; CI scanned only the *net* diff, so a key committed and removed in the next commit passed while sitting in the pushed history (the README overclaimed `--no-verify` was "still caught"); 251 of 332 shipped non-test plugin files are skill/agent/command markdown and only warned; and the engine's `AIza[0-9A-Za-z\-_]` is the range `\`..`_`, which excludes `-`, so Google keys containing a hyphen were missed (pre-existing). All fixed; the repo-wide scan still has 0 blocking hits. GitHub secret scanning + push protection remain the server-side backstop for provider tokens. | firm | `ci-tools.test.js`; `scan-secrets.sh` over all 1141 tracked files |
| F30 | Lower-severity findings, all fixed: an unresolvable `CI_BASE` silently became "the last commit" (now fails closed: scans everything, strict hermes drift); the log directory was a fixed shared path, so two runs in one checkout could overwrite each other's results (each run now has a private directory, copied to `test-results/ci` at exit); no `--forbid-only` (a stray `it.only` skips other files and exits 0); an exported `CI_SHARDS` silently overrode shard selection (now announced); tests that pass when the code is broken (the gate's `jq` was never executed, the concurrency check accepted an inverted condition, the shard partition was a substring check, the injection regex stopped at the first `}`); docs that overclaimed. | firm | mutation checks, E15 |
| F21 | **Superseded 2026-10-31 (resolved):** "`verify-sync.sh` uses GNU-only `sha256sum`, so it breaks on stock macOS." Disproved twice: macOS 27 ships `/sbin/sha256sum`, and `handler-sync` PASSES on the `macos-26-arm64` GitHub runner. No portability shim was added. | superseded | PR run 1, job `Static (macos-26)` |

### Experiments

| ID | Question | Conditions | Result |
|---|---|---|---|
| E1 | Does the current CI pass, and how long does each step take? | all 8 old steps, `origin/main`, macOS 27 / Node 26, clean HOME | all pass; ≈187 s serial (`npm test` 81 s, shell suite 34 s, improve mocha 39 s, lints 29 s) |
| E2 | Why do runs fail? | logs of 31 failed runs with step data | see F1; the first log parse over-matched passing test names and was discarded |
| E3 | Where does test time go? | mocha `--reporter json`, clean env | F17 |
| E4 | Can mocha run files in parallel? | `--parallel --jobs 4`, two runs | F18 |
| E5 | Do the orphan suites pass? | clean `env -i` vs a shell with `CLAUDE_PLAN_WORKTREE_GATE=0` | `improve-lint` pass, `plan-unknowns-gate` pass, `plan-worktree-gate` ALL PASS clean / 14 FAIL polluted (F7) |
| E6 | Is the wiki-stop test a race? | 18 busy-loop burners, N repeats of that one test | 2/20 fail before the fix, 0/40 after (F9) |
| E7 | Are the new checks live? | mutation tests (below) | live |
| E8 | Would the new tests have caught the old behaviour? | old `pre-commit` swapped back in; old `ci.yml` swapped back in | old hook: the two blocking tests fail (secret committed). Old `ci.yml`: 8 of 22 policy tests fail |
| E9 | Is the rebuilt pipeline stable? | `tools/ci.sh all` ×5 back-to-back, bash 3.2 | 5/5 pass; 56–70 s (one 103 s run overlapped other work) vs ≈187 s serial before |
| E10 | Does it work on GitHub's runners? | PR #241, `pull_request` runs of the rebuilt `ci.yml` | run 1 (`aa21f29`): 5 of 7 jobs green, **both Linux test legs red** on `slug-unicode` (F22), 92 s wall. Run 2 (`1b94035`, after the fix): 8/8 green, 160 s wall, macOS test leg 151 s. Run 3 (`6d95cb6`, macOS shards split): 8/8 green, 98 s wall; slowest leg macOS `claudecraft` at 90 s; Linux legs 40-64 s. Runs 4-5 (`73ffecf`, `f2a1e75`, after the review round): **8/8 green both**; run 5 took **80 s** wall |
| E11 | Does `scheduled.yml` work? Cron and `workflow_dispatch` only run from the default branch, so: a throwaway branch with a temporary `push` trigger (deleted afterwards) | 2 runs | run 1: hermes drift ✓, macOS canary ✓, both Linux canaries and the flake hunt ✗ on the same F22. Run 2 (fix cherry-picked): **all ✓** — canaries on `ubuntu-latest` (resolved to **ubuntu-26.04**), `ubuntu-26.04`, `macos-latest` (macos-26-arm64) with the lockfile ignored and Node 26; flake hunt "0 of 2 runs failed" |
| E12 | Are runner tools what I assumed? | image inventories + the jobs themselves | ShellCheck: in the Ubuntu toolset, **absent on macOS** → `CI_SKIP` on macOS legs. `sha256sum`: present on macos-26 (F21). Bash 3.2.57, Python 3.15, jq 1.8 on macos-26 |
| E13 | What did I miss? | fresh read-only Opus subagent, no sight of my reasoning, told to hunt false greens first; 96 tool calls, ~23 min | 1 HIGH, 4 MED, ~8 LOW, plus a "checked and sound" list (action SHAs, gate semantics, workflow security, bash 3.2, evidence). Every finding was reproduced or re-derived before acting (F25-F30) |
| E14 | Is F25 real? | (a) my own minimal probe: no `GIT_DIR` seen (a quoting bug in the probe: an empty `$T` inside a quoted heredoc); (b) the reviewer's script re-run unchanged against my HEAD; (c) a clean probe printing the variables at hook entry | (b) reproduced the damage (`FIXTURE-FROM-TEST <ci>` on the pushed branch, worktree rewritten); (c) `GIT_DIR=<repo>/.git/worktrees/<name>` at hook entry from a linked worktree, unset from the main checkout. Lesson: a probe that finds nothing needs its own check |
| E15 | Do the new tests bite? | mutation: old `ci.sh` swapped in; hook's `unset` removed; workflow `all`→`any`, inverted cancel condition, dropped `--ignore`, a `}` inside an injected expression | old `ci.sh` fails 11 of the new/changed `ci-tools` tests; the hook without `unset` fails both `git environment` tests (including "a FIXTURE commit landed on the branch"); each workflow mutation fails exactly the intended policy test |

### Timing (GitHub-hosted, wall clock from run creation)

| | Jobs | Wall | Slowest job |
|---|---|---|---|
| Before: `lint-and-test` (`88fad7d`, run 36266011182) | 1 serial job, Linux only | 167 s | 163 s |
| After, run 3 (`6d95cb6`, run 41246528478) | 7 jobs on Linux **and** macOS, plus the gate | 98 s | 90 s (macOS `claudecraft` shard) |
| After, final (`f2a1e75`, run 41248909521, after the review round) | 7 jobs + gate | **80 s** | 72 s (macOS `core`+`shell` leg); Linux legs 60-66 s |
| After, Linux legs only | | ≈ 40-66 s | |

Run 2 shows the cost of leaving three shards on a 3-core macOS VM (151 s for that leg), which is why
`claudecraft` has its own macOS leg. macOS runner speed varies run to run (the same leg took 81 s and 151 s).

### Independent review: disposition of every finding

| Severity | Finding | Disposition |
|---|---|---|
| HIGH | pre-push from a linked worktree leaks `GIT_DIR`; tests write into the real repo | **fixed** (F25) |
| MED | exit 77 from a real tool read as SKIP | **fixed** (F26) |
| MED | `feature_version` does not enforce the Python 3.9 floor | **fixed** where a real 3.9 exists (macOS legs); best-effort elsewhere, stated in the output (F27) |
| MED | pre-push: deletions/rename sources, shared files, dirty tree, untracked files, no `node_modules` | **fixed**; still a heuristic, CI is the authority (F28) |
| MED/LOW | secret gate: `T`, history, plugin markdown, `AIza` regex | **fixed** (F29); generic `api_key=`/bearer/JWT patterns remain regex-based, GitHub push protection is the backstop |
| LOW | fail-open base, shared output dir, `--forbid-only`, `CI_SHARDS` silent | **fixed** (F30) |
| LOW | tests that pass when the code is broken | **fixed**, each mutation-checked (F30, E15) |
| LOW | docs overclaims ("one failure never hides another", "hooks catch most red pushes", isolation) | **corrected** in `ci.md` and the README |
| LOW | the macOS canary repeats the gating leg | **kept, comment corrected**: `macos-latest` is `macos-26` today, so it adds fresh dependencies until the label moves |

### Changes (what, why, effect)

1. **Repo hygiene** — track `package-lock.json`, untrack `.nyc_output/` and `.pyc`, ignore them, replace dead `test/mocha.opts` with `.mocharc.json` (F4, F8, F15).
2. **Test hermeticity** — `wiki-hooks` concurrency ids; `CLAUDE_PLAN_*` scrub in both plan-gate suites (F7, F9).
3. **`tools/ci.sh`** — one definition of CI for the workflow, the pre-push hook and `npm run ci`; checks and test shards run concurrently in a throwaway HOME (F1, F5, F6). New checks: lockfile/version lockstep, version-bump advisory, shellcheck (errors), Python 3.9 syntax floor, tracked-artifact guard, changed-file secret scan, hermes drift (path-aware).
4. **Secret gate fixed** — `tools/scan-secrets.sh` owns the code-vs-test policy and calls the engine in blocking mode; the hook scans the staged blobs (F3).
5. **Workflows rebuilt** — parallel jobs, OS × Node matrix with pinned runners (macOS shards split across two VMs after run 2), a single `CI gate`, SHA-pinned actions, per-job least privilege, non-cancelling `main`, `npm ci`, artifacts on failure, workflow lint (actionlint + zizmor), weekly scheduled drift/canary, on-demand flake hunt, Dependabot with cooldown (F2 partly, F10–F14, F16).
6. **Policy as tests** — `test/marketplace/ci-workflows.test.js` (27), `test/plugins/_repo/ci-tools.test.js` (49) and `test/plugins/_repo/pre-push-hook.test.js` (14, against a real bare remote) so these decisions fail loudly if reverted.
7. **Review round** — F25-F30: git-environment isolation, clean-checkout pre-push, skip markers, real Python 3.9, per-commit secret scan, fail-closed base, per-run output dir, `--forbid-only`, stronger policy tests.

### Not changed (needs the repo owner)

Branch protection / ruleset on `main` (F2), Dependabot security updates, "require actions pinned to a SHA",
the 35 shellcheck warnings, and upstreaming the env-scrub to hermes's copies of the two plan-gate suites.
