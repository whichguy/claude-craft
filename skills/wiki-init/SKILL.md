---
name: wiki-init
description: |
  Set up an LLM wiki for this repository. Creates directory structure and SCHEMA.md.
  The SessionStart hook auto-detects and injects the wiki from this point forward.
  AUTOMATICALLY INVOKE when: "set up wiki", "wiki this repo", "create wiki",
  "create knowledge base", "track what I read", "initialize wiki"
  NOT for: querying (use /wiki-query), ingesting sources (use /wiki-ingest)
allowed-tools: Bash, Read, Write, Glob
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

## Step 1 — Idempotency Check

Check if `REPO_ROOT/WIKI_DIR/index.md` already exists.
If yes: print "Wiki already initialized at WIKI_DIR/. The SessionStart hook will auto-inject
context on next session start." and stop. Do not overwrite.

## Step 2 — Create Directory Structure

Use Bash `mkdir -p` to create:
- `WIKI_DIR/`
- `WIKI_DIR/entities/`
- `WIKI_DIR/sources/`
- `WIKI_DIR/queries/`
- `WIKI_DIR/maintenance/`
- `raw/`

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

[CURRENT_TIMESTAMP] INIT wiki-init: initialized wiki at WIKI_DIR/ with schema v1
```

(Replace CURRENT_TIMESTAMP with actual timestamp: `date '+%Y-%m-%d %H:%M'`)

## Step 5 — Write wiki/SCHEMA.md

Write `REPO_ROOT/WIKI_DIR/SCHEMA.md` with the following content:

---
schema_version: 1
---

# Wiki Schema v1

This wiki is maintained by Claude Code. Any LLM reading this file should follow
these conventions when creating, updating, or querying wiki pages.

## Directory Structure

```
wiki/
├── index.md           ← Master catalog (read this first for any wiki operation)
├── log.md             ← Append-only event log (never delete or reorder entries)
├── SCHEMA.md          ← This file
├── sources/           ← One page per ingested source
├── entities/          ← One page per named concept, person, system, or term
├── queries/           ← Saved query results (written by /wiki-query --save)
└── maintenance/       ← Lint reports (written by /wiki-lint)

raw/                   ← IMMUTABLE LLM-write-protected source files.
                          Drop files here manually. Never write programmatically.
```

Two-tier system:
- This wiki = project-scoped, manually curated via /wiki-ingest
- `~/.claude/wiki/topics/` = global, auto-written by reflect pipeline (Sonnet)
- Use `/wiki-load <topic>` to search both tiers

## Page Formats

### Source Page (wiki/sources/SLUG.md)

```markdown
# [Document Title]

**Source:** [URL or file path]  
**Date:** [YYYY-MM-DD]  
**Type:** article | paper | doc | book | code | other  
**Ingested:** [YYYY-MM-DD]  

## Summary

[3-5 paragraph summary]

## Key Concepts

- [Concept]: [one-line description]

## Relevance

[1-2 sentences on how this applies to this repo]

---
→ **Related:** [links to entity pages]
```

### Entity Page (wiki/entities/SLUG.md)

```markdown
# [Entity Name]

## Overview

[2-3 sentence definition]

## From [Source Title]

[2-3 sentences from this source's perspective]

---
→ **See also:** [related entity links]
```

### Query Page (wiki/queries/SLUG.md)

```markdown
# Query: [Question Text]

**Asked:** [YYYY-MM-DD]  
**Pages consulted:** [comma-separated slugs]  

## Answer

[Synthesized answer with inline citations]

### Evidence
- [point] ([source page](../sources/slug.md))

### Gaps

[What the wiki lacks on this topic]
```

## Log Format

Single line per entry:
```
[YYYY-MM-DD HH:MM] TYPE detail
```

Log rotation: when log.md exceeds 500 entries, /wiki-lint will suggest archiving to
`wiki/log-archive-YYYY.md`.

## Index Format

Markdown table under `## Pages`:
```
| Page | Summary | Last Updated |
|------|---------|--------------|
| [sources/slug.md](sources/slug.md) | One-line summary | YYYY-MM-DD |
```

Rules:
- Every wiki page (except index.md, log.md, SCHEMA.md) must have a row
- Add rows on ingest. Update `Last Updated` on modification. Never remove rows.

## LLM Maintenance Rules

1. **Never write to `raw/`** — immutable, LLM-write-protected (hook enforces this)
2. **Always update `wiki/index.md`** after creating/modifying any wiki page
3. **Always append to `wiki/log.md`** after ingest, query, or lint
4. **Entity pages**: add `## From [Source]` subsection — never overwrite existing sections
5. **Cross-links**: every entity page should link to related entities
6. **Prefer update over create**: check index.md first, append before creating
7. **Lint before bulk maintenance**: run /wiki-lint before major reorganization
8. **Entity extraction** is LLM judgment (intentional — semantic variation enriches the wiki)

## Concurrency Note

`log.md` appends using `>>` are POSIX-atomic for single-line writes (<4KB).
Concurrent /wiki-ingest calls from multiple sessions may race on `index.md` updates.
This is an accepted limitation for developer-local use — avoid running two ingests simultaneously.

## Slug Convention

Derive from title: lowercase, replace spaces/special chars with hyphens, truncate at 50 chars.
Example: "Attention Is All You Need" → `attention-is-all-you-need`

---

(End of SCHEMA.md content)

## Step 6 — Print Summary

Print a summary tree:

```
✓ Wiki initialized at WIKI_DIR/
  ├─ index.md       master catalog
  ├─ log.md         event log
  ├─ SCHEMA.md      conventions
  ├─ entities/      concept pages
  ├─ sources/       ingested docs
  ├─ queries/       saved results
  └─ maintenance/   lint reports

raw/                drop source files here (immutable)

Next steps:
  /wiki-ingest <file-or-url>  — add knowledge sources
  /wiki-query <question>      — synthesize answers
  /wiki-load <topic>          — load context for a topic
  /wiki-lint                  — health check

The SessionStart hook will now auto-inject this wiki's index
into every future session in this repo.
```
