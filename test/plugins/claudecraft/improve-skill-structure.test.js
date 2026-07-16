'use strict';

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const CC = path.join(REPO, 'plugins/claudecraft');

const REQUIRED = [
  'skills/improve-loop/SKILL.md',
  'skills/improve/SKILL.md',
  'skills/improve-loop/references/INDEX.md',
  'skills/improve-loop/references/ledger-schema.md',
  'skills/improve-loop/references/phase-0-resume.md',
  'skills/improve-loop/references/phase-1-execute.md',
  'skills/improve-loop/references/phase-2-learn.md',
  'skills/improve-loop/references/phase-3-replan.md',
  'skills/improve-loop/references/phase-4-commit.md',
  'skills/improve-loop/references/phase-5-decision.md',
  'skills/improve-loop/references/contracts/goal.md',
  'skills/improve-loop/references/contracts/progress.md',
  'skills/improve-loop/references/contracts/executor.md',
  'skills/improve-loop/references/contracts/advisor.md',
  'skills/improve-loop/references/contracts/outer-loop.md',
  'skills/improve/references/parse.md',
  'skills/improve/references/lifecycle.md',
  'skills/improve/references/caps.md',
  'skills/improve/references/throttle.md',
  'tools/improve-worktree.sh',
  'tools/improve-progress-format.js',
];

const LAW_PHRASES = [
  'code-dirty veto',
  'disproven-thesis',
  'TEST_ARTIFACT_PATHS',
  'consecutive-no-progress',
  'ledger flush',
  'native-replanner fallback',
  'secret-shaped',
  'improve-loop: iteration',
];

describe('claudecraft improve skill structure', function () {
  it('ships all required skill / reference / tool files', function () {
    const missing = REQUIRED.filter((rel) => !fs.existsSync(path.join(CC, rel)));
    expect(missing, `missing:\n${missing.join('\n')}`).to.deep.equal([]);
  });

  it('improve-loop SKILL.md stays slim (operator card, not monolith)', function () {
    const text = fs.readFileSync(path.join(CC, 'skills/improve-loop/SKILL.md'), 'utf8');
    const lines = text.split('\n').length;
    expect(lines).to.be.lessThan(200);
    expect(text).to.match(/references\/phase-0-resume\.md/);
    expect(text).to.match(/contracts\/goal\.md/);
  });

  it('improve driver SKILL.md is procedural and points at worktree + improve-loop', function () {
    const text = fs.readFileSync(path.join(CC, 'skills/improve/SKILL.md'), 'utf8');
    expect(text).to.match(/S0/);
    expect(text).to.match(/S11/);
    expect(text).to.match(/improve-worktree\.sh/);
    expect(text).to.match(/improve-loop/);
    expect(text).to.match(/contracts\/goal\.md/);
  });

  it('normative law phrases still exist under improve-loop/references', function () {
    const refRoot = path.join(CC, 'skills/improve-loop/references');
    const blob = walk(refRoot).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const missing = LAW_PHRASES.filter((p) => !blob.includes(p));
    expect(missing, `missing law phrases:\n${missing.join('\n')}`).to.deep.equal([]);
  });

  it('goal contract does not require a product-specific slash as sole continuous path', function () {
    const text = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/contracts/goal.md'),
      'utf8'
    );
    expect(text).to.match(/native/i);
    expect(text).to.match(/must not.*only continuous path/i);
  });

  it('progress contract defines pulse schema and emit cadence', function () {
    const text = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/contracts/progress.md'),
      'utf8'
    );
    expect(text).to.match(/## Improve progress/);
    expect(text).to.match(/key learnings/i);
    expect(text).to.match(/key changes/i);
    expect(text).to.match(/goal\.report/);
    expect(text).to.match(/improve-progress-format\.js/);
    const loop = fs.readFileSync(path.join(CC, 'skills/improve-loop/SKILL.md'), 'utf8');
    expect(loop).to.match(/progress\.md/);
    expect(loop).to.match(/improve-progress-format\.js/);
    const driver = fs.readFileSync(path.join(CC, 'skills/improve/SKILL.md'), 'utf8');
    expect(driver).to.match(/progress pulse/i);
    expect(driver).to.match(/improve-progress-format\.js/);
    const p5 = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/phase-5-decision.md'),
      'utf8'
    );
    expect(p5).to.match(/improve-progress-format\.js/);
  });

  it('worktree script: detached isolation, source-branch merge, .git/improve-runs', function () {
    const text = fs.readFileSync(path.join(CC, 'tools/improve-worktree.sh'), 'utf8');
    expect(text).to.match(/\.git\/improve-runs/);
    expect(text).to.match(/single-flight/);
    expect(text).to.match(/worktree add --detach/);
    expect(text).to.match(/isolation.*detached|detached HEAD/i);
    expect(text).to.match(/rebase/);
    expect(text).to.match(/--no-merge-to-launch/);
    expect(text).to.match(/MERGE_TO_LAUNCH=1/);
    const life = fs.readFileSync(
      path.join(CC, 'skills/improve/references/lifecycle.md'),
      'utf8'
    );
    expect(life).to.match(/detached-HEAD|detached HEAD/i);
    expect(life).to.match(/No permanent|no permanent/i);
    expect(life).to.match(/S11a.*rebase|rebase worktree/i);
    const parse = fs.readFileSync(
      path.join(CC, 'skills/improve/references/parse.md'),
      'utf8'
    );
    expect(parse).to.match(/worktree.*\*\*on\*\*|worktree.*on/i);
    expect(parse).to.match(/merge_to_launch.*\*\*true\*\*|merge_to_launch.*true/i);
  });

  it('relative doc links from improve/references resolve on disk', function () {
    const life = path.join(CC, 'skills/improve/references/lifecycle.md');
    const text = fs.readFileSync(life, 'utf8');
    const m = text.match(/Progress schema: `([^`]+)`/);
    expect(m, 'lifecycle must cite progress schema path').to.not.equal(null);
    const resolved = path.resolve(path.dirname(life), m[1]);
    expect(fs.existsSync(resolved), resolved).to.equal(true);
  });

  it('contracts cross-links resolve as siblings (not contracts/contracts/)', function () {
    const goal = path.join(CC, 'skills/improve-loop/references/contracts/goal.md');
    const text = fs.readFileSync(goal, 'utf8');
    // Must not use nested contracts/ prefix from inside contracts/
    expect(text).to.not.match(/`contracts\/progress\.md`/);
    expect(fs.existsSync(path.join(path.dirname(goal), 'progress.md'))).to.equal(true);
  });
});

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.name.endsWith('.md')) out.push(p);
  }
  return out;
}
