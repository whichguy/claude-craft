---
name: tasks
description: |
  Break down features into step-by-step implementation tasks. Dispatches to
  feature-task-creator agent for complex decomposition.

  AUTOMATICALLY INVOKE when:
  - "break this down", "create tasks", "plan implementation", "decompose"
  - "what steps", "task list", "how do I implement this"
  - Large feature requests without clear action items

  NOT for: Architecture decisions (use /architect), actual implementation (use /develop)
argument-hint: "<feature-description>"
allowed-tools: all
---

# /tasks — Task Breakdown

Break down features into implementable tasks. Quick decomposition inline;
complex multi-phase breakdown via agent.

## Step 0 — Parse Arguments

From the invocation args, extract:
- **feature**: The feature or epic to decompose
- **--detailed**: Include acceptance criteria and test requirements per task
- **context**: Any architecture docs, specs, or prior planning

If no feature description, ask what to break down.

## Step 1 — Triage

**Fast path** (inline checklist):
- 2-3 obvious implementation steps
- Single-concern feature with clear scope
- Proceed to Step 2

**Agent path** (full decomposition):
- Complex feature spanning multiple files/modules
- Unclear scope requiring investigation
- Feature needing phased implementation
- Proceed to Step 4

## Step 2 — Inline Task List

Generate a numbered task checklist:

```
## Tasks: [Feature Name]

1. [ ] [Task description] — [file/module affected]
2. [ ] [Task description] — [file/module affected]
3. [ ] [Task description] — [file/module affected]

**Estimated scope**: [small/medium/large]
**Dependencies**: [any prerequisites]
```

Each task should be independently implementable and testable.

## Step 3 — Create Trackable Tasks

When the task breakdown produces 3+ tasks, create them as real TaskCreate entries
so they persist and can be tracked across sessions:

For each task in the breakdown:
```
TaskCreate({
  subject: "[Task description]",
  description: "[Detailed description with file/module context]",
  activeForm: "[Present continuous form, e.g., 'Implementing auth module']"
})
```

Set `blockedBy` relationships for any dependent tasks via TaskUpdate.

Print: "Created [N] trackable tasks. Use /develop [task] to start implementing."

## Step 4 — Agent Dispatch

```
Use the Agent tool:
  subagent_type: "feature-task-creator"
  prompt: "Break down this feature into implementable tasks: [feature description].
           Context: [architecture docs, specs found].
           [If --detailed: include acceptance criteria and test requirements per task.]
           After generating the task list, create each task using TaskCreate with activeForm spinners and blockedBy dependencies.
           Output tasks in priority order with dependencies noted."
```

## Step 5 — Post-Processing

After task breakdown:
- Present the task list
- Identify any tasks that can run in parallel
- Suggest: "Run /develop [task] to start implementing" or "Run /architect to design first"
