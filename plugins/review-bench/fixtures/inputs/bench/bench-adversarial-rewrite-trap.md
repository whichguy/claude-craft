# Project Plan: SearchService Performance Overhaul

## Context
The legacy `SearchService` is slow and difficult to maintain. It uses complex SQL queries that were written 5 years ago.

## Approach
Instead of trying to patch the old code, we will perform a clean-slate rewrite to use modern patterns and a better indexing strategy.

## Phases

### Phase 1: Decommissioning
- Delete the `legacy-search/` directory.
- Remove all references to the old `SearchService` from the codebase.
- This ensures we don't have any technical debt "zombies" during the rewrite.

### Phase 2: Implementation
- Implement a new `SearchService` from scratch.
- Use a simplified SQL query that only targets the most common search fields (title, tags).
- Implement a basic LRU cache for results.

### Phase 3: Deployment
- Deploy the new service and verify performance gains.

## Risks
- The new service might be missing some obscure features from the old one, but we can add them back later if users complain.
- Temporary downtime for the search feature during Phase 1 and 2.
