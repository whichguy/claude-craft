---
name: gas-test-review
description: |
  Review test plans and existing tests for GAS projects using the mocha/chai test framework.

  **AUTOMATICALLY INVOKE** when:
  - "review test", "test plan", "test coverage", "validate tests"
  - File patterns: `*.test.gs`, `*.spec.gs`, `*.test.html`, `*.spec.html`
  - After qa-analyst generates specs
  - Before committing test files to GAS projects

  **NOT for:** Testing the framework itself, general JS/TS tests (use code-reviewer)
model: claude-opus-4-6
allowed-tools: all
---

# GAS Test Reviewer

Review tests written BY developers that USE the mocha/chai framework.

**Framework Version:** test-framework 2.x | **Last Updated:** 2025-01

---

## Quick Reference

### Standard Test File Template (copy-paste)

```javascript
const {describe, it, before, beforeEach, after, afterEach} = require('test-framework/mocha-adapter');
const {expect} = require('test-framework/chai-assertions');
const {createSpy, createMock} = require('test-framework/test-helpers');

describe('ModuleName', () => {
  let instance;

  beforeEach(() => {
    instance = createFreshInstance();
  });

  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      const result = instance.methodName(input);
      expect(result).to.deep.equal(expected);
    });
  });
});
```

### Master Error-Fix Table

| Error Message | Root Cause | Fix | Confidence |
|---------------|------------|-----|------------|
| "describe is not defined" | Missing import | Add `const {describe, it} = require('test-framework/mocha-adapter')` | HIGH |
| "expect is not defined" | Missing import | Add `const {expect} = require('test-framework/chai-assertions')` | HIGH |
| "expected [object] to equal [object]" | Missing `.deep` | Change to `.to.deep.equal()` | HIGH |
| "Expected function" on throw | Unwrapped function | `expect(() => fn()).to.throw()` | HIGH |
| Tests silently skipped | `.only()` present | Remove `.only()` before commit | HIGH |
| "it() must be inside describe()" | Orphaned test | Wrap in `describe()` block | HIGH |
| Tests pass alone, fail together | Shared state in `before()` | Use `beforeEach()` for fresh state | MEDIUM |
| Wrong Date.now() in later tests | Timer not restored | Add `timer.restore()` in `afterEach` | MEDIUM |
| Promise assertion never runs | Unhandled async | Return promise or use `async/await` | HIGH |

---

## Decision Algorithm

```
function determineMode(input):
  // Priority 1: File extension (most specific)
  if hasExtension(input, ['.test.gs', '.spec.gs', '.test.html', '.spec.html']):
    return TEST_AUDIT

  // Priority 2: Content patterns
  if containsCode(input, ['describe(', 'it(', 'expect(']):
    return TEST_AUDIT
  if isJson(input) and hasKey(input, 'success'):
    return RESULTS_ANALYSIS
  if containsStackTrace(input) or hasKey(input, 'error'):
    return RESULTS_ANALYSIS

  // Priority 3: Default for prose
  return PLAN_REVIEW

function determineDepth(input):
  lines = countLines(input)
  if lines < 50: return QUICK      // Surface patterns only
  if lines <= 200: return STANDARD // Full pattern validation
  return DEEP                      // Cross-reference analysis

function executeReview(input):
  mode = determineMode(input)
  depth = determineDepth(input)

  // Phase 1: Structure (all modes)
  if mode in [TEST_AUDIT, PLAN_REVIEW]:
    result1 = validateStructure(input)
    if result1.hasErrors: return stopWithFixes(result1)

  // Phase 2: Patterns (TEST_AUDIT only)
  if mode == TEST_AUDIT:
    result2 = validatePatterns(input, depth)
    if result2.highConfidenceCount > 0: flagForFixes(result2)

  // Phase 3: Coverage (TEST_AUDIT and PLAN_REVIEW)
  if mode in [TEST_AUDIT, PLAN_REVIEW]:
    result3 = analyzeCoverage(input)
    suggestImprovements(result3)

  // Phase 4: Results Analysis (RESULTS_ANALYSIS only)
  if mode == RESULTS_ANALYSIS:
    result4 = analyzeFailures(input)
    identifyRootCauses(result4)

  return computeScore(result1, result2, result3, result4)
```

---

## Framework Knowledge (Reference)

### Mocha-Adapter

| Concept | Behavior |
|---------|----------|
| `context.hasOnly` | GLOBAL flag - if ANY `.only()` exists, ALL other tests skip |
| Hook inheritance | `beforeEach/afterEach` accumulate from ancestors; `before/after` don't |
| Hook failure | `before()` failure skips all suite tests; `afterEach()` failure logged only |
| Grep filtering | Case-insensitive, matches test OR parent suite name |

### Chai-Assertions

| Chain | Effect |
|-------|--------|
| `.to`, `.be`, `.have` | Pass-through (readability only) |
| `.deep` | Sets `useDeepEqual = true` for next assertion |
| `.not` | Toggles negated flag (can double-negate!) |

### Async Patterns

**WRONG - Promise assertion may not run:**
```javascript
it('fetches data', () => {
  fetchData().then(result => {
    expect(result).to.exist;  // May not execute before test ends!
  });
});
```

**CORRECT - Return promise:**
```javascript
it('fetches data', () => {
  return fetchData().then(result => {
    expect(result).to.exist;
  });
});
```

**CORRECT - Async/await:**
```javascript
it('fetches data', async () => {
  const result = await fetchData();
  expect(result).to.exist;
});
```

---

## PHASE 1: Structure Validation (Gate 1)

**Question:** Can this test file execute?

### Checks by Depth

| Check | Quick | Standard | Deep |
|-------|-------|----------|------|
| Mocha import present | Y | Y | Y |
| Chai import present | Y | Y | Y |
| No orphaned `it()` outside `describe()` | Y | Y | Y |
| File naming convention | | Y | Y |
| Self-contained (no external state) | | Y | Y |
| Cross-file dependency analysis | | | Y |

### WIP Detection

If test contains `// TODO`, `// FIXME`, `// WIP`, `it.skip()` without explanation, or empty `it()` blocks:
- Flag as incomplete, do NOT fail structure gate
- Report: "WIP detected: N incomplete tests"
- Suggest: "Complete TODO items before final review"

### Gate 1 Exit Criteria

```
IF structure_errors > 0:
  -> Status: FAIL
  -> Action: STOP, report fixes, do NOT proceed
  -> Provide copy-paste fix from template above
ELSE:
  -> Status: PASS
  -> Proceed to Phase 2
```

### Verification Command

```javascript
exec({scriptId, js_statement: `
  const mocha = require('test-framework/mocha-adapter');
  mocha.resetContext();
  require('${testFilePath}');  // <-- Replace with actual path from triage
  const ctx = mocha.getContext();
  return {
    suiteCount: ctx.rootSuites.length,
    testCount: ctx.rootSuites.reduce((sum, s) => sum + s.tests.length, 0),
    hasOrphanedTests: ctx.currentSuite !== null
  };
`})
```

---

## PHASE 2: Pattern Validation (Gate 2)

**Question:** Are framework features used correctly?

### Pattern Checks (Consolidated Table)

| Pattern | Wrong | Correct | Confidence |
|---------|-------|---------|------------|
| `.only()` in code | `it.only('test')` | `it('test')` | HIGH |
| Shared state | `before(() => data = {...})` | `beforeEach(() => data = {...})` | MEDIUM |
| Object equality | `.to.equal({a:1})` | `.to.deep.equal({a:1})` | HIGH |
| Throw assertion | `expect(fn).to.throw()` | `expect(() => fn()).to.throw()` | HIGH |
| Generic throw | `.to.throw()` | `.to.throw(/specific error/i)` | MEDIUM |
| Async without return | `it('x', () => { promise.then() })` | `it('x', async () => { await promise })` | HIGH |
| Timer not cleaned | No `afterEach` restore | `afterEach(() => timer.restore())` | MEDIUM |
| Real GAS in unit test | `SpreadsheetApp.getActive()` | `createMock({...})` | MEDIUM |

### Gate 2 Exit Criteria

```
count_high = count(issues where confidence == HIGH)
count_medium = count(issues where confidence == MEDIUM)

IF count_high > 0:
  -> Status: NEEDS_FIXES
  -> Action: HIGH confidence issues must be fixed
  -> Do NOT proceed to Phase 3 until fixed
ELSE IF count_medium > 3:
  -> Status: REVIEW_RECOMMENDED
  -> Action: Proceed but flag for human review
ELSE:
  -> Status: PASS
  -> Proceed to Phase 3
```

### Verification Command

```javascript
exec({scriptId, js_statement: `
  const mocha = require('test-framework/mocha-adapter');
  mocha.resetContext();
  require('${testFilePath}');
  const ctx = mocha.getContext();
  return {
    hasOnly: ctx.hasOnly,  // Should be false before commit
    suiteCount: ctx.rootSuites.length
  };
`})
```

---

## PHASE 3: Coverage Analysis (Gate 3)

**Question:** Is test coverage sufficient?

### Coverage Checklist

| Category | Check | Priority |
|----------|-------|----------|
| Happy Path | At least one test for primary success case | HIGH |
| Happy Path | Return values actually asserted (not just called) | HIGH |
| Error Handling | Error conditions tested | HIGH |
| Error Handling | Error messages specific (regex match) | MEDIUM |
| Edge Cases | null/undefined inputs | MEDIUM |
| Edge Cases | Empty collections ([], {}, '') | MEDIUM |
| Edge Cases | Boundary values (0, -1, max) | LOW |

### Test Naming Convention

**Prefer:** `should [expected behavior] when [condition]`
- `should return empty array when input is empty`
- `should throw error when parameter is null`

**Avoid:** `test1`, `works`, `basic test` (non-descriptive)

### Suggesting Missing Tests

Provide ready-to-use code:

```javascript
// SUGGESTED: Edge case for empty array
it('should return empty array when given empty input', () => {
  const result = processData([]);
  expect(result).to.deep.equal([]);
});

// SUGGESTED: Error case for null
it('should throw descriptive error for null input', () => {
  expect(() => processData(null)).to.throw(/input.*required/i);
});
```

### Gate 3 Exit Criteria

```
coverage_score = calculate based on checklist above

IF missing happy path OR missing error handling:
  -> Status: NEEDS_FIXES
  -> Action: "Add critical tests before proceeding"
ELSE IF missing edge cases:
  -> Status: PASS_WITH_WARNINGS
  -> Action: "Consider adding edge case tests"
ELSE:
  -> Status: PASS
  -> Action: "Coverage sufficient"
```

---

## PHASE 4: Results Analysis (RESULTS_ANALYSIS mode only)

**Question:** Why did tests fail?

### Failure Categorization

| Failure Type | Indicators | Action |
|--------------|------------|--------|
| Assertion failure | `expected X to equal Y` | Check test logic or implementation bug |
| Setup failure | Error in `before/beforeEach` | Fix hook, verify dependencies |
| Timeout | `execution time exceeded` | Add async handling or increase timeout |
| Service error | `Service invoked too many times` | Add retry logic or mock service |
| Import error | `Cannot find module` | Check require path, verify file exists |

### Flaky Test Detection

**Indicators:**
- Same test fails intermittently (different results on retry)
- Timing-dependent assertions (`Date.now()`, `setTimeout`)
- External service dependencies (UrlFetchApp, SpreadsheetApp)

**Solution:**
```javascript
const {retryFlaky} = require('test-framework/test-helpers');

it('flaky external call', () => retryFlaky(() => {
  const result = callExternalService();
  expect(result).to.exist;
}, 3));  // 3 attempts with exponential backoff
```

### Root Cause Analysis Output

```
## Failure Analysis

| Test | Error | Category | Root Cause | Suggested Fix |
|------|-------|----------|------------|---------------|
| [test name] | [error msg] | [type] | [analysis] | [fix] |
```

---

## WHAT NOT TO FLAG (Valid Patterns)

| Pattern | Why It's Valid |
|---------|----------------|
| `describe.skip('WIP')` with `// TODO` | Intentional skip |
| `it.only()` with `// FOCUS` comment | Debugging (warn before commit) |
| Empty `beforeEach/afterEach` | Placeholder for future setup |
| Deeply nested `describe()` | Valid for complex modules |
| `expect(primitive).to.equal(primitive)` | Reference equality OK for primitives |
| `expect(undefined).to.be.undefined` | Preferred over `.equal(undefined)` |
| Multiple assertions in one `it()` | Acceptable for related checks |
| No `module.exports` in test file | Tests register via describe() |
| `require()` at top of test file | Test files aren't CommonJS modules |
| Real GAS services in `.integration.test` | Expected in integration tests |
| `// @skip-review` comment | Developer explicitly marked |

---

## Quality Score Calculation

```
score = 100
score -= (structure_errors * 30)      // Critical blockers
score -= (high_confidence_issues * 15) // Must fix
score -= (medium_confidence_issues * 5) // Should fix
score -= (coverage_gaps * 10)          // Missing tests
score += (wip_items * 0)               // WIP doesn't penalize, just noted

Final Rating:
  90-100: EXCELLENT - Ready to merge
  70-89:  GOOD - Minor improvements suggested
  50-69:  FAIR - Fixes needed before merge
  <50:    POOR - Significant rework required
```

---

## Output Format

### Triage (always first)

```
## Triage

| Field | Value |
|-------|-------|
| Input Type | [TEST_AUDIT/PLAN_REVIEW/RESULTS_ANALYSIS] |
| Files | [count] |
| Lines | [count] |
| Depth | [QUICK/STANDARD/DEEP] |
| WIP Items | [count or "none"] |
```

### Gate Summary

```
## Gates

| Gate | Status | Issues |
|------|--------|--------|
| Structure | PASS/FAIL | [n] |
| Patterns | PASS/WARN/FAIL | [n high]/[n medium] |
| Coverage | COMPLETE/GAPS | [n gaps] |
```

### Final Recommendation

```
## Result

**Score:** [0-100] ([EXCELLENT/GOOD/FAIR/POOR])
**Status:** [PASS/PASS_WITH_WARNINGS/NEEDS_FIXES]

**Next Action:** [specific instruction]

**Verification:**
exec({scriptId, js_statement: `runner.runTestFile('${testFilePath}')`})
```

---

## Skill Chain

| When | Skill | Purpose |
|------|-------|---------|
| Before | `qa-analyst` | Generates test specs for this skill to review |
| Parallel | `gas-code-review` | Review implementation alongside tests |
| After (PASS) | `exec()` | Run tests via test-runner |
| After (FAIL) | Return to developer | Fix issues and re-review |
