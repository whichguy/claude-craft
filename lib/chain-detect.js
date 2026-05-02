// Pure JS reference implementation of the schedule-plan-tasks chain detection algorithm.
// Mirrors the algorithm specified in skills/schedule-plan-tasks/SKILL.md "Chain detection".
//
// Input: edges = [[from, to], ...] — directed DEPENDS ON graph (downstream depends on upstream)
//                                     so [A, B] means B depends on A (A's run-agent must complete before B's)
// Output: { chains: [[node, ...], ...], standalones: [node, ...], roles: { node: 'head'|'link'|'tail'|'none' } }
//
// Algorithm (verbatim from SKILL.md):
//   1. Build succ[N] (direct successors) and pred[N] (direct predecessors)
//   2. Identify chain seeds: any unassigned node where |succ[N]| == 1
//   3. From each seed, greedily extend: advance to unique successor while it has |pred|==1; stop when current node has |succ|!=1
//   4. Path with >=2 nodes is a chain; path of length 1 is standalone
//   5. Collect remaining unassigned nodes as standalones (handles fan-out roots, fan-in terminals)
//   6. Assign chain IDs in detection order; assign roles head/link/tail or 'none' for standalones

function detectChains(edges) {
  // Step 1: build succ and pred maps; collect all node identifiers
  const nodes = new Set();
  const succ = new Map();
  const pred = new Map();

  for (const [from, to] of edges) {
    nodes.add(from);
    nodes.add(to);
    if (!succ.has(from)) succ.set(from, new Set());
    if (!pred.has(to)) pred.set(to, new Set());
    succ.get(from).add(to);
    pred.get(to).add(from);
  }

  // Helper: succ count (0 if node has no outgoing edges)
  const succCount = (n) => (succ.get(n) ? succ.get(n).size : 0);
  const predCount = (n) => (pred.get(n) ? pred.get(n).size : 0);
  const succUnique = (n) => {
    const s = succ.get(n);
    return s && s.size === 1 ? [...s][0] : null;
  };

  // Step 2-4: seed at any unassigned node with |succ|==1, extend forward
  const assigned = new Set();
  const chains = [];
  const standalones = [];
  const roles = {};

  // Process nodes in insertion order for determinism
  const ordered = [...nodes];

  for (const seed of ordered) {
    if (assigned.has(seed)) continue;
    if (succCount(seed) !== 1) continue;

    // Extend forward
    const path = [seed];
    assigned.add(seed);

    let current = seed;
    while (true) {
      const next = succUnique(current);
      if (!next) break; // current has 0 or >1 successors
      if (assigned.has(next)) break; // already in another chain
      if (predCount(next) !== 1) break; // fan-in node, not a continuation
      // next has pred==1 and is the unique successor of current; check current.succ==1 (already true since we got here via succUnique)
      path.push(next);
      assigned.add(next);
      current = next;
      if (succCount(current) !== 1) break; // tail reached (fan-out or leaf)
    }

    if (path.length >= 2) {
      chains.push(path);
    } else {
      standalones.push(seed);
    }
  }

  // Step 5: collect any unassigned nodes as standalones (fan-out roots, fan-in terminals)
  for (const n of ordered) {
    if (!assigned.has(n)) {
      standalones.push(n);
      assigned.add(n);
    }
  }

  // Step 6: assign roles
  for (const chain of chains) {
    if (chain.length === 2) {
      roles[chain[0]] = 'head';
      roles[chain[1]] = 'tail';
    } else {
      roles[chain[0]] = 'head';
      for (let i = 1; i < chain.length - 1; i++) roles[chain[i]] = 'link';
      roles[chain[chain.length - 1]] = 'tail';
    }
  }
  for (const n of standalones) roles[n] = 'none';

  return { chains, standalones, roles };
}

// Self-merge field per chain role.
// SKILL.md: yes for tail and standalone (own branch end-to-end); no for head and link (chain continues in same worktree).
function selfMergeForRole(role) {
  if (role === 'tail' || role === 'none') return 'yes';
  if (role === 'head' || role === 'link') return 'no';
  throw new Error(`Unknown chain role: ${role}`);
}

module.exports = { detectChains, selfMergeForRole };
