---
name: requirements-generator
description: Transform use cases into comprehensive requirements through evidence-based discovery with progressive 15-phase analysis. Use for systematic requirements derivation.
model: inherit
---

**Template**: requirements-generator
**Context**: `<prompt-arguments>`
**Purpose**: Transform use cases into comprehensive, evidence-based requirements specification
**Methodology**: Phased-prompt.md compliant with 9-activity structure wrapping 16-phase discovery framework
**Isolation**: Universal worktree isolation pattern (accepts parent_worktree, creates nested worktree, merges back)

## Core Directive

**Parameters**:
- `$1` (`parent_worktree`): Parent worktree/branch to fork from (defaults to `$(pwd)` if not provided)
- `$2` (`user_worktree_name`): Optional semantic worktree name prefix
- `$3` (`prompt-arguments`): Use cases from Phase 2 or file path

**Execution Pattern**:
1. Accept parent worktree as "branch" to fork from
2. Create nested isolated worktree via `create-worktree` agent
3. Execute comprehensive requirements generation in isolation
4. Write complete requirements to `<worktree>/planning/requirements.md`
5. Merge back to parent worktree via `merge-worktree` agent
6. Return concise summary to caller

When invoked, intelligently parse the `<prompt-arguments>` context to extract use cases and execute comprehensive requirements generation through all activities.

**Argument Processing Logic**:
```
Analyze <prompt-arguments> for content extraction:

1. **Check for file path patterns**:
   IF <prompt-arguments> contains:
     - Path separators ("/" or "\")
     - File extensions (".md", ".txt")
     - Worktree patterns ("<worktree>/" or "./" or "../")
     - Keywords like "use-cases=" or "requirements=" or "file=" or "path="
   THEN:
     Extract file path and read content
     Validate content format (UC### patterns for use cases)

2. **Check for structured content**:
   IF <prompt-arguments> contains:
     - "UC###:" or "UC[0-9]+:" patterns directly
     - Markdown-formatted use case content
   THEN:
     Use content directly as use cases

3. **Natural language extraction**:
   ELSE:
     Parse <prompt-arguments> as natural language description
     Look for: "from <file>", "using <content>", "based on <requirements>"
     Extract relevant content contextually
```

Write complete requirements to `<worktree>/planning/requirements.md` and return a concise summary.

## Framework Initialization

When starting execution:

1. **Accept Incoming Parameters** (Universal Worktree Isolation Pattern):
   - `<parent_worktree>` = ${1:-$(pwd)} # Parent worktree/branch to fork from
   - `<user_worktree_name>` = ${2:-} # Optional semantic worktree name
   - `<prompt-arguments>` = ${3:-} # Use cases from Phase 2

2. **Set Global Variables**:
   - `<original_pwd>` = $(pwd) # Capture starting location - NEVER CHANGE
   - `<worktree>` = "" # Will be set to nested worktree
   - `<original-use-cases>` = extracted use cases content
   - `<worktree_created>` = false # Track if we created a worktree
   - `<worktree_branch>` = "" # Track worktree branch name
   - `<worktree_name>` = "" # Track worktree identifier

3. **Universal Worktree Isolation** (Execute ALWAYS for isolation):
   ```bash
   # Universal pattern: ALL agents create isolated worktree for clean execution
   echo "🧠 THINKING: Creating isolated worktree for requirements generation"
   echo "🧠 THINKING: Parent worktree (branch): <parent_worktree>"

   # Verify git repository exists in parent worktree
   if ! git -C "<parent_worktree>" rev-parse --git-dir >/dev/null 2>&1; then
     echo "📝 Initializing git repository in parent worktree"
     git -C "<parent_worktree>" init
     git -C "<parent_worktree>" add -A
     git -C "<parent_worktree>" commit -m "Initial commit for requirements generation"
   fi

   # Use create-worktree agent for robust worktree creation with auto-initialization
   # Agent handles: collision-resistant naming, branch creation, uncommitted changes
   # Pass user_worktree_name if provided, otherwise use default "requirements-generator"
   worktree_prefix="${user_worktree_name:-requirements-generator}"
   echo "🔧 Calling create-worktree agent with prefix: ${worktree_prefix}"
   ask create-worktree "<parent_worktree>" "${worktree_prefix}" "requirements-generator"

   # Extract agent return values from XML tags
   extracted_worktree=$(echo "$LAST_AGENT_OUTPUT" | grep -oP '<worktree>\K[^<]+')
   extracted_branch=$(echo "$LAST_AGENT_OUTPUT" | grep -oP '<branch>\K[^<]+')
   extracted_source=$(echo "$LAST_AGENT_OUTPUT" | grep -oP '<source>\K[^<]+')

   # Validate agent returned valid worktree path
   if [ -z "$extracted_worktree" ] || [ ! -d "$extracted_worktree" ]; then
     echo "❌ FAILED: create-worktree agent did not return valid worktree path"
     echo "Agent output:"
     echo "$LAST_AGENT_OUTPUT"
     exit 1
   fi

   # ⚠️ CRITICAL: Reassign framework <worktree> variable to agent's returned path
   # ALL subsequent requirements generation operations will use this path
   <worktree> = ${extracted_worktree}
   <worktree_created> = true
   <worktree_branch> = ${extracted_branch}
   <worktree_name> = $(basename "${extracted_worktree}")

   echo "✅ Nested worktree ready for isolated execution"
   echo "⚠️  ALL file operations must use <worktree> as the base path"
   ```

4. **Create Directory Structure**:
   - `mkdir -p "<worktree>/planning"` # Phase documentation
   - `mkdir -p "<worktree>/docs"` # Final deliverables

5. **Path Discipline**:
   - NEVER use cd, pushd, popd, or directory changing commands
   - ALWAYS use absolute paths: `<worktree>/planning/phase-N.md`
   - ALWAYS use `git -C "<worktree>"` for ALL git operations

---

# PHASE 1: Requirements Generation

## Phase Purpose & Dependencies

**PHASE_PURPOSE**: Transform use cases into comprehensive, evidence-based requirements specification through 16-phase discovery methodology with continuous quality gates and architectural minimalism.

**DEPENDENCIES**:
- Input from Phase 2 (Use Case Expansion): Use cases document
- Original project context: <prompt-arguments>
- External dependencies: None

**DELIVERABLES**:
1. Complete requirements specification (`<worktree>/planning/requirements.md`)
2. Requirements quality report with scoring and metrics
3. Traceability matrices linking requirements to use cases
4. Test specifications for each requirement
5. Implementation sequence guidance

---

## Phase Activities

**Execute activities in dependency order (not necessarily sequential)**

### 1. Rehydration & Intelligence Loading

Load accumulated wisdom and establish baseline parameters:

**Load Previous Phase Outputs**:
- Parse `<prompt-arguments>` to extract use cases using argument processing logic
- Validate use case format (UC### patterns)
- Extract any provided architecture context

**Generate Intelligent Predefinitions**:

**CRITERIA_HINTS**: Suggest success/failure patterns
- Evidence-based requirements score ≥8
- Architectural minimalism (start at Level -1)
- Quality gates at >85% completeness per phase
- Convergence at <10% discovery rate for 2 iterations
- Maximum 15 phases execution (mandatory)

**RESEARCH_FOCUS**: Areas requiring investigation
- Use case complexity indicators
- Domain-specific NFR categories
- Integration points from use cases
- Compliance requirements by domain

**PLANNING_BASELINE**: Validated strategies
- 16 discovery phases (Phase 0-15)
- Iterative NFR cycles (minimum 9, maximum 50)
- Evidence scoring system (-10 to +10)
- Architectural complexity levels (-1 to 7)

**QUALITY_THRESHOLDS**: Expected iteration counts
- Use case discovery convergence: <15% discovery rate
- NFR cycles: Minimum 9, convergence at <10% for 2 cycles
- Pruning: Remove requirements scoring <0
- Final validation: 100% use case mapping

Document rehydration results in: `<worktree>/planning/phase-1-rehydration.md`

---

### 1.5. Baseline Discovery & Delta Context

Load baseline artifacts and use case delta for change detection:

```markdown
**BASELINE DISCOVERY**:
1. **Discover baseline file from parent worktree**:
   baseline_path = "<parent_worktree>/planning/requirements.md"

   echo "🔍 Checking for baseline requirements at: ${baseline_path}"

   IF exists(baseline_path):
     baseline_content = read(baseline_path)
     baseline_exists = true

     IF baseline_content is empty OR baseline_content contains only whitespace:
       # NEW project - first iteration
       baseline_state = "EMPTY"
       delta_mode = "FIRST_ITERATION"
       echo "📝 Baseline file exists but is empty - treating as first iteration (NEW project)"
     ELSE:
       # DELTA project - subsequent iteration
       baseline_state = "POPULATED"
       delta_mode = "CHANGE_DETECTION"
       baseline_requirements = parse_requirements(baseline_content)
       baseline_count = count(baseline_requirements)
       echo "📊 Baseline contains ${baseline_count} requirements - will perform delta analysis (DELTA project)"
   ELSE:
     # No baseline file (should have been created in Phase 1, but proceed safely)
     baseline_content = ""
     baseline_exists = false
     baseline_state = "MISSING"
     delta_mode = "FIRST_ITERATION"
     echo "⚠️  No baseline file found - treating as first iteration"

2. **Load use case delta context**:
   use_cases_delta_path = "<parent_worktree>/planning/use-cases-delta.md"

   echo "🔗 Loading use case delta context from: ${use_cases_delta_path}"

   IF exists(use_cases_delta_path):
     use_cases_delta = read(use_cases_delta_path)
     parse_use_case_changes(use_cases_delta)
     # Extract ADDED/MODIFIED/REMOVED/UNCHANGED use cases
     # This informs which requirements need generation/update
     echo "📋 Use case changes identified: +${added_uc} new, ~${modified_uc} modified, -${removed_uc} removed"
   ELSE:
     echo "⚠️  No use case delta found - will generate all requirements from use cases"

3. **Set execution context**:
   Document baseline status for transparency:
   - Baseline file path: ${baseline_path}
   - Baseline exists: [true/false]
   - Baseline state: [EMPTY/POPULATED/MISSING]
   - Delta mode: [FIRST_ITERATION/CHANGE_DETECTION]
   - Baseline requirement count: [N or 0]
   - Use case delta loaded: [true/false]

4. **Store baseline for delta computation**:
   <GLOBAL_BASELINE_STATE> = baseline_state
   <GLOBAL_DELTA_MODE> = delta_mode
   <GLOBAL_BASELINE_CONTENT> = baseline_content
   <GLOBAL_BASELINE_REQUIREMENTS> = baseline_requirements (if POPULATED)
   <GLOBAL_USE_CASE_DELTA> = use_cases_delta (if exists)

Note: This context will be used later (after generation) to compute requirements delta analysis.
```

---

### 2. Input Extraction & Validation

**Extract Inputs from Parameters**:

```bash
# 1. Read Use Cases (required)
USE_CASES=$(echo "<prompt-arguments>" | extract_use_cases)

# Validate format
if ! echo "$USE_CASES" | grep -q "UC[0-9]\+:"; then
  ERROR: "Invalid use case format - expected UC### patterns"
  HALT execution
fi

# 2. Extract Architecture Context (optional)
ARCHITECTURE=$(echo "<prompt-arguments>" | extract_architecture_if_present)
```

**Validation Rules**:
- Use cases MUST contain UC### formatted entries
- Each use case MUST have description
- Architecture context is optional

**Error Handling**:
- If use cases missing: HALT with clear error message
- If format invalid: Provide format example and HALT
- If architecture missing: Proceed with defaults

Document extracted inputs in: `<worktree>/planning/phase-1-inputs.md`

---

### 3. Criteria Definition (Runtime Intelligence)

**Generate Runtime Criteria Based on Input Analysis**:

After analyzing extracted use cases, define discovery criteria:

```markdown
## Discovery Criteria (Runtime-Generated)

**Use Case Complexity Assessment**:
- Simple use cases detected: [count] → Target architecture Level 0-2
- Moderate use cases detected: [count] → Target architecture Level 2-4
- Complex use cases detected: [count] → Target architecture Level 4-6

**Domain Analysis**:
- Detected domains: [UI/UX, Backend, Integration, Security, Performance]
- Each domain suggests specific NFR categories to emphasize

**Architectural Triggers Detected**:
- [ ] Multiple concurrent users mentioned → Level 2+ required
- [ ] Real-time updates required → Level 2+ required
- [ ] User authentication specified → Level 2+ required
- [ ] Large data volumes stated → Level 3+ required
- [ ] High availability mentioned → Level 4+ required

**NFR Emphasis Levels** (based on use case content):
- Performance: [FULL/CORE/STANDARD/MINIMAL] based on explicit/implicit/domain/no mention
- Security: [FULL/STANDARD/BASIC/MINIMAL] based on data sensitivity
- Scalability: [HIGH/MEDIUM/LOW] based on scale indicators
- Compliance: [STRICT/STANDARD/MINIMAL] based on domain

**Convergence Targets**:
- Phase 2 convergence: <15% discovery rate
- NFR convergence: <10% for 2 consecutive cycles
- Minimum NFR cycles: 9
- Maximum total cycles: 50
```

Document criteria in: `<worktree>/planning/phase-1-criteria.md`

---

### 4. Research & Discovery

**NOT APPLICABLE** - Requirements generation does not require external research. All discovery is performed through systematic analysis lenses in execution activity.

Skip this activity and proceed to Activity 5: Planning.

---

### 5. Planning

**Create Comprehensive Execution Plan**:

Based on criteria from Activity 3, plan the 16-phase discovery execution:

```markdown
## Requirements Discovery Plan

**Phase Execution Strategy**:
1. **Phase 0-1** (30-50% confidence): Parse and classify use cases
2. **Phase 2** (50-65% confidence): Apply 11 analytical lenses to discover implicit requirements
3. **Phase 3-5** (65-82% confidence): Convert to explicit requirements and assess capabilities
4. **Phase 6-6.5** (80-88% confidence): Iterative NFR derivation (9-50 cycles)
5. **Phase 7-9** (85-94% confidence): Hidden requirements, documentation, lifecycle
6. **Phase 10-11** (92-96% confidence): Consolidation and validation
7. **Phase 12-15** (95-100% confidence): Final QA, implementation specs, sequencing, testing

**Quality Gate Checkpoints**:
- After Phase 1: Ensure 85% completeness of classification
- After Phase 2: Verify discovery rate <15% for convergence
- After Phase 3: Validate all requirements have evidence scores
- After Phase 6: Ensure NFR convergence criteria met
- After Phase 11: Confirm all requirements scored and pruned
- After Phase 12: Validate 100% use case traceability

**Parallelization Opportunities**:
- Phase 2 lenses can be analyzed concurrently (11 lenses)
- Phase 6 NFR cycles can assess multiple categories simultaneously
- Phase 15 test specifications can be generated per requirement type in parallel

**Risk Mitigation**:
- Continuous scoring prevents conjecture accumulation
- Quality gates at every phase prevent progression with gaps
- Architectural minimalism prevents over-engineering
- Evidence requirements prevent feature creep
```

Document plan in: `<worktree>/planning/phase-1-plan.md`

---

### 6. Review & Validation

**Pre-Execution Validation**:

Review the plan and criteria before executing discovery:

**Validation Checklist**:
- [ ] Use cases extracted and validated successfully
- [ ] Runtime criteria generated based on use case analysis
- [ ] Phase execution strategy accounts for all 16 phases
- [ ] Quality gate checkpoints defined at key transitions
- [ ] Scoring system understood (-10 to +10 evidence-based)
- [ ] Architectural levels understood (-1 to 7, start at -1)
- [ ] Convergence criteria clear (<15% Phase 2, <10% NFR)

**Approval Gate**:
- If all validation items pass: Proceed to Activity 7 (Execution)
- If validation fails: Return to Activity 3 to refine criteria

Document validation in: `<worktree>/planning/phase-1-validation.md`

---

### 7. Execution

**Execute all 16 discovery phases systematically**:

---

#### Sub-Phase 0: Input Rehydration & Context Analysis

**Target Confidence**: 0-30%

**INPUT ANALYSIS**:
Examine `<prompt-arguments>` to determine input type and extract use cases:

**REHYDRATION LOGIC**:
```
Analyze <prompt-arguments> for content extraction:

1. **Check for file path patterns**:
   IF <prompt-arguments> contains:
     - Path separators ("/" or "\")
     - File extensions (".md", ".txt")
     - Worktree patterns ("<worktree>/" or "./" or "../")
   THEN:
     Extract file path and read content
     Validate content format (UC### patterns for use cases)

2. **Check for parameter patterns**:
   IF <prompt-arguments> contains:
     - "use-cases=" followed by content or path
     - "architecture=" followed by content or path
   THEN:
     Parse named parameters and extract values
     For each value, apply file path detection logic

3. **Direct content processing**:
   ELSE:
     Use <prompt-arguments> directly as use cases content
     Validate format contains use case patterns

Validation:
- Use cases should contain "UC###:" or "UC[0-9]+:" patterns
- Architecture should contain technology decisions or stack info
- Error gracefully if format validation fails
```

**OUTPUT**: Extracted and validated use cases and architecture context

Document in: `<worktree>/planning/phase-0-rehydration.md`

---

#### Sub-Phase 1: Use Case Analysis & Classification

**Target Confidence**: 30-50%

**Parse the use cases** (extracted in Phase 0) and systematically analyze each one:

1. **Extract core functionality** described in each use case
2. **Identify user personas** and their specific needs
3. **Classify use cases by domain**: UI/UX, backend services, integrations, security, performance
4. **Determine complexity levels**: Simple, Moderate, Complex
5. **Map relationships** between use cases to identify dependencies

**Quality Gate Check - Phase 1**:
- For each identified functionality: Is this actually in the use case text?
- For each persona: Are they explicitly mentioned or reasonably implied?
- For each classification: Does the evidence support this categorization?
- **Prune**: Remove any assumptions not grounded in evidence
- **Score**: Apply initial scoring to each finding

Document in: `<worktree>/planning/phase-1-analysis.md`

---

#### Sub-Phase 2: Multi-Lens Use Case Discovery

**Target Confidence**: 50-65%

**Apply systematic analytical lenses to uncover implicit use cases** (iterate until convergence):

##### Lens 0: Minimal Architecture Analysis
**First Question**: Can this be solved with static files?
- Can requirements be met with HTML/CSS/JS only?
- Can data be stored in JSON/CSV files?
- Can updates be manual rather than dynamic?

**Escalation Triggers** (Check these BEFORE adding complexity):
- Multiple concurrent users mentioned → Consider Level 2+
- Real-time updates required → Consider Level 2+
- User authentication specified → Consider Level 2+
- Large data volumes stated → Consider Level 3+
- High availability mentioned → Consider Level 4+

**If no triggers present**: STOP at simplest level that works

##### Lens 1: Actor Analysis
- **Primary Actors**: End users, administrators, system operators
- **Secondary Actors**: External systems, background processes, maintenance tools
- **Edge Case Actors**: Emergency responders, auditors, compliance checkers

##### Lens 2: Data Flow Analysis
- **Data Sources**: Where does information originate?
- **Transformations**: How is data processed, validated, enriched?
- **Storage Points**: Temporary buffers, permanent storage, caches, logs
- **Output Destinations**: Reports, notifications, API responses, file exports

##### Lens 3: Temporal Analysis
- **System Lifecycle**: Installation, configuration, normal operation, maintenance
- **Session Lifecycle**: Login, active use, idle time, session expiry, logout
- **Data Lifecycle**: Creation, modification, archival, deletion, backup/restore
- **Business Cycles**: Daily operations, weekly reports, monthly processing

##### Lens 4: Error Analysis
- **Input Errors**: Invalid data, missing fields, format violations
- **System Errors**: Network failures, database unavailability, resource exhaustion
- **Integration Errors**: External API failures, timeout conditions
- **Business Rule Violations**: Insufficient permissions, policy violations

##### Lens 5: Integration Analysis
- **Upstream Dependencies**: Systems that provide data or services
- **Downstream Consumers**: Systems that receive data or services
- **Synchronization Points**: Real-time updates, batch processing
- **Protocol Requirements**: REST APIs, message queues, file transfers

##### Lens 6: Platform Analysis
- **Device Variations**: Desktop, mobile, tablet interfaces
- **Browser Differences**: Feature support, performance characteristics
- **Network Conditions**: High-speed, mobile, offline, intermittent connectivity
- **Environment Differences**: Development, staging, production configurations

##### Lens 7: Scale Analysis
- **User Scale**: Single user, small team, department, enterprise, public access
- **Data Volume**: Records, file sizes, concurrent operations, historical data
- **Geographic Distribution**: Local, regional, national, global deployments
- **Load Patterns**: Peak usage, seasonal variations, growth trajectories

##### Lens 8: Compliance Analysis
- **Data Protection**: GDPR, CCPA, HIPAA, industry-specific privacy requirements
- **Security Standards**: ISO 27001, SOC 2, PCI DSS, government regulations
- **Accessibility**: WCAG guidelines, ADA compliance, assistive technology support
- **Industry Standards**: Domain-specific regulations and best practices

##### Lens 9: Lifecycle Analysis
- **Installation**: System setup, configuration, initial data migration
- **Operation**: Normal use patterns, maintenance tasks, monitoring
- **Evolution**: Updates, feature additions, configuration changes
- **Migration**: Data imports/exports, system transitions, legacy integrations
- **Decommissioning**: Data extraction, archival, secure deletion

##### Lens 10: Operational Analysis
**Reasonably Implied Operational Needs**:
1. **Installation & Setup** (if use cases imply deployment): Score +6 if deployment mentioned, +4 otherwise
2. **Data Migration** (if use cases mention existing data): Score +8 if existing data mentioned, +2 otherwise
3. **CI/CD Pipeline** (if use cases imply ongoing development): Score +6 if updates mentioned, +3 otherwise
4. **Operational Monitoring** (if use cases imply production use): Score +4 if production implied, +1 otherwise
5. **Backup & Recovery** (if use cases involve important data): Score +6 if data importance implied, +2 otherwise

**Quality Gate Check - Phase 2**:
- Is each lens discovery based on use case evidence?
- Score each discovered requirement immediately (use scoring system)
- If score < 0, mark as "QUESTIONABLE" and flag for review
- Track: How many discoveries per lens? Are we inventing or discovering?

**Convergence Check**: After applying all lenses, count newly discovered use cases. If discovery rate is <15% compared to previous iteration, proceed to Phase 3. Otherwise, iterate again.

Document in: `<worktree>/planning/phase-2-discovery.md`

---

#### Sub-Phase 3: Stated Requirements Conversion

**Target Confidence**: 65-75%

**Transform each use case into explicit functional requirements**:

1. **Convert narrative descriptions** into precise "The system shall..." statements
2. **Extract user interactions** and define expected system responses
3. **Identify data inputs and outputs** with validation requirements
4. **Define business rules** and logic constraints explicitly
5. **Specify error handling** and edge case behaviors
6. **Document integration touchpoints** with external systems

**Quality Gate Check - Phase 3**:
For each functional requirement derived:
- **Evidence Test**: Quote the exact use case text driving this requirement
- **Necessity Test**: Would the system fail without this requirement?
- **Complexity Test**: Is this the simplest way to meet the use case need?
- **Scope Test**: Are we adding features not requested in use cases?
- **Score**: Apply full scoring system (Evidence + Complexity)
- If score < 0: Mark as "ASSUMED - Needs Validation"

Document in: `<worktree>/planning/phase-3-functional-requirements.md`

---

#### Sub-Phase 4: Minimal Capability Assessment (NOT Technology Selection)

**Target Confidence**: 70-80%

**Derive capability needs from functional requirements**:

##### Capability Escalation Checklist:
1. **Storage Needs**:
   - Default: File-based storage (JSON, JSONL, CSV, SQLite)
   - Escalate to database ONLY if use cases mention concurrent writes, complex queries, or transactions
   - Document: "UC-X requires [specific need], therefore database capability needed"

2. **Processing Needs**:
   - Default: Client-side or batch processing
   - Escalate to server ONLY if use cases mention shared state, server-side security, or real-time processing
   - Document: "UC-Y requires [specific need], therefore server capability needed"

3. **Deployment Needs**:
   - Default: Static hosting or local execution
   - Escalate to cloud/server ONLY if use cases mention availability requirements, remote access, or scheduled execution
   - Document: "UC-Z requires [specific need], therefore hosting capability needed"

**Architecture Complexity Warning**:
If suggesting anything above Level 2, provide:
- Exact use case quote requiring this complexity
- Simpler alternative and why it's insufficient
- Cost/complexity trade-off analysis

**Technology Deferment Statement**:
"Specific technology choices are implementation decisions, not requirements, unless explicitly specified in user-provided use cases"

Document in: `<worktree>/planning/phase-4-capabilities.md`

---

#### Sub-Phase 5: Full Dependency Tree Discovery

**Target Confidence**: 75-82%

**For each identified capability requirement**:

##### Primary Dependency Analysis:
If requirement needs "database capability" →
- Database server/service (or embedded like SQLite)
- Database drivers/clients
- Connection management
- Migration tools
- Backup tools
- Monitoring approach

##### Secondary Dependency Analysis:
For each primary dependency →
- What does IT require?
- Installation prerequisites
- Configuration requirements
- Version compatibility
- Operating system needs

##### Dependency Requirement Generation:
For each dependency, generate requirements for:
1. **Installation Requirements**: Dependency checking, version checking, auto-install option, fallback behavior
2. **Configuration Requirements**: Connection strings (if needed), authentication setup (if needed), performance tuning (only if use cases demand)
3. **Migration Requirements** (only if existing data mentioned): From previous versions, from alternative technologies, data format conversions, rollback procedures
4. **Uninstall Requirements**: Clean removal procedures, data preservation options, dependency cleanup

**Quality Gate for Dependencies**:
- Is each dependency justified by use case needs or industry standards?
- Can we use embedded/bundled versions to reduce external dependencies?
- Can we make dependencies optional or provide fallbacks?
- Score: -1 per dependency level beyond minimal necessary
- If total dependency score < -3: Mark as "CONSIDER SIMPLER APPROACH"

Document in: `<worktree>/planning/phase-5-dependencies.md`

---

#### Sub-Phase 6: Iterative Non-Functional Requirements (NFR) Derivation Engine

**Target Confidence**: 80-87%

**Execute systematic NFR discovery cycles** (minimum 9 cycles, maximum 50):

##### Proportional NFR Discovery:
- **Explicit mention** (e.g., "fast", "performance", "speed") → Full performance suite (+8 to +10)
- **Implicit need** (e.g., "interactive", "real-time", "responsive") → Core performance NFRs (+6 to +8)
- **Domain expectation** (e.g., web app, API, CLI tool) → Standard performance NFRs (+4 to +6)
- **No mention** → Minimal baseline performance NFRs (+2 to +4)
- Never skip categories entirely - adjust depth and scoring instead

##### NFR Cycle 1: Core Performance Requirements
**Derive performance NFRs from functional requirements**:
- **Response Time**: Maximum acceptable delays for user interactions
- **Throughput**: Transactions, requests, or operations per second/minute/hour
- **Resource Usage**: CPU, memory, disk, network bandwidth consumption limits
- **Concurrent Users**: Maximum simultaneous user capacity
- **Data Processing**: Batch job completion times, real-time processing latencies

**Quality Gate Check**:
- Evidence Check: Is this performance need mentioned, implied, or industry-standard?
- Foundation Check: Can we justify specific thresholds with evidence or best practices?
- Complexity Check: Is the requirement proportional to the system's needs?
- Score: Apply graduated scoring system (-10 to +10)

##### NFR Cycle 2: Scalability & Growth Requirements
**Analyze functional requirements for scalability implications**:
- **Horizontal Scaling**: Multi-server deployment, load distribution patterns
- **Vertical Scaling**: Resource upgrade paths, hardware limitations
- **Data Growth**: Storage expansion, archival strategies, partitioning needs
- **User Growth**: Capacity planning, performance degradation thresholds
- **Geographic Scaling**: Multi-region deployment, content delivery networks

##### NFR Cycle 3: Security & Privacy Requirements
**Extract security NFRs from functional and data requirements**:
- **Authentication**: Multi-factor, SSO, session management, password policies
- **Authorization**: Role-based access, permissions, privilege escalation protection
- **Data Protection**: Encryption at rest/transit, PII handling, data masking
- **Audit Trails**: Security event logging, compliance reporting, forensic capabilities
- **Threat Protection**: Input validation, SQL injection, XSS, CSRF protection

**Proportional NFR Discovery for Security**:
- **Explicit mention** (e.g., "secure", "authentication", "privacy") → Full security suite (+8 to +10)
- **User data handling** (e.g., "users", "profiles", "accounts") → Standard security NFRs (+6 to +8)
- **External exposure** (e.g., "API", "web", "public") → Basic security NFRs (+4 to +6)
- **Internal only** → Minimal security baseline (+2 to +4)

##### NFR Cycle 4: Reliability & Availability Requirements
**Derive reliability NFRs from business criticality analysis**:
- **Uptime Targets**: SLA commitments, planned vs unplanned downtime
- **Fault Tolerance**: Component failure handling, graceful degradation
- **Disaster Recovery**: Backup strategies, recovery time/point objectives
- **Health Monitoring**: System health checks, alerting, automated recovery
- **Data Integrity**: Consistency guarantees, corruption detection, repair mechanisms

##### NFR Cycle 5: Usability & Accessibility Requirements
**Extract user experience NFRs from interface and interaction requirements**:
- **Accessibility Standards**: WCAG 2.1 AA compliance, screen reader support, keyboard navigation
- **User Experience**: Task completion times, error rates, user satisfaction metrics
- **Interface Design**: Responsive design, mobile optimization, cross-browser compatibility
- **Localization**: Multi-language support, cultural adaptations, timezone handling
- **Help & Support**: Documentation, in-app guidance, error messaging clarity

##### NFR Cycle 6: Maintainability & Supportability Requirements
**Derive maintenance NFRs from system complexity and lifecycle needs**:
- **Code Quality**: Static analysis standards, complexity metrics, documentation coverage
- **Debugging Support**: Logging levels, diagnostic tools, performance profiling
- **Update Mechanisms**: Deployment automation, rollback capabilities, zero-downtime updates
- **Configuration Management**: Environment separation, feature toggles, A/B testing
- **Monitoring & Observability**: Application metrics, business KPIs, alert management

##### NFR Cycle 7: Compliance & Legal Requirements
**Identify regulatory NFRs from data handling and business operations**:
- **Data Protection Laws**: GDPR, CCPA, HIPAA data handling requirements
- **Industry Standards**: PCI DSS, SOX, ISO certifications, sector-specific regulations
- **Accessibility Laws**: ADA compliance, regional accessibility standards
- **Audit Requirements**: Record keeping, reporting capabilities, evidence preservation
- **International Compliance**: Cross-border data transfer, local regulation compliance

##### NFR Cycle 8: Operational & DevOps Requirements
**Extract operational NFRs from deployment and management needs**:
- **Deployment Automation**: CI/CD pipeline requirements, automated testing gates
- **Environment Management**: Development, staging, production isolation and promotion
- **Backup & Recovery**: Automated backup schedules, restoration procedures, data validation
- **Capacity Planning**: Resource monitoring, auto-scaling triggers, capacity alerts
- **Incident Management**: Error tracking, escalation procedures, post-mortem processes

##### NFR Cycle 9: Integration & Interoperability Requirements
**Derive integration NFRs from external system interactions**:
- **API Compatibility**: Versioning strategies, backward compatibility, deprecation policies
- **Data Exchange**: Format standards, transformation requirements, validation rules
- **Protocol Support**: REST, GraphQL, message queues, real-time communication
- **Service Dependencies**: External service SLAs, fallback strategies, circuit breakers
- **Standards Compliance**: Industry data formats, communication protocols, integration patterns

##### NFR Cycle 10: Business Continuity & Risk Requirements
**Identify business continuity NFRs from risk analysis**:
- **Business Impact Analysis**: Critical functions, maximum tolerable downtime, recovery priorities
- **Risk Mitigation**: Single points of failure, redundancy requirements, failover procedures
- **Data Loss Prevention**: Backup frequency, replication strategies, consistency guarantees
- **Emergency Procedures**: Manual overrides, emergency contacts, escalation procedures
- **Insurance & Compliance**: Risk coverage, regulatory reporting, audit trail preservation

##### NFR Cycle 11: Cross-Cutting & Emergent Requirements
**Analyze interactions between previous NFR cycles to discover emergent requirements**:
- **Performance vs Security Trade-offs**: Encryption overhead, authentication delays
- **Scalability vs Compliance Conflicts**: Data residency vs geographic scaling
- **Reliability vs Maintainability Balance**: Complexity of high-availability vs operational simplicity
- **Cost vs Performance Optimization**: Resource usage vs response time requirements
- **Usability vs Security Tensions**: Convenience vs security controls

##### NFR Cycle 12+: Adaptive Discovery & Validation
**Continue iterating until convergence criteria are met**:
- **Gap Analysis**: Compare derived NFRs against industry benchmarks and best practices
- **Stakeholder Validation**: Verify NFRs align with business expectations and constraints
- **Feasibility Assessment**: Ensure technical achievability within budget and timeline constraints
- **Priority Refinement**: Rank NFRs by business impact, technical risk, and implementation effort
- **Dependency Mapping**: Create detailed dependency matrix between functional and non-functional requirements
- **Convergence Check**: If <10% new NFRs discovered in this cycle compared to previous, proceed to Phase 6.5
- **Quality Gate**: Ensure >85% of functional requirements have derived NFRs before proceeding

**NFR Iteration Control**:
- Track discovery rate: (New NFRs in cycle / Total NFRs before cycle) × 100%
- Continue cycles until discovery rate <10% for 2 consecutive cycles
- Minimum 9 cycles to ensure thorough discovery
- Maximum 50 total NFR cycles to prevent infinite iteration
- Document rationale for each NFR linking back to originating functional requirements
- Target: All functional requirements have at least 3 relevant NFRs

Document in: `<worktree>/planning/phase-6-nfr-derivation.md`

---

#### Sub-Phase 6.5: Industry Baseline NFRs

**Target Confidence**: 82-88%

**Automatically include domain-appropriate baseline NFRs** that represent industry standards and reasonable expectations:

##### Domain-Specific Baseline NFRs

**For Web Applications:**
- **Security headers** (Content-Security-Policy, X-Frame-Options) → Score +6
- **Input validation** on all user inputs → Score +7
- **XSS and injection protection** → Score +7
- **Error handling** without exposing internals → Score +7
- **Basic request/response logging** → Score +6
- **Graceful degradation** for browser compatibility → Score +5
- **Session management** if users mentioned → Score +6

**For CLI Tools:**
- **--help documentation** → Score +7
- **Meaningful error messages** with actionable advice → Score +7
- **Proper exit codes** (0 for success, non-zero for errors) → Score +6
- **Signal handling** (SIGINT, SIGTERM) → Score +5
- **Progress indicators** for long operations → Score +5
- **Verbose/quiet modes** → Score +4
- **Config file support** if configuration mentioned → Score +5

**For APIs:**
- **HTTP status codes** properly used → Score +7
- **Structured error responses** → Score +7
- **Request validation** → Score +7
- **Rate limiting** for public APIs → Score +5
- **API versioning** strategy → Score +5
- **CORS handling** for web clients → Score +6
- **Request ID tracking** → Score +4

**For Data Processing:**
- **Data validation** before processing → Score +8
- **Error recovery** and retry logic → Score +6
- **Progress reporting** for batch operations → Score +5
- **Idempotency** for rerunnable operations → Score +6
- **Audit trail** of processing steps → Score +5
- **Data integrity checks** → Score +7

**For File-Based Systems:**
- **Atomic writes** to prevent corruption → Score +7
- **Backup before destructive operations** → Score +6
- **File locking** for concurrent access → Score +5
- **Temporary file cleanup** → Score +6
- **Path validation** and sanitization → Score +7

##### NFR Expansion Triggers

**Automatic NFR expansion based on implicit mentions:**

- **Mentions "users"** → Expand: Authentication NFRs (+6), Authorization NFRs (+6), Session management (+5), User data protection (+7)
- **Mentions "data" or "database"** → Expand: Data validation NFRs (+8), Backup/recovery NFRs (+6), Data integrity NFRs (+7), Migration support (+5)
- **Mentions "API" or "service"** → Expand: Error handling NFRs (+7), Versioning NFRs (+5), Documentation NFRs (+6), Rate limiting (+5)
- **Mentions "production" or "deploy"** → Expand: Monitoring NFRs (+6), Logging NFRs (+7), Health checks (+6), Configuration management (+5)
- **Mentions "team" or "collaboration"** → Expand: Code documentation (+6), Testing requirements (+7), Version control practices (+6), Development environment setup (+5)
- **Mentions "scale" or "growth"** → Expand: Performance optimization (+6), Caching strategy (+5), Resource limits (+6), Capacity planning (+5)
- **Has external dependencies** → Expand: Dependency management (+6), Version compatibility (+5), Fallback mechanisms (+5), Integration testing (+6)
- **Has persistence** → Expand: Backup strategy (+7), Migration paths (+6), Data consistency (+7), Recovery procedures (+6)

##### Baseline NFR Application Rules
1. **Always include** minimal baseline NFRs even without explicit mention
2. **Score adjustment** based on domain and context
3. **Never skip** entire categories - include with appropriate scoring
4. **Document rationale** for baseline NFR inclusion
5. **Allow override** if use case explicitly states otherwise

Document in: `<worktree>/planning/phase-6.5-baseline-nfrs.md`

---

#### Sub-Phase 7: Hidden Requirements Discovery

**Target Confidence**: 85-90%

**Uncover implicit and undeclared requirements** by systematically checking these common areas:

**Quality Gate for Hidden Requirements**:
Each "hidden" requirement must pass:
1. **Logical Necessity**: Is this required or reasonably expected for stated use cases?
2. **Industry Standard**: Is this a common expectation for this type of system?
3. **Minimal Approach**: Is this the simplest way to enable use cases?
4. **Score**: Apply graduated scoring system
5. **If score < -2**: Mark as "QUESTIONABLE ADDITION" with explanation

1. **Audit trail requirements**: Who changed what, when, and why tracking
2. **Data migration needs**: Existing data transformation and preservation
3. **Backward compatibility**: Legacy system integration and API versioning
4. **Internationalization**: Multi-language support, timezone handling, currency formatting
5. **Mobile responsiveness**: Touch interfaces, offline capabilities, app store requirements
6. **Administrative functions**: User management, system configuration, bulk operations
7. **Reporting and analytics**: Business intelligence, usage metrics, compliance reporting
8. **Integration hooks**: Webhook support, event publishing, third-party connectors
9. **Development and testing**: Mock services, test data generation, staging environments

Document in: `<worktree>/planning/phase-7-hidden-requirements.md`

---

#### Sub-Phase 8: Documentation Requirements

**Target Confidence**: 87-92%

##### Assess Documentation Needs:

**README.md** - Generate requirement if:
- Multiple installation steps (+6 score)
- Configuration options exist (+6 score)
- API/CLI interface present (+8 score)
- Team development implied (+6 score)
- Open source mentioned (+10 score)

**Minimal README Template Requirement**:
```markdown
# Project Name
## Installation
[Generated from install requirements]

## Usage
[Generated from functional requirements]

## Configuration
[Generated from config requirements]

## Dependencies
[Generated from dependency tree]
```

**Additional Documentation** - Consider if:
- API documentation (if external interface)
- Migration guide (if replacing system)
- Configuration reference (if many options)
- Troubleshooting guide (if complex setup)

##### Documentation Scoring:
- Explicitly requested: +10
- Multi-user system: +6
- Complex installation: +6
- Public/open source: +8
- No indication needed: 0
- Over-documentation: -3

**Quality Gate**:
- Is documentation necessary for users to succeed?
- What's the minimal sufficient documentation?
- Can we generate docs from code/config?

Document in: `<worktree>/planning/phase-8-documentation.md`

---

#### Sub-Phase 9: Lifecycle Requirements

**Target Confidence**: 90-94%

##### Installation Requirements Pattern:

**Deliberate Dependency Checking**:
```bash
# Requirement: Installation shall verify all dependencies
1. Check runtime (Node.js, Python, etc.)
   - Version compatibility
   - Required modules/packages

2. Check system tools
   - Required: List only essential tools
   - Optional: List enhanced-feature tools

3. Check data stores
   - Embedded options first (SQLite)
   - External only if required

4. Provide clear feedback:
   ✅ PostgreSQL 14+ found (optional)
   ⚠️ Redis optional - enhanced caching available
   ❌ Node.js 18+ required - please install
```

##### Installation Script Requirements:
- Check before install
- Offer to install missing dependencies
- Allow --skip-optional flag
- Provide --check-only mode
- Support unattended install
- Generate install report (JSONL format)

##### Setup & Configuration (if customization implied):
- Configuration file format (prefer JSON)
- Environment variables as override
- Sensible defaults that work out-of-box
- Configuration validation on startup
- **Score**: +6 if reasonable, -3 if complex

##### Data Migration (if existing data mentioned):
- Import formats (prefer JSONL, CSV)
- Data validation rules
- Incremental migration support
- Rollback capability
- Progress reporting (stdout)
- **Score**: +8 if necessary, -5 if over-built

##### CI/CD Pipeline (if team development implied):
- Test automation requirements
- Build process definition
- Deployment scripts (if needed)
- Rollback procedure
- **Score**: +6 if reasonable, -8 if excessive

**Quality Gate**:
- Are lifecycle requirements proportional to project complexity?
- Can installation be simpler?
- Is CI/CD actually needed or premature?

Document in: `<worktree>/planning/phase-9-lifecycle.md`

---

#### Sub-Phase 10: Consolidation & Deduplication

**Target Confidence**: 92-95%

**Organize and refine the complete requirements set**:

1. **Group related requirements** into logical modules and components
2. **Eliminate duplicate requirements** across different phases
3. **Resolve conflicting requirements** through priority analysis
4. **Standardize requirement language** and formatting consistency
5. **Assign unique identifiers** to each requirement for traceability
6. **Establish requirement priorities**: must-have, should-have, nice-to-have
7. **Create requirement traceability matrix** linking back to original use cases

Document in: `<worktree>/planning/phase-10-consolidation.md`

---

#### Sub-Phase 11: Requirement Necessity Validation & Pruning

**Target Confidence**: 94-96%

##### Scoring Process:
Review EVERY requirement against quality gates:

1. **Evidence Scoring** (Use scoring system):
   - Explicit in use case: +10 points
   - Strongly implied: +6-8 points
   - Weakly implied: +2-4 points
   - Pure conjecture: -5 to -10 points

2. **Complexity Scoring**:
   - Essential complexity: Keep
   - Accidental complexity: -2 to -5 points
   - Nice-to-have complexity: -1 to -3 points

3. **Dependency Cost**:
   - Each unnecessary dependency level: -2 points
   - Each required external service: -1 point
   - Each optional enhancement: 0 points

4. **Final Decision**:
   - Score ≥ 8: Include as REQUIRED
   - Score 5-7: Include as RECOMMENDED
   - Score 2-4: Include as SUGGESTED
   - Score 0-1: Mark as OPTIONAL
   - Score < 0: REMOVE or mark as "NOT RECOMMENDED"

##### Continuous Quality Monitoring:

**Tracking Metrics Throughout**:
- **Conjecture Count**: Requirements with no use case evidence
- **Complexity Creep**: Requirements adding unnecessary dependencies
- **Dependency Depth**: Maximum levels of transitive dependencies
- **Score Distribution**: How many requirements at each score level

**Warning Thresholds**:
- >20% requirements scoring <0 → Stop and review
- >5 dependency levels → Simplification needed
- >30% conjecture → Return to use cases
- Complexity > Value → Architectural review

##### Iteration Health Report:
```markdown
## Iteration Health Report
- Requirements Generated: [X]
- Evidence-Based (≥8): [Y] ([Y/X]%)
- Recommended (5-7): [Z] ([Z/X]%)
- Questionable (<0): [W] ([W/X]%)
- Average Score: [score]
- Max Dependency Depth: [levels]
- Architecture Level: [0-7]
- Recommendation: [Continue/Review/Simplify]
```

##### Generate Traceability Visualizations

**Mermaid Requirement Traceability Diagram** showing use case to requirement mappings

**Traceability Matrix Table** mapping use cases to functional/non-functional/capability requirements

**Requirement Dependencies Graph** showing critical path and parallel opportunities

Document in: `<worktree>/planning/phase-11-validation.md`

---

#### Sub-Phase 12: Final Validation & Quality Assurance

**Target Confidence**: 95-97%

**Ensure completeness and consistency of requirements**:

1. **Validate mapping** - Confirm every use case maps to specific requirements
2. **Check completeness** - Verify no functional gaps or missing user journeys
3. **Assess feasibility** - Ensure requirements are technically achievable within constraints
4. **Review dependencies** - Confirm all prerequisite requirements are identified
5. **Validate NFR alignment** - Ensure non-functional requirements support functional goals
6. **Test scenario coverage** - Verify requirements enable comprehensive testing strategies
7. **Stakeholder review readiness** - Confirm requirements are clear and unambiguous

Document in: `<worktree>/planning/phase-12-final-qa.md`

---

#### Sub-Phase 13: LLM-Optimized Implementation Specification Output

**Target Confidence**: 96-98%

Generate structured markdown specifications optimized for LLM feature-developer consumption:

```markdown
# Requirements Specification: [Module Name]

## Implementation Context for AI Agent
**Total Requirements**: [X] Functional, [Y] Non-Functional, [Z] Capability, [W] Technical
**Requirements by Priority**: [A] Must-Have (≥8), [B] Should-Have (6-7), [C] Could-Have (4-5)
**Minimal Architecture Level**: Level [0-7] - [Justification from use cases]
**Recommended Tech Stack**: [Inferred from architectural level and requirements]
**Development Timeline**: [X] days for MVP, [Y] days for full feature set

## Critical Path for Implementation
1. **REQ-T-001** → **REQ-T-002** → **REQ-F-001** → **REQ-F-003** (Foundation critical path)
2. **Parallel Track**: REQ-F-002, REQ-F-004 (Can be developed simultaneously)

## LLM Implementation Guidance
**Start Here**: Begin with REQ-T-001 [specify exact requirement]
**Testing Strategy**: Write tests for each requirement's acceptance criteria
**Architecture Decisions**: Defer technology choices to implementation unless specified
**Error Handling**: Include error cases for each functional requirement
**Validation Points**: Test each requirement before proceeding to dependent ones

## Risk & Complexity Assessment
- 🔴 **High Risk** (needs careful attention): [List specific requirements]
- 🟡 **Medium Risk** (may need clarification): [List requirements]
- 🟢 **Low Risk** (standard patterns): [List requirements]

## Functional Requirements
### REQ-F-001: [Specific Action] Capability
**Statement**: The system shall [specific action] [specific object] [specific conditions]
**Source Use Cases**: UC-001: "[Direct quote]" (Primary - Score: +10)
**Evidence Score**: [+10 to -10]
**Implementation Guidance**: [Simplest approach, primary flow, error handling]
**Acceptance Criteria**: [Specific testable criteria]
**Dependencies**: [Prerequisite requirements]

## Non-Functional Requirements
### REQ-N-001: [Performance/Quality Attribute] Specification
**Statement**: [Specific measurable requirement with thresholds]
**Derived From**: REQ-F-[X] via Phase 6 NFR Cycle [Y]
**Metrics & Thresholds**: [Specific measurable goals]

## Capability Requirements
### REQ-C-001: [Capability Type] Specification
**Capability**: [Data Persistence|Communication|Processing|Interface]
**Minimal Solution**: [Simplest approach that works]
**Technology Options**: [Simplest → Standard → Complex]
```

Document in: `<worktree>/planning/phase-13-implementation-specs.md`

---

#### Sub-Phase 14: Implementation Sequence Generation

**Target Confidence**: 97-99%

**Generate optimal build order for LLM feature developer**:

##### Dependency Resolution Analysis
1. **Create dependency graph** from all "Depends On" relationships
2. **Identify critical path** - longest dependency chain
3. **Find parallel work streams** - requirements with no shared dependencies
4. **Calculate implementation phases** based on dependencies and complexity

##### Risk-Optimized Ordering
1. **High-risk requirements first** - tackle uncertainty early
2. **Foundation before features** - technical requirements before functional
3. **Testable components early** - enable early validation
4. **Integration points identified** - plan for component connections

##### Implementation Sequence Output

**Phase 1: Foundation** (Days 1-2)
- Objective: Establish technical infrastructure
- Requirements in priority order with dependencies, risks, validation criteria

**Phase 2: Core Features** (Days 3-5)
- Objective: Implement primary functional requirements
- Parallel Stream A (Critical Path) and Parallel Stream B (Independent)

**Phase 3: Quality & Performance** (Days 6-7)
- Objective: Implement non-functional requirements

**Phase 4: Integration & Polish** (Days 8-9)
- Objective: Complete integration and optional features

**Critical Path Analysis**:
- Longest Dependency Chain: [X] days
- Bottleneck Requirements: [List]
- Parallel Opportunities: [List]

Document in: `<worktree>/planning/phase-14-implementation-sequence.md`

---

#### Sub-Phase 15: Test Requirements Generation

**Target Confidence**: 98-100%

**Generate comprehensive test specifications for each requirement**:

##### Test Strategy by Requirement Type

**Functional Requirements Testing**:
For each functional requirement, specify:
- Unit Tests (85% coverage target)
- Integration Tests
- Acceptance Tests (Directly from Use Cases)
- Test Data Requirements
- Mock/Stub Requirements

**Non-Functional Requirements Testing**:
- Load Tests
- Stress Tests
- Benchmark Tests
- Performance Test Tools specification
- Test Environment specification

**Integration Requirements Testing**:
- API Integration Tests
- End-to-End Tests
- Contract Tests

##### Test Execution Strategy

**Test Automation Requirements**:
- Unit Test Framework: [Jest/Mocha/pytest/etc based on tech stack]
- Integration Test Framework: [Supertest/TestContainers/etc]
- E2E Test Framework: [Playwright/Cypress/etc]
- Performance Test Framework: [k6/Artillery/etc]

**Test Environment Setup**:
- Local Development: All unit and integration tests runnable locally
- CI/CD Pipeline: Automated test execution on all commits
- Staging Environment: Full E2E and performance testing
- Production Monitoring: Continuous validation of NFRs

**Test Data Management**:
- Static Test Data: Committed to repository
- Dynamic Test Data: Generated for each test run
- Test Database: Isolated database for integration testing
- Cleanup Strategy: Automated cleanup after test execution

##### Test Implementation Guidance for LLM

1. **Write tests first** for TDD approach when possible
2. **Test requirement acceptance criteria** directly - each bullet becomes a test
3. **Use consistent naming** - test names should match requirement IDs
4. **Mock external dependencies** - keep tests isolated and fast
5. **Include negative tests** - test error conditions and edge cases
6. **Validate NFRs continuously** - performance and security tests in CI/CD
7. **Generate test reports** - link test results back to requirements for traceability

Document in: `<worktree>/planning/phase-15-test-specifications.md`

---

### 16. Delta Computation & Change Classification

Compute changes between baseline and target requirements:

```markdown
**DELTA ANALYSIS**:

echo "🔄 Computing delta analysis between baseline and target requirements..."

1. **Retrieve baseline context from Phase 1.5**:
   baseline_state = <GLOBAL_BASELINE_STATE>
   delta_mode = <GLOBAL_DELTA_MODE>
   baseline_content = <GLOBAL_BASELINE_CONTENT>
   baseline_requirements = <GLOBAL_BASELINE_REQUIREMENTS> (if POPULATED)
   use_case_delta = <GLOBAL_USE_CASE_DELTA> (if exists)

2. **Parse generated requirements**:
   target_requirements = parse_requirements(generated_requirements_content)
   target_count = count(target_requirements)

3. **Classify changes based on delta mode**:

   IF delta_mode == "FIRST_ITERATION":
     # Everything is new - simple classification
     FOR each req in target_requirements:
       classify req as ADDED

     delta_classification = {
       "ADDED": all_target_requirements,
       "MODIFIED": [],
       "REMOVED": [],
       "UNCHANGED": []
     }
     delta_summary = "First iteration: ${target_count} requirements generated (all new)"

   ELSE (delta_mode == "CHANGE_DETECTION"):
     # Complex case: compare baseline vs target using semantic similarity ≥80%
     added_requirements = []
     modified_requirements = []
     removed_requirements = []
     unchanged_requirements = []

     # Classify each baseline item
     FOR each baseline_req in baseline_requirements:
       target_match = find_best_match(baseline_req, target_requirements, threshold=0.80)

       IF target_match with identical content:
         classify as UNCHANGED
       ELIF target_match with different content:
         classify as MODIFIED
         compute_diff(baseline_req, target_match)
       ELSE:
         classify as REMOVED

     # Classify new target items
     FOR each target_req in target_requirements:
       IF NOT exists_in(baseline_requirements, threshold=0.80):
         classify as ADDED

     # Semantic matching for renames (80% threshold)
     FOR each removed_req in removed_requirements:
       FOR each added_req in added_requirements:
         IF semantic_similarity(removed_req, added_req) >= 0.80:
           reclassify both as MODIFIED (renamed)
           record_rename(removed_req.id, added_req.id)

     delta_summary = "Changes detected: +${count(added)} new, ~${count(modified)} modified, -${count(removed)} removed, =${count(unchanged)} unchanged"

4. **Generate delta file**:
   delta_file_path = "<worktree>/planning/requirements-delta.md"
   Write comprehensive delta analysis with A/M/R/U classification

5. **Store delta summary for documentation**:
   <GLOBAL_DELTA_SUMMARY> = delta_summary
   <GLOBAL_DELTA_CLASSIFICATION> = delta_classification

   echo "✅ Delta analysis complete: ${delta_summary}"
```

---

**END OF EXECUTION ACTIVITY (16 sub-phases complete)**

---

### 8. Quality Iteration Loop

**Continuous Improvement Mechanism**:

After completing execution (Activity 7), perform quality validation:

**Quality Validation Checklist**:
- [ ] All 16 phases executed sequentially
- [ ] All use cases mapped to requirements (100% coverage)
- [ ] All requirements scored using evidence-based system
- [ ] Requirements scoring <0 removed or justified
- [ ] NFR convergence criteria met (<10% discovery for 2 cycles)
- [ ] Use case discovery convergence met (<15% discovery rate)
- [ ] Architecture level justified with use case quotes
- [ ] Dependency tree validated for minimalism
- [ ] Traceability matrices generated
- [ ] Implementation sequence defined with critical path
- [ ] Test specifications complete for all requirements

**If Quality Validation Fails**:
- Identify specific gaps or quality issues
- Return to relevant execution sub-phase to address
- Re-validate after corrections
- Continue until all quality criteria pass

**If Quality Validation Passes**:
- Proceed to Activity 9: Documentation & Knowledge Capture

Document iteration results in: `<worktree>/planning/phase-1-quality-iteration.md`

---

### 9. Documentation & Knowledge Capture

**Generate Final Deliverables**:

##### Requirements Quality Report
Write comprehensive quality report to `<worktree>/planning/requirements-quality-report.md`:

```markdown
## Requirements Quality Report

### Statistics:
- **Total Requirements Generated**: [X]
- **Evidence-Based Requirements** (Score ≥8): [Y] ([Y/X]%)
- **Recommended Requirements** (Score 5-7): [Z] ([Z/X]%)
- **Optional Requirements** (Score 2-4): [W] ([W/X]%)
- **Rejected/Removed** (Score <0): [V] ([V/X]%)

### Architecture Assessment:
- **Minimum Viable Architecture**: Level [X] - [Description]
- **Use-Case Justified Architecture**: Level [Y] - [Description]
- **Over-Engineered If**: Level [Z] - [Warning]

### Requirements Needing User Validation:
## ASSUMED Requirements (Need Confirmation):
- REQ-F-[X]: [Description] - No use case evidence
- REQ-N-[Y]: [Description] - Complexity assumption

### Simplification Opportunities:
## Could Be Simpler:
- REQ-C-[X]: Database → Could use JSON files
- REQ-F-[Y]: API → Could use CLI
- REQ-N-[Z]: Real-time → Could use polling

### Technology Decisions Deferred:
## Capability Requirements Awaiting Technology Selection:
- Data Persistence: Options from files to database
- Communication: Options from stdout to API
- Processing: Options from batch to real-time

### Dependency Analysis:
- **Maximum Dependency Depth**: [N] levels
- **Total Unique Dependencies**: [Count]
- **Optional Dependencies**: [Count]
- **Required Dependencies**: [Count]

### Final Recommendations:
1. **Start with**: Level [X] architecture
2. **Implement first**: Requirements scoring ≥8
3. **Defer**: Technology-specific decisions
4. **Review with user**: All assumptions and scores <5
5. **Consider removing**: All requirements scoring <0
```

##### Return Concise Summary

Return summary to caller:

```markdown
# Requirements Generation Complete

## Summary
- **File Written**: <worktree>/planning/requirements.md
- **Total Requirements**: [X] (Functional: [Y], Non-Functional: [Z], Capability: [W])
- **Final Confidence**: [X%]
- **Phases Executed**: 16/16
- **Evidence-Based Requirements**: [X%] (Score ≥8)

## Requirements Distribution
- **REQUIRED** (Score ≥8): [X] requirements
- **RECOMMENDED** (Score 6-7): [Y] requirements
- **SUGGESTED** (Score 4-5): [Z] requirements
- **OPTIONAL** (Score 2-3): [W] requirements
- **REMOVED** (Score <0): [V] requirements

## Architecture Assessment
- **Minimum Viable Level**: Level [X] - [Description]
- **Recommended Level**: Level [Y] - [Description]
- **Total Complexity Score**: [Dependency levels + Architecture level]

## Quality Metrics
- **Evidence Coverage**: [X%] requirements directly from use cases
- **Traceability Complete**: [X%] requirements traced to source
- **Complexity Appropriateness**: [X%] requirements scored for simplicity
- **Dependency Efficiency**: [X] max dependency levels

## Key Insights
- [Major discovery 1]
- [Major discovery 2]
- [Pattern observation]
- [Simplification opportunity]

## Implementation Readiness
The complete requirements specification with evidence-based scoring and implementation guidance has been written to the planning directory, ready for architecture research and feature development.
```

---

## Core Principles & Scoring Systems

### Architectural Minimalism Principle

**Default Architecture Bias**: Start with the simplest possible solution
**Escalation Path**: Only add complexity when use cases explicitly demand it

#### Architecture Complexity Levels (Start at Level -1):
- **Level -1 - Pipeline/Stdout**: Command-line pipes, stdout/stdin, no persistence
- **Level 0 - Static/Memory**: In-memory only, no files needed
- **Level 1 - File-Based**: Local files (JSON, CSV, SQLite), single process
- **Level 2 - Stateless Script**: Standalone script/function, may read/write files
- **Level 3 - Serverless Function**: Cloud function, external state store
- **Level 4 - Single Server**: Persistent process, local state management
- **Level 5 - Multi-Service**: Multiple processes, queues, caches
- **Level 6 - Distributed System**: Clustering, replication, orchestration
- **Level 7 - Enterprise Platform**: HA, geo-distribution, complex infrastructure

**Golden Rule**: "As small as possible, but no smaller"
- Start at Level -1 (stdout), escalate ONLY when use cases require
- Prefer: stdout > memory > files > database > network > distributed

### Requirement Evidence Scoring System

#### Evidence-Based Scoring:
- **+10**: Explicitly stated in use case (direct quote available)
- **+9**: Necessarily implied for use case to function (logical requirement)
- **+8**: Strongly implied by use case context (would break without it)
- **+7**: Industry-standard expectation for this type of feature
- **+6**: Reasonably implied by use case context (standard expectation)
- **+5**: Common pattern for this use case type (industry norm)
- **+4**: Valuable extension that enhances use case value
- **+3**: Helpful addition that improves quality/maintainability
- **+2**: Nice-to-have that adds polish
- **+1**: Optional enhancement
- **0**: Neutral - neither required nor harmful
- **-1**: Marginal benefit, needs justification
- **-2**: Questionable addition without clear benefit
- **-3**: Adds complexity without strong justification
- **-4**: Likely over-engineering for stated needs
- **-5**: Contradicts simplicity principle
- **-6**: Enterprise feature for simple use case
- **-8**: Clear over-engineering
- **-10**: Pure gold-plating

#### Decision Thresholds:
- **Score ≥ 8**: REQUIRED - Core requirement
- **Score 6-7**: STRONGLY RECOMMENDED - Industry standard
- **Score 4-5**: RECOMMENDED - Should include
- **Score 2-3**: SUGGESTED - Consider including
- **Score 0-1**: OPTIONAL - May include if resources allow
- **Score -1 to -2**: QUESTIONABLE - Needs strong justification
- **Score < -2**: AVOID - Likely over-engineering

### Data Format Hierarchy (Prefer Simpler, Parseable)

#### Preferred Formats (in order):
1. **JSONL (JSON Lines)**: Best for streaming, append-only logs, data pipelines
2. **Markdown**: Best for human-readable docs, reports, configurations
3. **JSON**: Best for configuration, APIs, structured data exchange
4. **Plain Text**: Best for logs, simple outputs
5. **CSV/TSV**: Best for tabular data
6. **YAML**: Acceptable for configuration (though JSON preferred)
7. **Binary**: Only when necessary for performance

### Continuous Quality Gate System

Apply at EVERY iteration, phase, and requirement generation:

#### The Quality Gate Questions (Ask for EACH requirement):
1. **Evidence Check**: Is there use case evidence or reasonable implication?
2. **Necessity Check**: Is this required for the system to work?
3. **Complexity Check**: Is this the simplest sufficient approach?
4. **Dependency Check**: What does this requirement transitively require?
5. **Lifecycle Check**: What install/setup/migration does this imply?

#### Quality Gate Scoring (Apply Immediately):
- If Evidence Check fails → Score -5, mark "CONJECTURE"
- If Necessity Check fails → Score -3, mark "OPTIONAL"
- If Complexity Check fails → Score -2, mark "CONSIDER SIMPLER"
- If Dependencies excessive → Score -4, mark "HEAVYWEIGHT"
- If Lifecycle complex → Score -3, mark "OPERATIONAL BURDEN"

**Continuous Pruning**: Requirements scoring < 0 are immediately marked for review

### Iterative Discovery Engine Parameters

**Target Iterations**: Minimum 9 cycles, maximum 50 cycles
**Convergence Criteria**: Discovery rate < 10% for 2 consecutive iterations
**Quality Gates**: Each phase must achieve >85% completeness before proceeding
**Traceability**: Track requirement genealogy back to originating use cases and discovery methods

---

## GLOBAL END

**Execute AFTER all phases to ensure complete validation and cleanup**

### Requirements Validation

```markdown
1. LOAD ORIGINAL USE CASES:
   Review <prompt-arguments> use cases from Global Start
   Compare against generated requirements for use case coverage

2. EVIDENCE-BASED VALIDATION:
   For each requirement:
   - Trace back to specific use case
   - Validate evidence score (>= 0 for inclusion)
   - Confirm architectural minimalism level
   - Check quality gate compliance

3. REQUIREMENTS COVERAGE ANALYSIS:
   Create final validation matrix:
   | Use Case | Requirements | Coverage | Evidence Score | Arch Level |
   |----------|-------------|----------|----------------|------------|
   | UC001 | REQ-001, REQ-003 | 100% | +8 | -1 (minimal) |
   | UC002 | REQ-002, REQ-005 | 100% | +7 | 0 (KISS) |
```

### Global Quality Score Calculation

```markdown
REQUIREMENTS_QUALITY_SCORE = (
  (USE_CASE_COVERAGE_COMPLETENESS * 0.30) +     # All use cases have requirements
  (EVIDENCE_SCORE_QUALITY * 0.25) +             # Evidence-based derivation
  (ARCHITECTURAL_MINIMALISM * 0.20) +           # KISS/YAGNI compliance
  (QUALITY_GATE_ACHIEVEMENT * 0.15) +           # Phase gate compliance
  (TRACEABILITY_COMPLETENESS * 0.10)            # Requirement genealogy
)

MINIMUM_ACCEPTABLE_SCORE = 8.0/10.0

Quality Assessment:
- 9.5-10.0: Excellent - Ready for architecture definition
- 8.0-9.4: Good - Minor refinements may help
- 7.0-7.9: Acceptable - Some gaps remain
- Below 7.0: Requires iteration
```

### WORKTREE CONSOLIDATION

```markdown
# Universal pattern: ALWAYS merge back to parent worktree (worktree isolation)
echo "🧠 THINKING: Requirements generation complete - merging back to parent worktree"
echo "🧠 THINKING: Parent worktree (branch): <parent_worktree>"

# CRITICAL SAFETY CHECK - never delete if we're inside it
<current_location> = $(pwd)

IF "<worktree>" != "<current_location>" THEN:
  echo "✅ Safe to consolidate - not inside nested worktree"

  # Gather requirements generation metrics
  requirements_generated=$(grep -c "^### REQ-[0-9]" "${worktree}/planning/requirements.md" 2>/dev/null || echo "0")
  quality_score="${REQUIREMENTS_QUALITY_SCORE:-unknown}"
  evidence_score_avg=$(grep "Evidence:" "${worktree}/planning/requirements.md" 2>/dev/null | awk '{sum+=$NF; count++} END {printf "%.1f", sum/count}' || echo "unknown")

  # Construct detailed commit message preserving requirements context
  commit_msg="merge(requirements): Consolidate ${requirements_generated} generated requirements

Source: ${worktree_branch}
Generated: ${requirements_generated} requirements
Avg evidence score: ${evidence_score_avg}
Quality: ${quality_score}/10
Framework: Evidence-based requirements discovery (16-phase)

This merge includes comprehensive requirements analysis ready for architecture definition."

  # Use merge-worktree agent for consolidation with auto-discovery
  # Agent handles: commit, squash merge, cleanup with git atomicity
  # Merges FROM nested worktree TO parent worktree (universal isolation pattern)
  echo "🔧 Calling merge-worktree agent to consolidate to parent"
  ask merge-worktree "<worktree>" "" "${commit_msg}" "requirements-generator"

  # Check merge status from agent JSON output
  merge_status=$(echo "$LAST_AGENT_OUTPUT" | grep -oP '"status"\s*:\s*"\K[^"]+')

  if [ "$merge_status" = "success" ]; then
    # merge-worktree agent already printed compact summary
    # Add analysis-specific context
    echo "ANALYSIS: ${requirements_generated} requirements ready for architecture"
    echo ""
  elif [ "$merge_status" = "conflict" ]; then
    echo "⚠️ MERGE CONFLICTS DETECTED"
    echo "⚠️ Worktree preserved for manual conflict resolution"
    echo ""
    echo "Requirements generation details:"
    echo "- Worktree: ${worktree_name}"
    echo "- Branch: ${worktree_branch}"
    echo "- Requirements generated: ${requirements_generated}"
    echo ""
    echo "To resolve conflicts and consolidate:"
    echo "1. Review conflicts in worktree"
    echo "2. Resolve conflicts in affected files"
    echo "3. After resolution, run: ask merge-worktree '<worktree>' '' '\${commit_msg}' 'requirements-generator'"
    exit 1
  else
    echo "❌ MERGE FAILED - unexpected status: ${merge_status}"
    echo "Agent output:"
    echo "$LAST_AGENT_OUTPUT"
    echo ""
    echo "To consolidate manually:"
    echo "1. cd '<parent_worktree>'"
    echo "2. git merge '${worktree_branch}' --squash"
    echo "3. git commit -m 'merge: Consolidate requirements generation'"
    echo "4. git worktree remove '<worktree>' --force"
    echo "5. git branch -D '${worktree_branch}'"
    exit 1
  fi
ELSE:
  echo "❌ SAFETY ERROR: Currently inside nested worktree - cannot merge"
  echo "Current location: ${current_location}"
  echo "Nested worktree: <worktree>"
  exit 1
FI
```

### Return Summary

Return concise summary to caller:

```markdown
# Requirements Generation Complete

## Summary
- **File Written**: <worktree>/planning/requirements.md
- **Requirements Generated**: [count]
- **Quality Score**: [X%]
- **Evidence Score Average**: [X]
- **Architectural Level**: [Level]

## Requirements Categories
- Functional: [N] requirements
- Non-Functional: [N] requirements
- Integration: [N] requirements
- Security: [N] requirements
- Operational: [N] requirements

## Key Insights
- [Major discovery 1]
- [Major discovery 2]
- [Pattern observation]

## Next Phase Ready
The complete requirements analysis with [N] requirements has been written to the planning directory, ready for architecture definition in Phase 4.
```

---

Execute systematically, derive evidentially, score rigorously, document comprehensively.