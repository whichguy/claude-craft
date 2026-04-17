# Plan: Add qwen3.6:35b-a3b-q4_K_M + 64k Ollama context default

## Goal
1. Register `qwen3.6:35b-a3b-q4_K_M` as a local Ollama model in model-map.json
2. Set 64k (`num_ctx: 65536`) as the default context window for all Ollama models routed through claude-proxy

## Architecture context

Two Ollama routing paths exist — each reads different config blocks from `~/.claude/model-map.json`:

| Path | Tool | Config block | Ollama endpoint |
|---|---|---|---|
| Subprocess | `tools/claude-router` | `providers` | `/v1/messages` (Anthropic API native) |
| HTTP proxy | `tools/claude-proxy` | `backends` + `model_routes` | `/api/chat` (Ollama native) |

**64k context** only works cleanly through the **proxy path** — Ollama's `/v1/messages` (Anthropic schema) has no `num_ctx` field; Ollama's `/api/chat` does via `options.num_ctx`.

## Tasks

### [ ] 1. config/model-map.json (repo)
Add the model to `model_routes` and add a new `ollama_defaults` block:

```json
"model_routes": {
  "claude-sonnet-4-6": "anthropic",
  "claude-opus-4-6": "anthropic",
  "qwen3-coder:30b": "ollama_local",
  "gemma4:26b": "ollama_local",
  "qwen3-coder:480b-cloud": "ollama_cloud",
  "deepseek/deepseek-v3": "openrouter",
  "qwen3.6:35b-a3b-q4_K_M": "ollama_local"   // ADD
},
"ollama_defaults": {                                 // ADD new block
  "num_ctx": 65536
}
```

### [ ] 2. tools/claude-proxy (repo)
In `forwardOllama()`, after `ollamaBody.options = {}` (line ~124), inject `num_ctx` from `CONFIG.ollama_defaults`:

```js
// After: if (body.max_tokens) ollamaBody.options.num_predict = body.max_tokens;
const ollamaDefaults = CONFIG.ollama_defaults || {};
if (ollamaDefaults.num_ctx) ollamaBody.options.num_ctx = ollamaDefaults.num_ctx;
```

### [ ] 3. ~/.claude/model-map.json (runtime, not committed)
Add to `providers` block (for claude-router subprocess path):

```json
"qwen3.6:35b-a3b-q4_K_M": {
  "base_url": "$OLLAMA_URL",
  "auth_token": "ollama",
  "api_key": "",
  "config_dir": "$HOME/.claude-ollama",
  "disable_nonessential_traffic": true
}
```

No `session_rule` — available on explicit request only (consistent with `qwen3-coder:30b` precedent).

### [ ] 4. wiki/entities/claude-router-local-models.md
- Add `qwen3.6:35b-a3b-q4_K_M` to the registered providers table
- Document the `ollama_defaults.num_ctx` mechanism and its proxy-only scope

## Scope boundary

- `ollama_defaults.num_ctx` applies to the **proxy path only** (`tools/claude-proxy` → `/api/chat`).
- For the claude-router subprocess path, context window is model-default (controlled server-side via `OLLAMA_NUM_CTX` in the `ollama serve` environment — outside claude-craft's control).
- `~/.claude/model-map.json` currently lacks `backends`/`model_routes` blocks for claude-proxy. Adding those is a separate sync concern; this plan only adds to `providers`.
