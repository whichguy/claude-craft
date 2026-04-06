# Plan: Add Priority Handling to Order Processing

## Context

Our order service processes incoming orders through a pipeline: validation, inventory
check, payment, and fulfillment. Product management wants to add priority handling so
that premium customers' orders skip the standard queue and get processed immediately.

## Current State

- Node.js 20, TypeScript 5.3
- `processOrder(order: Order)` is the main entry point in `src/services/orderService.ts`
- Called from three locations:
  - `src/routes/orders.ts` — REST endpoint handler
  - `src/workers/orderQueue.ts` — background queue consumer
  - `src/services/bulkImport.ts` — CSV bulk order import
- Order type: `{ id: string; items: Item[]; customerId: string; total: number }`
- No priority concept exists today

## Approach

Add an `options` parameter to `processOrder()` that carries priority level, bypass flags,
and processing hints. Priority orders will be routed to a dedicated fast-path that skips
inventory reservation queuing and uses synchronous payment capture.

## Files to Modify

- `src/types/order.ts` — add `ProcessingOptions` interface
- `src/services/orderService.ts` — modify `processOrder` signature, add priority routing
- `src/services/priorityRouter.ts` (new) — routing logic for priority vs standard
- `src/services/paymentService.ts` — add `captureSync()` method for priority orders

## Implementation

### Phase 1: Type Definitions

1. Add `ProcessingOptions` to `src/types/order.ts`:
   ```typescript
   interface ProcessingOptions {
     priority: 'standard' | 'high' | 'critical';
     skipInventoryQueue?: boolean;
     paymentMode?: 'async' | 'sync';
     metadata?: Record<string, string>;
   }
   ```

2. Update `Order` type to optionally carry `processingOptions`

### Phase 2: Core Service Changes

1. Change `processOrder(order: Order)` to `processOrder(order: Order, options: ProcessingOptions)`
   in `src/services/orderService.ts`

2. Create `priorityRouter.ts` with routing logic:
   - `standard` → existing queue-based flow
   - `high` → skip inventory queue, use async payment
   - `critical` → skip inventory queue, use sync payment, notify ops

3. Add `captureSync()` to `paymentService.ts` that wraps Stripe's synchronous
   capture API for immediate payment confirmation

4. Wire priority router into `processOrder()` as the first step after validation

### Phase 3: Monitoring

1. Add priority-level metrics to `src/monitoring/metrics.ts`:
   - `orders_processed_by_priority` counter
   - `order_processing_time_by_priority` histogram

2. Add structured logging with priority context to all order processing steps

3. Create alert rule for critical-priority order failures

## Verification

1. Unit test priority routing: standard → queue, high → fast-path, critical → sync
2. Unit test `captureSync()` with Stripe mock
3. Integration test: submit priority order, verify it bypasses queue
4. Load test: mix of standard and critical orders, verify critical SLA < 2s
5. Verify metrics are emitted with correct priority labels
