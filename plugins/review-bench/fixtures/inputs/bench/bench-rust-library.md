# Plan: Extract Shared Validation Crate from Rust Monorepo

## Context

Input validation logic is duplicated across three crates in the workspace: `api-server`, `cli-tool`, and `batch-processor`. Each implements email validation, phone number parsing, address normalization, and date range validation independently. The implementations have drifted — `api-server` has the most complete versions with proper error types, `cli-tool` uses simplified variants with `String` errors, and `batch-processor` has the oldest code returning `anyhow::Error`. Extracting a shared `validation` crate will eliminate the duplication, lock in the best implementations, and give all consumers a unified error type.

**Workspace:** Root `Cargo.toml` with members: `api-server`, `cli-tool`, `batch-processor`
**Source of truth:** `api-server/src/validation.rs` — most complete, best error types
**Key tension:** Error type unification — each crate uses a different error strategy

## Git Setup

```
git checkout -b feat/shared-validation-crate
```

## Implementation Steps

### Phase 1: Create the Shared Crate

> Intent: Build the shared validation crate using api-server's implementations as the baseline, since they handle the most edge cases. Define a proper ValidationError enum with thiserror so downstream crates can match on specific failure modes or convert to their own error types.

**Pre-check:** `cargo check --workspace` passes on main (confirm clean starting state)
**Outputs:** `validation/` crate compiles, all unit tests pass

1. Create `validation/Cargo.toml`:
   - `[package]` with name = "validation", version = "0.1.0", edition matching workspace
   - Dependencies: `thiserror`, `regex`, `once_cell` (for compiled regexes), `chrono`
   - `[dev-dependencies]`: nothing extra needed initially
   - Add `"validation"` to the `members` list in the root `Cargo.toml`

2. Create `validation/src/error.rs` — unified error type:
   - `ValidationError` enum derived with `thiserror::Error`:
     - `InvalidEmail { address: String, reason: String }`
     - `InvalidPhone { input: String, reason: String }`
     - `InvalidAddress { reason: String }`
     - `InvalidDateRange { reason: String }`
   - Implement `From<ValidationError> for String` so cli-tool can convert cheaply
   - Implement `From<ValidationError> for anyhow::Error` isn't needed — anyhow already blanket-impls `From<E: std::error::Error>`

3. Create `validation/src/email.rs`:
   - Port `validate_email()` from `api-server/src/validation.rs`
   - Signature: `pub fn validate_email(email: &str) -> Result<(), ValidationError>`
   - Keep the MX-check logic from api-server (cli-tool's version skipped this — that's the drift we're fixing)
   - Add an `EmailOptions` struct with `skip_mx_check: bool` for callers that want the fast path (cli-tool can use this)
   - Overload: `validate_email_with_options(email: &str, opts: &EmailOptions) -> Result<(), ValidationError>`

4. Create `validation/src/phone.rs`:
   - Port `parse_phone()` from `api-server/src/validation.rs`
   - Signature: `pub fn parse_phone(input: &str) -> Result<String, ValidationError>` — returns normalized E.164 format
   - This unifies the naming: api-server called it `parse_phone`, cli-tool called it `validate_phone`, batch-processor called it `check_phone`

5. Create `validation/src/address.rs`:
   - Port `normalize_address()` from `api-server/src/validation.rs`
   - Signature: `pub fn normalize_address(address: &mut Address) -> Result<(), ValidationError>`
   - Define an `Address` struct in this module (or a shared `types.rs`) with fields matching what api-server uses
   - This unifies: api-server's `normalize_address`, cli-tool's `address_clean`, batch-processor's `check_address`

6. Create `validation/src/date_range.rs`:
   - Port `validate_date_range()` from `api-server/src/validation.rs`
   - Signature: `pub fn validate_date_range(start: NaiveDate, end: NaiveDate) -> Result<(), ValidationError>`
   - Keep all edge case handling from api-server (the batch-processor version missed several)

7. Create `validation/src/lib.rs` — public API re-exports:
   - `pub mod email;`
   - `pub mod phone;`
   - `pub mod address;`
   - `pub mod date_range;`
   - `pub mod error;`
   - Re-export key types at crate root: `pub use error::ValidationError;`, `pub use address::Address;`, `pub use email::EmailOptions;`

8. Write unit tests in each module (inline `#[cfg(test)]` blocks):
   - Email: valid addresses, missing @, invalid domain, empty string, unicode local parts, addresses with `+`
   - Phone: valid E.164, too short, too long, letters mixed in, various country formats
   - Address: normalization of whitespace, state abbreviation expansion, missing required fields
   - Date range: valid range, start == end, start after end, zero-length range edge case

9. Verify: `cargo test -p validation` — all pass, `cargo clippy -p validation` — no warnings

**Phase 1 commit:** `git add validation/ Cargo.toml && git commit -m "feat: add shared validation crate with email, phone, address, and date range validators"`

### Phase 2: Migrate api-server

> Intent: Start with api-server since it's closest to the shared crate (we based the crate on its code). This is the lowest-risk migration and validates the shared crate's API before touching the other two.

**Pre-check:** `cargo test -p validation` passes
**Outputs:** api-server uses shared crate, its local `validation.rs` is deleted

10. Add dependency in `api-server/Cargo.toml`: `validation = { path = "../validation" }`

11. Update `api-server/src/validation.rs` → delete the file entirely. All call sites now import from the `validation` crate instead.

12. Update imports across api-server:
    - Find all `use crate::validation::` and replace with `use validation::`
    - `validate_email()` → `validation::email::validate_email()`
    - `parse_phone()` → `validation::phone::parse_phone()`
    - `normalize_address()` → `validation::address::normalize_address()`
    - `validate_date_range()` → `validation::date_range::validate_date_range()`

13. Handle error type mapping:
    - api-server already uses a `ValidationError` enum — add `impl From<validation::ValidationError> for api_server::ApiError` in api-server's error module
    - Or if the shared `ValidationError` is a superset, switch api-server to use it directly and remove its local `ValidationError`

14. If api-server defined its own `Address` struct, migrate to `validation::Address` or add `From` conversions

15. Verify: `cargo test -p api-server` — all existing tests pass with no changes to test logic

**Phase 2 commit:** `git add api-server/ && git commit -m "refactor: migrate api-server to shared validation crate"`

### Phase 3: Migrate cli-tool

> Intent: cli-tool has the most adaptation needed — different function names, simplified logic (no MX check), and String-based errors. The EmailOptions escape hatch handles the MX check difference cleanly.

**Pre-check:** `cargo test -p api-server` still passes
**Outputs:** cli-tool uses shared crate, its local `validators.rs` is deleted

16. Add dependency in `cli-tool/Cargo.toml`: `validation = { path = "../validation" }`

17. Update call sites in cli-tool:
    - `validate_email(x)` → `validation::email::validate_email_with_options(x, &EmailOptions { skip_mx_check: true })` (preserves cli-tool's current behavior of no MX check)
    - `validate_phone(x)` → `validation::phone::parse_phone(x)`
    - `address_clean(x)` → `validation::address::normalize_address(x)`

18. Handle error conversion:
    - cli-tool returns `String` errors — use `.map_err(|e| e.to_string())` at each call site, or add a thin wrapper function in cli-tool that does this conversion
    - Alternatively, add a helper: `fn validate_or_string<T>(result: Result<T, ValidationError>) -> Result<T, String>`

19. Delete `cli-tool/src/validators.rs` and remove its `mod validators;` declaration

20. Verify: `cargo test -p cli-tool` — all pass. If cli-tool had tests that asserted specific error strings, update those to match the new `ValidationError` Display output.

**Phase 3 commit:** `git add cli-tool/ && git commit -m "refactor: migrate cli-tool to shared validation crate"`

### Phase 4: Migrate batch-processor

> Intent: batch-processor has the oldest, least-complete validators. This migration is the biggest behavioral improvement — it picks up all the edge case handling from api-server's versions that batch-processor was missing.

**Pre-check:** `cargo test -p cli-tool` still passes
**Outputs:** batch-processor uses shared crate, its local `input_checks.rs` is deleted

21. Add dependency in `batch-processor/Cargo.toml`: `validation = { path = "../validation" }`

22. Update call sites in batch-processor:
    - `check_email(x)` → `validation::email::validate_email(x)`
    - `check_phone(x)` → `validation::phone::parse_phone(x)`
    - `check_address(x)` → `validation::address::normalize_address(x)`

23. Handle error conversion:
    - batch-processor uses `anyhow::Error` — the shared `ValidationError` implements `std::error::Error` via thiserror, so `anyhow` auto-converts with `?`
    - No explicit mapping needed in most cases; just ensure call sites use `?` operator

24. Delete `batch-processor/src/input_checks.rs` and remove its `mod input_checks;` declaration

25. Verify: `cargo test -p batch-processor` — if any tests were asserting on the less-complete validation behavior (e.g., accepting inputs that api-server would reject), update those tests to reflect the now-correct stricter validation

**Phase 4 commit:** `git add batch-processor/ && git commit -m "refactor: migrate batch-processor to shared validation crate"`

### Phase 5: Workspace Verification and Cleanup

> Intent: Full workspace build and test to catch any cross-crate issues, then clean up dead code and add documentation.

**Pre-check:** All four phase commits are clean
**Outputs:** Workspace fully green, no dead code, shared crate documented

26. Run full workspace checks:
    - `cargo test --workspace`
    - `cargo clippy --workspace -- -D warnings`
    - `cargo doc --workspace --no-deps` — verify docs generate cleanly

27. Check for dead code: search all three consumer crates for any leftover references to the deleted modules. Grep for old function names (`address_clean`, `check_email`, `check_phone`, `check_address`, `validate_phone` in cli-tool context)

28. If CI config exists (e.g., `.github/workflows/ci.yml`), verify the `validation` crate is included in test/clippy/fmt matrix entries. If CI runs `cargo test --workspace` it's already covered; if it lists crates explicitly, add `validation`.

29. Add module-level doc comments (`//!`) to each file in `validation/src/` explaining the validation rules and providing usage examples in doc tests

**Phase 5 commit:** `git add . && git commit -m "chore: workspace cleanup, add doc comments to shared validation crate"`

## Verification

- `cargo test --workspace` — zero failures
- `cargo clippy --workspace -- -D warnings` — no warnings
- `cargo doc --workspace --no-deps` — generates without errors
- Old validation modules fully deleted: `api-server/src/validation.rs`, `cli-tool/src/validators.rs`, `batch-processor/src/input_checks.rs` no longer exist
- Grep for old function names (`address_clean`, `check_email`, `check_phone`) returns zero hits outside of git history
- Each crate's existing integration or e2e tests (if any) pass without modification to test assertions (except batch-processor where stricter validation may require test updates)
