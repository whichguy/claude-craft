'use strict';

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const CC = path.join(REPO, 'plugins/claudecraft');

const REQUIRED = [
  'skills/improve-loop/SKILL.md', // B runtime monolith (shipped)
  'skills/improve/SKILL.md',
  'law/improve-loop/INDEX.md',
  'law/improve-loop/operator-card.md',
  'law/improve-loop/ledger-schema.md',
  'law/improve-loop/phase-0-resume.md',
  'law/improve-loop/phase-1-execute.md',
  'law/improve-loop/phase-2-learn.md',
  'law/improve-loop/phase-3-replan.md',
  'law/improve-loop/phase-3v-validate.md',
  'law/improve-loop/phase-4-commit.md',
  'law/improve-loop/phase-5-decision.md',
  'law/improve-loop/contracts/goal.md',
  'law/improve-loop/contracts/progress.md',
  'law/improve-loop/contracts/executor.md',
  'law/improve-loop/contracts/advisor.md',
  'law/improve-loop/contracts/planning.md',
  'law/improve-loop/contracts/outer-loop.md',
  'law/improve-loop/dual-home.md',
  'skills/improve/references/parse.md',
  'skills/improve/references/lifecycle.md',
  'skills/improve/references/caps.md',
  'skills/improve/references/throttle.md',
  'tools/improve-worktree.sh',
  'tools/improve-progress-format.js',
  'tools/improve-next-auto.js',
  'tools/improve-stop-decision.js',
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

  it('improve-loop law operator-card stays slim; shipped SKILL is B monolith', function () {
    const card = fs.readFileSync(path.join(CC, 'law/improve-loop/operator-card.md'), 'utf8');
    const lines = card.split('\n').length;
    expect(lines).to.be.lessThan(200);
    expect(card).to.match(/phase-0-resume\.md/);
    expect(card).to.match(/contracts\/goal\.md/);
    const ship = fs.readFileSync(path.join(CC, 'skills/improve-loop/SKILL.md'), 'utf8');
    expect(ship).to.match(/Home B \(runtime monolith\)|Campaign architecture/i);
    expect(ship.split('\n').length).to.be.greaterThan(500);
  });

  it('improve driver SKILL.md is procedural and points at worktree + improve-loop', function () {
    const text = fs.readFileSync(path.join(CC, 'skills/improve/SKILL.md'), 'utf8');
    expect(text).to.match(/S0/);
    expect(text).to.match(/S11/);
    expect(text).to.match(/improve-worktree\.sh/);
    expect(text).to.match(/improve-loop/);
    expect(text).to.match(/contracts\/goal\.md/);
  });

  it('improve campaign shape: create once → iterate in worktree → reintegrate once', function () {
    const skill = fs.readFileSync(path.join(CC, 'skills/improve/SKILL.md'), 'utf8');
    expect(skill).to.match(/Campaign shape/i);
    expect(skill).to.match(/create \(once\)|create once/i);
    expect(skill).to.match(/reintegrate\s+→\s+once|reintegrate once/i);
    expect(skill).to.match(/Not\*\* merge after every cycle|Not merge after every cycle/i);
    expect(skill).to.match(/no permanent improve\/\*|no permanent.*branch/i);
    expect(skill).to.match(/improve-loop.*one cycle|one cycle only/i);
    const life = fs.readFileSync(
      path.join(CC, 'skills/improve/references/lifecycle.md'),
      'utf8'
    );
    expect(life).to.match(/Worktree campaign model/i);
    expect(life).to.match(/Create once|create once/i);
    expect(life).to.match(/reintegrate once|once at end/i);
    expect(life).to.match(/not.*after every cycle|Not\*\* after every cycle/i);
  });

  it('normative law phrases still exist under improve-loop/references', function () {
    const refRoot = path.join(CC, 'law/improve-loop');
    const blob = walk(refRoot).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const missing = LAW_PHRASES.filter((p) => !blob.includes(p));
    expect(missing, `missing law phrases:\n${missing.join('\n')}`).to.deep.equal([]);
  });

  it('goal contract does not require a product-specific slash as sole continuous path', function () {
    const text = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/goal.md'),
      'utf8'
    );
    expect(text).to.match(/native/i);
    expect(text).to.match(/must not.*only continuous path/i);
  });

  it('continuous path is host goal + improve driver; no normative ralph / promise protocol', function () {
    const refRoot = path.join(CC, 'law/improve-loop');
    const improveRoot = path.join(CC, 'skills/improve');
    // Law + improve driver only (B monolith may *forbid* ralph by name — that is OK)
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
    // B may mention ralph only to forbid it
    const ship = fs.readFileSync(path.join(CC, 'skills/improve-loop/SKILL.md'), 'utf8');
    expect(ship).to.match(/Do not\*\* wrap improve-loop in ralph|do not wrap.*ralph/i);
    // Goal iterates + improve driver present
    const outer = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/outer-loop.md'),
      'utf8'
    );
    const goal = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/goal.md'),
      'utf8'
    );
    expect(outer).to.match(/Host \*\*goal\*\*|host \*\*goal\*\*|Host goal/i);
    expect(outer).to.match(/improve.*driver|`improve` driver/i);
    expect(goal).to.match(/iterates|each iteration/i);
    expect(goal).to.match(/goal\.complete/);
    const p5 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-5-decision.md'),
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
      path.join(CC, 'law/improve-loop/INDEX.md'),
      'utf8'
    );
    expect(idx).to.not.match(/re-invoke ranking|Pulse, promises/i);
    expect(idx).to.match(/host goal|Host goal/i);
    const progress = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/progress.md'),
      'utf8'
    );
    expect(progress).to.not.match(/Re-invoke wrappers|promise rules unchanged/i);
  });

  it('progress contract defines pulse schema and emit cadence', function () {
    const text = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/progress.md'),
      'utf8'
    );
    expect(text).to.match(/## Improve progress/);
    expect(text).to.match(/key learnings/i);
    expect(text).to.match(/key changes/i);
    expect(text).to.match(/goal\.report/);
    expect(text).to.match(/improve-progress-format\.js/);
    const loop = fs.readFileSync(path.join(CC, 'skills/improve-loop/SKILL.md'), 'utf8');
    // B monolith owns Status reporting templates; may cite progress contract or emit shapes inline
    expect(loop).to.match(/PLAN_ORIENT|progress\.md|Status reporting/i);
    const card = fs.readFileSync(path.join(CC, 'law/improve-loop/operator-card.md'), 'utf8');
    expect(card).to.match(/progress\.md|improve-progress-format\.js/);
    const driver = fs.readFileSync(path.join(CC, 'skills/improve/SKILL.md'), 'utf8');
    expect(driver).to.match(/progress pulse/i);
    expect(driver).to.match(/improve-progress-format\.js/);
    const p5 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-5-decision.md'),
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
    const goal = path.join(CC, 'law/improve-loop/contracts/goal.md');
    const text = fs.readFileSync(goal, 'utf8');
    // Must not use nested contracts/ prefix from inside contracts/
    expect(text).to.not.match(/`contracts\/progress\.md`/);
    expect(fs.existsSync(path.join(path.dirname(goal), 'progress.md'))).to.equal(true);
  });

  it('phase-5/0 + next-auto agree tip unmerged → blocked:open-pr not done', function () {
    const p5 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-5-decision.md'),
      'utf8'
    );
    const p0 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-0-resume.md'),
      'utf8'
    );
    const schema = fs.readFileSync(
      path.join(CC, 'law/improve-loop/ledger-schema.md'),
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
      path.join(CC, 'law/improve-loop/ledger-schema.md'),
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
      path.join(CC, 'law/improve-loop/phase-0-resume.md'),
      'utf8'
    );
    expect(p0).to.match(/Rehydration|rehydrat/i);
    expect(p0).to.match(/not authoritative|untrusted/i);
    expect(p0).to.match(/blocked:rebase-continue|mid-rebase/i);
    expect(p0).to.match(/last two or three|last 2–3|2–3/i);
    expect(p0).to.match(/malformed|unparseable/i);
    expect(p0).to.match(/path-relocated|ledger-target-mismatch|open-pr|no-tests/);

    const p5 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-5-decision.md'),
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
      path.join(CC, 'law/improve-loop/INDEX.md'),
      'utf8'
    );
    expect(idx).to.match(/Driver|Rehydration|resume template/i);

    const goal = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/goal.md'),
      'utf8'
    );
    expect(goal).to.match(/rehydrat|disk/i);

    const loop = fs.readFileSync(path.join(CC, 'skills/improve-loop/SKILL.md'), 'utf8');
    // B: autonomous L1 campaign (not the A "Automation" operator-card row)
    expect(loop).to.match(/autonomous|L1|Campaign driver/i);
    expect(loop).to.match(/IMPROVE_LOOP\.md|live ledger|## Driver|Driver/i);

    const improve = fs.readFileSync(path.join(CC, 'skills/improve/SKILL.md'), 'utf8');
    expect(improve).to.match(/## Driver|Driver write|Procedure/i);
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
      path.join(CC, 'law/improve-loop/ledger-schema.md'),
      'utf8'
    );
    expect(ledger).to.match(/\*\*Until:\*\*/);
    expect(ledger).to.match(/\*\*Max cycles:\*\*/);
    expect(ledger).to.match(/consecutive-non-material-cycles/);
    expect(ledger).to.match(/\*\*until:\*\*/);
    expect(ledger).to.match(/cycle_index/);
    const p2 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-2-learn.md'),
      'utf8'
    );
    expect(p2).to.match(/consecutive-non-material-cycles|non-material/);
    expect(p2).to.match(/default = material|default when code lands/i);
    // Empty-backlog under default until must +1 non-material streak (two clean surveys)
    expect(p2).to.match(/default P0\/P1×2 form|default P0\/P1x2 form/i);
    expect(p2).to.match(/as non-material \*\*\+1\*\*/i);
    expect(p2).to.match(/empty-backlog lightweight path/i);
    // P2/YAGNI row must appear before default material non-empty row (table order)
    const p2idx = p2.indexOf('P2/YAGNI-only');
    const matIdx = p2.indexOf('default = material');
    expect(p2idx).to.be.greaterThan(-1);
    expect(matIdx).to.be.greaterThan(-1);
    expect(p2idx).to.be.lessThan(matIdx);
    const p3 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-3-replan.md'),
      'utf8'
    );
    expect(p3).to.match(/consecutive-non-material-cycles >= 2|Until P0\/P1/);
    expect(p3).to.match(/non-empty and not `none`|until` is \*\*non-empty/i);
    // Default until: rule 4 empty-backlog complete must be suppressed (streak≥2 only)
    expect(p3).to.match(/Suppress rule 4 when default until is active/i);
    expect(p3).to.match(/do not\*\* set Status `complete` here|do not set Status `complete` here/i);
    expect(p3).to.match(/only rule 3|streak ≥ 2|streak >= 2/i);
    // Zero open P0/P1 required; no carried-PASS complete; Confirm path present
    expect(p3).to.match(/zero unchecked \*\*P0\/P1\*\*|zero unchecked P0\/P1/i);
    expect(p3).to.match(/current-cycle PASS|this cycle's suite is green/i);
    expect(p3).to.match(/Do \*\*not\*\* complete on "the last non-material cycle was PASS"|Do not complete on "the last non-material cycle was PASS"/i);
    expect(p3).to.match(/Confirm path|verification cycle required/i);
    expect(p3).to.match(/Also suppress rule 4 for custom/i);
    const caps2 = fs.readFileSync(
      path.join(CC, 'skills/improve/references/caps.md'),
      'utf8'
    );
    expect(caps2).to.match(/cycle_index >= max_cycles|cycle_index.*max_cycles/);
    expect(caps2).to.match(/Custom until|custom until/i);
    expect(caps2).to.match(/must evaluate the until text|evaluate the until text/i);
    expect(caps2).to.match(/rule 4 is suppressed|rule 4.*suppressed/i);
    const outer = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/outer-loop.md'),
      'utf8'
    );
    expect(outer).to.match(/State handoff|write mode\/until\/max_cycles/i);
    // Host goal (preferred continuous path) must evaluate custom until — not S8-only
    expect(outer).to.match(/Host-goal|host goal|Outer host/i);
    expect(outer).to.match(/Custom non-empty|custom until|Custom until/i);
    expect(outer).to.match(/rule 4.*suppressed|suppressed.*rule 4/i);
    const goal = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/goal.md'),
      'utf8'
    );
    expect(goal).to.match(/Custom until/);
    expect(goal).to.match(/evaluate the until text against disk|against disk|until text vs disk/i);
    expect(goal).to.match(/host goal turn|Outer host|goal facility|improve S8/i);
    expect(goal).to.match(/Empty P0\/P1 backlog alone is \*\*not\*\* enough|zero unchecked P0\/P1/i);
    // Canonical stop table: confirm row + no carried-PASS complete
    expect(goal).to.match(/canonical table|Stop predicate \(shared\) — canonical/i);
    expect(goal).to.match(/\*\*Confirm\*\*|Confirm — stay active/i);
    expect(goal).to.match(/Do \*\*not\*\* complete on "last non-material cycle was PASS"|Do not complete on "last non-material cycle was PASS"/i);
    expect(goal).to.match(/Precedence \(first match wins\)|terminal status → same-error/i);
    expect(goal).to.match(/improve-stop-decision\.js|deriveStopDecision/i);
    expect(goal).to.match(/classifyUntilKind/);
    expect(goal).to.match(/DEFAULT_UNTIL|no material P0\/P1 for 2 consecutive cycles/i);
    const capsStop = fs.readFileSync(
      path.join(CC, 'skills/improve/references/caps.md'),
      'utf8'
    );
    expect(capsStop).to.match(/classifyUntilKind/);
    expect(capsStop).to.match(/deriveStopDecision/);
    // Learnings bank includes 0.1.2 series SHAs
    const learn = fs.readFileSync(
      path.join(CC, 'law/improve-loop/improve-loop-learnings.md'),
      'utf8'
    );
    expect(learn).to.match(/2898159/);
    expect(learn).to.match(/e3b9a22/);
    expect(learn).to.match(/ee57287/);
    expect(learn).to.match(/149cedc/);
    // Ownership: improve-loop once-mode may create/reintegrate; continuous uses improve driver
    const lifeOwn = fs.readFileSync(
      path.join(CC, 'skills/improve/references/lifecycle.md'),
      'utf8'
    );
    expect(lifeOwn).to.match(/Ownership split|standalone once-mode/i);
    expect(lifeOwn).to.not.match(/improve-loop` never create\/reintegrates|never create\/reintegrates/i);
    // Continuous + empty until on rehydrate → write fixed default
    const p0 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-0-resume.md'),
      'utf8'
    );
    expect(p0).to.match(/Continuous \+ empty until|continuous.*empty until/i);
    expect(p0).to.match(/no material P0\/P1 for 2 consecutive cycles/);
    expect(parse).to.match(/no-criteria default|No-criteria/i);
    expect(improve).to.match(/No-criteria stop|no criteria specified/i);
    expect(improve).to.match(/rule 4.*suppressed|suppressed under this default/i);
    // S9 stop-reason catalog includes custom until short form
    const life = fs.readFileSync(
      path.join(CC, 'skills/improve/references/lifecycle.md'),
      'utf8'
    );
    expect(life).to.match(/until: <short>/);
    expect(life).to.match(/until: no-P0\/P1|no-P0\/P1×2/);
    const improveSkill = fs.readFileSync(path.join(CC, 'skills/improve/SKILL.md'), 'utf8');
    expect(improveSkill).to.match(/until: <short>/);
  });

  it('confirm verification: Phase 0 exception runs suite despite empty backlog', function () {
    const p0 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-0-resume.md'),
      'utf8'
    );
    const p1 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-1-execute.md'),
      'utf8'
    );
    const p3 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-3-replan.md'),
      'utf8'
    );
    expect(p0).to.match(/confirm: verification cycle required/);
    expect(p0).to.match(/despite empty backlog|empty backlog/);
    expect(p0).to.match(/Confirm exception|recorded test command/i);
    expect(p0).to.match(/do \*\*not\*\* take the no-suite lightweight|not\*\* take the no-suite/i);
    expect(p3).to.match(/confirm: verification cycle required/);
    expect(p1).to.match(/confirm: verification cycle required|Confirm \/ empty-backlog/i);
  });

  it('material backlog contract: six-clause seed, residual thin, handoff + replan fidelity', function () {
    const ledger = fs.readFileSync(
      path.join(CC, 'law/improve-loop/ledger-schema.md'),
      'utf8'
    );
    const p0 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-0-resume.md'),
      'utf8'
    );
    const p1 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-1-execute.md'),
      'utf8'
    );
    const p3 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-3-replan.md'),
      'utf8'
    );
    const exec = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/executor.md'),
      'utf8'
    );

    // Ledger: material six-clause + residual thin + kind taxonomy
    expect(ledger).to.match(/Backlog item contract/i);
    expect(ledger).to.match(/Evidence:/);
    expect(ledger).to.match(/Decision:/);
    expect(ledger).to.match(/Preserve:/);
    expect(ledger).to.match(/Unknown:/);
    expect(ledger).to.match(/Acceptance:/);
    expect(ledger).to.match(/\[residual\]/);
    expect(ledger).to.match(/defect\|product-choice\|architecture\|implementation/);
    expect(ledger).to.match(/thin template|Evidence \+ Acceptance/i);
    expect(ledger).to.match(/No invented Decision\/Preserve|Do \*\*not\*\* invent fake Decision/i);
    expect(ledger).to.match(/P2.*optional.*YAGNI|YAGNI.*one-line/i);

    // Phase 0: fresh-seed discriminates on kind tag
    expect(p0).to.match(/Fresh-seed contract|fresh-seed contract/i);
    expect(p0).to.match(/six-clause|Evidence.*Decision.*Preserve/i);
    expect(p0).to.match(/\[residual\]|residual.*thin/i);
    expect(p0).to.match(/kind tag|on the kind tag/i);
    expect(p0).to.match(/Do \*\*not\*\* invent Decision\/Preserve for residual|not invent Decision\/Preserve for residual/i);

    // Phase 1: material handoff wording
    expect(p1).to.match(/Material intent handoff|material intent handoff/i);
    expect(p1).to.match(/Decision.*Preserve.*Acceptance|Change.*Decision.*Preserve.*Acceptance/i);
    expect(p1).to.match(/silently reinterpret|must \*\*not\*\* silently reinterpret/i);
    expect(p1).to.match(/contradictory evidence/i);
    expect(exec).to.match(/Decision.*Preserve|silently reinterpret/i);

    // Phase 3: taxonomy + fidelity locks
    expect(p3).to.match(/must-fix/);
    expect(p3).to.match(/decision/);
    expect(p3).to.match(/simplify/);
    expect(p3).to.match(/defer/);
    expect(p3).to.match(/Intent fidelity|fidelity locks/i);
    expect(p3).to.match(/Cannot\*\* silently drop|cannot silently drop|silently drop Decision/i);
    expect(p3).to.match(/six-clause|thin Evidence/i);
    // P2 exempt stated somewhere in contract chain
    expect(ledger + p0).to.match(/P2.*exempt|exempt from six-clause|one-line only/i);
  });

  it('PLAN_VALIDATE + R8: Spec validation gate greppable; residual×2 sole complete', function () {
    const planning = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/planning.md'),
      'utf8'
    );
    const p3v = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-3v-validate.md'),
      'utf8'
    );
    const skill = fs.readFileSync(path.join(CC, 'skills/improve-loop/SKILL.md'), 'utf8');
    const p5 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-5-decision.md'),
      'utf8'
    );
    const progress = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/progress.md'),
      'utf8'
    );
    const p1 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-1-execute.md'),
      'utf8'
    );
    const p3 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-3-replan.md'),
      'utf8'
    );
    const index = fs.readFileSync(
      path.join(CC, 'law/improve-loop/INDEX.md'),
      'utf8'
    );

    // Phase index + required file
    expect(skill).to.match(/3v|phase-3v-validate/);
    expect(index).to.match(/phase-3v-validate/);
    expect(index).to.match(/R1–R8|R1-R8/);

    // Law table R1–R8
    // Heading may include R8b–R8d when the table covers those rows (structure pass S7)
    expect(planning).to.match(
      /Sequencing rules \(R1–R8(?:, R8b–R8d)?\)|Sequencing rules \(R1-R8(?:, R8b-R8d)?\)/
    );
    expect(planning).to.match(/\*\*R8\*\*/);
    expect(planning).to.match(/\*\*R8b\*\*/);
    expect(planning).to.match(/never.*terminal Status|never a terminal Status/i);
    expect(planning).to.match(/residual×2|residual\*2|sole Status complete/i);

    // 3v gate + R8 auto-iterate
    expect(p3v).to.match(/never.*L1 exit reason|never a terminal Status/i);
    expect(p3v).to.match(/validate V</);
    expect(p3v).to.match(/fix target: product/);

    // Unintended-change check-in (Preserve / regression / scope)
    expect(planning).to.match(/Unintended-change check-in/i);
    expect(planning).to.match(/Preserve[\s\S]{0,200}Regression[\s\S]{0,200}Scope/i);

    // PLAN_SPEC_SYNC — live plan-derived Spec
    expect(planning).to.match(/PLAN_SPEC_SYNC/);
    expect(planning).to.match(/plan anchor|plan-derived|derived from plan/i);
    expect(planning).to.match(/spec-sync: iter/);
    expect(planning).to.match(/re-read|applied ledger|pre-guard/i);
    expect(planning).to.match(/Forbidden as sole content|no plan anchor/i);

    // PLAN_SPEC_STATUS — control channel (ASCII tokens; progress contract)
    expect(progress).to.match(/PLAN_SPEC_STATUS|3-spec-sync/);
    expect(progress).to.match(/Spec prove/);
    expect(progress).to.match(/Spec sync/);
    expect(progress).to.match(/Validation:.*pass.*fail|Validation: N pass/i);
    expect(progress).to.match(/spec-sync: iter/);
    expect(p3v).to.match(/PLAN_SPEC_SYNC|Spec prove|3v-prove/);

    // PLAN_ORIENT — tab-switch / mid-cycle orientation (ASCII tokens)
    expect(progress).to.match(/PLAN_ORIENT/);
    expect(progress).to.match(/improve goal ·/);
    expect(progress).to.match(/· on:/);
    expect(progress).to.match(/\(cont\)/);
    expect(progress).to.match(/Orientation triplet|orientation triplet/i);
    expect(p1).to.match(/PLAN_ORIENT|improve goal/);
    expect(p3).to.match(/PLAN_ORIENT|improve goal/);

    // PLAN_PROGRESS_ALIGN — formatter residual meter + open P0/P1
    expect(progress).to.match(/PLAN_PROGRESS_ALIGN/);
    expect(progress).to.match(/open P0\/P1/);
    expect(progress).to.match(/cycle K\/MAX|cycle \$\{cycle\}|cycle K/);
    expect(p5).to.match(/PLAN_PROGRESS_ALIGN|open P0\/P1/);

    // R8d at pulse emission (Phase 5 / progress)
    expect(p5).to.match(/R8d|continuing.*cycle K\+1|never.*campaign .?done/i);
    expect(progress).to.match(/continuing|R8d/i);
  });

  it('planning contract: brief, tiers, dual tag samples, classify, PLAN_APPLY fork', function () {
    const planning = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/planning.md'),
      'utf8'
    );
    const ledger = fs.readFileSync(
      path.join(CC, 'law/improve-loop/ledger-schema.md'),
      'utf8'
    );
    const index = fs.readFileSync(
      path.join(CC, 'law/improve-loop/INDEX.md'),
      'utf8'
    );
    const p3 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-3-replan.md'),
      'utf8'
    );
    const advisor = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/advisor.md'),
      'utf8'
    );

    // PLAN_BRIEF
    expect(planning).to.match(/## Campaign brief|Campaign brief/i);
    expect(planning).to.match(/PLAN_BRIEF|Success \/ Done when/i);
    expect(planning).to.match(/must not invent new complete predicates|Must not invent new complete/i);
    expect(ledger).to.match(/## Campaign brief/);
    expect(ledger).to.match(/\*\*Target:\*\*/);
    expect(ledger).to.match(/After ## Driver|before ## Backlog/i);

    // PLAN_TAG dual samples (greppable + legacy)
    expect(ledger).to.match(/P1: \[defect\]/);
    expect(ledger).to.match(/\[P1\]\[defect/);
    expect(planning).to.match(/PLAN_TAG|P1: \[defect\]/);
    expect(planning).to.match(/PLAN_LEGACY_A|Legacy A/i);

    // PLAN_RESIDUAL — no Decision on residual
    expect(planning).to.match(/PLAN_RESIDUAL|thin template/i);
    expect(planning).to.match(/strip Decision\/Preserve|only Evidence \+ Acceptance/i);

    // PLAN_CLASSIFY + tiers
    expect(planning).to.match(/PLAN_CLASSIFY|promote-class|classify: promote/i);
    expect(planning).to.match(/\bT0p\b/);
    expect(planning).to.match(/\bT2\b/);
    expect(planning).to.match(/promote\|keep P2\|waive|keep P2/);

    // PLAN_APPLY fork — A continuous [x] preserve
    expect(planning).to.match(/PLAN_APPLY|Apply \(A continuous\)/i);
    expect(planning).to.match(/Preserve already-`\[x\]`|preserve already-`\[x\]`|already-`\[x\]`/i);
    expect(p3).to.match(/preserve.*`\[x\]`|already-`\[x\]`|must never[\s\S]*`\[x\]`/i);
    expect(p3).to.match(/contracts\/planning\.md|planning\.md/);

    // INDEX + advisor schema
    expect(index).to.match(/contracts\/planning\.md/);
    expect(advisor).to.match(/5-block|must-fix|anti-reseed/i);
    expect(advisor).to.match(/contracts\/planning\.md|planning\.md/);
    expect(advisor).to.match(/PLAN_CRITERIA|preflight/i);

    // PLAN_CRITERIA + PLAN_RUNTIME_CONTRACT + HYBRID work-spec (M1–M5 law)
    expect(planning).to.match(/PLAN_CRITERIA/);
    // Design-time N&S — fail-closed law consumer (presence pin).
    // Soft residual typography: × or * only (align suite residual×2|residual*2 style).
    expect(planning).to.match(/design-time n&s/i);
    expect(planning).to.match(/Simplify\?/);
    expect(planning).to.match(/Overdesign\?/);
    expect(planning).to.match(/Layer\?/);
    expect(planning).to.match(/never alone blocks residual(?:×|\*)2/);
    expect(planning).to.match(/Criteria scan|preflight/i);
    expect(planning).to.match(/PLAN_RUNTIME_CONTRACT/);
    expect(planning).to.match(/Runtime contract:/);
    expect(planning).to.match(/investigation-P1|filled/);
    expect(planning).to.match(/work spec|work-spec|WORK SPEC/i);
    expect(planning).to.match(/Validation Spec|VALIDATION SPEC|derived prove/i);
    expect(planning).to.match(/T2 challenge/);
    expect(planning).to.match(/\bhabitat\b/);
    expect(planning).to.match(/softCheck|PLAN_SPEC_SOFT/);
    expect(planning).to.match(/never auto-seed|never seeds backlog/i);
  });

  /**
   * Fable-B+ Validate-fix cycle — anchors the compromise done-when checklist
   * (Codex + Fable) so the Spec-linter product model cannot silently regress.
   */
  it('Validate-fix cycle: Fable-B+ done-when anchors (eligibility, ownership, no in-gate loop)', function () {
    const planning = fs.readFileSync(
      path.join(CC, 'law/improve-loop/contracts/planning.md'),
      'utf8'
    );
    const p3v = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-3v-validate.md'),
      'utf8'
    );
    const skill = fs.readFileSync(path.join(CC, 'skills/improve-loop/SKILL.md'), 'utf8');
    const throttle = fs.readFileSync(
      path.join(CC, 'skills/improve/references/throttle.md'),
      'utf8'
    );

    // 1. Named cycle + eligibility (starting open queue = only 3v seeds)
    expect(planning).to.match(/### Validate-fix cycle/);
    expect(planning).to.match(/at\s+\*\*cycle start\*\*|when \*\*at\s+cycle start\*\*/i);
    expect(planning).to.match(/validate V<k>:/);
    expect(planning).to.match(/write-section/);
    expect(planning).to.match(/product residual survey is not pending|product residual survey/);

    // 2. Ordinary L2 machinery — not an inner prove campaign
    expect(planning).to.match(/Phases 0–5|full Phases 0/);
    expect(planning).to.match(/Phase 1 executes/);
    expect(planning).to.match(/Phase 2 counters/);
    expect(planning).to.match(/Phase 4 one commit|Phase 4/);
    expect(planning).to.match(/3v re-proves|re-proves/);
    expect(planning).to.match(/No same-cycle fix inside the prove gate|same-cycle fix inside/);
    expect(p3v).to.match(/not an in-gate fix\/re-prove loop|in-gate fix/);
    expect(skill).to.match(/not an in-gate fix\/re-prove loop|in-gate fix/);

    // 3. A throttle owns cadence exception; planning cites only
    expect(planning).to.match(/skills\/improve\/references\/throttle\.md/);
    expect(planning).to.match(/does \*\*not\*\* override A cadence|do not override/);
    expect(throttle).to.match(/Validate-fix cycle exception/);
    expect(throttle).to.match(/\*\*Owner:\*\*|Owner:/);
    expect(throttle).to.match(/Native 5-block surgical replan only|native 5-block surgical/i);
    expect(throttle).to.match(/full panel every 3rd cycle/);
    expect(throttle).to.match(/Phase 1 executes the seeded item/);
    expect(throttle).to.match(/Phase 2 counters/);
    expect(throttle).to.match(/Phase 4 one commit/);
    expect(throttle).to.match(/no\*\* same-cycle fix|no same-cycle fix/i);

    // 4. Fall-through when new material appears
    expect(planning).to.match(/\*\*Fall-through:\*\*|Fall-through/);
    expect(planning).to.match(/promote-class|non-validation open/);
    expect(throttle).to.match(/Fall-through \(restore default|Fall-through/);
    expect(p3v).to.match(/Fall through to ordinary replan|Fall through/);
    expect(skill).to.match(/Fall through to ordinary replan|Fall through/);

    // 5. B runtime mirror (R8 + advisor throttle)
    expect(skill).to.match(/Validate-fix cycle/);
    expect(skill).to.match(/native 5-block surgical|T1 native-only/i);
    expect(skill).to.match(/skills\/improve\/references\/throttle\.md/);
    expect(p3v).to.match(/Validate-fix cycle/);
    expect(p3v).to.match(/skills\/improve\/references\/throttle\.md/);

    // 6. PLAN_SPEC_SYNC still excludes validate-seed lifecycle (anti-thrash)
    expect(planning).to.match(/Excluded from triggers/);
    expect(planning).to.match(/validate V<k>[\s\S]{0,80}any lifecycle|any lifecycle[\s\S]{0,40}validate V/i);
    expect(skill).to.match(/validate V<k> lifecycle|Exclude residual-thin and `validate V/i);

    // 7. R7 sole complete preserved (all-V-pass never complete)
    expect(planning).to.match(/never “all V pass ⇒ complete” alone|sole Status complete/i);
    expect(skill).to.match(/never “all V pass ⇒ complete” alone|R7 sole complete/i);

    // 8. Anti-goals still encoded (no soft auto-seed; R8 continue)
    expect(planning).to.match(/Never auto-seed backlog|never auto-seed/i);
    expect(p3v).to.match(/must\s+immediately\*\* start the next L2|must immediately start the next L2/i);
  });

  it('dirty launch bootstraps worktree carry+drain instead of hard-stop only', function () {
    const p0 = fs.readFileSync(
      path.join(CC, 'law/improve-loop/phase-0-resume.md'),
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
