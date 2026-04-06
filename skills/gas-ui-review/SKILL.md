---
name: gas-ui-review
description: "Reviews Google Apps Script HTML/UI code for correctness, layout, and GAS-specific patterns. Use when editing, reviewing, or planning .html files in GAS projects, or when code contains HtmlService, scriptlets, google.script.run, or IFRAME embedding patterns. Pair with gas-code-review for .gs files or use /gas-review for both."
model: claude-sonnet-4-6
allowed-tools: mcp__gas__*, Read, Grep
---

# GAS HTML/UI Pattern Review

You review GAS HTML code for correctness, patterns, and layout. Focus on GAS-specific gotchas.

**AUTOMATICALLY INVOKE** when:
- Code contains: HtmlService, `<?=`, `<?!=`, google.script.run, createGasServer
- Any edit/create/write to .html files in GAS projects
- Topics: IFRAME embedding, sidebar, dialog, web app deployment, Google Picker, CORS, template debugging
- User says "review"/"plan"/"fix" with UI/HTML context

**NOT for:** Runtime debugging (use gas-ui-debug), .gs syntax validation (use gas-code-review).

## Mode Detection (check first)

Scan the invocation prompt for `mode=evaluate`. If found → MODE=evaluate. Otherwise → MODE=standalone.

### MODE=evaluate (used by review-fix, review-plan)

Single-pass read-only review. No plan edits. No ExitPlanMode. No nested TeamCreate.

1. Run all review phases on the target file (unchanged evaluation logic)
2. Send findings via SendMessage exactly once:
   - type: "message"
   - recipient: "team-lead"
   - summary: "APPROVED|APPROVED_WITH_NOTES|NEEDS_REVISION — N critical, M advisory"
   - content: full review output starting with "## Code Review:"
3. Handle shutdown_request: approve immediately (review is complete)
4. STOP. Do not create teams. Do not call ExitPlanMode.

WARNING: If `mode=evaluate` is present, do NOT run standalone output.
Running standalone inside an existing team creates orphaned output that
the team-lead cannot collect.

## Quick Reference: Decision Tree

**What type of HTML do you need?**
```
Has scriptlets (<?= ?>, <?!= ?>)?
├── Yes → createTemplateFromFile() → set properties → .evaluate() → settings
└── No  → createHtmlOutputFromFile() → settings
```

**Method order matters:** template → properties → evaluate() → setTitle/setWidth/setXFrameOptionsMode

---

## 1. HtmlService Type System

### Types
| Type | Created By | Has Scriptlets | Ready to Display |
|------|------------|----------------|------------------|
| HtmlTemplate | createTemplateFromFile | Yes | needs .evaluate() |
| HtmlOutput | createHtmlOutputFromFile, .evaluate() | No | Yes |

### Critical Rule
`.evaluate()` returns a NEW HtmlOutput object. Settings applied to the template are LOST.

**Wrong:**
```javascript
const t = HtmlService.createTemplateFromFile('page');
t.setTitle('My Page');  // HtmlTemplate has no setTitle!
return t.evaluate();
```

**Correct:**
```javascript
const t = HtmlService.createTemplateFromFile('page');
t.data = getData();  // Set template properties BEFORE evaluate
return t.evaluate()
  .setTitle('My Page')      // Settings AFTER evaluate
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
```

---

## 2. Scriptlet Types

| Syntax | Behavior | Use For |
|--------|----------|---------|
| `<?= expr ?>` | Print with HTML escaping | User data (safe) |
| `<?!= expr ?>` | Print WITHOUT escaping | HTML content, include() |
| `<? code ?>` | Execute only, no output | Loops, conditionals |

### The include() Pattern
```javascript
// Server-side
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// In template - use <?!= (unescaped) for HTML
<?!= include('styles') ?>
<?!= include('scripts') ?>
```

### GOTCHA: Scriptlets in Comments Execute!
```html
<!-- THIS STILL EXECUTES -->
<!-- <?!= include('debug-panel') ?> -->

<!-- Use server-side conditional instead -->
<? if (DEBUG_MODE) { ?>
  <?!= include('debug-panel') ?>
<? } ?>
```

---

## 3. IFRAME Sandbox Requirements

### Mandatory Settings for Embedding
```javascript
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);  // Required!
}
```

### Link Target Requirements
Links/forms MUST use `target="_top"` or `target="_blank"`:
```html
<a href="url" target="_top">Link</a>
<form action="url" target="_top">...</form>

<!-- Or set globally -->
<head><base target="_top"></head>
```

### Blocked Features
- `allow-top-navigation` - no programmatic top navigation
- HTTP resources - HTTPS only
- alert(), confirm(), prompt() - blocked in cross-origin iframes

---

## 4. Sidebar & Dialog Specifics

### Size Constraints
| Type | Width | Height |
|------|-------|--------|
| Sidebar | **Fixed 300px** (cannot change) | Variable |
| Dialog | setWidth() works | setHeight() works |

### google.script.host Methods
```javascript
// Close dialog/sidebar (only self can close)
google.script.host.close();

// Return focus to document
google.script.host.editor.focus();

// Resize dialog (NOT sidebar)
google.script.host.setHeight(500);
google.script.host.setWidth(400);
```

### Workaround: Close Sidebar from Server
```javascript
// Can't directly close - overwrite with empty sidebar
function closeSidebar() {
  const html = HtmlService.createHtmlOutput('<script>google.script.host.close()</script>');
  SpreadsheetApp.getUi().showSidebar(html);
}
```

---

## 5. Client-Server Communication

### google.script.run Patterns
```javascript
// Always use both handlers
google.script.run
  .withSuccessHandler(onSuccess)
  .withFailureHandler(onError)
  .serverFunction(param);

// Pass context with withUserObject
google.script.run
  .withSuccessHandler(function(result, element) {
    element.innerHTML = result;
  })
  .withUserObject(document.getElementById('output'))
  .getData();
```

### Limitations
- Max 10 concurrent calls (extras queue)
- Allowed types: primitives, objects, arrays, forms
- **Blocked:** Date, Function, DOM elements (except forms), circular refs
- Functions ending with `_` are private (invisible to client)

### Promise Wrapper Pattern (Recommended)
```javascript
// Use createGasServer() for Promise-based API
const server = createGasServer();
server.exec_api(null, 'Module', 'function', param)
  .then(result => { ... })
  .catch(error => { ... });
```

---

## 6. Template Literal Gotchas

### URLs Break in include() Files
```javascript
// BREAKS - template literal with :// in included file
const url = `https://example.com/api`;

// WORKS - string concatenation
const url = "https:" + "//example.com/api";
```

### Escape </script>
```javascript
// Breaks HTML parsing
const html = `<script>code</script>`;

// Escape the closing tag
const html = `<script>code<\/script>`;
```

**Rule:** Keep template literals in main index.html only. Use ES5 strings in files loaded via include().

---

## 7. CSS & Styling

### Google's CSS Package
```html
<link rel="stylesheet" href="https://ssl.gstatic.com/docs/script/css/add-ons1.css">
```

### Button Classes
- `.action` - primary actions (blue)
- `.create` - creation operations
- `.share` - sharing actions
- Default `<button>` - secondary

### Sidebar Layout (Fixed Branding at Bottom)
```html
<style>
  .sidebar { padding: 10px; }
  .branding-below { bottom: 56px; top: 0; position: absolute; overflow-y: auto; }
  .bottom { position: absolute; bottom: 0; }
</style>
<div class="sidebar branding-below"><!-- scrollable content --></div>
<div class="sidebar bottom"><!-- fixed branding --></div>
```

### CSS/JS File Organization
```html
<!-- styles.html -->
<style>
  .my-class { color: blue; }
</style>

<!-- scripts.html -->
<script>
  function init() { ... }
</script>

<!-- main.html -->
<?!= include('styles') ?>
<body>...</body>
<?!= include('scripts') ?>
```

---

## 8. Error → Solution Map

| Error | Cause | Fix |
|-------|-------|-----|
| Scriptlets render as `<?= ?>` text | Used createHtmlOutputFromFile | Use createTemplateFromFile |
| X-Frame-Options blocked | Missing setXFrameOptionsMode | Add .setXFrameOptionsMode(ALLOWALL) |
| allow-top-navigation error | Form target="_self" | Change to target="_top" |
| setHeight not a function | Called on HtmlTemplate | Call after .evaluate() |
| Unexpected end of input | Template literal with URL in include() | Use string concatenation |
| google.script.run undefined | Script runs before DOM ready | Wrap in DOMContentLoaded |
| Function not found | Function ends with _ | Remove underscore (private) |

---

## 9. Review Checklist

### Before Creating HTML
- [ ] Need scriptlets? → createTemplateFromFile, else createHtmlOutputFromFile
- [ ] Setting properties? → Set BEFORE evaluate()
- [ ] Setting title/size? → Set AFTER evaluate()

### IFRAME/Embedding
- [ ] setXFrameOptionsMode(ALLOWALL) if embedding externally
- [ ] All links/forms use target="_top" or "_blank"
- [ ] All resources loaded via HTTPS

### Client-Side JavaScript
- [ ] google.script.run inside ready handler
- [ ] Both withSuccessHandler AND withFailureHandler
- [ ] No Date/Function objects passed to server
- [ ] Template literals only in main HTML (not includes)

### Sidebar/Dialog
- [ ] Sidebar: Don't try to change 300px width
- [ ] Dialog: Use setWidth/setHeight on HtmlOutput (not Template)
- [ ] Self-closing: google.script.host.close()

---

## 10. Advanced: Dialog ↔ Sidebar Communication

Use localStorage for cross-panel communication (same origin):

```javascript
// In sidebar - listen for dialog events
window.addEventListener('storage', function(e) {
  if (e.key === 'dialogResult') {
    const result = JSON.parse(e.newValue);
    handleDialogResult(result);
  }
});

// In dialog - notify sidebar
function submitAndClose(data) {
  localStorage.setItem('dialogResult', JSON.stringify(data));
  google.script.host.close();
}
```

**Note:** localStorage blocked if "Block Third-Party Cookies" enabled in Chrome.

---

## 11. Advanced Patterns & Gotchas

### Close Sidebar Programmatically (Workaround)
Sidebars can only close themselves. Workaround: overwrite with temporary sidebar that self-closes.
```javascript
function closeSidebar() {
  const html = HtmlService.createHtmlOutput('<script>google.script.host.close();</script>');
  SpreadsheetApp.getUi().showSidebar(html);  // Overwrites existing sidebar
}
```

### Detect Active Sheet Changes (Polling)
No event for sheet changes from sidebar. Must poll:
```javascript
// Client-side
setInterval(() => {
  google.script.run
    .withSuccessHandler(onSheetChange)
    .getActiveSheetName();
}, 100);  // ~0.5s delay acceptable
```

### Dynamic Menu Items (No Parameters Allowed)
`addItem()` only accepts function names. Workaround: generate global functions.
```javascript
// Create pattern-based functions
const sheetId = '123';
globalThis[`importSheet_${sheetId}`] = () => doImport(sheetId);
menu.addItem('Import', `importSheet_${sheetId}`);
```

### Google Picker in Dialogs
```javascript
// Required setup
new google.picker.PickerBuilder()
  .setOrigin(google.script.host.origin)  // REQUIRED in Apps Script!
  .setAppId(cloudProjectNumber)          // For drive.file scope
  .setOAuthToken(ScriptApp.getOAuthToken())
  .build();
```

### File Upload Size Limits
- Maximum blob: **50 MB** per file
- `google.script.run` slows with large data - use Drive API for big files
- Send as byte array, convert to blob server-side:
```javascript
// Client-side
const reader = new FileReader();
reader.onload = () => {
  const bytes = new Uint8Array(reader.result);
  google.script.run.uploadFile([...bytes], filename);
};
reader.readAsArrayBuffer(file);

// Server-side
function uploadFile(bytes, name) {
  const blob = Utilities.newBlob(bytes, 'application/octet-stream', name);
  DriveApp.createFile(blob);
}
```

### CORS Workaround for Web Apps
Web Apps don't handle OPTIONS preflight. Use `text/plain`:
```javascript
// External fetch to web app
fetch(webAppUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // Bypasses preflight!
  body: JSON.stringify(data)
});

// In doPost - parse the string
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  return ContentService.createTextOutput(JSON.stringify({success: true}));
}
```

### Template Debugging with getCode()
Debug templated HTML by examining generated code:
```javascript
const template = HtmlService.createTemplateFromFile('page');
Logger.log(template.getCode());  // Shows actual generated JS
```

### Undocumented Template Internals
When debugging with getCode(), you'll see:
```javascript
// Internal: HtmlService.initTemplate() creates output object
// output._ = "text"     → append (no escaping) - for HTML content
// output._$ = "text"    → appendUntrusted (escaped) - for user data
// output.$out           → the final HtmlOutput object
```
These are internal methods - don't use directly, but helps understand template behavior.

### getUserAgent() - Detect Browser
```javascript
// Get user's browser info (for conditional rendering)
const userAgent = HtmlService.getUserAgent();
if (userAgent.includes('Mobile')) {
  // Serve mobile-optimized content
}
```

### Performance: Properties vs Cache
```javascript
// Slow: Many small properties (hits quota)
PropertiesService.getScriptProperties().setProperty('key1', val1);
PropertiesService.getScriptProperties().setProperty('key2', val2);

// Fast: Single stringified object (max 9KB per key)
const config = { key1: val1, key2: val2 };
PropertiesService.getScriptProperties().setProperty('config', JSON.stringify(config));

// Fastest: Use CacheService (6 hour expiry)
CacheService.getScriptCache().put('config', JSON.stringify(config), 21600);
```

### Trigger Limitations
- Max frequency: **1 hour** (not sub-minute)
- Max triggers per user: **20**
- Execution timeout: **6 minutes**
- "Test as add-on" blocks triggers - use private deployment

### Lightweight Library Alternatives
| Heavy | Light Alternative |
|-------|-------------------|
| jQuery | nanoJS (7x smaller) |
| Material Design | Materialize |
| Bootstrap | PureCSS |

### Alternative Data Passing: Hidden Div (No Templates)
Pass data without templates using base64-encoded hidden div:
```javascript
// Server-side - append data to HtmlOutput
function appendDataToHtml(html, data) {
  const encoded = Utilities.base64Encode(JSON.stringify(data));
  return html.append(`<div id="data" style="display:none">${encoded}</div>`);
}

// Client-side - retrieve the data
function getDataFromHtml() {
  const encoded = document.getElementById('data').textContent;
  return JSON.parse(atob(encoded));
}
```
**Tradeoff:** ~33% size overhead vs templates, but simpler for non-scriptlet HTML.

### Session/User Authentication Gotcha
```javascript
// Only works for script OWNER - empty for other users!
const email = Session.getActiveUser().getEmail();

// Better: Use getEffectiveUser() for "Run as Me" deployments
const effectiveEmail = Session.getEffectiveUser().getEmail();

// Or use temporary user key for session identification
const userKey = Session.getTemporaryActiveUserKey();
```

### JSON Web App Response Pattern
```javascript
function doGet(e) {
  const data = { success: true, items: getItems() };
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Note: Can't set custom HTTP headers (no Cache-Control support)
```

### Quick Webhook Response (Avoid Timeout)
Services like Stripe/GitHub expect < 10s response. Defer heavy work:
```javascript
function doPost(e) {
  // Store request, process later
  CacheService.getScriptCache().put('webhook', e.postData.contents, 300);

  // Respond immediately
  return ContentService.createTextOutput('OK');
}

// Process webhook data via time-driven trigger
function processWebhooks() {
  const data = CacheService.getScriptCache().get('webhook');
  if (data) processData(JSON.parse(data));
}
```

---

## 12. Web Apps (doGet/doPost)

### Event Object Structure
```javascript
function doGet(e) {
  // e.parameter     - {name: "value"} - query params
  // e.parameters    - {name: ["val1", "val2"]} - multi-value params
  // e.queryString   - "name=value&other=123"
  // e.pathInfo      - path after /exec/ or /dev/
  // e.contextPath   - always empty string
  return ContentService.createTextOutput('OK');
}

function doPost(e) {
  // All of above plus:
  // e.postData.contents  - raw POST body
  // e.postData.type      - MIME type (e.g., "application/json")
  // e.postData.length    - content length
  const data = JSON.parse(e.postData.contents);
}
```

### Deployment: /exec vs /dev URLs
| URL | Behavior |
|-----|----------|
| `/exec` | Runs deployed version (stable) |
| `/dev` | Runs latest saved code (testing) - owner only |

**Important:** /exec and /dev have different script IDs - don't just change the suffix!

### Execute As Options
| Option | Session.getActiveUser() | Spreadsheet Access |
|--------|------------------------|-------------------|
| **Me** | Empty for non-owners | Uses owner's permissions |
| **User accessing** | Returns user's email | Uses user's permissions |

**Gotcha:** "Execute as me" + "Anyone with Google account" → user email is empty!

### Redirect Behavior
Web Apps redirect to `script.googleusercontent.com`. Configure HTTP clients to follow redirects:
```javascript
// External curl/fetch must handle 302 redirect
// Request → 302 to googleusercontent → Response
```

### State Tokens for OAuth Callbacks
```javascript
// Create callback URL for OAuth flows
const stateToken = ScriptApp.newStateToken()
  .withMethod('callback')
  .withArgument('userId', '123')
  .withTimeout(120)
  .createToken();

const callbackUrl = `https://script.google.com/macros/d/${ScriptApp.getScriptId()}/usercallback`;

// Store small data in state token (survives OAuth redirect)
```

### ScriptApp Token for Client Auth
```javascript
// Server-side: Get OAuth token for API calls
const token = ScriptApp.getOAuthToken();

// Pass to client for authorized requests
// SECURITY WARNING: Only do this for trusted clients!
// Token grants access to owner's data when "Execute as Me"

// Client-side: Use token in Authorization header
fetch(apiUrl, {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
});

// Scopes must be declared in appsscript.json:
// "oauthScopes": ["https://www.googleapis.com/auth/..."]
```

### JSONP for Cross-Origin GET (No CORS)
```javascript
function doGet(e) {
  const callback = e.parameter.callback || 'callback';
  const data = { items: getItems() };
  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(data)})`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
// Client: <script src="webapp?callback=myFunc"></script>
// WARNING: Only for non-sensitive, read-only data
```

### Versioned Deployments (Multiple URLs)
```javascript
// Production: Create versioned deployment → stable URL
// Staging: Create another versioned deployment → different URL
// Dev: Use /dev URL (no deployment needed, owner only)

// Update without changing URL:
// Manage Deployments → Edit → New Version → Deploy
```

---

## 13. UI Debugging Tips

### Where to Look for Errors
| Error Type | Where to Check |
|------------|----------------|
| Server-side (Code.gs) | Apps Script Execution Log |
| Client-side (HTML/JS) | Browser DevTools Console |
| Template errors | `template.getCode()` output |

### Common Symptoms & Fixes
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Sidebar blank | JS error in init | Check DevTools console |
| "undefined" in UI | Async timing issue | Await server calls |
| Slow sidebar load | Heavy libraries | Use lighter alternatives |
| Data not showing | Date/Function in payload | Stringify or exclude |
| Picker fails | Missing setOrigin | Add `google.script.host.origin` |
| "Mixed content" error | HTTP resource | Change to HTTPS |

### Loading State Pattern
```html
<div id="loading">Loading...</div>
<div id="content" style="display:none">...</div>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    google.script.run
      .withSuccessHandler(data => {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        render(data);
      })
      .withFailureHandler(err => {
        document.getElementById('loading').textContent = 'Error: ' + err.message;
      })
      .getData();
  });
</script>
```

### Spinner with CSS Animation
```html
<style>
  .spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { 100% { transform: rotate(360deg); } }
</style>
<div class="spinner"></div>
```
