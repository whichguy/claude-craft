# Graceful Sheet-Missing Handling

## Context

When the `_Tools` sheet doesn't exist, `DynamicToolLoader` falls back to a DriveApp
search (DYNAMIC_TOOLS_FILE_ID → "Claude Tools/tools.json"). This DriveApp search can
throw (quota, permissions, network) and is not confirmed to be wrapped in try/catch
inside DynamicToolLoader itself — only ToolRegistry has an outer catch. Additionally,
on every `exec_api` call UISupport re-initializes ToolRegistry, re-running this search
and adding ~1s overhead or a potential uncaught exception that kills the conversation.

The user reported: "execution exceptions out and doesn't continue the claudeconversation."

Goal: make ALL code paths that access sheets (or fall back to DriveApp when sheets are
missing) resilient — never fatal, always log and continue.

## Scope of Changes

### 1. `tools/DynamicToolLoader` (remote-only file)

`loadHandlers()` currently:
- If `_Tools` sheet missing → calls `this._loadFromDrive(options)`
- `_loadFromDrive()` makes DriveApp API calls that may throw

**Fix A — short-circuit when nothing configured**:
In `loadHandlers()`, after confirming the sheet is missing, check whether any DriveApp
source is configured (DYNAMIC_TOOLS_FILE_ID property set, or "Claude Tools" folder
previously found). If neither is configured, skip `_loadFromDrive` entirely and return
`[]` immediately. This avoids the ~1s DriveApp penalty on every exec_api call.

**Fix B — wrap `_loadFromDrive` call in try/catch**:
```javascript
try {
  const driveHandlers = this._loadFromDrive(options);
  // ...add handlers...
} catch (driveErr) {
  Logger.log('[DynamicToolLoader] DriveApp search failed: ' + driveErr.message + ' — continuing with 0 dynamic tools');
}
```
Return `[]` on any DriveApp exception so callers always get an array, never an exception.

### 2. `sheets-chat/SheetsKnowledgeProvider.gs` (local file, lines 95–96)

`appendKnowledge()` calls `ss.getSheetByName()` without an explicit `if (!ss)` guard
(though it IS inside try/catch). Add a defensive early return:

```javascript
const ss = SpreadsheetApp.getActiveSpreadsheet();
if (!ss) {
  Logger.log('[KNOWLEDGE] No active spreadsheet — cannot append knowledge');
  return { success: false, error: 'No active spreadsheet' };
}
```

Same pattern for `updateKnowledge()` (line 149) and `deleteKnowledge()` (line 232).

**Note**: `loadCustomSystemPrompt()` (line 50) and all UISupport sheet access already
handle null `ss` correctly (try/catch + explicit checks). No changes needed there.

## Critical Files

| File | Location | Change |
|------|----------|--------|
| `tools/DynamicToolLoader` | Remote only | Short-circuit + try/catch around DriveApp |
| `sheets-chat/SheetsKnowledgeProvider.gs` | Local + remote | Add `if (!ss)` guards in appendKnowledge, updateKnowledge, deleteKnowledge |

## Branch <!-- gas-plan -->

Branch: `fix/graceful-sheet-missing` off `feat/inline-suggested-actions`
Merge: PR back into `feat/inline-suggested-actions`
Rollback: `git revert` the merge commit + re-promote staging

## Implementation Steps

1. **Branch**: `git checkout -b fix/graceful-sheet-missing`
2. **Auth**: `mcp__gas__auth mode:status` — confirm session active
3. **Read DynamicToolLoader** (remote-only): `mcp__gas__cat` then verify content with `mcp__gas__exec` (cat can return stale local per MEMORY.md) <!-- gas-plan -->
4. **Edit DynamicToolLoader**: `mcp__gas__edit` (remote-only, acceptable) — apply Fix A + Fix B
5. **Exec verify DynamicToolLoader**: `mcp__gas__exec` — `require('tools/ToolRegistry')` — confirm no DriveApp search in logs <!-- gas-plan -->
6. **Edit SheetsKnowledgeProvider.gs locally** (file exists locally): Edit local file, then `rsync push` to remote per CLAUDE.md `MCP_GAS` workflow <!-- gas-plan -->
7. **Exec verify SheetsKnowledgeProvider**: `mcp__gas__exec` — call `require('sheets-chat/SheetsKnowledgeProvider').appendKnowledge({})` — confirm `{success:false}` not crash
8. **Commit**: `git add sheets-chat/SheetsKnowledgeProvider.gs && git commit`
9. **Re-promote staging**: `mcp__gas__deploy promote to:staging` — staging is currently deployed, redeploy to pick up fixes <!-- gas-plan -->
10. **End-to-end verify**: `mcp__gas__exec` targeting staging — `require('sheets-chat/UISupport').getConfig()` — confirm clean logs

## Verification

- Step 5: `exec` `require('tools/ToolRegistry')` — no DriveApp search, no exception
- Step 7: `exec` `appendKnowledge({})` — returns `{success:false}` not TypeError
- Step 10: `exec` targeting staging — `require('sheets-chat/UISupport').getConfig()` — clean logs
- Open staging sidebar → send a test message → conversation completes normally

## Testing <!-- gas-plan -->

SheetsKnowledgeProvider ss-null guard: add a lightweight exec-based smoke test in step 7 (call with no active spreadsheet context). No new test file needed — the exec call IS the regression test. DynamicToolLoader is remote-only with no local test infrastructure; exec verification in step 5 covers it.

---

## Separate TODO (not part of this plan)

**Switch API key to user property by default** — change the ConfigManager scope used
when saving API key in `saveConfig()` from current scope to `userProperties` scope so
it's per-user rather than shared across users on the same document.
(File: `chat-core/ChatService.gs:546-559`, line `config.setUser('API_KEY', apiKey)` —
verify whether `setUser` already uses user-scoped properties or document-scoped.)
