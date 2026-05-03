Task ID: T-125
Working directory: /Users/dadleet/projects/auth-system/.worktrees/auth-scaffold
MERGE_TARGET: main
Isolation: native worktree
Self-merge: no
External resources: none

Scaffold the authentication service at src/AuthService.ts: define the IAuthService interface, implement an AuthService class with login and logout stubs, and wire up basic configuration loading the rest of the chain will extend. Done when src/AuthService.ts exports AuthService, the scaffolding tests pass, a single commit lands on feat/auth-service, and the worktree is left intact for the next chain member.
