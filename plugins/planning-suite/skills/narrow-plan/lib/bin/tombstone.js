#!/usr/bin/env node
'use strict';

const { apply } = require('../tombstone');

const [, , runDir, recordJson, commitMessage] = process.argv;
if (!runDir || !recordJson) {
  console.error('usage: tombstone.js <run-dir> <record-json> [<commit-message>]');
  process.exit(2);
}

let record;
try {
  record = JSON.parse(recordJson);
} catch (err) {
  console.error(`failed to parse record JSON: ${err.message}`);
  process.exit(2);
}

const { tombstonesPath, promptPath } = apply({ runDir, record, commitMessage });
process.stdout.write(`${tombstonesPath}\n${promptPath}\n`);
