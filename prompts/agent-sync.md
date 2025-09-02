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

2. **Show repository status**:
   - Run `git status --porcelain` to check for uncommitted changes
   - Report clean or number of changes

3. **Show currently linked items**:
   For each directory (~/.claude/agents, commands, hooks, prompts):
   - Count symlinks pointing to repository
   - Group by type, then by profile vs local location
   - Display with appropriate emoji (🤖 Agents, ⚡ Commands, 🪝 Hooks, 📝 Prompts)

4. **Show unpublished items**:
   Check for files that are:
   - Modified in git (from `git status --porcelain`)
   - Missing symlinks to ~/.claude
   Display with file size, date, and description

5. **Show items available to publish** (Profile → Repository):
   Find files in ~/.claude/* that:
   - Don't exist in repository
   - Are newer than repository version
   - Have different content (use `cmp -s`)

6. **Show items available to add** (Repository → Profile):
   Find repository files without symlinks in ~/.claude
   For each, calculate time since modified:
   - Use `stat -f %m` (macOS) or `stat -c %Y` (Linux)
   - Format as: "just now" (<60s), "[n]m ago" (<1h), "[n]h ago" (<1d), "[n]d ago" (<1w), "[n]w ago"
   
   Number each item and show:
   - Item number, name, time since modified
   - Description from file header
   
7. **Show quick actions** if items available:
   - Add all: `/prompt agent-sync add all`
   - Add specific: `/prompt agent-sync add 1-5` or `add 1,3,7`
   - Publish: `/prompt agent-sync publish`

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

**is_unpublished(file, link_path)**:
- Check if file appears in `git status --porcelain` output
- Check if symlink exists and points to repository
- Return true if modified or unlinked

**create_symlink(source, target_dir)**:
- Create target directory with `mkdir -p`
- Remove existing link if present
- Create new symlink with `ln -s`
- Verify creation and report result

**display_linked_by_type(type, emoji, extension, dir)**:
- Scan directory for symlinks
- Check each symlink target with `readlink`
- Group by profile vs local based on path containing ".claude/"
- Display grouped results with counts

### Status Display Order

1. Repository information and git status
2. Currently linked items (grouped by type then location)
3. Unpublished items needing commit
4. Items available to publish from profile
5. Items available to add from repository (numbered)
6. Quick action suggestions

### Error Handling

- Use timeout commands for network operations
- Check file/directory existence before operations
- Verify symlink creation success
- Provide clear error messages
- Fall back to defaults when settings missing

Execute the appropriate action based on the user's intent in "<prompt-context>".