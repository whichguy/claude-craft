# Plan: Add CSV Export Feature for User Data

## Context

The user has requested a CSV export feature for user data in the Express.js API. The current system uses MongoDB for the user collection, and we need to add an endpoint that exports user data in CSV format.

Key information:
- Backend framework: Express.js
- Database: MongoDB
- Existing function: `getUserById` in `src/controllers/userController.js` (returns `Promise<User>`)
- User model fields: `name`, `email`, `createdAt`, `role`
- Need to create CSV export endpoint at `/api/users/export`

## Git Setup

Ensure we're on a clean branch:
```bash
git checkout -b feature/user-csv-export
```

## Phase 1: Add CSV Generation Utility

Create a utility function to convert user data to CSV format.

1. Create a new file `src/utils/csvGenerator.js`:
   ```javascript
   const { Parser } = require('json2csv');
   
   function generateUserCSV(users) {
     const fields = ['name', 'email', 'createdAt', 'role'];
     const opts = { fields };
     const parser = new Parser(opts);
     return parser.parse(users);
   }
   
   module.exports = { generateUserCSV };
   ```

2. Install the required dependency:
   ```bash
   npm install json2csv
   ```

3. Commit the changes:
   ```bash
   git add src/utils/csvGenerator.js package.json package-lock.json
   git commit -m "Add CSV generation utility for user export"
   ```

## Phase 2: Extend User Controller

Add a new controller method to handle CSV export requests.

1. Modify `src/controllers/userController.js` to add the export function:
   ```javascript
   const { generateUserCSV } = require('../utils/csvGenerator');
   
   async function exportUsersAsCSV(req, res) {
     try {
       // Fetch all users from MongoDB
       const users = await User.find({}).select('name email createdAt role').lean();
       
       // Convert to CSV
       const csv = generateUserCSV(users);
       
       // Set headers for file download
       res.setHeader('Content-Type', 'text/csv');
       res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
       
       return res.status(200).send(csv);
     } catch (error) {
       console.error('Error exporting users:', error);
       return res.status(500).json({ error: 'Failed to export user data' });
     }
   }
   
   module.exports = {
     getUserById,
     exportUsersAsCSV
   };
   ```

2. Commit the changes:
   ```bash
   git add src/controllers/userController.js
   git commit -m "Add exportUsersAsCSV controller method"
   ```

## Phase 3: Add Export Route

Create a new route for the CSV export endpoint.

1. Update `src/routes/userRoutes.js` to include the export route:
   ```javascript
   const express = require('express');
   const router = express.Router();
   const { getUserById, exportUsersAsCSV } = require('../controllers/userController');
   const { authMiddleware, adminMiddleware } = require('../middleware/auth');
   
   // Existing routes
   router.get('/:id', authMiddleware, getUserById);
   
   // New export route (admin only)
   router.get('/export', authMiddleware, adminMiddleware, exportUsersAsCSV);
   
   module.exports = router;
   ```

2. Commit the changes:
   ```bash
   git add src/routes/userRoutes.js
   git commit -m "Add /api/users/export route for CSV download"
   ```

## Phase 4: Add Tests

Create tests for the CSV export functionality.

1. Create test file `src/tests/csvExport.test.js`:
   ```javascript
   const request = require('supertest');
   const app = require('../app');
   const User = require('../models/User');
   
   describe('CSV Export Endpoint', () => {
     beforeEach(async () => {
       await User.deleteMany({});
     });
     
     it('should export users as CSV with correct headers', async () => {
       // Create test users
       await User.create([
         { name: 'Alice', email: 'alice@example.com', createdAt: new Date(), role: 'user' },
         { name: 'Bob', email: 'bob@example.com', createdAt: new Date(), role: 'admin' }
       ]);
       
       const adminToken = 'test-admin-token';
       
       const response = await request(app)
         .get('/api/users/export')
         .set('Authorization', `Bearer ${adminToken}`);
       
       expect(response.status).toBe(200);
       expect(response.headers['content-type']).toBe('text/csv');
       expect(response.text).toContain('name,email,createdAt,role');
       expect(response.text).toContain('Alice');
       expect(response.text).toContain('Bob');
     });
     
     it('should require admin role', async () => {
       const userToken = 'test-user-token';
       
       const response = await request(app)
         .get('/api/users/export')
         .set('Authorization', `Bearer ${userToken}`);
       
       expect(response.status).toBe(403);
     });
     
     it('should handle empty user collection', async () => {
       const adminToken = 'test-admin-token';
       
       const response = await request(app)
         .get('/api/users/export')
         .set('Authorization', `Bearer ${adminToken}`);
       
       expect(response.status).toBe(200);
       expect(response.text).toBe('name,email,createdAt,role\n');
     });
   });
   ```

2. Commit the tests:
   ```bash
   git add src/tests/csvExport.test.js
   git commit -m "Add tests for CSV export functionality"
   ```

## Phase 5: Documentation

Update API documentation to include the new endpoint.

1. Update `docs/API.md` to document the export endpoint:
   ```markdown
   ### Export Users as CSV
   
   **Endpoint:** `GET /api/users/export`
   
   **Authentication:** Required (Admin only)
   
   **Description:** Exports all users in the system as a CSV file.
   
   **Response:**
   - Content-Type: `text/csv`
   - Downloads a file named `users-export.csv`
   - CSV columns: `name`, `email`, `createdAt`, `role`
   
   **Example:**
   ```bash
   curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
        http://localhost:3000/api/users/export \
        -o users.csv
   ```
   
   **Status Codes:**
   - 200: Success
   - 403: Forbidden (requires admin role)
   - 500: Server error
   ```

2. Commit the documentation:
   ```bash
   git add docs/API.md
   git commit -m "Document CSV export endpoint in API docs"
   ```
