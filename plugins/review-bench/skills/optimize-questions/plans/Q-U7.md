# Plan: Onboarding Wizard for New Users

## Context

New users who sign up for our SaaS platform need to complete a 5-step onboarding wizard
before accessing the main app. The wizard collects: (1) personal profile, (2) company
info, (3) team invitations, (4) integration connections, (5) preferences. Currently
there is no onboarding — users land on an empty dashboard and churn at 60% within 24h.

## Current State

- React 18 + TypeScript, React Router v6
- API endpoints exist for each step: `POST /api/onboarding/{step}`
- No onboarding UI exists
- Auth context provides `user.onboardingComplete: boolean`
- Design system with Tailwind + custom components in `src/components/ui/`

## Approach

We will build a multi-step wizard component that guides users through all 5 steps
sequentially. Each step is a dedicated form component. A progress bar at the top shows
completion status. Users can navigate back to previous steps but cannot skip ahead.
The wizard state is preserved in localStorage so users can resume if they close the tab.

## Files to Create/Modify

- `src/pages/Onboarding.tsx` (new) — wizard container with routing
- `src/components/onboarding/ProgressBar.tsx` (new) — step progress indicator
- `src/components/onboarding/StepProfile.tsx` (new) — step 1: name, avatar, bio
- `src/components/onboarding/StepCompany.tsx` (new) — step 2: company name, size, industry
- `src/components/onboarding/StepInvite.tsx` (new) — step 3: email invitations
- `src/components/onboarding/StepIntegrations.tsx` (new) — step 4: connect Slack, GitHub, etc.
- `src/components/onboarding/StepPreferences.tsx` (new) — step 5: notifications, theme, language
- `src/hooks/useOnboarding.ts` (new) — wizard state management
- `src/types/onboarding.ts` (new) — step data types
- `src/routes/index.tsx` — add onboarding route with auth guard

## Implementation

### Phase 1: Types & State Management

1. Create `onboarding.ts` with types for each step's form data:
   ```typescript
   interface ProfileData { displayName: string; avatar?: File; bio: string; }
   interface CompanyData { name: string; size: string; industry: string; }
   interface InviteData { emails: string[]; }
   interface IntegrationData { slack: boolean; github: boolean; jira: boolean; }
   interface PreferenceData { emailDigest: string; theme: string; language: string; }
   ```

2. Create `useOnboarding.ts` hook:
   - Track current step (1-5) in state
   - Store completed step data in a map
   - Persist state to localStorage on every change
   - Restore from localStorage on mount
   - Expose `goNext()`, `goBack()`, `submitStep(data)`, `currentStep`

### Phase 2: Progress Bar

1. Create `ProgressBar.tsx`:
   - Render 5 circles connected by lines
   - Completed steps: filled circle with checkmark
   - Current step: filled circle with step number
   - Future steps: outline circle with step number
   - Step labels below each circle

### Phase 3: Step Components

1. Create `StepProfile.tsx`: display name input, avatar upload, bio textarea.
   Validate: name required, bio max 200 chars. "Next" button.

2. Create `StepCompany.tsx`: company name, size dropdown, industry dropdown.
   Validate: name and size required. "Back" and "Next" buttons.

3. Create `StepInvite.tsx`: dynamic email list (add/remove fields), validate
   email format. "Skip" and "Next" buttons.

4. Create `StepIntegrations.tsx`: cards for Slack, GitHub, Jira with "Connect"
   buttons (OAuth flow). Connected shows checkmark. "Skip" and "Next" buttons.

5. Create `StepPreferences.tsx`: email digest radio (daily/weekly/never), theme
   toggle (light/dark/system), language dropdown. "Complete Setup" button.

### Phase 4: Wizard Container

1. Create `Onboarding.tsx`:
   - Render ProgressBar at top
   - Render current step component based on `currentStep`
   - Handle step transitions via `goNext()`/`goBack()`
   - On final step submit: call `POST /api/onboarding/complete`
   - Set `user.onboardingComplete = true` in auth context
   - Redirect to dashboard

2. Add route `/onboarding` in `routes/index.tsx`
   - Guard: redirect to dashboard if `onboardingComplete` is true
   - Guard: redirect to onboarding from dashboard if not complete

### Phase 5: Persistence & Edge Cases

1. Save wizard state to localStorage after each step completion
2. On mount, check localStorage and restore to last completed step + 1
3. Clear localStorage after successful completion
4. Handle browser back button — map to `goBack()`

## Verification

1. New user signs up — redirected to `/onboarding` with step 1 active
2. Fill step 1, click Next — progress bar advances, step 2 form appears
3. Click Back on step 2 — returns to step 1 with data preserved
4. Complete all 5 steps — redirected to dashboard
5. Close tab mid-wizard, reopen — resumes at correct step
6. Completed user visits `/onboarding` — redirected to dashboard
7. Verify each step's validation prevents advancing with invalid data
8. Verify Skip works on steps 3 and 4
