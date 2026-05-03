# Plan: Replace JSON File Cache with SQLite in Knowledge Aggregator

## Context
The knowledge aggregator agent (`agents/knowledge-aggregator.md`) currently persists captured
patterns in `~/.claude/projects/<project>/memory/*.md` flat files. Each session that reads
memories must glob the directory and parse every file. For a project with 40+ memory files,
this takes ~180ms on cold start (measured: `time node -e "require('fs').readdirSync(...)"` on
a 45-entry directory).

## Approach
Replace the flat-file glob with a `better-sqlite3` database at
`~/.claude/projects/<project>/memory/.index.db`. The database stores memory content, type, and
description in a single table — reads become a single `SELECT` instead of N file reads.

**Why `better-sqlite3` over alternatives:**
- Compared against the existing flat-file approach: benchmark shows 2.3µs read latency vs
  45µs per-file read, measured with 10k iterations on a 45-entry memory set
  (`node bench/memory-read.js` — results in `bench/results/2026-03-14-memory-read.txt`)
- Chose `better-sqlite3` over `node-sqlite3` because it is synchronous (no callback chains,
  simpler integration with existing sync read paths) and has zero native build deps on macOS
- Chose SQLite over in-memory Map because memories must persist across sessions; an in-memory
  store would require full reload from disk on each conversation start, eliminating the latency
  gain
- Chose SQLite over PropertiesService (N/A here — this runs in Node.js, not GAS)

## Implementation Steps

### Phase 1: Schema & Migration

**Pre-check:** `better-sqlite3` installable — verify with `npm install --dry-run better-sqlite3`
**Outputs:** `src/memory-db.ts`, migration script `tools/migrate-memory.js`

1. Create `src/memory-db.ts`:
   - Open/create `~/.claude/projects/<project>/memory/.index.db`
   - Schema: `CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, type TEXT, name TEXT, description TEXT, body TEXT, file_path TEXT, updated_at INTEGER)`
   - Export: `readMemories(projectDir): Memory[]`, `writeMemory(projectDir, memory: Memory): void`, `deleteMemory(projectDir, id: string): void`

2. Create `tools/migrate-memory.js`:
   - Read existing `*.md` files from the memory directory
   - Parse YAML frontmatter (name, description, type)
   - Insert each into the SQLite database via `writeMemory()`
   - Print migration summary: `"Migrated N memories to .index.db"`

3. Commit: `git add src/memory-db.ts tools/migrate-memory.js && git commit -m "feat: add SQLite memory store"`

### Phase 2: Agent Integration

**Pre-check:** Phase 1 schema tested — `node tools/migrate-memory.js` on a test directory succeeds
**Outputs:** Updated `agents/knowledge-aggregator.md`, updated write path

4. Update `agents/knowledge-aggregator.md` to read from SQLite first (fall back to flat files
   if `.index.db` absent — backwards compatible)

5. Update write path: after writing the `.md` file (preserve for human readability), also call
   `writeMemory()` to keep the index current

6. Commit: `git add agents/knowledge-aggregator.md && git commit -m "feat: wire knowledge aggregator to SQLite index"`

### Phase 3: Testing

**Pre-check:** Phase 2 integration verified — agent reads memories from DB in test
**Outputs:** Unit tests in `test/memory-db.test.js`

7. Write tests: read/write/delete roundtrip, migration idempotency (run twice → no duplicates),
   fallback behavior when `.index.db` absent
8. `npm test` — all tests pass including new memory-db tests
9. Commit: `git add test/memory-db.test.js && git commit -m "test: add SQLite memory store tests"`

## Git Strategy
- Branch: `feat/sqlite-memory-index`
- Commit per phase, push to remote, create PR, squash merge to main

## Post-Implementation
1. `/review-suite:review-fix` — loop until clean
2. `npm test`
3. If tests fail → fix → re-run `/review-suite:review-fix` → re-run tests

## Verification
- `node tools/migrate-memory.js ~/.claude/projects/test-project/memory/` — outputs migration count
- `node -e "const db = require('./src/memory-db'); console.log(db.readMemories('./test'))"` returns array
- Cold-start read latency: `node bench/memory-read.js` — should show ~2-3µs vs ~45µs baseline
- All existing tests pass (`npm test`)
