'use strict';

const { expect } = require('chai');
const { spawnSync, spawn } = require('child_process');
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

function runRouter(args, { homeDir, binDir, cwd = homeDir }, ollamaEnv = {}) {
  const env = {
    ...process.env,
    HOME: homeDir,
    PATH: `${binDir}:${process.env.PATH}`,
    OLLAMA_BASE_URL: 'http://127.0.0.1:19999', // unreachable — skip Ollama auto-detect
    CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1', // no real proxy under test HOME; avoids 5s ping wait
    CLAUDE_PROXY_PORT: '19996',
    CLAUDE_MODEL_MAP_PATH: '',
    CLAUDE_MODEL_MAP_SOURCE: '',
    CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
    CLAUDE_PROJECT_DIR: '',
    ...ollamaEnv,
  };
  const result = spawnSync('bash', [ROUTER, ...args], { env, cwd, encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

function initGitRepo(repoDir) {
  spawnSync('git', ['init', '-q'], { cwd: repoDir, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'Router Test'], { cwd: repoDir, encoding: 'utf8' });
}

function extractProxyPort(text) {
  const match = String(text || '').match(/ANTHROPIC_BASE_URL=http:\/\/127\.0\.0\.1:(\d+)/);
  return match ? Number(match[1]) : null;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('claude-router --route flag', function () {
  this.timeout(10000);

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

  it('chained routes: --route think follows graph to terminal model id', () => {
    const g = makeTestHome({
      think: 'claude-sonnet-4-6',
      'claude-sonnet-4-6': 'qwen3-coder:30b',
    });
    const r = runRouter(['--route', 'think', '-p', 'hello'], g);
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('qwen3-coder:30b');
  });

  it('route cycle: exits 1 with cycle message', () => {
    const g = makeTestHome({ a: 'b', b: 'a' });
    const r = runRouter(['--route', 'a', '-p', 'x'], g);
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(1);
    expect(r.stderr).to.match(/cycle/i);
  });

  it('rejects fallback strategy cycles during startup', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-fallback-cycle-'));
    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      routes: {
        default: 'high-model',
        'high-model': 'claude-sonnet-4-6',
        'medium-model': 'qwen3.5:35b-a3b-coding-nvfp4',
      },
      fallback_strategies: {
        'claude-sonnet-4-6': {
          on: {
            network: ['high-model'],
          },
        },
      },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    const stub = path.join(binDir, 'claude');
    fs.writeFileSync(stub, '#!/bin/bash\nexit 0\n');
    fs.chmodSync(stub, 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1',
      CLAUDE_PROXY_PORT: '19996',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const r = spawnSync('bash', [ROUTER, '-p', 'hello'], { env, cwd: homeDir, encoding: 'utf8' });
    fs.rmSync(homeDir, { recursive: true, force: true });

    expect(r.status).to.equal(1);
    expect(r.stderr).to.match(/cycle/i);
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

  it('rewrites the existing downstream --model arg in place and preserves surrounding args', () => {
    const g = makeTestHome({
      medium: 'qwen3-coder:30b',
    });
    const r = runRouter(['--model', 'medium', '--output-format', 'json', '-p', 'pong'], g);
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    const lines = r.stdout.trim().split('\n');
    expect(lines).to.deep.equal(['--dangerously-skip-permissions', '--model', 'qwen3-coder:30b', '--output-format', 'json', '-p', 'pong']);
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
    expect(r.stderr).to.match(/empty|null|invalid/i);
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

  it('no explicit model uses routes.default', () => {
    const g = makeTestHome({
      default: 'medium-model',
      'medium-model': 'qwen3-coder:30b',
    });
    const r = runRouter(['-p', 'hello'], g);
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('--model=qwen3-coder:30b');
  });

  it('drops --route but otherwise passes non-model args through unchanged', () => {
    const g = makeTestHome({
      default: 'medium-model',
      'medium-model': 'qwen3-coder:30b',
    });
    const r = runRouter(['--route', 'default', '--output-format', 'stream-json', '-p', 'hello'], g);
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    const lines = r.stdout.trim().split('\n');
    expect(lines).to.deep.equal(['--model=qwen3-coder:30b', '--dangerously-skip-permissions', '--output-format', 'stream-json', '-p', 'hello']);
  });

  it('prints the exact downstream claude command in debug mode', () => {
    const g = makeTestHome({
      high: 'qwen3-coder-next:cloud',
    });
    const r = runRouter(['--model', 'high', '-p', 'hello world'], g, {
      CLAUDE_ROUTER_DEBUG: '2',
    });
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stderr).to.include('EXEC=');
    expect(r.stderr).to.include(`${g.stub} --dangerously-skip-permissions --model qwen3-coder-next:cloud -p hello\\ world`);
  });

  it('injects --dangerously-skip-permissions by default', () => {
    const g = makeTestHome({
      default: 'medium-model',
      'medium-model': 'qwen3-coder:30b',
    });
    const r = runRouter(['-p', 'hello'], g);
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    const lines = r.stdout.trim().split('\n');
    expect(lines).to.deep.equal(['--model=qwen3-coder:30b', '--dangerously-skip-permissions', '-p', 'hello']);
  });

  it('does not duplicate --dangerously-skip-permissions when already provided', () => {
    const g = makeTestHome({
      default: 'medium-model',
      'medium-model': 'qwen3-coder:30b',
    });
    const r = runRouter(['--dangerously-skip-permissions', '-p', 'hello'], g);
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    const lines = r.stdout.trim().split('\n');
    expect(lines.filter(l => l === '--dangerously-skip-permissions')).to.have.length(1);
    expect(lines).to.deep.equal(['--model=qwen3-coder:30b', '--dangerously-skip-permissions', '-p', 'hello']);
  });

  it('unknown claude-* model defaults to anthropic backend', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-claude-default-'));
    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      backends: {
        anthropic: { kind: 'anthropic', url: 'https://api.anthropic.com', auth_env: 'TEST_ANTHROPIC_KEY' },
      },
      model_routes: {
        'claude-sonnet-4-6': 'anthropic',
      },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    const stub = path.join(binDir, 'claude');
    fs.writeFileSync(stub, [
      '#!/bin/bash',
      'echo "ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}"',
      'echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"',
      'for a in "$@"; do echo "$a"; done',
    ].join('\n') + '\n');
    fs.chmodSync(stub, 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      TEST_ANTHROPIC_KEY: 'router-test-anthropic-key',
      CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const r = spawnSync('bash', [ROUTER, '--model', 'claude-haiku-4-5-20251001', '-p', 'hello'], {
      env,
      cwd: homeDir,
      encoding: 'utf8',
    });
    fs.rmSync(homeDir, { recursive: true, force: true });

    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('ANTHROPIC_BASE_URL=https://api.anthropic.com');
    expect(r.stdout).to.include('ANTHROPIC_API_KEY=router-test-anthropic-key');
    expect(r.stdout).to.include('claude-haiku-4-5-20251001');
  });

  it('pattern model_routes keys can map claude-* models to anthropic', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-claude-pattern-'));
    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      backends: {
        anthropic: { kind: 'anthropic', url: 'https://api.anthropic.com', auth_env: 'TEST_ANTHROPIC_KEY' },
      },
      model_routes: {
        're:^claude-.*$': 'anthropic',
      },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    const stub = path.join(binDir, 'claude');
    fs.writeFileSync(stub, [
      '#!/bin/bash',
      'echo "ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}"',
      'echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"',
      'for a in "$@"; do echo "$a"; done',
    ].join('\n') + '\n');
    fs.chmodSync(stub, 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      TEST_ANTHROPIC_KEY: 'router-test-anthropic-key',
      CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const r = spawnSync('bash', [ROUTER, '--model', 'claude-custom-foo', '-p', 'hello'], {
      env,
      cwd: homeDir,
      encoding: 'utf8',
    });
    fs.rmSync(homeDir, { recursive: true, force: true });

    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('ANTHROPIC_BASE_URL=https://api.anthropic.com');
    expect(r.stdout).to.include('ANTHROPIC_API_KEY=router-test-anthropic-key');
    expect(r.stdout).to.include('claude-custom-foo');
  });

  it('keeps direct anthropic routing when the final model has no fallback strategy', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-direct-no-fallback-'));
    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      routes: {
        default: 'high-model',
        'high-model': 'claude-sonnet-4-6',
      },
      backends: {
        anthropic: { kind: 'anthropic', url: 'https://api.anthropic.com', auth_env: 'TEST_ANTHROPIC_KEY' },
      },
      model_routes: {
        'claude-sonnet-4-6': 'anthropic',
      },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    const stub = path.join(binDir, 'claude');
    fs.writeFileSync(stub, [
      '#!/bin/bash',
      'echo "ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}"',
      'echo "ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}"',
      'echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"',
      'for a in "$@"; do echo "$a"; done',
    ].join('\n') + '\n');
    fs.chmodSync(stub, 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      TEST_ANTHROPIC_KEY: 'router-test-anthropic-key',
      CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1',
      CLAUDE_PROXY_PORT: '19996',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const r = spawnSync('bash', [ROUTER, '-p', 'hello'], {
      env,
      cwd: homeDir,
      encoding: 'utf8',
    });
    fs.rmSync(homeDir, { recursive: true, force: true });

    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('ANTHROPIC_BASE_URL=https://api.anthropic.com');
    expect(r.stdout).to.include('ANTHROPIC_API_KEY=router-test-anthropic-key');
    expect(r.stdout).not.to.include('proxied-placeholder');
    expect(r.stdout).to.include('--model=claude-sonnet-4-6');
  });

  it('forces proxy routing when the resolved final model has a fallback strategy', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-direct-with-fallback-'));
    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      routes: {
        default: 'high-model',
        'high-model': 'claude-sonnet-4-6',
        'medium-model': 'qwen3.5:35b-a3b-coding-nvfp4',
      },
      backends: {
        anthropic: { kind: 'anthropic', url: 'https://api.anthropic.com', auth_env: 'TEST_ANTHROPIC_KEY' },
        ollama_local: { kind: 'ollama', url: 'http://localhost:11434' },
      },
      model_routes: {
        'claude-sonnet-4-6': 'anthropic',
        'qwen3.5:35b-a3b-coding-nvfp4': 'ollama_local',
      },
      fallback_strategies: {
        'claude-sonnet-4-6': {
          on: {
            rate_limit: ['medium-model'],
          },
        },
      },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    const stub = path.join(binDir, 'claude');
    fs.writeFileSync(stub, [
      '#!/bin/bash',
      'echo "ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}"',
      'echo "ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}"',
      'echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"',
      'for a in "$@"; do echo "$a"; done',
    ].join('\n') + '\n');
    fs.chmodSync(stub, 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      TEST_ANTHROPIC_KEY: 'router-test-anthropic-key',
      CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1',
      CLAUDE_PROXY_PORT: '19996',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const r = spawnSync('bash', [ROUTER, '-p', 'hello'], {
      env,
      cwd: homeDir,
      encoding: 'utf8',
    });
    fs.rmSync(homeDir, { recursive: true, force: true });

    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('ANTHROPIC_BASE_URL=http://127.0.0.1:19996');
    expect(r.stdout).to.include('ANTHROPIC_API_KEY=proxied-placeholder');
    expect(r.stdout).to.include('ANTHROPIC_AUTH_TOKEN=');
    expect(r.stdout).to.include('--model=claude-sonnet-4-6');
  });

  it('resolves model-map.json from the git project root when launched in a nested directory', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-project-config-'));
    const profileClaudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(profileClaudeDir, { recursive: true });
    fs.writeFileSync(path.join(profileClaudeDir, 'model-map.json'), JSON.stringify({
      routes: {
        default: 'profile-model',
        'profile-model': 'profile-terminal',
      },
    }, null, 2));

    const repoDir = path.join(homeDir, 'repo');
    const nestedDir = path.join(repoDir, 'packages', 'app');
    fs.mkdirSync(path.join(repoDir, '.claude'), { recursive: true });
    fs.mkdirSync(nestedDir, { recursive: true });
    initGitRepo(repoDir);
    fs.writeFileSync(path.join(repoDir, '.claude', 'model-map.json'), JSON.stringify({
      routes: {
        default: 'project-model',
        'project-model': 'project-terminal',
      },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    const stub = path.join(binDir, 'claude');
    fs.writeFileSync(stub, [
      '#!/bin/bash',
      'echo "CLAUDE_MODEL_MAP_PATH=${CLAUDE_MODEL_MAP_PATH}"',
      'for a in "$@"; do echo "$a"; done',
    ].join('\n') + '\n');
    fs.chmodSync(stub, 0o755);

    const expectedConfigPath = fs.realpathSync(path.join(repoDir, '.claude', 'model-map.json'));
    const r = runRouter(['-p', 'hello'], { homeDir, binDir, cwd: nestedDir });

    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include(`CLAUDE_MODEL_MAP_PATH=${expectedConfigPath}`);
    expect(r.stdout).to.include('--model=project-terminal');
    expect(r.stdout).not.to.include('profile-terminal');
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  it('falls back to a parent-directory model-map outside git', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-parent-walk-'));
    const profileClaudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(profileClaudeDir, { recursive: true });
    fs.writeFileSync(path.join(profileClaudeDir, 'model-map.json'), JSON.stringify({
      routes: {
        default: 'profile-model',
        'profile-model': 'profile-terminal',
      },
    }, null, 2));

    const workspaceDir = path.join(homeDir, 'workspace');
    const nestedDir = path.join(workspaceDir, 'deep', 'nested');
    fs.mkdirSync(path.join(workspaceDir, '.claude'), { recursive: true });
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, '.claude', 'model-map.json'), JSON.stringify({
      routes: {
        default: 'walked-model',
        'walked-model': 'walked-terminal',
      },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    const stub = path.join(binDir, 'claude');
    fs.writeFileSync(stub, [
      '#!/bin/bash',
      'echo "CLAUDE_MODEL_MAP_PATH=${CLAUDE_MODEL_MAP_PATH}"',
      'for a in "$@"; do echo "$a"; done',
    ].join('\n') + '\n');
    fs.chmodSync(stub, 0o755);

    const expectedConfigPath = fs.realpathSync(path.join(workspaceDir, '.claude', 'model-map.json'));
    const r = runRouter(['-p', 'hello'], { homeDir, binDir, cwd: nestedDir });

    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include(`CLAUDE_MODEL_MAP_PATH=${expectedConfigPath}`);
    expect(r.stdout).to.include('--model=walked-terminal');
    expect(r.stdout).not.to.include('profile-terminal');
    fs.rmSync(homeDir, { recursive: true, force: true });
  });
});

describe('claude-router PATH entry (installed as claude)', () => {
  before(function () {
    this.timeout(10000);
  });

  it('skips itself on PATH and execs the next claude binary', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-path-selfskip-'));
    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      providers: {
        'solo:tag': {
          base_url: 'https://example.invalid',
          auth_token: 'test-token',
        },
      },
    }, null, 2));
    const bin0 = path.join(homeDir, 'bin0');
    const bin1 = path.join(homeDir, 'bin1');
    const bin2 = path.join(homeDir, 'bin2');
    fs.mkdirSync(bin0);
    fs.mkdirSync(bin1);
    fs.mkdirSync(bin2);
    const ollamaStub = path.join(bin0, 'ollama');
    fs.writeFileSync(
      ollamaStub,
      [
        '#!/bin/bash',
        'case "$1" in',
        '  ps) printf \'%s\\n\' "${OLLAMA_STUB_PS_OUTPUT:-NAME   ID}"; exit "${OLLAMA_STUB_PS_EXIT:-0}" ;;',
        '  list) printf \'%s\\n\' "${OLLAMA_STUB_LIST_OUTPUT:-NAME   ID}"; exit "${OLLAMA_STUB_LIST_EXIT:-0}" ;;',
        '  run) exit 0 ;;',
        '  *)   exit 1 ;;',
        'esac',
      ].join('\n') + '\n',
    );
    fs.chmodSync(ollamaStub, 0o755);
    fs.copyFileSync(ROUTER, path.join(bin1, 'claude'));
    fs.chmodSync(path.join(bin1, 'claude'), 0o755);
    const stub2 = path.join(bin2, 'claude');
    fs.writeFileSync(stub2, '#!/bin/bash\nfor a in "$@"; do echo "$a"; done\n');
    fs.chmodSync(stub2, 0o755);
    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${bin0}:${bin1}:${bin2}:${process.env.PATH}`,
      OLLAMA_BASE_URL: 'http://127.0.0.1:19999',
      CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };
    const r = spawnSync(path.join(bin1, 'claude'), ['--model', 'solo:tag', '-p', 'x'], {
      env,
      cwd: homeDir,
      encoding: 'utf8',
    });
    fs.rmSync(homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('solo:tag');
  });
});

describe('claude-router proxy child lifecycle', () => {
  it('keeps an autostarted proxy as a child and stops it when the router exits', async function () {
    this.timeout(10000);

    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-proxy-child-'));
    const claudeDir = path.join(homeDir, '.claude');
    const toolsDir = path.join(claudeDir, 'tools');
    const binDir = path.join(homeDir, 'bin');
    const infoFile = path.join(homeDir, 'proxy-info.json');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.mkdirSync(binDir);

    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      backends: {
        ollama_local: { kind: 'ollama', url: 'http://localhost:11434' },
      },
      model_routes: { 'claude-sonnet-4-6': 'ollama_local' },
      routes: { default: 'claude-sonnet-4-6' },
    }, null, 2));

    fs.writeFileSync(path.join(toolsDir, 'claude-proxy'), [
      '#!/usr/bin/env node',
      '\'use strict\';',
      'const fs = require(\'fs\');',
      'const http = require(\'http\');',
      'const infoFile = process.env.PROXY_INFO_FILE;',
      'const server = http.createServer((req, res) => {',
      '  if (req.url === \'/ping\') {',
      '    const body = JSON.stringify({ ok: true, pid: process.pid });',
      '    res.writeHead(200, { \'content-type\': \'application/json\', \'content-length\': Buffer.byteLength(body) });',
      '    res.end(body);',
      '    return;',
      '  }',
      '  res.writeHead(404, { \'content-type\': \'application/json\' });',
      '  res.end(JSON.stringify({ error: \'not found\' }));',
      '});',
      'const configuredPort = process.env.CLAUDE_PROXY_PORT ? Number(process.env.CLAUDE_PROXY_PORT) : 0;',
      'server.listen(configuredPort, \'127.0.0.1\', () => {',
      '  if (!process.env.CLAUDE_PROXY_PORT) process.stdout.write(`READY ${server.address().port}\\n`);',
      '  console.error(`proxy started on ${server.address().port}`);',
      '  fs.writeFileSync(infoFile, JSON.stringify({ pid: process.pid, ppid: process.ppid, port: server.address().port }));',
      '});',
      'process.on(\'SIGTERM\', () => server.close(() => process.exit(0)));',
      'process.on(\'SIGINT\', () => server.close(() => process.exit(0)));',
      'setInterval(() => {}, 1000);',
    ].join('\n') + '\n');
    fs.chmodSync(path.join(toolsDir, 'claude-proxy'), 0o755);

    fs.writeFileSync(path.join(binDir, 'claude'), '#!/bin/bash\nsleep 0.8\nexit 0\n');
    fs.chmodSync(path.join(binDir, 'claude'), 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      PROXY_INFO_FILE: infoFile,
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const routerProc = spawn('bash', [ROUTER, '-p', 'hello'], {
      env,
      cwd: homeDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const waitFor = async predicate => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const value = predicate();
        if (value) return value;
        await new Promise(r => setTimeout(r, 50));
      }
      return null;
    };

    const info = await waitFor(() => {
      if (!fs.existsSync(infoFile)) return null;
      return JSON.parse(fs.readFileSync(infoFile, 'utf8'));
    });

    try {
      expect(info).to.be.an('object');
      expect(info.ppid).to.be.a('number');
      expect(info.ppid).to.be.greaterThan(1);
      expect(info.port).to.be.a('number');
      expect(info.port).to.be.greaterThan(0);
      expect(fs.readdirSync(claudeDir).filter(name => /^proxy\..*\.log$/.test(name))).to.deep.equal([]);

      const stderr = await new Promise((resolve, reject) => {
        let data = '';
        routerProc.stderr.setEncoding('utf8');
        routerProc.stderr.on('data', chunk => {
          data += chunk;
        });
        routerProc.on('error', reject);
        routerProc.on('exit', code => {
          try {
            expect(code).to.equal(0);
            resolve(data);
          } catch (err) {
            reject(err);
          }
        });
      });
      expect(stderr).to.not.include('proxy started on');

      const proxyStopped = await waitFor(() => {
        try {
          process.kill(info.pid, 0);
          return false;
        } catch (err) {
          return err.code === 'ESRCH';
        }
      });
      expect(proxyStopped).to.equal(true);
    } finally {
      routerProc.kill('SIGTERM');
      fs.rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('starts concurrent router launches on distinct dynamic proxy ports', async function () {
    this.timeout(10000);

    const mkCtx = prefix => {
      const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
      const claudeDir = path.join(homeDir, '.claude');
      const toolsDir = path.join(claudeDir, 'tools');
      const binDir = path.join(homeDir, 'bin');
      const infoFile = path.join(homeDir, 'proxy-info.json');
      fs.mkdirSync(toolsDir, { recursive: true });
      fs.mkdirSync(binDir);
      fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
        backends: {
          ollama_local: { kind: 'ollama', url: 'http://localhost:11434' },
        },
        model_routes: { 'claude-sonnet-4-6': 'ollama_local' },
        routes: { default: 'claude-sonnet-4-6' },
      }, null, 2));
      fs.writeFileSync(path.join(toolsDir, 'claude-proxy'), [
        '#!/usr/bin/env node',
        '\'use strict\';',
        'const fs = require(\'fs\');',
        'const http = require(\'http\');',
        'const infoFile = process.env.PROXY_INFO_FILE;',
        'const server = http.createServer((req, res) => {',
        '  if (req.url === \'/ping\') {',
        '    const body = JSON.stringify({ ok: true, pid: process.pid });',
        '    res.writeHead(200, { \'content-type\': \'application/json\', \'content-length\': Buffer.byteLength(body) });',
        '    res.end(body);',
        '    return;',
        '  }',
        '  res.writeHead(404, { \'content-type\': \'application/json\' });',
        '  res.end(JSON.stringify({ error: \'not found\' }));',
        '});',
        'const configuredPort = process.env.CLAUDE_PROXY_PORT ? Number(process.env.CLAUDE_PROXY_PORT) : 0;',
        'server.listen(configuredPort, \'127.0.0.1\', () => {',
        '  if (!process.env.CLAUDE_PROXY_PORT) process.stdout.write(`READY ${server.address().port}\\n`);',
        '  fs.writeFileSync(infoFile, JSON.stringify({ pid: process.pid, ppid: process.ppid, port: server.address().port }));',
        '});',
        'process.on(\'SIGTERM\', () => server.close(() => process.exit(0)));',
        'process.on(\'SIGINT\', () => server.close(() => process.exit(0)));',
        'setInterval(() => {}, 1000);',
      ].join('\n') + '\n');
      fs.chmodSync(path.join(toolsDir, 'claude-proxy'), 0o755);
      fs.writeFileSync(path.join(binDir, 'claude'), '#!/bin/bash\nsleep 0.8\nexit 0\n');
      fs.chmodSync(path.join(binDir, 'claude'), 0o755);
      return { homeDir, infoFile, binDir };
    };

    const a = mkCtx('cr-proxy-concurrent-a-');
    const b = mkCtx('cr-proxy-concurrent-b-');
    const waitFor = async predicate => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const value = predicate();
        if (value) return value;
        await new Promise(r => setTimeout(r, 50));
      }
      return null;
    };

    const envFor = ctx => ({
      ...process.env,
      HOME: ctx.homeDir,
      PATH: `${ctx.binDir}:${process.env.PATH}`,
      PROXY_INFO_FILE: ctx.infoFile,
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    });

    const procA = spawn('bash', [ROUTER, '-p', 'hello'], {
      env: envFor(a),
      cwd: a.homeDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const procB = spawn('bash', [ROUTER, '-p', 'hello'], {
      env: envFor(b),
      cwd: b.homeDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const infoA = await waitFor(() => fs.existsSync(a.infoFile) ? JSON.parse(fs.readFileSync(a.infoFile, 'utf8')) : null);
    const infoB = await waitFor(() => fs.existsSync(b.infoFile) ? JSON.parse(fs.readFileSync(b.infoFile, 'utf8')) : null);

    try {
      expect(infoA).to.be.an('object');
      expect(infoB).to.be.an('object');
      expect(infoA.port).to.be.a('number');
      expect(infoB.port).to.be.a('number');
      expect(infoA.port).to.not.equal(infoB.port);
    } finally {
      procA.kill('SIGTERM');
      procB.kill('SIGTERM');
      fs.rmSync(a.homeDir, { recursive: true, force: true });
      fs.rmSync(b.homeDir, { recursive: true, force: true });
    }
  });

  it('does not create a proxy log file by default when starting on an explicit port', async function () {
    this.timeout(10000);

    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-proxy-explicit-nolog-'));
    const claudeDir = path.join(homeDir, '.claude');
    const toolsDir = path.join(claudeDir, 'tools');
    const binDir = path.join(homeDir, 'bin');
    const infoFile = path.join(homeDir, 'proxy-info.json');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.mkdirSync(binDir);

    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      backends: {
        ollama_local: { kind: 'ollama', url: 'http://localhost:11434' },
      },
      model_routes: { 'claude-sonnet-4-6': 'ollama_local' },
      routes: { default: 'claude-sonnet-4-6' },
    }, null, 2));

    fs.writeFileSync(path.join(toolsDir, 'claude-proxy'), [
      '#!/usr/bin/env node',
      '\'use strict\';',
      'const fs = require(\'fs\');',
      'const http = require(\'http\');',
      'const infoFile = process.env.PROXY_INFO_FILE;',
      'const server = http.createServer((req, res) => {',
      '  if (req.url === \'/ping\') {',
      '    const body = JSON.stringify({ ok: true, pid: process.pid });',
      '    res.writeHead(200, { \'content-type\': \'application/json\', \'content-length\': Buffer.byteLength(body) });',
      '    res.end(body);',
      '    return;',
      '  }',
      '  res.writeHead(404, { \'content-type\': \'application/json\' });',
      '  res.end(JSON.stringify({ error: \'not found\' }));',
      '});',
      'server.listen(Number(process.env.CLAUDE_PROXY_PORT), \'127.0.0.1\', () => {',
      '  console.error(`proxy started on ${server.address().port}`);',
      '  fs.writeFileSync(infoFile, JSON.stringify({ pid: process.pid, port: server.address().port }));',
      '});',
      'process.on(\'SIGTERM\', () => server.close(() => process.exit(0)));',
      'process.on(\'SIGINT\', () => server.close(() => process.exit(0)));',
      'setInterval(() => {}, 1000);',
    ].join('\n') + '\n');
    fs.chmodSync(path.join(toolsDir, 'claude-proxy'), 0o755);

    fs.writeFileSync(path.join(binDir, 'claude'), '#!/bin/bash\nsleep 0.5\nexit 0\n');
    fs.chmodSync(path.join(binDir, 'claude'), 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      PROXY_INFO_FILE: infoFile,
      CLAUDE_PROXY_PORT: '18993',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const routerProc = spawn('bash', [ROUTER, '-p', 'hello'], {
      env,
      cwd: homeDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const waitFor = async predicate => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const value = predicate();
        if (value) return value;
        await new Promise(r => setTimeout(r, 50));
      }
      return null;
    };

    const info = await waitFor(() => {
      if (!fs.existsSync(infoFile)) return null;
      return JSON.parse(fs.readFileSync(infoFile, 'utf8'));
    });

    try {
      expect(info).to.be.an('object');
      expect(info.port).to.equal(18993);
      expect(fs.readdirSync(claudeDir).filter(name => /^proxy\..*\.log$/.test(name))).to.deep.equal([]);

      const stderr = await new Promise((resolve, reject) => {
        let data = '';
        routerProc.stderr.setEncoding('utf8');
        routerProc.stderr.on('data', chunk => {
          data += chunk;
        });
        routerProc.on('error', reject);
        routerProc.on('exit', code => {
          try {
            expect(code).to.equal(0);
            resolve(data);
          } catch (err) {
            reject(err);
          }
        });
      });
      expect(stderr).to.not.include('proxy started on');
    } finally {
      routerProc.kill('SIGTERM');
      fs.rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('creates a proxy log file only when CLAUDE_PROXY_LOG_DIR is set', async function () {
    this.timeout(10000);

    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-proxy-log-optin-'));
    const claudeDir = path.join(homeDir, '.claude');
    const toolsDir = path.join(claudeDir, 'tools');
    const binDir = path.join(homeDir, 'bin');
    const logDir = path.join(homeDir, 'proxy-logs');
    const infoFile = path.join(homeDir, 'proxy-info.json');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.mkdirSync(binDir);

    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      backends: {
        ollama_local: { kind: 'ollama', url: 'http://localhost:11434' },
      },
      model_routes: { 'claude-sonnet-4-6': 'ollama_local' },
      routes: { default: 'claude-sonnet-4-6' },
    }, null, 2));

    fs.writeFileSync(path.join(toolsDir, 'claude-proxy'), [
      '#!/usr/bin/env node',
      '\'use strict\';',
      'const fs = require(\'fs\');',
      'const http = require(\'http\');',
      'const infoFile = process.env.PROXY_INFO_FILE;',
      'const server = http.createServer((req, res) => {',
      '  if (req.url === \'/ping\') {',
      '    const body = JSON.stringify({ ok: true, pid: process.pid });',
      '    res.writeHead(200, { \'content-type\': \'application/json\', \'content-length\': Buffer.byteLength(body) });',
      '    res.end(body);',
      '    return;',
      '  }',
      '  res.writeHead(404, { \'content-type\': \'application/json\' });',
      '  res.end(JSON.stringify({ error: \'not found\' }));',
      '});',
      'const configuredPort = process.env.CLAUDE_PROXY_PORT ? Number(process.env.CLAUDE_PROXY_PORT) : 0;',
      'server.listen(configuredPort, \'127.0.0.1\', () => {',
      '  if (!process.env.CLAUDE_PROXY_PORT) process.stdout.write(`READY ${server.address().port}\\n`);',
      '  console.error(`proxy started on ${server.address().port}`);',
      '  fs.writeFileSync(infoFile, JSON.stringify({ pid: process.pid, port: server.address().port }));',
      '});',
      'process.on(\'SIGTERM\', () => server.close(() => process.exit(0)));',
      'process.on(\'SIGINT\', () => server.close(() => process.exit(0)));',
      'setInterval(() => {}, 1000);',
    ].join('\n') + '\n');
    fs.chmodSync(path.join(toolsDir, 'claude-proxy'), 0o755);

    fs.writeFileSync(path.join(binDir, 'claude'), '#!/bin/bash\nsleep 0.5\nexit 0\n');
    fs.chmodSync(path.join(binDir, 'claude'), 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      PROXY_INFO_FILE: infoFile,
      CLAUDE_PROXY_LOG_DIR: logDir,
      CLAUDE_ROUTER_DEBUG: '2',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const routerProc = spawn('bash', [ROUTER, '-p', 'hello'], {
      env,
      cwd: homeDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const waitFor = async predicate => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const value = predicate();
        if (value) return value;
        await new Promise(r => setTimeout(r, 50));
      }
      return null;
    };

    const info = await waitFor(() => {
      if (!fs.existsSync(infoFile)) return null;
      return JSON.parse(fs.readFileSync(infoFile, 'utf8'));
    });

    try {
      expect(info).to.be.an('object');
      const logPath = path.join(logDir, `proxy.${info.port}.log`);
      const logExists = await waitFor(() => fs.existsSync(logPath));
      expect(logExists).to.equal(true);

      const stderr = await new Promise((resolve, reject) => {
        let data = '';
        routerProc.stderr.setEncoding('utf8');
        routerProc.stderr.on('data', chunk => {
          data += chunk;
        });
        routerProc.on('error', reject);
        routerProc.on('exit', code => {
          try {
            expect(code).to.equal(0);
            resolve(data);
          } catch (err) {
            reject(err);
          }
        });
      });

      expect(stderr).to.include(`claude-proxy log=${logPath}`);
      expect(fs.readFileSync(logPath, 'utf8')).to.include('proxy started on');
    } finally {
      routerProc.kill('SIGTERM');
      fs.rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('restarts an existing proxy on the port when it reports a different config path', async function () {
    this.timeout(10000);

    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-proxy-restart-'));
    const claudeDir = path.join(homeDir, '.claude');
    const toolsDir = path.join(claudeDir, 'tools');
    const binDir = path.join(homeDir, 'bin');
    const infoFile = path.join(homeDir, 'proxy-info.json');
    const oldInfoFile = path.join(homeDir, 'old-proxy-info.json');
    const otherConfig = path.join(homeDir, 'other-model-map.json');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.mkdirSync(binDir);

    const configPath = path.join(claudeDir, 'model-map.json');
    fs.writeFileSync(configPath, JSON.stringify({
      backends: {
        ollama_local: { kind: 'ollama', url: 'http://localhost:11434' },
      },
      model_routes: { 'claude-sonnet-4-6': 'ollama_local' },
      routes: { default: 'claude-sonnet-4-6' },
    }, null, 2));
    fs.writeFileSync(otherConfig, JSON.stringify({
      routes: { default: 'different-model' },
    }, null, 2));

    const proxyScript = path.join(toolsDir, 'claude-proxy');
    fs.writeFileSync(proxyScript, [
      '#!/usr/bin/env node',
      '\'use strict\';',
      'const fs = require(\'fs\');',
      'const http = require(\'http\');',
      'const configPath = process.env.CLAUDE_MODEL_MAP_PATH || \'\';',
      'const infoFile = process.env.PROXY_INFO_FILE;',
      'const server = http.createServer((req, res) => {',
      '  if (req.url === \'/ping\') {',
      '    const body = JSON.stringify({ ok: true, pid: process.pid, config_path: configPath });',
      '    res.writeHead(200, { \'content-type\': \'application/json\', \'content-length\': Buffer.byteLength(body) });',
      '    res.end(body);',
      '    return;',
      '  }',
      '  res.writeHead(404, { \'content-type\': \'application/json\' });',
      '  res.end(JSON.stringify({ error: \'not found\' }));',
      '});',
      'const configuredPort = process.env.CLAUDE_PROXY_PORT ? Number(process.env.CLAUDE_PROXY_PORT) : 0;',
      'server.listen(configuredPort, \'127.0.0.1\', () => {',
      '  if (!process.env.CLAUDE_PROXY_PORT) process.stdout.write(`READY ${server.address().port}\\n`);',
      '  fs.writeFileSync(infoFile, JSON.stringify({ pid: process.pid, ppid: process.ppid, configPath }));',
      '});',
      'process.on(\'SIGTERM\', () => server.close(() => process.exit(0)));',
      'process.on(\'SIGINT\', () => server.close(() => process.exit(0)));',
      'setInterval(() => {}, 1000);',
    ].join('\n') + '\n');
    fs.chmodSync(proxyScript, 0o755);

    fs.writeFileSync(path.join(binDir, 'claude'), '#!/bin/bash\nsleep 0.8\nexit 0\n');
    fs.chmodSync(path.join(binDir, 'claude'), 0o755);

    const sharedEnv = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      CLAUDE_PROXY_PORT: '18992',
      PROXY_INFO_FILE: oldInfoFile,
      CLAUDE_MODEL_MAP_PATH: otherConfig,
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };
    const oldProxy = spawn(process.execPath, [proxyScript], {
      env: sharedEnv,
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    const waitFor = async predicate => {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const value = predicate();
        if (value) return value;
        await new Promise(r => setTimeout(r, 50));
      }
      return null;
    };

    const oldInfo = await waitFor(() => {
      if (!fs.existsSync(oldInfoFile)) return null;
      return JSON.parse(fs.readFileSync(oldInfoFile, 'utf8'));
    });
    expect(oldInfo).to.be.an('object');

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      PROXY_INFO_FILE: infoFile,
      CLAUDE_PROXY_PORT: '18992',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const routerProc = spawn('bash', [ROUTER, '-p', 'hello'], {
      env,
      cwd: homeDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const newInfo = await waitFor(() => {
      if (!fs.existsSync(infoFile)) return null;
      return JSON.parse(fs.readFileSync(infoFile, 'utf8'));
    });

    try {
      expect(newInfo).to.be.an('object');
      expect(newInfo.configPath).to.equal(fs.realpathSync(configPath));
      expect(newInfo.pid).to.not.equal(oldInfo.pid);

      const oldStopped = await waitFor(() => {
        try {
          process.kill(oldInfo.pid, 0);
          return false;
        } catch (err) {
          return err.code === 'ESRCH';
        }
      });
      expect(oldStopped).to.equal(true);
    } finally {
      routerProc.kill('SIGTERM');
      oldProxy.kill('SIGTERM');
      fs.rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('fails cleanly when the dynamic proxy never emits a READY line', async function () {
    this.timeout(10000);

    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-proxy-bad-ready-'));
    const claudeDir = path.join(homeDir, '.claude');
    const toolsDir = path.join(claudeDir, 'tools');
    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.mkdirSync(binDir);

    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      backends: {
        ollama_local: { kind: 'ollama', url: 'http://localhost:11434' },
      },
      model_routes: { 'claude-sonnet-4-6': 'ollama_local' },
      routes: { default: 'claude-sonnet-4-6' },
    }, null, 2));

    fs.writeFileSync(path.join(toolsDir, 'claude-proxy'), [
      '#!/usr/bin/env node',
      '\'use strict\';',
      'setTimeout(() => process.exit(0), 250);',
    ].join('\n') + '\n');
    fs.chmodSync(path.join(toolsDir, 'claude-proxy'), 0o755);

    fs.writeFileSync(path.join(binDir, 'claude'), '#!/bin/bash\nexit 0\n');
    fs.chmodSync(path.join(binDir, 'claude'), 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      CLAUDE_PROXY_READY_TIMEOUT_SECONDS: '1',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const result = spawnSync('bash', [ROUTER, '-p', 'hello'], {
      env,
      cwd: homeDir,
      encoding: 'utf8',
    });

    try {
      expect(result.status).to.not.equal(0);
      expect(result.stderr).to.match(/timed out waiting for claude-proxy readiness line|malformed claude-proxy readiness line/);
      expect(result.stderr).to.not.match(/proxy\..*\.log/);
    } finally {
      fs.rmSync(homeDir, { recursive: true, force: true });
    }
  });
});

describe('claude-router transparent proxy mode', () => {
  it('matches direct Ollama env for all-Ollama transparent runs', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-transparent-'));
    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      backends: {
        ollama_local: { kind: 'ollama', url: 'http://localhost:11434' },
      },
      model_routes: { 'claude-sonnet-4-6': 'ollama_local' },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    const stub = path.join(binDir, 'claude');
    fs.writeFileSync(stub, [
      '#!/bin/bash',
      'echo "ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}"',
      'echo "ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}"',
      'echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"',
      'for a in "$@"; do echo "$a"; done',
    ].join('\n') + '\n');
    fs.chmodSync(stub, 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1',
      CLAUDE_PROXY_PORT: '19996',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const r = spawnSync('bash', [ROUTER, '-p', 'hello'], { env, cwd: homeDir, encoding: 'utf8' });
    fs.rmSync(homeDir, { recursive: true, force: true });

    expect(r.status).to.equal(0, r.stderr);
    const port = extractProxyPort(r.stdout);
    expect(port).to.equal(19996);
    expect(r.stdout).to.include('ANTHROPIC_AUTH_TOKEN=ollama');
    expect(r.stdout).to.include('ANTHROPIC_API_KEY=');
    expect(r.stdout).not.to.include('proxied-placeholder');
  });

  it('keeps placeholder API key for mixed-backend transparent runs', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-transparent-mixed-'));
    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(claudeDir);
    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      backends: {
        anthropic: { kind: 'anthropic', url: 'https://api.anthropic.com', auth_env: 'ANTHROPIC_API_KEY' },
        ollama_local: { kind: 'ollama', url: 'http://localhost:11434' },
      },
      model_routes: { 'claude-sonnet-4-6': 'anthropic' },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    const stub = path.join(binDir, 'claude');
    fs.writeFileSync(stub, [
      '#!/bin/bash',
      'echo "ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}"',
      'echo "ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}"',
      'echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"',
    ].join('\n') + '\n');
    fs.chmodSync(stub, 0o755);

    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1',
      CLAUDE_PROXY_PORT: '19996',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };

    const r = spawnSync('bash', [ROUTER, '-p', 'hello'], { env, cwd: homeDir, encoding: 'utf8' });
    fs.rmSync(homeDir, { recursive: true, force: true });

    expect(r.status).to.equal(0, r.stderr);
    const port = extractProxyPort(r.stdout);
    expect(port).to.equal(19996);
    expect(r.stdout).to.include('ANTHROPIC_API_KEY=proxied-placeholder');
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

describe('ensure_ollama_running', function () {
  this.timeout(10000);
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
      PATH: `${noOllamaDir}:${path.dirname(spawnSync('bash', ['-lc', 'command -v jq'], { encoding: 'utf8' }).stdout.trim())}:/usr/bin:/bin`,
      OLLAMA_BASE_URL: 'http://127.0.0.1:19999',
      CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1',
      CLAUDE_PROXY_PORT: '19996',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
    };
    const result = spawnSync('bash', [ROUTER, '--model', 'test-model:7b', '-p', 'hi'], { env, cwd: ctx.homeDir, encoding: 'utf8' });
    fs.rmSync(noOllamaDir, { recursive: true, force: true });
    expect(result.stderr).to.equal('');
    expect(result.status).to.equal(0);
  });
});

describe('default model-map config', () => {
  it('shipped named routes resolve to configured terminal models', () => {
    const configPath = path.join(__dirname, '..', 'config', 'model-map.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const resolveRoute = start => {
      const seen = new Set();
      let current = start;
      while (config.routes && Object.prototype.hasOwnProperty.call(config.routes, current)) {
        if (seen.has(current)) throw new Error(`route cycle at ${current}`);
        seen.add(current);
        current = config.routes[current];
      }
      return current;
    };

    for (const routeName of ['default', 'medium-model', 'high-model', 'background', 'cloud_background', 'think', 'longContext']) {
      const terminal = resolveRoute(routeName);
      const isConfiguredLeaf =
        Boolean(config.model_routes && config.model_routes[terminal]) ||
        Boolean(config.providers && config.providers[terminal]);
      expect(
        isConfiguredLeaf,
        `${routeName} resolves to unconfigured terminal model ${terminal}`,
      ).to.equal(true);
    }
  });
});
