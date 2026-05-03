# /gas-review Team Architecture - Integration Test Plan

## Test Environment Setup

### Prerequisites
```bash
# Enable team mode
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true
export GAS_REVIEW_TEAM_THRESHOLD=5

# Verify agents exist
ls ~/.claude/agents/gas-review-team-lead.md
ls ~/.claude/agents/gas-code-review.md
ls ~/.claude/agents/gas-ui-review.md
ls ~/.claude/agents/gas-cross-file-validator.md
```

---

## Test Suite 1: Threshold-Based Routing

### Test 1.1: Small Project (≤5 files) - Single-Agent Mode

**Setup:**
- Create test GAS project with 3 files: Code.gs, Utils.gs, sidebar.html
- Ensure `GAS_REVIEW_TEAM_THRESHOLD=5`

**Execute:**
```bash
# Invoke /gas-review skill with project path
/gas-review --project test-gas-small
```

**Expected Behavior:**
1. Skill detects 3 files (≤ threshold)
2. Routes to inline orchestration (NOT gas-review-team-lead)
3. Spawns gas-code-review and gas-ui-review via Task tool
4. NO TeamCreate called
5. Returns unified review results

**Verification:**
- [ ] No team directory created at `~/.claude/teams/gas-review-*`
- [ ] No task list created at `~/.claude/tasks/gas-review-*`
- [ ] Review completes in single-agent mode
- [ ] API cost ~1x baseline

---

### Test 1.2: Medium Project (>5 files) - Team Mode

**Setup:**
- Create test GAS project with 12 files (8 .gs + 4 .html)
- Ensure `GAS_REVIEW_TEAM_THRESHOLD=5` and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true`

**Execute:**
```bash
/gas-review --project test-gas-medium
```

**Expected Behavior:**
1. Skill detects 12 files (> threshold)
2. Routes to gas-review-team-lead agent
3. Team lead calls TeamCreate
4. Team lead creates tasks for specialists
5. Specialists claim tasks via TaskUpdate
6. Specialists coordinate via SendMessage
7. Cross-file validator runs after specialists
8. Team lead aggregates results
9. Team lead calls TeamDelete on completion

**Verification:**
- [ ] Team directory created at `~/.claude/teams/gas-review-[run_id]`
- [ ] Task list created with 3-4 tasks
- [ ] All tasks marked completed
- [ ] Team directory deleted after completion
- [ ] API cost ~2-3x baseline
- [ ] Performance improvement vs. single-agent (30%+ faster)

---

### Test 1.3: Feature Flag Disabled

**Setup:**
- Same medium project (12 files)
- Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=false` OR unset

**Execute:**
```bash
unset CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
/gas-review --project test-gas-medium
```

**Expected Behavior:**
1. Skill detects feature flag disabled
2. Falls back to single-agent mode (inline orchestration)
3. NO TeamCreate called regardless of file count

**Verification:**
- [ ] No team created
- [ ] Single-agent mode used
- [ ] Backward compatibility maintained

---

## Test Suite 2: Team Coordination

### Test 2.1: Task Distribution

**Setup:**
- Medium project with .gs, .html, and CardService code
- Team mode enabled

**Expected Behavior:**
1. Team lead creates tasks:
   - "Review .gs files" → gs-specialist
   - "Review .html files" → ui-specialist
   - "Validate cross-file consistency" → cross-file-validator
2. Specialists claim tasks independently
3. Each specialist completes their task
4. All tasks marked completed

**Verification:**
- [ ] TaskList shows all tasks with correct owners
- [ ] Each specialist reports completion via SendMessage
- [ ] Team lead receives all completion messages

---

### Test 2.2: Cross-File Validation Coordination

**Setup:**
- Project with cross-file issues:
  - sidebar.html calls `google.script.run.getData()`
  - Code.gs has getData() but NOT exported in module.exports

**Expected Behavior:**
1. gs-specialist reviews Code.gs, detects getData function
2. ui-specialist reviews sidebar.html, detects getData call
3. cross-file-validator requests export data from gs-specialist
4. cross-file-validator requests function calls from ui-specialist
5. cross-file-validator detects missing export
6. cross-file-validator reports CRITICAL error to team lead

**Verification:**
- [ ] Cross-file validator receives structured data via SendMessage
- [ ] Missing export detected and reported
- [ ] Error includes file/line numbers
- [ ] Severity marked as CRITICAL

---

### Test 2.3: Graceful Shutdown

**Setup:**
- Medium project review in progress

**Expected Behavior:**
1. Team lead sends shutdown_request to all specialists
2. Each specialist responds with shutdown_response (approve: true)
3. Team lead waits for all confirmations
4. Team lead calls TeamDelete
5. Team directory cleaned up

**Verification:**
- [ ] All specialists receive shutdown_request
- [ ] All specialists send shutdown_response
- [ ] Team deleted successfully
- [ ] No orphaned team directories

---

## Test Suite 3: Specialist Agents

### Test 3.1: gas-code-review Dual-Mode Operation

**Test 3.1.1: Standalone Mode**
```bash
# Direct invocation without team context
Task(subagent_type="gas-code-review", prompt="Review Code.gs")
```

**Expected:** Works without TaskList, returns results directly

**Test 3.1.2: Teammate Mode**
```bash
# Within team context
TeamCreate(team_name="test-team")
TaskCreate(subject="Review Code.gs")
Task(subagent_type="gas-code-review", team_name="test-team")
```

**Expected:** Claims task, coordinates via SendMessage, marks complete

**Verification:**
- [ ] Standalone mode works (backward compatible)
- [ ] Teammate mode detects TaskList
- [ ] Teammate mode uses TaskUpdate and SendMessage
- [ ] Memory persists across reviews

---

### Test 3.2: gas-ui-review Dual-Mode Operation

**Test 3.2.1: Standalone Mode**
```bash
Task(subagent_type="gas-ui-review", prompt="Review sidebar.html")
```

**Expected:** Router mode detection, spawns gas-ui-code-review or gas-ui-plan-review

**Test 3.2.2: Teammate Mode**
```bash
# Within team context
TeamCreate(team_name="test-team")
TaskCreate(subject="Review sidebar.html")
Task(subagent_type="gas-ui-review", team_name="test-team")
```

**Expected:** Claims task, performs review, coordinates with gs-specialist if needed

**Verification:**
- [ ] Standalone mode routing works
- [ ] Teammate mode claims tasks
- [ ] Cross-file coordination via SendMessage
- [ ] Memory persists

---

### Test 3.3: gas-cross-file-validator Teammate-Only Mode

**Setup:**
- Team context with completed .gs and .html reviews

**Expected Behavior:**
1. Validator waits for specialist completion
2. Requests export data from gs-specialist
3. Requests function calls from ui-specialist
4. Builds validation maps
5. Detects cross-file issues
6. Reports to team lead

**Verification:**
- [ ] Validator does NOT work in standalone mode
- [ ] Validator coordinates via SendMessage
- [ ] Validation checks all 6 categories (exports, includes, handlers, manifest, globals, circular deps)
- [ ] Reports structured findings

---

## Test Suite 4: Performance & Scalability

### Test 4.1: Large Project Performance

**Setup:**
- Create large GAS project (30+ files)
- Measure baseline single-agent time
- Measure team-based time

**Metrics:**
- Single-agent time: [baseline]
- Team-based time: [target: 30-50% faster]
- API cost multiplier: [target: <3x]

**Verification:**
- [ ] Team mode completes 30%+ faster for 30+ files
- [ ] API cost increase <3x baseline
- [ ] All files reviewed correctly
- [ ] Cross-file validation still works

---

### Test 4.2: API Cost Analysis

**Test Projects:**
1. Small (3 files) - single-agent
2. Medium (12 files) - team mode
3. Large (30 files) - team mode

**Track:**
- Total API calls
- Token usage
- Cost per file reviewed
- Cost multiplier vs. single-agent

**Target:**
- Small: 1x cost (single-agent)
- Medium: <2x cost (team parallelization benefit)
- Large: <3x cost (diminishing overhead)

**Verification:**
- [ ] Cost scales reasonably with team size
- [ ] Parallelization provides value for 10+ files
- [ ] Threshold of 5 files is optimal

---

## Test Suite 5: Error Handling

### Test 5.1: Specialist Failure

**Setup:**
- Medium project
- Simulate gs-specialist failure (unhandled error)

**Expected Behavior:**
1. Team lead detects specialist failure (timeout or error message)
2. Team lead reports partial results
3. Team lead still calls TeamDelete
4. User sees clear error message

**Verification:**
- [ ] Team lead handles specialist errors gracefully
- [ ] Partial results returned
- [ ] Team cleaned up
- [ ] No orphaned resources

---

### Test 5.2: TeamCreate Failure

**Setup:**
- Medium project
- Simulate TeamCreate failure

**Expected Behavior:**
1. Skill detects TeamCreate failure
2. Falls back to single-agent mode
3. Review still completes
4. User sees warning about fallback

**Verification:**
- [ ] Fallback to single-agent works
- [ ] Review completes successfully
- [ ] User informed of fallback

---

### Test 5.3: Cross-File Validator Missing Data

**Setup:**
- Team review where gs-specialist fails to respond to validator

**Expected Behavior:**
1. Validator times out waiting for data
2. Validator reports partial validation results
3. Validator marks incomplete areas clearly
4. Team lead aggregates partial results

**Verification:**
- [ ] Validator handles missing data gracefully
- [ ] Partial validation still valuable
- [ ] Clear indication of what was skipped

---

## Test Suite 6: Backward Compatibility

### Test 6.1: Existing /gas-review Workflows

**Test existing usage patterns:**
1. Snippet review: `/gas-review` with code in conversation
2. File review: `/gas-review Code.gs`
3. Project review: `/gas-review ~/gas-projects/my-project`

**Expected:**
- All work exactly as before when file count ≤ threshold OR feature flag disabled

**Verification:**
- [ ] Snippet review works
- [ ] Single file review works
- [ ] Small project review works
- [ ] Output format unchanged
- [ ] No breaking changes

---

### Test 6.2: Subagent Compatibility

**Test direct subagent invocation:**
```bash
Task(subagent_type="gas-code-review", prompt="Review this code: ...")
```

**Expected:**
- Works in standalone mode
- No team coordination required
- Returns results directly to caller

**Verification:**
- [ ] Standalone invocation still works
- [ ] No dependency on team infrastructure
- [ ] Backward compatible with existing orchestrators

---

## Test Suite 7: Edge Cases

### Test 7.1: Empty Project

**Setup:**
- GAS project with 0 .gs and .html files (only appsscript.json)

**Expected:**
- Skill handles gracefully, reports "no files to review"

---

### Test 7.2: Mixed File Types

**Setup:**
- Project with .gs, .html, .json, .md files

**Expected:**
- Only .gs and .html reviewed
- Other files ignored

---

### Test 7.3: Exactly Threshold Files

**Setup:**
- Project with exactly 5 files (threshold = 5)

**Expected:**
- Uses single-agent mode (≤ threshold)

---

## Success Criteria

Phase 1 implementation is considered successful if:

✅ **Functionality:**
- [ ] All 7 test suites pass
- [ ] Team mode works for projects >5 files
- [ ] Single-agent mode works for projects ≤5 files
- [ ] Feature flag controls behavior correctly
- [ ] Backward compatibility maintained

✅ **Performance:**
- [ ] 30%+ faster for 10+ file projects
- [ ] <3x API cost increase
- [ ] Threshold of 5 files is optimal

✅ **Reliability:**
- [ ] Error handling works
- [ ] Graceful fallback to single-agent
- [ ] Team cleanup always executes
- [ ] No resource leaks

✅ **Quality:**
- [ ] Cross-file validation works correctly
- [ ] Specialists coordinate properly
- [ ] Results accuracy maintained or improved
- [ ] Output format consistent

---

## Test Execution Log

### Test Run: [Date/Time]
- Environment: [details]
- Threshold: 5
- Feature flag: true

| Test ID | Status | Notes |
|---------|--------|-------|
| 1.1 | [ ] | Small project single-agent |
| 1.2 | [ ] | Medium project team mode |
| 1.3 | [ ] | Feature flag disabled |
| 2.1 | [ ] | Task distribution |
| 2.2 | [ ] | Cross-file coordination |
| 2.3 | [ ] | Graceful shutdown |
| 3.1 | [ ] | gas-code-review modes |
| 3.2 | [ ] | gas-ui-review modes |
| 3.3 | [ ] | cross-file-validator |
| 4.1 | [ ] | Large project performance |
| 4.2 | [ ] | API cost analysis |
| 5.1 | [ ] | Specialist failure |
| 5.2 | [ ] | TeamCreate failure |
| 5.3 | [ ] | Validator missing data |
| 6.1 | [ ] | Existing workflows |
| 6.2 | [ ] | Subagent compatibility |
| 7.1 | [ ] | Empty project |
| 7.2 | [ ] | Mixed file types |
| 7.3 | [ ] | Exactly threshold files |

---

## Deployment Checklist

Before deploying to production:

- [ ] All integration tests pass
- [ ] Performance benchmarks meet targets
- [ ] API cost analysis complete
- [ ] Backward compatibility verified
- [ ] Documentation updated
- [ ] Feature flag defaults reviewed
- [ ] Rollback plan documented
- [ ] User communication prepared

---

## Next Steps (Phase 2+)

If Phase 1 succeeds, consider:

1. **Phase 2:** Refactor /gas-debug with team architecture
2. **Phase 3:** Refactor /review-bench:optimize-system-prompt with parallel A/B testing
3. **Phase 4:** Add metrics tracking and observability
4. **Phase 5:** Tune threshold based on production data
