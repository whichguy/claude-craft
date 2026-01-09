# Reflection System Plugin

Self-improving context through session reflection. Analyzes Claude Code sessions for learning signals and generates persistent skills.

## Overview

This plugin implements a 3-phase reflection loop that:
1. **Audits** recent sessions for corrections, friction, and successes
2. **Analyzes** patterns using a Sonnet subagent
3. **Reconciles** findings into skill files

## Commands

| Command | Description |
|---------|-------------|
| `/reflect [mode] [--scope]` | Phase 1: Audit sessions for learning signals |
| `/analyze-sessions` | Phase 2: Spawn subagent to identify skill recommendations |
| `/reconcile-skills [mode]` | Phase 3: Create/update skill files |

### Arguments

- `mode`: `auto` (default) or `interactive`
- `scope`: `last` (default), `today`, or `week`

## Shell Aliases

After installation, these aliases are available:

```bash
reflect-on      # Enable auto-reflection on session end
reflect-off     # Disable auto-reflection
reflect-now     # Run interactive reflection immediately
reflect-status  # Check if reflection is ON or OFF
```

## Skill Notifications

When skills change, you'll see a one-time notification at session start:

```
Skills updated since last session: git-patterns, shell-scripting. Run 'skills-list' for details.
```

**Key behavior**:
- Notifies **once per change**, not every session (prevents notification fatigue)
- Uses SHA256 hash comparison to detect actual changes
- Silent when no skills exist or no changes occurred

### Skill Management Aliases

```bash
skills-list         # List all available skills
skills-history      # View recent skill changes (git log)
skills-reset-notify # Force re-notification on next session
```

## How It Works

### Auto-Reflection (Stop Hook)

When a Claude Code session ends:
1. Stop hook checks for session data
2. If sessions exist and `REFLECT_OFF` doesn't exist, starts reflection loop
3. Cycles through: audit → analyze → reconcile
4. Each phase outputs JSON that triggers the next phase
5. Loop completes when reconciliation outputs "reflection complete"

### Skill Generation

Skills are written to `~/claude-craft/skills/memory-*.md` with:
- YAML frontmatter (name, description, patterns, confidence)
- Markdown body (facts, context, execution logic)
- Evidence citations from original sessions

### Kill Switch

Create `~/.claude/REFLECT_OFF` to disable auto-reflection:
```bash
touch ~/.claude/REFLECT_OFF  # or: reflect-off
```

## Prerequisites

Session journaling must be active. Verify with:
```bash
ls ~/.claude/sessions/
```

If empty, configure hooks in `~/.claude/settings.json`.

## Directory Structure

```
~/.claude/plugins/reflection-system/   # Symlink to ~/claude-craft/plugins/reflection-system/
├── .claude-plugin/plugin.json         # Plugin metadata
├── hooks/hooks.json                   # SessionStart + Stop hook config
├── hooks-handlers/
│   ├── stop-hook.sh                   # Auto-reflection trigger
│   └── check-skills-changed.sh        # Skill change notifications
├── commands/
│   ├── reflect.md                     # Phase 1
│   ├── analyze-sessions.md            # Phase 2
│   └── reconcile-skills.md            # Phase 3
└── state/
    ├── loop.json                      # Active loop state (temporary)
    └── notification-state.json        # Skill notification tracking

~/claude-craft/skills/
└── memory-*.md                        # Generated skills
```

## Manual Testing

Test each phase independently before relying on auto-reflection:

```bash
# Phase 1: Check for learning signals
/reflect mode:interactive

# Phase 2: Analyze and get recommendations
/analyze-sessions

# Phase 3: Create skills
/reconcile-skills mode:interactive
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Reflection not starting | Check `reflect-status`, verify sessions exist |
| Loop stuck | Delete `~/.claude/plugins/reflection-system/state/loop.json` |
| No signals found | Check session data with `ls ~/.claude/sessions/` |
| Skills not discovered | Ensure skills are in `~/claude-craft/skills/` |
| Notification shows every session | Reset state: `skills-reset-notify` |
| No notification after skill change | Check `jq` is installed, verify skill has SKILL.md |

## Version

1.0.0 - Initial implementation with ralph-wiggum pattern
