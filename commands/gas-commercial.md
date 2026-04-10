# /gas-commercial - Commercial GAS Distribution, Monetization & Update Patterns

Reference for commercially packaging, distributing, monetizing, and updating Google Apps Script projects. Covers Marketplace add-ons, web apps, template sales, licensing, feature gating, and update propagation.

**AUTOMATICALLY INVOKE** when:
- User asks about selling or monetizing a GAS project
- Questions about Marketplace publishing, add-on distribution, pricing
- Licensing patterns (license keys, feature gating, tiers, subscriptions)
- Commercial update strategies (how updates reach users, rollback)
- Copy protection for GAS code or templates
- User asks "how do I sell...", "how do I distribute...", "how do I monetize..."
- Add-on packaging, deployment for commercial use
- Template sales via Gumroad, Etsy, AppSumo

**KEY TOPICS:** Marketplace publishing | add-on packaging | monetization | licensing | feature gating |
update propagation | rollback | copy protection | freemium | RSA license keys | QuadRamp |
template sales | web app SaaS | Gumroad | AppSumo | Etsy | CI/CD deployment |
PropertiesService tiers | CacheService licensing | Marketplace listing optimization |
domain-wide install | OAuth scopes | breaking change migration | environment management |
library thin client | template architecture | deployment service | CommonJS container | auto-update HEAD

Invoke with filter: `/gas-commercial monetization` or `/gas-commercial updates` or `/gas-commercial licensing`

---

## 1. Commercial Distribution Channels

### Channel A: Google Workspace Marketplace (Add-on)

The "official" route. Your script becomes an installable add-on.

**Pros:**
- Built-in discovery (Marketplace search, Editor's Choice)
- Auto-update mechanism (users get new versions seamlessly)
- Domain-wide admin install (enterprise)
- Trust signal (Google-reviewed for public add-ons)
- No listing fee from Google

**Cons:**
- Public listing requires Google review (can be slow, opaque)
- No built-in payment/billing - must integrate third-party
- Must maintain GCP project, OAuth consent screen, scopes
- 200-version limit per project (enforced June 2024)
- Users must authorize scopes; new scopes require re-authorization

**Best for:** Recurring-revenue SaaS, enterprise tools, products needing broad distribution.

**Two sub-types:**
- **Editor Add-ons**: HTML/CSS UI via HtmlService, desktop only, 6-min execution limit, deep spreadsheet/doc integration
- **Workspace Add-ons (GWAO)**: CardService widgets only, desktop+mobile, 30-second limit, cross-app (Gmail/Calendar/Drive/Docs/Sheets/Slides/Meet)

### Channel B: Web App (doGet/doPost)

Deploy GAS as a standalone web application accessible via URL.

**Pros:**
- Full HTML/CSS/JS UI (no card widget constraints)
- Direct URL sharing (no Marketplace required)
- Can serve as API endpoint (JSON/text responses via ContentService)
- Execute as owner or user (flexible auth models)
- Can embed in external sites

**Cons:**
- URL changes with new deployments if not managed correctly
- 6-minute execution limit
- No mobile app distribution
- Must handle own user management/auth
- `/exec` vs `/dev` URL confusion

**Best for:** Custom dashboards, internal tools, API services, embeddable widgets.

### Channel C: Template Sales (Gumroad/Etsy/AppSumo)

Sell spreadsheets with embedded Apps Script as digital products.

**Pros:**
- Immediate revenue (one-time or subscription via platform)
- Simple distribution ("Make a copy" link)
- No Google review process
- Platforms handle payments (Gumroad, Etsy, Sellfy, AppSumo)
- Low barrier to entry

**Cons:**
- No auto-update mechanism (users have static copies)
- Copy protection is weak (viewer-only + forced copy is the best you get)
- Scripts visible in Script Editor (no code obfuscation in GAS)
- Each user gets independent copy - no centralized management
- Support burden for version fragmentation

**Real revenue examples:**
- Better Sheets: ~$100K/year, mainly via AppSumo
- Gorilla ROI (Sheets add-on): $276K/year, team of 2
- One developer: $100K with 8% monthly growth after free-to-premium transition

**Best for:** Niche tools, budget trackers, templates, one-time-purchase products.

### Channel D: Library Distribution

Publish as a GAS Library that other developers include.

**Pros:**
- Version-pinned (consumers choose which version)
- Reusable across projects
- Can be private or public

**Cons:**
- Performance penalty (library loaded on every execution = cold start latency ~1-3s per library)
- Limited audience (developers only)
- No direct monetization path
- Consumer must explicitly update version pin

**Best for:** Developer tools, shared utilities, framework distribution.

---

## 2. Monetization Strategies

### Strategy 1: Freemium Add-on (Most Common for Marketplace)

```
Free tier (limited features/usage)
  -> In-add-on upgrade prompt
    -> Redirect to external payment page (Stripe/ChargeBee/QuadRamp)
      -> License key or subscription activated
        -> Feature gate checks on each use
```

**Implementation pattern:**
```javascript
function checkLicense() {
  const email = Session.getActiveUser().getEmail();
  const cached = CacheService.getUserCache().get('license_' + email);
  if (cached) return JSON.parse(cached);

  const response = UrlFetchApp.fetch('https://your-api.com/license/check', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ email: email })
  });
  const license = JSON.parse(response.getContentText());

  // Cache for 1 hour to reduce API calls
  CacheService.getUserCache().put('license_' + email, JSON.stringify(license), 3600);
  return license;
}

function premiumFeature() {
  const license = checkLicense();
  if (license.tier !== 'premium') {
    showUpgradePrompt_();
    return;
  }
  // ... premium logic
}
```

**Key conversion metric:** ~2% free-to-paid is average for in-app conversions.

### Strategy 2: License Key Validation (RSA-based)

For products sold outside Marketplace (Gumroad, direct sales):

```
Generate RSA key pair (2048-bit)
  -> Sign (buyer_email + SKU) with private key -> License key
    -> Buyer enters key in add-on
      -> Verify with public key (embedded or server-side)
```

**Two verification modes:**
- **Client-side**: Public key embedded in script. No server needed. Can't revoke.
- **Server-side**: Cloud Function/Run validates. Can revoke, expire, manage seats.

```javascript
// Server-side pattern (recommended)
function activateLicense(licenseKey) {
  const email = Session.getActiveUser().getEmail();
  const response = UrlFetchApp.fetch('https://your-api.com/activate', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ key: licenseKey, email: email })
  });
  const result = JSON.parse(response.getContentText());
  if (result.valid) {
    PropertiesService.getUserProperties().setProperty('license_key', licenseKey);
    PropertiesService.getUserProperties().setProperty('license_tier', result.tier);
  }
  return result;
}
```

**RSA key generation:**
```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private_key.pem
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

**Limitation:** GAS code is always visible to users in the Script Editor. Never embed private keys or secrets in script code.

### Strategy 3: Managed Monetization Platform (QuadRamp)

QuadRamp (quadramp.com) is purpose-built for GAS add-on monetization:
- 15-minute integration claim
- Stripe-powered payments
- Subscription + one-time models
- Usage tracking and analytics
- Currently supports: Docs, Sheets, Slides, Forms, Drive
- Coming soon: Calendar, Gmail, Meet

### Strategy 4: Template + Subscription Hybrid

Sell template via Gumroad/Etsy, with premium features requiring subscription:

```
Buy template ($29 one-time)
  -> Make a copy
    -> Basic features work immediately
      -> Premium features check UrlFetch to your backend
        -> Monthly subscription via Stripe ($5/mo)
```

---

## 3. Update Propagation Patterns

### For Marketplace Add-ons (Seamless Auto-Update)

The critical workflow:

```
1. Modify code locally
2. Push to GAS project (clasp push / mcp_gas write)
3. Test via head deployment
4. Deploy > Manage Deployments > Edit existing deployment
5. Select "New version" in Version section
6. Click Deploy
```

**NEVER use "New deployment" for updates:**
- Creates new deployment ID
- Disables ALL triggers on previous deployment
- Users lose functionality until they reinstall
- This is the #1 mistake in commercial add-on management

**Clasp equivalent:**
```bash
clasp push                              # Upload code to head
clasp deploy -i <deployId> -V <version> # Update existing deployment
# NOT: clasp deploy (creates NEW deployment each time)
```

**What users experience:**
- Code updates: Automatic, no action needed
- New scopes: Must re-authorize (prompted automatically)
- Breaking changes: No built-in migration - must handle in code

**Scope change process (if you add new OAuth scopes):**
1. Update `oauthScopes` in appsscript.json
2. Update Marketplace SDK scope configuration
3. Update OAuth consent screen
4. Submit new OAuth verification if sensitive scopes added
5. Users prompted to re-authorize on next use

### For Template Sales (Manual/Semi-Auto)

No built-in update mechanism. Options:

**Option A: Version check on open**
```javascript
function onOpen() {
  const currentVersion = '2.1.0';
  const latestVersion = getLatestVersion_(); // UrlFetch to your API
  if (currentVersion !== latestVersion) {
    SpreadsheetApp.getUi().alert(
      'Update Available',
      'Version ' + latestVersion + ' is available. Visit example.com/update to get the latest version.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
```

**Option B: Auto-updating code loader**
```javascript
function loadLatestModule_(moduleName) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('module_' + moduleName);
  if (cached) return cached;

  const code = UrlFetchApp.fetch('https://your-cdn.com/modules/' + moduleName + '.js').getContentText();
  cache.put('module_' + moduleName, code, 3600);
  return code;
}
// Then eval() - note: security implications, use with caution
```

**Option C: Library thin-client architecture (recommended)**
Use a GAS Library for all business logic, with a thin container script (~20 lines) that delegates to it. Library references at HEAD auto-update on every execution. See **Section 3.5** for full architecture.

### For Web Apps

- Update deployment to new version (same as add-ons)
- `/exec` URL always serves the active versioned deployment
- `/dev` URL always serves head (latest code)
- URL remains stable when updating existing deployment

### Deployment Types Reference

| Type | Purpose | Code Sync | Count |
|------|---------|-----------|-------|
| **Head** | Testing | Always latest saved code | 1 per project |
| **Versioned** | Production/public | Pinned to specific version | Multiple allowed |

**Version limits:** 200 versions per project (enforced June 2024). Unused versions can be deleted in bulk.

---

## 3.5 Template Distribution Architecture (Library + Thin Client)

### The Problem

When you sell a Google Sheet template (via Gumroad, Etsy, AppSumo), the buyer clicks "Make a copy." They get a snapshot of the spreadsheet **and** its container-bound script. From that moment, their copy is frozen — no auto-updates, no bug fixes, no new features. Every customer runs a different version. Support becomes impossible at scale.

### The Solution: 2-Layer Architecture

Separate the code users get (thin container) from the code you control (library):

```
USER'S SPREADSHEET (copied from template)
  Container-Bound Script (~20 lines, NO CommonJS):
    ├── onOpen(e)         → MyLib.buildMenu(SpreadsheetApp.getUi(), e)
    ├── exec_api(opts, module, fn, ...args)  → MyLib.exec_api(...)
    ├── showSidebar()     → MyLib.showSidebar(SpreadsheetApp.getUi())
    ├── initialize()      → MyLib.initialize()
    └── handleEdit(e)     → MyLib.handleEdit(e)
  Library Reference: MyLib @ HEAD (auto-updates on every execution)
        |
        v
LIBRARY (standalone project, you control)
  ├── require.gs (position 0) — full CommonJS system
  ├── All business logic modules
  ├── HTML/CSS/JS for sidebar
  ├── exec_api() dispatcher
  ├── Config management, license checking
  └── Versions created by CD project for rollback tracking
```

### What MUST Be in Container vs Library

| Component | Container (thin client) | Library | Why |
|-----------|------------------------|---------|-----|
| `onOpen(e)` | YES — delegates to library | Handler code | Simple triggers must be container globals |
| `onEdit(e)` | YES — delegates to library | Handler code | Simple triggers must be container globals |
| Menu handler functions | YES — delegates to library | Handler code | `addItem()` only resolves container globals ([Issue #36755072](https://issuetracker.google.com/issues/36755072)) |
| `exec_api()` | YES — delegates to library | Dispatcher + all modules | `google.script.run` targets container globals only |
| `showSidebar()` | YES — delegates to library | HTML evaluation | Container owns `Ui` object |
| `initialize()` | YES — delegates to library | First-run logic | Needs container's PropertiesService |
| CommonJS (`require.gs`) | NO | YES (position 0) | Container uses plain globals only |
| Business logic modules | NO | YES | All updatable code lives here |
| HTML/CSS/JS files | NO | YES | Library evaluates its own templates |
| License checking | NO | YES | Updatable without touching container |

### The Dispatcher Pattern

The container's `exec_api()` is the single bridge for all `google.script.run` calls from HTML:

```javascript
// === CONTAINER SCRIPT (Code.gs) — entire file ===

function onOpen(e) {
  MyLib.buildMenu(SpreadsheetApp.getUi(), e);
}

function exec_api(options, moduleName, functionName) {
  var args = Array.prototype.slice.call(arguments);
  return MyLib.exec_api.apply(null, args);
}

function showSidebar() {
  MyLib.showSidebar(SpreadsheetApp.getUi());
}

function initialize() {
  MyLib.initialize();
}

// Menu handler stubs — each delegates to library
function menuAction1() { MyLib.menuAction1(); }
function menuAction2() { MyLib.menuAction2(); }
```

**Key rule:** The container is ~20 lines of delegation. No logic, no CommonJS, no imports.

### CommonJS Integration

The container and library have **separate global scopes**:

| Aspect | Container | Library |
|--------|-----------|---------|
| Global scope | Its own | Its own (isolated) |
| CommonJS | Not available | Full system (`require.gs` at position 0) |
| `require()` | Not available | Works normally |
| Global functions | Visible to `google.script.run` | NOT visible to `google.script.run` |
| Menu handlers | Resolved here | NOT resolved here |

The library uses `require()` internally for all module loading. The container never needs it — it just calls `MyLib.methodName()`.

### HTML from Library (Workaround)

`HtmlService.createTemplateFromFile()` only finds files in the **current project**. Since HTML files live in the library, the library must evaluate its own templates:

```javascript
// === LIBRARY CODE ===

// Library evaluates its own HTML and returns HtmlOutput
function showSidebar(ui) {
  const template = HtmlService.createTemplateFromFile('Sidebar');
  // Scriptlet context runs in LIBRARY scope — require() works here
  const output = template.evaluate()
    .setTitle('My Tool')
    .setWidth(400);
  ui.showSidebar(output);
}

// Container passes its Ui object — library can't get it directly
// because SpreadsheetApp.getUi() in library context has no "active" sheet
```

**3 execution contexts to understand:**

| Context | Runs In | Has Access To |
|---------|---------|---------------|
| Scriptlet evaluation (`<?= ?>`) | Library | Library's `require()`, functions, HTML files |
| `google.script.run.functionName()` | Container | Container's global functions only |
| SpreadsheetApp operations | Container's bound sheet | The user's spreadsheet |

### What Persists on Template Copy

When a user clicks "Make a copy" of your template spreadsheet:

| Item | Copied? | Notes |
|------|---------|-------|
| Spreadsheet data & formatting | YES | Full copy |
| Container-bound script code | YES | Frozen snapshot |
| Library reference in manifest | YES | Points to your library — **this is the update mechanism** |
| Simple triggers (`onOpen`, `onEdit`) | NO | User must trigger first run |
| Installable triggers | NO | Must be created programmatically |
| Script properties | NO | Empty in copy |
| User properties | NO | Per-user, per-script |
| Document properties | NO | Per-document, reset on copy |
| Deployment settings | NO | Container has no deployments |

### First-Run Flow

Since triggers don't copy, the first run requires user action:

```
User opens copied spreadsheet
  → onOpen(e) fires in AuthMode.NONE (no authorization yet)
    → Can only create menu (no services access)
      → Menu shows "Initialize" item
        → User clicks "Initialize"
          → Authorization prompt (scopes from container + library)
            → initialize() runs:
              1. Creates installable triggers if needed
              2. Sets up document/script properties
              3. Runs any first-time setup logic
              4. Rebuilds menu with full items
```

```javascript
// === LIBRARY CODE ===

function buildMenu(ui, e) {
  const menu = ui.createMenu('My Tool');

  if (e && e.authMode === ScriptApp.AuthMode.NONE) {
    // First run — limited menu
    menu.addItem('Initialize', 'initialize');
  } else {
    // Full menu
    menu.addItem('Open Sidebar', 'showSidebar');
    menu.addItem('Action 1', 'menuAction1');
    menu.addItem('Action 2', 'menuAction2');
  }

  menu.addToUi();
}

function initialize() {
  // Create installable triggers
  ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  // Set up properties
  PropertiesService.getDocumentProperties().setProperty('initialized', 'true');
  PropertiesService.getDocumentProperties().setProperty('version', '1.0');

  // Rebuild menu with full items
  buildMenu(SpreadsheetApp.getUi(), {authMode: ScriptApp.AuthMode.FULL});
}
```

### Resource Scoping Between Container and Library

| Resource | Library Access | Returns What? |
|----------|---------------|---------------|
| `SpreadsheetApp.getActive()` | YES (shared) | Container's bound spreadsheet |
| `SpreadsheetApp.getUi()` | Limited — pass from container | Container's UI context |
| `CacheService.getScriptCache()` | YES (shared) | Container's script cache |
| `LockService.getScriptLock()` | YES (shared) | Container's script lock |
| `PropertiesService.getScriptProperties()` | YES but **returns library's own** | Library's ScriptProperties (NOT container's) |
| `PropertiesService.getUserProperties()` | YES (shared) | Same user properties |
| `PropertiesService.getDocumentProperties()` | YES (shared) | Container's document properties |
| `Session.getActiveUser()` | YES (shared) | Current user |
| `ScriptApp.getScriptId()` | Returns **library's** ID | Not container's ID |

**Critical gotcha:** `ScriptProperties` is the exception — library gets its own store, not the container's. Use `DocumentProperties` or `UserProperties` for shared state.

### CD Project (Deployment Service)

A standalone GAS project that controls what code reaches production:

```
LOCAL DEV → CD Project → Library (standalone, HEAD)
                              ↑
                    All containers reference this @ HEAD
```

**How it works:**

1. **Developer** edits code locally, tests via dev library
2. **CD Project** pulls code and pushes to the production Library via Apps Script API
3. **CD Project** creates a version snapshot before each push (for rollback)
4. **All user containers** reference Library @ HEAD → push = instant update

```javascript
// === CD PROJECT CODE (simplified) ===

function deployToProduction(sourceScriptId, targetLibraryId) {
  const token = ScriptApp.getOAuthToken();

  // 1. Read source content
  const source = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${sourceScriptId}/content`,
    { headers: { Authorization: 'Bearer ' + token } }
  );
  const content = JSON.parse(source.getContentText());

  // 2. Create version snapshot of current library (for rollback)
  UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${targetLibraryId}/versions`,
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ description: 'Pre-deploy snapshot ' + new Date().toISOString() })
    }
  );

  // 3. Push new code to library HEAD
  UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${targetLibraryId}/content`,
    {
      method: 'put',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(content)
    }
  );
}

function rollback(targetLibraryId, versionNumber) {
  const token = ScriptApp.getOAuthToken();

  // Get version content
  const version = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${targetLibraryId}/versions/${versionNumber}`,
    { headers: { Authorization: 'Bearer ' + token } }
  );

  // Read the content at that version
  const content = UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${targetLibraryId}/content?versionNumber=${versionNumber}`,
    { headers: { Authorization: 'Bearer ' + token } }
  );

  // Push old content back to HEAD
  UrlFetchApp.fetch(
    `https://script.googleapis.com/v1/projects/${targetLibraryId}/content`,
    {
      method: 'put',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: content.getContentText()
    }
  );
}
```

**ConfigManager property names:**

| Property | Value | Purpose |
|----------|-------|---------|
| `DEPLOY_DEV_URL` | Script URL | Dev library URL |
| `DEPLOY_STAGING_URL` | Script URL | Staging library URL |
| `DEPLOY_PROD_URL` | Script URL | Production library URL |
| `DEPLOY_DEV_DEPLOYMENT_ID` | Deployment ID | Dev library deployment |
| `DEPLOY_STAGING_DEPLOYMENT_ID` | Deployment ID | Staging library deployment |
| `DEPLOY_PROD_DEPLOYMENT_ID` | Deployment ID | Production library deployment |

### Dev / Staging / Prod Workflow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Dev Library │     │ Staging Lib  │     │  Prod Library │
│  (HEAD)      │────▶│  (HEAD)      │────▶│  (HEAD)       │
└─────────────┘     └──────────────┘     └──────────────┘
       ↑                    ↑                    ↑
   Local dev          CD: promote           CD: promote
   + mcp_gas          to staging            to production
```

1. **Dev:** Edit locally, push to dev library via `mcp_gas`, test with a dev spreadsheet
2. **Staging:** CD project copies dev library content to staging library; test with staging spreadsheet
3. **Production:** CD project copies staging content to production library; all customer spreadsheets update

### Performance Considerations

**Library cold start:** Every execution loads all libraries in the manifest. This adds ~1-3 seconds per library on cold start.

**Mitigation strategies:**
- Keep to a single library (the 2-layer approach) — don't add unnecessary library dependencies
- Minimize library file count where possible
- Use `CacheService` aggressively for expensive operations
- Library loading is **static and eager** — all code loads even if not used in that execution
- Cold starts happen after ~5-15 minutes of inactivity (not on every call)

### Update Model Comparison

| Model | Auto-Update? | Rollback? | Complexity | Best For |
|-------|-------------|-----------|------------|----------|
| **Library @ HEAD** | YES — every execution | Via CD project version snapshots | Low (2 layers) | Template products needing seamless updates |
| **Library @ pinned version** | NO — user chooses version | User reverts pin | Low | Developer libraries where consumers control updates |
| **CD project → Library** | YES + controlled | Version snapshots before each push | Medium | Production template products with deploy gates |
| **Marketplace add-on** | YES — deployment update | Revert deployment version | Medium | Products needing Marketplace distribution |
| **Web app backend** | YES — redeploy | Revert deployment version | High | Products needing custom UI/API |
| **Code loader (eval)** | YES — fetch from CDN | Deploy previous version | High (security risk) | Not recommended |

---

## 4. Feature Gating Architecture

### Using PropertiesService for Tier Management

```
ScriptProperties   -> Global config (feature flags, version)
UserProperties     -> Per-user license tier, activation date
DocumentProperties -> Per-document settings
CacheService       -> Temporary license validation cache (reduce API calls)
```

**Quotas to plan around:**
- ~50K property read/write operations daily
- 9KB max per property value
- 500KB total per property store
- CacheService: 100MB per user, 6-hour max TTL

### Feature Flag Pattern

```javascript
const FEATURES = {
  basicExport: { tier: 'free', limit: 5 },
  advancedExport: { tier: 'pro' },
  apiAccess: { tier: 'enterprise' },
  bulkOperations: { tier: 'pro', limit: 100 }
};

function canUseFeature(featureName) {
  const feature = FEATURES[featureName];
  if (!feature) return false;
  if (feature.tier === 'free') return true;

  const userTier = getUserTier_();
  const tierHierarchy = { free: 0, pro: 1, enterprise: 2 };
  return tierHierarchy[userTier] >= tierHierarchy[feature.tier];
}
```

### Dynamic Menu Gating

```javascript
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createAddonMenu();
  menu.addItem('Basic Feature', 'runBasicFeature');

  if (canUseFeature('advancedExport')) {
    menu.addItem('Advanced Export', 'runAdvancedExport');
  } else {
    menu.addItem('Advanced Export (Pro)', 'showUpgradePrompt_');
  }
  menu.addToUi();
}
```

---

## 5. Commercial Update Best Practices

### Pre-Release Checklist

1. **Test on staging** - Private deployment to separate script/sheet copy
2. **Test trigger behavior** - Triggers don't work in "Test as add-on" mode; must deploy to staging
3. **Verify scope changes** - Any new scope = user re-authorization = potential drop-off
4. **Version numbering in UI** - Display version in sidebar/dialog (no webhook for deployment success)
5. **Backward compatibility** - Old data formats must still work (users don't update simultaneously)

### Rollback Strategy

```
Problem detected in production
  -> Deploy > Manage Deployments > Edit
    -> Change version back to previous known-good version
      -> All users automatically revert
```

Versioned deployments can't be deleted, only archived. This is actually a feature for commercial use - you maintain a complete audit trail.

### Breaking Change Management

Since all users auto-update simultaneously, handle migrations in code:

```javascript
function migrateIfNeeded_() {
  const props = PropertiesService.getUserProperties();
  const dataVersion = props.getProperty('data_version') || '1';

  if (dataVersion === '1') {
    migrateV1toV2_();
    props.setProperty('data_version', '2');
  }
  if (dataVersion === '2') {
    migrateV2toV3_();
    props.setProperty('data_version', '3');
  }
}
```

### Multi-Environment Pipeline

```
Development (head deployment)
  -> Staging (private versioned deployment, separate script ID)
    -> Production (public versioned deployment)
```

**Environment detection:**
```javascript
function getEnvironment() {
  return {
    'SCRIPT_ID_DEV': 'development',
    'SCRIPT_ID_STAGING': 'staging',
    'SCRIPT_ID_PROD': 'production'
  }[ScriptApp.getScriptId()] || 'unknown';
}
```

### CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy GAS
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install -g @google/clasp
      - name: Auth
        run: echo '${{ secrets.CLASPRC_JSON }}' > ~/.clasprc.json
      - name: Push & Deploy
        run: |
          clasp push
          clasp deploy -i ${{ secrets.DEPLOYMENT_ID }}
```

**Auth options:** OAuth tokens in secrets, GCP service account key (preferred), scheduled token refresh.

---

## 6. Marketplace Listing Optimization

### Listing Elements That Matter

| Element | Recommendation |
|---------|---------------|
| **Title** | 15 chars or fewer, keyword-rich |
| **Summary** | Value prop in first 80 chars |
| **Description** | Under 1,000 chars: benefits then features then use cases |
| **Screenshots** | 1,280 x 800 px, show key workflows |
| **Video** | 16:9 ratio, YouTube hosted |
| **Logo** | Clean, recognizable at small sizes |

### Ranking Factors

1. Total installs
2. Average rating (maintain 4+ stars)
3. Listing quality (completeness, keywords)
4. App compatibility signals

### Conversion Tactics

- **In-app review prompts** at positive moments (after successful operation)
- **Free tier** with clear upgrade path reduces barrier to install
- **Social proof** on developer website (testimonials, user counts)
- **Email sequences** triggered by install, trial expiry, feature discovery
- **AppSumo lifetime deals** for initial traction and reviews
- **LinkedIn ads** for B2B add-ons (business decision-makers)
- **Community engagement** on Reddit/forums (helpful, not promotional)

### Publishing Pipeline

1. **Link GCP project** - Standard (not default) GCP project required
2. **Configure OAuth consent screen** - Scopes, branding, test users
3. **Create Marketplace listing** - Name, description, screenshots, logo, pricing
4. **Submit for review** - Private/domain = immediate; Public = Google review required
5. **Post-publish** - Major changes (new integrations, name/description) trigger re-review

---

## 7. Copy Protection Realities

### What's Possible

| Method | Effectiveness | Notes |
|--------|--------------|-------|
| **Marketplace add-on** | High | Code runs on Google's servers; users can't easily copy |
| **Server-side validation** | High | License check via UrlFetch; revocable |
| **Viewer-only + forced copy** | Low | Prevents editing master; user gets full copy of code |
| **Private functions (trailing `_`)** | Minimal | Hidden from UI menus, still visible in Script Editor |
| **Code obfuscation** | Low | GAS doesn't support minification effectively |
| **Time-limited trial** | Medium | Must implement server-side; client-side can be bypassed |

### Hard Truths

- GAS code is **always visible** to users with editor access
- No code signing, obfuscation, or binary compilation available
- Best protection: keep business logic server-side (your own API), use GAS as a thin client
- For templates: accept that code will be visible; compete on value, support, and updates
- Marketplace add-ons are the strongest protection because code stays in your project

---

## 8. Pro Tips for Commercial GAS

1. **Display version in UI** - No deployment webhook exists; show version number so users/support can verify
2. **Cache license checks** - 1-hour CacheService TTL reduces API calls and quota usage
3. **Use `Session.getActiveUser().getEmail()`** for license binding (returns empty string if user hasn't authorized)
4. **UrlFetch for license servers** - Server-side, no CORS issues, can reach any external API
5. **Separate staging from dev** - "Test as add-on" blocks triggers; need real private deployment for full testing
6. **Property store for config** - ScriptProperties for global flags, UserProperties for per-user state
7. **Dynamic menus for feature gating** - Build menus conditionally based on license tier
8. **Trigger limits** - 20/user/script, 1hr min frequency. Plan architecture around this.
9. **Avoid library dependencies** - Each library adds cold-start latency (~1-3s per library)
10. **Bundle CSS/JS into HTML files** - GAS requires `.html` extension; use include() pattern
11. **No active sheet change events** - Must poll with getCurrentSheetId() (~100ms intervals, ~0.5s latency)
12. **Property quota** - ~50K get/write operations daily, 9KB max per property value, no API to check usage
13. **Workspace add-on 30s limit** - GWAO executions max 30 seconds vs 6 minutes for Editor add-ons
14. **HTML extensions only** - All CSS/JS must be in `.html` files with appropriate tag wrappers
15. **Granular OAuth (Jan 2025)** - Users can now select individual scopes to authorize

---

## Add-on Lifecycle Quick Reference

### Installation Flow
```
Install from Marketplace
  -> onInstall(e) fires [AuthMode.FULL]
    -> should call onOpen(e) for menu setup

User opens document later
  -> onOpen(e) fires [AuthMode.LIMITED - can't access services]
    -> create menus only

User clicks add-on menu
  -> Full authorization granted
  -> Sidebar/dialog can access all scoped services
```

**Gotcha:** `onOpen()` does NOT fire on initial Marketplace install. Always call `onOpen()` from within `onInstall()`.

### Manifest Structure (appsscript.json)
```json
{
  "timeZone": "America/New_York",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email"
  ],
  "addOns": {
    "common": {
      "name": "My Add-on",
      "logoUrl": "https://example.com/logo.png",
      "layoutProperties": { "primaryColor": "#4285F4" },
      "homepageTrigger": { "runFunction": "onHomepage" }
    },
    "sheets": {
      "homepageTrigger": { "runFunction": "onSheetsHomepage" }
    }
  }
}
```

---

## Sources

- [Add-on types overview](https://developers.google.com/workspace/add-ons/concepts/types)
- [Building Editor add-ons](https://developers.google.com/workspace/add-ons/how-tos/building-editor-addons)
- [Create and manage deployments](https://developers.google.com/apps-script/concepts/deployments)
- [Update published add-on](https://developers.google.com/apps-script/add-ons/how-tos/update-published-add-on)
- [Versions](https://developers.google.com/apps-script/guides/versions)
- [GAS Release Notes](https://developers.google.com/apps-script/release-notes)
- [Clasp CLI](https://developers.google.com/apps-script/guides/clasp)
- [Railsware: GAS Add-on Gotchas](https://railsware.com/blog/google-apps-script-gotchas-to-develop-an-add-on/)
- [QuadRamp Monetization](https://quadramp.com/blog/how-to-monetize-a-google-workspace-addon-the-hard-way-vs-the-easy-way/)
- [Marketing Guide](https://alkdigitalmarketing.com/the-ultimate-guide-marketing-a-google-workspace-add-on/)
- [License Key Generation](https://www.labnol.org/verify-software-license-keys-241007)
- [Better Sheets Success Story](https://www.starterstory.com/ideas/google-sheets-tool/success-stories)
- [Web Apps Guide](https://developers.google.com/apps-script/guides/web)
- [Tanaike: Web Apps Deep Dive](https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script)
- [Card-based interfaces](https://developers.google.com/workspace/add-ons/concepts/card-interfaces)
- [AppsScriptPulse Community](https://pulse.appsscript.info/)
- [Google: Libraries](https://developers.google.com/apps-script/guides/libraries)
- [Google: Container-bound Scripts](https://developers.google.com/apps-script/guides/bound)
- [Google: Import/Export Projects](https://developers.google.com/apps-script/guides/import-export)
- [Issue #36755072: Library functions from menu](https://issuetracker.google.com/issues/36755072)
- [Bruce McPherson: HTML from library](https://ramblings.mcpher.com/gassnippets2/getting-an-htmlservice-template-from-a-library/)
- [Jeff Everhart: Delegating google.script.run](https://jeffreyeverhart.com/2020/05/09/delegating-client-side-requests-with-google-script-run-in-google-apps-script/)
- [Apps Script API Reference](https://developers.google.com/apps-script/api/reference/rest)
- [Trigger doesn't apply to copy](https://support.google.com/docs/thread/146610291)
