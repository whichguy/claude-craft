#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { check } = require('../stagnation-check');

const [, , currentRoundDir, twoBackRoundDir] = process.argv;
if (!currentRoundDir || !twoBackRoundDir) {
  console.error('usage: stagnation-check.js <current-round-dir> <two-back-round-dir>');
  process.exit(2);
}

const result = check({
  currentDistPath: path.join(currentRoundDir, 'distribution.json'),
  twoBackDistPath: path.join(twoBackRoundDir, 'distribution.json')
});
const outPath = path.join(currentRoundDir, 'stagnation-check.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(outPath + '\n');
