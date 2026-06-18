#!/usr/bin/env node
// Per-row quorum aggregator. Reads <run-dir>/r1..rk/grade.json, applies
// quorum, writes <run-dir>/grade.json with per-row pass_count/pass_rate/
// actual_excerpts. Exits non-zero if overall=FAIL.
//
// Quorum math: "all" → k, "majority" → Math.floor(k/2)+1 (strict majority;
// k=2→2, k=3→2, k=4→3, k=5→3 — NEVER passes on a 50% tie), positive int n
// → n (validated 1≤n≤k by grade-run.js's validateFixture).

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n[\s\S]*$/;

function parseFrontmatter(fixturePath) {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const m = FRONTMATTER_RE.exec(raw);
  if (!m) throw new Error(`fixture missing frontmatter: ${fixturePath}`);
  return yaml.load(m[1]);
}

function quorumThreshold(quorum, k) {
  if (quorum === 'all') return k;
  if (quorum === 'majority') return Math.floor(k / 2) + 1;
  if (Number.isInteger(quorum) && quorum >= 1 && quorum <= k) return quorum;
  throw new Error(`invalid quorum: ${JSON.stringify(quorum)} (k=${k})`);
}

function aggregateRows(perReplicaGrades, quorum) {
  const k = perReplicaGrades.length;
  if (k === 0) throw new Error('aggregateRows: no replicas');
  const threshold = quorumThreshold(quorum, k);

  // Index rows by id across all replicas. All replicas should produce the
  // same row ids (same fixture); if not, surface the mismatch as a FAIL row.
  const allIds = new Set();
  for (const g of perReplicaGrades) for (const r of g.rows) allIds.add(r.id);

  const aggregated = [];
  for (const id of allIds) {
    const replicaRows = perReplicaGrades.map(g => g.rows.find(r => r.id === id));
    const missing = replicaRows.some(r => r === undefined);
    let kind, spec;
    for (const r of replicaRows) {
      if (r) { kind = r.kind; spec = r.spec; break; }
    }
    if (missing) {
      aggregated.push({
        id,
        kind: kind || 'unknown',
        verdict: 'FAIL',
        actual_excerpt: `row ${id} missing from ${replicaRows.filter(r => !r).length}/${k} replicas`,
        spec: spec || null,
        pass_count: 0,
        runs: k,
        pass_rate: `0/${k}`,
        actual_excerpts: [],
      });
      continue;
    }
    const passes = replicaRows.filter(r => r.verdict === 'PASS').length;
    const passed = passes >= threshold;
    const failExcerpts = Array.from(new Set(
      replicaRows
        .filter(r => r.verdict !== 'PASS')
        .map(r => r.actual_excerpt || '')
        .filter(Boolean)
    ));
    aggregated.push({
      id,
      kind: kind || 'unknown',
      verdict: passed ? 'PASS' : 'FAIL',
      actual_excerpt: passed ? '' : (failExcerpts[0] || ''),
      spec: spec || null,
      pass_count: passes,
      runs: k,
      pass_rate: `${passes}/${k}`,
      actual_excerpts: failExcerpts,
    });
  }
  return aggregated;
}

function aggregate(fixturePath, runDir) {
  const fm = parseFrontmatter(fixturePath);
  const runs = fm.runs !== undefined ? Number(fm.runs) : 1;
  const quorum = fm.quorum !== undefined ? fm.quorum : 'majority';

  const grades = [];
  for (let i = 1; i <= runs; i++) {
    const p = path.join(runDir, `r${i}`, 'grade.json');
    if (!fs.existsSync(p)) {
      throw new Error(`missing replica grade: ${p}`);
    }
    grades.push(JSON.parse(fs.readFileSync(p, 'utf8')));
  }
  const rows = aggregateRows(grades, quorum);
  const overall = rows.every(r => r.verdict === 'PASS') ? 'PASS' : 'FAIL';
  const result = {
    fixture: fm.name || path.basename(fixturePath),
    overall,
    runs,
    quorum,
    rows,
  };
  fs.writeFileSync(path.join(runDir, 'grade.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (require.main === module) {
  const [fixturePath, runDir] = process.argv.slice(2);
  if (!fixturePath || !runDir) {
    process.stderr.write('usage: grade-aggregate.js <fixture.md> <run-dir>\n');
    process.exit(2);
  }
  try {
    const r = aggregate(path.resolve(fixturePath), path.resolve(runDir));
    process.exit(r.overall === 'PASS' ? 0 : 1);
  } catch (e) {
    process.stderr.write(`grade-aggregate.js: ${e.message}\n`);
    process.exit(2);
  }
}

module.exports = { aggregate, aggregateRows, quorumThreshold };
