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
    expect(r.stderr + r.stdout).to.match(/conflict|rebase/i);
    expect(fs.existsSync(wt)).to.equal(true);
    // Mid-rebase kept so operator can resolve in worktree
    const rebaseMerge = git(wt, 'rev-parse', '--git-path', 'rebase-merge');
    const rebaseApply = git(wt, 'rev-parse', '--git-path', 'rebase-apply');
    const mid = fs.existsSync(rebaseMerge) || fs.existsSync(rebaseApply);
    expect(mid, 'expected mid-rebase state after conflict').to.equal(true);

    // Second reintegrate while mid-rebase → still exit 5, not silent success
    const r2 = runScript(['reintegrate', '--repo', repo, '--slug', 'cf']);
    expect(r2.status).to.equal(5);

    const d = runScript(['destroy', '--repo', repo, '--slug', 'cf']);
    expect(d.status).to.equal(7);
    expect(fs.existsSync(wt)).to.equal(true);

    const d2 = runScript(['destroy', '--repo', repo, '--slug', 'cf', '--force']);
    expect(d2.status, d2.stderr).to.equal(0);
    expect(fs.existsSync(wt)).to.equal(false);
  });

  it('reintegrate refuses dirty worktree (exit 6) before rebase', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'dirty']).status).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-dirty');
    fs.writeFileSync(path.join(wt, 'uncommitted.txt'), 'x\n');
    const r = runScript(['reintegrate', '--repo', repo, '--slug', 'dirty']);
    expect(r.status).to.equal(6);
    expect(r.stderr + r.stdout).to.match(/uncommitted|dirty/i);
  });

  it('continue after rebase conflict then reintegrate succeeds', function () {
    this.timeout(60000);
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'cont']).status).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-cont');

    fs.writeFileSync(path.join(wt, 'README.md'), '# worktree side\n');
    git(wt, 'add', 'README.md');
    git(wt, 'commit', '-m', 'wt change');

    fs.writeFileSync(path.join(repo, 'README.md'), '# launch side\n');
    git(repo, 'add', 'README.md');
    git(repo, 'commit', '-m', 'launch change');

    const r1 = runScript(['reintegrate', '--repo', repo, '--slug', 'cont']);
    expect(r1.status).to.equal(5);
    const rebaseMerge = git(wt, 'rev-parse', '--git-path', 'rebase-merge');
    const rebaseApply = git(wt, 'rev-parse', '--git-path', 'rebase-apply');
    expect(fs.existsSync(rebaseMerge) || fs.existsSync(rebaseApply)).to.equal(true);

    // Resolve non-interactively and continue rebase
    fs.writeFileSync(path.join(wt, 'README.md'), '# resolved both sides\n');
    git(wt, 'add', 'README.md');
    const cont = sh(wt, ['git', '-c', 'core.editor=true', 'rebase', '--continue'], {
      env: {
        GIT_EDITOR: 'true',
        EDITOR: 'true',
        VISUAL: 'true',
      },
    });
    expect(cont.status, cont.stderr + cont.stdout).to.equal(0);

    const r2 = runScript(['reintegrate', '--repo', repo, '--slug', 'cont']);
    expect(r2.status, r2.stderr + r2.stdout).to.equal(0);
    expect(fs.readFileSync(path.join(repo, 'README.md'), 'utf8')).to.match(/resolved both/);
  });

  it('S11a rebases onto concurrent source commits then S11b lands both on source', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'rb']).status).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-rb');

    // Worktree-only change
    fs.writeFileSync(path.join(wt, 'from-wt.txt'), 'wt\n');
    git(wt, 'add', 'from-wt.txt');
    git(wt, 'commit', '-m', 'improve-loop: iteration 1 — wt file');

    // Concurrent source change (disjoint path — rebase should be clean)
    fs.writeFileSync(path.join(repo, 'from-src.txt'), 'src\n');
    git(repo, 'add', 'from-src.txt');
    git(repo, 'commit', '-m', 'concurrent source change');

    const r = runScript(['reintegrate', '--repo', repo, '--slug', 'rb']);
    expect(r.status, r.stderr + r.stdout).to.equal(0);
    expect(fs.existsSync(path.join(repo, 'from-wt.txt'))).to.equal(true);
    expect(fs.existsSync(path.join(repo, 'from-src.txt'))).to.equal(true);
    // Linear-ish: source HEAD should be descendant of the concurrent commit
    const srcCommit = git(repo, 'log', '--oneline', '--grep', 'concurrent source');
    expect(srcCommit).to.match(/concurrent source/);
    const log = git(repo, 'log', '--oneline');
    expect(log).to.match(/wt file/);
    // After clean rebase+merge, main should not need an "improve/" branch
    expect(git(repo, 'branch', '--list', 'improve/rb')).to.equal('');
  });

  it('status prints --- summary --- with suggested_next', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'st']).status).to.equal(0);
    const r = runScript(['status', '--repo', repo, '--slug', 'st']);
    expect(r.status, r.stderr + r.stdout).to.equal(0);
    expect(r.stdout).to.match(/--- summary ---/);
    expect(r.stdout).to.match(/suggested_next=/);
    expect(r.stdout).to.match(/mid_rebase=/);
    expect(r.stdout).to.match(/worktree_exists=yes/);
  });

  it('reintegrate is idempotent when already ok', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'id']).status).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-id');
    fs.writeFileSync(path.join(wt, 'x.txt'), '1\n');
    git(wt, 'add', 'x.txt');
    git(wt, 'commit', '-m', 'work');
    expect(runScript(['reintegrate', '--repo', repo, '--slug', 'id']).status).to.equal(0);
    const r2 = runScript(['reintegrate', '--repo', repo, '--slug', 'id']);
    expect(r2.status, r2.stderr + r2.stdout).to.equal(0);
    expect(r2.stdout + r2.stderr).to.match(/already-complete|already complete/);
    expect(r2.stdout).to.match(/status=ok/);
  });

  it('no-merge reintegrate reports S11b=skipped not false merge claim', function () {
    const repo = makeRepo();
    expect(
      runScript(['create', '--repo', repo, '--slug', 'nm2', '--no-merge-to-launch']).status
    ).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-nm2');
    fs.writeFileSync(path.join(wt, 'y.txt'), 'y\n');
    git(wt, 'add', 'y.txt');
    git(wt, 'commit', '-m', 'work');
    const r = runScript(['reintegrate', '--repo', repo, '--slug', 'nm2']);
    expect(r.status, r.stderr + r.stdout).to.equal(0);
    expect(r.stdout).to.match(/S11b=skipped|merge_to_launch=false/);
    expect(r.stdout).to.not.match(/S11b=merged/);
    expect(fs.existsSync(path.join(repo, 'y.txt'))).to.equal(false);
  });

  it('destroy is idempotent when already destroyed', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'dd']).status).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-dd');
    fs.writeFileSync(path.join(wt, 'z.txt'), 'z\n');
    git(wt, 'add', 'z.txt');
    git(wt, 'commit', '-m', 'z');
    expect(runScript(['reintegrate', '--repo', repo, '--slug', 'dd']).status).to.equal(0);
    expect(runScript(['destroy', '--repo', repo, '--slug', 'dd']).status).to.equal(0);
    const d2 = runScript(['destroy', '--repo', repo, '--slug', 'dd']);
    expect(d2.status, d2.stderr + d2.stdout).to.equal(0);
    expect(d2.stdout + d2.stderr).to.match(/already-destroyed|already destroyed/);
  });

  it('destroy refuses worktree_dirty without --force', function () {
    const repo = makeRepo();
    expect(runScript(['create', '--repo', repo, '--slug', 'wd']).status).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-wd');
    fs.writeFileSync(path.join(wt, 'dirty.txt'), 'd\n');
    const r = runScript(['reintegrate', '--repo', repo, '--slug', 'wd']);
    expect(r.status).to.equal(6);
    expect(r.stderr).to.match(/worktree_dirty|worktree has uncommitted|blocked:worktree-dirty/);
    const d = runScript(['destroy', '--repo', repo, '--slug', 'wd']);
    expect(d.status).to.equal(7);
    expect(d.stderr).to.match(/refused|worktree_dirty|fix-or-force/);
    expect(fs.existsSync(wt)).to.equal(true);
    expect(runScript(['destroy', '--repo', repo, '--slug', 'wd', '--force']).status).to.equal(0);
  });

  it('recover after no-merge reintegrate keeps worktree (does not destroy tip)', function () {
    const repo = makeRepo();
    expect(
      runScript(['create', '--repo', repo, '--slug', 'nmr', '--no-merge-to-launch']).status
    ).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-nmr');
    fs.writeFileSync(path.join(wt, 'only-in-wt.txt'), 'secret-tip\n');
    git(wt, 'add', 'only-in-wt.txt');
    git(wt, 'commit', '-m', 'improve-loop: iteration 1 — tip only in worktree');

    const rec = runScript(['recover', '--repo', repo, '--slug', 'nmr']);
    expect(rec.status, rec.stderr + rec.stdout).to.equal(0);
    // Must NOT land on launch (merge_to_launch=false)
    expect(fs.existsSync(path.join(repo, 'only-in-wt.txt'))).to.equal(false);
    // Must NOT destroy worktree — only copy of commits
    expect(fs.existsSync(wt)).to.equal(true);
    expect(fs.readFileSync(path.join(wt, 'only-in-wt.txt'), 'utf8')).to.match(/secret-tip/);
    expect(rec.stdout + rec.stderr).to.match(/blocked:open-pr|open-pr|not on launch/i);
    expect(rec.stdout + rec.stderr).to.not.match(/worktree removed|already-destroyed/);

    // Default destroy without --force must also refuse while tip unmerged
    const d = runScript(['destroy', '--repo', repo, '--slug', 'nmr']);
    expect(d.status).to.equal(7);
    expect(fs.existsSync(wt)).to.equal(true);
    expect(d.stderr + d.stdout).to.match(/blocked:open-pr|not on launch|only copy/i);
  });

  it('recover --merge-to-launch after no-merge create merges tip then destroys', function () {
    const repo = makeRepo();
    expect(
      runScript(['create', '--repo', repo, '--slug', 'nmm', '--no-merge-to-launch']).status
    ).to.equal(0);
    const wt = path.join(repo, '.claude/worktrees/improve-nmm');
    fs.writeFileSync(path.join(wt, 'override-land.txt'), 'land-me\n');
    git(wt, 'add', 'override-land.txt');
    git(wt, 'commit', '-m', 'improve-loop: iteration 1 — override merge');

    // Override create-time no-merge: S11b must merge, then recover destroys worktree
    const rec = runScript([
      'recover',
      '--repo',
      repo,
      '--slug',
      'nmm',
      '--merge-to-launch',
    ]);
    expect(rec.status, rec.stderr + rec.stdout).to.equal(0);
    expect(fs.existsSync(path.join(repo, 'override-land.txt'))).to.equal(true);
    expect(fs.existsSync(wt)).to.equal(false);
    // Must not claim tip not on launch after successful override merge
    expect(rec.stdout + rec.stderr).to.not.match(/tip .* not on launch/);
    expect(rec.stdout + rec.stderr).to.match(/S11b=merged|status=ok/);
    // JSON should persist effective merge_to_launch=true after override merge
    const state = JSON.parse(
      fs.readFileSync(path.join(repo, '.git/improve-runs/nmm.json'), 'utf8')
    );
    expect(state.merge_to_launch).to.equal(true);
    expect(state.reintegrate_status).to.equal('ok');
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
