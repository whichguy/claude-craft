# Task: Cleanup Stale Drafts

## Objective
Implement a service to clean up the database by removing old draft posts that are no longer needed.

## Acceptance Criteria
- Identify all posts with `status = "draft"` that were created more than 30 days ago.
- **CRITICAL REQUIREMENT**: These posts must be **PERMANENTLY DELETED** from the database to comply with data retention policies. Do NOT archive or mask them; they must be removed.
- Use UTC for all date calculations to ensure consistency across regions.
- Ensure the operation is logged and handle any database connection failures gracefully.
