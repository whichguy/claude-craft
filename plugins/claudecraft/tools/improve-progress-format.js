#!/usr/bin/env node
'use strict';
/**
 * improve-progress-format.js — pure formatter for control-channel progress pulses.
 *
 * Reads a JSON object (stdin or --file) and prints the mandatory markdown shape
 * defined in skills/improve-loop/references/contracts/progress.md.
 *
 * Exit codes:
 *   0 success
 *   1 usage / invalid JSON
 *   2 missing required fields
 *
 * No network. No git. Deterministic.
 */

function usage() {
  process.stderr.write(
    'Usage: improve-progress-format.js [--file path.json]  (or JSON on stdin)\n'
  );
}

function loadInput(argv) {
  const i = argv.indexOf('--file');
  if (i >= 0) {
    const fs = require('fs');
    const p = argv[i + 1];
    if (!p) throw new Error('missing path after --file');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  const fs = require('fs');
  const raw = fs.readFileSync(0, 'utf8');
  if (!raw.trim()) throw new Error('empty stdin');
  return JSON.parse(raw);
}

/**
 * @param {object} o
 * @returns {string} markdown pulse
 */
function formatProgressPulse(o) {
  if (!o || typeof o !== 'object') {
    const err = new Error('input must be a JSON object');
    err.code = 2;
    throw err;
  }
  const cycle = o.cycle;
  if (cycle === undefined || cycle === null || cycle === '') {
    const err = new Error('missing required field: cycle');
    err.code = 2;
    throw err;
  }

  const when = o.when || new Date().toISOString();
  const target = o.target || '—';
  const phase = o.phase || 'S8 cycle';
  const status = o.status || 'active';
  const outcome = o.outcome || 'n/a';
  const test = o.test || 'n/a';
  const committed = o.committed != null ? o.committed : 'n/a';

  const backlogDone = o.backlog_done != null ? o.backlog_done : '?';
  const backlogTotal = o.backlog_total != null ? o.backlog_total : '?';
  const maxCycles = o.max_cycles != null ? o.max_cycles : '?';
  const elapsed = o.elapsed_m != null ? o.elapsed_m : '?';
  const maxElapsed = o.max_elapsed_m != null ? `/max ${o.max_elapsed_m}m` : '';
  const noProgress = o.no_progress != null ? o.no_progress : 0;
  const sameError = o.same_error != null ? o.same_error : 0;
  const until = o.until || '—';
  const untilMet =
    o.until_met === true ? 'yes' : o.until_met === false ? 'no' : 'n/a';
  const landedCount = o.landed_count != null ? o.landed_count : '?';
  const latestSubject = o.latest_subject || '—';

  const changes = Array.isArray(o.changed_paths) ? o.changed_paths : [];
  const changeNotes = o.change_notes && typeof o.change_notes === 'object' ? o.change_notes : {};
  let changeBlock;
  if (changes.length === 0) {
    changeBlock = '- no code landed';
  } else {
    changeBlock = changes
      .slice(0, 8)
      .map((p) => {
        const note = changeNotes[p] ? String(changeNotes[p]).slice(0, 120) : 'updated';
        return `- ${p}: ${note}`;
      })
      .join('\n');
  }

  const learnings = Array.isArray(o.learnings) ? o.learnings.filter(Boolean) : [];
  const learnBlock =
    learnings.length === 0
      ? '- none new'
      : learnings
          .slice(0, 8)
          .map((l) => `- ${String(l).replace(/\n/g, ' ').slice(0, 200)}`)
          .join('\n');

  const nextItem = o.next || '—';
  const blockers = o.blockers || 'none';

  return [
    `## Improve progress — cycle ${cycle} / run`,
    '',
    `**When:** ${when}`,
    `**Target:** ${target}`,
    `**Phase:** ${phase}`,
    `**Status:** ${status}`,
    `**Outcome (this unit):** ${outcome}`,
    `**Test:** ${test}`,
    `**Committed:** ${committed}`,
    '',
    '### Progress',
    `- Backlog: ${backlogDone}/${backlogTotal} items checked`,
    `- Caps: cycle ${cycle}/${maxCycles}; elapsed ${elapsed}m${maxElapsed}; stall no-progress=${noProgress} same-error=${sameError}`,
    `- Until: ${until} → met? ${untilMet}`,
    `- Landed improve commits (grep): ${landedCount}; latest: ${latestSubject}`,
    '',
    '### This unit — key changes',
    changeBlock,
    '',
    '### This unit — key learnings',
    learnBlock,
    '',
    '### Next',
    `- Next backlog item: ${nextItem}`,
    `- Blockers / risks: ${blockers}`,
    '',
  ].join('\n');
}

function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    usage();
    process.exit(0);
  }
  let data;
  try {
    data = loadInput(argv);
  } catch (e) {
    process.stderr.write(String(e.message || e) + '\n');
    usage();
    process.exit(1);
  }
  try {
    process.stdout.write(formatProgressPulse(data));
  } catch (e) {
    process.stderr.write(String(e.message || e) + '\n');
    process.exit(e.code === 2 ? 2 : 1);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { formatProgressPulse };
