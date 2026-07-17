#!/usr/bin/env node
/**
 * worktree-enter.mjs — L3: cold-start | resume | migrate | discard for improve-loop
 *
 * Usage:
 *   node worktree-enter.mjs --repo <path> --target <text> \
 *        [--test-command <cmd>] [--discard-legacy] [--json]
 *
 * Prints JSON:
 *   {
 *     mode: "resume"|"cold-start"|"migrate"|"discard-cold-start"|"merge-back-only",
 *     workspace, launch, common_git, pointer, campaign_branch, launch_branch,
 *     notes: []
 *   }
 *
 * Exit codes:
 *   0 ok
 *   1 usage
 *   2 shell/git probe failure (caller should run shell-probe first)
 *   3 lock / concurrent start
 *   4 dirty launch (cannot migrate/discard over code dirt)
 *   5 tracked legacy ledger (operator must git rm)
 *   6 path-traversal / invalid pointer
 *   7 worktree create/repair failed
 *   8 bare repo
 *
 * Injectable: GIT_CMD, IMPROVE_LOOP_POINTER_DIR
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  git,
  resolveRepo,
  commonGit,
  launchRoot,
  pointerPaths,
  stampSlug,
  ensureWorktreesGitignore,
  isUnder,
  porcelain,
  isTracked,
} = require('./lib-paths.js');

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    'usage: node worktree-enter.mjs --repo <path> --target <text> [--test-command <cmd>] [--discard-legacy] [--json]'
  );
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] ?? null;
}

function has(name) {
  return process.argv.includes(name);
}

function writePointer(commonGitDir, obj) {
  const { base, pointer, lock } = pointerPaths(commonGitDir);
  // mkdir lock
  fs.mkdirSync(base, { recursive: true });
  try {
    fs.mkdirSync(lock);
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      console.error('worktree-enter: lock busy at ' + lock);
      process.exit(3);
    }
    throw e;
  }
  try {
    const tmp = pointer + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, pointer);
  } finally {
    try {
      fs.rmSync(lock, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  return pointer;
}

function readPointer(commonGitDir) {
  const { pointer } = pointerPaths(commonGitDir);
  if (!fs.existsSync(pointer)) return null;
  try {
    return JSON.parse(fs.readFileSync(pointer, 'utf8'));
  } catch {
    return null;
  }
}

function deletePointer(commonGitDir) {
  const { pointer } = pointerPaths(commonGitDir);
  if (fs.existsSync(pointer)) fs.unlinkSync(pointer);
}

function launchBranch(launch) {
  try {
    const detached = git(launch, ['symbolic-ref', '-q', 'HEAD']);
    // if symbolic-ref succeeds, on a branch
    return git(launch, ['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    return null;
  }
}

function codeDirtyLaunch(launch) {
  const paths = porcelain(launch);
  return paths.filter((p) => p !== 'IMPROVE_LOOP.md' && p !== '.gitignore');
}

function coldStart(launch, commonGitDir, target, testCommand, notes) {
  ensureWorktreesGitignore(launch);
  const slug = stampSlug(target);
  let campaignBranch = 'improve/' + slug;
  let worktreePath = path.join(launch, '.worktrees', slug);

  // collision rare: append 4 hex once
  if (fs.existsSync(worktreePath)) {
    const extra = require('./lib-paths.js').randomHex(4);
    campaignBranch = campaignBranch + '-' + extra;
    worktreePath = worktreePath + '-' + extra;
    notes.push('collision-retry-suffix=' + extra);
  }

  fs.mkdirSync(path.join(launch, '.worktrees'), { recursive: true });
  try {
    git(launch, ['worktree', 'add', '-b', campaignBranch, worktreePath, 'HEAD']);
  } catch (e) {
    console.error('worktree-enter: worktree add failed: ' + (e.stderr || e.message));
    process.exit(7);
  }

  const lb = launchBranch(launch);
  const head = git(launch, ['rev-parse', 'HEAD']);
  const ptr = {
    version: 1,
    state: 'active',
    launch_root: launch,
    launch_branch: lb,
    launch_head: head,
    campaign_branch: campaignBranch,
    worktree_path: worktreePath,
    target: target,
    test_command: testCommand || null,
    created_at: new Date().toISOString(),
    reintegrate_error: null,
  };
  writePointer(commonGitDir, ptr);
  return { workspace: worktreePath, campaign_branch: campaignBranch, launch_branch: lb, pointer: pointerPaths(commonGitDir).pointer };
}

function injectIsolation(ledgerText, launch, workspace, branch) {
  if (/^## Isolation\s*$/m.test(ledgerText)) return ledgerText;
  const block =
    '\n## Isolation\n' +
    `- **launch_root:** ${launch}\n` +
    `- **campaign_branch:** ${branch}\n` +
    `- **worktree_path:** ${workspace}\n`;
  // after header block before ## Backlog
  if (/^## Backlog/m.test(ledgerText)) {
    return ledgerText.replace(/^## Backlog/m, block + '\n## Backlog');
  }
  return ledgerText + block;
}

const repoArg = arg('--repo');
const target = arg('--target');
if (!repoArg || !target) usage('require --repo and --target');
const testCommand = arg('--test-command');
const discardLegacy = has('--discard-legacy');
const notes = [];

let repo;
try {
  repo = resolveRepo(repoArg);
} catch (e) {
  console.error('worktree-enter: resolve repo failed: ' + (e.message || e));
  process.exit(2);
}

let commonGitDir;
let launch;
try {
  commonGitDir = commonGit(repo);
  launch = launchRoot(commonGitDir);
  if (git(repo, ['rev-parse', '--is-bare-repository']) === 'true') {
    console.error('worktree-enter: bare repo refused');
    process.exit(8);
  }
  git(repo, ['worktree', 'list']);
} catch (e) {
  console.error('worktree-enter: git plumbing failed: ' + (e.message || e));
  process.exit(2);
}

const invokeRoot = git(repo, ['rev-parse', '--show-toplevel']);
let mode = null;
let workspace = null;
let campaign_branch = null;
let launch_branch = null;
let pointerPath = pointerPaths(commonGitDir).pointer;

// --- detection ---
const ptr = readPointer(commonGitDir);
if (ptr) {
  if (!ptr.worktree_path || !isUnder(ptr.worktree_path, path.join(launch, '.worktrees'))) {
    console.error('worktree-enter: pointer path-traversal or missing worktree_path');
    process.exit(6);
  }
  if (ptr.state === 'reintegrate_blocked') {
    mode = 'merge-back-only';
    workspace = ptr.worktree_path;
    campaign_branch = ptr.campaign_branch;
    launch_branch = ptr.launch_branch;
    notes.push('state=reintegrate_blocked');
  } else if (fs.existsSync(ptr.worktree_path)) {
    try {
      git(ptr.worktree_path, ['rev-parse', '--is-inside-work-tree']);
      mode = 'resume';
      workspace = ptr.worktree_path;
      campaign_branch = ptr.campaign_branch;
      launch_branch = ptr.launch_branch;
    } catch {
      // fall through to repair
      try {
        git(launch, ['worktree', 'add', ptr.worktree_path, ptr.campaign_branch]);
        mode = 'resume';
        workspace = ptr.worktree_path;
        campaign_branch = ptr.campaign_branch;
        launch_branch = ptr.launch_branch;
        notes.push('repaired-worktree');
      } catch (e) {
        console.error('worktree-enter: repair failed: ' + (e.message || e));
        process.exit(7);
      }
    }
  } else if (ptr.campaign_branch) {
    try {
      // does ref exist?
      git(launch, ['rev-parse', '--verify', ptr.campaign_branch]);
      git(launch, ['worktree', 'add', ptr.worktree_path, ptr.campaign_branch]);
      mode = 'resume';
      workspace = ptr.worktree_path;
      campaign_branch = ptr.campaign_branch;
      launch_branch = ptr.launch_branch;
      notes.push('repaired-missing-dir');
    } catch {
      deletePointer(commonGitDir);
      notes.push('stale-pointer-cleared');
    }
  } else {
    deletePointer(commonGitDir);
    notes.push('invalid-pointer-cleared');
  }
}

if (!mode) {
  // invoke inside worktree with ledger
  const underWt = isUnder(invokeRoot, path.join(launch, '.worktrees'));
  const ledgerHere = path.join(invokeRoot, 'IMPROVE_LOOP.md');
  if (underWt && fs.existsSync(ledgerHere)) {
    let branch;
    try {
      branch = git(invokeRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
    } catch {
      branch = null;
    }
    if (branch && branch.startsWith('improve/')) {
      mode = 'resume';
      workspace = invokeRoot;
      campaign_branch = branch;
      launch_branch = launchBranch(launch);
      writePointer(commonGitDir, {
        version: 1,
        state: 'active',
        launch_root: launch,
        launch_branch,
        launch_head: git(launch, ['rev-parse', 'HEAD']),
        campaign_branch,
        worktree_path: workspace,
        target,
        test_command: testCommand || null,
        created_at: new Date().toISOString(),
        reintegrate_error: null,
      });
      notes.push('repaired-pointer-from-invoke-root');
    }
  }
}

if (!mode) {
  const launchLedger = path.join(launch, 'IMPROVE_LOOP.md');
  if (fs.existsSync(launchLedger)) {
    const dirty = codeDirtyLaunch(launch);
    if (dirty.length) {
      console.error(
        'worktree-enter: launch code-dirty; cannot migrate/discard over: ' +
          dirty.slice(0, 8).join(', ')
      );
      process.exit(4);
    }

    const ledgerText = fs.readFileSync(launchLedger, 'utf8');
    const statusMatch = ledgerText.match(/\*\*Status:\*\*\s*(.+)/);
    const status = (statusMatch ? statusMatch[1] : '').trim();
    const hasLog = /^### Iteration /m.test(ledgerText);
    const tracked = isTracked(launch, 'IMPROVE_LOOP.md');

    let doDiscard = discardLegacy;
    if (
      status.startsWith('complete') ||
      status.startsWith('stopped') ||
      (!hasLog && !tracked)
    ) {
      doDiscard = true;
    }

    if (tracked) {
      console.error(
        'worktree-enter: tracked launch IMPROVE_LOOP.md — operator must git rm / commit; refusing auto migrate/discard'
      );
      process.exit(5);
    }

    if (doDiscard) {
      fs.unlinkSync(launchLedger);
      notes.push('discarded-legacy-launch-ledger');
      const cs = coldStart(launch, commonGitDir, target, testCommand, notes);
      mode = 'discard-cold-start';
      workspace = cs.workspace;
      campaign_branch = cs.campaign_branch;
      launch_branch = cs.launch_branch;
      pointerPath = cs.pointer;
    } else {
      // migrate
      const cs = coldStart(launch, commonGitDir, target, testCommand, notes);
      const migrated = injectIsolation(
        ledgerText,
        launch,
        cs.workspace,
        cs.campaign_branch
      );
      fs.writeFileSync(path.join(cs.workspace, 'IMPROVE_LOOP.md'), migrated, 'utf8');
      fs.unlinkSync(launchLedger);
      mode = 'migrate';
      workspace = cs.workspace;
      campaign_branch = cs.campaign_branch;
      launch_branch = cs.launch_branch;
      pointerPath = cs.pointer;
      notes.push('migrated-legacy-launch-ledger');
    }
  }
}

if (!mode) {
  const cs = coldStart(launch, commonGitDir, target, testCommand, notes);
  mode = 'cold-start';
  workspace = cs.workspace;
  campaign_branch = cs.campaign_branch;
  launch_branch = cs.launch_branch;
  pointerPath = cs.pointer;
}

const out = {
  mode,
  workspace,
  launch,
  common_git: commonGitDir,
  pointer: pointerPath,
  campaign_branch,
  launch_branch,
  target,
  test_command: testCommand || null,
  notes,
};

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(0);
