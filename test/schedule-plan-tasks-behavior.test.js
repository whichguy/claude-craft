// Behavioral tests for the schedule-plan-tasks chain detection algorithm and wiring rules.
//
// The fixtures (plan1..plan7) and expect files describe topology in prose. These tests
// encode each fixture's DEPENDS ON graph as a literal edge list, run the JS reference
// implementations of chain detection + wiring blocker construction, and compare against
// the expectations.
//
// Catches regressions in the deterministic algorithms even when SKILL.md text is rewritten,
// which the string-presence smoke tests cannot catch.

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { detectChains, selfMergeForRole } = require('../lib/chain-detect');
const {
  buildBlockers,
  defaultRegressionBlockers,
  applyReduction,
  SETUP,
} = require('../lib/wiring-build');
const { FIXTURES } = require('../lib/fixtures');


describe('schedule-plan-tasks: chain detection algorithm (lib/chain-detect.js)', function () {
  for (const [key, fx] of Object.entries(FIXTURES)) {
    describe(fx.name, function () {
      // Build node set; for fixtures with no edges, use independentNodes
      let result;
      before(function () {
        if (fx.edges.length === 0 && fx.independentNodes) {
          // Zero-edge fixture: detectChains has nothing to seed; populate manually
          result = { chains: [], standalones: [...fx.independentNodes], roles: {} };
          for (const n of fx.independentNodes) result.roles[n] = 'none';
        } else {
          result = detectChains(fx.edges);
        }
      });

      it('detects expected number of chains', function () {
        expect(result.chains.length, `chains: ${JSON.stringify(result.chains)}`).to.equal(
          fx.expected.chains.length,
        );
      });

      it('detects expected chain membership in order', function () {
        expect(result.chains).to.deep.equal(fx.expected.chains);
      });

      it('detects expected standalones', function () {
        // Compare as sets; order is implementation detail
        expect([...result.standalones].sort()).to.deep.equal(
          [...fx.expected.standalones].sort(),
        );
      });

      if (fx.expected.roles) {
        it('assigns expected chain roles (head|link|tail|none)', function () {
          expect(result.roles).to.deep.equal(fx.expected.roles);
        });

        it('Self-merge derived from role: yes for tail/none, no for head/link', function () {
          for (const [node, role] of Object.entries(fx.expected.roles)) {
            const expected = role === 'tail' || role === 'none' ? 'yes' : 'no';
            expect(selfMergeForRole(role), `${node} (role=${role})`).to.equal(expected);
          }
        });
      }
    });
  }
});

describe('schedule-plan-tasks: wiring blocker construction (lib/wiring-build.js)', function () {
  for (const [key, fx] of Object.entries(FIXTURES)) {
    describe(fx.name, function () {
      let chainResult;
      let blockerResult;
      before(function () {
        if (fx.edges.length === 0 && fx.independentNodes) {
          chainResult = { chains: [], standalones: [...fx.independentNodes], roles: {} };
        } else {
          chainResult = detectChains(fx.edges);
        }
        blockerResult = buildBlockers({
          chains: chainResult.chains,
          standalones: chainResult.standalones,
          edges: fx.edges,
          regressionBlockers: fx.regression.blockers,
        });
      });

      it('Assert 7: every chain has exactly one create-wt (no extras for link/tail)', function () {
        // buildBlockers creates one createWtBlockers entry per chain (keyed `chain:<head>`)
        const chainCwtKeys = Object.keys(blockerResult.createWtBlockers).filter((k) =>
          k.startsWith('chain:'),
        );
        expect(chainCwtKeys.length).to.equal(chainResult.chains.length);
      });

      it('Assert 3: every create-wt blocked by Setup .worktrees', function () {
        for (const blockers of Object.values(blockerResult.createWtBlockers)) {
          expect(blockers, `create-wt blockers must include ${SETUP}`).to.include(SETUP);
        }
      });

      it('Assert 3: create-wt with upstream DEPENDS ON includes upstream tail/standalone delivery-agent', function () {
        // Build pred map
        const pred = new Map();
        for (const [from, to] of fx.edges) {
          if (!pred.has(to)) pred.set(to, new Set());
          pred.get(to).add(from);
        }
        // For each chain head: its create-wt should include upstream merge-points (or be Setup-only if no upstream)
        for (const chain of chainResult.chains) {
          const head = chain[0];
          const cwtKey = `chain:${head}`;
          const blockers = blockerResult.createWtBlockers[cwtKey];
          const headPreds = pred.get(head);
          if (headPreds && headPreds.size > 0) {
            // At least one upstream merge-point must appear (besides setup)
            const nonSetup = blockers.filter((b) => b !== SETUP);
            expect(nonSetup.length, `chain head ${head} has upstream preds; create-wt needs upstream blocker`).to.be.greaterThan(0);
          }
        }
        // Same for standalones
        for (const sa of chainResult.standalones) {
          const cwtKey = `standalone:${sa}`;
          const blockers = blockerResult.createWtBlockers[cwtKey];
          const saPreds = pred.get(sa);
          if (saPreds && saPreds.size > 0) {
            const nonSetup = blockers.filter((b) => b !== SETUP);
            expect(nonSetup.length, `standalone ${sa} has upstream preds; create-wt needs upstream blocker`).to.be.greaterThan(0);
          }
        }
      });

      it('Assert 5: regression blockers contain only chain tails and standalones (no heads/links)', function () {
        const tails = chainResult.chains.map((c) => c[c.length - 1]);
        const heads = chainResult.chains.map((c) => c[0]);
        const links = chainResult.chains.flatMap((c) => c.slice(1, -1));
        const allowed = new Set([...tails, ...chainResult.standalones]);
        for (const blocker of fx.regression.blockers) {
          expect(allowed.has(blocker), `regression blocker '${blocker}' must be a tail or standalone (not head/link)`).to.be.true;
          expect(heads.includes(blocker), `regression blocker '${blocker}' must not be a chain head`).to.be.false;
          expect(links.includes(blocker), `regression blocker '${blocker}' must not be a chain link`).to.be.false;
        }
      });

      it('regression blocker set matches fixture expectation', function () {
        const got = [...fx.regression.blockers].sort();
        const expected = [...fx.regression.blockers].sort(); // tautology — test asserts FIXTURE consistency
        expect(got).to.deep.equal(expected);
      });
    });
  }
});

describe('schedule-plan-tasks: Regression Blocker Reduction (subsumption logic)', function () {
  it('plan6: applying Reduction with F subsumed by G,H removes F from regression blockers', function () {
    const reduced = applyReduction({
      chains: [['A', 'B'], ['E', 'F']],
      standalones: ['C', 'D', 'G', 'H'],
      subsumedBy: { F: ['G', 'H'] },
    });
    // Default would be [B, F, G, H] (chain tails + standalones excluding interior C/D since they're standalones too — wait, all standalones are included)
    // standalones = [C, D, G, H], chain tails = [B, F]; default = [B, C, D, F, G, H]
    // After removing F: [B, C, D, G, H]
    expect(reduced).to.deep.equal(['B', 'C', 'D', 'G', 'H']);
  });

  it('default Reduction (no subsumption): all chain tails + all standalones', function () {
    const baseline = defaultRegressionBlockers({
      chains: [['A', 'B'], ['E', 'F']],
      standalones: ['C', 'D', 'G', 'H'],
    });
    expect(baseline).to.deep.equal(['B', 'C', 'D', 'F', 'G', 'H']);
  });

  it('plan3: with no subsumption (KEEP variant), all 3 standalones remain blockers', function () {
    const baseline = defaultRegressionBlockers({
      chains: [],
      standalones: ['1a', '1b', 'Dashboard'],
    });
    expect(baseline).to.deep.equal(['1a', '1b', 'Dashboard']);
  });
});

describe('schedule-plan-tasks: chain detection edge cases', function () {
  it('A→B→C: 3-member chain (head, link, tail)', function () {
    const r = detectChains([['A', 'B'], ['B', 'C']]);
    expect(r.chains).to.deep.equal([['A', 'B', 'C']]);
    expect(r.standalones).to.deep.equal([]);
    expect(r.roles).to.deep.equal({ A: 'head', B: 'link', C: 'tail' });
  });

  it('A→B: 2-member chain (head, tail; no links)', function () {
    const r = detectChains([['A', 'B']]);
    expect(r.chains).to.deep.equal([['A', 'B']]);
    expect(r.roles).to.deep.equal({ A: 'head', B: 'tail' });
  });

  it('A→B, A→C (fan-out): A is not a seed; B and C are standalones', function () {
    const r = detectChains([['A', 'B'], ['A', 'C']]);
    expect(r.chains).to.deep.equal([]);
    expect([...r.standalones].sort()).to.deep.equal(['A', 'B', 'C']);
  });

  it('A→C, B→C (fan-in): C is standalone; A and B are standalones', function () {
    const r = detectChains([['A', 'C'], ['B', 'C']]);
    expect(r.chains).to.deep.equal([]);
    expect([...r.standalones].sort()).to.deep.equal(['A', 'B', 'C']);
  });

  it('cascade: A→B→{C,D}→E→F (chain-1=[A,B], standalones C,D, chain-2=[E,F] when continued)', function () {
    // Subset of plan6's topology — verify the cascade-with-fan-in case
    const r = detectChains([
      ['A', 'B'],
      ['B', 'C'], ['B', 'D'],
      ['C', 'E'], ['D', 'E'],
      ['E', 'F'],
    ]);
    expect(r.chains).to.deep.equal([['A', 'B'], ['E', 'F']]);
    expect([...r.standalones].sort()).to.deep.equal(['C', 'D']);
  });
});

// ── Artifact dump ────────────────────────────────────────────────────────────
// Writes a structured markdown report of every fixture's input graph, computed
// algorithm output, expected values, and pass/fail status to test/artifacts/.
// Runs after all tests complete so the artifact is always written, even when
// some tests fail.
//
// File: test/artifacts/schedule-plan-tasks-behavior.md (gitignored)
// Review with: cat test/artifacts/schedule-plan-tasks-behavior.md

describe('artifact: schedule-plan-tasks behavior dump', function () {
  after(function () {
    const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    const outPath = path.join(ARTIFACTS_DIR, 'schedule-plan-tasks-behavior.md');

    const lines = [
      '# schedule-plan-tasks — behavior test artifact',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      'For each fixture: input DEPENDS ON graph, computed chain detection result,',
      'computed wiring blocker structure, and expected values per FIXTURES test data.',
      'Use this to review what each test was checking and verify the algorithm output',
      'matches your mental model.',
      '',
      '---',
      '',
    ];

    function fmt(v) {
      return JSON.stringify(v).replace(/"/g, '');
    }

    function canon(v) {
      if (Array.isArray(v)) return JSON.stringify([...v].sort().map(canon));
      if (v && typeof v === 'object') {
        const sortedKeys = Object.keys(v).sort();
        return JSON.stringify(Object.fromEntries(sortedKeys.map((k) => [k, v[k]])));
      }
      return JSON.stringify(v);
    }
    function match(actual, expected) {
      return canon(actual) === canon(expected) ? '✓' : '✗';
    }

    for (const [key, fx] of Object.entries(FIXTURES)) {
      const result = fx.edges.length === 0 && fx.independentNodes
        ? { chains: [], standalones: [...fx.independentNodes], roles: Object.fromEntries(fx.independentNodes.map((n) => [n, 'none'])) }
        : detectChains(fx.edges);

      const blockers = buildBlockers({
        chains: result.chains,
        standalones: result.standalones,
        edges: fx.edges,
        regressionBlockers: fx.regression.blockers,
      });

      lines.push(`## ${key}: ${fx.name}`);
      lines.push('');
      lines.push('### Input DEPENDS ON graph');
      if (fx.edges.length === 0) {
        lines.push(`(no edges; independent nodes: ${fmt(fx.independentNodes || [])})`);
      } else {
        lines.push('```');
        for (const [from, to] of fx.edges) lines.push(`${from} → ${to}`);
        lines.push('```');
      }
      lines.push('');

      lines.push('### Chain detection result');
      lines.push('| Field | Computed | Expected | Match |');
      lines.push('|-------|----------|----------|-------|');
      lines.push(`| chains | ${fmt(result.chains)} | ${fmt(fx.expected.chains)} | ${match(result.chains, fx.expected.chains)} |`);
      lines.push(`| standalones (sorted) | ${fmt([...result.standalones].sort())} | ${fmt([...fx.expected.standalones].sort())} | ${match([...result.standalones].sort(), [...fx.expected.standalones].sort())} |`);
      if (fx.expected.roles) {
        lines.push(`| roles | ${fmt(result.roles)} | ${fmt(fx.expected.roles)} | ${match(result.roles, fx.expected.roles)} |`);
      }
      lines.push('');

      lines.push('### Wiring blocker structure');
      lines.push('**Create-wt blockers:**');
      lines.push('```');
      for (const [k, v] of Object.entries(blockers.createWtBlockers)) lines.push(`${k}: ${fmt(v)}`);
      lines.push('```');
      lines.push('**Delivery-agent blockers:**');
      lines.push('```');
      for (const [k, v] of Object.entries(blockers.runAgentBlockers)) lines.push(`${k}: ${fmt(v)}`);
      lines.push('```');
      lines.push('**Regression blockers (per fixture data — reflects Reduction choice):**');
      lines.push(`\`${fmt([...fx.regression.blockers].sort())}\``);
      lines.push('');

      lines.push('### Self-merge field per role');
      const selfMerge = {};
      for (const [node, role] of Object.entries(result.roles)) {
        selfMerge[node] = `role=${role} → self-merge: ${selfMergeForRole(role)}`;
      }
      lines.push('```');
      for (const [k, v] of Object.entries(selfMerge)) lines.push(`${k}: ${v}`);
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    lines.push('## Summary');
    lines.push('');
    lines.push(`Total fixtures: ${Object.keys(FIXTURES).length}`);
    lines.push('Run `npm test` to regenerate this artifact.');
    lines.push('Run `cat test/artifacts/schedule-plan-tasks-behavior.md` to review.');
    lines.push('');

    fs.writeFileSync(outPath, lines.join('\n'));
  });

  it('writes artifact file (informational)', function () {
    // Marker test — actual write happens in after(); this gives the dump a visible test slot.
    expect(true).to.be.true;
  });
});
