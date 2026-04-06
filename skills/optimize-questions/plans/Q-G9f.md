# Plan: Build System Modernization

## Context

Our monorepo build system uses a mix of custom shell scripts and Makefiles that have
become fragile and slow. Build times for CI have grown to 18 minutes. We need to
modernize: replace scripts with Turborepo for task orchestration, update bundling from
Webpack 4 to esbuild, migrate linting from TSLint (deprecated) to ESLint, and set up
Docker multi-stage builds for deployment.

## Current State

- Monorepo: `packages/api`, `packages/client`, `packages/shared`, `packages/worker`
- Build orchestration: `Makefile` with shell scripts in `scripts/`
- Bundler: Webpack 4 for client, `tsc` for api/shared/worker
- Linter: TSLint (deprecated, no longer maintained)
- Docker: single-stage `Dockerfile` that installs everything and builds inside container
- CI: GitHub Actions, 18-minute average build time
- Test suite: Jest, ~400 tests across all packages

## Approach

We will modernize in 4 phases targeting different parts of the build infrastructure.
Each phase produces independently deployable artifacts and can be merged separately.

## Files to Create/Modify

**Phase 1 — Turborepo**:
- `turbo.json` (new) — pipeline configuration
- `package.json` — add turborepo devDependency, update scripts
- `packages/*/package.json` — add package-level build/test/lint scripts

**Phase 2 — esbuild**:
- `packages/client/esbuild.config.ts` (new) — client bundle config
- `packages/client/package.json` — swap webpack for esbuild
- `packages/client/webpack.config.js` — remove after migration

**Phase 3 — ESLint**:
- `.eslintrc.json` (new) — root ESLint config
- `packages/*/.eslintrc.json` (new) — package-level overrides
- `tslint.json` — remove after migration
- `packages/*/tslint.json` — remove after migration

**Phase 4 — Docker**:
- `Dockerfile` — rewrite as multi-stage build
- `.dockerignore` (new) — exclude dev files from build context
- `docker-compose.yml` — update build targets
- `.github/workflows/ci.yml` — update CI pipeline

## Implementation

### Phase 1: Turborepo Setup

1. Install Turborepo: `npm install -D turbo` in the monorepo root
2. Create `turbo.json` with pipeline definition:
   ```json
   {
     "pipeline": {
       "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
       "test": { "dependsOn": ["build"] },
       "lint": {}
     }
   }
   ```
3. Update root `package.json` scripts:
   - `"build": "turbo run build"`
   - `"test": "turbo run test"`
   - `"lint": "turbo run lint"`
4. Add `build`, `test`, and `lint` scripts to each `packages/*/package.json`
5. Verify dependency graph: `npx turbo run build --dry-run`
6. Run full build: `npx turbo run build` — all packages compile successfully
7. Commit: "feat(build): add Turborepo for task orchestration"

### Phase 2: esbuild Migration

1. Install esbuild in `packages/client`, create `esbuild.config.ts` with entry
   `src/index.tsx`, output `dist/bundle.js`, JSX transform, source maps, minification
2. Update `packages/client/package.json`: swap webpack for esbuild in build script
3. Run client build, verify output, test in browser — all pages load, no errors
4. Remove `webpack.config.js` after verifying esbuild output
5. Commit: "feat(client): migrate bundler from Webpack 4 to esbuild"

### Phase 3: ESLint Migration

1. Install ESLint + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`
2. Create root `.eslintrc.json` extending `eslint:recommended` + TS recommended
3. Create package overrides: client adds React plugin, api adds Node rules
4. Run `npx eslint packages/ --fix`, address remaining warnings manually
5. Remove all `tslint.json` files, uninstall TSLint
6. Commit: "feat(lint): migrate from TSLint to ESLint"

### Phase 4: Docker Multi-Stage Build

1. Create `.dockerignore` excluding `node_modules`, `.git`, `*.md`, test fixtures
2. Rewrite `Dockerfile`: deps stage (npm ci), build stage (turbo run build),
   production stage (copy dist + node_modules, CMD node api/index.js)
3. Update `docker-compose.yml` build targets and `.github/workflows/ci.yml`
4. Build image, run container, verify health endpoint, compare image size
5. Commit: "feat(deploy): multi-stage Docker build with Turborepo"

## Verification

1. `npx turbo run build` — all 4 packages build successfully with caching
2. `npx turbo run test` — all 400 tests pass
3. `npx turbo run lint` — zero ESLint errors
4. Client bundle: verify esbuild output works in browser
5. Docker: build image, run container, hit health endpoint
6. CI: push branch, verify GitHub Actions pipeline passes under 8 minutes
7. No references to webpack, TSLint, or old Makefile remain in active code
8. Turborepo cache: second build completes in <10 seconds
