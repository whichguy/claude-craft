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

After all validations pass, emit the start banner as a fenced code block:

[render as fenced code block — all lines exactly 64 chars wide]
╔══════════════════════════════════════════════════════════════╗
║  ⚖️  compare-prompts                                         ║
║                                                              ║
║  Baseline  ({label_a}):  {prompt_a_path}                     ║
║  Candidate ({label_b}):  {prompt_b_path}                     ║
║  Inputs:        {inputs_dir}                                 ║
║  Model:         {model_line}                                 ║
╚══════════════════════════════════════════════════════════════╝
[end code block]

Truncation rule: usable inner width = 60 chars (after 2-space left margin). If a path/dir
field exceeds its usable width, truncate from the left: `"..." + path[-(usable - 3):]`.
Model line: if run_model == judge_model → `"{run_model}  (runs + judge)"`
           if different → `"{run_model}  ·  Judge: {judge_model}"`
Each row right-padded with spaces to fill column 62, then `║`.

**⚙️  Pre-flight passed** — `{prompt_a_path}` vs `{prompt_b_path}`

---

## Step 1 — Load Inputs

Glob `*.md` and `*.txt` from inputs_dir.

- Cap at 10 files. If more found → warn: `"Warning: found <N> input files; using first 10 only."`
- For each file: check size. If > 50KB → skip with: `"Skipping <file>: exceeds 50KB limit"`
- Read surviving files' contents into memory
- If zero files remain → abort: `"No valid input files in <dir> (all exceeded 50KB or none matched *.md/*.txt)"`
- If N < 3 → warn: `"Warning: N=<N> test case(s) — quality win rates have low statistical confidence. Use 3+ inputs for meaningful comparison."`

**📂 Inputs loaded** — {N} test cases from `{inputs_dir}`
(If files were skipped: **📂 Inputs loaded** — {N} of {N_found} test cases ({N_skipped} skipped))

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

**🚀 Running prompts** — {2×N} tasks launched in parallel…

---

## Step 3 — Collect Results, File-Artifact Resolution & Timing

Poll all 2×N tasks until complete. Use TaskGet or await completion notifications. Wrap each TaskGet call in try/catch — if a poll throws, treat that task as failed and proceed to error handling below.

For each completed task, collect the raw output text then apply **file-artifact resolution**:

```
raw_output = task result text

// Pattern 1: file-output-executor format — "COMPLETE: /path/to/file BYTES SECONDS"
IF raw_output matches /^COMPLETE:\s+(\/\S+)/m:
    file_path = captured group 1
    TRY: output = Read(file_path)   // full file contents
    CATCH: log "file-artifact read failed: <file_path>" — output = raw_output

// Pattern 2: agent wrote file and said so — "Output written to /path/to/file" (or "output written to:")
ELIF raw_output matches /[Oo]utput written to[:\s]+(\/\S+)/m:
    file_path = captured group 1
    TRY: output = Read(file_path)
    CATCH: output = raw_output

// Pattern 3: bare file path — entire output (trimmed) is a single path starting with /
ELIF strip(raw_output) matches /^\/\S+$/:
    file_path = strip(raw_output)
    TRY: output = Read(file_path)
    CATCH: output = raw_output   // might be a path-like string, not an actual file

// No artifact detected
ELSE:
    output = raw_output
```

After resolution, record per task:
- **output**: resolved content (file contents if artifact detected, else raw output)
- **latency_ms**: `end_time_ms - start_time_ms` (wall-clock from spawn to completion detection)
- **input_tokens_est**: `Math.floor((prompt_len + input_len) / 4)` (char/4 approximation — labeled "est." in report)
- **output_tokens_est**: `Math.floor(len(output) / 4)` (re-computed after resolution)
- **total_tokens_est**: `input_tokens_est + output_tokens_est`

**NOTE on timing**: latency_ms reflects polling-detected wall-clock time. For short tasks, polling interval overhead may exceed model compute time — treat as indicative, not precise.

**Error handling**: If a task completed in error state → mark as failed. Skip it in aggregation (tokens, time) AND skip the quality judge for that input file — do not spawn a judge task when either A or B run for that file failed. Note in Per-Test Breakdown: `"task error — skipped (no judge)"`. Use try/catch around result collection.

**Context management**: After collecting each task's output, store only compact summaries
(winner/latency/tokens/output text for judge). Do not retain full raw outputs longer than needed —
with 10 inputs, 20 raw outputs could bloat the context significantly.

**✓ Runs complete** — avg latency: {label_a} {avg_latency_a/1000:.1f}s · {label_b} {avg_latency_b/1000:.1f}s

---

## Step 4 — Spawn Judge Tasks in Parallel (N Tasks)

**Spawn all N judge tasks in a single parallel message** with `run_in_background: true`.

For each input file i, spawn agent `compare-prompts-judge` with prompt:
```
<PROMPT_A>
{prompt_a_contents}
</PROMPT_A>

<PROMPT_B>
{prompt_b_contents}
</PROMPT_B>

<INPUT>
{input_file_i_contents}
</INPUT>

<OUTPUT_A>
{task_a_output_for_file_i}
</OUTPUT_A>

<OUTPUT_B>
{task_b_output_for_file_i}
</OUTPUT_B>

Output only valid JSON on a single line — no preamble, no markdown fences:
{"scores":{"task_adherence":"?","factual_accuracy":"?","completeness":"?","instruction_following":"?","structural_clarity":"?","precision":"?","conciseness":"?"},"winner":"?","reasoning":"<1-2 sentences>"}
```

Use `judge_model` (default claude-sonnet-4-6) as model parameter.

**⚖️  Judging outputs** — {N} judge tasks launched…

**Judge output**: JSON with 3 keys: `scores` (7-key object — each criterion evaluated relative to its own prompt's instructions), `winner` ("A"|"B"|"TIE"), `reasoning` (1-2 sentences).

**Error handling**: If a judge task fails or returns malformed JSON:
- TRY to parse `result.scores` (7 keys) and `result.winner`
- If `scores` key is missing but `winner` is present → use `winner` only, skip criterion tallies for this case (count as TIE per criterion)
- If both missing → count overall winner as TIE
- Note in Per-Test Breakdown: `"judge error — counted as TIE"`. Use try/catch on JSON.parse().

**✓ Judgments complete** — quality so far: {label_a} {count_a}/{N} · {label_b} {count_b}/{N} · {count_tie} tied

---

## Step 5 — Aggregate & Verdict

Compute per dimension:

**Quality — per-test winners:**
```
count_a = count(winner == "A")
count_b = count(winner == "B")
count_tie = count(winner == "TIE")
win_rate_a = count_a / N
win_rate_b = count_b / N
win_rate_tie = count_tie / N
```

**Quality — per-criterion tallies** (across all N test cases):
```
criterion_keys = ["task_adherence","factual_accuracy","completeness","instruction_following","structural_clarity","precision","conciseness"]

criterion_tallies = {}
FOR key IN criterion_keys:
    criterion_tallies[key] = {a: 0, b: 0, tie: 0}

FOR each judge result WITH valid scores object:
    FOR key IN criterion_keys:
        score = result.scores[key]   // "A", "B", or "TIE"
        IF score == "A": criterion_tallies[key].a += 1
        ELIF score == "B": criterion_tallies[key].b += 1
        ELSE: criterion_tallies[key].tie += 1
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

**Verdict label mapping:**
```
overall_winner == "A"       → verdict = "REGRESSED"
overall_winner == "B"       → verdict = "IMPROVED"
overall_winner == "NEUTRAL" → verdict = "NEUTRAL"
```

After computing overall_winner, decided_by, verdict, and all metric values, emit the early verdict flash (plain markdown, not fenced):

- If decided_by == "quality":
  **{verdict_emoji} {verdict}** — quality: {quality_flash} · tokens: {token_flash} · latency: {latency_flash}
- Otherwise (decided by tokens, time, or NEUTRAL):
  **{verdict_emoji} {verdict}** — quality: tied · tokens: {token_flash} · latency: {latency_flash}

Where:
- `quality_flash`: `"{winning_label} leads {n}/7 criteria ({pct:.0f}% wins)"`
- `token_flash`: if `|token_delta_pct| >= 10` → `"{sign}{|val|}% ({leaner_label} leaner)"` · else → `"{token_delta_pct:+.1f}% (within noise)"`
- `latency_flash`: if `|latency_delta_pct| >= 15` → `"{sign}{|val|}% ({faster_label} faster)"` · else → `"{latency_delta_pct:+.1f}% (within noise)"`
- Use − (U+2212) for negative values, + for positive.

---

## Step 6 — Report

### Pre-report computations

**Bar chart helper** (`bar(value, max_val, width=20)`):
```
filled = round(value / max(max_val, 1) * width)
return "█".repeat(filled) + "░".repeat(width - filled)
```

**Criterion leader** per row:
```
a > b  → "🔵 A"
b > a  → "🟢 B"
a == b → "⚖️  ~"
```

**Criteria where A leads / B leads:**
```
n_criteria_a = count(criterion_tallies[key].a > criterion_tallies[key].b for each key)
n_criteria_b = count(criterion_tallies[key].b > criterion_tallies[key].a for each key)
```

**Delta label** (token and latency):
```
delta > 0  → "+{delta}% · A {leaner|faster}"   // B costs/takes more
delta < 0  → "{delta}% · B {leaner|faster}"     // B costs/takes less
delta == 0 → "0% · equal"
```

**Verdict emoji:**
```
IMPROVED  → "✅"
REGRESSED → "❌"
NEUTRAL   → "➖"
```

**Recommendation sentence** (one sentence, appended after verdict line):
```
IMPROVED  + decided by quality → "Ship the candidate — B leads {n_criteria_b}/7 criteria and wins {win_rate_b_pct}% of test cases."
IMPROVED  + decided by tokens  → "Ship the candidate — quality tied; B is {|token_delta_pct|}% leaner."
IMPROVED  + decided by time    → "Ship the candidate — quality and tokens tied; B is {|latency_delta_pct|}% faster."
REGRESSED + decided by quality → "Keep the baseline — A leads {n_criteria_a}/7 criteria and wins {win_rate_a_pct}% of test cases."
REGRESSED + decided by tokens  → "Keep the baseline — quality tied; A is {|token_delta_pct|}% leaner."
REGRESSED + decided by time    → "Keep the baseline — quality and tokens tied; A is {|latency_delta_pct|}% faster."
NEUTRAL                        → "No meaningful difference across all three dimensions."
```

---

### Output

Output the following report (outside any code fence — render as markdown):

```
## compare-prompts Results

**Baseline (A):** {label_a} — `{prompt_a_path}`
**Candidate (B):** {label_b} — `{prompt_b_path}`
**Inputs:** `{inputs_dir}` · {N} test cases

---

### 🔍 Quality  _(7-criterion pairwise judge)_

| Criterion             |  A  |  B  |  ~  | Leader |
|-----------------------|:---:|:---:|:---:|--------|
| Task Adherence        | {criterion_tallies.task_adherence.a} | {criterion_tallies.task_adherence.b} | {criterion_tallies.task_adherence.tie} | {leader} |
| Factual Accuracy      | {criterion_tallies.factual_accuracy.a} | {criterion_tallies.factual_accuracy.b} | {criterion_tallies.factual_accuracy.tie} | {leader} |
| Completeness          | {criterion_tallies.completeness.a} | {criterion_tallies.completeness.b} | {criterion_tallies.completeness.tie} | {leader} |
| Instruction Following | {criterion_tallies.instruction_following.a} | {criterion_tallies.instruction_following.b} | {criterion_tallies.instruction_following.tie} | {leader} |
| Structural Clarity    | {criterion_tallies.structural_clarity.a} | {criterion_tallies.structural_clarity.b} | {criterion_tallies.structural_clarity.tie} | {leader} |
| Precision             | {criterion_tallies.precision.a} | {criterion_tallies.precision.b} | {criterion_tallies.precision.tie} | {leader} |
| Conciseness           | {criterion_tallies.conciseness.a} | {criterion_tallies.conciseness.b} | {criterion_tallies.conciseness.tie} | {leader} |
| **Total**             | **{Σ_a}** | **{Σ_b}** | **{Σ_tie}** | |

**Win rate by test case:**
[render as fenced code block]
A  {bar(count_a, N)}   {win_rate_a_pct}%   ({count_a} of {N})
B  {bar(count_b, N)}   {win_rate_b_pct}%   ({count_b} of {N})
~  {bar(count_tie, N)} {win_rate_tie_pct}% ({count_tie} of {N})
[end code block]

---

### 🪙 Token Count  _(estimated · char/4 approx)_

Compute: `bar_tokens_a = bar(avg_tokens_a, max(avg_tokens_a, avg_tokens_b))`
         `bar_tokens_b = bar(avg_tokens_b, max(avg_tokens_a, avg_tokens_b))`
Pad `label_a` and `label_b` to equal column width (right-pad shorter with spaces).

[render as fenced code block]
{label_a_padded}  {bar_tokens_a}  ~{avg_tokens_a} est.
{label_b_padded}  {bar_tokens_b}  ~{avg_tokens_b} est.
   Δ {token_delta_label}
[end code block]

---

### ⏱ Time  _(wall-clock · indicative)_

Compute: `bar_latency_a = bar(avg_latency_a, max(avg_latency_a, avg_latency_b))`
         `bar_latency_b = bar(avg_latency_b, max(avg_latency_a, avg_latency_b))`

[render as fenced code block]
{label_a_padded}  {bar_latency_a}  {avg_latency_a} ms
{label_b_padded}  {bar_latency_b}  {avg_latency_b} ms
   Δ {latency_delta_label}
[end code block]

---

### 📋 Per-Test Breakdown

| | File | Reasoning |
|-|------|-----------|
| {winner_emoji} | {file} | "{reasoning}" |
... (one row per test case; winner_emoji: 🟢=B wins, 🔵=A wins, ⚖️=TIE)

---

[render as fenced code block — all lines exactly 64 chars wide]
╔══════════════════════════════════════════════════════════════╗
║  {verdict_emoji}  {verdict}  —  decided by {decided_by}      ║
╠══════════════════════════════════════════════════════════════╣
║  {quality_metric_row}                                        ║
║  {token_metric_row}                                          ║
║  {latency_metric_row}                                        ║
╠══════════════════════════════════════════════════════════════╣
║  {recommendation_sentence_line1}                             ║
[║  {recommendation_sentence_line2}  — only if sentence wraps  ║]
╚══════════════════════════════════════════════════════════════╝
[end code block]

Metric row rules (each row right-padded to fill column 62, then `║`):

**Quality row:**
- decided_by == "quality" AND winner == B → `Quality:  {label_b} leads {n_criteria_b}/7 criteria  ·  {win_rate_b_pct:.0f}% test wins  ←`
- decided_by == "quality" AND winner == A → `Quality:  {label_a} leads {n_criteria_a}/7 criteria  ·  {win_rate_a_pct:.0f}% test wins  ←`
- otherwise → `Quality:  tied (spread within 15% threshold)`

**Token row:**
- decided_by contains "tokens" → `Tokens:   {token_delta_label}  ←`
- NEUTRAL AND |token_delta_pct| < 10 → `Tokens:   {token_delta_label}  (within noise)`
- otherwise → `Tokens:   {token_delta_label}`

**Latency row:**
- decided_by contains "time" → `Latency:  {latency_delta_label}  ←`
- NEUTRAL AND |latency_delta_pct| < 15 → `Latency:  {latency_delta_label}  (within noise)`
- otherwise → `Latency:  {latency_delta_label}`

**Recommendation wrapping:** if recommendation_sentence > 60 chars, split at last space before char 60 and emit the remainder as a second `║` row at the same 2-space indent.
```

**Formatting rules:**
- Round all percentages to 1 decimal place.
- Token delta: `+X%` if B > A (A leaner), `-X%` if B < A (B leaner); label `· A leaner` or `· B leaner`.
- Latency delta: `+X%` if B > A (A faster), `-X%` if B < A (B faster); label `· A faster` or `· B faster`.
- Pad bar chart rows so columns align (counts right-aligned in their field).
- Token/time bar charts: normalize to `max(a, b)` so the larger value fills the full bar. Pad labels to equal width so bar columns align.
- Verdict box: 3 sections separated by `╠═══╣` dividers — (1) verdict header, (2) quality/token/latency metric rows with `←` on the deciding dimension, (3) recommendation. Wrap recommendation at last space before char 60 if > 60 chars; emit remainder as second `║` row.
- Winner emoji column in per-test table: use `⚖️` for TIE (note: emoji width varies — use a single space after for alignment).

---

## Step 7 — Cleanup

```bash
rm -rf "$COMPARE_TMPDIR"
```
