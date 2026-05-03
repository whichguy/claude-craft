// Tests for the proactive-research v2 shell layer:
//   - producer hook filters (recursion guard, slash-command, short prompts,
//     disabled, rate-limit, subagent guard)
//   - producer spawns the driver subprocess on substantive prompts
//   - wiki_sanitize_for_external redaction (paths, secrets-pattern hooks)
//
// LLM-driven stages (Step 1 /wiki-query Sonnet, Step 2 Haiku curl,
// Step 3 /wiki-ingest dispatch) are NOT tested here — those need real API
// and live in the manual /skills/proactive-research#Verification section.

const { expect } = require('chai');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PRODUCER = path.join(REPO_ROOT, 'plugins/wiki-suite/handlers/proactive-research-extract.sh');
const DRIVER = path.join(REPO_ROOT, 'plugins/wiki-suite/handlers/proactive-research-driver.sh');
const COMMON = path.join(REPO_ROOT, 'plugins/wiki-suite/handlers/wiki-common.sh');

// ───────────────────────────────────────────────────────────────────
// Per-test fixture: a fresh CWD with .wiki/log.md, fresh HOME for queue
// state, and a stub driver that just touches a marker file when invoked.
// ───────────────────────────────────────────────────────────────────
function mkFixture() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'proactive-research-'));
    fs.mkdirSync(path.join(tmp, 'repo/.wiki'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'repo/.wiki/log.md'), '');
    execSync('git init -q', { cwd: path.join(tmp, 'repo') });

    // Stub driver: copy a binary that touches a marker. Producer resolves the
    // driver via $(dirname "$0")/proactive-research-driver.sh — i.e. it always
    // points at the real driver. We can't easily stub that path-relative call,
    // so we use a different technique: replace PATH-resolved `claude` so that
    // when the real driver runs claude -p, it no-ops. But the simplest test
    // for "did the producer spawn the driver?" is to set a marker file via
    // a shadowed driver script in $HOME and patch the producer to call it.
    // Instead we run the producer and then verify the driver process was
    // backgrounded (PROACTIVE log entry written + driver started).
    return { tmp, cwd: path.join(tmp, 'repo') };
}

function setupHomeQueue(fix) {
    fs.mkdirSync(path.join(fix.tmp, '.claude/reflection-queue'), { recursive: true });
    fs.mkdirSync(path.join(fix.tmp, '.claude/proactive-research'), { recursive: true });
    return path.join(fix.tmp, '.claude/reflection-queue');
}

function runProducer(opts) {
    const { cwd, home, prompt, env = {}, sid = 'test-session-12345678' } = opts;
    const input = JSON.stringify({
        session_id: sid,
        cwd,
        prompt,
        agent_id: opts.agentId || '',
        transcript_path: '',
    });
    return spawnSync('bash', [PRODUCER], {
        input,
        env: {
            ...process.env,
            HOME: home,
            // Force claude to a no-op so a backgrounded driver invocation
            // doesn't actually try to talk to an API. The driver will fail
            // fast on missing API key / no claude in PATH, which is fine
            // for these tests — we only assert producer-side behavior.
            PATH: process.env.PATH,
            ...env,
        },
        encoding: 'utf8',
    });
}

function readWikiLog(fix) {
    const p = path.join(fix.cwd, '.wiki/log.md');
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

// ───────────────────────────────────────────────────────────────────
describe('proactive-research producer hook (v2)', function () {
    this.timeout(15000);

    it('recursion guard: WIKI_DRIVER=1 short-circuits without logging', function () {
        const fix = mkFixture();
        setupHomeQueue(fix);
        const r = runProducer({
            cwd: fix.cwd, home: fix.tmp,
            prompt: 'How does Postgres MVCC handle high write contention in 2026?',
            env: { WIKI_DRIVER: '1' },
        });
        expect(r.status).to.equal(0);
        expect(readWikiLog(fix)).to.not.match(/PROACTIVE/);
    });

    it('PROACTIVE_RESEARCH_DISABLED=1 short-circuits', function () {
        const fix = mkFixture();
        setupHomeQueue(fix);
        const r = runProducer({
            cwd: fix.cwd, home: fix.tmp,
            prompt: 'How does Postgres MVCC handle high write contention?',
            env: { PROACTIVE_RESEARCH_DISABLED: '1' },
        });
        expect(r.status).to.equal(0);
        expect(readWikiLog(fix)).to.not.match(/PROACTIVE/);
    });

    it('subagent guard: agent_id present → exit without logging', function () {
        const fix = mkFixture();
        setupHomeQueue(fix);
        const r = runProducer({
            cwd: fix.cwd, home: fix.tmp,
            prompt: 'How does Postgres MVCC handle high write contention?',
            agentId: 'some-subagent',
        });
        expect(r.status).to.equal(0);
        expect(readWikiLog(fix)).to.not.match(/PROACTIVE/);
    });

    it('slash-command prompt is filtered', function () {
        const fix = mkFixture();
        setupHomeQueue(fix);
        const r = runProducer({ cwd: fix.cwd, home: fix.tmp, prompt: '/help me with stuff' });
        expect(r.status).to.equal(0);
        expect(readWikiLog(fix)).to.not.match(/PROACTIVE/);
    });

    it('prompt under MIN_TOKENS is filtered (default 7)', function () {
        const fix = mkFixture();
        setupHomeQueue(fix);
        const r = runProducer({ cwd: fix.cwd, home: fix.tmp, prompt: 'hi there' });
        expect(r.status).to.equal(0);
        expect(readWikiLog(fix)).to.not.match(/PROACTIVE/);
    });

    it('PROACTIVE_RESEARCH_MIN_TOKENS=200 rejects an otherwise-substantive prompt', function () {
        const fix = mkFixture();
        setupHomeQueue(fix);
        const r = runProducer({
            cwd: fix.cwd, home: fix.tmp,
            prompt: 'How does Postgres handle MVCC under high write contention with many concurrent transactions?',
            env: { PROACTIVE_RESEARCH_MIN_TOKENS: '200' },
        });
        expect(r.status).to.equal(0);
        expect(readWikiLog(fix)).to.not.match(/PROACTIVE/);
    });

    it('substantive prompt logs PROACTIVE driver spawned', function () {
        const fix = mkFixture();
        setupHomeQueue(fix);
        const r = runProducer({
            cwd: fix.cwd, home: fix.tmp,
            prompt: 'How does Postgres handle MVCC under high write contention with many concurrent transactions?',
        });
        expect(r.status).to.equal(0);
        expect(readWikiLog(fix)).to.match(/PROACTIVE.*driver spawned/);
    });

    it('rate limit: exceeding PROACTIVE_RESEARCH_RATE_LIMIT_PER_HR drops new prompts', function () {
        const fix = mkFixture();
        setupHomeQueue(fix);
        const env = { PROACTIVE_RESEARCH_RATE_LIMIT_PER_HR: '2' };
        const submit = (n) => runProducer({
            cwd: fix.cwd, home: fix.tmp,
            prompt: `How does Postgres handle MVCC under high write contention number ${n} variant?`,
            sid: `rl-session-${n}`,
            env,
        });
        for (let i = 1; i <= 4; i++) submit(i);
        const log = readWikiLog(fix);
        const spawned = (log.match(/driver spawned/g) || []).length;
        const limited = (log.match(/PROACTIVE-RATELIMIT/g) || []).length;
        expect(spawned).to.equal(2);
        expect(limited).to.be.greaterThanOrEqual(1);
    });

    it('hook returns quickly (<2s) on substantive prompt — driver runs detached', function () {
        const fix = mkFixture();
        setupHomeQueue(fix);
        const start = Date.now();
        runProducer({
            cwd: fix.cwd, home: fix.tmp,
            prompt: 'How does Postgres handle MVCC under high write contention with many concurrent transactions?',
        });
        const elapsed = Date.now() - start;
        expect(elapsed).to.be.lessThan(2000);
    });
});

// ───────────────────────────────────────────────────────────────────
describe('wiki_sanitize_for_external', function () {
    function sanitize(input, env = {}) {
        const cmd = `. ${COMMON}; wiki_sanitize_for_external "$_SANITIZE_INPUT"`;
        const r = spawnSync('bash', ['-c', cmd], {
            encoding: 'utf8',
            env: { ...process.env, _SANITIZE_INPUT: input, ...env },
        });
        return r.stdout;
    }

    it('strips absolute /Users/... paths', function () {
        const out = sanitize('See file at /Users/alice/secrets/config.yaml for details');
        expect(out).to.not.match(/\/Users\/alice/);
        expect(out).to.match(/config\.yaml/);
    });

    it('strips /opt /var /tmp /etc absolute paths', function () {
        const out = sanitize('Logs in /var/log/app/error.log and /tmp/scratch');
        expect(out).to.not.match(/\/var\/log/);
        expect(out).to.not.match(/\/tmp\/scratch/);
    });

    it('passes through ordinary content unchanged', function () {
        const out = sanitize('How does Postgres MVCC work under high write contention?');
        expect(out.trim()).to.equal('How does Postgres MVCC work under high write contention?');
    });

    it('handles empty input', function () {
        const out = sanitize('');
        expect(out).to.equal('');
    });

    it('handles input containing single quotes (regression: shell-injection-safe path)', function () {
        const out = sanitize("what's a good way to handle MVCC?");
        expect(out).to.match(/MVCC/);
    });

    it('redacts an Anthropic-style API key (regression: SECURITY_PATTERNS variable name)', function () {
        const fake = 'sk-ant-api03-' + 'a'.repeat(95);
        const out = sanitize(`my key is ${fake} please use it`);
        expect(out).to.match(/<redacted>/);
        expect(out).to.not.contain(fake);
    });

    it('redacts an AWS access key', function () {
        const out = sanitize('access key AKIAABCDEFGHIJKLMNOP for s3');
        expect(out).to.match(/<redacted>/);
        expect(out).to.not.contain('AKIAABCDEFGHIJKLMNOP');
    });
});
