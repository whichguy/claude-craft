# Plan: Add Real-Time WebSocket Notification System

## Context

The application currently has a working cron-based email digest system that sends daily summaries to users. We need to add a new real-time notification system using WebSockets to provide instant updates, while keeping the existing email digest system running unchanged.

The codebase already contains:
- Email digest cron job implementation
- User subscription and preference management
- Email templates and rendering
- Delivery tracking and metrics

## Git Setup

We'll work on a feature branch for this implementation:

```bash
git checkout -b feature/websocket-notifications
```

## Phase 1: WebSocket Server Infrastructure

**Goal**: Set up the core WebSocket server and connection management.

1. Install required dependencies for WebSocket support:
   ```bash
   npm install ws @types/ws socket.io @types/socket.io
   ```

2. Create WebSocket server configuration at `src/realtime/config.ts`:
   - Define WebSocket server options (port, path, heartbeat interval)
   - Configure connection limits and timeout settings
   - Set up CORS policies for WebSocket connections

3. Implement WebSocket server at `src/realtime/server.ts`:
   - Initialize Socket.IO server instance
   - Set up connection event handlers
   - Implement authentication middleware for WebSocket connections
   - Handle client connect/disconnect events
   - Add connection pooling and management

4. Create connection manager at `src/realtime/connectionManager.ts`:
   - Track active WebSocket connections by user ID
   - Implement methods to add/remove connections
   - Add lookup methods to find connections by user ID
   - Implement broadcast methods for sending to multiple connections

5. Add integration point in main server at `src/server.ts`:
   - Import and initialize WebSocket server
   - Attach WebSocket server to existing HTTP server
   - Ensure WebSocket server starts with application

6. Commit Phase 1:
   ```bash
   git add src/realtime/config.ts src/realtime/server.ts src/realtime/connectionManager.ts src/server.ts package.json package-lock.json
   git commit -m "Add WebSocket server infrastructure and connection management"
   ```

## Phase 2: Real-Time Notification Preferences

**Goal**: Create preference management for real-time notifications.

1. Create notification preference schema at `src/realtime/preferences.ts`:
   - Define RealtimePreference interface with user ID, enabled channels, mute settings
   - Implement database schema for storing real-time notification preferences
   - Add methods for creating default preferences for new users
   - Include notification type filters (mentions, replies, updates, alerts)

2. Implement preference service at `src/realtime/preferencesService.ts`:
   - Add CRUD operations for user real-time preferences
   - Implement getPreferences(userId) method
   - Implement updatePreferences(userId, preferences) method
   - Add validation logic for preference values
   - Include methods to check if user should receive specific notification types

3. Create API endpoints at `src/routes/realtime.ts`:
   - GET `/api/realtime/preferences` - fetch user's real-time preferences
   - PUT `/api/realtime/preferences` - update user's real-time preferences
   - POST `/api/realtime/preferences/reset` - reset to defaults

4. Add preference middleware at `src/realtime/middleware/preferences.ts`:
   - Check user preferences before sending notifications
   - Filter notifications based on user's enabled channels
   - Respect mute settings and do-not-disturb periods

5. Commit Phase 2:
   ```bash
   git add src/realtime/preferences.ts src/realtime/preferencesService.ts src/routes/realtime.ts src/realtime/middleware/preferences.ts
   git commit -m "Add real-time notification preference management"
   ```

## Phase 3: Notification Templates and Formatting

**Goal**: Create templates and formatting for real-time notifications.

1. Create notification template structure at `src/realtime/templates/`:
   - Create `mention.ts` for mention notification templates
   - Create `reply.ts` for reply notification templates
   - Create `update.ts` for update notification templates
   - Create `alert.ts` for alert notification templates

2. Implement template renderer at `src/realtime/templateRenderer.ts`:
   - Add render method that takes notification type and data
   - Format notification payload for WebSocket delivery
   - Include timestamp, sender info, and action data
   - Add support for rich formatting (links, mentions, formatting)
   - Implement fallback text for clients that don't support rich content

3. Create notification formatter at `src/realtime/formatter.ts`:
   - Transform raw event data into notification objects
   - Add helper methods for formatting user mentions
   - Format timestamps for real-time display
   - Include preview text generation for messages

4. Commit Phase 3:
   ```bash
   git add src/realtime/templates/ src/realtime/templateRenderer.ts src/realtime/formatter.ts
   git commit -m "Add notification templates and formatting for real-time delivery"
   ```

## Phase 4: Notification Delivery System

**Goal**: Implement the core notification delivery pipeline.

1. Create notification queue at `src/realtime/queue.ts`:
   - Implement in-memory queue for pending notifications
   - Add queue management methods (enqueue, dequeue, peek)
   - Include priority handling for urgent notifications
   - Add retry logic for failed deliveries

2. Implement delivery service at `src/realtime/deliveryService.ts`:
   - Create sendNotification(userId, notification) method
   - Look up active connections for target user
   - Format notification using template renderer
   - Send notification via WebSocket
   - Handle delivery failures and connection drops
   - Implement delivery confirmation tracking

3. Add delivery tracker at `src/realtime/deliveryTracker.ts`:
   - Track sent notifications with timestamps
   - Record delivery status (sent, delivered, failed, pending)
   - Store notification metadata for analytics
   - Implement methods to query delivery history
   - Add metrics for delivery success rates

4. Create notification dispatcher at `src/realtime/dispatcher.ts`:
   - Listen for events that should trigger notifications
   - Check user preferences before dispatching
   - Route notifications to delivery service
   - Handle batch notifications for multiple users
   - Implement rate limiting per user

5. Commit Phase 4:
   ```bash
   git add src/realtime/queue.ts src/realtime/deliveryService.ts src/realtime/deliveryTracker.ts src/realtime/dispatcher.ts
   git commit -m "Implement notification delivery pipeline and tracking"
   ```

## Phase 5: Event Integration

**Goal**: Connect real-time notifications to application events.

1. Create event listeners at `src/realtime/listeners/`:
   - Create `mentionListener.ts` to listen for user mentions
   - Create `replyListener.ts` to listen for comment replies
   - Create `updateListener.ts` to listen for content updates
   - Create `alertListener.ts` to listen for system alerts

2. Implement event bus integration at `src/realtime/eventBus.ts`:
   - Connect to existing application event emitter
   - Register all notification event listeners
   - Transform events into notification payloads
   - Route events to notification dispatcher

3. Add notification triggers in business logic:
   - Update `src/services/comments.ts` to emit events for new replies
   - Update `src/services/mentions.ts` to emit events for mentions
   - Update `src/services/content.ts` to emit events for updates
   - Update `src/services/alerts.ts` to emit events for system alerts

4. Commit Phase 5:
   ```bash
   git add src/realtime/listeners/ src/realtime/eventBus.ts src/services/comments.ts src/services/mentions.ts src/services/content.ts src/services/alerts.ts
   git commit -m "Integrate real-time notifications with application events"
   ```

## Phase 6: Client-Side WebSocket Integration

**Goal**: Add client-side support for receiving real-time notifications.

1. Create WebSocket client service at `src/client/websocket/client.ts`:
   - Implement WebSocket connection setup
   - Add authentication token handling
   - Implement reconnection logic with exponential backoff
   - Handle connection state management

2. Add notification handler at `src/client/websocket/notificationHandler.ts`:
   - Listen for incoming notification messages
   - Parse and validate notification payloads
   - Trigger UI updates for new notifications
   - Play notification sounds (if enabled)
   - Update notification badge counts

3. Create UI notification component at `src/client/components/RealtimeNotification.tsx`:
   - Display real-time notification toast/banner
   - Include dismiss and action buttons
   - Add animation for notification appearance
   - Implement auto-dismiss timer

4. Add notification preferences UI at `src/client/components/RealtimePreferences.tsx`:
   - Create form for managing real-time notification settings
   - Add toggles for different notification types
   - Include do-not-disturb schedule settings
   - Add sound preference controls

5. Commit Phase 6:
   ```bash
   git add src/client/websocket/ src/client/components/RealtimeNotification.tsx src/client/components/RealtimePreferences.tsx
   git commit -m "Add client-side WebSocket integration and UI components"
   ```

## Phase 7: Testing and Monitoring

**Goal**: Add comprehensive testing and monitoring for the notification system.

1. Create unit tests at `tests/realtime/`:
   - Test WebSocket connection management
   - Test preference service CRUD operations
   - Test template rendering
   - Test delivery service logic
   - Test notification dispatcher routing

2. Add integration tests at `tests/integration/websocket.test.ts`:
   - Test end-to-end notification delivery
   - Test WebSocket authentication
   - Test connection reconnection scenarios
   - Test notification filtering based on preferences

3. Implement monitoring at `src/realtime/monitoring.ts`:
   - Track active WebSocket connections count
   - Monitor notification delivery rates
   - Record delivery failures and reasons
   - Calculate average delivery latency
   - Add health check endpoint for WebSocket server

4. Create monitoring dashboard queries at `src/realtime/metrics.ts`:
   - Query methods for connection statistics
   - Query methods for delivery metrics
   - Calculate notification engagement rates
   - Generate reports for system health

5. Add logging at `src/realtime/logger.ts`:
   - Log connection events (connect, disconnect, auth failures)
   - Log notification delivery attempts and results
   - Log preference changes
   - Add structured logging with correlation IDs

6. Commit Phase 7:
   ```bash
   git add tests/realtime/ tests/integration/websocket.test.ts src/realtime/monitoring.ts src/realtime/metrics.ts src/realtime/logger.ts
   git commit -m "Add testing, monitoring, and logging for real-time notifications"
   ```

## Phase 8: Documentation and Deployment

**Goal**: Document the system and prepare for deployment.

1. Create architecture documentation at `docs/realtime-notifications.md`:
   - Document WebSocket server architecture
   - Explain notification delivery flow
   - Document preference management system
   - Include sequence diagrams for key flows

2. Add API documentation at `docs/api/realtime.md`:
   - Document WebSocket connection protocol
   - Document message formats for notifications
   - Document REST API endpoints for preferences
   - Include example requests and responses

3. Create deployment guide at `docs/deployment/websocket.md`:
   - Document environment variables for WebSocket server
   - Explain scaling considerations for WebSocket connections
   - Document load balancer configuration for WebSocket support
   - Include nginx/Apache configuration examples

4. Update main README at `README.md`:
   - Add section describing real-time notification feature
   - Include quick start guide for developers
   - Link to detailed documentation

5. Commit Phase 8:
   ```bash
   git add docs/realtime-notifications.md docs/api/realtime.md docs/deployment/websocket.md README.md
   git commit -m "Add documentation for real-time notification system"
   ```
