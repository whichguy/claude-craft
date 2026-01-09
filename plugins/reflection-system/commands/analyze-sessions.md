---
description: Analyze audit evidence and propose skill recommendations (spawns Sonnet subagent)
argument-hint: "[scope:last|all]"
allowed-tools: Task, Read, Glob, Grep, Bash
---

# Session Analysis - Phase 2: Pattern Recognition

Analyze audit evidence from Phase 1 and generate skill recommendations using a Sonnet subagent.

## Prerequisites

This command expects evidence from `/reflect` to be available in the conversation context.
Look for the structured evidence between `REFLECTION_EVIDENCE_START` and `REFLECTION_EVIDENCE_END` markers.

If no evidence is found, run `/reflect mode:auto` first.

## Step 1: Validate Input

1. Check for evidence in conversation context
2. If no evidence found, inform user:
   ```
   No audit evidence found. Please run `/reflect` first to gather session data.
   ```

3. **Validate Phase 1 input**: Verify the evidence matches the contract from `/reflect`

```bash
# Validate Phase 1 output structure (from /reflect contract)
validate_phase1_input() {
  local json="$1"

  # Required top-level fields
  echo "$json" | jq -e '
    has("audit_timestamp") and
    has("scope") and
    has("sessions_analyzed") and
    has("evidence") and
    has("summary")
  ' >/dev/null 2>&1 || {
    echo "❌ Invalid Phase 1 data: Missing required fields"
    return 1
  }

  # Required evidence fields
  echo "$json" | jq -e '
    .evidence | has("explicit_corrections") and
    has("friction_points") and
    has("successes")
  ' >/dev/null 2>&1 || {
    echo "❌ Invalid Phase 1 data: Evidence missing required arrays"
    return 1
  }

  # Required summary fields
  echo "$json" | jq -e '
    .summary | has("total_signals") and
    has("correction_count") and
    has("friction_count") and
    has("success_count")
  ' >/dev/null 2>&1 || {
    echo "❌ Invalid Phase 1 data: Summary missing required counts"
    return 1
  }

  echo "✓ Phase 1 input validation passed"
  return 0
}
```

If validation fails, output:
```
Phase 1 data validation failed. The evidence from /reflect does not match
the expected contract. Please re-run /reflect mode:auto.
```

## Step 2: Sanitize Sensitive Data (CRITICAL - Security)

**Before passing any evidence to the subagent, sanitize potential credentials and secrets.**

Session JSONL files may contain API keys, passwords, tokens, or other sensitive data from user interactions.
The subagent should analyze behavioral patterns, not have access to actual secrets.

### Sanitization Patterns

Apply these regex replacements to ALL evidence text before subagent invocation:

```bash
# Create sanitization function
sanitize_evidence() {
  local input="$1"
  echo "$input" | sed -E '
    # API Keys (various formats)
    s/sk-[a-zA-Z0-9]{20,}/[REDACTED_API_KEY]/g
    s/sk-ant-[a-zA-Z0-9-]{80,}/[REDACTED_ANTHROPIC_KEY]/g
    s/sk-proj-[a-zA-Z0-9-]{80,}/[REDACTED_OPENAI_KEY]/g
    s/AIza[a-zA-Z0-9_-]{35}/[REDACTED_GOOGLE_KEY]/g
    s/ya29\.[a-zA-Z0-9_-]+/[REDACTED_OAUTH_TOKEN]/g
    s/gho_[a-zA-Z0-9]{36}/[REDACTED_GITHUB_TOKEN]/g
    s/ghp_[a-zA-Z0-9]{36}/[REDACTED_GITHUB_PAT]/g
    s/xoxb-[a-zA-Z0-9-]+/[REDACTED_SLACK_TOKEN]/g
    s/xoxp-[a-zA-Z0-9-]+/[REDACTED_SLACK_TOKEN]/g

    # Generic patterns
    s/Bearer [a-zA-Z0-9._-]+/Bearer [REDACTED_TOKEN]/gi
    s/Authorization: [a-zA-Z0-9._-]+/Authorization: [REDACTED]/gi
    s/api[_-]?key["'"'"'"]?\s*[:=]\s*["'"'"']?[a-zA-Z0-9_-]{16,}/api_key: [REDACTED]/gi
    s/api[_-]?secret["'"'"'"]?\s*[:=]\s*["'"'"']?[a-zA-Z0-9_-]{16,}/api_secret: [REDACTED]/gi
    s/password["'"'"'"]?\s*[:=]\s*["'"'"']?[^"'"'"'\s,}]+/password: [REDACTED]/gi
    s/secret["'"'"'"]?\s*[:=]\s*["'"'"']?[a-zA-Z0-9_-]{16,}/secret: [REDACTED]/gi
    s/token["'"'"'"]?\s*[:=]\s*["'"'"']?[a-zA-Z0-9._-]{20,}/token: [REDACTED]/gi

    # AWS credentials
    s/AKIA[A-Z0-9]{16}/[REDACTED_AWS_KEY]/g
    s/aws_access_key_id\s*=\s*[A-Z0-9]{20}/aws_access_key_id = [REDACTED]/gi
    s/aws_secret_access_key\s*=\s*[a-zA-Z0-9/+=]{40}/aws_secret_access_key = [REDACTED]/gi

    # Private keys (detect header)
    s/-----BEGIN [A-Z ]+ PRIVATE KEY-----/[REDACTED_PRIVATE_KEY_START]/g
    s/-----END [A-Z ]+ PRIVATE KEY-----/[REDACTED_PRIVATE_KEY_END]/g

    # Base64 encoded tokens (long strings that look like base64)
    s/eyJ[a-zA-Z0-9_-]{50,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/[REDACTED_JWT]/g

    # Connection strings
    s/(postgres|mysql|mongodb|redis):\/\/[^@]+@/\1:\/\/[REDACTED_CREDS]@/gi
  '
}
```

### Application Points

1. **Before storing evidence**: Sanitize each `explicit_corrections`, `friction_points`, and `successes` entry
2. **Before subagent prompt**: Sanitize the entire evidence JSON block
3. **In display output**: Keep sanitized versions in Step 5 display

### Verification

After sanitization, verify no obvious secrets remain:

```bash
# Check for potential leaked secrets (warning, not blocking)
echo "$SANITIZED_EVIDENCE" | grep -iE '(sk-|api[_-]?key|password|secret|token|bearer|private.key)' && \
  echo "⚠️ Warning: Potential sensitive data may remain - review manually"
```

### Logging

If any patterns were matched and sanitized:
```
🔒 Sanitized evidence: [N] potential credentials redacted
```

If no patterns matched:
```
✓ No obvious credentials detected in evidence
```

## Step 3: Read Existing Skills

Check for existing skills to avoid duplicates:

```bash
# List existing skills (directory structure: skills/{name}/SKILL.md)
for dir in ~/claude-craft/skills/*/; do
  if [[ -f "${dir}SKILL.md" ]]; then
    echo "${dir}SKILL.md"
  fi
done 2>/dev/null || echo "No existing skills"
```

For each existing skill, extract frontmatter to understand:
- `name`: Skill identifier (kebab-case, no prefix)
- `patterns`: What it catches
- `description`: What it does

Build a list of existing skills for overlap detection.

## Step 4: Spawn Analyzer Subagent

Use the Task tool to spawn a Sonnet subagent for analysis:

```
subagent_type: "general-purpose"
model: "sonnet"
```

**Prompt for subagent:**

```
You are a learning signal analyzer. Your job is to identify patterns in user feedback that should become persistent skills that Claude will actually discover and use.

## Input Evidence
{paste the structured evidence JSON here}

## Existing Skills (avoid duplicates)
{list of existing skill names and their patterns}

## Critical: Skill Discovery Requirements

Claude discovers skills via the `description` field. For a skill to be found, the description MUST contain trigger phrases that match user queries.

**BAD** (won't be discovered):
- "Prefer git -C over cd && git"
- "Use async/await patterns"

**GOOD** (will be discovered):
- "This skill should be used when the user asks to 'run git commands', 'execute git operations', mentions 'cd && git', or discusses directory-specific git workflows."
- "This skill should be used when the user asks to 'write async code', 'handle promises', mentions 'callback hell', or discusses asynchronous JavaScript patterns."

## Your Task

Analyze the evidence and output ONLY valid JSON with this exact schema:

```json
{
  "analysis_timestamp": "ISO8601",
  "signals": [
    {
      "id": "sig-001",
      "confidence": "high|medium|low",
      "category": "correction|friction|success",
      "evidence_quote": "exact quote from user's correction/feedback",
      "claude_mistake": "what Claude did/said that prompted this correction (extract from context before the correction)",
      "proposed_skill": {
        "name": "{descriptive-name}",
        "description": "This skill should be used when the user asks to '{action from evidence}', '{related action}', mentions '{keyword from evidence}', or discusses {topic area}.",
        "trigger_phrases": ["phrase that would trigger this skill", "another trigger phrase"],
        "facts": ["actionable fact 1 from evidence", "actionable fact 2"],
        "anti_patterns": ["what Claude should NOT do, based on the mistake"],
        "patterns": ["regex pattern to match"],
        "action": "create|update|skip"
      },
      "overlap_with_existing": null | "existing-skill-name"
    }
  ],
  "summary": {
    "total_signals": N,
    "high_confidence": N,
    "medium_confidence": N,
    "low_confidence": N,
    "create_recommended": N,
    "update_recommended": N,
    "skip_recommended": N
  }
}
```

## Field Requirements

### description (CRITICAL)
Format: "This skill should be used when the user asks to '{verb phrase}', '{verb phrase}', mentions '{keyword}', or discusses {topic}."
- Extract verbs and keywords directly from the evidence
- Include at least 2 trigger phrases
- Must be discoverable by Claude's skill matching

### trigger_phrases
- Short phrases (2-5 words) that would appear in user queries
- Extract directly from evidence context
- Examples: "run git commands", "write bash scripts", "handle errors"

### claude_mistake
- What Claude did wrong that prompted the correction
- Look at Claude's response BEFORE the user's correction
- This becomes the "What NOT to Do" in the skill

### anti_patterns
- Derived from claude_mistake
- Explicit "don't do this" statements
- Examples: ["Don't use cd && git pattern", "Don't assume default branch is master"]

### facts
- Actionable instructions, not descriptions
- Start with verbs: "Use", "Always", "Prefer", "Check"
- Examples: ["Use git -C <dir> instead of cd <dir> && git", "Always verify branch exists before checkout"]

## Confidence Criteria

- **high**: Direct, explicit correction with clear instruction ("No, always use X instead of Y")
- **medium**: Implicit preference or repeated pattern ("I keep having to...")
- **low**: Single occurrence, vague, or contextual preference

## Action Criteria

- **create**: New skill, no overlap with existing, confidence >= medium
- **update**: Overlaps >= 70% with existing skill, adds new facts
- **skip**: Low confidence, already covered, or too contextual

## Rules

1. Output ONLY the JSON - no markdown, no explanation, no commentary
2. Every fact must cite specific evidence
3. Patterns should be regex-compatible
4. Names should be kebab-case (no prefix needed)
5. Do not hallucinate - only extract what's explicitly stated in evidence
6. description field MUST follow the trigger format exactly
7. Always include claude_mistake and anti_patterns for corrections
```

## Step 5: Extract and Validate JSON

After receiving subagent response:

1. Search for JSON block (between ``` or starting with `{`)
2. Extract the JSON content
3. Validate with `jq`:
   ```bash
   echo "$RESPONSE" | jq . > /dev/null 2>&1 && echo "Valid JSON"
   ```
4. If invalid, retry with stricter prompt emphasizing JSON-only output

## Step 6: Display Recommendations

Format the recommendations for review:

```
Session Analysis - Recommendations
==================================

PROPOSED SKILLS:

[HIGH CONFIDENCE]
1. {name}/SKILL.md
   Description: {description}
   Facts: {facts}
   Evidence: "{quote}"
   Action: CREATE

[MEDIUM CONFIDENCE]
2. {name}/SKILL.md
   Description: {description}
   Facts: {facts}
   Evidence: "{quote}"
   Action: CREATE

[LOW CONFIDENCE - Manual Review Required]
3. {name}/SKILL.md
   Description: {description}
   Evidence: "{quote}"
   Action: SKIP (low confidence)

SUMMARY:
- {N} signals detected
- {N} recommended for creation
- {N} recommended for update
- {N} skipped
```

## Step 7: Pass to Phase 3

Output the recommendations for `/reconcile-skills`:

```
SKILL_RECOMMENDATIONS_START
{json recommendations}
SKILL_RECOMMENDATIONS_END
```

If in auto mode, proceed directly. If interactive, ask:
"Proceed to reconciliation phase? This will create/update skill files in ~/claude-craft/skills/"

## Error Handling

| Condition | Response |
|-----------|----------|
| No evidence found | "Run /reflect first" |
| Subagent fails | Retry once with simplified prompt |
| Invalid JSON output | Extract and retry, max 2 attempts |
| No signals detected | "No actionable learning signals found" |

## Phase Boundary Contract: Phase 2 → Phase 3

**This contract MUST be honored. Changes to this schema require updates to `/reconcile-skills` validation.**

### Output Schema (JSON Schema Draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "reflection-phase2-output",
  "title": "Phase 2 Skill Recommendations",
  "type": "object",
  "required": ["analysis_timestamp", "signals", "summary"],
  "properties": {
    "analysis_timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO8601 timestamp when analysis was performed"
    },
    "signals": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "confidence", "category", "evidence_quote", "proposed_skill"],
        "properties": {
          "id": {"type": "string", "pattern": "^sig-[0-9]{3}$"},
          "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
          "category": {"type": "string", "enum": ["correction", "friction", "success"]},
          "evidence_quote": {"type": "string", "minLength": 1},
          "claude_mistake": {"type": "string", "maxLength": 500},
          "proposed_skill": {
            "type": "object",
            "required": ["name", "description", "trigger_phrases", "facts", "action"],
            "properties": {
              "name": {"type": "string", "pattern": "^[a-z0-9-]+$"},
              "description": {
                "type": "string",
                "pattern": "^This skill should be used when",
                "description": "MUST start with trigger format for Claude discovery"
              },
              "trigger_phrases": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2
              },
              "facts": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1
              },
              "anti_patterns": {
                "type": "array",
                "items": {"type": "string"}
              },
              "patterns": {
                "type": "array",
                "items": {"type": "string"}
              },
              "action": {"type": "string", "enum": ["create", "update", "skip"]}
            }
          },
          "overlap_with_existing": {"type": ["string", "null"]}
        }
      }
    },
    "summary": {
      "type": "object",
      "required": ["total_signals", "high_confidence", "medium_confidence", "low_confidence", "create_recommended", "update_recommended", "skip_recommended"],
      "properties": {
        "total_signals": {"type": "integer", "minimum": 0},
        "high_confidence": {"type": "integer", "minimum": 0},
        "medium_confidence": {"type": "integer", "minimum": 0},
        "low_confidence": {"type": "integer", "minimum": 0},
        "create_recommended": {"type": "integer", "minimum": 0},
        "update_recommended": {"type": "integer", "minimum": 0},
        "skip_recommended": {"type": "integer", "minimum": 0}
      }
    }
  }
}
```

### Validation (for consumers)

Phase 3 (`/reconcile-skills`) MUST validate incoming recommendations:

```bash
# Validate Phase 2 output structure
validate_phase2_output() {
  local json="$1"

  # Required top-level fields
  echo "$json" | jq -e '
    has("analysis_timestamp") and
    has("signals") and
    has("summary")
  ' >/dev/null 2>&1 || return 1

  # Signals array with required fields
  echo "$json" | jq -e '
    .signals | type == "array" and
    (length == 0 or (.[0] | has("id") and has("confidence") and has("proposed_skill")))
  ' >/dev/null 2>&1 || return 1

  # Proposed skill has trigger-format description
  echo "$json" | jq -e '
    .signals | all(.proposed_skill.description | startswith("This skill should be used when"))
  ' >/dev/null 2>&1 || return 1

  # Summary has required counts
  echo "$json" | jq -e '
    .summary | has("total_signals") and
    has("create_recommended") and
    has("skip_recommended")
  ' >/dev/null 2>&1 || return 1

  return 0
}
```

## Notes

- This command does NOT write skill files (Phase 3 does that)
- Subagent runs with Sonnet model for cost efficiency
- Low-confidence signals are shown but not auto-applied
- Overlap detection prevents duplicate skills
