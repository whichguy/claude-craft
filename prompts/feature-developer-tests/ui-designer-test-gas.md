# UI Designer Test: Google Apps Script (GAS) Stack

Test the ui-designer subagent with Google Apps Script HTML Service web application scenario.

## Test Parameters
- **target_file**: "src/sidebar.html"
- **task_name**: "gas-data-entry-sidebar"
- **worktree_dir**: "/tmp/test-worktree-gas"
- **dryrun**: "false"

## Technology Stack Context
Google Apps Script with HTML Service for Google Workspace add-ons and web apps.

## Test Setup Requirements

```bash
mkdir -p "/tmp/test-worktree-gas/docs/planning"
mkdir -p "/tmp/test-worktree-gas/src"
mkdir -p "/tmp/test-worktree-gas/tasks/in-progress"

# Create GAS-specific task file
cat > "/tmp/test-worktree-gas/tasks/in-progress/gas-data-entry-sidebar.md" << 'EOF'
# Google Sheets Data Entry Sidebar

## Description
Create a sidebar for Google Sheets that allows users to input structured data with validation and automatic sheet population.

## Acceptance Criteria
- [ ] HTML form with multiple input types (text, dropdown, date, number)
- [ ] Client-side JavaScript form validation
- [ ] Integration with Google Sheets API via server functions
- [ ] Loading states during data submission
- [ ] Error handling for invalid data
- [ ] Responsive design for different screen sizes
- [ ] Google Apps Script HTML Service compatibility

## Epic: google-workspace-automation
## Story: data-entry-sidebar
## Priority: medium
EOF

# Create GAS architecture context
cat > "/tmp/test-worktree-gas/docs/planning/phase7-architecture.md" << 'EOF'
# Architecture Decisions

## Google Apps Script Platform
- **Environment**: Google Apps Script HTML Service
- **UI Framework**: Vanilla HTML/CSS/JavaScript (no external frameworks allowed)
- **Styling**: CSS3 with Google Material Design principles
- **Data Flow**: HTML Service ↔ server.gs functions ↔ Google Sheets API
- **Security**: Apps Script built-in authorization and CSRF protection

## Technical Constraints
- No external CDN or npm packages allowed
- Must use google.script.run for server communication
- HTML Service sandboxed environment
- Maximum 6MB total project size
- Client-server communication via callback functions only
EOF

# Create GAS target users context
cat > "/tmp/test-worktree-gas/docs/planning/phase2-target-users.md" << 'EOF'
# Target Users Analysis

## Primary User Personas
- **Google Workspace Users**: Business users familiar with Sheets/Docs
- **Data Entry Personnel**: Need efficient bulk data input workflows
- **Small Business Owners**: Require simple but functional data management

## Device Support Requirements
- Google Workspace sidebar width: 300px fixed
- Mobile responsive for smaller screens when used as web app
- Touch-friendly for tablet users
- Keyboard navigation for accessibility
EOF

# Create GAS tech research context
cat > "/tmp/test-worktree-gas/docs/planning/phase4-tech-research.md" << 'EOF'
# Technology Research

## Google Apps Script Constraints
- Vanilla JavaScript ES5 compatibility required
- HTML Service sandboxed iframe environment
- No external libraries via CDN (security restrictions)
- Built-in Google client libraries available
- 6-minute execution time limit for server functions

## Recommended Patterns
- CSS Grid/Flexbox for layout (well supported)
- Vanilla JavaScript form handling
- google.script.run.withSuccessHandler() for async calls
- Material Design Lite patterns for Google consistency
- Progressive enhancement for offline scenarios
EOF
```

## Expected Agent Call
```bash
ask subagent ui-designer "src/sidebar.html" "gas-data-entry-sidebar" "/tmp/test-worktree-gas" "false"
```

## Expected Outputs to Validate

### 1. GAS-Specific Architecture Decisions
**Expected**: Dynamic recognition of GAS constraints
- Framework decision: "Vanilla HTML/CSS/JavaScript" (no React/Vue possible)
- Styling decision: "CSS3 with Material Design" (no external CSS frameworks)
- Communication patterns: google.script.run integration
- Security considerations: Apps Script sandboxing

### 2. GAS-Compatible UI Specification
**Expected**: `docs/planning/ui-specs/sidebar.html-ui-spec.md`
**Should contain**:
- HTML5 form structure with GAS-compatible patterns
- CSS3 styling without external dependencies
- JavaScript patterns using google.script.run
- Material Design visual consistency
- Sidebar-specific responsive design (300px width)

### 3. GAS Implementation Guide
**Should include**:
- Complete HTML file structure for Apps Script
- Server-side integration patterns (Code.gs functions)
- Error handling for google.script.run failures
- Data validation both client and server side
- Google Sheets API integration examples

### 4. Technology Stack Validation
**JSON return data should show**:
```json
{
  "framework": "Vanilla JavaScript",
  "framework_reason": "Google Apps Script sandboxed environment restrictions",
  "styling": "CSS3",
  "styling_reason": "No external CDN access in GAS environment",
  "constraints_detected": [
    "no_external_dependencies",
    "html_service_sandbox",
    "6mb_size_limit",
    "google_script_run_required"
  ]
}
```

## Validation Criteria
- [ ] Agent correctly identifies GAS environment limitations
- [ ] Framework decision is "Vanilla JavaScript" (not React/Vue/Angular)
- [ ] Styling approach avoids external dependencies
- [ ] UI specification includes google.script.run patterns
- [ ] Server communication patterns are GAS-compatible
- [ ] Material Design principles are referenced
- [ ] Sidebar-specific responsive design (300px constraint)
- [ ] Google Workspace integration patterns included

## Success Metrics
- Agent adapts to GAS constraints intelligently
- No recommendations for forbidden external libraries
- Complete HTML Service compatible implementation guide
- Google Sheets API integration patterns included
- Proper google.script.run async patterns documented

## Expected Research Insights
- GAS HTML Service best practices
- Material Design Lite patterns for Google consistency
- Common GAS development pitfalls to avoid
- Performance optimization for 6MB limit
- Accessibility patterns within GAS constraints