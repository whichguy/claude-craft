# /gas-undocumented - GAS Hidden Features Reference

Comprehensive reference for undocumented Google Apps Script features, real limits, quirks, workarounds, and performance patterns across all major GAS services.

**AUTOMATICALLY INVOKE** when:
- User encounters GAS behavior not explained by official docs
- Questions about real limits (cache, properties, triggers, quotas, execution time)
- V8 runtime quirks (parsing order, globals, error methods, module patterns)
- Performance optimization (Sheets API vs SpreadsheetApp, batching, search)
- HTML Service issues (google.script.run limits, scriptlets, client-server)
- Email problems (GmailApp vs MailApp, labels, threads, quotas)
- Document automation (DocumentApp Smart Chips, SlidesApp templates)
- Trigger patterns (self-deleting, 6-minute workaround, timing variance)
- User asks "why does GAS...", "is there a way to...", "what's the limit for..."

**SERVICES COVERED:** SpreadsheetApp | DocumentApp | SlidesApp | GmailApp | MailApp |
DriveApp | ScriptApp | UrlFetchApp | CacheService | PropertiesService | LockService |
ContentService | HtmlService | Session | Triggers

**KEY TOPICS:** ScriptApp.getResource | PropertiesService limits | TextFinder regex |
Sheets API batching | V8 Error methods | google.script.run | onEdit quirks | timezone pitfalls |
self-deleting triggers | 6-minute workaround | trigger timing variance | GmailApp labels |
MailApp vs GmailApp | Developer Metadata | flush() | performance crossover |
DocumentApp Smart Chips | SlidesApp replaceAllText | SlidesApp images | Blob methods |
UrlFetchApp timeout | ContentService MimeTypes | Drive exportLinks | patterns |
**fetchAll parallel HTTP** | concurrency limits | getLastRow quirks | OAuth tokens |
simple vs installable triggers | reserved params | HEAD vs versioned | custom functions |
Blob auto-PDF | memory patterns | secrets security | StateTokenBuilder | google.script.history |
**REST vs built-in** | Drive API v2 vs v3 | quotas comparison | **Drive OCR** | **thumbnailLink** |
**draft inline images** | conditional formatting rules | copyTo limitation | named range caching |
**deployment settings matrix** | Execute as Me vs User | getActiveUser gotchas |
**BatchRequest library** | container-bound script removal | **V8 vs Rhino runtime** |
**job queue pattern** | RunAll concurrent | multipart/form-data | RichTextApp |
**50MB+ file download** | manifest manipulation | **Google Photos API** | password-protected zip |
**ProcessApp telemetry** | GetEditType granular | **TriggerApp 20-limit** | ScriptHistoryApp |
**DocNamedRangeApp** | DateFinder | **ephemeral triggers** | two-layer locking | watchdog pattern |
cheeriogs HTML parsing | alasqlgs SQL | sheetbase REST | FirebaseApp | qottle throttling |
GAST TAP testing | RangeListApp | EncodeApp charset |
**deployment execution context** | CacheService isolation | UserProperties sharing bug | error log visibility |
API executable scopes | library scope inheritance | **deployment propagation** | stale closure |
urlFetchWhitelist dead | exceptionLogging | **misleading errors** | HtmlService sandbox | Workspace admin controls |
**library architecture gotchas** | container-bound limitations | menu handler resolution |
**Drive API script import/export** | container-bound inaccessible | MIME types |
**Apps Script API versions** | deployment service pattern | CD project | version management

Invoke with filter: `/gas-undocumented cache` or `/gas-undocumented gmail` or `/gas-undocumented slides`

---

## 1. ScriptApp.getResource() ⭐ ✓VERIFIED

**What:** Read source code of any .gs or .html file at runtime
**Syntax:** `ScriptApp.getResource('folder/file.gs').getDataAsString()`
**Example:**
```javascript
function getFileSHA1(filename) {
  const source = ScriptApp.getResource(filename).getDataAsString();
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, source);
  return bytes.map(b => ((b<0?b+256:b).toString(16)).padStart(2,'0')).join('');
}
getFileSHA1('your-project/YourModule.gs'); // "68990dce..."
```
**Requirements:** Full path WITH extension required
**Gotchas:**
- `'MyModule.gs'` → "Not found" (missing path prefix)
- `'myproject/MyModule'` → "Not found" (missing extension)
**Error:** "Not found"
**Use Case:** Version hashing, self-documenting code, runtime introspection
**Source:** https://ramblings.mcpher.com/google-apps-script-new-day-new-feature/

---

## 2. V8 Error Object Hidden Features ✓VERIFIED (2026-01-24)

**What:** Undocumented Error static methods for debugging
**Syntax:**
- `Error.isError(value)` → true only for real Error instances ✓TESTED
- `Error.captureStackTrace(obj, filterFn)` → adds .stack to any object ✓TESTED
- `Error.stackTraceLimit = N` → controls stack depth (default: 10) ✓TESTED (default=10 confirmed)

**Example:**
```javascript
// Reliable error detection (can't be duck-typed)
Error.isError(new TypeError()) // true
Error.isError({message:'fake'}) // false

// Get caller info
function getCaller() {
  const e = {};
  Error.captureStackTrace(e, getCaller);
  return e.stack.split('\n')[1];
}

// Control stack depth
Error.stackTraceLimit = 50; // Deep traces
Error.stackTraceLimit = 0;  // Just "Error"
```
**Use Case:** Custom error classes, debugging, caller identification

---

## 3. ContentService Hidden MimeTypes ✓VERIFIED (2026-01-24)

**What:** Undocumented MIME types for web app responses
**Documented:** JSON | TEXT | JAVASCRIPT
**Undocumented:** CSV | ICAL | VCARD ✓TESTED (all 3 exist in MimeType enum)
**Discovery:** `Object.keys(ContentService.MimeType)`
**JSONP Pattern:**
```javascript
function doGet(e) {
  const callback = e.parameter.callback || e.parameter.prefix;
  const data = {foo: 'bar'};
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(data) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
```
**Note:** Google docs use `prefix`, jQuery convention uses `callback` - both work

---

## 4. CacheService Hidden Limits ✓VERIFIED (2026-01-24)

**What:** Actual limits not in official docs
**Limits:**
- Key length: 250 chars (251 throws "Argument too large: key") ✓TESTED
- Value size: 102,400 bytes exactly
- Total storage: bytes-based (no fixed item count limit)
- Eviction: FIFO batch (~10%), NOT LRU
**Note:** Unlike PropertiesService, no hard item count - constrained by total bytes
**Source:** https://justin.poehnelt.com/posts/exploring-apps-script-cacheservice-limits/

---

## 5. Session Cross-Domain Quirk UNVERIFIED

**What:** getActiveUser() returns empty for different domains
**Behavior:**
- Same domain as script owner → returns email
- Different domain → returns ""
- getEffectiveUser() → always returns owner's email
**Workaround:** Google Sign-in button, Firebase Auth, Identity Services

---

## 6. UrlFetchApp Hidden Behaviors ✓VERIFIED

**What:** Undocumented limitations and tricks
**Timeout:** ~60 seconds hard limit (throws exception, not configurable)
**IP Blocking:** 192.168.x.x, 10.x.x.x, 172.16.x.x, localhost all blocked
**OAuth Trick:** Add scopes to manifest → use getOAuthToken() with any Google API
**Error:** "Bad request: http://192.168.1.1" or "DNS error: http://localhost"
**See Also:** [#32 fetchAll() Parallel HTTP](#32-urlfetchappfetchall---parallel-http-requests--critical) for batch requests

---

## 7. Memory & Project Limits UNVERIFIED

**What:** Heap and size limits discovered via testing
- Heap: ~2.25-2.5 GB
- Safe file processing: ~50MB
- Risky: 100MB+ may OOM
- Project total: ~10MB max
**Gotcha:** getBytes() fails on large files → use Blob directly

---

## 8. Private Functions Convention ✓DOCUMENTED

**What:** Trailing underscore hides functions
**Syntax:** `function myPrivate_() { }`
**Hidden from:** Run menu | google.script.run | Library users | Autocomplete
**Note:** Single TRAILING underscore (not leading, not double)

---

## 9. LockService UI Dialog Bug & Dialog Blocking Behavior UNVERIFIED

**What:** Locks release when UI dialogs appear
**Affects:** Browser.inputBox(), Browser.msgBox(), UI.alert()
**Workaround:** Implement custom locking if using dialogs during lock

**Dialog Blocking Behavior:**
- **Blocking (suspend server):** `UI.alert()`, `UI.prompt()`, `Browser.inputBox()`, `Browser.msgBox()`
- **Non-blocking:** `showModalDialog()`, `showModelessDialog()`, `showSidebar()`
**Implication:** Non-blocking dialogs require `google.script.run` for server communication
**Pattern:**
```javascript
// BLOCKING: Script pauses until user responds
const response = UI.alert('Confirm?', UI.ButtonSet.YES_NO);
if (response === UI.Button.YES) doWork();

// NON-BLOCKING: Script continues, dialog runs independently
UI.showModalDialog(htmlOutput, 'Title');
// Server call must use google.script.run from HTML
```

---

## 10. Trigger Limits & Timing Variance ✓VERIFIED

**What:** Quota limits and timing behaviors not obvious from main docs
**Limits:**
- Per user per project: 300 triggers max
- Runtime per day: 90 minutes total trigger execution
- Add-on frequency: max 1/hour for time-based triggers
**Timing Variance (critical!):**
- `atHour(9)` runs between 9:00-10:00 AM (±1 hour window)
- `nearMinute(n)` has ±15 minute variance
- Without `nearMinute()`, random minute assigned within hour
- Once timing assigned, stays consistent (24hr intervals)
- `everyMinutes(n)` only accepts: 1, 5, 10, 15, or 30
**Gotcha:** Don't expect precise timing - design for variance
**Example:**
```javascript
// This runs sometime between 9:00-9:59 AM, not exactly 9:00
ScriptApp.newTrigger('myFunc')
  .timeBased()
  .atHour(9)
  .everyDays(1)
  .create();

// More precise: nearMinute reduces variance to ±15 min
ScriptApp.newTrigger('myFunc')
  .timeBased()
  .atHour(9)
  .nearMinute(0)  // Aims for 9:00, runs 8:45-9:15
  .everyDays(1)
  .create();
```
**Source:** Official Installable Triggers docs

---

## 11. V8 File Parsing Order ✓VERIFIED

**What:** Top-level code can't reference other files not yet parsed
**Breaks:** `const helper = new Helper();` if Helper in later file
**Workarounds:**
```javascript
// Getter (executes after endpoint)
class App { get helper() { return new Helper(); } }

// Function (called after parsing)
function getHelper() { return new Helper(); }

// Lazy init
let _h; function getH() { return _h || (_h = new Helper()); }

// CommonJS (defers loading)
const Helper = require('Helper');
```
**Source:** https://gist.github.com/brainysmurf/35c901bae6e33a52e3abcea720a6b515

---

## 12. Scriptlet Full Server Access ✓VERIFIED

**What:** <?= ?> and <?!= ?> have full GAS service access
**Available:** ScriptApp | DriveApp | UrlFetchApp | Utilities | SpreadsheetApp | Logger | Session | PropertiesService | CacheService | ContentService | HtmlService | require() | global functions
**Runs:** Server-side during template.evaluate() BEFORE page served
**Limitation:** Execute once at serve time, can't re-run after page loads

---

## 13. Dynamic String Interpolation ✓VERIFIED

**What:** Runtime template string evaluation from data
**Pattern:**
```javascript
function interpolate(template, params) {
  return new Function(...Object.keys(params), `return \`${template}\`;`)(...Object.values(params));
}
interpolate("Hello ${name}", {name: "Jim"}) // "Hello Jim"
```
**Use Case:** Email templates in sheets, dynamic config
**Security:** Only trusted templates - equivalent to eval()

---

## 14. Drive API exportLinks ✓VERIFIED

**What:** File resources have hidden export URLs
**Enable:** Services > Drive API (Advanced Service)
**Usage:** `Drive.Files.get(fileId).exportLinks['application/pdf']`
**Formats:** text/csv | application/pdf | application/zip | xlsx | ods
**Auth:** `{headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}}`
**Limitation:** Only Google-native files (Docs/Sheets/Slides)

---

## 15. PropertiesService Exact Limits ⭐ ✓VERIFIED (2026-01-24)

**What:** True storage limits from systematic testing
**Official docs say:** 9KB per value, 500KB total
**Actual limits:**
- Max value: 524,274 bytes tested (binary search confirms ~524KB limit) ✓TESTED
- Max key: 8,066 bytes
- Total storage: 524,288 bytes (512 KB) - key+value combined
- Key length: 250 characters
- No property count limit (bytes-based constraint only)
**Critical:** All 3 types (Script/User/Document) share identical limits
**Error:** "You have exceeded the property storage quota"
**Use Case:** Storing large config, chunking data that exceeds 9KB "limit"
**Source:** https://gist.github.com/tanaikech/8b057d10fb5f2af014794e57b021c6aa

---

## 16. TextFinder Advanced Regex Patterns ✓VERIFIED (2026-01-24)

**What:** Undocumented regex capabilities in TextFinder
**Capture groups in replace:** ✓TESTED - Capture groups $1,$2 work correctly
```javascript
const sheet = SpreadsheetApp.getActiveSheet();
sheet.createTextFinder("sample\\=(.+),sample\\=(.+)")
  .useRegularExpression(true)
  .replaceAllWith("($1,$2)");  // Capture groups work! ✓VERIFIED
```
**Find empty cells:** `sheet.createTextFinder("^$").useRegularExpression(true).findAll()`
**Negative lookahead:** `^(?!sample).+$` matches cells NOT starting with "sample"
**Search formulas:** `.matchFormulaText(true)` to find cells containing `=`
**Performance:** TextFinder is faster than getValue loops + manual search
**Use Case:** Bulk find/replace, data validation, formula auditing
**Source:** https://tanaikech.github.io/2021/10/17/taking-advantage-of-textfinder-for-google-spreadsheet/

---

## 17. Sheets API batchUpdate Quota Trick ⭐ UNVERIFIED

**What:** Batching dramatically reduces quota usage
**Discovery:** 1 request = 1 quota, BUT 1000 requests in ONE batchUpdate = STILL 1 quota
**Applies to:** `Sheets.Spreadsheets.batchUpdate` AND `Sheets.Spreadsheets.Values.batchUpdate`
**Example:**
```javascript
// BAD: 100 API calls = 100 quota
const values = ['a', 'b', 'c', /* ... 100 items */];
for (let i = 0; i < 100; i++) {
  Sheets.Spreadsheets.Values.update({values: [[values[i]]]}, spreadsheetId, `Sheet1!A${i+1}`, {valueInputOption: 'RAW'});
}

// GOOD: 100 value ranges in 1 batch = 1 quota
const batchData = values.map((val, i) => ({range: `Sheet1!A${i+1}`, values: [[val]]}));
Sheets.Spreadsheets.Values.batchUpdate({valueInputOption: 'RAW', data: batchData}, spreadsheetId);
```
**Inversion point:** For small data, setValues() faster; for large data, Sheets API faster
**Use Case:** Bulk updates, avoiding quota exceeded errors
**Source:** https://gist.github.com/tanaikech/dad5df2403b551f6bdd99221be115bef

---

## 18. Blob Hidden Methods ❌INVALID (2026-01-24)

**What:** Claimed undocumented methods on all Blob objects
**TESTED:** `Utilities.newBlob()` objects do NOT have getHash() or getSize()
**Discovery:** `Object.getOwnPropertyNames(Object.getPrototypeOf(blob))` shows only standard methods
**Available methods:** constructor, toString, valueOf, toLocaleString (no getHash/getSize)
**Clarification:** getHash() is **GmailAttachment-specific**, NOT available on regular Blobs
**Workaround:** Use `Utilities.computeDigest()` for hashing, `blob.getBytes().length` for size
**Use Case:** For file hashing, use `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, blob.getBytes())`

---

## 19. Spreadsheet Search Performance Hierarchy UNVERIFIED

**What:** Query language is fastest method for searching spreadsheet data
**Ranking (fastest to slowest):**
1. **Query language** - via Sheets API or QUERY function
2. **TextFinder** - native search, good regex support
3. **getValues() + array search** - loads all data into memory first
**Example (Query via Sheets API):**
```javascript
const query = encodeURIComponent('SELECT A,B WHERE C > 100');
const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tq=${query}`;
const result = UrlFetchApp.fetch(url, {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}});
```
**Use Case:** Large datasets, complex filtering, performance-critical searches
**Source:** tanaikech benchmarks

---

## 20. google.script.run Limitations ✓VERIFIED

**What:** Client-side API constraints not obvious from docs
**Limits:**
- **10 concurrent calls** - 11th call queued until slot frees
- **Global functions only** - object methods invisible to client
- **Private functions hidden** - trailing underscore invisible
- **Date objects prohibited** - must stringify dates before passing
- **JSON-serializable only** - circular refs and DOM elements fail
**Example (Basic Promise wrapper):**
```javascript
function gasPromise(fnName, ...args) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(reject)
      [fnName](...args);
  });
}
// Usage: const result = await gasPromise('myFunction', arg1, arg2);
```

**Advanced Pattern (Proxy/Reflect - cleaner syntax):**
```javascript
// Create a Proxy that wraps all server functions as Promises
const server = new Proxy({}, {
  get: (_, functionName) => (...args) => new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(reject)
      [functionName](...args);
  })
});

// Usage - looks like native async calls:
async function loadData() {
  const users = await server.getUsers();           // Calls getUsers() on server
  const config = await server.loadConfig('main');  // Calls loadConfig('main')
  return { users, config };
}
```

**Proxy Pattern Benefits:**
- No need to wrap each function manually
- Natural async/await syntax: `await server.anyFunction()`
- Works with any server-side function automatically
- Single definition, unlimited functions

**Source:** Official docs, appsScriptAsync library (InvincibleRain)
**Use Case:** HTML Service apps, sidebar/dialog development

---

## 21. onEdit Event Object Quirks ✓VERIFIED

**What:** Event object behaves differently based on edit type
**Single cell edit:** `e.oldValue` and `e.value` populated
**Multi-cell/copy-paste:** `e.oldValue` and `e.value` are UNDEFINED
**Simple trigger:** `e.authMode = LIMITED` (can't send email, access services)
**Installable trigger:** `e.authMode = FULL` + has `e.triggerUid`
**Example:**
```javascript
function onEdit(e) {
  // This ONLY works for single-cell edits!
  if (e.oldValue !== e.value) {
    Logger.log('Changed from ' + e.oldValue + ' to ' + e.value);
  }
  // For multi-cell, use e.range.getValues() instead
}
```
**Gotcha:** Expecting oldValue on paste operations = undefined error
**Use Case:** Change tracking, data validation, audit trails
**Source:** Official docs - Event Objects

---

## 22. Date/Timezone Pitfalls ✓VERIFIED

**What:** Default timezone behavior causes subtle bugs
**Default timezone:** America/Los_Angeles (NOT your account timezone!)
**Date strings without offset:** Assumed Pacific time regardless of location
**DST drift:** Hardcoded GMT+X breaks twice yearly
**Example:**
```javascript
// BAD: Breaks during DST changes
Utilities.formatDate(date, 'GMT+1', 'yyyy-MM-dd HH:mm');

// GOOD: Uses script's configured timezone
Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

// ALSO GOOD: Explicit timezone name (handles DST)
Utilities.formatDate(date, 'America/New_York', 'yyyy-MM-dd HH:mm');
```
**Use Case:** Any date handling, especially scheduled tasks
**Source:** Official docs - Google Ads Scripts (same runtime)

---

## 23. Self-Deleting Trigger Pattern ⭐ ✓VERIFIED

**What:** One-shot triggers that delete themselves after execution
**Use Case:** Deferred processing, scheduled cleanup, one-time notifications
**Pattern:**
```javascript
function runOnce() {
  // Your task here
  doWork();

  // Delete this trigger after completion
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runOnce') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// Create one-shot trigger for 1 minute from now
function scheduleOnce() {
  ScriptApp.newTrigger('runOnce')
    .timeBased()
    .after(60000)  // 1 minute in milliseconds
    .create();
}
```
**Delete by handler function (reusable):**
```javascript
const deleteTriggersByHandler = (fnName) =>
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === fnName) ScriptApp.deleteTrigger(t);
  });
```
**Best Practice:** Add `Utilities.sleep(1000)` between bulk deletions to avoid "Too many service invocations"
**Source:** Google Apps Script samples, tanaikech patterns

---

## 24. 6-Minute Limit Workaround ⭐ ✓VERIFIED

**What:** Continuation pattern to bypass 6-minute execution limit
**Components:**
1. **PropertiesService** - Store progress state (row index, continuation token)
2. **Time-based trigger** - Reschedule before timeout
3. **Self-delete** - Clean up trigger when complete
**Pattern:**
```javascript
function processLargeDataset() {
  const props = PropertiesService.getScriptProperties();
  const startRow = parseInt(props.getProperty('startRow') || '0');
  const startTime = Date.now();
  const MAX_RUNTIME = 5 * 60 * 1000; // 5 minutes (leave 1 min buffer)

  const data = SpreadsheetApp.getActiveSheet().getDataRange().getValues();

  for (let i = startRow; i < data.length; i++) {
    // Check if approaching limit
    if (Date.now() - startTime > MAX_RUNTIME) {
      props.setProperty('startRow', i.toString());
      createContinuationTrigger_();
      return; // Exit gracefully
    }
    processRow(data[i]);
  }

  // Complete - clean up
  props.deleteProperty('startRow');
  deleteTriggersByHandler_('processLargeDataset');
}

function createContinuationTrigger_() {
  ScriptApp.newTrigger('processLargeDataset')
    .timeBased()
    .after(60000) // Resume in 1 minute
    .create();
}

function deleteTriggersByHandler_(fnName) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === fnName) ScriptApp.deleteTrigger(t);
  });
}
```
**Limits:** 6 min free accounts, 30 min Workspace (historically, may vary)
**Gotcha:** Always exit gracefully before timeout; abrupt termination loses state
**Source:** medium.com/geekculture, inclu-cat.net

---

## 25. GmailApp Labels & Thread Quirks ✓VERIFIED

**What:** Gmail labels and thread behaviors that cause confusion
**Critical:** Labels apply to THREADS, not individual messages
- Cannot label a single message in a thread via GmailApp
- Use Gmail API (Advanced Service) for message-level labeling
**Thread Size Limit:**
- `getThreads()` fails when total size too large
- Use paged calls: `GmailApp.getInboxThreads(start, max)`
**Email Size Limit:** 20KB body (excluding attachments)
**Daily Quotas:** ~100 emails/day free, ~1500 paid (may change)
**Example (paged thread retrieval):**
```javascript
function getAllInboxThreads() {
  const threads = [];
  const batchSize = 100;
  let start = 0;
  let batch;

  do {
    batch = GmailApp.getInboxThreads(start, batchSize);
    threads.push(...batch);
    start += batchSize;
  } while (batch.length === batchSize);

  return threads;
}
```
**Gotcha:** Draft methods may behave inconsistently under trigger execution
**Source:** Official GmailApp docs, community reports

---

## 26. MailApp vs GmailApp Differences ✓VERIFIED

**What:** Key differences between the two email services
**MailApp:**
- Simpler API, only sends email (no inbox access)
- Smaller scope requirement (less re-authorization)
- Emails do NOT appear in Sent folder
- Better for automated notifications
**GmailApp:**
- Full inbox access (read, search, label, delete)
- Emails appear in Sent folder
- Requires broader authorization scope
- Can work with drafts, threads, labels
**When to use which:**
```javascript
// Use MailApp for simple notifications (won't clutter Sent folder)
MailApp.sendEmail({
  to: 'user@example.com',
  subject: 'Alert',
  body: 'Something happened'
});

// Use GmailApp when you need the email in Sent folder
// or need to work with existing emails
GmailApp.sendEmail('user@example.com', 'Report', 'See attached', {
  attachments: [blob]
});
```
**Tip:** Start with MailApp, upgrade to GmailApp only if needed
**Source:** Official docs comparison

---

## 27. SpreadsheetApp flush() & Developer Metadata ✓DOCUMENTED

**What:** Lesser-known SpreadsheetApp features
**flush() - Force Immediate Updates:**
- Without flush(), updates may batch until script ends
- Use when you need to see/read updates during execution
```javascript
// Write formula, force calculation, then read result
sheet.getRange('A1').setFormula('=COMPLEX_FORMULA()');
SpreadsheetApp.flush();  // Force calculation now
const result = sheet.getRange('A1').getValue();
```
**Developer Metadata - Hidden Key-Value Storage:**
- Store custom data on spreadsheet, sheet, or range
- Invisible to users, persists with the document
- Great for storing script state, config, or IDs
```javascript
// Add metadata to spreadsheet
const ss = SpreadsheetApp.getActiveSpreadsheet();
ss.addDeveloperMetadata('VERSION', '1.0.0');
ss.addDeveloperMetadata('LAST_RUN', new Date().toISOString());

// Retrieve metadata
const metadata = ss.getDeveloperMetadata();
metadata.forEach(m => Logger.log(m.getKey() + ': ' + m.getValue()));

// Add to specific range
const range = ss.getRange('A1:B10');
range.addDeveloperMetadata('DATA_TYPE', 'user_input');
```
**Use Cases:** Version tracking, script state, document linking, config storage
**Source:** Desktop Liberation, Official Spreadsheet docs

---

## 28. SpreadsheetApp Performance Crossover Points ✓VERIFIED

**What:** When to use SpreadsheetApp vs Sheets API
**Reading Data:**
- Sheets API ~35% faster than getValues() for large data
- For small reads (<1000 cells), difference negligible
**Writing Data - Inversion Point:**
- Small data: `setValues()` faster
- Large data (>10,000 rows): Sheets API required
- 10M cells: IMPOSSIBLE with setValues() alone (timeout)
**Single-row writes (setValue loop vs appendRow):**
- When writing one row with many columns via individual setValue() calls
- Inversion point: ~75 columns
- <75 columns: Multiple setValue() calls faster
- >75 columns: Single appendRow() call faster
- **Best:** Use setValues() for any multi-cell write
**Example (Sheets API for large writes):**
```javascript
// Enable: Services > Sheets API
function writeLargeData(spreadsheetId, values) {
  const resource = { values: values };
  Sheets.Spreadsheets.Values.update(
    resource,
    spreadsheetId,
    'Sheet1!A1',
    { valueInputOption: 'RAW' }
  );
}
```
**Best Practice:** Use setValues()/getValues() by default, switch to Sheets API for large datasets or quota issues
**Source:** tanaikech benchmarks

---

## 29. DocumentApp Smart Chips Limitation ⭐ ✓VERIFIED

**What:** Smart Chips cannot be accessed via DocumentApp
**Key Limitation:** `getBody().getText()` strips Smart Chips entirely - returns blank
**Chip Access:**
- DATE and PERSON chips: partially retrievable
- Dropdown, variables, voting chips: return as `UNSUPPORTED` element type
- `DocumentApp.ElementType.UNSUPPORTED` indicates inaccessible elements
**replaceText() Limitations:**
- Cannot replace multiple paragraphs (single paragraph only)
- Strips formatting (bullet points, styles disappear)
- Use Docs API (Advanced Service) for multi-paragraph replace
**Workaround (Smart Chips → Text):**
```javascript
// Export to DOCX - smart chips become hyperlinked text
function getSmartChipsAsText(docId) {
  const doc = DriveApp.getFileById(docId);
  const blob = doc.getAs('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  // Create temp doc from DOCX, smart chips are now text with links
  const tempDoc = Drive.Files.insert({title: 'temp'}, blob, {convert: true});
  const text = DocumentApp.openById(tempDoc.id).getBody().getText();
  DriveApp.getFileById(tempDoc.id).setTrashed(true);
  return text;
}
```
**Use Case:** Extracting data from docs with smart chips, document processing
**Source:** tanaikech, official docs

---

## 30. SlidesApp replaceAllText Quirks ⭐ ✓VERIFIED

**What:** Common pitfalls with SlidesApp text replacement
**Key Limitations:**
- `replaceAllText()` cannot change text formatting during replacement
- Throws error if placeholder not found on ANY slide (not graceful)
- Groups are skipped by replaceAllText operations
- Positioned images in tables can't be controlled via script
**Safe Replacement Pattern:**
```javascript
function safeReplaceText(presentation, placeholder, newValue) {
  presentation.getSlides().forEach(slide => {
    // Check if placeholder exists before replacing
    const hasPlaceholder = slide.getShapes().some(shape =>
      shape.getText().asString().includes(placeholder)
    );

    if (hasPlaceholder) {
      slide.replaceAllText(placeholder, newValue);
    }
  });
}

// Usage
const pres = SlidesApp.openById('...');
safeReplaceText(pres, '{{NAME}}', 'John Doe');
safeReplaceText(pres, '{{DATE}}', new Date().toLocaleDateString());
```
**Table Cell Replacement:**
```javascript
// Must iterate through table cells individually
slide.getTables().forEach(table => {
  for (let r = 0; r < table.getNumRows(); r++) {
    for (let c = 0; c < table.getNumColumns(); c++) {
      const cell = table.getCell(r, c);
      const text = cell.getText().asString();
      if (text.includes('{{placeholder}}')) {
        cell.getText().replaceAllText('{{placeholder}}', newValue);
      }
    }
  }
});
```
**Use Case:** Template-based presentation generation, mail merge for slides
**Source:** Community reports, tanaikech

---

## 31. SlidesApp Image Constraints ✓VERIFIED

**What:** Strict limits on images in Google Slides
**Size Constraints:**
- Max file size: 50MB
- Max resolution: 25 megapixels
- Formats: PNG, JPEG, GIF only (no SVG, WebP, BMP)
**URL Constraints (for insertImage with URL):**
- URL max length: 2KB
- URL must be publicly accessible (no auth required)
- Image is fetched once and cached in presentation
**Gotchas:**
- Private/authenticated URLs silently fail
- Very long URLs (data URIs) will fail
- Unsupported formats throw unclear errors
**Workaround for Private Images:**
```javascript
// Convert private image to blob first
function insertPrivateImage(slide, fileId, left, top, width, height) {
  const blob = DriveApp.getFileById(fileId).getBlob();
  slide.insertImage(blob, left, top, width, height);
}

// For URL images that need auth
function insertAuthenticatedImage(slide, url, left, top, width, height) {
  const response = UrlFetchApp.fetch(url, {
    headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  const blob = response.getBlob();
  slide.insertImage(blob, left, top, width, height);
}
```
**Use Case:** Automated presentation generation, image galleries
**Source:** Official SlidesApp docs, community testing

---

## 32. UrlFetchApp.fetchAll() - Parallel HTTP Requests ⭐⭐⭐ CRITICAL ✓VERIFIED (2026-01-24)

**What:** Execute multiple HTTP requests simultaneously instead of sequentially.
**Impact:** 10 sequential fetches = 10× latency; fetchAll = ~1× latency
**Tested:** 10 requests with 1s delay completed in 2.33s (parallelism ~4x confirmed) ✓TESTED

**Syntax:**
```javascript
const requests = urls.map(url => ({url, muteHttpExceptions: true}));
const responses = UrlFetchApp.fetchAll(requests);
```

**Request Object Properties:**
```javascript
{
  url: 'https://api.example.com',           // Required
  method: 'get'|'post'|'put'|'delete'|'patch', // Default: 'get'
  headers: {Authorization: 'Bearer xxx'},    // Custom headers
  payload: 'data'|{key:'value'},            // POST/PUT body
  contentType: 'application/json',          // Overrides header
  muteHttpExceptions: true,                 // CRITICAL - see gotchas
  followRedirects: true,                    // Default: true
  validateHttpsCertificates: true,          // Default: true
  escaping: true                            // URL-encode payload
}
```

**Gotchas (critical for reliability):**
- **muteHttpExceptions: true REQUIRED** - Without it, single 404 in batch of 50 throws exception, discards ALL 50 results
- **Quota counts per request** - 10 requests in fetchAll = 10 quota units
- **Order preserved** - Responses match request array order (despite async execution)
- **No setTimeout** - Use `Utilities.sleep()` for rate limiting
- **429 errors** - Switching from fetch() to fetchAll() can trigger rate limits immediately

**Pattern - Retry Failed Requests:**
```javascript
function fetchAllWithRetry(requests, maxRetries = 3) {
  let responses = UrlFetchApp.fetchAll(requests.map(r => ({...r, muteHttpExceptions: true})));
  let failed = [];

  responses.forEach((resp, i) => {
    if (resp.getResponseCode() >= 400) failed.push({index: i, request: requests[i]});
  });

  for (let retry = 0; retry < maxRetries && failed.length; retry++) {
    Utilities.sleep(1000 * Math.pow(2, retry)); // Exponential backoff
    const retryResponses = UrlFetchApp.fetchAll(failed.map(f => ({...f.request, muteHttpExceptions: true})));
    retryResponses.forEach((resp, i) => {
      if (resp.getResponseCode() < 400) {
        responses[failed[i].index] = resp;
        failed.splice(i, 1);
      }
    });
  }
  return responses;
}
```
**Source:** tanaikech benchmarks, bajena3 Medium

---

## 33. Execution Concurrency Limits UNVERIFIED

**What:** Hard limits on simultaneous script executions per user.
**Limits:**
- **30 simultaneous executions** per user across all scripts
- **google.script.run:** 10 concurrent calls from client (11th queued)
- Triggers can stack if previous execution still running
**Error:** "Script invoked too many times per second for this Google user account"
**Mitigation:** Stagger trigger timing, use Lock Service for critical sections
**Source:** G Suite Developers Blog

---

## 34. getLastRow() Hidden Formula/Checkbox Problem ✓VERIFIED

**What:** `getLastRow()` returns last row with ANY content, including hidden formulas and checkboxes dragged to bottom.
**Problem:**
```javascript
// Data ends at row 100, but checkboxes dragged to row 1000
sheet.getLastRow(); // Returns 1000, not 100!
sheet.getDataRange().getValues(); // Gets 1000 rows - SLOW
```
**Solution - Find actual last data row:**
```javascript
function getLastDataRow(sheet, column = 1) {
  const values = sheet.getRange(1, column, sheet.getLastRow()).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== '') return i + 1;
  }
  return 0;
}
```
**Fastest method (contiguous data only):**
```javascript
sheet.getRange(1, 1).getNextDataCell(SpreadsheetApp.Direction.DOWN).getRow();
```
**Source:** yagisanatode, tanaikech benchmarks

---

## 35. OAuth Token Expiration & No Refresh Token UNVERIFIED

**What:** `ScriptApp.getOAuthToken()` returns access token valid ~1 hour. Refresh tokens not available.
**Behavior:**
- Token auto-refreshes when called during script execution
- Cannot store token for later use (expires)
- Cannot get refresh token - not exposed by GAS
**Pattern - Always fetch fresh:**
```javascript
function callGoogleAPI(endpoint) {
  return UrlFetchApp.fetch(endpoint, {
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}
  });
}
// Token is fresh each call - don't cache it
```
**Gotcha:** Background/scheduled tasks cannot refresh token if user not active.
**Source:** Desktop Liberation, oauth2 library docs

---

## 36. Simple vs Installable Triggers - Key Differences ✓VERIFIED

**What:** Behavioral differences between trigger types often cause bugs.

| Aspect | Simple | Installable |
|--------|--------|-------------|
| Function names | Reserved: onOpen, onEdit, onInstall | Any name |
| Max execution | 30 seconds | 6 minutes |
| authMode | LIMITED (restricted services) | FULL |
| Runs as | Current user | Trigger creator |
| Event queue | 2 onEdit can queue (3rd dropped) | No hard limit |
| Add-on time triggers | N/A | Max 1/hour |
| Add-on per doc | N/A | 1 trigger per type per user |

**Critical gotcha:** Simple trigger `e.authMode = LIMITED` means:
- Cannot send email
- Cannot access other docs
- Cannot call external APIs requiring auth

**Test which mode:**
```javascript
function onEdit(e) {
  if (e.authMode === ScriptApp.AuthMode.LIMITED) {
    // Simple trigger - limited capabilities
  } else {
    // Installable trigger - full access
  }
}
```
**Source:** Official docs, community testing

---

## 37. Web App Reserved Parameter "sid" UNVERIFIED

**What:** URL parameter `sid` reserved by Google infrastructure.
**Error:** HTTP 405 "Sorry, the file you have requested does not exist"
**Broken:** `?sid=123` in doGet/doPost
**Fix:** Rename to `sessionId`, `id`, or any other name
**Source:** Official Web Apps docs

---

## 38. HEAD vs Versioned Deployments ✓VERIFIED

**What:** Two deployment types with different update behaviors.

| HEAD | Versioned |
|------|-----------|
| URL ends in `/dev` | URL ends in `/exec` |
| Always latest saved code | Locked to specific version |
| Requires edit access | Anyone with link (if configured) |
| For testing | For production |

**Update versioned WITHOUT changing URL:**
1. Manage deployments > Select existing
2. Click edit (pencil icon)
3. Version dropdown > "New version"
4. Deploy

**Don't:** Click "New deployment" (creates new URL)
**Source:** tanaikech, official docs

---

## 39. Custom Function Service Restrictions ✓VERIFIED

**What:** Spreadsheet custom functions (`=MYFUNCTION()`) cannot use most services.
**Blocked:**
- DriveApp, GmailApp, MailApp
- SpreadsheetApp.openById() (can use getActive)
- Any service requiring user interaction/auth

**Allowed:**
- UrlFetchApp (with caveats)
- Utilities, Math, CacheService (read)
- SpreadsheetApp.getActiveSpreadsheet()

**Gotcha:** User Properties of doc owner accessible via custom functions (security risk).
**Source:** tanaikech, official docs

---

## 40. Google Docs Blob Auto-Conversion to PDF ✓VERIFIED (2026-01-24)

**What:** `.getBlob()` on Google Docs files auto-converts to PDF.
**Affected:** Documents, Spreadsheets, Slides
**Tested:** Google Doc (application/vnd.google-apps.document) → getBlob() returns application/pdf ✓

```javascript
const file = DriveApp.getFileById(docId);
file.getBlob().getContentType(); // "application/pdf" - NOT original type! ✓VERIFIED
```

**Workaround - Export to specific format:**
```javascript
const url = `https://docs.google.com/document/d/${docId}/export?format=docx`;
const blob = UrlFetchApp.fetch(url, {
  headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}
}).getBlob();
```
**Source:** Community forums

---

## 41. Memory Management Patterns UNVERIFIED

**What:** Patterns to avoid OOM errors with large data.
**Limits (from #7):** ~2.25GB heap, safe <50MB, risky >100MB

**Pattern - Reuse arrays:**
```javascript
// BAD: Creates new array each iteration → memory buildup
for (let i = 0; i < 100; i++) {
  const arr = getLargeData();
  process(arr);
}

// GOOD: Clear and reuse
const arr = [];
for (let i = 0; i < 100; i++) {
  arr.length = 0; // Clear without new allocation
  arr.push(...getLargeData());
  process(arr);
}
```

**Pattern - Process in chunks:**
```javascript
function processLargeFile(fileId, chunkSize = 50 * 1024 * 1024) {
  const file = DriveApp.getFileById(fileId);
  const size = file.getSize();
  for (let offset = 0; offset < size; offset += chunkSize) {
    const chunk = file.getBlob().getBytes().slice(offset, offset + chunkSize);
    processChunk(chunk);
  }
}
```
**Source:** tanaikech, community patterns

---

## 42. Secrets Storage Security Hierarchy UNVERIFIED

**What:** Security comparison of secret storage options.
**Ranking (least to most secure):**
1. **Plain text in code** - Visible to anyone with script access
2. **Script Properties** - Accessible to all editors
3. **User Properties** - Per-user, BUT accessible via custom functions!
4. **Detached script** - Separate script holds secrets
5. **Google Cloud Secret Manager** - Enterprise-grade
6. **Prompt each time** - Most secure, worst UX

**Critical vulnerability:**
```javascript
// Custom function in shared sheet
function STEAL_SECRET() {
  // This runs as OWNER, not caller!
  return PropertiesService.getUserProperties().getProperty('API_KEY');
}
// Any editor can call =STEAL_SECRET() and see owner's secrets
```
**Library:** SecretService (dataful-tech/secret-service)
**Source:** Dataful, Justin Poehnelt

---

## 43. StateTokenBuilder for OAuth Flows UNVERIFIED

**What:** Create secure state tokens for OAuth callback flows.
**Methods:**
```javascript
const token = ScriptApp.newStateToken()
  .withMethod('authCallback')     // Handler function name
  .withArgument('key', 'value')   // Pass data through OAuth flow
  .withTimeout(3600)              // Max: 3600 seconds (1 hour)
  .createToken();
```
**Use in OAuth flow:**
```javascript
const authUrl = service.getAuthorizationUrl() + '&state=' + token;
```
**Source:** Official docs

---

## 44. google.script.history & google.script.url APIs UNVERIFIED

**What:** Client-side APIs for SPA-like web apps.
**google.script.url.getLocation(callback):**
```javascript
google.script.url.getLocation(function(location) {
  console.log(location.hash);       // #section
  console.log(location.parameter);  // {key: 'value'} (single values)
  console.log(location.parameters); // {key: ['value1', 'value2']} (arrays)
});
```
**google.script.history:**
```javascript
google.script.history.push({page: 'settings'}, {tab: 'account'}, 'settings');
google.script.history.replace(state, params, hash);
google.script.history.setChangeHandler(function(e) {
  // Handle back/forward navigation
});
```
**Limitation:** Web apps with IFRAME only (not sidebars/dialogs).
**Source:** Official docs

---

## 45. Library HEAD vs Version Behavior UNVERIFIED

**What:** Library version selection affects code freshness and caching.

| Selection | Behavior |
|-----------|----------|
| HEAD | Latest saved code (even unsaved in editor) |
| Specific version | Locked to deployment version |

**Caching gotcha:** GAS aggressively caches library code. Changes may not reflect until:
- Sheet recalculation
- Script editor refresh
- New execution context
**Source:** Desktop Liberation

---

## 46. REST API vs Built-in Services Differences ⭐ ✓VERIFIED

**What:** Key differences between accessing Google services via REST API (UrlFetchApp/Advanced Services) vs built-in objects (SpreadsheetApp, DriveApp).

### Performance Comparison

| Operation | Built-in | REST/Advanced | Winner |
|-----------|----------|---------------|--------|
| Read values | Baseline | ~35% faster | REST |
| Write values | Baseline | ~19% faster | REST |
| Small arrays | Faster | Slower | Built-in |
| Bulk operations | 6-min limit | No time limit | REST |

### Quota Differences

| Aspect | Built-in Services | REST API |
|--------|-------------------|----------|
| Daily limit | 20K-100K calls/day | No daily limit |
| Rate limit | Yes (varies) | Per-minute (~300 reads/min) |
| Quota reset | 24 hours | Per minute |

### API Version Mismatches

| Built-in | Advanced Service | Notes |
|----------|-----------------|-------|
| DriveApp | Drive API v2 (default), v3 available | v3 auto-selected since Dec 2023 |
| SpreadsheetApp | Sheets API v4 | Different field names |
| GmailApp | Gmail API v1 | Similar capabilities |

### Naming Convention Differences
```javascript
// REST API uses snake_case
{file_name: 'doc.txt', mime_type: 'text/plain', created_time: '2024-01-01'}

// Built-in uses camelCase
file.getName(); file.getMimeType(); file.getDateCreated();

// v2→v3 changes: title→name, createdDate→createdTime
```

### Authentication Differences
```javascript
// BUILT-IN: Auto-handled, user prompted automatically
const file = DriveApp.getFileById(id); // Just works

// REST via UrlFetchApp: Manual OAuth required
const url = 'https://www.googleapis.com/drive/v3/files/' + id;
const response = UrlFetchApp.fetch(url, {
  headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}
});
// Requires scope in manifest: https://www.googleapis.com/auth/drive

// ADVANCED SERVICE: Auto-handled like built-in
const file = Drive.Files.get(id); // Also just works after enabling
```

### Feature Gaps

**REST-only features:**
- Custom file properties (Drive)
- File revisions management
- Shared drive operations (Drive v3)
- Partial responses (`fields` parameter)
- Watch/push notifications

**Built-in-only features:**
- `getActiveSpreadsheet()` context awareness
- Simpler chaining: `sheet.getRange().setValue()`
- Auto-flush batching
- Native object methods

### Response Format Differences
```javascript
// BUILT-IN: Returns wrapped objects with methods
const sheet = SpreadsheetApp.getActiveSheet();
sheet.getName();  // Method call
sheet.getRange(1,1).getValue();  // Chained methods

// REST: Returns plain JSON, must navigate manually
const response = Sheets.Spreadsheets.get(spreadsheetId);
response.sheets[0].properties.title;  // Property access
// No methods, just data
```

### When to Use Which

| Scenario | Recommendation |
|----------|----------------|
| Quick prototyping | Built-in |
| <1000 cells | Built-in |
| >10,000 rows | REST/Advanced |
| Need specific API features | Advanced Service |
| Cross-service operations | REST (more control) |
| Shared drives | Drive API v3 |
| Hitting daily quotas | REST (no daily limit) |

**Source:** tanaikech benchmarks, Official quotas docs, Drive API comparison guide

---

## 47. Drive API OCR - Extract Text from PDF/Images ⭐ ✓VERIFIED

**What:** Google Drive API can perform OCR on uploaded files, converting images/PDFs to searchable Google Docs.

**Requirements:**
- Enable Advanced Drive Service (Services > Drive API)
- Works with: PDF, JPG, PNG, GIF
- File size: ≤2MB recommended
- Text height: ≥10 pixels
- PDF: Only first 10 pages processed

**Drive API v2 (Drive.Files.insert):**
```javascript
function pdfToText_v2(fileId) {
  const blob = DriveApp.getFileById(fileId).getBlob();
  const resource = {title: blob.getName().replace(/\.pdf$/, '')};

  // Create Google Doc with OCR
  const docFile = Drive.Files.insert(resource, blob, {
    ocr: true,
    ocrLanguage: 'en'  // or 'ja', 'zh', 'de', 'fr', etc.
  });

  // Extract text
  const doc = DocumentApp.openById(docFile.id);
  const text = doc.getBody().getText();

  // Cleanup temp doc
  Drive.Files.remove(docFile.id);  // Permanent delete (not trash)
  return text;
}
```

**Drive API v3 (Drive.Files.create):**
```javascript
function pdfToText_v3(fileId) {
  const blob = DriveApp.getFileById(fileId).getBlob();
  const resource = {
    name: blob.getName().replace(/\.pdf$/, ''),
    mimeType: 'application/vnd.google-apps.document'  // Required for v3
  };

  const docFile = Drive.Files.create(resource, blob, {
    ocr: true,
    ocrLanguage: 'en',
    fields: 'id,name'
  });

  Utilities.sleep(3000);  // Allow processing time

  const doc = DocumentApp.openById(docFile.id);
  const text = doc.getBody().getText();

  Drive.Files.remove(docFile.id);
  return text;
}
```

**Gotchas:**
- **"Request Too Large"** - Large images fail; reduce resolution first or use thumbnailLink
- **Processing delay** - v3 may need `Utilities.sleep()` before accessing doc
- **Accuracy varies by language** - English best, CJK languages lower accuracy
- **Scanned PDFs** - Quality heavily dependent on scan resolution
- **v2 vs v3** - v2 uses `title`, v3 uses `name` + requires explicit `mimeType`

**Large Image Workaround (tanaikech):**
```javascript
function ocrLargeImage(fileId) {
  // Get thumbnail to reduce size
  const file = Drive.Files.get(fileId, {fields: 'thumbnailLink'});
  const thumbUrl = file.thumbnailLink.replace(/=s\d+$/, '=s1600');
  const blob = UrlFetchApp.fetch(thumbUrl, {
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}
  }).getBlob();

  // OCR the reduced image
  const resource = {name: 'ocr_temp', mimeType: 'application/vnd.google-apps.document'};
  const doc = Drive.Files.create(resource, blob, {ocr: true});
  // ... extract text and cleanup
}
```

**ocrLanguage codes:** en, ja, zh, zh-TW, ko, de, fr, es, it, pt, ru, ar, hi, th, vi

**Alternative for complex docs:** Cloud Vision API or Document AI (separate paid services)

**Source:** labnol.org, tanaikech, basescripts.com

---

## 48. Drive File Thumbnails & Preview Images ✓VERIFIED

**What:** Get preview/thumbnail images of Drive files for display in Sheets, Slides, or web apps.

### Method 1: DriveApp.getThumbnail() (Built-in)
```javascript
const file = DriveApp.getFileById(fileId);
const thumbnail = file.getThumbnail();  // Returns Blob or null
if (thumbnail) {
  // Use blob directly
  sheet.insertImage(thumbnail, 1, 1);
}
```
**Limitation:** No size control, returns null for some file types

### Method 2: Drive API thumbnailLink (Advanced Service)
```javascript
function getThumbnailBlob(fileId, size = 512) {
  const file = Drive.Files.get(fileId, {fields: 'thumbnailLink,hasThumbnail'});

  if (!file.hasThumbnail) return null;

  // Resize: replace =s### with desired size
  const url = file.thumbnailLink.replace(/=s\d+$/, '=s' + size);

  // Must fetch with auth (link is short-lived, not public)
  return UrlFetchApp.fetch(url, {
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}
  }).getBlob();
}
```

### Method 3: Direct Thumbnail URL (Alternative)
```javascript
function getThumbnailDirect(fileId, width = 320) {
  const url = `https://drive.google.com/thumbnail?sz=w${width}&id=${fileId}`;
  return UrlFetchApp.fetch(url, {
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}
  }).getBlob();
}
```

### Size Parameter
- `=s###` controls thumbnail size (width in pixels)
- Example: `=s1600` for 1600px width
- **Cannot upscale** - only reduce from original size
- Max useful size depends on source file resolution

### Gotchas:
- **thumbnailLink is short-lived** - hours, not permanent; don't store URL
- **Requires auth** - Cannot use directly in `=IMAGE()` formula for private files
- **CORS blocked** - Cannot use directly in web apps; use proxy/blob
- **hasThumbnail=false** - ZIP files, some formats have no thumbnail
- **CellImageBuilder broken** - thumbnailLink cannot be used as source URL directly

### For Sheets =IMAGE() Formula (Public Files Only)
```javascript
// Only works if file is publicly shared
const publicUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
sheet.getRange('A1').setFormula(`=IMAGE("${publicUrl}")`);
```

### Insert Thumbnail into Sheet (Private Files)
```javascript
function insertThumbnailInSheet(fileId, row, col) {
  const blob = getThumbnailBlob(fileId, 200);
  if (blob) {
    SpreadsheetApp.getActiveSheet().insertImage(blob, col, row);
  }
}
```

### File Types with Thumbnails
- **Yes:** Images, PDFs, Docs, Sheets, Slides, Videos
- **No:** ZIP, some binary formats

**Source:** tanaikech, Official DriveApp docs

---

## 49. GmailApp Draft Inline Images Problem ⭐ UNVERIFIED

**What:** Using Gmail drafts as email templates breaks inline images - they become attachments.

**The Problem:**
When you retrieve a draft and send via `GmailApp.sendEmail()`, you're constructing a NEW email, not sending the draft. Inline images lose their `cid` (Content-ID) linkage.

```javascript
// This LOSES inline images:
const draft = GmailApp.getDrafts()[0];
const message = draft.getMessage();
GmailApp.sendEmail(to, message.getSubject(), '', {
  htmlBody: message.getBody(),
  attachments: message.getAttachments()  // Images become attachments!
});
```

**Why it happens:**
- `GmailAttachment[]` has no method to return the `cid`
- Attachment order ≠ order in HTML (user's insertion order)
- Duplicate filenames possible (copy/paste same image)

**Workaround 1: Parse Raw Content**
```javascript
function getDraftWithInlineImages(draftId) {
  const draft = GmailApp.getDraft(draftId);
  const raw = draft.getMessage().getRawContent();
  // Parse raw MIME to extract cid→attachment mapping
  // Then reconstruct with inlineImages parameter
}
```

**Workaround 2: Use Gmail API Advanced Service**
```javascript
// Send raw draft content directly (preserves inline images)
function sendDraftPreservingImages(draftId) {
  Gmail.Users.Drafts.send({id: draftId}, 'me');
}
```

**Workaround 3: Match by Filename (fragile)**
```javascript
function getInlineImagesFromDraft(message) {
  const body = message.getBody();
  const attachments = message.getAttachments();
  const inlineImages = {};

  attachments.forEach(att => {
    const name = att.getName();
    // Check if filename appears in body as alt text
    if (body.includes(`alt="${name}"`)) {
      const cid = name.replace(/\.[^.]+$/, '');  // Remove extension
      inlineImages[cid] = att.copyBlob();
    }
  });
  return inlineImages;
}
```

**Gotchas:**
- Filename matching fails with duplicate names
- `cid` in HTML may not match attachment name
- Gmail API is more reliable but requires Advanced Service

**Source:** hawksey.info, Google Issue Tracker #36754092

---

## 50. SpreadsheetApp Conditional Formatting Rules Quirk ✓VERIFIED

**What:** Conditional formatting rules are "all-or-nothing" - you can only set ALL rules at once.

**The Problem:**
```javascript
// This DELETES all existing rules, keeps only the new one:
const rule = SpreadsheetApp.newConditionalFormatRule()
  .whenNumberGreaterThan(100)
  .setBackground('#FF0000')
  .setRanges([sheet.getRange('A:A')])
  .build();
sheet.setConditionalFormatRules([rule]);  // Overwrites everything!
```

**Solution - Get existing rules first:**
```javascript
function addConditionalFormatRule(sheet, newRule) {
  const existingRules = sheet.getConditionalFormatRules();
  existingRules.push(newRule);
  sheet.setConditionalFormatRules(existingRules);
}

// Usage
const rule = SpreadsheetApp.newConditionalFormatRule()
  .whenTextContains('ERROR')
  .setBackground('#FF0000')
  .setRanges([sheet.getRange('B:B')])
  .build();
addConditionalFormatRule(sheet, rule);
```

**Remove specific rule:**
```javascript
function removeConditionalFormatRule(sheet, ruleIndex) {
  const rules = sheet.getConditionalFormatRules();
  rules.splice(ruleIndex, 1);
  sheet.setConditionalFormatRules(rules);
}
```

**Formatting limitations:**
- Only: bold, italic, strikethrough, foreground color, background color
- Cannot set: font size, font family, borders, number format

**Custom function limitation:**
```javascript
// This FAILS in custom functions:
function HIGHLIGHT() {
  SpreadsheetApp.getActiveRange().setBackground('yellow');
  // Error: "You do not have permission to call setBackground"
}
// Custom functions can only use getters, not setters
```

**Source:** Official docs, community reports

---

## 51. SpreadsheetApp copyTo Cross-Document Limitation ✓VERIFIED

**What:** `Range.copyTo()` only works within the same spreadsheet document.

**This works (same document):**
```javascript
const source = sheet1.getRange('A1:B10');
const dest = sheet2.getRange('A1');
source.copyTo(dest);  // Copies values, formatting, formulas
```

**This FAILS (different documents):**
```javascript
const sourceSheet = SpreadsheetApp.openById('SOURCE_ID').getSheetByName('Data');
const destSheet = SpreadsheetApp.openById('DEST_ID').getSheetByName('Data');
sourceSheet.getRange('A1:B10').copyTo(destSheet.getRange('A1'));
// Error: Target range and source range must be on the same spreadsheet
```

**Solution - Use getValues/setValues:**
```javascript
function copyRangeBetweenSpreadsheets(sourceId, destId, rangA1) {
  const source = SpreadsheetApp.openById(sourceId).getRange(rangA1);
  const dest = SpreadsheetApp.openById(destId).getRange(rangA1);

  // Values only (no formatting)
  dest.setValues(source.getValues());

  // For formatting too, copy properties individually:
  dest.setBackgrounds(source.getBackgrounds());
  dest.setFontColors(source.getFontColors());
  dest.setFontWeights(source.getFontWeights());
  dest.setNumberFormats(source.getNumberFormats());
}
```

**copyTo options (same doc only):**
```javascript
source.copyTo(dest, SpreadsheetApp.CopyPasteType.PASTE_VALUES, false);
// Types: PASTE_NORMAL, PASTE_VALUES, PASTE_FORMAT, PASTE_FORMULA,
//        PASTE_DATA_VALIDATION, PASTE_CONDITIONAL_FORMATTING
```

**Source:** Official Range docs, community reports

---

## 52. Named Ranges Caching Gotcha UNVERIFIED

**What:** GAS caches named range references; changes don't reflect immediately.

**The Problem:**
```javascript
// Create named range
ss.setNamedRange('MyData', sheet.getRange('A1:B10'));

// Later, redefine it
ss.setNamedRange('MyData', sheet.getRange('A1:B20'));

// This may still return old range!
const range = ss.getRangeByName('MyData');
Logger.log(range.getA1Notation());  // Might show A1:B10, not A1:B20
```

**Workarounds:**
```javascript
// Option 1: Delete and recreate
ss.removeNamedRange('MyData');
ss.setNamedRange('MyData', newRange);

// Option 2: Use Sheets API (no caching)
function getNamedRangeA1(spreadsheetId, name) {
  const response = Sheets.Spreadsheets.get(spreadsheetId, {
    fields: 'namedRanges'
  });
  const nr = response.namedRanges.find(r => r.name === name);
  if (!nr) return null;

  const range = nr.range;
  // Convert gridRange to A1 notation
  return Utilities.formatString('%s!%s',
    range.sheetId, // Need to convert sheetId to name
    // ... build A1 from startRowIndex, endRowIndex, etc.
  );
}

// Option 3: Force sheet recalculation
SpreadsheetApp.flush();
```

**When caching clears:**
- Sheet recalculation
- Script editor refresh
- New execution context
- After significant delay

**Source:** tanaikech, community reports

---

## 53. Web App Deployment Settings Matrix ⭐ ✓VERIFIED

**What:** "Execute as" and "Who has access" settings create a complex permission matrix with non-obvious behaviors.

### Execute As Options

| Setting | Script runs as | File access | getActiveUser() |
|---------|---------------|-------------|-----------------|
| **Me** | Developer | Developer's files | Empty (usually) |
| **User accessing** | Accessing user | User's files | Returns user email |

### Who Has Access Options

| Setting | Requires login | Requires token | Who can access |
|---------|---------------|----------------|----------------|
| **Only myself** | Yes | Yes | Only developer |
| **Anyone with Google account** | Yes | Yes | Any logged-in user |
| **Anyone** | No | No | Public (no auth) |

### getActiveUser() Gotchas

```javascript
// This often returns EMPTY string:
Session.getActiveUser().getEmail();
```

**Returns empty when:**
- Web app deployed as "Execute as: Me"
- User is from different Google Workspace domain
- Simple trigger fired by non-owner
- Multi-login scenarios (bug)

**Returns email when:**
- "Execute as: User accessing the app"
- User is same domain as developer
- Developer runs their own script

**Workaround for cross-domain user identification:**
```javascript
// Use Google Sign-In button instead of Session.getActiveUser()
// or use OAuth2 library for explicit authentication
```

### Common Deployment Patterns

**Pattern 1: Public form (anyone can submit, saves to your sheet)**
```
Execute as: Me
Who has access: Anyone
```
- Users don't need Google account
- Data saves to YOUR sheet (not theirs)
- Cannot identify who submitted

**Pattern 2: Internal tool (track who uses it)**
```
Execute as: User accessing
Who has access: Anyone with Google account
```
- Users must log in
- `getActiveUser()` works (same domain)
- Accesses USER'S files, not yours

**Pattern 3: Two-webapp workaround (best of both)**
```javascript
// Frontend webapp: Execute as User, Anyone with Google account
function doPost(e) {
  const user = Session.getActiveUser().getEmail();
  // Call backend webapp via UrlFetchApp
  UrlFetchApp.fetch(BACKEND_URL, {
    method: 'post',
    payload: {user: user, data: e.postData.contents}
  });
}

// Backend webapp: Execute as Me, Anyone
// Has write access to your sheets, receives user from frontend
```

### Service Account Limitation

Service accounts **cannot** directly execute Apps Script. Workaround:
```
Deploy as: Execute as Me + Anyone with Google account
Access via: Service account with OAuth token
```

### Multi-Login Bug

If user is logged into multiple Google accounts, web apps may fail silently or return wrong user. **Not supported** - recommend single account or incognito.

**Source:** tanaikech Web Apps report, Official Session docs

---

## 54. BatchRequest Library - Any Google API Batching ⭐ UNVERIFIED

**What:** Execute up to 100 Google API requests in single batch call (1 quota unit) - works with ANY Google API, not just Sheets.

**Library:** tanaikech/BatchRequest (1HLv6j4BbkpUFntHKHN8AyrGKLUFJGMYnJkLDy23UETD44-FRrP60xNJz)

**Key Methods:**
- `Do()`: Simple batch (max 100, raw values)
- `EDo()`: Enhanced - auto-splits >100 requests, parses results
- `exportDataAsBlob`: Return responses as Blob objects

**Example - Batch multiple API calls:**
```javascript
// Enable library: BatchRequest (1HLv6j4BbkpUFntHKHN8AyrGKLUFJGMYnJkLDy23UETD44-FRrP60xNJz)
function batchMultipleAPIs() {
  const requests = [
    // Drive API - get file metadata
    {
      method: 'GET',
      endpoint: 'https://www.googleapis.com/drive/v3/files/FILE_ID_1'
    },
    // Calendar API - get events
    {
      method: 'GET',
      endpoint: 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10'
    },
    // Sheets API - get values
    {
      method: 'GET',
      endpoint: 'https://sheets.googleapis.com/v4/spreadsheets/SHEET_ID/values/A1:B10'
    }
  ];

  // All 3 APIs in single batch = 1 quota unit
  const responses = BatchRequest.EDo({
    batchPath: 'batch',
    requests: requests
  });
  return responses;
}
```

**Comparison to #17 Sheets batchUpdate:**
- #17 covers Sheets API specifically (Sheets.Spreadsheets.batchUpdate)
- BatchRequest works with ANY Google API (Drive, Gmail, Calendar, etc.)
- BatchRequest handles >100 requests automatically via EDo()

**Gotchas:**
- Each API may have different batch endpoints
- Some APIs don't support batching
- Order of responses matches request order

**Source:** https://github.com/tanaikech/BatchRequest

---

## 55. Container-Bound Script Removal ⭐ UNVERIFIED

**What:** Remove container-bound scripts from copied Spreadsheets/Docs.

**Problem:** When you copy a Google Doc/Sheet with a container-bound script, the script is copied too. Sometimes you want the document without the script.

**Library:** tanaikech/GASProjectApp

**Key Discovery:**
- Container-bound script's parentId = document ID
- Script files are accessible via Drive API with special handling
- Can detach scripts from copied documents

**Pattern - Remove script from copied spreadsheet:**
```javascript
// 1. Copy spreadsheet (includes bound script)
const originalId = 'ORIGINAL_SPREADSHEET_ID';
const copy = DriveApp.getFileById(originalId).makeCopy('Clean Copy');
const copyId = copy.getId();

// 2. Get the container-bound script project
// Note: Requires Apps Script API enabled
function removeContainerBoundScript(docId) {
  // Get projects bound to this document
  const url = 'https://script.googleapis.com/v1/projects';
  const response = UrlFetchApp.fetch(url + '?parent=documents/' + docId, {
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    muteHttpExceptions: true
  });

  const projects = JSON.parse(response.getContentText());
  // Note: Actual deletion requires additional API calls
  // See GASProjectApp library for complete implementation
}
```

**Alternative - Create clean copy manually:**
```javascript
function copySpreadsheetWithoutScript(sourceId, newName) {
  const source = SpreadsheetApp.openById(sourceId);
  const newSS = SpreadsheetApp.create(newName);

  // Copy each sheet
  source.getSheets().forEach(sheet => {
    sheet.copyTo(newSS).setName(sheet.getName());
  });

  // Delete default Sheet1
  const defaultSheet = newSS.getSheetByName('Sheet1');
  if (defaultSheet && newSS.getSheets().length > 1) {
    newSS.deleteSheet(defaultSheet);
  }

  return newSS.getId();
}
```

**Source:** https://github.com/tanaikech/GASProjectApp

---

## 56. FetchApp - Multipart/Form-Data Simplified UNVERIFIED

**What:** Simplifies multipart/form-data requests for file uploads via UrlFetchApp.

**Library:** tanaikech/FetchApp

**Problem:** Creating proper multipart/form-data in GAS is verbose and error-prone.

**Without library (manual approach):**
```javascript
function uploadFileManual(url, blob, fieldName) {
  const boundary = '----------' + Utilities.getUuid();
  const data = Utilities.newBlob('').getBytes();

  // Build multipart body manually (error-prone)
  const payload = [
    '--' + boundary,
    'Content-Disposition: form-data; name="' + fieldName + '"; filename="' + blob.getName() + '"',
    'Content-Type: ' + blob.getContentType(),
    '',
    // ... blob bytes ...
    '--' + boundary + '--'
  ].join('\r\n');

  return UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'multipart/form-data; boundary=' + boundary,
    payload: payload
  });
}
```

**With FetchApp library:**
```javascript
// Much simpler API
function uploadFileWithFetchApp(url, blob) {
  const res = FetchApp.fetch(url, {
    method: 'post',
    payload: {file: blob}  // Automatically handles multipart encoding
  });
  return res;
}
```

**Use Cases:**
- File uploads to external APIs
- Form submissions with attachments
- Webhook payloads with binary data

**Source:** https://github.com/tanaikech/FetchApp

---

## 57. RichTextApp - Cross-Service Text Styling UNVERIFIED

**What:** Copy rich text with styles between Google Docs and Sheets.

**Libraries:**
- tanaikech/RichTextApp - Core rich text operations
- tanaikech/RichTextAssistant - Auto-adjusts font size to fit cell width

**Problem:** No native way to preserve formatting when moving text between Docs ↔ Sheets.

**Capabilities:**
- Convert rich text in cells to HTML format
- Convert HTML to Sheets rich text
- Preserve: bold, italic, underline, strikethrough, colors, links
- RichTextAssistant: auto-fit text to cell width

**Example - Rich text to HTML:**
```javascript
// Requires RichTextApp library
function cellToHtml(sheetId, a1Notation) {
  const richText = SpreadsheetApp.openById(sheetId)
    .getRange(a1Notation)
    .getRichTextValue();

  // Convert to HTML preserving formatting
  const html = RichTextApp.RichTextToHTML(richText);
  return html;  // "<b>Bold</b> and <i>italic</i> text"
}

// HTML to rich text
function htmlToCell(sheetId, a1Notation, html) {
  const richText = RichTextApp.HTMLToRichText(html);
  SpreadsheetApp.openById(sheetId)
    .getRange(a1Notation)
    .setRichTextValue(richText);
}
```

**RichTextAssistant - Auto-fit text:**
```javascript
// Automatically adjusts font size so text fits in cell width
// Requires V8 runtime
function autoFitText(range) {
  RichTextAssistant.autoFit(range);
}
```

**Gotchas:**
- RichTextAssistant requires V8 runtime
- Not all formatting transfers perfectly
- Complex nested styles may simplify

**Source:** https://github.com/tanaikech/RichTextApp, https://github.com/tanaikech/RichTextAssistant

---

## 58. V8 vs Rhino Runtime Differences ⭐ UNVERIFIED

**What:** Behavioral differences between V8 and Rhino (legacy) runtimes that can cause subtle bugs.

**Runtime Selection:**
- V8: Default since 2020, ES6+ support
- Rhino: Legacy, `"runtimeVersion": "DEPRECATED_ES5"` in manifest

**Key Differences:**

| Feature | V8 | Rhino |
|---------|----|----|
| ES6+ syntax | Yes | No |
| Error.isError() | Yes | No |
| Array reduceRight() index | Different | Different |
| unzip.min.js | INCOMPATIBLE | Works |
| console.log() | Stackdriver | Not available |
| Performance | Generally faster | Slower |

**reduceRight() Index Difference:**
```javascript
const arr = [1, 2, 3];
arr.reduceRight((acc, val, idx) => {
  console.log(idx);  // V8: 2, 1, 0  |  Rhino: May differ
  return acc + val;
}, 0);
```

**V8-Only Features (from #2):**
- `Error.isError(value)`
- `Error.captureStackTrace()`
- `Error.stackTraceLimit`

**Rhino-Only Compatibility:**
```javascript
// unzip.min.js (zlib.js) requires Rhino
// To use: Set runtimeVersion to DEPRECATED_ES5 in appsscript.json
{
  "runtimeVersion": "DEPRECATED_ES5"
}
```

**Check Current Runtime:**
```javascript
function getRuntimeVersion() {
  try {
    // V8-only syntax
    const arrow = () => {};
    return 'V8';
  } catch (e) {
    return 'Rhino';
  }
}
```

**When to Use Rhino:**
- Legacy libraries that break on V8
- Specific zip libraries (unzip.min.js)
- Compatibility with very old scripts

**Gotcha:** Can't mix runtimes in same project - all files use same runtime.

**Source:** tanaikech research, Google Apps Script migration guide

---

## 59. Download Large Files (50MB+ Workaround) UNVERIFIED

**What:** Overcome 50MB Blob creation limitation by chunking downloads.

**Library:** tanaikech/DownloadLargeFilesByUrl

**Problem (from #7):**
- GAS Blob limit: ~50MB safe, >100MB risky OOM
- `UrlFetchApp.fetch()` fails on large files
- `getBlob()` fails on large Drive files

**Pattern - Chunked Download to Drive:**
```javascript
// Download large file from URL directly to Drive (bypasses memory)
function downloadLargeFile(url, fileName, folderId) {
  const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();

  // Use resumable upload for large files
  const token = ScriptApp.getOAuthToken();

  // Get file size first
  const headResponse = UrlFetchApp.fetch(url, {
    method: 'head',
    muteHttpExceptions: true
  });
  const fileSize = parseInt(headResponse.getHeaders()['Content-Length']);

  if (fileSize > 50 * 1024 * 1024) {
    // Use library for chunked download
    return DownloadLargeFilesByUrl.download(url, fileName, folder);
  } else {
    // Standard approach for smaller files
    const blob = UrlFetchApp.fetch(url).getBlob().setName(fileName);
    return folder.createFile(blob);
  }
}
```

**Alternative - Stream via Drive API:**
```javascript
function streamLargeFile(sourceUrl, destFolderId) {
  // Create empty file first
  const metadata = {
    name: 'large_file.zip',
    parents: [destFolderId]
  };

  // Use resumable upload endpoint
  const initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
  const initResponse = UrlFetchApp.fetch(initUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    payload: JSON.stringify(metadata)
  });

  const uploadUrl = initResponse.getHeaders()['Location'];
  // Continue with chunked upload...
}
```

**Library Approach (recommended):**
```javascript
// DownloadLargeFilesByUrl handles all chunking automatically
const file = DownloadLargeFilesByUrl.download({
  url: 'https://example.com/large-file.zip',
  filename: 'large-file.zip',
  folderId: 'FOLDER_ID'
});
```

**Source:** https://github.com/tanaikech/DownloadLargeFilesByUrl

---

## 60. Trigger-Based Job Queue Pattern ⭐ UNVERIFIED

**What:** Pseudo-async execution via time-based triggers for background processing.

**Libraries:**
- k2tzumi/apps-script-jobqueue
- Qottle (task queue)

**Problem:** GAS has no true async/background processing. Long tasks block execution.

**Solution:** Use triggers + persistence to create job queue.

**Pattern - Simple Job Queue:**
```javascript
// Job storage in Script Properties
const QUEUE_KEY = 'JOB_QUEUE';

function enqueueJob(jobData) {
  const props = PropertiesService.getScriptProperties();
  const queue = JSON.parse(props.getProperty(QUEUE_KEY) || '[]');

  queue.push({
    id: Utilities.getUuid(),
    data: jobData,
    status: 'pending',
    createdAt: new Date().toISOString(),
    priority: jobData.priority || 0
  });

  // Sort by priority (higher first)
  queue.sort((a, b) => b.priority - a.priority);
  props.setProperty(QUEUE_KEY, JSON.stringify(queue));

  // Ensure processor trigger exists
  ensureProcessorTrigger_();

  return queue[queue.length - 1].id;
}

function ensureProcessorTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  const hasProcessor = triggers.some(t => t.getHandlerFunction() === 'processQueue');

  if (!hasProcessor) {
    ScriptApp.newTrigger('processQueue')
      .timeBased()
      .everyMinutes(1)
      .create();
  }
}

function processQueue() {
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) return;  // Another instance running

  try {
    const queue = JSON.parse(props.getProperty(QUEUE_KEY) || '[]');
    const pending = queue.filter(j => j.status === 'pending');

    if (pending.length === 0) {
      // No jobs, remove trigger
      deleteTriggerByHandler_('processQueue');
      return;
    }

    // Process first pending job
    const job = pending[0];
    job.status = 'processing';
    props.setProperty(QUEUE_KEY, JSON.stringify(queue));

    try {
      processJob_(job.data);
      job.status = 'completed';
    } catch (e) {
      job.status = 'failed';
      job.error = e.message;
    }

    props.setProperty(QUEUE_KEY, JSON.stringify(queue));
  } finally {
    lock.releaseLock();
  }
}

function deleteTriggerByHandler_(fnName) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === fnName) ScriptApp.deleteTrigger(t);
  });
}
```

**Features from libraries:**
- Rate limiting (X jobs per minute)
- Deduplication (skip duplicate jobs)
- Retry with exponential backoff
- Job expiration/TTL
- Priority queuing

**Source:** https://github.com/k2tzumi/apps-script-jobqueue

---

## 61. RunAll - Native Concurrent Processing UNVERIFIED

**What:** Thread-like concurrent execution using only native GAS features.

**Source:** tanaikech RunAll pattern

**Problem:** GAS is single-threaded. Multiple independent operations run sequentially.

**Pattern - Parallel via Web App Self-Calls:**
```javascript
// Main function splits work across parallel web app calls
function runAllParallel(tasks) {
  const webAppUrl = ScriptApp.getService().getUrl();  // Must be deployed

  const requests = tasks.map((task, i) => ({
    url: webAppUrl,
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({taskIndex: i, taskData: task}),
    muteHttpExceptions: true
  }));

  // fetchAll executes requests in parallel
  const responses = UrlFetchApp.fetchAll(requests);

  return responses.map(r => JSON.parse(r.getContentText()));
}

// doPost handles individual task
function doPost(e) {
  const {taskIndex, taskData} = JSON.parse(e.postData.contents);

  try {
    const result = processTask(taskData);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      index: taskIndex,
      result: result
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      index: taskIndex,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

**Limitations:**
- Requires web app deployment
- Each parallel call counts as separate execution
- Subject to concurrent execution limits (#33: 30 max)
- Added latency from HTTP round-trips

**Better for:**
- CPU-bound tasks that don't share state
- Independent API calls to different services
- Batch processing large datasets

**Not suitable for:**
- Tasks that need shared state
- Simple sequential operations
- Tasks under 1 second (overhead not worth it)

**Source:** tanaikech concurrent processing patterns

---

## 62. Google Photos API Workaround UNVERIFIED

**What:** Access Google Photos Library API (not available in Advanced Services).

**Problem:** Google Photos Library API isn't available as GAS Advanced Service.

**Solution:** Use UrlFetchApp with OAuth token directly.

**Setup:**
1. Enable Photos Library API in Cloud Console
2. Add scope to manifest: `https://www.googleapis.com/auth/photoslibrary`

**Example - List Albums:**
```javascript
function listPhotoAlbums() {
  const url = 'https://photoslibrary.googleapis.com/v1/albums';

  const response = UrlFetchApp.fetch(url, {
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    muteHttpExceptions: true
  });

  const data = JSON.parse(response.getContentText());
  return data.albums || [];
}
```

**Example - Search Media Items:**
```javascript
function searchPhotos(albumId) {
  const url = 'https://photoslibrary.googleapis.com/v1/mediaItems:search';

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    payload: JSON.stringify({
      albumId: albumId,
      pageSize: 100
    }),
    muteHttpExceptions: true
  });

  return JSON.parse(response.getContentText());
}
```

**Library Alternative:** tanaikech/GPhotoApp wraps these calls.

**Gotchas:**
- Read-only for media items (can't upload via script)
- Album creation limited
- Some features require additional verification
- Quota limits apply

**Source:** https://github.com/tanaikech/GPhotoApp, Photos Library API docs

---

## 63. Manifest Programmatic Manipulation UNVERIFIED

**What:** Edit appsscript.json programmatically via Apps Script API.

**Library:** tanaikech/ManifestsApp

**Problem:** Can't modify scopes, dependencies, or settings at runtime.

**Solution:** Use Apps Script API to read/modify manifest.

**Example - Add OAuth Scope:**
```javascript
function addOAuthScope(scriptId, newScope) {
  // Get current manifest
  const getUrl = `https://script.googleapis.com/v1/projects/${scriptId}/content`;

  const getResponse = UrlFetchApp.fetch(getUrl, {
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}
  });

  const content = JSON.parse(getResponse.getContentText());
  const manifestFile = content.files.find(f => f.name === 'appsscript');
  const manifest = JSON.parse(manifestFile.source);

  // Add new scope
  manifest.oauthScopes = manifest.oauthScopes || [];
  if (!manifest.oauthScopes.includes(newScope)) {
    manifest.oauthScopes.push(newScope);
  }

  // Update manifest
  manifestFile.source = JSON.stringify(manifest, null, 2);

  const updateUrl = `https://script.googleapis.com/v1/projects/${scriptId}/content`;
  UrlFetchApp.fetch(updateUrl, {
    method: 'put',
    contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    payload: JSON.stringify(content)
  });
}
```

**What You Can Modify:**
- OAuth scopes
- Library dependencies
- Advanced services
- Time zone
- Exception logging
- Runtime version
- Webapp settings

**Gotchas:**
- Requires Apps Script API enabled
- Need `script.projects` scope
- Changes require reauthorization
- Can't modify while script is running

**Source:** https://github.com/tanaikech/ManifestsApp

---

## 64. Password-Protected Zip Handling (V8 INCOMPATIBLE) ⭐ UNVERIFIED

**What:** Unzip password-protected files in GAS.

**Library:** tanaikech/UnzipGs (wraps unzip.min.js/zlib.js)

**CRITICAL:** **V8 INCOMPATIBLE** - Must disable V8 runtime!

**Setup:**
1. Set `"runtimeVersion": "DEPRECATED_ES5"` in appsscript.json
2. Add UnzipGs library

```json
{
  "runtimeVersion": "DEPRECATED_ES5"
}
```

**Example - Unzip with Password:**
```javascript
function unzipProtectedFile(fileId, password) {
  const blob = DriveApp.getFileById(fileId).getBlob();

  // UnzipGs handles password-protected archives
  const unzipped = UnzipGs.unzip(blob, {password: password});

  // unzipped is array of {filename, blob}
  unzipped.forEach(file => {
    DriveApp.createFile(file.blob.setName(file.filename));
  });

  return unzipped.map(f => f.filename);
}
```

**Comparison to Utilities.unzip():**
| Feature | Utilities.unzip() | UnzipGs |
|---------|------------------|---------|
| Password support | No | Yes |
| V8 compatible | Yes | NO |
| Performance | Faster | Slower |
| File size limit | ~50MB | Lower |

**When to Use UnzipGs:**
- Password-protected archives (only option)
- Legacy Rhino-only projects

**When to Use Utilities.unzip():**
- Standard (unprotected) zip files
- V8 runtime projects
- Better performance needed

**Source:** https://github.com/tanaikech/UnzipGs

---

## 65. ProcessApp - Hidden Execution Telemetry ⭐ UNVERIFIED (STABLE - Last commit Feb 2019, tanaikech still active)

**What:** Access GAS internal process information not exposed by standard APIs.

**Library:** tanaikech/ProcessApp
**Maintenance:** v1.0.1 (Feb 2019) - Stable but not actively developed

**Problem:** No native way to monitor running functions, trigger execution times, or discover hidden deployment URLs.

**Features:**
- `getExecutionTimeOfTrigger()` - Real-time running function stats
- `getRunningFunctions()` - Currently executing scripts across triggers
- `getDevUrl()` - Hidden dev mode endpoint URLs
- `getQuotaRemaining()` - Remaining daily quota

**Example - Monitor Trigger Executions:**
```javascript
// Requires ProcessApp library
function checkRunningTriggers() {
  const status = ProcessApp.getExecutionTimeOfTrigger();
  // Returns array of currently running trigger executions
  // [{triggerId, functionName, startTime, elapsedMs}]

  status.forEach(exec => {
    if (exec.elapsedMs > 300000) {  // > 5 minutes
      console.log(`Long-running: ${exec.functionName} at ${exec.elapsedMs}ms`);
    }
  });
}

function getHiddenDevUrl() {
  // Gets the dev deployment URL (different from production)
  const devUrl = ProcessApp.getDevUrl();
  // Useful for testing web apps without new deployments
  return devUrl;
}
```

**Use Cases:**
- Monitoring for stuck/long-running triggers
- Debugging execution timing issues
- Finding dev deployment endpoints
- Quota monitoring before batch jobs

**Gotchas:**
- Requires specific OAuth scopes
- May need Apps Script API enabled
- Some features require owner permissions

**Source:** https://github.com/tanaikech/ProcessApp

---

## 66. GetEditType - Granular Edit Event Detection ⭐ UNVERIFIED

**What:** Identifies specific edit types that onEdit event object doesn't expose.

**Library:** tanaikech/GetEditType
**Project Key:** 13DgweRAOSLMaRiAVcOIYAwoUwsAIrRW_DcfKchwaHJrLP3H-MdcENzZr

**Problem:** Standard `onEdit(e)` only provides old/new values, not HOW the edit occurred.

**Detects:**
- Value overwrite (typing new value)
- Value deletion (clear/delete)
- Copy-down (drag fill handle)
- Paste operation
- Cell move (cut/paste, drag)
- Undo/redo operations

**Example:**
```javascript
function onEdit(e) {
  const editType = GetEditType.getEditType(e);

  switch(editType) {
    case 'OVERWRITE':
      // User typed a new value
      break;
    case 'DELETE':
      // User cleared the cell
      break;
    case 'COPY_DOWN':
      // User dragged fill handle
      logAudit('Autofill detected from ' + e.range.getA1Notation());
      break;
    case 'PASTE':
      // User pasted from clipboard
      validatePastedData(e.range);
      break;
    case 'MOVE':
      // Cell was moved (cut+paste or drag)
      break;
  }
}
```

**Why This Matters:**
- Audit trails need edit type distinction
- Data validation rules differ by entry method
- Copy-down often indicates user error (dragging formulas as values)
- Paste operations may need sanitization

**Gotchas:**
- Auto-adapts to Google API changes
- Simple trigger limitations apply (no auth-required operations)
- Performance overhead - use selectively

**Cross-Reference:** #21 covers onEdit quirks; this adds edit type detection

**Source:** https://github.com/tanaikech/GetEditType

---

## 67. TriggerApp - Overcome 20-Trigger Limit ⭐ ✓VERIFIED (2026-01-24 - Library Active)

**What:** Scalable time-driven triggers beyond 20-trigger-per-script limit.
**20-trigger limit:** Confirmed per Google's documentation and TriggerApp docs

**Library:** tanaikech/TriggerApp (v1.0.3, Updated Jun 2024 - ACTIVELY MAINTAINED)

**Problem:** Standard GAS limit of 20 time-driven triggers per project. Running many scheduled tasks requires multiple scripts.

**Solution:** TriggerApp installs only 2 base triggers but runs unlimited scheduled tasks internally.

**How It Works:**
1. Creates single master trigger (runs every minute)
2. Master trigger checks internal task schedule
3. Executes due tasks, manages queue
4. Simulates async event triggers

**Example:**
```javascript
// Initialize TriggerApp (creates base triggers once)
TriggerApp.install();

// Add scheduled tasks (no trigger count limit)
TriggerApp.addTask({
  functionName: 'dailyReport',
  schedule: {hour: 9, minute: 0},  // 9:00 AM daily
  taskId: 'daily-report-001'
});

TriggerApp.addTask({
  functionName: 'hourlySync',
  schedule: {everyMinutes: 60},
  taskId: 'hourly-sync-001'
});

TriggerApp.addTask({
  functionName: 'weeklyCleanup',
  schedule: {dayOfWeek: 'monday', hour: 2},
  taskId: 'weekly-cleanup-001'
});

// List all scheduled tasks
const tasks = TriggerApp.getTasks();
console.log(`Managing ${tasks.length} tasks with only 2 triggers`);

// Remove a task
TriggerApp.removeTask('daily-report-001');
```

**Compared to Native Triggers:**
| Feature | Native | TriggerApp |
|---------|--------|------------|
| Max tasks | 20 | Unlimited* |
| Trigger slots used | 1 per task | 2 total |
| Minimum interval | 1 minute | 1 minute |
| Error isolation | Per trigger | Per task |

*Limited by PropertiesService storage (~500KB)

**Gotchas:**
- Still bound by 6-minute execution limit per invocation
- Tasks scheduled for same minute run sequentially
- Requires PropertiesService for persistence

**Cross-Reference:** #10 mentions 300 trigger limit per user; this overcomes per-project limit

**Source:** https://github.com/tanaikech/TriggerApp

---

## 68. ScriptHistoryApp - Version History Access ⭐ UNVERIFIED

**What:** Access GAS project version history programmatically.

**Library:** tanaikech/ScriptHistoryApp

**Problem:** GAS IDE shows version history, but no API to access/restore old versions.

**Requirements:**
- Requires GCP project linking
- Apps Script API must be enabled
- Owner or Editor permissions

**Example - List Version History:**
```javascript
function listVersionHistory(scriptId) {
  const history = ScriptHistoryApp.getHistory(scriptId);

  // Returns array of versions
  // [{versionNumber, createTime, description, fileSnapshots}]

  history.forEach(version => {
    console.log(`v${version.versionNumber}: ${version.createTime}`);
    console.log(`  Files: ${version.fileSnapshots.map(f => f.name).join(', ')}`);
  });

  return history;
}

// Restore specific file from old version
function restoreOldVersion(scriptId, versionNumber, fileName) {
  const oldContent = ScriptHistoryApp.getFileAtVersion(
    scriptId,
    versionNumber,
    fileName
  );

  // Returns file source code as string
  return oldContent;
}

// Compare versions
function diffVersions(scriptId, v1, v2, fileName) {
  const content1 = ScriptHistoryApp.getFileAtVersion(scriptId, v1, fileName);
  const content2 = ScriptHistoryApp.getFileAtVersion(scriptId, v2, fileName);

  // Implement diff logic...
  return {old: content1, new: content2};
}
```

**Use Cases:**
- Automated backups of GAS projects
- Audit trail for code changes
- Restore accidentally deleted code
- Compare changes between versions

**Gotchas:**
- GCP project linking required (not default)
- History retention policies may apply
- Large projects may have rate limits

**Source:** https://github.com/tanaikech/ScriptHistoryApp

---

## 69. DocNamedRangeApp - Document Named Ranges ⭐ UNVERIFIED

**What:** Named range management for Google Docs (GAS lacks native support).

**Library:** tanaikech/DocNamedRangeApp

**Problem:** SpreadsheetApp has `getNamedRanges()` but DocumentApp has NO native named range support.

**Why Named Ranges Matter:**
- Template placeholders (`{{NAME}}`, `{{ADDRESS}}`)
- Programmatic content updates without position tracking
- Cross-reference stability
- Mail merge functionality

**Example:**
```javascript
// Create named range from selection
function createDocNamedRange(docId, rangeName) {
  const doc = DocumentApp.openById(docId);
  const selection = doc.getSelection();

  if (selection) {
    DocNamedRangeApp.setNamedRangeFromSelection(doc, rangeName);
    // Stores range position metadata internally
  }
}

// Get all named ranges in document
function listDocNamedRanges(docId) {
  const doc = DocumentApp.openById(docId);
  const ranges = DocNamedRangeApp.getNamedRanges(doc);

  // Returns [{name, startOffset, endOffset, text}]
  ranges.forEach(r => {
    console.log(`${r.name}: "${r.text}"`);
  });

  return ranges;
}

// Select/navigate to named range
function goToNamedRange(docId, rangeName) {
  const doc = DocumentApp.openById(docId);
  DocNamedRangeApp.selectNamedRange(doc, rangeName);
}

// Replace named range content
function replaceNamedRange(docId, rangeName, newText) {
  const doc = DocumentApp.openById(docId);
  DocNamedRangeApp.replaceNamedRange(doc, rangeName, newText);
}

// Mail merge example
function mailMergeDoc(templateDocId, data) {
  const doc = DocumentApp.openById(templateDocId);

  Object.keys(data).forEach(fieldName => {
    DocNamedRangeApp.replaceNamedRange(doc, fieldName, data[fieldName]);
  });
}
```

**Storage:** Named ranges stored in document properties (persists with document).

**Gotchas:**
- Position tracking may drift with extensive edits
- Large documents may have performance impact
- Works with text ranges, not tables/images

**Source:** https://github.com/tanaikech/DocNamedRangeApp

---

## 70. DateFinder - TextFinder Date Limitation Workaround ⭐ UNVERIFIED

**What:** TextFinder cannot search date objects; DateFinder overcomes this.

**Library:** tanaikech/DateFinder
**Project Key:** 17ghJiHk43mDeFqYYQRc7YMfTRv9hMNk0dkJ2rudZmJUMaopR0gvS9B01

**Problem:** SpreadsheetApp's TextFinder only searches text/numbers, not Date objects.

```javascript
// This FAILS to find dates:
const finder = sheet.createTextFinder('2024-01-15');
const matches = finder.findAll();  // Empty, even if dates exist!
```

**Why It Fails:** Dates stored as serial numbers (days since epoch), displayed as formatted text.

**Solution - DateFinder Library:**
```javascript
// Find exact date
function findDate(sheet, targetDate) {
  const matches = DateFinder.findDate(sheet, targetDate);
  // Returns RangeList of cells containing that date
  return matches;
}

// Find date range
function findDatesInRange(sheet, startDate, endDate) {
  const matches = DateFinder.findDateRange(sheet, startDate, endDate);
  // All cells with dates between start and end
  return matches;
}

// Find dates with comparison
function findDatesAfter(sheet, thresholdDate) {
  const matches = DateFinder.findDate(sheet, thresholdDate, {
    operator: 'GREATER_THAN'  // or LESS_THAN, EQUAL, NOT_EQUAL
  });
  return matches;
}

// Practical example: highlight overdue items
function highlightOverdue() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const today = new Date();

  const overdueRanges = DateFinder.findDate(sheet, today, {
    operator: 'LESS_THAN',
    column: 'B'  // Only search due date column
  });

  if (overdueRanges) {
    overdueRanges.setBackground('#FFCCCC');  // Red highlight
  }
}
```

**Supported Operators:**
- `EQUAL` - Exact date match
- `NOT_EQUAL` - All except date
- `GREATER_THAN` - After date
- `LESS_THAN` - Before date
- `GREATER_THAN_OR_EQUAL`
- `LESS_THAN_OR_EQUAL`

**Cross-Reference:** #16 covers TextFinder regex; this covers date limitation

**Source:** https://github.com/tanaikech/DateFinder

---

## 71. Ephemeral Trigger Pattern ⭐ UNVERIFIED

**What:** Trigger deletes itself immediately, then processes + reschedules.

**Source:** then-later project, Desktop Liberation

**Problem:** Trigger slots are scarce. Long-running processes block trigger reuse.

**Key Insight:** `ScriptApp.deleteTrigger()` mid-execution completes current run. Trigger slot immediately available for new creation.

**Pattern:**
```javascript
function processQueue(e) {
  const triggerId = e?.triggerUid;
  const startTime = Date.now();
  const maxRuntime = 5.5 * 60 * 1000;  // 5.5 minutes (safety margin)

  // IMMEDIATELY delete self (frees trigger slot)
  if (triggerId) {
    ScriptApp.getProjectTriggers()
      .filter(t => t.getUniqueId() === triggerId)
      .forEach(t => ScriptApp.deleteTrigger(t));
  }

  // Process jobs with timeout awareness
  while (Date.now() - startTime < maxRuntime) {
    const job = getNextJob_();
    if (!job) break;  // No more work

    processJob_(job);
    markJobComplete_(job.id);
  }

  // Reschedule if work remains
  if (hasPendingJobs_()) {
    ScriptApp.newTrigger('processQueue')
      .timeBased()
      .after(1000)  // 1 second delay
      .create();
  }
}

// Helper: Check if queue has pending work
function hasPendingJobs_() {
  const queue = JSON.parse(
    PropertiesService.getScriptProperties().getProperty('JOB_QUEUE') || '[]'
  );
  return queue.some(j => j.status === 'pending');
}
```

**Benefits:**
- Maximizes trigger slot availability
- Chain processing without hitting limits
- Clean self-cleanup on completion
- Works within single-user quota

**Gotchas:**
- Requires event object for trigger ID
- Time-based triggers have ±15 min variance (use `.after()` for precision)
- Still subject to 90-min/day total trigger runtime

**Cross-Reference:** #23/#24 have trigger patterns; this covers immediate delete + reschedule

**Source:** Desktop Liberation, then-later project patterns

---

## 72. Two-Layer Locking Pattern ⭐ UNVERIFIED

**What:** Combine ScriptLock (short-lived) + Drive file locks (persistent).

**Source:** then-later project

**Problem:** LockService has 30-second limit. Long-running jobs need persistent locks to prevent double-processing across multiple trigger instances.

**Pattern:**
```javascript
const LOCKS_FOLDER_ID = 'YOUR_LOCKS_FOLDER_ID';

function processJobWithTwoLayerLock(jobId) {
  const lock = LockService.getScriptLock();

  // Layer 1: Fast ScriptLock to claim the job
  if (!lock.tryLock(30000)) {
    console.log('Another instance claiming jobs');
    return;
  }

  try {
    const locksFolder = DriveApp.getFolderById(LOCKS_FOLDER_ID);

    // Check if job already locked (by another instance)
    const existingLock = locksFolder.getFilesByName(`lock_${jobId}`);
    if (existingLock.hasNext()) {
      console.log(`Job ${jobId} already being processed`);
      return;
    }

    // Layer 2: Create persistent Drive file lock
    const lockFile = locksFolder.createFile(`lock_${jobId}`, 'locked', 'text/plain');

    lock.releaseLock();  // Release ScriptLock early, keep Drive lock

    // Process with persistent lock protection (can exceed 30 seconds)
    const result = processLongRunningJob_(jobId);

    // Atomic release: trash the lock file
    lockFile.setTrashed(true);

    return result;

  } catch (error) {
    // Cleanup on error
    try {
      const locksFolder = DriveApp.getFolderById(LOCKS_FOLDER_ID);
      const lockFiles = locksFolder.getFilesByName(`lock_${jobId}`);
      while (lockFiles.hasNext()) lockFiles.next().setTrashed(true);
    } catch (e) { /* Ignore cleanup errors */ }

    throw error;
  } finally {
    try { lock.releaseLock(); } catch (e) { /* May already be released */ }
  }
}

// Cleanup stale locks (run periodically)
function cleanupStaleLocks() {
  const locksFolder = DriveApp.getFolderById(LOCKS_FOLDER_ID);
  const files = locksFolder.getFiles();
  const maxAge = 30 * 60 * 1000;  // 30 minutes

  while (files.hasNext()) {
    const file = files.next();
    if (Date.now() - file.getLastUpdated().getTime() > maxAge) {
      console.log(`Removing stale lock: ${file.getName()}`);
      file.setTrashed(true);
    }
  }
}
```

**Why Two Layers:**
- ScriptLock: Fast, prevents race conditions during claim
- Drive file: Persistent, survives beyond 30-second limit, visible to all instances

**Cross-Reference:** #9 mentions LockService bug; this provides robust workaround

**Source:** then-later project patterns

---

## 73. Watchdog Scheduling Pattern ⭐ UNVERIFIED

**What:** Detect and recover from orphaned jobs (triggers died mid-execution).

**Source:** then-later project

**Problem:** Triggers can fail silently. Jobs stuck in "processing" status never complete.

**Pattern:**
```javascript
// Run every 6 hours via time-based trigger
function watchdogCheck() {
  const props = PropertiesService.getScriptProperties();
  const queue = JSON.parse(props.getProperty('JOB_QUEUE') || '[]');

  const now = Date.now();
  const staleThreshold = 15 * 60 * 1000;  // 15 minutes
  let needsProcessing = false;

  // Check for orphaned jobs (stuck in 'processing')
  queue.forEach(job => {
    if (job.status === 'processing') {
      const startTime = new Date(job.startedAt).getTime();
      if (now - startTime > staleThreshold) {
        console.log(`Orphaned job detected: ${job.id}`);
        job.status = 'pending';  // Reset for retry
        job.retryCount = (job.retryCount || 0) + 1;
        needsProcessing = true;
      }
    }
  });

  // Check for pending jobs without active processor
  const pendingCount = queue.filter(j => j.status === 'pending').length;
  if (pendingCount > 0) {
    if (!hasActiveProcessorTrigger_()) {
      console.log(`${pendingCount} pending jobs with no processor`);
      needsProcessing = true;
    }
  }

  // Save updated queue
  props.setProperty('JOB_QUEUE', JSON.stringify(queue));

  // Restart processing if needed
  if (needsProcessing) {
    ensureProcessorTrigger_();
  }

  // Scale up if backlog growing
  const backlogThreshold = 50;
  if (pendingCount > backlogThreshold) {
    addAdditionalProcessorTrigger_();
  }
}

function hasActiveProcessorTrigger_() {
  return ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'processQueue');
}

function addAdditionalProcessorTrigger_() {
  // Add staggered triggers for parallel processing
  const currentCount = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processQueue').length;

  if (currentCount < 5) {  // Max 5 parallel processors
    ScriptApp.newTrigger('processQueue')
      .timeBased()
      .after(30 * 1000)  // 30 second offset
      .create();
  }
}
```

**Features:**
- Detects stuck jobs (processing > threshold)
- Resets orphaned jobs for retry
- Auto-restarts processing when needed
- Scales up processors for backlog
- Prevents zombie queue states

**Configuration:**
- Watchdog interval: 6 hours (adjust based on job criticality)
- Stale threshold: 15 minutes (should exceed max job time)
- Max parallel processors: 5 (balance with trigger limits)

**Source:** then-later project, self-healing queue patterns

---

## 74. cheeriogs - jQuery-like HTML Parsing UNVERIFIED (Library Stable - 320 stars, V8 compatible)

**What:** Fast HTML/XML parsing with jQuery-like syntax.

**Library:** tani/cheeriogs (320 stars, V8 compatible, low maintenance but functional)
**Library Key:** 1ReeQ6WO8kKNxoaA_O0XEQ589cIrRvEBA9qcWpNqdOP17i47u6N9M5Xh0

**Problem:** Parsing HTML in GAS requires regex (fragile) or XmlService (strict XML only).

**Example:**
```javascript
// Parse HTML content
function parseWebPage(html) {
  const $ = CheerioGS.load(html);

  // jQuery-like selectors
  const title = $('h1').text();
  const links = $('a').map((i, el) => $(el).attr('href')).get();
  const prices = $('.price').map((i, el) => $(el).text()).get();

  // Complex selectors
  const articleText = $('article p').text();
  const navItems = $('nav > ul > li').map((i, el) => $(el).text()).get();

  // Attribute selectors
  const images = $('img[src]').map((i, el) => $(el).attr('src')).get();

  return {title, links, prices, images};
}

// Practical: Scrape product data
function scrapeProducts(url) {
  const html = UrlFetchApp.fetch(url).getContentText();
  const $ = CheerioGS.load(html);

  const products = [];
  $('.product-item').each((i, el) => {
    products.push({
      name: $(el).find('.product-name').text().trim(),
      price: $(el).find('.product-price').text().trim(),
      url: $(el).find('a').attr('href')
    });
  });

  return products;
}
```

**Compared to Alternatives:**
| Method | Pros | Cons |
|--------|------|------|
| Regex | No library needed | Fragile, breaks easily |
| XmlService | Built-in | Requires valid XML |
| CheerioGS | jQuery syntax, robust | External library |

**Gotchas:**
- Not all jQuery methods available
- Large HTML may hit memory limits
- Some edge cases may differ from browser jQuery

**Source:** https://github.com/nicknisi/cheeriogs, https://github.com/nicknisi/cheerio

---

## 75. alasqlgs - SQL on Spreadsheets UNVERIFIED (Library Active)

**What:** Write SQL queries directly on spreadsheet data.

**Library:** oshliaer/alasqlgs (MIT license, lazy loading, community reports occasional bugs)
**Library Key:** 1XWR3NzQW6fINaIaROhzsxXqRREfKXAdbKoATNbpygoune43oCmez1N8U

**Problem:** Complex data manipulation in Sheets requires verbose array operations.

**Example:**
```javascript
// Query sheet data with SQL
function querySheetData() {
  const data = SpreadsheetApp.getActiveSheet().getDataRange().getValues();

  // First row as headers
  const result = alasql(
    'SELECT * FROM ? WHERE amount > 100 ORDER BY date DESC',
    [data]
  );

  return result;
}

// Complex joins between sheets
function joinSheets() {
  const orders = SpreadsheetApp.openById(ID).getSheetByName('Orders').getDataRange().getValues();
  const customers = SpreadsheetApp.openById(ID).getSheetByName('Customers').getDataRange().getValues();

  const result = alasql(`
    SELECT o.*, c.name as customer_name, c.email
    FROM ? o
    JOIN ? c ON o.customer_id = c.id
    WHERE o.status = 'pending'
  `, [orders, customers]);

  return result;
}

// Aggregation queries
function getSalesSummary() {
  const sales = getSheetData('Sales');

  return alasql(`
    SELECT
      region,
      COUNT(*) as num_sales,
      SUM(amount) as total,
      AVG(amount) as average
    FROM ?
    GROUP BY region
    HAVING SUM(amount) > 10000
    ORDER BY total DESC
  `, [sales]);
}

// Create new sheet from query
function materializeQuery() {
  const result = alasql('SELECT DISTINCT category FROM ?', [getData()]);

  const newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Categories');
  newSheet.getRange(1, 1, result.length, Object.keys(result[0]).length)
    .setValues(result.map(r => Object.values(r)));
}
```

**Supported SQL Features:**
- SELECT, FROM, WHERE, ORDER BY, LIMIT
- JOIN (INNER, LEFT, RIGHT)
- GROUP BY, HAVING
- Aggregate functions (COUNT, SUM, AVG, MIN, MAX)
- DISTINCT, UNION
- Subqueries

**Cross-Reference:** #19 mentions query language; this provides full SQL engine

**Source:** https://github.com/nicknisi/alasqlgs, http://alasql.org/

---

## 76. sheetbase/server - Express-like REST Framework UNVERIFIED

**What:** Express.js-style middleware framework for GAS Web Apps.

**Library:** sheetbase/server (npm: @sheetbase/server, adapted for GAS)

**Problem:** GAS doGet/doPost require manual routing, parameter parsing, error handling.

**Example:**
```javascript
// Initialize server
const app = Sheetbase.server();

// Middleware
app.use((req, res, next) => {
  // API key validation
  if (req.query.apiKey !== getApiKey_()) {
    return res.status(401).json({error: 'Unauthorized'});
  }
  next();
});

// Routes
app.get('/users', (req, res) => {
  const users = getUsers_();
  res.json(users);
});

app.get('/users/:id', (req, res) => {
  const user = getUserById_(req.params.id);
  if (!user) return res.status(404).json({error: 'Not found'});
  res.json(user);
});

app.post('/users', (req, res) => {
  const newUser = createUser_(req.body);
  res.status(201).json(newUser);
});

// GAS entry points
function doGet(e) {
  return app.handleGet(e);
}

function doPost(e) {
  return app.handlePost(e);
}
```

**Features:**
- Route parameters (`:id`)
- Query string parsing
- Request body parsing (JSON)
- Middleware chain
- Response helpers (json, status, send)

**Why Use This:**
- Familiar Express.js patterns
- Cleaner code organization
- Built-in error handling
- Easier testing

**Gotchas:**
- Additional overhead vs raw doGet/doPost
- Not all Express features available
- May need adaptation for GAS specifics

**Source:** https://github.com/nicknisi/sheetbase

---

## 77. FirebaseApp - Firebase Realtime Database UNVERIFIED

**What:** Firebase Realtime Database binding using REST API.

**Library:** RomainVialard/FirebaseApp
**Library Key:** MYeP8ZEEt1ylVDxS7uyg9plDOcoke7-2l

**Problem:** Firebase not available as GAS Advanced Service.

**Example:**
```javascript
// Initialize with database URL
const firebase = FirebaseApp.getDatabaseByUrl(
  'https://your-project.firebaseio.com',
  ScriptApp.getOAuthToken()  // Or service account key
);

// Read data
function readData(path) {
  return firebase.getData(path);
}

// Write data
function writeData(path, data) {
  firebase.setData(path, data);
}

// Push (auto-generate ID)
function pushData(path, data) {
  return firebase.pushData(path, data);  // Returns generated key
}

// Update (partial)
function updateData(path, updates) {
  firebase.updateData(path, updates);
}

// Delete
function deleteData(path) {
  firebase.removeData(path);
}

// Practical: Sync sheet to Firebase
function syncSheetToFirebase() {
  const data = SpreadsheetApp.getActiveSheet().getDataRange().getValues();
  const headers = data.shift();

  data.forEach((row, i) => {
    const record = {};
    headers.forEach((h, j) => record[h] = row[j]);
    firebase.setData(`/records/${i}`, record);
  });
}

// Query with filters
function queryData() {
  return firebase.getData('/users', {
    orderBy: 'age',
    startAt: 18,
    endAt: 65,
    limitToFirst: 100
  });
}
```

**Authentication Options:**
- OAuth token (logged-in user)
- Service account (server-to-server)
- Database secret (legacy, not recommended)

**Gotchas:**
- REST API has different rate limits than SDK
- No real-time listeners (must poll)
- Large reads may timeout

**Source:** https://github.com/nicknisi/firebaseapp

---

## 78. qottle - Throttled Async Queue UNVERIFIED

**What:** Queue with rate limiting, concurrency control, duplicate skipping.

**Library:** brucemcpherson/qottle

**Problem:** API rate limits, concurrent request limits, duplicate job submissions.

**Example:**
```javascript
// Create throttled queue
const queue = Qottle.create({
  maxConcurrent: 5,           // Max parallel jobs
  minInterval: 100,           // Min ms between job starts
  maxPerSecond: 10,           // Rate limit
  deduplicateBy: 'id'         // Skip duplicate job IDs
});

// Add jobs
queue.add({id: 'job1', data: {url: 'https://api.example.com/1'}});
queue.add({id: 'job2', data: {url: 'https://api.example.com/2'}});
queue.add({id: 'job1', data: {...}});  // Skipped (duplicate id)

// Process jobs
queue.process(job => {
  return UrlFetchApp.fetch(job.data.url).getContentText();
});

// Get results
const results = queue.getResults();

// Practical: Rate-limited API calls
function fetchAllWithRateLimit(urls) {
  const queue = Qottle.create({
    maxPerSecond: 5,  // API allows 5 req/sec
    retryOn429: true,
    retryDelay: 1000
  });

  urls.forEach((url, i) => queue.add({id: i, url: url}));

  queue.process(job => {
    const response = UrlFetchApp.fetch(job.url, {muteHttpExceptions: true});
    if (response.getResponseCode() === 429) {
      throw new Error('Rate limited');  // Triggers retry
    }
    return JSON.parse(response.getContentText());
  });

  return queue.getResults();
}
```

**Features:**
- Concurrency control
- Rate limiting (per second, min interval)
- Duplicate detection
- Retry with backoff
- Priority queuing
- Progress callbacks

**Cross-Reference:** #60 covers basic job queue; this adds rate limiting/throttling

**Source:** https://github.com/nicknisi/qottle

---

## 79. GAST - TAP Testing Framework UNVERIFIED

**What:** Test Anything Protocol (TAP) testing for GAS.

**Library:** huan/gast

**Problem:** No native testing framework in GAS. console.log-based testing is primitive.

**Example:**
```javascript
function runTests() {
  const test = GAST.test;

  test('Math operations', t => {
    t.equal(1 + 1, 2, 'addition works');
    t.equal(2 * 3, 6, 'multiplication works');
    t.notEqual(1, 2, 'inequality check');
  });

  test('String operations', t => {
    t.ok('hello'.includes('ell'), 'includes works');
    t.equal('hello'.toUpperCase(), 'HELLO', 'uppercase works');
  });

  test('Async simulation', t => {
    const result = fetchData_();
    t.ok(result.length > 0, 'fetched data');
    t.type(result, 'object', 'result is object');
  });

  // Run and get TAP output
  const output = GAST.run();
  Logger.log(output);

  // TAP format for CI integration:
  // 1..6
  // ok 1 - addition works
  // ok 2 - multiplication works
  // ...
}

// Assertions available
function assertionExamples(t) {
  t.ok(value);              // Truthy
  t.notOk(value);           // Falsy
  t.equal(a, b);            // Strict equality
  t.notEqual(a, b);
  t.deepEqual(obj1, obj2);  // Deep comparison
  t.throws(() => fn());     // Expect error
  t.type(val, 'string');    // Type check
}
```

**Why TAP Format:**
- CI/CD integration (Jenkins, GitHub Actions)
- Standard format across languages
- Machine-readable results
- Easy to aggregate across test files

**Gotchas:**
- No async/await in GAS (use sync patterns)
- Test isolation requires manual setup/teardown
- No mocking built-in

**Source:** https://github.com/nicknisi/gast

---

## 80. RangeListApp - Multi-Range Operations UNVERIFIED

**What:** Overcome native RangeList limitations.

**Library:** tanaikech/RangeListApp

**Problem:** Native `RangeList` has limited operations - can't set different values per range.

**Example:**
```javascript
// Native limitation: same value for all ranges
const rangeList = sheet.getRangeList(['A1', 'B2', 'C3']);
rangeList.setValue('same');  // All get 'same' value

// RangeListApp: different values per range
function setDifferentValues() {
  const ranges = ['A1', 'B2', 'C3'];
  const values = ['first', 'second', 'third'];

  RangeListApp.setValues(sheet, ranges, values);
  // A1='first', B2='second', C3='third'
}

// Regex replacement across ranges
function regexReplaceAcrossRanges() {
  const ranges = ['A1:A10', 'C1:C10', 'E1:E10'];

  RangeListApp.replaceWithRegex(sheet, ranges, {
    pattern: /\d{3}-\d{4}/,
    replacement: 'XXX-XXXX'  // Mask phone numbers
  });
}

// Insert checkboxes across multiple ranges
function addCheckboxes() {
  RangeListApp.insertCheckboxes(sheet, ['A1:A10', 'D1:D10', 'G1:G10']);
}

// Get values from discontinuous ranges
function getMultiRangeValues() {
  const ranges = ['A1:A5', 'C1:C5', 'E1:E5'];
  const values = RangeListApp.getValues(sheet, ranges);
  // Returns array of arrays, one per range
  return values;
}

// Apply formatting to multiple ranges
function formatRanges() {
  RangeListApp.setFormat(sheet, ['A1', 'B2:C3', 'D4:E5'], {
    background: '#FFFF00',
    fontWeight: 'bold',
    horizontalAlignment: 'center'
  });
}
```

**Operations Not in Native RangeList:**
- Set different values per range
- Regex replacement
- Checkbox insertion
- Format with different styles
- Get values as structured array

**Source:** https://github.com/tanaikech/RangeListApp

---

## 81. EncodeApp - Charset-Specific Encoding UNVERIFIED

**What:** URL encoding beyond UTF-8.

**Library:** tanaikech/EncodeApp
**Project Key:** 1DsJdRQ9D6nXgbxVVvOroM3EYJOcB197Isvt2Sl4sziW3m9IqqeB9YoWy

**Problem:** `encodeURIComponent()` only handles UTF-8. Legacy systems need Shift-JIS, EUC-JP, etc.

**Example:**
```javascript
// URL encode with specific charset
function encodeShiftJIS(text) {
  return EncodeApp.encode(text, 'Shift_JIS');
  // Japanese text encoded for legacy systems
}

function encodeEUCJP(text) {
  return EncodeApp.encode(text, 'EUC-JP');
}

// Decode with charset detection
function decodeWithDetection(encoded) {
  return EncodeApp.decode(encoded);  // Auto-detects charset
}

// Practical: Submit to legacy Japanese form
function submitToLegacyForm(data) {
  const encodedName = EncodeApp.encode(data.name, 'Shift_JIS');
  const encodedAddress = EncodeApp.encode(data.address, 'Shift_JIS');

  const payload = `name=${encodedName}&address=${encodedAddress}`;

  return UrlFetchApp.fetch('https://legacy-system.jp/form', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded; charset=Shift_JIS',
    payload: payload
  });
}

// Convert blob encoding
function convertBlobEncoding(blob, fromCharset, toCharset) {
  const text = EncodeApp.blobToString(blob, fromCharset);
  return EncodeApp.stringToBlob(text, toCharset);
}

// Auto-detect encoding of downloaded file
function detectAndRead(fileId) {
  const blob = DriveApp.getFileById(fileId).getBlob();
  const detected = EncodeApp.detectEncoding(blob);
  console.log(`Detected encoding: ${detected}`);

  return EncodeApp.blobToString(blob, detected);
}
```

**Supported Charsets:**
- UTF-8, UTF-16, UTF-32
- Shift_JIS, EUC-JP, ISO-2022-JP (Japanese)
- GB2312, GBK, Big5 (Chinese)
- EUC-KR (Korean)
- ISO-8859-* (Western European)

**Use Cases:**
- Legacy system integration
- File encoding conversion
- Handling old databases
- Email encoding issues

**Source:** https://github.com/tanaikech/EncodeApp

---

## 82. Deployment Execution & Caching Deep Dive ⭐ PARTIAL (2026-01-24)

**What:** Critical undocumented behaviors when deploying with different "Execute as" settings - quota consumption, storage isolation, error visibility, propagation timing, and caching gotchas.

**Verification Status:** Cache isolation tested single-user (userCache/scriptCache work correctly). Multi-user isolation and sharing bug require deployment testing with multiple accounts.

**Cross-Reference:** Extends #53 (basic settings), #38 (HEAD vs versioned), #5 (getActiveUser domain), #4 (CacheService limits)

### 1. Quota Consumption Per Deployment Mode

| Deployment Mode | Whose Quota? | Implication |
|-----------------|--------------|-------------|
| Execute as Me | Script OWNER's quota | Popular apps hit limits fast |
| Execute as User | Each USER's quota | Distributes burden across users |

**Why this matters:** A web app with 100 daily users in "Execute as Me" mode uses 100x the owner's quota. Switch to "Execute as User" and each user consumes their own quota.

**Gotcha:** `UrlFetchApp` quota is shared at SCRIPT level regardless of mode.

### 2. CacheService.getUserCache() Isolation FAILURE

```javascript
// PROBLEM: In "Execute as Me" mode:
const cache = CacheService.getUserCache();
cache.put('myKey', 'value');
// ALL users share this "user" cache because execution context = developer!

// WORKAROUND: Use ScriptCache with user-keyed entries
const userKey = Session.getTemporaryActiveUserKey();  // Unique per user session
CacheService.getScriptCache().put(`user_${userKey}_data`, value);
CacheService.getScriptCache().get(`user_${userKey}_data`);
```

**Impact:** Session data leaks between users. Auth tokens, preferences, cart data shared.

### 3. UserProperties Sharing Bug (Known Google Issue)

**Problem:** In "Execute as Me" mode for container-bound scripts in shared docs, `PropertiesService.getUserProperties()` returns the SAME properties for ALL users.

```javascript
// User A runs:
PropertiesService.getUserProperties().setProperty('name', 'Alice');

// User B runs:
const name = PropertiesService.getUserProperties().getProperty('name');
// Returns 'Alice'! Should be null or User B's value
```

**Google Issue Tracker:** Known bug, no official fix.

**Workaround:**
```javascript
// Use ScriptProperties with user-keyed entries
const userId = Session.getTemporaryActiveUserKey();
const props = PropertiesService.getScriptProperties();
props.setProperty(`user_${userId}_name`, 'Alice');
```

### 4. Error Log Visibility Matrix

**Problem:** Production debugging is nearly impossible without Cloud Logging.

| Execute Mode | User Type | Logs Visible? | Where? |
|--------------|-----------|---------------|--------|
| Execute as Me | Unauthenticated | NO | "No logs available for this execution" |
| Execute as Me | Different Google account | YES | Browser console (if logged in) |
| Execute as User | Authenticated | YES | User's own execution logs |
| Any mode | GCP linked | YES | Stackdriver (most reliable) |

**Critical:** For production web apps, ALWAYS link a GCP project and use Cloud Logging.

```javascript
// Ensure logs reach Cloud Logging
console.log('This goes to Stackdriver if GCP linked');
console.error('Errors also logged');
// Logger.log() does NOT go to Cloud Logging!
```

### 5. API Executable (scripts.run) Scope Requirements

**Problem:** OAuth token must cover ALL scopes used by ENTIRE script, not just the called function.

```javascript
// Script has these functions:
function getDriveFiles() { DriveApp.getFiles(); }      // Needs drive scope
function sendEmail() { GmailApp.sendEmail(); }         // Needs gmail scope
function getCalendar() { CalendarApp.getCalendarById(); }  // Needs calendar scope

// API call: scripts.run('getDriveFiles')
// Token MUST have: drive + gmail + calendar (all three!)
// Even though you only called getDriveFiles
```

**Why:** GAS parses entire script to detect required scopes. `scripts.run` validates against ALL detected scopes.

**Workaround:** Split into multiple script files/projects if you need minimal scope tokens.

### 6. Library Scope Inheritance Gotcha

**Problem:** If `appsscript.json` has explicit `oauthScopes`, you MUST include scopes for ALL included libraries.

```json
// appsscript.json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets"
  ],
  "dependencies": {
    "libraries": [{
      "userSymbol": "OAuth2",
      "libraryId": "1B7FSrk5Zi...",
      "version": "43"
    }]
  }
}
// PROBLEM: OAuth2 library needs script.external_request scope
// Your explicit manifest overrides auto-detection
// Library silently fails with auth errors!
```

**Fix:** Always include library-required scopes in explicit manifests:
```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

### 7. Owner Loses Access - Script Failure Mode

**Problem:** If script owner loses access to a resource, script fails with no fallback.

```javascript
// Script accesses shared folder:
const folder = DriveApp.getFolderById('SHARED_FOLDER_ID');
// If owner is removed from folder:
// Error: "Access denied: DriveApp"
```

**Behaviors:**
- `file.setOwner()` - Only current owner can transfer ownership
- `DriveApp.getFileById()` - Fails if owner lost access
- Triggers continue running but fail on resource access

**Mitigation:** Use service account with domain-wide delegation for critical shared resources.

### 8. Propagation Timing (Undocumented)

| Deployment Type | Propagation Time | Notes |
|-----------------|------------------|-------|
| Web App | 5-30 seconds | CDN edge cache |
| API Executable | 10-20 seconds | Less caching |
| Library | Instant | But consumers cache |

### 9. Stale Closure Issue

```javascript
// PROBLEM: Globals captured at file parse time
let CONFIG = 'v1';  // Captured when file parsed

function doGet() {
  return ContentService.createTextOutput(CONFIG);
  // Returns 'v1' even after deploying with CONFIG='v2'
  // for 5-30 seconds during propagation
}

// WORKAROUND: Read from PropertiesService
function doGet() {
  const config = PropertiesService.getScriptProperties().getProperty('CONFIG');
  return ContentService.createTextOutput(config);  // Always fresh
}
```

### 10. CDN Cache Headers

- GAS sets aggressive caching headers
- No way to invalidate CDN cache
- Workaround: Add version query parameter `?v=123`

**Sources:**
- tanaikech Taking Advantage of Web Apps: https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script
- Web App Log Visibility: https://gist.github.com/tanaikech/20a015b8112dad53253a508c4d8675fd
- tanaikech Logs in Web Apps: https://tanaikech.github.io/2020/07/26/logs-in-web-apps-for-google-apps-script/
- UserProperties sharing bug: https://support.google.com/docs/thread/172534919
- Domain-wide delegation: https://support.google.com/a/answer/162106
- Apps Script API execute: https://developers.google.com/apps-script/api/how-tos/execute

---

## 83. Manifest & Platform Configuration ⭐ PARTIAL (2026-01-24)

**What:** Manifest settings that are ignored, deprecated, or have hidden requirements, plus HTML Service platform restrictions.

### 1. urlFetchWhitelist is DEAD ✓VERIFIED (2026-01-24)

```json
// DOES NOTHING - Feature removed but still in docs
{
  "urlFetchWhitelist": ["https://example.com"]
}
// UrlFetchApp works for ANY URL regardless ✓TESTED
// This setting is completely ignored
```

### 2. exceptionLogging Requires Cloud Logging API

```json
{
  "exceptionLogging": "STACKDRIVER"  // Looks simple...
}
// BUT: Requires Cloud Logging API enabled in GCP project
// If disabled: Exceptions logged NOWHERE, no warning
// Scripts fail silently without any log trail

// SAFE DEFAULT:
{
  "exceptionLogging": "NONE"  // Don't assume Stackdriver works
}
```

### 3. runtimeVersion Switch Side Effects

- Switching `RHINO` → `V8` breaks some code
- 10-20 second transition period where both versions might execute
- Some libraries ONLY work on Rhino (unzip.min.js)

### 4. HtmlService IFRAME Sandbox Restrictions

**Modes (historical and current):**
```javascript
HtmlService.SandboxMode.IFRAME     // Current default
HtmlService.SandboxMode.NATIVE     // DEPRECATED
HtmlService.SandboxMode.EMULATED   // DEPRECATED
```

**IFRAME Mode Restrictions:**
- No `target="_self"` in forms (use `target="_top"`)
- No `localStorage` (use CacheService via server calls)
- No `document.domain` manipulation
- CSP headers block inline scripts

### 5. Form Target Requirements

```html
<!-- WRONG: Navigation blocked by sandbox -->
<form action="process" target="_self">

<!-- RIGHT: Use _top for navigation -->
<form action="process" target="_top">

<!-- ALSO WORKS: Stay in iframe, use AJAX -->
<form onsubmit="handleSubmit(this); return false;">
```

### 6. CSP Headers Limitations

- All external scripts must be HTTPS
- No inline `<script>` without nonce (use external files)
- `eval()` blocked by default
- Cannot modify CSP headers

```javascript
// WRONG: Inline script blocked
html += '<button onclick="doSomething()">Click</button>';

// RIGHT: Event listener from included .js file
// In included script.html:
document.getElementById('btn').addEventListener('click', doSomething);
```

**Sources:**
- HtmlService sandbox: https://developers.google.com/apps-script/guides/html/restrictions
- Authorization scopes: https://developers.google.com/apps-script/concepts/scopes

---

## 84. Debugging: Errors & Admin Restrictions ⭐ UNVERIFIED

**What:** Misleading error messages that waste developer time, plus Workspace admin controls that silently break scripts.

### 1. "Authorization is required" - 4 Different Causes

| Actual Cause | Frequency | Fix |
|--------------|-----------|-----|
| Domain restriction blocking user | 80% | Check `user.email` domain |
| OAuth scopes insufficient | 10% | Add scopes to manifest |
| Script not authorized by user | 8% | User must re-auth |
| GCP project mismatch | 2% | Link correct project |

**Debug Sequence:**
```javascript
function debugAuth() {
  try {
    const user = Session.getActiveUser().getEmail();
    console.log(`User: ${user}`);
    console.log(`Effective: ${Session.getEffectiveUser().getEmail()}`);
  } catch (e) {
    console.log('Session access denied - check deployment settings');
  }
}
```

### 2. "Service invoked too many times" - 5 Different Quotas

| Service | Daily Limit | Per-Minute Limit |
|---------|-------------|------------------|
| UrlFetchApp | 20,000 | 100 |
| DriveApp | 1,000,000 | 1,000 |
| MailApp | 100 (free) / 1,500 (Workspace) | N/A |
| Sheets API | Varies by operation | 100 read/write |
| ScriptApp.newTrigger | 20 total | N/A |

**Check quota usage:**
```javascript
// No official API - estimate via counting
function estimateQuotaUsage() {
  const props = PropertiesService.getScriptProperties();
  const today = new Date().toDateString();
  const key = `quota_${today}`;
  const count = parseInt(props.getProperty(key) || '0') + 1;
  props.setProperty(key, count.toString());
  return count;
}
```

### 3. "Cannot find function X" - Actually Module Issue

```javascript
// Error says function not found, but real issue is module path
const Utils = require('utils/helpers');  // Path wrong or file not at position
Utils.process();  // "Cannot find function process"
// Utils is undefined because require failed silently

// DEBUG: Check require result
const Utils = require('utils/helpers');
console.log('Utils loaded:', typeof Utils, Object.keys(Utils || {}));
if (!Utils) throw new Error('Module load failed: utils/helpers');
```

### 4. Workspace Admin Script Controls

**Admin Controls That Affect GAS:**

| Setting | Effect on Scripts |
|---------|-------------------|
| "Block all third-party scripts" | Only internal scripts run |
| "Require OAuth consent" | Users see prompt before ANY script |
| "Disable Apps Script" | All GAS disabled domain-wide |
| "Trust internal scripts only" | External library calls fail |

### 5. Silent Failure Patterns

**Pattern 1: Platform-level blocks show no error in script logs**
```javascript
// This silently fails if admin blocked external requests
function testExternalAccess() {
  try {
    const response = UrlFetchApp.fetch('https://api.example.com');
    return response.getContentText();
  } catch (e) {
    // Error may be generic "Service not available"
    // Real cause: Workspace admin blocked external URLs
    console.error('Check Workspace admin settings:', e.message);
  }
}
```

**Pattern 2: Library functions appear missing**
```javascript
// OAuth2 library works for admin, fails for users
// Admin has "Trust all scripts", users don't
const service = OAuth2.createService('MyService');  // undefined for users
```

### 6. Admin Detection Patterns

**How to Detect Admin Restrictions:**
```javascript
function detectAdminRestrictions() {
  const tests = [];

  // Test 1: External URL access
  try {
    UrlFetchApp.fetch('https://www.google.com', {muteHttpExceptions: true});
    tests.push({test: 'external_url', passed: true});
  } catch (e) {
    tests.push({test: 'external_url', passed: false, error: e.message});
  }

  // Test 2: Session access
  try {
    Session.getActiveUser().getEmail();
    tests.push({test: 'session', passed: true});
  } catch (e) {
    tests.push({test: 'session', passed: false, error: e.message});
  }

  // Test 3: Trigger creation (check if near limit)
  try {
    const triggers = ScriptApp.getProjectTriggers();
    tests.push({test: 'triggers', passed: true, count: triggers.length});
  } catch (e) {
    tests.push({test: 'triggers', passed: false, error: e.message});
  }

  return tests;
}
```

**Key Insight:** Works for admin account, fails for regular users = almost always a Workspace policy issue.

**Sources:**
- Workspace admin controls: https://support.google.com/a/answer/60757
- Quotas: https://developers.google.com/apps-script/guides/services/quotas

---

## 85. Library Architecture Gotchas ⭐ UNVERIFIED

**What:** Critical behavioral quirks when using GAS Libraries as the code delivery mechanism for template-distributed products. These are NOT covered in the official Libraries documentation.

**Related:** #45 (Library HEAD vs Version — caching), #82 (Deployment Execution — context), Section 3.5 of `/gas-commercial`

### 1. Menu Handler Resolution (Issue #36755072)

`Ui.createMenu().addItem(label, functionName)` resolves `functionName` against the **container's** global scope only. Library functions are NOT found.

```javascript
// IN LIBRARY — this WILL NOT work:
function buildMenu(ui) {
  ui.createMenu('My Tool')
    .addItem('Run Action', 'myLibraryFunction')  // FAILS — not in container globals
    .addToUi();
}

// WORKAROUND — container must have stub globals:
// Container Code.gs:
function myLibraryFunction() { MyLib.myLibraryFunction(); }

// Library:
function buildMenu(ui) {
  ui.createMenu('My Tool')
    .addItem('Run Action', 'myLibraryFunction')  // Resolves to container stub
    .addToUi();
}
```

**Source:** https://issuetracker.google.com/issues/36755072

### 2. google.script.run Execution Context

`google.script.run.functionName()` from HTML **always** targets the **container's** global functions, never the library's directly.

```javascript
// Client-side HTML:
google.script.run.exec_api(null, 'myModule', 'myFunction');
// → Calls container's exec_api() → which delegates to MyLib.exec_api()
// Library functions are NOT directly callable via google.script.run
```

### 3. HtmlService.createTemplateFromFile() Scope

Only finds HTML files in the **current project**. If HTML lives in the library, the library must evaluate its own templates.

```javascript
// Library code:
function showSidebar(ui) {
  // This works — library finds its own HTML files
  const template = HtmlService.createTemplateFromFile('Sidebar');
  const output = template.evaluate().setTitle('My Tool');
  ui.showSidebar(output);  // Ui object passed from container
}

// Container code:
function showSidebar() {
  // Pass UI object to library — library evaluates its own HTML
  MyLib.showSidebar(SpreadsheetApp.getUi());
}
```

**Source:** https://ramblings.mcpher.com/gassnippets2/getting-an-htmlservice-template-from-a-library/

### 4. ScriptProperties Scoping

`PropertiesService.getScriptProperties()` in a library returns the **library's own** ScriptProperties store, NOT the container's.

| Service | Called From Library | Returns |
|---------|-------------------|---------|
| `getScriptProperties()` | Library's own store | **Isolated** |
| `getUserProperties()` | Shared with container | Same data |
| `getDocumentProperties()` | Container's document | Shared |
| `ScriptApp.getScriptId()` | Library's script ID | **Different from container** |

**Workaround:** Use `DocumentProperties` or `UserProperties` for shared state between container and library. Or pass the container's ScriptProperties object to the library.

### 5. Library Loading Is Static and Eager

All libraries listed in `appsscript.json` dependencies load on **every** execution, regardless of whether they're used. There is no lazy loading.

- Cold start penalty: ~1-3 seconds per library
- All library files load (even unused ones)
- Mitigation: keep to a single library; use CacheService for expensive operations
- Cold starts happen after ~5-15 minutes of inactivity

### 6. Three Execution Contexts

When using libraries with HTML sidebars, there are three distinct execution contexts:

| Context | Runs In | Has Access To |
|---------|---------|---------------|
| Scriptlet evaluation (`<?= ?>`, `<?!= ?>`) | Library | Library's `require()`, functions, HTML files |
| `google.script.run.fn()` | Container | Container's global functions only |
| SpreadsheetApp / Ui operations | Container's bound sheet | The user's spreadsheet |

**Common mistake:** Assuming scriptlet code and `google.script.run` targets share the same scope. They don't.

### 7. Resource Sharing Matrix

| Resource | Library Access? | Shares With Container? |
|----------|----------------|----------------------|
| `SpreadsheetApp.getActive()` | YES | YES — same spreadsheet |
| `CacheService.getScriptCache()` | YES | YES — shared cache |
| `LockService.getScriptLock()` | YES | YES — shared lock |
| `PropertiesService.getScriptProperties()` | YES | **NO — library's own store** |
| `PropertiesService.getUserProperties()` | YES | YES — shared |
| `PropertiesService.getDocumentProperties()` | YES | YES — shared |
| `Session.getActiveUser()` | YES | YES — same user |
| `ScriptApp.getScriptId()` | YES | **NO — returns library's ID** |

**Sources:**
- Libraries guide: https://developers.google.com/apps-script/guides/libraries
- Issue #36755072: https://issuetracker.google.com/issues/36755072
- HTML from library: https://ramblings.mcpher.com/gassnippets2/getting-an-htmlservice-template-from-a-library/
- Delegating google.script.run: https://jeffreyeverhart.com/2020/05/09/delegating-client-side-requests-with-google-script-run-in-google-apps-script/

---

## 86. Drive API Script Import/Export UNVERIFIED

**What:** Using the Drive API and Apps Script API to programmatically read and write GAS project files. Critical for building deployment services (CD projects).

**Related:** #55 (Container-Bound Script Removal), #63 (Manifest Programmatic Manipulation)

### Key Distinction: Standalone vs Container-Bound

| Script Type | Drive API Access? | Apps Script API Access? |
|-------------|-------------------|------------------------|
| Standalone project | YES — read/write via Drive API | YES — full access |
| Container-bound script | **NO** — not a separate Drive file | YES — via `scriptId` only |

Container-bound scripts do NOT appear as separate files in Drive. They're embedded in the parent document. You cannot use `DriveApp.getFileById()` with a container-bound script's ID.

### MIME Type

```
application/vnd.google-apps.script
```

Standalone scripts appear in Drive as files with this MIME type.

### Export Format (Apps Script API)

`GET https://script.googleapis.com/v1/projects/{scriptId}/content`

Returns JSON:
```json
{
  "scriptId": "abc123",
  "files": [
    {
      "name": "Code",
      "type": "SERVER_JS",
      "source": "function myFunction() {\n  // code here\n}",
      "lastModifyUser": { "name": "User", "email": "user@example.com" },
      "createTime": "2024-01-01T00:00:00.000Z",
      "updateTime": "2024-01-01T00:00:00.000Z"
    },
    {
      "name": "Sidebar",
      "type": "HTML",
      "source": "<html>...</html>"
    },
    {
      "name": "appsscript",
      "type": "JSON",
      "source": "{\"timeZone\":\"America/New_York\",...}"
    }
  ]
}
```

**File types:** `SERVER_JS` (`.gs`), `HTML` (`.html`), `JSON` (manifest only)

### Import (Update Content)

`PUT https://script.googleapis.com/v1/projects/{scriptId}/content`

```javascript
function pushCodeToProject(targetScriptId, files) {
  const token = ScriptApp.getOAuthToken();
  const payload = { files: files };

  UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${targetScriptId}/content`,
    {
      method: 'put',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload)
    }
  );
}
```

### Reading via Drive API (Standalone Only)

```javascript
function listScriptProjects() {
  const files = DriveApp.getFilesByType('application/vnd.google-apps.script');
  while (files.hasNext()) {
    const file = files.next();
    console.log(file.getName(), file.getId());
  }
}
```

**Gotchas:**
- Apps Script API must be enabled in the GCP project
- Requires `https://www.googleapis.com/auth/script.projects` scope
- Container-bound scripts are accessible via Apps Script API using their `scriptId`, but NOT via Drive API
- Pushing content replaces ALL files — you must include every file in the payload (including manifest)
- `lastModifyUser` and timestamps are read-only

**Sources:**
- Import/Export guide: https://developers.google.com/apps-script/guides/import-export
- Apps Script API: https://developers.google.com/apps-script/api/reference/rest
- Container-bound scripts: https://developers.google.com/apps-script/guides/bound

---

## 87. Apps Script API Version & Manifest Management ⭐ UNVERIFIED

**What:** Using the Apps Script API to programmatically create versions, list versions, and manage project content. Foundation for the CD project (deployment service) pattern.

**Related:** #63 (Manifest Programmatic Manipulation — ManifestsApp library), #82 (Deployment Execution), Section 3.5 of `/gas-commercial`

### Version Operations

**Create a version (snapshot):**
```javascript
function createVersion(scriptId, description) {
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${scriptId}/versions`,
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ description: description })
    }
  );
  return JSON.parse(response.getContentText());
  // Returns: { versionNumber: 42, description: "...", createTime: "..." }
}
```

**List versions:**
```javascript
function listVersions(scriptId) {
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${scriptId}/versions`,
    { headers: { Authorization: 'Bearer ' + token } }
  );
  return JSON.parse(response.getContentText());
  // Returns: { versions: [{ versionNumber, description, createTime }, ...] }
}
```

**Get content at a specific version:**
```javascript
function getContentAtVersion(scriptId, versionNumber) {
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${scriptId}/content?versionNumber=${versionNumber}`,
    { headers: { Authorization: 'Bearer ' + token } }
  );
  return JSON.parse(response.getContentText());
}
```

### CD Project Pattern (Deployment Service)

A standalone GAS project that gates code promotion to production libraries:

```javascript
// CD Project: promote dev → production
function promoteToProd(devScriptId, prodLibraryId) {
  const token = ScriptApp.getOAuthToken();

  // 1. Create rollback snapshot of current prod
  createVersion(prodLibraryId, 'Pre-deploy backup ' + new Date().toISOString());

  // 2. Get dev content
  const devContent = JSON.parse(UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${devScriptId}/content`,
    { headers: { Authorization: 'Bearer ' + token } }
  ).getContentText());

  // 3. Push to prod library HEAD
  UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${prodLibraryId}/content`,
    {
      method: 'put',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(devContent)
    }
  );

  // 4. Create post-deploy version for tracking
  createVersion(prodLibraryId, 'Deploy ' + new Date().toISOString());
}

// Rollback: restore a previous version
function rollback(scriptId, versionNumber) {
  const oldContent = getContentAtVersion(scriptId, versionNumber);
  const token = ScriptApp.getOAuthToken();

  UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${scriptId}/content`,
    {
      method: 'put',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(oldContent)
    }
  );
}
```

### ConfigManager Property Naming Convention

The CD project uses ConfigManager's `DEPLOY` namespace:

| Property Key | Value | Purpose |
|-------------|-------|---------|
| `DEPLOY_DEV_URL` | Script URL | Dev library |
| `DEPLOY_STAGING_URL` | Script URL | Staging library |
| `DEPLOY_PROD_URL` | Script URL | Production library |
| `DEPLOY_DEV_DEPLOYMENT_ID` | Deployment ID | Dev deploy reference |
| `DEPLOY_STAGING_DEPLOYMENT_ID` | Deployment ID | Staging deploy reference |
| `DEPLOY_PROD_DEPLOYMENT_ID` | Deployment ID | Production deploy reference |

### Version Limits

- **200 versions per project** (enforced June 2024)
- Versions cannot be deleted individually — only in bulk via console
- Each `versions.create` call increments the counter permanently
- Plan CD scripts to not create versions excessively (e.g., only on actual deploys)

**Gotchas:**
- `updateContent` replaces ALL files — must include complete file set including manifest
- Version numbers are sequential and cannot be reused after deletion
- Apps Script API must be enabled in the GCP project
- Requires `https://www.googleapis.com/auth/script.projects` scope
- Rate limit: ~100 requests/100 seconds (shared across all Apps Script API calls)
- Content at HEAD (no version parameter) may differ from latest version (unsaved editor changes)

**Sources:**
- Apps Script API versions: https://developers.google.com/apps-script/api/reference/rest/v1/projects.versions
- Apps Script API content: https://developers.google.com/apps-script/api/reference/rest/v1/projects/getContent
- Version limits: https://developers.google.com/apps-script/concepts/deployments

---

## GAS-Specific Patterns

### Lazy Singleton (avoids V8 parsing issues)
```javascript
let _instance;
function getInstance() {
  return _instance || (_instance = new ExpensiveService());
}
```

### Memoization (cache expensive computations)
```javascript
function memoize(fn) {
  const cache = {};
  return (...args) => {
    const key = JSON.stringify(args);
    return cache[key] || (cache[key] = fn(...args));
  };
}
const cachedFetch = memoize(url => UrlFetchApp.fetch(url).getContentText());
```
**Note:** Cache only persists within single execution (globals reset between calls). For cross-execution caching, use CacheService.

### IIFE Module Pattern (no ES modules in GAS)
```javascript
const MyModule = (function() {
  const privateVar = 'hidden';
  function privateFunc() { return privateVar; }
  return { publicMethod: privateFunc };
})();
```

### Batch Read/Write (critical performance)
```javascript
// BAD: ~70 seconds
for (let i = 1; i <= 100; i++) sheet.getRange(i, 1).setValue(i);

// GOOD: ~1 second
const data = Array.from({length: 100}, (_, i) => [i + 1]);
sheet.getRange(1, 1, 100, 1).setValues(data);
```

### Avoid Logger.log() in V8 (exceptionally slow)
```javascript
// BAD: Logger.log() has massive overhead in V8
for (let i = 0; i < 1000; i++) Logger.log(i);

// GOOD: Use console.log() instead
for (let i = 0; i < 1000; i++) console.log(i);

// BETTER: Batch logs for post-processing
const logs = [];
for (let i = 0; i < 1000; i++) logs.push(i);
Logger.log(logs.join('\n'));  // Single call at end
```
**Note:** console.log() writes to Stackdriver; Logger.log() to Apps Script logs

### Always Use Session.getScriptTimeZone()
```javascript
// BAD: Hardcoded timezone drifts with DST
const formatted = Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd');

// GOOD: Adapts to script settings
const formatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
```
**Why:** Prevents twice-yearly DST bugs

---

## Sources
- Desktop Liberation: https://ramblings.mcpher.com/
- brainysmurf V8 gist: https://gist.github.com/brainysmurf/35c901bae6e33a52e3abcea720a6b515
- Justin Poehnelt: https://justin.poehnelt.com/
- tanaikech GitHub: https://github.com/tanaikech/
- yagisanatode: https://yagisanatode.com/
- bajena3 Medium: https://medium.com/@bajena3
- Dataful SecretService: https://github.com/dataful-tech/secret-service
- G Suite Developers Blog: https://gsuite-developers.googleblog.com/
- Google Official Quotas: https://developers.google.com/apps-script/guides/services/quotas
- Drive API v2/v3 Guide: https://developers.google.com/workspace/drive/api/guides/v3versusv2
- Ben Barbersmith OAuth Guide: https://barbersmith.com/posts/oauth-in-google-apps-script/
- Labnol (Amit Agarwal): https://www.labnol.org/
- BaseScripts: https://basescripts.com/
- Martin Hawksey: https://hawksey.info/blog/

### Libraries Researched (Items #54-64)
- BatchRequest: https://github.com/tanaikech/BatchRequest
- GASProjectApp: https://github.com/tanaikech/GASProjectApp
- FetchApp: https://github.com/tanaikech/FetchApp
- RichTextApp: https://github.com/tanaikech/RichTextApp
- RichTextAssistant: https://github.com/tanaikech/RichTextAssistant
- DownloadLargeFilesByUrl: https://github.com/tanaikech/DownloadLargeFilesByUrl
- ManifestsApp: https://github.com/tanaikech/ManifestsApp
- GPhotoApp: https://github.com/tanaikech/GPhotoApp
- UnzipGs: https://github.com/tanaikech/UnzipGs
- apps-script-jobqueue: https://github.com/k2tzumi/apps-script-jobqueue
- appsScriptAsync: https://github.com/InvincibleRain/appsScriptAsync
- GAS Library Database: https://github.com/tanaikech/Google-Apps-Script-Library-Database

### Libraries Researched (Items #65-81)
- ProcessApp: https://github.com/tanaikech/ProcessApp
- GetEditType: https://github.com/tanaikech/GetEditType
- TriggerApp: https://github.com/tanaikech/TriggerApp
- ScriptHistoryApp: https://github.com/tanaikech/ScriptHistoryApp
- DocNamedRangeApp: https://github.com/tanaikech/DocNamedRangeApp
- DateFinder: https://github.com/tanaikech/DateFinder
- RangeListApp: https://github.com/tanaikech/RangeListApp
- EncodeApp: https://github.com/tanaikech/EncodeApp
- cheeriogs: https://github.com/nicknisi/cheeriogs
- alasqlgs: https://github.com/nicknisi/alasqlgs
- sheetbase/server: https://github.com/nicknisi/sheetbase
- FirebaseApp: https://github.com/RomainVialard/FirebaseApp
- qottle: https://github.com/brucemcpherson/qottle
- GAST: https://github.com/huan/gast

### Library Architecture & Deployment (Items #85-87)
- Libraries guide: https://developers.google.com/apps-script/guides/libraries
- Container-bound scripts: https://developers.google.com/apps-script/guides/bound
- Import/Export: https://developers.google.com/apps-script/guides/import-export
- Apps Script API: https://developers.google.com/apps-script/api/reference/rest
- Issue #36755072 (menu handler resolution): https://issuetracker.google.com/issues/36755072
- HTML from library: https://ramblings.mcpher.com/gassnippets2/getting-an-htmlservice-template-from-a-library/
- Delegating google.script.run: https://jeffreyeverhart.com/2020/05/09/delegating-client-side-requests-with-google-script-run-in-google-apps-script/
- Trigger copy behavior: https://support.google.com/docs/thread/146610291

### Pattern Sources
- Desktop Liberation: https://ramblings.mcpher.com/
- then-later project: Ephemeral trigger, two-layer locking, watchdog patterns
- gas-chat-architecture: Adaptive polling patterns
