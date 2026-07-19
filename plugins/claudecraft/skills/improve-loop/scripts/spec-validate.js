#!/usr/bin/env node
/**
 * spec-validate.js — pure helpers for PLAN_VALIDATE / Phase 3v
 *
 * Parse ## Spec validation rows; decide seed lines for failed V-ids; dedupe vs backlog.
 * Orchestrator runs Proofs and writes Status cells; this module is API-free / deterministic.
 *
 * Usage:
 *   node spec-validate.js self-test
 *   node -e "require('./spec-validate.js')"  # library
 *
 * Exit: 0 ok; 1 usage; 2 self-test fail
 */
'use strict';

const KINDS = new Set([
  'suite',
  'L3-test',
  'l3-test',
  'skill-law',
  'prose-sweep',
  'dual-home',
  'manual',
]);

/**
 * Parse markdown table rows under ## Spec validation.
 * @param {string} planText
 * @returns {{ id: string, intention: string, kind: string, artifact: string, proof: string, status: string }[]}
 */
function parseSpecValidationRows(planText) {
  const section = sectionBody(planText, /^## Spec validation\s*$/m);
  if (!section) return [];
  const rows = [];
  for (const line of section.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    if (/^\|\s*ID\s*\|/i.test(t) || /^\|\s*-+/.test(t)) continue;
    const cells = splitTableRow(t);
    if (cells.length < 6) continue;
    const id = cells[0].trim();
    if (!/^V\d+$/i.test(id)) continue;
    rows.push({
      id: id.toUpperCase().replace(/^v/i, 'V'),
      intention: cells[1].trim(),
      kind: cells[2].trim(),
      artifact: cells[3].trim(),
      proof: cells[4].trim(),
      status: (cells[5] || 'pending').trim().toLowerCase(),
    });
  }
  return rows;
}

function splitTableRow(line) {
  // | a | b | c | → cells without outer empties
  const parts = line.split('|').map((s) => s.trim());
  if (parts[0] === '') parts.shift();
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

function sectionBody(text, headingRe) {
  const m = text.split(headingRe);
  if (m.length < 2) return '';
  return (m[1] || '').split(/^## /m)[0] || '';
}

/**
 * Is this kind executable for unattended complete blocking?
 * @param {string} kind
 */
function isExecutableKind(kind) {
  const k = (kind || '').toLowerCase().replace(/\s+/g, '-');
  if (k === 'manual') return false;
  if (k === 'l3-test' || k === 'suite' || k === 'skill-law' || k === 'prose-sweep' || k === 'dual-home')
    return true;
  // tolerate "suite | L3-test" multi tokens — first token
  const first = k.split(/[|,]/)[0];
  return first !== 'manual' && first.length > 0;
}

/**
 * Header flag from row statuses (executable only for pass).
 * @param {ReturnType<typeof parseSpecValidationRows>} rows
 * @returns {'n/a'|'pending'|'pass'}
 */
function headerFlagFromRows(rows) {
  if (!rows.length) return 'n/a';
  const exec = rows.filter((r) => isExecutableKind(r.kind) && r.status !== 'n/a');
  if (!exec.length) {
    const anyNonNa = rows.some((r) => r.status !== 'n/a');
    return anyNonNa ? 'pending' : 'n/a';
  }
  if (exec.every((r) => r.status === 'pass')) return 'pass';
  return 'pending';
}

/**
 * Build seed titles for failed executable rows, deduped against backlog text.
 * @param {ReturnType<typeof parseSpecValidationRows>} rows
 * @param {string} backlogText — ## Backlog section body
 * @returns {{ id: string, title: string, evidence: string }[]}
 */
function seedLinesForFails(rows, backlogText) {
  const seeds = [];
  const bl = backlogText || '';
  for (const r of rows) {
    if (!isExecutableKind(r.kind)) continue;
    if (r.status !== 'fail') continue;
    const token = `validate ${r.id}`;
    // dedupe: open or any line already mentioning validate V<k>
    if (new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(bl)) continue;
    if (seeds.some((s) => s.id === r.id)) continue;
    const short = (r.intention || r.id).slice(0, 80);
    const art = (r.artifact || '—').slice(0, 60);
    seeds.push({
      id: r.id,
      title: `- [ ] P1: [defect] validate ${r.id}: ${short} (${art})`,
      evidence: `Proof failed for ${r.id}: ${(r.proof || '').slice(0, 120)}`,
      // Orchestrator should set on re-seed after a prior attempt:
      // Notes: fix target: product | proof
      notesHint: 'fix target: product | proof',
    });
  }
  return seeds;
}

/**
 * Whether T2 missing-section seed is needed.
 * @param {string} planText
 * @param {{ required?: boolean }} opts
 */
function needsWriteSectionSeed(planText, opts = {}) {
  if (!opts.required) return false;
  const rows = parseSpecValidationRows(planText);
  if (rows.length > 0) return false;
  const bl = sectionBody(planText, /^## Backlog\s*$/m);
  if (/write Spec validation section/i.test(bl)) return false;
  return true;
}

function writeSectionSeedTitle() {
  return '- [ ] P1: [defect] write Spec validation section (required at tier T2)';
}

/** Plan-anchor prefixes required on non-n/a Intention cells (PLAN_SPEC_SOFT). */
const ANCHOR_PREFIX_RE =
  /^(Feature|Preserve|Regression|Scope|Assumption|Done-when|Lock):\s*/i;

/**
 * Soft-check: warn when Intention lacks a plan-anchor prefix.
 * Warnings only — never a complete gate.
 * @param {ReturnType<typeof parseSpecValidationRows>} rows
 * @returns {{ ok: boolean, warnings: { id: string, reason: string }[] }}
 */
function softCheckIntentions(rows) {
  const warnings = [];
  for (const r of rows || []) {
    if ((r.status || '').toLowerCase() === 'n/a') continue;
    const intention = (r.intention || '').trim();
    if (!intention) {
      warnings.push({ id: r.id, reason: 'empty Intention' });
      continue;
    }
    if (!ANCHOR_PREFIX_RE.test(intention)) {
      warnings.push({ id: r.id, reason: 'missing plan-anchor prefix' });
    }
  }
  return { ok: warnings.length === 0, warnings };
}

/**
 * Soft-check: caller reports plan changed since last sync marker.
 * @param {{ plan_changed_since_sync?: boolean, markerIter?: number|string|null }} opts
 * @returns {{ warning: string } | null}
 */
function softCheckSyncStale(opts = {}) {
  if (opts.plan_changed_since_sync === true) {
    const m =
      opts.markerIter != null && opts.markerIter !== ''
        ? ` since iter ${opts.markerIter}`
        : '';
    return { warning: `plan may have changed since last spec-sync marker${m}` };
  }
  return null;
}

// --- self-test ---
function selfTest() {
  const ok = (cond, msg) => {
    if (!cond) {
      console.error('FAIL:', msg);
      process.exit(2);
    }
    console.log('PASS:', msg);
  };

  const plan = `
# Improve Loop: t
**Spec validation:** pending

## Spec validation
| ID | Intention | Kind | Artifact(s) | Proof | Status |
|---|---|---|---|---|---|
| V1 | dual-read | L3-test | scripts/ledger-status.js | node tests | fail |
| V2 | prose | skill-law | SKILL.md | rg -n '## Log' | pass |
| V3 | human | manual | — | look | pending |

## Backlog
- [ ] P1: something else — why
`;

  const rows = parseSpecValidationRows(plan);
  ok(rows.length === 3, 'parse 3 rows');
  ok(rows[0].id === 'V1' && rows[0].status === 'fail', 'V1 fail');
  ok(isExecutableKind('manual') === false, 'manual not executable');
  ok(isExecutableKind('L3-test') === true, 'L3-test executable');
  ok(headerFlagFromRows(rows) === 'pending', 'header pending when fail');

  const bl = sectionBody(plan, /^## Backlog\s*$/m);
  const seeds = seedLinesForFails(rows, bl);
  ok(seeds.length === 1 && seeds[0].id === 'V1', 'one seed for V1');
  ok(/validate V1/.test(seeds[0].title), 'seed title has validate V1');

  const bl2 = bl + '\n' + seeds[0].title + '\n';
  const seeds2 = seedLinesForFails(rows, bl2);
  ok(seeds2.length === 0, 'dedupe seed');

  const allPass = rows.map((r) =>
    isExecutableKind(r.kind) ? { ...r, status: 'pass' } : r
  );
  ok(headerFlagFromRows(allPass) === 'pass', 'header pass when executable pass');

  ok(needsWriteSectionSeed('# x\n## Backlog\n', { required: true }) === true, 'need section seed');
  ok(needsWriteSectionSeed(plan, { required: true }) === false, 'no section seed when rows');
  ok(writeSectionSeedTitle().includes('Spec validation'), 'write section title');

  // PLAN_SPEC_SOFT
  const softBad = softCheckIntentions([
    { id: 'V1', intention: 'dual-read', kind: 'L3-test', status: 'fail' },
    { id: 'V2', intention: 'Preserve: x', kind: 'suite', status: 'pass' },
    { id: 'V3', intention: 'Scope: y', kind: 'manual', status: 'n/a' },
  ]);
  ok(softBad.ok === false, 'soft missing prefix not ok');
  ok(softBad.warnings.length === 1 && softBad.warnings[0].id === 'V1', 'soft warns V1 only');
  const softGood = softCheckIntentions([
    { id: 'V1', intention: 'Feature: dual-read', kind: 'L3-test', status: 'fail' },
  ]);
  ok(softGood.ok === true, 'soft with Feature: ok');
  ok(softCheckSyncStale({ plan_changed_since_sync: true, markerIter: 3 })?.warning, 'soft stale warning');
  ok(softCheckSyncStale({}) === null, 'soft stale null when unchanged');

  console.log('spec-validate self-test PASS');
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'self-test') {
    selfTest();
    process.exit(0);
  }
  console.error('usage: node spec-validate.js self-test');
  process.exit(1);
}

module.exports = {
  parseSpecValidationRows,
  isExecutableKind,
  headerFlagFromRows,
  seedLinesForFails,
  needsWriteSectionSeed,
  writeSectionSeedTitle,
  softCheckIntentions,
  softCheckSyncStale,
  ANCHOR_PREFIX_RE,
  KINDS,
};
