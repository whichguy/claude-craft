---
name: bg
description: "Fire-and-forget async task with automatic implementation"
---

# /bg - Fully Fire-and-Forget (Task-Native v2)

Launch a task that runs entirely in the background. Agent implements automatically.

## Usage

```
/bg <request> [--fast|--deep]
```

## Flags

- `--fast` - Use Haiku for all phases (faster, cheaper)
- `--deep` - Use Sonnet/Opus (default, higher quality)

## When to Use /bg vs /todo

| Scenario | Use |
|----------|-----|
| Trust agent to make implementation decisions | `/bg` |
| Task is well-defined with clear requirements | `/bg` |
| Want to work on other things while this runs | `/bg` |
| No user decisions needed during implementation | `/bg` |
| Want to review plan before implementation | `/todo` |
| Task requires user decisions or preferences | `/todo` |
| Want to implement it yourself | `/todo` |
| Task is ambiguous or needs clarification | `/todo` |

## Execution Protocol

When the user invokes `/bg <request>`:

### Step 0: Parse Flags

Extract flags from the request string:

```
1. Check for --fast flag → set model = 'haiku', remove flag from request
2. Check for --deep flag → set model = 'sonnet', remove flag from request
3. If no flag specified → default model = 'sonnet'
4. Store cleaned request (without flags) as originalRequest
```

### Step 1: Generate Task ID and Create Directory

Use Bash to generate a collision-free ID:

```bash
# Primary: python3 (available on macOS and most Linux)
python3 -c "import time, os; print(f'{int(time.time()*1000)}-{os.urandom(4).hex()}')" 2>/dev/null || \
# Fallback: node.js
node -e "console.log(Date.now()+'-'+require('crypto').randomBytes(4).toString('hex'))"
```

Validation rules:
- Must match pattern: `/^[0-9]{13}-[a-f0-9]{8}$/`
- Must NOT contain `..` or `/`

Create task directory:

```bash
mkdir -p ~/.claude/async-prep/{task-id}
```

Expected directory structure after agent completes:
```
~/.claude/async-prep/{task-id}/
├── meta.json
├── expansion.md
├── plan.md
├── implementation.log
├── review.md
└── checklist.md
```

### Step 2: Write meta.json

```json
{
  "version": "2.0",
  "task_id": "{task-id}",
  "title": "{title}",
  "original_request": "{original_request}",
  "classification": "IMPLEMENT",
  "status": "PENDING",
  "timeout_at": "{now + 7 days ISO}",
  "cleanup_at": "{now + 30 days ISO}",
  "created_at": "{now ISO}",
  "implementation": "task-native-v2"
}
```

### Step 3: Create Native Task Tracking

```javascript
TaskCreate({
  subject: `[BG] ${title}`,
  description: `Fire-and-forget: ${originalRequest}`,
  activeForm: `Background: ${title}`
})
```

### Step 4: Launch Full Pipeline Agent

Launch a background agent that handles the ENTIRE pipeline:

```javascript
Task({
  subagent_type: 'general-purpose',
  run_in_background: true,
  model: model,  // Set in Step 0: 'sonnet' (default/--deep) or 'haiku' (--fast)
  description: `Full pipeline: ${title}`,
  prompt: `
You are a fire-and-forget task executor. You will:
1. Set status to RUNNING
2. Expand use cases
3. Validate request
4. Research codebase
5. Plan implementation
6. IMPLEMENT the feature
7. Run quality review
8. Write completion summary
9. Update status

## Context
- Task ID: ${taskId}
- Task Dir: ~/.claude/async-prep/${taskId}/
- Original Request: ${originalRequest}
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

Generate comprehensive use case analysis:
- Core goal
- Use case scenarios (3-5)
- Edge cases (3-5)
- Acceptance criteria
- Non-functional requirements

Write to: ~/.claude/async-prep/${taskId}/expansion.md

## Phase 1.5: Validation Gate

Before proceeding, validate:

1. **Objective Clarity**: Is the objective clear enough to implement? If not → update meta.json status to "FLAG_FOR_CLARIFICATION", write concerns to expansion.md, stop.
2. **Ambiguity Check**: Critical ambiguities requiring user input? If yes → FLAG_FOR_CLARIFICATION.
3. **Conflict Check**: Conflicts with existing patterns? If yes → document in expansion.md.
4. **Destructive Check**: Is this destructive or irreversible? If yes → update meta.json status to "HALT", document why, stop.

If all checks pass → PROCEED.

## Phase 2: Codebase Research

Search the codebase for:
- Existing patterns to follow
- Files that will need modification
- Dependencies and integration points
- Similar implementations

Use Glob and Grep. Incorporate findings into the plan.

## Phase 3: Implementation Planning

Create step-by-step implementation plan:
- Summary
- Files to modify/create
- Implementation steps
- Risk assessment
- Rollback plan

Write to: ~/.claude/async-prep/${taskId}/plan.md

## Phase 4: IMPLEMENTATION

**CRITICAL**: Actually implement the feature.

For each step in your plan:
1. Read the relevant files
2. Make the changes using Edit tool
3. Log progress to ~/.claude/async-prep/${taskId}/implementation.log
4. Verify the change works

**TOOLS AVAILABLE**: Read, Write, Edit, Grep, Glob, Bash

**LIMITATIONS**: No MCP tools (mcp__gas__*, etc). Use file-based operations only.

If implementation requires MCP tools, document this in implementation.log and write to checklist.md requesting user completion.

## Phase 5: Quality Review

After implementation, review your changes:

1. **Quality Standards**: Do changes meet quality standards?
2. **Corner Cases**: Are there corner cases missed?
3. **Unintended Consequences**: Any breaking changes or security concerns?
4. **Secondary Effects**: Impact on related features?
5. **Suggested Improvements**: Any enhancements to recommend?

If issues found:
- Fix them immediately
- Re-review (max 3 iterations)

Write review results to: ~/.claude/async-prep/${taskId}/review.md

## Phase 6: Write Completion Summary

Write completion checklist to ~/.claude/async-prep/${taskId}/checklist.md

Format:
\\\`\\\`\\\`markdown
# [COMPLETED] ${title}

Task: ${taskId}
Full details: ~/.claude/async-prep/${taskId}/

## Summary
[2-3 sentence summary of what was implemented]

## Changes Made
- [x] [File 1]: [Change description]
- [x] [File 2]: [Change description]
...

## Quality Review
Status: APPROVED / APPROVED_WITH_NOTES
Notes: [Any review notes]

## Acceptance Criteria
- [x] [Criterion 1]
- [x] [Criterion 2]
...

## Follow-up Items (if any)
- [ ] [Any items requiring user attention]
\\\`\\\`\\\`

## Phase 7: Update Status

Update meta.json:
- status: "COMPLETED" (if successful) or "NEEDS_USER_ACTION" (if MCP required)
- completed_at: ISO timestamp
- implementation_summary: brief summary

## Error Handling

If any phase fails:
1. Update meta.json status to "FAILED" (prioritize this write)
2. Write error to ~/.claude/async-prep/${taskId}/error.log
3. Write partial checklist to checklist.md with failure status
4. Continue attempting remaining phases if possible

## Important Notes

- **No MCP tools available**: If feature requires MCP tools, note this and request user completion
- **Be conservative**: When uncertain, document rather than guess
- **Rollback on critical errors**: If implementation breaks something, use rollback plan
- **Log everything**: implementation.log should show complete history
`
})
```

### Step 5: Provide User Feedback

Output immediately:

```
Fire-and-forget started: ${title}
Task: ${taskId}

Agent will:
1. Expand use cases + validate
2. Research codebase
3. Plan implementation
4. Implement feature
5. Run quality review
6. Fix any issues

When complete, summary at ~/.claude/async-prep/${taskId}/checklist.md
Continue working on other tasks.
```

## Workflow Diagram

```
User → /bg "feature" [--fast|--deep]
    │
    ├── Step 0: Parse flags (set model)
    ├── Step 1: Generate task ID (python3 || node)
    ├── Step 2: Write meta.json
    ├── Step 3: Create TaskCreate tracking
    │
    └── Step 4: Launch full pipeline agent (background)
        │
        ├── Phase 0: Set status → RUNNING
        ├── Phase 1: Expand use cases
        ├── Phase 1.5: Validation gate (PROCEED/FLAG/HALT)
        ├── Phase 2: Research codebase
        ├── Phase 3: Plan implementation
        ├── Phase 4: IMPLEMENT (Edit files)
        ├── Phase 5: Quality review (max 3 iterations)
        ├── Phase 6: Write completion → checklist.md
        └── Phase 7: Set status → COMPLETED
```

## Background Agent Limitations

Background agents have these constraints:
1. **No MCP tools**: Cannot use mcp__gas__*, mcp__chrome-devtools__*, etc.
2. **No nested agents**: Cannot spawn subagents
3. **No interactive prompts**: Permission requests auto-fail
4. **Available tools**: Read, Write, Edit, Grep, Glob, Bash

If the feature requires MCP tools, the agent will:
- Document what MCP operations are needed
- Write manual steps to checklist.md for user
- Set status to "NEEDS_USER_ACTION"

## Key Differences from /todo

| Aspect | /todo | /bg |
|--------|-------|-----|
| Implementation | User does it | Agent does it |
| Review timing | After user implements | Immediately after agent implements |
| MCP availability | User has MCP | Agent has no MCP |
| Use case | User wants control | User trusts agent |
| Result | Checklist for user | Completed implementation |
