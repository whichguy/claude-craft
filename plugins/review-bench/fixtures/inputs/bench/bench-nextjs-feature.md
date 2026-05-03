# Plan: Add Real-Time Notifications via WebSocket

## Context

Users currently have no notification system — comments on posts, new followers, and post likes are invisible until the user manually checks. Need real-time push notifications via WebSocket so they appear instantly in the UI. The Next.js 14 app (App Router) handles the frontend; a separate Node.js/Express API server handles business logic and will host the WebSocket endpoint. PostgreSQL via Prisma for storage. The existing `notificationService.ts` already writes to a `notifications` table — we need to layer WebSocket delivery on top.

**Repos:** Next.js app (current repo) + `api-server/`

## Git Setup

- Branch: `git checkout -b feat/realtime-notifications`
- API server changes and frontend changes live in the same repo (monorepo), so one branch covers both.

## Implementation Steps

### Phase 1: WebSocket Server on API

> Intent: Stand up a WebSocket endpoint on the existing Express server. Authenticated connections get registered by userId so we can push to specific users. This is the foundation — nothing on the frontend until the server can accept and route messages.

**Pre-check:** Confirm `api-server/src/index.ts` creates an `http.Server` instance (not just `app.listen()`). If it uses `app.listen()`, refactor to `const server = http.createServer(app); server.listen(port)` first — `ws` needs the raw HTTP server.

**Files touched:**
- `api-server/src/websocket/connectionManager.ts` (new)
- `api-server/src/websocket/server.ts` (new)
- `api-server/src/index.ts` (modified)
- `api-server/src/services/notificationService.ts` (modified)

1. `npm install ws @types/ws` in `api-server/`

2. Create `api-server/src/websocket/connectionManager.ts`:
   - `connections: Map<string, Set<WebSocket>>` — keyed by userId, supports multiple tabs/devices
   - `addConnection(userId, ws)` — add to set, create set if first connection
   - `removeConnection(userId, ws)` — remove from set, delete key if set empty
   - `sendToUser(userId, payload)` — JSON.stringify and send to all connections for that user; no-op if user not connected
   - Export singleton instance

3. Create `api-server/src/websocket/server.ts`:
   - `initWebSocket(server: http.Server): void`
   - Create `WebSocketServer` with `{ server, path: '/ws' }`
   - On `connection`: extract `token` from URL query params, validate JWT using existing auth utility from `api-server/src/middleware/auth.ts` (or wherever `verifyToken` lives)
   - If auth fails: `ws.close(4001, 'Unauthorized')` and return
   - If auth succeeds: `connectionManager.addConnection(userId, ws)`
   - Set up heartbeat: server pings every 30s, mark connection alive on pong, terminate stale connections after 10s with no pong
   - On `close` / `error`: `connectionManager.removeConnection(userId, ws)`

4. Wire into `api-server/src/index.ts`:
   - Import `initWebSocket` from `./websocket/server`
   - After `server = http.createServer(app)`, call `initWebSocket(server)`

5. Modify `api-server/src/services/notificationService.ts`:
   - After `prisma.notification.create()` succeeds, call `connectionManager.sendToUser(userId, { type: 'NEW_NOTIFICATION', notification })` 
   - This is the only integration point — all three notification triggers (comment, follow, like) already flow through `createNotification()`, so they all get WebSocket delivery automatically

6. **Verify:** Start API server, connect with `wscat -c "ws://localhost:3001/ws?token=<valid-jwt>"`, confirm connection holds. Send an invalid token, confirm close frame with 4001.

**Commit:** `feat: add WebSocket server with per-user connection registry and notification push`

### Phase 2: REST Endpoints for Notification History

> Intent: The WebSocket only pushes new notifications in real time. We need REST endpoints so the frontend can fetch existing notifications on page load and mark them as read. These may partially exist — check first.

**Pre-check:** Check if `api-server/src/routes/` already has notification routes. The Prisma model exists but routes may not.

**Files touched:**
- `api-server/src/routes/notifications.ts` (new or modified)
- `api-server/src/index.ts` (modified — register route)

7. Create `api-server/src/routes/notifications.ts`:
   - `GET /api/notifications` — return user's notifications, newest first, limit 20, supports `?unread=true` filter
   - `GET /api/notifications/unread-count` — return `{ count: number }` for badge
   - `PATCH /api/notifications/:id/read` — set `read: true`, return updated notification
   - `POST /api/notifications/mark-all-read` — bulk update all unread for user
   - All routes require auth middleware

8. Register routes in `api-server/src/index.ts`

**Commit:** `feat: add REST endpoints for notification history and read status`

### Phase 3: Client-Side WebSocket Hook and State

> Intent: Build the React infrastructure for connecting to WebSocket and managing notification state. This is a client-only concern — uses a context provider so any component can access notifications without prop drilling.

**Pre-check:** Confirm the app already has an auth context or hook that exposes the JWT token (needed for WebSocket auth). Check `src/lib/api.ts` to see how the token is stored/accessed.

**Files touched:**
- `src/hooks/useWebSocket.ts` (new)
- `src/providers/NotificationProvider.tsx` (new)
- `src/app/layout.tsx` (modified)

9. Create `src/hooks/useWebSocket.ts`:
   - Takes `url: string` and `onMessage: (data: any) => void`
   - Connects on mount, disconnects on unmount
   - Reconnect with exponential backoff: 1s → 2s → 4s → 8s, cap at 30s, reset on successful connection
   - Track `isConnected` state
   - Return `{ isConnected }`
   - Must be a client component (`'use client'`)

10. Create `src/providers/NotificationProvider.tsx` (`'use client'`):
    - State: `notifications: Notification[]`, `unreadCount: number`
    - On mount: fetch `GET /api/notifications?unread=true` and `GET /api/notifications/unread-count` via existing `api.ts` wrapper
    - Initialize `useWebSocket` pointing at `${process.env.NEXT_PUBLIC_WS_URL}/ws?token=${jwt}`
    - On WebSocket message of type `NEW_NOTIFICATION`: prepend to notifications array, increment unreadCount
    - Expose via context: `notifications`, `unreadCount`, `markAsRead(id)`, `markAllAsRead()`, `isConnected`
    - `markAsRead` calls `PATCH /api/notifications/:id/read`, updates local state, decrements count
    - `markAllAsRead` calls `POST /api/notifications/mark-all-read`, updates local state, resets count to 0

11. Add `NotificationProvider` to `src/app/layout.tsx`:
    - Wrap inside the existing auth provider (needs auth context for JWT)
    - Only render if user is authenticated — conditionally wrap or use a guard inside the provider

**Commit:** `feat: add WebSocket client hook and notification state provider`

### Phase 4: Notification UI Components

> Intent: Build the visible notification experience — a bell icon with unread badge in the header, a dropdown panel showing recent notifications, and a toast for real-time arrivals.

**Pre-check:** Check `src/components/Header.tsx` layout to understand where the bell should go (likely next to user avatar). Check what icon library is used (lucide-react, heroicons, etc.).

**Files touched:**
- `src/components/notifications/NotificationBell.tsx` (new)
- `src/components/notifications/NotificationDropdown.tsx` (new)
- `src/components/notifications/NotificationItem.tsx` (new)
- `src/components/notifications/NotificationToast.tsx` (new)
- `src/components/Header.tsx` (modified)

12. Create `src/components/notifications/NotificationBell.tsx` (`'use client'`):
    - Bell icon from existing icon library
    - Red circle badge showing `unreadCount` from context (hidden when 0, shows "9+" if > 9)
    - Click toggles dropdown open/closed
    - Close dropdown on click outside (useRef + useEffect pattern)

13. Create `src/components/notifications/NotificationDropdown.tsx`:
    - Absolute positioned panel below bell
    - Header row: "Notifications" title + "Mark all as read" button
    - Scrollable list of `NotificationItem` components (max-height with overflow-y-auto)
    - Empty state: "No notifications yet"
    - Footer: "View all notifications" link (for a future full page, can be a placeholder href for now)

14. Create `src/components/notifications/NotificationItem.tsx`:
    - Render differently by notification type:
      - `COMMENT`: "[User] commented on your post [title]"
      - `FOLLOW`: "[User] started following you"
      - `LIKE`: "[User] liked your post [title]"
    - Unread indicator: subtle background color or blue dot
    - Relative timestamp ("2m ago", "1h ago") — use a small utility or `date-fns/formatDistanceToNow`
    - Click: call `markAsRead(id)` + navigate to relevant content

15. Create `src/components/notifications/NotificationToast.tsx`:
    - Listens to notifications context — when a new notification arrives (compare length), show toast
    - Fixed position bottom-right
    - Auto-dismiss after 5s, manual dismiss with X button
    - Show max 3 stacked toasts, queue overflow
    - Animate in/out (CSS transition or framer-motion if already in deps)

16. Update `src/components/Header.tsx`:
    - Import and add `NotificationBell` next to the user avatar
    - Toast component rendered at layout level (in `NotificationProvider` or `layout.tsx`) rather than in Header

**Commit:** `feat: add notification bell, dropdown, and toast UI components`

### Phase 5: Environment Config and Testing

> Intent: Wire up environment variables, add tests for critical paths, and verify the full flow end-to-end.

**Pre-check:** Run existing test suites to establish baseline — no regressions from Phase 1-4 changes.

**Files touched:**
- `.env.local` / `.env.example` (modified)
- `api-server/.env` / `.env.example` (modified)
- `api-server/src/websocket/__tests__/connectionManager.test.ts` (new)
- `api-server/src/websocket/__tests__/server.test.ts` (new)
- `src/hooks/__tests__/useWebSocket.test.ts` (new)
- `src/components/notifications/__tests__/NotificationBell.test.tsx` (new)

17. Environment variables:
    - `NEXT_PUBLIC_WS_URL` — WebSocket server URL (e.g., `ws://localhost:3001` for dev, `wss://api.example.com` for prod)
    - Add to `.env.example` files in both projects with placeholder values

18. Tests:
    - `connectionManager.test.ts`: add/remove connections, sendToUser with 0/1/N connections, message serialization
    - `server.test.ts`: auth rejection with invalid token, successful connection with valid token, heartbeat timeout
    - `useWebSocket.test.ts`: mock WebSocket, verify connect/disconnect lifecycle, reconnection backoff
    - `NotificationBell.test.tsx`: renders unread count, hides badge at 0, toggles dropdown on click, closes on outside click

19. Run all tests:
    - `cd api-server && npm test`
    - `cd .. && npm test`

**Commit:** `test: add notification WebSocket and UI tests`

## Verification

1. **Multi-tab delivery:** Open app in two browser tabs. Trigger a notification (e.g., have another user comment on a post). Both tabs should show the toast and increment the bell badge simultaneously.

2. **Reconnection:** Kill the API server while the app is open. Restart it. Confirm the WebSocket reconnects (check browser console for reconnection logs) and new notifications still arrive.

3. **Page reload persistence:** Reload the page. Unread count badge should match the count from before reload (fetched via REST on mount).

4. **Mark as read:** Click a notification in the dropdown. Confirm unread count decrements. Reload page — that notification should still be read.

5. **Auth rejection:** Open browser devtools, manually try to connect to `/ws` with an invalid token. Confirm the connection is rejected with close code 4001.

6. **All tests pass:** `npm test` in both projects, zero failures.
