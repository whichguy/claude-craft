# Context: GAS .gs file — exercises gas-code-review routing path

File: `src/gas/sheetSync.gs`

```javascript
// @require require.gs
var SheetSync = (function() {
  function syncSheet(spreadsheetId, sheetName, data) {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    var range = sheet.getRange(1, 1, data.length, data[0].length);
    range.setValues(data);
    return { success: true, rows: data.length };
  }

  function readSheet(spreadsheetId, sheetName) {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'Sheet not found' };
    var data = sheet.getDataRange().getValues();
    return { success: true, data: data };
  }

  return { syncSheet: syncSheet, readSheet: readSheet };
})();
```

**$ARGUMENTS value (explicit args):** `src/gas/sheetSync.gs`

**Expected dispatcher behavior:**
1. Derive `task_name` via `git rev-parse --abbrev-ref HEAD`
2. Detect `.gs` extension → route to `gas-code-review` (NOT `code-reviewer`)
3. Pass `reviewer_agent: "gas-code-review"` to the review-fix agent
4. Pass `target_files: "src/gas/sheetSync.gs"` and `task_name` to the agent
5. Do NOT use `code-reviewer` — this is a GAS file
6. Relay the full agent output verbatim after completion

**What a correct response looks like:**
The dispatcher selects `gas-code-review` from the Agent Routing table (`.gs` files row), passes it as `reviewer_agent`, and spawns the review-fix agent with the correct parameters. It does NOT fall through to `code-reviewer` (which would be incorrect for `.gs` files).
