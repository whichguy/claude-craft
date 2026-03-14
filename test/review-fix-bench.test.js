const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'review-fix');

const VALID_CATEGORIES = new Set([
  'security', 'correctness', 'error-handling', 'intent',
  'minimal-change', 'react', 'gas', 'async'
]);

const VALID_SEVERITIES = new Set(['Critical', 'Advisory']);

// --- Metric computation functions (extracted for testability) ---

function computePrecision(tp, fp) {
  if (tp + fp === 0) return 0;
  return tp / (tp + fp);
}

function computeRecall(tp, fn) {
  if (tp + fn === 0) return 0;
  return tp / (tp + fn);
}

function computeF1(precision, recall) {
  if (precision + recall === 0) return 0;
  return 2 * precision * recall / (precision + recall);
}

function computeCompleteness(categoriesFound, categoriesPresent) {
  if (categoriesPresent.length === 0) return 1;
  const found = new Set(categoriesFound);
  const present = new Set(categoriesPresent);
  let matched = 0;
  for (const c of present) {
    if (found.has(c)) matched++;
  }
  return matched / present.size;
}

function computeDelta(valueA, valueB) {
  const delta = valueB - valueA;
  const absDelta = Math.abs(delta);
  if (absDelta < 0.01) return { delta, verdict: 'NEUTRAL' };
  return { delta, verdict: delta > 0 ? 'IMPROVED' : 'REGRESSED' };
}

// --- Finding matcher ---

function matchFindings(findings, groundTruth) {
  const matched = new Set();
  const truePositives = [];
  const falsePositives = [];

  // Sort findings by match confidence: line-based > category > semantic
  const scoredPairs = [];
  for (const finding of findings) {
    for (let i = 0; i < groundTruth.issues.length; i++) {
      const issue = groundTruth.issues[i];
      // (guard removed — matched is only populated during greedy selection, not pair building)

      let score = 0;
      // Line-based match (highest priority)
      if (finding.line && issue.line && Math.abs(finding.line - issue.line) <= 3) {
        score = 3;
      }
      // Category match (medium priority)
      else if (finding.category && finding.category === issue.category) {
        score = 2;
      }
      // Semantic match (lowest priority)
      else if (finding.description && issue.description) {
        const findingWords = new Set(finding.description.toLowerCase().split(/\s+/));
        const issueWords = issue.description.toLowerCase().split(/\s+/);
        const overlap = issueWords.filter(w => findingWords.has(w)).length;
        if (overlap / issueWords.length > 0.5) {
          score = 1;
        }
      }

      if (score > 0) {
        scoredPairs.push({ finding, issue, score });
      }
    }
  }

  // Greedy matching: highest score first
  scoredPairs.sort((a, b) => b.score - a.score);
  const matchedFindings = new Set();

  for (const pair of scoredPairs) {
    if (matched.has(pair.issue.id) || matchedFindings.has(pair.finding)) continue;
    matched.add(pair.issue.id);
    matchedFindings.add(pair.finding);
    truePositives.push(pair.issue.id);
  }

  for (const finding of findings) {
    if (!matchedFindings.has(finding)) {
      falsePositives.push(finding);
    }
  }

  const falseNegatives = groundTruth.issues
    .filter(issue => !matched.has(issue.id))
    .map(issue => issue.id);

  return { truePositives, falsePositives, falseNegatives };
}

// --- Test suites ---

describe('Review-Fix Bench: Fixture Validation', function () {
  this.timeout(10000);

  const groundTruthFiles = fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.ground-truth.json'));

  it('should have at least 6 ground-truth files', function () {
    expect(groundTruthFiles.length).to.be.at.least(6);
  });

  for (const gtFile of groundTruthFiles) {
    describe(gtFile, function () {
      let gt;

      before(function () {
        const raw = fs.readFileSync(path.join(FIXTURES_DIR, gtFile), 'utf-8');
        gt = JSON.parse(raw);
      });

      it('should reference an existing fixture file', function () {
        const fixturePath = path.join(FIXTURES_DIR, gt.fixture);
        expect(fs.existsSync(fixturePath), `Missing fixture: ${gt.fixture}`).to.be.true;
      });

      it('should have required top-level fields', function () {
        expect(gt).to.have.property('fixture').that.is.a('string');
        expect(gt).to.have.property('description').that.is.a('string');
        expect(gt).to.have.property('categories_present').that.is.an('array');
        expect(gt).to.have.property('issues').that.is.an('array');
        expect(gt).to.have.property('total_issues').that.is.a('number');
        expect(gt).to.have.property('false_positive_traps').that.is.an('array');
      });

      it('should have total_issues matching issues array length', function () {
        expect(gt.total_issues).to.equal(gt.issues.length);
      });

      it('should have valid categories', function () {
        for (const cat of gt.categories_present) {
          expect(VALID_CATEGORIES.has(cat), `Unknown category: ${cat}`).to.be.true;
        }
      });

      it('should have valid issue fields', function () {
        for (const issue of gt.issues) {
          expect(issue).to.have.property('id').that.is.a('string');
          expect(issue).to.have.property('line').that.is.a('number');
          expect(issue).to.have.property('category').that.is.a('string');
          expect(issue).to.have.property('severity').that.is.a('string');
          expect(issue).to.have.property('question').that.is.a('string');
          expect(issue).to.have.property('description').that.is.a('string');
          expect(issue).to.have.property('expected_fix').that.is.a('string');
          expect(VALID_SEVERITIES.has(issue.severity), `Invalid severity: ${issue.severity}`).to.be.true;
          expect(VALID_CATEGORIES.has(issue.category), `Invalid category: ${issue.category}`).to.be.true;
        }
      });

      it('should have no duplicate issue IDs', function () {
        const ids = gt.issues.map(i => i.id);
        const unique = new Set(ids);
        const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
        expect(unique.size).to.equal(ids.length, `Duplicate IDs: ${duplicates.join(', ')}`);
      });
    });
  }
});

describe('Review-Fix Bench: Metric Computation', function () {
  describe('precision', function () {
    it('should compute precision correctly', function () {
      expect(computePrecision(3, 1)).to.equal(0.75);
    });

    it('should return 0 when no findings', function () {
      expect(computePrecision(0, 0)).to.equal(0);
    });

    it('should return 1.0 for all true positives', function () {
      expect(computePrecision(5, 0)).to.equal(1.0);
    });

    it('should return 0 for all false positives', function () {
      expect(computePrecision(0, 3)).to.equal(0);
    });
  });

  describe('recall', function () {
    it('should compute recall correctly', function () {
      expect(computeRecall(3, 2)).to.equal(0.6);
    });

    it('should return 0 when no true positives and some false negatives', function () {
      expect(computeRecall(0, 5)).to.equal(0);
    });

    it('should return 1.0 for perfect recall', function () {
      expect(computeRecall(4, 0)).to.equal(1.0);
    });

    it('should return 0 when no ground truth issues', function () {
      expect(computeRecall(0, 0)).to.equal(0);
    });
  });

  describe('F1', function () {
    it('should compute F1 correctly', function () {
      const p = 0.8, r = 0.6;
      const expected = 2 * 0.8 * 0.6 / (0.8 + 0.6);
      expect(computeF1(p, r)).to.be.closeTo(expected, 0.001);
    });

    it('should return 0 when both precision and recall are 0', function () {
      expect(computeF1(0, 0)).to.equal(0);
    });

    it('should return 1.0 for perfect scores', function () {
      expect(computeF1(1.0, 1.0)).to.equal(1.0);
    });
  });

  describe('completeness', function () {
    it('should compute partial category coverage', function () {
      expect(computeCompleteness(
        ['security'],
        ['security', 'error-handling']
      )).to.equal(0.5);
    });

    it('should return 1.0 for full coverage', function () {
      expect(computeCompleteness(
        ['security', 'correctness'],
        ['security', 'correctness']
      )).to.equal(1.0);
    });

    it('should return 1.0 when no categories expected', function () {
      expect(computeCompleteness([], [])).to.equal(1.0);
    });

    it('should return 0 when no categories found', function () {
      expect(computeCompleteness(
        [],
        ['security', 'correctness']
      )).to.equal(0);
    });
  });

  describe('delta comparison', function () {
    it('should detect improvement', function () {
      const result = computeDelta(0.80, 0.90);
      expect(result.verdict).to.equal('IMPROVED');
      expect(result.delta).to.be.closeTo(0.10, 0.001);
    });

    it('should detect regression', function () {
      const result = computeDelta(0.90, 0.80);
      expect(result.verdict).to.equal('REGRESSED');
      expect(result.delta).to.be.closeTo(-0.10, 0.001);
    });

    it('should detect neutral (small difference)', function () {
      const result = computeDelta(0.90, 0.905);
      expect(result.verdict).to.equal('NEUTRAL');
    });
  });
});

describe('Review-Fix Bench: Finding Matcher', function () {
  it('should match findings by exact line', function () {
    const findings = [{ line: 12, category: 'security', description: 'SQL injection found' }];
    const gt = {
      issues: [{ id: 'SQL-1', line: 12, category: 'security', description: 'SQL injection' }],
    };
    const result = matchFindings(findings, gt);
    expect(result.truePositives).to.deep.equal(['SQL-1']);
    expect(result.falsePositives).to.have.lengthOf(0);
    expect(result.falseNegatives).to.have.lengthOf(0);
  });

  it('should match findings within ±3 line range', function () {
    const findings = [{ line: 14, category: 'correctness', description: 'null check' }];
    const gt = {
      issues: [{ id: 'NULL-1', line: 11, category: 'correctness', description: 'null deref' }],
    };
    const result = matchFindings(findings, gt);
    expect(result.truePositives).to.deep.equal(['NULL-1']);
  });

  it('should NOT match findings outside ±3 line range without category match', function () {
    const findings = [{ line: 50, category: 'intent', description: 'wrong name' }];
    const gt = {
      issues: [{ id: 'NULL-1', line: 12, category: 'correctness', description: 'null deref' }],
    };
    const result = matchFindings(findings, gt);
    expect(result.truePositives).to.have.lengthOf(0);
    expect(result.falsePositives).to.have.lengthOf(1);
    expect(result.falseNegatives).to.deep.equal(['NULL-1']);
  });

  it('should fall back to category match', function () {
    const findings = [{ line: 99, category: 'security', description: 'some issue' }];
    const gt = {
      issues: [{ id: 'SEC-1', line: 5, category: 'security', description: 'vulnerability' }],
    };
    const result = matchFindings(findings, gt);
    expect(result.truePositives).to.deep.equal(['SEC-1']);
  });

  it('should use greedy matching (no double-counting)', function () {
    const findings = [
      { line: 12, category: 'security', description: 'SQL injection in query' },
      { line: 13, category: 'security', description: 'another SQL issue' },
    ];
    const gt = {
      issues: [
        { id: 'SQL-1', line: 12, category: 'security', description: 'SQL injection' },
      ],
    };
    const result = matchFindings(findings, gt);
    expect(result.truePositives).to.deep.equal(['SQL-1']);
    expect(result.falsePositives).to.have.lengthOf(1);
  });

  it('should handle zero findings', function () {
    const findings = [];
    const gt = {
      issues: [
        { id: 'BUG-1', line: 5, category: 'correctness', description: 'bug' },
        { id: 'BUG-2', line: 10, category: 'correctness', description: 'another bug' },
      ],
    };
    const result = matchFindings(findings, gt);
    expect(result.truePositives).to.have.lengthOf(0);
    expect(result.falsePositives).to.have.lengthOf(0);
    expect(result.falseNegatives).to.deep.equal(['BUG-1', 'BUG-2']);
  });

  it('should handle zero ground truth issues', function () {
    const findings = [{ line: 5, category: 'security', description: 'false alarm' }];
    const gt = { issues: [] };
    const result = matchFindings(findings, gt);
    expect(result.truePositives).to.have.lengthOf(0);
    expect(result.falsePositives).to.have.lengthOf(1);
    expect(result.falseNegatives).to.have.lengthOf(0);
  });

  it('should use semantic match as fallback', function () {
    const findings = [{ line: 99, category: 'other', description: 'SQL injection found in query string' }];
    const gt = {
      issues: [{ id: 'SQL-1', line: 5, category: 'security', description: 'SQL injection in query' }],
    };
    const result = matchFindings(findings, gt);
    expect(result.truePositives).to.deep.equal(['SQL-1']);
  });
});
