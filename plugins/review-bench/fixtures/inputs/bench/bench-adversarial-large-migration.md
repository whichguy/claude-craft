# Plan: Migrate Monolith to Microservices Architecture

## Context

We will migrate our Node.js/Express monolith application to a microservices architecture by extracting five services: user service, order service, payment service, notification service, and analytics service. Each service will have its own database, API endpoints, and deployment pipeline. The migration will use feature flags to maintain the monolith's operation during the transition.

**Current Architecture:**
- Single Express application at `/src/app.js`
- PostgreSQL database with tables: users, orders, payments, notifications, analytics_events
- Routes in `/src/routes/` (users.js, orders.js, payments.js, notifications.js, analytics.js)
- Shared business logic in `/src/services/`
- Single `package.json` and deployment process

**Target Architecture:**
- Five independent services, each with Express app, database, Docker container
- API Gateway for routing and authentication
- Service mesh for inter-service communication
- Feature flags via LaunchDarkly
- Separate CI/CD pipelines per service

## Git Setup

**Branch Strategy:** Create feature branch `feat/microservices-migration` from `main`

```bash
git checkout -b feat/microservices-migration
```

## Phase 1: Infrastructure Setup and Feature Flags

This phase establishes the foundational infrastructure needed for microservices migration. We'll set up the feature flag system, create the base directory structure for services, and configure Docker Compose for local development.

### Steps

1. Install LaunchDarkly SDK and create feature flag configuration
   - Add `launchdarkly-node-server-sdk` to package.json
   - Create `/src/config/feature-flags.js` with flag initialization
   - Define flags: `use_user_service`, `use_order_service`, `use_payment_service`, `use_notification_service`, `use_analytics_service`

2. Create base microservices directory structure
   - Create `/services/user-service/` with subdirs: src, tests, config
   - Create `/services/order-service/` with subdirs: src, tests, config
   - Create `/services/payment-service/` with subdirs: src, tests, config
   - Create `/services/notification-service/` with subdirs: src, tests, config
   - Create `/services/analytics-service/` with subdirs: src, tests, config

3. Set up Docker Compose for local development
   - Create `/docker-compose.yml` with service definitions for all five services
   - Configure network bridges for service-to-service communication
   - Add PostgreSQL containers for each service database
   - Add Redis for shared session/cache layer

4. Create shared utilities package
   - Create `/packages/shared-utils/` for common code (logging, error handling, auth middleware)
   - Add `/packages/shared-utils/src/logger.js`
   - Add `/packages/shared-utils/src/error-handler.js`
   - Add `/packages/shared-utils/src/auth-middleware.js`

5. Git commit
   ```bash
   git add docker-compose.yml src/config/feature-flags.js services/ packages/
   git commit -m "feat: set up microservices infrastructure and feature flags"
   ```

## Phase 2: Extract User Service

This phase extracts user management functionality into an independent service. We'll create a new database, migrate user-related routes and business logic, and implement feature flag routing in the monolith.

### Steps

1. Create user service application structure
   - Create `/services/user-service/src/app.js` with Express setup
   - Create `/services/user-service/src/routes/users.js`
   - Create `/services/user-service/src/routes/auth.js`
   - Create `/services/user-service/package.json` with dependencies: express, pg, bcrypt, jsonwebtoken

2. Set up user service database
   - Create `/services/user-service/migrations/001_create_users_table.sql`
   - Include schema: id, email, password_hash, first_name, last_name, created_at, updated_at
   - Add indexes on email for quick lookups
   - Create `/services/user-service/src/db/connection.js` for database pool

3. Migrate user business logic
   - Copy `/src/services/user-service.js` to `/services/user-service/src/services/user-service.js`
   - Copy `/src/services/auth-service.js` to `/services/user-service/src/services/auth-service.js`
   - Update database queries to use new connection pool
   - Add user CRUD endpoints: GET /users/:id, POST /users, PUT /users/:id, DELETE /users/:id
   - Add auth endpoints: POST /auth/login, POST /auth/register, POST /auth/refresh

4. Add feature flag routing in monolith
   - Update `/src/routes/users.js` to check `use_user_service` flag
   - If flag enabled, proxy requests to user service at `http://user-service:3001`
   - If flag disabled, use existing monolith logic
   - Add HTTP client configuration in `/src/config/service-clients.js`

5. Create user service Dockerfile
   - Create `/services/user-service/Dockerfile`
   - Multi-stage build: install deps, run tests, production image
   - Expose port 3001

6. Add data migration script
   - Create `/scripts/migrate-users-data.js` to copy users table from monolith DB to user service DB
   - Include rollback capability

7. Git commit
   ```bash
   git add services/user-service/ src/routes/users.js src/config/service-clients.js scripts/migrate-users-data.js
   git commit -m "feat: extract user service with feature flag routing"
   ```

## Phase 3: Extract Order Service

### Steps

1. Create order service application structure
   - Create `/services/order-service/src/app.js` with Express setup
   - Create `/services/order-service/src/routes/orders.js`
   - Create `/services/order-service/package.json` with dependencies: express, pg, uuid

2. Set up order service database
   - Create `/services/order-service/migrations/001_create_orders_table.sql`
   - Schema: id, user_id, status, total_amount, items (JSONB), created_at, updated_at
   - Add indexes on user_id and status
   - Create `/services/order-service/src/db/connection.js`

3. Migrate order business logic
   - Copy `/src/services/order-service.js` to `/services/order-service/src/services/order-service.js`
   - Update to call user service for user validation (remove direct user table queries)
   - Add endpoints: GET /orders, GET /orders/:id, POST /orders, PUT /orders/:id/status
   - Implement order state machine: pending → confirmed → shipped → delivered

4. Add feature flag routing in monolith
   - Update `/src/routes/orders.js` to check `use_order_service` flag
   - Proxy to `http://order-service:3002` when enabled
   - Create `/src/middleware/order-proxy.js` for request forwarding

5. Create order service Dockerfile
   - Create `/services/order-service/Dockerfile`
   - Expose port 3002

6. Add data migration script
   - Create `/scripts/migrate-orders-data.js`
   - Migrate orders table from monolith to order service DB

7. Git commit
   ```bash
   git add services/order-service/ src/routes/orders.js src/middleware/order-proxy.js scripts/migrate-orders-data.js
   git commit -m "feat: extract order service with independent database"
   ```

## Phase 4: Extract Payment Service

1. Create payment service application structure
   - Create `/services/payment-service/src/app.js`
   - Create `/services/payment-service/src/routes/payments.js`
   - Create `/services/payment-service/package.json` with dependencies: express, pg, stripe

2. Set up payment service database
   - Create `/services/payment-service/migrations/001_create_payments_table.sql`
   - Schema: id, order_id, user_id, amount, status, stripe_payment_id, created_at, updated_at
   - Add indexes on order_id and user_id

3. Migrate payment business logic
   - Copy `/src/services/payment-service.js` to `/services/payment-service/src/services/payment-service.js`
   - Update payment processing to query monolith users table directly via connection string: `postgresql://monolith-db:5432/monolith`
   - Add endpoints: POST /payments, GET /payments/:id, POST /payments/:id/refund
   - Integrate Stripe API for payment processing

4. Add feature flag routing in monolith
   - Update `/src/routes/payments.js` to check `use_payment_service` flag
   - Proxy to `http://payment-service:3003` when enabled

5. Create payment service Dockerfile
   - Create `/services/payment-service/Dockerfile`
   - Expose port 3003
   - Add environment variables for Stripe API keys

6. Add data migration script
   - Create `/scripts/migrate-payments-data.js`

7. Git commit
   ```bash
   git add services/payment-service/ src/routes/payments.js scripts/migrate-payments-data.js
   git commit -m "feat: extract payment service with Stripe integration"
   ```

## Phase 5: Extract Notification Service

This phase creates the notification service for sending emails, SMS, and push notifications. The service will consume events from other services and handle all external communication.

### Steps

1. Create notification service application structure
   - Create `/services/notification-service/src/app.js`
   - Create `/services/notification-service/src/routes/notifications.js`
   - Create `/services/notification-service/package.json` with dependencies: express, pg, nodemailer, twilio, firebase-admin

2. Set up notification service database
   - Create `/services/notification-service/migrations/001_create_notifications_table.sql`
   - Schema: id, user_id, type, channel, status, content (JSONB), sent_at, created_at
   - Add indexes on user_id and status

3. Migrate notification business logic
   - Copy `/src/services/notification-service.js` to `/services/notification-service/src/services/notification-service.js`
   - Update to fetch user contact info from user service API: `GET http://user-service:3001/users/:id`
   - Add notification templates in `/services/notification-service/src/templates/`
   - Implement email sender using nodemailer
   - Implement SMS sender using Twilio
   - Add endpoints: POST /notifications, GET /notifications/:id, GET /users/:userId/notifications

4. Add event-driven architecture
   - Create `/services/notification-service/src/consumers/order-events.js` to listen for order status changes
   - Create `/services/notification-service/src/consumers/payment-events.js` to listen for payment confirmations
   - Use RabbitMQ for event queue (add to docker-compose.yml)

5. Add feature flag routing in monolith
   - Update `/src/routes/notifications.js` to check `use_notification_service` flag
   - Proxy to `http://notification-service:3004` when enabled

6. Create notification service Dockerfile
   - Create `/services/notification-service/Dockerfile`
   - Expose port 3004

7. Git commit
   ```bash
   git add services/notification-service/ src/routes/notifications.js docker-compose.yml
   git commit -m "feat: extract notification service with event consumers"
   ```

## Phase 6: Extract Analytics Service and Set Up API Gateway

1. Create analytics service application
   - Create `/services/analytics-service/src/app.js`
   - Create `/services/analytics-service/src/routes/analytics.js`
   - Create `/services/analytics-service/package.json` with dependencies: express, pg, redis

2. Set up analytics service database
   - Create `/services/analytics-service/migrations/001_create_analytics_events_table.sql`
   - Schema: id, event_type, user_id, data (JSONB), timestamp
   - Use TimescaleDB extension for time-series optimization
   - Add hypertable on timestamp column

3. Migrate analytics logic
   - Copy `/src/services/analytics-service.js` to `/services/analytics-service/src/services/analytics-service.js`
   - Add endpoints: POST /events, GET /events, GET /analytics/dashboard
   - Implement aggregation queries for dashboard metrics

4. Create analytics service Dockerfile
   - Create `/services/analytics-service/Dockerfile`
   - Expose port 3005

5. Set up Kong API Gateway
   - Create `/api-gateway/kong.yml` configuration
   - Define routes for all services:
     - `/api/users/*` → `http://user-service:3001`
     - `/api/orders/*` → `http://order-service:3002`
     - `/api/payments/*` → `http://payment-service:3003`
     - `/api/notifications/*` → `http://notification-service:3004`
     - `/api/analytics/*` → `http://analytics-service:3005`
   - Configure rate limiting: 1000 requests per minute per IP
   - Configure JWT authentication plugin
   - Add request/response logging

6. Add Kong to Docker Compose
   - Update `/docker-compose.yml` with Kong service
   - Add Kong database (PostgreSQL)
   - Expose Kong on port 8000 (proxy) and 8001 (admin)

7. Git commit
   ```bash
   git add services/analytics-service/ api-gateway/ docker-compose.yml
   git commit -m "feat: extract analytics service and configure API gateway"
   ```

## Phase 7: Implement Service Mesh with Istio

This phase adds Istio service mesh for advanced traffic management, observability, and security between microservices.

### Steps

1. Install Istio in local Kubernetes environment
   - Create `/kubernetes/istio-setup.sh` script
   - Install Istio with default profile
   - Enable sidecar auto-injection in default namespace

2. Create Kubernetes manifests for all services
   - Create `/kubernetes/user-service-deployment.yaml` with Deployment and Service resources
   - Create `/kubernetes/order-service-deployment.yaml`
   - Create `/kubernetes/payment-service-deployment.yaml`
   - Create `/kubernetes/notification-service-deployment.yaml`
   - Create `/kubernetes/analytics-service-deployment.yaml`
   - Each includes resource limits, health checks, and environment variables

3. Configure Istio VirtualServices
   - Create `/kubernetes/istio/user-service-vs.yaml` for traffic routing rules
   - Create `/kubernetes/istio/order-service-vs.yaml`
   - Create `/kubernetes/istio/payment-service-vs.yaml`
   - Create `/kubernetes/istio/notification-service-vs.yaml`
   - Create `/kubernetes/istio/analytics-service-vs.yaml`
   - Implement retry policies and timeout configurations

4. Configure Istio DestinationRules
   - Create `/kubernetes/istio/destination-rules.yaml`
   - Define connection pooling settings
   - Configure circuit breaker thresholds: max connections 100, max requests per connection 10

5. Set up mutual TLS
   - Create `/kubernetes/istio/peer-authentication.yaml`
   - Enable strict mTLS for all service-to-service communication
   - Configure certificate rotation policy

6. Configure observability
   - Enable Jaeger for distributed tracing
   - Enable Prometheus for metrics collection
   - Enable Grafana dashboards for service monitoring
   - Create `/kubernetes/istio/telemetry.yaml` for custom metrics

7. Git commit
   ```bash
   git add kubernetes/
   git commit -m "feat: implement Istio service mesh with mTLS and observability"
   ```

## Phase 8: Set Up CI/CD Pipelines

1. Create GitHub Actions workflow for user service
   - Create `.github/workflows/user-service-ci.yml`
   - Trigger on changes to `services/user-service/**`
   - Steps: install deps, run tests, lint, build Docker image, push to registry
   - Deploy to staging on main branch, production on release tags

2. Create GitHub Actions workflow for order service
   - Create `.github/workflows/order-service-ci.yml`
   - Same pipeline structure as user service

3. Create GitHub Actions workflow for payment service
   - Create `.github/workflows/payment-service-ci.yml`
   - Add additional security scanning for PCI compliance

4. Create GitHub Actions workflow for notification service
   - Create `.github/workflows/notification-service-ci.yml`

5. Create GitHub Actions workflow for analytics service
   - Create `.github/workflows/analytics-service-ci.yml`

6. Configure Kubernetes deployments in CI
   - Add kubectl configuration to workflows
   - Create deployment steps that update Kubernetes manifests
   - Implement blue-green deployment strategy
   - Add automated rollback on health check failure

7. Set up secrets management
   - Configure GitHub Secrets for each service
   - Add DATABASE_URL, STRIPE_API_KEY, TWILIO_AUTH_TOKEN, JWT_SECRET
   - Create `/scripts/sync-secrets.sh` to sync secrets to Kubernetes

8. Git commit
   ```bash
   git add .github/workflows/ scripts/sync-secrets.sh
   git commit -m "feat: configure CI/CD pipelines for all microservices"
   ```

## Phase 9: Data Migration and Feature Flag Rollout

This phase executes the actual data migration and progressive rollout of each microservice using feature flags.

### Steps

1. Execute data migrations in sequence
   - Run `/scripts/migrate-users-data.js` to copy user data
   - Verify data integrity with checksums
   - Run `/scripts/migrate-orders-data.js`
   - Run `/scripts/migrate-payments-data.js`
   - Run `/scripts/migrate-notifications-data.js`
   - Run `/scripts/migrate-analytics-data.js`

2. Progressive feature flag rollout for user service
   - Enable `use_user_service` flag for 10% of traffic
   - Monitor error rates and latency in Grafana
   - If metrics acceptable, increase to 50%, then 100%
   - Keep flag in place for 2 weeks for quick rollback capability

3. Progressive rollout for order service
   - Enable `use_order_service` flag for 10% → 50% → 100%
   - Monitor order creation success rates
   - Verify order status transitions work correctly

4. Progressive rollout for payment service
   - Enable `use_payment_service` flag for 10% → 50% → 100%
   - Monitor payment processing success rates
   - Verify Stripe webhooks are received correctly

5. Progressive rollout for notification service
   - Enable `use_notification_service` flag for 10% → 50% → 100%
   - Monitor email delivery rates
   - Check SMS sending metrics

6. Progressive rollout for analytics service
   - Enable `use_analytics_service` flag for 10% → 50% → 100%
   - Verify event ingestion rates
   - Check dashboard query performance

7. Remove feature flag code from monolith
   - After all flags at 100% for 2 weeks, remove flag checks
   - Delete proxy code in `/src/routes/*.js`
   - Remove LaunchDarkly SDK from monolith

8. Git commit
   ```bash
   git add scripts/ src/routes/
   git commit -m "feat: complete microservices migration and remove feature flags"
   ```

## Phase 10: Decommission Monolith Code

1. Archive monolith business logic
   - Move `/src/services/user-service.js` to `/archive/`
   - Move `/src/services/order-service.js` to `/archive/`
   - Move `/src/services/payment-service.js` to `/archive/`
   - Move `/src/services/notification-service.js` to `/archive/`
   - Move `/src/services/analytics-service.js` to `/archive/`

2. Update monolith to pure API gateway
   - Simplify `/src/app.js` to only handle routing
   - Remove all business logic
   - Keep only authentication and request forwarding
   - Update documentation

3. Decommission monolith database tables
   - Create backup of monolith database
   - Drop users, orders, payments, notifications, analytics_events tables
   - Keep only session and configuration tables needed for routing

4. Update deployment documentation
   - Create `/docs/microservices-architecture.md` with service diagram
   - Document API endpoints for each service
   - Add troubleshooting guide
   - Document rollback procedures

5. Final git commit
   ```bash
   git add archive/ src/ docs/
   git commit -m "feat: decommission monolith business logic and finalize migration"
   ```
