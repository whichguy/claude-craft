# Project Plan: Mobile-to-Cloud Sync Engine

## Objective
Implement a robust synchronization mechanism between the mobile client and the cloud backend for the "Notes" feature to ensure data consistency across devices.

## Context
Users create and edit notes on their mobile devices (iOS/Android) and expect them to be reflected on the web dashboard. We need a reliable way to merge changes when the mobile device comes back online.

## Implementation Steps
1. **Schema Update**: Ensure both `Note` models (Client and Server) have an `updatedAt` ISO-8601 timestamp.
2. **Conflict Detection**: Implement the following logic in the `SyncService.processMerge` method:
   - For each incoming note from the mobile client:
     - Fetch the current version from the Cloud database.
     - If the mobile `updatedAt` timestamp is greater than the cloud `updatedAt` timestamp (`mobileNote.updatedAt > cloudNote.updatedAt`), overwrite the cloud version with the mobile version.
     - Otherwise, discard the mobile change as it is considered "stale."
3. **Connectivity Handling**: Trigger this sync logic whenever the mobile application detects a transition from `offline` to `online` status.
4. **Validation**: Create a test case where a note is updated offline and verify it overwrites the server version upon reconnection.

## Success Criteria
- Notes edited offline successfully sync to the cloud.
- The latest change (based on timestamp) always wins.
