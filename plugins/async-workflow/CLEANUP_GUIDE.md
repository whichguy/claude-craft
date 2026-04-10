# Async Workflow v2 Cleanup Guide

Migration from v1 (bash-based) to v2 (Task-native) is **complete**.

## What Was Removed

| File | Size | Reason |
|------|------|--------|
| `scripts/async-utils.sh` | 17KB | Replaced by Task-native operations |
| `scripts/test-edge-cases.sh` | 10KB | Replaced by test-edge-cases-v2.md |
| `agents/` directory (9 files) | ~80KB | Agent prompts inlined in command files |
| `IMPLEMENTATION_SUMMARY.md` | 425 lines | 100% v1 references to deleted files |
| `CRITICAL_FIXES_COMPLETE.md` | 286 lines | Documents fixes to deleted async-utils.sh |
| `HOOK_INTEGRATION.md` | 220 lines | Test procedures depend on deleted functions |

**Total removed: ~110KB**

## What Was Updated

| File | Change |
|------|--------|
| `hooks/detect-quality-review.sh` | Self-contained; jq check; hook state in `.hook-state.json` (not meta.json) |
| `skills/async-workflow/SKILL.md` | v2 architecture, status state machine, corrected workflow diagrams |
| `commands/todo.md` | Flag parsing, RUNNING status, validation gate, classification behavior |
| `commands/bg.md` | Flag parsing, RUNNING status, validation gate, checklist.md output |
| `commands/todo-cleanup.md` | RUNNING/FAILED/NEEDS_USER_ACTION handling, epoch 0 fix, v1 skip |
| `.claude-plugin/plugin.json` | Version 1.0.0 → 2.0.0 |

## What Was Added

| File | Purpose |
|------|---------|
| `commands/todo.md` | /todo command (Task-native) |
| `commands/bg.md` | /bg command (Task-native) |
| `commands/todo-cleanup.md` | /todo-cleanup command |
| `scripts/test-edge-cases-v2.md` | Edge case test documentation |

## Current File Structure

```
async-workflow/
├── .claude-plugin/plugin.json
├── commands/
│   ├── todo.md
│   ├── bg.md
│   └── todo-cleanup.md
├── hooks/
│   ├── hooks.json
│   └── detect-quality-review.sh
├── scripts/
│   └── test-edge-cases-v2.md
├── skills/
│   └── async-workflow/SKILL.md
└── CLEANUP_GUIDE.md
```
