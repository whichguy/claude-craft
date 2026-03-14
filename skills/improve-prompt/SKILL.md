---
name: improve-prompt
description: |
  Research-backed prompt improvement workflow. Analyzes with Q1-Q10 structural diagnostics,
  researches domain + prompt engineering best practices, generates fixed+dynamic evaluation
  questions, validates improvement plan (quality gate), runs E parallel experiment variants,
  evaluates via questions-based judge (not holistic), reconciles all learnings into a single
  ideas file, and commits only if improved. Supports --iterations N for compounding improvement
  and --experiments N for parallel variant testing per iteration.

  AUTOMATICALLY INVOKE when user mentions:
  - "improve this prompt", "make this prompt better", "optimize this prompt"
  - "prompt improvement", "iterate on prompt", "evolve this prompt"

  STRONGLY RECOMMENDED for:
  - Before finalizing agent/skill prompts
  - When a prompt's outputs are inconsistent or low quality
  - After receiving feedback that a prompt is underperforming

argument-hint: "--prompt <file> [--inputs <dir>] [--iterations N] [--experiments N] [--label <name>] [--model <m>] [--judge-model <m>] | --prompt-text '<text>' --inputs <dir>"
allowed-tools: Agent, Bash, Read, Glob, Write, WebSearch, WebFetch, Skill
---

# improve-prompt Skill

Research-backed prompt improvement loop: structural diagnostics (Q1-Q10) → domain research →
fixed+dynamic evaluation questions → plan quality gate → E parallel experiment variants →
questions-based judge → reconciled learnings → commit on IMPROVED, revert on NEUTRAL/REGRESSED.

## Argument Reference

```
/improve-prompt --prompt <file>
                OR --prompt-text "<inline prompt content>"
  --inputs <dir>          required unless prompt file frontmatter defines default-inputs
  [--label <name>]        human label for reports/commits (default: basename or "inline")
  [--model <model>]       model for running prompts (default: claude-sonnet-4-6)
  [--judge-model <model>] model for quality judge (default: claude-sonnet-4-6)
  [--iterations N]        run full improve loop N times (default: 1; stops early on NEUTRAL/REGRESSED)
  [--experiments N]       parallel improvement experiments per iteration (default: 1; max: 4)
                          each experiment tries a different option combination; winner is committed
```

Both `--prompt`/`--prompt-text` and `--inputs` are required unless frontmatter provides defaults.

---

## Step 0 — Parse & Preflight

Parse all arguments from `<prompt-arguments>`:
- `--prompt <f>` → prompt_path = f; label defaults to basename without extension
- `--prompt-text "<text>"` → inline mode; label defaults to "inline"
- `--inputs <dir>` → inputs_dir = dir
- `--label <n>` → label = n
- `--model <m>` → run_model = m (default: claude-sonnet-4-6)
- `--judge-model <m>` → judge_model = m (default: claude-sonnet-4-6)
- `--iterations N` → iterations = N (default: 1)
- `--experiments N` → experiments = N (default: 1; max: 4)

**Create temp dir first (needed for inline mode below):**
```bash
IMPROVE_TMPDIR=$(mktemp -d /tmp/improve-prompt.XXXXXX)
trap 'rm -rf "$IMPROVE_TMPDIR"' EXIT INT TERM
```

**Prompt-as-code resolution:**
1. If `--prompt-text "<text>"` → write to `$IMPROVE_TMPDIR/inline-prompt.md`; set prompt_path to that; label = "inline" (unless --label provided)
2. If `--prompt <file>` → parse YAML frontmatter (text between leading `---` markers); extract `defaults.*` as fallback values for unset CLI args; strip frontmatter to get raw prompt text

**Input validation:**
- Validate `--label` contains only alphanumeric characters, hyphens, and underscores. Abort: `"ERROR: --label must contain only alphanumeric characters, hyphens, and underscores"`
- Validate `--model` and `--judge-model` match pattern `claude-*`. Abort: `"ERROR: --model must match claude-* pattern"`
- Abort if no prompt source: `"ERROR: --prompt <file> or --prompt-text '<text>' is required"`
- Abort if no inputs: `"ERROR: --inputs <dir> is required (or provide defaults.inputs in frontmatter)"`
- Abort if inputs_dir does not exist: `"ERROR: inputs dir does not exist: <dir>"`
- Abort if iterations < 1: `"ERROR: --iterations must be >= 1"`
- Abort if experiments < 1 or experiments > 4: `"ERROR: --experiments must be between 1 and 4"`
- On any early abort: trap covers cleanup, but print clear error before exiting

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
- Step 2 agent: must contain `IDEAS_WRITTEN:` — if absent, abort: `"ERROR: research agent failed — expected IDEAS_WRITTEN: but got: <first 200 chars of output>"`
- Step 2b gate: must contain `PLAN_GATE:` — if absent, abort similarly
- Step 3 write-agents: each must contain `EXP_WRITTEN:` — collect all before proceeding
- Step 5 reconcile agent: must contain `VERDICT:` — if absent, abort

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
- If `## Implemented Directions` section present but `**Verdict:` line absent → prior run interrupted mid-flight: save current prompt as `$IMPROVE_TMPDIR/baseline-iter-1.md`, then skip to Step 3 to re-generate experiment variants (experiment files from the old tmpdir no longer exist), then proceed with Steps 4–5. Print: "Resuming interrupted run — research already complete, re-generating experiment variants."
- If `**Verdict:` line already present → run `git -C {PROMPT_DIR} status -- {IDEAS_FILE}`. If IDEAS_FILE shows unstaged changes → prior run wrote verdict but did not commit: skip Steps 2–5, go directly to commit step, print: "Resuming: verdict already recorded, committing learnings."
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
Read 1-2 input files from {inputs_dir}. Reason through what the current prompt would produce. Identify where outputs fall short: too brief, wrong format, missing key info, inconsistent structure.

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
- All 6 PASS → proceed to Step 3
- ≥2 FAIL AND `research_pass_count < 3` → increment `research_pass_count`; re-run Step 2 with failed gate list injected into `<gap_analysis>`; then re-evaluate gate. After `research_pass_count == 3`, proceed to Step 3 regardless.
- 1 FAIL → proceed to Step 3 (single failure is advisory)

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

---

## Step 4 — Evaluate All Experiments

Read evaluation questions from IDEAS_FILE `## Evaluation Questions` section (fixed Q-FX1..5 + dynamic questions).

**Load inputs:**
Glob `*.md` and `*.txt` from inputs_dir. Cap at 10 files; warn if > 10: `"Warning: found <N> input files; using first 10 only."` Skip files > 50KB with: `"Skipping <file>: exceeds 50KB limit"`. Abort if zero files remain.
M = number of valid input files. Baseline (A) = `$IMPROVE_TMPDIR/baseline-iter-{i}.md`.

**Prompt injection** (for each prompt P and input I):
```
IF P contains "{{INPUT}}":
    task_prompt = P.replace("{{INPUT}}", I)
ELSE:
    task_prompt = P + "\n\n<INPUT>\n" + I + "\n</INPUT>\n\nExecute the above instructions on the provided input. Output your response directly."
```

Record `start_time_ms` per task before spawning.

**Spawn all (1 + E) × M runs in a single parallel message** (all Agent calls issued simultaneously in one step — do not await each sequentially):
- `run-A-{filename}`: baseline prompt + each input (M tasks)
- `run-E{k}-{filename}`: experiment-k prompt + each input (E × M tasks)

For each completed task, record:
- output text
- `latency_ms` = end_time_ms - start_time_ms
- `input_tokens_est` = floor((prompt_len + input_len) / 4)
- `output_tokens_est` = floor(output_len / 4)
- `total_tokens_est` = input_tokens_est + output_tokens_est

**Error handling**: If a task fails → skip its judge for that input. Note: "(run error — no judge)"

**Spawn all E × M judge tasks in a single parallel message** (all Agent calls issued simultaneously in one step — do not await each sequentially).

For each experiment k and each input j where both baseline and exp-k runs succeeded:

Judge task prompt:
```
<input_context>
{input_j_contents}
</input_context>

<output_a>
{baseline_output_for_j}
</output_a>

<output_b>
{exp_k_output_for_j}
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

**Aggregate per experiment k** (master context computes after collecting all judge results):
```
strength_weight = {"strong": 1.0, "moderate": 0.67, "slight": 0.33}

for each input j:
  score_a_j = sum(strength_weight[q.strength] for q in questions[j,k] if q.winner == "A")
  score_b_j = sum(strength_weight[q.strength] for q in questions[j,k] if q.winner == "B")
  max_score_j = len(questions[j,k])  # total number of questions

quality_score_a   = sum(score_a_j) / sum(max_score_j)   # normalized 0..1 (same across all k)
quality_score_b_k = sum(score_b_j) / sum(max_score_j)   # normalized 0..1 per experiment k
quality_spread_k  = quality_score_b_k - quality_score_a  # positive = B better

avg_tokens_a  = mean(total_tokens_est for A runs)
avg_tokens_k  = mean(total_tokens_est for exp-k runs)
avg_latency_a = mean(latency_ms for A runs)
avg_latency_k = mean(latency_ms for exp-k runs)
```

Token/latency metrics tracked for transparency; quality score is the primary verdict driver.

---

## Step 5 — Select Winner & Merge Learnings

**Master context** (not a spawned agent) selects the winning experiment.

**Select winner:**
```
best_k = argmax(quality_score_b_k for k in 1..E)
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
{For each k in 1..E:
  Experiment {k} — Applied: {applied_summary from write-agent}
  Quality: {quality_score_b_k:.1%} vs baseline {quality_score_a:.1%} (spread: {quality_spread_k:+.1%})
  Tokens: {avg_tokens_k} vs {avg_tokens_a} ({token_delta_k:+.1%})
  Latency: {avg_latency_k}ms vs {avg_latency_a}ms ({latency_delta_k:+.1%})
  Per-question (A wins / B wins / TIE across {M} test cases):
    Q-FX1: {a_wins}/{b_wins}/{tie}  Q-FX2: {a_wins}/{b_wins}/{tie}  ...
    {dynamic questions: id: a_wins/b_wins/tie}
}
</experiment_results>

<selected_winner>
Best experiment: {best_k} — {quality_score_b_best:.1%} quality score
Verdict: {IMPROVED|NEUTRAL|REGRESSED} (decided by: {decided_by})
</selected_winner>

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

Output only: "VERDICT: {IMPROVED|NEUTRAL|REGRESSED}" on a single line after writing.
```

Parse `VERDICT:` from reconcile agent output.

---

## Iteration Loop + Per-Iteration Commit/Revert

Each iteration commits independently. Run the full loop for each iteration i in 1..iterations:

```
iterations_completed = 0

FOR i in 1..iterations:

  # 1. Save baseline before experiments can overwrite prompt_path
  cp {prompt_path} $IMPROVE_TMPDIR/baseline-iter-{i}.md

  # 2. Run Steps 2 → 2b → 3 → 4 → 5
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
EOF
)"
    iterations_completed = i
    Print: "✅ Iteration {i}: IMPROVED (Exp-{best_k}) — {prompt_path} committed"
    IF i < iterations: CONTINUE to next iteration

  ELSE (NEUTRAL or REGRESSED):
    # Ensure prompt is reverted to baseline (Step 5 only copies on IMPROVED, but be explicit)
    cp $IMPROVE_TMPDIR/baseline-iter-{i}.md {prompt_path}
    IF prompt_path starts with $IMPROVE_TMPDIR:  # inline mode — no git
      Print: "Inline mode: learnings saved to {IDEAS_FILE} (no git commit — no source file)."
    ELSE:
      git -C {PROMPT_DIR} add {IDEAS_FILE}
      IF VERDICT == NEUTRAL:
        git commit -m "$(cat <<'EOF'
docs({basename}): improvement attempt — neutral ({E} experiments, prompt reverted)

Tried: {techniques from Technique History}
Actionable learning: {Actionable learning text from Technique History}
EOF
)"
        Print: "⚠️ Iteration {i}: NEUTRAL — prompt reverted, learnings committed"
      ELSE (REGRESSED):
        git commit -m "$(cat <<'EOF'
docs({basename}): improvement attempt — regressed ({E} experiments, prompt reverted)

Tried: {techniques from Technique History}
What backfired: {CONTRIBUTED_TO_LOSS options from Technique History}
Actionable learning: {Actionable learning text from Technique History}
EOF
)"
        Print: "❌ Iteration {i}: REGRESSED — prompt reverted, learnings committed"
    iterations_completed = i
    BREAK  # stop early on non-improvement

If git commit fails: print "ERROR: git commit failed — <error>. Learnings saved to {IDEAS_FILE}." and proceed to cleanup.
```

---

## Step 6 — Cleanup

The `trap 'rm -rf "$IMPROVE_TMPDIR"' EXIT INT TERM` registered in Step 0 handles cleanup automatically on exit, interrupt, or signal. No explicit cleanup needed.

Print final summary:
```
## improve-prompt Complete

Prompt: {prompt_path}
Label: {label}
Iterations run: {iterations_completed} of {iterations}
Ideas file: {IDEAS_FILE}

{Per iteration: "Iter {i}: IMPROVED/NEUTRAL/REGRESSED — <1-line summary>"}
```
