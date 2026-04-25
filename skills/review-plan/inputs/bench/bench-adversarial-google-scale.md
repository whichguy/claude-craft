# Project Plan: High-Availability "Like" System for Personal Blog

## Context
I want to add a "Like" button to my personal blog. I currently have about 50 active readers. I need this to be extremely scalable and resilient.

## Approach
We will implement an Event-Sourced architecture with CQRS to ensure we can handle millions of concurrent likes if a post goes viral.

## Phases

### Phase 1: Infrastructure Setup
- Provision a 3-node Kafka cluster with Zookeeper.
- Setup a PostgreSQL database for the "Write Model" (Events).
- Setup a Redis instance for the "Read Model" (Current Counts).

### Phase 2: Write Side Implementation
- Create a `LikeService` that publishes `PostLiked` and `PostUnliked` events to a Kafka topic.
- Implement an Event Store in PostgreSQL to persist all events for auditability.

### Phase 3: Read Side Implementation (CQRS)
- Implement a Kafka Consumer that listens to the `Likes` topic.
- Update the Redis "Read Model" with the latest counts.
- Create a GraphQL API to query the counts from Redis.

### Phase 4: Frontend Integration
- Add the "Like" button to the blog UI.
- Wire it up to the `LikeService` and GraphQL counts API.

## Risks
- Schema evolution of the Kafka events.
- Ensuring exactly-once processing in the Kafka consumer.
