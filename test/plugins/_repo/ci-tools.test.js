const { expect } = require('chai');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Behavioural tests for the repo-only CI tooling: tools/ci.sh, tools/scan-secrets.sh,
// tools/check-plugin-versions.py and .githooks/pre-commit. Each test builds a throwaway
// git repo, so a gate that silently stopped gating (the pre-commit secret scan did exactly
// that for months — it called the engine in report-only mode) fails here, not in prod.

const REPO_ROOT = path.resolve(__dirname, '../../..');
const TOOLS = path.join(REPO_ROOT, 'tools');
// Assembled at runtime so this file never contains a contiguous key-shaped string.
const FAKE_KEY = 'AKIA' + 'ABCDEFGHIJKLMNOP';

const created = [];
after(() => created.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

function cleanEnv(home, extra) {
    const env = {
        PATH: process.env.PATH,
        HOME: home,
        LANG: 'C',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com',
        GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com',
    };
    return Object.assign(env, extra || {});
}

function run(cmd, args, cwd, extraEnv) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-tools-home-'));
    created.push(home);
    const r = spawnSync(cmd, args, { cwd, env: cleanEnv(home, extraEnv), encoding: 'utf8' });
    return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const git = (dir, ...args) => run('git', args, dir);

function write(dir, files) {
    Object.keys(files).forEach((rel) => {
        const p = path.join(dir, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, files[rel]);
    });
}

function makeRepo(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-tools-repo-'));
    created.push(dir);
    git(dir, 'init', '-q');
    fs.mkdirSync(path.join(dir, 'tools'));
    ['ci.sh', 'scan-secrets.sh', 'simple-secrets-scan.sh', 'check-plugin-versions.py', 'check-hermes-drift.sh'].forEach((t) => {
        fs.copyFileSync(path.join(TOOLS, t), path.join(dir, 'tools', t));
        fs.chmodSync(path.join(dir, 'tools', t), 0o755);
    });
    write(dir, files || {});
    return dir;
}

function commitAll(dir, msg) {
    git(dir, 'add', '-A');
    const r = git(dir, 'commit', '-q', '-m', msg || 'c');
    expect(r.status, r.out).to.equal(0);
    return git(dir, 'rev-parse', 'HEAD').out.trim();
}

describe('tools/scan-secrets.sh (shared secret-scan policy)', function () {
    it('blocks a secret-like pattern in a code file', function () {
        const dir = makeRepo({ 'src/app.js': `const k = "${FAKE_KEY}";\n` });
        const r = run('tools/scan-secrets.sh', ['src/app.js'], dir);
        expect(r.status).to.equal(1);
        expect(r.out).to.match(/BLOCKED: src\/app\.js/);
    });

    it('only warns for test and doc files, which legitimately hold fake keys', function () {
        const dir = makeRepo({
            'test/sanitizer.js': `const k = "${FAKE_KEY}";\n`,
            'docs/notes.md': `example: ${FAKE_KEY}\n`,
        });
        const r = run('tools/scan-secrets.sh', ['test/sanitizer.js', 'docs/notes.md'], dir);
        expect(r.status).to.equal(0);
        expect(r.out).to.match(/warn:\s+test\/sanitizer\.js/);
        expect(r.out).to.match(/warn:\s+docs\/notes\.md/);
    });

    it('passes clean files and silently skips paths that no longer exist', function () {
        const dir = makeRepo({ 'src/ok.js': 'module.exports = 1;\n' });
        const r = run('tools/scan-secrets.sh', ['src/ok.js', 'src/deleted.js'], dir);
        expect(r.status).to.equal(0);
        expect(r.out).to.match(/1 files, 0 blocking, 0 warning/);
    });

    it('pins why the wrapper exists: the engine is report-only unless asked for "true"', function () {
        const dir = makeRepo({ 'src/app.js': `const k = "${FAKE_KEY}";\n` });
        expect(run('tools/simple-secrets-scan.sh', ['src/app.js', 'false'], dir).status).to.equal(0);
        expect(run('tools/simple-secrets-scan.sh', ['src/app.js', 'true'], dir).status).to.equal(1);
    });
});

describe('.githooks/pre-commit (secret gate must actually gate)', function () {
    this.timeout(30000);

    function hookRepo() {
        const dir = makeRepo({ 'README.md': '# t\n' });
        fs.mkdirSync(path.join(dir, '.githooks'));
        fs.copyFileSync(path.join(REPO_ROOT, '.githooks', 'pre-commit'), path.join(dir, '.githooks', 'pre-commit'));
        fs.chmodSync(path.join(dir, '.githooks', 'pre-commit'), 0o755);
        git(dir, 'config', 'core.hooksPath', '.githooks');
        return dir;
    }

    it('refuses a commit that stages a secret in a code file', function () {
        const dir = hookRepo();
        write(dir, { 'src/leak.js': `const k = "${FAKE_KEY}";\n` });
        git(dir, 'add', 'src/leak.js');
        const r = git(dir, 'commit', '-m', 'leak');
        expect(r.status, r.out).to.not.equal(0);
        expect(r.out).to.match(/COMMIT BLOCKED/);
        expect(git(dir, 'rev-parse', '--verify', '-q', 'HEAD').status).to.not.equal(0); // nothing was committed
    });

    it('scans what is staged, not the working tree (git add -p case)', function () {
        const dir = hookRepo();
        write(dir, { 'src/leak.js': `const k = "${FAKE_KEY}";\n` });
        git(dir, 'add', 'src/leak.js');
        write(dir, { 'src/leak.js': 'const k = process.env.KEY;\n' }); // clean, but unstaged
        const r = git(dir, 'commit', '-m', 'leak');
        expect(r.status, r.out).to.not.equal(0);
        expect(r.out).to.match(/COMMIT BLOCKED/);
    });

    it('lets a clean commit through', function () {
        const dir = hookRepo();
        write(dir, { 'src/ok.js': 'module.exports = 1;\n' });
        git(dir, 'add', 'src/ok.js');
        const r = git(dir, 'commit', '-m', 'ok');
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(/secret scan passed/);
    });

    it('does not block fake keys in test files', function () {
        const dir = hookRepo();
        write(dir, { 'test/sanitizer.test.js': `expect(sanitize("${FAKE_KEY}"));\n` });
        git(dir, 'add', 'test/sanitizer.test.js');
        const r = git(dir, 'commit', '-m', 'test');
        expect(r.status, r.out).to.equal(0);
    });
});

describe('tools/check-plugin-versions.py', function () {
    const market = (version, extra) => JSON.stringify({
        name: 'm', owner: { name: 'o' },
        plugins: [{ name: 'alpha', source: './plugins/alpha', version }].concat(extra || []),
    });
    const plugin = (version) => JSON.stringify({ name: 'alpha', version, description: 'd' });
    const layout = (mv, pv) => ({
        '.claude-plugin/marketplace.json': market(mv),
        'plugins/alpha/.claude-plugin/plugin.json': plugin(pv),
        'plugins/alpha/skills/s/SKILL.md': 'v1\n',
        'plugins/alpha/tests/t.test.js': '//\n',
    });
    const py = (dir, args) => run('python3', ['tools/check-plugin-versions.py'].concat(args || []), dir);

    it('passes when plugin.json and marketplace.json agree', function () {
        const r = py(makeRepo(layout('1.0.0', '1.0.0')));
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(/1 local plugins, 0 mismatched/);
    });

    it('fails when they drift apart', function () {
        const r = py(makeRepo(layout('1.0.1', '1.0.0')));
        expect(r.status).to.equal(1);
        expect(r.out).to.match(/FAIL alpha: plugin\.json=1\.0\.0 but marketplace\.json=1\.0\.1/);
    });

    it('skips remote (git-subdir) sources, which live in another repo', function () {
        const files = layout('1.0.0', '1.0.0');
        files['.claude-plugin/marketplace.json'] = market('1.0.0', [
            { name: 'remote', source: { source: 'git-subdir', url: 'https://example.invalid/r.git' }, version: '9.9.9' },
        ]);
        const r = py(makeRepo(files));
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(/1 local plugins/);
    });

    describe('--bump-advisory', function () {
        it('warns (never fails) when shipped files changed but the version did not', function () {
            const dir = makeRepo(layout('1.0.0', '1.0.0'));
            const base = commitAll(dir);
            write(dir, { 'plugins/alpha/skills/s/SKILL.md': 'v2\n' });
            commitAll(dir, 'change skill');
            const r = py(dir, ['--bump-advisory', base]);
            expect(r.status, r.out).to.equal(0);
            expect(r.out).to.match(/WARNING: alpha: 1 shipped file/);
        });

        it('is quiet once the version is bumped', function () {
            const dir = makeRepo(layout('1.0.0', '1.0.0'));
            const base = commitAll(dir);
            write(dir, {
                'plugins/alpha/skills/s/SKILL.md': 'v2\n',
                'plugins/alpha/.claude-plugin/plugin.json': plugin('1.0.1'),
                '.claude-plugin/marketplace.json': market('1.0.1'),
            });
            commitAll(dir, 'change + bump');
            const r = py(dir, ['--bump-advisory', base]);
            expect(r.out).to.match(/0 plugin\(s\) changed without a bump/);
            expect(r.out).to.not.match(/WARNING/);
        });

        it('ignores changes that are not shipped to users (tests)', function () {
            const dir = makeRepo(layout('1.0.0', '1.0.0'));
            const base = commitAll(dir);
            write(dir, { 'plugins/alpha/tests/t.test.js': '// changed\n' });
            commitAll(dir, 'test only');
            expect(py(dir, ['--bump-advisory', base]).out).to.not.match(/WARNING/);
        });
    });
});

describe('tools/check-hermes-drift.sh (staleness vs the upstream manifest)', function () {
    this.timeout(30000);
    const MINE = 'aaa  plan-review-cleanup.py\n';
    const upstream = (dir, content) => {
        const f = path.join(dir, 'upstream.sha256');
        fs.writeFileSync(f, content);
        return { HERMES_CANONICAL_URL: 'file://' + f };
    };
    const drift = (dir, env, args) => run('tools/check-hermes-drift.sh', args || [], dir, env);
    const repo = () => makeRepo({ 'plugins/planning-suite/handlers/CANONICAL.sha256': MINE });

    it('reports in sync when the manifests match', function () {
        const dir = repo();
        const r = drift(dir, upstream(dir, MINE), ['--strict']);
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(/OK — planning-suite manifest matches hermes/);
    });

    it('only warns about drift by default, so upstream movement cannot redden unrelated pushes', function () {
        const dir = repo();
        const r = drift(dir, upstream(dir, 'bbb  plan-review-cleanup.py\n'));
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(/WARNING: .*STALE.*advisory/s);
    });

    it('fails on drift under --strict and points at the real upstream SYNC.md', function () {
        const dir = repo();
        const r = drift(dir, upstream(dir, 'bbb  plan-review-cleanup.py\n'), ['--strict']);
        expect(r.status).to.equal(1);
        expect(r.out).to.match(/hermes-skills-marketplace\/blob\/main\/plugins\/plan-review\/handlers\/SYNC\.md/);
    });

    it('treats an unreachable upstream as skipped (77) by default but as a failure under --strict', function () {
        const dir = repo();
        const env = { HERMES_CANONICAL_URL: 'file://' + path.join(dir, 'nope.sha256') };
        expect(drift(dir, env).status).to.equal(77);
        expect(drift(dir, env, ['--strict']).status).to.equal(1);
    });

    it('ci.sh makes drift blocking only when the change touches the handlers', function () {
        const dir = repo();
        const base = commitAll(dir, 'base');
        const env = Object.assign(upstream(dir, 'bbb  plan-review-cleanup.py\n'), { CI_BASE: base });
        fs.rmSync(path.join(dir, 'test-results'), { recursive: true, force: true });

        write(dir, { 'docs/unrelated.md': 'x\n' });
        commitAll(dir, 'unrelated');
        const unrelated = run('tools/ci.sh', ['run', 'hermes-drift'], dir, env);
        expect(unrelated.status, unrelated.out).to.equal(0); // warn only

        write(dir, { 'plugins/planning-suite/handlers/plan-unknowns-gate.py': '#\n' });
        commitAll(dir, 'touch handlers');
        const touched = run('tools/ci.sh', ['run', 'hermes-drift'], dir, env);
        expect(touched.status, touched.out).to.equal(1); // now it blocks
    });
});

describe('tools/ci.sh', function () {
    this.timeout(30000);
    const ci = (dir, args) => run('tools/ci.sh', args, dir);

    it('lists its static checks and test shards', function () {
        const r = ci(makeRepo(), ['list']);
        expect(r.status).to.equal(0);
        expect(r.out).to.match(/static checks:.*shellcheck.*secrets/);
        expect(r.out).to.match(/test shards:\s+core claudecraft shell/);
    });

    it('ignores CLAUDE_PLAN_*/CODEX_* from the caller\'s shell and says so', function () {
        const dir = makeRepo({ 'src/a.js': '1\n' });
        commitAll(dir);
        const r = run('tools/ci.sh', ['run', 'tracked-artifacts'], dir,
            { CLAUDE_PLAN_WORKTREE_GATE: '0', CODEX_SESSION: 'x', KEEP_ME: '1' });
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(/ignoring from your shell.*CLAUDE_PLAN_WORKTREE_GATE.*CODEX_SESSION/);
        expect(r.out).to.not.match(/KEEP_ME/);
    });

    it('runs under macOS\'s stock bash 3.2 (no bash-4-only syntax)', function () {
        const bash32 = '/bin/bash';
        if (!fs.existsSync(bash32) || !/version 3\./.test(run(bash32, ['--version'], os.tmpdir()).out)) this.skip();
        const dir = makeRepo({ 'src/a.js': '1\n' });
        commitAll(dir);
        const r = run(bash32, ['tools/ci.sh', 'run', 'tracked-artifacts', 'python-syntax'], dir);
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(/2 passed, 0 failed/);
    });

    it('exits 2 on an unknown command', function () {
        expect(ci(makeRepo(), ['frobnicate']).status).to.equal(2);
    });

    it('reports checks listed in CI_SKIP as SKIP rather than passing them silently', function () {
        const dir = makeRepo({ 'plugins/p/__pycache__/x.pyc': 'x' }); // would FAIL if it ran
        commitAll(dir);
        const r = run('tools/ci.sh', ['run', 'tracked-artifacts'], dir, { CI_SKIP: 'tracked-artifacts' });
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(/tracked-artifacts\s+SKIP/);
        expect(r.out).to.match(/0 passed, 0 failed, 1 skipped/);
    });

    it('rejects an unknown check name before launching any of the others', function () {
        const dir = makeRepo({ 'src/a.js': '1\n' });
        commitAll(dir);
        const r = ci(dir, ['run', 'tracked-artifacts', 'no-such-check']);
        expect(r.status).to.equal(2);
        expect(r.out).to.match(/unknown check or shard: no-such-check/);
        expect(fs.existsSync(path.join(dir, 'test-results', 'ci', 'tracked-artifacts.log'))).to.equal(false);
    });

    it('fails the run and names the check when generated files are tracked', function () {
        const dir = makeRepo({ 'plugins/p/__pycache__/x.cpython-312.pyc': 'x' });
        commitAll(dir);
        const r = ci(dir, ['run', 'tracked-artifacts']);
        expect(r.status).to.equal(1);
        expect(r.out).to.match(/tracked-artifacts\s+FAIL/);
        expect(r.out).to.match(/__pycache__/);
    });

    it('passes tracked-artifacts on a clean tree', function () {
        const dir = makeRepo({ 'src/a.js': '1\n' });
        commitAll(dir);
        const r = ci(dir, ['run', 'tracked-artifacts']);
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(/tracked-artifacts\s+PASS/);
    });

    it('rejects shipped Python that needs a newer interpreter than macOS ships (3.9)', function () {
        const dir = makeRepo({
            'plugins/p/handlers/new.py': 'match 1:\n    case 1:\n        pass\n',
        });
        commitAll(dir);
        const r = ci(dir, ['run', 'python-syntax']);
        expect(r.status, r.out).to.equal(1);
        expect(r.out).to.match(/FAIL plugins\/p\/handlers\/new\.py/);
    });

    it('accepts ordinary Python', function () {
        const dir = makeRepo({ 'plugins/p/handlers/ok.py': 'print("hi")\n' });
        commitAll(dir);
        expect(ci(dir, ['run', 'python-syntax']).status).to.equal(0);
    });

    it('scans only what the diff changed for secrets (CI_BASE)', function () {
        const dir = makeRepo({ 'src/old.js': `const k = "${FAKE_KEY}";\n` });
        const base = commitAll(dir, 'pre-existing leak');
        write(dir, { 'src/new.js': 'module.exports = 1;\n' });
        commitAll(dir, 'clean change');
        const r = run('tools/ci.sh', ['run', 'secrets'], dir, { CI_BASE: base });
        expect(r.status, r.out).to.equal(0); // old leak is outside the diff; GitHub secret scanning owns history
        write(dir, { 'src/new2.js': `const k = "${FAKE_KEY}";\n` });
        commitAll(dir, 'new leak');
        expect(run('tools/ci.sh', ['run', 'secrets'], dir, { CI_BASE: base }).status).to.equal(1);
    });
});
