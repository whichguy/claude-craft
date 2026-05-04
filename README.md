# Claude Craft 🚀

**Family-bundled Claude Code extensions, distributed as a plugin marketplace.**

Eleven plugins covering Apps Script tooling, project wiki, plan/code review,
prompt research bench, planning, async workflow, slides, and several
domain-specific bundles. Install only what you need.

## Install

```
/plugin marketplace add whichguy/claude-craft
/plugin install gas-suite@claude-craft         # pick the bundles you want
/plugin install review-suite@claude-craft
/plugin install wiki-suite@claude-craft
# … etc.
```

Verify with `/plugin list`.

> **Cache refresh note:** if you added the marketplace before a plugin existed in
> `marketplace.json` and `/plugin install <name>@claude-craft` reports
> "Plugin not found in marketplace", run `/plugin marketplace update claude-craft`
> to refresh the local index, then retry the install.

### Plugins

| Bundle | What it provides |
|---|---|
| `gas-suite`        | Apps Script review, debugging, planning, sidebar testing, Gmail Cards |
| `wiki-suite`       | Project LLM wiki: ingest, query, process queue, lint, proactive research |
| `review-suite`     | Plan review, code review (Adversarial Auditor), iterative review-fix loop |
| `review-bench`     | Prompt/question A/B benchmarking and ablation tooling (depends on review-suite) |
| `planning-suite`   | Architect, refactor, test, schedule-plan-tasks, node-plan, alias/unalias, performance, knowledge |
| `async-suite`      | Background task workflow: `/bg`, `/todo`, task-persist, feedback-collector |
| `slides-suite`     | reveal.js or Google Slides decks |
| `comms`            | Slack tagging |
| `form990`          | IRS Form 990 preparation orchestrator |
| `plan-red-team`    | Iterative red-team plan review with Opus orchestration |
| `local-classifier` | Local Ollama-powered prompt classifier UserPromptSubmit hook |

Cross-bundle dependency edges (declared in each `plugin.json`):
`gas-suite → review-suite`, `review-suite → wiki-suite`,
`review-bench → review-suite`, `form990 → review-bench`.

## Upgrading from < 1.0 (symlink-based install)

If you previously ran `./install.sh`, run the one-shot cleanup once before
adding the marketplace — it removes hook entries injected into
`~/.claude/settings.json` and unlinks dangling symlinks pointing into the
repo:

```
git -C path/to/claude-craft pull
path/to/claude-craft/tools/migrate-from-symlinks.sh
```

Then proceed with the `/plugin marketplace add` step above.

## Wiki System

Claude Craft includes a self-building wiki system that captures knowledge from your sessions and makes it available across conversations.

### Wiki Skills

| Skill | Description |
|-------|-------------|
| `/wiki-init` | Initialize a project wiki with directory structure and SCHEMA.md |
| `/wiki-ingest <source>` | Add a file or URL to the wiki (runs async in background) |
| `/wiki-query <question>` | Synthesize an answer from wiki pages with citations |
| `/wiki-load <topic>` | Load raw wiki pages into context (no synthesis overhead) |
| `/wiki-process` | Process pending queue entries — the self-building engine |
| `/wiki-lint` | Health check: find orphans, broken links, contradictions, stale pages |

### Prompt Improvement Skills

A consolidated set of skills for iterating on prompts, system prompts, and evaluator questions.

| Skill | Description |
|-------|-------------|
| `/improve-prompt` | Research-backed iterative prompt improvement loop with experiment variants, scope-preservation gate, and questions-based judging. Subsumes `/prompt-critique` (via `--mode critique`) and `/prompt-probes` (via `--with-probes`). |
| `/compare-prompts` | A/B test two prompts with execution-based scoring. Standalone harness. |
| `/process-feedback` | Ingest the `feedback-collector` plugin's backlog and propose surgical prompt updates (propose-only — never auto-edits SKILL.md). |
| `/optimize-system-prompt` | Optimize/refine the GAS Sheets Chat system prompt (compression + refinement). Subsumes `/ideate-system-prompt` via `--mode ideate` (autonomous hypothesis generation + benchmarking). |
| `/improve-system-prompt` | Benchmark pre-coded GAS system prompt variants (V2/V2a/V2b/V2c) against scenarios. Sibling of `/optimize-system-prompt` for projects with predefined variants. |
| `/derive-questions` | Mine failures and extract evaluator questions from real runs. |
| `/optimize-questions` | Token-efficiency optimization for plan-review questions. Uses `/compare-questions` as its internal A/B engine. |
| `/compare-questions` | Pairwise A/B testing of two evaluator questions against plan fixtures. |

### Wiki Plugin (wiki-hooks)

The wiki-hooks plugin provides 13 lifecycle handlers + a shared library that run automatically:

| Handler | Hook Type | Purpose |
|---------|-----------|---------|
| `wiki-detect.sh` | SessionStart | Inject wiki context via systemMessage |
| `wiki-clear.sh` | SessionStart (clear) | Treat `/clear` as wiki session boundary |
| `wiki-cleanup.sh` | SessionStart (async) | Expire stale markers, recover stuck entries |
| `wiki-cache-rebuild.sh` | SessionStart + PostToolUse (async) | Rebuild cached display/context files |
| `wiki-worker.sh` | UserPromptSubmit (async) | Background queue processor — spawns Sonnet for extraction |
| `wiki-notify.sh` | UserPromptSubmit | Inject entity context matching user prompt keywords |
| `wiki-read-gate.sh` | PreToolUse (Read) | Inject wiki-entity hint when reading a file documented by wiki pages |
| `wiki-raw-guard.sh` | PreToolUse (Write/Edit) | Block LLM writes to `raw/` directory |
| `wiki-precompact.sh` | PreCompact | Queue extraction before context compaction |
| `wiki-stop.sh` | Stop (async) | Detect wiki changes, queue extraction, log session end |
| `wiki-session-end.sh` | SessionEnd | Safety net — queue extraction if Stop didn't fire |
| `wiki-periodic-extract.sh` | (periodic, async) | Drain extraction queue on a schedule |
| `wiki-periodic-lint.sh` | (periodic, async) | Run lint health checks on a schedule |
| `wiki-common.sh` | (shared library) | Shared functions: input parsing, wiki discovery, logging |

### Provider Routing (Bedrock, OpenRouter, Ollama)

Wiki extraction uses `claude-router` when available — install it from [whichguy/c-thru](https://github.com/whichguy/c-thru). If `claude-router` is not found, wiki-worker falls back to the bare `claude` CLI (Anthropic direct).

### Dependency Validation

All hook scripts validate required dependencies (jq, claude CLI) at startup with descriptive stderr warnings:

```
wiki-hooks: jq not found — wiki hooks disabled (install: brew install jq)
wiki-hooks: claude CLI not found — wiki extraction disabled
wiki-hooks: no API key or credentials found — claude extraction may fail
```

## Usage

### Daily Workflow
```bash
# Check sync status (default action)
/agent-sync

# Sync all repo items to ~/.claude
/agent-sync sync

# See what repo items aren't installed yet
/agent-sync add

# See local items that could be published to repo
/agent-sync publish

# Enable automatic sync (runs ~3.7% of prompts)
/agent-sync auto status
```

### Auto-Sync Features

**Intelligent Background Sync** - Automatically keeps your repository synchronized:
- **Probabilistic Triggers**: Syncs on ~1/27 user prompts (3.7% chance)
- **Debounced**: Minimum 5-second intervals to prevent spam
- **Background Operation**: Never interrupts your workflow
- **Smart Conflict Detection**: Handles stashing/merging automatically
- **Security Integration**: Pre-sync security scanning

```bash
# Enable auto-sync
/agent-sync auto enable

# Check configuration and statistics
/agent-sync auto status

# Force immediate sync
/agent-sync auto force

# Disable when not needed
/agent-sync auto disable
```

### Commands Available

| Command | Description |
|---------|-------------|
| `/agent-sync` | Show sync status for all 7 extension types (default action) |
| `/agent-sync sync` | Sync all repo items to ~/.claude (pull + symlink) |
| `/agent-sync add` | List repo items not yet installed |
| `/agent-sync publish` | List local-only items that could be published to repo |
| `/agent-sync auto enable` | Enable automatic probabilistic sync |
| `/agent-sync auto disable` | Disable automatic sync |
| `/agent-sync auto status` | Show auto-sync configuration |
| `/prompts` | List available prompt templates |
| `/prompt template-name` | Execute a prompt template with prompt-as-code |
| `/alias name command...` | Create command aliases (local or global) |
| `/unalias name` | Remove command aliases with confirmation |

### Prompt-as-Code Philosophy

The `/prompt` command leverages Claude Code's **prompt-as-code** pattern - a powerful paradigm where prompts become executable, composable units of AI-driven functionality:

**Why Prompt-as-Code?**
- **Dynamic Reasoning**: Unlike static scripts, prompts leverage AI's reasoning capabilities to adapt to context
- **Natural Language Logic**: Express complex workflows in prose rather than brittle code
- **Composable**: Chain prompts together, pass results between them, build complex orchestrations
- **Self-Documenting**: The prompt IS the documentation - readable by humans and AI alike
- **Flexible Execution**: Same prompt can behave differently based on project context

**How It Works:**
```bash
# Execute a prompt template
/prompt api-design

# The prompt template (prompts/api-design.md) contains:
# - Natural language instructions for the AI
# - Conditional logic expressed as "if this, then that"
# - Tool invocations described in prose
# - Dynamic adaptation based on file content

# Compare to traditional scripting:
# Script: Fixed logic, fails on edge cases, requires maintenance
# Prompt: Adaptive reasoning, handles unknowns, self-improving
```

**Examples:**
- `/prompt debugging` - AI analyzes context and chooses appropriate debugging strategy
- `/prompt security-scan` - Intelligently scans based on file types and patterns found
- `/prompt git-security-threat` - Adaptive threat analysis based on repository state

This approach treats prompts as **executable specifications** rather than code, enabling more flexible and intelligent automation.

### Command Examples

**Alias Management:**
```bash
# Create a local alias for frequently used commands
/alias deploy /prompt api-design && npm test && npm run deploy

# Create a global alias (available in all projects)
/alias --global whatis ls -la

# List all aliases
/alias --list

# Remove an alias with confirmation
/unalias deploy

# Force removal without confirmation
/unalias whatis --force
```

**Agent-Sync Operations:**
```bash
# Check sync status
/agent-sync

# Sync all extensions from repo
/agent-sync sync

# See what's available to add
/agent-sync add

# See local items that could be published
/agent-sync publish
```

**Prompt Templates:**
```bash
# Execute a prompt template
/prompt api-design

# Use prompts for dynamic workflows
/prompt debugging          # AI chooses debugging strategy
/prompt security-scan       # Intelligent security analysis
/prompt git-security-threat # Adaptive threat detection
```

**Combining Commands:**
```bash
# Create an alias for a complex workflow
/alias test-and-deploy /prompt qa-analyst && /agent-sync push "Tests passed" && /prompt api-design

# Chain operations with aliases
/alias morning-sync /agent-sync status && /agent-sync sync && /alias --list
```

### Local vs Global Modes

Claude Craft intelligently detects whether to operate in local or global mode:

**🔍 Auto-Detection**
The sync system manages symlinks between `~/claude-craft` repository and `~/.claude/` for all 7 extension types: agents, commands, skills, prompts, references, plugins, and hooks.

### Publishing Extensions

The `/agent-sync publish` command lists local-only items in `~/.claude/` that could be copied to the repository and committed:

```bash
# See local items not in the repo
/agent-sync publish

# Then manually copy and commit interesting items to ~/claude-craft/
```

### Git Security Commands (installed automatically)

| Command | Description |
|---------|-------------|
| `git pull` | Automatically scans pulled files for threats |
| `git commit` | Automatically blocks commits with secrets |
| `~/claude-craft/tools/install-git-hooks.sh` | Install/reinstall git hooks |

## Folder Structure

```
claude-craft/
├── .githooks/             # Local git hooks (installed automatically)
│   ├── post-merge         # Security scan after git pull
│   └── pre-commit         # Secret detection before commit
├── agents/                # Agent definitions (.md) → ~/.claude/agents/
├── commands/              # Slash commands (.md) → ~/.claude/commands/
├── skills/                # Skill directories → ~/.claude/skills/
├── prompts/               # Prompt templates (.md) → ~/.claude/prompts/
├── references/            # Reference docs (.md) → ~/.claude/references/
├── plugins/               # Plugin directories → ~/.claude/plugins/
│   ├── async-workflow/    # Background agents for use-case expansion, research, planning, review
│   ├── craft-hooks/       # Probabilistic auto-sync on user prompts + utility hooks
│   ├── feedback-collector/ # SessionEnd hook → harvests SKILL_IMPROVEMENT markers to backlog
│   ├── local-classifier/  # Local model classification helpers
│   ├── plan-red-team/     # Adversarial expert-persona critique of implementation plans
│   ├── task-persist/      # Cross-session task state persistence
│   └── wiki-hooks/        # Wiki lifecycle hooks (14 handlers + shared library)
│   # Note: model-router moved to https://github.com/whichguy/c-thru
├── hooks/                 # Hook system
│   └── scripts/           # Hook scripts (.sh) → ~/.claude/hooks/
├── test/                  # Testing framework (Mocha/Chai) — `npm test` runs all *.test.js
│   ├── sync.test.js       # Sync infrastructure tests
│   ├── wiki-hooks.test.js # Wiki hooks behavior tests
│   ├── review-plan.test.js # Plan-review skill structural contract tests
│   ├── merge-hooks.test.js # Plugin hook merge/coexistence tests
│   ├── security.test.js   # Security scanner tests
│   └── ...                # 17 test files total — see test/ for full list
│   # CLI runners (not picked up by `npm test`):
│   #   test/bench-adversarial.js — review-plan adversarial fixture benchmark
├── tools/                 # Management utilities
│   ├── sync-status.sh     # Core sync engine (status/sync/add/publish)
│   ├── auto-sync.sh       # Probabilistic background sync
│   ├── install-git-hooks.sh
│   ├── security-scan.sh
│   └── backup.sh
├── install.sh             # One-command installer
└── uninstall.sh           # Safe uninstaller with --dry-run
```

## How It Works

### Setup Lifecycle

1. **Installation** (`./install.sh` or curl one-liner):
   - Clones repository to `~/claude-craft` (or updates existing)
   - Creates symlinks for all 7 extension types via `sync-status.sh`
   - Copies core global commands (alias, unalias, agent-sync)
   - Installs local git hooks for security

2. **Daily Sync** (`/agent-sync sync`):
   - `git pull --ff-only` for latest changes
   - Re-syncs all symlinks (handles new/removed files)
   - Preserves local-only files (never overwrites non-repo content)
   - Cleans up broken symlinks automatically

3. **Auto-Sync** (when enabled):
   - Probabilistic sync (~3.7% chance per user prompt)
   - Background operation with debouncing
   - Intelligent conflict handling (stash/merge/restore)

4. **Built-in Git Security** (automatic after setup):
   - **Post-merge hook**: Scans pulled files for security threats
   - **Pre-commit hook**: Blocks commits with hardcoded secrets
   - Security events logged to `~/.git-security.log`

### Sync Architecture

All sync operations use `tools/sync-status.sh` — a single data-driven script that handles all 7 extension types:

| Type | Sync Method | Skip Patterns |
|------|-------------|---------------|
| Agents | Per-file symlink (`.md`) | — |
| Commands | Per-file symlink (`.md`) | alias.md, unalias.md, agent-sync.md |
| Skills | Per-directory symlink | Hidden directories |
| Prompts | Per-file symlink (`.md`) | `old-do-not-use-*`, `test-*` |
| References | Per-file symlink (`.md`) | — |
| Plugins | Per-directory symlink | Hidden directories |
| Hooks | Per-file symlink (`.sh`) | — |

## Troubleshooting

### Cursor Terminal Keybinding Conflict

If you see a warning about "Found existing Cursor terminal Shift+Enter key binding" when running `/terminal-setup`:

**DO NOT remove the keybinding** - this is your existing Cursor configuration that you want to keep.

The warning comes from Claude Code's built-in `/terminal-setup` command that detects potential conflicts. The Shift+Enter keybinding in Cursor is commonly used for line continuation in terminals and should be preserved.

**Solution**: Simply ignore the warning. Claude Craft works fine with existing Cursor keybindings and doesn't require their removal.

## Manual Installation

If you prefer not to use the curl script:

```bash
git clone https://github.com/whichguy/claude-craft.git ~/claude-craft
cd ~/claude-craft
chmod +x install.sh
./install.sh
```

## Uninstallation

Claude Craft includes a comprehensive uninstaller that safely removes all components:

```bash
# Preview what will be removed (recommended first step)
~/claude-craft/uninstall.sh --dry-run

# Interactive uninstall with confirmations
~/claude-craft/uninstall.sh

# Silent uninstall without prompts
~/claude-craft/uninstall.sh --yes

# Full removal including git hooks and backups
~/claude-craft/uninstall.sh --yes --remove-hooks --clean-backups

# Restore from backup before uninstalling
~/claude-craft/uninstall.sh --restore-backup --yes
```

### Uninstall Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview what would be removed without making changes |
| `--yes, -y` | Skip confirmation prompts for automated removal |
| `--keep-repo` | Don't remove ~/claude-craft repository |
| `--keep-commands` | Don't remove global commands (/alias, /unalias, /agent-sync) |
| `--remove-hooks` | Also remove git security hooks |
| `--restore-backup` | Restore from latest backup before uninstalling |
| `--clean-backups` | Remove claude-craft backup files |

**What gets removed:**
- ~/claude-craft repository directory
- Global commands (/alias, /unalias, /agent-sync)
- All claude-craft symlinks from ~/.claude/
- Optionally: git security hooks and backup files

**What stays untouched:**
- Your original ~/.claude/settings.json
- Your original ~/.claude/CLAUDE.md  
- Manually created commands or configurations

## Security Features

### Automatic Git Hook Protection

Claude Craft automatically installs local git hooks during setup that protect you:

- **Post-merge Security Scanning**: After every `git pull`:
  - Analyzes changed executable files for security threats
  - Detects dangerous shell commands, malicious scripts
  - Can automatically revert suspicious merges
  - Logs security events to `~/.git-security.log`

- **Pre-commit Secret Detection**: Before every `git commit`:
  - Blocks commits with hardcoded API keys, passwords
  - Detects Anthropic, OpenAI, AWS, GitHub tokens
  - Provides specific remediation suggestions
  - Allows emergency bypass with `--no-verify`

- **Smart File Filtering**: Only scans relevant files:
  - Focuses on executable scripts (`.sh`, `.py`, `.js`, etc.)
  - Skips documentation and example files
  - Treats test files with lighter security requirements

### Security Commands

```bash
# Install/reinstall git hooks
~/claude-craft/tools/install-git-hooks.sh

# Check for secrets in current directory
~/claude-craft/tools/security-scan.sh . secrets true

# Emergency bypass (use carefully!)
git commit --no-verify    # Skip pre-commit hook
```

### Threat Detection

The security system detects:
- **Destructive Operations**: rm -rf, dd, mkfs, disk writes
- **Credential Theft**: AWS/GCP/Azure key extraction, token harvesting
- **Data Exfiltration**: curl/wget pipes, netcat, base64 encoding
- **Code Injection**: eval, exec, system calls with external input
- **Persistence**: crontab modifications, service installations
- **Development Tool Abuse**: sfdx, clasp, terraform destroy

All security events are logged to `~/.git-security.log` for audit.

## UserRegistry

The `UserRegistry` class provides a centralized registry for managing user identities and their associated metadata across Claude Craft sessions.

### Overview

`UserRegistry` maps user identifiers to profile records, supporting lookup, registration, and removal. It is designed to be used by skills and agents that need to persist or share user context.

### Usage

```js
const { UserRegistry } = require('./lib/user-registry');

// Create a registry
const registry = new UserRegistry();

// Register a user
registry.register('alice', { email: 'alice@example.com', role: 'admin' });

// Look up a user
const user = registry.get('alice');
// → { email: 'alice@example.com', role: 'admin' }

// Check existence
registry.has('alice');  // true
registry.has('bob');    // false

// Remove a user
registry.remove('alice');

// List all registered user IDs
const ids = registry.list();
// → []
```

### API

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(id: string, profile: object) => void` | Add or overwrite a user record |
| `get` | `(id: string) => object \| undefined` | Retrieve a user record by ID |
| `has` | `(id: string) => boolean` | Check whether a user ID is registered |
| `remove` | `(id: string) => boolean` | Remove a user record; returns `true` if removed |
| `list` | `() => string[]` | Return all registered user IDs |

### Notes

- `register` is idempotent: calling it twice with the same `id` overwrites the previous record.
- `UserRegistry` is in-memory only; it does not persist between process restarts.
- Thread safety is not guaranteed in concurrent async contexts — clone or serialize access if needed.

## Contributing

1. Fork this repository
2. Add your prompts, commands, agents, or workflows
3. Submit a pull request

---

**Claude Craft** — symlink-based extension management for all 7 Claude Code extension types. One install, instant updates, zero conflicts.