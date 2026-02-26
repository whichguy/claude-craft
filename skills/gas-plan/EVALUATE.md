# GAS Plan: Evaluate Mode

*Read-only, single pass. Used inside review-plan teams.*
*Do not call TeamCreate, ExitPlanMode, or edit the plan.*

---

## Step 0 — Read Inputs

1. Read the plan at `<plan_path>` (the path is provided in the invoking prompt)
2. Read QUESTIONS.md — it is a sibling of this EVALUATE.md. Derive its path: replace `EVALUATE.md` with `QUESTIONS.md` in the path your invoking prompt specifies for this file. Example: if invoking prompt references `~/.claude/skills/gas-plan/EVALUATE.md`, read `~/.claude/skills/gas-plan/QUESTIONS.md`. This file contains all question definitions (Q1–Q51+, criteria, N/A conditions, gate weights).
3. Read the GAS Development and GAS Client-Server Patterns sections of `~/.claude/CLAUDE.md` as needed

---

## Step 1 — Triage

Apply bulk-N/A before evaluating:

- No UI/HTML/CSS changes → bulk N/A Q14, Q30–Q36
  (Q43 is a post-loop question — not evaluated in this mode)
- No .gs/deployment/common-js changes → bulk N/A GAS-owned questions:
  Q3–Q12, Q17–Q26, Q29, Q37, Q39–Q40, Q49, Q50, Q51
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

---

## Step 3 — Output

Call the **SendMessage** tool exactly once with all findings:

```
type: "message"
recipient: "team-lead"
summary: "gas-plan evaluation complete — N NEEDS_UPDATE"  (fill in count)
content: |
  FINDINGS FROM gas-eval

  [Triage] Frontend domain: [ACTIVE | SKIPPED — reason]
  [Triage] GAS domain: [ACTIVE | SKIPPED — reason]

  Q1: PASS | NEEDS_UPDATE | N/A — [one-sentence finding]
  [EDIT: specific instruction if NEEDS_UPDATE]
  Q2: ...
  Q3: ...
  ...
  Q51: ...
  (Q43 not applicable in evaluate mode — post-loop only)
```

Do not write findings to stdout — the team-lead only receives content via SendMessage.

Stop after SendMessage. Do not loop, do not edit the plan, do not touch `.plan-reviewed`, do not call ExitPlanMode.
