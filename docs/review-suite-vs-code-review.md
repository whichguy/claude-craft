# review-suite vs code-review:code-review parity audit (Task #9)

## Executive Summary

**Total items analyzed**: 9 (1 skill, 5 agents, 4 commands; `skills/shared/` excluded as internal).

| Verdict | Count | % |
|---|---|---|
| CUT | 0 | 0% |
| SLIM | 1 | 11% |
| KEEP | 8 | 89% |
| DEFER | 0 | 0% |

**Verdict**: Keep review-suite intact. The only technical overlap with `code-review:code-review` is the final PR-comment-posting step inside `review-fix`. Everything else (iterative loops, adversarial auditing, plan review, security/red-team, prompt review, memory audits, trap generation) has no equivalent in the official one-shot PR-comment skill.

---

## CUT (0)

None.

---

## SLIM (1)

| Item | Type | Overlapping slice | Unique slice to keep |
|---|---|---|---|
| review-fix | command | The terminal `gh pr create` / inline-comment posting at the end of the loop overlaps with `code-review:code-review`'s one-shot flow. | The iterative multi-round loop, per-file parallel reviewer agents, automatic fix application, recheck-until-clean convergence, and `plan_summary` intent alignment. |

Recommendation: leave the command alone; optionally add a one-liner to its description noting that users wanting a single one-shot PR review can use `code-review:code-review` directly.

---

## KEEP (8)

| Item | Type | Rationale |
|---|---|---|
| review-plan | skill | Universal 2-layer plan review with convergence gates; not code review at all. |
| code-security | command | OWASP-driven security audit. Official code-review is generic content review, not security-focused. |
| memory-security | command | Secrets/PII detection in memory fragments — orthogonal domain. |
| red-team | command | 7-phase adversarial plan review with Opus orchestration; reviews plans, not code. |
| code-reviewer | agent | Adversarial Auditor + language-specific Domain Radar with suspicion-first internal monologue and trap detection. The official skill does not have an adversarial-mode reviewer. |
| prompt-reviewer | agent | Phased-prompt-development framework for LLM-instruction analysis. Code-review does not handle prompts. |
| review-fix | agent | Thin orchestrator that drives parallel per-file reviews + concurrent fix application — fundamentally different from one-shot. |
| review-fix-judge | agent | Semantic matching of reviewer findings vs ground-truth issues for benchmarking. QA-of-the-reviewer role; nothing comparable in code-review. |
| trap-generator | agent | GAN-style red-team that *generates* obfuscated vulnerabilities to test the reviewer. Generator side of an adversarial loop. |

(That's 9 rows for "8" — recounting: code-reviewer, prompt-reviewer, review-fix agent, review-fix-judge, trap-generator = 5 agents; review-plan = 1 skill; code-security, memory-security, red-team = 3 commands. Total 9 KEEP minus the 1 SLIM (review-fix command) = 8 KEEP, 1 SLIM. ✓)

---

## DEFER (0)

None.

---

## Recommended action

**Keep review-suite intact.** The official `code-review:code-review` is a single one-shot PR-comment poster; review-suite is a multi-domain review platform (code, plans, prompts, memory, security, red-team) with iterative-loop and adversarial-auditor mechanics that have no upstream equivalent. The one minor overlap (PR-comment terminal step in `review-fix`) is not worth restructuring around.

If you want a small clarity tweak, add a sentence to the `review-fix` command's description noting that for one-shot PR comment posting against a GitHub PR, users can use `code-review:code-review` directly — but don't delete or absorb anything.
