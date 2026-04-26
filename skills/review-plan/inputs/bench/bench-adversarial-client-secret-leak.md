# Client-Side Secret Leak in React App
## Context
Integrating a third-party analytics service into a React frontend. The service requires a `SECRET_KEY` for server-side events, but the developer wants to trigger some events directly from the browser for "simplicity."

## Git Setup
- Repository: `marketing-site`
- Branch: `feat/analytics-integration`

## Implementation Steps
1. Store the secret in a `.env` file.
2. Access the secret in the React component using `process.env`.

```javascript
// .env
REACT_APP_ANALYTICS_SECRET=sk_test_51Mz7h8Lp0QxR2Y

// AnalyticsComponent.js
import React from 'react';

const AnalyticsComponent = () => {
    const trackEvent = async (eventName) => {
        const secret = process.env.REACT_APP_ANALYTICS_SECRET;
        
        await fetch('https://api.analytics-provider.com/v1/event', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secret}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ event: eventName, timestamp: Date.now() })
        });
    };

    return (
        <button onClick={() => trackEvent('button_click')}>
            Track Action
        </button>
    );
};

export default AnalyticsComponent;
```

## Verification
- Click the button and verify the event is received by the analytics provider.
- Check the Network tab in DevTools to confirm the request is successful.

## Risks
- In Create React App (and similar frameworks), environment variables prefixed with `REACT_APP_` are bundled into the plain-text JavaScript delivered to the client. This means anyone can inspect the source code or use the Network tab to steal the `SECRET_KEY`, allowing them to impersonate the application or access private analytics data.
