# GAS Plan: Evaluate Mode

*Read-only, single pass. Used inside review-plan evaluator tasks.*
*Do not call TeamCreate, ExitPlanMode, or edit the plan.*

**Memoization:** The invoking prompt may include a `Memoized questions` directive
listing Q-IDs to skip. If present, output listed questions as `Q{N}: PASS (memoized)`
without re-evaluating. This reduces scope when review-plan has confirmed stability.

---

## Step 0 — Read Inputs

1. Read the plan at `<plan_path>` (the path is provided in the invoking prompt)
2. Read QUESTIONS.md — it is a sibling of this EVALUATE.md. Derive its path: replace `EVALUATE.md` with `QUESTIONS.md` in the path your invoking prompt specifies for this file. Example: `.../gas-plan/EVALUATE.md` → `.../gas-plan/QUESTIONS.md`. This file contains all question definitions (Q1–Q51+, criteria, N/A conditions, gate weights).
3. Read the GAS Development and GAS Client-Server Patterns sections of `~/.claude/CLAUDE.md` as needed

---

## Step 1 — Triage

Apply bulk-N/A before evaluating:

- No UI/HTML/CSS changes → bulk N/A Q14, Q30–Q36
  (Q43 is a post-loop question — not evaluated in this mode)
- No .gs/deployment/common-js changes → bulk N/A GAS-owned questions:
  Q3–Q12, Q17–Q26, Q29, Q37, Q39–Q40, Q49, Q50, Q51, Q52, Q53, Q54
  (Q42 is also GAS-owned but never N/A — see exception below)
  Gmail questions Q44–Q48 follow the Gmail rule below.
  **Exception: Q1, Q2, Q42 are never N/A — evaluate regardless of triage.**
- No Gmail add-on / CardService in plan → bulk N/A Q44, Q45, Q46, Q47, Q48
  Detection: plan mentions CardService, Gmail add-on, contextualTriggers, or GmailApp.setCurrentMessageAccessToken.
- For shared questions (Q13, Q15, Q16, Q27, Q28, Q38, Q41): evaluate from both lenses, combine findings.
  (Q47 is a Gmail-domain GAS-primary question handled by the Gmail bulk-N/A rule above — not in the shared list)

---

## Step 2 — Evaluate

Evaluate ALL applicable questions from BOTH perspectives (frontend engineer and GAS engineer) in a single pass.

Skip content marked `<!-- gas-plan -->` or `<!-- review-plan -->` (self-referential protection).

Q1, Q2, Q42 are never N/A — evaluate regardless of domain triage.

For each evaluated question, determine: **PASS** | **NEEDS_UPDATE** | **N/A**
- If NEEDS_UPDATE: include a specific [EDIT: instruction — where to add/change and what]

Finding specificity: For each NEEDS_UPDATE finding, reference the specific plan passage
(quote or cite by step number) that is deficient. Do not generalize ("the plan lacks X")
without citing which step or section is responsible.

---

## Step 3 — Output

Write your findings to a JSON file. The `results_dir` and `evaluator_name` variables are provided in the invoking prompt.

Write atomically using Bash (ensures clean reads by orchestrator):
```bash
cat > '<results_dir>/<evaluator_name>.json.tmp' << 'EVAL_EOF'
{
  "evaluator": "<evaluator_name>",
  "pass": <pass_count>,
  "status": "complete",
  "elapsed_s": <seconds_from_start>,
  "findings": {
    "Q1": {"status": "PASS|NEEDS_UPDATE|N/A", "finding": "<text>", "edit": "<instruction or null>"},
    "Q2": {"status": "...", "finding": "...", "edit": "..."},
    ...
    "Q54": {"status": "...", "finding": "...", "edit": "..."}
  },
  "counts": {"pass": N, "needs_update": N, "na": N}
}
EVAL_EOF
mv '<results_dir>/<evaluator_name>.json.tmp' '<results_dir>/<evaluator_name>.json'
```
(Q43 not applicable in evaluate mode — post-loop only)

If you encounter an error reading inputs, write:
```json
{"evaluator": "<evaluator_name>", "pass": N, "status": "error", "error": "<message>"}
```

Constraints:
- Do not use Edit or Write tools on the plan file — read-only
- Use Bash ONLY to write your findings JSON to the specified path
- Do not call ExitPlanMode or touch marker files
- Write exactly ONE JSON file

Stop after writing the JSON file. Do not loop, do not edit the plan, do not touch `.review-ready`, do not call ExitPlanMode.
