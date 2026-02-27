# /optimize-system-prompt Team Architecture - Integration Test Plan

## Test Environment Setup

### Prerequisites
```bash
# Enable team mode
export CLAUDE_CODE_EXPERIMENTAL_PROMPT_TEAMS=true

# Verify agents exist (once created)
ls ~/.claude/agents/optimize-prompt-team-lead.md
ls ~/.claude/agents/optimize-variation-tester.md

# Verify Sheets Chat project accessible
# ScriptId: 1Y72rigcMUAwRd7bwl3CR57O6ENo5sKTn0xAl2C4HoZys75N5utGfkCUG
```

---

## Test Suite 1: Variation Count-Based Routing

### Test 1.1: Single Variation - Single-Agent Mode

**Setup:**
- Simple compression request: "Compress the thinking protocol section"
- Only 1 variation needed
- TEAMS_ENABLED=true

**Execute:**
```bash
/optimize-system-prompt "Compress the thinking protocol section"
```

**Expected Behavior:**
1. Skill detects single variation (no A/B comparison needed)
2. Routes to inline execution (NOT optimize-prompt-team-lead)
3. No TeamCreate called
4. Standard Phase 1-8 workflow

**Verification:**
- [ ] No team directory created
- [ ] Single-agent execution
- [ ] Lower overhead (<5s routing)
- [ ] Compression successful

---

### Test 1.2: Multiple Variations - Team Mode

**Setup:**
- A/B test request: "Create 4 variations with different compression strategies"
- 4 variations to test
- TEAMS_ENABLED=true

**Execute:**
```bash
export CLAUDE_CODE_EXPERIMENTAL_PROMPT_TEAMS=true
/optimize-system-prompt "Create 4 prompt variations and A/B test them"
```

**Expected Behavior:**
1. Skill detects multiple variations (4)
2. Routes to optimize-prompt-team-lead
3. Team lead calls TeamCreate
4. Team lead creates 4 variation tester teammates
5. Testers run A/B tests in parallel
6. Team lead aggregates scores
7. Team lead determines winner
8. Team lead calls TeamDelete

**Verification:**
- [ ] Team directory created
- [ ] 4 variation testers spawned
- [ ] Parallel A/B testing (testers don't wait for each other)
- [ ] Scores aggregated correctly
- [ ] Winner determined
- [ ] Team cleaned up after completion
- [ ] 60%+ faster than sequential testing

---

### Test 1.3: Feature Flag Disabled

**Setup:**
- Multiple variations request
- TEAMS_ENABLED=false OR unset

**Execute:**
```bash
unset CLAUDE_CODE_EXPERIMENTAL_PROMPT_TEAMS
/optimize-system-prompt "Test 4 variations"
```

**Expected Behavior:**
1. Skill detects feature flag disabled
2. Falls back to single-agent mode
3. No TeamCreate regardless of variation count
4. Sequential A/B testing

**Verification:**
- [ ] No team created
- [ ] Single-agent mode used
- [ ] Backward compatibility maintained

---

## Test Suite 2: Parallel Variation Testing

### Test 2.1: Independent Variation Testing

**Setup:**
- 4 prompt variations with different compression strategies:
  - V1: Aggressive prose → directive compression
  - V2: Remove thinking protocol entirely
  - V3: Convert examples to minimal snippets
  - V4: Merge redundant sections

**Execute:**
```bash
/optimize-system-prompt "Create and test these 4 variations"
```

**Expected Behavior:**
1. Team lead spawns 4 variation testers
2. Each tester:
   - Implements assigned variation
   - Runs A/B test harness (10 scenarios, 3 samples each)
   - Measures token usage
   - Calculates scores (8 dimensions)
   - Reports results via SendMessage
3. Testers run completely independently
4. Team lead aggregates all 4 result sets
5. Team lead builds comparison matrix
6. Determines winner based on priorities

**Verification:**
- [ ] 4 testers spawned with correct variation assignments
- [ ] Parallel execution (not sequential)
- [ ] Each tester completes full A/B test
- [ ] All 4 result sets received
- [ ] Comparison matrix accurate
- [ ] Winner determination correct

---

### Test 2.2: Dynamic Tester Spawning

**Setup:**
- 6 variations requested (stress test)

**Expected Behavior:**
1. Team lead receives 6 variation requests
2. Team lead spawns 6 variation testers dynamically
3. Each tester runs independently
4. Team lead aggregates 6 result sets
5. Determines winner from 6-way comparison

**Verification:**
- [ ] Correct number of testers spawned (6)
- [ ] Each tester receives correct variation
- [ ] Parallel execution
- [ ] All 6 results aggregated
- [ ] 6x speedup vs sequential

---

## Test Suite 3: A/B Test Quality

### Test 3.1: Scoring Accuracy

**Setup:**
- 2 variations: V1 (baseline) vs V2 (compressed)
- Known expected outcome (V2 should pass if compression sound)

**Execute:**
```bash
/optimize-system-prompt "Compress thinking protocol, test against baseline"
```

**Expected Behavior:**
1. Team lead spawns 2 testers (baseline + compressed)
2. Each tester runs ABTestHarness (10 scenarios × 3 samples)
3. Testers calculate 8-dimension scores
4. Team lead verifies:
   - Safety gate: 10/10 on destructive ops (both variants)
   - Tier 2: Each scenario within 3% deviation
5. If V2 passes, marks as winner
6. If V2 fails, identifies failing dimensions

**Verification:**
- [ ] Both testers complete full test suite
- [ ] Scores match expected ranges
- [ ] 3% deviation rule enforced
- [ ] Safety gates checked correctly
- [ ] Winner determination based on priorities

---

### Test 3.2: Iteration on Failures

**Setup:**
- Variation fails 3% threshold on Context Awareness

**Expected Behavior:**
1. Team lead detects failure in Context Awareness
2. Team lead identifies root cause (missing environment instructions)
3. Team lead creates new variation with targeted fix
4. Team lead spawns new tester for fixed variation
5. New tester re-runs ONLY affected scenarios
6. Team lead verifies deviation now <3%
7. Determines final winner

**Verification:**
- [ ] Failure detected correctly
- [ ] Root cause identified
- [ ] Targeted fix implemented
- [ ] Re-test limited to affected scenarios
- [ ] Fixed variation passes

---

## Test Suite 4: Team Coordination

### Test 4.1: Variation Tester Independence

**Setup:**
- 3 variations with different A/B test durations (simulated)

**Expected Behavior:**
1. Tester 1 completes in 2 minutes → reports immediately
2. Tester 2 completes in 4 minutes → reports when done
3. Tester 3 completes in 3 minutes → reports when done
4. Team lead collects results as they arrive
5. Team lead waits for all 3 before aggregating
6. No tester blocks another

**Verification:**
- [ ] Testers run independently
- [ ] Results reported as completed
- [ ] Team lead waits for all before aggregating
- [ ] Total time = max(tester times), not sum

---

### Test 4.2: Result Aggregation Format

**Setup:**
- 4 variations tested

**Expected Behavior:**
Team lead receives 4 SendMessage results with structure:
```json
{
  "variation": "V1",
  "token_count": 12500,
  "scores": {
    "correctness": 8.5,
    "gas_compliance": 9.0,
    "context_awareness": 7.8,
    "thinking_quality": 8.2,
    "conciseness": 7.5,
    "tool_usage": 8.8,
    "response_format": 9.2
  },
  "safety_gate": 10.0,
  "pass": true,
  "notes": "Context awareness slightly lower due to compression"
}
```

Team lead aggregates into comparison matrix:
```
| Variation | Tokens | Correctness | GAS | Context | ... | Total | Pass |
```

**Verification:**
- [ ] All testers use consistent result format
- [ ] Team lead parses results correctly
- [ ] Comparison matrix accurate
- [ ] Winner determination uses priorities (correctness > speed > tokens)

---

### Test 4.3: Graceful Shutdown

**Setup:**
- 3 variation testers in progress

**Expected Behavior:**
1. Team lead sends shutdown_request to all testers
2. Each tester finishes current test before responding
3. Testers respond with shutdown_response (approve: true)
4. Team lead waits for all confirmations
5. Team lead calls TeamDelete
6. Team directory cleaned up

**Verification:**
- [ ] All testers receive shutdown_request
- [ ] Testers complete current work gracefully
- [ ] All send shutdown_response
- [ ] Team deleted successfully
- [ ] No orphaned team directories

---

## Test Suite 5: Performance & Scalability

### Test 5.1: Parallel A/B Test Speed

**Setup:**
- 4 variations
- Measure single-agent time vs team time

**Metrics:**
- Single-agent: 4 variations × ~6 minutes each = ~24 minutes
- Team: 4 testers in parallel = ~6 minutes (max tester time)

**Verification:**
- [ ] Team mode 4x faster (one tester duration)
- [ ] All variations tested correctly
- [ ] Quality maintained

---

### Test 5.2: API Cost Analysis

**Test Scenarios:**
1. Single variation (single-agent)
2. 2 variations (team mode)
3. 4 variations (team mode)
4. 6 variations (team mode)

**Track:**
- Total API calls
- Token usage
- Cost per variation tested
- Cost multiplier vs single-agent

**Target:**
- Single: 1x cost
- 2 variations: <1.5x cost (parallelization saves time)
- 4 variations: <2x cost
- 6 variations: <2.5x cost

**Verification:**
- [ ] Cost scales sublinearly with variation count
- [ ] Parallelization provides value for 3+ variations
- [ ] API cost justified by 60%+ speedup

---

## Test Suite 6: Error Handling

### Test 6.1: Variation Tester Failure

**Setup:**
- 3 variations tested
- Simulate tester failure (unhandled error in V2)

**Expected Behavior:**
1. Team lead detects tester-2 failure (timeout or error)
2. Team lead reports partial results from V1 and V3
3. Team lead notes V2 failure in comparison
4. Team lead still calls TeamDelete
5. User sees partial comparison + error notice

**Verification:**
- [ ] Graceful tester failure handling
- [ ] Partial results provided
- [ ] Team cleaned up
- [ ] No orphaned resources

---

### Test 6.2: TeamCreate Failure

**Setup:**
- Multiple variations requested
- Simulate TeamCreate failure

**Expected Behavior:**
1. Skill detects TeamCreate failure
2. Falls back to single-agent mode
3. A/B testing proceeds sequentially
4. User sees fallback warning

**Verification:**
- [ ] Fallback to single-agent works
- [ ] Testing completes
- [ ] User informed of fallback

---

### Test 6.3: A/B Test Harness Unavailable

**Setup:**
- ABTestHarness.gs not accessible

**Expected Behavior:**
1. Variation tester detects harness unavailable
2. Tester falls back to manual validation
3. Tester reports limited results
4. Team lead marks validation incomplete

**Verification:**
- [ ] Graceful fallback to manual validation
- [ ] User informed of limitation
- [ ] Partial results still useful

---

## Test Suite 7: Edge Cases

### Test 7.1: All Variations Fail 3% Threshold

**Setup:**
- 4 variations, all exceed 3% deviation

**Expected Behavior:**
1. Team lead detects all failures
2. Team lead recommends baseline (no change)
3. Team lead suggests refinement strategies
4. No deployment attempted

**Verification:**
- [ ] Failure detection correct
- [ ] Baseline preserved
- [ ] Recommendations provided

---

### Test 7.2: Variation Produces Identical Results

**Setup:**
- 2 variations that are functionally identical

**Expected Behavior:**
1. Both testers complete successfully
2. Scores nearly identical
3. Team lead detects tie
4. Recommends shorter prompt (token savings)

**Verification:**
- [ ] Tie detected correctly
- [ ] Token usage tiebreaker applied

---

### Test 7.3: Exactly 2 Variations (Threshold)

**Setup:**
- Request with exactly 2 variations

**Expected Behavior:**
- Uses team mode (≥2 variations triggers team)

**Verification:**
- [ ] Team mode activated
- [ ] 2 testers spawned
- [ ] Parallelization benefit realized

---

## Success Criteria

Phase 3 implementation is considered successful if:

✅ **Functionality:**
- [ ] All 7 test suites pass
- [ ] Team mode works for 2+ variations
- [ ] Single-agent mode works for single variation
- [ ] Feature flag controls behavior
- [ ] A/B test quality maintained

✅ **Performance:**
- [ ] 60%+ faster for 4+ variations
- [ ] <2.5x API cost for 6 variations
- [ ] Parallelization scales linearly

✅ **Reliability:**
- [ ] Error handling works (tester failure, TeamCreate failure)
- [ ] Graceful fallback to single-agent
- [ ] Team cleanup always executes
- [ ] No resource leaks

✅ **Quality:**
- [ ] Scoring accuracy maintained
- [ ] Winner determination correct
- [ ] Iteration on failures works
- [ ] Results format consistent

---

## Test Execution Log

### Test Run: [Date/Time]
- Environment: [details]
- Feature flag: true

| Test ID | Status | Notes |
|---------|--------|-------|
| 1.1 | [ ] | Single variation single-agent |
| 1.2 | [ ] | Multiple variations team mode |
| 1.3 | [ ] | Feature flag disabled |
| 2.1 | [ ] | Independent variation testing |
| 2.2 | [ ] | Dynamic tester spawning |
| 3.1 | [ ] | Scoring accuracy |
| 3.2 | [ ] | Iteration on failures |
| 4.1 | [ ] | Variation tester independence |
| 4.2 | [ ] | Result aggregation format |
| 4.3 | [ ] | Graceful shutdown |
| 5.1 | [ ] | Parallel A/B test speed |
| 5.2 | [ ] | API cost analysis |
| 6.1 | [ ] | Variation tester failure |
| 6.2 | [ ] | TeamCreate failure |
| 6.3 | [ ] | A/B harness unavailable |
| 7.1 | [ ] | All variations fail |
| 7.2 | [ ] | Identical results |
| 7.3 | [ ] | Exactly 2 variations |

---

## Deployment Checklist

Before deploying to production:

- [ ] All integration tests pass
- [ ] Performance benchmarks meet targets (60%+ speedup)
- [ ] API cost analysis complete (<2.5x for 6 variations)
- [ ] Backward compatibility verified
- [ ] Documentation updated
- [ ] Feature flag defaults reviewed
- [ ] Rollback plan documented
- [ ] User communication prepared

---

## Next Steps (Phase 4+)

If Phase 3 succeeds, consider:

1. **Add Metrics Tracking** - Monitor A/B test pass rates, iteration frequency
2. **Learning System** - Testers remember common compression patterns
3. **Auto-Variation** - ML-based variation generation
4. **Multi-Project Support** - Extend beyond Sheets Chat to other GAS projects
5. **Phase 4**: Apply team architecture to other complex skills

---

## Rollback Plan

If issues arise, disable team mode:
```bash
export CLAUDE_CODE_EXPERIMENTAL_PROMPT_TEAMS=false
# System reverts to single-agent mode immediately
```
