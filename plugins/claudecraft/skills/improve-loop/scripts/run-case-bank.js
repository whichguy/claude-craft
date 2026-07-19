#!/usr/bin/env node
/**
 * run-case-bank.js — Tier-1 illustrative cases: ledger.md → soft-check codes
 *
 * Does NOT run the LLM. For prompt→thinking→output, use test-prompt-harness
 * (no improve-loop fixtures yet).
 *
 * Usage:
 *   node scripts/run-case-bank.js
 *   node scripts/run-case-bank.js --cases-dir path/to/cases
 *
 * Exit: 0 all pass; 1 usage; 2 one or more case failures
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  softCheckSpecBundle,
  parseCampaignMeta,
} = require('./spec-validate.js');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function main() {
  const skillRoot = path.resolve(__dirname, '..');
  const casesDir = path.resolve(
    arg('--cases-dir', path.join(skillRoot, 'tests', 'cases'))
  );
  if (!fs.existsSync(casesDir)) {
    console.error('cases dir missing:', casesDir);
    process.exit(1);
  }

  const ledgers = fs
    .readdirSync(casesDir)
    .filter((f) => f.endsWith('.ledger.md'))
    .sort();

  if (!ledgers.length) {
    console.error('no *.ledger.md in', casesDir);
    process.exit(1);
  }

  let failed = 0;
  const report = [];

  for (const ledgerName of ledgers) {
    const base = ledgerName.replace(/\.ledger\.md$/, '');
    const ledgerPath = path.join(casesDir, ledgerName);
    const expectedPath = path.join(casesDir, base + '.expected.json');
    const ledger = fs.readFileSync(ledgerPath, 'utf8');
    const result = softCheckSpecBundle(ledger);
    const gotCodes = [...new Set(result.warnings.map((w) => w.code))].sort();

    let expected;
    if (fs.existsSync(expectedPath)) {
      expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
    } else {
      console.error('FAIL:', base, '— missing', path.basename(expectedPath));
      failed++;
      continue;
    }

    const wantCodes = [...new Set(expected.codes || [])].sort();
    const wantOk = expected.ok === true;
    const codesMatch =
      wantCodes.length === gotCodes.length &&
      wantCodes.every((c, i) => c === gotCodes[i]);
    const okMatch = result.ok === wantOk;
    const pass = codesMatch && okMatch;

    const row = {
      case: base,
      pass,
      meta: {
        planTier: result.meta.planTier,
        habitatClaimed: result.meta.habitatClaimed,
        seedMode: result.meta.seedMode,
      },
      expected: { ok: wantOk, codes: wantCodes },
      actual: { ok: result.ok, codes: gotCodes },
      warnings: result.warnings,
    };
    report.push(row);

    if (pass) {
      console.log('PASS:', base, 'ok=' + result.ok, 'codes=' + JSON.stringify(gotCodes));
    } else {
      failed++;
      console.error('FAIL:', base);
      console.error('  expected ok=', wantOk, 'codes=', wantCodes);
      console.error('  actual   ok=', result.ok, 'codes=', gotCodes);
    }
  }

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ failed, report }, null, 2) + '\n');
  } else {
    console.log('---');
    console.log(
      failed === 0
        ? `case-bank PASS (${ledgers.length} cases)`
        : `case-bank FAIL (${failed}/${ledgers.length} failed)`
    );
  }

  // smoke: meta parse on thin case
  const thin = path.join(casesDir, 'thin-habitat-spec.ledger.md');
  if (fs.existsSync(thin)) {
    const m = parseCampaignMeta(fs.readFileSync(thin, 'utf8'));
    if (m.habitatClaimed !== true) {
      console.error('FAIL: thin case meta habitatClaimed expected true');
      failed++;
    }
  }

  process.exit(failed === 0 ? 0 : 2);
}

if (require.main === module) main();

module.exports = { main };
