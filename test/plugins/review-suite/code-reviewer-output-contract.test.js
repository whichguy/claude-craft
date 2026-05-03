const { expect } = require('chai');

// --- Fix-block contract test for code-reviewer output format ---
// Validates that review-fix's Finding Parser correctly handles:
// 1. Well-formed Critical findings with Fix blocks
// 2. Advisory findings without Fix blocks
// 3. Advisory/YAGNI findings without Fix blocks
// 4. Malformed Fix blocks (missing After: delimiter)

describe('code-reviewer output contract', function () {
  // Regex extracted from review-fix.md Finding Parser (Step 3 → Step 4)
  const Q_PATTERN = /\*\*Q(\d+):?\s*[^*]*\*\*\s*\|\s*Finding:\s*(Critical|Advisory\/YAGNI|Advisory|None)/gi;
  const FIX_BEFORE = /Before:\s*```[\s\S]*?```\s*([\s\S]*?)(?=After:|$)/gi;
  const FIX_AFTER = /After:\s*```[\s\S]*?```\s*([\s\S]*?)(?=\*\*Q\d|\Z|$)/gi;
  const LOOP_DIRECTIVE = /LOOP_DIRECTIVE:\s*(APPLY_AND_RECHECK|COMPLETE)/;

  // Synthetic code-reviewer output — well-formed
  const WELL_FORMED_OUTPUT = `
## Code Review: example.ts
Context: test | 37 questions (4 safety + 33 quality)

### Findings

**Q5: Minimal Change** | Finding: Advisory/YAGNI | Confidence: 80
> var used where const suffices
Evidence: example.ts:10
Nuance: style preference, not a bug

**Q1: Correctness** | Finding: Critical | Confidence: 95
> Null dereference on getUser() return
Evidence: example.ts:42
Counter: getUser() may never return null in practice
Nuance: API docs say nullable but all call sites pass valid IDs
Fix:
Before:
\`\`\`
const user = getUser(id);
console.log(user.name);
\`\`\`
After:
\`\`\`
const user = getUser(id);
if (user) console.log(user.name);
\`\`\`

**Q17: Naming** | Finding: Advisory | Confidence: 85
> Variable name unclear
Evidence: example.ts:15

### Positive Observations

- Good error handling in the main path

### Decision

╔══════════════════════════════════════════════════════╗
║      ██████ ██████ ██████ ░░░░░░ ░░░░░░ ░░░░░░       ║
║                                                      ║
║         review-fix Scorecard                          ║
║                                                      ║
║         Status: NEEDS_REVISION                       ║
╚══════════════════════════════════════════════════════╝
1 Critical, 1 Advisory, 1 Advisory/YAGNI

LOOP_DIRECTIVE: APPLY_AND_RECHECK
`;

  // Synthetic output — malformed Fix block (missing After: delimiter)
  const MALFORMED_FIX_OUTPUT = `
## Code Review: broken.ts

**Q1: Correctness** | Finding: Critical | Confidence: 90
> Off-by-one error
Evidence: broken.ts:5
Fix:
Before:
\`\`\`
for (let i = 0; i <= arr.length; i++) {
\`\`\`
No After: delimiter present — this is a malformed Fix block.

LOOP_DIRECTIVE: APPLY_AND_RECHECK
`;

  describe('well-formed output', function () {
    it('extracts Q-IDs and severities', function () {
      const matches = [...WELL_FORMED_OUTPUT.matchAll(Q_PATTERN)];
      expect(matches).to.have.length(3);
      expect(matches[0][1]).to.equal('5');
      expect(matches[0][2]).to.equal('Advisory/YAGNI');
      expect(matches[1][1]).to.equal('1');
      expect(matches[1][2]).to.equal('Critical');
      expect(matches[2][1]).to.equal('17');
      expect(matches[2][2]).to.equal('Advisory');
    });

    it('extracts Fix block Before and After', function () {
      // Find the Q1 Critical section with Fix block
      const q1Start = WELL_FORMED_OUTPUT.indexOf('**Q1:');
      const q17Start = WELL_FORMED_OUTPUT.indexOf('**Q17:');
      const q1Section = WELL_FORMED_OUTPUT.substring(q1Start, q17Start);

      const beforeMatch = /Before:\s*```\s*([\s\S]*?)```/i.exec(q1Section);
      const afterMatch = /After:\s*```\s*([\s\S]*?)```/i.exec(q1Section);

      expect(beforeMatch).to.not.be.null;
      expect(afterMatch).to.not.be.null;
      expect(beforeMatch[1].trim()).to.include('getUser(id)');
      expect(afterMatch[1].trim()).to.include('if (user)');
    });

    it('extracts LOOP_DIRECTIVE', function () {
      const match = LOOP_DIRECTIVE.exec(WELL_FORMED_OUTPUT);
      expect(match).to.not.be.null;
      expect(match[1]).to.equal('APPLY_AND_RECHECK');
    });

    it('Advisory/YAGNI has no Fix block', function () {
      const q5Start = WELL_FORMED_OUTPUT.indexOf('**Q5:');
      const q1Start = WELL_FORMED_OUTPUT.indexOf('**Q1:');
      const q5Section = WELL_FORMED_OUTPUT.substring(q5Start, q1Start);

      const hasFix = /Before:|After:/i.test(q5Section);
      expect(hasFix).to.be.false;
    });

    it('Advisory without YAGNI has no Fix block in this example', function () {
      // Q17 Advisory without explicit Fix block
      const q17Start = WELL_FORMED_OUTPUT.indexOf('**Q17:');
      const positiveStart = WELL_FORMED_OUTPUT.indexOf('### Positive Observations');
      const q17Section = WELL_FORMED_OUTPUT.substring(q17Start, positiveStart);

      const hasFix = /Before:|After:/i.test(q17Section);
      expect(hasFix).to.be.false;
    });
  });

  describe('malformed Fix block', function () {
    it('missing After: delimiter produces null Fix block', function () {
      const beforeMatch = /Before:\s*```\s*([\s\S]*?)```/i.exec(MALFORMED_FIX_OUTPUT);
      const afterMatch = /After:\s*```\s*([\s\S]*?)```/i.exec(MALFORMED_FIX_OUTPUT);

      expect(beforeMatch).to.not.be.null;  // Before: is present
      expect(afterMatch).to.be.null;        // After: is missing → malformed
    });
  });
});