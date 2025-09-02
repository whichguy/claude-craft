---
argument-hint: "[action] [context...]"
description: "Manage Claude Code agents, commands, and hooks through natural language"
allowed-tools: "all"
---

# Claude Craft Agent Sync Management

You are managing Claude Code synchronization between repository and Claude Code locations. Context: <prompt-context>

## Initial Setup

1. **Get repository path from settings**:
   - Check `~/.claude/settings.json` for claude-craft path
   - Default to `~/repos/claude-craft` if not found
   - Verify repository exists at the path

2. **Detect git repository root and project context**:
   - Run `git rev-parse --show-toplevel` to find git repository root
   - This determines the "project" boundary for Claude Code
   - Agents in `[git-root]/.claude/agents/` are "Project agents"
   - Agents in parent directories' `.claude/agents/` are "User agents"

3. **Determine user intent** from context "<prompt-context>":
   - **Status intent**: Contains "status", "what", "ready", "check", "show", "current", "available"
   - **Publish intent**: Contains "publish", "push", "commit"  
   - **Sync all intent**: Contains "add all", "sync all", "add everything", or just "add"/"sync"/"all"
   - **Sync specific intent**: Contains numbers or "add/sync/item" with numbers
   - **Auto-sync intent**: Contains "auto", "automatic", "schedule", "hook"
   - **Default**: Show status if intent unclear

## Action: Show Status

If intent is status-related:

1. **Update repository**: Run `git pull origin main` with 30-second timeout

2. **Detect current context**:
   ```bash
   # Get current working directory
   cwd=$(pwd)
   
   # Get git repository root (if in git repo)
   git_root=$(git rev-parse --show-toplevel 2>/dev/null)
   
   # Identify agent locations
   # Project agents: $git_root/.claude/agents/
   # User agents: parent directories' .claude/agents/
   ```

3. **Count already synced items**:
   - Walk up from git root checking each `.claude/agents/` directory
   - Check for symlinks pointing to the repository
   - Categorize as "Project" (in git root) or "User" (in parents)

4. **Show sync summary at the top**:
   ```
   📊 Claude Craft Sync Status
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📁 Repository: [path]
   🎯 Git Root: [git-root-path]
   📍 Current Directory: [cwd]
   
   🔗 Already Synced:
      Project level: X agents, Y commands, Z hooks, W prompts
      User level: A agents, B commands, C hooks, D prompts
   
   ✨ Available to Sync: M agents, N commands, O hooks, P prompts
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

5. **Show currently synced items by location**:
   ```
   🔗 Currently Synced
   
   📂 Project Level ([git-root]/.claude/)
   - Agents: list any symlinked agents
   - Commands: list any symlinked commands
   
   👤 User Level (parent directories)
   - In [parent-path]/.claude/:
     * Agents: list any symlinked agents
   ```

6. **Show items available to add** (Repository → Claude Code):
   
   For each type (agents, commands, hooks, prompts):
   - Check if symlink exists in ANY `.claude/` directory up the chain
   - If no symlink found, item is available to add
   
   Display with details:
   ```
   🔗 Available to Add
   
   🤖 Agents (X available)
   
   1. agent-name (2.3KB, 3h ago)
      Brief description of what this agent does
      Main purpose and key functionality
      📍 Suggested location: [Project/User level]
   
   [continue for all items]
   ```

7. **Show quick actions with location options**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📋 Quick Actions
   
   [P] Add All to Project  → /prompt agent-sync add all project
   [U] Add All to User     → /prompt agent-sync add all user
   [S] Add Specific        → /prompt agent-sync add 1,3,5
   [C] Choose Location     → /prompt agent-sync add 1 user
   [R] Refresh Status      → /prompt agent-sync status
   [H] Auto-Sync Setup     → /prompt agent-sync auto
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

## Action: Add/Sync Items

If intent is to add items:

1. **Parse item selection and location**:
   - Extract numbers from context
   - Determine target location: "project", "user", or ask
   - Default to project level if not specified

2. **Determine target directory**:
   ```bash
   if [[ "$location" == "project" ]]; then
     target_dir="$git_root/.claude"
   elif [[ "$location" == "user" ]]; then
     # Use parent of git root
     target_dir="$(dirname "$git_root")/.claude"
   else
     # Ask user to choose
   fi
   ```

3. **Create symlinks**:
   For each selected item:
   - Create target directory if needed: `mkdir -p $target_dir/agents`
   - Remove existing symlink if present
   - Create new symlink: `ln -s [repo_file] [target_path]`
   - Verify symlink was created

4. **Report results**:
   - List successfully linked items with their locations
   - Show which level (Project/User) they were added to
   - Suggest checking `/agents` command to verify

## Implementation Details

### Agent Discovery Functions

**find_git_root()**:
```bash
git rev-parse --show-toplevel 2>/dev/null
```

**find_agent_locations()**:
- Start from git root
- Walk up parent directories
- Check for `.claude/agents/` at each level
- Categorize as Project (git root) or User (parents)

**is_agent_synced(agent_name)**:
- Check git root: `[git-root]/.claude/agents/[agent].md`
- Walk up parents checking each `.claude/agents/`
- Return true if symlink found pointing to repository

**count_synced_by_level()**:
- Separate counts for project level vs user level
- Check symlink targets to ensure they point to repository

**get_sync_location_suggestion(agent_name)**:
- If agent is project-specific: suggest project level
- If agent is general-purpose: suggest user level
- Base on agent description/purpose

### Directory Walking Pattern

```bash
# Start from git root and walk up
current_dir="$git_root"
while [ "$current_dir" != "/" ]; do
  if [ -d "$current_dir/.claude/agents" ]; then
    # Check this location for agents
    echo "Found .claude/agents at: $current_dir"
  fi
  current_dir=$(dirname "$current_dir")
done
```

### Display Formatting

- Use double line spacing between major sections
- Use single line spacing between items within a section
- Include horizontal dividers (━━━) for visual separation
- Show emoji icons consistently for each type
- Indicate sync level (Project/User) clearly
- Keep descriptions to exactly 2 lines, truncating if needed

### Error Handling

- Check if in git repository before using git commands
- Handle case where no git repository exists
- Verify symlink creation success
- Provide clear error messages
- Fall back to defaults when settings missing

Execute the appropriate action based on the user's intent in "<prompt-context>".