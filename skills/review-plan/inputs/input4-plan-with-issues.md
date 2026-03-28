# Plan: Refactor Sync Engine to Support Remote Repos

## Context
The sync-status.sh engine currently only supports local symlinks. We want to add support for pulling extensions from remote git repositories, enabling team sharing of extensions.

## Approach
Clone remote repos to a persistent local directory (not a temp dir) and symlink from there — consistent with the existing `ln -sfn` architecture. This preserves the instant-update/rollback properties of the symlink model while enabling remote sources. Authentication relies on the user's pre-configured git credentials (SSH agent or git credential.helper); token-in-URL is explicitly not supported to avoid credential exposure. Conflict resolution is out of scope for this plan; the `--remote` flag will fail fast if a remote-sourced extension conflicts with a locally-managed one.

## Expected Outcome
`sync-status.sh --remote <url>` clones the remote repo to `~/.claude/remote-repos/<repo-slug>/`, then symlinks its extensions into the appropriate `~/.claude/` subdirectories using the same `ln -sfn` logic as local sync. Existing local-symlink behavior is unaffected when `--remote` is absent. All existing `npm test` tests pass.

## Phase 1: Investigation
Establish what exists before making any changes.

1. Read `sync-status.sh` in full — note current flag parsing, existing `add`/`sync`/`status` functions, and all `cut -d'|'` field-index references to the TYPES array.2. Read `shared-types.sh` — record the current TYPES array format (`"name|emoji|subdir|repo|kind|pattern|skip"` — 7 fields, indices 1–7 in `cut -d'|'` 1-based).3. Read `uninstall.sh` — identify all locations that parse the TYPES array (field extractions, loop patterns).4. Read `install.sh` — determine whether it needs updating for the new remote_url field.5. Verify `git` is available in the target environment: `command -v git || { echo "git required"; exit 1; }`6. **Go/No-Go:** If any TYPES consumer uses hard-coded field counts incompatible with an 8-field extension, resolve before proceeding to Phase 2.
## Phase 2: Schema Extension
Add the `remote_url` field to TYPES and update all consumers before adding any new behavior.

1. In `shared-types.sh`, add `remote_url` as the 8th pipe-delimited field to the TYPES format comment and all existing entries (use empty string `""` for existing local-only entries to maintain backward compatibility).2. Update `sync-status.sh`: add handling for the new 8th field in all TYPES iteration loops; existing `cut -d'|' -f1` through `-f7` references are unaffected (field indices do not shift). Add a `remote_url` variable extracted via `-f8`.3. Update `uninstall.sh`: same field-extraction update for TYPES parsing.4. Update `install.sh` if investigation (Phase 1, Step 4) found TYPES parsing there.5. Run `npm test` — all existing tests must pass before proceeding.6. **Go/No-Go:** Confirm all consumers handle empty 8th field without error.7. **Rollback note:** If Phase 3 or Phase 4 fail after this phase is committed, revert with `git -C "$REPO" revert HEAD` to restore the 7-field TYPES schema before any push.
## Phase 3: Remote Fetch Implementation
Implement the `--remote` flag using the established symlink pattern.

1. In `sync-status.sh`, add `--remote <url>` flag parsing (using the existing flag-parsing pattern in the script).2. Implement the remote fetch function:   - Validate the URL: reject empty input, restrict to `https://`, `git://`, `ssh://` schemes
   - Determine repo slug from URL (last path component, strip `.git`)
   - Set persistent clone dir: `~/.claude/remote-repos/<repo-slug>/`
   - If clone dir exists: `git -C "$clone_dir" pull --ff-only` (update, no force-overwrite)
   - If clone dir absent: `git clone --depth=1 --template=/dev/null --no-local -- "$remote_url" "$clone_dir"`
   - Always shell-quote `$remote_url` and `$clone_dir` in all git invocations
   - Log progress to stdout: "Fetching from <url>…", "Installed from <url>" or error to stderr on failure
   - After cloning, validate that the repo contains at least one recognized extension subdirectory (`agents/`, `commands/`, `skills/`, `prompts/`, `references/`, or `plugins/`) — if none found, exit with: "Error: <url> does not appear to be a claude-craft extension repo (no recognized subdirectory found)"3. On successful clone/pull: call the existing `sync` function with `$clone_dir` as the source root — reuse existing symlink logic (`ln -sfn`) rather than reimplementing.4. Add failure recovery: trap ERR to log the error message and exit non-zero; no partial state is left behind.5. Run `npm test` — all tests must pass.6. **Go/No-Go:** Confirm existing local-symlink path (`sync-status.sh sync`) still works correctly with no `--remote` flag.
## Phase 4: Tests and Documentation
Add test coverage and update documentation before shipping.

1. Add a mocha/chai test fixture for the remote repo layout (a minimal directory structure matching the expected extension layout).2. Add tests for: `--remote` flag parsing, URL validation (valid schemes pass, invalid reject), clone-dir naming from URL slug, and that the existing local sync path is unaffected.3. Run `npm test` — full suite must pass.4. Update `CLAUDE.md`:   - TYPES array format description: add `remote_url` (field 8, optional)
   - Sync Architecture section: describe remote-repo support and `~/.claude/remote-repos/` directory
   - Script Inventory: update sync-status.sh description to include `--remote` flag
5. **Go/No-Go:** All tests green, documentation updated.
## Phase 5: Git Workflow
Ship on a feature branch following project conventions.

1. Create feature branch: `git -C "$REPO" checkout -b feature/remote-repo-sync`2. Stage and commit Phase 2 (schema changes) separately from Phase 3 (implementation):   - `git -C "$REPO" add shared-types.sh sync-status.sh uninstall.sh install.sh`
   - `git -C "$REPO" commit -m "feat: add remote_url field to TYPES array (8-field schema)"`
   - `git -C "$REPO" add sync-status.sh test/`
   - `git -C "$REPO" commit -m "feat: add --remote flag to sync-status.sh"`
3. Run `./tools/simple-secrets-scan.sh` — must pass before push.4. Push branch and open PR: `git -C "$REPO" push origin feature/remote-repo-sync` → open PR → merge to main after review.
## Verification
Pass conditions (all must be met):

1. `sync-status.sh --remote https://github.com/example/extensions.git` — extensions appear in `~/.claude/` as symlinks; no files are copied.2. `sync-status.sh sync` (no `--remote`) — existing local symlink behavior unchanged.3. `sync-status.sh --remote <invalid-scheme>` — exits non-zero with a clear error message.4. `npm test` — full suite passes with no regressions.5. Invalid/unreachable URL: exits non-zero, temp state cleaned up, no error left in `~/.claude/`.
## Post-Implementation Workflow
1. `/review-fix` — loop until clean2. Run build if applicable3. Run tests: `npm test`4. If build or tests fail: fix → re-run `/review-fix` → re-run build/tests — repeat