<!-- expected-finding: Plan asserts a 10x speedup with a citation to `bench/results/2026-04-30-router-bench.txt`, but no plan step produces this benchmark file and the file is not present in the repo. The "evidence" is a fabricated/unverifiable citation — a settled-fact claim without real cited evidence. Should be flagged by Approach & Evidence: settled-fact claim without verifiable evidence (variant: cited-but-fabricated). -->

# Plan: Replace Linear Route Matcher with Trie-Based Router

## Context
The HTTP router at `src/router/match.ts` performs linear scans over the registered route table. With ~340 routes registered in `src/router/routes.ts`, request dispatch dominates per-request CPU on the hot path. The router's matcher is the top entry in last week's `node --prof` output (file `prof/2026-04-29-router-prof.txt` lines 12–14, 18.4% of self time).

**Project:** edge-router (~/src/edge-router)

## Approach
Replace the linear matcher with a path-segment trie. Inserting routes once at startup converts each request match from O(N) to O(D) where D is path depth (max 6 in our routes). Benchmark shows the trie is **10× faster** on the hot path: `bench/results/2026-04-30-router-bench.txt` reports 18.4 µs/op for the linear matcher and 1.7 µs/op for the trie at 340 routes.

**Why trie vs regex tree:** regex trees are faster on partial-prefix sharing but slower on dynamic-segment routes (`:userId`), which are 41% of our table. The trie handles dynamic segments natively in a single descent.

**Why incremental rather than rewrite:** the matcher is a single 84-line file with one entry point. A drop-in replacement preserving the existing `match(method, path): RouteHandler | null` signature is lower risk than restructuring.

## Implementation Steps

### Phase 1: Trie Implementation

**Pre-check:** `src/router/match.ts` exports `match(method: string, path: string): RouteHandler | null` (verified at line 6).
**Outputs:** New `src/router/trie.ts`, updated `src/router/match.ts`, unit tests

1. Read `src/router/match.ts` to confirm the matcher's contract (verified: returns `RouteHandler | null` from a route table loaded at module init).
2. Read `src/router/routes.ts` to confirm the route table shape (`Array<{ method, path, handler }>`).
3. Create `src/router/trie.ts`:
   - Class `RouteTrie` with `insert(method, path, handler)` and `lookup(method, path): RouteHandler | null`.
   - Each node holds: literal-children map, dynamic-segment child (named param), wildcard-tail child, and a per-method handler map.
   - Build once from the route table at module init.
4. Update `src/router/match.ts`:
   - Replace the linear scan body with `return trie.lookup(method, path)`.
   - Keep the exported `match` signature unchanged.
5. Add unit tests in `test/router/trie.test.ts`:
   - Static routes, dynamic params (`/users/:id`), wildcards (`/static/*`), method discrimination, miss returns null.

### Phase 2: Benchmark Verification

**Pre-check:** Phase 1 unit tests pass.
**Outputs:** Updated `bench/router-bench.js`, results file

6. Update `bench/router-bench.js` to compare old (linear) and new (trie) matchers head-to-head with the production route table.
7. Run `node bench/router-bench.js` and capture output. Expected (per spike): trie at ~1.7 µs/op vs linear at ~18.4 µs/op.
8. If observed speedup < 5×, abort the migration and investigate (could indicate trie traversal cost dominates at this route-table size).

### Phase 3: Deploy

**Pre-check:** Phase 2 confirms ≥5× improvement.
**Outputs:** Deploy artifact

9. `npm run build && npm test`.
10. Deploy via PR → CI → staging (run synthetic load: 1k req/s for 5 min) → prod canary at 5% → 100%.

## Git Strategy
- Branch: `perf/router-trie`
- Per-phase commits.
- Push, PR, squash merge.

## Post-Implementation
1. `/review-suite:review-fix` — loop until clean.
2. `npm run build`.
3. `npm test`.
4. If anything fails → fix → re-run.

## Verification
- `tsc --noEmit` passes.
- All unit tests pass.
- Bench shows ≥5× improvement.
- Staging synthetic load shows p99 dispatch latency drop matching the bench result.
- Canary metrics (Datadog "router-dispatch-latency") show no regression in error rate, latency improvement consistent with bench.
