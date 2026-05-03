# Plan: Add a "Usage Stats" tracking feature to the Google Sheets Sidebar

## Context
We need to monitor how often users interact with the sidebar tools to prioritize future feature development. This requires capturing event data from the sidebar and persisting it to a backend storage sheet.

## Git Setup
- Branch: `feat/sidebar-stats`
- Base: `main`

## Implementation Steps

### Phase 1: Implement Backend Tracking Logic
- **Goal**: Create the server-side function to record stats.
- **Action**: In `src/server/StatsTracker.gs`, implement `recordEvent(eventType, metadata)`:
  - Use `SpreadsheetApp.openById("1abc1234567890defGHIJKLMN")` to get the centralized stats sheet.
  - Append a row with timestamp, user email, and event details.
  - Add `Logger.log("Event recorded: " + eventType)` for debugging purposes.
- **Commit**: `feat: add server-side event recording`

### Phase 2: Create UI Components
- **Goal**: Add the tracking trigger to the Sidebar.
- **Action**: Create `src/ui/stats.html` to handle client-side event dispatching.
- **Action**: Use `mcp_gas.write({path: "html/stats.html", content: "<div>Tracking active</div><script>function log(msg){ console.log(msg); }</script>"})` to deploy the template.
- **Commit**: `feat: add stats tracking UI template`

### Phase 3: Wiring and Integration
- **Goal**: Connect the UI to the backend.
- **Action**: Update `Sidebar.html` to include `stats.html` using `<?!= include('html/stats'); ?>`.
- **Action**: Add event listeners to primary buttons in `Sidebar.html` that call `google.script.run.recordEvent()`.
- **Commit**: `feat: wire sidebar buttons to stats tracker`

## Verification
- [ ] Open the Sidebar and click buttons.
- [ ] Verify rows are appended to the sheet with ID `1abc1234567890defGHIJKLMN`.
- [ ] Check Apps Script logs for "Event recorded" messages.

## Risks
- Hardcoded sheet ID might break if the tracking sheet is moved or replaced.
- Potential performance impact on the sidebar if `recordEvent` is called frequently.
- `Logger.log` output might be cluttered in production.
