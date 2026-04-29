# Dry-Run Analyzer Prompt (verbatim)

This file holds the verbatim prompt sent to the analyzer agent in Step 4 of the execute-plan skill when `Mode == dry-run-analyze`. The orchestrator must `Read` this file in full and paste the prompt verbatim into the Agent dispatch — no paraphrasing, no summarizing, no "improvements".

Substitute these placeholders before dispatching:
- `{report}` — the full Dry-Run Report just printed at end of Step 4 (proposals table, ordered task list with blocked-by/unblocks columns, dependency graph, full task descriptions, wiring integrity result)

---

```
You are a senior engineer auditing a dry-run of the execute-plan skill.

The orchestrator just built a task graph in dry-run mode: it read the plan (Branch A) or generated proposals from session context (Branch B), ran the task graph construction (single topological pass with inline blockedBy) entirely in memory without creating real Tasks, and printed an ordered task list with a dependency graph. No real work happened. Your job is to audit that graph and flag wiring errors, missing dependencies, mis-classified isolation, missing regression coverage, and anti-patterns BEFORE the user invokes this skill in live mode.

## Dry-Run Report

{report}

## Your task

Evaluate the report on these dimensions. For each finding, emit one row in the findings table at the end.

### 1. Graph correctness
- Every task in the simulated backlog must reach `completed` in the simulated trace. Orphans (never dispatched) → BLOCKING.
- No cycles — the trace must terminate. If the simulated loop reported STUCK, that is BLOCKING.
- The Wiring Integrity section says PASS. If it lists violations, mirror them as BLOCKING findings.
  Note: In the self-merge model, the valid asserts are 3, 4, 5, 6, 7, 8. Assert 1 and Assert 2 no longer exist — do not flag their absence.

### 2. Dependency completeness
- Every worktree run-agent task description must contain a `Target branch:` field with a non-placeholder value (Assert 6 covers this; restate any violation as BLOCKING).
- Logical DEPENDS ON hints from the plan should be honored: if proposal #N said "requires #M", verify the ledger has the run-agent for #N blocked by the run-agent for #M. Create-wt tasks are NOT expected to carry DEPENDS ON blockers (rule 8 applies to run-agents only).
- There is no global Merge chain in the self-merge model — run-agents self-merge sequentially via the DEPENDS ON dependency graph. If two run-agents appear to run in parallel without a DEPENDS ON relationship and they touch the same file, flag ADVISORY (see dimension 6).

### 3. Missing tasks
- If a proposal in the proposals table did NOT generate a run-agent ledger entry, flag BLOCKING (unless reviewer marked it Removed).
- If the plan has a Verification section / Branch B reviewer suggested regression scope, but no Regression task is wired at the end of the chain → BLOCKING.
- If a non-trivial proposal has no Create worktree (or its chain's create-wt is missing) → BLOCKING.
- If a chain (≥ 2 members) has more than one create-wt task → BLOCKING (Assert 7 violation: chain-link/tail has its own create-wt — should share the chain's single create-wt).

### 4. Isolation classification
- Trivial run-agents (`Isolation: none (trivial)`) should only be used for genuinely trivial proposals (rename, comment, single-line config). Inspect each trivial entry's subject + description.
- A worktree-isolated task that touches one file with a one-line change is overkill → INFO (not blocking).
- A trivial-classified task that touches multiple files or > ~20 lines of logic → ADVISORY (likely should be worktree).

### 5. Regression coverage
- If the plan / reviewer output names regression scope, the Regression task description must reference the right runner and scope. Empty NOTES or generic "run tests" → ADVISORY.
- Regression must be blocked by ALL chain-tail run-agents and ALL standalone run-agents. Chain-head and chain-link run-agents are NOT valid direct regression blockers.
  - Missing any chain-tail or standalone blocker → BLOCKING.
  - Regression directly blocked by a chain-head or chain-link run-agent → BLOCKING.

### 6. File-overlap risk
- Check the task descriptions for shared file paths: if two run-agent tasks both mention the same file path in their descriptions, their merges will likely conflict → ADVISORY.
- Three or more run-agents touching the same file → ADVISORY (consider serializing via DEPENDS ON).

### 7. Chain wiring integrity
- Every chain's create-wt must be blocked by `Setup .worktrees` (plus any upstream tail/standalone run-agent IDs from DEPENDS ON constraints). Assert 3 covers this; restate any violation.
- A create-wt blocked only by `Setup .worktrees` is valid for chains/standalones with no upstream DEPENDS ON.
- Assert 7: each chain-N must have exactly one create-wt (owned by the head). If a chain-link or chain-tail task has its own create-wt, flag BLOCKING.
- Assert 8: each run-agent task description must contain "exactly one `git commit`" in its ## Before return: commit section. Missing → BLOCKING.

### 8. Plan-specific anti-patterns
- Schema / DB migration tasks should be gated by an explicit prep task (backup, dry-run-migration). Migration run-agent without backup prep → ADVISORY.
- Env-var / config changes without an obvious rollback in the description → ADVISORY.
- Tasks that delete code without a corresponding test update reference → INFO.

## Output format

End your response with EXACTLY this table — one row per finding, severity in {BLOCKING, ADVISORY, INFO}. If you find no issues, emit a single row with severity INFO and finding "No issues detected.".

| Severity | Dimension | Task IDs    | Finding                                                                |
|----------|-----------|-------------|------------------------------------------------------------------------|
| BLOCKING | 3         | DRY-7       | Proposal #4 (Add OpenTelemetry) has no run-agent in the ledger.        |
| ADVISORY | 6         | DRY-8,DRY-9 | Both run-agents touch src/auth/session.ts in iteration 6 — likely conflict. |
| ...      | ...       | ...         | ...                                                                    |

Then a one-line verdict:
  VERDICT: <READY-TO-EXECUTE | NEEDS-FIXES> — <one-line summary>

Be terse. Cite specific DRY-N IDs. Do not propose code changes; only describe what is wrong with the simulated graph.
```
