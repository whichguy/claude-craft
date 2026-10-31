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
| F2 | CI gates nothing. No branch protection, no rulesets, no required checks; 75 of 100 runs are direct pushes to `main`, 25 are PR runs. | firm | `gh api …/branches/main/protection` → 404, `…/rulesets` → `[]` |
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
| F20 | Shipped Python (10 files) parses under macOS's stock Python 3.9.6; shipped shell has 0 shellcheck errors (the 4 errors are in deliberately bad fixtures) and 35 warnings. | firm | `tools/ci.sh run python-syntax shellcheck` |
| F21 | **Superseded 2026-10-31:** "`verify-sync.sh` uses GNU-only `sha256sum`, so it breaks on stock macOS." Disproved: macOS 27 ships `/sbin/sha256sum`. Whether the `macos-26` runner has it is answered by the remote run (see Round 1 remote results). | superseded | `command -v sha256sum` under a stock PATH |

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

### Changes (what, why, effect)

1. **Repo hygiene** — track `package-lock.json`, untrack `.nyc_output/` and `.pyc`, ignore them, replace dead `test/mocha.opts` with `.mocharc.json` (F4, F8, F15).
2. **Test hermeticity** — `wiki-hooks` concurrency ids; `CLAUDE_PLAN_*` scrub in both plan-gate suites (F7, F9).
3. **`tools/ci.sh`** — one definition of CI for the workflow, the pre-push hook and `npm run ci`; checks and test shards run concurrently in a throwaway HOME (F1, F5, F6). New checks: lockfile/version lockstep, version-bump advisory, shellcheck (errors), Python 3.9 syntax floor, tracked-artifact guard, changed-file secret scan, hermes drift (path-aware).
4. **Secret gate fixed** — `tools/scan-secrets.sh` owns the code-vs-test policy and calls the engine in blocking mode; the hook scans the staged blobs (F3).
5. **Workflows rebuilt** — parallel jobs, OS × Node matrix with pinned runners, a single `CI gate`, SHA-pinned actions, per-job least privilege, non-cancelling `main`, `npm ci`, artifacts on failure, workflow lint (actionlint + zizmor), weekly scheduled drift/canary, on-demand flake hunt, Dependabot with cooldown (F2 partly, F10–F14, F16).
6. **Policy as tests** — `test/marketplace/ci-workflows.test.js` and `test/plugins/_repo/ci-tools.test.js` (30 + 22 tests) so these decisions fail loudly if reverted.

### Not changed (needs the repo owner)

Branch protection / ruleset on `main` (F2), Dependabot security updates, "require actions pinned to a SHA",
the 35 shellcheck warnings, and upstreaming the env-scrub to hermes's copies of the two plan-gate suites.
