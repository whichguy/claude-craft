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
- `route <name> <model>` → **add/update** named route for `claude-router --route`
- `route <name> --remove` → **remove** named route
- `clear` → **reset** to empty config (preserves providers and routes)

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
  /model-map map <from> inherit       — strip model field, defer to native resolution

  ℹ Standard names (sonnet, opus, haiku) are resolved natively by Claude Code.
    Only add mappings for custom model IDs or use 'inherit' to strip the field.
```

**Routes section** (only if `.routes` has entries):
```
Routes (use with: claude-router --route <name>)
  ┌──────────────────┬──────────────────────────┐
  │ Route            │ Model                    │
  ├──────────────────┼──────────────────────────┤
  │ default          │ claude-sonnet-4-6        │
  │ background       │ qwen3-coder:30b          │
  │ think            │ claude-sonnet-4-6        │
  │ longContext      │ claude-sonnet-4-6        │
  └──────────────────┴──────────────────────────┘
```

**Providers section** (only if `.providers` has entries):
```
Providers (use with: claude-router --model <name>)
  ┌──────────────────┬───────────────────────────┬──────────┐
  │ Model            │ Endpoint                  │ Type     │
  ├──────────────────┼───────────────────────────┼──────────┤
  │ gemma4:26b       │ http://localhost:11434     │ ollama   │
  │ bedrock-opus     │ (via AWS Bedrock)          │ bedrock  │
  │ vertex-sonnet    │ (via GCP Vertex)           │ vertex   │
  │ openrouter-opus  │ openrouter.ai/api/v1      │ web      │
  └──────────────────┴───────────────────────────┴──────────┘
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

**Warning check:** If `<from>` is a known Claude Code shorthand (`sonnet`, `opus`, `haiku`,
`claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5-20251001`) and `<to>` is NOT `"inherit"`,
print a warning before applying:

```
⚠️  Claude Code natively resolves '<from>' — mapping it to a specific model ID
    may break subagent routing. Use 'inherit' to defer to native resolution,
    or proceed if you know your gateway requires a specific ID.
```

Still apply the mapping (the user may have a valid reason).

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

Add or update a provider. Detects provider type from the base_url or explicit `--type` flag:

**Ollama** (default for localhost URLs):
```bash
jq --arg m "<model>" --arg url "<base_url>" \
  '.providers[$m] = {"base_url": $url, "auth_token": "ollama", "api_key": "", "config_dir": "$HOME/.claude-ollama", "disable_nonessential_traffic": true}' \
  "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

**Bedrock** (`/model-map provider <name> --bedrock --region us-west-2`):
```bash
jq --arg m "<name>" --arg region "<region>" \
  '.providers[$m] = {"env": {"CLAUDE_CODE_USE_BEDROCK": "1", "AWS_REGION": $region}}' \
  "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```
Optionally add `AWS_PROFILE` to the `env` block. AWS credentials must be configured separately
(via `aws configure`, env vars, or IAM role). The model name passed to `claude-router --model`
should be a Bedrock model ID like `anthropic.claude-sonnet-4-6-20250514-v1:0`.

**Vertex** (`/model-map provider <name> --vertex --region us-east5 --project my-project`):
```bash
jq --arg m "<name>" --arg region "<region>" --arg project "<project>" \
  '.providers[$m] = {"env": {"CLAUDE_CODE_USE_VERTEX": "1", "CLOUD_ML_REGION": $region, "ANTHROPIC_VERTEX_PROJECT_ID": $project}}' \
  "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```
GCP auth must be configured separately (`gcloud auth application-default login`).

**Web API** (`/model-map provider <name> <base_url> --api-key <key>`):
```bash
jq --arg m "<name>" --arg url "<base_url>" --arg key "<api_key>" \
  '.providers[$m] = {"base_url": $url, "api_key": $key}' \
  "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```
Works with OpenRouter (`https://openrouter.ai/api/v1`), LiteLLM, or any Anthropic-compatible endpoint.

**Generic env** (`/model-map provider <name> --env KEY=VALUE ...`):
For any provider not covered above, set arbitrary env vars:
```bash
jq --arg m "<name>" '.providers[$m] = {"env": {<key-value pairs>}}' \
  "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

Print: `Added provider: <model>`
Print: `Launch with: claude-router --model <model>`
Then show the updated config.

### provider <model> --remove

```bash
jq --arg m "<model>" 'del(.providers[$m])' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

Print: `Removed provider: <model>`
Then show the updated config.

### route <name> <model>

Add or update a named route. Route name maps to a model string used by `claude-router --route`.

```bash
# Validate: model arg must be a non-empty string
[ -z "<model>" ] && { echo "model name required" >&2; exit 1; }
jq --arg k "<name>" --arg v "<model>" '.routes[$k] = $v' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
chmod 600 "$CONFIG"
```

Print: `Added route: <name> → <model>`
Print: `Use with: claude-router --route <name>`
Then show the updated config.

### route <name> --remove

```bash
jq --arg k "<name>" 'del(.routes[$k])' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
chmod 600 "$CONFIG"
```

Print: `Removed route: <name>`
Then show the updated config.

### clear

Write config with empty rules but preserve providers and routes:
```bash
jq '.session_rules = {} | .model_mappings = {} | .providers = (.providers // {}) | .routes = (.routes // {})' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

Print: `Model routing rules cleared (providers and routes preserved).`
