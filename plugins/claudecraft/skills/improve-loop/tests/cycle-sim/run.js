#!/usr/bin/env node
/**
 * run.js — improve-loop cycle simulator (API-free end-to-end of pure law)
 *
 * Chains for each step / multi-step scenario:
 *   Phase-2 counters → complete-gate → improve-stop-decision
 *
 * Cases live in ./cases/*.json (pre-seeded states). Does **not** invoke the
 * LLM or mutate a real campaign worktree.
 *
 * Usage:
 *   node tests/cycle-sim/run.js
 *   node tests/cycle-sim/run.js --cases-dir ./cases
 *   node tests/cycle-sim/run.js --case two-honest-empty-to-complete
 *   node tests/cycle-sim/run.js --json
 *   node tests/cycle-sim/run.js --list
 *
 * Exit: 0 all pass; 1 usage; 2 one or more failures
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  evaluatePhase2,
  hasHonestEmpty,
  HONEST_EMPTY,
} = require('./phase2-counters.js');
const { evaluateComplete } = require('../../scripts/complete-gate.js');

/**
 * Resolve stop-decision module across dual-home layouts:
 * - Publish (claudecraft): plugins/claudecraft/tools/improve-stop-decision.js
 * - Live (user skill under grok-build-additions/claude/skills/...): walk-up / env
 * Never hard-require a single relative path that only works under claudecraft.
 */
function loadStopDecision() {
  const name = 'improve-stop-decision.js';
  const candidates = [];
  if (process.env.IMPROVE_STOP_DECISION) {
    candidates.push(process.env.IMPROVE_STOP_DECISION);
  }
  // Classic Publish layout: tests/cycle-sim → …/claudecraft/tools/
  candidates.push(path.join(__dirname, '../../../../tools', name));
  // Vendored into skill scripts/ (optional)
  candidates.push(path.join(__dirname, '../../scripts', name));
  // Walk up looking for tools/<name> or plugins/claudecraft/tools/<name>
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    candidates.push(path.join(dir, 'tools', name));
    candidates.push(path.join(dir, 'plugins', 'claudecraft', 'tools', name));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const seen = new Set();
  for (const c of candidates) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    try {
      if (fs.existsSync(c)) return require(c);
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'Cannot find improve-stop-decision.js (set IMPROVE_STOP_DECISION or install under plugins/claudecraft/tools/)',
  );
}

const { deriveStopDecision } = loadStopDecision();

const ROOT = __dirname;
const DEFAULT_CASES = path.join(ROOT, 'cases');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pickCounters(c) {
  return {
    consecutive_no_progress: c.consecutive_no_progress,
    consecutive_same_error: c.consecutive_same_error,
    consecutive_non_material_cycles: c.consecutive_non_material_cycles,
    error_signature: c.error_signature,
  };
}

/**
 * Run one cycle step.
 * @param {object} step
 * @param {object|null} priorCounters — when inherit_counters
 */
function runStep(step, priorCounters) {
  const input = Object.assign({}, step.input || {});
  if (step.inherit_counters && priorCounters) {
    input.counters = pickCounters(priorCounters);
  }
  if (!input.counters) {
    throw new Error('step.input.counters required (or inherit_counters)');
  }

  const phase2 = evaluatePhase2(input);
  const openP0P1 =
    step.openP0P1 != null
      ? Number(step.openP0P1)
      : input.openP0P1 != null
        ? Number(input.openP0P1)
        : 0;

  // Strict R9 for sim: pass attestation flag from this cycle's notes
  // (omit only if step.completeGate.honestEmptyAttested is explicitly null)
  let honestEmptyAttested;
  if (
    step.completeGate &&
    Object.prototype.hasOwnProperty.call(step.completeGate, 'honestEmptyAttested')
  ) {
    honestEmptyAttested = step.completeGate.honestEmptyAttested;
  } else {
    honestEmptyAttested = hasHonestEmpty(input.notes || '');
  }

  const suiteGreen =
    step.suiteGreen != null
      ? step.suiteGreen === true
      : input.status === 'PASS' || input.suiteGreen === true;

  const gateInput = {
    openP0P1,
    consecutiveNonMaterial: phase2.counters.consecutive_non_material_cycles,
    suiteGreen,
  };
  if (honestEmptyAttested !== undefined && honestEmptyAttested !== null) {
    gateInput.honestEmptyAttested = honestEmptyAttested;
  }
  if (step.completeGate) {
    if (step.completeGate.allVPass != null) {
      gateInput.allVPass = step.completeGate.allVPass;
    }
    if (step.completeGate.headerSpecPass != null) {
      gateInput.headerSpecPass = step.completeGate.headerSpecPass;
    }
  }

  const gate = evaluateComplete(gateInput);

  const mode = step.mode || input.mode || 'continuous';
  const until_kind = step.until_kind || input.untilKind || 'default';
  const suite_this_cycle = suiteGreen
    ? 'PASS'
    : input.status === 'FAIL'
      ? 'FAIL'
      : step.suite_this_cycle || 'none';

  const stopSnap = {
    mode,
    until_kind,
    status: step.status_header || 'active',
    p0_p1_remaining: openP0P1,
    consecutive_non_material_cycles:
      phase2.counters.consecutive_non_material_cycles,
    consecutive_same_error: phase2.counters.consecutive_same_error,
    consecutive_no_progress: phase2.counters.consecutive_no_progress,
    suite_this_cycle,
    cap_reason: step.cap_reason || 'none',
    custom_until_met: step.custom_until_met === true,
  };
  const stop = deriveStopDecision(stopSnap);

  return {
    phase2,
    gate,
    stop,
    openP0P1,
    suiteGreen,
    honestEmptyAttested,
    notes: input.notes || '',
  };
}

function checkExpect(actual, expect, label) {
  const misses = [];
  if (!expect) return misses;

  if (expect.row != null && actual.phase2.row !== expect.row) {
    misses.push(
      `${label}row: want ${JSON.stringify(expect.row)} got ${JSON.stringify(actual.phase2.row)}`
    );
  }
  if (expect.counters) {
    const got = pickCounters(actual.phase2.counters);
    const want = Object.assign(pickCounters(got), expect.counters);
    // only compare keys present in expect.counters
    for (const k of Object.keys(expect.counters)) {
      if (got[k] !== expect.counters[k]) {
        misses.push(
          `${label}counters.${k}: want ${JSON.stringify(expect.counters[k])} got ${JSON.stringify(got[k])}`
        );
      }
    }
  }
  if (expect.nonMaterial != null && actual.phase2.nonMaterial !== expect.nonMaterial) {
    misses.push(
      `${label}nonMaterial: want ${expect.nonMaterial} got ${actual.phase2.nonMaterial}`
    );
  }
  if (expect.advancedNonMaterial != null) {
    if (actual.phase2.advancedNonMaterial !== expect.advancedNonMaterial) {
      misses.push(
        `${label}advancedNonMaterial: want ${expect.advancedNonMaterial} got ${actual.phase2.advancedNonMaterial}`
      );
    }
  }
  if (expect.notesAppendIncludes) {
    const list = Array.isArray(expect.notesAppendIncludes)
      ? expect.notesAppendIncludes
      : [expect.notesAppendIncludes];
    for (const frag of list) {
      if (!actual.phase2.notesAppend.some((n) => n.includes(frag))) {
        misses.push(
          `${label}notesAppend missing ${JSON.stringify(frag)}; got ${JSON.stringify(actual.phase2.notesAppend)}`
        );
      }
    }
  }
  if (expect.notesAppendEmpty === true) {
    if (actual.phase2.notesAppend.length !== 0) {
      misses.push(
        `${label}notesAppend expected empty got ${JSON.stringify(actual.phase2.notesAppend)}`
      );
    }
  }
  if (expect.complete != null && actual.gate.complete !== expect.complete) {
    misses.push(
      `${label}complete: want ${expect.complete} got ${actual.gate.complete} (${actual.gate.reason})`
    );
  }
  if (expect.gate_reason != null && actual.gate.reason !== expect.gate_reason) {
    misses.push(
      `${label}gate_reason: want ${expect.gate_reason} got ${actual.gate.reason}`
    );
  }
  if (expect.stop_decision != null && actual.stop.decision !== expect.stop_decision) {
    misses.push(
      `${label}stop_decision: want ${expect.stop_decision} got ${actual.stop.decision}`
    );
  }
  if (expect.stop_reason != null && actual.stop.reason !== expect.stop_reason) {
    misses.push(
      `${label}stop_reason: want ${expect.stop_reason} got ${actual.stop.reason}`
    );
  }
  // expected_changes is documentary — always listed, not a hard fail unless
  // expect.require_expected_changes_count is set
  if (expect.require_expected_changes_count != null) {
    const n = (expect.expected_changes || []).length;
    if (n !== expect.require_expected_changes_count) {
      misses.push(
        `${label}expected_changes count: want ${expect.require_expected_changes_count} got ${n}`
      );
    }
  }

  return misses;
}

function loadCases(casesDir, onlyId) {
  const files = fs
    .readdirSync(casesDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const cases = [];
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(casesDir, f), 'utf8'));
    const id = raw.id || f.replace(/\.json$/, '');
    if (onlyId && id !== onlyId && f !== onlyId + '.json') continue;
    cases.push({ file: f, id, raw });
  }
  return cases;
}

function runCase(entry) {
  const { id, raw } = entry;
  const steps = raw.steps
    ? raw.steps
    : [
        {
          input: raw.input,
          expect: raw.expect,
          completeGate: raw.completeGate,
          openP0P1: raw.openP0P1,
          mode: raw.mode,
          until_kind: raw.until_kind,
          suiteGreen: raw.suiteGreen,
          cap_reason: raw.cap_reason,
          custom_until_met: raw.custom_until_met,
          status_header: raw.status_header,
          ...raw.step_opts,
        },
      ];

  const stepResults = [];
  let priorCounters = null;
  const allMisses = [];

  steps.forEach((step, i) => {
    const label = steps.length > 1 ? `step${i + 1}.` : '';
    try {
      const inherit =
        step.inherit_counters === true ||
        (step.inherit_counters !== false && i > 0 && raw.chain === true);
      const actual = runStep(
        Object.assign({}, step, {
          inherit_counters: inherit || step.inherit_counters,
        }),
        priorCounters
      );
      priorCounters = actual.phase2.counters;
      stepResults.push(actual);
      const misses = checkExpect(actual, step.expect || raw.expect, label);
      allMisses.push(...misses);
    } catch (e) {
      allMisses.push(`${label}throw: ${e.message}`);
    }
  });

  return {
    id,
    description: raw.description || '',
    tags: raw.tags || [],
    pass: allMisses.length === 0,
    misses: allMisses,
    steps: stepResults,
    expected_changes: collectExpectedChanges(raw, steps),
  };
}

function collectExpectedChanges(raw, steps) {
  const out = [];
  if (Array.isArray(raw.expected_changes)) out.push(...raw.expected_changes);
  for (const s of steps) {
    if (s.expect && Array.isArray(s.expect.expected_changes)) {
      out.push(...s.expect.expected_changes);
    }
  }
  return out;
}

function main() {
  const casesDir = path.resolve(arg('--cases-dir', DEFAULT_CASES));
  if (!fs.existsSync(casesDir)) {
    console.error('cases dir missing:', casesDir);
    process.exit(1);
  }

  if (hasFlag('--list')) {
    for (const c of loadCases(casesDir)) {
      console.log(c.id + (c.raw.description ? ' — ' + c.raw.description : ''));
    }
    process.exit(0);
  }

  const only = arg('--case', null);
  const cases = loadCases(casesDir, only);
  if (!cases.length) {
    console.error(only ? `no case matching ${only}` : 'no cases in ' + casesDir);
    process.exit(1);
  }

  // Builtin self-check of phase2 module (skip when scripts.test.sh runs it separately)
  if (!hasFlag('--skip-self-test')) {
    const { spawnSync } = require('child_process');
    const st = spawnSync(
      process.execPath,
      [path.join(ROOT, 'phase2-counters.js'), 'self-test'],
      { encoding: 'utf8' }
    );
    if (st.status !== 0) {
      process.stderr.write(st.stdout || '');
      process.stderr.write(st.stderr || '');
      console.error('phase2-counters self-test failed');
      process.exit(2);
    }
    if (hasFlag('--verbose')) process.stdout.write(st.stdout || '');
  }

  let failed = 0;
  const report = [];

  for (const entry of cases) {
    const result = runCase(entry);
    report.push(result);
    if (result.pass) {
      console.log('PASS:', result.id);
      if (result.expected_changes.length && hasFlag('--verbose')) {
        for (const ch of result.expected_changes) {
          console.log('   ·', ch);
        }
      }
    } else {
      failed++;
      console.error('FAIL:', result.id);
      for (const m of result.misses) console.error('  -', m);
      if (result.expected_changes.length) {
        console.error('  expected major changes (documentary):');
        for (const ch of result.expected_changes) {
          console.error('   ·', ch);
        }
      }
    }
  }

  const summary = {
    total: cases.length,
    failed,
    passed: cases.length - failed,
    honest_empty_token: HONEST_EMPTY,
  };

  if (hasFlag('--json')) {
    process.stdout.write(
      JSON.stringify({ summary, report }, null, 2) + '\n'
    );
  } else {
    console.log('---');
    console.log(
      failed === 0
        ? `cycle-sim PASS (${summary.passed}/${summary.total} cases)`
        : `cycle-sim FAIL (${failed}/${summary.total} failed)`
    );
  }

  process.exit(failed === 0 ? 0 : 2);
}

if (require.main === module) main();

module.exports = {
  runStep,
  runCase,
  loadCases,
  checkExpect,
  main,
};
