'use strict';

const { expect } = require('chai');
const path = require('path');
const { spawnSync } = require('child_process');
const { deriveNextAuto } = require(path.join(
  __dirname,
  '../../../plugins/claudecraft/tools/improve-next-auto.js'
));

const SCRIPT = path.join(
  __dirname,
  '../../../plugins/claudecraft/tools/improve-next-auto.js'
);

function d(partial) {
  return deriveNextAuto(partial);
}

describe('improve-next-auto.js', function () {
  it('throws on non-object snapshot', function () {
    expect(() => deriveNextAuto(null)).to.throw(/object/);
    expect(() => deriveNextAuto([])).to.throw(/object/);
  });

  const table = [
    {
      name: 'ambiguous-run',
      in: { ambiguous_run: true },
      next: 'blocked:ambiguous-run',
    },
    {
      name: 'path-relocated',
      in: { path_relocated: true },
      next: 'blocked:path-relocated',
    },
    {
      name: 'mid-rebase',
      in: { mid_rebase: true, worktree_present: true },
      next: 'blocked:rebase-continue',
    },
    {
      name: 'worktree-missing',
      in: { worktree_missing_but_run_active: true },
      next: 'blocked:worktree-missing',
    },
    {
      name: 'worktree-dirty non-ledger',
      in: {
        worktree_present: true,
        worktree_dirty: true,
        worktree_dirty_only_ledger: false,
      },
      next: 'blocked:worktree-dirty',
    },
    {
      name: 'no-tests unattended',
      in: { has_test_command: false, unattended: true, status: 'active' },
      next: 'blocked:no-tests',
    },
    {
      name: 'ledger-target-mismatch',
      in: { ledger_target_mismatch: true },
      next: 'blocked:ledger-target-mismatch',
    },
    {
      name: 'active cycle',
      in: {
        status: 'active',
        under_caps: true,
        worktree_present: true,
        has_test_command: true,
      },
      next: 'cycle',
      auto: false,
    },
    {
      name: 'reintegrate when complete + worktree pending',
      in: {
        status: 'complete',
        worktree_present: true,
        reintegrate_status: null,
        merge_to_launch: true,
      },
      next: 'reintegrate',
    },
    {
      name: 'launch-dirty blocks S11b',
      in: {
        status: 'complete',
        worktree_present: true,
        reintegrate_status: null,
        launch_tracked_dirty: true,
        merge_to_launch: true,
      },
      next: 'blocked:launch-dirty',
    },
    {
      name: 'only-ledger dirty auto_commit on reintegrate',
      in: {
        status: 'complete',
        worktree_present: true,
        reintegrate_status: null,
        worktree_dirty: true,
        worktree_dirty_only_ledger: true,
      },
      next: 'reintegrate',
      auto: true,
    },
    {
      name: 'destroy after reintegrate ok',
      in: {
        worktree_present: true,
        reintegrate_status: 'ok',
        keep_worktree: false,
        merge_to_launch: true,
        status: 'complete',
      },
      next: 'destroy',
    },
    {
      name: 'open-pr when merge_to_launch false after reintegrate',
      in: {
        worktree_present: true,
        reintegrate_status: 'ok',
        merge_to_launch: false,
        status: 'complete',
      },
      next: 'blocked:open-pr',
    },
    {
      name: 'keep_worktree → done after reintegrate when tip on launch',
      in: {
        worktree_present: true,
        reintegrate_status: 'ok',
        keep_worktree: true,
        merge_to_launch: true,
        tip_on_launch: true,
        status: 'complete',
      },
      next: 'done',
    },
    {
      name: 'keep_worktree + merge false after reintegrate → open-pr',
      in: {
        worktree_present: true,
        reintegrate_status: 'ok',
        keep_worktree: true,
        merge_to_launch: false,
        status: 'complete',
      },
      next: 'blocked:open-pr',
    },
    {
      name: 'tip_on_launch false after reintegrate → open-pr even if merge true',
      in: {
        worktree_present: true,
        reintegrate_status: 'ok',
        merge_to_launch: true,
        tip_on_launch: false,
        status: 'complete',
      },
      next: 'blocked:open-pr',
    },
    {
      name: 'status-style worktree_exists + tip_on_launch=no → open-pr',
      in: {
        worktree_exists: 'yes',
        reintegrate_status: 'ok',
        merge_to_launch: 'true',
        tip_on_launch: 'no',
        keep_worktree: 'false',
        mid_rebase: 'no',
        launch_tracked_dirty: 'no',
        status: 'complete',
      },
      next: 'blocked:open-pr',
    },
    {
      name: 'status-style mid_rebase=no is not blocked:rebase-continue',
      in: {
        worktree_exists: 'yes',
        mid_rebase: 'no',
        reintegrate_status: null,
        merge_to_launch: 'true',
        status: 'complete',
      },
      next: 'reintegrate',
    },
    {
      name: 'status-style keep_worktree=false string still destroys',
      in: {
        worktree_exists: 'yes',
        reintegrate_status: 'ok',
        merge_to_launch: 'true',
        tip_on_launch: 'yes',
        keep_worktree: 'false',
        status: 'complete',
      },
      next: 'destroy',
    },
    {
      name: 'status-style keep_worktree=true + tip yes → done',
      in: {
        worktree_exists: 'yes',
        reintegrate_status: 'ok',
        merge_to_launch: 'true',
        tip_on_launch: 'yes',
        keep_worktree: 'true',
        status: 'complete',
      },
      next: 'done',
    },
    {
      name: 'destroy-failed',
      in: {
        worktree_present: true,
        reintegrate_status: 'ok',
        destroy_failed: true,
        merge_to_launch: true,
      },
      next: 'blocked:destroy-failed',
    },
    {
      name: 'done when no worktree terminal',
      in: { status: 'complete', worktree_present: false },
      next: 'done',
    },
    {
      name: 'reintegrate even merge_to_launch false before reint',
      in: {
        status: 'complete',
        worktree_present: true,
        reintegrate_status: null,
        merge_to_launch: false,
      },
      next: 'reintegrate',
    },
  ];

  for (const row of table) {
    it(`deriveNextAuto: ${row.name}`, function () {
      const r = d(row.in);
      expect(r.next_auto, JSON.stringify(r)).to.equal(row.next);
      expect(r.resume_hint).to.be.a('string').and.not.empty;
      if (row.auto === true) expect(r.auto_commit_ledger).to.equal(true);
      if (row.auto === false) expect(r.auto_commit_ledger).to.equal(false);
    });
  }

  it('CLI prints JSON for snapshot on stdin', function () {
    const r = spawnSync(process.execPath, [SCRIPT], {
      input: JSON.stringify({ status: 'active', under_caps: true }) + '\n',
      encoding: 'utf8',
    });
    expect(r.status, r.stderr).to.equal(0);
    const j = JSON.parse(r.stdout);
    expect(j.next_auto).to.equal('cycle');
  });

  it('CLI exits 1 on bad JSON', function () {
    const r = spawnSync(process.execPath, [SCRIPT], {
      input: 'not-json\n',
      encoding: 'utf8',
    });
    expect(r.status).to.equal(1);
  });
});
