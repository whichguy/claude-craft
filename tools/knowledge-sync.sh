#!/bin/bash
set -e

# Knowledge Discovery and CLAUDE.md Integration Tool
# Automatically discovers knowledge files and integrates them into CLAUDE.md

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
CLAUDE_FILE="${1:-CLAUDE.md}"
BACKUP_SUFFIX=".backup-$(date +%Y%m%d-%H%M%S)"

# Knowledge search paths (in priority order)
SEARCH_PATHS=(
    "./knowledge"
    "../knowledge" 
    "../../knowledge"
    "$HOME/knowledge"
    "~/knowledge"
)

# Markers for knowledge section
KNOWLEDGE_START="<!-- === Claude Craft Knowledge Discovery === -->"
KNOWLEDGE_END="<!-- === End Claude Craft Knowledge Discovery === -->"

echo -e "${YELLOW}🔍 Starting knowledge discovery for $(pwd)${NC}"

# Function to discover knowledge files (separated output and results)
discover_knowledge_files() {
    local found_files=()
    local locations=()
    
    echo -e "${BLUE}📁 Scanning for knowledge directories...${NC}" >&2
    
    for path in "${SEARCH_PATHS[@]}"; do
        if [ -d "$path" ]; then
            local resolved_path=$(realpath "$path" 2>/dev/null || echo "$path")
            echo "  ✓ Found: $resolved_path" >&2
            locations+=("$resolved_path")
            
            while IFS= read -r -d '' file; do
                if [ -f "$file" ] && [ -r "$file" ]; then
                    found_files+=("$file")
                fi
            done < <(find "$path" -name "*.md" -type f -print0 2>/dev/null)
        fi
    done
    
    # Search for git repos named knowledge
    while IFS= read -r -d '' repo; do
        if [ -d "$repo" ] && [ -d "$repo/.git" ]; then
            echo "  ✓ Git repo: $repo" >&2
            locations+=("$repo")
            
            while IFS= read -r -d '' file; do
                if [ -f "$file" ] && [ -r "$file" ]; then
                    found_files+=("$file")
                fi
            done < <(find "$repo" -name "*.md" -type f -print0 2>/dev/null)
        fi
    done < <(find ~ -name "knowledge" -type d 2>/dev/null | head -10 | tr '\n' '\0')
    
    echo -e "${GREEN}✅ Found ${#found_files[@]} knowledge files in ${#locations[@]} locations${NC}" >&2
    
    # Return only file paths to stdout
    printf '%s\n' "${found_files[@]}"
}

# Function to generate knowledge section
generate_knowledge_section() {
    local files=("$@")
    
    cat << EOF
$KNOWLEDGE_START

## Knowledge System Integration

This document automatically includes knowledge from discovered sources:

EOF

    # Simple approach: iterate through files and group by parent directory
    local current_dir=""
    for file in "${files[@]}"; do
        local dir=$(dirname "$file")
        
        # Start new directory section if changed
        if [ "$dir" != "$current_dir" ]; then
            if [ -n "$current_dir" ]; then
                echo
            fi
            echo "### Knowledge from: $dir"
            echo
            current_dir="$dir"
        fi
        
        local basename=$(basename "$file" .md)
        local rel_path="$file"
        # Try to get relative path, fallback to full path
        if command -v realpath >/dev/null 2>&1; then
            rel_path=$(realpath --relative-to="$(pwd)" "$file" 2>/dev/null || echo "$file")
        fi
        
        echo "<!-- Import: $rel_path -->"
        echo
        # Include file contents with header
        echo "#### $(echo "$basename" | sed 's/-/ /g' | tr '[:lower:]' '[:upper:]')"
        echo
        if [ -r "$file" ]; then
            cat "$file" 2>/dev/null
        else
            echo "*[File not accessible: $file]*"
        fi
        echo
    done
    
    echo
    echo "$KNOWLEDGE_END"
}

# Main execution
main() {
    # Discover knowledge files
    local knowledge_files=()
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            knowledge_files+=("$file")
        fi
    done < <(discover_knowledge_files)
    
    if [ ${#knowledge_files[@]} -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No knowledge files found${NC}"
        return 0
    fi
    
    # Show what was found
    echo -e "${BLUE}📄 Discovered files:${NC}"
    for file in "${knowledge_files[@]}"; do
        echo "  • $(realpath --relative-to="$(pwd)" "$file" 2>/dev/null || basename "$file")"
    done
    echo
    
    # Backup existing CLAUDE.md if it exists
    if [ -f "$CLAUDE_FILE" ]; then
        cp "$CLAUDE_FILE" "${CLAUDE_FILE}${BACKUP_SUFFIX}"
        echo -e "${GREEN}💾 Backed up existing $CLAUDE_FILE${NC}"
    fi
    
    # Remove existing knowledge section if present
    if [ -f "$CLAUDE_FILE" ] && grep -q "$KNOWLEDGE_START" "$CLAUDE_FILE"; then
        echo -e "${YELLOW}🔄 Updating existing knowledge section${NC}"
        sed -i.tmp "/$KNOWLEDGE_START/,/$KNOWLEDGE_END/d" "$CLAUDE_FILE"
        rm -f "${CLAUDE_FILE}.tmp"
    else
        echo -e "${GREEN}📝 Adding new knowledge section${NC}"
        if [ ! -f "$CLAUDE_FILE" ]; then
            echo "# CLAUDE.md" > "$CLAUDE_FILE"
            echo >> "$CLAUDE_FILE"
            echo "This file provides guidance to Claude Code when working with this repository." >> "$CLAUDE_FILE"
            echo >> "$CLAUDE_FILE"
        fi
    fi
    
    # Generate and append knowledge section
    generate_knowledge_section "${knowledge_files[@]}" >> "$CLAUDE_FILE"
    
    echo -e "${GREEN}✅ Knowledge integration complete!${NC}"
    echo -e "${BLUE}📋 Updated: $CLAUDE_FILE${NC}"
    echo -e "${YELLOW}💡 Backup saved as: ${CLAUDE_FILE}${BACKUP_SUFFIX}${NC}"
}

# Run main function
main "$@"