# Changelog

## 2026-05-09 — review-plan: micro-noclose-strict promotion (22fd345)

`plugins/review-suite/skills/review-plan/SKILL.md` was reduced from 4070 lines of orchestration to a 34-line single-pass directive (`micro-noclose-strict`), validated by 50 paired sub-agent runs across 5 fixtures. The trade-off was an explicit reduction of skill scope; capabilities below are removed by design.

### Removed capabilities

- **Convergence loop (multi-pass evaluation)** — Removed. The old skill ran up to 5 evaluation passes with inline plan edits between passes. Now: single-pass review only. Migration: read the verdict, edit the plan manually, re-invoke `/review-suite:review-plan` for another pass.

- **Final scorecard / Teaching Notes panel** — Removed. The old skill emitted a structured scorecard (findings digest, senior-engineer critic loop, Teaching Notes section) on completion. Now: prose flagged issues + one-sentence verdict. Migration: maintain decision records out-of-band.

- **Phase 5g skill-learnings emission** — Removed. The old skill spawned a sub-agent at the end of every FULL-tier review to surface 0–5 self-improvement suggestions for the review-plan skill itself. Now: no auto-feedback. Migration: file enhancement suggestions as GitHub issues.

- **Implementation Intent Questions appended to plan** — Removed. The old skill extracted plan-specific verification questions and wrote them back into the plan file as a contract for `/review-fix` (intent-to-code drift detection). Now: the skill never modifies the plan file. Migration: define verification contracts manually in the plan or a sibling document.

- **Question ID system (Q-G1, Q-G5, Q-C3, Q-G30, …)** — Removed from output. The skill instructions now explicitly say "Do not use question IDs"; findings are graded by category. Migration: none.

- **Tier dispatch (TRIVIAL / SMALL / FULL)** — Removed. The old skill classified plans into three tiers and ran different question subsets. Now: a single senior-engineer directive applies uniformly, with N/A only for documentation-only plans. Migration: none — depth is uniform.

- **Layer 2 dispatch into language-specific plans** — Removed from review-plan. The old SKILL.md detected GAS/Node plans and invoked `gas-plan` / `node-plan` as a layered review. Now: review-plan does not dispatch. Note: `gas-suite/skills/gas-review/SKILL.md:59` still says "review-plan handles GAS detection and gas-plan invocation internally" — this is documentation drift; gas-review still receives a verdict back, the dispatch is just no longer automatic. Migration: invoke `/planning-suite:gas-plan` or `/planning-suite:node-plan` directly when language-specific layered review is wanted. (Both skills remain independent, with their own internal convergence loops and scorecards — they are not affected by this change.)

- **Adversarial close (two-question structured phase)** — Folded into the directive. The old skill ran two explicit validation questions ("Fabricated quantitative evidence", "Phantom types/symbols") after the main directive. Now: these are merged into the directive prose plus a deterministic count-based severity rule. Migration: none — same checks, less ceremony.

### Still present (not regressed)

- **`MANDATORY_PRE_EXIT_PLAN` gate file** at `~/.claude/plans/.review-ready-<slug>` — still emitted on `PASS` verdict (lines 46–56 of new SKILL.md). The ExitPlanMode PreToolUse hook in `plugins/planning-suite/hooks/hooks.json` continues to consume it.

- **GAS plan review entry point** — `/review-suite:review-plan` is still the documented entry point for plan review per `gas-gmail-cards.md`. Output shape changed (no scorecard) but the call still works.

### Cross-model behavior

`RUN-FINDINGS.md` documents that probe-9 produces `NOT_READY` 3/3 on Opus but `NEEDS_UPDATE` 5/5 on Sonnet — this Opus/Sonnet severity-tier gap is now an allowed and tested baseline, encoded in the `--model` flag's cross-model regression cell in `/ablate-review-plan`.
