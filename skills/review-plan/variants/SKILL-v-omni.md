---
name: review-plan-omni
allowed-tools: all
---

# Unified review-plan Orchestrator (v-omni)

## Phase 1: Discovery & Classify
- **Identify**: `Glob("~/.claude/plans/*.md")` -> Read target plan + `CLAUDE.md`/`MEMORY.md`.
- **Classify**: Task: `sonnet` -> Identify metadata:
  - `REVIEW_TIER`: Full | Small | Trivial
  - `RISKS`: [List of architectural/security risks]
  - `IS_GAS`: bool (Google Apps Script context)
  - `IS_NODE`: bool (Node.js/TypeScript context)
  - `HAS_UI`: bool (Frontend/UI changes)
  - `HAS_STATE`: bool (Persistence/Storage)
  - `HAS_DEPLOYMENT`: bool (CI/CD/Prod push)
- **State**: `memo = "~/.claude/.review-plan-memo.json"`.

## Phase 2: Evaluate
- **Source**: Read `skills/review-plan/QUESTIONS-UNIFIED.md`.
- **Filter**:
  - Always: Layer 1 (General) + Layer 2 (Active Clusters: 1, 2, 4).
  - IF `HAS_STATE`: Layer 2 Cluster 3.
  - IF `HAS_DEPLOYMENT`: Layer 2 Cluster 5.
  - IF `HAS_UI`: Layer 3 (UI).
  - IF `IS_GAS`: Layer 4 (GAS).
  - IF `IS_NODE`: Layer 5 (Node).
- **Wave(s)**: 1-2 Sonnet tasks.
  - Wave 1 (Core): Layer 1 + Layer 2.
  - Wave 2 (Domain): Layer 3 | 4 | 5.
  - *Combine*: If `active_count < 60` or `REVIEW_TIER == "Small"`.
- **Logic**: Use `QUESTIONS-UNIFIED.md` as single source. Maintain 100% of defined questions for active layers.

## Phase 3: Converge
- **Loop**: `pass_count++` (Max 3).
- **Restore**: Load `memo` if resuming from context compression.
- **Act**: Surgical `replace` based on findings. Fix Gate 1 (Blocking) first.
- **Write**: Persist state to `memo`.
- **Exit Condition**: (Gate 1 PASS AND delta == 0) OR `pass_count >= 3`.

## Phase 4: Epilogue & Exit
- **Final Pass**: Q-G9 (Organization), Q-E1 (Git), Q-E2 (Post-implementation).
- **Cleanup**: `rm -f` temp artifacts and memo.
- **Summary**: Direct report of resolved risks and final gate status.

---
### EVALUATOR_OUTPUT_CONTRACT
JSON: {
  "evaluator": "core|domain",
  "pass": bool,
  "findings": {
    "Q-ID": {
      "status": "PASS|NEEDS_UPDATE|N/A",
      "finding": "Surgical detail of violation or 'PASS'",
      "gate": 1|2|3
    }
  },
  "counts": {"pass": int, "needs_update": int, "na": int}
}

### Wave 1: Core Rigor
[EVALUATOR_OUTPUT_CONTRACT].
Inputs: L1 (General) + L2 (Clusters 1, 2, 4). Add Clusters 3, 5 if flags set.

### Wave 2: Domain Specialization
[EVALUATOR_OUTPUT_CONTRACT].
Inputs: L3 (UI), L4 (GAS), or L5 (Node) based on flags.

### Platform Strictness (Priority)
- **GAS**: Q49 (Load Order), Q44 (Stateless Cards), Q22 (6m Runtime), Q13 (Standards).
- **Node**: N1 (TS Build), N6 (Async Errors), N13 (Graceful Shutdown), N30 (Phantoms).

### helper
resolve_citations() -> Maps `Q-ID` findings back to `QUESTIONS-UNIFIED.md` criteria.
