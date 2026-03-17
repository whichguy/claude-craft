# Plan: Add Portable Extension Export for Claude Craft

## Context
Users want to share their Claude Craft extensions with teammates who may not have the repo cloned. Currently, extensions only work through symlinks from the repo to `~/.claude/`. We need an `export` command that packages selected extensions into a self-contained archive that recipients can install without cloning the full repository.

**Project:** claude-craft (~/claude-craft)

## Approach
Build an export/import workflow. The exporter reads extensions from their canonical location (the repo, via symlinks — single source of truth), packages them with metadata, and produces a `.tar.gz` archive. The importer extracts and installs on the recipient's machine. This keeps the symlink-based architecture as the authority while enabling portable sharing.

## Implementation Steps

### Phase 1: Extension Registry & Metadata

> Intent: Establish the canonical extension index by reading symlinks, so export knows exactly what exists and where it points.

**Pre-check:** None
**Outputs:** `tools/export-registry.sh`, registry JSON format

1. Create `tools/export-registry.sh`:
   - Walk `~/.claude/` following symlinks to resolve canonical source paths
   - For each extension: record name, type, source path, content hash (sha256)
   - Output JSON: `{ extensions: [{ name, type, sourcePath, hash }] }`
   - Read TYPES array from `shared-types.sh`; add `--filter` flag for type/name selection

2. Verify and commit: `git add tools/export-registry.sh && git commit -m "feat: add registry scanner"`

### Phase 2: Archive Builder

> Intent: Transform the registry output into a distributable archive with metadata for the importer.

**Pre-check:** Phase 1 registry JSON available
**Outputs:** `tools/export-build.sh`, archive format spec

3. Create `tools/export-build.sh`:
   - Accept registry JSON from Phase 1; read `installMode` field to determine packaging strategy
   - For each extension: resolve source, validate hash, collect into staging dir
   - Add `manifest.json` with version, export date, extension list, and checksums
   - Handle dir-type extensions (skills, plugins) — recursively copy, preserve structure
   - Produce `claude-extensions-YYYYMMDD.tar.gz` from staging directory

4. Verify and commit: `git add tools/export-build.sh && git commit -m "feat: add archive builder"`

### Phase 3: Import & Installation

> Intent: Enable recipients to install exported extensions without the original repo.

**Pre-check:** Phase 2 archive format established
**Outputs:** `tools/export-import.sh`

5. Create `tools/export-import.sh`:
   - Extract archive, read `manifest.json`, copy files/dirs to `~/.claude/`
   - Skip existing extensions (unless `--force`), support `--dry-run`

6. Verify and commit: `git add tools/export-import.sh && git commit -m "feat: add import"`

### Phase 4: Testing

**Pre-check:** Phase 3 complete
**Outputs:** Test files

7. Write tests for registry, archive, and import (round-trip verification)
8. Run `npm test` and commit: `git add test/ && git commit -m "test: add export/import tests"`

## Git Strategy
- Branch: `feat/extension-export` — commit per phase, push, PR, squash merge to main

## Post-Implementation
1. `/review-fix` — loop until clean
2. `npm test`
3. If tests fail → fix → re-run `/review-fix` → re-run tests

## Verification
- All existing tests pass
- Round-trip test: export → import on clean directory → verify functionality
