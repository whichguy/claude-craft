// Compute expected blocker structure given a chain detection result.
// Mirrors the wiring rules in skills/schedule-plan-tasks/SKILL.md.
//
// Inputs:
//   chains:      [[node, ...], ...]   from detectChains
//   standalones: [node, ...]          from detectChains
//   edges:       [[from, to], ...]    original DEPENDS ON graph
//   regressionBlockers: [node, ...]   explicit list of which tail/standalone nodes are direct
//                                      regression blockers (caller decides whether Reduction applied)
//
// Output:
//   { createWtBlockers, runAgentBlockers, regressionBlockers }
//     - createWtBlockers: { 'chain-1' | 'standalone:X' : ['setup', ...upstreamRunAgents] }
//     - runAgentBlockers: { node : [blockerId] }   (chain head ← create-wt; link/tail ← prev member; standalone ← create-wt)
//     - regressionBlockers: passthrough (echoed as-is for caller validation)
//
// SKILL.md rules:
//   Assert 3: create-wt blocked by Setup .worktrees AND, if any upstream DEPENDS ON exists, by
//             at least one upstream tail/standalone run-agent.
//             Exception: if no upstream DEPENDS ON, only Setup .worktrees is required.
//   Assert 5: regression blocked by ALL chain-tail run-agents and ALL standalone run-agents.
//             Chain-head and chain-link run-agents are NOT direct regression blockers.
//   Assert 7: exactly one create-wt per chain (owned by chain head). Chain-link/tail have no create-wt.

const SETUP = 'setup-worktrees';

function buildBlockers({ chains, standalones, edges, regressionBlockers }) {
  // Build pred map for upstream lookups
  const pred = new Map();
  for (const [from, to] of edges) {
    if (!pred.has(to)) pred.set(to, new Set());
    pred.get(to).add(from);
  }

  // Map every node to its chain's tail/standalone identity (the "merge point" — what blocks downstream create-wts)
  // For chain members: their merge-point identity is the chain tail.
  // For standalones: their merge-point identity is the standalone itself.
  const mergePointOf = new Map();
  for (const chain of chains) {
    const tail = chain[chain.length - 1];
    for (const member of chain) mergePointOf.set(member, tail);
  }
  for (const sa of standalones) mergePointOf.set(sa, sa);

  // For each chain or standalone, find upstream run-agents that gate its create-wt.
  // The chain create-wt forks from main AFTER all upstream tails/standalones merge,
  // so it's blocked by the merge-points of all DEPENDS-ON predecessors of the chain HEAD.
  // For a standalone, same logic applied to the standalone node itself.
  function upstreamMergePoints(node) {
    const preds = pred.get(node);
    if (!preds || preds.size === 0) return [];
    const result = new Set();
    for (const p of preds) {
      const mp = mergePointOf.get(p);
      if (mp && mp !== node) result.add(mp); // exclude self-merge edges (within own chain)
      // If predecessor is in our own chain (mp === node), no external blocker needed
    }
    return [...result];
  }

  const createWtBlockers = {};
  const runAgentBlockers = {};

  // Chain create-wts: blocked by Setup + upstream merge-points of the chain head
  for (const chain of chains) {
    const head = chain[0];
    const tail = chain[chain.length - 1];
    const chainId = `chain:${head}`; // identifier for this chain
    const upstream = upstreamMergePoints(head);
    createWtBlockers[chainId] = [SETUP, ...upstream].sort();

    // Head run-agent blocked by its create-wt
    runAgentBlockers[head] = [chainId];
    // Link/tail blocked by previous member's run-agent
    for (let i = 1; i < chain.length; i++) {
      runAgentBlockers[chain[i]] = [chain[i - 1]];
    }
  }

  // Standalone create-wts: blocked by Setup + upstream merge-points
  for (const sa of standalones) {
    const upstream = upstreamMergePoints(sa);
    const cwtId = `standalone:${sa}`;
    createWtBlockers[cwtId] = [SETUP, ...upstream].sort();
    runAgentBlockers[sa] = [cwtId];
  }

  return {
    createWtBlockers,
    runAgentBlockers,
    regressionBlockers: regressionBlockers ? [...regressionBlockers].sort() : null,
  };
}

// Compute the default regression blocker set: all chain tails + all standalones, no Reduction.
function defaultRegressionBlockers({ chains, standalones }) {
  const tails = chains.map((c) => c[c.length - 1]);
  return [...tails, ...standalones].sort();
}

// Apply Regression Blocker Reduction: remove a node R from the regression blocker list
// if R has a downstream tail/standalone S that subsumes it.
// "Subsumes" is an LLM-judgment call in the live skill; here the caller passes an explicit
// `subsumedBy` mapping to indicate which nodes are subsumed and should be removed.
//
// Example for plan6: subsumedBy = { F: ['G', 'H'] } removes F because both G and H exercise its output.
function applyReduction({ chains, standalones, subsumedBy = {} }) {
  const baseline = defaultRegressionBlockers({ chains, standalones });
  return baseline.filter((n) => !subsumedBy[n]).sort();
}

module.exports = {
  buildBlockers,
  defaultRegressionBlockers,
  applyReduction,
  SETUP,
};
