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

FIRST_ARG="$1"
shift || true
CONTEXT="$*"

# Domain-driven command routing
case "$FIRST_ARG" in
    "list"|"--list"|"status")
        # PROMPT TEMPLATE DISCOVERY DOMAIN - Show available prompt templates
        echo "## 📋 Available Prompt Templates"
        echo
        
        # Get git root for parent prompts discovery
        GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
        GIT_PARENT_PROMPTS=""
        if [ -n "$GIT_ROOT" ]; then
            GIT_PARENT_PROMPTS="$(dirname "$GIT_ROOT")/prompts"
        fi
        
        # Get repository path for claude-craft prompts
        get_repo_path() {
            local repo_path=""
            local config_file=""
            
            # 1. Try project config first (git parent/.claude/claude-craft.json)
            if [ -n "$GIT_ROOT" ]; then
                config_file="$(dirname "$GIT_ROOT")/.claude/claude-craft.json"
                if [ -f "$config_file" ]; then
                    repo_path=$(jq -r '.repository.path // empty' "$config_file" 2>/dev/null)
                fi
            fi
            
            # 2. Try profile config (fallback)
            if [ -z "$repo_path" ] && [ -f "$HOME/.claude/claude-craft.json" ]; then
                repo_path=$(jq -r '.repository.path // empty' "$HOME/.claude/claude-craft.json" 2>/dev/null)
            fi
            
            # 3. Expand environment variables and validate path
            if [ -n "$repo_path" ]; then
                # Handle $HOME expansion
                repo_path=$(echo "$repo_path" | sed "s|\$HOME|$HOME|g")
                # Verify path exists and has prompts directory
                if [ -d "$repo_path/prompts" ]; then
                    echo "$repo_path"
                    return
                fi
            fi
            
            # 4. Final fallback - current directory if it looks like claude-craft
            local current_dir="$(pwd)"
            if [ -d "$current_dir/prompts" ]; then
                echo "$current_dir"
            fi
        }
        
        REPO_DIR=$(get_repo_path)
        
        # Counter for numbering across all sections
        GLOBAL_COUNTER=1
        
        # Show Already Available Templates section
        echo "### 📁 Already Available"
        echo
        
        # Check current directory
        if ls ./*.md 2>/dev/null >/dev/null; then
            echo "#### 📁 **Current Directory (.)**"
            echo
            for file in ./*.md; do
                if [ -f "$file" ]; then
                    name=$(basename "$file" .md)
                    desc=$(head -1 "$file" 2>/dev/null | sed 's/^[[:space:]]*//' || echo "No description")
                    if [ ${#desc} -gt 70 ]; then
                        desc="$(echo "$desc" | cut -c1-67)..."
                    fi
                    echo "$GLOBAL_COUNTER. **$name** - $desc"
                    GLOBAL_COUNTER=$((GLOBAL_COUNTER + 1))
                fi
            done
            echo
        fi
        
        # Check user Claude prompts
        if [ -d "$HOME/.claude/prompts" ]; then
            echo "#### 👤 **Profile Prompts (~/.claude/prompts)**"
            echo
            for file in "$HOME/.claude/prompts"/*.md; do
                if [ -f "$file" ]; then
                    name=$(basename "$file" .md)
                    desc=$(head -1 "$file" 2>/dev/null | sed 's/^[[:space:]]*//' || echo "No description")
                    if [ ${#desc} -gt 70 ]; then
                        desc="$(echo "$desc" | cut -c1-67)..."
                    fi
                    echo "$GLOBAL_COUNTER. **$name** - $desc"
                    GLOBAL_COUNTER=$((GLOBAL_COUNTER + 1))
                fi
            done
            echo
        fi
        
        echo "═══════════════════════════════════════════════════════════════════════════════"
        echo
        
        # Show Available to Sync Templates section
        echo "### 📦 Available to Sync (Repository)"
        echo
        
        # Check repository prompts - these can be synced
        if [ -d "$REPO_DIR/prompts" ]; then
            synced_prompts=""
            if [ -d "$HOME/.claude/prompts" ]; then
                synced_prompts=$(find "$HOME/.claude/prompts" -name "*.md" -type l 2>/dev/null | xargs -I {} basename {} .md 2>/dev/null | sort || echo "")
            fi
            
            echo "#### 📝 **Repository Prompts** (can be synced):"
            echo
            
            for file in "$REPO_DIR/prompts"/*.md; do
                [ -f "$file" ] || continue
                name=$(basename "$file" .md)
                
                # Check if already synced
                is_synced=false
                if echo "$synced_prompts" | grep -q "^$name$" 2>/dev/null; then
                    is_synced=true
                fi
                
                description=""
                if grep -q "^---" "$file" 2>/dev/null; then
                    description=$(sed -n '/^---$/,/^---$/p' "$file" | grep -E "^description:" | sed 's/description:[[:space:]]*//' | tr -d '"' 2>/dev/null || true)
                fi
                
                if [ -z "$description" ]; then
                    description=$(grep -v "^#\|^---\|^$" "$file" | head -1 | sed 's/^[[:space:]]*//' 2>/dev/null || echo "No description")
                fi
                
                if [ ${#description} -gt 60 ]; then
                    description="$(echo "$description" | cut -c1-57)..."
                fi
                
                status_indicator=""
                if [ "$is_synced" = "true" ]; then
                    status_indicator=" ✓"
                fi
                
                echo "$GLOBAL_COUNTER. **$name**$status_indicator - $description"
                GLOBAL_COUNTER=$((GLOBAL_COUNTER + 1))
            done
            echo
        fi
        
        echo "**Usage:**"
        echo "- Execute template: \`/prompt template-name [context]\`"  
        echo "- Sync prompts: \`/prompt sync [numbers or names]\`"
        echo "- Full path: \`/prompt /path/to/template.md [context]\`"
        exit 0
        ;;

    "sync"|"add"|"link"|"install") 
        # SYNC EXECUTION DOMAIN - For prompt templates only
        echo "## 📦 Prompt Template Sync"
        echo
        echo "**Sync Request**: \"$CONTEXT\""
        echo
        echo "---"
        echo
        echo "**Instructions for AI:**"
        echo
        echo "1. **Parse the sync request** to identify which prompt templates to sync"
        echo "2. **Run \`/prompt list\` first** to see available templates and their numbers"
        echo "3. **For each template to sync:**"
        echo "   - Get repository path from claude-craft.json configuration"
        echo "   - Determine sync level (ask user if unclear):"
        echo "     - **Project**: Link to git parent's .claude/prompts/"
        echo "     - **Profile**: Link to ~/.claude/prompts/"
        echo "   - Create symlink: \`ln -sf \$REPO_DIR/prompts/template.md \$TARGET_DIR/template.md\`"
        echo "4. **Ask user about sync level if unclear:**"
        echo "   - \"Do you want to sync to project level (this repo only) or profile level (globally)?\""
        echo "5. **Confirm completion** with list of synced templates"
        echo
        echo "**Sync level determination:**"
        echo "- **Project keywords**: \"project\", \"local\", \"this repo\", \"here\""
        echo "- **Profile keywords**: \"profile\", \"global\", \"everywhere\", \"all projects\""
        echo "- **Default behavior**: Ask user to choose if not specified"
        echo
        echo "**Example sync operations:**"
        echo "- Numbers: \"19, 25\" → sync templates #19 and #25"
        echo "- Names: \"echo, weather\" → sync echo.md and weather.md templates"
        echo "- All: \"all available\" → sync all unsynced repository templates"
        exit 0
        ;;

    *)
        # TEMPLATE EXECUTION DOMAIN - Load and execute prompt templates
        TEMPLATE="$FIRST_ARG"

# Find git parent prompts directory
# Git is run from CWD, then we look in the parent of whatever git root is found
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
        "$(pwd)"
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
        ;;
esac
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