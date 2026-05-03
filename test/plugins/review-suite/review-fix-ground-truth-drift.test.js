const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, '../../../test/fixtures', 'review-fix');
const LINE_TOLERANCE = 3;

// Stopwords: prose-only or too-generic tokens that won't help locate a line
const STOPWORDS = new Set([
  'the', 'and', 'with', 'used', 'should', 'check', 'pass', 'field', 'value',
  'this', 'that', 'from', 'into', 'when', 'then', 'there', 'have', 'has',
  'not', 'but', 'for', 'are', 'was', 'were', 'will', 'can', 'code', 'line',
  'lines', 'block', 'call', 'function', 'method', 'variable', 'use',
  'should', 'missing', 'left', 'over', 'using', 'instead', 'without',
  'return', 'returns', 'type', 'types', 'error', 'errors', 'name',
  'parameter', 'parameters', 'argument', 'arguments', 'result', 'production',
  'path', 'paths', 'reassigned', 'never', 'routed', 'route', 'routes',
  'logger', 'style', 'category', 'severity', 'description', 'fix', 'fixes',
  'commented', 'comment', 'comments', 'out', 'via', 'more', 'less', 'than',
  'one', 'two', 'three', 'four', 'five'
]);

const TOKEN_RE = /\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g;

function extractTokens(description) {
  if (!description) return [];
  const seen = new Set();
  const out = [];
  for (const t of description.match(TOKEN_RE) || []) {
    if (STOPWORDS.has(t.toLowerCase())) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// Pick the token that produces the closest-to-target match in source.
// Prefers tokens that actually appear somewhere in the fixture (skip abstract
// prose concepts like "User", "Nullish"). Returns null if no token is found
// in source — caller treats as skip with DEBUG.
function findBestToken(sourceLines, tokens, targetLine) {
  let best = null;
  for (const t of tokens) {
    let nearest = -1;
    let minDist = Infinity;
    for (let i = 0; i < sourceLines.length; i++) {
      if (sourceLines[i].includes(t)) {
        const dist = Math.abs((i + 1) - targetLine);
        if (dist < minDist) { minDist = dist; nearest = i + 1; }
      }
    }
    if (nearest > 0 && (!best || minDist < best.dist)) {
      best = { token: t, line: nearest, dist: minDist };
    }
  }
  return best;
}

describe('ground-truth line drift linter', function () {
  const gtFiles = fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.ground-truth.json'));

  expect(gtFiles.length, 'at least one ground-truth fixture').to.be.greaterThan(0);

  for (const gtFile of gtFiles) {
    describe(gtFile, function () {
      const gtPath = path.join(FIXTURES_DIR, gtFile);
      const gt = JSON.parse(fs.readFileSync(gtPath, 'utf8'));
      const fixturePath = path.join(FIXTURES_DIR, gt.fixture);

      it('fixture source exists', function () {
        expect(fs.existsSync(fixturePath), `missing fixture ${gt.fixture}`).to.be.true;
      });

      if (!fs.existsSync(fixturePath)) return;
      const source = fs.readFileSync(fixturePath, 'utf8').split(/\r?\n/);

      for (const issue of gt.issues || []) {
        const line = issue.line;
        if (typeof line !== 'number' || line <= 0) continue;

        const tokens = extractTokens(issue.description);
        if (tokens.length === 0) {
          it(`issue ${issue.id}: skipped (no usable tokens)`, function () {
            console.log(`DEBUG: ${gtFile} issue ${issue.id} description has no non-stopword token ≥3 chars`);
          });
          continue;
        }

        it(`issue ${issue.id}: description tokens locate line ${line}`, function () {
          const best = findBestToken(source, tokens, line);
          if (!best) {
            console.log(`DEBUG: ${gtFile} issue ${issue.id} — none of [${tokens.join(', ')}] appear in source; skipping`);
            return;
          }
          expect(
            best.dist,
            `fixture ${gt.fixture}: issue ${issue.id} claims line ${line}, nearest "${best.token}" at line ${best.line} (drift ${best.dist} > ${LINE_TOLERANCE})`
          ).to.be.at.most(LINE_TOLERANCE);
        });
      }
    });
  }
});
