# Plan: Add Null-Guard Resilience to DriveApp API Calls

## Context

`DynamicToolLoader.loadHandlers()` falls back to DriveApp when the `_Tools` sheet is missing.
That DriveApp path throws on quota, permissions, or network errors — only `ToolRegistry` has an
outer catch, not `DynamicToolLoader` itself. On every `exec_api` call, `UISupport` re-initializes
`ToolRegistry`, re-running the DriveApp search and adding ~1s overhead or a potential uncaught
exception that kills the conversation.

Additionally, `SheetsKnowledgeProvider.appendKnowledge()` calls `ss.getSheetByName()` without an
explicit `if (!ss)` guard. A transient null spreadsheet reference (e.g., called from a trigger
outside spreadsheet context) would propagate as a TypeError rather than a controlled error.

Goal: make all DriveApp-backed code paths resilient — never fatal, always log and return a safe
empty result. Add explicit null guards to the three Knowledge write methods so they degrade
gracefully instead of crashing.

## Implementation Steps

### Phase 1: DynamicToolLoader Short-Circuit + Catch

1. `mcp__gas__auth mode:status` — confirm GAS session active
2. Read `tools/DynamicToolLoader` via `mcp__gas__cat file:tools/DynamicToolLoader` — verify
   `loadHandlers()` exists and calls `this._loadFromDrive(options)` without a surrounding
   try/catch at line ~87; confirm no short-circuit exists for unconfigured DriveApp sources
3. Exec verify current behavior: `mcp__gas__exec` → `require('tools/ToolRegistry')` with
   `_Tools` sheet absent — observe whether DriveApp search fires in logs
4. Edit `tools/DynamicToolLoader` via `mcp__gas__edit`:
   - Fix A: in `loadHandlers()`, after confirming `_Tools` sheet is missing, check whether
     `DYNAMIC_TOOLS_FILE_ID` property is set or "Claude Tools" folder was previously found;
     if neither is configured, return `[]` immediately to skip the ~1s DriveApp penalty
   - Fix B: wrap `this._loadFromDrive(options)` call in `try/catch`; on any DriveApp exception,
     log `[DynamicToolLoader] DriveApp search failed: <msg> — continuing with 0 dynamic tools`
     and return `[]`
5. Exec verify: `mcp__gas__exec` → `require('tools/ToolRegistry')` — confirm no DriveApp search
   in logs, no exception thrown
6. Commit: `git add && git commit -m "fix(tools): short-circuit DriveApp when unconfigured + catch DriveApp errors"`

**Outputs:** patched `tools/DynamicToolLoader` with short-circuit + try/catch

### Phase 2: SheetsKnowledgeProvider Null Guards

These three Knowledge write methods already have outer try/catch; the null guard makes the
contract explicit and prevents `TypeError: Cannot read property 'getSheetByName' of null` from
appearing in production logs when called outside a spreadsheet context (e.g., from a time-based
trigger). Phase 1 must commit first so the two changes have separate, attributable git history.

**Pre-check:** Phase 1 commit exists; `require('tools/ToolRegistry')` exec passes cleanly

7. Read local `sheets-chat/SheetsKnowledgeProvider.gs` — verify `appendKnowledge()` at line ~95
   calls `SpreadsheetApp.getActiveSpreadsheet()` and then passes `ss` to `ss.getSheetByName()`
   without an explicit null check on `ss`
8. Verify same pattern in `updateKnowledge()` (~line 149) and `deleteKnowledge()` (~line 232)
9. Edit local `sheets-chat/SheetsKnowledgeProvider.gs`:
   - After `const ss = SpreadsheetApp.getActiveSpreadsheet();` in `appendKnowledge()`:
     add `if (!ss) { Logger.log('[KNOWLEDGE] No active spreadsheet — cannot append'); return { success: false, error: 'No active spreadsheet' }; }`
   - Same pattern for `updateKnowledge()` and `deleteKnowledge()`
10. Push to remote: `mcp__gas__rsync push file:sheets-chat/SheetsKnowledgeProvider.gs`
11. Exec verify: `mcp__gas__exec` → call
    `require('sheets-chat/SheetsKnowledgeProvider').appendKnowledge({})` — confirm returns
    `{ success: false, error: 'No active spreadsheet' }` not TypeError
12. Commit: `git add sheets-chat/SheetsKnowledgeProvider.gs && git commit -m "fix(knowledge): add null spreadsheet guard to Knowledge write methods"`

## Verification

- Step 5: `require('tools/ToolRegistry')` exec — no DriveApp search logged, no exception
- Step 11: `appendKnowledge({})` exec — returns `{ success: false }` not TypeError
- Open staging sidebar → send a test message → conversation completes normally
- No regression in `ToolRegistry` initialization time (DriveApp search no longer fires)
