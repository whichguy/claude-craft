# Plan: Add ElastiCache Redis for Session & Feature Flag Caching

## Context

API service adds ~50ms per request from direct RDS queries for session lookups and feature flags. Adding an ElastiCache Redis cluster with cache-aside pattern will eliminate repeated DB hits for this high-frequency, low-churn data. Sessions and feature flags are ideal cache candidates — read-heavy, tolerate brief staleness, and have clear invalidation points.

**Infra:** Terraform in `terraform/` — VPC, subnets, RDS, ECS, ALB already provisioned.
**App:** Node.js in `app/` — `sessionService.js` and `featureFlagService.js` query RDS on every request.

## Git Setup

```
git checkout -b feat/elasticache-redis
```

Single branch since infra and app live in the same repo.

## Implementation Steps

### Phase 1: Networking & ElastiCache Terraform Resources

> Stand up the Redis cluster inside the existing VPC with security groups that allow traffic only from ECS tasks.

**Pre-check:** `terraform plan` shows no drift from current state.

1. **Add Redis security group** in `terraform/security_groups.tf`:
   - New `aws_security_group` resource `redis_sg` in the existing VPC
   - Ingress rule: TCP 6379 from `ecs_tasks_sg` (the security group already attached to ECS tasks)
   - Egress rule: allow all outbound (standard)

2. **Add ElastiCache subnet group** in `terraform/main.tf`:
   - `aws_elasticache_subnet_group` using the existing private subnets (same ones RDS uses)

3. **Add ElastiCache replication group** in `terraform/main.tf`:
   - `aws_elasticache_replication_group` resource
   - Engine: Redis 7.x, node type `cache.t3.medium` (right-size for session/flag data)
   - Single-node with `num_cache_clusters = 1` (no replicas initially — can add later if availability requirements demand it)
   - `at_rest_encryption_enabled = true`, `transit_encryption_enabled = true`
   - Automatic failover off (single node)
   - Subnet group from step 2, security group from step 1
   - Parameter group: default.redis7

4. **Add variables** in `terraform/variables.tf`:
   - `redis_node_type` (default `cache.t3.medium`)
   - `redis_engine_version` (default `7.0`)

5. **Add outputs** in `terraform/outputs.tf`:
   - `redis_endpoint` — primary endpoint address from the replication group
   - `redis_port`

6. **Pass Redis endpoint to ECS task definition** in `terraform/main.tf`:
   - Add `REDIS_URL` environment variable to the ECS task container definition: `redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379`

7. **Validate:**
   - `terraform fmt -check` passes
   - `terraform validate` passes
   - `terraform plan` — review output, confirm only new resources: subnet group, security group, replication group, and updated ECS task definition

**Phase 1 commit:** `feat: add ElastiCache Redis cluster with VPC networking`

### Phase 2: Application Cache Layer

> Wire up the Redis client in the app and implement cache-aside for sessions and feature flags.

**Pre-check:** `REDIS_URL` will be available as env var once ECS task definition is updated.

8. **Install Redis client:**
   ```
   npm install ioredis
   ```

9. **Add Redis config** in `app/config.js`:
   - Read `REDIS_URL` from environment
   - Export `redisUrl` alongside existing config values

10. **Create `app/services/cacheService.js`:**
    - Initialize `ioredis` client from `config.redisUrl`
    - Graceful degradation: if Redis is unavailable, log warning and fall through to DB (cache should never break the app)
    - Connection error handler that logs but doesn't crash
    - `async get(key)` — returns parsed JSON or null, catches errors and returns null
    - `async set(key, value, ttlSeconds)` — JSON.stringify and SET EX, catches errors silently
    - `async del(key)` — DEL key, catches errors silently
    - Health check method for readiness probes

11. **Update `app/services/sessionService.js`:**
    - Import cacheService
    - `getSession(id)`:
      - Try cache key `session:{id}` first
      - On miss: query RDS, store result in cache with 5-minute TTL
      - On hit: return cached session
    - TTL rationale: sessions change on login/logout, 5 min is a reasonable staleness window. If tighter consistency is needed, invalidate on session write.

12. **Update `app/services/featureFlagService.js`:**
    - Import cacheService
    - `getFlags()`:
      - Try cache key `feature_flags:all` first
      - On miss: query RDS, store result with 60-second TTL
      - On hit: return cached flags
    - TTL rationale: feature flags change rarely but when they do, you want propagation within a minute. 60s TTL handles this without explicit invalidation.

13. **Verify locally (optional):**
    - Run local Redis via Docker: `docker run -p 6379:6379 redis:7`
    - Set `REDIS_URL=redis://localhost:6379` and run app
    - Confirm cache hits in logs after second request

**Phase 2 commit:** `feat: add Redis cache-aside for sessions and feature flags`

### Phase 3: Deploy & Verify

> Get it into production and confirm the latency improvement.

14. **Deploy infrastructure:**
    - `terraform apply` — provisions ElastiCache cluster (takes ~5-10 minutes for cluster creation)
    - Verify: from a bastion or ECS exec, `redis-cli -h <endpoint> --tls ping` returns PONG

15. **Deploy application:**
    - Standard ECS deployment picks up new task definition with `REDIS_URL`
    - Monitor ECS service events for healthy task registration

16. **Verify in production:**
    - Check application logs for `cache hit` / `cache miss` entries
    - Confirm request latency dropped (target: ~50ms reduction on session/flag lookups)
    - Monitor Redis CloudWatch metrics: `CurrConnections`, `CacheHits`, `CacheMisses`, `EngineCPUUtilization`

17. **Rollback plan:**
    - If Redis issues: the graceful degradation in cacheService means the app falls through to RDS automatically
    - If needed to fully remove: revert ECS task definition to remove `REDIS_URL`, redeploy — app skips cache when `REDIS_URL` is unset

## Verification Checklist

- [ ] `terraform plan` shows only expected new resources before apply
- [ ] Redis cluster is in the same VPC and only accessible from ECS tasks
- [ ] Transit encryption enabled (TLS)
- [ ] App starts and serves requests even if Redis is down
- [ ] Cache hit/miss logging is present
- [ ] Session lookups use cache on repeated requests
- [ ] Feature flag lookups use cache on repeated requests
- [ ] Request latency reduced by ~50ms on cached paths
- [ ] All existing tests pass (`npm test`)
