# Task 001: [Feature Name]

## Tier & Batch Information
**Tier**: [0-Linear-Foundation / Batch-N / Final-Linear-Finalization]
**Batch Number**: [N if in Batch tier, N/A otherwise]
**Parallelizable With**: [List task numbers that can run concurrently - all tasks in same batch]
**Execution Order**: [When this can start - "After Tier 0 complete" / "After Batch N complete" / "After all batches complete"]
**Estimated Time**: [Hours/days to complete]

## Feature Description
[Brief description from Stage 1 use case - what user value does this deliver?]

## Dependencies

### Tier 0 Requirements (from architecture.md)
Reference foundation established in Tier 0 tasks:
- **Identifiers**: [Database names, service IDs, resource ARNs needed]
- **Credentials**: [How to access secrets/keys]
- **Patterns**: [Which established patterns to follow - error handling, logging, etc.]
- **Access Methods**: [Connection strings, API clients to use]
- **Topology**: [How to connect to infrastructure]

### Task Dependencies
- **Prerequisite Tasks**: [Task NNN must complete before this starts]
  * Task [NNN]: [What this task produces that we need]
  * Task [MMM]: [What this task produces that we need]
- **Blocks These Tasks**: [Tasks that depend on this completing]
  * Task [XXX]: [How this task's output is used]
  * Task [YYY]: [How this task's output is used]

## Implementation Scope

### Architecture Compliance Check
**MANDATORY: Review architecture.md before implementing**

**Platform UI Integration:** `architecture.md § Platform UI Integration Architecture` (if exists)

Verify this task follows established patterns:
- [ ] Entry point pattern identified: [Which pattern from architecture, or N/A]
- [ ] UI container pattern identified: [Which pattern from architecture, or N/A]
- [ ] Lifecycle hooks identified: [Which hooks from architecture, or N/A]
- [ ] Platform constraints understood: [Which limits apply to this task, or N/A]

### Entry Points & Access Methods (If Platform-Specific)
**Pattern Reference:** `architecture.md § Entry Point Strategy` (skip if generic web app)

Feature-specific implementation:
- [ ] [Menu item / navigation / command]: [What it does]
- [ ] [Initialization code]: [Where it goes, what it registers]
- [ ] [Launch function]: [What it's called, what it does]

### UI Components (if applicable)
**Pattern Reference:** `architecture.md § UI Container Patterns` (if platform-specific)

- [ ] Primary container: [Sidebar | Modal | Component | Page] - [Specific purpose]
- [ ] Container sizing: [Dimensions per architecture standards, or responsive]
- [ ] Container content: [What displays, how it's structured]

### API Endpoints (if applicable)
- [ ] POST /api/endpoint1 - [Purpose]
- [ ] GET /api/endpoint2 - [Purpose]

### Schema Changes (if applicable)
- [ ] Migration: [Description]
- [ ] Model updates: [Fields to add/modify]

### Service Logic
- [ ] Service method 1: [Business logic description]
- [ ] Service method 2: [Workflow description]

### Data Access
- [ ] Repository method 1: [Query description]
- [ ] Repository method 2: [Persistence description]

### Platform Integration Compliance (If Platform-Specific)
**Pattern Reference:** `architecture.md § Platform Constraints` (skip if generic web app)

Feature-specific considerations:
- [ ] Execution limit handling: [How this feature respects timeouts/quotas]
- [ ] Security policy compliance: [How this feature respects CSP/CORS/sandbox]
- [ ] Error handling: [How this feature handles platform errors]

### Quality Gates
- [ ] Code review passed (no blocking issues)
- [ ] Quality criteria score ≥ [threshold from Phase 2]
- [ ] All integration points tested
- [ ] Security validation complete

### Test Specifications (Write During Task Creation)

**CRITICAL: Write Detailed TDD Specs NOW (During Phase 2-D)**

When creating this task file, immediately write the complete test specifications for this task. Don't leave placeholders. These specs will drive Phase 3 implementation.

**Process:**
1. Review this task's scope (Feature Description, Implementation Scope above)
2. Review test-plan.md for test strategy and approach (from Phase 2-B)
3. **Review architecture.md § Platform UI Integration Architecture** (if platform-specific task)
4. Write detailed Given/When/Then specifications for ALL tests this task needs
5. Include happy path, edge cases, error paths, AND platform integration tests

**Reference test-plan.md for:**
- Test category guidance (what makes a good unit vs integration test)
- Mocha/Chai patterns to follow
- Given/When/Then format structure
- Example test specifications for similar scenarios

**Reference architecture.md for (if platform-specific):**
- Platform integration test requirements: `architecture.md § Test Strategy for Platform Integration`
- Entry point test patterns
- Container test patterns
- Constraint test patterns

**DO NOT:**
- Copy generic examples from test-plan.md (write specific to THIS task)
- Leave placeholder text like "[List unit tests]"
- Write vague descriptions like "test happy path"

**DO:**
- Write complete Given/When/Then for each test
- Include specific inputs, expected outputs, assertions
- Cover happy path, edge cases, error paths for THIS task's scope
- Include platform integration tests if task has entry points/containers/platform APIs
- Provide enough detail that Phase 3 can implement tests without guessing

---

#### Platform Integration Tests (If Platform-Specific Task)

**Reference:** `architecture.md § Test Strategy for Platform Integration`

##### Test: [Entry Point Activation]

**Category:** Platform Integration

**Given:**
- [Platform initialized per architecture pattern]
- [User/system in state to trigger entry point]

**When:**
- [Entry point trigger occurs - menu click, lifecycle hook, etc.]

**Then:**
- [Entry point activates per architecture pattern]
- [Expected UI container appears / function executes]
- [Platform APIs called correctly]

**Assertions:**
```javascript
expect(entryPointFunction).to.have.been.called;
expect(containerDisplayed).to.be.true;
expect(platformApiCalls).to.match.architecturePattern;
```

##### Test: [Platform Constraint Compliance]

**Category:** Platform Integration

**Given:**
- [Feature operating near platform limit]
- [Architecture constraint defined in architecture.md]

**When:**
- [Feature executes operation approaching limit]

**Then:**
- [Feature handles limit gracefully per architecture error pattern]
- [No platform errors thrown]
- [User receives appropriate feedback]

**Assertions:**
```javascript
expect(executionTime).to.be.lessThan(platformTimeout);
expect(errorHandling).to.follow.architecturePattern;
expect(userFeedback).to.be.present;
```

---

#### Unit Tests for This Task

##### Test: [Specific test name for this task's functionality]

**Category:** Unit

**Given:**
- [Specific initial conditions for this task]
- [What dependencies are mocked/configured]
- [What test data is prepared]

**When:**
- [Specific function/method this task implements]
- [Specific parameters being tested]

**Then:**
- [Specific expected return value]
- [Specific state changes expected]
- [Specific side effects]

**Assertions:**
```javascript
// Specific assertions for this test
expect(result.property).to.equal(expectedValue);
expect(result).to.have.property('specificField');
expect(mockService.wasCalled).to.be.true;
```

**Mocha/Chai Implementation Pattern:**
```javascript
describe('[Module this task implements]', () => {
  it('[this specific test name]', () => {
    // Arrange: implement Given above
    const input = { /* specific test data */ };
    const mockDep = createMock({ /* specific mock config */ });

    // Act: implement When above
    const result = functionThisTaskImplements(input, mockDep);

    // Assert: implement Then above
    expect(result).to.equal(expectedValue);
    expect(mockDep.method).to.have.been.calledOnce;
  });
});
```

[Repeat for EACH unit test this task needs - don't leave blanks]

---

#### Integration Tests for This Task

[Same detailed Given/When/Then format for each integration test this task needs]

---

#### Edge Cases for This Task

##### Test: [Specific edge case for this task]

**Category:** Edge Case

**Given:**
- [Boundary condition specific to this task]

**When:**
- [Action with edge case input]

**Then:**
- [Expected behavior at boundary]

**Assertions:**
```javascript
expect(result).to.handle(edgeCase);
```

[Repeat for EACH edge case this task needs]

---

#### Error Paths for This Task

##### Test: [Specific error scenario for this task]

**Category:** Error Path

**Given:**
- [Invalid input or error condition specific to this task]

**When:**
- [Action that should trigger error]

**Then:**
- [Expected error type and message]
- [Expected error handling behavior]

**Assertions:**
```javascript
expect(() => functionThisTaskImplements(invalidInput))
  .to.throw(SpecificErrorType, 'specific error message pattern');
expect(systemState).to.remain.unchanged;
```

[Repeat for EACH error path this task needs]

---

**Completeness Check Before Finishing Task File:**

Before moving to the next task file, verify this task's test specifications:
- Every implementation scope item above has corresponding tests
- All Given/When/Then sections have specific details (no placeholders)
- All assertions show specific expect() statements
- Happy path, edge cases, and error paths all covered
- No vague descriptions like "[List tests]" remain

**Phase 3 Dependency:** Phase 3 will implement these exact specifications as Mocha/Chai tests (red), then write code to pass them (green). If specs are incomplete/vague, Phase 3 will have to guess - breaking TDD.

## Dependencies
- Prerequisites: [Other tasks that must complete first, if any]
- Blocks: [Tasks that depend on this one completing]

## Infrastructure References
From `<WT>/planning/infrastructure-ids.md`:
- [List relevant IDs, endpoints, config values needed]

## Architecture References
From `<WT>/planning/architecture.md`:
- [Relevant architectural decisions and patterns]

## Learnings References
From `<WT>/planning/learnings.md` (if exists from previous tasks):
- [Relevant lessons that might apply]
- [Patterns that worked well]
- [Pitfalls to avoid]

## Implementation Plan (Pre-Implementation)
[To be filled at start of task execution in Phase 3]
- Approach hypothesis: [How will this be implemented?]
- Building on learnings: [What previous lessons apply?]
- Specific risks: [What could go wrong with this task?]
- Integration points: [What needs special attention?]

## Acceptance Criteria
- [ ] All checkboxes above completed
- [ ] All tests passing (100% of tests for this feature)
- [ ] Quality score ≥ threshold
- [ ] Code review approved
- [ ] Documentation updated
- [ ] No blocking issues remaining

## Completion Notes
[To be filled when task moves to tasks-completed/]
- Iterations required: [Number]
- Key learnings: [Insights from implementation]
- Issues encountered: [Problems solved]
- Quality score achieved: [Final score]

### Outputs Produced for Downstream Tasks
[Document what this task creates that other tasks will consume]
- **Files Created**: [List key files with paths]
- **Identifiers/Credentials** (if Tier 0): [Document in architecture.md]
- **Patterns Established** (if Tier 0): [Document in architecture.md]
- **API Contracts**: [Interfaces, function signatures, endpoints created]
- **Database Schema**: [Tables, columns, indexes created]
- **Configuration**: [Env vars, config keys added]

### Architecture.md Updates (if Tier 0)
[What was documented in architecture.md under "Tier 0 Foundation Results"]
- Section added: [Which section of architecture.md]
- Identifiers documented: [Yes/No]
- Patterns documented: [Yes/No]
- Access methods documented: [Yes/No]
