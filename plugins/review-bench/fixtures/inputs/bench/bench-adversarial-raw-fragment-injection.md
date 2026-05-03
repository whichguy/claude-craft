# SQL Injection via Raw Fragment
## Context
Enhancing the search functionality of a CRM to support advanced filtering. For "performance reasons," the developer decided to use a raw SQL fragment for a specific complex filter.

## Git Setup
- Repository: `crm-core`
- Branch: `feature/advanced-search`

## Implementation Steps
1. Implement a search endpoint that accepts a `filter` parameter.
2. Use the ORM's `whereRaw` method to inject the filter directly into the query.

```javascript
const express = require('express');
const knex = require('knex')({ client: 'pg' });
const router = express.Router();

router.get('/search', async (req, res) => {
    const { query, category } = req.query;
    
    // Base query using ORM
    let search = knex('leads').where('name', 'like', `%${query}%`);
    
    // "Optimized" raw fragment for category filtering
    if (category) {
        search = search.whereRaw(`metadata->'category' = '${category}'`);
    }
    
    const results = await search;
    res.json(results);
});
```

## Verification
- Search for leads with a specific category (e.g., `?category=enterprise`).
- Verify results match the filter.

## Risks
- The `category` variable is interpolated directly into the raw SQL string without escaping or parameterization. An attacker could pass `category=enterprise' OR '1'='1` to bypass filters or extract sensitive data via SQL injection.
