# IDEAL-STI Adaptive Intelligence Planning System (Version 3.0)
## Adaptive Phase Execution with Smart Confirmations

**Version**: 3.0 (Adaptive Phase Architecture with Complexity-Based Execution)  
**Template Context**: <prompt-template-name>  
**Project Requirements**: <prompt-context>

## 📁 PROJECT DIRECTORY STRUCTURE

All analysis and planning documents are organized in `docs/planning/` with logical phase progression:

```
docs/planning/
├── 1-complexity-assessment.md          # Phase 1: Project complexity analysis and mode selection
├── 2-discovery-analysis.md             # Phase 2: Consolidated discovery from all modes (SPEED/STANDARD/DEEP)
├── 3-use-case-analysis.md              # Phase 3: Comprehensive use case discovery (stated + unstated)
├── 4-anti-case-analysis.md             # Phase 4: Anti-case identification (what NOT to build)
├── 5-technology-ecosystem.md           # Phase 5: Complete technology stack analysis
├── 6-requirements-specification.md     # Phase 6: Final refined functional and NFR requirements
├── 7-interface-design.md               # Phase 7: UI/UX and API interface specifications
├── 8-architecture-design.md            # Phase 8: System architecture and technical design
├── 9-task-planning.md                  # Phase 9: Implementation task breakdown with TDD
├── 10-implementation-tasks.md          # Phase 10: Detailed development tasks and assignments
├── 11-deployment-plan.md               # Phase 11: Deployment pipeline and production launch plan
├── 12-project-summary.md               # Phase 12: Final project comprehensive summary
│
├── refinement/                         # Requirements refinement iteration artifacts
│   ├── iteration-1-analysis.md         # First refinement iteration consolidated results
│   ├── iteration-2-analysis.md         # Second refinement iteration (if needed)
│   └── iteration-3-analysis.md         # Third refinement iteration (if needed)
│
└── confirmations/                      # User confirmation and decision artifacts  
    ├── scope-expansion-decision.md     # Scope expansion confirmation results
    ├── conflict-resolution-decision.md # Conflict resolution confirmation results
    └── architecture-approval.md        # Architecture confirmation and approval
```

### 📋 FILE PURPOSE & CONTENT DISTINCTION

**Core Phase Files (1-12)** - Each represents a distinct planning phase:
1. **Complexity Assessment**: Scoring algorithm results, mode selection rationale
2. **Discovery Analysis**: Consolidated stakeholder, technology, architecture findings  
3. **Use Case Analysis**: All identified use cases (stated + discovered) with priorities
4. **Anti-Case Analysis**: Explicit exclusions, scope boundaries, "what not to build"
5. **Technology Ecosystem**: Complete stack (frameworks + libraries + services) with decisions
6. **Requirements Specification**: Final functional and NFR requirements (no duplication)
7. **Interface Design**: UI/UX wireframes, API contracts, system interfaces
8. **Architecture Design**: Technical architecture, data models, security design
9. **Task Planning**: Implementation phases, TDD approach, resource allocation
10. **Implementation Tasks**: Specific development tasks, acceptance criteria
11. **Deployment Plan**: Infrastructure, CI/CD, launch strategy
12. **Project Summary**: Executive summary, decisions, recommendations

**Refinement Files** - Iteration-based analysis (avoid duplication):
- Each iteration creates ONE consolidated analysis file (not separate files per step)
- Content builds on previous iterations, doesn't duplicate

**Confirmation Files** - User decision artifacts:
- Capture user choices and guidance for key decision points
- Reference core phase files, don't duplicate their content

You are executing an adaptive intelligence planning system that automatically adjusts execution complexity based on project scope. Simple projects get fast-track analysis (SPEED mode), medium projects get standard phase flow with smart confirmations (STANDARD mode), and complex projects get comprehensive analysis (DEEP mode).

## Adaptive Execution Modes

**SPEED MODE** (Simple Projects): 
- Fast consolidated discovery (5-8 minutes)
- Smart confirmations only when conflicts detected
- Minimal agent involvement for obvious technology choices

**STANDARD MODE** (Medium Projects):
- Full phase structure with enhanced smart confirmations
- Strategic agent invocation for technology analysis
- Intelligence-driven decision points

**DEEP MODE** (Complex Projects):
- Extended comprehensive analysis
- Full parallel agent ecosystem
- Both smart triggers AND phase boundary confirmations

## Smart Confirmation System

**Intelligence-Driven Triggers** (replace fixed phase confirmations):
1. **Scope Expansion Detected**: When discovered requirements >50% beyond original
2. **Major Assumptions Made**: When significant assumptions need user validation  
3. **Technology Complexity Discovered**: When tech choice creates unexpected requirements
4. **Feasibility Concerns Found**: When major risks or blockers identified

**ARCHITECTURE CONFIRMATION CHECKPOINT** (All Modes):
Critical checkpoint after discovery phases complete:
1. Present comprehensive requirements and technology specification
2. Show confidence levels and risk assessment
3. Request explicit architecture approval
4. Offer options: approve, extend discovery, refine scope, or stop

**Implementation & Deployment**: Phases 8-16 continue with existing TDD task generation and deployment orchestration.

## IDEAL-STI ADAPTIVE WORKFLOW

```mermaid
flowchart TB
    Start([Mixed User Input]) --> P1[Phase 1: Complexity Assessment]
    
    P1 --> ModeDecision{Project Complexity?}
    ModeDecision -->|Simple| SpeedMode[SPEED MODE: Fast Discovery]
    ModeDecision -->|Medium| StandardMode[STANDARD MODE: Phase Flow]
    ModeDecision -->|Complex| DeepMode[DEEP MODE: Comprehensive]
    
    SpeedMode --> SpeedP2[Consolidated Discovery (5-8 min)]
    StandardMode --> StandardP2[Parallel Discovery & Analysis]
    DeepMode --> DeepP2[Extended Discovery & Research]
    
    SpeedP2 --> SmartTrigger1{Smart Confirmations Needed?}
    StandardP2 --> SmartTrigger2{Scope/Assumptions/Tech Issues?}
    DeepP2 --> SmartTrigger3{Comprehensive Analysis Issues?}
    
    SmartTrigger1 -->|No| P2Complete[Phase 2: Discovery Complete]
    SmartTrigger1 -->|Yes| UserConfirm1[User Confirmation]
    SmartTrigger2 -->|No| P2Complete
    SmartTrigger2 -->|Yes| UserConfirm2[User Confirmation]
    SmartTrigger3 -->|No| P2Complete
    SmartTrigger3 -->|Yes| UserConfirm3[User Confirmation]
    
    UserConfirm1 --> P2Complete
    UserConfirm2 --> P2Complete
    UserConfirm3 --> P2Complete
    
    P2Complete --> RefineLoop[Requirements Refinement Loop]
    RefineLoop --> RefineDecision{Requirements Satisfied?}
    RefineDecision -->|No| P3[Phase 3: Use Case Analysis]
    P3 --> P4[Phase 4: Anti-Case Analysis]
    P4 --> P5[Phase 5: Technology Ecosystem]
    P5 --> RefineDecision
    
    RefineDecision -->|Yes| P6[Phase 6: Requirements Specification]
    P6 --> P7[Phase 7: Interface Design]
    P7 --> P8[Phase 8: Architecture Design]
    P8 --> P9[Phase 9: Task Planning]
    P9 --> P10[Phase 10: Implementation Tasks]
    P10 --> P11[Phase 11: Deployment Plan]
    P11 --> P12[Phase 12: Project Summary]
```

## AGENT INTEGRATION REFERENCE

### Agent Roles and Responsibilities Matrix

| **Agent** | **Primary Phase** | **Trigger** | **Purpose** | **Context Provided** | **Expected Output** |
|-----------|------------------|-------------|-------------|---------------------|---------------------|
| **product-strategist** | Phase 2, 3, 6 | Discovery & Requirements | Stakeholder analysis, use case discovery, requirements definition | User input, refinement context | Stakeholder maps, use cases, requirement specifications |
| **tech-research-analyst** | Phase 2, 5 | Discovery & Technology | Technology research, ecosystem analysis, third-party evaluation | User context, discovered requirements | Technology recommendations with rationale |
| **system-architect** | Phase 5, 8 | Technology & Architecture | Technology synthesis, architecture design, decision making | Requirements, technology research | Architecture specifications, technology decisions |
| **ui-designer** | Phase 7 | Interface Design | UI/UX design, API interface specifications | Requirements, architecture context | Interface designs, API contracts, UX specifications |
| **feature-developer** | Phase 9, 10 | Implementation Planning | Task generation, implementation planning with TDD | Architecture, requirements, interfaces | Task breakdowns, implementation plans, TDD approach |
| **code-reviewer** | Phase 10+ | Implementation Review | Code quality review, implementation validation | Implementation files, requirements | Code review reports, quality recommendations |
| **deployment-orchestrator** | Phase 11 | Deployment | Production deployment, pipeline execution, infrastructure | Implementation tasks, deployment requirements | Deployment plans, infrastructure specifications |
| **knowledge-aggregator** | Phase 12 | Learning Capture | Pattern capture, project synthesis, documentation | All phase outputs, lessons learned | Project summary, knowledge documentation |

### Agent Orchestration Patterns

**Phase-Based Agent Coordination:**
- **Phases 1-2**: Complexity assessment and discovery use single agents per mode
- **Phases 3-5**: Requirements refinement uses parallel agents for analysis depth
- **Phases 6-8**: Core planning uses specialized agents for each domain
- **Phases 9-12**: Implementation uses coordinated agent handoffs for quality

**Parallel Agent Execution:**
When multiple agents work simultaneously, they are launched using Claude Code native patterns:
- Each agent receives the original user context via `<prompt-context>`
- Agents work independently and their outputs are synthesized
- Agent coordination follows the wait-for-completion pattern


## Adaptive Execution Mode Functions

### SPEED MODE (5-8 minutes): Fast-Track Simple Projects

```bash
execute_speed_mode() {
    local main_dir="$(pwd)"
    echo "⚡ SPEED MODE: Fast-track discovery for simple projects (5-8 minutes)"
    
    # Single consolidated discovery phase with minimal agent involvement
    echo "🚀 Launching product-strategist for fast-track analysis..."
    
    # Use product-strategist subagent for speed mode analysis
    # Task: Fast-track project analysis for: <prompt-context>
    # Focus: Quick stakeholder ID, basic tech constraints, simple architecture, essential requirements
    # Output: docs/planning/2-discovery-analysis.md
    
    # Smart confirmation only if conflicts detected
    check_smart_confirmations "speed-mode"
}
```

### STANDARD MODE (15-25 minutes): Full Phase Flow with Smart Confirmations

```bash  
execute_standard_mode() {
    local main_dir="$(pwd)"
    echo "📊 STANDARD MODE: Full phase flow with smart confirmations (15-25 minutes)"
    
    # Execute phases 1-4 with strategic agent involvement
    execute_discovery_phases_with_agents
    
    # Smart confirmation checkpoints triggered by intelligence
    check_smart_confirmations "standard-mode"
}

execute_discovery_phases_with_agents() {
    # Phase 1: Strategic Discovery with parallel analysis
    echo "🔍 Phase 1: Strategic Discovery with parallel agent analysis"
    
    # Parallel agent invocation using Claude Code native pattern
    # For each analysis area: Launch subagents independently and run in parallel
    
    # Analysis areas to process in parallel
    analysis_areas=("stakeholder-analysis" "use-case-discovery" "requirements-extraction" "constraint-identification")
    
    # Launch parallel subagents for Phase 1 analysis
    for area in "${analysis_areas[@]}"; do
        case "$area" in
            "stakeholder-analysis")
                echo "🎯 Task: Use product-strategist subagent for stakeholder analysis of: <prompt-context>"
                ;;
            "use-case-discovery") 
                echo "🔍 Task: Use product-strategist subagent for use case discovery of: <prompt-context>"
                ;;
            "requirements-extraction")
                echo "📋 Task: Use product-strategist subagent for requirements extraction of: <prompt-context>"
                ;;
            "constraint-identification")
                echo "⚠️ Task: Use product-strategist subagent for constraint identification of: <prompt-context>"
                ;;
        esac
    done
    
    # Wait for all parallel subagents to complete before proceeding
    echo "⏳ Waiting for all Phase 1 parallel analysis to complete..."
    
    # Phase 2-4: Continue with technology research and feasibility
    execute_phases_2_to_4_with_parallel_tech_research
}

execute_phases_2_to_4_with_parallel_tech_research() {
    # Phase 4: Parallel Technology Research
    echo "🔬 Phase 4: Parallel technology research with multiple subagents"
    
    # Technology research areas to analyze in parallel
    tech_areas=("frontend-tech" "backend-tech" "database-tech" "infrastructure-tech" "security-tech" "integration-tech")
    
    # Launch parallel tech-research-analyst subagents
    for tech_area in "${tech_areas[@]}"; do
        case "$tech_area" in
            "frontend-tech")
                echo "💻 Task: Use tech-research-analyst subagent for frontend technology research of: <prompt-context>"
                ;;
            "backend-tech")
                echo "🏗️ Task: Use tech-research-analyst subagent for backend technology research of: <prompt-context>"
                ;;
            "database-tech")
                echo "🗄️ Task: Use tech-research-analyst subagent for database technology research of: <prompt-context>"
                ;;
            "infrastructure-tech")
                echo "☁️ Task: Use tech-research-analyst subagent for infrastructure research of: <prompt-context>"
                ;;
            "security-tech")
                echo "🔒 Task: Use tech-research-analyst subagent for security technology research of: <prompt-context>"
                ;;
            "integration-tech")
                echo "🔗 Task: Use tech-research-analyst subagent for integration pattern research of: <prompt-context>"
                ;;
        esac
    done
    
    echo "⏳ Waiting for all parallel technology research to complete..."
    
    # Synthesize parallel analysis results into discovery document
    synthesize_standard_mode_analysis
}

synthesize_standard_mode_analysis() {
    echo "🔗 Task: Use system-architect subagent to synthesize standard mode analysis for: <prompt-context>"
    echo "📄 Expected Output: docs/planning/2-discovery-analysis.md"
    echo "📄 Input Files: Parallel agent analysis results from stakeholder, use-case, requirements, and constraint analysis"
}
```

### DEEP MODE (30-45 minutes): Comprehensive Analysis with Full Agent Ecosystem

```bash
execute_deep_mode() {
    local main_dir="$(pwd)"
    echo "🔬 DEEP MODE: Comprehensive analysis with full agent ecosystem (30-45 minutes)"
    
    # Extended discovery with comprehensive parallel agent coordination
    execute_comprehensive_discovery_with_parallel_agents
    
    # Both smart triggers AND phase boundary confirmations
    check_smart_confirmations "deep-mode"
    check_phase_boundary_confirmations
}

execute_comprehensive_discovery_with_parallel_agents() {
    echo "🌐 Deep Mode: Launching comprehensive parallel agent ecosystem"
    
    # Comprehensive analysis areas for parallel execution
    comprehensive_areas=("strategic-analysis" "technology-landscape" "architecture-patterns" "security-analysis" "performance-analysis" "compliance-analysis" "competitive-analysis" "risk-analysis")
    
    # Launch parallel subagents for comprehensive analysis
    for area in "${comprehensive_areas[@]}"; do
        case "$area" in
            "strategic-analysis")
                echo "🤖 Task: Use product-strategist subagent to perform comprehensive strategic analysis for: <prompt-context>"
                ;;
            "technology-landscape")
                echo "🤖 Task: Use tech-research-analyst subagent to analyze complete technology landscape for: <prompt-context>"
                ;;
            "architecture-patterns")
                echo "🤖 Task: Use system-architect subagent to evaluate architecture patterns for: <prompt-context>"
                ;;
            "security-analysis")
                echo "🤖 Task: Use tech-research-analyst subagent to perform security analysis for: <prompt-context>"
                ;;
            "performance-analysis")
                echo "🤖 Task: Use tech-research-analyst subagent to analyze performance requirements for: <prompt-context>"
                ;;
            "compliance-analysis")
                echo "🤖 Task: Use product-strategist subagent to analyze compliance requirements for: <prompt-context>"
                ;;
            "competitive-analysis")
                echo "🤖 Task: Use product-strategist subagent to perform competitive analysis for: <prompt-context>"
                ;;
            "risk-analysis")
                echo "🤖 Task: Use product-strategist subagent to analyze project risks for: <prompt-context>"
                ;;
        esac
    done
    
    echo "⏳ Waiting for all comprehensive parallel analysis to complete..."
    
    # Synthesis and integration of all parallel results
    perform_comprehensive_synthesis
}

perform_comprehensive_synthesis() {
    echo "🔗 Deep Mode: Synthesizing all parallel analysis results"
    
    echo "🤖 Task: Use system-architect subagent to synthesize all parallel analysis for: <prompt-context>"
}
```

## Feature-Developer Parallel Implementation Patterns

When launching implementation tasks, use parallel subagent patterns for complex features:

```bash
launch_parallel_feature_implementation() {
    local feature_name="$1"
    local implementation_areas=("frontend-components" "backend-apis" "data-layer" "integration-tests" "documentation")
    
    echo "🚀 Launching parallel implementation for feature: $feature_name"
    
    # For each implementation area: Launch subagents independently and run in parallel
    for area in "${implementation_areas[@]}"; do
        case "$area" in
            "frontend-components")
                echo "🤖 Task: Use feature-developer subagent to implement frontend components for: <prompt-context>"
                ;;
            "backend-apis")
                echo "🤖 Task: Use feature-developer subagent to implement backend APIs for: <prompt-context>"
                ;;
            "data-layer")  
                echo "🤖 Task: Use feature-developer subagent to implement data layer for: <prompt-context>"
                ;;
            "integration-tests")
                echo "🤖 Task: Use feature-developer subagent to create integration tests for: <prompt-context>"
                ;;
            "documentation")
                echo "🤖 Task: Use feature-developer subagent to create documentation for: <prompt-context>"
                ;;
        esac
    done
    
    # Wait for all parallel implementation to complete before proceeding
    echo "⏳ Waiting for all parallel implementation work to complete..."
}
```
- Quality agents → review reports, refactored code
- Deployment agents → deployment reports, infrastructure

**Cross-Agent Dependencies:**
- system-architect reads tech-research-analyst output
- ui-designer reads architecture-specification.md
- feature-developer (Phase 10) reads Phase 5 requirements for test-driven task generation
- feature-developer (Phase 11+) reads task specifications with embedded TDD methodology
- deployment-orchestrator reads CI/CD requirements from feature-developer

### Agent Consistency Requirements

**File Path Standards:**
- All agents use `$main_dir/` prefix for file operations
- Never use `cd`, `pushd`, `popd` - use full paths or `git -C`
- Worktree operations isolated with `$WORKTREE/` prefix

**Quality Gates:**
- Each agent validates its prerequisites exist
- Agents produce structured outputs (JSON manifests, Markdown specifications)
- Agent failures trigger graceful degradation, not system failure

**Session Management:**
- All agents receive session context for debugging
- State management tracks agent invocations
- Failed agents can be retried with enhanced context

## EXECUTION REQUIREMENTS FOR CLAUDE CODE

**MUST Execute Through Bash Tool:**
- All git worktree operations for parallel isolation
- All directory creation and file management commands
- All file rehydration patterns for information flow
- All validation checkpoint logic and quality gates

**MUST Use Task Tool For Parallel Subagents:**
- tech-research agents during Phase 4 (parallel technology investigation)
- **system-architect agent during Phase 7 (architecture design and foundation implementation)**
- ui-designer agent during Phase 9 (interface design)
- feature-developer agents during Phase 10 (test-driven task generation with requirements traceability)
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
                if git -C "$worktree_path" status --porcelain | grep -q .; then
                    echo "💾 Committing abandoned work in $worktree_path"
                    git -C "$worktree_path" add -A && git -C "$worktree_path" commit -m "Abandoned work recovery from session $session_id" || true
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
        if git -C "$main_dir" worktree list | grep -q "$WORKTREE"; then
            location_available=false
        fi
        
        # Check 3: Not in our active worktrees state file
        if [ -f "$state_dir/active-worktrees.txt" ] && grep -q "^$WORKTREE|" "$state_dir/active-worktrees.txt"; then
            location_available=false
        fi
        
        # Check 4: No conflicting directories in parent (using subshell format)
        if [ -d "../$(basename "$WORKTREE")" ]; then
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
            
            # Aggregate all markdown files from this knowledge folder (using subshell to avoid cd)
            local md_files=$(find "$knowledge_path" -name "*.md" -type f | sort)
            
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
        echo "- $path/knowledge ($(find "$path/knowledge" -name "*.md" -type f | wc -l) files)"
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
        echo "📊 Total knowledge files processed: $(grep -c "^### " "$project_knowledge_path"/* 2>/dev/null || echo 0)"
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

## SECTION 2: ADAPTIVE PHASE EXECUTION SYSTEM

This section implements the adaptive intelligence system that adjusts execution complexity based on project scope with proper parallel subagent integration.

### Main Execution Entry Point

**Purpose:** Initialize IDEAL-STI v3.0 adaptive planning system.

**Execution Instructions:**
```bash
# Main entry point - start adaptive intelligence planning
execute_ideal_sti_adaptive() {
    local main_dir="$(pwd)"
    local user_input="<prompt-context>"
    
    echo "🚀 IDEAL-STI v3.0 Adaptive Intelligence Planning System"
    echo "================================================="
    echo "📋 Project Requirements: $user_input"
    echo ""
    
    # Initialize planning directory structure
    mkdir -p "$main_dir/docs/planning"
    
    # Execute phases in order
    execute_phase0_if_needed
    assess_complexity_and_select_mode
    
    echo ""
    echo "✅ IDEAL-STI v3.0 planning system execution complete!"
    echo "📁 All planning documents available in: docs/planning/"
}
```

### Adaptive Phase Execution Framework

**INTELLIGENT APPROACH**: Automatically adjust analysis depth and agent involvement based on project complexity while maintaining smart confirmation points.

### Phase 0: Existing Project Analysis (OPTIONAL)

**Purpose:** Reverse engineer existing code and documentation to understand current state.

**Skip Conditions:**
- No `src/` or `docs/` directories exist (greenfield project)
- Documentation modified within last 7 days (fresh docs)  
- User explicitly sets `IDEAL_STI_SKIP_PHASE_0=true`

**Execution Instructions:**
```bash
# Phase 0 analysis if needed
execute_phase0_if_needed() {
    local main_dir="$(pwd)"
    
    if [ -d "src/" ] || [ -d "docs/" ]; then
        if [ "$(find docs/ -name "*.md" -mtime -7 2>/dev/null | wc -l)" -eq 0 ]; then
            echo "🔍 Phase 0: Analyzing existing project structure..."
            
            # Create Phase 0 analysis
            cat > "$main_dir/docs/planning/phase0-existing-analysis.md" << 'EOF'
# Phase 0: Existing Project Analysis

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

## Integration with Adaptive Planning
- Existing features to preserve
- Constraints from current implementation
- Migration requirements for new features
EOF
            
            echo "✅ Phase 0: Existing project analysis complete"
        fi
    fi
}
```

### Phase 1: Complexity Assessment & Mode Selection

**Purpose:** Analyze user input complexity and select appropriate execution mode (SPEED/STANDARD/DEEP).

**Execution Instructions:**
```bash
# Assess project complexity and select execution mode
assess_complexity_and_select_mode() {
    local main_dir="$(pwd)"
    local user_input="<prompt-context>"
    local assessment_output="$main_dir/docs/planning/1-complexity-assessment.md"
    
    echo "🧠 Phase 1: Intelligent complexity assessment and execution mode selection..."
    
    # Intelligent Complexity Assessment using prompt-as-code
    complexity_assessment_prompt="## Smart Project Complexity Analysis

**Task**: Evaluate project complexity through contextual reasoning and intelligent analysis.

**Project Request**: <prompt-context>

**INTELLIGENT ASSESSMENT FRAMEWORK:**

### 1. **Technical Architecture Complexity**
Evaluate the architectural sophistication required:
- **HIGH COMPLEXITY**: Distributed systems, microservices, real-time processing, event streaming, complex data pipelines, enterprise integration patterns, multi-tenant architecture
- **MEDIUM COMPLEXITY**: Traditional client-server, standard APIs, database integration, authentication systems, moderate data processing, third-party integrations
- **LOW COMPLEXITY**: Simple CRUD operations, basic web applications, single-database systems, straightforward user interfaces, minimal external dependencies

### 2. **Business Logic Sophistication** 
Assess the business domain complexity:
- **HIGH COMPLEXITY**: Complex workflows, regulatory compliance, multi-role permissions, financial calculations, audit trails, complex business rules, industry-specific requirements
- **MEDIUM COMPLEXITY**: Standard business processes, moderate user roles, basic reporting, standard e-commerce, content management, user management
- **LOW COMPLEXITY**: Simple data entry, basic CRUD operations, straightforward user flows, minimal business logic, prototype/MVP functionality

### 3. **Implementation Risk Factors**
Consider development and delivery risks:
- **HIGH RISK**: New/bleeding-edge technology, complex integration requirements, performance-critical systems, high availability needs, security-critical applications, large team coordination
- **MEDIUM RISK**: Established but newer technologies, moderate performance requirements, standard security needs, small team development, well-defined scope
- **LOW RISK**: Familiar technology stack, simple deployment, low performance requirements, solo/pair development, clear and simple requirements

### 4. **Project Context Factors**
Evaluate situational complexity:
- **HIGH CONTEXT**: Enterprise environment, multiple stakeholders, existing system constraints, regulatory requirements, migration from legacy systems
- **MEDIUM CONTEXT**: Standard business environment, moderate stakeholder involvement, some existing system integration, normal compliance needs
- **LOW CONTEXT**: Greenfield development, minimal stakeholders, standalone system, flexible requirements, prototype/experimental nature

**EXECUTION MODE SELECTION:**

Based on your analysis, select the optimal mode:

- **SPEED MODE (5-8 min)**: For simple, well-understood projects with low complexity across all dimensions. Suitable for prototypes, simple tools, basic CRUD applications, or proof-of-concepts.

- **STANDARD MODE (15-25 min)**: For moderate complexity projects with some unknowns. Suitable for standard business applications, moderate integrations, established patterns with some customization.

- **DEEP MODE (30-45 min)**: For high complexity or high-risk projects requiring thorough analysis. Suitable for enterprise systems, complex architectures, critical business systems, or projects with significant unknowns.

**Required Output Format:**
Generate comprehensive analysis in @docs/planning/1-complexity-assessment.md including:
1. **Complexity Analysis**: Detailed reasoning for each dimension
2. **Execution Mode**: Selected mode with clear justification  
3. **Risk Factors**: Key risks and mitigation considerations
4. **Planning Approach**: How the selected mode addresses project needs
5. **Confidence Level**: Assessment confidence (HIGH/MEDIUM/LOW) and reasoning

**Decision Criteria**: Use intelligent reasoning rather than keyword counting. Consider the full context, not just surface indicators."

    echo "🤖 Task: Use system-architect subagent for intelligent complexity assessment: <prompt-context>"
    echo "📄 Expected Output: docs/planning/1-complexity-assessment.md"
    echo "📄 Output Format: Structured analysis with mode selection and detailed reasoning"
    
    # Wait for intelligent assessment to complete and read the selected mode
    echo "⏳ Waiting for intelligent complexity assessment to complete..."
    
    # Read the selected execution mode from the assessment file
    local execution_mode=""
    if [ -f "$assessment_output" ]; then
        # Extract execution mode from the assessment file
        execution_mode=$(grep -i "selected.*mode\|execution.*mode" "$assessment_output" | head -1 | grep -o -i "SPEED\|STANDARD\|DEEP" | tr '[:lower:]' '[:upper:]')
        
        if [ -z "$execution_mode" ]; then
            echo "⚠️ Could not determine execution mode from assessment - defaulting to STANDARD"
            execution_mode="STANDARD"
        fi
    else
        echo "⚠️ Assessment file not generated - defaulting to STANDARD mode"
        execution_mode="STANDARD"
    fi
    
    echo "✅ Intelligent complexity assessment complete: $execution_mode mode selected"
    echo "🎯 Executing $execution_mode mode discovery..."
    
    # Execute appropriate mode based on intelligent assessment
    case $execution_mode in
        "SPEED")
            execute_speed_mode
            standardize_discovery_outputs "speed"
            ;;
        "STANDARD")
            execute_standard_mode
            standardize_discovery_outputs "standard"
            ;;
        "DEEP")
            execute_deep_mode
            standardize_discovery_outputs "deep"
            ;;
        *)
            echo "⚠️ Unknown execution mode: $execution_mode - executing STANDARD mode"
            execute_standard_mode
            standardize_discovery_outputs "standard"
            ;;
    esac
    
    # After discovery completion, proceed to requirements refinement
    echo "✅ Discovery phase complete. Starting intelligent requirements refinement..."
    execute_phase3_requirements_refinement_loop
    
    # After refinement, proceed to consolidation phases
    echo "✅ Requirements refinement complete. Consolidating analysis into dedicated phase files..."
    execute_phase4_anti_case_consolidation
    execute_phase5_technology_ecosystem_analysis
    
    # After consolidation, proceed to detailed requirements and architecture  
    echo "✅ Analysis consolidation complete. Proceeding to requirements specification..."
    execute_phase6_requirements_specification
    execute_phase7_interface_design  
    execute_phase8_architecture_design
    
    # Continue to implementation phases
    echo "✅ Architecture phase complete. Proceeding to implementation planning..."
    execute_phases_8_to_10_task_generation
    execute_phase11_implementation
    execute_phase12_to_16_deployment
}

# EXECUTION MODE FUNCTIONS WITH INTELLIGENT CONFIRMATION TRIGGERS

# SPEED MODE: Fast-track discovery with intelligent confirmation triggers
execute_speed_mode() {
    local main_dir="$(pwd)"
    echo "⚡ SPEED MODE: Fast-track discovery (5-8 minutes)"
    
    # Single consolidated discovery phase with minimal agent involvement
    echo "🚀 Task: Use product-strategist subagent for fast-track analysis: <prompt-context>"
    echo "📄 Expected Output: docs/planning/2-discovery-analysis.md"
    echo "📄 Analysis Focus: Quick stakeholder ID, basic tech constraints, simple architecture, essential requirements"
    
    # Context-aware confirmation trigger for SPEED mode
    evaluate_speed_mode_confirmation_needs
}

# STANDARD MODE: Full phase flow with context-aware smart confirmations
execute_standard_mode() {
    local main_dir="$(pwd)"
    echo "📊 STANDARD MODE: Full phase flow with smart confirmations (15-25 minutes)"
    
    # Execute parallel discovery with strategic agent involvement
    execute_standard_discovery_with_parallel_agents
    
    # Context-aware confirmation evaluation
    evaluate_standard_mode_confirmation_needs
}

# DEEP MODE: Comprehensive analysis with full agent ecosystem
execute_deep_mode() {
    local main_dir="$(pwd)"
    echo "🔬 DEEP MODE: Comprehensive analysis with full agent ecosystem (30-45 minutes)"
    
    # Extended discovery with comprehensive parallel agent coordination
    execute_comprehensive_discovery_with_parallel_agents
    
    # Context-aware confirmation evaluation for complex projects
    evaluate_deep_mode_confirmation_needs
}

# INTELLIGENT CONFIRMATION TRIGGER FUNCTIONS

# Context-aware confirmation evaluation for SPEED mode
evaluate_speed_mode_confirmation_needs() {
    echo "🧠 Evaluating SPEED mode confirmation needs..."
    
    confirmation_evaluation_prompt="## Context-Aware Confirmation Assessment - SPEED Mode

**Project Context**: <prompt-context>
**Discovery Analysis**: @docs/planning/2-discovery-analysis.md

**INTELLIGENT CONFIRMATION EVALUATION:**

Determine if user guidance would improve fast-track discovery outcomes:

### **Scope Evolution Check**
- Has the analysis revealed requirements significantly beyond original request scope?
- Are there multiple valid interpretation paths that weren't clear from initial input?
- Would user clarification prevent likely rework during implementation?

### **Assumption Risk Assessment**  
- Are we making architectural assumptions that could fundamentally alter user expectations?
- Do technology choices introduce constraints the user should be aware of?
- Are there business logic assumptions that seem uncertain?

### **Implementation Feasibility**
- Have we identified potential blockers or constraints that affect viability?
- Are there integration challenges that change the project scope significantly?
- Do performance or security requirements seem unclear for the use case?

**CONFIRMATION DECISION LOGIC:**

**TRIGGER USER CONFIRMATION** if:
- Scope appears to have expanded >30% from original request
- Major architectural assumptions would be difficult/expensive to change later
- Technical constraints introduce significant limitations user should approve
- Multiple implementation approaches exist with very different tradeoffs

**PROCEED WITHOUT CONFIRMATION** if:
- Requirements are clear and well-bounded for a simple project
- Technology choices are straightforward and low-risk
- Implementation approach is obvious and aligns with user input
- Fast-track timeline would be compromised without significant benefit

**Expected Output**: Document decision in @docs/planning/confirmation-assessment-speed.md
- **CONFIRMATION_NEEDED**: true/false
- **Trigger Reasons**: Specific concerns requiring user input
- **User Questions**: 3 dynamic response proposals if confirmation needed
- **Confidence Level**: Assessment confidence in the decision"

    echo "🤖 Task: Use system-architect subagent for SPEED mode confirmation evaluation: <prompt-context>"
    echo "📄 Expected Output: docs/planning/confirmation-assessment-speed.md"
    
    # Check if confirmation is needed and trigger user interaction
    trigger_user_confirmation_if_needed "speed"
}

# Context-aware confirmation evaluation for STANDARD mode  
evaluate_standard_mode_confirmation_needs() {
    echo "🧠 Evaluating STANDARD mode confirmation needs..."
    
    confirmation_evaluation_prompt="## Context-Aware Confirmation Assessment - STANDARD Mode

**Project Context**: <prompt-context>
**Discovery Analysis**: @docs/planning/2-discovery-analysis.md

**INTELLIGENT CONFIRMATION EVALUATION:**

Assess if strategic user guidance would improve standard project outcomes:

### **Scope & Complexity Evolution**
- How significantly have requirements evolved from initial understanding?
- Are there architectural complexity factors that weren't initially apparent?
- Would user input help prioritize competing requirements or approaches?

### **Technology & Integration Concerns**
- Do technology research findings suggest unexpected constraints or opportunities?
- Are there integration challenges that could affect user priorities?
- Have we discovered performance/security requirements that need validation?

### **Stakeholder & Business Logic Uncertainties**
- Are there business domain assumptions that seem uncertain?
- Do workflow or user experience choices need stakeholder validation?
- Are there regulatory or compliance considerations that emerged?

**CONFIRMATION DECISION LOGIC:**

**TRIGGER USER CONFIRMATION** if:
- Requirements complexity significantly exceeds initial assessment  
- Technology research reveals constraints/opportunities affecting approach
- Business logic assumptions need domain expert validation
- Multiple architectural approaches exist with significantly different tradeoffs

**PROCEED WITHOUT CONFIRMATION** if:
- Discovery findings align well with initial complexity assessment
- Technology choices are well-supported by requirements analysis
- Business logic understanding seems sufficient for implementation
- Standard approach timeline would be significantly impacted

**Expected Output**: Document decision in @docs/planning/confirmation-assessment-standard.md"

    echo "🤖 Task: Use system-architect subagent for STANDARD mode confirmation evaluation: <prompt-context>"
    echo "📄 Expected Output: docs/planning/confirmation-assessment-standard.md"
    
    # Check if confirmation is needed and trigger user interaction
    trigger_user_confirmation_if_needed "standard"
}

# Context-aware confirmation evaluation for DEEP mode
evaluate_deep_mode_confirmation_needs() {
    echo "🧠 Evaluating DEEP mode confirmation needs..."
    
    confirmation_evaluation_prompt="## Context-Aware Confirmation Assessment - DEEP Mode

**Project Context**: <prompt-context>
**Discovery Analysis**: @docs/planning/2-discovery-analysis.md

**COMPREHENSIVE CONFIRMATION EVALUATION:**

Evaluate comprehensive user guidance needs for complex projects:

### **Architecture & Scale Validation**
- Do architectural decisions need stakeholder validation before proceeding?
- Are scalability and performance assumptions aligned with business expectations?
- Have we identified enterprise constraints that affect design significantly?

### **Risk & Complexity Management**
- Are there major technical risks that need user priority guidance?
- Do integration complexities require stakeholder decision-making?
- Are there regulatory/compliance requirements needing business validation?

### **Resource & Timeline Implications**
- Do complexity findings affect expected timeline/resource allocation?
- Are there implementation sequence decisions that need business input?
- Have we discovered dependencies that affect project priority/scope?

**CONFIRMATION DECISION LOGIC:**

For DEEP mode projects, confirmation is more frequently warranted due to complexity:

**TRIGGER USER CONFIRMATION** if:
- Architectural decisions have significant business/technical tradeoffs
- Risk analysis reveals factors that could affect project viability/priority
- Compliance/regulatory findings affect scope or approach significantly
- Resource/timeline implications differ substantially from initial expectations

**PROCEED WITHOUT CONFIRMATION** if:
- Complex analysis confirms initial understanding and approach
- Risk factors are manageable within expected project parameters
- Architectural approach is clearly optimal for discovered requirements
- Comprehensive timeline would be significantly impacted without clear benefit

**Expected Output**: Document decision in @docs/planning/confirmation-assessment-deep.md"

    echo "🤖 Task: Use system-architect subagent for DEEP mode confirmation evaluation: <prompt-context>"
    echo "📄 Expected Output: docs/planning/confirmation-assessment-deep.md"
    
    # Check if confirmation is needed and trigger user interaction  
    trigger_user_confirmation_if_needed "deep"
}

# Universal confirmation trigger function
trigger_user_confirmation_if_needed() {
    local mode="$1"
    local confirmation_file="docs/planning/confirmation-assessment-$mode.md"
    
    echo "🔍 Checking if user confirmation is needed for $mode mode..."
    
    # Wait for confirmation assessment to complete
    if [ -f "$confirmation_file" ]; then
        if grep -q "CONFIRMATION_NEEDED.*true" "$confirmation_file"; then
            echo "🤔 User confirmation needed - generating dynamic proposals..."
            
            # Extract user questions from assessment file
            user_questions=$(grep -A10 "User Questions:" "$confirmation_file" 2>/dev/null || echo "")
            trigger_reasons=$(grep -A5 "Trigger Reasons:" "$confirmation_file" 2>/dev/null || echo "")
            
            # Generate user prompt with dynamic proposals
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "🤔 **USER GUIDANCE NEEDED**"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "**Analysis Context:** $mode mode discovery has identified areas needing your input."
            echo ""
            echo "**Key Concerns:**"
            echo "$trigger_reasons"
            echo ""
            echo "**Your Input Options:**"
            echo "$user_questions"
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            # Wait for user response (this would be handled by Claude Code's user interaction)
            echo "⏳ Awaiting user response..."
            echo "📝 User feedback will be incorporated into docs/planning/user-confirmation-response-$mode.md"
        else
            echo "✅ No user confirmation needed - proceeding with $mode mode discovery"
        fi
    else
        echo "⚠️ Confirmation assessment not completed - proceeding without confirmation"
    fi
}

# ADAPTIVE AGENT ORCHESTRATION FUNCTIONS

# STANDARD MODE: Context-aware agent coordination
execute_standard_discovery_with_parallel_agents() {
    local main_dir="$(pwd)"
    echo "🔗 STANDARD MODE: Context-aware parallel agent coordination"
    
    # Intelligent agent selection based on project context
    agent_selection_prompt="## Context-Aware Agent Selection - STANDARD Mode

**Project Context**: <prompt-context>

**INTELLIGENT AGENT ORCHESTRATION:**

Determine which agents are needed for THIS specific project rather than using predetermined lists:

### **Primary Analysis Domains**
Evaluate which domains need expert analysis:

**Business & Requirements Domain:**
- **product-strategist**: Always included for stakeholder analysis and requirements discovery
- **Focus**: Stakeholder mapping, business logic, functional requirements, use case validation

**Technology Domain Selection:**
- **tech-research-analyst**: Include if technology choices are non-trivial
- **Triggers**: Custom integrations, performance requirements, new technology evaluation, complex architecture needs
- **Skip if**: Simple CRUD, well-established patterns, minimal technical complexity

**Architecture Domain Selection:**  
- **system-architect**: Include if architectural decisions impact multiple components
- **Triggers**: Data architecture decisions, API design, service coordination, technology synthesis
- **Skip if**: Single-component systems, straightforward patterns

**Quality Domain Selection:**
- **ui-designer**: Include if user experience is non-trivial
- **Triggers**: Complex workflows, user interface design needs, user experience optimization
- **Skip if**: API-only systems, admin interfaces, simple forms

### **PARALLEL EXECUTION STRATEGY**

**For Standard Projects**: 2-3 strategic agents in parallel
- **Phase 1**: product-strategist (always) + context-appropriate specialists
- **Phase 2**: system-architect synthesis of parallel outputs

**Expected Agent Outputs:**
- Each agent generates focused analysis in specific domain
- **product-strategist** → stakeholder and requirements analysis  
- **tech-research-analyst** → technology recommendations with rationale
- **system-architect** → synthesis and architecture implications
- **ui-designer** → interface and experience considerations

**Agent Coordination Pattern:**
1. Launch selected agents in parallel with shared context
2. Wait for all parallel agents to complete domain analysis
3. system-architect synthesizes all outputs into unified discovery document

**Final Output**: @docs/planning/2-discovery-analysis.md (synthesized from all agent inputs)

**Decision**: Select specific agents needed for this project and document reasoning."

    echo "🤖 Task: Use system-architect subagent for intelligent agent selection: <prompt-context>"
    echo "📄 Expected Output: docs/planning/agent-selection-standard.md"
    echo "📄 Final Output: docs/planning/2-discovery-analysis.md (post-synthesis)"
    
    # Execute selected agents in parallel (implementation would be dynamic based on selection)
    execute_selected_agents_in_parallel "standard"
}

# DEEP MODE: Comprehensive agent ecosystem with intelligent coordination
execute_comprehensive_discovery_with_parallel_agents() {
    local main_dir="$(pwd)"
    echo "🔗 DEEP MODE: Comprehensive parallel agent ecosystem"
    
    # Intelligent comprehensive agent coordination
    comprehensive_agent_prompt="## Comprehensive Agent Orchestration - DEEP Mode

**Project Context**: <prompt-context>

**COMPREHENSIVE AGENT ECOSYSTEM:**

For complex projects, use full agent capabilities with intelligent coordination:

### **Core Agent Coordination**

**Strategic Layer:**
- **product-strategist**: Comprehensive stakeholder analysis, complex business logic, regulatory requirements
- **Focus**: Complex workflows, multi-role systems, business domain expertise

**Technical Research Layer:**
- **tech-research-analyst**: Full technology ecosystem evaluation  
- **Focus**: Architecture patterns, third-party services, performance/security analysis, integration complexity

**Architecture Layer:**
- **system-architect**: Complex system design and technology synthesis
- **Focus**: Distributed architecture, data architecture, service design, technology decisions

**Experience Layer:**
- **ui-designer**: Complex user experience and interface design
- **Focus**: Multi-role interfaces, complex workflows, accessibility, user journey optimization

### **PARALLEL EXECUTION STRATEGY**

**Phase 1: Parallel Domain Analysis**
Launch all relevant agents simultaneously:
1. **product-strategist**: Business domain deep-dive
2. **tech-research-analyst**: Technology ecosystem research  
3. **ui-designer**: User experience analysis (if applicable)

**Phase 2: Architecture Synthesis**  
4. **system-architect**: Synthesize all domain analyses into comprehensive architecture

**Phase 3: Knowledge Integration**
5. **knowledge-aggregator**: Capture patterns and integration insights

### **Agent Coordination Patterns**

**Handoff Points:**
- Domain agents → system-architect (architecture synthesis)
- system-architect → knowledge-aggregator (pattern capture)
- All agents share: project context, discovery findings, cross-domain insights

**Output Integration:**
- Domain-specific analysis files from each agent
- Comprehensive synthesis in @docs/planning/2-discovery-analysis.md
- Pattern documentation in knowledge base

**Quality Assurance:**
- Each agent validates assumptions within their domain
- system-architect ensures cross-domain consistency
- knowledge-aggregator identifies potential conflicts or gaps

**Expected Timeline**: 30-45 minutes with full parallel execution
**Expected Depth**: Enterprise-grade analysis with comprehensive coverage"

    echo "🤖 Task: Use system-architect subagent for comprehensive agent orchestration: <prompt-context>"
    echo "📄 Expected Output: docs/planning/agent-orchestration-deep.md"
    echo "📄 Final Output: docs/planning/2-discovery-analysis.md (comprehensive synthesis)"
    
    # Execute comprehensive agent ecosystem
    execute_comprehensive_agent_ecosystem "deep"
}

# Universal agent execution coordinator
execute_selected_agents_in_parallel() {
    local mode="$1"
    local selection_file="docs/planning/agent-selection-$mode.md"
    
    echo "🚀 Executing selected agents in parallel for $mode mode..."
    
    # Read agent selection and execute accordingly
    if [ -f "$selection_file" ]; then
        echo "📋 Agent selection completed - coordinating parallel execution..."
        
        # Extract selected agents (this would be dynamic based on the selection file)
        echo "🤖 Task: Use product-strategist subagent for stakeholder analysis: <prompt-context>"
        echo "📄 Expected Output: docs/planning/stakeholder-analysis-$mode.md"
        
        # Check if tech-research-analyst was selected
        if grep -q "tech-research-analyst.*INCLUDE" "$selection_file" 2>/dev/null; then
            echo "🤖 Task: Use tech-research-analyst subagent for technology research: <prompt-context>"
            echo "📄 Expected Output: docs/planning/technology-research-$mode.md"
        fi
        
        # Check if ui-designer was selected  
        if grep -q "ui-designer.*INCLUDE" "$selection_file" 2>/dev/null; then
            echo "🤖 Task: Use ui-designer subagent for user experience analysis: <prompt-context>"
            echo "📄 Expected Output: docs/planning/ux-analysis-$mode.md"
        fi
        
        # Always synthesize with system-architect
        echo "⏳ Waiting for all parallel agents to complete..."
        echo "🤖 Task: Use system-architect subagent to synthesize all agent outputs: <prompt-context>"
        echo "📄 Input Files: docs/planning/*-analysis-$mode.md, docs/planning/*-research-$mode.md"
        echo "📄 Expected Output: docs/planning/2-discovery-analysis.md"
        
    else
        echo "⚠️ Agent selection not completed - using default configuration"
        # Fallback to basic agent coordination
        echo "🤖 Task: Use product-strategist subagent for default discovery analysis: <prompt-context>"
        echo "📄 Expected Output: docs/planning/2-discovery-analysis.md"
    fi
}

# Comprehensive agent ecosystem execution
execute_comprehensive_agent_ecosystem() {
    local mode="$1"
    
    echo "🌐 Executing comprehensive agent ecosystem for $mode mode..."
    
    # Phase 1: Parallel domain analysis
    echo "📊 Phase 1: Launching parallel domain analysis..."
    echo "🤖 Task: Use product-strategist subagent for comprehensive business analysis: <prompt-context>"
    echo "📄 Expected Output: docs/planning/business-analysis-comprehensive.md"
    
    echo "🤖 Task: Use tech-research-analyst subagent for full technology ecosystem research: <prompt-context>"
    echo "📄 Expected Output: docs/planning/technology-ecosystem-comprehensive.md"
    
    echo "🤖 Task: Use ui-designer subagent for comprehensive user experience analysis: <prompt-context>"  
    echo "📄 Expected Output: docs/planning/ux-comprehensive.md"
    
    # Phase 2: Architecture synthesis
    echo "📊 Phase 2: Architecture synthesis..."
    echo "⏳ Waiting for all domain analyses to complete..."
    echo "🤖 Task: Use system-architect subagent for comprehensive architecture synthesis: <prompt-context>"
    echo "📄 Input Files: docs/planning/business-analysis-comprehensive.md, docs/planning/technology-ecosystem-comprehensive.md, docs/planning/ux-comprehensive.md"
    echo "📄 Expected Output: docs/planning/2-discovery-analysis.md"
    
    # Phase 3: Knowledge integration
    echo "📊 Phase 3: Knowledge pattern integration..."
    echo "🤖 Task: Use knowledge-aggregator subagent for pattern capture and integration: <prompt-context>"
    echo "📄 Input Files: docs/planning/2-discovery-analysis.md"
    echo "📄 Expected Output: docs/planning/knowledge-patterns-comprehensive.md"
}

# INTELLIGENT FILE COORDINATION SYSTEM

# Intelligent document synthesis and phase preparation
standardize_discovery_outputs() {
    local mode="$1"
    local main_dir="$(pwd)"
    
    echo "🔗 INTELLIGENT FILE COORDINATION: Adaptive document synthesis for $mode mode..."
    
    # Intelligent document synthesis instead of mechanical file operations
    document_synthesis_prompt="## Intelligent Document Synthesis - $mode Mode

**Project Context**: <prompt-context>
**Execution Mode**: $mode

**ADAPTIVE DOCUMENT COORDINATION:**

Synthesize discovery outputs into meaningful, connected documentation for next phase consumption:

### **Content Synthesis Intelligence**

**Available Source Documents:**
- Primary discovery: @docs/planning/2-discovery-analysis.md
- Agent outputs: @docs/planning/*-analysis-*.md, @docs/planning/*-research-*.md  
- Confirmation responses: @docs/planning/user-confirmation-response-*.md
- Assessment files: @docs/planning/confirmation-assessment-*.md

### **Synthesis Strategy**

**For SPEED Mode:**
- Focus on essential insights for rapid phase progression
- Synthesize only critical information needed for requirements specification
- Maintain fast-track timeline by avoiding information overload

**For STANDARD Mode:**
- Create balanced synthesis connecting business and technical insights
- Integrate agent findings into coherent narrative
- Provide sufficient detail for informed architectural decisions

**For DEEP Mode:**
- Generate comprehensive synthesis with cross-domain connections
- Document architectural implications and technology decisions
- Create detailed foundation for complex implementation planning

### **Document Quality Assessment**

Evaluate content for next phase readiness:
- **Completeness**: Are key insights captured for requirements specification?
- **Connections**: Are relationships between business needs and technical choices clear?
- **Actionability**: Can the next phase proceed with confidence based on synthesis?
- **Traceability**: Are decisions and rationale properly documented?

### **Next Phase Preparation**

Generate synthesis optimized for subsequent phases:
- **Requirements Specification**: What functional/NFR foundation is established?
- **Architecture Design**: What technical decisions and constraints are identified?
- **Implementation Planning**: What complexity factors will affect development?

**Expected Output**: 
- @docs/planning/discovery-synthesis-$mode.md (intelligent synthesis for next phases)
- Content should be meaningful connections, not mechanical aggregation
- Include confidence levels and identified gaps for next phase awareness"

    echo "🤖 Task: Use system-architect subagent for intelligent document synthesis: <prompt-context>"
    echo "📄 Expected Output: docs/planning/discovery-synthesis-$mode.md"  
    echo "📄 Input Strategy: Intelligent synthesis of all discovery documents"
    echo "📄 Output Purpose: Optimized foundation for requirements specification phase"
    
    # Intelligent document usage validation
    validate_document_usage_chain "$mode"
}

# Intelligent document usage validation
validate_document_usage_chain() {
    local mode="$1"
    
    echo "🔍 Validating intelligent document usage chain..."
    
    validation_prompt="## Document Usage Chain Validation

**Execution Mode**: $mode

**DOCUMENT FLOW INTELLIGENCE:**

Validate that document generation serves actual implementation needs:

### **Usage Chain Analysis**

**Phase 1 → Phase 2 Flow:**
- Complexity assessment (@docs/planning/1-complexity-assessment.md) → Discovery mode selection
- Mode selection → Agent coordination and discovery execution
- Discovery outputs → Requirements specification foundation

**Discovery → Requirements Flow:**
- Discovery synthesis → Functional requirements identification
- Technology research → NFR specification
- Stakeholder analysis → User story and acceptance criteria development

**Requirements → Architecture Flow:**
- Requirements specification → Architecture constraints and patterns
- Technology decisions → Implementation technology stack
- NFR requirements → Performance, security, scalability design

### **Document Utilization Assessment**

**High-Value Documents** (actively used in next phases):
- Discovery synthesis: Foundation for requirements
- Technology research: Architecture and stack decisions
- Quality assessments: Risk and complexity planning

**Support Documents** (reference and traceability):
- Agent selection rationales: Understanding decision context
- Confirmation assessments: Stakeholder alignment validation
- User feedback: Requirement refinement context

### **Quality Metrics**

**Document Effectiveness:**
- **Implementation Readiness**: Can next phase proceed with confidence?
- **Decision Traceability**: Are architectural choices well-reasoned?
- **Stakeholder Alignment**: Are business needs clearly captured?
- **Technical Feasibility**: Are constraints and capabilities understood?

**Expected Output**: Document usage validation and optimization recommendations"

    echo "🤖 Task: Use knowledge-aggregator subagent for document usage validation: <prompt-context>"
    echo "📄 Expected Output: docs/planning/document-usage-validation-$mode.md"
    echo "📄 Validation Focus: Ensure documents serve implementation needs vs bureaucratic overhead"
}
    
    echo "✅ Discovery outputs standardized for phase integration"
}
```

### Smart Confirmation System Implementation

**Intelligence-Driven Confirmations**: Replace fixed phase boundaries with intelligent decision triggers based on analysis results.

```bash
# Check for smart confirmation triggers based on execution mode and analysis results
check_smart_confirmations() {
    local execution_mode="$1"
    local main_dir="$(pwd)"
    
    echo "🧠 Checking smart confirmation triggers for $execution_mode mode..."
    
    # Intelligence-driven triggers (all modes)
    local scope_expansion_detected=false
    local major_assumptions_made=false
    local technology_complexity_discovered=false
    local feasibility_concerns_found=false
    
    # Check for scope expansion (>50% beyond original)
    if [ -f "docs/planning/1-complexity-assessment.md" ]; then
        local original_requirements=$(grep "Requirements Count" docs/planning/1-complexity-assessment.md | grep -o "[0-9]*" || echo "1")
        local current_analysis_size=$(find docs/planning/ -name "*.md" -exec wc -l {} + 2>/dev/null | tail -1 | grep -o "^[0-9]*" || echo "0")
        
        if [ "$current_analysis_size" -gt $((original_requirements * 15)) ] 2>/dev/null; then
            scope_expansion_detected=true
        fi
    fi
    
    # Trigger confirmations based on intelligence
    if [ "$scope_expansion_detected" = true ]; then
        echo "⚠️ SMART TRIGGER: Scope expansion detected (>50% beyond original)"
        trigger_scope_expansion_confirmation
    fi
    
    # Mode-specific confirmation logic
    case "$execution_mode" in
        "speed-mode")
            # Only confirm if conflicts detected
            check_conflict_confirmations
            ;;
        "standard-mode")
            # Smart confirmations for scope/assumptions/tech issues
            check_standard_mode_confirmations
            ;;
        "deep-mode")
            # Both smart triggers AND phase boundary confirmations
            check_comprehensive_confirmations
            ;;
    esac
}

# Architecture confirmation checkpoint (all modes)
trigger_architecture_confirmation() {
    echo "🏗️ ARCHITECTURE CONFIRMATION CHECKPOINT"
    echo "========================================"
    
    confirmation_prompt="## 🏗️ Architecture Review & Approval Required

Based on your original request: **<prompt-context>**

### 📋 Comprehensive Requirements & Technology Specification
$([ -f "docs/planning/6-requirements-specification.md" ] && cat docs/planning/6-requirements-specification.md | head -50 || echo "⚠️ Requirements specification pending - this may indicate an issue with the analysis phase")

### 🏛️ Technology Stack & Architecture Design  
$([ -f "docs/planning/8-architecture-design.md" ] && cat docs/planning/8-architecture-design.md | head -50 || echo "⚠️ Architecture design pending - this may indicate an issue with the design phase")

### 🔍 Discovery Summary & Complexity Assessment
$([ -f "docs/planning/discovery-summary.md" ] && cat docs/planning/discovery-summary.md | head -30 || echo "⚠️ Discovery analysis pending - this may indicate an issue with the discovery phase")
$([ -f "docs/planning/1-complexity-assessment.md" ] && cat docs/planning/1-complexity-assessment.md | head -20 || echo "⚠️ Complexity assessment pending - this may indicate an issue with the assessment phase")

### 🎯 APPROVAL OPTIONS WITH GUIDANCE:

#### ✅ **APPROVE** - Proceed to implementation phases
**Choose this if:**
- Requirements clearly match your needs
- Technology choices seem appropriate for your context
- Architecture addresses your key concerns
- You're comfortable with the complexity assessment

#### 🔍 **EXTEND DISCOVERY** - Additional research needed
**Choose this if you need more analysis on:**
- \"Security requirements for [specific area]\"
- \"Performance analysis for [specific feature]\"  
- \"Integration patterns with [existing system]\"
- \"Compliance requirements for [regulation/standard]\"
- \"Alternative technology options for [component]\"

#### 📝 **REFINE SCOPE** - Adjust requirements or constraints
**Choose this if you want to:**
- \"Add requirement: [specific functionality]\"
- \"Remove feature: [specific component]\"
- \"Change priority: make [feature] higher/lower priority\"
- \"Add constraint: must work with [existing system]\"
- \"Simplify approach: focus on [core functionality]\"

#### ⏹️ **STOP** - Project not feasible or ready
**Choose this if:**
- Complexity is much higher than expected
- Required technology stack doesn't fit your environment
- Timeline or resources don't align with the analysis
- Requirements need fundamental rethinking

### 💡 **DYNAMICALLY CALCULATED RESPONSE PROPOSALS:**

Based on your request \"<prompt-context>\" and the analysis above, here are three tailored suggestions:

**PROPOSAL 1: $(
# Analyze complexity and suggest most appropriate action
if [ -f "docs/planning/1-complexity-assessment.md" ] && grep -q "DEEP\|complex\|high" "docs/planning/1-complexity-assessment.md"; then
    echo "APPROVE with phased approach - implement core functionality first, then expand features in subsequent phases"
elif [ -f "docs/planning/1-complexity-assessment.md" ] && grep -q "SPEED\|simple\|low" "docs/planning/1-complexity-assessment.md"; then
    echo "APPROVE and proceed - the solution is well-suited to your straightforward requirements"
else
    echo "EXTEND DISCOVERY - analyze integration requirements with your existing systems more thoroughly"
fi
)**

**PROPOSAL 2: $(
# Generate refinement suggestion based on discovered technologies
if [ -f "docs/planning/8-architecture-design.md" ] && grep -qi "react\|vue\|angular" "docs/planning/8-architecture-design.md"; then
    echo "REFINE SCOPE - focus on essential UI components first, advanced interactions can be Phase 2"
elif [ -f "docs/planning/8-architecture-design.md" ] && grep -qi "database\|sql\|mongodb" "docs/planning/8-architecture-design.md"; then  
    echo "REFINE SCOPE - start with core data model, add advanced queries and analytics later"
else
    echo "REFINE SCOPE - prioritize user-facing features, administrative features can be added later"
fi
)**

**PROPOSAL 3: $(
# Suggest based on requirements analysis
if [ -f "docs/planning/6-requirements-specification.md" ] && grep -qi "security\|authentication\|auth" "docs/planning/6-requirements-specification.md"; then
    echo "EXTEND DISCOVERY - need deeper security analysis for authentication and data protection requirements"
elif [ -f "docs/planning/6-requirements-specification.md" ] && grep -qi "performance\|scale\|load" "docs/planning/6-requirements-specification.md"; then
    echo "EXTEND DISCOVERY - need performance benchmarking and load testing strategy analysis"
else
    echo "APPROVE with MVP approach - implement minimum viable version first, then iterate based on user feedback"
fi
)**

**Please select one of these proposals or provide your own guidance.**"
    
    echo "🤖 Task: Use system-architect subagent to present architecture for user approval for: <prompt-context>"
}

# Smart confirmation for scope expansion
trigger_scope_expansion_confirmation() {
    echo "⚠️ SCOPE EXPANSION DETECTED"
    echo "=========================="
    
    scope_prompt="## 📈 Project Scope Has Significantly Expanded

**Original Request:** <prompt-context>

### 🔍 Scope Analysis
The analysis has revealed requirements that are **50%+ beyond your original request**. This often happens when:
- Initial requirements were high-level and analysis uncovered complexity
- Integration needs were discovered that weren't initially apparent  
- Technical constraints require additional features
- User needs analysis revealed additional requirements

### 🎯 SCOPE DECISION OPTIONS WITH GUIDANCE:

#### ✅ **CONTINUE WITH EXPANDED SCOPE**
**Choose this if:**
- The expanded scope still fits your timeline and budget
- The additional features add significant value
- You have the resources to handle the increased complexity
- The expansion addresses real needs you hadn't considered

#### 📝 **REFINE TO CORE SCOPE** 
**Choose this if you want to:**
- \"Focus on core feature: [specific functionality]\"
- \"Remove nice-to-have features like [specific items]\"
- \"Implement in phases: Phase 1 should include [essentials]\"
- \"Simplify integration: just do [basic integration] for now\"

#### 🔍 **CLARIFY REQUIREMENTS**
**Choose this if:**
- \"The expansion misunderstood my needs - I actually need [clarification]\"
- \"Some of these features aren't necessary: [specific items]\"
- \"The priority should be [specific order] not what was analyzed\"

### 💡 **DYNAMICALLY CALCULATED RESPONSE PROPOSALS:**

Based on your original request \"<prompt-context>\" and the scope expansion analysis:

**PROPOSAL 1: $(
# Analyze original request keywords for intelligent suggestion
if echo "<prompt-context>" | grep -qi "simple\|quick\|basic\|minimal"; then
    echo "REFINE - stick to core functionality as originally intended, expansion seems to have overcomplicated the simple approach you wanted"
elif echo "<prompt-context>" | grep -qi "enterprise\|production\|scale\|robust"; then
    echo "CONTINUE - the expansion properly addresses the enterprise-level requirements implied in your request"
else
    echo "CONTINUE with phased delivery - implement expanded scope in 2 phases to balance completeness with delivery timeline"
fi
)**

**PROPOSAL 2: $(
# Analyze complexity vs original intent
if [ -f "docs/planning/1-complexity-assessment.md" ] && grep -q "requirements_count.*[0-9]\+" "docs/planning/1-complexity-assessment.md"; then
    req_count=$(grep "requirements_count.*[0-9]\+" "docs/planning/1-complexity-assessment.md" | grep -o "[0-9]\+" | head -1)
    if [ "$req_count" -gt 10 ]; then
        echo "REFINE - prioritize top 5 most critical features from the expanded scope, defer others to Phase 2"
    else
        echo "CONTINUE - the expansion is manageable and adds necessary functionality"
    fi
else
    echo "CLARIFY - let me understand which expanded features are essential vs nice-to-have for your specific use case"
fi
)**

**PROPOSAL 3: $(
# Generate budget/timeline conscious suggestion
if echo "<prompt-context>" | grep -qi "budget\|cost\|timeline\|deadline\|urgent"; then
    echo "REFINE - implement MVP version first to meet timeline, then expand based on initial feedback and usage patterns"
elif echo "<prompt-context>" | grep -qi "comprehensive\|complete\|full"; then
    echo "CONTINUE - the expansion aligns with your comprehensive requirements, proceed with full scope"
else
    echo "REFINE - focus on user-facing features first, backend optimizations and admin features can be Phase 2"
fi
)**

**Please select one of these proposals or provide your own scope guidance.**"

    echo "🤖 Task: Use product-strategist subagent to present scope expansion analysis for: <prompt-context>"
}

# Conflict-based confirmations for speed mode
check_conflict_confirmations() {
    echo "🚨 CONFLICT DETECTION CHECK"
    echo "========================="
    
    # Check for common conflicts that would require user input
    local conflicts_detected=false
    
    echo "Checking for technology conflicts..."
    echo "Checking for requirement conflicts..."
    echo "Checking for constraint conflicts..."
    
    if [ "$conflicts_detected" = true ]; then
        trigger_conflict_resolution_confirmation
    else
        echo "✅ No major conflicts detected - proceeding with speed mode"
    fi
}

# Technology/requirement conflict resolution
trigger_conflict_resolution_confirmation() {
    echo "⚠️ CONFLICTS DETECTED"
    echo "===================="
    
    conflict_prompt="## ⚠️ Analysis Found Conflicts That Need Resolution

**Original Request:** <prompt-context>

### 🔍 Conflict Analysis
The fast-track analysis detected conflicts between your requirements and constraints:

$([ -f "docs/planning/2-discovery-analysis.md" ] && grep -A3 -B3 "conflict\|issue\|problem\|constraint" docs/planning/2-discovery-analysis.md | head -20 || echo "Detailed conflict analysis in progress...")

### 🎯 CONFLICT RESOLUTION OPTIONS:

#### 🔧 **TECHNICAL SOLUTION**
**Choose this if the conflict can be resolved technically:**
- \"Use alternative technology: [suggest specific alternative]\"
- \"Modify approach: [suggest specific modification]\"
- \"Add integration layer to resolve [specific conflict]\"

#### 📝 **REQUIREMENT ADJUSTMENT**
**Choose this if requirements should be modified:**
- \"Remove conflicting requirement: [specific item]\"
- \"Relax constraint: [specific constraint] isn't critical\"
- \"Change priority: [specific requirement] can be Phase 2\"

#### 🔍 **MORE ANALYSIS NEEDED**
**Choose this if you need deeper investigation:**
- \"Switch to STANDARD mode for more detailed analysis\"
- \"Need more research on [specific conflict area]\"

### 💡 **DYNAMICALLY CALCULATED RESPONSE PROPOSALS:**

Based on the conflicts detected and your request \"<prompt-context>\":

**PROPOSAL 1: $(
# Analyze conflict type and suggest technical solution
if [ -f "docs/planning/2-discovery-analysis.md" ]; then
    if grep -qi "database\|storage" "docs/planning/2-discovery-analysis.md"; then
        echo "TECHNICAL - use simpler database approach (SQLite/PostgreSQL) instead of complex NoSQL for easier integration"
    elif grep -qi "api\|integration" "docs/planning/2-discovery-analysis.md"; then
        echo "TECHNICAL - implement standard REST API first, can upgrade to GraphQL later if needed"
    elif grep -qi "auth\|security" "docs/planning/2-discovery-analysis.md"; then
        echo "TECHNICAL - use OAuth2 with existing identity provider instead of building custom authentication"
    else
        echo "TECHNICAL - simplify architecture to use proven, well-documented technologies"
    fi
else
    echo "TECHNICAL - use more standard, widely-adopted technologies to reduce integration complexity"
fi
)**

**PROPOSAL 2: $(
# Analyze original request for requirement flexibility
if echo "<prompt-context>" | grep -qi "mvp\|minimum\|basic\|simple"; then
    echo "REQUIREMENT - remove advanced features causing conflicts, focus on core MVP functionality"
elif echo "<prompt-context>" | grep -qi "real-time\|live\|instant"; then
    echo "REQUIREMENT - implement polling-based updates instead of real-time, easier integration and fewer conflicts"
else
    echo "REQUIREMENT - defer conflicting features to Phase 2, implement core functionality without conflicts first"
fi
)**

**PROPOSAL 3: $(
# Suggest analysis upgrade based on complexity revealed
if grep -qi "complex\|difficult\|challenging" "docs/planning/2-discovery-analysis.md" 2>/dev/null; then
    echo "MORE ANALYSIS - switch to STANDARD mode for deeper technical research to resolve architectural conflicts"
elif echo "<prompt-context>" | grep -qi "integrate\|existing\|current"; then
    echo "MORE ANALYSIS - need detailed analysis of existing system integration patterns and constraints"
else
    echo "MORE ANALYSIS - the conflicts suggest more complexity than initially apparent, need comprehensive analysis"
fi
)**

**Please select one of these proposals or describe how you'd like to resolve the conflicts.**"

    echo "🤖 Task: Use system-architect subagent to present conflict resolution options for: <prompt-context>"
}
```

## SECTION 2.5: INTELLIGENT REQUIREMENTS REFINEMENT SYSTEM

### Phase 3: Requirements Refinement Loop

**Purpose:** Systematically expand requirements thinking through unstated use cases, anti-cases, and comprehensive technology ecosystem analysis (including third-party services, libraries, and tools) until requirements satisfaction is achieved.

**Execution Instructions:**
```bash
execute_phase3_requirements_refinement_loop() {
    local main_dir="$(pwd)"
    local refinement_iteration=1
    local max_iterations=3
    local requirements_satisfied="false"
    
    echo "🧠 Phase 3: Intelligent Requirements Refinement Loop"
    echo "===================================================="
    echo "🎯 Original Request: <prompt-context>"
    echo ""
    
    while [ "$requirements_satisfied" = "false" ] && [ $refinement_iteration -le $max_iterations ]; do
        echo "🔄 REFINEMENT ITERATION $refinement_iteration"
        echo "----------------------------------------"
        
        # Step 1: Discover 5-10 unstated use cases
        discover_unstated_use_cases $refinement_iteration
        
        # Step 2: Identify 5-10 anti-cases (what NOT to consider)
        identify_anti_cases $refinement_iteration
        
        # Step 3: Analyze 5-15 technology choice impacts
        analyze_technology_choice_impacts $refinement_iteration
        
        # Step 4: Quality Assessment and User Feedback Loop
        perform_quality_assessment_and_user_feedback $refinement_iteration
        
        # Step 5: Requirements satisfaction assessment (after potential changes)
        assess_requirements_satisfaction $refinement_iteration
        
        # Intelligent refinement continuation decision
        echo "🧠 Evaluating refinement continuation..."
        
        # Check for user feedback restart flag
        local restart_requested="false"
        if [ -f "docs/planning/user-feedback-$refinement_iteration.md" ]; then
            if grep -q "RESTART.*true" "docs/planning/user-feedback-$refinement_iteration.md"; then
                restart_requested="true"
                echo "🔄 User feedback indicates iteration restart needed"
            fi
        fi
        
        # Check quality assessment confidence
        local quality_confidence="MEDIUM"
        if [ -f "docs/planning/quality-assessment-$refinement_iteration.md" ]; then
            quality_confidence=$(grep -i "confidence.*level" "docs/planning/quality-assessment-$refinement_iteration.md" | grep -o -i "HIGH\|MEDIUM\|LOW" | head -1)
        fi
        
        # Check requirements satisfaction
        if [ -f "docs/planning/requirements-satisfaction-$refinement_iteration.md" ] && [ "$restart_requested" = "false" ]; then
            if grep -q "SATISFIED.*true" "docs/planning/requirements-satisfaction-$refinement_iteration.md"; then
                # Check confidence level for final decision
                if [ "$quality_confidence" = "HIGH" ] || [ "$quality_confidence" = "MEDIUM" ]; then
                    requirements_satisfied="true"
                    echo "✅ Requirements refinement complete - implementation readiness achieved"
                    echo "📊 Final Quality Confidence: $quality_confidence"
                else
                    echo "⚠️ Low quality confidence despite satisfaction - continuing refinement..."
                    refinement_iteration=$((refinement_iteration + 1))
                fi
            else
                echo "🔄 Requirements refinement continuing based on satisfaction assessment..."
                refinement_iteration=$((refinement_iteration + 1))
            fi
        else
            if [ "$restart_requested" = "true" ]; then
                echo "🔄 Restarting iteration based on user feedback..."
                # Keep same iteration number to restart with feedback context
            else
                echo "🔄 Assessment not complete - continuing refinement..."
                refinement_iteration=$((refinement_iteration + 1))
            fi
        fi
    done
    
    # Generate final refined requirements summary
    generate_refined_requirements_summary $refinement_iteration
    
    echo "✅ Phase 3 complete: Requirements refined through $((refinement_iteration-1)) iterations"
    
    # Generate consolidated use case analysis
    echo "🤖 Task: Use product-strategist subagent to consolidate use case analysis for: <prompt-context>"
    echo "📄 Expected Output: docs/planning/3-use-case-analysis.md"
    echo "📄 Input Files: docs/planning/refinement/iteration-*-analysis.md (use case sections)"
}

# Step 1: Discover unstated use cases through systematic analysis
discover_unstated_use_cases() {
    local iteration=$1
    echo "🔍 Step 1: Discovering Unstated Use Cases (Iteration $iteration)"
    
    unstated_cases_prompt="## Unstated Use Case Discovery

**Original Stated Request:** <prompt-context>

**Current Discovery Context:**
$([ -f "docs/planning/discovery-summary.md" ] && cat docs/planning/discovery-summary.md | head -40 || echo "Discovery analysis in progress...")

**SYSTEMATIC USE CASE EXPANSION:**

Analyze the stated request and discovery context to identify 5-10 **unstated but likely important use cases** that the user hasn't explicitly mentioned but would probably need:

### Analysis Framework:
1. **User Journey Extensions** - What happens before/after the stated use case?
2. **Edge Case Scenarios** - What unusual but realistic situations might occur?
3. **Integration Touch Points** - How will this interact with other systems/processes?
4. **Scalability Scenarios** - What if usage grows 10x, 100x?
5. **Failure Recovery Cases** - What if things go wrong?
6. **Multi-User Scenarios** - How do different user types interact with this?
7. **Temporal Variations** - How do requirements change over time/seasons/events?
8. **Compliance Scenarios** - What regulatory/security cases might apply?
9. **Mobile/Device Variations** - How do different access methods affect usage?
10. **Data Evolution Cases** - How do changing data volumes/types affect usage?

### Required Output Format:
For each unstated use case, provide:
- **Use Case ID**: USC-$iteration-01 through USC-$iteration-10
- **Scenario Description**: Clear, specific scenario
- **User Impact**: Why this matters to users
- **Technical Implications**: How this affects architecture/design
- **Priority Assessment**: Critical/Important/Nice-to-Have
- **Incorporation Recommendation**: INCORPORATE/UPDATE_EXISTING/ADD_NEW/MONITOR

Generate: docs/planning/refinement/iteration-$iteration-analysis.md"

    echo "🤖 Task: Use product-strategist subagent to discover unstated use cases for: <prompt-context>"
}

# Step 2: Identify anti-cases (what should NOT be considered)  
identify_anti_cases() {
    local iteration=$1
    echo "🚫 Step 2: Identifying Anti-Cases (Iteration $iteration)"
    
    anti_cases_prompt="## Anti-Case Identification

**Original Request:** <prompt-context>

**Discovered Use Cases Context:**
$([ -f "docs/planning/refinement/iteration-$iteration-analysis.md" ] && cat docs/planning/refinement/iteration-$iteration-analysis.md | head -40 || echo "Use case analysis in progress...")

**SYSTEMATIC ANTI-CASE ANALYSIS:**

Identify 5-10 **anti-cases** - scenarios, features, or requirements that should explicitly NOT be considered or implemented:

### Anti-Case Categories:
1. **Scope Creep Risks** - Features that sound related but aren't core to the mission
2. **Over-Engineering Traps** - Complex solutions when simple ones suffice  
3. **Premature Optimizations** - Performance optimizations not yet needed
4. **Edge Cases Too Rare** - Scenarios affecting <1% of users with high implementation cost
5. **Platform Overreach** - Trying to solve problems outside the domain
6. **Technology Fashion** - Using trendy tech that doesn't fit the actual need
7. **Feature Creep** - Nice-to-have features that distract from core value
8. **Perfectionism Traps** - Trying to handle every possible edge case
9. **Competitor Feature Envy** - Adding features just because competitors have them
10. **Future-Proofing Excess** - Over-designing for hypothetical future needs

### Required Output Format:
For each anti-case, provide:
- **Anti-Case ID**: ANC-$iteration-01 through ANC-$iteration-10
- **Scenario Description**: What should NOT be considered
- **Why It's Tempting**: Why someone might want to include this
- **Why It's Wrong**: Clear reasoning for exclusion
- **Risk If Included**: What problems it would cause
- **Boundary Definition**: Clear line of what's in vs out of scope

Generate: docs/planning/refinement/iteration-$iteration-analysis.md"

    echo "🤖 Task: Use product-strategist subagent to identify anti-cases for: <prompt-context>"
}

# Step 3: Analyze technology choice impacts on all use cases
analyze_technology_choice_impacts() {
    local iteration=$1
    echo "⚙️ Step 3: Technology Choice Impact Analysis (Iteration $iteration)"
    
    tech_impact_prompt="## Technology Choice Impact Analysis

**Original Request:** <prompt-context>

**Use Cases Context:**
$([ -f "docs/planning/refinement/iteration-$iteration-analysis.md" ] && cat docs/planning/refinement/iteration-$iteration-analysis.md | head -30 || echo "Use case analysis in progress...")

**Anti-Cases Context:**
$([ -f "docs/planning/refinement/iteration-$iteration-analysis.md" ] && cat docs/planning/refinement/iteration-$iteration-analysis.md | head -30 || echo "Anti-case analysis in progress...")

**Technology Discovery Context:**
$([ -f "docs/planning/discovery-summary.md" ] && grep -A10 -B5 "Technology\|Stack\|Architecture" docs/planning/discovery-summary.md || echo "Technology analysis in progress...")

**SYSTEMATIC TECHNOLOGY IMPACT ANALYSIS:**

For 5-15 key technology choices identified in discovery, analyze their impact on the complete use case ecosystem:

### Core Framework Assessment:
1. **Positive Use Case Enablement** - Which use cases does this tech make possible/easier?
2. **Negative Use Case Constraints** - Which use cases does this tech make harder/impossible?
3. **Anti-Case Risk Mitigation** - How does this tech help avoid anti-case traps?
4. **Scalability Impact** - How does this tech affect scalability use cases?
5. **Integration Impact** - How does this tech affect integration use cases?

### Third-Party Technology Ecosystem Analysis:
6. **Service Layer Evaluation** - External APIs and SaaS services needed
7. **Framework Extension Libraries** - Open source libraries that extend the core framework
8. **NPM/Package Repository Assessment** - Available packages for specific functionality
9. **GitHub Repository Evaluation** - Community tools and starter templates
10. **Cost-Benefit Analysis** - Preference for free/open source with stability assessment

### Comprehensive Technology Stack:
11. **Maintenance Impact** - Long-term operational implications for full stack
12. **Team Impact** - Learning curve and development velocity effects across all layers
13. **Cost Impact** - Development, operational, and scaling costs including third-party services
14. **Risk Impact** - Technical and business risks from entire technology ecosystem
15. **Migration Impact** - Future flexibility and migration possibilities for integrated stack

### Third-Party Technology Decision Framework:

#### Service Categories to Evaluate:
1. **Infrastructure Services** - Database, hosting, CDN, caching
2. **Authentication Services** - Auth0, Firebase Auth, AWS Cognito, Supabase Auth
3. **Payment Processing** - Stripe, PayPal, Square (if applicable)
4. **Email/Communication** - SendGrid, Twilio, Mailgun
5. **File Storage** - AWS S3, Cloudinary, Firebase Storage
6. **Analytics/Monitoring** - Google Analytics, Mixpanel, Sentry, LogRocket
7. **Search Services** - Algolia, Elasticsearch, MeiliSearch
8. **Real-time Features** - Pusher, Socket.io, Supabase Realtime

#### Library Categories to Evaluate:
1. **UI Component Libraries** - Material-UI, Ant Design, Chakra UI, Tailwind UI
2. **State Management** - Redux Toolkit, Zustand, Jotai, Valtio
3. **Form Handling** - React Hook Form, Formik, Final Form
4. **Date/Time Libraries** - date-fns, Day.js, Luxon
5. **HTTP Clients** - Axios, Fetch, SWR, React Query/TanStack Query
6. **Validation Libraries** - Zod, Yup, Joi, Ajv
7. **Testing Libraries** - Jest, Vitest, Testing Library, Playwright
8. **Build/Development Tools** - Vite, Webpack, ESBuild, SWC

#### Evaluation Criteria for Each Option:
- **Open Source Status**: MIT/Apache license preferred
- **Cost Structure**: Free tier availability, pricing for scale
- **Stability Metrics**: GitHub stars, last commit date, issue response time
- **Community Health**: Active maintainers, documentation quality, Stack Overflow activity
- **Bundle Size Impact**: Size implications for client-side performance
- **Learning Curve**: Team adoption difficulty and time to productivity
- **Use Case Alignment**: How well it supports identified use cases
- **Anti-Case Prevention**: Helps avoid identified anti-patterns

### Required Output Format:

#### Core Framework Analysis:
For each core technology choice (React, Node.js, PostgreSQL, etc.):
- **Technology**: Specific technology/framework/tool
- **Use Case Impact Matrix**: Which use cases benefit (+) or suffer (-) 
- **Anti-Case Prevention**: Which anti-cases this helps avoid
- **Quantified Benefits**: Measurable positive impacts
- **Quantified Costs**: Measurable negative impacts  
- **Risk Assessment**: Technical and business risks
- **Recommendation**: INCORPORATE/UPDATE_APPROACH/ADD_ALTERNATIVE/DEFER/REJECT
- **Rationale**: Clear reasoning for recommendation

#### Third-Party Ecosystem Analysis:
For each relevant service/library category:
- **Category**: Service/Library category (Auth, UI Components, etc.)
- **Top 3 Options Evaluated**: Specific tools with GitHub links
- **Stability Assessment**: Stars, last commit, maintainer activity, license
- **Cost Analysis**: Free tier limits, paid tier pricing, total cost of ownership
- **Use Case Fit**: How well each option supports identified use cases (score 1-10)
- **Bundle Impact**: Size/performance implications
- **Learning Curve**: Team adoption difficulty (Low/Medium/High)
- **Recommended Choice**: Selected option with reasoning
- **Alternative Options**: Backup choices if primary fails
- **Integration Complexity**: How it integrates with core framework

#### Decision Matrix:
Create comprehensive matrices:
1. **Core Technology vs Use Cases Matrix**: Framework choices against all use cases
2. **Third-Party Services vs Use Cases Matrix**: Service choices against use cases  
3. **Library Choices vs Anti-Cases Matrix**: How libraries help avoid anti-patterns
4. **Cost-Benefit Summary**: Total technology stack cost vs value delivered

#### Final Technology Stack Recommendation:
- **Core Framework Stack**: Primary frameworks and languages
- **Essential Third-Party Services**: Must-have external services
- **Recommended Libraries**: Key libraries for development efficiency
- **Development Tools**: Build, test, and deployment tooling
- **Total Cost Estimate**: Monthly and annual cost projections
- **Implementation Phases**: Which technologies to adopt in which order

Generate: docs/planning/technology-impact-analysis-$iteration.md"

    echo "🤖 Task: Use tech-research-analyst subagent to analyze technology choice impacts for: <prompt-context>"
}

# Step 4: Assess requirements satisfaction and NFR completeness
assess_requirements_satisfaction() {
    local iteration=$1
    echo "📊 Step 4: Requirements Satisfaction Assessment (Iteration $iteration)"
    
    satisfaction_prompt="## Requirements Satisfaction Assessment

**Original Request:** <prompt-context>

**Current Analysis Context:**
- **Unstated Use Cases:** $([ -f "docs/planning/refinement/iteration-$iteration-analysis.md" ] && grep -c "USC-$iteration" docs/planning/refinement/iteration-$iteration-analysis.md || echo "0") identified
- **Anti-Cases:** $([ -f "docs/planning/refinement/iteration-$iteration-analysis.md" ] && grep -c "ANC-$iteration" docs/planning/refinement/iteration-$iteration-analysis.md || echo "0") identified  
- **Technology Impacts:** $([ -f "docs/planning/technology-impact-analysis-$iteration.md" ] && grep -c "Technology:" docs/planning/technology-impact-analysis-$iteration.md || echo "0") analyzed

**Iteration Context Files:**
$([ -f "docs/planning/refinement/iteration-$iteration-analysis.md" ] && echo "Use Cases:" && cat docs/planning/refinement/iteration-$iteration-analysis.md | head -20)
$([ -f "docs/planning/refinement/iteration-$iteration-analysis.md" ] && echo "Anti-Cases:" && cat docs/planning/refinement/iteration-$iteration-analysis.md | head -20)
$([ -f "docs/planning/technology-impact-analysis-$iteration.md" ] && echo "Tech Analysis:" && cat docs/planning/technology-impact-analysis-$iteration.md | head -20)

**INTELLIGENT REQUIREMENTS SATISFACTION ASSESSMENT:**

Use contextual reasoning to determine if requirements understanding has reached implementation readiness:

### **Satisfaction Evaluation Framework:**

**1. Implementation Readiness Assessment**
- Can a development team start building with confidence based on current understanding?
- Are the core functional requirements clear enough to define APIs, data models, and user flows?
- Have we identified the most critical use cases that will drive architectural decisions?
- Are scope boundaries well-enough defined to prevent major scope creep?

**2. Risk & Uncertainty Analysis** 
- Are the major technical unknowns identified and understood?
- Do we understand the business domain well enough to make informed design decisions?
- Have we identified potential integration challenges and constraints?
- Are performance, security, and scalability considerations appropriately understood for this project type?

**3. Stakeholder Alignment Potential**
- Are requirements comprehensive enough that stakeholders could validate the approach?
- Have we discovered the most important unstated expectations?
- Are we confident we understand the problem space well enough to propose solutions?
- Would additional discovery likely yield diminishing returns vs starting implementation?

**4. Architecture Foundation Readiness**
- Can system architects make informed technology choices based on current understanding?
- Are non-functional requirements clear enough to guide architectural decisions?
- Do we understand data flows, user interactions, and system boundaries sufficiently?
- Are external integrations and dependencies well-understood?

### **Decision Intelligence:**
Instead of scoring thresholds, make a holistic judgment:

**CONTINUE REFINEMENT** if:
- Major functional gaps remain unclear
- Technology choices seem misaligned with discovered needs
- Stakeholder expectations are still largely unknown  
- Implementation would likely encounter major unknown requirements
- Architecture decisions would be largely speculative

**REQUIREMENTS SATISFIED** if:
- Core functionality is well-understood and bounded
- Technology approach aligns with discovered requirements
- Major risks and constraints are identified
- Implementation team could confidently begin design and development
- Additional refinement would likely yield diminishing returns

### **Output Format:**
- **SATISFIED**: true/false (based on implementation readiness reasoning)
- **Confidence Level**: HIGH/MEDIUM/LOW with reasoning
- **Key Readiness Factors**: What makes us confident to proceed
- **Remaining Considerations**: Minor gaps that can be addressed during implementation
- **Next Phase Preparation**: What the implementation team needs to know

Generate: docs/planning/requirements-satisfaction-$iteration.md"

    echo "🤖 Task: Use system-architect subagent to assess requirements satisfaction for: <prompt-context>"
}

# Step 4: Quality Assessment and User Feedback Loop
perform_quality_assessment_and_user_feedback() {
    local iteration=$1
    echo "🔍 Step 4: Quality Assessment and User Feedback (Iteration $iteration)"
    
    quality_assessment_prompt="## Quality Assessment & User Feedback

**Original Request:** <prompt-context>

**Current Analysis Status:**
- **Use Cases Analyzed:** @docs/planning/refinement/iteration-$iteration-analysis.md (use case sections)
- **Anti-Cases Identified:** @docs/planning/refinement/iteration-$iteration-analysis.md (anti-case sections)  
- **Technology Impact:** @docs/planning/technology-impact-analysis-$iteration.md

**CRITICAL QUALITY ASSESSMENT:**

1. **Completeness Check**: Evaluate the current analysis:
   - Are the discovered use cases truly representative of user needs?
   - Do the anti-cases effectively bound the scope appropriately? 
   - Are technology choices aligned with actual requirements vs assumed requirements?
   - Are there obvious gaps or blind spots in the current analysis?

2. **Quality Evaluation**: Assess analysis depth and accuracy:
   - Do use cases reflect realistic user scenarios vs theoretical possibilities?
   - Are anti-cases genuinely helpful scope boundaries vs arbitrary exclusions?
   - Do technology impacts address real constraints vs speculative concerns?
   - Is the analysis actionable for implementation planning?

3. **User Feedback Decision**: Based on assessment, determine if user input would improve outcomes:
   
   **IF SIGNIFICANT GAPS OR CONCERNS IDENTIFIED:**
   - Generate user prompt with specific questions about gaps/concerns
   - Present 3 dynamically calculated response proposals for user selection
   - Wait for user response and incorporate feedback
   - Mark iteration for restart with user guidance incorporated
   
   **IF ANALYSIS APPEARS SOLID:**
   - Document quality assessment confidence level
   - Proceed to requirements satisfaction assessment
   - No user interruption needed

**Expected Outputs:**
- @docs/planning/quality-assessment-$iteration.md (assessment results)
- @docs/planning/user-feedback-$iteration.md (if user consultation needed)
- Quality confidence score (HIGH/MEDIUM/LOW) for satisfaction assessment

Generate quality assessment and determine if user feedback loop is warranted."

    echo "🤖 Task: Use product-strategist subagent for quality assessment and user feedback determination: <prompt-context>"
    echo "📄 Expected Output: docs/planning/quality-assessment-$iteration.md"
    echo "📄 Conditional Output: docs/planning/user-feedback-$iteration.md (if user consultation needed)"
    echo "📄 Input Files: docs/planning/refinement/iteration-$iteration-analysis.md, docs/planning/technology-impact-analysis-$iteration.md"
    
    # Check if user feedback was requested and handle restart logic
    if [ -f "docs/planning/user-feedback-$iteration.md" ]; then
        if grep -q "RESTART.*true" "docs/planning/user-feedback-$iteration.md"; then
            echo "🔄 User feedback indicates iteration restart needed - incorporating feedback and restarting analysis..."
            # Reset iteration but keep user feedback context for next round
            iteration=$((iteration - 1))
        fi
    fi
}

# Generate final refined requirements summary
generate_refined_requirements_summary() {
    local final_iteration=$1
    echo "📋 Generating Final Refined Requirements Summary"
    
    summary_prompt="## Final Refined Requirements Summary

**Original Request:** <prompt-context>

**Refinement Process Summary:**
- **Iterations Completed**: $((final_iteration-1))
- **Use Cases Discovered**: $(find docs/planning/ -name "unstated-use-cases-*.md" -exec grep -c "USC-" {} + 2>/dev/null | paste -sd+ | bc || echo "0")
- **Anti-Cases Identified**: $(find docs/planning/ -name "anti-cases-*.md" -exec grep -c "ANC-" {} + 2>/dev/null | paste -sd+ | bc || echo "0")
- **Technology Choices Analyzed**: $(find docs/planning/ -name "technology-impact-analysis-*.md" -exec grep -c "Technology:" {} + 2>/dev/null | paste -sd+ | bc || echo "0")

**All Analysis Context:**
$(find docs/planning/ -name "unstated-use-cases-*.md" -exec cat {} \; 2>/dev/null || echo "Use case files not found")
$(find docs/planning/ -name "anti-cases-*.md" -exec cat {} \; 2>/dev/null || echo "Anti-case files not found")
$(find docs/planning/ -name "technology-impact-analysis-*.md" -exec cat {} \; 2>/dev/null || echo "Technology analysis files not found")
$(find docs/planning/ -name "requirements-satisfaction-*.md" -exec cat {} \; 2>/dev/null || echo "Satisfaction assessment files not found")

**SYNTHESIZE FINAL REQUIREMENTS:**

Create comprehensive, refined requirements specification including:

### 1. Core Functional Requirements
- Original stated requirements (enhanced/clarified)
- Critical unstated requirements (incorporated from USC analysis)
- Requirements prioritization (MoSCoW: Must/Should/Could/Won't)

### 2. Comprehensive Non-Functional Requirements (NFRs)
- Performance requirements with quantified targets
- Scalability requirements with growth projections  
- Security requirements with compliance standards
- Reliability requirements with SLA targets
- Usability requirements with UX criteria
- Maintainability requirements with quality metrics

### 3. Technology Requirements & Constraints
- **Core Framework Stack**: Recommended primary frameworks with rationale
- **Third-Party Service Requirements**: Essential external services (auth, storage, etc.)
- **Library Dependencies**: Key libraries for functionality and development efficiency
- **Technology Constraints**: Platform limitations and compatibility requirements
- **Integration Requirements**: APIs, webhooks, and data exchange protocols needed
- **Infrastructure Requirements**: Hosting, database, CDN, and deployment needs
- **Development Tooling**: Build, test, CI/CD, and monitoring tool requirements

### 4. Explicit Scope Boundaries
- What IS included (based on use case analysis)
- What is explicitly EXCLUDED (based on anti-case analysis)  
- Phase 1 vs Future Phase delineation
- Success criteria and acceptance criteria

### 5. Risk-Informed Requirements
- Risk mitigation requirements
- Fallback and contingency requirements
- Monitoring and alerting requirements

Generate: docs/planning/refined-requirements-final.md"

    echo "🤖 Task: Use system-architect subagent to generate final refined requirements for: <prompt-context>"
}

# Phase 4: Anti-Case Consolidation
execute_phase4_anti_case_consolidation() {
    local main_dir="$(pwd)"
    echo "🚫 Phase 4: Anti-Case Analysis Consolidation"
    
    echo "🤖 Task: Use product-strategist subagent to consolidate anti-case analysis for: <prompt-context>"
    echo "📄 Expected Output: docs/planning/4-anti-case-analysis.md"
    echo "📄 Input Files: docs/planning/refinement/iteration-*-analysis.md (anti-case sections)"
}

# Phase 5: Technology Ecosystem Analysis  
execute_phase5_technology_ecosystem_analysis() {
    local main_dir="$(pwd)"
    echo "🔬 Phase 5: Technology Ecosystem Analysis"
    
    echo "🤖 Task: Use tech-research-analyst subagent to consolidate technology ecosystem analysis for: <prompt-context>"
    echo "📄 Expected Output: docs/planning/5-technology-ecosystem.md"  
    echo "📄 Input Files: docs/planning/refinement/iteration-*-analysis.md (technology sections), docs/planning/technology-impact-analysis-*.md"
}
```

## SECTION 3: STANDARD PHASE EXECUTION SYSTEM

This section implements the standard IDEAL-STI phases (5-16) that execute after adaptive discovery completes.

### Phase 6: Requirements Definition

**Purpose:** Detailed functional and non-functional requirements based on discovery analysis.

**Execution Instructions:**
```bash
execute_phase6_requirements_specification() {
    local main_dir="$(pwd)"
    echo "📋 Phase 6: Requirements Definition based on discovery analysis"
    
    echo "🤖 Task: Use product-strategist subagent to define comprehensive requirements for: <prompt-context>"
    echo "📄 Expected Output: docs/planning/6-requirements-specification.md"
    echo "📄 Input Files: docs/planning/2-discovery-analysis.md, docs/planning/refinement/iteration-*-analysis.md"
}
```

### Phase 7: Interface Design

**Purpose:** User experience and API interface design aligned with requirements.

**Execution Instructions:**
```bash
execute_phase7_interface_design() {
    local main_dir="$(pwd)"
    echo "🎨 Phase 7: Interface Design for user experience and APIs"
    
    echo "🤖 Task: Use ui-designer subagent to design comprehensive interfaces for: <prompt-context>"
    echo "📄 Expected Output: docs/planning/7-interface-design.md"
    echo "📄 Input Files: docs/planning/6-requirements-specification.md"
}
### Phase 8: Architecture Design

**Purpose:** System architecture design based on requirements and technology research.

**Execution Instructions:**
```bash
execute_phase8_architecture_design() {
    local main_dir="$(pwd)"
    echo "🏗️ Phase 8: Architecture Design based on requirements and technology stack"
    
    echo "🤖 Task: Use system-architect subagent to design comprehensive architecture for: <prompt-context>"
    echo "📄 Expected Output: docs/planning/8-architecture-design.md"
    echo "📄 Input Files: docs/planning/6-requirements-specification.md, docs/planning/7-interface-design.md, docs/planning/5-technology-ecosystem.md"
    
    # Architecture confirmation checkpoint
    trigger_architecture_confirmation
}
```

### Phase 8-10: Task Generation and Planning

**Purpose:** Generate implementation tasks with embedded TDD methodology.

**Execution Instructions:**
```bash
execute_phases_8_to_10_task_generation() {
    local main_dir="$(pwd)"
    echo "📝 Phases 8-10: Task Generation with TDD Integration"
    
    # Phase 9: Task Planning with TDD approach
    echo "🤖 Task: Use feature-developer subagent to create TDD-integrated task plan for: <prompt-context>"
    echo "📄 Expected Output: docs/planning/9-task-planning.md"
    echo "📄 Input Files: docs/planning/8-architecture-design.md"
    
    # Phase 10: Implementation Task Generation 
    echo "🤖 Task: Use feature-developer subagent to generate implementation tasks for: <prompt-context>"
    echo "📄 Expected Output: docs/planning/10-implementation-tasks.md"
    echo "📄 Input Files: docs/planning/9-task-planning.md"
}
```

### Phase 11-16: Implementation and Deployment

**Purpose:** Execute implementation with parallel task coordination and automated deployment.

**Execution Instructions:**
```bash
execute_phase11_implementation() {
    local main_dir="$(pwd)"
    echo "🚀 Phase 11: Implementation Loop with Parallel Task Execution"
    
    echo "🤖 Task: Use feature-developer subagent to execute implementation tasks for: <prompt-context>"
    echo "📄 Input Files: docs/planning/10-implementation-tasks.md"
    echo "📄 Subagent Output: Implementation files in worktree, tested code"
}

execute_phase12_to_16_deployment() {
    local main_dir="$(pwd)"
    echo "🚀 Phase 12-16: Deployment Pipeline and Production Launch"
    
    echo "🤖 Task: Use deployment-orchestrator subagent to execute deployment pipeline for: <prompt-context>"
    echo "📄 Expected Output: docs/planning/11-deployment-plan.md"
    echo "📄 Input Files: docs/planning/10-implementation-tasks.md, implemented code from worktree"
    echo "📄 Final Output: docs/planning/12-project-summary.md (by knowledge-aggregator)"
}
```

---


## SUMMARY: IDEAL-STI v3.0 ADAPTIVE SYSTEM

The IDEAL-STI v3.0 system provides adaptive intelligence planning that automatically adjusts complexity and agent involvement based on project scope:

**✅ IMPLEMENTED:**
- ⚡ **SPEED MODE** (5-8 min): Fast-track simple projects with minimal agent coordination
- 📊 **STANDARD MODE** (15-25 min): Full phase flow with strategic parallel agent usage  
- 🔬 **DEEP MODE** (30-45 min): Comprehensive analysis with full parallel agent ecosystem
- 🧠 **Smart Confirmations**: Intelligence-driven decision triggers replace fixed phase boundaries
- 🏗️ **Architecture Checkpoint**: Critical user approval after Phase 7 across all modes
- 🚀 **Parallel Implementation**: Claude Code native parallel subagent patterns for feature development
- 🔄 **Adaptive Execution**: Automatic complexity assessment and mode selection

**🎯 KEY FEATURES:**
- Claude Code parallel subagent syntax: `ask subagent [agent-name] to [task] with arguments: "<prompt-context>"`
- Parallel execution patterns for complex features with wait coordination
- Test-driven development embedded in task generation
- Smart confirmation system that only triggers when analysis demands it
- Comprehensive agent ecosystem with clear coordination patterns

This system ensures optimal planning efficiency while maintaining thoroughness appropriate to project complexity.

