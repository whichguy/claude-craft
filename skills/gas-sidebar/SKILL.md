---
name: gas-sidebar
description: |
  Interactive GAS sidebar testing via Chrome DevTools. Launch sidebar, send prompts,
  read responses, manage config, and take screenshots -- all through MCP automation.

  **AUTOMATICALLY INVOKE** when:
  - User says "open sidebar", "launch sidebar", "test sidebar"
  - User says "send prompt", "send message", "chat with sidebar"
  - User says "check sidebar", "sidebar not working", "sidebar blank"
  - User wants to interact with Sheet Chat sidebar in any environment (Dev/Staging/Prod)
  - User says "gas-sidebar" or "/gas-sidebar"
  - User mentions "Sheet Chat" + any action verb (open, test, send, check)
  - User wants to verify sidebar deployment is working end-to-end

  **MCP REQUIRED:** chrome-devtools (with browserUrl for GAS auth), gas

  **NOT for:** Static code review (use /gas), server-side debugging (use /gas),
  symptom-based UI debugging without Chrome (use /gas)
model: claude-sonnet-4-6
allowed-tools:
  - mcp__gas__*
  - mcp__chrome-devtools__*
---

# GAS Sidebar Debug -- Interactive Chrome DevTools Automation

You automate the Sheet Chat sidebar through Chrome DevTools MCP. You can launch the sidebar,
send prompts, wait for and read responses, switch tabs, manage config, and capture screenshots.

## Constants

```
SCRIPT_ID = "1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG"
```

## Important Constraints

- `exec()` CANNOT open the sidebar (requires UI context) -- must use Chrome DevTools menu clicks
- The sidebar loads inside 3 levels of nested iframes in the Google Sheets DOM
- Element UIDs are session-specific; the reference table below reflects observed patterns but UIDs
  may shift between sessions. Always verify via `take_snapshot()` if clicks miss.
- After menu clicks, the sidebar iframe takes 2-5 seconds to fully load
- "Processing..." indicator appears during LLM inference; polling is required to detect completion
- Chrome must be running with `--remote-debugging-port=9222` and logged into Google

---

# PROCEDURE CATALOG

## Procedure 1: LAUNCH SIDEBAR

> Opens a Google Sheet in Chrome and activates the Sheet Chat sidebar via menu.

### Step 1.1: Verify Chrome Connection

```javascript
mcp__chrome-devtools__list_pages()
```

**Decision:**
```
IF tool FAILED with "connection" OR "ECONNREFUSED":
    TELL USER: "Chrome is not running with debug port. Run: chrome-debug"
    STOP

IF RESULT is empty array:
    CONTINUE to Step 1.2 (will open new page)

IF RESULT contains pages:
    CHECK: Is a Google Sheets page already open?
    IF YES: select_page() to that page, SKIP to Step 1.3
    IF NO: CONTINUE to Step 1.2
```

### Step 1.2: Get Spreadsheet URL and Navigate

```javascript
// Get the spreadsheet URL
mcp__gas__exec({
  scriptId: SCRIPT_ID,
  js_statement: "SpreadsheetApp.getActiveSpreadsheet().getUrl()",
  skipSyncCheck: true
})
```

Then open it:
```javascript
// Use new_page if no sheets page exists, or navigate_page if reusing a tab
mcp__chrome-devtools__new_page({ url: "<spreadsheet_url>" })
```

Wait for the sheet to fully render:
```javascript
mcp__chrome-devtools__wait_for({
  text: "Sheet Chat",
  timeout: 15000
})
```

**Decision:**
```
IF wait_for TIMES OUT:
    take_snapshot() to see current page state
    CHECK: Is it a Google login page? → TELL USER to log in
    CHECK: Is the sheet loading? → Wait longer (retry with 30s timeout)
    CHECK: Is it a 404 or permission error? → TELL USER about access
```

### Step 1.3: Open Sidebar via Menu

Determine the environment. Default is "Dev" unless user specifies otherwise.

```
ENV = user-specified environment OR "Dev"
MENU_ITEM = "Open Chat (" + ENV + ")"
```

**Step 1.3a: Take snapshot to find the menu**
```javascript
mcp__chrome-devtools__take_snapshot()
```

Look for "Sheet Chat" in the accessibility tree. It appears as a top-level custom menu item
in the Google Sheets menu bar (alongside File, Edit, View, etc.).

**Step 1.3b: Click the Sheet Chat menu**
```javascript
mcp__chrome-devtools__click({ text: "Sheet Chat" })
```

Wait briefly for the dropdown to appear (~500ms):
```javascript
mcp__chrome-devtools__wait_for({ text: MENU_ITEM, timeout: 5000 })
```

**Step 1.3c: Click the environment menu item**
```javascript
mcp__chrome-devtools__click({ text: MENU_ITEM })
```

### Step 1.4: Wait for Sidebar to Load

The sidebar iframe takes several seconds to initialize. Wait for a known element:

```javascript
mcp__chrome-devtools__wait_for({
  text: "Chat",       // The Chat tab label
  timeout: 15000
})
```

**Decision:**
```
IF wait_for SUCCEEDS:
    SIDEBAR IS READY
    take_snapshot() to confirm and capture element UIDs
    take_screenshot() for visual verification

IF wait_for TIMES OUT:
    take_snapshot() to inspect current DOM
    CHECK: Is the sidebar frame present but empty?
        → Server-side HTML error. TELL USER: "Sidebar HTML failed to compile.
           Use /gas-debug to check: HtmlService.createTemplateFromFile('sidebar').evaluate()"
    CHECK: Is there an authorization dialog?
        → TELL USER: "Authorization required. Open the script editor and run the
           function manually once to grant permissions."
    CHECK: Is the sidebar just slow?
        → Retry with longer timeout (30s)
```

### Step 1.5: Capture Initial State

```javascript
// Take screenshot for visual record
mcp__chrome-devtools__take_screenshot()

// Take snapshot for element UIDs
mcp__chrome-devtools__take_snapshot()
```

Report the sidebar state to the user: which tab is active, whether any conversations
exist, and the element UIDs discovered.

---

## Procedure 2: SEND PROMPT

> Types a message into the chat input and clicks Send.

### Prerequisites
- Sidebar must be open (run Procedure 1 if not)
- Chat tab must be active (run Procedure 5 if on Config tab)

### Step 2.0: Set Active Cell/Range (if data will be inserted)

When the prompt will insert data into the sheet, the active range determines WHERE data goes.
Set it BEFORE sending the prompt:

```javascript
// Set active cell to A1 of the active sheet
mcp__gas__exec({
  scriptId: SCRIPT_ID,
  js_statement: "SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getRange('A1').activate()",
  skipSyncCheck: true
})
```

**Common patterns:**
```javascript
// Activate a specific sheet + cell
"SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet54').activate(); SpreadsheetApp.getActiveSheet().getRange('A1').activate()"

// Activate next empty row in column A
"var sheet = SpreadsheetApp.getActiveSheet(); var lastRow = sheet.getLastRow(); sheet.getRange(lastRow + 1, 1).activate()"

// Activate a named range
"SpreadsheetApp.getActiveSpreadsheet().getRangeByName('DataStart').activate()"
```

**IMPORTANT:** The sidebar chat reads the active range at the time it processes the prompt.
Always set the active range BEFORE filling and sending the message.

### Step 2.1: Fill the Message Input

```javascript
mcp__chrome-devtools__fill({
  uid: "<message_input_uid>",     // typically 6_17 but verify via snapshot
  value: "<user's prompt text>"
})
```

**Decision:**
```
IF fill FAILED:
    take_snapshot() to find correct input UID
    LOOK FOR: input or textarea element near "Send" button
    RETRY with correct UID
```

### Step 2.2: Click Send

```javascript
mcp__chrome-devtools__click({
  uid: "<send_button_uid>"        // typically 6_18 but verify via snapshot
})
```

**Alternative: Click by text if UID is unknown**
```javascript
mcp__chrome-devtools__click({ text: "Send" })
```

### Step 2.3: Verify Send Was Accepted

After clicking Send, the input should clear and "Processing..." should appear:

```javascript
mcp__chrome-devtools__wait_for({
  text: "Processing",
  timeout: 5000
})
```

**Decision:**
```
IF "Processing" appears:
    SEND SUCCESSFUL
    GOTO Procedure 3 (WAIT FOR RESPONSE)

IF "Processing" does NOT appear within 5s:
    take_snapshot() to check state
    CHECK: Is the input still filled? → Click did not register, retry
    CHECK: Is there an error message? → Report to user
    CHECK: Is the send button disabled? → May need to select a conversation first
```

---

## Procedure 3: WAIT FOR RESPONSE

> Polls the sidebar until "Processing..." disappears and an assistant response appears.

### Polling Strategy

Use an exponential backoff polling loop:

```
POLL_INTERVALS = [2000, 3000, 5000, 5000, 5000, 10000, 10000, 10000]
MAX_TOTAL_WAIT = 120000 (2 minutes)
elapsed = 0
attempt = 0
```

### Step 3.1: Poll Loop

For each interval in POLL_INTERVALS (repeat last interval if needed):

```javascript
mcp__chrome-devtools__take_snapshot()
```

**Check the snapshot for:**

```
SCAN accessibility tree for these indicators:

IF tree contains "Processing..." OR "Cancel request":
    RESPONSE STILL GENERATING
    LOG: "Still processing... (elapsed: Xs)"
    CONTINUE polling

IF tree does NOT contain "Processing..." AND contains new assistant message:
    RESPONSE COMPLETE
    EXTRACT assistant response text from tree
    GOTO Step 3.2

IF tree contains error text (e.g., "Error", "Failed", "Rate limit"):
    RESPONSE FAILED
    EXTRACT error message
    REPORT to user
    STOP polling

IF elapsed > MAX_TOTAL_WAIT:
    TIMEOUT
    take_screenshot() for evidence
    REPORT: "Response timed out after 2 minutes. The server may still be processing.
             Check the sidebar manually or use /gas-debug to investigate."
    STOP polling
```

**Important:** Each `take_snapshot()` call is relatively fast (~500ms). The wait between
snapshots is the polling interval, which you achieve by simply waiting before the next call.
Since MCP tools are synchronous, the natural execution cadence handles timing.

### Step 3.2: Extract Response

Once the response is detected in the snapshot:

1. Locate the assistant message in the accessibility tree (look for the most recent
   text block that was not present before sending)
2. Extract the full text content
3. Take a screenshot for visual verification:

```javascript
mcp__chrome-devtools__take_screenshot()
```

4. Report the response to the user

**Tip:** Assistant responses often contain markdown. The a11y tree may show plain text.
If the user needs formatted content, use `evaluate_script` to extract innerHTML.

---

## Procedure 4: READ RESPONSES

> Extracts conversation history or the latest response from the sidebar.

### Step 4.1: Snapshot the Sidebar

```javascript
mcp__chrome-devtools__take_snapshot()
```

### Step 4.2: Parse the Accessibility Tree

Look for the conversation container in the tree. Messages are typically structured as:

```
[conversation container]
  [message block - user]
    [text: "user's prompt"]
  [message block - assistant]
    [text: "assistant's response"]
  ...
```

### Step 4.3: Advanced Extraction (if a11y tree is insufficient)

If the accessibility tree does not provide clean text, use JavaScript evaluation:

```javascript
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    // Navigate into the sidebar iframe
    const frames = document.querySelectorAll('iframe');
    for (const frame of frames) {
      try {
        const doc = frame.contentDocument || frame.contentWindow.document;
        // Look for message containers - adjust selector as needed
        const messages = doc.querySelectorAll('.message, [class*="message"]');
        if (messages.length > 0) {
          return Array.from(messages).map(m => ({
            role: m.classList.contains('user') ? 'user' : 'assistant',
            text: m.textContent.trim()
          }));
        }
      } catch (e) {
        // Cross-origin frame, skip
      }
    }
    return 'No messages found - iframe may be cross-origin';
  }`
})
```

**Note:** Cross-origin iframe restrictions may block direct DOM access. If so, rely on
the accessibility tree from `take_snapshot()` which has cross-origin visibility.

---

## Procedure 5: TAB NAVIGATION

> Switches between the Chat and Config tabs in the sidebar.

### Step 5.1: Click Target Tab

**Switch to Chat tab:**
```javascript
mcp__chrome-devtools__click({ text: "Chat" })
// OR by UID:
mcp__chrome-devtools__click({ uid: "<chat_tab_uid>" })   // typically 6_10
```

**Switch to Config tab:**
```javascript
mcp__chrome-devtools__click({ text: "Config" })
// OR by UID:
mcp__chrome-devtools__click({ uid: "<config_tab_uid>" })  // typically 6_11
```

### Step 5.2: Verify Tab Switch

```javascript
mcp__chrome-devtools__take_snapshot()
```

Confirm the expected tab content is now visible. The Chat tab shows the conversation
area and input field. The Config tab shows settings fields.

---

## Procedure 6: CONFIG MANAGEMENT

> Interacts with the Config tab to read or modify settings.

### Step 6.1: Navigate to Config Tab

Follow Procedure 5 to switch to the Config tab.

### Step 6.2: Read Current Config

```javascript
mcp__chrome-devtools__take_snapshot()
```

Parse the Config tab contents from the accessibility tree. Look for form fields,
dropdowns, text inputs, and their current values.

### Step 6.3: Modify Config

For each setting to change:

```javascript
// Fill a text field
mcp__chrome-devtools__fill({
  uid: "<field_uid>",
  value: "<new_value>"
})

// Or click a dropdown/checkbox
mcp__chrome-devtools__click({ uid: "<control_uid>" })
```

### Step 6.4: Save Config

Look for a "Save" or "Apply" button in the Config tab:

```javascript
mcp__chrome-devtools__click({ text: "Save" })
```

### Step 6.5: Verify Save

```javascript
mcp__chrome-devtools__take_snapshot()
```

Check for success indicator (toast message, status text, etc.).

---

## Procedure 7: SCREENSHOT CAPTURE

> Takes screenshots at key moments for visual verification.

### On-Demand Screenshot

```javascript
mcp__chrome-devtools__take_screenshot()
```

### Recommended Screenshot Points

| Moment | Why |
|--------|-----|
| After sidebar loads (Procedure 1, Step 1.5) | Confirm sidebar rendered correctly |
| After sending a prompt (Procedure 2, Step 2.3) | Confirm "Processing..." state |
| After response received (Procedure 3, Step 3.2) | Capture the assistant's answer |
| After tab switch (Procedure 5, Step 5.2) | Confirm correct tab is active |
| After config save (Procedure 6, Step 6.5) | Confirm settings persisted |
| On any error or unexpected state | Evidence for debugging |

---

## Procedure 8: NEW CONVERSATION

> Creates a fresh conversation in the sidebar.

### Step 8.1: Click New Conversation Button

```javascript
mcp__chrome-devtools__click({ uid: "<new_conversation_uid>" })  // typically 6_14
// OR by text:
mcp__chrome-devtools__click({ text: "New" })
```

### Step 8.2: Verify

```javascript
mcp__chrome-devtools__take_snapshot()
```

The conversation area should clear and the input should be ready for a new prompt.

---

## Procedure 9: SELECT EXISTING CONVERSATION

> Opens a previous conversation from the dropdown.

### Step 9.1: Open Conversation Dropdown

Look for the conversation selector dropdown in the snapshot:

```javascript
mcp__chrome-devtools__take_snapshot()
```

Find the dropdown UID and click it:

```javascript
mcp__chrome-devtools__click({ uid: "<dropdown_uid>" })
```

### Step 9.2: Select Conversation

After the dropdown opens, take another snapshot to see the options:

```javascript
mcp__chrome-devtools__take_snapshot()
```

Click the desired conversation:

```javascript
mcp__chrome-devtools__click({ text: "<conversation_title_or_preview>" })
```

### Step 9.3: Verify

```javascript
mcp__chrome-devtools__take_snapshot()
```

Confirm the selected conversation's messages are now displayed.

---

# ELEMENT UID REFERENCE

> UIDs are session-specific. These are observed defaults -- always verify with `take_snapshot()`.

| Element | Observed UID | Text/Label | Notes |
|---------|-------------|------------|-------|
| Chat tab | `6_10` | "Chat" | Left tab in sidebar header |
| Config tab | `6_11` | "Config" | Right tab in sidebar header |
| New conversation button | `6_14` | "New" or "+" | Creates fresh chat |
| Conversation dropdown | varies | Shows conversation title | Opens conversation list |
| Message input | `6_17` | (placeholder text) | Text area for typing prompts |
| Send button | `6_18` | "Send" | Submits the current message |
| Processing indicator | `9_5` | "Processing..." | Visible during LLM inference |
| Cancel request button | `9_6` | "Cancel request" | Stops client-side polling |

### UID Discovery Strategy

If expected UIDs do not match:

1. `take_snapshot()` and search the accessibility tree for known text labels
2. Look for interactive elements (buttons, inputs) near expected locations
3. The sidebar content is nested ~3 levels deep in the a11y tree hierarchy
4. UIDs follow the pattern `<frame_id>_<element_index>` where frame_id corresponds
   to the iframe nesting depth

---

# ENVIRONMENT DETECTION

## Menu Items by Environment

| Environment | Menu Text | When to Use |
|-------------|-----------|-------------|
| Dev | "Open Chat (Dev)" | During development, uses /dev deployment URL |
| Staging | "Open Chat (Staging)" | Pre-release testing |
| Prod | "Open Chat (Prod)" | Production verification |

## Auto-Detection from User Input

```
IF user says "dev", "development", "test" → ENV = "Dev"
IF user says "staging", "stage", "pre-prod" → ENV = "Staging"
IF user says "prod", "production", "live" → ENV = "Prod"
IF user does not specify → ENV = "Dev" (default)
```

## Environment Verification

After sidebar loads, you can verify which environment is active by checking:
- The sidebar title or header text
- Config tab values
- Console messages that log the deployment URL

---

# ERROR HANDLING

## Error: Menu Not Found

```
SYMPTOM: "Sheet Chat" menu not visible after sheet loads
```

**Steps:**
1. `take_snapshot()` -- check if the sheet has fully loaded
2. Wait longer: the custom menu registers via `onOpen()` which can take 5-10s
3. Try refreshing: `mcp__chrome-devtools__navigate_page({ url: "<same_url>" })`
4. If still missing after refresh, check server-side:
   ```javascript
   mcp__gas__exec({
     scriptId: SCRIPT_ID,
     js_statement: "typeof onOpen"
   })
   ```
   If `"undefined"` -- the `onOpen` handler is not registered. Use `/gas-debug` to investigate.

## Error: Sidebar Iframe Not Loading

```
SYMPTOM: Menu item clicked but sidebar area is empty or shows spinner indefinitely
```

**Steps:**
1. Wait 10 seconds, then `take_snapshot()`
2. Check for authorization popup in the DOM tree
3. Check console for errors:
   ```javascript
   mcp__chrome-devtools__list_console_messages({ types: ["error"] })
   ```
4. Validate server-side HTML:
   ```javascript
   mcp__gas__exec({
     scriptId: SCRIPT_ID,
     js_statement: `
       try {
         var html = HtmlService.createTemplateFromFile('sidebar').evaluate().getContent();
         return { ok: true, length: html.length };
       } catch (e) {
         return { ok: false, error: e.message };
       }
     `
   })
   ```

## Error: Click Does Not Register

```
SYMPTOM: fill() or click() returns success but element does not respond
```

**Steps:**
1. Verify the UID is correct: `take_snapshot()` and find the element
2. The element may be obscured by an overlay or not yet interactive
3. Try clicking by text instead of UID: `click({ text: "Send" })`
4. Try adding a small delay before the interaction (re-snapshot after 1-2s)
5. Check if the element is inside a deeply nested iframe -- may need `evaluate_script`
   to programmatically trigger the action

## Error: Response Timeout

```
SYMPTOM: "Processing..." persists beyond 2 minutes
```

**Steps:**
1. The LLM may genuinely be slow -- check the model/provider in Config
2. Take a screenshot for evidence
3. Check if the cancel button is still present
4. Click "Cancel request" to stop client-side polling:
   ```javascript
   mcp__chrome-devtools__click({ text: "Cancel request" })
   ```
5. Note: The server continues processing even after cancel. The cancel only stops
   the client-side polling (see Cancel Pattern in CLAUDE.md).
6. Check server logs:
   ```javascript
   mcp__gas__executions({ scriptId: SCRIPT_ID })
   ```

## Error: Chrome Connection Lost

```
SYMPTOM: MCP tool calls fail with connection errors
```

**Steps:**
1. `list_pages()` to test connection
2. If failed: Chrome may have crashed or port closed
3. Tell user to restart Chrome: `chrome-debug`
4. After Chrome restarts, re-run Procedure 1 from the beginning

---

# COMPOSITE WORKFLOWS

## Full End-to-End Test

Run these procedures in sequence for a complete sidebar test:

```
1. LAUNCH SIDEBAR (Procedure 1) with specified environment
2. Take screenshot (Procedure 7) -- verify sidebar loaded
3. NEW CONVERSATION (Procedure 8) -- start clean
4. SEND PROMPT (Procedure 2) -- send the test message
5. WAIT FOR RESPONSE (Procedure 3) -- poll until complete
6. READ RESPONSE (Procedure 4) -- extract and report the answer
7. Take screenshot (Procedure 7) -- capture final state
```

## Quick Chat (Sidebar Already Open)

If the sidebar is already visible in Chrome:

```
1. Take snapshot to verify sidebar state and get UIDs
2. SEND PROMPT (Procedure 2)
3. WAIT FOR RESPONSE (Procedure 3)
4. READ RESPONSE (Procedure 4)
```

## Config Verification

```
1. LAUNCH SIDEBAR (Procedure 1) if not already open
2. TAB NAVIGATION (Procedure 5) -- switch to Config
3. CONFIG MANAGEMENT (Procedure 6) -- read or modify settings
4. Take screenshot (Procedure 7)
5. TAB NAVIGATION (Procedure 5) -- switch back to Chat
```

## Multi-Turn Conversation Test

```
1. LAUNCH SIDEBAR + NEW CONVERSATION
2. For each prompt in test sequence:
   a. SEND PROMPT
   b. WAIT FOR RESPONSE
   c. READ RESPONSE
   d. Verify response makes sense given conversation context
3. Take final screenshot
```

---

# OUTPUT FORMAT

After completing any procedure, report results in this structure:

```
## Sidebar Debug Report

**Environment:** Dev | Staging | Prod
**Action:** [what was performed]
**Status:** SUCCESS | FAILED | PARTIAL

### Details
[Step-by-step account of what happened]

### Response (if applicable)
[Assistant's response text, extracted from sidebar]

### Screenshot
[Screenshot taken at: <timestamp/description>]

### Issues (if any)
- [Issue 1: description + recommended fix]
- [Issue 2: description + recommended fix]
```

---

# IFRAME DEBUGGING LIMITATIONS

## GAS Sidebar Iframe Architecture

The Sheet Chat sidebar is nested **3 levels deep** in iframes:

```
Level 0: Google Sheets (docs.google.com/spreadsheets)
    └── Level 1: iframedAppPanel (docs.google.com/macros)
            └── Level 2: userCodeAppPanel (googleusercontent.com)  ← Sidebar code runs HERE
```

**Key Implications:**
1. Each level is a different origin (cross-origin)
2. JavaScript evaluation from parent frames is blocked by browser security
3. `evaluate_script()` from the parent page cannot access sidebar DOM
4. Only the accessibility tree (via `take_snapshot()`) has cross-origin visibility

## Chrome DevTools Accessibility Tree Click Limitations

**Problem:** Accessibility tree clicks don't always trigger jQuery event delegation handlers.

**Example:** Clicking on a `StaticText` element inside a header:
```
Accessibility tree:
  generic (div.all-thoughts-header)  ← jQuery handler attached here
    StaticText "psychology"           ← Click registered here
    StaticText "Thinking"            ← Or here
    StaticText "expand_more"         ← Or here
```

When you click `uid=24_0` ("Thinking" text), Chrome DevTools sends the click directly to that element. But the jQuery event delegation handler is on the parent `.all-thoughts-header` div. The click may not bubble up correctly.

**Workarounds:**
1. **Click by text on parent elements** when possible: `click({ text: "..." })`
2. **Use coordinate-based clicking** if element is large enough
3. **Cannot verify via automation:** Some CSS fixes (like `pointer-events: none`) work for real users but can't be tested via accessibility tree clicks
4. **Trust CSS fixes:** Standard patterns like `pointer-events: none` on child elements to delegate clicks to parents ARE correct, even if Chrome DevTools can't verify them

## What CAN vs CANNOT Be Tested

| Action | Chrome DevTools | Real User |
|--------|-----------------|-----------|
| Fill text input | ✅ Works | ✅ Works |
| Click buttons | ✅ Works | ✅ Works |
| Read accessibility tree | ✅ Works | N/A |
| Take screenshots | ✅ Works | N/A |
| jQuery event delegation clicks | ⚠️ May fail | ✅ Works |
| `pointer-events: none` CSS | ❌ Can't verify | ✅ Works |
| `evaluate_script()` direct iframe | ❌ Cross-origin blocked | N/A |
| `evaluate_script()` via uid args | ✅ Full access | ✅ Works |
| Scroll sidebar content | ✅ Works (uid args) | ✅ Works |
| Programmatic clicks | ✅ Works (uid args) | ✅ Works |

## Debugging Strategy When Clicks Don't Work

1. **Take snapshot** to find correct element UIDs
2. **Try clicking by text** instead of UID
3. **Try clicking a parent element** with a broader click target
4. **Check if the handler uses event delegation** - if so, clicks on child elements may not trigger it
5. **For CSS fixes**: If the fix is standard (like `pointer-events: none`), trust it's working for real users even if Chrome DevTools can't verify

## Session-Specific UIDs

UIDs follow pattern `<frame_id>_<element_index>` where:
- `frame_id` corresponds to iframe nesting depth
- Elements get new IDs when the page reloads or sidebar refreshes

**Always verify UIDs** with `take_snapshot()` before clicking. Reference UIDs in this document are examples, not guaranteed values.

## CSS/HTML Changes Require Sidebar Reload

**CRITICAL:** After modifying CSS or HTML files in the GAS project:

1. **Close the sidebar** (click X or close the side panel)
2. **Reopen the sidebar** via Extensions menu

**Why this is required:**
- The sidebar HTML is compiled server-side when opened
- Changes to `.html` files (CSS, JS, templates) are not hot-reloaded
- The browser caches the compiled HTML in the iframe

**Side effect:** Reopening the sidebar **clears the current conversation**. The conversation is stored in memory (client-side state) and is lost when the sidebar iframe reloads.

**Workflow for UI debugging:**
```
1. Make CSS/HTML changes via mcp__gas__edit or mcp__gas__write
2. Close sidebar (click X)
3. Reopen via Sheet Chat menu → Open Chat (Dev)
4. Test the changes (conversation will be empty)
5. If changes not visible, hard refresh the sheet (Cmd+Shift+R) and reopen
```

**Tip:** Use a simple test prompt (like "What is 2+2?") to quickly verify UI changes without waiting for complex responses.

---

# CROSS-ORIGIN SIDEBAR ACCESS

> **Breakthrough Discovery (2026-02-02):** Passing a uid from `take_snapshot()` to `evaluate_script` via the `args` parameter bypasses cross-origin iframe restrictions, enabling full DOM access.

## Why This Matters

The GAS sidebar has 3-level iframe nesting:
```
Level 0: Google Sheets (docs.google.com/spreadsheets)  → SAME-ORIGIN ✅
    └── Level 1: iframedAppPanel (docs.google.com/macros)  → SAME-ORIGIN ✅
            └── Level 2: userCodeAppPanel (googleusercontent.com)  → CROSS-ORIGIN ❌
```

**Problem:** Direct `evaluate_script()` calls fail on Level 2 (cross-origin blocked).

**Solution:** The `args` parameter with a uid uses Chrome DevTools Protocol privileged access. Once you have an element reference, standard DOM navigation works across the entire document.

## Core Pattern: Portal via uid Args

**Step 1:** Take snapshot to get element uids from inside cross-origin iframe
```javascript
mcp__chrome-devtools__take_snapshot()
// Look for stable elements like: uid=4_16 textbox "Enter your message"
```

**Step 2:** Pass uid to evaluate_script, navigate from there
```javascript
mcp__chrome-devtools__evaluate_script({
  function: `(el) => {
    // Navigate from the passed element to find target
    let current = el;
    while (current && !current.classList?.contains('tab-content')) {
      current = current.parentElement;
    }
    // Now 'current' is the tab-content container
    // You can querySelector from here to find any element
    const chatContainer = current?.querySelector('.chat-container');
    // Manipulate freely...
    return { success: true };
  }`,
  args: [{"uid": "<uid_from_snapshot>"}]
})
```

## Pattern: Scroll Conversation to Top

```javascript
mcp__chrome-devtools__evaluate_script({
  function: `(el) => {
    // Navigate to tab-content container
    let current = el;
    while (current && !current.classList?.contains('tab-content')) {
      current = current.parentElement;
    }
    const chatContainer = current?.querySelector('.chat-container');
    if (!chatContainer) return { error: 'chat-container not found' };

    chatContainer.scrollTop = 0;
    return { success: true, scrollTop: chatContainer.scrollTop };
  }`,
  args: [{"uid": "<textbox_uid>"}]  // Use textbox uid from snapshot
})
```

## Pattern: Scroll Conversation to Bottom

```javascript
mcp__chrome-devtools__evaluate_script({
  function: `(el) => {
    let current = el;
    while (current && !current.classList?.contains('tab-content')) {
      current = current.parentElement;
    }
    const chatContainer = current?.querySelector('.chat-container');
    if (!chatContainer) return { error: 'chat-container not found' };

    chatContainer.scrollTop = chatContainer.scrollHeight;
    return {
      success: true,
      scrollTop: chatContainer.scrollTop,
      scrollHeight: chatContainer.scrollHeight
    };
  }`,
  args: [{"uid": "<textbox_uid>"}]
})
```

## Pattern: Find ANY Element by CSS Selector

Once you have a uid entry point, you can find ANY element:

```javascript
mcp__chrome-devtools__evaluate_script({
  function: `(el, selector) => {
    // Navigate to sidebar root
    let root = el;
    while (root && !root.classList?.contains('tab-content')) {
      root = root.parentElement;
    }
    root = root?.parentElement; // Go up to include tabs

    // Find element by any CSS selector
    const target = root?.querySelector(selector);
    if (!target) return { found: false, selector };

    return {
      found: true,
      tagName: target.tagName,
      className: target.className,
      text: target.textContent?.substring(0, 100),
      disabled: target.disabled
    };
  }`,
  args: [{"uid": "<textbox_uid>"}, ".v2-submit-btn"]
})
```

## Pattern: Programmatically Trigger Click Handler

Use when accessibility tree clicks fail (e.g., jQuery event delegation):

```javascript
mcp__chrome-devtools__evaluate_script({
  function: `(el, selector) => {
    let root = el;
    while (root && !root.classList?.contains('tab-content')) {
      root = root.parentElement;
    }
    root = root?.parentElement;

    const target = root?.querySelector(selector);
    if (!target) return { error: 'Element not found: ' + selector };

    target.click();
    return { success: true, clicked: selector };
  }`,
  args: [{"uid": "<textbox_uid>"}, ".all-thoughts-header"]  // Toggle thinking bubble
})
```

## Pattern: Check Element Visibility/State

```javascript
mcp__chrome-devtools__evaluate_script({
  function: `(el, selector) => {
    let root = el;
    while (root && !root.classList?.contains('tab-content')) {
      root = root.parentElement;
    }
    root = root?.parentElement;

    const target = root?.querySelector(selector);
    if (!target) return { found: false };

    const style = getComputedStyle(target);
    return {
      found: true,
      visible: style.display !== 'none' && style.visibility !== 'hidden',
      disabled: target.disabled || target.classList.contains('disabled'),
      dimensions: { w: target.offsetWidth, h: target.offsetHeight }
    };
  }`,
  args: [{"uid": "<textbox_uid>"}, ".v2-submit-btn"]
})
```

## Dynamic uid Discovery (No Hardcoding)

Search snapshot text for known patterns instead of hardcoding uids:

```
1. Take snapshot: mcp__chrome-devtools__take_snapshot()
2. Search output for stable text: "Enter your message"
3. Extract uid from pattern: uid=X_Y textbox "Enter your message"
4. Use that uid for all operations
```

**Why the textbox is reliable:**
- Text "Enter your message" is stable (defined in HTML)
- The uid format is predictable (`X_Y`)
- Snapshot is fast (~500ms, just text)

## CSS Selectors for Sheet Chat Sidebar

| Element | Selector |
|---------|----------|
| Chat container (scrollable) | `.chat-container` |
| Send button | `.v2-submit-btn` |
| Message input | `textarea` |
| Thinking bubble headers | `.all-thoughts-header` |
| Cancel button | `.confirm-bar-btn.cancel` |
| Active tab | `.tab.active` |
| Processing indicator | `.processing, [class*="processing"]` |
| User messages | `.message.user-message` |
| Assistant messages | `.message:not(.user-message)` |

## When to Use evaluate_script vs take_snapshot

| Need | Tool |
|------|------|
| Read visible text only | `take_snapshot()` (faster, ~500ms) |
| Scroll content | `evaluate_script()` with uid args |
| Extract HTML/innerHTML | `evaluate_script()` with uid args |
| Trigger handler programmatically | `evaluate_script()` with uid args |
| Check computed styles | `evaluate_script()` with uid args |
| Verify element exists | `take_snapshot()` first, escalate if needed |

## Chaining Operations (No Intermediate Snapshots)

**Snapshots are ONLY for UID discovery**, not for verifying success:

| Pattern | Correct |
|---------|---------|
| Get UIDs → evaluate_script | ✅ Snapshot needed for UIDs |
| evaluate_script → evaluate_script | ✅ Chain directly, no snapshot |
| evaluate_script → verify worked | ✅ Trust `isError` flag in response |
| evaluate_script → snapshot → evaluate_script | ❌ Unnecessary snapshot |

**Why this works:**
- `evaluate_script` returns structured `{isError: true/false}` responses
- Errors include message and nested cause
- Operations are fully async and wait for completion
- Page state persists between calls

**Optimized pattern:**
```javascript
// Step 1: Get UID once
take_snapshot()  // Find uid=4_16 textbox

// Step 2: Chain operations freely
evaluate_script({ args: [{uid: "4_16"}], function: `...scroll...` })
// Returns: {success: true} or {isError: true, content: "Error..."}

evaluate_script({ args: [{uid: "4_16"}], function: `...click...` })
// No snapshot needed - same UID still valid

evaluate_script({ args: [{uid: "4_16"}], function: `...check state...` })
// Chain as many as needed
```

**When to re-snapshot:**
- Page navigation occurred
- Sidebar was closed/reopened
- Need to find NEW elements not in original snapshot
- UIDs are returning "element not found" errors

---

# QUICK REFERENCE

## Most Common Tool Sequences

| Goal | Tool Sequence |
|------|---------------|
| Open sidebar | `exec` (URL) -> `new_page` -> `wait_for` ("Sheet Chat") -> `click` ("Sheet Chat") -> `wait_for` (menu item) -> `click` (menu item) -> `wait_for` ("Chat") |
| Send + wait | `fill` (input) -> `click` (Send) -> `wait_for` ("Processing") -> poll `take_snapshot` until no "Processing" |
| Read response | `take_snapshot` -> parse a11y tree for message text |
| Switch tab | `click` ("Chat" or "Config") -> `take_snapshot` to verify |
| New conversation | `click` (new button) -> `take_snapshot` to verify |
| Visual check | `take_screenshot` |
| Get UIDs | `take_snapshot` -> search for element text labels |
| Chain operations | `evaluate_script` → `evaluate_script` (no snapshot between) |

**Note:** `take_snapshot` is for UID discovery, not verification.

---

## Plan Verification Checklist (copy into plan Verification section)

For sidebar changes, include these steps in the plan's Verification section:
1. Launch sidebar: gas-sidebar launch procedure (navigate to Sheets URL, open Extension menu, click Sheet Chat)
2. Send a test prompt using the send-prompt procedure (`fill` input → `click` Send)
3. Wait for response using wait-for-response procedure (poll `take_snapshot` until no "Processing"; timeout: 30s)
4. Read response via read-responses procedure (`take_snapshot` → parse a11y tree) — verify no console errors
5. Take screenshot for before/after comparison if visual changes were made (`take_screenshot`)
6. Verify config panel if config/settings changes were made (switch to Config tab → `take_snapshot`)
`evaluate_script` returns `{isError: true/false}` - trust this instead of re-snapshotting.
