# Node.js/TypeScript Plan: Evaluate Mode

*Read-only, single pass. Used inside review-plan evaluator tasks.*
*Do not call TeamCreate, ExitPlanMode, or edit the plan.*

**Memoization:** The invoking prompt may include a `Memoized questions` directive
listing N-IDs to skip. If present, output listed questions as `N{N}: PASS (memoized)`
without re-evaluating. This reduces scope when review-plan has confirmed stability.

---

## Step 0 — Read Inputs

1. Read the plan at `<plan_path>` (the path is provided in the invoking prompt)
2. Read QUESTIONS.md — it is a sibling of this EVALUATE.md. Derive its path: replace `EVALUATE.md` with `QUESTIONS.md` in the path your invoking prompt specifies for this file. Example: `.../node-plan/EVALUATE.md` → `.../node-plan/QUESTIONS.md`. This file contains all question definitions (N1–N38, criteria, N/A conditions, gate weights).
3. Read the Tool Preferences and relevant Node.js/TypeScript sections of `~/.claude/CLAUDE.md` as needed (skip unrelated sections)

---

## Step 1 — Triage

Apply bulk-N/A before evaluating:

- No TypeScript/package changes → bulk N/A N2, N3, N4, N5, N11, N12
- No async code changes → bulk N/A N6, N7
- No env var changes → bulk N/A N9, N10
- No framework changes → bulk N/A N15, N16, N17
- No new resources/connections → bulk N/A N13, N14, N18
- No async code → bulk N/A N22, N23, N24, N25, N27, N28, N35
- No new timers → bulk N/A N26
- No deployment/containers → bulk N/A N31, N36
- No secrets/credentials → bulk N/A N33
- No API endpoint changes → bulk N/A N34
- Not a monorepo → bulk N/A N30
- No native addon packages → bulk N/A N32
- Not a published library → bulk N/A N37
- No HTTP server → bulk N/A N38
- No new tests → bulk N/A N19
- No file path operations → bulk N/A N29
- **Exception: N1 (tsc check) — evaluate regardless if plan involves any TS files**
- **Exception: N8 (concurrency safety) — evaluate from both lenses, combine findings. never bulk-N/A.**

---

## Step 2 — Evaluate

Evaluate ALL applicable questions from BOTH perspectives (TypeScript/API and Node runtime) in a single pass.

For N8 specifically: even if the TypeScript domain was triaged out (bulk N/A'd), evaluate N8
from BOTH the [TS lens] (async shared state, race conditions in TypeScript code) AND the
[NR lens] (cluster workers, shared handles, native bindings). Label findings accordingly.

Skip content marked `<!-- node-plan -->` or `<!-- review-plan -->` (self-referential protection).

N1 is never N/A when any TypeScript files are involved.

For each evaluated question, determine: **PASS** | **NEEDS_UPDATE** | **N/A**
- If NEEDS_UPDATE: include a specific [EDIT: instruction — where to add/change and what]

---

## Step 3 — Output

Write your findings to a JSON file. The `results_dir` and `evaluator_name` variables are provided in the invoking prompt.

Write atomically using Bash (prevents partial reads by polling loop):
```bash
cat > '<results_dir>/<evaluator_name>.json.tmp' << 'EVAL_EOF'
{
  "evaluator": "<evaluator_name>",
  "pass": <pass_count>,
  "status": "complete",
  "elapsed_s": <seconds_from_start>,
  "findings": {
    "N1": {"status": "PASS|NEEDS_UPDATE|N/A", "finding": "<text>", "edit": "<instruction or null>"},
    "N2": {"status": "...", "finding": "...", "edit": "..."},
    ...
    "N38": {"status": "...", "finding": "...", "edit": "..."}
  },
  "counts": {"pass": N, "needs_update": N, "na": N}
}
EVAL_EOF
mv '<results_dir>/<evaluator_name>.json.tmp' '<results_dir>/<evaluator_name>.json'
```
(N20, N21 not evaluated — covered by L1 Q-G6/Q-G7)

If you encounter an error reading inputs, write:
```json
{"evaluator": "<evaluator_name>", "pass": N, "status": "error", "error": "<message>"}
```

Constraints:
- Do not use Edit or Write tools on the plan file — read-only
- Use Bash ONLY to write your findings JSON to the specified path
- Do not call ExitPlanMode or touch marker files
- Write exactly ONE JSON file

Stop after writing the JSON file. Do not loop, do not edit the plan, do not touch `.plan-reviewed`, do not call ExitPlanMode.
