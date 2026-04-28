# Form 990 Skill — Token Efficiency Audit
*Task #10 — 2026-04-15*

**Scope:** SKILL.md, PHASES.md, QUESTIONS.md, PERSONA.md, SCHEDULES.md, VERIFY.md
**Goal:** Identify prompt language that can be made more token-efficient without losing
fidelity or quality. All proposed changes require user approval; A/B test required before
applying Tier B changes.

---

## Baseline Token Budget

| File | Lines | ~Tokens | % of total |
|------|-------|---------|------------|
| PHASES.md | 1,207 | ~16,553 | 32% |
| SKILL.md | 1,047 | ~12,055 | 23% |
| QUESTIONS.md | 797 | ~9,941 | 19% |
| SCHEDULES.md | 557 | ~6,100 | 12% |
| VERIFY.md | 636 | ~5,904 | 11% |
| PERSONA.md | 67 | ~726 | 1% |
| **Total** | **4,311** | **~51,279** | |

Not all files load simultaneously. The heaviest single-phase load is P8:
SKILL.md + QUESTIONS.md + PERSONA.md + relevant PHASES.md/SCHEDULES.md sections
≈ ~22,000–28,000 tokens before the dataset itself.

---

## Runtime Load Profile

Understanding which files load in which phase determines actual cost:

| Phase | Files loaded | Approx tokens |
|-------|-------------|---------------|
| P0 | SKILL.md + PHASES.md §P0 + PERSONA.md | ~3,500 |
| P1–P6 | SKILL.md + PHASES.md §P<N> + PERSONA.md | ~2,800/phase |
| P6 (schedules) | + SCHEDULES.md | +6,100 |
| P8 | SKILL.md + PHASES.md §P8 + QUESTIONS.md + PERSONA.md | ~24,000 |
| P9 | SKILL.md + PHASES.md §P9 + PERSONA.md | ~2,800 |

**P8 is the highest-cost phase** and the best target for optimization.
QUESTIONS.md is fully loaded at P8 — every token saved there is saved on every P8 pass
(and the convergence loop may run 3–5 passes). At 5 passes: `5 × 9,941 = ~50K tokens`
just for QUESTIONS.md.

---

## Verbosity Patterns Found

### Pattern A — NEEDS_UPDATE Examples Are Partially Duplicative of Pass Criteria

Each gate has a NEEDS_UPDATE example that re-states the failure condition that the Pass
criteria already define. The `[EDIT: ...]` directive in the example often just rephrases
the Pass criterion as a negative.

**Example (Q-F3):**
Pass criteria state: `Col_B + Col_C + Col_D == Col_A, $0 tolerance`
NEEDS_UPDATE example then shows: "Gap of $1,800. Likely a rounding artifact."
The `[EDIT: ...]` is the load-bearing part; the scenario prose is illustrative but
consumable as a comment.

**Estimated savings if NEEDS_UPDATE examples are compressed 40%:** ~1,200 tokens
**Risk:** Medium — examples serve as few-shot samples for evaluation quality.
Recommend A/B test before applying.

### Pattern B — "Common Mistakes" Sections Overlap Pass Criteria

Q-F5, Q-F6, Q-F9, Q-F13 have "Common mistakes" subsections that re-state failure modes
the Pass criteria already cover. For example, Q-F6 "Common mistakes" includes "Using last
year's compensation without updating" — which the Pass criteria implicitly require by
specifying source verification.

**Estimated savings if removed from 6 gates:** ~300 tokens
**Risk:** Low — the Pass criteria are the authoritative spec; mistakes are redundant.

### Pattern C — Horizontal Rule Separators Add Visual Structure But Token Cost

Every gate definition in QUESTIONS.md is separated by `---` (3 chars + 2 newlines × 30 gates
= ~130 chars). The `### Gate Name` heading already visually separates sections.

**Savings if `---` separators removed from gate definitions:** ~40 tokens (trivial)
**Risk:** Zero — purely cosmetic.

### Pattern D — PHASES.md Transition and Idempotency Sections Are Formulaic

Every phase ends with:
```
**Idempotency.** Overwrite mode — re-execution fully rewrites <artifact-name>.
**Transition.** → P<N+1> (unless HALTED-*).
```

These two lines (P0–P9 = 10 phases) contribute ~80 lines of predictable text. The
Transition line in particular is trivially derivable (P0→P1, P1→P2, etc.).

**Proposed: remove Transition lines; add single "Phase sequence: P0→P1→…→P9" note
in PHASES.md header (already present in SKILL.md §Phase Dispatch).**
**Estimated savings:** ~25 lines / ~150 tokens
**Risk:** Low — sequence already specified in SKILL.md.

### Pattern E — Scope-Exclusion Banner Is Duplicated In P0

PHASES.md §P0 contains TWO scope-exclusion banners:
- Step 0.a: Full ASCII box banner rendered before intake (13 lines)
- Step 8: A second nearly-identical box banner before P1 transition (14 lines)

The content is ~70% overlapping. The distinction is that step 0.a uses AskUserQuestion
and step 8 is informational only (B6 annotation says "render once, check breadcrumb").

**Proposed: Merge into one banner with a note to render at P0 entry (not twice).**
**Estimated savings:** ~12 lines / ~350 tokens
**Risk:** Low — B6 annotation documents intent; can preserve it in the merged version.

### Pattern F — Python Code Blocks in SKILL.md Are Load-Bearing

The full Python implementations of `merge_datasets()`, `verify_ancestors()`, `run_script()`,
and `atomic_commit()` (CAS logic) together account for ~350 lines (~4,000 tokens) of SKILL.md.

These are NOT candidates for compression — the LLM needs them to implement correct behavior.
Compressing them risks incorrect merge logic, CAS failures, or security bypasses.

**Recommendation: Do not touch.**

### Pattern G — QUESTIONS.md Tier Summary Table Is Partially Redundant with Gate Definitions

The tier table at the top of QUESTIONS.md (26 rows) lists ID, Tier, Name, Triggered In, and
Applies When. All of this information also appears in each gate's individual definition.
The table serves as a quick-reference index — valuable during P8 when the LLM needs to
select applicable gates.

**However:** With 30 gates, the table is now 34 lines. The Tier/gate assignment in the table
is the most critical piece (for the convergence loop gate-ID lists). The "Triggered In" column
duplicates the gate definition header.

**Proposed: Keep table but remove "Triggered In" column (redundant with gate definitions).**
**Estimated savings:** ~26 tokens (one column × 26 rows, trivial).
**Risk:** Zero.

### Pattern H — Per-Phase Cross-Cutting Header in PHASES.md Is Referenced But Repeated by Reference

The Cross-Cutting Pattern (programmatic analysis, ~100 lines) is correctly defined once at the
top of PHASES.md and then referenced with `> Programmatic analysis required (see Cross-Cutting
Pattern above)` in P2, P3, and P5. This is already efficient.

**Recommendation: No change needed.**

### Pattern I — PERSONA.md "What they know/don't know" Is Only Relevant at P0 and P1

The User Context (Preparer) persona includes a "What they know / What they don't know yet"
block that is specific to onboarding. In P8 and P9, this context is irrelevant — the skill
is not explaining the 990 structure to the user; it's evaluating gates.

**Proposed: Move "What they know/don't know" block to PHASES.md §P0 only (not in the global
persona injection). The CPA Reviewer persona remains in global injection.**
**Estimated savings at P8:** ~15 lines / ~200 tokens (per P8 pass, 5 passes = 1,000 tokens)
**Risk:** Low — but must verify that no mid-session user explanations rely on this context.

### Pattern J — QUESTIONS.md: Q-F2 Has Verbose "Not a single equality chain" Caveat

Q-F2 gate definition spends 4 lines explaining why Revenue − Expenses ≠ EOY − BOY.
This explanation is important for correctness, but it's placed in narrative prose when it
could be a concise inline note.

**Current (4 lines):** "These are three SEPARATE checks — they are NOT a single equality chain.
Revenue − Expenses ≠ EOY − BOY unless adjustment lines are all zero. Conflating them produces
false failures for endowment orgs and investment holders."

**Proposed (1 line in code comment):**
```
# Check 1: operating surplus only. NOT the same as EOY − BOY (adjustment lines break that).
```

**Estimated savings:** ~50 tokens
**Risk:** Low — the check pseudocode itself makes this clear.

---

## Summary: Recommended Changes by Tier

### Tier A — Safe, Apply Immediately (no A/B test needed)

| # | Change | File | Est. savings |
|---|--------|------|-------------|
| A1 | Remove "Common mistakes" from Q-F5, Q-F6, Q-F9, Q-F13, Q-F25 | QUESTIONS.md | ~300 tokens |
| A2 | Remove Transition lines from all phases (P0→P9); keep sequence note in header | PHASES.md | ~150 tokens |
| A3 | Merge the two P0 scope-exclusion banners into one | PHASES.md | ~350 tokens |
| A4 | Remove "Triggered In" column from Tier/Gate Summary table | QUESTIONS.md | ~50 tokens |
| A5 | Compress Q-F2 "not a single equality chain" caveat to one-line code comment | QUESTIONS.md | ~50 tokens |
| **A-total** | | | **~900 tokens** |

### Tier B — A/B Test Required Before Applying

| # | Change | File | Est. savings | Risk |
|---|--------|------|-------------|------|
| B1 | Compress NEEDS_UPDATE examples 40% (remove scenario prose, keep [EDIT:] + [USER:]) | QUESTIONS.md | ~1,200 tokens | Medium |
| B2 | Move "What they know/don't know" to P0 only; remove from global persona | PERSONA.md / PHASES.md | ~200 tokens/P8 pass | Low |
| **B-total (per P8)** | | | **~1,400 tokens** | |
| **B-total (5 passes)** | | | **~7,000 tokens** | |

### Tier C — Do Not Change

| # | Change | Reason |
|---|--------|--------|
| C1 | `merge_datasets()` Python code | Exact implementation required |
| C2 | `verify_ancestors()` Python code | Exact implementation required |
| C3 | `run_script()` Python code | Security rules + exact behavior required |
| C4 | Q-F4 509(a)(2) algorithm pseudocode | IRS rule, cannot abbreviate |
| C5 | SCHEDULES.md Schedule A algorithm | IRS rule, cannot abbreviate |
| C6 | VERIFY.md test case specs | Needed for harness implementation |
| C7 | NEEDS_UPDATE [USER:] companion lines | Critical for user-facing output quality |

---

## A/B Test Plan (for Tier B changes)

### Test scenario: P8 evaluation of a representative dataset

**Control:** Current QUESTIONS.md (30 gates, full NEEDS_UPDATE examples)
**Variant:** QUESTIONS.md with Tier B changes applied

**Evaluation criteria (run /compare-prompts):**
1. Gate output quality: does the optimized version produce the same PASS/NEEDS_UPDATE/N/A
   determination for each gate?
2. [EDIT:] directive accuracy: does the optimized version still emit correct directives
   with proper phase routing?
3. [USER:] companion quality: is the user-facing language still clear and actionable?
4. False negative rate: does the optimized version miss any genuine issues?

**Sample test input:** Use the FY2025 Fortified Strength dataset (artifacts/form990-dataset.json)
as the evaluation subject. Run Q-F2, Q-F3, Q-F4, Q-F19, Q-F20 as the gate sample (mix of
G1 new/old, covering both pass and needs_update cases).

**Success criterion:** All 5 gates produce identical determinations (PASS/NEEDS_UPDATE/N/A)
between control and variant. Any divergence → reject the optimization for that gate.

**Tool to use:** `/compare-prompts` skill with:
- PROMPT_A = current QUESTIONS.md gate section for Q-F2, Q-F3, Q-F4, Q-F19, Q-F20
- PROMPT_B = optimized version of same gates
- INPUT = P8 evaluation instruction with dataset summary
- OUTPUT quality judged by compare-prompts-judge on 7 criteria

---

## Action Required From User

1. Approve Tier A changes to apply immediately (estimated ~900 tokens saved, low risk)
2. Approve A/B test for Tier B changes using FY2025 dataset sample
3. After A/B results: approve or reject Tier B changes per gate

Tier A changes can be applied in a single editing pass across QUESTIONS.md and PHASES.md.
No new files created; no behavior changes — purely editorial compression.
