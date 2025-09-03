#!/bin/bash

# Install local git hooks for claude-craft repository
# Sets up security scanning on pull and secret detection on push
# Usage: install-git-hooks.sh [repository-path]

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get repository root - use provided path or detect from current directory
if [ -n "$1" ]; then
    REPO_ROOT="$1"
    # Verify it's a git repository
    if ! git -C "$REPO_ROOT" rev-parse --show-toplevel >/dev/null 2>&1; then
        echo -e "${RED}❌ Not a git repository: $REPO_ROOT${NC}"
        exit 1
    fi
else
    REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
    if [ -z "$REPO_ROOT" ]; then
        echo -e "${RED}❌ Not in a git repository${NC}"
        exit 1
    fi
fi

HOOKS_DIR="$REPO_ROOT/.git/hooks"
SOURCE_HOOKS_DIR="$REPO_ROOT/.githooks"

# Check if source hooks exist
if [ ! -d "$SOURCE_HOOKS_DIR" ]; then
    echo -e "${RED}❌ Source hooks directory not found: $SOURCE_HOOKS_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}🪝 Installing git hooks for claude-craft repository...${NC}"
echo -e "${BLUE}Repository: $REPO_ROOT${NC}"

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Install each hook
for hook_file in "$SOURCE_HOOKS_DIR"/*; do
    if [ -f "$hook_file" ] && [ -x "$hook_file" ]; then
        hook_name=$(basename "$hook_file")
        target_hook="$HOOKS_DIR/$hook_name"
        
        # Backup existing hook if it exists and is not our symlink
        if [ -e "$target_hook" ] && [ ! -L "$target_hook" ]; then
            backup_file="$target_hook.backup.$(date +%Y%m%d_%H%M%S)"
            mv "$target_hook" "$backup_file"
            echo -e "${YELLOW}📦 Backed up existing $hook_name to: $(basename "$backup_file")${NC}"
        elif [ -L "$target_hook" ]; then
            # Remove existing symlink
            rm "$target_hook"
        fi
        
        # Ensure source hook is executable
        chmod +x "$hook_file"
        
        # Create symlink to hook
        ln -sf "../../.githooks/$hook_name" "$target_hook"
        echo -e "${GREEN}✅ Linked: $hook_name${NC}"
        
        # Show what this hook does
        case "$hook_name" in
            "post-merge")
                echo -e "${BLUE}   → Scans for security threats after git pull${NC}"
                ;;
            "pre-commit")
                echo -e "${BLUE}   → Prevents committing files with secrets${NC}"
                ;;
            *)
                echo -e "${BLUE}   → Security hook: $hook_name${NC}"
                ;;
        esac
    fi
done

echo ""
echo -e "${GREEN}✅ Git hooks installation complete!${NC}"
echo ""
echo -e "${BLUE}📋 What happens now:${NC}"
echo -e "${BLUE}   • git pull - Automatically scans pulled files for threats${NC}"
echo -e "${BLUE}   • git commit - Blocks commits with hardcoded secrets${NC}"
echo -e "${BLUE}   • Security events logged to ~/.git-security.log${NC}"
echo ""
echo -e "${YELLOW}💡 To temporarily bypass hooks (emergency only):${NC}"
echo -e "${YELLOW}   git commit --no-verify${NC}"
echo -e "${YELLOW}   git pull --no-verify (if available)${NC}"

# Test hooks are working
echo ""
echo -e "${BLUE}🧪 Testing hooks installation...${NC}"

if [ -x "$HOOKS_DIR/pre-commit" ]; then
    echo -e "${GREEN}✅ pre-commit hook ready${NC}"
else
    echo -e "${RED}❌ pre-commit hook installation failed${NC}"
fi

if [ -x "$HOOKS_DIR/post-merge" ]; then
    echo -e "${GREEN}✅ post-merge hook ready${NC}"
else
    echo -e "${RED}❌ post-merge hook installation failed${NC}"
fi

echo ""
echo -e "${GREEN}🛡️  Repository is now protected by local git hooks!${NC}"