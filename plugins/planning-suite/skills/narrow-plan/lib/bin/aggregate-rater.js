#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { countLetters } = require('../aggregate-rater');

const [, , roundDir] = process.argv;
if (!roundDir) {
  console.error('usage: aggregate-rater.js <round-dir>');
  process.exit(2);
}

const distribution = countLetters({
  raterOutputsPath: path.join(roundDir, 'rater-outputs.jsonl'),
  permutationsPath: path.join(roundDir, 'rater-permutations.json')
});
const outPath = path.join(roundDir, 'distribution.json');
fs.writeFileSync(outPath, JSON.stringify(distribution, null, 2) + '\n');
process.stdout.write(outPath + '\n');
