#!/usr/bin/env node
'use strict';
/**
 * improve-stop-decision.js — pure stop-table encoding for improve / improve-loop.
 *
 * Encodes contracts/goal.md "Stop predicate (shared) — canonical table" only.
 * Does not amend semantics. Does not string-match until text (caller supplies
 * until_kind). Does not own worktree lifecycle (see improve-next-auto.js).
 *
 * No network. No git. Deterministic from a JSON snapshot.
 *
 * Snapshot:
 *   mode: continuous|once
 *   until_kind: default|custom|none   (caller-derived; never classified here)
 *   status: active|complete|stopped (...)
 *   p0_p1_remaining: non-negative int
 *   consecutive_non_material_cycles: non-negative int
 *   consecutive_same_error: non-negative int
 *   consecutive_no_progress: non-negative int
 *   suite_this_cycle: PASS|FAIL|none
 *   cap_reason: none|max_cycles|max_elapsed|budget
 *   custom_until_met: boolean (only S8 / goal host may pass true; Phase 3: false)
 *
 * Output: { decision: continue|confirm|complete|stop, reason: <enum> }
 *
 * Exit codes (CLI):
 *   0 success
 *   1 usage / malformed JSON
 *   2 invalid snapshot (enums, mode×until_kind combos, negative counters)
 */

const MODES = new Set(['continuous', 'once']);
const UNTIL_KINDS = new Set(['default', 'custom', 'none']);
const SUITES = new Set(['PASS', 'FAIL', 'none']);
const CAPS = new Set(['none', 'max_cycles', 'max_elapsed', 'budget']);

const REASONS = new Set([
  'none',
  'existing-status',
  'same-error',
  'no-progress',
  'max_cycles',
  'max_elapsed',
  'budget',
  'until-default',
  'until-custom',
  'once-empty-backlog',
]);

function invalid(msg) {
  const err = new Error(msg);
  err.code = 2;
  throw err;
}

function nonNegInt(v, name) {
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    v = Number(v);
  }
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
    invalid(`${name} must be a non-negative integer`);
  }
  return v;
}

function asBool(v, name) {
  if (v === true || v === false) return v;
  if (v === 1 || v === '1' || v === 'true' || v === 'yes') return true;
  if (v === 0 || v === '0' || v === 'false' || v === 'no') return false;
  invalid(`${name} must be a boolean`);
}

function out(decision, reason) {
  if (!REASONS.has(reason)) {
    throw new Error(`internal: unknown reason ${reason}`);
  }
  return { decision, reason };
}

/**
 * Pure encoding of the canonical stop table (goal.md).
 * @param {object} s
 * @returns {{ decision: string, reason: string }}
 */
function deriveStopDecision(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    invalid('snapshot must be a JSON object');
  }

  const mode = s.mode;
  const untilKind = s.until_kind;
  const status = s.status == null ? '' : String(s.status).trim();
  const suite = s.suite_this_cycle;
  const cap = s.cap_reason == null ? 'none' : s.cap_reason;

  if (!MODES.has(mode)) invalid(`mode must be continuous|once (got ${mode})`);
  if (!UNTIL_KINDS.has(untilKind)) {
    invalid(`until_kind must be default|custom|none (got ${untilKind})`);
  }
  if (!SUITES.has(suite)) {
    invalid(`suite_this_cycle must be PASS|FAIL|none (got ${suite})`);
  }
  if (!CAPS.has(cap)) {
    invalid(`cap_reason must be none|max_cycles|max_elapsed|budget (got ${cap})`);
  }
  if (!status) invalid('status is required');

  // Mode × until_kind validity (caller must restore continuous default before calling)
  if (mode === 'continuous' && untilKind === 'none') {
    invalid('continuous + until_kind none is invalid (Phase 0 restores default first)');
  }
  if (mode === 'once' && untilKind === 'custom') {
    invalid('once + until_kind custom is invalid (standalone once uses until: none)');
  }
  if (mode === 'once' && untilKind === 'default') {
    invalid('once + until_kind default is invalid (standalone once uses until: none)');
  }

  const p0 = nonNegInt(s.p0_p1_remaining, 'p0_p1_remaining');
  const streak = nonNegInt(
    s.consecutive_non_material_cycles,
    'consecutive_non_material_cycles'
  );
  const sameErr = nonNegInt(s.consecutive_same_error, 'consecutive_same_error');
  const noProg = nonNegInt(s.consecutive_no_progress, 'consecutive_no_progress');
  const customMet = asBool(
    s.custom_until_met == null ? false : s.custom_until_met,
    'custom_until_met'
  );

  // 1. Existing terminal status
  if (status === 'complete' || /^stopped\b/i.test(status)) {
    if (status === 'complete') return out('complete', 'existing-status');
    return out('stop', 'existing-status');
  }

  // 2. Same-error stall
  if (sameErr >= 3) return out('stop', 'same-error');

  // 3. No-progress stall
  if (noProg >= 3) return out('stop', 'no-progress');

  // 4. Caps (cap over satisfied until)
  if (cap !== 'none') return out('stop', cap);

  // 5. Until classification
  if (untilKind === 'default') {
    // continuous only (validated above)
    const eligible = p0 === 0 && streak >= 2;
    if (!eligible) return out('continue', 'none');
    if (suite === 'PASS') return out('complete', 'until-default');
    if (suite === 'none') return out('confirm', 'none');
    return out('continue', 'none'); // FAIL
  }

  if (untilKind === 'custom') {
    // continuous only
    if (!customMet) return out('continue', 'none');
    if (suite === 'PASS') return out('complete', 'until-custom');
    if (suite === 'none') return out('confirm', 'none');
    return out('continue', 'none'); // FAIL
  }

  // until_kind === 'none' → once mode
  if (p0 > 0) return out('continue', 'none');
  if (suite === 'PASS') return out('complete', 'once-empty-backlog');
  if (suite === 'none') return out('confirm', 'none');
  return out('continue', 'none'); // FAIL
}

function usage() {
  process.stderr.write(
    'Usage: improve-stop-decision.js [--file snapshot.json]  (or JSON on stdin)\n' +
      'Prints JSON: { decision, reason }\n' +
      'Exit 1 = usage/malformed JSON; exit 2 = invalid snapshot enums/combos\n'
  );
}

function loadInput(argv) {
  const i = argv.indexOf('--file');
  if (i >= 0) {
    const fs = require('fs');
    const p = argv[i + 1];
    if (!p) throw Object.assign(new Error('missing path after --file'), { code: 1 });
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  const fs = require('fs');
  const raw = fs.readFileSync(0, 'utf8');
  if (!raw.trim()) throw Object.assign(new Error('empty stdin'), { code: 1 });
  return JSON.parse(raw);
}

function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    usage();
    process.exit(0);
  }
  let data;
  try {
    data = loadInput(argv);
  } catch (e) {
    process.stderr.write(String(e.message || e) + '\n');
    usage();
    process.exit(e.code === 2 ? 2 : 1);
  }
  try {
    const result = deriveStopDecision(data);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (e) {
    process.stderr.write(String(e.message || e) + '\n');
    process.exit(e.code === 2 ? 2 : 1);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { deriveStopDecision, REASONS };
