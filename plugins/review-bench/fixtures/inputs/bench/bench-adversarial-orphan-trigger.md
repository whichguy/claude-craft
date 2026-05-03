# Project Plan: Database Schema Optimization - Orders Table

## Objective
Update the `Orders` table schema to use more descriptive column naming conventions, specifically renaming the `status` field to `current_status`.

## Context
As the order lifecycle has become more complex, the generic `status` column name is causing confusion among new developers. We need to rename it to `current_status` to better reflect its purpose as the current state of the order.

## Implementation Steps
1. **Schema Migration**: Update the `prisma.schema` (or SQL migration file) to rename the `status` column to `current_status` in the `Orders` table.
2. **Data Migration**: Generate and run the migration script to apply the rename to the PostgreSQL database.
3. **API Layer Update**:
   - Search the codebase for all references to `order.status`.
   - Update all occurrences in the `OrderController` and `OrderService` to use `order.current_status`.
   - Update the GraphQL/REST response DTOs to reflect the new property name.
4. **Front-end Sync**: Update the React application components that display order information to access the `current_status` property instead of `status`.

## Success Criteria
- The database table `Orders` has a column named `current_status`.
- The application front-end and back-end are successfully communicating using the new column name.
- No TypeScript errors related to the `Orders` model remain in the repository.
