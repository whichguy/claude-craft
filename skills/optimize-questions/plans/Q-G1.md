# Plan: Web API Caching Layer

## Context

Our Express.js API serves product catalog data to ~200 concurrent users. Response times
for `/api/products` and `/api/categories` have degraded to 800ms+ due to repeated
PostgreSQL queries for data that changes only every 15 minutes. We need a caching layer
to bring response times under 100ms for cached hits.

## Current State

- Express 4.18 with `pg` driver, no caching
- PostgreSQL 15 on RDS, ~50k products, ~200 categories
- Average query time: 400ms for products, 200ms for categories
- Deploy target: single EC2 instance (t3.medium), no Redis infrastructure

## Approach

Redis won't work for this use case because it requires a separate server process and adds
operational complexity we can't absorb right now. Instead, we'll build a custom in-process
cache with TTL support, LRU eviction, and tag-based invalidation. This gives us full
control over cache behavior without external dependencies.

The custom cache will implement:
- Configurable TTL per cache key pattern
- LRU eviction when memory exceeds 256MB threshold
- Tag-based invalidation (e.g., invalidate all "product" tagged entries)
- Stale-while-revalidate for high-traffic endpoints
- Serialization layer for cache entries
- Background refresh worker using `setInterval`

## Files to Modify

- `src/cache/CacheManager.ts` (new) — core cache engine
- `src/cache/EvictionPolicy.ts` (new) — LRU eviction logic
- `src/cache/TagIndex.ts` (new) — tag-based invalidation registry
- `src/cache/Serializer.ts` (new) — entry serialization/deserialization
- `src/cache/BackgroundRefresh.ts` (new) — stale-while-revalidate worker
- `src/middleware/cacheMiddleware.ts` (new) — Express middleware
- `src/routes/products.ts` — wrap handlers with cache middleware
- `src/routes/categories.ts` — wrap handlers with cache middleware
- `package.json` — no new dependencies needed

## Implementation

### Phase 1: Cache Engine (3 files)

1. Create `CacheManager.ts` with `Map<string, CacheEntry>` backing store
2. Implement `get(key)`, `set(key, value, ttl)`, `delete(key)`, `clear()`
3. Add memory tracking via `Buffer.byteLength(JSON.stringify(entry))`
4. Build `EvictionPolicy.ts` with doubly-linked list for O(1) LRU operations
5. Wire eviction into CacheManager — evict when `totalBytes > 256MB`
6. Create `TagIndex.ts` mapping tags to Sets of cache keys
7. Add `invalidateByTag(tag)` method to CacheManager

### Phase 2: Middleware & Refresh

1. Create `cacheMiddleware.ts` that intercepts responses and caches them
2. On cache hit, return cached response with `X-Cache: HIT` header
3. On cache miss, let request proceed and cache the response
4. Implement stale-while-revalidate in `BackgroundRefresh.ts`
5. Use `setInterval` to check entries approaching TTL expiry
6. Re-fetch data in background and update cache transparently
7. Create `Serializer.ts` to handle JSON serialization with Date revival

### Phase 3: Integration

1. Add cache middleware to `products.ts` routes with 15-minute TTL
2. Add cache middleware to `categories.ts` routes with 30-minute TTL
3. Tag product caches with `product` tag, categories with `category` tag
4. Add admin endpoint `POST /api/cache/invalidate/:tag` for manual purge
5. Add `X-Cache-Age` response header showing entry age in seconds

## Verification

1. Unit tests for CacheManager: set/get/evict/invalidate flows
2. Unit tests for LRU eviction ordering
3. Integration test: first request = MISS, second = HIT
4. Load test with `autocannon` — confirm <100ms for cached responses
5. Memory test: insert entries until eviction triggers, verify memory stays bounded
6. Verify `X-Cache` and `X-Cache-Age` headers in responses
