'use strict';

const { expect } = require('chai');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const MCP_SERVER = path.join(__dirname, '..', 'tools', 'llm-capabilities-mcp.js');

function makeHome(config) {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-mcp-home-'));
  const claudeDir = path.join(homeDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  const configPath = path.join(claudeDir, 'model-map.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { homeDir, configPath };
}

function startProxyStub(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
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

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

function createMessage(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  return Buffer.from(`Content-Length: ${body.length}\r\n\r\n${body.toString('utf8')}`, 'utf8');
}

function readMessages(stream, onMessage) {
  let buffer = Buffer.alloc(0);
  stream.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = buffer.slice(0, headerEnd).toString('utf8');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) throw new Error('Missing Content-Length header');
      const length = Number(match[1]);
      const total = headerEnd + 4 + length;
      if (buffer.length < total) return;
      const body = buffer.slice(headerEnd + 4, total).toString('utf8');
      buffer = buffer.slice(total);
      onMessage(JSON.parse(body));
    }
  });
}

function waitForMessage(child, id) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for message ${id}`)), 5000);
    readMessages(child.stdout, message => {
      if (message.id === id) {
        clearTimeout(timer);
        resolve(message);
      }
    });
  });
}

async function startServer(homeDir, extraEnv = {}) {
  const child = spawn(process.execPath, [MCP_SERVER], {
    cwd: homeDir,
    env: {
      ...process.env,
      HOME: homeDir,
      ...extraEnv,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stderr.on('data', () => {});
  child.stdin.write(createMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
  const init = await waitForMessage(child, 1);
  expect(init.result.serverInfo.name).to.equal('llm-capabilities-mcp');
  child.stdin.write(createMessage({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }));
  return child;
}

describe('llm-capabilities-mcp', function () {
  this.timeout(10000);

  let proxy;
  let home;

  beforeEach(async () => {
    proxy = await startProxyStub((req, res, body) => {
      const toolName = /logical MCP tool "([^"]+)"/.exec(body.system || '')?.[1] || 'unknown';
      let response;
      if (toolName === 'classify_intent') {
        response = {
          result: 'Intent: coding_review',
          confidence: 92,
          recuse_reason: null,
          dynamic_hints: ['Use deep_review for a comprehensive follow-up.'],
          recommended_tool: 'deep_review',
          clarification_questions: [],
        };
      } else {
        response = {
          result: `handled by ${toolName}`,
          confidence: 88,
          recuse_reason: null,
          dynamic_hints: ['Ask for a diff if you need tighter grounding.'],
          overall_verdict: 'sound',
          findings: ['f1'],
          followups: [],
          observations: ['o1'],
          next_steps: ['n1'],
          key_files: ['src/index.ts'],
          entry_points: ['src/index.ts'],
          dependencies: ['lib/core'],
          impact_areas: ['tests'],
          proposed_tests: ['it("works", ...)'],
          test_files: ['test/example.test.js'],
          test_ideas: ['edge case'],
          implementation_plan: ['Refactor module boundaries'],
          proposed_changes: ['Update parser flow'],
          verification_steps: ['Run focused tests'],
        };
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [{ type: 'text', text: JSON.stringify(response) }],
      }));
    });

    home = makeHome({
      backends: {
        openrouter: { kind: 'anthropic', url: 'https://openrouter.ai/api/v1', auth_env: 'OPENROUTER_API_KEY' },
        ollama_local: { kind: 'ollama', url: 'http://127.0.0.1:11434' },
      },
      model_routes: {
        'glm-5.1:cloud': 'openrouter',
        'qwen3:1.7b': 'ollama_local',
        'gemma4:e2b': 'ollama_local',
        'deepseek-r1:14b': 'ollama_local',
        'gemma4:26b': 'ollama_local',
        'qwen3-coder:30b': 'ollama_local',
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
        heavy_coder: { model: 'qwen3-coder:30b' },
        review_plan: { model: 'workhorse' },
        review_code: { model: 'qwen3-coder:30b' },
      },
    });
  });

  afterEach(() => {
    if (proxy?.server) proxy.server.close();
    if (home?.homeDir) fs.rmSync(home.homeDir, { recursive: true, force: true });
  });

  it('lists the direct tools including ask_model and list_models', async () => {
    const child = await startServer(home.homeDir, { CLAUDE_LLM_PROXY_BASE_URL: `http://127.0.0.1:${proxy.port}` });
    child.stdin.write(createMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }));
    const response = await waitForMessage(child, 2);
    const names = response.result.tools.map(tool => tool.name).sort();
    expect(names).to.deep.equal(Object.keys({
      ask_model: 1,
      list_models: 1,
      classify_intent: 1,
      explore_local: 1,
      explore_web: 1,
      review_quality: 1,
      critique_plan: 1,
      detect_bugs: 1,
      navigate_codebase: 1,
      generate_tests: 1,
      deep_review: 1,
      heavy_coder: 1,
    }).sort());
    const askModel = response.result.tools.find(tool => tool.name === 'ask_model');
    expect(askModel.description).to.include('already know the exact model');
    expect(askModel.inputSchema.required).to.deep.equal(['model', 'prompt']);
    expect(askModel.inputSchema.properties.model.description).to.include('Required model identifier');
    expect(askModel.inputSchema.properties).to.not.have.property('image_base64');
    const listModels = response.result.tools.find(tool => tool.name === 'list_models');
    expect(listModels.description).to.include('proxy-managed model catalog');
    expect(listModels.inputSchema.properties).to.deep.equal({});
    expect(listModels.inputSchema).to.not.have.property('required');
    const classifier = response.result.tools.find(tool => tool.name === 'classify_intent');
    expect(classifier.description).to.include('Best first tool');
    expect(classifier.description).to.include('takes a prompt and returns an intent classification');
    expect(classifier.inputSchema.properties.prompt.description).to.include('raw prompt');
    expect(classifier.inputSchema.required).to.deep.equal(['prompt']);
    expect(classifier.inputSchema.properties).to.not.have.property('query');
    const exploreLocal = response.result.tools.find(tool => tool.name === 'explore_local');
    expect(exploreLocal.description).to.include('analyzing supplied local workspace context');
    expect(exploreLocal.inputSchema.properties).to.have.property('image_base64');
    expect(exploreLocal.inputSchema.properties).to.not.have.property('audio_base64');
    const navigate = response.result.tools.find(tool => tool.name === 'navigate_codebase');
    expect(navigate).to.not.have.property('outputSchema');
    const generateTests = response.result.tools.find(tool => tool.name === 'generate_tests');
    expect(generateTests).to.not.have.property('outputSchema');
    const heavyCoder = response.result.tools.find(tool => tool.name === 'heavy_coder');
    expect(heavyCoder).to.not.have.property('outputSchema');
    expect(heavyCoder.inputSchema.properties).to.not.have.property('image_base64');
    const deepReview = response.result.tools.find(tool => tool.name === 'deep_review');
    expect(deepReview.description).to.include('Best all-around review tool');
    expect(deepReview.annotations).to.deep.equal({
      title: 'deep_review',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    child.kill('SIGTERM');
  });

  it('calls list_models and returns the proxy-backed model catalog', async () => {
    proxy.server.close();
    proxy = await startProxyStub((req, res) => {
      if (req.method === 'GET' && req.url.startsWith('/v1/models')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          object: 'list',
          data: [
            { id: 'glm-5.1:cloud', display_name: 'GLM 5.1' },
            { id: 'qwen3-coder:30b', display_name: 'Qwen3 Coder 30B' },
          ],
        }));
        return;
      }
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unexpected request' }));
    });

    const child = await startServer(home.homeDir, { CLAUDE_LLM_PROXY_BASE_URL: `http://127.0.0.1:${proxy.port}` });
    child.stdin.write(createMessage({
      jsonrpc: '2.0',
      id: 29,
      method: 'tools/call',
      params: { name: 'list_models', arguments: {} },
    }));
    const response = await waitForMessage(child, 29);
    expect(response.result.structuredContent.result).to.equal('Listed 2 models from claude-proxy.');
    expect(response.result.structuredContent.model_count).to.equal(2);
    expect(response.result.structuredContent.dynamic_hints).to.deep.equal([]);
    expect(response.result.structuredContent.models.map(model => model.id)).to.deep.equal(['glm-5.1:cloud', 'qwen3-coder:30b']);
    expect(proxy.requests).to.have.length(1);
    expect(proxy.requests[0].method).to.equal('GET');
    expect(proxy.requests[0].url).to.equal('/v1/models');
    child.kill('SIGTERM');
  });

  it('calls ask_model and dispatches the requested model through the proxy', async () => {
    const child = await startServer(home.homeDir, { CLAUDE_LLM_PROXY_BASE_URL: `http://127.0.0.1:${proxy.port}` });
    child.stdin.write(createMessage({
      jsonrpc: '2.0',
      id: 30,
      method: 'tools/call',
      params: {
        name: 'ask_model',
        arguments: {
          model: 'glm-5.1:cloud',
          prompt: 'Summarize the tradeoffs of this migration plan.',
          context: 'Keep it brief and actionable.',
        },
      },
    }));
    const response = await waitForMessage(child, 30);
    expect(response.result.structuredContent.result).to.equal('handled by ask_model');
    expect(response.result.structuredContent.confidence).to.equal(88);
    expect(response.result.structuredContent.dynamic_hints).to.deep.equal(['Ask for a diff if you need tighter grounding.']);
    expect(response.result.structuredContent).to.not.have.property('implementation_plan');
    expect(response.result.structuredContent).to.not.have.property('proposed_changes');
    expect(response.result.structuredContent).to.not.have.property('verification_steps');
    expect(proxy.requests[0].body.model).to.equal('glm-5.1:cloud');
    expect(proxy.requests[0].body.system).to.include('Do not turn this into a routing exercise');
    expect(proxy.requests[0].body.system).to.include('requested model identifier for this call is "glm-5.1:cloud"');
    child.kill('SIGTERM');
  });

  it('rejects ask_model calls without an explicit model', async () => {
    const child = await startServer(home.homeDir, { CLAUDE_LLM_PROXY_BASE_URL: `http://127.0.0.1:${proxy.port}` });
    child.stdin.write(createMessage({
      jsonrpc: '2.0',
      id: 31,
      method: 'tools/call',
      params: {
        name: 'ask_model',
        arguments: {
          prompt: 'Answer directly.',
        },
      },
    }));
    const response = await waitForMessage(child, 31);
    expect(response.error).to.be.an('object');
    expect(response.error.message).to.include('ask_model.model');
    expect(proxy.requests).to.have.length(0);
    child.kill('SIGTERM');
  });

  it('calls classify_intent and returns structured output', async () => {
    const child = await startServer(home.homeDir, { CLAUDE_LLM_PROXY_BASE_URL: `http://127.0.0.1:${proxy.port}` });
    child.stdin.write(createMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'classify_intent', arguments: { query: 'Review this migration plan' } },
    }));
    const response = await waitForMessage(child, 3);
    expect(response.result.structuredContent.recommended_tool).to.equal('deep_review');
    expect(response.result.structuredContent.clarification_questions).to.deep.equal([]);
    expect(response.result.structuredContent.dynamic_hints).to.deep.equal(['Use deep_review for a comprehensive follow-up.']);
    expect(proxy.requests[0].body.model).to.equal('classifier');
    expect(proxy.requests[0].body.system).to.include('The first character of your response must be "{"');
    expect(proxy.requests[0].body.system).to.include('Always include dynamic_hints as a JSON array');
    expect(proxy.requests[0].body.system).to.include('Tool-specific response guidance:');
    child.kill('SIGTERM');
  });

  it('passes direct-model capability overrides through unchanged', async () => {
    const child = await startServer(home.homeDir, { CLAUDE_LLM_PROXY_BASE_URL: `http://127.0.0.1:${proxy.port}` });
    child.stdin.write(createMessage({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'heavy_coder', arguments: { query: 'Refactor this module' } },
    }));
    const response = await waitForMessage(child, 4);
    expect(response.result.structuredContent.result).to.include('heavy_coder');
    expect(response.result.structuredContent.dynamic_hints).to.deep.equal(['Ask for a diff if you need tighter grounding.']);
    expect(proxy.requests[0].body.model).to.equal('qwen3-coder:30b');
    expect(proxy.requests[0].body.system).to.include('Return concrete implementation guidance and artifacts');
    child.kill('SIGTERM');
  });

  it('extracts and normalizes JSON even when the model wraps it in a markdown fence', async () => {
    proxy.server.close();
    proxy = await startProxyStub((req, res, body) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [{
          type: 'text',
          text: [
            '```json',
            JSON.stringify({
              result: 'handled by navigate_codebase',
              confidence: 81,
              recuse_reason: null,
              dynamic_hints: ['Open the key files before editing.'],
              key_files: ['src/router.ts'],
              entry_points: ['src/main.ts'],
              dependencies: ['src/router.ts -> src/proxy.ts'],
              impact_areas: ['routing'],
            }, null, 2),
            '```',
          ].join('\n'),
        }],
      }));
    });

    const child = await startServer(home.homeDir, { CLAUDE_LLM_PROXY_BASE_URL: `http://127.0.0.1:${proxy.port}` });
    child.stdin.write(createMessage({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'navigate_codebase', arguments: { prompt: 'Map the router flow' } },
    }));
    const response = await waitForMessage(child, 6);
    expect(response.result.structuredContent.result).to.equal('handled by navigate_codebase');
    expect(response.result.structuredContent.dynamic_hints).to.deep.equal(['Open the key files before editing.']);
    expect(response.result.structuredContent.key_files).to.deep.equal(['src/router.ts']);
    expect(response.result.structuredContent.entry_points).to.deep.equal(['src/main.ts']);
    child.kill('SIGTERM');
  });

  it('clamps confidence to the advertised 0-100 schema range', async () => {
    proxy.server.close();
    proxy = await startProxyStub((req, res, body) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [{
          type: 'text',
          text: JSON.stringify({
            result: 'handled by deep_review',
            confidence: 140,
            recuse_reason: null,
            dynamic_hints: ['Follow up with tests.'],
            overall_verdict: 'sound',
            findings: [],
            followups: [],
          }),
        }],
      }));
    });

    const child = await startServer(home.homeDir, { CLAUDE_LLM_PROXY_BASE_URL: `http://127.0.0.1:${proxy.port}` });
    child.stdin.write(createMessage({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'deep_review', arguments: { prompt: 'Review this implementation' } },
    }));
    const response = await waitForMessage(child, 8);
    expect(response.result.structuredContent.confidence).to.equal(100);
    child.kill('SIGTERM');
  });

  it('emits debug breadcrumbs for proxy selection, dispatch, and JSON parsing', async () => {
    proxy.server.close();
    proxy = await startProxyStub((req, res, body) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [{
          type: 'text',
          text: [
            '```json',
            JSON.stringify({
              result: 'Intent: coding_review',
              confidence: 91,
              recuse_reason: null,
              dynamic_hints: ['Call deep_review next.'],
              recommended_tool: 'deep_review',
              clarification_questions: [],
            }, null, 2),
            '```',
          ].join('\n'),
        }],
      }));
    });

    const child = await startServer(home.homeDir, {
      CLAUDE_LLM_PROXY_BASE_URL: `http://127.0.0.1:${proxy.port}`,
      CLAUDE_LLM_CAPABILITIES_DEBUG: '1',
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });

    child.stdin.write(createMessage({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'classify_intent', arguments: { prompt: 'Route this prompt' } },
    }));
    const response = await waitForMessage(child, 7);
    expect(response.result.structuredContent.recommended_tool).to.equal('deep_review');
    expect(response.result.structuredContent.dynamic_hints).to.deep.equal(['Call deep_review next.']);

    const logged = await new Promise((resolve) => {
      const deadline = Date.now() + 1000;
      const check = () => {
        if (
          stderr.includes('"event":"mcp.proxy.ensure.external"') &&
          stderr.includes('"event":"mcp.tool.call.before"') &&
          stderr.includes('"event":"mcp.proxy.dispatch.before"') &&
          stderr.includes('"event":"mcp.tool.call.after"') &&
          stderr.includes('"parse_kind":"fenced_json"')
        ) {
          resolve(true);
          return;
        }
        if (Date.now() >= deadline) {
          resolve(false);
          return;
        }
        setTimeout(check, 25);
      };
      check();
    });
    expect(logged).to.equal(true);
    child.kill('SIGTERM');
  });

  it('starts a real proxy without requiring an injected proxy base URL', async () => {
    const upstreamRequests = [];
    const upstream = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
        upstreamRequests.push({ method: req.method, url: req.url, body });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          id: 'msg_real_proxy',
          type: 'message',
          role: 'assistant',
          model: body.model,
          content: [{
            type: 'text',
            text: JSON.stringify({
              result: 'Intent: coding_review',
              confidence: 90,
              recuse_reason: null,
              recommended_tool: 'deep_review',
              clarification_questions: [],
            }),
          }],
        }));
      });
    });

    const upstreamPort = await listen(upstream);

    const realHome = makeHome({
      backends: {
        anthropic_local: { kind: 'anthropic', url: `http://127.0.0.1:${upstreamPort}` },
      },
      model_routes: {
        'qwen3:1.7b': 'anthropic_local',
        'glm-5.1:cloud': 'anthropic_local',
      },
      routes: {
        default: 'general-default',
      },
      llm_active_profile: '64gb',
      llm_connectivity_mode: 'connected',
      llm_profiles: {
        '64gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'qwen3:1.7b' },
          classifier: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
          explorer: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
          reviewer: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
          workhorse: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
          coder: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
        },
        '128gb': {
          default: { connected_model: 'glm-5.1:cloud', disconnect_model: 'qwen3:1.7b' },
          classifier: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
          explorer: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
          reviewer: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
          workhorse: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
          coder: { connected_model: 'qwen3:1.7b', disconnect_model: 'qwen3:1.7b' },
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
    });

    const child = await startServer(realHome.homeDir);
    try {
      child.stdin.write(createMessage({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'classify_intent', arguments: { query: 'Route this prompt' } },
      }));
      const response = await waitForMessage(child, 5);
      expect(response.result.structuredContent.recommended_tool).to.equal('deep_review');
      expect(upstreamRequests).to.have.length(1);
      expect(upstreamRequests[0].body.model).to.equal('qwen3:1.7b');
    } finally {
      child.kill('SIGTERM');
      upstream.close();
      fs.rmSync(realHome.homeDir, { recursive: true, force: true });
    }
  });
});
