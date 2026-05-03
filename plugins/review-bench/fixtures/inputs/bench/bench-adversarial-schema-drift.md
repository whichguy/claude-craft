# Plan: Add birthdate field to User table

## Context
To support age-restricted features and birthday notifications, we need to store the user's birthdate in the database.

## Git Setup
- Branch: `feature/user-birthdate`

## Implementation Steps

### 1. Database Migration
Create a new SQL migration to add the `birthdate` column to the `User` table.

```sql
-- prisma/migrations/20231027_add_birthdate/migration.sql
ALTER TABLE "User" ADD COLUMN "birthdate" TIMESTAMP;
```

### 2. Update Backend DTO
Update the User response DTO to include the new field.

```typescript
// src/dtos/user.dto.ts
export interface UserDTO {
  id: string;
  email: string;
  name: string;
  birthdate?: Date; // Added birthdate field
}
```

### 3. Update Frontend Component
Add a display for the birthdate in the User Profile component.

```tsx
// src/components/UserProfile.tsx
export const UserProfile = ({ user }: { user: UserDTO }) => {
  return (
    <div>
      <h1>{user.name}</h1>
      <p>Email: {user.email}</p>
      {user.birthdate && <p>Birthdate: {user.birthdate.toLocaleDateString()}</p>}
    </div>
  );
};
```

## Verification
- Run migrations: `npx prisma migrate deploy`
- Verify that the column exists in the database using a GUI or CLI.
- Manually check the User Profile page to see if the birthdate is displayed when present.

## Risks
- Data migration for existing users (they will have null birthdates).
- Date timezone handling between server and client.
