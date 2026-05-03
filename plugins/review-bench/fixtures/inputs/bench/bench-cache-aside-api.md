# Plan: Add Redis Cache-Aside to Product Catalog API

## Background

Product catalog API is seeing ~200ms p95 under load because every request goes straight to Postgres. Adding a cache-aside layer with Redis to bring cached reads down significantly. Products don't change that often, so a TTL-based approach with explicit invalidation on writes is the right fit.

Stack: Express/Node.js, Knex (Postgres), Redis available at `REDIS_URL`.

Endpoints in scope:
- `GET /products/:id` — single product lookup (highest traffic)
- `GET /products?category=X` — filtered list
- `PUT /products/:id` — update
- `DELETE /products/:id` — delete

## Git Setup

```bash
git checkout -b feat/redis-cache-aside
```

One commit per phase. Squash merge to main when done.

## Phase 1: Redis Client + Cache Module

> Get Redis wired up as a singleton and build the cache utility layer that the service will use. No behavior changes yet — just the plumbing.

### Steps

1. **Install ioredis**
   ```bash
   npm install ioredis
   ```

2. **Create `src/cache/redisClient.js`**
   - Connect using `process.env.REDIS_URL`
   - Graceful error handling: log connection failures, don't crash the app
   - Export the client singleton
   - On `error` event: log and let requests fall through to DB (cache is an optimization, not a requirement)

3. **Create `src/cache/cacheUtils.js`**
   - Generic get/set/del wrappers that handle JSON serialization and swallow Redis errors
   - All cache operations wrapped in try/catch — a Redis failure should never break an API request
   - TTL configurable via `CACHE_TTL` env var, default 300s (5 minutes)
   ```js
   async function cacheGet(key) { ... }     // returns parsed object or null
   async function cacheSet(key, data, ttl) { ... }  // JSON.stringify + SET EX
   async function cacheDel(key) { ... }      // single key delete
   async function cacheDelPattern(pattern) { ... }  // SCAN + DEL for pattern-based invalidation
   ```
   - Important: use `SCAN` not `KEYS` for pattern deletion — `KEYS` blocks Redis on large keyspaces

4. **Add to `.env.example`**
   ```
   REDIS_URL=redis://localhost:6379
   CACHE_TTL=300
   ```

**Commit:** `feat: add Redis client and cache utility layer`

### Verify

- App starts without `REDIS_URL` set (graceful no-op)
- App starts with valid `REDIS_URL` and connects
- `cacheSet` / `cacheGet` round-trips a value in a quick manual test or unit test

---

## Phase 2: Cache-Aside on Read Endpoints

> Wire the cache into the product service's read methods. The pattern: check cache first, on miss query Postgres and populate cache, on hit return immediately.

### Steps

5. **Define key schema** (document in a comment at top of cacheUtils or in the service):
   - Single product: `product:{id}`
   - Category listing: `products:category:{category}`
   - Keep it simple — no pagination in cache keys for now. If category lists are large, we can revisit, but caching the full filtered result per category is fine at our scale.

6. **Update `src/services/productService.js` — `getProduct(id)`**
   ```js
   async function getProduct(id) {
     const cached = await cacheGet(`product:${id}`);
     if (cached) return cached;

     const product = await knex('products').where({ id }).first();
     if (product) {
       await cacheSet(`product:${id}`, product);
     }
     return product;
   }
   ```

7. **Update `src/services/productService.js` — `getProductsByCategory(category)`**
   ```js
   async function getProductsByCategory(category) {
     const cacheKey = `products:category:${category}`;
     const cached = await cacheGet(cacheKey);
     if (cached) return cached;

     const products = await knex('products').where({ category });
     await cacheSet(cacheKey, products);
     return products;
   }
   ```

8. **Add `X-Cache` response header** in the route handler or as middleware — `HIT` or `MISS` — useful for debugging and load testing. The service methods should return a flag or we check at the route level whether the data came from cache.
   - Simplest approach: have the service return `{ data, fromCache: boolean }` or set a flag on `res.locals` before responding.

**Commit:** `feat: add cache-aside reads for product endpoints`

### Verify

- `GET /products/:id` — first call is a miss (hits DB), second call is a hit (from Redis)
- `GET /products?category=X` — same behavior
- Check `X-Cache` header in responses
- TTL works: wait 5+ minutes, next request is a miss again
- Kill Redis: requests still work (just slower, all misses)

---

## Phase 3: Cache Invalidation on Writes

> When products are updated or deleted, stale cache entries need to go. Invalidate both the specific product key and any category list that might contain it.

### Steps

9. **Update `src/services/productService.js` — `updateProduct(id, data)`**
   ```js
   async function updateProduct(id, data) {
     const product = await knex('products').where({ id }).first();
     await knex('products').where({ id }).update(data);

     // Invalidate the single product cache
     await cacheDel(`product:${id}`);

     // Invalidate category lists that might include this product
     // Need to clear both old category (if changed) and new category
     if (product) {
       await cacheDel(`products:category:${product.category}`);
     }
     if (data.category && data.category !== product?.category) {
       await cacheDel(`products:category:${data.category}`);
     }

     return knex('products').where({ id }).first();
   }
   ```

10. **Update `src/services/productService.js` — `deleteProduct(id)`**
    ```js
    async function deleteProduct(id) {
      const product = await knex('products').where({ id }).first();
      await knex('products').where({ id }).del();

      await cacheDel(`product:${id}`);
      if (product) {
        await cacheDel(`products:category:${product.category}`);
      }
    }
    ```

11. **Edge case — what if the DB write succeeds but cache invalidation fails?**
    - The try/catch in `cacheUtils` already handles this: invalidation failure is logged but doesn't error the request
    - TTL acts as a safety net — stale data expires within 5 minutes regardless
    - This is acceptable for a product catalog; we're not doing financial transactions

**Commit:** `feat: invalidate cache on product writes`

### Verify

- `PUT /products/:id` — subsequent `GET` returns updated data, not stale cache
- `DELETE /products/:id` — subsequent `GET` returns 404, not cached version
- Category list reflects changes after write
- Redis errors during invalidation don't break the write response

---

## Phase 4: Error Handling Hardening + Tests

> Make sure the cache layer is truly transparent — the API should behave identically whether Redis is up, down, or slow.

### Steps

12. **Add connection timeout to Redis client** — don't let a hung Redis connection block requests. Set `connectTimeout: 5000` and `commandTimeout: 1000` in ioredis config.

13. **Add a health check consideration** — if there's an existing `/health` endpoint, optionally include Redis connectivity status (but don't fail the health check if Redis is down, since the app works without it). Report it as a degraded status.

14. **Write unit tests** for `cacheUtils.js`:
    - Mock ioredis (or use `ioredis-mock`)
    - Test: get returns null on miss
    - Test: set + get round-trips correctly
    - Test: del removes key
    - Test: all operations return gracefully when Redis throws

15. **Write integration tests** for the service layer:
    - Test: getProduct returns DB data on cache miss
    - Test: getProduct returns cached data on cache hit
    - Test: updateProduct invalidates cache
    - Test: deleteProduct invalidates cache
    - Test: service works when Redis is unavailable

16. **Install test dependency if needed:**
    ```bash
    npm install --save-dev ioredis-mock
    ```

**Commit:** `feat: add cache layer tests and error handling hardening`

### Verify

- `npm test` passes
- Tests cover cache hit, miss, invalidation, and Redis-down scenarios
- No flaky tests from timing issues

---

## Final Verification Checklist

- [ ] Cache hit ratio observable via `X-Cache` header during manual testing
- [ ] p95 for cached reads is well under 200ms (target: <20ms for hits)
- [ ] Writes invalidate correctly — no stale reads after PUT/DELETE
- [ ] App starts and serves requests with Redis unavailable
- [ ] App recovers when Redis comes back after being down
- [ ] TTL expiration works (keys don't live forever)
- [ ] `.env.example` documents `REDIS_URL` and `CACHE_TTL`
- [ ] Tests pass

## Out of Scope (for now)

- Cache warming on startup — can add later if cold-start latency is a problem
- Cache stampede protection (request coalescing) — worth adding if we see thundering herd on popular products, but premature for now
- Pagination in cache keys — current category lists are small enough to cache whole
- Redis Cluster / Sentinel — single instance is fine for current scale
