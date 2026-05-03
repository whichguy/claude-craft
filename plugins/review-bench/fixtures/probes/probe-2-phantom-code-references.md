# Plan: Refactor Sync Engine to Support Extension Priorities

## Context
When multiple sources provide the same extension (e.g., a team repo and the user's local repo both define an agent with the same name), the current sync engine uses last-write-wins semantics. This causes unpredictable behavior — whichever sync runs last overwrites the other. We need explicit priority resolution: local extensions always win over remote, and the user can configure per-source priority ordering.

**Project:** claude-craft (~/claude-craft)

## Approach
Extend the existing sync infrastructure with a priority layer. Each sync source gets a numeric priority (lower = higher precedence). When conflicts are detected, the higher-priority source's extension is symlinked and the conflict is logged. This preserves the current symlink-based architecture while adding deterministic resolution.

## Implementation Steps

### Phase 1: Priority Configuration

**Pre-check:** None
**Outputs:** Priority config schema, updated types

1. Add a `priorities` field to the sync configuration:
   - Format: `{ sources: [{ path: string, priority: number }] }`
   - Default: local repo = priority 0 (highest), remote repos = priority 10+
   - Store in `~/.claude/sync-config.json`

2. Update the type definitions to include priority metadata:
   - Add `priority` and `source` fields to the extension record
   - Update the handler to parse priority from config on startup

### Phase 2: Conflict Detection & Resolution

**Pre-check:** Phase 1 config schema available
**Outputs:** Updated sync engine, conflict log

3. Modify the sync engine to detect conflicts before creating symlinks:
   - Before linking, check if target already exists from a different source
   - Compare priorities: higher-priority source wins
   - Log conflicts to `~/.claude/sync-conflicts.log` with timestamp and resolution

4. Update the status action to show conflict information:
   - Display which source each extension came from
   - Show overridden extensions and their original source

5. Update the publish action to skip extensions that came from remote sources:
   - Only local-origin extensions are eligible for publish

### Phase 3: Testing & Git

**Pre-check:** Phase 2 complete
**Outputs:** Test files, updated docs

6. Write tests for priority resolution (same-name from two sources → higher priority wins, equal priority → local wins, missing config → defaults)

7. Write tests for conflict logging (conflict → log entry, no conflict → no log entry)

8. Update `tools/sync-status.sh` to call `resolveConflicts()` before creating each symlink — pass the type entry fields needed for conflict-aware linking

9. Build and verify: `npm test`

## Git Strategy
- Branch: `feat/sync-priorities`
- Commit per phase
- Push to remote, create PR, squash merge to main

## Post-Implementation
1. `/review-suite:review-fix` — loop until clean
2. `npm run build` (if applicable)
3. `npm test`
4. If tests fail → fix → re-run `/review-suite:review-fix` → re-run tests

## Verification
- All existing sync tests continue to pass
- New priority resolution tests pass
- Manual test: create conflicting extensions from two sources, verify priority wins
