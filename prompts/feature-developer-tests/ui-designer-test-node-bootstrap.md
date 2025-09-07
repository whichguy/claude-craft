# UI Designer Test: Node Server with Bootstrap v5 & jQuery

Test the ui-designer subagent with Node.js server-rendered pages using Bootstrap v5 and jQuery.

## Test Parameters
- **target_file**: "views/admin-panel.ejs"
- **task_name**: "node-admin-dashboard"
- **worktree_dir**: "/tmp/test-worktree-node"
- **dryrun**: "false"

## Technology Stack Context
Node.js server with Express, EJS templating, Bootstrap v5, and jQuery for traditional server-rendered web applications.

## Test Setup Requirements

```bash
mkdir -p "/tmp/test-worktree-node/docs/planning"
mkdir -p "/tmp/test-worktree-node/views"
mkdir -p "/tmp/test-worktree-node/tasks/in-progress"

# Create Node.js specific task file
cat > "/tmp/test-worktree-node/tasks/in-progress/node-admin-dashboard.md" << 'EOF'
# Node.js Admin Dashboard

## Description
Create a server-rendered admin dashboard using Bootstrap v5 and jQuery for managing users, content, and system settings.

## Acceptance Criteria
- [ ] Responsive Bootstrap v5 layout with sidebar navigation
- [ ] Data tables with jQuery DataTables integration
- [ ] AJAX form submissions for CRUD operations
- [ ] Real-time notifications using Socket.io
- [ ] Chart.js integration for analytics visualization
- [ ] Bootstrap modal dialogs for user interactions
- [ ] Server-side validation with client-side feedback
- [ ] Progressive enhancement for accessibility

## Epic: admin-management
## Story: dashboard-interface  
## Priority: high
EOF

# Create Node/Bootstrap architecture context
cat > "/tmp/test-worktree-node/docs/planning/phase7-architecture.md" << 'EOF'
# Architecture Decisions

## Server-Side Rendering Stack
- **Backend**: Node.js with Express framework
- **Template Engine**: EJS for server-side rendering
- **UI Framework**: Bootstrap v5 for responsive design
- **JavaScript Library**: jQuery for DOM manipulation and AJAX
- **Build System**: Webpack for asset bundling and optimization

## Technical Constraints
- Server-side rendering for SEO and initial page load performance
- Progressive enhancement approach (works without JavaScript)
- Bootstrap v5 component system and utility classes
- jQuery for legacy browser compatibility and plugin ecosystem
- CDN delivery for Bootstrap and jQuery (with local fallbacks)
EOF

# Create Node target users context
cat > "/tmp/test-worktree-node/docs/planning/phase2-target-users.md" << 'EOF'
# Target Users Analysis

## Primary User Personas
- **System Administrators**: Need comprehensive admin interface
- **Content Managers**: Require easy-to-use content editing tools
- **Business Analysts**: Need data visualization and reporting features

## Device Support Requirements
- Desktop: Primary interface (1200px+ layouts)
- Tablet: Secondary support with responsive sidebar collapse
- Mobile: Basic functionality with mobile-first Bootstrap patterns
- Browser Support: IE11+, Chrome, Firefox, Safari, Edge
EOF

# Create Node tech research context
cat > "/tmp/test-worktree-node/docs/planning/phase4-tech-research.md" << 'EOF'
# Technology Research

## Frontend Technologies
- Bootstrap v5.3.x with updated components and utilities
- jQuery 3.7.x for DOM manipulation and AJAX
- Chart.js for data visualization and analytics
- DataTables jQuery plugin for advanced table functionality
- Socket.io client for real-time features
- Font Awesome for icons and visual elements

## Backend Integration
- Express.js routing and middleware
- EJS templating with partials and layouts
- Express-session for authentication state
- CSRF protection middleware
- Express-validator for form validation
- Multer for file upload handling
EOF

# Create package.json for context
cat > "/tmp/test-worktree-node/package.json" << 'EOF'
{
  "name": "admin-dashboard",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "ejs": "^3.1.9",
    "bootstrap": "^5.3.0",
    "jquery": "^3.7.0",
    "socket.io": "^4.7.0",
    "express-session": "^1.17.3",
    "express-validator": "^7.0.1"
  }
}
EOF
```

## Expected Agent Call
```bash
ask subagent ui-designer "views/admin-panel.ejs" "node-admin-dashboard" "/tmp/test-worktree-node" "false"
```

## Expected Outputs to Validate

### 1. Bootstrap/jQuery Architecture Decisions
**Expected**: Recognition of server-rendered stack
- Framework decision: "Bootstrap v5 with jQuery"
- Styling decision: "Bootstrap v5 utility classes and components"
- JavaScript approach: "jQuery with progressive enhancement"
- Template system: "EJS server-side rendering"

### 2. Bootstrap-Compatible UI Specification
**Expected**: `docs/planning/ui-specs/admin-panel.ejs-ui-spec.md`
**Should contain**:
- Bootstrap v5 grid system and responsive breakpoints
- Component usage (cards, modals, forms, navigation)
- jQuery integration patterns for interactivity
- EJS templating patterns with partials
- Progressive enhancement strategies
- Bootstrap utility classes for styling

### 3. Node.js Implementation Guide
**Should include**:
- Complete EJS template structure with Bootstrap
- jQuery event handlers and AJAX patterns
- Express route handlers for data operations
- Bootstrap component integration examples
- Server-side validation with client feedback
- Socket.io real-time update patterns

### 4. Technology Stack Validation
**JSON return data should show**:
```json
{
  "framework": "Bootstrap v5",
  "framework_reason": "Existing project dependency with proven component system",
  "styling": "Bootstrap v5 utilities and components",
  "styling_reason": "Consistent design system with responsive patterns",
  "javascript_library": "jQuery",
  "constraints_detected": [
    "server_side_rendering",
    "legacy_browser_support",
    "bootstrap_component_system",
    "jquery_plugin_ecosystem"
  ]
}
```

## Validation Criteria
- [ ] Agent recognizes existing Bootstrap v5 dependency
- [ ] Framework decision uses Bootstrap (not React/Vue)
- [ ] jQuery is selected for JavaScript interactions
- [ ] EJS templating patterns are included
- [ ] Bootstrap component system is leveraged
- [ ] Server-side rendering approach is maintained
- [ ] Progressive enhancement patterns included
- [ ] AJAX patterns use jQuery syntax

## Success Metrics
- Agent adapts to traditional server-rendered stack
- Bootstrap v5 components and utilities are utilized effectively
- jQuery patterns for DOM manipulation and AJAX are included
- EJS templating with partials is documented
- Progressive enhancement approach is maintained
- Real-time features with Socket.io are integrated

## Expected Research Insights
- Bootstrap v5 best practices and new components
- jQuery performance optimization techniques
- Server-side rendering SEO benefits and patterns
- Progressive enhancement implementation strategies
- DataTables and Chart.js integration approaches