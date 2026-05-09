'use strict';

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILL_LIB = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'narrow-plan', 'lib');
const { countLetters, extractLetter, reversePermutation } = require(path.join(SKILL_LIB, 'aggregate-rater'));

function tmpdir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'narrow-plan-rater-'));
}

function writeJson(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj));
}

function writeJsonl(p, objs) {
    fs.writeFileSync(p, objs.map((o) => JSON.stringify(o)).join('\n') + '\n');
}

const IDENTITY = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' };

describe('lib/aggregate-rater.js', function () {
    describe('extractLetter', function () {
        it('matches a single letter on its own line first', function () {
            expect(extractLetter('A')).to.equal('A');
            expect(extractLetter('  C  ')).to.equal('C');
            expect(extractLetter('reasoning here\nB\n')).to.equal('B');
        });

        it('falls back to the LAST single-letter token in prose', function () {
            expect(extractLetter('Comparing A and B, I prefer C')).to.equal('C');
            expect(extractLetter('A is good but B wins')).to.equal('B');
        });

        it('returns null on gibberish or no letter', function () {
            expect(extractLetter('hello world')).to.equal(null);
            expect(extractLetter('')).to.equal(null);
            expect(extractLetter(null)).to.equal(null);
            expect(extractLetter('1234')).to.equal(null);
        });
    });

    describe('reversePermutation', function () {
        it('inverts a permutation correctly', function () {
            const perm = { A: 'C', B: 'A', C: 'E', D: 'B', E: 'D' };
            const reversed = reversePermutation(perm);
            expect(reversed).to.deep.equal({ C: 'A', A: 'B', E: 'C', B: 'D', D: 'E' });
        });

        it('throws on invalid permutation', function () {
            expect(() => reversePermutation({ A: 'X', B: 'B', C: 'C', D: 'D', E: 'E' }))
                .to.throw(/invalid permutation/);
        });
    });

    describe('countLetters', function () {
        it('counts identity-permuted votes correctly and sums to 1.0', function () {
            const dir = tmpdir();
            const outputsPath = path.join(dir, 'outputs.jsonl');
            const permPath = path.join(dir, 'perms.json');

            const perms = {};
            for (let i = 0; i < 10; i++) perms[i] = IDENTITY;
            writeJson(permPath, perms);

            writeJsonl(outputsPath, [
                { agent_idx: 0, raw: 'A' },
                { agent_idx: 1, raw: 'A' },
                { agent_idx: 2, raw: 'A' },
                { agent_idx: 3, raw: 'A' },
                { agent_idx: 4, raw: 'B' },
                { agent_idx: 5, raw: 'B' },
                { agent_idx: 6, raw: 'B' },
                { agent_idx: 7, raw: 'C' },
                { agent_idx: 8, raw: 'C' },
                { agent_idx: 9, raw: 'D' }
            ]);

            const dist = countLetters({ raterOutputsPath: outputsPath, permutationsPath: permPath });
            expect(dist).to.deep.equal({ A: 0.4, B: 0.3, C: 0.2, D: 0.1, E: 0 });
            const sum = dist.A + dist.B + dist.C + dist.D + dist.E;
            expect(sum).to.be.closeTo(1.0, 1e-9);
        });

        it('reverses permutation back to original-slot vote', function () {
            const dir = tmpdir();
            const outputsPath = path.join(dir, 'outputs.jsonl');
            const permPath = path.join(dir, 'perms.json');

            // All 10 raters see the same permutation: A->C, B->A, C->E, D->B, E->D
            // If a rater outputs "A" (in permuted space), the original slot was B.
            const perm = { A: 'C', B: 'A', C: 'E', D: 'B', E: 'D' };
            const perms = {};
            for (let i = 0; i < 10; i++) perms[i] = perm;
            writeJson(permPath, perms);

            // 10 raters all output "A" (permuted) → all really voted for original slot B
            writeJsonl(outputsPath, Array.from({ length: 10 }, (_, i) => ({ agent_idx: i, raw: 'A' })));

            const dist = countLetters({ raterOutputsPath: outputsPath, permutationsPath: permPath });
            expect(dist.B).to.equal(1.0);
            expect(dist.A).to.equal(0);
        });

        it('extracts letter from prose-laden output (last token wins)', function () {
            const dir = tmpdir();
            const outputsPath = path.join(dir, 'outputs.jsonl');
            const permPath = path.join(dir, 'perms.json');

            const perms = {};
            for (let i = 0; i < 10; i++) perms[i] = IDENTITY;
            writeJson(permPath, perms);

            writeJsonl(outputsPath, [
                { agent_idx: 0, raw: 'Comparing A and B, I prefer C' },  // → C
                { agent_idx: 1, raw: 'A is fine but B is better' },       // → B
                { agent_idx: 2, raw: 'D' },
                { agent_idx: 3, raw: 'D' },
                { agent_idx: 4, raw: 'D' },
                { agent_idx: 5, raw: 'D' },
                { agent_idx: 6, raw: 'E' },
                { agent_idx: 7, raw: 'E' },
                { agent_idx: 8, raw: 'A' },
                { agent_idx: 9, raw: 'A' }
            ]);

            const dist = countLetters({ raterOutputsPath: outputsPath, permutationsPath: permPath });
            expect(dist.A).to.equal(0.2);
            expect(dist.B).to.equal(0.1);
            expect(dist.C).to.equal(0.1);
            expect(dist.D).to.equal(0.4);
            expect(dist.E).to.equal(0.2);
        });

        it('skips parse-error rows (gibberish) and renormalizes', function () {
            const dir = tmpdir();
            const outputsPath = path.join(dir, 'outputs.jsonl');
            const permPath = path.join(dir, 'perms.json');

            const perms = {};
            for (let i = 0; i < 10; i++) perms[i] = IDENTITY;
            writeJson(permPath, perms);

            writeJsonl(outputsPath, [
                { agent_idx: 0, raw: 'A' },
                { agent_idx: 1, raw: 'A' },
                { agent_idx: 2, raw: 'A' },
                { agent_idx: 3, raw: 'B' },
                { agent_idx: 4, raw: 'B' },
                { agent_idx: 5, raw: 'gibberish' },         // skipped
                { agent_idx: 6, raw: 'no letter here 123' },// skipped
                { agent_idx: 7, raw: 'C' },
                { agent_idx: 8, raw: 'C' },
                { agent_idx: 9, raw: 'D' }
            ]);

            // 8 successful raters: 3 A, 2 B, 2 C, 1 D
            const dist = countLetters({ raterOutputsPath: outputsPath, permutationsPath: permPath });
            expect(dist.A).to.be.closeTo(3 / 8, 1e-9);
            expect(dist.B).to.be.closeTo(2 / 8, 1e-9);
            expect(dist.C).to.be.closeTo(2 / 8, 1e-9);
            expect(dist.D).to.be.closeTo(1 / 8, 1e-9);
        });

        it('throws when fewer than 5 raters succeed', function () {
            const dir = tmpdir();
            const outputsPath = path.join(dir, 'outputs.jsonl');
            const permPath = path.join(dir, 'perms.json');

            const perms = {};
            for (let i = 0; i < 10; i++) perms[i] = IDENTITY;
            writeJson(permPath, perms);

            writeJsonl(outputsPath, [
                { agent_idx: 0, raw: 'A' },
                { agent_idx: 1, raw: 'A' },
                { agent_idx: 2, raw: 'B' },
                { agent_idx: 3, raw: 'C' },
                { agent_idx: 4, raw: 'gibberish' },
                { agent_idx: 5, raw: 'gibberish' },
                { agent_idx: 6, raw: 'gibberish' },
                { agent_idx: 7, raw: 'gibberish' },
                { agent_idx: 8, raw: 'gibberish' },
                { agent_idx: 9, raw: 'gibberish' }
            ]);

            expect(() => countLetters({ raterOutputsPath: outputsPath, permutationsPath: permPath }))
                .to.throw(/minimum is 5/);
        });
    });
});
