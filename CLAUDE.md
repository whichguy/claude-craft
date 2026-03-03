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

| Primitive | Count | Role | Entry Point | When to Use |
|-----------|-------|------|-------------|-------------|
| **Skill** | 23+ | User-facing workflows, triage + optional agent dispatch | `/skill-name` | User interactions requiring triage (simple→inline, complex→agent) |
| **Agent** | 20 | Autonomous workers with own context window | Spawned by skills or other agents | Complex multi-step tasks needing isolation |
| **Command** | 10 | Simple utilities, no agent dispatch | `/command-name` | One-shot operations (alias, sync, prompt execution) |
| **Prompt** | 3 | Orchestration templates executed via `/prompt` | `/prompt name args` | Multi-phase methodologies, A/B testing frameworks |
| **Reference** | 1 | Static documentation loaded into context | Referenced by agents/skills | Domain knowledge that doesn't change often |
| **Plugin** | 2 | Hook-based extensions (pre/post execution) | Auto-loaded by Claude Code | Security gates, auto-sync triggers, reflection |

### Skill Design Pattern

All skills follow: **Step 0** parse args → **Step 1** triage (simple vs complex) → **Step 2a** inline fast path OR **Step 2b** agent dispatch → **Step 3** post-processing.

Skills wrapping agents: `/review` (code-reviewer + review-fix), `/test` (qa-analyst), `/refactor` (code-refactor), `/architect` (system-architect), `/develop` (feature-developer), `/tasks` (feature-task-creator), `/expand` (use-case-expander).

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
│   ├── craft-hooks/            # Security + auto-sync hooks
│   └── reflection-system/      # Session reflection and knowledge
└── tools/                      # Management scripts (not symlinked)
```

### Script Inventory

| Script | Purpose |
|--------|---------|
| `sync-status.sh` | Core sync engine: status/sync/add/publish for all 6 types |
| `shared-types.sh` | TYPES array: `"name\|emoji\|subdir\|repo\|kind\|pattern\|skip"` |
| `auto-sync.sh` | Probabilistic pull (1/27 chance, 5s debounce) |
| `backup.sh` | Timestamped tar backup/restore, 60-day retention |
| `security-scan.sh` | Comprehensive secrets + PII scanner |
| `simple-secrets-scan.sh` | Fast pre-commit secrets check |
| `install-git-hooks.sh` | Wire .githooks/ to .git/hooks/ |
| `install.sh` | Bootstrap: clone/update → sync → hooks |
| `uninstall.sh` | Comprehensive removal with dry-run/restore |

### Sync Architecture

All sync via `tools/sync-status.sh` — single data-driven script:
- **File-based** (agents, commands, prompts, references): per-file symlinks
- **Directory-based** (skills, plugins): per-directory symlinks
- TYPES array in `tools/shared-types.sh` (shared by sync-status.sh and uninstall.sh)
- Skip patterns exclude legacy files (`old-do-not-use-*`) and global commands (`alias.md`, `unalias.md`)
- Local-only files never overwritten

### Security Infrastructure

1. **Pattern scanning**: `security-scan.sh` (comprehensive) and `simple-secrets-scan.sh` (fast pre-commit)
2. **Git hooks** (`.githooks/`): pre-commit scans staged files, symlinked to `.git/hooks/`
3. **Plugin hooks** (`plugins/craft-hooks/`): `pre-execution-security.sh` + `prompt-sync-check.sh`, uses `${CLAUDE_PLUGIN_ROOT}` paths

### Prompt-as-Code Pattern

The `/prompt` command executes templates as instructions:
```
/prompt template-name args → Load template.md → Replace <prompt-arguments> → Execute
```

Discovery precedence: explicit paths → git parent → profile (`~/.claude/prompts`) → current dir.

### Auto-Sync

- 1/27 chance (~3.7%) per user prompt, 5s debounce
- Automatic stash/merge/restore for conflicts
- Background operation, never interrupts workflow

### Command System

Commands are markdown with YAML frontmatter (`argument-hint`, `description`, `allowed-tools`).
Key commands: `/agent-sync` (repository sync), `/alias` + `/unalias` (dynamic command generation), `/prompt` (template executor).

### Alias System

`/alias` dynamically creates commands: validates reserved words, generates YAML frontmatter, marks `alias-generated: true`, supports `--global` and local scopes.

### Backup System

Timestamped tar archives in `~/.claude/backups/`, format `claude-backup-YYYYMMDD-HHMMSS.tar.gz`, 60-day retention, restore via `./uninstall.sh --restore`.

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
curl -fsSL https://raw.githubusercontent.com/whichguy/claude-craft/main/install.sh | bash  # Remote
./uninstall.sh [--dry-run|--yes|--keep-repo]    # Uninstall
./tools/install-git-hooks.sh [repo-path]        # Git hooks
```

### Adding Extensions

**New command**: Create `commands/name.md` with YAML frontmatter → `ln -sfn $(pwd)/commands/name.md ~/.claude/commands/` → test with `/name` → commit.

**New skill**: Create `skills/name/SKILL.md` with YAML frontmatter (name, description with AUTOMATICALLY INVOKE triggers, allowed-tools) → `ln -sfn $(pwd)/skills/name ~/.claude/skills/` → test with `/name` → commit.

**New prompt template**: Create `prompts/name.md` with `<prompt-arguments>` placeholder → `/agent-sync sync` → test with `/prompt name [context]`.

**New agent**: Create `agents/name.md` → `/agent-sync sync` → spawned via Agent tool with matching `subagent_type`.

### Shell Best Practices

- `git -C "<directory>"` always (never `cd` + git)
- `! [ -z "$VAR" ]` for negation (not `[[ ! -z ]]`)
- Trap handlers for cleanup
- Absolute paths or `git -C`

### Debugging

```bash
ls -la ~/.claude/commands/ | grep claude-craft   # Check symlinks
ls -la .git/hooks/                               # Verify git hooks
./tools/sync-status.sh status                    # Check sync state
./tools/security-scan.sh test/fixtures secrets   # Test security patterns
./tools/simple-secrets-scan.sh                   # Quick secrets check
```
