# local-classifier fate decision (Task #11)

## Recommendation: **DELETE**

The plugin ships a handler script but never wires it. Installing it does nothing.

## Evidence

| Check | Result |
|---|---|
| `plugins/local-classifier/hooks/hooks.json` | **does not exist** — no plugin-level hook registration |
| `~/.claude/settings.json` `.hooks.UserPromptSubmit[]` references local-classifier | not present |
| Any other plugin's `hooks.json` references it | none |
| Plugin state dir `~/.claude/plugins/data/local-classifier/` | does not exist (never written to) |
| Legacy state dir `~/.claude/local-classifier/` | does not exist |
| Recent commits modifying the plugin | only `5373b73` (marketplace migration) and `091a5ba` (Stop-hook-feedback retry guard) — no functional development |
| Ollama present on this machine | yes (`/usr/local/bin/ollama`, 3 processes running) — but the classifier itself isn't being invoked |

The handler script (`handlers/local-classifier.sh`) has substantive logic — scoring prompts as local/external/stateful and injecting `additionalContext` — but with no `hooks.json` to register it as a `UserPromptSubmit` hook, the script is unreachable.

## Cleanup scope

If we delete:

1. `plugins/local-classifier/` — directory removal
2. `.claude-plugin/marketplace.json` — drop the `local-classifier` entry (and decrement the "12 plugins" claim in `CLAUDE.md` / `README.md` to 11)
3. `package.json` — remove `test:local-classifier` and `test:local-classifier-suite` scripts
4. `tools/test-local-classifier.sh` — if it exists, delete (referenced by `test:local-classifier`)
5. `test/marketplace/hook-retry-guard.test.js` — strip the `describe('local-classifier.sh', ...)` block; keep the wiki-notify portion
6. Any `test/plugins/local-classifier/` directory — delete

## Counter-argument (if keeping)

The script is well-written and could be useful — it would prevent unnecessary external-tool calls for prompts that can be answered by reading local files. If we keep it, the action is the *opposite* of "document as opt-in":

1. Add `plugins/local-classifier/hooks/hooks.json` registering `UserPromptSubmit` matcher with the handler at `${CLAUDE_PLUGIN_ROOT}/handlers/local-classifier.sh`
2. Verify Ollama default-model expectations (`OLLAMA_MODEL` env var? hardcoded?)
3. Live-test on this machine (Ollama is already running)

But: scoring is heuristic regex-based, not actually using Ollama in the parts I read. The "Ollama-powered" framing in the description may be aspirational rather than implemented. Worth reading the rest of the handler before committing to wiring.

## Decision needed

- **Delete**: cleanest. Removes ~150 lines of dead code, unblocks the "what does this plugin do" cognitive overhead.
- **Wire up**: requires a hooks.json + verifying the heuristic actually saves cycles in your workflow. Probably not worth it given the regex-only scoring is brittle.
- **Mothball**: leave as-is. Cheapest now, but the marketplace stays misleading (lists a plugin that does nothing on install).

Recommended: **delete**. If you ever want a prompt classifier later, the script lives in git history.
