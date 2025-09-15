---
argument-hint: "[list|sync|publish|template] [context...]"
description: "Manage and execute Claude Code extensions (agents, commands, prompts, hooks)"
allowed-tools: "all"
---

# Prompt Template Executor

*Unified Claude Code Extension Manager - Discovers and executes agents, commands, prompts, and hooks*

## Execution Flow

Execute this bash script to find and load the template:

```bash
#!/bin/bash
set -euo pipefail

# Handle arguments properly - they come from the command execution context
if [ $# -gt 0 ]; then
    FIRST_ARG="$1"
    shift || true
    CONTENT="${ARGUMENTS/$1 /}"
else
    FIRST_ARG=""
    CONTENT=""
fi

# Display template and context information
echo "<prompt-template-name>$FIRST_ARG</prompt-template-name>"

# Content extraction and formatting
echo "<prompt-arguments>"
echo $CONTENT
echo "</prompt-arguments>"


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
            local settings_file="$HOME/.claude/settings.json"

            # 1. Try settings.json first (primary configuration source)
            if [ -f "$settings_file" ]; then
                # Check for claude-craft.repo key
                repo_path=$(jq -r '."claude-craft.repo" // empty' "$settings_file" 2>/dev/null)

                # If not found, try repository.path
                if [ -z "$repo_path" ]; then
                    repo_path=$(jq -r '.repository.path // empty' "$settings_file" 2>/dev/null)
                fi
            fi

            # 2. Expand environment variables and validate path
            if [ -n "$repo_path" ]; then
                # Handle $HOME and ~ expansion
                repo_path=$(echo "$repo_path" | sed "s|\$HOME|$HOME|g" | sed "s|^~|$HOME|")
                # Verify path exists and has extension directories
                if [ -d "$repo_path" ] && ([ -d "$repo_path/prompts" ] || [ -d "$repo_path/agents" ] || [ -d "$repo_path/commands" ] || [ -d "$repo_path/hooks" ]); then
                    echo "$repo_path"
                    return
                fi
            fi

            # 3. Try claude-craft.json (backward compatibility)
            local config_file="$HOME/.claude/claude-craft.json"
            if [ -f "$config_file" ]; then
                repo_path=$(jq -r '.repository.path // empty' "$config_file" 2>/dev/null)
                if [ -n "$repo_path" ]; then
                    repo_path=$(echo "$repo_path" | sed "s|\$HOME|$HOME|g" | sed "s|^~|$HOME|")
                    if [ -d "$repo_path" ] && [ -d "$repo_path/prompts" ]; then
                        echo "$repo_path"
                        return
                    fi
                fi
            fi

            # 4. Check standard locations
            for check_path in "$HOME/claude-craft" "$HOME/Documents/claude-craft" "$HOME/Projects/claude-craft" "$HOME/repos/claude-craft"; do
                if [ -d "$check_path" ] && [ -d "$check_path/prompts" ]; then
                    echo "$check_path"
                    return
                fi
            done

            # 5. Final fallback - current directory if it looks like claude-craft
            local current_dir="$(pwd)"
            if [ -d "$current_dir" ] && ([ -d "$current_dir/prompts" ] || [ -d "$current_dir/agents" ] || [ -d "$current_dir/commands" ] || [ -d "$current_dir/hooks" ]); then
                echo "$current_dir"
            fi
        }
        
        REPO_DIR=$(get_repo_path)
        
        # Auto-pull latest changes from repository
        if [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/.git" ]; then
            echo "*Fetching latest extensions from repository...*"

            # Capture git pull output and errors
            pull_output=$(git -C "$REPO_DIR" pull 2>&1)
            pull_status=$?

            if [ $pull_status -eq 0 ]; then
                # Check if there were updates
                if echo "$pull_output" | grep -q "Already up to date"; then
                    echo "  ✓ Repository already up to date"
                else
                    echo "  ✓ Repository updated successfully"
                fi
            else
                echo "  ⚠️ Warning: Could not update repository"
                echo "  Error: $(echo "$pull_output" | head -1)"
            fi
            echo
        fi
        
        # Symlink hygiene - clean broken links before listing
        # Prompt-as-code instruction: Maintain system cleanliness by removing broken symlinks
        cleaned=0
        for type in agents commands prompts hooks; do
            type_dir="$HOME/.claude/$type"
            [ -d "$type_dir" ] || continue
            
            # Runtime decision: Check each symlink's validity
            for file in "$type_dir"/*.md; do
                # Only process symlinks
                [ -L "$file" ] || continue
                
                # Test if symlink target exists at runtime
                if [ ! -e "$file" ]; then
                    # Broken symlink detected - remove for system hygiene
                    basename_file=$(basename "$file")
                    target=$(readlink "$file" 2>/dev/null || echo "unknown")
                    echo "  ⚠️ Removing broken symlink: $basename_file"
                    rm "$file"
                    cleaned=$((cleaned + 1))
                fi
            done
        done
        
        # Report cleanup actions for transparency
        if [ $cleaned -gt 0 ]; then
            echo "  ✓ Cleaned $cleaned broken symlink(s)"
            echo
        fi
        
        # Function to get extension description (secured against command injection)
        get_description() {
            local file="$1"
            local description=""

            # Try YAML frontmatter first (using awk for safer processing)
            if grep -q "^---" "$file" 2>/dev/null; then
                description=$(awk '/^---$/ {in_fm=!in_fm; next} in_fm && /^description:/ {
                    sub(/^description:[[:space:]]*/, "");
                    gsub(/"/, "");
                    print;
                    exit
                }' "$file" 2>/dev/null || true)
            fi

            # Fallback to first non-empty, non-comment line
            if [ -z "$description" ]; then
                description=$(awk '!/^#/ && !/^---/ && !/^$/ && !/^<!--/ {
                    gsub(/^[[:space:]]+/, "");
                    print;
                    exit
                }' "$file" 2>/dev/null || echo "No description")
            fi

            # Sanitize output - remove any shell special characters that could cause injection
            description=$(printf '%s' "$description" | tr -d '`$()[]{};&|<>' | tr -s ' ')

            # Truncate if too long
            if [ ${#description} -gt 60 ]; then
                description="${description:0:57}..."
            fi

            printf '%s' "$description"
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

        # Track for dynamic actions menu
        local_extensions_found=false
        available_extensions_found=false

        # Function to check if extension exists in repository
        is_in_repository() {
            local type="$1"
            local name="$2"
            local repo_file="$REPO_DIR/$type/$name.md"
            [ -f "$repo_file" ]
        }

        # Type-first grouping with status as secondary
        for type in agents commands prompts hooks; do
            type_dir="$HOME/.claude/$type"
            repo_type_dir=""
            [ -n "$REPO_DIR" ] && repo_type_dir="$REPO_DIR/$type"

            icon=""
            type_name=""

            case "$type" in
                agents)   icon="🤖"; type_name="Agents" ;;
                commands) icon="⚡"; type_name="Commands" ;;
                prompts)  icon="📝"; type_name="Prompts" ;;
                hooks)    icon="🪝"; type_name="Hooks" ;;
            esac

            # Track if this type has any extensions at all
            type_has_any=false
            type_installed_found=false
            type_local_found=false
            type_unsynced_found=false

            # First pass: check if type has any extensions
            if [ -d "$type_dir" ]; then
                for check_file in "$type_dir"/*.md; do
                    if [ -e "$check_file" ]; then
                        type_has_any=true
                        break
                    fi
                done
            fi
            if [ "$type_has_any" = "false" ] && [ -n "$repo_type_dir" ] && [ -d "$repo_type_dir" ]; then
                for check_file in "$repo_type_dir"/*.md; do
                    if [ -f "$check_file" ]; then
                        type_has_any=true
                        break
                    fi
                done
            fi

            # Only process if this type has extensions
            if [ "$type_has_any" = "true" ]; then
                echo "### $icon **$type_name**"
                echo

                # Section 1: Installed (Symlinked)
                section_has_items=false
                if [ -d "$type_dir" ]; then
                    for file in "$type_dir"/*.md; do
                        # Skip if pattern didn't match any files
                        [ -e "$file" ] || continue
                        name=$(basename "$file" .md)

                        # Check if symlinked and target exists
                        if [ -L "$file" ] && [ -e "$file" ]; then
                            if [ "$section_has_items" = "false" ]; then
                                echo "#### Installed (Symlinked)"
                                echo
                                section_has_items=true
                                type_installed_found=true
                            fi

                            description=$(get_description "$file")
                            echo "$GLOBAL_COUNTER. **$name**"
                            echo "    $description"
                            echo
                            echo
                            GLOBAL_COUNTER=$((GLOBAL_COUNTER + 1))
                        fi
                    done
                fi

                # Section 2: Local Only
                section_has_items=false
                if [ -d "$type_dir" ]; then
                    for file in "$type_dir"/*.md; do
                        # Skip if file doesn't exist or is a glob pattern
                        [ -f "$file" ] || continue
                        name=$(basename "$file" .md)

                        # Check if NOT symlinked (local only) and actually exists as a regular file
                        if [ -f "$file" ] && [ ! -L "$file" ]; then
                            if [ "$section_has_items" = "false" ]; then
                                echo "#### Local Only"
                                echo
                                section_has_items=true
                                type_local_found=true
                                local_extensions_found=true
                            fi

                            description=$(get_description "$file")
                            echo "$GLOBAL_COUNTER. **$name**"
                            echo "    $description"
                            echo
                            echo
                            GLOBAL_COUNTER=$((GLOBAL_COUNTER + 1))
                        fi
                    done
                fi

                # Section 3: Unsynced (Ready to Sync)
                section_has_items=false
                if [ -n "$repo_type_dir" ] && [ -d "$repo_type_dir" ]; then
                    for file in "$repo_type_dir"/*.md; do
                        # Skip if pattern didn't match any files
                        [ -f "$file" ] || continue
                        name=$(basename "$file" .md)

                        # Check if not installed locally
                        profile_file="$HOME/.claude/$type/$name.md"
                        project_file=""

                        if [ -n "$GIT_ROOT" ]; then
                            git_parent_dir="$(dirname "$GIT_ROOT")"
                            project_file="$git_parent_dir/.claude/$type/$name.md"
                        fi

                        installation_exists=false
                        [ -f "$profile_file" ] && installation_exists=true
                        [ -n "$project_file" ] && [ -f "$project_file" ] && installation_exists=true

                        if [ "$installation_exists" = "false" ]; then
                            if [ "$section_has_items" = "false" ]; then
                                echo "#### Unsynced (Ready to Sync)"
                                echo
                                section_has_items=true
                                type_unsynced_found=true
                                available_extensions_found=true
                            fi

                            description=$(get_description "$file")
                            echo "$GLOBAL_COUNTER. **$name**"
                            echo "    $description"
                            echo
                            echo
                            GLOBAL_COUNTER=$((GLOBAL_COUNTER + 1))
                        fi
                    done
                fi

                # Add separator after type section
                echo "═══════════════════════════════════════════════════════════════════════════════"
                echo
            fi
        done
        
        echo "**Usage:**"
        echo "- Execute prompt: \`/prompt template-name [context]\`"
        echo "- List extensions: \`/prompt list\` (auto-pulls latest from repository)"
        echo "- Install extensions: \`/prompt sync [numbers or names]\`"
        echo "- Publish extensions: \`/prompt publish [numbers or names]\`"
        echo "- Direct file: \`/prompt /path/to/file.md [context]\`"
        echo
        echo "**Extension States:**"
        echo "- **Installed (Symlinked)** = Extensions symlinked to repository"
        echo "- **Local Only** = Extensions ready to publish to repository"
        echo "- **Unsynced (Ready to Sync)** = Repository extensions ready to install locally"
        echo
        echo "**Publishing Workflow:**"
        echo "```"
        echo "Local File       Repository       Shared Access"
        echo "┌─────────┐      ┌─────────┐      ┌─────────┐"
        echo "│ my.md   │ ──►  │ my.md   │ ──►  │ Team    │"
        echo "└─────────┘      └─────────┘      │ Install │"
        echo "    │            Git Commit       └─────────┘"
        echo "    ▼                 │"
        echo "┌─────────┐           ▼"
        echo "│ my.md ──┼──► Repository/my.md"
        echo "│\(symlink\)│"
        echo "└─────────┘"
        echo "```"
        echo
        echo "**Symbols:** 🤖 = AI Agents  ⚡ = Commands  📝 = Prompts  🪝 = Hooks"
        echo
        echo "═══════════════════════════════════════════════════════════════════════════════"
        echo "### 🎯 **Quick Actions**"
        echo

        # Dynamic action menu based on what was found
        action_count=1
        echo "**Recommended Actions:**"
        echo

        # Count extensions in each state
        local_only_count=0
        unsynced_count=0
        installed_count=0

        for type in agents commands prompts hooks; do
            # Count local only files
            local_dir="$HOME/.claude/$type"
            if [ -d "$local_dir" ]; then
                for file in "$local_dir"/*.md; do
                    # Ensure file actually exists
                    [ -f "$file" ] || continue
                    if [ ! -L "$file" ]; then
                        # Regular file, not a symlink
                        local_only_count=$((local_only_count + 1))
                    elif [ -L "$file" ] && [ -e "$file" ]; then
                        # Valid symlink with existing target
                        installed_count=$((installed_count + 1))
                    fi
                done
            fi

            # Count unsynced repository files
            if [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/$type" ]; then
                for file in "$REPO_DIR/$type"/*.md; do
                    [ -f "$file" ] || continue
                    base_name=$(basename "$file")
                    local_file="$local_dir/$base_name"

                    # Check if not already installed locally (either as file or symlink)
                    if [ ! -e "$local_file" ]; then
                        unsynced_count=$((unsynced_count + 1))
                    fi
                done
            fi
        done

        # Show contextually relevant actions based on actual state
        if [ "$unsynced_count" -gt 0 ]; then
            echo "$action_count. **Install Extensions** - \`/prompt sync [numbers]\` ($unsynced_count unsynced extensions available)"
            action_count=$((action_count + 1))
        fi

        if [ "$local_only_count" -gt 0 ]; then
            echo "$action_count. **Publish Extensions** - \`/prompt publish [numbers]\` ($local_only_count local extensions ready)"
            action_count=$((action_count + 1))
        fi

        # Always show repository update if configured
        if [ -n "$REPO_DIR" ]; then
            echo "$action_count. **Update Repository** - \`/prompt sync\` (pull latest changes from git)"
            action_count=$((action_count + 1))
        fi

        # Show stats summary
        echo "$action_count. **View Details** - \`/prompt list --verbose\` (show full descriptions)"
        action_count=$((action_count + 1))

        # Always show help
        echo "$action_count. **Help & Documentation** - \`/help prompt\` (usage guide)"
        echo

        # Show current status summary
        echo "**📊 Status Summary:**"
        echo "• $installed_count extensions installed (symlinked)"
        echo "• $local_only_count local extensions (unpublished)"
        echo "• $unsynced_count repository extensions available to sync"

        exit 0
        ;;

    "sync"|"add"|"link"|"install")
        # SYNC EXECUTION DOMAIN - Repository → Local workflow
        echo "## 📥 Extension Synchronization"
        echo
        echo "**Sync Request**: \"$CONTENT\""
        echo
        echo "---"
        echo
        echo "**Instructions for AI:**"
        echo
        echo "**Template Variables Setup** (CRITICAL):"
        echo "- \`<prompt-template-name>\`: \"sync\" (or \"add\", \"link\", \"install\" as provided)"
        echo "- \`<prompt-arguments>\`: \"$CONTENT\""
        echo
        echo "**Primary Directive**: Synchronize repository extensions to local environment"
        echo
        echo "**CRITICAL FIRST STEP - Repository Freshness**:"
        echo "BEFORE any analysis, comparisons, or sync operations:"
        echo "- Run \`git -C \"<repo-dir>\" pull\` to ensure current repository state"
        echo "- **Reasoning**: All decisions must be based on fresh repository data, not stale cached information"
        echo
        echo "**After Repository Update**:"
        echo "1. **Run \`/prompt list\`** to see current repository vs local status using fresh data"
        echo "2. **Analyze sync request** from <prompt-arguments>:"
        echo "   - **Selection criteria**: Numbers from list, extension names, \"all available\""
        echo "   - **Scope preference**: Profile level (default) unless \"local\"/\"project\" specified"
        echo "   - **Extension types**: prompts, agents, commands, hooks"
        echo
        echo "3. **For each selected extension**:"
        echo "   - **Standard extensions**: Create symlink from ~/.claude/ to repository file"
        echo "   - **Hooks**: Parse JSON definition and install into appropriate settings.json"
        echo "   - **Conflict handling**: Backup existing files, offer merge/replace options"
        echo "   - **Scope targeting**: Profile (~/.claude/) default, project level if requested"
        echo
        echo "**Runtime Decision Making**:"
        echo "- **Scope detection**: \"local\"/\"project\" keywords → project level, otherwise profile level"
        echo "- **Selection parsing**: Parse numbers, names, or \"all\" from user request"
        echo "- **Conflict resolution**: Safe backup and user choice for existing files"
        echo "- **Hook installation**: Target correct settings.json based on scope preference"
        echo
        echo "**Safety Protocols**:"
        echo "- Always pull repository first to avoid stale data decisions"
        echo "- Backup existing files before creating symlinks"
        echo "- Verify symlink integrity after creation"
        echo "- Validate hook configurations in settings.json"
        echo
        echo "**Example sync operations:**"
        echo "- Numbers: \"19, 25\" → sync extensions #19 and #25 to profile level"
        echo "- Names: \"echo, weather\" → sync echo.md and weather.md to profile level"
        echo "- Local scope: \"sync 5 --local\" → sync extension #5 to project level"
        echo "- All available: \"sync all\" → sync all unsynced repository extensions to profile"
        exit 0
        ;;

    "publish"|"share"|"contribute")
        # PUBLISH EXECUTION DOMAIN - Local → Repository workflow
        echo "## 📤 Extension Publishing"
        echo
        echo "**Publish Request**: \"$CONTENT\""
        echo
        echo "---"
        echo
        echo "**Instructions for AI:**"
        echo
        echo "**Template Variables Setup** (CRITICAL):"
        echo "- \`<prompt-template-name>\`: \"publish\""
        echo "- \`<prompt-arguments>\`: \"$CONTENT\""
        echo
        echo "**Primary Directive**: Publish local extensions to repository for sharing"
        echo
        echo "**Critical Workflow Sequence**:"
        echo "1. **Repository preparation**: Ensure repository is ready for new content"
        echo "   - Check repository accessibility and clean state"
        echo "   - Run \`git -C \"<repo-dir>\" pull\` to get latest before adding content"
        echo
        echo "2. **Analyze publish request** from <prompt-arguments>:"
        echo "   - **Selection criteria**: Numbers from /prompt list, extension names, \"all local\""
        echo "   - **Scope detection**: Profile level (default) unless \"local\" scope specified"
        echo "   - **Extension types**: prompts, agents, commands, hooks"
        echo
        echo "3. **For each selected extension**:"
        echo "   - **Standard extensions**: Copy local .md file to repository directory"
        echo "   - **Hooks**: Extract configuration from settings.json → create JSON definition"
        echo "   - **Git operations**: \`git -C \"<repo-dir>\" add/commit/push\` with descriptive message"
        echo "   - **Create symlinks**: Replace local files with links to repository versions"
        echo
        echo "4. **Safety protocols**:"
        echo "   - Backup existing files before replacement"
        echo "   - Verify git operations succeed before proceeding"
        echo "   - Validate symlink integrity after creation"
        echo "   - Provide rollback instructions if errors occur"
        echo
        echo "**Runtime Decision Making**:"
        echo "- **Scope intelligence**: Default to profile level (~/.claude/) unless context suggests project-specific"
        echo "- **Selection parsing**: Parse numbers, names, or \"all\" from user request"
        echo "- **Conflict handling**: Handle existing repository files with merge or replace options"
        echo "- **Hook extraction**: Convert hook configurations to standardized JSON format"
        echo
        echo "**Repository Integration**:"
        echo "- Use existing get_repo_path() logic for repository discovery"
        echo "- Always use \`git -C \"<repo-dir>\"\` syntax for directory safety"
        echo "- Create meaningful commit messages: \"Publish extensions: <names>\""
        echo "- Ensure published extensions become available for team sharing"
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
        
        MATCHES=$(echo "$MATCHES" | grep -v '^$' | grep . || true)
        if [ -z "$MATCHES" ]; then
            MATCH_COUNT=0
        else
            MATCH_COUNT=$(echo "$MATCHES" | wc -l | tr -d ' ')
            # Ensure MATCH_COUNT is a valid number
            if [[ ! "$MATCH_COUNT" =~ ^[0-9]+$ ]]; then
                MATCH_COUNT=0
            fi
        fi
        
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
    
    echo -e "\nUse '/prompt --list' to see available templates."
    
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

# Output the processed template as executable instructions
echo "<prompt-instructions>"
echo "$TEMPLATE_CONTENT"
echo "</prompt-instructions>"
esac
```

## Template Execution Instructions

**Execution Mode**: Silent - suppress all bash command echoing and intermediate output.

**Process**: Extract content from `<prompt-instructions>` tags and execute as natural language instructions.

**Output**: Direct execution result only - no meta-commentary about loading or executing templates.

**Display**: Always show complete output without collapsing. Do not truncate or summarize results.

**Silent Execution Guidelines**:
- Do not show the bash script execution details
- Do not echo commands being run  
- Only display the final result of executing the template instructions
- Suppress tool call summaries and intermediate processing steps