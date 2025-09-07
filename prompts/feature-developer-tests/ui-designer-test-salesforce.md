# UI Designer Test: Salesforce Platform

Test the ui-designer subagent with Salesforce Lightning Web Components and Apex development.

## Test Parameters
- **target_file**: "force-app/main/default/lwc/accountDashboard/accountDashboard.html"
- **task_name**: "salesforce-account-dashboard"
- **worktree_dir**: "/tmp/test-worktree-salesforce"
- **dryrun**: "false"

## Technology Stack Context
Salesforce Lightning Platform with Lightning Web Components (LWC), Apex, and Salesforce Lightning Design System (SLDS).

## Test Setup Requirements

```bash
mkdir -p "/tmp/test-worktree-salesforce/docs/planning"
mkdir -p "/tmp/test-worktree-salesforce/force-app/main/default/lwc/accountDashboard"
mkdir -p "/tmp/test-worktree-salesforce/tasks/in-progress"

# Create Salesforce-specific task file
cat > "/tmp/test-worktree-salesforce/tasks/in-progress/salesforce-account-dashboard.md" << 'EOF'
# Salesforce Account Dashboard Component

## Description
Create a Lightning Web Component for displaying comprehensive account information with related records and analytics within Salesforce.

## Acceptance Criteria
- [ ] Display account details with related contacts and opportunities
- [ ] Lightning Data Service integration for real-time data
- [ ] Interactive charts using Chart.js Lightning Web Component
- [ ] Responsive design using Salesforce Lightning Design System
- [ ] Wire service integration with Apex methods
- [ ] Lightning record forms for quick editing
- [ ] Proper error handling and loading states
- [ ] Mobile-responsive for Salesforce mobile app

## Epic: salesforce-crm-enhancement
## Story: account-360-view
## Priority: critical
EOF

# Create Salesforce architecture context
cat > "/tmp/test-worktree-salesforce/docs/planning/phase7-architecture.md" << 'EOF'
# Architecture Decisions

## Salesforce Lightning Platform
- **Component Framework**: Lightning Web Components (LWC)
- **Backend**: Apex classes with proper sharing and security
- **UI Framework**: Salesforce Lightning Design System (SLDS)
- **Data Access**: Lightning Data Service and Wire Service
- **Security**: Field-level security and sharing rules enforcement

## Technical Constraints
- Must follow Salesforce governor limits (SOQL queries, DML operations)
- Lightning Locker Service security restrictions
- SLDS design tokens and component guidelines
- Mobile-first responsive design for Salesforce mobile app
- Apex best practices for bulk operations and trigger patterns
EOF

# Create Salesforce target users context
cat > "/tmp/test-worktree-salesforce/docs/planning/phase2-target-users.md" << 'EOF'
# Target Users Analysis

## Primary User Personas
- **Sales Representatives**: Need quick access to account health and opportunities
- **Account Managers**: Require comprehensive account relationship overview
- **Sales Managers**: Need performance metrics and team visibility

## Salesforce Environment Requirements
- Lightning Experience interface
- Mobile app compatibility (iOS/Android Salesforce mobile)
- Various screen sizes: desktop (1200px+), tablet (768px+), mobile (375px+)
- Accessibility compliance (WCAG 2.1 AA) built into SLDS
- Multi-org deployment capability
EOF

# Create Salesforce tech research context
cat > "/tmp/test-worktree-salesforce/docs/planning/phase4-tech-research.md" << 'EOF'
# Technology Research

## Lightning Platform Technologies
- Lightning Web Components with ES6+ JavaScript
- Salesforce Lightning Design System (SLDS) v2.22+
- Lightning Data Service for data operations
- Wire Service for Apex method integration
- Lightning Message Service for component communication
- Lightning Navigation Service for page navigation

## Apex Backend Patterns
- SOQL best practices with selective queries
- Bulk operation patterns for trigger handling
- AuraEnabled methods for LWC integration
- Proper exception handling and logging
- Test class coverage requirements (75%+)
EOF

# Create Salesforce project structure
mkdir -p "/tmp/test-worktree-salesforce/force-app/main/default/classes"
mkdir -p "/tmp/test-worktree-salesforce/force-app/main/default/objects"

# Create sfdx-project.json for Salesforce project context
cat > "/tmp/test-worktree-salesforce/sfdx-project.json" << 'EOF'
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true
    }
  ],
  "name": "account-dashboard-project",
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "59.0"
}
EOF
```

## Expected Agent Call
```bash
ask subagent ui-designer "force-app/main/default/lwc/accountDashboard/accountDashboard.html" "salesforce-account-dashboard" "/tmp/test-worktree-salesforce" "false"
```

## Expected Outputs to Validate

### 1. Salesforce-Specific Architecture Decisions
**Expected**: Recognition of Lightning Platform constraints
- Framework decision: "Lightning Web Components" 
- Styling decision: "Salesforce Lightning Design System (SLDS)"
- Data access: "Lightning Data Service and Wire Service"
- Security considerations: "Field-level security and sharing rules"

### 2. LWC-Compatible UI Specification
**Expected**: `docs/planning/ui-specs/accountDashboard.html-ui-spec.md`
**Should contain**:
- Lightning Web Component HTML template structure
- SLDS component usage (cards, data tables, buttons)
- Wire service integration patterns
- Lightning Data Service implementation
- Responsive design using SLDS grid system
- Accessibility patterns built into SLDS

### 3. Salesforce Implementation Guide
**Should include**:
- Complete LWC component structure (HTML, JS, CSS, XML)
- Apex controller class with AuraEnabled methods
- Wire service integration for data binding
- Lightning Data Service patterns
- Error handling and loading states
- Test class coverage for Apex methods

### 4. Technology Stack Validation
**JSON return data should show**:
```json
{
  "framework": "Lightning Web Components",
  "framework_reason": "Salesforce Lightning Platform requirement",
  "styling": "Salesforce Lightning Design System",
  "styling_reason": "Platform-native design system with built-in accessibility",
  "data_service": "Lightning Data Service",
  "constraints_detected": [
    "governor_limits",
    "lightning_locker_service",
    "slds_design_tokens_required",
    "apex_sharing_rules",
    "mobile_app_compatibility"
  ]
}
```

## Validation Criteria
- [ ] Agent recognizes Salesforce Lightning Platform environment
- [ ] Framework decision is Lightning Web Components (not React/Vue)
- [ ] Styling approach uses SLDS components and design tokens
- [ ] Data access patterns use Lightning Data Service/Wire Service
- [ ] Apex backend integration patterns are included
- [ ] Governor limits and security considerations documented
- [ ] Mobile-responsive design for Salesforce mobile app
- [ ] Proper LWC project structure and metadata files

## Success Metrics
- Agent adapts to Salesforce platform constraints and capabilities
- SLDS components and design patterns are utilized correctly
- Lightning Data Service and Wire Service patterns documented
- Apex integration follows Salesforce best practices
- Security and governor limit considerations are addressed
- Mobile app compatibility patterns included

## Expected Research Insights
- Lightning Web Component best practices and patterns
- SLDS component library and design token usage
- Lightning Data Service vs. Apex method performance trade-offs
- Salesforce mobile app responsive design considerations
- Governor limit optimization strategies
- Lightning Platform security model implementation