// S1 verification: the `swap_and_restore` helper documented in delivery-agent.md rule 1
// restores the tracked file to its prior state on EXIT (success OR failure), and removes
// the overlay-installed file when no prior version existed.
//
// We extract the helper definition by anchored markers and execute it against fixture
// directories. If the helper definition drifts away from a valid bash function, this
// test fails — making the rule executable, not just descriptive.

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DA_MD = path.join(REPO_ROOT, 'plugins/planning-suite/agents/delivery-agent.md');

function extractHelper() {
  const text = fs.readFileSync(DA_MD, 'utf8');
  const m = text.match(/swap_and_restore\(\)\s*\{[\s\S]*?\n\s*\}/);
  if (!m) throw new Error('swap_and_restore() function not found in delivery-agent.md');
  return m[0];
}

function mkSandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'swap-restore-'));
}

function runSwap(sandbox, script) {
  const helper = extractHelper();
  const full = `set -u\ncd "${sandbox}"\n${helper}\n${script}\n`;
  return execFileSync('bash', ['-c', full], { encoding: 'utf8' });
}

describe('S1 — swap_and_restore helper', function () {
  it('helper is defined exactly once in delivery-agent.md', function () {
    const text = fs.readFileSync(DA_MD, 'utf8');
    const matches = text.match(/^\s*swap_and_restore\(\)\s*\{/gm) || [];
    expect(matches.length).to.equal(1, 'helper must be defined exactly once');
  });

  it('restores the original tracked file after a successful deploy', function () {
    const sb = mkSandbox();
    try {
      fs.writeFileSync(path.join(sb, 'tracked.json'), '{"prod":true}\n');
      fs.mkdirSync(path.join(sb, '.sandbox-overlay'));
      fs.writeFileSync(path.join(sb, '.sandbox-overlay/tracked.json'), '{"sandbox":true}\n');
      runSwap(
        sb,
        `(
           swap_and_restore tracked.json .sandbox-overlay/tracked.json
           # verify overlay is installed mid-script
           cat tracked.json
         )`,
      );
      // After the subshell exits, EXIT trap fires and restores.
      expect(fs.readFileSync(path.join(sb, 'tracked.json'), 'utf8')).to.equal(
        '{"prod":true}\n',
      );
      expect(fs.existsSync(path.join(sb, 'tracked.json.preflight-bak'))).to.equal(false);
    } finally {
      fs.rmSync(sb, { recursive: true, force: true });
    }
  });

  it('restores the original tracked file even when the deploy errors', function () {
    const sb = mkSandbox();
    try {
      fs.writeFileSync(path.join(sb, 'tracked.json'), '{"prod":true}\n');
      fs.mkdirSync(path.join(sb, '.sandbox-overlay'));
      fs.writeFileSync(path.join(sb, '.sandbox-overlay/tracked.json'), '{"sandbox":true}\n');
      try {
        runSwap(
          sb,
          `(
             swap_and_restore tracked.json .sandbox-overlay/tracked.json
             false  # simulate deploy failure
           )`,
        );
      } catch (_) {
        /* expected nonzero exit */
      }
      expect(fs.readFileSync(path.join(sb, 'tracked.json'), 'utf8')).to.equal(
        '{"prod":true}\n',
      );
    } finally {
      fs.rmSync(sb, { recursive: true, force: true });
    }
  });

  it('removes the overlay-installed file when no prior tracked file existed', function () {
    const sb = mkSandbox();
    try {
      // No pre-existing tracked.json.
      fs.mkdirSync(path.join(sb, '.sandbox-overlay'));
      fs.writeFileSync(path.join(sb, '.sandbox-overlay/tracked.json'), '{"sandbox":true}\n');
      runSwap(
        sb,
        `(
           swap_and_restore tracked.json .sandbox-overlay/tracked.json
         )`,
      );
      expect(fs.existsSync(path.join(sb, 'tracked.json'))).to.equal(
        false,
        'tracked file must be cleaned up when there was no prior version',
      );
    } finally {
      fs.rmSync(sb, { recursive: true, force: true });
    }
  });

  it('sandbox-provisioner-prompt.md no longer ships per-CLI trap snippets', function () {
    const text = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'plugins/planning-suite/skills/schedule-plan-tasks/references/sandbox-provisioner-prompt.md',
      ),
      'utf8',
    );
    expect(text).to.not.include('.clasp.json.preflight-bak');
    expect(text).to.not.include('.firebaserc.preflight-bak');
    expect(text).to.not.include('.vercel.preflight-bak');
    // All three recipes must call the helper by name.
    expect(text).to.match(/swap_and_restore \.clasp\.json/);
    expect(text).to.match(/swap_and_restore \.firebaserc/);
    expect(text).to.match(/swap_and_restore \.vercel/);
  });
});
