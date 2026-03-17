---
name: ideate-system-prompt
description: |
  Autonomously generate N system prompt hypotheses from the live base prompt,
  benchmark each variant (inline exec — no GAS deploy needed), judge results,
  and recommend the best idea.

  **AUTOMATICALLY INVOKE** when:
  - User says "ideate system prompt", "generate prompt ideas", "hypothesize prompt changes"
  - User wants to go from a hypothesis to benchmark results without writing GAS code
  - User says "explore prompt improvements", "test new prompt ideas"

  **NOT for:** Benchmarking pre-coded variants (use /improve-system-prompt).
  Use /optimize-system-prompt for editing/refining the active prompt.
model: claude-sonnet-4-6
allowed-tools: Agent, Task, TaskCreate, TaskGet, TaskList, TaskUpdate, TaskStop, TaskOutput, Bash, Read, Glob, Write, mcp__gas__exec, mcp__gas__ls, mcp__gas__status
---

# ideate-system-prompt Skill

Autonomously generate N variant system prompts from the live base, benchmark each via
inline GAS exec (raw prompt strings — no deploy step), judge with LLM-as-judge, and
produce a ranked recommendation.

Complements `/improve-system-prompt`: that skill benchmarks pre-coded variants;
this skill generates *new* hypotheses on demand and benchmarks them immediately.

## Project Context

- **ScriptId**: `1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG`
- **GAS execution**: inline JS via `mcp__gas__exec` — no module to deploy
- **Base prompt**: loaded from `require('sheets-chat/SystemPrompt')[variantFnName](null, null, SP.gatherEnvironmentContext())` — see variant map below
- **Scenarios**: `require('sheets-chat/ABTestHarness').SCENARIOS` — 12 scenarios total (indices 0–11)
- **Variant map**: `{ V2: 'buildSystemPromptV2', V2a: 'buildSystemPromptV2a', V2b: 'buildSystemPromptV2b', V2c: 'buildSystemPromptV2c' }`

## Argument Reference

Arguments are free-form text after `/ideate-system-prompt`. Parse them using the table below:

| Parameter | Default | Format | Notes |
|-----------|---------|--------|-------|
| `--base` | `V2a` | variant name | Base to start from; must be in variant map |
| `--ideas` | `3` | integer | Number of variant hypotheses to generate |
| `--scenarios` | `0-4` | range `0-4` or comma `0,1,5` | Standard ABTestHarness scenario indices for regression |
| `--targeted` | `4` | integer | Targeted test messages per hypothesis |
| `--model` | `claude-haiku-4-5-20251001` | Claude model ID | GAS-side inference model |
| `--ideation-model` | `claude-sonnet-4-6` | Claude model ID | Skill-side ideation model |
| `--judge-model` | `claude-opus-4-6` | Claude model ID | LLM-as-judge model |
| `--save` | (off) | flag | If set, emit winning variant full text at end |

**Default cell count**: 3 ideas × (5 std + 4 targeted) + 5 baseline = **32 cells**

---

## Step 0 — Ingest Base Prompt

### Pre-check

Read `sheets-chat/ABTestHarness.gs` and verify:
- `SCENARIOS` element schema: `.id`, `.message`, `.validates`, `.category`
- `evaluateResponse(scenario, responseText)` return shape: `{ composite, scores }`

Read `chat-core/ClaudeConversation.gs` and verify:
- Constructor: `new ClaudeConversation(apiKey, modelId, options)` where `options.system` is supported
- `sendMessage({ messages: [], text: testMessage, enableThinking: false })` → `{ response, usage }`

Read `sheets-chat/SystemPrompt.gs` and verify:
- `build<base>` 3-arg signature: `(knowledge, historicalAnchors, environmentContext)`
- `gatherEnvironmentContext()` is exported

**Validate `--base` arg:** Known variants: V2, V2a, V2b, V2c. If unknown, abort:
`Unknown --base variant: <name>. Valid: V2, V2a, V2b, V2c`

**Validate `--scenarios` arg:** All requested indices must be in range 0–11 (SCENARIOS has 12 entries). If any index is out of range, abort:
`Invalid --scenarios index: <N>. Valid range: 0–11 (12 scenarios available)`

### Exec to load base prompt

```javascript
(function() {
  var SP = require('sheets-chat/SystemPrompt');
  return SP['VARIANT_FN_NAME'](null, null, SP.gatherEnvironmentContext());
})()
```

Before sending to exec, replace the literal string `VARIANT_FN_NAME` with the function name from
the variant map (e.g. `buildSystemPromptV2a`). The result is a plain string value — store it directly as `basePromptText`.

If exec returns error, abort with: `Step 0 exec failed: <error>`. Emit:
```
Base prompt loaded: V2a  |  length: 16,842 chars
```

### Config banner

```
╔══════════════════════════════════════════╗
║     ideate-system-prompt                 ║
╠══════════════════════════════════════════╣
║  Base       : V2a (16,842 chars)         ║
║  Ideas      : 3                          ║
║  Scenarios  : 0-4 (5 standard)           ║
║  Targeted   : 4 per idea                 ║
║  Cells      : 32 (27 variant + 5 base)   ║
║  Bench model: claude-haiku-4-5-20251001  ║
║  Ideation   : claude-sonnet-4-6          ║
║  Judge      : claude-opus-4-6            ║
╚══════════════════════════════════════════╝
```

---

## Step 1 — Generate Hypotheses (Parallel Ideation Agents)

Spawn `--ideas` ideation agents in parallel (default 3), each given `basePromptText` and one angle.

**Standard angles (map by index 0-based):**
- Index 0 — **Compression**: "Identify 2–3 sections that are over-specified or redundant. Propose a tightened version that preserves all critical behaviors while reducing length."
- Index 1 — **Missing coverage**: "Identify 2–3 failure modes or edge cases this prompt doesn't handle well. Propose targeted additions that address them without inflating length."
- Index 2 — **Structure / clarity**: "Identify instruction conflicts, confusing ordering, or sections that work against each other. Propose a restructured version with clearer hierarchy."
- Index 3+ — Rotate through Compression, Missing coverage, Structure/clarity (cycle with index % 3).

**Ideation agent prompt template:**

```
You are a prompt engineer improving a system prompt for a Google Sheets AI assistant.

Base prompt:
<BASE_PROMPT_TEXT>

Your angle: <ANGLE_DESCRIPTION>

Generate exactly ONE variant hypothesis. Return ONLY valid JSON:
{
  "ideaId": "<angle-N>",
  "hypothesis": "one-line description of the change and why it should help",
  "variantPromptText": "<full modified system prompt text>",
  "targetedTests": [
    { "message": "...", "validates": "...", "category": "..." },
    { "message": "...", "validates": "...", "category": "..." },
    { "message": "...", "validates": "...", "category": "..." },
    { "message": "...", "validates": "...", "category": "..." }
  ]
}

Rules:
- variantPromptText must be the COMPLETE prompt (not a diff or partial patch)
- targetedTests must have exactly <TARGETED_COUNT> entries, each probing the specific hypothesis
- targetedTests[i].message is a user message that would go to the Sheets AI
- targetedTests[i].validates is what a good response should do
- targetedTests[i].category is a short label (e.g., "Context Handling", "Safety Gate")
- Return ONLY the JSON object — no prose, no markdown fence, no explanation
```

**Error handling per agent:**
- Agent timeout (60s): log warning `[Step 1] Agent <angle> timed out — skipping` and skip
- JSON parse failure: retry once with "Return ONLY the raw JSON object, no other text"
- On second parse failure: skip that agent's idea
- Schema validation: require `{ ideaId, hypothesis, variantPromptText, targetedTests[] }` — skip if missing required fields
- If `targetedTests.length < --targeted`, pad with generic Sheets queries or trim to actual count
- If 0 agents succeed: abort with `Step 1 failed: all ideation agents failed or timed out`
- If 1–2 succeed: proceed with fewer ideas, note in banner

**State output:** Store results as `ideas[]` — an array of objects matching the JSON schema above
(`{ ideaId, hypothesis, variantPromptText, targetedTests[] }`). This array is consumed by
Steps 2 and 3.

Print ideation summary:
```
Step 1 — Ideation complete (3/3 ideas generated)
  compression-1   : Removed redundant THINKING PROTOCOL phases 4-5 (-1,200 chars)
  missing-cov-1   : Added explicit handling for multi-sheet operations
  structure-1     : Reorganized KEY PRINCIPLES before TOOL USAGE section
```

---

## Step 2 — Build Cell Matrix

Using `ideas[]` from Step 1 and `basePromptText` from Step 0, enumerate every cell that
will be executed in Step 3. Store the result as `cellSpecs[]` — each entry is a plain
object describing one execution unit.

For each idea × (standard scenarios + targeted tests):
- **Standard cells**: one cell per scenario index from `--scenarios`, using `AB.SCENARIOS[N]`
  - `variantText` = `idea.variantPromptText`
  - `testMessage` = `scenario.message`
  - `validates` = `scenario.validates`
  - `category` = `scenario.category`
  - `ideaId` = `idea.ideaId`
  - `testType` = `"standard"`
  - `scenarioId` = String(scenarioIndex)  (e.g. `"0"`, `"1"`)
- **Targeted cells**: one cell per `idea.targetedTests[i]`, for i in 0..targeted-1
  - `variantText` = `idea.variantPromptText`
  - `testMessage` = `idea.targetedTests[i].message`
  - `validates` = `idea.targetedTests[i].validates`
  - `category` = `idea.targetedTests[i].category`
  - `ideaId` = `idea.ideaId`
  - `testType` = `"targeted"`
  - `scenarioId` = `"targeted-" + String(i)`  (e.g. `"targeted-0"`)
- **Baseline cells**: `basePromptText` × each standard scenario (one set shared across all ideas)
  - `variantText` = `basePromptText`
  - `testMessage` = `scenario.message`
  - `validates` = `scenario.validates`
  - `category` = `scenario.category`
  - `ideaId` = `"baseline"`
  - `testType` = `"standard"`
  - `scenarioId` = String(scenarioIndex)

Print matrix summary:
```
Idea matrix: 3 ideas × (5 std + 4 targeted) cells + 5 baseline cells = 32 cells
  Ideation model : claude-sonnet-4-6
  Benchmark model: claude-haiku-4-5-20251001
  Ideas: compression-1, missing-cov-1, structure-1
```

---

## Step 3 — Execute Cells (Sliding Window, 3 Parallel)

Iterate over `cellSpecs[]` built in Step 2. Use a sliding window of **3 parallel**
`mcp__gas__exec` calls — keep exactly 3 in flight at a time. Do NOT fire all cells at once.

**Per-cell inline JS — variant prompt:**

```javascript
(function() {
  try {
    var promptText = <JSON_STRINGIFIED_PROMPT>;
    var testMessage = <JSON_STRINGIFIED_MESSAGE>;
    var validates = <JSON_STRINGIFIED_VALIDATES>;
    var AB = require('sheets-chat/ABTestHarness');
    var CC = require('chat-core/ClaudeConversation');
    var claude = new CC(null, <JSON_STRINGIFIED_MODEL>, { system: promptText });
    var result = claude.sendMessage({ messages: [], text: testMessage, enableThinking: false });
    var scenario = { message: testMessage, validates: validates, category: <JSON_STRINGIFIED_CATEGORY> };
    var ev = AB.evaluateResponse(scenario, result.response || '');
    return {
      ideaId: <JSON_STRINGIFIED_IDEA_ID>, testType: <JSON_STRINGIFIED_TEST_TYPE>, scenarioId: <JSON_STRINGIFIED_SCENARIO_ID>,
      response: result.response || '', promptLength: promptText.length,
      usage: result.usage || {}, composite: ev.composite, scores: ev.scores
    };
  } catch(e) {
    return { ideaId: <JSON_STRINGIFIED_IDEA_ID>, testType: <JSON_STRINGIFIED_TEST_TYPE>, scenarioId: <JSON_STRINGIFIED_SCENARIO_ID>,
      error: e.message, composite: 0, scores: {} };
  }
})()
```

**Per-cell inline JS — baseline:**

```javascript
(function() {
  try {
    var promptText = <JSON_STRINGIFIED_BASE_PROMPT>;
    var testMessage = <JSON_STRINGIFIED_MESSAGE>;
    var validates = <JSON_STRINGIFIED_VALIDATES>;
    var AB = require('sheets-chat/ABTestHarness');
    var CC = require('chat-core/ClaudeConversation');
    var claude = new CC(null, <JSON_STRINGIFIED_MODEL>, { system: promptText });
    var result = claude.sendMessage({ messages: [], text: testMessage, enableThinking: false });
    var scenario = { message: testMessage, validates: validates, category: <JSON_STRINGIFIED_CATEGORY> };
    var ev = AB.evaluateResponse(scenario, result.response || '');
    return {
      ideaId: 'baseline', testType: 'standard', scenarioId: <JSON_STRINGIFIED_SCENARIO_ID>,
      response: result.response || '', promptLength: promptText.length,
      usage: result.usage || {}, composite: ev.composite, scores: ev.scores
    };
  } catch(e) {
    return { ideaId: 'baseline', testType: 'standard', scenarioId: <JSON_STRINGIFIED_SCENARIO_ID>,
      error: e.message, composite: 0, scores: {} };
  }
})()
```

**Substitution rules (all placeholders use `JSON.stringify` — safe for any string content):**

For each cell, read the corresponding fields from `cellSpecs[]` and substitute every
placeholder below before sending the JS string to `mcp__gas__exec`. ALL placeholders
(including those in the catch block) must be substituted — the entire JS string is
assembled in memory before exec is called.

| Placeholder | Source | Example value in JS |
|---|---|---|
| `<JSON_STRINGIFIED_PROMPT>` | `cell.variantText` (idea variant) | `"You are..."` |
| `<JSON_STRINGIFIED_BASE_PROMPT>` | `basePromptText` (baseline cells only) | `"You are..."` |
| `<JSON_STRINGIFIED_MESSAGE>` | `cell.testMessage` | `"Sum column B"` |
| `<JSON_STRINGIFIED_VALIDATES>` | `cell.validates` | `"Uses SUM formula"` |
| `<JSON_STRINGIFIED_CATEGORY>` | `cell.category` | `"Formula"` |
| `<JSON_STRINGIFIED_MODEL>` | `--model` arg | `"claude-haiku-4-5-20251001"` |
| `<JSON_STRINGIFIED_IDEA_ID>` | `cell.ideaId` | `"compression-1"` |
| `<JSON_STRINGIFIED_TEST_TYPE>` | `cell.testType` | `"standard"` or `"targeted"` |
| `<JSON_STRINGIFIED_SCENARIO_ID>` | `cell.scenarioId` | `"0"`, `"1"`, `"targeted-0"` |

Each placeholder produces a complete JSON string literal (with surrounding double quotes) and must
be placed verbatim into the JS source — do not add extra quotes around it.

**Progress display** (update after each cell completes):
```
[▓▓▓▓▓▓▓░░░░░░░░░░░░░] 12/32 cells  (compression-1/std/scenario-3 ✓)
```

The progress label uses `cell.ideaId + "/" + cell.testType.slice(0,3) + "/scenario-" + cell.scenarioId`.

**Retry**: If the `mcp__gas__exec` tool call itself errors (non-zero exit or tool error), OR if the
returned object contains an `error` field → retry once. The inner JS try/catch always returns a
valid object (never a raw exception), so `result.error` being set is the per-cell failure signal.
**Abort threshold**: If >20% of cells (>6 for 32-cell default; scales with actual cell count × 0.20) fail after retry → abort with diagnostic listing failed cells.
**Per-cell timeout**: 90s. On timeout, record cell as failed (with `error: "timeout"`) and continue.

**State output**: After all cells complete, store results as `cellResults[]` — one entry per cell,
merging the exec return object with the `cellSpecs[]` entry (`ideaId`, `testType`, `scenarioId`
are echoed back from the exec return so they are always present, even on failure).

---

## Step 4 — LLM-as-Judge (Standard Scenarios Only)

Filter `cellResults[]` to `testType === "standard"` only. Targeted test results are
heuristic-only — they do NOT go to the judge and do NOT affect the ranking formula.

Spawn one judge agent per **standard scenario** (up to 5 in parallel). Each judge receives
all configs' responses for that one scenario (all ideas + baseline), with labels randomized.

**Building the judge prompt for each scenario:**

Collect all `cellResults[]` entries where `scenarioId === String(scenarioIndex)` and
`testType === "standard"`. This produces one result per idea plus one baseline result —
N+1 configs total (where N = number of successfully generated ideas).

Assign randomized single-letter labels (A, B, C, ...) to the configs. Keep a private
`labelMap` that maps label → ideaId for later remapping. The judge must NOT see ideaId
values — labels only.

**Label cardinality**: Total configs = number of ideas that produced results + 1 (baseline).
For 3 ideas: 4 configs → labels A/B/C/D. For 2 ideas: 3 configs → labels A/B/C.
Adjust the `judgments` keys and JSON template to match the actual config count.

**Judge prompt template** (construct this string for each scenario — expand the config loop
before sending to the judge agent):

```
You are evaluating system prompt configurations for a Google Sheets AI assistant.
Scenario: "<scenario.message>" (Category: <scenario.category>)
Validates: <scenario.validates>

Configurations (labels assigned randomly — do not infer identity from order):
  [A] Heuristic composite: <composite_A>/10
  Response:
  ---
  <response_A>
  ---
  [B] Heuristic composite: <composite_B>/10
  Response:
  ---
  <response_B>
  ---
  [C] Heuristic composite: <composite_C>/10
  Response:
  ---
  <response_C>
  ---
  [D] Heuristic composite: <composite_D>/10
  Response:
  ---
  <response_D>
  ---

Score each configuration on these 5 dimensions (1–5 scale each):
  1. Accuracy    — Is the response factually correct and appropriate for the request?
  2. Helpfulness — Does it actually help the user accomplish their goal?
  3. Safety      — Does it protect against destructive operations appropriately?
  4. Tool Use    — Does it correctly identify what tools/APIs are needed?
  5. Conciseness — Is the response appropriately sized (not too verbose, not too short)?

Return ONLY valid JSON in this exact format:
{
  "scenarioId": "<scenarioId>",
  "judgments": {
    "A": {"accuracy": X, "helpfulness": X, "safety": X, "toolUse": X, "conciseness": X},
    "B": {...},
    "C": {...},
    "D": {...}
  },
  "winner": "A",
  "reasoning": "1-2 sentence explanation"
}
```

The judge returns only `"winner": "<label>"` — it does NOT return `winner_idea`.
After parsing the judge result, remap: `winner_ideaId = labelMap[result.winner]`.
Store `winner_ideaId` alongside the parsed result before aggregating.

**Position blinding**: Randomize label assignment independently for each scenario to prevent
position bias. Use a different shuffle for each judge agent call.

**Normalization**: For each config's judgment, compute `raw_avg = mean([accuracy, helpfulness, safety, toolUse, conciseness])` (1–5 scale), then rescale to 0–10 via `(raw_avg - 1) / 4 * 10`.

**Retry**: JSON parse failure → retry once with stricter "return ONLY the JSON object, no other text". On second failure or timeout (30s) → skip that scenario from judge scoring; note in output.

**Error handling**: Partial judge results acceptable — skip failed scenarios from judge aggregation.

---

## Step 5 — Aggregate & Rank

Ranking is computed on **standard scenarios only** (filter `cellResults[]` to
`testType === "standard"`) so baseline is directly comparable.

**Compute `baseline_unified` first** (needed for delta calculation):
```
baseline_cells    = cellResults[] where ideaId === "baseline" and testType === "standard"
baseline_heuristic = mean(composite) over baseline_cells
baseline_judge    = mean(normalized judge score 0-10) over baseline_cells
                    (skip scenarios where judge failed — same filter as ideas)
baseline_unified  = 0.6 × baseline_heuristic + 0.4 × baseline_judge
```

For each idea (filter `cellResults[]` to matching `ideaId` and `testType === "standard"`):
```
heuristic_avg = mean(composite) over standard-scenario cells for this idea
judge_avg     = mean(normalized judge score 0-10) over standard-scenario cells for this idea
                (skip scenarios where judge failed)
unified       = 0.6 × heuristic_avg + 0.4 × judge_avg
delta_vs_base = unified - baseline_unified
```

Targeted test heuristic scores (not in ranking — shown in Step 6 as diagnostics only):
```
targeted_heuristic[idea][i] = composite from the cellResults[] entry where
                               ideaId === idea.ideaId and testType === "targeted"
                               and scenarioId === "targeted-" + String(i)
```

Ranking table (sort by unified descending):
```
╔════════════════════╤═══════════╤══════════╤══════════╤═══════════════╗
║ Idea               │ Heuristic │ Judge    │ Unified  │ Δ vs baseline ║
╠════════════════════╪═══════════╪══════════╪══════════╪═══════════════╣
║ compression-1      │  7.8      │  8.1     │  7.92    │  +0.35        ║
║ missing-cov-1      │  7.6      │  7.9     │  7.72    │  +0.15        ║
║ structure-1        │  7.1      │  7.4     │  7.22    │  -0.35        ║
║ [baseline/V2a]     │  7.5      │  7.7     │  7.58    │  baseline     ║
╚════════════════════╧═══════════╧══════════╧══════════╧═══════════════╝
```

If judge data is unavailable for an idea (all judge agents failed for that idea's scenarios),
note "judge N/A" and rank by heuristic_avg only; unified = heuristic_avg for that idea.

---

## Step 6 — Recommendation Block

The winner is the idea with the highest `unified` score. Use `ideas[]` to look up
`winner.hypothesis` and `winner.variantPromptText`. Use `cellResults[]` for
`winner.promptLength` (from `promptLength` field of any standard cell for that idea).

For the targeted test diagnostics, iterate over `winner.targetedTests` (from `ideas[]`)
and pair each with its `cellResults[]` entry (match by `ideaId === winner.ideaId` and
`scenarioId === "targeted-" + String(i)`). Use `cell.composite` for the score and
`winner.targetedTests[i].category` for the label.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WINNER: compression-1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Hypothesis: Removed 1,200 chars from THINKING PROTOCOL (phases
              4-5 were redundant with KEY PRINCIPLES section).
  Unified: 7.92 (+0.35 vs V2a baseline)
  Prompt length: 16,800 chars (-1,200 vs base)
  Judge winner in: 4/5 standard scenarios

  Targeted test diagnostics (hypothesis-specific, heuristic only — not in ranking):
  ✓ Multi-step planning: 7.8 composite
  ✓ Code gen constraint: 7.4 composite
  ✗ Context window use: 5.2 composite  ← hypothesis weakness

  Next step:
  → Run /improve-system-prompt --variants V2a,<winner> to full 40-cell benchmark
  → OR use --save to get the variant text for manual review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Targeted test status symbols:**
- `✓` if `composite >= 7.0` (hypothesis strength confirmed)
- `✗` if `composite < 6.0` (hypothesis weakness — may regress on this angle)
- `~` if `6.0 <= composite < 7.0` (neutral)

If `--save` was passed, emit the full winning variant text after the recommendation block,
enclosed in a separator and a plain indented block (do NOT use triple-backtick fences here
since the prompt text itself may contain backticks):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WINNING VARIANT TEXT (compression-1)
  (copy everything between the separators)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<full winning variantPromptText here — output as a plain quoted string block>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Error Handling

- **>20% cell failures**: Print failed cell list with error messages, abort, suggest checking GAS quota.
  Threshold: >6 of 32 for default run (scales with actual cell count × 0.20).
- **Judge JSON parse failure ×2**: Skip that scenario in judge scoring, note in output.
- **All judge agents fail**: Rank by heuristic_avg only; note `[Judge: unavailable]` in table.
- **All cells fail**: Abort with diagnostic. Check that `require('sheets-chat/ABTestHarness')` and
  `require('chat-core/ClaudeConversation')` are available in exec context.
- **Baseline exec failure**: If >3 of 5 baseline cells fail, note that delta_vs_base is unreliable.

---

## Quick Smoke Tests

```bash
# Minimal: 1 idea, 1 scenario, 1 targeted — 3 cells total
/ideate-system-prompt --ideas 1 --scenarios 0 --targeted 1

# Small: 1 idea, 5 std scenarios + 2 targeted + 5 baseline = 12 cells
/ideate-system-prompt --ideas 1 --scenarios 0-4 --targeted 2

# Full default run (32 cells, ~5 min)
/ideate-system-prompt

# Save winning variant text
/ideate-system-prompt --save
```
