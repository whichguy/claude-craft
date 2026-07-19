#!/usr/bin/env node
/**
 * Mini-parser for improve-loop multi-line Backlog item blocks (package B).
 *
 * Contiguous item block = title line + immediate clause sub-bullets.
 * Title: unchecked `- [ ] …P0:` / `P1:` (or checked for parse-only).
 * Clause: `  - Evidence:|Decision:|Preserve:|Unknown:|Acceptance:` (2–4 spaces).
 *
 * Usage:
 *   node backlog-blocks.js parse --body-file <path>
 *   node backlog-blocks.js open-count --body-file <path>
 *   node backlog-blocks.js delete --body-file <path> --title-substr <text>
 *   node backlog-blocks.js residual-forbidden --body-file <path>
 *   node backlog-blocks.js self-test
 *
 * Exit: 0 ok; 1 usage/error; 2 residual has forbidden Decision/Preserve
 *
 * Injectable: none (pure fs + parse). stdlib only.
 */
'use strict';

const fs = require('fs');

// Allow optional markdown bold on the head:
//   - Evidence: val
//   - **Evidence:** val   (colon inside or outside bold)
const CLAUSE_RE =
  /^[ \t]{2,4}-[ \t]+(?:\*\*)?(Evidence|Decision|Preserve|Unknown|Acceptance)(?:\*\*)?:(?:\*\*)?\s*(.*)$/i;
const TITLE_OPEN_RE = /^- \[ \] .*P[01]:/;
const TITLE_ANY_RE = /^- \[[ xX]\] /;
const CHECKLIST_TITLE_RE = /^- \[[ xX]\] /;

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    'usage: node backlog-blocks.js <parse|open-count|delete|residual-forbidden|self-test> [opts]'
  );
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function readBody() {
  const f = arg('--body-file');
  if (f) return fs.readFileSync(f, 'utf8');
  if (process.argv.includes('--body')) {
    const i = process.argv.indexOf('--body');
    return process.argv[i + 1] || '';
  }
  return null;
}

function normalizeHead(h) {
  return String(h || '')
    .replace(/^\*+|\*+$/g, '')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Parse a Backlog section body (no ## heading required).
 * @returns {{ items: Array<{title:string,open:boolean,clauses:Object,rawLines:string[]}> , orphans: string[] }}
 */
function parseBacklogBody(body) {
  const lines = String(body || '').split('\n');
  const items = [];
  const orphans = [];
  let cur = null;

  function flush() {
    if (cur) items.push(cur);
    cur = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (CHECKLIST_TITLE_RE.test(line)) {
      flush();
      cur = {
        title: line,
        open: line.startsWith('- [ ]'),
        clauses: {},
        rawLines: [line],
      };
      continue;
    }
    const m = line.match(CLAUSE_RE);
    if (m && cur) {
      const head = normalizeHead(m[1]);
      cur.clauses[head] = m[2] != null ? m[2] : '';
      cur.rawLines.push(line);
      continue;
    }
    // blank line ends block if next is non-clause (lookahead)
    if (cur && line.trim() === '') {
      const next = lines[i + 1];
      if (
        next == null ||
        CHECKLIST_TITLE_RE.test(next) ||
        next.startsWith('## ') ||
        (next.trim() !== '' && !CLAUSE_RE.test(next))
      ) {
        flush();
        // keep blank in stream via orphans only if no cur — skip blank between items
        continue;
      }
      cur.rawLines.push(line);
      continue;
    }
    if (cur && line.startsWith('## ')) {
      flush();
      orphans.push(line);
      continue;
    }
    if (CLAUSE_RE.test(line) && !cur) {
      orphans.push(line);
      continue;
    }
    if (cur) {
      // non-clause under title → end block, line is orphan or new content
      flush();
    }
    if (line.trim() !== '') orphans.push(line);
  }
  flush();
  return { items, orphans };
}

function openCount(body) {
  const { items } = parseBacklogBody(body);
  return items.filter((it) => it.open && TITLE_OPEN_RE.test(it.title)).length;
}

function residualHasForbiddenDecision(item) {
  if (!item || !/\[residual\]/i.test(item.title)) return false;
  return (
    Object.prototype.hasOwnProperty.call(item.clauses, 'Decision') ||
    Object.prototype.hasOwnProperty.call(item.clauses, 'Preserve')
  );
}

function residualForbiddenAny(body) {
  const { items } = parseBacklogBody(body);
  return items.some(residualHasForbiddenDecision);
}

/**
 * Delete first open item whose title includes titleSubstr (case-sensitive).
 * Removes entire contiguous rawLines block.
 */
function deleteBlock(body, titleSubstr) {
  if (!titleSubstr) throw new Error('title-substr required');
  const lines = String(body || '').split('\n');
  const { items } = parseBacklogBody(body);
  const target = items.find(
    (it) => it.open && it.title.indexOf(titleSubstr) !== -1
  );
  if (!target) return { body: String(body || ''), deleted: false };

  // Reconstruct by filtering out target.rawLines as a contiguous sequence
  const block = target.rawLines;
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i] === block[0]) {
      let match = true;
      for (let j = 0; j < block.length; j++) {
        if (lines[i + j] !== block[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        i += block.length;
        // drop one following blank if present
        if (lines[i] === '') i++;
        continue;
      }
    }
    out.push(lines[i]);
    i++;
  }
  // trim trailing excess blanks
  while (out.length && out[out.length - 1] === '') out.pop();
  return { body: out.join('\n') + (out.length ? '\n' : ''), deleted: true };
}

function selfTest() {
  const fails = [];
  function ok(cond, msg) {
    if (!cond) fails.push(msg);
  }

  const six = [
    '- [ ] P1: [defect] fix foo (a.js) — bar',
    '  - Evidence: e',
    '  - Decision: d',
    '  - Preserve: p',
    '  - Unknown: none',
    '  - Acceptance: a',
    '',
    '- [ ] P1: [residual] survey',
    '  - Evidence: r',
    '  - Acceptance: ok',
  ].join('\n');

  const p = parseBacklogBody(six);
  ok(p.items.length === 2, 'parse: 2 items');
  ok(p.items[0].clauses.Evidence === 'e', 'parse: Evidence');
  ok(p.items[0].clauses.Decision === 'd', 'parse: Decision');
  ok(openCount(six) === 2, 'open-count: 2');

  const residualBad = [
    '- [ ] P1: [residual] bad',
    '  - Evidence: e',
    '  - Decision: should not',
    '  - Acceptance: a',
  ].join('\n');
  ok(residualForbiddenAny(residualBad) === true, 'residual forbidden Decision');
  ok(residualForbiddenAny(six) === false, 'residual good ok');

  const orphan = '  - Evidence: alone\n- [ ] P1: [defect] x — y\n  - Evidence: e\n  - Decision: d\n  - Preserve: p\n  - Unknown: none\n  - Acceptance: a\n';
  const po = parseBacklogBody(orphan);
  ok(po.orphans.some((l) => /Evidence: alone/.test(l)), 'orphan clause');
  ok(openCount(orphan) === 1, 'open-count ignores sub-bullets');

  const del = deleteBlock(six, 'fix foo');
  ok(del.deleted === true, 'delete: found');
  ok(openCount(del.body) === 1, 'delete: open-count 1');
  ok(!/fix foo/.test(del.body), 'delete: title gone');
  ok(/\[residual\]/.test(del.body), 'delete: residual remains');

  // bold heads
  const bold = '- [ ] P1: [defect] z — z\n  - **Evidence:** ee\n  - **Decision:** dd\n  - **Preserve:** pp\n  - **Unknown:** none\n  - **Acceptance:** aa\n';
  const pb = parseBacklogBody(bold);
  ok(pb.items[0] && pb.items[0].clauses.Evidence === 'ee', 'bold Evidence');

  if (fails.length) {
    console.error('self-test FAIL:\n' + fails.map((f) => '  - ' + f).join('\n'));
    process.exit(1);
  }
  console.log('backlog-blocks self-test PASS');
  process.exit(0);
}

// --- CLI (main only) ---
if (require.main === module) {
  const cmd = process.argv[2];
  if (!cmd) usage();

  if (cmd === 'self-test') {
    selfTest();
  }

  const body = readBody();
  if (body == null) usage('missing --body-file or --body');

  if (cmd === 'parse') {
    const r = parseBacklogBody(body);
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    process.exit(0);
  }

  if (cmd === 'open-count') {
    process.stdout.write(String(openCount(body)) + '\n');
    process.exit(0);
  }

  if (cmd === 'delete') {
    const sub = arg('--title-substr');
    if (!sub) usage('delete needs --title-substr');
    const r = deleteBlock(body, sub);
    process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    process.exit(0);
  }

  if (cmd === 'residual-forbidden') {
    const bad = residualForbiddenAny(body);
    process.stdout.write(JSON.stringify({ forbidden: bad }) + '\n');
    process.exit(bad ? 2 : 0);
  }

  usage('unknown command: ' + cmd);
}

module.exports = {
  parseBacklogBody,
  openCount,
  deleteBlock,
  residualHasForbiddenDecision,
  residualForbiddenAny,
};
