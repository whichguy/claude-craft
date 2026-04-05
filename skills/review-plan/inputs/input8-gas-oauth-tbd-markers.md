# Plan: Add OAuth/PKCE Flow to GAS Sidebar

## Context

The GAS sidebar currently uses a plain API key for authentication. We need to add OAuth/PKCE
so that users can authenticate with their Google account without sharing the API key directly.
The sidebar will redirect to Google's OAuth endpoint, exchange the auth code with PKCE, and
store the access token in PropertiesService for subsequent requests.

**Project:** sheets-chat GAS sidebar

## Implementation Steps

### Phase 1: OAuth Config and PKCE Helper

This phase establishes the OAuth configuration and the cryptographic building blocks for PKCE. It must be completed and verified before Phase 2 begins — specifically, the redirect URI format and PropertiesService/UserProperties scope must be confirmed before the authorization flow is built.
**Pre-check:** Confirm `appsscript.json` is readable and ScriptProperties are accessible via `mcp__gas__exec`.

1. Read `appsscript.json` and verify current `oauthScopes` and web app configuration. Read `auth/OAuthHandler.gs` and verify current file structure and any existing auth helpers.

2. Update `appsscript.json` — add required OAuth scopes: `https://www.googleapis.com/auth/script.external_request` and any scopes required by the target API. **Identify required scopes before this step** — read the target API's authorization documentation and list all needed scopes explicitly (do not leave as TBD). Note: adding new scopes to `appsscript.json` will trigger a re-authorization prompt for all existing users on their next script interaction; confirm this is acceptable before deploying.
3. Add OAuth client ID, client secret, and redirect URI to ScriptProperties via `mcp__gas__exec`. The redirect URI for GAS web app OAuth callbacks uses the format `https://script.google.com/macros/s/<SCRIPT_ID>/usercallback` — confirm the script ID and store the full URI. Store: `oauth_client_id`, `oauth_client_secret`, and `oauth_redirect_uri` as ScriptProperties keys.
4. Edit `auth/OAuthHandler.gs` — add `generatePKCEChallenge()` function that returns `{ codeVerifier, codeChallenge }` for the authorization request. Use S256 code challenge method (required by Google OAuth 2.0; plain is rejected). Store `codeVerifier` in `UserProperties` (not ScriptProperties — tokens are per-user) with a short TTL key. PropertiesService handles strings up to 9KB; PKCE verifiers (43–128 chars) are well within limits.

5. Edit `auth/OAuthHandler.gs` — add `getAuthUrl()` function that calls `generatePKCEChallenge()`, constructs the OAuth authorization URL with `code_challenge`, `code_challenge_method=S256`, `state` (CSRF token stored in UserProperties), `client_id` (from ScriptProperties `oauth_client_id`), `redirect_uri` (from ScriptProperties `oauth_redirect_uri`), and required scopes, and returns the full authorization URL string. Add `getStoredToken()` function that reads `oauth_access_token` from UserProperties and returns it (or null if absent).**Outputs:** `appsscript.json` updated with OAuth scopes; `OAuthHandler.gs` has `generatePKCEChallenge()`, `getAuthUrl()`, and `getStoredToken()`; `oauth_client_id`, `oauth_client_secret`, and `oauth_redirect_uri` stored in ScriptProperties; `codeVerifier` storage key defined.
**Go/no-go:** Verify `generatePKCEChallenge()` returns valid `{ codeVerifier, codeChallenge }` (Step 4), `getAuthUrl()` returns a valid URL string (Step 5), and redirect URI is correct before proceeding.git add `appsscript.json` `auth/OAuthHandler.gs` && git commit -m "feat: OAuth config, appsscript scopes, and PKCE helper"
### Phase 2: Authorization Flow

This phase builds the user-facing sign-in flow and the server-side token exchange. The redirect URI confirmed in Phase 1 is required before this phase begins. The `codeVerifier` storage key defined in Phase 1 is consumed by Step 7.
**Pre-check:** Phase 1 go/no-go passed; `generatePKCEChallenge()` (Step 4) and `getAuthUrl()` / `getStoredToken()` (Step 5) are deployed and callable; redirect URI is confirmed.
6. Read `sidebar/auth.html` and verify current structure. Read `auth/OAuthCallback.gs` and verify current file contents (is it a stub, empty, or does it have existing logic?).

7. Edit `sidebar/auth.html` — add "Sign in with Google" button that triggers the PKCE flow. Include a visible loading state (disable button, show spinner text) while the OAuth window is open. Include an error state display area for failed auth or cancelled flows.

8. On button click, call `google.script.run.getAuthUrl()` (server-side function) to retrieve the OAuth authorization URL with `code_challenge`, `code_challenge_method=S256`, `state` (CSRF token stored in UserProperties), `client_id`, `redirect_uri`, and required scopes. Open the URL via `window.open()` — GAS sidebar iframes cannot use `window.location.href` redirects. After the popup closes, call `google.script.run.getStoredToken()` to check for successful auth and update sidebar UI state (hide auth prompt, show chat interface).

9. Edit `auth/OAuthCallback.gs` — implement the `/usercallback` web app doGet trigger:
   - Validate the `state` parameter against the CSRF token stored in UserProperties
   - Exchange the authorization code for an access token via POST to `https://oauth2.googleapis.com/token` with `code`, `client_id` (from ScriptProperties `oauth_client_id`), `client_secret` (from ScriptProperties `oauth_client_secret`), `redirect_uri` (from ScriptProperties `oauth_redirect_uri`), `code_verifier` (retrieved from UserProperties), and `grant_type=authorization_code`
   - Store the response in UserProperties under keys: `oauth_access_token`, `oauth_refresh_token`, `oauth_token_expiry` (computed as `Date.now() + (response.expires_in * 1000)` — epoch ms), `oauth_token_schema_version=1`   - On error (invalid code, network failure, invalid state): log the error and return an error page; do not store partial token data
   - Register this function as the GAS web app endpoint: in `appsscript.json`, ensure `"executeAs": "USER_ACCESSING"` and `"access": "ANYONE"` (required — OAuth callbacks from Google must be publicly accessible; `"MYSELF"` would restrict the endpoint to the script owner only, breaking multi-user OAuth)
10. Add `refreshTokenIfExpired()` helper to `auth/OAuthHandler.gs`: check `oauth_token_expiry` against current time; if within 5 minutes of expiry or already expired, POST to `https://oauth2.googleapis.com/token` with `grant_type=refresh_token` and `refresh_token` from UserProperties; update stored token fields on success; on refresh failure (revoked token), clear all `oauth_*` UserProperties keys and return null so callers can prompt re-auth.
**Outputs:** `sidebar/auth.html` has sign-in button with loading/error states; `OAuthCallback.gs` handles `/usercallback` and stores token schema v1; `OAuthHandler.gs` has `refreshTokenIfExpired()`.
**Go/no-go:** Test the full sign-in flow end-to-end: button click → popup → Google consent → callback → token stored in UserProperties. Verify `oauth_access_token` is present in UserProperties after sign-in before proceeding.
git add `sidebar/auth.html` `auth/OAuthCallback.gs` `auth/OAuthHandler.gs` && git commit -m "feat: OAuth authorization flow, PKCE callback, token storage"
### Phase 3: Integration with Chat Flow

This phase wires the token from Phase 2 into the chat pipeline and manages the transition from API key auth. The token schema (UserProperties keys `oauth_access_token`, `oauth_token_expiry`) defined in Phase 2 is consumed here. Existing users with API key auth stored in ScriptProperties will be migrated: the API key auth path is retained as a fallback during this transition period and will be removed in a follow-on plan once all users have re-authenticated via OAuth.
**Pre-check:** Phase 2 go/no-go passed; `oauth_access_token` is retrievable via UserProperties; `refreshTokenIfExpired()` is callable.

11. Read `chat-core/ChatService.gs` and verify current API request construction, including how the API key is currently passed in headers. Read `sidebar/main.html` and verify current initialization logic.

12. Edit `chat-core/ChatService.gs` — update API request construction:
    - Call `refreshTokenIfExpired()` before each request
    - If a valid OAuth token is returned, use `Authorization: Bearer <token>` header
    - If no OAuth token (user hasn't re-authed yet), fall back to existing API key auth from ScriptProperties
    - Log which auth path was used (Logger.log) for observability during the transition period

13. Edit `sidebar/main.html` — update initialization:
    - On load, call `google.script.run.getStoredToken()` to check for a valid OAuth token
    - If token present and not expired: render chat interface directly
    - If token missing or expired: show "Sign in with Google" auth prompt (the component added in Phase 2)
    - After successful sign-in (callback from Phase 2 button flow): hide auth prompt, render chat interface without full page reload
    - Display error message if auth fails: "Sign-in failed — please try again" with retry button

14. Migrate existing ScriptProperties API key config: add a one-time migration step in `auth/OAuthHandler.gs` that notes the API key location for reference during the transition period (do not delete yet — fallback is active). Add a `// TODO: remove API key fallback after OAuth migration complete` comment in ChatService.gs.
**Outputs:** `ChatService.gs` uses Bearer token with API key fallback; `sidebar/main.html` has auth-gated initialization with error states; migration note documented.
**Go/no-go:** Verify end-to-end chat flow using OAuth Bearer token; verify existing API key auth still works as fallback.
git add `chat-core/ChatService.gs` `sidebar/main.html` `auth/OAuthHandler.gs` && git commit -m "feat: wire OAuth Bearer token into chat flow, auth-gate sidebar init"
**Phase failure recovery:** If any phase's go/no-go fails: do not proceed to the next phase. Revert staged changes for that phase (`git checkout -- <files-modified-in-phase>`), investigate the failure, fix, and restart the phase from its Pre-check. Do not commit partial phase work.
## Git Strategy

- Branch: `feat/oauth-pkce`
- Per-phase commits as specified in each phase above- Push: `git push origin feat/oauth-pkce` after all phases complete- PR to main with end-to-end test confirmation; squash merge
## Verification

- Sign-in flow completes and access token is stored in UserProperties under `oauth_access_token`- Chat messages use Bearer token in `Authorization` header- Token refresh: trigger an expired token scenario (set `oauth_token_expiry` to a past timestamp) and confirm `refreshTokenIfExpired()` exchanges the refresh token and updates UserProperties without user interaction- API key fallback: confirm chat still works when `oauth_access_token` is absent (transition period fallback)- CSRF protection: confirm the `state` parameter is validated in OAuthCallback and a mismatched state returns an error page
## Post-Implementation Workflow
1. `clasp push` to deploy all .gs and .html changes to the GAS project2. `/review-fix` — loop until clean3. Run manual end-to-end test: full sign-in flow → chat message → token refresh scenario4. If any step fails: fix → re-run `/review-fix` → re-clasp push → re-test — repeat