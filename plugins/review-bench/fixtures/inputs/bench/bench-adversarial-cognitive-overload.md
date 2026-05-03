# Project Plan: Legacy Express to NestJS Migration

## Objective
Modernize the backend architecture by migrating the entire legacy Express.js application to the NestJS framework to leverage better dependency injection and modularity.

## Context
The current application consists of 15 controllers, 20 services, and 5 custom middlewares. To minimize deployment friction, we will perform the migration in a single comprehensive phase.

## Implementation Steps
1. **Phase 1: Full Architecture Port**:
   - Initialize a new NestJS project structure within the `/src-v2` directory.
   - Map and convert all 15 legacy controllers (located in `/src/controllers`) to NestJS `@Controller` classes, ensuring all REST decorators (`@Get`, `@Post`, etc.) match existing routes.
   - Port all 20 business logic services (located in `/src/services`) to NestJS `@Injectable` providers.
   - Reimplement the 5 Express middlewares (located in `/src/middleware`) as NestJS `NestMiddleware` classes.
   - Configure the `AppModule` to wire all newly created controllers and providers.
   - Ensure all DTOs and interfaces are updated to use class-validator for request validation.
   - Once all files are ported, update the main entry point to bootstrap the NestJS application instead of the legacy Express server.

## Success Criteria
- The application starts up using the NestJS bootstrap logic.
- All legacy endpoints are reachable and functional in the new architecture.
- Full parity is achieved in a single deployment cycle.
