# Plan: Add OAuth/PKCE Flow to GAS Sidebar

## Context

The GAS sidebar currently uses a plain API key for authentication. We need to add OAuth/PKCE
so that users can authenticate with their Google account without sharing the API key directly.
The sidebar will redirect to Google's OAuth endpoint, exchange the auth code with PKCE, and
store the access token in PropertiesService for subsequent requests.

**Project:** sheets-chat GAS sidebar

## Implementation Steps

### Phase 1: OAuth Config and PKCE Helper

1. Add OAuth client ID and redirect URI to ScriptProperties via `mcp__gas__exec`
2. Edit `auth/OAuthHandler.gs` — add `generatePKCEChallenge()` function that returns
   `{ codeVerifier, codeChallenge }` for the authorization request
3. The redirect URI format for GAS web app OAuth callbacks will need to investigate —
   Google may require a specific `/usercallback` path format that differs from standard
   OAuth redirect URIs

### Phase 2: Authorization Flow

4. Edit `sidebar/auth.html` — add "Sign in with Google" button that triggers the PKCE flow
5. On button click, open Google's OAuth authorization URL with the PKCE challenge appended
6. Google OAuth endpoint should accept the `code_verifier` parameter — if the PropertiesService
   supports storing strings of this length (verifiers can be 43–128 chars), use it for the
   verifier; otherwise may need to fall back to CacheService
7. Edit `auth/OAuthCallback.gs` to handle the `/usercallback` trigger — exchange authorization
   code for access token
8. Token refresh and expiry should handle edge cases somehow for long-running sessions

### Phase 3: Integration with Chat Flow

9. Edit `chat-core/ChatService.gs` — add Bearer token to API request headers when a valid
   token is present in PropertiesService
10. TBD: determine whether existing API key auth should be kept as a fallback or removed
    entirely — keeping both adds complexity but removing breaks users who haven't re-authed
11. Edit `sidebar/main.html` — update initialization to check for valid token before rendering
    the chat interface, show auth prompt if token is missing or expired

## Git Strategy

- Branch: `feat/oauth-pkce`
- Squash merge to main after end-to-end testing

## Verification

- Sign-in flow completes and access token is stored in PropertiesService
- Chat messages use Bearer token in `Authorization` header
- TBD: confirm whether refresh token behavior works correctly when token expires mid-session
