# Auto-Sync Feature Proposal

## Overview

Implement an intelligent auto-sync mechanism for claude-craft that synchronizes repository changes at strategic points with minimal disruption to the user workflow.

## Sync Trigger Points

### 1. Session Start
- **When**: Claude Code session begins
- **Rationale**: Ensures user starts with latest changes
- **Frequency**: Once per session
- **Type**: Pull only (fetch latest from repository)

### 2. Session End
- **When**: Claude Code session terminates
- **Rationale**: Preserves work before session closes
- **Frequency**: Once per session
- **Type**: Push (commit and push local changes)

### 3. User Prompt Submit (Probabilistic)
- **When**: User submits a prompt
- **Check**: Generate random number, sync if `random % 27 == 0`
- **Probability**: ~3.7% chance per prompt
- **Rationale**: Periodic sync without being intrusive
- **Type**: Pull, then push if changes exist

## Configuration Structure

```json
{
  "autoSync": {
    "enabled": true,
    "triggers": {
      "sessionStart": {
        "enabled": true,
        "action": "pull",
        "silent": true
      },
      "sessionEnd": {
        "enabled": true,
        "action": "push",
        "silent": false,
        "commitMessage": "Auto-sync: Session end ${timestamp}"
      },
      "userPrompt": {
        "enabled": true,
        "probability": 27,
        "action": "sync",
        "silent": true,
        "debounceMs": 5000
      }
    },
    "lastSync": {
      "timestamp": "2025-09-01T12:00:00Z",
      "type": "manual",
      "status": "success"
    },
    "statistics": {
      "totalSyncs": 0,
      "sessionStartSyncs": 0,
      "sessionEndSyncs": 0,
      "promptSyncs": 0,
      "lastPromptCheck": 0
    }
  }
}
```

## Implementation Components

### 1. Sync Manager Script
`tools/auto-sync.sh`
- Central sync orchestrator
- Handles all sync operations
- Manages sync state and locks
- Reports sync status

### 2. Hook Scripts
```
hooks/scripts/session-start.sh
hooks/scripts/session-end.sh  
hooks/scripts/prompt-sync-check.sh
```

### 3. Settings Fragment
`settings/fragments/auto-sync-settings.json`

### 4. Sync State File
`~/.claude/auto-sync-state.json`
- Tracks last sync time
- Prevents duplicate syncs
- Stores sync statistics

## Probabilistic Sync Algorithm

```javascript
// On user prompt submit
function shouldSyncOnPrompt(config) {
  if (!config.autoSync.enabled) return false;
  if (!config.autoSync.triggers.userPrompt.enabled) return false;
  
  // Debounce check
  const now = Date.now();
  const lastCheck = config.autoSync.statistics.lastPromptCheck;
  if (now - lastCheck < config.autoSync.triggers.userPrompt.debounceMs) {
    return false;
  }
  
  // Random check
  const random = Math.floor(Math.random() * config.autoSync.triggers.userPrompt.probability);
  return random === 0;
}
```

## Safety Features

### 1. Conflict Detection
- Check for uncommitted changes before pull
- Stash changes if needed
- Alert user on conflicts

### 2. Lock Mechanism
- Prevent concurrent sync operations
- Use file-based locks
- Timeout after 60 seconds

### 3. Failure Recovery
- Log all sync attempts
- Retry with exponential backoff
- Fall back to manual sync on repeated failures

### 4. User Control
- Global enable/disable toggle
- Per-trigger configuration
- Force sync command
- Sync status indicator

## User Experience

### Silent Mode
- No output for successful syncs
- Only alert on errors or conflicts
- Optional status line indicator

### Verbose Mode
- Show sync progress
- Display changed files
- Report sync statistics

### Manual Override
```bash
/craft auto-sync enable
/craft auto-sync disable
/craft auto-sync status
/craft auto-sync force
```

## Performance Considerations

### 1. Async Operation
- Run sync in background
- Don't block user interaction
- Queue syncs if one is in progress

### 2. Minimal Git Operations
- Use `git fetch` before `git pull`
- Only pull if remote has changes
- Batch commits for efficiency

### 3. Smart Caching
- Cache repository status
- Refresh cache periodically
- Invalidate on file changes

## Security Considerations

### 1. Credential Management
- Use SSH keys or tokens
- Never store credentials in settings
- Leverage git credential helper

### 2. Pre-sync Validation
- Run security scan before push
- Block sync if critical issues found
- Log security events

### 3. Audit Trail
- Log all sync operations
- Track who triggered sync
- Record what was synced

## Migration Path

### Phase 1: Core Implementation
1. Create sync manager script
2. Add settings configuration
3. Implement session hooks

### Phase 2: Probabilistic Sync
1. Add prompt hook
2. Implement random check
3. Add debouncing

### Phase 3: Enhanced Features
1. Add statistics tracking
2. Implement conflict resolution
3. Add status indicators

## Testing Strategy

### Unit Tests
- Test probability calculation
- Verify debounce logic
- Check lock mechanism

### Integration Tests
- Test session lifecycle
- Verify git operations
- Test conflict scenarios

### Performance Tests
- Measure sync latency
- Test concurrent operations
- Verify background execution

## Metrics to Track

1. **Sync Frequency**: How often syncs occur
2. **Sync Duration**: Time taken per sync
3. **Conflict Rate**: How often conflicts occur
4. **Failure Rate**: Sync failure percentage
5. **User Interruption**: How often sync blocks user

## Alternative Approaches Considered

### 1. Time-based Sync
- Sync every N minutes
- **Rejected**: Too predictable, may interrupt workflow

### 2. Change-based Sync
- Sync after N file changes
- **Rejected**: Complex to track, may miss important changes

### 3. Activity-based Sync
- Sync during idle periods
- **Rejected**: Hard to detect true idle state

## Recommended Configuration

```json
{
  "autoSync": {
    "enabled": true,
    "triggers": {
      "sessionStart": {
        "enabled": true,
        "action": "pull",
        "silent": true
      },
      "sessionEnd": {
        "enabled": true,
        "action": "push",
        "silent": false
      },
      "userPrompt": {
        "enabled": true,
        "probability": 27,
        "action": "sync",
        "silent": true,
        "debounceMs": 5000
      }
    }
  }
}
```

This configuration provides:
- Fresh start each session
- Work preservation on exit
- ~3.7% chance of sync per prompt
- 5-second debounce to prevent rapid syncs
- Silent operation to minimize disruption