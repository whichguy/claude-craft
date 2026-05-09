'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REQUIRED_FIELDS = ['round', 'question', 'answer', 'source', 'agreed_by_two_framings'];
const VALID_SOURCES = new Set(['llm', 'user']);

function validate(record) {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in record)) {
      throw new Error(`tombstone record missing required field: ${field}`);
    }
  }
  if (!Number.isInteger(record.round) || record.round < 1) {
    throw new Error(`tombstone.round must be positive integer, got ${record.round}`);
  }
  if (typeof record.question !== 'string' || record.question.length === 0) {
    throw new Error('tombstone.question must be non-empty string');
  }
  if (typeof record.answer !== 'string' || record.answer.length === 0) {
    throw new Error('tombstone.answer must be non-empty string');
  }
  if (!VALID_SOURCES.has(record.source)) {
    throw new Error(`tombstone.source must be one of ${[...VALID_SOURCES].join(', ')}`);
  }
  if (typeof record.agreed_by_two_framings !== 'boolean') {
    throw new Error('tombstone.agreed_by_two_framings must be boolean');
  }
}

function git(runDir, args) {
  execFileSync('git', ['-C', runDir, ...args], { stdio: 'pipe' });
}

function gitCapture(runDir, args) {
  return execFileSync('git', ['-C', runDir, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

function apply({ runDir, record, commitMessage, skipGit }) {
  validate(record);
  const tombstonesPath = path.join(runDir, 'tombstones.jsonl');
  const promptPath = path.join(runDir, 'prompt.md');

  // Step 1: append jsonl
  fs.appendFileSync(tombstonesPath, JSON.stringify(record) + '\n');

  // Step 2: append markdown Q/A block to prompt.md
  const block = `\n\n## Round ${record.round} Q/A (source: ${record.source})\n\n` +
    `**Q:** ${record.question}\n\n` +
    `**A:** ${record.answer}\n`;
  fs.appendFileSync(promptPath, block);

  // Step 3: git commit (skippable for unit tests)
  if (!skipGit) {
    git(runDir, ['add', '.']);
    const msg = commitMessage || `round-${record.round}: tombstone`;
    git(runDir, ['commit', '-m', msg]);
  }

  return { tombstonesPath, promptPath };
}

module.exports = { apply, validate, git, gitCapture };
