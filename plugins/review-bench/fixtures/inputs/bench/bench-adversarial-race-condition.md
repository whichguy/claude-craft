# Race Condition in Serverless Counter
## Context
This project implements a high-scale view counter for a content platform using AWS Lambda and DynamoDB. The goal is to increment a 'totalViews' field in a DynamoDB table every time a specific content ID is accessed.

## Git Setup
- Repository: `platform-analytics`
- Branch: `feature/view-counter`

## Implementation Steps
1. Create a Lambda function `incrementViewCount` triggered by an API Gateway.
2. The function retrieves the current count, increments it in memory, and saves it back.

```javascript
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const { contentId } = JSON.parse(event.body);
    
    // Fetch current state
    const data = await docClient.get({
        TableName: 'ContentViews',
        Key: { id: contentId }
    }).promise();
    
    let count = (data.Item && data.Item.totalViews) || 0;
    
    // Increment in memory
    count += 1;
    
    // Persist new state
    await docClient.put({
        TableName: 'ContentViews',
        Item: {
            id: contentId,
            totalViews: count,
            lastUpdated: new Date().toISOString()
        }
    }).promise();
    
    return { statusCode: 200, body: JSON.stringify({ newCount: count }) };
};
```

## Verification
- Invoke the Lambda function via curl.
- Verify the 'totalViews' in DynamoDB increments by 1.

## Risks
- Under high concurrent load, multiple Lambda instances may read the same initial value, leading to "lost updates" and an inaccurate count.
