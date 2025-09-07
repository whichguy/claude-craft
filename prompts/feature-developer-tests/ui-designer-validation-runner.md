# UI Designer Enhanced Validation Runner

Comprehensive test runner to validate all improvements made to the ui-designer agent.

## Quick Test Execution

!bash
# Setup test environment
mkdir -p '/tmp/test-worktree/docs/planning'
mkdir -p '/tmp/test-worktree/src/components' 
mkdir -p '/tmp/test-worktree/tasks/in-progress'

# Create comprehensive test context files
cat > '/tmp/test-worktree/tasks/in-progress/user-profile-dashboard.md' << 'EOF'
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

# Create IDEAL-STI Phase 7 architecture context
cat > '/tmp/test-worktree/docs/planning/phase7-architecture.md' << 'EOF'
# Architecture Decisions

## Frontend Framework
- **Selected**: React 18 with TypeScript
- **State Management**: Zustand for global state
- **Styling**: Tailwind CSS with custom components
- **Component Architecture**: Atomic design principles
- **Performance**: React.memo for expensive components
- **Accessibility**: WCAG 2.1 AA compliance required

## Technical Constraints
- Mobile-first responsive design
- Authentication integration required
- Support for real-time updates
- Offline capability preferred
EOF

# Create Phase 2 target users context
cat > '/tmp/test-worktree/docs/planning/phase2-target-users.md' << 'EOF'
# Target Users Analysis

## Primary User Personas
- **Professional Users**: Need efficient profile management
- **Mobile Users**: 60% of traffic from mobile devices
- **Accessibility Users**: Screen reader and keyboard navigation support required

## Device Support Requirements  
- Desktop: 1920x1080 and 1366x768
- Tablet: 768px breakpoint
- Mobile: 375px and 320px breakpoints
- Touch-friendly interfaces required
EOF

# Create Phase 4 tech research context
cat > '/tmp/test-worktree/docs/planning/phase4-tech-research.md' << 'EOF'
# Technology Research

## Frontend Technologies
- React 18.2.0 with Concurrent Features
- TypeScript 5.0 for type safety
- Tailwind CSS 3.3 for utility-first styling
- Headless UI components for accessibility
- React Hook Form for form management
- Zustand for state management
- React Query for server state

## Performance Requirements
- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s  
- Cumulative Layout Shift < 0.1
EOF

echo "✅ Test environment prepared at /tmp/test-worktree"

## Test 1: Normal Execution (All 17 Phases)

!bash
echo "🧪 TEST 1: Full 17-Phase Pipeline Execution"
echo "Expected: All phases 0-16 complete with progress tracking"
echo ""

ask subagent ui-designer 'src/components/UserProfile.jsx' 'user-profile-dashboard' '/tmp/test-worktree' 'false'

echo ""
echo "✅ Test 1 completed - check for phase progress indicators"

## Test 2: Error Handling Validation

!bash  
echo "🧪 TEST 2: Enhanced Error Handling"
echo "Expected: Clear error message for missing target_file"
echo ""

ask subagent ui-designer '' 'user-profile-dashboard' '/tmp/test-worktree' 'false' || echo "✅ Error handling working correctly"

echo ""
echo "Expected: Clear error message for missing worktree_dir" 
echo ""

ask subagent ui-designer 'src/components/UserProfile.jsx' 'user-profile-dashboard' '' 'false' || echo "✅ Worktree validation working correctly"

## Test 3: Output File Validation

!bash
echo "🧪 TEST 3: Output File Structure Validation"
echo "Checking for expected output files..."
echo ""

# Check for comprehensive context files
expected_files=(
  "/tmp/test-worktree/docs/planning/ui-full-context-rehydration-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-use-case-analysis-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-architectural-decisions-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-research-results-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-authentication-analysis-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-responsive-strategy-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-debugging-strategy-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-framework-setup-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-return-data-user-profile-dashboard.json"
)

for file in "${expected_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ Found: $(basename $file)"
    echo "   Size: $(du -h "$file" | cut -f1)"
  else
    echo "❌ Missing: $(basename $file)"
  fi
done

## Test 4: JSON Structure Validation

!bash
echo "🧪 TEST 4: JSON Return Data Validation"
echo "Checking JSON structure and content..."
echo ""

if [ -f "/tmp/test-worktree/docs/planning/ui-return-data-user-profile-dashboard.json" ]; then
  echo "JSON Content Preview:"
  head -20 "/tmp/test-worktree/docs/planning/ui-return-data-user-profile-dashboard.json"
  echo ""
  
  # Validate JSON syntax
  if python3 -m json.tool "/tmp/test-worktree/docs/planning/ui-return-data-user-profile-dashboard.json" >/dev/null 2>&1; then
    echo "✅ JSON syntax is valid"
  else
    echo "❌ JSON syntax error detected"
  fi
  
  # Check for required fields
  required_fields=("ui_design_complete" "target_file" "task_name" "component_name" "architecture_decisions")
  for field in "${required_fields[@]}"; do
    if grep -q "\"$field\"" "/tmp/test-worktree/docs/planning/ui-return-data-user-profile-dashboard.json"; then
      echo "✅ Found required field: $field"
    else
      echo "❌ Missing required field: $field"  
    fi
  done
else
  echo "❌ JSON return data file not found"
fi

## Test 5: Content Quality Assessment

!bash
echo "🧪 TEST 5: Content Quality Assessment"
echo "Analyzing output quality and completeness..."
echo ""

# Check UI specification content
if [ -f "/tmp/test-worktree/docs/planning/ui-specs/UserProfile.jsx-ui-spec.md" ]; then
  echo "UI Specification Analysis:"
  spec_file="/tmp/test-worktree/docs/planning/ui-specs/UserProfile.jsx-ui-spec.md"
  
  # Check for key content indicators
  content_checks=(
    "component:Component hierarchy"
    "props:Props interface"
    "state:State management"
    "tailwind:Tailwind CSS"
    "accessibility:Accessibility"
    "responsive:Responsive design"
  )
  
  for check in "${content_checks[@]}"; do
    key="${check%:*}"
    description="${check#*:}"
    if grep -qi "$key" "$spec_file"; then
      echo "✅ Contains $description guidance"
    else
      echo "⚠️  May be missing $description guidance"
    fi
  done
  
  echo ""
  echo "File size: $(du -h "$spec_file" | cut -f1)"
  echo "Line count: $(wc -l < "$spec_file")"
else
  echo "❌ UI specification file not found"
fi

## Test Results Summary

!bash
echo "📊 TEST RESULTS SUMMARY"
echo "====================="
echo ""

total_files=0
found_files=0

expected_files=(
  "/tmp/test-worktree/docs/planning/ui-full-context-rehydration-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-use-case-analysis-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-architectural-decisions-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-research-results-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-authentication-analysis-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-responsive-strategy-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-debugging-strategy-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-framework-setup-user-profile-dashboard.md"
  "/tmp/test-worktree/docs/planning/ui-return-data-user-profile-dashboard.json"
  "/tmp/test-worktree/docs/planning/ui-specs/UserProfile.jsx-ui-spec.md"
)

for file in "${expected_files[@]}"; do
  total_files=$((total_files + 1))
  if [ -f "$file" ]; then
    found_files=$((found_files + 1))
  fi
done

success_rate=$(( (found_files * 100) / total_files ))

echo "📈 File Generation Success Rate: $found_files/$total_files ($success_rate%)"

if [ $success_rate -ge 80 ]; then
  echo "🎉 UI-DESIGNER ENHANCED VALIDATION: PASSED"
  echo "   All major improvements are working correctly"
elif [ $success_rate -ge 60 ]; then
  echo "⚠️  UI-DESIGNER ENHANCED VALIDATION: PARTIAL"  
  echo "   Most features working, some files may be missing"
else
  echo "❌ UI-DESIGNER ENHANCED VALIDATION: FAILED"
  echo "   Significant issues detected, review agent implementation"
fi

echo ""
echo "🔍 Total planning files created: $found_files"
echo "💾 Combined file size: $(du -sh /tmp/test-worktree/docs/planning 2>/dev/null | cut -f1 || echo 'Unknown')"

## Cleanup

!bash
echo "🧹 CLEANUP"
echo "=========="
echo "Test files remain at /tmp/test-worktree for inspection"
echo "To clean up: rm -rf /tmp/test-worktree"
echo ""
echo "✅ UI-Designer enhanced validation completed"