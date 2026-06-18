// Q1 verification: render-pr-body.py works on macOS-portable mktemp/python invocation,
// and emits the expected "Sandboxes provisioned" markdown for typical refs.

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const RENDERER = path.join(
  REPO_ROOT,
  'plugins/planning-suite/skills/schedule-plan-tasks/references/render-pr-body.py',
);
const FIXTURE = path.join(__dirname, 'fixtures/sandbox-refs-sample.json');
const SKILL_MD = path.join(
  REPO_ROOT,
  'plugins/planning-suite/skills/schedule-plan-tasks/SKILL.md',
);

describe('Q1 — render-pr-body.py portability + output contract', function () {
  it('renderer exists and is invocable via python3', function () {
    expect(fs.existsSync(RENDERER)).to.equal(true, 'render-pr-body.py must exist');
  });

  it('emits a cleanup_hint inside backticks', function () {
    const out = execFileSync('python3', [RENDERER, FIXTURE], { encoding: 'utf8' });
    expect(out).to.include('- **gas** sandbox `AKfycXYZ_sample_script_id`');
    expect(out).to.include('  - Cleanup: `clasp open AKfycXYZ_sample_script_id');
  });

  it('emits a cleanup_note as plain prose (no backticks around the prose)', function () {
    const out = execFileSync('python3', [RENDERER, FIXTURE], { encoding: 'utf8' });
    expect(out).to.match(
      /^  - Cleanup: Scratch org will auto-expire in 7 days; no action needed$/m,
    );
  });

  it('emits sandbox_url and notes when present', function () {
    const out = execFileSync('python3', [RENDERER, FIXTURE], { encoding: 'utf8' });
    expect(out).to.include('https://script.google.com/d/AKfycXYZ_sample_script_id/edit');
    expect(out).to.include('Note: Forked from production script ABCDEF123');
  });

  it('handles a single-sandbox refs file without crashing', function () {
    const tmp = path.join(__dirname, 'fixtures/sandbox-refs-single.tmp.json');
    fs.writeFileSync(
      tmp,
      JSON.stringify({
        sandboxes: [{ type: 'gas', sandbox_ref: 'x', cleanup_hint: 'rm -rf x' }],
      }),
    );
    try {
      const out = execFileSync('python3', [RENDERER, tmp], { encoding: 'utf8' });
      expect(out).to.include('- **gas** sandbox `x`');
      expect(out).to.include('  - Cleanup: `rm -rf x`');
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('SKILL.md step 2.5 must NOT use GNU-only `mktemp --suffix=` (macOS portability)', function () {
    const text = fs.readFileSync(SKILL_MD, 'utf8');
    expect(text).to.not.match(/mktemp\s+--suffix/);
  });

  it('SKILL.md step 2.5 invokes references/render-pr-body.py (not an inline heredoc)', function () {
    const text = fs.readFileSync(SKILL_MD, 'utf8');
    expect(text).to.include('references/render-pr-body.py');
  });
});
