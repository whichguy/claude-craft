#!/usr/bin/env node
/**
 * worktree-enter.js — L3: cold-start (default) | optional --resume | migrate | discard
 *
 * Default product model: self-contained campaigns. A stale pointer/worktree is
 * discarded and a fresh worktree is created. Pass --resume only to re-enter an
 * existing pointer (crash recovery opt-in).
 *
 * Usage:
 *   node worktree-enter.js --repo <path> --target <text> \
 *        [--test-command <cmd>] [--discard-legacy] [--resume] [--json]
 *
 * Prints JSON:
 *   {
 *     mode: "cold-start"|"discard-stale-cold-start"|"resume"|"migrate"|
 *           "discard-cold-start"|"merge-back-only",
 *     workspace, launch, common_git, pointer, campaign_branch, launch_branch,
 *     notes: [], suggested_cwd
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
  classifyLaunchDirt,
  isTracked,
  errMsg,
  randomHex,
} = require('./lib-paths.js');

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    'usage: node worktree-enter.js --repo <path> --target <text> [--test-command <cmd>] [--discard-legacy] [--resume] [--json]'
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

/**
 * Best-effort remove a prior campaign's isolation (worktree + branch + pointer).
 * Used by default enter path so each /improve starts clean.
 */
function discardStaleCampaign(launch, commonGitDir, ptr, notes) {
  const slug = ptr.campaign_branch || ptr.worktree_path || 'unknown';
  notes.push('discarded-stale-campaign:' + slug);
  if (ptr.worktree_path && fs.existsSync(ptr.worktree_path)) {
    try {
      git(launch, ['worktree', 'remove', '--force', ptr.worktree_path]);
    } catch {
      try {
        git(launch, ['worktree', 'remove', ptr.worktree_path]);
      } catch {
        try {
          fs.rmSync(ptr.worktree_path, { recursive: true, force: true });
          notes.push('discard-worktree-rm-fallback');
        } catch {
          notes.push('discard-worktree-failed');
        }
      }
    }
  }
  if (ptr.campaign_branch) {
    try {
      git(launch, ['branch', '-D', ptr.campaign_branch]);
    } catch {
      notes.push('discard-branch-failed-or-missing');
    }
  }
  deletePointer(commonGitDir);
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

/**
 * Paths that block enter/migrate (real product dirt). Ambient runtime prefixes and
 * isolation plumbing (.gitignore, IMPROVE_LOOP.md, .worktrees/) are non-blocking.
 * Returns { code, ambient, isolation } for messaging.
 */
function classifyLaunch(launch) {
  return classifyLaunchDirt(porcelain(launch));
}

function coldStart(launch, commonGitDir, target, testCommand, notes) {
  // Do NOT write .gitignore on LAUNCH — that leaves launch dirty and blocks merge-back.
  // Ensure ignore line on WORKSPACE after worktree add so the campaign branch can commit it.
  const slug = stampSlug(target);
  let campaignBranch = 'improve/' + slug;
  let worktreePath = path.join(launch, '.worktrees', slug);

  // collision rare: append 4 hex once
  if (fs.existsSync(worktreePath)) {
    const extra = randomHex(4);
    campaignBranch = campaignBranch + '-' + extra;
    worktreePath = worktreePath + '-' + extra;
    notes.push('collision-retry-suffix=' + extra);
  }

  fs.mkdirSync(path.join(launch, '.worktrees'), { recursive: true });
  try {
    git(launch, ['worktree', 'add', '-b', campaignBranch, worktreePath, 'HEAD']);
  } catch (e) {
    console.error('worktree-enter: worktree add failed: ' + errMsg(e));
    process.exit(7);
  }

  const gi = ensureWorktreesGitignore(worktreePath);
  if (gi.changed) notes.push('gitignore-ensured-on-workspace');

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
const wantResume = has('--resume');
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
// Default: discard any stale pointer/worktree then cold-start (self-contained cycles).
// Opt-in --resume: re-enter existing pointer (crash recovery).
const ptr = readPointer(commonGitDir);
if (ptr) {
  if (!ptr.worktree_path || !isUnder(ptr.worktree_path, path.join(launch, '.worktrees'))) {
    // invalid pointer — clear and continue to cold-start
    deletePointer(commonGitDir);
    notes.push('invalid-pointer-cleared');
  } else if (wantResume && ptr.state === 'reintegrate_blocked') {
    mode = 'merge-back-only';
    workspace = ptr.worktree_path;
    campaign_branch = ptr.campaign_branch;
    launch_branch = ptr.launch_branch;
    notes.push('state=reintegrate_blocked');
  } else if (wantResume && fs.existsSync(ptr.worktree_path)) {
    try {
      git(ptr.worktree_path, ['rev-parse', '--is-inside-work-tree']);
      mode = 'resume';
      workspace = ptr.worktree_path;
      campaign_branch = ptr.campaign_branch;
      launch_branch = ptr.launch_branch;
    } catch {
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
  } else if (wantResume && ptr.campaign_branch) {
    try {
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
  } else if (wantResume) {
    deletePointer(commonGitDir);
    notes.push('invalid-pointer-cleared');
  } else {
    // Default product path: discard stale isolation, then cold-start below
    discardStaleCampaign(launch, commonGitDir, ptr, notes);
  }
}

// --resume only: if already inside a campaign worktree with ledger, re-bind pointer
if (!mode && wantResume) {
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
    const classified = classifyLaunch(launch);
    if (classified.ambient.length) {
      notes.push('ignored-ambient-dirt:' + classified.ambient.slice(0, 12).join(','));
    }
    if (classified.code.length) {
      const ambHint =
        classified.ambient_prefixes.length > 0
          ? ' (ambient prefixes non-blocking: ' +
            classified.ambient_prefixes.join(',') +
            '; override via IMPROVE_LOOP_AMBIENT_PREFIXES)'
          : ' (set IMPROVE_LOOP_AMBIENT_PREFIXES=cron/,wiki/ to ignore runtime paths)';
      console.error(
        'worktree-enter: launch code-dirty; cannot migrate/discard over: ' +
          classified.code.slice(0, 8).join(', ') +
          ambHint
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
  const discarded = notes.some((n) => String(n).startsWith('discarded-stale-campaign:'));
  const cs = coldStart(launch, commonGitDir, target, testCommand, notes);
  mode = discarded ? 'discard-stale-cold-start' : 'cold-start';
  workspace = cs.workspace;
  campaign_branch = cs.campaign_branch;
  launch_branch = cs.launch_branch;
  pointerPath = cs.pointer;
}

// Surface non-blocking ambient launch dirt for kickoff (never blocks cold-start).
{
  const launchClassified = classifyLaunch(launch);
  if (
    launchClassified.ambient.length &&
    !notes.some((n) => String(n).startsWith('ignored-ambient-dirt:'))
  ) {
    notes.push(
      'ignored-ambient-dirt:' + launchClassified.ambient.slice(0, 12).join(',')
    );
  }
}

// suggested_cwd: durable sticky target for host (LAUNCH), not WORKSPACE — agents should
// use subshells/(cd WORKSPACE && …) for work, not stick the session in the disposable tree.
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
  suggested_cwd: launch,
};

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(0);
