# Plan: Document `test:bench` Target in CLAUDE.md Test List

## Context
`CLAUDE.md` line 24 enumerates the project's `npm test` targets. The `test:bench`
target exists in `package.json` (`"test:bench": "mocha test/review-fix-bench.test.js --timeout 10000"`)
but is missing from this human-facing list, so contributors don't discover it.

## Approach
Append `test:bench` to the existing pipe-separated list. One-line doc edit; no
behavior change, no new code, no new dependencies.

## Expected Outcome
The test-target list in CLAUDE.md matches the targets defined in package.json
(specifically, `test:bench` is present).

## Implementation
Edit `/Users/dadleet/claude-craft/CLAUDE.md` line 24.
- Current: `` `npm test` (all) | `test:sync` | `test:security` | `test:knowledge` | `test:backup` | `test:watch` | `test:coverage` ``
- New:     `` `npm test` (all) | `test:sync` | `test:security` | `test:knowledge` | `test:backup` | `test:watch` | `test:coverage` | `test:bench` ``

## Verification
Run `grep -n 'test:bench' /Users/dadleet/claude-craft/CLAUDE.md` — must return a match on line 24.

## Git Lifecycle
1. `git checkout -b docs/claude-md-test-bench`
2. `git add CLAUDE.md && git commit -m "docs: add test:bench to CLAUDE.md test-target list"`
3. `git push -u origin docs/claude-md-test-bench` and open PR
