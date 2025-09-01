# Development Principles

## Knowledge Discovery Protocol

**ALWAYS** check for knowledge directories when starting work:
- `./knowledge/` - Current project knowledge  
- `../knowledge/` or `../../knowledge/` - Project family knowledge
- `~/knowledge/` - User-level knowledge
- Git repos named "knowledge" - Specialized knowledge bases

Read all `.md` files in discovered directories and incorporate relevant context into decision-making.

## Code Quality Standards
- Always write tests before implementing features (TDD)
- Use meaningful variable and function names
- Keep functions small and focused on a single responsibility
- Comment complex logic but avoid obvious comments

## Security Guidelines
- Never log or expose sensitive data
- Validate all inputs at system boundaries
- Use parameterized queries for database operations
- Implement proper authentication and authorization

## Performance Considerations
- Profile before optimizing
- Consider time and space complexity
- Cache expensive operations when appropriate
- Use async/await for I/O operations