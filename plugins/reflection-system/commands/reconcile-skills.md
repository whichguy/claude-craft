---
description: Create or update skill files based on analysis recommendations
argument-hint: "[mode:auto|interactive]"
allowed-tools: Read, Write, Glob, Bash
---

# Skill Reconciliation - Phase 3: Apply Changes

Create or update skill files in `~/claude-craft/skills/` based on recommendations from Phase 2.

## Arguments
- `$1` = mode: `auto` (apply high/medium confidence automatically) or `interactive` (confirm each)

Default: `mode:auto`

## Prerequisites

This command expects recommendations from `/analyze-sessions` to be available in the conversation context.
Look for the structured JSON between `SKILL_RECOMMENDATIONS_START` and `SKILL_RECOMMENDATIONS_END` markers.

If no recommendations found, inform user:
```
No skill recommendations found. Please run the full reflection loop:
1. /reflect mode:auto
2. /analyze-sessions
3. /reconcile-skills
```

## Step 1: Pre-flight Checks

1. **Kill switch**: Check if `~/.claude/REFLECT_OFF` exists
   - If exists: Output "Reflection disabled. Run `reflect-on` to enable." and stop.

2. **Skills directory**: Ensure `~/claude-craft/skills/` exists
   ```bash
   mkdir -p ~/claude-craft/skills
   ```

**IMPORTANT: Claude Code Skill Discovery Format**

Claude Code discovers skills using the `skills/{skill-name}/SKILL.md` directory structure:
- Each skill is a **directory** containing a `SKILL.md` file (NOT a flat markdown file)
- The `SKILL.md` filename is required (Claude Code scans for this exact filename)
- Progressive disclosure: metadata always loaded, body when triggered, references when needed

3. **Parse recommendations**: Extract JSON from conversation context

4. **Validate Phase 2 input**: Verify the recommendations match the contract

```bash
# Validate Phase 2 output structure (from /analyze-sessions contract)
validate_phase2_input() {
  local json="$1"

  # Required top-level fields
  echo "$json" | jq -e '
    has("analysis_timestamp") and
    has("signals") and
    has("summary")
  ' >/dev/null 2>&1 || {
    echo "❌ Invalid Phase 2 data: Missing required fields (analysis_timestamp, signals, summary)"
    return 1
  }

  # Signals array with required fields
  echo "$json" | jq -e '
    .signals | type == "array" and
    (length == 0 or (.[0] | has("id") and has("confidence") and has("proposed_skill")))
  ' >/dev/null 2>&1 || {
    echo "❌ Invalid Phase 2 data: Signals array malformed"
    return 1
  }

  # Proposed skill has trigger-format description (CRITICAL for discovery)
  local bad_descriptions=$(echo "$json" | jq -r '
    .signals[] | select(.proposed_skill.description | startswith("This skill should be used when") | not) | .proposed_skill.name
  ')
  if [[ -n "$bad_descriptions" ]]; then
    echo "⚠️ Warning: These skills have non-discoverable descriptions (missing trigger format):"
    echo "$bad_descriptions" | while read name; do echo "   - $name"; done
    echo "   Skills with simple descriptions will NOT be discovered by Claude."
  fi

  # Summary has required counts
  echo "$json" | jq -e '
    .summary | has("total_signals") and
    has("create_recommended") and
    has("skip_recommended")
  ' >/dev/null 2>&1 || {
    echo "❌ Invalid Phase 2 data: Summary missing required counts"
    return 1
  }

  echo "✓ Phase 2 input validation passed"
  return 0
}
```

If validation fails, output:
```
Phase 2 data validation failed. The recommendations from /analyze-sessions
do not match the expected contract. Please re-run /analyze-sessions.
```

## Step 2: Filter Recommendations

For each signal in the recommendations:

### Auto Mode Filters:
- **CREATE**: confidence = high OR medium, action = create
- **UPDATE**: confidence = high OR medium, action = update
- **SKIP**: confidence = low OR action = skip

### Interactive Mode:
- Show ALL signals, ask confirmation for each

## Step 3: Process Each Signal

For each signal to process:

### 3.1 Check Existing Skill

**Note**: Skills use directory structure `skills/{skill-name}/SKILL.md`, NOT flat files.

```bash
# Get skill name (strips memory- prefix if present for backward compatibility)
SKILL_NAME=${signal.proposed_skill.name#memory-}
SKILL_DIR=~/claude-craft/skills/${SKILL_NAME}
SKILL_PATH=${SKILL_DIR}/SKILL.md

if [[ -f "$SKILL_PATH" ]]; then
  echo "Skill exists: $SKILL_PATH"
  # Read existing content for merge
fi
```

### 3.2 Generate Skill Content

**CRITICAL**: Skills must follow Claude Code's official format for discovery:
- File MUST be named `SKILL.md` (exact case)
- Frontmatter MUST have `name` and `description` fields
- Description MUST use trigger format: "This skill should be used when..."
- Body uses imperative/infinitive form, NOT second person

Use this template:

```markdown
---
name: {SKILL_NAME - kebab-case}
description: {signal.proposed_skill.description}
version: 1.0.0
generated: true
created: {ISO8601 timestamp}
source: reflection-system
confidence: {signal.confidence}
---

# {Title from name, converted to Title Case}

> Auto-generated skill from reflection system analysis.

## Overview

Provide guidance for {topic inferred from evidence and trigger phrases}.

## When This Applies

Activate this skill when:
{for each trigger_phrase in signal.proposed_skill.trigger_phrases}
- User asks to "{trigger_phrase}"
{end}
- Context involves {inferred topic from evidence}

## Guidelines

{for each fact in signal.proposed_skill.facts}
### {derive header from fact}

{fact as expanded actionable guidance}

{end}

## Anti-Patterns

Avoid these patterns identified from past mistakes:

{for each anti_pattern in signal.proposed_skill.anti_patterns}
- **{anti_pattern}**
{end}

## Evidence

This skill was generated from user feedback:

> "{signal.evidence_quote}"

**Original mistake that prompted this skill:**
> {signal.claude_mistake}

## Example

**Incorrect approach:**
```
{signal.claude_mistake or inferred from evidence - as code/command if applicable}
```

**Correct approach:**
```
{correct behavior based on facts - as code/command if applicable}
```
```

### 3.3 Handle Updates (merge existing)

If action = update and skill exists:
1. Read existing skill
2. Parse existing facts and patterns
3. Merge new facts (deduplicate)
4. Update `modified` timestamp
5. Preserve original `created` timestamp

### 3.4 Write Skill File

**Create skill directory and write SKILL.md:**

```bash
# Create skill directory (Claude Code requires directory structure)
mkdir -p "$SKILL_DIR"

# Write to SKILL.md inside the directory
cat > "$SKILL_PATH" << 'EOF'
{generated content}
EOF

echo "✓ Created skill: $SKILL_DIR/SKILL.md"
```

**Optional: Create references directory for additional context**

If the skill has extensive documentation needs:
```bash
mkdir -p "$SKILL_DIR/references"
# Additional context files can be placed here
```

## Step 4: Interactive Mode Confirmations

If mode = `interactive`, for each signal:

```
PROPOSED SKILL: {name}
Confidence: {confidence}
Action: {action}
Description: {description}
Evidence: "{quote}"

Facts to add:
- {fact1}
- {fact2}

[C]reate / [S]kip / [E]dit description / [Q]uit?
```

Wait for user response before proceeding.

## Step 5: Summary Report

After processing all signals:

```
Skill Reconciliation Complete
=============================

CREATED:
- {name1}/SKILL.md
- {name2}/SKILL.md

UPDATED:
- {name3}/SKILL.md (added 2 facts)

SKIPPED:
- {name4} (low confidence)
- {name5} (user declined)

Total: {N} skills modified

Skills are stored in: ~/claude-craft/skills/{skill-name}/SKILL.md
Run `/prompt list` to verify skill discovery.
```

## Step 6: Completion Signal

Output completion marker for the stop hook:

```
reflection complete
```

This signals the auto-reflection loop to exit.

## Error Handling

| Condition | Response |
|-----------|----------|
| No recommendations | "Run /analyze-sessions first" |
| Write permission denied | "Cannot write to ~/claude-craft/skills/. Check permissions." |
| Invalid recommendation JSON | "Malformed recommendations. Re-run /analyze-sessions." |
| Git conflict | "Skill file modified externally. Manual merge required." |

## Skill File Format Reference

**Directory Structure** (required by Claude Code):
```
~/claude-craft/skills/
└── {skill-name}/           # Directory named after skill (kebab-case)
    ├── SKILL.md            # Required - main skill definition
    └── references/         # Optional - additional context files
```

**SKILL.md Format**:
```yaml
---
name: example-skill             # Kebab-case (no memory- prefix)
description: "This skill should be used when the user asks to 'action 1', 'action 2', mentions 'keyword', or discusses topic."  # MUST use trigger format
version: 1.0.0                  # Semantic version
generated: true                 # Marks as auto-generated
created: 2026-01-06T15:30:00Z   # Original creation time
modified: 2026-01-06T16:00:00Z  # Last update (if updated)
source: reflection-system       # Origin system
confidence: high|medium|low     # Analysis confidence
---

# Skill Title

## Overview
Brief description of what this skill provides.

## When This Applies
- User asks to "action 1"
- User mentions "keyword"

## Guidelines
### Guideline 1
Actionable guidance...

## Anti-Patterns
- What NOT to do

## Evidence
> "Quote from user feedback"
```

**Critical**: The `description` field MUST use the trigger format "This skill should be used when the user asks to..." for Claude to discover and activate the skill. Simple summaries like "Prefer X over Y" will NOT be discovered.

## Notes

- Skills are written to `~/claude-craft/skills/{skill-name}/SKILL.md` (directory structure required by Claude Code)
- Git history tracks all changes (no separate history directory needed)
- Low-confidence signals require interactive mode to apply
- The `reflection complete` output is critical for auto-loop termination
