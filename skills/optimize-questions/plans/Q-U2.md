# Plan: User Settings Form

## Context

Users need to update their profile settings (display name, email, notification preferences,
timezone) from within the app. The current settings page is read-only — it displays
values from the API but has no edit capability. We need to add a form that submits
changes via `PUT /api/user/settings`.

## Current State

- React 18 app with TypeScript, using React Hook Form for other forms
- `src/pages/Settings.tsx` currently renders a read-only profile card
- API endpoint `PUT /api/user/settings` exists and accepts JSON body
- Validation rules: display name 2-50 chars, email must be valid, timezone from fixed list
- Average API response time: 200-400ms

## Approach

We will convert the read-only Settings page into an editable form. The form will pre-fill
with current user data fetched from `GET /api/user/settings`, allow inline editing, and
submit changes via PUT. We'll use React Hook Form for validation and submission handling.
On successful save, we'll update the local user context so the navbar reflects the new
display name immediately.

## Files to Modify

- `src/pages/Settings.tsx` — convert from read-only to editable form
- `src/hooks/useUserSettings.ts` (new) — custom hook for GET/PUT user settings
- `src/types/user.ts` — add `UserSettingsForm` type
- `src/context/UserContext.tsx` — add `updateDisplayName` action

## Implementation

### Phase 1: Data Layer

1. Add `UserSettingsForm` interface to `src/types/user.ts`:
   ```typescript
   interface UserSettingsForm {
     displayName: string;
     email: string;
     timezone: string;
     emailNotifications: boolean;
     pushNotifications: boolean;
   }
   ```

2. Create `useUserSettings.ts` hook that:
   - Calls `GET /api/user/settings` on mount
   - Returns current settings data
   - Exposes `saveSettings(data: UserSettingsForm)` that calls PUT endpoint
   - Returns `{ data, save, isSaving }` tuple

3. Add `updateDisplayName` to `UserContext` so navbar updates after save

### Phase 2: Form UI

1. Replace the read-only card in `Settings.tsx` with a `<form>` using `useForm()`
2. Add controlled inputs for display name and email with validation:
   - Display name: required, minLength 2, maxLength 50
   - Email: required, valid email pattern
3. Add a timezone `<select>` dropdown populated from a constant list
4. Add toggle switches for email and push notification preferences
5. Add a "Save Changes" button at the bottom of the form
6. Pre-fill form with data from `useUserSettings()` via `reset()` when data loads

### Phase 3: Submit & Sync

1. Wire form `onSubmit` to call `saveSettings()` from the hook
2. On success: call `updateDisplayName()` in UserContext, show success toast
3. Disable the Save button while `isSaving` is true to prevent double-submit
4. Add form-level dirty checking — only enable Save when values differ from original

## Verification

1. Load settings page — form should be pre-filled with current values
2. Edit display name and submit — verify PUT request fires with correct body
3. Verify validation: blank name shows error, invalid email shows error
4. Verify Save button is disabled during submission
5. After save, verify navbar shows updated display name
6. Verify unchanged form keeps Save button disabled
