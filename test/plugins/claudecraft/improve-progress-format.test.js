'use strict';

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(REPO, 'plugins/claudecraft/tools/improve-progress-format.js');
const { formatProgressPulse } = require(SCRIPT);

describe('improve-progress-format.js', function () {
  it('formatProgressPulse requires cycle and emits greppable heading', function () {
    expect(() => formatProgressPulse({})).to.throw(/cycle/);
    const md = formatProgressPulse({
      cycle: 3,
      max_cycles: 8,
      iter: 3,
      pulse_kind: 'final',
      target: 'document claudecraft',
      campaign_goal: 'align progress with residual×2',
      status: 'active',
      outcome: 'confirmed',
      test: 'PASS',
      committed: 'yes',
      open_p01: 2,
      residual_streak: 0,
      step_id: '5-signal',
      item: 'P1:progress-align',
      action: 'emit final pulse',
      last_resolved: 'suite green',
      next: 'continuing cycle 4/8',
      changed_paths: ['README.md', 'CLAUDE.md'],
      change_notes: { 'README.md': 'add plugins table row' },
      learnings: ['marketplace update needed when plugin added after first install'],
    });
    expect(md.startsWith('## Improve progress — cycle 3/8 · iter 3 · final')).to.equal(true);
    expect(md).to.match(/\*\*Residual:\*\* 0\/2 · open P0\/P1 2 · suite PASS/);
    expect(md).to.match(/\*\*Now:\*\* `5-signal` · `P1:progress-align` · emit final pulse/);
    expect(md).to.match(/### This unit — key changes/);
    expect(md).to.match(/### This unit — key learnings/);
    expect(md).to.match(/README\.md: add plugins table row/);
    expect(md).to.match(/marketplace update needed/);
    expect(md).to.match(/\*\*Next:\*\* continuing cycle 4\/8/);
    // open_p01 present → no legacy checked/total residual primary
    expect(md).to.not.match(/Backlog: 2\/4 items checked/);
  });

  it('fixture residual 1/2: streak and open zero', function () {
    const md = formatProgressPulse({
      cycle: 5,
      max_cycles: 8,
      iter: 5,
      pulse_kind: 'gate',
      status: 'active',
      open_p01: 0,
      residual_streak: 1,
      test: 'PASS',
      suite: 'PASS',
      item: 'residual-survey',
      step_id: '3-replan',
      next: 'need residual cycle 2/2',
      changed_paths: [],
      learnings: [],
    });
    expect(md).to.match(/## Improve progress — cycle 5\/8 · iter 5 · gate/);
    expect(md).to.match(/\*\*Residual:\*\* 1\/2 · open P0\/P1 0 · suite PASS/);
    expect(md).to.match(/`residual-survey`/);
    expect(md).to.match(/\*\*Status:\*\* active/);
  });

  it('fixture 3v fail: Validation present; never force complete from Spec', function () {
    const md = formatProgressPulse({
      cycle: 3,
      max_cycles: 8,
      iter: 3,
      pulse_kind: 'final',
      // caller wrongly claims complete after Validation fail — R8d clamp
      status: 'complete',
      open_p01: 1,
      residual_streak: 0,
      test: 'PASS',
      item: 'P1:validate-V2',
      step_id: '5-signal',
      next: 'continuing cycle 4/8',
      validation:
        'Validation: 3 pass / 1 fail (V2) / 0 pending / 0 n/a · sync=iter 3',
      changed_paths: [],
      learnings: ['seeded validate V2'],
    });
    expect(md).to.match(/^## Improve progress/m);
    expect(md).to.match(/\*\*Status:\*\* active/);
    expect(md).to.not.match(/\*\*Status:\*\* complete/);
    expect(md).to.match(
      /Validation: 3 pass \/ 1 fail \(V2\) \/ 0 pending \/ 0 n\/a · sync=iter 3/
    );
    expect(md).to.match(/open P0\/P1 1/);
    expect(md).to.match(/`P1:validate-V2`/);
  });

  it('fixture terminal residual 2/2 complete', function () {
    const md = formatProgressPulse({
      cycle: 6,
      max_cycles: 8,
      iter: 6,
      pulse_kind: 'final',
      status: 'complete',
      open_p01: 0,
      residual_streak: 2,
      test: 'PASS',
      suite: 'PASS',
      next: 'campaign report · merge-back',
      validation: 'Validation: 4 pass / 0 fail / 0 pending / 0 n/a · sync=iter 6',
      changed_paths: [],
      learnings: ['residual×2 met'],
    });
    expect(md).to.match(/\*\*Status:\*\* complete/);
    expect(md).to.match(/\*\*Residual:\*\* 2\/2 · open P0\/P1 0 · suite PASS/);
    expect(md).to.match(/Validation: 4 pass \/ 0 fail/);
  });

  it('legacy backlog_* when open_p01 absent (A continuous compat)', function () {
    const md = formatProgressPulse({
      cycle: 1,
      status: 'active',
      backlog_done: 2,
      backlog_total: 4,
      changed_paths: [],
      learnings: [],
    });
    expect(md).to.match(/## Improve progress — cycle 1 \/ run/);
    expect(md).to.match(/\*\*Backlog \(legacy\):\*\* 2\/4 items checked/);
  });

  it('CLI entrypoint formats real JSON file (shipped binary path)', function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-prog-'));
    const f = path.join(dir, 'p.json');
    fs.writeFileSync(
      f,
      JSON.stringify({
        cycle: 1,
        outcome: 'partial',
        test: 'PASS',
        open_p01: 1,
        residual_streak: 0,
        changed_paths: [],
        learnings: [],
      })
    );
    const r = spawnSync(process.execPath, [SCRIPT, '--file', f], { encoding: 'utf8' });
    expect(r.status, r.stderr).to.equal(0);
    expect(r.stdout).to.match(/^## Improve progress — cycle 1/m);
    expect(r.stdout).to.match(/open P0\/P1 1/);
    expect(r.stdout).to.match(/no code landed/);
    expect(r.stdout).to.match(/none new/);
  });

  it('CLI exits 2 when cycle missing', function () {
    const r = spawnSync(process.execPath, [SCRIPT], {
      encoding: 'utf8',
      input: JSON.stringify({ target: 'x' }),
    });
    expect(r.status).to.equal(2);
  });
});
