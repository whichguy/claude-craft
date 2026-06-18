// Q2 verification: the orchestrator-merge SKILL.md contract.
//
// Asserts two things:
//   (1) The retries_exhausted arm of the merge bash does NOT abort the merge —
//       so the handler's `git diff --diff-filter=U` probe can still see conflict files.
//   (2) Handler step 4 (investigation fall-through) explicitly aborts the merge before
//       creating the investigation task, so the working tree is clean for the next op.
//
// We don't extract+run the merge bash here (would need a deeper SKILL.md restructure
// to make every fence individually invocable). Instead we assert the textual contract
// in SKILL.md AND complement with a small live-git fixture test that simulates the
// state the handler probe inspects.

const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SKILL_MD = path.join(
  REPO_ROOT,
  'plugins/planning-suite/skills/schedule-plan-tasks/SKILL.md',
);

function sh(cmd, opts = {}) {
  return execFileSync('bash', ['-c', cmd], { encoding: 'utf8', ...opts }).trim();
}

function mkTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'q2-merge-'));
  sh(`git init -q -b main "${dir}"`);
  sh(`git -C "${dir}" config user.email q2@test`);
  sh(`git -C "${dir}" config user.name Q2`);
  return dir;
}

describe('Q2 — merge handler state contract', function () {
  describe('SKILL.md textual contract', function () {
    let text;
    before(function () {
      text = fs.readFileSync(SKILL_MD, 'utf8');
    });

    it('retries_exhausted arm does NOT abort the merge inside the bash block', function () {
      // Find the retries_exhausted echo and confirm the preceding 4 lines do not
      // contain `git merge --abort` (negative regex over a narrow window).
      const idx = text.indexOf('MERGE_FAIL_REASON=retries_exhausted');
      expect(idx).to.be.greaterThan(-1, 'retries_exhausted echo must be present');
      const window = text.slice(Math.max(0, idx - 400), idx);
      expect(window).to.not.match(
        /git -C "\$REPO_ROOT" merge --abort\s*$\s*git -C "\$REPO_ROOT" checkout "\$UPSTREAM_BRANCH"\s*$\s*echo "MERGE_FAIL_REASON=retries_exhausted"/m,
        'merge --abort must not run immediately before the retries_exhausted echo',
      );
    });

    it('handler step 4 (investigation path) aborts the in-progress merge before TaskCreate', function () {
      // Locate the "If any condition fails" block and assert it contains an explicit abort.
      const stepIdx = text.indexOf('**If any condition fails → investigation path.**');
      expect(stepIdx).to.be.greaterThan(-1, 'handler step 4 must be present');
      const window = text.slice(stepIdx, stepIdx + 1200);
      expect(window).to.include('git -C "$REPO_ROOT" merge --abort');
      expect(window).to.include('git -C "$REPO_ROOT" checkout "$UPSTREAM_BRANCH"');
      // And the abort should appear before the TaskCreate sentence.
      const abortAt = window.indexOf('merge --abort');
      const taskCreateAt = window.indexOf('TaskCreate');
      expect(abortAt).to.be.greaterThan(-1);
      expect(taskCreateAt).to.be.greaterThan(abortAt);
    });

    it('handler step 3 references the concrete python resolver', function () {
      expect(text).to.include('resolve-additive-conflict.py');
    });
  });

  describe('live-git: handler probe sees conflict files when merge is left in conflict state', function () {
    // Verifies the upstream invariant: after a real additive conflict, BEFORE any abort,
    // `git diff --name-only --diff-filter=U` returns the conflicting file. This is the
    // state the K-Option-2 eligibility probe relies on.

    let repo;
    after(function () {
      if (repo) {
        try {
          fs.rmSync(repo, { recursive: true, force: true });
        } catch (_) {
          /* best effort */
        }
      }
    });

    it('diff --diff-filter=U lists the conflict file when merge is mid-conflict', function () {
      repo = mkTempRepo();
      fs.writeFileSync(path.join(repo, 'shared.txt'), 'base-line\n');
      sh(`git -C "${repo}" add shared.txt`);
      sh(`git -C "${repo}" commit -q -m base`);
      sh(`git -C "${repo}" checkout -q -b lane-a`);
      fs.writeFileSync(path.join(repo, 'shared.txt'), 'base-line\nlane-a-1\n');
      sh(`git -C "${repo}" add shared.txt`);
      sh(`git -C "${repo}" commit -q -m lane-a`);
      sh(`git -C "${repo}" checkout -q main`);
      sh(`git -C "${repo}" checkout -q -b lane-b`);
      fs.writeFileSync(path.join(repo, 'shared.txt'), 'base-line\nlane-b-1\n');
      sh(`git -C "${repo}" add shared.txt`);
      sh(`git -C "${repo}" commit -q -m lane-b`);
      // Attempt the merge; expect conflict (non-zero exit). Do NOT abort.
      let mergeFailed = false;
      try {
        execFileSync(
          'bash',
          ['-c', `git -C "${repo}" merge --no-ff lane-a -m m`],
          { stdio: 'pipe' },
        );
      } catch (_) {
        mergeFailed = true;
      }
      expect(mergeFailed).to.equal(true, 'merge must conflict on the additive change');

      const conflicts = sh(`git -C "${repo}" diff --name-only --diff-filter=U`);
      expect(conflicts.split('\n').filter(Boolean)).to.deep.equal(['shared.txt']);
    });
  });
});
