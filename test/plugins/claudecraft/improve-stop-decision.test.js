'use strict';

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { deriveStopDecision } = require(path.join(
  __dirname,
  '../../../plugins/claudecraft/tools/improve-stop-decision.js'
));

const SCRIPT = path.join(
  __dirname,
  '../../../plugins/claudecraft/tools/improve-stop-decision.js'
);

function base(partial) {
  return Object.assign(
    {
      mode: 'continuous',
      until_kind: 'default',
      status: 'active',
      p0_p1_remaining: 0,
      consecutive_non_material_cycles: 0,
      consecutive_same_error: 0,
      consecutive_no_progress: 0,
      suite_this_cycle: 'PASS',
      cap_reason: 'none',
      custom_until_met: false,
    },
    partial
  );
}

function d(partial) {
  return deriveStopDecision(base(partial));
}

describe('improve-stop-decision.js', function () {
  it('throws code 2 on non-object snapshot', function () {
    expect(() => deriveStopDecision(null)).to.throw(/object/);
    try {
      deriveStopDecision([]);
      expect.fail('expected throw');
    } catch (e) {
      expect(e.code).to.equal(2);
    }
  });

  describe('existing terminal status', function () {
    it('preserves complete', function () {
      expect(d({ status: 'complete' })).to.deep.equal({
        decision: 'complete',
        reason: 'existing-status',
      });
    });
    it('preserves stopped (...)', function () {
      expect(d({ status: 'stopped (same-error ×3)' })).to.deep.equal({
        decision: 'stop',
        reason: 'existing-status',
      });
    });
  });

  describe('stalls and caps', function () {
    it('same-error wins when both stalls ≥3', function () {
      expect(
        d({
          consecutive_same_error: 3,
          consecutive_no_progress: 5,
          consecutive_non_material_cycles: 2,
          suite_this_cycle: 'PASS',
        })
      ).to.deep.equal({ decision: 'stop', reason: 'same-error' });
    });
    it('no-progress stop', function () {
      expect(d({ consecutive_no_progress: 3 })).to.deep.equal({
        decision: 'stop',
        reason: 'no-progress',
      });
    });
    it('all cap reasons', function () {
      for (const cap of ['max_cycles', 'max_elapsed', 'budget']) {
        expect(d({ cap_reason: cap, consecutive_non_material_cycles: 2 })).to.deep.equal({
          decision: 'stop',
          reason: cap,
        });
      }
    });
    it('cap over satisfied until', function () {
      expect(
        d({
          cap_reason: 'max_cycles',
          p0_p1_remaining: 0,
          consecutive_non_material_cycles: 2,
          suite_this_cycle: 'PASS',
        })
      ).to.deep.equal({ decision: 'stop', reason: 'max_cycles' });
    });
  });

  describe('default until (continuous)', function () {
    it('open P0/P1 with streak 2 → continue', function () {
      expect(
        d({ p0_p1_remaining: 1, consecutive_non_material_cycles: 2, suite_this_cycle: 'PASS' })
      ).to.deep.equal({ decision: 'continue', reason: 'none' });
    });
    it('streak 0/1 not eligible → continue', function () {
      expect(d({ consecutive_non_material_cycles: 0 })).to.deep.equal({
        decision: 'continue',
        reason: 'none',
      });
      expect(d({ consecutive_non_material_cycles: 1 })).to.deep.equal({
        decision: 'continue',
        reason: 'none',
      });
    });
    it('eligible + PASS → complete', function () {
      expect(d({ consecutive_non_material_cycles: 2, suite_this_cycle: 'PASS' })).to.deep.equal({
        decision: 'complete',
        reason: 'until-default',
      });
    });
    it('eligible + none → confirm (carried PASS / no current suite)', function () {
      expect(d({ consecutive_non_material_cycles: 2, suite_this_cycle: 'none' })).to.deep.equal({
        decision: 'confirm',
        reason: 'none',
      });
    });
    it('eligible + FAIL → continue', function () {
      expect(d({ consecutive_non_material_cycles: 2, suite_this_cycle: 'FAIL' })).to.deep.equal({
        decision: 'continue',
        reason: 'none',
      });
    });
  });

  describe('custom until (continuous)', function () {
    it('unmet empty backlog → continue', function () {
      expect(
        d({
          until_kind: 'custom',
          custom_until_met: false,
          p0_p1_remaining: 0,
          consecutive_non_material_cycles: 99,
          suite_this_cycle: 'PASS',
        })
      ).to.deep.equal({ decision: 'continue', reason: 'none' });
    });
    it('met + PASS → complete (authoritative even with open backlog)', function () {
      expect(
        d({
          until_kind: 'custom',
          custom_until_met: true,
          p0_p1_remaining: 3,
          suite_this_cycle: 'PASS',
        })
      ).to.deep.equal({ decision: 'complete', reason: 'until-custom' });
    });
    it('met + none → confirm', function () {
      expect(
        d({
          until_kind: 'custom',
          custom_until_met: true,
          suite_this_cycle: 'none',
        })
      ).to.deep.equal({ decision: 'confirm', reason: 'none' });
    });
    it('met + FAIL → continue', function () {
      expect(
        d({
          until_kind: 'custom',
          custom_until_met: true,
          suite_this_cycle: 'FAIL',
        })
      ).to.deep.equal({ decision: 'continue', reason: 'none' });
    });
  });

  describe('once / until_kind none', function () {
    it('open backlog → continue', function () {
      expect(
        d({
          mode: 'once',
          until_kind: 'none',
          p0_p1_remaining: 2,
          suite_this_cycle: 'PASS',
        })
      ).to.deep.equal({ decision: 'continue', reason: 'none' });
    });
    it('empty + PASS → complete', function () {
      expect(
        d({ mode: 'once', until_kind: 'none', p0_p1_remaining: 0, suite_this_cycle: 'PASS' })
      ).to.deep.equal({ decision: 'complete', reason: 'once-empty-backlog' });
    });
    it('empty + none → confirm', function () {
      expect(
        d({ mode: 'once', until_kind: 'none', p0_p1_remaining: 0, suite_this_cycle: 'none' })
      ).to.deep.equal({ decision: 'confirm', reason: 'none' });
    });
    it('empty + FAIL → continue', function () {
      expect(
        d({ mode: 'once', until_kind: 'none', p0_p1_remaining: 0, suite_this_cycle: 'FAIL' })
      ).to.deep.equal({ decision: 'continue', reason: 'none' });
    });
  });

  describe('validity', function () {
    const invalidCases = [
      { name: 'invalid mode', partial: { mode: 'forever' } },
      { name: 'continuous+none', partial: { mode: 'continuous', until_kind: 'none' } },
      { name: 'once+custom', partial: { mode: 'once', until_kind: 'custom' } },
      { name: 'once+default', partial: { mode: 'once', until_kind: 'default' } },
      { name: 'bad suite', partial: { suite_this_cycle: 'GREEN' } },
      { name: 'bad cap', partial: { cap_reason: 'turns' } },
      { name: 'negative counter', partial: { p0_p1_remaining: -1 } },
      { name: 'bad until_kind', partial: { until_kind: 'maybe' } },
    ];
    for (const row of invalidCases) {
      it(`rejects ${row.name} with code 2`, function () {
        try {
          d(row.partial);
          expect.fail('expected throw');
        } catch (e) {
          expect(e.code, e.message).to.equal(2);
        }
      });
    }
  });

  describe('CLI', function () {
    it('stdin success', function () {
      const r = spawnSync(process.execPath, [SCRIPT], {
        input: JSON.stringify(base({ consecutive_non_material_cycles: 2 })) + '\n',
        encoding: 'utf8',
      });
      expect(r.status, r.stderr).to.equal(0);
      const j = JSON.parse(r.stdout);
      expect(j.decision).to.equal('complete');
      expect(j.reason).to.equal('until-default');
    });

    it('--file success', function () {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'improve-stop-'));
      const f = path.join(dir, 'snap.json');
      fs.writeFileSync(
        f,
        JSON.stringify(
          base({
            consecutive_non_material_cycles: 2,
            suite_this_cycle: 'none',
          })
        )
      );
      const r = spawnSync(process.execPath, [SCRIPT, '--file', f], { encoding: 'utf8' });
      expect(r.status, r.stderr).to.equal(0);
      expect(JSON.parse(r.stdout).decision).to.equal('confirm');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('malformed JSON → exit 1', function () {
      const r = spawnSync(process.execPath, [SCRIPT], {
        input: 'not-json\n',
        encoding: 'utf8',
      });
      expect(r.status).to.equal(1);
    });

    it('invalid combo → exit 2', function () {
      const r = spawnSync(process.execPath, [SCRIPT], {
        input: JSON.stringify(base({ mode: 'continuous', until_kind: 'none' })) + '\n',
        encoding: 'utf8',
      });
      expect(r.status).to.equal(2);
    });
  });
});
