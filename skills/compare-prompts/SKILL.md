---
name: compare-prompts
description: |
  Compare two prompt versions (A vs B) by running both against a directory of test input
  files, then evaluating results on three dimensions in priority order: quality > tokens > time.

  **AUTOMATICALLY INVOKE** when user mentions:
  - "compare prompts", "which prompt is better", "prompt efficiency"
  - "A/B test prompts", "evaluate prompts", "test these prompts"
  - Multiple prompt variations to choose between

  **STRONGLY RECOMMENDED** for:
  - Optimizing prompt quality
  - Reducing token usage
  - Comparing alternative approaches
  - Before finalizing agent/skill prompts

  **Known limitation**: Judge always sees Output A first, which may introduce a ~5-10%
  first-position preference. For casual comparisons this is acceptable; for high-confidence
  research use randomized ordering.

argument-hint: "--prompt <file> --inputs <dir> | --prompt-a <fileA> [--prompt-b <fileB>] --inputs <dir>"
allowed-tools: Agent, Task, TaskCreate, TaskGet, TaskList, TaskUpdate, TaskStop, TaskOutput, Bash, Read, Glob, Write
---

# compare-prompts Skill

Run two prompt versions against a directory of test inputs, then compare outputs on:
**quality** (pairwise judge) → **tokens** (char/4 estimate) → **time** (wall-clock).

## Argument Reference

```
/compare-prompts --prompt <file> --inputs <dir>
  # current file vs HEAD~1

/compare-prompts --prompt-a <fileA> --prompt-b <fileB> --inputs <dir>
  # explicit A and B

/compare-prompts --prompt-a <fileA> --inputs <dir>
  # A explicit, B = HEAD~1 of A

[--label-a NAME]      display label for prompt A (default: "A")
[--label-b NAME]      display label for prompt B (default: "B")
[--model MODEL]       model for running the prompts (default: claude-sonnet-4-6)
[--judge-model MODEL] model for the quality judge (default: claude-sonnet-4-6)
```

---

## Step 0 — Parse & Preflight

Parse arguments from `<prompt-arguments>`.

**Flag parsing rules:**
- `--prompt <f>` → prompt_a_path = f, derive prompt_b from HEAD~1 of f
- `--prompt-a <f>` → prompt_a_path = f
- `--prompt-b <f>` → prompt_b_path = f (explicit; skips git extraction)
- `--inputs <dir>` → inputs_dir = dir
- `--label-a <n>` → label_a = n (default: "A")
- `--label-b <n>` → label_b = n (default: "B")
- `--model <m>` → run_model = m (default: claude-sonnet-4-6) — used as `model:` on Task spawn
- `--judge-model <m>` → judge_model = m (default: claude-sonnet-4-6)

**Resolve prompt_b_path** (if not explicitly provided):
1. Determine REPO_ROOT: `git -C "$(dirname <prompt_a_path>)" rev-parse --show-toplevel`
2. Compute RELATIVE_PATH: relative path of prompt_a_path from REPO_ROOT
3. Run preflight: `git -C "$REPO_ROOT" show HEAD~1:"$RELATIVE_PATH" > /dev/null 2>&1`
   - If this fails → abort with:
     `"Cannot extract HEAD~1 of <file>: no prior commit history. Provide --prompt-b explicitly."`
4. Extract: `git -C "$REPO_ROOT" show HEAD~1:"$RELATIVE_PATH" > "$COMPARE_TMPDIR/prompt-b-head1.md"`
5. Set prompt_b_path = `$COMPARE_TMPDIR/prompt-b-head1.md`

Create temp working dir: `COMPARE_TMPDIR=$(mktemp -d /tmp/compare-prompts.XXXXXX)`
— NOTE: use `COMPARE_TMPDIR`, not `$TMPDIR` (macOS system env var, do not overwrite)

**Validate:**
- inputs_dir must exist: `test -d "$inputs_dir"` — else abort: `"--inputs <dir> does not exist"`
- prompt_a_path must exist: `test -f "$prompt_a_path"` — else abort: `"Prompt A not found: <path>"`
- prompt_b_path must exist after resolution — else abort with appropriate message

---

## Step 1 — Load Inputs

Glob `*.md` and `*.txt` from inputs_dir.

- Cap at 10 files. If more found → warn: `"Warning: found <N> input files; using first 10 only."`
- For each file: check size. If > 50KB → skip with: `"Skipping <file>: exceeds 50KB limit"`
- Read surviving files' contents into memory
- If zero files remain → abort: `"No valid input files in <dir> (all exceeded 50KB or none matched *.md/*.txt)"`
- If N < 3 → warn: `"Warning: N=<N> test case(s) — quality win rates have low statistical confidence. Use 3+ inputs for meaningful comparison."`

---

## Step 2 — Spawn All Runs in Parallel (2×N Tasks)

Read prompt_a contents and prompt_b contents.

**Prompt injection** — build task_prompt per run:
```
IF prompt_contents contains "{{INPUT}}":
    task_prompt = prompt_contents.replace("{{INPUT}}", input_file_contents)
ELSE:
    task_prompt = prompt_contents + "\n\n<INPUT>\n" + input_file_contents + "\n</INPUT>\n\nExecute the above instructions on the provided input. Output your response directly."
```

Record `start_time_ms = Date.now()` per task before spawning.

**Spawn all 2×N Tasks in a single parallel message** with `run_in_background: true`.
Each task:
- `subagent_type`: general-purpose
- `model`: run_model (if specified via --model; default claude-sonnet-4-6)
- `prompt`: constructed task_prompt (above)
- `run_in_background`: true

Name tasks for tracking: `run-A-<filename>`, `run-B-<filename>`.

---

## Step 3 — Collect Results & Timing

Poll all 2×N tasks until complete. Use TaskGet or await completion notifications. Wrap each TaskGet call in try/catch — if a poll throws, treat that task as failed and proceed to error handling below.

For each completed task, record:
- **output**: result text
- **latency_ms**: `end_time_ms - start_time_ms` (wall-clock from spawn to completion detection)
- **input_tokens_est**: `Math.floor((prompt_len + input_len) / 4)` (char/4 approximation — labeled "est." in report)
- **output_tokens_est**: `Math.floor(output_len / 4)`
- **total_tokens_est**: `input_tokens_est + output_tokens_est`

**NOTE on timing**: latency_ms reflects polling-detected wall-clock time. For short tasks, polling interval overhead may exceed model compute time — treat as indicative, not precise.

**Error handling**: If a task completed in error state → mark as failed. Skip it in aggregation (tokens, time) AND skip the quality judge for that input file — do not spawn a judge task when either A or B run for that file failed. Note in Per-Test Breakdown: `"task error — skipped (no judge)"`. Use try/catch around result collection.

**Context management**: After collecting each task's output, store only compact summaries
(winner/latency/tokens/output text for judge). Do not retain full raw outputs longer than needed —
with 10 inputs, 20 raw outputs could bloat the context significantly.

---

## Step 4 — Spawn Judge Tasks in Parallel (N Tasks)

**Spawn all N judge tasks in a single parallel message** with `run_in_background: true`.

For each input file i, spawn agent `compare-prompts-judge` with prompt:
```
<INPUT>
{input_file_i_contents}
</INPUT>

<OUTPUT_A>
{task_a_output_for_file_i}
</OUTPUT_A>

<OUTPUT_B>
{task_b_output_for_file_i}
</OUTPUT_B>
```

Use `judge_model` (default claude-sonnet-4-6) as model parameter.

**Judge output**: JSON only — `{"winner": "A" | "B" | "TIE", "reasoning": "<1-2 sentences>"}`

**Error handling**: If a judge task fails or returns malformed JSON → count as TIE.
Note in Per-Test Breakdown: `"judge error — counted as TIE"`. Use try/catch on JSON.parse().

---

## Step 5 — Aggregate & Verdict

Compute per dimension:

**Quality:**
```
count_a = count(winner == "A")
count_b = count(winner == "B")
count_tie = count(winner == "TIE")
win_rate_a = count_a / N
win_rate_b = count_b / N
```

**Tokens** (averages across successful runs only):
```
avg_tokens_a = mean(total_tokens_est for all A runs)
avg_tokens_b = mean(total_tokens_est for all B runs)
```

**Time:**
```
avg_latency_a = mean(latency_ms for all A runs)
avg_latency_b = mean(latency_ms for all B runs)
```

Compute delta values for the report:
```
token_delta_pct = round(((avg_tokens_b - avg_tokens_a) / max(avg_tokens_a, 1)) * 100, 1)
latency_delta_pct = round(((avg_latency_b - avg_latency_a) / max(avg_latency_a, 1)) * 100, 1)
# Positive = B is larger (A wins efficiency), negative = B is smaller (B wins efficiency)
```

**Tiebreaker chain — priority: quality → tokens → time:**
```
# Threshold values chosen to filter noise:
# quality: >15% spread = meaningful difference
# tokens: >10% spread = meaningful efficiency gain
# time: >15% spread = meaningful speed difference

IF |win_rate_a - win_rate_b| > 0.15:
    overall_winner = (win_rate_a > win_rate_b) ? "A" : "B"
    decided_by = "quality"
ELIF max(avg_tokens_a, avg_tokens_b) > 0 AND |avg_tokens_a - avg_tokens_b| / max(avg_tokens_a, avg_tokens_b) > 0.10:
    overall_winner = (avg_tokens_a < avg_tokens_b) ? "A" : "B"
    decided_by = "tokens (quality tied)"
ELIF max(avg_latency_a, avg_latency_b) > 0 AND |avg_latency_a - avg_latency_b| / max(avg_latency_a, avg_latency_b) > 0.15:
    overall_winner = (avg_latency_a < avg_latency_b) ? "A" : "B"
    decided_by = "time (quality+tokens tied)"
ELSE:
    overall_winner = "NEUTRAL"
    decided_by = "all dimensions within noise thresholds"
```

---

## Step 6 — Report

Output the following formatted report:

```markdown
## compare-prompts Results

Prompt A (baseline): {label_a} — {prompt_a_path}
Prompt B (candidate): {label_b} — {prompt_b_path}
Inputs: {inputs_dir} ({N} test cases)

### Quality  (pairwise judge)
| Winner | Count | Win Rate |
|--------|-------|----------|
| A      | {count_a} | {win_rate_a_pct}% |
| B      | {count_b} | {win_rate_b_pct}% |
| TIE    | {count_tie} | {win_rate_tie_pct}% |

### Efficiency  (estimated)
| Metric               | A          | B          | Delta   |
|----------------------|------------|------------|---------|
| Avg tokens (est.)    | ~{avg_tokens_a} | ~{avg_tokens_b} | {token_delta_pct}% |
| Avg latency (ms)     | {avg_latency_a}ms | {avg_latency_b}ms | {latency_delta_pct}% |

### Per-Test Breakdown
| File       | Winner | Reasoning                         |
|------------|--------|-----------------------------------|
| {file}     | {w}    | "{reasoning}"                     |
...

### Verdict
[**A WINS** / **B WINS** / **NEUTRAL**] — decided by [{decided_by}]
[One sentence recommendation based on the outcome]
```

**Delta formatting**: show as `+X%` if B > A (A is cheaper/faster), `-X%` if B < A (B is cheaper/faster).
Round all percentages to 1 decimal place.

---

## Step 7 — Cleanup

```bash
rm -rf "$COMPARE_TMPDIR"
```
