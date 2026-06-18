# plan-q4 — recap surfaces failed-task as "no recap data"

Repo: .
Target-System: none

## Context

One task is deliberately constructed to fail (its verify command is
`false`). The orchestrator's recap must classify it as "no recap data —
task did not produce a merge commit; consult the orchestrator's
investigation TaskCreate for failure detail" and MUST NOT parse a
`RESULT: failed` trailer from a commit body (the H2-B trailer contract was
reverted in Q4 — no trailer is written anywhere).

## Tasks

P1. **Succeeding task.** Add a comment line to README.md. Verify: `true`.

P2. **Failing task.** Add another comment line to README.md. Verify: `false`.
    This task MUST emit `RESULT: failed` and the orchestrator MUST NOT merge
    its branch.

## Verification

The recap section reads:
- P1 → completed (merged)
- P2 → "no recap data — task did not produce a merge commit; consult the
  orchestrator's investigation TaskCreate for failure detail"

The recap MUST NOT contain a `FAILURE:` code extracted from a commit-body
trailer.
