#!/usr/bin/env node
/**
 * carry-launch-wip.js — snapshot non-ignored launch WIP into a campaign worktree,
 * then clean those paths on launch (isolation invariant + merge-back).
 *
 * Algorithm (fail-closed — never clean launch until workspace apply succeeds):
 *   1. List porcelain paths excluding isolation (.worktrees/, IMPROVE_LOOP.md, .gitignore)
 *   2. Refuse unmerged index
 *   3. git diff HEAD --binary for tracked dirty → git apply in workspace
 *   4. Copy untracked (exclude-standard) files/dirs into workspace
 *   5. Only then: restore tracked paths on launch + delete untracked carried paths
 *
 * Usage (library):
 *   const { carryLaunchWip, listCarryCandidates } = require('./carry-launch-wip.js');
 *
 * CLI:
 *   node carry-launch-wip.js --self-test
 *
 * Exit: 0 ok; 1 self-test fail; 2 usage
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  GIT,
  git,
  errMsg,
  porcelainPath,
  isIsolationDirt,
} = require('./lib-paths.js');

/**
 * Parse porcelain into tracked-dirty vs untracked paths (isolation excluded).
 * @param {string} launch
 * @returns {{ tracked: string[], untracked: string[], all: string[] }}
 */
function listCarryCandidates(launch) {
  const out = git(launch, ['status', '--porcelain', '-uall']);
  const tracked = [];
  const untracked = [];
  if (!out) return { tracked, untracked, all: [] };
  for (const line of out.split('\n').filter(Boolean)) {
    const p = porcelainPath(line);
    if (!p || isIsolationDirt(p)) continue;
    // XY status
    const x = line.length >= 1 ? line[0] : ' ';
    const y = line.length >= 2 ? line[1] : ' ';
    if (x === '?' || y === '?' || line.startsWith('??')) {
      untracked.push(p);
    } else {
      tracked.push(p);
    }
  }
  // de-dupe
  const uniq = (arr) => [...new Set(arr)];
  const t = uniq(tracked);
  const u = uniq(untracked);
  return { tracked: t, untracked: u, all: uniq(t.concat(u)) };
}

/**
 * True if index has unmerged/conflicted entries (cannot safely carry).
 * @param {string} launch
 */
function hasUnmerged(launch) {
  const out = git(launch, ['status', '--porcelain']);
  if (!out) return false;
  return out.split('\n').some((line) => {
    if (!line || line.length < 2) return false;
    const x = line[0];
    const y = line[1];
    return (
      x === 'U' ||
      y === 'U' ||
      (x === 'A' && y === 'A') ||
      (x === 'D' && y === 'D')
    );
  });
}

function gitDiffHeadBinary(launch, paths) {
  if (!paths || paths.length === 0) return Buffer.alloc(0);
  try {
    return execFileSync(
      GIT,
      ['-C', launch, 'diff', 'HEAD', '--binary', '--', ...paths],
      { encoding: null, maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (e) {
    // git diff returns exit 1 when differences exist if --exit-code; default is 0 with output
    if (e.status === 1 && e.stdout) return e.stdout;
    throw e;
  }
}

function gitApplyBinary(workspace, patchBuf) {
  if (!patchBuf || patchBuf.length === 0) return;
  try {
    execFileSync(
      GIT,
      ['-C', workspace, 'apply', '--binary', '--whitespace=nowarn', '-'],
      {
        input: patchBuf,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }
    );
  } catch (e) {
    const msg = errMsg(e) || (e.stderr && String(e.stderr)) || e.message;
    const err = new Error('git apply failed: ' + msg);
    err.code = 'APPLY_FAILED';
    throw err;
  }
}

function copyPathRecursive(srcRoot, rel, destRoot) {
  const src = path.join(srcRoot, rel);
  const dest = path.join(destRoot, rel);
  if (!fs.existsSync(src)) return;
  const st = fs.lstatSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyPathRecursive(srcRoot, path.join(rel, name), destRoot);
    }
    return;
  }
  if (st.isSymbolicLink()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const target = fs.readlinkSync(src);
    try {
      fs.symlinkSync(target, dest);
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    return;
  }
  // file
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function rmPathRecursive(root, rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

/**
 * Snapshot non-ignored launch WIP into workspace, then clean launch.
 *
 * @param {string} launch
 * @param {string} workspace
 * @param {{ notes?: string[] }} [opts]
 * @returns {{ carried: string[], notes: string[], tracked: string[], untracked: string[] }}
 */
function carryLaunchWip(launch, workspace, opts = {}) {
  const notes = opts.notes || [];
  if (hasUnmerged(launch)) {
    const err = new Error(
      'launch has unmerged/conflicted index entries; refuse WIP carry'
    );
    err.code = 'UNMERGED';
    throw err;
  }

  const { tracked, untracked, all } = listCarryCandidates(launch);
  if (all.length === 0) {
    notes.push('carried-launch-wip:0');
    return { carried: [], notes, tracked: [], untracked: [] };
  }

  // 1) tracked delta → apply in workspace (before any launch clean)
  if (tracked.length > 0) {
    const patch = gitDiffHeadBinary(launch, tracked);
    if (patch && patch.length > 0) {
      gitApplyBinary(workspace, patch);
    }
  }

  // 2) untracked → copy into workspace
  for (const rel of untracked) {
    try {
      copyPathRecursive(launch, rel, workspace);
    } catch (e) {
      const err = new Error(
        'copy untracked failed for ' + rel + ': ' + (e.message || e)
      );
      err.code = 'COPY_FAILED';
      throw err;
    }
  }

  // 3) success only now — clean launch for carried paths
  if (tracked.length > 0) {
    try {
      git(launch, [
        'restore',
        '--source=HEAD',
        '--staged',
        '--worktree',
        '--',
        ...tracked,
      ]);
    } catch (e) {
      // older git without restore: fall back
      try {
        git(launch, ['checkout', 'HEAD', '--', ...tracked]);
        // unstage if needed
        try {
          git(launch, ['reset', 'HEAD', '--', ...tracked]);
        } catch {
          /* ignore */
        }
      } catch (e2) {
        const err = new Error(
          'launch clean (tracked) failed after successful carry: ' +
            errMsg(e2) +
            ' (workspace already has WIP — do not re-run without inspecting)'
        );
        err.code = 'LAUNCH_CLEAN_FAILED';
        throw err;
      }
    }
  }
  for (const rel of untracked) {
    rmPathRecursive(launch, rel);
  }

  notes.push('carried-launch-wip:' + all.length);
  if (all.length <= 12) {
    notes.push('carried-paths:' + all.join(','));
  } else {
    notes.push('carried-paths:' + all.slice(0, 12).join(',') + ',…');
  }

  return { carried: all, notes, tracked, untracked };
}

function selfTest() {
  const fails = [];
  const ok = (c, msg) => {
    if (!c) fails.push(msg);
  };

  // isolation filter unit (no git)
  ok(isIsolationDirt('.worktrees/foo') === true, 'isolation worktrees');
  ok(isIsolationDirt('IMPROVE_LOOP.md') === true, 'isolation ledger');
  ok(isIsolationDirt('src/a.c') === false, 'product not isolation');

  // listCarryCandidates needs a real repo — light integration in scripts.test.sh
  ok(typeof carryLaunchWip === 'function', 'carryLaunchWip export');
  ok(typeof listCarryCandidates === 'function', 'listCarryCandidates export');
  ok(typeof hasUnmerged === 'function', 'hasUnmerged export');

  if (fails.length) {
    for (const f of fails) console.error('FAIL:', f);
    process.exit(1);
  }
  console.log('PASS: carry-launch-wip self-test');
  process.exit(0);
}

module.exports = {
  listCarryCandidates,
  hasUnmerged,
  carryLaunchWip,
  gitDiffHeadBinary,
  gitApplyBinary,
  copyPathRecursive,
};

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    console.error('Usage: node carry-launch-wip.js --self-test');
    process.exit(2);
  }
}
