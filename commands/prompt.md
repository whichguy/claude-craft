---
argument-hint: "[template] [context...]"
description: "Load and execute a prompt template"
allowed-tools: "all"
---

# Prompt Template Executor

**Template**: $1  
**Context**: $2 $3 $4 $5 $6 $7 $8 $9

## Execution Flow

### If $1 is "--list":
List all available templates from these locations:
- Current directory (./*.md)
- Project prompts (./prompts/*.md)
- User Claude config (~/.claude/prompts/*.md)
- User home prompts (~/prompts/*.md)

Format as grouped list with location headers.

### Otherwise, load template "$1":

**Search order** (use first found):
1. ./$1.md
2. ./prompts/$1.md
3. ~/.claude/prompts/$1.md
4. ~/prompts/$1.md

**Processing steps**:
1. Read the template file content
2. Replace `<prompt-context>` with provided context
3. Execute the template as a prompt instruction
4. Return ONLY the execution result

**If not found**:
Show error with all searched locations and suggest using `--list` to see available templates.

## Output Requirements
- Direct execution result only
- No preamble like "The template was executed..."
- No meta-commentary about what happened
- Just the actual output from running the template