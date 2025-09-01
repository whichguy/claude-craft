# Project Conventions

## Code Style Guidelines

### JavaScript/TypeScript
- Use ES6+ features consistently
- Prefer `const` over `let`, avoid `var`
- Use async/await over Promises chains
- Implement proper error handling with try-catch
- Use descriptive variable names

### File Organization
- Group related functionality in modules
- Keep files focused on single responsibility  
- Use consistent naming conventions
- Maintain clear directory structure

### Documentation Standards
- Write self-documenting code with clear names
- Add JSDoc comments for public APIs
- Include README files for major components
- Document complex business logic

### Testing Practices
- Write tests for all public functions
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Maintain good test coverage
- Test both happy path and error conditions

### Git Workflow
- Use meaningful commit messages
- Keep commits small and focused
- Create feature branches for new work
- Use pull requests for code review

## Architecture Principles

### Separation of Concerns
- Business logic separate from presentation
- Data access layer abstraction
- Clear API boundaries

### Error Handling
- Fail fast with clear error messages
- Log errors appropriately
- Implement graceful degradation
- Validate inputs at boundaries

### Performance Considerations
- Profile before optimizing
- Cache appropriately
- Minimize database queries
- Use efficient algorithms

These conventions ensure consistent, maintainable, and high-quality code across all projects.