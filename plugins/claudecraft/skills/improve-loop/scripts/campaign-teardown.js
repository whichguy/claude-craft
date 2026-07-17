#!/usr/bin/env node
/**
 * campaign-teardown.js — L3: best-effort remove this run's isolation without FF merge.
 *
 * Use on fail/block exit so the next /improve does not resume dirt.
 * Does NOT merge into launch. Prefer merge-back.js after terminal land.
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
  git,
  resolveRepo,
  commonGit,
  launchRoot,
  pointerPaths,
  errMsg,
} = require('./lib-paths.js');

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
  out.ok = true;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
}

const worktree = ptr.worktree_path;
const campaign = ptr.campaign_branch;
out.campaign_branch = campaign;
out.worktree_path = worktree;

if (worktree && fs.existsSync(worktree)) {
  try {
    git(launch, ['worktree', 'remove', '--force', worktree]);
    out.notes.push('worktree-removed');
  } catch {
    try {
      fs.rmSync(worktree, { recursive: true, force: true });
      out.notes.push('worktree-rm-fallback');
    } catch (e) {
      out.notes.push('worktree-remove-failed:' + errMsg(e).slice(0, 80));
    }
  }
}

if (campaign) {
  try {
    git(launch, ['branch', '-D', campaign]);
    out.notes.push('branch-deleted');
  } catch {
    out.notes.push('branch-delete-skipped');
  }
}

try {
  if (fs.existsSync(pointer)) fs.unlinkSync(pointer);
  out.notes.push('pointer-cleared');
} catch {
  out.notes.push('pointer-clear-failed');
}

out.ok = true;
out.teardown = 'ok';
out.suggested_cwd = launch;
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
process.exit(0);
