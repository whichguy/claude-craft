'use strict';

const fs = require('fs');
const { entropy } = require('./stagnation-check');

const SLOTS = ['A', 'B', 'C', 'D', 'E'];
const TOL = 1e-6;

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function readJsonl(path) {
  return fs.readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function score({ priorDistPath, posteriorsPath, candidatesPath }) {
  const prior = readJson(priorDistPath);
  const posteriors = readJsonl(posteriorsPath);
  const candidates = readJson(candidatesPath);
  const hPrior = entropy(prior);

  const postIndex = new Map();
  for (const row of posteriors) {
    postIndex.set(`${row.q_idx}:${row.a_idx}`, row.posterior);
  }

  const results = candidates.map((candidate) => {
    const priorSum = candidate.answers.reduce((acc, a) => acc + a.p, 0);
    if (Math.abs(priorSum - 1) > TOL) {
      throw new Error(`question ${candidate.q_idx} answer priors sum to ${priorSum}, expected 1.0 +/- ${TOL}`);
    }
    let expected = 0;
    for (const answer of candidate.answers) {
      const posterior = postIndex.get(`${candidate.q_idx}:${answer.a_idx}`);
      if (!posterior || typeof posterior !== 'object') {
        throw new Error(`missing posterior for q_idx=${candidate.q_idx} a_idx=${answer.a_idx}`);
      }
      const postSum = SLOTS.reduce((s, sl) => s + (posterior[sl] || 0), 0);
      if (Math.abs(postSum - 1) > TOL) {
        throw new Error(`posterior for q_idx=${candidate.q_idx} a_idx=${answer.a_idx} sums to ${postSum}, expected 1.0 +/- ${TOL}`);
      }
      expected += answer.p * entropy(posterior);
    }
    return { q_idx: candidate.q_idx, expected_reduction: hPrior - expected };
  });

  results.sort((a, b) => b.expected_reduction - a.expected_reduction);
  return results;
}

module.exports = { score };
