'use strict';

/**
 * Tests for compare-prompts skill logic:
 * - File-artifact resolution (Step 3)
 * - Judge response parsing (Step 4)
 * - Criterion tally aggregation (Step 5)
 * - Verdict mapping (Step 5)
 */

const { assert } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers extracted from SKILL.md logic (pure JS for testability)
// ---------------------------------------------------------------------------

/**
 * File-artifact resolution logic from Step 3.
 * Returns { resolvedOutput, artifactPath } where artifactPath is null if no artifact detected.
 * If file read fails, returns original text (does not throw).
 */
function resolveFileArtifact(rawOutput, readFile) {
  const stripped = rawOutput.trim();

  // Pattern 1: "COMPLETE: /path/to/file BYTES SECONDS"
  const p1 = rawOutput.match(/^COMPLETE:\s+(\/\S+)/m);
  if (p1) {
    const filePath = p1[1];
    try {
      return { resolvedOutput: readFile(filePath), artifactPath: filePath };
    } catch (_) {
      return { resolvedOutput: rawOutput, artifactPath: filePath, readFailed: true };
    }
  }

  // Pattern 2: "Output written to /path/to/file" or "output written to: /path"
  const p2 = rawOutput.match(/[Oo]utput written to[:\s]+(\/\S+)/m);
  if (p2) {
    const filePath = p2[1];
    try {
      return { resolvedOutput: readFile(filePath), artifactPath: filePath };
    } catch (_) {
      return { resolvedOutput: rawOutput, artifactPath: filePath, readFailed: true };
    }
  }

  // Pattern 3: bare file path (entire trimmed output is a single /... path)
  if (/^\/\S+$/.test(stripped)) {
    const filePath = stripped;
    try {
      return { resolvedOutput: readFile(filePath), artifactPath: filePath };
    } catch (_) {
      return { resolvedOutput: rawOutput, artifactPath: filePath, readFailed: true };
    }
  }

  return { resolvedOutput: rawOutput, artifactPath: null };
}

/**
 * Parse judge JSON response. Returns { scores, winner, reasoning }.
 * Gracefully handles missing `scores` key.
 */
function parseJudgeResponse(jsonText) {
  const result = JSON.parse(jsonText);
  return {
    scores: result.scores || null,
    winner: result.winner || 'TIE',
    reasoning: result.reasoning || '',
  };
}

/**
 * Build criterion tallies from an array of judge results.
 * Each result is { scores: {...7 keys...}, winner, reasoning }.
 * Results with null scores are skipped for criterion tallies.
 */
const CRITERION_KEYS = [
  'task_adherence',
  'factual_accuracy',
  'completeness',
  'instruction_following',
  'structural_clarity',
  'precision',
  'conciseness',
];

function buildCriterionTallies(judgeResults) {
  const tallies = {};
  for (const key of CRITERION_KEYS) {
    tallies[key] = { a: 0, b: 0, tie: 0 };
  }

  for (const result of judgeResults) {
    if (!result.scores) continue;
    for (const key of CRITERION_KEYS) {
      const score = result.scores[key];
      if (score === 'A') tallies[key].a += 1;
      else if (score === 'B') tallies[key].b += 1;
      else tallies[key].tie += 1;
    }
  }
  return tallies;
}

/**
 * Map overall_winner to verdict label.
 */
function mapVerdict(overallWinner) {
  if (overallWinner === 'A') return 'REGRESSED';
  if (overallWinner === 'B') return 'IMPROVED';
  return 'NEUTRAL';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compare-prompts: file-artifact resolution', () => {
  let tmpDir;
  let tmpFile;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-test-'));
    tmpFile = path.join(tmpDir, 'output.txt');
    fs.writeFileSync(tmpFile, 'resolved file contents');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const realReadFile = (p) => fs.readFileSync(p, 'utf8');

  it('resolves COMPLETE: /path/to/file format', () => {
    const raw = `COMPLETE: ${tmpFile} 1234 5`;
    const { resolvedOutput, artifactPath } = resolveFileArtifact(raw, realReadFile);
    assert.equal(resolvedOutput, 'resolved file contents');
    assert.equal(artifactPath, tmpFile);
  });

  it('resolves "Output written to /path" format', () => {
    const raw = `Output written to ${tmpFile}`;
    const { resolvedOutput, artifactPath } = resolveFileArtifact(raw, realReadFile);
    assert.equal(resolvedOutput, 'resolved file contents');
    assert.equal(artifactPath, tmpFile);
  });

  it('resolves "output written to: /path" format (lowercase, colon)', () => {
    const raw = `output written to: ${tmpFile}`;
    const { resolvedOutput, artifactPath } = resolveFileArtifact(raw, realReadFile);
    assert.equal(resolvedOutput, 'resolved file contents');
    assert.equal(artifactPath, tmpFile);
  });

  it('resolves bare file path (single line starting with /)', () => {
    const raw = tmpFile;
    const { resolvedOutput, artifactPath } = resolveFileArtifact(raw, realReadFile);
    assert.equal(resolvedOutput, 'resolved file contents');
    assert.equal(artifactPath, tmpFile);
  });

  it('keeps original text when file read fails (COMPLETE format)', () => {
    const raw = 'COMPLETE: /tmp/nonexistent-cp-test-xyz.txt 99 1';
    const { resolvedOutput, readFailed } = resolveFileArtifact(raw, realReadFile);
    assert.equal(resolvedOutput, raw);
    assert.isTrue(readFailed);
  });

  it('keeps original text when file read fails (bare path)', () => {
    const raw = '/tmp/nonexistent-cp-test-xyz.txt';
    const { resolvedOutput, readFailed } = resolveFileArtifact(raw, realReadFile);
    assert.equal(resolvedOutput, raw);
    assert.isTrue(readFailed);
  });

  it('keeps original text when file read fails (Output written to format)', () => {
    const raw = 'Output written to /tmp/nonexistent-cp-test-xyz.txt';
    const { resolvedOutput, readFailed } = resolveFileArtifact(raw, realReadFile);
    assert.equal(resolvedOutput, raw);
    assert.isTrue(readFailed);
  });

  it('returns original text unchanged when no artifact pattern matches', () => {
    const raw = 'This is a normal response with no file reference.';
    const { resolvedOutput, artifactPath } = resolveFileArtifact(raw, realReadFile);
    assert.equal(resolvedOutput, raw);
    assert.isNull(artifactPath);
  });

  it('does not match multi-line output as bare path', () => {
    const raw = '/tmp/some/file.txt\nextra content on second line';
    const { artifactPath } = resolveFileArtifact(raw, realReadFile);
    // multi-line: stripped doesn't match /^\/\S+$/ because of the newline
    assert.isNull(artifactPath);
  });
});

describe('compare-prompts: judge response parsing', () => {
  it('parses valid 7-key scores object', () => {
    const json = JSON.stringify({
      scores: {
        task_adherence: 'B',
        factual_accuracy: 'TIE',
        completeness: 'B',
        instruction_following: 'B',
        structural_clarity: 'B',
        precision: 'A',
        conciseness: 'A',
      },
      winner: 'B',
      reasoning: 'B wins on most criteria.',
    });
    const result = parseJudgeResponse(json);
    assert.equal(result.winner, 'B');
    assert.equal(result.scores.task_adherence, 'B');
    assert.equal(result.scores.precision, 'A');
    assert.equal(result.scores.conciseness, 'A');
    assert.equal(result.reasoning, 'B wins on most criteria.');
  });

  it('falls back gracefully when scores key is missing', () => {
    const json = JSON.stringify({ winner: 'A', reasoning: 'A is better.' });
    const result = parseJudgeResponse(json);
    assert.equal(result.winner, 'A');
    assert.isNull(result.scores);
  });

  it('defaults winner to TIE when winner key is missing', () => {
    const json = JSON.stringify({ reasoning: 'unclear' });
    const result = parseJudgeResponse(json);
    assert.equal(result.winner, 'TIE');
  });

  it('throws on completely malformed JSON (caller handles try/catch)', () => {
    assert.throws(() => parseJudgeResponse('not json at all'));
  });
});

describe('compare-prompts: criterion tally aggregation', () => {
  it('accumulates tallies correctly across multiple results', () => {
    const results = [
      {
        scores: {
          task_adherence: 'A',
          factual_accuracy: 'B',
          completeness: 'B',
          instruction_following: 'TIE',
          structural_clarity: 'A',
          precision: 'A',
          conciseness: 'B',
        },
        winner: 'A',
      },
      {
        scores: {
          task_adherence: 'B',
          factual_accuracy: 'B',
          completeness: 'B',
          instruction_following: 'B',
          structural_clarity: 'B',
          precision: 'TIE',
          conciseness: 'A',
        },
        winner: 'B',
      },
      {
        scores: {
          task_adherence: 'TIE',
          factual_accuracy: 'A',
          completeness: 'A',
          instruction_following: 'A',
          structural_clarity: 'TIE',
          precision: 'B',
          conciseness: 'TIE',
        },
        winner: 'TIE',
      },
    ];

    const tallies = buildCriterionTallies(results);

    // task_adherence: A, B, TIE
    assert.deepEqual(tallies.task_adherence, { a: 1, b: 1, tie: 1 });
    // factual_accuracy: B, B, A
    assert.deepEqual(tallies.factual_accuracy, { a: 1, b: 2, tie: 0 });
    // completeness: B, B, A
    assert.deepEqual(tallies.completeness, { a: 1, b: 2, tie: 0 });
    // instruction_following: TIE, B, A
    assert.deepEqual(tallies.instruction_following, { a: 1, b: 1, tie: 1 });
    // structural_clarity: A, B, TIE
    assert.deepEqual(tallies.structural_clarity, { a: 1, b: 1, tie: 1 });
    // precision: A, TIE, B
    assert.deepEqual(tallies.precision, { a: 1, b: 1, tie: 1 });
    // conciseness: B, A, TIE
    assert.deepEqual(tallies.conciseness, { a: 1, b: 1, tie: 1 });
  });

  it('skips results with null scores (malformed judge response)', () => {
    const results = [
      { scores: null, winner: 'TIE' },
      {
        scores: {
          task_adherence: 'A',
          factual_accuracy: 'A',
          completeness: 'A',
          instruction_following: 'A',
          structural_clarity: 'A',
          precision: 'A',
          conciseness: 'A',
        },
        winner: 'A',
      },
    ];

    const tallies = buildCriterionTallies(results);

    // Only the second result counts
    for (const key of CRITERION_KEYS) {
      assert.equal(tallies[key].a, 1, `${key}.a should be 1`);
      assert.equal(tallies[key].b, 0, `${key}.b should be 0`);
      assert.equal(tallies[key].tie, 0, `${key}.tie should be 0`);
    }
  });

  it('returns all-zero tallies when no results have scores', () => {
    const tallies = buildCriterionTallies([
      { scores: null, winner: 'A' },
      { scores: null, winner: 'B' },
    ]);
    for (const key of CRITERION_KEYS) {
      assert.deepEqual(tallies[key], { a: 0, b: 0, tie: 0 });
    }
  });

  it('tally counts sum to N for each criterion (N = number of valid results)', () => {
    const N = 5;
    const results = Array.from({ length: N }, (_, i) => ({
      scores: {
        task_adherence: ['A', 'B', 'TIE', 'A', 'B'][i],
        factual_accuracy: 'A',
        completeness: 'B',
        instruction_following: 'TIE',
        structural_clarity: 'A',
        precision: 'B',
        conciseness: 'TIE',
      },
      winner: 'A',
    }));

    const tallies = buildCriterionTallies(results);
    for (const key of CRITERION_KEYS) {
      const total = tallies[key].a + tallies[key].b + tallies[key].tie;
      assert.equal(total, N, `${key} tally counts should sum to ${N}`);
    }
  });
});

describe('compare-prompts: verdict mapping', () => {
  it('maps overall_winner A to REGRESSED', () => {
    assert.equal(mapVerdict('A'), 'REGRESSED');
  });

  it('maps overall_winner B to IMPROVED', () => {
    assert.equal(mapVerdict('B'), 'IMPROVED');
  });

  it('maps overall_winner NEUTRAL to NEUTRAL', () => {
    assert.equal(mapVerdict('NEUTRAL'), 'NEUTRAL');
  });

  it('maps unexpected values to NEUTRAL', () => {
    assert.equal(mapVerdict('TIE'), 'NEUTRAL');
    assert.equal(mapVerdict(''), 'NEUTRAL');
    assert.equal(mapVerdict(undefined), 'NEUTRAL');
  });
});
