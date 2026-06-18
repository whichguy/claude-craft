'use strict';

// Live LLM-bench mocha wrapper (V2).
// Gated: entire suite skipped unless RUN_LLM_BENCH=1.
// Each fixture's describe()'s before() spawns run-bench.js (k=runs replicas
// in parallel; for k=1 the aggregator is skipped and r1/grade.json is
// copied up verbatim). Each pass_conditions row gets its own it() so
// per-assertion verdicts are visible; titles include pass_rate when k>1.

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const BIN_DIR = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'test-prompt-harness', 'bin');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const RUNS_DIR = path.join(__dirname, 'runs');

const GATE = process.env.RUN_LLM_BENCH === '1';

function listFixtures() {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.fixture.md'))
    .map(f => path.join(FIXTURES_DIR, f));
}

function safeParse(fixturePath) {
  try {
    const { parseFixture } = require(path.join(BIN_DIR, 'run-fixture.js'));
    return { ok: true, parsed: parseFixture(fixturePath) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function utcStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function enumeratePassConditionIds(fm) {
  const ids = [];
  const pc = fm.pass_conditions || {};
  if (pc.run) {
    if (pc.run.must_succeed !== undefined) ids.push('run.must_succeed');
    if (pc.run.max_duration_ms !== undefined) ids.push('run.max_duration_ms');
    if (pc.run.max_parse_errors !== undefined) ids.push('run.max_parse_errors');
  }
  const views = pc.views || {};
  for (const v of ['thinking', 'assistant_text', 'tool_inputs', 'tool_outputs', 'everything']) {
    (views[v]?.must_include || []).forEach((_, i) => ids.push(`views.${v}.must_include[${i}]`));
    (views[v]?.must_not_include || []).forEach((_, i) => ids.push(`views.${v}.must_not_include[${i}]`));
  }
  (pc.tool_calls?.required || []).forEach((_, i) => ids.push(`tool_calls.required[${i}]`));
  (pc.tool_calls?.forbidden || []).forEach((_, i) => ids.push(`tool_calls.forbidden[${i}]`));
  for (const tool of Object.keys(pc.tool_calls?.counts || {})) ids.push(`tool_calls.counts.${tool}`);
  if (Array.isArray(pc.tool_calls?.order) && pc.tool_calls.order.length > 0) ids.push('tool_calls.order');
  (pc.tool_calls?.inputs || []).forEach((row, i) => ids.push(`tool_calls.inputs[${i}].${row.tool}`));
  if (pc.tool_results?.all_succeeded !== undefined) ids.push('tool_results.all_succeeded');
  for (const tool of Object.keys(pc.tool_results?.per_tool || {})) ids.push(`tool_results.per_tool.${tool}`);
  if (pc.result?.must_match) ids.push('result.must_match');
  if (pc.result?.must_not_match) ids.push('result.must_not_match');
  for (const row of (pc.semantic || [])) ids.push(`semantic.${row.id}`);
  return ids;
}

const describeMaybe = GATE ? describe : describe.skip;

describeMaybe('llm-bench (live)', function () {
  this.timeout(0);

  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });

  const fixtures = listFixtures();

  if (fixtures.length === 0) {
    it('NO_FIXTURES — drop a *.fixture.md into fixtures/ to enable', () => {
      throw new Error('no fixtures found in ' + FIXTURES_DIR);
    });
    return;
  }

  fixtures.forEach(fixturePath => {
    const base = path.basename(fixturePath);
    const parsed = safeParse(fixturePath);

    if (!parsed.ok) {
      describe(base, () => {
        it('FIXTURE_PARSE_ERROR — see message', () => {
          throw parsed.error;
        });
      });
      return;
    }

    const fm = parsed.parsed.frontmatter;
    const runs = fm.runs !== undefined ? Number(fm.runs) : 1;
    const runDir = path.join(RUNS_DIR, `${path.basename(base, '.fixture.md')}-${utcStamp()}`);
    const perReplicaTimeoutMs = (Number(fm.timeout_seconds) + 30) * 1000;
    const benchTimeoutMs = perReplicaTimeoutMs + 60000;
    let grade = null;
    let harnessError = null;

    describe(fm.name || base, function () {
      this.timeout(benchTimeoutMs);

      before(function () {
        const benchCmd = spawnSync(process.execPath,
          [path.join(BIN_DIR, 'run-bench.js'), fixturePath, runDir],
          { encoding: 'utf8', timeout: benchTimeoutMs });
        if (benchCmd.status > 1) {
          harnessError = new Error(
            `run-bench.js crashed status=${benchCmd.status} signal=${benchCmd.signal}.\n` +
            `Inspect: ${runDir}/r*/stream.jsonl, run.meta.json, grade.json.\n` +
            `stderr: ${benchCmd.stderr || '(empty)'}`);
          return;
        }
        try {
          grade = JSON.parse(fs.readFileSync(path.join(runDir, 'grade.json'), 'utf8'));
        } catch (e) {
          harnessError = new Error(`grade.json missing or invalid: ${e.message}`);
        }
      });

      const ids = enumeratePassConditionIds(fm);
      if (ids.length === 0) {
        it('NO_PASS_CONDITIONS — fixture defines no assertions', () => {
          throw new Error(`${base}: no pass_conditions rows`);
        });
        return;
      }

      ids.forEach(id => {
        const title = runs > 1 ? `${id} (pass_rate=PENDING)` : id;
        it(title, function () {
          if (harnessError) throw harnessError;
          expect(grade, 'grade.json not loaded').to.not.equal(null);
          const row = grade.rows.find(r => r.id === id);
          expect(row, `row ${id} missing from grade.json`).to.not.equal(undefined);
          if (row.verdict !== 'PASS') {
            const rateStr = row.pass_rate ? ` pass_rate=${row.pass_rate}` : '';
            const excerpts = row.actual_excerpts && row.actual_excerpts.length
              ? `\nexcerpts:\n  - ${row.actual_excerpts.join('\n  - ')}`
              : '';
            throw new Error(
              `${id} verdict=${row.verdict}${rateStr}\n` +
              `actual_excerpt: ${row.actual_excerpt}${excerpts}\n` +
              `run dir: ${runDir}`);
          }
        });
      });

      it('overall', function () {
        if (harnessError) throw harnessError;
        expect(grade.overall).to.equal('PASS');
      });
    });
  });
});
