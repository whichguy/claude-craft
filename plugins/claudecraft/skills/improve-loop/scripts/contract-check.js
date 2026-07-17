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
  'scripts/pointer.js',
  'scripts/ledger-status.js',
  'scripts/merge-back.js',
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
  ['ensure GOAL_MODE', /Ensure GOAL_MODE|ensure GOAL_MODE|L1 — Ensure GOAL_MODE/i],
  ['one cycle per invocation', /One cycle per invocation|one L2 cycle/i],
  ['outer goal protocol', /Outer goal protocol/i],
  ['migrate-or-discard', /migrate-or-discard|discard-legacy|discard-cold-start/i],
  ['shell probe script', /shell-probe\.sh|Shell must spawn/i],
  ['worktree-enter script', /worktree-enter\.js/i],
  ['merge-back script', /merge-back\.js/i],
  ['ledger-status script', /ledger-status\.js/i],
  ['goal objective template', /goal-objective\.template\.md/],
  ['random 6 hex worktree', /6 hex|random\s+suffix|worktree-enter/i],
  ['target repository resolution', /Target repository|TARGET_REPO/i],
  ['no primary ralph', /Do not\*\* wrap improve-loop in ralph|Do not wrap improve-loop in ralph/i],
  ['round 2 skip no resume', /Round 2 skipped \(no resume tool\)|Skip Round 2/i],
  ['sibling grok-review-converge', /grok-review-converge/i],
  ['worktrees path', /\.worktrees\//],
  ['status reporting section', /Status reporting \(user-facing/i],
  ['kickoff card', /Improve · kickoff/],
  ['closing card', /Improve · cycle result/],
  ['phase banner', /▸ improve · Phase/],
  ['goal continues next turn', /goal continues next turn/i],
  ['entry ensures goal', /entry ensures|Ensure GOAL_MODE|ensures.*\/goal/i],
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

// Must not claim "compose with /goal" is the only multi-cycle story without ensure
ok(
  /Ensure GOAL_MODE|entry ensures/i.test(user),
  'user skill must require entry ensures GOAL_MODE (not hope operator composes)'
);

// Template has placeholders
const tmpl = read(path.join(skillDir, 'references/goal-objective.template.md'));
ok(/<TARGET>/.test(tmpl), 'goal template missing <TARGET>');
ok(/<TARGET_REPO_ABS>/.test(tmpl), 'goal template missing <TARGET_REPO_ABS>');
ok(/<CMD>/.test(tmpl), 'goal template missing <CMD>');
ok(/exactly one cycle/i.test(tmpl), 'goal template missing one-cycle turn rule');

// --- grok-review-converge dual-driver ---
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
  const head = converge.slice(0, 1200);
  ok(
    !/combine with ralph-loop when an unattended, hard-capped\s+outer quota is needed\.?$/im.test(
      head
    ),
    'grok-review-converge description still ralph-only for unattended'
  );
}

if (fails.length) {
  for (const f of fails) console.error('FAIL:', f);
  process.exit(1);
}
console.log('PASS: improve-loop package contracts + dual-driver composition checks');
console.log('skill-dir:', skillDir);
console.log('mirror:', mirrorSkill);
console.log('converge:', convergeSkill);
process.exit(0);
