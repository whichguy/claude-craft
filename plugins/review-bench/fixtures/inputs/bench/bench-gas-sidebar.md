# Plan: Task Manager Sidebar for Google Sheets Project Tracker

## Context

We're adding a sidebar to an existing Google Sheets project tracker. The sheet already has columns: Task ID, Title, Assignee, Due Date, Priority, Status. The sidebar needs to support three workflows: creating new tasks via a form, viewing/filtering the task list, and bulk status updates. Server-side is GAS (`Code.gs`), client-side is HTML/JS served via `HtmlService` (`Sidebar.html`). Local dev via clasp.

**Existing files:**
- `src/Code.gs` — has `onOpen()` and utility functions
- `src/Sidebar.html` — empty placeholder
- `appsscript.json` — standard manifest

## Git Setup

```
git checkout -b feat/task-sidebar
```

Work happens on this branch. One commit per phase.

## Phase 1: Server-Side Data Layer (`src/Code.gs`)

> The sidebar can't do anything without backend functions to read/write the sheet. Build these first so they can be tested independently from the Apps Script editor before touching HTML.

### Column constants

Add constants at the top of `Code.gs` to avoid magic numbers:

```js
var COL = { ID: 1, TITLE: 2, ASSIGNEE: 3, DUE_DATE: 4, PRIORITY: 5, STATUS: 6 };
var NUM_COLS = 6;
var HEADER_ROW = 1;
```

### `showSidebar()`

Extend the existing `onOpen()` menu to add a "Task Manager" item pointing to `showSidebar()`. The function itself:

```js
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Task Manager')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}
```

### `getTasks()`

Reads all data rows (row 2+) from the active sheet, maps to objects:

```js
function getTasks() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
  return data.map(function(row) {
    return {
      id: row[COL.ID - 1],
      title: row[COL.TITLE - 1],
      assignee: row[COL.ASSIGNEE - 1],
      dueDate: row[COL.DUE_DATE - 1] ? Utilities.formatDate(new Date(row[COL.DUE_DATE - 1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      priority: row[COL.PRIORITY - 1],
      status: row[COL.STATUS - 1]
    };
  });
}
```

Note: Date formatting via `Utilities.formatDate` so the client gets a clean string, not a serialized Date object (GAS serializes dates poorly over `google.script.run`).

### `addTask(taskData)`

Takes `{ title, assignee, dueDate, priority }` from the sidebar form. Generates an ID, appends a row, returns the new task:

```js
function addTask(taskData) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var id = 'TASK-' + Utilities.getUuid().substring(0, 8);
  var newRow = [id, taskData.title, taskData.assignee, taskData.dueDate, taskData.priority, 'Open'];
  sheet.appendRow(newRow);
  return { id: id, title: taskData.title, assignee: taskData.assignee,
           dueDate: taskData.dueDate, priority: taskData.priority, status: 'Open' };
}
```

Using `Utilities.getUuid()` substring instead of row-count-based IDs — avoids collisions if rows get deleted.

### `bulkUpdateStatus(taskIds, newStatus)`

Takes an array of task IDs and a target status. Finds matching rows and updates the Status column:

```js
function bulkUpdateStatus(taskIds, newStatus) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var idRange = sheet.getRange(2, COL.ID, lastRow - 1, 1).getValues();
  var count = 0;
  for (var i = 0; i < idRange.length; i++) {
    if (taskIds.indexOf(idRange[i][0]) !== -1) {
      sheet.getRange(i + 2, COL.STATUS).setValue(newStatus);
      count++;
    }
  }
  return count;
}
```

**Performance note:** For sheets with hundreds of tasks, the individual `setValue()` calls will be slow. Acceptable for now — if it becomes a problem, read the full status column into an array, modify in memory, then write back with a single `setValues()`.

### `getUniqueAssignees()`

Helper for the assignee filter dropdown — returns deduplicated list of assignees from the sheet:

```js
function getUniqueAssignees() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var assignees = sheet.getRange(2, COL.ASSIGNEE, lastRow - 1, 1).getValues();
  var unique = {};
  assignees.forEach(function(row) { if (row[0]) unique[row[0]] = true; });
  return Object.keys(unique).sort();
}
```

### Validation

- `addTask` should reject empty title (throw an error the client can catch via `withFailureHandler`)
- `bulkUpdateStatus` should validate that `newStatus` is one of `['Open', 'In Progress', 'Done']`

**Commit:** `git add src/Code.gs && git commit -m "feat: server-side CRUD functions for task sidebar"`

---

## Phase 2: Sidebar HTML + CSS (`src/Sidebar.html`)

> Get the layout and styling right with static content before adding interactivity. The sidebar is ~300px wide so space is tight — keep it compact.

### Structure

`Sidebar.html` will contain everything inline (GAS `HtmlService.createHtmlOutputFromFile` requires a single file unless you use templating). Three sections stacked vertically:

1. **Filter bar** (top, sticky)
   - Status dropdown: All / Open / In Progress / Done
   - Assignee dropdown: populated dynamically from `getUniqueAssignees()`
   - Both trigger client-side filtering (no server round-trip)

2. **Task list** (scrollable middle area)
   - Each task item: checkbox + title + assignee tag + due date + priority badge
   - Priority colors: Low = gray, Medium = blue, High = orange, Critical = red
   - Status shown as a small pill/label
   - Empty state: "No tasks found" message

3. **Bottom action bar** (fixed at bottom)
   - "Add Task" button — toggles a slide-down form panel
   - "Mark Done" button — acts on checked tasks
   - Selected count indicator: "3 selected"

### Form (toggled panel)

When "Add Task" is clicked, a form slides down from the top (or expands inline). Fields:
- Title (text input, required)
- Assignee (text input)
- Due Date (date input)
- Priority (select: Low / Medium / High / Critical, default Medium)
- Submit + Cancel buttons

### CSS approach

Inline `<style>` block. Key decisions:
- `box-sizing: border-box` globally
- System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
- Filter bar: `position: sticky; top: 0; background: white; z-index: 10`
- Task list: `overflow-y: auto; flex: 1` (fills remaining vertical space)
- Bottom bar: `position: sticky; bottom: 0; background: white; border-top: 1px solid #e0e0e0`
- Use flexbox for the overall layout: `html, body { height: 100%; } body { display: flex; flex-direction: column; }`
- Inputs styled to match Google's material-ish look (borders, border-radius, focus states)

**Commit:** `git add src/Sidebar.html && git commit -m "feat: sidebar HTML layout with form, filters, and task list"`

---

## Phase 3: Client-Side JS + `google.script.run` Wiring

> Wire everything together. The key pattern: `google.script.run.withSuccessHandler(fn).withFailureHandler(showError).serverFunction(args)`. Cache the task list client-side so filtering doesn't hit the server.

### State management

Simple module-level variables inside a `<script>` block:

```js
var allTasks = [];        // full task list from server
var selectedIds = new Set(); // checked task IDs
var filters = { status: 'All', assignee: 'All' };
```

### `loadTasks()`

Called on page load and after any mutation:

```js
function loadTasks() {
  showSpinner(true);
  google.script.run
    .withSuccessHandler(function(tasks) {
      allTasks = tasks;
      applyFiltersAndRender();
      showSpinner(false);
    })
    .withFailureHandler(function(err) {
      showError('Failed to load tasks: ' + err.message);
      showSpinner(false);
    })
    .getTasks();
}
```

### `applyFiltersAndRender()`

Filters `allTasks` in memory based on current `filters` state, then renders the filtered list into the DOM. This keeps filter changes instant:

```js
function applyFiltersAndRender() {
  var filtered = allTasks.filter(function(t) {
    if (filters.status !== 'All' && t.status !== filters.status) return false;
    if (filters.assignee !== 'All' && t.assignee !== filters.assignee) return false;
    return true;
  });
  renderTaskList(filtered);
  updateBulkActionBar();
}
```

### `renderTaskList(tasks)`

Builds HTML for the task list. Each item:

```html
<div class="task-item" data-id="TASK-abc123">
  <input type="checkbox" class="task-checkbox">
  <div class="task-content">
    <div class="task-title">Fix login bug</div>
    <div class="task-meta">
      <span class="assignee">@alice</span>
      <span class="due-date">2026-04-15</span>
      <span class="priority priority-high">High</span>
      <span class="status status-open">Open</span>
    </div>
  </div>
</div>
```

Use `innerHTML` on the container — fine for this scale. Checkbox change events update `selectedIds` and the bulk action bar count.

### Form submission

```js
function handleSubmit(e) {
  e.preventDefault();
  var taskData = {
    title: document.getElementById('title').value.trim(),
    assignee: document.getElementById('assignee').value.trim(),
    dueDate: document.getElementById('dueDate').value,
    priority: document.getElementById('priority').value
  };
  if (!taskData.title) { showError('Title is required'); return; }
  disableForm(true);
  google.script.run
    .withSuccessHandler(function() {
      resetForm();
      disableForm(false);
      loadTasks();
    })
    .withFailureHandler(function(err) {
      showError('Failed to add task: ' + err.message);
      disableForm(false);
    })
    .addTask(taskData);
}
```

### Bulk status update

```js
function markSelectedDone() {
  var ids = Array.from(selectedIds);
  if (ids.length === 0) return;
  google.script.run
    .withSuccessHandler(function(count) {
      showSuccess(count + ' task(s) marked as Done');
      selectedIds.clear();
      loadTasks();
    })
    .withFailureHandler(function(err) {
      showError('Bulk update failed: ' + err.message);
    })
    .bulkUpdateStatus(ids, 'Done');
}
```

### Assignee filter population

On page load, also call `getUniqueAssignees()` to populate the assignee dropdown:

```js
google.script.run
  .withSuccessHandler(function(assignees) {
    var select = document.getElementById('filterAssignee');
    assignees.forEach(function(a) {
      var opt = document.createElement('option');
      opt.value = a; opt.textContent = a;
      select.appendChild(opt);
    });
  })
  .getUniqueAssignees();
```

### UI helpers

- `showSpinner(bool)` — loading indicator over the task list
- `showError(msg)` — red notification bar, auto-dismiss after 4s
- `showSuccess(msg)` — green notification bar, auto-dismiss after 3s
- `disableForm(bool)` — disable/enable form inputs during submission
- `updateBulkActionBar()` — show/hide based on `selectedIds.size`, update count label

**Commit:** `git add src/Sidebar.html && git commit -m "feat: wire sidebar interactivity with google.script.run"`

---

## Phase 4: Edge Cases, Validation, and Polish

> Handle the things that will break in real usage: empty sheets, date edge cases, concurrent edits, and general UX polish.

### Edge cases to handle

1. **Empty sheet / missing headers**: `getTasks()` already returns `[]` if `lastRow < 2`. On the client, show an empty state message: "No tasks yet — create one above."

2. **Date serialization**: GAS `getValues()` returns Date objects for date columns. The `Utilities.formatDate()` call in `getTasks()` handles this, but guard against cells that aren't dates (user typed freeform text in the Due Date column) — wrap in try/catch, fall back to raw string.

3. **Stale data after external edits**: If someone edits the sheet directly while the sidebar is open, the sidebar's cached `allTasks` will be stale. Add a "Refresh" button/icon next to the filter bar that calls `loadTasks()`.

4. **Large sheets**: For 500+ rows, `getTasks()` will be slow. Consider pagination later, but for now just note the risk. The single `getValues()` call is already the efficient approach.

5. **Form validation**: Title required, due date should be today or later (warn but don't block — backfilling is legitimate).

### Visual polish

- Overdue tasks (due date before today): subtle red background or red text on the date
- "Select All" checkbox in the task list header
- Keyboard shortcut: Enter in form submits, Escape closes form panel
- Disable "Mark Done" button when nothing is selected (gray out)
- Sort tasks by due date ascending by default

### Update `appsscript.json`

Verify the manifest has the correct OAuth scopes. For reading/writing the active sheet:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets.currentonly"
  ]
}
```

Use `spreadsheets.currentonly` instead of `spreadsheets` — narrower scope, less scary permissions prompt for users.

**Commit:** `git add . && git commit -m "feat: edge case handling, validation, and UX polish for task sidebar"`

---

## Verification

Manual test sequence (via `clasp push` then open the sheet):

1. **Menu appears**: Reload sheet → "Task Manager" menu shows → click "Open Sidebar"
2. **Empty state**: On a fresh sheet (only headers), sidebar shows "No tasks yet" message
3. **Create task**: Fill form → submit → new row appears in sheet, task shows in sidebar list
4. **Create validation**: Submit with empty title → error message, no row added
5. **Filter by status**: Create tasks with different statuses → filter dropdown shows correct subsets
6. **Filter by assignee**: Multiple assignees → dropdown populated → filtering works
7. **Bulk select + Mark Done**: Check 3 tasks → click "Mark Done" → Status column updates to "Done" for all 3 → list refreshes
8. **Refresh**: Edit a task directly in the sheet → click Refresh → sidebar reflects the change
9. **Date display**: Due dates render as `yyyy-MM-dd`, not as timestamp strings

### Files modified

| File | Changes |
|------|---------|
| `src/Code.gs` | Added `showSidebar()`, `getTasks()`, `addTask()`, `bulkUpdateStatus()`, `getUniqueAssignees()`, column constants. Extended `onOpen()` menu. |
| `src/Sidebar.html` | Full sidebar implementation: HTML structure, inline CSS, inline JS with `google.script.run` integration. |
| `appsscript.json` | Verified/updated OAuth scopes. |
