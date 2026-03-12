---
name: gas-ui-debug
description: |
  Symptom-based GAS UI debugging. Route by user's problem description.

  **AUTOMATICALLY INVOKE** when user describes:
  - "blank", "empty", "nothing shows" → CONSOLE_CHECK
  - "error", "red message" → CONSOLE_CHECK
  - "button doesn't work", "click does nothing" → HANDLER_TEST
  - "nothing happens" → CONNECTION_CHECK
  - "looks wrong", "layout broken" → SNAPSHOT_CHECK
  - "slow", "loading forever" → PERFORMANCE_CHECK

  **MCP REQUIRED:** chrome-devtools (with browserUrl for GAS auth)
model: claude-haiku-4-5-20251001
allowed-tools: mcp__gas__*, mcp__chrome-devtools__*
---

# SYMPTOM ROUTER (START HERE)

> Route to diagnosis by symptom. One tool call to find the problem.

## Symptom → First Action Mapping

| User Says | Route To | First Tool | Rationale |
|-----------|----------|------------|-----------|
| "blank sidebar" / "nothing shows" | CONSOLE_CHECK | `list_console_messages({types: ["error"]})` | JS error crashed render |
| "error in console" / "red error" | CONSOLE_CHECK | `list_console_messages({types: ["error"]})` | Get exact error text |
| "button doesn't work" / "click does nothing" | HANDLER_TEST | `exec({js_statement: "require('Module').handler()"})` | Skip UI, test server directly |
| "wrong data" / "shows undefined" | HANDLER_TEST | `exec({js_statement: "require('Module').getData()"})` | Test data function directly |
| "nothing happens at all" | CONNECTION_CHECK | `list_pages()` | Probably on wrong page or not connected |
| "looks wrong" / "layout broken" | SNAPSHOT_CHECK | `take_snapshot()` | DOM/CSS issue |
| "slow" / "loading forever" | PERFORMANCE_CHECK | `list_console_messages` then `list_network_requests` | Network or infinite loop |
| "works in editor, fails in sidebar" | CONSOLE_CHECK | `list_console_messages({types: ["error"]})` | Client-side timing issue |
| "works sometimes" / "random failures" | TIMING_CHECK | `evaluate_script({function: ...})` | Async/race condition |
| "first load fails" / "intermittent" | TIMING_CHECK | `evaluate_script({function: ...})` | GAS client library timing |

## Decision Flow

```
SYMPTOM = classify user description

IF SYMPTOM matches "blank" OR "error" OR "empty":
    → GOTO CONSOLE_CHECK

IF SYMPTOM matches "button" OR "click" OR "interaction":
    → GOTO HANDLER_TEST

IF SYMPTOM matches "nothing happens" OR "no response":
    → GOTO CONNECTION_CHECK

IF SYMPTOM matches "visual" OR "layout" OR "looks wrong":
    → GOTO SNAPSHOT_CHECK

IF SYMPTOM matches "slow" OR "loading" OR "performance":
    → GOTO PERFORMANCE_CHECK

IF SYMPTOM matches "sometimes" OR "random" OR "intermittent" OR "first load":
    → GOTO TIMING_CHECK

DEFAULT:
    → GOTO CONSOLE_CHECK (80% of issues are JS errors)
```

---

# CONSOLE_CHECK

> 80% of GAS UI issues are JavaScript errors visible in console.

## Step 1: Get Errors

```javascript
mcp__chrome-devtools__list_console_messages({types: ["error"]})
```

## Decision Tree

```
RESULT = list_console_messages({types: ["error"]})

IF tool call FAILED with "connection" OR "no page":
    → GOTO CONNECTION_CHECK

IF RESULT.length > 0:
    → EXTRACT first error message
    → GOTO ERROR_MATCHER

IF RESULT.length === 0:
    → No client-side errors
    → IF user symptom was "blank":
        → GOTO SERVER_CHECK
    → IF user symptom was "error":
        → ASK: "What exact error text do you see?"
    → ELSE:
        → GOTO HANDLER_TEST
```

---

# ERROR_MATCHER

> Match error text to known patterns (IF-THEN), use judgment for unknowns (Quality Gate).

```
ERROR = console error message text
```

## Known Patterns (IF-THEN routing)

### jQuery Not Defined
```
IF ERROR contains "$ is not defined" OR "jQuery is not defined":
    DIAGNOSIS: jQuery not loaded when script runs
    FIX: Wrap code in $(document).ready() or DOMContentLoaded
    VERIFY: Reload sidebar via exec(), then CONSOLE_CHECK again
```

### Google Not Defined
```
IF ERROR contains "google is not defined":
    DIAGNOSIS: GAS client library not loaded when script runs
    FIX: Move <script> to end of <body> or use DOMContentLoaded
    VERIFY: Reload sidebar via exec(), then CONSOLE_CHECK again
```

### Function Not Found
```
IF ERROR contains "Script function not found" OR "is not a function":
    DIAGNOSIS: Function not exported or name ends with _ (private)
    DEBUG: exec({js_statement: "Object.keys(require('ModuleName'))"})
    FIX: Add to module.exports or remove trailing underscore
    VERIFY: HANDLER_TEST
```

### CORS Blocked
```
IF ERROR contains "CORS" OR "cross-origin" OR "blocked":
    DIAGNOSIS: External resource blocked by browser
    FIX: Use UrlFetchApp proxy for external APIs
    FIX: Ensure all resources use HTTPS
    VERIFY: Reload sidebar, CONSOLE_CHECK for same error
```

### exec_api Failure
```
IF ERROR contains "[exec_api]" OR "server.exec_api":
    DIAGNOSIS: createGasServer() call failed
    DEBUG: Check logger_output in last exec() result
    VERIFY: HANDLER_TEST to isolate server function
```

## Patterns Requiring Judgment (Quality Gate)

### Syntax Error
```
IF ERROR contains "Unexpected token" OR "SyntaxError":
```

**QUALITY GATE:**
- ✅ Error mentions `include()` or specific .html file → ES6 in include file, use string concatenation
- ✅ Error mentions template literal or backtick → Replace `${...}` with string concatenation
- ✅ Error mentions `://` in string → URL in template literal, use `"https:" + "//..."`
- ⚠️ Error is generic "Unexpected token" → Inspect the file at line number shown
- ❌ Error in minified code → Check if source maps available, may need to debug unminified

**VERIFY:** SERVER_CHECK to validate template compiles

### Null/Undefined Access
```
IF ERROR contains "Cannot read property" OR "Cannot read properties of undefined" OR "Cannot read properties of null":
    DIAGNOSIS: Accessing property on undefined/null variable
    DEBUG: Find the variable name from error (e.g., "Cannot read property 'foo' of undefined")
    FIX: Add null check or ensure variable is initialized before access
    VERIFY: CONSOLE_CHECK after fix
```

### google.script.run Timing
```
IF ERROR contains "google.script.run is not defined" OR "google is not defined":
    DIAGNOSIS: Script runs before GAS client library loads
    FIX: Wrap all google.script.run calls in DOMContentLoaded listener
    EXAMPLE: document.addEventListener('DOMContentLoaded', () => { google.script.run... });
    VERIFY: Reload sidebar, CONSOLE_CHECK
```

### createGasServer Not Defined
```
IF ERROR contains "createGasServer is not defined":
    DIAGNOSIS: Missing gas_client.html include
    FIX: Add <?!= include('common-js/html/gas_client') ?> before script that uses it
    VERIFY: SERVER_CHECK then CONSOLE_CHECK
```

### CommonJS Module Errors
```
IF ERROR contains "module is not defined" OR "require is not defined":
    DIAGNOSIS: CommonJS used in HTML without require.gs context
    FIX: This pattern only works server-side. Use google.script.run for client→server calls
    VERIFY: Check file extension (.gs vs .html)
```

### Factory Not Found
```
IF ERROR contains "Factory not found":
    DIAGNOSIS: Module name in require() doesn't match __defineModule__ registration
    DEBUG: exec({js_statement: "Object.keys(globalThis.__moduleFactories__ || {})"})
    FIX: Ensure __defineModule__('ModuleName', ...) matches require('ModuleName')
    VERIFY: HANDLER_TEST with correct module name
```

### Template Literal URL Error
```
IF ERROR contains "Unexpected token '<'" AND stack mentions include() OR .html:
    DIAGNOSIS: Template literal with URL (`https://...`) in included HTML file
    FIX: Use string concatenation instead: "https:" + "//example.com"
    FIX: Or use regular strings, not template literals
    VERIFY: SERVER_CHECK to validate template compiles
```

### CSP Violation
```
IF ERROR contains "Refused to execute inline script" OR "Content Security Policy":
    DIAGNOSIS: GAS sandbox blocks inline scripts in certain contexts
    FIX: Move JavaScript to separate <script> block or use addEventListener()
    VERIFY: CONSOLE_CHECK after restructuring
```

### fetch Not Supported
```
IF ERROR contains "fetch is not supported" OR "fetch is not defined":
    DIAGNOSIS: GAS client environment doesn't have fetch API
    FIX: Use google.script.run to call server-side UrlFetchApp instead
    VERIFY: HANDLER_TEST with server-side fetch function
```

## Unknown Errors (Quality Gate)

```
IF NO KNOWN PATTERN MATCHED:
```

**QUALITY GATE:**
- ✅ Stack trace shows clear `file.html:line` → Search codebase: `ripgrep({scriptId, pattern: "<function_name>"})` → Locate and fix → VERIFY via CONSOLE_CHECK
- ✅ Error mentions specific function name → List exports: `exec({js_statement: "Object.keys(require('ModuleName'))"})` → GOTO HANDLER_TEST
- ⚠️ Generic error, no file/line info → ASK user: "What exact error text do you see?" → WAIT for response → Re-run ERROR_MATCHER with new info
- ⚠️ Error seems server-side (mentions .gs file or server function) → GOTO HANDLER_TEST to isolate
- ❌ Minified/obfuscated stack trace → Add console.log checkpoints to narrow down → Reload sidebar → GOTO CONSOLE_CHECK

**AFTER INVESTIGATION:**
1. REPORT: "Error: <text>. Located in <file>:<line>. Cause: <diagnosis>"
2. SUGGEST: Specific fix based on diagnosis
3. VERIFY: After fix applied, GOTO CONSOLE_CHECK to confirm resolution

---

# HANDLER_TEST

> Test server function directly, bypassing all UI/client code.

## Step 1: Call Handler

```javascript
// Replace 'ModuleName' and 'handlerFunction' with actual names
mcp__gas__exec({
  scriptId,
  js_statement: `require('ModuleName').handlerFunction({testParam: 'value'})`
})
```

## Decision Tree

```
RESULT = exec(handler...)

IF RESULT.success === true:
    → Server handler works correctly
    → Problem is CLIENT-SIDE event binding
    → CONTINUE to Step 2: Client Binding Check

IF RESULT.success === false:
    → Server handler has bug
    → CHECK RESULT.logger_output for stack trace
    → REPORT: "Server error: <logger_output>"
    → SUGGEST fix based on error message
```

## Step 2: Client Binding Check (if server works)

```javascript
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    const btn = document.querySelector('#buttonId');
    return {
      exists: !!btn,
      hasClick: !!btn?.onclick || btn?.getAttribute('onclick'),
      text: btn?.textContent
    };
  }`
})
```

## Decision Tree

```
RESULT = evaluate_script(...)

IF RESULT.exists === false:
    → Button not in DOM
    → REPORT: "Button #buttonId not found in DOM"
    → GOTO SNAPSHOT_CHECK to see actual DOM

IF RESULT.exists === true AND RESULT.hasClick === false:
    → Event listener not attached
    → REPORT: "Button exists but no click handler attached"
    → FIX: Check script runs after DOMContentLoaded
    → VERIFY: Reload sidebar, CONSOLE_CHECK for errors

IF RESULT.exists === true AND RESULT.hasClick === true:
    → Button and handler both present but still failing
    → DEBUG: Check handler function name matches server function
    → DEBUG: evaluate_script to call handler directly and check console
    → GOTO CONSOLE_CHECK for runtime errors from handler execution
```

---

# CONNECTION_CHECK

> Verify MCP can reach Chrome. Run when tools fail.

## Step 1: Test Chrome Connection

```javascript
mcp__chrome-devtools__list_pages()
```

## Decision Tree

```
RESULT = list_pages()

IF RESULT is array with pages:
    → Chrome connected
    → CHECK: Is correct spreadsheet in list?
    → IF NOT:
        → GET URL: exec({js_statement: "SpreadsheetApp.getActiveSpreadsheet().getUrl()"})
        → OPEN: new_page({url: result.result})
    → GOTO CONSOLE_CHECK

IF RESULT contains "Failed to connect" OR "ECONNREFUSED":
    → Chrome not running with debug port
    → TELL USER:
      "Chrome DevTools MCP cannot connect. Start Chrome with debugging:

      chrome-debug

      Or manually:
      /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
        --remote-debugging-port=9222 \
        --user-data-dir=\"$HOME/.chrome-debug-profile\"

      Then retry."
    → STOP until user confirms Chrome running

IF RESULT contains "No page" OR empty array:
    → Chrome running but no tabs
    → GET URL: exec({js_statement: "SpreadsheetApp.getActiveSpreadsheet().getUrl()"})
    → OPEN: new_page({url: result.result})
    → GOTO CONSOLE_CHECK
```

---

# SERVER_CHECK

> Validate HTML template compiles on server. For "blank sidebar" after no console errors.

## Step 1: Validate Template

```javascript
mcp__gas__exec({scriptId, js_statement: `
  try {
    const html = HtmlService.createTemplateFromFile('sidebar').evaluate().getContent();
    return {
      success: true,
      length: html.length,
      hasScriptlets: html.includes('<?'),
      preview: html.substring(0, 500)
    };
  } catch (e) {
    return { success: false, error: e.message, stack: e.stack };
  }
`})
```

## Decision Tree

```
RESULT = validate HTML template

IF RESULT.success === false:
    → ERROR is in server-side template compilation
    → CHECK RESULT.error for specific issue
    → COMMON: Missing include file, scriptlet syntax error
    → FIX: Correct the error in the template file
    → VERIFY: Re-run Step 1, then GOTO CONSOLE_CHECK

IF RESULT.hasScriptlets === true AND scriptlets visible in preview:
    → Used createHtmlOutputFromFile instead of createTemplateFromFile
    → FIX: Change to createTemplateFromFile(...).evaluate()
    → VERIFY: Re-run Step 1, then GOTO CONSOLE_CHECK

IF RESULT.success === true AND RESULT.length < 100:
    → Template is nearly empty
    → CHECK: include() calls returning empty strings
    → DEBUG: Test each include file individually (Step 2)

IF RESULT.success === true AND RESULT.length >= 100:
    → Template compiles correctly
    → Problem is likely client-side JavaScript
    → GOTO CONSOLE_CHECK to look for runtime errors
```

## Step 2: Test Individual Includes

```javascript
// Replace with actual include file names from the project
mcp__gas__exec({scriptId, js_statement: `
  ['styles', 'scripts', 'components'].map(f => {
    try {
      return { file: f, status: 'OK', length: HtmlService.createHtmlOutputFromFile(f).getContent().length };
    } catch (e) {
      return { file: f, status: 'ERROR', message: e.message };
    }
  })
`})
```

## Decision Tree

```
RESULTS = test includes

FOR EACH result:
    IF result.status === 'ERROR':
        → FOUND: Broken include file
        → CHECK: File exists, no syntax errors
        → FIX: Correct the specific file
```

---

# SNAPSHOT_CHECK

> Get DOM structure when UI "looks wrong".

## Step 1: Capture DOM

```javascript
mcp__chrome-devtools__take_snapshot()
```

## Decision Tree

```
SNAPSHOT = take_snapshot()

ANALYZE DOM structure:

IF expected container/element missing:
    → HTML template issue
    → GOTO SERVER_CHECK

IF elements present but wrong content:
    → Data binding issue
    → DEBUG: Check template variables (<?= ?> vs <?!= ?>)
    → DEBUG: exec() to test data function directly
    → FIX: Correct scriptlet or data source
    → VERIFY: Reload sidebar, GOTO SNAPSHOT_CHECK to confirm

IF elements present but wrong position/size:
    → CSS issue
    → CHECK: Stylesheet loaded? (look for <style> or <link> in snapshot)
    → CHECK: Correct selectors? (inspect element classes/IDs)
    → FIX: Correct CSS rules or include path
    → VERIFY: Reload sidebar, GOTO SNAPSHOT_CHECK to confirm

IF DOM looks correct:
    → Visual issue may be JavaScript-driven (dynamic content)
    → GOTO CONSOLE_CHECK for runtime errors
```

---

# PERFORMANCE_CHECK

> For "slow" or "loading forever" symptoms.

## Step 1: Check for Errors First

```javascript
mcp__chrome-devtools__list_console_messages({types: ["error", "warn"]})
```

## Step 2: Check Network (if no errors)

```javascript
mcp__chrome-devtools__list_network_requests()
```

## Decision Tree

```
IF console shows errors:
    → GOTO ERROR_MATCHER

IF network shows pending requests:
    → REPORT: "Waiting on: <pending URLs>"
    → CHECK: External API timeout? Missing resource?

IF network shows failed requests:
    → REPORT: "Failed to load: <failed URLs>"
    → CHECK: CORS? 404? Authentication?

IF console and network both clean:
    → Likely infinite loop in JavaScript
    → DEBUG: Add console.log checkpoints
    → OR: Use performance trace (expensive)
```

---

# TIMING_CHECK

> For async issues: "works sometimes", "random failures", "race condition".

## When to Use

| Symptom | Indicator |
|---------|-----------|
| "Works sometimes" | Intermittent failures |
| "Random errors" | Not reproducible |
| "First load fails" | Works after reload |
| "google.script.run fails" | Timing issue likely |

## Step 1: Check GAS Client Library Status

```javascript
mcp__chrome-devtools__evaluate_script({
  function: `() => ({
    googleDefined: typeof google !== 'undefined',
    scriptDefined: typeof google?.script !== 'undefined',
    runDefined: typeof google?.script?.run !== 'undefined',
    readyState: document.readyState
  })`
})
```

## Decision Tree

```
IF googleDefined === false:
    → GAS client library not loaded
    → FIX: Ensure no scripts run before library loads
    → FIX: Use DOMContentLoaded listener

IF readyState !== 'complete':
    → Page still loading when script ran
    → FIX: Wrap init code in: document.addEventListener('DOMContentLoaded', init)

IF all true but still failing:
    → Check for race conditions in code
    → DEBUG: ripgrep({scriptId, pattern: "google.script.run"})
    → Look for calls at top-level (outside event handlers)
```

---

# CROSS-ORIGIN SIDEBAR ACCESS

> Use when `take_snapshot()` isn't enough and you need to manipulate cross-origin iframe content.

## Background: GAS Sidebar Iframe Nesting

```
Level 0: Google Sheets (docs.google.com/spreadsheets)  → SAME-ORIGIN ✅
    └── Level 1: iframedAppPanel (docs.google.com/macros)  → SAME-ORIGIN ✅
            └── Level 2: userCodeAppPanel (googleusercontent.com)  → CROSS-ORIGIN ❌
```

**Problem:** Direct `evaluate_script()` calls fail on Level 2 (cross-origin blocked).

**Solution:** Pass a uid from `take_snapshot()` to `evaluate_script` via the `args` parameter. The Chrome DevTools Protocol has privileged access via uid lookup, and once you have an element reference, standard DOM navigation works.

## When to Escalate from take_snapshot to evaluate_script

| Situation | Tool |
|-----------|------|
| Read visible text only | `take_snapshot()` |
| Scroll content | `evaluate_script()` with uid args |
| Extract HTML/innerHTML | `evaluate_script()` with uid args |
| Trigger handler programmatically | `evaluate_script()` with uid args |
| Check computed styles | `evaluate_script()` with uid args |

## Portal Pattern: uid Args Bypass

**Step 1:** Take snapshot to get element uids
```javascript
mcp__chrome-devtools__take_snapshot()
// Search output for stable element: uid=X_Y textbox "Enter your message"
```

**Step 2:** Pass uid to navigate cross-origin
```javascript
mcp__chrome-devtools__evaluate_script({
  function: `(el) => {
    // Navigate from entry point to target
    let root = el;
    while (root && !root.classList?.contains('tab-content')) {
      root = root.parentElement;
    }
    // Now use querySelector from here
    const target = root?.querySelector('.your-selector');
    // Manipulate freely...
    return { success: true };
  }`,
  args: [{"uid": "<uid_from_snapshot>"}]
})
```

## Quick Patterns

**Scroll to top:**
```javascript
args: [{"uid": "<textbox_uid>"}],
function: `(el) => {
  let r = el; while(r && !r.classList?.contains('tab-content')) r = r.parentElement;
  r?.querySelector('.chat-container').scrollTop = 0;
  return 'scrolled';
}`
```

**Programmatic click (when a11y clicks fail):**
```javascript
args: [{"uid": "<textbox_uid>"}, ".button-selector"],
function: `(el, sel) => {
  let r = el; while(r && !r.classList?.contains('tab-content')) r = r.parentElement;
  r?.parentElement?.querySelector(sel)?.click();
  return 'clicked';
}`
```

**Check element state:**
```javascript
args: [{"uid": "<textbox_uid>"}, ".element-selector"],
function: `(el, sel) => {
  let r = el; while(r && !r.classList?.contains('tab-content')) r = r.parentElement;
  const t = r?.parentElement?.querySelector(sel);
  if (!t) return {found: false};
  const s = getComputedStyle(t);
  return {found: true, visible: s.display !== 'none', disabled: t.disabled};
}`
```

## Dynamic uid Discovery

Search snapshot text for known patterns instead of hardcoding:
```
1. Take snapshot → search for "Enter your message" (stable placeholder text)
2. Extract uid from: uid=4_16 textbox "Enter your message"
3. Use that uid for all subsequent operations
```

## Chaining Operations (No Intermediate Snapshots)

**Snapshots are ONLY for UID discovery**, not for verification:

| Pattern | Correct |
|---------|---------|
| Get UIDs → evaluate_script | ✅ Snapshot needed for UIDs |
| evaluate_script → evaluate_script | ✅ Chain directly, no snapshot |
| evaluate_script → verify success | ✅ Trust `isError` flag in response |
| evaluate_script → snapshot → evaluate_script | ❌ Unnecessary snapshot |

**Why:** `evaluate_script` returns `{isError: true/false}`. Trust this instead of re-snapshotting.

**When to re-snapshot:**
- Page navigation occurred
- Sidebar was closed/reopened
- Need to find NEW elements
- UIDs returning "element not found"

---

# SKILL INTEGRATION

> When to delegate to complementary skills.

## Delegation Rules

| Condition | Delegate To | Context to Pass |
|-----------|-------------|-----------------|
| Server error in HANDLER_TEST | `/gas-debug` | Error message, logger_output, module name |
| Pattern issue in ERROR_MATCHER | `/gas-ui-review` | File path, line number, error text |
| Need to reproduce interactively | `/gas-sidebar-debug` | Steps to reproduce, expected behavior |
| Deep code analysis needed | `/gas-code-review` | File path, specific concerns |

## Tool Ordering (Fastest First)

Always prefer faster tools before slower ones:

| Priority | Tool | Time | Use When |
|----------|------|------|----------|
| 1 | `list_console_messages` | ~100ms | First check for any error |
| 2 | `list_pages` | ~100ms | Connection issues |
| 3 | `take_snapshot` | ~500ms | DOM structure analysis |
| 4 | `evaluate_script` | ~1s | Client-side state inspection |
| 4b | `evaluate_script` (uid args) | ~1s | Cross-origin DOM access |
| 5 | `exec` | 1-2s | Server-side verification |

**Note:** `take_snapshot` is for UID discovery, not verification.
`evaluate_script` returns `{isError: true/false}` - trust this instead of re-snapshotting.
Chaining: `evaluate_script` calls can be chained without snapshots. Only snapshot when you need fresh UIDs.

---

# MCP CONFIGURATION

## Required MCP Servers

| Server | Purpose | Verify Command |
|--------|---------|----------------|
| `chrome-devtools` | Console, DOM, screenshots | `list_pages()` |
| `gas` | exec(), file ops, server logs | `ls({scriptId})` |

## Chrome DevTools Config (Recommended for GAS)

**Manual mode with auth** - keeps Google login:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "@anthropic-ai/mcp-server-chrome-devtools@latest",
        "--browserUrl", "http://127.0.0.1:9222"
      ]
    }
  }
}
```

**Why manual mode?**
- Connects to YOUR Chrome instance
- Google login persists (no re-auth per session)
- Can see what Claude sees in real browser

**One-time setup:**
```bash
# Create debug script (saves typing)
echo '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-debug-profile"' > ~/bin/chrome-debug
chmod +x ~/bin/chrome-debug

# Run once, sign into Google
chrome-debug
# Sign into Google account in the browser that opens
# Close browser when done
```

**Alternative: Auto-launch (not for GAS)**
```json
{
  "chrome-devtools": {
    "args": []
  }
}
```
- Auto-launches fresh Chrome
- No saved logins (must re-auth every time)
- Good for non-GAS testing only

## Connection Troubleshooting

| Problem | Symptom | Fix |
|---------|---------|-----|
| Chrome not running | "Failed to connect" | Run `chrome-debug` |
| No tabs open | "No page found" | Open any tab first |
| Port in use | "Address already in use" | `pkill -f "chrome.*9222"` |
| Profile locked | "Profile in use" | Close all Chrome instances |
| Wrong page | Actions on wrong tab | `list_pages()` then `select_page()` |

---

# REFERENCE

## Speed Rankings (Fastest to Slowest)

| Rank | Tool | Time | Notes |
|------|------|------|-------|
| 1 | `list_console_messages` | ~100ms | Pure data retrieval |
| 2 | `list_pages` | ~100ms | Pure data retrieval |
| 3 | `select_page` | ~200ms | Switch context |
| 4 | `take_snapshot` | ~500ms | Parse DOM |
| 5 | `exec` (simple) | ~1s | GAS API call |
| 6 | `evaluate_script` | ~1s | Browser JS execution |
| 7 | `take_screenshot` | ~1s | Render + encode |
| 8 | `exec` (showSidebar) | ~2s | GAS + UI render |
| 9 | `wait_for` | 1-5s | Polling with timeout |
| 10 | Performance trace | 5-30s | Full browser trace |

## Server vs Client Logging

| Location | Method | Where to Check |
|----------|--------|----------------|
| Server (.gs) | `Logger.log()` | exec() response `logger_output` |
| Client (.html) | `console.log()` | `list_console_messages()` |

## createGasServer() Pattern

```javascript
// Initialize once
const server = createGasServer({ debug: true });

// Call server functions
server.exec_api(null, 'ModuleName', 'functionName', arg1, arg2)
  .then(response => {
    // response = {success: true, result: <value>, logger_output: "logs"}
    console.log('[exec_api] Success:', response.result);
  })
  .catch(err => {
    console.error('[exec_api] Failed:', err.message);
  });
```

## Cancellation Pattern

```javascript
const call = server.exec_api(null, 'Module', 'longRunningFn', {requestId: 'unique-id'});
call.cancel('User requested cancel');
// Returns: Promise<{success: true, reason: 'User requested cancel'}>
```

## Bypass DevTools - Use exec() Directly

| Instead of DevTools... | Use exec() |
|------------------------|------------|
| Click menu item | `exec({js_statement: "handlerFunction()"})` |
| Navigate menu hierarchy | `exec({js_statement: "require('Module').handler()"})` |
| Click sidebar button | `exec({js_statement: "require('Handler').onButtonClick()"})` |
| Submit form | `exec({js_statement: "require('Form').submit({data})"})` |
| Trigger onOpen | `exec({js_statement: "onOpen({source: SpreadsheetApp.getActive()})"})` |

## Event Handler Direct Invocation

| Event | Direct exec() call |
|-------|-------------------|
| onOpen | `onOpen({source: SpreadsheetApp.getActive()})` |
| onEdit | `onEdit({range: SpreadsheetApp.getActiveSheet().getRange('A1'), value: 'test'})` |
| doGet | `doGet({parameter: {}}).getContent()` |
| doPost | `doPost({postData: {contents: '{}'}}).getContent()` |

## UI Creation via exec()

```javascript
// Show sidebar
mcp__gas__exec({scriptId, js_statement: `
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutputFromFile('sidebar').setTitle('My Sidebar')
  )
`})

// Show dialog
mcp__gas__exec({scriptId, js_statement: `
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutputFromFile('dialog').setWidth(400).setHeight(300),
    'Dialog Title'
  )
`})

// Show toast
mcp__gas__exec({scriptId, js_statement: `
  SpreadsheetApp.getUi().toast('Operation complete', 'Status', 3)
`})
```

## Quick Reference: Container UI Methods

```javascript
// Sheets
SpreadsheetApp.getUi().alert('msg')
SpreadsheetApp.getUi().prompt('Enter:')
SpreadsheetApp.getUi().toast('msg', 'title', seconds)
SpreadsheetApp.getUi().showSidebar(html)
SpreadsheetApp.getUi().showModalDialog(html, 'title')

// Docs
DocumentApp.getUi().alert('msg')
DocumentApp.getUi().showSidebar(html)

// Forms / Slides (same pattern)
FormApp.getUi() / SlidesApp.getUi()
```
