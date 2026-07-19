#!/usr/bin/env node
'use strict';
/**
 * improve-progress-format.js — pure formatter for control-channel progress pulses.
 *
 * Reads a JSON object (stdin or --file) and prints the mandatory markdown shape
 * defined in skills/improve-loop/references/contracts/progress.md (PLAN_PROGRESS_ALIGN).
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

function clip(s, n) {
  const t = String(s == null ? '' : s).replace(/\n/g, ' ').trim();
  if (!t) return '';
  return t.length <= n ? t : t.slice(0, n);
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

  const maxCycles = o.max_cycles != null && o.max_cycles !== '' ? o.max_cycles : null;
  const iter = o.iter != null && o.iter !== '' ? o.iter : null;
  const pulseKind = o.pulse_kind || o.kind_phase || null;
  // Heading: cycle K/MAX · iter N · kind (omit missing axes)
  let heading = `## Improve progress — cycle ${cycle}`;
  if (maxCycles != null) heading += `/${maxCycles}`;
  else heading += ' / run';
  if (iter != null) heading += ` · iter ${iter}`;
  if (pulseKind) heading += ` · ${clip(pulseKind, 24)}`;

  const when = o.when || new Date().toISOString();
  const target = o.target || '—';
  const goal = o.campaign_goal != null ? clip(o.campaign_goal, 120) : null;
  let status = o.status || 'active';
  const outcome = o.outcome || 'n/a';
  const test = o.test || 'n/a';
  const committed = o.committed != null ? o.committed : 'n/a';

  // Residual meter: prefer open_p01 (dual-home safe); legacy backlog_* only if open_p01 absent
  const hasOpen = o.open_p01 !== undefined && o.open_p01 !== null && o.open_p01 !== '';
  const openP01 = hasOpen ? o.open_p01 : null;
  const residualStreak =
    o.residual_streak != null && o.residual_streak !== ''
      ? o.residual_streak
      : o.non_material != null
        ? o.non_material
        : null;
  const suite = o.suite || test || 'n/a';

  // R8d guard: Validation fail must not leave status as complete
  const validation =
    o.validation != null && String(o.validation).trim()
      ? String(o.validation).trim()
      : null;
  if (
    validation &&
    /\bfail\b/i.test(validation) &&
    !/\b0 fail\b/i.test(validation) &&
    /complete/i.test(String(status))
  ) {
    status = 'active';
  }

  const stepId = o.step_id != null ? clip(o.step_id, 32) : '';
  const item = o.item != null ? clip(o.item, 48) : '';
  const action = o.action != null ? clip(o.action, 72) : '';
  const lastResolved =
    o.last_resolved != null ? clip(o.last_resolved, 160) : o.lastResolved != null
      ? clip(o.lastResolved, 160)
      : '';
  const nextItem = o.next != null ? clip(o.next, 200) : '—';
  const blockers = o.blockers || 'none';

  const noProgress = o.no_progress != null ? o.no_progress : 0;
  const sameError = o.same_error != null ? o.same_error : 0;
  const elapsed = o.elapsed_m != null ? o.elapsed_m : null;
  const maxElapsed = o.max_elapsed_m != null ? `/max ${o.max_elapsed_m}m` : '';
  const until = o.until || null;
  const untilMet =
    o.until_met === true ? 'yes' : o.until_met === false ? 'no' : null;
  const landedCount = o.landed_count != null ? o.landed_count : null;
  const latestSubject = o.latest_subject || null;

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

  // Residual line
  const streakPart = residualStreak != null ? `${residualStreak}/2` : '?/2';
  const openPart = hasOpen ? `open P0/P1 ${openP01}` : null;
  let residualLine = `**Residual:** ${streakPart}`;
  if (openPart) residualLine += ` · ${openPart}`;
  residualLine += ` · suite ${suite}`;
  // Legacy footnote only when open_p01 not provided
  if (!hasOpen && (o.backlog_done != null || o.backlog_total != null)) {
    const bd = o.backlog_done != null ? o.backlog_done : '?';
    const bt = o.backlog_total != null ? o.backlog_total : '?';
    residualLine += `\n**Backlog (legacy):** ${bd}/${bt} items checked`;
  }

  // Now line
  const nowParts = [];
  if (stepId) nowParts.push(`\`${stepId}\``);
  if (item) nowParts.push(`\`${item}\``);
  if (action) nowParts.push(action);
  const nowLine =
    nowParts.length > 0
      ? `**Now:** ${nowParts.join(' · ')}`
      : o.phase
        ? `**Now:** ${clip(o.phase, 72)}`
        : null;

  const lines = [
    heading,
    '',
    `**When:** ${when}`,
    `**Target:** ${target}`,
  ];
  if (goal) lines.push(`**Campaign goal:** ${goal}`);
  lines.push(`**Status:** ${status}`);
  lines.push(residualLine);
  if (nowLine) lines.push(nowLine);
  if (lastResolved) lines.push(`**Last resolved:** ${lastResolved}`);
  lines.push(`**Next:** ${nextItem}`);
  lines.push(`**Outcome (this unit):** ${outcome}`);
  lines.push(`**Test:** ${test}`);
  lines.push(`**Committed:** ${committed}`);

  // Optional caps / stall (compact one line when any present)
  const capBits = [];
  if (maxCycles != null) capBits.push(`cycle ${cycle}/${maxCycles}`);
  if (elapsed != null) capBits.push(`elapsed ${elapsed}m${maxElapsed}`);
  capBits.push(`stall no-progress=${noProgress} same-error=${sameError}`);
  if (until) {
    const met = untilMet != null ? untilMet : 'n/a';
    capBits.push(`until → met? ${met}`);
  }
  if (landedCount != null || latestSubject) {
    capBits.push(
      `landed ${landedCount != null ? landedCount : '?'}; latest: ${latestSubject || '—'}`
    );
  }
  if (capBits.length) {
    lines.push(`**Caps:** ${capBits.join('; ')}`);
  }
  if (blockers && blockers !== 'none') {
    lines.push(`**Blockers:** ${blockers}`);
  }

  lines.push('');
  lines.push('### This unit — key changes');
  lines.push(changeBlock);
  lines.push('');
  lines.push('### This unit — key learnings');
  lines.push(learnBlock);
  lines.push('');

  if (validation) {
    // Ensure greppable Validation: prefix
    const v = validation.startsWith('Validation:')
      ? validation
      : `Validation: ${validation}`;
    lines.push(v);
    lines.push('');
  }

  return lines.join('\n');
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
