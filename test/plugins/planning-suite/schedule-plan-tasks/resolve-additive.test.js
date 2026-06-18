// Q3 verification: resolve-additive-conflict.py mechanically combines HEAD + incoming
// lines from a purely-additive git conflict file, deterministically and verbatim.

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const RESOLVER = path.join(
  REPO_ROOT,
  'plugins/planning-suite/skills/schedule-plan-tasks/references/resolve-additive-conflict.py',
);

function tempFile(contents) {
  const p = path.join(os.tmpdir(), `resolve-additive-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(p, contents);
  return p;
}

describe('Q3 — resolve-additive-conflict.py', function () {
  it('resolves a single conflict block: HEAD lines first, then incoming', function () {
    const p = tempFile(
      [
        'shared:',
        '  - existing-a',
        '<<<<<<< HEAD',
        '  - lane-A-1',
        '  - lane-A-2',
        '=======',
        '  - lane-B-1',
        '>>>>>>> feature/lane-b',
        '  - existing-b',
        '',
      ].join('\n'),
    );
    try {
      execFileSync('python3', [RESOLVER, p]);
      const out = fs.readFileSync(p, 'utf8');
      expect(out).to.equal(
        [
          'shared:',
          '  - existing-a',
          '  - lane-A-1',
          '  - lane-A-2',
          '  - lane-B-1',
          '  - existing-b',
          '',
        ].join('\n'),
      );
    } finally {
      fs.unlinkSync(p);
    }
  });

  it('resolves multiple conflict blocks in one pass', function () {
    const p = tempFile(
      [
        '<<<<<<< HEAD',
        'A1',
        '=======',
        'B1',
        '>>>>>>> b',
        'middle',
        '<<<<<<< HEAD',
        'A2',
        '=======',
        'B2',
        '>>>>>>> b',
        '',
      ].join('\n'),
    );
    try {
      execFileSync('python3', [RESOLVER, p]);
      const out = fs.readFileSync(p, 'utf8');
      expect(out).to.equal(['A1', 'B1', 'middle', 'A2', 'B2', ''].join('\n'));
    } finally {
      fs.unlinkSync(p);
    }
  });

  it('is idempotent on already-resolved files (returns nonzero — no markers)', function () {
    const p = tempFile('clean: content\n');
    try {
      let threw = false;
      try {
        execFileSync('python3', [RESOLVER, p], { stdio: 'pipe' });
      } catch (e) {
        threw = true;
        expect(e.status).to.not.equal(0);
      }
      expect(threw).to.equal(true, 'resolver must exit nonzero when no conflict markers');
      // File unchanged.
      expect(fs.readFileSync(p, 'utf8')).to.equal('clean: content\n');
    } finally {
      fs.unlinkSync(p);
    }
  });

  it('SKILL.md references resolve-additive-conflict.py from the manual-resolve step', function () {
    const text = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'plugins/planning-suite/skills/schedule-plan-tasks/SKILL.md',
      ),
      'utf8',
    );
    expect(text).to.include('resolve-additive-conflict.py');
  });
});
