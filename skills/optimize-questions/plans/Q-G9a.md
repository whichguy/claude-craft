# Plan: API Versioning Strategy

## Context

Our public REST API needs versioning support. We currently serve v1 endpoints and need to
introduce v2 with breaking changes to the user and order resources. Both versions must
coexist for 6 months during the migration period. We'll use URL-prefix versioning
(`/api/v1/`, `/api/v2/`).

## Current State

- Express 4.18, TypeScript 5.3
- All routes mounted under `/api/` with no version prefix
- 6 route files: users, orders, products, billing, webhooks, health
- 42 endpoints total across all routes
- ~300 active API consumers (tracked via API keys)
- Breaking changes in v2: user schema restructured, order status enum changed

## Approach

We will restructure the route mounting to support versioned prefixes. Shared logic stays
in service files; only the route handlers and request/response transformations differ
between versions. A version-detection middleware reads the URL prefix and sets
`req.apiVersion`. Deprecated v1 endpoints return `Sunset` headers.

## Files to Modify

- `src/routes/index.ts` — restructure route mounting for versioned prefixes
- `src/middleware/apiVersion.ts` (new) — version detection middleware
- `src/routes/v1/users.ts` (new) — v1 user routes (move from current)
- `src/routes/v1/orders.ts` (new) — v1 order routes (move from current)
- `src/routes/v2/users.ts` (new) — v2 user routes with new schema
- `src/routes/v2/orders.ts` (new) — v2 order routes with new status enum
- `src/transformers/userTransformer.ts` (new) — v1↔v2 user shape conversion
- `src/transformers/orderTransformer.ts` (new) — v1↔v2 order shape conversion
- `src/services/userService.ts` — keep as shared, version-agnostic
- `src/services/orderService.ts` — keep as shared, version-agnostic

## Implementation

1. Create `apiVersion.ts` middleware that parses `/api/v{N}/` from the URL and sets
   `req.apiVersion = N`. Default to v1 if no version prefix found.

2. Create the `src/routes/v1/` directory structure.

2a. Move existing `users.ts` route handlers to `src/routes/v1/users.ts` — these become
    the frozen v1 endpoints. Add `Sunset: 2025-06-01` header to all responses.

3. Move existing `orders.ts` route handlers to `src/routes/v1/orders.ts` with same
   Sunset header treatment.

2b. Create `src/routes/v2/users.ts` with the restructured user schema:
    - Flatten `name.first` + `name.last` into `displayName`
    - Add `metadata` object field
    - Change `created` from Unix timestamp to ISO-8601

4. Create `src/routes/v2/orders.ts` with updated status enum:
   - Replace `pending/processing/shipped/delivered` with `draft/confirmed/in_transit/completed/cancelled`
   - Add `statusHistory` array field

5. Create `userTransformer.ts`:
   - `toV1(internalUser)` — convert internal user model to v1 response shape
   - `toV2(internalUser)` — convert internal user model to v2 response shape
   - `fromV1Request(body)` — parse v1 request body to internal model
   - `fromV2Request(body)` — parse v2 request body to internal model

6. Create `orderTransformer.ts` with same pattern for order resources.

7. Update `src/routes/index.ts` to mount both version prefixes:
   ```typescript
   router.use('/api/v1/users', v1UserRoutes);
   router.use('/api/v1/orders', v1OrderRoutes);
   router.use('/api/v2/users', v2UserRoutes);
   router.use('/api/v2/orders', v2OrderRoutes);
   // Shared routes (no breaking changes): products, billing, webhooks, health
   router.use('/api/v1', sharedRoutes);
   router.use('/api/v2', sharedRoutes);
   ```

8. Add `API-Version` response header to all responses via the version middleware.

9. Add deprecation notice to v1 OpenAPI spec and update v2 spec with new schemas.

## Verification

1. `GET /api/v1/users` returns users in v1 schema shape
2. `GET /api/v2/users` returns users in v2 schema shape (flattened name, ISO dates)
3. `GET /api/v1/orders` returns orders with old status enum
4. `GET /api/v2/orders` returns orders with new status enum + statusHistory
5. v1 responses include `Sunset` header
6. All responses include `API-Version` header
7. Shared endpoints (products, health) work under both `/v1/` and `/v2/`
8. Requests without version prefix default to v1
9. Run existing test suite — all 42 endpoint tests pass under `/v1/` prefix
