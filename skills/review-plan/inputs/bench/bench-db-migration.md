# Plan: Zero-Downtime JSONB-to-Normalized Schema Migration

## Context

The `orders` table (~50M rows, ~12GB) stores line items in a JSONB column (`items`). This blocks efficient indexing on item-level fields and forces slow `jsonb_array_elements()` and `@>` containment queries. We need to extract items into a proper `order_items` table while the application stays live.

**Stack:** Node.js/Express, Knex.js, AWS RDS PostgreSQL 15
**Project root:** `~/src/order-service`

## Git Setup

```bash
git checkout -b feat/normalize-order-items
```

Each phase gets its own commit. Squash-merge to main after the full migration is verified in production.

---

## Phase 1: Add `order_items` Table + Database-Level Dual-Write Trigger

> The goal here is to create the new table and a PostgreSQL trigger that automatically fans out JSONB items into `order_items` rows on every INSERT/UPDATE. This means all new writes are captured immediately — before we touch a single line of application code — giving us a clean sync point for the backfill.

**Pre-check:** Confirm RDS parameter group allows `plpgsql` (it does by default on RDS 15).

1. Create migration `migrations/20240115_001_create_order_items.js`:

   **Up:**
   ```sql
   CREATE TABLE order_items (
     id BIGSERIAL PRIMARY KEY,
     order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
     product_id BIGINT NOT NULL,
     quantity INT NOT NULL DEFAULT 1,
     unit_price DECIMAL(12,2) NOT NULL,
     metadata JSONB DEFAULT '{}',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   CREATE INDEX idx_order_items_order_id ON order_items(order_id);
   CREATE INDEX idx_order_items_product_id ON order_items(product_id);
   ```

   **Down:**
   ```sql
   DROP TABLE IF EXISTS order_items;
   ```

2. Create migration `migrations/20240115_002_add_sync_trigger.js`:

   **Up:**
   ```sql
   CREATE OR REPLACE FUNCTION fn_sync_order_items() RETURNS trigger AS $$
   BEGIN
     DELETE FROM order_items WHERE order_id = NEW.id;
     INSERT INTO order_items (order_id, product_id, quantity, unit_price)
     SELECT NEW.id,
            (item->>'product_id')::bigint,
            (item->>'quantity')::int,
            (item->>'unit_price')::numeric
     FROM jsonb_array_elements(NEW.items) AS item;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER trg_orders_sync_items
     AFTER INSERT OR UPDATE OF items ON orders
     FOR EACH ROW EXECUTE FUNCTION fn_sync_order_items();
   ```

   **Down:**
   ```sql
   DROP TRIGGER IF EXISTS trg_orders_sync_items ON orders;
   DROP FUNCTION IF EXISTS fn_sync_order_items();
   ```

   Splitting the trigger into its own migration keeps rollback clean — we can drop the trigger without dropping the table.

3. Apply on staging: `npx knex migrate:latest --env staging`

4. **Verify:** Insert a test order through the app. Confirm matching rows appear in `order_items`:
   ```sql
   SELECT * FROM order_items WHERE order_id = <test_id>;
   ```

**Commit:** `feat: add order_items table and dual-write trigger`
**Files:** `migrations/20240115_001_create_order_items.js`, `migrations/20240115_002_add_sync_trigger.js`

---

## Phase 2: Backfill Historical Data

> Every order written after Phase 1 is automatically synced via the trigger. But the ~50M existing rows need to be backfilled. We'll do this in batches to avoid locking the table or spiking RDS CPU.

1. Create `scripts/backfill-order-items.js`:
   - Accept `--batch-size` (default 1000), `--start-id` (default 0), `--dry-run` flags
   - Query in ID-range batches: `WHERE id > $lastId ORDER BY id LIMIT $batchSize`
   - For each batch, run a single INSERT ... SELECT with `ON CONFLICT DO NOTHING` (conflict on `(order_id, product_id)` — add a unique partial index for the backfill if items are unique per product, or use a temp dedup strategy):
     ```sql
     INSERT INTO order_items (order_id, product_id, quantity, unit_price)
     SELECT o.id, (item->>'product_id')::bigint, (item->>'quantity')::int, (item->>'unit_price')::numeric
     FROM orders o, jsonb_array_elements(o.items) AS item
     WHERE o.id > $1 AND o.id <= $2
     ON CONFLICT DO NOTHING;
     ```
   - Add a configurable delay between batches (`--delay-ms`, default 50) to throttle write load
   - Log progress every 10,000 orders: `Backfilled orders 120000-130000 (X items inserted)`
   - On error, log the failing batch range and exit with non-zero code so it can be resumed with `--start-id`

2. Run on staging, then verify:
   ```sql
   SELECT COUNT(*) FROM order_items;
   SELECT SUM(jsonb_array_length(items)) FROM orders;
   -- These two counts should match
   ```

3. Run on production during low-traffic hours. Monitor in RDS console:
   - CPU utilization stays under 70%
   - No replication lag spikes (if using read replicas)
   - `WriteThroughput` and `WriteLatency` metrics

   At 1000 orders/batch with 50ms delay, ~50M rows should take roughly 1-3 hours depending on items-per-order.

4. After backfill completes, verify counts match on production.

**Commit:** `feat: add backfill script for historical order_items data`
**Files:** `scripts/backfill-order-items.js`

---

## Phase 3: Switch Reads to `order_items`

> Now that both new and historical data lives in `order_items`, we switch the read path. The JSONB column still receives writes (via both the app and the trigger), so we can revert reads instantly if something goes wrong.

1. Update `src/repositories/orderRepository.js`:

   - **`getOrderItems(orderId)`** — Replace `jsonb_array_elements()` raw query with:
     ```js
     knex('order_items').where({ order_id: orderId });
     ```
   - **`getOrdersByProduct(productId)`** — Replace JSONB `@>` containment query with:
     ```js
     knex('orders')
       .join('order_items', 'orders.id', 'order_items.order_id')
       .where('order_items.product_id', productId)
       .distinct('orders.*');
     ```
   - Keep original JSONB implementations in clearly marked comment blocks with `// REVERT: original JSONB implementation` headers so rollback is a quick uncomment

2. Create `src/repositories/orderItemRepository.js`:
   - `findByOrderId(orderId)` — basic lookup
   - `findByProductId(productId, { limit, offset })` — paginated product search
   - `getItemCountByOrder(orderId)` — useful for validation
   - This repository enables future queries that JSONB made impractical (aggregations, joins to product catalog, etc.)

3. Update `src/graphql/resolvers/order.js`:
   - `Order.items` resolver: call `orderItemRepository.findByOrderId()` instead of `orderRepository.getOrderItems()`
   - `Query.ordersByProduct`: call updated `orderRepository.getOrdersByProduct()`
   - Verify the response shape matches what clients expect — the resolver may need to map column names (`unit_price` vs `unitPrice`) to match the existing JSONB structure

4. Add a feature flag (env var `USE_NORMALIZED_READS=true`) so we can toggle back to JSONB reads without a redeploy. Wrap the repository calls:
   ```js
   const useNormalized = process.env.USE_NORMALIZED_READS !== 'false';
   ```

5. Deploy to staging. Run the existing integration test suite. Compare response payloads between old and new for a sample of orders to confirm field-level parity.

6. Deploy to production with `USE_NORMALIZED_READS=true`. Monitor error rates and p95 latencies in dashboards for 24-48 hours.

**Commit:** `feat: switch order reads to normalized order_items table`
**Files:** `src/repositories/orderRepository.js`, `src/repositories/orderItemRepository.js`, `src/graphql/resolvers/order.js`

---

## Phase 4: Switch Writes to Application-Level Dual-Write

> The trigger has been handling the sync. Now we move that responsibility into application code so we can control transactional behavior directly and eventually drop the trigger.

1. Update `src/services/orderService.js`:

   - **`createOrder(orderData)`** — wrap in a Knex transaction:
     ```js
     await knex.transaction(async (trx) => {
       const [order] = await trx('orders').insert({
         ...orderFields,
         items: JSON.stringify(orderData.items), // keep JSONB populated for now
       }).returning('*');

       const itemRows = orderData.items.map(item => ({
         order_id: order.id,
         product_id: item.product_id,
         quantity: item.quantity,
         unit_price: item.unit_price,
       }));
       await trx('order_items').insert(itemRows);

       return order;
     });
     ```

   - **`updateOrder(orderId, updates)`** — same transactional dual-write pattern. Delete existing `order_items` for the order, re-insert from the updated items array.

2. Update `src/utils/orderHelpers.js`:
   - Add `formatItemsForOrderItems(items, orderId)` to build the insert rows
   - Keep `formatItemsForInsert(items)` for the JSONB column (still needed temporarily)
   - Keep `parseOrderItems(jsonbData)` for now (still used by any code path that hasn't switched)

3. Deploy to staging. Create and update orders. Verify both `orders.items` JSONB and `order_items` rows are correct.

4. Deploy to production. Run for **1 week** with both the trigger and application writes active (belt-and-suspenders). Monitor for any discrepancies.

5. After the week, create migration `migrations/20240201_001_drop_sync_trigger.js`:
   ```sql
   DROP TRIGGER IF EXISTS trg_orders_sync_items ON orders;
   DROP FUNCTION IF EXISTS fn_sync_order_items();
   ```

6. Deploy the trigger removal. Verify writes still land in `order_items` correctly.

**Commit:** `feat: application-level dual-write for order_items, drop DB trigger`
**Files:** `src/services/orderService.js`, `src/utils/orderHelpers.js`, `migrations/20240201_001_drop_sync_trigger.js`

---

## Phase 5: Drop JSONB Column and Clean Up

> Final contraction. The JSONB column is no longer read or exclusively written. Remove it along with all fallback code.

**Pre-check:** Phase 4 has been running in production for at least 1 week. No reads hit the JSONB column. Confirm with:
```sql
SELECT * FROM pg_stat_user_columns
WHERE tablename = 'orders' AND attname = 'items';
-- Check if n_tup_fetch / n_tup_read show zero activity (PG 16+ only; on PG 15, verify via application logs)
```

1. Create migration `migrations/20240215_001_drop_items_jsonb_column.js`:
   ```sql
   ALTER TABLE orders DROP COLUMN items;
   ```
   **Down** (for safety — won't restore data, but restores schema):
   ```sql
   ALTER TABLE orders ADD COLUMN items JSONB DEFAULT '[]';
   ```

2. Clean up `src/services/orderService.js`:
   - Remove `items: JSON.stringify(...)` from the orders INSERT
   - Remove any JSONB-related logic from `updateOrder()`

3. Clean up `src/repositories/orderRepository.js`:
   - Remove commented-out JSONB implementations from Phase 3
   - Remove the feature flag check (`USE_NORMALIZED_READS`)

4. Clean up `src/utils/orderHelpers.js`:
   - Remove `parseOrderItems(jsonbData)` — no longer needed
   - Remove `formatItemsForInsert(items)` — no longer needed
   - Keep `formatItemsForOrderItems()` (rename to `formatItemRows()` for clarity)

5. Update any test fixtures that reference the JSONB `items` column. Search for:
   ```bash
   grep -r "items.*jsonb\|JSON.stringify.*items\|parseOrderItems" test/
   ```

6. Deploy to staging, run full test suite. Deploy to production.

**Commit:** `feat: remove JSONB items column, complete normalization`
**Files:** `migrations/20240215_001_drop_items_jsonb_column.js`, `src/services/orderService.js`, `src/repositories/orderRepository.js`, `src/utils/orderHelpers.js`, test files

---

## Verification Checklist

Run after each phase, cumulative:

- [ ] Existing order API tests pass (`npm test`)
- [ ] GraphQL `ordersByProduct` query returns correct results
- [ ] GraphQL `Order.items` resolver returns items with expected shape
- [ ] Create order end-to-end: POST → verify in DB → query back via GraphQL
- [ ] Update order end-to-end: PUT → verify items replaced correctly
- [ ] Row counts: `SELECT COUNT(*) FROM order_items` matches expected total
- [ ] Query performance: `EXPLAIN ANALYZE` on `getOrdersByProduct` shows index scan on `idx_order_items_product_id` (not seq scan)
- [ ] RDS metrics: CPU < 70%, no replication lag, connection count stable
- [ ] Error rate in application monitoring unchanged from baseline

## Rollback Strategy

Each phase can be independently rolled back:

| Phase | Rollback |
|-------|----------|
| 1 | `knex migrate:rollback` drops trigger and table |
| 2 | Truncate `order_items`, re-run backfill if needed |
| 3 | Set `USE_NORMALIZED_READS=false`, redeploy (reads revert to JSONB) |
| 4 | Re-apply trigger migration, revert service code (JSONB writes still work) |
| 5 | Cannot easily undo column drop — this is why we wait a full week after Phase 4 |

## Risk Notes

- **Trigger performance on high-write bursts:** The `AFTER INSERT OR UPDATE` trigger adds overhead per row. If order creation rate exceeds ~500/sec, monitor for lock contention on `order_items`. The trigger is temporary (removed in Phase 4).
- **Backfill and trigger overlap:** Orders written during the backfill window get synced by both the trigger and the backfill script. The `ON CONFLICT DO NOTHING` in the backfill handles this, but only if we have appropriate uniqueness constraints or accept potential duplicate items for orders modified mid-backfill. Consider adding a unique index on `(order_id, product_id)` if items are unique per product within an order, or use a check like `WHERE NOT EXISTS` instead.
- **Column drop is irreversible for data:** Phase 5's down migration restores the column but not the data. Take an RDS snapshot before running Phase 5.
- **JSONB items with inconsistent schemas:** If historical JSONB data has rows where `product_id`, `quantity`, or `unit_price` keys are missing or have unexpected types, the trigger and backfill will fail on those rows. Run a validation query before Phase 2:
  ```sql
  SELECT id FROM orders
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(items) AS item
    WHERE item->>'product_id' IS NULL
       OR item->>'quantity' IS NULL
       OR item->>'unit_price' IS NULL
  );
  ```
  Fix or skip bad rows before backfilling.
