---
name: wiki-lint
description: |
  Health check the project wiki. Finds orphans, broken links, contradictions, stale pages.
  Writes maintenance report. Suggests log rotation when log.md > 500 entries.
  AUTOMATICALLY INVOKE when: "wiki health check", "lint the wiki", "audit wiki",
  "find wiki issues", "check wiki quality", "wiki maintenance"
allowed-tools: Bash, Read, Write, Glob, Grep
model: sonnet
argument-hint: ""
---

# /wiki-lint — Project Wiki Health Check

Run a comprehensive health check on the project wiki. Write a maintenance report.

## Step 0 — Find Wiki

Locate `WIKI_DIR` by searching for `.wiki/log.md` from the git root upward (matches hook sentinel, max 4 levels).
If not found: print "No wiki found. Run /wiki-init first." and stop.

TODAY = current date YYYY-MM-DD
REPORT_PATH = `.wiki/maintenance/lint-TODAY.md`

## Step 1 — Inventory

Glob all `.md` files under `.wiki/`.
If file count > 200: print "Wiki has N files — processing first 200 only" and truncate.

Read `.wiki/index.md` for `INDEXED_PAGES` (all rows in the Pages table).

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

Count entries in `.wiki/log.md`.
If count > 500: add suggestion to archive: "Log has N entries (>500) — consider archiving old entries to .wiki/log-archive-YYYY.md"

## Step 8 — Find Missing v2 Frontmatter (advisory)

Read all entity pages under `.wiki/entities/` (cap at 200).
A page is missing v2 frontmatter if its YAML frontmatter block (between `---` delimiters) lacks ANY of:
`confidence`, `sources`, `related`, `description`
(a `description:` whose value is an empty string `""` counts as missing; pages with no `---` block at all are also flagged)

Collect MISSING_FRONTMATTER with page path and which fields are absent.

## Step 9 — Find Unresolved Contradictions

Read entity pages that contain a `## Contradictions` or `## Contradictions / Open Questions` section (grep first, then read those pages only — cap at 20).
A contradiction section is *unresolved* if it contains no line starting with `Decision:`, `Resolved:`, or the word `Unresolved` as an explicit marker.
An empty section body (section header with no content) counts as unresolved.

Collect UNRESOLVED_CONTRADICTIONS with page path and the section content.

## Step 10 — Find Stale High-Confidence Pages

Read entity pages with `confidence: high` in frontmatter (grep first, then read those pages — cap at 30).
A page is stale-high-confidence if `last_verified` is absent OR `last_verified` date is more than 180 days before TODAY.
This is an **advisory** flag only — never modify the confidence field.

Collect STALE_HIGH_CONFIDENCE with page path, last_verified date, and days elapsed.

## Step 10.5 — Hot + Underused Pages (schema v3 access reinforcement)

Read entity pages with `access_count:` in frontmatter (grep first; cap at 200).

**Hot pages**: top 10 by `access_count` value (descending). Skip pages with
`access_count: 0`. These are the high-value entities — surface to the user
so they know what's earning its keep.

**Underused pages**: pages where `access_count == 0` (or field absent) AND
`created` (or `last_updated` if `created` absent) is more than 90 days
before TODAY. These are stale-on-arrival — never accessed since creation.

Pages with neither field are fine — they're either pre-v3 (treated as
access_count=0) or freshly written and haven't been hit yet.

Collect HOT_PAGES (slug + count) and UNDERUSED_PAGES (slug + age_in_days).

## Step 11 — Write Report + Print Dashboard

Write `REPORT_PATH` with the full detailed report (markdown format for Obsidian readability).

Then print a **terminal dashboard** to the user:

```
╔═══════════════════════════════════════╗
║  🔍 Wiki Lint — [repo name]           ║
║  Pages: [N] | Date: TODAY             ║
╚═══════════════════════════════════════╝

  Health Checks
  ┌─ Orphan pages           [✓ 0 | ⚠ N found]
  ├─ Broken links           [✓ 0 | ✗ N broken]
  ├─ Contradictions         [✓ 0 | ⚠ N flagged]
  ├─ Stale pages (>180d)    [✓ 0 | ⚠ N stale]
  ├─ Missing concepts       [✓ 0 | ▸ N suggested]
  ├─ Log rotation           [✓ OK | ⚠ N entries > 500]
  ├─ Missing v2 frontmatter [✓ 0 | ⚠ N of M pending]
  ├─ Unresolved contradictions [✓ 0 | ⚠ N pages]
  ├─ Stale high-confidence  [✓ 0 | ⚠ N >180d]
  ├─ Hot pages (top 10)     [▸ N have access_count > 0]
  └─ Underused pages        [✓ 0 | ▸ N untouched in 90+ days]

  [If any issues found, list top 3 most actionable:]
  ━━━ Top Actions ━━━━━━━━━━━━━━━━━━━━━
    1. [action — e.g., "Fix 2 broken links in entities/"]
    2. [action — e.g., "Create entity page for 'attention' (mentioned 5×)"]
    3. [action — e.g., "Review contradiction in transformer-architecture.md"]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Report: maintenance/lint-TODAY.md
```

Use `✓` for clean checks, `✗` for critical issues (broken links), `⚠` for warnings, `▸` for suggestions.

## Step 12 — Update Index and Log

Add lint report to `.wiki/index.md`:
`| maintenance/lint-TODAY.md | Lint report TODAY | TODAY |`

Append to `.wiki/log.md`:
`[TIMESTAMP] LINT lint-TODAY: N orphans, N broken links, N contradictions`
