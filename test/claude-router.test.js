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
  const stub = path.join(homeDir, 'bin', 'claude');
  fs.mkdirSync(path.join(homeDir, 'bin'));
  fs.writeFileSync(stub, '#!/bin/bash\nfor a in "$@"; do echo "$a"; done\n');
  fs.chmodSync(stub, 0o755);

  return { homeDir, configPath, stub, binDir: path.join(homeDir, 'bin') };
}

function runRouter(args, { homeDir, binDir }) {
  const env = {
    ...process.env,
    HOME: homeDir,
    PATH: `${binDir}:${process.env.PATH}`,
    OLLAMA_BASE_URL: 'http://127.0.0.1:19999', // unreachable — skip Ollama auto-detect
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
});
