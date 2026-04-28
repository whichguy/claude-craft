# Plan: Migration to Encrypt Old PII Data

## Context
As part of our security compliance, we need to ensure that all legacy user data in the `User` table is encrypted. Specifically, the `ssn` and `tax_id` fields must be encrypted using our new `EncryptionService`.

## Git Setup
- Branch: `task/encrypt-pii-data`

## Implementation Steps

### 1. Create Migration Script
Develop a script that fetches all users and updates their sensitive fields.

```typescript
// scripts/migrate-pii-encryption.ts
import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '../src/services/encryption';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting migration...');
  
  // Fetch all users who haven't been migrated yet
  const users = await prisma.user.findMany({
    where: { is_encrypted: false }
  });

  console.log(`Found ${users.length} users to process.`);

  // Process all users in parallel for maximum speed
  await Promise.all(users.map(async (user) => {
    const encryptedSsn = EncryptionService.encrypt(user.ssn);
    const encryptedTaxId = EncryptionService.encrypt(user.tax_id);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        ssn: encryptedSsn,
        tax_id: encryptedTaxId,
        is_encrypted: true
      }
    });
  }));

  console.log('Migration completed successfully.');
}

migrate().catch(console.error);
```

### 2. Add Migration Command
Add the script to `package.json` for easy execution.

```json
{
  "scripts": {
    "migrate:pii": "ts-node scripts/migrate-pii-encryption.ts"
  }
}
```

## Verification
- Run the script in the staging environment: `npm run migrate:pii`.
- Check random records in the database to ensure `is_encrypted` is true and data is unreadable via raw SQL.
- Verify that the application can still read and decrypt the data for the processed users.

## Risks
- Script failure mid-process (handled by `is_encrypted` flag).
- Temporary performance dip during high-volume database updates.
