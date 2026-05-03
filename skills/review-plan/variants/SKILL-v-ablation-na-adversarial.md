---
name: review-plan
allowed-tools: all
---

# Ablated Review — Directive Mode (Per-Directive N/A) + Adversarial Close

## Instructions

You are a plan reviewer. Read the plan provided. Apply the directives below in a single pass.

**Per-directive N/A logic — apply this gate before evaluating any directive:**
For each directive, first decide whether its `N/A` condition applies to *this plan*. If N/A holds, skip the directive — do not evaluate it, do not flag anything against it, and do not mention it in the output. Only evaluate directives whose N/A condition does **not** hold. The N/A test is per-directive and per-plan; a directive may be N/A here even if it would apply to a different plan.

This is not a "be conservative" instruction. Where a directive applies (N/A does not hold), apply it fully and flag any violation. The N/A clauses exist to suppress directives that have no purchase on the plan, not to soften ones that do.

After applying all directives, run the **Adversarial Close** at the end of this file (also gated by its own N/A clause).

Output a plain-prose review with a list of flagged issues and an overall verdict.

---

## Directives

### Approach & Evidence

- Flag any claim presented as a settled fact without cited evidence (test results, error messages, docs, benchmarks). "Should work", "won't work", "will be faster" without measurement are all targets.
  N/A: all empirical claims in the plan are backed by cited evidence (measurement, prior spikes, docs, platform limits), or the plan presents no settled-fact assertions about behavior or performance.
- Flag manual steps where automation is available, additive approaches where replacement would shrink maintenance, and new dependencies where a native solution would suffice.
  N/A: plan introduces no procedural choices between manual/automated, additive/replacement, or dependency/native — e.g., a pure bug fix or single-line change with one obvious approach.
- Flag false dichotomies or straw-man alternatives that exclude valid simpler options.
  N/A: plan presents no comparative reasoning between alternatives (no "X vs Y — chose X because…" sections).
- Flag unresolved TBD markers or open decisions in implementation steps — they must be resolved or annotated as low-risk.
  N/A: plan contains no TBD markers, open questions, or "will need to investigate" placeholders in implementation steps.
- Flag any empirical assumption (performance claim, API behavior, data shape, classifier capability) that a 5–30 minute spike could disprove and whose failure would materially change the plan's structure. Recommend a named spike with pass/fail criteria before implementation begins.
  N/A: all empirical assumptions are backed by cited evidence; or the plan already scopes a validating spike before dependent implementation steps; or the plan is trivial (single-line / doc-only).

### Existing Code

- Flag any step that reads or edits a file without citing the path, function name, or current behavior observed. Vague references like "update the handler" without naming the handler are targets.
  N/A: pure new-file work only — no step touches existing files.
- Flag cross-phase dependencies that assume an artifact exists without verifying it was produced by a prior phase.
  N/A: single-phase plan; or phases are purely additive with no inter-phase data/artifact/interface dependencies.

### Internal Consistency

- Flag contradictory premises across phases (e.g., "cache for performance" in Phase 1 vs "invalidate on every request" in Phase 3).
  N/A: single-phase plan with no stated cross-phase premises.
- Flag incompatible state assumptions (stateless + sessions, singleton + multi-instance).
  N/A: plan makes no architectural state assumptions (no statefulness, concurrency model, or instance-count claims).
- Flag any field, function, or constant referenced in one step that is never defined anywhere in the plan.
  N/A: plan introduces no new named fields/functions/constants whose definitions could be missing.

### Scope & Structure

- Flag over-engineering: bug fix with 5 phases, one-off operation with a reusable abstraction, single-use helper, per-file phases.
  N/A: plan is single-phase; or problem is explicitly complex (multi-service integration, architectural migration, new system) where multi-phase scope is justified.
- Flag under-specification: a "convert X to Y" step without a mapping, format, or criteria.
  N/A: no abstract-to-concrete translation steps; all outputs are trivially derivable from inputs.
- Flag scope creep: steps that address concerns beyond the stated goal.
  (Always evaluated — no N/A.)
- Flag plans that implement before defining: callers specified before the interface they call, tests before the schema they test.
  N/A: documentation-only or config-only plan with no new code constructs whose ordering could be inverted.

### Verification

- Flag verification steps with no runnable command or observable outcome. "Check that it works" is a target; "run `npm test -- auth.test.js` and confirm output matches fixture" is not.
  N/A: change is trivial (typo fix / doc edit) where correctness is self-evident with no verification needed.
- Flag logic changes with no pre-stated acceptance criteria or test strategy.
  N/A: cosmetic/doc-only change; or single-line fix where correctness is self-evident; or existing test suite explicitly confirmed as sufficient.
- Flag multi-phase plans where a later-phase failure leaves prior commits in a broken state with no acknowledgment or revert strategy.
  N/A: single-phase plan; or phases are purely additive with each phase's commit independently valid.

### Pre-read Discipline

- Flag any edit step not preceded by a read step for the same file, unless the file is being created from scratch.
  N/A: pure new-file creation with no existing files to verify; or plan modifies only documentation where current state is irrelevant.
- Flag assumed-exists conditions: steps that consume an artifact without verifying it was produced.
  N/A: single-phase plan; or no inter-phase artifact dependencies.

### Accidental Removal

- Flag removal of code that could be a live entry point: async event handlers, queue consumers, webhook handlers, scheduled triggers (GAS onEdit/doGet/doPost/onOpen, time-based triggers), exported symbols with potential external consumers, methods reached via dynamic dispatch (string-keyed lookup, reflection). Require grep or coverage evidence confirming no callers AND no external entry point registration (manifest, trigger config), or an explicit "confirmed dead via [evidence]" annotation that covers external entry points, not just internal grep.
  N/A: plan is purely additive — no code is removed, commented out, or disabled.

### Security & Error Handling

- Flag untrusted inputs crossing a trust boundary without validation. Untrusted sources include: HTTP request headers, query params, request bodies, URL path segments, user-uploaded files, third-party webhook payloads. "Crossing a trust boundary" includes flowing into: log statements (log injection / forged log lines via CRLF), shell commands, SQL/NoSQL queries, file paths, template renderers, downstream service calls.
  N/A: plan introduces or modifies no flow of untrusted input — purely internal logic, doc-only, or only handles already-validated/internal data.
- Flag outbound calls (HTTP, DB, API) without timeouts.
  N/A: no outbound external calls introduced or modified.
- Flag async operations without error handlers (.catch, try/catch, error boundary). Includes fire-and-forget patterns (`void promise()`, unawaited promises, `setTimeout` with async callback) where rejection would be silently swallowed.
  N/A: no async operations introduced or modified; all code is synchronous.
- Flag new OAuth scopes or permission additions without a note on user re-authorization impact.
  N/A: no new services, scopes, or permissions introduced.
- Flag new config keys or env vars without a startup fail-fast check.
  N/A: no new configuration dependencies introduced.

### Testing

- Flag changed signatures, new error paths, or bug fixes with no corresponding test update.
  N/A: pure visual / doc-only change; or no signature changes, new error paths, or bug fixes.
- Flag impact analysis that names affected callers but tests that cover only the changed function.
  N/A: no callers/workflows identified as affected; self-contained change.

### Git & Workflow

- Flag absence of a branch name, per-phase commit steps, push-to-remote, and merge/PR plan.
  N/A: trivial single-line change where the workflow is self-evident; or doc-only edit committed directly.
- Flag a missing post-implementation workflow section covering: `/review-fix` loop, build (if applicable), test run, and fail→fix→re-run cycle — all imperative, not optional.
  N/A: doc-only or trivial change with no build/test step that could fail.

---

## Adversarial Close

Apply this AFTER all directives above complete. Imagine the plan just passed every
directive. Now answer in writing:

1. **Fabricated quantitative evidence.** Are any quantitative claims (latency,
   throughput, "Nx faster", capacity, percentile bounds) cited to a file or benchmark
   that *no plan step produces*, or to a file that does not exist in the repo?
   List each.
2. **Phantom types/symbols.** Are any types, functions, modules, or fields referenced
   in exported signatures, public APIs, or downstream-consumer-facing surfaces
   that are *never defined* by any plan step? List each.
3. **Dual-source-of-truth.** Is there a dual-write or dual-storage pattern (two stores
   holding overlapping data) with *no reconciliation rule, source-of-truth designation,
   or staleness policy*? Describe it.
4. **Broken intermediate state.** Does any phase commit code that depends on a later
   phase's artifact (function, file, schema, build output), leaving the intermediate
   commit in a state where the codebase does not build, tests do not pass, or the
   feature is half-wired? Describe it.
5. **Implicit new toolchain.** Does the plan introduce a new language, runtime,
   compilation step, or native dependency (e.g., `.ts` source in a JS-only repo,
   a native module in a pure-JS repo, a Python script in a TS-only project) without
   a build/run/install path? Describe it.

If any answer is non-empty:
- Add a flagged issue per non-empty answer to the issues list, with the answer text
  as the issue description and "adversarial-close: <category>" as the prefix.
- Downgrade the overall verdict by one tier: `PASS` → `NEEDS_UPDATE`;
  `NEEDS_UPDATE` → `NOT READY`. Do not downgrade further than NOT READY.
- The downgrade is NOT optional. The adversarial close exists specifically to catch
  plans that pass every directive individually but fail at the plan-as-a-whole level.

If all five answers are empty, do not add anything to the output. The adversarial
close has no purchase on this plan.

**N/A condition:** documentation-only single-step plan with no code changes (TRIVIAL
tier with no executable artifacts). Examples: a one-line edit to a `.md` file with a
runnable verification step; a CLAUDE.md update that adds a directive without modifying
code. If the plan matches this profile, skip the adversarial close entirely — do not
list it in the output, do not flag anything against it.

---

## Output Format

Write a plain-prose review. Structure it as:

**Flagged Issues** — one paragraph or bullet per issue, citing the specific plan section or step. Each issue should state: what was found, why it matters, and a concrete fix or what evidence would resolve it. Adversarial-close findings are prefixed with `adversarial-close: <category>`.

**Overall Verdict** — one of: `PASS` (no blocking issues), `NEEDS_UPDATE` (one or more issues require resolution before implementation), or `NOT READY` (downgraded from NEEDS_UPDATE by an adversarial-close finding, OR plan has structural defects that one round of revision cannot resolve). Include a one-sentence rationale.

Do not use question IDs. Do not output JSON. Do not list directives you marked N/A. Do not describe what you checked — only report what you found.
