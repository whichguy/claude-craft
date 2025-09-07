# QA Analyst Test Prompt

Test the qa-analyst subagent with a realistic testing scenario.

## Test Parameters
- **file_path**: "src/api/userService.ts"
- **task_name**: "user-profile-dashboard"
- **work_dir**: "/tmp/test-worktree"
- **dryrun**: "false"

## Expected Context Files
The qa-analyst should rehydrate from these mock IDEAL-STI files:

### Mock Implementation Plan
```
# Feature Implementation Plan: user-profile-dashboard

## API Implementation
**Required**: Yes
- REST endpoints for user profile CRUD
- Authentication middleware
- Input validation and sanitization
- Error handling with proper HTTP status codes

## Success Criteria
- [ ] User can view their profile data
- [ ] User can update profile information
- [ ] System validates input data
- [ ] API returns proper error messages
- [ ] Performance: API responds within 200ms
```

### Mock Requirements
```
# Requirements: user-profile-dashboard

## Functional Requirements
- FR1: Display user profile information
- FR2: Allow profile editing
- FR3: Validate email format
- FR4: Handle concurrent updates

## Non-Functional Requirements  
- NFR1: API response time < 200ms
- NFR2: 99.9% uptime
- NFR3: GDPR compliant data handling
```

## Expected Agent Call
```bash
ask subagent qa-analyst "src/api/userService.ts" "user-profile-dashboard" "/tmp/test-worktree" "false"
```

## Expected Outputs to Validate

### 1. Test Plan File
**Expected**: `docs/planning/test-plans/userService.ts-test-plan.md`
**Should contain**:
- Unit test scenarios for each function
- Integration test cases for API endpoints
- Error handling test cases
- Performance test requirements
- Security test considerations
- Edge cases and boundary conditions

### 2. Test Manifest File
**Expected**: `docs/planning/qa-manifests/userService.ts-qa-manifest.json`
**Should contain**:
```json
{
  "file_type": "api_service",
  "test_framework": "jest",
  "test_cases_count": 15,
  "coverage_target": "95%",
  "test_categories": {
    "unit": 8,
    "integration": 4,
    "security": 2,
    "performance": 1
  },
  "critical_paths": ["getUserProfile", "updateUserProfile"],
  "test_infrastructure": ["jest", "supertest", "nock"]
}
```

### 3. Test Research Analysis
**Expected**: Integration of existing test infrastructure detection
**Should analyze**:
- package.json for existing test frameworks
- Test directory structure
- Mock/fixture patterns
- CI/CD test integration

### 4. Fallback Handling
If agent fails, should create:
**Expected**: `docs/planning/test-plans/userService.ts-test-plan.md` with basic fallback content

## Validation Criteria
- [ ] Agent executes without errors
- [ ] Test plan covers all critical scenarios
- [ ] Test cases align with acceptance criteria
- [ ] Framework recommendations match project setup
- [ ] Performance and security tests included
- [ ] Test manifest has valid JSON structure
- [ ] Infrastructure analysis is realistic
- [ ] Fallback is created if agent fails

## Success Metrics
- Agent completes in < 45 seconds
- Test plan is comprehensive and executable
- Coverage targets are realistic (80-95%)
- Test cases map to acceptance criteria
- Technology recommendations match project stack