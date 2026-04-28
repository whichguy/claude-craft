---
name: review-plan
allowed-tools: all
---

# Orchestrator

## 1. Discovery
`Glob("~/.claude/plans/*.md")` -> `CLAUDE.md`, `MEMORY.md`.

## 2. Classify
Task: `sonnet` -> `REVIEW_TIER`, `RISKS`, `IS_GAS`, `IS_NODE`, `HAS_UI`.
`gate1_gas = {"Q1", "Q2", "Q13", "Q15", "Q18", "Q42"}`, `gate1_node = {"N1"}`.

## 3. Route
Trivial? Gate 1 -> Exit. Small? 10 Qs -> Exit. Full? Loop.

## 4. Loop Init
pass_count = 0; MAX_CONCURRENT = 10.
RESULTS_DIR = `Bash: mktemp -d /tmp/review-plan.XXXXXX`.
memo_file = `~/.claude/.review-plan-memo-slug.json`.

## 5. Async Research
3c.5: Background research if Full+Risks.

## 6. Convergence
DO:
  Restore state from `memo_file` if `pass_count == 0`. (Context-compression recovery)
  pass_count += 1
  all_results = {}; pass_delta = {}.
  waves = chunk(evaluators, MAX_CONCURRENT)
  FOR wave_idx, wave IN waves: Task spawn -> all_results.
  Edit(plan) -> delta summary.
  Write memo_file: {pass_count, RESULTS_DIR, pass_delta} (Checkpoint: persist memoized state)
  IF Gate1 clear AND changes == 0: BREAK
WHILE pass_count < 5

## 7. Epilogue & Exit
Join research. Intent questions (5c.5). Skill-learnings (5g). Cleanup: `rm -rf "$RESULTS_DIR"`.
AskUserQuestion -> ExitPlanMode.

---
### EVALUATOR_OUTPUT_CONTRACT
JSON: {"evaluator":"", "pass":0, "status":"", "elapsed_s":0, "findings":{"Q-ID":{"status":"", "finding":"", "gate":1}}, "counts":{"pass":0, "needs_update":0, "na":0}}

### L1 Blocking Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. Q-G1, Q-G11.

### L1 Advisory Structural Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. Q-G20-G25. delta filter: pass_delta["l1-advisory-structural"].

### L1 Advisory Process Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. Q-G4-G32. delta filter: pass_delta["l1-advisory-process"].

### Cluster Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. delta filter: pass_delta[cluster_name].

### GAS Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. delta filter: pass_delta["gas-evaluator"].

### Node Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. delta filter: pass_delta["node-evaluator"].

### UI Evaluator Config
[EVALUATOR_OUTPUT_CONTRACT]. delta filter: pass_delta["ui-evaluator"].

### helper
base_l1 = 27.
resolve_citation().
