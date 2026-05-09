'use strict';

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILL_LIB = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'narrow-plan', 'lib');
const { check, entropy } = require(path.join(SKILL_LIB, 'stagnation-check'));

function tmpdir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'narrow-plan-stag-'));
}

function writeJson(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj));
}

describe('lib/stagnation-check.js', function () {
    describe('entropy', function () {
        it('uniform distribution has H = log2(5) ≈ 2.3219', function () {
            expect(entropy({ A: 0.2, B: 0.2, C: 0.2, D: 0.2, E: 0.2 })).to.be.closeTo(Math.log2(5), 1e-9);
        });

        it('collapsed distribution has H = 0', function () {
            expect(entropy({ A: 1, B: 0, C: 0, D: 0, E: 0 })).to.equal(0);
        });

        it('skips p=0 terms (no log-zero NaN)', function () {
            const h = entropy({ A: 0.5, B: 0.5, C: 0, D: 0, E: 0 });
            expect(Number.isFinite(h)).to.equal(true);
            expect(h).to.equal(1); // -2 * 0.5 * log2(0.5) = 1
        });
    });

    describe('check', function () {
        function setup(currentDist, twoBackDist) {
            const dir = tmpdir();
            const currentPath = path.join(dir, 'current.json');
            const twoBackPath = path.join(dir, 'twoback.json');
            writeJson(currentPath, currentDist);
            writeJson(twoBackPath, twoBackDist);
            return { currentDistPath: currentPath, twoBackDistPath: twoBackPath };
        }

        it('not stagnated when entropy drops well below threshold', function () {
            // current: collapsed (H=0); twoBack: uniform (H≈2.32). Ratio = 0.
            const result = check(setup(
                { A: 1, B: 0, C: 0, D: 0, E: 0 },
                { A: 0.2, B: 0.2, C: 0.2, D: 0.2, E: 0.2 }
            ));
            expect(result.stagnated).to.equal(false);
            expect(result.ratio).to.equal(0);
        });

        it('stagnated when entropy holds above 0.95 of two-back', function () {
            // current and two-back are both moderately uncertain — ratio ≈ 1
            const dist = { A: 0.3, B: 0.3, C: 0.2, D: 0.1, E: 0.1 };
            const result = check(setup(dist, dist));
            expect(result.ratio).to.be.closeTo(1, 1e-9);
            expect(result.stagnated).to.equal(true);
        });

        it('stagnated when entropy GROWS (ratio > 1)', function () {
            // current more uniform than two-back → entropy grew
            const result = check(setup(
                { A: 0.2, B: 0.2, C: 0.2, D: 0.2, E: 0.2 },   // H = log2(5)
                { A: 0.7, B: 0.1, C: 0.1, D: 0.05, E: 0.05 }  // H smaller
            ));
            expect(result.ratio).to.be.greaterThan(1);
            expect(result.stagnated).to.equal(true);
        });

        it('handles entropyTwoBack = 0 sentinel (returns ratio = 1)', function () {
            // two-back was already collapsed (H=0). Avoids divide-by-zero.
            const result = check(setup(
                { A: 0.2, B: 0.2, C: 0.2, D: 0.2, E: 0.2 },
                { A: 1, B: 0, C: 0, D: 0, E: 0 }
            ));
            expect(result.ratio).to.equal(1);
            expect(result.stagnated).to.equal(true);
        });

        it('output schema matches the documented shape', function () {
            const result = check(setup(
                { A: 0.5, B: 0.5, C: 0, D: 0, E: 0 },
                { A: 0.5, B: 0.5, C: 0, D: 0, E: 0 }
            ));
            expect(Object.keys(result).sort()).to.deep.equal(['entropy_now', 'entropy_two_back', 'ratio', 'stagnated']);
        });
    });
});
