'use strict';

const { expect } = require('chai');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

const HANDLERS_DIR = path.join(__dirname, '..', 'plugins', 'craft-hooks', 'handlers');

describe('Proxy Health Hooks', function () {
  this.timeout(10000);

  let tmpDir;
  let fakeHome;

  beforeEach(function () {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-health-hooks-'));
    fakeHome = path.join(tmpDir, 'home');
    fs.mkdirSync(path.join(fakeHome, '.claude'), { recursive: true });
  });

  afterEach(function () {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runHook(handlerName, inputJson) {
    const script = path.join(HANDLERS_DIR, handlerName);
    const jsonStr = JSON.stringify(inputJson);
    return execAsync(`printf '%s' '${jsonStr.replace(/'/g, "'\\''")}' | bash "${script}"`, {
      env: { ...process.env, HOME: fakeHome },
      timeout: 5000,
    });
  }

  it('SessionStart injects a concise unhealthy cloud summary', async function () {
    fs.writeFileSync(path.join(fakeHome, '.claude', 'proxy-health.json'), JSON.stringify({
      version: 1,
      event_seq: 3,
      last_transition: {
        event_id: 3,
        backend_id: 'openrouter',
        from: 'healthy',
        to: 'disconnected',
        reason: 'network_failure',
        at: '2026-04-17T10:00:00.000Z',
        at_ms: 1763383200000,
      },
      recent_events: [],
      backends: {
        openrouter: {
          backend_id: 'openrouter',
          managed: true,
          state: 'disconnected',
        },
      },
    }, null, 2));

    const { stdout } = await runHook('proxy-health-session.sh', {
      hook_event_name: 'SessionStart',
      cwd: '/tmp/project',
      session_id: 'sess-1',
    });
    const parsed = JSON.parse(stdout);
    expect(parsed.systemMessage).to.include('cloud backend unhealthy');
    expect(parsed.hookSpecificOutput.hookEventName).to.equal('SessionStart');
    expect(parsed.hookSpecificOutput.additionalContext).to.include('Favor local-capable models');
  });

  it('UserPromptSubmit emits a heal transition once and suppresses repeats', async function () {
    fs.writeFileSync(path.join(fakeHome, '.claude', 'proxy-health.json'), JSON.stringify({
      version: 1,
      event_seq: 4,
      last_transition: {
        event_id: 4,
        backend_id: 'openrouter',
        from: 'recovering',
        to: 'healthy',
        reason: 'recovered',
        at: '2026-04-17T10:05:00.000Z',
        at_ms: 1763383500000,
      },
      recent_events: [],
      backends: {
        openrouter: {
          backend_id: 'openrouter',
          managed: true,
          state: 'healthy',
        },
      },
    }, null, 2));

    const first = JSON.parse((await runHook('proxy-health-notify.sh', {
      hook_event_name: 'UserPromptSubmit',
      cwd: '/tmp/project',
      session_id: 'sess-2',
      prompt: 'help me',
    })).stdout);
    expect(first.systemMessage).to.include('recovered');
    expect(first.hookSpecificOutput.hookEventName).to.equal('UserPromptSubmit');

    const second = await runHook('proxy-health-notify.sh', {
      hook_event_name: 'UserPromptSubmit',
      cwd: '/tmp/project',
      session_id: 'sess-2',
      prompt: 'help me again',
    });
    expect(second.stdout.trim()).to.equal('');
  });
});
