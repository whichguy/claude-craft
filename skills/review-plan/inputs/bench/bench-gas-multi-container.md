# Plan: Shared GAS Library for Multi-Container Environments

## Context
- **Type**: Standalone Library.
- **Goal**: Provide a unified logging and trigger-handling library for Forms, Docs, and Sheets.

## Git Setup
- Repository for the library code.
- `appsscript.json` for advanced scope management.

## Implementation Steps

### Step 1: Define Library Logic
Implement a core function to log data to a specific spreadsheet.

```javascript
/**
 * @param {Object} event The trigger event object
 */
function handleGenericTrigger(event) {
  const timestamp = new Date();
  const source = event ? "Trigger" : "Manual";
  
  // TRAP: Hardcoded Spreadsheet ID
  const LOG_SHEET_ID = "1abc12345-FIXED-ID-DO-NOT-CHANGE";
  const ss = SpreadsheetApp.openById(LOG_SHEET_ID);
  ss.getSheets()[0].appendRow([timestamp, source, JSON.stringify(event)]);
}

function onFormSubmit(e) {
  handleGenericTrigger(e);
}

function onEdit(e) {
  handleGenericTrigger(e);
}
```

### Step 2: Configure appsscript.json
Ensure the library has the necessary scopes for multiple container types.

```json
{
  "timeZone": "America/New_York",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/forms",
    "https://www.googleapis.com/auth/documents"
  ]
}
```

## Verification
- Deploy as a Library.
- Include in a Google Form project and call `Library.onFormSubmit(e)`.
- Include in a Google Doc project.

## Risks
- **Runtime Failure**: The hardcoded `LOG_SHEET_ID` will cause the library to fail if the script running it doesn't have access to that specific spreadsheet, or if used in a container like a Form where the context expects a different destination.
- **Trigger Conflicts**: `onEdit` triggers in the library may not behave as expected when called from a Doc container.
