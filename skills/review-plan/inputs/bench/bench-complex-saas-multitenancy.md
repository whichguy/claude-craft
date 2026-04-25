# Plan Title: Multi-tenant SaaS with PostgreSQL Row-Level Security (RLS)

## Context
This project aims to build a robust multi-tenant SaaS foundation using Node.js, TypeScript, and Prisma. Unlike application-level isolation (e.g., `where: { tenantId }` in every query), this architecture uses **PostgreSQL Row-Level Security (RLS)** to ensure that one tenant can never access another's data, even if the application code has a bug. It includes dynamic subdomain routing for tenant identification and Stripe integration for subscription management.

## Git Setup
1. Initialize the repository: `git init`.
2. Create `.gitignore` for Node.js, Prisma, and `.env`.
3. Create an initial commit with the project scaffolding.
4. Use a branching strategy: `main` for stable, `develop` for integration, and `feature/*` for individual phases.

## Implementation Steps

### Phase 1: Database Schema & RLS Foundation
**Intent:** Define the core schema and implement the SQL-level RLS policies that Prisma cannot manage natively.

**Files:**
- `prisma/schema.prisma`
- `prisma/migrations/01_rls_setup.sql`

**Code Block (Schema):**
```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Tenant {
  id         String   @id @default(uuid())
  name       String
  slug       String   @unique // Used for subdomains
  stripeId   String?  @unique
  createdAt  DateTime @default(now())
  users      User[]
  projects   Project[]
}

model User {
  id       String @id @default(uuid())
  email    String @unique
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])
}

model Project {
  id       String @id @default(uuid())
  name     String
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])
}
```

**Code Block (RLS Migration):**
```sql
-- prisma/migrations/01_rls_setup.sql
-- Enable RLS on Tenant-specific tables
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows access based on a session variable
CREATE POLICY tenant_isolation_policy ON "Project"
USING ("tenantId" = current_setting('app.current_tenant_id'));
```

### Phase 2: Backend Infrastructure & RLS Middleware
**Intent:** Create a Prisma client wrapper that sets the PostgreSQL session variable `app.current_tenant_id` before executing queries.

**Files:**
- `src/lib/prisma.ts`
- `src/middleware/tenantContext.ts`

**Code Block (Prisma RLS Wrapper):**
```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

export const getTenantPrisma = (tenantId: string) => {
  const prisma = new PrismaClient();
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // Use a transaction to set the local variable for the session
          return prisma.$transaction([
            prisma.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}';`),
            query(args),
          ]).then(res => res[1]);
        },
      },
    },
  });
};
```

### Phase 3: Dynamic Subdomain Routing
**Intent:** Detect the tenant slug from the request URL and attach the tenant ID to the request context.

**Files:**
- `src/middleware/subdomain.ts`

**Code Block (Subdomain Middleware):**
```typescript
// src/middleware/subdomain.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma-root';

export const subdomainMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];
  
  if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
    const tenant = await prisma.tenant.findUnique({ where: { slug: subdomain } });
    if (tenant) {
      req.tenantId = tenant.id;
      return next();
    }
  }
  res.status(404).send('Tenant not found');
};
```

### Phase 4: Stripe Multi-tenant Integration
**Intent:** Sync tenant subscription status with Stripe and handle webhooks.

**Files:**
- `src/lib/stripe.ts`
- `src/api/webhooks/stripe.ts`

**Code Block (Stripe Subscription Flow):**
```typescript
// src/lib/stripe.ts
export const createCheckoutSession = async (tenantId: string, stripeCustomerId: string) => {
  return stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `https://${tenantSlug}.example.com/dashboard`,
    cancel_url: `https://${tenantSlug}.example.com/settings`,
    metadata: { tenantId },
  });
};
```

### Phase 5: Tenant Onboarding & Dashboard
**Intent:** Create a landing page to register new tenants and a dashboard that displays only the tenant's data.

## Verification
- **Unit Testing:** Verify `getTenantPrisma` correctly injects the `SET LOCAL` command.
- **Integration Testing:** Attempt to query `Project` table with a `tenantId` session variable and confirm that only matching rows are returned.
- **Security Audit:** Manually run SQL queries as the application user to ensure RLS blocks cross-tenant access.
- **E2E Testing:** Use tools like Playwright to simulate multi-tenant flows (tenant1.localhost, tenant2.localhost).

## Risks and Mitigations
- **Risk:** Prisma Connection Pooling and `SET LOCAL`. `SET LOCAL` only lasts for a transaction. If not using transactions, session variables might leak or persist incorrectly.
  - **Mitigation:** Always use `$transaction` or `$extends` with transaction-scoped session variables as shown in Phase 2.
- **Risk:** Subdomain SSL certificates.
  - **Mitigation:** Use a wildcard SSL certificate (*.example.com) or a proxy like Caddy/Nginx that automates Let's Encrypt for subdomains.
- **Risk:** Stripe Webhook Latency.
  - **Mitigation:** Implement idempotent webhook handlers and a "Pending" state in the UI while waiting for Stripe confirmation.
