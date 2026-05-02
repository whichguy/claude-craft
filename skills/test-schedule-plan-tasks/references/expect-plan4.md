# Expectations: plan4-trivial-mixed.md

## Topology summary
expected_chains: 0
expected_standalones: 3   (2 trivial, 1 non-trivial)

## Chain detection rationale
All three proposals are independent (no DEPENDS ON between them). All have succ=0 → none
are seeds → all collected as standalones.
- Phase 1 (Rename PORT): trivial → Isolation: none (trivial) in LIVE mode
- Phase 2 (Add .nvmrc): trivial → Isolation: none (trivial) in LIVE mode
- Phase 3 (Request Logger): non-trivial → Isolation: native worktree in both modes

## chain_specs
(none — 0 chains expected)

## standalone_specs
- "Phase 1: Rename PORT constant"  (keyword: "PORT" or "Rename")
- "Phase 2: Add .nvmrc"            (keyword: "nvmrc")
- "Phase 3: Request Logger"        (keyword: "Logger")

## special_assertions

A. Dry-run trivial override: in --dry-run mode, the trivial override rule is active. All 3
   proposals must be treated as non-trivial — each must generate a full create-wt → run-agent
   chain in the task ledger (Isolation: native worktree). Verify in ### Task List that all
   3 run-agents show Isolation: native worktree (not "none (trivial)").
   Fail if any run-agent shows Isolation: none (trivial).

B. Task count: in dry-run mode with trivial override, expected task count is:
   3 git-prep + 3 create-wt + 3 run-agent + 1 regression = 10 tasks.
   The plan itself notes "Dry-Run Note: Dry-run task count (10) differs from live (7)".
   Fail if the ### Task List header shows a count other than 10.

C. Assert 5 (Regression): regression must be blocked by all 3 run-agents (PORT, nvmrc, Logger).
   Fail if any run-agent is missing as a direct regression blocker.

D. Independence: no run-agent in the ### Task List should be blocked by another run-agent.
   All 3 run-agents are unblocked simultaneously once git-prep completes.
