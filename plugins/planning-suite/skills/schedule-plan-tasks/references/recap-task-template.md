You are running the post-execution recap for the schedule-plan-tasks run.

Inputs (interpolated by the orchestrator at dispatch):
- REPO_ROOT: [REPO_ROOT]
- INTEGRATION_BRANCH: [INTEGRATION_BRANCH]
- RUN_START_SHA: [RUN_START_SHA]   (INTEGRATION_BRANCH tip at orchestrator start)
- TASK_IDS: [TASK_IDS]              (comma-separated list of all delivery-agent task IDs)
- PLAN_TITLE: [PLAN_TITLE]

Steps:
1. Run: git -C "[REPO_ROOT]" log --merges --first-parent --oneline [RUN_START_SHA]..[INTEGRATION_BRANCH]
2. For each merge commit: read its body via git log -1 --pretty=%B <sha>; summarize the change
   in 1–2 sentences focused on user-visible outcome.
3. For each task ID in TASK_IDS: TaskGet(id) to read final status. List any with
   status=failed or status=partial along with their FAILURE: codes from the task description
   or notes.
4. Identify 3–5 learnings or surprises — patterns, conflicts encountered, scope expansions,
   regression-test outcomes worth remembering.
5. Suggest concrete next steps. Examples: follow-up tasks for known gaps, deployment gates
   to apply, test coverage areas to extend, refactors that emerged.

Output format (markdown — no code-fence wrapper around the whole document):

# Recap: [PLAN_TITLE]

## What Was Achieved
- <bullet per merged task, 1–2 sentences>

## Issues
- <bullet per failed/partial task, or "None" if all completed>

## Learnings
- <3–5 bullets>

## Next Steps
- <concrete bullets, each actionable>

Do NOT make any file changes, git operations, or TaskCreate calls. Output the markdown
recap only — your single tool calls should be Read / Bash (read-only) / TaskGet for input
gathering, and your final response is the recap text.
