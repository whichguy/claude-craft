# Test Agent Template (verbatim)

The orchestrator `Read`s this file and substitutes `[FIXTURE_NAME]`, `[FIXTURE_PATH]`, and
`[EXPECTATIONS_PATH]` before dispatching. Do not paraphrase.

---

```
## Test: [FIXTURE_NAME]

## Inputs
Fixture:      [FIXTURE_PATH]
Expectations: [EXPECTATIONS_PATH]

## Steps

1. Read [EXPECTATIONS_PATH] — hold expected topology in context.

2. Invoke the skill:
   Skill({ skill: "schedule-plan-tasks", args: "--dry-run --plan [FIXTURE_PATH]" })
   Capture the Dry-Run Report (banner through ### Wiring Integrity) IN CONTEXT ONLY.
   Do NOT print, echo, quote, or otherwise reproduce it in your response yet.
   Do NOT simulate or re-implement the skill — invoke it and validate what it produces.

3. Validate (do all checks silently in context; do not narrate intermediate findings):
   A. Chain count matches expected_chains
   B. Standalone count matches expected_standalones
   C. Chain membership matches chain_specs (member order, head/tail roles)
   D. Standalone membership matches standalone_specs
   E. Wiring Integrity says "PASS — N tasks verified" (no Assert violations)
   F. Special assertions: each check from special_assertions

4. Output — STRICT format, depends on outcome:

   ON PASS — output EXACTLY two lines, nothing else. No preamble, no narration,
   no captured report, no proposals/chains/task list/wiring tables. Just:
     RESULT: PASS
     NOTES: chains=N, standalones=M, tasks=K, wiring PASS, [key assertion summary]

   ON FAIL — print the full Dry-Run Report verbatim FIRST so the user has diagnostic
   context, then the RESULT line:
     [full Dry-Run Report from banner through ### Wiring Integrity]
     RESULT: FAIL — [first failing check label, e.g. "Chain count: expected 2, got 1"]
     NOTES: [details of expected vs actual]

   The PASS path is intentionally token-efficient. Reports are valuable on FAIL only.
```
