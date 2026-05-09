'use strict';

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const STOP_RULE = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'narrow-plan', 'lib', 'stop-rule.js');
const { check } = require(STOP_RULE);

function tmpdir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'narrow-plan-stoprule-'));
}

function writeJson(filePath, obj) {
    fs.writeFileSync(filePath, JSON.stringify(obj));
}

describe('lib/stop-rule.js', function () {
    it('passes only when all three conditions hold', function () {
        const dir = tmpdir();
        const distPath = path.join(dir, 'dist.json');
        const refPath = path.join(dir, 'refs.json');
        const priorDistPath = path.join(dir, 'prior.json');

        writeJson(distPath, { A: 0.75, B: 0.10, C: 0.05, D: 0.05, E: 0.05 });
        writeJson(refPath, {
            slots: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
            carry_forward: [
                { this_slot: 'A', prior_slot: 'B' },
                { this_slot: 'B', prior_slot: 'D' }
            ]
        });
        writeJson(priorDistPath, { A: 0.05, B: 0.45, C: 0.10, D: 0.30, E: 0.10 }); // top-2 = B, D

        const result = check({ distPath, refinementsPath: refPath, priorDistPath });
        expect(result.p_top).to.equal(0.75);
        expect(result.p_second).to.equal(0.10);
        expect(result.margin).to.be.closeTo(0.65, 1e-9);
        expect(result.winning_slot).to.equal('A');
        expect(result.top_was_carried_forward).to.equal(true);
        expect(result.passes).to.equal(true);
    });

    it('fails when p_top < 0.70 (boundary)', function () {
        const dir = tmpdir();
        const distPath = path.join(dir, 'dist.json');
        const refPath = path.join(dir, 'refs.json');
        const priorDistPath = path.join(dir, 'prior.json');

        writeJson(distPath, { A: 0.69, B: 0.10, C: 0.07, D: 0.07, E: 0.07 });
        writeJson(refPath, { slots: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
            carry_forward: [{ this_slot: 'A', prior_slot: 'A' }, { this_slot: 'B', prior_slot: 'B' }] });
        writeJson(priorDistPath, { A: 0.5, B: 0.3, C: 0.1, D: 0.05, E: 0.05 });

        const result = check({ distPath, refinementsPath: refPath, priorDistPath });
        expect(result.passes).to.equal(false);
    });

    it('fails when margin < 0.30 (boundary)', function () {
        const dir = tmpdir();
        const distPath = path.join(dir, 'dist.json');
        const refPath = path.join(dir, 'refs.json');
        const priorDistPath = path.join(dir, 'prior.json');

        writeJson(distPath, { A: 0.71, B: 0.45, C: 0, D: 0, E: 0 }); // sums >1 but ok for stop logic
        writeJson(refPath, { slots: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
            carry_forward: [{ this_slot: 'A', prior_slot: 'A' }, { this_slot: 'B', prior_slot: 'B' }] });
        writeJson(priorDistPath, { A: 0.5, B: 0.3, C: 0.1, D: 0.05, E: 0.05 });

        const result = check({ distPath, refinementsPath: refPath, priorDistPath });
        expect(result.margin).to.be.lessThan(0.30);
        expect(result.passes).to.equal(false);
    });

    it('fails when winner was not carried forward (winner is fresh slot)', function () {
        const dir = tmpdir();
        const distPath = path.join(dir, 'dist.json');
        const refPath = path.join(dir, 'refs.json');
        const priorDistPath = path.join(dir, 'prior.json');

        writeJson(distPath, { A: 0.10, B: 0.05, C: 0.80, D: 0.03, E: 0.02 }); // C wins
        writeJson(refPath, { slots: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
            carry_forward: [{ this_slot: 'A', prior_slot: 'A' }, { this_slot: 'B', prior_slot: 'B' }] });
        writeJson(priorDistPath, { A: 0.5, B: 0.3, C: 0.1, D: 0.05, E: 0.05 });

        const result = check({ distPath, refinementsPath: refPath, priorDistPath });
        expect(result.winning_slot).to.equal('C');
        expect(result.top_was_carried_forward).to.equal(false);
        expect(result.passes).to.equal(false);
    });

    it('fails when winner is in carry_forward but prior_slot was rank 3', function () {
        const dir = tmpdir();
        const distPath = path.join(dir, 'dist.json');
        const refPath = path.join(dir, 'refs.json');
        const priorDistPath = path.join(dir, 'prior.json');

        // A is current winner, carried from prior slot E. But E was rank 3+ in prior round.
        writeJson(distPath, { A: 0.75, B: 0.10, C: 0.05, D: 0.05, E: 0.05 });
        writeJson(refPath, { slots: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
            carry_forward: [{ this_slot: 'A', prior_slot: 'E' }, { this_slot: 'B', prior_slot: 'D' }] });
        writeJson(priorDistPath, { A: 0.5, B: 0.3, C: 0.1, D: 0.05, E: 0.05 }); // top-2 = A, B; E is rank 4

        const result = check({ distPath, refinementsPath: refPath, priorDistPath });
        expect(result.top_was_carried_forward).to.equal(false);
        expect(result.passes).to.equal(false);
    });

    it('round 1 cannot pass (carry_forward empty)', function () {
        const dir = tmpdir();
        const distPath = path.join(dir, 'dist.json');
        const refPath = path.join(dir, 'refs.json');

        writeJson(distPath, { A: 0.95, B: 0.02, C: 0.01, D: 0.01, E: 0.01 });
        writeJson(refPath, { slots: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, carry_forward: [] });

        const result = check({ distPath, refinementsPath: refPath, priorDistPath: null });
        expect(result.p_top).to.equal(0.95);
        expect(result.top_was_carried_forward).to.equal(false);
        expect(result.passes).to.equal(false);
    });

    it('output schema matches the documented shape', function () {
        const dir = tmpdir();
        const distPath = path.join(dir, 'dist.json');
        const refPath = path.join(dir, 'refs.json');
        writeJson(distPath, { A: 0.2, B: 0.2, C: 0.2, D: 0.2, E: 0.2 });
        writeJson(refPath, { slots: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, carry_forward: [] });

        const result = check({ distPath, refinementsPath: refPath, priorDistPath: null });
        expect(Object.keys(result).sort()).to.deep.equal(
            ['margin', 'p_second', 'p_top', 'passes', 'top_was_carried_forward', 'winning_slot']
        );
    });
});
