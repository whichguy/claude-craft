# Plan: Release Pipeline — Database Migration + Code Deploy

## Context

Releasing v2.4: adds a `status` column (NOT NULL) to the `orders` table plus new API
code using it. Both must ship together. Targets staging first, then production.

## Current Architecture

- Node.js API on AWS ECS, PostgreSQL 15 on RDS
- Migrations via `knex migrate:latest`, blue-green ECS deploys
- ~500 requests/minute at peak

## Files to Change

| File | Change |
|------|--------|
| `migrations/027_add_order_status.ts` | Add status column with backfill |
| `src/models/order.ts` | Add status to Order type |
| `src/services/orderService.ts` | Status queries and updates |
| `src/routes/orderRoutes.ts` | Expose status in API |
| `.github/workflows/release.yml` | Migration + deploy pipeline |

## Implementation Steps

### Step 1: Migration

Add `status VARCHAR(50) NOT NULL DEFAULT 'pending'` with index. Backfill existing
rows: `shipped_at IS NOT NULL -> 'shipped'`, `paid_at IS NOT NULL -> 'paid'`, else `'pending'`.
Down migration drops the column.

### Step 2: Updated Order Service

New functions: `updateOrderStatus(orderId, status)` and `getOrdersByStatus(status)`.

### Step 3: Updated Routes

- `GET /api/orders?status=X` — filter by status
- `PATCH /api/orders/:id/status` — update status

### Step 4: CI/CD Pipeline

```yaml
jobs:
  migrate:
    steps:
      - run: npx knex migrate:latest --env staging

  deploy:
    needs: migrate
    steps:
      - run: docker build && docker push
      - run: aws ecs update-service --cluster staging --service api --force-new-deployment

  verify:
    needs: deploy
    steps:
      - name: Health check (10 retries, 10s interval)
        run: curl -sf https://staging-api.example.com/health
      - name: Smoke test
        run: curl -sf https://staging-api.example.com/api/orders?status=pending
```

Pipeline runs migration first, then deploys code, then verifies. If code deploy fails
after migration has run, the new `status` column is already in the database.

## Verification

- [ ] Migration adds status column with default and index
- [ ] Backfill sets correct status on ~2M rows (~30-45s)
- [ ] API returns status field in order responses
- [ ] Filter by status works
- [ ] PATCH endpoint updates status
- [ ] Pipeline runs migration before deploy
- [ ] Health check passes after deployment
