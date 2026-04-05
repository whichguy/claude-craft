---
name: model-map
description: |
  Manage model routing config for Claude Code subagents.
  View, add, update, or remove session rules and model mappings
  in ~/.claude/model-map.json.

  AUTOMATICALLY INVOKE when:
  - "model map", "model mapping", "model routing", "model config"
  - "change subagent model", "route model", "set child model"
  - "show model rules", "list model mappings"
allowed-tools: Read, Bash, Write, Edit
---

# /model-map — Manage Model Routing Config

Manage `~/.claude/model-map.json` which controls how subagent models are routed
via the SessionStart + PreToolUse hooks.

**Priority order:**
1. `session_rules` — forces ALL agents to the mapped model for the entire session
2. `model_mappings` — remaps individual model names (fallback when no session rule matches)

Changes take effect immediately — hooks read the config on every invocation.

## Step 0 — Parse Arguments

Extract from `$ARGUMENTS`:
- No args → **show** current config
- `session <model> <child>` → **add/update** session rule
- `session <model> --remove` → **remove** session rule
- `map <from> <to>` → **add/update** model mapping
- `map <from> --remove` → **remove** model mapping
- `provider <model> <base_url>` → **add/update** provider endpoint
- `provider <model> --remove` → **remove** provider config
- `clear` → **reset** to empty config (preserves providers)

## Step 1 — Ensure Config Exists

```bash
CONFIG="$HOME/.claude/model-map.json"
```

If the file doesn't exist, create it:
```json
{
  "session_rules": {},
  "model_mappings": {}
}
```

## Step 2 — Execute Command

### Show (no args)

Read `~/.claude/model-map.json` and display with box-drawing UI.

Also detect the active session model by finding the most recent session-model file:
```bash
ls -t ~/.claude/session-env/*/session-model 2>/dev/null | head -1
```
Read that file to get the currently forced child model (may be empty = passthrough).

**When rules exist:**
```
╔══════════════════════════════════════════════════════╗
║  Model Router                                        ║
╚══════════════════════════════════════════════════════╝

Session Rules (forces ALL agents)
  ┌─────────────────────────┬──────────────────┐
  │ Session Model           │ Child Model      │
  ├─────────────────────────┼──────────────────┤
  │ claude-opus-4-6[1m]     │ sonnet           │
  │ gemma4:26b              │ gemma4:26b       │
  └─────────────────────────┴──────────────────┘

Model Mappings (fallback per-model)
  ┌──────────┬──────────┐
  │ From     │ To       │
  ├──────────┼──────────┤
  │ sonnet   │ haiku    │
  └──────────┴──────────┘

  Status: claude-opus-4-6[1m] → children use **sonnet**
```

Dynamically size columns to fit the longest key/value. Omit a section header entirely
if that section is empty (don't show an empty table).

**When both sections are empty (passthrough mode):**
```
╔══════════════════════════════════════════════════════╗
║  Model Router                                        ║
╚══════════════════════════════════════════════════════╝

  Mode: passthrough (no rules — all agents use their declared model)

  /model-map session <model> <child>  — force child model for a session
  /model-map map <from> <to>          — remap a specific model name
```

**Providers section** (only if `.providers` has entries):
```
Providers (use with: claude-route <model>)
  ┌──────────────┬───────────────────────────┐
  │ Model        │ Endpoint                  │
  ├──────────────┼───────────────────────────┤
  │ gemma4:26b   │ http://localhost:11434     │
  └──────────────┴───────────────────────────┘
```

**Status line logic:**
- If active session file exists and is non-empty: `Status: <session_model> → children use **<child>**`
- If active session file exists but is empty: `Status: passthrough (no session rule for current model)`
- If no session file found: `Status: unknown (no active session detected)`

### session <model> <child>

Use Bash to update the JSON:
```bash
jq --arg k "<model>" --arg v "<child>" '.session_rules[$k] = $v' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

Print: `Added session rule: <model> → <child>`
Then show the updated config.

### session <model> --remove

```bash
jq --arg k "<model>" 'del(.session_rules[$k])' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

Print: `Removed session rule: <model>`
Then show the updated config.

### map <from> <to>

```bash
jq --arg k "<from>" --arg v "<to>" '.model_mappings[$k] = $v' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

Print: `Added model mapping: <from> → <to>`
Then show the updated config.

### map <from> --remove

```bash
jq --arg k "<from>" 'del(.model_mappings[$k])' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

Print: `Removed model mapping: <from>`
Then show the updated config.

### provider <model> <base_url>

Add or update a provider config with sensible defaults for Ollama:
```bash
jq --arg m "<model>" --arg url "<base_url>" \
  '.providers[$m] = {"base_url": $url, "auth_token": "ollama", "api_key": "", "config_dir": "$HOME/.claude-ollama", "disable_nonessential_traffic": true}' \
  "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

Print: `Added provider: <model> → <base_url>`
Print: `Launch with: claude-route <model>`
Then show the updated config.

### provider <model> --remove

```bash
jq --arg m "<model>" 'del(.providers[$m])' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

Print: `Removed provider: <model>`
Then show the updated config.

### clear

Write config with empty rules but preserve providers:
```bash
jq '.session_rules = {} | .model_mappings = {}' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

Print: `Model routing rules cleared (providers preserved).`
