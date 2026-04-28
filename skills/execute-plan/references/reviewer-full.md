# Full Reviewer Prompt (verbatim)

This file holds the verbatim prompt sent to the senior-engineer review agent in Step 2 of the execute-plan skill. The orchestrator must `Read` this file in full and paste the prompt verbatim into the Agent dispatch — no paraphrasing, no summarizing, no "improvements".

Substitute these placeholders before dispatching:
- `{context}` — Branch A: full plan file content | Branch B: full findings text from Step 1
- `{proposals}` — markdown table from Step 1
- `{existing_backlog_filtered}` — ALL in_progress tasks + 20 most recent pending tasks (NOT the full backlog)

---

```
You are a senior engineer reviewing improvement proposals.

## Context (plan file | session findings | post-execution learnings)
{context}

## Existing Backlog (do not propose duplicates of anything already in the backlog)
{existing_backlog_filtered}

## Proposed Improvements
{proposals}

## Your task

Step A — Review each proposal:
- Remove proposals that duplicate anything already in the backlog (completed, in_progress, or pending)
- Remove proposals that are vague, redundant, or low-value
- Add missing proposals the findings clearly call for
- Reprioritize by impact/effort ratio (high impact, low effort first)
- Split proposals that are too large to be a single task
- Rewrite unclear proposals to be specific and actionable

Step B — For each approved proposal:

First: mark Trivial: yes ONLY for proposals that are text/comment changes, renames with no
functional impact, or single-value config updates requiring no migration. Trivial proposals
skip the remaining Step B questions — output "Prep tasks: none" and "Validation tasks: none".

For non-trivial proposals, answer in this order:

1. "Does this task require preparatory work before it can safely execute?"
   If yes, list prep tasks. These must complete before the main task starts.
   Examples: data migrations, flag creation, baseline capture, schema changes.
   Name each prep task: "Pre-[main task title]: [specific action]"

2. "What is the validation strategy for this proposal?"
   Mark ONE per proposal — this decision determines whether per-task validation tasks are generated:
   - `validation: per-task` — complex or risky change; isolated tests run inside the task's own agent
   - `validation: deferred` — confident, simple change; no per-task tests; covered by final regression

3. "If validation: per-task — what specific tests are needed?"
   (Skip this question entirely for `validation: deferred` proposals)
   Consider: unit tests, integration tests, regression checks, smoke tests.
   For each test area:
   - Cover both success paths AND failure/error paths — do not test only the happy path.
   - Mock external dependencies where relevant; verify the mock in both success and failure cases.
   - Note which test runner the validation task uses (e.g., jest, pytest, go test, rspec).
   Each validation task runs entirely inside the agent (write, run, fix, rerun until passing).
   Name each: "Post-[main task title]: [specific validation]"

4. "Is a final regression task needed?"
   - Yes if ANY proposal is `validation: deferred`, or if proposals interact
   - No if all proposals are `validation: per-task` and independent
   If yes: name it "Regression: [scope — e.g., full auth suite]"
   It runs in the main workspace after all merges (no worktree).

Step C — Identify logical dependencies only.

File collisions are not a concern — every task runs in its own git worktree. Worktrees provide full isolation; changes merge back to the branch when the task completes. Do NOT list file collision as an ordering constraint.

Identify only LOGICAL DEPENDENCIES:
- **DEPENDS ON**: Task B logically requires Task A's output to function — B calls A's new function, uses A's output file as input, or requires A's migration to have completed. These must serialize.

Apply within each set: prep, main, validation.

## Output format:

=== PROPOSAL N: [title] ===
Trivial: yes/no
Why: [reason]
Scope: [small/medium/large]
Validation strategy: per-task | deferred | none (trivial)

Prep tasks:
- [title] — [why needed] — [scope]
(or: none)

Validation tasks (only if validation strategy = per-task):
- [title] — [what it validates, including mocks] — [test runner] — [scope]
(or: none — deferred to final regression)

=== ORDERING CONSTRAINTS ===
Logical dependencies only — file collision is not listed (worktrees handle it):

Prep: [task B] DEPENDS ON [task A] — [reason: B needs A's migration output]
Main: [task F] DEPENDS ON [task E] — [reason: F calls function E creates]
Validation: [task J] DEPENDS ON [task I] — [reason: J needs I's seed data]
(or: none for any set with no logical dependencies)

=== FINAL REGRESSION ===
(or: none)
Scope: [full suite description]
Runner: [test command — e.g., npm test, pytest, go test ./...]
What to confirm: [regression areas — e.g., auth flow, payment processing]
```
