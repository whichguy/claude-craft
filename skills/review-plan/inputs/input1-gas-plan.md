# Plan: Add Sheet Protection Toggle to Sidebar

## Context
The Sheet Chat sidebar needs a button that lets users toggle protection on the active sheet. Currently users must navigate Google Sheets menus to protect/unprotect sheets. This feature brings that capability into the sidebar for convenience.

Note: `SpreadsheetApp.Protection` requires the user to be an editor or owner. The toggle functions must surface an appropriate error if the user lacks sufficient access. Protection changes are visible to all users with access to the sheet — this is a shared state change, not a per-user toggle.

**Project:** Sheets Chat (scriptId: 1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG)

**Branch:** `git checkout -b feature/sheet-protection-toggle`

## Implementation Steps

### Phase 1: Server-Side Module

> Intent: Create and register the server-side protection module that handles GAS SpreadsheetApp protection API calls.

0. Read `require.gs` via `mcp__gas__cat` (remoteOnly: true) to identify the current module registry structure and insertion point. Read the sidebar HTML file to confirm its current structure.

1. Create `sheet-protection.gs` at the appropriate project path (e.g., `sheets-chat/sheet-protection.gs`) with the CommonJS module pattern using the 3-param signature:
   - `function _main(module, exports, log) { ... }`
   - `toggleProtection(sheetName)` — validates `sheetName` is non-empty and sheet exists, checks current protection status and toggles it. Handles edge cases: (1) if multiple protection objects exist, toggle all; (2) if user is not the protection owner, return `{success: false, error: 'Insufficient permission'}`. (3) if no protection exists, create one with a default description. Wraps SpreadsheetApp calls in try/catch; returns `{success: false, error: message}` on failure consistent with exec_api error format.
   - `getProtectionStatus(sheetName)` — returns `{protected: boolean, description: string}`; handles missing/unprotected sheet gracefully.
   - Add LLM-navigable comment at module top: `// LLM: sheet-protection — toggles SpreadsheetApp SHEET-type protection on named sheets`
   - Add debug logging via `log()` at start of `toggleProtection`
   - Export via `module.exports`
   - Push via `mcp__gas__write`

2. Register in `require.gs` module registry at the insertion point identified in step 0. Verify that inserting `sheet-protection.gs` at its proposed position does not alter load order for existing `loadNow` modules (check file positions).
   - Push updated `require.gs` via `mcp__gas__write`
   - Verify: `mcp__gas__exec` → `sheet_protection.getProtectionStatus('Sheet1')` should return `{protected: boolean, description: string}` without error

3. Add `__events__` handler for sidebar access:
   ```
   __events__ = {
     exec_api: { sheet_protection: { toggleProtection, getProtectionStatus } }
   }
   ```
   - Push updated file via `mcp__gas__write`
   - Verify: `mcp__gas__exec` → exec_api call to `sheet_protection.getProtectionStatus` returns `success: true`

**Outputs:** `sheet-protection.gs` module registered in `require.gs` with `__events__` handler `sheet_protection` accessible via exec_api.

**Phase 1 commit:** `git add -A && git commit -m "feat: add sheet-protection server module with toggleProtection and getProtectionStatus"`

### Phase 2: Sidebar UI

> Intent: Wire the protection module into the sidebar UI with a toggle button and status indicator.

**Pre-check:** Verify Phase 1 `sheet_protection` module loads cleanly — `mcp__gas__exec` exec_api call to `getProtectionStatus` returns `success: true`.

4. Read the sidebar HTML file (confirmed in step 0) and add a protection toggle button using `mcp__gas__write({..., raw: true})` (HTML files require raw: true):
   - Add button with namespaced CSS class (e.g., `.sp-toggle-btn`) to avoid conflicts with Google's add-on CSS
   - Add `aria-label="Toggle sheet protection"` for accessibility
   - Include a visual status indicator for protection state (e.g., icon or text label)

5. Wire button click to `server.exec_api(null, 'sheet_protection', 'toggleProtection', sheetName)`:
   - Obtain `sheetName` on sidebar load via `server.exec_api(null, 'sheet_protection', 'getProtectionStatus', activeSheetName)` where `activeSheetName` is provided by the host spreadsheet context
   - Show a loading/disabled state on the toggle button while the server call is in progress; restore button state on completion or error
   - Use event delegation or remove-and-re-add the listener on sidebar initialization to prevent listener accumulation across sidebar reopens
   - Handle server errors: display user-facing message on `.catch()`

6. Display current protection status with visual indicator.
   - Push updated HTML via `mcp__gas__write({..., raw: true})`
   - Verify: open sidebar in browser and confirm toggle button renders with correct initial state

**Outputs:** Sidebar HTML updated with protection toggle button, status indicator, and client-side wiring.

**Phase 2 commit:** `git add -A && git commit -m "feat: add protection toggle button to sidebar UI"`

### Phase 3: Testing

> Intent: Verify server-side logic with unit tests and confirm sidebar integration works.

**Pre-check:** Verify Phase 2 sidebar button renders correctly by opening sidebar.

7. Write test cases for `toggleProtection` with mocked `SpreadsheetApp`:
   - Test: toggle on (no existing protection → creates protection)
   - Test: toggle off (protection exists → removes protection)
   - Test: insufficient permissions (non-owner → returns error)
   - Test: invalid sheetName (empty/missing → returns error)
   - Run `npm test` to confirm all pass

8. Test sidebar button click handler (manual verification or existing test harness):
   - Click toggle with protection off → verify sheet becomes protected
   - Click toggle with protection on → verify sheet becomes unprotected

**Phase 3 commit:** `git add -A && git commit -m "test: add sheet-protection unit tests and verify sidebar integration"`

## Post-Implementation Review

1. Run `/gas-review` or `/review-fix` — loop until clean
2. Run `npm test`
3. If tests fail: fix → re-run review-fix → re-run tests
4. Push and PR: `git push origin feature/sheet-protection-toggle && gh pr create --base main`

## Verification
- Manual test: open sidebar, click toggle, verify sheet protection changes in Google Sheets UI
- Run `npm test` for unit tests — all toggleProtection cases must pass
