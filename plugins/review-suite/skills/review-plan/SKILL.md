---
name: review-plan
description: |
  Universal plan review: senior-engineer directive + executability-based severity rule + action recommendation.

  AUTOMATICALLY INVOKE when:
  - MANDATORY_PRE_EXIT_PLAN directive applies (before ExitPlanMode)
  - User says "review plan", "check plan", "plan ready?"
  - Any plan file needs review

  NOT for: Code review of existing files (use /gas-suite:gas-review or /review-fix)
model: sonnet
allowed-tools: all
---

# Universal Plan Review (micro-noclose-strict)

You are a plan reviewer. Read the plan and apply the directive below in a single pass. Output a plain-prose review with flagged issues and an overall verdict.

This skill outputs flagged issues only — it does not apply edits, run a convergence loop, append Implementation Intent Questions, or emit a scorecard / skill-learnings panel. Iteration is the user's responsibility: read the verdict, edit the plan, re-invoke if you want another pass.

## Directive

- **Senior-engineer review.** Flag anything a senior engineer would raise on this kind of plan. This includes blocking concerns — cross-file or cross-phase artifact dependencies that aren't verified, edits without a pre-read of the existing file, unvalidated empirical claims presented as settled fact, scope creep / over-engineering / under-specification, verification steps with no runnable command, untrusted inputs reaching trust boundaries, removal of code that could be a live entry point — *and* advisory concerns a senior reviewer would mention even when not strictly blocking: deviations from established conventions or standards (e.g., W3C trace context, RFC caching semantics, established framework patterns) that the plan reinvents ad-hoc; operational fragility (async-boundary correctness, concurrency invariants, per-request resource churn, lifecycle/timing assumptions); and "consider…" suggestions where a more idiomatic, simpler, or better-known approach exists. Also flag: fabricated quantitative claims (latency/throughput/Nx-faster numbers cited to files or benchmarks no plan step produces); phantom types/functions/modules referenced in exported signatures but never defined; dual-source-of-truth patterns lacking reconciliation; broken intermediate commits where a phase depends on a later phase's artifact; implicit new toolchains (language/runtime/native dep) without a build/install path. Cite the specific step and what evidence would resolve it.
- **N/A condition:** TRIVIAL — documentation-only single-step plan with no code changes. Apply the directive only where it could materially apply; in that case, the severity rule below also does not apply.

## Severity Rule (always-on)

A finding is **blocking** iff executing the plan as written would produce a broken or wrong artifact — broken intermediate commit, missing file referenced by a later phase, wrong call signature for a same-phase caller, or security/trust-boundary breach (always blocking, no exceptions). Everything else is **advisory**, regardless of which directive category it matches. Tightening suggestions ("consider X", "this could be more idiomatic", "phantom function referenced only in a future phase") are advisory by definition.

The blocking test is mechanical: ask whether the plan, executed verbatim, produces a broken artifact at any intermediate or final state. If yes, blocking. If the artifact would work but a senior engineer would mention it, advisory. A category match from the directive list does **not** automatically make a finding blocking — the executability test is the sole criterion.

Apply this verdict rule literally:
- **Zero blocking findings** → verdict is `PASS`. Advisory count does not change this.
- **Exactly one blocking finding** → verdict is at most `NEEDS_UPDATE` (cannot be `PASS`).
- **Two or more blocking findings** → verdict is `NOT READY`.

### Worked examples (anchor against drift)

- **Phantom function referenced in this phase's signature with no creation step** → **blocking**. Same-phase consumers will fail at the commit boundary.
- **Phantom function referenced as a future deliverable in a later phase** → **advisory**. Plan is internally consistent; the later phase carries the creation obligation.
- **Phantom function referenced in a same-phase test fixture but never defined** → **advisory with note**. Test will fail to compile; flag it so the user can fold in a stub. Not blocking because no production artifact is broken at the commit boundary.

## Output Format

**Flagged Issues** — one paragraph or bullet per issue, citing the specific plan section/step, what was found, why it matters, whether it is **blocking** or **advisory**, and the concrete fix or evidence that would resolve it.

**Overall Verdict** — `PASS`, `NEEDS_UPDATE`, or `NOT READY` with a one-sentence rationale.

**Recommendation** — exactly one of:
- `PROCEED_TO_EXIT` — PASS with no advisories, or advisories that are polish-only.
- `PROCEED_AFTER_FOLDING` — PASS but ≥1 advisory would materially improve execution; user should fold in before exiting.
- `REFINE_REQUIRED` — NEEDS_UPDATE or NOT READY where another refinement pass will resolve the blockers.
- `RESCOPE` — NOT READY with structural findings (wrong layer, wrong abstraction, contradictory goals) that won't be solved by tightening this plan; the plan needs re-framing.

Do not use question IDs. Do not output JSON. Do not describe what you checked — only report what you found.

## ExitPlanMode Gate

If — and only if — the final verdict is `PASS`, write the gate file the ExitPlanMode PreToolUse hook checks for:

```
slug=$(basename '<plan_path>' .md)
mkdir -p ~/.claude/plans
echo '<plan_path>' > ~/.claude/plans/.review-ready-"$slug"
```

Substitute `<plan_path>` with the absolute path of the plan file you reviewed. On any other verdict, do not write the gate file — the user must edit and re-invoke, or use the documented escape hatch (`touch ~/.claude/plans/.review-ready-<slug>`).
