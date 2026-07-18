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
 * Launch dirt classification (via lib-paths.classifyLaunchDirt):
 *   - isolation (.gitignore, IMPROVE_LOOP.md, .worktrees/) → non-blocking
 *   - ambient (IMPROVE_LOOP_AMBIENT_PREFIXES; default cron/, wiki/) → non-blocking
 *   - code (everything else) → blocks with exit 3
 *
 * Exit codes:
 *   0 ok (merge + teardown) or skipped (no launch_branch) with reintegrate_blocked set
 *   1 usage
 *   2 no pointer
 *   3 launch dirty (blocking code paths only)
 *   4 ff-only merge failed (sets reintegrate_blocked)
 *   5 git error
 *
 * Injectable: GIT_CMD, IMPROVE_LOOP_AMBIENT_PREFIXES
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
  classifyLaunchDirt,
  errMsg,
} = require('./lib-paths.js');

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
  notes: [],
  ignored_ambient: [],
  ignored_isolation: [],
  blocking_dirt: [],
  worktree_removed: false,
  branch_deleted: false,
  pointer_cleared: false,
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
const classified = classifyLaunchDirt(dirt);
out.ignored_ambient = classified.ambient;
out.ignored_isolation = classified.isolation;
out.blocking_dirt = classified.code;
if (classified.ambient.length) {
  out.notes.push('ignored-ambient-dirt:' + classified.ambient.slice(0, 12).join(','));
}
if (classified.isolation.length) {
  out.notes.push('ignored-isolation-dirt:' + classified.isolation.join(','));
}
if (classified.code.length) {
  const ambHint =
    classified.ambient_prefixes.length > 0
      ? ' ambient_prefixes=' + classified.ambient_prefixes.join(',')
      : ' (no ambient prefixes; set IMPROVE_LOOP_AMBIENT_PREFIXES=cron/,wiki/ for runtime paths)';
  out.error =
    'launch dirty: ' + classified.code.slice(0, 8).join(', ') + ambHint;
  ptr.state = 'reintegrate_blocked';
  ptr.reintegrate_error = out.error;
  fs.writeFileSync(pointer, JSON.stringify(ptr, null, 2) + '\n', 'utf8');
  out.merge_back = 'blocked';
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(3);
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
      out.worktree_removed = true;
    } catch {
      try {
        git(launch, ['worktree', 'remove', worktree]);
        out.worktree_removed = true;
      } catch {
        out.notes.push('worktree-remove-failed');
      }
    }
  } else {
    out.worktree_removed = !worktree || !fs.existsSync(worktree);
  }
  try {
    git(launch, ['branch', '-d', campaign]);
    out.branch_deleted = true;
  } catch {
    try {
      git(launch, ['branch', '-D', campaign]);
      out.branch_deleted = true;
    } catch {
      out.notes.push('branch-delete-failed');
    }
  }
  if (fs.existsSync(pointer)) {
    fs.unlinkSync(pointer);
    out.pointer_cleared = true;
  } else {
    out.pointer_cleared = true;
  }
  out.ok = true;
  out.merge_back = 'ok';
  // Hint for orchestrator / host sticky-CWD: leave the removed worktree directory
  out.suggested_cwd = launch;
} catch (e) {
  out.error = e.message || String(e);
  out.merge_back = 'teardown_partial';
  out.suggested_cwd = launch;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(5);
}

out.suggested_cwd = out.suggested_cwd || launch;
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(0);
