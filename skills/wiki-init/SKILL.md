---
name: wiki-init
description: |
  Set up an LLM wiki for this repository. Creates directory structure and SCHEMA.md.
  The SessionStart hook auto-detects and injects the wiki from this point forward.
  AUTOMATICALLY INVOKE when: "set up wiki", "wiki this repo", "create wiki",
  "create knowledge base", "track what I read", "initialize wiki"
  NOT for: querying (use /wiki-query), ingesting sources (use /wiki-ingest)
allowed-tools: Bash, Read, Write, Glob
model: sonnet
argument-hint: "[wiki-dir]"
---

# /wiki-init — Initialize Project Wiki

Set up an LLM wiki for this repository. After initialization, the SessionStart hook
auto-detects `wiki/index.md` and injects context into every future session automatically.

## Step 0 — Parse Arguments

From `$ARGUMENTS`, extract:
- `WIKI_DIR`: directory name for wiki (default: `wiki`)

Resolve `REPO_ROOT` via: `git rev-parse --show-toplevel`
If not in a git repo: use current working directory.
`REPO_NAME`: `basename "$REPO_ROOT"` — used in templates below wherever `[repo name]` appears.

## Step 1 — Idempotency Check

Check if `REPO_ROOT/WIKI_DIR/log.md` already exists (sentinel file, matches hook detection).
If yes: print "Wiki already initialized at WIKI_DIR/. The SessionStart hook will auto-inject
context on next session start." and stop. Do not overwrite.

## Step 2 — Create Directory Structure

Use Bash `mkdir -p` to create:
- `WIKI_DIR/`
- `WIKI_DIR/entities/`
- `WIKI_DIR/sources/`
- `WIKI_DIR/queries/`
- `WIKI_DIR/maintenance/`
- `REPO_ROOT/raw/` (at repo root, alongside WIKI_DIR — LLM-write-protected via hook)

## Step 3 — Write wiki/index.md

Write `REPO_ROOT/WIKI_DIR/index.md`:

```markdown
# Wiki Index — [repo name]

## Pages

| Page | Summary | Last Updated |
|------|---------|--------------|

## About

Maintained by Claude Code. See SCHEMA.md for conventions.
Two-tier system: this project wiki + global knowledge at ~/.claude/wiki/topics/.
Use /wiki-ingest to add sources, /wiki-query to synthesize answers, /wiki-load for JIT context.
```

## Step 4 — Write wiki/log.md

Write `REPO_ROOT/WIKI_DIR/log.md`:

```markdown
# Wiki Log

Append-only chronological record. Format: [YYYY-MM-DD HH:MM] TYPE detail

Valid types: INIT, INGEST, QUERY, LINT, SESSION_START, SESSION_END, EXTRACT

## Entries

[CURRENT_TIMESTAMP] INIT wiki-init: initialized wiki at WIKI_DIR/ with schema v2
```

(Replace CURRENT_TIMESTAMP with actual timestamp: `date '+%Y-%m-%d %H:%M'`)

## Step 5 — Write wiki/SCHEMA.md

Write `REPO_ROOT/WIKI_DIR/SCHEMA.md` by copying from the canonical schema at `REPO_ROOT/wiki/SCHEMA.md` if it exists in the repository (i.e., this is a claude-craft-based project). Otherwise write the following token-compact content:

```
---
schema_version: 2
---
# Wiki Schema v2

Dirs: wiki/{entities,sources,queries,maintenance}, raw/ (LLM-write-protected, hook enforced)
Global tier: ~/.claude/wiki/topics/ (Sonnet auto-writes) — /wiki-load searches both tiers

## Page Formats

**Entity** (entities/SLUG.md):
  ---
  name: Entity Name
  type: entity
  description: "One-line retrieval hook — what it IS + 2-3 search terms in parens"
  tags: [tag1, tag2]
  confidence: high | medium | low
  last_verified: YYYY-MM-DD
  created: YYYY-MM-DD
  last_updated: YYYY-MM-DD
  sources: [source-slug-1]
  related: [entity-slug-1]
  ---
  # Entity Name
  Overview (2-3 sentences).
  - **From [Source]:** 2-3 sentences per source (bullet list, NOT separate headers)
  → See also: related-entity-links

**Source** (sources/SLUG.md):
  ---
  name: Source Title
  type: source
  source_type: article | paper | gist | session_log | doc | code | book | other
  url_or_path: https://...
  ingested: YYYY-MM-DD
  confidence: high | medium | low
  tags: [tag1, tag2]
  ---
  # Title
  SOURCE_TYPE | DATE | URL-or-path | Ingested: DATE
  Summary (3-5 paragraphs). Concepts (bulleted key:description). Relevance (1-2 sentences).
  → Related: entity-links

**Query** (queries/SLUG.md):
  # Query: Question
  Asked: DATE | Pages: slug-list
  Answer with citations. Evidence bullets. Gaps section.

## Rules
1. Never write raw/ (hook blocks it)
2. Always update index.md after wiki changes
3. Always append log.md after ingest/query/lint
4. Entity pages: add "- **From [Source]:**" bullet — never overwrite existing entries
5. Cross-link entities. Prefer update over create. Lint before bulk ops.
6. Frontmatter fields are all optional at write time (lint advisory only, never blocking)

## Formats
Log: `[YYYY-MM-DD HH:MM] TYPE detail` (INIT,INGEST,QUERY,LINT,SESSION_START,SESSION_END,EXTRACT)
Log rotation: >500 entries → /wiki-lint suggests archive
Index: `| page-path | summary | YYYY-MM-DD |` — every page gets a row, never remove rows
Slugs: lowercase, hyphens, max 50 chars

## Notes
Entity extraction is LLM judgment (intentional). Concurrent ingests may race on index.md (accepted).
Hooks do NOT parse YAML frontmatter — schema changes are invisible to the control path.
```

---

(End of SCHEMA.md content)

## Step 6 — Append Wiki Directive to CLAUDE.md

Check if `REPO_ROOT/CLAUDE.md` exists.

If it exists: check if `## Wiki` heading is already present (idempotency guard via grep).
If the heading is absent, append the directive block below.
If it doesn't exist: create the file with just the wiki section.

**Directive to append:**

```markdown

## Wiki
WIKI: /wiki-load <search> or browse wiki/index.md before answering project-domain questions. /wiki-query for synthesis.
```

This is the behavioral directive. The SessionStart hook provides location awareness;
this CLAUDE.md line tells Claude WHEN to check the wiki.

## Step 7 — Print Summary

Print a rich summary using the output-format.md character vocabulary:

```
╔═══════════════════════════════════════╗
║  📂 Wiki Initialized — [repo name]    ║
╚═══════════════════════════════════════╝

  ├─ wiki/
  │  ├─ index.md       master catalog
  │  ├─ log.md         event log
  │  ├─ SCHEMA.md      conventions (~183 tokens)
  │  ├─ entities/      concept pages
  │  ├─ sources/       ingested docs
  │  ├─ queries/       saved results
  │  └─ maintenance/   lint reports
  └─ raw/              drop sources here (LLM-write-protected)

━━━ Next Steps ━━━━━━━━━━━━━━━━━━━━━━━
  ▸ /wiki-ingest <file-or-url>  add knowledge (runs async)
  ▸ /wiki-query <question>      synthesize answers
  ▸ /wiki-load <topic>          JIT context from both tiers
  ▸ /wiki-lint                  health check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ◉ SessionStart hook active — wiki auto-injected on every future session
  ◉ CLAUDE.md updated — wiki directive ensures Claude checks wiki before answering
```
