# test-prompt-harness judge: single result object (2026-11-19)

Status vocabulary: **firm** (reproduced, would repeat), **interim** (measured once, small sample), **exploratory**
(hypothesis or one-off observation), **superseded** (kept for history).

## Question

Why did every `semantic` pass condition in `planning-suite`'s `test-prompt-harness` return FAIL, and does the fixed
`bin/judge-runner.js` grade correctly on the current CLI and the 5.5 judge it now defaults to?

## Conditions

- `claude` 2.1.328 (Claude Code), macOS 27, Node 26.12.1, logged-in Claude subscription; cwd `claude-craft` checkout.
- Judge invocation: judge-runner.js's own arguments,
  `claude -p --output-format json --session-id <uuid> --permission-mode bypassPermissions --allowed-tools '' --model <m>`,
  input on stdin. Each call carries ~67K tokens of Claude Code context (system prompt, CLAUDE.md, memory, skills).
- Models: `claude-haiku-5-5` (the runner's default since planning-suite 0.3.1) and `claude-haiku-4-5-20251001` (the
  earlier default and the `smoke-echo` fixture's judge). Default effort; no effort flag.

## Rounds

### R1 — shape of the CLI's output (2 calls, Haiku 5.5)

The same one-line grading prompt, once without and once with `--verbose`:

- Without `--verbose`: stdout is **one JSON object**, `type: "result"`, `subtype: "success"`, the reply in `.result`.
  `claude --help` documents `--output-format json` as "single result".
- With `--verbose`: stdout is a **JSON array of 4 events** (`system`, `assistant`, `rate_limit_event`, `result`).

judge-runner.js passed no `--verbose`, yet `extractAssistantText` required an array, so it threw "judge stdout was not a
JSON array (top-level type=object)" on every call and `runJudge` returned FAIL. The only judge golden,
`fixtures/_golden/golden-judge.json`, had been captured with `--verbose`, so the unit tests exercised a shape the runner
never received. **firm**

Side observation, **exploratory** (2 calls, a free-form prompt, not the harness's `RUBRIC:`/`OUTPUT_TO_GRADE:` input):
Haiku 5.5 once returned `{"verdict":"FAIL"}` with reasoning saying the verdict should be PASS, and once returned a
correct `PASS` object followed by prose claiming a "previous answer" had been FAIL. R2, in the harness's real input
format, showed neither.

### Fix

`extractAssistantText` accepts the single result object, and still accepts the `--verbose` event array. A second
golden, `fixtures/_golden/golden-judge-result.json`, is the unmodified stdout of call `claude-haiku-5-5.pass.1` below
(the runner's exact arguments). New unit tests in `test/plugins/planning-suite/llm-bench/harness-unit.test.js`: the
golden is a single result object; `extractAssistantText` reads it; `runJudge` on it returns PASS; a non-result object
is rejected. Mutation check: the previous judge-runner.js (`git show HEAD:…`) throws "not a JSON array" on the new
golden and `runJudge` returns FAIL; the fixed one returns PASS. **firm**

### R2 — does the fixed runner grade correctly? (12 calls)

Input built exactly as `grade-run.js` `evalSemantic` builds it, with the SKILL.md example rubric:

```
The output must contain a single line "STATUS: OK".
Output ONLY a JSON object: {"verdict": "PASS"|"FAIL", "reasoning": "<one sentence>"}.
```

Graded outputs: `pass` = `Ran the checks.\nSTATUS: OK`, `fail` = `Ran the checks.\nAll done.`; 3 trials each.

| call | expected | verdict | correct | cost USD | judge reasoning (verbatim) |
|---|---|---|---|---|---|
| claude-haiku-5-5.pass.1 | PASS | PASS | yes | 0.0096 | The output contains exactly one line reading "STATUS: OK", which is the only requirement the rubric sets. |
| claude-haiku-5-5.pass.2 | PASS | PASS | yes | 0.0092 | The graded output contains the line "STATUS: OK" exactly once, which satisfies the rubric's requirement for a single such line. |
| claude-haiku-5-5.pass.3 | PASS | PASS | yes | 0.0079 | The output contains the single line "STATUS: OK" exactly once, as the rubric requires. |
| claude-haiku-5-5.fail.1 | FAIL | FAIL | yes | 0.0091 | The output never includes the required single line "STATUS: OK"; it only says "Ran the checks." and "All done." |
| claude-haiku-5-5.fail.2 | FAIL | FAIL | yes | 0.0079 | The graded output contains only "Ran the checks." and "All done." and never includes the required standalone line "STATUS: OK". |
| claude-haiku-5-5.fail.3 | FAIL | FAIL | yes | 0.0091 | The output to grade contains only "Ran the checks." and "All done." and never includes the single line "STATUS: OK" that the rubric requires. |
| claude-haiku-4-5-20251001.pass.1 | PASS | FAIL | no | 0.0704 | Output contains non-JSON text ('Ran the checks.') when rubric requires ONLY a JSON object with verdict and reasoning fields. |
| claude-haiku-4-5-20251001.pass.2 | PASS | FAIL | no | 0.0624 | Output contains extraneous text before STATUS: OK and is not formatted as a JSON object as required by the rubric. |
| claude-haiku-4-5-20251001.pass.3 | PASS | FAIL | no | 0.0646 | The output must consist only of a JSON object with verdict and reasoning fields, but the given output contains prose text ('Ran the checks.') and lacks the required JSON structure. |
| claude-haiku-4-5-20251001.fail.1 | FAIL | FAIL | yes | 0.0620 | Output is missing the required 'STATUS: OK' line and is not in the specified JSON object format. |
| claude-haiku-4-5-20251001.fail.2 | FAIL | FAIL | yes | 0.0620 | The output does not contain the required single line 'STATUS: OK'. |
| claude-haiku-4-5-20251001.fail.3 | FAIL | FAIL | yes | 0.0621 | Output is missing the required 'STATUS: OK' line and is not in the specified JSON format with verdict and reasoning fields. |

Totals: Haiku 5.5 6/6 correct, $0.0527 ($0.0088 a call); Haiku 4.5 3/6 correct, $0.3836 ($0.0639 a call, 7.3x).

- Every call parsed: no fence, trailing-prose or non-JSON failures in 12. **interim** (12 calls)
- Haiku 4.5 failed all 3 passing cases for the same reason: it applied the rubric's reply-format line ("Output ONLY a
  JSON object") to the graded output. The example rubric does not separate "what to check" from "how to answer", and
  `evalSemantic` puts both under `RUBRIC:`. Haiku 5.5 read it as intended. **interim** (3/3 for one rubric)

### R3 — the real case: gated live suite (1 run)

`RUN_LLM_BENCH=1 npx mocha test/plugins/planning-suite/llm-bench/llm-bench.test.js`: `smoke-echo` (subject and judge
Haiku 4.5) passes 16/16 in 20 s, including `semantic.produces-valid-status-block` (PASS, judge 9.2 s, reasoning
"Output contains a single line matching the required format 'STATUS: OK', indicating success."). That fixture's rubric
spells out when to PASS and when to FAIL, and Haiku 4.5 graded it correctly, unlike the SKILL.md example in R2.
**interim** (1 run)

## Open

- The SKILL.md example rubric's wording: give the reply format its own section in `evalSemantic`'s input, or reword
  the example. Not changed here.
- On 5.x models thinking display defaults to omitted, so a fixture grading the `thinking` view may see empty text.
  Not measured.
