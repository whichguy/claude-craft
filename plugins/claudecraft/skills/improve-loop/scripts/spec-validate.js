#!/usr/bin/env node
/**
 * spec-validate.js — pure helpers for PLAN_VALIDATE / Phase 3v / PLAN_SPEC_SOFT
 *
 * Parse ## Spec validation rows; seed lines for failed V-ids; soft-check Spec quality.
 * Orchestrator runs Proofs and writes Status cells; this module is API-free / deterministic.
 * Soft-check warnings never alone block residual×2 complete and never auto-seed P1s.
 *
 * Usage:
 *   node spec-validate.js self-test
 *   node spec-validate.js soft-check --plan-file <path>
 *   node -e "require('./spec-validate.js')"  # library
 *
 * Exit: 0 ok; 1 usage; 2 self-test fail
 */
'use strict';

const fs = require('fs');

const KINDS = new Set([
  'suite',
  'L3-test',
  'l3-test',
  'skill-law',
  'prose-sweep',
  'dual-home',
  'manual',
  'habitat',
]);

/** Stable soft-check codes (PLAN_SPEC_SOFT). */
const WARNING_CODES = Object.freeze({
  MISSING_PREFIX: 'MISSING_PREFIX',
  EMPTY_INTENTION: 'EMPTY_INTENTION',
  SUITE_ONLY_PROOFS: 'SUITE_ONLY_PROOFS',
  MISSING_FEATURE: 'MISSING_FEATURE',
  MISSING_PRESERVE: 'MISSING_PRESERVE',
  MISSING_SCOPE_OR_ASSUMPTION: 'MISSING_SCOPE_OR_ASSUMPTION',
  HABITAT_CLAIMED_NO_PROOF: 'HABITAT_CLAIMED_NO_PROOF',
  ASSUMPTION_NOTES_ONLY_PROOF: 'ASSUMPTION_NOTES_ONLY_PROOF',
  SYNC_STALE: 'SYNC_STALE',
});

/** Default recorded-suite Proof tokens (normalized substring match). */
const DEFAULT_SUITE_PROOF_TOKENS = [
  'make test-fast',
  'make test',
  'npm test',
  'npm run test',
  'pytest',
  'go test',
];

/**
 * Parse markdown table rows under ## Spec validation.
 * @param {string} planText
 * @returns {{ id: string, intention: string, kind: string, artifact: string, proof: string, status: string }[]}
 */
function parseSpecValidationRows(planText) {
  const section = sectionBody(planText, /^## Spec validation\s*$/m);
  if (!section) return [];
  const rows = [];
  for (const line of section.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    if (/^\|\s*ID\s*\|/i.test(t) || /^\|\s*-+/.test(t)) continue;
    const cells = splitTableRow(t);
    if (cells.length < 6) continue;
    const id = cells[0].trim();
    if (!/^V\d+$/i.test(id)) continue;
    rows.push({
      id: id.toUpperCase().replace(/^v/i, 'V'),
      intention: cells[1].trim(),
      kind: cells[2].trim(),
      artifact: cells[3].trim(),
      proof: cells[4].trim(),
      status: (cells[5] || 'pending').trim().toLowerCase(),
    });
  }
  return rows;
}

function splitTableRow(line) {
  const parts = line.split('|').map((s) => s.trim());
  if (parts[0] === '') parts.shift();
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

function sectionBody(text, headingRe) {
  const m = text.split(headingRe);
  if (m.length < 2) return '';
  return (m[1] || '').split(/^## /m)[0] || '';
}

/**
 * Parse durable campaign header fields from IMPROVE_LOOP.md.
 * @param {string} planText
 * @returns {{
 *   planTier: string|null,
 *   seedMode: string|null,
 *   habitatClaimed: boolean|null,
 *   habitatProbe: string|null,
 *   habitatProbeResult: string|null,
 *   habitatProbeEvidence: string|null,
 *   productResidualSurvey: string|null,
 *   operatorDoneWhen: string|null,
 *   installMechanism: string|null,
 *   specValidation: string|null,
 * }}
 */
function parseCampaignMeta(planText) {
  const text = planText || '';
  const headerKey = (label) => {
    const re = new RegExp(
      '^\\*\\*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\*\\*\\s*(.+)$',
      'mi'
    );
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };

  const claimedRaw = headerKey('Habitat claimed');
  let habitatClaimed = null;
  if (claimedRaw != null) {
    const c = claimedRaw.toLowerCase();
    if (c === 'yes' || c === 'true' || c === '1') habitatClaimed = true;
    else if (c === 'no' || c === 'false' || c === '0') habitatClaimed = false;
  }

  return {
    planTier: headerKey('Plan tier'),
    seedMode: headerKey('Seed mode'),
    habitatClaimed,
    habitatProbe: headerKey('Habitat probe'),
    habitatProbeResult: headerKey('Habitat probe result'),
    habitatProbeEvidence: headerKey('Habitat probe evidence'),
    productResidualSurvey: headerKey('Product residual survey'),
    operatorDoneWhen: headerKey('Operator done-when'),
    installMechanism: headerKey('Install mechanism'),
    specValidation: headerKey('Spec validation'),
  };
}

/**
 * Is this kind executable for unattended complete blocking / 3v seed?
 * habitat is executable when not n/a (material fail can seed validate rows).
 * manual never blocks complete alone.
 * @param {string} kind
 */
function isExecutableKind(kind) {
  const k = (kind || '').toLowerCase().replace(/\s+/g, '-');
  if (k === 'manual') return false;
  if (
    k === 'l3-test' ||
    k === 'suite' ||
    k === 'skill-law' ||
    k === 'prose-sweep' ||
    k === 'dual-home' ||
    k === 'habitat'
  )
    return true;
  const first = k.split(/[|,]/)[0];
  return first !== 'manual' && first.length > 0;
}

/**
 * Header flag from row statuses (executable only for pass).
 * @param {ReturnType<typeof parseSpecValidationRows>} rows
 * @returns {'n/a'|'pending'|'pass'}
 */
function headerFlagFromRows(rows) {
  if (!rows.length) return 'n/a';
  const exec = rows.filter((r) => isExecutableKind(r.kind) && r.status !== 'n/a' && r.status !== 'skipped');
  if (!exec.length) {
    const anyNonNa = rows.some((r) => r.status !== 'n/a' && r.status !== 'skipped');
    return anyNonNa ? 'pending' : 'n/a';
  }
  if (exec.every((r) => r.status === 'pass')) return 'pass';
  return 'pending';
}

/**
 * Build seed titles for failed executable rows, deduped against backlog text.
 * Soft-check warnings never call this.
 */
function seedLinesForFails(rows, backlogText) {
  const seeds = [];
  const bl = backlogText || '';
  for (const r of rows) {
    if (!isExecutableKind(r.kind)) continue;
    if (r.status !== 'fail') continue;
    const token = `validate ${r.id}`;
    if (new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(bl)) continue;
    if (seeds.some((s) => s.id === r.id)) continue;
    const short = (r.intention || r.id).slice(0, 80);
    const art = (r.artifact || '—').slice(0, 60);
    seeds.push({
      id: r.id,
      title: `- [ ] P1: [defect] validate ${r.id}: ${short} (${art})`,
      evidence: `Proof failed for ${r.id}: ${(r.proof || '').slice(0, 120)}`,
      notesHint: 'fix target: product | proof',
    });
  }
  return seeds;
}

function needsWriteSectionSeed(planText, opts = {}) {
  if (!opts.required) return false;
  const rows = parseSpecValidationRows(planText);
  if (rows.length > 0) return false;
  const bl = sectionBody(planText, /^## Backlog\s*$/m);
  if (/write Spec validation section/i.test(bl)) return false;
  return true;
}

function writeSectionSeedTitle() {
  return '- [ ] P1: [defect] write Spec validation section (required at tier T2)';
}

/** Plan-anchor prefixes required on non-n/a Intention cells (PLAN_SPEC_SOFT). */
const ANCHOR_PREFIX_RE =
  /^(Feature|Preserve|Regression|Scope|Assumption|Done-when|Lock):\s*/i;

function warn(code, message, id) {
  const w = { code, message };
  if (id != null) w.id = id;
  return w;
}

/**
 * Soft-check: Intention plan-anchor prefixes.
 * @returns {{ ok: boolean, warnings: { code: string, id?: string, message: string, reason?: string }[] }}
 */
function softCheckIntentions(rows) {
  const warnings = [];
  for (const r of rows || []) {
    if ((r.status || '').toLowerCase() === 'n/a') continue;
    const intention = (r.intention || '').trim();
    if (!intention) {
      warnings.push(
        warn(WARNING_CODES.EMPTY_INTENTION, 'empty Intention', r.id)
      );
      // legacy reason field for older callers
      warnings[warnings.length - 1].reason = 'empty Intention';
      continue;
    }
    if (!ANCHOR_PREFIX_RE.test(intention)) {
      warnings.push(
        warn(WARNING_CODES.MISSING_PREFIX, 'missing plan-anchor prefix', r.id)
      );
      warnings[warnings.length - 1].reason = 'missing plan-anchor prefix';
    }
  }
  return { ok: warnings.length === 0, warnings };
}

/**
 * Soft-check: plan changed since last sync marker.
 * @returns {{ warning: string, code: string } | null}
 */
function softCheckSyncStale(opts = {}) {
  if (opts.plan_changed_since_sync === true) {
    const m =
      opts.markerIter != null && opts.markerIter !== ''
        ? ` since iter ${opts.markerIter}`
        : '';
    return {
      code: WARNING_CODES.SYNC_STALE,
      warning: `plan may have changed since last spec-sync marker${m}`,
    };
  }
  return null;
}

function normalizeProof(proof) {
  return String(proof || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*(→|->|exit\s*0)\s*$/i, '')
    .trim();
}

function isSuiteOnlyProof(proof, suiteTokens = DEFAULT_SUITE_PROOF_TOKENS) {
  const n = normalizeProof(proof);
  if (!n) return false;
  return suiteTokens.some((tok) => {
    const t = tok.toLowerCase();
    return n === t || n.startsWith(t + ' ') || n === t + ';';
  });
}

/**
 * Soft-check: ≥2 non-n/a rows all use only the recorded suite as Proof.
 */
function softCheckProofDiversity(rows, opts = {}) {
  const warnings = [];
  const suiteTokens = opts.suiteTokens || DEFAULT_SUITE_PROOF_TOKENS;
  // Exclude n/a/skipped and structural Notes-only proofs (those are ASSUMPTION_NOTES_ONLY).
  // Suite-collapse is about multiple "real" Proofs all being only the recorded suite.
  const active = (rows || []).filter((r) => {
    if (['n/a', 'skipped'].includes((r.status || '').toLowerCase())) return false;
    const proof = (r.proof || '').trim();
    if (!proof || NOTES_ONLY_PROOF_RE.test(proof)) return false;
    return true;
  });
  if (active.length < 2) return { ok: true, warnings };
  if (active.every((r) => isSuiteOnlyProof(r.proof, suiteTokens))) {
    warnings.push(
      warn(
        WARNING_CODES.SUITE_ONLY_PROOFS,
        `all ${active.length} command-like Proofs collapse to recorded suite only`
      )
    );
  }
  return { ok: warnings.length === 0, warnings };
}

function intentionHasPrefix(intention, name) {
  return new RegExp('^' + name + ':\\s*', 'i').test((intention || '').trim());
}

/**
 * Soft-check: Feature+Preserve for T2/T0p/product/mixed; Scope|Assumption preferred.
 */
function softCheckCoverageMix(rows, opts = {}) {
  const warnings = [];
  const meta = opts.meta || {};
  const planTier = String(opts.planTier ?? meta.planTier ?? '').trim();
  const seedMode = String(opts.seedMode ?? meta.seedMode ?? '')
    .trim()
    .toLowerCase();
  const requireMix =
    opts.requireMix === true ||
    planTier === '2' ||
    planTier === '0p' ||
    seedMode === 'product' ||
    seedMode === 'mixed';
  if (!requireMix) return { ok: true, warnings };

  const active = (rows || []).filter(
    (r) => !['n/a', 'skipped'].includes((r.status || '').toLowerCase())
  );
  if (!active.length) return { ok: true, warnings };

  const hasFeature = active.some((r) => intentionHasPrefix(r.intention, 'Feature'));
  const hasPreserve = active.some((r) => intentionHasPrefix(r.intention, 'Preserve'));
  const hasScope = active.some((r) => intentionHasPrefix(r.intention, 'Scope'));
  const hasAssumption = active.some((r) =>
    intentionHasPrefix(r.intention, 'Assumption')
  );

  if (!hasFeature) {
    warnings.push(
      warn(WARNING_CODES.MISSING_FEATURE, 'T2/product Spec missing Feature: row')
    );
  }
  if (!hasPreserve) {
    warnings.push(
      warn(WARNING_CODES.MISSING_PRESERVE, 'T2/product Spec missing Preserve: row')
    );
  }
  if (!hasScope && !hasAssumption) {
    warnings.push(
      warn(
        WARNING_CODES.MISSING_SCOPE_OR_ASSUMPTION,
        'T2/product Spec missing Scope: or Assumption: row (preferred)'
      )
    );
  }
  return { ok: warnings.length === 0, warnings };
}

function rowLooksHabitatRelevant(r) {
  const kind = (r.kind || '').toLowerCase();
  if (/\bhabitat\b/.test(kind)) return true;
  const blob = `${r.intention || ''} ${r.proof || ''} ${r.artifact || ''}`.toLowerCase();
  return /docker|hermes|skillhub|container|\/opt\/data|habitat/.test(blob);
}

/**
 * Soft-check: habitat claimed but no habitat-relevant Spec row.
 * Alias: softCheckHabitatCoverage (PLAN_SPEC_SOFT plan name).
 */
function softCheckHabitatClaim(rows, opts = {}) {
  const warnings = [];
  const meta = opts.meta || {};
  let claimed = opts.habitatClaimed;
  if (claimed === undefined) claimed = meta.habitatClaimed;
  if (claimed !== true) return { ok: true, warnings };

  const active = (rows || []).filter(
    (r) => !['n/a', 'skipped'].includes((r.status || '').toLowerCase())
  );
  if (!active.some(rowLooksHabitatRelevant)) {
    warnings.push(
      warn(
        WARNING_CODES.HABITAT_CLAIMED_NO_PROOF,
        'Habitat claimed: yes but no habitat-relevant Spec row (kind habitat or docker/hermes/container Proof)'
      )
    );
  }
  return { ok: warnings.length === 0, warnings };
}

/** PLAN_SPEC_SOFT alias — habitat coverage when claim is true. */
const softCheckHabitatCoverage = softCheckHabitatClaim;

/**
 * PLAN_SPEC_SOFT alias — anti-mirror / coverage mix (Feature+Preserve+Scope|Assumption).
 * Soft only: never seeds backlog (soft ≠ seed).
 */
const softCheckAntiMirror = softCheckCoverageMix;

/** Structural Notes-only Proof (not substring "observation" in real commands). */
const NOTES_ONLY_PROOF_RE =
  /^(notes?|kickoff\s+notes?|diary|—|-|n\/a|none)\s*$/i;

/**
 * Soft-check: Assumption rows with empty or Notes-only Proof.
 */
function softCheckAssumptionProof(rows) {
  const warnings = [];
  for (const r of rows || []) {
    if (['n/a', 'skipped'].includes((r.status || '').toLowerCase())) continue;
    if (!intentionHasPrefix(r.intention, 'Assumption')) continue;
    const proof = (r.proof || '').trim();
    if (!proof || NOTES_ONLY_PROOF_RE.test(proof)) {
      warnings.push(
        warn(
          WARNING_CODES.ASSUMPTION_NOTES_ONLY_PROOF,
          'Assumption Proof empty or Notes-only (not executable)',
          r.id
        )
      );
    }
  }
  return { ok: warnings.length === 0, warnings };
}

/**
 * Aggregate soft-checks for a plan file body.
 * @param {string} planText
 * @param {{
 *   plan_changed_since_sync?: boolean,
 *   markerIter?: number|string|null,
 *   habitatClaimed?: boolean,
 *   planTier?: string,
 *   seedMode?: string,
 *   suiteTokens?: string[],
 * }} opts
 */
function softCheckSpecBundle(planText, opts = {}) {
  const rows = parseSpecValidationRows(planText);
  const meta = parseCampaignMeta(planText);
  if (opts.habitatClaimed !== undefined) {
    meta.habitatClaimed = opts.habitatClaimed;
  }
  if (opts.planTier != null) meta.planTier = opts.planTier;
  if (opts.seedMode != null) meta.seedMode = opts.seedMode;

  const warnings = [];
  const push = (part) => {
    for (const w of part.warnings || []) warnings.push(w);
  };

  push(softCheckIntentions(rows));
  push(softCheckProofDiversity(rows, { suiteTokens: opts.suiteTokens }));
  push(
    softCheckCoverageMix(rows, {
      meta,
      planTier: opts.planTier,
      seedMode: opts.seedMode,
    })
  );
  push(
    softCheckHabitatClaim(rows, {
      meta,
      habitatClaimed: opts.habitatClaimed,
    })
  );
  push(softCheckAssumptionProof(rows));

  const stale = softCheckSyncStale(opts);
  if (stale) {
    warnings.push(warn(WARNING_CODES.SYNC_STALE, stale.warning));
  }

  // de-dupe by code+id
  const seen = new Set();
  const deduped = [];
  for (const w of warnings) {
    const k = `${w.code}|${w.id || ''}|${w.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(w);
  }

  return {
    ok: deduped.length === 0,
    meta,
    rows,
    warnings: deduped,
  };
}

// --- self-test ---
function selfTest() {
  const ok = (cond, msg) => {
    if (!cond) {
      console.error('FAIL:', msg);
      process.exit(2);
    }
    console.log('PASS:', msg);
  };

  const plan = `
# Improve Loop: t
**Spec validation:** pending

## Spec validation
| ID | Intention | Kind | Artifact(s) | Proof | Status |
|---|---|---|---|---|---|
| V1 | dual-read | L3-test | scripts/ledger-status.js | node tests | fail |
| V2 | prose | skill-law | SKILL.md | rg -n '## Log' | pass |
| V3 | human | manual | — | look | pending |

## Backlog
- [ ] P1: something else — why
`;

  const rows = parseSpecValidationRows(plan);
  ok(rows.length === 3, 'parse 3 rows');
  ok(rows[0].id === 'V1' && rows[0].status === 'fail', 'V1 fail');
  ok(isExecutableKind('manual') === false, 'manual not executable');
  ok(isExecutableKind('L3-test') === true, 'L3-test executable');
  ok(isExecutableKind('habitat') === true, 'habitat executable');
  ok(headerFlagFromRows(rows) === 'pending', 'header pending when fail');

  const bl = sectionBody(plan, /^## Backlog\s*$/m);
  const seeds = seedLinesForFails(rows, bl);
  ok(seeds.length === 1 && seeds[0].id === 'V1', 'one seed for V1');
  ok(/validate V1/.test(seeds[0].title), 'seed title has validate V1');

  const bl2 = bl + '\n' + seeds[0].title + '\n';
  const seeds2 = seedLinesForFails(rows, bl2);
  ok(seeds2.length === 0, 'dedupe seed');

  const allPass = rows.map((r) =>
    isExecutableKind(r.kind) ? { ...r, status: 'pass' } : r
  );
  ok(headerFlagFromRows(allPass) === 'pass', 'header pass when executable pass');

  ok(needsWriteSectionSeed('# x\n## Backlog\n', { required: true }) === true, 'need section seed');
  ok(needsWriteSectionSeed(plan, { required: true }) === false, 'no section seed when rows');
  ok(writeSectionSeedTitle().includes('Spec validation'), 'write section title');

  // PLAN_SPEC_SOFT prefix
  const softBad = softCheckIntentions([
    { id: 'V1', intention: 'dual-read', kind: 'L3-test', status: 'fail' },
    { id: 'V2', intention: 'Preserve: x', kind: 'suite', status: 'pass' },
    { id: 'V3', intention: 'Scope: y', kind: 'manual', status: 'n/a' },
  ]);
  ok(softBad.ok === false, 'soft missing prefix not ok');
  ok(softBad.warnings.length === 1 && softBad.warnings[0].id === 'V1', 'soft warns V1 only');
  ok(softBad.warnings[0].code === WARNING_CODES.MISSING_PREFIX, 'soft code MISSING_PREFIX');
  const softGood = softCheckIntentions([
    { id: 'V1', intention: 'Feature: dual-read', kind: 'L3-test', status: 'fail' },
  ]);
  ok(softGood.ok === true, 'soft with Feature: ok');
  ok(softCheckSyncStale({ plan_changed_since_sync: true, markerIter: 3 })?.warning, 'soft stale warning');
  ok(softCheckSyncStale({}) === null, 'soft stale null when unchanged');

  // Fixture A — thin packaging Spec (backchain-shaped)
  const fixtureA = `
# Improve Loop: backchain thin
**Plan tier:** 2
**Seed mode:** mixed
**Habitat claimed:** yes
**Habitat probe:** docker ps
**Habitat probe result:** ok
**Spec validation:** pending

## Spec validation
| ID | Intention | Kind | Artifact(s) | Proof | Status |
|---|---|---|---|---|---|
| V1 | Feature: install | suite | install.sh | make test-fast | pending |
| V2 | Feature: frontmatter | suite | SKILL.md | make test-fast | pending |
| V3 | Feature: docs | suite | SKILL.md | make test-fast | pending |
| V4 | Assumption: bind mount | prose-sweep | — | kickoff Notes | pending |
`;

  const metaA = parseCampaignMeta(fixtureA);
  ok(metaA.planTier === '2', 'meta plan tier 2');
  ok(metaA.habitatClaimed === true, 'meta habitat claimed yes');
  ok(metaA.seedMode === 'mixed', 'meta seed mixed');

  const bundleA = softCheckSpecBundle(fixtureA);
  ok(bundleA.ok === false, 'fixture A not ok');
  const codesA = new Set(bundleA.warnings.map((w) => w.code));
  ok(codesA.has(WARNING_CODES.SUITE_ONLY_PROOFS), 'A SUITE_ONLY_PROOFS');
  ok(codesA.has(WARNING_CODES.MISSING_PRESERVE), 'A MISSING_PRESERVE');
  ok(codesA.has(WARNING_CODES.HABITAT_CLAIMED_NO_PROOF), 'A HABITAT_CLAIMED_NO_PROOF');
  ok(codesA.has(WARNING_CODES.ASSUMPTION_NOTES_ONLY_PROOF), 'A ASSUMPTION_NOTES_ONLY_PROOF');
  ok(!codesA.has(WARNING_CODES.MISSING_FEATURE), 'A has Feature rows');

  // Fixture B — good minimal T2
  const fixtureB = `
# Improve Loop: good
**Plan tier:** 2
**Seed mode:** mixed
**Habitat claimed:** yes
**Spec validation:** pending

## Spec validation
| ID | Intention | Kind | Artifact(s) | Proof | Status |
|---|---|---|---|---|---|
| V1 | Feature: dual install | L3-test | install.sh | bash test/install-targets.test.sh | pending |
| V2 | Preserve: Claude install | suite | install.sh | bash test/install-targets.test.sh | pending |
| V3 | Regression: host suite | suite | — | make test-fast | pending |
| V4 | Feature: container readable | habitat | SKILL.md | docker exec hermes test -e /opt/data/skills/x/SKILL.md | pending |
| V5 | Scope: skill-only package | prose-sweep | SKILL.md | rg -n 'skill package' SKILL.md | pending |
`;

  const bundleB = softCheckSpecBundle(fixtureB);
  ok(bundleB.ok === true, 'fixture B ok (no soft warnings)');
  ok(isSuiteOnlyProof('make test-fast') === true, 'suite token match');
  ok(isSuiteOnlyProof('bash test/install-targets.test.sh') === false, 'per-row not suite-only');

  // proof diversity: single row no warn
  const one = softCheckProofDiversity([
    { id: 'V1', intention: 'Feature: x', proof: 'make test-fast', status: 'pending' },
  ]);
  ok(one.ok === true, 'single suite proof no diversity warn');

  // Assumption with real proof ok
  const assOk = softCheckAssumptionProof([
    {
      id: 'V1',
      intention: 'Assumption: bind mount',
      proof: 'docker inspect hermes',
      status: 'pending',
    },
  ]);
  ok(assOk.ok === true, 'assumption with real proof ok');

  // Aliases export the same soft helpers
  ok(softCheckAntiMirror === softCheckCoverageMix, 'softCheckAntiMirror alias');
  ok(softCheckHabitatCoverage === softCheckHabitatClaim, 'softCheckHabitatCoverage alias');

  // soft-no-seed: soft warnings never produce seed lines (soft ≠ seed)
  const blBefore = sectionBody(fixtureA, /^## Backlog\s*$/m) || '';
  const softOnly = softCheckSpecBundle(fixtureA);
  ok(softOnly.ok === false && softOnly.warnings.length > 0, 'soft-no-seed has warnings');
  // softCheckSpecBundle does not set status=fail → no seeds from soft alone
  ok(
    softOnly.rows.every((r) => (r.status || '').toLowerCase() !== 'fail'),
    'soft-no-seed: soft does not mutate row status to fail'
  );
  const softSeeds = seedLinesForFails(softOnly.rows, blBefore);
  ok(softSeeds.length === 0, 'soft-no-seed: soft bundle does not seed via fail status');

  console.log('spec-validate self-test PASS');
}

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

function has(name) {
  return process.argv.includes(name);
}

function runSoftCheckCli() {
  const planFile = arg('--plan-file');
  if (!planFile) {
    console.error('usage: node spec-validate.js soft-check --plan-file <path>');
    process.exit(1);
  }
  let text;
  try {
    text = fs.readFileSync(planFile, 'utf8');
  } catch (e) {
    console.error('soft-check: cannot read plan file:', e.message);
    process.exit(1);
  }
  const opts = {};
  if (has('--habitat-claimed')) {
    const v = (arg('--habitat-claimed') || 'yes').toLowerCase();
    opts.habitatClaimed = v === 'yes' || v === 'true' || v === '1';
  }
  if (arg('--plan-tier')) opts.planTier = arg('--plan-tier');
  if (arg('--seed-mode')) opts.seedMode = arg('--seed-mode');
  const result = softCheckSpecBundle(text, opts);
  process.stdout.write(
    JSON.stringify(
      {
        ok: result.ok,
        meta: result.meta,
        warnings: result.warnings,
      },
      null,
      2
    ) + '\n'
  );
  process.exit(0);
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'self-test') {
    selfTest();
    process.exit(0);
  }
  if (cmd === 'soft-check') {
    runSoftCheckCli();
  }
  console.error('usage: node spec-validate.js self-test | soft-check --plan-file <path>');
  process.exit(1);
}

module.exports = {
  parseSpecValidationRows,
  parseCampaignMeta,
  isExecutableKind,
  headerFlagFromRows,
  seedLinesForFails,
  needsWriteSectionSeed,
  writeSectionSeedTitle,
  softCheckIntentions,
  softCheckSyncStale,
  softCheckProofDiversity,
  softCheckCoverageMix,
  softCheckAntiMirror,
  softCheckHabitatClaim,
  softCheckHabitatCoverage,
  softCheckAssumptionProof,
  softCheckSpecBundle,
  normalizeProof,
  isSuiteOnlyProof,
  ANCHOR_PREFIX_RE,
  KINDS,
  WARNING_CODES,
  DEFAULT_SUITE_PROOF_TOKENS,
};
