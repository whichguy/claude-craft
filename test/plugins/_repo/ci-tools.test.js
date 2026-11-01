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

    it('does not treat every path containing "test" or "example" as a test file (that made the gate bypassable by name)', function () {
        const dir = makeRepo({
            'plugins/x/handlers/latest-session.js': `const k = "${FAKE_KEY}";\n`,
            'src/contest.js': `const k = "${FAKE_KEY}";\n`,
            'src/counterexample.js': `const k = "${FAKE_KEY}";\n`,
        });
        ['plugins/x/handlers/latest-session.js', 'src/contest.js', 'src/counterexample.js'].forEach((f) => {
            const r = run('tools/scan-secrets.sh', [f], dir);
            expect(r.status, f + '\n' + r.out).to.equal(1);
        });
    });

    it('still treats real test, fixture, doc and example paths as lenient', function () {
        const paths = ['test/a.js', 'src/tests/a.js', 'src/a.test.js', 'src/a.spec.ts', 'src/a_test.go', 'src/test_a.py',
            'test_a.py', 'fixtures/a.js', 'src/fixtures/a.js', 'docs/a.sh', 'examples/a.js', '.env.example', 'README.md', 'notes.txt'];
        const files = {};
        paths.forEach((p) => { files[p] = `x = "${FAKE_KEY}"\n`; });
        const dir = makeRepo(files);
        const r = run('tools/scan-secrets.sh', paths, dir);
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(new RegExp(`${paths.length} files, 0 blocking, ${paths.length} warning`));
    });

    it('keeps markdown under plugins/ strict: skills, agents and commands ARE the product', function () {
        const dir = makeRepo({
            'plugins/p/skills/s/SKILL.md': `use ${FAKE_KEY}\n`,
            'plugins/p/agents/a.md': `use ${FAKE_KEY}\n`,
            'docs/guide.md': `use ${FAKE_KEY}\n`,
            'README.md': `use ${FAKE_KEY}\n`,
            'plugins/p/tests/notes.md': `use ${FAKE_KEY}\n`,
        });
        ['plugins/p/skills/s/SKILL.md', 'plugins/p/agents/a.md'].forEach((f) => {
            const r = run('tools/scan-secrets.sh', [f], dir);
            expect(r.status, f + '\n' + r.out).to.equal(1);
        });
        const ok = run('tools/scan-secrets.sh', ['docs/guide.md', 'README.md', 'plugins/p/tests/notes.md'], dir);
        expect(ok.status, ok.out).to.equal(0); // docs, the README and a plugin's own tests may hold fakes
    });

    it('detects Google API keys that contain a hyphen (the engine used the range \\\\-_, which excludes "-")', function () {
        const key = 'AIza' + 'Sy-' + 'A'.repeat(32); // AIza + 35 chars, one of them "-"
        const dir = makeRepo({ 'src/g.js': `const k = "${key}";\n` });
        expect(run('tools/scan-secrets.sh', ['src/g.js'], dir).status).to.equal(1);
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

    it('scans a file that is renamed and edited in the same commit (git reports it as R, not A or M)', function () {
        const dir = hookRepo();
        write(dir, { 'src/old.js': Array.from({ length: 30 }, (_, i) => `const line${i} = ${i};`).join('\n') + '\n' });
        git(dir, 'add', 'src/old.js');
        expect(git(dir, 'commit', '-m', 'add').status).to.equal(0);
        git(dir, 'mv', 'src/old.js', 'src/new.js');
        fs.appendFileSync(path.join(dir, 'src', 'new.js'), `const k = "${FAKE_KEY}";\n`);
        git(dir, 'add', 'src/new.js');
        expect(git(dir, 'status', '--short').out).to.match(/^R/m); // precondition: this really is a rename
        const r = git(dir, 'commit', '-m', 'rename + secret');
        expect(r.status, r.out).to.not.equal(0);
        expect(r.out).to.match(/COMMIT BLOCKED/);
    });

    it('scans a file whose type changed (a symlink replaced by a regular file is T, neither A nor M)', function () {
        const dir = hookRepo();
        write(dir, { 'src/real.js': 'module.exports = 1;\n' });
        fs.symlinkSync('real.js', path.join(dir, 'src', 'link.js'));
        git(dir, 'add', '-A');
        expect(git(dir, 'commit', '-m', 'add a symlink').status).to.equal(0);
        fs.rmSync(path.join(dir, 'src', 'link.js'));
        fs.writeFileSync(path.join(dir, 'src', 'link.js'), `const k = "${FAKE_KEY}";\n`);
        git(dir, 'add', 'src/link.js');
        expect(git(dir, 'status', '--short').out).to.match(/^T/m); // precondition: this really is a type change
        const r = git(dir, 'commit', '-m', 'typechange + secret');
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

    it('ci.sh fails closed to strict when the base cannot be resolved (force-push: `before` is gone)', function () {
        const dir = repo();
        const base = commitAll(dir, 'base');
        write(dir, { 'docs/unrelated.md': 'x\n' });
        commitAll(dir, 'unrelated');
        const drifted = upstream(dir, 'bbb  plan-review-cleanup.py\n');
        // known base, handlers untouched → advisory
        expect(run('tools/ci.sh', ['run', 'hermes-drift'], dir, Object.assign({ CI_BASE: base }, drifted)).status).to.equal(0);
        // a base that was given but does not exist here → unknown → strict
        const r = run('tools/ci.sh', ['run', 'hermes-drift'], dir, Object.assign({ CI_BASE: 'deadbeef'.repeat(5) }, drifted));
        expect(r.status, r.out).to.equal(1);
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

    it('CI_SHARDS restricts which test shards run', function () {
        const dir = makeRepo({ 'src/a.js': '1\n' });
        commitAll(dir);
        const r = run('tools/ci.sh', ['test'], dir, { CI_SHARDS: 'core' }); // no node_modules here → core fails fast
        expect(r.status).to.equal(1);
        expect(r.out).to.match(/^core\s+FAIL/m);
        expect(r.out).to.not.match(/^claudecraft\s/m);
        expect(r.out).to.not.match(/^shell\s/m);
        expect(r.out).to.match(/0 passed, 1 failed/);
        expect(r.out).to.match(/CI_SHARDS='core' restricts the test shards/); // never silent: an exported CI_SHARDS must be visible
    });

    it('never inherits repository-local GIT_* variables (git exports GIT_DIR to hooks run from a linked worktree)', function () {
        const clean = makeRepo({ 'src/a.js': '1\n' });
        commitAll(clean);
        const other = makeRepo({ 'x/__pycache__/a.pyc': 'x' }); // a DIFFERENT repo that would FAIL tracked-artifacts
        commitAll(other);
        const r = run('tools/ci.sh', ['run', 'tracked-artifacts'], clean, { GIT_DIR: path.join(other, '.git') });
        expect(r.status, 'ci.sh looked at the repo named by the inherited GIT_DIR\n' + r.out).to.equal(0);
    });

    it('treats a shard that exits 77 as a FAILURE (mocha exits with its failure count; 77 is not a skip)', function () {
        const dir = makeRepo({ 'src/a.js': '1\n' });
        fs.mkdirSync(path.join(dir, 'node_modules', '.bin'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'node_modules', '.bin', 'mocha'), '', { mode: 0o755 });
        fs.mkdirSync(path.join(dir, 'fakebin'));
        fs.writeFileSync(path.join(dir, 'fakebin', 'npm'), '#!/bin/sh\nexit 77\n', { mode: 0o755 });
        const r = run('tools/ci.sh', ['test'], dir, { CI_SHARDS: 'core', PATH: path.join(dir, 'fakebin') + path.delimiter + process.env.PATH });
        expect(r.status, r.out).to.equal(1);
        expect(r.out).to.match(/^core\s+FAIL/m);
        expect(r.out).to.not.match(/^core\s+SKIP/m);
    });

    it('scans every commit in the range, not only the net diff (a key added then removed is still in the pushed history)', function () {
        const dir = makeRepo({ 'src/a.js': 'module.exports = 1;\n' });
        const base = commitAll(dir, 'base');
        write(dir, { 'src/leak.js': `const k = "${FAKE_KEY}";\n` });
        commitAll(dir, 'oops, committed a key');
        fs.rmSync(path.join(dir, 'src', 'leak.js'));
        commitAll(dir, 'removed it again');
        expect(git(dir, 'diff', '--name-only', base, 'HEAD').out.trim(), 'precondition: the net diff is empty').to.equal('');
        const r = run('tools/ci.sh', ['run', 'secrets'], dir, { CI_BASE: base });
        expect(r.status, r.out).to.equal(1);
        expect(r.out).to.match(/added in commit/);
    });

    it('fails closed when CI_BASE cannot be resolved: scans everything instead of guessing "the last commit"', function () {
        const dir = makeRepo({ 'src/old.js': `const k = "${FAKE_KEY}";\n` });
        commitAll(dir, 'old leak');
        write(dir, { 'src/new.js': '1\n' });
        commitAll(dir, 'clean');
        expect(run('tools/ci.sh', ['run', 'secrets'], dir).status, 'no CI_BASE: last commit only').to.equal(0);
        const r = run('tools/ci.sh', ['run', 'secrets'], dir, { CI_BASE: 'deadbeef'.repeat(5) });
        expect(r.status, r.out).to.equal(1);
        expect(r.out).to.match(/no usable base/);
    });

    describe('python-syntax floor', function () {
        const real39 = (() => {
            if (process.platform === 'darwin' && spawnSync('xcode-select', ['-p']).status !== 0) return false;
            const r = spawnSync('/usr/bin/python3', ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' });
            return r.status === 0 && r.stdout.trim() === '3.9';
        })();
        // ast.parse(feature_version=(3,9)) on a newer interpreter ACCEPTS PEP 701 nested same-quote f-strings
        (real39 ? it : it.skip)('rejects what a real Python 3.9 rejects but a newer interpreter\'s feature_version accepts', function () {
            const dir = makeRepo({ 'plugins/p/handlers/h.py': 'd = {"k": 1}\nprint(f"{d["k"]}")\n' });
            commitAll(dir);
            const r = run('tools/ci.sh', ['run', 'python-syntax'], dir);
            expect(r.status, r.out).to.equal(1);
            expect(r.out).to.match(/using a real Python 3\.9/);
        });
    });

    describe('pre-push phase', function () {
        const staticChecks = () => run('tools/ci.sh', ['list'], makeRepo()).out.match(/static checks:\s*(.*)/)[1];
        const prepush = (dir, base, env) => run('tools/ci.sh', ['pre-push', '--base', base], dir, Object.assign({ CI_SKIP: staticChecks() }, env));
        const shardsOf = (out) => (out.match(/pre-push: static checks \+ shards \[([^\]]*)\]/) || [])[1];
        const lay = (files) => {
            const dir = makeRepo(files);
            return { dir, base: commitAll(dir, 'base') };
        };

        it('still runs the static checks without node_modules, and says plainly that the tests were not run', function () {
            const { dir, base } = lay({ 'docs/a.md': 'a\n' });
            write(dir, { 'docs/a.md': 'b\n' });
            commitAll(dir, 'edit');
            const r = prepush(dir, base);
            expect(r.status, r.out).to.equal(0);
            expect(r.out).to.match(/static checks/i);
            expect(r.out).to.match(/node_modules missing, so test shards \[core\] were not run/);
        });

        it('selects only core for an unrelated change', function () {
            const { dir, base } = lay({ 'docs/a.md': 'a\n' });
            write(dir, { 'docs/a.md': 'b\n' });
            commitAll(dir, 'edit');
            expect(shardsOf(prepush(dir, base).out)).to.equal('core');
        });

        it('counts a DELETION under claudecraft (diff-filter ACMR hid it)', function () {
            const { dir, base } = lay({ 'plugins/claudecraft/skills/x/SKILL.md': 'x\n', 'docs/a.md': 'a\n' });
            fs.rmSync(path.join(dir, 'plugins', 'claudecraft', 'skills', 'x', 'SKILL.md'));
            commitAll(dir, 'delete');
            expect(shardsOf(prepush(dir, base).out)).to.equal('core claudecraft shell');
        });

        it('counts the SOURCE of a rename (only the destination used to be reported)', function () {
            const { dir, base } = lay({ 'plugins/planning-suite/handlers/a.py': 'x = 1\n' });
            fs.mkdirSync(path.join(dir, 'plugins', 'planning-suite', 'elsewhere'));
            git(dir, 'mv', 'plugins/planning-suite/handlers/a.py', 'plugins/planning-suite/elsewhere/a.py');
            commitAll(dir, 'move out of handlers');
            expect(shardsOf(prepush(dir, base).out)).to.match(/\bshell\b/);
        });

        it('runs everything when shared test infrastructure changes', function () {
            const { dir, base } = lay({ '.mocharc.json': '{}\n' });
            write(dir, { '.mocharc.json': '{"timeout": 1}\n' });
            commitAll(dir, 'config');
            expect(shardsOf(prepush(dir, base).out)).to.equal('core claudecraft shell');
        });
    });

    it('keeps the last run\'s logs in test-results/ci (each run works in a private directory meanwhile)', function () {
        const dir = makeRepo({ 'src/a.js': '1\n' });
        commitAll(dir);
        const r = run('tools/ci.sh', ['run', 'tracked-artifacts'], dir);
        expect(r.status, r.out).to.equal(0);
        expect(fs.existsSync(path.join(dir, 'test-results', 'ci', 'tracked-artifacts.log'))).to.equal(true);
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
