#!/usr/bin/env node
'use strict';
/**
 * improve-next-auto.js — pure next_auto derivation for improve / improve-loop.
 *
 * Mirrors phase-0 rehydration + ledger-schema blocked token catalog.
 * No network. No git. Deterministic from a JSON snapshot.
 *
 * Exit codes:
 *   0 success
 *   1 usage / invalid JSON
 *   2 invalid snapshot (not an object)
 */

const HINTS = {
  cycle: 'Run one improve-loop cycle in the active tree (worktree if set); update ## Driver after',
  reintegrate:
    'Only-ledger commit if needed; improve-worktree.sh reintegrate --repo <repo> --slug <slug>; inspect with status',
  destroy: 'improve-worktree.sh destroy --repo <repo> --slug <slug> (or status for summary)',
  done: 'No further automatic steps; run complete or PR-only tip left on purpose',
  'blocked:ambiguous-run':
    'Disambiguate improve-runs slug (pass --slug or destroy extra runs); do not guess',
  'blocked:path-relocated':
    'Rewrite paths from local .git/improve-runs/<slug>.json or recreate run on this machine',
  'blocked:rebase-continue':
    'In worktree: resolve, git add, git rebase --continue; then reintegrate or recover; status for mid_rebase=',
  'blocked:worktree-missing':
    'Worktree path gone but run active; create new run or force-destroy; status for state=',
  'blocked:worktree-dirty':
    'Commit or stash non-ledger worktree changes before reintegrate (status shows worktree_git_status)',
  'blocked:no-tests':
    'Record a test command in IMPROVE_LOOP.md header; never invent one unattended',
  'blocked:ledger-target-mismatch':
    'Confirm resume existing ledger or start a new target explicitly',
  'blocked:launch-dirty':
    'Commit/stash tracked changes on launch branch, then reintegrate; status: launch_tracked_dirty=',
  'blocked:open-pr':
    'merge_to_launch=false: open PR from worktree tip or re-run reintegrate with --merge-to-launch',
  'blocked:destroy-failed':
    'Retry destroy --force; status for worktree_exists=',
  'blocked:rebase-aborted':
    'Rebase was aborted; tip not on source — retry reintegrate or abandon worktree',
};

/**
 * @param {object} s snapshot
 * @returns {{ next_auto: string, blocked_detail: string, resume_hint: string, auto_commit_ledger: boolean }}
 */
function deriveNextAuto(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    const err = new Error('snapshot must be a JSON object');
    err.code = 2;
    throw err;
  }

  const mid = !!s.mid_rebase;
  const wtPresent = !!s.worktree_present;
  const wtDirty = !!s.worktree_dirty;
  const onlyLedger = !!s.worktree_dirty_only_ledger;
  const wtMissingRun = !!s.worktree_missing_but_run_active;
  const launchDirty = !!s.launch_tracked_dirty;
  const mergeToLaunch = s.merge_to_launch !== false && s.merge_to_launch !== 'false';
  const reint = s.reintegrate_status == null ? null : String(s.reintegrate_status);
  const keep = !!s.keep_worktree;
  // Optional tip ancestry (from improve-worktree status tip_on_launch=). When unknown,
  // fall back to merge_to_launch only — never invent tip-on-launch=true.
  const tipOnLaunch =
    s.tip_on_launch === true ||
    s.tip_on_launch === 'true' ||
    s.tip_on_launch === 'yes';
  const tipKnownOff =
    s.tip_on_launch === false ||
    s.tip_on_launch === 'false' ||
    s.tip_on_launch === 'no';
  const status = String(s.status || 'active');
  const underCaps = s.under_caps !== false && s.under_caps !== 'false';
  const onceFinished = !!s.once_finished;
  const hasTests = s.has_test_command !== false && s.has_test_command !== 'false';
  const unattended = !!s.unattended;
  const targetMismatch = !!s.ledger_target_mismatch;
  const ambiguous = !!s.ambiguous_run;
  const pathRelocated = !!s.path_relocated;
  const destroyFailed = !!s.destroy_failed;
  const reintOk = reint === 'ok';
  // Tip not on launch: merge_to_launch=false after S11a, or explicit tip_on_launch=no
  const tipUnmerged = tipKnownOff || (reintOk && !mergeToLaunch && !tipOnLaunch);
  const terminal =
    onceFinished ||
    status === 'complete' ||
    /^stopped\b/i.test(status) ||
    s.caps_exhausted === true;

  function out(next, detail, autoCommit) {
    const blocked = String(next).startsWith('blocked:');
    const hintKey = blocked ? next : next;
    return {
      next_auto: next,
      blocked_detail: detail || (blocked ? next.slice('blocked:'.length) : 'none'),
      resume_hint: HINTS[hintKey] || HINTS.cycle,
      auto_commit_ledger: !!autoCommit,
    };
  }

  if (ambiguous) return out('blocked:ambiguous-run', 'multiple improve-runs');
  if (pathRelocated) return out('blocked:path-relocated', 'driver paths not on this host');
  if (mid) return out('blocked:rebase-continue', 'mid-rebase in worktree');
  if (wtMissingRun) return out('blocked:worktree-missing', 'run active but worktree path gone');
  if (wtDirty && !onlyLedger) return out('blocked:worktree-dirty', 'non-ledger dirty files');
  if (destroyFailed) return out('blocked:destroy-failed', 'destroy failed');
  if (!hasTests && unattended) return out('blocked:no-tests', 'no test command unattended');
  if (targetMismatch) return out('blocked:ledger-target-mismatch', 'ledger target != invoke');

  // Teardown-oriented steps may need only-ledger auto-commit
  const needsTeardown =
    wtPresent && (!reintOk || (reintOk && !keep) || destroyFailed);

  if (status === 'active' && underCaps && !onceFinished && !terminal) {
    return out('cycle', 'none', false);
  }

  if (wtPresent && !reintOk) {
    if (launchDirty && mergeToLaunch) {
      return out('blocked:launch-dirty', 'launch has tracked changes');
    }
    return out('reintegrate', 'none', onlyLedger && wtDirty);
  }

  // reintegrate ok + tip still only in worktree → open-pr (even with keep_worktree)
  if (wtPresent && reintOk && tipUnmerged) {
    return out('blocked:open-pr', 'tip not on launch; open PR or --merge-to-launch');
  }

  if (wtPresent && reintOk && !keep) {
    if (destroyFailed) return out('blocked:destroy-failed', 'destroy failed');
    return out('destroy', 'none', onlyLedger && wtDirty);
  }

  if (destroyFailed) return out('blocked:destroy-failed', 'destroy failed');

  if (terminal || !underCaps) {
    if (wtPresent && !reintOk) {
      if (launchDirty && mergeToLaunch) {
        return out('blocked:launch-dirty', 'launch has tracked changes');
      }
      return out('reintegrate', 'none', onlyLedger && wtDirty);
    }
    if (wtPresent && reintOk && tipUnmerged) {
      return out('blocked:open-pr', 'tip not on launch');
    }
    if (wtPresent && reintOk && !keep) {
      return out('destroy', 'none', onlyLedger && wtDirty);
    }
    return out('done', 'none', false);
  }

  // keep_worktree after reintegrate ok and tip on launch (or merge true without tip known off)
  if (wtPresent && reintOk && keep) {
    return out('done', 'none', false);
  }

  if (needsTeardown && onlyLedger && wtDirty) {
    // unreachable safety
    return out('reintegrate', 'none', true);
  }

  return out('cycle', 'none', false);
}

function usage() {
  process.stderr.write(
    'Usage: improve-next-auto.js [--file snapshot.json]  (or JSON on stdin)\n' +
      'Prints JSON: { next_auto, blocked_detail, resume_hint, auto_commit_ledger }\n'
  );
}

function loadInput(argv) {
  const i = argv.indexOf('--file');
  if (i >= 0) {
    const fs = require('fs');
    const p = argv[i + 1];
    if (!p) throw new Error('missing path after --file');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  const fs = require('fs');
  const raw = fs.readFileSync(0, 'utf8');
  if (!raw.trim()) throw new Error('empty stdin');
  return JSON.parse(raw);
}

function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    usage();
    process.exit(0);
  }
  let data;
  try {
    data = loadInput(argv);
  } catch (e) {
    process.stderr.write(String(e.message || e) + '\n');
    usage();
    process.exit(1);
  }
  try {
    const result = deriveNextAuto(data);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (e) {
    process.stderr.write(String(e.message || e) + '\n');
    process.exit(e.code === 2 ? 2 : 1);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { deriveNextAuto, HINTS };
