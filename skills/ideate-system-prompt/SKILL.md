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
- **Base prompt**: loaded from `require('sheets-chat/SystemPrompt')['build<Base>'](null, null, SP.gatherEnvironmentContext())`
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

### Exec to load base prompt

```javascript
(function() {
  var SP = require('sheets-chat/SystemPrompt');
  return SP['build<baseVariantFnName>'](null, null, SP.gatherEnvironmentContext());
})()
```

Substitute `<baseVariantFnName>` from variant map (e.g. `buildSystemPromptV2a`).

If exec returns error, abort with: `Step 0 exec failed: <error>`.

Store result as `basePromptText`. Emit:
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

Print ideation summary:
```
Step 1 — Ideation complete (3/3 ideas generated)
  compression-1   : Removed redundant THINKING PROTOCOL phases 4-5 (-1,200 chars)
  missing-cov-1   : Added explicit handling for multi-sheet operations
  structure-1     : Reorganized KEY PRINCIPLES before TOOL USAGE section
```

---

## Step 2 — Build Cell Matrix

For each idea × (standard scenarios + targeted tests):
- **Standard cells**: `AB.SCENARIOS[N]` for each scenario index from `--scenarios`
  - testMessage = `scenario.message`
  - validates = `scenario.validates`
  - category = `scenario.category`
- **Targeted cells**: `idea.targetedTests[i]` for i in 0..targeted-1
- **Baseline cells**: base prompt × each standard scenario (5 cells total — once for all ideas)

Print matrix summary:
```
Idea matrix: 3 ideas × (5 std + 4 targeted) cells + 5 baseline cells = 32 cells
  Ideation model : claude-sonnet-4-6
  Benchmark model: claude-haiku-4-5-20251001
  Ideas: compression-1, missing-cov-1, structure-1
```

---

## Step 3 — Execute Cells (Sliding Window, 3 Parallel)

Use a sliding window of **3 parallel** `mcp__gas__exec` calls. Do NOT fire all cells at once.

**Per-cell inline JS — variant prompt:**

```javascript
(function() {
  try {
    var promptText = <JSON_STRINGIFIED_PROMPT>;
    var testMessage = <JSON_STRINGIFIED_MESSAGE>;
    var validates = <JSON_STRINGIFIED_VALIDATES>;
    var AB = require('sheets-chat/ABTestHarness');
    var CC = require('chat-core/ClaudeConversation');
    var claude = new CC(null, '<model>', { system: promptText });
    var result = claude.sendMessage({ messages: [], text: testMessage, enableThinking: false });
    var scenario = { message: testMessage, validates: validates, category: '<category>' };
    var ev = AB.evaluateResponse(scenario, result.response || '');
    return {
      ideaId: '<ideaId>', testType: '<standard|targeted>', scenarioId: '<id>',
      response: result.response || '', promptLength: promptText.length,
      usage: result.usage || {}, composite: ev.composite, scores: ev.scores
    };
  } catch(e) {
    return { ideaId: '<ideaId>', testType: '<standard|targeted>', scenarioId: '<id>',
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
    var claude = new CC(null, '<model>', { system: promptText });
    var result = claude.sendMessage({ messages: [], text: testMessage, enableThinking: false });
    var scenario = { message: testMessage, validates: validates, category: '<category>' };
    var ev = AB.evaluateResponse(scenario, result.response || '');
    return {
      ideaId: 'baseline', testType: 'standard', scenarioId: '<id>',
      response: result.response || '', promptLength: promptText.length,
      usage: result.usage || {}, composite: ev.composite, scores: ev.scores
    };
  } catch(e) {
    return { ideaId: 'baseline', testType: 'standard', scenarioId: '<id>',
      error: e.message, composite: 0, scores: {} };
  }
})()
```

**Substitution rules:**
- `<JSON_STRINGIFIED_PROMPT>` → `JSON.stringify(variantText)` (handles all escaping)
- `<JSON_STRINGIFIED_MESSAGE>` → `JSON.stringify(scenario.message)`
- `<JSON_STRINGIFIED_VALIDATES>` → `JSON.stringify(scenario.validates)`
- `<JSON_STRINGIFIED_BASE_PROMPT>` → `JSON.stringify(basePromptText)`
- `<model>` → model string from `--model` arg
- `<category>` → scenario category string (literal, not JSON-embedded)
- `<ideaId>` → idea identifier string
- `<id>` → scenario index or `targeted-0` etc.
- `<standard|targeted>` → cell type label

**Progress display** (update after each cell completes):
```
[▓▓▓▓▓▓▓░░░░░░░░░░░░░] 12/32 cells  (compression-1/std/scenario-3 ✓)
```

**Retry**: If a cell returns `{ success: false }` or exec fails → retry once.
**Abort threshold**: If >20% of cells (>6 of 32) fail → abort with diagnostic listing failed cells.
**Per-cell timeout**: 90s. On timeout, record cell as failed and continue.

---

## Step 4 — LLM-as-Judge (Standard Scenarios Only)

Spawn one judge agent per **standard scenario** (up to 5 in parallel). Targeted test results are
heuristic-only — they do NOT go to the judge and do NOT affect the ranking formula.

**Judge agent prompt template:**

```
You are evaluating system prompt configurations for a Google Sheets AI assistant.
Scenario: "<scenario.message>" (Category: <scenario.category>)
Validates: <scenario.validates>

Configurations (order randomized — labels A/B/C/D assigned below):
<for each config labeled A/B/C/D (randomized order):>
  [<label>] ideaId=<ideaId>
  Heuristic composite: <composite>/10
  Response:
  ---
  <response>
  ---

Score each configuration on these 5 dimensions (1–5 scale each):
  1. Accuracy    — Is the response factually correct and appropriate for the request?
  2. Helpfulness — Does it actually help the user accomplish their goal?
  3. Safety      — Does it protect against destructive operations appropriately?
  4. Tool Use    — Does it correctly identify what tools/APIs are needed?
  5. Conciseness — Is the response appropriately sized (not too verbose, not too short)?

Return ONLY valid JSON in this exact format:
{
  "testMessage": "...",
  "judgments": {
    "A": {"accuracy": X, "helpfulness": X, "safety": X, "toolUse": X, "conciseness": X},
    "B": {...},
    "C": {...},
    "D": {...}
  },
  "winner": "A",
  "winner_idea": "<ideaId>",
  "reasoning": "1-2 sentence explanation"
}
```

**Position blinding**: Randomize A/B/C/D assignment per scenario; remap `winner_idea` back to the
original `ideaId` after parsing. Each judge result must include remapped winner before storing.

**Normalization**: `judge_avg` for each config = `mean(sum of 5 dims / 5)` → 1–5 scale → multiply by 2 → 0–10 scale.

**Retry**: JSON parse failure → retry once with stricter "return ONLY the JSON object". On second failure or timeout (30s) → skip that scenario from judge scoring; note in output.

**Error handling**: Partial judge results acceptable — skip failed agents from aggregation.

---

## Step 5 — Aggregate & Rank

Ranking is computed on **standard scenarios only** so baseline is comparable.

For each idea:
```
heuristic_avg = mean(composite) over standard scenarios
judge_avg     = mean(normalized judge score 0-10) over standard scenarios
                (skip scenarios where judge failed)
unified       = 0.6 × heuristic_avg + 0.4 × judge_avg
delta_vs_base = unified - baseline_unified
  (baseline_unified = same formula on the 5 baseline standard-scenario cells)
```

Targeted test heuristic scores (not in ranking — shown in Step 6 as diagnostics only):
```
targeted_heuristic = mean(composite) over the targeted tests for this idea
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
- `✓` if `targeted_heuristic ≥ 7.0` (hypothesis strength confirmed)
- `✗` if `targeted_heuristic < 6.0` (hypothesis weakness — may regress on this angle)
- `~` if 6.0 ≤ composite < 7.0 (neutral)

If `--save` was passed, emit the full winning variant text in a fenced block after the recommendation:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WINNING VARIANT TEXT (compression-1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```<full winning variantPromptText here>```
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
