#!/bin/bash
# Shared extension type definitions for Claude Craft
# Sourced by sync-status.sh and uninstall.sh
#
# Format: "name|emoji|claude_subdir|repo_subdir|kind|pattern|skip_pattern"
#   kind=file: per-file symlinks (agents, commands, prompts, references)
#   kind=dir:  per-directory symlinks (skills, plugins)
#   skip_pattern: comma-separated globs to exclude

TYPES=(
    "agents|🤖|agents|agents|file|*.md|"
    "commands|⚡|commands|commands|file|*.md|alias.md,unalias.md"
    "skills|🎯|skills|skills|dir||"
    "prompts|📄|prompts|prompts|file|*.md|old-do-not-use-*,test-*"
    "references|📚|references|references|file|*.md|"
    "plugins|🔌|plugins|plugins|dir||"
)
