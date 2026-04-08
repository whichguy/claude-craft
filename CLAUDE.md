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
SETUP:       install.sh + sync + merge-hooks = idempotent fixer — run repeatedly to converge
```

---

## Development Guide

### Running Tests
`npm test` (all) | `test:sync` | `test:security` | `test:knowledge` | `test:backup` | `test:watch` | `test:coverage`

### Adding Extensions
Create file in repo subdir → `ln -sfn` to `~/.claude/` → test → commit. Use `/agent-sync sync` to batch-sync.

### Installation

```bash
./install.sh                                    # Local install (symlinks repo → ~/.claude/)
./uninstall.sh [--dry-run|--yes|--keep-repo]    # Uninstall
./tools/install-git-hooks.sh [repo-path]        # Git hooks
```

## Wiki
WIKI: /wiki-load before answering project-domain questions. /wiki-query for synthesis.
WIKI_CONTEXT: invoke /wiki-load <slug> immediately when wiki-notify injects WIKI_PARTIAL or WIKI_NEW content — full retrieval required before plan/design/debug work on those topics.
