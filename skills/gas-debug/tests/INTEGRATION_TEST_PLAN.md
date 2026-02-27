# /gas-debug Team Architecture - Integration Test Plan

## Test Environment Setup

### Prerequisites
```bash
# Enable team mode
export CLAUDE_CODE_EXPERIMENTAL_DEBUG_TEAMS=true

# Verify agents exist
ls ~/.claude/agents/gas-debug-team-lead.md
ls ~/.claude/agents/gas-debug-commonjs.md
ls ~/.claude/agents/gas-debug-spreadsheet.md
ls ~/.claude/agents/gas-debug-html.md
ls ~/.claude/agents/gas-debug-hypothesis-tester.md
```

---

## Test Suite 1: Complexity-Based Routing

### Test 1.1: Simple Bug - Single-Agent Mode

**Setup:**
- Simple CommonJS error: "Cannot find module 'Utils'"
- Clear single-domain issue
- TEAMS_ENABLED=true

**Execute:**
```bash
/gas-debug "Getting error: Cannot find module 'Utils' in require statement"
```

**Expected Behavior:**
1. Skill detects single-domain issue (CommonJS only)
2. Routes to inline debugging (NOT gas-debug-team-lead)
3. No TeamCreate called
4. Standard Section 1 debugging workflow

**Verification:**
- [ ] No team directory created
- [ ] Single-agent debugging executed
- [ ] Lower overhead (<2s routing)
- [ ] Correct diagnosis provided

---

### Test 1.2: Complex Bug - Team Mode

**Setup:**
- Multi-domain bug: "Sidebar shows blank, console shows module error, and sheets data not loading"
- Symptoms span HTML + CommonJS + SpreadsheetApp
- TEAMS_ENABLED=true

**Execute:**
```bash
/gas-debug "Sidebar is blank, console shows 'Cannot find module Utils', and getRange() returns null"
```

**Expected Behavior:**
1. Skill detects multi-domain complexity
2. Routes to gas-debug-team-lead
3. Team lead calls TeamCreate
4. Team lead spawns 3 specialists (commonjs, spreadsheet, html)
5. Specialists investigate in parallel
6. Team lead aggregates findings
7. Team lead calls TeamDelete

**Verification:**
- [ ] Team directory created
- [ ] 3 specialists spawned
- [ ] Parallel investigation (specialists don't wait for each other)
- [ ] Results aggregated from all specialists
- [ ] Team cleaned up after completion
- [ ] 3-5x faster than sequential investigation

---

### Test 1.3: Feature Flag Disabled

**Setup:**
- Complex multi-domain bug
- TEAMS_ENABLED=false OR unset

**Execute:**
```bash
unset CLAUDE_CODE_EXPERIMENTAL_DEBUG_TEAMS
/gas-debug "Complex multi-domain error..."
```

**Expected Behavior:**
1. Skill detects feature flag disabled
2. Falls back to single-agent mode
3. No TeamCreate regardless of complexity

**Verification:**
- [ ] No team created
- [ ] Single-agent mode used
- [ ] Backward compatibility maintained

---

## Test Suite 2: Parallel Hypothesis Testing

### Test 2.1: Competing Theories

**Setup:**
- Bug: "Function fails with TypeError but only sometimes"
- Multiple possible causes: quota limits, timing issue, null reference, permission error

**Execute:**
```bash
/gas-debug "getFoo() fails with TypeError: Cannot read property 'bar' of null - but only sometimes"
```

**Expected Behavior:**
1. Team lead spawns specialists
2. Specialists generate hypotheses:
   - Theory A: Quota exhaustion causing null return
   - Theory B: Timing/race condition
   - Theory C: Permission intermittently denied
   - Theory D: Sheet reference stale
3. Team lead spawns 4 hypothesis testers (one per theory)
4. Testers run tests in parallel
5. Results: Theory B CONFIRMED, others RULED_OUT
6. Team lead reports root cause: timing issue

**Verification:**
- [ ] Multiple hypotheses identified
- [ ] N testers spawned for N theories
- [ ] Parallel test execution
- [ ] Results classification (CONFIRMED/RULED_OUT/INCONCLUSIVE)
- [ ] Root cause determined from evidence

---

### Test 2.2: Dynamic Tester Spawning

**Setup:**
- 6 competing theories from specialists

**Expected Behavior:**
1. Team lead receives 6 hypotheses from specialist reports
2. Team lead spawns 6 hypothesis testers dynamically
3. Each tester tests independently
4. Team lead aggregates 6 results
5. Determines primary cause from test evidence

**Verification:**
- [ ] Correct number of testers spawned (6)
- [ ] Each tester receives correct hypothesis
- [ ] Parallel execution (not sequential)
- [ ] Results aggregated correctly

---

## Test Suite 3: RESUME Capability

### Test 3.1: Simple Bug RESUME

**Setup:**
- Simple bug debugged in Session 1
- User says "dig deeper" → Session 2

**Execute:**
```bash
# Session 1
/gas-debug "Module error..."
# <diagnosis provided>

# Session 2 (fork continues)
"dig deeper"
```

**Expected Behavior:**
1. Session 2 has full context from Session 1
2. `context: fork` preserves conversation
3. Doesn't re-run initial diagnostics
4. Builds on previous findings

**Verification:**
- [ ] Session 2 has Session 1 context
- [ ] No redundant diagnostics
- [ ] Deeper investigation based on previous findings

---

### Test 3.2: Team Mode RESUME

**Setup:**
- Complex bug debugged with team in Session 1
- User says "dig deeper" → Session 2 (new team)

**Execute:**
```bash
# Session 1
/gas-debug "Complex multi-domain error..."
# <team investigation, findings reported>

# Session 2
"dig deeper on the CommonJS issue"
```

**Expected Behavior:**
1. Session 2 creates NEW team (separate team ID)
2. Team lead memory loads previous_findings from Session 1
3. Ruled-out theories NOT re-tested
4. Focus on specific area (CommonJS) per user request
5. New team cleans up after Session 2

**Verification:**
- [ ] New team created (different ID)
- [ ] Memory loads previous findings
- [ ] Skips ruled-out theories
- [ ] Focused investigation (CommonJS only)
- [ ] Both teams cleaned up

---

## Test Suite 4: Specialist Coordination

### Test 4.1: Domain Specialist Expertise

**Test CommonJS Specialist:**
```bash
/gas-debug "Error: Factory not found for 'auth/SessionManager'"
```

**Expected:**
- Team lead routes to commonjs-specialist
- Specialist recognizes pattern: missing loadNow
- Specialist tests hypothesis with specific diagnostics
- Reports with confidence: HIGH

**Test SpreadsheetApp Specialist:**
```bash
/gas-debug "getRange() returns null intermittently"
```

**Expected:**
- Team lead routes to spreadsheet-specialist
- Specialist tests quota, bounds, permissions, lifecycle
- Reports findings with evidence

**Test HTML Specialist:**
```bash
/gas-debug "Sidebar shows blank, createTemplateFromFile fails"
```

**Expected:**
- Team lead routes to html-specialist
- Specialist tests template compilation, includes, scriptlets
- Reports with solution recommendations

**Verification:**
- [ ] Correct specialist invoked for error type
- [ ] Specialist uses domain-specific diagnostics
- [ ] Evidence-based reporting
- [ ] Confidence scoring included

---

### Test 4.2: Cross-Specialist Communication

**Setup:**
- Bug requires insights from multiple specialists
- CommonJS issue affects HTML rendering

**Expected Behavior:**
1. HTML specialist detects function call in template
2. HTML specialist requests info from CommonJS specialist (via team lead)
3. CommonJS specialist confirms export issue
4. Team lead aggregates: root cause in CommonJS, symptom in HTML

**Verification:**
- [ ] Specialists coordinate via team lead
- [ ] Cross-domain insights combined
- [ ] Root cause vs symptom identified correctly

---

## Test Suite 5: Performance & Scalability

### Test 5.1: Parallel Investigation Speed

**Setup:**
- Multi-domain bug with 3 specialists needed
- Measure single-agent time vs team time

**Metrics:**
- Single-agent time: [baseline - sequential investigation]
- Team time: [target: 3-5x faster with parallel investigation]

**Verification:**
- [ ] Team mode 3-5x faster for multi-domain bugs
- [ ] Specialists don't wait for each other
- [ ] All domain checks happen in parallel

---

### Test 5.2: Hypothesis Testing Parallelization

**Setup:**
- 6 competing theories
- Measure sequential testing vs parallel testing

**Metrics:**
- Sequential: 6 tests × ~10s each = ~60s
- Parallel: 6 tests simultaneously = ~10s

**Verification:**
- [ ] 6x speedup for hypothesis testing
- [ ] All tests run independently
- [ ] Results aggregated correctly

---

## Test Suite 6: Error Handling

### Test 6.1: Specialist Failure

**Setup:**
- CommonJS specialist encounters unhandled error
- Team investigation in progress

**Expected Behavior:**
1. Team lead detects specialist failure (timeout or error)
2. Team lead reports partial results from other specialists
3. Team lead still calls TeamDelete
4. User sees partial diagnosis + error notice

**Verification:**
- [ ] Graceful specialist failure handling
- [ ] Partial results provided
- [ ] Team cleaned up
- [ ] No orphaned resources

---

### Test 6.2: TeamCreate Failure

**Setup:**
- Complex bug triggers team mode
- TeamCreate fails (permissions, resource limit, etc.)

**Expected Behavior:**
1. Skill detects TeamCreate failure
2. Falls back to single-agent mode
3. Debugging still proceeds
4. User sees fallback warning

**Verification:**
- [ ] Fallback to single-agent works
- [ ] Debugging completes
- [ ] User informed of fallback

---

## Test Suite 7: Edge Cases

### Test 7.1: Unknown Error Domain

**Setup:**
- Error doesn't match CommonJS, SpreadsheetApp, or HTML patterns
- Could be DriveApp, GmailApp, or other service

**Expected Behavior:**
1. Team lead cannot identify specialist
2. Falls back to single-agent general debugging
3. Uses Section 4 (Quick Diagnostics)

**Verification:**
- [ ] Graceful handling of unknown domains
- [ ] Fallback to general debugging
- [ ] User gets diagnostic results

---

### Test 7.2: Simple Bug Misclassified as Complex

**Setup:**
- Single-domain bug with verbose error message
- Skill incorrectly classifies as complex

**Expected Behavior:**
1. Team mode triggered
2. Only one specialist activated
3. Quick diagnosis (no slowdown from team overhead)
4. Team cleans up

**Verification:**
- [ ] Single specialist handles efficiently
- [ ] Minimal overhead from team coordination
- [ ] Correct diagnosis despite misclassification

---

### Test 7.3: No Error - Diagnostic Request

**Setup:**
- User requests general diagnostics: "Check my GAS project health"
- No specific error

**Expected Behavior:**
1. Skill runs Section 4 (Quick Diagnostics) in single-agent mode
2. Parallel triage (all basic checks simultaneously)
3. Reports project health status

**Verification:**
- [ ] Single-agent mode for health checks
- [ ] No unnecessary team overhead
- [ ] Comprehensive diagnostic report

---

## Success Criteria

Phase 2 implementation is considered successful if:

✅ **Functionality:**
- [ ] All 7 test suites pass
- [ ] Team mode works for complex bugs
- [ ] Single-agent mode works for simple bugs
- [ ] Feature flag controls behavior
- [ ] RESUME capability preserved in both modes

✅ **Performance:**
- [ ] 3-5x faster for multi-domain bugs (parallel specialists)
- [ ] 6x faster for hypothesis testing (parallel testers)
- [ ] <2s overhead for team coordination

✅ **Reliability:**
- [ ] Error handling works (specialist failure, TeamCreate failure)
- [ ] Graceful fallback to single-agent
- [ ] Team cleanup always executes
- [ ] RESUME context preserved

✅ **Quality:**
- [ ] Specialist domain expertise evident
- [ ] Hypothesis testing identifies root causes
- [ ] Results accuracy maintained or improved
- [ ] Evidence-based recommendations

---

## Test Execution Log

### Test Run: [Date/Time]
- Environment: [details]
- Feature flag: true

| Test ID | Status | Notes |
|---------|--------|-------|
| 1.1 | [ ] | Simple bug single-agent |
| 1.2 | [ ] | Complex bug team mode |
| 1.3 | [ ] | Feature flag disabled |
| 2.1 | [ ] | Competing theories |
| 2.2 | [ ] | Dynamic tester spawning |
| 3.1 | [ ] | Simple bug RESUME |
| 3.2 | [ ] | Team mode RESUME |
| 4.1 | [ ] | Specialist expertise |
| 4.2 | [ ] | Cross-specialist communication |
| 5.1 | [ ] | Parallel investigation speed |
| 5.2 | [ ] | Hypothesis testing parallelization |
| 6.1 | [ ] | Specialist failure |
| 6.2 | [ ] | TeamCreate failure |
| 7.1 | [ ] | Unknown error domain |
| 7.2 | [ ] | Misclassified simple bug |
| 7.3 | [ ] | No error diagnostic |

---

## Deployment Checklist

Before deploying to production:

- [ ] All integration tests pass
- [ ] Performance benchmarks meet targets (3-5x speedup)
- [ ] RESUME capability verified in both modes
- [ ] Backward compatibility confirmed
- [ ] Documentation updated
- [ ] Feature flag defaults reviewed
- [ ] Rollback plan documented

---

## Next Steps (Phase 3)

If Phase 2 succeeds, consider:

1. **Add Permissions Specialist** - OAuth, quotas, rate limiting expertise
2. **Performance Metrics** - Track investigation time, hypothesis hit rate
3. **Learning System** - Specialists remember common issues per project
4. **Auto-Classification** - ML-based complexity detection
5. **Phase 3**: Refactor `/optimize-system-prompt` with parallel A/B testing
