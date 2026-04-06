# Plan: CI/CD Pipeline for Microservice Deployment

## Context

Our team is setting up a CI/CD pipeline for a new Node.js microservice. The pipeline
needs to handle linting, testing, building a Docker image, pushing to a container
registry, deploying to a staging environment, running smoke tests, and pushing the
final code to the release branch. Currently all of this is done manually.

## Current State

- Node.js 20, TypeScript 5.3
- Docker for containerization, ECR for container registry
- AWS ECS Fargate for staging and production
- GitHub Actions for CI
- No existing pipeline — manual deploy via SSH
- Test suite: 85 unit tests, 12 integration tests
- Staging environment: `staging.internal.example.com`

## Approach

Build a GitHub Actions workflow that automates the full deployment pipeline. Each step
will be a discrete job with clear dependencies. The pipeline triggers on push to `main`.

## Files to Modify

- `.github/workflows/deploy.yml` (new) — main deployment workflow
- `Dockerfile` — optimize for CI builds (multi-stage)
- `scripts/smoke-test.sh` (new) — staging smoke test script
- `scripts/health-check.sh` (new) — post-deploy health verification
- `.github/actions/notify/action.yml` (new) — Slack notification composite action

## Implementation

### Step 1: Lint & Type Check

1. Configure lint job in `deploy.yml`:
   - Checkout code, setup Node.js 20
   - `npm ci` for deterministic installs
   - `npm run lint` — ESLint with TypeScript rules
   - `npx tsc --noEmit` — type checking without output

### Step 2: Build Docker Image

1. Multi-stage Dockerfile:
   - Stage 1: `node:20-slim` builder — install deps, compile TypeScript
   - Stage 2: `node:20-slim` runtime — copy compiled JS, production deps only
   - Health check: `HEALTHCHECK CMD curl -f http://localhost:3000/health`

2. Build and tag image:
   - Tag: `${ECR_REPO}:${GITHUB_SHA}`
   - Build args: `NODE_ENV=production`

### Step 3: Deploy to Staging

1. Push Docker image to ECR
2. Update ECS task definition with new image tag
3. Deploy to staging ECS service with rolling update
4. Wait for deployment to stabilize (ECS service reaches steady state)
5. Verify staging health endpoint returns 200

### Step 4: Run Tests

1. Run unit tests: `npm test`
2. Run integration tests: `npm run test:integration`
3. Run smoke tests against staging:
   - `scripts/smoke-test.sh` hits key endpoints
   - Verifies response codes, response shapes, latency < 500ms
   - Tests: `GET /health`, `GET /api/v1/status`, `POST /api/v1/echo`

### Step 5: Push to Release Branch

1. If all tests pass, push the commit to the `release` branch
2. Tag the release: `v${PACKAGE_VERSION}-${SHORT_SHA}`
3. Create GitHub release with auto-generated notes
4. Trigger production deployment workflow (separate workflow)

### Step 6: Notifications

1. On success: Slack notification with deployment summary
   - Service name, version, commit SHA, deploy time
   - Link to staging URL and GitHub release

2. On failure: Slack notification with error details
   - Failed step name, error message
   - Link to GitHub Actions run for debugging

## Verification

1. Test workflow syntax: `act` for local GitHub Actions testing
2. Verify lint job catches intentional lint errors
3. Verify Docker build produces working image (run locally)
4. Verify smoke test script detects unhealthy endpoints
5. Verify Slack notifications fire on success and failure
6. End-to-end: push to main, verify full pipeline completes
