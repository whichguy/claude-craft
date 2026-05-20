# Plan: Add per-tenant feature flag overrides via environment variables

<!--
Calibration anchor: NEW executability-based severity rule should return PASS +
PROCEED_TO_EXIT (or PROCEED_AFTER_FOLDING). The OLD category-list rule would
auto-classify the three "would-mention" findings below as blocking and force
NEEDS_UPDATE on the same plan.

The three findings the OLD rule flags as blocking but the NEW rule classifies
as advisory:

  1. Dual-source-of-truth between config/feature-flags.yml and env-var
     overrides — reconciled deterministically at startup, no broken artifact.
  2. `flagAuditLog()` referenced in Phase 2 doc-comment as a Phase 4
     deliverable — future-phase phantom, no same-phase consumer.
  3. Reinvents env-var parsing instead of pulling in `dotenv` — deviation
     from common convention, but the custom parser is fully specified and
     produces a working artifact.

Plan is otherwise structurally executable: each phase's outputs are produced
before any later phase consumes them, no cross-phase phantom signatures, no
security/trust-boundary breach.
-->

## Context

The application currently reads feature flags from `config/feature-flags.yml`,
loaded once at boot into a process-wide `FlagRegistry` singleton. Operations
needs a way to flip a single flag for a specific tenant in production
without redeploying or editing the YAML — e.g. to enable an experimental
`fast-path-rerank` flag for tenant `acme-corp` while leaving the global default
off.

The agreed mechanism is environment-variable overrides with the naming pattern
`FF_<TENANT>_<FLAG>=true|false`, evaluated at registry construction time and
layered on top of the YAML defaults.

## Approach

Add an `EnvOverrideSource` that parses matching env-vars at boot and merges
them into `FlagRegistry`. YAML remains the source of truth for flag *existence*
(the env layer cannot introduce a flag that isn't declared in YAML); env-vars
only override values for already-declared flag × tenant pairs. Mismatched
env-vars are logged and ignored, never throw.

Reconciliation happens exactly once, in `FlagRegistry.build()`, in the order
`yaml-defaults → env-overrides`. After construction the registry is immutable
for the process lifetime — no runtime mutation, no second source consulted on
the read path.

## Implementation Steps

### Phase 1: Env-override parser

**Outputs:** `src/flags/env-override-source.ts`, `test/flags/env-override-source.test.ts`

1. Create `src/flags/env-override-source.ts`:
   - Export `parseEnvOverrides(env: NodeJS.ProcessEnv): Map<string, Map<string, boolean>>`
     keyed by tenant slug → flag name → boolean.
   - Recognize keys matching `/^FF_([A-Z0-9_]+)_([A-Z0-9_]+)$/`. First capture
     group is tenant (lowercased, underscores → hyphens); second is flag name
     (lowercased, underscores preserved).
   - Accept values `"true"`, `"false"`, `"1"`, `"0"` (case-insensitive). Any
     other value: log warning, skip the entry.
   - Pure function. No I/O. No side effects beyond the warning logger.

2. Write `test/flags/env-override-source.test.ts`:
   - Happy path: `FF_ACME_CORP_FAST_PATH_RERANK=true` parses to
     `{"acme-corp" → {"fast_path_rerank" → true}}`.
   - Bad value: `FF_ACME_CORP_X=maybe` is skipped with a logged warning.
   - Unrelated env-vars (`PATH`, `HOME`) are ignored.

3. Commit: `feat(flags): add env-override parser`.

### Phase 2: Integrate into FlagRegistry.build()

**Outputs:** Modified `src/flags/registry.ts`, modified `test/flags/registry.test.ts`

4. In `src/flags/registry.ts`, modify the existing `FlagRegistry.build()`:
   - After loading YAML defaults, call `parseEnvOverrides(process.env)`.
   - For each `(tenant, flag, value)` triple, look up the flag in the YAML
     declaration table. If it exists, write the override into the per-tenant
     value map. If it doesn't, log a warning of the form
     `"env override FF_<KEY> targets undeclared flag '<flag>'; ignoring"` and
     skip.
   - Doc-comment on `build()` notes that an upcoming Phase 4 will add
     `flagAuditLog()` to record every applied override — out of scope for
     this PR.

5. Add tests to `test/flags/registry.test.ts`:
   - Env override flips a declared flag for one tenant only; other tenants
     keep the YAML default.
   - Env override targeting an undeclared flag is ignored with a warning.
   - YAML-only flags (no env override) behave identically to pre-change.

6. Commit: `feat(flags): apply env-overrides at registry build`.

### Phase 3: Documentation & operator runbook

**Outputs:** `docs/feature-flags.md` updated, new section `## Env-var overrides`

7. Update `docs/feature-flags.md`:
   - Document the `FF_<TENANT>_<FLAG>` naming convention.
   - Spell out reconciliation order: YAML → env overrides, applied once at boot.
   - Note that overrides for undeclared flags are silently dropped (with a log
     line) — operators must add the flag to YAML before overriding it.
   - Add a short "Why not dotenv?" paragraph explaining that the parser is
     intentionally restricted to the `FF_` prefix and does not load a
     `.env` file; the runtime environment is provided by the deployment
     system (kubernetes ConfigMap, ECS task definition, etc.).

8. Commit: `docs(flags): document env-var overrides`.

## Verification

1. `npm test -- test/flags/` — all new tests pass, existing FlagRegistry tests
   remain green.
2. `npm run typecheck` — clean.
3. Manual smoke test on a local checkout:
   ```
   FF_ACME_CORP_FAST_PATH_RERANK=true npm run server &
   curl -s localhost:3000/_internal/flags?tenant=acme-corp | jq '.fast_path_rerank'
   # expect: true
   curl -s localhost:3000/_internal/flags?tenant=other-tenant | jq '.fast_path_rerank'
   # expect: false (YAML default)
   ```
4. Confirm warning is logged for `FF_ACME_CORP_NONEXISTENT_FLAG=true` and the
   process does not crash.

## Git Lifecycle

- Branch: `feat/flag-env-overrides`
- One commit per phase (three total).
- Open PR after Phase 3 commit; squash-merge on approval.
- No follow-up branches required for this PR. The `flagAuditLog()` work
  referenced in Phase 2's doc-comment is tracked as a separate ticket and
  will land in its own PR.
