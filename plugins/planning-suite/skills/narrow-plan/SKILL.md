---
name: narrow-plan
description: |
  Information-gain-driven intent disambiguation. Use when the user has an ambiguous goal and
  wants to converge on a single best refined intent (and resulting plan) via iterative
  questioning. Loop generates 5 candidate refinements per round, rates them via parallel rater
  fan-out, asks the 2 highest-info-gain clarifying questions, and stops when one refinement is
  dominant + clearly ahead + persistent across rounds. Up to ~277 sonnet dispatches per run —
  only invoke when intent ambiguity is the bottleneck.

  AUTOMATICALLY INVOKE when:
  - "narrow the plan", "disambiguate this intent", "which plan should I build"
  - User describes a goal in 1-2 sentences and asks "help me figure out what I actually want"
  - User has competing interpretations of their own request and can't pick

  NOT for:
  - Plans that already have a clear winner — use /architect or /schedule-plan-tasks
  - Well-specified requirements — no ambiguity to resolve
  - One-shot decisions — overhead exceeds value
allowed-tools: all
---

# /narrow-plan — Information-Gain Intent Disambiguation

Given a user's ambiguous prompt, converge on a single refined intent through iterative
questioning, then synthesize a concrete plan from it.

## Architecture (one-paragraph orient)

The orchestrator (this Claude session, executing this SKILL.md) drives a loop. Each round:
generate 5 candidate intent refinements via Task(); rate them via 10 parallel rater Task()s
with randomized label permutations; check stop rule; propose 10 clarifying questions and rank
by simulated info-gain; ask the top 2 (LLM-answered first, escalate to user on disagreement);
tombstone Q/A into a growing prompt.md and a per-round git commit. Stop when one refinement
is `p_top >= 0.70 AND margin >= 0.30 AND was carried forward from prior round`. Hard cap 6
rounds; stagnation early-exit if entropy plateaus.

Math/data helpers live in `lib/`; role prompt templates in `references/role-prompts.md`. JSON
schemas in `references/schemas/`. Run state under `${CLAUDE_PLUGIN_DATA}/runs/<run-id>/`.

## Step 0 — Tool Loading + Run Init

Load `AskUserQuestion` via `ToolSearch` (deferred tool in this harness):
```
ToolSearch({ query: "select:AskUserQuestion", max_results: 1 })
```

Generate `<run-id>` as `<UTC-iso8601>-<6-char-random>` (e.g. `2026-05-09T15-22-44Z-a3f9c1`).

Create the run directory and initialize git:
```bash
RUN_DIR="${CLAUDE_PLUGIN_DATA}/runs/<run-id>"
mkdir -p "$RUN_DIR"
# Write the user's original intent to prompt.md (escape as needed)
printf '%s\n' "$USER_INTENT" > "$RUN_DIR/prompt.md"
touch "$RUN_DIR/tombstones.jsonl"
git -C "$RUN_DIR" init -q
git -C "$RUN_DIR" add .
git -C "$RUN_DIR" commit -q -m "init: <run-id>"
```

**Crash policy**: on any failure mid-run, abandon the run-id and start fresh. There is no
resume protocol. The user re-invokes the skill if interrupted.

## Step 1 — Round Loop

Initialize `round = 1`.

Repeat until terminated by stop rule, hard cap, or stagnation:

### 1a. Generate refinements

Read the `GENERATOR` template from `references/role-prompts.md`. Substitute:
- `{{prompt_md}}` → `$RUN_DIR/prompt.md` (the path)
- For round 1: render the `{{else}}` branch (all 5 fresh).
- For round >= 2: render the `{{#if carry_forward}}` branch with the top-2 from the prior
  round's `distribution.json` inlined as `cf_a_text` (winning slot's content) and `cf_b_text`
  (second-place slot's content), with their original slot labels as `cf_a_prior_slot` /
  `cf_b_prior_slot`. The `cf_array` is `[{"this_slot":"A","prior_slot":"<X>"},{"this_slot":"B","prior_slot":"<Y>"}]`.

Dispatch:
```
Agent({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "narrow-plan generator round N",
  prompt: <substituted template>
})
```

Parse the JSON response. Write to `$RUN_DIR/round-N/refinements.json` (validates against
`references/schemas/refinements.schema.json`).

### 1b. Rate via fan-out (10 parallel raters with permuted labels)

Generate 10 random label permutations. Each `pi_i` is a bijection `{A,B,C,D,E} → {A,B,C,D,E}`.
Write them to `$RUN_DIR/round-N/rater-permutations.json` as `{"0": {"A":"C","B":"A",...}, "1":
{...}, ...}`.

Read the `RATER` template. For each rater i (0..9), substitute:
- `{{prompt_md}}` → `$RUN_DIR/prompt.md`
- `{{refinements_json}}` → `$RUN_DIR/round-N/refinements.json`
- `{{permutation_table}}` → human-readable rendering of `pi_i` (e.g. "Original A appears as
  C; original B appears as A; ...")
- `{{example_perm_a}}` → `pi_i["A"]`

Dispatch all 10 in a single message (parallel batching):
```
Agent({ subagent_type: "general-purpose", model: "sonnet", temperature: 0.7,
        description: "narrow-plan rater 0/10", prompt: <rater 0 prompt> })
Agent({ subagent_type: "general-purpose", model: "sonnet", temperature: 0.7,
        description: "narrow-plan rater 1/10", prompt: <rater 1 prompt> })
... (8 more in the same message)
```

Append each rater's response to `$RUN_DIR/round-N/rater-outputs.jsonl` as
`{"agent_idx": i, "raw": <agent text>}`.

Re-dispatch any rater whose response can't yield a letter (per the extraction rules in
`lib/aggregate-rater.js`) up to 2 times, re-emphasizing "output exactly one letter".

Run the aggregator:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/narrow-plan/lib/bin/aggregate-rater.js" "$RUN_DIR/round-N"
```

This writes `distribution.json`. If it throws "only N raters succeeded, minimum is 5", jump
to the epilogue with `did_not_converge: true, reason: schema_failures_exceeded`.

### 1c. Stop check

Run:
```bash
PRIOR=""
[ -d "$RUN_DIR/round-$((N-1))" ] && PRIOR="$RUN_DIR/round-$((N-1))"
node "${CLAUDE_PLUGIN_ROOT}/skills/narrow-plan/lib/bin/stop-rule.js" "$RUN_DIR/round-N" "$PRIOR"
```

Read `$RUN_DIR/round-N/stop-check.json`:
- `passes: true` → jump to **Step 2 (Epilogue)** with verdict `converged`.
- `passes: false` AND `round == 6` → jump to **Step 2** with verdict `did_not_converge,
  reason: cap_reached`.

**From round 3 onward**, also run stagnation-check:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/narrow-plan/lib/bin/stagnation-check.js" \
  "$RUN_DIR/round-N" "$RUN_DIR/round-$((N-2))"
```
Track stagnation across rounds. If `stagnated: true` for round N AND round N-1, jump to
**Step 2** with `did_not_converge, reason: stagnation`.

### 1d. Propose questions

Read the `PROPOSER` template, substitute paths to `prompt.md`, `refinements.json`,
`distribution.json`. Dispatch one Task(general-purpose, sonnet).

Validate the response against `question-candidates.schema.json` (each candidate's answer
priors sum to 1.0 +/- 1e-6). Re-dispatch up to 2 times on failure with the schema requirement
re-emphasized. On third failure, drop the offending candidate. If fewer than 5 valid
candidates remain, jump to **Step 2** with `did_not_converge, reason:
schema_failures_exceeded`.

Write `question-candidates.json`.

### 1e. Score info-gain via counterfactual ratings

**Use a fan-out coordinator subagent** so 30 counterfactual prompts (~30 KB / round) never
touch main context. Main context only writes the dispatch task and reads the result path.

Write `$RUN_DIR/round-N/cf-dispatch-task.json`:
```json
{
  "round_dir": "<absolute $RUN_DIR/round-N>",
  "prompt_md": "<absolute $RUN_DIR/prompt.md>",
  "refinements_json": "<absolute $RUN_DIR/round-N/refinements.json>",
  "candidates_json": "<absolute $RUN_DIR/round-N/question-candidates.json>",
  "rater_template": "<the COUNTERFACTUAL_RATER template body from references/role-prompts.md, with {{prompt_md}} and {{refinements_json}} pre-substituted but {{hypothetical_question}} and {{hypothetical_answer}} left as placeholders>"
}
```

Dispatch the fan-out coordinator (one Task call):
```
Agent({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "narrow-plan counterfactual fan-out coordinator round N",
  prompt: <COUNTERFACTUAL_DISPATCHER template from references/role-prompts.md, with {{cf_dispatch_task}} → "$RUN_DIR/round-N/cf-dispatch-task.json">
})
```

The coordinator reads the task file, dispatches all 30 counterfactual raters in batches of
≤10 per message at `temperature: 0.5`, parses each posterior, and writes the aggregated
results to `$RUN_DIR/round-N/counterfactual-posteriors.jsonl`. It returns only the path to
that file. Main context never sees the 30 prompts or the 30 raw posteriors.

Score:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/narrow-plan/lib/bin/info-gain.js" "$RUN_DIR/round-N"
```

Writes `info-gain.json` (sorted by `expected_reduction` desc). Also write `questions.json`:
top-5 from `info-gain.json`, with the top 2 marked `ask: true`.

### 1f. Answer the top 2 questions

For each of the 2 questions marked `ask: true`:

Dispatch ANSWERER_FRAMING_1 (sonnet, temperature 0.3, concise) and ANSWERER_FRAMING_2 (sonnet,
temperature 0.3, deliberative) in parallel — single message, 2 dispatches.

Compare answers:
- Multiple-choice: verbatim match.
- Free-text: lowercased + trimmed + punctuation-stripped first-line equality.

**If equal** → use that answer. `source: "llm"`, `agreed_by_two_framings: true`.

**If different** → call `AskUserQuestion`:
```
AskUserQuestion({
  questions: [{
    question: <the question>,
    header: "Round N",
    options: [
      {label: <framing_1.answer truncated>, description: "Framing 1 (concise)"},
      {label: <framing_2.answer truncated>, description: "Framing 2 (deliberative)"}
    ],
    multiSelect: false
  }]
})
```
The user picks one (or chooses "Other" for free-text). `source: "user"`,
`agreed_by_two_framings: false`.

Write `answers.json` summarizing both questions.

### 1g. Tombstone + commit

For each Q/A pair:
```bash
RECORD='{"round": N, "question": "...", "answer": "...", "source": "llm|user", "agreed_by_two_framings": true|false}'
node "${CLAUDE_PLUGIN_ROOT}/skills/narrow-plan/lib/bin/tombstone.js" \
  "$RUN_DIR" "$RECORD" "round-N: <slot> p_top=X.XX margin=X.XX"
```

(The script appends to `tombstones.jsonl`, appends a Q/A block to `prompt.md`, and commits.)

After the second tombstone, also `git -C "$RUN_DIR" tag round-N` so `git show round-N` works
later.

### 1h. Print the round progress card

After the round commits, print this card to the user (NOT to the agent transcript — this is
the user-facing progress display). Compose from `stop-check.json`, `distribution.json`,
prior round's `distribution.json` (if N >= 2), `answers.json`, and `refinements.json`.

```
┌─ Round N/6 ─────────────────────────────────────────────────────────────┐
│ Distribution (sparkline shows shift from prior round):                  │
│   A  ████████████░░░░░░  0.55  ↑0.13   "<refinement A first 60 chars>"  │
│   B  █████░░░░░░░░░░░░░  0.22  ↓0.05   "<refinement B first 60 chars>"  │
│   C  ███░░░░░░░░░░░░░░░  0.13  ↑0.04   "<refinement C first 60 chars>"  │
│   D  ██░░░░░░░░░░░░░░░░  0.07  ↓0.08   "<refinement D first 60 chars>"  │
│   E  █░░░░░░░░░░░░░░░░░  0.03  ↓0.04   "<refinement E first 60 chars>"  │
│                                                                         │
│ Stop check: ✗ margin 0.33 ≥ 0.30 ✓, p_top 0.55 < 0.70 ✗, persistent ✓   │
│ Entropy: 1.85 bits  (round N-2 was 2.13 — dropping)                     │
│                                                                         │
│ Asked this round (top-2 by info-gain):                                  │
│   Q1 [llm-agreed]: <question text truncated to 70 chars>                │
│        → <answer truncated to 60 chars>                                 │
│   Q2 [user]:       <question text truncated to 70 chars>                │
│        → <user's chosen answer>                                         │
│                                                                         │
│ Next: round N+1, generator will preserve A & B, refresh C/D/E.          │
└─────────────────────────────────────────────────────────────────────────┘
```

Rules for the card:
- Sparkline = 18-char bar, filled `█` proportional to probability, padded with `░`.
- `↑` / `↓` deltas only for round ≥ 2 (compare to prior round's distribution by ORIGINAL slot,
  not the carried-forward order). Round 1: omit deltas, write `(round 1 baseline)` instead.
- Stop-check line shows each of the 3 conditions individually with ✓/✗ — makes it obvious
  WHY a round didn't terminate.
- Entropy line only from round 3 onward; otherwise omit.
- Question source markers: `[llm-agreed]` (both framings agreed), `[user]` (escalated due to
  framings disagreeing).
- "Next" line: on the FINAL round (passes=true OR cap=6 OR stagnation), replace with:
  `Done: verdict=<converged|did_not_converge>, synthesizing plan...`

Increment `round`. Loop back to **1a**.

## Step 2 — Epilogue (plan synthesis)

Once the loop exits (via converged, cap_reached, stagnation, or schema_failures_exceeded):

Read winning refinement from `round-N/refinements.json` at the slot indicated by
`round-N/stop-check.json#winning_slot` (or, on did_not_converge, the highest-probability slot
in the final round's `distribution.json`).

Read `PLAN_SYNTHESIZER` template, substitute:
- `{{winning_refinement}}` → the winning slot's text
- `{{prompt_md}}` → `$RUN_DIR/prompt.md`
- `{{git_log_oneline}}` → output of `git -C "$RUN_DIR" log --oneline`
- `{{final_plan_path}}` → `$RUN_DIR/final-plan.md`

Dispatch one Task(general-purpose, sonnet). The agent writes `final-plan.md` directly.

Write `$RUN_DIR/final.json`:
```json
{
  "verdict": "converged" | "did_not_converge",
  "winning_slot": "<X>",
  "winning_refinement": "<full text>",
  "final_distribution": <last round's distribution.json>,
  "rounds_used": N,
  "run_dir": "<absolute $RUN_DIR>",
  "synthesized_plan_path": "<absolute path to final-plan.md>",
  "reason": "<cap_reached | stagnation | schema_failures_exceeded, only if did_not_converge>"
}
```

Final commit:
```bash
git -C "$RUN_DIR" add .
git -C "$RUN_DIR" commit -q -m "final: <verdict>"
```

Report to the user:
- The verdict (converged / did_not_converge + reason).
- The winning refined intent (full text).
- Path to `final-plan.md`.
- `git -C <run_dir> log --oneline` for the curious.

## Invariants

- All Task() dispatches use `subagent_type: "general-purpose"` and `model: "sonnet"`.
- Maximum 10 Task() dispatches per single message (counterfactuals chunk into 3 batches of 10).
- Main context never reads `prompt.md`, `refinements.json`, or candidate-question prose. It
  only holds artifact paths, JSON results from `lib/bin/*`, and stop-rule verdicts.
- Round 1 cannot terminate by construction (`carry_forward` is empty → `top_was_carried_forward`
  is false → `passes` is false).
- The two-framing answerer pipeline has no LLM tiebreaker. Disagreement IS the user-escalation
  signal.
- Refinements are 1-3 sentences each, NEVER plans or implementation steps. Plans are
  synthesized once, in the epilogue.
- Crash mid-run = abandon the run-id. No resume protocol.
