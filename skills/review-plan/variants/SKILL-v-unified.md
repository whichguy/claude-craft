---
name: review-plan-unified
allowed-tools: all
---

# Unified Omni-Orchestrator

## 1. Discovery
`Glob("~/.claude/plans/*.md")` -> `CLAUDE.md`, `MEMORY.md`.

## 2. Unified Task: Classify & Evaluate
Task: `sonnet` -> Perform classification AND check Platform Safety Rules in one pass.

### Classification
`REVIEW_TIER`, `RISKS`, `IS_GAS`, `IS_NODE`, `HAS_UI`.

### Platform Safety Rules (Top 10)
**[GAS]**
- **Q49 (V8 Order):** `loadNow:true` files MUST be LAST. Dependencies must precede importers.
- **Q44 (Cards):** Stateless rebuilds. State in Cache/Properties, not objects. Async for >30s.
- **Q22 (Runtime):** Ops must fit 6m. Batch/chunk large sheet/API calls.
- **Q23 (Scopes):** New OAuth scopes = re-auth prompt. Flag unnoted scope additions.
- **Q21 (Locks):** Mutex/LockService for shared state (Properties/Cache/Sheets).

**[Node]**
- **N1 (Build):** MUST include `tsc --noEmit`. No silent type failures.
- **N6 (Async):** Async entry points (routes/events) MUST have `try/catch`.
- **N13 (Graceful):** SIGTERM/SIGINT handlers for DB/sockets/servers.
- **N23 (ReDoS):** No nested quantifiers `(a+)+` on user-controlled input.
- **N30 (Phantom):** Deps must be in local `package.json`, not rely on hoisting.

## 3. Convergence Loop
pass_count = 0.
DO:
  pass_count += 1
  Task: `sonnet` ->
    1. Re-evaluate Plan vs Rules.
    2. Check L1 Blocking: Q-G1 (Branching), Q-G11 (Tests).
    3. Generate `findings` JSON (Contract below).
  Edit(plan) -> apply fixes or insert "NEEDS_UPDATE" warnings.
  IF (All Rules PASS AND L1 PASS) OR pass_count >= 3: BREAK
WHILE true

## 4. Exit
AskUserQuestion (if ambiguities) -> ExitPlanMode.

---
### EVALUATOR_OUTPUT_CONTRACT
JSON: {
  "tier": "Full|Small|Trivial",
  "is_gas": bool, "is_node": bool,
  "pass": bool,
  "findings": {
    "RULE_ID": {"status": "PASS|NEEDS_UPDATE|N/A", "finding": "Surgical detail"}
  }
}

### L1 Blocking Evaluator
Check: Branch naming, merge-to-main step, explicit `tsc` or `exec` verification.

### Logic: Unified Evaluation
IF `is_gas`:
  Apply GAS Q49, Q44, Q22, Q23, Q21.
IF `is_node`:
  Apply Node N1, N6, N13, N23, N30.

### Surgical Fixes
Automated `Edit(plan)` for common misses:
- Missing `tsc --noEmit`? Append to "Verification" section.
- Missing `lock` on GAS Properties? Insert `LockService.getScriptLock()`.
- Wrong file order? Re-order `write` steps.
