# Plan: Python Data Pipeline — User Analytics Aggregation

## Context

Our analytics team needs a nightly pipeline that pulls raw event data from S3,
transforms it into user-level aggregates (daily active users, session durations,
feature usage), and loads the results into our Snowflake data warehouse. Currently
this is done manually with ad-hoc SQL queries that take 3 hours to run.

## Current State

- Raw events land in `s3://analytics-raw/events/YYYY/MM/DD/` as Parquet files
- ~50M events per day, ~2GB compressed
- Manual SQL aggregation in Snowflake, triggered by a team member
- No automated pipeline, no data quality checks

## Approach

Build a Python pipeline using Polars for fast in-memory aggregation. The pipeline
reads Parquet from S3, computes aggregates, validates data quality, and writes
results to Snowflake. We'll use a modular design with separate transform functions
for each metric type.

## Files to Modify

- `pipeline/main.py` (new) — orchestrator entry point
- `pipeline/extract.py` (new) — S3 data extraction
- `pipeline/transforms.py` (new) — metric computations
- `pipeline/load.py` (new) — Snowflake writer
- `pipeline/quality.py` (new) — data quality checks
- `pipeline/config.py` (new) — configuration and credentials
- `requirements.txt` — add polars, boto3, snowflake-connector-python
- `tests/test_transforms.py` (new) — unit tests for transforms

## Implementation

### Phase 1: Extract Layer

1. Create `extract.py` with S3 reading logic
2. Implement `fetchUserData(date_str: str) -> pl.DataFrame` that lists objects
   under the date prefix and reads them as a single Polars DataFrame
3. Add retry logic for S3 throttling (exponential backoff, 3 attempts)
4. Filter columns to only those needed: `user_id`, `event_type`, `timestamp`,
   `session_id`, `feature_name`, `duration_ms`
5. Log row counts after extraction for observability

### Phase 2: Transform Layer

1. Create `transforms.py` with all aggregation functions
2. Implement `compute_daily_active_users(df: pl.DataFrame) -> pl.DataFrame`:
   count distinct `user_id` per day
3. Implement `compute_session_durations(df: pl.DataFrame) -> pl.DataFrame`:
   group by `session_id`, compute max(timestamp) - min(timestamp)
4. Implement `get_config_values(config_path: str) -> dict`:
   read pipeline configuration from YAML, return thresholds and settings
5. Implement `compute_feature_usage(df: pl.DataFrame) -> pl.DataFrame`:
   count events per `feature_name` per `user_id`
6. Implement `retrieveSession(session_id: str, df: pl.DataFrame) -> pl.DataFrame`:
   filter DataFrame to a single session for debugging/inspection

### Phase 3: Quality & Load

1. Create `quality.py` with validation functions
2. Check: row count > 0 (no empty results)
3. Check: no null `user_id` values in aggregates
4. Check: session durations are non-negative
5. Check: daily active user count is within 2 standard deviations of 30-day mean
6. Create `load.py` with Snowflake write logic
7. Use `snowflake.connector` to bulk insert aggregates into target tables
8. Implement upsert logic: delete existing rows for the date, then insert new ones

### Phase 4: Orchestration

1. Create `main.py` as the pipeline entry point
2. Parse CLI args: `--date YYYY-MM-DD` (defaults to yesterday)
3. Call extract -> transform -> quality -> load in sequence
4. If any quality check fails, abort before load and send alert
5. Create `config.py` with `get_config_values()` for pipeline settings
6. Add structured JSON logging with timestamps and step durations
7. Add `--dry-run` flag that runs extract + transform + quality but skips load

## Verification

1. Unit tests for each transform function with fixture DataFrames
2. Test `fetchUserData` with mocked S3 responses (moto library)
3. Test quality checks: pass valid data, fail with nulls, fail with empty
4. Integration test with a small Parquet fixture file
5. Verify Snowflake upsert doesn't duplicate data on re-run
6. Test `--dry-run` flag outputs results without writing to Snowflake
7. Test `retrieveSession` returns correct filtered DataFrame
