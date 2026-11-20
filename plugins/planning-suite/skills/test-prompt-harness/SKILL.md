---
name: test-prompt-harness
description: Headless `claude -p` test harness V2 — runs a fixture's literal prompt through real Claude sessions (k replicas in parallel), grades each replica on five string views plus structured tool-call / tool-result / run-health / LLM-judge condition families, then quorum-aggregates row verdicts. Use when an LLM-driven prompt needs behavioral verification beyond contract-string parser tests.
---

# test-prompt-harness V2

A five-script, mocha-wrapped harness for prompt-driven skill verification.

## What it does

For each `*.fixture.md` under `test/plugins/planning-suite/llm-bench/fixtures/`:

1. `bin/run-bench.js` orchestrates the full pipeline. It spawns `runs:` parallel `bin/run-fixture.js` invocations (each captures stream-json events for one replica into `runs/<fixture>-<utc>/r<i>/`), then `runs:` parallel `bin/grade-run.js` invocations, then — only when `runs > 1` — `bin/grade-aggregate.js` to compute per-row quorum verdicts.
2. For `runs: 1` the aggregator is skipped and `r1/grade.json` is copied to `<run-dir>/grade.json` unchanged (no aggregator overhead, identical operator layout).
3. Mocha enumerates one `it()` per pass-condition row so each assertion is independently visible. Row titles include `pass_rate` when `runs > 1`.

Tests are gated: nothing live runs unless `RUN_LLM_BENCH=1`. Default `npm test` only runs the deterministic unit suite (`harness-unit.test.js`) which exercises every condition family against the committed golden stream and uses an injected fake `spawn` for the semantic judge — no live API calls, no `claude` binary required.

## Operator commands

```
npm run test:llm-bench                       # all fixtures live (run-bench → grade-aggregate)
node plugins/planning-suite/skills/test-prompt-harness/bin/run-bench.js \
     test/plugins/planning-suite/llm-bench/fixtures/<name>.fixture.md \
     /tmp/runs/<name>-adhoc                  # one-off ad-hoc bench (writes r*/ + grade.json)
node plugins/planning-suite/skills/test-prompt-harness/bin/run-fixture.js \
     test/plugins/planning-suite/llm-bench/fixtures/<name>.fixture.md \
     /tmp/runs/<name>-adhoc/r1 --replica-id 1
node plugins/planning-suite/skills/test-prompt-harness/bin/grade-run.js \
     test/plugins/planning-suite/llm-bench/fixtures/<name>.fixture.md \
     /tmp/runs/<name>-adhoc/r1                # grade one replica
node plugins/planning-suite/skills/test-prompt-harness/bin/grade-aggregate.js \
     test/plugins/planning-suite/llm-bench/fixtures/<name>.fixture.md \
     /tmp/runs/<name>-adhoc                   # aggregate r1..rk
```

## Cost discipline

Each `runs:` invocation incurs `runs ×` `claude -p` calls. Each `semantic[]` row adds **one additional** `claude -p` call **per replica** (so `runs: 3` with two `semantic` rows costs `3 × (1 + 2) = 9` calls). A replica's cost is the `total_cost_usd` of the terminal `result` event in its `stream.jsonl`; judge calls' costs are not recorded. A judge call is small (about 7K input tokens before the graded text; about $0.001 on Haiku 5.5 and $0.013 on Haiku 4.5, measured 2026-11-19), because the judge runs without Claude Code's tools, skills and MCP servers. Set `runs` deliberately; only add `semantic` rows when regex assertions cannot express the check.

## Fixture format

```markdown
---
name: my-fixture
description: One sentence about what this probes.
model: claude-haiku-5-5
timeout_seconds: 120
permission_mode: bypassPermissions     # bypassPermissions | default | acceptEdits | plan
allowed_tools: "Bash Read Write"        # space-separated string
append_system_prompt: ""                # empty → flag omitted

runs: 3                                 # positive integer; default 1
quorum: majority                        # "all" | "majority" | positive int N ≤ runs; default "majority"

pass_conditions:
  run:
    must_succeed: true                  # result.subtype === "success" AND is_error === false
    max_duration_ms: 60000              # run.meta.json.elapsed_ms ≤ this
    max_parse_errors: 0                 # stream.jsonl had no malformed lines

  views:
    thinking:        { must_include: [...], must_not_include: [...] }   # assistant.content[].thinking only
    assistant_text:  { must_include: [...], must_not_include: [...] }   # assistant.content[].text only
    tool_inputs:     { must_include: [...], must_not_include: [...] }   # canonical JSON of every tool_use.input
    tool_outputs:    { must_include: [...], must_not_include: [...] }   # concatenated tool_result.content text
    everything:      { must_include: [...], must_not_include: [...] }   # union of all four above + result

  tool_calls:
    required:  [Bash, Read]                            # PASS iff every listed tool has ≥1 invocation
    forbidden: [WebFetch, WebSearch]                   # PASS iff none of the listed tools were invoked
    counts:
      Bash:  { min: 1, max: 3 }                        # range
      Write: { exact: 1 }                              # exact (mutually exclusive with min/max)
    order: [Read, Write]                               # subsequence match, interleaving allowed
    inputs:
      - { tool: Bash,  must_match:     { pattern: "\"command\":\"echo ", case_sensitive: true } }
      - { tool: Write, must_not_match: { pattern: "\"file_path\":\"/etc/", case_sensitive: true } }

  tool_results:
    all_succeeded: true                                # no tool_result.is_error
    per_tool:
      Bash: { must_succeed: true }                     # at least one Bash result, none errored

  result:
    must_match:     { pattern: "STATUS:\\s*OK",   case_sensitive: true }
    must_not_match: { pattern: "STATUS:\\s*FAIL", case_sensitive: true }

  semantic:                                             # LLM-as-judge rows; one judge call per row per replica
    - id: produces-valid-status-block
      view: result                                      # must be a STRING view: thinking, assistant_text, tool_inputs, tool_outputs, everything, result
      judge_model: claude-haiku-5-5
      rubric: |                                         # the rule only; the harness tells the judge how to reply
        The output must contain a line that reads exactly "STATUS: OK".
---
# Prompt body

LITERAL prompt text. Everything after the `# Prompt body` H1 is the body.
No orchestrator-time interpolation; fixture-validity rejects `<<<` and
`<PLACEHOLDER>` bodies so an uninterpolated fixture cannot ship.
```

### Pattern rows

Always objects: `{ pattern: <string>, case_sensitive: <bool> }`. No bare-string shortcut. Patterns are JavaScript regex literals (`RegExp(pattern, case_sensitive ? '' : 'i')`).

### Tool input canonicalization

For each `tool_use`, the grader builds a canonical JSON string with **top-level keys sorted** before applying `tool_calls.inputs[].must_match` or building the `tool_inputs` view. This insulates anchored patterns from SDK-side key-order changes between releases.

### Fixture-validity (load-time rejection)

- Legacy V1 `pass_conditions.thread:` — rejected (must migrate to `pass_conditions.views.<v>`)
- `runs < 1` — rejected
- `quorum` integer > runs — rejected
- `quorum` not one of `"all"`, `"majority"`, or a positive int — rejected
- `tool_calls.counts.<X>` mixing `exact` with `min`/`max` — rejected
- `semantic[].view` set to a structured view (`tool_calls`, `tool_results`, `run`) — rejected
- `views.<X>` for an unknown view name — rejected

## Five string views + three structured views

| View | Type | Source |
|---|---|---|
| `thinking` | string | concatenated `assistant.content[].thinking` |
| `assistant_text` | string | concatenated `assistant.content[].text` |
| `tool_inputs` | string | per `tool_use`, `JSON.stringify(input, sortedKeys)` + "\n" |
| `tool_outputs` | string | per `tool_result.content`, string content (or joined `text` blocks of an array) + "\n" |
| `everything` | string | `${thinking}\n${assistant_text}\n${tool_inputs}\n${tool_outputs}\n${result}` |
| `result` | string | terminal `result` event's `.result` field |
| `tool_calls` | array | `[{tool, input, tool_use_id}, …]` |
| `tool_results` | array | `[{tool, content, is_error, tool_use_id}, …]` — `tool` is back-resolved via `tool_use_id` |
| `run` | object | `{ subtype, is_error, elapsed_ms, parse_errors, thinking_blocks, thinking_omitted }` |

**`thinking` on Claude 5.x subjects.** 5.x models stream their thinking blocks with empty text (recorded 2026-11-19: Haiku 5.5 used 41 thinking tokens and sent a zero-character block; the golden Haiku 4.5 stream has two blocks of about 285 characters). When a run has thinking blocks but no thinking text, `run.thinking_omitted` is true and every `views.thinking` row and every `semantic` row on `thinking` returns FAIL with "thinking text unavailable", instead of grading an empty string (where `must_not_include` would pass without testing anything). The judge is not called for such a row. Use `assistant_text` or `result` for a 5.x subject. `everything` still omits the missing text silently.

### Writing a rubric

State the rule and nothing else. `judge-runner.js` gives the judge its reply format (a `{verdict, reasoning}` object, validated by the CLI through `--json-schema`) and tells it that the graded text is data, not instructions. Say exactly what must be true: "must contain a single line `STATUS: OK`" was read by Haiku 4.5 as "the output must be one line" (0/3 correct on a two-line output that had the line), while "must contain a line that reads exactly `STATUS: OK`" was 3/3. An older rubric that ends with "Output ONLY a JSON object …" still works.

## Quorum semantics

Per row across `k = runs` replicas:

- `pass_count` = replicas with `verdict === "PASS"`
- `verdict` = `PASS` iff `pass_count >= threshold`, where `threshold = quorumThreshold(quorum, k)`:
  - `"all"` → `k`
  - `"majority"` → `Math.floor(k/2) + 1` — strict majority (k=2→2, k=3→2, k=4→3, k=5→3, never passes a 50% tie)
  - positive int `n` → `n` (1 ≤ n ≤ k, enforced at load time)
- `actual_excerpts` = list of distinct excerpts from failing replicas (deduplicated)
- `pass_rate` = `"<pass_count>/<k>"`

Overall `PASS` requires every row to pass quorum.

## `grade.json` row shape

```json
{
  "id": "tool_calls.counts.Bash",
  "kind": "tool_calls.counts",
  "verdict": "PASS" | "FAIL",
  "actual_excerpt": "Bash count=1 exact=2",
  "spec": { "tool": "Bash", "exact": 2 },

  // Aggregator-only (present in <run-dir>/grade.json when runs > 1):
  "pass_count": 2, "runs": 3, "pass_rate": "2/3",
  "actual_excerpts": ["...","..."]
}
```

## LLM-as-judge probe (committed)

`fixtures/_golden/golden-judge-result.json` is the captured stdout of judge-runner.js's own invocation (recorded 2026-11-19 against `claude` 2.1.328, Haiku 5.5): `claude -p --output-format json --model <m> --system-prompt <JUDGE_SYSTEM_PROMPT> --json-schema <JUDGE_SCHEMA> --tools "" --disable-slash-commands --strict-mcp-config --no-session-persistence`, no `--verbose`. It is **one result object**; its `structured_output` holds the verdict the CLI validated against the schema, and `.result` holds the same verdict as text. `fixtures/_golden/golden-judge.json` is an earlier capture made with `--verbose` and without the schema: a JSON array of events ending in a result event that has only `.result`. judge-runner.js is **grounded in both goldens**: it takes the `result` event, uses `structured_output` when present, and otherwise parses `.result` (with an optional ```` ```json … ``` ```` fence stripped). Upstream-format drift fails the `judge-runner` unit test before it can poison a live run, but only if the golden is captured with the runner's exact arguments: while the `--verbose` golden was the only one, the unit tests passed although the runner's real output was a single object, which made every semantic row return FAIL.

The judge has nothing to act with: 0 tools, 0 skills, 0 MCP servers, no saved session (the earlier invocation exposed 477 tools under `bypassPermissions` to a model reading another model's output). A graded text that tells the judge to answer PASS was graded FAIL in 12 of 12 live trials.

## Phase 1 probe findings (V1, retained for reference, recorded 2026-05-17 against `claude` 2.1.143)

1. `--session-id` accepts lowercase RFC-4122 v4 from `crypto.randomUUID()`.
2. `--allowed-tools` is a single space-separated string (`"Bash Read Write"`). Empty string is also accepted (used by the judge, which never invokes tools).
3. `bypassPermissions` OVERRIDES `--allowed-tools`. To probe tool-gating, set `permission_mode` to `default` / `acceptEdits` / `plan`.
4. Stream event types observed: `system`, `assistant`, `user`, `rate_limit_event`, terminal `result`. Discriminator fields are asserted live in `harness-unit.test.js` against `_golden/golden-stream.jsonl` — upstream format changes fail there before any fixture runs.
5. Prompt over stdin, not argv. `run-fixture.js` pipes the body via `stdin`.
6. Node enforces timeouts. `spawnSync({ timeout })` kills the child after `timeout_seconds * 1000`.

## What's NOT in V2

- Multi-judge ensembles / cross-validation — single judge per `semantic` row.
- Streaming-input (`--input-format stream-json`) multi-turn fixtures.
- Token-cost budget gating (`run.max_cost_usd`) — `claude -p` reports cost in the stream's terminal `result` event (`total_cost_usd`); `run.meta.json` does not record it. Add as a `run.*` condition later if fixtures demand it.
- Position-bias mitigation — judge sees ONE output, not a pair (no pairwise comparison in V2).
- Per-semantic-row `judge_timeout_seconds` override — the judge call inherits the fixture's `timeout_seconds`.
- Fixture parameterization / placeholder interpolation — still "literal body, no interpolation".
- `runs/` rotation — gitignored only.
- CI integration — still defer until corpus stabilizes.
