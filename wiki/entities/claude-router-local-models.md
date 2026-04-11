---
name: claude-router local model routing
type: entity
description: "Routing infrastructure that connects Claude Code to alternative model providers (Ollama, Bedrock, Vertex, OpenRouter). Key components: tools/claude-router (3-tier priority chain), skills/model-map/ (CLI), ~/.claude/model-map.json (config), wiki-common.sh::wiki_resolve_claude_cmd (hook integration). Distinct from model_mappings which remap model names."
tags: [claude-router, ollama, local-llm, model-map, wiki-hooks, gemma4, qwen3-coder]
confidence: medium
last_verified: 2026-04-11
created: 2026-04-11
last_updated: 2026-04-11
sources: []
related: [wiki-lifecycle-hooks, wiki-common-sh]
---

# Claude-Router Local Model Routing

Routing layer between Claude Code and alternative model providers. `tools/claude-router` intercepts `claude` invocations, resolves the correct provider for the requested model, sets env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, etc.), then `exec claude "$@"` with all original args unchanged.

## Components

- **`tools/claude-router`** (L1-125) — bash script implementing a 3-tier priority chain:
  1. Explicit provider config from `~/.claude/model-map.json` (any provider: Ollama, Bedrock, Vertex, custom)
  2. Auto-detected local Ollama model via `curl $OLLAMA_URL/api/tags` (L113) — applies Ollama defaults even without a model-map.json entry
  3. Anthropic passthrough — no env vars set; claude uses its own defaults

- **`skills/model-map/SKILL.md`** — Claude Code skill that manages `~/.claude/model-map.json`. Invoked as `/model-map` in session. `provider <model> <base_url>` subcommand auto-applies Ollama defaults for localhost URLs.

- **`~/.claude/model-map.json`** — provider config (outside repo, not version-controlled). Separate from `session_rules` / `model_mappings` which route subagent models. The `providers` block is read exclusively by `claude-router`.

- **`plugins/wiki-hooks/handlers/wiki-common.sh::wiki_resolve_claude_cmd`** (L177-190) — resolves the `claude` command through `claude-router` when available. Hook handlers (e.g., `wiki-worker.sh`) call this to get the correct `claude` binary, enabling future local-model extraction.

## Registered Providers (as of 2026-04-11)

Both routed to `http://localhost:11434` with Ollama defaults (`auth_token: "ollama"`, `api_key: ""`, `config_dir: "$HOME/.claude-ollama"`, `disable_nonessential_traffic: true`):

| Model | Endpoint | Notes |
|---|---|---|
| `gemma4:26b` | http://localhost:11434 | Verified working end-to-end. Has session_rule entry forcing child-model use. |
| `qwen3-coder:30b` | http://localhost:11434 | 18GB, qwen3moe family, Q4_K_M, 30.5B params. Providers-only (no session_rule — available on request, not forced). |

Invoke with: `claude-router --model qwen3-coder:30b -p 'prompt'`

## How to Add a New Provider

```bash
# For Ollama (auto-applies localhost defaults):
# Invoke /model-map skill in session:
# /model-map provider <model-name> http://localhost:11434

# Or directly via jq (matches SKILL.md:180-183):
CONFIG="$HOME/.claude/model-map.json"
jq --arg m "model-name" --arg url "http://localhost:11434" \
  '.providers[$m] = {"base_url": $url, "auth_token": "ollama", "api_key": "", "config_dir": "$HOME/.claude-ollama", "disable_nonessential_traffic": true}' \
  "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG" && chmod 600 "$CONFIG"
```

For Bedrock, Vertex, or OpenRouter — see `skills/model-map/SKILL.md` for provider-specific jq patterns.

## Current Wiki-Hooks Usage

`plugins/wiki-hooks/handlers/wiki-worker.sh:165` hardcodes `--model claude-sonnet-4-6` for wiki extraction. `wiki_resolve_claude_cmd` resolves to claude-router when present, but the model flag still pins Sonnet. Swapping the extraction model to a local Ollama model requires validating extraction quality and is deferred to a future task.

## Bridge Caveat

Claude Code sends Anthropic API requests; Ollama speaks its own protocol. The translation layer (`ANTHROPIC_BASE_URL=http://localhost:11434`) relies on a shim that bridges the API formats. Bridge confirmed working end-to-end on this machine as of 2026-04-11 (smoke-tested both gemma4:26b and qwen3-coder:30b). Internal mechanism not traced in claude-router source — see a future router-internals entity if needed.

→ See also: [[wiki-lifecycle-hooks]], [[wiki-common-sh]]
