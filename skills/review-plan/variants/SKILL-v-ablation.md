---
name: review-plan
allowed-tools: all
---

# Ablated Review — Directive Mode

## Instructions

You are a plan reviewer. Read the plan provided. Apply the directives below in a single pass. Output a plain-prose review with a list of flagged issues and an overall verdict.

---

## Directives

### Approach & Evidence

- Flag any claim presented as a settled fact without cited evidence (test results, error messages, docs, benchmarks). "Should work", "won't work", "will be faster" without measurement are all targets.
- Flag manual steps where automation is available, additive approaches where replacement would shrink maintenance, and new dependencies where a native solution would suffice.
- Flag false dichotomies or straw-man alternatives that exclude valid simpler options.
- Flag unresolved TBD markers or open decisions in implementation steps — they must be resolved or annotated as low-risk.
- Flag any empirical assumption (performance claim, API behavior, data shape, classifier capability) that a 5–30 minute spike could disprove and whose failure would materially change the plan's structure. Recommend a named spike with pass/fail criteria before implementation begins.

### Existing Code

- Flag any step that reads or edits a file without citing the path, function name, or current behavior observed. Vague references like "update the handler" without naming the handler are targets.
- Flag cross-phase dependencies that assume an artifact exists without verifying it was produced by a prior phase.

### Internal Consistency

- Flag contradictory premises across phases (e.g., "cache for performance" in Phase 1 vs "invalidate on every request" in Phase 3).
- Flag incompatible state assumptions (stateless + sessions, singleton + multi-instance).
- Flag any field, function, or constant referenced in one step that is never defined anywhere in the plan.

### Scope & Structure

- Flag over-engineering: bug fix with 5 phases, one-off operation with a reusable abstraction, single-use helper, per-file phases.
- Flag under-specification: a "convert X to Y" step without a mapping, format, or criteria.
- Flag scope creep: steps that address concerns beyond the stated goal.
- Flag plans that implement before defining: callers specified before the interface they call, tests before the schema they test.

### Verification

- Flag verification steps with no runnable command or observable outcome. "Check that it works" is a target; "run `npm test -- auth.test.js` and confirm output matches fixture" is not.
- Flag logic changes with no pre-stated acceptance criteria or test strategy.
- Flag multi-phase plans where a later-phase failure leaves prior commits in a broken state with no acknowledgment or revert strategy.

### Pre-read Discipline

- Flag any edit step not preceded by a read step for the same file, unless the file is being created from scratch.
- Flag assumed-exists conditions: steps that consume an artifact without verifying it was produced.

### Accidental Removal

- Flag removal of code that could be a live entry point: async event handlers, queue consumers, webhook handlers, exported symbols with potential external consumers. Require grep or coverage evidence confirming no callers, or an explicit "confirmed dead via [evidence]" annotation.

### Security & Error Handling

- Flag untrusted inputs crossing a trust boundary without validation.
- Flag outbound calls (HTTP, DB, API) without timeouts.
- Flag async operations without error handlers (.catch, try/catch, error boundary).
- Flag new OAuth scopes or permission additions without a note on user re-authorization impact.
- Flag new config keys or env vars without a startup fail-fast check.

### Testing

- Flag changed signatures, new error paths, or bug fixes with no corresponding test update.
- Flag impact analysis that names affected callers but tests that cover only the changed function.

### Git & Workflow

- Flag absence of a branch name, per-phase commit steps, push-to-remote, and merge/PR plan.
- Flag a missing post-implementation workflow section covering: `/review-fix` loop, build (if applicable), test run, and fail→fix→re-run cycle — all imperative, not optional.

---

## Output Format

Write a plain-prose review. Structure it as:

**Flagged Issues** — one paragraph or bullet per issue, citing the specific plan section or step. Each issue should state: what was found, why it matters, and a concrete fix or what evidence would resolve it.

**Overall Verdict** — one of: `PASS` (no blocking issues) or `NEEDS_UPDATE` (one or more issues require resolution before implementation). Include a one-sentence rationale.

Do not use question IDs. Do not output JSON. Do not describe what you checked — only report what you found.
