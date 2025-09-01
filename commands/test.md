---
description: Generate comprehensive tests for the specified code
allowed-tools: Read, Write, Bash(npm test:*), Bash(pytest:*), Bash(cargo test:*)
argument-hint: [file-path] or [function-name]
---

# Test Generation Command

Generate comprehensive tests for the specified code or functionality:

## Test Strategy

### Test Types to Generate
1. **Unit Tests**: Individual function/method testing
2. **Integration Tests**: Component interaction testing  
3. **Edge Cases**: Boundary conditions and error scenarios
4. **Performance Tests**: Load and stress testing (if applicable)

### Test Coverage Areas
- **Happy Path**: Normal operation scenarios
- **Error Handling**: Exception and error conditions
- **Boundary Values**: Min/max values, empty inputs
- **State Management**: Object state transitions
- **Concurrent Access**: Thread safety (if applicable)

### Test Quality Standards
- **Descriptive Names**: Tests clearly describe what they verify
- **Arrange-Act-Assert**: Clear test structure
- **Independent Tests**: No test dependencies
- **Meaningful Assertions**: Verify actual business logic
- **Mock External Dependencies**: Database, APIs, file system

## Analysis Target
Target for test generation: ${1:-"recently modified files"}

## Instructions
1. Analyze the specified code structure and functionality
2. Identify testable units and integration points
3. Generate appropriate test cases with proper setup/teardown
4. Include both positive and negative test scenarios
5. Ensure tests follow project conventions and frameworks

Generate tests for: $ARGUMENTS