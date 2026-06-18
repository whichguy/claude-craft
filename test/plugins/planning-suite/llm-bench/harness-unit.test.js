'use strict';

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const BIN_DIR = path.join(REPO_ROOT, 'plugins', 'planning-suite', 'skills', 'test-prompt-harness', 'bin');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const GOLDEN = path.join(FIXTURES_DIR, '_golden', 'golden-stream.jsonl');
const GOLDEN_JUDGE = path.join(FIXTURES_DIR, '_golden', 'golden-judge.json');

const {
  gradeRun, parseFrontmatter, buildViews, tolerantParseLines, evalRows,
  validateFixture, canonicalInput, compileRegex,
} = require(path.join(BIN_DIR, 'grade-run.js'));
const { parseFixture } = require(path.join(BIN_DIR, 'run-fixture.js'));
const { aggregateRows, quorumThreshold } = require(path.join(BIN_DIR, 'grade-aggregate.js'));
const { runJudge, extractAssistantText, stripFence, parseVerdict } =
  require(path.join(BIN_DIR, 'judge-runner.js'));

function mktmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bench-unit-'));
}

function makeSyntheticFixture(tmp, pass_conditions, extra = {}) {
  const fm = Object.assign({
    name: 'synthetic',
    description: 'synthetic test',
    model: 'claude-haiku-4-5-20251001',
    timeout_seconds: 60,
    allowed_tools: 'Bash Read Write',
    pass_conditions,
  }, extra);
  const fixturePath = path.join(tmp, 'synthetic.fixture.md');
  fs.writeFileSync(fixturePath, `---\n${yaml.dump(fm)}---\n# Prompt body\n\nignored\n`);
  return fixturePath;
}

function gradeWith(conditions, extra = {}) {
  const tmp = mktmpdir();
  fs.copyFileSync(GOLDEN, path.join(tmp, 'stream.jsonl'));
  fs.writeFileSync(path.join(tmp, 'run.meta.json'),
    JSON.stringify({ elapsed_ms: 7000, replica_id: 1 }) + '\n');
  const fixturePath = makeSyntheticFixture(tmp, conditions, extra);
  return gradeRun(fixturePath, tmp);
}

describe('llm-bench harness V2 — stream-schema guard', () => {
  it('golden stream parses with zero errors', () => {
    const { events, parseErrors } = tolerantParseLines(fs.readFileSync(GOLDEN, 'utf8'));
    expect(parseErrors).to.equal(0);
    expect(events.length).to.be.greaterThan(0);
  });

  it('golden contains expected discriminator fields', () => {
    const { events } = tolerantParseLines(fs.readFileSync(GOLDEN, 'utf8'));
    expect(events.some(e =>
      e.type === 'assistant' && e.message?.content?.some(b => b.type === 'text'))).to.equal(true);
    expect(events.some(e =>
      e.type === 'assistant' && e.message?.content?.some(b => b.type === 'tool_use'))).to.equal(true);
    expect(events.some(e =>
      e.type === 'user' && e.message?.content?.some(b => b.type === 'tool_result'))).to.equal(true);
    expect(events.some(e =>
      e.type === 'result' && typeof e.subtype === 'string')).to.equal(true);
  });
});

describe('llm-bench harness V2 — five views', () => {
  let views;
  before(() => {
    const { events } = tolerantParseLines(fs.readFileSync(GOLDEN, 'utf8'));
    views = buildViews(events, { elapsed_ms: 7000 });
  });

  it('thinking view contains thinking text but NOT final assistant text', () => {
    expect(views.thinking).to.match(/I can do sequentially|Let me start with the bash|Read of \/etc\/hostname|three independent operations/);
    expect(views.thinking).to.not.contain('Done. Bash echoed');
  });

  it('assistant_text view contains the final answer but NOT thinking', () => {
    expect(views.assistant_text).to.contain('Done. Bash echoed');
    expect(views.assistant_text).to.not.contain('Let me start with the bash');
  });

  it('tool_inputs view contains canonical tool inputs only', () => {
    expect(views.tool_inputs).to.contain('"command":"echo hello"');
    expect(views.tool_inputs).to.contain('"file_path":"/etc/hostname"');
    expect(views.tool_inputs).to.not.contain('Done. Bash echoed');
  });

  it('tool_outputs view contains tool_result content only', () => {
    expect(views.tool_outputs).to.contain('hello');
    expect(views.tool_outputs).to.contain('File does not exist');
    expect(views.tool_outputs).to.not.contain('"command":"echo hello"');
  });

  it('everything view unions thinking + assistant_text + tool_inputs + tool_outputs + result', () => {
    expect(views.everything).to.contain('Let me start with the bash');
    expect(views.everything).to.contain('Done. Bash echoed');
    expect(views.everything).to.contain('"command":"echo hello"');
    expect(views.everything).to.contain('File does not exist');
  });

  it('result view comes from terminal result event only', () => {
    expect(views.result).to.equal(
      'Done. Bash echoed "hello", `/etc/hostname` doesn\'t exist on this macOS system, and I wrote "ok" to `/tmp/llm-bench-probe.d/ok.txt`.');
  });

  it('run view carries subtype/is_error/elapsed_ms', () => {
    expect(views.run.subtype).to.equal('success');
    expect(views.run.is_error).to.equal(false);
    expect(views.run.elapsed_ms).to.equal(7000);
  });

  it('tool_results map back to tool name via tool_use_id and flag is_error', () => {
    const byTool = Object.fromEntries(views.tool_results.map(r => [r.tool, r]));
    expect(byTool.Bash.is_error).to.equal(false);
    expect(byTool.Read.is_error).to.equal(true);
    expect(byTool.Write.is_error).to.equal(false);
  });
});

describe('llm-bench harness V2 — string-view conditions', () => {
  it('views.tool_inputs.must_include PASS on canonical input substring', () => {
    const g = gradeWith({ views: { tool_inputs: { must_include: [
      { pattern: '"command":"echo ', case_sensitive: true } ] } } });
    expect(g.overall).to.equal('PASS');
  });

  it('views.everything.must_not_include with absent pattern → PASS', () => {
    const g = gradeWith({ views: { everything: { must_not_include: [
      { pattern: 'NEVER_IN_THIS_STREAM_xyz', case_sensitive: true } ] } } });
    expect(g.overall).to.equal('PASS');
  });

  it('absent must_include produces excerpt naming view + observed tools', () => {
    const g = gradeWith({ views: { assistant_text: { must_include: [
      { pattern: 'NOT_PRESENT_zzz', case_sensitive: true } ] } } });
    expect(g.overall).to.equal('FAIL');
    expect(g.rows[0].verdict).to.equal('FAIL');
    expect(g.rows[0].actual_excerpt).to.contain('NOT_PRESENT_zzz');
  });

  it('case_sensitive=true distinguishes from case_sensitive=false', () => {
    const sensitive = gradeWith({ views: { everything: { must_include: [
      { pattern: 'ECHO HELLO', case_sensitive: true } ] } } });
    expect(sensitive.overall).to.equal('FAIL');
    const insensitive = gradeWith({ views: { everything: { must_include: [
      { pattern: 'ECHO HELLO', case_sensitive: false } ] } } });
    expect(insensitive.overall).to.equal('PASS');
  });
});

describe('llm-bench harness V2 — regex safety', () => {
  it('invalid regex produces FAIL row with INVALID_REGEX excerpt — no crash', () => {
    const g = gradeWith({ views: { everything: { must_include: [
      { pattern: '[(/', case_sensitive: true } ] } } });
    expect(g.overall).to.equal('FAIL');
    expect(g.rows[0].verdict).to.equal('FAIL');
    expect(g.rows[0].actual_excerpt).to.match(/^INVALID_REGEX:/);
  });

  it('compileRegex returns error object instead of throwing', () => {
    const c = compileRegex({ pattern: '[(/', case_sensitive: true });
    expect(c.error).to.match(/INVALID_REGEX/);
  });
});

describe('llm-bench harness V2 — run.* conditions', () => {
  it('run.must_succeed PASS when subtype=success && !is_error', () => {
    const g = gradeWith({ run: { must_succeed: true } });
    expect(g.overall).to.equal('PASS');
  });

  it('run.max_duration_ms FAIL when elapsed exceeds limit', () => {
    const g = gradeWith({ run: { max_duration_ms: 1000 } });
    expect(g.overall).to.equal('FAIL');
    const r = g.rows.find(r => r.id === 'run.max_duration_ms');
    expect(r.actual_excerpt).to.contain('elapsed_ms=7000');
  });

  it('run.max_parse_errors PASS when stream is clean', () => {
    const g = gradeWith({ run: { max_parse_errors: 0 } });
    expect(g.overall).to.equal('PASS');
  });
});

describe('llm-bench harness V2 — tool_calls.counts/order/inputs', () => {
  it('counts.exact matches observed', () => {
    const g = gradeWith({ tool_calls: { counts: { Bash: { exact: 1 } } } });
    expect(g.overall).to.equal('PASS');
  });

  it('counts.exact mismatch FAILs with operator-friendly excerpt', () => {
    const g = gradeWith({ tool_calls: { counts: { Bash: { exact: 2 } } } });
    const r = g.rows.find(r => r.id === 'tool_calls.counts.Bash');
    expect(r.verdict).to.equal('FAIL');
    expect(r.actual_excerpt).to.contain('Bash count=1 exact=2');
  });

  it('counts.min/max ranges work', () => {
    expect(gradeWith({ tool_calls: { counts: { Bash: { min: 1, max: 3 } } } }).overall).to.equal('PASS');
    expect(gradeWith({ tool_calls: { counts: { Read: { min: 2 } } } }).overall).to.equal('FAIL');
  });

  it('order: [Bash, Read, Write] PASSes (matches observed subsequence)', () => {
    const g = gradeWith({ tool_calls: { order: ['Bash', 'Read', 'Write'] } });
    expect(g.overall).to.equal('PASS');
  });

  it('order: [Write, Bash] FAILs (out-of-order)', () => {
    const g = gradeWith({ tool_calls: { order: ['Write', 'Bash'] } });
    expect(g.overall).to.equal('FAIL');
    const r = g.rows.find(r => r.id === 'tool_calls.order');
    expect(r.actual_excerpt).to.contain('Bash,Read,Write');
  });

  it('inputs.must_match anchored on canonical "command" key matches', () => {
    const g = gradeWith({ tool_calls: { inputs: [
      { tool: 'Bash', must_match: { pattern: '"command":"echo hello"', case_sensitive: true } } ] } });
    expect(g.overall).to.equal('PASS');
  });

  it('inputs.must_not_match catches forbidden file_path', () => {
    const g = gradeWith({ tool_calls: { inputs: [
      { tool: 'Read', must_not_match: { pattern: '"file_path":"/etc/', case_sensitive: true } } ] } });
    expect(g.overall).to.equal('FAIL');
  });
});

describe('llm-bench harness V2 — tool_results conditions', () => {
  it('all_succeeded FAILs when any tool_result has is_error=true', () => {
    const g = gradeWith({ tool_results: { all_succeeded: true } });
    expect(g.overall).to.equal('FAIL');
    const r = g.rows.find(r => r.id === 'tool_results.all_succeeded');
    expect(r.actual_excerpt).to.contain('Read');
  });

  it('per_tool.Bash.must_succeed PASSes when Bash result had no error', () => {
    const g = gradeWith({ tool_results: { per_tool: { Bash: { must_succeed: true } } } });
    expect(g.overall).to.equal('PASS');
  });

  it('per_tool.Read.must_succeed FAILs because Read errored', () => {
    const g = gradeWith({ tool_results: { per_tool: { Read: { must_succeed: true } } } });
    expect(g.overall).to.equal('FAIL');
  });
});

describe('llm-bench harness V2 — input canonicalization', () => {
  it('JSON.stringify with sorted keys is stable regardless of input key order', () => {
    // Two inputs same content, different key order — produce identical canonical
    expect(canonicalInput({ command: 'echo a', description: 'foo' }))
      .to.equal(canonicalInput({ description: 'foo', command: 'echo a' }));
  });

  it('canonical anchored pattern matches whether SDK reordered keys', () => {
    // Simulate two tool_calls with reordered keys
    const tmp = mktmpdir();
    const minimal = [
      { type: 'assistant', message: { content: [
        { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'echo a', description: 'd' } },
      ] } },
      { type: 'assistant', message: { content: [
        { type: 'tool_use', id: 't2', name: 'Bash', input: { description: 'd', command: 'echo a' } },
      ] } },
      { type: 'result', subtype: 'success', is_error: false, result: 'ok' },
    ];
    fs.writeFileSync(path.join(tmp, 'stream.jsonl'),
      minimal.map(e => JSON.stringify(e)).join('\n') + '\n');
    fs.writeFileSync(path.join(tmp, 'run.meta.json'), JSON.stringify({ elapsed_ms: 100 }));
    const fixturePath = makeSyntheticFixture(tmp, {
      tool_calls: { inputs: [
        { tool: 'Bash', must_match: { pattern: '^\\{"command":"echo a"', case_sensitive: true } },
      ] },
    });
    const g = gradeRun(fixturePath, tmp);
    expect(g.overall).to.equal('PASS');
    // Both invocations match the anchored pattern → row PASSes
  });
});

describe('llm-bench harness V2 — fixture-validity', () => {
  it('rejects legacy thread: key', () => {
    expect(() => validateFixture({ thread: { must_include: [] } }, 1, 'majority'))
      .to.throw(/V1 schema/);
  });

  it('rejects runs < 1', () => {
    expect(() => validateFixture({}, 0, 'majority')).to.throw(/runs must be a positive integer/);
  });

  it('rejects quorum int > runs', () => {
    expect(() => validateFixture({}, 3, 5)).to.throw(/quorum integer/);
  });

  it('rejects unknown view name in pass_conditions.views', () => {
    expect(() => validateFixture({ views: { thread: {} } }, 1, 'majority'))
      .to.throw(/unknown view name/);
  });

  it('rejects tool_calls.counts.X mixing exact with min/max', () => {
    expect(() => validateFixture({ tool_calls: { counts: { Bash: { exact: 5, max: 1 } } } }, 1, 'majority'))
      .to.throw(/cannot be mixed/);
  });

  it('rejects semantic.view = tool_calls (structured view)', () => {
    expect(() => validateFixture({ semantic: [
      { id: 'x', view: 'tool_calls', judge_model: 'm', rubric: 'r' },
    ] }, 1, 'majority')).to.throw(/structured views not allowed/);
  });

  it('accepts semantic.view = result and required fields', () => {
    expect(() => validateFixture({ semantic: [
      { id: 'x', view: 'result', judge_model: 'm', rubric: 'r' },
    ] }, 1, 'majority')).to.not.throw();
  });
});

describe('llm-bench harness V2 — aggregator quorum', () => {
  function fakeReplicaGrade(rowVerdicts) {
    return {
      rows: rowVerdicts.map(([id, verdict, excerpt]) => ({
        id, kind: 'fake', verdict, actual_excerpt: excerpt || '',
        spec: { id },
      })),
    };
  }

  it('majority quorum k=3: row with 2-of-3 PASS → aggregated PASS', () => {
    const rows = aggregateRows([
      fakeReplicaGrade([['x', 'PASS']]),
      fakeReplicaGrade([['x', 'PASS']]),
      fakeReplicaGrade([['x', 'FAIL', 'flake']]),
    ], 'majority');
    expect(rows[0].verdict).to.equal('PASS');
    expect(rows[0].pass_count).to.equal(2);
    expect(rows[0].pass_rate).to.equal('2/3');
  });

  it('majority quorum k=3: 1-of-3 PASS → FAIL with collected excerpts', () => {
    const rows = aggregateRows([
      fakeReplicaGrade([['x', 'FAIL', 'a']]),
      fakeReplicaGrade([['x', 'FAIL', 'b']]),
      fakeReplicaGrade([['x', 'PASS']]),
    ], 'majority');
    expect(rows[0].verdict).to.equal('FAIL');
    expect(rows[0].pass_count).to.equal(1);
    expect(rows[0].actual_excerpts).to.have.members(['a', 'b']);
  });

  it('majority quorum k=4 with 2/2 split → FAIL (strict majority, no tie-pass)', () => {
    const rows = aggregateRows([
      fakeReplicaGrade([['x', 'PASS']]),
      fakeReplicaGrade([['x', 'PASS']]),
      fakeReplicaGrade([['x', 'FAIL', 'half']]),
      fakeReplicaGrade([['x', 'FAIL', 'half']]),
    ], 'majority');
    expect(rows[0].verdict).to.equal('FAIL');
    expect(rows[0].pass_count).to.equal(2);
  });

  it('quorum=all FAILs unless ALL replicas PASS', () => {
    expect(aggregateRows([
      fakeReplicaGrade([['x', 'PASS']]),
      fakeReplicaGrade([['x', 'PASS']]),
    ], 'all')[0].verdict).to.equal('PASS');
    expect(aggregateRows([
      fakeReplicaGrade([['x', 'PASS']]),
      fakeReplicaGrade([['x', 'FAIL', 'r']]),
    ], 'all')[0].verdict).to.equal('FAIL');
  });

  it('quorumThreshold formula: floor(k/2)+1', () => {
    expect(quorumThreshold('majority', 2)).to.equal(2);
    expect(quorumThreshold('majority', 3)).to.equal(2);
    expect(quorumThreshold('majority', 4)).to.equal(3);
    expect(quorumThreshold('majority', 5)).to.equal(3);
  });

  it('deduplicates identical fail excerpts in aggregated row', () => {
    const rows = aggregateRows([
      fakeReplicaGrade([['x', 'FAIL', 'same']]),
      fakeReplicaGrade([['x', 'FAIL', 'same']]),
      fakeReplicaGrade([['x', 'FAIL', 'same']]),
    ], 'majority');
    expect(rows[0].actual_excerpts).to.deep.equal(['same']);
  });
});

describe('llm-bench harness V2 — judge-runner (no live API)', () => {
  let goldenJudge;
  before(() => {
    goldenJudge = JSON.parse(fs.readFileSync(GOLDEN_JUDGE, 'utf8'));
  });

  it('golden judge response has terminal result event with string .result', () => {
    expect(Array.isArray(goldenJudge)).to.equal(true);
    const terminal = goldenJudge[goldenJudge.length - 1];
    expect(terminal.type).to.equal('result');
    expect(terminal.result).to.be.a('string');
  });

  it('extractAssistantText pulls .result from the terminal event', () => {
    const text = extractAssistantText(JSON.stringify(goldenJudge));
    expect(text).to.contain('"verdict"');
  });

  it('stripFence handles ```json … ``` wrapping (real judge output)', () => {
    const stripped = stripFence('```json\n{"verdict":"PASS","reasoning":"ok"}\n```');
    expect(stripped).to.equal('{"verdict":"PASS","reasoning":"ok"}');
  });

  it('parseVerdict accepts well-formed judge JSON', () => {
    const p = parseVerdict('```json\n{"verdict":"PASS","reasoning":"ok"}\n```');
    expect(p.verdict).to.equal('PASS');
    expect(p.reasoning).to.equal('ok');
  });

  it('runJudge with fake spawn (canned golden) → PASS row', () => {
    const fakeSpawn = () => ({ status: 0, signal: null, stdout: JSON.stringify(goldenJudge), stderr: '' });
    const r = runJudge({ model: 'm', timeoutMs: 1000, input: 'x' }, { spawn: fakeSpawn });
    expect(r.verdict).to.equal('PASS');
    expect(r.judge_model).to.equal('m');
    expect(r.judge_duration_ms).to.be.a('number');
  });

  it('runJudge with non-JSON stdout → FAIL row with raw text', () => {
    const fakeSpawn = () => ({ status: 0, signal: null, stdout: 'not json at all', stderr: '' });
    const r = runJudge({ model: 'm', timeoutMs: 1000, input: 'x' }, { spawn: fakeSpawn });
    expect(r.verdict).to.equal('FAIL');
    expect(r.actual_excerpt).to.contain('not valid JSON');
  });

  it('runJudge with judge SIGTERM → FAIL with "judge timeout" excerpt', () => {
    const fakeSpawn = () => ({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' });
    const r = runJudge({ model: 'm', timeoutMs: 5000, input: 'x' }, { spawn: fakeSpawn });
    expect(r.verdict).to.equal('FAIL');
    expect(r.actual_excerpt).to.contain('judge timeout after 5s');
  });

  it('runJudge with non-zero exit → FAIL with stderr tail', () => {
    const fakeSpawn = () => ({ status: 7, signal: null, stdout: '', stderr: 'rate limit reached' });
    const r = runJudge({ model: 'm', timeoutMs: 1000, input: 'x' }, { spawn: fakeSpawn });
    expect(r.verdict).to.equal('FAIL');
    expect(r.actual_excerpt).to.contain('exit=7');
    expect(r.actual_excerpt).to.contain('rate limit reached');
  });

  it('runJudge with bad-JSON inside fenced block → FAIL with raw text in excerpt', () => {
    const events = [{ type: 'result', subtype: 'success', is_error: false,
      result: '```json\n{ not really json }\n```' }];
    const fakeSpawn = () => ({ status: 0, signal: null, stdout: JSON.stringify(events), stderr: '' });
    const r = runJudge({ model: 'm', timeoutMs: 1000, input: 'x' }, { spawn: fakeSpawn });
    expect(r.verdict).to.equal('FAIL');
    expect(r.actual_excerpt).to.contain('not really json');
  });

  it('semantic[] row evaluates via injected runJudge stub', () => {
    const stub = () => ({ verdict: 'PASS', reasoning: 'stubbed', judge_model: 'm', judge_duration_ms: 0 });
    const rows = evalRows({
      semantic: [{ id: 'check', view: 'result', judge_model: 'm', rubric: 'x' }],
    }, { result: 'STATUS: OK', tool_calls: [], tool_results: [], run: {} },
       { fixtureFrontmatter: { timeout_seconds: 10 }, runJudge: stub });
    expect(rows[0].id).to.equal('semantic.check');
    expect(rows[0].verdict).to.equal('PASS');
  });

  it('semantic FAIL from judge surfaces reasoning as excerpt', () => {
    const stub = () => ({ verdict: 'FAIL', reasoning: 'missing status', actual_excerpt: 'missing status' });
    const rows = evalRows({
      semantic: [{ id: 'check', view: 'result', judge_model: 'm', rubric: 'x' }],
    }, { result: '', tool_calls: [], tool_results: [], run: {} },
       { fixtureFrontmatter: { timeout_seconds: 10 }, runJudge: stub });
    expect(rows[0].verdict).to.equal('FAIL');
    expect(rows[0].actual_excerpt).to.contain('missing status');
  });
});

describe('llm-bench harness V2 — parse_errors', () => {
  it('corrupted stream surfaces parse_errors without crashing', () => {
    const tmp = mktmpdir();
    const goldenLines = fs.readFileSync(GOLDEN, 'utf8').split('\n').filter(Boolean);
    const corrupted = ['this-is-not-json{', ...goldenLines, '{still-broken'].join('\n');
    fs.writeFileSync(path.join(tmp, 'stream.jsonl'), corrupted);
    fs.writeFileSync(path.join(tmp, 'run.meta.json'), JSON.stringify({ elapsed_ms: 100 }));
    const fixturePath = makeSyntheticFixture(tmp, { run: { max_parse_errors: 5 } });
    const g = gradeRun(fixturePath, tmp);
    expect(g.parse_errors).to.equal(2);
    expect(g.overall).to.equal('PASS');
  });

  it('max_parse_errors=0 FAILs when stream has errors', () => {
    const tmp = mktmpdir();
    fs.writeFileSync(path.join(tmp, 'stream.jsonl'), 'broken{\n');
    fs.writeFileSync(path.join(tmp, 'run.meta.json'), JSON.stringify({ elapsed_ms: 100 }));
    const fixturePath = makeSyntheticFixture(tmp, { run: { max_parse_errors: 0 } });
    const g = gradeRun(fixturePath, tmp);
    expect(g.overall).to.equal('FAIL');
  });
});

describe('llm-bench harness V2 — shipped fixtures', () => {
  const fixtureFiles = fs.existsSync(FIXTURES_DIR)
    ? fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.fixture.md'))
    : [];

  it('fixtures dir exists', () => {
    expect(fs.existsSync(FIXTURES_DIR)).to.equal(true);
  });

  fixtureFiles.forEach(name => {
    describe(name, () => {
      const fixturePath = path.join(FIXTURES_DIR, name);

      it('parses with required frontmatter', () => {
        const { frontmatter, body } = parseFixture(fixturePath);
        for (const k of ['name', 'description', 'model', 'timeout_seconds', 'allowed_tools', 'pass_conditions']) {
          expect(frontmatter, `${name}: missing frontmatter.${k}`).to.have.property(k);
        }
        expect(body, `${name}: empty body`).to.be.a('string').and.have.length.greaterThan(0);
      });

      it('prompt body has no <<< or <PLACEHOLDER> tokens', () => {
        const { body } = parseFixture(fixturePath);
        expect(body).to.not.match(/<<</);
        expect(body).to.not.match(/<[A-Z_][A-Z0-9_]*>/);
      });

      it('passes fixture-validity (no legacy thread, valid views/counts/semantic)', () => {
        const { frontmatter } = parseFixture(fixturePath);
        const runs = frontmatter.runs !== undefined ? Number(frontmatter.runs) : 1;
        const quorum = frontmatter.quorum !== undefined ? frontmatter.quorum : 'majority';
        expect(() => validateFixture(frontmatter.pass_conditions || {}, runs, quorum)).to.not.throw();
      });

      it('all pattern rows are {pattern, case_sensitive} objects', () => {
        const { frontmatter } = parseFixture(fixturePath);
        const pc = frontmatter.pass_conditions || {};
        const checkRow = row => {
          expect(row).to.be.an('object');
          expect(row).to.have.property('pattern').that.is.a('string');
          expect(row).to.have.property('case_sensitive').that.is.a('boolean');
        };
        for (const v of ['thinking', 'assistant_text', 'tool_inputs', 'tool_outputs', 'everything']) {
          for (const row of (pc.views?.[v]?.must_include || [])) checkRow(row);
          for (const row of (pc.views?.[v]?.must_not_include || [])) checkRow(row);
        }
        if (pc.result?.must_match) checkRow(pc.result.must_match);
        if (pc.result?.must_not_match) checkRow(pc.result.must_not_match);
        for (const inp of (pc.tool_calls?.inputs || [])) {
          const patSpec = inp.must_match || inp.must_not_match;
          expect(patSpec, 'tool_calls.inputs needs must_match or must_not_match').to.be.an('object');
          checkRow(patSpec);
        }
      });
    });
  });
});
