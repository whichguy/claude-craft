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
  'tools/improve-next-auto.js',
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
  '## Driver',
  'next_auto',
  'resume_hint',
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

  it('continuous path is host goal + improve driver; no normative ralph / promise protocol', function () {
    const refRoot = path.join(CC, 'skills/improve-loop');
    const improveRoot = path.join(CC, 'skills/improve');
    // Exclude *learnings* banks (may record historical removals)
    const files = walk(refRoot)
      .concat(walk(improveRoot))
      .filter((f) => !/learnings/i.test(path.basename(f)));
    const blob = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    // No product re-invoke plugin as required continuous path
    expect(blob).to.not.match(/\/ralph-loop/);
    expect(blob).to.not.match(/ralph-loop\.local\.md/);
    expect(blob).to.not.match(/IMPROVE_LOOP_DONE/);
    expect(blob).to.not.match(/\bralph-loop\b/i);
    expect(blob).to.not.match(/stopped \(ralph max iterations\)/);
    // Goal iterates + improve driver present
    const outer = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/contracts/outer-loop.md'),
      'utf8'
    );
    const goal = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/contracts/goal.md'),
      'utf8'
    );
    expect(outer).to.match(/Host \*\*goal\*\*|host \*\*goal\*\*|Host goal/i);
    expect(outer).to.match(/improve.*driver|`improve` driver/i);
    expect(goal).to.match(/iterates|each iteration/i);
    expect(goal).to.match(/goal\.complete/);
    const p5 = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/phase-5-decision.md'),
      'utf8'
    );
    expect(p5).to.match(/goal\.complete/);
    expect(p5).to.match(/goal\.blocked/);
    expect(p5).to.match(/Status `complete`.*goal\.complete|complete` → \*\*`goal\.complete`/s);
    // Not-landed must not end host goal (complete or blocked)
    expect(p5).to.match(/do \*\*not\*\* call `goal\.complete` \*\*or\*\* `goal\.blocked`/);
    expect(p5).to.not.match(/<promise>/);
    // Stale INDEX / progress must not reintroduce re-invoke ranking or promise recipes
    const idx = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/INDEX.md'),
      'utf8'
    );
    expect(idx).to.not.match(/re-invoke ranking|Pulse, promises/i);
    expect(idx).to.match(/host goal|Host goal/i);
    const progress = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/contracts/progress.md'),
      'utf8'
    );
    expect(progress).to.not.match(/Re-invoke wrappers|promise rules unchanged/i);
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

  it('phase-5/0 + next-auto agree tip unmerged → blocked:open-pr not done', function () {
    const p5 = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/phase-5-decision.md'),
      'utf8'
    );
    const p0 = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/phase-0-resume.md'),
      'utf8'
    );
    const schema = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/ledger-schema.md'),
      'utf8'
    );
    // Must not tell agents next_auto=done while tip unmerged (stale phrasing)
    expect(p5).to.not.match(/merge_to_launch=false[\s\S]{0,80}or `?done`? with PR/i);
    expect(p5).to.match(/blocked:open-pr/);
    expect(p5).to.match(/tip_on_launch/);
    expect(p0).to.match(/tip_on_launch|tip is \*\*not\*\* on launch/i);
    expect(schema).to.match(/not.*done.*keep_worktree|keep_worktree/i);
    const nextAuto = fs.readFileSync(path.join(CC, 'tools/improve-next-auto.js'), 'utf8');
    expect(nextAuto).to.match(/tip_on_launch/);
    expect(nextAuto).to.match(/tipUnmerged|tip not on launch/i);
    // open-pr hint must not be merge_to_launch=false-only (tip_on_launch=no path)
    expect(nextAuto).to.match(
      /blocked:open-pr['"]:\s*[\s\S]{0,120}Tip not on launch|tip_on_launch/i
    );
  });

  it('continuous improve driver S12 gates destroy on tip_on_launch / open-pr', function () {
    const skill = fs.readFileSync(path.join(CC, 'skills/improve/SKILL.md'), 'utf8');
    const life = fs.readFileSync(
      path.join(CC, 'skills/improve/references/lifecycle.md'),
      'utf8'
    );
    expect(skill).to.match(/S12/);
    expect(skill).to.match(/blocked:open-pr/);
    expect(skill).to.match(/tip_on_launch/);
    // Must not claim done solely because keep_worktree when tip unmerged
    expect(skill).to.match(/even if `keep_worktree`|even if keep_worktree/i);
    expect(life).to.match(/blocked:open-pr/);
    expect(life).to.match(/tip_on_launch/);
    // Flowchart must not be bare "destroy unless keep_worktree" only
    expect(life).to.not.match(
      /S12 WT_DESTROY\s+destroy unless keep_worktree or S11 failed\s*\nS13 DONE/
    );
  });

  it('Driver section + disk rehydration + resume template are normative', function () {
    const ledger = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/ledger-schema.md'),
      'utf8'
    );
    expect(ledger).to.match(/## Driver/);
    expect(ledger).to.match(/\*\*next_auto:\*\*/);
    expect(ledger).to.match(/\*\*resume_hint:\*\*/);
    expect(ledger).to.match(/improve-loop: driver — next_auto/);
    expect(ledger).to.match(/\bnone\b/);
    // blocked token catalog (P1 completeness)
    for (const tok of [
      'rebase-continue',
      'worktree-dirty',
      'launch-dirty',
      'worktree-missing',
      'ambiguous-run',
      'path-relocated',
      'ledger-target-mismatch',
      'no-tests',
      'open-pr',
      'rebase-aborted',
      'destroy-failed',
    ]) {
      expect(ledger, `missing blocked token ${tok}`).to.match(new RegExp(tok));
    }

    const p0 = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/phase-0-resume.md'),
      'utf8'
    );
    expect(p0).to.match(/Rehydration|rehydrat/i);
    expect(p0).to.match(/not authoritative|untrusted/i);
    expect(p0).to.match(/blocked:rebase-continue|mid-rebase/i);
    expect(p0).to.match(/last two or three|last 2–3|2–3/i);
    expect(p0).to.match(/malformed|unparseable/i);
    expect(p0).to.match(/path-relocated|ledger-target-mismatch|open-pr|no-tests/);

    const p5 = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/phase-5-decision.md'),
      'utf8'
    );
    expect(p5).to.match(/Resume improve from disk/);
    expect(p5).to.match(/must automatically|automatically.*finish lifecycle/i);
    expect(p5).to.match(/Status `complete` does not skip teardown|does not skip teardown/i);
    expect(p5).to.match(/Anti-double-teardown|must not.*also reintegrate/i);
    expect(p5).to.match(/recover/i);
    expect(p5).to.match(/merge_to_launch=false|open-pr/);

    const life = fs.readFileSync(
      path.join(CC, 'skills/improve/references/lifecycle.md'),
      'utf8'
    );
    expect(life).to.match(/Resume improve from disk/);
    expect(life).to.match(/## Driver|Driver \+/);
    expect(life).to.match(/double teardown|Anti-double|no double/i);

    const idx = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/INDEX.md'),
      'utf8'
    );
    expect(idx).to.match(/Driver|Rehydration|resume template/i);

    const goal = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/contracts/goal.md'),
      'utf8'
    );
    expect(goal).to.match(/rehydrat|disk/i);

    const loop = fs.readFileSync(path.join(CC, 'skills/improve-loop/SKILL.md'), 'utf8');
    expect(loop).to.match(/Automation|automation/);
    expect(loop).to.match(/## Driver|Driver/);

    const improve = fs.readFileSync(path.join(CC, 'skills/improve/SKILL.md'), 'utf8');
    expect(improve).to.match(/## Driver|Driver write/);
    expect(improve).to.match(/resume template|Resume|recover/i);

    expect(fs.existsSync(path.join(CC, 'tools/improve-next-auto.js'))).to.equal(true);
    expect(p0).to.match(/improve-next-auto\.js/);
    expect(improve).to.match(/improve-next-auto\.js/);
  });

  it('continuous defaults: clear target → continuous + until P0/P1×2 on disk', function () {
    const parse = fs.readFileSync(
      path.join(CC, 'skills/improve/references/parse.md'),
      'utf8'
    );
    const caps = fs.readFileSync(
      path.join(CC, 'skills/improve/references/caps.md'),
      'utf8'
    );
    const improve = fs.readFileSync(path.join(CC, 'skills/improve/SKILL.md'), 'utf8');
    expect(parse).to.match(/continuous.*target is clear|target is clear.*continuous/i);
    expect(parse).to.match(/no material P0\/P1 for 2 consecutive cycles/);
    expect(parse).to.match(/proceed|Do \*\*not\*\* wait for.*confirm/i);
    expect(caps).to.match(/consecutive-non-material-cycles/);
    expect(caps).to.match(/Until satisfied|until satisfied|streak >= 2|streak ≥ 2/i);
    expect(improve).to.match(/no material P0\/P1 for 2 consecutive cycles/);
    expect(improve).to.match(/\*\*until\*\*/i);
    const ledger = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/ledger-schema.md'),
      'utf8'
    );
    expect(ledger).to.match(/\*\*Until:\*\*/);
    expect(ledger).to.match(/\*\*Max cycles:\*\*/);
    expect(ledger).to.match(/consecutive-non-material-cycles/);
    expect(ledger).to.match(/\*\*until:\*\*/);
    expect(ledger).to.match(/cycle_index/);
    const p2 = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/phase-2-learn.md'),
      'utf8'
    );
    expect(p2).to.match(/consecutive-non-material-cycles|non-material/);
    expect(p2).to.match(/default = material|default when code lands/i);
    // P2/YAGNI row must appear before default material non-empty row (table order)
    const p2idx = p2.indexOf('P2/YAGNI-only');
    const matIdx = p2.indexOf('default = material');
    expect(p2idx).to.be.greaterThan(-1);
    expect(matIdx).to.be.greaterThan(-1);
    expect(p2idx).to.be.lessThan(matIdx);
    const p3 = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/phase-3-replan.md'),
      'utf8'
    );
    expect(p3).to.match(/consecutive-non-material-cycles >= 2|Until P0\/P1/);
    expect(p3).to.match(/non-empty and not `none`|until` is \*\*non-empty/i);
    const caps2 = fs.readFileSync(
      path.join(CC, 'skills/improve/references/caps.md'),
      'utf8'
    );
    expect(caps2).to.match(/cycle_index >= max_cycles|cycle_index.*max_cycles/);
    const outer = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/contracts/outer-loop.md'),
      'utf8'
    );
    expect(outer).to.match(/State handoff|write mode\/until\/max_cycles/i);
    const life = fs.readFileSync(
      path.join(CC, 'skills/improve/references/lifecycle.md'),
      'utf8'
    );
    expect(life).to.match(/until: no-P0\/P1|no-P0\/P1×2/);
  });

  it('dirty launch bootstraps worktree carry+drain instead of hard-stop only', function () {
    const p0 = fs.readFileSync(
      path.join(CC, 'skills/improve-loop/references/phase-0-resume.md'),
      'utf8'
    );
    expect(p0).to.match(/create \+ carry|create\+carry|create --repo/i);
    expect(p0).to.match(/carry/i);
    expect(p0).to.match(/drains? launch|launch.*drain|drain.*launch/i);
    expect(p0).to.match(/active tree/i);
    const life = fs.readFileSync(
      path.join(CC, 'skills/improve/references/lifecycle.md'),
      'utf8'
    );
    expect(life).to.match(/drain/i);
    const script = fs.readFileSync(path.join(CC, 'tools/improve-worktree.sh'), 'utf8');
    expect(script).to.match(/draining launch WIP|launch drained/i);
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
