# Project Plan: React Query Migration (Redux/Saga to TanStack Query)

## Context
The application currently manages all server state using Redux and Redux-Saga. This has led to verbose boilerplate, difficult cache invalidation, and complex side-effect orchestration. We are migrating to TanStack Query (React Query) to leverage its built-in caching, optimistic updates, and declarative data fetching. To ensure a smooth transition in this large-scale application, we will implement a "Store-to-Query" bridge to allow legacy Redux components to access data fetched via React Query.

## Git Setup
1. **Branching Strategy**: 
   - Create a long-lived integration branch: `feature/react-query-migration`.
   - Small, atomic PRs will be merged into this branch (e.g., `infra`, `user-module`, `bridge`).
2. **Pre-commit Hooks**: Ensure Husky/lint-staged are configured to run MSW-based tests on modified files.

## Implementation Steps

### Phase 1: Infrastructure & Testing Foundation
**Intent**: Set up the `QueryClient`, provider, and Mock Service Worker (MSW) to support automated verification from day one.

- **Files**:
  - `src/lib/queryClient.ts`
  - `src/App.tsx`
  - `src/mocks/handlers.ts`
  - `src/mocks/browser.ts`

**Code Snippet (Infrastructure)**:
```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error: any) => {
        if (error?.status === 404) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
```

### Phase 2: The Store-to-Query Bridge (Interoperability)
**Intent**: Create a mechanism where React Query data is mirrored to Redux for legacy components that haven't been migrated yet.

- **Files**:
  - `src/middleware/queryBridge.ts`
  - `src/hooks/useSyncedQuery.ts`

**Code Snippet (Bridge Logic)**:
```typescript
// src/hooks/useSyncedQuery.ts
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';

export function useSyncedQuery<T>(
  queryKey: string[],
  fetcher: () => Promise<T>,
  syncAction: (data: T) => { type: string; payload: T },
  options?: UseQueryOptions<T>
) {
  const dispatch = useDispatch();
  const query = useQuery(queryKey, fetcher, options);

  useEffect(() => {
    if (query.data) {
      dispatch(syncAction(query.data));
    }
  }, [query.data, dispatch, syncAction]);

  return query;
}
```

### Phase 3: Migrating Complex Read Operations (Pagination & Caching)
**Intent**: Replace Saga-based paginated lists with `useQuery`.

- **Files**:
  - `src/api/users.ts`
  - `src/features/users/hooks/useUsers.ts`
  - `src/features/users/UserList.tsx`

**Code Snippet (Pagination)**:
```typescript
// src/features/users/hooks/useUsers.ts
export const useUsers = (page: number) => {
  return useQuery(['users', page], () => fetchUsers(page), {
    keepPreviousData: true, // Prevents flickering during page changes
  });
};
```

### Phase 4: Mutations & Optimistic Updates
**Intent**: Replace Saga side-effects for POST/PUT/DELETE with `useMutation` and implement rollback-capable optimistic UI.

- **Files**:
  - `src/features/users/hooks/useUpdateUser.ts`

**Code Snippet (Optimistic Update)**:
```typescript
export const useUpdateUser = () => {
  return useMutation(updateUserApi, {
    onMutate: async (newUser) => {
      await queryClient.cancelQueries(['users']);
      const previousUsers = queryClient.getQueryData(['users']);
      queryClient.setQueryData(['users'], (old: any) => 
        old.map((u: any) => u.id === newUser.id ? { ...u, ...newUser } : u)
      );
      return { previousUsers };
    },
    onError: (err, newUser, context) => {
      queryClient.setQueryData(['users'], context?.previousUsers);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['users']);
    },
  });
};
```

### Phase 5: UI State & Cleanup
**Intent**: Use React Context for minimal UI state (e.g., "isFilterPanelOpen") and remove Redux-Saga files.

- **Files**:
  - `src/context/UIContext.tsx`
  - `src/store/rootSaga.ts` (Remove migrated sagas)

## Verification
1. **Automated Testing**:
   - Run `npm test` to execute Jest/Vitest suites.
   - All fetch operations must be intercepted by MSW handlers in `src/mocks/handlers.ts`.
2. **Manual QA**:
   - Verify "Store-to-Query" bridge by checking Redux DevTools while navigating React Query-powered pages.
   - Test "Offline Mode" by simulating network failure and ensuring optimistic updates roll back correctly.
3. **Performance**:
   - Verify that `keepPreviousData` provides a smooth pagination experience without unnecessary loading spinners.

## Risks and Mitigations
- **Risk**: Infinite loops between React Query and Redux Bridge.
  - **Mitigation**: Ensure the bridge only dispatches actions if the data has actually changed (deep equality check).
- **Risk**: Increased bundle size during migration (having both Redux-Saga and React Query).
  - **Mitigation**: This is a temporary cost. Track bundle size and set a deadline for full Saga removal.
- **Risk**: Complex Saga logic (race conditions, cancellations) is hard to replicate.
  - **Mitigation**: Leverage React Query's `AbortController` support and `enabled` flag for dependent queries.
