# CLAUDE.md — Claude Craft

## Directives

```
SYNC_ENGINE: tools/sync-status.sh [status|sync|add|publish] — all 6 extension types
TYPES:       tools/shared-types.sh — "name|emoji|subdir|repo|kind|pattern|skip"
SYMLINKS:    ln -sfn (never -sf for dirs, never cp) — repo → ~/.claude/
GIT:         always git -C "<dir>", never cd + git
SHELL:       set -eo pipefail, shopt -s nullglob, trap cleanup
TEST:        npm test (mocha/chai, fixture-based, no mocks)
SECURITY:    pre-commit → simple-secrets-scan.sh (fast) | full → security-scan.sh
```

### Extension Taxonomy

| Primitive | Role | Entry Point | When to Use |
|-----------|------|-------------|-------------|
| **Skill** | User-facing workflows, triage + optional agent dispatch | `/skill-name` | User interactions requiring triage (simple→inline, complex→agent) |
| **Agent** | Isolated workers (own context window) | Spawned by skills or other agents | Complex multi-step tasks needing isolation |
| **Command** | One-shot utilities | `/command-name` | One-shot operations (alias, sync, prompt execution) |
| **Prompt** | Orchestration templates executed via `/prompt` | `/prompt name args` | Multi-phase methodologies, A/B testing frameworks |
| **Reference** | Static context docs | Referenced by agents/skills | Domain knowledge that doesn't change often |
| **Plugin** | Hook extensions (pre/post) | Auto-loaded by Claude Code | Wiki lifecycle hooks, utility hooks (cleanup, sync, skill-change) |

### Skill Design Pattern

All skills follow: **Step 0** parse args → **Step 1** triage (simple vs complex) → **Step 2a** inline fast path OR **Step 2b** agent dispatch → **Step 3** post-processing.

Skills wrapping agents: `/review-fix` (code-reviewer + review-fix), `/test` (qa-analyst), `/refactor` (code-refactor), `/architect` (system-architect), `/develop` (feature-developer), `/tasks` (feature-task-creator), `/expand` (use-case-expander).

---

## Architecture Reference

### Symlink-Based Extension System

Symlinks from repo to `~/.claude/` provide instant updates, no sync conflicts, version control, and easy rollback.

```
~/claude-craft/
├── agents/      (.md files)    → ~/.claude/agents/     [file-based symlinks]
├── commands/    (.md files)    → ~/.claude/commands/    [file-based symlinks]
├── skills/      (directories)  → ~/.claude/skills/      [dir-based symlinks]
├── prompts/     (.md files)    → ~/.claude/prompts/     [file-based symlinks]
├── references/  (.md files)    → ~/.claude/references/  [file-based symlinks]
├── plugins/     (directories)  → ~/.claude/plugins/     [dir-based symlinks]
│   ├── craft-hooks/            # Security + auto-sync + utility hooks
│   └── wiki-hooks/             # Wiki lifecycle: detect, guard, precompact, stop, session-end
└── tools/                      # Management scripts (not symlinked)
```

### Script Inventory

| Script | Purpose |
|--------|---------|
| `sync-status.sh` | Sync engine: status/sync/add/publish (all 6 types) |
| `shared-types.sh` | TYPES array shared by sync + uninstall |
| `auto-sync.sh` | Probabilistic pull (1/27, 5s debounce) |
| `backup.sh` | Tar backup/restore, 60-day retention |
| `security-scan.sh` | Full secrets + PII scan |
| `simple-secrets-scan.sh` | Fast pre-commit secrets check |
| `install-git-hooks.sh` | Wire .githooks/ → .git/hooks/ |
| `install.sh` | Bootstrap: clone → sync → hooks |
| `uninstall.sh` | Removal with dry-run/restore |

### Sync Architecture

File-based symlinks (agents, commands, prompts, references) vs directory-based (skills, plugins). Skip patterns exclude legacy files and global commands. Local-only files never overwritten.

### Security Infrastructure

1. **Pattern scanning**: `security-scan.sh` (comprehensive) and `simple-secrets-scan.sh` (fast pre-commit)
2. **Git hooks** (`.githooks/`): pre-commit scans staged files, symlinked to `.git/hooks/`
3. **Plugin hooks** (`plugins/craft-hooks/`): `prompt-sync-check.sh` + `check-skills-changed.sh` + `memo-cleanup.sh`, uses `${CLAUDE_PLUGIN_ROOT}` paths

### Prompt-as-Code Pattern

`/prompt name args` → loads template.md → replaces `<prompt-arguments>` → executes.
Discovery precedence: explicit paths → git parent → `~/.claude/prompts` → current dir.

### Auto-Sync

- 1/27 chance (~3.7%) per user prompt, 5s debounce
- Automatic stash/merge/restore for conflicts
- Background operation, never interrupts workflow

### Command System

Commands are markdown with YAML frontmatter (`argument-hint`, `description`, `allowed-tools`).
Key commands: `/agent-sync` (repository sync), `/alias` + `/unalias` (dynamic command generation), `/prompt` (template executor).

---

## Development Guide

### Running Tests

```bash
npm test                     # All tests
npm run test:sync            # Sync infrastructure
npm run test:security        # Security scanning patterns
npm run test:knowledge       # Knowledge discovery
npm run test:backup          # Backup/restore
npm run test:watch           # Watch mode
npm run test:coverage        # Coverage report
```

### Installation

```bash
./install.sh                                    # Local install (symlinks repo → ~/.claude/)
./uninstall.sh [--dry-run|--yes|--keep-repo]    # Uninstall
./tools/install-git-hooks.sh [repo-path]        # Git hooks
```

### Adding Extensions

Create file in repo subdir → `ln -sfn` to `~/.claude/` → test → commit. Use `/agent-sync sync` to batch-sync all types.
- **Command**: `commands/name.md` (YAML frontmatter) → `/name`
- **Skill**: `skills/name/SKILL.md` (YAML: name, description w/ AUTOMATICALLY INVOKE, allowed-tools) → `/name`
- **Prompt**: `prompts/name.md` (`<prompt-arguments>` placeholder) → `/prompt name [context]`
- **Agent**: `agents/name.md` → spawned via Agent tool with matching `subagent_type`

### Debugging

```bash
ls -la ~/.claude/commands/ | grep claude-craft   # Check symlinks
ls -la .git/hooks/                               # Verify git hooks
./tools/sync-status.sh status                    # Check sync state
./tools/security-scan.sh test/fixtures secrets   # Test security patterns
./tools/simple-secrets-scan.sh                   # Quick secrets check
```

## Wiki
WIKI: /wiki-load before answering project-domain questions. /wiki-query for synthesis.
