# Plan: Add Structured Logging to Sync Engine

## Context
The current sync engine (`tools/sync-status.sh`) writes plain text to stdout with no consistent
format. When multiple operations run in sequence, output from different phases intermingles and
is hard to parse programmatically. We need structured log lines so downstream tooling (CI
pipelines, the auto-sync plugin) can machine-read sync events.

**Project:** claude-craft (~/claude-craft)

## Approach
Introduce a `src/logger.ts` module with a typed log formatter. The sync engine shell scripts will
call into this via a thin Node.js wrapper (`tools/log-bridge.js`). All structured log output uses
the formatter; human-readable output remains unchanged.

## Implementation Steps

### Phase 1: Logger Module

**Pre-check:** None
**Outputs:** `src/logger.ts`, `src/logger.test.ts`

1. Create `src/logger.ts` with a single exported function:
   ```typescript
   export function formatLogEntry(
     level: 'info' | 'warn' | 'error',
     message: string,
     context: Record<string, unknown>
   ): string
   ```
   Output format: `{"level":"info","message":"...","context":{...},"ts":1234567890}`

2. Add log level filtering: `LOG_LEVEL` env var (default `info`), numeric comparison
   (error=3, warn=2, info=1 — emit only if entry level >= configured threshold)

3. Write unit tests in `src/logger.test.ts`:
   - formatLogEntry with each level produces valid JSON
   - LOG_LEVEL filtering suppresses lower-priority entries
   - missing context fields produce empty object, not undefined

4. Commit: `git add src/logger.ts src/logger.test.ts && git commit -m "feat: add structured logger"`

### Phase 2: Log Bridge

**Pre-check:** Phase 1 logger tests pass
**Outputs:** `tools/log-bridge.js`, updated `tools/sync-status.sh`

5. Create `tools/log-bridge.js` — a minimal Node.js CLI that takes level, message, and context
   JSON as argv, calls `formatLogEntry`, and prints to stdout

6. In `tools/sync-status.sh`, add a `log_structured()` helper:
   ```bash
   log_structured() { node tools/log-bridge.js "$1" "$2" "$3"; }
   ```
   Call `log_structured info "sync:start" "{}"` at the start of each sync action.

7. For the conflict detection path, call the logger to record resolution events:
   `node tools/log-bridge.js warn "sync:conflict" "$(formatConflictContext "$name" "$source")"`
   where `formatConflictContext` is defined in Phase 1 — it takes the extension name (arg 1)
   and the winning source path (arg 2): `formatConflictContext(name, sourcePath)`

8. Commit: `git add tools/log-bridge.js tools/sync-status.sh && git commit -m "feat: add log bridge"`

### Phase 3: Integration

**Pre-check:** Phase 2 bridge callable from shell
**Outputs:** Updated CI config, integration tests

9. Add `npm run test:logger` to `package.json`
10. Run `npm test` — all tests pass including new logger tests
11. Commit: `git add package.json && git commit -m "feat: wire logger into test suite"`

## Git Strategy
- Branch: `feat/structured-logging`
- Commit per phase
- Push to remote, create PR, squash merge to main

## Post-Implementation
1. `/review-fix` — loop until clean
2. `npm run build`
3. `npm test`
4. If tests fail → fix → re-run `/review-fix` → re-run tests

## Verification
- `node tools/log-bridge.js info "test" '{}'` outputs valid JSON line
- `npm run test:logger` passes all 6 assertions
- Sync output includes structured lines when `LOG_LEVEL=info` is set
