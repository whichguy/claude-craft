# Plan: Internal Dashboard for Admin Stats

## Context
The operations team needs a way to view real-time system statistics and user growth metrics. We will implement a new "Internal Dashboard" that is accessible only to users with administrative privileges.

## Git Setup
- Branch: `feat/admin-stats-dashboard`

## Implementation Steps

### 1. Create Frontend Dashboard Component
Implement the UI for the admin statistics dashboard.

```tsx
// src/components/AdminDashboard.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get('/api/admin/stats').then(res => setStats(res.data));
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="admin-dashboard">
      <h1>System Statistics (Admin Only)</h1>
      <pre>{JSON.stringify(stats, null, 2)}</pre>
    </div>
  );
};
```

### 2. Implement Backend API Route
Create the API endpoint to serve the statistics.

```typescript
// src/routes/admin.ts
import { Router } from 'express';
import { getSystemStats } from '../controllers/stats';

const router = Router();

// Endpoint to fetch admin stats
router.get('/stats', async (req, res) => {
  const stats = await getSystemStats();
  res.json(stats);
});

export default router;
```

### 3. Register Route in App
Mount the admin router in the main application file.

```typescript
// src/app.ts
import adminRoutes from './routes/admin';

app.use('/api/admin', adminRoutes);
```

## Verification
- Log in as an administrator and navigate to `/admin/stats`.
- Verify that the dashboard displays the correct system statistics.
- Check that the API call to `/api/admin/stats` returns a 200 OK status.

## Risks
- Data accuracy of the statistics being displayed.
- Possible performance impact if the statistics query is too complex.
