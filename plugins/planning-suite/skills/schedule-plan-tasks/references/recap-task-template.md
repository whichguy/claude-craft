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
3. Re-source completion state from the merge log + per-merge-commit bodies (do NOT rely on
   TaskGet — Task tools may not be available in this subagent's environment). For each task ID
   in TASK_IDS:

   **Locate the task's commit data.**
   - **Chain-tail and standalone tasks:** look for a top-level merge commit on
     `[INTEGRATION_BRANCH]` whose subject contains the task's worktree branch
     (`task-N-branch` or `chain-K-branch`). Read its body via `git log -1 --pretty=%B <sha>`.
   - **Chain head and link tasks:** there is NO standalone merge commit for these — only
     the chain's tail produces one. Look INSIDE the chain-tail merge commit body for the
     head/link's commit subject. The orchestrator's `do_merge()` (SKILL.md ORCHESTRATOR_MERGE_ALGORITHM)
     appends the full chain log to the tail merge body via
     `git log --reverse --pretty='format:--- %s%n%b%n' "$MERGE_TARGET..$WORKTREE_BRANCH"`,
     so head/link results land there.

   **Classify each task:**
   - Merge commit (or chain log entry) present → mark `completed`.
   - No merge commit on integration branch AND no chain-log entry inside a tail merge for
     this task → mark `no recap data — task did not produce a merge commit; consult the
     orchestrator's investigation TaskCreate for failure detail`. The orchestrator does
     not merge failed-task branches, so absent-merge is the primary "task did not complete"
     signal. Do not fabricate a status, and do not parse commit-body trailers — the
     investigation TaskCreate is the durable failure record.

   List any task whose status is `no recap data` with the cited source ("no commit data —
   see orchestrator investigation task").
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
recap only — your single tool calls should be Read / Bash (read-only) for input gathering,
and your final response is the recap text.
