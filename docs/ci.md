# CI

How claude-craft is checked, why it is built this way, and how to change it. Evidence behind
the decisions (run history, timings, experiments) is in [ci-journal.md](ci-journal.md).

## What runs where

| Layer | When | What | Blocks |
|---|---|---|---|
| `.githooks/pre-commit` | `git commit` | secret scan of the **staged** content; marketplace + namespacing lints when `plugins/` is staged | the commit (bypass: `--no-verify`) |
| `.githooks/pre-push` | `git push` of the checked-out branch | `tools/ci.sh pre-push`: static checks + only the test shards the diff touches | the push (bypass: `SKIP_PREPUSH=1`) |
| `ci.yml` | push to `main`, every PR, manual | workflow lint, static ×2 OS, tests ×3 legs, **CI gate** | merge, once `CI gate` is a required check |
| `scheduled.yml` | Mondays 05:23 UTC, manual | hermes drift (strict), canary on floating runner labels with freshly resolved deps | nothing; a red run is the alert |
| Dependabot | weekly | SHA-pinned actions, npm dev-dependencies (7-day cooldown) | nothing; opens PRs |

Hooks are not installed by `git clone`. Run `tools/install-hooks.sh` once per clone (it sets
`core.hooksPath` to the tracked `.githooks/`; `--status` shows what is active).

## One definition of "CI passes": `tools/ci.sh`

`ci.yml`, the pre-push hook and `npm run ci` all call this script, so the checks cannot drift
between laptop and runner. Every check runs to completion (one failure never hides another),
checks run concurrently, and each prints a table; on GitHub the table also lands in the job summary.

```
npm run ci                       static, then tests   (≈75 s on a laptop)
tools/ci.sh static               checks only          (≈17 s)
tools/ci.sh test                 test shards only
tools/ci.sh run secrets core     just these
tools/ci.sh pre-push --base REF  what the hook runs
```

| Static check | Guards against |
|---|---|
| `marketplace-lint`, `namespacing-lint`, `marketplace-smoke` | broken manifests/frontmatter/hooks paths, bare cross-bundle `/skill` refs, bundled-tool drift |
| `handler-sync` | a hermes-synced handler edited without updating `CANONICAL.sha256` |
| `hermes-drift` | our manifest no longer equal to hermes's (blocks only if the change touches the handlers; otherwise warns) |
| `plugin-versions` | `plugin.json` and `marketplace.json` versions out of lockstep |
| `version-bump` (advisory) | shipped plugin files changed but the version did not, so users never receive the fix |
| `improve-loop-contract` | improve-loop contract / package-parity regressions |
| `harness-smoke` | `score-run.sh` regressions (canned fixture) |
| `shellcheck` | syntax-level errors in shipped shell; warnings are counted, not blocking (35 pre-existing) |
| `python-syntax` | shipped Python using syntax newer than 3.9, which is what macOS still ships |
| `tracked-artifacts` | `.pyc`, `__pycache__`, `.nyc_output`, `node_modules`, `.DS_Store` committed |
| `secrets` | secret-like patterns in code files changed by this push/PR (`tools/scan-secrets.sh`) |

| Test shard | Contents | Why separate |
|---|---|---|
| `core` | mocha, everything except claudecraft, `--parallel` | |
| `claudecraft` | mocha `test/plugins/claudecraft` + `improve-lint.test.js` | one file (`improve-worktree`) is ~50 s of git-worktree work |
| `shell` | `improve-loop/tests/scripts.test.sh`, the two plan-gate `*.test.sh` suites | not mocha, so `npm test` never ran them |

The shards run concurrently inside **one** job per matrix leg: three jobs would each repeat checkout,
Node setup and install for no gain in wall time.

### Environment isolation (why results do not depend on whose machine it is)

`ci.sh` runs under a throwaway `HOME` with a fixed git identity and **ignores `CLAUDE_PLAN_*` and
`CODEX_*`** from the caller's shell, printing which it dropped. Two real leaks motivated this:
`CLAUDE_PLAN_WORKTREE_GATE=0` in a developer shell turned 14 gate tests red while CI stayed green,
and handler tests write under `~/.claude`.

## Design decisions

- **One required check, `CI gate`.** It `needs` every other job and runs `if: always()`, failing
  unless all succeeded. Branch protection requires only this name, so matrix legs can be added or
  renamed without editing the rule, and a skipped/cancelled job can't read as green.
  `test/marketplace/ci-workflows.test.js` fails if a job is added without being added to `needs`.
- **Concurrency never cancels `main`.** PR runs are superseded by newer pushes to the same PR;
  each push to `main` has its own group, so every commit gets a verdict. (The old group cancelled
  main runs: 4 of the last 100 main pushes never got one.)
- **Pinned runners gate; floating runners canary.** `ubuntu-latest` is migrating to Ubuntu 26.04
  between 2026-10-19 and 2026-11-19, so a floating label can change OS between two runs.
  Required legs use `ubuntu-24.04` / `macos-26`; `scheduled.yml` runs `ubuntu-latest`,
  `ubuntu-26.04` and `macos-latest` so drift is seen a week early without blocking anyone.
- **macOS and a Node floor are in the matrix.** The scripts here are bash/BSD-vs-GNU sensitive and the
  maintainer is on macOS; Node 22 is the oldest LTS (`engines`), 26 the newest. Node 20 is EOL.
- **Reproducible installs.** `package-lock.json` is tracked (it was git-ignored, which forced a
  floating `npm install`), CI uses `npm ci --ignore-scripts`, and a test fails if the lockfile and
  `package.json` disagree. The scheduled canary deliberately ignores the lockfile.
- **Supply chain.** Every action is pinned to a commit SHA with a `# vX.Y.Z` comment; tokens are
  read-only and scoped per job; checkouts don't persist credentials; Dependabot has a 7-day cooldown.
  `actionlint` and `zizmor` lint the workflows in CI. Two pins Dependabot cannot update, bump them
  by hand when you touch `ci.yml`: the **actionlint image digest** and the **zizmor `version`**.
- **Upstream movement must not redden unrelated work.** hermes owns the plan-review handlers. Their
  staleness check used to run on every push, so a hermes commit made every claude-craft push red.
  It now fails only when a change touches the handlers; the weekly run enforces it unconditionally.
- **Failures are loud.** A missing `shellcheck` fails on GitHub instead of silently skipping, an
  unreachable hermes fails the weekly run, and a failed job uploads its logs as an artifact.

## Maintaining it

- **Add a check:** write `check_<name>` (dashes become underscores) in `tools/ci.sh`, add it to
  `STATIC_CHECKS`, and add a behavioural test in `test/plugins/_repo/ci-tools.test.js`. Exit `77`
  means "not applicable here".
- **Add a test file:** anything under `test/**` is picked up. Test files **outside** `test/` are not;
  wire them into a shard in `tools/ci.sh` (that is how three suites went unrun).
- **Add a matrix leg:** edit `ci.yml`; the gate needs no change. Keep the label pinned.
- **Re-sync the hermes handlers:** follow
  [hermes `SYNC.md`](https://github.com/whichguy/hermes-skills-marketplace/blob/main/plugins/plan-review/handlers/SYNC.md).
  `plan-unknowns-gate.test.sh` and `plan-worktree-gate.test.sh` are upstream files; the env-scrub
  prologue added here should be upstreamed or the next copy will drop it (`ci.sh` scrubs regardless).
- **Rebuild the lockfile:** `npm install --package-lock-only --ignore-scripts`, commit it.

## Not done (needs a decision from the repo owner)

- **Branch protection / ruleset on `main`.** Nothing enforces CI today: 75 of the last 100 runs were
  direct pushes to `main`, and 52% of completed `main` runs were red. Requiring `CI gate` would stop
  that but also stops direct pushes (a PR becomes mandatory). A softer option is a ruleset with the
  owner as a bypass actor. Enable with `gh api -X PUT repos/whichguy/claude-craft/branches/main/protection`
  (required check `CI gate`) once the workflow has run on `main` at least once.
- **Repo settings:** Dependabot security updates are off, and "require actions pinned to a full commit SHA"
  (`sha_pinning_required`) is off. Both are one-click settings once the pins are in.
- **Shellcheck warnings:** 35 pre-existing warning-level findings in shipped scripts; only errors block.
