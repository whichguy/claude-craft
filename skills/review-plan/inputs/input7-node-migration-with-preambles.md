# Plan: PostgreSQL 14 Zero-Downtime Migration — Connection Pool + Schema Update

## Context

The application is currently on PostgreSQL 12 with a connection pool configured for the old
client library. Upgrading to PG 14 requires: (1) updating the connection pool from `pg-pool`
v2 to v3 (which changed the `connect()` return type), (2) migrating the schema to use new JSON
path operators that were buggy in PG12, and (3) adding a rolling migration guard so PG12 replicas
degrade gracefully during the cutover window. This migration must be zero-downtime because the
service handles live webhook ingestion.

**Project:** api-service
**HAS_STATE:** true — migration modifies the live schema
**HAS_DEPLOYMENT:** true — zero-downtime cutover across multiple replicas

## Implementation Steps

### Phase 1: Connection Pool Migration

This phase updates the database client layer to pg-pool v3 before touching any schema objects.
The pool is the foundation — schema migration scripts execute through the same pool, so if the
pool is broken, nothing else works. A clean `npm run test:db` here is the go/no-go gate before
Phase 2 touches the live schema.

**Pre-check:** None (no prior phase dependencies)
**Outputs:** updated `src/db/pool.ts` with v3 API; `package.json` with `pg-pool ^3.6.0`; `npm run test:db` passing

1. Read `package.json` — verify `pg-pool` is currently at `"^2.0.0"` and `pg` at `"^8.11.0"`
2. Read `src/db/pool.ts` — verify current `connect()` call signature returns `{client, done}` (v2 pattern at line ~22), and that `done()` is used for release
3. Update `package.json`: `pg-pool` → `^3.6.0`, `pg` → `^8.13.0`
4. Edit `src/db/pool.ts`:
   - Change `const { client, done } = await pool.connect()` → `const client = await pool.connect()`
   - Change `done()` → `client.release()` at all release sites
5. Edit `src/db/transaction.ts` — same `client.release()` update at every call site
6. Run `npm install && npm run build` — confirm TypeScript compiles clean
7. Test pool: `npm run test:db` — pool connection tests pass
8. Commit: `git add src/db/ package*.json && git commit -m "feat(db): upgrade pg-pool v2→v3"`

### Phase 2: Schema Migration

This phase applies schema changes that depend on PG14-specific JSON path operators introduced
after PG12. We run this after the pool migration because the migration scripts execute through
the same pool. A backward-compatible migration guard (column default set to NULL) ensures PG12
replicas that haven't been restarted yet degrade gracefully rather than crashing during the
rolling restart window.

**Pre-check:** Phase 1 outputs exist; `pg-pool ^3.6.0` present in node_modules; `npm run test:db` passes
**Outputs:** migration files `006_pg14_jsonpath_upgrade.sql`, `007_pg12_compat_guard.sql`; verified schema in test DB

9. Read `migrations/005_jsonpath_indexes.sql` — verify it references `jsonb_path_query` and confirm the migration runner applies files in numeric order
10. Create `migrations/006_pg14_jsonpath_upgrade.sql`:
    - `ALTER TABLE events ADD COLUMN IF NOT EXISTS payload_path TEXT GENERATED ALWAYS AS (jsonb_path_query_first(payload, '$.id')::text) STORED;`
    - `CREATE INDEX CONCURRENTLY idx_events_payload_path ON events (payload_path);`
11. Create `migrations/007_pg12_compat_guard.sql`:
    - Rolling migration guard: set column default to `NULL` so old replicas skip the generated column without error
12. Run migration in test DB: `npm run migrate:test`
13. Verify schema: `psql $TEST_DB_URL -c "\d events"` — confirm `payload_path` column present with correct type
14. Commit: `git add migrations/ && git commit -m "feat(db): PG14 jsonpath schema migration with PG12 compat guard"`

### Phase 3: Integration Testing & Deployment

This phase closes the loop by running end-to-end webhook tests against the migrated test
database, then deploying to staging with a canary cutover before promoting to production. The
canary step lets us detect edge cases in live traffic before committing the full rollout — if
the 10% canary is clean for 15 minutes, full rollout proceeds automatically.

**Pre-check:** Phase 2 outputs exist; migration files 006, 007 applied to test DB; `npm run test:db` passes
**Outputs:** passing integration test suite; production deployment at 100% traffic

15. Run full test suite: `npm test` — all tests pass on migrated schema
16. Deploy to staging: `npm run deploy:staging`
17. Monitor `db.connection_pool.size` and `db.query.duration_p99` for 10 minutes
18. Promote to production canary (10% traffic): `npm run deploy:prod:canary`
19. Monitor production metrics 15 minutes — if `p99 < 50ms` and zero 5xx, full rollout: `npm run deploy:prod:full`
20. Commit: `git add -A && git commit -m "chore: PG14 migration complete — all replicas on pg-pool v3"`

## Execution Schedule

Wave 1: Phase 1 (no dependencies — pool migration is standalone)
Wave 2: Phase 2 (depends on Phase 1 **Outputs**: `pg-pool ^3.6.0` in node_modules)
Wave 3: Phase 3 (depends on Phase 2 **Outputs**: migration files applied to test DB)

All phases are strictly sequential — no parallelism available.

## Git Strategy

- Branch: `feat/pg14-migration`
- Squash merge to main after all phases complete

## Verification

- `npm run test:db` passes after Phase 1
- `psql $TEST_DB_URL -c "\d events"` shows `payload_path` column after Phase 2
- `npm test` passes after Phase 3
- Production `db.query.duration_p99` stays below 50ms during canary window
