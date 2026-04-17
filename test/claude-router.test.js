'use strict';

const { expect } = require('chai');
const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROUTER = path.join(__dirname, '..', 'tools', 'claude-router');
const MCP_SERVER = path.join(__dirname, '..', 'tools', 'llm-capabilities-mcp.js');

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
  //   OLLAMA_STUB_PULL_EXIT (default 1)   exit code for `ollama pull`
  //   OLLAMA_STUB_PULL_REQUIRE_SIGNIN=1  fail pull until signin marker exists
  //   OLLAMA_STUB_PULL_AUTH_ERROR        stderr for auth-required pull failures
  //   OLLAMA_STUB_SIGNIN_EXIT (default 0) exit code for `ollama signin`
  //   OLLAMA_STUB_SIGNIN_MARKER          file created on successful signin
  //   OLLAMA_STUB_LOG_PATH  append invoked subcommands for assertions
  const ollamaStub = path.join(binDir, 'ollama');
  fs.writeFileSync(ollamaStub, [
    '#!/bin/bash',
    'if [[ -n "${OLLAMA_STUB_LOG_PATH:-}" ]]; then',
    '  printf \'%s\\n\' "$*" >> "${OLLAMA_STUB_LOG_PATH}"',
    'fi',
    'case "$1" in',
    '  ps)',
    '    printf \'%s\\n\' "${OLLAMA_STUB_PS_OUTPUT:-NAME   ID}"',
    '    exit "${OLLAMA_STUB_PS_EXIT:-0}" ;;',
    '  list)',
    '    printf \'%s\\n\' "${OLLAMA_STUB_LIST_OUTPUT:-NAME   ID}"',
    '    exit "${OLLAMA_STUB_LIST_EXIT:-0}" ;;',
    '  pull)',
    '    if [[ "${OLLAMA_STUB_PULL_REQUIRE_SIGNIN:-0}" == "1" && -n "${OLLAMA_STUB_SIGNIN_MARKER:-}" && ! -f "${OLLAMA_STUB_SIGNIN_MARKER}" ]]; then',
    '      printf \'%s\\n\' "${OLLAMA_STUB_PULL_AUTH_ERROR:-Error: please sign in to ollama.com}" >&2',
    '      exit "${OLLAMA_STUB_PULL_AUTH_EXIT:-1}"',
    '    fi',
    '    exit "${OLLAMA_STUB_PULL_EXIT:-1}" ;;',
    '  signin)',
    '    if [[ -n "${OLLAMA_STUB_SIGNIN_MARKER:-}" && "${OLLAMA_STUB_SIGNIN_EXIT:-0}" == "0" ]]; then',
    '      mkdir -p "$(dirname "${OLLAMA_STUB_SIGNIN_MARKER}")"',
    '      : > "${OLLAMA_STUB_SIGNIN_MARKER}"',
    '    fi',
    '    exit "${OLLAMA_STUB_SIGNIN_EXIT:-0}" ;;',
    '  run) exit 0 ;;',
    '  *)   exit 1 ;;',
    'esac',
  ].join('\n') + '\n');
  fs.chmodSync(ollamaStub, 0o755);

  return { homeDir, configPath, stub, binDir };
}

function runRouter(args, { homeDir, binDir, cwd = homeDir }, ollamaEnv = {}, spawnOptions = {}) {
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
    CLAUDE_MODEL_MAP_SKIP_GIT_PULL: '1',
    ...ollamaEnv,
  };
  const result = spawnSync('bash', [ROUTER, ...args], {
    env,
    cwd,
    encoding: 'utf8',
    ...spawnOptions,
  });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

function runRouterAsync(args, { homeDir, binDir, cwd = homeDir }, extraEnv = {}, spawnOptions = {}) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      HOME: homeDir,
      PATH: `${binDir}:${process.env.PATH}`,
      OLLAMA_BASE_URL: 'http://127.0.0.1:19999',
      CLAUDE_ROUTER_SKIP_PROXY_AUTOSTART: '1',
      CLAUDE_PROXY_PORT: '19996',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
      CLAUDE_MODEL_MAP_SKIP_GIT_PULL: '1',
      ...extraEnv,
    };
    const child = spawn('bash', [ROUTER, ...args], {
      env,
      cwd,
      encoding: 'utf8',
      ...spawnOptions,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`timed out running claude-router: ${args.join(' ')}`));
    }, 10000);
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    if (Object.prototype.hasOwnProperty.call(spawnOptions, 'input')) {
      child.stdin.end(spawnOptions.input);
    }
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ stdout, stderr, status: code });
    });
  });
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

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function startProxyStub(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const raw = chunks.length ? Buffer.concat(chunks).toString('utf8') : '';
      let body = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = raw;
      }
      requests.push({ method: req.method, url: req.url, body });
      handler(req, res, body, requests);
    });
  });
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port, requests });
    });
    server.on('error', reject);
  });
}

function installMcpAwareClaudeStub(binDir) {
  const stub = path.join(binDir, 'claude');
  const helper = path.join(binDir, 'fake-claude.js');
  fs.writeFileSync(helper, [
    '#!/usr/bin/env node',
    "'use strict';",
    "const fs = require('fs');",
    "const path = require('path');",
    "const { spawn } = require('child_process');",
    "const args = process.argv.slice(2);",
    "let prompt = '';",
    "for (let i = 0; i < args.length; i += 1) {",
    "  if (args[i] === '-p' && i + 1 < args.length) prompt = args[i + 1];",
    "}",
    "function findProjectConfig(projects, cwd) {",
    "  let cur = fs.realpathSync(cwd);",
    "  while (true) {",
    "    if (projects[cur]) return { key: cur, entry: projects[cur] };",
    "    const parent = path.dirname(cur);",
    "    if (parent === cur) break;",
    "    cur = parent;",
    "  }",
    "  return null;",
    "}",
    "function frame(msg) {",
    "  const body = Buffer.from(JSON.stringify(msg), 'utf8');",
    "  return Buffer.from(`Content-Length: ${body.length}\\r\\n\\r\\n${body.toString('utf8')}`, 'utf8');",
    "}",
    "let buf = Buffer.alloc(0);",
    "function parse(chunk, onMessage) {",
    "  buf = Buffer.concat([buf, chunk]);",
    "  while (true) {",
    "    const split = buf.indexOf('\\r\\n\\r\\n');",
    "    if (split === -1) return;",
    "    const header = buf.slice(0, split).toString('utf8');",
    "    const match = /Content-Length:\\s*(\\d+)/i.exec(header);",
    "    if (!match) throw new Error(`missing Content-Length header: ${header}`);",
    "    const len = Number(match[1]);",
    "    const end = split + 4 + len;",
    "    if (buf.length < end) return;",
    "    const body = JSON.parse(buf.slice(split + 4, end).toString('utf8'));",
    "    buf = buf.slice(end);",
    "    onMessage(body);",
    "  }",
    "}",
    "const claudeJson = path.join(process.env.HOME, '.claude.json');",
    "if (!fs.existsSync(claudeJson)) {",
    "  console.error('fake-claude: missing ~/.claude.json');",
    "  process.exit(1);",
    "}",
    "const data = JSON.parse(fs.readFileSync(claudeJson, 'utf8'));",
    "const projects = (data && data.projects) || {};",
    "const found = findProjectConfig(projects, process.cwd());",
    "if (!found || !found.entry || !found.entry.mcpServers || !found.entry.mcpServers['llm-capabilities']) {",
    "  console.error(`fake-claude: no llm-capabilities server for ${process.cwd()}`);",
    "  process.exit(1);",
    "}",
    "const serverEntry = found.entry.mcpServers['llm-capabilities'];",
    "const child = spawn(serverEntry.command, serverEntry.args || [], {",
    "  cwd: process.cwd(),",
    "  env: { ...process.env, ...(serverEntry.env || {}) },",
    "  stdio: ['pipe', 'pipe', 'inherit'],",
    "});",
    "let listed = false;",
    "let called = false;",
    "child.stdout.on('data', chunk => parse(chunk, msg => {",
    "  if (msg.error) {",
    "    console.error(`fake-claude mcp error: ${JSON.stringify(msg.error)}`);",
    "    process.exit(1);",
    "  }",
    "  if (msg.id === 1) {",
    "    child.stdin.write(frame({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }));",
    "    child.stdin.write(frame({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }));",
    "    return;",
    "  }",
    "  if (msg.id === 2 && !listed) {",
    "    listed = true;",
    "    const tools = (((msg || {}).result || {}).tools || []).map(t => t.name).sort();",
    "    if (/show me your tools exposed|list every mcp tool/i.test(prompt)) {",
    "      process.stdout.write(`TOOLS:${tools.join(',')}\\n`);",
    "      child.kill('SIGTERM');",
    "      return;",
    "    }",
    "    child.stdin.write(frame({",
    "      jsonrpc: '2.0',",
    "      id: 3,",
    "      method: 'tools/call',",
    "      params: {",
    "        name: 'classify_intent',",
    "        arguments: { prompt, context: 'e2e claude-router tool validation' },",
    "      },",
    "    }));",
    "    return;",
    "  }",
    "  if (msg.id === 3 && !called) {",
    "    called = true;",
    "    const structured = (msg.result || {}).structuredContent || {};",
    "    process.stdout.write(`CALL:${JSON.stringify(structured)}\\n`);",
    "    child.kill('SIGTERM');",
    "  }",
    "}));",
    "child.on('error', err => { console.error(`fake-claude: ${err.message}`); process.exit(1); });",
    "child.stdin.write(frame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));",
  ].join('\n') + '\n');
  fs.chmodSync(helper, 0o755);
  fs.writeFileSync(stub, `#!/bin/bash\nexec node "${helper}" "$@"\n`);
  fs.chmodSync(stub, 0o755);
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
        'medium-model': 'qwen3.6:35b-a3b-q4_K_M',
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
      'echo "CLAUDE_CONFIG_DIR=${CLAUDE_CONFIG_DIR}"',
      'echo "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=${CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC}"',
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
        'medium-model': 'qwen3.6:35b-a3b-q4_K_M',
      },
      backends: {
        anthropic: { kind: 'anthropic', url: 'https://api.anthropic.com', auth_env: 'TEST_ANTHROPIC_KEY' },
        ollama_local: { kind: 'ollama', url: 'http://localhost:11434' },
      },
      model_routes: {
        'claude-sonnet-4-6': 'anthropic',
        'qwen3.6:35b-a3b-q4_K_M': 'ollama_local',
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
      'echo "CLAUDE_PROJECT_DIR=${CLAUDE_PROJECT_DIR}"',
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
      'echo "CLAUDE_PROJECT_DIR=${CLAUDE_PROJECT_DIR}"',
      'for a in "$@"; do echo "$a"; done',
    ].join('\n') + '\n');
    fs.chmodSync(stub, 0o755);

    const expectedConfigPath = fs.realpathSync(path.join(repoDir, '.claude', 'model-map.json'));
    const expectedProjectDir = fs.realpathSync(repoDir);
    const r = runRouter(['-p', 'hello'], { homeDir, binDir, cwd: nestedDir });

    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include(`CLAUDE_MODEL_MAP_PATH=${expectedConfigPath}`);
    expect(r.stdout).to.include(`CLAUDE_PROJECT_DIR=${expectedProjectDir}`);
    expect(r.stdout).to.include('--model=project-terminal');
    expect(r.stdout).not.to.include('profile-terminal');
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  it('uses CLAUDE_DIR for profile model-map resolution instead of hard-coding ~/.claude', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-custom-claude-dir-'));
    const customClaudeDir = path.join(homeDir, 'custom-claude');
    fs.mkdirSync(customClaudeDir, { recursive: true });
    fs.writeFileSync(path.join(customClaudeDir, 'model-map.json'), JSON.stringify({
      routes: {
        default: 'custom-profile-model',
        'custom-profile-model': 'custom-profile-terminal',
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

    const expectedConfigPath = fs.realpathSync(path.join(customClaudeDir, 'model-map.json'));
    const r = runRouter(['-p', 'hello'], { homeDir, binDir }, { CLAUDE_DIR: customClaudeDir });

    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include(`CLAUDE_MODEL_MAP_PATH=${expectedConfigPath}`);
    expect(r.stdout).to.include('--model=custom-profile-terminal');
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
    this.timeout(15000);

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
    expect(r.stdout).not.to.include(`CLAUDE_CONFIG_DIR=${homeDir}/.claude-ollama`);
    expect(r.stdout).not.to.include('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1');
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

  it('model not cached: ps clean, model absent from ollama list → triggers pull attempt', () => {
    const r = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME   ID',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME   ID',
    });
    expect(r.stderr).to.include("not cached on http://localhost:11434 — pulling now");
    expect(r.stderr).to.include("failed to pull 'test-model:7b' from http://localhost:11434");
  });

  it('ollama CLI absent from PATH with no Homebrew → prints install hint and routing proceeds', () => {
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
    expect(result.stderr).to.include("'ollama' CLI not found");
    expect(result.status).to.equal(0);
  });

  it('ollama CLI absent with Homebrew present → attempts background install and routing proceeds', () => {
    const noOllamaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-no-ollama-brew-'));
    const claudeOnly = path.join(noOllamaDir, 'claude');
    const brewStub = path.join(noOllamaDir, 'brew');
    const brewLog = path.join(noOllamaDir, 'brew.log');
    fs.writeFileSync(claudeOnly, '#!/bin/bash\nfor a in "$@"; do echo "$a"; done\n');
    fs.writeFileSync(brewStub, `#!/bin/bash\nprintf '%s\\n' "$*" >> "${brewLog}"\nexit 0\n`);
    fs.chmodSync(claudeOnly, 0o755);
    fs.chmodSync(brewStub, 0o755);
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
    sleepMs(150);
    const brewOutput = fs.existsSync(brewLog) ? fs.readFileSync(brewLog, 'utf8') : '';
    fs.rmSync(noOllamaDir, { recursive: true, force: true });
    expect(result.stderr).to.include("attempting 'brew install ollama' in background");
    expect(result.status).to.equal(0);
    expect(brewOutput).to.include('install ollama');
  });

  it('fast successful Homebrew install continues active model prep in the same run', () => {
    const noOllamaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-no-ollama-brew-success-'));
    const claudeOnly = path.join(noOllamaDir, 'claude');
    const brewStub = path.join(noOllamaDir, 'brew');
    const brewLog = path.join(noOllamaDir, 'brew.log');
    const ollamaLog = path.join(noOllamaDir, 'ollama.log');
    fs.writeFileSync(claudeOnly, '#!/bin/bash\nfor a in "$@"; do echo "$a"; done\n');
    fs.writeFileSync(brewStub, [
      '#!/bin/bash',
      `printf '%s\\n' "$*" >> "${brewLog}"`,
      `cat > "${path.join(noOllamaDir, 'ollama')}" <<'EOF'`,
      '#!/bin/bash',
      `printf '%s\\n' "$*" >> "${ollamaLog}"`,
      'case "$1" in',
      '  ps)',
      "    printf 'NAME   ID\\n' ;;",
      '  list)',
      "    printf 'NAME           ID\\ntest-model:7b  abc123\\n' ;;",
      '  run) exit 0 ;;',
      '  pull) exit 0 ;;',
      '  *) exit 1 ;;',
      'esac',
      'EOF',
      `chmod +x "${path.join(noOllamaDir, 'ollama')}"`,
      'exit 0',
    ].join('\n') + '\n');
    fs.chmodSync(claudeOnly, 0o755);
    fs.chmodSync(brewStub, 0o755);
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
      CLAUDE_ROUTER_OLLAMA_INSTALL_WAIT_STEPS: '20',
    };
    const result = spawnSync('bash', [ROUTER, '--model', 'test-model:7b', '-p', 'hi'], { env, cwd: ctx.homeDir, encoding: 'utf8' });
    sleepMs(150);
    const brewOutput = fs.existsSync(brewLog) ? fs.readFileSync(brewLog, 'utf8') : '';
    const ollamaOutput = fs.existsSync(ollamaLog) ? fs.readFileSync(ollamaLog, 'utf8') : '';
    fs.rmSync(noOllamaDir, { recursive: true, force: true });
    expect(result.status).to.equal(0, result.stderr);
    expect(result.stderr).to.include("installed 'ollama' via Homebrew — continuing local model prep");
    expect(result.stderr).to.include("warming 'test-model:7b' on http://localhost:11434 (background)...");
    expect(brewOutput).to.include('install ollama');
    expect(ollamaOutput).to.match(/^ps$/m);
    expect(ollamaOutput).to.match(/^list$/m);
  });

  it('ollama CLI absent with failing Homebrew install → reports non-fatal failure clearly', () => {
    const noOllamaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-no-ollama-brew-fail-'));
    const claudeOnly = path.join(noOllamaDir, 'claude');
    const brewStub = path.join(noOllamaDir, 'brew');
    fs.writeFileSync(claudeOnly, '#!/bin/bash\nfor a in "$@"; do echo "$a"; done\n');
    fs.writeFileSync(brewStub, '#!/bin/bash\nexit 1\n');
    fs.chmodSync(claudeOnly, 0o755);
    fs.chmodSync(brewStub, 0o755);
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
      CLAUDE_ROUTER_OLLAMA_INSTALL_WAIT_STEPS: '2',
    };
    const result = spawnSync('bash', [ROUTER, '--model', 'test-model:7b', '-p', 'hi'], { env, cwd: ctx.homeDir, encoding: 'utf8' });
    fs.rmSync(noOllamaDir, { recursive: true, force: true });
    expect(result.status).to.equal(0);
    expect(result.stderr).to.include("attempting 'brew install ollama' in background");
    expect(result.stderr).to.include("failed to install 'ollama' via Homebrew");
  });

  it('background sweep refreshes stale configured models once per throttle window', () => {
    const logPath = path.join(ctx.homeDir, 'ollama.log');
    const statePath = path.join(ctx.homeDir, '.claude', 'ollama-prep-state.json');
    fs.writeFileSync(ctx.configPath, JSON.stringify({
      backends: {
        ollama_local: {
          kind: 'ollama',
          url: 'http://localhost:11434',
        },
      },
      llm_active_profile: '64gb',
      llm_connectivity_mode: 'connected',
      llm_profiles: {
        '64gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          workhorse: { connected_model: 'stale-model:8b', disconnect_model: 'stale-model:8b' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
        '128gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          workhorse: { connected_model: 'stale-model:8b', disconnect_model: 'stale-model:8b' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
      },
      model_routes: {
        'test-model:7b': 'ollama_local',
        'stale-model:8b': 'ollama_local',
      },
    }, null, 2));

    const first = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME           ID\ntest-model:7b  live123',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME           ID           SIZE      MODIFIED\ntest-model:7b  live123       4 GB      1 hour ago\nstale-model:8b  stale999     6 GB      8 days ago',
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_LOG_PATH: logPath,
      CLAUDE_ROUTER_OLLAMA_PREP_STATE_FILE: statePath,
      CLAUDE_ROUTER_OLLAMA_PREP_MIN_RETRY_SECONDS: '86400',
    });
    sleepMs(250);
    const firstLog = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(first.status).to.equal(0, first.stderr);
    expect(first.stderr).to.include('background Ollama prep for 1 profile model(s): stale-model:8b [workhorse]');
    expect(firstLog).to.include('pull stale-model:8b');

    fs.writeFileSync(logPath, '');
    const second = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME           ID\ntest-model:7b  live123',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME           ID           SIZE      MODIFIED\ntest-model:7b  live123       4 GB      1 hour ago\nstale-model:8b  stale999     6 GB      8 days ago',
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_LOG_PATH: logPath,
      CLAUDE_ROUTER_OLLAMA_PREP_STATE_FILE: statePath,
      CLAUDE_ROUTER_OLLAMA_PREP_MIN_RETRY_SECONDS: '86400',
    });
    sleepMs(250);
    const secondLog = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(second.status).to.equal(0, second.stderr);
    expect(secondLog).not.to.include('pull stale-model:8b');
  });

  it('background sweep skips fresh cached models', () => {
    const logPath = path.join(ctx.homeDir, 'ollama-fresh.log');
    fs.writeFileSync(ctx.configPath, JSON.stringify({
      backends: {
        ollama_local: {
          kind: 'ollama',
          url: 'http://localhost:11434',
        },
      },
      llm_active_profile: '64gb',
      llm_connectivity_mode: 'connected',
      llm_profiles: {
        '64gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          workhorse: { connected_model: 'fresh-model:8b', disconnect_model: 'fresh-model:8b' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
        '128gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          workhorse: { connected_model: 'fresh-model:8b', disconnect_model: 'fresh-model:8b' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
      },
      model_routes: {
        'test-model:7b': 'ollama_local',
        'fresh-model:8b': 'ollama_local',
      },
    }, null, 2));

    const r = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME           ID\ntest-model:7b  live123',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME           ID           SIZE      MODIFIED\ntest-model:7b  live123       4 GB      1 hour ago\nfresh-model:8b  fresh999     6 GB      2 days ago',
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_LOG_PATH: logPath,
    });
    sleepMs(250);
    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(r.status).to.equal(0, r.stderr);
    expect(log).not.to.include('pull fresh-model:8b');
  });

  it('background sweep allows metadata pull for cloud-designated models but still skips warming', () => {
    const logPath = path.join(ctx.homeDir, 'ollama-cloud.log');
    fs.writeFileSync(ctx.configPath, JSON.stringify({
      backends: {
        ollama_local: {
          kind: 'ollama',
          url: 'http://localhost:11434',
        },
        ollama_cloud: {
          kind: 'ollama',
          url: 'http://localhost:11434',
          prep_policy: 'skip',
        },
      },
      llm_active_profile: '64gb',
      llm_connectivity_mode: 'connected',
      llm_profiles: {
        '64gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          workhorse: { connected_model: 'qwen3-coder:480b-cloud', disconnect_model: 'qwen3-coder:480b-cloud' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
        '128gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          workhorse: { connected_model: 'qwen3-coder:480b-cloud', disconnect_model: 'qwen3-coder:480b-cloud' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
      },
      model_routes: {
        'test-model:7b': 'ollama_local',
        'qwen3-coder:480b-cloud': 'ollama_cloud',
      },
    }, null, 2));

    const r = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME           ID\ntest-model:7b  live123',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME           ID           SIZE      MODIFIED\ntest-model:7b  live123       4 GB      1 hour ago\nqwen3-coder:480b-cloud cloud480  1 MB      8 days ago',
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_LOG_PATH: logPath,
      CLAUDE_ROUTER_DEBUG: '1',
    });
    sleepMs(250);
    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stderr).to.include('background Ollama prep for 1 profile model(s): qwen3-coder:480b-cloud [workhorse]');
    expect(r.stderr).not.to.include("warming 'qwen3-coder:480b-cloud'");
    expect(r.stderr).to.include('warm_skipped=true reason=model_designated_cloud');
    expect(log).to.include('pull qwen3-coder:480b-cloud');
    expect(log).not.to.include('run qwen3-coder:480b-cloud');
  });

  it('background sweep ignores non-profile local models that appear elsewhere in config', () => {
    const logPath = path.join(ctx.homeDir, 'ollama-nonprofile.log');
    fs.writeFileSync(ctx.configPath, JSON.stringify({
      backends: {
        ollama_local: {
          kind: 'ollama',
          url: 'http://localhost:11434',
        },
      },
      llm_active_profile: '64gb',
      llm_connectivity_mode: 'connected',
      llm_profiles: {
        '64gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          workhorse: { connected_model: 'profile-model:8b', disconnect_model: 'profile-model:8b' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
        '128gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          workhorse: { connected_model: 'profile-model:8b', disconnect_model: 'profile-model:8b' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
      },
      model_routes: {
        'test-model:7b': 'ollama_local',
        'profile-model:8b': 'ollama_local',
        'oversized-model:99b': 'ollama_local',
      },
      routes: {
        background: 'oversized-model:99b',
      },
      llm_capabilities: {
        heavy_coder: {
          model: 'oversized-model:99b',
        },
      },
    }, null, 2));

    const r = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME           ID\ntest-model:7b  live123',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME           ID           SIZE      MODIFIED\ntest-model:7b  live123       4 GB      1 hour ago\nprofile-model:8b profile8    6 GB      8 days ago\noversized-model:99b huge99   60 GB     8 days ago',
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_LOG_PATH: logPath,
      CLAUDE_ROUTER_OLLAMA_PREP_MIN_RETRY_SECONDS: '86400',
    });
    sleepMs(250);
    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stderr).to.include('background Ollama prep for 1 profile model(s): profile-model:8b [workhorse]');
    expect(log).to.include('pull profile-model:8b');
    expect(log).not.to.include('pull oversized-model:99b');
    expect(log).not.to.include('run oversized-model:99b');
  });

  it('background sweep handles provider-backed local profile models with the same field shape as model-routed entries', () => {
    const logPath = path.join(ctx.homeDir, 'ollama-provider-profile.log');
    fs.writeFileSync(ctx.configPath, JSON.stringify({
      providers: {
        'provider-model:8b': {
          base_url: 'http://localhost:11434',
          auth_token: 'ollama',
          api_key: '',
          config_dir: '/tmp/ollama-provider-profile',
          disable_nonessential_traffic: true,
        },
      },
      llm_active_profile: '64gb',
      llm_connectivity_mode: 'connected',
      llm_profiles: {
        '64gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'provider-model:8b', disconnect_model: 'provider-model:8b' },
          workhorse: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
        '128gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'provider-model:8b', disconnect_model: 'provider-model:8b' },
          workhorse: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
      },
    }, null, 2));

    const r = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME           ID\ntest-model:7b  live123',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME                ID           SIZE      MODIFIED\ntest-model:7b       live123      4 GB      1 hour ago\nprovider-model:8b   provider8    6 GB      8 days ago',
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_LOG_PATH: logPath,
      CLAUDE_ROUTER_OLLAMA_PREP_MIN_RETRY_SECONDS: '86400',
    });
    sleepMs(250);
    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stderr).to.include('background Ollama prep for 1 profile model(s): provider-model:8b [reviewer]');
    expect(log).to.include('pull provider-model:8b');
  });
});

describe('ollama cloud authentication gating', function () {
  this.timeout(10000);
  let ctx;

  function buildCloudAuthConfig() {
    return {
      backends: {
        ollama_local: {
          kind: 'ollama',
          url: 'http://localhost:11434',
        },
        ollama_cloud: {
          kind: 'ollama',
          url: 'http://localhost:11434',
          prep_policy: 'skip',
        },
      },
      llm_active_profile: '64gb',
      llm_connectivity_mode: 'connected',
      llm_profiles: {
        '64gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          workhorse: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
        '128gb': {
          default: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          classifier: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          explorer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          reviewer: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          workhorse: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
          coder: { connected_model: 'test-model:7b', disconnect_model: 'test-model:7b' },
        },
      },
      model_routes: {
        'test-model:7b': 'ollama_local',
        'cloud-model:cloud': 'ollama_cloud',
        'cloud-second:cloud': 'ollama_cloud',
      },
    };
  }

  beforeEach(() => {
    ctx = makeTestHome();
  });

  afterEach(() => {
    fs.rmSync(ctx.homeDir, { recursive: true, force: true });
  });

  it('cloud Ollama model with explicit auth env skips signin', () => {
    const config = buildCloudAuthConfig();
    config.backends.ollama_cloud.auth_env = 'TEST_OLLAMA_AUTH';
    fs.writeFileSync(ctx.configPath, JSON.stringify(config, null, 2));
    const logPath = path.join(ctx.homeDir, 'ollama-cloud-auth-explicit.log');

    const r = runRouter(['--model', 'cloud-model:cloud', '-p', 'hi'], ctx, {
      TEST_OLLAMA_AUTH: 'token123',
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME   ID',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME                ID\ncloud-model:cloud   cloud123',
      OLLAMA_STUB_LOG_PATH: logPath,
    });

    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(r.status).to.equal(0, r.stderr);
    expect(log).not.to.include('signin');
    expect(log).not.to.include('pull cloud-model:cloud');
  });

  it('cloud Ollama model with successful pull probe skips signin', () => {
    const config = buildCloudAuthConfig();
    fs.writeFileSync(ctx.configPath, JSON.stringify(config, null, 2));
    const logPath = path.join(ctx.homeDir, 'ollama-cloud-auth-ok.log');

    const r = runRouter(['--model', 'cloud-model:cloud', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME   ID',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME                ID\ncloud-model:cloud   cloud123',
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_LOG_PATH: logPath,
    });

    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(r.status).to.equal(0, r.stderr);
    expect(log).to.include('pull cloud-model:cloud');
    expect(log).not.to.include('signin');
  });

  it('cloud Ollama model with auth-failure probe prompts and runs signin', async () => {
    const config = buildCloudAuthConfig();
    fs.writeFileSync(ctx.configPath, JSON.stringify(config, null, 2));
    const logPath = path.join(ctx.homeDir, 'ollama-cloud-auth-signin.log');
    const markerPath = path.join(ctx.homeDir, 'signed-in.marker');

    const r = await runRouterAsync(['--model', 'cloud-model:cloud', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME   ID',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME                ID\ncloud-model:cloud   cloud123',
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_PULL_REQUIRE_SIGNIN: '1',
      OLLAMA_STUB_SIGNIN_MARKER: markerPath,
      OLLAMA_STUB_SIGNIN_EXIT: '0',
      OLLAMA_STUB_LOG_PATH: logPath,
      CLAUDE_ROUTER_FORCE_INTERACTIVE: '1',
      CLAUDE_ROUTER_AUTO_CONFIRM_OLLAMA_SIGNIN: '1',
    });

    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stderr).to.include('requires ollama.com sign-in');
    expect(log.match(/^signin$/gm) || []).to.have.length(1);
    expect(log.match(/^pull cloud-model:cloud$/gm) || []).to.have.length(2);
  });

  it('signin failure exits non-zero', async () => {
    const config = buildCloudAuthConfig();
    fs.writeFileSync(ctx.configPath, JSON.stringify(config, null, 2));
    const logPath = path.join(ctx.homeDir, 'ollama-cloud-auth-signin-fail.log');
    const markerPath = path.join(ctx.homeDir, 'signed-in.marker');

    const r = await runRouterAsync(['--model', 'cloud-model:cloud', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_PULL_REQUIRE_SIGNIN: '1',
      OLLAMA_STUB_SIGNIN_MARKER: markerPath,
      OLLAMA_STUB_SIGNIN_EXIT: '1',
      OLLAMA_STUB_LOG_PATH: logPath,
      CLAUDE_ROUTER_FORCE_INTERACTIVE: '1',
      CLAUDE_ROUTER_AUTO_CONFIRM_OLLAMA_SIGNIN: '1',
    });

    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(r.status).to.equal(1);
    expect(r.stderr).to.include("'ollama signin' failed");
    expect(log).to.include('signin');
  });

  it('non-interactive auth-required launch exits non-zero with guidance', () => {
    const config = buildCloudAuthConfig();
    fs.writeFileSync(ctx.configPath, JSON.stringify(config, null, 2));

    const r = runRouter(['--model', 'cloud-model:cloud', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_PULL_REQUIRE_SIGNIN: '1',
      OLLAMA_STUB_SIGNIN_MARKER: path.join(ctx.homeDir, 'signed-in.marker'),
    });

    expect(r.status).to.equal(1);
    expect(r.stderr).to.include('authentication is not validated');
    expect(r.stderr).to.include("Run 'ollama signin' and retry");
  });

  it('non-cloud Ollama models do not trigger signin flow', () => {
    const config = buildCloudAuthConfig();
    fs.writeFileSync(ctx.configPath, JSON.stringify(config, null, 2));
    const logPath = path.join(ctx.homeDir, 'ollama-noncloud.log');

    const r = runRouter(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME           ID\ntest-model:7b  live123',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME           ID\ntest-model:7b  live123',
      OLLAMA_STUB_LOG_PATH: logPath,
    });

    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(r.status).to.equal(0, r.stderr);
    expect(log).not.to.include('signin');
    expect(r.stderr).not.to.include('requires ollama.com sign-in');
  });

  it('prompts only once when multiple cloud candidates are present', async () => {
    const config = buildCloudAuthConfig();
    config.llm_profiles['64gb'].workhorse = { connected_model: 'cloud-model:cloud', disconnect_model: 'cloud-model:cloud' };
    config.llm_profiles['64gb'].coder = { connected_model: 'cloud-second:cloud', disconnect_model: 'cloud-second:cloud' };
    fs.writeFileSync(ctx.configPath, JSON.stringify(config, null, 2));
    const logPath = path.join(ctx.homeDir, 'ollama-cloud-auth-multi.log');
    const markerPath = path.join(ctx.homeDir, 'signed-in.marker');

    const r = await runRouterAsync(['--model', 'test-model:7b', '-p', 'hi'], ctx, {
      OLLAMA_STUB_PS_EXIT: '0',
      OLLAMA_STUB_PS_OUTPUT: 'NAME           ID\ntest-model:7b  live123',
      OLLAMA_STUB_LIST_EXIT: '0',
      OLLAMA_STUB_LIST_OUTPUT: 'NAME                ID\ntest-model:7b       live123\ncloud-model:cloud   cloud123\ncloud-second:cloud  cloud456',
      OLLAMA_STUB_PULL_EXIT: '0',
      OLLAMA_STUB_PULL_REQUIRE_SIGNIN: '1',
      OLLAMA_STUB_SIGNIN_MARKER: markerPath,
      OLLAMA_STUB_SIGNIN_EXIT: '0',
      OLLAMA_STUB_LOG_PATH: logPath,
      CLAUDE_ROUTER_FORCE_INTERACTIVE: '1',
      CLAUDE_ROUTER_AUTO_CONFIRM_OLLAMA_SIGNIN: '1',
    });

    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
    expect(r.status).to.equal(0, r.stderr);
    expect(log.match(/^signin$/gm) || []).to.have.length(1);
  });
});

describe('claude-router MCP end-to-end', function () {
  this.timeout(15000);

  let homeDir;
  let binDir;
  let repoDir;
  let proxy;

  beforeEach(async () => {
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-mcp-e2e-home-'));
    binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    installMcpAwareClaudeStub(binDir);

    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(path.join(claudeDir, 'tools'), { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'model-map.json'), JSON.stringify({
      backends: {
        anthropic_local: { kind: 'anthropic', url: 'http://127.0.0.1:1' },
      },
      model_routes: {
        'glm-5.1:cloud': 'anthropic_local',
        'qwen3:1.7b': 'anthropic_local',
        'gemma4:e2b': 'anthropic_local',
        'deepseek-r1:14b': 'anthropic_local',
        'gemma4:26b': 'anthropic_local',
        'qwen3-coder:30b': 'anthropic_local',
      },
      routes: {
        default: 'general-default',
      },
      llm_active_profile: '64gb',
      llm_connectivity_mode: 'connected',
      llm_profiles: {
        '64gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'gemma4:26b' },
          classifier: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
          explorer: { connected_model: 'gemma4:e2b', disconnect_model: 'gemma4:e2b' },
          reviewer: { connected_model: 'deepseek-r1:14b', disconnect_model: 'deepseek-r1:14b' },
          workhorse: { connected_model: 'gemma4:26b', disconnect_model: 'gemma4:26b' },
          coder: { connected_model: 'qwen3-coder:30b', disconnect_model: 'qwen3-coder:30b' },
        },
        '128gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'gemma4:26b' },
          classifier: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
          explorer: { connected_model: 'gemma4:e2b', disconnect_model: 'gemma4:e2b' },
          reviewer: { connected_model: 'deepseek-r1:14b', disconnect_model: 'deepseek-r1:14b' },
          workhorse: { connected_model: 'gemma4:26b', disconnect_model: 'gemma4:26b' },
          coder: { connected_model: 'qwen3-coder:30b', disconnect_model: 'qwen3-coder:30b' },
        },
      },
      llm_capabilities: {
        default: { model: 'general-default' },
        classify_intent: { model: 'classifier' },
        explore_local: { model: 'explorer' },
        explore_web: { model: 'explorer' },
        review_quality: { model: 'reviewer' },
        critique_plan: { model: 'reviewer' },
        detect_bugs: { model: 'workhorse' },
        navigate_codebase: { model: 'workhorse' },
        generate_tests: { model: 'coder' },
        deep_review: { model: 'workhorse' },
        heavy_coder: { model: 'coder' },
      },
    }, null, 2));
    fs.symlinkSync(MCP_SERVER, path.join(claudeDir, 'tools', 'llm-capabilities-mcp'));

    repoDir = path.join(homeDir, 'workspace');
    const nestedDir = path.join(repoDir, 'tools');
    fs.mkdirSync(nestedDir, { recursive: true });

    proxy = await startProxyStub((req, res, body) => {
      const toolName = /logical MCP tool "([^"]+)"/.exec(body.system || '')?.[1] || 'unknown';
      let response;
      if (toolName === 'classify_intent') {
        response = {
          result: 'Intent: coding_review',
          confidence: 93,
          recuse_reason: null,
          dynamic_hints: ['Use deep_review for a comprehensive follow-up.'],
          recommended_tool: 'deep_review',
          clarification_questions: [],
        };
      } else {
        response = {
          result: `handled by ${toolName}`,
          confidence: 80,
          recuse_reason: null,
          dynamic_hints: [],
        };
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_e2e',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [{ type: 'text', text: JSON.stringify(response) }],
      }));
    });

    fs.writeFileSync(path.join(homeDir, '.claude.json'), JSON.stringify({
      projects: {
        [fs.realpathSync(repoDir)]: {
          mcpServers: {
            'llm-capabilities': {
              type: 'stdio',
              command: fs.realpathSync(path.join(claudeDir, 'tools', 'llm-capabilities-mcp')),
              args: [],
              env: {
                CLAUDE_PROJECT_DIR: fs.realpathSync(repoDir),
                CLAUDE_MODEL_MAP_LAUNCH_CWD: fs.realpathSync(repoDir),
                CLAUDE_LLM_PROXY_BASE_URL: `http://127.0.0.1:${proxy.port}`,
                CLAUDE_LLM_CAPABILITIES_DEBUG: '1',
              },
            },
          },
        },
      },
    }, null, 2));
  });

  afterEach(() => {
    proxy?.server?.close();
    if (homeDir) fs.rmSync(homeDir, { recursive: true, force: true });
  });

  it('lists llm-capabilities tools through claude-router from a nested repo directory', async () => {
    const nestedDir = path.join(repoDir, 'tools');
    const result = await runRouterAsync(['-p', 'show me your tools exposed'], { homeDir, binDir, cwd: nestedDir });
    expect(result.status).to.equal(0, result.stderr);
    expect(result.stdout).to.include('TOOLS:');
    expect(result.stdout).to.include('classify_intent');
    expect(result.stdout).to.include('deep_review');
    expect(result.stdout).to.include('heavy_coder');
  });

  it('routes a prompt through claude-router and validates an llm-capabilities tool call', async () => {
    const nestedDir = path.join(repoDir, 'tools');
    const result = await runRouterAsync(['-p', 'Classify this prompt and recommend the best next tool.'], { homeDir, binDir, cwd: nestedDir });
    expect(result.status).to.equal(0, result.stderr);
    expect(result.stdout).to.include('CALL:');
    expect(result.stdout).to.include('"recommended_tool":"deep_review"');
    expect(result.stderr).to.include('"event":"mcp.tool.call.before"');
    expect(proxy.requests).to.have.length(1);
    expect(proxy.requests[0].body.model).to.equal('classifier');
    expect(proxy.requests[0].body.system).to.include('logical MCP tool "classify_intent"');
  });
});

describe('default model-map config', () => {
  it('shipped named routes resolve to configured terminal models', () => {
    const configPath = path.join(__dirname, '..', 'config', 'model-map.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const resolveAlias = model => {
      const activeProfile = config.llm_active_profile === 'auto' ? '64gb' : config.llm_active_profile;
      const profile = config.llm_profiles?.[activeProfile];
      const aliasKey = model === 'general-default' ? 'default' : model;
      const entry = profile?.[aliasKey];
      return entry?.connected_model || model;
    };

    const resolveRoute = start => {
      const seen = new Set();
      let current = start;
      while (config.routes && Object.prototype.hasOwnProperty.call(config.routes, current)) {
        if (seen.has(current)) throw new Error(`route cycle at ${current}`);
        seen.add(current);
        current = config.routes[current];
      }
      return resolveAlias(current);
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

  it('ships glm-5.1 as the connected general default', () => {
    const configPath = path.join(__dirname, '..', 'config', 'model-map.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(Object.keys(config.llm_profiles).sort()).to.deep.equal(['128gb', '16gb', '32gb', '48gb', '64gb']);
    expect(config.routes.default).to.equal('general-default');
    expect(config.llm_profiles['16gb'].default.connected_model).to.equal('glm-5.1:cloud');
    expect(config.llm_profiles['32gb'].default.connected_model).to.equal('glm-5.1:cloud');
    expect(config.llm_profiles['48gb'].default.connected_model).to.equal('glm-5.1:cloud');
    expect(config.llm_profiles['64gb'].default.connected_model).to.equal('glm-5.1:cloud');
    expect(config.llm_profiles['128gb'].default.connected_model).to.equal('glm-5.1:cloud');
  });

  it('ships the expected form-factor profile recommendations', () => {
    const configPath = path.join(__dirname, '..', 'config', 'model-map.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(config.llm_profiles['16gb'].classifier.connected_model).to.equal('qwen3:1.7b');
    expect(config.llm_profiles['16gb'].explorer.disconnect_model).to.equal('qwen3:1.7b');

    expect(config.llm_profiles['32gb'].explorer.connected_model).to.equal('gemma4:e2b');
    expect(config.llm_profiles['32gb'].reviewer.connected_model).to.equal('deepseek-r1:14b');
    expect(config.llm_profiles['32gb'].workhorse.connected_model).to.equal('gemma4:e2b');

    expect(config.llm_profiles['48gb'].reviewer.connected_model).to.equal('gemma4:e4b');
    expect(config.llm_profiles['48gb'].workhorse.connected_model).to.equal('gemma4:26b');
    expect(config.llm_profiles['48gb'].coder.connected_model).to.equal('gemma4:e4b');

    expect(config.llm_profiles['64gb'].classifier.connected_model).to.equal('qwen3:1.7b');
    expect(config.llm_profiles['64gb'].explorer.connected_model).to.equal('gemma4:e2b');
    expect(config.llm_profiles['64gb'].reviewer.connected_model).to.equal('gemma4:26b');
    expect(config.llm_profiles['64gb'].coder.connected_model).to.equal('qwen3-coder:30b');

    expect(config.llm_profiles['128gb'].classifier.connected_model).to.equal('qwen3.6:35b-a3b-q4_K_M');
    expect(config.llm_profiles['128gb'].workhorse.connected_model).to.equal('gemma4:31b');
    expect(config.llm_profiles['128gb'].coder.connected_model).to.equal('qwen3.6:35b-a3b-q4_K_M');

    expect(config.routes['claude-sonnet-4-6']).to.equal('qwen3.6:35b-a3b-q4_K_M');
    expect(config.model_routes['qwen3.6:35b-a3b-q4_K_M']).to.equal('ollama_local');
    expect(config.model_routes['gemma4:e4b']).to.equal('ollama_local');
    expect(config.model_routes['gemma4:31b']).to.equal('ollama_local');
  });

  it('marks ollama_cloud as skip-prep in the shipped config', () => {
    const configPath = path.join(__dirname, '..', 'config', 'model-map.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.backends.ollama_cloud.prep_policy).to.equal('skip');
  });
});

describe('llm profile alias resolution', () => {
  function buildProfileAliasConfig(activeProfile = 'auto') {
    return {
      backends: {
        anthropic: {
          kind: 'anthropic',
          url: 'https://api.anthropic.com',
          auth_env: 'ANTHROPIC_API_KEY',
        },
      },
      model_routes: {
        'glm-5.1:cloud': 'anthropic',
        'model-16': 'anthropic',
        'model-32': 'anthropic',
        'model-48': 'anthropic',
        'model-64': 'anthropic',
        'model-128': 'anthropic',
      },
      routes: {
        default: 'workhorse',
      },
      llm_active_profile: activeProfile,
      llm_connectivity_mode: 'connected',
      llm_profiles: {
        '16gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'model-16' },
          classifier: { connected_model: 'model-16', disconnect_model: 'model-16' },
          explorer: { connected_model: 'model-16', disconnect_model: 'model-16' },
          reviewer: { connected_model: 'model-16', disconnect_model: 'model-16' },
          workhorse: { connected_model: 'model-16', disconnect_model: 'model-16' },
          coder: { connected_model: 'model-16', disconnect_model: 'model-16' },
        },
        '32gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'model-32' },
          classifier: { connected_model: 'model-32', disconnect_model: 'model-32' },
          explorer: { connected_model: 'model-32', disconnect_model: 'model-32' },
          reviewer: { connected_model: 'model-32', disconnect_model: 'model-32' },
          workhorse: { connected_model: 'model-32', disconnect_model: 'model-32' },
          coder: { connected_model: 'model-32', disconnect_model: 'model-32' },
        },
        '48gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'model-48' },
          classifier: { connected_model: 'model-48', disconnect_model: 'model-48' },
          explorer: { connected_model: 'model-48', disconnect_model: 'model-48' },
          reviewer: { connected_model: 'model-48', disconnect_model: 'model-48' },
          workhorse: { connected_model: 'model-48', disconnect_model: 'model-48' },
          coder: { connected_model: 'model-48', disconnect_model: 'model-48' },
        },
        '64gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'model-64' },
          classifier: { connected_model: 'model-64', disconnect_model: 'model-64' },
          explorer: { connected_model: 'model-64', disconnect_model: 'model-64' },
          reviewer: { connected_model: 'model-64', disconnect_model: 'model-64' },
          workhorse: { connected_model: 'model-64', disconnect_model: 'model-64' },
          coder: { connected_model: 'model-64', disconnect_model: 'model-64' },
        },
        '128gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'model-128' },
          classifier: { connected_model: 'model-128', disconnect_model: 'model-128' },
          explorer: { connected_model: 'model-128', disconnect_model: 'model-128' },
          reviewer: { connected_model: 'model-128', disconnect_model: 'model-128' },
          workhorse: { connected_model: 'model-128', disconnect_model: 'model-128' },
          coder: { connected_model: 'model-128', disconnect_model: 'model-128' },
        },
      },
    };
  }

  function writeProfileAliasConfig(g, config) {
    const configPath = path.join(g.homeDir, '.claude', 'model-map.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  [
    ['16', 'model-16'],
    ['32', 'model-32'],
    ['48', 'model-48'],
    ['64', 'model-64'],
    ['128', 'model-128'],
  ].forEach(([memoryGb, expectedModel]) => {
    it(`auto-detect maps ${memoryGb}gb memory to the ${expectedModel} profile model`, () => {
      const g = makeTestHome({
        default: 'general-default',
      });
      writeProfileAliasConfig(g, buildProfileAliasConfig('auto'));
      const r = runRouter(['-p', 'hello'], g, { CLAUDE_LLM_MEMORY_GB: memoryGb });
      fs.rmSync(g.homeDir, { recursive: true, force: true });
      expect(r.status).to.equal(0, r.stderr);
      expect(r.stdout).to.include(`--model=${expectedModel}`);
    });
  });

  it('logs the discovered form factor, capability plan, and launch resolution', () => {
    const g = makeTestHome({
      default: 'general-default',
    });
    writeProfileAliasConfig(g, buildProfileAliasConfig('auto'));
    const r = runRouter(['-p', 'hello'], g, { CLAUDE_LLM_MEMORY_GB: '64' });
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stderr).to.include("form factor profile '64gb' (auto-detected from 64 GB RAM, connectivity=connected)");
    expect(r.stderr).to.include('capability plan default=glm-5.1:cloud, classifier=model-64, explorer=model-64, reviewer=model-64, workhorse=model-64, coder=model-64');
    expect(r.stderr).to.include("launch request 'default' resolved to 'model-64'");
  });

  it('forced CLAUDE_LLM_PROFILE overrides detection', () => {
    const g = makeTestHome({
      default: 'general-default',
    });
    writeProfileAliasConfig(g, buildProfileAliasConfig('auto'));
    const r = runRouter(['-p', 'hello'], g, {
      CLAUDE_LLM_MEMORY_GB: '16',
      CLAUDE_LLM_PROFILE: '128gb',
    });
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('--model=model-128');
    expect(r.stderr).to.include("form factor profile '128gb' (forced by CLAUDE_LLM_PROFILE, connectivity=connected)");
  });

  it('explicit llm_active_profile overrides detection', () => {
    const g = makeTestHome({
      default: 'general-default',
    });
    writeProfileAliasConfig(g, buildProfileAliasConfig('48gb'));
    const r = runRouter(['-p', 'hello'], g, { CLAUDE_LLM_MEMORY_GB: '128' });
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('--model=model-48');
  });

  it('missing memory detection in auto mode exits non-zero', () => {
    const g = makeTestHome({
      default: 'general-default',
    });
    writeProfileAliasConfig(g, buildProfileAliasConfig('auto'));
    const r = runRouter(['-p', 'hello'], g, {
      PATH: `${g.binDir}:/usr/bin:/bin`,
    });
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.not.equal(0);
    expect(r.stderr).to.include('unable to determine machine memory');
  });

  it('unknown chosen profile exits non-zero', () => {
    const g = makeTestHome({
      default: 'general-default',
    });
    writeProfileAliasConfig(g, buildProfileAliasConfig('auto'));
    const r = runRouter(['-p', 'hello'], g, {
      CLAUDE_LLM_PROFILE: '256gb',
      CLAUDE_LLM_MEMORY_GB: '64',
    });
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.not.equal(0);
    expect(r.stderr).to.include("resolved llm profile '256gb' is not defined");
  });

  it('uses disconnect-mode defaults from config when no env override is set', () => {
    const g = makeTestHome({
      default: 'general-default',
    });
    const configPath = path.join(g.homeDir, '.claude', 'model-map.json');
    fs.writeFileSync(configPath, JSON.stringify({
      backends: {
        anthropic: {
          kind: 'anthropic',
          url: 'https://api.anthropic.com',
          auth_env: 'ANTHROPIC_API_KEY',
        },
      },
      model_routes: {
        'glm-5.1:cloud': 'anthropic',
        'qwen3-coder:30b': 'anthropic',
      },
      routes: {
        default: 'general-default',
      },
      llm_active_profile: '64gb',
      llm_connectivity_mode: 'disconnect',
      llm_profiles: {
        '64gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'qwen3-coder:30b' },
          classifier: { connected_model: 'qwen3-coder:30b', disconnect_model: 'qwen3-coder:30b' },
          explorer: { connected_model: 'qwen3-coder:30b', disconnect_model: 'qwen3-coder:30b' },
          reviewer: { connected_model: 'qwen3-coder:30b', disconnect_model: 'qwen3-coder:30b' },
          workhorse: { connected_model: 'glm-5.1:cloud', disconnect_model: 'qwen3-coder:30b' },
          coder: { connected_model: 'qwen3-coder:30b', disconnect_model: 'qwen3-coder:30b' },
        },
        '128gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'qwen3-coder:30b' },
          classifier: { connected_model: 'qwen3-coder:30b', disconnect_model: 'qwen3-coder:30b' },
          explorer: { connected_model: 'qwen3-coder:30b', disconnect_model: 'qwen3-coder:30b' },
          reviewer: { connected_model: 'qwen3-coder:30b', disconnect_model: 'qwen3-coder:30b' },
          workhorse: { connected_model: 'glm-5.1:cloud', disconnect_model: 'qwen3-coder:30b' },
          coder: { connected_model: 'qwen3-coder:30b', disconnect_model: 'qwen3-coder:30b' },
        },
      },
    }, null, 2));
    const r = runRouter(['-p', 'hello'], g);
    fs.rmSync(g.homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('--model=qwen3-coder:30b');
  });
});

describe('layered model-map defaults + overrides', () => {
  it('builds an effective profile model-map from repo defaults and user overrides before launch', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-layered-home-'));
    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'model-map.overrides.json'), JSON.stringify({
      routes: {
        default: 'classifier',
      },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    const stub = path.join(binDir, 'claude');
    fs.writeFileSync(stub, '#!/bin/bash\nfor a in "$@"; do echo "$a"; done\n');
    fs.chmodSync(stub, 0o755);

    const r = runRouter(['-p', 'hello'], { homeDir, binDir }, {
      CLAUDE_LLM_MEMORY_GB: '64',
    });

    const effectivePath = path.join(claudeDir, 'model-map.json');
    const effective = JSON.parse(fs.readFileSync(effectivePath, 'utf8'));
    fs.rmSync(homeDir, { recursive: true, force: true });

    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('--model=qwen3:1.7b');
    expect(effective.routes.default).to.equal('classifier');
    expect(effective.llm_profiles['64gb'].workhorse.connected_model).to.equal('gemma4:26b');
  });

  it('continues launching when the non-fatal defaults git pull fails', () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-layered-git-home-'));
    const claudeDir = path.join(homeDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'model-map.overrides.json'), JSON.stringify({
      routes: {
        default: 'classifier',
      },
    }, null, 2));

    const binDir = path.join(homeDir, 'bin');
    fs.mkdirSync(binDir);
    fs.writeFileSync(path.join(binDir, 'claude'), '#!/bin/bash\nfor a in \"$@\"; do echo \"$a\"; done\n');
    fs.chmodSync(path.join(binDir, 'claude'), 0o755);
    fs.writeFileSync(path.join(binDir, 'git'), '#!/bin/bash\nexit 1\n');
    fs.chmodSync(path.join(binDir, 'git'), 0o755);

    const r = runRouter(['-p', 'hello'], { homeDir, binDir }, {
      CLAUDE_LLM_MEMORY_GB: '64',
      CLAUDE_MODEL_MAP_SKIP_GIT_PULL: '0',
    });

    fs.rmSync(homeDir, { recursive: true, force: true });
    expect(r.status).to.equal(0, r.stderr);
    expect(r.stdout).to.include('--model=qwen3:1.7b');
  });
});
