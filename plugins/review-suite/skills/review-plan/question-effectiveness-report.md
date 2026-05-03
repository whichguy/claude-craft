# Question Effectiveness Report

**Date:** 2026-04-01
**Bench bank:** 18 plans across 15 domains, 4 quality levels (Good/Medium/Rough/Adversarial)
**Runs completed:** Stage 1 (Full ablation E=3, 12 plans), Stage 1b (Targeted adversarial evaluation, 6 plans), Stage 2 (Overlap investigation, 2 pairs), Stage 3 (Analytical derivation), Stage 4 (Synthesis)
**Evaluation model:** Sonnet (evaluators), Sonnet (editors, scope gates, judges)
**Plans evaluated:** 18 (12 Claude Code plan-mode generated + 6 adversarial)

---

## 1. Minimal Effective Set

**Finding: gate:1+2 (16 L1 questions) achieves equivalent quality to the full 64-question active set.**

| Experiment | Questions | Avg Spread | Verdict |
|------------|-----------|------------|---------|
| Exp-1: gate:1 | 3 (Q-G1, Q-G2, Q-G11) | +0.334 | IMPROVED |
| Exp-2: gate:1+2 | 16 (gate:1 + gate:2) | +0.606 | IMPROVED |
| Exp-3: all | 64 (all active) | +0.616 | IMPROVED |

**Equivalence analysis:**
- gate:1 → gate:1+2: **+0.272 delta** — Gate 2 questions add significant value
- gate:1+2 → all: **+0.010 delta** — EQUIVALENT (within 0.05 threshold)

**Caveat — measurement instrument limitation:** Q-PQ dimensions measure plan *content quality* (specificity, risk coverage, actionability). They do NOT measure process completeness (Q-E1's post-impl workflow), git hygiene, or code-level concerns (L2 clusters). These questions may add value not captured by the current evaluation instrument.

**Efficiency ratio:** 16/64 = 25.0% of questions achieve 98.4% of measured quality improvement.

---

## 2. Per-Question Disposition Table

### Applied Changes (from Phase 1-2 of current plan)

| Change | Details |
|--------|---------|
| Q-E1 + Q-E2 merged | Single "Post-implementation completeness" question |
| Q-G17 inactive | 0% hit rate, phase preambles always present |
| Q-G20 inactive | 0% hit rate, story arc always present |
| Q-C9 inactive | 0% hit rate, step ordering always correct |
| Q-C10 inactive | 0% hit rate, no stubs/TODOs found |

### KEEP (31 questions)

#### High-confidence KEEP (hit rate >=25% or fires on adversarial plans with clear value)

| Q-ID | Layer/Gate | Hit Rate (18 plans) | Evidence |
|------|-----------|---------------------|---------|
| Q-E1 | Epilogue | 56% (10/18) | Post-implementation completeness; fires on all non-GAS plans |
| Q-G10 | Gate 2 | 72% (13/18) | Highest L1 hit rate; catches unvalidated assumptions |
| Q-G18 | Gate 2 | 61% (11/18) | Pre-condition verification; complementary with Q-G11 |
| Q-C34 | Security | 50% (7/14) | External call timeouts |
| Q-G22 | Gate 2 | 50% (9/18) | Cross-phase dependency; critical for multi-phase plans |
| Q-C33 | Security | 44% (7/16) | Config validation; catches missing startup checks |
| Q-G11 | Gate 1 | 39% (7/18) | Code examination; complementary with Q-G18 |
| Q-C39 | Impact | 33% (6/18) | Data access vs schema; catches silent mismatches |
| Q-G4 | Gate 2 | **22% (4/17)** | Unintended consequences — **RESCUED by adversarial plans**: fires on vague-auth (session migration), overscope (CSS breakage), large-migration (transaction boundary loss) |
| Q-C20 | Operations | 30% (5/17) | Logging; fires on deployed services |
| Q-G7 | Gate 3 | 28% (5/18) | Documentation updates |
| Q-C29 | Testing | 28% (5/18) | Test strategy upfront |
| Q-C38 | Impact | 28% (5/18) | Cross-boundary API contracts |
| Q-C31 | Security | 25% (4/16) | Resource lifecycle cleanup |
| Q-C3 | Impact | 25% (4/16) | Impact analysis; cross-ref call sites |
| Q-C4 | Testing | 25% (4/16) | Test updates for interface changes |
| Q-C30 | Security | 22% (3/14) | Async error completeness |
| Q-C6 | Operations | 22% (3/14) | Deployment defined |
| Q-C7 | Operations | 22% (3/14) | Rollback plan |
| Q-C28 | Operations | 22% (3/14) | Observability |
| Q-G16 | Gate 3 | 22% (4/18) | LLM comment breadcrumbs |
| Q-G13 | Gate 2 | 22% (4/18) | Phased decomposition |
| Q-G19 | Gate 3 | 22% (4/18) | Phase failure recovery |
| Q-C27 | Impact | 20% (2/10) | Backward compatibility |

#### Medium-confidence KEEP (hit rate 10-25%, or rescued by adversarial)

| Q-ID | Layer/Gate | Hit Rate (18 plans) | Evidence |
|------|-----------|---------------------|---------|
| Q-G5 | Gate 2 | **11% (2/18)** | Scope focus — **RESCUED**: fires on vague-auth and overscope plans. 0% on Claude Code plans, 33% on adversarial. Catches scope creep from vague prompts. |
| Q-G21 | Gate 2 | **11% (2/18)** | Internal logic consistency — **RESCUED**: fires on contradictory and large-migration plans. Catches real contradictions (local-only vs server storage, monolith DB query vs extracted service). |
| Q-G23 | Gate 2 | **11% (2/18)** | Proportionality — **RESCUED**: fires on vague-auth and overscope plans. Catches disproportionate multi-phase plans for simple problems. |
| Q-G14 | Gate 2 | 11% (2/18) | Codebase style adherence |
| Q-C12 | Impact | 11% (2/18) | Duplication check |
| Q-C5 | Testing | 11% (2/18) | Incremental verification |
| Q-C16 | Security | 11% (2/18) | Error handling |
| Q-G1 | Gate 1 | 11% (2/18) | Approach soundness |
| Q-G6 | Gate 3 | 11% (2/18) | Naming consistency |
| Q-C40 | Impact | 11% (2/18) | Guidance-implementation consistency |
| Q-C15 | Security | 11% (2/18) | Input validation |

### CONDITIONAL (8 questions)

| Q-ID | Hit Rate | Condition Flag | Evidence |
|------|----------|---------------|---------|
| Q-U5 | 100% (3/3) | HAS_UI | Accessibility; fires on all UI plans |
| Q-U7 | 100% (3/3) | HAS_UI | UI design narrative |
| Q-C25 | 100% (2/2) | HAS_UI | UI error boundary |
| Q-C14 | **6% (1/17)** | HAS_EXISTING_INFRA | Bolt-on vs integrated — **RESCUED**: fires on bolt-on plan. Catches parallel infrastructure duplication. CONDITIONAL: only fires when codebase has existing infrastructure the new code should extend. |
| Q-C32 | **6% (1/17)** | HAS_UNBOUNDED_DATA | Bulk data safety — **RESCUED**: fires on wrong-context plan (User.find({}) with no pagination). CONDITIONAL: only fires when plan fetches unbounded data. |
| Q-C26 | 11% (1/9) | HAS_STATE + data migration | Migration tasks |
| Q-C18 | 7% (1/14) | HAS_STATE + concurrent writes | Concurrency |
| Q-C13 | 6% (1/16) | HAS_STATE | State edge cases |

### DROP (3 questions — confirmed 0% across 18 plans including adversarial)

| Q-ID | Layer | Hit Rate | Applicable | Reason |
|------|-------|----------|------------|--------|
| Q-G2 | Gate 1 | 0% (0/17) | 17 | Standards compliance — plans inherently follow CLAUDE.md. Adversarial plans also PASS. |
| Q-G8 | Gate 2 | 0% (0/10) | 10 | Task/team usage — no plans over/under-use agents. All adversarial plans N/A. |
| Q-C21 | Operations | 0% (0/6) | 6 | Runtime constraints — addressed in applicable plans. All adversarial plans N/A. |

### INACTIVE (already applied — 4 questions)

| Q-ID | Layer | Reason |
|------|-------|--------|
| Q-G17 | Gate 3 | 0% hit rate, phase preambles always present |
| Q-G20 | Gate 2 | 0% hit rate, story arc always present |
| Q-C9 | Testing | 0% hit rate, step ordering always correct |
| Q-C10 | Testing | 0% hit rate, no stubs/TODOs found |

### NOT EVALUATED (5 questions — always N/A)

| Q-ID | Reason |
|------|--------|
| Q-G24 | Core-vs-derivative weighting — no plans define question batteries |
| Q-G25 | Feedback loop completeness — no plans feed into downstream tools |
| Q-C35 | Agent cognitive load — no plans dispatch analytical agents |
| Q-C36 | Persistence staleness — no persistent intermediate artifacts |
| Q-C37 | Translation boundary — no abstract-to-concrete translation steps |

### LOW-CONFIDENCE (11 questions — <=3 applicable plans)

| Q-ID | Hit Rate | Applicable | Note |
|------|----------|------------|------|
| Q-G12 | 0% (0/2) | 2 | Code consolidation — insufficient sample |
| Q-C11 | 0% (0/3) | 3 | Dead code — insufficient sample |
| Q-C24 | 0% (0/3) | 3 | Local-remote sync — insufficient sample |
| Q-C22 | 0% (0/1) | 1 | Auth/permission — insufficient sample |
| Q-C23 | 0% (0/3) | 3 | External rate limits — insufficient sample |
| Q-C17 | 0% (0/2) | 2 | Event listener cleanup — insufficient sample |
| Q-C8 | 6% (1/16) | 16 | Interface consistency — low but fires |
| Q-C19 | 7% (1/14) | 14 | Idempotency — low but fires |
| Q-U1 | 0% (0/4) | 4 | Component structure — limited UI plans |
| Q-U2 | 0% (0/4) | 4 | State management — limited UI plans |
| Q-U3 | 0% (0/4) | 4 | Interaction feedback — limited UI plans |
| Q-U4 | 0% (0/4) | 4 | Responsive layout — limited UI plans |
| Q-U6 | 0% (0/4) | 4 | Visual consistency — limited UI plans |

---

## 3. Proposed Changes to review-plan

### Already Applied (Phase 1-2 of current plan)
1. **Merged Q-E1 + Q-E2** into single "Post-implementation completeness" question with dedup instruction
2. **Inactivated Q-G17, Q-G20** (L1 formatting, 0% hit rate)
3. **Inactivated Q-C9, Q-C10** (L2 testing formatting, 0% hit rate)
4. **Updated SKILL.md** — all evaluator dispatches, memoization sets, and references updated

### New Recommendations
5. **Drop Q-G2** from active evaluation — 0% across 18 plans including adversarial. Plans inherently follow CLAUDE.md.
6. **Drop Q-G8** from active evaluation — 0% and N/A on all adversarial plans. No plans misuse agent dispatch.
7. **Drop Q-C21** from active evaluation — 0% and N/A on all adversarial plans.
8. **Make Q-C14 and Q-C32 conditional** — only evaluate when plan context indicates existing infrastructure (Q-C14) or unbounded data operations (Q-C32).
9. **Promote Q-G4, Q-G5, Q-G21, Q-G23 to confirmed KEEP** — adversarial testing proves they catch real failure modes that never appear in well-prompted Claude Code plans.

---

## 4. Cluster Contributions

Ranked by combined hit rate and signal strength:

| Rank | Cluster | Active Qs | Avg Hit Rate | Top Fires | Primary Dimensions |
|------|---------|-----------|-------------|-----------|-------------------|
| 1 | **Security & Reliability** | 7 Qs | 30% | Q-C33 (44%), Q-C34 (50%) | Q-PQ3 (risk coverage) |
| 2 | **Impact & Architecture** | 12 Qs | 18% | Q-C39 (33%), Q-C38 (28%), Q-C14 (6% conditional) | Q-PQ2 (specificity), Q-PQ3 |
| 3 | **Operations & Deployment** | 6 Qs | 20% | Q-C20 (30%), Q-C6/Q-C7/Q-C28 (22%) | Q-PQ2, Q-PQ3 |
| 4 | **Testing & Plan Quality** | 4 active Qs | 19% | Q-C29 (28%), Q-C4 (25%) | Q-PQ4 (verification) |
| 5 | **State & Data Integrity** | 5 Qs | 8% | Q-C13 (6%), Q-C18 (7%) | Q-PQ3 |
| 6 | **Client & UI** | 2 Qs | 50% | Q-C25 (100%) | Q-PQ3 (but only 2 applicable plans) |

---

## 5. Layer Contributions

| Layer | Spread Contribution | Incremental Value |
|-------|-------------------|-------------------|
| L1 gate:1 (3 Qs) | +0.334 | baseline |
| L1 gate:2 (13 Qs) | +0.272 incremental | **significant** (>0.05) |
| L1 gate:3 (4 Qs) | included in "all" | not isolated |
| L2 clusters (36 active Qs) | +0.010 incremental over gate:1+2 | **not significant** (<0.05) on Q-PQ dims |
| L3 UI (7 Qs) | included in "all" | not isolated |
| Epilogue (1 Q) | included in "all" | not significant on Q-PQ dims |

---

## 6. Confidence Assessment

### HIGH confidence
- **gate:1+2 is the minimal effective set** for Q-PQ-measured quality
- **Q-G10 and Q-G18 are the highest-value questions** — 72% and 61% hit rates
- **Q-G11 and Q-G18 are COMPLEMENTARY** — Run 3b ablation proves +0.168 incremental combined spread
- **Q-E1 (merged) replaces Q-E1+Q-E2** — Run 3b proves harmful combination effect
- **Q-G2, Q-G8, Q-C21 should be DROPPED** — 0% across 18 plans (including 6 adversarial)
- **Q-G4, Q-G5, Q-G21, Q-G23 should be KEPT** — adversarial testing proves they catch real failure modes

### MEDIUM confidence
- **L2 clusters add no Q-PQ value** but address code-level concerns not measured by Q-PQ
- **Q-C14 and Q-C32 are CONDITIONAL** — fire only on specific plan types (bolt-on patterns, unbounded data)
- **Security cluster has highest consistent L2 hit rate** — Q-C33/Q-C34 fire on 44-50% of applicable plans

### LOW confidence
- **11 questions with <=3 applicable plans** — insufficient data
- **L3 UI questions** — only 4 applicable plans; need more UI bench plans

---

## 7. Summary of Changes

| # | Change | Type | Questions Affected | Quality Impact | Cost Impact |
|---|--------|------|--------------------|---------------|-------------|
| 1 | Merge Q-E1+Q-E2 (done) | MERGE | 2 → 1 | Eliminates proportionality penalty | -1 question |
| 2 | Inactivate Q-G17/Q-G20/Q-C9/Q-C10 (done) | INACTIVE | 4 removed | None measurable | -4 questions |
| 3 | Drop Q-G2/Q-G8/Q-C21 | DROP | 3 removed | None (0% across 18 plans) | -3 questions |
| 4 | Make Q-C14/Q-C32 conditional | CONDITIONAL | 2 questions | None (skip when N/A) | Variable savings |
| 5 | Confirm Q-G4/Q-G5/Q-G21/Q-G23 KEEP | KEEP | 4 confirmed | Catches adversarial failure modes | None |

**Net effect:** 69 original → 60 active (4 inactive, 3 dropped, 1 merged, 1 new merged = -9). With conditional skipping, typical well-prompted plan evaluates ~45-50 questions. Adversarial/vague plans evaluate the full set including Q-G5/Q-G23 scope/proportionality checks.

---

## 8. Bench Bank Assessment

### Coverage after adversarial expansion

| Condition | Plans | Status |
|-----------|-------|--------|
| HAS_STATE | 5 original + large-migration | **covered (6)** |
| HAS_UI | 3 original + overscope | **covered (4)** |
| HAS_DEPLOYMENT | 6 original + large-migration | **covered (7)** |
| HAS_UNTRUSTED_INPUT | 2 original + vague-auth | **covered (3)** |
| HAS_PUBLIC_API | 2 original | covered (2) |
| HAS_ASYNC_OPS | 1 original + contradictory | **improved (2)** |
| Scope creep scenarios | vague-auth, overscope | **NEW coverage** |
| Contradictory requirements | contradictory, large-migration | **NEW coverage** |
| Unvalidated assumptions | wrong-context | **NEW coverage** |
| Bolt-on anti-pattern | bolt-on | **NEW coverage** |
| Question batteries (Q-G24) | none | **gap** |
| Downstream tool (Q-G25) | none | **gap** |
| Agent dispatch (Q-C35/Q-G8) | none | **gap** |

---

## Changes from Previous Report

Previous report (2026-04-01, 12-plan run):

| Question | Previous (12 plans) | Current (18 plans) | Change |
|----------|--------------------|--------------------|--------|
| Q-G4 | DROP (9%, borderline) | **KEEP (22%)** | **RESCUED** by adversarial — fires on 3/6 adversarial plans |
| Q-G5 | DROP (0%) | **KEEP (11%)** | **RESCUED** — fires on vague-auth, overscope |
| Q-G21 | DROP (0%) | **KEEP (11%)** | **RESCUED** — fires on contradictory, large-migration |
| Q-G23 | DROP (0%) | **KEEP (11%)** | **RESCUED** — fires on vague-auth, overscope |
| Q-C14 | DROP (0%) | **CONDITIONAL (6%)** | **RESCUED** — fires on bolt-on |
| Q-C32 | DROP (0%) | **CONDITIONAL (6%)** | **RESCUED** — fires on wrong-context |
| Q-G2 | DROP (0%) | DROP (0%) | Confirmed — still 0% with adversarial |
| Q-G8 | DROP (0%) | DROP (0%) | Confirmed — all adversarial N/A |
| Q-C21 | DROP (0%) | DROP (0%) | Confirmed — all adversarial N/A |
| Q-E1+Q-E2 | MERGE | MERGE (applied) | Applied — now single Q-E1 |
| Q-G17 | DROP | INACTIVE (applied) | Applied |
| Q-G20 | DROP | INACTIVE (applied) | Applied |
| Q-C9 | DROP | INACTIVE (applied) | Applied |
| Q-C10 | DROP | INACTIVE (applied) | Applied |

**Key insight:** The 12-plan bench bank had a correctness-bias gap — all Claude Code plans are well-structured, so "correctness-checking" questions (scope, consistency, proportionality) never fired. The 6 adversarial plans introduced intentional failure modes (vague prompts, contradictory requirements, over-scoping) that exposed the value of these questions. **6 of 9 held DROP candidates were rescued.**

**Final disposition:** 31 KEEP + 8 CONDITIONAL + 3 DROP + 4 INACTIVE + 5 NOT_EVALUATED + 13 LOW_CONFIDENCE = 64 active questions (from 69 original).
