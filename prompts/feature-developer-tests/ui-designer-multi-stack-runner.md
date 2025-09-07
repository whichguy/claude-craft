# UI Designer Multi-Stack Test Runner

Comprehensive test runner to validate ui-designer's ability to intelligently adapt to different technology stacks and constraints.

## Test Strategy

The ui-designer agent should demonstrate intelligent runtime decision-making by:
1. **Environment Detection**: Analyzing project structure and dependencies
2. **Constraint Recognition**: Identifying platform-specific limitations  
3. **Technology Adaptation**: Selecting appropriate frameworks and patterns
4. **Best Practice Application**: Applying stack-specific optimizations

## Quick Test All Stacks

### Test 1: Google Apps Script (GAS) Stack
!bash
echo "🧪 TEST 1: Google Apps Script Environment"
echo "Expected: Vanilla JS, no external dependencies, google.script.run patterns"
echo ""

# Setup GAS test environment
mkdir -p '/tmp/test-worktree-gas/docs/planning' '/tmp/test-worktree-gas/src' '/tmp/test-worktree-gas/tasks/in-progress'

cat > '/tmp/test-worktree-gas/tasks/in-progress/gas-data-entry-sidebar.md' << 'EOF'
# Google Sheets Data Entry Sidebar
## Acceptance Criteria
- [ ] HTML form with validation
- [ ] Google Sheets API integration
- [ ] 300px sidebar width constraint
- [ ] No external CDN dependencies allowed
EOF

cat > '/tmp/test-worktree-gas/docs/planning/phase7-architecture.md' << 'EOF'
# Architecture Decisions
## Google Apps Script Platform  
- **Environment**: Google Apps Script HTML Service
- **Constraints**: No external CDN, 6MB limit, sandboxed iframe
EOF

ask subagent ui-designer 'src/sidebar.html' 'gas-data-entry-sidebar' '/tmp/test-worktree-gas' 'false'

echo ""
echo "✅ GAS Test completed - should show vanilla JS decision"

### Test 2: Command Line Shell Interface  
!bash
echo "🧪 TEST 2: Command Line Shell Environment"
echo "Expected: ncurses/ANSI, terminal UI patterns, no GUI dependencies"
echo ""

# Setup Shell test environment
mkdir -p '/tmp/test-worktree-shell/docs/planning' '/tmp/test-worktree-shell/src' '/tmp/test-worktree-shell/tasks/in-progress'

cat > '/tmp/test-worktree-shell/tasks/in-progress/shell-system-monitor.md' << 'EOF'
# Shell System Monitor Dashboard
## Acceptance Criteria
- [ ] Real-time system metrics display
- [ ] Keyboard navigation
- [ ] ANSI color coding
- [ ] Cross-platform POSIX compliance
EOF

cat > '/tmp/test-worktree-shell/docs/planning/phase7-architecture.md' << 'EOF'
# Architecture Decisions
## Command Line Environment
- **Platform**: POSIX shell scripting
- **Constraints**: No GUI, terminal-based only, minimal dependencies
EOF

ask subagent ui-designer 'src/dashboard.sh' 'shell-system-monitor' '/tmp/test-worktree-shell' 'false'

echo ""
echo "✅ Shell Test completed - should show terminal UI decision"

### Test 3: Node.js with Bootstrap v5 & jQuery
!bash
echo "🧪 TEST 3: Node.js + Bootstrap + jQuery Stack"
echo "Expected: Bootstrap components, jQuery patterns, server-side rendering"
echo ""

# Setup Node test environment  
mkdir -p '/tmp/test-worktree-node/docs/planning' '/tmp/test-worktree-node/views' '/tmp/test-worktree-node/tasks/in-progress'

cat > '/tmp/test-worktree-node/tasks/in-progress/node-admin-dashboard.md' << 'EOF'
# Node.js Admin Dashboard
## Acceptance Criteria
- [ ] Bootstrap responsive layout
- [ ] jQuery DataTables integration
- [ ] AJAX form submissions
- [ ] Server-side EJS rendering
EOF

cat > '/tmp/test-worktree-node/docs/planning/phase7-architecture.md' << 'EOF'
# Architecture Decisions
## Server-Side Rendering Stack
- **Backend**: Node.js with Express
- **UI Framework**: Bootstrap v5
- **JavaScript**: jQuery for DOM manipulation
EOF

cat > '/tmp/test-worktree-node/package.json' << 'EOF'
{
  "dependencies": {
    "bootstrap": "^5.3.0",
    "jquery": "^3.7.0", 
    "express": "^4.18.2"
  }
}
EOF

ask subagent ui-designer 'views/admin-panel.ejs' 'node-admin-dashboard' '/tmp/test-worktree-node' 'false'

echo ""
echo "✅ Node/Bootstrap Test completed - should show Bootstrap + jQuery decision"

### Test 4: Salesforce Lightning Platform
!bash
echo "🧪 TEST 4: Salesforce Lightning Platform"  
echo "Expected: LWC components, SLDS design system, Lightning Data Service"
echo ""

# Setup Salesforce test environment
mkdir -p '/tmp/test-worktree-salesforce/docs/planning' '/tmp/test-worktree-salesforce/force-app/main/default/lwc/accountDashboard' '/tmp/test-worktree-salesforce/tasks/in-progress'

cat > '/tmp/test-worktree-salesforce/tasks/in-progress/salesforce-account-dashboard.md' << 'EOF'
# Salesforce Account Dashboard Component
## Acceptance Criteria
- [ ] Lightning Web Component structure
- [ ] SLDS responsive design
- [ ] Lightning Data Service integration
- [ ] Apex backend integration
EOF

cat > '/tmp/test-worktree-salesforce/docs/planning/phase7-architecture.md' << 'EOF'
# Architecture Decisions
## Salesforce Lightning Platform
- **Component Framework**: Lightning Web Components
- **UI Framework**: Salesforce Lightning Design System
- **Constraints**: Governor limits, Lightning Locker Service
EOF

cat > '/tmp/test-worktree-salesforce/sfdx-project.json' << 'EOF'
{
  "packageDirectories": [{"path": "force-app", "default": true}],
  "sourceApiVersion": "59.0"
}
EOF

ask subagent ui-designer 'force-app/main/default/lwc/accountDashboard/accountDashboard.html' 'salesforce-account-dashboard' '/tmp/test-worktree-salesforce' 'false'

echo ""
echo "✅ Salesforce Test completed - should show LWC + SLDS decision"

## Comprehensive Stack Validation

### Validate Framework Decisions
!bash
echo "📊 FRAMEWORK DECISION VALIDATION"
echo "================================"
echo ""

stacks=("gas" "shell" "node" "salesforce")
expected_frameworks=("Vanilla JavaScript" "Shell/ncurses" "Bootstrap v5" "Lightning Web Components")
expected_styling=("CSS3" "ANSI colors" "Bootstrap v5 utilities" "Salesforce Lightning Design System")

for i in "${!stacks[@]}"; do
  stack="${stacks[$i]}"
  expected_framework="${expected_frameworks[$i]}"
  expected_style="${expected_styling[$i]}"
  
  echo "🔍 Analyzing $stack stack decisions..."
  
  # Check if return data file exists
  return_file="/tmp/test-worktree-$stack/docs/planning/ui-return-data-*.json"
  if ls $return_file 1> /dev/null 2>&1; then
    echo "✅ Found return data file for $stack"
    
    # Validate framework decision (case insensitive)
    if grep -qi "$expected_framework" $return_file; then
      echo "✅ Correct framework detected: $expected_framework"
    else
      echo "❌ Framework mismatch for $stack stack"
      echo "   Expected: $expected_framework"
      echo "   Check: $(grep -i "framework" $return_file | head -1)"
    fi
    
    # Validate styling decision (case insensitive)  
    if grep -qi "$expected_style" $return_file; then
      echo "✅ Correct styling approach: $expected_style"
    else
      echo "⚠️  Styling approach may differ for $stack"
    fi
  else
    echo "❌ No return data found for $stack stack"
  fi
  echo ""
done

### Validate Constraint Recognition
!bash
echo "🔒 CONSTRAINT RECOGNITION VALIDATION"
echo "==================================="
echo ""

echo "🧪 GAS Constraints Check:"
gas_return="/tmp/test-worktree-gas/docs/planning/ui-return-data-*.json"
if ls $gas_return 1> /dev/null 2>&1; then
  constraints=("no_external_dependencies" "html_service_sandbox" "6mb_size_limit")
  for constraint in "${constraints[@]}"; do
    if grep -q "$constraint" $gas_return; then
      echo "✅ Recognized GAS constraint: $constraint"
    else  
      echo "⚠️  May have missed GAS constraint: $constraint"
    fi
  done
else
  echo "❌ GAS return data not found"
fi

echo ""
echo "🧪 Shell Constraints Check:"
shell_return="/tmp/test-worktree-shell/docs/planning/ui-return-data-*.json"
if ls $shell_return 1> /dev/null 2>&1; then
  constraints=("no_gui_dependencies" "posix_compliance" "terminal_width_constraints")
  for constraint in "${constraints[@]}"; do
    if grep -q "$constraint" $shell_return; then
      echo "✅ Recognized Shell constraint: $constraint"
    else
      echo "⚠️  May have missed Shell constraint: $constraint" 
    fi
  done
else
  echo "❌ Shell return data not found"
fi

echo ""
echo "🧪 Salesforce Constraints Check:"
sf_return="/tmp/test-worktree-salesforce/docs/planning/ui-return-data-*.json"
if ls $sf_return 1> /dev/null 2>&1; then
  constraints=("governor_limits" "lightning_locker_service" "slds_design_tokens")
  for constraint in "${constraints[@]}"; do
    if grep -q "$constraint" $sf_return; then
      echo "✅ Recognized Salesforce constraint: $constraint"
    else
      echo "⚠️  May have missed Salesforce constraint: $constraint"
    fi
  done
else
  echo "❌ Salesforce return data not found"
fi

### File Output Quality Assessment  
!bash
echo "📁 OUTPUT QUALITY ASSESSMENT"
echo "============================"
echo ""

total_tests=0
passed_tests=0

stacks=("gas" "shell" "node" "salesforce")
for stack in "${stacks[@]}"; do
  total_tests=$((total_tests + 1))
  
  echo "📋 $stack Stack File Analysis:"
  
  # Count generated files
  file_count=$(find "/tmp/test-worktree-$stack/docs/planning" -name "*.md" -o -name "*.json" 2>/dev/null | wc -l)
  echo "   Generated files: $file_count"
  
  # Check for key implementation guide
  if find "/tmp/test-worktree-$stack/docs/planning" -name "*implementation-guide*" 2>/dev/null | grep -q .; then
    echo "   ✅ Implementation guide created"
  else
    echo "   ⚠️  Implementation guide may be missing"
  fi
  
  # Check file sizes (should have substantial content)
  total_size=$(find "/tmp/test-worktree-$stack/docs/planning" -name "*.md" -exec cat {} \; 2>/dev/null | wc -c)
  if [ "$total_size" -gt 10000 ]; then
    echo "   ✅ Comprehensive content generated (${total_size} chars)"
    passed_tests=$((passed_tests + 1))
  else
    echo "   ⚠️  Content may be insufficient (${total_size} chars)"
  fi
  
  echo ""
done

success_rate=$(( (passed_tests * 100) / total_tests ))
echo "📈 Overall Success Rate: $passed_tests/$total_tests ($success_rate%)"

### Final Results Summary
!bash
echo "🎯 MULTI-STACK TEST RESULTS SUMMARY" 
echo "=================================="
echo ""

if [ $success_rate -ge 75 ]; then
  echo "🎉 UI-DESIGNER MULTI-STACK VALIDATION: EXCELLENT"
  echo "   The agent successfully adapts to different technology constraints"
elif [ $success_rate -ge 50 ]; then  
  echo "✅ UI-DESIGNER MULTI-STACK VALIDATION: GOOD"
  echo "   Most stacks handled correctly, minor improvements possible"
else
  echo "⚠️  UI-DESIGNER MULTI-STACK VALIDATION: NEEDS IMPROVEMENT"
  echo "   Agent may need better constraint detection logic"
fi

echo ""
echo "📊 Stack Adaptation Summary:"
echo "   • GAS Stack: Vanilla JS + HTML Service patterns"
echo "   • Shell Stack: Terminal UI + ncurses/ANSI patterns" 
echo "   • Node Stack: Bootstrap v5 + jQuery + EJS patterns"
echo "   • Salesforce: LWC + SLDS + Lightning Data Service patterns"
echo ""
echo "🔍 Test artifacts preserved in /tmp/test-worktree-* for detailed analysis"

## Cleanup
!bash
echo "🧹 CLEANUP OPTIONS"
echo "=================="
echo "Test files remain in:"
echo "  - /tmp/test-worktree-gas"
echo "  - /tmp/test-worktree-shell" 
echo "  - /tmp/test-worktree-node"
echo "  - /tmp/test-worktree-salesforce"
echo ""
echo "To clean up all test environments:"
echo "  rm -rf /tmp/test-worktree-*"
echo ""
echo "✅ Multi-stack ui-designer validation completed"