# Project Plan: User Session Insight Enhancement

## Context
This project aims to improve user retention by tracking session activity. We need to add a "Last Login" timestamp to the User model to track login duration and provide insights into user engagement patterns. This data will be used by the analytics dashboard and displayed in the user profile settings.

## Git Setup
- Branch: `feature/user-session-insights`
- Base: `main`

## Implementation Steps

### Phase 1: UI Integration and Analytics Wiring
1.  Update the User Profile React component to display the `last_login_at` field.
2.  Implement a `useLastLogin` hook to fetch the timestamp from the API.
3.  Add an analytics event trigger in the `AuthService` that sends the "session_start" event to the telemetry endpoint whenever the user logs in.
4.  Wire the `UserDashboard` to conditionally show a "Welcome Back" toast if the `last_login_at` value is older than 24 hours.

### Phase 2: Domain Layer Transformation Logic
1.  Create `UserLastLoginDTO` to encapsulate the timestamp field.
2.  Implement `UserLastLoginTransformer` to convert database records into the DTO format.
3.  Define a `TimestampNormalizationService` to handle timezone conversions between the persistence layer and the presentation layer.
4.  Implement `ISessionAdapter` interface to decouple the auth service from the user model.

### Phase 3: Application Service Layer
1.  Develop `UserSessionCoordinator` to manage the flow of session data.
2.  Create `SessionPersistenceAdapter` to map domain entities to repository calls.
3.  Implement `LoginNotificationDispatcher` to handle side effects of the login event.

### Phase 4: Persistence Layer Update
1.  Create a new migration file in `src/models/20231027_add_last_login.js`.
2.  The migration should add a `last_login_at` column (TIMESTAMP) to the `users` table.
3.  Update the `User` Sequelize model to include the `last_login_at` attribute.
4.  Refresh the database schema in the development environment.

### Phase 5: Legacy Synchronization
1.  Create a background worker to backfill existing users with a null `last_login_at` value.
2.  Implement a fallback mechanism for users who have never logged in before the tracking started.

## Verification
- Verify the `last_login_at` field appears in the User Profile UI.
- Confirm the analytics event is fired upon successful login.
- Check that the database column exists after Phase 4 is executed.

## Risks
- Potential UI breakage if the field is accessed before the migration in Phase 4.
- Performance overhead from multiple layers of DTO transformation.
