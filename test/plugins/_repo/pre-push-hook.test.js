const { expect } = require('chai');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Behavioural test of .githooks/pre-push against a real bare remote. tools/ci.sh is replaced by a
// stub that records its arguments and exits with $STUB_RC, so this tests only the hook's own
// decisions: when it runs CI, what base it passes, and when it lets a push through or blocks it.

const REPO_ROOT = path.resolve(__dirname, '../../..');
const created = [];
after(() => created.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

function run(cmd, args, cwd, extraEnv) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-home-'));
    created.push(home);
    const env = Object.assign({
        PATH: process.env.PATH, HOME: home, LANG: 'C', GIT_CONFIG_NOSYSTEM: '1',
        GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com',
        GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com',
    }, extraEnv || {});
    const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8' });
    return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const git = (dir, ...a) => run('git', a, dir);

function setup() {
    const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-remote-'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-repo-'));
    created.push(remote, dir);
    git(remote, 'init', '-q', '--bare');
    git(dir, 'init', '-q');
    git(dir, 'checkout', '-q', '-b', 'main');
    git(dir, 'remote', 'add', 'origin', remote);

    fs.mkdirSync(path.join(dir, 'tools'));
    fs.writeFileSync(path.join(dir, 'tools', 'ci.sh'),
        '#!/bin/bash\necho "$@" > "$(dirname "$0")/../ci-args.txt"\nexit "${STUB_RC:-0}"\n', { mode: 0o755 });
    fs.mkdirSync(path.join(dir, 'node_modules', '.bin'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', '.bin', 'mocha'), '', { mode: 0o755 });
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\nci-args.txt\n');
    fs.mkdirSync(path.join(dir, '.githooks'));
    fs.copyFileSync(path.join(REPO_ROOT, '.githooks', 'pre-push'), path.join(dir, '.githooks', 'pre-push'));
    fs.chmodSync(path.join(dir, '.githooks', 'pre-push'), 0o755);
    git(dir, 'config', 'core.hooksPath', '.githooks');
    return { dir, remote };
}

const commit = (dir, file, msg) => {
    fs.writeFileSync(path.join(dir, file), msg + '\n');
    git(dir, 'add', '-A');
    expect(git(dir, 'commit', '-q', '-m', msg).status).to.equal(0);
    return git(dir, 'rev-parse', 'HEAD').out.trim();
};
const args = (dir) => {
    const f = path.join(dir, 'ci-args.txt');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : null;
};
const remoteHead = (remote, ref) => git(remote, 'rev-parse', '--verify', '-q', ref).out.trim();

describe('.githooks/pre-push', function () {
    this.timeout(30000);

    it('runs tools/ci.sh pre-push with no base on the very first push', function () {
        const { dir } = setup();
        commit(dir, 'a.txt', 'first');
        const r = git(dir, 'push', '-q', '-u', 'origin', 'main');
        expect(r.status, r.out).to.equal(0);
        expect(args(dir)).to.equal('pre-push');
    });

    it('passes the remote tip as --base when updating an existing branch', function () {
        const { dir, remote } = setup();
        commit(dir, 'a.txt', 'first');
        git(dir, 'push', '-q', '-u', 'origin', 'main');
        const tip = remoteHead(remote, 'main');
        commit(dir, 'b.txt', 'second');
        const r = git(dir, 'push', '-q');
        expect(r.status, r.out).to.equal(0);
        expect(args(dir)).to.equal(`pre-push --base ${tip}`);
    });

    it('diffs a NEW branch from where it forked off origin/main', function () {
        const { dir } = setup();
        const forkPoint = commit(dir, 'a.txt', 'first');
        git(dir, 'push', '-q', '-u', 'origin', 'main');
        git(dir, 'checkout', '-q', '-b', 'topic');
        commit(dir, 'b.txt', 'on topic');
        const r = git(dir, 'push', '-q', '-u', 'origin', 'topic');
        expect(r.status, r.out).to.equal(0);
        expect(args(dir)).to.equal(`pre-push --base ${forkPoint}`);
    });

    it('blocks the push when local CI fails, and the remote does not move', function () {
        const { dir, remote } = setup();
        commit(dir, 'a.txt', 'first');
        git(dir, 'push', '-q', '-u', 'origin', 'main');
        const before = remoteHead(remote, 'main');
        commit(dir, 'b.txt', 'second');
        const r = run('git', ['push'], dir, { STUB_RC: '1' });
        expect(r.status).to.not.equal(0);
        expect(r.out).to.match(/PUSH BLOCKED/);
        expect(remoteHead(remote, 'main')).to.equal(before);
    });

    it('SKIP_PREPUSH=1 skips CI entirely', function () {
        const { dir } = setup();
        commit(dir, 'a.txt', 'first');
        const r = run('git', ['push', '-q', '-u', 'origin', 'main'], dir, { SKIP_PREPUSH: '1', STUB_RC: '1' });
        expect(r.status, r.out).to.equal(0);
        expect(args(dir)).to.equal(null);
    });

    it('does not gate a push of a ref that is not checked out (it cannot test what it does not have)', function () {
        const { dir } = setup();
        commit(dir, 'a.txt', 'first');
        git(dir, 'push', '-q', '-u', 'origin', 'main');
        git(dir, 'checkout', '-q', '-b', 'other');
        commit(dir, 'b.txt', 'only on other');
        git(dir, 'checkout', '-q', 'main'); // HEAD is now a different commit from `other`
        fs.rmSync(path.join(dir, 'ci-args.txt'), { force: true });
        const r = run('git', ['push', '-q', 'origin', 'other'], dir, { STUB_RC: '1' });
        expect(r.status, r.out).to.equal(0);
        expect(args(dir)).to.equal(null);
    });

    it('does gate another ref when it points at the checked-out commit (the working tree IS what is pushed)', function () {
        const { dir } = setup();
        commit(dir, 'a.txt', 'first');
        git(dir, 'push', '-q', '-u', 'origin', 'main');
        git(dir, 'branch', 'alias'); // same commit as HEAD
        const r = run('git', ['push', '-q', 'origin', 'alias'], dir, { STUB_RC: '1' });
        expect(r.status).to.not.equal(0);
        expect(r.out).to.match(/PUSH BLOCKED/);
    });

    it('does not gate deleting a remote branch', function () {
        const { dir, remote } = setup();
        commit(dir, 'a.txt', 'first');
        git(dir, 'push', '-q', '-u', 'origin', 'main');
        git(dir, 'push', '-q', 'origin', 'main:scratch');
        fs.rmSync(path.join(dir, 'ci-args.txt'), { force: true });
        const r = run('git', ['push', '-q', 'origin', '--delete', 'scratch'], dir, { STUB_RC: '1' });
        expect(r.status, r.out).to.equal(0);
        expect(remoteHead(remote, 'scratch')).to.equal('');
    });

    it('skips (does not fail) when dependencies are not installed', function () {
        const { dir } = setup();
        commit(dir, 'a.txt', 'first');
        fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true });
        const r = run('git', ['push', '-q', '-u', 'origin', 'main'], dir, { STUB_RC: '1' });
        expect(r.status, r.out).to.equal(0);
        expect(r.out).to.match(/node_modules missing/);
        expect(args(dir)).to.equal(null);
    });
});
