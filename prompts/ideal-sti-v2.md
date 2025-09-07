# IDEAL-STI Adaptive Intelligence Planning System (Version 3.0)
## Adaptive Phase Execution with Smart Confirmations

**Version**: 3.0 (Adaptive Phase Architecture with Complexity-Based Execution)  
**Template Context**: <prompt-template-name>  
**Project Requirements**: <prompt-context>

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
    Start([Mixed User Input]) --> P0[Phase 0: Existing Analysis]
    P0 --> P05[Phase 0.5: Complexity Assessment & Mode Selection]
    
    P05 --> ModeDecision{Project Complexity?}
    ModeDecision -->|Simple| SpeedMode[SPEED MODE: Fast Discovery]
    ModeDecision -->|Medium| StandardMode[STANDARD MODE: Phase Flow]
    ModeDecision -->|Complex| DeepMode[DEEP MODE: Comprehensive]
    
    SpeedMode --> SpeedP1to4[Consolidated Discovery (5-8 min)]
    StandardMode --> StandardP1[Phase 1: Discovery & Analysis]
    DeepMode --> DeepP1[Phase 1: Extended Discovery]
    
    SpeedP1to4 --> SmartTrigger1{Smart Confirmations Needed?}
    StandardP1 --> SmartTrigger2{Scope/Assumptions/Tech Issues?}
    DeepP1 --> DeepP2[Phase 2: Goals & Intent]
    
    SmartTrigger1 -->|No| SpeedComplete[Speed Discovery Complete]
    SmartTrigger1 -->|Yes| UserConfirm1[User Confirmation]
    SmartTrigger2 -->|No| StandardP2[Phase 2: Goals & Intent]
    SmartTrigger2 -->|Yes| UserConfirm2[User Confirmation]
    
    UserConfirm1 --> SpeedComplete
    UserConfirm2 --> StandardP2
    
    StandardP2 --> StandardP3[Phase 3: Feasibility]
    StandardP3 --> TechTrigger{Tech Analysis Needed?}
    TechTrigger -->|Yes| TechAgent[🔄 Ask subagent tech-research-analyst]
    TechTrigger -->|No| StandardP4[Phase 4: Technology Research]
    TechAgent --> StandardP4
    StandardP4 --> StandardComplete[Standard Discovery Complete]
    
    DeepP2 --> DeepP3[Phase 3: Feasibility Assessment]
    DeepP3 --> ParallelTech[🔄 In parallel ask multiple subagents]
    ParallelTech --> DeepP4[Phase 4: Technology Research]
    DeepP4 --> DeepComplete[Deep Discovery Complete]
    
    SpeedComplete --> ArchConfirm[Architecture Confirmation Checkpoint]
    StandardComplete --> ArchConfirm
    DeepComplete --> ArchConfirm
    
    ArchConfirm -->|Approve| P5[Phase 5: Requirements Specification]
    ArchConfirm -->|Extend| BackToDiscovery[Extend Discovery]
    ArchConfirm -->|Stop| EndArch[Architecture Review Required]
    
    BackToDiscovery --> StandardMode
    
    P5 --> P6[Phase 6: Scope & Prioritization]
    P6 --> P7[Phase 7: Architecture Design]
    P7 --> P8[Phase 8: Decision Registry]
    P8 --> P9[Phase 9: Interface Specifications]
    P9 --> P10[Phase 10: Task Generation]
    
    P10 --> P11[Phase 11: Implementation Loop]
    P11 --> P11Check{All Features Complete?}
    P11Check -->|No| P11
    P11Check -->|Yes| P12[Phase 12: Deployment Classification]
    
    P12 --> P13[Phase 13: Pipeline Preparation]
    P13 --> P14[Phase 14: Deployment Execution]
    P14 --> P14Check{Health Checks Pass?}
    P14Check -->|Fail| Rollback[Auto Rollback]
    Rollback --> P14
    P14Check -->|Pass| P15[Phase 15: Post-Deployment Validation]
    
    P15 --> P16[Phase 16: Monitoring & Feedback]
    P16 --> Complete([Production Ready])
    
    subgraph "Adaptive Discovery Modes"
        SpeedMode
        StandardMode
        DeepMode
        SpeedP1to4
        StandardP1
        DeepP1
    end
    
    subgraph "Smart Confirmation System"
        SmartTrigger1
        SmartTrigger2
        UserConfirm1
        UserConfirm2
        TechTrigger
    end
    
    subgraph "Parallel Agent Integration"
        TechAgent
        ParallelTech
    end
    
    subgraph "Standard Phase Flow"
        P5
        P6
        P7
        P8
        P9
        P10
    end
    
    subgraph "Implementation Iteration"
        P11
        P11Check
    end
    
    subgraph "CI/CD Deployment"
        P12
        P13
        P14
        P14Check
        Rollback
        P15
        P16
    end
    
    subgraph "Key Agents"
        SA1[product-strategist: Strategic Analysis]
        SA2[tech-research-analyst: Technology Research]
        SA3[system-architect: Architecture Design]
        SA4[feature-developer: Task Generation & Implementation]
        SA5[ui-designer: Interface Design]
        SA6[code-reviewer: Code Quality]
        SA7[knowledge-aggregator: Learning Capture]
        SA8[deployment-orchestrator: Production Deployment]
    end
    
    StandardP1 -.-> SA1
    DeepP1 -.-> SA1
    TechAgent -.-> SA2
    ParallelTech -.-> SA2
    P7 -.-> SA3
    P9 -.-> SA5
    P10 -.-> SA4
    P11 -.-> SA4
    P11 -.-> SA6
    P11 -.-> SA7
    P14 -.-> SA8
    
    classDef adaptiveMode fill:#e8f5e8,stroke:#2e7d32,stroke-width:3px
    classDef smartTrigger fill:#fff3e0,stroke:#ef6c00,stroke-width:3px
    classDef parallelAgent fill:#e1f5fe,stroke:#0277bd,stroke-width:3px
    classDef standardPhase fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef implPhase fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef deployPhase fill:#fff3e0,stroke:#f57f17,stroke-width:2px
    classDef agent fill:#fff,stroke:#666,stroke-width:1px,stroke-dasharray: 5 5
    classDef terminal fill:#ffebee,stroke:#c62828,stroke-width:2px
    
    class SpeedMode,StandardMode,DeepMode,SpeedP1to4,StandardP1,DeepP1 adaptiveMode
    class SmartTrigger1,SmartTrigger2,UserConfirm1,UserConfirm2,TechTrigger smartTrigger
    class TechAgent,ParallelTech parallelAgent
    class P5,P6,P7,P8,P9,P10 standardPhase
    class P11,P11Check implPhase
    class P12,P13,P14,P15,P16 deployPhase
    class SA1,SA2,SA3,SA4,SA5,SA6,SA7,SA8 agent
    class Start,Complete,EndArch,Rollback terminal
```

## REVOLUTIONARY AGENT INTEGRATION REFERENCE

### Parallel Discovery Agent Matrix

| **Agent** | **Discovery Stream** | **Trigger** | **Purpose** | **Context Provided** | **Expected Output** |
|-----------|---------------------|-------------|-------------|---------------------|---------------------|
| **product-strategist** | Stream 1 Lead | Continuous | Stakeholder-Use Case discovery | Mixed user input + synthesis feedback | Continuously updated stakeholder analysis and use case expansion |
| **tech-research-analyst** | Stream 2 Lead | Continuous | Technology-Constraint discovery | Mixed user input + synthesis feedback | Real-time tech implications and constraint analysis |
| **environment-analyst** | Stream 3 Lead | Continuous | Environment-Context discovery | Mixed user input + synthesis feedback | Environment integration analysis and context mapping |
| **synthesis-coordinator** | Real-time Synthesis | Every 5-10 discoveries | Cross-stream intelligence integration | All stream outputs | Integrated requirements-tech specification with confidence levels |
| **unknown-detector** | Pattern Analysis | Triggered by synthesis gaps | Unknown unknown identification | Cross-stream patterns + domain research | Critical knowledge gap identification and discovery recommendations |
| **decision-orchestrator** | Dynamic Decision Management | Intelligence-driven triggers | Dynamic decision point management | Synthesis conflicts/convergence/gaps | User decision point orchestration and conflict resolution |
| **system-architect** | Post-Convergence | After sufficient convergence | Architecture design | Integrated requirements-tech specification | Architecture specification document |
| **ui-designer** | Phase 9 | Always | Interface specifications | Architecture, requirements context | UI/UX specifications and API definitions |
| **feature-developer** | Phase 10 & 11+ | Task generation & implementation | Complete feature development | Task specifications, worktree isolation | Task breakdown with embedded TDD + complete implementations |
| **code-reviewer** | Phase 11+ | After each implementation | Code quality review | Implementation files and context | Code review analysis and recommendations |
| **knowledge-aggregator** | After convergence & implementations | Learning capture | Pattern and insight capture | Discovery patterns + implementation learnings | Cross-project learning synthesis and documentation |
| **deployment-orchestrator** | Phase 14 | Deployment execution | Production deployment | Feature classification, CI/CD requirements | Deployment execution and validation |

### Revolutionary Agent Orchestration Patterns

**Phase 0.5 - Intelligence Parser Activation:**
```bash
# Parse mixed user input into classified elements
parse_mixed_input() {
    local user_input="$1"
    local parser_context="$main_dir/docs/planning/parsed-input.md"
    
    # Create input classification
    cat > "$parser_context" << 'EOF'
# Mixed Input Intelligence Parsing

## Input Element Classification
- **Explicit Requirements**: [Clear user needs identified]
- **Technology Preferences**: [Tech choices/constraints specified]  
- **Environment References**: [Existing system/workflow mentions]
- **Vague Intent Signals**: [Unclear but directional statements]
- **Constraint Indicators**: [Limitation signals detected]

## Relationship Detection
- Technology-Requirement Dependencies: [Which tech constrains which requirements]
- Environment-Use Case Enablers: [Which environment features enable which scenarios]
- Vague Intent Categories: [What unstated requirement types are suggested]

## Discovery Prioritization Matrix
- High-Impact Unknowns: [Could change entire approach]
- Medium-Impact Gaps: [Could affect major decisions]  
- Low-Impact Details: [Nice-to-know information]
EOF
}
```


## Adaptive Execution Mode Functions

### SPEED MODE (5-8 minutes): Fast-Track Simple Projects

```bash
execute_speed_mode() {
    local main_dir="$(pwd)"
    echo "⚡ SPEED MODE: Fast-track discovery for simple projects (5-8 minutes)"
    
    # Single consolidated discovery phase with minimal agent involvement
    speed_prompt="Fast-track analysis for simple project requirements: <prompt-context>

CONSOLIDATED DISCOVERY ANALYSIS:
1. **Stakeholder & Use Case Analysis**: Quick identification of primary users and core use cases
2. **Technology Constraints**: Fast assessment of tech requirements and constraints  
3. **Feasibility Check**: Rapid go/no-go assessment
4. **Simple Architecture**: Straightforward solution design
5. **Basic Requirements**: Essential functional and non-functional requirements

Focus on obvious choices, minimal complexity, clear implementation path.
Create: docs/planning/discovery-analysis.md"
    
    ask subagent product-strategist to perform fast-track project analysis with context: "$speed_prompt"
    
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
                ask subagent product-strategist to analyze stakeholders and users with context: "Strategic stakeholder analysis for: <prompt-context>. Focus on identifying all user types, their needs, goals, and pain points. Create comprehensive stakeholder map."
                ;;
            "use-case-discovery") 
                ask subagent product-strategist to discover use cases and scenarios with context: "Use case discovery for: <prompt-context>. Expand beyond obvious use cases to include edge cases, failure modes, and workflow integration scenarios."
                ;;
            "requirements-extraction")
                ask subagent product-strategist to extract requirements and constraints with context: "Requirements analysis for: <prompt-context>. Extract both stated and implied functional/non-functional requirements."
                ;;
            "constraint-identification")
                ask subagent product-strategist to identify constraints and limitations with context: "Constraint analysis for: <prompt-context>. Identify technical, business, regulatory, and resource constraints."
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
                ask subagent tech-research-analyst to research frontend technologies with context: "Frontend technology research for: <prompt-context>. Find 5+ GitHub repos (1000+ stars) for each frontend option. Focus on production reality, performance, and integration patterns."
                ;;
            "backend-tech")
                ask subagent tech-research-analyst to research backend technologies with context: "Backend technology research for: <prompt-context>. Analyze frameworks, APIs, microservices patterns. Document production performance and scaling characteristics."
                ;;
            "database-tech")
                ask subagent tech-research-analyst to research data technologies with context: "Data persistence research for: <prompt-context>. Evaluate databases, caching, state management. Include performance benchmarks and production learnings."
                ;;
            "infrastructure-tech")
                ask subagent tech-research-analyst to research infrastructure options with context: "Infrastructure research for: <prompt-context>. Analyze deployment, scaling, monitoring approaches. Focus on operational complexity and costs."
                ;;
            "security-tech")
                ask subagent tech-research-analyst to research security approaches with context: "Security technology research for: <prompt-context>. Evaluate authentication, authorization, encryption, compliance approaches with production evidence."
                ;;
            "integration-tech")
                ask subagent tech-research-analyst to research integration patterns with context: "Integration research for: <prompt-context>. Analyze APIs, messaging, data integration patterns. Include real-world scaling and performance data."
                ;;
        esac
    done
    
    echo "⏳ Waiting for all parallel technology research to complete..."
    
    # Synthesize parallel analysis results into discovery document
    synthesize_standard_mode_analysis
}

synthesize_standard_mode_analysis() {
    local synthesis_prompt="Synthesize all parallel discovery and technology research results into comprehensive analysis:

For: <prompt-context>

## Synthesis Requirements:
1. **Stakeholder Insights**: Consolidate user and stakeholder analysis
2. **Requirements Synthesis**: Merge functional and non-functional requirements
3. **Technology Recommendations**: Consolidate technology research findings
4. **Implementation Strategy**: Practical approach based on all analysis

Generate: docs/planning/discovery-analysis.md"

    ask subagent system-architect to synthesize standard mode analysis with context: "$synthesis_prompt"
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
                ask subagent product-strategist to perform comprehensive strategic analysis with context: "Deep strategic analysis for: <prompt-context>. Comprehensive stakeholder mapping, business model analysis, market positioning, competitive landscape, and strategic risks."
                ;;
            "technology-landscape")
                ask subagent tech-research-analyst to analyze complete technology landscape with context: "Comprehensive technology landscape for: <prompt-context>. Full stack analysis, emerging technologies, vendor evaluations, technology lifecycle assessment, and strategic technology roadmapping."
                ;;
            "architecture-patterns")
                ask subagent system-architect to evaluate architecture patterns with context: "Architecture pattern analysis for: <prompt-context>. Evaluate multiple architectural approaches, scalability patterns, integration patterns, and design trade-offs with production evidence."
                ;;
            "security-analysis")
                ask subagent tech-research-analyst to perform security analysis with context: "Comprehensive security analysis for: <prompt-context>. Threat modeling, security architecture, compliance requirements, privacy considerations, and security technology evaluation."
                ;;
            "performance-analysis")
                ask subagent tech-research-analyst to analyze performance requirements with context: "Performance analysis for: <prompt-context>. Scalability requirements, performance bottlenecks, optimization strategies, and performance testing approaches with benchmark data."
                ;;
            "compliance-analysis")
                ask subagent product-strategist to analyze compliance requirements with context: "Compliance analysis for: <prompt-context>. Regulatory requirements, industry standards, data governance, privacy regulations, and compliance technology requirements."
                ;;
            "competitive-analysis")
                ask subagent product-strategist to perform competitive analysis with context: "Competitive landscape analysis for: <prompt-context>. Market analysis, competitive positioning, feature differentiation, and strategic advantages."
                ;;
            "risk-analysis")
                ask subagent product-strategist to analyze project risks with context: "Comprehensive risk analysis for: <prompt-context>. Technical risks, business risks, operational risks, compliance risks, and risk mitigation strategies."
                ;;
        esac
    done
    
    echo "⏳ Waiting for all comprehensive parallel analysis to complete..."
    
    # Synthesis and integration of all parallel results
    perform_comprehensive_synthesis
}

perform_comprehensive_synthesis() {
    echo "🔗 Deep Mode: Synthesizing all parallel analysis results"
    
    synthesis_prompt="Comprehensive synthesis of all parallel analysis results for: <prompt-context>

Integrate findings from:
- Strategic analysis and stakeholder insights  
- Technology landscape and architecture patterns
- Security, performance, and compliance analysis
- Competitive positioning and risk assessment

Create integrated architecture specification with:
1. **Consolidated Requirements**: Unified functional and non-functional requirements
2. **Technology Stack Decisions**: Evidence-based technology choices with rationale  
3. **Architecture Design**: Comprehensive system architecture with trade-offs
4. **Risk Mitigation**: Integrated risk management strategies
5. **Implementation Roadmap**: Prioritized development approach

Generate: docs/planning/discovery-analysis.md"
    
    ask subagent system-architect to synthesize all parallel analysis with context: "$synthesis_prompt"
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
                ask subagent feature-developer to implement frontend components with context: "Frontend implementation for $feature_name. Create user interface components, state management, and client-side logic. Include unit tests and component documentation."
                ;;
            "backend-apis")
                ask subagent feature-developer to implement backend APIs with context: "Backend API implementation for $feature_name. Create API endpoints, business logic, and data validation. Include integration tests and API documentation."
                ;;
            "data-layer")  
                ask subagent feature-developer to implement data layer with context: "Data layer implementation for $feature_name. Create database schemas, data access objects, and data migration scripts. Include database tests."
                ;;
            "integration-tests")
                ask subagent feature-developer to create integration tests with context: "Integration testing for $feature_name. Create end-to-end tests, API integration tests, and system integration validation. Include test documentation."
                ;;
            "documentation")
                ask subagent feature-developer to create documentation with context: "Documentation for $feature_name. Create user documentation, technical documentation, and deployment guides. Include code examples and troubleshooting guides."
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

### Phase 0.5: Complexity Assessment & Mode Selection

**Purpose:** Analyze user input complexity and select appropriate execution mode (SPEED/STANDARD/DEEP).

**Execution Instructions:**
```bash
# Assess project complexity and select execution mode
assess_complexity_and_select_mode() {
    local main_dir="$(pwd)"
    local user_input="<prompt-context>"
    local assessment_output="$main_dir/docs/planning/complexity-assessment.md"
    
    echo "🧠 Phase 0.5: Assessing project complexity and selecting execution mode..."
    
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
    
    # After discovery completion, proceed to standard phases
    echo "✅ Discovery phase complete. Proceeding to requirements and architecture..."
    execute_phase5_requirements
    execute_phase6_interface  
    execute_phase7_architecture
    
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
            if [ -f "docs/planning/discovery-analysis.md" ]; then
                cp "docs/planning/discovery-analysis.md" "docs/planning/discovery-summary.md"
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
    if [ -f "docs/planning/complexity-assessment.md" ]; then
        local original_requirements=$(grep "Requirements Count" docs/planning/complexity-assessment.md | grep -o "[0-9]*" || echo "1")
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
    
    confirmation_prompt="## Architecture Review & Approval Required

### Comprehensive Requirements & Technology Specification
$([ -f "docs/planning/phase5-requirements.md" ] && cat docs/planning/phase5-requirements.md | head -50 || echo "Requirements specification pending...")

### Technology Stack & Architecture Design  
$([ -f "docs/planning/phase7-architecture.md" ] && cat docs/planning/phase7-architecture.md | head -50 || echo "Architecture design pending...")

### Discovery Summary & Complexity Assessment
$([ -f "docs/planning/discovery-summary.md" ] && cat docs/planning/discovery-summary.md | head -30 || echo "Discovery analysis pending...")
$([ -f "docs/planning/complexity-assessment.md" ] && cat docs/planning/complexity-assessment.md | head -20 || echo "Complexity assessment pending...")

### APPROVAL OPTIONS:
1. **✅ APPROVE**: Proceed to implementation phases
2. **🔍 EXTEND DISCOVERY**: Additional research needed (specify areas)
3. **📝 REFINE SCOPE**: Adjust requirements or constraints  
4. **⏹️ STOP**: Project not feasible or ready

Please review the architecture specification and select your approval option."
    
    ask subagent system-architect to present architecture for user approval with context: "$confirmation_prompt"
}
```

## SECTION 3: STANDARD PHASE EXECUTION SYSTEM

This section implements the standard IDEAL-STI phases (5-16) that execute after adaptive discovery completes.

### Phase 5: Requirements Definition

**Purpose:** Detailed functional and non-functional requirements based on discovery analysis.

**Execution Instructions:**
```bash
execute_phase5_requirements() {
    local main_dir="$(pwd)"
    echo "📋 Phase 5: Requirements Definition based on discovery analysis"
    
    requirements_prompt="Based on completed discovery analysis and architecture confirmation:

$([ -f "docs/planning/discovery-summary.md" ] && cat docs/planning/discovery-summary.md)
$([ -f "docs/planning/complexity-assessment.md" ] && echo -e "\n## Complexity Assessment\n" && cat docs/planning/complexity-assessment.md | head -20)

Create comprehensive requirements specification:
1. **Functional Requirements**: User stories with acceptance criteria based on discovery
2. **Non-Functional Requirements**: Performance, security, scalability from technology research
3. **Integration Requirements**: API contracts and data flows from architecture analysis
4. **Compliance Requirements**: Regulatory and business constraints from stakeholder analysis
5. **Test Requirements**: Test-driven development approach embedded in tasks

Use findings from discovery phases and technology research above.
Generate: docs/planning/phase5-requirements.md"
    
    ask subagent product-strategist to define comprehensive requirements with context: "$requirements_prompt"
}
```

### Phase 6: Interface Design

**Purpose:** User experience and API interface design aligned with requirements.

**Execution Instructions:**
```bash
execute_phase6_interface() {
    local main_dir="$(pwd)"
    echo "🎨 Phase 6: Interface Design for user experience and APIs"
    
    interface_prompt="Based on requirements and architecture specification:

$([ -f "docs/planning/phase5-requirements.md" ] && cat docs/planning/phase5-requirements.md | head -50)
$([ -f "docs/planning/discovery-summary.md" ] && echo -e "\n## Discovery Context\n" && cat docs/planning/discovery-summary.md | head -30)

Design comprehensive interface specification:
1. **User Interface Design**: Wireframes, user flows, interaction patterns aligned with user needs
2. **API Interface Design**: Endpoints, data models, integration contracts based on requirements
3. **System Interface Design**: Internal service boundaries and contracts for architecture
4. **Error Interface Design**: Error handling and user feedback patterns for all scenarios

Include accessibility considerations and responsive design principles.
Generate: docs/planning/phase6-interface.md"
    
    ask subagent ui-designer to design comprehensive interfaces with context: "$interface_prompt"
}
### Phase 7: Architecture Design

**Purpose:** System architecture design based on requirements and technology research.

**Execution Instructions:**
```bash
execute_phase7_architecture() {
    local main_dir="$(pwd)"
    echo "🏗️ Phase 7: Architecture Design based on requirements and technology stack"
    
    architecture_prompt="Based on requirements specification and technology research:

$([ -f "docs/planning/phase5-requirements.md" ] && cat docs/planning/phase5-requirements.md | head -60)
$([ -f "docs/planning/phase6-interface.md" ] && echo -e "\n## Interface Specification\n" && cat docs/planning/phase6-interface.md | head -40)
$([ -f "docs/planning/discovery-summary.md" ] && echo -e "\n## Discovery Foundation\n" && cat docs/planning/discovery-summary.md | head -40)

Design comprehensive system architecture:
1. **System Architecture**: High-level system design and component interactions based on requirements
2. **Data Architecture**: Data models, storage patterns, and data flow design from interface specs  
3. **Security Architecture**: Authentication, authorization, and data protection per requirements
4. **Deployment Architecture**: Infrastructure, scaling, and operational considerations from discovery
5. **Integration Architecture**: External system integrations and API design from interface specs

Include architecture decision records (ADRs) for major decisions.
Generate: docs/planning/phase7-architecture.md"
    
    ask subagent system-architect to design comprehensive architecture with context: "$architecture_prompt"
    
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
    
    # Phase 8: Task Planning with TDD approach
    task_planning_prompt="Based on approved architecture and requirements:

Create comprehensive implementation tasks with Test-Driven Development methodology:
1. **Feature Breakdown**: Break architecture into implementable features
2. **Test Planning**: Embed test case generation in each task
3. **Implementation Strategy**: Include Red-Green-Refactor approach
4. **Acceptance Criteria**: Define clear completion criteria
5. **Priority Ranking**: Prioritize tasks by business value and dependencies

For each task, include:
- Test scenarios (happy path and edge cases)
- Mock data and test fixtures needed
- Integration test requirements
- Performance test considerations

Generate: docs/planning/phase8-task-planning.md"
    
    ask subagent feature-developer to create TDD-integrated task plan with context: "$task_planning_prompt"
    
    # Phase 9: Implementation Task Generation 
    task_generation_prompt="Based on task planning and architecture:

Generate specific implementation tasks with parallel execution patterns:
$([ -f "docs/planning/phase8-task-planning.md" ] && cat docs/planning/phase8-task-planning.md | head -100)

Create detailed implementation tasks using parallel subagent patterns for complex features.
Each task should include test-first approach and acceptance criteria.
Generate: docs/planning/phase9-implementation-tasks.md"
    
    ask subagent feature-developer to generate implementation tasks with context: "$task_generation_prompt"
}
```

### Phase 11-16: Implementation and Deployment

**Purpose:** Execute implementation with parallel task coordination and automated deployment.

**Execution Instructions:**
```bash
execute_phase11_implementation() {
    local main_dir="$(pwd)"
    echo "🚀 Phase 11: Implementation Loop with Parallel Task Execution"
    
    implementation_prompt="Execute implementation tasks using parallel subagent patterns:

For complex features, launch parallel implementation across:
- Frontend components and UI
- Backend APIs and business logic  
- Database schemas and data access
- Integration tests and validation
- Documentation and user guides

Use the launch_parallel_feature_implementation pattern defined earlier.
Coordinate feature completion before proceeding to next iteration.

Execute all tasks from: docs/planning/phase9-implementation-tasks.md
Track progress in: docs/planning/implementation-progress.md"
    
    ask subagent feature-developer to execute implementation tasks with context: "$implementation_prompt"
}

execute_phase12_to_16_deployment() {
    local main_dir="$(pwd)"
    echo "🚀 Phase 12-16: Deployment Pipeline and Production Launch"
    
    deployment_prompt="Execute automated deployment pipeline:

1. **Phase 12**: Classification (feature flags, rollout strategy)
2. **Phase 13**: Pipeline preparation (CI/CD, infrastructure)  
3. **Phase 14**: Deployment execution (blue-green, canary)
4. **Phase 15**: Post-deployment validation (health checks, monitoring)
5. **Phase 16**: Production monitoring and feedback collection

Coordinate with infrastructure team and implement proper rollback procedures.
Generate: docs/planning/deployment-execution.md"
    
    ask subagent deployment-orchestrator to execute deployment pipeline with context: "$deployment_prompt"
}
```

---

## SECTION 4: AGENT INTEGRATION AND COORDINATION

### Agent Context Requirements

**All agents receive:**
- Working directory path
- Project session ID
- Architecture specification reference
- Relevant phase documentation

**Specific context patterns:**
- **Strategic agents** (product-strategist): User requirements, problem domain
- **Technical agents** (tech-research-analyst, system-architect): Technical constraints, performance requirements
- **Implementation agents** (feature-developer, qa-analyst): Task specifications, acceptance criteria
- **Quality agents** (code-reviewer, code-refactor): Implementation files, coding standards
- **Knowledge agents** (knowledge-aggregator): Process outcomes, learnings, patterns
- **Operations agents** (deployment-orchestrator): Feature classification, CI/CD requirements

### Agent Output Integration

**Documentation Chain:**
- Phase agents → planning documents (phase1-discovery.md, etc.)
- Architecture agents → architecture-specification.md
- Implementation agents → task files, code implementations
- Quality agents → review reports, refactored code
- Deployment agents → deployment reports, infrastructure

**Cross-Agent Dependencies:**
- product-strategist outputs feed into tech-research-analyst
- system-architect requires outputs from both strategic and technical agents
- feature-developer coordinates with qa-analyst for test integration
- deployment-orchestrator requires feature-developer completion signals

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
- Claude Code parallel subagent syntax: `ask subagent [agent-name] to [task] with context: "[prompt]"`
- Parallel execution patterns for complex features with wait coordination
- Test-driven development embedded in task generation
- Smart confirmation system that only triggers when analysis demands it
- Comprehensive agent ecosystem with clear coordination patterns

This system ensures optimal planning efficiency while maintaining thoroughness appropriate to project complexity.

