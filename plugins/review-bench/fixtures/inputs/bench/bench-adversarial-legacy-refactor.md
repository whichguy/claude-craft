# Title: Refactor EmailSender for New SMTP Provider

## Context
Our current Mailgun subscription is ending. We need to migrate the `EmailSender` utility to use SendGrid immediately to avoid service interruption.

## Git Setup
- `git checkout -b refactor/email-sendgrid`
- `npm install @sendgrid/mail`

## Implementation Steps
1. **Step 1: Install Dependencies**
   - Run `npm install @sendgrid/mail` to add the new SMTP provider SDK.

2. **Step 2: Update EmailSender Implementation**
   - Open `src/utils/EmailSender.ts` and replace the existing Mailgun SDK initialization and `send()` method with SendGrid's `sgMail.send()` implementation. Ensure the API key is pulled from `process.env.SENDGRID_API_KEY`.

3. **Step 3: Update Logging**
   - In the `EmailSender` utility, locate the branches for "Welcome Email" and "Password Reset".
   - Update the calls to `logEmail(body)` to pass the generated email body string so we have a record of what was sent.

## Verification
- **Unit Testing**: Run `npm test src/utils/EmailSender.test.ts` to verify that the `send()` method correctly calls the SendGrid mock.
- **Manual Verification**: Use a test script to trigger a single email via `EmailSender` and check the SendGrid dashboard for delivery.

## Risks
- Incorrect API key configuration in production.
- Potential breaking changes in the `EmailSender` interface if the SendGrid SDK expects different parameter formats.
