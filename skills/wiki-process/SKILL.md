---
name: wiki-process
description: |
  Process pending wiki queue entries — spawns Sonnet to extract knowledge from session
  transcripts and wiki changes. This is the engine that makes the wiki self-building.
  AUTOMATICALLY INVOKE when: "process wiki queue", "wiki process", "extract sessions",
  "process pending sessions", "run queue processing"
  Subcommands: --status (show queue), --consolidate <topic> (merge sessions into topic)
  NOT for: ingesting sources (use /wiki-ingest), querying (use /wiki-query)
allowed-tools: Agent, Task, Bash, Read, Write, Edit, Glob, Grep
model: sonnet
argument-hint: "[--status] [--consolidate <topic>]"
---

# /wiki-process — Queue Processing Engine

Process pending entries in `~/.claude/reflection-queue/`. Routes by entry type,
spawns Sonnet subagents to extract knowledge, writes to wiki.

Replaces `/reflect --process-queue` and `/consolidate`.

## Step 0 — Parse Arguments

From `$ARGUMENTS`:
- `--status` → go to Status Mode (Step 4)
- `--consolidate <topic>` → go to Consolidation Mode (Step 5)
- Empty or `--process-queue` → go to Queue Processing (Step 1)

## Step 1 — Find Pending Entries

```bash
QUEUE_DIR="$HOME/.claude/reflection-queue"
```

Find all `.json` files with `status: "pending"`. Also find `status: "in_progress"`
entries where `in_progress_at` is older than 30 minutes (stale) — mark them back to `pending` for retry.

If no pending entries: print "No pending entries to process." and stop.

## Step 2 — Route by Type (Priority Order)

Process entries in this order:
1. `precompact_extract` (priority: high) — context preservation
2. `session_wiki` — project wiki synthesis from transcript
3. `wiki_change` — global cross-project pattern synthesis
4. `session` (no type field, or type="session") — global session summary
5. `wiki_gap` (priority: normal) — review-plan wiki gap backfill
6. `skill_learning_evaluation` (priority: low) — review-plan skill learning verdicts

For each entry:
1. Read the queue entry JSON
2. Mark `status: "in_progress"` (prevents re-entrant processing)
3. Route to the appropriate handler below
4. On success: mark `status: "completed"` with `processed_at` timestamp
5. On failure: mark `status: "failed"` with `error` field

## Step 3 — Entry Type Handlers

### Type: `precompact_extract` or `session_wiki`

These extract project wiki pages from a session transcript.

1. Verify `transcript_path` exists and is readable. If not → mark "failed", skip.
2. Verify `wiki_path` directory exists. If not → mark "failed", skip.
3. Spawn a Sonnet subagent:

```
Agent(
  subagent_type = "general-purpose",
  model = "sonnet",
  prompt = """
    Extract wiki pages from this session transcript.

    Transcript: [transcript_path] (read last 2000 lines)
    Wiki path: [wiki_path]
    Existing index: [read wiki_path/index.md]

    For each significant entity, decision, or concept discussed:
    - If entity page exists in wiki/entities/: check if "**From Session [date]:**"
      bullet already present (idempotency). If absent → append bullet:
      - **From Session [date]:** [2-3 sentences]
    - If new: write entity page using compact format (see wiki-ingest for template).

    Extraction criteria — write a page only if the concept meets ≥2 of:
      (a) Named 3+ times in the session
      (b) A non-obvious decision was made about it
      (c) It caused confusion or correction
      (d) It's a named architectural component or design pattern

    Update wiki_path/index.md (retrieval-friendly summaries: what + 2-3 key search terms in parens).
    Append EXTRACT or INGEST log entries to wiki_path/log.md.
    Return: list of pages created/updated.
  """
)
```

### Type: `wiki_change`

Cross-project pattern synthesis from wiki file changes.

1. Read `changed_files` from entry.
2. Read each changed file.
3. Spawn a Sonnet subagent:

```
Agent(
  subagent_type = "general-purpose",
  model = "sonnet",
  prompt = """
    These wiki pages were updated in project [cwd]:
    [read each changed_file]

    Search ~/.claude/wiki/topics/ for existing global knowledge.
    Cross-project pattern: same concept in 2+ project wikis AND similar usage.

    Identify:
    1. Cross-project patterns → update/create ~/.claude/wiki/topics/SLUG.md
    2. New concepts → create with confidence: low
    3. Conflicts → add ## Conflict [date] subsection

    Write/merge to ~/.claude/wiki/topics/ only. Never modify project wikis.
  """
)
```

### Type: `session` (or no type field — legacy reflect entries)

Global session summary — the original reflect behavior.

1. Verify `transcript_path` exists. If not → mark "error", skip.
2. Read last 2000 lines of the transcript JSONL.
3. Spawn a Sonnet subagent:

```
Agent(
  subagent_type = "general-purpose",
  model = "sonnet",
  prompt = """
    You are a session summarizer. Extract a structured summary.

    ## Session Transcript
    [human-readable conversation from JSONL — user + assistant messages]

    ## Instructions
    Produce a Markdown summary:

    ### Session Info
    - Session ID, Date, Project/CWD

    ### Key Decisions
    Architecture choices, technology selections, design trade-offs.

    ### Corrections & Learnings
    What Claude did wrong, what user corrected, underlying principle.

    ### Outcomes
    What was accomplished.

    ### Topic Keywords
    3-8 comma-separated topic keywords.

    ## Rules
    - 50-150 lines total
    - Focus on transferable knowledge
    - Capture the "why" behind decisions
    - No credentials, no full file contents
  """
)
```

4. Write summary to `~/.claude/wiki/sessions/{session_id}.md`
   (Create `~/.claude/wiki/sessions/` if needed)
   Also write to `~/.claude/reflection-knowledge/sessions/{session_id}.md` (backward compat)

### Type: `wiki_gap`

Wiki knowledge gap identified by review-plan Phase 5e (citation resolution returned empty
for a Q-ID that fired with a non-trivial edit).

1. Read queue entry. Verify required fields: `q_id`, `trigger`, `action`. If missing → mark "failed", skip.
2. Spawn a Sonnet subagent to create or update the wiki entity page:

```
Agent(
  subagent_type = "general-purpose",
  model = "sonnet",
  prompt = """
    A review-plan run identified a wiki knowledge gap:
    Q-ID:    [q_id]
    Trigger: [trigger — what was missing from citation resolution]
    Action:  [action — suggested wiki entity or content to create]

    Read wiki/index.md and wiki/entities/ to check if a relevant page already exists.

    If relevant page exists: append a new "## From review-plan [date]" subsection
    with the content described in the Action field.

    If no relevant page exists: create wiki/entities/review-plan-[slug].md with
    standard v2 frontmatter (name, type="pattern", description, tags, confidence,
    last_verified, created) and a concise body (≤50 lines) capturing:
    - What the Q-ID checks and why it matters
    - The trigger pattern that caused the gap
    - Guidance for future citation resolution

    Update wiki/index.md with a one-line entry for the new/updated page.
    Append to wiki/log.md: "WIKI_GAP [date]: created/updated [page] from Q-[q_id] gap"
    Return: "created [page]" or "updated [page]"
  """
)
```

3. Mark entry `status: "completed"` with `processed_at` timestamp.

### Type: `skill_learning_evaluation`

Skill-learning evaluation verdict produced by review-plan Phase 5g Step 2 async agents.

1. Read queue entry. If missing or malformed JSON → log warning, mark "error", skip.
2. Check `verdict`:
   - **`RECOMMEND_CHANGE`**: Present `concrete_edit` to user with context from `category`,
     `title`, `evidence`, `action`. User applies or dismisses → mark `status: "completed"`.
   - **`DEFER`**: Read-modify-write `defer_count` atomically (write to `.tmp` then `mv`):
     ```python
     entry["defer_count"] = entry.get("defer_count", 0) + 1
     entry["status"] = "pending"      # explicit reset — required for re-pickup next run
     IF entry["defer_count"] >= 3:
         entry["verdict"] = "RECOMMEND_CHANGE"
         # Escalate: treat as RECOMMEND_CHANGE on next /wiki-process run
     Write(queue_path + ".tmp", json.dumps(entry))
     Bash(f"mv '{queue_path}.tmp' '{queue_path}'")
     ```
     Entry is reset to `status: "pending"` so it is picked up again next run.
   - **`REJECT`**: Mark `status: "completed"` silently (recommendation already implemented
     or contradicted by current file state).

## Step 4 — Status Mode (`--status`)

Display:
```
Wiki Knowledge System
=====================

Session summaries: {count in ~/.claude/wiki/sessions/ + ~/.claude/reflection-knowledge/sessions/}
Global topics:     {count in ~/.claude/wiki/topics/}
Queue pending:     {count pending in reflection-queue/}
Queue failed:      {count failed}

Recent sessions:
  {last 5 session summaries with date and keywords}

Topics:
  {list all .md files in ~/.claude/wiki/topics/ with first line}
```

## Step 5 — Consolidation Mode (`--consolidate <topic>`)

Merge multiple session summaries into a consolidated topic file.

1. Search all session summaries (both `~/.claude/wiki/sessions/` and
   `~/.claude/reflection-knowledge/sessions/`) for the topic term.
2. Rank by: keyword match > content match > recency.
3. Select top 10 matching sessions.
4. Spawn a Sonnet subagent to synthesize:

```
Agent(
  subagent_type = "general-purpose",
  model = "sonnet",
  prompt = """
    Synthesize knowledge about: [topic]

    Session summaries:
    [paste top 10 matching session contents]

    Produce:
    ### Key Principles
    ### Decisions Made
    ### Anti-Patterns
    ### Open Questions

    Only include information from the sessions. Note contradictions.
    Keep under 100 lines.
  """
)
```

5. Write to `~/.claude/wiki/topics/{topic-slug}.md` with YAML frontmatter
   (topic, created, updated, sources, keywords, confidence).
6. Print result and offer to review.

## Error Handling

| Condition | Action |
|---|---|
| No jq available | Print warning, stop |
| Transcript file missing | Mark entry "failed", skip, continue |
| Subagent fails | Mark entry "failed" with error, continue |
| Queue dir doesn't exist | Print "No queue directory found", stop |
