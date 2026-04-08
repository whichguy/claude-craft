# Plan: Extract Shared JWT Auth Middleware Package

## Context

JWT authentication, role-based access control, and rate limiting logic is duplicated across 3 microservices: `user-service`, `order-service`, and `notification-service`. Each has its own copy with slight variations that have drifted over time. The goal is to extract the common auth middleware into `@company/auth-middleware`, publish to our private npm registry, and migrate all three services.

All 3 services are Express-based Node.js apps in separate repos. They share the same JWT secret (via environment variable) and a Redis instance for rate limiting.

**Current state across services:**

| Feature | user-service | order-service | notification-service |
|---------|-------------|---------------|---------------------|
| `verifyToken()` | Standard | Custom `onError` callback param | Standard |
| `checkRole()` | Standard | Standard | Standard |
| `rateLimitByUser()` | Standard | Standard | Standard |
| `refreshTokenIfExpiring()` | No | No | Yes (auto-refresh within 5min of expiry) |

The key design tension: `order-service` needs customizable error handling in `verifyToken`, and `notification-service` needs token auto-refresh. The shared package must support both without forcing the other services to care.

**Repos:**
- `~/src/user-service` -- main user management API
- `~/src/order-service` -- order processing API
- `~/src/notification-service` -- notification delivery API
- `~/src/auth-middleware` -- new shared package (to create)

**Registry:** `https://registry.company.internal`

## Git Setup

```bash
# New package repo
mkdir ~/src/auth-middleware && git -C ~/src/auth-middleware init

# Feature branches on each service
git -C ~/src/user-service checkout -b refactor/shared-auth-middleware
git -C ~/src/order-service checkout -b refactor/shared-auth-middleware
git -C ~/src/notification-service checkout -b refactor/shared-auth-middleware
```

---

## Phase 1: Audit Existing Implementations

**Intent:** Before writing any code, read all three services' auth middleware side-by-side to identify the exact common core, the divergences, and any hidden assumptions (e.g., `req.user` shape differences, error response formats, Redis key prefixes). This prevents building the wrong abstraction.

### 1.1 Catalog the interfaces

Read these files and document the exact function signatures, `req.user` shape, error response format, and Redis key patterns:

- `~/src/user-service/src/middleware/auth.js` -- `verifyToken(req, res, next)`
- `~/src/user-service/src/middleware/roles.js` -- `checkRole(roles)`
- `~/src/user-service/src/middleware/rateLimit.js` -- `rateLimitByUser()`
- `~/src/order-service/src/middleware/auth.js` -- `verifyToken(req, res, next)` with `onError` callback
- `~/src/order-service/src/middleware/roles.js`
- `~/src/order-service/src/middleware/rateLimit.js`
- `~/src/notification-service/src/middleware/auth.js` -- `verifyToken` + `refreshTokenIfExpiring()`
- `~/src/notification-service/src/middleware/roles.js`
- `~/src/notification-service/src/middleware/rateLimit.js`

### 1.2 Identify divergences to resolve

Specific questions to answer from the audit:

1. **`req.user` shape:** Does every service attach `{ userId, email, roles }` or are there extra fields? If notification-service attaches `tokenExp` for refresh logic, the shared type should include it.
2. **Error response format:** Does user-service return `{ error: "Unauthorized" }` while order-service returns `{ code: "AUTH_FAILED", message: "..." }`? The shared package needs a consistent default with override capability.
3. **Redis key prefix:** If user-service uses `ratelimit:user:` and order-service uses `rl:order:`, the shared package must accept a configurable prefix.
4. **Token refresh mechanics:** How does notification-service's `refreshTokenIfExpiring()` work? Does it sign a new token and set a response header? Does it need the JWT secret for signing (not just verification)?

### 1.3 Design decisions

Based on the audit, lock in these decisions before coding:

- **Options pattern for `verifyToken`:** Accept an optional config object for `onError`, `tokenExtractor`, and `userMapper` -- this covers order-service's custom error callback without polluting the default path.
- **`refreshTokenIfExpiring` as a separate middleware:** Not baked into `verifyToken`. It runs after `verifyToken` and depends on `req.user` being populated. This keeps it opt-in for notification-service without affecting the others.
- **TypeScript from day one:** The shared package is TypeScript with declaration files. The consuming services can stay JS -- they get type hints through the `.d.ts` files.

No commit for this phase -- it is research only.

---

## Phase 2: Build the Shared Package

**Intent:** Create `@company/auth-middleware` with the unified API surface. The package must handle all three services' needs through configuration, not forks. Every public function gets exported types and JSDoc.

### 2.1 Initialize the package

```bash
mkdir -p ~/src/auth-middleware/{src,tests}
cd ~/src/auth-middleware
npm init -y --scope=@company
```

**File: `~/src/auth-middleware/package.json`**

```json
{
  "name": "@company/auth-middleware",
  "version": "1.0.0",
  "description": "Shared JWT auth middleware for Express services",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "jest --coverage",
    "prepublishOnly": "npm run build && npm test"
  },
  "publishConfig": {
    "registry": "https://registry.company.internal"
  },
  "peerDependencies": {
    "express": "^4.18.0"
  },
  "dependencies": {
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.0",
    "@types/jsonwebtoken": "^9.0.0",
    "express": "^4.18.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.3.0"
  }
}
```

Note: `express-rate-limit` is NOT a dependency. The rate limiting middleware wraps whatever Redis client the consumer passes in, using raw Redis commands (`INCR`, `EXPIRE`, `TTL`). This avoids coupling to `express-rate-limit`'s API and gives us control over the key schema and response format.

**File: `~/src/auth-middleware/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 2.2 Define shared types

**File: `~/src/auth-middleware/src/types.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  userId: string;
  email: string;
  roles: string[];
  /** Raw decoded token payload -- consumers can access additional claims here */
  tokenPayload: Record<string, unknown>;
  /** Token expiration timestamp (seconds since epoch) */
  exp: number;
  /** Token issued-at timestamp (seconds since epoch) */
  iat: number;
}

export interface VerifyTokenOptions {
  /** JWT secret. Defaults to process.env.JWT_SECRET */
  secret?: string;
  /** Extract token from request. Defaults to Authorization Bearer header */
  tokenExtractor?: (req: Request) => string | null;
  /** Map decoded payload to AuthUser. Defaults to standard mapping */
  userMapper?: (payload: Record<string, unknown>) => AuthUser;
  /** Custom error handler. Defaults to res.status(401).json({ error: '...' }) */
  onError?: (err: Error, req: Request, res: Response, next: NextFunction) => void;
  /** Algorithms to accept. Defaults to ['HS256'] */
  algorithms?: string[];
}

export interface CheckRoleOptions {
  /** Custom error handler for forbidden responses */
  onForbidden?: (req: Request, res: Response, next: NextFunction) => void;
}

export interface RateLimitOptions {
  /** Redis client instance -- must support get/incr/expire commands */
  redisClient: RedisLike;
  /** Time window in milliseconds. Default: 60000 (1 minute) */
  windowMs?: number;
  /** Max requests per window. Default: 100 */
  max?: number;
  /** Key prefix in Redis. Default: 'ratelimit:' */
  keyPrefix?: string;
  /** Extract rate limit key from request. Default: req.user?.userId || req.ip */
  keyGenerator?: (req: Request) => string;
  /** Custom handler when limit exceeded. Default: 429 with Retry-After header */
  onLimitReached?: (req: Request, res: Response, next: NextFunction, retryAfterMs: number) => void;
}

export interface RefreshTokenOptions {
  /** JWT secret for signing the new token. Defaults to process.env.JWT_SECRET */
  secret?: string;
  /** Threshold in seconds before expiry to trigger refresh. Default: 300 (5 minutes) */
  refreshThresholdSeconds?: number;
  /** Response header name for the refreshed token. Default: 'X-Refreshed-Token' */
  headerName?: string;
  /** Token TTL in seconds for the new token. Default: 3600 (1 hour) */
  tokenTtlSeconds?: number;
}

/** Minimal Redis interface -- compatible with ioredis, node-redis, etc. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}
```

The `AuthUser` type includes `exp` and `iat` because notification-service needs `exp` for refresh logic. Including it in the base type means all services get it for free without notification-service needing a separate type.

### 2.3 Implement `verifyToken`

**File: `~/src/auth-middleware/src/verifyToken.ts`**

```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AuthUser, VerifyTokenOptions } from './types';

const defaultTokenExtractor = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
};

const defaultUserMapper = (payload: Record<string, unknown>): AuthUser => ({
  userId: payload.sub as string || payload.userId as string,
  email: payload.email as string,
  roles: (payload.roles as string[]) || [],
  tokenPayload: payload,
  exp: payload.exp as number,
  iat: payload.iat as number,
});

const defaultOnError = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isExpired = err.name === 'TokenExpiredError';
  res.status(401).json({
    error: isExpired ? 'Token expired' : 'Invalid token',
    code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
  });
};

export function verifyToken(options: VerifyTokenOptions = {}) {
  const {
    secret = process.env.JWT_SECRET,
    tokenExtractor = defaultTokenExtractor,
    userMapper = defaultUserMapper,
    onError = defaultOnError,
    algorithms = ['HS256'],
  } = options;

  if (!secret) {
    throw new Error(
      '@company/auth-middleware: JWT secret is required. '
      + 'Pass it via options.secret or set JWT_SECRET env var.',
    );
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const token = tokenExtractor(req);
    if (!token) {
      onError(new Error('No token provided'), req, res, next);
      return;
    }

    try {
      const decoded = jwt.verify(token, secret, { algorithms }) as Record<string, unknown>;
      (req as any).user = userMapper(decoded);
      next();
    } catch (err) {
      onError(err as Error, req, res, next);
    }
  };
}
```

Key design choices:
- **Factory function** that returns middleware, not a bare middleware function. This lets order-service pass `onError` at configuration time rather than per-request.
- **Secret validation at startup:** The `throw` on missing secret happens when the middleware is created (app startup), not on every request. Fail fast.
- **`(req as any).user`:** We avoid module augmentation of Express `Request` in the library to prevent conflicts with consumers who have their own `req.user` augmentation. Consumers can do their own `declare global` if they want type safety on `req.user`.

### 2.4 Implement `checkRole`

**File: `~/src/auth-middleware/src/checkRole.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthUser, CheckRoleOptions } from './types';

export function checkRole(allowedRoles: string[], options: CheckRoleOptions = {}) {
  const { onForbidden } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthUser | undefined;

    if (!user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const hasRole = user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      if (onForbidden) {
        onForbidden(req, res, next);
        return;
      }
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles,
      });
      return;
    }

    next();
  };
}
```

### 2.5 Implement `rateLimitByUser`

**File: `~/src/auth-middleware/src/rateLimitByUser.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthUser, RateLimitOptions } from './types';

const defaultKeyGenerator = (req: Request): string => {
  const user = (req as any).user as AuthUser | undefined;
  return user?.userId || req.ip || 'anonymous';
};

export function rateLimitByUser(options: RateLimitOptions) {
  const {
    redisClient,
    windowMs = 60_000,
    max = 100,
    keyPrefix = 'ratelimit:',
    keyGenerator = defaultKeyGenerator,
    onLimitReached,
  } = options;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `${keyPrefix}${keyGenerator(req)}`;

    try {
      const current = await redisClient.incr(key);

      // Set expiry on first request in window
      if (current === 1) {
        await redisClient.expire(key, windowSeconds);
      }

      // Always set rate limit headers
      const ttl = await redisClient.ttl(key);
      const remaining = Math.max(0, max - current);
      res.set({
        'X-RateLimit-Limit': String(max),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + Math.max(0, ttl)),
      });

      if (current > max) {
        const retryAfterMs = Math.max(0, ttl) * 1000;
        if (onLimitReached) {
          onLimitReached(req, res, next, retryAfterMs);
          return;
        }
        res.set('Retry-After', String(Math.max(0, ttl)));
        res.status(429).json({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          retryAfterSeconds: Math.max(0, ttl),
        });
        return;
      }

      next();
    } catch (err) {
      // Redis failure should not block requests -- fail open
      console.error('@company/auth-middleware: rate limit Redis error', err);
      next();
    }
  };
}
```

Important: This fails open on Redis errors. A Redis outage should not take down the API -- rate limiting is a protection mechanism, not a gating requirement.

### 2.6 Implement `refreshTokenIfExpiring`

**File: `~/src/auth-middleware/src/refreshTokenIfExpiring.ts`**

```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AuthUser, RefreshTokenOptions } from './types';

export function refreshTokenIfExpiring(options: RefreshTokenOptions = {}) {
  const {
    secret = process.env.JWT_SECRET,
    refreshThresholdSeconds = 300,
    headerName = 'X-Refreshed-Token',
    tokenTtlSeconds = 3600,
  } = options;

  if (!secret) {
    throw new Error(
      '@company/auth-middleware: JWT secret is required for token refresh. '
      + 'Pass it via options.secret or set JWT_SECRET env var.',
    );
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthUser | undefined;

    if (!user?.exp) {
      next();
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const secondsUntilExpiry = user.exp - nowSeconds;

    if (secondsUntilExpiry > 0 && secondsUntilExpiry <= refreshThresholdSeconds) {
      // Token is valid but approaching expiry -- issue a fresh one
      const { tokenPayload } = user;
      // Strip old timing claims; jwt.sign will set new ones
      const { exp, iat, nbf, ...claims } = tokenPayload;

      const newToken = jwt.sign(claims, secret, {
        expiresIn: tokenTtlSeconds,
        algorithm: 'HS256',
      });

      res.set(headerName, newToken);
    }

    next();
  };
}
```

This middleware must run AFTER `verifyToken` -- it depends on `req.user` being populated. It sets a response header with the fresh token; the client is responsible for picking it up and using it for subsequent requests. This is a non-breaking approach: clients that don't know about the header simply ignore it and eventually re-authenticate normally.

### 2.7 Package entry point

**File: `~/src/auth-middleware/src/index.ts`**

```typescript
export { verifyToken } from './verifyToken';
export { checkRole } from './checkRole';
export { rateLimitByUser } from './rateLimitByUser';
export { refreshTokenIfExpiring } from './refreshTokenIfExpiring';

export type {
  AuthUser,
  VerifyTokenOptions,
  CheckRoleOptions,
  RateLimitOptions,
  RefreshTokenOptions,
  RedisLike,
} from './types';
```

### 2.8 Add `.npmrc` for registry

**File: `~/src/auth-middleware/.npmrc`**

```
@company:registry=https://registry.company.internal
```

### 2.9 Commit

```bash
git -C ~/src/auth-middleware add .
git -C ~/src/auth-middleware commit -m "feat: initial @company/auth-middleware package

Unified JWT verification, RBAC, rate limiting, and token refresh
middleware extracted from user-service, order-service, and
notification-service."
```

---

## Phase 3: Tests for the Shared Package

**Intent:** Comprehensive tests for every middleware function, covering the happy paths, error paths, and the configuration variants that each consuming service relies on. Tests must cover the specific features order-service and notification-service need, not just the defaults.

### 3.1 Test configuration

**File: `~/src/auth-middleware/jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { branches: 90, functions: 95, lines: 95, statements: 95 },
  },
};

export default config;
```

### 3.2 Test helper: Express app fixture

**File: `~/src/auth-middleware/tests/helpers.ts`**

```typescript
import express from 'express';
import jwt from 'jsonwebtoken';

export const TEST_SECRET = 'test-jwt-secret-do-not-use-in-prod';

export function createTestApp() {
  const app = express();
  app.use(express.json());
  return app;
}

export function signToken(
  payload: Record<string, unknown>,
  options: jwt.SignOptions = {},
): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h', ...options });
}

export function signExpiredToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '-1s' });
}

export function signExpiringToken(
  payload: Record<string, unknown>,
  secondsUntilExpiry: number,
): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: secondsUntilExpiry });
}

/** Mock Redis client for rate limit tests */
export function createMockRedis() {
  const store = new Map<string, { value: number; ttl: number }>();

  return {
    _store: store,
    get: jest.fn(async (key: string) => {
      const entry = store.get(key);
      return entry ? String(entry.value) : null;
    }),
    incr: jest.fn(async (key: string) => {
      const entry = store.get(key) || { value: 0, ttl: -1 };
      entry.value += 1;
      store.set(key, entry);
      return entry.value;
    }),
    expire: jest.fn(async (key: string, seconds: number) => {
      const entry = store.get(key);
      if (entry) entry.ttl = seconds;
      return 1;
    }),
    ttl: jest.fn(async (key: string) => {
      const entry = store.get(key);
      return entry?.ttl ?? -2;
    }),
  };
}
```

### 3.3 `verifyToken` tests

**File: `~/src/auth-middleware/tests/verifyToken.test.ts`**

Test cases:
- Valid token: attaches `req.user` with correct `userId`, `email`, `roles`, `exp`, `iat`
- Missing `Authorization` header: returns 401 with `{ code: 'INVALID_TOKEN' }`
- Malformed header (no `Bearer` prefix): returns 401
- Expired token: returns 401 with `{ code: 'TOKEN_EXPIRED' }`
- Invalid signature (signed with wrong secret): returns 401
- Custom `onError` callback: called with the error, does NOT send default 401 (this is the order-service case)
- Custom `tokenExtractor`: reads token from a custom header or query param
- Custom `userMapper`: remaps claims to a different shape
- Missing `JWT_SECRET` env var and no `options.secret`: throws at middleware creation time, not at request time

### 3.4 `checkRole` tests

**File: `~/src/auth-middleware/tests/checkRole.test.ts`**

Test cases:
- User has matching role: calls `next()`
- User has one of multiple allowed roles: calls `next()`
- User has no matching role: returns 403
- No `req.user` (middleware used without `verifyToken` first): returns 401
- Empty roles array on user: returns 403
- Custom `onForbidden` handler: called instead of default 403

### 3.5 `rateLimitByUser` tests

**File: `~/src/auth-middleware/tests/rateLimitByUser.test.ts`**

Test cases:
- Under limit: request passes, `X-RateLimit-Remaining` header decrements correctly
- At limit (request N of N): still passes, remaining shows 0
- Over limit: returns 429 with `Retry-After` header
- Custom `keyGenerator`: uses the returned key (e.g., per-endpoint limiting)
- Custom `onLimitReached`: called instead of default 429
- Custom `keyPrefix`: Redis key includes the prefix
- Redis error: request passes through (fail-open), error logged
- Unauthenticated request: falls back to `req.ip` for rate limit key

### 3.6 `refreshTokenIfExpiring` tests

**File: `~/src/auth-middleware/tests/refreshTokenIfExpiring.test.ts`**

Test cases:
- Token with 4 minutes remaining (under 5min threshold): response includes `X-Refreshed-Token` header with a valid, freshly-signed JWT
- Token with 30 minutes remaining (above threshold): no refresh header set
- Token with 0 seconds remaining but not yet expired: refresh header set
- No `req.user` (used without `verifyToken`): passes through, no error
- Custom `refreshThresholdSeconds`: respects the override
- Custom `headerName`: uses the specified header
- New token preserves original claims (`sub`, `email`, `roles`) but has new `exp`/`iat`

### 3.7 Run tests and build

```bash
cd ~/src/auth-middleware
npm install
npm test
npm run build
```

Verify:
- All tests pass with >95% coverage
- `dist/` contains `.js`, `.d.ts`, and `.d.ts.map` files
- `dist/index.d.ts` exports all public types

### 3.8 Commit

```bash
git -C ~/src/auth-middleware add .
git -C ~/src/auth-middleware commit -m "test: add comprehensive tests for all middleware functions"
```

---

## Phase 4: Publish and Migrate user-service

**Intent:** Publish the package and migrate the simplest consumer first. user-service's auth code is closest to the shared package's defaults, so it serves as the baseline validation that the shared package works correctly before touching the trickier services.

### 4.1 Publish v1.0.0

```bash
cd ~/src/auth-middleware
npm publish
```

Verify it is available:

```bash
npm view @company/auth-middleware --registry=https://registry.company.internal
```

### 4.2 Install in user-service

```bash
cd ~/src/user-service
echo "@company:registry=https://registry.company.internal" >> .npmrc
npm install @company/auth-middleware
```

### 4.3 Replace auth middleware

**File: `~/src/user-service/src/middleware/auth.js`** -- DELETE this file.

**File: `~/src/user-service/src/routes/users.js`** -- Update imports:

```javascript
// Before:
const { verifyToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/roles');

// After:
const { verifyToken, checkRole } = require('@company/auth-middleware');
```

**File: `~/src/user-service/src/routes/admin.js`** -- Same import change.

The middleware invocation changes slightly because the shared package uses factory functions:

```javascript
// Before (user-service's local version):
router.get('/profile', verifyToken, (req, res) => { ... });
router.get('/admin/users', verifyToken, checkRole(['admin']), (req, res) => { ... });

// After:
const auth = verifyToken(); // no options needed -- defaults match user-service's behavior
const adminOnly = checkRole(['admin']);

router.get('/profile', auth, (req, res) => { ... });
router.get('/admin/users', auth, adminOnly, (req, res) => { ... });
```

### 4.4 Replace rate limiting

**File: `~/src/user-service/src/middleware/rateLimit.js`** -- DELETE this file.

**File: `~/src/user-service/src/app.js`** -- Update rate limiting setup:

```javascript
// Before:
const { rateLimitByUser } = require('./middleware/rateLimit');
app.use('/api', rateLimitByUser);

// After:
const { rateLimitByUser } = require('@company/auth-middleware');
const redisClient = require('./lib/redis'); // existing Redis client

app.use('/api', rateLimitByUser({
  redisClient,
  windowMs: 60_000,
  max: 100,
  keyPrefix: 'ratelimit:user-svc:',
}));
```

### 4.5 Delete local middleware and clean up dependencies

```bash
rm ~/src/user-service/src/middleware/auth.js
rm ~/src/user-service/src/middleware/roles.js
rm ~/src/user-service/src/middleware/rateLimit.js
```

Check if the `middleware/` directory has other files. If `auth.js`, `roles.js`, and `rateLimit.js` were the only contents, delete the directory. If there are other middleware files (e.g., `cors.js`, `logging.js`), leave the directory.

Remove `jsonwebtoken` from user-service's direct dependencies ONLY if no other code in user-service imports it directly (e.g., the login route that signs tokens still needs it -- only the verification side moved to the shared package):

```bash
# Check first:
grep -r "require.*jsonwebtoken" ~/src/user-service/src/ --include="*.js"
# If only middleware/auth.js used it (now deleted), then:
npm uninstall jsonwebtoken
# If login/signup routes sign tokens, keep it.
```

Similarly for `express-rate-limit` -- remove if no longer used directly.

### 4.6 Run tests

```bash
cd ~/src/user-service
npm test
```

Fix any failures. The most likely issue: test files that imported directly from `../middleware/auth` need their imports updated. Also check for any test that mocked `jsonwebtoken` at the middleware level -- those mocks need to target `@company/auth-middleware`'s internal usage now or be rewritten to use the `signToken` helper pattern.

### 4.7 Commit

```bash
git -C ~/src/user-service add -A
git -C ~/src/user-service commit -m "refactor: replace local auth middleware with @company/auth-middleware

Removes duplicated JWT verification, role checking, and rate limiting
middleware in favor of the shared package. No behavior change."
```

---

## Phase 5: Migrate order-service

**Intent:** order-service has a custom `onError` callback in its `verifyToken` usage. This is the first real test that the options pattern in the shared package handles a non-default configuration correctly.

### 5.1 Install

```bash
cd ~/src/order-service
echo "@company:registry=https://registry.company.internal" >> .npmrc
npm install @company/auth-middleware
```

### 5.2 Identify the custom error handler

Read `~/src/order-service/src/middleware/auth.js` and extract the `onError` logic. It likely looks something like:

```javascript
// order-service's current custom behavior
function verifyToken(req, res, next, onError) {
  // ... verification logic ...
  if (err) {
    if (onError) return onError(err, req, res, next);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
```

The calling code in `~/src/order-service/src/routes/webhooks.js` probably passes a callback that logs the error differently or returns a different status code for webhook callers.

### 5.3 Replace with shared package using `onError` option

**File: `~/src/order-service/src/routes/orders.js`** -- Standard routes use default error handling:

```javascript
const { verifyToken, checkRole } = require('@company/auth-middleware');

const auth = verifyToken(); // defaults
const managerOnly = checkRole(['manager', 'admin']);

router.get('/orders', auth, (req, res) => { ... });
router.post('/orders', auth, (req, res) => { ... });
router.delete('/orders/:id', auth, managerOnly, (req, res) => { ... });
```

**File: `~/src/order-service/src/routes/webhooks.js`** -- Webhook routes use custom error handling:

```javascript
const { verifyToken } = require('@company/auth-middleware');

// Webhook-specific: log and return 200 (webhooks should not retry on auth failures)
const webhookAuth = verifyToken({
  onError: (err, req, res, next) => {
    console.error(`Webhook auth failed for ${req.path}:`, err.message);
    res.status(200).json({
      received: true,
      processed: false,
      reason: 'auth_failed',
    });
  },
});

router.post('/webhooks/payment', webhookAuth, (req, res) => { ... });
router.post('/webhooks/shipping', webhookAuth, (req, res) => { ... });
```

### 5.4 Replace rate limiting and delete local files

Same pattern as user-service (Phase 4.4-4.5), with order-service-specific key prefix:

```javascript
app.use('/api', rateLimitByUser({
  redisClient,
  windowMs: 60_000,
  max: 200, // order-service may have different limits
  keyPrefix: 'ratelimit:order-svc:',
}));
```

Delete:
```bash
rm ~/src/order-service/src/middleware/auth.js
rm ~/src/order-service/src/middleware/roles.js
rm ~/src/order-service/src/middleware/rateLimit.js
```

### 5.5 Run tests

```bash
cd ~/src/order-service
npm test
```

Pay special attention to webhook route tests -- they should verify that auth failures still return 200 (not 401) with the `{ processed: false }` response.

### 5.6 Commit

```bash
git -C ~/src/order-service add -A
git -C ~/src/order-service commit -m "refactor: replace local auth middleware with @company/auth-middleware

Uses onError option for webhook routes to preserve custom error
handling behavior. No behavior change."
```

---

## Phase 6: Migrate notification-service

**Intent:** notification-service is the trickiest migration because it uses `refreshTokenIfExpiring()` -- a feature the other services don't have. This phase validates that the shared package's token refresh middleware works correctly in production-like conditions.

### 6.1 Install

```bash
cd ~/src/notification-service
echo "@company:registry=https://registry.company.internal" >> .npmrc
npm install @company/auth-middleware
```

### 6.2 Replace standard middleware and add token refresh

**File: `~/src/notification-service/src/routes/notifications.js`**

```javascript
const {
  verifyToken,
  checkRole,
  refreshTokenIfExpiring,
} = require('@company/auth-middleware');

const auth = verifyToken();
const refresh = refreshTokenIfExpiring({
  refreshThresholdSeconds: 300, // 5 minutes, matching current behavior
  tokenTtlSeconds: 3600,       // 1 hour
});

// Apply both: verify first, then refresh if needed
router.use(auth, refresh);

router.get('/notifications', (req, res) => { ... });
router.post('/notifications/mark-read', (req, res) => { ... });
```

**File: `~/src/notification-service/src/routes/preferences.js`** -- Same pattern.

### 6.3 Verify token refresh behavior

The critical thing to test: when a request comes in with a token that expires in 4 minutes, the response must include the `X-Refreshed-Token` header, and that header must contain a valid JWT with:
- Same `sub`, `email`, `roles` as the original
- New `exp` set to now + 3600s
- New `iat` set to now

Notification-service's existing tests should already cover this behavior. Update them to check the response header instead of whatever mechanism the old local middleware used.

### 6.4 Verify client-side handling

Check `~/src/notification-service/src/` for any client-facing code (WebSocket handlers, SSE endpoints) that might be reading the refreshed token from `res.locals` or some other mechanism instead of a response header. If the old implementation stored the refreshed token differently than via response header, the clients need updating too -- but that is out of scope for this plan (flag it and handle as a follow-up).

### 6.5 Delete local files and clean up

```bash
rm ~/src/notification-service/src/middleware/auth.js
rm ~/src/notification-service/src/middleware/roles.js
rm ~/src/notification-service/src/middleware/rateLimit.js
```

### 6.6 Run tests

```bash
cd ~/src/notification-service
npm test
```

### 6.7 Commit

```bash
git -C ~/src/notification-service add -A
git -C ~/src/notification-service commit -m "refactor: replace local auth middleware with @company/auth-middleware

Uses refreshTokenIfExpiring middleware for auto-refresh within 5min
of token expiry. No behavior change."
```

---

## Phase 7: End-to-End Verification

**Intent:** Validate the complete auth flow across all three services to catch any integration issues that per-service unit tests would miss -- particularly around token format assumptions, Redis key collisions, and refresh token interop.

### 7.1 Per-service smoke tests

Run each service locally and hit their protected endpoints:

```bash
# Get a token from user-service
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@company.com","password":"testpass"}' \
  | jq -r '.token')

# Use it on user-service
curl -s http://localhost:3001/api/profile -H "Authorization: Bearer $TOKEN"
# Expected: 200 with user profile

# Use the same token on order-service
curl -s http://localhost:3002/api/orders -H "Authorization: Bearer $TOKEN"
# Expected: 200 with orders list

# Use it on notification-service
curl -sv http://localhost:3003/api/notifications \
  -H "Authorization: Bearer $TOKEN" 2>&1 | grep X-Refreshed-Token
# Expected: 200 with notifications. If token near expiry, X-Refreshed-Token header present.
```

### 7.2 Error behavior validation

```bash
# No token
curl -s http://localhost:3001/api/profile
# Expected: 401 { "code": "INVALID_TOKEN" }

# Expired token
curl -s http://localhost:3001/api/profile -H "Authorization: Bearer eyJ..."
# Expected: 401 { "code": "TOKEN_EXPIRED" }

# Wrong role
curl -s http://localhost:3001/api/admin/users -H "Authorization: Bearer $TOKEN"
# Expected: 403 { "code": "FORBIDDEN" } (assuming test user is not admin)

# Order-service webhook with bad token
curl -s -X POST http://localhost:3002/api/webhooks/payment \
  -H "Authorization: Bearer invalid" \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.completed"}'
# Expected: 200 { "processed": false, "reason": "auth_failed" }
```

### 7.3 Rate limiting validation

```bash
# Hit the rate limit on user-service
for i in $(seq 1 105); do
  curl -s -o /dev/null -w "%{http_code} " \
    http://localhost:3001/api/profile \
    -H "Authorization: Bearer $TOKEN"
done
# Expected: first 100 return 200, last 5 return 429

# Verify order-service has independent rate limits (different key prefix)
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3002/api/orders \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 (order-service limit not exhausted by user-service calls)
```

### 7.4 Redis key isolation check

```bash
redis-cli KEYS "ratelimit:*"
# Expected: keys prefixed with ratelimit:user-svc: and ratelimit:order-svc:
# No collision between services
```

### 7.5 Token refresh integration test

```bash
# Sign a token expiring in 3 minutes
SHORT_TOKEN=$(node -e "
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { sub: 'user123', email: 'test@company.com', roles: ['user'] },
    process.env.JWT_SECRET,
    { expiresIn: '3m' }
  );
  console.log(token);
")

# Hit notification-service -- should get refreshed token
curl -sv http://localhost:3003/api/notifications \
  -H "Authorization: Bearer $SHORT_TOKEN" 2>&1 \
  | grep -i "X-Refreshed-Token"
# Expected: header present with new valid token

# Hit user-service with same short token -- should NOT get refreshed token
curl -sv http://localhost:3001/api/profile \
  -H "Authorization: Bearer $SHORT_TOKEN" 2>&1 \
  | grep -i "X-Refreshed-Token"
# Expected: no such header (user-service does not use refreshTokenIfExpiring)
```

---

## Risks and Mitigations

- **Error response format mismatch:** The shared package returns `{ error, code }` format. If any service's frontend or API clients parse a different format (e.g., `{ message, statusCode }`), those clients will break. Mitigation: audit the response format each service currently returns in Phase 1 and configure `onError`/`onForbidden` overrides to match if needed during migration.

- **`req.user` shape change:** If the shared `AuthUser` type adds fields (`exp`, `iat`, `tokenPayload`) that the old local middleware did not attach, code that spreads `req.user` into database queries could insert unexpected columns. Mitigation: search each service for `...req.user` or `Object.keys(req.user)` patterns and ensure they destructure only the fields they need.

- **Token signing vs. verification secret divergence:** `refreshTokenIfExpiring` signs new tokens. If any service uses asymmetric keys (RS256) for verification but the shared package defaults to HS256, refresh will produce tokens the other services cannot verify. Mitigation: Phase 1 audit must confirm all services use the same algorithm and secret.

- **Rate limit key migration:** If existing services have active rate limit counters in Redis under different key prefixes, switching to new prefixes resets all counters. This is usually fine (brief window of no rate limiting), but if it matters, keep the old prefix via the `keyPrefix` option during migration and change it later.

- **Version coupling across services:** All three services now depend on `@company/auth-middleware`. A breaking change to the package requires coordinated updates. Mitigation: use semver strictly, pin to `^1.x.x` in consumers, and never make breaking changes without a major version bump. Add a `CHANGELOG.md` to the package repo.

## Follow-up Work (Out of Scope)

- Add `@company/auth-middleware` to a CI pipeline with automated publish on merge to main
- Add integration test fixtures to the shared package that consumers can import for their own testing
- Consider adding `verifyApiKey()` middleware for service-to-service auth (currently each service has its own)
- If notification-service's client reads refresh tokens from somewhere other than the `X-Refreshed-Token` header, coordinate that client-side change separately
