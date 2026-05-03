# Plan: Database Schema Migration — Users to Multi-Tenant

## Context

Our SaaS application needs to support multi-tenancy. Currently all users share a single
database schema. We need to add tenant isolation at the database level — each tenant's
data must be segregated via a `tenant_id` foreign key on all major tables. This is a
large migration touching 8 tables and requiring data backfill.

## Current State

- PostgreSQL 15, Node.js 20, TypeScript 5.3, Knex.js for migrations
- 8 core tables: `users`, `orders`, `products`, `inventory`, `invoices`,
  `payments`, `shipping`, `audit_log`
- 2.1M total rows across all tables
- No `tenant_id` column on any table
- Single-tenant: all data implicitly belongs to one organization
- Production database with 99.9% uptime SLA

## Approach

Execute the migration in four sequential phases: schema changes, data backfill,
application code updates, and cleanup. Each phase builds on the previous one.

## Files to Modify

- `migrations/20240401_add_tenant_id.ts` (new) — add tenant_id columns
- `migrations/20240402_backfill_tenant.ts` (new) — backfill existing data
- `migrations/20240403_add_constraints.ts` (new) — add NOT NULL + foreign keys
- `migrations/20240404_add_indexes.ts` (new) — add tenant-based indexes
- `src/middleware/tenantContext.ts` (new) — extract tenant from request
- `src/repositories/baseRepository.ts` — add tenant filtering to all queries
- `src/types/tenant.ts` (new) — tenant-related types
- `src/services/tenantService.ts` (new) — tenant CRUD operations

## Implementation

### Phase 1: Schema Changes

1. Create migration `20240401_add_tenant_id.ts`:
   - Add `tenant_id UUID` column to all 8 tables (nullable initially)
   - Create `tenants` table: `id`, `name`, `slug`, `plan`, `created_at`
   - Add foreign key from `tenant_id` → `tenants.id` on all tables

2. Create default tenant record for existing data:
   - Insert tenant: `{ name: 'Default', slug: 'default', plan: 'enterprise' }`
   - Store tenant ID for backfill phase

### Phase 2: Data Backfill

1. Create migration `20240402_backfill_tenant.ts`:
   - Update all rows in all 8 tables: set `tenant_id` = default tenant ID
   - Process in batches of 10,000 rows to avoid lock contention
   - Log progress: "Backfilled X of Y rows in table Z"
   - Estimated time: ~15 minutes for 2.1M rows

2. After backfill, add NOT NULL constraint:
   - `ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL`
   - Repeat for all 8 tables

3. Add composite indexes for tenant-scoped queries:
   - `CREATE INDEX idx_users_tenant ON users(tenant_id)`
   - `CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at)`
   - Similar indexes for other high-query tables

### Phase 3: Application Code

1. Create `tenantContext.ts` middleware:
   - Extract tenant from JWT token or `X-Tenant-ID` header
   - Validate tenant exists and is active
   - Attach to `req.tenant` for downstream use

2. Update `baseRepository.ts`:
   - Add `tenantId` parameter to all query methods
   - Automatically filter: `WHERE tenant_id = ?` on all SELECT queries
   - Automatically set `tenant_id` on all INSERT queries
   - Prevent cross-tenant data access

3. Create `tenantService.ts`:
   - `createTenant(name, plan)` — provision new tenant
   - `getTenant(id)` — fetch tenant details
   - `listTenants()` — admin endpoint for all tenants

### Phase 4: Testing and Verification

1. Write unit tests for tenant context middleware
2. Write unit tests for base repository tenant filtering
3. Write integration tests:
   - Create two tenants, create data in each, verify isolation
   - Verify cross-tenant query returns empty results
   - Verify tenant deletion cascades correctly
4. Run full test suite against migrated schema
5. Performance test: query with tenant filter vs without (verify index usage)
6. Verify all 8 tables have tenant_id NOT NULL with foreign key
7. Load test: simulate multi-tenant traffic patterns
8. Run EXPLAIN ANALYZE on top 10 queries to verify index usage

## Verification

1. All verification is consolidated in Phase 4 above
2. Database: verify schema changes via `\d+ tablename` in psql
3. Data: verify no NULL tenant_id values remain
4. Application: verify all endpoints require tenant context
5. Security: verify cross-tenant data access is impossible
