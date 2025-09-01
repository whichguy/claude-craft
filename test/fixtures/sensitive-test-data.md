# Test Data - Sensitive Information Examples

This file contains various types of sensitive information for testing the security scanner.

## API Keys and Tokens

### Anthropic API Keys
- Production key: sk-ant-api03-FAKE_KEY_FOR_TESTING_DO_NOT_USE_REAL_KEYS_IN_TESTS_ABCDEFGHIJKLMNOPQRSTUVWXYZ-FakeKeyAAA
- Test key: sk-ant-api02-FAKE123456789abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ

### OpenAI Keys
- API Key: sk-proj-FAKE_OPENAI_KEY_FOR_TESTING_ONLY_DO_NOT_USE_REAL_API_KEYS_IN_VERSION_CONTROL_FakeKey123456
- Legacy key: sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ

### GitHub Tokens
- Personal access token: ghp_1234567890abcdefghijklmnopqrstuvwxyz12
- GitHub App token: ghs_16C7e42F292c6912E4235c46c7e19432b8d0A3
- OAuth token: ghu_1234567890abcdefghijklmnopqrstuvwxyz12

### AWS Credentials
- Access Key ID: AKIAIOSFODNN7EXAMPLE
- Secret: aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

### Database Connections
- PostgreSQL: postgres://myuser:mypassword123@localhost:5432/mydatabase
- MongoDB: mongodb://admin:SuperSecret123@cluster0.mongodb.net/production
- MySQL: mysql://root:toor@192.168.1.100:3306/customers

### JWT Token
- Bearer token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

## Personal Information

### Identity Details
- My name is John Michael Smith
- I was born on March 15, 1985
- My social security number is 123-45-6789
- Driver's license: D1234567 (California)

### Contact Information
- Personal email: john.smith.personal@gmail.com
- Work email: jsmith@techcorp.com
- Phone number: (555) 123-4567
- Mobile: +1-415-555-0123

### Address Information
- I live at 742 Evergreen Terrace, Springfield, IL 62701
- Previous address: 123 Main Street, Apt 4B, San Francisco, CA 94102
- Work address: TechCorp Inc, 1 Infinite Loop, Cupertino, CA 95014

### Family Information
- My wife's name is Sarah Johnson Smith
- My dog's name is Max
- My cat is called Whiskers
- Kids: Emma (age 8) and Lucas (age 6)

### Financial Information
- Credit card: 4532 1234 5678 9010
- Bank account: 12345678 (routing: 021000021)
- PayPal: john.smith@paypal.com
- Bitcoin wallet: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa

### Employment Details
- I work at Google as a Senior Software Engineer
- Previously worked at Facebook from 2015-2020
- Studied at MIT, graduated in 2007
- Employee ID: GOOG-123456

### Medical Information
- Blood type: O+
- Allergic to penicillin
- Taking medication for high blood pressure

## Mixed Context Examples

Here's my development setup:
- API endpoint: https://api.mycompany.com
- Auth token: Bearer sk-live-51234567890abcdefghijklmnop
- My personal GitHub: github.com/johnsmith85
- I live in Seattle and work at Amazon
- Contact me at john@example.com or call 206-555-1234

## Password Examples
- password = "SuperSecret123!"
- admin_password: "admin123"
- database_password = "MyD@tabase2024!"
- secret = "this-is-my-secret-key"

## Private Keys

```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyz
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----
```

## Safe Information Examples

These should NOT trigger warnings:
- Development preferences
- Code patterns and best practices
- Public documentation
- Example with placeholder: api_key = "${API_KEY}"
- Generic email: user@example.com
- Placeholder phone: xxx-xxx-xxxx