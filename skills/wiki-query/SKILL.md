---
name: wiki-query
description: |
  Synthesize an answer from the project wiki with citations.
  Optionally save the result as a new wiki page.
  AUTOMATICALLY INVOKE when: "query the wiki", "what does the wiki say about",
  "synthesize from wiki", "wiki answer for", "ask the wiki about"
  NOT for: loading raw context (use /wiki-load), ingesting sources (use /wiki-ingest)
allowed-tools: Bash, Read, Write, Glob, Grep
argument-hint: "<question> [--save]"
---

# /wiki-query — Synthesize Answer from Project Wiki

Search the project wiki and synthesize a cited answer to a question.

## Step 0 — Parse Arguments

From `$ARGUMENTS`, extract:
- `QUESTION`: the question text (everything except flags)
- `SAVE`: true if `--save` flag present

## Step 1 — Find Wiki

Locate `WIKI_DIR` by searching for `wiki/index.md` from the git root upward (max 4 levels).
If not found: print "No wiki found. Run /wiki-init first." and stop.

## Step 2 — Read Index

Read `WIKI_DIR/index.md` in full.
This is the navigation map — never skip this step even if index was injected at session start.
Fresh read ensures synthesis reflects any pages added during this session.

## Step 3 — Identify Relevant Pages

From QUESTION and index contents, identify which pages are most likely relevant.
Select up to 8 pages, prioritized by:
1. Exact keyword match in summary
2. Related entity pages (same topic area)
3. Source pages from the same domain

## Step 4 — Read Relevant Pages

Read each page in the relevant set using the Read tool.
If a page is listed in index.md but the file doesn't exist:
Skip it and note: "Page [name] referenced in index but not found — run /wiki-lint"

## Step 5 — Synthesize Answer

Compose an answer using the evidence gathered:

Format:
```
## Answer

[Direct answer — 1-3 sentences]

### Evidence
- [point from page-name](path/to/page.md)
- [point from other-page](path/to/other.md)

### Gaps
[What the wiki doesn't cover — suggest which sources to ingest if relevant]
```

Cite specific pages inline. Acknowledge when evidence is thin.

## Step 6 — Save Result (if --save)

If `SAVE` is true:
- SLUG = first 8 words of QUESTION, lowercased, hyphens
- Write answer to `WIKI_DIR/queries/SLUG.md` with full answer + metadata
- Add row to `WIKI_DIR/index.md`
- Append to `WIKI_DIR/log.md`: `[TIMESTAMP] QUERY SLUG: synthesized from N pages`

## Step 7 — Print Answer

Print the answer using rich output formatting:

```
╔═══════════════════════════════════════╗
║  🔎 wiki-query                        ║
╚═══════════════════════════════════════╝

## Answer

[Direct answer — 1-3 sentences]

  Evidence ([N] pages consulted)
  ├─ [point] — sources/page-name.md
  ├─ [point] — entities/entity-name.md
  └─ [point] — sources/other-page.md

  [If gaps exist:]
  ⚠ Gaps
  └─ [What the wiki doesn't cover — suggest /wiki-ingest targets]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [N] pages consulted | [if --save: 📝 Saved to queries/SLUG.md]
```
