#!/usr/bin/env node
/**
 * phase2-counters.js — pure Phase-2 counter matrix (improve-loop law)
 *
 * Encodes law/improve-loop/phase-2-learn.md + R9 honest-empty as a falsifiable
 * function. API-free. Does **not** write ledgers or run the agent.
 *
 * Usage:
 *   node phase2-counters.js self-test
 *   node -e "require('./phase2-counters').evaluatePhase2(...)"
 *
 * Exit: 0 ok; 2 self-test fail
 */
'use strict';

const HONEST_EMPTY =
  'honest-empty: residual survey — no non-weak open gaps';
const HONEST_EMPTY_MISSING = 'honest-empty missing — streak held';

/**
 * @typedef {{
 *   consecutive_no_progress: number,
 *   consecutive_same_error: number,
 *   consecutive_non_material_cycles: number,
 *   error_signature: string,
 * }} Counters
 *
 * @typedef {{
 *   status: 'PASS'|'FAIL'|string,
 *   outcome: 'confirmed'|'partial'|'disproven'|'blocked'|string,
 *   changedPaths?: string[],
 *   notes?: string,
 *   pathKind?: 'normal'|'empty_backlog_lightweight',
 *   untilKind?: 'default'|'custom'|'none',
 *   suiteGreen?: boolean,
 *   counters: Counters,
 *   errorSignatureNew?: string|null,
 * }} Phase2Input
 *
 * @typedef {{
 *   counters: Counters,
 *   row: string,
 *   nonMaterial: 'plus1'|'reset'|'hold',
 *   honestEmptyAttested: boolean,
 *   notesAppend: string[],
 *   advancedNonMaterial: boolean,
 * }} Phase2Result
 */

function cloneCounters(c) {
  return {
    consecutive_no_progress: Number(c.consecutive_no_progress) || 0,
    consecutive_same_error: Number(c.consecutive_same_error) || 0,
    consecutive_non_material_cycles:
      Number(c.consecutive_non_material_cycles) || 0,
    error_signature:
      c.error_signature == null || c.error_signature === ''
        ? 'none'
        : String(c.error_signature),
  };
}

function hasHonestEmpty(notes) {
  return typeof notes === 'string' && notes.includes(HONEST_EMPTY);
}

/** Notes explicitly mark lands as P2/YAGNI-only (non-material). */
function isP2YagniOnly(notes) {
  if (typeof notes !== 'string') return false;
  return (
    /P2\/YAGNI-only/i.test(notes) ||
    /P2\/YAGNI only/i.test(notes) ||
    /\bnotes\s+explicitly\s+P2\/YAGNI/i.test(notes)
  );
}

/**
 * Apply non-material +1 under R9. Returns whether streak advanced.
 * @param {Counters} counters
 * @param {string} notes
 * @param {string[]} notesAppend
 */
function tryNonMaterialPlus1(counters, notes, notesAppend) {
  if (hasHonestEmpty(notes)) {
    counters.consecutive_non_material_cycles += 1;
    return true;
  }
  notesAppend.push(HONEST_EMPTY_MISSING);
  return false;
}

/**
 * Pure Phase-2 counter update.
 * @param {Phase2Input} input
 * @returns {Phase2Result}
 */
function evaluatePhase2(input) {
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('input must be an object'), { code: 2 });
  }
  const notes = input.notes == null ? '' : String(input.notes);
  const paths = Array.isArray(input.changedPaths) ? input.changedPaths : [];
  const nonLedger = paths.filter((p) => p && !/^IMPROVE_LOOP\.md$/i.test(p));
  const emptyPaths = nonLedger.length === 0;
  const counters = cloneCounters(input.counters || {});
  const notesAppend = [];
  const attested = hasHonestEmpty(notes);
  const pathKind = input.pathKind || 'normal';
  const outcome = String(input.outcome || '').toLowerCase();
  const status = String(input.status || '').toUpperCase();
  const untilKind = input.untilKind || 'default';
  const suiteGreen = input.suiteGreen === true;
  const priorSig =
    counters.error_signature === 'none' || !counters.error_signature
      ? 'none'
      : counters.error_signature;
  const newSig =
    input.errorSignatureNew == null || input.errorSignatureNew === ''
      ? 'none'
      : String(input.errorSignatureNew);

  // --- Rule 4: empty-backlog lightweight (holds stall counters + signature) ---
  if (pathKind === 'empty_backlog_lightweight') {
    // Stalls held exactly; only non-material may advance under R9 when green.
    let advanced = false;
    let nonMaterial = 'hold';
    const green =
      status === 'PASS' || suiteGreen === true || input.suiteGreen === true;
    if (green) {
      advanced = tryNonMaterialPlus1(counters, notes, notesAppend);
      nonMaterial = advanced ? 'plus1' : 'hold';
    }
    return {
      counters,
      row: 'empty_backlog_lightweight',
      nonMaterial,
      honestEmptyAttested: attested,
      notesAppend,
      advancedNonMaterial: advanced,
      untilKind,
    };
  }

  // --- Precedence 1: Outcome blocked (any STATUS) ---
  if (outcome === 'blocked') {
    counters.consecutive_no_progress += 1;
    // same-error + signature held
    return {
      counters,
      row: 'blocked',
      nonMaterial: 'hold',
      honestEmptyAttested: attested,
      notesAppend,
      advancedNonMaterial: false,
    };
  }

  // --- Precedence 2: PASS + empty CHANGED_PATHS ---
  if (status === 'PASS' && emptyPaths) {
    counters.consecutive_no_progress += 1;
    counters.consecutive_same_error = 0;
    counters.error_signature = 'none';
    const advanced = tryNonMaterialPlus1(counters, notes, notesAppend);
    return {
      counters,
      row: 'empty_changed_paths',
      nonMaterial: advanced ? 'plus1' : 'hold',
      honestEmptyAttested: attested,
      notesAppend,
      advancedNonMaterial: advanced,
    };
  }

  // --- PASS rows (non-empty or remaining) ---
  if (status === 'PASS') {
    // P2/YAGNI-only before default material (table order load-bearing)
    if (isP2YagniOnly(notes) && !emptyPaths) {
      counters.consecutive_no_progress = 0;
      counters.consecutive_same_error = 0;
      counters.error_signature = 'none';
      const advanced = tryNonMaterialPlus1(counters, notes, notesAppend);
      return {
        counters,
        row: 'p2_yagni_only',
        nonMaterial: advanced ? 'plus1' : 'hold',
        honestEmptyAttested: attested,
        notesAppend,
        advancedNonMaterial: advanced,
      };
    }

    if (outcome === 'disproven') {
      counters.consecutive_no_progress += 1;
      counters.consecutive_same_error = 0;
      counters.error_signature = 'none';
      const advanced = tryNonMaterialPlus1(counters, notes, notesAppend);
      return {
        counters,
        row: 'disproven',
        nonMaterial: advanced ? 'plus1' : 'hold',
        honestEmptyAttested: attested,
        notesAppend,
        advancedNonMaterial: advanced,
      };
    }

    // Default material: non-empty non-ledger paths
    if (!emptyPaths) {
      counters.consecutive_no_progress = 0;
      counters.consecutive_same_error = 0;
      counters.error_signature = 'none';
      counters.consecutive_non_material_cycles = 0;
      return {
        counters,
        row: 'material_land',
        nonMaterial: 'reset',
        honestEmptyAttested: attested,
        notesAppend,
        advancedNonMaterial: false,
      };
    }
  }

  // --- FAIL rows ---
  if (status === 'FAIL') {
    counters.consecutive_no_progress += 1;
    if (priorSig !== 'none' && newSig === priorSig) {
      counters.consecutive_same_error += 1;
      // keep signature
      return {
        counters,
        row: 'fail_same_signature',
        nonMaterial: 'hold',
        honestEmptyAttested: attested,
        notesAppend,
        advancedNonMaterial: false,
      };
    }
    // differs or prior was none
    counters.consecutive_same_error = 1;
    counters.error_signature = newSig === 'none' ? 'fail:unknown' : newSig;
    return {
      counters,
      row: 'fail_new_signature',
      nonMaterial: 'hold',
      honestEmptyAttested: attested,
      notesAppend,
      advancedNonMaterial: false,
    };
  }

  throw Object.assign(
    new Error(
      `unhandled Phase-2 input status=${status} outcome=${outcome} emptyPaths=${emptyPaths}`
    ),
    { code: 2 }
  );
}

function selfTest() {
  const ok = (cond, msg) => {
    if (!cond) {
      console.error('FAIL:', msg);
      process.exit(2);
    }
    console.log('PASS:', msg);
  };

  const base = (partial) =>
    Object.assign(
      {
        status: 'PASS',
        outcome: 'partial',
        changedPaths: [],
        notes: '',
        counters: {
          consecutive_no_progress: 0,
          consecutive_same_error: 0,
          consecutive_non_material_cycles: 0,
          error_signature: 'none',
        },
      },
      partial
    );

  // R9: empty paths without attestation → hold non-material
  {
    const r = evaluatePhase2(base({ notes: 'residual survey only' }));
    ok(r.row === 'empty_changed_paths', 'empty paths row');
    ok(r.counters.consecutive_non_material_cycles === 0, 'R9 hold streak');
    ok(r.counters.consecutive_no_progress === 1, 'empty paths no-progress +1');
    ok(
      r.notesAppend.includes(HONEST_EMPTY_MISSING),
      'notesAppend honest-empty missing'
    );
  }

  // R9: with attestation → +1
  {
    const r = evaluatePhase2(
      base({
        notes: HONEST_EMPTY,
        counters: {
          consecutive_no_progress: 0,
          consecutive_same_error: 0,
          consecutive_non_material_cycles: 1,
          error_signature: 'none',
        },
      })
    );
    ok(r.advancedNonMaterial === true, 'R9 advances');
    ok(r.counters.consecutive_non_material_cycles === 2, 'streak 1→2');
  }

  // Material land resets non-material
  {
    const r = evaluatePhase2(
      base({
        outcome: 'confirmed',
        changedPaths: ['src/foo.js'],
        notes: HONEST_EMPTY,
        counters: {
          consecutive_no_progress: 2,
          consecutive_same_error: 0,
          consecutive_non_material_cycles: 1,
          error_signature: 'none',
        },
      })
    );
    ok(r.row === 'material_land', 'material row');
    ok(r.counters.consecutive_non_material_cycles === 0, 'material resets nm');
    ok(r.counters.consecutive_no_progress === 0, 'material resets no-progress');
  }

  // P2/YAGNI without R9 → hold nm (not material reset)
  {
    const r = evaluatePhase2(
      base({
        outcome: 'confirmed',
        changedPaths: ['docs/note.md'],
        notes: 'lands are P2/YAGNI-only',
        counters: {
          consecutive_no_progress: 1,
          consecutive_same_error: 0,
          consecutive_non_material_cycles: 1,
          error_signature: 'none',
        },
      })
    );
    ok(r.row === 'p2_yagni_only', 'p2 yagni row');
    ok(r.counters.consecutive_non_material_cycles === 1, 'p2 hold without R9');
    ok(r.counters.consecutive_no_progress === 0, 'p2 resets no-progress');
  }

  // Blocked holds nm, +1 no-progress
  {
    const r = evaluatePhase2(
      base({
        status: 'PASS',
        outcome: 'blocked',
        changedPaths: ['x.js'],
        counters: {
          consecutive_no_progress: 0,
          consecutive_same_error: 2,
          consecutive_non_material_cycles: 1,
          error_signature: 'sigA',
        },
      })
    );
    ok(r.row === 'blocked', 'blocked row');
    ok(r.counters.consecutive_no_progress === 1, 'blocked no-progress +1');
    ok(r.counters.consecutive_same_error === 2, 'blocked holds same-error');
    ok(r.counters.error_signature === 'sigA', 'blocked holds signature');
    ok(r.counters.consecutive_non_material_cycles === 1, 'blocked holds nm');
  }

  // FAIL same signature
  {
    const r = evaluatePhase2(
      base({
        status: 'FAIL',
        outcome: 'partial',
        changedPaths: ['x.js'],
        errorSignatureNew: 'test:foo',
        counters: {
          consecutive_no_progress: 0,
          consecutive_same_error: 1,
          consecutive_non_material_cycles: 0,
          error_signature: 'test:foo',
        },
      })
    );
    ok(r.row === 'fail_same_signature', 'fail same sig row');
    ok(r.counters.consecutive_same_error === 2, 'same-error +1');
    ok(r.counters.consecutive_non_material_cycles === 0, 'fail holds nm');
  }

  // Lightweight holds stalls
  {
    const r = evaluatePhase2(
      base({
        pathKind: 'empty_backlog_lightweight',
        status: 'PASS',
        notes: HONEST_EMPTY,
        counters: {
          consecutive_no_progress: 2,
          consecutive_same_error: 1,
          consecutive_non_material_cycles: 0,
          error_signature: 'old',
        },
      })
    );
    ok(r.row === 'empty_backlog_lightweight', 'lightweight row');
    ok(r.counters.consecutive_no_progress === 2, 'lightweight holds no-progress');
    ok(r.counters.consecutive_same_error === 1, 'lightweight holds same-error');
    ok(r.counters.error_signature === 'old', 'lightweight holds signature');
    ok(r.counters.consecutive_non_material_cycles === 1, 'lightweight R9 +1');
  }

  console.log('phase2-counters self-test PASS');
}

if (require.main === module) {
  if (process.argv[2] === 'self-test') {
    selfTest();
    process.exit(0);
  }
  console.error('usage: node phase2-counters.js self-test');
  process.exit(1);
}

module.exports = {
  evaluatePhase2,
  hasHonestEmpty,
  isP2YagniOnly,
  HONEST_EMPTY,
  HONEST_EMPTY_MISSING,
  selfTest,
};
