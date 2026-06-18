# LLM-exchange harness

Static prose tests in `../*.test.js` verify the schedule-plan-tasks contracts
**were written**. The tests here verify an LLM **actually follows** the
contracts when given the updated prompts. They are slow (live model calls),
opt-in, and not run by `npm test`.

## Why this exists

Several Q1–S6 fixes change *prompts*, not code. A prose-only test that
asserts the new prompt contains "SYNTHESIS MODE — OVERRIDES BODY" doesn't
tell us whether a model reading both the override AND the body it overrides
correctly resolves the contradiction. Behavioral verification requires
running the model and inspecting the exchange.

## Coverage

| Fix | Fixture | Harness | Asserter |
|---|---|---|---|
| Q3 (manual-resolve dispatch) | `fixtures/q3-additive-conflict.md` | `/test-schedule-plan-tasks --fixture <path>` (live mode) | `asserts/q3.sh` |
| Q4 (recap on failed task) | `fixtures/q4-failed-task-recap.md` | `/test-schedule-plan-tasks --fixture <path>` (live mode) | `asserts/q4.sh` |
| Q6 (synthesis preamble override) | `fixtures/q6-synthesis-preamble.md` | direct `Agent({subagent_type: "general-purpose", prompt: <preamble + body>})` — single dispatch, cheapest fixture | `asserts/q6.sh` |
| S1 (CWD deploy uses swap_and_restore) | `fixtures/s1-cwd-deploy.md` | `/test-delivery-agent --fixture <path>` | `asserts/s1.sh` |

## Run protocol

The harness is **manual-trigger** because each fixture costs real model
time. In a Claude Code session at the repo root:

```
# Q6 (cheapest — single agent, ~30s)
/test-delivery-agent --fixture test/plugins/planning-suite/schedule-plan-tasks/llm-exchange/fixtures/q6-synthesis-preamble.md
# Capture the printed transcript to a file (the skill prints verbatim):
#   redirect via the user copying the output to transcripts/q6-<timestamp>.txt
bash test/plugins/planning-suite/schedule-plan-tasks/llm-exchange/asserts/q6.sh transcripts/q6-<timestamp>.txt
```

For Q3/Q4 (orchestrator-level), invoke
`/planning-suite:test-schedule-plan-tasks` with `--fixture <q3 or q4 plan path>`
in live mode. The harness prints the full per-wave exchange; save to
`transcripts/<fix>-<timestamp>.txt`, then run the corresponding `asserts/*.sh`
to verify contract markers landed.

## Inspecting transcripts

`transcripts/` is gitignored intentionally — captured exchanges are
session-specific and bulky. Read them yourself before relying on the
asserter's PASS verdict. The asserters check for known good/bad strings
but cannot tell you whether the model *understood* the prompt.

## Adding a new fixture

1. Write the plan/envelope under `fixtures/`.
2. Write a `pass-condition` comment block at the top of the asserter
   listing the exact strings or patterns that prove the contract was
   honored.
3. Add a row to the table above.
4. Do NOT add this to `npm test` — keep llm-exchange opt-in.
