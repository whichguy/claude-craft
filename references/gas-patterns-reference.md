# GAS Patterns Reference
Quick reference guide for Google Apps Script code patterns and anti-patterns

---

## CommonJS Module System

### ✅ Correct Patterns

```javascript
// Importing modules
const utils = require('Utils');
const { helper, validator } = require('Helpers');
const config = require('ConfigManager');

// Exporting functions
function processData(data) {
  return data.filter(x => x.active);
}

function validateInput(input) {
  return input && input.length > 0;
}

module.exports = {
  processData,
  validateInput
};

// Alternative export syntax
exports.processData = processData;
exports.validateInput = validateInput;
```

### ❌ Anti-Patterns

```javascript
// ❌ Direct reference without require
var utils = Utils;  // Won't work with modules

// ❌ Not exporting functions
function helperFunc() {
  return "data";
}
// Other modules can't require this

// ❌ Exporting without module.exports
return { helperFunc };  // Doesn't assign to module.exports
```

---

## CommonJS Infrastructure

### ✅ Correct Structure

```javascript
function _main(module, exports, require) {
  // All user code goes inside _main
  const config = require('ConfigManager');

  function processData(data) {
    return config.get('processor')(data);
  }

  module.exports = { processData };
  return module.exports;  // Must return
}

__defineModule__('DataProcessor', _main, { loadNow: false });
```

### ❌ Anti-Patterns

```javascript
// ❌ Code outside _main
const globalVar = "bad";  // Won't have access to require

function _main(module, exports, require) {
  // Module code
}

// ❌ Wrong signature
function _main(m, e, r) { }  // Parameter names matter

// ❌ Missing return
function _main(module, exports, require) {
  exports.func = () => {};
  // Missing: return module.exports;
}

// ❌ __defineModule__ before _main
__defineModule__('Utils', _main);  // _main not defined yet
function _main(module, exports, require) { }

// ❌ Name mismatch
// File: Calculator.gs
__defineModule__('Utils', _main);  // Wrong name
```

---

## loadNow Configuration

### ✅ Event Handlers (loadNow: true)

```javascript
function _main(module, exports, require) {
  function onOpen(e) {
    SpreadsheetApp.getUi()
      .createMenu('Custom')
      .addItem('Action', 'doAction')
      .addToUi();
  }

  function onEdit(e) {
    // Edit handler
  }

  module.exports = { onOpen, onEdit };
  return module.exports;
}

__defineModule__('Triggers', _main, { loadNow: true });  // ✅ Required
```

### ✅ Utilities (loadNow: false)

```javascript
function _main(module, exports, require) {
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function slugify(str) {
    return str.toLowerCase().replace(/\s+/g, '-');
  }

  module.exports = { capitalize, slugify };
  return module.exports;
}

__defineModule__('StringUtils', _main, { loadNow: false });  // ✅ Lazy load
```

### ❌ Anti-Patterns

```javascript
// ❌ Event handler with loadNow: false
function _main(module, exports, require) {
  function onOpen(e) { /* handler */ }
  module.exports = { onOpen };
  return module.exports;
}
__defineModule__('Menu', _main, { loadNow: false });  // Won't register!

// ❌ Utility with loadNow: true (no harm, but slower startup)
__defineModule__('StringUtils', _main, { loadNow: true });  // Unnecessary
```

---

## Event Handlers

### ✅ Simple Triggers

```javascript
function _main(module, exports, require) {
  function onOpen(e) {
    // Menu setup
  }

  function onEdit(e) {
    const range = e.range;
    const value = e.value;
    // Validation logic
  }

  module.exports = { onOpen, onEdit };
  return module.exports;
}

__defineModule__('Triggers', _main, { loadNow: true });
```

### ✅ Custom Events (__events__ Object)

```javascript
function _main(module, exports, require) {
  function customOpenHandler(e) {
    // Custom logic
  }

  function customEditHandler(e) {
    // Custom logic
  }

  module.exports = {
    __events__: {
      onOpen: 'customOpenHandler',
      onEdit: 'customEditHandler'
    },
    customOpenHandler,
    customEditHandler
  };

  return module.exports;
}

__defineModule__('CustomTriggers', _main, { loadNow: true });
```

### ✅ Web App Handlers

```javascript
function _main(module, exports, require) {
  function doGet(e) {
    const page = e.parameter.page || 'home';
    return HtmlService.createHtmlOutput(`<h1>${page}</h1>`);
  }

  function doPost(e) {
    try {
      const data = JSON.parse(e.postData.contents);
      // Process data
      return ContentService
        .createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: error.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  module.exports = { doGet, doPost };
  return module.exports;
}

__defineModule__('WebApp', _main, { loadNow: true });
```

### ❌ Anti-Patterns

```javascript
// ❌ Wrong function name
function openHandler(e) { }  // GAS won't recognize
module.exports = { onOpen: openHandler };  // Still wrong

// ❌ Not exported
function onOpen(e) { }
module.exports = { };  // Forgot to export

// ❌ __events__ function not exported
module.exports = {
  __events__: { onOpen: 'handler' }
  // But 'handler' not in exports
};

// ❌ Web app not returning HtmlOutput/TextOutput
function doGet(e) {
  return "Hello";  // Must return HtmlOutput
}
```

---

## Configuration Management

### ✅ ConfigManager Usage

```javascript
const config = require('ConfigManager');

// Reading config
const apiKey = config.get('API_KEY');
const timeout = config.get('timeout', 'user');  // User-specific
const dbUrl = config.get('database.url');  // Nested

// Writing config
config.set('theme', 'dark', 'user');
config.set('API_KEY', 'new-key');  // Script property

// Default values
const port = config.get('port') || 3000;
```

### ❌ Anti-Patterns

```javascript
// ❌ Direct PropertiesService usage
const apiKey = PropertiesService
  .getScriptProperties()
  .getProperty('API_KEY');

PropertiesService.getUserProperties()
  .setProperty('theme', 'dark');

// ❌ Hardcoded configuration
const API_KEY = 'sk-1234567890';  // Never hardcode secrets

// ❌ Inconsistent config access
const key1 = PropertiesService.getScriptProperties().getProperty('key1');
const key2 = config.get('key2');  // Mixing approaches
```

---

## Client-Server Communication

### ✅ exec() Usage

```javascript
// Simple execution
const result = await exec(`
  const config = require('ConfigManager');
  return config.get('apiKey');
`);

// With parameters
const input = { name: 'John', age: 30 };
const data = await exec(`
  const user = ${JSON.stringify(input)};
  const processor = require('UserProcessor');
  return processor.validate(user);
`);

// With error handling
try {
  const result = await exec(`
    require('DataProcessor').processLargeData()
  `);
} catch (error) {
  console.error('Processing failed:', error);
}
```

### ✅ exec_api() Usage

```javascript
// Simple function call
const result = await exec_api('processData', [userData]);

// With multiple parameters
const response = await exec_api('saveRecord', [record, options]);

// With error handling
try {
  const data = await exec_api('fetchUserData', [userId]);
  if (!data.success) {
    throw new Error(data.error);
  }
  return data.result;
} catch (error) {
  handleError(error);
}
```

### ❌ Anti-Patterns

```javascript
// ❌ No await
exec("someFunction()");  // Won't wait for result

// ❌ Object not serialized
const obj = { name: 'John' };
exec(`doWork(${obj})`);  // Will be [object Object]

// ❌ Function doesn't exist
exec_api('nonExistentFunc', [data]);

// ❌ No error handling
const data = await exec_api('riskyOperation', [params]);
// What if it fails?
```

---

## Async Operations

### ✅ Queue Channels

```javascript
// Creating and using a queue channel
const channel = QueueChannel.create('progressUpdates');

channel.onMessage((data) => {
  try {
    updateProgressBar(data.progress);
    if (data.status === 'complete') {
      channel.close();
    }
  } catch (error) {
    Logger.log(`Message handler error: ${error}`);
  }
});

// Server sends updates
for (let i = 0; i <= 100; i += 10) {
  channel.send({ progress: i, status: i < 100 ? 'processing' : 'complete' });
  Utilities.sleep(1000);
}
```

### ✅ thenAfter Background Jobs

```javascript
function _main(module, exports, require) {
  function startProcessing(data) {
    processBatch(data.slice(0, 100));

    if (data.length > 100) {
      // Schedule next batch
      thenAfter(60000, 'continueProcessing', {
        remaining: data.slice(100),
        batchNumber: 2
      });
    }
  }

  function continueProcessing(params) {
    try {
      processBatch(params.remaining.slice(0, 100));

      if (params.remaining.length > 100) {
        thenAfter(60000, 'continueProcessing', {
          remaining: params.remaining.slice(100),
          batchNumber: params.batchNumber + 1
        });
      }
    } catch (error) {
      Logger.log(`Batch ${params.batchNumber} failed: ${error}`);
      // Optionally retry
      thenAfter(120000, 'continueProcessing', params);
    }
  }

  module.exports = { startProcessing, continueProcessing };
  return module.exports;
}

__defineModule__('BatchProcessor', _main, { loadNow: false });
```

### ❌ Anti-Patterns

```javascript
// ❌ setTimeout in GAS (won't work as expected)
setTimeout(() => doWork(), 5000);  // Use thenAfter

// ❌ Queue channel without error handling
channel.onMessage(data => {
  processData(data);  // What if this throws?
});

// ❌ thenAfter callback not exported
thenAfter(60000, 'processNext', {});
// But 'processNext' not in module.exports

// ❌ No channel cleanup
channel.send(data);  // Never calls channel.close()
```

---

## GAS API Best Practices

### ✅ Batch Operations

```javascript
// Batch read
const sheet = SpreadsheetApp.getActiveSheet();
const data = sheet.getRange(1, 1, 100, 5).getValues();  // 1 API call

// Batch write
const values = data.map(row => [row[0], row[1] * 2]);
sheet.getRange(1, 1, values.length, 2).setValues(values);  // 1 API call
```

### ✅ Null Safety

```javascript
const sheet = SpreadsheetApp.getActiveSheet();
if (!sheet) {
  throw new Error('No active sheet');
}

const range = sheet.getRange('A1');
const value = range.getValue();
```

### ✅ Error Handling

```javascript
try {
  const file = DriveApp.getFileById(fileId);
  return file.getName();
} catch (error) {
  Logger.log(`File access failed: ${error.message}`);
  return null;
}

try {
  GmailApp.sendEmail(to, subject, body);
} catch (error) {
  Logger.log(`Email failed: ${error.message}`);
  // Notify admin or retry
}
```

### ❌ Anti-Patterns

```javascript
// ❌ Loop with individual API calls
for (let i = 0; i < 100; i++) {
  sheet.getRange(i + 1, 1).setValue(data[i]);  // 100 API calls!
}

// ❌ No null check
const value = SpreadsheetApp.getActiveSheet().getRange('A1').getValue();
// What if no active sheet?

// ❌ No error handling for risky operations
GmailApp.sendEmail(to, subject, body);  // Can fail on quota/permissions
```

---

## JavaScript Syntax & ES6

### ✅ Modern JavaScript

```javascript
// const/let over var
const API_URL = 'https://api.example.com';
let counter = 0;

// Arrow functions
const double = x => x * 2;
const data = items.map(item => item.value);

// Template literals
const message = `Hello ${name}, you have ${count} items`;

// Destructuring
const { firstName, lastName, email } = user;
const [first, second, ...rest] = array;

// Spread operator
const merged = { ...defaults, ...userOptions };
const newArray = [...oldArray];

// Async/await
async function fetchData() {
  try {
    const response = await UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    return data;
  } catch (error) {
    Logger.log(`Fetch error: ${error}`);
    throw error;
  }
}

// Parameter defaults
function processData(data, options = {}) {
  const { timeout = 5000, retry = 3 } = options;
  // Use timeout and retry
}
```

### ❌ Anti-Patterns

```javascript
// ❌ var instead of const/let
var name = "John";
var count = 0;

// ❌ Old function syntax for callbacks
data.map(function(item) {
  return item.value;
});

// ❌ String concatenation
var message = "Hello " + name + ", you have " + count + " items";

// ❌ Manual property extraction
const firstName = user.firstName;
const lastName = user.lastName;
const email = user.email;

// ❌ Promise chains instead of async/await
function fetchData() {
  return UrlFetchApp.fetch(url)
    .then(response => response.getContentText())
    .then(text => JSON.parse(text))
    .catch(error => Logger.log(error));
}
```

---

## Scope & Global Variables

### ✅ Module-Scoped Variables

```javascript
function _main(module, exports, require) {
  // Scoped to module via closure
  const cache = {};
  let requestCount = 0;

  function getData(key) {
    requestCount++;
    return cache[key];
  }

  function setData(key, value) {
    cache[key] = value;
  }

  function getStats() {
    return { requestCount, cacheSize: Object.keys(cache).length };
  }

  module.exports = { getData, setData, getStats };
  return module.exports;
}
```

### ✅ Singleton Pattern for Shared State

```javascript
// SharedState.gs
function _main(module, exports, require) {
  const state = {
    cache: {},
    config: {}
  };

  module.exports = {
    get: (key) => state.cache[key],
    set: (key, value) => state.cache[key] = value,
    clear: () => state.cache = {}
  };

  return module.exports;
}

__defineModule__('SharedState', _main, { loadNow: true });

// Usage in other modules
const state = require('SharedState');
state.set('lastUser', userData);
```

### ❌ Anti-Patterns

```javascript
// ❌ Global variables
var globalCache = {};  // Outside _main

function _main(module, exports, require) {
  function getData() {
    return globalCache.data;  // Bad
  }
  module.exports = { getData };
  return module.exports;
}

// ❌ Implicit globals
function _main(module, exports, require) {
  function process() {
    result = compute();  // Missing const/let/var!
    return result;
  }
  module.exports = { process };
  return module.exports;
}
```

---

## Quick Fixes

### Replace PropertiesService with ConfigManager

**Before:**
```javascript
const apiKey = PropertiesService.getScriptProperties().getProperty('API_KEY');
PropertiesService.getUserProperties().setProperty('theme', 'dark');
```

**After:**
```javascript
const config = require('ConfigManager');
const apiKey = config.get('API_KEY');
config.set('theme', 'dark', 'user');
```

### Convert var to const/let

**Before:**
```javascript
var name = "John";
var count = 0;
count++;
```

**After:**
```javascript
const name = "John";
let count = 0;
count++;
```

### Use Template Literals

**Before:**
```javascript
const message = "Hello " + name + ", you have " + count + " items";
```

**After:**
```javascript
const message = `Hello ${name}, you have ${count} items`;
```

**GAS HTML Include Caveat:**
Template literals with `://` break in GAS HTML includes. Keep concatenation for URLs:
```javascript
// ❌ BREAKS in files loaded via include()
const apiUrl = `https://example.com/api`;

// ✓ Works in include() files
const apiUrl = "https:" + "//example.com/api";
```

**Intentional exceptions (keep concatenation):**
```javascript
Logger.log('[ERROR] ' + e.message);           // Prefix separation
const regex = new RegExp('^' + pattern + '$'); // Regex construction
```

### Batch GAS API Calls

**Before:**
```javascript
for (let i = 0; i < data.length; i++) {
  sheet.getRange(i + 1, 1).setValue(data[i]);
}
```

**After:**
```javascript
const values = data.map(v => [v]);
sheet.getRange(1, 1, values.length, 1).setValues(values);
```

### Add loadNow to Event Handlers

**Before:**
```javascript
__defineModule__('Menu', _main, {});
```

**After:**
```javascript
__defineModule__('Menu', _main, { loadNow: true });
```

---

## Common Mistake Patterns

| Anti-Pattern | Fix | Reasoning |
|-------------|-----|-----------|
| `var x = 1;` | `const x = 1;` or `let x = 1;` | Avoid function-scoped var |
| `"Hello " + name` | `` `Hello ${name}` `` | Template literals (except URLs in HTML includes) |
| `function(x) { return x; }` | `x => x` | Arrow functions in callbacks |
| `const a = obj.a; const b = obj.b;` | `const { a, b } = obj;` | Destructuring |
| `arr.slice()` | `[...arr]` | Spread operator for copies |
| `Object.assign({}, a, b)` | `{ ...a, ...b }` | Spread operator for merging |
| `PropertiesService.getScriptProperties()` | `config.get('key')` | Use ConfigManager |
| `setTimeout(fn, 1000)` | `thenAfter(1000, 'fn', {})` | GAS doesn't support setTimeout properly |
| Code before `_main` | Move inside `_main` | Code outside won't have module system access |
| `loadNow` not set | Set `loadNow: true/false` | Explicit is better than implicit |
| No exports | Add `module.exports = {...}` | Other modules can't require |
| Loop with GAS API calls | Batch with `setValues()` | Reduce API call count |
| No error handling | Add `try-catch` | Prevent runtime failures |
| Event handler, `loadNow: false` | `loadNow: true` | Handlers must load at startup |

---

## Severity Levels

### 🔴 Critical (Prevents Execution)
- Syntax errors
- Undefined require() modules
- Missing exports for referenced functions
- Code outside _main wrapper
- Event handlers without loadNow: true
- Missing __defineModule__ call

### ⚠️ Warning (Runtime Issues)
- Missing error handling
- PropertiesService instead of ConfigManager
- Inefficient GAS API usage (loops)
- Global variables
- loadNow mismatch
- var instead of const/let

### ℹ️ Info (Best Practices)
- Old function syntax vs arrow functions
- String concatenation vs template literals
- Missing destructuring opportunities
- Code organization suggestions
- Missing JSDoc comments

---

## Folder Organization (Pseudo-directories via Filename Prefixes)

GAS has no real folders - it uses filename prefixes to simulate directory structure. The prefix becomes part of the filename (e.g., `handlers/Menu.gs` is stored as `handlers-Menu` internally).

### Recommended Folder Prefixes (Node.js Convention Style)

```
src/            → Source code root (optional top-level prefix)

handlers/       → Event handlers requiring loadNow: true
  handlers/Menu.gs           - onOpen, menu creation
  handlers/WebApp.gs         - doGet, doPost
  handlers/Triggers.gs       - onEdit, onChange, time-driven

services/       → Business logic and orchestration
  services/UserService.gs    - User operations
  services/EmailService.gs   - Email composition and sending
  services/DataService.gs    - Data transformation logic

lib/            → Shared libraries and utilities (Node convention)
  lib/StringUtils.gs         - String manipulation
  lib/DateUtils.gs           - Date formatting/parsing
  lib/ArrayUtils.gs          - Array operations
  lib/ValidationUtils.gs     - Input validation

data/           → Data access layer (GAS API wrappers)
  data/SheetRepository.gs    - SpreadsheetApp operations
  data/DriveRepository.gs    - DriveApp operations
  data/CacheRepository.gs    - CacheService operations

models/         → Data structures and validation
  models/User.gs             - User data structure
  models/Transaction.gs      - Transaction model
  models/Validator.gs        - Schema validation

config/         → Configuration modules
  config/AppConfig.gs        - Application settings
  config/FeatureFlags.gs     - Feature toggles
  config/Secrets.gs          - API key retrieval

api/            → External API integrations
  api/SlackClient.gs         - Slack API wrapper
  api/GithubClient.gs        - GitHub API wrapper
  api/StripeClient.gs        - Stripe API wrapper

html/           → HTML templates (SEPARATE from CSS and JS)
  html/index.html            - Main page template
  html/sidebar.html          - Sidebar template
  html/dialog.html           - Dialog/modal templates
  html/partials/             - Reusable HTML fragments
    html/partials/header.html
    html/partials/footer.html

css/            → Stylesheets (SEPARATE folder)
  css/styles.html            - Main stylesheet (GAS uses .html extension)
  css/components.html        - Component styles
  css/variables.html         - CSS custom properties
  css/themes/                - Theme variants
    css/themes/dark.html
    css/themes/light.html

js/             → Client-side JavaScript (SEPARATE folder)
  js/app.html                - Main client app (GAS uses .html extension)
  js/components.html         - UI component scripts
  js/utils.html              - Client-side utilities
  js/vendor/                 - Third-party libraries
    js/vendor/bootstrap.html

tests/          → Test files (position last in execution order)
  tests/UserService.test.gs  - Service tests
  tests/DataUtils.test.gs    - Utility tests
```

**Note:** GAS stores all HTML, CSS, and JS in `.html` files. Use folder prefixes to maintain logical separation despite the single extension.

### File Naming Conventions

| Pattern | Example | Purpose |
|---------|---------|---------|
| `prefix/Name.gs` | `handlers/Menu.gs` | Organized module |
| `prefix/Name.test.gs` | `tests/Menu.test.gs` | Test file |
| `Name.gs` | `Code.gs` | Root-level module |
| `appsscript.json` | - | Manifest (special) |

### loadNow Settings by Prefix

| Prefix | loadNow | Reason |
|--------|---------|--------|
| `handlers/` | `true` | Event handlers must register at startup |
| `services/` | `false` | Business logic loaded on demand |
| `lib/` | `false` | Shared libraries loaded on demand |
| `data/` | `false` | Data access loaded on demand |
| `models/` | `false` | Models loaded on demand |
| `config/` | `true` | Config often needed early |
| `api/` | `false` | API clients loaded on demand |
| `html/` | N/A | HTML templates (not CommonJS modules) |
| `css/` | N/A | Stylesheets (not CommonJS modules) |
| `js/` | N/A | Client-side JS (not CommonJS modules) |
| `tests/` | `false` | Tests run explicitly |

### Execution Order Considerations

GAS executes files based on `position` field. Critical ordering:

```
Position 0: require.gs         (CommonJS module system - MUST be first)
Position 1: ConfigManager.gs   (Configuration system)
Position 2: __mcp_exec.gs      (Execution infrastructure)
Position 3+: Application code  (handlers, services, etc.)
Position N: tests/*.gs         (Tests should be last)
```

### Example: Splitting a Large File

**Before (500+ lines in one file):**
```javascript
// Code.gs - doing everything
function _main(module, exports) {
  function onOpen(e) { /* menu setup */ }
  function doGet(e) { /* web app */ }
  function processUser(data) { /* business logic */ }
  function getSheetData() { /* data access */ }
  function formatDate(date) { /* utility */ }
  function buildDialog() { /* UI helper */ }

  module.exports = {
    __events__: { onOpen: 'onOpen', doGet: 'doGet' },
    onOpen, doGet, processUser, getSheetData, formatDate, buildDialog
  };
}
__defineModule__('Code', _main, { loadNow: true });
```

**After (split by concern):**

```javascript
// handlers/Menu.gs
function _main(module, exports) {
  function onOpen(e) {
    SpreadsheetApp.getUi().createMenu('App').addToUi();
  }
  module.exports = { __events__: { onOpen: 'onOpen' }, onOpen };
}
__defineModule__('handlers/Menu', _main, { loadNow: true });
```

```javascript
// handlers/WebApp.gs
function _main(module, exports) {
  function doGet(e) {
    return HtmlService.createHtmlOutput('Welcome');
  }
  module.exports = { __events__: { doGet: 'doGet' }, doGet };
}
__defineModule__('handlers/WebApp', _main, { loadNow: true });
```

```javascript
// services/UserService.gs
function _main(module, exports) {
  const data = require('data/SheetRepository');
  function processUser(userData) {
    return data.saveUser(userData);
  }
  return { processUser };
}
__defineModule__('services/UserService', _main);
```

```javascript
// data/SheetRepository.gs
function _main(module, exports) {
  function getSheetData() {
    return SpreadsheetApp.getActiveSpreadsheet().getDataRange().getValues();
  }
  function saveUser(user) { /* ... */ }
  return { getSheetData, saveUser };
}
__defineModule__('data/SheetRepository', _main);
```

```javascript
// lib/DateUtils.gs
function _main(module, exports) {
  function formatDate(date) {
    return Utilities.formatDate(date, 'GMT', 'yyyy-MM-dd');
  }
  return { formatDate };
}
__defineModule__('lib/DateUtils', _main);
```

```javascript
// ui/DialogBuilder.gs
function _main(module, exports) {
  function buildDialog(title, content) {
    return HtmlService.createHtmlOutput(content).setTitle(title);
  }
  return { buildDialog };
}
__defineModule__('ui/DialogBuilder', _main);
```

### Benefits of Folder Organization

| Benefit | Description |
|---------|-------------|
| **Discoverability** | Find code by function type |
| **Lazy Loading** | Only load utils/data when needed |
| **Testing** | Test modules in isolation |
| **Code Review** | Smaller, focused changesets |
| **Refactoring** | Move entire folders/prefixes |
| **Team Collaboration** | Assign ownership by folder |
