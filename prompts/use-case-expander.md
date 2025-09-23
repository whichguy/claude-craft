# Use Case Discovery & Expansion System

**Template**: use-case-expander
**Context**: `<prompt-arguments>`
**Purpose**: Systematically discover and expand use cases through iterative reasoning
**Methodology**: Phased-prompt.md compliant with 9-activity structure

## Executive Summary

You are an LLM that systematically discovers and expands use cases through iterative reasoning and pattern-based derivation, following the phased-prompt.md template structure.

## CORE DIRECTIVE

When you receive `<prompt-arguments>`, execute the comprehensive use case discovery process using the 9-activity phased approach. Write complete analysis to `<worktree>/planning/use-cases.md` and return a concise summary to the caller.

**SAFETY LIMITS**: Maximum 10 iterations per quality loop, stop on convergence (no new discoveries + all tests passing).

---

## GLOBAL START

**Execute ONCE at the beginning of any prompt using this framework**

### Framework Initialization

```markdown
WHEN starting ANY prompt using this framework:

1. SET GLOBAL VARIABLES (once only):
   <original_pwd> = $(pwd)  # Capture starting location - NEVER CHANGE
   <worktree> = $(pwd)      # Default - may be updated if subagent
   <original-requirements> = <prompt-arguments>
   <worktree_created> = false  # Track if we created a worktree
   <worktree_branch> = ""       # Track worktree branch name
   <worktree_name> = ""         # Track worktree identifier

2. WORKTREE INITIALIZATION (Execute only if running as subagent):
   # Only create worktree if running as subagent to ensure isolation
   IF environment indicates subagent execution OR $(pwd) matches worktree pattern THEN:
     echo "🧠 THINKING: Subagent detected - creating isolated worktree for clean execution"

     # Verify git repository exists
     if ! git -C "<original_pwd>" rev-parse --git-dir >/dev/null 2>&1; then
       echo "📝 Initializing git repository"
       git -C "<original_pwd>" init
       git -C "<original_pwd>" add -A
       git -C "<original_pwd>" commit -m "Initial commit for use case expansion"
     fi

     # Generate unique worktree with anti-collision
     timestamp=$(date +%Y%m%d-%H%M%S)
     random_id=$(openssl rand -hex 3)
     worktree_name="use-case-${timestamp}-${random_id}"
     worktree_path="/tmp/${worktree_name}"

     # Create worktree with new branch based on current
     current_branch=$(git -C "<original_pwd>" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
     worktree_branch="worktree/${current_branch}-${timestamp}"

     echo "🔧 Creating worktree: ${worktree_path} on branch ${worktree_branch}"
     git -C "<original_pwd>" worktree add "${worktree_path}" -b "${worktree_branch}" "${current_branch}"

     # Apply uncommitted changes for continuity
     if ! git -C "<original_pwd>" diff --quiet HEAD 2>/dev/null; then
       echo "📋 Applying uncommitted changes to worktree"
       git -C "<original_pwd>" diff HEAD | git -C "${worktree_path}" apply
     fi

     # Update framework variables for all subsequent operations
     <worktree> = ${worktree_path}
     <worktree_created> = true
     <worktree_branch> = ${worktree_branch}
     <worktree_name> = ${worktree_name}

     echo "✅ Worktree created for progressive intelligence isolation: ${worktree_name}"
   ELSE:
     echo "📝 Standard execution mode - using current directory"

3. CREATE DIRECTORY STRUCTURE:
   mkdir -p "<worktree>/planning"  # Phase documentation
   mkdir -p "<worktree>/docs"      # Final deliverables

4. ESTABLISH PATH DISCIPLINE:
   - NEVER use cd, pushd, popd, or directory changing commands
   - NEVER use relative paths without <worktree> prefix
   - ALWAYS use absolute paths: <worktree>/planning/phase-N.md
   - ALWAYS use git -C "<worktree>" for ALL git operations

5. LOAD ORIGINAL REQUIREMENTS:
   Parse <prompt-arguments> to identify:
   - What needs to be accomplished (use case discovery and expansion)
   - Expected deliverables (complete use case specification)
   - Quality standards (coverage, confidence, granularity)
   - Any constraints or dependencies
```

---

## PHASE 1: Use Case Discovery & Expansion

### Phase Purpose & Dependencies

**PHASE_PURPOSE**: Systematically discover and expand use cases through iterative reasoning and pattern-based derivation

**DEPENDENCIES**:
- Original requirements: <prompt-arguments>
- External dependencies: None (initial phase)

**DELIVERABLES**:
- Complete use case specification in `<worktree>/planning/use-cases.md`
- Summary for caller showing generation results

---

## SYSTEMATIC DERIVATION PATTERNS

Apply these patterns to discover implicit use cases:

**Data Mentions → Derive**:
- "data" → import, export, validation, backup, archival, transformation
- "file" → upload, download, versioning, permissions, storage management
- "report" → collection, formatting, distribution, scheduling, archival

**User/Actor Mentions → Derive**:
- "users" → authentication, authorization, profile management, preferences, sessions
- "admin" → system configuration, user management, monitoring, audit logs
- "team" → collaboration, permissions, sharing, notifications, activity tracking

**Process Mentions → Derive**:
- "workflow" → state management, transitions, approvals, notifications, history
- "integration" → API endpoints, webhooks, data sync, error handling, retry logic
- "real-time" → websockets, polling, push notifications, cache invalidation

**Technical Infrastructure → Derive**:
- "deploy" → CI/CD, environments, rollback, monitoring, health checks
- "cloud" → auto-scaling, load balancing, CDN, disaster recovery
- "microservice" → service discovery, circuit breakers, distributed tracing
- "database" → migrations, backups, replication, indexing, partitioning

**Security Requirements → Derive**:
- "authentication" → MFA, SSO, password policies, session management
- "authorization" → RBAC, ACL, permission models, delegation
- "compliance" → audit logging, data retention, encryption, GDPR/HIPAA
- "security" → vulnerability scanning, penetration testing, incident response

**Quality Mentions → Derive**:
- "secure" → encryption, access control, audit trails, vulnerability scanning
- "scalable" → load balancing, caching, queuing, horizontal scaling, optimization
- "reliable" → error handling, retry logic, fallbacks, health checks, monitoring

---

### Phase Activities

**Execute activities in dependency order (not necessarily sequential)**

#### 1. Rehydration & Intelligence Loading

Load accumulated wisdom from previous phases or runs:

```markdown
IF running from IDEAL-STI Phase 1 THEN:
  Load original requirements: <worktree>/planning/original-requirements.md
  Set context: First-time use case discovery

IF file exists at <worktree>/planning/use-cases.md THEN:
  Load existing use cases for enhancement/validation
  Extract discovered patterns and confidence levels
  Note previous iteration count and quality scores

Generate intelligent predefinitions:
- **CRITERIA_HINTS**: Expected use case count based on project complexity
  - Small projects: 5-10 use cases
  - Medium projects: 10-25 use cases
  - Large projects: 25-50 use cases
  - Enterprise: 50+ use cases
- **RESEARCH_FOCUS**: Domain areas requiring deep investigation
- **PLANNING_BASELINE**: Validated use case patterns from analysis
- **QUALITY_THRESHOLDS**: Minimum coverage, confidence targets

Document rehydration results for this phase.
```

#### 2. Input Extraction & Validation

Extract requirements from input:

```markdown
**INPUT ANALYSIS**:
Examine <prompt-arguments> to determine input type:

1. **Check for file path**:
   IF <prompt-arguments> contains path pattern (e.g., "./requirements.md", "<worktree>/planning/")
   AND file exists at path
   THEN read file content and use as requirements input

2. **Check for existing use cases**:
   IF content contains "UC###:" or "UC[0-9]+:" patterns
   THEN extract underlying requirements from use cases

3. **Direct content**:
   ELSE use <prompt-arguments> directly as requirements text

**VALIDATION**:
- Confirm requirements are parseable and contain actionable content
- Note any ambiguities or missing information
- Extract explicit constraints and scope boundaries

**OUTPUT**: Validated requirements ready for use case analysis
```

#### 3. Criteria Definition (Runtime Intelligence)

Using CRITERIA_HINTS from rehydration, define:

```markdown
**SUCCESS_CRITERIA**: What constitutes completion
- Minimum use cases achieved for project complexity
- All identified actors have relevant use cases
- Each use case has complete DoR and DoD
- Confidence distribution acceptable (>50% HIGH/MEDIUM)
- Coverage score > 80%

**ANTI_CRITERIA**: What must be avoided
- Vague or unmeasurable use cases
- Missing acceptance criteria
- Duplicate functionality across use cases
- Use cases without clear actors
- Technical implementation details in use cases

**DEPENDENCY_CRITERIA**: External requirements
- Alignment with original requirements
- Technical feasibility within constraints
- Business value justification
- Regulatory compliance needs
```

#### 4. Research & Discovery

Using RESEARCH_FOCUS from rehydration:

```markdown
**USER STORY EXTRACTION**:
- Primary Actor: Main user/role benefiting from system
- Core Need: Fundamental problem being addressed
- Value Proposition: Key benefit user seeks
- Context Constraints: Explicit limitations

**TECHNOLOGY PREREQUISITES**:
1. Explicitly mentioned technologies
2. Implied technologies from context
3. Infrastructure prerequisites
4. Development prerequisites
5. Operational prerequisites

**PATTERN APPLICATION**:
Systematically apply ALL derivation patterns:
- [ ] Data patterns (import, export, validation, backup)
- [ ] User/Actor patterns (auth, profiles, sessions)
- [ ] Process patterns (workflow, integration, real-time)
- [ ] Quality patterns (secure, scalable, reliable)
- [ ] Technical patterns (infrastructure, deployment)
- [ ] Domain patterns (industry standards, compliance)

For each pattern NOT applied, document WHY it's not applicable.

**DISCOVERY PROVENANCE TRACKING**:
- From explicit statements: HIGH confidence (90%+)
- From derivation patterns: MEDIUM confidence (60-89%)
- From domain knowledge: LOW confidence (30-59%)
```

#### 5. Planning

Using PLANNING_BASELINE from rehydration:

```markdown
**ANALYSIS STRATEGY**:
1. Extract explicit use cases from requirements
2. Apply systematic patterns for implicit discovery
3. Validate granularity using INVEST criteria
4. Plan iteration strategy for refinement

**EXPANSION STRATEGY**:
For use cases requiring decomposition:
- By actor: Different actors → separate use cases
- By goal: Distinct objectives → separate use cases
- By condition: Different conditions → different approaches
- By complexity: Sequential steps → phased use cases

**QUALITY APPROACH**:
- Target discovery rate for convergence
- Plan maximum iterations based on complexity
- Define coverage validation approach
```

#### 6. Review & Validation

Before executing, validate the plan:

```markdown
**PLAN VALIDATION**:
- Does approach cover all identified actors?
- Are all derivation patterns considered?
- Is granularity strategy appropriate?
- Will output meet success criteria?
- Are dependencies properly addressed?

**COVERAGE CHECK**:
- Actor Coverage: All actors have planned use cases
- Environmental Coverage: All conditions addressed
- User Journey: Entry/exit points covered

IF plan seems incomplete THEN:
  Return to Planning with adjustments
OTHERWISE:
  Proceed to execution
```

#### 7. Execution

Execute use case discovery and analysis:

```markdown
**STEP 1 - INITIAL DISCOVERY**:
- Extract explicit use cases from requirements
- Apply all systematic derivation patterns
- Track discovery provenance and confidence

**STEP 2 - GRANULARITY VALIDATION**:
For EACH discovered use case:
- Apply INVEST criteria
- Test for single goal
- Validate appropriate complexity

**STEP 3 - EXPANSION**:
For use cases failing granularity tests:
- Select appropriate split strategy
- Create sub-use cases with single goals
- Maintain traceability to parent

**STEP 4 - DOCUMENTATION**:
For EACH finalized use case:
- Assign unique identifier (UC001, UC002...)
- Document confidence level and source
- Define complete DoR and DoD
- Note dependencies on other use cases

**STEP 5 - FILE OUTPUT**:
Write complete analysis to: <worktree>/planning/use-cases.md
```

#### 8. Quality Iteration Loop

Using QUALITY_THRESHOLDS from rehydration:

```markdown
FOR iteration FROM 1 TO 10:

  **EVALUATE QUALITY**:
  - Calculate discovery rate: (New discoveries / Previous total)
  - Measure coverage score: (Addressed requirements / Total)
  - Check confidence distribution
  - Validate DoR/DoD completeness

  **QUALITY SCORE CALCULATION**:
  score = (
    (coverage * 0.30) +
    (confidence_quality * 0.25) +
    (granularity_appropriateness * 0.25) +
    (dor_dod_completeness * 0.20)
  )

  IF quality_score >= 80% AND discovery_rate < 10% THEN:
    Break from loop (convergence achieved)

  OTHERWISE:
    **KEY LEARNING**: Document iteration discoveries
    - Coverage gaps identified
    - Patterns newly applied
    - Granularity issues resolved

    Refine approach and return to Execution

  IF iteration == 10 THEN:
    Document best effort with remaining gaps
```

#### 9. Documentation & Knowledge Capture

Document complete results:

```markdown
**FILE OUTPUT** - Write to: <worktree>/planning/use-cases.md

# Use Case Analysis Results

## Analysis Summary
- **Total Iterations**: [N]/10
- **Use Cases Discovered**: [Total count]
- **Explicit vs Implicit Ratio**: [X:Y]
- **Convergence Achieved**: [Yes/No] at iteration [N]
- **Quality Score**: [X%]

## Use Case Specifications

### UC001: [Name]
**Confidence**: [HIGH/MEDIUM/LOW]
**Source**: [Explicit statement / Pattern: X / Domain standard: Y]
**Goal**: [Single clear objective]
**Primary Actor**: [Who initiates]
**Dependencies**: [UC### must complete first] or [None]

**Definition of Ready**:
□ Technical: [Required systems/tools]
□ Knowledge: [Required skills/training]
□ Dependencies: [Prerequisite use cases]
□ Resources: [Required personnel/budget]
□ Acceptance: [Clear criteria defined]

**Basic Flow**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Definition of Done**:
✓ User: [What user achieves]
✓ System: [What system ensures]
✓ Data: [What data is handled correctly]
✓ Quality: [Performance/reliability standard met]
✓ Security: [What is protected] (if applicable)

[Additional use cases...]

## Quality Metrics
- **Completeness Score**: [X%]
- **Granularity Score**: [X%]
- **Confidence Distribution**: HIGH=[N], MEDIUM=[N], LOW=[N]

## Coverage Validation
- **Actor Coverage**: [X/Y] = [Z%]
- **Environmental Coverage**: [X/Y] = [Z%]
- **User Journey**: [Complete/Gaps noted]

---

**CALLER SUMMARY** - Return to LLM caller:

# Use Case Analysis Complete

## Summary
- **File Written**: <worktree>/planning/use-cases.md
- **Use Cases Generated**: [count]
- **Quality Score**: [X%]
- **Convergence**: Iteration [N]

## Categories Discovered
- Core Functionality: [N] use cases
- Authentication/Security: [N] use cases
- Data Management: [N] use cases
- Technical Infrastructure: [N] use cases
- Administrative: [N] use cases

## Key Insights
- [Major discovery 1]
- [Major discovery 2]
- [Pattern observation]

## Next Phase Ready
The complete use case analysis with [N] use cases has been written to the planning directory, ready for requirements generation in Phase 2.
```

---

## GLOBAL END

**Execute AFTER all phases complete to ensure original requirements satisfied**

### Requirements Validation

```markdown
1. LOAD ORIGINAL REQUIREMENTS:
   Review <original-requirements> from Global Start

2. EVIDENCE GATHERING:
   For each requirement in original request:
   - Search ALL phase outputs for evidence of satisfaction
   - Check completeness and quality of solution
   - Document gaps or partial solutions

   Create requirements satisfaction matrix:
   | Requirement | Phase(s) Addressed | Quality Score | Evidence | Status |
   |-------------|-------------------|---------------|----------|--------|
   | Use case discovery | Phase 1 | [score]/10 | use-cases.md | [status] |
   | Pattern application | Phase 1 | [score]/10 | derivation patterns | [status] |
   | Quality iteration | Phase 1 | [score]/10 | convergence achieved | [status] |
```

### Global Quality Score Calculation

```markdown
GLOBAL_QUALITY_SCORE = (
  (REQUIREMENTS_SATISFACTION * 0.40) +
  (COMPLETENESS_SCORE * 0.25) +
  (COHERENCE_SCORE * 0.20) +
  (VALUE_DELIVERY * 0.15)
) * PHASE_CONSISTENCY_MULTIPLIER

MINIMUM_ACCEPTABLE_SCORE = 7.0/10.0

Quality Thresholds:
- 9.0-10.0: Exceptional - Exceeds expectations
- 8.0-8.9: Excellent - Fully satisfies with high quality
- 7.0-7.9: Good - Meets requirements acceptably
- 6.0-6.9: Marginal - Significant gaps or issues
- Below 6.0: Unacceptable - Requires remediation
```

### Meta-Learning Extraction

```markdown
Extract insights for future prompts:

SUCCESSFUL STRATEGIES:
- Which derivation patterns yielded most discoveries?
- Which criteria types proved most valuable?
- Which iteration patterns converged fastest?
- Which confidence scoring approaches worked best?

FAILED APPROACHES:
- Patterns that over-generated irrelevant use cases
- Criteria that proved unmeasurable or misleading
- Research directions that were dead ends
- Quality patterns that missed important cases

FRAMEWORK EVOLUTION:
- Additional derivation patterns to consider
- Better granularity detection methods
- Improved confidence scoring mechanisms
- Enhanced convergence detection
```

### WORKTREE CONSOLIDATION

```markdown
# Merge worktree if one was created (only for subagent execution)
IF <worktree_created> == true THEN:
  echo "🧠 THINKING: Framework execution complete - consolidating worktree"

  # CRITICAL SAFETY CHECK - never delete if we're inside it
  <current_location> = $(pwd)

  IF "<worktree>" != "<current_location>" THEN:
    echo "✅ Safe to consolidate - not inside worktree"

    # Gather framework execution metadata
    use_case_count=$(grep -c "^### UC[0-9]" "${worktree}"/planning/use-cases.md 2>/dev/null || echo "0")
    quality_score="${GLOBAL_QUALITY_SCORE:-unknown}"
    files_created=$(find "${worktree}" -type f -name "*.md" | wc -l || echo "0")

    # Build informative commit message with framework context
    worktree_commit="feat(use-case-expander): ${worktree_name} execution complete

Framework: use case discovery and expansion
Worktree: ${worktree_name}
Branch: ${worktree_branch}
Use cases discovered: ${use_case_count}
Quality score: ${quality_score}/10
Planning docs: $(ls -1 '${worktree}'/planning/*.md 2>/dev/null | wc -l)
Deliverables: $(ls -1 '${worktree}'/docs/*.md 2>/dev/null | wc -l)

Progressive knowledge accumulation and pattern-based derivation completed."

    # Commit all worktree changes
    echo "📝 Committing worktree changes"
    git -C "${worktree}" add -A
    if ! git -C "${worktree}" diff --cached --quiet; then
      git -C "${worktree}" commit -m "${worktree_commit}"
    fi

    # Merge back to original branch with detailed message
    merge_message="merge(use-case-expander): Consolidate ${worktree_name} results

Source: ${worktree_branch}
Use cases: ${use_case_count} discovered
Quality: ${quality_score}/10
Framework: Progressive intelligence with pattern derivation

This merge includes all discovered use cases, planning documents, and
analysis artifacts from the isolated worktree execution, preserving the
knowledge accumulation and derivation patterns discovered."

    # Execute squash merge for clean history
    git -C "<original_pwd>" merge "<worktree_branch>" --squash
    git -C "<original_pwd>" commit -m "${merge_message}"

    # Clean up worktree and branch
    git -C "<original_pwd>" worktree remove "<worktree>" --force
    git -C "<original_pwd>" branch -D "<worktree_branch>"
    git -C "<original_pwd>" worktree prune

    echo "✅ Worktree consolidated - use cases preserved in main branch"

  ELSE:
    echo "⚠️ SAFETY: Cannot delete worktree - currently inside it"
    echo "📍 Location: ${worktree}"
    echo "📍 Branch: ${worktree_branch}"
    echo "📍 Use cases: ${use_case_count}"

    # Commit changes but preserve worktree for safety
    git -C "${worktree}" add -A
    git -C "${worktree}" commit -m "wip(use-case-expander): ${worktree_name} - manual merge required"

    cat << EOF
⚠️ MANUAL CONSOLIDATION REQUIRED
Worktree cannot be removed (safety: pwd inside worktree)

Framework execution details:
- Worktree: ${worktree_name}
- Branch: ${worktree_branch}
- Location: ${worktree}
- Use cases discovered: ${use_case_count}

To consolidate manually after exiting worktree:
1. cd "<original_pwd>"
2. git -C "<original_pwd>" merge "<worktree_branch>" --squash
3. git -C "<original_pwd>" commit -m "merge: Consolidate use case expansion"
4. git -C "<original_pwd>" worktree remove "<worktree>" --force
5. git -C "<original_pwd>" branch -D "<worktree_branch>"
EOF
  FI
ELSE:
  echo "📝 No worktree was created - standard execution completed"
FI
```

### Final Documentation

```markdown
Create comprehensive final report: <worktree>/docs/use-case-expansion-report.md

Include:
- Requirements satisfaction matrix with evidence
- Global quality score with detailed breakdown
- Complete use case inventory with confidence levels
- Pattern effectiveness analysis
- Meta-learning insights for future expansions
- Executive summary of discovered use cases

IF Global Quality Score < 7.0 THEN:
  Execute detailed remediation process (focus on missing use cases)
```

---

## Anti-Patterns to Avoid

### Analysis Anti-Patterns
- **Shallow Thinking**: Single-step derivations without reasoning chains
- **Pattern Blindness**: Applying patterns without checking applicability
- **Granularity Extremes**: Use cases too large (>10 DoD) or too small (<3 DoD)
- **Missing Prerequisites**: No technology or infrastructure discovery
- **Confidence Inflation**: Marking inferred items as HIGH confidence
- **File Writing Failure**: Not persisting analysis to planning directory

### Recovery Strategies
- If shallow: Force deeper thinking with 3+ "why" chains
- If incomplete: Re-run pattern checklist systematically
- If poorly sized: Apply INVEST criteria rigorously
- If missing context: Research domain standards
- If file issues: Verify <worktree>/planning/ exists

---

## USE CASE NUMBERING

- **Primary**: UC001, UC002, UC003...
- **Expanded**: UC001a, UC001b (when split from UC001)
- **Related groups**: UC10x for authentication, UC20x for reporting, etc.

## CONFIDENCE SCORING

For each use case, assign:
- **HIGH (90%+)**: Explicitly stated in requirements
- **MEDIUM (60-89%)**: Derived from clear patterns or domain standards
- **LOW (30-59%)**: Inferred from context, needs validation

---

## Integration with IDEAL-STI Framework

This prompt is designed to work as Phase 1 of IDEAL-STI v3.0:

**DEPENDENCIES**:
- Input from Global Start: `<worktree>/planning/original-requirements.md`
- External dependencies: None (initial phase)

**DELIVERABLES**:
- Complete use case specification in `<worktree>/planning/use-cases.md`
- Summary for caller showing generation results
- Ready for Phase 2: Requirements Generation

---

## EXECUTION REMINDER

**Execute ALL 9 activities → Write to file → Return summary to caller**

Think systematically, derive comprehensively, converge efficiently, persist permanently.