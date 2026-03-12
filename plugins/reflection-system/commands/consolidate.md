---
description: "Merge multiple session summaries into a consolidated topic knowledge file"
argument-hint: "<topic-name>"
allowed-tools: Task, Read, Write, Edit, Glob, Grep, Bash
---

# /consolidate — Topic Knowledge Consolidation

Merges multiple session summaries that touch the same topic into a single consolidated topic file.

Replaces the old `/reconcile-skills` command. Instead of generating individual skill files per correction, this produces high-level topic knowledge files.

## Arguments

- `$ARGUMENTS` contains either:
  - A topic name/slug (e.g., `mcp-design`, `git-workflows`, `gas-permissions`)
  - `--auto` to auto-detect topics from session keyword clusters
  - Empty — list sessions and suggest consolidation candidates

## Step 1: Pre-flight

1. **Kill switch**: If `~/.claude/REFLECT_OFF` exists → "Reflection disabled." and stop.
2. **Knowledge directory**: Verify `~/.claude/reflection-knowledge/sessions/` exists and has files.
   - If no session summaries: "No session summaries found. Run `/reflect --process-queue` first." and stop.

## Step 2: Route by Mode

- If `$ARGUMENTS` is `--auto` → go to **Auto-Detection** (Step 3)
- If `$ARGUMENTS` is a topic name → go to **Manual Consolidation** (Step 4)
- If empty → go to **Candidate Discovery** (Step 5)

---

## Step 3: Auto-Detection Mode (`--auto`)

### 3.1: Extract Keywords from All Sessions

Read the "Topic Keywords" section from each session summary in `~/.claude/reflection-knowledge/sessions/`. Build a frequency map:

```
keyword → [session_id_1, session_id_2, ...]
```

### 3.2: Identify Consolidation Candidates

A topic is a consolidation candidate when:
- 2+ sessions share the same keyword
- No existing topic file covers that keyword (or the topic file is older than the newest session)

### 3.3: Consolidate Each Candidate

For each candidate, run the **Manual Consolidation** flow (Step 4) with the keyword as topic name.

### 3.4: Report

```
Auto-consolidation complete:
- Created: {list of new topic files}
- Updated: {list of topic files refreshed with new sessions}
- Skipped: {keywords with only 1 session}
```

---

## Step 4: Manual Consolidation (`/consolidate <topic-name>`)

### 4.1: Find Related Sessions

Search all session summaries for the topic name:

1. **Keyword match**: Sessions whose Topic Keywords section contains the topic or related terms
2. **Content match**: Sessions whose body mentions the topic

Use Grep across `~/.claude/reflection-knowledge/sessions/*.md` for the topic terms.

If no matching sessions found:
```
No sessions found related to "{topic-name}".

Available keywords from session summaries:
{list unique keywords across all sessions}
```

### 4.2: Read Matching Sessions

Read the full content of each matching session summary (up to 10 sessions).

### 4.3: Check for Existing Topic File

Before synthesizing, check if `~/.claude/reflection-knowledge/topics/{topic-name}.md` already exists.
If it does, read its content — it will be passed to the subagent as "existing knowledge to merge with."

### 4.4: Synthesize Topic File

Spawn a subagent to synthesize:

```
subagent_type: "general-purpose"
model: "claude-haiku-4-5"
```

Prompt:

```
You are a knowledge consolidator. Merge these session summaries into a single topic knowledge file about: "{topic-name}"

## Session Summaries
{paste all matching session summary contents}

{IF existing topic file was found in Step 4.3:}
## Existing Knowledge (merge with new sessions)
{paste existing topic file content}

## Instructions

Create a consolidated knowledge file in Markdown with this structure:

---
topic: {topic-name}
created: {original creation timestamp, or current if new}
updated: {current ISO8601 timestamp}
sources: [{list of session IDs}]
keywords: [{merged keyword list}]
confidence: {high if 3+ sessions agree, medium if 2, low if extrapolated}
---

# {Topic Title}

## Summary
2-3 sentence overview of what we know about this topic.

## Key Principles
Bullet list of consolidated rules and principles. Each should be:
- Actionable (starts with a verb)
- Supported by evidence from multiple sessions where possible
- Marked with session count: (N sessions)

## Decisions Made
Previous decisions with rationale. Include:
- What was decided
- Why (the reasoning)
- When (which session)

## Anti-Patterns
Things to avoid, derived from corrections across sessions:
- What NOT to do
- Why it failed
- What to do instead

## Open Questions
Unresolved aspects or areas where sessions disagreed.

## Rules
- Only include knowledge supported by the session summaries
- When sessions contradict, note both positions and which is more recent
- Prioritize principles that appear in multiple sessions
- Keep the file under 150 lines
- Do NOT include credentials, tokens, or full code blocks from sessions
```

### 4.5: Write Topic File

Write the synthesized content to:
```
~/.claude/reflection-knowledge/topics/{topic-name}.md
```

### 4.6: Update Index

Update `~/.claude/reflection-knowledge/index.json`:
- Under the `"topics"` object, add/update the key `{topic-name}` with: `file`, `keywords`, `source_sessions`, `created`, `updated`
- Preserve any existing extra fields (e.g., `migrated_from`)

### 4.7: Report

```
Consolidated topic: {topic-name}
  Source sessions: {N}
  Keywords: {keyword list}
  Written to: topics/{topic-name}.md
  Confidence: {high|medium|low}
```

---

## Step 5: Candidate Discovery (no arguments)

List what's available for consolidation:

### 5.1: Build Keyword Frequency Map

Read Topic Keywords from all session summaries. Build frequency map.

### 5.2: Show Candidates

```
Consolidation Candidates
========================

Ready to consolidate (2+ sessions):
  mcp-design (4 sessions) → /consolidate mcp-design
  git-workflow (3 sessions) → /consolidate git-workflow
  gas-permissions (2 sessions) → /consolidate gas-permissions

Single-session topics (not enough for consolidation):
  testing, refactoring, deployment

Existing topic files:
  {list files in topics/ with last-modified date}

Commands:
  /consolidate <topic>    Consolidate a specific topic
  /consolidate --auto     Auto-consolidate all candidates
```

---

## Error Handling

| Condition | Response |
|-----------|----------|
| No session summaries | "Run `/reflect --process-queue` first." |
| Topic has only 1 session | Consolidate anyway but mark confidence as "low" |
| Subagent fails | Log error, skip topic |
| Write fails | Report permission error |

## Notes

- Topic files are the high-level replacement for individual skill files
- Consolidation is idempotent — running twice on the same topic updates the file
- The `--auto` mode is designed for periodic maintenance
- Topic files can be manually edited after generation
- This replaces the old `/reconcile-skills` command
