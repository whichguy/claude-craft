# Test Agent Template (verbatim)

This file is the verbatim prompt dispatched to each test task agent. The orchestrator must
`Read` this file and substitute all `[PLACEHOLDER]` values before dispatching. Do not paraphrase.

---

```
## Test: [FIXTURE_NAME]

## Your task
Invoke the schedule-plan-tasks skill with --dry-run --plan flags on the fixture below,
then validate the Dry-Run Report against the expected topology. Report RESULT: PASS or FAIL.

## Inputs

Fixture (plan file): [FIXTURE_PATH]
Expected topology: [EXPECTATIONS_PATH]

## Instructions

### 1 — Load inputs
Read [EXPECTATIONS_PATH] — hold the expected topology in context.

### 2 — Invoke the skill

Use the Skill tool to run schedule-plan-tasks in dry-run mode:

  Skill({ skill: "schedule-plan-tasks", args: "--dry-run --plan [FIXTURE_PATH]" })

Wait for it to complete. The skill will output a Dry-Run Report containing:
  ### Proposals, ### Chains, ### Task List, ### Dependency Graph,
  ### Task Details (fully-substituted descriptions), ### Wiring Integrity

Capture that output. It is the artifact under test. Do not simulate or re-implement the
skill yourself — invoke it and validate what it produces.

### 2b — Print the Dry-Run Report

Copy the full Dry-Run Report from the skill output verbatim into your response — everything
from the `## schedule-plan-tasks — Mode: dry-run` banner through the end of
`### Wiring Integrity`. Do not summarize or truncate. This is the artifact the user
will spot-check.

### 3 — Validate

After the Dry-Run Report is printed, run these checks against it:

**A. Chain count**
Count distinct chain IDs in the ### Chains table (rows where Chain ID != "none").
Compare to `expected_chains` in [EXPECTATIONS_PATH]. Fail if count does not match.

**B. Standalone count**
Count rows in the ### Chains table where Chain ID == "none".
Compare to `expected_standalones` in [EXPECTATIONS_PATH]. Fail if count does not match.

**C. Chain membership**
For each chain listed in `chain_specs` in [EXPECTATIONS_PATH]:
  - Find the matching row in ### Chains by member subjects (keywords, not DRY IDs).
  - Verify the member order matches (head → links → tail).
  - Verify head and tail roles are correct in the Task Details section.
Fail if any chain's membership or roles are wrong.

**D. Standalone membership**
Verify each proposal in `standalone_specs` appears as a "none" row in ### Chains.
Fail if any expected standalone is assigned to a chain instead.

**E. Wiring Integrity**
The ### Wiring Integrity section must say "PASS — N tasks verified".
If it lists any Assert violations, fail and quote the violations.

**F. Special assertions**
Read `special_assertions` from [EXPECTATIONS_PATH] and execute each check.
These may include: regression blocker set, Regression Blocker Reduction, trivial override
task count, Assert 7 (one create-wt per chain), role fields, self-merge wrapper placement.

### 4 — Report

After all checks, print:

RESULT: PASS
NOTES: [brief summary — e.g. "chain-1 A→B detected; chain-2 E→F detected; 4 standalones; wiring PASS; regression blockers G,H only (F excluded)"]

OR

RESULT: FAIL — [first failing check label, e.g. "Chain count: expected 2, got 1"]
NOTES: [details of what was expected vs what the Dry-Run Report showed]
```
