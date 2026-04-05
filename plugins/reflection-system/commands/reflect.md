---
description: "Retrieve knowledge from session history by topic, or process pending session queue"
argument-hint: "<topic> | --process-queue"
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash
---

# /reflect — Knowledge Retrieval & Session Processing

**Note:** `/reflect <topic>` is equivalent to `/wiki-load --global <topic>`. Prefer `/wiki-load`
for unified search across both project and global knowledge tiers.

Single entry point for the reflection system. Two modes:

1. **Topic query**: `/reflect <topic>` — search and synthesize knowledge on a topic
2. **Queue processing**: `/reflect --process-queue` — summarize pending sessions into knowledge

## Arguments

- `$ARGUMENTS` contains either:
  - A topic string (e.g., `mcp design`, `permission errors`, `git workflows`)
  - `--process-queue` to process pending session queue entries
  - Empty/no args — show status and available topics

## Step 1: Pre-flight

1. **Kill switch**: If `~/.claude/REFLECT_OFF` exists → "Reflection disabled. Remove `~/.claude/REFLECT_OFF` to enable." and stop.
2. **Knowledge directory**: Ensure `~/.claude/reflection-knowledge/sessions/` and `~/.claude/reflection-knowledge/topics/` exist. Create if missing.

## Step 2: Route by Mode

Parse `$ARGUMENTS`:
- If starts with `--process-queue` → go to **Queue Processing Mode** (Step 3)
- If starts with `--` but is not `--process-queue` → output "Unknown flag: {flag}. Usage: `/reflect <topic>` or `/reflect --process-queue`" and stop.
- If non-empty text → go to **Topic Retrieval Mode** (Step 4)
- If empty → go to **Status Mode** (Step 5)

---

## Step 3: Queue Processing Mode (`--process-queue`)

Process pending session queue entries and generate session summary files.

### 3.1: Find Pending Queue Entries

```bash
QUEUE_DIR="$HOME/.claude/reflection-queue"
# Find all pending entries
for QUEUE_FILE in "$QUEUE_DIR"/*.json; do
  [[ ! -f "$QUEUE_FILE" ]] && continue
  STATUS=$(jq -r '.status' "$QUEUE_FILE" 2>/dev/null)
  [[ "$STATUS" != "pending" ]] && continue
  # This is a pending entry
done
```

If no pending entries: output "No pending sessions to process." and stop.

**Processing order** (by priority field, then type):
1. `precompact_extract` (priority: high) — context preservation before compaction
2. `session_wiki` (priority: normal) — project wiki synthesis from session transcript
3. `wiki_change` (priority: normal) — global cross-project pattern synthesis
4. `session` (priority: normal, no type field) — global reflect summary (existing behavior)

**Re-entry guard**: Skip entries with `status: "in_progress"` if queued within the last 30 minutes.
Mark stale `in_progress` (>30 min old) back to `pending` before processing.

### 3.2: For Each Pending Entry, Generate Session Summary

For each pending queue entry (in priority order above):

**Route by `type` field:**

- If `type` is `"precompact_extract"` or `"session_wiki"`:
  Spawn a Sonnet subagent with the transcript to extract project wiki pages.
  Prompt: "Extract wiki pages from this session transcript. Write to wiki_path/entities/ and
  wiki_path/sources/. Update wiki_path/index.md. Append EXTRACT/INGEST log entries.
  Extraction criteria (write a page if ≥2 of): (a) named 3+ times, (b) non-obvious decision,
  (c) correction/confusion occurred, (d) named architectural component.
  Check existing pages before writing — prefer appending ## From Session [date] subsections."
  Mark entry completed/failed after agent returns.

- If `type` is `"wiki_change"`:
  Spawn a Sonnet subagent to synthesize cross-project patterns.
  Prompt: "These wiki pages changed: [changed_files]. Find cross-project patterns (same concept
  in 2+ project wikis) and write to ~/.claude/wiki/topics/. New concepts → confidence: low.
  Conflicts → add ## Conflict [date] subsection. Never modify project wikis."
  Mark entry completed/failed.

- If `type` is `"session"` or type field is absent (existing behavior):
  Continue to step 1 below.

1. **Read the queue entry** to get `session_id` and `transcript_path`
2. **Verify the transcript file exists**. If `transcript_path` is empty or the file doesn't exist, mark the queue entry as `"status": "error"` and skip to the next entry.
3. **Read the session JSONL** (the transcript file). Session JSONL files can be very large. To avoid blowing the context window:
   - Read only the last 2000 lines of the JSONL file (use the Read tool with offset/limit, or `tail -2000`)
   - Focus on extracting user messages (`"type":"human"`) and assistant messages (`"type":"assistant"`)
   - Skip tool use details, system messages, and base64/binary content
   - Target: pass ~50KB of conversation text to the subagent, not the entire file
4. **Spawn a Sonnet subagent** to extract a high-quality session summary

**Subagent prompt** (use `model: "claude-sonnet-4-6"` for cost efficiency):

```
subagent_type: "general-purpose"
model: "claude-sonnet-4-6"
```

Prompt for the subagent:

```
You are a session summarizer. Read the provided session transcript and extract a structured summary.

## Session Transcript
{read the JSONL file and extract human-readable conversation — assistant messages and user messages}

## Instructions

Produce a Markdown summary with these sections:

### Session Info
- Session ID: {session_id}
- Date: {extracted from timestamps}
- Project/CWD: {from queue entry}

### Key Decisions
Bullet list of significant decisions made during the session. Focus on:
- Architecture choices
- Technology selections
- Design trade-offs
- Approach changes

### Corrections & Learnings
Bullet list of any corrections the user made to Claude's behavior/output. For each:
- What Claude did wrong
- What the user corrected it to
- The underlying principle

### Outcomes
What was accomplished in this session.

### Topic Keywords
Comma-separated list of 3-8 topic keywords that describe what this session covered.
Examples: mcp-design, gas-permissions, git-workflow, testing, refactoring

## Rules
- Be concise — aim for 50-150 lines total
- Focus on transferable knowledge, not session-specific details
- Omit routine operations (file reads, basic edits) unless they revealed something interesting
- Capture the "why" behind decisions, not just the "what"
- Do NOT include any API keys, tokens, passwords, or credentials
- Do NOT include full file contents — summarize what was changed
```

5. **Write the summary** to `~/.claude/reflection-knowledge/sessions/{session_id}.md`
   Also write synthesized topic knowledge to `~/.claude/wiki/topics/` (primary global wiki tier).
   For backward compat, also write to `~/.claude/reflection-knowledge/topics/` during migration period.

6. **Update the index** (`~/.claude/reflection-knowledge/index.json`):
   - Add session entry: `{ "date": "<ISO8601>", "keywords": ["<kw1>", ...], "summary_path": "sessions/<session_id>.md" }`
   - The entry key is the `session_id` string, nested under the `"sessions"` object

7. **Mark queue entry as completed**:
   ```bash
   jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     '.status = "completed" | .processed_at = $ts' "$QUEUE_FILE" > "${QUEUE_FILE}.tmp" \
     && mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
   ```

### 3.3: Summary Output

After processing all entries:

```
Processed {N} session(s):
- {session_id_1}: {2-3 word description from keywords} → sessions/{session_id_1}.md
- {session_id_2}: {2-3 word description from keywords} → sessions/{session_id_2}.md

Knowledge base: {total_sessions} session summaries, {total_topics} topic files
```

---

## Step 4: Topic Retrieval Mode (`/reflect <topic>`)

Search the knowledge base for information on the given topic.

### 4.1: Search Topic Files First

Check if a consolidated topic file exists:

```bash
# Search topic files for matching names/content
TOPIC_DIR="$HOME/.claude/reflection-knowledge/topics"
```

Use Grep to search topic file names and content for the query terms. A topic file matches if:
- Its filename contains any query word (e.g., `mcp-design.md` matches "mcp")
- Its content contains the query terms

If a matching topic file exists and its `updated` frontmatter field (or file modification time as fallback) is within the last 30 days:
- Read and return the topic file content
- Append: "Source: consolidated from {N} sessions. Last updated: {date}."
- Stop here (topic file is the synthesized answer).

### 4.2: Search Session Summaries

If no topic file matched (or it's stale), search session summaries:

```bash
SESSION_DIR="$HOME/.claude/reflection-knowledge/sessions"
```

Use Grep to search all session summary files for the query terms. Rank results by:
1. **Keyword match** — query terms appear in the Topic Keywords section
2. **Content match** — query terms appear in the body
3. **Recency** — newer sessions rank higher

Select top 5 matching session summaries.

### 4.3: Synthesize

If matching sessions found, spawn a subagent to synthesize:

```
subagent_type: "general-purpose"
model: "claude-sonnet-4-6"
```

Prompt:

```
You are a knowledge synthesizer. The user asked about: "{topic}"

Here are relevant session summaries:

{paste top 5 matching session summary contents}

## Instructions

Synthesize the relevant knowledge into a coherent response. Structure as:

### What I Know About: {topic}

**Key Principles:**
- Bullet list of consolidated principles/rules

**Decisions Made:**
- Previous decisions related to this topic and their rationale

**Anti-Patterns:**
- Things to avoid, learned from corrections

**Open Questions:**
- Any unresolved aspects or areas needing more exploration

## Rules
- Only include information supported by the session summaries
- Prioritize actionable guidance over historical narrative
- If sessions contradict each other, note the contradiction and which is more recent
- Keep response under 100 lines
```

### 4.4: Display Results

Output the synthesized knowledge to the user.

Then ask: "Save as topic file? This consolidates {N} sessions into a reusable knowledge entry."

If user confirms, write to `~/.claude/wiki/topics/{topic-slug}.md` (primary) AND
`~/.claude/reflection-knowledge/topics/{topic-slug}.md` (backward compat) with:
- YAML frontmatter: `topic`, `created`, `updated`, `sources` (session IDs), `keywords`, `confidence`
- The synthesized content as the body

Also update `~/.claude/reflection-knowledge/index.json`:
- Add/update topic entry under `"topics"` with `file`, `keywords`, `source_sessions`, `created`, `updated`

### 4.5: No Results

If no matching sessions or topics found:

```
No knowledge found for "{topic}".

Available topics:
{list topic filenames from topics/ directory}

Recent sessions cover:
{list unique keywords from last 10 session summaries}

Tip: Run `/reflect --process-queue` to process any pending sessions first.
```

---

## Step 5: Status Mode (no arguments)

Display current knowledge base status:

```
Reflection Knowledge Base
=========================

Session summaries: {count files in sessions/}
Topic files: {count files in topics/}
Pending queue entries: {count pending in reflection-queue/}

Topics:
{list all .md files in topics/ with first line}

Recent sessions:
{list last 5 .md files in sessions/ with date and keywords}

Commands:
  /reflect <topic>          Search for knowledge on a topic
  /reflect --process-queue  Process pending session queue
  /consolidate [topic]      Merge sessions into topic file
```

---

## Error Handling

| Condition | Response |
|-----------|----------|
| REFLECT_OFF exists | "Reflection disabled. Remove `~/.claude/REFLECT_OFF` to enable." |
| No knowledge directory | Create it automatically |
| No session summaries exist | "No sessions summarized yet. Run `/reflect --process-queue` first." |
| Queue entry has no transcript | Skip entry, log warning |
| Transcript file missing | Skip entry, mark as "error" in queue |
| Subagent fails | Log error, continue with next entry |

## Security

When reading session JSONL files for summarization:
- The Haiku subagent prompt explicitly instructs not to include credentials
- Session summaries should contain behavioral patterns, not raw data
- If a summary contains obvious credential patterns (sk-, Bearer, etc.), warn the user

## Notes

- Session summaries are compact Markdown (50-150 lines), not full transcripts
- Topic files consolidate knowledge from multiple sessions
- The index.json tracks relationships but is not required for basic operation
- Queue processing is idempotent — re-running won't re-process completed entries
- This replaces the old 3-phase pipeline (reflect → analyze-sessions → reconcile-skills)
