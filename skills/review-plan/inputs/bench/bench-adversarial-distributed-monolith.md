# Project Plan: Microservices Migration for User Module

## Context
The current monolith's `User` module is too large. We need to split it into microservices for better scalability and independent deployments.

## Approach
We will split the functionality into 4 services: User-Auth, User-Profile, User-Settings, and User-Avatar. To ensure data consistency during the transition, all services will continue to use the existing `Users` table in the main PostgreSQL database.

## Phases

### Phase 1: Service Creation
- Create 4 new Node.js repositories.
- Use a shared DB connection string pointing to the production PostgreSQL instance.
- Copy the existing Sequelize `User` model into each repository.

### Phase 2: Logic Migration
- User-Auth: Move login/registration logic.
- User-Profile: Move name/email/bio updates.
- User-Settings: Move notification/privacy preferences.
- User-Avatar: Move profile picture upload/processing.

### Phase 3: Traffic Redirection
- Update the API Gateway to route requests to the new services.
- Disable the `User` module in the monolith.

## Risks
- Increased latency due to network hops between services.
- Managing 4 sets of environment variables.
