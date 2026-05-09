'use strict';

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILL_LIB = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'narrow-plan', 'lib');
const { score } = require(path.join(SKILL_LIB, 'info-gain'));
const { entropy } = require(path.join(SKILL_LIB, 'stagnation-check'));

function tmpdir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'narrow-plan-infogain-'));
}

function writeJson(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj));
}

function writeJsonl(p, objs) {
    fs.writeFileSync(p, objs.map((o) => JSON.stringify(o)).join('\n') + '\n');
}

describe('lib/info-gain.js', function () {
    it('matches hand-computed expected entropy reduction to 1e-6', function () {
        const dir = tmpdir();
        const priorPath = path.join(dir, 'prior.json');
        const postPath = path.join(dir, 'post.jsonl');
        const candPath = path.join(dir, 'cand.json');

        const prior = { A: 0.4, B: 0.3, C: 0.2, D: 0.05, E: 0.05 };
        const post0 = { A: 0.9, B: 0.05, C: 0.025, D: 0.0125, E: 0.0125 };
        const post1 = { A: 0.1, B: 0.6, C: 0.2, D: 0.05, E: 0.05 };
        const post2 = { A: 0.2, B: 0.2, C: 0.4, D: 0.1, E: 0.1 };

        writeJson(priorPath, prior);
        writeJsonl(postPath, [
            { q_idx: 0, a_idx: 0, posterior: post0 },
            { q_idx: 0, a_idx: 1, posterior: post1 },
            { q_idx: 0, a_idx: 2, posterior: post2 }
        ]);
        writeJson(candPath, [
            { q_idx: 0, q: 'Q', answers: [
                { a_idx: 0, a: 'a', p: 0.5 },
                { a_idx: 1, a: 'b', p: 0.3 },
                { a_idx: 2, a: 'c', p: 0.2 }
            ]}
        ]);

        const expectedReduction = entropy(prior) - (
            0.5 * entropy(post0) + 0.3 * entropy(post1) + 0.2 * entropy(post2)
        );

        const result = score({ priorDistPath: priorPath, posteriorsPath: postPath, candidatesPath: candPath });
        expect(result).to.have.lengthOf(1);
        expect(result[0].q_idx).to.equal(0);
        expect(result[0].expected_reduction).to.be.closeTo(expectedReduction, 1e-6);
    });

    it('handles degenerate P(a)=1.0 case', function () {
        const dir = tmpdir();
        const priorPath = path.join(dir, 'prior.json');
        const postPath = path.join(dir, 'post.jsonl');
        const candPath = path.join(dir, 'cand.json');

        const prior = { A: 0.4, B: 0.3, C: 0.2, D: 0.05, E: 0.05 };
        const postX = { A: 1.0, B: 0, C: 0, D: 0, E: 0 };
        const postY = { A: 0, B: 1.0, C: 0, D: 0, E: 0 };

        writeJson(priorPath, prior);
        writeJsonl(postPath, [
            { q_idx: 0, a_idx: 0, posterior: postX },
            { q_idx: 0, a_idx: 1, posterior: postY }
        ]);
        // Non-uniform priors so the answer isn't degenerate twice over
        writeJson(candPath, [
            { q_idx: 0, q: 'Q', answers: [
                { a_idx: 0, a: 'x', p: 1.0 },
                { a_idx: 1, a: 'y', p: 0.0 }
            ]}
        ]);

        const expectedReduction = entropy(prior) - (1.0 * entropy(postX) + 0.0 * entropy(postY));
        const result = score({ priorDistPath: priorPath, posteriorsPath: postPath, candidatesPath: candPath });
        expect(result[0].expected_reduction).to.be.closeTo(expectedReduction, 1e-6);
    });

    it('throws when answer priors do not sum to 1.0', function () {
        const dir = tmpdir();
        const priorPath = path.join(dir, 'prior.json');
        const postPath = path.join(dir, 'post.jsonl');
        const candPath = path.join(dir, 'cand.json');

        writeJson(priorPath, { A: 0.2, B: 0.2, C: 0.2, D: 0.2, E: 0.2 });
        writeJsonl(postPath, [
            { q_idx: 0, a_idx: 0, posterior: { A: 1, B: 0, C: 0, D: 0, E: 0 } },
            { q_idx: 0, a_idx: 1, posterior: { A: 0, B: 1, C: 0, D: 0, E: 0 } }
        ]);
        writeJson(candPath, [
            { q_idx: 0, q: 'Q', answers: [
                { a_idx: 0, a: 'a', p: 0.6 },
                { a_idx: 1, a: 'b', p: 0.6 }   // sums to 1.2
            ]}
        ]);

        expect(() => score({ priorDistPath: priorPath, posteriorsPath: postPath, candidatesPath: candPath }))
            .to.throw(/sum to/);
    });

    it('sorts results by expected_reduction descending', function () {
        const dir = tmpdir();
        const priorPath = path.join(dir, 'prior.json');
        const postPath = path.join(dir, 'post.jsonl');
        const candPath = path.join(dir, 'cand.json');

        const prior = { A: 0.2, B: 0.2, C: 0.2, D: 0.2, E: 0.2 };
        writeJson(priorPath, prior);
        writeJsonl(postPath, [
            // Question 0: low info-gain (posterior ≈ prior)
            { q_idx: 0, a_idx: 0, posterior: prior },
            { q_idx: 0, a_idx: 1, posterior: prior },
            // Question 1: high info-gain (posterior collapses)
            { q_idx: 1, a_idx: 0, posterior: { A: 1, B: 0, C: 0, D: 0, E: 0 } },
            { q_idx: 1, a_idx: 1, posterior: { A: 0, B: 1, C: 0, D: 0, E: 0 } }
        ]);
        writeJson(candPath, [
            { q_idx: 0, q: 'low', answers: [{ a_idx: 0, a: 'a', p: 0.5 }, { a_idx: 1, a: 'b', p: 0.5 }] },
            { q_idx: 1, q: 'high', answers: [{ a_idx: 0, a: 'a', p: 0.5 }, { a_idx: 1, a: 'b', p: 0.5 }] }
        ]);

        const result = score({ priorDistPath: priorPath, posteriorsPath: postPath, candidatesPath: candPath });
        expect(result[0].q_idx).to.equal(1); // high info-gain first
        expect(result[1].q_idx).to.equal(0);
        expect(result[0].expected_reduction).to.be.greaterThan(result[1].expected_reduction);
    });
});
