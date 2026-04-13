'use strict';

const http = require('http');
const { spawn } = require('child_process');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROXY_SCRIPT = path.join(__dirname, '..', 'tools', 'claude-proxy');
// Use a non-default port to avoid clashing with a running real proxy
const PROXY_PORT = 19997;

// ── Helpers ───────────────────────────────────────────────────────────

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

function postProxy(port, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: '127.0.0.1',
      port,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(bodyStr),
        'x-api-key': 'test-placeholder-key',
        'anthropic-version': '2023-06-01',
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
      res.writeHead(200, { 'content-type': 'application/x-ndjson' });
      res.write(JSON.stringify({ model: 'qwen3-coder:30b', message: { role: 'assistant', content: 'Hello' }, done: false }) + '\n');
      res.write(JSON.stringify({ model: 'qwen3-coder:30b', message: { role: 'assistant', content: ' world' }, done: false }) + '\n');
      res.write(JSON.stringify({ model: 'qwen3-coder:30b', message: { role: 'assistant', content: '' }, done: true, eval_count: 2, total_duration: 1000 }) + '\n');
      res.end();
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
    },
  });

  // ── Spawn proxy ──────────────────────────────────────────────────
  proxyProc = spawn(process.execPath, [PROXY_SCRIPT], {
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PROXY_PORT: String(PROXY_PORT),
      TEST_ANTHROPIC_KEY: 'real-test-key-from-env',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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
});

describe('claude-proxy — Ollama text translator', () => {
  it('translates NDJSON response to Anthropic SSE format', async function () {
    this.timeout(3000);
    const r = await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 50,
    });
    expect(r.status).to.equal(200);
    expect(r.headers['content-type']).to.include('text/event-stream');

    // Verify SSE event sequence
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
    });
    // The mock emits "Hello" then " world" — both should appear as text_delta events
    expect(r.body).to.include('"Hello"');
    expect(r.body).to.include('" world"');
  });

  it('includes output_tokens from eval_count in message_delta', async function () {
    this.timeout(3000);
    const r = await postProxy(PROXY_PORT, {
      model: 'qwen3-coder:30b',
      messages: [{ role: 'user', content: 'token count test' }],
      max_tokens: 50,
    });
    // Mock sends eval_count: 2 in the done line.
    // SSE format: "event: message_delta\n" followed by "data: {...}\n"
    const lines = r.body.split('\n');
    const eventIdx = lines.findIndex(l => l === 'event: message_delta');
    expect(eventIdx).to.be.gte(0, 'expected message_delta event');
    const dataLine = lines[eventIdx + 1];
    expect(dataLine).to.match(/^data: /);
    const deltaData = JSON.parse(dataLine.slice('data: '.length));
    expect(deltaData.usage.output_tokens).to.equal(2);
  });

  it('translates system prompt to Ollama messages format', async function () {
    this.timeout(3000);
    // Track what Ollama mock receives
    let ollamaReceivedBody = null;
    ollamaMock.removeAllListeners('request');
    ollamaMock.on('request', (req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        ollamaReceivedBody = JSON.parse(Buffer.concat(chunks).toString());
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        res.write(JSON.stringify({ model: 'qwen3-coder:30b', message: { role: 'assistant', content: 'ok' }, done: false }) + '\n');
        res.write(JSON.stringify({ model: 'qwen3-coder:30b', message: { role: 'assistant', content: '' }, done: true, eval_count: 1 }) + '\n');
        res.end();
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
      const systemMsg = ollamaReceivedBody.messages.find(m => m.role === 'system');
      expect(systemMsg).to.exist;
      expect(systemMsg.content).to.equal('You are helpful.');
    } finally {
      // Always restore default handler, even if assertions fail, to avoid
      // poisoning subsequent tests that depend on the default mock response.
      ollamaMock.removeAllListeners('request');
      ollamaMock.on('request', (req, res) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          res.writeHead(200, { 'content-type': 'application/x-ndjson' });
          res.write(JSON.stringify({ model: 'qwen3-coder:30b', message: { role: 'assistant', content: 'Hello' }, done: false }) + '\n');
          res.write(JSON.stringify({ model: 'qwen3-coder:30b', message: { role: 'assistant', content: '' }, done: true, eval_count: 2 }) + '\n');
          res.end();
        });
      });
    }
  });
});

describe('claude-proxy — routing', () => {
  it('routes unknown model → 400 with available list', async function () {
    this.timeout(2000);
    const r = await postProxy(PROXY_PORT, {
      model: 'bogus:99b',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.status).to.equal(400);
    const body = JSON.parse(r.body);
    expect(body.error).to.include('unknown model');
    expect(body.available).to.be.an('array').and.include('claude-sonnet-4-6');
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

    // r2 → ollama backend (translated SSE)
    expect(r2.body).to.include('content_block_delta');
  });
});
