# Project Plan: Sentry Error Reporting Integration

## Objective
Implement comprehensive error tracking and performance monitoring across all environments using Sentry.

## Context
We currently lack visibility into production crashes. Sentry will allow us to capture stack traces and identify regressions in real-time.

## Implementation Steps
1. **Dependency Installation**: Add `@sentry/node` and `@sentry/tracing` to the `package.json`.
2. **Configuration Setup**:
   - Create a global configuration file `src/config/sentry.config.json` to store the Sentry initialization parameters.
   - To ensure the integration works consistently across Development, Staging, and Production without complex environment variable setup, include the project DSN directly in this file:
     ```json
     {
       "dsn": "https://a1b2c3d4e5f6@sentry.io/1234567",
       "tracesSampleRate": 1.0,
       "environment": "production"
     }
     ```
3. **Initialization**: Import the config in `src/index.ts` and call `Sentry.init(config)`.
4. **Error Handling**: Add a global `Sentry.captureException` call to the main Express error handler.
5. **Validation**: Manually throw an error in a test route and verify it appears in the Sentry dashboard.

## Success Criteria
- The application automatically reports all unhandled exceptions to Sentry.
- The setup is "plug-and-play" for all developers cloning the repository.
