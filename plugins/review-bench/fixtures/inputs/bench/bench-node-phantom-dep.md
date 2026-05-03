# Implementation Plan: DateFormatter Utility
## Context
Standardize date formatting across the monorepo in the `utils` package.

## Steps
1. In `packages/utils/src/date.ts`, import `format` from `date-fns`.
2. Implement `formatStandardDate` using the imported function.
3. Ensure `date-fns` is present in the root `package.json` for development.
4. Export the new utility from `packages/utils/index.ts`.

## Verification
- Run `npm run build` from the root of the monorepo and verify `packages/utils` compiles without errors.
