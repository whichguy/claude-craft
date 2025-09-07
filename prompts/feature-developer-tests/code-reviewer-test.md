# Code Reviewer Test Prompt

Test the code-reviewer subagent with a realistic code review scenario.

## Test Parameters
- **file_path**: "src/utils/validation.js"
- **task_name**: "user-profile-dashboard"  
- **work_dir**: "/tmp/test-worktree"
- **dryrun**: "false"

## Test File Content
Create this mock file for the code-reviewer to analyze:

### Mock validation.js
```javascript
// User input validation utilities
function validateEmail(email) {
  return email.includes('@');
}

function validatePassword(password) {
  if (password.length > 6) {
    return true;
  }
  return false;
}

function sanitizeInput(input) {
  return input.trim();
}

module.exports = {
  validateEmail,
  validatePassword,
  sanitizeInput
};
```

## Expected Context Files
The code-reviewer should rehydrate from these mock IDEAL-STI files:

### Mock Architecture Decisions
```
# Architecture Decisions

## Code Quality Standards
- ESLint with Airbnb configuration
- Prettier for formatting
- JSDoc for function documentation
- Input validation for all user inputs
- Error handling with proper logging
```

### Mock Security Requirements
```
# Security Requirements

## Input Validation
- All user inputs must be validated and sanitized
- Email validation must use proper regex
- Password validation must enforce complexity rules
- XSS prevention through input sanitization
```

## Expected Agent Call
```bash
ask subagent code-reviewer "src/utils/validation.js" "user-profile-dashboard" "/tmp/test-worktree" "false"
```

## Expected Outputs to Validate

### 1. Code Review Report
**Expected**: `docs/planning/reviews/validation.js-review.md`
**Should contain**:
- Overall code quality assessment
- Security vulnerabilities identified
- Performance considerations
- Code style and formatting issues
- Documentation gaps
- Architecture compliance
- Specific improvement recommendations

### 2. Review Manifest File
**Expected**: `docs/planning/review-manifests/validation.js-review-manifest.json`
**Should contain**:
```json
{
  "file_path": "src/utils/validation.js",
  "review_status": "CHANGES_REQUIRED",
  "quality_score": 65,
  "approval_status": "CHANGES_REQUIRED",
  "issues_found": {
    "security": ["weak_email_validation", "insufficient_password_rules"],
    "quality": ["missing_documentation", "no_error_handling"],
    "performance": [],
    "style": ["inconsistent_return_patterns"]
  },
  "required_changes": [
    "Implement proper email regex validation",
    "Add password complexity requirements", 
    "Add JSDoc documentation",
    "Add input validation error handling"
  ],
  "related_files_analyzed": ["src/api/userService.ts", "src/components/UserForm.jsx"]
}
```

### 3. Specific Issues Expected
The reviewer should identify:
- **Security**: Weak email validation (should use proper regex)
- **Security**: Password validation too simple (no complexity rules)
- **Quality**: Missing JSDoc documentation
- **Quality**: No error handling for invalid inputs
- **Style**: Inconsistent return patterns

### 4. Fallback Handling
If agent fails, should create:
**Expected**: `docs/planning/reviews/validation.js-review.md` with basic fallback content

## Expected Feedback Loop
If review status is "CHANGES_REQUIRED", the feature-developer should:
1. Call `apply_review_feedback()` 
2. Apply simple improvements to the code
3. Add TODO comments for manual fixes
4. Retry the review (up to 3 attempts)

## Validation Criteria
- [ ] Agent executes without errors  
- [ ] Review identifies actual security issues
- [ ] Quality assessment is reasonable (60-70 range for this code)
- [ ] Required changes are specific and actionable
- [ ] Review manifest has valid JSON structure
- [ ] Related files are identified correctly
- [ ] Approval status reflects code quality accurately
- [ ] Fallback is created if agent fails
- [ ] Feedback application works correctly

## Success Metrics
- Agent completes in < 20 seconds
- Review identifies 4-6 specific issues
- Security issues are correctly flagged
- Recommendations are implementable
- Related files analysis is accurate
- Feedback loop improves code quality