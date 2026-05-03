# Plan: Add File-Watch Mode to Sync Engine

## Context
`tools/sync-status.sh sync` is currently a one-shot operation — run it, it syncs, it exits.
Users working on extensions in the claude-craft repo want a watch mode that re-syncs
automatically when any source file changes, similar to `tsc --watch` for TypeScript.

**Project:** claude-craft (~/claude-craft)

## Approach
Add a `watch` action to `sync-status.sh`. The watcher uses `fswatch` (available via homebrew)
to monitor the repo's source directories. On each change event, it re-runs the `sync` action
with a 200ms debounce to coalesce rapid file edits (e.g., editor autosaves).

## Implementation Steps

### Phase 1: Dependency Check

**Pre-check:** None
**Outputs:** Updated `install.sh` with fswatch check, error message if absent

1. Add `fswatch` availability check to `install.sh`:
   - `command -v fswatch >/dev/null || { echo "Error: fswatch required. Install: brew install fswatch"; exit 1; }`
   - Run after existing dependency checks

2. Add fswatch to the README install prerequisites section

### Phase 2: Watch Action

**Pre-check:** fswatch available
**Outputs:** `watch` case in `sync-status.sh`, debounce logic

3. Add `watch` as a new action in the `case "$ACTION" in` block of `sync-status.sh`

4. Watch directories: `agents/ commands/ skills/ prompts/ references/ plugins/`

5. Implement debounce: on fswatch event, set a debounce flag; after 200ms with no new events,
   run `sync_extensions` and clear the flag. Use background process + temp file for the timer.

6. Print status line on each sync: `"[HH:MM:SS] Synced N extensions (M changed)"` —
   derive N and M from `sync_extensions` return values

7. Handle SIGINT gracefully: trap `INT TERM`, kill the fswatch process, print `"Watch stopped."`

8. Commit: `git add tools/sync-status.sh install.sh && git commit -m "feat: add watch mode to sync engine"`

### Phase 3: Testing

**Pre-check:** Watch action implemented
**Outputs:** Manual test checklist, updated docs

9. Add watch mode to the usage section of the README
10. Run `npm test` — confirm existing 33 sync tests still pass

## Git Strategy
- Branch: `feat/sync-watch-mode`
- Commit per phase, push to remote, create PR, squash merge to main

## Post-Implementation
1. `/review-suite:review-fix` — loop until clean
2. `npm test`
3. If tests fail → fix → re-run `/review-suite:review-fix` → re-run tests

## Verification
- Verify the watch mode works correctly in all scenarios
- Test all extensions are synced when files change
- Confirm no performance regressions compared to one-shot sync
- Make sure edge cases are handled properly
