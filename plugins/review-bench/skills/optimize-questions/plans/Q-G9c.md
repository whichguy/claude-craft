# Plan: Database Query Optimization for Reports

## Context

The monthly reporting endpoint `GET /api/reports/monthly` takes 45 seconds to respond.
It aggregates order data across 3 tables (orders, order_items, products) with date
filtering, grouping, and sorting. The endpoint serves internal dashboards used by the
finance team every Monday morning, causing timeouts and complaints.

## Current State

- PostgreSQL 15, Prisma ORM, Node.js 20
- `orders` table: 2.1M rows, indexed on `created_at` and `customer_id`
- `order_items` table: 8.4M rows, indexed on `order_id`
- `products` table: 12K rows, indexed on `id` and `category_id`
- Current query uses Prisma `findMany` with nested includes and JS-side aggregation
- No materialized views or summary tables exist
- The report groups by product category and calculates: total revenue, order count,
  average order value, top products, month-over-month growth

## Approach

The core problem is that the current implementation fetches millions of raw rows through Prisma's ORM layer and then performs aggregation in JavaScript. This is fundamentally wrong for analytical queries — the database should do the heavy lifting. We need to push all aggregation down to PostgreSQL using raw SQL queries with proper indexing, and optionally add a materialized view that pre-computes the most expensive aggregations. The materialized view can be refreshed nightly via a cron job since the finance team only needs data through the previous day. We should also add a composite index on order_items covering (order_id, product_id, quantity, unit_price) to support the aggregation joins without table scans. The products table is small enough that it won't need special treatment, but we should make sure the category_id index is being used in the GROUP BY. For the month-over-month growth calculation, we'll use a window function (LAG) in the SQL query rather than fetching two months of data and computing the delta in JavaScript. The Prisma $queryRaw method will let us execute the raw SQL while still getting type-safe results back. We should create a dedicated report service file to keep the raw SQL isolated from the rest of the codebase, and add an integration test that seeds known data and verifies the aggregated output matches expected values. The caching layer is also important — since the report data only changes once per day, we can cache the computed results in Redis with a 24-hour TTL keyed by the date range parameters, which means subsequent requests during the Monday morning rush will be served instantly after the first computation. We'll need to invalidate the cache when a manual data correction happens, so we'll add a cache-bust parameter that the admin panel can trigger. Finally we should add query timing logs so we can track whether the optimization actually helped, using the Prisma query event middleware to log slow queries above a 1-second threshold.

## Files to Modify

- `src/services/reportService.ts` (new) — raw SQL aggregation queries
- `src/routes/reports.ts` — refactor endpoint to use new service
- `prisma/migrations/` — new migration for composite index
- `src/middleware/queryTimer.ts` (new) — query performance logging
- `src/cache/reportCache.ts` (new) — Redis caching for report results

## Implementation

1. Create composite index migration on `order_items(order_id, product_id, quantity, unit_price)` and run `npx prisma migrate dev --name add-order-items-composite-index`. Verify with `EXPLAIN ANALYZE` that the index is used.

2. Create `reportService.ts` with `generateMonthlyReport(startDate, endDate)` using `prisma.$queryRaw` for the main aggregation query joining orders, order_items, and products, grouping by category, computing SUM(revenue), COUNT(orders), AVG(order_value). Add the LAG window function for month-over-month growth. Add a separate query for top 10 products per category.

3. Create `reportCache.ts` with `getCachedReport(key)` and `setCachedReport(key, data, ttl)` using Redis. Key format: `report:monthly:{startDate}:{endDate}`. TTL: 86400 seconds. Add `invalidateReportCache(pattern)` for manual cache-bust.

4. Refactor `reports.ts` endpoint: check cache first, if miss call reportService, cache result, return. Add `?bust=true` query param for cache invalidation.

5. Create `queryTimer.ts` middleware that hooks into Prisma's `$on('query')` event and logs queries exceeding 1000ms with the query text and duration.

6. Create materialized view via raw migration: `CREATE MATERIALIZED VIEW monthly_category_summary AS SELECT ...` with the same aggregation logic. Add `REFRESH MATERIALIZED VIEW` command to the nightly cron script in `scripts/cron/refresh-views.sh`.

## Verification

1. Run `EXPLAIN ANALYZE` on the main aggregation query — confirm index scan, no seq scan on order_items
2. Run `EXPLAIN ANALYZE` on the top-products subquery — confirm products table uses category_id index
3. Benchmark: endpoint responds under 2 seconds (down from 45s) for a 3-month date range
4. Benchmark: endpoint responds under 5 seconds for a 12-month date range
5. Second request with same parameters hits Redis cache — responds under 50ms
6. Cache bust parameter `?bust=true` triggers fresh computation and updates cache
7. Materialized view matches live query results for same date range (diff check)
8. Query timer logs appear for queries over 1-second threshold
9. Integration test with seeded data verifies correct aggregation math
10. Month-over-month growth calculation matches manual spreadsheet verification
11. Verify materialized view refresh completes under 30 seconds
12. Confirm no regressions in existing endpoint tests after refactor
