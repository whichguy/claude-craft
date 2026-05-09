#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { score } = require('../info-gain');

const [, , roundDir] = process.argv;
if (!roundDir) {
  console.error('usage: info-gain.js <round-dir>');
  process.exit(2);
}

const result = score({
  priorDistPath: path.join(roundDir, 'distribution.json'),
  posteriorsPath: path.join(roundDir, 'counterfactual-posteriors.jsonl'),
  candidatesPath: path.join(roundDir, 'question-candidates.json')
});
const outPath = path.join(roundDir, 'info-gain.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(outPath + '\n');
