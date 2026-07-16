'use strict';

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(
  REPO_ROOT,
  'plugins/claudecraft/tools/improve-worktree.sh'
);

function sh(cwd, args, opts = {}) {
  const r = spawnSync(args[0], args.slice(1), {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@test',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@test',
      ...(opts.env || {}),
    },
  });
  return r;
}

function git(cwd, ...args) {
  const r = sh(cwd, ['git', ...args]);
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
  }
  return (r.stdout || '').trim();
}

function runScript(args, opts = {}) {
  return sh(opts.cwd || process.cwd(), ['bash', SCRIPT, ...args], opts);
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'improve-wt-'));
  git(dir, 'init');
  git(dir, 'checkout', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n');
  git(dir, 'add', 'README.md');
  git(dir, 'commit', '-m', 'init');
  return dir;
}

describe('improve-worktree.sh', function () {
  this.timeout(30000);

  it('script exists and -h prints usage', function () {
    expect(fs.existsSync(SCRIPT)).to.equal(true);
    const empty = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });
    expect(empty.status).to.equal(1);
    expect(empty.stderr + empty.stdout).to.match(/create/);
  });

  it('create → detached worktree; no improve/* branch; merge_to_launch defaults true', function () {
    const repo = makeRepo();
    const r = runScript(['create', '--repo', repo, '--slug', 't1']);
    expect(r.status, r.stderr).to.equal(0);
    expect(r.stdout + r.stderr).to.match(/isolation=detached/);
    const wt = path.join(repo, '.claude/worktrees/improve-t1');
    expect(fs.existsSync(wt)).to.equal(true);
    const index = path.join(repo, '.git/improve-runs/t1.json');
    expect(fs.existsSync(index)).to.equal(true);
    const state = JSON.parse(fs.readFileSync(index, 'utf8'));
    expect(state.slug).to.equal('t1');
    expect(state.isolation).to.equal('detached');
    expect(state.improve_branch).to.equal('');
    expect(state.launch_branch).to.equal('main');
    expect(state.merge_to_launch).to.equal(true);
    expect(fs.realpathSync(state.worktree_path)).to.equal(fs.realpathSync(wt));
    // No permanent improve/* branch
    expect(git(repo, 'branch', '--list', 'improve/t1')).to.equal('');
    // Worktree is detached
    expect(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD')).to.equal('HEAD');
  });

  it('create --no-merge-to-launch; reintegrate does not land tip on launch', function () {
    const repo = makeRepo();
    expect(
      runScript(['create', '--repo', repo, '--slug', 'nom', '--no-merge-to-launch']).status
    ).to.equal(0);
    const state = JSON.parse(
      fs.readFileSync(path.join(repo, '.git/improve-runs/nom.json'), 'utf8')
    );
    expect(state.merge_to_launch).to.equal(false);

    const wt = path.join(repo, '.claude/worktrees/improve-nom');
    fs.writeFileSync(path.join(wt, 'only-wt.txt'), 'w\n');
    git(wt, 'add', 'only-wt.txt');
    git(wt, 'commit', '-m', 'improve-loop: iteration 1 — wt only');

    const r = runScript(['reintegrate', '--repo', repo, '--slug', 'nom']);
    expect(r.status, r.stderr + r.stdout).to.equal(0);
    expect(r.stdout + r.stderr).to.match(/merge_to_launch=false|NOT merged/);
    expect(fs.existsSync(path.join(repo, 'only-wt.txt'))).to.equal(false);
  });

  it('reintegrate merges detached tip into source branch without named improve branch', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'def']).status).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-def');
    fs.writeFileSync(path.join(wt, 'auto.txt'), 'a\n');
    git(wt, 'add', 'auto.txt');
    git(wt, 'commit', '-m', 'improve-loop: iteration 1 — auto merge');

    const r = runScript(['reintegrate', '--repo', repo, '--slug', 'def']);
    expect(r.status, r.stderr + r.stdout).to.equal(0);
    expect(fs.existsSync(path.join(repo, 'auto.txt'))).to.equal(true);
    // Still on main; history includes the improve commit subject
    expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).to.equal('main');
    expect(git(repo, 'log', '--oneline')).to.match(/auto merge/);
    expect(git(repo, 'branch', '--list', 'improve/def')).to.equal('');
  });

  it('refuses second create while improve worktree active (exit 9)', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'a']).status).to.equal(0);
    const r = runScript(['create', '--repo', repo, '--slug', 'b']);
    expect(r.status).to.equal(9);
  });

  it('carry imports tracked + untracked (not .env if ignored) and bootstraps commit', function () {
    const repo = makeRepo();
    fs.writeFileSync(path.join(repo, '.gitignore'), '.env\n');
    git(repo, 'add', '.gitignore');
    git(repo, 'commit', '-m', 'gitignore');

    expect(runScript(['create', '--repo', repo, '--slug', 'c1']).status).to.equal(0);

    fs.writeFileSync(path.join(repo, 'README.md'), '# demo\nchanged\n');
    fs.writeFileSync(path.join(repo, 'new-file.txt'), 'hello\n');
    fs.writeFileSync(path.join(repo, '.env'), 'SECRET=1\n');

    const r = runScript(['carry', '--repo', repo, '--slug', 'c1']);
    expect(r.status, r.stderr + r.stdout).to.equal(0);

    const wt = path.join(repo, '.claude/worktrees/improve-c1');
    expect(fs.readFileSync(path.join(wt, 'README.md'), 'utf8')).to.match(/changed/);
    expect(fs.existsSync(path.join(wt, 'new-file.txt'))).to.equal(true);
    expect(fs.existsSync(path.join(wt, '.env'))).to.equal(false);

    const log = git(wt, 'log', '-1', '--pretty=%s');
    expect(log).to.equal('improve-loop: bootstrap — carry WIP from launch');
    expect(git(wt, 'status', '--porcelain')).to.equal('');
  });

  it('reintegrate + destroy lands on source branch and removes worktree only', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'm1']).status).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-m1');
    fs.writeFileSync(path.join(wt, 'feature.txt'), 'x\n');
    git(wt, 'add', 'feature.txt');
    git(wt, 'commit', '-m', 'improve-loop: iteration 1 — feature');

    const r = runScript(['reintegrate', '--repo', repo, '--slug', 'm1']);
    expect(r.status, r.stderr + r.stdout).to.equal(0);
    expect(fs.existsSync(path.join(repo, 'feature.txt'))).to.equal(true);

    const d = runScript(['destroy', '--repo', repo, '--slug', 'm1']);
    expect(d.status, d.stderr + d.stdout).to.equal(0);
    expect(fs.existsSync(wt)).to.equal(false);
    expect(git(repo, 'branch', '--list', 'improve/m1')).to.equal('');
    expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).to.equal('main');
  });

  it('destroy refuses after reintegrate conflict without --force; keeps worktree', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'cf']).status).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-cf');

    fs.writeFileSync(path.join(wt, 'README.md'), '# worktree side\n');
    git(wt, 'add', 'README.md');
    git(wt, 'commit', '-m', 'wt change');

    fs.writeFileSync(path.join(repo, 'README.md'), '# launch side\n');
    git(repo, 'add', 'README.md');
    git(repo, 'commit', '-m', 'launch change');

    const r = runScript(['reintegrate', '--repo', repo, '--slug', 'cf']);
    expect(r.status).to.equal(5);
    expect(fs.existsSync(wt)).to.equal(true);

    const d = runScript(['destroy', '--repo', repo, '--slug', 'cf']);
    expect(d.status).to.equal(7);
    expect(fs.existsSync(wt)).to.equal(true);

    const d2 = runScript(['destroy', '--repo', repo, '--slug', 'cf', '--force']);
    expect(d2.status, d2.stderr).to.equal(0);
    expect(fs.existsSync(wt)).to.equal(false);
  });

  it('recover reintegrates into source branch and destroys unless --keep-worktree', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'k1']).status).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-k1');
    fs.writeFileSync(path.join(wt, 'x.txt'), '1\n');
    git(wt, 'add', 'x.txt');
    git(wt, 'commit', '-m', 'work');

    const keep = runScript([
      'recover',
      '--repo',
      repo,
      '--slug',
      'k1',
      '--keep-worktree',
    ]);
    expect(keep.status, keep.stderr + keep.stdout).to.equal(0);
    expect(fs.existsSync(path.join(repo, 'x.txt'))).to.equal(true);
    expect(fs.existsSync(wt)).to.equal(true);

    const gone = runScript(['recover', '--repo', repo, '--slug', 'k1']);
    expect(gone.status, gone.stderr + gone.stdout).to.equal(0);
    expect(fs.existsSync(wt)).to.equal(false);
  });
});
