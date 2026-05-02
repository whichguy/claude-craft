# Investigation Task Template (verbatim)

JIT-loaded by a failed run-agent (RESULT: failed) to create an investigation task in the
backlog. The orchestrator never reads this file directly; only the failing agent loads it
when emitting its failure record.

Substitute placeholders:
- `[PARENT_TASK_ID]`  — the failing run-agent's task ID
- `[PARENT_SUBJECT]`  — the failing run-agent's subject line
- `[FAILURE]`         — failure-type enum value (see table below)
- `[WORK]`            — what the failing agent achieved before stopping (matches WORK field of its status block)
- `[INCOMPLETE]`      — what the failing agent did NOT achieve (matches INCOMPLETE field of its status block)
- `[ARTIFACT]`        — preserved worktree path or "N/A"

## TaskCreate payload

```
TaskCreate({
  subject: "Investigate failure: [PARENT_SUBJECT]",
  metadata: {
    task_type: "investigation",
    parent_task: "[PARENT_TASK_ID]",
    failure: "[FAILURE]",
    artifact: "[ARTIFACT]"
  },
  description: """
    Parent task: [PARENT_TASK_ID] — [PARENT_SUBJECT]
    FAILURE:    [FAILURE]
    WORK:       [WORK]
    INCOMPLETE: [INCOMPLETE]
    ARTIFACT:   [ARTIFACT]

    ## Your job
    Diagnose the root cause. Then:
    - Recoverable → TaskCreate the recovery sub-tasks, dispatch all in parallel,
      wait for RESULT: complete from each, then mark this investigation completed.
    - Unrecoverable → mark this investigation completed with a clear explanation
      of why human intervention is required.
  """
})
```

## FAILURE → ARTIFACT-handling mapping

The failing agent uses this table to decide what to set in the ARTIFACT field of its
status block (and consequently what the investigation task records).

| FAILURE              | ARTIFACT handling                                                       |
|----------------------|-------------------------------------------------------------------------|
| no_change            | discard worktree (no useful state); set ARTIFACT: "none"                |
| partial_change       | preserve worktree; set ARTIFACT: <worktree path>                        |
| test_failures        | preserve worktree; set ARTIFACT: <worktree path>                        |
| conflict_needs_user  | preserve worktree always; set ARTIFACT: <worktree path>                 |
| needs_split          | set ARTIFACT: "none"; suggested sub-task breakdown belongs in WORK field |

## Behavior rules

- Failed tasks DO NOT cascade — downstream dependents stay pending. Orchestrator can
  enumerate them with: `TaskList({}) → filter status=pending AND blockedBy contains failed task ID`.
- The investigation task is a sibling, not a child. It exists to make the failure visible
  in the backlog and to dispatch a recovery agent if one is feasible.
- The orchestrator never re-dispatches the failed task. Recovery happens via the
  investigation task's own sub-task graph.
