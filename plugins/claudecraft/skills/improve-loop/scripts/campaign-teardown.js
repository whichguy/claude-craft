#!/usr/bin/env node
/**
 * campaign-teardown.js — L3: **advisory** remove this run's isolation without FF merge.
 *
 * Use on fail/block exit so the next /improve does not resume dirt.
 * Does NOT merge into launch. Prefer merge-back.js after terminal land.
 *
 * Teardown (same housekeeping as merge-back, no FF):
 *   - restore non-isolation worktree WIP onto launch first (best-effort)
 *   - always worktree remove --force after restore attempt
 *   - soft branch -d only (never -D)
 *   - always clear worktree-local run state best-effort so next /improve can cold-start
 *
 * Reintegrate protect: if the run is reintegrate-protected (state
 * reintegrate_blocked with unmerged improve-loop commits, or unmerged improve
 * range on an active campaign), refuse destructive teardown unless
 * --force-drop-reintegrate. Exit 3 on refuse.
 *
 * Usage:
 *   node campaign-teardown.js --repo <path> [--force-drop-reintegrate]
 *
 * Exit: 0 ok/partial/no_pointer; 1 usage; 3 refused reintegrate protect
 *
 * Injectable: GIT_CMD
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  resolveRepo,
  commonGit,
  launchRoot,
  pointerPaths,
  deleteRunState,
  resolveActiveRun,
  errMsg,
  isReintegrateProtected,
} = require('./lib-paths.js');
const { advisoryTeardownIsolation } = require('./carry-launch-wip.js');

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    'usage: node campaign-teardown.js --repo <path> [--force-drop-reintegrate]'
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

const repoArg = arg('--repo');
if (!repoArg) usage();
const forceDrop = has('--force-drop-reintegrate');

let repo;
try {
  repo = resolveRepo(repoArg);
} catch (e) {
  console.error('campaign-teardown: ' + (e.message || e));
  process.exit(1);
}

const commonGitDir = commonGit(repo);
const launch = launchRoot(commonGitDir);

const out = {
  ok: false,
  teardown: null,
  launch,
  notes: [],
  suggested_cwd: launch,
  worktree_removed: false,
  branch_deleted: false,
  worktree_kept: false,
  pointer_cleared: false,
  recovery: null,
  reintegrate_error: null,
  unmerged_improve_count: 0,
};

let resolved;
try {
  resolved = resolveActiveRun(launch, commonGitDir, { allowNewest: true });
} catch (e) {
  if (e && e.code === 'AMBIGUOUS_RUN') {
    out.teardown = 'ambiguous_run';
    out.ok = false;
    out.notes.push('ambiguous-run: pass --workspace or reduce actives');
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    process.exit(1);
  }
  throw e;
}

if (!resolved) {
  out.teardown = 'no_pointer';
  out.ok = true;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
}

const ptr = resolved.state;
const worktree = resolved.workspace;
const campaign = ptr.campaign_branch;
out.campaign_branch = campaign;
out.worktree_path = worktree;
out.reintegrate_error = ptr.reintegrate_error || null;

// --- reintegrate protect: refuse before any destructive advisory teardown ---
const protect = isReintegrateProtected(launch, ptr);
out.unmerged_improve_count = protect.unmergedImproveCount || 0;

if (protect.protected && !forceDrop) {
  out.ok = false;
  out.teardown = 'refused_reintegrate_blocked';
  out.notes.push(
    'refused_reintegrate_blocked:' +
      (protect.reason || 'protected') +
      (protect.unmergedImproveCount
        ? ':unmerged=' + protect.unmergedImproveCount
        : '')
  );
  out.recovery =
    'node <SKILL_DIR>/scripts/worktree-enter.js --repo ' +
    launch +
    ' --target ' +
    JSON.stringify(ptr.target || '') +
    ' --resume && node <SKILL_DIR>/scripts/merge-back.js --repo ' +
    launch +
    '  # or: campaign-teardown --force-drop-reintegrate to abandon';
  console.error(
    'campaign-teardown: refused reintegrate protect (' +
      (protect.reason || 'protected') +
      ') — pass --resume merge-back-only, or --force-drop-reintegrate to abandon'
  );
  if (campaign) {
    console.error('campaign-teardown: campaign_branch=' + campaign);
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(3);
}

if (protect.protected && forceDrop) {
  out.notes.push(
    'force-drop-reintegrate: abandoned unmerged improve tip ' +
      (campaign || '(none)') +
      ' ' +
      (protect.unmergedImproveCount || 0) +
      ' commits'
  );
}

const td = advisoryTeardownIsolation(launch, {
  worktree,
  campaign,
  notes: out.notes,
});
out.worktree_removed = td.worktree_removed;
out.branch_deleted = td.branch_deleted;
out.worktree_kept = !!td.worktree_kept;

try {
  deleteRunState(worktree);
  const { pointer: legacy } = pointerPaths(commonGitDir);
  if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
  out.notes.push('pointer-cleared');
  out.pointer_cleared = true;
} catch {
  out.notes.push('pointer-clear-failed');
  out.pointer_cleared = false;
}

out.ok = true;
out.teardown = out.worktree_kept ? 'ok_advisory' : 'ok';
out.suggested_cwd = launch;
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(0);
