# Plan: User Notification Microservice

## Context

The monolith sends email and push notifications inline with request processing, causing
200-500ms latency spikes. Extract into a dedicated microservice consuming events from
RabbitMQ, sending via SendGrid (email) and Firebase (push).

## Current Architecture

- Node.js monolith handling all features
- Notifications sent synchronously during request handling
- ~15,000 notifications/day

## Files to Create

| File | Purpose |
|------|---------|
| `src/server.ts` | Queue consumer setup |
| `src/consumers/emailConsumer.ts` | Process email events |
| `src/consumers/pushConsumer.ts` | Process push events |
| `src/providers/sendgridProvider.ts` | SendGrid integration |
| `src/providers/firebaseProvider.ts` | Firebase push integration |
| `src/services/preferenceService.ts` | User notification preferences |
| `src/utils/templateRenderer.ts` | Render email templates |
| `Dockerfile` | Container image |

## Implementation Steps

### Step 1: Queue Consumer

Subscribe to RabbitMQ `notifications` exchange with topic routing:
- `email.*` routed to emailConsumer
- `push.*` routed to pushConsumer
- Message ACKed after processing

### Step 2: Email Consumer

Check user preferences (emailEnabled), render template with Handlebars,
send via SendGrid. Skip silently if user opted out.

### Step 3: Push Consumer

Check user preferences (pushEnabled, fcmToken), send via Firebase Admin SDK.

### Step 4: Providers

- SendGrid: `sgMail.send({ to, from, subject, html })`
- Firebase: `admin.messaging().send({ token, notification, data })`

### Step 5: Monolith Changes

Replace direct send calls with RabbitMQ publishes:
```typescript
channel.publish('notifications', 'email.welcome', Buffer.from(JSON.stringify({
  userId: user.id, email: user.email, template: 'welcome', data
})));
```

## Verification

- [ ] Service connects to RabbitMQ and consumes messages
- [ ] Email notifications dispatched via SendGrid
- [ ] Push notifications dispatched via Firebase
- [ ] User preferences respected (opt-out honored)
- [ ] Templates render correctly with dynamic data
- [ ] Dead letter queue catches failed messages
- [ ] Monolith response time drops by 200-500ms
