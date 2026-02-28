# Node.js/TypeScript Plan: Evaluate Mode

*Read-only, single pass. Used inside review-plan teams.*
*Do not call TeamCreate, ExitPlanMode, or edit the plan.*

**Staged evaluation:** The invoking prompt may include a `STAGED EVALUATION` directive
with a filtered question list. If present, evaluate ONLY the listed questions and output
`DEFERRED` for all others. If no staged directive, evaluate all questions as normal.

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

Call the **SendMessage** tool exactly once with all findings:

```
type: "message"
recipient: "team-lead"
summary: "node-plan evaluation complete — N NEEDS_UPDATE"  (fill in count)
content: |
  FINDINGS FROM node-eval

  [Triage] TypeScript/API domain: [ACTIVE | SKIPPED — reason]
  [Triage] Node runtime domain: [ACTIVE | SKIPPED — reason]

  N1: PASS | NEEDS_UPDATE | N/A — [one-sentence finding]
  [EDIT: specific instruction if NEEDS_UPDATE]
  N2: ...
  N3: ...
  ...
  N38: ...
  (N20, N21 not evaluated — covered by L1 Q-G6/Q-G7)
```

Do not write findings to stdout — the team-lead only receives content via SendMessage.

Stop after SendMessage. Do not loop, do not edit the plan, do not touch `.plan-reviewed`, do not call ExitPlanMode.
