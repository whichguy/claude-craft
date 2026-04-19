# Plan: Refactor Sync Engine to Support Remote Repos

## Context

The sync-status.sh engine currently only supports local symlinks. We want to add support for pulling extensions from remote git repositories, enabling team sharing of extensions.

## Approach

Extend `sync-status.sh` with a `--remote <git-url>` flag. When invoked, the script clones the remote repo to a **stable persistent directory** (`~/.claude/remotes/<slug>`) — NOT a temp dir — so that `ln -sfn` symlinks pointing into the clone remain valid after the script exits. On subsequent calls, run `git pull` in the persistent clone dir instead of re-cloning. The TYPES array in shared-types.sh gains an optional `remote_url` field (field 8). Existing local sync behavior is unchanged.

> **Architecture note:** Symlinks must point to persistent directories. Using a temp dir (mktemp -d) + trap cleanup would break all created symlinks the moment the script exits. The clone directory is therefore stored at `~/.claude/remotes/<slug>` and persists between invocations.

## Expected Outcome

After implementation, `./tools/sync-status.sh sync --remote https://github.com/org/extensions-repo.git` runs without error and produces symlinks in `~/.claude/` from the remote repo. Verification: `./tools/sync-status.sh status` reports the remote-sourced extensions as linked; `npm test` passes with no regressions; existing local `./tools/sync-status.sh sync` continues to work as before.

## Test Strategy

1. All 33+ existing sync tests in `test/sync.test.js` must pass after each phase
2. New tests required: --remote with valid URL (mock git clone), --remote with invalid URL (validation error), git clone failure, TYPES backward compatibility (existing entries with empty remote_url field)
3. Acceptance criteria: `./tools/sync-status.sh sync --remote <valid-test-url>` creates symlinks; `./tools/sync-status.sh sync` (local) still works unchanged

## Git Setup

- Create feature branch: `git checkout -b feature/remote-repo-sync`

## Pre-conditions

- Read `tools/sync-status.sh` and verify: `--remote` flag does not already exist; identify current `parse_args` structure and existing positional args (status|sync|add|publish)
- Read `tools/shared-types.sh` and confirm TYPES array format: current field count, field order (`name|emoji|subdir|repo|kind|pattern|skip`), and all positional access patterns
- Read `install.sh` and identify all calls to sync-status.sh to assess backward compatibility impact

## Phase 1: TYPES Array Schema Update

> Intent: Update the shared TYPES array schema to support an optional remote_url field. This is done first so subsequent phases can build against the updated schema.

1. Read `tools/shared-types.sh` — verify current TYPES format `"name|emoji|subdir|repo|kind|pattern|skip"` (7 fields) and all consumer access patterns (positional index reads in sync-status.sh and uninstall.sh)
2. Add `remote_url` as field 8 (last) to TYPES array in shared-types.sh — append to existing entries as empty string `""` for backward compatibility; update all positional access patterns in sync-status.sh and uninstall.sh
3. Verify: run `./tools/sync-status.sh status` and confirm existing local sync still works correctly
4. Commit: `git add tools/shared-types.sh tools/sync-status.sh tools/uninstall.sh && git commit -m "feat(types): add remote_url field to TYPES array"`

**Outputs:** `tools/shared-types.sh` with 8-field TYPES entries; all positional access patterns in sync-status.sh and uninstall.sh updated; `npm test` passing.

## Phase 2: --remote Flag Implementation

**Pre-check:** Phase 1 committed. Verify `./tools/sync-status.sh status` works and `npm test` passes (all 33+ tests green).

> Intent: Add the --remote flag to sync-status.sh enabling git URL input; clone the remote repo to a persistent directory (`~/.claude/remotes/<slug>`) and create symlinks from that persistent clone. The clone must persist because the created symlinks point into it.

5. Add `--remote <url>` argument parsing to sync-status.sh's `parse_args` function — validate URL format (must start with `https://` or `git@`; reject shell-injection characters)
6. Implement remote sync using a **persistent clone directory** — do NOT use `mktemp -d` or `trap` cleanup, as that would delete the directory the symlinks point into:
   - `REMOTE_CLONE_DIR="${HOME}/.claude/remotes/$(basename "$REMOTE_URL" .git)"`
   - If `$REMOTE_CLONE_DIR` does not exist: `mkdir -p "$(dirname "$REMOTE_CLONE_DIR")"` then `timeout 60 git clone --depth 1 "$REMOTE_URL" "$REMOTE_CLONE_DIR"`; on clone failure: remove partial clone (`rm -rf "$REMOTE_CLONE_DIR"`) and exit 1 with descriptive error
   - If `$REMOTE_CLONE_DIR` exists: `timeout 30 git -C "$REMOTE_CLONE_DIR" pull`; on timeout/failure: print warning and continue with existing clone (stale is better than broken symlinks)
   - Add LLM-navigable comments at: URL validation entry, clone-vs-pull decision branch, symlink creation call
7. Create symlinks from `$REMOTE_CLONE_DIR` extensions to `~/.claude/` using `ln -sfn` with `REPO_DIR="$REMOTE_CLONE_DIR"` — reuse existing symlink logic from the `sync` action
8. Verify backward compatibility: run `./tools/sync-status.sh sync` (without --remote) — confirm local sync still works
9. Commit: `git add tools/sync-status.sh && git commit -m "feat(sync): add --remote flag for remote git repo extension sync"`

**Outputs:** `tools/sync-status.sh` with `--remote` flag, `validate_remote_url()`, persistent clone logic; `npm test` passing.

## Phase 3: Testing

**Pre-check:** Phase 2 committed. `--remote` flag present in sync-status.sh. `npm test` passes (33+ tests).

> Intent: Validate the new feature against the existing test suite and add coverage for the --remote path to prevent regression.

10. Run `npm test` — verify all 33+ existing sync tests pass
11. Add tests to `test/sync.test.js` covering: valid remote URL (mock git clone), invalid URL format (validation error), git clone failure (network error), and backward compatibility (existing local sync unaffected)
12. Run `npm test` again — all tests must pass before continuing
13. Commit: `git add test/sync.test.js && git commit -m "test(sync): add --remote flag test coverage"`

## Phase 4: Deployment

> Intent: Merge changes to main via PR after all phases pass verification.

14. Push feature branch: `git push -u origin feature/remote-repo-sync`
15. Create PR: `gh pr create --base main --title "feat: add --remote flag to sync-status.sh for remote repo extension sync"`
16. Merge: `gh pr merge --squash --delete-branch`

## Standards Requirements

Shell scripting must follow CLAUDE.md directives: `set -eo pipefail`, `shopt -s nullglob`; git commands use `git -C "<dir>"` (never cd + git); symlinks use `ln -sfn`; trap used for error cleanup only (not for deleting persistent directories).

## Open Questions (Require Resolution Before Implementation)

- Authentication: Investigate SSH vs HTTPS authentication options; define chosen approach (e.g., assume SSH keys configured, or use HTTPS with token via git credential helper)
- Conflict resolution: Define policy — remote-wins / local-wins / error-out when remote extension conflicts with existing local extension
- install.sh impact: Read install.sh and confirm whether --remote flag integration is required (add as step if yes, explicitly exclude if no)

## Post-Implementation Workflow

1. `/review-fix --scope=branch` — loop until clean
2. Run build if applicable
3. Run tests: `npm test`
4. If build or tests fail: fix → re-run `/review-fix --scope=branch` → re-run build/tests — repeat
