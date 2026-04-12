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
2. Recognize `$ARGUMENTS` is non-empty → pass file directly to the review-fix agent (Path B)
3. Pass `target_files: "src/gas/sheetSync.gs"` and `task_name` to the agent — do NOT set `reviewer_agent`
4. The review-fix agent handles routing internally: `.gs` files automatically get `gas-code-review` added alongside the `code-reviewer` baseline
5. Relay the full agent output verbatim after completion

**What a correct response looks like:**
The dispatcher passes the file as `target_files` to the review-fix agent without specifying `reviewer_agent` (routing is handled internally by the agent per the Agent Routing table). The `reviewer_agent` override parameter exists only for forcing all files through a single reviewer — the dispatcher does not set it for normal per-file-type routing.
