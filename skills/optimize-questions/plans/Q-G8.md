# Plan: Migrate CommonJS requires to ESM imports

## Context

The project has 500+ source files still using CommonJS `require()` syntax. The team has
decided to migrate to ESM `import/export` to enable tree-shaking and improve IDE support.
The `tsconfig.json` already has `"module": "esnext"` but a compat shim suppresses errors.

## Approach

Identify all files needing migration, categorize by complexity, run the automated codemod,
manually fix remaining patterns, and update build configuration.

## Files to Modify

- All `src/**/*.ts` files with `require()` calls (~500 files)
- `tsconfig.json` — Remove compat shim, set `"module": "nodenext"`
- `package.json` — Add `"type": "module"`
- `jest.config.js` — Update transform settings for ESM
- `webpack.config.js` — Update module resolution

## Implementation Steps

### Step 1: Audit the codebase for migration patterns

Scan the entire codebase to categorize files by migration complexity. Search all 500+ files
for pattern types — simple requires, dynamic requires, conditional requires, and
`__dirname`/`__filename` usage:

```bash
grep -r "require(" src/ --include="*.ts" -l > /tmp/require-files.txt
grep -r "require(" src/ --include="*.ts" -c | sort -t: -k2 -rn
grep -rn "require(\`" src/ --include="*.ts" > /tmp/dynamic-requires.txt
grep -rn "__dirname\|__filename" src/ --include="*.ts" > /tmp/dirname-usage.txt
grep -rn "module\.exports\[" src/ --include="*.ts" > /tmp/computed-exports.txt
```

Expected breakdown: ~420 auto-migrate, ~50 `__dirname` replacements, ~30 dynamic/conditional.

### Step 2: Run automated codemod on simple files

Run `npx codemod-cjs-to-esm src/ --include="*.ts"` to transform straightforward patterns:
`const { foo } = require('./bar')` to `import { foo } from './bar.js'`, and
`module.exports = { foo }` to `export { foo }`.

### Step 3: Fix __dirname and __filename references

For each file using `__dirname`, replace with `import.meta.url`-based equivalents:

```ts
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### Step 4: Handle dynamic and conditional requires

Convert dynamic `require()` calls to `await import()`. Convert conditional requires to
lazy dynamic imports with top-level await or factory patterns.

### Step 5: Update configuration files

- `tsconfig.json`: set `"module": "nodenext"`, `"moduleResolution": "nodenext"`
- `package.json`: add `"type": "module"`
- `jest.config.js`: add `extensionsToTreatAsEsm: ['.ts']` and ts-jest ESM transform
- `webpack.config.js`: update resolve extensions

### Step 6: Fix import path extensions

ESM requires explicit `.js` extensions on relative imports. Use sed/codemod to append `.js`
to all relative import paths missing extensions.

### Step 7: Build and fix remaining issues

Run `npx tsc --noEmit` and fix remaining type errors (default export mismatches, missing
type declarations, circular dependency exposure).

### Step 8: Run full test suite

Run `npm test` and fix failures (Jest mock patterns, `jest.mock()` to
`jest.unstable_mockModule()`, test setup ESM conversion).

## Verification

1. `npx tsc --noEmit` passes with zero errors
2. `npm test` all green
3. No remaining `require()` calls in `src/` (excluding test mocks)
4. `npm run build` produces working bundle
5. Smoke test the running application

## Risks

- Some third-party packages may not support ESM imports
- Jest ESM support is still experimental
- Dynamic imports change module loading timing, could expose race conditions
