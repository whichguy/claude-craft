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
  it('formatProgressPulse requires cycle and emits required sections', function () {
    expect(() => formatProgressPulse({})).to.throw(/cycle/);
    const md = formatProgressPulse({
      cycle: 3,
      target: 'document claudecraft',
      phase: 'S8 cycle',
      status: 'active',
      outcome: 'confirmed',
      test: 'PASS',
      committed: 'yes',
      backlog_done: 2,
      backlog_total: 4,
      max_cycles: 10,
      elapsed_m: 18,
      no_progress: 0,
      same_error: 0,
      until: 'README lists claudecraft',
      until_met: false,
      landed_count: 3,
      latest_subject: 'improve-loop: iteration 3 — docs',
      changed_paths: ['README.md', 'CLAUDE.md'],
      change_notes: { 'README.md': 'add plugins table row' },
      learnings: ['marketplace update needed when plugin added after first install'],
      next: 'add usage subsection',
      blockers: 'none',
    });
    expect(md.startsWith('## Improve progress — cycle 3 / run')).to.equal(true);
    expect(md).to.match(/### Progress/);
    expect(md).to.match(/### This unit — key changes/);
    expect(md).to.match(/### This unit — key learnings/);
    expect(md).to.match(/### Next/);
    expect(md).to.match(/Backlog: 2\/4/);
    expect(md).to.match(/README\.md: add plugins table row/);
    expect(md).to.match(/marketplace update needed/);
    expect(md).to.match(/Next backlog item: add usage subsection/);
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
        changed_paths: [],
        learnings: [],
      })
    );
    const r = spawnSync(process.execPath, [SCRIPT, '--file', f], { encoding: 'utf8' });
    expect(r.status, r.stderr).to.equal(0);
    expect(r.stdout).to.match(/^## Improve progress — cycle 1 \/ run/m);
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
