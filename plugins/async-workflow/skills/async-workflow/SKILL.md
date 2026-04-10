---
description: "Async workflow pipeline for use case preparation and implementation. Auto-invokes for feature planning and complex task preparation."
alwaysApply: false
---

# Async Workflow Skill (v2 - Task-Native)

This skill provides background preparation and implementation workflows for use cases, features, and complex tasks.

**v2 Architecture**: Replaced bash scripts with native Claude Code Task capabilities for improved reliability and cross-platform compatibility.

## Quick Reference: /todo vs /bg

| Aspect | `/todo` | `/bg` |
|--------|---------|-------|
| Preparation | ASYNC | ASYNC |
| Implementation | **SYNC** (user does it) | **ASYNC** (agent does it) |
| Review | ASYNC | ASYNC |
| Use case | User wants control | User trusts agent |
| MCP available | YES (user implements) | NO (background agent) |

## Trigger Patterns

**AUTOMATICALLY INVOKE** this skill when user mentions:
- "prepare", "plan ahead", "background prep", "async prep"
- "expand this use case", "expand on this", "think through this"
- Starting a complex feature that would benefit from thorough preparation
- "let me know when ready", "work on this in background"
- "do this in the background", "fire and forget"

**DO NOT INVOKE** when:
- User is asking for immediate help with a simple task
- User wants direct implementation without planning
- Task is clearly a quick fix or tactical issue
- User explicitly says they don't want async preparation

## Available Commands

### `/todo <request> [flags]` - Async Prep, Sync Implementation

Queue a task for async preparation. **User implements synchronously** after prep completes.

**Flags:**
- `--fast` - Use Haiku for all phases
- `--deep` - Use Sonnet/Opus (default)
- `--tactical` - Research-only lightweight mode

**Classification (Auto-Detected):**
- **TACTICAL**: Stack traces, errors → No async prep
- **IMPLEMENT**: Features, implementations → Full async pipeline
- **RESEARCH**: Vague requests → Full async pipeline
- **REFACTOR**: Code improvements → Full async pipeline

**Workflow:**
```
User → /todo "feature" → ASYNC prep → Todo added → User implements SYNC → ASYNC review
```

### `/bg <request> [flags]` - Fully Fire-and-Forget

Launch a task that runs entirely in the background. **Agent implements automatically.**

**Flags:**
- `--fast` - Use Haiku for all phases
- `--deep` - Use Sonnet/Opus (default)

**Workflow:**
```
User → /bg "feature" → ASYNC (prep + implement + review) → Notified when done
```

**When to use /bg:**
- You trust the agent to make implementation decisions
- Task is well-defined with clear requirements
- No MCP tools needed (background agents can't use MCP)

**When to use /todo instead:**
- You want to review the plan before implementation
- Task requires MCP tools (GAS, Chrome DevTools, etc.)
- Task is ambiguous or needs clarification

### `/todo-cleanup [--dry-run]` - Maintenance

Clean up abandoned and old tasks.

- Tasks past 7-day timeout → Marked ABANDONED
- Tasks past 30-day cleanup → Deleted
- Corrupted/invalid → Skipped safely

## v2 Architecture: Task-Native

### What Changed (v1 → v2)

| Aspect | v1 (bash) | v2 (Task-native) |
|--------|-----------|------------------|
| ID Generation | Python + xxd | python3 time + os.urandom |
| File Operations | bash cat/echo | Write tool (atomic) |
| Locking | mkdir-based | Not needed (Task handles) |
| Date Handling | macOS/Linux specific | JavaScript (universal) |
| JSON Operations | jq (external) | JSON.parse/stringify |
| Status Updates | async-utils.sh | Read/Write JSON |
| Error Handling | bash trap | Agent try/catch |

### Code Reduction

| Component | v1 Lines | v2 Lines | Reduction |
|-----------|----------|----------|-----------|
| async-utils.sh | 527 | 0 | -100% |
| todo-expansion-agent.md | 500 | 0 | -100% (uses built-in agents) |
| Command files | 0 | ~300 | New |
| **Total** | ~1,200 | ~500 | **-58%** |

### Edge Cases Preserved

All 13 edge cases from the original test suite are handled:

| # | Edge Case | v2 Solution |
|---|-----------|-------------|
| 1 | Empty/Invalid Task ID | Regex validation |
| 2 | Path Traversal Attack | Reject `..` and `/` + `startsWith` containment |
| 3 | ID Collision | python3 os.urandom() |
| 4 | Invalid Date Parsing | `Number.isNaN()` check (not `\|\| Infinity`) |
| 5 | Meta.json Corruption | try/catch + skip |
| 6 | Large Content (>100KB) | Write tool (no limits) |
| 7 | File Descriptor Leak | No FDs (Task manages) |
| 8 | Concurrent Generation | TaskCreate atomic |
| 9 | Invalid jq Filter | No jq in command files (hook requires jq, checks at startup) |
| 10 | Symbolic Link Safety | Read tool validation |
| 11 | Cross-Platform Dates | JavaScript Date |
| 12 | Lock Stale/Timeout | Not needed for commands (hook ops use file-level atomicity) |
| 13 | Crashed RUNNING Tasks | RUNNING status + 1hr grace period in cleanup |

## Expansion Validation Questions

During expansion, the agent validates with 5 key questions:

1. **Objective Clarity**: Is the objective clear?
2. **Entity/Action Ambiguity**: Is there ambiguity that needs user clarification?
3. **Directive Conflicts**: Does this conflict with any CLAUDE.md rules?
4. **Open Questions**: Do any questions remain?
5. **Destructive Check**: Is this destructive and requires confirmation?

**Outcomes**: PROCEED | FLAG_FOR_CLARIFICATION | HALT

## Quality Review Questions

After implementation, review runs with 5 questions:

1. **Quality Standards**: Do changes meet quality standards?
2. **Corner Cases**: Are there corner cases missed?
3. **Unintended Consequences**: Any breaking changes or security concerns?
4. **Secondary Effects**: Impact on related features?
5. **Suggested Changes**: Any improvements to recommend?

If issues found, agent fixes and re-reviews (max 3 iterations).

## Workflow Overview

### /todo Workflow (5 phases)

```
User → /todo "feature" [--fast|--deep|--tactical]
    │
    ├── Parse flags → Classify request
    ├── Generate task ID → Write meta.json
    │
    └── Background agent:
        ├── Phase 0: Set status → RUNNING
        ├── Phase 1: Expand use cases → expansion.md
        ├── Phase 1.5: Validation gate (PROCEED/FLAG/HALT)
        ├── Phase 2: Research codebase (Glob/Grep)
        ├── Phase 3: Create implementation plan → plan.md
        ├── Phase 4: Write checklist → checklist.md
        └── Phase 5: Set status → READY
                         ↓
User reads checklist.md → Implements (MCP available)
                         ↓
Marks "Run quality review" → Hook detects → User/LLM runs review
```

### /bg Workflow (7 phases)

```
User → /bg "feature" [--fast|--deep]
    │
    ├── Parse flags
    ├── Generate task ID → Write meta.json
    │
    └── Background agent:
        ├── Phase 0: Set status → RUNNING
        ├── Phase 1: Expand use cases → expansion.md
        ├── Phase 1.5: Validation gate (PROCEED/FLAG/HALT)
        ├── Phase 2: Research codebase
        ├── Phase 3: Plan implementation → plan.md
        ├── Phase 4: IMPLEMENT (Edit files)
        ├── Phase 5: Quality review (max 3 iterations) → review.md
        ├── Phase 6: Write completion summary → checklist.md
        └── Phase 7: Set status → COMPLETED
```

## Status State Machine

```
PENDING → RUNNING → READY              (/todo: prep complete, user implements)
                  → COMPLETED           (/bg: agent finished implementation)
                  → NEEDS_USER_ACTION   (/bg: MCP tools required)
                  → FAILED              (any unrecoverable error)
                  → FLAG_FOR_CLARIFICATION  (ambiguous request)
                  → HALT                (destructive/dangerous request)

Any status → ABANDONED  (via /todo-cleanup after 7-day timeout)
ABANDONED  → [deleted]  (via /todo-cleanup after 30-day cleanup_at)
```

## Output Files

Tasks stored in `~/.claude/async-prep/{task-id}/`:

| File | Description |
|------|-------------|
| `meta.json` | Task metadata (status, timestamps) — written by agent |
| `.hook-state.json` | TodoWrite content tracking — written by hook only |
| `expansion.md` | Use cases, edge cases, acceptance criteria |
| `plan.md` | Implementation steps, patterns, risks |
| `checklist.md` | Implementation checklist (/todo) or completion summary (/bg) |
| `implementation.log` | Step-by-step progress log (/bg only) |
| `review.md` | Post-implementation review (/bg only) |
| `error.log` | Error details (if failed) |

## Background Agent Limitations

Background agents (spawned with `run_in_background: true`) have constraints:

1. **No MCP tools**: Cannot use mcp__gas__*, mcp__chrome-devtools__*, etc.
2. **No nested agents**: Cannot spawn subagents
3. **No interactive prompts**: Permission requests auto-fail
4. **Available tools**: Read, Write, Edit, Grep, Glob, Bash

### The /todo Hybrid Pattern (Best for MCP Projects)

| Phase | Execution | MCP Available? |
|-------|-----------|----------------|
| Expansion | Background agent | No |
| User Implementation | Foreground (user) | **Yes** |
| Quality Review | Main conversation | **Yes** |

## Natural Language Task Management

Instead of slash commands, use natural language:

| Request | Action |
|---------|--------|
| "show me the full plan for [task-id]" | Read .md files from task directory |
| "what's the status of my async tasks?" | List tasks from ~/.claude/async-prep/ |
| "retry task [task-id]" | Check failed phase, relaunch |
| "clean up old async tasks" | Run /todo-cleanup |
| "review my implementation" | Launch review manually |

## Constraints

1. **Recommended max 3 concurrent**: 3 background agents per session recommended (not enforced)
2. **7-day timeout**: Tasks marked ABANDONED after 7 days (RUNNING gets +1hr grace)
3. **30-day cleanup**: Tasks deleted after 30 days
4. **No MCP in /bg**: Use /todo when MCP tools needed

## Auto-Review Trigger

The hook (`detect-quality-review.sh`) monitors TodoWrite for the "Run quality review" checkbox:

1. Hook detects checkbox transition (unchecked → checked) via TodoWrite `afterToolCall`
2. Hook validates task ID, checks expansion files exist, outputs trigger instructions
3. **User/LLM must manually initiate the actual review** — the hook only detects the trigger

The hook does NOT automatically launch a review agent. It outputs instructions that the LLM should follow to run the review.

## Migration Notes

v2 replaced all bash infrastructure (async-utils.sh, agents/ directory, test scripts) with Task-native command files. See `CLEANUP_GUIDE.md` for migration details.
