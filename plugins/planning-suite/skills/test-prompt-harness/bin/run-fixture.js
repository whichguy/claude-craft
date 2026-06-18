#!/usr/bin/env node
// Headless `claude -p` runner for prompt-driven skill fixtures.
//
// Fixture format: YAML frontmatter (--- delimited) + literal prompt body
// after a single `# Prompt body` H1. Frontmatter fields read here:
//   name, model, timeout_seconds, permission_mode, allowed_tools,
//   append_system_prompt (optional, empty → flag omitted).
//
// CLI:  node bin/run-fixture.js <fixture.md> <run-dir> [--replica-id N]
// API:  const { runFixture } = require('./run-fixture'); runFixture(fixturePath, runDir, { replicaId })
//
// V2 note: run-bench.js orchestrates k replicas and always writes each
// replica's artifacts under <parent>/r<i>/. The --replica-id flag is
// purely metadata — it gets recorded into run.meta.json so an aggregator
// can label per-replica grades.
//
// Phase 1 probe findings (committed golden: golden-stream.jsonl):
//   • --session-id accepts lowercase RFC-4122 v4 from crypto.randomUUID()
//   • --allowed-tools is a single space-separated string ("Bash Read Write")
//   • bypassPermissions OVERRIDES --allowed-tools (tools run even when not
//     in the allowlist). To probe tool-gating, set permission_mode to
//     'default'/'acceptEdits'/'plan' in the fixture.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, execFileSync } = require('child_process');
const yaml = require('js-yaml');

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
const BODY_DELIM_RE = /^#\s+Prompt body\s*\n/m;

function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function parseFixture(fixturePath) {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const m = FRONTMATTER_RE.exec(raw);
  if (!m) throw new Error(`fixture missing YAML frontmatter: ${fixturePath}`);
  const fm = yaml.load(m[1]);
  if (!fm || typeof fm !== 'object') throw new Error(`fixture frontmatter not a map: ${fixturePath}`);
  const rest = m[2];
  const bm = BODY_DELIM_RE.exec(rest);
  if (!bm) throw new Error(`fixture missing "# Prompt body" delimiter: ${fixturePath}`);
  const body = rest.slice(bm.index + bm[0].length);
  return { frontmatter: fm, body };
}

function runFixture(fixturePath, runDir, opts = {}) {
  const { frontmatter, body } = parseFixture(fixturePath);
  const replicaId = opts.replicaId !== undefined ? Number(opts.replicaId) : null;
  for (const k of ['name', 'model', 'timeout_seconds', 'allowed_tools']) {
    if (frontmatter[k] === undefined) throw new Error(`fixture missing frontmatter.${k}: ${fixturePath}`);
  }
  const permissionMode = frontmatter.permission_mode || 'bypassPermissions';
  const allowedPermissionModes = new Set(['bypassPermissions', 'default', 'acceptEdits', 'plan']);
  if (!allowedPermissionModes.has(permissionMode)) {
    throw new Error(`fixture has unknown permission_mode "${permissionMode}": ${fixturePath}`);
  }

  fs.mkdirSync(runDir, { recursive: true });
  const uuid = crypto.randomUUID();
  const args = [
    '-p', '--output-format', 'stream-json', '--verbose',
    '--session-id', uuid,
    '--permission-mode', permissionMode,
    '--allowed-tools', String(frontmatter.allowed_tools),
    '--model', String(frontmatter.model),
  ];
  let appendSystemPrompt = frontmatter.append_system_prompt || '';
  if (frontmatter.append_system_prompt_file) {
    if (appendSystemPrompt) {
      throw new Error(`fixture sets both append_system_prompt and append_system_prompt_file: ${fixturePath}`);
    }
    const filePath = path.isAbsolute(frontmatter.append_system_prompt_file)
      ? frontmatter.append_system_prompt_file
      : path.join(repoRoot(), frontmatter.append_system_prompt_file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    appendSystemPrompt = fileContent.replace(/^---\n[\s\S]*?\n---\n/, '');
  }
  if (appendSystemPrompt) {
    args.push('--append-system-prompt', String(appendSystemPrompt));
  }

  const streamPath = path.join(runDir, 'stream.jsonl');
  const errPath = path.join(runDir, 'stderr.log');
  const metaPath = path.join(runDir, 'run.meta.json');
  const streamFh = fs.openSync(streamPath, 'w');
  const errFh = fs.openSync(errPath, 'w');

  const started = new Date().toISOString();
  const t0 = Date.now();
  const proc = spawnSync('claude', args, {
    input: body,
    stdio: ['pipe', streamFh, errFh],
    timeout: Number(frontmatter.timeout_seconds) * 1000,
  });
  const elapsedMs = Date.now() - t0;
  fs.closeSync(streamFh);
  fs.closeSync(errFh);

  let claudeVersion = '';
  try { claudeVersion = execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim(); }
  catch (_) { /* ignored */ }

  fs.writeFileSync(metaPath, JSON.stringify({
    uuid,
    fixture: path.relative(repoRoot(), fixturePath),
    fixture_name: frontmatter.name,
    claude_version: claudeVersion,
    started,
    elapsed_ms: elapsedMs,
    exit: proc.status,
    signal: proc.signal,
    timed_out: proc.signal === 'SIGTERM',
    permission_mode: permissionMode,
    model: frontmatter.model,
    replica_id: replicaId,
  }, null, 2) + '\n');

  return { exit: proc.status ?? 1, runDir, uuid };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const positionals = [];
  let replicaId = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--replica-id') {
      replicaId = Number(argv[++i]);
    } else if (argv[i].startsWith('--replica-id=')) {
      replicaId = Number(argv[i].split('=')[1]);
    } else {
      positionals.push(argv[i]);
    }
  }
  const [fixturePath, runDir] = positionals;
  if (!fixturePath || !runDir) {
    process.stderr.write('usage: run-fixture.js <fixture.md> <run-dir> [--replica-id N]\n');
    process.exit(2);
  }
  try {
    const r = runFixture(path.resolve(fixturePath), path.resolve(runDir), { replicaId });
    process.exit(r.exit ?? 1);
  } catch (e) {
    process.stderr.write(`run-fixture.js: ${e.message}\n`);
    process.exit(2);
  }
}

module.exports = { runFixture, parseFixture };
