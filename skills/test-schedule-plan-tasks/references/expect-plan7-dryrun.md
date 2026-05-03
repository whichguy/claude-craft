# Expectations (dry-run): plan7-assert6-violation.md

## Dry-run summary
expected_first_delivery_agents: ["Health"]
validation_all_pass: true
expected_failures: none

## Cascade rationale
Single standalone: Health Route. In dry-run, one create-wt is created and simulated in
Phase B. Once it completes, the Health delivery-agent unblocks → sole wave-1 dispatch.

After Health completes → Regression. Wave 2: Regression.

Expected cascade depth: 1 delivery-agent wave + regression.

## special_assertions

A. Assert 6 (target_branch) — DEFINITIVE TEST using real task metadata:
   Unlike plan-only mode where Assert 6 checks the in-memory ledger, in dry-run mode the
   Health Route delivery-agent task was created via real TaskCreate and the orchestrator calls
   TaskGet to retrieve its metadata. Assert 6 must PASS — metadata.target_branch in the
   real task record must be non-empty and non-placeholder.
   Fail if the Validation section shows ✗ for "DISPATCHED graph matches static topology"
   or if metadata.target_branch is empty/placeholder in the real task.

B. Wave 1 is singular: only the Health Route delivery-agent appears in wave 1. Regression must
   not appear in wave 1.
   Fail if Regression is dispatched before Health completes.

C. Validation all ✓: all 5 validation predicates must show ✓ in the ### Validation section.
   This fixture is the definitive positive-control test that Assert 6 infrastructure works
   end-to-end with real Task API (not just ledger checks).
   Fail if any predicate shows ✗.

D. RESULT: complete for Health: the Health Route delivery-agent must return RESULT: complete
   (not failed). There are no known blockers or ambiguities in the task description.
   Fail if Health agent returns RESULT: failed.

E. Trace header present: the output must contain "## Simulated Execution Trace" with
   "Mode: dry-run". Fail if the header is absent or uses a different mode label.
