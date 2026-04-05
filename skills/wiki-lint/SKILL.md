---
name: wiki-lint
description: |
  Health check the project wiki. Finds orphans, broken links, contradictions, stale pages.
  Writes maintenance report. Suggests log rotation when log.md > 500 entries.
  AUTOMATICALLY INVOKE when: "wiki health check", "lint the wiki", "audit wiki",
  "find wiki issues", "check wiki quality", "wiki maintenance"
allowed-tools: Bash, Read, Write, Glob, Grep
argument-hint: ""
---

# /wiki-lint — Project Wiki Health Check

Run a comprehensive health check on the project wiki. Write a maintenance report.

## Step 0 — Find Wiki

Locate `WIKI_DIR` by searching for `wiki/index.md` from the git root upward (max 4 levels).
If not found: print "No wiki found. Run /wiki-init first." and stop.

TODAY = current date YYYY-MM-DD
REPORT_PATH = `WIKI_DIR/maintenance/lint-TODAY.md`

## Step 1 — Inventory

Glob all `.md` files under `WIKI_DIR/`.
If file count > 200: print "Wiki has N files — processing first 200 only" and truncate.

Read `WIKI_DIR/index.md` for `INDEXED_PAGES` (all rows in the Pages table).

## Step 2 — Find Orphan Pages

An orphan page is in `WIKI_DIR` but:
1. Not listed in `INDEXED_PAGES` (not in index.md), AND
2. Not referenced (linked) by any other wiki page

To check inbound links: Grep for each page's filename across all wiki files.
Collect ORPHANS.

## Step 3 — Find Broken Links

Grep all wiki pages for markdown link patterns `[text](path)`.
For each internal link (not starting with `http`): verify the target file exists.
Cap at 50 pages for link checking. Note if truncated.
Collect BROKEN_LINKS with: page containing the link, link text, target path.

## Step 4 — Find Contradictions

Read entity pages (cap at 20).
Look for cases where two `## From SOURCE` subsections make incompatible factual claims
about the same entity (e.g., "X uses approach A" vs "X uses approach B").
Collect CONTRADICTIONS with entity page, claim A, claim B, and their sources.

## Step 5 — Find Stale Pages

A page is potentially stale if its `Last Updated` date in index.md is > 180 days ago.
Collect STALE_CANDIDATES.

## Step 6 — Find Missing Concepts

Terms appearing 3+ times across multiple pages but lacking their own entity page.
Cap at 10 results.
Collect MISSING_CONCEPTS.

## Step 7 — Check Log Size

Count entries in `WIKI_DIR/log.md`.
If count > 500: add suggestion to archive: "Log has N entries (>500) — consider archiving old entries to wiki/log-archive-YYYY.md"

## Step 8 — Write Report

Write `REPORT_PATH`:

```markdown
# Wiki Lint Report — TODAY

## Summary
| Check | Count |
|-------|-------|
| Orphan pages | N |
| Broken links | N |
| Contradictions | N |
| Stale pages (>180d) | N |
| Missing concept pages | N |

## Orphan Pages
[list with paths]

## Broken Links
[list: page → link text → broken target]

## Contradictions
[list: entity, claim A (source), claim B (source)]

## Stale Pages
[list: path, last updated]

## Missing Concepts
[list: term, frequency, pages where it appears]

## Recommended Actions
[Prioritized: fix broken links → create missing concept pages → review contradictions → triage orphans]
```

## Step 9 — Update Index and Log

Add lint report to `WIKI_DIR/index.md`:
`| maintenance/lint-TODAY.md | Lint report TODAY | TODAY |`

Append to `WIKI_DIR/log.md`:
`[TIMESTAMP] LINT lint-TODAY: N orphans, N broken links, N contradictions`
