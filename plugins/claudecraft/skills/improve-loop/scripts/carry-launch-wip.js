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
 * Paths from one porcelain line. Renames (`R  old -> new` / `… old -> new`) yield
 * **both** sides — carrying only the destination breaks delete-half of renames.
 * @param {string} line
 * @returns {string[]}
 */
function pathsFromPorcelainLine(line) {
  const s = String(line || '');
  let rest;
  if (s.length >= 3 && s[2] === ' ') {
    rest = s.slice(3);
  } else if (s.length >= 2 && s[1] === ' ') {
    rest = s.slice(2);
  } else {
    rest = s;
  }
  const unquote = (r) => {
    let x = String(r || '').trim();
    if (x.startsWith('"') && x.endsWith('"')) x = x.slice(1, -1);
    return x;
  };
  if (rest.includes(' -> ')) {
    return rest
      .split(' -> ')
      .map(unquote)
      .filter(Boolean);
  }
  // Also handle porcelainPath rename-only (new side) for callers that already stripped
  const single = unquote(rest);
  return single ? [single] : [];
}

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
    const x = line.length >= 1 ? line[0] : ' ';
    const y = line.length >= 2 ? line[1] : ' ';
    const isUntracked = x === '?' || y === '?' || line.startsWith('??');
    const paths = pathsFromPorcelainLine(line);
    for (const p of paths) {
      if (!p || isIsolationDirt(p)) continue;
      if (isUntracked) untracked.push(p);
      else tracked.push(p);
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
 * Restore launch tracked path to HEAD, or remove if not in HEAD (new/renamed-to).
 * @param {string} launch
 * @param {string[]} tracked
 */
function cleanTrackedOnLaunch(launch, tracked) {
  const cleanErrors = [];
  for (const p of tracked) {
    let done = false;
    try {
      git(launch, [
        'restore',
        '--source=HEAD',
        '--staged',
        '--worktree',
        '--',
        p,
      ]);
      done = true;
    } catch {
      /* not in HEAD or no restore */
    }
    if (!done) {
      try {
        git(launch, ['checkout', 'HEAD', '--', p]);
        try {
          git(launch, ['reset', 'HEAD', '--', p]);
        } catch {
          /* ignore */
        }
        done = true;
      } catch {
        /* still not in HEAD */
      }
    }
    if (!done) {
      // Added / renamed-to path: drop from index + worktree
      try {
        git(launch, ['rm', '-f', '--', p]);
        done = true;
      } catch {
        try {
          git(launch, ['reset', 'HEAD', '--', p]);
        } catch {
          /* ignore */
        }
        try {
          rmPathRecursive(launch, p);
          done = true;
        } catch (e3) {
          cleanErrors.push(p + ': ' + (e3.message || e3));
        }
      }
    }
  }
  if (cleanErrors.length) {
    throwLaunchCleanFailed(cleanErrors);
  }
}

/**
 * Remove carried untracked paths from launch. Failures MUST be LAUNCH_CLEAN_FAILED
 * (not raw EPERM) so worktree-enter keeps the worktree after a successful apply.
 * @param {string} launch
 * @param {string[]} untracked
 */
function cleanUntrackedOnLaunch(launch, untracked) {
  const cleanErrors = [];
  for (const rel of untracked) {
    try {
      rmPathRecursive(launch, rel);
    } catch (e) {
      cleanErrors.push(rel + ': ' + (e.message || e));
    }
  }
  if (cleanErrors.length) {
    throwLaunchCleanFailed(cleanErrors);
  }
}

function throwLaunchCleanFailed(cleanErrors) {
  const err = new Error(
    'launch clean partial after carry: ' +
      cleanErrors.slice(0, 5).join('; ') +
      ' (workspace already has WIP — leave worktree; inspect both trees)'
  );
  err.code = 'LAUNCH_CLEAN_FAILED';
  throw err;
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

  // Test seam (hermetic only): IMPROVE_LOOP_CARRY_FORCE_FAIL=apply|clean|copy
  const forceFail = String(process.env.IMPROVE_LOOP_CARRY_FORCE_FAIL || '').trim();
  if (forceFail === 'apply') {
    const err = new Error('forced apply fail (IMPROVE_LOOP_CARRY_FORCE_FAIL=apply)');
    err.code = 'APPLY_FAILED';
    throw err;
  }
  if (forceFail === 'copy') {
    const err = new Error('forced copy fail (IMPROVE_LOOP_CARRY_FORCE_FAIL=copy)');
    err.code = 'COPY_FAILED';
    throw err;
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

  // After workspace has WIP: optional forced clean failure (test seam).
  // Worktree-enter must KEEP the worktree on LAUNCH_CLEAN_FAILED.
  if (forceFail === 'clean') {
    const err = new Error(
      'forced launch clean fail after carry (IMPROVE_LOOP_CARRY_FORCE_FAIL=clean)'
    );
    err.code = 'LAUNCH_CLEAN_FAILED';
    throw err;
  }

  // 3) success only now — clean launch for carried paths.
  // Per-path: rename destinations / new files may not exist at HEAD (pathspec fails).
  // Never use reset --hard (would wipe non-carried isolation dirt e.g. launch .gitignore).
  // Any failure here is LAUNCH_CLEAN_FAILED: workspace already has full WIP — enter must
  // KEEP the worktree (do not teardown). Tracked + untracked clean both use this code.
  if (tracked.length > 0) {
    cleanTrackedOnLaunch(launch, tracked);
  }
  if (untracked.length > 0) {
    cleanUntrackedOnLaunch(launch, untracked);
  }

  notes.push('carried-launch-wip:' + all.length);
  if (all.length <= 12) {
    notes.push('carried-paths:' + all.join(','));
  } else {
    notes.push('carried-paths:' + all.slice(0, 12).join(',') + ',…');
  }

  return { carried: all, notes, tracked, untracked };
}

/**
 * Reverse of carryLaunchWip: best-effort restore non-isolation WIP from workspace
 * back onto launch **without** destroying the workspace copy.
 *
 * Lenient rules:
 *   - tracked: git apply on launch (soft; on conflict note and continue)
 *   - untracked: copy only when dest is missing (never overwrite launch work)
 *   - never cleans/deletes workspace paths
 *
 * @param {string} workspace
 * @param {string} launch
 * @param {{ notes?: string[] }} [opts]
 * @returns {{ restored: string[], skipped: string[], notes: string[] }}
 */
function restoreWipToLaunch(workspace, launch, opts = {}) {
  const notes = opts.notes || [];
  const restored = [];
  const skipped = [];

  if (!workspace || !fs.existsSync(workspace)) {
    notes.push('restore-wip: workspace missing');
    return { restored, skipped, notes };
  }
  if (!launch || !fs.existsSync(launch)) {
    notes.push('restore-wip: launch missing');
    return { restored, skipped, notes };
  }

  let tracked = [];
  let untracked = [];
  try {
    const c = listCarryCandidates(workspace);
    tracked = c.tracked;
    untracked = c.untracked;
  } catch (e) {
    notes.push('restore-wip: list failed: ' + errMsg(e).slice(0, 120));
    return { restored, skipped, notes };
  }

  if (tracked.length === 0 && untracked.length === 0) {
    notes.push('restore-wip:0');
    return { restored, skipped, notes };
  }

  if (tracked.length > 0) {
    // Split ambient vs product so cron/wiki races on launch do not spam soft-fail
    // and look like product restore failures (ask campaign: cron mutated underfoot).
    let isAmbient = () => false;
    try {
      const { isAmbientDirt } = require('./lib-paths.js');
      isAmbient = (p) => isAmbientDirt(p);
    } catch {
      /* keep false */
    }
    const trackedAmbient = tracked.filter((p) => isAmbient(p));
    const trackedProduct = tracked.filter((p) => !isAmbient(p));

    const applyGroup = (group, label) => {
      if (!group.length) return;
      try {
        const patch = gitDiffHeadBinary(workspace, group);
        if (patch && patch.length > 0) {
          try {
            gitApplyBinary(launch, patch);
            for (const p of group) restored.push(p);
          } catch (e) {
            if (label === 'ambient') {
              for (const p of group) {
                skipped.push(p);
                notes.push('restore-skipped-ambient-race:' + p);
              }
            } else {
              notes.push(
                'restore-wip-tracked-apply-soft-fail: ' + errMsg(e).slice(0, 160)
              );
              for (const p of group) skipped.push(p);
            }
          }
        } else {
          for (const p of group) skipped.push(p);
        }
      } catch (e) {
        notes.push(
          'restore-wip-tracked-diff-fail: ' + errMsg(e).slice(0, 120)
        );
        for (const p of group) skipped.push(p);
      }
    };
    applyGroup(trackedProduct, 'product');
    applyGroup(trackedAmbient, 'ambient');
  }

  for (const rel of untracked) {
    const dest = path.join(launch, rel);
    if (fs.existsSync(dest)) {
      skipped.push(rel);
      notes.push('restore-wip-skip-exists:' + rel);
      continue;
    }
    try {
      copyPathRecursive(workspace, rel, launch);
      restored.push(rel);
    } catch (e) {
      skipped.push(rel);
      notes.push(
        'restore-wip-copy-soft-fail:' + rel + ':' + errMsg(e).slice(0, 80)
      );
    }
  }

  notes.push('restore-wip:' + restored.length);
  if (skipped.length) notes.push('restore-wip-skipped:' + skipped.length);
  if (restored.length && restored.length <= 12) {
    notes.push('restore-wip-paths:' + restored.join(','));
  } else if (restored.length > 12) {
    notes.push('restore-wip-paths:' + restored.slice(0, 12).join(',') + ',…');
  }

  return { restored, skipped, notes };
}

/**
 * Isolation teardown after product land (FF already done by caller).
 *
 * Mental model (two loops):
 *   - Product loop: tests + commits + FF — already finished before this runs.
 *   - Housekeeping: put borrowed launch WIP back on launch, then delete the
 *     disposable worktree tray. This is NOT product failure recovery.
 *
 * Order:
 *   1. restore non-isolation worktree WIP onto launch (best-effort copy/apply)
 *   2. **always** remove the worktree — force allowed after restore was attempted
 *      (copy-out leaves the tray dirty; soft-remove would orphan forever)
 *   3. soft `git branch -d` only (NO -D) once the worktree is gone
 *
 * Policy (skip-exists / ambient race): launch wins; force-remove still proceeds;
 * notes record what was skipped. Hard keep only if remove itself fails (lock).
 *
 * @param {string} launch
 * @param {{ worktree?: string|null, campaign?: string|null, notes?: string[] }} opts
 * @returns {{ worktree_removed: boolean, branch_deleted: boolean, notes: string[], worktree_kept: boolean }}
 */
function advisoryTeardownIsolation(launch, opts = {}) {
  const notes = opts.notes || [];
  const worktree = opts.worktree || null;
  const campaign = opts.campaign || null;
  let worktree_removed = false;
  let branch_deleted = false;
  let worktree_kept = false;

  if (worktree && fs.existsSync(worktree)) {
    // Step 1: give borrowed files back to launch (not a product "fix").
    try {
      restoreWipToLaunch(worktree, launch, { notes });
    } catch (e) {
      notes.push('restore-wip-unexpected: ' + errMsg(e).slice(0, 120));
    }

    // Step 2: tray is disposable after restore attempt — always remove.
    // Force is required because restore is copy-out (worktree stays dirty with
    // carried WIP / ambient). Soft-remove-without-force was the orphan farm.
    try {
      git(launch, ['worktree', 'remove', '--force', worktree]);
      worktree_removed = true;
      notes.push('teardown: worktree removed (force after restore)');
    } catch (e) {
      // Retry once without relying on porcelain clean — still force.
      try {
        git(launch, ['worktree', 'remove', '--force', worktree]);
        worktree_removed = true;
        notes.push('teardown: worktree removed (force retry)');
      } catch (e2) {
        worktree_kept = true;
        worktree_removed = false;
        notes.push(
          'teardown-incomplete: worktree remove failed (lock?): ' + worktree
        );
        notes.push('teardown-detail: ' + errMsg(e2).slice(0, 160));
        notes.push(
          'operator: git -C ' +
            launch +
            ' worktree remove --force ' +
            worktree
        );
      }
    }
  } else {
    worktree_removed = !worktree || !fs.existsSync(worktree);
    if (worktree_removed) notes.push('teardown: worktree already gone');
  }

  if (campaign) {
    try {
      git(launch, ['branch', '-d', campaign]);
      branch_deleted = true;
      notes.push('teardown: branch soft-deleted (-d)');
    } catch {
      branch_deleted = false;
      notes.push(
        'teardown: branch kept (not fully merged, still checked out, or -d refused): ' +
          campaign
      );
    }
  }

  return { worktree_removed, branch_deleted, notes, worktree_kept };
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

  // rename porcelain must yield both sides
  const ren = pathsFromPorcelainLine('R  oldname.txt -> newname.txt');
  ok(ren.length === 2 && ren[0] === 'oldname.txt' && ren[1] === 'newname.txt', 'rename both sides');
  // Observed: git status --porcelain can emit RMold/new without a blank XY pair
  const ren2 = pathsFromPorcelainLine('RM oldname.txt -> newname.txt');
  ok(ren2.length === 2 && ren2[0] === 'oldname.txt' && ren2[1] === 'newname.txt', 'RM rename both sides');
  const del = pathsFromPorcelainLine(' D keep.txt');
  ok(del.length === 1 && del[0] === 'keep.txt', 'delete path');

  ok(typeof carryLaunchWip === 'function', 'carryLaunchWip export');
  ok(typeof listCarryCandidates === 'function', 'listCarryCandidates export');
  ok(typeof hasUnmerged === 'function', 'hasUnmerged export');
  ok(typeof restoreWipToLaunch === 'function', 'restoreWipToLaunch export');
  ok(typeof advisoryTeardownIsolation === 'function', 'advisoryTeardownIsolation export');

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
  restoreWipToLaunch,
  advisoryTeardownIsolation,
  gitDiffHeadBinary,
  gitApplyBinary,
  copyPathRecursive,
  pathsFromPorcelainLine,
};

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    console.error('Usage: node carry-launch-wip.js --self-test');
    process.exit(2);
  }
}
