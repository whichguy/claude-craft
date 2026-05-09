'use strict';

const fs = require('fs');

const SLOTS = ['A', 'B', 'C', 'D', 'E'];

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function entropy(distribution) {
  let h = 0;
  for (const slot of SLOTS) {
    const p = distribution[slot];
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

function check({ currentDistPath, twoBackDistPath }) {
  const current = readJson(currentDistPath);
  const twoBack = readJson(twoBackDistPath);
  const entropyNow = entropy(current);
  const entropyTwoBack = entropy(twoBack);
  const ratio = entropyTwoBack === 0 ? 1 : entropyNow / entropyTwoBack;
  const stagnated = ratio > 0.95;
  return {
    entropy_now: entropyNow,
    entropy_two_back: entropyTwoBack,
    ratio,
    stagnated
  };
}

module.exports = { check, entropy };
