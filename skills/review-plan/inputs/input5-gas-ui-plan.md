# Plan: Add File Upload Dialog to Sheet Chat

## Context
Users want to upload CSV files directly through the Sheet Chat sidebar to import data into their spreadsheets. This requires a new dialog with file picker, upload handling, and sheet insertion logic.

**Project:** Sheets Chat (scriptId: 1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG)

## Implementation Steps

### Phase 1: Server-Side Upload Handler

**Pre-check:** None
**Outputs:** `csv-upload.gs` module, updated `require.gs`

1. Create `csv-upload.gs` with CommonJS module:
   - `parseCSV(base64Data)` — decode base64 and parse CSV to 2D array
   - `insertToSheet(sheetName, data, startRow, startCol)` — write parsed data to sheet
   - `uploadCSV(base64Data, sheetName, options)` — orchestrator function
   - Register in `require.gs` at correct position (after utility modules)

2. Add `__events__` registration:
   ```
   __events__ = {
     exec_api: { csv_upload: { uploadCSV, parseCSV } }
   }
   ```

### Phase 2: Upload Dialog UI

**Pre-check:** Phase 1 complete
**Outputs:** `upload-dialog.html`, `upload-styles.html`, `upload-script.html`

3. Create `upload-dialog.html`:
   - File input accepting .csv files only
   - Preview table showing first 5 rows
   - Sheet name selector (dropdown populated from active spreadsheet)
   - Start row/column inputs with defaults
   - Upload and Cancel buttons
   - Loading spinner during upload
   - Use `<?!= include('upload-styles') ?>` and `<?!= include('upload-script') ?>`

4. Create `upload-styles.html`:
   - Dialog layout: 400px width, auto height
   - Preview table with alternating row colors
   - Button styles matching existing sidebar theme

5. Create `upload-script.html`:
   - File reader using FileReader API to convert to base64
   - CSV preview parser (client-side, first 5 rows only)
   - Server call: `server.exec_api(null, 'csv_upload', 'uploadCSV', base64Data, sheetName, options)`
   - Error handling with user-friendly messages
   - Close dialog on success: `google.script.host.close()`

### Phase 3: Menu Integration

**Pre-check:** Phase 2 complete
**Outputs:** Updated `menu.gs`

6. Add "Import CSV..." menu item to the Sheet Chat menu
7. Wire menu item to open the upload dialog via `HtmlService.createTemplateFromFile('upload-dialog').evaluate().setWidth(400).setHeight(500)`

### Phase 4: Testing

**Pre-check:** Phase 3 complete
**Outputs:** Test files

8. Write unit tests for CSV parsing edge cases (quoted fields, newlines in fields, empty rows)
9. Test file size limits (warn if > 1MB)
10. Manual E2E test: upload CSV through dialog, verify data in sheet

## Git Strategy
- Feature branch: `feat/csv-upload`
- Push to remote, create PR, squash merge

## Verification
- All existing tests still pass
- Manual upload of sample CSV files works end-to-end
- Dialog opens and closes correctly
- Error states display properly (invalid file, too large, server error)
