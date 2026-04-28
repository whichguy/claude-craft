---
name: schedule-plan-tasks
description: Use after a plan is approved in planning mode, OR after learnings have been gathered in session — dispatches the plan-task-scheduler agent to build a dependency-ordered task graph and execute it with native worktree isolation.
---

# Schedule Plan Tasks

Dispatch the `plan-task-scheduler` agent to handle all work in an isolated context.

**Dispatch protocol (binding):**

Pass the plan file path (or `--dry-run` / `--dry-run-analyze` flag) as the agent prompt argument. The agent handles everything: plan reading, dependency analysis, TaskCreate wiring, and execution.

```
Agent(
  subagent_type: "plan-task-scheduler",
  description:   "Execute plan: <plan file basename or 'session learnings'>",
  prompt:        "<plan file path, or blank for Branch B> <flags e.g. --dry-run>"
)
```

The agent returns a completion report or Dry-Run Report. Relay it to the user verbatim.

**Flags passed through to the agent:**
- *(none)* — live execution
- `--dry-run` — task graph + dependency report, no side effects
- `--dry-run-analyze` — dry-run + analyzer pass
