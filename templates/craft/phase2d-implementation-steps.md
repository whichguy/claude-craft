# Implementation Steps & Feature Dependencies

**Purpose:** Complete implementation plan combining visual dependency map with phased execution order. This ensures proper sequencing, reveals integration points, and enables parallel work where possible.

## Visual Feature Dependency Map

**DIRECTIVE: Update this chart as features are added, dependencies change, or tasks are completed**

```mermaid
graph TD
    %% Foundation Phase
    T001[Task 001: Database Schema & Models] --> T005[Task 005: User Service Layer]
    T001 --> T006[Task 006: Invoice Data Layer]

    %% Service Integration Phase
    T005 --> T010[Task 010: User Authentication]
    T005 --> T011[Task 011: User Authorization]

    %% Business Logic Phase
    T006 --> T012[Task 012: Invoice Creation API]
    T012 --> T013[Task 013: Invoice Editing API]
    T012 --> T014[Task 014: Invoice Deletion API]

    T010 --> T015[Task 015: Protected Routes Middleware]
    T015 --> T012
    T015 --> T013

    %% UI Layer Phase
    T012 --> T020[Task 020: Invoice List UI Component]
    T012 --> T021[Task 021: Invoice Form UI Component]
    T013 --> T021

    %% Quality Phase
    T020 --> T030[Task 030: End-to-End Integration Tests]
    T021 --> T030
    T012 --> T030

    %% Related Features (dotted lines = share resources)
    T012 -.shares Invoice model.- T013
    T012 -.shares Invoice model.- T014
    T020 -.shares UI components.- T021
    T015 -.cross-cutting concern.- T012
    T015 -.cross-cutting concern.- T013

    %% Styling
    classDef foundation fill:#e1f5e1
    classDef service fill:#cfe2ff
    classDef business fill:#fff3cd
    classDef ui fill:#f8d7da
    classDef quality fill:#d1ecf1

    class T001,T005,T006 foundation
    class T010,T011,T015 service
    class T012,T013,T014 business
    class T020,T021 ui
    class T030 quality
```

**Legend:**
- **Solid arrows (→):** Hard dependency - target requires source to be complete
- **Dotted lines (-.->):** Related features - share data models, UI, APIs, or cross-cutting concerns
- **Colors:** Indicate phase groupings (see sections below)

**Chart Update Rules:**
- When task added: Insert node in appropriate phase group, draw dependencies
- When dependency discovered: Add arrow from prerequisite to dependent task
- When relationship found: Add dotted line with label describing relationship
- When task completed: Consider adding styling `style T001 stroke:#28a745,stroke-width:3px`

## Phase 1: Foundation (Tasks 001-009)

**Goal:** Establish core data structures, models, and base utilities

**Tasks:**
- Task 001: Database Schema & Models (no dependencies)
- Task 005: User Service Layer (depends on: Task 001)
- Task 006: Invoice Data Layer (depends on: Task 001)

**Exit Criteria:** Core models tested and validated, utilities available for use

**Rationale:** Foundation must exist before building features that depend on it. Database schema changes are expensive later.
