# Feature Developer Agent Validation Checklist

Use this checklist to validate agent behavior and identify areas for improvement.

## Pre-Test Setup Validation

### Environment Check
```bash
# Verify agents are properly symlinked
!ls -la ~/.claude/agents/ | grep feature-developer
!ls -la ~/.claude/agents/ | grep ui-designer
!ls -la ~/.claude/agents/ | grep qa-analyst
!ls -la ~/.claude/agents/ | grep code-reviewer

# Create fresh test environment
!rm -rf /tmp/agent-validation
!mkdir -p /tmp/agent-validation/{docs/planning,src,tasks/pending}
```

---

## Test 1: Agent Signature Validation

### Check Correct Parameter Passing

**Expected**: `ask subagent <agent> "<file>" "<task>" "<work_dir>" "<dryrun>"`

```bash
!echo "Testing agent signature compliance..."

# Test ui-designer signature
ask subagent ui-designer "src/TestComponent.jsx" "test-task" "/tmp/agent-validation" "true"

# Test qa-analyst signature  
ask subagent qa-analyst "src/TestService.js" "test-task" "/tmp/agent-validation" "true"

# Test code-reviewer signature
ask subagent code-reviewer "src/TestUtils.js" "test-task" "/tmp/agent-validation" "true"
```

**Validation Points:**
- [ ] All agents accept exactly 5 parameters
- [ ] Agents don't fail with "wrong number of arguments"
- [ ] dryrun parameter is properly handled
- [ ] work_dir parameter is used for all file operations

---

## Test 2: Worktree Path Discipline

### Verify No Directory Changes
```bash
!cat > /tmp/agent-validation/monitor-commands.sh << 'EOF'
#!/bin/bash
echo "Monitoring for cd/pushd/popd usage..."
# This would be injected into agent execution to catch violations
set -x  # Enable command tracing
EOF

# Create test file in specific location
!cat > /tmp/agent-validation/src/PathTest.js << 'EOF'
function testFunction() {
  return "path test";
}
module.exports = { testFunction };
EOF
```

**Test with explicit path checking:**
```bash
ask subagent code-reviewer "src/PathTest.js" "path-test" "/tmp/agent-validation" "false"

# Check that files are created in correct worktree location
!find /tmp/agent-validation -type f -name "*PathTest*" | head -5
```

**Validation Points:**
- [ ] All output files are in `/tmp/agent-validation/` tree
- [ ] No files created in current working directory
- [ ] Agent logs show full path usage (not relative paths)
- [ ] No `cd`, `pushd`, or `popd` commands in agent execution

---

## Test 3: Context Rehydration Validation

### Setup IDEAL-STI Context Files
```bash
!cat > /tmp/agent-validation/docs/planning/phase7-architecture.md << 'EOF'
# Architecture Test
## Framework: React with TypeScript
## State: Redux Toolkit
## Testing: Jest + React Testing Library
EOF

!cat > /tmp/agent-validation/docs/planning/phase4-tech-research.md << 'EOF'
# Tech Research Test  
## Selected Technologies
- Frontend: React 18
- Backend: Node.js/Express
- Database: PostgreSQL
EOF

!cat > /tmp/agent-validation/tasks/pending/context-test.md << 'EOF'
# Context Rehydration Test
## Priority: High
## Effort: Small
## Dependencies: auth-system
## Acceptance Criteria
- [ ] Integrate with existing architecture
- [ ] Follow established patterns
EOF
```

**Test Context Integration:**
```bash
ask subagent ui-designer "src/ContextTest.jsx" "context-test" "/tmp/agent-validation" "false"

# Verify context was read and integrated
!cat /tmp/agent-validation/docs/planning/ui-specs/ContextTest.jsx-ui-spec.md | grep -i "react\|typescript\|redux"
```

**Validation Points:**
- [ ] Agent reads and processes IDEAL-STI phase files
- [ ] Architecture decisions are reflected in output
- [ ] Technology choices influence recommendations
- [ ] Task context is properly integrated

---

## Test 4: Fallback Behavior Validation

### Force Agent Failures
```bash
# Create scenarios that might cause agent failures
!cat > /tmp/agent-validation/src/ProblematicFile.js << 'EOF'
// File with potential parsing issues
const weirdSyntax = `
  This is not valid JavaScript
  It should trigger fallback behavior
  #$%^&*(){}[]
`;
EOF

# Test fallback creation
ask subagent code-reviewer "src/ProblematicFile.js" "fallback-test" "/tmp/agent-validation" "false"

# Verify fallback files are created
!ls -la /tmp/agent-validation/docs/planning/reviews/ | grep ProblematicFile
```

**Validation Points:**
- [ ] Fallback files are created when agents fail
- [ ] Fallback content provides basic guidance
- [ ] Execution continues despite agent failures
- [ ] Error handling is graceful (no crashes)

---

## Test 5: Feedback Loop Validation

### Test Code Review Feedback
```bash
!cat > /tmp/agent-validation/src/FeedbackTest.js << 'EOF'
// Intentionally flawed code for feedback testing
function badValidation(email) {
  return email.includes('@');  // Weak validation
}

function unsafeFunction(input) {
  eval(input);  // Security issue
}

module.exports = { badValidation, unsafeFunction };
EOF

# First review (should identify issues)
ask subagent code-reviewer "src/FeedbackTest.js" "feedback-test" "/tmp/agent-validation" "false"

# Check if review identified issues
!grep -i "security\|validation\|eval" /tmp/agent-validation/docs/planning/reviews/FeedbackTest.js-review.md

# Test feedback application (would be done by feature-developer)
!echo "Simulating feedback application..."
!echo "// TODO: Add comprehensive error handling" >> /tmp/agent-validation/src/FeedbackTest.js
!echo "// TODO: Add input validation" >> /tmp/agent-validation/src/FeedbackTest.js
```

**Validation Points:**
- [ ] Code reviewer identifies actual issues
- [ ] Review status reflects code quality accurately
- [ ] Required changes are specific and actionable  
- [ ] Feedback application improves the code
- [ ] Multiple review iterations work correctly

---

## Test 6: Parallel Execution Validation

### Test Built-in Parallel Capabilities
```bash
!cat > /tmp/agent-validation/src/ParallelTest1.jsx << 'EOF'
import React from 'react';
export const ParallelTest1 = () => <div>Test Component 1</div>;
EOF

!cat > /tmp/agent-validation/src/ParallelTest2.js << 'EOF'
function parallelFunction() {
  return "parallel test 2";
}
module.exports = { parallelFunction };
EOF

# Test parallel execution (simulating feature-developer Phase 7)
echo "Testing parallel agent execution..."

# In parallel, ask subagent ui-designer and qa-analyst 
ask subagent ui-designer "src/ParallelTest1.jsx" "parallel-test" "/tmp/agent-validation" "false" && \
ask subagent qa-analyst "src/ParallelTest1.jsx" "parallel-test" "/tmp/agent-validation" "false"

# Check both outputs were created
!ls -la /tmp/agent-validation/docs/planning/ui-specs/ | grep ParallelTest1
!ls -la /tmp/agent-validation/docs/planning/test-plans/ | grep ParallelTest1
```

**Validation Points:**
- [ ] Parallel execution works with built-in Claude Code capabilities
- [ ] No PID tracking or temp files used
- [ ] Both agents complete successfully
- [ ] Output files don't conflict or overwrite each other

---

## Test 7: Output Quality Validation

### Validate Agent Output Structure

**UI Designer Output Check:**
```bash
ask subagent ui-designer "src/QualityTest.jsx" "quality-validation" "/tmp/agent-validation" "false"

# Validate UI spec structure
!cat /tmp/agent-validation/docs/planning/ui-specs/QualityTest.jsx-ui-spec.md | head -20

echo "=== Checking UI Spec Quality ==="
!grep -c "Component\|Props\|State\|Styling" /tmp/agent-validation/docs/planning/ui-specs/QualityTest.jsx-ui-spec.md
```

**QA Analyst Output Check:**
```bash
ask subagent qa-analyst "src/QualityTest.jsx" "quality-validation" "/tmp/agent-validation" "false"

echo "=== Checking Test Plan Quality ==="
!grep -c "Unit\|Integration\|Test.*Case\|Coverage" /tmp/agent-validation/docs/planning/test-plans/QualityTest.jsx-test-plan.md
```

**Code Reviewer Output Check:**
```bash
ask subagent code-reviewer "src/QualityTest.jsx" "quality-validation" "/tmp/agent-validation" "false"

echo "=== Checking Review Quality ==="
!grep -c "Security\|Performance\|Quality\|Documentation" /tmp/agent-validation/docs/planning/reviews/QualityTest.jsx-review.md
```

**Validation Points:**
- [ ] UI specs contain component architecture details
- [ ] Test plans have specific test cases and coverage targets
- [ ] Code reviews identify security, performance, quality issues
- [ ] All outputs are structured and actionable
- [ ] Web research insights are included where appropriate

---

## Test 8: Feature Developer Integration

### Complete Workflow Test
```bash
# Setup comprehensive test scenario
!cat > /tmp/agent-validation/tasks/pending/integration-test.md << 'EOF'
# Integration Test Feature
## Goal: Test complete feature-developer workflow
## Priority: High
## Effort: Medium
## Acceptance Criteria
- [ ] Create React component
- [ ] Add API service
- [ ] Implement tests
- [ ] Review code quality
EOF

# Create full context
!cat > /tmp/agent-validation/docs/planning/phase7-architecture.md << 'EOF'
# Integration Test Architecture
## Frontend: React with TypeScript
## Backend: Express API  
## Testing: Jest
EOF

# Execute full feature-developer workflow
echo "=== EXECUTING FULL FEATURE-DEVELOPER WORKFLOW ==="
ask subagent feature-developer "tasks/pending/integration-test.md" "/tmp/agent-validation" "false"

# Comprehensive validation
echo "=== VALIDATING COMPLETE WORKFLOW ==="
!find /tmp/agent-validation -name "*.md" -type f | sort
!find /tmp/agent-validation -name "*.js" -o -name "*.jsx" -type f | sort
```

**Validation Points:**
- [ ] All 12 phases execute without errors
- [ ] Implementation files are created
- [ ] Agent coordination works smoothly  
- [ ] Final report is comprehensive
- [ ] No worktree path violations
- [ ] Feedback loops improve code quality

---

## Agent Improvement Identification

### Common Issues to Look For:

**Agent Signature Problems:**
- Parameter count mismatches
- Missing dryrun handling
- work_dir parameter not used

**Path Discipline Violations:**
- Files created outside worktree
- Use of cd/pushd/popd commands
- Relative path usage

**Context Integration Issues:**  
- IDEAL-STI files not read
- Architecture decisions ignored
- Technology choices not reflected

**Output Quality Problems:**
- Generic/templated responses
- Missing specific recommendations
- No actionable insights

**Fallback Issues:**
- No fallback creation on failure
- Execution stops on agent errors
- Poor error handling

## Validation Summary Report

After running all tests, generate a summary:

```bash
echo "=== AGENT VALIDATION SUMMARY ==="
echo "Test Environment: /tmp/agent-validation"
echo "Agents Tested: feature-developer, ui-designer, qa-analyst, code-reviewer"
echo ""
echo "Files Created:"
!find /tmp/agent-validation -type f | wc -l
echo ""
echo "Output Quality Check:"
!find /tmp/agent-validation -name "*.md" -exec wc -l {} + | tail -1
echo ""
echo "Path Discipline: $(find /tmp/agent-validation -type f | grep -v "/tmp/agent-validation" | wc -l) violations"
echo ""
echo "=== END VALIDATION SUMMARY ==="

# Cleanup
!rm -rf /tmp/agent-validation
```

Use this checklist to systematically validate each agent and identify specific areas for improvement in `~/claude-craft/agents/` files.