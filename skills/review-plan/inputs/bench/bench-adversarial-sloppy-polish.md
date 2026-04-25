# Update Admin Settings for Dark Mode

Update the "Admin Settings" page to include a toggle for "Dark Mode" and ensure the theme state persists across sessions.

## Context
The application currently uses a light theme by default. Users have requested a dark mode toggle in the admin settings to improve usability in low-light environments.

## Git Setup
- `git checkout -b feature/dark-mode`
- `git pull origin main`

## Implementation Steps

### Phase 1: Backend and State Management
1. Add a new boolean field to the user settings model to track the dark mode preference.
2. Update the API endpoint `/api/settings` to accept the new `darkModeStatus` variable. 
   - Note: Ensure consistency with existing user preferences (which currently use `isDarkMode`, `isNotificationsEnabled`, etc.).
3. Update the Redux store to include `darkModeStatus` in the user state.

### Phase 2: Global CSS Injection
1. Modify `src/styles/global.css` to add dark mode variable overrides. This change affects the global CSS layer.
2. Implement the CSS injection logic in the root component. This involves a complex selector hierarchy (`body.dark-mode div[data-theme="admin"] .card-container > .header-action`) to ensure specific admin components are correctly styled.
3. Apply the `.dark-mode` class to the `document.body` based on the state.

### Phase 3: UI Implementation
1. Add a Toggle component to the `AdminSettings.tsx` page.
2. Connect the Toggle to the Redux state and the API update function.
3. Test the toggle to ensure the UI updates immediately and the setting is saved to the database.

## Verification
- Toggle dark mode in Admin Settings.
- Refresh the page to verify persistence.
- Inspect the DOM to ensure `.dark-mode` class is applied to the body.

## Risks
- CSS selector specificity issues may cause styling bugs in some components.
- API latency might cause a delay in state persistence.
