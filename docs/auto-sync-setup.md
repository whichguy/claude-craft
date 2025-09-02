# Auto-Sync Setup Guide

## Quick Start

1. **Enable Auto-Sync**
   ```bash
   /agent-sync auto-sync enable
   ```
   This will automatically:
   - Install hook script to `~/.claude/hooks/`
   - Configure hook in `~/.claude/settings.json`
   - Set up probabilistic sync trigger

2. **Restart Claude Code**
   ```bash
   /resume
   ```
   **Important**: You must restart for hooks to take effect

3. **Verify Setup**
   ```bash
   /agent-sync auto-sync status
   ```

## Manual Installation Steps

### 1. Copy Hook Scripts

```bash
# Create hooks directory
mkdir -p ~/.claude/hooks

# Copy auto-sync hook
cp ~/src5/subagent-sync/claude-craft/hooks/scripts/prompt-sync-check.sh ~/.claude/hooks/

# Make executable
chmod +x ~/.claude/hooks/*.sh
```

### 2. Configure Settings

Edit `~/.claude/settings.json` and add:

```json
{
  "hooks": {
    "onUserPromptSubmit": "~/.claude/hooks/prompt-sync-check.sh"
  },
  "autoSync": {
    "enabled": true,
    "triggers": {
      "sessionStart": {
        "enabled": false,
        "action": "pull",
        "silent": true
      },
      "sessionEnd": {
        "enabled": false,
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

### 3. Initialize Repository Configuration

The auto-sync system needs to know where your claude-craft repository is located:

```bash
# This is done automatically, but you can verify with:
cat ~/.claude/claude-craft.json
```

Expected output:
```json
{
  "repository": {
    "path": "/home/user/src5/subagent-sync/claude-craft",
    "remote": "origin",
    "branch": "main"
  }
}
```

## Configuration Options

### Sync Triggers

#### Session Start (Disabled by Default)
- **When**: Claude Code session begins
- **Default Action**: Pull latest changes
- **Configure**: 
  ```json
  "sessionStart": {
    "enabled": false,
    "action": "pull",  // pull, push, or sync
    "silent": true,
    "timeout": 30
  }
  ```

#### Session End (Disabled by Default)
- **When**: Claude Code session ends
- **Default Action**: Push local changes
- **Configure**:
  ```json
  "sessionEnd": {
    "enabled": false,
    "action": "push",
    "silent": false,
    "commitMessage": "Auto-sync: Session end",
    "timeout": 60
  }
  ```

#### User Prompt (Probabilistic) - Primary Trigger
- **When**: User submits a prompt
- **Probability**: 1/27 chance (configurable)
- **Default**: Enabled
- **Configure**:
  ```json
  "userPrompt": {
    "enabled": true,
    "probability": 27,  // 1 in 27 chance
    "action": "sync",
    "silent": true,
    "debounceMs": 5000  // Min time between checks
  }
  ```

### Probability Settings

The `probability` value determines how often sync occurs:
- `27` = ~3.7% chance per prompt (default)
- `50` = 2% chance per prompt
- `100` = 1% chance per prompt
- `10` = 10% chance per prompt

### Actions

- **pull**: Fetch and merge remote changes
- **push**: Commit and push local changes
- **sync**: Pull then push (full synchronization)

## Commands

### Enable/Disable
```bash
# Enable auto-sync
/agent-sync auto-sync enable

# Disable auto-sync
/agent-sync auto-sync disable
```

### Check Status
```bash
# View current configuration and statistics
/agent-sync auto-sync status
```

### Force Sync
```bash
# Manually trigger a sync
/agent-sync auto-sync force
```

## Monitoring

### View Logs
```bash
# Check sync logs
tail -f ~/.claude/auto-sync.log
```

### Check Statistics
```bash
# View sync statistics
/agent-sync auto-sync status
```

Statistics include:
- Total syncs performed
- Session start syncs
- Session end syncs
- Prompt-triggered syncs
- Failed syncs

## Troubleshooting

### Sync Not Working

1. **Check if enabled**:
   ```bash
   /agent-sync auto-sync status
   ```

2. **Verify hooks are installed**:
   ```bash
   ls -la ~/.claude/hooks/
   ```

3. **Check repository configuration**:
   ```bash
   cat ~/.claude/claude-craft.json
   ```

4. **View logs for errors**:
   ```bash
   tail -20 ~/.claude/auto-sync.log
   ```

### Repository Not Found

If auto-sync can't find your repository:

1. **Set repository path manually**:
   ```bash
   ~/src5/subagent-sync/claude-craft/tools/claude-craft-config.sh set-repo /path/to/claude-craft
   ```

2. **Verify path**:
   ```bash
   ~/src5/subagent-sync/claude-craft/tools/claude-craft-config.sh show
   ```

### Conflicts During Sync

If you encounter merge conflicts:

1. **Check repository status**:
   ```bash
   cd ~/src5/subagent-sync/claude-craft
   git status
   ```

2. **Resolve conflicts manually**:
   ```bash
   git add .
   git commit -m "Resolved conflicts"
   git push
   ```

3. **Reset auto-sync**:
   ```bash
   /agent-sync auto-sync force
   ```

### Performance Issues

If sync is causing delays:

1. **Increase debounce time**:
   ```json
   "userPrompt": {
     "debounceMs": 10000  // 10 seconds
   }
   ```

2. **Reduce probability**:
   ```json
   "userPrompt": {
     "probability": 100  // 1% chance
   }
   ```

3. **Disable prompt sync**:
   ```json
   "userPrompt": {
     "enabled": false
   }
   ```

## Security Considerations

### Pre-push Security Scan

Auto-sync runs security scans before pushing:
- Checks for API keys and credentials
- Detects personal information
- Blocks push if critical issues found

### Secure Git Operations

When available, uses `secure-git.sh` for:
- Threat analysis of pulled changes
- Quarantine of suspicious files
- Rollback on security threats

## Best Practices

1. **Keep probability reasonable**: Default of 27 (3.7%) is recommended
2. **Enable silent mode**: For prompt syncs to avoid disruption
3. **Regular manual syncs**: Use `/agent-sync sync` for important changes
4. **Monitor logs**: Check logs weekly for issues
5. **Backup before major changes**: Use `/agent-sync backup` manually

## Uninstalling Auto-Sync

To completely remove auto-sync:

1. **Disable auto-sync**:
   ```bash
   /agent-sync auto-sync disable
   ```

2. **Remove hook**:
   ```bash
   rm ~/.claude/hooks/prompt-sync-check.sh
   ```

3. **Clean up configuration**:
   ```bash
   # Remove from settings.json
   # Delete the "hooks" and "autoSync" sections
   ```

4. **Remove state files**:
   ```bash
   rm ~/.claude/auto-sync-state.json
   rm ~/.claude/auto-sync.lock
   rm ~/.claude/claude-craft.json
   ```