---
name: wiki-load
description: |
  JIT context loader: searches both project wiki AND global wiki for a topic.
  Loads raw pages into context — no synthesis. Zero overhead (user-invoked).
  This is the unified retrieval interface for all knowledge tiers.
  AUTOMATICALLY INVOKE when: "what do we know about", "load context for",
  "pull in wiki context", "find in wiki", "look up", "load the wiki page for",
  "what's in the wiki about", "load knowledge about"
  NOT for: synthesizing answers (use /wiki-query), ingesting sources (use /wiki-ingest)
allowed-tools: Bash, Read, Glob, Grep
argument-hint: "<topic> [--global] [--project]"
---

# /wiki-load — JIT Context Loader (Both Knowledge Tiers)

Load pages from the wiki into context on demand. Searches both the project wiki
AND the global wiki (`~/.claude/wiki/topics/`). Returns raw pages — no synthesis.

Use /wiki-query if you want a synthesized answer with citations.

## Step 0 — Parse Arguments

From `$ARGUMENTS`, extract:
- `TOPIC`: the search term (required)
- `GLOBAL_ONLY`: true if `--global` flag
- `PROJECT_ONLY`: true if `--project` flag
- Default (neither flag): search both tiers

Find `REPO_ROOT` via `git rev-parse --show-toplevel` if in a repo (for project tier).

## Step 1 — Project Tier Search (default or --project)

If not `GLOBAL_ONLY` and in a git repo with a wiki:

Locate `WIKI_DIR` (search for `wiki/index.md` from git root).
If found:
- Grep `WIKI_DIR/entities/` for TOPIC (case-insensitive) — select up to 3 best matches
- Grep `WIKI_DIR/sources/` for TOPIC — select up to 2 additional matches
- Prefer entity pages over source pages

## Step 2 — Global Tier Search (default or --global)

Check both paths (backward compat during reflect pipeline migration):
- `~/.claude/wiki/topics/`
- `~/.claude/reflection-knowledge/topics/`

Grep for TOPIC across both directories. Select up to 2 best matches.

## Step 3 — Read Pages

Read each matched page in full (max 7 pages total: up to 5 project + 2 global).

## Step 4 — Present Loaded Context

Print using the output-format character vocabulary:

```
╔═══════════════════════════════════════╗
║  📚 wiki-load — [TOPIC]               ║
╚═══════════════════════════════════════╝

  Project wiki ([M] pages)
  ├─ 🏠 entities/[slug].md    [first line of overview]
  ├─ 🏠 entities/[slug].md    [first line of overview]
  └─ 🏠 sources/[slug].md     [first line of summary]

  Global wiki ([K] topics)
  ├─ 🌐 topics/[slug].md      [first line of summary]
  └─ 🌐 topics/[slug].md      [first line of summary]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [N] pages loaded | /wiki-query for synthesis
```

After the summary, print each page's full content (this is the actual context injection).

If no matches in either tier:
```
  ⚠ No wiki pages found for '[TOPIC]'
  ▸ /wiki-ingest <source>  to add project knowledge
  ◉ Global topics auto-added after sessions discussing [TOPIC]
```

## Notes

- `/wiki-load` loads raw pages — the content appears in context for you to reference
- For synthesized answers with citations, use `/wiki-query`
- `/wiki-load --global <topic>` is the replacement for `/reflect <topic>`
