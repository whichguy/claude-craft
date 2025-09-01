# Clean Test Data

This file contains safe, non-sensitive information for testing.

## Development Preferences
- Use async/await over promises
- Prefer const over let
- Follow TDD practices
- Write clean, maintainable code

## API Configuration
- API endpoint: `${API_ENDPOINT}`
- API key: `${API_KEY}`
- Database URL: `${DATABASE_URL}`

## Example User Data
- Email: user@example.com
- Phone: xxx-xxx-xxxx
- Address: 123 Example Street, Example City

## Technical Documentation
- The system uses JWT tokens for authentication
- Database connections are pooled for efficiency
- All passwords must be hashed using bcrypt
- Environment variables are used for configuration

## Safe Code Examples
```javascript
const apiKey = process.env.API_KEY;
const dbConnection = process.env.DATABASE_URL;

function hashPassword(password) {
    return bcrypt.hash(password, 10);
}
```

## Project Information
- Repository: github.com/example/project
- Documentation: docs.example.com
- Support: support@example.com

This content should NOT trigger any security warnings.