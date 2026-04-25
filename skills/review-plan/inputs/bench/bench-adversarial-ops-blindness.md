# Project Plan: Core User Database Migration (MySQL to PostgreSQL)

## Context
As our user base scales, we are facing performance bottlenecks with our current MySQL 5.7 instance. PostgreSQL 15 offers superior performance for our complex relational queries and better JSONB support. We will migrate the entire `users_db` to a new PostgreSQL instance.

## Git Setup
- Branch: `ops/db-migration`
- Base: `main`
- Scope: Infrastructure, Backend API

## Implementation Steps

### 1. Data Export and Schema Conversion
- Use `pgloader` to automate the schema conversion and data migration from MySQL to PostgreSQL.
- Perform a full backup of the MySQL database using `mysqldump` immediately before starting the migration to ensure no data loss.

### 2. Migration Execution
- Put the application into "Maintenance Mode" by updating the load balancer configuration.
- Run the migration script to transfer all records from MySQL to PostgreSQL.
- Update the backend application configuration to point to the new PostgreSQL connection string.

### 3. API Response Standardization
- As part of this migration, we will modernize our API error response format.
- Update the global exception handler to return `{"status": "fail", "msg": "..."}` instead of the old `{"error": "message"}` format to align with our new internal standards.

### 4. Cutover and Go-Live
- Update DNS records or environment variables to point all services to the new DB instance.
- Monitor the application for 15 minutes to ensure basic connectivity is working.
- Remove the "Maintenance Mode" flag.

## Verification
- Run the `smoke-test` suite against the production environment.
- Manually verify that a new user can sign up and their record is saved in PostgreSQL.
- Check that existing users can log in successfully.

## Risks
- The data migration script might take longer than the planned maintenance window.
- Some complex queries might need manual optimization for PostgreSQL syntax.
- Network latency between the API and the new DB cluster might increase.
