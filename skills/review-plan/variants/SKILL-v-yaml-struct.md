---
name: review-plan
description: Universal plan review orchestrator.
allowed-tools: all
---

# Orchestrator Logic

```yaml
Role: Team-lead orchestrator
Authority: [Edit, Write, Bash, Read, AskUserQuestion, Task]
Goal: 0 NEEDS_UPDATE Gate 1 (max 5 passes)
Directives: [IntentQuestions: 5c.5, SkillLearnings: 5g]

Phases:
  1_Discovery: Find plan (Glob ~/.claude/plans/*.md), load context (CLAUDE.md, MEMORY.md)
  2_Classification:
    Action: Task(general-purpose, sonnet, "Classify REVIEW_TIER, RISKS, IS_GAS, IS_NODE, HAS_UI...")
    Gates: {gas: [Q1, Q2, Q13, Q15, Q18, Q42], node: [N1]}
  3_Routing:
    TRIVIAL: Eval Gate 1, exit
    SMALL: Eval 10 core + risk, exit
    FULL: Proceed to Phase 4
  4_Convergence_Setup:
    pass_count = 0
    MAX_CONCURRENT = 10
    RESULTS_DIR = "Bash: mktemp -d /tmp/review-plan.XXXXXX"
    memo_file: "~/.claude/.review-plan-memo-${slug}.json"
  5_Research: Dispatch background tasks if FULL + risks (3c.5)
  6_Convergence_Loop:
    DO:
      State: Restore state from memo_file if pass_count == 0 (Context-compression recovery)
      Increment: IF NOT _recovered THEN pass_count += 1
      Init: {l1_results = {}, cluster_results: {}, ui_results: {}, all_results = {}, pass_delta = {}}
      Execution:
        waves = chunk(evaluators, MAX_CONCURRENT)
        FOR wave_idx, wave IN waves: Spawn Tasks, collect all_results[name]
      Update: Edit plan, build delta summary
      Checkpoint: Write memo_file {pass_count, RESULTS_DIR, pass_delta, ...} (persist memoized state)
      Break: IF Gate1 clear AND changes == 0
    WHILE: pass_count < 5
  7_Epilogue: [E1, E2, G9, JoinResearch, IntentQuestions, Teaching, SkillLearnings, Display, Cleanup: rm -rf "$RESULTS_DIR"]
  8_Exit: AskUserQuestion, ExitPlanMode
```

---
### EVALUATOR_OUTPUT_CONTRACT
```json
{ "evaluator": "string", "pass": 0, "status": "success", "elapsed_s": 0, "findings": { "Q-ID": { "status": "PASS", "finding": "string", "gate": 1 } }, "counts": { "pass": 0, "needs_update": 0, "na": 0 } }
```

### L1 Blocking Evaluator Config
Logic: { Eval: [Q-G1, Q-G11], Contract: EVALUATOR_OUTPUT_CONTRACT }

### L1 Advisory Structural Evaluator Config
Logic: { Eval: Q-G20-G25, Contract: EVALUATOR_OUTPUT_CONTRACT, Filter: delta filter: pass_delta["l1-advisory-structural"] }

### L1 Advisory Process Evaluator Config
Logic: { Eval: Q-G4-G32 (19 Qs), Contract: EVALUATOR_OUTPUT_CONTRACT, Filter: delta filter: pass_delta["l1-advisory-process"] }

### Cluster Evaluator Config
Logic: { Eval: cluster-specific, Contract: EVALUATOR_OUTPUT_CONTRACT, Filter: delta filter: pass_delta[cluster_name] }

### GAS Evaluator Config
Logic: { Eval: QUESTIONS-L3.md, Gate1: 6 core, Contract: EVALUATOR_OUTPUT_CONTRACT, Filter: delta filter: pass_delta["gas-evaluator"] }

### Node Evaluator Config
Logic: { Eval: Node/TS, Gate1: N1, Contract: EVALUATOR_OUTPUT_CONTRACT, Filter: delta filter: pass_delta["node-evaluator"] }

### UI Evaluator Config
Logic: { Eval: UI/UX, Contract: EVALUATOR_OUTPUT_CONTRACT, Filter: delta filter: pass_delta["ui-evaluator"] }

### Helpers
base_l1 = 27.
resolve_citation: Cross-reference findings.
