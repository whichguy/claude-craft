# Question Cross-Reference Map

## Never-N/A Canonical Lists

### review-plan (L1 + L2)
**Layer 1 Gate 1 — Blocking (never N/A):** Q-G1, Q-G2, Q-G3
**Layer 1 Gate 2 — Important (never N/A):** Q-G5, Q-NEW
**Layer 2 (never N/A):** Q-C1, Q-C2 *(see IS_GAS override below)*

### gas-plan
**Always evaluated regardless of domain triage:** Q1, Q2, Q42

### node-plan
**Always evaluated whenever TS files present:** N1

---

## L2 ↔ gas-plan Overlap Map (25 confirmed overlaps)

When IS_GAS is detected, these L2 questions duplicate gas-plan coverage.
review-plan **suppresses** these L2 questions in IS_GAS mode (gas-evaluator has superior domain context).

| L2 Question | gas-plan Equivalent | Coverage Topic | Status |
|-------------|--------------------|-----------------------|--------|
| Q-C1 | Q1 | Branching strategy | Suppressed (original) |
| Q-C2 | Q2 | Branching usage | Suppressed (original) |
| Q-C3 | Q18 | Impact analysis | Suppressed (original) |
| Q-C4 | Q11 | Tests updated | Suppressed |
| Q-C5 | Q12 | Incremental verification | Suppressed (original) |
| Q-C6 | Q9 | Deployment defined | Suppressed |
| Q-C7 | Q10 | Rollback plan | Suppressed |
| Q-C8 | Q16 | Interface consistency | Suppressed |
| Q-C9 | Q17 | Step ordering | Suppressed |
| Q-C10 | Q19 | Empty code / stubs | Suppressed |
| Q-C11 | Q20 | Dead code removal | Suppressed |
| Q-C12 | Q39 | Duplication of existing logic | Suppressed |
| Q-C13 | Q40 | State-exists + state-absent edge cases | Suppressed |
| Q-C14 | Q41 | Bolt-on vs integrated | Suppressed |
| Q-C15 | Q27 | Input validation at trust boundaries | Suppressed |
| Q-C16 | Q28 | Error handling | Suppressed (original) |
| Q-C17 | Q32 | Event listener cleanup | Suppressed only when HAS_UI (Q32 is frontend-owned) |
| Q-C18 | Q21 | Concurrency | Suppressed (original) |
| Q-C19 | Q24 | Idempotency | Suppressed (original) |
| Q-C20 | Q29 | Logging | Suppressed (original) |
| Q-C21 | Q22 | Runtime constraints / execution limit | Suppressed (original) |
| Q-C22 | Q23 | Auth/permission / OAuth scopes | Suppressed (original) |
| Q-C23 | Q25 | External rate limits / quotas | Suppressed |
| Q-C24 | Q3 | Local↔remote sync | Suppressed |
| Q-C25 | Q33 | UI error boundary | Suppressed only when HAS_UI (Q33 is frontend-owned) |

**Note on Q-C1 and Q-C2:** These are "never N/A" in IS_NODE mode. When IS_GAS, they are superseded by gas-evaluator Q1/Q2 which have full domain-specific framing. Mark status `N/A-superseded` to distinguish from a true N/A skip.

**Note on Q-C17 and Q-C25:** These have gas-plan equivalents (Q32, Q33) only under the frontend evaluator. Suppress in IS_GAS mode when HAS_UI=true. When HAS_UI=false and IS_GAS=true, L2 may still evaluate them (no frontend evaluator active to cover them).

## L1 ↔ gas-plan Overlap (1 confirmed overlap)

| L1 Question | gas-plan Equivalent | Coverage Topic | Resolution |
|-------------|--------------------|-----------------------|------------|
| Q-G3 | Q42 | Post-implementation review step | Both run — Q-G3 covers both `/review-fix` (general/Node) and `/gas-review` (GAS); Q42 is GAS-specific with the same /gas-review requirement plus build + test steps. Do NOT suppress Q-G3: it is a Gate 1 blocking question in L1 and evaluated before gas-plan runs. In IS_GAS mode, if Q-G3 passes and Q42 also flags a GAS-specific gap, apply Q42's finding. If both PASS, no duplication harm. |

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

## Gate 1 Composition by Mode

| Mode | Effective Gate 1 Questions |
|------|---------------------------|
| IS_GAS | Q-G1, Q-G2, Q-G3, Q1, Q2, Q13, Q15, Q18, Q42 |
| IS_NODE | Q-G1, Q-G2, Q-G3, Q-C1, Q-C2, Q-C3, N1 |
| Standard | Q-G1, Q-G2, Q-G3, Q-C1, Q-C2, Q-C3 |

---

## Fallback (If This File Is Not Found)

If `shared/question-cross-reference.md` cannot be located:
- Apply the L2 suppression lists inline from the dedup section of `review-plan/SKILL.md`.
- Treat the never-N/A lists above as documented in each skill's SKILL.md directly.
