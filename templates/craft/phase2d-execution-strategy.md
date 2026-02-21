# Execution Strategy: [Epic Name]

## Task Organization Summary

**Total Tasks**: [N]
- **Tier 0** (Linear Foundation): [Count] tasks - MUST execute sequentially
- **Parallel Batches**: [Count] batches containing [Count] total tasks
- **Tier Final** (Linear Finalization): [Count] tasks - MUST execute sequentially

## Tier 0: Linear Foundation (Sequential Execution Required)

**Critical Path**: All Tier 0 tasks must complete before ANY Batch 1 task can start.

| Task | Name | Estimated Time | Architecture.md Updates | Blocks |
|------|------|----------------|-------------------------|--------|
| 001 | [Task Name] | [Hours/days] | Identifiers, patterns, access methods | All batches |
| 002 | [Task Name] | [Hours/days] | Database topology, connection patterns | All batches |
| 003 | [Task Name] | [Hours/days] | Auth patterns, credential access | All batches |
| ... | | | | |

**Tier 0 Completion Gate**: Before starting Batch 1, verify:
- [ ] All Tier 0 tasks marked complete in tasks-completed/
- [ ] Architecture.md contains "Tier 0 Foundation Results" section with all outputs documented
- [ ] All identifiers, credentials, patterns, access methods, topology documented

**Estimated Tier 0 Duration**: [Sum of task times] hours/days (sequential)

---

## Parallel Batch Execution

### Batch 1: [Description - e.g., "Independent Domain Models"]

**Can Start When**: All Tier 0 tasks complete AND architecture.md documentation verified

**Parallelism**: All [N] tasks can execute 100% concurrently
- No file conflicts (each task modifies independent files)
- No resource conflicts (each task works on independent data)
- No git merge conflicts (completely independent code paths)

**Resource Requirements**: [N] parallel workers (developers or AI agents)

| Task | Name | Estimated Time | Files Modified | Concurrent With |
|------|------|----------------|----------------|-----------------|
| 010 | [Name] | [Hours] | src/models/User.js | 011, 012, 013, ... |
| 011 | [Name] | [Hours] | src/models/Product.js | 010, 012, 013, ... |
| 012 | [Name] | [Hours] | src/models/Order.js | 010, 011, 013, ... |
| ... | | | | |

**Batch Outputs for Next Batch**:
- [What Batch 2 will import/use from Batch 1]
- Example: User, Product, Order models exported from src/models/

**Batch 1 Completion Gate**: Before starting Batch 2, verify:
- [ ] All Batch 1 tasks marked complete in tasks-completed/
- [ ] All Batch 1 files committed to git (no merge conflicts)
- [ ] All Batch 1 tests passing
- [ ] Batch 1 outputs available for import by Batch 2

**Estimated Batch 1 Duration**: [Max task time] hours/days (parallel execution)

**Sequential Execution Comparison**: Would take [Sum of task times] hours/days

---

### Batch 2: [Description - e.g., "Services Using Models"]

**Can Start When**: All Batch 1 tasks complete AND Batch 1 completion gate passed

**Parallelism**: All [M] tasks can execute 100% concurrently

**Dependencies on Prior Batch**:
- Imports models from Batch 1
- Uses Tier 0 patterns and infrastructure

| Task | Name | Estimated Time | Depends On | Files Modified | Concurrent With |
|------|------|----------------|------------|----------------|-----------------|
| 020 | [Name] | [Hours] | Task 010 | src/services/UserService.js | 021, 022, 023, ... |
| 021 | [Name] | [Hours] | Task 011 | src/services/ProductService.js | 020, 022, 023, ... |
| 022 | [Name] | [Hours] | Task 012, 013 | src/services/OrderService.js | 020, 021, 023, ... |
| ... | | | | | |

**Batch Outputs for Next Batch**:
- [What Batch 3 will import/use from Batch 2]

**Batch 2 Completion Gate**: [Same structure as Batch 1]

**Estimated Batch 2 Duration**: [Max task time] hours/days (parallel execution)

---

[Repeat structure for Batch 3, 4, 5, etc.]

---

## Tier Final: Linear Finalization (Sequential Execution Required)

**Can Start When**: ALL parallel batches complete

**Critical Path**: Tier Final tasks must execute in strict order.

| Task | Name | Estimated Time | Requires Complete | Sequential After |
|------|------|----------------|-------------------|------------------|
| 090 | [Name] | [Hours/days] | All batches | - (first in Tier Final) |
| 091 | [Name] | [Hours/days] | All batches + Task 090 | Task 090 |
| 092 | [Name] | [Hours/days] | All batches + Task 091 | Task 091 |
| ... | | | | |

**Tier Final Completion**: Marks end of implementation phase, ready for Phase 4 (Reflection & Delivery)

**Estimated Tier Final Duration**: [Sum of task times] hours/days (sequential)

---

## Timeline Estimates

### Sequential Execution (Traditional)
If all tasks executed one after another:
- Tier 0: [X] hours
- All Batches: [Y] hours (sum of all batch task times)
- Tier Final: [Z] hours
- **Total**: [X + Y + Z] hours = [Days/weeks]

### Parallel Execution (This Strategy)
With tasks parallelized within batches:
- Tier 0: [X] hours (sequential)
- Batch 1: [B1] hours (max task time, not sum)
- Batch 2: [B2] hours (max task time, not sum)
- Batch 3: [B3] hours (max task time, not sum)
- ... (additional batches)
- Tier Final: [Z] hours (sequential)
- **Total**: [X + B1 + B2 + B3 + ... + Z] hours = [Days/weeks]

**Speedup Factor**: [Sequential / Parallel] = **[Ratio]x faster** with parallelization

**Example**: If 30 tasks @ 2 hours each:
- Sequential: 60 hours (7.5 days)
- Parallel (3 batches of 10): 3 + (2×3) + 3 = 12 hours (1.5 days)
- Speedup: 5x faster

---

## Resource Allocation Plan

### Parallel Workers Needed

**Tier 0 Phase**: 1 worker (sequential execution)

**Batch 1**: [N] parallel workers recommended
- Minimum: [N/2] workers (doubled duration)
- Optimal: [N] workers (one per task)
- Can scale up/down based on resource availability

**Batch 2**: [M] parallel workers recommended

**Batch 3**: [P] parallel workers recommended

**Tier Final Phase**: 1 worker (sequential execution)

### Human + AI Agent Mix

**Recommended Strategy**:
- Tier 0: Human developer (critical foundation, requires judgment)
- Parallel Batches: Mix of human developers and AI agents
  - AI agents handle well-defined tasks (CRUD operations, API endpoints, models)
  - Humans handle complex business logic or novel algorithms
- Tier Final: Human developer (integration, deployment, production concerns)

---

## Risk Mitigation

### Merge Conflict Prevention

**By Design**:
- Tasks within same batch modify independent files → no conflicts
- Batch boundaries prevent cross-batch work-in-progress dependencies
- Each task commits to separate feature branch → merge after completion

**Process**:
1. Each task works on feature branch: `task-NNN-feature-name`
2. Task completes → PR created → reviewed → merged to main
3. All tasks in batch merge before next batch starts

### Dependency Violation Prevention

**Enforcement**:
- Tier 0 completion gate blocks Batch 1 start
- Batch N completion gate blocks Batch N+1 start
- architecture.md updates verified before batch transitions

**Monitoring**:
- Check task files in tasks-pending/ respect tier numbering
- Verify no Batch 2 task (020-029) starts before all Batch 1 tasks (010-019) complete

### Quality Gate Enforcement

**Per-Task Quality**:
- Each task has independent quality verification (tests, review, criteria)
- Task cannot move to tasks-completed/ until quality gates pass
- Failing quality in one task doesn't block other parallel tasks

**Batch-Level Quality**:
- Batch completion gate requires ALL tasks in batch pass quality
- Integration tests at batch boundaries verify batch outputs work together

### Parallel Execution Coordination

**For Human Teams**:
- Assign tasks from same batch to different team members
- Daily standup: "I'm working on task 010, who's on 011?"
- Use project management tool (Jira, Linear) to track task assignment

**For AI Agents**:
- Spawn multiple agent instances, each assigned to one task
- Each agent works in isolated git worktree (no directory conflicts)
- Agents report completion, coordinator verifies quality gates
- Coordinator triggers next batch when current batch completes

---

## Execution Checklist

### Before Starting Implementation

- [ ] All task files created in tasks-pending/
- [ ] Tasks numbered by tier (001-009, 010-019, etc.)
- [ ] Dependencies documented in each task file
- [ ] Execution strategy reviewed and understood
- [ ] Resources allocated (developers/agents assigned)
- [ ] Git branching strategy confirmed

### Tier 0 Execution

- [ ] Execute tasks 001-009 in sequential order
- [ ] Document outputs in architecture.md after each task
- [ ] Verify architecture.md has complete "Tier 0 Foundation Results"
- [ ] All Tier 0 tasks in tasks-completed/
- [ ] **Gate passed** → Can proceed to Batch 1

### Batch N Execution

- [ ] All prior batches complete (or Tier 0 for Batch 1)
- [ ] Spawn parallel workers (one per task in batch)
- [ ] Each worker executes their assigned task independently
- [ ] Monitor progress, assist with blockers
- [ ] Each task moves to tasks-completed/ when quality gates pass
- [ ] Verify all tasks in batch complete
- [ ] Run batch-level integration tests
- [ ] **Gate passed** → Can proceed to Batch N+1

### Tier Final Execution

- [ ] All batches complete
- [ ] Execute tasks 090-099 in sequential order
- [ ] Each task waits for prior task completion
- [ ] Verify final integration and deployment readiness
- [ ] All tasks in tasks-completed/
- [ ] **Phase 3 complete** → Proceed to Phase 4 (Reflection & Delivery)

---

## Monitoring & Progress Tracking

### Key Metrics

- **Tasks Complete**: [N completed] / [Total tasks]
- **Current Phase**: [Tier 0 / Batch N / Tier Final]
- **Parallel Efficiency**: [Actual duration vs. estimated parallel duration]
- **Quality Pass Rate**: [Tasks passing quality gates on first attempt]

### Progress Visualization

```
Tier 0: ████████████████████ 100% (4/4 tasks complete)
Batch 1: ████████░░░░░░░░░░░ 40% (4/10 tasks complete)
Batch 2: ░░░░░░░░░░░░░░░░░░░ 0% (waiting for Batch 1)
Batch 3: ░░░░░░░░░░░░░░░░░░░ 0% (waiting for Batch 2)
Tier Final: ░░░░░░░░░░░░░░░░░ 0% (waiting for all batches)
```

### Bottleneck Identification

- **If Tier 0 takes longer than estimated**: Foundation complexity underestimated
- **If a batch task blocks batch completion**: Reassign resources to bottleneck task
- **If batches have uneven completion**: Rebalance future batch task assignments
