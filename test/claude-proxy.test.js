'use strict';

const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROXY_SCRIPT = path.join(__dirname, '..', 'tools', 'claude-proxy');
// Use a non-default port to avoid clashing with a running real proxy
const PROXY_PORT = 19997;

// ── Helpers ───────────────────────────────────────────────────────────

function writeOllamaAnthropicResponse(res, requestBody, parts = ['Hello'], outputTokens = 2) {
  const model = (requestBody && requestBody.model) || 'qwen3-coder:30b';
  if (requestBody && requestBody.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    let body = '';
    body += `event: message_start\ndata: ${JSON.stringify({
      type: 'message_start',
      message: {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model,
        content: [],
        usage: { input_tokens: 5, output_tokens: 0 },
      },
    })}\n\n`;
    body += `event: content_block_start\ndata: ${JSON.stringify({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    })}\n\n`;
    for (const part of parts) {
      body += `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: part },
      })}\n\n`;
    }
    body += `event: content_block_stop\ndata: ${JSON.stringify({
      type: 'content_block_stop',
      index: 0,
    })}\n\n`;
    body += `event: message_delta\ndata: ${JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: outputTokens },
    })}\n\n`;
    body += 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
    res.end(body);
    return;
  }

  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(
    JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text: parts.join('') }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: outputTokens },
    }),
  );
}

// Default Ollama Anthropic-compat handler (used by beforeEach restores)
function makeDefaultOllamaHandler() {
  return (req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      if (req.method === 'POST' && req.url === '/api/show') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            details: { parent_model: '', family: 'mock', parameter_size: '0B' },
            digest: 'sha256:mockdigest0000000000000000000000000000000000000000000000000000',
          }),
        );
        return;
      }
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      writeOllamaAnthropicResponse(res, body, ['Hello', ' world'], 2);
    });
  };
}

function listenOnRandomPort(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
    server.on('error', reject);
  });
}

function ping(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/ping`, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(300, () => { req.destroy(); resolve(null); });
  });
}

async function waitForProxy(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await ping(port);
    if (result && result.ok) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

function getProxyModels(port, query = '') {
  return new Promise((resolve, reject) => {
    const path = query ? `/v1/models?${query}` : '/v1/models';
    http
      .get(
        {
          hostname: '127.0.0.1',
          port,
          path,
          headers: {
            'anthropic-version': '2023-06-01',
            'x-api-key': 'test-placeholder-key',
          },
        },
        res => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => {
            resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() });
          });
        },
      )
      .on('error', reject);
  });
}

function getJsonPath(port, pathName) {
  return new Promise((resolve, reject) => {
    http
      .get(
        {
          hostname: '127.0.0.1',
          port,
          path: pathName,
        },
        res => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => {
            resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() });
          });
        },
      )
      .on('error', reject);
  });
}

function postProxy(port, body, extraHeaders = {}) {
  return postProxyPath(port, '/v1/messages', body, extraHeaders);
}

function postProxyPath(port, pathName, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: '127.0.0.1',
      port,
      path: pathName,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(bodyStr),
        'x-api-key': 'test-placeholder-key',
        'anthropic-version': '2023-06-01',
        ...extraHeaders,
      },
    };
    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, headers: res.headers, body: raw });
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────

function makeTempHome(config) {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-test-'));
  fs.mkdirSync(path.join(homeDir, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, '.claude', 'model-map.json'),
    JSON.stringify(config, null, 2),
  );
  return homeDir;
}

function spawnProxyInstance(homePath, port, extraEnv = {}, cwd = homePath) {
  return spawn(process.execPath, [PROXY_SCRIPT], {
    cwd,
    env: {
      ...process.env,
      HOME: homePath,
      CLAUDE_PROXY_PORT: String(port),
      TEST_ANTHROPIC_KEY: 'real-test-key-from-env',
      CLAUDE_MODEL_MAP_PATH: '',
      CLAUDE_MODEL_MAP_SOURCE: '',
      CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
      CLAUDE_PROJECT_DIR: '',
      OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPort}`,
      CLAUDE_PROXY_SKIP_OLLAMA_WARMUP: '1',
      CLAUDE_ROUTER_DEBUG: '',
      CLAUDE_PROXY_DEBUG: '',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// ── Proxy lifecycle ───────────────────────────────────────────────────

let proxyProc = null;
let homeDir = null;
let anthropicMock = null;
let ollamaMock = null;
let anthropicPort = null;
let ollamaPort = null;

before(async function () {
  this.timeout(10000);

  // ── Mock Anthropic server ────────────────────────────────────────
  anthropicMock = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          data: [
            {
              id: 'claude-sonnet-4-6',
              type: 'model',
              display_name: 'Claude Sonnet 4.6',
              capabilities: { thinking: { supported: true, types: {} } },
            },
          ],
          has_more: false,
        }),
      );
      return;
    }
    if (req.method === 'GET' && req.url === '/v1/me') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ passthrough_ok: true, key: req.headers['x-api-key'] || '' }));
      return;
    }
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const receivedBody = Buffer.concat(chunks).toString();
      const receivedKey = req.headers['x-api-key'];
      // SSE response so the proxy can stream it through
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'x-received-key': receivedKey || '',
        'x-received-body': receivedBody,
      });
      res.end(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-6","usage":{"input_tokens":5,"output_tokens":0}}}\n\n' +
        'event: message_stop\ndata: {"type":"message_stop"}\n\n'
      );
    });
  });
  anthropicPort = await listenOnRandomPort(anthropicMock);

  // ── Mock Ollama server ───────────────────────────────────────────
  ollamaMock = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      if (req.method === 'POST' && req.url === '/api/show') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            details: { parent_model: '', family: 'mock', parameter_size: '0B' },
            digest: 'sha256:mockdigest0000000000000000000000000000000000000000000000000000',
          }),
        );
        return;
      }
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      writeOllamaAnthropicResponse(res, body, ['Hello', ' world'], 2);
    });
  });
  ollamaPort = await listenOnRandomPort(ollamaMock);

  // ── Config pointing to mock servers ─────────────────────────────
  homeDir = makeTempHome({
    backends: {
      anthropic: {
        kind: 'anthropic',
        url: `http://127.0.0.1:${anthropicPort}`,
        auth_env: 'TEST_ANTHROPIC_KEY',
      },
      ollama_local: {
        kind: 'ollama',
        url: `http://127.0.0.1:${ollamaPort}`,
      },
    },
    model_routes: {
      'claude-sonnet-4-6': 'anthropic',
      'claude-opus-4-6': 'anthropic',
      'qwen3-coder:30b': 'ollama_local',
    },
    routes: {
      default: 'claude-sonnet-4-6',
      background: 'qwen3-coder:30b',
      'alias-to-ollama': 'qwen3-coder:30b',
    },
  });

  // ── Spawn proxy ──────────────────────────────────────────────────
  proxyProc = spawnProxyInstance(homeDir, PROXY_PORT);
  proxyProc.stderr.on('data', () => {}); // suppress startup log in test output

  const ready = await waitForProxy(PROXY_PORT);
  if (!ready) throw new Error('claude-proxy did not start within 5s');
});

after(async function () {
  if (proxyProc) {
    proxyProc.kill('SIGTERM');
    proxyProc = null;
  }
  if (anthropicMock) { anthropicMock.close(); anthropicMock = null; }
  if (ollamaMock)    { ollamaMock.close(); ollamaMock = null; }
  if (homeDir) {
    fs.rmSync(homeDir, { recursive: true, force: true });
    homeDir = null;
  }
});

// ── Tests ─────────────────────────────────────────────────────────────

describe('claude-proxy /ping', () => {
  it('returns {ok:true, pid} quickly', async function () {
    this.timeout(1000);
    const result = await ping(PROXY_PORT);
    expect(result).to.be.an('object');
    expect(result.ok).to.equal(true);
    expect(result.pid).to.be.a('number').and.greaterThan(0);
    expect(result.config_path).to.equal(fs.realpathSync(path.join(homeDir, '.claude', 'model-map.json')));
  });
});

describe('claude-proxy standalone config resolution', () => {
  it('uses the git project root model-map when launched from a nested repo directory', async function () {
    this.timeout(5000);
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-project-root-'));
    const profileClaudeDir = path.join(tempHome, '.claude');
    fs.mkdirSync(profileClaudeDir, { recursive: true });
    fs.writeFileSync(path.join(profileClaudeDir, 'model-map.json'), JSON.stringify({
      routes: { default: 'profile-model' },
    }, null, 2));

    const repoDir = path.join(tempHome, 'repo');
    const nestedDir = path.join(repoDir, 'packages', 'service');
    fs.mkdirSync(path.join(repoDir, '.claude'), { recursive: true });
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.claude', 'model-map.json'), JSON.stringify({
      routes: { default: 'project-model' },
    }, null, 2));
    const gitInit = spawnSync(process.platform === 'win32' ? 'git.exe' : 'git', ['init', '-q'], {
      cwd: repoDir,
      encoding: 'utf8',
    });
    expect(gitInit.status).to.equal(0, gitInit.stderr);

    const port = PROXY_PORT + 11;
    const proc = spawnProxyInstance(tempHome, port, {}, nestedDir);
    proc.stderr.on('data', () => {});
    try {
      const ready = await waitForProxy(port);
      expect(ready).to.equal(true);
      const result = await ping(port);
      expect(result.config_path).to.equal(fs.realpathSync(path.join(repoDir, '.claude', 'model-map.json')));
      expect(result.config_source).to.equal('project');
    } finally {
      proc.kill('SIGTERM');
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it('reloads the pinned config file when it changes on disk', async function () {
    this.timeout(5000);
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-reload-'));
    const configPath = path.join(tempHome, '.claude', 'model-map.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({
      backends: {
        anthropic: {
          kind: 'anthropic',
          url: `http://127.0.0.1:${anthropicPort}`,
          auth_env: 'TEST_ANTHROPIC_KEY',
        },
        ollama_local: {
          kind: 'ollama',
          url: `http://127.0.0.1:${ollamaPort}`,
        },
      },
      model_routes: {
        'switch-model': 'anthropic',
      },
    }, null, 2));

    const port = PROXY_PORT + 12;
    const proc = spawnProxyInstance(tempHome, port, {
      CLAUDE_MODEL_MAP_PATH: configPath,
      CLAUDE_MODEL_MAP_LAUNCH_CWD: tempHome,
    }, tempHome);
    proc.stderr.on('data', () => {});
    let anthropicCountTokensBody = null;
    let ollamaCountTokensBody = null;
    const savedAnthropic = anthropicMock.listeners('request').slice();
    const savedOllama = ollamaMock.listeners('request').slice();
    anthropicMock.removeAllListeners('request');
    anthropicMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        if (req.method === 'POST' && req.url === '/v1/messages/count_tokens') {
          anthropicCountTokensBody = JSON.parse(Buffer.concat(chunks).toString() || '{}');
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ input_tokens: 17 }));
          return;
        }
        const receivedBody = Buffer.concat(chunks).toString();
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'x-received-key': req.headers['x-api-key'] || '',
          'x-received-body': receivedBody,
        });
        res.end(
          'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-6","usage":{"input_tokens":5,"output_tokens":0}}}\n\n' +
          'event: message_stop\ndata: {"type":"message_stop"}\n\n'
        );
      });
    });
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        if (req.method === 'POST' && req.url === '/v1/messages/count_tokens') {
          ollamaCountTokensBody = JSON.parse(Buffer.concat(chunks).toString() || '{}');
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ input_tokens: 23 }));
          return;
        }
        if (req.method === 'POST' && req.url === '/api/show') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              details: { parent_model: '', family: 'mock', parameter_size: '0B' },
              digest: 'sha256:mockdigest0000000000000000000000000000000000000000000000000000',
            }),
          );
          return;
        }
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        writeOllamaAnthropicResponse(res, body, ['Hello', ' world'], 2);
      });
    });

    try {
      const ready = await waitForProxy(port);
      expect(ready).to.equal(true);

      const before = await postProxyPath(port, '/v1/messages/count_tokens', {
        model: 'switch-model',
        messages: [{ role: 'user', content: 'count me' }],
      });
      expect(before.status).to.equal(200);
      expect(JSON.parse(before.body).input_tokens).to.equal(17);
      expect(anthropicCountTokensBody).to.not.be.null;
      expect(anthropicCountTokensBody.model).to.equal('switch-model');

      await new Promise(r => setTimeout(r, 20));
      fs.writeFileSync(configPath, JSON.stringify({
        backends: {
          anthropic: {
            kind: 'anthropic',
            url: `http://127.0.0.1:${anthropicPort}`,
            auth_env: 'TEST_ANTHROPIC_KEY',
          },
          ollama_local: {
            kind: 'ollama',
            url: `http://127.0.0.1:${ollamaPort}`,
          },
        },
        model_routes: {
          'switch-model': 'ollama_local',
        },
      }, null, 2));

      const after = await postProxyPath(port, '/v1/messages/count_tokens', {
        model: 'switch-model',
        messages: [{ role: 'user', content: 'count me again' }],
      });
      expect(after.status).to.equal(200);
      expect(JSON.parse(after.body).input_tokens).to.equal(23);
      expect(ollamaCountTokensBody).to.not.be.null;
      expect(ollamaCountTokensBody.model).to.equal('switch-model');
    } finally {
      proc.kill('SIGTERM');
      anthropicMock.removeAllListeners('request');
      for (const h of savedAnthropic) anthropicMock.on('request', h);
      ollamaMock.removeAllListeners('request');
      for (const h of savedOllama) ollamaMock.on('request', h);
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });
});

describe('claude-proxy /debug/stats', () => {
  it('tracks routed request counts by endpoint, backend, and model', async function () {
    this.timeout(3000);
    await postProxy(PROXY_PORT, {
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'hello anthropic' }],
      max_tokens: 10,
    });
    await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      messages: [{ role: 'user', content: 'hello ollama' }],
      max_tokens: 10,
      stream: true,
    });

    const statsResp = await getJsonPath(PROXY_PORT, '/debug/stats');
    expect(statsResp.status).to.equal(200);
    const stats = JSON.parse(statsResp.body);
    expect(stats.requestsTotal).to.be.at.least(2);
    expect(stats.byEndpoint['/v1/messages']).to.be.at.least(2);
    expect(stats.byBackendKind.anthropic).to.be.at.least(1);
    expect(stats.byBackendKind.ollama).to.be.at.least(1);
    expect(stats.byClientModel['claude-sonnet-4-6']).to.be.at.least(1);
    expect(stats.byClientModel['qwen3-coder:30b']).to.be.at.least(1);
    expect(stats.byEffectiveModel['claude-sonnet-4-6']).to.be.at.least(1);
    expect(stats.byEffectiveModel['qwen3-coder:30b']).to.be.at.least(1);
    expect(stats.byStatus['200']).to.be.at.least(2);
    expect(stats.currentInFlight).to.equal(0);
  });
});

describe('claude-proxy — GET /v1/models enrich', () => {
  it('merges upstream list with all model_routes ids', async function () {
    this.timeout(3000);
    const r = await getProxyModels(PROXY_PORT);
    expect(r.status).to.equal(200);
    const json = JSON.parse(r.body);
    expect(json.data).to.be.an('array');
    const ids = json.data.map(m => m.id).sort();
    expect(ids).to.deep.equal([
      'alias-to-ollama',
      'background',
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'default',
      'qwen3-coder:30b',
    ]);
    const qwen = json.data.find(m => m.id === 'qwen3-coder:30b');
    expect(qwen).to.be.an('object');
    expect(qwen.display_name).to.equal('qwen3-coder:30b');
    expect(qwen.capabilities).to.deep.equal({ thinking: { supported: true, types: {} } });
  });
});

describe('claude-proxy — Anthropic passthrough (non-/v1/messages)', () => {
  it('forwards GET /v1/* to anthropic backend', async function () {
    this.timeout(3000);
    const r = await new Promise((resolve, reject) => {
      http
        .get(
          {
            hostname: '127.0.0.1',
            port: PROXY_PORT,
            path: '/v1/me',
            headers: {
              'x-api-key': 'from-client',
              'anthropic-version': '2023-06-01',
            },
          },
          res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
              resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() });
            });
          },
        )
        .on('error', reject);
    });
    expect(r.status).to.equal(200);
    const j = JSON.parse(r.body);
    expect(j.passthrough_ok).to.equal(true);
    expect(j.key).to.equal('real-test-key-from-env');
  });

  it('routes model-scoped JSON endpoints like /v1/messages/count_tokens by backend', async function () {
    this.timeout(3000);
    let anthropicReceived = null;
    let ollamaReceived = null;

    const savedAnthropic = anthropicMock.listeners('request').slice();
    anthropicMock.removeAllListeners('request');
    anthropicMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        if (req.method === 'POST' && req.url === '/v1/messages/count_tokens') {
          anthropicReceived = {
            body: JSON.parse(Buffer.concat(chunks).toString() || '{}'),
            key: req.headers['x-api-key'] || '',
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ input_tokens: 17 }));
          return;
        }
        const receivedBody = Buffer.concat(chunks).toString();
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'x-received-key': req.headers['x-api-key'] || '',
          'x-received-body': receivedBody,
        });
        res.end(
          'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-6","usage":{"input_tokens":5,"output_tokens":0}}}\n\n' +
          'event: message_stop\ndata: {"type":"message_stop"}\n\n'
        );
      });
    });

    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        if (req.method === 'POST' && req.url === '/api/show') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              details: { parent_model: '', family: 'mock', parameter_size: '0B' },
              digest: 'sha256:mockdigest0000000000000000000000000000000000000000000000000000',
            }),
          );
          return;
        }
        if (req.method === 'POST' && req.url === '/v1/messages/count_tokens') {
          ollamaReceived = {
            body: JSON.parse(Buffer.concat(chunks).toString() || '{}'),
            auth: req.headers.authorization || '',
          };
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ input_tokens: 23 }));
          return;
        }
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        writeOllamaAnthropicResponse(res, body, ['Hello', ' world'], 2);
      });
    });

    try {
      const anthropicResp = await postProxyPath(PROXY_PORT, '/v1/messages/count_tokens', {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'count me' }],
      });
      const ollamaResp = await postProxyPath(PROXY_PORT, '/v1/messages/count_tokens', {
        model: 'alias-to-ollama',
        messages: [{ role: 'user', content: 'count me too' }],
      });

      expect(anthropicResp.status).to.equal(200);
      expect(JSON.parse(anthropicResp.body).input_tokens).to.equal(17);
      expect(anthropicReceived).to.not.be.null;
      expect(anthropicReceived.body.model).to.equal('claude-sonnet-4-6');
      expect(anthropicReceived.key).to.equal('real-test-key-from-env');

      expect(ollamaResp.status).to.equal(200);
      expect(JSON.parse(ollamaResp.body).input_tokens).to.equal(23);
      expect(ollamaReceived).to.not.be.null;
      expect(ollamaReceived.body.model).to.equal('qwen3-coder:30b');
      expect(ollamaReceived.auth).to.equal('Bearer test-placeholder-key');
    } finally {
      anthropicMock.removeAllListeners('request');
      for (const h of savedAnthropic) anthropicMock.on('request', h);
      ollamaMock.removeAllListeners('request');
      ollamaMock.on('request', makeDefaultOllamaHandler());
    }
  });
});

describe('claude-proxy — Anthropic passthrough', () => {
  it('forwards request body to the anthropic backend', async function () {
    this.timeout(3000);
    const r = await postProxy(PROXY_PORT, {
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 100,
    });
    expect(r.status).to.equal(200);
    // The mock echoes back the received body via x-received-body header
    const receivedBody = JSON.parse(r.headers['x-received-body']);
    expect(receivedBody.model).to.equal('claude-sonnet-4-6');
    expect(receivedBody.messages[0].content).to.equal('hello');
  });

  it('replaces x-api-key with the real key from env (not the placeholder)', async function () {
    this.timeout(3000);
    const r = await postProxy(PROXY_PORT, {
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'key test' }],
      max_tokens: 10,
    });
    expect(r.status).to.equal(200);
    // Mock echoes back the key it received via header
    expect(r.headers['x-received-key']).to.equal('real-test-key-from-env');
    expect(r.headers['x-received-key']).not.to.equal('test-placeholder-key');
  });

  it('streams SSE through without buffering', async function () {
    this.timeout(3000);
    const r = await postProxy(PROXY_PORT, {
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'stream test' }],
      max_tokens: 10,
      stream: true,
    });
    expect(r.status).to.equal(200);
    expect(r.headers['content-type']).to.include('text/event-stream');
    expect(r.body).to.include('message_start');
    expect(r.body).to.include('message_stop');
  });

  it('passes through custom request and response headers', async function () {
    this.timeout(3000);
    let receivedCustom = null;
    const savedListeners = anthropicMock.listeners('request').slice();
    anthropicMock.removeAllListeners('request');
    anthropicMock.on('request', (req, res) => {
      receivedCustom = req.headers['x-custom-request'] || null;
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'x-upstream-custom': 'anthropic-response-header',
          'x-received-body': Buffer.concat(chunks).toString(),
        });
        res.end(
          'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_custom","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-6","usage":{"input_tokens":1,"output_tokens":0}}}\n\n' +
          'event: message_stop\ndata: {"type":"message_stop"}\n\n'
        );
      });
    });
    try {
      const r = await postProxy(
        PROXY_PORT,
        {
          model: 'claude-sonnet-4-6',
          messages: [{ role: 'user', content: 'header test' }],
          max_tokens: 10,
        },
        { 'x-custom-request': 'anthropic-request-header' },
      );
      expect(r.status).to.equal(200);
      expect(receivedCustom).to.equal('anthropic-request-header');
      expect(r.headers['x-upstream-custom']).to.equal('anthropic-response-header');
    } finally {
      anthropicMock.removeAllListeners('request');
      for (const h of savedListeners) anthropicMock.on('request', h);
    }
  });
});

describe('claude-proxy — Ollama Anthropic passthrough', () => {
  it('streams Anthropic-compatible SSE through unchanged when stream=true', async function () {
    this.timeout(3000);
    const r = await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 50,
      stream: true,
    });
    expect(r.status).to.equal(200);
    expect(r.headers['content-type']).to.include('text/event-stream');

    expect(r.body).to.include('event: message_start');
    expect(r.body).to.include('event: content_block_start');
    expect(r.body).to.include('event: content_block_delta');
    expect(r.body).to.include('event: content_block_stop');
    expect(r.body).to.include('event: message_delta');
    expect(r.body).to.include('event: message_stop');
  });

  it('assembles text deltas from NDJSON chunks', async function () {
    this.timeout(3000);
    const r = await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      messages: [{ role: 'user', content: 'text test' }],
      max_tokens: 50,
      stream: true,
    });
    expect(r.body).to.include('"Hello"');
    expect(r.body).to.include('" world"');
  });

  it('preserves output_tokens in message_delta for streamed responses', async function () {
    this.timeout(3000);
    const r = await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      messages: [{ role: 'user', content: 'token count test' }],
      max_tokens: 50,
      stream: true,
    });
    const lines = r.body.split('\n');
    const eventIdx = lines.findIndex(l => l === 'event: message_delta');
    expect(eventIdx).to.be.gte(0, 'expected message_delta event');
    const dataLine = lines[eventIdx + 1];
    expect(dataLine).to.match(/^data: /);
    const deltaData = JSON.parse(dataLine.slice('data: '.length));
    expect(deltaData.usage.output_tokens).to.equal(2);
  });

  it('passes system through unchanged to Ollama /v1/messages', async function () {
    this.timeout(3000);
    let ollamaReceivedBody = null;
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        ollamaReceivedBody = JSON.parse(Buffer.concat(chunks).toString());
        writeOllamaAnthropicResponse(res, ollamaReceivedBody, ['ok'], 1);
      });
    });

    try {
      await postProxy(PROXY_PORT, {
        model: 'qwen3-coder:30b',
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 10,
      });

      expect(ollamaReceivedBody).to.not.be.null;
      expect(ollamaReceivedBody.system).to.equal('You are helpful.');
    } finally {
      ollamaMock.removeAllListeners('request');
      ollamaMock.on('request', makeDefaultOllamaHandler());
    }
  });

  it('forwards client x-api-key as Authorization Bearer to Ollama when backend has no auth_env', async function () {
    this.timeout(3000);
    let authHeader = null;
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      if (req.method === 'POST' && req.url === '/v1/messages') {
        authHeader = req.headers.authorization || null;
      }
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const requestBody = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        writeOllamaAnthropicResponse(res, requestBody, ['ok'], 1);
      });
    });
    try {
      await postProxy(
        PROXY_PORT,
        {
          model: 'qwen3-coder:30b',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 10,
        },
        { 'x-api-key': 'user-ollama-bearer-token' },
      );
      expect(authHeader).to.equal('Bearer user-ollama-bearer-token');
    } finally {
      ollamaMock.removeAllListeners('request');
      ollamaMock.on('request', makeDefaultOllamaHandler());
    }
  });

  it('passes through custom request and response headers for Ollama', async function () {
    this.timeout(3000);
    let receivedCustom = null;
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      receivedCustom = req.headers['x-custom-request'] || null;
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'x-upstream-custom': 'ollama-response-header',
        });
        res.end(
          'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_ollama_custom","type":"message","role":"assistant","model":"qwen3-coder:30b","content":[],"usage":{"input_tokens":1,"output_tokens":0}}}\n\n' +
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n' +
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ok"}}\n\n' +
          'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n' +
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":1}}\n\n' +
          'event: message_stop\ndata: {"type":"message_stop"}\n\n'
        );
      });
    });
    try {
      const r = await postProxy(
        PROXY_PORT,
        {
          model: 'qwen3-coder:30b',
          messages: [{ role: 'user', content: 'header test' }],
          max_tokens: 10,
          stream: true,
        },
        { 'x-custom-request': 'ollama-request-header' },
      );
      expect(r.status).to.equal(200);
      expect(receivedCustom).to.equal('ollama-request-header');
      expect(r.headers['x-upstream-custom']).to.equal('ollama-response-header');
    } finally {
      ollamaMock.removeAllListeners('request');
      ollamaMock.on('request', makeDefaultOllamaHandler());
    }
  });
});

describe('claude-proxy — routing', () => {
  it('routes unknown model → local Ollama (OLLAMA_BASE_URL) with name passthrough', async function () {
    this.timeout(2000);
    let ollamaReceivedBody = null;
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        if (req.method !== 'POST' || req.url !== '/v1/messages') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{}');
          return;
        }
        const raw = Buffer.concat(chunks).toString();
        ollamaReceivedBody = JSON.parse(raw || '{}');
        writeOllamaAnthropicResponse(res, ollamaReceivedBody, ['ok'], 1);
      });
    });
    try {
      const r = await postProxy(PROXY_PORT, {
        model: 'bogus:99b',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      });
      expect(r.status).to.equal(200);
      expect(ollamaReceivedBody).to.not.be.null;
      expect(ollamaReceivedBody.model).to.equal('bogus:99b');
      expect(r.body).to.include('content_block_delta');
    } finally {
      ollamaMock.removeAllListeners('request');
      ollamaMock.on('request', makeDefaultOllamaHandler());
    }
  });

  it('returns 404 for unknown non-v1 path', async function () {
    this.timeout(1000);
    const r = await new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: '127.0.0.1', port: PROXY_PORT, path: '/notapath', method: 'GET' },
        res => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
        }
      );
      req.on('error', reject);
      req.end();
    });
    expect(r.status).to.equal(404);
    expect(JSON.parse(r.body).error).to.include('unknown path');
  });

  it('returns 400 for invalid JSON body', async function () {
    this.timeout(1000);
    const r = await new Promise((resolve, reject) => {
      const bad = 'not-json{{{';
      const req = http.request(
        {
          hostname: '127.0.0.1', port: PROXY_PORT, path: '/v1/messages', method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(bad) },
        },
        res => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
        }
      );
      req.on('error', reject);
      req.write(bad);
      req.end();
    });
    expect(r.status).to.equal(400);
    expect(JSON.parse(r.body).error).to.include('invalid json');
  });

  it('three concurrent requests to different backends complete independently', async function () {
    this.timeout(5000);
    const [r1, r2, r3] = await Promise.all([
      postProxy(PROXY_PORT, {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'concurrent 1' }],
        max_tokens: 10,
      }),
      postProxy(PROXY_PORT, {
        model: 'qwen3-coder:30b',
        messages: [{ role: 'user', content: 'concurrent 2' }],
        max_tokens: 10,
        stream: true,
      }),
      postProxy(PROXY_PORT, {
        model: 'claude-opus-4-6',
        messages: [{ role: 'user', content: 'concurrent 3' }],
        max_tokens: 10,
      }),
    ]);

    // All three complete successfully
    expect(r1.status).to.equal(200);
    expect(r2.status).to.equal(200);
    expect(r3.status).to.equal(200);

    // r1 and r3 → anthropic backend (SSE from mock)
    expect(r1.body).to.include('message_stop');
    expect(r3.body).to.include('message_stop');

    // r2 → ollama backend (Anthropic-compatible SSE)
    expect(r2.body).to.include('content_block_delta');
  });
});

// ── New test groups ───────────────────────────────────────────────────

describe('claude-proxy — Anthropic passthrough — body fidelity', () => {
  it('forwards tools and tool_choice to backend', async function () {
    this.timeout(3000);
    const tools = [
      {
        name: 'get_weather',
        description: 'Get weather',
        input_schema: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] },
      },
    ];
    const r = await postProxy(PROXY_PORT, {
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'What is the weather?' }],
      max_tokens: 50,
      tools,
      tool_choice: { type: 'auto' },
    });
    expect(r.status).to.equal(200);
    const received = JSON.parse(r.headers['x-received-body']);
    expect(received.tools).to.be.an('array').with.length(1);
    expect(received.tools[0].name).to.equal('get_weather');
    expect(received.tool_choice).to.deep.equal({ type: 'auto' });
  });

  it('forwards sampling params (temperature, top_p, top_k, stop_sequences, metadata)', async function () {
    this.timeout(3000);
    const r = await postProxy(PROXY_PORT, {
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 10,
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      stop_sequences: ['STOP', 'END'],
      metadata: { user_id: 'test-user-123' },
    });
    expect(r.status).to.equal(200);
    const received = JSON.parse(r.headers['x-received-body']);
    expect(received.temperature).to.equal(0.7);
    expect(received.top_p).to.equal(0.9);
    expect(received.top_k).to.equal(40);
    expect(received.stop_sequences).to.deep.equal(['STOP', 'END']);
    expect(received.metadata).to.deep.equal({ user_id: 'test-user-123' });
  });

  it('forwards anthropic-beta header to upstream', async function () {
    this.timeout(3000);
    let receivedBeta = null;
    const savedListeners = anthropicMock.listeners('request').slice();
    anthropicMock.removeAllListeners('request');
    anthropicMock.on('request', (req, res) => {
      receivedBeta = req.headers['anthropic-beta'] || null;
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const receivedBody = Buffer.concat(chunks).toString();
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'x-received-key': req.headers['x-api-key'] || '',
          'x-received-body': receivedBody,
        });
        res.end(
          'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_beta","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-6","usage":{"input_tokens":5,"output_tokens":0}}}\n\n' +
          'event: message_stop\ndata: {"type":"message_stop"}\n\n'
        );
      });
    });
    try {
      await postProxy(
        PROXY_PORT,
        { model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'beta test' }], max_tokens: 10 },
        { 'anthropic-beta': 'interleaved-thinking-2025-05-14' }
      );
      expect(receivedBeta).to.equal('interleaved-thinking-2025-05-14');
    } finally {
      anthropicMock.removeAllListeners('request');
      for (const h of savedListeners) anthropicMock.on('request', h);
    }
  });
});

describe('claude-proxy — Anthropic passthrough — error propagation', () => {
  it('upstream 4xx passes through to client', async function () {
    this.timeout(3000);
    const savedListeners = anthropicMock.listeners('request').slice();
    anthropicMock.removeAllListeners('request');
    anthropicMock.on('request', (req, res) => {
      req.resume();
      res.writeHead(401, { 'www-authenticate': 'Bearer realm="test"' });
      res.end(JSON.stringify({ error: { type: 'authentication_error', message: 'invalid api key' } }));
    });
    try {
      const r = await postProxy(PROXY_PORT, {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: '401 test' }],
        max_tokens: 10,
      });
      expect(r.status).to.equal(401);
      expect(r.headers['www-authenticate']).to.exist;
    } finally {
      anthropicMock.removeAllListeners('request');
      for (const h of savedListeners) anthropicMock.on('request', h);
    }
  });
});

describe('claude-proxy — Ollama passthrough — body fidelity', () => {
  let ollamaReceivedBody = null;

  beforeEach(function () {
    ollamaReceivedBody = null;
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        ollamaReceivedBody = JSON.parse(Buffer.concat(chunks).toString());
        writeOllamaAnthropicResponse(res, ollamaReceivedBody, ['ok'], 1);
      });
    });
  });

  afterEach(function () {
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', makeDefaultOllamaHandler());
  });

  it('passes temperature through unchanged', async function () {
    this.timeout(3000);
    await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      messages: [{ role: 'user', content: 'temp test' }],
      max_tokens: 10,
      temperature: 0.5,
    });
    expect(ollamaReceivedBody).to.not.be.null;
    expect(ollamaReceivedBody.temperature).to.equal(0.5);
  });

  it('passes top_p through unchanged', async function () {
    this.timeout(3000);
    await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      messages: [{ role: 'user', content: 'top_p test' }],
      max_tokens: 10,
      top_p: 0.85,
    });
    expect(ollamaReceivedBody).to.not.be.null;
    expect(ollamaReceivedBody.top_p).to.equal(0.85);
  });

  it('passes stop_sequences through unchanged', async function () {
    this.timeout(3000);
    await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      messages: [{ role: 'user', content: 'stop test' }],
      max_tokens: 10,
      stop_sequences: ['<|end|>', 'STOP'],
    });
    expect(ollamaReceivedBody).to.not.be.null;
    expect(ollamaReceivedBody.stop_sequences).to.deep.equal(['<|end|>', 'STOP']);
  });

  it('preserves structured message content blocks', async function () {
    this.timeout(3000);
    await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'hello from array' }] },
      ],
      max_tokens: 10,
    });
    expect(ollamaReceivedBody).to.not.be.null;
    const userMsg = ollamaReceivedBody.messages.find(m => m.role === 'user');
    expect(userMsg).to.exist;
    expect(userMsg.content).to.deep.equal([{ type: 'text', text: 'hello from array' }]);
  });

  it('preserves structured system blocks', async function () {
    this.timeout(3000);
    await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      system: [{ type: 'text', text: 'be helpful' }],
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 10,
    });
    expect(ollamaReceivedBody).to.not.be.null;
    expect(ollamaReceivedBody.system).to.deep.equal([{ type: 'text', text: 'be helpful' }]);
  });

  it('preserves tools, tool_choice, and tool_result blocks', async function () {
    this.timeout(3000);
    await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      tools: [
        {
          name: 'echo_tool',
          description: 'Echo input',
          input_schema: {
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'echo_tool' },
      messages: [
        { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'echo_tool', input: { text: 'hi' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'done' }] },
      ],
      max_tokens: 10,
    });
    expect(ollamaReceivedBody).to.not.be.null;
    expect(ollamaReceivedBody.tools).to.be.an('array').with.length(1);
    expect(ollamaReceivedBody.tool_choice).to.deep.equal({ type: 'tool', name: 'echo_tool' });
    expect(ollamaReceivedBody.messages[0].content[0]).to.deep.equal({
      type: 'tool_use',
      id: 'toolu_1',
      name: 'echo_tool',
      input: { text: 'hi' },
    });
    expect(ollamaReceivedBody.messages[1].content[0]).to.deep.equal({
      type: 'tool_result',
      tool_use_id: 'toolu_1',
      content: 'done',
    });
  });
});

describe('claude-proxy — Ollama translation — error propagation', () => {
  it('Ollama non-200 response returns error to client', async function () {
    this.timeout(3000);
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      req.resume();
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'service unavailable' }));
    });
    try {
      const r = await postProxy(PROXY_PORT, {
        model: 'qwen3-coder:30b',
        messages: [{ role: 'user', content: '503 test' }],
        max_tokens: 10,
      });
      expect(r.status).to.equal(503);
      const body = JSON.parse(r.body);
      expect(body.error).to.exist;
    } finally {
      ollamaMock.removeAllListeners('request');
      ollamaMock.on('request', makeDefaultOllamaHandler());
    }
  });
});

describe('claude-proxy — Ollama legacy translator guardrails', () => {
  it('uses the effective model and header annotation instead of mutating content', async function () {
    this.timeout(5000);
    const legacyPort = 19990;
    const legacyOllama = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        if (req.method === 'POST' && req.url === '/api/chat') {
          res.writeHead(200, { 'content-type': 'application/x-ndjson' });
          res.write(
            JSON.stringify({
              model: 'qwen3-coder:30b',
              message: { role: 'assistant', content: 'legacy-ok' },
              done: false,
            }) + '\n',
          );
          res.write(
            JSON.stringify({
              model: 'qwen3-coder:30b',
              message: { role: 'assistant', content: '' },
              done: true,
              eval_count: 1,
            }) + '\n',
          );
          res.end();
          return;
        }
        if (req.method === 'POST' && req.url === '/api/show') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              details: { parent_model: '', family: 'mock', parameter_size: '0B' },
              digest: 'sha256:mockdigest0000000000000000000000000000000000000000000000000000',
            }),
          );
          return;
        }
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
      });
    });
    const legacyOllamaPort = await listenOnRandomPort(legacyOllama);
    const legacyHome = makeTempHome({
      backends: {
        ollama_local: {
          kind: 'ollama',
          url: `http://127.0.0.1:${legacyOllamaPort}`,
        },
      },
      model_routes: {
        'qwen3-coder:30b': 'ollama_local',
      },
    });
    const legacyProc = spawn(process.execPath, [PROXY_SCRIPT], {
      cwd: legacyHome,
      env: {
        ...process.env,
        HOME: legacyHome,
        CLAUDE_PROXY_PORT: String(legacyPort),
        CLAUDE_MODEL_MAP_PATH: '',
        CLAUDE_MODEL_MAP_SOURCE: '',
        CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
        CLAUDE_PROJECT_DIR: '',
        CLAUDE_PROXY_SKIP_OLLAMA_WARMUP: '1',
        CLAUDE_PROXY_OLLAMA_LEGACY_TRANSLATE: '1',
        CLAUDE_PROXY_ANNOTATE_MODEL: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    legacyProc.stderr.on('data', () => {});

    try {
      const ready = await waitForProxy(legacyPort);
      if (!ready) throw new Error('legacy proxy did not start');
      const r = await postProxy(legacyPort, {
        model: 'qwen3-coder:30b',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 10,
      });
      expect(r.status).to.equal(200);
      expect(r.headers['x-claude-proxy-served-by']).to.equal('qwen3-coder:30b');
      expect(r.body).to.include('"model":"qwen3-coder:30b"');
      expect(r.body).to.not.include('served_by=qwen3-coder:30b');
      expect(r.body).to.not.include('"model":"foobar"');
    } finally {
      legacyProc.kill('SIGTERM');
      await new Promise(r => legacyOllama.close(r));
      fs.rmSync(legacyHome, { recursive: true, force: true });
    }
  });
});

describe('claude-proxy — Ollama passthrough — response annotation', () => {
  it('adds x-claude-proxy-served-by when CLAUDE_PROXY_ANNOTATE_MODEL=1', async function () {
    this.timeout(5000);
    const annotatedPort = 19992;
    const annotatedProc = spawn(process.execPath, [PROXY_SCRIPT], {
      cwd: homeDir,
      env: {
        ...process.env,
        HOME: homeDir,
        CLAUDE_PROXY_PORT: String(annotatedPort),
        TEST_ANTHROPIC_KEY: 'real-test-key-from-env',
        CLAUDE_MODEL_MAP_PATH: '',
        CLAUDE_MODEL_MAP_SOURCE: '',
        CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
        CLAUDE_PROJECT_DIR: '',
        OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPort}`,
        CLAUDE_PROXY_SKIP_OLLAMA_WARMUP: '1',
        CLAUDE_PROXY_ANNOTATE_MODEL: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    annotatedProc.stderr.on('data', () => {});

    try {
      const ready = await waitForProxy(annotatedPort);
      if (!ready) throw new Error('annotated claude-proxy did not start');

      const r = await postProxy(annotatedPort, {
        model: 'qwen3-coder:30b',
        messages: [{ role: 'user', content: 'who served this?' }],
        max_tokens: 10,
      });
      expect(r.status).to.equal(200);
      expect(r.headers['x-claude-proxy-served-by']).to.equal('qwen3-coder:30b');
    } finally {
      annotatedProc.kill('SIGTERM');
    }
  });
});

describe('claude-proxy — route alias resolution', () => {
  it('resolves alias and forwards to the aliased model backend with correct model name', async function () {
    this.timeout(3000);
    let ollamaReceivedBody = null;
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        ollamaReceivedBody = JSON.parse(Buffer.concat(chunks).toString());
        writeOllamaAnthropicResponse(res, ollamaReceivedBody, ['aliased'], 1);
      });
    });
    try {
      const r = await postProxy(PROXY_PORT, {
        model: 'alias-to-ollama',
        messages: [{ role: 'user', content: 'alias test' }],
        max_tokens: 10,
        stream: true,
      });
      expect(r.status).to.equal(200);
      expect(ollamaReceivedBody).to.not.be.null;
      expect(ollamaReceivedBody.model).to.equal('qwen3-coder:30b');
      expect(r.body).to.include('content_block_delta');
    } finally {
      ollamaMock.removeAllListeners('request');
      ollamaMock.on('request', makeDefaultOllamaHandler());
    }
  });

  it('unknown model not in routes or model_routes falls back to Ollama passthrough', async function () {
    this.timeout(2000);
    let ollamaReceivedBody = null;
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        if (req.method !== 'POST' || req.url !== '/v1/messages') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{}');
          return;
        }
        ollamaReceivedBody = JSON.parse(Buffer.concat(chunks).toString());
        writeOllamaAnthropicResponse(res, ollamaReceivedBody, ['ok'], 1);
      });
    });
    try {
      const r = await postProxy(PROXY_PORT, {
        model: 'unknown:latest',
        messages: [{ role: 'user', content: 'fallback test' }],
      });
      expect(r.status).to.equal(200);
      expect(ollamaReceivedBody).to.not.be.null;
      // No alias → model name passed through unchanged
      expect(ollamaReceivedBody.model).to.equal('unknown:latest');
    } finally {
      ollamaMock.removeAllListeners('request');
      ollamaMock.on('request', makeDefaultOllamaHandler());
    }
  });

  it('unknown claude-* model defaults to the anthropic backend', async function () {
    this.timeout(2000);
    const r = await postProxy(PROXY_PORT, {
      model: 'claude-haiku-4-5-20251001',
      messages: [{ role: 'user', content: 'side-call test' }],
      max_tokens: 10,
    });
    expect(r.status).to.equal(200);
    const receivedBody = JSON.parse(r.headers['x-received-body']);
    expect(receivedBody.model).to.equal('claude-haiku-4-5-20251001');
  });

  it('pattern model_routes keys can map claude-* names to anthropic', async function () {
    this.timeout(5000);
    const patternHome = makeTempHome({
      backends: {
        anthropic: {
          kind: 'anthropic',
          url: `http://127.0.0.1:${anthropicPort}`,
          auth_env: 'TEST_ANTHROPIC_KEY',
        },
        ollama_local: {
          kind: 'ollama',
          url: `http://127.0.0.1:${ollamaPort}`,
        },
      },
      model_routes: {
        're:^claude-.*$': 'anthropic',
        'qwen3-coder:30b': 'ollama_local',
      },
    });
    const patternPort = 19991;
    const patternProc = spawn(process.execPath, [PROXY_SCRIPT], {
      cwd: patternHome,
      env: {
        ...process.env,
        HOME: patternHome,
        CLAUDE_PROXY_PORT: String(patternPort),
        TEST_ANTHROPIC_KEY: 'real-test-key-from-env',
        CLAUDE_MODEL_MAP_PATH: '',
        CLAUDE_MODEL_MAP_SOURCE: '',
        CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
        CLAUDE_PROJECT_DIR: '',
        OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPort}`,
        CLAUDE_PROXY_SKIP_OLLAMA_WARMUP: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    patternProc.stderr.on('data', () => {});
    try {
      const ready = await waitForProxy(patternPort);
      if (!ready) throw new Error('pattern proxy did not start');
      const r = await postProxy(patternPort, {
        model: 'claude-haiku-4-5-20251001',
        messages: [{ role: 'user', content: 'pattern route test' }],
        max_tokens: 10,
      });
      expect(r.status).to.equal(200);
      const receivedBody = JSON.parse(r.headers['x-received-body']);
      expect(receivedBody.model).to.equal('claude-haiku-4-5-20251001');
    } finally {
      patternProc.kill('SIGTERM');
      fs.rmSync(patternHome, { recursive: true, force: true });
    }
  });

  it('a non-claude fallback-model error does not poison the next Ollama request', async function () {
    this.timeout(3000);
    const seenModels = [];
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        if (req.method !== 'POST' || req.url !== '/v1/messages') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{}');
          return;
        }
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        seenModels.push(body.model);
        if (body.model === 'aux-helper-1:latest') {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: `model '${body.model}' not found` }));
          return;
        }
        writeOllamaAnthropicResponse(res, body, [`ok:${body.model}`], 1);
      });
    });
    try {
      const qwen1 = await postProxy(PROXY_PORT, {
        model: 'qwen3-coder:30b',
        messages: [{ role: 'user', content: 'first qwen request' }],
        max_tokens: 10,
      });
      const helper = await postProxy(PROXY_PORT, {
        model: 'aux-helper-1:latest',
        messages: [{ role: 'user', content: 'missing side request' }],
        max_tokens: 10,
      });
      const qwen2 = await postProxy(PROXY_PORT, {
        model: 'qwen3-coder:30b',
        messages: [{ role: 'user', content: 'second qwen request' }],
        max_tokens: 10,
      });

      expect(seenModels).to.deep.equal([
        'qwen3-coder:30b',
        'aux-helper-1:latest',
        'qwen3-coder:30b',
      ]);
      expect(qwen1.status).to.equal(200);
      expect(helper.status).to.equal(404);
      expect(qwen2.status).to.equal(200);
      expect(qwen1.body).to.include('ok:qwen3-coder:30b');
      expect(qwen2.body).to.include('ok:qwen3-coder:30b');
    } finally {
      ollamaMock.removeAllListeners('request');
      ollamaMock.on('request', makeDefaultOllamaHandler());
    }
  });
});

describe('claude-proxy — fallback strategies', () => {
  it('applies the same final-model fallback strategy across multiple labels and skips a cooled-down primary', async function () {
    this.timeout(5000);
    let anthropicHits = 0;
    const anthropicServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: [], has_more: false }));
        return;
      }
      anthropicHits += 1;
      res.writeHead(429, {
        'content-type': 'application/json',
        'retry-after': '5',
      });
      res.end(JSON.stringify({ error: { message: 'rate limit exceeded' } }));
    });
    const localServer = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        writeOllamaAnthropicResponse(res, body, ['fallback-ok'], 1);
      });
    });
    const anthropicFallbackPort = await listenOnRandomPort(anthropicServer);
    const localPort = await listenOnRandomPort(localServer);
    const tempHome = makeTempHome({
      backends: {
        anthropic: { kind: 'anthropic', url: `http://127.0.0.1:${anthropicFallbackPort}`, auth_env: 'TEST_ANTHROPIC_KEY' },
        ollama_local: { kind: 'ollama', url: `http://127.0.0.1:${localPort}` },
      },
      model_routes: {
        'claude-sonnet-4-6': 'anthropic',
        'qwen3.5:35b-a3b-coding-nvfp4': 'ollama_local',
      },
      routes: {
        high: 'claude-sonnet-4-6',
        think: 'claude-sonnet-4-6',
        'medium-model': 'qwen3.5:35b-a3b-coding-nvfp4',
      },
      fallback_strategies: {
        'claude-sonnet-4-6': {
          on: {
            rate_limit: ['medium-model'],
          },
          cooldown: {
            rate_limit: { mode: 'header_or_max', seconds: 1 },
          },
        },
      },
    });
    const port = PROXY_PORT + 21;
    const proc = spawnProxyInstance(tempHome, port, {
      TEST_ANTHROPIC_KEY: 'real-test-key-from-env',
      OLLAMA_BASE_URL: `http://127.0.0.1:${localPort}`,
    });
    proc.stderr.on('data', () => {});
    try {
      const ready = await waitForProxy(port);
      expect(ready).to.equal(true);

      const first = await postProxy(port, {
        model: 'high',
        messages: [{ role: 'user', content: 'first' }],
        max_tokens: 10,
      });
      const second = await postProxy(port, {
        model: 'think',
        messages: [{ role: 'user', content: 'second' }],
        max_tokens: 10,
      });

      expect(first.status).to.equal(200);
      expect(second.status).to.equal(200);
      expect(first.body).to.include('fallback-ok');
      expect(second.body).to.include('fallback-ok');
      expect(anthropicHits).to.equal(1);
    } finally {
      proc.kill('SIGTERM');
      await new Promise(r => anthropicServer.close(r));
      await new Promise(r => localServer.close(r));
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it('classifies account_quota failures separately from rate_limit and falls back', async function () {
    this.timeout(5000);
    const anthropicServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: [], has_more: false }));
        return;
      }
      res.writeHead(429, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'credits exhausted for this account' } }));
    });
    const localServer = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        writeOllamaAnthropicResponse(res, body, ['quota-fallback'], 1);
      });
    });
    const anthropicFallbackPort = await listenOnRandomPort(anthropicServer);
    const localPort = await listenOnRandomPort(localServer);
    const tempHome = makeTempHome({
      backends: {
        anthropic: { kind: 'anthropic', url: `http://127.0.0.1:${anthropicFallbackPort}`, auth_env: 'TEST_ANTHROPIC_KEY' },
        ollama_local: { kind: 'ollama', url: `http://127.0.0.1:${localPort}` },
      },
      model_routes: {
        'claude-sonnet-4-6': 'anthropic',
        'qwen3.5:35b-a3b-coding-nvfp4': 'ollama_local',
      },
      routes: {
        high: 'claude-sonnet-4-6',
        'medium-model': 'qwen3.5:35b-a3b-coding-nvfp4',
      },
      fallback_strategies: {
        'claude-sonnet-4-6': {
          on: {
            account_quota: ['medium-model'],
          },
        },
      },
    });
    const port = PROXY_PORT + 22;
    const proc = spawnProxyInstance(tempHome, port, {
      TEST_ANTHROPIC_KEY: 'real-test-key-from-env',
      OLLAMA_BASE_URL: `http://127.0.0.1:${localPort}`,
    });
    proc.stderr.on('data', () => {});
    try {
      const ready = await waitForProxy(port);
      expect(ready).to.equal(true);

      const result = await postProxy(port, {
        model: 'high',
        messages: [{ role: 'user', content: 'quota fallback' }],
        max_tokens: 10,
      });
      expect(result.status).to.equal(200);
      expect(result.body).to.include('quota-fallback');

      const stats = await getJsonPath(port, '/debug/stats');
      const parsedStats = JSON.parse(stats.body);
      expect(parsedStats.byFailureClass.account_quota).to.equal(1);
      expect(parsedStats.byFailureClass.rate_limit || 0).to.equal(0);
    } finally {
      proc.kill('SIGTERM');
      await new Promise(r => anthropicServer.close(r));
      await new Promise(r => localServer.close(r));
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it('falls back on context_limit without cooling down the primary', async function () {
    this.timeout(5000);
    let anthropicHits = 0;
    const anthropicServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: [], has_more: false }));
        return;
      }
      anthropicHits += 1;
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'context length exceeded for model' } }));
    });
    const localServer = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        writeOllamaAnthropicResponse(res, body, ['long-context-ok'], 1);
      });
    });
    const anthropicFallbackPort = await listenOnRandomPort(anthropicServer);
    const localPort = await listenOnRandomPort(localServer);
    const tempHome = makeTempHome({
      backends: {
        anthropic: { kind: 'anthropic', url: `http://127.0.0.1:${anthropicFallbackPort}`, auth_env: 'TEST_ANTHROPIC_KEY' },
        ollama_local: { kind: 'ollama', url: `http://127.0.0.1:${localPort}` },
      },
      model_routes: {
        'claude-sonnet-4-6': 'anthropic',
        'qwen3.5:35b-a3b-coding-nvfp4': 'ollama_local',
      },
      routes: {
        high: 'claude-sonnet-4-6',
        longContext: 'qwen3.5:35b-a3b-coding-nvfp4',
      },
      fallback_strategies: {
        'claude-sonnet-4-6': {
          on: {
            context_limit: ['longContext'],
          },
        },
      },
    });
    const port = PROXY_PORT + 23;
    const proc = spawnProxyInstance(tempHome, port, {
      TEST_ANTHROPIC_KEY: 'real-test-key-from-env',
      OLLAMA_BASE_URL: `http://127.0.0.1:${localPort}`,
    });
    proc.stderr.on('data', () => {});
    try {
      const ready = await waitForProxy(port);
      expect(ready).to.equal(true);

      const first = await postProxy(port, {
        model: 'high',
        messages: [{ role: 'user', content: 'first' }],
        max_tokens: 10,
      });
      const second = await postProxy(port, {
        model: 'high',
        messages: [{ role: 'user', content: 'second' }],
        max_tokens: 10,
      });

      expect(first.status).to.equal(200);
      expect(second.status).to.equal(200);
      expect(first.body).to.include('long-context-ok');
      expect(second.body).to.include('long-context-ok');
      expect(anthropicHits).to.equal(2);
    } finally {
      proc.kill('SIGTERM');
      await new Promise(r => anthropicServer.close(r));
      await new Promise(r => localServer.close(r));
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });
});

describe('claude-proxy — route graph (multi-hop)', () => {
  it('follows routes think → sonnet id → qwen for Ollama model field', async function () {
    this.timeout(10000);
    const graphPort = 19995;
    let ollamaBody = null;
    const ollamaServerG = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        ollamaBody = JSON.parse(Buffer.concat(chunks).toString());
        writeOllamaAnthropicResponse(res, ollamaBody, ['x'], 1);
      });
    });
    const ollamaPortG = await listenOnRandomPort(ollamaServerG);
    const homeG = makeTempHome({
      backends: {
        ollama_local: {
          kind: 'ollama',
          url: `http://127.0.0.1:${ollamaPortG}`,
        },
      },
      model_routes: {
        'qwen3-coder:30b': 'ollama_local',
      },
      routes: {
        think: 'claude-sonnet-4-6',
        'claude-sonnet-4-6': 'qwen3-coder:30b',
      },
    });
    const proxyG = spawn(process.execPath, [PROXY_SCRIPT], {
      cwd: homeG,
      env: {
        ...process.env,
        HOME: homeG,
        CLAUDE_PROXY_PORT: String(graphPort),
        CLAUDE_MODEL_MAP_PATH: '',
        CLAUDE_MODEL_MAP_SOURCE: '',
        CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
        CLAUDE_PROJECT_DIR: '',
        CLAUDE_PROXY_SKIP_OLLAMA_WARMUP: '1',
        OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPortG}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proxyG.stderr.on('data', () => {});
    try {
      const ready = await waitForProxy(graphPort);
      if (!ready) throw new Error('graph proxy did not start');
      const r = await postProxy(graphPort, {
        model: 'think',
        messages: [{ role: 'user', content: 'multi-hop' }],
        max_tokens: 5,
      });
      expect(r.status).to.equal(200);
      expect(ollamaBody).to.not.be.null;
      expect(ollamaBody.model).to.equal('qwen3-coder:30b');
    } finally {
      proxyG.kill('SIGTERM');
      await new Promise(r => ollamaServerG.close(r));
      fs.rmSync(homeG, { recursive: true, force: true });
    }
  });

  it('fails startup when routes contain a cycle', async function () {
    this.timeout(3000);
    const cycHome = makeTempHome({
      backends: {
        ollama_local: {
          kind: 'ollama',
          url: 'http://127.0.0.1:19993',
        },
      },
      model_routes: { 'qwen3-coder:30b': 'ollama_local' },
      routes: { a: 'b', b: 'a' },
    });
    const cycProc = spawn(process.execPath, [PROXY_SCRIPT], {
      cwd: cycHome,
      env: {
        ...process.env,
        HOME: cycHome,
        CLAUDE_PROXY_PORT: '19994',
        CLAUDE_MODEL_MAP_PATH: '',
        CLAUDE_MODEL_MAP_SOURCE: '',
        CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
        CLAUDE_PROJECT_DIR: '',
        CLAUDE_PROXY_SKIP_OLLAMA_WARMUP: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    cycProc.stderr.setEncoding('utf8');
    cycProc.stderr.on('data', chunk => {
      stderr += chunk;
    });
    const ok = await waitForProxy(19994, 1000);
    try {
      expect(ok).to.equal(false);
      const exitCode = cycProc.exitCode !== null
        ? cycProc.exitCode
        : await new Promise(resolve => cycProc.on('exit', code => resolve(code)));
      expect(exitCode).to.not.equal(0);
      expect(stderr).to.match(/cycle/i);
    } finally {
      cycProc.kill('SIGTERM');
      fs.rmSync(cycHome, { recursive: true, force: true });
    }
  });
});

describe('claude-proxy — error cases and connectivity', () => {
  const PROXY_PORT2 = 19996;
  let proxy2 = null;
  let homeDir2 = null;

  before(async function () {
    this.timeout(10000);
    homeDir2 = makeTempHome({
      backends: {
        broken_backend: {
          kind: 'ollama',
          url: 'http://127.0.0.1:1', // nothing listens here → ECONNREFUSED
        },
        grpc_backend: {
          kind: 'grpc',
          url: 'http://127.0.0.1:1',
        },
      },
      model_routes: {
        'model-undefined-backend': 'nonexistent_id',
        'model-bad-kind': 'grpc_backend',
        'model-refused': 'broken_backend',
      },
    });

    proxy2 = spawn(process.execPath, [PROXY_SCRIPT], {
      cwd: homeDir2,
      env: {
        ...process.env,
        HOME: homeDir2,
        CLAUDE_PROXY_PORT: String(PROXY_PORT2),
        CLAUDE_MODEL_MAP_PATH: '',
        CLAUDE_MODEL_MAP_SOURCE: '',
        CLAUDE_MODEL_MAP_LAUNCH_CWD: '',
        CLAUDE_PROJECT_DIR: '',
        CLAUDE_PROXY_SKIP_OLLAMA_WARMUP: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proxy2.stderr.on('data', () => {});

    const ready = await waitForProxy(PROXY_PORT2);
    if (!ready) throw new Error('proxy2 did not start within 5s');
  });

  after(async function () {
    if (proxy2) { proxy2.kill('SIGTERM'); proxy2 = null; }
    if (homeDir2) { fs.rmSync(homeDir2, { recursive: true, force: true }); homeDir2 = null; }
  });

  it('missing model → 400', async function () {
    this.timeout(1000);
    const r = await postProxy(PROXY_PORT, {});
    expect(r.status).to.equal(400);
    expect(JSON.parse(r.body).error).to.equal('model is required');
  });

  it('model route points to undefined backend → 500', async function () {
    this.timeout(1000);
    const r = await postProxy(PROXY_PORT2, {
      model: 'model-undefined-backend',
      messages: [{ role: 'user', content: 'test' }],
    });
    expect(r.status).to.equal(500);
    expect(JSON.parse(r.body).error).to.include('not defined');
  });

  it('unknown backend kind → 500', async function () {
    this.timeout(1000);
    const r = await postProxy(PROXY_PORT2, {
      model: 'model-bad-kind',
      messages: [{ role: 'user', content: 'test' }],
    });
    expect(r.status).to.equal(500);
    expect(JSON.parse(r.body).error).to.include('unknown backend kind');
  });

  it('upstream connection refused → 502', async function () {
    this.timeout(2000);
    const r = await postProxy(PROXY_PORT2, {
      model: 'model-refused',
      messages: [{ role: 'user', content: 'refused test' }],
      max_tokens: 10,
    });
    expect(r.status).to.equal(502);
    const body = JSON.parse(r.body);
    expect(body.error).to.be.an('object');
    expect(body.error.type).to.equal('api_error');
    expect(body.error.message).to.match(/Cannot reach Ollama/);
  });
});
