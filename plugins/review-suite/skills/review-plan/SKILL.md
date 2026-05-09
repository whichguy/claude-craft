---
name: review-plan
description: |
  Universal plan review: senior-engineer directive + deterministic count-based severity rule.

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

Treat the following finding categories as **blocking**: unvalidated empirical claims presented as settled fact; cross-file/cross-phase artifact dependencies unverified; edits without a pre-read; untrusted inputs reaching trust boundaries; removal of code that could be a live entry point; fabricated quantitative claims cited to files/benchmarks no plan step produces; phantom types/functions/modules referenced but never defined; dual-source-of-truth without reconciliation; broken intermediate commits where a phase depends on a later phase's artifact; implicit new toolchains without a build/install path.

Apply this verdict rule literally:
- If you flagged **zero** blocking findings → verdict is `PASS` or `NEEDS_UPDATE` based on advisory weight.
- If you flagged **exactly one** blocking finding → verdict is at most `NEEDS_UPDATE` (cannot be `PASS`).
- If you flagged **two or more** blocking findings → verdict is `NOT READY`.

The downgrade is mandatory and not subject to your judgment about whether the issue is "really" blocking. If you flagged it as one of these categories, it counts.

## Output Format

**Flagged Issues** — one paragraph or bullet per issue, citing the specific plan section/step, what was found, why it matters, and the concrete fix or evidence that would resolve it.

**Overall Verdict** — `PASS`, `NEEDS_UPDATE`, or `NOT READY` with a one-sentence rationale.

Do not use question IDs. Do not output JSON. Do not describe what you checked — only report what you found.

## ExitPlanMode Gate

If — and only if — the final verdict is `PASS`, write the gate file the ExitPlanMode PreToolUse hook checks for:

```
slug=$(basename '<plan_path>' .md)
mkdir -p ~/.claude/plans
echo '<plan_path>' > ~/.claude/plans/.review-ready-"$slug"
```

Substitute `<plan_path>` with the absolute path of the plan file you reviewed. On any other verdict, do not write the gate file — the user must edit and re-invoke, or use the documented escape hatch (`touch ~/.claude/plans/.review-ready-<slug>`).
<!-- ci-smoke-trigger 2026-05-09: inert edit to exercise CI paths-filter; reverted on PR close -->

