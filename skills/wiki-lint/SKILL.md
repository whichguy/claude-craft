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
Look for cases where two `- **From SOURCE:**` bullets make incompatible factual claims
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

## Step 8 — Write Report + Print Dashboard

Write `REPORT_PATH` with the full detailed report (markdown format for Obsidian readability).

Then print a **terminal dashboard** to the user:

```
╔═══════════════════════════════════════╗
║  🔍 Wiki Lint — [repo name]           ║
║  Pages: [N] | Date: TODAY             ║
╚═══════════════════════════════════════╝

  Health Checks
  ┌─ Orphan pages        [✓ 0 | ⚠ N found]
  ├─ Broken links        [✓ 0 | ✗ N broken]
  ├─ Contradictions      [✓ 0 | ⚠ N flagged]
  ├─ Stale pages (>180d) [✓ 0 | ⚠ N stale]
  ├─ Missing concepts    [✓ 0 | ▸ N suggested]
  └─ Log rotation        [✓ OK | ⚠ N entries > 500]

  [If any issues found, list top 3 most actionable:]
  ━━━ Top Actions ━━━━━━━━━━━━━━━━━━━━━
    1. [action — e.g., "Fix 2 broken links in entities/"]
    2. [action — e.g., "Create entity page for 'attention' (mentioned 5×)"]
    3. [action — e.g., "Review contradiction in transformer-architecture.md"]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Report: maintenance/lint-TODAY.md
```

Use `✓` for clean checks, `✗` for critical issues (broken links), `⚠` for warnings, `▸` for suggestions.

## Step 9 — Update Index and Log

Add lint report to `WIKI_DIR/index.md`:
`| maintenance/lint-TODAY.md | Lint report TODAY | TODAY |`

Append to `WIKI_DIR/log.md`:
`[TIMESTAMP] LINT lint-TODAY: N orphans, N broken links, N contradictions`
