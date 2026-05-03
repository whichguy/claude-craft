# Test Agent Template — dry-run mode (verbatim)

The orchestrator `Read`s this file and substitutes `[FIXTURE_NAME]`, `[FIXTURE_PATH]`, and
`[EXPECTATIONS_PATH]` before dispatching. Do not paraphrase.

---

```
## Test (dry-run): [FIXTURE_NAME]

## Inputs
Fixture:      [FIXTURE_PATH]
Expectations: [EXPECTATIONS_PATH]

## Steps

1. Read [EXPECTATIONS_PATH] — hold expected wave structure and assertions in context.

2. Invoke the skill:
   Skill({ skill: "schedule-plan-tasks", args: "--dry-run --plan [FIXTURE_PATH]" })
   Capture the Simulated Execution Trace (banner through ### Validation) IN CONTEXT ONLY.
   Do NOT print, echo, quote, or otherwise reproduce it in your response yet.
   Do NOT simulate or re-implement the skill — invoke it and validate what it produces.

3. Validate (do all checks silently in context; do not narrate intermediate findings):
   A. Trace header: "## Simulated Execution Trace" present with "Mode: dry-run"
   B. Validation section: all 5 predicates show ✓ (none show ✗)
   C. Wave 1 run-agents: the first run-agent wave in the trace (Phase C dispatch) contains
      each entry from expected_first_run_agents (match by subject keyword, not exact string)
   D. Regression ordering: the regression task appears in the final wave — dispatched only
      after all chain-tail and standalone run-agents have appeared in the trace
   E. No unexpected failures: no agent row shows RESULT: failed unless expected_failures
      explicitly lists that agent's keyword
   F. Special assertions: each check from the special_assertions section

4. Output — STRICT format, depends on outcome:

   ON PASS — output EXACTLY two lines, nothing else. No preamble, no narration,
   no captured trace, no wave tables. Just:
     RESULT: PASS
     NOTES: waves=N, agents=M, validation all ✓, [key assertion summary]

   ON FAIL — print the full Simulated Execution Trace verbatim FIRST, then the RESULT line:
     [full Simulated Execution Trace from banner through ### Validation]
     RESULT: FAIL — [first failing check label, e.g. "Validation predicates: predicate 3 shows ✗"]
     NOTES: [details of expected vs actual]

   The PASS path is intentionally token-efficient. Traces are valuable on FAIL only.
```
