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

- **From Session 05018c0a:** Entity created when Task #6 registered `qwen3-coder:30b` as a second Ollama provider alongside the existing `gemma4:26b`. Key design decision: `qwen3-coder:30b` goes in the `providers` block only (no `session_rule` — available on explicit request, not auto-forced onto subagents). The distinction between `providers` (read exclusively by `claude-router`) and `model_mappings`/`session_rules` (Claude Code internal routing) was confirmed: these are orthogonal systems. Smoke test confirmed the Anthropic→Ollama API bridge works end-to-end on this machine. User asked "does model-map.json have the ability to use the ollama model URL behind the scenes?" — confirmed yes, via claude-router's tier-1 provider resolution.

## Components

- **`tools/claude-router`** — bash script implementing a 3-tier priority chain:
  1. Explicit provider config from `~/.claude/model-map.json` (any provider: Ollama, Bedrock, Vertex, custom)
  2. Auto-detected local Ollama model via `curl $OLLAMA_URL/api/tags` — applies Ollama defaults even without a model-map.json entry
  3. Anthropic passthrough — no env vars set; claude uses its own defaults
  **`--route <name>` flag** (added 2026-04-11): resolves a named route to a model before the 3-tier lookup. Route names (`default`, `background`, `think`, `longContext`) defined in `model-map.json .routes` block.

- **`skills/model-map/SKILL.md`** — Claude Code skill that manages `~/.claude/model-map.json`. Invoked as `/model-map` in session. `provider <model> <base_url>` subcommand auto-applies Ollama defaults for localhost URLs. **`route <name> <model>` subcommand** (added 2026-04-11): add/remove named routes. `clear` preserves both providers and routes.

- **`~/.claude/model-map.json`** — provider config (outside repo, not version-controlled). Separate from `session_rules` / `model_mappings` which route subagent models. The `providers` block and new `routes` block are both read exclusively by `claude-router`. Routes are additive at the schema level (no-routes config still works for non-route callers); `--route` callers require the named route to exist (fail-fast exit 1 on missing route).

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

## How to Add a Route

```bash
# Via /model-map skill in session:
# /model-map route background qwen3-coder:30b

# Or directly via jq:
CONFIG="$HOME/.claude/model-map.json"
jq --arg k "background" --arg v "qwen3-coder:30b" '.routes[$k] = $v' \
  "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG" && chmod 600 "$CONFIG"
```

**Rollback (remove routes block entirely):**
```bash
jq 'del(.routes)' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG" && chmod 600 "$CONFIG"
```

**Cross-machine bootstrap:** after pulling main to a new machine, run the Execution step 1 jq one-liner (or `/model-map route ...` for each route) — the `routes` block is not in the repo, so other machines won't have it. The wiki-worker's feature-detect guard will log actionable errors to `.extract-failures.log` if the block is missing.

## Current Wiki-Hooks Usage

`plugins/wiki-hooks/handlers/wiki-worker.sh` now uses `--route "$WIKI_WORKER_ROUTE"` (default: `background` → `qwen3-coder:30b`) for wiki extraction, with a feature-detect guard that falls back to `--model claude-sonnet-4-6` if the installed `claude-router` doesn't support `--route`. Emergency rollback without code changes: `export WIKI_WORKER_ROUTE=default` in shell.

## Ollama Native Anthropic Protocol

As of Ollama v0.14.0 (confirmed on v0.20.5 via direct `curl`), Ollama **natively serves `/v1/messages` with the full Anthropic Messages schema**. No shim, no middleware, no proxy is required. The `ANTHROPIC_BASE_URL=http://localhost:11434` env var routes claude-router directly to Ollama's built-in endpoint. Response format matches exactly: `msg_*` ID, `content[].text`, `stop_reason`, `usage`.

**What works natively:** streaming, system prompts, multi-turn, vision (base64), tool calling + tool results, extended thinking (`budget_tokens` accepted but not enforced).

**What's not implemented (Ollama gaps):**

| Missing feature | Claude Code impact |
|---|---|
| `/v1/messages/count_tokens` | Context meter shows approximate counts or errors |
| `tool_choice` parameter | Can't force a specific tool; model picks freely |
| Prompt caching (`cache_control`) | No-op — Ollama ignores the field |
| Claude model name enumeration | Ollama returns its own model names, not `claude-*` |

**Note (contradiction fix):** An earlier version of this entity said "Ollama speaks its own protocol and relies on a shim that bridges the API formats." That claim was incorrect — Ollama's native API support was confirmed in session 05018c0a via direct `curl` against `localhost:11434/v1/messages`.

- **From Session 05018c0a (Ollama native protocol confirmation):** Direct `curl` against `http://localhost:11434/v1/messages` with Anthropic schema returned a valid response: `msg_*` ID, `content[].text`, `stop_reason`, `usage`. No wrapper invoked. The "bridge" is Ollama itself. Research also compared with MITM proxy approach — native Ollama support is simpler (no ops overhead, no extra latency, no single point of failure) but the proxy approach offers finer-grained protocol shaping and feature injection at cost of complexity. For the current use case (wiki extraction, code tasks), native Ollama suffices.

→ See also: [[wiki-lifecycle-hooks]], [[wiki-common-sh]], [[claude-code-hook-events]], [[claude-craft-routing-architecture]]
