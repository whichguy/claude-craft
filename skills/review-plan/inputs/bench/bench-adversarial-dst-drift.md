# DST Drift in Scheduled Reporting Job
## Context
A daily reporting job that aggregates yesterday's sales and sends a summary to stakeholders. The job is scheduled via `cron` to run at 00:05 AM every day.

## Git Setup
- Repository: `data-warehouse`
- Branch: `chore/daily-reports`

## Implementation Steps
1. Set up a Node.js script using `node-cron`.
2. Calculate the "yesterday" time range using standard Date objects.

```javascript
const cron = require('node-cron');
const moment = require('moment'); // Using moment for "convenience"

cron.schedule('5 0 * * *', async () => {
    console.log('Running daily report...');
    
    // Calculate 24 hours ago
    const endTime = moment().startOf('day');
    const startTime = moment(endTime).subtract(1, 'day');
    
    const reports = await db.query(
        'SELECT * FROM sales WHERE created_at >= ? AND created_at < ?',
        [startTime.format(), endTime.format()]
    );
    
    await sendEmail(reports);
});
```

## Verification
- Run the script manually to ensure it fetches the last 24 hours of data.
- Verify the email is sent with the correct sales data.

## Risks
- The script uses local system time. When Daylight Saving Time (DST) changes, the "24 hours ago" logic might miss an hour or double-count an hour if not explicitly handling UTC or timezone offsets, leading to inaccurate daily totals twice a year.
