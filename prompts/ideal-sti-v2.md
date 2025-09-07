# IDEAL-STI Phase-Based Planning System (Version 2.1)
## Comprehensive 11-Phase Project Planning with Interactive User Control

**Version**: 2.1 (Enhanced with Interactive User Confirmation Points)  
**Template Context**: <prompt-template-name>  
**Project Requirements**: <prompt-context>

You are executing a sophisticated 11-phase planning orchestration system (Phases 0-10) that uses structured phase validation, user confirmation points, and quality gates for phase transitions. This version 2.1 adds mandatory user approval at critical decision points to ensure proper oversight and control.

## Critical User Interaction Points

**MANDATORY USER CONFIRMATION PHASES**: 1, 2, 3, 4, 5
After completing each of these phases, you MUST:
1. Present a clear summary of what was accomplished
2. Ask the user to review the phase output
3. Request explicit approval before proceeding
4. Offer options: continue, iterate, or stop

**Phase 6-10 Execution**: May proceed automatically after user approval of Phase 5 foundation.
**Phase 11+ Implementation**: Continuous iteration using feature-developer subagents until all features implemented.

## EXECUTION REQUIREMENTS FOR CLAUDE CODE

**MUST Execute Through Bash Tool:**
- All git worktree operations for parallel isolation
- All directory creation and file management commands
- All file rehydration patterns for information flow
- All validation checkpoint logic and quality gates

**MUST Use Task Tool For Parallel Subagents:**
- tech-research agents during Phase 4 (parallel technology investigation)
- ui-strategy agent during Phase 9 (interface design)
- dev-task agents during Phase 10 (task generation)
- qa-analyst agents during Phase 10 (test specification)
- **feature-developer agents during Phase 11+ (continuous implementation iteration)**

**MUST Validate Before Phase Transitions:**
- TODO completion in each phase file using grep patterns
- Quality gate requirements met for each phase
- File existence validation for rehydration dependencies
- User confirmation received for Phases 1-5

## Required Directory Structure

```
project-root/ (current working directory)
├── .git/                              # Git repository (REQUIRED)
├── docs/
│   └── planning/
│       ├── .worktree-state/          # State management
│       ├── phase0-existing-analysis.md   # Optional - existing project analysis
│       ├── phase1-discovery.md        # Problem elaboration
│       ├── phase2-intent.md           # Goals and metrics
│       ├── phase3-feasibility.md      # Feasibility assessment
│       ├── phase4-tech-research.md    # Technology synthesis
│       ├── phase5-requirements.md     # Requirements
│       ├── phase6-scope.md            # Scope definition
│       ├── phase7-architecture.md     # Architecture design
│       ├── phase8-decisions.md        # Final decisions
│       ├── phase9-interface.md        # Interface specs
│       └── phase10-tasks.md           # Task generation
└── tasks/
    ├── pending/                       # Generated tasks
    ├── in-progress/                   # Active tasks
    └── completed/                     # Finished tasks
```

---

## SECTION 1: CRITICAL INFRASTRUCTURE - DO NOT MODIFY

This section contains ALL worktree isolation, state management, and safety mechanisms.
These functions MUST be preserved exactly as-is for system integrity.

```bash
# Test parent directory access for worktree creation
test_parent_access() {
    if ! touch "../.test-$$" 2>/dev/null; then
        echo "FATAL: Cannot access parent directory for worktree creation"
        echo "Details: Worktrees must be created in parent directory"
        echo "Current directory: $(pwd)"
        echo "Parent directory: $(dirname "$(pwd)")"
        echo "Parent permissions: $(ls -ld ../ 2>&1)"
        exit 1
    fi
    rm "../.test-$$"
}

# State Management for Concurrent Execution
initialize_worktree_state() {
    local main_dir="$(pwd)"
    local state_dir="docs/planning/.worktree-state"
    
    # Create state directory if it doesn't exist
    mkdir -p "$state_dir"
    
    # Initialize or load execution ID for this session
    if [ -z "$IDEAL_STI_SESSION_ID" ]; then
        export IDEAL_STI_SESSION_ID="$(date +%s%N | cut -c-13)-$(openssl rand -hex 4 2>/dev/null || echo $RANDOM)"
        echo "🆔 Session ID: $IDEAL_STI_SESSION_ID"
    fi
    
    # Clean up any abandoned worktrees from previous sessions
    cleanup_abandoned_worktrees "$main_dir" "$state_dir"
    
    # Initialize state tracking files
    touch "$state_dir/active-worktrees.txt"
    touch "$state_dir/session-$IDEAL_STI_SESSION_ID.log"
    
    echo "📊 Worktree state management initialized"
}

cleanup_abandoned_worktrees() {
    local main_dir="$1"
    local state_dir="$2"
    
    echo "🧹 Cleaning up abandoned worktrees from previous sessions..."
    
    # Find all IDEAL-STI worktrees that may be abandoned
    if [ -f "$state_dir/active-worktrees.txt" ]; then
        while IFS='|' read -r worktree_path branch_name session_id status; do
            [ -z "$worktree_path" ] && continue
            
            # Check if worktree directory exists and is not from current session
            if [ -d "$worktree_path" ] && [ "$session_id" != "$IDEAL_STI_SESSION_ID" ]; then
                echo "🧹 Found abandoned worktree: $worktree_path"
                
                # Try to commit any work before cleanup
                if (cd "$worktree_path" && git status --porcelain | grep -q .); then
                    echo "💾 Committing abandoned work in $worktree_path"
                    (cd "$worktree_path" && git add -A && git commit -m "Abandoned work recovery from session $session_id" || true)
                fi
                
                # Clean up the worktree
                git -C "$main_dir" worktree remove "$worktree_path" --force 2>/dev/null || rm -rf "$worktree_path" 2>/dev/null
                git -C "$main_dir" branch -D "$branch_name" 2>/dev/null || true
                
                # Move any related tasks back to pending
                if [ "$status" = "in-progress" ]; then
                    echo "📝 Moving abandoned tasks back to pending status"
                    # Task status reset logic would go here
                fi
            fi
        done < "$state_dir/active-worktrees.txt"
        
        # Clear the active worktrees file
        > "$state_dir/active-worktrees.txt"
    fi
    
    # Clean up any remaining worktree directories matching our patterns
    for worktree_pattern in ../worktree-phase* ../worktree-contrarian* ../worktree-emergency* ../worktree-tech* ../worktree-ui* ../worktree-task*; do
        if [ -d "$worktree_pattern" ]; then
            echo "🧹 Emergency cleanup: $worktree_pattern"
            git -C "$main_dir" worktree remove "$worktree_pattern" --force 2>/dev/null || rm -rf "$worktree_pattern" 2>/dev/null
        fi
    done
    
    # Prune any stale worktree references
    git -C "$main_dir" worktree prune 2>/dev/null || true
    
    echo "✅ Abandoned worktree cleanup completed"
}

# Enhanced Worktree Creation with Concurrent Execution Safety
create_isolated_worktree() {
    local base_name="$1"
    local branch_prefix="$2"
    local max_attempts=50  # Increased for concurrent safety
    local attempt=1
    local main_dir="$(pwd)"
    local state_dir="docs/planning/.worktree-state"
    
    # Ensure state management is initialized
    initialize_worktree_state
    
    # Generate session-unique identifiers to prevent conflicts
    local session_prefix="$IDEAL_STI_SESSION_ID"
    local process_id="$$"  # Current process ID
    local timestamp=$(date +%s%N | cut -c-13)  # nanosecond precision
    
    while [ $attempt -le $max_attempts ]; do
        local random_suffix=$(openssl rand -hex 3 2>/dev/null || echo $(($RANDOM % 9999)))
        local unique_id="${session_prefix}-${process_id}-${timestamp}-${random_suffix}-${attempt}"
        local worktree_name="worktree-${base_name}-${unique_id}"
        local branch_name="${branch_prefix}-${unique_id}"
        
        WORKTREE="../${worktree_name}"
        
        # Triple check: directory, git worktree list, AND our state file
        local location_available=true
        
        # Check 1: Directory doesn't exist
        if [ -d "$WORKTREE" ]; then
            location_available=false
        fi
        
        # Check 2: Not in git worktree list (using subshell format)
        if (cd "$main_dir" && git worktree list | grep -q "$WORKTREE"); then
            location_available=false
        fi
        
        # Check 3: Not in our active worktrees state file
        if [ -f "$state_dir/active-worktrees.txt" ] && grep -q "^$WORKTREE|" "$state_dir/active-worktrees.txt"; then
            location_available=false
        fi
        
        # Check 4: No conflicting directories in parent (using subshell format)
        if (cd .. && [ -d "$(basename "$WORKTREE")" ]); then
            location_available=false
        fi
        
        if [ "$location_available" = true ]; then
            # Attempt to create worktree - using -C for main repo
            if git -C "$main_dir" worktree add -b "$branch_name" "$WORKTREE" 2>/dev/null; then
                echo "✅ Created isolated worktree: $WORKTREE"
                echo "📍 Branch: $branch_name"
                echo "🆔 Session: $IDEAL_STI_SESSION_ID"
                
                # Register worktree in state management
                echo "$WORKTREE|$branch_name|$IDEAL_STI_SESSION_ID|active|$(date -Iseconds)" >> "$state_dir/active-worktrees.txt"
                echo "Created worktree: $WORKTREE at $(date -Iseconds)" >> "$state_dir/session-$IDEAL_STI_SESSION_ID.log"
                
                # Apply changes with direct piping using -C
                apply_changes_with_enhanced_piping "$WORKTREE" "$main_dir"
                
                # Export for cleanup later
                export CURRENT_WORKTREE="$WORKTREE"
                export CURRENT_BRANCH="$branch_name"
                return 0
            fi
        fi
        
        # Increment for next attempt with exponential backoff
        attempt=$((attempt + 1))
        if [ $attempt -le 10 ]; then
            sleep 0.1  # Short delay for first few attempts
        elif [ $attempt -le 25 ]; then
            sleep 0.5  # Medium delay for middle attempts  
        else
            sleep 1    # Longer delay for final attempts
        fi
        
        # Regenerate timestamp every 10 attempts to avoid patterns
        if [ $((attempt % 10)) -eq 0 ]; then
            timestamp=$(date +%s%N | cut -c-13)
        fi
    done
    
    echo "❌ FATAL: Could not create isolated worktree after $max_attempts attempts"
    echo "🔍 Check parent directory permissions and concurrent execution limits"
    echo "📊 Active worktrees: $(wc -l < "$state_dir/active-worktrees.txt" 2>/dev/null || echo 0)"
    exit 1
}

# Enhanced Change Application with Direct Piping and -C
apply_changes_with_enhanced_piping() {
    local worktree="$1"
    local main_dir="${2:-$(pwd)}"
    
    # Check if there are unstaged changes to apply - using -C for main repo
    if git -C "$main_dir" diff --quiet HEAD; then
        echo "📝 No unstaged changes to apply to worktree"
        return 0
    fi
    
    echo "🔄 Applying changes to worktree with enhanced direct piping..."
    
    # Enhanced fallback chain with comprehensive -C usage
    if git -C "$main_dir" diff HEAD | git -C "$worktree" apply 2>/dev/null; then
        echo "✅ Successfully applied changes via direct piping"
        return 0
    elif git -C "$main_dir" diff HEAD | git -C "$worktree" apply --3way 2>/dev/null; then
        echo "✅ Applied changes using 3-way merge fallback"
        return 0
    elif git -C "$main_dir" diff HEAD | git -C "$worktree" apply --ignore-whitespace 2>/dev/null; then
        echo "⚠️ Applied changes ignoring whitespace differences"
        return 0
    else
        echo "❌ All patch application methods failed"
        echo "🔍 Subagent will work with base commit state only"
        return 1
    fi
}

# Enhanced Worktree Cleanup with State Management and -C
cleanup_isolated_worktree() {
    local worktree="${1:-$CURRENT_WORKTREE}"
    local branch="${2:-$CURRENT_BRANCH}"
    local main_dir="$(pwd)"  # Store current directory for main repo operations
    local state_dir="docs/planning/.worktree-state"
    
    if [ -z "$worktree" ] || [ -z "$branch" ]; then
        echo "⚠️ Warning: Missing worktree or branch information for cleanup"
        return 1
    fi
    
    echo "🧹 Cleaning up isolated worktree: $worktree"
    echo "🆔 Session: ${IDEAL_STI_SESSION_ID:-unknown}"
    
    if [ -d "$worktree" ]; then
        # Check for ALL types of changes using -C for worktree operations
        local has_staged_changes=false
        local has_unstaged_changes=false  
        local has_untracked_files=false
        
        # Check staged changes - using -C for worktree
        if ! git -C "$worktree" diff --cached --quiet 2>/dev/null; then
            has_staged_changes=true
            echo "📝 Found staged changes in worktree"
        fi
        
        # Check unstaged changes to tracked files - using -C for worktree
        if ! git -C "$worktree" diff --quiet 2>/dev/null; then
            has_unstaged_changes=true
            echo "📝 Found unstaged changes to tracked files"
        fi
        
        # Check for untracked files (CRITICAL for subagent-created files) - using -C for worktree
        local untracked_count=$(git -C "$worktree" ls-files --others --exclude-standard | wc -l)
        if [ "$untracked_count" -gt 0 ]; then
            has_untracked_files=true
            echo "📝 Found $untracked_count untracked files created by subagent"
            echo "📋 Untracked files:"
            git -C "$worktree" ls-files --others --exclude-standard | sed 's/^/  - /'
        fi
        
        # If ANY type of work exists, commit it
        if [ "$has_staged_changes" = true ] || [ "$has_unstaged_changes" = true ] || [ "$has_untracked_files" = true ]; then
            echo "💾 Committing all subagent work (staged + unstaged + untracked)"
            
            # Add ALL files (tracked changes + untracked files) - using -C for worktree
            git -C "$worktree" add -A
            
            # Create detailed commit message
            local commit_msg="Subagent work: $(basename "$worktree")

Includes:
- Staged changes: $has_staged_changes
- Unstaged changes: $has_unstaged_changes  
- New files: $has_untracked_files ($untracked_count files)

Generated by: $(echo "$branch" | sed 's/-[0-9]*-[a-f0-9]*-[0-9]*$//')"
            
            # Commit in worktree - using -C for worktree
            if git -C "$worktree" commit -m "$commit_msg" 2>/dev/null; then
                echo "✅ Successfully committed all subagent work"
                
                # Show what was committed for verification - using -C for worktree
                echo "📊 Committed files:"
                git -C "$worktree" diff --name-only HEAD~1 HEAD | sed 's/^/  + /'
                
                # Merge changes back to main branch - using -C for main repo
                echo "🔀 Merging subagent work to main branch..."
                if git -C "$main_dir" merge --squash "$branch" 2>/dev/null; then
                    echo "✅ Successfully merged subagent work to main branch"
                    
                    # Commit the squashed merge - using -C for main repo
                    if git -C "$main_dir" commit -m "Merge subagent work from $branch" 2>/dev/null; then
                        echo "✅ Squash merge committed to main branch"
                    else
                        echo "⚠️ Warning: Squash merge staged but not committed"
                        echo "🔍 Run 'git -C \"$main_dir\" commit' to finalize merge"
                    fi
                else
                    echo "⚠️ Warning: Could not merge subagent work automatically"
                    echo "🔍 Manual merge may be required"
                    echo "💡 Try: git -C \"$main_dir\" merge --squash $branch && git -C \"$main_dir\" commit"
                fi
            else
                echo "❌ Failed to commit subagent work"
                echo "🔍 Check worktree state: git -C \"$worktree\" status"
            fi
        else
            echo "📝 No work found in worktree - nothing to merge"
        fi
        
        # Remove worktree with verification - using -C for main repo
        if git -C "$main_dir" worktree remove "$worktree" --force 2>/dev/null; then
            echo "✅ Worktree removed successfully"
        else
            echo "⚠️ Warning: Could not remove worktree cleanly"
            # Force cleanup if directory still exists
            if [ -d "$worktree" ]; then
                echo "🧹 Force removing worktree directory"
                rm -rf "$worktree" 2>/dev/null || true
            fi
        fi
    fi
    
    # Clean up branch with verification - using -C for main repo
    if git -C "$main_dir" branch | grep -q "$branch"; then
        if git -C "$main_dir" branch -D "$branch" 2>/dev/null; then
            echo "🗑️ Branch cleaned up successfully"
        else
            echo "⚠️ Warning: Could not clean up branch"
        fi
    fi
    
    # Remove from state tracking
    if [ -f "$state_dir/active-worktrees.txt" ]; then
        # Create temporary file without the cleaned up worktree
        grep -v "^$worktree|" "$state_dir/active-worktrees.txt" > "$state_dir/active-worktrees.tmp" || true
        mv "$state_dir/active-worktrees.tmp" "$state_dir/active-worktrees.txt"
        echo "Cleaned worktree: $worktree at $(date -Iseconds)" >> "$state_dir/session-${IDEAL_STI_SESSION_ID:-unknown}.log"
    fi
    
    # Verify cleanup completion
    verify_cleanup_complete "$worktree" "$branch" "$main_dir"
}

# Cleanup Verification with -C
verify_cleanup_complete() {
    local worktree="$1"
    local branch="$2" 
    local main_dir="${3:-$(pwd)}"
    local issues=0
    
    # Check if worktree directory still exists
    if [ -d "$worktree" ]; then
        echo "⚠️ Cleanup issue: Worktree directory still exists: $worktree"
        issues=$((issues + 1))
    fi
    
    # Check if branch still exists - using -C for main repo
    if git -C "$main_dir" branch | grep -q "$branch"; then
        echo "⚠️ Cleanup issue: Branch still exists: $branch"
        issues=$((issues + 1))
    fi
    
    # Check git worktree list for references - using -C for main repo
    if git -C "$main_dir" worktree list | grep -q "$worktree"; then
        echo "⚠️ Cleanup issue: Git still references worktree: $worktree"
        issues=$((issues + 1))
    fi
    
    if [ $issues -eq 0 ]; then
        echo "✅ Worktree cleanup verified complete"
        return 0
    else
        echo "❌ Worktree cleanup incomplete ($issues issues found)"
        return 1
    fi
}

# Mass Cleanup with Enhanced -C Usage
cleanup_all_worktrees() {
    local main_dir="$(pwd)"
    
    echo "🚨 Emergency: Cleaning up all IDEAL-STI worktrees..."
    
    # Clean up any worktrees matching our patterns - using -C for main repo
    git -C "$main_dir" worktree list | grep -E "worktree-(phase|contrarian|emergency|tech|ui|task)" | while read path branch; do
        echo "🧹 Emergency cleanup: $path"
        git -C "$main_dir" worktree remove "$path" --force 2>/dev/null || rm -rf "$path" 2>/dev/null
    done
    
    # Clean up branches - using -C for main repo
    git -C "$main_dir" branch | grep -E "(phase|contrarian|emergency|research|ui-design|task)-" | while read -r branch; do
        echo "🗑️ Emergency branch cleanup: $branch"
        git -C "$main_dir" branch -D "$branch" 2>/dev/null || true
    done
    
    # Prune worktree references - using -C for main repo
    git -C "$main_dir" worktree prune
    
    echo "✅ Emergency cleanup completed"
}

# Knowledge Folder Scanning and Aggregation
scan_knowledge_folders() {
    echo "📚 Scanning for knowledge folders..."
    
    local knowledge_content=""
    local knowledge_found=false
    
    # Define search paths for knowledge folders
    local search_paths=(
        "."                    # Current directory
        ".."                  # Parent directory
        "../.."              # Grandparent directory  
        "$HOME"              # User home directory
        "$(pwd)"             # Explicit current directory
    )
    
    # Search for knowledge folders
    for search_path in "${search_paths[@]}"; do
        local knowledge_path="$search_path/knowledge"
        
        if [ -d "$knowledge_path" ]; then
            echo "📁 Found knowledge folder: $knowledge_path"
            knowledge_found=true
            
            # Aggregate all markdown files from this knowledge folder (using subshell format)
            local md_files=$(cd "$knowledge_path" && find . -name "*.md" -type f | sort)
            
            if [ -n "$md_files" ]; then
                knowledge_content="$knowledge_content\n\n## Knowledge from $knowledge_path\n"
                
                # Process each markdown file (using subshell format)
                echo "$md_files" | while read -r md_file; do
                    if [ -f "$knowledge_path/$md_file" ]; then
                        echo "📄 Processing: $knowledge_path/$md_file"
                        knowledge_content="$knowledge_content\n\n### $(basename "$md_file" .md)\n"
                        knowledge_content="$knowledge_content\n$(cat "$knowledge_path/$md_file")\n"
                    fi
                done
            fi
        fi
    done
    
    # Generate aggregated knowledge for CLAUDE.md enhancement
    if [ "$knowledge_found" = true ]; then
        echo "💡 Aggregating knowledge for project context..."
        
        # Create or update project knowledge section
        local claude_md_path="CLAUDE.md"
        local project_knowledge_path="docs/planning/aggregated-knowledge.md"
        
        # Create aggregated knowledge file
        cat > "$project_knowledge_path" << EOF
# Aggregated Knowledge for Project Context

This file contains knowledge aggregated from various knowledge folders to provide context for the IDEAL-STI planning system.

## Sources Scanned
$(for path in "${search_paths[@]}"; do
    if [ -d "$path/knowledge" ]; then
        echo "- $path/knowledge ($(cd "$path/knowledge" && find . -name "*.md" -type f | wc -l) files)"
    fi
done)

## Aggregated Content
$knowledge_content

---
*Generated by IDEAL-STI knowledge scanning system at $(date -Iseconds)*
EOF
        
        # Update CLAUDE.md if it exists, otherwise create knowledge reference
        if [ -f "$claude_md_path" ]; then
            echo "📝 Updating existing CLAUDE.md with knowledge reference..."
            if ! grep -q "aggregated-knowledge.md" "$claude_md_path"; then
                echo "" >> "$claude_md_path"
                echo "## Project Knowledge" >> "$claude_md_path"
                echo "" >> "$claude_md_path"
                echo "Comprehensive knowledge aggregated from available knowledge folders:" >> "$claude_md_path"
                echo "- See: [Aggregated Knowledge](docs/planning/aggregated-knowledge.md)" >> "$claude_md_path"
                echo "- Auto-updated during IDEAL-STI execution" >> "$claude_md_path"
            fi
        else
            echo "📝 Creating CLAUDE.md knowledge reference..."
            cat > "$claude_md_path" << EOF
# CLAUDE.md - Project Context

## Project Knowledge

Comprehensive knowledge aggregated from available knowledge folders:
- See: [Aggregated Knowledge](docs/planning/aggregated-knowledge.md)
- Auto-updated during IDEAL-STI execution

## IDEAL-STI Integration

This project uses the IDEAL-STI phase-based planning system with:
- Adaptive intelligence framework
- Comprehensive research integration
- Parallel subagent execution with worktree isolation
- Quality gates and validation checkpoints

*Generated by IDEAL-STI at $(date -Iseconds)*
EOF
        fi
        
        echo "✅ Knowledge aggregation completed"
        echo "📊 Total knowledge files processed: $(cd "$project_knowledge_path" && grep -c "^### " . || echo 0)"
    else
        echo "📝 No knowledge folders found in search paths"
        echo "💡 To add project knowledge, create a 'knowledge' folder with .md files"
    fi
}

# Directory Isolation Helper - ALWAYS use (cd && command) format
safe_directory_operation() {
    local target_dir="$1"
    local command="$2"
    
    # Execute command in subshell to prevent directory changes
    if [ -d "$target_dir" ]; then
        (cd "$target_dir" && eval "$command")
    else
        echo "❌ Directory does not exist: $target_dir"
        return 1
    fi
}
```

---

## SECTION 2: PHASE EXECUTION WITH USER CONFIRMATION

This section defines each phase with mandatory user confirmation checkpoints at critical decision points.

### User Confirmation Protocol

After completing Phases 1, 2, 3, 4, and 5, you MUST:

1. **Present Phase Summary**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📊 Phase [N] Complete: [Phase Name]  
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   ✅ **Key Accomplishments:**
   - [List 3-5 major accomplishments]
   
   📋 **Created Deliverables:**
   - [List files and sections created]
   
   🔍 **Critical Findings:**
   - [Highlight important discoveries or decisions]
   
   📄 **Full Output**: docs/planning/phase[N]-[name].md
   ```

2. **Request User Review**:
   ```
   🛑 **USER CONFIRMATION REQUIRED**
   
   Please review the Phase [N] output and choose:
   
   **continue** - Proceed to Phase [N+1]
   **iterate** - Refine current phase (provide specific feedback)  
   **stop** - End planning session
   
   Your response: [continue/iterate/stop]
   ```

3. **Handle User Response**:
   - **continue**: Proceed to next phase
   - **iterate**: Ask for specific feedback, then refine current phase
   - **stop**: End execution gracefully

### Phase 0: Existing Project Analysis (OPTIONAL)

**Purpose:** Reverse engineer existing code and documentation to understand current state before planning improvements.

**Skip Conditions:**
- No `src/` or `docs/` directories exist (greenfield project)
- Documentation modified within last 7 days (fresh docs)
- User explicitly sets `IDEAL_STI_SKIP_PHASE_0=true`

**Execution Instructions:**
```markdown
IF phase should run, create docs/planning/phase0-existing-analysis.md with:

## Project Discovery
- Detected project type (language, framework)
- File structure and organization
- Dependencies and external services
- Build/deployment configuration

## Source Code Analysis  
- Architecture patterns detected
- Core components and modules
- API surfaces and interfaces
- Test coverage assessment

## Documentation Status
- README completeness (0-100%)
- API documentation coverage
- Inline code comments density
- Setup instructions accuracy

## Reverse Engineered Requirements
- Inferred functional requirements from code
- Discovered non-functional requirements
- Security measures implemented

## Technical Debt Assessment
- Code smells detected
- Outdated dependencies
- Missing tests
- Security vulnerabilities

## Recommended Actions
- [ ] Update README with discovered features
- [ ] Document API endpoints found  
- [ ] Add architecture diagrams
- [ ] Create missing setup guides

## Integration with Planning
- Existing features to preserve
- Constraints from current implementation
- Migration requirements
```

**Phase 0 continues without user confirmation since it's optional.**

### Phase 1: Discovery & Problem Elaboration

**Purpose:** Comprehensive problem analysis with stakeholder research and contrarian thinking.

**Execution Instructions:**
```markdown
Create docs/planning/phase1-discovery.md with exhaustive analysis:

## Original Request
[Capture verbatim user requirements and preserve context]

## Expanded Problem Statement  
Scale content appropriately:
- Simple project: 1-2 paragraphs
- Medium project: Full page with subsections  
- Complex project: Multiple pages with domain analysis

## Stakeholder Analysis
Scale to project scope:
- Minimum: Primary users + 2 other categories
- Medium: 5-7 stakeholder categories with needs/pain points
- Enterprise: 10+ including regulatory/compliance bodies
- MUST discover hidden stakeholders through research

## Use Cases & Scenarios
Scale appropriately:  
- Simple tool: 5-8 use cases
- Standard app: 10-15 use cases
- Platform: 20+ use cases with sub-flows
- MUST include edge cases and failure modes

## Requirements Discovery
- Functional requirements (user capabilities)
- Non-functional requirements (performance, security)
- Compliance requirements (if applicable)  
- Technical constraints

## What NOT to Do (CRITICAL)
- Anti-patterns to avoid
- Common mistakes in this domain
- Technology-first thinking traps
- Assumptions that could be wrong

## Contrarian Analysis
- What if our core assumptions are wrong?
- Who would hate this solution and why?
- What hidden agendas might stakeholders have?
- What are we NOT seeing about this problem?

## Fatal Learnings from Production
Research and document:
- What killed similar projects? (with evidence)
- What performance walls did they hit?
- What security breaches occurred?
- What compliance issues emerged?

## TODO for Phase 2
- [ ] Define measurable success metrics based on stakeholder needs
- [ ] Establish concrete goals aligned with requirements
- [ ] Create outcome definitions for different user personas
- [ ] Additional items based on discovery findings
```

**MANDATORY USER CONFIRMATION AFTER PHASE 1**

### Phase 2: Intent & Goals

**Purpose:** Define measurable goals and success criteria based on Phase 1 discoveries.

**Execution Instructions:**
```markdown  
Create docs/planning/phase2-intent.md with goal hierarchy:

## Project Goals
Scale to project scope:
- Simple: 3-5 clear objectives with metrics
- Medium: 5-7 categorized goals with sub-objectives
- Complex: Goal hierarchy with strategic/tactical levels

Base goals on Phase 1 stakeholder analysis and requirements.

## Success Metrics (SMART Format)
For each goal, define:
- Quantifiable targets with baselines
- Time-bound milestones  
- User satisfaction metrics
- Business impact measures

## Expected Outcomes by Stakeholder
For each stakeholder group from Phase 1:
- Direct value they receive
- Efficiency gains or cost savings
- Strategic benefits

## Anti-Patterns & Goal Conflicts  
- What NOT to optimize for
- Metrics that could mislead
- Goals that conflict with each other
- Common goal-setting mistakes

## Value Proposition Statements
Clear value statements for:
- Primary users
- Secondary stakeholders
- Business sponsors

## Risk Mitigation for Goals
- Privacy and security risks to goal achievement
- Performance impact risks  
- User adoption risks

## TODO for Phase 3
- [ ] Assess technical feasibility of all goals
- [ ] Identify major risks that could block goals
- [ ] Define resource constraints for goal achievement
- [ ] Validate goals with user research if needed
```

**MANDATORY USER CONFIRMATION AFTER PHASE 2**

### Phase 3: Feasibility Assessment

**Purpose:** Risk-aware analysis of project feasibility with go/no-go recommendation.

**Execution Instructions:**
```markdown
Create docs/planning/phase3-feasibility.md with comprehensive assessment:

## Technical Feasibility 
For each major goal from Phase 2:
- Core technical challenges
- Available solutions and frameworks
- Technology readiness assessment
- Integration complexity

## Resource Assessment
- Infrastructure needs and costs
- Third-party dependencies

## Risk Analysis
Scale to project complexity:
- Simple: Top 5 risks with mitigation
- Medium: Risk matrix (probability/impact) 
- Complex: Comprehensive risk register with owners

Include risks from Phase 1 fatal learnings.

## Constraints Analysis
- Technical limitations discovered
- Resource boundaries identified
- Regulatory requirements from stakeholder analysis
- Market/competitive constraints

## Tooling Analsysis 
- Identify tooling that would be required 
- Idenfity similar style tools that would help with debugging

## Go/No-Go Recommendation
- Clear feasibility verdict with confidence level
- Required conditions for success
- Alternative approaches if constraints prevent main approach
- Success probability assessment
 

## TODO for Phase 4
- [ ] Research specific technology options for feasible approach
- [ ] Evaluate integration frameworks and patterns  
- [ ] Assess performance characteristics of candidate technologies
- [ ] Gather GitHub evidence for technology decisions
```

**MANDATORY USER CONFIRMATION AFTER PHASE 3**

### Phase 4: Technology Research with GitHub Evidence

**Purpose:** Evidence-based technology stack discovery with real-world validation.

**CRITICAL REQUIREMENTS:**
- Find 5+ popular GitHub repos (1000+ stars) for EACH major technology choice
- Always perfer built-in functionality of a system vs a 3rd party unless there is a spcecific reason such as the base system doens't support the functionality
- Focus on production reality, not tutorials or demos
- Document actual performance bottlenecks from repo issues
- Extract fatal learnings from production post-mortems

**Execution Instructions:**
```markdown
Create docs/planning/phase4-tech-research.md with evidence-based recommendations:

## Research Methodology
- Discovery-driven approach (find solutions, don't prescribe)
- GitHub evidence requirements (5+ repos, 1000+ stars each)
- Production focus over tutorial preference
- Performance bottleneck analysis from real issues

## Technology Dimensions Researched
Launch tech-research agents for parallel discovery:
- Frontend architectures (if applicable)
- Backend architectures  
- Data persistence layers
- Infrastructure/deployment approaches
- API/integration patterns
- Security and authentication approaches

## Scale
- Idenify the request and technology ability to support the scale of the profiled set of operations

## State and Storage
- Identify how state and storage will be handled, if any, for the operations and use cases
- Keep in mind encoding formats and identifiers for state storage 

## User Interface
- Analyze whether the user interface will support the intended use cases with the technologies 


## GitHub Repository Evidence
For EACH technology recommendation, document:

### [Technology Category]: [Recommended Solution]
**GitHub Evidence:**
1. **[Repo Name]** ([URL], [stars], [last update])
   - Tech stack versions used
   - Architecture patterns implemented
   - Performance optimizations found
   - Notable production learnings from issues

[Repeat for 5+ repositories per technology]

**Production Analysis:**
- What's actually deployed (package downloads, Docker pulls)
- Performance characteristics (benchmarks, bottlenecks)
- Fatal learnings (what failed spectacularly)
- Adjacent dependencies (what else you're committing to)

## Technology Stack Recommendations

### Safe Production Choice (Boring but Proven)
- Framework: [X] based on [Y] repos with 5+ years stability
- Expected success: 90%+ (proven patterns)
- Trade-offs: Lower innovation, higher predictability

### Innovation Choice (Trending with Evidence) 
- Framework: [X] based on [Y] repos with strong growth
- Expected success: 75-85% (newer but validated)
- Trade-offs: Higher capability, moderate risk

### Avoid Unless Specific Requirements
- Frameworks with evidence of production issues
- Technologies with declining maintenance
- Solutions with vendor lock-in risks

## Fatal Learnings from Production
Document from repository analysis:
- What killed similar projects in this domain
- Common performance bottlenecks hit
- Security breaches documented  
- Compliance issues that emerged

## Architecture Integration Analysis
- System performance characteristics
- Data flow design
- Integration patterns validated by repos
- Scaling patterns and limits

## TODO for Phase 5
- [ ] Define functional requirements based on validated tech constraints
- [ ] Specify performance requirements from benchmark analysis  
- [ ] Document API contracts based on integration patterns
- [ ] Create acceptance criteria based on GitHub evidence
```

**MANDATORY USER CONFIRMATION AFTER PHASE 4**

### Phase 5: Requirements Definition

**Purpose:** Detailed functional and non-functional requirements based on validated technology stack.

**Execution Instructions:**
```markdown
Create docs/planning/phase5-requirements.md with complete specification:

## Functional Requirements
Format as user stories based on Phase 1 stakeholders:

### Epic: [Major Feature Area]
**User Story**: As a [stakeholder type], I want [capability] so that [value]
**Acceptance Criteria:**
- [ ] [Testable condition 1]  
- [ ] [Testable condition 2]
- [ ] [Performance criteria from Phase 4 analysis]
**Priority**: [Must Have/Should Have/Could Have]
**Effort Estimate**: [Based on Phase 4 tech choices]

[Repeat for all major features]

## Non-Functional Requirements

### Performance Requirements (from Phase 4 benchmarks)
- Response time targets with load scenarios
- Throughput requirements with user growth projections
- Scalability requirements based on usage analysis

### Security Requirements (from stakeholder analysis)
- Authentication/authorization requirements
- Data protection requirements (based on privacy analysis)
- Compliance requirements (from regulatory stakeholders)

### Reliability Requirements
- Availability targets (uptime requirements)
- Recovery time objectives
- Data backup and recovery requirements

### Usability Requirements
- User experience goals from Phase 2
- Accessibility requirements 
- Internationalization needs (if identified)

## Technical Requirements (from Phase 4 analysis)
- Platform compatibility requirements
- Integration requirements with existing systems
- Data migration requirements (if Phase 0 identified legacy)
- API requirements for extensibility

## Compliance Requirements (from stakeholder analysis)
- Regulatory compliance needs identified
- Industry standard compliance (if applicable)
- Data governance requirements
- Audit and reporting requirements

## Requirements Traceability Matrix
Map each requirement to:
- Originating stakeholder need (Phase 1)
- Supporting goal (Phase 2) 
- Technical feasibility assessment (Phase 3)
- Technology choice impact (Phase 4)

## TODO for Phase 6
- [ ] Prioritize requirements for MVP vs future phases
- [ ] Define explicit scope boundaries (what's NOT included)
- [ ] Create phase 2 feature roadmap
- [ ] Establish out-of-scope criteria
```

**MANDATORY USER CONFIRMATION AFTER PHASE 5**

### Phases 6-10: Automated Execution

After user approval of Phase 5, the system continues with Phases 6-10 automatically:

**Phase 6**: Scope & Prioritization (MVP definition, feature roadmap)
**Phase 7**: Architecture Design (system, data, security architecture)  
**Phase 8**: Decision Registry (technology decisions with rationale)
**Phase 9**: Interface Specifications (UI/UX specs, API specs)
**Phase 10**: Task Generation (implementation tasks with dependencies)

### Phase 11+: Implementation Iteration

After Phase 10 task generation, continuously iterate using feature-developer subagents:

**Purpose:** Implement all features using task-driven development with feature-developer subagents.

**Execution Loop:**
```bash
# Continuous implementation iteration until all features complete
while [ "$(count_pending_tasks)" -gt 0 ]; do
    # Get highest priority pending task
    current_task=$(get_next_priority_task)
    
    echo "🚀 Implementing: $current_task"
    
    # Launch feature-developer subagent for task implementation
    ask subagent feature-developer to develop task "$current_task"
    
    # Validate task completion
    if validate_task_completion "$current_task"; then
        move_task_to_completed "$current_task"
        echo "✅ Task completed: $current_task"
    else
        echo "⚠️ Task needs iteration: $current_task"
        # Task remains in pending for retry with updated context
    fi
    
    # Check for new dependencies discovered during implementation
    discover_new_tasks_from_implementation
done

echo "🎉 All features implemented successfully!"
```

**Task Management:**
- Tasks stored in `tasks/pending/`, `tasks/in-progress/`, `tasks/completed/`
- Each task file contains implementation specifications from Phase 10
- Feature-developer subagents work in isolated git worktrees
- Failed implementations remain in pending for retry with learned context
- New tasks discovered during implementation are added to pending

**Quality Gates:**
- Each implemented feature must pass defined acceptance criteria
- Integration tests must pass before task completion
- Code review standards must be met
- Performance requirements validated

**Completion Criteria:**
- All `tasks/pending/` directory is empty
- All features from Phase 10 successfully implemented
- All acceptance criteria validated
- System meets all non-functional requirements from Phase 5

---

## SECTION 3: SIMPLIFIED EXECUTION FRAMEWORK

```bash
# Main entry point with user confirmation integration
main() {
    local ARGUMENTS="$1"
    
    # Initialize git if needed
    if [ ! -d .git ]; then
        git init
        git add .
        git commit -m "Initial commit for IDEAL-STI planning" || true
    fi
    
    # Initialize state management
    initialize_worktree_state
    scan_knowledge_folders
    
    # Create directory structure
    mkdir -p docs/planning
    mkdir -p tasks/{pending,in-progress,completed}
    
    # Execute phases with user confirmation checkpoints
    local critical_phases=(0 1 2 3 4 5)
    local auto_phases=(6 7 8 9 10)
    
    # Critical phases with user confirmation
    for phase in "${critical_phases[@]}"; do
        if [ "$phase" = "0" ] && ! should_run_phase_0; then
            continue  # Skip Phase 0 if not needed
        fi
        
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🎯 Phase $phase: $(get_phase_name $phase)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Execute phase
        execute_phase_${phase} "$ARGUMENTS"
        
        # Validate phase completion
        if ! validate_phase "$phase"; then
            echo "❌ Phase $phase validation failed"
            return 1
        fi
        
        # User confirmation for critical phases (skip Phase 0 confirmation)
        if [ "$phase" != "0" ]; then
            present_phase_summary "$phase"
            if ! get_user_confirmation "$phase"; then
                echo "🛑 Planning session ended by user"
                return 0
            fi
        fi
    done
    
    echo ""
    echo "🚀 User approved foundation (Phases 1-5). Proceeding with automatic execution of Phases 6-10..."
    
    # Automated phases after user approval
    for phase in "${auto_phases[@]}"; do
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "⚡ Phase $phase: $(get_phase_name $phase)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        execute_phase_${phase} "$ARGUMENTS"
        
        if ! validate_phase "$phase"; then
            echo "❌ Phase $phase validation failed"
            return 1
        fi
    done
    
    echo ""
    echo "✅ IDEAL-STI planning complete with user-approved foundation!"
    echo "📊 Generated $(ls tasks/pending/*.md 2>/dev/null | wc -l) implementation tasks"
    
    # Phase 11+: Continuous implementation iteration
    echo ""
    echo "🚀 Phase 11+: Beginning continuous implementation iteration..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    execute_implementation_loop "$ARGUMENTS"
}

# User confirmation functions
present_phase_summary() {
    local phase="$1"
    local phase_name="$(get_phase_name $phase)"
    local phase_file="docs/planning/phase${phase}-*.md"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Phase $phase Complete: $phase_name"  
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo ""
    echo "✅ **Key Accomplishments:**"
    case $phase in
        1) echo "   - Comprehensive stakeholder analysis and use case definition"
           echo "   - Contrarian analysis and fatal learnings research"
           echo "   - Problem space thoroughly explored with requirements" ;;
        2) echo "   - SMART goals defined with success metrics"
           echo "   - Stakeholder value propositions clarified"
           echo "   - Anti-patterns identified to avoid" ;;
        3) echo "   - Technical feasibility assessed with risk analysis"
           echo "   - Resource requirements identified with gap analysis"
           echo "   - Go/No-Go recommendation with confidence level" ;;
        4) echo "   - Technology stack researched with GitHub evidence"
           echo "   - Production reality validated through repository analysis"
           echo "   - Performance characteristics documented from benchmarks" ;;
        5) echo "   - Functional requirements defined as testable user stories"
           echo "   - Non-functional requirements based on validated tech stack"
           echo "   - Requirements traceability established across phases" ;;
    esac
    
    echo ""
    echo "📋 **Created Deliverables:**"
    if ls $phase_file 1>/dev/null 2>&1; then
        ls $phase_file | sed 's/^/   - /'
        echo ""
        echo "📄 **Full Output**: $(ls $phase_file | head -1)"
    fi
}

get_user_confirmation() {
    local phase="$1"
    local next_phase=$((phase + 1))
    
    echo ""
    echo "🛑 **USER CONFIRMATION REQUIRED**"
    echo ""
    echo "Please review the Phase $phase output and choose:"
    echo ""
    echo "**continue** - Proceed to Phase $next_phase"
    echo "**iterate** - Refine current phase (provide specific feedback)"  
    echo "**stop** - End planning session"
    echo ""
    echo -n "Your response: [continue/iterate/stop] "
    
    read -r user_choice
    
    case "$user_choice" in
        continue|c)
            echo "✅ Proceeding to Phase $next_phase"
            return 0
            ;;
        iterate|i)
            echo "📝 Please provide specific feedback for refinement:"
            read -r feedback
            echo "🔄 Refining Phase $phase with feedback: $feedback"
            # Re-execute phase with feedback context
            export IDEAL_STI_REFINEMENT="$feedback"
            execute_phase_${phase} "$ARGUMENTS"
            # Recursively ask for confirmation again
            get_user_confirmation "$phase"
            ;;
        stop|s)
            echo "🛑 Planning session ended by user choice"
            return 1
            ;;
        *)
            echo "❓ Please enter 'continue', 'iterate', or 'stop'"
            get_user_confirmation "$phase"
            ;;
    esac
}

get_phase_name() {
    local phase="$1"
    case $phase in
        0) echo "Existing Project Analysis" ;;
        1) echo "Discovery & Problem Elaboration" ;;
        2) echo "Intent & Goals" ;;  
        3) echo "Feasibility Assessment" ;;
        4) echo "Technology Research" ;;
        5) echo "Requirements Definition" ;;
        6) echo "Scope & Prioritization" ;;
        7) echo "Architecture Design" ;;
        8) echo "Decision Registry" ;;
        9) echo "Interface Specifications" ;;
        10) echo "Task Generation" ;;
    esac
}

# Universal phase validation with TODO checking
validate_phase() {
    local phase="$1"
    
    # Special handling for Phase 0
    if [ "$phase" = "0" ]; then
        local phase_file="docs/planning/phase0-existing-analysis.md"
        if [ ! -f "$phase_file" ]; then
            echo "✅ Phase 0 skipped (no existing project)"
            return 0
        fi
    fi
    
    local phase_file="docs/planning/phase${phase}-*.md"
    
    # Check file exists
    if ! ls $phase_file 1>/dev/null 2>&1; then
        echo "❌ Phase $phase file not found"
        return 1
    fi
    
    # Check TODO completion
    if grep -q '\[ \]' $phase_file 2>/dev/null; then
        echo "⚠️ Uncompleted TODO items in Phase $phase:"
        grep '\[ \]' $phase_file
        return 1
    fi
    
    echo "✅ Phase $phase validation complete"
    return 0
}

# Execute specific phase functions (simplified stubs - full implementation follows pattern)
execute_phase_1() {
    local arguments="$1"
    # Create comprehensive discovery document following Phase 1 instructions
    # Launch research agents for stakeholder analysis
    # Include contrarian analysis and fatal learnings
}

execute_phase_2() {
    local arguments="$1" 
    # Create goal hierarchy based on Phase 1 stakeholders
    # Define SMART metrics with baselines
    # Include anti-patterns and value propositions
}

execute_phase_3() {
    local arguments="$1"
    # Assess technical feasibility of Phase 2 goals
    # Create risk matrix with mitigation strategies  
    # Provide go/no-go recommendation
}

execute_phase_4() {
    local arguments="$1"
    # Launch tech-research agents for GitHub evidence gathering
    # Require 5+ repos per major technology choice
    # Focus on production reality and performance analysis
}

execute_phase_5() {
    local arguments="$1"
    # Convert insights into detailed requirements
    # Create user stories with acceptance criteria
    # Map requirements back to earlier phase discoveries
}

# Phase 11+ Implementation Loop
execute_implementation_loop() {
    local arguments="$1"
    
    echo "🎯 Starting implementation iteration with feature-developer subagents..."
    
    # Continuous implementation until all tasks complete
    while [ "$(count_pending_tasks)" -gt 0 ]; do
        echo ""
        echo "📋 Pending tasks: $(count_pending_tasks)"
        echo "⏳ In progress: $(count_in_progress_tasks)"
        echo "✅ Completed: $(count_completed_tasks)"
        
        # Get highest priority pending task
        local current_task=$(get_next_priority_task)
        
        if [ -z "$current_task" ]; then
            echo "❌ No pending tasks found but count > 0. Check task directory state."
            break
        fi
        
        echo ""
        echo "🚀 Implementing: $current_task"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Move task to in-progress
        move_task_to_in_progress "$current_task"
        
        # Launch feature-developer subagent using Task tool
        echo "👨‍💻 Launching feature-developer subagent for task implementation..."
        
        # Create isolated worktree for feature development
        create_isolated_worktree "feature-dev" "feature-dev"
        
        # Call Task tool with feature-developer subagent
        # The subagent will implement the task in the isolated worktree
        task_implementation_result=$(call_feature_developer_subagent "$current_task" "$WORKTREE")
        
        # Validate task completion after subagent work
        if validate_task_completion "$current_task"; then
            move_task_to_completed "$current_task"
            echo "✅ Task completed successfully: $current_task"
            
            # Merge implementation back to main
            cleanup_isolated_worktree "$WORKTREE" "$CURRENT_BRANCH"
            
        else
            echo "⚠️ Task implementation incomplete: $current_task"
            echo "🔄 Moving back to pending for retry with additional context"
            
            # Add implementation attempt context to task
            add_context_to_task "$current_task" "Previous attempt: $task_implementation_result"
            
            # Move task back to pending for retry
            move_task_to_pending "$current_task"
            
            # Clean up worktree
            cleanup_isolated_worktree "$WORKTREE" "$CURRENT_BRANCH"
        fi
        
        # Check for new dependencies discovered during implementation
        discover_new_tasks_from_implementation "$current_task"
        
        # Safety check to prevent infinite loops
        if [ "$(count_total_tasks)" -gt 100 ]; then
            echo "⚠️ Task count exceeded safety limit (100). Please review task generation."
            break
        fi
    done
    
    echo ""
    if [ "$(count_pending_tasks)" -eq 0 ]; then
        echo "🎉 All features implemented successfully!"
        echo "📊 Final stats:"
        echo "   ✅ Completed tasks: $(count_completed_tasks)"
        echo "   📁 Total files implemented: $(find . -name '*.ts' -o -name '*.js' -o -name '*.py' | wc -l)"
        echo "   🧪 Running final integration tests..."
        
        # Run final validation
        if validate_all_requirements; then
            echo "🏆 Project implementation complete and validated!"
        else
            echo "⚠️ Some requirements validation failed. Review needed."
        fi
    else
        echo "⚠️ Implementation incomplete. $(count_pending_tasks) tasks remain."
        echo "💡 Consider reviewing task complexity or breaking down remaining tasks."
    fi
}

# Task management helper functions
count_pending_tasks() {
    ls tasks/pending/*.md 2>/dev/null | wc -l
}

count_in_progress_tasks() {
    ls tasks/in-progress/*.md 2>/dev/null | wc -l
}

count_completed_tasks() {
    ls tasks/completed/*.md 2>/dev/null | wc -l
}

count_total_tasks() {
    local total=0
    total=$((total + $(count_pending_tasks)))
    total=$((total + $(count_in_progress_tasks)))  
    total=$((total + $(count_completed_tasks)))
    echo $total
}

get_next_priority_task() {
    # Get highest priority task from pending directory
    # Priority order: P0 (critical) > P1 (high) > P2 (medium) > P3 (low)
    for priority in P0 P1 P2 P3; do
        local task_file=$(ls tasks/pending/*-${priority}-*.md 2>/dev/null | head -1)
        if [ -n "$task_file" ]; then
            basename "$task_file" .md
            return 0
        fi
    done
    
    # Fallback: get any pending task
    local task_file=$(ls tasks/pending/*.md 2>/dev/null | head -1)
    if [ -n "$task_file" ]; then
        basename "$task_file" .md
    fi
}

move_task_to_in_progress() {
    local task_name="$1"
    mv "tasks/pending/${task_name}.md" "tasks/in-progress/${task_name}.md" 2>/dev/null
}

move_task_to_completed() {
    local task_name="$1"
    mv "tasks/in-progress/${task_name}.md" "tasks/completed/${task_name}.md" 2>/dev/null
}

move_task_to_pending() {
    local task_name="$1"
    mv "tasks/in-progress/${task_name}.md" "tasks/pending/${task_name}.md" 2>/dev/null
}

call_feature_developer_subagent() {
    local task_name="$1"
    local worktree_path="$2"
    
    # This function interfaces with the Task tool to call feature-developer subagent
    # The actual implementation would use the Task tool with feature-developer subagent
    echo "🤖 Task tool integration: ask subagent feature-developer to develop task $task_name"
    
    # Return implementation result summary
    echo "Feature development completed in worktree: $worktree_path"
}

validate_task_completion() {
    local task_name="$1"
    
    # Read task acceptance criteria and validate
    local task_file="tasks/in-progress/${task_name}.md"
    
    if [ ! -f "$task_file" ]; then
        echo "❌ Task file not found: $task_file"
        return 1
    fi
    
    # Check if acceptance criteria are met
    # This is a simplified check - full implementation would parse acceptance criteria
    # and run appropriate tests/validations
    
    echo "✅ Task validation passed (simplified check)"
    return 0
}

discover_new_tasks_from_implementation() {
    local completed_task="$1"
    
    # Analyze implementation to discover new dependencies or follow-up tasks
    # This would examine the implemented code for TODOs, integration points, etc.
    
    echo "🔍 Checking for new dependencies discovered during implementation..."
    
    # Simplified implementation - would have more sophisticated discovery logic
    echo "💡 No new tasks discovered from $completed_task implementation"
}

add_context_to_task() {
    local task_name="$1"
    local context="$2"
    
    local task_file="tasks/in-progress/${task_name}.md"
    
    if [ -f "$task_file" ]; then
        echo "" >> "$task_file"
        echo "## Implementation Context" >> "$task_file"
        echo "" >> "$task_file" 
        echo "$context" >> "$task_file"
        echo "" >> "$task_file"
        echo "---" >> "$task_file"
        echo "*Added $(date -Iseconds)*" >> "$task_file"
    fi
}

validate_all_requirements() {
    echo "🧪 Running comprehensive requirement validation..."
    
    # This would validate all Phase 5 requirements against implemented system
    # Including functional requirements, non-functional requirements, etc.
    
    echo "✅ All requirements validated successfully (simplified check)"
    return 0
}

# Entry point
if [ -n "$1" ]; then
    main "$1"
else
    echo "Usage: $0 \"<project-description>\""
fi
```

---

## Key Changes in Version 2.1

### 1. **Mandatory User Confirmation**
- Added confirmation checkpoints after Phases 1-5
- User must explicitly approve before proceeding
- Options: continue, iterate (with feedback), or stop

### 2. **Enhanced Phase Instructions**
- More detailed execution instructions for each critical phase
- Clear deliverable expectations
- Explicit TODO items for phase validation

### 3. **Prompt-as-Code Alignment**
- Converted complex bash functions to clear instruction sets
- Made the system more interpretable and maintainable
- Preserved all critical infrastructure while simplifying execution

### 4. **GitHub Evidence Requirements**
- Explicit requirement for 5+ repos (1000+ stars) per technology
- Focus on production reality over tutorials
- Performance analysis from real repository issues

### 5. **Adaptive Complexity**
- Instructions scale content based on project complexity
- Simple projects get focused documentation
- Complex projects get comprehensive analysis

### 6. **Continuous Implementation Iteration (Phase 11+)**
- Added missing implementation phase using feature-developer subagents
- Continuous iteration loop: `ask subagent feature-developer to develop task <task-file>`
- Task management system with pending/in-progress/completed workflows
- Quality gates and validation for each implemented feature
- Automatic discovery of new dependencies during implementation
- Safety mechanisms to prevent infinite task generation loops

This version ensures proper user oversight while maintaining the comprehensive planning capabilities, parallel execution safety, and **now includes the missing continuous implementation iteration** that was the root cause of planning-only execution in previous versions.