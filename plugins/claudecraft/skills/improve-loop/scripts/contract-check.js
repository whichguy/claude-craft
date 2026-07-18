#!/usr/bin/env node
/**
 * Contract check for improve-loop package (+ optional grok-review-converge composition).
 *
 * Usage:
 *   node contract-check.js
 *   node contract-check.js --skill-dir /path/to/improve-loop \
 *                          --mirror /path/to/mirror/SKILL.md \
 *                          --converge /path/to/grok-review-converge/SKILL.md
 *
 * Exit 0 = all asserts pass; exit 1 = failures printed to stderr.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const home = process.env.HOME || '';
const skillDir = arg(
  '--skill-dir',
  path.join(home, '.claude/skills/improve-loop')
);
const userSkill = path.join(skillDir, 'SKILL.md');
const mirrorSkill = arg(
  '--mirror',
  path.join(
    home,
    '.claude/plugins/marketplaces/claude-craft/plugins/claudecraft/skills/improve-loop/SKILL.md'
  )
);
const convergeSkill = arg(
  '--converge',
  path.join(home, '.claude/skills/grok-review-converge/SKILL.md')
);

const fails = [];
function ok(cond, msg) {
  if (!cond) fails.push(msg);
}

function read(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    fails.push(`cannot read ${p}: ${e.message}`);
    return '';
  }
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

const user = read(userSkill);
const mirror = read(mirrorSkill);
const converge = read(convergeSkill);

// --- package layout (L3) ---
const requiredFiles = [
  'SKILL.md',
  'references/goal-objective.template.md',
  'scripts/shell-probe.sh',
  'scripts/worktree-enter.js',
  'scripts/resolve-target-repo.js',
  'scripts/pointer.js',
  'scripts/ledger-status.js',
  'scripts/merge-back.js',
  'scripts/campaign-teardown.js',
  'scripts/lib-paths.js',
  'scripts/contract-check.js',
  'tests/scripts.test.sh',
];
for (const rel of requiredFiles) {
  ok(exists(path.join(skillDir, rel)), `package missing: ${rel}`);
}
ok(
  !exists(path.join(skillDir, 'once-commit.sh')),
  'once-commit.sh must not ship in product skill tree'
);

// --- improve-loop required prose contracts ---
const improveRequired = [
  ['campaign architecture', /Campaign architecture \(logical separation\)/i],
  ['L1 campaign driver', /L1 — Campaign driver|campaign driver/i],
  ['autonomous default', /Default: one campaign per invocation|autonomous campaign/i],
  ['self-contained cycles', /Self-contained cycles|self-contained cycle/i],
  ['git is the ledger', /Git is the only durable ledger|git commits only|git is the ledger/i],
  ['discard-stale default', /discard-stale|discards stale/i],
  ['Next backlog commit field', /Next backlog/i],
  ['Next deferred commit field', /Next deferred/i],
  ['Deferred P2 section', /Deferred \(P2\)|## Deferred/i],
  ['P2 deferred tag', /P2:/],
  ['planning ledger and history', /ledger.*history|history.*ledger|live ledger|both ledger and history/i],
  ['deferred not residual', /never.*select.*Deferred|ignore.*Deferred|P2.*not.*material|do not.*block.*residual|never counts as open P0/i],
  ['cold-start seed deferred', /seed.*Deferred|also seed.*Deferred|Deferred \(P2\).*digest/i],
  ['resume reads deferred', /read the Backlog.*Deferred|Deferred \(P2\).*Stop-condition/i],
  ['deferred replan keep prior', /deferred replan unusable|Deferred unchanged/i],
  ['P2 strip from backlog', /P2 line removed from Backlog|removed from Backlog → Deferred/i],
  ['ledger flush Next deferred', /ledger-flush short-form body must|never drop deferred on\s+flush|must still emit.*Next deferred/i],
  ['progress deferred count', /deferred=<n>|deferred=/i],
  ['P0/P1 residual discipline', /P0\/P1 residual discipline|consecutive-non-material-cycles/i],
  ['two consecutive non-material', /two consecutive|>= 2|streak >= 2|non-material-cycles >= 2/i],
  ['P0 P1 tagged backlog', /P0:|P1:/],
  ['campaign-teardown', /campaign-teardown\.js/i],
  ['one L2 cycle per loop iteration', /one L2 cycle per loop iteration|exactly one L2 cycle/i],
  ['MAX_CYCLES', /MAX_CYCLES|IMPROVE_LOOP_MAX_CYCLES/i],
  ['--once mode', /--once/i],
  ['campaign report', /Improve · campaign report|Campaign report/i],
  ['campaign goal at kickoff', /Campaign goal|#### Campaign goal/i],
  ['cycle discovery card', /cycle discovery|Improve · cycle K\/MAX|Discovered this cycle/i],
  ['cycles at a glance', /Cycles at a glance/i],
  ['campaign summary section', /#### Summary|Outcome in plain language/i],
  ['illustrative status bar', /Illustrative bar|illustrative/i],
  ['do not stop for user', /DO NOT stop for the user|do not stop for the user/i],
  ['outer goal protocol', /Outer goal protocol/i],
  ['migrate-or-discard', /migrate-or-discard|discard-legacy|discard-cold-start/i],
  ['shell probe script', /shell-probe\.sh|Shell must spawn/i],
  ['shell CWD discipline section', /Shell CWD discipline/i],
  ['ORIGINAL_CWD homecoming', /ORIGINAL_CWD/i],
  ['pin destination TARGET_REPO', /Pin destination|TARGET_REPO.*durable|sticky.*TARGET_REPO/i],
  ['subshell temporary cd', /\(cd |subshell/i],
  ['sticky CWD hazard', /sticky-CWD|keep the current directory|suggested_cwd/i],
  ['session vs destination', /Session vs destination|session cwd is the campaign repo/i],
  ['worktree-enter script', /worktree-enter\.js/i],
  ['merge-back script', /merge-back\.js/i],
  ['ledger-status script', /ledger-status\.js/i],
  ['goal objective template', /goal-objective\.template\.md/],
  ['random 6 hex worktree', /6 hex|random\s+suffix|worktree-enter/i],
  ['target repository resolution', /Target repository|TARGET_REPO/i],
  ['claude-home install resolve', /Claude-home install resolve/i],
  ['always run L3 install surface', /always run L3 when the candidate lives on the install surface/i],
  ['exit 0 always target_repo', /always use json\.target_repo as TARGET_REPO/i],
  ['symlink_followed kickoff only', /symlink_followed.*kickoff|never a gate to ignore `target_repo`/i],
  ['resolve-target-repo script', /resolve-target-repo\.js/],
  ['L3 lists resolve-target-repo', /resolve-target-repo/],
  ['no primary ralph', /Do not\*\* wrap improve-loop in ralph|Do not wrap improve-loop in ralph/i],
  ['round 2 skip no resume', /Round 2 skipped \(no resume tool\)|Skip Round 2/i],
  ['sibling grok-review-converge', /grok-review-converge/i],
  ['improvement loop family', /Improvement loop family/i],
  ['worktrees path', /\.worktrees\//],
  ['status reporting section', /Status reporting \(user-facing/i],
  ['reasoning trail section', /Reasoning trail \(live insight|reasoning trail/i],
  ['considering evaluates about to', /· considering ·|· evaluates ·|· about to ·/],
  ['decision trail this cycle', /Decision trail \(this cycle\)/i],
  ['what this campaign did arc', /What this campaign did \(arc\)/i],
  ['kickoff card', /Improve · kickoff/],
  ['closing card', /Improve · cycle result|cycle discovery/i],
  ['phase banner', /▸ improve · Phase/],
  ['cycle K/MAX progress', /cycle K\/MAX|K\/MAX/],
  ['L1 continues next L2', /L1 continues next L2|continues next L2 cycle/i],
  ['residual meter', /Residual meter|streak \*\*m\/2\*\*|non-material=<m>\/2/i],
  ['residual_only progress', /residual_only=/i],
  ['merge-back card', /Improve · merge-back|Merge-back card/i],
  ['worktree_removed field', /worktree_removed/i],
  ['ambient dirt policy', /IMPROVE_LOOP_AMBIENT_PREFIXES|Launch ambient dirt|ignored-ambient-dirt/i],
  ['finishing cycle streak 1', /finishes the last P1|finishing cycle is streak 1|counts as streak \*\*1\*\*/i],
  ['do not freehand-stash', /Never freehand-stash|Do not\*\* `git stash` launch|do not freehand-stash/i],
  ['open-only backlog', /Backlog = open work only|open work only/i],
  ['complete deletes from queue', /remove.*selected open line|removes.*selected.*from.*Backlog|delete from work queue/i],
  ['done memory git commit metadata', /Done memory = git commit metadata|COMPLETED_SET|prior-learnings digest/i],
  ['commit body learnings fields', /What landed|Thesis.*Outcome|commit bodies/i],
  ['anti-reseed completed set', /Anti-reseed|COMPLETED_SET|re-opened completed work/i],
  ['next backlog open only', /Open work queue only|Next backlog:[\s\S]*?\(open: empty\)|do \*\*not\*\* emit `- \[x\]`/i],
  ['legacy x strip', /legacy \[x\] stripped|memory is git digest/i],
];

for (const [name, re] of improveRequired) {
  ok(re.test(user), `user improve-loop missing: ${name}`);
}

// Mirror: if present, require same contracts (marketplace may lag scripts — SKILL at least)
if (mirror) {
  for (const [name, re] of improveRequired) {
    ok(re.test(mirror), `mirror improve-loop missing: ${name}`);
  }
  for (const [name, re] of improveRequired) {
    const u = re.test(user);
    const m = re.test(mirror);
    ok(u === m, `mirror/user presence mismatch for: ${name} (user=${u} mirror=${m})`);
  }
}

// Deprecated primary-ralph in description head
ok(
  !/combine with ralph-loop when an unattended/i.test(user.slice(0, 1000)),
  'user improve-loop still advertises ralph as unattended primary in description head'
);

// Primary multi-cycle must be L1 autonomous driver, not host-only re-drive
ok(
  /L1 — Campaign driver|campaign driver/i.test(user) &&
    /DO NOT stop for the user|do not stop for the user/i.test(user),
  'user skill must require L1 campaign driver that continues without waiting for user'
);
ok(
  !/One cycle per invocation\*\* — this skill does \*\*not\*\* self-repeat/i.test(user),
  'user skill must not claim single-cycle-only product (autonomous default required)'
);

// Template has placeholders + optional host framing
const tmpl = read(path.join(skillDir, 'references/goal-objective.template.md'));
ok(/<TARGET>/.test(tmpl), 'goal template missing <TARGET>');
ok(/<TARGET_REPO_ABS>/.test(tmpl), 'goal template missing <TARGET_REPO_ABS>');
ok(/<CMD>/.test(tmpl), 'goal template missing <CMD>');
ok(
  /optional|L1 campaign driver|Primary multi-cycle/i.test(tmpl),
  'goal template must state host /goal is optional / L1 primary multi-cycle'
);

// --- grok-review-converge dual-driver + family residual parity ---
if (converge) {
  ok(
    /Preferred multi-round outer driver:\s*`?\/goal`?/i.test(converge) ||
      /prefer \/goal for multi-round/i.test(converge),
    'grok-review-converge missing preferred /goal multi-round'
  );
  ok(
    /Optional legacy outer driver:\s*`?ralph-loop`?/i.test(converge) ||
      /optional legacy.*ralph/i.test(converge),
    'grok-review-converge missing optional ralph legacy note'
  );
  ok(
    /## Running it multi-round|### Preferred: `?\/goal`?/i.test(converge),
    'grok-review-converge missing multi-round /goal section'
  );
  ok(
    /Consecutive clean rounds\s*>=\s*2|two consecutive clean|2 consecutive/i.test(converge),
    'grok-review-converge missing 2 consecutive clean complete rule'
  );
  ok(
    /material.*minor|minor.*material/i.test(converge),
    'grok-review-converge missing material vs minor classification'
  );
  ok(
    /git-history|git history|git log --grep/i.test(converge),
    'grok-review-converge missing git-history-aware planning'
  );
  ok(
    /Improvement loop family|same family as improve-loop|improve-loop/i.test(converge),
    'grok-review-converge missing improve-loop family cross-reference'
  );
  ok(
    /P0|P1/i.test(converge),
    'grok-review-converge should map material plan bullets to P0/P1 family tags'
  );
  const head = converge.slice(0, 1200);
  ok(
    !/combine with ralph-loop when an unattended, hard-capped\s+outer quota is needed\.?$/im.test(
      head
    ),
    'grok-review-converge description still ralph-only for unattended'
  );
}

// improve-loop must declare family table / sibling converge
ok(
  /Improvement loop family|grok-review-converge/i.test(user),
  'user improve-loop missing family / grok-review-converge sibling cross-reference'
);

if (fails.length) {
  for (const f of fails) console.error('FAIL:', f);
  process.exit(1);
}
console.log('PASS: improve-loop package contracts + dual-driver composition checks');
console.log('skill-dir:', skillDir);
console.log('mirror:', mirrorSkill);
console.log('converge:', convergeSkill);
process.exit(0);
