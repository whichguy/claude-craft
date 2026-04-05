---
name: wiki-ingest
description: |
  Add a source to the project wiki. Spawns a background agent — the main conversation
  continues immediately while the wiki builds async. Zero wait time.
  AUTOMATICALLY INVOKE when: "ingest this", "add to wiki", "learn from this",
  "process this document", "track this article", "add this URL to wiki",
  "ingest this paper", "add this to the knowledge base"
  NOT for: querying (use /wiki-query), loading context (use /wiki-load)
allowed-tools: Agent, Bash, Read, Glob
argument-hint: "<file-path-or-url> [--interactive]"
---

# /wiki-ingest — Add Source to Project Wiki

Spawns a background Sonnet agent to ingest the source. The main conversation
continues immediately — no waiting.

## Step 0 — Parse Arguments

From `$ARGUMENTS`, extract:
- `SOURCE`: file path or URL (required)
- `INTERACTIVE`: true if `--interactive` flag present

## Step 1 — Find Wiki

Locate `WIKI_DIR` by searching for `wiki/index.md` starting from the git root.
Walk up the directory tree (max 4 levels).
If not found: print "No wiki found in this repo. Run /wiki-init first." and stop.

## Step 2 — Validate Input

If SOURCE looks like a URL (starts with `http://` or `https://`):
- Reject if scheme is not `http://` or `https://` (no `file://`, `ftp://`, localhost, RFC-1918)
- If invalid: abort with "Only http:// and https:// URLs are supported."

If SOURCE is a file path:
- Verify path stays within REPO_ROOT (no `../` traversal)
- If path escapes: abort with "File path must be within the repository."

## Step 3 — Print Start Message

Print: "📝 Ingesting [SOURCE] in background — keep working"

## Step 4 — Spawn Background Agent

Spawn a background Sonnet agent:

```
Agent(
  subagent_type = "general-purpose",
  model = "claude-sonnet-4-6",
  run_in_background = True,
  prompt = """
    Ingest this source into the project wiki.

    Source: SOURCE
    Wiki directory: WIKI_DIR
    Repo root: REPO_ROOT

    Instructions:

    1. Read the source:
       - If URL: WebFetch with 30s timeout. Abort with error if fetch fails.
       - If file path: Read tool. Abort if file not found.

    2. Extract metadata:
       - SOURCE_TITLE: document title or meaningful filename
       - SOURCE_DATE: publication date if detectable, else today YYYY-MM-DD
       - SOURCE_TYPE: article | paper | doc | book | code | other
       - SLUG: SOURCE_TITLE lowercased, spaces→hyphens, truncated at 50 chars

    3. Write WIKI_DIR/sources/SLUG.md (compact format — ~46% fewer tokens):
       # SOURCE_TITLE
       SOURCE_TYPE | SOURCE_DATE | SOURCE | Ingested: TODAY

       [3-5 paragraph summary]

       **Concepts:** [inline bulleted list — Concept (brief description), ...]

       **Relevance:** [1-2 sentences on how this applies to this repo]
       → Related: entity-slug-links

    4. For up to 5 entities from Key Concepts:
       Entity selection criteria (must meet ≥2):
         (a) Proper noun, named system, or domain concept with 3+ mentions
         (b) Non-obvious technical decision was made about it
         (c) It's a named architectural component or design pattern
         (d) Central to the source's thesis

       For each entity:
       - ENTITY_SLUG = entity name lowercased, hyphens, max 50 chars
       - If WIKI_DIR/entities/ENTITY_SLUG.md exists:
           Check if "**From SOURCE_TITLE:**" already present (idempotency).
           If absent: Edit to append a bullet under existing entries:
           - **From SOURCE_TITLE:** [2-3 sentences from this source's perspective]
       - If new entity (use compact format — ~46% fewer tokens than verbose):
           Write WIKI_DIR/entities/ENTITY_SLUG.md:
           # Entity Name
           [2-3 sentence overview/definition]

           - **From SOURCE_TITLE:** [2-3 sentences from this source's perspective]

           → See also: related-entity-slugs

    5. Update WIKI_DIR/index.md:
       Check for existing row by page path (idempotency).
       If row exists: update Last Updated date.
       If new: add row to the Pages table.
       Never duplicate rows.
       Also add rows for any new entity pages created.

    6. Append to WIKI_DIR/log.md:
       [TIMESTAMP] INGEST SOURCE_TITLE: created sources/SLUG.md; updated N entity pages
       If an INGEST entry for this source already exists from today: append (re-ingest) suffix.

    7. Return: "✓ Ingested SOURCE_TITLE — N pages written: [list of page paths]"
  """
)
```

## Step 5 — Handle Failure

If `--interactive` mode is active (foreground agent) and the agent returns an error or reports 0 pages written:
Print: "⚠️ Ingest failed for [SOURCE]: [error]. Try /wiki-ingest again or check the source."

For background (async) mode: monitor is not possible post-spawn. The agent logs its result
to `WIKI_DIR/log.md` on completion. The session-start hook will surface any failed queue
entries at the next session start.

## Step 6 — Interactive Mode

If `--interactive` flag was passed:
Stay in foreground. Ask: "What aspects are most relevant to this project? Any context to add?"
Capture the user's response as CONTEXT_NOTES and include it in the background agent prompt
(add to the prompt: "User context to emphasize: CONTEXT_NOTES").
