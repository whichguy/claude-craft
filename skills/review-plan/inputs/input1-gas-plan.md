# Plan: Add Sheet Protection Toggle to Sidebar

## Context
The Sheet Chat sidebar needs a button that lets users toggle protection on the active sheet. Currently users must navigate Google Sheets menus to protect/unprotect sheets. This feature brings that capability into the sidebar for convenience.

**Project:** Sheets Chat (scriptId: 1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG)

## Implementation Steps

### Phase 1: Server-Side Module

1. Create `sheet-protection.gs` with CommonJS module pattern:
   - `toggleProtection(sheetName)` — checks current protection status and toggles
   - `getProtectionStatus(sheetName)` — returns `{protected: boolean, description: string}`
   - Export via `module.exports`

2. Register in `require.gs` module registry

3. Add `__events__` handler for sidebar access:
   ```
   __events__ = {
     exec_api: { sheet_protection: { toggleProtection, getProtectionStatus } }
   }
   ```

### Phase 2: Sidebar UI

4. Add protection toggle button to sidebar HTML
5. Wire button click to `server.exec_api(null, 'sheet_protection', 'toggleProtection', sheetName)`
6. Display current protection status with visual indicator

### Phase 3: Testing

7. Write test cases for toggleProtection with mocked SpreadsheetApp
8. Test sidebar button click handler

## Verification
- Manual test: open sidebar, click toggle, verify sheet protection changes
- Run `npm test` for unit tests
