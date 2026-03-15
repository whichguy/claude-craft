---
name: improve-prompt
description: |
  Research-backed prompt improvement workflow. Analyzes with Q1-Q10 structural diagnostics,
  researches domain + prompt engineering best practices, generates fixed+dynamic evaluation
  questions, validates improvement plan (quality gate), runs E parallel experiment variants,
  scope-preservation gate (12-question check against baseline for unintended regression),
  evaluates via questions-based judge (not holistic), reconciles all learnings into a single
  ideas file, and commits only if improved. Loops autonomously with stall detection — continues
  seeking improvements until max_stalls consecutive failures (default 2). Strategy escalation
  guides bolder changes after stalls. Position bias mitigated via randomized judge ordering.
  Supports --iterations N, --experiments N, and --max-stalls N.

  AUTOMATICALLY INVOKE when user mentions:
  - "improve this prompt", "make this prompt better", "optimize this prompt"
  - "prompt improvement", "iterate on prompt", "evolve this prompt"

  STRONGLY RECOMMENDED for:
  - Before finalizing agent/skill prompts
  - When a prompt's outputs are inconsistent or low quality
  - After receiving feedback that a prompt is underperforming

argument-hint: "<prompt-file> [inputs-dir|input-text] [num-inputs N] [free-form options]"
allowed-tools: Agent, Bash, Read, Glob, Write, WebSearch, WebFetch, Skill
---

# improve-prompt Skill

Research-backed prompt improvement loop: structural diagnostics (Q1-Q10) → domain research →
fixed+dynamic evaluation questions → plan quality gate → E parallel experiment variants →
scope-preservation gate (12-question baseline check) → questions-based judge (position-randomized) →
reconciled learnings → commit on IMPROVED, revert + continue on NEUTRAL/REGRESSED (stall detection).
Auto-generates test inputs when needed. Loops autonomously until max_stalls consecutive failures.

## Argument Reference

The arguments after `/improve-prompt` are **free-form text**. The LLM interprets them
to extract the following values:

| Parameter | Required? | What to look for | Default |
|-----------|-----------|-------------------|---------|
| `prompt_path` | **yes** (unless inline text provided) | A file path (contains `/` or `.`) | — |
| `inputs_dir` | no | A directory path for test inputs. Auto-generated if not provided and prompt needs input | — |
| `inline_text` | alt to prompt_path | Quoted text or explicitly described as "inline prompt" | — |
| `input_text` | no | Inline text to use as a single test input. Look for quoted strings after the prompt path, or text after "with input", "using text", "test with" | — |
| `num_inputs` | no | Number of test inputs to auto-generate if user approves | 3 (max: 10) |
| `label` | no | A short identifier for reports/commits | basename of prompt file, or "inline" |
| `run_model` | no | A model name (claude-*) | claude-sonnet-4-6 |
| `judge_model` | no | A model name for judging | claude-opus-4-6 |
| `iterations` | no | A number associated with "iterations" | 1 |
| `experiments` | no | A number associated with "experiments" or "variants" | 1 (max: 4) |
| `max_stalls` | no | Number associated with "max stalls", "stall limit", "--max-stalls" | 2 |

**Input sources** (priority order):
- `inputs_dir` — directory of test files (each file = one test case)
- `input_text` — inline text string (becomes a single test case named "inline-input")
- If both provided: directory files + inline text are all used as test cases
- If neither provided: prompt is analyzed; if input needed, test inputs are auto-generated (see Step 0b)

**Example invocations:**
```
/improve-prompt agents/code-reviewer.md skills/improve-prompt/inputs/
/improve-prompt agents/code-reviewer.md with inputs from skills/improve-prompt/inputs/ run 3 iterations
/improve-prompt the prompt at agents/code-reviewer.md, test inputs in inputs/, 3 experiments
/improve-prompt improve agents/code-reviewer.md using inputs/ as test dir, label=my-test, use haiku for judge
/improve-prompt --prompt agents/code-reviewer.md --inputs inputs/  (legacy flag style also works)
/improve-prompt agents/code-reviewer.md                            (no inputs — auto-generates test inputs if needed)
/improve-prompt agents/code-reviewer.md "function foo() { return bar }"  (inline text as single test case)
/improve-prompt agents/code-reviewer.md 5 inputs                   (auto-generates 5 test inputs)
/improve-prompt agents/code-reviewer.md 5 iterations --max-stalls 3 (keeps trying through 3 consecutive stalls)
/improve-prompt "You are a haiku generator. Write a haiku about clouds."  (self-contained — runs with empty input)
```

---

## Step 0 — Parse & Preflight

**Interpret arguments from `<prompt-arguments>` as free-form text.**

Extract these values by understanding the user's intent — they may use flags, positional
paths, natural language, or any combination:

| Variable | How to identify |
|----------|----------------|
| `prompt_path` | A file path to the prompt to improve. Look for paths containing `/` or `.md`. If `--prompt` flag is present, use its value. |
| `inline_text` | Quoted text or content explicitly described as inline/literal prompt text. If `--prompt-text` flag is present, use its value. Mutually exclusive with prompt_path. |
| `inputs_dir` | A directory path for test inputs. Look for paths associated with words like "inputs", "test", "dir". If `--inputs` flag is present, use its value. Optional — may be absent. |
| `input_text` | Inline text to use as test input. Look for quoted strings after the prompt path, or text after "with input", "using text", "test with". Also: any substantial free-form text that is clearly meant as input content (not a path, label, or model). If `--input` or `--text` flag is present, use its value. Optional — may be absent. |
| `num_inputs` | Number of test inputs to auto-generate. Look for a number associated with "inputs", "test inputs", "generate", or `--num-inputs`. Optional — may be absent. |
| `label` | A short name for reports. Look for "label", "name", "called", or `--label`. |
| `run_model` | A model identifier (claude-*). Look for "model", "use", "with", or `--model`. |
| `judge_model` | A model for judging. Look for "judge", "judge-model", or `--judge-model`. |
| `iterations` | A number associated with "iterations", "times", "rounds", or `--iterations`. |
| `experiments` | A number associated with "experiments", "variants", "parallel", or `--experiments`. |
| `max_stalls` | A number associated with "max stalls", "stall limit", or `--max-stalls`. |

**Defaults** (apply when not found in arguments):
- `label` = basename of prompt_path without extension (or "inline" for inline_text mode)
- `run_model` = claude-sonnet-4-6
- `judge_model` = claude-opus-4-6
- `iterations` = 1
- `experiments` = 1
- `max_stalls` = 2
- `inputs_dir` = none
- `input_text` = none
- `num_inputs` = 3

**Value validation for `num_inputs`**: Must be between 1 and 10. If exceeded, clamp to 10 with warning: `"Warning: num_inputs clamped to 10 (was {N})."`

**Create temp dir first (needed for inline mode below):**
```bash
IMPROVE_TMPDIR=$(mktemp -d /tmp/improve-prompt.XXXXXX)
trap 'rm -rf "$IMPROVE_TMPDIR"' EXIT INT TERM
```

**Prompt-as-code resolution:**
1. If inline_text was identified → write to `$IMPROVE_TMPDIR/inline-prompt.md`; set prompt_path to that; label = "inline" (unless label was provided)
2. If prompt_path was identified → parse YAML frontmatter (text between leading `---` markers); extract `defaults.*` as fallback values for unset args; strip frontmatter to get raw prompt text

**Requirement validation — abort immediately if any required value is missing:**

After interpreting the arguments, check:

1. **Prompt source**: Either `prompt_path` or `inline_text` must be identified.
   If neither found → abort:
   "ERROR: Could not identify a prompt file or inline text in the arguments.
   Provide a file path or quoted inline text.
   Example: /improve-prompt path/to/prompt.md path/to/inputs/"

2. **Value validation**:
   - label must match `[a-zA-Z0-9_-]+`
   - run_model and judge_model must match `claude-*`
   - iterations >= 1
   - experiments between 1 and 4
   - max_stalls >= 1
   - num_inputs between 1 and 10 (clamp with warning if exceeded)
   - inputs_dir must exist on disk (if provided)
   - prompt_path must exist on disk (if not inline mode)
   - On any validation failure: print clear error before exiting (trap covers cleanup)

### Step 0b — Smart Input Resolution

Determine input sources using a 3-branch flow:

```
IF inputs_dir is provided OR input_text is provided OR (defaults.inputs_dir is set in frontmatter AND inputs_dir not already set):
  # User provided inputs (or frontmatter default) — use them exactly
  IF defaults.inputs_dir is set in frontmatter AND inputs_dir not already set:
    inputs_dir = defaults.inputs_dir
  inputs_auto_generated = false
  (proceed with existing input loading logic in Step 4)

ELSE:
  # No inputs provided — analyze the prompt to determine if it needs input
  Analyze prompt_file_contents for input dependency signals:
    - Contains {{INPUT}} placeholder → NEEDS_INPUT
    - References "the provided", "the following", "given input", "user input" → NEEDS_INPUT
    - Is a skill/agent (YAML frontmatter with allowed-tools, description) → NEEDS_INPUT
      (skills/agents process user requests which serve as input)
    - Is a system prompt → NEEDS_INPUT (expects user messages)
    - Is self-contained (generates output without external data) → NO_INPUT_NEEDED

  IF NEEDS_INPUT:
    inputs_auto_generated = true
    inputs_dir = $IMPROVE_TMPDIR/auto-inputs
    mkdir -p "$inputs_dir"
    Print: "Auto-generating {num_inputs} test inputs (prompt requires input: {signal_description})..."

    Spawn general-purpose agent:
      prompt: |
        You are a test input generator. Analyze the prompt below and generate
        {num_inputs} diverse test inputs that would exercise it well.

        <prompt>
        {prompt_file_contents}
        </prompt>

        Requirements:
        - Classify the prompt type first (agent prompt, skill definition, system prompt,
          task prompt, etc.) to understand what kind of input it expects
        - Generate inputs that vary in complexity: simple, moderate, complex/edge-case
        - Use realistic content (not lorem ipsum or placeholder text)
        - Each input should be 10-80 lines
        - Name files descriptively: input-simple.md, input-moderate.md, input-complex.md,
          input-edge-case.md, etc.
        - Files contain ONLY raw input content — no meta-commentary, no headers like
          "This is a test input for..."
        - Write each file to {inputs_dir}/

        Write all {num_inputs} files, then output only:
        INPUTS_GENERATED: {num_inputs} files written to {inputs_dir}

    If agent output does not contain "INPUTS_GENERATED:" → abort:
      "ERROR: Auto-generation failed. Provide inputs_dir manually.
       Example: /improve-prompt path/to/prompt.md path/to/inputs/"
    Verify files exist via glob "{inputs_dir}/*.md"; abort if zero files found.
    Print file listing with line counts (ls -la style).
    Print: "⚠ Inputs were auto-generated — provide a custom inputs directory for more targeted evaluation."

  ELSE (NO_INPUT_NEEDED):
    # Prompt is self-contained — run with empty input (like compare-prompts)
    inputs_auto_generated = false
    # Empty input handled in Step 4 input loading
    Print: "Prompt is self-contained — running with empty input."
```

**Derive paths:**
```
PROMPT_DIR   = dirname(prompt_path)
PROMPT_BASENAME = basename without extension (or "inline")
IDEAS_FILE   = PROMPT_DIR/PROMPT_BASENAME.ideas.md

# Inline mode override: prompt_path is inside IMPROVE_TMPDIR — no git repo there
IF prompt_path starts with $IMPROVE_TMPDIR:
    IDEAS_FILE = $(pwd)/inline.ideas.md
```

**Marker validation rule** (apply after each agent step):
After each spawned agent returns, check its output for the expected marker:
- Step 0b auto-generation agent (if used): must contain `INPUTS_GENERATED:` — if absent, abort: `"ERROR: Auto-generation failed. Provide inputs_dir manually."`
- Step 2 agent: must contain `IDEAS_WRITTEN:` — if absent, abort: `"ERROR: research agent failed — expected IDEAS_WRITTEN: but got: <first 200 chars of output>"`
- Step 2b gate: must contain `PLAN_GATE:` — if absent, abort similarly
- Step 3 write-agents: each must contain `EXP_WRITTEN:` — collect all before proceeding
- Step 3b gate-agents: each must contain all 12 `Q-SG{N}:` lines — if any missing, treat experiment as WARN with note: "incomplete gate evaluation"
- Step 5 reconcile agent: must contain `VERDICT:` — if absent, abort

**Inputs line** (context-aware display):
- Directory provided: `"{inputs_dir}"`
- Directory + auto-generated: `"{inputs_dir}" (auto-generated)`
- Inline text only: `"inline text ({len} chars)"`
- Directory + inline text: `"{inputs_dir} + inline text"`
- No input (empty run): `"(no input — empty run)"`

Print run header (once, after validation passes):
[render as fenced code block]
╔═══════════════════════════════════════════════════════════════╗
║  🔬  improve-prompt                                           ║
║                                                               ║
║  Prompt:      {prompt_path}                                   ║
║  Inputs:      {inputs_line}                                   ║
║  Label:       {label}                                         ║
║  Iterations:  {iterations}   ·   Experiments: {experiments}   ║
║  Model:       {run_model}                                     ║
╚═══════════════════════════════════════════════════════════════╝
[end code block]

---

## Step 1 — Read & Derive Paths

Read prompt file (raw, frontmatter stripped). Derive IDEAS_FILE path.

**Git context:**
```bash
git -C "$(dirname {prompt_path})" log --oneline -20 2>/dev/null || true
```
Capture as `git_history` — passed to research agent for project context.

**Interrupt recovery check** (if IDEAS_FILE exists):
- Read IDEAS_FILE content
- If the most recent `## Experiment Results` section (if any) contains `## Implemented Directions` but does NOT contain `**Verdict:` → prior run interrupted mid-flight while the reconcile agent was writing. To recover cleanly:
  1. **Count only completed iterations** (sections containing `**Verdict:`): `completed_count = count of ## Experiment Results sections in IDEAS_FILE that contain **Verdict:`. Set `i = completed_count + 1`. (Do NOT count the partial section — it has no `**Verdict:` and must be stripped.)
  2. **Truncate the orphaned partial section**: locate the last `## Experiment Results — Iteration` header in IDEAS_FILE (this is the partial one, since it lacks a `**Verdict:` line); remove everything from that header through the end of file. Rewrite IDEAS_FILE with this truncated content. This prevents a double-entry when Step 5 appends the new `## Experiment Results — Iteration {i}` block.
  3. Save current prompt as `$IMPROVE_TMPDIR/baseline-iter-{i}.md`, then skip to Step 3 to re-generate experiment variants (experiment files from the old tmpdir no longer exist), then proceed with Steps 4–5.
  Print: "Resuming interrupted run (iteration {i}) — research already complete, re-generating experiment variants."
- Else if IDEAS_FILE has a `## Experiment Results` section whose most recent occurrence contains a `**Verdict:` line → run `git -C {PROMPT_DIR} status -- {IDEAS_FILE}`. If IDEAS_FILE shows unstaged changes → prior run wrote verdict but did not commit: skip Steps 2–5, go directly to commit step, print: "Resuming: verdict already recorded, committing learnings."
- Otherwise → prior run complete; read as prior context and proceed fresh (append new sections with separator `---\n*Date: {today}*`)

---

## Step 2 — Research & Ideas Generation

**Spawn a general-purpose agent** (no tool restrictions — WebSearch, WebFetch, Read, Write, Bash, etc.):

```
You are an expert prompt engineer and researcher. Your task is to analyze a prompt,
investigate its domain, research best practices, and produce a structured improvement plan.

<original_prompt_path>{prompt_path}</original_prompt_path>
<original_prompt>
{prompt_file_contents}
</original_prompt>

<test_inputs_dir>{inputs_dir}</test_inputs_dir>
<iteration>{i}</iteration>

<prior_context>
{ideas_file_contents if exists, else "(none — first analysis)"}
</prior_context>

<gap_analysis>
{if this is a retry from the Plan Validation Gate: list of failed gate questions from prior attempt; else "(none — first research pass)"}
</gap_analysis>

<strategy_escalation>
{IF consecutive_stalls == 0: "(none — first attempt or after improvement)"}
{IF consecutive_stalls == 1: "Prior iteration was NEUTRAL/REGRESSED. Try bolder changes:
 structural reorganization, different prompting paradigm, or address a different Q1-Q10
 gap than previously attempted. Avoid minor variations of failed techniques."}
{IF consecutive_stalls >= 2: "Multiple consecutive failures. Try the most impactful
 remaining Q1-Q10 gap NOT yet attempted. Consider fundamental prompt architecture changes
 or combinations of previously successful techniques (if any)."}
</strategy_escalation>

<git_history>
{last 20 commits from git log --oneline -20, or "(not a git repo)" if unavailable}
</git_history>

Work through each step carefully before writing your output:

Step 1 — Structural Diagnostic (answer each question explicitly)
Q1 — Role/Persona: Does the prompt define a clear role or persona? If absent, what role would help?
Q2 — Task Precision: Is the task precisely specified, or are there ambiguous verbs/nouns?
Q3 — Context Adequacy: Does the prompt provide enough context for the model to avoid guessing?
Q4 — Output Format: Is the expected output format explicitly specified (structure, length, style)?
Q5 — Examples: Would 1-2 few-shot examples significantly improve consistency?
Q6 — Constraints: What constraints are missing that would prevent hallucination or off-task output?
Q7 — Anti-patterns: Does the prompt exhibit hedging ("try to"), vagueness, overloaded instructions (>3 tasks), or missing failure modes?
Q8 — Chain-of-thought: Would explicit step-by-step reasoning improve output quality for this task?
Q9 — Domain specifics: What domain terminology, conventions, or requirements should be in the prompt but aren't?
Q10 — Tone/register: Is the tone/register appropriate for the task and target audience?

Step 2 — Domain Inference
Infer the precise domain and subtask this prompt is designed for.

Step 3 — Domain Research (use WebSearch and WebFetch)
Search: "{domain} prompt engineering best practices 2025"
Search: "{domain} LLM instruction optimization"
Fetch any top result that looks substantive. Summarize 2-3 actionable findings for this specific prompt.
**Time constraint:** If any search or fetch does not return promptly, skip it and note "(search unavailable)". Do not stall — proceed with available information.

Step 4 — Technique Research
Search: "prompt engineering techniques few-shot chain-of-thought structured output 2025"
Identify 1-2 techniques most applicable to the Q1-Q10 gaps found above.

Step 5 — Check Prior Learnings
Examine the <prior_context> "## Technique History" section (if present). For techniques previously attempted:
- REGRESSED or NEUTRAL → do NOT propose again
- IMPROVED → prioritize and build on them
Also check <gap_analysis>: if specific gate failures are listed, directly address those gaps in your options.

Step 6 — Test-Run Observation
{IF inputs_dir is non-empty: Read 1-2 input files from {inputs_dir}. Reason through what the current prompt would produce on those inputs. Identify where outputs fall short: too brief, wrong format, missing key info, inconsistent structure.
ELSE: No input files are available (prompt is self-contained or running with empty input). Reason through what the current prompt would produce given empty/no input. Identify where outputs fall short: too brief, wrong format, missing key info, inconsistent structure.}

Step 7 — Improvement Options
Based on steps 1-6, synthesize exactly 3-4 improvement options. Each option MUST directly address a specific Q1-Q10 gap or test-run observation.

For each option:
- Name: <short descriptive name>
- Addresses: Q{N} — {which diagnostic question this fixes}
- What changes: <specific, implementable changes — no vague advice>
- Why it helps: <grounded in research findings or test-run observations>
- Predicted impact: HIGH / MEDIUM / LOW — {one sentence justification}

Step 8 — Evaluation Questions
Generate evaluation questions for the quality judge to compare baseline vs improved outputs.

**Fixed questions** (always include — test fundamental output quality):
- Q-FX1: Does the output correctly complete the task as specified in the prompt?
- Q-FX2: Does the output conform to the required format/structure (length, sections, style)?
- Q-FX3: Is the output complete — does it cover all required aspects without omitting key information?
- Q-FX4: Is the output appropriately concise — no unnecessary padding, repetition, or verbosity?
- Q-FX5: Is the output grounded in the input — no hallucinations or unsupported claims?

**Dynamic questions** (generate 2-4 questions derived from the Q1-Q10 gaps and improvement options above):
- Each question must be answerable by comparing two outputs side-by-side
- Each question must directly reflect a specific gap being addressed (reference the Q-number)
- Phrase as "Does output X better achieve Y?" — must have a clear, observable answer
- Examples:
  - If Q1 gap (no role): "Does the output demonstrate appropriate domain expertise for the intended role?"
  - If Q4 gap (no format spec): "Does the output strictly conform to the expected output format?"
  - If Q8 gap (no CoT): "Does the output show transparent step-by-step reasoning?"
  - If Q6 gap (missing constraints): "Does the output stay within the required scope constraints?"

**Write mode:** If `{i}` == 1, write the full document below to {ideas_file} (overwrite if exists).
If `{i}` > 1, APPEND the new diagnostic sections only to {ideas_file} with a separator:
`---\n*Date: {today} — Iteration {i}*` — then append only steps 1 and 6–8 sections
(omit `# Prompt Improvement:` header and `## Original Prompt` which are already in the file from iteration 1).

Write all findings to {ideas_file} in this exact format (full document for iteration 1):

---
# Prompt Improvement: {basename}
*Date: {today}*

## Original Prompt
Path: {prompt_path}

## Structural Diagnostic (Q1-Q10)
Q1 — Role/Persona: {finding}
Q2 — Task Precision: {finding}
Q3 — Context Adequacy: {finding}
Q4 — Output Format: {finding}
Q5 — Examples: {finding}
Q6 — Constraints: {finding}
Q7 — Anti-patterns: {finding}
Q8 — Chain-of-thought: {finding}
Q9 — Domain specifics: {finding}
Q10 — Tone/register: {finding}

## Domain & Research Findings
Domain: {precise domain + subtask}

Research summary:
{key findings from steps 3-4}

## Test-Run Observations
{what current prompt produces on sample inputs and where it falls short}

## Improvement Options

### Option A: {name}
**Addresses:** Q{N} — {gap name}
**What changes:** {specific changes}
**Why it helps:** {grounded reasoning}
**Predicted impact:** {HIGH/MEDIUM/LOW} — {one sentence}

### Option B: {name}
...

### Option C: {name}
...

## Evaluation Questions
*Iteration {N}*

### Fixed (always applied)
- Q-FX1: Does the output correctly complete the task as specified?
- Q-FX2: Does the output conform to the required format/structure?
- Q-FX3: Is the output complete (all required aspects, no key omissions)?
- Q-FX4: Is the output appropriately concise (no padding or verbosity)?
- Q-FX5: Is the output grounded — no hallucinations or unsupported claims?

### Dynamic (derived from Q1-Q10 gaps addressed this iteration)
- {Q-DYN-1}: {question text} [addresses: Q{N}]
- {Q-DYN-2}: {question text} [addresses: Q{N}]
...
---

Output only: "IDEAS_WRITTEN: {ideas_file}" on a single line after writing.
```

After confirming `IDEAS_WRITTEN:` marker, print post-research summary. Read `ideas_file_contents` to extract improvement options:
- `num_options` = count of `### Option ` headers in IDEAS_FILE
- For each option: `option_name` = text after `### Option A: `; `impact` = from `**Predicted impact:** HIGH/MEDIUM/LOW`; `Q{N}` = from `**Addresses:** Q{N}`

Print:
- `[1/7] 📊 Research ─── {num_options} options found`
- `   Ideas: {IDEAS_FILE}`
- For each option letter A, B, C...: `   {letter}  [{impact}]  {option_name}  ─  Q{N}`
- `   Experiments: {E} ({experiment assignment summary})`

---

## Step 2b — Plan Validation Gate

Before writing the improved prompt, evaluate the plan. Loop up to **2 retries** (max 3 total research passes) if the plan fails.

Initialize `research_pass_count = 1` (incremented each time Step 2 runs; already at 1 after the first research pass).

**Spawn a general-purpose agent:**

```
You are a quality evaluator. Assess the improvement plan in the provided ideas file
against these 6 gate questions. Answer PASS or FAIL with one-sentence reason for each.

<ideas_file>
{ideas_file_contents}
</ideas_file>

Gate questions:
1. Specificity — Each option specifies a concrete, implementable change (not "improve clarity"
   but "add role: 'You are a...'"). PASS if all options are concrete.
2. Grounding — Each option cites a specific finding from Q1-Q10 or research (not generic advice).
3. Differentiation — Options are meaningfully different from each other (not variations of same change).
4. Coverage — Plan addresses at least one structural issue from Q1-Q10 (format, role, constraints, examples).
5. History compliance — No option re-proposes a technique in the Technique History marked REGRESSED or NEUTRAL.
6. Impact — At least one option is rated HIGH predicted impact.

Output only: "PLAN_GATE: PASS" if all 6 pass, or "PLAN_GATE: FAIL\n{numbered list of failed gates}" if any fail.
```

**Decision:**
- All 6 PASS → Print: `[2/7] 🔒 Plan Gate ─── ✅ PASS`; proceed to Step 3
- ≥2 FAIL AND `research_pass_count < 3` → Print: `[2/7] 🔒 Plan Gate ─── ⚠ FAIL ({n})  ·  retrying (pass {research_pass_count}/3)`; increment `research_pass_count`; re-run Step 2 with failed gate list injected into `<gap_analysis>`; then re-evaluate gate. After `research_pass_count == 3`, print `[2/7] 🔒 Plan Gate ─── ⚠ FAIL ({n})  ·  proceeding (max research passes reached)` and proceed to Step 3 regardless.
- 1 FAIL → Print: `[2/7] 🔒 Plan Gate ─── ✅ PASS (1 advisory)`; proceed to Step 3 (single failure is advisory)

---

## Step 3 — Assign Variants & Write

**Variant assignment** — assign each of E experiments a distinct option combination:
- E=1: Experiment 1 gets all options combined
- E=2: Exp-1 = highest-impact single option; Exp-2 = all remaining options combined
- E=3: Exp-1 = Option A; Exp-2 = Option B; Exp-3 = Options A+B combined
- E=4: Exp-1 = Option A; Exp-2 = Option B; Exp-3 = Option C; Exp-4 = top 3 combined

**Spawn all E write-agents in a single parallel message** (all Agent calls issued simultaneously in one step — do not await each sequentially).

Each write-agent task prompt:
```
You are a skilled prompt engineer. Write an improved version of the provided prompt
by applying exactly the assigned improvement options — no others.

<experiment_id>{k}</experiment_id>
<assigned_options>
{option names + full option details for this experiment from IDEAS_FILE}
</assigned_options>

<original_prompt>
{baseline_contents from $IMPROVE_TMPDIR/baseline-iter-{i}.md}
</original_prompt>

<ideas_file>
{ideas_file_contents — for Q1-Q10 context and full option specs}
</ideas_file>

<output_path>{$IMPROVE_TMPDIR/exp-{k}-iter-{i}.md}</output_path>

Instructions:
1. Apply ONLY the assigned options — fully and specifically (not superficially)
2. The improved prompt must be complete and self-contained
3. Preserve any YAML frontmatter from the original
4. Write the improved prompt to {output_path}

Output ONLY on two lines — no preamble:
EXP_WRITTEN: {k} {output_path}
Applied: {brief comma-separated list of specific changes made}
```

Collect all E `EXP_WRITTEN:` markers and `Applied:` summaries. Verify all E output paths exist before proceeding.

Print: `[3/7] ✏️  Write ─── {E} variant{s} written` then for each k: `   Exp-{k}:  {applied_summary_k}` (using the `Applied:` line from each write-agent's output; truncate to ~60 chars if longer).

---

## Step 3b — Scope-Preservation Gate

Before evaluating experiments, check each written experiment against the baseline for unintended scope regression. Experiments that fail the gate are excluded from Step 4 evaluation (saving compute) and their failure is recorded in the IDEAS_FILE Technique History.

**Read the assigned options for each experiment** from IDEAS_FILE (already parsed in Step 3 for variant assignment).

**Spawn one gate agent per experiment in a single parallel message** (same pattern as write-agents in Step 3). Each gate agent is a general-purpose agent:

```
You are a scope-preservation evaluator. Compare the improved prompt against the baseline and
answer all 12 questions below.

IMPORTANT: Judge against the BASELINE, not against best practices. A change is only a problem
if it removes or breaks something the baseline had.

Severity guide:
  FAIL = something the baseline had is gone or broken, and no assigned option justifies it
  WARN = a change exists that might be a regression but could be an acceptable side effect
         of an assigned option (ambiguous intent)
  PASS = preserved, or intentionally changed per assigned options
  N/A  = question is genuinely not applicable to this prompt type
         (e.g. Q-SG1 for a prompt with no AUTOMATICALLY INVOKE triggers)

<assigned_options>
{option names + full option details for this experiment from IDEAS_FILE}
</assigned_options>

<baseline_prompt>
{baseline_contents from $IMPROVE_TMPDIR/baseline-iter-{i}.md}
</baseline_prompt>

<improved_prompt>
{experiment_contents from $IMPROVE_TMPDIR/exp-{k}-iter-{i}.md}
</improved_prompt>

Evaluate ALL 12 questions in order. Q-SG12 must be evaluated last.

Q-SG1.  Trigger completeness — Does the improved prompt preserve all activation patterns
        (AUTOMATICALLY INVOKE triggers, routing conditions, use-case keywords) from the
        original? Flag any triggers removed or narrowed without explicit justification in the
        assigned options.
Q-SG2.  Behavioral mode retention — If the original defined multiple operating modes, phases,
        or personas, does the improved prompt retain all of them?
Q-SG3.  Exclusion drift — Did new "NOT for", "do not use when", or "excluded scenarios"
        constraints appear that were absent from the original? Are they an intentional
        refinement from the assigned options, or accidental additions?
Q-SG4.  Input type coverage — Does the improved prompt continue to handle all input types,
        formats, and edge cases the original addressed? Flag any that appear dropped.
Q-SG5.  Capability & tool retention — Does the improved prompt retain all tool grants, API
        references, integration points, and external dependencies the original required?
Q-SG6.  Procedural completeness — Are all mandatory steps, decision trees, checklists, required
        outputs, and output format contracts (marker patterns, JSON schemas, structural
        specifications) from the original still represented — even if restructured or condensed?
Q-SG7.  Context & config anchoring — Does the improved prompt preserve all environment-specific
        context (paths, project IDs, configuration values, assumed state) from the original?
Q-SG8.  Error injection — Did the improvement introduce internally inconsistent instructions,
        factual errors, or self-contradictions not present in the original?
Q-SG9.  Directive strength — Did any mandatory or imperative instructions ("MUST", "always",
        "never", "required", "do not") get softened to optional or suggestive language
        ("consider", "may", "if appropriate", "try to") without explicit justification?
Q-SG10. Example preservation — Did the improvement remove, weaken, or abstract away concrete
        examples that were present in the original?
Q-SG11. Output presentation — If the baseline specified how output should be formatted for
        human consumption — rendering guidelines (box characters, tables, alignment), visual
        indicators (emojis, status icons), structural templates (print formats, fenced blocks,
        indentation), or response length/detail guidance — does the improved prompt preserve
        those specifications?
Q-SG12. Adversarial reconsideration — Name the single most likely regression risk in this
        improved prompt (even if minor). Then assess: is this risk actually present in the diff
        between baseline and improved? FAIL if present and serious, WARN if present but minor,
        PASS if not actually realized. You must name a specific risk before assessing.

Output ALL 12 results, one per line:
Q-SG1: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG2: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG3: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG4: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG5: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG6: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG7: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG8: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG9: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG10: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG11: {PASS|WARN|FAIL|N/A} — {one-sentence reason}
Q-SG12: {PASS|WARN|FAIL|N/A} — {risk named}: {assessment}
```

**Marker validation**: Verify all 12 `Q-SG{N}:` lines (Q-SG1 through Q-SG12) are present in each gate agent's output. If any are missing, treat that experiment as WARN with note: "incomplete gate evaluation."

**Orchestrator computes verdict** (not the agent) from per-question results for each experiment k:

```
pass_count_k = count(q for q in Q-SG1..Q-SG12 if q == PASS or q == N/A)
warn_count_k = count(q for q in Q-SG1..Q-SG12 if q == WARN)
fail_count_k = count(q for q in Q-SG1..Q-SG12 if q == FAIL)

IF fail_count_k > 0:
    gate_verdict_k = "FAIL"
ELIF warn_count_k > 0:
    gate_verdict_k = "WARN"
ELSE:
    gate_verdict_k = "PASS"
```

| Verdict | Condition | Action |
|---------|-----------|--------|
| `PASS` | All 12 questions PASS or N/A | Proceed to Step 4 normally |
| `WARN` | 1+ questions WARN, none FAIL | Proceed to Step 4; annotate experiment with `⚠` in Step 4 output |
| `FAIL` | Any question is FAIL | Exclude experiment from Step 4 evaluation; warn user |

**Print summary** after gate (before Step 4):
```
Print: `[4/7] 🔍 Scope Gate ─── {len(active_experiments)} experiment{s} checked`
For each k in 1..E:
  IF gate_verdict_k == "PASS":
    Print:    Exp-{k}:  ✅ PASS  ({pass_count_k}/12)
  ELIF gate_verdict_k == "WARN":
    Print:    Exp-{k}:  ⚠ WARN  ({pass_count_k}/12)  ─  {first WARN Q-SG question}: {reason}
  ELSE (FAIL):
    Print:    Exp-{k}:  ❌ FAIL  ({pass_count_k}/12)  ─  {first FAIL Q-SG question}: {reason}
```

**Build `scope_gate_summary`** for later use in Step 5:
```
scope_gate_summary = ""
For each experiment k where gate_verdict_k is FAIL or WARN:
  scope_gate_summary += "Exp-{k} [{gate_verdict_k}]: {list of non-PASS Q-SG questions with reasons}\n"
IF scope_gate_summary is empty:
  scope_gate_summary = "No scope gate issues."
```

**Track excluded experiments:**
```
excluded_experiments = [k for k in 1..E if gate_verdict_k == "FAIL"]
active_experiments = [k for k in 1..E if gate_verdict_k != "FAIL"]
```

**If all experiments FAIL** → abort iteration:
```
IF len(active_experiments) == 0:
  Print: `[4/7] 🔍 Scope Gate ─── ❌ all experiments failed`

  # Record failure in IDEAS_FILE via reconcile agent for knowledge loop
  IF prompt_path NOT starts with $IMPROVE_TMPDIR:  # not inline mode
    # Spawn reconcile agent to append scope gate failure to IDEAS_FILE Technique History
    # (see Step 5 for reconcile agent prompt — scope_gate_results will contain all FAILs)
    # Then commit IDEAS_FILE only:
    git -C {PROMPT_DIR} add {IDEAS_FILE}
    git commit -m "$(cat <<'EOF'
docs({basename}): scope gate failed — all experiments excluded

Scope gate failures:
{for each k: Exp-{k}: {first FAIL Q-SG question}: {reason}}

Actionable learning: {techniques applied} caused scope narrowing — avoid in future iterations
EOF
)"

  consecutive_stalls += 1
  iterations_completed = i
  iteration_log.append({i: i, verdict: "SCOPE_FAIL", quality_score_a: null, quality_score_b: null, quality_spread: 0, applied_summary: "all experiments excluded by scope gate"})
  IF consecutive_stalls >= max_stalls:
    Print: "🚫 SCOPE_FAIL — stopping ({consecutive_stalls} consecutive stalls)"
    BREAK
  ELSE:
    Print: "🚫 SCOPE_FAIL — stall {consecutive_stalls}/{max_stalls}, continuing to next iteration"
    CONTINUE
```

Otherwise, proceed to Step 4 with only `active_experiments` (exclude FAILed experiments from the evaluation matrix).

---

## Step 4 — Evaluate All Experiments

Read evaluation questions from IDEAS_FILE `## Evaluation Questions` section (fixed Q-FX1..5 + dynamic questions).

**Load inputs:**

**From `inputs_dir`** (if provided — explicit or auto-generated):
- Glob `*.md` and `*.txt` from inputs_dir. Cap at 10 files; warn if > 10: `"Warning: found <N> input files; using first 10 only."` Skip files > 50KB with: `"Skipping <file>: exceeds 50KB limit"`.
- If `inputs_dir` was explicitly provided (not auto-generated) but zero files survived → abort: `"No valid input files in <dir> (all exceeded 50KB or none matched *.md/*.txt)"`

**From `input_text`** (if provided):
- If `input_text` is an empty string → skip and warn: `"Warning: input_text was empty — ignored."`
- Otherwise: add a single test case named `"inline-input"` with contents = the `input_text` string

**No input sources** (neither `inputs_dir` nor `input_text` survived):
- Create a single test case named `"empty-input"` with contents = `""` (empty string)

M = number of valid input files (from all sources combined). Baseline (A) = `$IMPROVE_TMPDIR/baseline-iter-{i}.md`.

**Prompt injection** (for each prompt P and input I):
```
IF P contains "{{INPUT}}":
    task_prompt = P.replace("{{INPUT}}", I)
ELSE:
    task_prompt = P + "\n\n<INPUT>\n" + I + "\n</INPUT>\n\nExecute the above instructions on the provided input. Output your response directly."
```

Record `start_time_ms` per task before spawning.

Print: `[5/7] ⚖️  Evaluate ─── {M} input{s} × {1+len(active_experiments)} prompt{s}`
(If any experiments were excluded by scope gate, note: `   ({len(excluded_experiments)} experiment{s} excluded by scope gate)`)

**Spawn all (1 + len(active_experiments)) × M runs in a single parallel message** (all Agent calls issued simultaneously in one step — do not await each sequentially):
- `run-A-{filename}`: baseline prompt + each input (M tasks)
- `run-E{k}-{filename}`: experiment-k prompt + each input (only for k in active_experiments — len(active_experiments) × M tasks)

For each completed task, record:
- output text
- `latency_ms` = end_time_ms - start_time_ms
- `input_tokens_est` = floor((prompt_len + input_len) / 4)
- `output_tokens_est` = floor(output_len / 4)
- `total_tokens_est` = input_tokens_est + output_tokens_est

**Error handling**: If a task fails → skip its judge for that input. Note: "(run error — no judge)"

**Spawn all len(active_experiments) × M judge tasks in a single parallel message** (all Agent calls issued simultaneously in one step — do not await each sequentially).

For each experiment k in active_experiments and each input j where both baseline and exp-k runs succeeded:

**Position randomization** (mitigates first-position bias):
```
coin_flip = Math.random() < 0.5
IF coin_flip:
    judge_output_a = exp_k_output_for_j
    judge_output_b = baseline_output_for_j
    swapped[k][j] = true
ELSE:
    judge_output_a = baseline_output_for_j
    judge_output_b = exp_k_output_for_j
    swapped[k][j] = false
```

Judge task prompt:
```
<input_context>
{input_j_contents}
</input_context>

<output_a>
{judge_output_a}
</output_a>

<output_b>
{judge_output_b}
</output_b>

<evaluation_questions>
{all questions from IDEAS_FILE ## Evaluation Questions section — fixed Q-FX1..5 and dynamic}
</evaluation_questions>

For each evaluation question, determine which output better satisfies it.
- winner: "A" if A clearly better, "B" if B clearly better, "TIE" if equivalent
- strength: "strong" (clear decisive difference), "moderate" (noticeable), "slight" (marginal)

Output ONLY valid JSON on a single line — no preamble, no markdown fences:
{"questions":[{"id":"Q-FX1","winner":"A","strength":"strong","reasoning":"..."},...], "reasoning":"1-2 sentences on most decisive quality factors"}
```

Use `judge_model` for all judge tasks. On malformed JSON → treat all questions as TIE.

**Position remapping** (after parsing each judge result, before aggregation):
```
IF swapped[k][j]:
    for each question q in result.questions:
        if q.winner == "A": q.winner = "B"
        elif q.winner == "B": q.winner = "A"
        // "TIE" unchanged
```

**Aggregate per experiment k** (master context computes after collecting all judge results):
```
strength_weight = {"strong": 1.0, "moderate": 0.67, "slight": 0.33}

for each input j:
  score_a_j = sum(strength_weight[q.strength] for q in questions[j,k] if q.winner == "A")
  score_b_j = sum(strength_weight[q.strength] for q in questions[j,k] if q.winner == "B")
  max_score_j = len(questions[j,k])  # total number of questions

total_max_k = sum(max_score_j)
if total_max_k == 0:
  # All judge tasks failed for this experiment — treat as TIE
  quality_score_a   = 0.0
  quality_score_b_k = 0.0
  quality_spread_k  = 0.0
else:
  quality_score_a   = sum(score_a_j) / total_max_k   # normalized 0..1 (same across all k)
  quality_score_b_k = sum(score_b_j) / total_max_k   # normalized 0..1 per experiment k
  quality_spread_k  = quality_score_b_k - quality_score_a  # positive = B better

avg_tokens_a  = mean(total_tokens_est for A runs)
avg_tokens_k  = mean(total_tokens_est for exp-k runs)
avg_latency_a = mean(latency_ms for A runs)
avg_latency_k = mean(latency_ms for exp-k runs)
```

Print quality score results (after all experiments aggregated):
- `   Baseline:  {quality_score_a:.1%}`
- For each k in active_experiments: `   Exp-{k}:    {quality_score_b_k:.1%}  ({quality_spread_k:+.1%}){IF gate_verdict_k == "WARN": " ⚠"}`
- For each k in excluded_experiments: `   Exp-{k}:    (excluded by scope gate)`

Token/latency metrics tracked for transparency; quality score is the primary verdict driver.

---

## Step 5 — Select Winner & Merge Learnings

**Master context** (not a spawned agent) selects the winning experiment.

**Select winner:**
```
best_k = argmax(quality_score_b_k for k in active_experiments)
best_spread = quality_spread_{best_k}

IF best_spread > 0.15:
    overall_winner = "B"   # experiment best_k
    decided_by = "quality"
ELIF |avg_tokens_a - avg_tokens_{best_k}| / max(avg_tokens_a, avg_tokens_{best_k}) > 0.10:
    overall_winner = "B" if avg_tokens_{best_k} < avg_tokens_a else "A"
    decided_by = "tokens (quality tied)"
ELIF |avg_latency_a - avg_latency_{best_k}| / max(avg_latency_a, avg_latency_{best_k}) > 0.15:
    overall_winner = "B" if avg_latency_{best_k} < avg_latency_a else "A"
    decided_by = "time (quality+tokens tied)"
ELSE:
    overall_winner = "NEUTRAL"
    decided_by = "all dimensions within noise thresholds"

verdict = "IMPROVED" if overall_winner == "B" else ("REGRESSED" if overall_winner == "A" else "NEUTRAL")
```

If IMPROVED: `cp $IMPROVE_TMPDIR/exp-{best_k}-iter-{i}.md {prompt_path}` (write winner to prompt file in place).

**Re-read IDEAS_FILE** to get the current contents (written by the research agent in Step 2, which includes Improvement Options and Evaluation Questions) — do not rely on any cached snapshot from earlier in this iteration.

**Spawn reconcile agent** (general-purpose, no tool restrictions):

```
You are a prompt improvement analyst. Reconcile all experiment results with the
improvement options and write comprehensive learnings to the ideas file.

<ideas_file_path>{ideas_file}</ideas_file_path>
<ideas_file>
{ideas_file_contents — includes Structural Diagnostic, Options, Evaluation Questions}
</ideas_file>

<experiment_results>
{For each k in active_experiments:
  Experiment {k} — Applied: {applied_summary from write-agent}
  Quality: {quality_score_b_k:.1%} vs baseline {quality_score_a:.1%} (spread: {quality_spread_k:+.1%})
  Tokens: {avg_tokens_k} vs {avg_tokens_a} ({token_delta_k:+.1%})
  Latency: {avg_latency_k}ms vs {avg_latency_a}ms ({latency_delta_k:+.1%})
  Per-question (A wins / B wins / TIE across {M} test cases):
    Q-FX1: {a_wins}/{b_wins}/{tie}  Q-FX2: {a_wins}/{b_wins}/{tie}  ...
    {dynamic questions: id: a_wins/b_wins/tie}
}
{For each k in excluded_experiments:
  Experiment {k} — EXCLUDED by scope gate (no evaluation ran)
  Applied: {applied_summary from write-agent}
}
</experiment_results>

<selected_winner>
Best experiment: {best_k} — {quality_score_b_best:.1%} quality score
Verdict: {IMPROVED|NEUTRAL|REGRESSED} (decided by: {decided_by})
</selected_winner>

<scope_gate_results>
{scope_gate_summary from Step 3b — either per-experiment non-PASS findings, or "No scope gate issues."}
</scope_gate_results>

Work through each step:
Step 1 — Per-experiment option analysis: which options CONTRIBUTED_TO_WIN / CONTRIBUTED_TO_LOSS / NEUTRAL?
         Which evaluation questions were decisive?
Step 2 — Cross-experiment comparison: what does comparing experiments reveal about technique combinations?
Step 3 — Root cause: why did the winning experiment improve (or fail to improve) quality?

APPEND to {ideas_file} (do NOT overwrite existing content):

## Experiment Results — Iteration {N}
*Date: {today}*

### Implemented Directions
{For each k:
#### Experiment {k}: {options_applied_summary}
**Options applied:** {list}
**Applied changes:** {Applied summary from write-agent}
}

### Quality Scores
| Experiment | Options | Quality vs Baseline | Spread | Token Δ | Latency Δ |
|------------|---------|---------------------|--------|---------|-----------|
| Exp-{k}    | {names} | {score:.1%} vs {baseline:.1%} | {+/-X%} | {+/-X%} | {+/-X%} |
...

### Per-Question Results (A wins / B wins / TIE across {M} tests)
{For each question: Q-ID: who won, pattern across experiments}

## Results & Learnings
{Analysis from steps 1-3}

**What worked:** {specific options/techniques that drove quality improvements}
**What didn't work:** {options that were neutral or hurt quality across all experiments}
**Root cause analysis:** {2-3 sentences}
**What to try next iteration:** {1-2 grounded suggestions for remaining Q1-Q10 gaps}

**Best experiment:** Exp-{best_k} ({options}) — {quality_score:.1%} quality score
**Verdict: {IMPROVED | NEUTRAL | REGRESSED}**
Decided by: {quality | tokens | time | all within noise}

Then update the "## Technique History" section of {ideas_file}:
- If `## Technique History` already exists in the file: add a new `### {today} — Iteration {N} → {IMPROVED|NEUTRAL|REGRESSED}` entry under the existing header (do NOT create a second `## Technique History` header).
- If the section is absent: create it at the END of the file:

---
## Technique History

### {today} — Iteration {N} → {IMPROVED|NEUTRAL|REGRESSED}

**Experiments:** {E} parallel — best was Exp-{best_k} ({options})
**Verdict:** {IMPROVED|NEUTRAL|REGRESSED} (decided by: {decided_by})

**What worked:**
{options from Exp-{best_k} that CONTRIBUTED_TO_WIN — specific Q-numbers that improved}

**What didn't work:**
{options across experiments that were CONTRIBUTED_TO_LOSS or NEUTRAL, and why}

**Actionable learning:**
{1-2 sentences: what future runs should do or avoid for this prompt type}

If scope_gate_results contains FAIL entries: add an entry to Technique History for each
excluded experiment: "Excluded by scope gate — {Q-SGN}: {reason}. Technique: {applied_summary_k}.
Status: SCOPE_FAIL. Do not re-propose this technique direction."
If scope_gate_results contains WARN entries: add an entry to Technique History for each
warned experiment: "Scope gate WARN — {Q-SGN}: {reason}. Technique: {applied_summary_k}.
Status: SCOPE_WARN. Use with caution; monitor for regression."

Output only: "VERDICT: {IMPROVED|NEUTRAL|REGRESSED}" on a single line after writing.
```

Parse `VERDICT:` from reconcile agent output.

---

## Iteration Loop + Per-Iteration Commit/Revert

Each iteration commits independently. Run the full loop for each iteration i in 1..iterations:

```
iterations_completed = 0
iteration_log = []  # track per-iteration: {i, verdict, quality_score_a, quality_score_b, quality_spread, applied_summary}
consecutive_stalls = 0  # tracks consecutive NEUTRAL/REGRESSED/SCOPE_FAIL — resets on IMPROVED

FOR i in 1..iterations:

  Print: ""
  IF consecutive_stalls > 0:
    Print: "Iter [▓ × i + ░ × (iterations-i)] {i}/{iterations} ─── {label}  ({consecutive_stalls} stall{consecutive_stalls > 1 ? 's' : ''})"
  ELSE:
    Print: "Iter [▓ × i + ░ × (iterations-i)] {i}/{iterations} ─── {label}"
  IF i > 1:
    trajectory_scores = [entry.quality_score_b if entry.verdict == "IMPROVED" else entry.quality_score_a for entry in iteration_log]
    trajectory_str = join([f"{s:.0%}" for s in trajectory_scores], " → ")
    cumulative = trajectory_scores[-1] - iteration_log[0].quality_score_a
    Print: "  trajectory ── {trajectory_str}  ({cumulative:+.1%} cumulative)"

  # 1. Save baseline before experiments can overwrite prompt_path
  cp {prompt_path} $IMPROVE_TMPDIR/baseline-iter-{i}.md

  # 1b. Auto-bump experiments on stall recovery (more surface area to explore after failure)
  IF consecutive_stalls >= 1 AND experiments was not explicitly set by user:
    effective_experiments = min(experiments + 1, 4)
  ELSE:
    effective_experiments = experiments
  # Use effective_experiments for this iteration's Step 3 variant assignment

  # 2. Run Steps 2 → 2b → 3 → 3b → 4 → 5
  #    Step 3b may exclude experiments (FAIL) or annotate them (WARN)
  #    Step 5 already copies winning experiment to {prompt_path} if IMPROVED

  IF VERDICT == IMPROVED:
    IF prompt_path starts with $IMPROVE_TMPDIR:  # inline mode — no source file, no git repo
      Print: "Inline mode: learnings saved to {IDEAS_FILE} (no git commit — no source file)."
    ELSE:
      git -C {PROMPT_DIR} add {prompt_path} {IDEAS_FILE}
      git commit -m "$(cat <<'EOF'
improve({basename}): {1-line summary from best experiment's Implemented Direction}

What worked: {CONTRIBUTED_TO_WIN options from Technique History entry}
Actionable learning: {Actionable learning text from Technique History entry}
{IF len(excluded_experiments) > 0: for each k in excluded_experiments:
Scope gate: Exp-{k} excluded — {first FAIL Q-SG question}: {one-line reason}
}
EOF
)"
    consecutive_stalls = 0  # reset on improvement
    iterations_completed = i
    iteration_log.append({i: i, verdict: "IMPROVED", quality_score_a: quality_score_a, quality_score_b: quality_score_b_{best_k}, quality_spread: quality_spread_{best_k}, applied_summary: applied_summary_{best_k}})
    Print: `[6/7] 🏆 Select ─── Exp-{best_k} wins ({decided_by})`
    IF prompt_path NOT starts with $IMPROVE_TMPDIR:  # not inline mode
      Print: `[7/7] 💾 Commit ─── improve({basename}): {1-line summary}`
    ELSE:
      Print: `[7/7] 💾 Result ─── IMPROVED (prompt committed)`
    Print (render as fenced code block):
    ╔═══════════════════════════════════════════════════════════════╗
    ║  ✅  IMPROVED  —  Iteration {i}                               ║
    ║                                                               ║
    ║  Quality:   {quality_score_a:.0%} → {quality_score_b_{best_k}:.0%}  ({quality_spread_{best_k}:+.1%})  ║
    ║  Winner:    Exp-{best_k}  ·  {applied_summary_{best_k} (≤40 chars)}  ║
    ║  Decided:   {decided_by}                                      ║
    ╚═══════════════════════════════════════════════════════════════╝
    [end code block]
    IF i < iterations: CONTINUE to next iteration

  ELSE (NEUTRAL or REGRESSED):
    # Ensure prompt is reverted to baseline (Step 5 only copies on IMPROVED, but be explicit)
    cp $IMPROVE_TMPDIR/baseline-iter-{i}.md {prompt_path}
    consecutive_stalls += 1

    IF prompt_path starts with $IMPROVE_TMPDIR:  # inline mode — no git
      Print: "Inline mode: learnings saved to {IDEAS_FILE} (no git commit — no source file)."
    ELSE:
      git -C {PROMPT_DIR} add {IDEAS_FILE}
      IF VERDICT == NEUTRAL:
        git commit -m "$(cat <<'EOF'
docs({basename}): improvement attempt — neutral ({E} experiments, prompt reverted)

Tried: {techniques from Technique History}
Actionable learning: {Actionable learning text from Technique History}
{IF len(excluded_experiments) > 0: for each k in excluded_experiments:
Scope gate: Exp-{k} excluded — {first FAIL Q-SG question}: {one-line reason}
}
EOF
)"
        iteration_log.append({i: i, verdict: "NEUTRAL", quality_score_a: quality_score_a, quality_score_b: quality_score_b_{best_k}, quality_spread: quality_spread_{best_k}, applied_summary: applied_summaries_all_k})
        Print: `[6/7] 🏆 Select ─── Exp-{best_k} ({decided_by})`
        IF consecutive_stalls >= max_stalls:
          Print: `[7/7] 💾 Result ─── NEUTRAL (prompt reverted, stopping — {consecutive_stalls} consecutive stalls)`
          Print (render as fenced code block):
          ╔═══════════════════════════════════════════════════════════════╗
          ║  ⚠️  NEUTRAL  —  Iteration {i} · stopping ({consecutive_stalls} consecutive stalls)  ║
          ║                                                               ║
          ║  Quality:   {quality_score_a:.0%} → {quality_score_b_{best_k}:.0%}  ({quality_spread_{best_k}:+.1%})  ║
          ║  Tried:     {applied_summaries_all_k (≤40 chars)}             ║
          ╚═══════════════════════════════════════════════════════════════╝
          [end code block]
          iterations_completed = i
          BREAK
        ELSE:
          Print: `[7/7] 💾 Result ─── NEUTRAL (prompt reverted, stall {consecutive_stalls}/{max_stalls} — continuing)`
          Print (render as fenced code block):
          ╔═══════════════════════════════════════════════════════════════╗
          ║  ⚠️  NEUTRAL  —  Iteration {i} · stall {consecutive_stalls}/{max_stalls}, continuing  ║
          ║                                                               ║
          ║  Quality:   {quality_score_a:.0%} → {quality_score_b_{best_k}:.0%}  ({quality_spread_{best_k}:+.1%})  ║
          ║  Tried:     {applied_summaries_all_k (≤40 chars)}             ║
          ╚═══════════════════════════════════════════════════════════════╝
          [end code block]
          iterations_completed = i
          CONTINUE
      ELSE (REGRESSED):
        git commit -m "$(cat <<'EOF'
docs({basename}): improvement attempt — regressed ({E} experiments, prompt reverted)

Tried: {techniques from Technique History}
What backfired: {CONTRIBUTED_TO_LOSS options from Technique History}
Actionable learning: {Actionable learning text from Technique History}
{IF len(excluded_experiments) > 0: for each k in excluded_experiments:
Scope gate: Exp-{k} excluded — {first FAIL Q-SG question}: {one-line reason}
}
EOF
)"
        iteration_log.append({i: i, verdict: "REGRESSED", quality_score_a: quality_score_a, quality_score_b: quality_score_b_{best_k}, quality_spread: quality_spread_{best_k}, applied_summary: applied_summaries_all_k})
        Print: `[6/7] 🏆 Select ─── Exp-{best_k} ({decided_by})`
        IF consecutive_stalls >= max_stalls:
          Print: `[7/7] 💾 Result ─── REGRESSED (prompt reverted, stopping — {consecutive_stalls} consecutive stalls)`
          Print (render as fenced code block):
          ╔═══════════════════════════════════════════════════════════════╗
          ║  ❌  REGRESSED  —  Iteration {i} · stopping ({consecutive_stalls} consecutive stalls)  ║
          ║                                                               ║
          ║  Quality:   {quality_score_a:.0%} → {quality_score_b_{best_k}:.0%}  ({quality_spread_{best_k}:+.1%})  ║
          ║  Tried:     {applied_summaries_all_k (≤40 chars)}             ║
          ╚═══════════════════════════════════════════════════════════════╝
          [end code block]
          iterations_completed = i
          BREAK
        ELSE:
          Print: `[7/7] 💾 Result ─── REGRESSED (prompt reverted, stall {consecutive_stalls}/{max_stalls} — continuing)`
          Print (render as fenced code block):
          ╔═══════════════════════════════════════════════════════════════╗
          ║  ❌  REGRESSED  —  Iteration {i} · stall {consecutive_stalls}/{max_stalls}, continuing  ║
          ║                                                               ║
          ║  Quality:   {quality_score_a:.0%} → {quality_score_b_{best_k}:.0%}  ({quality_spread_{best_k}:+.1%})  ║
          ║  Tried:     {applied_summaries_all_k (≤40 chars)}             ║
          ╚═══════════════════════════════════════════════════════════════╝
          [end code block]
          iterations_completed = i
          CONTINUE

If git commit fails: print "ERROR: git commit failed — <error>. Learnings saved to {IDEAS_FILE}." and proceed to cleanup.
```

---

## Step 6 — Cleanup

The `trap 'rm -rf "$IMPROVE_TMPDIR"' EXIT INT TERM` registered in Step 0 handles cleanup automatically on exit, interrupt, or signal. No explicit cleanup needed.

Print final summary.

**Helpers:**
- `verdict_emoji(v)`: ✅ IMPROVED / ⚠️ NEUTRAL / ❌ REGRESSED / 🚫 SCOPE_FAIL
- `total_stalls = count(entry.verdict in ["NEUTRAL", "REGRESSED", "SCOPE_FAIL"] for entry in iteration_log)`
- `max_consecutive_reached`: track the maximum value `consecutive_stalls` reached during the loop (update after each increment)
- `max_spread = max(abs(entry.quality_spread) for entry in iteration_log) or 1` (default 1 if 0 to avoid div-by-0)
- `bar(spread, width=20)`: `filled = round(abs(spread) / max_spread * width)`; `"█".repeat(filled) + "░".repeat(width - filled)`
- `n_improved = count(entry.verdict == "IMPROVED" for entry in iteration_log)`

Print (outside fenced block):
```
## 📈 improve-prompt Complete

**Prompt:** {prompt_path}
**Label:** {label}
**Iterations:** {iterations_completed} of {iterations}
**Stalls:** {total_stalls} (max consecutive: {max_consecutive_reached})
**Ideas:** {IDEAS_FILE}
```

If `inputs_auto_generated == true`, also print:
> Inputs: auto-generated ({num_inputs} files) — provide a custom inputs directory for more targeted evaluation

Then print iteration history table:
```
| Iter | Verdict      | Quality Δ  | Experiment                   |
|------|--------------|------------|------------------------------|
| {i}  | {verdict_emoji(v)} {v} | {quality_score_a != null ? quality_spread:+.1% : "N/A (no eval)"} | {applied_summary (≤30 chars)} |
```
(one row per entry in `iteration_log`)

Then print quality trajectory as fenced code block:
[render as fenced code block]
Quality Δ per iteration:
Iter {i}  {bar(entry.quality_spread)}  {entry.quality_spread:+.1%}  {verdict_emoji(entry.verdict)}
[end code block]
(one line per entry in `iteration_log`; right-align the percentage column to 7 chars)

Then print final verdict as fenced code block:
[render as fenced code block]
╔═══════════════════════════════════════════════════════════════╗
║  ✅  {n_improved} of {iterations_completed} iterations improved {PROMPT_BASENAME}  ║
║  Prompt committed and ready.                                  ║
╚═══════════════════════════════════════════════════════════════╝
[end code block]
(If n_improved == 0: use `❌  No improvement achieved across {iterations_completed} iteration(s)` on the first line instead; omit "Prompt committed and ready." line)
