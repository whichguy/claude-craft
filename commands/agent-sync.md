---
argument-hint: "[action] [context...]"
description: "Manage Claude Code extensions (agents, commands, skills, prompts, references, plugins, hooks) through natural language"
allowed-tools: "all"
---

# Claude Craft Agent Sync

**Context**: <prompt-arguments>

## Instructions

You are managing Claude Code extension synchronization between a git repository and ~/.claude/.
The sync script at `$HOME/claude-craft/tools/sync-status.sh` handles all operations.

### 1. Determine User Intent

From the context "<prompt-arguments>", classify the request:

- **Status**: "status", "what", "ready", "check", "current", or empty/unclear
- **Sync all**: "sync all", "sync everything", "sync", "all"
- **Publish**: "publish", "list local", "show local"
- **Add**: "add", "available", "what can I add"
- **Auto-sync**: "auto", "automatic", "schedule", "hook"
- **Unknown**: anything else -- run status, then tell the user what commands are available

### 2. Execute

Run the appropriate command using the Bash tool:

#### Status (default)
```bash
"$HOME/claude-craft/tools/sync-status.sh" status
```

#### Sync All
First pull latest changes, then sync:
```bash
git -C "$HOME/claude-craft" pull --ff-only origin main 2>/dev/null || true
"$HOME/claude-craft/tools/sync-status.sh" sync
```

#### Publish (show local-only items)
```bash
"$HOME/claude-craft/tools/sync-status.sh" publish
```

#### Add (show repo items not installed)
```bash
"$HOME/claude-craft/tools/sync-status.sh" add
```

#### Auto-sync
Run the auto-sync manager with the sub-action extracted from user input:
```bash
"$HOME/claude-craft/tools/auto-sync.sh" <sub-action>
```
Where `<sub-action>` is one of: `enable`, `disable`, `status`, `force`, or `test`.

### 3. Present Results

After running the script, present the output directly. Add context:

- For **status**: summarize what's in sync and what's not
- For **sync**: confirm what was linked, note that Claude Code restart may be needed
- For **publish**: explain these are local items that could be copied to the repo and committed
- For **add**: explain these are repo items that can be installed with `sync`
- For **auto-sync**: explain the current auto-sync configuration

### 4. Sync Options Footer

When showing status or add results with available items, suggest:
```
Sync Options:
  a) Sync all: /agent-sync sync
  b) View addable: /agent-sync add
  c) View publishable: /agent-sync publish
  d) Auto-sync: /agent-sync auto status
```

### 5. Error Handling

If the sync script is not found, suggest running install.sh:
```bash
"$HOME/claude-craft/install.sh"
```
