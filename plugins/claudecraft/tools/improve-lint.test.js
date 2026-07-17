#!/usr/bin/env node
'use strict';
/**
 * Fixture tests for improve-lint-discover.js (no network, no real eslint required).
 * Run: node tools/improve-lint.test.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const {
  discover,
  matchPaths,
  runPlan,
  pathMatchesGlob,
  readShebangKind,
  cachePath,
} = require('./improve-lint-discover.js');

const ROOT = path.resolve(__dirname);
const DISCOVER = path.join(ROOT, 'improve-lint-discover.js');
const LINT_SH = path.join(ROOT, 'improve-lint.sh');

let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${name}: ${e && e.stack ? e.stack : e}`);
  }
}

function mktempRepo(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `improve-lint-${label}-`));
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
  return dir;
}

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function writeEslintBin(repo, exitCode) {
  const binDir = path.join(repo, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  const body =
    exitCode === 0
      ? '#!/bin/sh\nexit 0\n'
      : '#!/bin/sh\necho "error: boom" >&2\nexit 1\n';
  write(path.join(binDir, 'eslint'), body);
  fs.chmodSync(path.join(binDir, 'eslint'), 0o755);
}

test('pathMatchesGlob *.js with extension', () => {
  assert.strictEqual(pathMatchesGlob('tools/foo.js', '*.js', null), true);
  assert.strictEqual(pathMatchesGlob('tools/foo.TS', '*.ts', null), true);
  assert.strictEqual(pathMatchesGlob('README.md', '*.js', null), false);
});

test('extensionless without shebang does not match JS globs', () => {
  const repo = mktempRepo('noshebang');
  write(path.join(repo, 'tools', 'mystery'), 'print("hi")\n');
  assert.strictEqual(pathMatchesGlob('tools/mystery', '*.js', repo), false);
  assert.strictEqual(pathMatchesGlob('tools/mystery', '*.py', repo), false);
  fs.rmSync(repo, { recursive: true, force: true });
});

test('extensionless node shebang matches JS only', () => {
  const repo = mktempRepo('shebang-js');
  write(path.join(repo, 'tools', 'claude-proxy'), '#!/usr/bin/env node\nconsole.log(1)\n');
  write(path.join(repo, 'tools', 'run-sh'), '#!/usr/bin/env bash\necho hi\n');
  assert.strictEqual(readShebangKind(repo, 'tools/claude-proxy'), 'js');
  assert.strictEqual(pathMatchesGlob('tools/claude-proxy', '*.js', repo), true);
  assert.strictEqual(pathMatchesGlob('tools/claude-proxy', '*.sh', repo), false);
  assert.strictEqual(readShebangKind(repo, 'tools/run-sh'), 'sh');
  assert.strictEqual(pathMatchesGlob('tools/run-sh', '*.sh', repo), true);
  assert.strictEqual(pathMatchesGlob('tools/run-sh', '*.js', repo), false);
  fs.rmSync(repo, { recursive: true, force: true });
});

test('empty repo discovers no config-derived tools', () => {
  const repo = mktempRepo('empty');
  const map = discover(repo, { forceRefresh: true });
  assert.strictEqual(map.version, 1);
  const configDerived = (map.linters || []).filter((l) => l.source !== 'PATH');
  assert.strictEqual(configDerived.length, 0, JSON.stringify(configDerived));
  fs.rmSync(repo, { recursive: true, force: true });
});

test('package.json eslint script discovers eslint tool', () => {
  const repo = mktempRepo('eslint-pkg');
  write(
    path.join(repo, 'package.json'),
    JSON.stringify({ name: 't', scripts: { lint: 'eslint tools test' } }, null, 2)
  );
  write(path.join(repo, 'eslint.config.js'), 'export default [];\n');
  writeEslintBin(repo, 0);

  const map = discover(repo, { forceRefresh: true });
  const eslint = (map.linters || []).find((l) => l.id === 'eslint');
  assert.ok(eslint, 'expected eslint linter');
  assert.strictEqual(eslint.available, true);
  assert.strictEqual(eslint.scope, 'paths');

  const selected = matchPaths(map, ['tools/a.js', 'README.md'], map.repo);
  assert.strictEqual(selected.length, 1);
  assert.deepStrictEqual(selected[0].paths, ['tools/a.js']);

  const plan = runPlan(repo, ['docs/x.md'], { forceRefresh: false });
  assert.strictEqual(plan.status, 'skipped');

  const plan2 = runPlan(repo, ['tools/a.js'], {});
  assert.strictEqual(plan2.status, 'ready');
  assert.strictEqual(plan2.linters[0].id, 'eslint');

  fs.rmSync(repo, { recursive: true, force: true });
});

test('cache fingerprint hit still re-resolves available after npm install', () => {
  const repo = mktempRepo('cache-resolve');
  write(path.join(repo, 'package.json'), JSON.stringify({ scripts: { lint: 'eslint .' } }));
  write(path.join(repo, 'eslint.config.js'), 'export default [];\n');

  // No eslint bin yet
  const a = discover(repo, { forceRefresh: true });
  assert.strictEqual(a.cache_hit, false);
  let eslint = a.linters.find((l) => l.id === 'eslint');
  assert.ok(eslint);
  assert.strictEqual(eslint.available, false);

  // Fingerprint unchanged but bin appears — must flip available:true
  writeEslintBin(repo, 0);
  const b = discover(repo, { forceRefresh: false });
  assert.strictEqual(b.cache_hit, true, 'fingerprint should hit');
  eslint = b.linters.find((l) => l.id === 'eslint');
  assert.strictEqual(eslint.available, true, 'must re-resolve bin on cache hit');
  assert.ok(eslint.cmd[0].includes('node_modules'), eslint.cmd[0]);

  // Config change → cache miss
  write(path.join(repo, 'eslint.config.js'), 'export default [{ rules: {} }];\n');
  const c = discover(repo, { forceRefresh: false });
  assert.strictEqual(c.cache_hit, false);
  assert.ok(fs.existsSync(cachePath(repo)));

  fs.rmSync(repo, { recursive: true, force: true });
});

test('makefile residual does not match pure markdown paths', () => {
  const repo = mktempRepo('make');
  write(path.join(repo, 'Makefile'), '.PHONY: lint\nlint:\n\t@echo ok\n');
  const map = discover(repo, { forceRefresh: true });
  const ml = (map.linters || []).find((l) => l.id === 'make-lint');
  assert.ok(ml, 'expected make-lint');
  assert.strictEqual(ml.scope, 'whole-repo');
  assert.ok(ml.when.globs.includes('*.js'));
  assert.ok(!ml.when.globs.includes('*') || ml.when.globs.length > 1);

  const selectedDocs = matchPaths(map, ['README.md', 'docs/x.md'], map.repo);
  assert.strictEqual(selectedDocs.length, 0, 'docs must not trigger make-lint');

  write(path.join(repo, 'src', 'a.js'), '1\n');
  const selectedJs = matchPaths(map, ['src/a.js'], map.repo);
  assert.strictEqual(selectedJs.length, 1);
  assert.strictEqual(selectedJs[0].id, 'make-lint');

  fs.rmSync(repo, { recursive: true, force: true });
});

test('no make-lint residual when eslint declared but bin missing (avoid soft-green)', () => {
  const repo = mktempRepo('no-soft-green');
  write(path.join(repo, 'package.json'), JSON.stringify({ scripts: { lint: 'eslint tools' } }));
  write(path.join(repo, 'eslint.config.js'), 'export default [];\n');
  write(path.join(repo, 'Makefile'), '.PHONY: lint\nlint:\n\t@echo "lint: run npm install first"; exit 0\n');
  // no node_modules/.bin/eslint
  const map = discover(repo, { forceRefresh: true });
  const eslint = map.linters.find((l) => l.id === 'eslint');
  assert.ok(eslint);
  assert.strictEqual(eslint.available, false);
  assert.ok(
    !map.linters.some((l) => l.id === 'make-lint'),
    'make-lint must not soft-green when eslint is expected but missing'
  );
  const plan = runPlan(repo, ['tools/a.js'], { forceRefresh: false });
  assert.strictEqual(plan.status, 'skipped', 'prefer skip over false-green make');
  fs.rmSync(repo, { recursive: true, force: true });
});

test('paths_prefix is a hard filter when set', () => {
  const lint = {
    id: 'eslint',
    available: true,
    cmd: ['eslint'],
    when: { globs: ['*.js'], paths_prefix: ['tools/'] },
  };
  const { pathMatchesLinter } = require('./improve-lint-discover.js');
  assert.strictEqual(pathMatchesLinter('tools/a.js', lint, null), true);
  assert.strictEqual(pathMatchesLinter('src/a.js', lint, null), false);
});

test('CLI discover --repo emits JSON', () => {
  const repo = mktempRepo('cli');
  const r = spawnSync(process.execPath, [DISCOVER, 'discover', '--repo', repo, '--force-refresh'], {
    encoding: 'utf8',
  });
  assert.strictEqual(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.strictEqual(j.version, 1);
  fs.rmSync(repo, { recursive: true, force: true });
});

test('improve-lint.sh run skips with no matching tools (exit 0)', () => {
  const repo = mktempRepo('sh-skip');
  write(path.join(repo, 'README.md'), 'hi\n');
  const r = spawnSync('bash', [LINT_SH, 'run', '--repo', repo, '--paths', 'README.md'], {
    encoding: 'utf8',
  });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const plan = JSON.parse(r.stdout);
  assert.strictEqual(plan.status, 'skipped');
  fs.rmSync(repo, { recursive: true, force: true });
});

test('improve-lint.sh run path-scoped eslint (fake bin)', () => {
  const repo = mktempRepo('sh-run');
  write(path.join(repo, 'package.json'), JSON.stringify({ scripts: { lint: 'eslint tools' } }));
  write(path.join(repo, 'eslint.config.js'), 'export default [];\n');
  write(path.join(repo, 'tools', 'a.js'), 'const x = 1;\n');
  writeEslintBin(repo, 0);

  let r = spawnSync(
    'bash',
    [LINT_SH, 'run', '--repo', repo, '--force-refresh', '--paths', 'tools/a.js'],
    { encoding: 'utf8' }
  );
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);

  writeEslintBin(repo, 1);
  r = spawnSync(
    'bash',
    [LINT_SH, 'run', '--repo', repo, '--force-refresh', '--paths', 'tools/a.js'],
    { encoding: 'utf8' }
  );
  assert.strictEqual(r.status, 1, r.stderr + r.stdout);

  fs.rmSync(repo, { recursive: true, force: true });
});

test('extensionless node path can plan eslint when available', () => {
  const repo = mktempRepo('extless-run');
  write(path.join(repo, 'package.json'), JSON.stringify({ scripts: { lint: 'eslint tools' } }));
  write(path.join(repo, 'eslint.config.js'), 'export default [];\n');
  write(path.join(repo, 'tools', 'claude-proxy'), '#!/usr/bin/env node\nconst x=1\n');
  writeEslintBin(repo, 0);
  const plan = runPlan(repo, ['tools/claude-proxy'], { forceRefresh: true });
  assert.strictEqual(plan.status, 'ready');
  assert.strictEqual(plan.linters[0].id, 'eslint');
  fs.rmSync(repo, { recursive: true, force: true });
});

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll improve-lint tests passed');
