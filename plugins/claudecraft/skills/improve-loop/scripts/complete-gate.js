#!/usr/bin/env node
/**
 * complete-gate.js — pure R7 Status complete evaluator (WP1)
 *
 * Honesty (Fable next-arc): improve-loop has **no Status CLI**. Status: complete is
 * written by the orchestrator following SKILL law into IMPROVE_LOOP.md. This module
 * encodes that law as a falsifiable pure function + truth-table self-test so R7 is
 * pinned at a real evaluation layer (not greps alone). It does **not** claim L1
 * agent-e2e or filesystem Status mutation.
 *
 * R7: residual×2 (consecutive-non-material-cycles >= 2) + open P0/P1 = 0 + green suite
 * is the **sole** path to Status complete. Transitions only (does not refuse
 * hand-edited complete on disk).
 *
 * Usage:
 *   node complete-gate.js self-test
 *   node -e "require('./complete-gate.js')"
 *
 * Exit: 0 ok; 2 self-test fail
 */
'use strict';

/**
 * @param {{
 *   openP0P1: number,
 *   consecutiveNonMaterial: number,
 *   suiteGreen: boolean,
 *   allVPass?: boolean,
 *   headerSpecPass?: boolean,
 *   honestEmptyAttested?: boolean,
 * }} input
 * @returns {{ complete: boolean, reason: string }}
 *
 * R9: when `honestEmptyAttested` is provided and false, complete is refused even if
 * streak ≥ 2 (orchestrator should not advance streak without attestation; this gate
 * catches callers that pass a synthetic streak). Omitted → legacy R7 cells only.
 */
function evaluateComplete(input) {
  const open = Number(input.openP0P1) || 0;
  const streak = Number(input.consecutiveNonMaterial) || 0;
  const suite = input.suiteGreen === true;
  // allVPass / headerSpecPass never unlock complete alone
  if (open > 0) {
    return { complete: false, reason: 'open_p0p1' };
  }
  if (streak < 2) {
    return { complete: false, reason: 'residual_streak_lt_2' };
  }
  if (input.honestEmptyAttested === false) {
    return { complete: false, reason: 'honest_empty_missing' };
  }
  if (!suite) {
    return { complete: false, reason: 'suite_not_green' };
  }
  return { complete: true, reason: 'r7_residual2_and_green_suite' };
}

function selfTest() {
  const ok = (cond, msg) => {
    if (!cond) {
      console.error('FAIL:', msg);
      process.exit(2);
    }
    console.log('PASS:', msg);
  };

  // Truth table (Fable WP1 cells 1–4, 6–7)
  ok(
    evaluateComplete({ openP0P1: 0, consecutiveNonMaterial: 2, suiteGreen: true }).complete ===
      true,
    'cell1 residual×2 + green → complete'
  );
  ok(
    evaluateComplete({ openP0P1: 0, consecutiveNonMaterial: 2, suiteGreen: false }).complete ===
      false,
    'cell2 residual×2 + red suite → not complete'
  );
  ok(
    evaluateComplete({ openP0P1: 0, consecutiveNonMaterial: 1, suiteGreen: true }).complete ===
      false,
    'cell3 residual×1 + green → not complete'
  );
  ok(
    evaluateComplete({ openP0P1: 0, consecutiveNonMaterial: 0, suiteGreen: true }).complete ===
      false,
    'cell4 residual×0 + green → not complete'
  );
  ok(
    evaluateComplete({
      openP0P1: 0,
      consecutiveNonMaterial: 0,
      suiteGreen: true,
      allVPass: true,
    }).complete === false,
    'cell6 all V pass alone → not complete'
  );
  ok(
    evaluateComplete({
      openP0P1: 0,
      consecutiveNonMaterial: 0,
      suiteGreen: true,
      headerSpecPass: true,
    }).complete === false,
    'cell7 header Spec pass alone → not complete'
  );
  ok(
    evaluateComplete({ openP0P1: 1, consecutiveNonMaterial: 2, suiteGreen: true }).complete ===
      false,
    'open P0/P1 blocks complete'
  );
  // Reachable-fail demo: invert streak gate would falsely complete — prove our gate catches streak=1
  const invertedWouldLie =
    evaluateComplete({ openP0P1: 0, consecutiveNonMaterial: 1, suiteGreen: true }).complete;
  ok(invertedWouldLie === false, 'reachable-fail: streak=1 cannot complete (suite would catch invert)');

  // R9 — honest-empty: explicit false refuses complete even at residual×2 + green
  ok(
    evaluateComplete({
      openP0P1: 0,
      consecutiveNonMaterial: 2,
      suiteGreen: true,
      honestEmptyAttested: false,
    }).complete === false,
    'R9: honestEmptyAttested=false blocks complete at residual×2'
  );
  ok(
    evaluateComplete({
      openP0P1: 0,
      consecutiveNonMaterial: 2,
      suiteGreen: true,
      honestEmptyAttested: true,
    }).complete === true,
    'R9: honestEmptyAttested=true allows residual×2 complete'
  );
  ok(
    evaluateComplete({ openP0P1: 0, consecutiveNonMaterial: 2, suiteGreen: true }).complete ===
      true,
    'R9: omitted honestEmptyAttested keeps legacy residual×2 path'
  );

  console.log('complete-gate self-test PASS');
}

if (require.main === module) {
  if (process.argv[2] === 'self-test') {
    selfTest();
    process.exit(0);
  }
  console.error('usage: node complete-gate.js self-test');
  process.exit(1);
}

module.exports = { evaluateComplete };
