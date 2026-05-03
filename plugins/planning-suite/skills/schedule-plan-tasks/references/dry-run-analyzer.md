# Dry-Run Analyzer Prompt (verbatim)

This file holds the verbatim prompt sent to the analyzer agent in Step 4 of the execute-plan skill when `Mode == dry-run-analyze`. The orchestrator must `Read` this file in full and paste the prompt verbatim into the Agent dispatch — no paraphrasing, no summarizing, no "improvements".

Substitute these placeholders before dispatching:
- `{report}` — the full Dry-Run Report just printed at end of Step 4 (proposals table, ordered task list with blocked-by/unblocks columns, dependency graph, full task descriptions, wiring integrity result)

---

```
You are a senior engineer auditing a dry-run of the execute-plan skill.

The orchestrator just built a task graph in dry-run mode: it read the plan (Branch A) or generated proposals from session context (Branch B), ran the task graph construction (two-phase TaskCreate and TaskUpdate pass) entirely in memory without creating real Tasks, and printed an ordered task list with a dependency graph. No real work happened. Your job is to audit that graph and flag wiring errors, missing dependencies, mis-classified isolation, missing regression coverage, and anti-patterns BEFORE the user invokes this skill in live mode.

## Dry-Run Report

{report}

## Your task

Evaluate the report on these logical dimensions to judge if the results are proper. For each finding, emit one row in the findings table at the end.

### 1. Breadth: Full Coverage of the Plan
- Every logical area of the plan must be addressed by at least one task. If a feature mentioned in the plan has no corresponding task, flag BLOCKING.
- If a proposal in the proposals table did NOT generate a delivery-agent ledger entry, flag BLOCKING (unless reviewer marked it Removed).
- Check for "Global Wrap-up": if the plan implies a final integration or cleanup phase, is there a task for it?

### 2. Depth: Substantial and Complete Work
- **The "Goldilocks" Rule:** Inspect each task description. Is it logically substantial (a complete unit of work) or just a partial edit? Tasks that are too shallow (e.g., editing one variable without updating its usage) → ADVISORY.
- **Verification Depth:** Every non-trivial task should ideally have its own `per-task` validation steps. If a complex task has `validation: deferred`, check if this depth is sufficient given the risk.
- **External Resources:** If a task requires external datasets or environment state mentioned in the plan, are they symlinked or listed in the `External resources` field?

### 3. Conflicts: Parallel Isolation & Shared Files
- **Shared-File Collision Detection:** Check the task descriptions for shared file paths. If two delivery-agent tasks without a DEPENDS ON relationship both modify the same file, flag it as a **Critical Merge Conflict Risk** → BLOCKING.
- Three or more parallel delivery-agents touching the same directory → ADVISORY (risk of secondary conflicts).

### 4. Sequencing: Dependency Graph Integrity
- **Parent/Child Serialization:** Validate that downstream tasks do not fork their worktrees until their upstream dependencies have successfully merged. Specifically:
  - Check that a child's `create-wt` task is blocked by its parent's `delivery-agent` task.
  - Verify that `ID_cwt_N` (create worktree) is correctly wired to wait for all upstream tail/standalone delivery-agent IDs.
- **Topological Pass:** Ensure there are no cycles. Every task must reach `completed` in the simulated trace. Orphans (never dispatched) → BLOCKING.

### 5. Graph Correctness & Wiring Integrity
- The Wiring Integrity section must say PASS. If it lists violations (Assert 3, Assert 5, Assert 6, Assert 7, Assert 8), mirror them as BLOCKING findings.
  Note: Assert 1 and Assert 2 were removed in a prior version and no longer exist in the wiring checks.
- **Assert 5 (Regression):** Regression must be blocked by ALL chain-tail delivery-agents and ALL standalone delivery-agents. Chain-head and chain-link delivery-agents are NOT valid direct regression blockers.
- **Assert 7 (Chain integrity):** Exactly one create-wt exists per chain. Chain tail members must not have their own separate create-wt task.

### 6. Isolation Classification
- Trivial delivery-agents (`Isolation: none (trivial)`) should only be used for genuinely trivial proposals.
- A trivial-classified task that touches multiple files or > ~20 lines of logic → ADVISORY.
- A worktree-isolated task that touches one file with a one-line change is overkill → INFO.

### 7. Plan-Specific Anti-patterns
- Schema / DB migration tasks should be gated by an explicit prep task.
- Env-var / config changes without an obvious rollback or verification → ADVISORY.
- Tasks that delete code without a corresponding test update reference → INFO.

## Output format

End your response with EXACTLY this table — one row per finding, severity in {BLOCKING, ADVISORY, INFO}. If you find no issues, emit a single row with severity INFO and finding "No issues detected.".

| Severity | Dimension | Task IDs    | Finding                                                                |
|----------|-----------|-------------|------------------------------------------------------------------------|
| BLOCKING | 3         | DRY-7       | Proposal #4 (Add OpenTelemetry) has no delivery-agent in the ledger.        |
| ADVISORY | 6         | DRY-8,DRY-9 | Both delivery-agents touch src/auth/session.ts in iteration 6 — likely conflict. |
| ...      | ...       | ...         | ...                                                                    |

Then a one-line verdict:
  VERDICT: <READY-TO-EXECUTE | NEEDS-FIXES> — <one-line summary>

Be terse. Cite specific DRY-N IDs. Do not propose code changes; only describe what is wrong with the simulated graph.
```
