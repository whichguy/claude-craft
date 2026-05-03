# Webhook Idempotency Missing in Payment Flow
## Context
Integration with Stripe to handle `checkout.session.completed` events. When a user completes a purchase, this webhook triggers the provisioning of premium features in our backend database.

## Git Setup
- Repository: `billing-service`
- Branch: `fix/stripe-webhooks`

## Implementation Steps
1. Define a POST endpoint `/webhooks/stripe`.
2. Parse the Stripe event and check the event type.
3. If `checkout.session.completed`, update the user's subscription status.

```typescript
import express from 'express';
import { updateSubscription } from './db';

const router = express.Router();

router.post('/stripe', async (req, res) => {
    const event = req.body;

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const customerEmail = session.customer_details.email;

        // Provisioning logic
        console.log(`Provisioning for ${customerEmail}`);
        await updateSubscription(customerEmail, 'premium');
        
        return res.status(200).send({ received: true });
    }

    res.status(200).send({ received: true });
});

export default router;
```

## Verification
- Use Stripe CLI to trigger a test webhook.
- Check the database to see if the user is updated to 'premium'.

## Risks
- Stripe retries webhooks if a 2xx response isn't received promptly or if the connection fails. Without checking the `event.id` for deduplication, a single purchase could trigger multiple provisioning operations, potentially causing side effects in other systems (e.g., sending multiple welcome emails).
