// Per-fixture test data: directed DEPENDS ON graph + expected topology + regression blockers.
// Shared by behavioral tests (test/schedule-plan-tasks-behavior.test.js) and the CLI tool
// (tools/dry-run-plan.js).
//
// edges: [[from, to], ...] — [from, to] means: 'to' depends on 'from'; from's run-agent must
//                              complete before to's.
// independentNodes: optional list of nodes for fixtures with no edges (detectChains can't
//                   discover them from an empty edge list).

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
    },
    regression: { blockers: ['1a', '1b', '1c', '1d', 'Prepare', 'Wire'] },
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
    regression: { blockers: ['Integration'] },
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
    regression: { blockers: ['1a', '1b', 'Dashboard'] },
  },

  plan4: {
    name: 'plan4-trivial-mixed: 3 independent (no edges)',
    edges: [],
    independentNodes: ['PORT', 'nvmrc', 'Logger'],
    expected: {
      chains: [],
      standalones: ['PORT', 'nvmrc', 'Logger'],
    },
    regression: { blockers: ['Logger', 'PORT', 'nvmrc'] },
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
    regression: { blockers: ['A2', 'Admin', 'B2', 'Smoke'] },
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
      // Reduction APPLIED: F removed because G and H subsume its output. baseline = [B,C,D,F,G,H].
      blockers: ['B', 'C', 'D', 'G', 'H'],
      reductionApplied: { F: ['G', 'H'] },
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
    regression: { blockers: ['Health'] },
  },
};

module.exports = { FIXTURES };
