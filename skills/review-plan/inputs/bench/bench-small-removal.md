---
title: "Simplify review completion flow: remove recheck_prompt helper"
tier_hint: SMALL
intent_questions: true
---

## Context

The `recheck_prompt` helper in `lib/review/runner.js` was introduced to encapsulate
re-evaluation prompt construction after NEEDS_UPDATE findings. Profiling shows it is
called from exactly one call site, and its logic is simple enough (3 lines) to inline
without loss of clarity. The function adds indirection with no reuse benefit.

This plan removes `recheck_prompt` and inlines its logic at the single call site.

## Scope

- `lib/review/runner.js` — 1 file changed

## Implementation steps

1. Read `lib/review/runner.js` in full to confirm `recheck_prompt` is called from only
   one location.
2. Remove the `recheck_prompt` function definition (lines 87–91, approximately):
   ```js
   function recheck_prompt(questions, prior_results) {
     return `Re-evaluate these questions given prior findings:\n${prior_results}\nQuestions: ${questions}`;
   }
   ```
3. At the single call site (approximately line 134), replace the call
   `buildPrompt(recheck_prompt(re_eval_q, prev_findings))` with the inlined form:
   ```js
   buildPrompt(`Re-evaluate these questions given prior findings:\n${prev_findings}\nQuestions: ${re_eval_q}`)
   ```
4. Run unit tests: `npm test lib/review/runner.test.js`.

## Verification

- `grep -n recheck_prompt lib/review/runner.js` returns zero matches.
- `npm test` passes.

## Git lifecycle

- Branch: `refactor/inline-recheck-prompt`
- Commit: `refactor(review): inline recheck_prompt — remove single-use helper`
- PR → squash merge → delete branch per CLAUDE.md POST_IMPLEMENT.
