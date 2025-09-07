# Feature Developer Test Runner

Comprehensive test suite with environment setup using shell operations.

## Test 1: UI Designer Validation

### Setup Environment
```bash
!mkdir -p /tmp/test-worktree/docs/planning
!mkdir -p /tmp/test-worktree/src/components
!mkdir -p /tmp/test-worktree/tasks/pending

# Create mock task file
!cat > /tmp/test-worktree/tasks/pending/user-profile-dashboard.md << 'EOF'
# User Profile Dashboard
## Goal
Create a comprehensive user profile component with editing capabilities
## Priority: High
## Effort: Medium
## Acceptance Criteria
- [ ] Display user profile information
- [ ] Allow inline editing
- [ ] Validate form inputs
- [ ] Handle loading states
EOF

# Create mock architecture context
!cat > /tmp/test-worktree/docs/planning/phase7-architecture.md << 'EOF'
# Architecture Decisions
## Frontend Framework
- **Selected**: React 18 with TypeScript
- **State Management**: Zustand for global state  
- **Styling**: Tailwind CSS with custom components
- **Component Architecture**: Atomic design principles
EOF

# Create mock tech research
!cat > /tmp/test-worktree/docs/planning/phase4-tech-research.md << 'EOF'
# Technology Stack
## Frontend Technologies
- React 18.2.0
- TypeScript 5.0
- Tailwind CSS 3.3
- Headless UI components
- React Hook Form for form management
EOF
```

### Execute Test
```bash
ask subagent ui-designer "src/components/UserProfile.jsx" "user-profile-dashboard" "/tmp/test-worktree" "false"
```

### Validate Results
```bash
!ls -la /tmp/test-worktree/docs/planning/ui-specs/
!ls -la /tmp/test-worktree/docs/planning/ui-manifests/
!cat /tmp/test-worktree/docs/planning/ui-specs/UserProfile.jsx-ui-spec.md
```

---

## Test 2: QA Analyst Validation  

### Setup Target File
```bash
!cat > /tmp/test-worktree/src/api/userService.ts << 'EOF'
import axios from 'axios';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export class UserService {
  private baseURL = '/api/users';

  async getUserProfile(userId: string): Promise<User> {
    const response = await axios.get(`${this.baseURL}/${userId}`);
    return response.data;
  }

  async updateUserProfile(userId: string, userData: Partial<User>): Promise<User> {
    const response = await axios.put(`${this.baseURL}/${userId}`, userData);
    return response.data;
  }

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('avatar', file);
    
    const response = await axios.post(`${this.baseURL}/${userId}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    return response.data.avatarUrl;
  }
}
EOF

# Create package.json for framework detection
!cat > /tmp/test-worktree/package.json << 'EOF'
{
  "name": "test-project",
  "scripts": {
    "test": "jest",
    "test:integration": "jest --config jest.integration.config.js"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@testing-library/react": "^13.0.0",
    "supertest": "^6.0.0"
  }
}
EOF
```

### Execute Test
```bash
ask subagent qa-analyst "src/api/userService.ts" "user-profile-dashboard" "/tmp/test-worktree" "false"
```

### Validate Results
```bash
!ls -la /tmp/test-worktree/docs/planning/test-plans/
!ls -la /tmp/test-worktree/docs/planning/qa-manifests/
!cat /tmp/test-worktree/docs/planning/test-plans/userService.ts-test-plan.md
```

---

## Test 3: Code Reviewer Validation

### Setup Target File with Issues
```bash
!cat > /tmp/test-worktree/src/utils/validation.js << 'EOF'
// User input validation utilities - intentionally flawed for testing
function validateEmail(email) {
  // ISSUE: Weak validation
  return email.includes('@');
}

function validatePassword(password) {
  // ISSUE: Too simple, no complexity rules
  if (password.length > 6) {
    return true;
  }
  return false;
}

function sanitizeInput(input) {
  // ISSUE: Insufficient sanitization
  return input.trim();
}

// ISSUE: Missing JSDoc documentation
module.exports = {
  validateEmail,
  validatePassword,
  sanitizeInput
};
EOF

# Create related files for dependency analysis
!cat > /tmp/test-worktree/src/components/UserForm.jsx << 'EOF'
import React from 'react';
import { validateEmail, validatePassword } from '../utils/validation';

export const UserForm = () => {
  const handleSubmit = (data) => {
    if (!validateEmail(data.email)) {
      throw new Error('Invalid email');
    }
    // More form logic...
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
};
EOF
```

### Execute Test
```bash
ask subagent code-reviewer "src/utils/validation.js" "user-profile-dashboard" "/tmp/test-worktree" "false"  
```

### Validate Results
```bash
!ls -la /tmp/test-worktree/docs/planning/reviews/
!cat /tmp/test-worktree/docs/planning/reviews/validation.js-review.md
!cat /tmp/test-worktree/docs/planning/review-manifests/validation.js-review-manifest.json
```

---

## Test 4: Feature Developer Integration Test

### Complete Environment Setup
```bash
!rm -rf /tmp/test-worktree 
!mkdir -p /tmp/test-worktree/{docs/planning,src/{components,api,utils},tasks/pending,tests/{unit,integration}}

# Create comprehensive task file
!cat > /tmp/test-worktree/tasks/pending/user-profile-enhancement.md << 'EOF'
# User Profile Enhancement

## Goal
Add comprehensive user profile management with avatar upload and privacy controls.

## Epic: user-management
## Story: profile-enhancement  
## Priority: High
## Effort: Medium
## Dependencies: authentication-system, file-upload-service

## Acceptance Criteria
- [ ] User can view their complete profile information
- [ ] User can edit profile fields (name, email, bio)
- [ ] User can upload and crop profile avatar
- [ ] User can set privacy controls for profile visibility
- [ ] System validates all input data
- [ ] Changes are saved with optimistic updates
- [ ] Profile changes are reflected across the application

## Technical Requirements
- React component with form validation
- API endpoints for profile CRUD operations
- Image upload and processing
- Database schema updates for new fields
- Integration tests for all workflows
EOF

# Create full IDEAL-STI context
!cat > /tmp/test-worktree/docs/planning/phase7-architecture.md << 'EOF'
# Architecture Decisions

## Frontend Stack
- React 18 with TypeScript
- Zustand for state management
- React Hook Form for form handling  
- Tailwind CSS for styling
- React Query for server state

## Backend Stack
- Node.js with Express
- PostgreSQL database
- Multer for file uploads
- Sharp for image processing
- JWT authentication

## File Organization
- Components: src/components/
- API: src/api/
- Utils: src/utils/
- Types: src/types/
EOF

!cat > /tmp/test-worktree/docs/planning/phase4-tech-research.md << 'EOF'
# Technology Research

## Frontend Framework Analysis
Selected React for:
- Component reusability
- Strong TypeScript support
- Rich ecosystem for forms and uploads

## Image Processing
Selected Sharp for:
- High performance  
- Multiple format support
- Built-in cropping and resizing
EOF

!cat > /tmp/test-worktree/docs/planning/phase5-requirements.md << 'EOF'
# Requirements Analysis

## Functional Requirements
- FR1: Profile viewing and editing
- FR2: Avatar upload with cropping
- FR3: Privacy controls
- FR4: Input validation
- FR5: Optimistic updates

## Non-Functional Requirements
- NFR1: Upload time < 3 seconds
- NFR2: Image processing < 1 second  
- NFR3: Mobile responsive design
EOF

# Create project configuration
!cat > /tmp/test-worktree/package.json << 'EOF'
{
  "name": "user-profile-app",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-hook-form": "^7.0.0",
    "zustand": "^4.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@testing-library/react": "^13.0.0",
    "@testing-library/jest-dom": "^5.0.0"
  }
}
EOF
```

### Execute Full Integration Test
```bash
ask subagent feature-developer "tasks/pending/user-profile-enhancement.md" "/tmp/test-worktree" "false"
```

### Comprehensive Validation
```bash
echo "=== Phase 1: Context Rehydration ==="
!ls -la /tmp/test-worktree/docs/planning/feature-context-*

echo "=== Phase 3: Implementation Plan ==="  
!ls -la /tmp/test-worktree/docs/planning/feature-implementation-plan-*

echo "=== Phase 4: Plan Review ==="
!ls -la /tmp/test-worktree/docs/planning/plan-review-*

echo "=== Phase 7: Implementation Files ==="
!ls -la /tmp/test-worktree/src/components/
!ls -la /tmp/test-worktree/src/api/

echo "=== Phase 8: Code Reviews ==="
!ls -la /tmp/test-worktree/docs/planning/reviews/
!ls -la /tmp/test-worktree/docs/planning/review-manifests/

echo "=== Phase 9: Test Implementation ==="
!ls -la /tmp/test-worktree/tests/unit/
!ls -la /tmp/test-worktree/tests/integration/

echo "=== Phase 12: Final Report ==="
!ls -la /tmp/test-worktree/docs/planning/final-implementation-report-*

echo "=== Implementation Log Analysis ==="
!cat /tmp/test-worktree/docs/planning/implementation-log-* 2>/dev/null || echo "No implementation log found"

echo "=== Test Results ==="
!cat /tmp/test-worktree/docs/planning/test-results-log-* 2>/dev/null || echo "No test results found"
```

---

## Quick Test Script

For rapid testing of individual agents:

```bash
# Setup minimal environment
!mkdir -p /tmp/quick-test/{docs/planning,src,tasks/pending}

# Quick agent test
!cat > /tmp/quick-test/src/example.js << 'EOF'
function add(a, b) {
  return a + b;
}
module.exports = { add };
EOF

# Test any agent quickly  
ask subagent code-reviewer "src/example.js" "quick-test" "/tmp/quick-test" "false"

# Check results
!find /tmp/quick-test -name "*.md" -exec echo "=== {} ===" \; -exec cat {} \;
```

## Cleanup After Tests
```bash
!rm -rf /tmp/test-worktree /tmp/quick-test
echo "Test environments cleaned up"
```

## Expected Test Outcomes

### Success Criteria
- [ ] All agents execute without errors
- [ ] Proper file structure created in worktree
- [ ] No `cd`/`pushd` commands used (check agent logs)
- [ ] Agent signatures are correct
- [ ] Fallbacks are created when agents fail
- [ ] Feedback loops improve code quality
- [ ] Integration test completes all 12 phases

### Failure Analysis  
If tests fail, check:
1. **Agent signature errors**: Verify 5-parameter format
2. **Path issues**: Ensure worktree paths are used correctly
3. **Context rehydration**: Verify IDEAL-STI files are read
4. **Fallback creation**: Confirm fallbacks work when agents fail
5. **Output structure**: Validate expected files are created