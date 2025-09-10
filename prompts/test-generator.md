---
argument-hint: "[context...]"
description: "Generate tests based on intent interpretation"
allowed-tools: "all"
---

# Test Generator

<prompt-arguments>

## Intent Recognition
Parse context for test requirements:
- "unit" → Unit tests for functions
- "integration" → Integration tests
- "edge" → Edge cases and boundaries
- "mock" → Tests with mocking
- "coverage" → High coverage tests
- Framework mentions (jest, mocha, pytest) → Use specific framework

## Test Generation

Generate tests matching intent:

**Unit Tests:**
```javascript
describe('[Function Name]', () => {
  it('should [expected behavior]', () => {
    // Arrange
    const input = ...;
    
    // Act
    const result = functionName(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

**Edge Cases:**
```javascript
it('handles null input', () => {
  expect(() => func(null)).toThrow();
});

it('handles empty array', () => {
  expect(func([])).toEqual([]);
});
```

**Mocked Tests:**
```javascript
jest.mock('./module');
it('calls dependency correctly', () => {
  const spy = jest.spyOn(module, 'method');
  // test logic
  expect(spy).toHaveBeenCalledWith(args);
});
```

## Output Format

Return ONLY test code:
- NO explanation text
- Include all imports at top
- Group related tests in describe blocks
- Ready to paste into test file