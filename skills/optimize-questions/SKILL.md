---
name: optimize-questions
description: |
  Systematically optimize review-plan evaluator questions for token efficiency while
  maintaining quality. For each target question: generates a token-optimized variant,
  A/B tests it against the original via compare-questions using a dedicated test plan,
  and updates QUESTIONS.md if the variant wins. Retries up to N times with different
  compression strategies.

  AUTOMATICALLY INVOKE when user mentions:
  - "optimize questions", "compress questions", "reduce question tokens"
  - "token-optimize review-plan", "make questions more concise"
  - "question efficiency", "shrink evaluator prompts"

  STRONGLY RECOMMENDED for:
  - Reducing review-plan token consumption
  - Iterative question quality improvement
  - Validating question rewrites against calibration plans

argument-hint: "[question-ids] [--max-attempts N] [--dry-run] [--model MODEL]"
allowed-tools: Agent, Task, TaskCreate, TaskGet, TaskList, TaskUpdate, TaskStop, TaskOutput, Bash, Read, Glob, Write, Edit
---

# optimize-questions Skill

Optimize review-plan evaluator questions for token efficiency. For each target question:
generate a concise variant → A/B test via compare-questions → update QUESTIONS.md if better.

**Priority chain:** quality > input tokens > time (inherited from compare-questions).

## Argument Reference

| Parameter | Required? | What to look for | Default |
|-----------|-----------|-------------------|---------|
| `question_ids` | no | Comma-separated Q-IDs (`Q-G1,Q-G10`), range (`Q-G1..Q-G25`), layer (`L1`, `L2`, `L3`, `epilogue`), or `all` | `all` |
| `max_attempts` | no | `--max-attempts N` or `N attempts` | 3 |
| `dry_run` | no | `--dry-run`, `dry run`, `preview` | false |
| `model` | no | `--model MODEL` (must match `claude-*`) | claude-sonnet-4-6 |

**Layer expansion:**
- `L1` → Q-G1, Q-G2, Q-G4, Q-G5, Q-G6, Q-G7, Q-G8, Q-G10, Q-G11, Q-G12, Q-G13, Q-G14, Q-G16, Q-G17, Q-G18, Q-G19, Q-G20, Q-G21, Q-G22, Q-G23, Q-G24, Q-G25
- `L2` → Q-C3, Q-C4, Q-C5, Q-C6, Q-C7, Q-C8, Q-C9, Q-C10, Q-C11, Q-C12, Q-C13, Q-C14, Q-C15, Q-C16, Q-C17, Q-C18, Q-C19, Q-C20, Q-C21, Q-C22, Q-C23, Q-C24, Q-C25, Q-C26, Q-C27, Q-C28, Q-C29, Q-C30, Q-C31, Q-C32, Q-C33, Q-C34, Q-C35, Q-C36, Q-C37, Q-C38, Q-C39, Q-C40
- `L3` → Q-U1, Q-U2, Q-U3, Q-U4, Q-U5, Q-U6, Q-U7
- `epilogue` → Q-E1, Q-E2, Q-G9a, Q-G9b, Q-G9c, Q-G9d, Q-G9e, Q-G9f

**Range expansion:** `Q-G1..Q-G11` → all Q-G IDs from 1 to 11 (skipping non-existent: Q-G3, Q-G9, Q-G15).

**Example invocations:**
```
/optimize-questions L1
/optimize-questions Q-G1,Q-G10,Q-C38 --max-attempts 5
/optimize-questions all --dry-run
/optimize-questions L2 --model claude-opus-4-6
```

---

## Step 0 — Parse & Load

1. **Parse question IDs** from `<prompt-arguments>`. Expand layers, ranges, and `all`.

2. **Resolve source files** for each Q-ID:
   - Q-G*, Q-C*, Q-E* → `~/.claude/skills/review-plan/QUESTIONS.md`
   - Q-U* → `~/.claude/skills/review-plan/QUESTIONS-L3.md`
   - Q-G9a–f → `~/.claude/skills/review-plan/SKILL.md` (inline in Q-G9 section)

3. **Extract current question text** for each target Q-ID:
   - For QUESTIONS.md: find the table row starting with `| Q-{ID} |`. Tables have two formats:
     - L1 (4-column): `| Q | Question | Criteria | N/A |` — Criteria is column 3
     - L2 (5-column): `| Q | Gate | Question | Criteria | N/A |` — Criteria is column 4
     Match by Q-ID prefix: Q-G* uses L1 format, Q-C* uses L2 format, Q-E* uses L1 format.
   - For QUESTIONS-L3.md (Q-U*): same 5-column L2 format — Criteria is column 4.
   - For Q-G9 sub-questions: find the sub-question table in QUESTIONS.md (3-column: `| Sub-Q | Question | Criteria |`), Criteria is column 3.

4. **Verify test plans exist** for each target Q-ID:
   - Check `~/.claude/skills/optimize-questions/plans/{Q_ID}.md` exists
   - Missing plans → warn and skip: `"⚠ No test plan for {Q_ID} — skipping"`

5. **Print inventory:**
   ```
   ╔══════════════════════════════════════════════════════════════╗
   ║  optimize-questions                                         ║
   ║                                                              ║
   ║  Targets:   {N} questions ({layers_summary})                 ║
   ║  Plans:     {M} of {N} test plans found                      ║
   ║  Attempts:  {max_attempts} per question                      ║
   ║  Mode:      {dry_run ? "DRY RUN (no updates)" : "LIVE"}     ║
   ║  Model:     {model}                                          ║
   ╚══════════════════════════════════════════════════════════════╝
   ```

6. **Create progress tasks** for each target with a test plan:
   ```
   FOR each target in targets[] WHERE plan exists:
       TaskCreate(
           subject = "Optimize {q_id}: {question_name}",
           status = "pending"
       )
   ```
   This gives the user a live dashboard of per-question progress.

7. **Load learnings briefing** (if LEARNINGS.md exists):
   - Read `skills/optimize-questions/LEARNINGS.md`
   - Extract `## Principles` section → `principles_text`
   - Extract `## Compression Guidance` section → `guidance_text`
   - Build `learnings_briefing`:
     ```
     ACCUMULATED LEARNINGS (from previous optimization runs):

     Proven principles:
     {principles_text}

     Recent guidance:
     {guidance_text}

     Apply these alongside the preservation hierarchy. If a principle
     contradicts the hierarchy, the hierarchy takes precedence.
     ```
   - If file doesn't exist → `learnings_briefing = ""`

**State output:** `targets[]` with `{q_id, current_text, plan_path, source_file, question_name}`, `task_ids{}` (q_id → task ID), `learnings_briefing`
Consumed by: Step 1.

---

## Step 1 — Iterate & Optimize

Create temp dir: `OPT_TMPDIR=$(mktemp -d /tmp/optimize-questions.XXXXXX)`

**Results tracking:**
```
results = []  # {q_id, original_tokens, optimized_tokens, savings_pct, verdict, attempt,
              #  winning_strategy, judge_scores, judge_reasoning, compression_description}
```

**Parallelization strategy:** Spawn all questions as independent background agents
(one per question, `run_in_background: true`). Each agent handles the full pipeline:
compress → apply both versions → judge → report result. Name agents `opt-{q_id}`
for tracking (e.g., `opt-G10`, `opt-C39`).

Update each question's task as it progresses:
```
TaskUpdate(task_ids[q_id], status = "in_progress",
           activeForm = "Optimizing {q_id} (~{tokens} tokens)")
```

For each question in `targets[]` (where test plan exists):

```
Print: "── {q_id}: {question_name} ({original_tokens} est. tokens) ──"

attempt = 0
improved = false
best_version = current_text

WHILE attempt < max_attempts AND NOT improved:
    attempt += 1

    # 1a: Generate optimized variant via Task
    compression_strategy = ""
    IF attempt == 1:
        compression_strategy = "Use STRUCTURAL compression: remove redundant phrases, " +
            "collapse repeated patterns, eliminate restated conditions. " +
            "Keep all edge cases and calibration anchors."
    ELIF attempt == 2:
        compression_strategy = "Use SEMANTIC compression: rephrase for information density. " +
            "Replace verbose descriptions with precise terminology. " +
            "Merge overlapping conditions into compound predicates."
    ELSE:
        compression_strategy = "Use RADICAL compression: minimum viable question. " +
            "Distill to the essential detection signal. Remove examples " +
            "only if the criteria text alone is unambiguous without them."

    optimized = Task(
        subagent_type = "general-purpose",
        model = model,
        prompt = """
            You are a prompt engineer optimizing an LLM evaluator question for token efficiency.

            Current question (from review-plan QUESTIONS.md):
            ---
            Q-ID: Q_ID
            CURRENT_TEXT
            ---

            COMPRESSION_STRATEGY

            Create a MORE TOKEN-EFFICIENT version that:
            1. Preserves the FULL breadth and reach of the original question
            2. Maintains all detection capabilities (same issues caught, same false-positive guards)
            3. Uses fewer tokens (more concise phrasing, less repetition)
            4. Keeps the same structure: Question text | Criteria | N/A condition
            5. Does NOT lose edge cases, examples, or calibration anchors that
               prevent false positives/negatives — unless the criteria text alone
               is unambiguous without them

            PRESERVATION PRIORITY (most → least important):
            - PURPOSE/WHY statements: consequence explanations, failure mode descriptions,
              risk framing ("silent in dynamic langs", "#1 cause of plan-to-impl failure").
              These cause the evaluator to independently discover many tactics. ALWAYS KEEP.
            - Methodology directives: "trace each X", "cross-reference each Y", "enumerate".
              These change HOW the evaluator works, not just WHAT it checks. ALWAYS KEEP.
            - Evaluator heuristics: decision rules ("assume X = flag if high-risk; TBD = always flag").
              These are instructions TO the evaluator. ALWAYS KEEP.
            - Calibration examples: boundary-defining examples ("test X passes" = acceptable;
              "it works" = insufficient). Keep if they define the PASS/NEEDS_UPDATE boundary.
              Remove only if the criteria text alone is unambiguous without them.
            - Tactic enumerations: numbered flag lists. These CAN be compressed — a good
              purpose statement elicits the evaluator to discover tactics independently.
              Compress verbose flag lists; keep concise ones.
            - Generic consequences ("causes bugs", "leads to errors"): SAFE TO REMOVE —
              every evaluator knows bugs are bad.

            LEARNINGS_BRIEFING

            Apply the above learnings alongside the preservation hierarchy.

            CRITICAL: The optimized version must catch the SAME issues as the original
            when applied to a plan. Preserve WHY over HOW — a question that explains the
            failure mode generates better evaluator behavior than an exhaustive flag list.

            Output format:
            Line 1: One-sentence summary of what you changed (e.g., "Removed 2 consequence clauses, merged overlapping flag conditions")
            Line 2: ---
            Line 3+: The optimized criteria column text only. No commentary, no Q-ID, no table formatting, no markdown fences.
        """
    )

    *Substitution rules:*
    - Q_ID → the question's ID (e.g., "Q-G10")
    - CURRENT_TEXT → the current criteria column text
    - COMPRESSION_STRATEGY → strategy text from above
    - LEARNINGS_BRIEFING → `learnings_briefing` from Step 0 (empty string if no LEARNINGS.md)

    *Parse response:* Split output on first `---` line. Part before → `compression_description`.
    Part after → optimized criteria text. If no `---` found, treat entire output as criteria text
    and set `compression_description = "no description provided"`.

    # 1b: Compute token savings
    original_tokens = Math.floor(current_text.length / 4)
    optimized_tokens = Math.floor(optimized.length / 4)
    savings_pct = Math.round((1 - optimized_tokens / Math.max(original_tokens, 1)) * 100 * 10) / 10

    # 1c: Skip if savings < 5% (not worth the comparison cost)
    IF savings_pct < 5:
        Print: "  attempt {attempt}: only {savings_pct}% smaller — skipping comparison"
        CONTINUE

    Print: "  attempt {attempt}: {original_tokens} → {optimized_tokens} tokens ({savings_pct}% smaller)"

    # 1d: Write both versions to temp files for compare-questions
    Write current_text to OPT_TMPDIR/{q_id}-original.md
    Write optimized to OPT_TMPDIR/{q_id}-optimized-v{attempt}.md

    # 1e: Run compare-questions logic inline
    # Apply both questions to the test plan, judge the results.
    # This replicates the compare-questions flow for a single plan:

    # Apply original and optimized questions to test plan (spawn both in parallel, run_in_background: true)
    revision_a = Task(
        subagent_type = "general-purpose",
        model = model,
        prompt = """
            You are a software planning consultant. Read this plan, consider the question,
            and produce a REVISED PLAN that addresses the question's concern.

            Rules:
            - Output the complete revised plan (not a diff, not commentary)
            - Make only changes necessary to address the question's concern
            - Preserve structure, formatting, and unrelated content
            - If the question reveals no real issue, output the plan unchanged
              with <!-- NO_CHANGE: [reason] --> at the top
            - No generic boilerplate — only specific, concrete improvements

            <QUESTION>
            {current_text}
            </QUESTION>

            <PLAN>
            {plan_contents}
            </PLAN>

            Output the revised plan below. No preamble, no explanation — just the plan.
        """
    )

    # Apply optimized question to test plan (in parallel with above, run_in_background: true)
    revision_b = Task(
        subagent_type = "general-purpose",
        model = model,
        prompt = """
            You are a software planning consultant. Read this plan, consider the question,
            and produce a REVISED PLAN that addresses the question's concern.

            Rules:
            - Output the complete revised plan (not a diff, not commentary)
            - Make only changes necessary to address the question's concern
            - Preserve structure, formatting, and unrelated content
            - If the question reveals no real issue, output the plan unchanged
              with <!-- NO_CHANGE: [reason] --> at the top
            - No generic boilerplate — only specific, concrete improvements

            <QUESTION>
            {optimized}
            </QUESTION>

            <PLAN>
            {plan_contents}
            </PLAN>

            Output the revised plan below. No preamble, no explanation — just the plan.
        """
    )

    # Write revisions to temp files
    Write revision_a to OPT_TMPDIR/{q_id}-revision-a.md
    Write revision_b to OPT_TMPDIR/{q_id}-revision-b.md

    # Judge (position-randomized to mitigate position bias)
    coin_flip = random boolean
    IF coin_flip:
        # Optimized appears as "A" to the judge; original appears as "B"
        judge_question_a = optimized
        judge_question_b = current_text
        judge_revision_a = revision_b    # result produced by optimized question
        judge_revision_b = revision_a    # result produced by original question
    ELSE:
        # Original appears as "A" to the judge; optimized appears as "B"
        judge_question_a = current_text
        judge_question_b = optimized
        judge_revision_a = revision_a    # result produced by original question
        judge_revision_b = revision_b    # result produced by optimized question

    judge_result = Task(
        subagent_type = "compare-questions-judge",
        model = "claude-opus-4-6",
        prompt = """
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
            {"scores":{"correctness":"?","actionability":"?","insight":"?","economy":"?","trust":"?"},"winner":"?","reasoning":"<1-2 sentences>","valid":true,"recusal":null}
        """
    )

    # Parse judge result FIRST (judge_result is raw Task output string)
    TRY: judge_result = parse JSON from judge_result
    CATCH: judge_result = {winner: "TIE", scores: {}, reasoning: "parse error"}

    # Remap judge result back to original/optimized orientation
    # Must happen AFTER parse (need structured object) and BEFORE evaluation
    IF coin_flip:
        # Judge's "A" was optimized, "B" was original — invert both scores and winner
        FOR key IN judge_result.scores:
            IF judge_result.scores[key] == "A": judge_result.scores[key] = "B"
            ELIF judge_result.scores[key] == "B": judge_result.scores[key] = "A"
            # "TIE" unchanged
        IF judge_result.winner == "A": judge_result.winner = "B"   # optimized won → B in our terms
        ELIF judge_result.winner == "B": judge_result.winner = "A" # original won → A in our terms
        # "TIE" unchanged

    # 1f: Handle recusal — if judge determined trial was invalid, skip (don't count as win or loss)
    IF judge_result.valid == false:
        Print: "  ⚠ attempt {attempt}: RECUSED — {judge_result.recusal.reason}"
        Print: "     Fix: {judge_result.recusal.fix}"
        CONTINUE  # try next attempt (different compression strategy may produce a fairer trial)

    # 1g: Evaluate — apply tiebreaker chain
    # Quality: winner from judge
    # If TIE on quality and savings >= 10%: optimized wins (fewer tokens)
    IF judge_result.winner == "B" (optimized):
        improved = true
        decided_by = "quality"
    ELIF judge_result.winner == "TIE" AND savings_pct >= 10:
        improved = true
        decided_by = "input tokens (quality tied)"
    ELIF judge_result.winner == "TIE" AND savings_pct < 10:
        improved = false
        decided_by = "neutral (quality tied, savings below threshold)"
    ELSE:
        improved = false
        decided_by = "quality (original better)"

    IF improved:
        best_version = optimized
        Print: "  ✅ attempt {attempt}: optimized wins — {decided_by} ({savings_pct}% fewer tokens)"
        winning_strategy = IF attempt == 1: "STRUCTURAL" ELIF attempt == 2: "SEMANTIC" ELSE: "RADICAL"
        results.append({q_id, original_tokens, optimized_tokens, savings_pct, verdict: "updated", attempt,
                        winning_strategy, judge_scores: judge_result.scores, judge_reasoning: judge_result.reasoning,
                        compression_description})
        TaskUpdate(task_ids[q_id], status = "completed",
                   subject = "Optimize {q_id}: {savings_pct}% smaller ✅")
    ELSE:
        Print: "  ❌ attempt {attempt}: original wins — {decided_by}"
        Print: "     Judge: {judge_result.reasoning}"

IF NOT improved:
    Print: "  ➖ kept original after {max_attempts} attempts"
    results.append({q_id, original_tokens, original_tokens, 0, verdict: "kept", attempt: max_attempts,
                    winning_strategy: null, judge_scores: judge_result.scores, judge_reasoning: judge_result.reasoning,
                    compression_description})
    TaskUpdate(task_ids[q_id], status = "completed",
               subject = "Optimize {q_id}: kept original ➖")
```

**State output:** `results[]`, `best_versions{}` (q_id → best text)
Consumed by: Step 2.

---

## Step 2 — Apply Updates

IF dry_run:
    Print: "🔒 DRY RUN — no files updated"
    Skip to Step 3.

For each question where `verdict == "updated"`:

1. Read the source file (QUESTIONS.md or QUESTIONS-L3.md)
2. Find the row for `q_id` — match `| {q_id} |` at start of line
3. Replace the Criteria column content (3rd `|`-delimited field) with `best_version`
4. Use the Edit tool to apply the change
5. Print: `"  ✏️  {q_id}: updated in {source_file}"`

For Q-G9 sub-questions: Edit the inline definition in SKILL.md instead.

---

## Step 3 — Summary Report

```
## optimize-questions Results

| Q-ID | Original | Optimized | Savings | Verdict | Attempt |
|------|----------|-----------|---------|---------|---------|
| {q_id} | ~{original_tokens} | ~{optimized_tokens} | {savings_pct}% | {verdict_emoji} {verdict} | {attempt} |
...

──────────────────────────────────────────────────────
  Total:    {updated_count} of {total_count} questions optimized
  Tokens:   ~{total_original} → ~{total_optimized} ({total_savings_pct}%)
  Kept:     {kept_count} (original was better)
  Skipped:  {skipped_count} (no test plan)
  Learnings: pending extraction (Step 4)
──────────────────────────────────────────────────────
```

Where verdict_emoji: `✅` = updated, `➖` = kept, `⚠` = skipped.

---

## Step 4 — Learnings Extraction

IF dry_run OR len(results) == 0:
    Print: "📝 Skipping learnings extraction"
    Skip to Step 5.

```
# 4a: Build run summary from results[]
run_summary = {
    timestamp: ISO8601 now,
    scope: "{layers_summary}, {len(results)} questions",
    results: results[]  # already enriched with judge_scores, reasoning, etc.
}

# 4b: Load existing learnings
learnings_file = "skills/optimize-questions/LEARNINGS.md"
existing_content = Read(learnings_file) IF exists ELSE ""

# 4c: Spawn analysis agent (single Opus call)
analysis = Task(
    subagent_type = "general-purpose",
    model = "claude-opus-4-6",
    prompt = """
        You are analyzing results from an LLM evaluator question optimization run
        to extract reusable compression learnings.

        <RUN_RESULTS>
        {run_summary as JSON}
        </RUN_RESULTS>

        <EXISTING_LEARNINGS>
        {existing_content}
        </EXISTING_LEARNINGS>

        Analyze each result:
        - For wins: What compression technique worked? What text was safely removed?
          What made the judge prefer the optimized version?
        - For losses: What caused quality regression? Which preservation category
          was violated? What should future compression avoid?
        - For ties decided by tokens: What compression was quality-neutral?

        Cross-reference against existing observations. If a pattern now appears
        3+ times across runs, promote it to a Principle.

        Output ONLY valid JSON (no markdown fences):
        {
          "observations": [
            {
              "q_id": "Q-G10",
              "strategy": "STRUCTURAL",
              "outcome": "win|loss|tie",
              "description": "what was changed",
              "savings_pct": 28.6,
              "pattern": "extracted reusable pattern",
              "judge_summary": "quality TIE, decided by tokens"
            }
          ],
          "new_principles": [
            {"id": "P6", "text": "principle text", "evidence_count": 3}
          ],
          "compression_guidance": "1-2 sentence guidance for next run's compression agents"
        }
    """
)

# 4d: Parse analysis output
parsed = JSON.parse(analysis)

# 4e: Update LEARNINGS.md
# - Append new observations to "## Recent Observations" (newest first)
# - Add any new principles to "## Principles"
# - Replace "## Compression Guidance" with new guidance
# - Prune observations beyond 50 entries (remove oldest run block)
# Use Edit tool to update each section

# 4f: Update memory file if new principles promoted
IF parsed.new_principles is non-empty:
    Append to ~/.claude/projects/.../memory/project_prompt_compression_learnings.md

Print: "📝 Learnings: {len(parsed.observations)} observations, {len(parsed.new_principles)} new principles"
```

**Cost:** Exactly 1 additional Opus agent call per run (not per question).

---

## Step 5 — Cleanup

```bash
rm -rf "$OPT_TMPDIR"
```

Print: "Temp files cleaned up."

---

## Error Reference

| Condition | Action |
|-----------|--------|
| No question IDs resolved | Abort: "ERROR: No valid question IDs found." |
| All test plans missing | Abort: "ERROR: No test plans found. Generate corpus first." |
| Question text extraction fails | Skip with warning, continue |
| Compare-questions judge error | Count as "original wins" for that attempt |
| Edit tool fails on QUESTIONS.md | Warn and continue (don't corrupt file) |
| Savings < 0% (variant longer) | Skip comparison entirely |
| Learnings analysis agent error | Warn and continue (learnings not updated this run) |
| LEARNINGS.md parse error | Skip learnings briefing injection, warn |
