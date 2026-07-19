#!/usr/bin/env node
/**
 * S2 Spec-sync matrix fixtures — checker / golden row-ops (no derive engine).
 *
 * Does NOT run PLAN_SPEC_SYNC as LLM. Does NOT generate expected rows from plan text.
 * Classifies diffs between hand-authored before/after ledgers (classify-only).
 *
 * host=B scripts/spec-sync-matrix.test.js
 * comparator=classifyRowOps + Notes/Backlog string asserts
 * goldens=inline fixtures #1 skip-sync, #2 stale→add, #3a drop-claim, #3b item-complete
 *
 * Usage: node scripts/spec-sync-matrix.test.js
 * Exit: 0 all pass; 1 failure
 */
'use strict';

const {
  parseSpecValidationRows,
  ANCHOR_PREFIX_RE,
} = require('./spec-validate.js');

// Machine-consumed contract strings (B SKILL / PLAN_SPEC_SYNC matrix).
const SKIP_NOTES = (n) => `spec sync n/a: plan unchanged since iter ${n}`;
const MARKER = (n) => `<!-- spec-sync: iter ${n} -->`;
const STATUS_DROPPED_CLAIM = 'n/a: plan dropped claim';
const STATUS_ITEM_COMPLETE = 'n/a: item complete';
const NOTES_VALIDATE_DROPPED = (id) =>
  `validate ${id} dropped: plan dropped claim`;
const VALIDATE_BACKLOG = (id) => `- [ ] P1: [defect] validate ${id}: prove after fix`;

function fail(name, msg) {
  console.error(`FAIL: ${name} — ${msg}`);
  process.exitCode = 1;
}

function pass(name) {
  console.log(`PASS: ${name}`);
}

function rowKey(r) {
  return `${r.id}|${r.intention}|${r.kind}|${r.artifact}|${r.proof}|${r.status}`;
}

function rowsEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = a.map(rowKey).sort();
  const sb = b.map(rowKey).sort();
  return sa.every((k, i) => k === sb[i]);
}

/**
 * Classify-only: never invents rows. Labels adds / status changes / no-op.
 * @param {ReturnType<typeof parseSpecValidationRows>} before
 * @param {ReturnType<typeof parseSpecValidationRows>} after
 */
function classifyRowOps(before, after) {
  const bMap = new Map(before.map((r) => [r.id, r]));
  const aMap = new Map(after.map((r) => [r.id, r]));
  const ops = [];
  for (const [id, r] of aMap) {
    if (!bMap.has(id)) {
      ops.push({
        op: 'row_add',
        id,
        intention: r.intention,
        status: r.status,
      });
    } else if (bMap.get(id).status !== r.status) {
      ops.push({
        op: 'row_status',
        id,
        status: r.status,
        from: bMap.get(id).status,
      });
    }
  }
  for (const id of bMap.keys()) {
    if (!aMap.has(id)) ops.push({ op: 'row_removed', id });
  }
  if (rowsEqual(before, after)) ops.push({ op: 'no_op_rows' });
  return ops;
}

function headerFlag(text) {
  const m = String(text || '').match(/^\*\*Spec validation:\*\*\s*(.+)$/mi);
  return m ? m[1].trim() : null;
}

function hasOpenValidate(backlogText, id) {
  const re = new RegExp(
    String.raw`^\s*-\s*\[[ xX]\]\s*.*\bvalidate\s+${id}\b`,
    'mi'
  );
  return re.test(backlogText || '');
}

function sectionBody(text, heading) {
  const re = new RegExp(
    '^## ' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$',
    'm'
  );
  const parts = String(text || '').split(re);
  if (parts.length < 2) return '';
  return (parts[1] || '').split(/^## /m)[0] || '';
}

function makeLedger(opts) {
  const {
    header = 'pending',
    iter = 1,
    rows,
    notes = '',
    backlog = '',
    workSpec = '',
  } = opts;
  const table = [
    '| ID | Intention | Kind | Artifact | Proof | Status |',
    '|----|-----------|------|----------|-------|--------|',
    ...rows.map(
      (r) =>
        `| ${r.id} | ${r.intention} | ${r.kind} | ${r.artifact} | ${r.proof} | ${r.status} |`
    ),
  ].join('\n');

  return [
    '# IMPROVE_LOOP',
    '',
    `**Spec validation:** ${header}`,
    '',
    workSpec ? `## Campaign brief\n${workSpec}\n` : '',
    '## Backlog',
    backlog || '(empty)',
    '',
    '## Spec validation',
    MARKER(iter),
    table,
    '',
    '## Notes',
    notes || '(none)',
    '',
  ].join('\n');
}

// --- Fixture #1: unchanged plan → skip-sync ---
function fixture1_skipUnchanged() {
  const name = 'S2-1 skip-sync unchanged';
  const N = 4;
  const rows = [
    {
      id: 'V1',
      intention: 'Feature: foo ships',
      kind: 'suite',
      artifact: 'tests',
      proof: 'scripts.test.sh',
      status: 'pending',
    },
    {
      id: 'V2',
      intention: 'Preserve: dual-home pathspec',
      kind: 'skill-law',
      artifact: 'SKILL.md',
      proof: 'contract-check',
      status: 'pending',
    },
  ];
  const before = makeLedger({
    header: 'pending',
    iter: N,
    rows,
    notes: 'prior note',
  });
  const after = makeLedger({
    header: 'pending', // leave header untouched on skip
    iter: N,
    rows, // byte-stable row multiset
    notes: SKIP_NOTES(N),
  });

  const br = parseSpecValidationRows(before);
  const ar = parseSpecValidationRows(after);
  const ops = classifyRowOps(br, ar);

  if (!rowsEqual(br, ar)) return fail(name, 'Spec rows must be identical');
  if (!ops.some((o) => o.op === 'no_op_rows'))
    return fail(name, 'expected no_op_rows');
  if (ops.some((o) => o.op === 'row_add' || o.op === 'row_removed'))
    return fail(name, 'no thrash: no add/remove');
  if (!after.includes(SKIP_NOTES(N)))
    return fail(name, `missing skip Notes: ${SKIP_NOTES(N)}`);
  if (!after.includes(MARKER(N)))
    return fail(name, 'marker axis must remain ledger iter N');
  if (headerFlag(before) !== headerFlag(after))
    return fail(name, 'header Spec validation must be untouched on skip');
  // Anti-oracle: no complete-from-header
  if (/complete/i.test(headerFlag(after) || ''))
    return fail(name, 'no complete-from-header');

  pass(name);
}

// --- Fixture #2: stale Spec + new work-spec anchor → golden add ---
function fixture2_staleAddPending() {
  const name = 'S2-2 stale Spec golden add';
  const N = 2;
  const ANCHOR = 'widget ships green';
  const workSpec = `- Acceptance: ${ANCHOR}`;
  const beforeRows = [
    {
      id: 'V1',
      intention: 'Feature: legacy claim',
      kind: 'suite',
      artifact: 'tests',
      proof: 'scripts.test.sh',
      status: 'pending',
    },
  ];
  // Golden after: exact add — Intention copies work-spec anchor (no free invent)
  const afterRows = [
    ...beforeRows,
    {
      id: 'V2',
      intention: `Feature: ${ANCHOR}`,
      kind: 'suite',
      artifact: 'tests',
      proof: 'scripts.test.sh',
      status: 'pending',
    },
  ];
  const before = makeLedger({
    header: 'pending',
    iter: N,
    rows: beforeRows,
    workSpec,
  });
  const after = makeLedger({
    header: 'pending',
    iter: N + 1,
    rows: afterRows,
    workSpec,
    notes: 'spec sync: diverged',
  });

  const br = parseSpecValidationRows(before);
  const ar = parseSpecValidationRows(after);
  const ops = classifyRowOps(br, ar);
  const adds = ops.filter((o) => o.op === 'row_add');

  if (adds.length !== 1 || adds[0].id !== 'V2')
    return fail(name, `expected single row_add V2, got ${JSON.stringify(adds)}`);
  if (adds[0].status !== 'pending')
    return fail(name, 'added row must be pending');
  if (!adds[0].intention.includes(ANCHOR))
    return fail(name, 'added Intention must carry work-spec anchor verbatim');
  // Soundness only (not completeness): prefix + anchor in work-spec input
  for (const o of adds) {
    if (!ANCHOR_PREFIX_RE.test(o.intention))
      return fail(name, `missing anchor prefix on ${o.id}`);
    if (!workSpec.includes(ANCHOR))
      return fail(name, 'work-spec must contain anchor (fixture integrity)');
    // anchor quote present in work-spec
    const body = o.intention.replace(ANCHOR_PREFIX_RE, '');
    if (!workSpec.includes(body) && !workSpec.includes(ANCHOR))
      return fail(name, 'added Intention body not grounded in work-spec');
  }
  // no remove of V1
  if (ops.some((o) => o.op === 'row_removed'))
    return fail(name, 'must not drop prior rows without drop-claim path');
  // Forbidden: invent Kind/Proof beyond golden (golden already fixed)

  pass(name);
}

// --- Fixture #3a: plan drops claim → n/a + drop open validate ---
function fixture3a_dropClaim() {
  const name = 'S2-3a drop claim + validate lifecycle';
  const N = 5;
  const beforeRows = [
    {
      id: 'V2',
      intention: 'Feature: doomed claim',
      kind: 'L3-test',
      artifact: 'x',
      proof: 'manual',
      status: 'pending',
    },
    {
      id: 'V3',
      intention: 'Preserve: keep me',
      kind: 'skill-law',
      artifact: 'SKILL.md',
      proof: 'contract-check',
      status: 'pending',
    },
  ];
  const afterRows = [
    {
      id: 'V2',
      intention: 'Feature: doomed claim',
      kind: 'L3-test',
      artifact: 'x',
      proof: 'manual',
      status: STATUS_DROPPED_CLAIM,
    },
    {
      id: 'V3',
      intention: 'Preserve: keep me',
      kind: 'skill-law',
      artifact: 'SKILL.md',
      proof: 'contract-check',
      status: 'pending',
    },
  ];
  const before = makeLedger({
    header: 'pending',
    iter: N,
    rows: beforeRows,
    backlog: VALIDATE_BACKLOG('V2'),
  });
  const after = makeLedger({
    header: 'pending',
    iter: N,
    rows: afterRows,
    backlog: '(empty)',
    notes: NOTES_VALIDATE_DROPPED('V2'),
  });

  const br = parseSpecValidationRows(before);
  const ar = parseSpecValidationRows(after);
  const ops = classifyRowOps(br, ar);
  const st = ops.find((o) => o.op === 'row_status' && o.id === 'V2');

  if (!st || st.status !== STATUS_DROPPED_CLAIM)
    return fail(
      name,
      `expected row_status V2 → ${STATUS_DROPPED_CLAIM}, got ${JSON.stringify(st)}`
    );
  if (ops.some((o) => o.op === 'row_removed'))
    return fail(name, 'stable V-ids never renumber/remove; status n/a instead');
  const v3 = ar.find((r) => r.id === 'V3');
  if (!v3 || v3.status !== 'pending')
    return fail(name, 'unrelated Preserve row must stay pending');

  if (!hasOpenValidate(sectionBody(before, 'Backlog'), 'V2'))
    return fail(name, 'fixture integrity: before must have open validate V2');
  if (hasOpenValidate(sectionBody(after, 'Backlog'), 'V2'))
    return fail(name, 'open validate V2 must be dropped same pass');
  if (!after.includes(NOTES_VALIDATE_DROPPED('V2')))
    return fail(name, 'missing Notes validate dropped string');

  pass(name);
}

// --- Fixture #3b: item complete → Feature n/a, Preserve kept ---
function fixture3b_itemComplete() {
  const name = 'S2-3b item complete keeps Preserve';
  const N = 6;
  const beforeRows = [
    {
      id: 'V1',
      intention: 'Feature: ship widget',
      kind: 'suite',
      artifact: 'tests',
      proof: 'scripts.test.sh',
      status: 'pending',
    },
    {
      id: 'V2',
      intention: 'Preserve: dual-home A≠B≠M',
      kind: 'skill-law',
      artifact: 'SKILL.md',
      proof: 'package-parity',
      status: 'pending',
    },
  ];
  const afterRows = [
    {
      id: 'V1',
      intention: 'Feature: ship widget',
      kind: 'suite',
      artifact: 'tests',
      proof: 'scripts.test.sh',
      status: STATUS_ITEM_COMPLETE,
    },
    {
      id: 'V2',
      intention: 'Preserve: dual-home A≠B≠M',
      kind: 'skill-law',
      artifact: 'SKILL.md',
      proof: 'package-parity',
      status: 'pending',
    },
  ];
  const before = makeLedger({ header: 'pending', iter: N, rows: beforeRows });
  const after = makeLedger({ header: 'pending', iter: N, rows: afterRows });

  const br = parseSpecValidationRows(before);
  const ar = parseSpecValidationRows(after);
  const ops = classifyRowOps(br, ar);
  const st = ops.find((o) => o.op === 'row_status' && o.id === 'V1');

  if (!st || st.status !== STATUS_ITEM_COMPLETE)
    return fail(
      name,
      `expected V1 → ${STATUS_ITEM_COMPLETE}, got ${JSON.stringify(st)}`
    );
  const v2 = ar.find((r) => r.id === 'V2');
  if (!v2 || v2.status !== 'pending')
    return fail(name, 'Preserve rows must be kept (not n/a on item complete)');
  if (ops.some((o) => o.op === 'row_removed' || o.id === 'V2' && o.op === 'row_status'))
    return fail(name, 'must not thrash Preserve on item complete');
  if (ops.some((o) => o.op === 'row_add'))
    return fail(name, 'item complete is status-only, no new rows');

  pass(name);
}

function main() {
  process.exitCode = 0;
  fixture1_skipUnchanged();
  fixture2_staleAddPending();
  fixture3a_dropClaim();
  fixture3b_itemComplete();
  if (process.exitCode) {
    console.error('spec-sync-matrix: FAILED');
    process.exit(1);
  }
  console.log('---');
  console.log('spec-sync-matrix PASS (4 cases / 3 fixture ids)');
}

if (require.main === module) {
  main();
}

module.exports = {
  classifyRowOps,
  SKIP_NOTES,
  MARKER,
  STATUS_DROPPED_CLAIM,
  STATUS_ITEM_COMPLETE,
};
