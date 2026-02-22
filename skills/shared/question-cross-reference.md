# Question Cross-Reference Map

## Never-N/A Canonical Lists

### review-plan (L1 + L2)
**Layer 1 (always evaluated):** Q-G1, Q-G2, Q-G3, Q-G5, Q-NEW
**Layer 2 (always evaluated):** Q-C1, Q-C2 *(see IS_GAS override below)*

### gas-plan
**Always evaluated regardless of domain triage:** Q1, Q2, Q42

### node-plan
**Always evaluated whenever TS files present:** N1

---

## L2 ↔ gas-plan Overlap Map (10 confirmed overlaps)

When IS_GAS is detected, these L2 questions duplicate gas-plan coverage.
review-plan **suppresses** these L2 questions in IS_GAS mode (gas-evaluator has superior domain context).

| L2 Question | gas-plan Equivalent | Coverage Topic |
|-------------|--------------------|-----------------------|
| Q-C1 | Q1 | Branching strategy |
| Q-C2 | Q2 | Branching usage |
| Q-C3 | Q18 | Impact analysis |
| Q-C5 | Q12 | Incremental verification |
| Q-C16 | Q28 | Error handling |
| Q-C18 | Q21 | Concurrency |
| Q-C19 | Q24 | Idempotency |
| Q-C20 | Q29 | Logging |
| Q-C21 | Q22 | Runtime constraints / execution limit |
| Q-C22 | Q23 | Auth/permission / OAuth scopes |

**Note on Q-C1 and Q-C2:** These are "never N/A" in IS_NODE mode. When IS_GAS, they are superseded by gas-evaluator Q1/Q2 which have full domain-specific framing. Mark status `N/A-superseded` to distinguish from a true N/A skip.

---

## L2 ↔ node-plan Overlap Map (3 confirmed overlaps)

When IS_NODE is detected, these L2 questions duplicate node-plan coverage.
review-plan **suppresses** these L2 questions in IS_NODE mode.

| L2 Question | node-plan Equivalent | Coverage Topic |
|-------------|---------------------|-----------------------|
| Q-C16 | N6 | Error handling / async error wrapping |
| Q-C18 | N8 | Concurrency safety |
| Q-C21 | N22 | Runtime constraints / event-loop blocking |

---

## gas-plan Shared Questions

Questions evaluated by **both** gas-plan perspectives (frontend + GAS engineer lenses).
Team-lead merges: combine findings, keep the more actionable wording.

`Q13, Q15, Q16, Q27, Q28, Q38, Q41`

**Fallback when frontend evaluator is skipped:** The GAS evaluator also evaluates all 7 shared questions from the frontend lens. Output each twice (GAS finding then frontend finding). Team-lead merges.

---

## node-plan Shared Questions

`N8` (Concurrency safety) — evaluated by both TS/API and Node runtime evaluators.

---

## Deduplication Behavioral Rules

### review-plan deduplication
> "Specialization wins" — ecosystem evaluator has superior domain context vs L2 generic questions. When IS_GAS, gas-evaluator's framing supersedes L2 on overlapping concerns. When IS_NODE, node-evaluator's framing supersedes L2 on overlapping concerns.

### gas-plan / node-plan merge step
> "More actionable wins" — both perspectives have domain-appropriate framing; choose the clearest instruction for the implementer. This is distinct from the review-plan dedup rule: here both findings come from specialized evaluators in the same domain.

---

## Fallback (If This File Is Not Found)

If `shared/question-cross-reference.md` cannot be located:
- Apply the L2 suppression lists inline from the dedup section of `review-plan/SKILL.md`.
- Treat the never-N/A lists above as documented in each skill's SKILL.md directly.
