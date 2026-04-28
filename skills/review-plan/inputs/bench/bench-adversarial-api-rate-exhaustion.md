# API Rate Limit Exhaustion in Bulk Sync
## Context
A data migration tool designed to sync 50,000+ records from a legacy CRM to a modern SaaS platform via their REST API.

## Git Setup
- Repository: `migration-tools`
- Branch: `feat/crm-sync`

## Implementation Steps
1. Fetch all records from the legacy database.
2. Use `Promise.all` with a small batch size to push records to the new API.

```javascript
const axios = require('axios');

async function syncRecords(records) {
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        console.log(`Syncing batch starting at ${i}...`);
        
        await Promise.all(batch.map(record => {
            return axios.post('https://api.saas-platform.com/v1/records', record, {
                headers: { 'Authorization': `Bearer ${process.env.API_KEY}` }
            });
        }));
    }
    console.log('Sync complete!');
}
```

## Verification
- Run the script with 100 test records and verify they appear in the destination system.

## Risks
- The target API likely has a rate limit (e.g., 100 requests per minute). This script makes calls as fast as the network allows without checking for `429 Too Many Requests` responses or implementing an exponential backoff strategy. For a 50,000 record sync, the tool will inevitably crash or be throttled, resulting in a partial and inconsistent migration.
