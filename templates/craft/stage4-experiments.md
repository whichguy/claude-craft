# Stage 4: Experiment Templates

## Question Queue

### Question [N]: [Short description]

**Source**: [Stage 4 assumption #X | Architecture decision | Integration concern]

**Why it matters**: [What decision depends on this answer?]

**Uncertainty type**: [Performance | Integration | Compatibility | Capability | API behavior]

**Risk if wrong**: [HIGH | MEDIUM | LOW] - What happens if we're wrong?

**Current confidence**: [0-100%] - How certain are we without experiments?

**Target confidence**: [0-100%] - How certain do we need to be?

**Priority**: [CRITICAL | HIGH | MEDIUM | LOW]
- CRITICAL: Blocks architecture decisions
- HIGH: Affects multiple components
- MEDIUM: Affects single component
- LOW: Nice to know, not blocking

---

## Experiment Plan

## Experiment [N]: [Question being tested]

### Hypothesis
What we expect to find and why.

**Predicted answer**: [What we think is true]
**Rationale**: [Why we think this based on docs/experience]

### Success Criteria
**Experiment succeeds if**: [Specific measurable outcome]
**Experiment fails if**: [Specific measurable outcome]
**Inconclusive if**: [What might make results ambiguous]

### Time Limit
**Maximum duration**: [15-60 minutes]
**Force termination**: Yes - if hitting time limit, document findings and move on

### Environment Setup
**Location**: `/tmp/craft-experiments/[timestamp]-[description]/`
**Dependencies**: [Packages to install, services to mock, APIs to access]
**Test data**: [What data/config needed]
**Cleanup strategy**: [What to delete afterward]

### Execution Steps
1. [Specific action]
2. [Specific action]
3. [Verification step]
4. [Documentation of findings]

### Expected Findings
**If hypothesis correct**: [What we'll observe]
**If hypothesis wrong**: [What alternative we'll observe]
**Edge cases to check**: [Boundary conditions]

### Decision Impact
**If experiment validates hypothesis**: [How this affects architecture]
**If experiment invalidates hypothesis**: [What we need to reconsider]
**If inconclusive**: [What follow-up questions arise]

---

## Experiment Synthesis

## Experiment Synthesis (Iteration [N])

### Questions Tested This Iteration
- Question 1: [Short description] → [VALIDATED | INVALIDATED | PARTIAL | INCONCLUSIVE]
- Question 2: [Short description] → [VALIDATED | INVALIDATED | PARTIAL | INCONCLUSIVE]
- Question 3: [Short description] → [VALIDATED | INVALIDATED | PARTIAL | INCONCLUSIVE]

### Key Findings

#### Validated Assumptions
[List assumptions that experiments confirmed - promote from RISKY to SOLID]

#### Invalidated Assumptions
[List assumptions experiments disproved - need architecture revision]

#### New Discoveries
[Unexpected findings that change our understanding]

### Architecture Implications

**Decisions confirmed**: [List architectural choices validated by experiments]

**Decisions requiring revision**: [List architectural choices that need reconsideration]

**New options discovered**: [Alternative approaches revealed by experiments]

### Confidence Updates

| Question | Before Experiments | After Experiments | Change |
|----------|-------------------|-------------------|--------|
| Q1: [...] | 40% | 85% | +45% |
| Q2: [...] | 30% | 70% | +40% |
| Q3: [...] | 50% | 60% | +10% |

### Remaining Uncertainties

**Questions still below target confidence**:
- [Question]: Currently X%, need Y%, gap Z%

**New questions discovered during experiments**:
- [New question 1]
- [New question 2]

### Time Investment
**Total experiment time**: [X minutes/hours]
**Experiments run**: [N]
**Average time per experiment**: [Y minutes]

---

## Quality Gate Evaluation

## Quality Gate Evaluation (Iteration [N])

### Coverage Assessment
- [ ] All CRITICAL questions answered to target confidence?
- [ ] All HIGH priority questions addressed?
- [ ] Architecture decisions validated?
- [ ] Integration patterns confirmed?
- [ ] Performance constraints verified?

### Confidence Assessment

**Overall confidence score**: [0-100%]

Calculate as weighted average:
- CRITICAL questions: weight 3x
- HIGH questions: weight 2x
- MEDIUM questions: weight 1x
- LOW questions: weight 0.5x

Formula:
```
Overall = (Σ confidence_i × weight_i) / (Σ weight_i)
```

### Risk Assessment
- [ ] No blocking uncertainties remain?
- [ ] All RISKY assumptions validated or revised?
- [ ] Fallback options identified for remaining uncertainties?
