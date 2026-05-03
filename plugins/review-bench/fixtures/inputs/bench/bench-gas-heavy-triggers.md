# Plan: Automated External API Synchronization with Time-Driven Triggers

## Context
- **Type**: Spreadsheet-bound / Standalone Sync Tool.
- **Goal**: Synchronize 5000+ rows of data from an external REST API into a Google Sheet every hour.

## Git Setup
- `Code.gs` for the sync logic.
- `Constants.gs` for API keys and endpoints.

## Implementation Steps

### Step 1: Sync Logic
Implement a function to fetch and write data.

```javascript
function syncData() {
  const API_URL = "https://api.example.com/v1/heavy-data";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sync");
  
  // Fetch a large dataset (5000+ items)
  const response = UrlFetchApp.fetch(API_URL, {
    headers: { "Authorization": "Bearer " + getServiceToken() }
  });
  const data = JSON.parse(response.getContentText());
  
  // TRAP: Processing 5000+ rows in a single execution loop
  data.forEach((item, index) => {
    // Simulate complex processing
    Utilities.sleep(100); // 100ms per row
    sheet.appendRow([item.id, item.name, item.status, new Date()]);
  });
  
  console.log("Sync Complete");
}

function getServiceToken() {
  // Placeholder for OAuth2 logic
  return "MOCK_TOKEN";
}
```

### Step 2: Trigger Setup
Set up the time-driven trigger.

```javascript
function createTriggers() {
  ScriptApp.newTrigger('syncData')
      .timeBased()
      .everyHours(1)
      .create();
}
```

## Verification
- Run `syncData` manually.
- Monitor execution logs in Google Cloud Console.

## Risks
- **Execution Timeout**: GAS has a 6-minute execution limit per trigger. Processing 5000 rows with a 100ms delay per row will take approximately 8.3 minutes, exceeding the limit.
- **Quota Limits**: Frequent `appendRow` calls are inefficient and may hit Spreadsheet service quotas; batch updates with `setValues` are preferred but omitted here.
- **Missing Continuity**: The plan lacks a state-tracking mechanism (e.g., PropertiesService) or a continuation token to resume processing in a subsequent trigger execution.
