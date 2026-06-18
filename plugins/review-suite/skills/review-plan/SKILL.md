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

## Directive

- **Senior-engineer review.** Flag anything a senior engineer would raise on this kind of plan. This includes blocking concerns — cross-file or cross-phase artifact dependencies that aren't verified, edits without a pre-read of the existing file, unvalidated empirical claims presented as settled fact, scope creep / over-engineering / under-specification, verification steps with no runnable command, untrusted inputs reaching trust boundaries, removal of code that could be a live entry point — *and* advisory concerns a senior reviewer would mention even when not strictly blocking: deviations from established conventions or standards (e.g., W3C trace context, RFC caching semantics, established framework patterns) that the plan reinvents ad-hoc; operational fragility (async-boundary correctness, concurrency invariants, per-request resource churn, lifecycle/timing assumptions); and "consider…" suggestions where a more idiomatic, simpler, or better-known approach exists. Also flag: fabricated quantitative claims (latency/throughput/Nx-faster numbers cited to files or benchmarks no plan step produces); phantom types/functions/modules referenced in exported signatures but never defined; dual-source-of-truth patterns lacking reconciliation; broken intermediate commits where a phase depends on a later phase's artifact; implicit new toolchains (language/runtime/native dep) without a build/install path. Cite the specific step and what evidence would resolve it.
- **N/A condition:** TRIVIAL — documentation-only single-step plan with no code changes. Apply the directive only where it could materially apply; in that case, the severity rule below also does not apply. The verdict for a TRIVIAL plan is unconditionally `PASS`.

## Severity Rule (always-on)

Treat the following finding categories as **blocking**: unvalidated empirical claims presented as settled fact; cross-file/cross-phase artifact dependencies unverified; edits without a pre-read; untrusted inputs reaching trust boundaries; removal of code that could be a live entry point; fabricated quantitative claims cited to files/benchmarks no plan step produces; phantom types/functions/modules referenced but never defined; dual-source-of-truth without reconciliation; broken intermediate commits where a phase depends on a later phase's artifact; implicit new toolchains without a build/install path.

Apply this verdict rule literally:
- If you flagged **zero** blocking findings → verdict is `PASS` or `NEEDS_UPDATE` based on advisory weight.
- If you flagged **exactly one** blocking finding → verdict is at most `NEEDS_UPDATE` (cannot be `PASS`).
- If you flagged **two or more** blocking findings → verdict is `NOT READY`.

The downgrade is mandatory and not subject to your judgment about whether the issue is "really" blocking. If you flagged it as one of these categories, it counts.

## Output Format

**Flagged Issues** — one paragraph or bullet per issue, prefixed with `[BLOCKING]` or `[ADVISORY]` per the Severity Rule, citing the specific plan section/step, what was found, why it matters, and the concrete fix or evidence that would resolve it.

**Overall Verdict** — `PASS`, `NEEDS_UPDATE`, or `NOT READY` with a one-sentence rationale.

Do not use question IDs. Do not output JSON. Do not describe what you checked — only report what you found.

### Apply Improvements

If the plan met the **TRIVIAL N/A condition**, skip to the ExitPlanMode Gate step immediately.

If the plan file path is **not known** (e.g., the plan was provided inline rather than as a file path), skip direct edits. Instead, output a corrected version of each `[BLOCKING]` section as a fenced block for the user to apply manually. Then ask the user via AskUserQuestion to confirm the corrections have been applied before proceeding to the gate step. Do NOT write the gate file or call ExitPlanMode until the user confirms.

Otherwise:

1. **Edit the plan file directly** to address every `[BLOCKING]` finding. Use the Edit tool on the plan file path. Do not ask for permission; this is the expected behavior.
2. **Edit the plan file directly** to address every `[ADVISORY]` finding as well. Apply the advisory improvements using the Edit tool on the plan file path. If an advisory finding cannot be applied automatically (e.g., it requires information only the user has, or it contradicts a stated constraint), note it as "skipped: requires user input" in the summary.
3. After all edits are applied, output a brief summary: one line per fix applied (blocking or advisory), then a separate list of any advisory findings skipped due to requiring user input.
4. **Re-evaluate the verdict** by re-reading the edited plan file — do not infer correctness from the edits you intended; verify in the file content. Apply the Severity Rule, counting only findings not resolved by the edits just applied. Use this updated verdict for the ExitPlanMode Gate below.

## ExitPlanMode Gate

Using the **post-edit verdict** from Apply Improvements (or the original verdict if no edits were needed):

- If the verdict is `PASS`: write the gate file, then call ExitPlanMode.
- If the verdict is `NEEDS_UPDATE` or `NOT READY` but all remaining findings are resolvable by the agent: apply further edits, re-evaluate (step 4 above), and loop back to this gate — at most **2 additional iterations total**. Stop immediately if the verdict does not improve after any single iteration; treat remaining findings as requiring user input and surface them via AskUserQuestion.
- If the verdict is `NOT READY` with blockers that require user input (e.g., missing requirements, undefined external dependencies): do NOT write the gate file and do NOT call ExitPlanMode — surface the unresolved blockers via AskUserQuestion.

Write the gate file by inlining the actual absolute path — do not copy the placeholder literally:

```
slug=$(basename "/absolute/path/to/plan.md" .md)
mkdir -p ~/.claude/plans
echo "/absolute/path/to/plan.md" > ~/.claude/plans/.review-ready-"$slug"
```

Replace `/absolute/path/to/plan.md` with the real path of the plan file you reviewed. Then call the ExitPlanMode tool to present the updated plan to the user for approval.

On any non-PASS verdict where the agent cannot self-resolve remaining blockers, do not write the gate file — the user must edit and re-invoke, or use the documented escape hatch (`touch ~/.claude/plans/.review-ready-<slug>`).
