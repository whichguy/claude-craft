# Plan: Export Extension Dependency Graph

## Context
Extensions in claude-craft can reference each other: skills spawn agents, agents invoke other
agents, prompts reference supporting files. Currently there's no way to visualize these
relationships. This plan adds a dependency graph exporter that reads the extension source files,
discovers cross-references, and outputs a DOT file suitable for Graphviz rendering.

**Project:** claude-craft (~/claude-craft)

## Approach
Two-stage pipeline: (1) parse all extension files to build a reference map (what references
what), (2) serialize the reference map into DOT graph format. The parser handles each extension
type differently — skills reference agents by `subagent_type`, agents reference files by path,
prompts reference skills by name.

## Implementation Steps

### Phase 1: Reference Discovery

**Pre-check:** None
**Outputs:** `tools/export-graph.js` (parser section), reference map data structure

1. Create `tools/export-graph.js` with a reference parser:
   - Walk each extension type directory (agents/, skills/, commands/, prompts/)
   - For each `.md` file: extract `subagent_type` values (skills/agents), skill names in
     `allowed-tools` frontmatter (agents), and `argument-hint` references (commands)
   - Build reference map: `{ source: extensionName, target: extensionName, type: 'spawns'|'invokes'|'includes' }[]`

2. Handle the three reference patterns:
   - `subagent_type: "foo"` in YAML frontmatter → edge: current extension → agents/foo.md
   - `allowed-tools: Agent` in frontmatter → edge: current → generic agent dispatch
   - `/skill-name` in body text → edge: current → skills/skill-name/SKILL.md

3. Validate: warn on references to non-existent extension files (broken links)

4. Commit: `git add tools/export-graph.js && git commit -m "feat: add extension reference parser"`

### Phase 2: DOT Serializer

**Pre-check:** Phase 1 produces valid reference map for at least 10 extensions
**Outputs:** DOT graph output, `npm run export-graph` script entry

5. Add DOT serialization to `tools/export-graph.js`:
   - Convert the parsed extension dependency map into DOT graph format
   - The output file should be saved to `dist/extension-graph.dot`

6. Add `npm run export-graph` to `package.json`:
   ```json
   "export-graph": "node tools/export-graph.js > dist/extension-graph.dot"
   ```

7. Commit: `git add tools/export-graph.js package.json && git commit -m "feat: add DOT serializer"`

### Phase 3: Rendering Integration

**Pre-check:** Phase 2 DOT output validated with `dot -Tsvg`
**Outputs:** `dist/extension-graph.svg` in CI artifacts, updated README

8. Add to README: "Run `npm run export-graph && dot -Tsvg dist/extension-graph.dot > dist/extension-graph.svg`"
9. Run `npm test` — no regressions

## Git Strategy
- Branch: `feat/extension-graph-export`
- Commit per phase, push to remote, create PR, squash merge to main

## Post-Implementation
1. `/review-fix` — loop until clean
2. `npm test`
3. If tests fail → fix → re-run `/review-fix` → re-run tests

## Verification
- `node tools/export-graph.js` produces a `.dot` file with at least one edge per extension type
- `dot -Tsvg dist/extension-graph.dot` renders without errors
- All 33 existing sync tests pass
- Broken link warnings appear for any reference to a missing extension
