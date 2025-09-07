# UI Designer Test Prompt (Updated for Enhanced Agent)

Test the ui-designer subagent with comprehensive validation of all 17 phases and new capabilities.

## Test Parameters
- **target_file**: "src/components/UserProfile.jsx" 
- **task_name**: "user-profile-dashboard"
- **worktree_dir**: "/tmp/test-worktree"
- **dryrun**: "false"

## New Features to Test
- ✅ 17-phase execution pipeline (0-16)
- ✅ Enhanced error handling and dependency validation
- ✅ Progress tracking with phase completion indicators
- ✅ Optimized file operations with batch processing
- ✅ Dynamic runtime decision making for frameworks/styling

## Expected Context Files
The ui-designer should rehydrate from these mock IDEAL-STI files:

### Mock phase7-architecture.md
```
# Architecture Decisions

## Frontend Framework
- **Selected**: React 18 with TypeScript
- **State Management**: Zustand for global state
- **Styling**: Tailwind CSS with custom components
- **Component Architecture**: Atomic design principles
```

### Mock phase4-tech-research.md  
```
# Technology Stack

## Frontend Technologies
- React 18.2.0
- TypeScript 5.0
- Tailwind CSS 3.3
- Headless UI components
- React Hook Form for form management
```

## Expected Agent Call
```bash
ask subagent ui-designer "src/components/UserProfile.jsx" "user-profile-dashboard" "/tmp/test-worktree" "false"
```

## Test Setup Requirements
Create the following directory structure for comprehensive testing:

```bash
mkdir -p "/tmp/test-worktree/docs/planning"
mkdir -p "/tmp/test-worktree/src/components"
mkdir -p "/tmp/test-worktree/tasks/in-progress"

# Create minimal task file
cat > "/tmp/test-worktree/tasks/in-progress/user-profile-dashboard.md" << 'EOF'
# User Profile Dashboard

## Description
Create a comprehensive user profile dashboard component with authentication, editing capabilities, and responsive design.

## Acceptance Criteria
- [ ] Display user information (name, email, avatar)
- [ ] Enable profile editing with form validation
- [ ] Support avatar upload functionality  
- [ ] Implement responsive design for mobile/desktop
- [ ] Handle loading and error states
- [ ] Integrate with authentication system

## Epic: user-management
## Story: profile-dashboard
## Priority: high
EOF
```

## Expected Outputs to Validate

### 1. Enhanced Progress Tracking
**Expected Console Output**:
```
✅ PHASE 1/17: IDEAL-STI Context Rehydration completed
✅ PHASE 2/17: Use Case & Persona Analysis completed
...
✅ PHASE 17/17: Return Status to Feature-Developer completed
```

### 2. Comprehensive Context Files
**Expected Files**:
- `docs/planning/ui-full-context-rehydration-user-profile-dashboard.md`
- `docs/planning/ui-use-case-analysis-user-profile-dashboard.md` 
- `docs/planning/ui-architectural-decisions-user-profile-dashboard.md`
- `docs/planning/ui-research-results-user-profile-dashboard.md`
- `docs/planning/ui-authentication-analysis-user-profile-dashboard.md`
- `docs/planning/ui-responsive-strategy-user-profile-dashboard.md`
- `docs/planning/ui-debugging-strategy-user-profile-dashboard.md`
- `docs/planning/ui-framework-setup-user-profile-dashboard.md`

### 3. Final UI Specification
**Expected**: `docs/planning/ui-specs/UserProfile.jsx-ui-spec.md`
**Should contain**:
- Component hierarchy based on dynamic analysis
- Props interface with TypeScript definitions
- Zustand state management integration
- Tailwind CSS responsive classes
- WCAG 2.1 AA accessibility compliance
- Authentication state handling
- Mobile-first responsive breakpoints

### 4. Structured Return Data
**Expected**: `docs/planning/ui-return-data-user-profile-dashboard.json`
**Should contain**:
```json
{
  "ui_design_complete": true,
  "target_file": "src/components/UserProfile.jsx",
  "task_name": "user-profile-dashboard",
  "component_name": "UserProfile",
  "architecture_decisions": {
    "framework": "React",
    "framework_reason": "Existing project consistency",
    "styling": "Tailwind CSS",
    "styling_reason": "IDEAL-STI architecture specification"
  },
  "implementation_files": [...],
  "dependencies_to_install": [...],
  "setup_commands": [...],
  "breakpoints": {...}
}
```

### 5. Error Handling Validation
**Test missing dependencies**:
```bash
# Should fail with clear error message
ask subagent ui-designer "" "user-profile-dashboard" "/tmp/test-worktree" "false"
# Expected: "❌ Missing critical dependencies: target_file"
```

## Enhanced Validation Criteria

### Core Functionality
- [ ] All 17 phases execute in correct sequence (0-16)
- [ ] Progress tracking displays "✅ PHASE X/17: [name] completed"
- [ ] Enhanced error handling catches missing dependencies
- [ ] File operations use batch processing for performance
- [ ] Dynamic framework decisions based on runtime analysis

### Output Quality
- [ ] 8+ context analysis files are created with comprehensive content
- [ ] UI specification integrates architectural decisions from Phase 7
- [ ] Web research provides cost-effective GitHub/Reddit insights
- [ ] Structured JSON return data with complete implementation guidance
- [ ] Authentication and responsive design strategies documented

### Error Handling Tests
- [ ] Missing target_file parameter triggers clear error message
- [ ] Missing worktree_dir parameter exits with validation error
- [ ] Invalid directory paths are caught and reported
- [ ] Graceful fallback when IDEAL-STI context files are missing

### Performance & Reliability
- [ ] File paths use full worktree paths (no cd/pushd usage)
- [ ] Batch file operations reduce I/O overhead
- [ ] Phase execution is atomic and resumable
- [ ] Knowledge aggregator integration works properly

## Success Metrics

### Performance
- Agent completes full 17-phase pipeline in < 45 seconds
- Progress tracking provides clear visibility into execution status
- Error messages are actionable and specific

### Output Quality
- UI specification is implementation-ready with concrete guidance
- Architecture decisions are intelligently made based on existing context
- Research insights provide practical, cost-effective solutions
- Return data JSON is valid and contains all required implementation details

### Integration
- IDEAL-STI context rehydration is comprehensive and accurate
- Dynamic decision-making adapts to project-specific constraints
- Knowledge aggregator captures learnings for future improvements

## Test Execution Command
```bash
# Full test run with setup
/bin/bash -c "
mkdir -p '/tmp/test-worktree/docs/planning'
mkdir -p '/tmp/test-worktree/src/components' 
mkdir -p '/tmp/test-worktree/tasks/in-progress'

# Create task file and IDEAL-STI context
cat > '/tmp/test-worktree/tasks/in-progress/user-profile-dashboard.md' << 'EOF'
# User Profile Dashboard
## Acceptance Criteria  
- [ ] Display user information with avatar
- [ ] Enable profile editing with validation
- [ ] Support responsive design for mobile/desktop
- [ ] Integrate with authentication system
EOF

cat > '/tmp/test-worktree/docs/planning/phase7-architecture.md' << 'EOF'
# Architecture Decisions
## Frontend Framework
- **Selected**: React 18 with TypeScript  
- **State Management**: Zustand
- **Styling**: Tailwind CSS
EOF

# Execute the ui-designer test
ask subagent ui-designer 'src/components/UserProfile.jsx' 'user-profile-dashboard' '/tmp/test-worktree' 'false'
"
```