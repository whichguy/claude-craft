# Title: Social Login Implementation

## Git Setup
- `git checkout -b feat/social-login`

## Implementation Steps

### Phase 1: Implementation
1. **Dependency Installation**: Run `npm install passport passport-google-oauth20 passport-github2`.
2. **Database Schema**: Update `src/db/schema.prisma` to add `googleId String?` and `githubId String?` to the `User` model. Run `npx prisma migrate dev`.
3. **UI Components**: Create `src/components/auth/SocialButtons.tsx`. Add styled buttons for "Login with Google" and "Login with GitHub" using the official brand colors and icons.
4. **API Routes**: Implement `/api/auth/google` and `/api/auth/github` routes in `src/pages/api/auth.ts`.
5. **Passport Configuration**: Set up the strategies in `src/lib/passport-config.ts`.
6. **Token Storage**: In the successful OAuth callback on the frontend, extract the `access_token` and save it using `localStorage.setItem('token', token)` to keep the user logged in across page refreshes.

### Phase 2: Testing
1. **Manual Flow**: Open the browser, navigate to `/login`, and click the Google button.
2. **Success Check**: Verify that the user is redirected back to the dashboard and their `googleId` is populated in the database.

## Risks
- OAuth callback URLs might be misconfigured in the Google/GitHub developer consoles.
- Styling might look different on mobile devices.
