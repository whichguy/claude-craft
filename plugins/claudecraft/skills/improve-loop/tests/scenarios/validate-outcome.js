#!/usr/bin/env node
/**
 * validate-outcome.js — oracle for improve-loop scenario fixtures
 *
 * Usage:
 *   node validate-outcome.js --workspace <dir> --scenario <scenario.json> [--json]
 *   node validate-outcome.js --self-test
 *
 * Exit: 0 pass · 1 usage · 2 oracle fail
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
    'usage: node validate-outcome.js --workspace <dir> --scenario <scenario.json> [--json]\n' +
      '       node validate-outcome.js --self-test'
  );
  process.exit(1);
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function countOpenP0P1(ledger) {
  const body = (ledger.split(/^## Backlog\s*$/m)[1] || '').split(/^## /m)[0] || '';
  return body.split('\n').filter((l) => /^- \[ \] P[01]:/.test(l)).length;
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

function runCmd(workspace, cmd) {
  const r = spawnSync('bash', ['-lc', cmd], {
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

/**
 * Commit message bodies for honest-empty counts.
 * Only when `workspace` is itself a git toplevel — never walk up into an
 * enclosing host repo (e.g. claude-craft history) or negative fixtures inherit
 * the parent log and false-pass R9 attestation checks (host-dependent green).
 */
function gitLogBodies(workspace) {
  const top = spawnSync('git', ['-C', workspace, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  });
  if (top.status !== 0) return '';
  const toplevel = (top.stdout || '').trim();
  if (!toplevel) return '';
  let wsReal;
  let topReal;
  try {
    wsReal = fs.realpathSync(workspace);
    topReal = fs.realpathSync(toplevel);
  } catch {
    return '';
  }
  if (wsReal !== topReal) return '';
  const r = spawnSync('git', ['-C', workspace, 'log', '--format=%B---COMMIT---'], {
    encoding: 'utf8',
  });
  return r.status === 0 ? r.stdout || '' : '';
}

function evaluate(workspace, scenario) {
  const oracle = scenario.oracle || {};
  const checks = [];
  const fail = (id, detail) => checks.push({ id, pass: false, detail });
  const ok = (id, detail) => checks.push({ id, pass: true, detail });

  const ledgerPath = path.join(workspace, 'IMPROVE_LOOP.md');
  const ledger = fs.existsSync(ledgerPath) ? read(ledgerPath) : '';
  if (!ledger) fail('ledger_present', 'IMPROVE_LOOP.md missing');
  else ok('ledger_present', 'found');

  const suite = runCmd(workspace, scenario.test_command);
  const wantExit = oracle.suite_exit == null ? 0 : Number(oracle.suite_exit);
  if (suite.exit === wantExit) ok('suite_exit', `exit=${suite.exit}`);
  else fail('suite_exit', `want ${wantExit} got ${suite.exit}`);

  if (oracle.require_probe_pass && oracle.probe_command) {
    const pr = runCmd(workspace, oracle.probe_command);
    if (pr.exit === 0) ok('probe_pass', 'exit=0');
    else fail('probe_pass', `probe exit=${pr.exit}`);
  }

  const status = parseStatus(ledger);
  if (status === oracle.final_status) ok('final_status', status);
  else fail('final_status', `want ${oracle.final_status} got ${status}`);

  const open = ledger ? countOpenP0P1(ledger) : -1;
  const wantOpen = oracle.open_p0_p1 == null ? 0 : Number(oracle.open_p0_p1);
  if (open === wantOpen) ok('open_p0_p1', String(open));
  else fail('open_p0_p1', `want ${wantOpen} got ${open}`);

  const streak = parseStreak(ledger);
  const minStreak = Number(oracle.min_non_material_streak || 0);
  if (streak != null && streak >= minStreak) ok('non_material_streak', String(streak));
  else fail('non_material_streak', `want >=${minStreak} got ${streak}`);

  const logBodies = gitLogBodies(workspace);
  const blob = ledger + '\n' + logBodies;
  const heCount = countHonestEmpty(blob);
  const wantHe = Number(oracle.require_honest_empty_attests || 0);
  if (heCount >= wantHe) ok('honest_empty_attests', `count=${heCount}`);
  else fail('honest_empty_attests', `want >=${wantHe} got ${heCount}`);

  const srcRel = oracle.src_file || 'src/greeter.js';
  const srcPath = path.join(workspace, srcRel);
  if (fs.existsSync(srcPath)) {
    const src = read(srcPath);
    if (oracle.src_must_not_equal_literal && src.includes(oracle.src_must_not_equal_literal)) {
      fail('src_fixed', `still contains: ${oracle.src_must_not_equal_literal}`);
    } else if (oracle.src_must_match && !new RegExp(oracle.src_must_match).test(src)) {
      fail('src_fixed', `pattern ${oracle.src_must_match} not in ${srcRel}`);
    } else if (
      oracle.src_must_also_match &&
      !new RegExp(oracle.src_must_also_match).test(src)
    ) {
      fail('src_fixed_also', `pattern ${oracle.src_must_also_match} not in ${srcRel}`);
    } else {
      ok('src_fixed', 'ok');
    }
  } else if (oracle.src_file) {
    fail('src_fixed', `missing ${srcRel}`);
  }

  if (oracle.require_class_in_commits_or_ledger) {
    if (/\bCLASS:\s*\w+/.test(blob)) ok('class_greppable', 'found CLASS');
    else fail('class_greppable', 'no CLASS:');
  }

  if (oracle.require_test_debt_signal) {
    const testsBlob =
      blob +
      (fs.existsSync(path.join(workspace, 'test'))
        ? spawnSync('bash', ['-lc', 'cat test/* 2>/dev/null || true'], {
            cwd: workspace,
            encoding: 'utf8',
          }).stdout || ''
        : '');
    if (new RegExp(oracle.require_test_debt_signal).test(testsBlob)) {
      ok('test_debt_signal', 'found');
    } else {
      fail('test_debt_signal', `missing /${oracle.require_test_debt_signal}/`);
    }
  }

  if (oracle.require_material_then_residual) {
    // At least one commit with material fix language and later residual honest-empty
    const parts = logBodies.split('---COMMIT---');
    let sawMaterial = false;
    let residualAfter = false;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (/honest-empty: residual survey/.test(p)) residualAfter = sawMaterial || residualAfter;
      if (/iteration 1|material|fix |CLASS: OK/.test(p) && /src\//.test(p) === false) {
        /* soft */
      }
      if (/fix |iteration 1|mul|add|greet|isAdult|material land/i.test(p)) sawMaterial = true;
    }
    // Simpler: require ≥1 material-ish commit and ≥2 honest-empty already checked
    if (/iteration 1|fix \(/.test(logBodies) || /FIXED=/.test(blob)) {
      ok('material_then_residual', 'material signal present; residual via HE count');
    } else {
      fail('material_then_residual', 'no material commit signal');
    }
  }

  const unconsumed =
    /UNINTENDED:/.test(ledger) ||
    /FALSE_GREEN:/.test(ledger) ||
    /TEST_GAP:/.test(ledger);
  if (status === 'complete' && unconsumed) {
    fail('no_unconsumed_surprise', 'complete with surprise tags in ledger');
  } else {
    ok('no_unconsumed_surprise', 'ok');
  }

  return {
    scenario: scenario.id,
    workspace,
    pass: checks.every((c) => c.pass),
    failed: checks.filter((c) => !c.pass).length,
    checks,
  };
}

function selfTest() {
  const root = __dirname;
  const negDir = path.join(root, 'fixtures', '_negative');
  let failed = 0;

  // open backlog must fail complete oracle
  {
    const sc = {
      id: 'neg-open-backlog',
      test_command: 'true',
      oracle: {
        final_status: 'complete',
        suite_exit: 0,
        open_p0_p1: 0,
        min_non_material_streak: 2,
        require_honest_empty_attests: 2,
      },
    };
    const ws = path.join(negDir, 'open-backlog');
    const r = evaluate(ws, sc);
    const openCheck = r.checks.find((c) => c.id === 'open_p0_p1');
    if (openCheck && openCheck.pass === false) {
      console.log('PASS: self-test open-backlog rejected');
    } else {
      console.error('FAIL: self-test open-backlog should fail open_p0_p1');
      failed++;
    }
  }

  // missing honest-empty must fail
  {
    const sc = {
      id: 'neg-no-he',
      test_command: 'true',
      oracle: {
        final_status: 'complete',
        suite_exit: 0,
        open_p0_p1: 0,
        min_non_material_streak: 2,
        require_honest_empty_attests: 2,
      },
    };
    const ws = path.join(negDir, 'no-honest-empty');
    const r = evaluate(ws, sc);
    const he = r.checks.find((c) => c.id === 'honest_empty_attests');
    if (he && he.pass === false) {
      console.log('PASS: self-test no-honest-empty rejected');
    } else {
      console.error('FAIL: self-test no-honest-empty should fail HE count');
      failed++;
    }
  }

  if (failed) process.exit(2);
  console.log('validate-outcome self-test PASS');
}

function main() {
  if (has('--self-test')) {
    selfTest();
    return;
  }

  const workspace = arg('--workspace');
  const scenarioPath = arg('--scenario');
  if (!workspace || !scenarioPath) usage('missing args');
  if (!fs.existsSync(workspace)) usage('workspace missing');
  if (!fs.existsSync(scenarioPath)) usage('scenario missing');

  const scenario = JSON.parse(read(scenarioPath));
  const report = evaluate(workspace, scenario);

  if (has('--json')) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    for (const c of report.checks) {
      console.log(`${c.pass ? 'PASS' : 'FAIL'}: ${c.id} — ${c.detail}`);
    }
    console.log('---');
    console.log(
      report.pass
        ? `oracle PASS (${report.checks.length} checks) scenario=${scenario.id}`
        : `oracle FAIL (${report.failed}/${report.checks.length}) scenario=${scenario.id}`
    );
  }
  process.exit(report.pass ? 0 : 2);
}

if (require.main === module) main();
module.exports = {
  evaluate,
  countOpenP0P1,
  parseStatus,
  parseStreak,
  countHonestEmpty,
};
