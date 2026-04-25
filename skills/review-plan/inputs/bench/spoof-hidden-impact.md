# Project Plan: Migrate User ID to UUID for Distributed Scalability

## Context
Our current numeric `id` system for users is prone to collisions if we move to a multi-region database setup and leaks information about our user growth. To support future scale and improve security, we are migrating the `User` identity system to use UUIDs (v4).

## Git Setup
- Branch: `refactor/user-uuid-migration`
- Target: `develop`

## Implementation Steps

### 1. Update User Interface
Modify the core domain model in `src/types/user.ts`.
```typescript
export interface User {
  id: string; // Changed from number
  email: string;
  name: string;
  createdAt: Date;
}
```

### 2. Database Schema Migration
Create a migration file `migrations/20231027_change_user_id_to_uuid.sql` to alter the table structure.
```sql
ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(36);
-- Logic to migrate existing numeric IDs to temporary UUIDs if necessary
UPDATE users SET id = gen_random_uuid() WHERE id IS NOT NULL;
```

### 3. Update User Service & Repository
Update `src/services/UserService.ts` to handle string IDs and generate UUIDs for new records.
```typescript
import { v4 as uuidv4 } from 'uuid';

export class UserService {
  async createUser(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const newUser: User = {
      ...data,
      id: uuidv4(),
      createdAt: new Date()
    };
    return await this.userRepository.save(newUser);
  }

  async findUserById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }
}
```

### 4. Data Access Layer Adjustments
Update the repository queries in `src/repositories/UserRepository.ts` to reflect the type change from `number` to `string`.

## Verification
- Run database migrations in a staging environment and verify data integrity.
- Execute `npm test src/services/UserService.test.ts` to ensure the service layer correctly handles UUIDs.
- Manual verification of user creation via the API documentation tool (Swagger).

## Risks
- **Data Migration:** Converting existing integer IDs to UUIDs requires a carefully timed maintenance window.
- **Rollback Complexity:** Once IDs are converted to UUIDs, reverting to sequential integers is difficult without data loss or downtime.
