# Plan: Add Caching Layer with Disk Fallback

## Context

Our API server needs a caching layer to reduce database load for frequently-accessed
product catalog data. The operations team can provision Redis on the primary environment
but the staging and local dev environments don't have Redis available. We need a caching
solution that works in both scenarios.

## Current State

- Node.js 20, Express 4.18, TypeScript 5.3
- No caching currently — every request hits PostgreSQL
- Product catalog: 50K items, queried ~10K times/day, changes ~50 times/day
- Redis available in production (env var `REDIS_URL` set when available)
- Staging/dev: no Redis, local filesystem available
- Existing config pattern: `src/config/env.ts` reads environment variables

## Approach

We will build a cache interface with two implementations: Redis-backed for production and
filesystem-backed for environments without Redis. The cache will be used by the product
service to store serialized query results with configurable TTL. On application startup,
the system will attempt to connect to Redis. If Redis is available and the REDIS_URL environment variable is set, the Redis cache implementation will be used for all caching operations, providing fast in-memory access with automatic TTL expiration and cluster support. If Redis is unavailable — either because REDIS_URL is not set, or because the connection attempt fails within a 3-second timeout — the system will fall back to the disk-based cache implementation. The disk cache stores entries as individual JSON files in a configurable directory (defaulting to `/tmp/app-cache/`), with TTL enforced by checking file modification timestamps against the configured expiration duration at read time. Expired files are cleaned up lazily on read and also by a periodic sweep that runs every 10 minutes via setInterval. The disk cache is obviously slower than Redis (filesystem I/O vs memory) but provides the same interface and is sufficient for staging and local development where request volume is low. The cache factory function in `src/cache/cacheFactory.ts` handles this detection and instantiation logic, returning a `CacheProvider` interface that the rest of the application uses without knowing which implementation is active. A startup log line will indicate which cache backend was selected: "Cache: Redis (redis://...)" or "Cache: Disk (/tmp/app-cache/)".

## Files to Create/Modify

- `src/cache/types.ts` (new) — `CacheProvider` interface
- `src/cache/redisCache.ts` (new) — Redis implementation
- `src/cache/diskCache.ts` (new) — filesystem fallback implementation
- `src/cache/cacheFactory.ts` (new) — auto-detection and instantiation
- `src/services/productService.ts` — add caching to query methods
- `src/config/env.ts` — add `REDIS_URL` and `CACHE_DIR` config
- `src/app.ts` — initialize cache on startup

## Implementation

### Phase 1: Interface & Types

1. Create `types.ts`:
   ```typescript
   interface CacheProvider {
     get<T>(key: string): Promise<T | null>;
     set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
     delete(key: string): Promise<void>;
     clear(): Promise<void>;
   }
   ```

2. Add config to `env.ts`:
   - `REDIS_URL`: optional, read from environment
   - `CACHE_DIR`: defaults to `/tmp/app-cache/`
   - `CACHE_DEFAULT_TTL`: defaults to 300 (5 minutes)

### Phase 2: Implementations

1. Create `redisCache.ts` implementing `CacheProvider`:
   - Constructor takes `redisUrl` string
   - Uses `ioredis` client
   - `get`: `JSON.parse(await redis.get(key))`
   - `set`: `await redis.setex(key, ttl, JSON.stringify(value))`
   - `delete`: `await redis.del(key)`
   - `clear`: `await redis.flushdb()`

2. Create `diskCache.ts` implementing `CacheProvider`:
   - Constructor takes `cacheDir` string, creates directory if missing
   - `get`: read file, check TTL via stored metadata, return parsed JSON or null
   - `set`: write JSON file with `{ data, expiresAt }` structure
   - `delete`: unlink file
   - `clear`: remove all files in cache directory
   - Periodic cleanup via `setInterval` every 10 minutes

3. Create `cacheFactory.ts`:
   - `createCache(): Promise<CacheProvider>` — tries Redis first, falls back to disk
   - Log which backend was selected

### Phase 3: Integration

1. Update `app.ts`:
   - Call `createCache()` during startup
   - Store cache instance in app context
   - Log selected backend

2. Update `productService.ts`:
   - Before DB query: check cache for key `products:{queryHash}`
   - On cache miss: query DB, store result in cache with 5-minute TTL
   - On cache hit: return cached result directly
   - On product update: invalidate related cache keys

## Verification

1. Start with `REDIS_URL` set — verify "Cache: Redis" in startup logs
2. Start without `REDIS_URL` — verify "Cache: Disk" in startup logs
3. First product query: cache miss, DB query executes
4. Second identical query: cache hit, no DB query
5. Wait 5 minutes: cache expired, DB query executes again
6. Update a product: cache invalidated, next query hits DB
7. Unit tests for both implementations with same test suite
8. Verify disk cache cleanup removes expired files
