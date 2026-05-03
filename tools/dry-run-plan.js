#!/usr/bin/env node
//
// dry-run-plan.js — CLI runner for schedule-plan-tasks chain detection + wiring analysis.
//
// Runs the same JS reference implementations the behavioral tests use (lib/chain-detect.js,
// lib/wiring-build.js) against any fixture or arbitrary edge list. Prints a Dry-Run Report
// equivalent to what the schedule-plan-tasks skill in --plan-only mode would produce — but
// runs locally with no Skill / Task API / Agent dependencies.
//
// USAGE
//
//   node tools/dry-run-plan.js <fixture>         # run one of plan1..plan7
//   node tools/dry-run-plan.js --all             # run every fixture in sequence
//   node tools/dry-run-plan.js --list            # list known fixtures
//   node tools/dry-run-plan.js --edges "A→B,B→C" # arbitrary graph (also accepts ->)
//
// EXAMPLES
//
//   node tools/dry-run-plan.js plan2
//   node tools/dry-run-plan.js plan6
//   node tools/dry-run-plan.js --edges "A->B,B->C,B->D,C->E,D->E"
//
// EXIT
//
//   0 — analysis complete (output rendered)
//   1 — bad arguments / unknown fixture / parse error

const { detectChains, selfMergeForRole } = require('../lib/chain-detect');
const {
  buildBlockers,
  defaultRegressionBlockers,
  applyReduction,
  SETUP,
} = require('../lib/wiring-build');
const { FIXTURES } = require('../lib/fixtures');

function usage(code = 0) {
  process.stdout.write(
    [
      'dry-run-plan.js — chain detection + wiring analysis',
      '',
      'USAGE',
      '  node tools/dry-run-plan.js <fixture>',
      '  node tools/dry-run-plan.js --all',
      '  node tools/dry-run-plan.js --list',
      '  node tools/dry-run-plan.js --edges "A→B,B→C,..."',
      '',
      'KNOWN FIXTURES',
      ...Object.keys(FIXTURES).map((k) => `  ${k}    ${FIXTURES[k].name}`),
      '',
    ].join('\n'),
  );
  process.exit(code);
}

function parseEdges(spec) {
  // Accept both → and ->; comma-separated.
  return spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((edge) => {
      const m = edge.split(/\s*(?:→|->)\s*/);
      if (m.length !== 2 || !m[0] || !m[1]) {
        process.stderr.write(`bad edge: "${edge}" (expected "from→to" or "from->to")\n`);
        process.exit(1);
      }
      return [m[0], m[1]];
    });
}

function fmtSet(arr) {
  return `[${[...arr].sort().join(', ')}]`;
}

function renderReport(label, edges, regressionBlockers, independentNodes) {
  let chains, standalones, roles;
  if (edges.length === 0 && independentNodes && independentNodes.length > 0) {
    chains = [];
    standalones = [...independentNodes];
    roles = Object.fromEntries(independentNodes.map((n) => [n, 'none']));
  } else {
    const r = detectChains(edges);
    chains = r.chains;
    standalones = r.standalones;
    roles = r.roles;
  }

  const baseline = defaultRegressionBlockers({ chains, standalones });
  const finalRegressionBlockers = regressionBlockers
    ? [...regressionBlockers].sort()
    : baseline;
  const blockers = buildBlockers({
    chains,
    standalones,
    edges,
    regressionBlockers: finalRegressionBlockers,
  });

  const out = [];
  out.push('━'.repeat(78));
  out.push(`  Dry-Run Plan Report — ${label}`);
  out.push('━'.repeat(78));
  out.push('');
  out.push('## Input DEPENDS ON graph');
  if (edges.length === 0) {
    out.push(`(no edges; independent nodes: ${fmtSet(independentNodes || [])})`);
  } else {
    edges.forEach(([f, t]) => out.push(`  ${f} → ${t}`));
  }
  out.push('');

  out.push(`## Chain detection`);
  out.push(`Chains:      ${chains.length}`);
  chains.forEach((c, i) => {
    const annotated = c.map((n) => `${n}(${roles[n]})`).join(' → ');
    out.push(`  chain-${i + 1}:  ${annotated}`);
  });
  out.push(`Standalones: ${standalones.length}  ${fmtSet(standalones)}`);
  out.push('');

  out.push('## Self-merge per task');
  out.push('  (head/link → no  ·  tail/standalone → yes)');
  Object.entries(roles).forEach(([n, role]) => {
    out.push(`  ${n.padEnd(12)} role=${role.padEnd(10)} self-merge: ${selfMergeForRole(role)}`);
  });
  out.push('');

  out.push('## Wiring blockers');
  out.push('  create-wt:');
  Object.entries(blockers.createWtBlockers).forEach(([k, v]) => {
    out.push(`    ${k.padEnd(20)} ← ${fmtSet(v)}`);
  });
  out.push('  delivery-agent:');
  Object.entries(blockers.runAgentBlockers).forEach(([k, v]) => {
    out.push(`    ${k.padEnd(20)} ← ${fmtSet(v)}`);
  });
  out.push('  regression:');
  out.push(`    direct blockers       ← ${fmtSet(finalRegressionBlockers)}`);
  out.push(`    (default w/o Reduction): ${fmtSet(baseline)}`);
  if (regressionBlockers && JSON.stringify(baseline) !== JSON.stringify(finalRegressionBlockers)) {
    const removed = baseline.filter((b) => !finalRegressionBlockers.includes(b));
    if (removed.length > 0) {
      out.push(`    Reduction removed:       ${fmtSet(removed)}  (downstream tail/standalones subsume)`);
    }
  }
  out.push('');

  // Wiring integrity check (matches the smoke-test asserts in the skill)
  const violations = [];
  // Assert 7: one create-wt per chain
  const chainCwts = Object.keys(blockers.createWtBlockers).filter((k) => k.startsWith('chain:'));
  if (chainCwts.length !== chains.length) {
    violations.push(`Assert 7: chain-create-wt count mismatch (got ${chainCwts.length}, expected ${chains.length})`);
  }
  // Assert 3: every create-wt has SETUP blocker
  Object.entries(blockers.createWtBlockers).forEach(([k, v]) => {
    if (!v.includes(SETUP)) violations.push(`Assert 3: ${k} missing ${SETUP}`);
  });
  // Assert 5: regression blockers ∈ tails ∪ standalones
  const tails = chains.map((c) => c[c.length - 1]);
  const heads = chains.map((c) => c[0]);
  const links = chains.flatMap((c) => c.slice(1, -1));
  const allowed = new Set([...tails, ...standalones]);
  finalRegressionBlockers.forEach((b) => {
    if (!allowed.has(b)) violations.push(`Assert 5: regression blocker '${b}' is not a tail/standalone`);
    if (heads.includes(b)) violations.push(`Assert 5: regression blocker '${b}' is a chain head`);
    if (links.includes(b)) violations.push(`Assert 5: regression blocker '${b}' is a chain link`);
  });

  out.push('## Wiring integrity');
  if (violations.length === 0) {
    out.push('  PASS — all asserts satisfied');
  } else {
    out.push('  FAIL — violations:');
    violations.forEach((v) => out.push(`    ✗ ${v}`));
  }
  out.push('');

  process.stdout.write(out.join('\n'));
  return violations.length === 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') usage(0);

  if (args[0] === '--list') {
    Object.entries(FIXTURES).forEach(([k, v]) => process.stdout.write(`${k}\t${v.name}\n`));
    process.exit(0);
  }

  if (args[0] === '--edges') {
    if (!args[1]) {
      process.stderr.write('--edges requires an argument\n');
      process.exit(1);
    }
    const edges = parseEdges(args[1]);
    const ok = renderReport('arbitrary edges', edges, null, null);
    process.exit(ok ? 0 : 1);
  }

  const targets = args[0] === '--all' ? Object.keys(FIXTURES) : [args[0]];

  let allOk = true;
  for (const name of targets) {
    if (!FIXTURES[name]) {
      process.stderr.write(`unknown fixture: ${name}\n`);
      process.stderr.write(`known: ${Object.keys(FIXTURES).join(', ')}\n`);
      process.exit(1);
    }
    const fx = FIXTURES[name];
    const ok = renderReport(
      `${name}: ${fx.name}`,
      fx.edges,
      fx.regression && fx.regression.blockers,
      fx.independentNodes,
    );
    if (!ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

main();
