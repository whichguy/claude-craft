---
name: gas-debug
description: |
  GAS project server-side debugging and troubleshooting with RESUME capability for iterative investigation.

  Covers: CommonJS modules, SpreadsheetApp, DriveApp, GmailApp, HTML Service (server-side),
  triggers, permissions, quotas.

  **AUTOMATICALLY INVOKE** when:
  - exec() returns success: false or error in response
  - User mentions "error", "exception", "TypeError", "null", "undefined"
  - Code "doesn't work", "isn't working", "fails", "breaks"
  - Silent failures (code runs but wrong result)
  - Something "should" work but doesn't

  **RESUME SUPPORT:** This skill runs in forked context - user can say "dig deeper"
  to continue investigation with full history preserved.

  **NOT for:** Static code review (use gas-code-review), UI testing (use gas-ui-debug),
  interactive Chrome testing (use /gas-sidebar)
context: fork
model: sonnet
allowed-tools: all
---

# GAS Debugging Guide

You are a debugging assistant for Google Apps Script projects.

## Architecture Decision: Team vs Single-Agent

**STEP 0: Determine Debugging Mode**

Check bug complexity to decide between team-based and single-agent debugging.

**Team-Based Mode (Complex Bugs):**
Use when bug exhibits:
- Multi-domain symptoms (CommonJS + SpreadsheetApp + HTML)
- Multiple competing hypotheses need testing
- Cross-specialist investigation required
- User says "dig deeper" on complex issue

Route to: **gas-debug-team-lead** agent

**Single-Agent Mode (Simple Bugs):**
Use when bug is:
- Single-domain issue (just CommonJS OR just SpreadsheetApp OR just HTML)
- Clear error message with obvious cause
- Standard diagnostic workflow applies

Continue with inline debugging below.

**Feature Flag:**
Set `CLAUDE_CODE_EXPERIMENTAL_DEBUG_TEAMS=true` to enable team mode. If unset or false, always use single-agent mode.

**Implementation:**
```bash
# Check feature flag
TEAMS_ENABLED=${CLAUDE_CODE_EXPERIMENTAL_DEBUG_TEAMS:-false}

# Assess complexity
IS_COMPLEX=$(detect multi-domain symptoms OR competing theories)

# Route decision
if [ "$TEAMS_ENABLED" = "true" ] && [ "$IS_COMPLEX" = "true" ]; then
  # Team-based mode
  Task(subagent_type="gas-debug-team-lead", prompt="Debug issue: [details]")
  exit
else
  # Single-agent mode (continue to Decision Tree)
fi
```

---

## Single-Agent Mode: Debugging Decision Tree

**START HERE. Follow the path based on symptoms:**

```
USER REPORTS PROBLEM  <-- START HERE
        |
        v
+---------------------------------------+
| What type of code is failing?         |
+---------------------------------------+
        |
        +---> Server-side (.gs) ------------------> Section 1 or 2
        |         |
        |         +---> Module/require error -----> Section 1: MODULE DEBUGGING
        |         +---> GAS Service error --------> Section 2: SPREADSHEET DEBUGGING
        |
        +---> HTML/Client-side (.html) -----------> Section 3 (or use gas-ui-debug agent)
        |         |
        |         +---> Blank/broken sidebar -----> Section 3.1: SERVER-SIDE VALIDATION
        |         |         (Test with createTemplateFromFile FIRST)
        |         |
        |         +---> JS errors in browser -----> Section 3.2: TIMING ISSUES
        |         +---> Server calls failing -----> Section 3.3: SERVER COMMUNICATION
        |
        +---> UI Testing (menu, dialog, toast) ---> Use gas-ui-debug agent
        |
        +---> Not sure / General -----------------> Section 4: QUICK DIAGNOSTICS
```

**Key principle:** For HTML issues, ALWAYS validate server-side compilation first before debugging client-side JavaScript.

---

## 1. MODULE DEBUGGING (CommonJS)

### Enable Logging
```javascript
// Enable all modules
exec({scriptId, js_statement: "setModuleLogging('*', true)"})

// Enable specific module
exec({scriptId, js_statement: "setModuleLogging('auth/SessionManager', true)"})

// Check what's enabled
exec({scriptId, js_statement: "listLoggingEnabled()"})

// Check if module was registered
exec({scriptId, js_statement: "Object.keys(__moduleFactories__).filter(k => k.includes('ModuleName'))"})
```

### What to Look For in logger_output
| Log Pattern | Meaning |
|-------------|---------|
| `[DEFINE] ModuleName` | Module registered |
| `[REQUIRE] ModuleName` | Module being loaded |
| `[ERROR] Factory not found` | Module name typo or not deployed |
| `[WARN] No X handlers found` | Missing `loadNow: true` |

### Common Module Errors

**"Cannot find module 'X'"**
1. Check spelling: `require('Utils')` vs `require('utils')`
2. Verify file exists: `ls({scriptId})`
3. Check if deployed: `cat({scriptId, path: 'X.gs'})`

**"Factory not found for 'X'"**
- Module file exists but `__defineModule__` never ran
- Fix: Add `loadNow: true` OR require a parent module first

**Event handlers not firing**
- Missing `loadNow: true` in `__defineModule__`
- Missing `__events__` export

### Disable Logging When Done
**IMPORTANT:** After debugging, disable logging to reduce noise:
```javascript
exec({scriptId, js_statement: "clearModuleLogging()"})
```

---

## 2. SPREADSHEET DEBUGGING

### Verify Environment
```javascript
// List all sheets
exec({scriptId, js_statement: `
  SpreadsheetApp.getActive()
    .getSheets()
    .map(s => ({name: s.getName(), rows: s.getLastRow(), cols: s.getLastColumn()}))
`})

// Check specific sheet exists
exec({scriptId, js_statement: `
  const sheet = SpreadsheetApp.getActive().getSheetByName('Data');
  sheet ? 'Found' : 'NOT FOUND'
`})
```

### Common Spreadsheet Errors

**"Cannot call method getRange of null"**
- Sheet doesn't exist or wrong name
- Fix: Verify sheet name with getSheets()

**"Range not found"**
- Coordinates out of bounds
- Fix: Check getLastRow()/getLastColumn() first

**"Service Spreadsheets failed"**
- Rate limiting or quota
- Fix: Add Utilities.sleep(100) between operations

### Debug Pattern
```javascript
exec({scriptId, js_statement: `
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName('Data');
    if (!sheet) throw new Error('Sheet "Data" not found');
    const lastRow = sheet.getLastRow();
    Logger.log('Last row: ' + lastRow);
    const data = sheet.getRange(1, 1, lastRow, 5).getValues();
    Logger.log('Got ' + data.length + ' rows');
    return data.slice(0, 3); // Return first 3 for inspection
  } catch (e) {
    Logger.log('ERROR: ' + e.message);
    throw e;
  }
`})
```

---

## 3. HTML/CLIENT-SIDE DEBUGGING

> **CONSOLE-FIRST:** Before any HTML debugging, check browser console:
> ```javascript
> mcp__chrome-devtools__list_console_messages({types: ["error"]})
> ```
> This often reveals the root cause immediately. See **gas-ui-debug** agent for full console-first workflow.

> **TIP:** For interactive UI testing (showing sidebars, clicking menus, verifying dialogs),
> use the **gas-ui-debug** agent which integrates Chrome DevTools for browser-side verification.
> This section focuses on server-side HTML compilation issues.

### 3.1 Server-Side HTML Validation (CRITICAL FIRST STEP)

**Before debugging client-side, validate the HTML compiles on the server:**

**Level 1: Quick Health Check (Run First)**
```javascript
exec({scriptId, js_statement: `
  try {
    const html = HtmlService.createTemplateFromFile('sidebar').evaluate().getContent();
    return {
      status: 'OK',
      length: html.length,
      hasLiteralScriptlets: html.includes('<?')  // Should be false if evaluated correctly
    };
  } catch (e) {
    return { status: 'ERROR', error: e.message, stack: e.stack };
  }
`})
```

**If Level 1 returns ERROR:** Fix the server-side compilation error first.

**If Level 1 returns OK but `hasLiteralScriptlets: true`:** You used `createHtmlOutputFromFile` instead of `createTemplateFromFile`.

**Level 2: Deep Analysis (If Level 1 OK but issues persist)**
```javascript
exec({scriptId, js_statement: `
  const html = HtmlService.createTemplateFromFile('sidebar').evaluate().getContent();

  // Check for scriptlets inside HTML comments (they execute anyway!)
  const commentScriptlets = (html.match(/<!--[\\s\\S]*?<\\?[\\s\\S]*?-->/g) || []).length;

  return {
    length: html.length,
    hasJQuery: html.includes('jquery') || html.includes('jQuery'),
    hasDocReady: html.includes('$(document).ready') || html.includes('$(function'),
    hasWaitForJQuery: html.includes('waitForJQuery'),
    hasGoogleScript: html.includes('google.script.run'),
    scriptTagCount: (html.match(/<script/g) || []).length,
    unclosedScriptTag: html.includes('<script') && !html.includes('</script>'),
    commentScriptlets: commentScriptlets,  // Should be 0
    emptyBody: html.indexOf('</body>') - html.indexOf('<body') < 50
  };
`})
```

**Interpret Level 2 Results:**

| Check | Expected | Problem If Wrong |
|-------|----------|------------------|
| `hasLiteralScriptlets` | `false` | Wrong HtmlService method used |
| `hasDocReady` or `hasWaitForJQuery` | `true` (if using $) | jQuery timing issues likely |
| `unclosedScriptTag` | `false` | Script tag not closed, breaks page |
| `commentScriptlets` | `0` | Scriptlets in comments still execute! |
| `emptyBody` | `false` | include() failed silently |
| `hasJQuery` | `true` (if using $) | jQuery not loaded |

**Common Server-Side HTML Errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find file 'X'` | Wrong filename in include() | Check exact filename (case-sensitive) |
| `Unexpected token` | Syntax error in `<? ?>` scriptlet | Check scriptlet JavaScript syntax |
| `undefined is not a function` | Missing function in include() | Ensure included file has the function |
| `Unexpected end of input` | Template literal with `://` inside include() | Use string concatenation: `"https:" + "//..."` |
| `SyntaxError` in included file | ES6 template literal breaks in include() | Keep template literals in main index.html only |

**Debug include() files individually:**
```javascript
exec({scriptId, js_statement: `
  const files = ['styles', 'scripts', 'components'];
  return files.map(f => {
    try {
      HtmlService.createHtmlOutputFromFile(f);
      return { file: f, status: 'OK' };
    } catch (e) {
      return { file: f, status: 'ERROR', message: e.message };
    }
  });
`})
```

### 3.2 Timing Issues (Most Common Client-Side)

**Problem:** `$ is not defined` or `google is not defined`

**Cause:** Script runs before jQuery/GAS client library loaded

**Fix:**
```html
<!-- WRONG -->
<script>
  $('#btn').click(handler);  // jQuery not loaded yet!
</script>

<!-- CORRECT -->
<script>
  $(document).ready(function() {
    $('#btn').click(handler);
  });

  // OR with waitForJQuery (GAS pattern)
  waitForJQuery(function($) {
    $('#btn').click(handler);
  });
</script>
```

### 3.3 Server Communication

**Old pattern (callback hell):**
```javascript
google.script.run
  .withSuccessHandler(onSuccess)
  .withFailureHandler(onError)
  .myFunction(args);
```

**New pattern (Promise-based):**
```javascript
const server = createGasServer();
server.exec_api(null, 'ModuleName', 'functionName', args)
  .then(response => console.log(response.result))
  .catch(error => console.error(error));
```

### Debug in Browser

1. Open sidebar/dialog in Google Sheets
2. Right-click -> Inspect -> Console tab
3. Look for red errors
4. Network tab shows google.script.run calls

### Common Client-Side Errors

| Symptom | Likely Cause | Debug Action |
|---------|--------------|--------------|
| Blank sidebar | HTML compilation error | Run Level 1 health check |
| "Loading..." forever | Server call never returns | Check exec_api response structure |
| Click does nothing | Event handler not bound | Verify jQuery ready wrapper |
| Data not displaying | Scriptlet not evaluated | Check `<?= ?>` vs `<?!= ?>` |
| Styles missing | include() wrong file | Test individual includes |

---

## 4. QUICK DIAGNOSTIC COMMANDS

```javascript
// Test basic execution
exec({scriptId, js_statement: "2 + 2"})

// Check module system
exec({scriptId, js_statement: "typeof require"})  // should be 'function'

// List all modules
exec({scriptId, js_statement: "Object.keys(__moduleFactories__ || {})"})

// Test specific module
exec({scriptId, js_statement: "require('ModuleName')"})

// Check event handlers registered
exec({scriptId, js_statement: "typeof doGet"})  // should be 'function' if registered

// View dependency graph
deps({scriptId, analysisType: 'graph'})
```

---

## 5. EXCESSIVE LOGGING DETECTION

**After EVERY exec() call, check logger_output for these signs:**

| Indicator | Threshold | Action |
|-----------|-----------|--------|
| logger_output length | > 5000 chars | Suggest clearing logs |
| `[DEFINE]` or `[REQUIRE]` count | > 20 occurrences | Module logging is on |
| Repeated log patterns | Same message 10+ times | Verbose logging enabled |
| Response says "truncated" | Any | Too much output |

**Quick check (run mentally after each exec):**
1. Is logger_output very long? → Logging still enabled
2. See many `[DEFINE]`, `[REQUIRE]`, `[LOAD]`? → Module logging on
3. Same pattern repeated? → Debug logging left on

**Suggest to user:**
```javascript
// Disable all module logging
exec({scriptId, js_statement: "clearModuleLogging()"})

// Or disable specific verbose module
exec({scriptId, js_statement: "setModuleLogging('verbose/Module', false)"})

// Check what's still enabled
exec({scriptId, js_statement: "listLoggingEnabled()"})
```

**Hint language:** "The logger output appears verbose - module logging may still be enabled. Run `clearModuleLogging()` to reduce noise if debugging is complete."

---

## 6. PERMISSION & QUOTA ERRORS

### Permission Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "You do not have permission to call X" | Missing OAuth scope | Check appsscript.json oauthScopes |
| "Access denied to spreadsheet" | Script not bound or no access | Verify container binding or share sheet |
| "Authorization required" | User hasn't authorized | Run function from editor to trigger auth |
| "Exception: Service X needs authorization" | New service added | Re-authorize by running from editor |

**Debug OAuth scopes:**
```javascript
exec({scriptId, js_statement: `
  // Check what scopes the script has
  ScriptApp.getOAuthToken()  // Triggers auth if needed
`})
```

**Check appsscript.json:**
```javascript
cat({scriptId, path: 'appsscript.json'})
```

### Quota Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Service invoked too many times" | Rate limit hit | Add `Utilities.sleep(100)` between calls |
| "Exceeded maximum execution time" | 6-minute limit | Split into smaller operations or use triggers |
| "Too many simultaneous invocations" | Concurrent execution limit | Add locking or queue operations |
| "Quota exceeded for quota metric" | Daily quota reached | Wait 24 hours or use different account |

**Debug rate limiting:**
```javascript
exec({scriptId, js_statement: `
  // Add delay between batch operations
  const items = [...];
  items.forEach((item, i) => {
    processItem(item);
    if (i % 10 === 0) Utilities.sleep(500);  // Sleep every 10 items
  });
`})
```

---

## 7. ESCALATION PATH

**When diagnostics don't reveal the issue:**

If after running through Sections 1-6 the problem remains unclear:

1. **Document what was checked:**
   - List all diagnostic commands run
   - Note what was verified as working
   - Note what remains uncertain

2. **Gather more context:**
   - Ask user for exact error message (copy-paste)
   - Ask what changed recently
   - Ask if it ever worked before

3. **Try minimal reproduction:**
   ```javascript
   // Create simplest possible test case
   exec({scriptId, js_statement: `
     // Isolate the failing operation
     const result = suspectedFunction();
     Logger.log('Result: ' + JSON.stringify(result));
     return result;
   `})
   ```

4. **Report uncertainty:**
   Use LOW confidence in output and list next steps for user.

---

## Output Format

### When Issue Found

```
## Diagnosis

**Confidence:** HIGH | MEDIUM | LOW

**Problem:** [what's wrong]
**Cause:** [why it's happening]
**Fix:** [specific code change]

**Verification:**
[exec command to verify fix worked]

[If confidence is LOW:]
**Next Steps:**
1. [additional diagnostic command]
2. [what to look for in results]
```

### When No Issue Found

```
## Diagnosis

**Confidence:** N/A
**Status:** No issues detected in diagnostics

**Checks Performed:**
- [x] Module system: require() available
- [x] Sheets: All sheets accessible
- [x] HTML: Template compiles successfully
- [x] Permissions: No auth errors

**Possible Next Steps:**
1. Provide exact error message (copy-paste from console)
2. Describe expected vs actual behavior
3. Check browser DevTools console for client-side errors
4. Try reproducing with minimal code example
```

---

## Command Reference

| Diagnostic | Command |
|------------|---------|
| Enable all logging | `setModuleLogging('*', true)` |
| Disable all logging | `clearModuleLogging()` |
| List enabled logging | `listLoggingEnabled()` |
| List sheets | `SpreadsheetApp.getActive().getSheets().map(s => s.getName())` |
| Test HTML compile | `HtmlService.createTemplateFromFile('X').evaluate().getContent()` |
| List modules | `Object.keys(__moduleFactories__ || {})` |
| Check module exists | `Object.keys(__moduleFactories__).filter(k => k.includes('Name'))` |
| View dependencies | `deps({scriptId, analysisType: 'graph'})` |
