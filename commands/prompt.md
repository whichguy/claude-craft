---
argument-hint: "[template] [context...]"
description: "Load and execute a prompt template"
allowed-tools: "all"
---

# Prompt Template Executor

**Template**: $1  
**Context**: $2 $3 $4 $5 $6 $7 $8 $9

## Execution Flow

Execute this bash script to find and load the template:

```bash
#!/bin/bash
set -euo pipefail

TEMPLATE="$1"
shift || true
CONTEXT="$*"

# Handle --list option
if [ "$TEMPLATE" = "--list" ]; then
    echo "## Available Prompt Templates"
    
    # Current directory
    if ls ./*.md 2>/dev/null | head -1 >/dev/null; then
        echo -e "\n### Current Directory (./):"
        rg --files --glob "*.md" . 2>/dev/null | while read -r f; do
            basename "$f" .md
        done | sort | sed 's/^/- /'
    fi
    
    # User Claude config
    if [ -d "$HOME/.claude/prompts" ]; then
        echo -e "\n### User Claude Prompts (~/.claude/prompts/):"
        rg --files --glob "*.md" "$HOME/.claude/prompts" 2>/dev/null | while read -r f; do
            basename "$f" .md
        done | sort | sed 's/^/- /'
    fi
    
    # Git parent prompts
    GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
    if [ -n "$GIT_ROOT" ]; then
        GIT_PARENT_PROMPTS="$(dirname "$GIT_ROOT")/prompts"
        if [ -d "$GIT_PARENT_PROMPTS" ]; then
            echo -e "\n### Git Parent Prompts ($GIT_PARENT_PROMPTS/):"
            rg --files --glob "*.md" "$GIT_PARENT_PROMPTS" 2>/dev/null | while read -r f; do
                basename "$f" .md
            done | sort | sed 's/^/- /'
        fi
    fi
    exit 0
fi

# Find git parent prompts directory
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
GIT_PARENT_PROMPTS=""
if [ -n "$GIT_ROOT" ]; then
    GIT_PARENT_PROMPTS="$(dirname "$GIT_ROOT")/prompts"
fi

# Template discovery with ripgrep
TEMPLATE_FILE=""

# 1. Check if explicit path provided (highest priority)
if [[ "$TEMPLATE" == *"/"* ]] || [[ "$TEMPLATE" == *".md" ]]; then
    # Remove .md extension if provided
    TEMPLATE_PATH="${TEMPLATE%.md}"
    # Check with and without .md
    if [ -f "$TEMPLATE_PATH" ]; then
        TEMPLATE_FILE="$TEMPLATE_PATH"
    elif [ -f "${TEMPLATE_PATH}.md" ]; then
        TEMPLATE_FILE="${TEMPLATE_PATH}.md"
    fi
else
    # 2. Search in precedence order: current dir -> ~/.claude/prompts -> git parent
    SEARCH_DIRS=(
        "."
        "$HOME/.claude/prompts"
    )
    [ -d "$GIT_PARENT_PROMPTS" ] && SEARCH_DIRS+=("$GIT_PARENT_PROMPTS")
    
    # Try exact match first (case-insensitive)
    for dir in "${SEARCH_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            # Use rg with null-separated output for safety
            FOUND=$(rg --files-with-matches --null --glob "*.md" "^" "$dir" 2>/dev/null | \
                    xargs -0 basename -a 2>/dev/null | \
                    rg -ix "${TEMPLATE}\.md" | head -1 || true)
            if [ -n "$FOUND" ]; then
                TEMPLATE_FILE="$dir/${FOUND}"
                break
            fi
        fi
    done
    
    # 3. If no exact match, try fuzzy matching
    if [ -z "$TEMPLATE_FILE" ]; then
        # Collect all potential matches
        MATCHES=""
        for dir in "${SEARCH_DIRS[@]}"; do
            if [ -d "$dir" ]; then
                DIR_MATCHES=$(rg --files --glob "*.md" "$dir" 2>/dev/null | \
                              rg -i "$TEMPLATE" || true)
                [ -n "$DIR_MATCHES" ] && MATCHES="${MATCHES}${DIR_MATCHES}"$'\n'
            fi
        done
        
        # Remove empty lines and count
        MATCHES=$(echo "$MATCHES" | grep -v '^$' || true)
        MATCH_COUNT=$(echo "$MATCHES" | grep -c . 2>/dev/null || echo 0)
        
        if [ "$MATCH_COUNT" -eq 1 ]; then
            TEMPLATE_FILE=$(echo "$MATCHES" | head -1)
        elif [ "$MATCH_COUNT" -gt 1 ]; then
            echo "Multiple possible matches found for '$TEMPLATE':"
            echo "$MATCHES" | while read -r f; do
                [ -n "$f" ] && echo "  - $(basename "$f" .md) ($(dirname "$f"))"
            done
            echo -e "\nPlease be more specific or use exact template name."
            exit 1
        fi
    fi
fi

# Check if template was found
if [ -z "$TEMPLATE_FILE" ] || [ ! -f "$TEMPLATE_FILE" ]; then
    echo "Template '$TEMPLATE' not found."
    echo -e "\nSearched in:"
    echo "  - Current directory (./*.md)"
    echo "  - User Claude prompts (~/.claude/prompts/*.md)"
    [ -n "$GIT_PARENT_PROMPTS" ] && echo "  - Git parent prompts ($GIT_PARENT_PROMPTS/*.md)"
    echo -e "\nUse '--list' to see available templates."
    
    # Suggest similar templates
    echo -e "\nSimilar templates:"
    for dir in "${SEARCH_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            rg --files --glob "*.md" "$dir" 2>/dev/null | while read -r f; do
                basename "$f" .md
            done
        fi
    done | rg -i "$TEMPLATE" | head -5 | sed 's/^/  - /' || echo "  (none found)"
    exit 1
fi

# Load and process template
TEMPLATE_CONTENT=$(cat "$TEMPLATE_FILE")

# Replace <prompt-context> with provided context
if [ -n "$CONTEXT" ]; then
    TEMPLATE_CONTENT="${TEMPLATE_CONTENT//<prompt-context>/$CONTEXT}"
fi

# Output the processed template for execution
echo "$TEMPLATE_CONTENT"
```

## After Template Discovery

Once the bash script above finds and outputs the template content:

1. **Read the template file content** that was output by the script
2. **Replace `<prompt-context>`** placeholders with the provided context arguments
3. **Execute the template as prompt instructions** - interpret the template content as natural language instructions to follow
4. **Return ONLY the execution result** - no meta-commentary about loading or executing

## Output Requirements
- Direct execution result only
- No preamble like "The template was executed..."
- No meta-commentary about what happened
- Just the actual output from running the template