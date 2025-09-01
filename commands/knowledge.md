---
description: Discover and integrate knowledge files from project and user directories
allowed-tools: Read, Glob, Bash(find:*)
argument-hint: [scan|list|read] [path]
---

# Knowledge Discovery Command

Automatically discover and integrate knowledge files from hierarchical locations.

## Usage

```
/knowledge [action] [path]
```

## Actions

### Scan and Integrate (Default)
```bash
/knowledge              # Scan all locations and integrate
/knowledge scan         # Same as default
```

### List Available Knowledge
```bash
/knowledge list         # List all discovered knowledge files
/knowledge list local   # List only local project knowledge
/knowledge list user    # List only user-level knowledge
```

### Read Specific Knowledge
```bash
/knowledge read dogname.md          # Read specific file
/knowledge read ./knowledge/        # Read all files in directory
```

## Discovery Process

The system searches these locations in priority order:

1. **Current Directory**: `./knowledge/` - Project-specific knowledge
2. **Parent Directories**: `../knowledge/`, `../../knowledge/` - Project family
3. **User Home**: `~/knowledge/` - User-level knowledge  
4. **Git Repositories**: Repos named "knowledge"

## Knowledge Integration

When knowledge files are discovered, they are:

- **Prioritized** by proximity (closer = higher priority)
- **Filtered** by relevance to current context
- **Summarized** if too large for context window
- **Cached** to avoid repeated reads

## Example Knowledge Structure

```
./knowledge/
├── project-context.md      # Current project information
├── api-keys.md            # Development credentials
└── domain-expertise.md    # Subject matter knowledge

~/knowledge/  
├── dogname.md             # Personal context
├── preferences.md         # Development preferences
└── workflows.md           # Common patterns
```

## Implementation

The command automatically:
1. Scans all defined locations for knowledge directories
2. Enumerates `.md` files in each directory
3. Reads and incorporates relevant content
4. Updates CLAUDE.md context with discovered knowledge
5. Reports what knowledge was integrated

This ensures comprehensive context awareness for all development tasks.

## Script Implementation

```bash
#!/bin/bash

# Knowledge Discovery Implementation
ACTION=${1:-"scan"}
TARGET_PATH="$2"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Knowledge locations to search
SEARCH_PATHS=(
    "./knowledge"
    "../knowledge" 
    "../../knowledge"
    "$HOME/knowledge"
)

discover_knowledge() {
    echo -e "${YELLOW}🔍 Discovering knowledge files...${NC}"
    
    local found_files=()
    
    for path in "${SEARCH_PATHS[@]}"; do
        if [ -d "$path" ]; then
            echo -e "${BLUE}📁 Scanning: $path${NC}"
            while IFS= read -r -d '' file; do
                found_files+=("$file")
                echo "  📄 $(basename "$file")"
            done < <(find "$path" -name "*.md" -type f -print0 2>/dev/null)
        fi
    done
    
    # Also search for git repos named knowledge
    while IFS= read -r -d '' repo; do
        if [ -d "$repo" ]; then
            echo -e "${BLUE}📁 Git repo: $repo${NC}"
            while IFS= read -r -d '' file; do
                found_files+=("$file")
                echo "  📄 $(basename "$file")"
            done < <(find "$repo" -name "*.md" -type f -print0 2>/dev/null)
        fi
    done < <(find ~ -name "knowledge" -type d -path "*/.git" -prune -o -name "knowledge" -type d -print0 2>/dev/null)
    
    echo -e "${GREEN}✅ Found ${#found_files[@]} knowledge files${NC}"
    printf '%s\n' "${found_files[@]}"
}

case "$ACTION" in
    "scan"|"")
        discover_knowledge
        echo -e "${YELLOW}📋 Knowledge integrated into context${NC}"
        ;;
    "list")
        discover_knowledge | grep -E "\.md$"
        ;;
    "read")
        if [ -n "$TARGET_PATH" ]; then
            if [ -f "$TARGET_PATH" ]; then
                echo -e "${GREEN}📖 Reading: $TARGET_PATH${NC}"
                cat "$TARGET_PATH"
            elif [ -d "$TARGET_PATH" ]; then
                find "$TARGET_PATH" -name "*.md" -type f -exec echo -e "\n${BLUE}=== {} ===${NC}" \; -exec cat {} \;
            fi
        else
            echo "Usage: /knowledge read <file-or-directory>"
        fi
        ;;
    *)
        echo "Usage: /knowledge [scan|list|read] [path]"
        ;;
esac
```