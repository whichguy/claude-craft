# c-thru — claude-craft plugin

Surfaces the [c-thru](https://github.com/whichguy/c-thru) router/proxy as a
claude-craft plugin. c-thru lets Claude Code talk to alternative model
providers (Ollama, OpenRouter, Bedrock, Vertex, Gemini, LiteLLM) without
changing the vendor CLI.

## What this plugin gives you

| Surface | What it adds |
|---|---|
| `/c-thru-status` | Show active profile, agent → model assignments, proxy URL, Ollama state, per-model usage stats |
| `/cplan <intent>` | Wave-based agentic planner (shortcut for `/c-thru-plan`) |
| Skills | `c-thru-plan` (planner/coder/tester/reviewer pipeline), `c-thru-config`, `c-thru-control` |
| Hooks | SessionStart proxy+Ollama health check, UserPromptSubmit proxy-health gate + classify_intent context injection, PostToolUse model-map.json validation, PostCompact context re-injection |

## Prerequisite — install c-thru itself

This plugin only wires Claude Code surfaces (commands, skills, hooks). The
proxy binary, model-map config, and `~/.claude/tools/c-thru` symlinks come
from the c-thru repo's own installer:

```sh
# One-line install (clones to ~/src/c-thru, symlinks tools to ~/.claude/tools)
curl -fsSL https://raw.githubusercontent.com/whichguy/c-thru/main/install.sh | bash
```

Or clone manually and run `./install.sh` from inside the repo.

## How the symlinks work

This plugin's `skills/` and `hooks/` directories contain **relative
symlinks** that resolve to `../../../../c-thru/...`, i.e. they assume
claude-craft and c-thru are sibling repos under the same parent
(e.g. `~/src/claude-craft` and `~/src/c-thru`). That's the default
layout from c-thru's `install.sh`. Edits made in the c-thru repo are
picked up immediately — no copy step.

If c-thru lives elsewhere, recreate the symlinks:

```sh
cd ~/src/claude-craft/plugins/c-thru/skills
for d in c-thru-plan c-thru-config c-thru-control; do
  ln -sfn /your/path/to/c-thru/skills/$d $d
done
cd ../hooks
for h in c-thru-session-start.sh c-thru-proxy-health.sh \
         c-thru-map-changed.sh c-thru-classify.sh \
         c-thru-postcompact-context.sh; do
  ln -sfn /your/path/to/c-thru/tools/$h $h
done
```

## When to use which surface

- **`/c-thru-status`** — debugging routing decisions, checking which model
  an agent will hit, seeing per-model usage.
- **`/cplan <intent>`** — large multi-step features where you want
  planner → coder → tester → reviewer parallelism.
- **Hooks** — fire automatically; no user action needed. SessionStart
  prints a one-line summary if anything's wrong with the proxy or Ollama.

## Configuration

Configuration lives in `~/.claude/model-map.overrides.json` (created empty
on first install of c-thru, never overwritten on upgrade). Edit there to
override defaults. See the c-thru `CLAUDE.md` for schema details.

## Reporting issues

Plugin scaffolding issues → file at the claude-craft repo. Proxy / model
routing / agent definitions → file at the c-thru repo.
