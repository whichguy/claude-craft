#!/usr/bin/env node
/**
 * ledger-status.js — L3: parse IMPROVE_LOOP.md + landed check for goal progress
 *
 * Live plan shape: ## Last cycle (preferred) dual-read with legacy ## Log / ### Iteration.
 *
 * Usage:
 *   node ledger-status.js --workspace <path> [--json]
 *
 * Exit codes:
 *   0 ok (including missing ledger → status null)
 *   1 usage
 *   2 workspace not a git dir
 *
 * Injectable: GIT_CMD
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { git } = require('./lib-paths.js');

function usage(msg) {
  if (msg) console.error(msg);
  console.error('usage: node ledger-status.js --workspace <path>');
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] ?? null;
}

/** Extract body of ## Section through next ## heading. */
function sectionBody(text, headingRe) {
  const m = text.split(headingRe);
  if (m.length < 2) return '';
  return (m[1] || '').split(/^## /m)[0] || '';
}

/**
 * Prefer ## Last cycle; fall back to latest ### Iteration block.
 * Returns { source, n, committed, outcome, log_iterations, last_cycle_n }.
 */
function parseCycleState(text) {
  const out = {
    source: 'none', // last_cycle | legacy_log | none
    n: null,
    committed: null,
    outcome: null,
    log_iterations: 0,
    last_cycle_n: null,
  };

  const lastCycleBody = sectionBody(text, /^## Last cycle\s*$/m);
  const nMatch = lastCycleBody.match(/^\*\*N:\*\*\s*(\d+)/m);
  const hasLastFields =
    Boolean(nMatch) ||
    /\*\*Thesis:\*\*/.test(lastCycleBody) ||
    /\*\*Committed:\*\*/.test(lastCycleBody);

  // Legacy ### Iteration count (always compute for dual-emit)
  const iterRe = /^### Iteration (\d+)\s*—/gm;
  const ns = [];
  let m;
  while ((m = iterRe.exec(text)) !== null) {
    ns.push(Number(m[1]));
  }

  if (hasLastFields) {
    out.source = 'last_cycle';
    out.n = nMatch ? Number(nMatch[1]) : null;
    out.last_cycle_n = out.n;
    // New shape: 0|1 meaning "is there cycle state", not diary length
    out.log_iterations = out.n != null || hasLastFields ? 1 : 0;
    const cm = lastCycleBody.match(/\*\*Committed:\*\*\s*(.+)/);
    if (cm) out.committed = cm[1].trim();
    const om = lastCycleBody.match(/\*\*Outcome:\*\*\s*(.+)/);
    if (om) out.outcome = om[1].trim();
    return out;
  }

  if (ns.length) {
    out.source = 'legacy_log';
    out.log_iterations = ns.length;
    out.n = ns[ns.length - 1];
    out.last_cycle_n = null;
    const parts = text.split(/^### Iteration /m);
    const last = parts[parts.length - 1] || '';
    const cm = last.match(/\*\*Committed:\*\*\s*(.+)/);
    if (cm) out.committed = cm[1].trim();
    const om = last.match(/\*\*Outcome:\*\*\s*(.+)/);
    if (om) out.outcome = om[1].trim();
    return out;
  }

  return out;
}

const workspace = arg('--workspace');
if (!workspace) usage();

const abs = path.resolve(workspace);
try {
  git(abs, ['rev-parse', '--is-inside-work-tree']);
} catch {
  console.error('ledger-status: not a git worktree: ' + abs);
  process.exit(2);
}

const ledgerPath = path.join(abs, 'IMPROVE_LOOP.md');
const result = {
  workspace: abs,
  ledger_path: ledgerPath,
  ledger_present: fs.existsSync(ledgerPath),
  status: null,
  iteration_counter: null,
  log_iterations: 0,
  last_cycle_n: null,
  cycle_state: 'none', // last_cycle | legacy_log | none
  open_backlog: 0,
  // Under open-only Backlog contract should be 0; non-zero = legacy [x] pollution
  checked_backlog: 0,
  open_deferred: 0,
  // Open-only Deferred prefers 0; non-zero = legacy checked P2 lines still parseable
  checked_deferred: 0,
  latest_n: null,
  latest_committed: null,
  latest_outcome: null,
  consecutive_no_progress: null,
  consecutive_same_error: null,
  error_signature: null,
  // Residual×2 streak (markdown: consecutive-non-material-cycles); distinct from complete-gate inputs
  consecutive_non_material_cycles: null,
  landed: false,
  terminal: false,
};

if (!result.ledger_present) {
  // check tip for terminal archive
  try {
    const body = git(abs, [
      'log',
      '--grep=improve-loop: iteration',
      '-n',
      '1',
      '--format=%s%n%b',
    ]);
    if (body.includes('--- full IMPROVE_LOOP.md (terminal archive) ---')) {
      result.status = 'complete-or-stopped-archived';
      result.terminal = true;
      result.landed = true;
      result.notes = 'resume file removed by terminal archive';
    }
  } catch {
    /* empty history */
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

const text = fs.readFileSync(ledgerPath, 'utf8');

const sm = text.match(/\*\*Status:\*\*\s*(.+)/);
if (sm) result.status = sm[1].trim();

const im = text.match(/\*\*Iteration counter:\*\*\s*(\d+)/);
if (im) result.iteration_counter = Number(im[1]);

const np = text.match(/consecutive-no-progress:\s*(\d+)/);
if (np) result.consecutive_no_progress = Number(np[1]);
const se = text.match(/consecutive-same-error:\s*(\d+)/);
if (se) result.consecutive_same_error = Number(se[1]);
const sig = text.match(/consecutive-same-error:\s*\d+\s*\(signature:\s*([^)]+)\)/);
if (sig) result.error_signature = sig[1].trim();
const nm = text.match(/consecutive-non-material-cycles:\s*(\d+)/);
if (nm) result.consecutive_non_material_cycles = Number(nm[1]);

// backlog (section body only — Deferred is a separate ## heading)
const backlogSection = text.split(/^## Backlog\s*$/m)[1] || '';
const backlogBody = backlogSection.split(/^## /m)[0] || backlogSection;
for (const line of backlogBody.split('\n')) {
  if (/^- \[[ ]\] /.test(line)) result.open_backlog += 1;
  if (/^- \[[xX]\] /.test(line)) result.checked_backlog += 1;
}

// deferred (P2) — not material; do not fold into open_backlog
const deferredSection = text.split(/^## Deferred(?: \(P2\))?\s*$/m)[1] || '';
const deferredBody = deferredSection.split(/^## /m)[0] || deferredSection;
for (const line of deferredBody.split('\n')) {
  if (/^- \[[ ]\] /.test(line)) result.open_deferred += 1;
  if (/^- \[[xX]\] /.test(line)) result.checked_deferred += 1;
}

const cycle = parseCycleState(text);
result.cycle_state = cycle.source;
result.log_iterations = cycle.log_iterations;
result.last_cycle_n = cycle.last_cycle_n;
result.latest_n = cycle.n;
result.latest_committed = cycle.committed;
result.latest_outcome = cycle.outcome;

if (result.latest_n != null) {
  // landed = Committed yes AND git has the subject
  if (/^yes\b/i.test(result.latest_committed || '')) {
    try {
      const found = git(abs, [
        'log',
        `--grep=improve-loop: iteration ${result.latest_n} —`,
        '-n',
        '1',
        '--format=%H',
      ]);
      result.landed = Boolean(found && found.length > 0);
    } catch {
      result.landed = false;
    }
  }
}

if (result.status) {
  result.terminal =
    result.status === 'complete' ||
    result.status.startsWith('complete') ||
    result.status.startsWith('stopped');
}

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exit(0);
