---
name: compare-questions
description: |
  A/B test two planning questions by applying each to one or more plans, judging which
  question produces a better plan revision. Priority chain: quality > input tokens
  (question size) > time.

  AUTOMATICALLY INVOKE when user mentions:
  - "compare questions", "which question is better", "A/B test questions"
  - "evaluate questions", "test these questions against plans"
  - "question efficiency", "question comparison"
  - Two planning questions to compare against plan(s)

  STRONGLY RECOMMENDED for:
  - Optimizing review-plan question quality
  - Reducing question token cost while maintaining effectiveness
  - Choosing between alternative question phrasings
  - Validating new questions against existing ones

  Position bias mitigated via randomized ordering per test case — judge sees A/B in random
  order, results remapped before aggregation.

argument-hint: "<question-a> <question-b> <plan-file-or-dir> [--label-a X] [--label-b Y] [--apply-model MODEL] [--judge-model MODEL]"
allowed-tools: Agent, Task, TaskCreate, TaskGet, TaskList, TaskUpdate, TaskStop, TaskOutput, Bash, Read, Glob, Write
---

# compare-questions Skill

Apply two planning questions independently to one or more plans, then compare the resulting
revisions on: **quality** (pairwise judge) → **input tokens** (question size) �� **time** (wall-clock).

## Argument Reference

The arguments after `/compare-questions` are **free-form text**. The LLM interprets them
to extract the following values:

| Parameter | Required? | What to look for | Default |
|-----------|-----------|-------------------|---------|
| `question_a` | **yes** | First quoted string, text after "question-a" or "A:", or first `.md` file path labeled "A" | — |
| `question_b` | **yes** | Second quoted string, text after "question-b" or "B:", or second `.md` file path labeled "B" | — |
| `plans_source` | **yes** | A directory path or file path(s) for plans. Associated with "plans", "plan-dir", "against". Paths ending `.md` that are NOT questions. | — |
| `label_a` | no | "label-a", "--label-a" | "Q-A" |
| `label_b` | no | "label-b", "--label-b" | "Q-B" |
| `apply_model` | no | "apply-model", "--apply-model", model for applying questions | claude-sonnet-4-6 |
| `judge_model` | no | "judge-model", "--judge-model", model for judging | claude-sonnet-4-6 |

**Question resolution:** If a question value looks like a file path (contains `/` or ends `.md`)
and the file exists on disk, read its contents. Otherwise treat as inline text.

**Example invocations:**
```
/compare-questions "Does the plan account for rollback?" "What happens if deployment fails?" plans/my-plan.md
/compare-questions A: "Are assumptions validated?" B: "Are constraints evidence-based?" ~/.claude/plans/
/compare-questions questions/q1.md questions/q2.md plans/ --label-a "concise" --label-b "verbose"
```

---

## Step 0 — Parse & Preflight

**Interpret arguments from `<prompt-arguments>` as free-form text.**

Extract values by understanding the user's intent — they may use flags, positional
strings, natural language, or any combination.

**Defaults** (apply when not found in arguments):
- `label_a` = "Q-A"
- `label_b` = "Q-B"
- `apply_model` = claude-sonnet-4-6
- `judge_model` = claude-sonnet-4-6

**Question resolution:**
```
FOR each question value (a, b):
    IF value contains "/" OR value ends with ".md":
        IF file exists at value:
            question_text = Read(value)
        ELSE:
            abort: "ERROR: question file not found: {value}"
    ELSE:
        question_text = value (inline text)
```

**Compute input tokens:**
```
tokens_a = Math.floor(question_a_text.length / 4)
tokens_b = Math.floor(question_b_text.length / 4)
```

Create temp working dir: `COMPARE_TMPDIR=$(mktemp -d /tmp/compare-questions.XXXXXX)`
— NOTE: use `COMPARE_TMPDIR`, not `$TMPDIR` (macOS system env var, do not overwrite)

**Requirement validation — abort immediately if any check fails:**

1. Both questions must be identified and non-empty
2. Both questions must be different (trimmed string comparison)
   - If identical → abort: "ERROR: Both questions are identical — nothing to compare."
3. Plans source must exist on disk (directory or file path)
4. apply_model and judge_model must match `claude-*`

After all validations pass, emit the start banner as a fenced code block:

[render as fenced code block — all lines exactly 64 chars wide]
╔══════════════════════════════════════════════════════════════╗
║  ⚖️  compare-questions                                       ║
║                                                              ║
║  Question A ({label_a}):  {question_a_truncated_50}          ║
║  Question B ({label_b}):  {question_b_truncated_50}          ║
║  Plans:          {plans_line}                                ║
║  Tokens:         A ~{tokens_a} est. · B ~{tokens_b} est.    ║
║  Model:          {model_line}                                ║
╚══════════════════════════════════════════════════════════════╝
[end code block]

Truncation rule: usable inner width = 60 chars. If question text exceeds 50 chars,
truncate: `question_text[:47] + "..."`.
Model line: if apply_model == judge_model → `"{apply_model} (apply + judge)"`
           if different → `"{apply_model} · Judge: {judge_model}"`
Each row right-padded with spaces to fill column 62, then `║`.

[1/7] ⚙️  preflight ── {label_a} (~{tokens_a} tokens) vs {label_b} (~{tokens_b} tokens)

**State output:** `question_a_text`, `question_b_text`, `tokens_a`, `tokens_b`, `plans_source`,
`label_a`, `label_b`, `apply_model`, `judge_model`, `COMPARE_TMPDIR`
Consumed by: Steps 1–7.

---

## Step 1 — Load Plans

Build the list of plan test cases:

**From directory** (if plans_source is a directory):
- Glob `*.md` from plans_source
- Cap at 10 files. If more found → warn: `"Warning: found {N} plan files; using first 10 only."`
- For each file: check size. If > 100KB → skip with: `"Skipping {file}: exceeds 100KB limit"`
- Read surviving files' contents into memory

**From file path(s)** (if plans_source is one or more files):
- Read each file directly

**Validation:**
- At least 1 plan required. If 0 → abort: `"ERROR: No valid plan files found in {plans_source}"`
- If N < 3 → warn: `"Warning: N={N} plan(s) — quality win rates have low statistical confidence. Use 3+ plans for meaningful comparison."`

[2/7] 📂 plans ── {N} test cases from {plans_source}

**State output:** `plans[]` with `{name, contents}`, `N`
Consumed by: Steps 2–6.

---

## Step 2 — Apply Questions (2×N parallel Tasks)

For each plan × each question, spawn a Task with `apply_model`.

**Application prompt** (built per task):
```
You are a software planning consultant. You have been given a project plan and a
planning review question. Your job is to:

1. Read the original plan carefully
2. Consider the question and determine what issue (if any) it reveals in the plan
3. Produce a REVISED PLAN that addresses the question's concern

Rules:
- Output the complete revised plan (not a diff, not commentary)
- Make only the changes necessary to address the question's concern
- Preserve the plan's structure, formatting, and all content not related to the issue
- If the question reveals no real issue in this plan, output the original plan unchanged
  with a single comment at the top: "<!-- NO_CHANGE: [brief reason] -->"
- Do NOT add generic boilerplate ("ensure proper testing", "consider scalability")
  — only add specific, concrete improvements that directly address the question

<QUESTION>
QUESTION_TEXT
</QUESTION>

<PLAN>
PLAN_CONTENTS
</PLAN>

Output the revised plan below. No preamble, no explanation — just the plan.
```

*Substitution rules:*
- `QUESTION_TEXT` → the question's text (question_a_text or question_b_text)
- `PLAN_CONTENTS` → the plan file's full contents

Record `start_time_ms = Date.now()` per task before spawning.

**Spawn all 2×N Tasks in a single parallel message** with `run_in_background: true`.
Each task:
- `subagent_type`: general-purpose
- `model`: apply_model (default claude-sonnet-4-6)
- `prompt`: constructed application prompt (above)
- `run_in_background`: true

Name tasks for tracking: `apply-A-{plan_name}`, `apply-B-{plan_name}`.

[3/7] 🚀 applying ── {2*N} tasks launched

**State output:** `task_handles[]` (2×N task references with start times)
Consumed by: Step 3.

---

## Step 3 — Collect Results & Write Temp Files

Poll all 2×N tasks until complete. For each completed task:

1. Capture the raw output text (the revised plan)
2. Write to temp file:
   ```
   Bash: cat > 'COMPARE_TMPDIR/apply-{A|B}-{plan_name}.md' << 'APPLY_EOF'
   {raw_output}
   APPLY_EOF
   ```
3. Record timing:
   - `latency_ms`: `end_time_ms - start_time_ms` (wall-clock)

**Error handling:** If a task fails → mark as failed. Skip the judge for that plan if
either A or B failed. Note: `"application error — skipped (no judge)"`.

[4/7] ✅ applied ── {label_a} {avg_latency_a/1000:.1f}s · {label_b} {avg_latency_b/1000:.1f}s

**State output:** `results[plan_name][A|B]` with `{temp_file_path, latency_ms}`, `avg_latency_a`, `avg_latency_b`
Consumed by: Steps 4–6.

---

## Step 4 — Judge (N parallel Tasks)

For each plan where both A and B succeeded, spawn one judge task with `judge_model`.

**Position randomization** (per `skills/shared/judge-pattern.md`):
```
coin_flip = Math.random() < 0.5
IF coin_flip:
    // Swap: B appears as "A" to the judge
    judge_question_a = question_b_text
    judge_question_b = question_a_text
    judge_revision_a = Read(results[plan][B].temp_file_path)
    judge_revision_b = Read(results[plan][A].temp_file_path)
    swapped[i] = true
ELSE:
    // Normal ordering
    judge_question_a = question_a_text
    judge_question_b = question_b_text
    judge_revision_a = Read(results[plan][A].temp_file_path)
    judge_revision_b = Read(results[plan][B].temp_file_path)
    swapped[i] = false
```

Spawn agent `compare-questions-judge` with:
- `model`: `judge_model` (default claude-sonnet-4-6)
- `run_in_background`: true
- `prompt`:

```
<ORIGINAL_PLAN>
{plan_contents}
</ORIGINAL_PLAN>

<QUESTION_A>
{judge_question_a}
</QUESTION_A>

<QUESTION_B>
{judge_question_b}
</QUESTION_B>

<REVISION_A>
{judge_revision_a}
</REVISION_A>

<REVISION_B>
{judge_revision_b}
</REVISION_B>

Output only valid JSON on a single line — no preamble, no markdown fences:
{"scores":{"issue_detection":"?","improvement_quality":"?","proportionality":"?","precision":"?","preservation":"?"},"winner":"?","reasoning":"<1-2 sentences>"}
```

**Spawn all N judge tasks in a single parallel message** with `run_in_background: true`.

[5/7] ⚖️  judging ── {N} tasks launched

---

## Step 5 — Collect Judge Results & Remap

Poll all N judge tasks until complete.

**Position remapping** (after parsing each judge result, before aggregation):
```
IF swapped[i]:
    for key in result.scores:
        if scores[key] == "A": scores[key] = "B"
        elif scores[key] == "B": scores[key] = "A"
        // "TIE" unchanged
    if result.winner == "A": result.winner = "B"
    elif result.winner == "B": result.winner = "A"
    // "TIE" unchanged
```

**Error handling:** If a judge task fails or returns malformed JSON:
- TRY to parse `result.scores` (5 keys) and `result.winner`
- If `scores` key is missing but `winner` is present → use `winner` only, skip criterion tallies for this case
- If both missing → count overall winner as TIE
- Note in Per-Plan Breakdown: `"judge error — counted as TIE"`. Use try/catch on JSON.parse().

[6/7] ✅ judging complete ── {label_a} {count_a}/{N} · {label_b} {count_b}/{N} · {count_tie} tied

---

## Step 6 — Aggregate, Verdict & Report

### Aggregation

**Quality — per-test winners:**
```
count_a = count(winner == "A")
count_b = count(winner == "B")
count_tie = count(winner == "TIE")
win_rate_a = count_a / N
win_rate_b = count_b / N
win_rate_tie = count_tie / N
```

**Quality — per-criterion tallies** (across all N judge results):
```
criterion_keys = ["issue_detection", "improvement_quality", "proportionality", "precision", "preservation"]

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

**Input tokens** (question size — NOT output size):
```
// tokens_a and tokens_b computed in Step 0 from question text length
token_delta_pct = round(((tokens_b - tokens_a) / max(tokens_a, tokens_b, 1)) * 100, 1)
// Positive = B is larger (A more concise), negative = B is smaller (B more concise)
```

**Time:**
```
avg_latency_a = mean(latency_ms for all A application runs)
avg_latency_b = mean(latency_ms for all B application runs)
latency_delta_pct = round(((avg_latency_b - avg_latency_a) / max(avg_latency_a, avg_latency_b, 1)) * 100, 1)
```

### Tiebreaker Chain — priority: quality → input tokens → time

```
# Threshold values:
# quality: >15% spread = meaningful difference
# tokens: >10% spread = meaningful efficiency gain (question conciseness)
# time: >15% spread = meaningful speed difference

IF |win_rate_a - win_rate_b| > 0.15:
    overall_winner = (win_rate_a > win_rate_b) ? "A" : "B"
    decided_by = "quality"
ELIF max(tokens_a, tokens_b) > 0 AND |tokens_a - tokens_b| / max(tokens_a, tokens_b) > 0.10:
    overall_winner = (tokens_a < tokens_b) ? "A" : "B"
    decided_by = "input tokens (quality tied)"
ELIF max(avg_latency_a, avg_latency_b) > 0 AND |avg_latency_a - avg_latency_b| / max(avg_latency_a, avg_latency_b) > 0.15:
    overall_winner = (avg_latency_a < avg_latency_b) ? "A" : "B"
    decided_by = "time (quality+tokens tied)"
ELSE:
    overall_winner = "NEUTRAL"
    decided_by = "all dimensions within noise thresholds"
```

**Verdict label mapping:**
```
overall_winner == "A" → verdict = "{label_a} WINS"
overall_winner == "B" → verdict = "{label_b} WINS"
overall_winner == "NEUTRAL" → verdict = "NEUTRAL"
```

**Verdict emoji:**
```
label_a WINS → "🔵"
label_b WINS ��� "🟢"
NEUTRAL      → "➖"
```

After computing verdict, emit the early verdict flash:

```
Print: "──────────────────────────────────────────────────────"
```
{verdict_emoji} {verdict} ── quality: {quality_flash} · tokens: {token_flash} · latency: {latency_flash}
```
Print: "──────────────────────────────────────────────────────"
```

Where:
- `quality_flash`: If decided by quality → `"{winning_label} leads {n_criteria_winning}/5 criteria · {win_rate_pct}% wins"` where n_criteria_winning = count of criterion keys where winning label's tally > loser's tally. Otherwise → `"tied"`
- `token_flash`: `"A ~{tokens_a} · B ~{tokens_b} ({concise_label} more concise)"` or `"within noise"` if delta < 10%
- `latency_flash`: if `|latency_delta_pct| >= 15` → `"{faster_label} {|val|}% faster"` · else → `"within noise"`

### Report

Output the following report (outside any code fence — render as markdown):

```
## compare-questions Results

**Question A ({label_a}):** {question_a_text_truncated_80}
**Question B ({label_b}):** {question_b_text_truncated_80}
**Plans:** {N} test cases from {plans_source}

---

### 🔍 Quality  _(5-criterion pairwise judge)_

| Criterion             |  A  |  B  |  ~  | Leader |
|-----------------------|:---:|:---:|:---:|--------|
| Issue Detection       | {t.issue_detection.a} | {t.issue_detection.b} | {t.issue_detection.tie} | {leader} |
| Improvement Quality   | {t.improvement_quality.a} | {t.improvement_quality.b} | {t.improvement_quality.tie} | {leader} |
| Proportionality       | {t.proportionality.a} | {t.proportionality.b} | {t.proportionality.tie} | {leader} |
| Precision             | {t.precision.a} | {t.precision.b} | {t.precision.tie} | {leader} |
| Preservation          | {t.preservation.a} | {t.preservation.b} | {t.preservation.tie} | {leader} |
| **Total**             | **{sum_a}** | **{sum_b}** | **{sum_tie}** | |

**Win rate by plan:**
[render as fenced code block]
{label_a}  {bar(count_a, N)}   {win_rate_a_pct}%   ({count_a} of {N})
{label_b}  {bar(count_b, N)}   {win_rate_b_pct}%   ({count_b} of {N})
~          {bar(count_tie, N)} {win_rate_tie_pct}% ({count_tie} of {N})
[end code block]

---

### 🪙 Input Tokens  _(question size — char/4 est.)_

[render as fenced code block]
{label_a_padded}  {bar_tokens_a}  ~{tokens_a} est.
{label_b_padded}  {bar_tokens_b}  ~{tokens_b} est.
   Δ {token_delta_label}
[end code block]

Note: measures the question's own token count — a more concise question that achieves
the same quality revision is inherently a better question.

---

### ⏱ Time  _(wall-clock application time — indicative)_

[render as fenced code block]
{label_a_padded}  {bar_latency_a}  {avg_latency_a} ms
{label_b_padded}  {bar_latency_b}  {avg_latency_b} ms
   Δ {latency_delta_label}
[end code block]

---

### 📋 Per-Plan Breakdown

| | Plan | Reasoning |
|-|------|-----------|
| {winner_emoji} | {plan_name} | "{reasoning}" |
... (one row per plan; winner_emoji: 🟢=B wins, 🔵=A wins, ⚖️=TIE)

---

[render as fenced code block — all lines exactly 64 chars wide]
╔══════════════════════════════════════════════════════════════╗
║  {verdict_emoji}  {verdict}  —  decided by {decided_by}      ║
╠══════════════════════════════════════════════════════════════╣
║  {quality_metric_row}                                        ║
║  {token_metric_row}                                          ║
║  {latency_metric_row}                                        ║
╠══════════════════════════════════════════════════════════════╣
║  {recommendation_sentence}                                   ║
╚══════════════════════════════════════════════════════════════╝
[end code block]
```

**Metric row rules** (each row right-padded to fill column 62, then `║`):

**Quality row:**
- decided_by == "quality" AND winner == B → `Quality:  {label_b} leads {n_criteria_b}/5 criteria  ·  {win_rate_b_pct:.0f}% wins  ←`
- decided_by == "quality" AND winner == A → `Quality:  {label_a} leads {n_criteria_a}/5 criteria  ·  {win_rate_a_pct:.0f}% wins  ←`
- otherwise → `Quality:  tied (spread within 15% threshold)`

**Token row:**
- decided_by contains "tokens" → `Tokens:   {label} ~{tokens} est. ({pct}% more concise)  ←`
- NEUTRAL AND |token_delta_pct| < 10 → `Tokens:   A ~{tokens_a} · B ~{tokens_b}  (within noise)`
- otherwise → `Tokens:   A ~{tokens_a} · B ~{tokens_b}  ({delta_label})`

**Latency row:**
- decided_by contains "time" → `Latency:  {latency_delta_label}  ←`
- NEUTRAL AND |latency_delta_pct| < 15 → `Latency:  {latency_delta_label}  (within noise)`
- otherwise → `Latency:  {latency_delta_label}`

**`←` marker:** appears only on the row for the deciding dimension.

**Recommendation sentence:**
```
winner + quality  → "Use {label} — it surfaces better issues across {pct}% of test plans."
winner + tokens   ��� "Use {label} — quality tied; it is {pct}% more concise."
winner + time     → "Use {label} — quality and tokens tied; application is {pct}% faster."
NEUTRAL           → "No meaningful difference across all three dimensions."
```

**Recommendation wrapping:** if > 60 chars, split at last space before char 60 and emit
the remainder as a second `║` row.

**Bar chart helper** (`bar(value, max_val, width=20)`):
```
filled = round(value / max(max_val, 1) * width)
return "█".repeat(filled) + "░".repeat(width - filled)
```

**Criterion leader** per row:
```
a > b  → "🔵 {label_a}"
b > a  → "🟢 {label_b}"
a == b → "⚖️  ~"
```

**Formatting rules:**
- Round all percentages to 1 decimal place.
- Token delta: `+X%` if B > A (A more concise), `-X%` if B < A (B more concise).
- Latency delta: `+X%` if B > A (A faster), `-X%` if B < A (B faster).
- Pad bar chart rows so columns align.

---

## Step 7 — Cleanup

```bash
rm -rf "$COMPARE_TMPDIR"
```

Print: "Temp files cleaned up."

---

## Error Reference

| Condition | Action |
|-----------|--------|
| Missing question(s) | Abort: "ERROR: Could not identify two questions in the arguments." |
| Identical questions | Abort: "ERROR: Both questions are identical — nothing to compare." |
| No valid plans | Abort: "ERROR: No valid plan files found in {plans_source}" |
| Application task failure | Skip that plan, warn. Abort if all plans skipped. |
| Judge JSON parse failure | Retry once with "return ONLY the JSON". Second failure → count as TIE. |
| Plans > 100KB | Skip with warning |
| >50% plans skipped | Warn but continue with surviving plans |
