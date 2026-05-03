# Plan: Add File Upload Dialog to Sheet Chat

## Context
Users want to upload CSV files directly through the Sheet Chat sidebar to import data into their spreadsheets. This requires a new dialog with file picker, upload handling, and sheet insertion logic.

**Project:** Sheets Chat (scriptId: 1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG)

## UI Design Narrative**User experience**: User selects 'Import CSV...' from the Sheet Chat menu, sees a dialog with a file picker. They choose a CSV file, see a 5-row preview, select the target sheet and start position, then click Upload. A spinner shows during upload. On success the dialog closes; on error an inline message appears with a retry option.**Design intent**: Dialog provides immediate visual feedback via preview table so users can verify their file before committing. Error messages are inline to avoid confusion and allow retry without reopening.**State transitions**: idle → file-selected (preview shown) → uploading (spinner, Upload button disabled) → success (brief confirmation + close) or error (inline message shown, Upload button re-enabled).
## Implementation Steps

### Phase 1: Server-Side Upload Handler

> Intent: Establishes the server-side module for CSV parsing and sheet insertion, exposing it via exec_api for client calls. This phase creates the core business logic that all subsequent phases depend on.
**Pre-check:** Read `require.gs` via `mcp__gas__cat({file: 'require', remoteOnly: true})` to get fresh remote state; verify current module list, position count, and confirm no existing `csv_upload` namespace before inserting.**Outputs:** `csv-upload.gs` module, updated `require.gs`

1. Create `csv-upload.gs` with CommonJS module using 3-param signature `function _main(module, exports, log)` for debug logging support. Use `mcp_gas write` (not raw) to push the file:   - Specify folder path (e.g., `modules/csv-upload.gs`) consistent with project module layout   - `parseCSV(base64Data)` — decode base64 and parse CSV to 2D array
   - `insertToSheet(sheetName, data, startRow, startCol)` — write parsed data to sheet; acquire `LockService.getDocumentLock()` before writing to prevent concurrent write conflicts; for datasets >500 rows, use chunked `setValues()` calls in batches of 500 to avoid 6-minute execution timeout; document append vs overwrite behavior (startRow=1 with existing data overwrites); validate sheetName exists via `SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)` (throw if null)   - `getSheetNames()` — returns list of all sheet names via `SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName())` for populating client dropdown   - `uploadCSV(base64Data, sheetName, options)` — orchestrator function; validate base64Data size (max ~1MB encoded) and sheetName before processing; wrap all GAS API calls in try/catch and return `{success: false, error: message}` on failure   - Register in `require.gs` at correct position (after utility modules)
   - Add brief LLM-navigable comments at function entry points: purpose of `parseCSV` (base64 decode + CSV parse), `insertToSheet` (sheet target + chunked write), `uploadCSV` (orchestration + validation flow)   - **Verify:** exec `uploadCSV` with small test CSV base64 to confirm module loads and parses correctly
2. Add `__events__` registration:
   ```
   __events__ = {
     exec_api: { csv_upload: { uploadCSV, parseCSV, getSheetNames } }
   }
   ```
   Before writing, verify this `__events__` exec_api format matches an existing module: `mcp__gas__grep({pattern: 'exec_api.*{', limit: 3})` to confirm the registration structure.   Register `getSheetNames` in exports so the client can populate the sheet dropdown.
   **Git commit (Phase 1):** `git -C <project_dir> checkout -b feat/csv-upload && git add <path>/csv-upload.gs <path>/require.gs && git commit -m 'feat: add CSV upload server module'`
### Phase 2: Upload Dialog UI

> Intent: Builds the upload dialog UI with file picker, preview table, and configuration inputs, wired to call the Phase 1 server functions. Separating styles and script into sibling files follows GAS HtmlService conventions.
**Pre-check:** Phase 1 complete — `uploadCSV`, `parseCSV`, `getSheetNames` all accessible via exec_api.**Outputs:** `upload-dialog.html`, `upload-styles.html`, `upload-script.html`

3. Create `upload-dialog.html` (push with `mcp_gas write({..., raw: true})`):   - File input accepting .csv files only — `<label for="csvFile">CSV File</label><input id="csvFile" ...>`
   - Preview table showing first 5 rows
   - Sheet name selector (dropdown populated from active spreadsheet) — `<label for="sheetName">Sheet Name</label><select id="sheetName">...</select>`; add 'No sheets found' fallback if list is empty   - Start row/column inputs with defaults — `<label for="startRow">Start Row</label><input id="startRow" ...>` (and similarly for startCol)   - Upload and Cancel buttons
   - Loading spinner during upload
   - Inline error message container (hidden until error occurs)   - Use `<?!= include('upload-styles') ?>` and `<?!= include('upload-script') ?>`

4. Create `upload-styles.html` (push with `mcp_gas write({..., raw: true})`):   - Dialog layout: 400px width, auto height
   - Preview table with alternating row colors
   - Button styles matching existing sidebar theme
   - Spinner and error message container styles
5. Create `upload-script.html` (push with `mcp_gas write({..., raw: true})`):   - On load: call `server.exec_api(null, 'csv_upload', 'getSheetNames')` to populate sheet name dropdown   - File reader using FileReader API to convert to base64
   - CSV preview parser (client-side, first 5 rows only)
   - Server call: `server.exec_api(null, 'csv_upload', 'uploadCSV', base64Data, sheetName, options)`
   - On submit: disable Upload button + show spinner; re-enable on error   - Error handling: display inline error message on failure with retry option; show brief success message before `google.script.host.close()`   - Empty state: if sheet list is empty, disable Upload button and show "No sheets found" message   - Close dialog on success: `google.script.host.close()`
   - **Verify:** Open dialog via menu (Phase 3 wire-up needed) OR test via exec to confirm dialog renders without JS errors
   **Git commit (Phase 2):** `git add <path>/upload-dialog.html <path>/upload-styles.html <path>/upload-script.html && git commit -m 'feat: add CSV upload dialog UI'`
### Phase 3: Menu Integration

> Intent: Surfaces the upload feature via the Sheet Chat menu so users can discover and open it. This phase connects the Phase 2 dialog to a user-accessible menu entry point.
**Pre-check:** Phase 2 complete — dialog files pushed and rendering correctly. Read `menu.gs` to identify current menu function name and existing menu item list before modifying.**Outputs:** Updated `menu.gs`

6. Add "Import CSV..." menu item to the Sheet Chat menu
7. Wire menu item to open the upload dialog via `HtmlService.createTemplateFromFile('upload-dialog').evaluate().setWidth(400).setHeight(500)`
   - **Verify:** Reload spreadsheet, confirm "Import CSV..." appears in Sheet Chat menu and opens the dialog   **Git commit (Phase 3):** `git add <path>/menu.gs && git commit -m 'feat: wire CSV upload to menu'`
### Phase 4: Testing

> Intent: Validates correctness of CSV parsing edge cases and end-to-end upload flow, ensuring the feature is reliable before merging.
**Pre-check:** Phase 3 complete — dialog opens from menu and renders.**Outputs:** Test files

8. Write unit tests using the project's GAS test framework (TEST_FRAMEWORK folder) for `parseCSV`: quoted fields, newlines in fields, empty rows, header-only CSV9. Test file size limits (warn if > 1MB on client; verify server rejects oversized payloads)
10. Manual E2E test: upload CSV through dialog, verify data in sheet
    **Git commit (Phase 4):** `git add <path>/tests/* && git commit -m 'test: add CSV upload unit tests'`
## Git Strategy
- Feature branch: `feat/csv-upload` (created at start of Phase 1)
- Per-phase commits as specified in each phase above
- Push to remote: `git push -u origin feat/csv-upload`
- Create PR, squash merge to main
- **Rollback:** Each phase's commit is independently safe (new files only; no existing functionality altered). If any phase fails post-push, the feature branch can be abandoned without affecting main. To undo a remote phase: `mcp__gas__rm` the pushed files, then `git revert <commit>`.
## Verification
- All existing tests still pass
- Manual upload of sample CSV files works end-to-end
- Dialog opens and closes correctly
- Error states display properly (invalid file, too large, server error)
- Sheet name dropdown populates from active spreadsheet

## Post-Implementation Review1. Run `/review-fix --scope=branch` — loop until clean2. Run tests (Phase 4 test suite)3. If tests fail: fix → re-run `/review-fix --scope=branch` → re-run tests — repeat4. Push to remote: `git push -u origin feat/csv-upload`5. Create PR and squash merge to main