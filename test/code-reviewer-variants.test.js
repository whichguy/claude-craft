const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const REPO_DIR = path.resolve(__dirname, '..');
const BASELINE = path.join(REPO_DIR, 'agents', 'code-reviewer.md');
const VARIANTS_DIR = path.join(REPO_DIR, 'agents', 'variants');

const VARIANTS = [
  { file: 'code-reviewer-t70.md', threshold: 70 },
  { file: 'code-reviewer-t75.md', threshold: 75 },
  { file: 'code-reviewer-t80.md', threshold: 80 },
  { file: 'code-reviewer-t85.md', threshold: 85 },
];

describe('code-reviewer variants', function () {
  const baselineLines = fs.readFileSync(BASELINE, 'utf8').split('\n');

  for (const { file, threshold } of VARIANTS) {
    const variantPath = path.join(VARIANTS_DIR, file);

    describe(file, function () {
      it('exists', function () {
        expect(fs.existsSync(variantPath), `missing ${variantPath}`).to.be.true;
      });

      if (!fs.existsSync(variantPath)) return;
      const variantLines = fs.readFileSync(variantPath, 'utf8').split('\n');

      it('differs from baseline by only name and threshold', function () {
        const diffs = [];
        const maxLen = Math.max(baselineLines.length, variantLines.length);
        for (let i = 0; i < maxLen; i++) {
          const b = baselineLines[i] || '';
          const v = variantLines[i] || '';
          if (b !== v) diffs.push({ line: i + 1, baseline: b, variant: v });
        }
        // t75 (identity control) differs only by name (1 line);
        // t70/t80/t85 differ by name + threshold (2 lines)
        const expectedDiffs = threshold === 75 ? 1 : 2;
        expect(diffs.length, `expected ${expectedDiffs} diff(s), got ${diffs.length}: ${diffs.map(d => d.line).join(',')}`).to.equal(expectedDiffs);
      });

      it('name field matches variant filename', function () {
        const nameLine = variantLines.find(l => l.startsWith('name:'));
        expect(nameLine, 'no name field found').to.not.be.undefined;
        expect(nameLine).to.equal(`name: code-reviewer-t${threshold}`);
      });

      it('threshold line contains Confidence >= <threshold>', function () {
        const thresholdLine = variantLines.find(l => l.includes('Confidence >='));
        expect(thresholdLine, 'no Confidence >= line found').to.not.be.undefined;
        expect(thresholdLine).to.include(`Confidence >= ${threshold}`);
      });
    });
  }
});