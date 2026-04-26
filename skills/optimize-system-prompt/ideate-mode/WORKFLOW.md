# Ideate Mode Workflow (used by `/optimize-system-prompt --mode ideate`)

This file is the full autonomous ideation + benchmarking workflow that runs when `/optimize-system-prompt --mode ideate` is invoked. It was previously the standalone `/ideate-system-prompt` skill; it is now a sub-mode of optimize-system-prompt.

Autonomously generate N variant system prompts from the live base, benchmark each via
inline GAS exec (raw prompt strings — no deploy step), judge with LLM-as-judge, and
produce a ranked recommendation.

Complements optimize-system-prompt's default refinement/compression mode: those modes are user-directed (you tell the skill what to change), while ideate mode is generative (the skill proposes ideas autonomously). Both converge on the same A/B benchmarking infrastructure.

Note: still complementary to `/improve-system-prompt` — that skill benchmarks **pre-coded** variants (V2/V2a/V2b/V2c) defined in the GAS project; ideate mode generates *new* hypotheses on demand.

## Project Context

> **Project-specific skill** — adapt the values below to your own GAS project before use.
> Replace `<YOUR_SCRIPT_ID>` with your Apps Script script ID, and update the module paths
> and variant map to match your project's `SystemPrompt` and `ABTestHarness` module names.

- **ScriptId**: `<YOUR_SCRIPT_ID>`
- **GAS execution**: inline JS via `mcp__gas__exec` — no module to deploy
- **Base prompt**: loaded from `require('your-project/SystemPrompt')[variantFnName](null, null, SP.gatherEnvironmentContext())` — see variant map below
- **Scenarios**: `require('your-project/ABTestHarness').SCENARIOS` — update count to match your harness
- **Variant map**: `{ V2: 'buildSystemPromptV2', V2a: 'buildSystemPromptV2a', V2b: 'buildSystemPromptV2b', V2c: 'buildSystemPromptV2c' }`

## Argument Resolution

Parse `$ARGUMENTS` before Step 0. All steps reference these variables.

```
ARGS {
  base:             "V2a"                      // "V2"|"V2a"|"V2b"|"V2c" | NL: "use V2b" / "base V2b"
  ideas:            3                          // int ≥ 0 (0 valid when refineHypothesis set) | NL: "try N ideas"
  scenarios:        [0,1,2,3,4,5,6,7]         // int[] ∈ [0..11] | range "0-9", comma "0,2,4", or single | NL: "first N scenarios"
  targeted:         4                          // int ≥ 0 | NL: "no targeted tests" → 0
  model:            "claude-haiku-4-5-20251001" // benchmark model | NL: "use sonnet for bench" → claude-sonnet-4-6
  ideaModel:        "claude-sonnet-4-6"        // ideation model
  judgeModel:       "claude-opus-4-6"          // judge model
  save:             false                      // presence flag | NL: "save the winner" / "with save"
  refineHypothesis: null                       // string|null | NL: "refine: <text>" / "test this hypothesis: <text>"
  learnings:        null                       // string|null | NL: "--learnings <text>" / "incorporating learnings: <text>" / "with prior findings: <text>"
}

// Multi-param NL shortcuts (flag values take precedence)
"quick test" | "smoke test" | "mini run"  → ideas=1, scenarios=[0], targeted=1
"full run" | "default run"               → all defaults above
"only compression"                       → ideas=1
"no targeted" | "skip targeted"          → targeted=0
"incorporating learnings: <text>" | "with prior findings: <text>" → learnings=<text>
// If --learnings and --refine appear in same NL string: --learnings covers text before "refine:" / "test this:", --refine takes text after.
// If ambiguous: treat all prior-context text as learnings, emit ⚠ and prompt user to use --refine explicitly.

// Resolution: --flag wins over NL wins over default. Contradictory signals → last explicit statement.
// Unrecognized phrases → ignore (never abort).

COMPUTE {
  totalIdeas          = ideas + (refineHypothesis ? 1 : 0)
  learningsText = learnings ?? null   // pass through as-is; no truncation
  variantCells        = totalIdeas × (scenarios.length + targeted)
  baselineCells       = scenarios.length
  baselineTargetedCells = totalIdeas × targeted
  totalCells          = variantCells + baselineCells + baselineTargetedCells
  // default: 3 × (8 + 4) + 8 + 3×4 = 56 cells; --refine adds 1 extra idea
}

VALIDATE {
  base ∉ {"V2","V2a","V2b","V2c"}              → abort "Unknown base variant: <name>. Valid: V2, V2a, V2b, V2c"  // update to match your project's variant names
  any scenarios[i] ∉ [0..11]                  → abort "Invalid scenario index: <N>. Valid range: 0–11"  // update range to match your harness scenario count
  ideas < 1 && !refineHypothesis              → reset ideas=3, warn
  ideas < 1 && refineHypothesis               → valid (totalIdeas=1, only refinement runs)
}
```

---

## Step 0 — Ingest Base Prompt

### Pre-check

Read `your-project/ABTestHarness.gs` and verify:
- `SCENARIOS` element schema: `.id`, `.message`, `.validates`, `.category`
- `evaluateResponse(scenario, responseText)` return shape: `{ composite, scores }`

Read `your-project-core/ConversationClient.gs` and verify:
- Constructor: `new ClaudeConversation(apiKey, modelId, options)` where `options.system` is supported
- `sendMessage({ messages: [], text: testMessage, enableThinking: false })` → `{ response, usage }`

Read `your-project/SystemPrompt.gs` and verify:
- `build<base>` 3-arg signature: `(knowledge, historicalAnchors, environmentContext)`
- `gatherEnvironmentContext()` is exported

**Validate `--base` arg:** Known variants: V2, V2a, V2b, V2c. If unknown, abort:
`Unknown --base variant: <name>. Valid: V2, V2a, V2b, V2c`

**Validate `--scenarios` arg:** All requested indices must be in range 0–11 (SCENARIOS has 12 entries). If any index is out of range, abort:
`Invalid --scenarios index: <N>. Valid range: 0–11 (12 scenarios available)`

### Exec to load base prompt

```javascript
(function() {
  var SP = require('your-project/SystemPrompt');
  var envCtx = SP.gatherEnvironmentContext();
  return {
    basePromptText: SP['VARIANT_FN_NAME'](null, null, envCtx),
    envContextText: SP.formatEnvironmentContextJson(envCtx)
  };
})()
```

Before sending to exec, replace the literal string `VARIANT_FN_NAME` with the function name from
the variant map (e.g. `buildSystemPromptV2a`). The result is an object: store `result.basePromptText` as `basePromptText` and `result.envContextText` as `envContextText` (the formatted ENVIRONMENT CONTEXT block, appended to variants in Step 2).

If exec returns error, abort with: `Step 0 exec failed: <error>`. Emit:
```
Base prompt loaded: <base>  |  length: <basePromptText.length> chars
```
(substitute `<base>` with the parsed `base` variable and `<basePromptText.length>` with the actual char count)

### Config banner

Emit the banner after loading `basePromptText`. All values come from parsed args and runtime —
substitute each `<…>` token before printing. Do not print these as literal angle-bracket tokens.

```
totalIdeas   = ideas + (refineHypothesis ? 1 : 0)
variantCells = totalIdeas × (scenarios.length + targeted)
baselineCells = scenarios.length
baselineTargetedCells = totalIdeas × targeted
totalCells   = variantCells + baselineCells + baselineTargetedCells

╔══════════════════════════════════════════╗
║     ideate-system-prompt                 ║
╠══════════════════════════════════════════╣
║  Base       : <base> (<basePromptText.length> chars)  ║
║  Ideas      : <ideas>                    ║
[IF refineHypothesis is set:]
║  Refine     : "<first 60 chars of refineHypothesis>…" ║
[END IF]
[IF learnings is set:]
║  Learnings  : "<first 80 chars of learningsText>…" (<learningsText.length> chars) ║
[END IF]
║  Scenarios  : <scenarios[0]>-<scenarios[last]> (<scenarios.length> standard) ║
║  Targeted   : <targeted> per idea        ║
║  Cells      : <totalCells> (<variantCells> variant + <baselineCells> base + <baselineTargetedCells> base-targeted) ║
║  Bench model: <model>                    ║
║  Ideation   : <ideaModel>                ║
║  Judge      : <judgeModel>               ║
╚══════════════════════════════════════════╝
```

---

## Step 1 — Generate Hypotheses (Parallel Ideation Agents)

Spawn `ideas` ideation agents in parallel (default 3), each given `basePromptText` and one angle.

### Step 1a — Pre-ideation Diagnostic

Before spawning ideation agents, run ONE lightweight diagnostic agent using `ideaModel` to analyze
`basePromptText` through all 3 angles simultaneously. This runs sequentially — complete before
spawning ideation agents.

**Diagnostic agent prompt** (substitute `<BASE_PROMPT_TEXT>` with `basePromptText`):

```
You are analyzing a system prompt for a Google Sheets AI assistant.
Identify the top 2 SPECIFIC opportunities from each angle below:

1. COMPRESSION (Q7-anti-patterns, Q11-parallelization):
   - Q7: Does any section use hedging ("try to", "consider", "may want to") where imperative
     language is needed? Are any instructions overloaded (>3 tasks in one directive)?
   - Q11: Are there sequential steps that could execute in parallel? Any "do one at a time"
     patterns in instructions that span multiple independent subtasks?
   - Redundancy: Do any two sections repeat the same instruction in different words?
   Name the specific section (quote its header or first line) for each opportunity.

2. MISSING-COV (Q6-constraints, Q12-failure-modes, Q9-domain-specifics):
   - Q6: What constraints are missing that would prevent hallucination or off-task output?
   - Q12: Which edge cases and failure modes are unaddressed (happy-path-only design)?
   - Q9: What domain terminology, Google Sheets conventions, or GAS-specific patterns
     are absent but would improve output accuracy?
   Name the specific gap for each opportunity.

3. STRUCTURE (Q8-chain-of-thought, Q13-calibration, Q1-role, Q3-context):
   - Q8: Would explicit step-by-step reasoning improve output quality for this task?
   - Q13: Are decision thresholds precisely defined? Is the "present but weak" middle
     case explicitly named (not just clear pass and clear fail extremes)?
   - Q1/Q3: Is the role/persona clear? Is there enough context to avoid guessing?
   Cite the specific sections involved.

Base prompt:
<BASE_PROMPT_TEXT>

<PRIOR_LEARNINGS_SECTION>

Return ONLY valid JSON — no prose, no markdown:
<DIAGNOSTIC_JSON_SCHEMA>
```

Substitute `<PRIOR_LEARNINGS_SECTION>` as:
- If `learningsText` is set:
```
Prior run findings (incorporate into your analysis per angle):
<learningsText>

Classify each finding as: confirmed-positive (worked — build on it), confirmed-negative
(regressed — avoid unless a specific fix is described), or open (untested/inconclusive).
For each angle, your items should address still-unaddressed issues from the above findings
OR identify genuinely new opportunities beyond what's already known.
Do not repeat findings verbatim — describe the underlying prompt mechanism.
```
- If null: omit block entirely (remove the `<PRIOR_LEARNINGS_SECTION>` line from the prompt).

Substitute `<DIAGNOSTIC_JSON_SCHEMA>` as:
- If `learningsText` is set (structured schema):
```json
{
  "compression": [
    { "opportunity": "...", "learningStatus": "open|confirmed-positive|confirmed-negative|conflict", "note": "one sentence" }
  ],
  "missing": [...same structure...],
  "structure": [...same structure...],
  "_marker": "DIAGNOSTIC_COMPLETE"
}
```
- If `learningsText` is null (flat-string schema — unchanged behavior):
```json
{
  "compression": ["specific opportunity 1", "specific opportunity 2"],
  "missing": ["specific gap 1", "specific gap 2"],
  "structure": ["specific issue 1", "specific issue 2"],
  "_marker": "DIAGNOSTIC_COMPLETE"
}
```

Store the parsed result as `diagnosticContext`.

**Marker validation**: If `!diagnosticContext._marker`, emit debug output (first 200 chars of raw
response) and set `diagnosticContext = {}`. Proceed — diagnostics are enhancement, not required.

**Diagnostic injection into each ideation agent**: Before sending each ideation agent prompt,
resolve `<DIAGNOSTIC_FOR_THIS_ANGLE>` (see template below) as:
- `compression` angle → bullet list of `diagnosticContext.compression` items
- `missing-cov` angle → bullet list of `diagnosticContext.missing` items
- `structure` angle → bullet list of `diagnosticContext.structure` items
- If `diagnosticContext` is empty (fallback) → omit the entire diagnostic section from the prompt

**Angle assignment (pseudo-code):**
```
ANGLES = [
  { id: "compression",   desc: "Identify 2–3 sections that are over-specified or redundant. Propose a tightened version that preserves all critical behaviors while reducing length." },
  { id: "missing-cov",   desc: "Identify 2–3 failure modes or edge cases this prompt doesn't handle well. Propose targeted additions that address them without inflating length." },
  { id: "structure",     desc: "Identify instruction conflicts, confusing ordering, or sections that work against each other. Propose a restructured version with clearer hierarchy." }
]

# Spawn refinement agent FIRST (before auto-generated) when --refine is set
IF refineHypothesis is set:
  ideaId    = "refinement-1"
  angleDesc = refineHypothesis   # user's description IS the angle
  # Inject all 3 diagnostic angles (refinement benefits from full context)
  IF diagnosticContext is non-empty:
    diagnosticInjection = combined bullet list of all items from
      diagnosticContext.compression, diagnosticContext.missing, diagnosticContext.structure
  ELSE:
    omit diagnostic section
  [Spawn this agent CONCURRENTLY in the same parallel wave as auto-generated agents]
  [On success: PREPEND to ideas[] so refinement appears first in rankings]

for i in 0 .. ideas-1:
  angle    = ANGLES[i % 3]                   # cycle: 0→compression, 1→missing-cov, 2→structure, 3→compression, ...
  cycleNum = Math.floor(i / 3) + 1           # 1 for first cycle, 2 for second, etc.
  ideaId   = angle.id + "-" + cycleNum       # compression-1, missing-cov-1, structure-1, compression-2, ...
  angleDesc = angle.desc
```

The cycle number increments every 3 ideas. With `ideas=3`: compression-1, missing-cov-1,
structure-1. With `ideas=6`: adds compression-2, missing-cov-2, structure-2. Each ideaId
is unique and encodes both the angle and the cycle.

**Ideation agent prompt template (construct once per agent, substituting from parsed args):**

Before sending to each ideation agent, build the prompt string by substituting:
- `<BASE_PROMPT_TEXT>` → `basePromptText` (the full string loaded in Step 0)
- `<ANGLE_DESCRIPTION>` → `angleDesc` for this agent (from angle assignment above)
- `<TARGETED_COUNT>` → `targeted` (the parsed `--targeted` integer)
- `<IDEA_ID>` → `ideaId` for this agent (e.g. `"compression-1"`)
- The `targetedTests` array in the JSON template must have exactly `<TARGETED_COUNT>` placeholder entries — add or remove `{ "message": "...", ... }` lines to match

```
You are a prompt engineer improving a system prompt for a Google Sheets AI assistant.

Base prompt:
<BASE_PROMPT_TEXT>

Your angle: <ANGLE_DESCRIPTION>

<PRIOR_LEARNINGS_FOR_IDEATION>

<DIAGNOSTIC_FOR_THIS_ANGLE>

Generate exactly ONE variant hypothesis. Return ONLY valid JSON:
{
  "ideaId": "<IDEA_ID>",
  "hypothesis": "one-line description of the change and why it should help",
  "variantPromptText": "<full modified system prompt text>",
  "targetedTests": [
    { "message": "...", "validates": "...", "category": "..." }
    <repeat to total <TARGETED_COUNT> entries>
  ],
  "_marker": "IDEATION_COMPLETE"
}

Rules:
- variantPromptText must be the COMPLETE prompt (not a diff or partial patch)
- targetedTests must have exactly <TARGETED_COUNT> entries, each probing the specific hypothesis
- targetedTests[i].message is a user message that would go to the Sheets AI
- targetedTests[i].validates is what a good response should do
- targetedTests[i].category is a short label (e.g., "Context Handling", "Safety Gate")
- Return ONLY the JSON object — no prose, no markdown fence, no explanation
```

Substitute `<PRIOR_LEARNINGS_FOR_IDEATION>`:
- If `learningsText` is set (for auto-generated agents):
```
Prior run findings (use these to steer your hypothesis):
<learningsText>

Your hypothesis must:
- Directly address at least one confirmed failure mode OR extend a confirmed-positive finding
- If a prior approach regressed, either avoid it OR explain specifically what makes this
  attempt different (e.g. "adds a safety guard that was missing before")
- Not reproduce a prior idea unchanged — describe how your approach differs or improves
- If prior findings identify a regression scenario, include at least one targetedTest
  message that would reproduce that failure condition
```
- If `learningsText` is set AND this is the refinement agent (`refineHypothesis` set): use softer framing:
```
Additional context from prior runs:
<learningsText>
```
- If `learningsText` is null: omit block entirely (remove `<PRIOR_LEARNINGS_FOR_IDEATION>` line from prompt).

**`<DIAGNOSTIC_FOR_THIS_ANGLE>` substitution**: If `diagnosticContext` is non-empty, replace
`<DIAGNOSTIC_FOR_THIS_ANGLE>` with:

```
Diagnostic analysis of this prompt (identified opportunities for your angle):
- <opportunity 1>
- <opportunity 2>

Use these as starting points for your hypothesis. Your hypothesis should address at least one
of the identified opportunities above, or explain why a different opportunity is more impactful.
```

Where the bullet items come from the matching diagnostic key — formatted as:
- If flat-string schema (no learnings): `- <string>` for each item (unchanged behavior)
- If structured schema (learnings present): `- [<learningStatus>] <opportunity> — <note>` for each item
  - Items where `learningStatus === "confirmed-negative"` include an explicit warning so ideation agents
    are told to avoid that approach (e.g. `- [confirmed-negative] Removing caution phrasing — Prior run showed this caused hallucination on urgent scenarios`)

If `diagnosticContext` is empty, remove the `<DIAGNOSTIC_FOR_THIS_ANGLE>` line entirely from the prompt.

**Step 1 ideation summary** — when learnings are injected, add this annotation after the diagnostic line:
```
  [learnings: <learningsText.length> chars injected into diagnostic + all <totalIdeas> ideation agents]
```

**Error handling per agent:**
- Agent timeout (60s): log warning `[Step 1] Agent <angle> timed out — skipping` and skip
- JSON parse failure: retry once with "Return ONLY the raw JSON object, no other text"
- On second parse failure: emit first 200 chars of raw output before skipping that agent's idea
- `_marker` validation: after successful JSON parse, check `result._marker === "IDEATION_COMPLETE"` — if absent, emit first 200 chars of raw output and skip
- Schema validation: require `{ ideaId, hypothesis, variantPromptText, targetedTests[] }` — skip if missing required fields
- If `targetedTests.length < --targeted`, pad with generic Sheets queries or trim to actual count
- If 0 agents succeed: abort with `Step 1 failed: all ideation agents failed or timed out`
- If 1–2 succeed: proceed with fewer ideas, note in banner

**State output:** Store results as `ideas[]` — an array of objects matching the JSON schema above
(`{ ideaId, hypothesis, variantPromptText, targetedTests[] }`). This array is consumed by
Steps 2 and 3.

**Section diff (compute per idea before printing summary):**
Count `#`-prefixed header lines (lines starting with `#`) in `basePromptText` → `baseSectionCount`.
For each idea, count `#`-prefixed headers in `idea.variantPromptText` → `variantSectionCount`.
Find headers present in base but absent in variant → `missingSections[]` (by exact string match).
Find headers present in both but with different following content → `modifiedSections[]`.
Report as: `[sections: <variantSectionCount>/<baseSectionCount> preserved | <N> modified: <names>]`
If `variantSectionCount < baseSectionCount`, append ` ⚠ <baseSectionCount - variantSectionCount> dropped`.

Print ideation summary:
```
Step 1 — Ideation complete (3/3 ideas generated)
  [diagnostic: compression×2, missing×2, structure×2 opportunities identified]
  [IF refineHypothesis is set, show refinement-1 FIRST:]
  refinement-1    : <first 80 chars of hypothesis from agent response>
                    [sections: 12/14 preserved | 2 modified: THINKING PROTOCOL, SPREADSHEET CONTEXT]
  compression-1   : Removed redundant THINKING PROTOCOL phases 4-5 (-1,200 chars)
                    [sections: 12/14 preserved | 2 modified: THINKING PROTOCOL, SPREADSHEET CONTEXT]
  missing-cov-1   : Added explicit handling for multi-sheet operations
                    [sections: 14/14 preserved | 1 modified: MULTI-SHEET OPERATIONS]
  structure-1     : Reorganized KEY PRINCIPLES before TOOL USAGE section
                    [sections: 14/14 preserved | 3 modified: KEY PRINCIPLES, TOOL USAGE, STRUCTURE]
```

If `diagnosticContext` was empty (marker absent or parse failed), show instead:
`[diagnostic: unavailable — proceeding without grounding context]`

---

## Step 1b — Hypothesis Quality Gate

After collecting `ideas[]`, run a single gate agent (using `model`) to validate
each hypothesis before building the cell matrix. Skip ideas that fail G1.

**Gate prompt** (substitute `<IDEAS_JSON>` with JSON.stringify(ideas[]),
`<BASE_PROMPT_TEXT>` with `basePromptText`, and `<BASE_PROMPT_LENGTH>` with
`basePromptText.length`):

```
You are validating hypotheses for a prompt improvement experiment.

Base prompt length: <BASE_PROMPT_LENGTH> chars
Ideas to validate:
<IDEAS_JSON>

For each idea, evaluate 4 checks:
G1 (COMPLETENESS): Is variantPromptText a complete, self-contained prompt? Fail if it
   appears to be a diff, patch, or fragment (e.g. starts with "+" or "-", contains
   "<<<", or is less than 60% of base prompt length, or has fewer than 75% of the
   number of `#`-prefixed section headers present in the base prompt).
   Note: the 60% length floor and 75% section floor are calibrated so that aggressive
   but legitimate compression (targeting 60-80% of base) passes, while lossy
   reproduction (missing entire sections, <50% length) fails. Use G3 (warn) for
   variants that are trivially similar in length to base, not G1 (fail).
G2 (SPECIFICITY): Is the hypothesis field specific and actionable? Fail if it:
   - Is generic ("improve clarity", "make it better", fewer than 20 chars), OR
   - Describes a prior finding without specifying a concrete change to the prompt
     (e.g. "address confirmed regression on urgent tasks" with no prompt action stated).
   Pass if the hypothesis names a specific structural change to the prompt
   (e.g. contains "add", "remove", "restructure", "tighten", "replace", or names a
   specific section being modified).
G3 (DIFF): Is variantPromptText meaningfully different from the base prompt?
   Warn if the edit distance is <3% of base length (trivially similar).
G4 (UNIQUENESS): Do any two ideas appear to make the same change? Warn if two
   variantPromptText values share >70% of their non-base content.

Return ONLY valid JSON:
{
  "results": [
    {
      "ideaId": "...",
      "G1": "pass|fail", "G1_reason": "...",
      "G2": "pass|fail", "G2_reason": "...",
      "G3": "pass|warn", "G3_reason": "...",
      "G4": "pass|warn", "G4_reason": "..."
    }
  ],
  "_marker": "HYPOTHESIS_GATE_COMPLETE"
}
```

**Marker validation**: If `_marker` absent or JSON parse fails → emit warning
`[Step 1b] Gate failed to parse — proceeding with all ideas unchecked` and skip filtering.

**Filtering rules:**
- Ideas where `G1 === "fail"` OR `G2 === "fail"` → remove from `ideas[]`, note in output
- Ideas where `G3 === "warn"` OR `G4 === "warn"` → keep but emit warning

Print:
```
Step 1b — Hypothesis Gate (<passed>/<total> ideas pass)
  [IF any skipped:] Skipped: <ideaId> — <G1_reason or G2_reason>
  [IF any warnings:] ⚠ <ideaId>: <G3 or G4 reason>
```

**If all ideas are removed** (rare but possible — e.g. all ideation agents returned diffs):
Abort with: `Step 1b: all hypotheses failed quality gate. Re-run to generate new ideas.`

**Update cell count banner** (Step 2 matrix print) to reflect the actual number of
surviving ideas after gate filtering.

**Env context injection (after Step 1b quality gate completes, before Step 2):**
For each idea in ideas[]:
  idea.variantPromptText = idea.variantPromptText + "\n\n" + envContextText

Timing: injection occurs AFTER Step 1b so the G1 length check evaluates prompt
instruction content only (without env context appended). This is intentional — G1
validates instruction quality, not total deployed length. Injection is the last step
before Step 2 builds the cell matrix.

This gives every variant the same live spreadsheet context as the baseline, ensuring
the benchmark tests prompt instruction quality rather than contextual awareness.

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
- **Baseline targeted cells**: `basePromptText` × each idea's targeted test messages
  - One set per idea (so the baseline is compared against the same targeted messages)
  - `variantText` = `basePromptText`
  - `testMessage` = `idea.targetedTests[i].message`
  - `validates`   = `idea.targetedTests[i].validates`
  - `category`    = `idea.targetedTests[i].category`
  - `ideaId`      = `"baseline-targeted-" + idea.ideaId`
  - `testType`    = `"baseline-targeted"`
  - `scenarioId`  = `"targeted-" + String(i)`

Print matrix summary:
```
Idea matrix: 3 ideas × (8 std + 4 targeted) cells + 8 baseline std cells + 3×4 baseline targeted cells = 56 cells
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
    var AB = require('your-project/ABTestHarness');
    var CC = require('your-project-core/ConversationClient');
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
    var AB = require('your-project/ABTestHarness');
    var CC = require('your-project-core/ConversationClient');
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

The "Template" column indicates which exec template(s) each placeholder appears in.
`ideaId` and `testType` are hardcoded string literals in the baseline template —
do NOT attempt to substitute them there.

| Placeholder | Template | Source | Example value in JS |
|---|---|---|---|
| `<JSON_STRINGIFIED_PROMPT>` | variant only | `cell.variantText` (idea variant) | `"You are..."` |
| `<JSON_STRINGIFIED_BASE_PROMPT>` | baseline only | `basePromptText` | `"You are..."` |
| `<JSON_STRINGIFIED_MESSAGE>` | both | `cell.testMessage` | `"Sum column B"` |
| `<JSON_STRINGIFIED_VALIDATES>` | both | `cell.validates` | `"Uses SUM formula"` |
| `<JSON_STRINGIFIED_CATEGORY>` | both | `cell.category` | `"Formula"` |
| `<JSON_STRINGIFIED_MODEL>` | both | `--model` arg | `"claude-haiku-4-5-20251001"` |
| `<JSON_STRINGIFIED_IDEA_ID>` | variant only | `cell.ideaId` | `"compression-1"` |
| `<JSON_STRINGIFIED_TEST_TYPE>` | variant only | `cell.testType` | `"standard"` or `"targeted"` |
| `<JSON_STRINGIFIED_SCENARIO_ID>` | both | `cell.scenarioId` | `"0"`, `"1"`, `"targeted-0"` |

Each placeholder produces a complete JSON string literal (with surrounding double quotes) and must
be placed verbatim into the JS source — do not add extra quotes around it.

**Progress display** (update after each cell completes):
```
[▓▓▓▓▓▓▓░░░░░░░░░░░░░] 12/56 cells  (compression-1/std/scenario-3 ✓)
```

The progress label is computed per cell as:
```
label = cell.ideaId + "/" + cell.testType.slice(0,3) + "/scenario-" + cell.scenarioId
# Examples:
#   ideaId="compression-1", testType="standard", scenarioId="3"  → "compression-1/std/scenario-3"
#   ideaId="missing-cov-1", testType="targeted", scenarioId="targeted-0" → "missing-cov-1/tar/scenario-targeted-0"
#   ideaId="baseline",      testType="standard", scenarioId="2"  → "baseline/std/scenario-2"
```

**Retry**: If the `mcp__gas__exec` tool call itself errors (non-zero exit or tool error), OR if the
returned object contains an `error` field → retry once. The inner JS try/catch always returns a
valid object (never a raw exception), so `result.error` being set is the per-cell failure signal.

**Failure tracking**: Track two counters:
- `consecutive_cell_failures = 0` — reset on each success
- `total_failed_cells = 0` — never reset

After each cell completes:
- If the cell has `error` (after retry) → increment both counters
- If the cell succeeds → reset `consecutive_cell_failures = 0` only

**Circuit breaker** (consecutive): If `consecutive_cell_failures >= 3`, abort immediately with:
```
Step 3 circuit breaker: 3 consecutive cell failures.
Last error: <last_error>
Suggest: check GAS quota, verify require() paths are reachable.
```

**Cumulative abort**: After each cell, if `cells_processed >= 5` AND `total_failed_cells / cells_processed > 0.20`, abort:
```
Step 3 cumulative abort: <total_failed_cells>/<cells_processed> cells failed (>20%).
Failed cells: <list of failed ideaId/scenarioId pairs>
Suggest: check GAS quota, verify require() paths are reachable.
```

The threshold of 5 is chosen because: at 5 cells, 2 failures = 40% which clearly signals a systemic problem. At 3 cells (quick test), the cumulative check never fires — circuit breaker (3 consecutive) handles early runs.
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

**Label assignment (execute once per scenario, independently):**
```
# Collect all configs for this scenario
configs = cellResults[] where scenarioId === String(scenarioIndex) and testType === "standard"
# → one entry per ideaId (ideas + baseline), N+1 total

# Shuffle configs for position blinding (use a different shuffle per scenario)
shuffled = shuffle(configs)    # random permutation — different seed each call

# Assign single-letter labels in shuffled order
LABELS = ["A", "B", "C", "D", "E", "F", ...]  # extend as needed
labelMap = {}                  # label → ideaId (private; never shown to judge)
for i in 0 .. shuffled.length - 1:
  label         = LABELS[i]
  labelMap[label] = shuffled[i].ideaId
```

The judge sees only the labels. After parsing the judge result, remap:
```
winner_ideaId = labelMap[result.winner]
```

**Label cardinality**: Total configs = ideas that produced results + 1 (baseline).
For 3 ideas: 4 configs → labels A/B/C/D. For 2 ideas: 3 configs → labels A/B/C.
Build the judge prompt's config block and JSON template from `shuffled` — one entry per label.
Never hardcode the number of configs in the template.

**Judge prompt template** (construct this string dynamically for each scenario — the
config block and JSON template must be built to match the actual number of configs
for this run, not hardcoded to 4 entries):

```
You are evaluating system prompt configurations for a Google Sheets AI assistant.
Scenario: "<scenario.message>" (Category: <scenario.category>)
Validates: <scenario.validates>

Context for each configuration (use to inform your reasoning, not to bias scoring):
<FOR EACH label in shuffled labels — repeat this block once per config>
  [<label>] Testing: "<idea.hypothesis for this ideaId>" (or "Baseline — unmodified <base>" for baseline)[IF learningsText is set AND this config is non-baseline: append " | Prior context: "<first 120 chars of learningsText>…""]
</END FOR>

Configurations (labels assigned randomly — do not infer identity from order):
<FOR EACH label in shuffled labels — repeat this block once per config>
  [<label>] Heuristic composite: <composite_for_label>/10
  Response:
  ---
  <response_for_label>
  ---
</END FOR>

Score each configuration on these 5 dimensions (1–5 scale each):
  1. Accuracy    — Is the response factually correct and appropriate for the request?
  2. Helpfulness — Does it actually help the user accomplish their goal?
  3. Safety      — Does it protect against destructive operations appropriately?
  4. Tool Use    — Does it correctly identify what tools/APIs are needed?
  5. Conciseness — Is the response appropriately sized (not too verbose, not too short)?

For each non-baseline configuration, assess whether responses suggest the stated hypothesis
change is working as intended (use "achieved", "partial", or "unclear"):
  - achieved  — responses strongly suggest the hypothesis change is working as intended
  - partial   — some evidence the hypothesis is working, but inconsistent
  - unclear   — can't tell from this scenario alone

Additionally, for each non-baseline configuration, assess regression risk:
Does the variant's response miss, soften, or fail to apply any behavior the baseline
response correctly demonstrates for this scenario?
  - "none"  — no regression detected in this scenario
  - "minor" — variant misses a secondary behavior baseline handles
  - "major" — variant fails on a primary behavior baseline handles correctly

Return ONLY valid JSON in this exact format (one key per config label — adjust to match
the actual labels present above):
{
  "scenarioId": "<scenarioId>",
  "judgments": {
    "<label1>": {"accuracy": X, "helpfulness": X, "safety": X, "toolUse": X, "conciseness": X},
    "<label2>": {...}
  },
  "winner": "<label>",
  "reasoning": "1-2 sentence explanation",
  "hypothesisEffectiveness": {
    "<label_for_non_baseline_idea>": {"assessment": "achieved|partial|unclear", "evidence": "one sentence"}
  },
  "regressionRisk": {
    "<label_for_non_baseline_idea>": {"risk": "none|minor|major", "evidence": "one sentence or null"}
  },
  "_marker": "JUDGE_COMPLETE"
}
```

Note: `hypothesisEffectiveness` should include one entry per non-baseline config only (exclude
baseline). The `_marker` field must always be present.

Example for 3 ideas (4 configs: A/B/C/D); for 2 ideas use 3 configs (A/B/C); adjust
accordingly. Always derive label count from the actual number of configs, never hardcode 4.

The judge returns only `"winner": "<label>"` — it does NOT return `winner_idea`.
After parsing the judge result, remap: `winner_ideaId = labelMap[result.winner]`.
Store `winner_ideaId` alongside the parsed result before aggregating.

**Position blinding**: Randomize label assignment independently for each scenario to prevent
position bias. Use a different shuffle for each judge agent call.

**Normalization**: For each config's judgment, compute `raw_avg = mean([accuracy, helpfulness, safety, toolUse, conciseness])` (1–5 scale), then rescale to 0–10 via `(raw_avg - 1) / 4 * 10`.

**Retry**: JSON parse failure → retry once with stricter "return ONLY the JSON object, no other text". On second failure → emit first 200 chars of raw output before marking failed. On timeout (30s) → skip that scenario from judge scoring; note in output.

**`_marker` validation**: After successful JSON parse, check `result._marker === "JUDGE_COMPLETE"` — if absent, emit first 200 chars of raw output and mark that judge result as `status: "failed"`.

**State output**: After all judge agents complete, store results as `judgeResults[]`. Each entry
must record:
- `scenarioId` — the scenario this judge evaluated
- `status` — `"ok"` or `"failed"` (failed = parse failure after retry, marker absent, or timeout)
- `judgments` — map of label → normalized score (0–10), populated only on `"ok"` entries
- `labelMap` — map of label → ideaId (populated only on `"ok"` entries)
- `winner_ideaId` — remapped winner (populated only on `"ok"` entries)
- `hypothesisEffectiveness` — raw map from judge output, populated only on `"ok"` entries
- `regressionRisk` — raw map from judge output (`{label: {risk, evidence}}`), populated only on `"ok"` entries; use `labelMap` to identify the per-idea label

Step 5 uses `judgeResults[]` to filter: only entries with `status === "ok"` contribute
to judge averages. The `scenarioId` field identifies which scenarios to include per idea.

**Quorum gate**: After all judge agents complete:
```
quorum = ceil(scenarios.length / 2)
judge_ok_count = judgeResults[].filter(r => r.status === "ok").length

IF judge_ok_count < quorum:
  emit: "⚠️  Judge quorum not met ({judge_ok_count}/{scenarios.length} scenarios ok — need ≥{quorum})
         Ranking will use heuristic scores only."
  SET judge_data_available = false
  SET full_quorum = false
ELSE:
  SET judge_data_available = true
  SET full_quorum = (judge_ok_count >= scenarios.length)
```

**Error handling**: Partial judge results acceptable — skip failed scenarios from judge aggregation.

---

## Step 5 — Aggregate & Rank

Ranking is computed on **standard scenarios only** (filter `cellResults[]` to
`testType === "standard"`) so baseline is directly comparable.

**Compute `baseline_unified` first** (needed for delta calculation):

Note: unified weights are 0.4 heuristic + 0.6 judge — judge-weighted because novel hypothesis quality
is better assessed qualitatively. (Compare: /improve-system-prompt uses 0.6 heuristic + 0.4 judge
for pre-coded variants where heuristic consistency matters more. Scores across the two skills are
not directly comparable.)

```
baseline_cells     = cellResults[] where ideaId === "baseline" and testType === "standard"
baseline_heuristic = mean(composite) over baseline_cells

IF judge_data_available:
  baseline_judge   = mean(normalized judgment score for "baseline" label) over
                     judgeResults[] entries where status === "ok"
                     (use labelMap to identify which label mapped to "baseline" per scenario)
  baseline_unified = 0.4 × baseline_heuristic + 0.6 × baseline_judge
ELSE:
  baseline_unified = baseline_heuristic
```

For each idea (filter `cellResults[]` to matching `ideaId` and `testType === "standard"`):
```
heuristic_avg = mean(composite) over standard-scenario cells for this idea

IF judge_data_available:
  judge_avg = mean(normalized judgment score for this idea's label) over
              judgeResults[] entries where status === "ok" and this idea participated
              (use labelMap per entry to find the label that mapped to this ideaId,
               then read judgments[label] for the normalized score)
  unified   = 0.4 × heuristic_avg + 0.6 × judge_avg
ELSE:
  unified   = heuristic_avg

delta_vs_base = unified - baseline_unified
```

**Delta tier** (compute after all unifieds are calculated):
```
delta = winner.unified - baseline_unified   # winner = idea with highest unified score
IF    delta >= 0.5 : delta_tier = "CLEAR"
ELIF  delta >= 0.2 : delta_tier = "SOLID"
ELIF  delta >= 0.05: delta_tier = "MARGINAL"
ELSE               : delta_tier = "NOISE"
```

**Hypothesis effectiveness aggregation** (diagnostic only — separate from ranking):
```
For each idea:
  effectiveness_count[idea.ideaId] = count of judgeResults[] entries where:
    - status === "ok"
    - hypothesisEffectiveness[label_for_this_idea].assessment === "achieved"
    (use labelMap to find the label for this ideaId per scenario entry)
  effectiveness_total[idea.ideaId] = count of judgeResults[] entries where:
    - status === "ok"
    - hypothesisEffectiveness has a key for this idea's label
```

**Regression tracking** (diagnostic only — used in Step 6 anomalies):
```
For each idea:
  major_regression_count[idea.ideaId] = count of judgeResults[] entries where:
    - status === "ok"
    - regressionRisk exists AND regressionRisk[label_for_this_idea] exists
      AND regressionRisk[label_for_this_idea].risk === "major"
    (use labelMap to find the label for this ideaId per scenario entry;
     guard against missing regressionRisk on partial/legacy judge responses)
  major_regression_total[idea.ideaId] = count of judgeResults[] entries where:
    - status === "ok"
    - regressionRisk exists AND regressionRisk[label_for_this_idea] exists
    (same guard as above — denominates only scenarios where regressionRisk was assessed)
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
show `[heuristic only]` in the Judge column and use heuristic_avg as unified:

```
║ missing-cov-1      │  7.6 [h-only] │   N/A    │  7.60    │  +0.12        ║
```

If an idea has 0 successful standard-scenario cells in `cellResults[]` (all failed in Step 3),
exclude it from the ranking table entirely and note:
`[idea-id] excluded: no successful standard cells to rank`

---

## Step 6 — Recommendation Block

The winner is the idea with the highest `unified` score. Use `ideas[]` to look up
`winner.hypothesis` and `winner.variantPromptText`. Use `cellResults[]` for
`winner.promptLength` (from `promptLength` field of any standard cell for that idea).

For the targeted test diagnostics, iterate over `winner.targetedTests` (from `ideas[]`)
and pair each with its `cellResults[]` entry (match by `ideaId === winner.ideaId` and
`scenarioId === "targeted-" + String(i)`). Use `cell.composite` for the score and
`winner.targetedTests[i].category` for the label.

**Confidence level** (compute from `delta_tier` and `full_quorum`):
| Condition | Confidence |
|-----------|-----------|
| `delta_tier == "CLEAR"` AND `full_quorum == true` | `HIGH` |
| `delta_tier == "SOLID"` OR (`delta_tier == "CLEAR"` AND `judge_data_available && !full_quorum`) | `MEDIUM` |
| `delta_tier == "MARGINAL"` OR `judge_data_available == false` | `LOW` |
| `delta_tier == "NOISE"` | `INCONCLUSIVE` |

**When `delta_tier == "NOISE"`, emit INCONCLUSIVE block instead of winner block:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RESULT: INCONCLUSIVE — no clear winner
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Top candidate: <top_idea_id> (Δ <delta> — within noise)
  Baseline (<base>/V2a): <baseline_unified>

  No variant exceeded the noise threshold (±0.05 vs baseline).
  Suggestions:
  → Re-run with more scenarios (--scenarios 0-9) for higher signal
  → Try bolder angles (the current ideas may be too similar to base)
  → Inspect targeted test diagnostics below for hypotheses worth developing
[IF learnings is set:]
  → Check whether prior learnings still apply to the current base prompt version (prompt may have changed since last run)
  → Try: --ideas 1 --scenarios 0-9 targeting the specific failure mode from learnings for higher statistical power
[END IF]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When `delta_tier != "NOISE"`, emit winner block:**

**Winner scope check** (runs only when `delta_tier != "NOISE"`):

Spawn one lightweight agent (using `model`) comparing `winner.variantPromptText`
against `basePromptText`:

```
Compare these two system prompt versions. Answer 5 questions:

SW1 (SECTIONS): Does the winner preserve the major structural sections/topics of the
    base? Answer: pass|warn|fail — name any dropped or merged sections.
SW2 (DIRECTIVES): Did any mandatory/imperative language soften?
    ("must"→"should", "always"→"consider", "never"→"avoid if possible")
    Answer: pass|warn|fail — cite specific instances.
SW3 (EXAMPLES): Were concrete examples, schema definitions, or worked samples removed?
    Answer: pass|warn|fail — name what was removed.
SW4 (LENGTH): Winner length vs base length ratio: <WINNER_LEN>/<BASE_LEN> = <RATIO>.
    Answer: pass if ratio >= 0.70; warn if 0.50–0.70; fail if < 0.50.
SW5 (EXCLUSIONS): Were new "NOT for", "do not", or exclusion constraints added?
    Answer: pass|warn — list any additions (additions are not necessarily bad,
    but should be surfaced).

Return ONLY valid JSON:
{
  "SW1": "pass|warn|fail", "SW1_detail": "...",
  "SW2": "pass|warn|fail", "SW2_detail": "...",
  "SW3": "pass|warn|fail", "SW3_detail": "...",
  "SW4": "pass|warn|fail", "SW4_detail": "...",
  "SW5": "pass|warn",      "SW5_detail": "...",
  "_marker": "SCOPE_CHECK_COMPLETE"
}

Base prompt:
<basePromptText>

Winner prompt:
<winner.variantPromptText>
```

**Marker validation**: If parse fails → set `scopeCheckResult = null`, proceed.

**Surface results in anomalies**:
- Any `fail` result → add to anomalies list
- `warn` on SW1, SW2, or SW3 → add to anomalies (structural content changes worth surfacing)
- `warn` on SW4 alone (length drop, but SW1/SW2/SW3 all pass) → **do NOT add to anomalies** — a compression-angle winner shortening the prompt is the intended outcome, not a regression
- `warn` on SW4 combined with SW1/SW2/SW3 warn/fail → add: compression removed content alongside length reduction
- SW5 `warn` (new exclusions added) → add only if the exclusion appears to narrow the prompt's intended scope (judgment call — additions may be intentional)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WINNER: compression-1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Hypothesis: Removed 1,200 chars from THINKING PROTOCOL (phases
              4-5 were redundant with KEY PRINCIPLES section).
  Unified: 7.92 (+0.35 vs V2a baseline)
  Confidence: MEDIUM
  Hypothesis effectiveness: achieved in 4/5 judge scenarios
  Prompt length: 16,800 chars (-1,200 vs base)
  Judge winner in: 4/5 standard scenarios

**Targeted test discrimination**: For each targeted test, look up the matching
`baseline-targeted-<ideaId>` cell result (same scenarioId). Show baseline composite
and delta (variant minus baseline, signed) alongside variant composite.

  Targeted test diagnostics (hypothesis-specific, heuristic only — not in ranking):
  ✓ Multi-step planning: 7.8  (baseline: 4.2  Δ+3.6)
  ✓ Code gen constraint: 7.4  (baseline: 7.1  Δ+0.3)
  ✗ Context window use: 5.2  (baseline: 6.8  Δ-1.6)

  ⚠ Anomalies:   (only show if any condition is true)
  - Judge quorum not met (2/5 scenarios): ranking is heuristic-only
  - Delta is marginal (0.12): results may not be significant
  - Hypothesis effectiveness unclear: achieved in only 1/5 judge scenarios
  - Targeted tests show weaknesses: Context window use (5.2)

  Next step:
  → Run /improve-system-prompt --variants V2a,<winner> to full 40-cell benchmark
  → OR use --save to get the variant text for manual review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Anomaly conditions** (include in the ⚠ Anomalies section only when true):
- `!judge_data_available` → "Judge quorum not met ({judge_ok}/{total} scenarios): ranking is heuristic-only"
- `delta_tier == "MARGINAL"` → "Delta is marginal ({delta:.2f}): results may not be significant"
- Winner's `effectiveness_count / effectiveness_total < 0.4` (and `effectiveness_total > 0`) → "Hypothesis effectiveness unclear: achieved in only {count}/{total} judge scenarios"
- Any targeted test with `composite < 6.0` → "Targeted tests show weaknesses: {category} ({composite})"
- `major_regression_count[winner.ideaId] > 0` → "Regression detected: winner scored 'major' regression in {major_regression_count[winner.ideaId]}/{major_regression_total[winner.ideaId]} judge scenarios — baseline handles something the winner misses"

If no anomalies are true, omit the `⚠ Anomalies:` section entirely.

**`Hypothesis effectiveness:` field**: Show only if `effectiveness_total > 0`. Format as "achieved in {effectiveness_count}/{effectiveness_total} judge scenarios". If `effectiveness_total == 0`, omit the line.

**Targeted test status symbols:**
- `✓` if `composite >= 7.0` (hypothesis strength confirmed)
- `✗` if `composite < 6.0` (hypothesis weakness — may regress on this angle)
- `~` if `6.0 <= composite < 7.0` (neutral)

If `--save` was passed, emit the full winning variant text after the recommendation block.
Do NOT use triple-backtick fences (the prompt text may contain backticks). Emit the raw
text exactly as stored in `winner.variantPromptText` — no quoting, no escaping, no
markdown wrapping. The two separator lines are the only delimiters the user has.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WINNING VARIANT TEXT (compression-1)
  (copy everything between the separators)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<winner.variantPromptText printed verbatim — no extra indentation, no wrapping, no quoting>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**LEARNINGS block** (when `--save` is passed, always emit after winner or INCONCLUSIVE block):

Construct a compact learnings string (target ≤200 chars) summarizing this run's key outcome:
- If winner (not INCONCLUSIVE): `Winner: <ideaId> (Δ<delta:.2f> unified, <confidence> confidence). <winner.hypothesis first 100 chars>. Regressions: <major_regression_count[winner.ideaId]> major.[IF any targeted composite < 6.0: append " Targeted weakness: <category> (<composite>)."][END IF]`
- If INCONCLUSIVE: `INCONCLUSIVE (best: <top_idea_id>, Δ<delta:.2f>). No clear winner vs <base> baseline. Top candidate: <first 60 chars of top_idea hypothesis>.`

Emit:
```
━━━ LEARNINGS FOR NEXT RUN (paste as --learnings "...") ━━━
<learnings string>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Error Handling

- **>20% cell failures**: Print failed cell list with error messages, abort, suggest checking GAS quota.
  Threshold: >6 of 32 for default run (scales with actual cell count × 0.20).
- **Judge JSON parse failure ×2**: Skip that scenario in judge scoring, note in output.
- **All judge agents fail**: Rank by heuristic_avg only; note `[Judge: unavailable]` in table.
- **All cells fail**: Abort with diagnostic. Check that `require('your-project/ABTestHarness')` and
  `require('your-project-core/ConversationClient')` are available in exec context.
- **Baseline exec failure**: If >3 of 5 baseline cells fail, note that delta_vs_base is unreliable.

---

## Quick Smoke Tests

```bash
# Minimal (formal flags): 1 idea, 1 scenario, 1 targeted — 3 cells
/ideate-system-prompt --ideas 1 --scenarios 0 --targeted 1

# Minimal (natural language): same run
/ideate-system-prompt quick test

# Small: 1 idea, 5 std + 2 targeted + 5 baseline = 12 cells
/ideate-system-prompt --ideas 1 --scenarios 0-4 --targeted 2

# Full default run (56 cells)
/ideate-system-prompt

# Full run with save, natural language
/ideate-system-prompt full run, save the winner

# Mixed: natural language + formal flag override
/ideate-system-prompt try 5 ideas --base V2b --save
```
