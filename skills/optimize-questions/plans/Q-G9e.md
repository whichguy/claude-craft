# Plan: Database Migration Pipeline for Multi-Tenant System

## Context

We are migrating our single-tenant database schema to a multi-tenant model. Every table
needs a `tenant_id` column, row-level security (RLS) policies, and tenant-scoped indexes.
This is a high-risk migration affecting 14 tables with production data. We need a
carefully staged pipeline with rollback capability at each stage.

## Current State

- PostgreSQL 15 on RDS, 14 application tables, ~5M total rows
- No `tenant_id` column on any table — all data is effectively single-tenant
- Application uses Prisma ORM with 14 models
- Existing RLS: none
- Current deployment: zero-downtime deploys via rolling update
- All current data belongs to the "default" tenant (ID: `tenant_default`)

## Approach

The migration will proceed in 4 stages. Stage 1 adds the tenant_id column as nullable with a default value to all 14 tables — this is backward-compatible and can be deployed without downtime. Stage 2 backfills existing rows with the default tenant ID using batched UPDATE statements to avoid locking the entire table. We'll process 1000 rows at a time with a 100ms delay between batches to keep database load manageable. After backfill completes, we verify row counts match expectations: for each table, the count of rows WHERE tenant_id IS NULL should be zero, and the count WHERE tenant_id = 'tenant_default' should equal the original total count. These counts must be verified before proceeding because Stage 3 makes the column NOT NULL, which would fail if any NULLs remain. Stage 3 alters the column to NOT NULL, adds composite indexes on (tenant_id, id) for each table, and creates the RLS policies. This stage requires a brief maintenance window (~2 minutes for the ALTER TABLE commands). We should commit after Stage 3 completes and verify the application still works with the default tenant before proceeding. Stage 4 updates the Prisma schema and application code to include tenant_id in all queries. This is where we update the Prisma models, regenerate the client, and modify the middleware to inject tenant context. Each stage should be independently deployable, and we need to verify the application functions correctly after each stage before moving to the next. If Stage 3 fails, we can roll back by dropping the NOT NULL constraint and the RLS policies. If Stage 2 fails midway, we can re-run it safely because the UPDATE is idempotent (setting tenant_id on rows that already have it is a no-op). Stage 1 rollback is simply dropping the column. The critical invariant is that at no point should the application break for existing users.

## Files to Modify

- `prisma/migrations/001_add_tenant_column.sql` (new) — Stage 1 migration
- `scripts/backfill-tenant.ts` (new) — Stage 2 backfill script
- `prisma/migrations/002_tenant_not_null_rls.sql` (new) — Stage 3 migration
- `prisma/schema.prisma` — Stage 4: add tenant_id to all models
- `src/middleware/tenantContext.ts` (new) — extract tenant from auth token
- `src/services/*.ts` — update all service queries to include tenant filter
- `src/types/tenant.ts` (new) — tenant types

## Implementation

### Stage 1: Add Nullable Column (zero-downtime)

1. Create migration `001_add_tenant_column.sql` that adds `tenant_id VARCHAR(50) DEFAULT NULL` to all 14 tables. Use a single migration file with 14 ALTER TABLE statements. Add a basic index on tenant_id for each table to support future queries.

2. Apply migration: `npx prisma migrate deploy`. Verify all 14 tables have the new column. Application continues to work because the column is nullable and existing code doesn't reference it.

### Stage 2: Backfill Existing Data

1. Create `backfill-tenant.ts` script that iterates over all 14 tables. For each table, run batched UPDATEs: `UPDATE {table} SET tenant_id = 'tenant_default' WHERE tenant_id IS NULL LIMIT 1000`. Log progress: "Table {name}: {processed}/{total} rows backfilled". After completing each table, run a verification query to count remaining NULLs and log the result. The script should be idempotent and resumable — running it twice has no side effects.

2. Run backfill: `npx ts-node scripts/backfill-tenant.ts`. Monitor database CPU/connections during execution. Expected duration: ~10 minutes for 5M rows at 1000/batch with 100ms delay.

3. Verify: For each table, `SELECT COUNT(*) WHERE tenant_id IS NULL` should return 0, and `SELECT COUNT(*) WHERE tenant_id = 'tenant_default'` should match total row count. Commit after verification passes.

### Stage 3: Enforce Constraints & RLS (maintenance window)

1. Create migration `002_tenant_not_null_rls.sql` with ALTER TABLE statements setting `tenant_id` to NOT NULL, creating composite indexes `(tenant_id, id)` on each table, and adding RLS policies: `CREATE POLICY tenant_isolation ON {table} USING (tenant_id = current_setting('app.current_tenant'))`.

2. Schedule 5-minute maintenance window. Apply migration. Verify all constraints are in place. Run smoke tests against the API to confirm existing queries still work with the default tenant. If anything fails, roll back by running the reverse migration that drops NOT NULL constraints and RLS policies. Commit after successful verification.

### Stage 4: Application Code Updates

1. Create `tenantContext.ts` middleware that extracts `tenant_id` from the JWT auth token and sets it on `req.tenantId` and as a PostgreSQL session variable via `SET app.current_tenant = '{tenantId}'`.

2. Update Prisma schema: add `tenantId String @map("tenant_id")` to all 14 models.

3. Regenerate Prisma client: `npx prisma generate`.

4. Update all service files to include `where: { tenantId: req.tenantId }` in queries.

5. Add tenant validation middleware that rejects requests without a valid tenant context.

## Verification

1. After Stage 1: all 14 tables have nullable tenant_id column, app works normally
2. After Stage 2: zero NULL tenant_id rows across all tables
3. After Stage 3: NOT NULL constraint enforced, RLS policies active, app works with default tenant
4. After Stage 4: queries are tenant-scoped, cross-tenant data access blocked
5. End-to-end: create data as tenant A, verify tenant B cannot see it
6. Performance: query execution plans show composite index usage
7. Rollback test: practice Stage 3 rollback on staging before production
