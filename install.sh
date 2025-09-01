#!/bin/bash
set -e

echo "🚀 Installing Claude Craft..."

REPO_DIR="$HOME/claude-craft"
CLAUDE_DIR="$HOME/.claude"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

sync_directory() {
    local repo_subdir="$1"
    local claude_subdir="$2" 
    local file_pattern="$3"
    
    local repo_path="$REPO_DIR/$repo_subdir"
    local claude_path="$CLAUDE_DIR/$claude_subdir"
    
    mkdir -p "$claude_path"
    
    # Remove existing claude-craft symlinks
    find "$claude_path" -type l -lname "$repo_path/*" -delete 2>/dev/null || true
    
    # Create symlinks for current files
    if [ -d "$repo_path" ]; then
        find "$repo_path" -name "$file_pattern" -type f | while read -r file; do
            local basename=$(basename "$file")
            ln -sf "$file" "$claude_path/$basename"
        done
    fi
}

# Clone repository if it doesn't exist
if [ ! -d "$REPO_DIR" ]; then
    echo "📥 Cloning claude-craft repository..."
    git clone https://github.com/whichguy/claude-craft.git "$REPO_DIR"
else
    echo "📥 Updating existing repository..."
    cd "$REPO_DIR" && git pull
fi

# Create symlinks
echo "🔗 Creating symlinks..."
sync_directory "commands" "commands" "*.md"
sync_directory "agents" "agents" "*.json"  
sync_directory "hooks" "hooks" "*.sh"

echo ""
echo -e "${GREEN}✅ Claude Craft installation complete!${NC}"
echo ""
echo -e "${YELLOW}📁 Repository location:${NC} $REPO_DIR"
echo -e "${YELLOW}🔗 Claude Config:${NC} $CLAUDE_DIR"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Restart Claude Code to load new commands"
echo "  2. Use /craft to sync updates"
echo "  3. Use /prompts to access templates"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Restart Claude Code now!${NC}"