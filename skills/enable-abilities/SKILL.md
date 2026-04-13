---
name: enable-abilities
description: |
  Enable and configure Claude Code abilities — settings, hooks, MCP servers,
  and CLAUDE.md instructions. Reads existing config, makes targeted edits,
  and validates the result.

  AUTOMATICALLY INVOKE when user mentions:
  - "enable", "abilities", "config", "configure", "settings", "preferences", "setup"
  - "add hook", "create hook", "remove hook", "update hook"
  - "add MCP", "MCP server", "remove MCP", "update MCP"
  - "allowed tools", "permissions", "permission mode", "bypass permissions"
  - "CLAUDE.md", "project instructions", "edit instructions"
  - "environment variable", "env var", "add env"
  - "settings.json", ".claude.json", ".mcp.json"
  - "turn on", "turn off", "enable feature", "disable feature"

  Use this skill whenever the user wants to change how Claude Code behaves —
  permissions, tool access, hooks, MCP connections, or project instructions.
allowed-tools: Read, Edit, Write, Bash, Glob, Grep
---

# /enable-abilities — Claude Code Configuration

Make targeted changes to Claude Code configuration files. Parse the user's
request, read the current state, apply the change, and confirm what was done.

## Arguments

`$ARGUMENTS` may be empty (show overview) or contain a natural-language request.

## Step 0 — Route the Request

Determine which config area the user wants to change:

| Signal | Area | Jump to |
|--------|------|---------|
| No arguments | Overview | Step 1 |
| permissions, allowed tools, permission mode, env, defaultMode, plan, clear context, showClearContextOnPlanAccept | Settings | Step 2 |
| hook, event, PreToolUse, PostToolUse, SessionStart, matcher | Hooks | Step 3 |
| MCP, server, stdio, http, sse, .mcp.json, .claude.json | MCP Servers | Step 4 |
| CLAUDE.md, instructions, rules, project instructions | CLAUDE.md | Step 5 |
| Multiple areas or ambiguous | Clarify with user | — |

## Step 1 — Overview (no arguments)

Show the user a summary of their current config state:

1. Read `~/.claude/settings.json` — report permission mode, number of allow/deny rules, env vars, hook count
2. Read `~/.claude.json` — report MCP servers configured (global + per-project)
3. Check for `.mcp.json` in the current project root
4. Check for `CLAUDE.md` at project root, `.claude/CLAUDE.md`, and `~/.claude/CLAUDE.md`

Present a concise summary table, then ask what they'd like to change.

## Step 2 — Settings (settings.json)

### File locations and precedence

| Scope | Path | Precedence |
|-------|------|------------|
| User (global) | `~/.claude/settings.json` | Lowest |
| Project (shared) | `.claude/settings.json` | Higher |
| Local (personal) | `.claude/settings.local.json` | Higher still |
| Managed (IT) | `/Library/Application Support/ClaudeCode/managed-settings.json` | Highest |

Arrays merge across scopes; scalars use the most specific value.

### What can be configured

**permissions.allow / permissions.deny** — Tool access rules:
```
Bash(npm run *)          # Shell commands by prefix
Read(./.env)             # File read restrictions
Edit(**/*.ts)            # File edit restrictions
WebFetch(domain:github.com)  # Web fetch by domain
Agent(code-reviewer)     # Subagent access
mcp__server-name         # All tools from an MCP server
mcp__server__tool_name   # Specific MCP tool
```

**permissions.defaultMode** — One of:
`default` | `acceptEdits` | `plan` | `auto` | `dontAsk` | `bypassPermissions`

**env** — Environment variables available in every session:
```json
{ "env": { "MY_API_KEY": "value" } }
```

**Other fields:** `model`, `effortLevel` ("low"/"medium"/"high"), `autoUpdatesChannel` ("stable"/"latest"), `skipDangerousModePermissionPrompt`, `showClearContextOnPlanAccept` (boolean, enables "clear context" option when accepting plans), `sandbox`

### Workflow

1. Determine scope — ask the user if ambiguous (global vs project vs local)
2. Read the target settings.json file
3. Parse as JSON, apply the change
4. Write back with proper formatting (2-space indent)
5. Confirm: show the specific change made

**Permission rule syntax tips:**
- Use `Bash(cmd:*)` for command prefixes
- Use `**/*.ext` for recursive file globs
- Combine with deny rules for fine-grained control

## Step 3 — Hooks

Hooks are shell commands (or HTTP/prompt/agent calls) triggered by Claude Code events. They live in the `hooks` key of any settings.json file.

### Available events

| Event | When it fires | Matcher values |
|-------|---------------|----------------|
| `SessionStart` | Session begins | `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | Session ends | — |
| `UserPromptSubmit` | Before processing user input | — |
| `Stop` | Claude finishes responding | — |
| `PreToolUse` | Before a tool runs | Tool name or regex |
| `PostToolUse` | After a tool succeeds | Tool name or regex |
| `PostToolUseFailure` | After a tool fails | Tool name or regex |
| `PreCompact` | Before context compaction | — |
| `PostCompact` | After context compaction | — |
| `FileChanged` | Watched file changes | — |
| `CwdChanged` | Working directory changes | — |

### Hook structure

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/script.sh",
            "timeout": 10,
            "async": false
          }
        ]
      }
    ]
  }
}
```

**matcher** — Which tool/event to match:
- `"Bash"` — exact tool name
- `"Write|Edit"` — pipe-separated alternatives
- `"mcp__.*__read"` — regex pattern
- `"*"` — match all
- `""` (empty) — match all (for session events)

**hook types:**
- `command` — shell command (stdin receives JSON context, exit 0 = success, exit 2 = blocking error)
- `http` — POST to a URL
- `prompt` — LLM prompt evaluated at runtime
- `agent` — spawn a subagent

**PreToolUse hooks** can control permissions via stdout JSON:
```json
{
  "hookSpecificOutput": {
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "Why this was blocked",
    "updatedInput": { "command": "modified input" }
  }
}
```

### Workflow

1. Ask: which event? what should the hook do? which scope?
2. Read the target settings.json
3. Add the hook entry to the appropriate event array — never replace existing hooks
4. If the hook needs a script, write it and make it executable (`chmod +x`)
5. Write back settings.json
6. Confirm: show the hook that was added

## Step 4 — MCP Servers

MCP servers connect Claude to external tools and data sources.

### File locations

| Scope | Path | Committed? |
|-------|------|-----------|
| Project | `.mcp.json` at project root | Yes |
| Local (per-project) | `~/.claude.json` → `projects["/path"].mcpServers` | No |
| User (all projects) | `~/.claude.json` → `mcpServers` (top-level) | No |

### Server types

**stdio** — local process:
```json
{
  "mcpServers": {
    "my-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "my-mcp-server@latest"],
      "env": { "API_KEY": "${MY_API_KEY}" }
    }
  }
}
```

**http** — remote endpoint:
```json
{
  "mcpServers": {
    "my-server": {
      "type": "http",
      "url": "https://mcp.example.com/sse",
      "headers": { "Authorization": "Bearer ${TOKEN}" }
    }
  }
}
```

Environment variables in values use `${VAR}` or `${VAR:-default}` syntax.

### Workflow

1. Determine: add, update, or remove? which scope?
2. Read the target file (`.mcp.json` or `~/.claude.json`)
3. Apply the change to the `mcpServers` object
4. Write back with proper formatting
5. Confirm: show the server config that was added/changed/removed
6. Remind: restart Claude Code or run `/mcp` to pick up changes

**CLI alternative** — if the user prefers, they can use:
```bash
claude mcp add --transport stdio --scope local name -- command args
claude mcp add --transport http --scope project name url
claude mcp remove name
claude mcp list
```

## Step 5 — CLAUDE.md

CLAUDE.md files contain project instructions that load into every conversation.

### File locations

| File | Path | Scope |
|------|------|-------|
| Project instructions | `CLAUDE.md` or `.claude/CLAUDE.md` | Team-shared |
| Local overrides | `CLAUDE.local.md` | Personal (gitignored) |
| Global instructions | `~/.claude/CLAUDE.md` | All projects |
| Scoped rules | `.claude/rules/*.md` | Conditional (by file pattern) |

### Rules with path scoping

Rules files can use frontmatter to load only when Claude reads matching files:
```yaml
---
paths:
  - "**/*.test.ts"
  - "src/api/**/*.ts"
---
# Testing conventions
Use vitest for all tests...
```

Without `paths:` frontmatter, rules load at session start like CLAUDE.md.

### Workflow

1. Determine: which file to edit? (project CLAUDE.md is the default)
2. Read the existing file (or note that it doesn't exist yet)
3. Apply the requested change — add, remove, or modify sections
4. Write back the file
5. Confirm: show the change made

**Tips for good CLAUDE.md content:**
- Lead with the most important instructions
- Use clear section headers
- Keep it under 500 lines — move detailed references to `.claude/rules/`
- Project-specific conventions go in project CLAUDE.md; personal preferences go in `~/.claude/CLAUDE.md`

## General Principles

- **Always read before writing.** Never guess at the current state of a config file.
- **Preserve existing config.** Merge changes into the existing structure — never overwrite unrelated fields.
- **Validate JSON.** After writing settings.json or .claude.json, verify it's valid JSON.
- **Show the diff.** Tell the user exactly what changed, not just "done."
- **Scope awareness.** Default to the most appropriate scope. Ask if ambiguous.
- **No secrets in committed files.** Environment variables with sensitive values belong in `~/.claude/settings.json` (user scope) or `.claude/settings.local.json` (local scope), never in committed project files.
