# Plan: Generate Test Fixtures from Extension Type Definitions

## Context
The claude-craft test suite uses hand-written fixture files that duplicate information already in the TYPES array (`tools/shared-types.sh`). When TYPES changes — new type, modified skip patterns, changed kind — fixtures must be manually updated. We need a fixture generator that reads TYPES and produces test fixtures automatically.

**Project:** claude-craft (~/claude-craft)

## Approach
Two-stage pipeline: (1) parse the TYPES array into structured data, (2) generate fixture files from that data. The parser handles the pipe-delimited format. The generator creates realistic directory trees and extension files matching each type's kind, pattern, and skip rules.

## Implementation Steps

### Phase 1: TYPES Parser

> Intent: Extract structured data from the pipe-delimited TYPES array so downstream stages work with clean objects.

**Pre-check:** None
**Outputs:** `tools/generate-fixtures.sh` (parser section), parsed type objects

1. Create `tools/generate-fixtures.sh` with TYPES parser:
   - Source `tools/shared-types.sh` to load the TYPES array
   - For each entry, split on `|` and extract fields:
     - Field 0: name, Field 1: emoji, Field 2: claude_subdir
     - Field 3: kind (file or dir), Field 4: pattern, Field 5: skip_pattern
   - Store parsed results in parallel arrays for downstream use
   - Validate: each entry has exactly 7 pipe-separated fields

2. Add `--type` filter to generate fixtures for a single type

3. Verify and commit: `git add tools/generate-fixtures.sh && git commit -m "feat: add TYPES parser"`

### Phase 2: Fixture Generator

> Intent: Transform parsed type data into realistic test fixtures.

**Pre-check:** Phase 1 parser produces valid output for all 6 types
**Outputs:** Generated fixture files in `test/fixtures/generated/`

4. Add fixture generation logic:
   - For each parsed type, create fixture directory under `test/fixtures/generated/`
   - File-kind: generate sample `.md` files with realistic frontmatter
   - Dir-kind: generate sample directory with `SKILL.md` entry point
   - Generate one "should-be-skipped" file per skip pattern

5. Generate fixture manifest (`test/fixtures/generated/manifest.json`):
   - List all fixtures with type, path, expected sync behavior
   - Mark skip-pattern files as `expectedSkip: true`
   - For each parsed type: extract name (field 0), pattern (field 5), and skip rules (field 6) into an assertion object `{ typeName, pattern, shouldSkip: [array of globs] }`; add `--clean` flag to regenerate all fixtures from scratch

6. Verify and commit: `git add tools/generate-fixtures.sh && git commit -m "feat: add fixture generator"`

### Phase 3: Test Integration

> Intent: Wire generated fixtures into the existing test suite.

**Pre-check:** Phase 2 fixtures generated and manifest available
**Outputs:** Updated test files

7. Update `test/sync.test.js` to load generated fixtures dynamically from manifest
8. Add `npm run generate-fixtures` to `package.json`, run `npm test`
9. Commit: `git add test/ package.json && git commit -m "test: integrate generated fixtures"`

## Git Strategy
- Branch: `feat/fixture-generator`
- Commit per phase, push to remote, create PR, squash merge to main

## Post-Implementation
1. `/review-suite:review-fix` — loop until clean
2. `npm test`
3. If tests fail → fix → re-run `/review-suite:review-fix` → re-run tests

## Verification
- Parser correctly extracts all 6 types from TYPES array
- Generated fixtures match expected structure for each type
- All existing and new tests pass
