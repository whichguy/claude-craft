#!/usr/bin/env node
/**
 * Contract check for improve-loop package (+ optional review-converge composition).
 *
 * Usage:
 *   node contract-check.js
 *   node contract-check.js --skill-dir /path/to/improve-loop \
 *                          --mirror /path/to/mirror/SKILL.md \
 *                          --converge /path/to/review-converge/SKILL.md
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
function defaultConvergePath() {
  const preferred = path.join(home, '.claude/skills/review-converge/SKILL.md');
  const legacy = path.join(home, '.claude/skills/grok-review-converge/SKILL.md');
  try {
    if (fs.existsSync(preferred)) return preferred;
  } catch (_) {}
  return legacy;
}
const convergeSkill = arg('--converge', defaultConvergePath());

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
// Every script that tests or SKILL call by path must appear here (H15 atomic ship).
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
  'scripts/carry-launch-wip.js',
  'scripts/contract-check.js',
  'scripts/converge-ledger-resolve.js',
  'scripts/backlog-blocks.js',
  'scripts/spec-validate.js',
  'scripts/complete-gate.js',
  'scripts/package-parity.js',
  'tests/scripts.test.sh',
];
for (const rel of requiredFiles) {
  ok(exists(path.join(skillDir, rel)), `package missing: ${rel}`);
}

// Feature-surface pins: docs/SKILL must not outrun script implementations (L4).
// Update pins in the same commit as intentional renames.
const featureSurfacePins = [
  [
    'scripts/lib-paths.js',
    [
      ['isReintegrateProtected', /function isReintegrateProtected|isReintegrateProtected\s*[:(]/],
      ['gitSpawnEnv', /function gitSpawnEnv|gitSpawnEnv\s*[:(]/],
      ['ambientProfileName', /function ambientProfileName|AMBIENT_PROFILE/],
    ],
  ],
  [
    'scripts/merge-back.js',
    [
      ['tryRebaseThenFf', /function tryRebaseThenFf|tryRebaseThenFf\s*[:(]/],
      ['IMPROVE_LOOP_MERGE_REBASE', /IMPROVE_LOOP_MERGE_REBASE/],
      ['rebase_then_ff', /rebase_then_ff/],
    ],
  ],
  [
    'scripts/campaign-teardown.js',
    [
      ['force-drop-reintegrate', /force-drop-reintegrate/],
      ['refused_reintegrate_blocked', /refused_reintegrate_blocked/],
    ],
  ],
  [
    'scripts/spec-validate.js',
    [
      ['dual-home kind', /dual-home/],
      ['validate V seed', /validate V/],
    ],
  ],
];
for (const [rel, pins] of featureSurfacePins) {
  const abs = path.join(skillDir, rel);
  if (!exists(abs)) continue; // requiredFiles already reported missing
  const body = read(abs);
  for (const [name, re] of pins) {
    ok(re.test(body), `feature-surface missing in ${rel}: ${name}`);
  }
}

// Executable ledger-resolve decision table (fatal rename paths)
const ledgerResolve = path.join(skillDir, 'scripts/converge-ledger-resolve.js');
if (exists(ledgerResolve)) {
  try {
    const lr = require(ledgerResolve);
    ok(
      lr.resolveLedgerAction({ reviewExists: false, grokExists: true }) === 'migrate',
      'ledger-resolve: absent+legacy must migrate'
    );
    ok(
      lr.resolveLedgerAction({ reviewExists: false, grokExists: false }) === 'create',
      'ledger-resolve: neither must create'
    );
    ok(
      lr.resolveLedgerAction({
        reviewExists: true,
        grokExists: true,
        reviewRoundCount: 0,
        grokRoundCount: 2,
      }) === 'recover-half-migrate',
      'ledger-resolve: empty REVIEW + rich GROK must recover-half-migrate'
    );
    ok(
      lr.resolveLedgerAction({
        reviewExists: true,
        grokExists: true,
        reviewRoundCount: 1,
        grokRoundCount: 1,
      }) === 'both-conflict',
      'ledger-resolve: dual rich ledgers must both-conflict'
    );
    ok(
      lr.isLandedForRound(['x grok-review-converge: round 2 — y'], 2) === true,
      'ledger-resolve: legacy commit subject must count as landed'
    );
    ok(
      lr.isLandedForRound(['x review-converge: round 10 — y'], 1) === false,
      'ledger-resolve: round 1 must not prefix-match round 10'
    );
    ok(lr.mustMigrateBeforeCreate(false, true) === true, 'ledger-resolve: mustMigrateBeforeCreate');
  } catch (e) {
    ok(false, `ledger-resolve require/run failed: ${e.message}`);
  }
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
  ['git is the ledger', /Git is the durable ledger across campaigns|Git is the only durable ledger|git commits only|git is the ledger|durable ledger across/i],
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
  ['carry launch WIP into worktree', /carried into WORKSPACE|carry.*launch.*WIP|carried-launch-wip|git diff HEAD --binary/i],
  ['carry cleans launch after success', /cleaned on launch|clean.*launch.*carried|restored to `HEAD`/i],
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
  ['sibling review-converge', /review-converge|grok-review-converge/i],
  ['advisors optional native-first', /Advisors are optional|native-replanner|configurable optional advisor/i],
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
  ['post-PASS hygiene directive', /Post-PASS hygiene|post-PASS hygiene/i],
  ['post-PASS docs + cleanup', /Documentation[\s\S]{0,200}stale|stale.*docs|tech-debt litter|scoped cleanup|repo cleanup/i],
  ['extend CHANGED_PATHS after hygiene', /extend.*CHANGED_PATHS|CHANGED_PATHS.*extend|post-PASS hygiene paths|HYGIENE_PATHS/i],
  ['hygiene not a separate phase', /not a separate phase|directive — not a separate phase|not a new phase/i],
  ['hygiene gate real product land', /non-empty.*CHANGED_PATHS|pre-hygiene.*non-empty|real product land/i],
  ['hygiene re-run FAIL keep product', /hygiene re-run FAIL|hygiene paths reverted|product land kept/i],
  ['hygiene fail-closed isolation', /cannot isolate|HYGIENE_TOUCHED|pre-hygiene content snapshot|HYGIENE_SNAPSHOTS/i],
  ['hygiene mid-cycle gate open', /only when hygiene gate open|hygiene gate \(confirmed/i],
  ['partial hygiene landed only', /partial[\s\S]{0,120}already-landed|partial[\s\S]{0,120}landed behavior/i],
  ['hygiene product-path snapshot hard rule', /without that snapshot|skipped product-path edit without snapshot|Path class rule/i],
  ['hygiene contaminated unstaged', /CONTAMINATED|left unstaged|do not stage/i],
  ['hygiene untracked junk deletes only', /untracked junk|Never.*git rm.*clean tracked|never `git rm` clean tracked/i],
  ['hygiene fail-closed Outcome partial', /CONTAMINATED[\s\S]{0,200}partial|Set Outcome to `partial`|Outcome to `partial`/i],
  // Pilot follow-ups (carried-WIP discard + residual honesty)
  ['carried-wip-discard-blocked exit 10', /carried-wip-discard-blocked|exit \*\*10\*\*|`10`.*carried-wip/i],
  // Dirty intent: ledger + prior commits + enter-carry are never dirty
  ['dirty intent ledger never dirty', /Dirty — intent|Never dirty|ledger.*never dirty|IMPROVE_LOOP\.md.*Never/i],
  ['dirty intent prior commits never dirty', /Prior commits|already landed.*not dirty|commits are never dirty/i],
  ['enter-carry baseline not dirty', /enter-carried|carried_paths|Enter-carried baseline/i],
  // Landing priority: new files + FF product over polish
  ['landing priority product over polish', /Landing priority|product over polish|Primary goal.*merge-back|more important than.*clean/i],
  ['new files first-class product', /New files are first-class|untracked.*product|Include untracked \(\?\?\)|new files.*pathspec|new product files/i],
  ['pathspec stages untracked product', /add -- <path>|still-dirty.*untracked|Skipping untracked product/i],
  ['cold-start residual streak reset', /Always.*init.*consecutive-non-material-cycles:\s*0|never inherit streak|cold-start.*streak always starts at \*\*0\*\*/i],
  ['residual Outcome partial hard', /Outcome `partial` only|Outcome \*\*`partial`\*\* only|never\*\*[\s\S]{0,40}`confirmed`[\s\S]{0,80}empty `CHANGED_PATHS`|never.*confirmed.*no product land/i],
  ['residual allow-empty emergency or ledger path', /Emergency allow-empty residual|allow-empty[\s\S]{0,80}residual|git commit --allow-empty|ledger-only[\s\S]{0,40}residual/i],
  ['residual Next deferred required', /Residual empty-tree commits \*\*must still\*\*|every cycle \(including residual-only, empty-tree/i],
  // Live ledger required mid-campaign (context survival)
  ['live ledger required mid-campaign', /live ledger required|Live ledger is required mid-campaign|working memory/i],
  ['must write IMPROVE_LOOP on cold-start', /Must write[\s\S]{0,40}IMPROVE_LOOP|must write[\s\S]{0,40}live ledger|Must write.*live ledger/i],
  ['durable vs live ledger split', /Durable state vs live ledger|durable ledger across|Live ledger \(`IMPROVE_LOOP/i],
  ['kickoff Live ledger row', /\*\*Live ledger\*\*|Live ledger.*IMPROVE_LOOP/i],
];

// Planning enrichment pins — user skill only this arc (marketplace mirror may lag)
const improvePlanningUserOnly = [
  ['PLAN_TAG greppable form', /P1: \[defect\]|PLAN_TAG|P1: \[kind\]/i],
  ['PLAN_CLAUSES six-clause heads', /Evidence:[\s\S]{0,120}Decision:[\s\S]{0,120}Preserve:[\s\S]{0,120}Unknown:[\s\S]{0,120}Acceptance:/],
  ['PLAN_RESIDUAL thin no Decision invent', /Do \*\*not\*\* invent Decision\/Preserve for residual|no invented Decision\/Preserve on residual|\[residual\][\s\S]{0,300}Acceptance/i],
  ['PLAN_BRIEF campaign brief', /## Campaign brief/],
  ['PLAN_BRIEF Target line', /\*\*Target(?: \/ desired outcome)?:\*\*/],
  ['PLAN_CRITERIA token', /PLAN_CRITERIA/],
  ['PLAN_CRITERIA Criteria scan', /Criteria scan/],
  ['PLAN_RUNTIME_CONTRACT token', /PLAN_RUNTIME_CONTRACT/],
  ['PLAN_RUNTIME_CONTRACT Runtime contract', /Runtime contract:/],
  ['PLAN_RUNTIME investigation-P1', /investigation-P1/],
  [
    'PLAN_RUNTIME select investigation before packaging',
    /Select that investigation before packaging/i,
  ],
  ['PLAN_RUNTIME close filled or waiver', /filled.*waiver|runtime waiver|Close investigation/i],
  ['HYBRID work-spec spine', /work-spec|work specification|HYBRID spine/i],
  ['HYBRID Validation Spec derived', /Validation Spec|derived prove/i],
  ['PLAN_VALIDATE section', /## Spec validation|PLAN_VALIDATE/],
  ['PLAN_VALIDATE Phase 3v', /Phase 3v|spec validation gate/i],
  [
    'PLAN_VALIDATE R8 never terminal 3v fail',
    /never treat 3v fail as terminal|3v fail is \*\*never\*\* a terminal|never.*L1 exit reason.*3v|R8.*3v fail/i,
  ],
  [
    'PLAN_VALIDATE unintended-change check-in',
    /Unintended-change check-in|Preserve.*[Rr]egression.*[Ss]cope|Preserve \/ regression \/ scope/i,
  ],
  ['PLAN_SPEC_SYNC token', /PLAN_SPEC_SYNC/],
  ['PLAN_SPEC_SYNC plan-derived', /plan anchor|work-spec anchor|plan-derived|derived from (plan|work-spec)/i],
  ['PLAN_SPEC_SYNC marker iter', /spec-sync: iter/],
  ['PLAN_SPEC_STATUS step id', /3-spec-sync/],
  ['PLAN_SPEC_STATUS Spec prove', /Spec prove/],
  ['PLAN_SPEC_STATUS Spec sync', /Spec sync/],
  ['PLAN_SPEC_SOFT token', /PLAN_SPEC_SOFT|softCheckIntentions|softCheckSpecBundle|soft-check/],
  ['PLAN_SPEC_SOFT no auto-seed', /Never auto-seed P1 from soft|never auto-seed P1 from soft/i],
  ['PLAN_SPEC_SOFT coverage-mix canonical', /softCheckCoverageMix/],
  [
    'PLAN_SPEC_SOFT not false anti-mirror claim',
    /coverage-mix is \*\*not\*\* anti-mirror|not\*\* true anti-mirror|Coverage-mix is \*\*not\*\* anti-mirror|not anti-mirror \(row-class/i,
  ],
  ['PLAN_SPEC_SOFT habitat coverage alias', /softCheckHabitatCoverage|HABITAT_CLAIMED_NO_PROOF/],
  [
    'R8 never terminal 3v + continuing',
    /never treat 3v fail as terminal|continuing cycle K\+1|R8/i,
  ],
  [
    'R7 residual sole complete not all-V',
    /residual×2 remains sole|never.*all V pass|all V pass.*never|sole `complete` law/i,
  ],
  ['WP0 package-parity B↔M only', /B↔M only|compares \*\*B↔M only\*\*|package-parity compares \*\*B↔M only\*\*/i],
  ['WP0 A carries references law only', /A carries references law only/],
  ['WP1 complete-gate.js', /complete-gate\.js/],
  ['WP1 no Status CLI honesty', /no Status CLI/],
  ['WP3 no second Work Spec table', /No second ## Work Spec|no second `## Work Spec`/i],
  ['PLAN_T2_CHALLENGE token', /PLAN_T2_CHALLENGE|T2 challenge \(native\)/],
  ['PLAN_HABITAT_META Habitat claimed', /\*\*Habitat claimed:\*\*|Habitat claimed:/],
  ['PLAN_HABITAT_META residual re-probe', /re-run.*habitat probe|Habitat claimed:\*\* yes.*re-run|re-run\*\* the cheap habitat probe/i],
  ['PLAN_HABITAT promote streak reset', /Promote edge|promote-class result \*\*must\*\*|reset.*consecutive-non-material-cycles/i],
  ['PLAN_ORIENT token', /PLAN_ORIENT/],
  ['PLAN_ORIENT improve goal', /improve goal ·/],
  ['PLAN_ORIENT on: footer', /· on:/],
  ['PLAN_ORIENT cont heartbeat', /\(cont\)/],
  ['PLAN_APPLY multi-line block delete', /contiguous block|title \+ clause|delete entire contiguous|title and its contiguous clause/i],
  ['PLAN_CLASSIFY promote-class', /promote-class|classify: promote|keep P2/i],
  ['plan tiers T0 T0p T2', /\bT0p\b|Plan tier|plan tier/i],
  ['product residual survey header', /Product residual survey/i],
  ['product residual criteria trail', /criteria:|Criteria trail/i],
  ['product residual probe outcomes', /reachable-fail|habitat unavailable|probe outcome/i],
  ['Further improve report honesty', /Further improve\?/],
  ['intent digest open intent', /open intent:/i],
  ['backlog-blocks mini-parser', /backlog-blocks\.js/],
  ['unknown gate one non-none', /at most \*\*one\*\*|at most one cold-start.*Unknown|Unknown gate/i],
];

for (const [name, re] of improveRequired) {
  ok(re.test(user), `user improve-loop missing: ${name}`);
}
for (const [name, re] of improvePlanningUserOnly) {
  ok(re.test(user), `user improve-loop planning pin missing: ${name}`);
}

// Mirror: if present, require same base contracts (marketplace may lag planning pins)
if (mirror) {
  for (const [name, re] of improveRequired) {
    ok(re.test(mirror), `mirror improve-loop missing: ${name}`);
  }
  for (const [name, re] of improveRequired) {
    const u = re.test(user);
    const m = re.test(mirror);
    ok(u === m, `mirror/user presence mismatch for: ${name} (user=${u} mirror=${m})`);
  }
  // PLAN_SPEC_STATUS tokens must not silent-drift between user and mirror SKILL
  const statusTokens = [
    ['mirror 3-spec-sync', /3-spec-sync/],
    ['mirror Spec prove', /Spec prove/],
    ['mirror Spec sync', /Spec sync/],
    ['mirror PLAN_SPEC_SYNC', /PLAN_SPEC_SYNC/],
    ['mirror spec-sync: iter', /spec-sync: iter/],
    ['mirror PLAN_ORIENT', /PLAN_ORIENT/],
    ['mirror improve goal ·', /improve goal ·/],
    ['mirror · on:', /· on:/],
  ];
  for (const [name, re] of statusTokens) {
    ok(re.test(mirror), `mirror improve-loop status pin missing: ${name}`);
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

// --- review-converge dual-driver + family residual parity (model-agnostic) ---
if (converge) {
  // Skip thin deprecation stubs (legacy grok-review-converge alias)
  const isDeprecationStub =
    /DEPRECATED alias|Superseded by/i.test(converge.slice(0, 800)) &&
    converge.length < 2500;
  if (!isDeprecationStub) {
    ok(
      /name:\s*review-converge/i.test(converge) || /# Review converge/i.test(converge),
      'review-converge missing product name identity'
    );
    ok(
      /Preferred multi-round outer driver:\s*`?\/goal`?/i.test(converge) ||
        /prefer \/goal for multi-round/i.test(converge),
      'review-converge missing preferred /goal multi-round'
    );
    ok(
      /Optional legacy outer driver:\s*`?ralph-loop`?/i.test(converge) ||
        /optional legacy.*ralph/i.test(converge),
      'review-converge missing optional ralph legacy note'
    );
    ok(
      /## Running it multi-round|### Preferred: `?\/goal`?/i.test(converge),
      'review-converge missing multi-round /goal section'
    );
    ok(
      /Consecutive clean rounds\s*>=\s*2|two consecutive clean|2 consecutive/i.test(converge),
      'review-converge missing 2 consecutive clean complete rule'
    );
    ok(
      /material.*minor|minor.*material/i.test(converge),
      'review-converge missing material vs minor classification'
    );
    ok(
      /git-history|git history|git log --grep/i.test(converge),
      'review-converge missing git-history-aware planning'
    );
    ok(
      /Improvement loop family|same family as improve-loop|improve-loop/i.test(converge),
      'review-converge missing improve-loop family cross-reference'
    );
    ok(
      /P0|P1/i.test(converge),
      'review-converge should map material plan bullets to P0/P1 family tags'
    );
    ok(
      /Post-PASS hygiene|post-PASS hygiene/i.test(converge),
      'review-converge missing post-PASS hygiene family directive'
    );
    ok(
      /HYGIENE_PATHS|hygiene paths reverted|product land kept/i.test(converge),
      'review-converge missing hygiene re-run FAIL keep-product rule'
    );
    ok(
      /CONTAMINATED|left unstaged/i.test(converge),
      'review-converge missing CONTAMINATED / left-unstaged fail-closed isolation'
    );
    ok(
      /HYGIENE_SNAPSHOTS|pre-hygiene content snapshot|skipped product-path edit without snapshot/i.test(
        converge
      ),
      'review-converge missing product-path snapshot hard rule'
    );
    ok(
      /untracked junk|never `git rm` clean tracked/i.test(converge),
      'review-converge missing untracked-junk-only delete rule'
    );
    ok(
      /Native first|native first|Native\*\* \(orchestrator\)|preferred default/i.test(converge),
      'review-converge missing native-first role policy'
    );
    ok(
      /REVIEW_CONVERGE\.md/.test(converge),
      'review-converge missing REVIEW_CONVERGE.md ledger name'
    );
    ok(
      /review-converge: round/.test(converge),
      'review-converge missing generic commit subject marker'
    );
    ok(
      /GROK_CONVERGE\.md/.test(converge) && /rename|migrate|legacy/i.test(converge),
      'review-converge missing legacy GROK_CONVERGE.md migrate rule'
    );
    ok(
      /migrate-before-create|Migrate first/i.test(converge),
      'review-converge missing migrate-before-create order (fatal if create-first orphans legacy ledger)'
    );
    ok(
      /recover-half-migrate|both-conflict/i.test(converge),
      'review-converge missing both-present half-migrate recovery / conflict stop'
    );
    ok(
      /landed-commit grep|either marker|legacy marker/i.test(converge) &&
        /grok-review-converge: round/.test(converge),
      'review-converge missing dual-marker landed/orphan grep (legacy commits must not false-orphan)'
    );
    ok(
      !/grok-cc:grok-rescue` must be available/i.test(converge) &&
        !/must be available \(the `grok-cc` plugin/i.test(converge),
      'review-converge still hard-requires grok-cc'
    );
    const head = converge.slice(0, 1200);
    ok(
      !/combine with ralph-loop when an unattended, hard-capped\s+outer quota is needed\.?$/im.test(
        head
      ),
      'review-converge description still ralph-only for unattended'
    );
    ok(
      !/Grok-driven review\/fix|asks Grok to review/i.test(head),
      'review-converge description still Grok-product identity'
    );
    // Completion template (sibling of SKILL) must not teach the old ledger/promise names as primary
    const tmplPath = path.join(path.dirname(convergeSkill), 'completion-report.template.html');
    if (exists(tmplPath)) {
      const html = read(tmplPath);
      ok(
        /REVIEW_CONVERGE\.md/.test(html),
        'completion template missing REVIEW_CONVERGE.md'
      );
      ok(
        !/GROK_REVIEW_CONVERGE_DONE/.test(html),
        'completion template still ships GROK_REVIEW_CONVERGE_DONE promise'
      );
      ok(
        /REVIEW_CONVERGE_DONE/.test(html) || /\/goal/.test(html),
        'completion template missing REVIEW_CONVERGE_DONE or /goal run path'
      );
    }
  }
}

// defaultConvergePath preference: when preferred exists, --converge default must not force legacy
ok(
  defaultConvergePath().includes('review-converge') ||
    !exists(path.join(home, '.claude/skills/review-converge/SKILL.md')),
  'defaultConvergePath must prefer review-converge when present'
);

// improve-loop must declare family table / sibling converge
ok(
  /Improvement loop family/i.test(user) && /review-converge/i.test(user),
  'user improve-loop missing family / review-converge sibling cross-reference'
);

// --- product / UX seed mode (Track B) ---
ok(
  /SEED_MODE/.test(user) && /--product/.test(user),
  'user improve-loop missing SEED_MODE / --product product-mode invocation'
);
ok(
  /Product \/ UX campaign mode/i.test(user) || /Product \/ UX campaign mode/.test(user),
  'user improve-loop missing Product / UX campaign mode section'
);
ok(
  /product residual survey/i.test(user),
  'user improve-loop missing product residual survey gate'
);
ok(
  /limitation waived/i.test(user),
  'user improve-loop missing limitation waived Notes contract'
);
ok(
  /SKIP/.test(user) && /PyYAML|proof spine|suite SKIP/i.test(user),
  'user improve-loop missing suite SKIP-as-material rule'
);
ok(
  /habitat probe/i.test(user) && /skillhub|hermes|docker/i.test(user),
  'user improve-loop missing habitat probe for skillhub/docker targets'
);
ok(
  /\*\*Habitat claimed:\*\*/.test(user),
  'user improve-loop missing Habitat claimed ledger header'
);
ok(
  /T2 challenge \(native\)|PLAN_T2_CHALLENGE/i.test(user),
  'user improve-loop missing T2 challenge native contract'
);
ok(
  /softCheckSpecBundle|spec-validate\.js.*soft-check/i.test(user),
  'user improve-loop missing soft-check CLI / softCheckSpecBundle contract'
);
ok(
  /\*\*Seed mode:\*\*/.test(user) || /Seed mode:/.test(user),
  'user improve-loop missing Seed mode in kickoff or ledger template'
);
ok(
  /cannot.*cold-start with only residual survey|residual-survey-only seed is \*\*forbidden\*\*/i.test(
    user
  ),
  'user improve-loop missing product-mode ban on residual-only cold-start seed'
);

// Optional B↔M package parity (H17). Soft-skip when peer absent.
// Force with IMPROVE_LOOP_PARITY=1; skip with IMPROVE_LOOP_PARITY=0.
const parityMode = String(process.env.IMPROVE_LOOP_PARITY || 'auto').trim();
const parityScript = path.join(skillDir, 'scripts/package-parity.js');
if (parityMode !== '0' && exists(parityScript)) {
  try {
    const parity = require(parityScript);
    const result = parity.checkParity({
      skillDir,
      home,
      softMissingPeer: parityMode !== '1',
    });
    if (result.skipped) {
      // peer missing — soft ok unless forced
      ok(parityMode !== '1', `package-parity peer missing (forced): ${result.reason || ''}`);
    } else {
      ok(result.ok, `package-parity: ${(result.errors || []).join('; ') || 'failed'}`);
    }
  } catch (e) {
    ok(false, `package-parity require/run failed: ${e.message}`);
  }
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
