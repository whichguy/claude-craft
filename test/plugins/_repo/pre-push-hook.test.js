const { expect } = require('chai');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Behavioural test of .githooks/pre-push against a real bare remote. tools/ci.sh is replaced by a
// stub that records its arguments and a few facts about the environment it was given, then
// behaves like a hostile test fixture (it builds a throwaway repo and commits to it). That tests
// the hook's own decisions: when it runs CI, which base and which checkout it hands over, what
// git environment it leaks, and when it lets a push through or blocks it.

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
        // the stub runs from a throwaway checkout, so it reports through absolute paths
        CI_ARGS_FILE: path.join(cwd, 'ci-args.txt'),
    }, extraEnv || {});
    const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8' });
    return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const git = (dir, ...a) => run('git', a, dir);

const STUB = `#!/bin/bash
out="\${CI_ARGS_FILE:?}"
echo "$@" > "$out"
here="$(cd "$(dirname "$0")/.." && pwd -P)"
{
  echo "pwd=$here"
  echo "marker=$(cat "$here/marker.txt" 2>/dev/null)"
  [ -e "$here/forgot.txt" ] && echo "forgot=present" || echo "forgot=absent"
  echo "gitvars=$(env | grep -E '^GIT_(DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|PREFIX|OBJECT_DIRECTORY)=' | cut -d= -f1 | sort | tr '\\n' ' ')"
} > "$out.facts"
mkdir -p "$here/test-results/ci" && echo "log from the scratch checkout" > "$here/test-results/ci/core.log"
# behave like a test that builds a throwaway repo: if git env leaked in, this lands in the REAL repo
t=$(mktemp -d); ( cd "$t" && git init -q && echo x > f && git add -A && git -c user.name=fx -c user.email=fx@example.com commit -q -m FIXTURE-FROM-TEST ) >/dev/null 2>&1
exit "\${STUB_RC:-0}"
`;

function setup() {
    const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-remote-'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-repo-'));
    created.push(remote, dir);
    git(remote, 'init', '-q', '--bare');
    git(dir, 'init', '-q');
    git(dir, 'checkout', '-q', '-b', 'main');
    git(dir, 'remote', 'add', 'origin', remote);

    fs.mkdirSync(path.join(dir, 'tools'));
    fs.writeFileSync(path.join(dir, 'tools', 'ci.sh'), STUB, { mode: 0o755 });
    fs.mkdirSync(path.join(dir, 'node_modules', '.bin'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', '.bin', 'mocha'), '', { mode: 0o755 });
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\nci-args.txt*\ntest-results/\n'); // like the real repo
    fs.writeFileSync(path.join(dir, 'marker.txt'), 'committed\n');
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
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : null);
const args = (dir) => read(path.join(dir, 'ci-args.txt'));
const facts = (dir) => read(path.join(dir, 'ci-args.txt.facts'));
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

    it('keeps the logs of a failed run (the scratch checkout that produced them is deleted)', function () {
        const { dir } = setup();
        commit(dir, 'a.txt', 'first');
        const r = run('git', ['push', '-q', '-u', 'origin', 'main'], dir, { STUB_RC: '1' });
        expect(r.status).to.not.equal(0);
        expect(r.out).to.match(/logs: test-results\/prepush/);
        expect(read(path.join(dir, 'test-results', 'prepush', 'core.log'))).to.equal('log from the scratch checkout');
    });

    it('SKIP_PREPUSH=1 skips CI entirely', function () {
        const { dir } = setup();
        commit(dir, 'a.txt', 'first');
        const r = run('git', ['push', '-q', '-u', 'origin', 'main'], dir, { SKIP_PREPUSH: '1', STUB_RC: '1' });
        expect(r.status, r.out).to.equal(0);
        expect(args(dir)).to.equal(null);
    });

    it('does not gate a push of a commit that is not checked out (it cannot test what it does not have)', function () {
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

    it('does gate another ref when it points at the checked-out commit (that IS what gets tested)', function () {
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

    it('still hands over to ci.sh when dependencies are not installed (ci.sh decides what to skip)', function () {
        const { dir } = setup();
        commit(dir, 'a.txt', 'first');
        fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true });
        const r = git(dir, 'push', '-q', '-u', 'origin', 'main');
        expect(r.status, r.out).to.equal(0);
        expect(args(dir)).to.equal('pre-push');
    });

    describe('what it tests', function () {
        it('is the pushed commit in a clean checkout, not the working tree', function () {
            const { dir } = setup();
            commit(dir, 'a.txt', 'first');
            fs.writeFileSync(path.join(dir, 'marker.txt'), 'dirty, never committed\n'); // uncommitted edit
            const r = git(dir, 'push', '-q', '-u', 'origin', 'main');
            expect(r.status, r.out).to.equal(0);
            expect(facts(dir)).to.match(/^marker=committed$/m);
        });

        it('does not see untracked files, so a forgotten `git add` fails here exactly as it will in CI', function () {
            const { dir } = setup();
            commit(dir, 'a.txt', 'first');
            fs.writeFileSync(path.join(dir, 'forgot.txt'), 'needed by the pushed commit but never added\n');
            git(dir, 'push', '-q', '-u', 'origin', 'main');
            expect(facts(dir)).to.match(/^forgot=absent$/m);
        });

        it('runs from a throwaway checkout and leaves no worktree behind', function () {
            const { dir } = setup();
            commit(dir, 'a.txt', 'first');
            git(dir, 'push', '-q', '-u', 'origin', 'main');
            const ranIn = (facts(dir).match(/^pwd=(.*)$/m) || [])[1];
            expect(ranIn).to.be.a('string').and.not.equal(fs.realpathSync(dir));
            expect(fs.existsSync(ranIn), 'the scratch checkout must be removed').to.equal(false);
            expect(git(dir, 'worktree', 'list').out.trim().split('\n')).to.have.length(1);
        });
    });

    describe('git environment (git exports GIT_DIR to hooks run from a linked worktree)', function () {
        function linked(dir) {
            const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-linked-'));
            created.push(wt);
            fs.rmSync(wt, { recursive: true });
            expect(git(dir, 'worktree', 'add', '-q', wt, '-b', 'feature').status).to.equal(0);
            return wt;
        }

        it('hands ci.sh no repository-local GIT_* variables', function () {
            const { dir } = setup();
            commit(dir, 'a.txt', 'first');
            git(dir, 'push', '-q', '-u', 'origin', 'main');
            const wt = linked(dir);
            commit(wt, 'b.txt', 'on the linked worktree');
            const r = git(wt, 'push', '-q', '-u', 'origin', 'feature');
            expect(r.status, r.out).to.equal(0);
            expect(facts(wt)).to.match(/^gitvars=\s*$/m);
        });

        it('cannot let a test fixture write into the real repository (reproduced: it committed onto the pushed branch)', function () {
            const { dir, remote } = setup();
            commit(dir, 'a.txt', 'first');
            git(dir, 'push', '-q', '-u', 'origin', 'main');
            const wt = linked(dir);
            const mine = commit(wt, 'b.txt', 'my real change');
            const r = git(wt, 'push', '-q', '-u', 'origin', 'feature');
            expect(r.status, r.out).to.equal(0);
            expect(git(wt, 'log', '-1', '--format=%s').out.trim(), 'a FIXTURE commit landed on the branch').to.equal('my real change');
            expect(git(wt, 'rev-parse', 'HEAD').out.trim()).to.equal(mine);
            expect(remoteHead(remote, 'feature')).to.equal(mine);
            expect(git(wt, 'status', '--short').out.trim(), 'the worktree was rewritten').to.equal('');
        });
    });
});
