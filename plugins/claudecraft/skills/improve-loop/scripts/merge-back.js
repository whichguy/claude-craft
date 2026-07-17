#!/usr/bin/env node
/**
 * merge-back.js — L3: end-of-campaign FF merge into launch + teardown
 *
 * Usage:
 *   node merge-back.js --repo <path> [--json]
 *
 * Reads pointer; requires state active or reintegrate_blocked and terminal land
 * is the caller's responsibility (skill Phase 5). This script only does FF + teardown.
 *
 * Exit codes:
 *   0 ok (merge + teardown) or skipped (no launch_branch) with reintegrate_blocked set
 *   1 usage
 *   2 no pointer
 *   3 launch dirty
 *   4 ff-only merge failed (sets reintegrate_blocked)
 *   5 git error
 *
 * Injectable: GIT_CMD
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
  porcelain,
  errMsg,
} = require('./lib-paths.js');

/** Paths that are isolation plumbing only — do not block merge-back. */
function isIsolationOnlyDirt(paths) {
  if (!paths.length) return true;
  return paths.every((p) => p === '.gitignore' || p === '.worktrees' || p.startsWith('.worktrees/'));
}

function usage(msg) {
  if (msg) console.error(msg);
  console.error('usage: node merge-back.js --repo <path>');
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] ?? null;
}

const repoArg = arg('--repo');
if (!repoArg) usage();

let repo;
try {
  repo = resolveRepo(repoArg);
} catch (e) {
  console.error('merge-back: ' + (e.message || e));
  process.exit(5);
}

const commonGitDir = commonGit(repo);
const launch = launchRoot(commonGitDir);
const { pointer, base } = pointerPaths(commonGitDir);

if (!fs.existsSync(pointer)) {
  console.error('merge-back: no pointer at ' + pointer);
  process.exit(2);
}

let ptr;
try {
  ptr = JSON.parse(fs.readFileSync(pointer, 'utf8'));
} catch (e) {
  console.error('merge-back: bad pointer JSON: ' + e.message);
  process.exit(5);
}

const campaign = ptr.campaign_branch;
const worktree = ptr.worktree_path;
const launchBranch = ptr.launch_branch;

const out = {
  ok: false,
  merge_back: null,
  campaign_branch: campaign,
  worktree_path: worktree,
  launch,
  launch_branch: launchBranch,
  error: null,
};

if (!launchBranch) {
  // detached launch — cannot FF; mark reintegrate_blocked
  ptr.state = 'reintegrate_blocked';
  ptr.reintegrate_error = 'launch_branch null (detached HEAD at cold-start)';
  fs.writeFileSync(pointer, JSON.stringify(ptr, null, 2) + '\n', 'utf8');
  out.merge_back = 'skipped_detached';
  out.error = ptr.reintegrate_error;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
}

const dirt = porcelain(launch);
if (dirt.length && !isIsolationOnlyDirt(dirt)) {
  out.error = 'launch dirty: ' + dirt.slice(0, 8).join(', ');
  ptr.state = 'reintegrate_blocked';
  ptr.reintegrate_error = out.error;
  fs.writeFileSync(pointer, JSON.stringify(ptr, null, 2) + '\n', 'utf8');
  out.merge_back = 'blocked';
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(3);
}
if (dirt.length) {
  out.notes = (out.notes || []).concat(['ignored-isolation-dirt:' + dirt.join(',')]);
}

try {
  // checkout launch branch if needed
  const cur = git(launch, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (cur !== launchBranch) {
    git(launch, ['checkout', launchBranch]);
  }
  git(launch, ['merge', '--ff-only', campaign]);
} catch (e) {
  const msg = errMsg(e).slice(0, 500);
  ptr.state = 'reintegrate_blocked';
  ptr.reintegrate_error = msg;
  fs.writeFileSync(pointer, JSON.stringify(ptr, null, 2) + '\n', 'utf8');
  out.merge_back = 'blocked';
  out.error = msg;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(4);
}

// teardown: remove worktree → delete branch → delete pointer
try {
  if (worktree && fs.existsSync(worktree)) {
    try {
      git(launch, ['worktree', 'remove', '--force', worktree]);
    } catch {
      // fallback: worktree remove by path
      try {
        git(launch, ['worktree', 'remove', worktree]);
      } catch {
        /* leave for operator */
        out.notes = (out.notes || []).concat(['worktree-remove-failed']);
      }
    }
  }
  try {
    git(launch, ['branch', '-d', campaign]);
  } catch {
    try {
      git(launch, ['branch', '-D', campaign]);
    } catch {
      out.notes = (out.notes || []).concat(['branch-delete-failed']);
    }
  }
  if (fs.existsSync(pointer)) fs.unlinkSync(pointer);
  out.ok = true;
  out.merge_back = 'ok';
} catch (e) {
  out.error = e.message || String(e);
  out.merge_back = 'teardown_partial';
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(5);
}

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(0);
