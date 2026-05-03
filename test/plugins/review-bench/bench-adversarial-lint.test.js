const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Lint guard against silent Q-ID drift between the bench-adversarial test
// runner / its ground-truth file and the canonical question definitions in
// QUESTIONS.md / QUESTIONS-L3.md.
//
// Catches the bug class we cleaned up earlier in commit 4e3bc1a: stale Q-IDs
// (Q49, Q44, N23, N30, Q5, Q13, Q51, Q-G33, Q-G43) lingered in the bench
// after main slimmed code-reviewer.md and restructured review-plan questions.
// The runner kept emitting them silently because nothing tied bench Q-IDs to
// the live question registry.

const REPO_ROOT = path.resolve(__dirname, '../../..');
const BENCH_RUNNER = path.join(REPO_ROOT, 'test', 'bench-adversarial.js');
const GROUND_TRUTH = path.join(REPO_ROOT, 'test', 'benchmarks', 'adversarial.ground-truth.json');
const QUESTIONS_PATHS = [
    path.join(REPO_ROOT, 'plugins', 'review-suite', 'skills', 'review-plan', 'QUESTIONS.md'),
    path.join(REPO_ROOT, 'plugins', 'review-suite', 'skills', 'review-plan', 'QUESTIONS-L3.md'),
];

// Q-ID pattern: prefix Q- followed by one capital letter (G/C/U/E/N) and digits.
// Bare Q\d+ and N\d+ are NOT valid — they represent the deleted pre-G16 system.
const QID_PATTERN = /\bQ-[A-Z][A-Z0-9]*\b/g;

function loadDefinedQids() {
    const defined = new Set();
    for (const p of QUESTIONS_PATHS) {
        if (!fs.existsSync(p)) continue;
        const content = fs.readFileSync(p, 'utf8');
        for (const match of content.matchAll(QID_PATTERN)) defined.add(match[0]);
    }
    return defined;
}

describe('bench-adversarial Q-ID coverage lint', function () {
    const definedQids = loadDefinedQids();

    it('every Q-ID emitted by the mock evaluator exists in QUESTIONS.md/QUESTIONS-L3.md', function () {
        const runner = fs.readFileSync(BENCH_RUNNER, 'utf8');
        // Detection blocks look like:  findings['Q-G1'] = { ... };
        const emitted = new Set();
        for (const match of runner.matchAll(/findings\['(Q-[A-Z][A-Z0-9]*)'\]/g)) {
            emitted.add(match[1]);
        }
        const drift = [...emitted].filter(q => !definedQids.has(q));
        expect(drift, `bench-adversarial.js emits Q-IDs absent from QUESTIONS*.md: ${drift.join(', ')}`).to.deep.equal([]);
    });

    it('every Q-ID expected in ground-truth exists in QUESTIONS.md/QUESTIONS-L3.md', function () {
        const groundTruth = JSON.parse(fs.readFileSync(GROUND_TRUTH, 'utf8'));
        const referenced = new Set();
        for (const qids of Object.values(groundTruth)) {
            for (const qid of qids) referenced.add(qid);
        }
        const drift = [...referenced].filter(q => !definedQids.has(q));
        expect(drift, `ground-truth.json references Q-IDs absent from QUESTIONS*.md: ${drift.join(', ')}`).to.deep.equal([]);
    });

    it('rejects bare Q\\d+ or N\\d+ identifiers (pre-G16 deleted scheme)', function () {
        const runner = fs.readFileSync(BENCH_RUNNER, 'utf8');
        const groundTruth = fs.readFileSync(GROUND_TRUTH, 'utf8');

        // Match findings['Q5'] / findings['N23'] / "Q49" in JSON arrays
        const stale = new Set();
        for (const m of runner.matchAll(/findings\['([QN][0-9]+)'\]/g)) stale.add(m[1]);
        for (const m of groundTruth.matchAll(/"([QN][0-9]+)"/g)) stale.add(m[1]);

        expect([...stale], `Bare pre-G16 Q-IDs found — should use prefixed Q-G/Q-C/Q-U/Q-E form: ${[...stale].join(', ')}`).to.deep.equal([]);
    });
});
