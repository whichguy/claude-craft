# Stale Cache in Product Metadata
## Context
Optimizing a high-traffic e-commerce storefront by adding Redis caching to the `GET /products/:id` endpoint. The goal is to reduce database load during peak traffic.

## Git Setup
- Repository: `store-api`
- Branch: `perf/redis-cache`

## Implementation Steps
1. Wrap the product lookup logic with a Redis `GET` check.
2. If the cache is empty, fetch from DB and `SET` the cache with a 1-hour expiration.

```javascript
const redis = require('redis');
const client = redis.createClient();

app.get('/products/:id', async (req, res) => {
    const productId = req.params.id;
    
    // Try cache
    const cachedProduct = await client.get(`product:${productId}`);
    if (cachedProduct) {
        return res.json(JSON.parse(cachedProduct));
    }
    
    // DB Fallback
    const product = await db.products.findOne({ id: productId });
    
    // Save to cache for 1 hour
    await client.setex(`product:${productId}`, 3600, JSON.stringify(product));
    
    res.json(product);
});
```

## Verification
- Fetch a product and verify it is cached in Redis.
- Fetch the same product again and verify the response time is faster.

## Risks
- The implementation does not update the `POST /products/:id` or `PUT /products/:id` handlers to invalidate the cache. If a product's price or description is updated, the storefront will continue to show stale data for up to an hour, leading to customer confusion and potential pricing errors.
