# Reflection System Plugin

Knowledge retrieval through session reflection. Analyzes Claude Code sessions and builds a searchable knowledge base of decisions, corrections, and patterns.

## Overview

This plugin implements a knowledge-first reflection system that:
1. **Captures** session references automatically via hooks (stop, session-end, precompact)
2. **Summarizes** sessions into compact knowledge entries on demand
3. **Retrieves** relevant knowledge by topic via semantic search
4. **Consolidates** multiple sessions into high-level topic files

## Architecture (v2.0)

### Two-Tier Knowledge Storage

```
~/.claude/reflection-knowledge/
├── index.json                    # Topic → session mapping, keywords, timestamps
├── sessions/                     # Compact session summaries (50-150 lines each)
│   ├── cfd0d04b.md              # Key decisions, corrections, outcomes, keywords
│   └── 15348db4.md
└── topics/                       # Consolidated knowledge by topic (high-level)
    ├── mcp-design.md            # Merged from multiple sessions
    └── workflow-patterns.md     # Merged from multiple sessions
```

**Tier 1 — Session Summaries**: Generated from JSONL transcripts, one per session. Contains key decisions, corrections, outcomes, and topic keywords.

**Tier 2 — Topic Files**: Consolidated from multiple session summaries. Higher-level principles and anti-patterns organized by topic.

### Flow

```
Session ends → Hook queues session reference
                    ↓
Next session starts → Processor detects pending queue
                    ↓
Auto-runs /reflect --process-queue → Haiku summarizes each session
                    ↓
User runs /reflect <topic> → Searches sessions + topics → Synthesizes answer
                    ↓
Optionally: /consolidate <topic> → Merges sessions into topic file
```

## Commands

| Command | Description |
|---------|-------------|
| `/reflect <topic>` | Search and synthesize knowledge on a topic |
| `/reflect --process-queue` | Summarize pending sessions into knowledge entries |
| `/reflect` (no args) | Show knowledge base status and available topics |
| `/consolidate <topic>` | Merge session summaries into a consolidated topic file |
| `/consolidate --auto` | Auto-detect and consolidate all topic candidates |
| `/consolidate` (no args) | Show consolidation candidates |

### Examples

```
/reflect mcp design          # What do I know about MCP design patterns?
/reflect git workflows       # Retrieve git-related knowledge
/reflect --process-queue     # Process 3 pending sessions from today
/consolidate mcp-design      # Merge all MCP sessions into one topic file
/consolidate --auto          # Auto-consolidate all topics with 2+ sessions
```

## Kill Switch

Enable/disable reflection via the kill switch file:

```bash
touch ~/.claude/REFLECT_OFF   # Disable reflection
rm ~/.claude/REFLECT_OFF      # Enable reflection
ls ~/.claude/REFLECT_OFF      # Check status (exists = disabled)
```

**Scope**: The kill switch affects session capture hooks (stop, session-end, precompact) and queue processing (session-start-processor). Skill change notifications (`check-skills-changed.sh`) run independently and are **not** affected by `REFLECT_OFF`, since they serve a separate purpose (notifying about new/changed skill files).

## Subagent & Team Behavior

Subagents (spawned via the Task tool) and agent team members have their own lifecycle events that differ from the main session:

| Hook Event | Main Session | Subagent | Reflection Action |
|-----------|-------------|----------|-------------------|
| SessionStart | Yes | No (fires `SubagentStart`) | Queue processing + topic injection |
| Stop | Yes | No (fires `SubagentStop`) | Queue session for reflection |
| SessionEnd | Yes | No | Queue session (Ctrl-C safety net) |
| PreCompact | Yes | **Yes** | Queue session before compaction |

**Key risk**: `PreCompact` fires for subagents, and subagents share the parent's `session_id`. Without filtering, a subagent's compaction could create a queue entry with the wrong transcript path, poisoning the parent session's reflection.

**Mitigation**: All hook handlers check for `agent_id` in the hook input JSON. If present, the event is from a subagent and is skipped:
```bash
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[[ -n "$AGENT_ID" ]] && exit 0
```

**Design decision**: Subagent transcripts are NOT captured separately. The parent session's transcript includes subagent results (they report back), so the parent's summary captures the important decisions and outcomes. This avoids queue flooding during team-based work.

## How It Works

### Session Capture (Automatic)

When a Claude Code session ends:
1. Stop/SessionEnd/PreCompact hook queues a reference to `~/.claude/reflection-queue/`
2. Queue entry contains: session_id, transcript_path, cwd, timestamp
3. Entry is marked "pending" until processed

### Queue Processing (Auto or Manual)

At next session start:
1. `session-start-processor.sh` counts pending queue entries
2. Injects a directive for Claude to run `/reflect --process-queue`
3. Each pending session is summarized by a Haiku subagent
4. Summaries written to `~/.claude/reflection-knowledge/sessions/`

### Topic Retrieval (On Demand)

When user runs `/reflect <topic>`:
1. Searches topic files for matching names/content
2. If topic file found and recent → returns it
3. Otherwise searches session summaries → synthesizes answer
4. Optionally saves synthesis as new topic file

### Topic Consolidation (On Demand)

When user runs `/consolidate <topic>`:
1. Finds all session summaries matching the topic
2. Synthesizes them into a single topic file
3. Writes to `~/.claude/reflection-knowledge/topics/`

## Directory Structure

```
~/claude-craft/plugins/reflection-system/
├── .claude-plugin/plugin.json         # Plugin metadata
├── hooks/hooks.json                   # Plugin hook declarations
├── hooks-handlers/
│   ├── check-skills-changed.sh        # SessionStart: skill change notifications
│   ├── session-start-processor.sh     # SessionStart: queue processor + topic injection
│   ├── precompact-hook.sh             # PreCompact: queues session before compaction
│   ├── stop-hook.sh                   # Stop: queues session for deferred processing
│   └── session-end-hook.sh            # SessionEnd: Ctrl-C safety net
├── commands/
│   ├── reflect.md                     # Knowledge retrieval + queue processing
│   └── consolidate.md                 # Topic consolidation
└── README.md

~/.claude/plugins/reflection-system/  # Runtime state (created by hooks)
└── state/
    └── notification-state.json        # Skill change notification tracking

~/.claude/reflection-queue/            # Pending session entries (JSON)

~/.claude/reflection-knowledge/        # Knowledge base
├── index.json                         # Topic/session index
├── sessions/                          # Session summaries (Tier 1)
└── topics/                            # Consolidated topics (Tier 2)
```

## Migration from v1.0

v2.0 replaces the 3-phase pipeline (reflect → analyze-sessions → reconcile-skills) with a knowledge retrieval system:

| v1.0 | v2.0 |
|------|------|
| `/reflect` (audit) | `/reflect --process-queue` (summarize) |
| `/analyze-sessions` (pattern recognition) | Removed — built into `/reflect` |
| `/reconcile-skills` (skill creation) | `/consolidate` (topic merging) |
| Individual skill files per correction | Topic files consolidating multiple sessions |

Existing generated skills were migrated to topic files:
- `mcp-tool-design-principles` + `mcp-gas-mtime-clock-skew` → `topics/mcp-design.md`
- `verify-after-manual-fix` + `git-safety-net-confidence` → `topics/workflow-patterns.md`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Reflection not starting | Check if `~/.claude/REFLECT_OFF` exists, verify sessions exist |
| No pending sessions | Sessions queue on stop/session-end/precompact hooks |
| No knowledge found | Run `/reflect --process-queue` to summarize pending sessions |
| Topic file stale | Run `/consolidate <topic>` to refresh from recent sessions |
| Notification shows every session | Delete `~/.claude/plugins/reflection-system/state/notification-state.json` |

## Version

2.0.0 — Knowledge retrieval system (replaces skill-generator pipeline)
