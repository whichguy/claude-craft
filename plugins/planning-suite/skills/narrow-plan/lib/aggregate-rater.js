'use strict';

const fs = require('fs');

const SLOTS = ['A', 'B', 'C', 'D', 'E'];
const MIN_SUCCESSFUL = 5;

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function readJsonl(path) {
  return fs.readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function extractLetter(raw) {
  if (typeof raw !== 'string') return null;
  const lineMatch = raw.match(/^[ABCDE]\s*$/m);
  if (lineMatch) return lineMatch[0].trim();
  const tokens = raw.match(/\b[ABCDE]\b/g);
  if (tokens && tokens.length > 0) return tokens[tokens.length - 1];
  return null;
}

function reversePermutation(permutation) {
  // permutation maps original_slot -> permuted_slot.
  // We need permuted_slot -> original_slot to recover the original-slot vote.
  const reversed = {};
  for (const original of SLOTS) {
    const permuted = permutation[original];
    if (!SLOTS.includes(permuted)) {
      throw new Error(`invalid permutation entry: ${original} -> ${permuted}`);
    }
    reversed[permuted] = original;
  }
  return reversed;
}

function countLetters({ raterOutputsPath, permutationsPath }) {
  const rows = readJsonl(raterOutputsPath);
  const permutations = readJson(permutationsPath);

  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let successful = 0;

  for (const row of rows) {
    const letter = extractLetter(row.raw);
    if (!letter) continue;
    const perm = permutations[row.agent_idx];
    if (!perm) {
      throw new Error(`missing permutation for agent_idx=${row.agent_idx}`);
    }
    const reversed = reversePermutation(perm);
    const original = reversed[letter];
    if (!original) continue;
    counts[original] += 1;
    successful += 1;
  }

  if (successful < MIN_SUCCESSFUL) {
    throw new Error(`only ${successful} raters succeeded, minimum is ${MIN_SUCCESSFUL}`);
  }

  const distribution = {};
  for (const slot of SLOTS) {
    distribution[slot] = counts[slot] / successful;
  }
  return distribution;
}

module.exports = { countLetters, extractLetter, reversePermutation };
