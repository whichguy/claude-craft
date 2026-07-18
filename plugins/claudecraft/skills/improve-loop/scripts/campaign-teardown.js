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
 *   - always clear pointer best-effort so next /improve can cold-start
 *
 * Usage:
 *   node campaign-teardown.js --repo <path>
 *
 * Exit: 0 always best-effort (ok or partial); 1 usage; 2 no pointer
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
  errMsg,
} = require('./lib-paths.js');
const { advisoryTeardownIsolation } = require('./carry-launch-wip.js');

function usage(msg) {
  if (msg) console.error(msg);
  console.error('usage: node campaign-teardown.js --repo <path>');
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
  console.error('campaign-teardown: ' + (e.message || e));
  process.exit(1);
}

const commonGitDir = commonGit(repo);
const launch = launchRoot(commonGitDir);
const { pointer } = pointerPaths(commonGitDir);

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
};

if (!fs.existsSync(pointer)) {
  out.teardown = 'no_pointer';
  out.ok = true;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
}

let ptr;
try {
  ptr = JSON.parse(fs.readFileSync(pointer, 'utf8'));
} catch (e) {
  try {
    fs.unlinkSync(pointer);
  } catch {
    /* ignore */
  }
  out.teardown = 'bad_pointer_cleared';
  out.pointer_cleared = true;
  out.ok = true;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
}

const worktree = ptr.worktree_path;
const campaign = ptr.campaign_branch;
out.campaign_branch = campaign;
out.worktree_path = worktree;

const td = advisoryTeardownIsolation(launch, {
  worktree,
  campaign,
  notes: out.notes,
});
out.worktree_removed = td.worktree_removed;
out.branch_deleted = td.branch_deleted;
out.worktree_kept = !!td.worktree_kept;

try {
  if (fs.existsSync(pointer)) fs.unlinkSync(pointer);
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
