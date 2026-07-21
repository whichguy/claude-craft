#!/usr/bin/env node
/**
 * validate-outcome.js — oracle for improve-loop scenario fixtures
 *
 * Usage:
 *   node validate-outcome.js --workspace <fixture-clone> --scenario <scenario.json>
 *   node validate-outcome.js --workspace … --scenario … --json
 *
 * Exit: 0 all checks pass · 1 usage · 2 oracle fail
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] ?? null;
}

function has(name) {
  return process.argv.includes(name);
}

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    'usage: node validate-outcome.js --workspace <dir> --scenario <scenario.json> [--json]'
  );
  process.exit(1);
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function countOpenP0P1(ledger) {
  const body = (ledger.split(/^## Backlog\s*$/m)[1] || '').split(/^## /m)[0] || '';
  const lines = body.split('\n').filter((l) => /^- \[ \] P[01]:/.test(l));
  return lines.length;
}

function parseStatus(ledger) {
  const m = ledger.match(/\*\*Status:\*\*\s*(\S+)/);
  return m ? m[1].replace(/\s.*/, '') : null;
}

function parseStreak(ledger) {
  const m = ledger.match(/consecutive-non-material-cycles:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function countHonestEmpty(text) {
  const re = /honest-empty:\s*residual survey — no non-weak open gaps/g;
  return (text.match(re) || []).length;
}

function runSuite(workspace, testCommand) {
  const r = spawnSync('bash', ['-lc', testCommand], {
    cwd: workspace,
    encoding: 'utf8',
    env: process.env,
  });
  return {
    exit: r.status == null ? 1 : r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

function gitLogBodies(workspace) {
  const r = spawnSync(
    'git',
    ['-C', workspace, 'log', '--format=%B---COMMIT---'],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) return '';
  return r.stdout || '';
}

function main() {
  const workspace = arg('--workspace');
  const scenarioPath = arg('--scenario');
  if (!workspace || !scenarioPath) usage('missing --workspace or --scenario');
  if (!fs.existsSync(workspace)) usage('workspace missing: ' + workspace);
  if (!fs.existsSync(scenarioPath)) usage('scenario missing: ' + scenarioPath);

  const scenario = JSON.parse(read(scenarioPath));
  const oracle = scenario.oracle || {};
  const checks = [];
  const fail = (id, detail) => checks.push({ id, pass: false, detail });
  const ok = (id, detail) => checks.push({ id, pass: true, detail });

  const ledgerPath = path.join(workspace, 'IMPROVE_LOOP.md');
  const ledger = fs.existsSync(ledgerPath) ? read(ledgerPath) : '';
  if (!ledger) fail('ledger_present', 'IMPROVE_LOOP.md missing');
  else ok('ledger_present', 'found');

  // Suite
  const suite = runSuite(workspace, scenario.test_command);
  const wantExit = oracle.suite_exit == null ? 0 : Number(oracle.suite_exit);
  if (suite.exit === wantExit) ok('suite_exit', `exit=${suite.exit}`);
  else fail('suite_exit', `want ${wantExit} got ${suite.exit}: ${suite.stderr.slice(0, 200)}`);

  // Status
  const status = parseStatus(ledger);
  if (status === oracle.final_status) ok('final_status', status);
  else fail('final_status', `want ${oracle.final_status} got ${status}`);

  // Open P0/P1
  const open = ledger ? countOpenP0P1(ledger) : -1;
  const wantOpen = oracle.open_p0_p1 == null ? 0 : Number(oracle.open_p0_p1);
  if (open === wantOpen) ok('open_p0_p1', String(open));
  else fail('open_p0_p1', `want ${wantOpen} got ${open}`);

  // Streak
  const streak = parseStreak(ledger);
  const minStreak = Number(oracle.min_non_material_streak || 0);
  if (streak != null && streak >= minStreak) ok('non_material_streak', String(streak));
  else fail('non_material_streak', `want >=${minStreak} got ${streak}`);

  // Honest-empty attestations (ledger + commits)
  const logBodies = gitLogBodies(workspace);
  const heCount = countHonestEmpty(ledger + '\n' + logBodies);
  const wantHe = Number(oracle.require_honest_empty_attests || 0);
  if (heCount >= wantHe) ok('honest_empty_attests', `count=${heCount}`);
  else fail('honest_empty_attests', `want >=${wantHe} got ${heCount}`);

  // Source fix
  const srcRel = oracle.src_file || 'src/greeter.js';
  const srcPath = path.join(workspace, srcRel);
  if (fs.existsSync(srcPath)) {
    const src = read(srcPath);
    if (oracle.src_must_not_equal_literal && src.includes(oracle.src_must_not_equal_literal)) {
      fail('src_fixed', `still contains bug literal: ${oracle.src_must_not_equal_literal}`);
    } else if (oracle.src_must_match) {
      const re = new RegExp(oracle.src_must_match);
      if (re.test(src)) ok('src_fixed', 'pattern matched');
      else fail('src_fixed', `pattern ${oracle.src_must_match} not in ${srcRel}`);
    } else {
      ok('src_fixed', 'no src pattern required');
    }
  } else {
    fail('src_fixed', `missing ${srcRel}`);
  }

  // CLASS / diagnostics greppable somewhere
  if (oracle.require_class_in_commits_or_ledger) {
    const blob = ledger + '\n' + logBodies;
    if (/\bCLASS:\s*\w+/.test(blob) || /\bCLASS: OK\b/.test(blob)) {
      ok('class_greppable', 'found CLASS');
    } else {
      fail('class_greppable', 'no CLASS: in ledger or commits');
    }
  }

  // Unconsumed material surprises block complete (soft check)
  const unconsumed =
    /UNINTENDED:/.test(ledger) ||
    /FALSE_GREEN:/.test(ledger) ||
    /TEST_GAP:/.test(ledger);
  if (status === 'complete' && unconsumed) {
    fail('no_unconsumed_surprise', 'complete with UNINTENDED/FALSE_GREEN/TEST_GAP in ledger');
  } else {
    ok('no_unconsumed_surprise', unconsumed ? 'present but not complete' : 'none');
  }

  const failed = checks.filter((c) => !c.pass);
  const report = {
    scenario: scenario.id,
    workspace,
    pass: failed.length === 0,
    failed: failed.length,
    checks,
    suite_tail: (suite.stdout + suite.stderr).split('\n').slice(-20),
  };

  if (has('--json')) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    for (const c of checks) {
      console.log(`${c.pass ? 'PASS' : 'FAIL'}: ${c.id} — ${c.detail}`);
    }
    console.log('---');
    console.log(
      report.pass
        ? `oracle PASS (${checks.length} checks) scenario=${scenario.id}`
        : `oracle FAIL (${failed.length}/${checks.length}) scenario=${scenario.id}`
    );
  }

  process.exit(report.pass ? 0 : 2);
}

if (require.main === module) main();
module.exports = { countOpenP0P1, parseStatus, parseStreak, countHonestEmpty };
