# Expectations: plan7-assert6-violation.md

## Topology summary
expected_chains: 0
expected_standalones: 1

## Chain detection rationale
- Phase 1 (Health Route): pred=0, succ=0 → standalone

## chain_specs
(none — 0 chains expected)

## standalone_specs
- "Phase 1: Add Health Route" (or equivalent subject containing "Health" or "health")

## special_assertions

A. Assert 6 (metadata.target_branch) — PRIMARY check for this fixture:
   The Wiring Integrity section must report PASS with NO Assert 6 violations.
   The delivery-agent task's ledger entry metadata.target_branch must be non-empty and
   non-placeholder (e.g. "main" or the current branch name — not "" or "[placeholder]").
   Fail if the Wiring Integrity section shows an Assert 6 violation for any delivery-agent.

B. Assert 7 (one create-wt per chain): no chains exist, so Assert 7 is vacuously satisfied.
   Verify the Wiring Integrity section does not report an Assert 7 violation.

C. Metadata presence check: in the ### Task Details section, find the delivery-agent entry for
   the Health Route task. Verify it shows a metadata block that includes:
     task_type: "delivery-agent"
     chain_id: null (or "none")
     chain_role: "none"
     isolation: "native worktree"
     target_branch: <non-empty, non-placeholder string>
   Fail if any of these fields are missing or have placeholder values.

D. Regression: verify a regression task exists blocked by the standalone delivery-agent.

E. Self-merge flag: the Health Route delivery-agent (standalone, Chain: none) must have
   Self-merge: yes in its Execution context.
   Fail if Self-merge: no or Self-merge is absent.
