'use strict';

const { expect } = require('chai');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROUTER = path.join(__dirname, '..', 'tools', 'claude-router');

// ── Fixtures ─────────────────────────────────────────────────────────

function makeTestHome(routes, providers = {}) {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-test-home-'));
  const claudeDir = path.join(homeDir, '.claude');
  fs.mkdirSync(claudeDir);
  const configPath = path.join(claudeDir, 'model-map.json');
  const config = { providers };
  if (routes !== undefined) config.routes = routes;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  // Claude stub that prints each arg on its own line
  const toolsDir = path.join(homeDir, '.claude', 'tools');
  fs.mkdirSync(toolsDir, { recursive: true });
  const binDir = path.join(homeDir, 'bin');
  fs.mkdirSync(binDir);
  const stub = path.join(binDir, 'claude');
  fs.writeFileSync(stub, '#!/bin/bash\nfor a in "$@"; do echo "$a"; done\n');
  fs.chmodSync(stub, 0o755);

  // Ollama stub — behavior driven by env vars:
  //   OLLAMA_STUB_PS_EXIT   (default 0)   exit code for `ollama ps`
  //   OLLAMA_STUB_PS_OUTPUT (default "NAME   ID\n")  stdout for `ollama ps`
  //   OLLAMA_STUB_LIST_EXIT (default 0)   exit code for `ollama list`
  //   OLLAMA_STUB_LIST_OUTPUT (default "NAME   ID\n") stdout for `ollama list`
  const ollamaStub = path.join(binDir, 'ollama');
  fs.writeFileSync(ollamaStub, [
    '#!/bin/bash',
    'case "$1" in',
    '  ps)',
    '    printf \'%s\\n\' "${OLLAMA_STUB_PS_OUTPUT:-NAME   ID}"',
    '    exit "${OLLAMA_STUB_PS_EXIT:-0}" ;;',
    '  list)',
    '    printf \'%s\\n\' "${OLLAMA_STUB_LIST_OUTPUT:-NAME   ID}"',
    '    exit "${OLLAMA_STUB_LIST_EXIT:-0}" ;;',
    '  run) exit 0 ;;',
    '  *)   exit 1 ;;',
    'esac',
  ].join('\n') + '\n');
  fs.chmodSync(ollamaStub, 0o755);

  return { homeDir, configPath, stub, binDir };
}

function runRouter(args, { homeDir, binDir }, ollamaEnv = {}) {
  const env = {
    ...process.env,
    HOME: homeDir,
    PATH: `${binDir}:${process.env.PATH}`,
    OLLAMA_BASE_URL: 'http://127.0.0.1:19999', // unreachable — skip Ollama auto-detect
    ...ollamaEnv,
  };
  const result = spawnSync('bash', [ROUTER, ...args], { env, encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('claude-router --route flag', () => {
  let ctx;

  beforeEach(() => {
    ctx = makeTestHome({
      default: 'claude-sonnet-4-6',
      background: 'qwen3-coder:30b',
      think: 'claude-sonnet-4-6',
      longContext: 'claude-sonnet-4-6',
    });
  });

  afterEach(() => {
    fs.rmSync(ctx.homeDir, { recursive: true, force: true });
  });

  it('happy path: --route background resolves to qwen3-coder:30b', () => {
    const r = runRouter(['--route', 'background', '-p', 'hello'], ctx);
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('qwen3-coder:30b');
    expect(r.stdout).to.include('--model');
  });

  it('precedence: explicit --model wins over --route', () => {
    const r = runRouter(['--route', 'background', '--model', 'claude-sonnet-4-6', '-p', 'pong'], ctx);
    expect(r.status).to.equal(0, r.stderr);
    const lines = r.stdout.trim().split('\n');
    const modelIdx = lines.indexOf('--model');
    expect(modelIdx).to.be.gte(0, 'expected --model in output');
    expect(lines[modelIdx + 1]).to.equal('claude-sonnet-4-6');
    // --model must appear exactly once
    expect(lines.filter(l => l === '--model').length).to.equal(1);
  });

  it('multi-word prompt preservation: -p arg arrives as single token', () => {
    const r = runRouter(['--route', 'default', '-p', 'hello world from test', '--output-format', 'json'], ctx);
    expect(r.status).to.equal(0, r.stderr);
    const lines = r.stdout.trim().split('\n');
    const pIdx = lines.indexOf('-p');
    expect(pIdx).to.be.gte(0, 'expected -p flag in output');
    expect(lines[pIdx + 1]).to.equal('hello world from test', 'multi-word prompt must arrive as one token');
  });

  it('error path: unknown route exits 1 with actionable message', () => {
    const r = runRouter(['--route', 'bogus', '-p', 'test'], ctx);
    expect(r.status).to.equal(1);
    expect(r.stderr).to.match(/route 'bogus' not found or invalid/);
    expect(r.stderr).to.include('available routes');
    expect(r.stdout.trim()).to.equal('');
  });

  it('error path: empty-string route value exits 1', () => {
    const emptyCfg = makeTestHome({ default: 'claude-sonnet-4-6', empty: '' });
    const r = runRouter(['--route', 'empty', '-p', 'test'], emptyCfg);
    expect(r.status).to.equal(1);
    expect(r.stderr).to.match(/not found or invalid/);
    fs.rmSync(emptyCfg.homeDir, { recursive: true, force: true });
  });

  it('error path: missing routes key exits 1 with schema error', () => {
    const noRoutesCfg = makeTestHome(undefined); // no .routes key
    const r = runRouter(['--route', 'default', '-p', 'test'], noRoutesCfg);
    expect(r.status).to.equal(1);
    expect(r.stderr).to.match(/requires a 'routes' block/);
    fs.rmSync(noRoutesCfg.homeDir, { recursive: true, force: true });
  });

  it('--list shows configured routes section', () => {
    const r = runRouter(['--list'], ctx);
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('Configured routes');
    expect(r.stdout).to.include('background');
    expect(r.stdout).to.include('qwen3-coder:30b');
    expect(r.stdout).to.include('default');
    expect(r.stdout).to.include('claude-sonnet-4-6');
  });

  it('unknown --model (no provider, tags unreachable) assumes Ollama with notice', () => {
    const bare = makeTestHome(undefined, {}); // no routes/providers
    const r = runRouter(['--model', 'my-local:7b', '-p', 'hi'], bare);
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stderr).to.match(/assuming Ollama at/);
    expect(r.stderr).to.include('my-local:7b');
    expect(r.stdout).to.include('my-local:7b');
    fs.rmSync(bare.homeDir, { recursive: true, force: true });
  });
});

// ── ensure_ollama_running ─────────────────────────────────────────────

const OLLAMA_PROVIDER_CONFIG = {
  'test-model:7b': {
    base_url: 'http://localhost:11434',
    auth_token: 'ollama',
    api_key: '',
    config_dir: '/tmp/ollama-test',
    disable_nonessential_traffic: true,
  },
};

describe('ensure_ollama_running', () => {
  let ctx;

  beforeEach(() => {
    ctx = makeTestHome(undefined, OLLAMA_PROVIDER_CONFIG);
  });

  afterEach(() => {
    fs.rmSync(ctx.homeDir, { recursive: true, force: true });
  });

  it('unreachable host: ollama ps exits non-zero → prints cannot-reach hint, no warming', () => {
    const r = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '1',
    });
    expect(r.stderr).to.include('cannot reach Ollama on http://localhost:11434');
    expect(r.stderr).not.to.include('warming');
  });

  it('already loaded: model appears in ollama ps output → silent (no stderr)', () => {
    const r = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME           ID\ntest-model:7b  abc123',
    });
    expect(r.stderr).to.equal('');
  });

  it('cached but cold: ps clean, model in ollama list → fires background warm-up', () => {
    const r = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME   ID',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME           ID\ntest-model:7b  abc123',
    });
    expect(r.stderr).to.include("warming 'test-model:7b' on http://localhost:11434 (background)...");
    expect(r.stderr).not.to.include('cannot reach');
    expect(r.stderr).not.to.include('not cached');
  });

  it('model not cached: ps clean, model absent from ollama list → prints pull hint, no warm-up', () => {
    const r = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME   ID',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME   ID',
    });
    expect(r.stderr).to.include('not cached on http://localhost:11434');
    expect(r.stderr).to.include('ollama pull test-model:7b');
    expect(r.stderr).not.to.include('warming');
  });

  it('ollama CLI absent from PATH → silent, routing proceeds normally', () => {
    // Build a restricted bin dir with only a claude stub, then use a curated PATH
    // that includes system essentials (jq, bash at /usr/bin and /bin) but excludes
    // /usr/local/bin where the real ollama lives — so `command -v ollama` returns non-zero.
    const noOllamaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-no-ollama-'));
    const claudeOnly = path.join(noOllamaDir, 'claude');
    fs.writeFileSync(claudeOnly, '#!/bin/bash\nfor a in "$@"; do echo "$a"; done\n');
    fs.chmodSync(claudeOnly, 0o755);
    const env = {
      ...process.env,
      HOME: ctx.homeDir,
      PATH: `${noOllamaDir}:/usr/bin:/bin`,  // excludes /usr/local/bin where ollama lives
      OLLAMA_BASE_URL: 'http://127.0.0.1:19999',
    };
    const result = spawnSync('bash', [ROUTER, '--model', 'test-model:7b', '-p', 'hi'], { env, encoding: 'utf8' });
    fs.rmSync(noOllamaDir, { recursive: true, force: true });
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
  });
});
