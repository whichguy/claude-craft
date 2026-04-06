# Plan: Standardize API Response Formatting

## Context

Our Express REST API has grown to 14 endpoints across 5 route files. The `formatResponse()`
helper in `src/utils/response.ts` standardizes all outgoing JSON to include `status`,
`data`, and `timestamp` fields. Several bug reports mention inconsistent date formatting
in responses — some return ISO strings, others return Unix timestamps.

## Current State

- Express 4.18, TypeScript 5.2
- `formatResponse(data, statusCode)` used across the codebase
- 5 API route files: `users.ts`, `orders.ts`, `products.ts`, `billing.ts`, `webhooks.ts`
- Each route file calls `formatResponse()` in 1-3 handlers (total ~12 call sites)
- Date fields currently pass through unmodified

## Approach

We will modify `formatResponse()` to accept a third `options` parameter that controls
date serialization format. The function will recursively walk response objects and
normalize all Date instances to ISO-8601 strings. We will also add a `meta` envelope
field for pagination support that several teams have requested.

## Files to Modify

- `src/utils/response.ts` — modify `formatResponse()` signature and add date normalization
- `src/utils/dateNormalizer.ts` (new) — recursive date field walker
- `src/types/api.ts` — add `FormatOptions` and `ResponseMeta` interfaces
- `src/middleware/responseWrapper.ts` (new) — Express middleware alternative

## Implementation

### Phase 1: Core Changes

1. Add `FormatOptions` interface to `src/types/api.ts`:
   ```typescript
   interface FormatOptions {
     dateFormat?: 'iso' | 'unix' | 'relative';
     includeMeta?: boolean;
     pagination?: { page: number; total: number; perPage: number };
   }
   ```

2. Modify `formatResponse()` signature from `formatResponse(data, statusCode)` to
   `formatResponse(data, statusCode, options?: FormatOptions)`

3. Create `dateNormalizer.ts` with `normalizeDates(obj, format)` that:
   - Recursively traverses objects and arrays
   - Converts Date instances to the specified format
   - Handles nested objects up to 10 levels deep
   - Preserves non-date fields unchanged

4. Wire `normalizeDates` into `formatResponse()` before returning the envelope

5. Add `meta` field to response envelope when `includeMeta: true`:
   ```json
   { "status": 200, "data": {...}, "meta": { "page": 1, "total": 50 }, "timestamp": "..." }
   ```

### Phase 2: Middleware Layer

1. Create `responseWrapper.ts` middleware that auto-applies `formatResponse()` to
   all `res.json()` calls via monkey-patching `res.json`

2. Add configuration for default `FormatOptions` at the app level

3. Allow per-route overrides via `res.locals.formatOptions`

### Phase 3: Documentation

1. Update API docs to reflect new `meta` field in responses
2. Add JSDoc comments to `formatResponse()` and `FormatOptions`
3. Add examples of the three date format outputs

## Verification

1. Unit test `dateNormalizer` with nested objects, arrays, and edge cases
2. Unit test `formatResponse()` with all three date format options
3. Integration test: hit an endpoint and verify ISO date format in response
4. Verify `meta` field appears only when pagination options are provided
5. Snapshot tests for response shape with and without meta
