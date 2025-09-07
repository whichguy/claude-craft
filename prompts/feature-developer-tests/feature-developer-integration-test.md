# Feature Developer Integration Test

Test the complete feature-developer workflow with realistic end-to-end scenario.

## Test Parameters
- **task_file**: "tasks/pending/user-profile-enhancement.md"
- **worktree_dir**: "/tmp/test-worktree"  
- **dryrun**: "false"

## Mock Test Environment Setup

### Create Mock Task File
**File**: `/tmp/test-worktree/tasks/pending/user-profile-enhancement.md`
```markdown
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
```

### Create Mock IDEAL-STI Context Files
**Directory**: `/tmp/test-worktree/docs/planning/`

#### phase7-architecture.md
```markdown
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
```

#### phase4-tech-research.md
```markdown
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
```

#### phase5-requirements.md
```markdown
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
```

## Expected Agent Execution Flow

### Phase 1: Context Rehydration
Should create: `docs/planning/feature-context-user-profile-enhancement.md`

### Phase 2: UI Planning  
Should determine UI is needed and prepare for ui-designer calls

### Phase 3: Implementation Plan
Should create: `docs/planning/feature-implementation-plan-user-profile-enhancement.md`
**Expected sections**:
- API Implementation (required)
- Storage Implementation (required)  
- UI Implementation (required)
- Tooling & Configuration
- Security Implementation
- Testing Strategy

### Phase 4: Plan Review
Should create: `docs/planning/plan-review-user-profile-enhancement.md`
**Expected analysis**:
- Task-plan alignment check
- Acceptance criteria coverage
- Effort-complexity alignment
- Ultra-think refinements

### Phase 7: File Implementation
**Expected files to implement**:
- `src/components/UserProfileComponent.jsx`
- `src/api/user-profile-enhancement.js`
- `src/storage/user-profile-enhancement-storage.js`

For each file:
1. **UI Designer** call (for UI files)
2. **QA Analyst** call (all files)
3. **File implementation**

### Phase 8: Code Review
For each implemented file:
1. **Code Reviewer** call
2. **Feedback loop** (up to 3 attempts)
3. **Review logging**

### Phase 9-10: Testing
1. **Test implementation**
2. **Test execution** (up to 5 iterations)
3. **Failure analysis and fixes**

### Phase 11-12: Documentation & Reporting
1. **Documentation updates**
2. **Final report generation**

## Expected Agent Call
```bash
ask subagent feature-developer "tasks/pending/user-profile-enhancement.md" "/tmp/test-worktree" "false"
```

## Critical Validation Points

### 1. Worktree Path Discipline
- [ ] No `cd`, `pushd`, or `popd` commands used
- [ ] All file operations use full paths: `/tmp/test-worktree/...`
- [ ] All subagent calls include proper work_dir parameter

### 2. Agent Integration  
- [ ] UI Designer called for .jsx files
- [ ] QA Analyst called for all files
- [ ] Code Reviewer called for all files with related files
- [ ] Proper agent signatures: `ask subagent <agent> "<file>" "<task>" "<work_dir>" "<dryrun>"`

### 3. Feedback Loops
- [ ] Code review feedback applied automatically
- [ ] Up to 3 review attempts per file
- [ ] Simple feedback patterns applied correctly
- [ ] Review status properly tracked

### 4. Optimistic Execution
- [ ] Agents called with positive expectations
- [ ] Fallbacks created when agents fail
- [ ] Execution continues despite agent failures
- [ ] Built-in parallel execution used correctly

### 5. Output Quality
- [ ] Implementation plan is comprehensive
- [ ] All acceptance criteria addressed
- [ ] Files are implemented with proper structure
- [ ] Tests are created and executed
- [ ] Final report is detailed and accurate

## Expected Execution Time
- **Total runtime**: 5-10 minutes
- **Phase 1-6**: 2-3 minutes (planning)
- **Phase 7**: 3-4 minutes (implementation + reviews)  
- **Phase 8-12**: 2-3 minutes (testing + documentation)

## Success Metrics
- [ ] All 12 phases complete successfully
- [ ] 3 implementation files created
- [ ] Agent calls use correct signatures
- [ ] No directory changes (cd/pushd) used
- [ ] Feedback loops improve code quality
- [ ] Final report shows comprehensive results
- [ ] Fallbacks handle any agent failures gracefully

## Failure Analysis
If any phase fails, analyze:
- Agent signature correctness
- Path handling (worktree discipline)
- Context rehydration accuracy  
- Fallback creation
- Error handling and recovery