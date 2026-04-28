# Claude Craft 🚀

A comprehensive development toolkit for Claude Code extensions, featuring symlink-based management, a self-building wiki system, and adversarial code auditing.

## Project Overview

Claude Craft is designed to manage all 7 Claude Code extension types (agents, commands, skills, prompts, references, plugins, and hooks) efficiently. It uses a zero-risk symlink-based sync system to connect a local repository with the Claude configuration directory (`~/.claude/`).

### Core Components
- **Sync Engine:** Manages symlinks between `~/claude-craft` and `~/.claude/` for instant updates.
- **Wiki System:** A self-building engine that captures and synthesizes knowledge across sessions.
- **Adversarial Auditor:** The `code-reviewer` agent (G16) uses a language-specific "Domain Radar" and "Suspicion-First" monologue to detect subtle logic traps.
- **Security Framework:** Integrated pre-commit and post-merge hooks for secret detection and threat scanning.

## Building and Running

The project is primarily shell-based and manages Claude Code's environment.

### Setup & Installation
```bash
./install.sh                # Initial setup: clones repo, creates symlinks, installs hooks
./uninstall.sh              # Safe removal of components with --dry-run support
```

### Key Commands
- `/agent-sync`: Sync all 7 extension types between repo and `~/.claude/`.
- `/prompt`: Execute dynamic prompt templates from the `prompts/` directory.
- `/alias`: Manage slash command shortcuts (local or global).
- `/review-fix`: Automated parallel review-fix loop using autonomous agents.

### Testing
```bash
npm test                    # Run all tests (Mocha/Chai)
npm run test:sync           # Test sync infrastructure
npm run test:security       # Test security scanners
npm run test:bench          # Run code reviewer benchmarks
```

## Development Conventions

### Extension Management
1.  Add new extensions to the appropriate repository subdirectory (e.g., `agents/`, `skills/`).
2.  Use `ln -sfn` to create symlinks to `~/.claude/`.
3.  Test the extension within the Claude environment.
4.  Commit to the repository.

### Coding Style (CLAUDE.md)
- **Shell Scripts:** Use `set -eo pipefail`, `shopt -s nullglob`, and `trap cleanup`.
- **Git Operations:** Use `git -C "<dir>"` instead of `cd + git`.
- **Response Format:** Direct answers first, no preambles/postambles. Use tables for ≥3 items.
- **Code Review:** The `code-reviewer` agent mandates a `<suspicion>` block for findings to break through "clean code" camouflage.

### Benchmarking
The project maintains a **Deception Bank** of 150+ adversarial fixtures in `test/benchmarks/adversarial/`. New prompt variations should be validated against this suite using the `benchmark-runner` agent.
