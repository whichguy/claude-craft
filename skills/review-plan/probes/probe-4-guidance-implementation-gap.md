# Plan: Add Incremental Sync to Claude Craft

## Context
The current `sync-status.sh sync` action performs a full scan every time — it walks all extension types, checks every file, and recreates symlinks even when nothing has changed. For large extension sets (30+ items across 6 types), this takes noticeable time. We need incremental sync that only processes changed extensions.

**Project:** claude-craft (~/claude-craft)

## Design
The incremental sync engine maintains a manifest file (`~/.claude/.sync-manifest.json`) recording each extension's path, content hash, and last-sync timestamp. On each run, the engine computes current hashes and compares against the manifest. Only changed, added, or removed extensions are processed. The engine validates checksums before overwriting any existing symlinks, ensuring data integrity during incremental updates.

## Implementation Steps

### Phase 1: Manifest Management

> Intent: Build the manifest infrastructure that tracks sync state.

**Pre-check:** None
**Outputs:** Manifest read/write functions in `sync-status.sh`, manifest JSON schema

1. Add manifest functions to `tools/sync-status.sh`:
   - `manifest_read()` — load `~/.claude/.sync-manifest.json` or return empty object
   - `manifest_write(data)` — atomically write manifest (write to temp, then move)
   - `manifest_entry(name, type, hash, timestamp)` — create/update single entry

2. Add hash computation:
   - File-type: `sha256sum` of file contents
   - Dir-type: combined hash of all files in directory (sorted, concatenated)

3. Verify and commit: `git add tools/sync-status.sh && git commit -m "feat: add sync manifest"`

### Phase 2: Incremental Diff Engine

> Intent: Compare current state against manifest to produce a minimal changeset.

**Pre-check:** Phase 1 manifest functions available
**Outputs:** Diff computation in `sync-status.sh`, change classifications

4. Add diff computation to the `sync` action:
   - For each extension: compute hash, compare to manifest
   - Classify: `added`, `modified`, `removed`, `unchanged`
   - Only process `added`/`modified`; for `removed`: delete symlink and manifest entry

5. Add `--full` flag to force complete sync (bypass incremental, rebuild manifest)

6. Verify and commit: `git add tools/sync-status.sh && git commit -m "feat: add incremental diff"`

### Phase 3: Safety & Recovery

> Intent: Handle edge cases and ensure the incremental path is always safe.

**Pre-check:** Phase 2 incremental sync working
**Outputs:** Error handling, fallback logic

7. Add manifest corruption recovery (malformed JSON → fall back to full sync)
8. Add dry-run support: `sync-status.sh sync --dry-run`
9. Check target path before creating symlink (not a symlink → warn/skip; wrong target → update)
10. Run `npm test` and commit: `git add tools/sync-status.sh && git commit -m "feat: add sync safety"`

## Git Strategy
- Branch: `feat/incremental-sync`
- Commit per phase, push to remote, create PR, squash merge to main

## Post-Implementation
1. `/review-fix` — loop until clean
2. `npm test`
3. If tests fail → fix → re-run `/review-fix` → re-run tests

## Verification
- Run `./tools/sync-status.sh sync --dry-run` — output shows only changed extensions
- Run `cat ~/.claude/.sync-manifest.json | jq '.extensions | length'` — count matches expected
- Time comparison: `time sync-status.sh sync` on unchanged state should complete in <1s
