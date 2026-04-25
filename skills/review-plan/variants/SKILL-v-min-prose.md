---
name: review-plan
description: |
  Universal plan review: 3 layers (general, code, ecosystem). Invoke gas-plan/node-plan based on patterns.
  MANDATORY_PRE_EXIT_PLAN applies.
allowed-tools: all
---

## Role

1. Team-lead orchestrator: coordinate evaluators, edit plan.
2. Authority: Edit, Write, Bash, Read, AskUserQuestion. Spawn Task.
3. Constraint: Live evaluator results authoritative.
4. Goal: 0 NEEDS_UPDATE Gate 1 within 5 passes.
5. Directive: Extract Implementation Intent Questions (Phase 5c.5).
6. Directive: Phase 5g SKILL LEARNINGS review.

---

```
Phases: 1 Discovery → 2 Classification[GATE:tier] → 3a TRIVIAL | 3b SMALL | 3c FULL
4 Convergence[GATE:gate1] → 5 Epilogue[GATE:rating] → 6 Scorecard → 7 Cleanup → 8 Exit
```

# Universal Plan Review: Convergence

3-layer review: general, code, ecosystem. Loop until 0 changes.

## Step 0: Find Plan & Context
1. Find plan: `Glob("~/.claude/plans/*.md")`.
2. Load: `CLAUDE.md`, `MEMORY.md`.

## Step 1: Classification
Task(general-purpose, sonnet, "Classify: REVIEW_TIER (TRIVIAL, SMALL, FULL), RISKS, IS_GAS, IS_NODE, HAS_UI, HAS_EXISTING_INFRA, HAS_UNBOUNDED_DATA.")
gate1_gas = {"Q1", "Q2", "Q13", "Q15", "Q18", "Q42"}; gate1_node = {"N1"}

## Step 2: TRIVIAL
IF REVIEW_TIER == TRIVIAL: Eval Gate 1; exit.

## Step 3: SMALL
IF REVIEW_TIER == SMALL: Eval 10 core + risk questions; exit.

## Step 4: FULL Setup
pass_count = 0; MAX_CONCURRENT = 10
RESULTS_DIR = Bash: mktemp -d /tmp/review-plan.XXXXXX
memo_file = "~/.claude/.review-plan-memo-" + plan_slug + ".json"

## Step 5: Research
PHASE 3c.5: If FULL + risks, dispatch background tasks.

## Step 6: Convergence Loop
DO:
  Restore state from `memo_file` if `pass_count == 0`. (Context-compression recovery)
  IF NOT _recovered: pass_count += 1
  l1_results = {}; cluster_results = {}; ui_results = {}; all_results = {}; pass_delta = {}

  waves = chunk(evaluators_to_spawn, MAX_CONCURRENT)
  FOR wave_idx, wave in enumerate(waves):
    # Spawn Tasks parallel. Collect all_results[name].

  Edit(plan_path). Build delta.
  Write memo_file: {pass_count, RESULTS_DIR, pass_delta, ...} (Checkpoint: persist memoized state)

  IF Gate1 clear AND changes == 0: BREAK
WHILE pass_count < 5

## Step 7: Epilogue
1. Epilogue: Q-E1, Q-E2, Q-G9. 2. Join Research. 3. Intent Questions. 4. Teaching Summary. 5. Skill-Learnings. 6. Final Display. 7. Cleanup: rm -rf "$RESULTS_DIR".

## Step 8: Exit
AskUserQuestion. ExitPlanMode on confirm.

---
### EVALUATOR_OUTPUT_CONTRACT
JSON: { "evaluator": "string", "pass": 0, "status": "success", "elapsed_s": 0, "findings": {"Q-ID": {"status": "PASS", "finding": "", "gate": 1}}, "counts": {"pass": 0, "needs_update": 0, "na": 0} }

### L1 Blocking Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. Eval: Q-G1, Q-G11.

### L1 Advisory Structural Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. Eval Q-G20-G25. delta filter: pass_delta["l1-advisory-structural"].

### L1 Advisory Process Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. Eval 19 questions (Q-G4-G32). delta filter: pass_delta["l1-advisory-process"].

### Cluster Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. Eval cluster questions. delta filter: pass_delta[cluster_name].

### GAS Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. Eval GAS (QUESTIONS-L3.md). delta filter: pass_delta["gas-evaluator"]. Gate 1: 6 core.

### Node Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. Eval Node/TS. delta filter: pass_delta["node-evaluator"]. Gate 1: N1.

### UI Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. Eval UI. delta filter: pass_delta["ui-evaluator"].

### helper: flag_question_decrements
base_l1 = 27. Truth table logic for adj.

### helper: resolve_citation()
Cross-ref findings.
