# CLAUDE.md — Claude Craft

## Directives

```
LAYOUT:      everything ships under plugins/<bundle>/ — top-level skills/agents/commands/references are GONE
MARKETPLACE: .claude-plugin/marketplace.json lists 12 plugins; each has plugins/<bundle>/.claude-plugin/plugin.json
             (c-thru is sourced via git-subdir from whichguy/c-thru — no plugins/c-thru/ in this repo)
HOOKS:       plugins/<bundle>/hooks/hooks.json with ${CLAUDE_PLUGIN_ROOT}/hooks/handlers/<x>.sh paths
PATHS:       use ${CLAUDE_PLUGIN_ROOT} (plugin root), ${CLAUDE_SKILL_DIR} (per-skill), ${CLAUDE_PLUGIN_DATA} (persistent state)
NO-XPLUGIN:  plugins cannot reference files in sibling plugins (spec restriction)
             — duplicate via tools/sync-bundled-tools.sh; namespace cross-plugin refs as /<plugin>:<skill>
LINTERS:     tools/lint-marketplace.sh (manifest+frontmatter+drift) and tools/lint-namespacing.sh
             (bare cross-bundle refs) — both gated in .githooks/pre-commit
GIT:         always git -C "<dir>", never cd + git
SHELL:       set -o pipefail, shopt -s nullglob, trap cleanup; avoid -e (grep no-match returns 1)
TEST:        npm test (mocha/chai, fixture-based, no mocks). Tests live in test/, NOT shipped.
SECURITY:    pre-commit → simple-secrets-scan.sh (fast) | full → security-scan.sh
RESPONSE:    direct answer first, no preamble, no restating the question, no postamble.
             tables only when ≥3 items with ≥2 attributes; bullets only when order-independent.
             code-block paths/commands; prose for everything else.
```

---

## Plugins (12)

| Bundle | Scope |
|---|---|
| gas-suite        | Apps Script review, debug, plan, sidebar, Gmail Cards (deps: review-suite) |
| wiki-suite       | Project LLM wiki + proactive research (absorbs old wiki-hooks/craft-hooks) |
| review-suite     | Plan review, code-reviewer, review-fix, security/red-team, memory-* (deps: wiki-suite) |
| review-bench     | Prompt/question A/B benchmarking, ablation (deps: review-suite) |
| planning-suite   | Architect, refactor, test, schedule-plan-tasks, node-plan, alias/unalias, performance, knowledge |
| async-suite      | bg/todo/todo-cleanup + task-persist + feedback-collector (merged hooks) |
| slides-suite     | reveal.js + Google Slides decks |
| comms            | Slack tagging |
| form990          | IRS Form 990 (deps: review-bench) |
| plan-red-team    | Iterative red-team plan review |
| local-classifier | Local Ollama prompt classifier hook |
| c-thru           | Router/proxy for Ollama/OpenRouter/Bedrock/Vertex/Gemini/LiteLLM (source: git-subdir from whichguy/c-thru) |

Cross-plugin dep DAG: `gas-suite → review-suite`, `review-suite → wiki-suite`, `review-bench → review-suite`, `form990 → review-bench`. Declared in each plugin's `plugin.json#dependencies`.

---

## Development

### Adding a skill / agent / command
Write file under `plugins/<bundle>/{skills/<name>/SKILL.md, agents/<name>.md, commands/<name>.md}`. Required frontmatter: `name`, `description`. For agents, also forbidden: `hooks`, `mcpServers`, `permissionMode`. Run `./tools/lint-marketplace.sh` to verify.

### Cross-bundle reference
- In SKILL.md prose / `Skill_call`: `/<plugin>:<skill>` (never bare for cross-plugin).
- Inside `skills/shared/` copies: each copy uses bare for its host bundle's skills, namespaced for everything else. Drift caught by `tools/lint-namespacing.sh`.

### Tools that ship with a plugin
Source-of-truth lives in `tools/<x>.sh`. Add to `bundled_map` in `tools/sync-bundled-tools.sh`. Plugin consumers reference via `${CLAUDE_PLUGIN_ROOT}/tools/<x>.sh`. Pre-commit's `--check` mode catches drift.

### Hooks
Ship in `plugins/<bundle>/hooks/hooks.json`. Handlers live under `plugins/<bundle>/hooks/handlers/<x>.sh` (or `plugins/<bundle>/handlers/` for absorbed-from-old-plugin handlers). All commands use `${CLAUDE_PLUGIN_ROOT}/...`. State files go in `${CLAUDE_PLUGIN_DATA}` if local, `~/.claude/...` if cross-plugin.

### Tests
`npm test` runs mocha against `test/**/*.test.js`. Tests live in a structured tree:
- `test/plugins/<bundle>/` — per-bundle tests (use `npm run test:<bundle>` for focused runs)
- `test/marketplace/` — cross-plugin invariants (schema, hooks, frontmatter, cross-refs, security)
- `test/plugins/_repo/` — repo-only tools (claude-router, slated for replacement)

Tests are NOT shipped in plugins. Path style: `path.join(REPO_ROOT, 'plugins', '<bundle>', 'skills', '<name>', 'SKILL.md')`.

### Dev-only top-level dirs
`lib/` is referenced by `tools/dry-run-plan.js` and is dev-only (not shipped in plugins).

---

## Install (end-user)

```
/plugin marketplace add whichguy/claude-craft
/plugin install <bundle>@claude-craft
```

Users on the prior symlink-based install must first run `tools/migrate-from-symlinks.sh` (one-shot, idempotent: strips legacy hook entries from `~/.claude/settings.json`, removes claude-craft symlinks, prints next steps).

---

## Repo-only tools

- `tools/lint-marketplace.sh` — manifest schema + extension frontmatter + dep resolution + handler paths + bundled-tool drift
- `tools/lint-namespacing.sh` — flag bare cross-bundle slash refs
- `tools/sync-bundled-tools.sh [--check]` — keep bundled tool copies in sync
- `tools/migrate-from-symlinks.sh` — user upgrade script
- `tools/e2e-marketplace-smoke.sh` — 7-check static validation, no Claude Code session needed
- `tools/regen-phase-index.sh` — regen review-plan phase index marker (pre-commit gated)
