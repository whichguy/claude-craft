# Simulate-Prefix Template (verbatim)

When the orchestrator runs `Mode: dry-run`, it dispatches each delivery-agent task with the
contents of this file PREPENDED to the task description. The prefix overrides the agent's
default behavior: simulate, do not execute, validate the protocol exchange.

The orchestrator must `Read` this file in full and paste it verbatim before the task
description. No paraphrasing.

---

```
## SIMULATE MODE — protocol validation only (do not execute real actions)

You are running in simulation mode for end-to-end protocol validation. The orchestrator
will read your status block to verify the agent ↔ orchestrator exchange works correctly.
You MUST NOT perform any real actions:

- No git commands (no rebase, merge, worktree, commit, push, pull)
- No file modifications (no Write, Edit, file creation/deletion)
- No external state changes (no Bash that writes/mutates anywhere)
- No real Agent dispatch (do NOT call the Agent tool)
- No TaskCreate (do NOT create the investigation task on simulated failure)
- No TaskUpdate to set status="completed" or status="failed" — the orchestrator handles this

You ARE allowed to:

- Read files (Read tool) for understanding what you would do
- Call TaskList({}) and TaskGet(id) — read-only inspection of the backlog
- Compute which dependents would be unblocked by your simulated completion (per the
  cascade-dispatch directive in ## On RESULT: complete in the description below)

## Your protocol

1. Read the original task description below.
2. For each step in `## What to do`, output one line:
     [SIM] would: <one-line description of the step>
3. For the cascade-dispatch directive in `## On RESULT: complete`:
     - Run the three gates (status==pending, [TASK_ID] in blockedBy, all other blockers
       completed) using TaskList/TaskGet — read-only.
     - Compute the list of would-be-dispatched task IDs.
     - DO NOT call Agent. DO NOT call TaskUpdate to claim them.
4. Emit the standard status block:
     RESULT:      complete
     WORK:        <one-line: what you would have produced>
     INCOMPLETE:  none
     FAILURE:     none
     ARTIFACT:    none
     DISPATCHED:  <comma-separated would-be-dispatched task IDs from step 3, or "none">

5. If the task description has obvious blockers (missing prerequisite file, ambiguous
   instructions, contradictions), emit:
     RESULT:      failed
     WORK:        <what would have been attempted>
     INCOMPLETE:  <what cannot be done>
     FAILURE:     <one of: no_change | partial_change | test_failures | conflict_needs_user | needs_split>
     ARTIFACT:    none
     DISPATCHED:  none
   DO NOT load investigation-task-template.md or call TaskCreate. The orchestrator records
   the would-be failure from your status block.

6. Return immediately after the status block. No further output.

---

## Original task description follows:

```
