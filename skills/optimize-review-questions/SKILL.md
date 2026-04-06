---
name: optimize-review-questions
description: |
  Systematically optimize code-reviewer quality questions (Q1-Q15) for token efficiency
  while maintaining detection quality. For each target question: generates 3 token-optimized
  variants (STRUCTURAL, SEMANTIC, RADICAL) in parallel, selects the best one, A/B tests it
  against code fixtures with known bugs using review-fix-judge for objective tp/fn/fp scoring,
  and updates agents/code-reviewer.md + agents/review-fix.md CLUSTERS if the variant wins.
  Retries up to N times with judge feedback.

  AUTOMATICALLY INVOKE when user mentions:
  - "optimize review questions", "compress code-review questions"
  - "token-optimize code-reviewer", "make review questions more concise"
  - "review question efficiency", "shrink reviewer prompts"

  STRONGLY RECOMMENDED for:
  - Reducing review-fix token consumption
  - Iterative code-review question quality improvement
  - Validating question rewrites against ground-truth fixtures

argument-hint: "[question-ids] [--max-attempts N] [--dry-run] [--model MODEL]"
allowed-tools: Agent, Task, TaskCreate, TaskGet, TaskList, TaskUpdate, TaskStop, TaskOutput, Bash, Read, Glob, Write, Edit, Grep
---

# optimize-review-questions Skill

Optimize code-reviewer quality questions for token efficiency. For each target question:
generate 3 variants in parallel → select best → A/B test against code fixtures with ground truth →
update agents/code-reviewer.md + agents/review-fix.md if better.

**Priority chain:** quality > input tokens > time.
**Key difference from optimize-questions:** Uses objective ground-truth detection (tp/fn/fp)
instead of subjective 5-dimension pairwise judging. Code fixtures with known bugs serve as
test cases instead of plan files.

## Argument Reference

| Parameter | Required? | What to look for | Default |
|-----------|-----------|-------------------|---------|
| `question_ids` | no | Comma-separated Q-IDs (`Q1,Q5,Q7`), range (`Q1..Q8`), group (`universal`, `safety`, `intent`, `integration`, `ecosystem`), or `all` | `all` |
| `max_attempts` | no | `--max-attempts N` or `N attempts` | 2 |
| `dry_run` | no | `--dry-run`, `dry run`, `preview` | false |
| `model` | no | `--model MODEL` (must match `claude-*`) | claude-sonnet-4-6 |

**Group expansion:**
- `universal` → Q1, Q2, Q3, Q4, Q5
- `safety` → Q1, Q2, Q3, Q14 (review-fix cluster)
- `intent` → Q4, Q5, Q12, Q13 (review-fix cluster)
- `integration` → Q7, Q8, Q11 (review-fix cluster)
- `ecosystem` → Q6, Q9, Q10, Q15 (review-fix cluster)
- `all` → Q1..Q15

**Note:** Q9-Q15 currently lack fixture coverage and will be automatically skipped with a
warning. Only Q1-Q8 have ground-truth fixtures. Groups containing uncovered Q-IDs (e.g.,
`safety` includes Q14, `all` includes Q9-Q15) will process the covered subset and skip the rest.

**Range expansion:** `Q1..Q8` → Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8.

**Example invocations:**
```
/optimize-review-questions universal
/optimize-review-questions Q1,Q5,Q7 --max-attempts 3
/optimize-review-questions all --dry-run
/optimize-review-questions safety --model claude-opus-4-6
```

---

## Step 0 — Parse & Load

1. **Parse question IDs** from `<prompt-arguments>`. Expand groups, ranges, and `all`.

2. **Extract current question text** for each target Q-ID from canonical sources:

   **Source file mapping:**
   - Q1-Q5 (Universal): `agents/code-reviewer.md` — paragraph format: `**Q{N} — {Title}**: {text}`
   - Q6-Q13 (Context-Specific): `agents/code-reviewer.md` — table row: `| Q{N} | {trigger} | {question} |`
   - Q14-Q15: `agents/review-fix.md` — CLUSTERS array `definition` field only (no code-reviewer.md entry)

   **Extraction:**
   - Read `agents/code-reviewer.md`. For Q1-Q5: find line starting `**Q{N}` and extract full paragraph.
     For Q6-Q13: find table row starting `| Q{N} |` and extract the Question column (3rd `|`-delimited field).
   - Read `agents/review-fix.md`. For Q14-Q15: find the CLUSTERS `definition` field containing `**Q{N}`.
   - For ALL Q-IDs: also extract the CLUSTERS `definition` field from `agents/review-fix.md` for sync verification.

3. **Find matching fixtures** for each target Q-ID:
   - Glob `test/fixtures/review-fix/*.ground-truth.json`
   - For each fixture: parse JSON, check if any issue has `"question": "Q{N}"`
   - Build `fixture_map[q_id]` = list of `{fixture_path, source_path, ground_truth}` objects
   - Q-IDs with no matching fixtures → warn and skip: `"⚠ No fixture coverage for Q{N} — skipping"`

4. **Load learnings briefing** (if LEARNINGS.md exists):
   - Read `skills/optimize-review-questions/LEARNINGS.md`
   - Extract `## Principles` section → `principles_text`
   - Extract `## Compression Guidance` section → `guidance_text`
   - Build `learnings_briefing` (same format as optimize-questions)
   - If file doesn't exist → `learnings_briefing = ""`

5. **Print inventory:**
   ```
   ╔══════════════════════════════════════════════════════════════╗
   ║  optimize-review-questions                                   ║
   ║                                                              ║
   ║  Targets:   {N} questions ({group_summary})                  ║
   ║  Fixtures:  {M} of {N} have fixture coverage                 ║
   ║  Attempts:  {max_attempts} per question                      ║
   ║  Mode:      {dry_run ? "DRY RUN (no updates)" : "LIVE"}     ║
   ║  Model:     {model}                                          ║
   ╚══════════════════════════════════════════════════════════════╝
   ```

6. **Create progress tasks** for each target with fixture coverage:
   ```
   FOR each target in targets[] WHERE fixture_map[q_id] is non-empty:
       TaskCreate(
           subject = "Optimize Q{N}: {question_title}",
           status = "pending"
       )
   ```

**State output:** `targets[]` with `{q_id, current_text, fixture_map, source_file, question_title, clusters_definition}`, `task_ids{}`, `learnings_briefing`
Consumed by: Step 1.

---

## Step 1 — Iterate & Optimize

Create temp dir: `OPT_TMPDIR=$(mktemp -d /tmp/optimize-review-questions.XXXXXX)`

**Results tracking:**
```
results = []  # {q_id, original_tokens, optimized_tokens, savings_pct, verdict, attempt,
              #  winning_strategy, detection_summary, compression_description}
```

**Parallelization strategy:** Process questions sequentially (each question's A/B test
involves multiple fixture evaluations — parallelizing across questions would create too
many concurrent agents). Within each question: parallelize applier + judge agents.

Update each question's task as it progresses:
```
TaskUpdate(task_ids[q_id], status = "in_progress",
           activeForm = "Optimizing Q{N} (~{tokens} tokens)")
```

For each question in `targets[]` (where fixture coverage exists):

```
Print: "── Q{N}: {question_title} ({original_tokens} est. tokens, {fixture_count} fixture(s)) ──"

attempt = 0
improved = false
best_version = current_text
previous_judge_reasoning = ""

WHILE attempt < max_attempts AND NOT improved:
    attempt += 1

    # 1a: Generate 3 optimized variants in parallel
    previous_feedback = ""
    IF attempt > 1:
        previous_feedback = """
            PREVIOUS ATTEMPT FEEDBACK:
            The previous optimized version failed the A/B test. Detection analysis:
            "{previous_judge_reasoning}"

            Avoid the failure mode described above. Adjust your compression accordingly.
        """

    COMPRESSION_PROMPT = """
        You are a prompt engineer optimizing a code review quality question for token efficiency.

        Current question (from code-reviewer agent):
        ---
        Q-ID: Q_ID
        CURRENT_TEXT
        ---

        COMPRESSION_STRATEGY

        Create a MORE TOKEN-EFFICIENT version that:
        1. Preserves the FULL detection capability of the original question
        2. Catches the same code defects (null derefs, security holes, error handling gaps, etc.)
        3. Uses fewer tokens (more concise phrasing, less repetition)
        4. Maintains the same semantic meaning and scope
        5. Does NOT lose edge cases or calibration anchors that prevent false positives/negatives

        PRESERVATION PRIORITY (most → least important):
        - PURPOSE/WHY statements: failure mode descriptions, risk framing.
          These cause the reviewer to independently discover many code defects. ALWAYS KEEP.
        - Methodology directives: "check boundary values", "trace user input", "verify all paths".
          These change HOW the reviewer works, not just WHAT it checks. ALWAYS KEEP.
        - Evaluator heuristics: decision rules for severity classification. ALWAYS KEEP.
        - Calibration examples: boundary-defining examples. Keep if they define detection boundaries.
        - Tactic enumerations: numbered check lists. CAN be compressed — a good purpose statement
          elicits the reviewer to discover checks independently.
        - Generic consequences ("causes bugs"): SAFE TO REMOVE.

        LEARNINGS_BRIEFING

        PREVIOUS_FEEDBACK

        CRITICAL: The optimized version must detect the SAME code defects as the original
        when applied to source code. Preserve WHY over HOW — a question that explains the
        failure mode generates better reviewer behavior than an exhaustive check list.

        Output format:
        Line 1: One-sentence summary of what you changed
        Line 2: ---
        Line 3+: The optimized question text only. No commentary, no Q-ID, no formatting.
    """

    # Substitution: Q_ID, CURRENT_TEXT, COMPRESSION_STRATEGY, LEARNINGS_BRIEFING, PREVIOUS_FEEDBACK

    # Spawn all 3 variants as parallel Tasks
    variant_structural = Task(
        subagent_type = "general-purpose",
        model = model,
        prompt = COMPRESSION_PROMPT with COMPRESSION_STRATEGY =
            "Use STRUCTURAL compression: remove redundant phrases, " +
            "collapse repeated patterns, eliminate restated conditions. " +
            "Keep all edge cases and calibration anchors."
    )

    variant_semantic = Task(
        subagent_type = "general-purpose",
        model = model,
        prompt = COMPRESSION_PROMPT with COMPRESSION_STRATEGY =
            "Use SEMANTIC compression: rephrase for information density. " +
            "Replace verbose descriptions with precise domain terminology " +
            "(e.g., 'check if null before accessing' → 'null-guard'; " +
            "'could an attacker control this input' → 'taint-trace'). " +
            "LLM reviewers understand technical jargon — use established terms " +
            "without explanation. Merge overlapping conditions into compound predicates."
    )

    variant_radical = Task(
        subagent_type = "general-purpose",
        model = model,
        prompt = COMPRESSION_PROMPT with COMPRESSION_STRATEGY =
            "Use RADICAL compression: minimum viable question. " +
            "Distill to the essential detection signal. Remove examples " +
            "only if the question text alone is unambiguous without them."
    )

    # Parse each variant's output (split on first "---")
    variants = [variant_structural, variant_semantic, variant_radical]
    variant_labels = ["STRUCTURAL", "SEMANTIC", "RADICAL"]
    parsed_variants = []
    FOR i, v IN enumerate(variants):
        Split v on first "---" line → v_description, v_criteria_text
        IF no "---" found: v_description = "no description", v_criteria_text = full output
        parsed_variants.append({label: variant_labels[i], description: v_description, criteria: v_criteria_text})

    successful = [pv for pv in parsed_variants if pv.criteria is non-empty]

    IF len(successful) == 0:
        Print: "  attempt {attempt}: all 3 variants failed — skipping"
        CONTINUE

    IF len(successful) == 1:
        optimized = successful[0].criteria
        compression_description = successful[0].description
        selected_strategy = successful[0].label
        Print: "  attempt {attempt}: only {selected_strategy} succeeded — using directly"

    ELSE:
        # Select best variant (same selector pattern as optimize-questions)
        variant_blocks = ""
        FOR i, sv IN enumerate(successful):
            variant_blocks += """
                <VARIANT_{i+1} strategy="{sv.label}">
                Change summary: {sv.description}
                ---
                {sv.criteria}
                </VARIANT_{i+1}>
            """

        selected_output = Task(
            subagent_type = "general-purpose",
            model = "claude-opus-4-6",
            prompt = """
                You are selecting the best token-optimized variant of a code review question.

                <ORIGINAL>
                Q-ID: {q_id}
                {current_text}
                </ORIGINAL>

                {variant_blocks}

                EVALUATION CRITERIA (in priority order):
                1. DETECTION PRESERVATION: Must catch the same code defects as the original.
                   Check for lost edge cases, removed calibration anchors, dropped methodology.
                2. TOKEN EFFICIENCY: Fewer tokens is better, but only after (1) is satisfied.
                3. PHRASING QUALITY: Clear, precise, unambiguous wording.

                {previous_feedback}

                Output format:
                Line 1: "SELECTED: {STRUCTURAL|SEMANTIC|RADICAL|SYNTHESIZED}"
                Line 2: One-sentence summary of changes from original
                Line 3: ---
                Line 4+: The final optimized question text only. No commentary.
            """
        )

        # Parse selector output (same as optimize-questions)
        Extract "SELECTED: X" → selected_strategy
        Everything after "---" → optimized
        Line 2 → compression_description
        IF parse fails: fall back to first successful variant

    # 1b: Compute token savings
    original_tokens = Math.floor(current_text.length / 4)
    optimized_tokens = Math.floor(optimized.length / 4)
    savings_pct = Math.round((1 - optimized_tokens / Math.max(original_tokens, 1)) * 100 * 10) / 10

    # 1c: Skip if savings < 5%
    IF savings_pct < 5:
        Print: "  attempt {attempt}: only {savings_pct}% smaller — skipping comparison"
        CONTINUE

    Print: "  attempt {attempt}: {original_tokens} → {optimized_tokens} tokens ({savings_pct}% smaller)"

    # 1d: A/B test against ALL matching fixtures
    # For each fixture: spawn applier with original AND optimized question, then judge both outputs.

    fixture_scores_original = []  # [{fixture, tp, fn, fp_count}]
    fixture_scores_optimized = []

    FOR each fixture in fixture_map[q_id]:
        # Read fixture source code and ground truth
        source_code = Read(fixture.source_path)
        ground_truth = Read(fixture.fixture_path)  # JSON

        # Spawn 2 applier agents in parallel (single message, two Task calls)
        review_original = Task(
            subagent_type = "general-purpose",
            model = model,
            prompt = """
                You are a code reviewer. Read the source code and answer this single review question.
                Produce findings in standard code-review format:

                **Q{N}: [{title}]** | Finding: Critical / Advisory / None
                > [One-sentence answer]
                Evidence: [file:line — cite specific line numbers]
                Fix: [before/after code blocks for Critical findings]

                You may produce MULTIPLE findings if the question reveals multiple issues.
                Each finding should be a separate block with its own Evidence and Fix.

                <QUESTION>
                {current_text}
                </QUESTION>

                <SOURCE_CODE file="{fixture.source_path}">
                {source_code}
                </SOURCE_CODE>

                Output ONLY the finding block(s). No preamble, no summary.
            """
        )

        review_optimized = Task(
            subagent_type = "general-purpose",
            model = model,
            prompt = """
                You are a code reviewer. Read the source code and answer this single review question.
                Produce findings in standard code-review format:

                **Q{N}: [{title}]** | Finding: Critical / Advisory / None
                > [One-sentence answer]
                Evidence: [file:line — cite specific line numbers]
                Fix: [before/after code blocks for Critical findings]

                You may produce MULTIPLE findings if the question reveals multiple issues.
                Each finding should be a separate block with its own Evidence and Fix.

                <QUESTION>
                {optimized}
                </QUESTION>

                <SOURCE_CODE file="{fixture.source_path}">
                {source_code}
                </SOURCE_CODE>

                Output ONLY the finding block(s). No preamble, no summary.
            """
        )

        # Judge both outputs against ground truth (2 parallel Task calls)
        score_original = Task(
            subagent_type = "review-fix-judge",
            prompt = """
                <GROUND_TRUTH_ISSUES>
                {ground_truth — filter to only issues with "question": "Q{N}"}
                </GROUND_TRUTH_ISSUES>

                <SOURCE_CODE>
                {source_code}
                </SOURCE_CODE>

                <REVIEW_OUTPUT>
                {review_original}
                </REVIEW_OUTPUT>
            """
        )

        score_optimized = Task(
            subagent_type = "review-fix-judge",
            prompt = """
                <GROUND_TRUTH_ISSUES>
                {ground_truth — filter to only issues with "question": "Q{N}"}
                </GROUND_TRUTH_ISSUES>

                <SOURCE_CODE>
                {source_code}
                </SOURCE_CODE>

                <REVIEW_OUTPUT>
                {review_optimized}
                </REVIEW_OUTPUT>
            """
        )

        # Parse judge outputs (JSON: {tp, fn, fp_count, reasoning})
        TRY: score_original = parse JSON from score_original
        CATCH: score_original = {tp: [], fn: ["ALL"], fp_count: 0, reasoning: "parse error"}
        TRY: score_optimized = parse JSON from score_optimized
        CATCH: score_optimized = {tp: [], fn: ["ALL"], fp_count: 0, reasoning: "parse error"}

        fixture_scores_original.append({fixture: fixture.fixture_path, ...score_original})
        fixture_scores_optimized.append({fixture: fixture.fixture_path, ...score_optimized})

        Print: "    {basename(fixture.source_path)}: orig={len(score_original.tp)}tp/{len(score_original.fn)}fn/{score_original.fp_count}fp  opt={len(score_optimized.tp)}tp/{len(score_optimized.fn)}fn/{score_optimized.fp_count}fp"

    # 1e: Aggregate verdict across all fixtures
    any_regression = false
    any_improvement = false
    total_fp_original = 0
    total_fp_optimized = 0

    FOR i in range(len(fixture_scores_original)):
        orig = fixture_scores_original[i]
        opt = fixture_scores_optimized[i]

        # Regression: optimized missed issues original caught
        missed_by_opt = set(orig.tp) - set(opt.tp)  # IDs in original tp but not optimized tp
        IF len(missed_by_opt) > 0:
            any_regression = true

        # Improvement: optimized caught issues original missed
        caught_by_opt = set(opt.tp) - set(orig.tp)
        IF len(caught_by_opt) > 0:
            any_improvement = true

        total_fp_original += orig.fp_count
        total_fp_optimized += opt.fp_count

    fp_change = total_fp_optimized - total_fp_original

    # Decision matrix
    IF any_regression:
        improved = false
        decided_by = "quality (regression: optimized missed issues original caught)"
    ELIF any_improvement AND NOT any_regression:
        improved = true
        decided_by = "quality (optimized detected MORE issues)"
    ELIF NOT any_regression AND savings_pct >= 10:
        improved = true
        decided_by = "input tokens (detection equal, {savings_pct}% smaller)"
    ELIF NOT any_regression AND fp_change < 0:
        improved = true
        decided_by = "fewer false positives (detection equal)"
    ELSE:
        improved = false
        decided_by = "neutral (detection equal, savings below threshold)"

    # Build detection summary for results
    detection_summary = "fixtures={len(fixture_scores_original)}, " +
        "orig_tp={sum tp counts}, opt_tp={sum tp counts}, " +
        "regression={any_regression}, improvement={any_improvement}"

    IF improved:
        best_version = optimized
        Print: "  ✅ attempt {attempt}: optimized wins — {decided_by}"
        results.append({q_id, original_tokens, optimized_tokens, savings_pct, verdict: "updated",
                        attempt, winning_strategy: selected_strategy, detection_summary,
                        compression_description})
        TaskUpdate(task_ids[q_id], status = "completed",
                   subject = "Optimize Q{N}: {savings_pct}% smaller ✅")
    ELSE:
        Print: "  ❌ attempt {attempt}: original wins — {decided_by}"
        previous_judge_reasoning = decided_by + " | " + detection_summary

IF NOT improved:
    Print: "  ➖ kept original after {max_attempts} attempts"
    results.append({q_id, original_tokens, original_tokens, 0, verdict: "kept",
                    attempt: max_attempts, winning_strategy: null, detection_summary,
                    compression_description: null})
    TaskUpdate(task_ids[q_id], status = "completed",
               subject = "Optimize Q{N}: kept original ➖")
```

**State output:** `results[]`, `best_versions{}` (q_id → best text)
Consumed by: Step 2.

---

## Step 2 — Apply Updates (Dual-Location)

IF dry_run:
    Print: "🔒 DRY RUN — no files updated"
    Skip to Step 3.

For each question where `verdict == "updated"`:

1. **Edit `agents/code-reviewer.md`** (canonical source — Q1-Q13 only):
   - For Q1-Q5 (Universal): find the `**Q{N} — {Title}**:` paragraph and replace with `best_version`
   - For Q6-Q13 (Context-Specific): find the table row `| Q{N} |` and replace the Question column
   - Print: `"  ✏️  Q{N}: updated in agents/code-reviewer.md"`

2. **Edit `agents/review-fix.md`** (CLUSTERS — ALL Q-IDs including Q14-Q15):
   - Find the CLUSTERS entry containing `{ id: 'Q{N}'` and replace the `definition` field value
   - For Q14-Q15: this is the ONLY write target (they exist exclusively in CLUSTERS, not in code-reviewer.md)
   - Print: `"  ✏️  Q{N}: synced to agents/review-fix.md CLUSTERS"`

3. **Verify consistency** (Q1-Q13 only — Q14-Q15 have single-source, no cross-check needed):
   - Re-read both files
   - Grep for Q{N} definition in both
   - Confirm semantic equivalence (CLUSTERS definition may be shorter — that's OK as long as
     the core question text matches)

---

## Step 3 — Summary Report

```
## optimize-review-questions Results

| Q-ID | Original | Optimized | Savings | Verdict | Fixtures | Attempt |
|------|----------|-----------|---------|---------|----------|---------|
| Q{N} | ~{orig} | ~{opt} | {pct}% | {emoji} {verdict} | {fixture_count} | {attempt} |
...

──────────────────────────────────────────────────────
  Total:    {updated_count} of {total_count} questions optimized
  Tokens:   ~{total_original} → ~{total_optimized} ({total_savings_pct}%)
  Kept:     {kept_count} (original was better or tied)
  Skipped:  {skipped_count} (no fixture coverage)
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
# 4a: Build run summary
run_summary = {
    timestamp: ISO8601 now,
    scope: "{group_summary}, {len(results)} questions",
    results: results[]
}

# 4b: Load existing learnings
learnings_file = "skills/optimize-review-questions/LEARNINGS.md"
existing_content = Read(learnings_file) IF exists ELSE ""

# 4c: Spawn analysis agent
analysis = Task(
    subagent_type = "general-purpose",
    model = "claude-opus-4-6",
    prompt = """
        You are analyzing results from a code-review question optimization run
        to extract reusable compression learnings.

        <RUN_RESULTS>
        {run_summary as JSON}
        </RUN_RESULTS>

        <EXISTING_LEARNINGS>
        {existing_content}
        </EXISTING_LEARNINGS>

        Analyze each result:
        - For wins: What compression technique preserved detection while reducing tokens?
          What text was safely removed without missing bugs?
        - For losses: What caused detection regression? Which preservation category
          was violated? What should future compression avoid?
        - For ties: What compression was detection-neutral?

        Code-review-specific patterns to watch for:
        - Did removing "check boundary values" cause a null-deref miss?
        - Did domain jargon substitution preserve or lose detection of specific bug types?
        - Are some question types (correctness vs security vs intent) more compressible?

        Cross-reference against existing observations. If a pattern now appears
        3+ times across runs, promote it to a Principle.

        Output ONLY valid JSON (no markdown fences):
        {
          "observations": [
            {
              "q_id": "Q1",
              "strategy": "STRUCTURAL",
              "outcome": "win|loss|tie",
              "description": "what was changed",
              "savings_pct": 28.6,
              "pattern": "extracted reusable pattern",
              "detection_summary": "3tp/0fn/0fp → 3tp/0fn/0fp"
            }
          ],
          "new_principles": [
            {"id": "P1", "text": "principle text", "evidence_count": 3}
          ],
          "compression_guidance": "1-2 sentence guidance for next run's compression agents"
        }
    """
)

# 4d: Parse analysis output and update LEARNINGS.md
# Same update pattern as optimize-questions:
# - Append new observations to "## Recent Observations" (newest first)
# - Add any new principles to "## Principles"
# - Replace "## Compression Guidance" with new guidance
# - Prune observations beyond 50 entries

Print: "📝 Learnings: {len(parsed.observations)} observations, {len(parsed.new_principles)} new principles"
```

---

## Step 5 — Cleanup

```bash
rm -rf "$OPT_TMPDIR"
```

Print: "Temp files cleaned up."
