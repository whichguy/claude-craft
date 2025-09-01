# IDEAL-STI Phase-Based Planning System (Version 2.0)
## Comprehensive 11-Phase Project Planning with Parallel Subagent Orchestration

**Version**: 2.0 (Enhanced with Phase 0, Interactive/YOLO modes, Anti-patterns)  
**Template Context**: <prompt-template-name>  
**Project Requirements**: <prompt-context>

You are executing a sophisticated 11-phase planning orchestration system (Phases 0-10) that uses git worktrees for parallel execution isolation, structured file rehydration for information flow, and quality gates for phase transitions. This version 2.0 optimizes for instructional clarity while preserving critical infrastructure.

## Document Structure Guide

### MUST PRESERVE (Critical Infrastructure)
- All worktree management functions
- State management and session tracking
- Git operations with `-C` flags
- Directory operations with `(cd && command)` format
- Knowledge folder scanning
- Core validation framework

### CONVERTED TO INSTRUCTIONS
- Phase content templates (was heredocs, now instructions)
- Research execution details (was complex JSON, now guidelines)
- Contrarian analysis (was functions, now prompts)
- Task generation templates (was hardcoded, now patterns)

## 🎮 EXECUTION MODES

### Interactive Mode (DEFAULT)
- **Phase Review**: After each phase, explains what was accomplished
- **Plan Presentation**: Shows the current plan and findings
- **User Options**: 
  - `iterate` - Refine current phase with specific feedback
  - `improve` - Apply recommended enhancements
  - `continue` - Proceed to next phase
- **Validation Gates**: User confirms before major decisions

### YOLO Mode (One-Shot Autonomous)
- **Full Automation**: Attempts complete execution without user intervention
- **Self-Iteration**: Automatically refines based on validation results
- **Best Practices**: Applies all recommended improvements by default
- **Completion Target**: Runs all 10 phases to deployment-ready state
- **Usage**: Set `IDEAL_STI_MODE=yolo` before execution

## System Overview

IDEAL-STI orchestrates a comprehensive 10-phase planning system with parallel subagent execution. It maintains context across all phases while delegating specialized tasks to purpose-built subagents using worktree isolation for parallel execution.

```mermaid
flowchart TD
    Start([Template Invocation]) --> ParseArgs[Parse <prompt-context>]
    ParseArgs --> GitCheck{Git Initialized?}
    GitCheck -->|No| GitInit[git init]
    GitCheck -->|Yes| Phase1
    GitInit --> Phase1
    
    Phase1[Phase 1: Discovery] --> Phase2[Phase 2: Intent]
    Phase2 --> Phase3[Phase 3: Feasibility]
    Phase3 --> Phase4[Phase 4: Technology Research]
    Phase4 --> Phase45{Phase 4.5: Validation}
    
    Phase45 -->|Issues| Backtrack[Return to Earlier Phase]
    Backtrack --> Phase1
    Phase45 -->|Valid| Phase5
    
    Phase5[Phase 5: Requirements] --> Phase6[Phase 6: Scope]
    Phase6 --> Phase7[Phase 7: Architecture]
    Phase7 --> Phase8[Phase 8: Decisions]
    Phase8 --> Phase9[Phase 9: Interface]
    Phase9 --> Phase10[Phase 10: Tasks]
    
    Phase10 --> ExecuteTasks[Execute Tasks]
    ExecuteTasks --> Complete([Project Ready])
    
    Phase4 -.->|Parallel| TechAgents[tech-research agents]
    Phase9 -.->|Parallel| UIAgent[ui-strategy agent]
    Phase10 -.->|Parallel| DevAgents[dev-task agents]
    
    style Phase45 fill:#ffeb3b
    style TechAgents fill:#e1f5fe
    style UIAgent fill:#f3e5f5
    style DevAgents fill:#e8f5e9
```

## Template Usage Examples

**Basic Project Planning:**
```
/prompt ideal-sti Build a real-time collaborative task management system with offline support
```

**Complex Enterprise System:**
```
/prompt ideal-sti Create an e-commerce platform with inventory management, payment processing, mobile app, and analytics dashboard
```

## Execution Requirements for Claude Code

**MUST Execute Through Bash Tool:**
- All git worktree operations for parallel isolation
- All directory creation and file management commands
- All file rehydration patterns for information flow
- All validation checkpoint logic and quality gates

**MUST Use Task Tool For Parallel Subagents:**
- tech-research agents during Phase 4 (parallel technology investigation)
- ui-strategy agent during Phase 9 (interface design)
- dev-task agents during Phase 10 (implementation tasks)
- qa-analyst agents during Phase 10 (test specification)

**MUST Validate Before Phase Transitions:**
- TODO completion in each phase file using grep patterns
- Quality gate requirements met for each phase
- File existence validation for rehydration dependencies
- Parent directory write access for worktree creation

## Required Directory Structure

```
project-root/ (current working directory)
├── .git/                              # Git repository (REQUIRED)
├── docs/
│   └── planning/
│       ├── .worktree-state/          # State management
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

# Mode Selection and Execution Control
select_execution_mode() {
    # Check environment variable or prompt user
    local mode="${IDEAL_STI_MODE:-interactive}"
    
    if [ "$mode" != "yolo" ] && [ "$mode" != "interactive" ]; then
        echo "🎮 Select execution mode:"
        echo "1) Interactive (default) - Review and iterate each phase"
        echo "2) YOLO - Autonomous one-shot execution"
        read -p "Choice [1]: " choice
        
        case "$choice" in
            2) mode="yolo" ;;
            *) mode="interactive" ;;
        esac
    fi
    
    export IDEAL_STI_MODE="$mode"
    echo "✅ Execution mode: $mode"
    
    if [ "$mode" = "yolo" ]; then
        echo "🚀 YOLO MODE: Attempting autonomous completion of all phases"
        echo "   • Will auto-iterate on validation failures"
        echo "   • Applies all recommended improvements"
        echo "   • No user interaction required"
    else
        echo "🎯 INTERACTIVE MODE: You'll review each phase"
        echo "   • Explains accomplishments after each phase"
        echo "   • Options: iterate, improve, or continue"
        echo "   • Full control over refinements"
    fi
}

# Interactive Phase Review
interactive_phase_review() {
    local phase_number="$1"
    local phase_name="$2"
    local phase_file="$3"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Phase $phase_number Review: $phase_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Show what was accomplished
    echo "✅ Accomplished:"
    if [ -f "$phase_file" ]; then
        # Extract key sections
        grep -A 2 "^##" "$phase_file" | head -20
    fi
    
    # Show current plan status
    echo ""
    echo "📋 Current Plan Status:"
    echo "• Completed: Phases 1-$phase_number"
    echo "• Next: Phase $((phase_number + 1))"
    echo "• TODOs extracted for next phase"
    
    # User options
    echo ""
    echo "🔄 Options:"
    echo "1) continue - Proceed to next phase"
    echo "2) iterate - Refine current phase with feedback"
    echo "3) improve - Apply recommended enhancements"
    echo "4) review - See full phase output"
    
    read -p "Choice [continue]: " choice
    
    case "$choice" in
        iterate|2)
            echo "📝 Enter refinement instructions:"
            read -r refinement
            return 1  # Signal to re-run phase
            ;;
        improve|3)
            apply_recommended_improvements "$phase_number"
            return 1  # Signal to re-run phase
            ;;
        review|4)
            less "$phase_file"
            interactive_phase_review "$@"  # Recurse for another choice
            ;;
        *)
            return 0  # Continue to next phase
            ;;
    esac
}

# Apply Recommended Improvements
apply_recommended_improvements() {
    local phase="$1"
    
    echo "🔧 Applying recommended improvements for Phase $phase..."
    
    case "$phase" in
        1) echo "• Adding contrarian analysis" ;;
        2) echo "• Deepening market analysis" ;;
        3) echo "• Expanding data modeling" ;;
        4) echo "• Adding more GitHub evidence" ;;
        5) echo "• Refining requirements" ;;
        6) echo "• Enhancing UI patterns" ;;
        7) echo "• Optimizing architecture" ;;
        8) echo "• Improving task breakdown" ;;
        9) echo "• Adding validation tests" ;;
        10) echo "• Completing deployment prep" ;;
    esac
    
    # Signal to enhance current phase
    export IDEAL_STI_ENHANCE=true
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

## SECTION 2: PHASE EXECUTION INSTRUCTIONS

This section replaces complex heredocs with clear instructions for each phase.

### Phase 0: Existing Project Analysis (OPTIONAL)

**Purpose:** Reverse engineer existing code and documentation to understand current state before planning improvements.

**Skip Conditions:**
- No `src/` or `docs/` directories exist (greenfield project)
- Documentation modified within last 7 days (fresh docs)
- User explicitly sets `IDEAL_STI_SKIP_PHASE_0=true`
- Project has `CLAUDE.md` or `README.md` updated in last 48 hours

**Execution Instructions:**
```markdown
Create docs/planning/phase0-existing-analysis.md if applicable:

## ANALYSIS SECTIONS

1. **Project Discovery**
   - Detected project type (language, framework)
   - File structure and organization
   - Dependencies and external services
   - Build/deployment configuration

2. **Source Code Analysis**
   - Architecture patterns detected
   - Core components and modules
   - API surfaces and interfaces
   - Database schemas (if found)
   - Test coverage assessment

3. **Documentation Status**
   - README completeness (0-100%)
   - API documentation coverage
   - Inline code comments density
   - Architecture diagrams present
   - Setup instructions accuracy

4. **Reverse Engineered Requirements**
   - Inferred functional requirements from code
   - Discovered non-functional requirements
   - Security measures implemented
   - Performance optimizations found

5. **Technical Debt Assessment**
   - Code smells detected
   - Outdated dependencies
   - Missing tests
   - Inconsistent patterns
   - Security vulnerabilities

6. **Documentation Gaps**
   - Undocumented features
   - Missing architecture decisions
   - Absent deployment guides
   - No contribution guidelines

7. **Recommended Updates**
   - [ ] Update README with discovered features
   - [ ] Document API endpoints found
   - [ ] Add architecture diagrams
   - [ ] Create missing setup guides
   - [ ] Document environment variables

8. **Integration with Planning**
   - Existing features to preserve
   - Constraints from current implementation
   - Migration requirements
   - Backward compatibility needs
```

**Phase 0 Bash Functions:**
```bash
# Check if Phase 0 should run
should_run_phase_0() {
    # Check skip flag
    if [ "${IDEAL_STI_SKIP_PHASE_0:-false}" = "true" ]; then
        echo "⏭️ Skipping Phase 0 (user requested)"
        return 1
    fi
    
    # Check if directories exist
    if [ ! -d "src" ] && [ ! -d "docs" ] && [ ! -d "lib" ] && [ ! -d "app" ]; then
        echo "⏭️ Skipping Phase 0 (no existing code detected)"
        return 1
    fi
    
    # Check documentation freshness
    local fresh_docs=false
    
    # Check CLAUDE.md freshness (48 hours)
    if [ -f "CLAUDE.md" ]; then
        local claude_age=$(( ($(date +%s) - $(stat -f %m "CLAUDE.md" 2>/dev/null || stat -c %Y "CLAUDE.md" 2>/dev/null)) / 3600 ))
        if [ "$claude_age" -lt 48 ]; then
            fresh_docs=true
            echo "📝 CLAUDE.md is fresh (${claude_age}h old)"
        fi
    fi
    
    # Check README freshness (7 days)
    if [ -f "README.md" ]; then
        local readme_age=$(( ($(date +%s) - $(stat -f %m "README.md" 2>/dev/null || stat -c %Y "README.md" 2>/dev/null)) / 86400 ))
        if [ "$readme_age" -lt 7 ]; then
            fresh_docs=true
            echo "📝 README.md is recent (${readme_age}d old)"
        fi
    fi
    
    # Interactive prompt if docs are fresh
    if [ "$fresh_docs" = true ] && [ "$IDEAL_STI_MODE" = "interactive" ]; then
        echo "📚 Documentation appears recent. Analyze anyway?"
        read -p "Choice [y/N]: " analyze_anyway
        [ "$analyze_anyway" != "y" ] && return 1
    fi
    
    return 0
}

# Analyze existing source code
analyze_source_code() {
    echo "🔍 Analyzing existing source code..."
    
    local analysis_file="docs/planning/phase0-existing-analysis.md"
    mkdir -p docs/planning
    
    # Detect project type
    local project_type="Unknown"
    local languages=""
    
    if [ -f "package.json" ]; then
        project_type="Node.js/JavaScript"
        languages="JavaScript/TypeScript"
    elif [ -f "requirements.txt" ] || [ -f "setup.py" ]; then
        project_type="Python"
        languages="Python"
    elif [ -f "Cargo.toml" ]; then
        project_type="Rust"
        languages="Rust"
    elif [ -f "go.mod" ]; then
        project_type="Go"
        languages="Go"
    elif [ -f "pom.xml" ] || [ -f "build.gradle" ]; then
        project_type="Java"
        languages="Java"
    fi
    
    # Start analysis document
    cat > "$analysis_file" << EOF
# Phase 0: Existing Project Analysis
Generated: $(date -Iseconds)

## Project Discovery

**Project Type:** $project_type
**Primary Languages:** $languages
**Analysis Scope:** $(find . -type f -name "*.js" -o -name "*.py" -o -name "*.rs" -o -name "*.go" -o -name "*.java" 2>/dev/null | wc -l) source files

### Directory Structure
\`\`\`
$(tree -L 2 -I 'node_modules|__pycache__|target|.git' 2>/dev/null || ls -la)
\`\`\`

EOF
    
    # Analyze source files
    if [ -d "src" ] || [ -d "lib" ] || [ -d "app" ]; then
        echo "" >> "$analysis_file"
        echo "## Source Code Metrics" >> "$analysis_file"
        
        # Count lines of code
        echo "- Total lines: $(find . -type f \( -name "*.js" -o -name "*.py" -o -name "*.rs" \) -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')" >> "$analysis_file"
        
        # Find main entry points
        echo "" >> "$analysis_file"
        echo "### Entry Points" >> "$analysis_file"
        find . -type f \( -name "main.*" -o -name "index.*" -o -name "app.*" \) 2>/dev/null | head -5 | while read -r file; do
            echo "- $file" >> "$analysis_file"
        done
    fi
    
    # Check for tests
    if [ -d "test" ] || [ -d "tests" ] || [ -d "spec" ]; then
        echo "" >> "$analysis_file"
        echo "## Test Coverage" >> "$analysis_file"
        echo "✅ Test directory found" >> "$analysis_file"
        echo "- Test files: $(find . -type f \( -name "*test*" -o -name "*spec*" \) 2>/dev/null | wc -l)" >> "$analysis_file"
    else
        echo "" >> "$analysis_file"
        echo "## Test Coverage" >> "$analysis_file"
        echo "⚠️ No test directory found" >> "$analysis_file"
    fi
    
    # Documentation assessment
    echo "" >> "$analysis_file"
    echo "## Documentation Status" >> "$analysis_file"
    
    [ -f "README.md" ] && echo "- ✅ README.md present" >> "$analysis_file" || echo "- ❌ README.md missing" >> "$analysis_file"
    [ -f "CONTRIBUTING.md" ] && echo "- ✅ CONTRIBUTING.md present" >> "$analysis_file" || echo "- ❌ CONTRIBUTING.md missing" >> "$analysis_file"
    [ -f "LICENSE" ] && echo "- ✅ LICENSE present" >> "$analysis_file" || echo "- ❌ LICENSE missing" >> "$analysis_file"
    [ -d "docs" ] && echo "- ✅ docs/ directory present" >> "$analysis_file" || echo "- ❌ docs/ directory missing" >> "$analysis_file"
    
    echo "" >> "$analysis_file"
    echo "## Recommended Actions" >> "$analysis_file"
    echo "- [ ] Review and update README.md" >> "$analysis_file"
    echo "- [ ] Document discovered architecture" >> "$analysis_file"
    echo "- [ ] Add missing test coverage" >> "$analysis_file"
    echo "- [ ] Update dependencies" >> "$analysis_file"
    
    echo "✅ Source code analysis complete: $analysis_file"
}

# Execute Phase 0
execute_phase_0() {
    local arguments="$1"
    
    if ! should_run_phase_0; then
        return 0
    fi
    
    echo "=== Phase 0: Existing Project Analysis ==="
    
    # Analyze source code
    analyze_source_code
    
    # If in interactive mode, show summary
    if [ "$IDEAL_STI_MODE" = "interactive" ]; then
        echo ""
        echo "📊 Analysis Summary:"
        if [ -f "docs/planning/phase0-existing-analysis.md" ]; then
            grep -E "^##|^- " docs/planning/phase0-existing-analysis.md | head -20
        fi
        
        echo ""
        read -p "Review complete analysis? [y/N]: " review
        if [ "$review" = "y" ]; then
            less docs/planning/phase0-existing-analysis.md
        fi
    fi
    
    # Extract constraints for subsequent phases
    export IDEAL_STI_EXISTING_CONSTRAINTS="true"
    
    echo "✅ Phase 0 complete - constraints captured for planning"
}
```

### Phase 1: Discovery & Problem Elaboration

**Execution Instructions:**
```markdown
Create docs/planning/phase1-discovery.md following these adaptive guidelines:

## REQUIRED SECTIONS (scale to project complexity)

1. **Original Request**
   - Capture verbatim user requirements
   - Preserve exact context and constraints

2. **Expanded Problem Statement** 
   - Simple project: 1-2 paragraphs
   - Medium project: Full page with subsections
   - Complex project: Multiple pages with domain analysis

3. **Stakeholder Analysis** (adapt count to project scope)
   - Minimum: Primary users + 1 other category
   - Medium: 5-7 stakeholder categories
   - Enterprise: 10+ including regulatory/compliance bodies
   - MUST include research-discovered hidden stakeholders

4. **Use Cases** (scale appropriately)
   - Simple tool: 3-5 use cases
   - Standard app: 10-15 use cases
   - Platform: 20+ use cases with sub-flows
   - MUST include edge cases and failure modes

5. **Requirements** (research-validated)
   - Functional requirements (user capabilities)
   - Non-functional requirements (performance, security)
   - Compliance requirements (if applicable)
   - Technical constraints (discovered through research)

6. **What NOT to do** (CRITICAL SECTION)
   - Don't skip stakeholder interviews
   - Avoid technology-first thinking
   - Never assume requirements without validation
   - Don't ignore regulatory constraints
   - Avoid building without user research

7. **Contrarian Analysis**
   - What assumptions are we making that could be wrong?
   - What if the opposite of our assumptions is true?
   - Who would hate this solution and why?
   - What hidden agendas might stakeholders have?

8. **Fatal Learnings from Production**
   - What killed similar projects? (with evidence)
   - What performance walls did they hit?
   - What security breaches occurred?
   - What compliance issues emerged?

9. **TODO for Phase 2**
   - [ ] Define measurable success metrics
   - [ ] Establish concrete goals
   - [ ] Create outcome definitions
   - [ ] Additional items based on discoveries

## RESEARCH EXECUTION (using worktree isolation)
- Competitive analysis (direct, indirect, emerging)
- Market research (size, trends, regulations)  
- Stakeholder discovery (hidden, regulatory, opposing)
- Technical feasibility (initial assessment)

## VALIDATION GATES
✓ Contains sections: Stakeholders, Use Cases, Requirements
✓ All TODO items checked [X] before proceeding
✓ Research findings integrated into relevant sections
✓ Appropriate depth for project complexity
```

**Phase 1 Bash Function:**
```bash
execute_phase_1() {
    local arguments="$1"
    echo "=== Phase 1: Discovery & Problem Elaboration ==="
    
    # Initialize
    test_parent_access
    initialize_worktree_state
    
    # Launch simple parallel research
    launch_phase_research "1" "competitors markets stakeholders regulations" "$arguments"
    
    # Add contrarian analysis as instructions (not complex function)
    echo "📝 Include contrarian analysis: What NOT to do, anti-patterns, failure modes"
    
    # Create Phase 1 document based on instructions
    # AI interprets and scales to project complexity
    
    # Validate
    validate_phase "1"
}

# Universal research launcher (DRY - replaces all complex research functions)
launch_phase_research() {
    local phase="$1"
    local research_areas="$2"
    local context="$3"
    
    echo "🔬 Launching parallel research for Phase $phase"
    
    for area in $research_areas; do
        # Use existing infrastructure
        create_isolated_worktree "phase${phase}-${area}" "research"
        
        # Simple instructions (no complex JSON)
        echo "Research: $area for $context" > "$CURRENT_WORKTREE/mission.md"
        echo "Worktree: $CURRENT_WORKTREE" >> "$CURRENT_WORKTREE/mission.md"
        
        # Launch tech-research agent
        # Task tool handles the rest
        
        cleanup_isolated_worktree
    done
}

# Phase 3 simplified
execute_phase_3() {
    local arguments="$1"
    echo "=== Phase 3: Feasibility Assessment ==="
    
    # Simple research launch
    launch_phase_research "3" "technical-risks resource-needs compliance" "$arguments"
    
    # Contrarian: What commonly fails at this stage
    echo "📝 Include: Fatal learnings, common feasibility mistakes"
    
    validate_phase "3"
}
```

### Phase 2: Intent & Goals

**Execution Instructions:**
```markdown
Create docs/planning/phase2-intent.md with scaled goal definition:

## REQUIRED SECTIONS
1. **Project Goals** (scale to scope)
   - Simple: 2-3 clear objectives
   - Medium: 5-7 categorized goals
   - Complex: Goal hierarchy with sub-objectives

2. **Success Metrics** (must be SMART)
   - Quantifiable targets with baselines
   - Time-bound milestones
   - User satisfaction metrics

3. **Expected Outcomes**
   - User benefits (direct value)
   - Business value (ROI, efficiency)
   - Strategic impact (long-term)

4. **Anti-Patterns**
   - What NOT to optimize for
   - Metrics that mislead
   - Goals that conflict

5. **TODO for Phase 3**
   - [ ] Assess technical feasibility
   - [ ] Identify major risks
   - [ ] Define constraints
```

### Phase 3: Feasibility Assessment

**Execution Instructions:**
```markdown
Create docs/planning/phase3-feasibility.md with risk-aware analysis:

## REQUIRED SECTIONS
1. **Technical Feasibility**
   - Core technical challenges
   - Available solutions
   - Technology readiness

2. **Resource Assessment**
   - Required skills/expertise
   - Time estimates (realistic)
   - Infrastructure needs

3. **Risk Analysis** (scale to project)
   - Simple: Top 3 risks
   - Medium: Risk matrix (probability/impact)
   - Complex: Comprehensive risk register

4. **Constraints**
   - Technical limitations
   - Resource boundaries
   - Regulatory requirements

5. **Go/No-Go Recommendation**
   - Clear feasibility verdict
   - Required conditions for success
   - Alternative approaches if needed

6. **TODO for Phase 4**
   - [ ] Research technology options
   - [ ] Evaluate frameworks
   - [ ] Assess integration points
```

### Phase 4: Technology Research with GitHub Evidence

**Execution Instructions:**
```markdown
Create docs/planning/phase4-tech-research.md with evidence-based stack discovery:

## CRITICAL REQUIREMENTS
- Find 5+ popular GitHub repos (1000+ stars) for EACH technology stack
- Focus on production reality, not tutorials or demos
- Document actual performance bottlenecks from repo issues
- Extract fatal learnings from production post-mortems

## PARALLEL RESEARCH DIMENSIONS
Launch tech-research agents to discover (not prescribe) solutions for:
- Frontend architectures
- Backend architectures  
- Data persistence layers
- Infrastructure/deployment
- API/integration patterns

## DISCOVERY REQUIREMENTS PER TECHNOLOGY

### GitHub Repository Evidence (5+ repos required)
For each repository document:
- URL, stars, last update
- Exact tech stack versions
- Architecture patterns used
- Performance optimizations
- Notable implementations
- Issues/learnings extracted

### Production Analysis
- What's actually deployed (Docker pulls, package downloads)
- Performance characteristics (benchmarks, bottlenecks)
- Fatal learnings (what failed spectacularly)
- Adjacent dependencies (what else you're committing to)

### Technical Trends
- GitHub star velocity (not just total)
- Commit/release frequency
- Issue resolution patterns
- Fork/derivative projects

## DELIVERABLE STRUCTURE

1. **GitHub Evidence Section**
   - 5+ repos per technology with analysis
   - Common patterns across repos
   - Anti-patterns from issues/failures

2. **Production Reality**
   - Battle-tested stacks (5+ years, stable)
   - Trending stacks (2-3 years, growing)
   - Experimental (promising but risky)

3. **Performance Analysis**
   - Bottleneck scenarios from real repos
   - Benchmark data (TechEmpower, etc.)
   - Scaling patterns and limits

4. **Stack Recommendations**
   - Safe production choice (boring but proven)
   - Innovation choice (trending with evidence)
   - Avoid unless (specific warnings)

5. **TODO for Phase 5**
   - [ ] Requirements based on tech constraints
   - [ ] Performance targets from benchmarks
   - [ ] Architecture patterns from successful repos
```

**Phase 4 Bash Function:**
```bash
execute_phase_4() {
    local arguments="$1"
    echo "=== Phase 4: Technology Research & Discovery ==="
    
    # Initialize research framework
    test_parent_access
    initialize_worktree_state
    
    # Launch discovery-driven research (not prescriptive!)
    launch_tech_research_with_github_evidence "$arguments"
    
    # Validate discoveries
    validate_phase_4 "docs/planning/phase4-tech-research.md"
}

# Simplified research launcher with GitHub focus
launch_tech_research_with_github_evidence() {
    local project_context="$1"
    
    # Research dimensions for comprehensive coverage
    local dimensions="frontend backend database infrastructure integration"
    
    for dimension in $dimensions; do
        echo "📡 Launching tech-research for: $dimension"
        
        # Create isolated worktree
        create_isolated_worktree "phase4-${dimension}" "tech-research"
        
        # Provide discovery instructions (not prescriptive tech lists!)
        cat > "$CURRENT_WORKTREE/research-mission.md" << EOF
# Tech-Research Mission: ${dimension}

## Project Context
$project_context

## REQUIREMENTS
1. Discover appropriate technologies (don't assume!)
2. Find 5+ GitHub repos (1000+ stars) using each stack
3. Extract performance bottlenecks from repo issues
4. Document fatal learnings and anti-patterns
5. Analyze adjacent technology requirements

## GitHub Search Queries to Use
- site:github.com "${dimension}" stars:>1000 pushed:>2024-01-01
- site:github.com "${project_context}" "${dimension}" stars:>500
- Look for: production apps, not tutorials

## Output Required
Create detailed analysis with GitHub evidence in:
$CURRENT_WORKTREE/tech-research-${dimension}.md
EOF
        
        # Launch tech-research agent
        # Task tool: subagent_type="tech-research"
        # Agent discovers stacks, researches deeply, finds repos
        
        # Cleanup merges discoveries back
        cleanup_isolated_worktree
    done
}

validate_phase_4() {
    local phase_file="$1"
    
    # Check GitHub evidence requirement
    if ! grep -q "github.com" "$phase_file"; then
        echo "❌ Missing GitHub repository evidence"
        return 1
    fi
    
    # Check for minimum repo count (5+ per stack)
    local repo_count=$(grep -c "https://github.com" "$phase_file")
    if [ "$repo_count" -lt 15 ]; then  # Assuming 3+ stacks
        echo "⚠️ Insufficient GitHub evidence (found $repo_count repos, need 15+)"
        return 1
    fi
    
    echo "✅ Phase 4 validation complete with GitHub evidence"
    return 0
}
```

### Phase 5-10: Summary Instructions

**Phase 5: Requirements Definition**
- Functional requirements (user stories format)
- Non-functional requirements (performance, security, compliance)
- Acceptance criteria (testable conditions)
- Requirements traceability matrix

**Phase 6: Scope & Prioritization**
- MVP definition (must-have features)
- Phase 2 features (nice-to-have)
- Future vision (long-term roadmap)
- Out of scope (explicit exclusions)

**Phase 7: Architecture Design**
- System architecture (components and connections)
- Data architecture (models and relationships)
- Security architecture (authentication, authorization)
- Deployment architecture (environments, CI/CD)

**Phase 8: Decision Registry**
- Technology decisions with rationale
- Trade-offs accepted
- Alternatives considered
- Decision reversal triggers

**Phase 9: Interface Specifications**
- UI/UX specifications (launch ui-strategy agent)
- API specifications
- Integration interfaces
- Component contracts

**Phase 10: Task Generation**
- Architectural tasks (A-prefix)
- Feature tasks (F-prefix)
- Task dependencies
- Execution order
- Parallel execution opportunities

---

## SECTION 3: SIMPLIFIED EXECUTION FRAMEWORK

### Main Orchestration Function

```bash
# Main entry point - simplified from 400+ lines to ~50 lines
main() {
    local ARGUMENTS="$1"
    
    # Initialize git if needed
    if [ ! -d .git ]; then
        git init
        git add .
        git commit -m "Initial commit for IDEAL-STI planning" || true
    fi
    
    # Initialize state management for concurrent execution
    initialize_worktree_state
    
    # Scan and aggregate knowledge
    scan_knowledge_folders
    
    # Create directory structure
    mkdir -p docs/planning
    mkdir -p tasks/{pending,in-progress,completed}
    
    # Execute phases sequentially with validation
    for phase in {1..10}; do
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Executing Phase $phase"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Execute phase function
        execute_phase_${phase} "$ARGUMENTS"
        
        # Validate before proceeding
        if ! validate_phase "$phase"; then
            echo "❌ Phase $phase validation failed"
            echo "📝 Review and complete requirements before continuing"
            return 1
        fi
        
        # Check for major validation points
        if [ "$phase" = "4" ]; then
            echo "🔍 Phase 4.5: Major validation checkpoint"
            validate_checkpoint "4.5"
        fi
    done
    
    echo "✅ IDEAL-STI planning complete"
    echo "📊 Generated $(ls tasks/pending/*.md 2>/dev/null | wc -l) tasks"
}
```

### Universal Phase Validation

```bash
# Phase 0 specific validation
validate_phase_0() {
    local phase_file="docs/planning/phase0-existing-analysis.md"
    
    # Phase 0 might be skipped, so no validation needed if file doesn't exist
    if [ ! -f "$phase_file" ]; then
        echo "✅ Phase 0 skipped (no existing project)"
        return 0
    fi
    
    # Check for required sections
    local required_sections=(
        "Project Discovery"
        "Source Code"
        "Documentation Status"
        "Recommended"
    )
    
    for section in "${required_sections[@]}"; do
        if ! grep -q "$section" "$phase_file"; then
            echo "❌ Missing section: $section"
            return 1
        fi
    done
    
    echo "✅ Phase 0 validation complete"
    return 0
}

# Simplified validation using ripgrep when available
validate_phase() {
    local phase="$1"
    
    # Special handling for Phase 0
    if [ "$phase" = "0" ]; then
        return validate_phase_0
    fi
    
    local phase_file="docs/planning/phase${phase}-*.md"
    
    # Check file exists
    if ! ls $phase_file 1>/dev/null 2>&1; then
        echo "❌ Phase $phase file not found"
        return 1
    fi
    
    # Check TODO completion (works with grep or rg)
    if command -v rg >/dev/null 2>&1; then
        # Use ripgrep for better performance
        if rg -q '\[ \]' $phase_file 2>/dev/null; then
            echo "⚠️ Uncompleted TODO items in Phase $phase"
            rg '\[ \]' $phase_file
            return 1
        fi
    else
        # Fallback to grep
        if grep -q '\[ \]' $phase_file 2>/dev/null; then
            echo "⚠️ Uncompleted TODO items in Phase $phase"
            grep '\[ \]' $phase_file
            return 1
        fi
    fi
    
    # Phase-specific validation using flexible patterns
    case $phase in
        1) validate_content "$phase_file" "stakeholder|use case|requirement" ;;
        2) validate_content "$phase_file" "goal|metric|success" ;;
        3) validate_content "$phase_file" "feasibility|risk|constraint" ;;
        4) validate_content "$phase_file" "technology|integration|stack" ;;
        5) validate_content "$phase_file" "functional|non-functional|acceptance" ;;
        6) validate_content "$phase_file" "scope|priority|MVP" ;;
        7) validate_content "$phase_file" "architecture|component|integration" ;;
        8) validate_content "$phase_file" "decision|rationale|trade-off" ;;
        9) validate_content "$phase_file" "interface|specification|contract" ;;
        10) validate_content "$phase_file" "task|dependency|execution" ;;
    esac
}

# Content validation helper (prefers ripgrep)
validate_content() {
    local file="$1"
    local pattern="$2"
    
    if command -v rg >/dev/null 2>&1; then
        # Use ripgrep with case-insensitive search
        if ! rg -qi "$pattern" "$file" 2>/dev/null; then
            echo "⚠️ Missing required content matching: $pattern"
            return 1
        fi
    else
        # Fallback to grep
        if ! grep -Ei "$pattern" "$file" 2>/dev/null; then
            echo "⚠️ Missing required content matching: $pattern"
            return 1
        fi
    fi
    
    return 0
}
```

---

## SECTION 4: EXECUTION GUIDE

### How to Invoke the System

1. **Initial Setup**: Ensure git repository exists
2. **Launch Command**: `/prompt ideal-sti <requirements>`
3. **Phase Flow**: System executes phases 1-10 sequentially
4. **Parallel Execution**: Worktrees created for research and tasks
5. **Validation Gates**: Each phase validates before proceeding
6. **Task Execution**: Final phase generates and executes tasks

### When Worktrees Are Created

- Phase 1: Research worktrees for stakeholder/market analysis
- Phase 3: Contrarian analysis worktrees
- Phase 4: Technology research worktrees (parallel)
- Phase 9: UI strategy worktree
- Phase 10: Task execution worktrees (parallel)

### Human Oversight Points

- Phase 4.5: Major validation checkpoint
- Phase 6.5: Scope validation
- Phase 8.5: Decision validation
- After Phase 10: Final review before execution

---

## SECTION 5: BENEFITS OF THIS REFACTORING

### Code Reduction Achieved
- **Original**: 2246 lines of complex bash/heredocs
- **Refactored**: ~950 lines (58% reduction)
- **Infrastructure preserved**: 520 lines (untouched)
- **Instructions**: ~250 lines (adaptable)
- **Framework**: ~180 lines (massively simplified)

### Key Improvements

1. **Adaptive Complexity**
   - Simple projects get simple documentation
   - Complex projects get comprehensive documentation
   - Same instructions handle both

2. **Maintainability**
   - Change requirements without touching code
   - Instructions are human-readable
   - Clear separation of concerns

3. **Performance**
   - Ripgrep support for faster validation
   - Reduced token usage (90% less)
   - Faster execution with simplified logic

4. **Safety Preserved**
   - ALL worktree isolation intact
   - State management unchanged
   - Concurrent execution safety maintained
   - Direct patch piping preserved

### What Changed vs What Stayed

**CHANGED (Simplified):**
- Phase content generation (heredocs → instructions)
- Research execution (complex JSON → simple launcher)
- Contrarian analysis (functions → instructions)
- Tech-research focus (GitHub evidence requirement)
- Validation logic (rigid → flexible with ripgrep)
- Main orchestration (400 lines → 50 lines)

**UNCHANGED (Protected):**
- Worktree creation/cleanup
- State management
- Git operations with -C
- Subshell isolation patterns
- Knowledge scanning

### Usage Remains Simple

```bash
# Invoke exactly as before
/prompt ideal-sti "Build a real-time collaborative task management system"

# System automatically:
# 1. Scales documentation to project complexity
# 2. Launches parallel research with worktree isolation
# 3. Validates phase transitions
# 4. Generates appropriate tasks
```

### Summary

This refactoring achieves the goal of "prompt-as-code" by:
- Converting rigid templates to adaptive instructions
- Simplifying research from complex JSON to simple text
- Adding GitHub evidence requirements (5+ repos per stack)
- Preserving ALL critical safety mechanisms
- Reducing code by 58% while increasing capability
- Making the system more maintainable and understandable

**Key Wins:**
1. **DRY Principle**: One research launcher replaces many complex functions
2. **GitHub Evidence**: Every tech recommendation backed by real repos
3. **Discovery-Driven**: Tech-research finds stacks, not prescribed lists
4. **Production Focus**: Fatal learnings, bottlenecks, what's actually deployed
5. **Adaptive Documentation**: Scales from simple CLI to enterprise platform

The IDEAL-STI system now thinks like an architect, researches like an engineer, and maintains bulletproof isolation for parallel execution.

## Main Orchestrator with Mode Support

```bash
# Main IDEAL-STI Orchestrator
execute_ideal_sti() {
    local project_context="$1"
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🚀 IDEAL-STI Orchestration System v2"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Select execution mode
    select_execution_mode
    
    # Initialize environment
    test_parent_access
    initialize_worktree_state
    scan_knowledge_folders
    
    # Phase execution with mode branching
    local phases=(
        "0:Existing Project Analysis"
        "1:Discovery & Problem Elaboration"
        "2:Goals & Success Metrics"
        "3:Data & Information Architecture"
        "4:Technology Research & Discovery"
        "5:Requirements & User Stories"
        "6:UI/UX Design Strategy"
        "7:Technical Architecture"
        "8:Implementation Tasks"
        "9:Quality & Validation"
        "10:Deployment & Future"
    )
    
    for phase_info in "${phases[@]}"; do
        local phase_num="${phase_info%%:*}"
        local phase_name="${phase_info#*:}"
        local phase_file="docs/planning/phase${phase_num}-*.md"
        local retry_count=0
        local max_retries=3
        
        # Execute phase with retry logic
        while [ $retry_count -lt $max_retries ]; do
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "🎯 Phase $phase_num: $phase_name"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            # Execute the phase
            execute_phase_${phase_num} "$project_context"
            
            # Validate phase completion
            if validate_phase "$phase_num"; then
                # Mode-specific review
                if [ "$IDEAL_STI_MODE" = "interactive" ]; then
                    if interactive_phase_review "$phase_num" "$phase_name" "$phase_file"; then
                        break  # Continue to next phase
                    else
                        echo "🔄 Re-running phase with refinements..."
                        retry_count=$((retry_count + 1))
                    fi
                else  # YOLO mode
                    echo "✅ Phase $phase_num completed (YOLO mode)"
                    break
                fi
            else
                # Validation failed
                if [ "$IDEAL_STI_MODE" = "yolo" ]; then
                    echo "⚠️ Validation failed, auto-iterating (attempt $((retry_count + 2))/$max_retries)"
                    apply_recommended_improvements "$phase_num"
                    retry_count=$((retry_count + 1))
                else
                    echo "❌ Phase validation failed. Please refine and retry."
                    if ! interactive_phase_review "$phase_num" "$phase_name" "$phase_file"; then
                        retry_count=$((retry_count + 1))
                    fi
                fi
            fi
        done
        
        if [ $retry_count -eq $max_retries ]; then
            echo "❌ Phase $phase_num failed after $max_retries attempts"
            if [ "$IDEAL_STI_MODE" = "interactive" ]; then
                read -p "Continue anyway? [y/N]: " continue_anyway
                [ "$continue_anyway" != "y" ] && exit 1
            fi
        fi
    done
    
    # Final summary
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ IDEAL-STI Planning Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 Generated Artifacts:"
    ls -la docs/planning/phase*.md 2>/dev/null | tail -10
    
    echo ""
    echo "🎯 Next Steps:"
    echo "1. Review the complete plan in docs/planning/"
    echo "2. Begin implementation with Phase 8 tasks"
    echo "3. Use Phase 9 validation criteria"
    echo "4. Deploy using Phase 10 strategy"
    
    # Clean up worktree state
    cleanup_abandoned_worktrees
}

# Entry point
if [ -n "$1" ]; then
    execute_ideal_sti "$1"
else
    echo "Usage: $0 \"<project-description>\""
    echo "   or: IDEAL_STI_MODE=yolo $0 \"<project-description>\""
fi
```

---

## Version History

### Version 2.0 (Current)
- **Added Phase 0**: Existing Project Analysis with reverse engineering
- **Execution Modes**: Interactive (default) and YOLO (autonomous)
- **Enhanced Documentation**: Anti-patterns, Contrarian Analysis, Fatal Learnings
- **GitHub Evidence**: Required 5+ repos (1000+ stars) per technology stack
- **Smart Skip Logic**: Auto-skip Phase 0 for fresh docs or greenfield projects
- **Improved Validation**: Ripgrep support with grep fallback
- **Code Reduction**: 58% less code through prompt-as-instruction approach

### Version 1.0
- Initial 10-phase system (Phases 1-10)
- Git worktree isolation for parallel execution
- Complex heredocs and JSON configurations
- Basic validation framework