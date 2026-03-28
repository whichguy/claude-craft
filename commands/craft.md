---
argument-hint: "[status|sync|add|publish] or [task description...]"
description: "Claude Craft - sync extensions and iterative quality-driven development"
allowed-tools: "all"
---

# /craft - Claude Craft

Dual-purpose entry point: extension sync management and iterative quality-driven development.

## Step 1: Route by First Argument

Given arguments: $ARGUMENTS

Check the first word of $ARGUMENTS:

1. If **no arguments** provided → go to **SYNC MODE** with action `status`
2. If the first token of `$ARGUMENTS` is `status` → go to **SYNC MODE** with action `status`
3. If the first token of `$ARGUMENTS` is `sync` → go to **SYNC MODE** with action `sync`
4. If the first token of `$ARGUMENTS` is `add` → go to **SYNC MODE** with action `add`
5. If the first token of `$ARGUMENTS` is `publish` → go to **SYNC MODE** with action `publish`
6. Otherwise → set **task** = entire $ARGUMENTS, go to **DEV MODE** (skip to "Quality Gate Philosophy" section below)

---

## SYNC MODE

Manage Claude Craft extension synchronization between the git repository and ~/.claude/.

### Execute Sync Action

**For `status` action** — run the status listing:
```bash
"$HOME/claude-craft/tools/sync-status.sh" status
```

**For `sync` action** — pull latest changes first, then sync:
```bash
git -C "$HOME/claude-craft" pull --ff-only origin main 2>/dev/null || true
"$HOME/claude-craft/tools/sync-status.sh" sync
```

**For `add` or `publish`** — run directly:
```bash
"$HOME/claude-craft/tools/sync-status.sh" <action>
```

### Present Results

The bash tool output is often collapsed in Claude Code's UI. You MUST re-render the full output as markdown text in your response so the user can actually see it.

- For **status**: Re-render every item grouped by type using checkmark/bullet/circle indicators for registered/local/available. Include per-type counts and the footer summary. Example format:

  **agents (31)**
  - ✓ code-refactor.md — Automated code refactoring...
  - ● gas-review.md — (local)
  - ○ gas-code-reviewer.md — Fast GAS syntax... (available)
  agents: 19 registered, 11 local-only, 1 available

  End with summary totals and sync suggestion if items are available.

- For **sync**: Re-render the sync output showing what was linked per type. Note that Claude Code restart may be needed for new commands/skills.
- For **add**: Re-render the numbered list of repo items not installed. Explain these can be installed with `/craft sync`.
- For **publish**: Re-render the numbered list of local-only items. Explain these could be copied to the repo and committed.

### Sync Options Footer

After presenting results, show:
```
Craft commands:
  /craft           Show all extensions with status
  /craft sync      Pull latest + sync extensions
  /craft add       Show available extensions to add
  /craft publish   Show local-only extensions
  /craft [task]    Start iterative development
```

### Error Handling

If the sync script is not found at `$HOME/claude-craft/tools/sync-status.sh`, suggest running:
```bash
"$HOME/claude-craft/install.sh"
```

**STOP here** — do not continue to the dev framework below.

---

## DEV MODE

The task to implement: **<task>** (set from $ARGUMENTS in Step 1)

---

## Quality Gate Philosophy: Two-Tier System

### Tier 1: Mandatory User Confirmation (Stages 1-3)

Foundation stages defining WHAT to build. User domain knowledge is irreplaceable. Errors cascade through all subsequent work.

**Interaction**: 3-question confirmation recap required before proceeding.

### Tier 2: Automated Quality Gates (Stages 4-5, Phase 2-3)

Execution stages refining HOW to build. LLM self-assesses using objective checklists.

**Scoring**:
- >=90% (6-7/7 items): Proceed automatically
- 70-89% (5/7 items): Iterate to improve
- <70% (<5/7 items): Escalate to user

### Tier 3: Pre-Implementation Gate (Phase 2->3)

23-item checklist. Binary: ALL must pass, ANY failure blocks.

### Escalation Overrides (even if >=90%)

- Conflicting requirements across confirmed stages
- Multiple high-risk assumptions without mitigation
- Novel/untested technologies in architecture
- Scope expansion vs. Stage 5 boundaries
- Resource needs exceed constraints
- User can always request manual review with "validate stage N"

---

## Global Start - Framework Initialization

### Claude-Specific Optimizations

**XML Tags**: `<use_cases>`, `<requirements>`, `<architecture>`, `<assumptions>`, `<effects_boundaries>`, `<task_definition>`, `<current_phase>`, `<confirmed_stages>`, `<gate_result>`, `<confidence_score>`. `<WT>` = worktree absolute path.

**Thinking Prompts**: Use `<thinking>` blocks before major decisions.

**Long Context**: 200K tokens = no summarization needed, continuous cross-validation across all stages, no external memory.

**State Management**: Each stage declares input state, processing, output state, transition logic.

---

### Workspace Setup

1. Store `original_location` (current working directory)
2. Call `create-worktree` subagent: "Create a worktree as [task-name-kebab-case] from [original_location] based on [current_branch_name]"
3. [WAIT for agent completion]
4. Capture: `<WT>` = worktree path, `worktree_branch` = branch name. If unsuccessful, stop and report error.

---

### Environment Discovery & Validation

**FATAL (blocks all work):**
- `create-worktree` agent available
- `merge-worktree` agent available
- `git` command available
- `npm` command available

**WARNING (proceed without):**
- `mcp_gas` MCP server

If any FATAL item missing: STOP, report to user, DO NOT proceed.

---

### Context Rehydration (Resume Check)

Check for `<WT>/planning/GUIDE.md`. If exists:
1. Read GUIDE.md: confirmed stages, current phase, decisions, existing files
2. Read all existing knowledge files in `<WT>/planning/*.md`
3. Determine session mode automatically (no user prompting)
4. Present: "Resuming craft session. Found existing work through Stage [X]. Continuing with [next step]."
5. Skip to appropriate section

If GUIDE.md doesn't exist: greenfield, proceed with directory initialization.

### Directory Structure

```
<WT>/
├── src/              # Implementation code
├── test/             # Test files
├── docs/             # Final delivery docs
└── planning/         # All planning (MOSTLY FLAT)
    ├── GUIDE.md      # State recorder
    ├── *.md          # Knowledge files (no prefix, timeless)
    ├── p1-*.md       # Phase 1 journals (p<N>- prefix, temporal)
    ├── p2*.md        # Phase 2 journals
    ├── tasks-pending/
    └── tasks-completed/
```

### GUIDE.md Creation

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/guide.md` and populate with project-specific content.

Key sections: The Story So Far, Current Session State (with mermaid workflow map), Progress Tracking (phases, stages, tasks, time), Phase/Stage Transition Log, Current State of Understanding, Knowledge Checkpoints (Stages 1-6), Decision History & Rationale, Material Changes handling, Key Documents Reference, File Manifest.

> **Directory Isolation**: All paths MUST use `<WT>` prefix. See rules in [Directory Isolation](#directory-isolation).

---

## Directory Isolation

**ABSOLUTE RULES - NO EXCEPTIONS:**

- NEVER use `cd`, `pushd`, `popd`
- ALWAYS prefix file paths with `<WT>`
- ALWAYS use `git -C "<WT>" [command]`
- ALL paths MUST be absolute, never relative

**Why:** Prevents directory corruption, maintains isolation, enables parallel ops, ensures correct worktree targeting.

---

## Material Changes: When to Jump Back

**Detect by asking:** Does feedback contradict a confirmed stage? Require re-architecting? Invalidate planning decisions? Require significant refactoring?

**Material** (require jump-back consideration): New actor types, different API paradigms, platform changes, real-time vs polling shifts.

**Non-Material** (continue forward): Tooltips, colors, logging additions, error message wording.

**When detected:** Present MATERIAL CHANGE DETECTED with affected stages, rework estimate, and 3 options (jump back / document for future / explain more). If jump-back chosen: update GUIDE.md, mark subsequent work needs-review, re-execute affected stage, re-confirm subsequent stages.

---

## Phase 1: Progressive Understanding Through Quality Gates

**Knowledge Files Created:** use-cases.md, requirements.md, architecture.md, tooling.md, assumptions.md, effects-boundaries.md, task-definition.md
**Journal Files Created:** p1-stage1-journal.md through p1-stage6-journal.md

Six stages building progressive understanding:
1. Use Cases - what users experience
2. Requirements - what quality means
3. Architecture - how this fits the landscape
4. Assumptions - what we think we know
5. Effects & Boundaries - ripple effects and limits
6. Synthesis - complete integrated understanding

---

## Stage Execution Pattern (Reference for Stages 1-6)

**Context Grounding:** If uncertain, reference GUIDE.md -> "How to Progress Through This Journey"

**Research Modes:**
- **Serial**: Topics have dependencies
- **Parallel**: Independent topics - launch multiple WebSearch/Grep/Read in single message

**For each stage:**

1. **Position** - Stage X of 6, dependencies, purpose
2. **Explore** - Stage-specific questions and research
3. **Document** - Knowledge file + journal file with reasoning, confidence levels, open questions
4. **Present and Confirm** - Present to user, ask quality gate question, [WAIT]
5. **Check Material Changes** - Does feedback contradict earlier confirmed stages?
6. **Process Response**:
   - Confirmed -> document, update GUIDE.md, add to stages_confirmed, move to next
   - Feedback -> incorporate, update docs, re-present, iterate until confirmed

---

## GUIDE.md Update Protocol

On stage confirmation, update these sections:
- **"The Story So Far"**: Add "Stage N [verb]: [1-2 sentence insight]"
- **"Knowledge Checkpoints"**: Fill timestamp, core insight, surprises, user clarifications
- **"Decision History"**: Add key decisions with reasoning
- **"Current State"**: Mark complete, update open questions

For Phase 2/3/4: Update "Current Session State" and add transition log entries.

---

## Journal File Pattern

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/journal.md` and populate with stage-specific content.

CREATE at stage START, UPDATE DURING exploration, FINALIZE at stage END.

**Naming**: `p1-stage[N]-journal.md` | `p2-planning-journal.md` | `p2b-test-design-journal.md` | `p2c-infra-planning-journal.md` | `p2d-task-decomp-journal.md` | `p4-reflection-journal.md`

---

### Stage 1: Epic Understanding & Core Use Cases

**Input:** User's epic/task description, GUIDE.md (if resuming)
**Output:** use-cases.md, p1-stage-1-disambiguation.md, p1-stage-1-deep-discovery.md, p1-stage-1-research.md, p1-stage-1-constraints.md, p1-stage1-journal.md, GUIDE.md updated

**Rehydrate:** If use-cases.md exists, read and build upon it.

**Position (Stage 1 of 6 - Foundation):** Transforming abstract goals into concrete user stories. Foundation for everything.

---

#### Step 1: Disambiguation & Terminology Clarification

Analyze epic description for: acronyms, domain terms, implied relationships, scope boundaries, technical terms.

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/stage1-disambiguation.md` and populate.

Write to `<WT>/planning/p1-stage-1-disambiguation.md`.

Present to user: terminology interpretation, key relationships, scope understanding, assumptions.

**Quality Gate:** "Have I understood your terminology correctly?"

Loop until confirmed, then proceed to Deep System Discovery.

---

#### Step 1.5: Deep System Discovery Loop

Systematically discover all referenced systems, libraries, repositories, and services through actual source code analysis and iterative discovery.

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/stage1-deep-discovery.md` and populate.

Write to `<WT>/planning/p1-stage-1-deep-discovery.md`.

##### Phase A: System Identification

Scan all sources for system references:
1. Disambiguation document (entity relationships, scope boundaries)
2. Epic description (explicit/implicit technology references)
3. Existing codebase (`rg` for imports, service refs, URLs)
4. User's environment (ask about existing systems)

Categorize: External Systems/Services | Libraries/Frameworks | Local Repositories | MCP Servers

##### Phase B: Key Questions Framework

For each discovered system, generate questions across categories:
- **External Systems**: Purpose, integration requirements, constraints, versions, patterns
- **Libraries**: Core functionality, compatibility, quality/maintenance, alternatives
- **Local Repos**: Architecture, integration points, reusability, ownership
- **MCP Servers**: Access/capabilities, setup, discoverability

##### Phase C: Parallel Discovery Execution

Launch simultaneously: WebSearch for external services, package registry checks for libraries, `git clone` + source analysis for repos, MCP server exploration.

For repos: clone to `/tmp/discovery-[name]`, analyze with `tree`, `rg`, read key files.

##### Phase D: Findings Consolidation

For each system: Purpose, Key Capabilities, Integration Patterns, Constraints, Risks, Dependencies, Code Patterns, Documentation References, Open Questions.

##### Phase E: Loop Decision Point

**Continue iterating if:** New systems discovered in source code | Integration dependencies found | Code patterns need deeper analysis | MCP revealed new leads | Significant knowledge gaps remain | Critical research questions unanswered.

**Stop if:** No significant triggers remain.

**Safeguard:** Max 5 iterations. After 2: consider narrowing. After 3: escalate unknowns. After 5: MUST proceed, document remaining gaps as Stage 4 assumptions.

Present discovery summary to user. Loop until confirmed.

---

#### Step 3: Initial Research & Technical Context Discovery

Lighter than before since Step 1.5 handled deep discovery. Synthesize high-level technical context.

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/stage1-research.md` and populate.

**5 parallel research tasks:**
1. **Dependency Discovery**: Search codebase, identify libraries, research versions/compatibility
2. **External Service Mapping**: SaaS services, capabilities, auth, rate limits, pricing
3. **Current Implementation Conflicts**: Existing code conflicts, refactoring needs, migration considerations
4. **Actor & Role Analysis**: Human actors (responsibilities, permissions), System actors (roles, interfaces), External actors (contracts, dependencies)
5. **Implied Requirements**: Security, Performance, Scalability, Compliance, Reliability

Write to `<WT>/planning/p1-stage-1-research.md`. Present summary. Loop until confirmed.

---

#### Step 4: Constraint Detection & Conflict Resolution

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/stage1-constraints.md` and populate.

Three-pass analysis:
- **Pass 1**: Requirements vs. Implementation (codebase search)
- **Pass 2**: Service Constraints vs. Requirements (service docs)
- **Pass 3**: Performance vs. Functionality (processing estimates)

Also check: Security vs. Usability, Scalability vs. Simplicity, Compliance vs. Functionality, Time/Resource constraints.

Write to `<WT>/planning/p1-stage-1-constraints.md`. Present each contradiction with resolution options. Get user decision for each. Loop until all resolved.

---

#### Step 5: Use Case Extraction & Documentation

Adopt user perspective - goals and pain points, not implementation.

For each use case ask: Trigger? Mental Model? Success Indicator?

**Extract in order:**
1. **Primary user journey** - canonical happy path (trigger, steps, information, completion, value)
2. **Alternative flows** - different paths, shortcuts, conditional branches
3. **Exception flows** - failures at each step, recovery options, prevention

**Tooling opportunities:** Scan for API integrations, browser workflows, file operations, specialized tools. Document for Stage 3 research.

**Inferred use cases** - systematically discover implied functionality:
1. UI Patterns (sort, filter, search, pagination, bulk ops)
2. API/Auth (authentication, authorization, rate limiting, versioning, API lifecycle)
3. Server Architecture (immediate vs scalable, user count considerations)
4. UI Styling (minimal vs rich, technical level, timeline)
5. Feature Completeness (CRUD, history/audit, export/import, notifications, help, accessibility)
6. Actor-Specific Interfaces (role-based views, admin capabilities, API consumers, cross-actor workflows)
7. Interface Consistency (unified vs separate, API-first, mobile parity)

---

#### Step 6: Use Case Research & Expansion

**5 parallel research tasks:**
1. **Related Use Cases**: Review actors and relationships, search codebase, consider data lifecycle
2. **Interaction Patterns**: Dependencies, conflicts, composition, concurrency, shared sub-flows
3. **Anti-Cases**: Security violations, data integrity, business rules, resource abuse, misuse patterns
4. **External Research**: Similar systems, domain standards, pain points
5. **Secondary/Third Order Expectations**:
   - **Secondary** (immediate): UI elements, UI behaviors, system calls, subsequent behaviors (notifications, audit, cache invalidation)
   - **Third order** (delayed): Scheduled activities, async events, background processing, time-based triggers

**Use Case Research Quality Gate** - Completeness Checklist:
1. Use case coverage (primary, related, anti-cases, edge cases)
2. Interaction patterns (UI/UX, system, data, timing)
3. Domain patterns researched
4. Completeness validated (all actors, access paths, error handling)

**Loop**: If gaps AND iteration_count < 5, document targeted questions, execute focused research, re-evaluate. After 5: document remaining as assumptions, proceed.

---

#### Use Case Documentation

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/stage1-use-cases.md` and populate.

Write to `<WT>/planning/use-cases.md`.

Each use case MUST include: Actor Profile & Interface, Entry Point & Access Path (with MANDATORY Access Journey Illustration), Access Requirements, User Journey Context, Runtime Lifecycle, Trigger, Main/Alternative/Exception Flows, Exit Points, API Interaction Lifecycle (for API use cases).

Create journal using template at `/Users/jameswiese/claude-craft/templates/craft/journal.md`.

**MANDATORY USER CONFIRMATION GATE:**

Present comprehensive recap:
- Primary Use Cases with descriptions
- Alternative Flows & Variations
- Anti-Cases
- Key Interactions & Dependencies
- Scope Boundaries (In/Out/Deferred)
- User Value Proposition
- Disambiguation & Terminology
- Research Findings
- Uncertainties Resolved

**3 Confirmation Questions:**
1. Do these use cases accurately capture what you want to build?
2. Are there any missing user journeys or workflows?
3. Is the scope boundary correct?

**STOP: Do not proceed to Stage 2 until user explicitly confirms.**

Update GUIDE.md per protocol. WAIT for explicit confirmation.

---

### Stage 2: Functional and Non-Functional Requirements

**Input:** use-cases.md (Stage 1), GUIDE.md
**Output:** requirements.md, p1-stage2-journal.md, GUIDE.md updated

**Rehydrate:** If requirements.md exists, read and build upon it.

**Position (Stage 2 of 6):** Building on use cases. NFRs are invisible forces shaping solutions. 10ms vs 100ms changes architecture.

**Explore each dimension:**
- **Performance**: Response times, data volume, user-facing latency
- **Security**: Data protection, access control, input validation, compliance
- **Reliability**: Uptime, error rates, idempotency, recovery
- **Maintainability**: Code quality, documentation, testing, readability
- **Scalability**: Growth trajectory, resource constraints, optimization timing

**Tooling for quality validation:** For each NFR, identify what needs automated validation. Document tooling needs (HIGH/MEDIUM/LOW priority) for Stage 3 discovery.

#### NFR Research

**4 parallel research tasks:**
1. **Quality Attribute Checklist** (8 categories: Performance, Scalability, Reliability, Security, Usability, Maintainability, Portability, Compatibility) - research each with thresholds, targets, industry benchmarks
2. **Use Case Implications** - derive NFRs from each use case and anti-case
3. **Domain-Specific Requirements** - industry standards, competitor requirements, regulations, failure modes
4. **Requirement Gaps** - missing quantitative targets, unclear priorities, undefined terms, conflicts

**NFR Research Quality Gate:** All 8 categories explored with clear thresholds? Trade-offs understood? Industry standards researched?
---

### Stage 2: Requirements Research & Validation (continued)

**Quality Gate Checklist:**

1. **NFRs Specific & Measurable** — all 8 quality attributes researched (Performance, Scalability, Security, Reliability, Compliance, Usability, Maintainability, Operational)
2. **Functional Requirements Clear** — all use cases mapped to FRs; testable, not vague; dependencies identified; priority assigned (must/should/nice-to-have)
3. **Measurability Defined** — metrics, measurement methods, realistic thresholds, validation strategy per NFR
4. **Technical Constraints Understood** — system constraints, integration requirements, compliance, compatibility

**Research Iteration Decision:**

- **PROCEED** to Stage 3 IF: all 8 attributes covered, thresholds specific/measurable, trade-offs understood, measurement approaches defined
- **ITERATE** IF: critical NFRs vague, categories missing, thresholds unresearched, conflicting requirements, iteration < 5

**Loop Logic:** If gaps AND iteration_count < 5: document targeted questions, research gaps only (not all 8), consolidate, re-evaluate. If iteration >= 5: document gaps as "Assumptions to Validate", proceed with best understanding.

**Document requirements (when gate passes):**

Update `<WT>/planning/requirements.md`:

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/stage2-requirements.md` and populate with project-specific content.

**Present to user** with summary of:
- FR count and key FRs derived from use cases
- NFR counts by category with specific metrics
- Research findings (industry standards, similar systems, compliance)
- Requirements traceability (use cases -> FRs, anti-cases -> NFRs)
- Gaps requiring user input (with questions, impact, default assumptions)

**Confirmation Loop:**
- User identifies missing requirements -> add/modify, update files, re-present
- User provides gap answers -> move from gaps to requirement category
- User confirms -> mark complete, update GUIDE.md checkpoints, proceed

**Document journal** to `<WT>/planning/p1-stage2-journal.md`:
Follow standard Journal File Pattern. Create at stage START, update DURING, finalize at END.

---

**MANDATORY USER CONFIRMATION GATE**

Present comprehensive Stage 2 recap:
- FR summary (total, must/should/nice-to-have counts, top 5-7 critical FRs)
- NFR by category with specific thresholds (Performance, Security, Reliability, Scalability, Usability, Maintainability, Operational)
- Requirements traceability (UC -> FR, AC -> NFR)
- Research findings that informed requirements
- Priority matrix
- Gaps & assumptions

**STOP: Do not proceed to Stage 3 until user explicitly confirms.**

-> Follow Stage Execution Pattern for confirmation/feedback
-> Update GUIDE.md per standard protocol
-> If requirements significantly affect Stage 1, may need to revert and update use cases

**Cross-Validation Check (Advisory):**
- Every primary use case has corresponding FRs?
- Every alternative flow addressed?
- Every error/exception has reliability/security requirement?
- Advisory only -- does not block confirmation

**Reflect:** Did we identify all quality attributes? Are requirements measurable/testable? What trade-offs will we face? Confidence level?

---

### Stage 3: Architectural Research & Context

**Input:** `use-cases.md`, `requirements.md`, `GUIDE.md`
**Output:** `architecture.md`, `tooling.md`, `p1-stage3-journal.md`, `GUIDE.md` (updated)

**Rehydrate:** If architecture.md/tooling.md exist, read them; build upon what exists.

> **Directory Isolation**: All paths MUST use `<WT>` prefix. See [Directory Isolation](#directory-isolation).

**Position (Stage 3 of 6):** Building on validated use cases + quality constraints. Think like an archaeologist -- discover what exists before designing what's new.

**ARCHITECTURE IS DISCOVERY AND DECISIONS, NOT IMPLEMENTATION:**
- DO: Research tech options, score/compare alternatives, grep/ripgrep existing patterns, read files for integration points, document decisions, identify tooling needs
- DO NOT: Write code in `<WT>/src/`, install packages, create config files, implement integrations, set up dev environment
- Exception: Stage 4+ may run time-boxed experiments with mandatory cleanup

**Discovery Activities:**

1. **Systems landscape** -- existing systems, contracts, APIs, databases, failure modes
2. **Codebase patterns** (via grep/ripgrep) -- similar functionality, integration patterns, error handling, testing approaches
3. **File reading** -- architectural patterns, similar implementations, configuration, integration points

**Technology Research:**

For each significant technology decision:
1. Identify key questions (capabilities, constraints, team familiarity, maintenance)
2. Research options (strengths, limitations, maturity, ecosystem)
3. Make reasonable assumptions with explicit confidence levels (HIGH/MEDIUM/LOW)
4. Compare trade-offs (performance vs simplicity, flexibility vs convention, cutting-edge vs proven)

**Technology Gap Analysis:**

Review Stage 1 use cases + Stage 2 requirements. For each use case determine: pre-decided technologies, gaps, complexity level.

**Philosophy: Prefer Small, Standalone, Stateless** -- but let use cases determine extent.

---

**RESEARCH LOOP (Max 5 iterations):**

**Step 0: Discover Forums** -- parallel WebSearch to find active communities for your domain (Reddit, Discourse, Stack Overflow, specialized forums). Consolidate top 3-5.

**Step 1: Parallel Technology Research** per gap:
1. **GitHub Research** -- stars, activity, issues, dependencies, size, TypeScript support
2. **Forum Research** -- real-world pain points, alternatives, trending tech, warnings
3. **NPM/Package Research** -- package details, dependencies
4. **Scoring Framework** (0-10 per dimension):
   - **Quality** (40%): Maturity, Documentation, Test Coverage, Maintenance, Community
   - **Trending** (30%): Stars growth, Download trends, Recent mentions, Adoption, Momentum
   - **Philosophy** (30%): Size, Dependencies, Statefulness, Complexity
   - **Total = (Quality x 0.4) + (Trending x 0.3) + (Philosophy x 0.3)**

**Step 2: Consolidate** -- common recommendations, conflicting opinions, consensus, warnings. Score and rank all options.

**Step 3: Research Quality Gate:**
- 3+ viable options per gap? Trade-offs clear? Scoring data sufficient? Winner identified?
- Performance, integration, community, production readiness, license, bundle size checked?
- Gotchas identified? Breaking changes noted? Migration paths understood?
- Confidence >= HIGH for architecture-affecting decisions, >= MEDIUM for reversible ones?

**Step 4: Iteration Decision:**
- **PROCEED** IF: critical questions answered, sufficient confidence, top options clear
- **ITERATE** IF: critical questions remain, new gaps found, insufficient data, confidence too low
- At iteration >= 5: document remaining gaps, mark for early validation, proceed

---

**Define Architectural Requirements (Necessary but Sufficient):**

**1. UI Architecture** (if needed):
- Evaluate: need? type? users? interactions?
- Prefer trending modern frameworks (shadcn/ui, Tailwind, Next.js/Nuxt/SvelteKit)
- Document: framework + components + styling + state, with rationale

**2. Service Architecture:**
- Evaluate: need backend? sync/async? stateless/stateful? monolith/microservices?
- Document: pattern + framework + processing + state, with rationale

**3. API Architecture** (if exposing APIs):
- Evaluate: consumers? style? auth? rate limiting?
- Document: style + contracts + auth + versioning + docs, with rationale

**4. Data Storage Architecture:**

Most developers reach for databases too quickly. Start simple, add complexity only when required:

| Level | Type | Concurrency | When to Use |
|-------|------|-------------|-------------|
| 1 | Stateless | N/A | Pure computation, API proxy, transformations |
| 2 | Client-side | Minimal | Browser/session/IndexedDB storage |
| 3 | PaaS storage | Platform-managed | GAS PropertiesService, Cloudflare KV, etc. |
| 4 | Files | File-locking | JSON/CSV, local filesystem |
| 5 | In-memory | Process-level | Server variables, caching, session stores |
| 6 | Embedded DB | SQLite WAL | SQLite, LevelDB (single-server) |
| 7 | Managed cache | Distributed locking | Redis, Memcached |
| 8 | Managed DB | ACID transactions | PostgreSQL, MongoDB, DynamoDB |
| 9 | Specialized | High | Elasticsearch, graph DBs, time-series |

- Start at Level 1, move down only when hitting clear limitations
- Document why each simpler option is insufficient
- Include concurrency approach and conflict resolution strategy
- Document: primary technology, rationale, simpler options rejected, concurrency approach, scale estimate, upgrade trigger

**5. Quality Testing Architecture (Runtime Determination):**
- Discover existing patterns (test files, frameworks, dependencies, config)
- Analyze use case testing needs (critical path / standard / low-risk)
- Define approach based on discoveries (align with existing frameworks)
- Include: test categories with coverage targets, test data strategy, quality gates in CI/CD, explicit limitations, minimal quality bar, dependencies/setup

**Architecture Decision Matrix:**

| Layer | Required? | Approach | Necessary Because | Sufficient Because | Status |
|-------|-----------|----------|-------------------|--------------------|--------|
| UI | Yes/No | ... | ... | ... | Satisfied/Needs investigation |
| Service | ... | ... | ... | ... | ... |
| API | ... | ... | ... | ... | ... |
| Data | ... | ... | ... | ... | ... |
| Quality Testing | Yes | ... | ... | ... | ... |

**Mermaid Diagrams:**

Include diagrams in architecture.md for visual documentation. Required: System Architecture Overview, Data Flow Sequence, Auth Flow (if applicable), ER Diagram. Optional: State, Class, Deployment, Component diagrams. Keep focused, use subgraphs, test rendering.

**Tooling Discovery:**

1. **MCP Servers** -- capabilities, setup, integration, confidence
2. **Subagents** -- matching tasks, parallel execution opportunities
3. **External APIs** -- services, auth, rate limits, reliability
4. **Integration Patterns** -- direct API vs abstraction, sync vs async

Document all to `<WT>/planning/tooling.md`.

**Platform UI Integration Research** (if platform-specific deployment detected):

Detect platform from prior stages (scan for: "Google Apps Script", "Salesforce", "ServiceNow", "Slack", "VSCode extension", etc.). Check `~/.claude/references/` for existing knowledge files.

Launch 5 parallel WebSearch queries:
1. **Entry Point Discovery** -- "[platform] [container-type] entry point menu navigation integration [year]"
2. **Lifecycle & Init** -- "[platform] lifecycle hooks initialization triggers startup [year]"
3. **UI Container APIs** -- "[platform] [container-type] API reference implementation [year]"
4. **Constraints** -- "[platform] execution limits security policies sandbox restrictions [year]"
5. **Best Practices** -- "[platform] [container-type] production patterns best practices [year]"

Document in architecture.md under "Platform UI Integration Architecture":
- Platform context (platform, deployment mode, host app, confidence)
- Entry point strategy (discovery mechanism, init pattern, launch pattern)
- UI container patterns (primary/secondary containers, creation, sizing, styling)
- Lifecycle & triggers (user-initiated, system events, data events)
- Constraints (execution limits, CSP/CORS/sandbox, auth scopes)
- Standard implementation patterns (entry point, container creation, error handling templates)
- Platform APIs available
- Test strategy for platform integration
- Common pitfalls & anti-patterns from research

**Architecture.md Index Requirement:**

Maintain document index at top with Section, Line Start, Char Offset Start/End for efficient navigation.

**Document to architecture.md:**

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/stage3-architecture.md` and populate with project-specific content.

---

**CRITICAL ARCHITECTURE QUALITY GATE (before user confirmation):**

1. Verify architecture supports ALL use cases from Stage 1
2. Verify architecture satisfies ALL requirements from Stage 2
3. IF GAPS: revise architecture, revise requirements, or document as future enhancement (requires user agreement). DO NOT PROCEED until covered.
4. IF NO GAPS: finalize and present

**MANDATORY USER CONFIRMATION GATE:**

Present architecture summary with:
- Core technologies, integration approach, system architecture, key dependencies, deployment strategy
- Verification that all use cases/requirements are covered
- Scoring results: Quality/Trending/Philosophy

**STOP: Do not proceed to Stage 4 until user explicitly confirms.**

-> If architectural constraints change use cases/requirements, may revert to Stage 1/2
-> If better tooling found, update tooling.md (learning, not failure)

**Cross-Validation (Advisory):** Architecture supports all primary use cases? Technology satisfies all NFRs? Integration patterns address all dependencies?

**Reflect:** Does architecture truly support all use cases? Integration risks? Confidence in technology choices? Backup plan for showstoppers?

---

### Stage 4: Assumptions & Risk Assessment

**Input:** `use-cases.md`, `requirements.md`, `architecture.md`, `tooling.md`, `GUIDE.md`
**Output:** `assumptions.md`, `p1-stage4-journal.md`, `GUIDE.md` (updated)

**Rehydrate:** If assumptions.md exists, read and build upon it.

**Position (Stage 4 of 6):** Think like a skeptic. Question everything taken for granted.

**Review each prior stage for hidden assumptions:**

- **Stage 1 (use cases):** User behavior assumptions -- do users actually work this way? Is assumed information available?
- **Stage 2 (NFRs):** Constraint assumptions -- is "fast enough" achievable? Is threat model realistic?
- **Stage 3 (architecture):** Technical assumptions -- does existing system behave as expected? Are dependencies stable? Are docs current?
- **Stage 3 (tooling):** Tool assumptions -- are MCP servers functional? Do APIs work as documented? Better options missed?

**Validate each assumption:**
- Is it reasonable? What evidence supports it? What would invalidate it? How risky if wrong?

**Classification:**
- **SOLID**: Well-supported by evidence, low risk (verified through testing/docs/experience)
- **WORKING**: Reasonable but should be validated, medium risk (based on docs, not verified)
- **RISKY**: Needs confirmation, high risk if wrong (no evidence or conflicting info)

**Document to `<WT>/planning/assumptions.md`:**
- All assumptions with classification + evidence + risk assessment + mitigation

**Key Questions Before Assessment:**

1. What did I assume about technology capabilities, existing systems, team/environment?
2. What evidence supports each? (Official docs = SOLID, reasonable inference = WORKING, guessing = RISKY)
3. What happens if wrong? (Minor adjustment = acceptable, significant rework = validate, architecture invalidated = must validate)

**Quality Gate: Assumption Assessment**

Checklist (7 items):
- [ ] All assumptions identified and documented
- [ ] Each classified with clear rationale
- [ ] Evidence provided for SOLID/WORKING
- [ ] Risk assessment for each RISKY
- [ ] Mitigation strategies for high-risk
- [ ] No hidden assumptions remaining
- [ ] RISKY flagged for Stage 4+ validation

**Score >= 90%:** Proceed automatically (no user confirmation needed). If no RISKY or user accepted risks -> Stage 5. If RISKY needs validation -> Stage 4+.
**Score 70-89%:** Iterate (max 3 iterations). Review unchecked items, improve, re-evaluate.
**Score <70% or Ambiguous:** Escalate to user with current state, missing items, questions.

-> If assumptions invalidated, may cascade back to Stage 1/2/3 depending on what the assumption supports

---

### Stage 4+: Experimental Validation Loop (Optional)

**Input:** `assumptions.md` (RISKY items), `architecture.md`, `tooling.md`, all previous outputs, `GUIDE.md`
**Output:** `experiments.md`, `p1-stage4plus-journal.md`, `/tmp/craft-experiments/` (throw-away, deleted after), `GUIDE.md` (updated)

**When to use:** RISKY assumptions need validation, uncertain technical capabilities, need empirical comparison, unclear performance/compatibility/API behavior.
**Skip if:** All SOLID/WORKING, proven technologies, deep team experience.

**Purpose:** Quick, time-boxed throw-away experiments to de-risk. Not prototypes, not implementation, not comprehensive. 15-60 min per experiment.

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/stage4-experiments.md` and populate with project-specific content.

**5-Step Iterative Loop:**

**Step 1: Identify Key Questions (Question Queue)**
- Sources: RISKY assumptions, architecture uncertainties, integration unknowns, performance questions, compatibility concerns
- Per question: source, why it matters, uncertainty type, risk if wrong, current/target confidence, priority (CRITICAL/HIGH/MEDIUM/LOW)
- Select top 3-5 CRITICAL/HIGH for immediate experimentation

**Step 2: Design Experiment Plans (before executing any)**
- Per experiment: hypothesis, success/fail/inconclusive criteria, time limit (15-60 min), environment setup in `/tmp/craft-experiments/[timestamp]-[description]/`, execution steps, expected findings, decision impact
- Review all plans together for dependencies, shared setup, redundancy

**Step 3: Execute Experiments (Sequential)**
1. Create isolated workspace in `/tmp/craft-experiments/`
2. Document start in journal
3. Execute steps, enforce time limit
4. Capture findings: answer, evidence, confidence change, new questions, architecture implications
5. **Delete experiment workspace** -- throw-away code only
6. Update experiments.md (Plans -> Results)
7. Learn and adapt queue

**Step 4: Aggregate Learnings**
- Synthesis: validated/invalidated assumptions, new discoveries, architecture implications, confidence updates table, remaining uncertainties, time investment

**Step 5: Quality Gate Decision**

Overall confidence = weighted average (CRITICAL x3, HIGH x2, MEDIUM x1, LOW x0.5).

- **FINALIZE** (-> Stage 5) IF: overall confidence >= 80%, CRITICAL >= 85%, HIGH >= 70%, no blockers
- **CONTINUE** IF: confidence 60-79%, experiments likely to improve, total time < 4 hours
- **ESCALATE** IF: confidence < 60%, core assumptions invalidated, conflicting results, time >= 4 hours, fundamental design flaw

On FINALIZE: update assumptions.md (promote RISKY -> SOLID), update architecture.md, update GUIDE.md, proceed to Stage 5.
On CONTINUE: return to Step 1 with updated queue. Enforce cumulative 4-hour limit.
On ESCALATE: present options to user (revise direction, accept risk, continue experiments, architecture revision).

**Best Practices:**
- Time: 15-60 min/experiment, 2-4 hours total recommended, 6 hours max
- Workspace: always `/tmp/craft-experiments/`, never `<WT>/`, always delete after
- Sequential execution (each informs next)
- Journal updated during execution, findings captured before cleanup

---

### Stage 5: Second-Order Effects & Anti-Cases

**Input:** All previous outputs, `GUIDE.md`
**Output:** `effects-boundaries.md`, `p1-stage5-journal.md`, `GUIDE.md` (updated)

**Rehydrate:** If effects-boundaries.md exists, read and build upon it.

**Position (Stage 5 of 6):** Think like a systems thinker. Every action has reactions.

**Analyze systematically:**

1. **Existing use case impacts** -- affected workflows, modified functionality, performance implications, breakage risks
2. **Operational impacts** -- deployment changes, monitoring/logging needs, support implications, training needs
3. **Future flexibility** -- enabled/constrained future work, unintended doors opened, reversibility
4. **Anti-cases (what must NOT happen):**
   - Misuse scenarios (unintended use, abuse, excessive load)
   - Anti-patterns to avoid (failed approaches, technical debt creators, tempting shortcuts)
   - Out-of-scope boundaries (problems we won't solve, deferred features, unnecessary complexity)

**Key Questions (document answers in effects-boundaries.md):**

1. **System Impacts:** touched systems, operations, failure points, monitoring
2. **User Workflow Changes:** current vs new steps, learning/unlearning, training needs
3. **Data Flow Changes:** new sources, transformations, destinations, lifecycle
4. **Security Implications:** attack surfaces, controls needed
5. **Performance Impacts:** resource consumption, bottlenecks, caching
6. **Operational Changes:** deployment, dependencies, rollback, monitoring, runbooks
7. **Scope Boundaries:** explicitly IN scope, explicitly OUT, integration contracts

**Quality Gate: Effects & Boundaries Assessment**

Checklist (7 items):
- [ ] All second-order effects identified
- [ ] Impact on existing systems/workflows analyzed
- [ ] Operational implications considered
- [ ] Future flexibility evaluated
- [ ] Anti-cases defined
- [ ] Misuse scenarios identified
- [ ] Scope boundaries documented with rationale

**Score >= 90%:** Proceed automatically to Stage 6 (no user confirmation needed).
**Score 70-89%:** Iterate (max 3). Think broader, more adversarially, 6-12 months ahead.
**Score <70% or Ambiguous:** Escalate to user.

---

### Stage 6: Complete Synthesis & Final Confirmation

**Input:** All 5 previous outputs + journals, `GUIDE.md`
**Output:** `task-definition.md`, `p1-stage6-journal.md`, `GUIDE.md` (updated)

**Rehydrate:** If task-definition.md exists, read and build upon it.

**Position (Stage 6 of 6):** Think like an integrator -- create coherence, not concatenation.

**Create comprehensive task definition** at `<WT>/planning/task-definition.md`:

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/stage6-task-definition.md` and populate with project-specific content.

Integrate: primary use cases (Stage 1), NFRs (Stage 2), architectural context (Stage 3), validated assumptions (Stage 4), second-order effects (Stage 5), anti-cases & boundaries (Stage 5), open questions.

**Reflect:** Do we truly understand what we're building? Feasible within constraints? What's most likely to cause problems? Overall confidence?

**FINAL QUALITY GATE (MANDATORY USER CONFIRMATION):**

Present complete synthesis: Vision, Core Capabilities, Quality Constraints, Technical Approach, Confidence Level, Boundaries.

"To proceed: Type PROCEED. If anything needs adjustment: tell me what to revisit."

**WAIT for explicit user confirmation.**

**Check for Material Changes Before Phase Transition:**

IF user feedback contradicts confirmed stages:
- Identify affected stages
- Present consequences and options: (1) Jump back to affected stage and rebuild (recommended), (2) Document as future work and proceed, (3) Explain impact
- IF jump-back: update GUIDE.md, re-execute through Stage 6
- IF continue: document in GUIDE.md, proceed to Phase 2

-> IF "PROCEED": Document confirmation, update GUIDE.md Phase 1->2 transition, move to Phase 2
-> IF issues: Revert to affected stage, progress forward again

---

## Phase 2: Criteria Definition

**Input:** `task-definition.md`, `requirements.md`, `GUIDE.md`
**Output:** `quality-criteria.md`, `p2-planning-journal.md`, `GUIDE.md` (updated)

**Context Refresh:** Read GUIDE.md + Phase 1 outputs before starting.

**Define success dimensions:**

**Functional completeness** -- specific capabilities, inputs handled, outputs produced, edge cases. Each requirement gets a falsifiable criterion:
- BAD: "Handle errors gracefully"
- GOOD: "All error paths return structured error objects with message, code, and context"

**Code quality** -- test coverage %, review standards, documentation completeness, pattern adherence

**Integration verification** -- state transition completion, dependency integration, system compatibility, backward compatibility

**Anti-criteria** -- security vulnerabilities, performance regressions, code smells, unintended side effects

**Measurement methods** per criterion: test suite commands, code reviewer checks, benchmark commands, integration validation steps

**Exit thresholds:**
- Primary criteria: 100% complete
- Quality score: >= 80 (weighted: functional 40% + code review 35% + completeness 25%)
- Blocking issues: zero

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase2-quality-criteria.md` and populate with project-specific content.

**Present to user**, wait for confirmation. Update if changes requested.

---

## Phase 2-B: Understanding Through Test Design

**Input:** `task-definition.md`, `use-cases.md`, `requirements.md`, `quality-criteria.md`, `GUIDE.md`
**Output:** `test-plan.md`, `p2b-test-design-journal.md`, `GUIDE.md` (updated)

Tests are specifications of understanding, not afterthoughts. Designing tests first discovers ambiguities, edge cases, and gaps.

> **Directory Isolation**: All paths MUST use `<WT>` prefix. See [Directory Isolation](#directory-isolation).

**Important:** Phase 2-B defines test strategy and approach, NOT detailed per-feature specs. Task boundaries come in Phase 2-D. This phase establishes:
- Test categories (unit, integration, edge case, error path)
- Test structure (e.g., Mocha/Chai with Given/When/Then)
- General principles (mock external services, test happy/sad paths)
- Example scenarios to illustrate approach

### Design Test Scenarios

**1. Happy path tests** -- canonical success examples:
- Typical/realistic input, expected behavior (core workflow start to finish), correct output (structure, values, status)

**2. Corner cases** -- boundary conditions:
- Empty/minimal inputs, boundary transitions (0, 1, max-1, max, max+1), format variations (dates, case, whitespace, unicode), state-based scenarios (first-time vs subsequent)

**3. Error paths** -- what should NOT happen:
- Invalid inputs (wrong types, malformed data, out-of-range, missing fields)
- Error conditions (service unavailable, DB failures, auth failures, rate limits, partial failures)
- Security violations (injection, XSS, path traversal, oversized inputs, unauthorized access)

### Plan Test Setup and Test Data

- **Fixtures/mocks** -- reusable test data objects, factory functions for generating variations
- **Before/after hooks:**
  - `before()`: one-time setup (DB connections, expensive resources)
  - `beforeEach()`: per-test clean slate (reset mocks, fresh data)
  - `afterEach()`: per-test cleanup (restore mocks, clear caches)
  - `after()`: one-time teardown (close connections)
- **Mock strategy** -- external APIs (sinon stubs), DB calls, file system, date/time (mock clock for determinism), RNG
- **Data factories** -- realistic patterns (not "test@test.com"), varied across tests, deterministic, document special meanings

```javascript
// Example factory pattern
function createInvoiceEmail(overrides = {}) {
  return { ...defaults, ...overrides };
}
const largeInvoice = createInvoiceEmail({ body: 'Amount: $50000.00' });
```

### Document Test Plan

Write to `<WT>/planning/test-plan.md`:
- Test categories (Unit, Integration, Edge Case, Error Path) with illustrative examples
- Test setup strategy and mock approach
- Test data patterns and factory approach
- Coverage goals aligned with quality-criteria.md
- Detailed per-feature test specs will come in Phase 2-D (after task boundaries defined)
## Phase 2-B: Test Design (Completion)

### Present Test Plan to User

Present test design conversationally. Ask:
- "Does this test plan cover all the scenarios you care about?"
- "Are there edge cases I'm missing?"
- "Do the error messages make sense?"

**IF confirmed:** Document to `<WT>/planning/test-plan.md`, update GUIDE.md with "Phase 2-B complete: Test plan confirmed with [X] test scenarios", proceed to implement tests.

**IF changes requested:** Revise, re-present, get confirmation, then proceed.

### Document Test Strategy and Example Specifications

Once confirmed, document strategy and representative examples in `<WT>/planning/test-plan.md`.

**These are EXAMPLES and STRATEGY, not a complete test catalog.** Phase 2-D creates detailed specs per task. Phase 3 implements actual tests.

**Test Specification Format (Given/When/Then):**

For each test scenario:
- **Category:** Unit | Integration | Edge Case | Error Path
- **Given:** Initial conditions, mocked dependencies, test data
- **When:** Action being tested (function call, parameters, events)
- **Then:** Expected outcomes (return values, state changes, side effects, error messages)
- **Assertions:** Specific equality checks, type validations, error message patterns

Update GUIDE.md marking Phase 2-B fully complete. Note that detailed test specs will be written per-task in Phase 2-D.

Announce: "Test strategy finalized. Detailed test specifications will be written in Phase 2-D as part of task creation..."

---

## Phase 2-C: Infrastructure Planning

**Input:** `architecture.md`, `tooling.md` (Phase 1 Stage 3), `test-plan.md` (Phase 2-B), `GUIDE.md`

**Output:**
- `<WT>/planning/project-structure.md` - directory layout, code organization
- `<WT>/planning/tech-relationships.md` - component dependencies, data flow
- `<WT>/planning/infrastructure-ids.md` - service IDs, endpoints, credentials refs
- `<WT>/planning/tooling.md` - updated with integration workflow
- `<WT>/planning/p2c-infra-planning-journal.md` - journal file

**Referenced By:** Phase 2-D (task deps), Phase 3 (implementation), Phase 4 (integration validation)

---

**INFRASTRUCTURE PLANNING IS DOCUMENTATION, NOT CREATION**

This phase documents: project structure, component relationships, infrastructure IDs, tooling plans.

This phase does NOT create: actual directories, package files, config files, build tools, dev environment, git repos.

**Directory and file creation happens in Phase 3** (Task 001 Tier 0 creates project structure).

---

### Step 0: Tooling Integration Research (Optional)

**If Stage 3 identified tooling gaps, research integration patterns in parallel:**

1. **MCP Server Integration** - setup guides, auth requirements, limitations
2. **Subagent Orchestration** - when to use, coordination patterns, context management
3. **External API Integration** - error handling, rate limiting, auth patterns
4. **Testing Tool Integration** - runners, coverage, mocking strategies
5. **Deployment & Quality Tools** - automation, scanning, monitoring, rollback

**Web research queries (parallel):**
- "[tool] setup guide best practices"
- "[tool] integration with [framework] examples"
- "error handling patterns for [API] integration"
- "[testing-tool] CI/CD integration examples"

**Tooling Research Quality Gate:**

Checklist: integration patterns clear, config requirements known, error handling researched, quality enforcement approaches identified.

**Loop Logic (max 5 iterations):**
- IF gaps AND iteration < 5: Document targeted questions, execute focused research, consolidate, re-evaluate
- IF iteration >= 5: Document remaining gaps as "Assumptions to Validate", proceed

**When quality gate passes:** Update `<WT>/planning/tooling.md` with integration patterns.

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase2c-tooling.md` and populate with project-specific content.

---

### Step 1: Define Project Structure

**MANDATORY: Research Technology-Specific Source Code Layout Conventions**

Before defining directory structure, research conventions for chosen tech stack.

**Research Process:**
1. Identify tech stack from architecture.md (language, framework, runtime, build tools)
2. Research official conventions via WebSearch ("[language] official project structure guide", "[framework] directory layout conventions")
3. Research community conventions ("[framework] project structure best practices [current year]")
4. Research poly repo patterns ("[framework] poly repo structure patterns")
5. Research MCP server organization patterns
6. Reconcile conventions with poly repo strategy

**Key questions to answer:**
- Official directory structure recommendation?
- Source code location (src/, lib/, app/, cmd/)?
- Module organization (by feature, layer, domain)?
- Test location (alongside code, separate tree)?
- File naming conventions?
- Standard config files?
- Import/dependency patterns?
- Framework-specific patterns?

**Document to `<WT>/planning/project-structure.md`:**

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase2c-project-structure.md` and populate with project-specific content.

Key sections: Technology Convention Alignment, Existing Structure Assessment, Repository Organization (Poly Repo Context), Directory Layout, Module Organization, Key Entry Points, Cross-Repository Integration Points, MCP Server Organization (strategy + rationale), Task-Based Development Structure.

**Migration Planning (If Modifying Existing System):**

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase2c-migration.md` and populate with project-specific content.

Key decisions:
- **Migration Classification:** One-Time vs Repeatable
  - One-Time: runs once per environment, manual/scripted, no framework needed
  - Repeatable: runs per deploy, REQUIRES migration framework with version tracking, rollback, idempotency
- Incremental migration approach, validation checkpoints, backward compatibility, risk assessment

**If starting fresh:** Skip migration section.

**Update architecture.md** with "Source Code Layout Conventions" section documenting:
- Official convention sources (URLs, key points)
- Community practice research findings
- Technology-specific decisions (directory organization, file naming, import conventions)
- Poly repo integration approach
- MCP server organization decisions
- Deviations from standard with rationale
- Task Implementation Directive (every task MUST review before implementation)

---

### Step 1b: Establish Task-Based Development Workflow

**Create task folders and learnings file:**
```bash
mkdir -p "<WT>/planning/tasks-pending"
mkdir -p "<WT>/planning/tasks-completed"
touch "<WT>/planning/learnings.md"
```

Initialize learnings.md with header explaining its purpose (captures implementation insights that improve subsequent tasks).

**Task-Based Development Philosophy:**

A task is a self-contained vertical slice including: UI components, API endpoints, schema changes, service logic, data access, quality verification, test coverage, and fix loops until all tests pass and quality gates met.

**Task Execution Loop:**

```
WHILE tasks exist in tasks-pending/:
  1. SELECT next task (respect dependencies)
  2. ANNOUNCE: "Starting Task [N]: [Feature Name]"
  3. PLAN this task:
     → Read learnings.md for lessons from previous tasks
     → Consider: What patterns worked? What pitfalls discovered? What testing strategies effective?
     → Form implementation hypothesis and document in task file under "Implementation Plan"
  4. IMPLEMENT: For each component, write code + tests + commit incrementally
  5. QUALITY VERIFICATION LOOP:
     WHILE quality gates not met OR tests failing:
       - Run test suite, analyze failures, fix
       - Run code review, address feedback
       - Check quality criteria, refactor if needed
       - Commit fixes
     END WHILE
  6. FINAL VALIDATION: Verify all checkboxes, acceptance criteria, integration tests
  7. COMPLETE task:
     - Fill "Completion Notes" (iterations, key learnings, issues, quality score)
     - Move task file to tasks-completed/
     - Commit final completion
  8. CAPTURE LEARNINGS:
     → Update architecture.md if new patterns/insights discovered
     → Append to learnings.md:
       ## [Date] - Task [N]: [Feature Name]
       ### What We Learned
       - [Key insight not obvious upfront]
       - [Pattern that worked well]
       - [Pitfall and how to avoid]
       ### Impact on Future Work
       - [How this affects remaining tasks]
       ### Architectural Insights
       - [If any patterns emerged]
     → Commit: git -C "<WT>" commit -am "Learnings: Task [N] - [Brief insight]"
  9. ANNOUNCE: "Task [N] Complete: [Feature Name] ([X] iterations, quality score [Y])"
  10. Continue to next task
END WHILE

When tasks-pending/ is empty:
  → All features implemented
  → Review cumulative learnings
  → Proceed to Phase 3 final quality pass → Phase 4 delivery
```

**Task Prioritization:** Dependencies first > Foundation before features > High-risk first > User value

**Autonomous Iteration:** Fix tests, address review feedback, refactor, debug without user prompting. Only prompt user for catastrophic failures, critical architecture decisions, requirement ambiguity, or 10+ iterations.

---

### Step 2: Document Technology Relationships

Map how technologies interact. Document to `<WT>/planning/tech-relationships.md`:

Sections: System Integration Map, Authentication & Authorization, Data Flow (input -> processing -> output), Integration Patterns (API calls, database access, error handling at boundaries).

---

### Step 3: Document Infrastructure Identifiers

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase2c-infrastructure-ids.md` and populate with project-specific content.

Sections: Service Identifiers, Authentication References (env vars needed), Resource Identifiers, Configuration Values (timeouts, rate limits, retry policies).

**Security Note:** Contains REFERENCES to credentials, not actual secrets.

---

### Step 3b: Plan Tooling Integration Strategy

Review `<WT>/planning/tooling.md` and plan integration for each category:

1. **MCP Servers** - capabilities, when used, repo organization, setup, integration pattern
2. **Subagents** - when invoked, parameters, parallelization, result integration
3. **External APIs** - auth, integration pattern, error handling, rate limits
4. **Testing & Quality Tools** - frameworks, when run, coverage targets, scope

Document integration workflow for each phase (Planning, Phase 3 Iterations, Phase 4 Delivery) and setup checklist.

---

### Step 4: Present Planning to User

Present complete infrastructure planning summary. Include: project structure, source code conventions, technology integration, infrastructure setup, tooling strategy, key documents list.

**[WAIT for user confirmation]**

IF confirmed: Update GUIDE.md, announce "Infrastructure planning complete. Moving to Phase 2-D..."
IF changes requested: Revise, re-present, get confirmation.

---

**PATH DISCIPLINE IN TASK FILES:**

ALL paths in task files MUST use `<WT>` prefix. Never use relative paths (`./src/file.js`), implicit relative (`src/file.js`), or `cd` commands. Task files become templates - incorrect paths propagate to all implementations.

---

## Phase 2-D: Feature Task Decomposition

**Input:** `use-cases.md`, `requirements.md`, `task-definition.md` (Phase 1), `project-structure.md`, `tech-relationships.md`, `infrastructure-ids.md` (Phase 2-C), `GUIDE.md`

**Output:**
- `<WT>/planning/implementation-steps.md` - task ordering, dependency phases, prioritization
- `<WT>/planning/feature-tasks.md` - visual feature dependency map, groupings, relationships
- `<WT>/planning/tasks-pending/task-NNN-[name].md` - one per atomic feature
- `<WT>/planning/p2d-task-breakdown-journal.md` - journal file
- `<WT>/planning/GUIDE.md` - updated

---

**Context Refresh:** Read GUIDE.md before task decomposition. Review all Phase 1 outputs, Phase 2 criteria, Phase 2-B tests, Phase 2-C infrastructure. Verify understanding of tier-based task organization (Tier 0, Batches, Tier Final).

**TASK DECOMPOSITION CREATES TASK DEFINITIONS, NOT IMPLEMENTATIONS**

Creates: task definition files (specs), implementation order (sequence), dependency analysis, templates with objectives/acceptance criteria/verification.

Does NOT: write implementation code, create test files, install dependencies, configure build tools, write prototypes.

---

### Step 1: Review Use Cases and Plan Implementation Order

Read Stage 1 use cases from `<WT>/planning/task-definition.md`. Consider:
- Core user workflows and supporting features
- Dependencies between features
- Logical groupings: what must exist first, what can be built independently

**Create comprehensive implementation plan** in `<WT>/planning/implementation-steps.md`:

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase2d-implementation-steps.md` and populate with project-specific content.

Key sections:
- Visual Feature Dependency Map (Mermaid chart with solid arrows for hard deps, dotted for related features)
- Phased groups: Foundation, Service Integration, Business Logic, UI Layer, Quality & Integration
- Per phase: goal, tasks with deps, exit criteria, parallel work opportunities, related feature coordination
- Critical Path Analysis (longest dependency chain)
- Implementation Order Recommendation (serial order respecting deps, maximizing parallelism)
- Cross-Cutting Concerns
- Task Prioritization Principles

---

### Step 2: Create Task Files for Each Feature

**Check for Material Changes Before Task Creation:**

Compare task breakdown with confirmed Stage 1 use cases. If discrepancies found (features not in Stage 1 or Stage 1 features missing):

```
MATERIAL CHANGE DETECTED in Phase 2-D Task Creation

Task breakdown doesn't align with Stage 1 use cases:
[Description of discrepancy]

Options:
1. Jump back to Stage 1 and add missing use cases (recommended if new features needed)
2. Remove extra tasks not in Stage 1 (strict scope adherence)
3. Document as Phase 2 expansion with rationale

What would you like to do?
```

- **IF jump-back:** Return to Stage 1, add use cases, re-confirm, return to Phase 2-D
- **IF remove tasks:** Only create tasks for confirmed Stage 1 use cases
- **IF document expansion:** Add to GUIDE.md explaining why scope expanded, proceed

**Task File Naming:** `task-NNN-[feature-name].md` (NNN zero-padded, feature-name kebab-case)

**Task Creation Process:**
1. Define initial task scope
2. **Research UI expectations (for UI tasks)** - parallel WebSearch queries
3. Finalize implementation scope with research findings
4. **Immediately write TDD specs** (Given/When/Then) while scope is clear
5. Document dependencies
6. Save task file

**Do not** create all task files first then come back for specs. Create task + write specs + move to next.

---

**Task File Template:**

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase2d-task-file.md` and populate with project-specific content.

This template includes all sections:
- **Tier & Batch Information** - tier, batch number, parallelizable tasks, execution order, estimated time
- **Feature Description** - from Stage 1 use case, user value delivered
- **Dependencies** - Tier 0 requirements (identifiers, credentials, patterns, access methods, topology) + task dependencies (prerequisites, blocks)
- **Implementation Scope:**
  - Architecture Compliance Check (platform UI integration, entry points, containers, constraints)
  - UI Components, API Endpoints, Schema Changes, Service Logic, Data Access
  - Platform Integration Compliance (execution limits, security policies, error handling)
- **Quality Gates** - code review, quality score threshold, integration testing, security validation
- **Path Discipline Verification** - all code uses `<WT>` prefix, git commands use `git -C "<WT>"`
- **Test Specifications** - detailed TDD specs with Given/When/Then for: platform integration tests, unit tests, integration tests, edge cases, error paths
- **Pre-Completion Self-Check:**
  - Code Review: style, anti-patterns, error handling, documentation, no debug code
  - Quality Criteria: functional completeness 100%, code review >= 80%, integration 100%, overall >= 80%, blocking issues 0
  - Integration Points: external systems tested, data flow verified, error paths tested, edge cases handled
  - Security: no vulnerabilities, input validation, auth working, sensitive data secure
  - Tests: all passing, unit/integration/edge/error coverage, coverage meets standards
  - Documentation: README updated, complex logic commented, GUIDE.md updated if deviated
  - **IF ALL PASS:** Move to tasks-completed/, proceed to Task Reconciliation
  - **IF ANY FAIL:** Fix issues, re-verify, then move
- **Related Tasks** - same data/schema, same UI components, same APIs, sequential workflow, conflicting patterns, cross-cutting concerns
- **Implementation Plan** - filled at task start (approach hypothesis, learnings applied, risks, integration points)
- **Acceptance Criteria** - all checkboxes, tests passing, quality score, review approved, docs updated, no blockers
- **Completion Notes** - filled when moving to completed (iterations, learnings, issues, quality score)

**CRITICAL TDD Spec Rules:**
- Write complete Given/When/Then for EACH test during task creation
- Include specific inputs, expected outputs, assertions
- Cover happy path, edge cases, error paths
- DO NOT leave placeholders or vague descriptions
- Phase 3 implements these exact specs as tests (red) then writes code to pass (green)

---

#### UI Research Loop (For UI Tasks, Max 5 Iterations)

**Pre-Step:** Discover relevant developer communities via parallel WebSearch.

**4 Parallel Research Queries:**
1. **Technology-Specific UI Patterns** - official docs, recommended patterns, pitfalls
2. **Community Techniques** - real-world solutions from discovered forums
3. **User Experience Expectations** - UX patterns, accessibility, mobile considerations
4. **Component Behavior Patterns** - interaction patterns, animations, confirmation flows

**UI Research Quality Gate Checklist:**
- Pattern coverage: tech patterns, community techniques, UX expectations, behavior patterns
- Implementation clarity: recommended approach, library recommendations, pitfalls, performance
- User experience: accessibility, mobile/desktop, loading/error states
- Confidence level: HIGH for architecture, MEDIUM for interactions, validation plans for LOW

**Loop Logic:** IF gaps AND iteration < 5: targeted research on gap areas. IF iteration >= 5: document gaps, plan early Phase 3 prototyping.

**Document findings** in task file under "UI Research Findings for This Task":
- **Technology-Specific Patterns:** Official patterns, recommended approaches, pitfalls, performance considerations
- **Community Techniques:** Real-world solutions, challenges discovered, recommended libraries, edge cases
- **User Expectations:** Expected behaviors, feedback patterns, accessibility requirements, mobile considerations
- **Component Behavior Patterns:** Interaction patterns, confirmation needs, animation patterns, undo/recovery
- **Synthesis - Implementation Decisions:** Decision + rationale based on findings
- **Deviations from Common Patterns:** What differs, why, risk, mitigation

**When to skip UI research:** Task not UI-related, pattern well-established in project, previous task already researched component type, component is trivial.

**UX Enhancement Philosophy:** Bias toward modern, polished UX while respecting architectural constraints. Favor: modern libraries, animations that improve clarity, progressive enhancement, accessibility, responsive design, loading states, micro-interactions, error recovery. Respect: architecture decisions, performance budgets, browser support, security requirements, existing design system.

---

#### Comprehensive Feature Task Generation Directives

**Before creating each task file, systematically consider:**

**1. Core Feature Aspects:**
- **Actor Consideration:** Who interacts, permissions needed, context brought, discovery path
- **API Changes:** New/modified endpoints, contracts, versioning
- **Data Storage:** Schema changes, migrations, relationships, storage patterns
- **User Interface:** Components, screens, framework integration
- **Use Cases & Requirements Mapping:** Traceability from requirements to use cases to tasks to tests

**2. UI Element Lifecycle (MANDATORY for UI tasks):**
- Enablement (initial/dynamic state, visual feedback for disabled)
- Animation (entrance/exit/transition, performance, reduced motion)
- Placement (visual hierarchy, proximity, responsive behavior, accessibility/tab order)
- Input Validation (rules, timing, error display, recovery)
- Output Display (dynamic/static, empty states, loading states)
- User Notifications (success/error/progress, persistence)
- Waiting Patterns (blocking/non-blocking, indicators, timeouts)
- Multiple Languages (i18n: externalization, locale-aware formatting, text expansion, RTL, language switching)

**3. UI Interaction Patterns & Component Relationships:**

**3.1 Component Relationship Mapping:**
- Parent-child: data flow down, events up
- Sibling: coordination mechanism, shared state
- Dependency graph: upstream providers, downstream consumers, peer components, integration points

**3.2 CRUD Operations Analysis:**
For each UI component, document all Create/Read/Update/Delete operations:

**CREATE:** Where triggered (+ button, "Add New", drag-drop)? Flow (initiate -> interface -> data entry -> validation -> success/fail -> UI update)? What validation? What on success/failure? Bulk create support?

**READ:** What data displayed? How loaded (initial, lazy, infinite scroll)? What filters/search? How refreshed? Multiple views? Empty state? Load failure?

**UPDATE:** Where triggered (edit button, inline, double-click)? Inline vs modal? Save strategy (explicit, auto-save, on-blur)? Unsaved changes handling? Conflict resolution (concurrent edits)? Bulk edit?

**DELETE:** Where triggered (trash icon, swipe, keyboard)? Confirmation required (modal, inline, undo toast)? Permanent vs reversible (soft delete, trash bin)? Cascade effects on related data? Bulk delete?

Complete CRUD matrix table:
| Operation | UI Trigger | User Flow | Validation | Success State | Failure State | Bulk Support |

**3.3 Event-Driven Architecture:**
- **Events generated:** What events, when emitted, payload data, recipients, naming convention, sync vs async
- **Events received:** What listened for, source, response behavior, subscription lifecycle (subscribe on mount, unsubscribe on unmount), multiple event handling (debounce, throttle, batch)
- **Pattern selection:**
  - Direct callback (parent-child, explicit, type-safe)
  - Event bubbling (component tree propagation)
  - Global event bus / pub-sub (decoupled, many-to-many)
  - State management dispatch (Redux/Context, centralized)
  - Custom browser events (web components, cross-framework)
- Document event flow diagram: events generated with payload/recipients/pattern + events received with source/response/pattern

**3.4 State Management:**
- Component-level (local, ephemeral)
- Shared/Lifted (nearest common ancestor)
- Global (Redux/Context/etc.)
- Server state (cached API data, refresh strategy)
- URL state (shareable, bookmarkable)
- Form state (library, validation, error display)

**3.5 Component-to-API Interaction:**
- Call triggers (user actions, mount, timer, WebSocket)
- Request lifecycle (loading states, cancellation, concurrent handling)
- Response handling (success/error, cache update, optimistic rollback)
- Real-time updates (polling, WebSocket, conflict handling)

**4. Data Interaction & Integrity:**
- Actor data interaction (read/write access, access control, audit trails)
- Data integrity (optimistic updates, validation layers, transaction boundaries, referential integrity, conflict resolution)

**5. Data Lifecycle:**
- Creation (origin, validation, defaults)
- Transformation (processing stages, intermediate states, side effects)
- Storage Duration (retention, archival, backup)
- Deletion/Expiration (soft/hard delete, cascade, compliance: GDPR, etc.)

**6. Security Considerations:**
- Authentication (level, session management, credentials)
- Authorization (permission model, enforcement points, escalation prevention)
- Input security (injection prevention, file upload validation, rate limiting)
- Data protection (encryption at rest/transit, masking)
- Audit & compliance (logging, regulations, security testing)

**7. Observability & Monitoring:**
- Logging (levels, structured format, context)
- Metrics (performance, business, custom)
- Actor-specific observability (admin, developer, end-user, support)
- Alerting & incident response (conditions, routing, runbooks)

---

#### Related Task Cross-Referencing

**Before finalizing each task, identify related tasks:**

**Discovery dimensions:**
- Shared data models/tables
- Shared UI components
- Shared APIs/services
- Sequential workflows
- Conflicting patterns (need aligned approaches)
- Cross-cutting concerns (auth, logging, error handling)

**Document in task file** under "Related Tasks" section:
- Tasks operating on same data (coordinate schema changes)
- Tasks sharing UI components (maintain consistency)
- Tasks in sequential workflow (handoff points)
- Tasks with conflicting patterns (align approaches)
- Tasks with cross-cutting concerns (share standards)

**During implementation:** Read related tasks before coding, check for conflicts, validate integration points, update related tasks with discoveries.

**Handle ordering based on relationships** in implementation-steps.md.
### Task Organization & Dependency Model

**Four-Tier Execution Model:**

#### Tier 0: Linear Foundation (Sequential)
- Strict order, each blocking next
- Pattern establishment, identifier/credential creation, infrastructure provisioning
- Results documented in `architecture.md` under "Tier 0 Foundation Results"
- Each task MUST document: Identifiers Created, Credentials & Access, Patterns Established, Access Methods, Topology

**Why Tier 0 Documentation Matters:** Prevents downstream reinvention, single source of truth for IDs/creds, enables parallel batches to reference same foundation.

#### Tier 1-N: Parallel Batches
- Tasks within same batch execute 100% concurrently (no file conflicts)
- Cross-batch: sequential (Batch N+1 waits for Batch N)
- Minor code duplication OK for task independence (better than cross-task dependency)
- All batches reference Tier 0 results in architecture.md

**Within-Batch Independence Rules:**
- Tasks modify completely different files
- No shared state or resources between tasks
- Each can commit to git without merge conflicts
- Tests for each task are independent

#### Tier Final: Linear Finalization
- After ALL batches complete
- Data migration, cross-cutting refactoring, comprehensive integration tests, CI/CD, deployment
- Extract common patterns from batch duplications

### Identifying Task Tiers & Batches

**Tier 0 if ANY:** Pattern establishment? Identifier creation? Infrastructure provisioning? Race condition risk?

**Parallel Batch assignment algorithm:**
```
batch_number = 1, unassigned = [non-Tier-0, non-Final tasks]
While unassigned not empty:
  current_batch = []
  For each task in unassigned:
    if all dependencies in (Tier 0 OR batches < batch_number):
      if no file conflicts with current_batch:
        add to current_batch
  assign current_batch to Batch [batch_number++]
```

**File Conflict Detection:**
- Conflict if tasks modify same file path or related schema (same DB table)
- No conflict if completely independent files/resources

**Dependency Detection:**
- B depends on A if: B imports A's code, B requires A's schema, B calls A's API
- Document dependencies in task file "Dependencies" section

**Tier Final if ANY:** Requires everything complete? Cross-cutting? Infrastructure finalization? Sequential after another Final task?

### Task File Naming Convention

Tier-based numbering for instant dependency visualization:
- Tier 0 = 001-009, Batch 1 = 010-019, Batch 2 = 020-029, ..., Tier Final = 090-099
- Room for expansion (10 tasks per tier/batch)
- All tasks in same decade run concurrently

### Task Creation Process

1. Identify Tier 0 tasks from infrastructure needs (001-009)
2. Group into batches using dependency algorithm (010-019, 020-029, ...)
3. Identify Tier Final tasks (090-099)
4. Create files in `<WT>/planning/tasks-pending/`
5. Document Tier 0 outputs in architecture.md

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase2d-task-file.md` and populate with project-specific content.

**CI/CD and Migration Tasks:**

IF migrations exist from Phase 2-C:

**For ONE-TIME Migrations:** Create runbook documentation task only (document steps, verification, rollback).

**For REPEATABLE Migrations:** Create three tasks:
1. Migration framework (version tracking, idempotency, rollback, atomic execution)
2. Initial schema migration using framework
3. CI/CD pipeline integrating migrations

Pipeline stages: Build -> Migration (BEFORE deploy, failure BLOCKS deployment) -> Deployment (only if migration succeeds) -> Verification (health checks, smoke tests, rollback if fails).

Dependencies: Migration framework -> Initial migration -> CI/CD pipeline -> Feature tasks.

### Step 3: Validate Task Completeness

**CRITICAL TASK GENERATION QUALITY GATE:**

1. Verify ALL use cases from Stage 1 covered: Read `use-cases.md`, map each to task(s)
   - Format: "Use Case 1: [Name] -> Tasks [001, 003]"
2. Verify ALL requirements from Stage 2 addressed: functional + non-functional
   - Format: "Functional Req 1: [Name] -> Task [001]"
   - Format: "NFR 1 (Performance): -> Tasks [001, 007] + Architecture decision [caching]"
3. IF GAPS FOUND:
   - Option A: Create additional tasks to cover missing items
   - Option B: Revise requirements if over-specified (user agreement required)
   - Option C: Document as future enhancement (user agreement required)
   - LOOP: Update, re-verify, iterate until complete
4. DO NOT PROCEED until all use cases/requirements covered

**Count and verify tasks:**
```bash
ls "<WT>/planning/tasks-pending/" | wc -l
ls "<WT>/planning/tasks-pending/" | sort
```

### Step 3b: Document Parallel Execution Strategy

Write to `<WT>/planning/execution-strategy.md`:

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase2d-execution-strategy.md` and populate with project-specific content.

Key sections:
- Task Organization Summary (total tasks, tier/batch counts)
- Tier 0 table with completion gate checklist
- Batch tables with parallelism details, file conflicts, completion gates
- Tier Final table with sequential ordering
- Timeline Estimates (sequential vs parallel with speedup factor)
- Resource Allocation Plan (workers per phase)
- Risk Mitigation (merge conflict prevention, dependency enforcement, quality gates)
- Execution Checklist (before starting, per-tier, per-batch)

### Step 3c: Holistic Quality Review

**Purpose**: Verify tasks work together as coherent, consistent, complete whole. Goes beyond coverage (Step 3) to verify logical correctness.

**8 Review Dimensions:**
1. **Logical Coherence** - Tasks flow logically, no conceptual gaps, no contradictions
2. **Consistency** - Similar quality/format/terminology/detail level across all tasks
3. **Completeness** - Each task is complete vertical slice with entry/exit conditions
4. **Dependency Logic** - Dependencies necessary, minimal, no circular, clearly reasoned
5. **Scope Balance** - Tasks roughly 1-3 days, none obviously too large/small
6. **User Value** - Each delivers tangible value, no pure "tech debt" tasks
7. **Integration Points** - Contracts between tasks specified, data formats defined
8. **Cross-Cutting Concerns** - Auth, logging, error handling, performance, security consistent

**Issue Severity:**
- BLOCKER: Missing integration contract, circular dependency, contradictory requirements, missing critical task
- MAJOR: Inconsistent formats, unclear scope, unbalanced sizes, missing cross-cutting concern
- MINOR: Typo, formatting, minor clarity improvement

**Process:**
1. Sequential read-through of all task files
2. Categorize issues by severity
3. Fix BLOCKER/MAJOR before user presentation; document MINOR for later
4. Append results to `<WT>/planning/p2d-task-breakdown-journal.md`

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase2d-holistic-review.md` and populate with review results.

**Quality Gate:** All dimensions PASS or MINOR only -> proceed. Any BLOCKER/MAJOR -> fix, re-review, loop until all pass.

### Step 4: Present Task Roadmap to User

Present complete task decomposition: implementation phases with task lists, total count, file locations.

**[WAIT for user confirmation]**

IF confirmed:
- Update GUIDE.md with Phase 2-D completion and Phase 2->3 transition
- Announce: "All planning complete. Beginning Phase 3: Task Execution..."
- Move to Phase 3

IF changes requested: Revise, re-present, get confirmation, then Phase 3.

---

## Pre-Implementation Quality Gate (Phase 2 -> Phase 3 Checkpoint)

**Ultrathink: Last checkpoint before code.**

Reflect: Have we validated assumptions? Does architecture support all use cases within requirements? What could force major rework? What is our confidence level?

**Cross-Validation Check (Advisory):**
- Every test has corresponding task? Every task has test?
- Tasks collectively implement complete vision?
- Criteria measurable via task tests?
- IF gaps: Warning with options: add missing item, remove orphan, document intentional gap
- Advisory only - gate can pass with documented gaps

### Verification Checklist (ALL must be checked)

**Phase 1 (6 Stages):**
- [ ] Stage 1: Use cases in use-cases.md
- [ ] Stage 2: Requirements in requirements.md
- [ ] Stage 3: Architecture finalized with scoring
- [ ] Stage 4: Assumptions classified, RISKY validated or accepted
- [ ] Stage 5: Effects and boundaries documented
- [ ] Stage 6: Complete synthesis in task-definition.md
- [ ] GUIDE.md: Phase 1 marked complete

**Phase 2:**
- [ ] Quality criteria in quality-criteria.md
- [ ] Test specs in test-plan.md (Given/When/Then)
- [ ] Infrastructure documented (project structure, IDs, tech relationships)
- [ ] Task decomposition in tasks-pending/ with dependencies and acceptance criteria
- [ ] implementation-steps.md documents execution order
- [ ] GUIDE.md: Phase 2 marked complete

**Cross-Verification:**
- [ ] Architecture supports all use cases
- [ ] Architecture meets all requirements
- [ ] Tests cover all functional requirements
- [ ] Tasks implement all use cases
- [ ] No implementation yet in src/ or test/

**User Confirmations:**
- [ ] Stage 1, Stage 2, Stage 3, Phase 2-D all explicitly confirmed

### Decision Logic

**ALL checked:** Gate PASSED
- Update GUIDE.md with "Pre-Implementation Quality Gate: PASSED" and design summary
- Announce gate passed with summary stats
- Proceed to Phase 3

**ANY unchecked:** Gate BLOCKED
- List missing items
- Return to incomplete stage/phase, complete, get confirmation, re-run gate

**Material Changes at transition:**
IF inconsistencies discovered that reveal earlier phase issues:
- Present: description of inconsistency, affected phases, required updates
- Options: (1) Jump back and fix now (recommended), (2) Document as known limitation and proceed
- IF jump-back: Update GUIDE.md, return to affected phase, complete updates, re-run gate
- IF continue: Document in GUIDE.md Decision History, note tech debt, proceed

**Implementation found before Phase 3:**
- If leftover files: clean up and re-run gate
- If baseline code: document in GUIDE.md
- If boundary violation: user decides (keep or delete)

---

## Phase 3: Task Execution Loop

**Input Files (per task):** task file, quality-criteria.md, test-plan.md, architecture.md, tooling.md, infrastructure-ids.md, learnings.md, GUIDE.md

**Output Files (per task):** src/ implementation, test/ files, README.md updates, learnings.md updates, task moved to tasks-completed/, GUIDE.md updated

### Phase 3 Exit Criteria

**Core (Must Pass):**
- [ ] `tasks-pending/` directory empty
- [ ] No critical blockers or unresolved errors

**Quality (Recommended - 3+ should pass):**
- [ ] Test pass rate >= 95% (critical 100%, flaky documented)
- [ ] README.md updated with all feature documentation
- [ ] No critical TODOs/FIXMEs (nice-to-have acceptable)
- [ ] Quality criteria from quality-criteria.md scored >= 80%

**Scoring:** Core + All (6/6) = ready for Phase 4. Core + Most (5+/6) = acceptable, document issues. Core only (2/6) = user decision. User can override at any score with documented acceptance.

**Initialize:** tasks_completed_count = 0, tasks_total_count = [from Phase 2-D], cumulative_learnings = []

### The Task Execution Loop

WHILE tasks exist in `<WT>/planning/tasks-pending/`:

**PATH DISCIPLINE:** All file ops use `<WT>` prefix. All git: `git -C "<WT>"`. Never relative paths. Never standalone `cd`. One wrong command corrupts session.

**Context Reminder:** If lost context, read `<WT>/planning/GUIDE.md` for: what we're building, quality criteria, completed tasks, learnings, layer dependencies.

---

#### Step 1: Select Next Task

```bash
ls "<WT>/planning/tasks-pending/" | sort
```

Choose next respecting `implementation-steps.md`:
- Dependencies first (no pending prerequisites)
- Foundation before features
- High-risk first (within phase)
- User value priority

Read selected task file completely: feature description, implementation scope, quality gates, test requirements, dependencies, infrastructure references, architecture patterns.

#### Step 2: Plan the Work

**Validate task alignment:**
- [ ] Acceptance criteria clear and measurable?
- [ ] Prerequisite tasks complete?
- [ ] Approach matches architectural patterns?
- [ ] Quality expectations understood?
- [ ] Learnings from previous tasks applied?

**IF task conflicts with confirmed architecture/requirements:**
Present material change with options:
1. Revise architecture (if pattern needed for multiple tasks) -> return to Stage 3
2. Update task approach to match architecture (if task-specific) -> modify and proceed
3. Document exception as tech debt -> add to GUIDE.md, note in task, proceed

**Review context materials:**
1. `architecture.md` - technology decisions, integration patterns, failure modes
2. `tooling.md` - MCP servers, subagents, external APIs, testing tools
3. `infrastructure-ids.md` - IDs, endpoints, credentials, rate limits
4. Existing code in `<WT>/src/` - reuse opportunities, established patterns, packages

**Evaluate existing code:**
```bash
ls -la "<WT>/src/"
find "<WT>/src/" -name "*.js" -o -name "*.ts"
```
- What modules/utilities can be leveraged?
- What patterns are established?
- What can be reused vs. created?
- What test patterns can be adapted?

**Document reuse plan** in task file "Implementation Plan" section:
- Existing code to leverage, patterns to follow, tools to use, new code needed

#### Step 2b: Experimental Planning Loop

**Enter exploration loop BEFORE committing to full implementation.** Iterate to answer key questions through small focused experiments.

**Loop Condition:** Continue WHILE key questions remain OR plan revisions needed.
**Exit:** ONLY when all critical questions answered, approach validated, plan ready for TDD.

**Step 1 - Identify Key Questions:**

Categories:
- **Technical Feasibility**: "Can library X handle use case Y?" (performance, edge cases)
- **Implementation Approach**: "Strategy X or Y?" (comparing alternatives)
- **Integration**: "How does service X actually behave?" (real-world vs documented)
- **Requirements Clarity**: "What should happen in ambiguous scenario X?"

Document each: specific question, why it matters, current assumption, risk if wrong, experiment needed.

**Prioritize:** MUST answer (blocks implementation) > SHOULD answer (significant impact) > NICE to answer (refines details). Focus on MUST and SHOULD first.

**Step 2 - Design Experiments:**
- **Minimal scope**: Test only what answers the question
- **Realistic conditions**: Actual APIs, real data, production-like
- **Measurable outcomes**: Clear success/failure criteria
- **Time-boxed**: 15-30 minutes per experiment
- **Isolated**: No effect on existing code/state

Types: API exploration, performance benchmark, integration compatibility, edge case behavior, architectural pattern comparison.

**Step 3 - Execute & Capture:**

Create experiment workspace: `<WT>/experiments/task-NNN-exploration/`

For each experiment document:
- Question addressed
- Execution date and outcome (Success/Failure/Partial/Unexpected)
- Key findings and performance metrics
- Answer with confidence level
- Implications for plan

Handle unexpected results: don't ignore surprises, investigate anomalies, adjust hypotheses, consider follow-up experiments.

**Step 4 - Consolidate Findings:**

Map findings back to questions:
- Answer with confidence level (High/Medium/Low) and evidence summary
- Decision and rationale for each question
- Identify: consistent findings, conflicting findings, emergent patterns, new questions

Assess: All MUST-answer resolved with high confidence? Most SHOULD-answer resolved? Remaining unknowns non-blocking?

**Step 5 - Quality Gate Decision:**

**PROCEED to TDD if:**
- All MUST-answer questions have clear, evidence-based answers
- Approach validated by experiments
- Key risks understood and mitigated
- Confidence sufficient, plan valid or updated

**LOOP BACK if:**
- Critical questions unanswered
- Approach not viable
- New blocking questions emerged
- Confidence too low

If looping: document what changed, identify new questions, design new experiments, re-execute, re-consolidate.
Max 3-4 iterations typical. If stuck >4: escalate to user, consider arch change, or task decomposition.

**When proceeding:** Update task file "Implementation Plan" with validated strategy, key questions resolved, lessons from experiments. Clean up workspace: archive or delete `<WT>/experiments/task-NNN-exploration/`.

**When to skip this stage:** Trivial task, well-established approach, no uncertainty, experiments take longer than implementing, prior tasks validated approach.

---

#### Step 3: Craft the Solution (TDD: Red -> Green -> Refactor)

**Prerequisites - Read These First:**
1. `architecture.md` - technology decisions, integration patterns, failure modes, state transitions
2. `tooling.md` - MCP servers, subagents, external APIs, testing tools
3. `infrastructure-ids.md` - service IDs, endpoints, credentials, rate limits
4. Task file "Test Specifications" section - Given/When/Then specs from Phase 2-D (your contract)

##### RED: Write Failing Tests First

**Step 3a: Implement Test Specifications as Mocha/Chai Tests**

Create test file: `<WT>/test/[module-name].test.js`

Read task file "Test Specifications". For each spec:
1. Given = Arrange (setup, mocks, test data)
2. When = Act (call the function)
3. Then = Assert (verify outcomes)

```javascript
const { expect } = require('chai');
describe('[Module Name from task]', () => {
  describe('[Function Name from task]', () => {
    it('[test name from task spec]', () => {
      // ARRANGE: Implement the Given section
      const input = /* specific test data from spec */;
      const expectedOutput = /* expected value from spec */;
      // ACT: Implement the When section
      const result = functionName(input);
      // ASSERT: Implement the Then section
      expect(result).to.equal(expectedOutput);
    });
  });
});
```

Implement ALL test specs:
- Unit tests -> describe blocks per function
- Integration tests -> describe blocks for workflows
- Edge cases -> it blocks with boundary conditions
- Error paths -> it blocks with expect().to.throw()

**Run tests - MUST FAIL (Red):**
```bash
cd "<WT>" && npx mocha test/**/*.test.js --reporter spec
```
Expected: ReferenceError, TypeError, module import errors. This is GOOD.

**Commit (Red):**
```bash
git -C "<WT>" add test/
git -C "<WT>" commit -m "test: Add failing tests for [task-name] (RED)"
```

##### GREEN: Write Minimal Implementation

**Step 3b: Write Implementation Code to Pass Tests**

Create: `<WT>/src/[module-name].js`

**Goal:** MINIMAL code to make tests green. No features not covered by tests.

Rules:
- Follow architectural patterns from architecture.md
- Use MCP servers/APIs per tooling.md
- Apply integration patterns from codebase research
- Apply wisdom from learnings.md

**Development cycle:**
```bash
# 1. Write minimal implementation for first test
# 2. Run tests
cd "<WT>" && npx mocha test/**/*.test.js --reporter spec
# 3. First test passes, others still fail
# 4. Write implementation for next test
# 5. Run tests again
# 6. Repeat until all green
```

##### REFACTOR: Improve Code Quality

**Step 3c: Refactor While Keeping Tests Green**

Once all tests pass, improve without changing behavior:
- Extract duplicated code into helpers
- Improve variable/function names
- Simplify complex logic (reduce cyclomatic complexity)
- Add comments for non-obvious code
- Improve error messages
- Optimize if measurably slow

**Refactoring rules:**
- Run tests after EVERY refactoring step
- Tests must stay green throughout
- If tests fail, undo refactoring and try different approach
- Don't add new features during refactoring
- Don't change test expectations

##### DOCUMENT & COMMIT

**Step 3d:** Update documentation if task adds user-facing features or APIs (README.md, API docs, architecture notes).

**Step 3e: Commit (Green):**
```bash
git -C "<WT>" add .
git -C "<WT>" commit -m "feat: Implement [task-name] (GREEN - all tests passing)"
```

**TDD Cycle Complete:** Tests written first (RED) -> Implementation passes tests (GREEN) -> Code refactored for quality (still GREEN).

---

#### Step 4: Verify Quality - Iterate Until Right

**Philosophy:** Not checking boxes - confirming implementation matches understanding, and understanding matches requirements. Iterate autonomously until everything makes sense.

**Autonomous iteration:** Fix issues without prompting user. Only prompt for catastrophic failures, critical architectural decisions, or requirement clarifications.

**Build Verification (if applicable):**
```bash
cd "<WT>" && npm run build
```
WHILE build fails:
1. Analyze build errors
2. Fix syntax, import, or type issues
3. Rebuild
4. Commit: `git -C "<WT>" commit -am "Fix: [what and why]"`
Proceed only when build succeeds without errors/warnings.

**Test Iteration Loop:**
```bash
cd "<WT>" && npx mocha test/**/*.test.js --reporter spec
cd "<WT>" && npx mocha test/**/*.test.js --reporter json > planning/test-results/tests-iteration-{N}.json
```

WHILE tests failing:
1. **Analyze failures:** Implementation wrong? Understanding incomplete? Edge case missed? Logical flaw?
2. **Fix root cause** (not symptom). Consider related code with same issue. Ensure fix is correct, not just making test pass.
3. **Re-run tests**: Verify fix, check nothing else broke
4. **Commit**: `git -C "<WT>" commit -am "Fix: [what learned and fixed]"`
5. Continue until all pass

**Code Review Iteration:**
Invoke code-reviewer subagent on `<WT>/src/` with:
- path: `<WT>/src/`
- iteration: {N}
- focus: quality dimensions from criteria
- Request verbose output with file:line references and severity

WHILE blocking issues:
1. Review feedback: architectural violations? security? maintainability? performance?
2. Refactor to address: improve design, don't just patch. Consider prevention.
3. Re-run tests: ensure refactoring didn't break functionality
4. Commit: `git -C "<WT>" commit -am "Refactor: [what improved and why]"`
5. Re-run code-reviewer: verify resolved

Save final review to `<WT>/planning/reviews/review-iteration-{N}.json`.

**Criteria Verification:**
Read `quality-criteria.md`, evaluate each criterion objectively with evidence.

Calculate quality score:
- Functional completeness: [%] x 0.40 = [subscore]
- Code review quality: [%] x 0.35 = [subscore]
- Integration completeness: [%] x 0.25 = [subscore]
- **Total must be >= 80**

IF score < 80 OR primary criteria incomplete:
- Identify specific gaps (requirements not met, weak quality dimensions)
- Return to Step 3 to address gaps
- Return here to re-verify
- Iterate between Step 3 and Step 4 until criteria met

**Integration Verification:**
Test each integration point from architecture.md:
- Successful interaction (happy path)
- Error handling at boundaries
- Data format conversions
- Performance per NFRs

IF integration issues: fix -> re-test -> commit -> re-verify all integrations.

**State Transition Verification:**
- System transitioned from current to future state?
- All migration steps complete?
- Backward compatibility maintained?
- New functionality works as expected?

**Done with Step 4 when:** Build succeeds, all tests pass, no blocking review issues, quality >= 80, all primary criteria met, integrations verified, state transition complete, confidence is high.

---

#### Step 5: Complete This Task

**Fill completion section** in task file:
```markdown
## Completion Notes (Post-Implementation)

### Implementation Summary
[Brief overview]

### Files Created/Modified
- `<WT>/src/[file]` - [Purpose]
- `<WT>/test/[file]` - [Coverage]

### Quality Verification Results
- All tests passing: [Yes/No]
- Code review: [Blocking issues resolved, minor noted]
- Integration verified: [Yes/No]
- Quality score: [N/100]

### Existing Code Leveraged
[Modules/utilities/patterns reused]

### New Patterns Established
[Conventions/utilities created for future tasks]

### Challenges Encountered
[What was harder than expected, how resolved]

### Completion Date
[YYYY-MM-DD]
```

**Update documentation if needed:**
- New user-facing features -> README.md usage examples
- New API endpoints -> API docs
- New configuration -> config docs
- New patterns -> architecture docs
- New dependencies -> setup/installation docs
- Commit: `git -C "<WT>" add README.md docs/ && git -C "<WT>" commit -m "docs: Update documentation for [task-name]"`

If no doc update needed: skip (not every task requires user-facing doc changes).

**Move task to completed:**
```bash
mv "<WT>/planning/tasks-pending/task-NNN-[name].md" "<WT>/planning/tasks-completed/task-NNN-[name].md"
```

Increment tasks_completed_count.

#### Step 6: Capture Learnings

Read/create `<WT>/planning/learnings.md`. Append:

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase3-learnings.md` and populate with task-specific insights.

Sections: Technical Insights, Reusable Patterns, Architecture Updates, Recommendations for Future Tasks.

IF significant architectural insights emerged: Also update `architecture.md`.

---

### BLOCKING QUALITY GATE: Task Reconciliation

**CANNOT proceed to Step 7 or start next task until ALL items checked.**

**Why this gate blocks:** If skipped, learnings won't propagate to future tasks, causing repeated mistakes and architectural drift.

**Reflect deeply:** What worked well? What was harder than expected? What patterns help remaining tasks? Did we discover anything that changes Phase 1-2 understanding?

**Mandatory Checklist:**

**1. Learnings Captured:**
- [ ] Technical Insights in learnings.md
- [ ] Reusable Patterns in learnings.md
- [ ] Architecture Updates in learnings.md
- [ ] Recommendations in learnings.md
- [ ] If architectural: architecture.md updated

**2. Planning Artifacts Updated:**
- [ ] Reviewed all tasks-pending/ for impact from this task's learnings
- [ ] Updated affected task files with new insights (approach changes, dependencies, complexity)
- [ ] If planning gaps: Updated relevant Phase 2 docs
- [ ] If scope changed: Updated GUIDE.md with deviation and rationale

**3. Next Task Prepared:**
- [ ] Identified next task from tasks-pending/ and read completely
- [ ] Confirmed next task doesn't depend on undiscovered learnings from this task
- [ ] If dependencies discovered: Updated next task file with new prerequisites

**4. Quality Verification:**
- [ ] All tests passing (unit + integration)
- [ ] Code review complete
- [ ] No blocking issues remain
- [ ] Quality score >= 80%

**5. Escalation Check:**
- [ ] IF architectural issues discovered: Raised to user for revision approval
- [ ] IF scope significantly changed: Documented in GUIDE.md and user informed
- [ ] IF blockers for future tasks: Identified and documented in affected task files

**ALL checked:** Proceed to Step 7.
**ANY unchecked:** STOP. Complete missing actions before proceeding.

---

#### Step 7: Announce Task Completion

Report to user:
```
Task {N} Complete: {name}
Progress: {completed}/{total} tasks
User Value: {feature delivered}
Implementation: {N} files, {M} tests passing, quality score {S}/100
Key Learnings: {most significant insight}
Next: {remaining} tasks remaining
```

### Loop Continuation

```bash
REMAINING=$(ls "<WT>/planning/tasks-pending/" | wc -l)
```

**IF REMAINING > 0:** Go back to Step 1: Select Next Task.

**ELSE (tasks-pending/ empty):** All tasks complete!

**Check for material changes (implementation vs planning alignment):**
IF implementation revealed issues with earlier planning:
- Present: description, affected artifact, options
- Options: (1) Update planning docs to match implementation (recommended), (2) Refactor implementation to match planning (expensive), (3) Document mismatch as tech debt
- Update GUIDE.md for Phase 3->4 transition:
  * "Phase 3 complete - all {total} tasks implemented successfully"
  * "Phase 3 -> Phase 4 Transition: All feature tasks complete. {total} vertical slices delivered. Captured learnings. Now reflect and prepare delivery."

Exit loop. Proceed to Phase 4.

**END WHILE**

---

## Phase 4: Reflection & Delivery

**Input:** All tasks-completed/*.md, learnings.md, quality-criteria.md, src/, test/, GUIDE.md
**Output:** `<WT>/docs/DELIVERY_SUMMARY.md`, `<WT>/docs/CRAFTING_WISDOM.md`, GUIDE.md final update

**Context Refresh:** Before reflection, read GUIDE.md for complete journey, review all completed tasks, check learnings.md, verify quality criteria met, review Phase 1->2->3 progression.

### Step 1: Retrospective Analysis

Read all completed tasks and learnings.md. Synthesize:
- What patterns emerged across tasks?
- What was the biggest challenge?
- What was the most important insight?
- What would you do differently next time?
- What reusable patterns were established?

### Step 2: Final Validation

Run complete test suite one final time:
```bash
cd "<WT>" && npx mocha test/**/*.test.js --reporter spec
```

Verify all criteria from quality-criteria.md: every primary criterion checked, final quality score, zero blocking issues.

Run any additional integration, performance, or validation tests.

### Step 3: Assemble Delivery Package

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase4-delivery-summary.md` and populate with project-specific content. Write to `<WT>/docs/DELIVERY_SUMMARY.md`.

### Step 4: Capture Wisdom

**Template**: Read `/Users/jameswiese/claude-craft/templates/craft/phase4-crafting-wisdom.md` and populate with project-specific content. Write to `<WT>/docs/CRAFTING_WISDOM.md`.

### Step 5: Present to User

**ALWAYS Update README.md** with: feature/task summary, usage examples if user-facing, setup/config changes, known limitations, updated TOC.

Present completion:
```
Crafting complete! Here's what was delivered:

Implementation: [summary] at <WT>/src/
Tests: <WT>/test/ ({count} tests, all passing)

Quality achieved:
- Primary criteria: 100% complete
- Quality score: {score}
- All tests passing
- Code review: {assessment}

Key files: [main implementation, tests, docs/DELIVERY_SUMMARY.md]
README.md updated

Notable decisions: [1-2 highlights]

Complete work in worktree at <WT>.
Would you like me to merge this back to {original_location} now?
```

**[WAIT for user confirmation]**

---

## Global End - Consolidation

**Merge crafted work** back to original location using merge-worktree subagent:

```
Task tool parameters:
  subagent_type: "merge-worktree"
  prompt: "Merge worktree from {worktree_path} with message
           'feat: [task name] - crafted over {N} iterations'
           Target branch: {original branch}
           Squash commits: yes
           Provide: merge status, conflicts, files changed, commit hash, cleanup status"
```

[WAIT for merge-worktree completion]

**Handle merge result:**

**IF successful:**
"Successfully merged to `{original_location}`. Files changed: {count}. Commit: {hash}. Worktree cleaned up. Changes ready to push."

**IF conflicts:**
"Merge completed with conflicts in: {files}. Worktree preserved.
To resolve: (1) Edit conflicted files in `{original_location}`, (2) `git add {files}`, (3) `git commit`, (4) `git worktree remove <WT>`"

**IF failed:**
"Merge failed: {error}. Worktree preserved.
To manually merge: (1) cd {original_location}, (2) `git merge {branch}`, (3) Resolve issues, (4) `git worktree remove <WT>`"

**Final summary:**
```
Crafting session complete.
Journey: {N} iterations, quality score {score}, {count} tests (all passing)
Artifacts: {file_count} implementation files, {test_count} test files, DELIVERY_SUMMARY.md, CRAFTING_WISDOM.md
```
