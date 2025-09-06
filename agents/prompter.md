---
name: prompter
description: Load and execute prompt templates with comprehensive extension management. Supports list, sync, publish operations and advanced template discovery with repository integration.
color: blue
hints: |
  UNIFIED CLAUDE CODE EXTENSION MANAGER
  
  Usage patterns:
  - prompter list : Show all available extensions (agents, commands, prompts, hooks)
  - prompter sync <names/numbers> : Install extensions from repository 
  - prompter publish <names/numbers> : Publish local extensions to repository
  - prompter <template-name> [context...] : Execute template with context
  
  Advanced template discovery hierarchy:
  1. Explicit file paths (absolute/relative)
  2. Git root prompts (<project>/prompts)
  3. Git parent prompts (parent project)
  4. Repository prompts (claude-craft configured)
  5. Profile prompts (~/.claude/prompts)
  6. Project-scoped profile prompts
  7. Current directory fallback
  
  Extension management features:
  - Auto-pull from git repositories
  - Three-tier categorization (installed, local-only, available)
  - Symlink-based publishing workflow
  - Cross-project template sharing
  - Silent execution mode with comprehensive error handling
---

**TEMPLATE EXECUTION:**

Execute this bash script to find and load the template:

```bash
#!/bin/bash
set -euo pipefail

# Handle arguments properly - they come from the command execution context
if [ $# -gt 0 ]; then
    FIRST_ARG="$1"
    shift || true
    CONTEXT="$*"
else
    FIRST_ARG=""
    CONTEXT=""
fi

# Domain-driven command routing
case "$FIRST_ARG" in
    "list"|"--list"|"status")
        # COMPREHENSIVE EXTENSION DISCOVERY DOMAIN - Show all Claude Code extensions
        echo "## 🧩 Claude Code Extensions"
        echo
        
        # Get git root and repository path for comprehensive extension discovery
        GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
        
        # Repository discovery function
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
                # Verify path exists and has extension directories
                if [ -d "$repo_path" ] && ([ -d "$repo_path/prompts" ] || [ -d "$repo_path/agents" ] || [ -d "$repo_path/commands" ] || [ -d "$repo_path/hooks" ]); then
                    echo "$repo_path"
                    return
                fi
            fi
            
            # 4. Final fallback - current directory if it looks like claude-craft
            local current_dir="$(pwd)"
            if [ -d "$current_dir" ] && ([ -d "$current_dir/prompts" ] || [ -d "$current_dir/agents" ] || [ -d "$current_dir/commands" ] || [ -d "$current_dir/hooks" ]); then
                echo "$current_dir"
            fi
        }
        
        REPO_DIR=$(get_repo_path)
        
        # Auto-pull latest changes from repository
        if [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/.git" ]; then
            echo "*Fetching latest extensions from repository...*"
            git -C "$REPO_DIR" pull --quiet >/dev/null 2>&1 || true
            echo
        fi
        
        # Function to get extension description
        get_description() {
            local file="$1"
            local description=""
            
            # Try YAML frontmatter first
            if grep -q "^---" "$file" 2>/dev/null; then
                description=$(sed -n '/^---$/,/^---$/p' "$file" | grep -E "^description:" | sed 's/description:[[:space:]]*//' | tr -d '"' 2>/dev/null || true)
            fi
            
            # Fallback to first non-empty, non-comment line
            if [ -z "$description" ]; then
                description=$(grep -v "^#\|^---\|^$\|^<!--" "$file" | head -1 | sed 's/^[[:space:]]*//' 2>/dev/null || echo "No description")
            fi
            
            # Truncate if too long
            if [ ${#description} -gt 60 ]; then
                description="$(echo "$description" | cut -c1-57)..."
            fi
            
            echo "$description"
        }
        
        # Function to check if extension is synced
        is_extension_synced() {
            local type="$1"
            local name="$2"
            local target_file="$HOME/.claude/$type/$name.md"
            
            # Check if file exists and is a symlink
            [ -L "$target_file" ] && return 0
            return 1
        }
        
        # Counter for numbering across all sections
        GLOBAL_COUNTER=1
        
        # Function to check if extension exists in repository
        is_in_repository() {
            local type="$1"
            local name="$2"
            local repo_file="$REPO_DIR/$type/$name.md"
            [ -f "$repo_file" ]
        }
        
        echo "### 🔗 Installed Extensions (Published & Symlinked)"
        echo
        
        # Show symlinked extensions (published and installed)
        for type in agents commands prompts hooks; do
            type_dir="$HOME/.claude/$type"
            icon=""
            type_name=""
            
            case "$type" in
                agents)   icon="🤖"; type_name="Agents" ;;
                commands) icon="⚡"; type_name="Commands" ;;
                prompts)  icon="📝"; type_name="Prompts" ;;
                hooks)    icon="🪝"; type_name="Hooks" ;;
            esac
            
            type_has_symlinks=false
            
            if [ -d "$type_dir" ] && ls "$type_dir"/*.md >/dev/null 2>&1; then
                for file in "$type_dir"/*.md; do
                    [ -f "$file" ] || continue
                    name=$(basename "$file" .md)
                    
                    # Only show symlinked items (published extensions)
                    if [ -L "$file" ]; then
                        # Show header only when we find the first symlinked item
                        if [ "$type_has_symlinks" = "false" ]; then
                            echo "#### $icon **$type_name** (Published & Installed)"
                            echo
                            type_has_symlinks=true
                        fi
                        
                        description=$(get_description "$file")
                        echo "$GLOBAL_COUNTER. **$name** 🔗"
                        echo "    $description"
                        echo
                        GLOBAL_COUNTER=$((GLOBAL_COUNTER + 1))
                    fi
                done
                
                # Add spacing after section if any items were shown
                if [ "$type_has_symlinks" = "true" ]; then
                    echo
                fi
            fi
        done
        
        echo "═══════════════════════════════════════════════════════════════════════════════"
        echo
        
        echo "### 📝 Local Only Extensions (Unpublished)"
        echo
        
        # Show local-only extensions (not symlinked, available to publish)
        local_extensions_found=false
        for type in agents commands prompts hooks; do
            type_dir="$HOME/.claude/$type"
            icon=""
            type_name=""
            
            case "$type" in
                agents)   icon="🤖"; type_name="Agents" ;;
                commands) icon="⚡"; type_name="Commands" ;;
                prompts)  icon="📝"; type_name="Prompts" ;;
                hooks)    icon="🪝"; type_name="Hooks" ;;
            esac
            
            type_has_local=false
            
            if [ -d "$type_dir" ] && ls "$type_dir"/*.md >/dev/null 2>&1; then
                for file in "$type_dir"/*.md; do
                    [ -f "$file" ] || continue
                    name=$(basename "$file" .md)
                    
                    # Only show non-symlinked items (local-only extensions)
                    if [ ! -L "$file" ]; then
                        # Show header only when we find the first local item
                        if [ "$type_has_local" = "false" ]; then
                            echo "#### $icon **$type_name** (Ready to Publish)"
                            echo
                            type_has_local=true
                            local_extensions_found=true
                        fi
                        
                        description=$(get_description "$file")
                        echo "$GLOBAL_COUNTER. **$name** 📤"
                        echo "    $description"
                        echo
                        GLOBAL_COUNTER=$((GLOBAL_COUNTER + 1))
                    fi
                done
                
                # Add spacing after section if any items were shown
                if [ "$type_has_local" = "true" ]; then
                    echo
                fi
            fi
        done
        
        if [ "$local_extensions_found" = "false" ]; then
            echo "*No unpublished local extensions found.*"
            echo
        fi
        
        echo "═══════════════════════════════════════════════════════════════════════════════"
        echo
        
        echo "### 📦 Available from Repository (Not Installed)"
        echo
        
        # Show repository extensions that are NOT locally installed
        if [ -n "$REPO_DIR" ]; then
            available_extensions_found=false
            for type in agents commands prompts hooks; do
                type_dir="$REPO_DIR/$type"
                icon=""
                type_name=""
                
                case "$type" in
                    agents)   icon="🤖"; type_name="Agents" ;;
                    commands) icon="⚡"; type_name="Commands" ;;
                    prompts)  icon="📝"; type_name="Prompts" ;;
                    hooks)    icon="🪝"; type_name="Hooks" ;;
                esac
                
                if [ -d "$type_dir" ] && ls "$type_dir"/*.md >/dev/null 2>&1; then
                    type_has_available=false
                    
                    for file in "$type_dir"/*.md; do
                        [ -f "$file" ] || continue
                        name=$(basename "$file" .md)
                        description=$(get_description "$file")
                        
                        # Only show if NOT locally installed (no symlink exists)
                        local_file="$HOME/.claude/$type/$name.md"
                        if [ ! -f "$local_file" ]; then
                            # Show header only when we find the first available item
                            if [ "$type_has_available" = "false" ]; then
                                echo "#### $icon **Repository $type_name** (Ready to Install)"
                                echo
                                type_has_available=true
                                available_extensions_found=true
                            fi
                            
                            echo "$GLOBAL_COUNTER. **$name** 📥"
                            echo "    $description"
                            echo
                            GLOBAL_COUNTER=$((GLOBAL_COUNTER + 1))
                        fi
                    done
                    
                    # Add spacing after section if any items were shown
                    if [ "$type_has_available" = "true" ]; then
                        echo
                    fi
                fi
            done
            
            if [ "$available_extensions_found" = "false" ]; then
                echo "*All repository extensions are already installed.*"
                echo
            fi
        else
            echo "*No repository configured. Set up claude-craft.json to see available extensions.*"
            echo
        fi
        
        echo "**Usage:**"
        echo "- Execute prompt: \`prompter template-name [context]\`"
        echo "- List extensions: \`prompter list\` (auto-pulls latest from repository)"
        echo "- Install extensions: \`prompter sync [numbers or names]\`"
        echo "- Publish extensions: \`prompter publish [numbers or names]\`"
        echo "- Direct file: \`prompter /path/to/file.md [context]\`"
        echo
        echo "**Extension States:**"
        echo "- 🔗 = Published & Installed (symlinked to repository)"
        echo "- 📤 = Local Only (ready to publish to repository)"
        echo "- 📥 = Available (in repository, ready to install locally)"
        echo
        echo "**Publishing Workflow:**"
        echo "1. Copy local extension to repository directory"
        echo "2. Replace local file with symlink to repository"
        echo "3. Git add, commit, and push changes to repository"
        echo "4. Extension becomes published and shareable"
        echo
        echo "**Symbols:** 🤖 = AI Agents  ⚡ = Commands  📝 = Prompts  🪝 = Hooks"
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
        echo "2. **Run \`prompter list\` first** to see available templates and their numbers"
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

# Get git context for discovery
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)

# Repository discovery function (reuse from --list logic)
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

# Template discovery with improved hierarchy
TEMPLATE_FILE=""

# Priority 1: Explicit file paths (absolute, relative, with/without .md)
if [[ "$TEMPLATE" == *"/"* ]] || [[ "$TEMPLATE" == *".md" ]]; then
    # Handle various explicit path formats
    TEMPLATE_PATH="${TEMPLATE%.md}"
    
    # Check absolute and relative paths
    for path in "$TEMPLATE_PATH" "${TEMPLATE_PATH}.md" "$TEMPLATE" ; do
        if [ -f "$path" ]; then
            TEMPLATE_FILE="$path"
            break
        fi
    done
else
    # Priority 2-4: Search in improved precedence order
    # Project-first, then profile, then fallback
    SEARCH_DIRS=()
    
    # Priority 2a: Git root prompts (<project>/prompts)
    if [ -n "$GIT_ROOT" ] && [ -d "$GIT_ROOT/prompts" ]; then
        SEARCH_DIRS+=("$GIT_ROOT/prompts")
    fi
    
    # Priority 2b: Git parent prompts (parent project prompts)
    if [ -n "$GIT_ROOT" ]; then
        GIT_PARENT_PROMPTS="$(dirname "$GIT_ROOT")/prompts"
        [ -d "$GIT_PARENT_PROMPTS" ] && SEARCH_DIRS+=("$GIT_PARENT_PROMPTS")
    fi
    
    # Priority 2c: Repository prompts (claude-craft configured)
    if [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/prompts" ]; then
        SEARCH_DIRS+=("$REPO_DIR/prompts")
    fi
    
    # Priority 3a: Profile prompts (<profile>/prompts)
    if [ -d "$HOME/.claude/prompts" ]; then
        SEARCH_DIRS+=("$HOME/.claude/prompts")
    fi
    
    # Priority 3b: Project-scoped profile prompts
    if [ -n "$GIT_ROOT" ]; then
        PROJECT_NAME=$(basename "$GIT_ROOT")
        PROJECT_PROFILE_PROMPTS="$HOME/.claude/prompts/$PROJECT_NAME"
        [ -d "$PROJECT_PROFILE_PROMPTS" ] && SEARCH_DIRS+=("$PROJECT_PROFILE_PROMPTS")
    fi
    
    # Priority 4: Current directory fallback
    SEARCH_DIRS+=("$(pwd)")
    
    # Search for exact match first (case-insensitive)
    for dir in "${SEARCH_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            # Direct file check (most efficient)
            for candidate in "$dir/${TEMPLATE}.md" "$dir/$TEMPLATE"; do
                if [ -f "$candidate" ]; then
                    TEMPLATE_FILE="$candidate"
                    break 2
                fi
            done
            
            # Case-insensitive search if no direct match
            if [ -z "$TEMPLATE_FILE" ]; then
                FOUND=$(find "$dir" -maxdepth 1 -iname "${TEMPLATE}.md" -type f | head -1 2>/dev/null || true)
                if [ -n "$FOUND" ]; then
                    TEMPLATE_FILE="$FOUND"
                    break
                fi
            fi
        fi
    done
    
    # Fuzzy matching as last resort
    if [ -z "$TEMPLATE_FILE" ]; then
        MATCHES=""
        for dir in "${SEARCH_DIRS[@]}"; do
            if [ -d "$dir" ]; then
                DIR_MATCHES=$(find "$dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | \
                              grep -i "$TEMPLATE" || true)
                [ -n "$DIR_MATCHES" ] && MATCHES="${MATCHES}${DIR_MATCHES}"$'\n'
            fi
        done
        
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
    echo -e "\nSearched in priority order:"
    
    # Show search locations with project/profile indicators
    if [ -n "$GIT_ROOT" ] && [ -d "$GIT_ROOT/prompts" ]; then
        echo "  📁 Project: $GIT_ROOT/prompts/*.md"
    fi
    if [ -n "$GIT_ROOT" ]; then
        GIT_PARENT_PROMPTS="$(dirname "$GIT_ROOT")/prompts"
        [ -d "$GIT_PARENT_PROMPTS" ] && echo "  📁 Parent: $GIT_PARENT_PROMPTS/*.md"
    fi
    if [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/prompts" ]; then
        echo "  📦 Repository: $REPO_DIR/prompts/*.md"
    fi
    if [ -d "$HOME/.claude/prompts" ]; then
        echo "  👤 Profile: ~/.claude/prompts/*.md"
    fi
    if [ -n "$GIT_ROOT" ]; then
        PROJECT_NAME=$(basename "$GIT_ROOT")
        PROJECT_PROFILE_PROMPTS="$HOME/.claude/prompts/$PROJECT_NAME"
        [ -d "$PROJECT_PROFILE_PROMPTS" ] && echo "  👤 Project Profile: ~/.claude/prompts/$PROJECT_NAME/*.md"
    fi
    echo "  📄 Current: $(pwd)/*.md"
    
    echo -e "\nUse 'prompter --list' to see available templates."
    
    # Suggest similar templates
    echo -e "\nSimilar templates:"
    SUGGESTIONS_FOUND=false
    for dir in "${SEARCH_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            SIMILAR=$(find "$dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | \
                      xargs basename -a 2>/dev/null | \
                      sed 's/\.md$//' | \
                      grep -i "$TEMPLATE" | head -3 || true)
            if [ -n "$SIMILAR" ]; then
                echo "$SIMILAR" | sed 's/^/  - /'
                SUGGESTIONS_FOUND=true
            fi
        fi
    done
    [ "$SUGGESTIONS_FOUND" = "false" ] && echo "  (none found)"
    exit 1
fi

# Load and process template
TEMPLATE_CONTENT=$(cat "$TEMPLATE_FILE")

# Replace <prompt-context> with provided context
if [ -n "$CONTEXT" ]; then
    TEMPLATE_CONTENT="${TEMPLATE_CONTENT//<prompt-context>/$CONTEXT}"
fi

# Output the processed template as executable instructions
echo "<prompt-instructions>"
echo "$TEMPLATE_CONTENT"
echo "</prompt-instructions>"
        ;;
esac
```

## Template Execution Instructions

**Process**: Extract content from `<prompt-instructions>` tags and execute as natural language instructions.

**Execution Mode**: Silent - suppress all bash command echoing and intermediate output.

**Output**: Direct execution result only - no meta-commentary about loading or executing templates.

**Display**: Always show complete output without collapsing. Do not truncate or summarize results.

**Silent Execution Guidelines**:
- Do not show the bash script execution details
- Do not echo commands being run  
- Only display the final result of executing the template instructions
- Suppress tool call summaries and intermediate processing steps