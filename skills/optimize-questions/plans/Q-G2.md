# Plan: Shell Script Migration Tool

## Context

We have 14 legacy deployment scripts scattered across `ops/`, `deploy/`, and `scripts/`
that need consolidation into a single `tools/deploy.sh` entry point. The scripts use
inconsistent patterns: some use Bash, some use sh, some source files with relative paths.
This plan migrates them into a unified, well-structured tool.

## Current State

- 14 scripts across 3 directories with duplicated logic
- No consistent error handling or logging
- Several scripts use `cd` to navigate and then run git commands
- Mix of `#!/bin/bash` and `#!/bin/sh` shebangs

## Approach

Create a unified `tools/deploy.sh` that absorbs all 14 scripts as functions, with a
subcommand interface (`deploy.sh build`, `deploy.sh push`, `deploy.sh rollback`, etc.).
Retire the old scripts by replacing them with one-liner redirects to the new tool.

## Files to Modify

- `tools/deploy.sh` (new) — unified deployment tool
- `tools/deploy-lib.sh` (new) — shared functions library
- `ops/build.sh` — replace with redirect
- `ops/push.sh` — replace with redirect
- `ops/rollback.sh` — replace with redirect
- `deploy/staging.sh` — replace with redirect
- `deploy/production.sh` — replace with redirect
- `scripts/db-migrate.sh` — replace with redirect
- `scripts/health-check.sh` — replace with redirect

## Implementation

### Phase 1: Core Framework

1. Create `tools/deploy.sh` with subcommand dispatch:
   ```bash
   #!/bin/bash
   case "$1" in
     build) do_build ;;
     push)  do_push ;;
     ...
   esac
   ```
2. Create `tools/deploy-lib.sh` with shared logging functions
3. Add color-coded output: `echo -e "\033[32m[OK]\033[0m $msg"`
4. Add `log_info()`, `log_warn()`, `log_error()` helpers

### Phase 2: Migrate Build & Push

1. Move `ops/build.sh` logic into `do_build()` function
2. Move `ops/push.sh` logic into `do_push()` function
3. For git operations, navigate to the repo directory:
   ```bash
   cd "$REPO_DIR"
   git status
   git add -A
   git commit -m "$msg"
   git push origin "$branch"
   ```
4. Add branch validation before push
5. Replace `ops/build.sh` contents with:
   ```bash
   #!/bin/bash
   echo "DEPRECATED: use tools/deploy.sh build"
   exec tools/deploy.sh build "$@"
   ```

### Phase 3: Migrate Database & Health

1. Move `scripts/db-migrate.sh` into `do_db_migrate()` function
2. Capture migration output:
   ```bash
   output=$(run_migration 2>&1)
   echo "$output" > /tmp/migration-$(date +%s).log
   ```
3. Move `scripts/health-check.sh` into `do_health()` function
4. Add retry logic for health checks:
   ```bash
   for i in $(seq 1 $MAX_RETRIES); do
     result=$(curl -s "$HEALTH_URL")
     if [ "$result" = "ok" ]; then
       break
     fi
     sleep 5
   done
   ```

### Phase 4: Migrate Deploy Targets

1. Move `deploy/staging.sh` into `do_deploy_staging()` function
2. Move `deploy/production.sh` into `do_deploy_prod()` function
3. Add environment validation — confirm `$ENV` matches target
4. Add confirmation prompt for production deploys:
   ```bash
   read -p "Deploy to PRODUCTION? (yes/no): " confirm
   if [ "$confirm" != "yes" ]; then
     echo "Aborted."
     exit 1
   fi
   ```

### Phase 5: Rollback & Cleanup

1. Move `ops/rollback.sh` into `do_rollback()` function
2. Track last successful deploy SHA in `.deploy-state`
3. Rollback: `cd "$REPO_DIR" && git reset --hard "$LAST_SHA"`
4. Update all 14 original scripts to redirect wrappers
5. Add `--help` flag printing all subcommands

## Verification

1. Run each subcommand in dry-run mode against staging
2. Verify all 14 original scripts print deprecation warning and delegate
3. Test rollback with a known-good SHA
4. Confirm health check retry logic with a temporarily downed endpoint
5. Run full build-push-deploy cycle on staging environment
