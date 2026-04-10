---
description: "Queue a task for async preparation with Task-native implementation"
---

# /todo - Async Prep, Sync Implementation (Task-Native v2)

Queue a task for background expansion and planning. User implements synchronously after prep completes.

## Usage

```
/todo <request> [--fast|--deep|--tactical]
```

## Flags

- `--fast` - Use Haiku for all phases (faster, cheaper)
- `--deep` - Use Sonnet/Opus (default, higher quality)
- `--tactical` - Research-only lightweight mode

## Classification (Auto-Detected)

| Type | Trigger | Behavior |
|------|---------|----------|
| **TACTICAL** | Stack traces, errors, "fix", "bug" | No async prep, immediate help |
| **IMPLEMENT** | Features, "add", "create", "build" | Full async pipeline |
| **RESEARCH** | Questions, "why", "how", "what" | Deep investigation |
| **REFACTOR** | "refactor", "cleanup", "improve" | Code improvement focus |

## Execution Protocol

When the user invokes `/todo <request>`:

### Step 0: Parse Flags

Extract flags from the request string before classification:

```
1. Check for --fast flag → set model = 'haiku', remove flag from request
2. Check for --deep flag → set model = 'sonnet', remove flag from request
3. Check for --tactical flag → force classification = TACTICAL, remove flag from request
4. If no flag specified → default model = 'sonnet'
5. Store cleaned request (without flags) as originalRequest
```

### Step 1: Classification

Analyze the (cleaned) request to determine classification:

```
TACTICAL: Error messages, stack traces, debugging requests, or --tactical flag
  → Skip async prep, provide immediate assistance

IMPLEMENT/RESEARCH/REFACTOR: Features, questions, improvements
  → Continue to async preparation
```

### Step 2: Generate Task ID and Create Directory

Use Bash to generate a collision-free ID:

```bash
# Primary: python3 (available on macOS and most Linux)
python3 -c "import time, os; print(f'{int(time.time()*1000)}-{os.urandom(4).hex()}')" 2>/dev/null || \
# Fallback: node.js
node -e "console.log(Date.now()+'-'+require('crypto').randomBytes(4).toString('hex'))"
```

Validation rules (Edge Cases #1, #2):
- Must match pattern: `/^[0-9]{13}-[a-f0-9]{8}$/`
- Must NOT contain `..` or `/` (path traversal prevention)

Create task directory:

```bash
mkdir -p ~/.claude/async-prep/{task-id}
```

Expected directory structure after agent completes:
```
~/.claude/async-prep/{task-id}/
├── meta.json          # Task metadata
├── expansion.md       # Use cases (written by agent)
├── plan.md            # Implementation plan (written by agent)
└── checklist.md       # Implementation checklist (written by agent)
```

### Step 3: Write meta.json (Atomic Write)

**Edge Case #5**: Use Write tool for atomic file operations.

```json
{
  "version": "2.0",
  "task_id": "{task-id}",
  "title": "{title}",
  "original_request": "{original_request}",
  "classification": "{classification}",
  "status": "PENDING",
  "timeout_at": "{now + 7 days ISO}",
  "cleanup_at": "{now + 30 days ISO}",
  "created_at": "{now ISO}",
  "implementation": "task-native-v2"
}
```

### Step 4: Create Native Task Tracking

Use TaskCreate for native Claude Code tracking:

```javascript
TaskCreate({
  subject: `[${classification}] ${title}`,
  description: originalRequest,
  activeForm: `Expanding: ${title}`
})
```

### Step 5: Launch Coordinator Agent

Launch a single background agent that orchestrates all expansion phases:

```javascript
Task({
  subagent_type: 'general-purpose',
  run_in_background: true,
  model: model,  // Set in Step 0: 'sonnet' (default/--deep) or 'haiku' (--fast)
  description: `Expand and plan: ${title}`,
  prompt: `
You are a task expansion coordinator preparing comprehensive implementation guidance.

## Context
- Task ID: ${taskId}
- Task Dir: ~/.claude/async-prep/${taskId}/
- Original Request: ${originalRequest}
- Classification: ${classification}
- Working Directory: ${cwd}

## TOOLS AVAILABLE
Read, Write, Edit, Grep, Glob, Bash

## Phase 0: Set Status to RUNNING

**FIRST ACTION** - Before anything else:
1. Read ~/.claude/async-prep/${taskId}/meta.json
2. Update status from "PENDING" to "RUNNING"
3. Write back to ~/.claude/async-prep/${taskId}/meta.json

This enables crash detection and cleanup.

## Phase 1: Use Case Expansion

Adjust depth based on classification:
- **IMPLEMENT**: Full expansion with 3-5 use cases, 3-5 edge cases, code examples
- **RESEARCH**: Deeper investigation focus, more scenarios, lighter planning
- **REFACTOR**: Focus on existing code analysis, impact assessment, before/after
- **TACTICAL**: Minimal expansion, direct solution approach only

Generate:
1. **Core Goal**: What is the user fundamentally trying to achieve?
2. **Use Case Scenarios** (3-5): Concrete scenarios with actors, preconditions, actions, expected results
3. **Edge Cases** (3-5): Error conditions, boundary values, invalid inputs
4. **Acceptance Criteria**: Specific, testable success measures
5. **Non-Functional Requirements**: Performance, security, accessibility considerations

Write to: ~/.claude/async-prep/${taskId}/expansion.md

## Phase 1.5: Validation Gate

Before proceeding, validate the request:

1. **Objective Clarity**: Is the objective clear enough to plan? If not → update meta.json status to "FLAG_FOR_CLARIFICATION", write concerns to expansion.md, stop.
2. **Ambiguity Check**: Are there entity/action ambiguities requiring user clarification? If critical → FLAG_FOR_CLARIFICATION.
3. **Conflict Check**: Does this conflict with existing patterns found in codebase? If yes → document in expansion.md.
4. **Destructive Check**: Is this destructive or irreversible? If yes → update meta.json status to "HALT", document why in expansion.md, stop.
5. **Open Questions**: Are there remaining questions that block planning? If blocking → FLAG_FOR_CLARIFICATION.

If all checks pass → PROCEED to Phase 2.

## Phase 2: Codebase Research

Search the codebase for:
- Existing patterns to follow
- Files that will need modification
- Dependencies and integration points
- Similar implementations to reference

Use Glob and Grep to find relevant code. Do NOT write a separate research.md - incorporate findings into the plan.

## Phase 3: Implementation Planning

Create step-by-step implementation plan:

1. **Summary**: 2-3 sentence approach overview
2. **Files to Modify/Create**: Table with current purpose and changes needed
3. **Implementation Steps**: Each independently testable, with code examples
4. **Risk Assessment**: Likelihood, impact, mitigation for each risk
5. **Rollback Plan**: Specific steps if issues arise

Write to: ~/.claude/async-prep/${taskId}/plan.md

## Phase 4: Write Checklist

Write a comprehensive implementation checklist to ~/.claude/async-prep/${taskId}/checklist.md

Format:
\`\`\`markdown
# [${classification}] ${title}

Task: ${taskId}
Full details: ~/.claude/async-prep/${taskId}/

## Implementation Checklist

- [x] Use case expansion complete
- [x] Codebase research complete
- [x] Implementation plan complete
- [ ] [Step 1 from plan]: [description]
- [ ] [Step 2 from plan]: [description]
...
- [ ] [Edge case 1]: [description]
- [ ] [Edge case 2]: [description]
- [ ] Run quality review
\`\`\`

Include:
- Task reference: "Task: ${taskId}"
- Mark agent-completed items as done: [x]
- Leave user items unchecked: [ ]
- Include file paths and pattern references
- Add edge cases to handle
- Include acceptance criteria
- **CRITICAL**: Last item must be "Run quality review"

## Phase 5: Update Status

Read meta.json, update status to "READY", add updated_at timestamp, write back.

## Error Handling

If any phase fails:
1. Update meta.json status to "FAILED" (prioritize this write)
2. Write error details to ~/.claude/async-prep/${taskId}/error.log
3. Write partial checklist to checklist.md with failure status
4. Output error message with details
`
})
```

### Step 6: Provide User Feedback

Output immediately to user:

```
Queued (${classification}): ${title}
Async prep started (task: ${taskId}).

When complete, checklist will be written to ~/.claude/async-prep/${taskId}/checklist.md
Read it and work through items incrementally.
```

## Edge Cases Handled

| # | Edge Case | Solution |
|---|-----------|----------|
| 1 | Empty/Invalid Task ID | Regex validation before use |
| 2 | Path Traversal Attack | Reject `..` and `/` in ID |
| 3 | ID Collision | `os.urandom(4)` via python3 (collision-free) |
| 4 | Invalid Date Parsing | JavaScript Date.parse() with NaN check |
| 5 | Meta.json Corruption | Write tool atomic writes, validate JSON |
| 6 | Large Content (>100KB) | Write tool handles any size natively |
| 7 | File Descriptor Leak | No FDs (Task tool manages) |
| 8 | Concurrent Generation | TaskCreate has built-in concurrency |
| 9 | Invalid jq Filter | No jq in command files (hook requires jq) |
| 10 | Symbolic Link Safety | Write tool path validation |
| 11 | Cross-Platform Dates | JavaScript Date (universal) |
| 12 | Lock Stale/Timeout | Not needed for commands (hook ops unprotected) |
| 13 | Cleanup Race Condition | RUNNING status + grace period |

## Workflow Diagram

```
User → /todo "feature" [--fast|--deep|--tactical]
    │
    ├── Step 0: Parse flags (set model, strip flags)
    ├── Step 1: Classify request
    ├── Step 2: Generate task ID (python3 || node)
    ├── Step 3: Write meta.json (Write tool - atomic)
    ├── Step 4: Create TaskCreate tracking
    │
    └── Step 5: Launch coordinator agent (background)
        │
        ├── Phase 0: Set status → RUNNING
        ├── Phase 1: Expand use cases → expansion.md
        ├── Phase 1.5: Validation gate (PROCEED/FLAG/HALT)
        ├── Phase 2: Research codebase (Glob/Grep)
        ├── Phase 3: Create implementation plan → plan.md
        ├── Phase 4: Write checklist → checklist.md
        └── Phase 5: Set status → READY
```
