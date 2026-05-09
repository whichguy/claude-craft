#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { check } = require('../stop-rule');

const [, , roundDir, priorRoundDir] = process.argv;
if (!roundDir) {
  console.error('usage: stop-rule.js <round-dir> [<prior-round-dir>]');
  process.exit(2);
}

const distPath = path.join(roundDir, 'distribution.json');
const refinementsPath = path.join(roundDir, 'refinements.json');
const priorDistPath = priorRoundDir ? path.join(priorRoundDir, 'distribution.json') : null;

const result = check({ distPath, refinementsPath, priorDistPath });
const outPath = path.join(roundDir, 'stop-check.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(outPath + '\n');
