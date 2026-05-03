# Plan: Build Tool — Add Parallel Execution Flag

## Context

Our internal build tool (`craftbuild`) currently runs all build targets sequentially.
For projects with many independent targets (e.g., microservices monorepo with 12
services), a full build takes 18 minutes. Most targets are independent and could run
concurrently. Adding a `--parallel` flag would let users opt into concurrent execution,
potentially cutting build times to 4-5 minutes.

## Current State

- `craftbuild` is a Node.js CLI tool in `packages/craftbuild/`
- Entry point: `src/cli.ts` parses args with `yargs`
- Build runner: `src/runner.ts` iterates targets and runs each sequentially
- Target config: `build.config.json` in each project root
- Current flags: `--target`, `--verbose`, `--clean`, `--config`
- No concurrency support anywhere in the codebase

## Approach

Add a `--parallel` flag (short: `-p`) that switches the runner from sequential to
concurrent execution. When enabled, independent targets run simultaneously up to a
configurable concurrency limit (default: CPU count). Dependent targets still respect
ordering via a simple topological sort of the dependency graph.

## Files to Modify

- `src/cli.ts` — add `--parallel` and `--jobs` flag definitions
- `src/runner.ts` — add concurrent execution path
- `src/graph.ts` (new) — dependency graph and topological sort
- `src/pool.ts` (new) — worker pool with concurrency limiting
- `src/types.ts` — add `ParallelOptions` interface
- `test/runner.test.ts` — add parallel execution tests
- `test/graph.test.ts` (new) — dependency graph tests

## Implementation

### Phase 1: Dependency Graph

1. Create `src/graph.ts` with a `DependencyGraph` class
2. Parse `dependsOn` field from each target's `build.config.json`
3. Implement topological sort using Kahn's algorithm
4. Detect circular dependencies and throw a descriptive error
5. Return an array of "levels" — targets within the same level are independent
6. Add `types.ts` updates: `ParallelOptions { enabled: boolean; maxJobs: number }`

### Phase 2: Worker Pool

1. Create `src/pool.ts` with a `WorkerPool` class
2. Accept `maxConcurrency` parameter (default: `os.cpus().length`)
3. Implement `runAll(tasks: Task[])` that executes up to N tasks simultaneously
4. Use `Promise`-based concurrency control (not child processes)
5. Track per-task timing: start, end, duration
6. Emit events: `task:start`, `task:complete`, `task:error`
7. On any task failure: cancel pending tasks and report which failed

### Phase 3: Runner Integration

1. Modify `src/cli.ts` to add the `--parallel` flag:
   ```typescript
   .option('parallel', {
     alias: 'p',
     type: 'boolean',
     default: false,
     describe: 'Run independent targets concurrently'
   })
   .option('jobs', {
     alias: 'j',
     type: 'number',
     default: os.cpus().length,
     describe: 'Max concurrent jobs (with --parallel)'
   })
   ```
2. In `src/runner.ts`, check if `--parallel` is set
3. If parallel: build dependency graph, then for each level, run targets through
   the worker pool
4. If sequential (default): keep existing behavior unchanged
5. Add output buffering in parallel mode — each target's output is collected and
   printed after completion to avoid interleaving
6. Print a summary table at the end showing each target's build time

### Phase 4: Output & Reporting

1. In parallel mode, prefix each output line with the target name: `[api] Compiling...`
2. Add a `--parallel-log-dir` option to write per-target log files
3. On failure, print the failing target's full output immediately
4. Print total wall-clock time vs sum of individual times to show speedup
5. Add `--dry-run` support for parallel mode: show execution order without running

## Verification

1. Unit tests for `DependencyGraph`: linear chain, diamond, circular detection
2. Unit tests for `WorkerPool`: concurrency limit respected, error handling
3. Integration test: build a 4-target project with `--parallel`, verify all complete
4. Integration test: verify dependent targets run after their dependencies
5. Test output buffering: no interleaved lines between targets
6. Test `--jobs 1` with `--parallel` behaves like sequential
7. Performance test: measure wall-clock time with parallel vs sequential on 8 targets
