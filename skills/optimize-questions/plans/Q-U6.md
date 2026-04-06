# Plan: Notification Banner Component

## Context

Product wants a dismissible notification banner at the top of the app to announce
maintenance windows, new features, and system alerts. The banner should support three
severity levels (info, warning, critical), display a message with an optional action
link, and be dismissible. Dismissed banners stay hidden for the session.

## Current State

- React 18 + TypeScript application
- Design system in `src/styles/design-system.css` with CSS custom properties:
  ```css
  --color-info: #2563eb;
  --color-warning: #d97706;
  --color-critical: #dc2626;
  --color-bg-surface: #ffffff;
  --color-text-primary: #1f2937;
  --color-text-secondary: #6b7280;
  --font-body: 'Inter', sans-serif;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --radius-md: 8px;
  ```
- All existing components use CSS classes from the design system, no inline styles
- Component library in `src/components/ui/` follows BEM naming convention
- Example existing component uses: `className="banner__container"`, `className="btn btn--primary"`

## Approach

We will create a NotificationBanner component that renders at the top of the app layout.
The component receives severity, message, optional action URL, and a dismiss handler.
Dismissed banners are tracked in sessionStorage. We'll style the component to match the
existing design system patterns.

## Files to Create/Modify

- `src/components/ui/NotificationBanner.tsx` (new) — banner component
- `src/hooks/useBannerDismiss.ts` (new) — dismissal tracking hook
- `src/types/notification.ts` (new) — banner types
- `src/layouts/AppLayout.tsx` — integrate banner at top of layout
- `src/api/notifications.ts` (new) — fetch active notifications

## Implementation

### Phase 1: Types & API

1. Create `notification.ts`:
   ```typescript
   type BannerSeverity = 'info' | 'warning' | 'critical';
   interface Notification {
     id: string;
     severity: BannerSeverity;
     message: string;
     actionUrl?: string;
     actionLabel?: string;
   }
   ```

2. Create `notifications.ts` with `fetchActiveNotifications()` that calls
   `GET /api/notifications/active`

### Phase 2: Dismiss Hook

1. Create `useBannerDismiss.ts`:
   - Read dismissed IDs from `sessionStorage` key `dismissed-banners`
   - Return `{ isDismissed(id), dismiss(id) }`
   - On `dismiss(id)`, add to sessionStorage set and trigger re-render

### Phase 3: Banner Component

1. Create `NotificationBanner.tsx`:
   - Accept props: `notification: Notification`, `onDismiss: (id: string) => void`
   - Render the banner container as a full-width bar at the top
   - Style with inline styles for each severity:
     - Info: `style={{ backgroundColor: 'blue', color: 'white', padding: '12px 24px', fontSize: '14px', fontFamily: 'Arial' }}`
     - Warning: `style={{ backgroundColor: '#f59e0b', color: 'black', padding: '12px 24px', fontSize: '14px', fontFamily: 'Arial' }}`
     - Critical: `style={{ backgroundColor: 'red', color: 'white', padding: '12px 24px', fontSize: '14px', fontFamily: 'Arial' }}`
   - Add icon span with inline style: `style={{ marginRight: '8px', fontSize: '18px' }}`
   - Render message text in a `<span>` with `style={{ fontWeight: '500' }}`
   - If action URL provided, render `<a>` with `style={{ color: 'white', textDecoration: 'underline', marginLeft: '16px' }}`
   - Add dismiss X button with `style={{ float: 'right', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', fontSize: '20px' }}`

### Phase 4: Layout Integration

1. In `AppLayout.tsx`:
   - Fetch active notifications on mount
   - Filter out dismissed ones using `useBannerDismiss`
   - Render `NotificationBanner` for the highest-severity active notification
   - Place above the main nav bar
   - Handle dismiss by calling `dismiss(id)` from the hook

2. Add transition for banner appear/disappear:
   `style={{ transition: 'all 0.3s ease', overflow: 'hidden' }}`

## Verification

1. Create a test notification with severity "info" — blue banner appears at top
2. Create a "warning" notification — amber banner renders
3. Create a "critical" notification — red banner renders
4. Click dismiss X — banner disappears
5. Refresh page — dismissed banner stays hidden (sessionStorage)
6. Verify action link renders and navigates correctly
7. Verify only highest-severity banner shows when multiple are active
8. Test with no active notifications — no banner rendered
