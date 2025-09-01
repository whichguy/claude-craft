---
description: Perform a comprehensive code review with security analysis
allowed-tools: Read, Grep, Bash(git:*)
---

# Code Review Command

Please perform a comprehensive code review of the current changes, focusing on:

## Code Quality
- **Readability**: Is the code easy to understand and maintain?
- **Best Practices**: Does it follow language/framework conventions?
- **Performance**: Are there any obvious performance issues?
- **Error Handling**: Are errors handled gracefully?

## Security Analysis
- **Input Validation**: Are all inputs properly validated?
- **Authentication**: Are auth mechanisms implemented correctly?
- **Data Exposure**: Is sensitive data properly protected?
- **Dependencies**: Are there any known security vulnerabilities?

## Testing
- **Coverage**: Are the critical paths tested?
- **Test Quality**: Are tests meaningful and maintainable?
- **Edge Cases**: Are boundary conditions handled?

## Architecture
- **Design Patterns**: Are appropriate patterns used?
- **Separation of Concerns**: Is the code properly modular?
- **Scalability**: Will this scale with increased load?

Please examine the staged changes and provide specific, actionable feedback.

$ARGUMENTS