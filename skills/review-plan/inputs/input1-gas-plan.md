# Plan: Add Sheet Protection Toggle to Sidebar

## Context
The Sheet Chat sidebar needs a button that lets users toggle protection on the active sheet. Currently users must navigate Google Sheets menus to protect/unprotect sheets. This feature brings that capability into the sidebar for convenience.

**Project:** Sheets Chat (scriptId: 1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG)

## Git Setup

- Create feature branch: `git checkout -b feat/sheet-protection-toggle`

## Implementation Steps

### Phase 1: Server-Side Module

> Intent: Creates the server-side module that encapsulates sheet protection logic, exposing it via the exec_api pattern for sidebar access.

**Pre-work (read existing files before modifying):**
- Read `require.gs` and verify the module registry pattern — confirm the `require()` registration syntax used by existing modules (current registry entries, line numbers)
- Read an existing module that uses `__events__` exec_api handler (e.g., grep `__events__` in project .gs files) — verify the exact registration syntax before writing Step 6
- Verify no existing `.gs` file already implements protection logic: `grep -r 'protect' *.gs common-js/` — confirm no duplication before creating new module
- Determine the correct folder for the new module: check existing CommonJS modules — if they live in `common-js/`, place `sheet-protection.gs` there; verify `COMMON-JS_SYNC` directive applies and plan dual update to MCP GAS templates if needed

1. Create `sheet-protection.gs` in the folder confirmed above (e.g., `common-js/sheet-protection.gs`) with CommonJS module pattern using `function _main(module, exports, log)` 3-param signature; include LLM-navigable comments at function boundaries (e.g., `// LLM: toggleProtection checks current sheet protection status and toggles it`):
   - `toggleProtection(sheetName)` — validates `sheetName` is non-empty string; checks current protection status; handles multi-protection edge case (if multiple protections exist, identifies the one created by this feature by description before removing); wraps operations in try/catch returning `{error: '...'}` on failure; acquires `LockService.getDocumentLock().tryLock(3000)` before check-then-act to prevent concurrent toggle races
   - `getProtectionStatus(sheetName)` — validates `sheetName`; returns `{protected: boolean, description: string}`; wraps in try/catch
   - Use `setModuleLogging` pattern for debug logging; include module name in log calls
   - Export via `module.exports`

2. Push `sheet-protection.gs` using `mcp__gas__write` (no `raw` flag — `.gs` file); exec to verify module loads without error
3. Register in `require.gs` module registry using the pattern confirmed in pre-work read step; after registering, verify no `loadNow` module depends on `sheet-protection.gs` at a higher file position (run `ls()` to check file order); if `COMMON-JS_SYNC` applies, also update the corresponding MCP GAS template entry
4. Push updated `require.gs` using `mcp__gas__write`; exec `require('sheet-protection').getProtectionStatus('Sheet1')` — verify returns `{protected: boolean, description: string}` without error

   **Rollback note:** if exec fails, revert `require.gs` to the pre-edit state, push the revert, exec verify.
5. Verify `appsscript.json` already includes the `spreadsheets` scope for protection operations, or add if missing
6. Add `__events__` handler for sidebar access:
   ```
   __events__ = {
     exec_api: { sheet_protection: { toggleProtection, getProtectionStatus } }
   }
   ```

**Outputs:** `sheet-protection.gs` module created and pushed; registered in `require.gs`; `__events__.exec_api.sheet_protection` active; exec verification confirms module loads and `getProtectionStatus` returns expected shape.

**Rollback (Phase 1):** if any step fails after push, revert `require.gs` and remove `sheet-protection.gs` from the registry; push revert and exec verify clean state.

**Phase 1 commit:** `git add <files> && git commit -m "feat: add sheet-protection CommonJS module with exec_api registration"`

### Phase 2: Sidebar UI

> Intent: Wires the protection module into the sidebar UI, adding a toggle button and status indicator for user interaction.

**Pre-check:** Verify Phase 1 outputs — exec `require('sheet-protection').getProtectionStatus('Sheet1')` returns `{protected: boolean, description: string}` without error before proceeding.

**Pre-work:** Read the sidebar HTML file (identify file name and path); verify the current container structure and existing button CSS classes to match styling. Read an existing `exec_api` call in the sidebar JavaScript to verify the call signature (confirm `null` as first arg, namespace as second, function name as third, args after).

7. Add protection toggle button and status indicator to sidebar HTML using `mcp__gas__write({..., raw: true})` — use namespaced CSS classes (e.g., `.sheet-protection-btn`, `.sheet-protection-status`); apply existing sidebar button CSS classes for visual consistency; add `aria-label` to both elements; include `<!-- LLM: protection toggle button and status indicator -->` comment

8. Wire button click using inline `onclick` attribute (or single-init guard) to `server.exec_api(null, 'sheet_protection', 'toggleProtection', sheetName)` — wrap client-side initialization in try/catch; log errors to console

9. Implement full UI state management for the protection controls:
   - On sidebar open: call `getProtectionStatus` with loading spinner while fetching; display result
   - During toggle: disable button + show "Updating..." while `exec_api` call is in flight; re-enable on completion
   - On success: update visual indicator to new protection state
   - On error: display error message to user

**Outputs:** Sidebar HTML updated with toggle button and status indicator; all UI states handled (loading, success, error).

**Phase 2 commit:** `git add <files> && git commit -m "feat: add protection toggle button and status indicator to sidebar"`

### Phase 3: Testing

> Intent: Validates the implementation with unit tests and a manual integration check to confirm the full toggle flow works end-to-end.

**Pre-check:** Phase 2 sidebar changes are live and the toggle button renders in the sidebar.

**Pre-work:** Verify the test framework's SpreadsheetApp mock approach — check existing test files for the mocking pattern used.

10. Write test cases for `toggleProtection` with mocked SpreadsheetApp — cover: normal toggle (unprotected → protected → unprotected), multi-protection edge case, invalid `sheetName` validation, error handling (mock throw)
11. Write test cases for `getProtectionStatus` — cover: protected sheet, unprotected sheet, invalid `sheetName`
12. Test sidebar button click handler — cover: loading state activation, exec_api call, success and error UI state transitions

**Phase 3 commit:** `git add <files> && git commit -m "test: add sheet-protection unit tests and sidebar handler tests"`

## UI Design Narrative

**User experience**: User opens the sidebar and sees the current protection status of the active sheet (locked/unlocked indicator). Clicking the toggle button protects or unprotects the sheet.

**Design intent**: Convenience — eliminates the need to navigate Google Sheets menus for protection management; brings this capability into the existing sidebar workflow.

**State transitions**: Loading (fetching status on open) → Ready (showing current status) → In-progress (toggle in flight, button disabled) → Updated (new status displayed) or Error (failed toggle with message shown).

## Post-Implementation Workflow

1. Run `/gas-review` — loop until 0 findings
2. Run `npm test` — verify all tests pass
3. If tests fail: fix → re-run `/gas-review` → re-run tests — repeat until passing
4. Update MEMORY.md to note the new `sheet-protection` module and its `exec_api` namespace
5. Push feature branch and open PR to main: `git push origin feat/sheet-protection-toggle`