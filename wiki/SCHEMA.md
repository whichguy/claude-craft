---
schema_version: 1
---
# Wiki Schema v1

Dirs: wiki/{entities,sources,queries,maintenance}, raw/ (LLM-write-protected, hook enforced)
Global tier: ~/.claude/wiki/topics/ (Sonnet auto-writes) — /wiki-load searches both tiers

## Page Formats

**Source** (sources/SLUG.md):
  # Title
  TYPE | DATE | URL-or-path | Ingested: DATE
  Summary (3-5 paragraphs). Concepts (bulleted key:description). Relevance (1-2 sentences).
  → Related: entity-links

**Entity** (entities/SLUG.md):
  # Entity Name
  Overview (2-3 sentences).
  - **From [Source]:** 2-3 sentences per source (bullet list, NOT separate ## headers — saves tokens)
  → See also: related-entity-links

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

## Formats
Log: `[YYYY-MM-DD HH:MM] TYPE detail` (INIT,INGEST,QUERY,LINT,SESSION_START,SESSION_END,EXTRACT)
Log rotation: >500 entries → /wiki-lint suggests archive
Index: `| page-path | summary | YYYY-MM-DD |` — every page gets a row, never remove rows
Index summaries must be retrieval-friendly: start with what the page IS, then add 2-3 key terms a user would search for in parentheses. Example: "Runtime fix verifier — catches bad fixes and false-positive findings (review-fix, Phase 3.5, verification gate)"
Slugs: lowercase, hyphens, max 50 chars

## Notes
Entity extraction is LLM judgment (intentional). Concurrent ingests may race on index.md (accepted).
