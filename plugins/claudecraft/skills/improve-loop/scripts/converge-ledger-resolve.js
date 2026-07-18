#!/usr/bin/env node
/**
 * Executable decision table for review-converge ledger resolve (Phase 0 step 4).
 * Pure functions — no git, no network. API-free unit tests pin fatal rename paths.
 *
 * Usage (library):
 *   const { resolveLedgerAction, isLandedForRound, countRoundHeadings } =
 *     require('./converge-ledger-resolve.js');
 *
 * CLI self-check (optional):
 *   node converge-ledger-resolve.js --self-test
 *
 * Exit 0 = ok; exit 1 = self-test failures.
 */
'use strict';

/**
 * Count ### Round N headings in a ledger body (Log section).
 * @param {string} text
 * @returns {number}
 */
function countRoundHeadings(text) {
  if (!text || typeof text !== 'string') return 0;
  const m = text.match(/^### Round \d+/gm);
  return m ? m.length : 0;
}

/**
 * Phase 0 step 4 ledger resolve — order is load-bearing.
 *
 * @param {{
 *   reviewExists: boolean,
 *   grokExists: boolean,
 *   reviewRoundCount?: number,
 *   grokRoundCount?: number,
 * }} input
 * @returns {
 *   'migrate' |
 *   'create' |
 *   'use-review' |
 *   'recover-half-migrate' |
 *   'use-review-drop-legacy' |
 *   'both-conflict'
 * }
 *
 * - migrate: REVIEW absent, GROK present → rename GROK → REVIEW once
 * - create: neither present → create REVIEW only
 * - use-review: REVIEW present, no GROK → proceed with REVIEW
 * - recover-half-migrate: both present; REVIEW has 0 rounds, GROK has ≥1
 *     → replace REVIEW with GROK content (or delete empty REVIEW then rename), remove GROK
 * - use-review-drop-legacy: both present; REVIEW has rounds (or both empty of rounds)
 *     → use REVIEW; remove leftover GROK so it cannot be mistaken for live ledger
 * - both-conflict: both present and both have ≥1 rounds → stop and report (do not auto-merge)
 */
function resolveLedgerAction(input) {
  const reviewExists = !!input.reviewExists;
  const grokExists = !!input.grokExists;
  const reviewRoundCount = Number(input.reviewRoundCount) || 0;
  const grokRoundCount = Number(input.grokRoundCount) || 0;

  if (!reviewExists && grokExists) return 'migrate';
  if (!reviewExists && !grokExists) return 'create';
  // reviewExists
  if (!grokExists) return 'use-review';

  // both exist — residual of create-before-migrate or hand edit
  if (reviewRoundCount === 0 && grokRoundCount > 0) return 'recover-half-migrate';
  if (reviewRoundCount > 0 && grokRoundCount > 0) return 'both-conflict';
  // REVIEW has rounds and GROK empty, or both zero rounds: prefer REVIEW, drop stale GROK
  return 'use-review-drop-legacy';
}

/**
 * Commit subject markers that count as "landed" for round N (em-dash after N).
 * New commits use only the review-converge marker; resume accepts legacy too.
 * @param {number|string} n
 * @returns {string[]}
 */
function landedMarkersForRound(n) {
  const num = String(n);
  // Em dash U+2014 — must match skill prose and commit subjects
  return [
    `review-converge: round ${num} —`,
    `grok-review-converge: round ${num} —`,
  ];
}

/**
 * True if any found commit subject matches either landed marker for round N.
 * Prefix-safe: requires the em-dash after N so round 1 does not match round 10.
 *
 * @param {string[]} foundSubjects — e.g. lines from git log --oneline or full subjects
 * @param {number|string} n
 * @returns {boolean}
 */
function isLandedForRound(foundSubjects, n) {
  const markers = landedMarkersForRound(n);
  const list = Array.isArray(foundSubjects) ? foundSubjects : [];
  return list.some((subj) => {
    const s = String(subj);
    return markers.some((m) => s.includes(m));
  });
}

/**
 * True when create is forbidden because a legacy ledger still exists.
 * Pin for migrate-before-create.
 */
function mustMigrateBeforeCreate(reviewExists, grokExists) {
  return !reviewExists && !!grokExists;
}

function selfTest() {
  const fails = [];
  const ok = (c, msg) => {
    if (!c) fails.push(msg);
  };

  // migrate-before-create matrix
  ok(resolveLedgerAction({ reviewExists: false, grokExists: true }) === 'migrate', 'absent+legacy → migrate');
  ok(resolveLedgerAction({ reviewExists: false, grokExists: false }) === 'create', 'neither → create');
  ok(resolveLedgerAction({ reviewExists: true, grokExists: false }) === 'use-review', 'review only → use');
  ok(
    resolveLedgerAction({
      reviewExists: true,
      grokExists: true,
      reviewRoundCount: 0,
      grokRoundCount: 3,
    }) === 'recover-half-migrate',
    'empty REVIEW + rich GROK → recover-half-migrate'
  );
  ok(
    resolveLedgerAction({
      reviewExists: true,
      grokExists: true,
      reviewRoundCount: 2,
      grokRoundCount: 2,
    }) === 'both-conflict',
    'both rich → both-conflict'
  );
  ok(
    resolveLedgerAction({
      reviewExists: true,
      grokExists: true,
      reviewRoundCount: 2,
      grokRoundCount: 0,
    }) === 'use-review-drop-legacy',
    'rich REVIEW + empty GROK → drop legacy'
  );
  ok(
    resolveLedgerAction({
      reviewExists: true,
      grokExists: true,
      reviewRoundCount: 0,
      grokRoundCount: 0,
    }) === 'use-review-drop-legacy',
    'both empty rounds → drop legacy, keep REVIEW'
  );

  ok(mustMigrateBeforeCreate(false, true) === true, 'mustMigrateBeforeCreate true');
  ok(mustMigrateBeforeCreate(true, true) === false, 'mustMigrateBeforeCreate false when review exists');
  ok(mustMigrateBeforeCreate(false, false) === false, 'mustMigrateBeforeCreate false when neither');

  // dual-marker landed (no false orphan on legacy-only)
  ok(
    isLandedForRound(['abc grok-review-converge: round 3 — fixed foo'], 3) === true,
    'legacy marker lands round 3'
  );
  ok(
    isLandedForRound(['abc review-converge: round 3 — fixed foo'], 3) === true,
    'new marker lands round 3'
  );
  ok(
    isLandedForRound(['abc review-converge: round 3 — fixed foo'], 4) === false,
    'wrong round not landed'
  );
  ok(
    isLandedForRound(['abc review-converge: round 10 — x'], 1) === false,
    'round 1 not prefix of round 10'
  );
  ok(
    isLandedForRound(['abc review-converge: round 1 — x'], 1) === true,
    'round 1 with em-dash lands'
  );
  ok(isLandedForRound([], 1) === false, 'empty subjects not landed');

  // countRoundHeadings
  ok(countRoundHeadings('## Log\n### Round 1 — d\n### Round 2 — d\n') === 2, 'count 2 rounds');
  ok(countRoundHeadings('# no rounds') === 0, 'count 0 rounds');
  ok(countRoundHeadings('') === 0, 'count empty');

  if (fails.length) {
    for (const f of fails) console.error('FAIL:', f);
    process.exit(1);
  }
  console.log('PASS: converge-ledger-resolve self-test');
  process.exit(0);
}

module.exports = {
  countRoundHeadings,
  resolveLedgerAction,
  landedMarkersForRound,
  isLandedForRound,
  mustMigrateBeforeCreate,
};

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    console.error('Usage: node converge-ledger-resolve.js --self-test');
    process.exit(2);
  }
}
