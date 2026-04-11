---
schema_version: 2
---
# Wiki Schema v2

Dirs: wiki/{entities,sources,queries,maintenance}, raw/ (LLM-write-protected, hook enforced)
Global tier: ~/.claude/wiki/topics/ (Sonnet auto-writes) — /wiki-load searches both tiers

## Page Formats

**Entity** (entities/SLUG.md):
```yaml
---
name: Entity Name
type: entity
description: "One-line retrieval hook — what it IS + 2-3 search terms in parens"
tags: [tag1, tag2]
confidence: high | medium | low      # discipline scaffold: commit at write time
last_verified: YYYY-MM-DD            # human-updated; lint flags high+>180d as advisory
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
sources: [source-slug-1]             # explicit backref to sources/
related: [entity-slug-1]             # graph edges; augments → See also: footer
---
```
  # Entity Name
  Overview (2-3 sentences).
  - **From [Source]:** 2-3 sentences (bullet list, NOT separate headers — saves tokens)
  → See also: related-entity-links

  Optional sections (add when content warrants — empty section is acceptable):
  ## Contradictions / Open Questions
  [Claim A from Session X vs Claim B from Session Y. Decision: ... | Unresolved]

  ## Changelog
  [Only when consolidating old bullets. Manual; no auto-consolidation.]

**Source** (sources/SLUG.md):
```yaml
---
name: Source Title
type: source
source_type: article | paper | gist | session_log | doc | code | book | other
url_or_path: https://...
ingested: YYYY-MM-DD
confidence: high | medium | low
tags: [tag1, tag2]
---
```
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
Index summaries: start with what the page IS + 2-3 key search terms in parens
Slugs: lowercase, hyphens, max 50 chars

## Confidence Field

`confidence: high | medium | low` is a **discipline scaffold** — writers commit at creation time, readers use it as a signal. It is NOT a truth tracker or an enforcement gate.

- `high` — ≥3 session citations AND ≥5 concrete claims AND ≥2 cross-references
- `medium` — ≥1 session citation with concrete claims, OR ≥1 source citation (default for most pages)
- `low` — speculative single-session origin, no concrete claims

`last_verified` is human-updated when a page is actively reviewed. Lint fires advisory-only at `confidence: high` + `last_verified > 180d` — no auto-demotion.

## NOT in v2
- ❌ Bullet-level `(SUPERSEDES …)` syntax — use `## Contradictions` section instead
- ❌ `confidence` auto-decay timers or auto-demotion
- ❌ `supersedes` / `superseded_by` frontmatter fields
- ❌ Auto-consolidation of narrative sediment (>8 bullets)

## Formatting Eras

**Pre-v2 pages** (created before 2026-04) may use `## Section` headers instead of `- **From Source:**` bullets. Both formats are valid and intentionally preserved. Tooling that counts `- **From Session:**` bullets must include a word-count fallback (>100 words → `medium` confidence) to correctly classify pre-v2 pages. Do not mass-convert section-header pages to bullet format — the content tradeoffs differ per page.

## Notes
Entity extraction is LLM judgment (intentional). Concurrent ingests may race on index.md (accepted).
Hooks (wiki-detect, wiki-notify, wiki-common.sh) do NOT parse YAML frontmatter — schema changes are invisible to the control path.
