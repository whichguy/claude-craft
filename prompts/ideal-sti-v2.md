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
    
    echo "🧠 Phase 1: Assessing project complexity and selecting execution mode..."
    
    # Analyze input for complexity indicators
    local requirements_count=0
    local tech_complexity=0
    local integration_complexity=0
    local execution_mode=""
    
    # Count requirements indicators
    requirements_count=$(echo "$user_input" | grep -c -i -E "(need|want|should|require|must|feature|functionality)")
    
    # Assess technology complexity
    if echo "$user_input" | grep -q -i -E "(real-time|websocket|microservice|distributed|cloud|scaling|performance|security|enterprise)"; then
        tech_complexity=2
    elif echo "$user_input" | grep -q -i -E "(database|api|authentication|integration)"; then
        tech_complexity=1
    fi
    
    # Assess integration complexity  
    if echo "$user_input" | grep -q -i -E "(integrate with|existing|legacy|migration|sso|compliance|audit)"; then
        integration_complexity=2
    elif echo "$user_input" | grep -q -i -E "(connect to|sync|import|export)"; then
        integration_complexity=1
    fi
    
    # Calculate total complexity score
    local total_complexity=$((requirements_count + tech_complexity + integration_complexity))
    
    # Select execution mode based on complexity
    if [ $total_complexity -le 5 ]; then
        execution_mode="SPEED"
    elif [ $total_complexity -le 15 ]; then
        execution_mode="STANDARD"  
    else
        execution_mode="DEEP"
    fi
    
    # Create assessment document
    cat > "$assessment_output" << EOF
# Complexity Assessment & Mode Selection

## Input Analysis
**Original Request**: $user_input

## Complexity Scoring
- **Requirements Count**: $requirements_count indicators
- **Technology Complexity**: $tech_complexity (0=simple, 1=medium, 2=complex)
- **Integration Complexity**: $integration_complexity (0=simple, 1=medium, 2=complex)
- **Total Complexity Score**: $total_complexity

## Selected Execution Mode: $execution_mode

### Mode Characteristics:
$(case $execution_mode in
    "SPEED")
        echo "- **Duration**: 5-8 minutes total discovery"
        echo "- **Agent Usage**: Minimal, built-in intelligence preferred"
        echo "- **Confirmations**: Only if major conflicts detected"
        echo "- **Output**: Consolidated discovery document"
        ;;
    "STANDARD")
        echo "- **Duration**: 15-25 minutes total discovery"
        echo "- **Agent Usage**: Strategic invocation of tech-research-analyst when needed"
        echo "- **Confirmations**: Smart triggers for scope/tech/assumptions"
        echo "- **Output**: Standard phase documents"
        ;;
    "DEEP")
        echo "- **Duration**: 30-45 minutes comprehensive analysis"
        echo "- **Agent Usage**: Parallel agents for thorough research"
        echo "- **Confirmations**: Both smart triggers and phase boundaries"
        echo "- **Output**: Extended analysis with multiple perspectives"
        ;;
esac)

## Execution Plan
Ready to execute $(echo "$execution_mode" | tr '[:upper:]' '[:lower:]') mode discovery phases.
EOF
    
    echo "✅ Complexity assessment complete: $execution_mode mode selected"
    echo "🎯 Executing $execution_mode mode discovery..."
    
    # Execute appropriate mode
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

# Bridge discovery outputs to standard phase input format
standardize_discovery_outputs() {
    local mode="$1"
    local main_dir="$(pwd)"
    
    echo "🔗 Standardizing $mode mode outputs for phase integration..."
    
    # Create standardized discovery document for phases 5-7
    case "$mode" in
        "speed")
            if [ -f "docs/planning/2-discovery-analysis.md" ]; then
                cp "docs/planning/2-discovery-analysis.md" "docs/planning/discovery-summary.md"
            fi
            ;;
        "standard"|"deep")
            # Aggregate parallel analysis results
            cat > "docs/planning/discovery-summary.md" << EOF
# Discovery Phase Summary

## Stakeholder Analysis
$(find docs/planning/ -name "*stakeholder*" -exec cat {} \; 2>/dev/null || echo "- Analysis completed via parallel agents")

## Technology Research  
$(find docs/planning/ -name "*technology*" -o -name "*tech-research*" -exec cat {} \; 2>/dev/null || echo "- Research completed via tech-research-analyst")

## Architecture Considerations
$(find docs/planning/ -name "*architecture*" -o -name "*synthesis*" -exec cat {} \; 2>/dev/null || echo "- Analysis completed via system-architect")

## Requirements Foundation
$(find docs/planning/ -name "*requirements*" -o -name "*comprehensive*" -exec cat {} \; 2>/dev/null || echo "- Requirements identified through discovery process")
EOF
            ;;
    esac
    
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
        
        # Step 4: Requirements satisfaction assessment
        assess_requirements_satisfaction $refinement_iteration
        
        # Check if we should continue refinement
        if [ -f "docs/planning/requirements-satisfaction-$refinement_iteration.md" ]; then
            if grep -q "SATISFIED.*true" "docs/planning/requirements-satisfaction-$refinement_iteration.md"; then
                requirements_satisfied="true"
                echo "✅ Requirements refinement achieved satisfaction criteria"
            else
                echo "🔄 Requirements need further refinement..."
                refinement_iteration=$((refinement_iteration + 1))
            fi
        else
            refinement_iteration=$((refinement_iteration + 1))
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

**SATISFACTION CRITERIA ASSESSMENT:**

Evaluate whether requirements understanding has reached sufficient maturity:

### Completeness Criteria (each must score ≥8/10):
1. **Functional Coverage** (8-10): Do we understand all major functional requirements?
2. **Use Case Completeness** (8-10): Have we identified the important unstated use cases?
3. **Boundary Clarity** (8-10): Are scope boundaries clearly defined via anti-cases?
4. **Technology Fit** (8-10): Do technology choices align with all use case needs?
5. **NFR Definition** (8-10): Are non-functional requirements clearly specified?
6. **Risk Understanding** (8-10): Are major technical and business risks identified?
7. **Scalability Planning** (8-10): Are scaling requirements and constraints clear?
8. **Integration Planning** (8-10): Are integration points and requirements clear?

### NFR (Non-Functional Requirements) Completeness Check:
- **Performance**: Response times, throughput, concurrency requirements
- **Scalability**: User growth, data growth, geographic scaling needs
- **Security**: Authentication, authorization, data protection, compliance
- **Reliability**: Uptime, error rates, disaster recovery requirements  
- **Usability**: User experience, accessibility, internationalization needs
- **Maintainability**: Code quality, documentation, testing requirements
- **Portability**: Platform independence, cloud portability needs
- **Compliance**: Regulatory, industry standard, organizational policy requirements

### Required Output Format:
- **Overall Satisfaction Score**: X/80 (sum of all criteria scores)
- **SATISFIED**: true/false (requires ≥64/80 score)
- **Missing Elements**: List what still needs refinement
- **Refinement Recommendations**: Specific actions for next iteration
- **NFR Gaps**: Specific non-functional requirements needing attention

Generate: docs/planning/requirements-satisfaction-$iteration.md"

    echo "🤖 Task: Use system-architect subagent to assess requirements satisfaction for: <prompt-context>"
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

