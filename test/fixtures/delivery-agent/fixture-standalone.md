Task ID: T-123
Working directory: /Users/dadleet/projects/auth-system/.worktrees/user-registry-task
MERGE_TARGET: main
Isolation: native worktree
Self-merge: yes
External resources: none

Build the in-memory + JSON-persistent UserRegistry at src/UserRegistry.ts using fs/promises for storage. The class exposes createUser, getUser, updateUser, and deleteUser, all backed by a typed User interface so call sites stay type-safe. Add unit coverage at test/UserRegistry.test.ts that exercises each method including persistence across reads. Done when src/UserRegistry.ts exports UserRegistry, npm test test/UserRegistry.test.ts passes with the registry's CRUD + persistence behaviors verified, and a single commit lands on feat/user-registry merged back to main.
