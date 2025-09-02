---
argument-hint: "[action] [context...]"
description: "Manage Claude Code agents, commands, and hooks through natural language"
allowed-tools: "all"
---

# Claude Craft Agent Sync Management

You are managing Claude Code synchronization between repository and profile. Context: <prompt-context>

## Initial Setup

1. **Get repository path from settings**:
   - Check `~/.claude/settings.json` for claude-craft path
   - Default to `~/repos/claude-craft` if not found
   - Verify repository exists at the path

2. **Determine user intent** from context "<prompt-context>":
   - **Status intent**: Contains "status", "what", "ready", "check", "show", "current", "available"
   - **Publish intent**: Contains "publish", "push", "commit"  
   - **Sync all intent**: Contains "add all", "sync all", "add everything", or just "add"/"sync"/"all"
   - **Sync specific intent**: Contains numbers or "add/sync/item" with numbers
   - **Auto-sync intent**: Contains "auto", "automatic", "schedule", "hook"
   - **Default**: Show status if intent unclear

## Action: Show Status

If intent is status-related:

1. **Update repository**: Run `git pull origin main` with 30-second timeout

2. **Show sync summary at the top**:
   ```
   📊 Claude Craft Sync Status
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📁 Repository: [path]
   🔗 Already Synced: X agents, Y commands, Z hooks, W prompts
   ✨ Available to Sync: A agents, B commands, C hooks, D prompts
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

3. **Show repository status**:
   - Run `git status --porcelain` to check for uncommitted changes
   - Report clean or number of changes

4. **Show items available to add** (Repository → Profile):
   
   Display with spacing and details:
   ```
   🔗 Available to Add
   
   🤖 Agents (X available)
   
   1. agent-name (2.3KB, 3h ago)
      Brief description of what this agent does
      Main purpose and key functionality
   
   2. another-agent (1.5KB, 1d ago)
      Description line one
      Description line two
   
   ⚡ Commands (Y available)
   
   3. command-name (4.1KB, 2d ago)
      What this command does
      Primary use case
   
   [continue pattern for hooks and prompts]
   ```

   For each item show:
   - Item number and name
   - File size (use `ls -lh` for human-readable format)
   - Time since modified (format as: "just now", "[n]m ago", "[n]h ago", "[n]d ago", "[n]w ago")
   - Two-line description:
     * Line 1: From `description:` field or first comment
     * Line 2: Additional context or main function (truncate at 60 chars)

5. **Show quick actions with labels**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📋 Quick Actions
   
   [A] Add All Items     → /prompt agent-sync add all
   [S] Add Specific      → /prompt agent-sync add 1,3,5
   [P] Publish Changes   → /prompt agent-sync publish
   [R] Refresh Status    → /prompt agent-sync status
   [H] Auto-Sync Setup   → /prompt agent-sync auto
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

## Action: Publish Changes

If intent is publish-related:

1. **Copy profile files to repository**:
   For each file in ~/.claude/{agents,commands,hooks,prompts}:
   - Check if newer than repository version
   - Copy to appropriate repository directory
   - Preserve file metadata

2. **Commit and push changes**:
   ```bash
   cd [repository]
   git add .
   git commit -m "Update agents, commands, and hooks from profile"
   git push origin main
   ```

## Action: Add/Sync Items

If intent is to add items:

1. **Parse item selection**:
   - "all": Link all unlinked items
   - Numbers: Extract specific item numbers from context

2. **Create symlinks**:
   For each selected item:
   - Create target directory if needed
   - Remove existing symlink if present
   - Create new symlink: `ln -s [repo_file] [profile_path]`
   - Verify symlink was created

3. **Report results**:
   - List successfully linked items
   - Show total count
   - Suggest status check to verify

## Action: Configure Auto-Sync

If intent is auto-sync related:

1. **Check current status**:
   - Look for ~/.claude/hooks/agent-sync-auto.sh

2. **Enable if requested**:
   Create hook file with:
   ```bash
   #!/bin/bash
   echo "🔄 Auto-syncing Claude Craft..."
   /prompt agent-sync status >/dev/null 2>&1
   ```
   Make executable with `chmod +x`

3. **Disable if requested**:
   Remove the hook file

4. **Show status**:
   Report whether auto-sync is enabled or disabled

## Implementation Details

### File Discovery Functions

**time_since_modified(file)**:
- Get modification time with `stat -f %m` (macOS) or `stat -c %Y` (Linux)
- Calculate seconds since modification
- Return formatted string: "just now", "[n]m ago", "[n]h ago", "[n]d ago", "[n]w ago"

**get_file_description(file)**:
- First line: Extract from `description:` field using grep
- If not found, use first comment line (# or //)
- Second line: Look for additional context, purpose, or functionality
- Truncate each line at 60 characters with "..."

**get_file_size(file)**:
- Use `ls -lh` to get human-readable size (e.g., 2.3KB, 15MB)
- Extract just the size field from ls output

**count_synced_items()**:
- For each type (agents, commands, hooks, prompts):
  - Count symlinks in ~/.claude/* pointing to repository
  - Return counts by type

**create_symlink(source, target_dir)**:
- Create target directory with `mkdir -p`
- Remove existing link if present
- Create new symlink with `ln -s`
- Verify creation and report result

### Display Formatting

- Use double line spacing between major sections
- Use single line spacing between items within a section
- Include horizontal dividers (━━━) for visual separation
- Show emoji icons consistently for each type
- Align action labels in brackets [A], [S], [P], etc.
- Keep descriptions to exactly 2 lines, truncating if needed

### Status Display Order

1. Sync summary box at top
2. Repository git status
3. Items available to add (with full details)
4. Quick actions box at bottom

### Error Handling

- Use timeout commands for network operations
- Check file/directory existence before operations
- Verify symlink creation success
- Provide clear error messages
- Fall back to defaults when settings missing

Execute the appropriate action based on the user's intent in "<prompt-context>".