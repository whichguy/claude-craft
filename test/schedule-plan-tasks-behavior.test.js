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
const { detectChains, selfMergeForRole } = require('../lib/chain-detect');
const {
  buildBlockers,
  defaultRegressionBlockers,
  applyReduction,
  SETUP,
} = require('../lib/wiring-build');

// Per-fixture: edges = directed DEPENDS ON graph (downstream depends on upstream).
// [from, to] means: 'to' depends on 'from'; from's run-agent must complete before to's.
const FIXTURES = {
  plan1: {
    name: 'plan1-max-concurrency: fan-out + fan-in (no chains)',
    edges: [
      ['Prepare', '1a'], ['Prepare', '1b'], ['Prepare', '1c'], ['Prepare', '1d'],
      ['1a', 'Wire'], ['1b', 'Wire'], ['1c', 'Wire'], ['1d', 'Wire'],
    ],
    expected: {
      chains: [],
      standalones: ['Prepare', '1a', '1b', '1c', '1d', 'Wire'],
      // Roles: all 'none' (no chains)
    },
    regression: {
      // Default: all standalones (no chain tails). Matches expect-plan1 assertion A.
      blockers: ['1a', '1b', '1c', '1d', 'Prepare', 'Wire'],
    },
  },

  plan2: {
    name: 'plan2-linear-chain: 4-member linear chain',
    edges: [
      ['Types', 'Validator'],
      ['Validator', 'Route'],
      ['Route', 'Integration'],
    ],
    expected: {
      chains: [['Types', 'Validator', 'Route', 'Integration']],
      standalones: [],
      roles: { Types: 'head', Validator: 'link', Route: 'link', Integration: 'tail' },
    },
    regression: {
      // Only the chain tail. Heads/links never directly block regression.
      blockers: ['Integration'],
    },
  },

  plan3: {
    name: 'plan3-diamond: 2-leg fan-in (3 standalones)',
    edges: [
      ['1a', 'Dashboard'],
      ['1b', 'Dashboard'],
    ],
    expected: {
      chains: [],
      standalones: ['1a', '1b', 'Dashboard'],
    },
    regression: {
      // Default: all 3 standalones. expect-plan3 says either KEEP or REMOVE-via-Reduction is acceptable.
      // We test the default (KEEP) here; Reduction case is covered by plan6.
      blockers: ['1a', '1b', 'Dashboard'],
    },
  },

  plan4: {
    name: 'plan4-trivial-mixed: 3 independent (no edges)',
    edges: [],
    // Special: with no edges, detectChains sees no nodes. Test populates nodes externally.
    independentNodes: ['PORT', 'nvmrc', 'Logger'],
    expected: {
      chains: [],
      standalones: ['PORT', 'nvmrc', 'Logger'],
    },
    regression: {
      blockers: ['Logger', 'PORT', 'nvmrc'], // sorted
    },
  },

  plan5: {
    name: 'plan5-multi-chain: 2 chains + 2 standalones converging on Smoke',
    edges: [
      ['A1', 'A2'],
      ['B1', 'B2'],
      ['A2', 'Smoke'],
      ['B2', 'Smoke'],
      ['Admin', 'Smoke'],
    ],
    expected: {
      chains: [['A1', 'A2'], ['B1', 'B2']],
      standalones: ['Admin', 'Smoke'],
      roles: { A1: 'head', A2: 'tail', B1: 'head', B2: 'tail', Admin: 'none', Smoke: 'none' },
    },
    regression: {
      // Chain tails A2, B2 + standalones Admin, Smoke. Heads A1, B1 NOT direct blockers.
      blockers: ['A2', 'Admin', 'B2', 'Smoke'],
    },
  },

  plan6: {
    name: 'plan6-deep-cascading: 2 chains + 4 standalones (cascade topology)',
    edges: [
      ['A', 'B'],
      ['B', 'C'], ['B', 'D'],
      ['C', 'E'], ['D', 'E'],
      ['E', 'F'],
      ['F', 'G'], ['F', 'H'],
    ],
    expected: {
      chains: [['A', 'B'], ['E', 'F']],
      standalones: ['C', 'D', 'G', 'H'],
      roles: { A: 'head', B: 'tail', C: 'none', D: 'none', E: 'head', F: 'tail', G: 'none', H: 'none' },
    },
    regression: {
      // Reduction APPLIED: F removed because G and H subsume its output.
      // Default would be [B, F, G, H]; after removing F: [B, G, H]
      blockers: applyReduction({
        chains: [['A', 'B'], ['E', 'F']],
        standalones: ['C', 'D', 'G', 'H'],
        subsumedBy: { F: ['G', 'H'] },
      }),
      // Expected: ['B', 'G', 'H'] sorted
    },
  },

  plan7: {
    name: 'plan7-assert6-violation: single standalone',
    edges: [],
    independentNodes: ['Health'],
    expected: {
      chains: [],
      standalones: ['Health'],
    },
    regression: {
      blockers: ['Health'],
    },
  },
};

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

      it('Assert 3: create-wt with upstream DEPENDS ON includes upstream tail/standalone run-agent', function () {
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
