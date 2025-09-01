# Craft Command

Manage your claude-craft repository and Claude Code configuration.

## Usage

```
/craft [action]
```

## Actions

- `/craft` or `/craft sync` - Sync latest changes from repository (default action)
- `/craft setup` - Initial setup: clone repository and create all symlinks  
- `/craft push` - Add, commit, and push local changes to repository
- `/craft status` - Show git status and symlink health
- `/craft clean` - Remove broken symlinks and recreate them

## Examples

```bash
# Default sync - pull latest changes
/craft

# Explicit sync command
/craft sync

# Initial setup on new machine
/craft setup

# Commit and push your changes
/craft push "Added new security prompts"

# Check sync status
/craft status
```

## Implementation

```bash
#!/bin/bash
set -e

REPO_DIR="$HOME/claude-craft"
CLAUDE_DIR="$HOME/.claude"
ACTION="${1:-sync}"
CHANGES_DETECTED=false

sync_directory() {
    local repo_subdir="$1"
    local claude_subdir="$2" 
    local file_pattern="$3"
    
    local repo_path="$REPO_DIR/$repo_subdir"
    local claude_path="$CLAUDE_DIR/$claude_subdir"
    
    # Create target directory
    mkdir -p "$claude_path"
    
    # Count existing symlinks before changes
    local before_count=$(find "$claude_path" -type l -lname "$repo_path/*" 2>/dev/null | wc -l)
    
    # Remove all existing claude-craft symlinks for this type
    find "$claude_path" -type l -lname "$repo_path/*" -delete 2>/dev/null || true
    
    # Create symlinks for all current files
    local after_count=0
    if [ -d "$repo_path" ]; then
        find "$repo_path" -name "$file_pattern" -type f | while read -r file; do
            local basename=$(basename "$file")
            ln -sf "$file" "$claude_path/$basename"
        done
        after_count=$(find "$repo_path" -name "$file_pattern" -type f 2>/dev/null | wc -l)
    fi
    
    # Track if changes occurred
    if [ "$before_count" -ne "$after_count" ]; then
        CHANGES_DETECTED=true
    fi
}

case "$ACTION" in
    "setup")
        echo "🚀 Setting up claude-craft..."
        
        # Clone if needed
        if [ ! -d "$REPO_DIR" ]; then
            git clone https://github.com/whichguy/claude-craft.git "$REPO_DIR"
        fi
        
        # Sync all directories
        sync_directory "commands" "commands" "*.md"
        sync_directory "agents" "agents" "*.json"  
        sync_directory "hooks" "hooks" "*.sh"
        
        echo "✅ Setup complete!"
        echo "⚠️  IMPORTANT: Restart Claude Code to load new commands/agents/hooks"
        ;;
        
    "sync")
        echo "📥 Syncing claude-craft..."
        cd "$REPO_DIR" && git pull
        
        # Re-sync all directories to handle file lifecycle changes
        sync_directory "commands" "commands" "*.md"
        sync_directory "agents" "agents" "*.json"
        sync_directory "hooks" "hooks" "*.sh"
        
        echo "✅ Sync complete!"
        
        if [ "$CHANGES_DETECTED" = true ]; then
            echo "⚠️  IMPORTANT: Changes detected - restart Claude Code to reload components"
        fi
        ;;
        
    "push")
        echo "📤 Pushing changes..."
        cd "$REPO_DIR"
        git add -A
        git commit -m "${2:-Update claude-craft components}"
        git push
        
        # Re-sync after push in case of any changes
        sync_directory "commands" "commands" "*.md"
        sync_directory "agents" "agents" "*.json"
        sync_directory "hooks" "hooks" "*.sh"
        
        echo "✅ Changes pushed!"
        
        if [ "$CHANGES_DETECTED" = true ]; then
            echo "⚠️  IMPORTANT: Changes detected - restart Claude Code to reload components"
        fi
        ;;
        
    "status")
        echo "📊 Claude Craft Status"
        echo "Repository: $REPO_DIR"
        cd "$REPO_DIR" && git status --short
        
        echo ""
        echo "Active symlinks:"
        for dir in commands agents hooks; do
            if [ -d "$CLAUDE_DIR/$dir" ]; then
                echo "  $dir/:"
                find "$CLAUDE_DIR/$dir" -type l -lname "$REPO_DIR/$dir/*" | sed 's|.*/||' | sort | sed 's/^/    /'
            fi
        done
        ;;
        
    "clean")
        echo "🧹 Full symlink refresh..."
        
        # Remove ALL broken symlinks from Claude directories
        find "$CLAUDE_DIR" -type l ! -exec test -e {} \; -delete 2>/dev/null || true
        
        # Re-sync all directories from scratch
        sync_directory "commands" "commands" "*.md"
        sync_directory "agents" "agents" "*.json"
        sync_directory "hooks" "hooks" "*.sh"
        
        echo "✅ Cleanup complete!"
        echo "⚠️  IMPORTANT: Restart Claude Code to reload all components"
        ;;
        
    *)
        echo "Usage: /craft [setup|sync|push|status|clean]"
        exit 1
        ;;
esac
```

## Workflow

1. **Initial Setup**: `/craft setup` - Clone repo and create symlinks
2. **Daily Use**: `/craft` - Sync latest changes (default action)
3. **Add Content**: Edit files in `~/claude-craft/`, then `/craft push`
4. **Troubleshoot**: `/craft status` and `/craft clean` as needed