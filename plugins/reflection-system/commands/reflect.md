---
description: Analyze recent sessions for learning signals (corrections, friction, successes)
argument-hint: "[mode:auto|interactive] [--scope:last|today|week]"
allowed-tools: Bash, Read, Glob, Grep
---

# Session Reflection - Phase 1: Audit

Analyze recent Claude Code sessions to extract learning signals for skill generation.

## Arguments
- `$1` = mode: `auto` (silent) or `interactive` (show findings, ask confirmation)
- `$2` = scope: `last` (most recent session), `today`, or `week`

Default: `mode:auto --scope:last`

## Step 1: Pre-flight Checks

First, verify the environment:

1. **Kill switch**: Check if `~/.claude/REFLECT_OFF` exists
   - If exists: Output "Reflection disabled (REFLECT_OFF exists). Run `reflect-on` to enable." and stop.

2. **Sessions directory**: Check if `~/.claude/sessions/` exists and has JSONL files
   - If missing or empty: Output helpful setup instructions and stop:
     ```
     No session data found. Session journaling may not be configured.

     To enable session journaling, ensure hooks are configured in ~/.claude/settings.json:

     "hooks": {
       "UserPromptSubmit": [{"command": "~/.claude/journal/journal_writer.sh UserPromptSubmit"}],
       "AssistantResponse": [{"command": "~/.claude/journal/journal_writer.sh AssistantResponse"}],
       "Stop": [{"command": "~/.claude/journal/journal_writer.sh Stop"}]
     }
     ```

## Step 2: Determine Scope

Based on the scope argument (`$2` or default `last`):

- **last**: Find the most recent session directory and JSONL file
  ```bash
  LATEST_DIR=$(ls -td ~/.claude/sessions/*/ 2>/dev/null | head -1)
  SESSION_FILES=$(ls -t "$LATEST_DIR"/*.jsonl 2>/dev/null | head -1)
  # Note: SESSION_FILES contains single file for 'last' scope, multiple for 'today'/'week'
  ```

- **today**: All sessions from today's date
  ```bash
  TODAY=$(date +%Y-%m-%d)
  SESSION_FILES=$(find ~/.claude/sessions/$TODAY -name "*.jsonl" 2>/dev/null)
  ```

- **week**: All sessions from the last 7 days
  ```bash
  SESSION_FILES=$(find ~/.claude/sessions -name "*.jsonl" -mtime -7 2>/dev/null)
  ```

## Step 3: Extract Evidence

Search for three categories of learning signals in the session files:

### 3.1 Explicit Corrections
User explicitly corrected Claude's behavior. **IMPORTANT**: For each correction, also capture what Claude said BEFORE the correction to understand the anti-pattern.

```bash
# Patterns: "No,", "Actually,", "Use X instead", "Don't do", "Wrong", "Not that"
# Enhanced: For each correction, find the preceding Claude response to capture the mistake

# Step 1: Find correction indices and their context
jq -s '
  # Flatten all entries with their index
  to_entries |

  # Find user messages matching correction patterns
  map(select(
    .value.eventType == "user" and
    ((.value.content.raw // .value.content) | test("(?i)^no[,.]|actually[,.]|use .* instead|don'\''t do|wrong|not that|should be"))
  )) |

  # For each correction, extract context
  map({
    index: .key,
    correction: (.value.content.raw // .value.content),
    session: .value.sessionId,
    timestamp: .value.timestamp
  })
' "$SESSION_FILES" > /tmp/corrections_indices.json

# Step 2: For each correction, get the preceding assistant message
jq -s --slurpfile corr /tmp/corrections_indices.json '
  . as $all |
  $corr[0] | map(
    . as $c |
    # Find the most recent assistant message before this correction
    ($all[0:$c.index] | reverse | map(select(.eventType == "assistant")) | first) as $prev |
    {
      correction: $c.correction,
      claude_mistake: (($prev.content.raw // $prev.content // "[no prior response found]") | .[0:500]),
      session: $c.session,
      timestamp: $c.timestamp
    }
  )
' "$SESSION_FILES"
```

**Why capture claude_mistake**: This becomes the "What NOT to Do" section in generated skills, showing what behavior triggered the correction.

### 3.2 Friction Points
Signs of repeated attempts or user frustration:
```bash
# Patterns: "Again", "Like I said", "Already told", "Still not", "Keep getting"
jq -r 'select(.eventType == "user") | .content.raw // .content' "$SESSION_FILES" | \
  grep -iE "again|like I said|already told|still not|keep getting|one more time"
```

### 3.3 Successes
Positive confirmations worth reinforcing:
```bash
# Patterns: "Perfect", "Exactly", "Works great", "That's right", "Good"
jq -r 'select(.eventType == "user") | .content.raw // .content' "$SESSION_FILES" | \
  grep -iE "perfect|exactly|works great|that's right|^good$|nice work|excellent"
```

## Step 4: Structure Evidence

Aggregate findings into a structured format:

```json
{
  "audit_timestamp": "ISO8601",
  "scope": "last|today|week",
  "sessions_analyzed": N,
  "files_scanned": N,
  "evidence": {
    "explicit_corrections": [
      {
        "correction": "User's correction text",
        "claude_mistake": "What Claude said/did before correction (truncated to 500 chars)",
        "session": "session-id",
        "timestamp": "ISO8601"
      }
    ],
    "friction_points": [
      {"text": "...", "session": "...", "timestamp": "..."}
    ],
    "successes": [
      {"text": "...", "session": "...", "timestamp": "..."}
    ]
  },
  "summary": {
    "total_signals": N,
    "correction_count": N,
    "friction_count": N,
    "success_count": N
  }
}
```

**Note**: The `claude_mistake` field is critical for Phase 2 analysis. It provides context for:
1. The "What NOT to Do" section in generated skills
2. The `anti_patterns` field in skill recommendations
3. The "Before (incorrect)" example in skill templates

## Step 5: Output Based on Mode

### If mode = `auto`:
- Output the structured evidence as JSON (for passing to Phase 2)
- No user interaction

### If mode = `interactive`:
- Display a formatted summary:
  ```
  Session Reflection - Audit Results
  ==================================
  Scope: {scope}
  Sessions analyzed: {N}

  CORRECTIONS FOUND ({N}):
  - "{text}" (session: {id})
  ...

  FRICTION POINTS ({N}):
  - "{text}" (session: {id})
  ...

  SUCCESSES ({N}):
  - "{text}" (session: {id})
  ...
  ```

- If no signals found: "No learning signals detected in recent sessions."

- If signals found, ask: "Proceed to analysis phase? (This will spawn a subagent to identify skill recommendations)"

## Step 6: Pass to Phase 2 (if proceeding)

If in auto mode or user confirmed, the evidence should be passed to `/analyze-sessions` via the prompt (not written to a file).

Output format for auto mode (can be piped to next command):
```
REFLECTION_EVIDENCE_START
{json evidence}
REFLECTION_EVIDENCE_END
```

## Error Handling

| Condition | Response |
|-----------|----------|
| REFLECT_OFF exists | "Reflection disabled. Run `reflect-on` to enable." |
| No sessions directory | Display setup instructions |
| No JSONL files | "No session data found for scope: {scope}" |
| jq not installed | Fallback to grep-only patterns |
| Parse errors | Skip malformed entries, continue |

## Phase Boundary Contract: Phase 1 → Phase 2

**This contract MUST be honored. Changes to this schema require updates to `/analyze-sessions` validation.**

### Output Schema (JSON Schema Draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "reflection-phase1-output",
  "title": "Phase 1 Audit Evidence",
  "type": "object",
  "required": ["audit_timestamp", "scope", "sessions_analyzed", "evidence", "summary"],
  "properties": {
    "audit_timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO8601 timestamp when audit was performed"
    },
    "scope": {
      "type": "string",
      "enum": ["last", "today", "week"],
      "description": "Audit scope parameter"
    },
    "sessions_analyzed": {
      "type": "integer",
      "minimum": 0,
      "description": "Number of session directories scanned"
    },
    "files_scanned": {
      "type": "integer",
      "minimum": 0,
      "description": "Number of JSONL files processed"
    },
    "evidence": {
      "type": "object",
      "required": ["explicit_corrections", "friction_points", "successes"],
      "properties": {
        "explicit_corrections": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["correction", "session", "timestamp"],
            "properties": {
              "correction": {"type": "string", "minLength": 1},
              "claude_mistake": {"type": "string", "maxLength": 500},
              "session": {"type": "string"},
              "timestamp": {"type": "string", "format": "date-time"}
            }
          }
        },
        "friction_points": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["text", "session", "timestamp"],
            "properties": {
              "text": {"type": "string", "minLength": 1},
              "session": {"type": "string"},
              "timestamp": {"type": "string", "format": "date-time"}
            }
          }
        },
        "successes": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["text", "session", "timestamp"],
            "properties": {
              "text": {"type": "string", "minLength": 1},
              "session": {"type": "string"},
              "timestamp": {"type": "string", "format": "date-time"}
            }
          }
        }
      }
    },
    "summary": {
      "type": "object",
      "required": ["total_signals", "correction_count", "friction_count", "success_count"],
      "properties": {
        "total_signals": {"type": "integer", "minimum": 0},
        "correction_count": {"type": "integer", "minimum": 0},
        "friction_count": {"type": "integer", "minimum": 0},
        "success_count": {"type": "integer", "minimum": 0}
      }
    }
  }
}
```

### Validation (for consumers)

Phase 2 (`/analyze-sessions`) MUST validate incoming evidence:

```bash
# Validate Phase 1 output structure
validate_phase1_output() {
  local json="$1"

  # Required top-level fields
  echo "$json" | jq -e '
    has("audit_timestamp") and
    has("scope") and
    has("sessions_analyzed") and
    has("evidence") and
    has("summary")
  ' >/dev/null 2>&1 || return 1

  # Required evidence fields
  echo "$json" | jq -e '
    .evidence | has("explicit_corrections") and
    has("friction_points") and
    has("successes")
  ' >/dev/null 2>&1 || return 1

  # Required summary fields
  echo "$json" | jq -e '
    .summary | has("total_signals") and
    has("correction_count") and
    has("friction_count") and
    has("success_count")
  ' >/dev/null 2>&1 || return 1

  return 0
}
```

## Notes

- This command does NOT write any files
- Evidence is passed via prompt to Phase 2
- Filtering excludes reflection sessions (containing "CLAUDE_REFLECTION_MODE")
