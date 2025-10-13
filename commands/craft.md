# /craft - Iterative Quality-Driven Development

Transform a task description into a complete, tested implementation through iterative crafting with measurable quality criteria.

---

## Input Parameters

- **[task]** - Task description (required): What you want to build or accomplish
- **[--context]** - Optional context files or references to incorporate
- **[--constraints]** - Optional constraints (time, resources, dependencies)

---

## Global Start - Framework Initialization

**Capture the starting point:**
Store the current working directory as `original_location`. This is where we'll return after crafting is complete.

**Create isolated workspace:**
Ask the create-worktree subagent to establish a new git worktree for this crafting session.

Provide these parameters:
- task_name: Derive a short kebab-case name from the task description
- base_branch: Current branch name from `original_location`

Tell the subagent to be verbose about what it does - we need to know:
- The exact worktree path that was created
- The branch name it's using
- Whether the worktree was successfully initialized
- Any git configuration it applied

[WAIT for create-worktree agent completion]

The create-worktree agent reported:
- Worktree path: [capture from agent output]
- Branch name: [capture from agent output]
- Status: [capture from agent output]

Based on what the agent told us:
- Set `<worktree>` variable to the path the agent created
- Set `worktree_branch` to the branch name
- Set `worktree_created` to true if successful
- If unsuccessful, stop here and report the error to the user

**Check for existing session (Context Rehydration):**

Before initializing new directories, check if we're resuming existing work:

Look for `<worktree>/planning/GUIDE.md`. If it exists, this is a resume/update situation:

1. **Read GUIDE.md** to understand current state:
   - What stages have been confirmed? (check "Knowledge Checkpoints" section)
   - What phase are we in? (check "Current State" section)
   - What decisions were made? (check "Decision History" section)
   - What files exist? (check "Key Documents Reference" section)

2. **Read all existing knowledge files** mentioned in GUIDE.md:
   - Read confirmed knowledge files: `<worktree>/planning/*.md` (use-cases, requirements, architecture, tooling, assumptions, effects-boundaries, task-definition)
   - Read journal files if needed for context: `<worktree>/planning/p1-*.md`, `<worktree>/planning/p2*.md`
   - Bring confirmed knowledge back into working context
   - Note: You're updating/adding to this work, not starting fresh

3. **Determine session mode automatically:**
   - If Phase 1 complete (6 stages confirmed): Resume at Phase 2 or Phase 3
   - If Phase 1 incomplete: Resume at last unconfirmed stage
   - If Phase 2/3 files exist: Continue implementation/iteration work
   - NO user prompting - automatically proceed based on what files exist

4. **Present rehydration summary:**
   Tell the user: "Resuming craft session. Found existing work through Stage [X]. Last confirmed: [insight]. Current phase: [phase]. Continuing with [next step]."

5. **Skip to appropriate section:**
   - If resuming Stage N: Jump to that stage's section below
   - If resuming Phase 2: Jump to Phase 2 section below
   - If resuming Phase 3: Jump to Phase 3 section below

If GUIDE.md doesn't exist, this is greenfield - proceed with directory initialization below.

**Establish directory structure:**
Create these directories in the worktree:
- `<worktree>/src/` - Implementation code
- `<worktree>/test/` - Mocha/Chai test files
- `<worktree>/planning/` - All planning artifacts (mostly FLAT structure)
- `<worktree>/planning/tasks-pending/` - Pending task files
- `<worktree>/planning/tasks-completed/` - Completed task files
- `<worktree>/docs/` - Documentation

**File organization principles:**

**Knowledge Files** (no prefix - timeless understanding):
- `<worktree>/planning/*.md` - Core knowledge: use-cases, requirements, architecture, tooling, assumptions, effects-boundaries, quality-criteria, test-plan, etc.
- These capture WHAT we understand and are referenced by later phases

**Journal Files** (p<N>- prefix - phase activity tracking):
- `<worktree>/planning/p1-*.md` - Phase 1 stage journals documenting exploration process
- `<worktree>/planning/p2*.md` - Phase 2/2-B/2-C/2-D planning journals
- These capture HOW we got there and are historical records

**Task Files** (organized in folders):
- `<worktree>/planning/tasks-pending/task-NNN-[name].md` - Tasks awaiting implementation
- `<worktree>/planning/tasks-completed/task-NNN-[name].md` - Tasks finished (moved from pending)

**State Tracking**:
- `<worktree>/planning/GUIDE.md` - Records all phase/stage transitions with timestamps and confirmations

**Create the master navigation guide** at `<worktree>/planning/GUIDE.md`:

```markdown
# Craft Session Guide: Your Knowledge Companion

## What This Document Is

Think of this as your memory and journal. If context gets compressed or you lose track of where you are, this document helps you reconstruct your understanding of the journey. It's not just a map of where you've been - it's a record of what you've learned and why.

## The Story So Far

**🌱 How We Began**
[This section grows as we progress through stages]

We started with an epic or task description, seeking to understand what needs to be built. As we explore each stage, we build deeper understanding, and this story expands to reflect our growing knowledge.

**What We've Learned:**
- Stage 1 taught us: [key insight about use cases - filled in when confirmed]
- Stage 2 revealed: [key insight about NFRs - filled in when confirmed]
- Stage 3 showed us: [key insight about architecture - filled in when confirmed]
- Stage 4 clarified: [key insight about assumptions - filled in when confirmed]
- Stage 5 helped us see: [key insight about effects - filled in when confirmed]
- Stage 6 synthesized: [key insight from integration - filled in when confirmed]

**User's Guidance Along the Way:**
[Record key feedback and corrections the user provided]

## Current Session State

**Phase & Stage Tracking:**
- **Current Phase:** [Phase 1 / Phase 2 / Phase 2-B / Phase 2-C / Phase 2-D / Phase 3 / Phase 4]
- **Current Stage/Step:** [Stage N / Planning Step / Task Loop Step / Delivery Step]
- **Status:** [In Progress / Awaiting User Confirmation / Blocked / Complete]
- **Last Updated:** [ISO timestamp]

**Active Files Being Worked On:**
- Primary: `<worktree>/planning/[filename]` - [brief status]
- Secondary: `<worktree>/planning/[filename]` - [brief status]

**Next Action Required:**
[Clear description of what needs to happen next - user review, agent work, iteration, etc.]

**Blockers or Open Questions:**
[List any items preventing progress or needing clarification]

---

## Phase/Stage Transition Log

This section records every transition between phases and stages with timestamps and confirmations.

**Template for Each Transition:**
```
### [Phase/Stage Name] → [Next Phase/Stage Name]
- **Timestamp:** [ISO 8601 timestamp]
- **Triggered By:** [User confirmation / Quality gate passed / Task completion]
- **Exit Criteria Met:** [Yes/No - specific criteria that were satisfied]
- **Key Outputs Created:** [List of files created or updated]
- **User Confirmation:** [Quote or summary of user's approval/feedback]
- **Notes:** [Any special circumstances or decisions made during transition]
```

**Transition History:**
[This section grows with each phase/stage transition - most recent first]

---

## Current State of Understanding

**Where We Are Right Now:**
Check the most recent knowledge file to see which phase we're working on:
- `<worktree>/planning/use-cases.md` → Understanding who will use this and what they'll do (Phase 1 Stage 1)
- `<worktree>/planning/requirements.md` → Understanding quality and functional requirements (Phase 1 Stage 2)
- `<worktree>/planning/architecture.md` → Understanding the existing landscape and how this fits (Phase 1 Stage 3)
- `<worktree>/planning/assumptions.md` → Making our assumptions explicit and validating them (Phase 1 Stage 4)
- `<worktree>/planning/effects-boundaries.md` → Understanding ripple effects and what we won't do (Phase 1 Stage 5)
- `<worktree>/planning/task-definition.md` → Bringing everything together into shared understanding (Phase 1 Stage 6)

If we're past Phase 1 (all stages confirmed):
- `<worktree>/planning/quality-criteria.md` exists → We've defined how to measure success (Phase 2)
- `<worktree>/planning/test-plan.md` exists → We've designed our test strategy (Phase 2-B)
- `<worktree>/planning/infrastructure-ids.md` exists → We've identified infrastructure needs (Phase 2-C)
- `<worktree>/planning/tasks-pending/task-*.md` exist → We've broken down work into tasks (Phase 2-D)
- `<worktree>/planning/tasks-completed/task-*.md` exist → We're executing and completing tasks (Phase 3)
- `<worktree>/planning/learnings.md` exists → We're capturing insights from completed tasks (Phase 3)

**Latest Confirmed Knowledge:**
Look for "✓ CONFIRMED" markers in knowledge files to see what's been validated.

**Phase/Stage Journals:**
Check journal files (p<N>- prefix) to see the exploration process:
- `<worktree>/planning/p1-stage1-journal.md` through `p1-stage6-journal.md` → Phase 1 stage exploration
- `<worktree>/planning/p2-planning-journal.md` → Phase 2 planning process
- `<worktree>/planning/p2b-test-design-journal.md` → Phase 2-B test design thinking
- `<worktree>/planning/p2c-infra-planning-journal.md` → Phase 2-C infrastructure planning
- `<worktree>/planning/p2d-task-breakdown-journal.md` → Phase 2-D task decomposition process

## Knowledge Checkpoints

These aren't just milestones - they're moments where understanding crystallized.

**Stage 1 - Use Cases: What Users Will Experience**
- **Knowledge File:** `<worktree>/planning/use-cases.md`
- **Journal File:** `<worktree>/planning/p1-stage1-journal.md` (exploration process)
- Confirmed: [date/time stamp when user confirmed]
- Core insight: [the key thing we learned about user needs]
- What surprised us: [unexpected discoveries]
- User's clarifications: [important feedback they provided]
- This shaped our understanding by: [how it influenced our mental model]

**Stage 2 - Requirements: What Quality Means Here**
- **Knowledge File:** `<worktree>/planning/requirements.md` (functional + non-functional)
- **Journal File:** `<worktree>/planning/p1-stage2-journal.md` (requirements discovery)
- Confirmed: [date/time]
- Core insight: [key learning about constraints and quality attributes]
- Trade-offs identified: [competing concerns we need to balance]
- This constrained our options by: [how it narrowed the solution space]

**Stage 3 - Architecture: How This Fits the World**
- **Knowledge File:** `<worktree>/planning/architecture.md`
- **Tooling File:** `<worktree>/planning/tooling.md` (discovery + integration)
- **Journal File:** `<worktree>/planning/p1-stage3-journal.md` (research and decisions)
- Confirmed: [date/time]
- Core insight: [key learning about existing systems and integration]
- Patterns discovered: [what already exists that we can use or must work with]
- Tooling discovered: [MCP servers, subagents, APIs, quality tools found during discovery]
- **Quality Gate:** Verify architecture supports all use cases and requirements from Stages 1-2. If gaps found, iterate architecture or revise earlier stages.
- This revealed: [implications for our approach]
- **Reference**: See "Tooling Philosophy" section in craft.md for methodology used during discovery

**Stage 4 - Assumptions: What We Think We Know**
- **Knowledge File:** `<worktree>/planning/assumptions.md`
- **Journal File:** `<worktree>/planning/p1-stage4-journal.md` (validation activities)
- Confirmed: [date/time]
- Core insight: [key learning about our confidence and risks]
- Critical assumptions: [the ones that matter most]
- This exposed: [where we might be wrong]

**Stage 5 - Effects & Boundaries: Ripples and Limits**
- **Knowledge File:** `<worktree>/planning/effects-boundaries.md`
- **Journal File:** `<worktree>/planning/p1-stage5-journal.md` (effects analysis)
- Confirmed: [date/time]
- Core insight: [key learning about second-order effects]
- Boundaries set: [what we explicitly won't do]
- This protected us from: [scope creep or unintended consequences]

**Stage 6 - Synthesis: The Complete Picture**
- **Knowledge File:** `<worktree>/planning/task-definition.md` (synthesized understanding)
- **Journal File:** `<worktree>/planning/p1-stage6-journal.md` (synthesis process)
- Confirmed: [date/time]
- Core insight: [the integrated understanding]
- Complete task definition created: `<worktree>/planning/task-definition.md`
- Ready for implementation: [yes/no and why]

## Decision History & Rationale

Understanding isn't just about what we decided - it's about why.

**Key Architectural Decisions:**
"We chose [approach] over [alternative] because [reasoning based on stages 1-3]."

**Scope Boundaries:**
"We explicitly decided not to [feature/approach] because [reasoning from stage 5]."

**Risk Acceptances:**
"We're accepting the risk that [assumption] might be wrong because [reasoning from stage 4]."

[This section expands as decisions are made and recorded]

## How to Progress Through This Journey

**The Progressive Understanding Philosophy:**
You're not marching through checklist items - you're building knowledge stage by stage. Each stage reveals something new, and sometimes what you learn forces you to revisit earlier understanding. That's natural and healthy.

**At Each Stage:**
1. **Ground yourself**: Read previous stage files to remember what you know
2. **Explore deeply**: Don't rush to answers - think about the questions
3. **Document reasoning**: Capture not just conclusions but why you reached them
4. **Present understanding**: Share discoveries with the user, invite their insight
5. **Iterate on feedback**: Their perspective may reveal what you missed
6. **Confirm before proceeding**: Only move forward when the layer is truly understood

**If You Discover Something That Changes Earlier Stages:**
This is learning, not failure. Explicitly acknowledge: "What I just learned in Stage X means Stage Y needs revision because [reason]." Revert to the earlier stage, update it with new understanding, get confirmation, then proceed forward again.

**Trust the Process:**
Six stages might seem like a lot, but each one adds crucial understanding. Rushing through them means building on a shaky foundation. Taking time here saves massive rework during implementation.

## If You Feel Lost

**First, Take a Breath:**
Context compression happens. It's okay. The knowledge you built isn't gone - it's captured in these files.

**Then Rebuild Context:**
1. Read "The Story So Far" above to rebuild the narrative
2. Check "Current State of Understanding" to locate yourself
3. Read the most recent stage file for detailed context about where you are
4. Review "Knowledge Checkpoints" to remember what each stage taught you
5. Look at "Decision History" to understand why things are the way they are

**Ask Yourself:**
- What are we building? (Look at task-definition.md if it exists, or the most recent stage files)
- What have we learned? (Review confirmed layer insights)
- What are we working on now? (Check the latest iteration or layer file)
- What are we trying to understand or build next? (Read the current stage guidance)

**Then Continue:**
You have enough context now. Trust what you've documented. Trust the process. Keep building understanding.

## Key Documents Reference

**Knowledge Files (Timeless Understanding - no prefix):**
- `<worktree>/planning/use-cases.md` - User journeys, actors, triggers, flows, outcomes (Stage 1)
- `<worktree>/planning/requirements.md` - Functional + non-functional requirements (Stage 2)
- `<worktree>/planning/architecture.md` - Technology decisions, integration patterns, system dependencies (Stage 3)
- `<worktree>/planning/tooling.md` - MCP servers, APIs, subagents, discovery + integration (Stage 3)
- `<worktree>/planning/assumptions.md` - Risk assessment, confidence levels, validation needs (Stage 4)
- `<worktree>/planning/effects-boundaries.md` - Second-order effects, scope limits, anti-cases (Stage 5)
- `<worktree>/planning/task-definition.md` - Complete synthesized understanding (Stage 6)
- `<worktree>/planning/quality-criteria.md` - Measurable success criteria (Phase 2)
- `<worktree>/planning/test-plan.md` - Test specifications and strategy (Phase 2-B)
- `<worktree>/planning/project-structure.md` - Directory layout, code organization (Phase 2-C)
- `<worktree>/planning/tech-relationships.md` - Component dependencies, data flow (Phase 2-C)
- `<worktree>/planning/infrastructure-ids.md` - Service IDs, endpoints, credentials (Phase 2-C)
- `<worktree>/planning/implementation-steps.md` - Task ordering, dependency phases (Phase 2-D)
- `<worktree>/planning/learnings.md` - Cumulative insights from completed tasks (Phase 3)
- `<worktree>/README.md` - Project overview, setup, usage (updated with each feature in Phase 3)

**Journal Files (Phase Activity Tracking - p<N>- prefix):**
- `<worktree>/planning/p1-stage1-journal.md` - Stage 1 use case exploration process
- `<worktree>/planning/p1-stage2-journal.md` - Stage 2 requirements discovery activities
- `<worktree>/planning/p1-stage3-journal.md` - Stage 3 architecture research and decisions
- `<worktree>/planning/p1-stage4-journal.md` - Stage 4 assumption validation experiments
- `<worktree>/planning/p1-stage5-journal.md` - Stage 5 effects analysis and boundary discussions
- `<worktree>/planning/p1-stage6-journal.md` - Stage 6 synthesis process and integration
- `<worktree>/planning/p2-planning-journal.md` - Phase 2 criteria definition process
- `<worktree>/planning/p2b-test-design-journal.md` - Phase 2-B test design thinking
- `<worktree>/planning/p2c-infra-planning-journal.md` - Phase 2-C infrastructure decisions
- `<worktree>/planning/p2d-task-breakdown-journal.md` - Phase 2-D task decomposition process

**Task Files (Organized in Folders):**
- `<worktree>/planning/tasks-pending/task-NNN-[name].md` - Tasks awaiting implementation
- `<worktree>/planning/tasks-completed/task-NNN-[name].md` - Completed tasks with outcomes

**State Tracking:**
- `<worktree>/planning/GUIDE.md` - Phase/stage transitions, session state, navigation aid

**Delivery Files:**
- `<worktree>/docs/delivery-summary.md` - Final delivery package (Phase 4)
- `<worktree>/docs/crafting-wisdom.md` - Reusable patterns and recommendations (Phase 4)

**Tooling Methodology:**
- See "Tooling Philosophy" section in craft.md for discovery and evaluation methodology
- `tooling.md` combines discovery (WHAT tools exist) + integration (HOW to use them)

## Progressive Stage Dependencies: How Knowledge Builds

Understanding isn't linear, but it does build:

**Stage 1 (Use Cases) is the foundation:** Everything else serves these user needs
**Stage 2 (Requirements) constrains Stage 1:** Quality attributes and functional requirements shape how use cases are fulfilled
**Stage 3 (Architecture) realizes Stages 1-2:** Technical approach serves use cases within constraints
**Stage 4 (Assumptions) validates Stages 1-3:** Making explicit what we're taking for granted
**Stage 5 (Effects & Boundaries) extends Stages 1-4:** Understanding ripples and boundaries
**Stage 6 (Synthesis) integrates Stages 1-5:** The complete, coherent understanding

**If Something Changes:**
When a stage reveals something that contradicts earlier stages, trace the dependency:
- New use case discovered? Update `use-cases.md` (Stage 1), potentially affects Stages 2-6
- New requirement/constraint identified? Update `requirements.md` (Stage 2), potentially affects Stages 3-6
- Different architecture needed? Update `architecture.md` or `tooling.md` (Stage 3), potentially affects Stages 4-6
- Assumption invalidated? Update `assumptions.md` (Stage 4), potentially affects Stages 5-6
- Boundary shifted? Update `effects-boundaries.md` (Stage 5), may affect Stage 6

Document these cascades explicitly in the relevant journal file (p1-stageN-journal.md). They're learning moments.

## File Manifest: Complete Project Structure

This section shows all files created during the craft process, organized by type.

**Directory Structure:**
```
<worktree>/
├── src/              # Implementation code
├── test/             # Test files
├── docs/             # Final delivery docs
│   ├── delivery-summary.md
│   └── crafting-wisdom.md
└── planning/         # All planning (MOSTLY FLAT)
    ├── GUIDE.md      # State recorder
    ├── *.md          # Knowledge files (15 files)
    ├── p1-*.md       # Phase 1 journals (6 files)
    ├── p2*.md        # Phase 2 journals (4 files)
    ├── tasks-pending/
    │   └── task-NNN-[name].md
    └── tasks-completed/
        └── task-NNN-[name].md
```

**Knowledge Files (15 files - no prefix, timeless understanding):**
1. `<worktree>/planning/use-cases.md` - User journeys, actors, triggers, flows, outcomes
2. `<worktree>/planning/requirements.md` - Functional requirements (from use-cases) + Non-functional requirements (performance, security, reliability, maintainability, scalability)
3. `<worktree>/planning/architecture.md` - Technology decisions, integration patterns, system dependencies, state transitions
4. `<worktree>/planning/tooling.md` - MCP servers, APIs, subagents, external services, integration approaches (combines discovery + integration)
5. `<worktree>/planning/assumptions.md` - Risk assessment, confidence levels, validation needs, what could be wrong
6. `<worktree>/planning/effects-boundaries.md` - Second-order effects, scope limits, anti-cases, what we explicitly won't do
7. `<worktree>/planning/task-definition.md` - Complete synthesized understanding (Stage 6 output)
8. `<worktree>/planning/quality-criteria.md` - Measurable success criteria, exit thresholds
9. `<worktree>/planning/test-plan.md` - Test specifications, categories, strategies
10. `<worktree>/planning/project-structure.md` - Directory layout, code organization, migration strategy
11. `<worktree>/planning/tech-relationships.md` - Component dependencies, data flow, interaction patterns
12. `<worktree>/planning/infrastructure-ids.md` - Service IDs, endpoints, credentials, rate limits, timeouts
13. `<worktree>/planning/implementation-steps.md` - Task ordering, dependency phases, prioritization principles
14. `<worktree>/planning/learnings.md` - Cumulative insights, reusable patterns, recommendations for future tasks
15. `<worktree>/README.md` - **ALWAYS updated** in Phase 3 Step 5 with each feature completion

**Journal Files (10 files - p<N>- prefix, phase activity tracking):**
1. `<worktree>/planning/p1-stage1-journal.md` - Stage 1 use case exploration process, decisions, user feedback
2. `<worktree>/planning/p1-stage2-journal.md` - Stage 2 requirements discovery, tooling needs analysis
3. `<worktree>/planning/p1-stage3-journal.md` - Stage 3 architecture research, technology scoring, alternatives considered
4. `<worktree>/planning/p1-stage4-journal.md` - Stage 4 assumption validation activities, experiments run
5. `<worktree>/planning/p1-stage5-journal.md` - Stage 5 effects analysis process, boundary discussions
6. `<worktree>/planning/p1-stage6-journal.md` - Stage 6 synthesis process, integration challenges
7. `<worktree>/planning/p2-planning-journal.md` - Phase 2 criteria definition process, scoring decisions
8. `<worktree>/planning/p2b-test-design-journal.md` - Phase 2-B test design thinking, edge case discovery
9. `<worktree>/planning/p2c-infra-planning-journal.md` - Phase 2-C infrastructure decisions, tooling integration planning
10. `<worktree>/planning/p2d-task-breakdown-journal.md` - Phase 2-D task decomposition process, dependency analysis

**Task Files (organized in folders, state in folder name):**
- `<worktree>/planning/tasks-pending/task-NNN-[name].md` - Tasks awaiting implementation
- `<worktree>/planning/tasks-completed/task-NNN-[name].md` - Completed tasks (moved from pending on completion)

**Navigation & State Tracking:**
- `<worktree>/planning/GUIDE.md` - Records all phase/stage transitions with timestamps, confirmations, and state tracking

**File Relationships:**
- use-cases.md → requirements.md (use cases drive functional requirements)
- requirements.md → architecture.md + tooling.md (requirements drive technology choices)
- architecture.md + tooling.md → infrastructure-ids.md (architecture defines infrastructure needs)
- tooling.md → Phase 2-C integration planning (discovery → integration)
- task-definition.md → quality-criteria.md + test-plan.md (understanding → measurement)
- quality-criteria.md → Phase 3 quality verification (criteria → validation)
- All knowledge files → GUIDE.md state tracking (knowledge → transition log)

**Total Files:** 15 knowledge + 10 journals + 1 GUIDE + N tasks + 2 delivery docs = 28+ files

## Remember

This is iterative quality-driven development. The goal isn't to complete phases quickly - it's to build something that works and makes sense, grounded in deep understanding. Take the time to understand deeply. The code will come easier when the understanding is clear.
```

**⚠️  PATH DISCIPLINE REMINDER:**
All file operations MUST use `<worktree>` as the path prefix.
All git operations MUST use: `git -C "<worktree>" [command]`

Examples:
- Write file: `"<worktree>/planning/task-definition.md"`
- Create directory: `"<worktree>/src/"`
- Git command: `git -C "<worktree>" status`
- Read file: `"<worktree>/test/module.test.js"`

Never use relative paths. Never use `cd`. Always specify full paths with `<worktree>`.

---

## Phase 1: Progressive Understanding Through Quality Gates

**📝 Documentation Output:**
- **Knowledge Files Created:** `<worktree>/planning/use-cases.md`, `<worktree>/planning/requirements.md`, `<worktree>/planning/architecture.md`, `<worktree>/planning/tooling.md`, `<worktree>/planning/assumptions.md`, `<worktree>/planning/effects-boundaries.md`, `<worktree>/planning/task-definition.md`
- **Journal Files Created:** `<worktree>/planning/p1-stage1-journal.md` through `p1-stage6-journal.md`
- **State Tracking:** `<worktree>/planning/GUIDE.md` updated with stage transitions and confirmations
- **Purpose:** Build deep understanding of user needs, quality requirements, technical landscape, risks, and boundaries through 6 progressive stages
- **Referenced By:** Phase 2 (quality criteria, test planning), Phase 2-C (infrastructure), Phase 2-D (task decomposition), Phase 3 (implementation planning)

---

**📖 Context Grounding: Review GUIDE.md for the Philosophy**

Before diving into the layers, take a moment to ground yourself. The GUIDE.md document you just created explains how to navigate this journey if you lose context. Remember: you're not rushing through checkboxes - you're building deep understanding that will make implementation clearer and easier.

**What Phase 1 Is Really About:**

Think of this as building a foundation progressively. We don't frame the house until the foundation is solid, and we don't start implementation until understanding is complete. But more than that - this is about building *shared* understanding with the user. Each stage is a conversation, not a presentation. You present what you've learned, they correct or confirm, and understanding deepens.

**The Six Stages Ahead:**

1. **Use Cases** - Understanding what users will experience
2. **NFRs** - Understanding what quality means for this solution
3. **Architecture** - Understanding the existing landscape and how this fits
4. **Assumptions** - Making our assumptions explicit and validating them
5. **Effects & Boundaries** - Understanding ripple effects and what we won't do
6. **Synthesis** - Bringing everything together into shared understanding

Each stage builds on confirmed previous stages. If something changes in Stage 3 that affects Stage 1, you'll explicitly revert and rebuild. That's not backtracking - that's learning.

**Your Mindset for This Phase:**

You're an explorer, not an architect (yet). Your job is to understand the territory before designing the solution. Ask questions. Research deeply. Challenge assumptions. Document reasoning, not just conclusions. And most importantly - listen to the user's feedback. They know things you don't.

**Initialize progressive tracking:**
- current_stage = 1
- total_stages = 6
- stages_confirmed = []

---

## Stage Execution Pattern (Reference for Stages 1-6)

Each stage in Phase 1 follows this approach. When you reach a stage, follow this pattern with stage-specific exploration guidance.

**📖 Context Grounding:**
If uncertain where you are or context slips, reference GUIDE.md → "How to Progress Through This Journey"

**Position Yourself:**
- **Progress:** Stage X of 6 - [Phase name]
- **Where you are in the journey:** What you're building on from previous stages
- **What this stage reveals:** The deeper purpose beyond the surface task
- **How it connects:** Dependencies on previous stages, impacts on future stages

**Explore with Stage-Specific Intent:**
[Each stage provides specific exploration questions and considerations below]

**Document with Reasoning:**
**Document to Knowledge File** (`<worktree>/planning/[stage-name].md`) and **Journal File** (`<worktree>/planning/p1-stageN-journal.md`):
- Core findings and discoveries
- **Your reasoning:** Not just conclusions, but WHY you reached them
- Confidence levels: HIGH/MEDIUM/LOW for assumptions
- Open questions and uncertainties

**Present and Confirm:**
Present discoveries conversationally to user
→ Ask Quality Gate Question
→ **[WAIT for user response]**

**Process User Response:**

**IF confirmed** (words like "yes", "looks good", "confirmed", "correct", "proceed to stage X+1"):
  → Document confirmation to stage file
  → Update GUIDE.md per standard protocol (see "GUIDE.md Update Protocol" below)
  → Add "Stage X" to stages_confirmed
  → Announce: "✓ Stage X confirmed. Moving to Stage Y..."
  → Move to next stage

**IF feedback provided** (corrections, additions, questions):
  → Incorporate user insights
  → Update documentation with new understanding
  → Re-present updated findings
  → Iterate until confirmed

---

## GUIDE.md Update Protocol

When a stage is confirmed, update `<worktree>/planning/GUIDE.md`:

**Section: "The Story So Far" → "What We've Learned":**
Add line using stage-appropriate verb:
- "Stage 1 taught us: [1-2 sentence core insight]"
- "Stage 2 revealed: [1-2 sentence core insight]"
- "Stage 3 showed us: [1-2 sentence core insight]"
- "Stage 4 clarified: [1-2 sentence core insight]"
- "Stage 5 helped us see: [1-2 sentence core insight]"
- "Stage 6 synthesized: [1-2 sentence core insight]"

**Section: "Knowledge Checkpoints" → "Stage X":**
Fill in template with:
- Confirmed: [timestamp]
- Core insight: [key learning from this stage]
- What surprised us: [unexpected discoveries]
- User's clarifications: [important feedback they provided]
- How it shaped understanding: [influence on mental model]

**Section: "Decision History & Rationale":**
Add key decisions made during this stage with reasoning

**Section: "Current State of Understanding" → "Latest Confirmed Knowledge":**
Mark stage complete, update any open questions

**Phase 2, Phase 3, and Phase 4 Confirmations:**

The above protocol covers Phase 1 stages. For other phases:

**Phase 2/2-B/2-C/2-D:** Update "Current Session State" (phase, timestamp, active files, next action) and add transition log entry documenting phase completion, key outputs, and planning decisions.

**Phase 3 Task Completions:** After each task, update "Current Session State" and add task completion entry to transition log with learnings, quality score, iterations, and technical decisions.

**Phase 4 Delivery:** Mark project complete in "Current Session State", add final transition log entry summarizing delivery, total tasks, successes, and lessons learned.

---

## Journal File Pattern (Reference for All Stages and Phases)

**Purpose:** Journal files capture the TEMPORAL PROCESS - how we arrived at understanding, not just what we understand. They record the journey: questions asked, decisions made, alternatives considered, user feedback received, and uncertainties resolved.

**When to Create/Update Journal Files:**
- **CREATE** journal file at the START of any stage/phase (Status: In Progress)
- **UPDATE** journal DURING the stage/phase as exploration happens
- **FINALIZE** journal at END of stage/phase (Status: Complete) with completion timestamp

**Standard Journal File Structure:**

All journal files (Phase 1 stages, Phase 2 variants, Phase 3 tasks) should follow this consistent pattern:

```markdown
# [Stage/Phase Name] Journal

**Date Started:** [ISO timestamp]
**Date Completed:** [ISO timestamp or "In Progress"]
**Status:** [In Progress | Complete]

## Exploration Questions
Document the questions that drove exploration:
- [What did we need to understand?]
- [What clarifications were needed from user?]
- [What ambiguities did we uncover?]
- [What research was necessary?]

## Decisions Made
For each significant decision:
- **Decision:** [The choice made]
  - **Reasoning:** [Why this choice over alternatives?]
  - **Alternatives Considered:** [What else did we evaluate?]
  - **User Input:** [Did user guide or confirm this decision?]
  - **Confidence:** [High/Medium/Low confidence level]
  - **Impact:** [How does this decision affect later work?]

## User Feedback and Interactions
Chronological record of user engagement:
- **[Timestamp] User Feedback:** [What user said]
  - **Context:** [What we presented that triggered this feedback]
  - **Impact:** [How this changed our understanding or direction]
  - **Action Taken:** [What we did in response]

## Alternatives Explored
For each alternative approach considered but not selected:
- **Alternative:** [The option considered]
  - **Pros:** [Benefits of this approach]
  - **Cons:** [Drawbacks or limitations]
  - **Why Not Selected:** [Reason for rejecting]
  - **Could Revisit If:** [Conditions under which this might become preferable]

## Uncertainties and Resolutions
Track unknowns and how they were addressed:
- **Uncertainty:** [What we weren't sure about]
  - **Why Uncertain:** [Source of uncertainty]
  - **Resolution Approach:** [User clarification | Research | Assumption | Experiment]
  - **Resolution:** [How it was resolved]
  - **Confidence in Resolution:** [High/Medium/Low]
  - **Risk if Wrong:** [Impact if our resolution proves incorrect]

## Key Insights and Learnings
Important realizations discovered during this stage/phase:
- [Insight about user needs, technical constraints, architecture patterns]
- [Patterns noticed that weren't obvious at the start]
- [Complexities or simplicities discovered]
- [Connections between requirements/use cases/architecture]

## Iteration History
If this stage/phase required multiple iterations:
- **Iteration 1:** [Initial approach and outcome]
  - **What Changed:** [User feedback or new information]
  - **Why Iterated:** [Reason for not accepting first pass]
- **Iteration 2:** [Revised approach and outcome]
  - **Improvements:** [What was better in this iteration]

## Blockers Encountered
Any obstacles during this stage/phase:
- **Blocker:** [What prevented progress]
  - **Resolution:** [How it was unblocked]
  - **Time Impact:** [Delay caused]
  - **Learning:** [What this blocker taught us]

## References and Research
External resources consulted:
- [Documentation links]
- [API references]
- [Example projects or patterns]
- [Technical articles or papers]

## Completion Criteria Met
At stage/phase end, verify completion:
- [ ] All quality gates passed
- [ ] User confirmed/approved
- [ ] Knowledge files updated
- [ ] GUIDE.md updated with confirmation
- [ ] Transition to next stage/phase recorded
```

**Stage/Phase-Specific Journal Adaptations:**

- **Phase 1 Stages:** Focus on exploration, research, user clarification
- **Phase 2 Variants:** Focus on planning decisions, test design, infrastructure choices
- **Phase 3 Task Journals:** Focus on implementation approach, test results, iterations, learnings
- **Phase 4:** Focus on retrospective insights, delivery decisions, wisdom captured

**Journal File Naming:**
- Phase 1 stages: `p1-stage[N]-journal.md` (e.g., `p1-stage1-journal.md`)
- Phase 2 variants: `p2-planning-journal.md`, `p2b-test-design-journal.md`, `p2c-infra-planning-journal.md`, `p2d-task-decomp-journal.md`
- Phase 3: Task-specific journals in task completion notes (stored in `<worktree>/planning/tasks-completed/task-NNN-[name].md`)
- Phase 4: `p4-reflection-journal.md`

---

### Stage 1: Epic Understanding & Core Use Cases

**📥 Input Files:**
- User's epic/task description (from initial request)
- `<worktree>/planning/GUIDE.md` (if resuming session)

**📤 Output Files:**
- `<worktree>/planning/use-cases.md` (knowledge file - user journeys, actors, triggers, flows, outcomes)
- `<worktree>/planning/p1-stage1-journal.md` (journal file - exploration process, decisions, user feedback)
- `<worktree>/planning/GUIDE.md` (updated with Stage 1 confirmation and transition log)

---

**Rehydrate Stage Context (if file exists):**

Check for `<worktree>/planning/use-cases.md`. If it exists:
- Read the file to recall existing use case exploration
- Note what user journeys were already identified
- Note what variations and edge cases were documented
- You're updating/adding to this work based on new task requirements
- Build upon what exists, don't start fresh

If the file doesn't exist, this is your first exploration of Stage 1.

**Follow Stage Execution Pattern** with these specifics:

**Position (Stage 1 of 6 - Foundation):**
- You're at the very beginning - transforming abstract goals into concrete user stories
- This reveals the *experience* we're creating, not just features
- Foundation for everything that follows - quality, architecture, assumptions, boundaries

**Think like a user, not a developer.** Put yourself in their shoes. Walk through their day.

**Start with the primary user journey - the canonical happy path:**
- What event or need triggers this workflow? (e.g., "User receives invoice email")
- What sequence of actions does the user take? (e.g., "Opens email, clicks 'Process', reviews details")
- What information do they see and interact with at each step?
- What indicates successful completion? (e.g., "Invoice logged, confirmation shown")
- How does this make their life better?

**Then consider alternative flows - reality has variations:**
- What different paths might users take to accomplish the same goal?
- What optional features or shortcuts would power users want?
- What simpler paths might occasional users prefer?
- What conditional branches exist? ("If payment is over $1000, then...")

**Finally identify exception flows - things go wrong:**
- At each step of the primary flow, what could fail? What errors could occur?
- How should the system respond to each failure? (Graceful degradation? Retry? Alert?)
- What recovery options make sense? (Undo? Resume? Reset?)
- What should be explicitly prevented or rejected? (Invalid states, security violations)

**Consider automation and tooling opportunities - what could help?**

Think about tooling categories that might assist with this use case:

- Are there domain-specific APIs involved? (GitHub, Slack, databases, cloud services)
- Would browser automation help test or validate this workflow?
- Does this involve file operations that could benefit from AI assistance?
- Are there specialized operations that existing tools handle well?
- What manual steps could be automated to improve quality or speed?

If you identify tooling needs during use case exploration, note them with categories (browser automation, file operations, database access, API integration). Stage 3 (Architecture) will research specific tools and document integration approaches.

**Expand with inferred use cases - think through what's implied but not stated:**

Many use cases imply additional functionality that users expect but may not explicitly state. Proactively identify and document these:

1. **UI Patterns and Interactivity:**
   - **Lists and Collections:** If UI shows lists of items, consider:
     - Should users be able to sort? (by date, name, priority, status)
     - Should users be able to filter? (by category, status, date range)
     - Should users be able to search? (text search, advanced filters)
     - Pagination or infinite scroll for large datasets?
     - Bulk operations? (select multiple items, batch actions)

2. **API and Authentication Considerations:**
   - **API Access:** Does this need an API? If so:
     - Authentication approach? (API keys, OAuth 2.0, JWT tokens)
     - Authorization model? (role-based, resource-based, user-scoped)
     - Rate limiting? (prevent abuse, ensure fair usage)
     - API versioning? (v1, v2, deprecation strategy)
   - **Third-party Integration:** OAuth flows? Webhook handlers? Token refresh?

3. **Server Architecture and Scale:**
   - **Immediate vs Scale:** Critical decision about user experience:
     - **Immediate responses** (< 200ms): Limits scale but maximizes experience (good for prototypes, MVP, small user base)
     - **Scalable architecture** (> 1s responses): Supports growth but adds complexity (queues, workers, async processing)
     - Consider: How many users? How much data? Growth trajectory?
     - Document tradeoff: "Optimize for immediate feedback (< 100 users) OR design for scale (> 10K users)"

4. **UI Styling Philosophy:**
   - **Style Direction:** What aesthetic and UX patterns fit best?
     - **Cursor.com style:** Clean, minimal, developer-focused, fast interactions
     - **Gemini style:** Rich, colorful, consumer-friendly, explanatory UI
     - **Simple vs Complex:** Simple (faster to build, easier to maintain) vs Complex (more attractive, more features, slower development)
     - Consider: User technical level? Brand expectations? Development timeline?
     - Document preference: "Prioritize simplicity (MVP speed) OR invest in polish (market differentiation)"

5. **Feature Completeness Questions:**
   - **CRUD completeness:** If Create exists, should Read/Update/Delete also exist?
   - **History and Audit:** Should users see action history? Undo capability?
   - **Export and Import:** Can users get their data out? Import from elsewhere?
   - **Notifications:** When should users be notified? Email? In-app? Push?
   - **Help and Guidance:** Tooltips? Documentation? Onboarding flows?
   - **Accessibility:** Screen readers? Keyboard navigation? High contrast modes?

**For each inferred use case identified:**
- Document it explicitly in use-cases.md with "Inferred from [primary use case]"
- Note if it's essential for MVP or could be deferred to future iterations
- Identify any uncertainties requiring user confirmation
- Consider impact on architecture and implementation complexity

**Example:**
```
Primary Use Case: "User views list of invoices"

Inferred Use Cases:
✓ User sorts invoice list by date/amount/status (Essential - expected behavior)
✓ User filters invoices by date range (Essential - large lists unusable without filtering)
✓ User searches invoices by vendor name (Nice-to-have - could defer to v2)
✓ User exports invoice list to CSV (Nice-to-have - common request, easy to add)

API Authentication Decision Needed:
- If public API: OAuth 2.0 for third-party apps
- If internal API: JWT tokens with user session
→ Document as uncertainty for Stage 2 requirements

UI Style Decision:
- Cursor-style minimal: Fast to build, clean, developer-friendly
- vs Complex dashboard: More attractive but 2-3x development time
→ Present options to user for preference
```

**Document (Knowledge File)** to `<worktree>/planning/use-cases.md`:
- Tell user's story with vivid, concrete scenarios (use Given-When-Then if helpful)
- Include: actors, triggers, flows, outcomes, variations, exceptions
- Document reasoning: Why these use cases? Confidence level? Uncertainties?

**Document (Journal File)** to `<worktree>/planning/p1-stage1-journal.md`:

**Follow the standard Journal File Pattern** (see "Journal File Pattern" section above) with Stage 1 focus:
- Exploration questions about user needs and use cases
- Decisions about which use cases to prioritize
- User feedback on use case understanding
- Uncertainties about user journeys and resolutions
- Key insights about user experience and workflows

Create journal at stage START, update DURING exploration, finalize at stage END.

**Present conversationally:**
"📋 **Stage 1: Epic Understanding & Use Cases** (Progress: 1/6)

[Present primary use case, alternative flows, exception handling]

**Quality Gate:** Do these use cases capture what you want to build?"

→ Follow Stage Execution Pattern for confirmation/feedback processing
→ Update GUIDE.md per standard protocol (add transition log entry with timestamp and confirmation)

---

### Stage 2: Functional and Non-Functional Requirements

**📥 Input Files:**
- `<worktree>/planning/use-cases.md` (Stage 1 output - use cases drive requirements)
- `<worktree>/planning/GUIDE.md` (session state and Stage 1 confirmation)

**📤 Output Files:**
- `<worktree>/planning/requirements.md` (knowledge file - functional + non-functional requirements)
- `<worktree>/planning/p1-stage2-journal.md` (journal file - requirements discovery process, tooling needs)
- `<worktree>/planning/GUIDE.md` (updated with Stage 2 confirmation and transition log)

---

**Rehydrate Stage Context (if file exists):**

Check for `<worktree>/planning/requirements.md`. If it exists:
- Read the file to recall existing requirements analysis (both functional and non-functional)
- Note what functional requirements were derived from use cases
- Note what quality attributes (NFRs) were already identified
- Note what tooling needs were documented
- You're updating/adding to this work based on new requirements
- Build upon what exists, don't start fresh

If the file doesn't exist, this is your first exploration of Stage 2.

**Follow Stage Execution Pattern** with these specifics:

**Position (Stage 2 of 6 - Building on Foundation):**
- Building on Stage 1 use cases - understanding what "quality" means
- NFRs are invisible forces that shape solutions (10s vs 100ms changes architecture)
- Constrains Stage 1, guides Stage 3 architecture choices

**Think about what could go wrong, not just what should work.** Quality is often defined by limits and boundaries.

**Consider performance needs - what does "fast enough" mean?**
- How fast should operations complete? (1 second? 100ms? It matters.)
- What's the expected data volume? (10 records or 10 million?)
- Are there user-facing operations that feel slow if not instant?
- What wait times frustrate users versus feel reasonable?

**Think about security requirements - what assets are at risk?**
- What data needs protection? What's the impact if it's exposed?
- Who should have access to what? What roles and permissions make sense?
- What inputs are dangerous if not validated? (SQL injection? XSS?)
- Are there compliance requirements (GDPR, HIPAA) or data privacy laws?

**Analyze reliability expectations - what happens when things fail?**
- How critical is uptime? Can users tolerate occasional downtime?
- What's an acceptable error rate? (1 error per 1000 operations? 1 per million?)
- Should operations be idempotent? (Can they safely run twice?)
- What recovery mechanisms matter? (Automatic retry? Manual intervention? Graceful degradation?)

**Assess maintainability goals - who comes after you?**
- Who will maintain this code? What's their skill level and context?
- How should it be documented? What would a future developer need to know?
- What testing approach makes sense for this kind of system?
- What makes code "readable" and "maintainable" in this context?

**Evaluate scalability needs - does this grow?**
- Will load increase over time? What's the growth trajectory?
- What resources constrain scaling? (CPU? Memory? Database connections? API rate limits?)
- What optimizations matter now versus later? (Premature optimization is real, but so is painting yourself into a corner)

**Consider tooling and automation for quality validation:**

Quality requirements need verification tooling. For each NFR, ask:

**What needs automated validation?**
- Which quality attributes can be tested programmatically?
- What manual verification could be automated?
- Where are quality gates enforcement points?

**What tooling categories might help?**
- Testing & validation automation (browser, API, E2E)
- Performance monitoring & profiling
- Security scanning & vulnerability detection
- Compliance validation
- Code quality analysis

**Discovery directive for Stage 3:**
Document in NFR file which quality attributes need tooling support. Stage 3 will:
- Search for available MCP servers matching these needs
- Identify relevant Claude Code subagents
- Research domain-specific APIs and tools
- Evaluate integration approaches

Mark tooling needs as HIGH/MEDIUM/LOW priority based on automation value.

**Document (Knowledge File)** to `<worktree>/planning/requirements.md`:

**Functional Requirements Section:**
- Requirements derived directly from Stage 1 use cases
- What the system must do to fulfill each use case
- Clear, testable statements

**Non-Functional Requirements Section:**
- Make quality attributes concrete and measurable ("200ms 95th percentile", not "fast")
- Organize by: Performance, Security, Reliability, Maintainability, Scalability
- Document reasoning: Why these thresholds? What trade-offs?

**Document (Journal File)** to `<worktree>/planning/p1-stage2-journal.md`:

**Follow the standard Journal File Pattern** (see "Journal File Pattern" section above) with Stage 2 focus:
- Requirements discovery process: questions asked, analysis performed
- Decisions about functional and non-functional requirements
- Tooling needs identified and prioritization reasoning
- User feedback and clarifications about requirements
- Key insights about quality constraints and system requirements

Create journal at stage START, update DURING requirements analysis, finalize at stage END.

**Present conversationally:**
"⚙️ **Stage 2: Functional and Non-Functional Requirements** (Progress: 2/6)

[Present Functional Requirements first, then Performance, Security, Reliability, Maintainability, Scalability requirements]

**Quality Gate:** Are these the right requirements and constraints?"

→ Follow Stage Execution Pattern for confirmation/feedback processing
→ Update GUIDE.md per standard protocol (add transition log entry with timestamp and confirmation)
→ If requirements significantly affect Stage 1, may need to revert and update use cases

---

### Stage 3: Architectural Research & Context

**📥 Input Files:**
- `<worktree>/planning/use-cases.md` (Stage 1 output - what needs to be built)
- `<worktree>/planning/requirements.md` (Stage 2 output - functional + quality requirements)
- `<worktree>/planning/GUIDE.md` (session state and Stage 1-2 confirmations)

**📤 Output Files:**
- `<worktree>/planning/architecture.md` (knowledge file - technology decisions, integration patterns, system dependencies)
- `<worktree>/planning/tooling.md` (knowledge file - MCP servers, APIs, subagents, discovery + integration approaches)
- `<worktree>/planning/p1-stage3-journal.md` (journal file - research process, alternatives considered, scoring)
- `<worktree>/planning/GUIDE.md` (updated with Stage 3 confirmation and transition log)

---

**Rehydrate Stage Context (if files exist):**

Check for `<worktree>/planning/architecture.md` and `<worktree>/planning/tooling.md`:
- If architecture file exists: Read to recall systems, patterns, technologies, integration points
- If tooling file exists: Read to recall MCP servers, subagents, APIs, quality tools discovered + integration approaches
- Note what was documented and what confidence levels were assigned
- You're updating/adding to this work based on new insights
- Build upon what exists, don't start fresh

If files don't exist, this is your first exploration of Stage 3.

**📖 Context Reminder:** You're building on confirmed Layers 1 (use cases) and 2 (NFRs). If context is fading, GUIDE.md section "Progressive Stage Dependencies" shows how architecture realizes use cases within constraints.

**Progress: Stage 3 of 6 - Technical Foundation**

**Where We Are in the Journey:**
**Follow Stage Execution Pattern** with these specifics:

**Position (Stage 3 of 6 - Discovering the Landscape):**
- Building on validated use cases (Stage 1) and quality constraints (Stage 2)
- This reveals the existing landscape your solution must fit into
- Your architecture must fulfill Stage 1 while meeting Stage 2 constraints
- Discovery here shapes design decisions in Phase 2

**Think like an archaeologist, not an architect.** You're discovering what exists before you design what's new.

**Analyze the systems landscape - what's already out there?**
- What existing systems will this interact with? What are their contracts and expectations?
- What APIs, databases, or services exist? What can they do and what can't they do?
- What are the failure modes? (Does the database go read-only under load? Does the API rate-limit?)

**Use grep/ripgrep to discover existing patterns - learn from what's already there:**
- Search for similar functionality: Has someone solved a related problem?
- Find integration patterns: How do other parts of the code talk to these systems?
- Look for error handling: What patterns exist for dealing with failures?
- Discover testing approaches: How are similar components tested?

**Read relevant files to understand context - don't reinvent wheels:**
- What architectural patterns dominate this codebase? (MVC? Layered? Event-driven?)
- Are there similar implementations you can learn from or extend?
- What configuration do similar features require?
- Where are the integration points? How do they work?

**Research technology choices deeply - understand the options and trade-offs:**

For each significant technology decision needed to fulfill use cases and requirements:

1. **Identify key questions that must be answered:**
   - What are the core capabilities needed?
   - What are the constraints (performance, compatibility, licensing)?
   - What's the team's familiarity with different options?
   - What's the long-term maintenance story?

2. **Research available options:**
   - What technologies solve this problem?
   - What are their strengths and limitations?
   - How mature and stable are they?
   - What's the community and ecosystem like?

3. **Make reasonable assumptions when answers aren't clear:**
   - State the assumption explicitly
   - Note your confidence level (HIGH/MEDIUM/LOW)
   - Document what would make this assumption invalid
   - If confidence is LOW, prompt the user for clarification

4. **Compare trade-offs:**
   - Performance vs. simplicity
   - Flexibility vs. convention
   - Cutting-edge vs. proven
   - Learning curve vs. capability

**Technology Gap Analysis & Research:**

**Identify missing architectural needs based on use cases:**

Review Stage 1 use cases and Stage 2 requirements to identify technology gaps:

```bash
# Review use cases to identify technology needs
cat "<worktree>/planning/use-cases.md"

# Review requirements for quality and functional requirements
cat "<worktree>/planning/requirements.md"
```

**For each use case, determine:**
- **Already Decided Technologies:** What technologies/APIs/MCPs have been pre-selected or mandated?
- **Technology Gaps:** What capabilities are needed but not yet covered?
- **Complexity Requirements:** Does the use case require comprehensive frameworks or can it use minimal libraries?

**Philosophy: Prefer Small, Standalone, Stateless:**
- **Small:** Minimal footprint, focused purpose, easy to understand
- **Standalone:** Few dependencies, self-contained, doesn't require heavy runtimes
- **Stateless:** Pure functions where possible, easier to test and reason about

**BUT:** Let use cases determine extent. Complex use cases may require comprehensive solutions.

**Research available technology options:**

**1. GitHub Research:**
Search GitHub for relevant projects and libraries:
```
Site search: "site:github.com [technology-need] [language]"
Examples:
- "site:github.com lightweight json validator javascript"
- "site:github.com minimal http client node"
- "site:github.com stateless authentication library"
```

**Evaluate GitHub repositories:**
- **Stars:** 1000+ (popular), 100-1000 (established), <100 (emerging)
- **Recent activity:** Last commit within 3 months (active) vs. abandoned
- **Issues vs. PRs:** High closed/open ratio = responsive maintainers
- **Dependencies:** Fewer is better (prefer standalone)
- **Size:** Check repository size and bundle size
- **TypeScript support:** Native TypeScript or quality type definitions?

**2. Reddit Research:**
Search relevant subreddits for real-world experiences:
```
Communities: r/javascript, r/typescript, r/node, r/webdev, r/programming
Search: "[technology need] recommendations"
Look for: Recent discussions (last 6-12 months), user experiences, gotchas, alternatives
```

**What to extract from Reddit:**
- **Real-world pain points:** What issues do developers actually encounter?
- **Alternatives mentioned:** What options do practitioners recommend?
- **Trending technologies:** What's gaining mindshare in the community?
- **Warnings:** What technologies should be avoided and why?

**3. NPM/Package Registry Research (if applicable):**
```bash
# Search npm registry
npm search [technology-need] --parseable

# Check package details
npm view [package-name] --json | jq '{name,version,dependencies,devDependencies,license}'
```

**Score and rank options:**

For each technology option discovered, assign scores (0-10) for:

**Quality Score:**
- **Maturity:** 0=alpha, 5=stable, 10=battle-tested
- **Documentation:** 0=sparse, 5=adequate, 10=comprehensive
- **Test Coverage:** 0=none, 5=basic, 10=extensive
- **Maintenance:** 0=abandoned, 5=occasional, 10=active
- **Community:** 0=solo, 5=small team, 10=large community

**Trending Score:**
- **GitHub stars growth:** Check star history (accelerating vs. declining)
- **Download trends:** npm downloads trending up or down?
- **Recent mentions:** Reddit/Twitter/blogs discussing recently?
- **Adoption:** Major companies/projects using it?
- **Momentum:** 0=declining, 5=stable, 10=rapidly growing

**Philosophy Alignment Score:**
- **Size:** 0=massive, 5=moderate, 10=tiny
- **Dependencies:** 0=many, 5=few, 10=zero/peer only
- **Statefulness:** 0=stateful/complex, 5=mixed, 10=pure/stateless
- **Complexity:** 0=steep learning, 5=moderate, 10=simple API

**Total Score = (Quality × 0.4) + (Trending × 0.3) + (Philosophy × 0.3)**

**Document research findings:**

Create a technology comparison table in `<worktree>/planning/architecture.md`:

```markdown
## Technology Gap Analysis

### Pre-Decided Technologies
- [List technologies already selected/mandated]
- [Note why they were pre-selected]

### Identified Gaps
1. **[Gap Name]:** [Description of missing capability]
   - **Use Case Requirements:** [Which use cases need this]
   - **Complexity Level:** [Minimal/Moderate/Comprehensive needed]

### Technology Research & Scoring

#### [Gap Name] Solutions

| Option | Quality | Trending | Philosophy | Total | Notes |
|--------|---------|----------|------------|-------|-------|
| [Library A] | 8.5 | 7.0 | 9.5 | 8.4 | GitHub 15k★, active, zero deps, pure functions |
| [Library B] | 9.0 | 9.0 | 4.0 | 7.5 | GitHub 50k★, trending up, many deps, complex API |
| [Library C] | 6.0 | 3.0 | 10.0 | 6.1 | GitHub 500★, declining, standalone, simple but immature |

**Recommendation:** [Library A] - Best balance of quality and philosophy alignment
**Rationale:** [Explain why this choice fits use cases and constraints]
**Confidence:** [HIGH/MEDIUM/LOW]
**Alternative if issues:** [Library B as fallback if A proves insufficient]

### Research Sources
- GitHub repositories reviewed: [links]
- Reddit discussions: [r/subreddit threads]
- NPM packages evaluated: [package names]
- Key decision factors: [what mattered most for this choice]
```

**Validation checkpoint:**
- Do chosen technologies fulfill ALL use case requirements?
- Are there any unresolved gaps?
- Is the technology stack minimal yet sufficient?
- Have trade-offs been clearly documented?

**Define Architectural Requirements (Necessary but Sufficient):**

Apply the **necessary-but-sufficient principle**: Include only what's required to fulfill use cases and NFRs. Don't over-architect, but don't under-architect either. Let requirements determine complexity.

**1. User Interface Architecture (if UI needed):**

**Evaluate UI requirements from use cases:**
- Does this solution need a user interface?
- What type: Web app, mobile app, desktop app, CLI, API-only?
- Who are the users? (Technical vs. non-technical, internal vs. external)
- What interactions are required? (Forms, dashboards, real-time updates, etc.)

**If UI is needed, define approach:**

**Philosophy: Prefer trending, modern frameworks (be "a bit fancy"):**
- **Modern UI Libraries:** shadcn/ui, Radix UI, Headless UI (component primitives with flexibility)
- **Styling:** Tailwind CSS (utility-first, trending, fast development)
- **Frameworks:** Next.js (React), Nuxt (Vue), SvelteKit (Svelte) based on team familiarity
- **State Management:** React Context/Zustand (simple), Redux/MobX (complex needs)

**Decision framework:**
- **Simple forms/pages:** shadcn + Tailwind + minimal state = fast, modern, trending
- **Complex dashboards:** Add charting (Recharts, Chart.js), tables (TanStack Table)
- **Real-time features:** WebSockets or Server-Sent Events with optimistic updates
- **Accessibility:** Use semantic HTML + ARIA from shadcn/Radix (built-in a11y)

**Document UI architecture decision:**
```markdown
### UI Architecture

**Requirements:** [What UI interactions are needed from use cases]

**Approach:** [Framework + component library + styling solution]
- Framework: [Next.js 14+ / Nuxt 3+ / SvelteKit / None]
- Components: [shadcn/ui / Radix / Headless UI / Custom]
- Styling: [Tailwind CSS / CSS Modules / Styled Components]
- State: [Context / Zustand / Redux / None]

**Rationale:** [Why this combination fits requirements and team]
- Trending: [shadcn is community favorite 2024+, Tailwind widely adopted]
- Sufficient: [Covers all use case interactions without over-engineering]
- Fancy factor: [Modern aesthetics, smooth interactions, professional appearance]

**Satisfied by:** [Existing packages] **Needs investigation:** [Unknowns or decisions pending]
```

**2. Service Architecture (backend/business logic):**

**Evaluate service requirements:**
- Does this need a backend service? Or is it frontend-only?
- Synchronous request/response or asynchronous processing?
- Stateless services or stateful coordination?
- Monolith or microservices? (Prefer monolith unless clear need for separation)

**Decision framework:**
- **Simple API:** Express/Fastify + RESTful endpoints = sufficient for most
- **Complex workflows:** Add job queues (Bull/BullMQ), background workers
- **Real-time:** WebSocket server (Socket.io, ws) or SSE
- **Scheduled tasks:** Cron jobs or task scheduler (node-cron, agenda)

**Document service architecture decision:**
```markdown
### Service Architecture

**Requirements:** [What backend capabilities are needed]

**Approach:** [Monolith vs. microservices, framework choice]
- Pattern: [Monolith / Microservices / Serverless / Hybrid]
- Framework: [Express / Fastify / Nest.js / None]
- Processing: [Synchronous only / Job queues / Background workers]
- State: [Stateless / Session-based / Distributed state]

**Rationale:** [Why this approach fits scale and complexity needs]

**Satisfied by:** [Existing infrastructure] **Needs investigation:** [Scalability testing, deployment model]
```

**3. API Architecture (if exposing APIs):**

**Evaluate API requirements:**
- Who consumes the API? (Internal only, external partners, public)
- What API style? REST, GraphQL, gRPC, WebSockets?
- Authentication needed? OAuth, API keys, JWT?
- Rate limiting, versioning, documentation requirements?

**Decision framework:**
- **Internal only:** Simple REST with JWT = sufficient
- **External partners:** REST + API keys + rate limiting + OpenAPI docs
- **Complex queries:** Consider GraphQL (if many query variations needed)
- **High performance:** Consider gRPC (if latency critical, typed contracts)

**Document API architecture decision:**
```markdown
### API Architecture

**Requirements:** [Who needs to call what]

**Approach:** [API style and contracts]
- Style: [REST / GraphQL / gRPC / Hybrid]
- Contracts: [OpenAPI / GraphQL Schema / Protocol Buffers]
- Authentication: [JWT / OAuth 2.0 / API Keys / None]
- Versioning: [URL-based /v1/ / Header-based / None]
- Documentation: [OpenAPI/Swagger / GraphQL Playground / Custom]

**Rationale:** [Why this API style fits consumers and use cases]

**Satisfied by:** [Existing patterns] **Needs investigation:** [Authentication provider, rate limiting strategy]
```

**4. Data Storage Architecture:**

**Evaluate data storage requirements:**
- What data needs to be stored? (User data, transactions, logs, files, etc.)
- Data model: Relational, document, key-value, graph, time-series?
- Scale: Thousands, millions, billions of records?
- Consistency needs: Immediate consistency or eventual consistency ok?
- Query patterns: Simple lookups, complex joins, full-text search, analytics?

**Decision framework:**
- **Structured data + relationships:** PostgreSQL / MySQL (battle-tested, reliable)
- **Flexible schema:** MongoDB / Firebase (document model, fast iteration)
- **Key-value + caching:** Redis (ephemeral data, sessions, rate limiting)
- **File storage:** S3 / Cloud Storage (images, documents, backups)
- **Search:** Elasticsearch / Typesense (full-text search, faceted filters)
- **Analytics:** ClickHouse / BigQuery (if heavy analytical queries needed)

**Decision framework (necessary but sufficient):**
- **Start simple:** Single PostgreSQL covers 80% of use cases
- **Add complexity only if needed:** Redis for caching, S3 for files, etc.
- **Avoid premature optimization:** Don't add databases you don't need yet

**Document data storage decision:**
```markdown
### Data Storage Architecture

**Requirements:** [What data needs to be persisted]

**Approach:** [Database choices and rationale]
- Primary datastore: [PostgreSQL / MongoDB / MySQL / SQLite]
- Caching layer: [Redis / Memcached / None]
- File storage: [S3 / Cloud Storage / Local filesystem]
- Search engine: [Elasticsearch / Typesense / Database full-text / None]
- Analytics: [Same DB / Separate warehouse / None]

**Data model:** [Relational tables / Document collections / Hybrid]
**Scale estimate:** [Current: X records, 1-year: Y records, 5-year: Z records]

**Rationale:** [Why this combination is necessary and sufficient]
- Necessary: [Each component solves specific use case requirement]
- Sufficient: [No over-engineering, covers projected scale]

**Satisfied by:** [Existing databases] **Needs investigation:** [Backup strategy, replication, scaling plan]
```

**Architecture Decision Summary:**

After defining all architectural layers, create a summary in `architecture.md`:

```markdown
## Architecture Decision Matrix

| Layer | Required? | Approach | Necessary Because | Sufficient Because | Status |
|-------|-----------|----------|-------------------|-------------------|--------|
| UI | [Yes/No] | [Framework choice] | [Use case needs] | [Covers all interactions] | [Satisfied/Needs investigation] |
| Service | [Yes/No] | [Service pattern] | [Business logic needs] | [Handles current + projected load] | [Satisfied/Needs investigation] |
| API | [Yes/No] | [API style] | [Consumer requirements] | [All consumers can integrate] | [Satisfied/Needs investigation] |
| Data | [Yes/No] | [Storage choices] | [Persistence needs] | [Scale + query patterns covered] | [Satisfied/Needs investigation] |

### Items Satisfied
[List architectural decisions that are clear and final]

### Items Needing Investigation
[List decisions requiring research, prototyping, or user input]
- [Decision]: [What needs to be investigated and why]
- [Decision]: [What's the risk if we get this wrong]
```

**Validation checkpoint:**
- Is each architectural layer justified by use case requirements?
- Are we following necessary-but-sufficient (no over-engineering)?
- Have we captured "fancy" modern UI preferences where applicable?
- Is it clear what's decided vs. what needs investigation?

**Discover automation tooling through runtime search:**

**📖 Methodology Reference:** See "Tooling Philosophy: Discover, Evaluate, Leverage" section earlier in this guide for the complete discovery and evaluation methodology. The following is Stage 3's specific application of that methodology.

Systematically search for tools that could accelerate development and improve quality:

**1. MCP Server Discovery**
Search for MCP servers matching your needs (use web search, npmjs, github):
- What MCP servers exist for your domain/tech stack?
- What operations do available servers provide?
- How would they integrate? What setup is required?
- What are performance/security implications?

Document discovered servers with:
- Capabilities and how they help fulfill requirements
- Integration considerations and trade-offs
- Confidence level (HIGH if well-documented, LOW if needs research)

**2. Claude Code Subagent Discovery**
Review available subagents from Task tool for your workflow needs:
- Which subagents match planning/implementation/quality tasks?
- How could parallel subagent execution accelerate work?
- What specialized capabilities do subagents provide?

**3. External API Discovery**
Research domain-specific APIs and services:
- What third-party APIs support your use cases?
- What integration patterns exist in codebase for similar APIs?
- Authentication, rate limits, reliability considerations?

**4. Tooling Integration Patterns**
For each tool category, evaluate access patterns:
- Direct API vs. abstraction layer (control vs. testability trade-off)
- Synchronous vs. asynchronous (simplicity vs. performance)
- When to use which approach? Document rationale.

**Document all discoveries** in architecture file:
- What tools were found and why they matter
- How they'll be used during development
- Integration approach with reasoning
- Mark LOW confidence items for user validation

**Map the dependencies - what building blocks do you need?**
- What libraries or frameworks would fit naturally here?
- What versions are already in use in this project? (Mixing versions causes pain)
- Are there version compatibility concerns between dependencies?
- What does the dependency tree look like? (Deep dependency chains are risks)

**Analyze state transitions - how does the system evolve?**
- What is the current state of the system? (Before your changes)
- What state will exist after implementation? (After your changes)
- What needs to change to get there? (Migration path)
- Is this a breaking change requiring careful rollout?
- What happens to existing data or functionality during the transition?

**Document architectural findings** to `<worktree>/planning/architecture.md`:
- Systems involved with capabilities/limitations and failure modes
- Dependencies required with version constraints and justification
- Technology decisions with questions, options, trade-offs, and rationale
- State transition plan (current → future) with migration strategy
- Integration points and patterns discovered in codebase
- Risk assessment and alternatives considered

**Document tooling discoveries** to `<worktree>/planning/tooling.md`:
- **MCP Servers discovered**: Capabilities, setup requirements, integration approach, confidence level
- **Claude Code Subagents identified**: When to use, what context they need, parallel execution opportunities
- **External APIs & Services**: Which APIs support use cases, authentication needs, integration patterns
- **Testing & Quality Tools**: Browser automation, API testing, performance profiling, security scanning
- **Integration evaluation**: Trade-offs for each tool (direct API vs abstraction vs MCP vs subagent)
- **Tooling strategy**: When each tool will be used (which phases/iterations)

**Present conversationally:**
"🏗️ **Stage 3: Architectural Research** (Progress: 3/6)

[Present: Existing Systems & Integration, Technology Choices, Dependencies, Discovered Tooling (MCP/subagents/APIs/services), State Transition, Integration Patterns, Risks]

**Quality Gate:** Does this architectural approach make sense given the context and constraints?"

**🔒 CRITICAL ARCHITECTURE QUALITY GATE:**

**BEFORE user confirmation, perform architecture validation:**

1. **Verify architecture supports ALL use cases from Stage 1:**
   - Read `<worktree>/planning/use-cases.md`
   - For each use case, confirm architecture provides necessary capabilities
   - Document verification: "Use case [X] → Architecture component [Y] → Capability [Z]"

2. **Verify architecture satisfies ALL requirements from Stage 2:**
   - Read `<worktree>/planning/requirements.md`
   - Check functional requirements: Architecture provides needed functionality
   - Check non-functional requirements: Architecture meets performance/security/reliability constraints

3. **IF GAPS FOUND:**
   - Document gap: "Use case/Requirement [X] not supported because [reason]"
   - Options:
     - **Option A:** Revise architecture to support missing use cases/requirements
     - **Option B:** Revise use cases/requirements if over-specified
     - **Option C:** Explicitly document as future enhancement (requires user agreement)
   - **LOOP:** Return to architecture research, update architecture.md, re-verify
   - **DO NOT PROCEED** to Stage 4 until all use cases/requirements are covered

4. **IF NO GAPS:** Present architecture with verification summary to user

→ Follow Stage Execution Pattern for confirmation/feedback processing
→ Update GUIDE.md per standard protocol with verification results
→ If architectural constraints fundamentally change use cases or requirements, may need to revert to Stage 1 or 2
→ **Note:** Architectural discoveries may reveal better tooling options than initially identified
   - If better MCP servers, APIs, or tools are found, update `tooling.md`
   - Re-evaluate integration approaches based on architectural patterns discovered
   - This is learning, not failure - document why the new tooling choice is better

  **📖 Context Reminder:**
  If you've lost context, read `<worktree>/planning/GUIDE.md` to understand:
  - What phase we're in
  - What's been confirmed
  - Layer dependencies

  → Re-present Stage 3 with updated understanding (including any tooling revisions)
  → Stay at Stage 3 until confirmed

---

### Stage 4: Assumptions & Risk Assessment

**📥 Input Files:**
- `<worktree>/planning/use-cases.md` (Stage 1 output)
- `<worktree>/planning/requirements.md` (Stage 2 output)
- `<worktree>/planning/architecture.md` + `tooling.md` (Stage 3 output)
- `<worktree>/planning/GUIDE.md` (session state and Stage 1-3 confirmations)

**📤 Output Files:**
- `<worktree>/planning/assumptions.md` (knowledge file - risk assessment, confidence levels, validation needs)
- `<worktree>/planning/p1-stage4-journal.md` (journal file - validation activities, experiments run)
- `<worktree>/planning/GUIDE.md` (updated with Stage 4 confirmation and transition log)

---

**Rehydrate Stage Context (if file exists):**

Check for `<worktree>/planning/assumptions.md`. If it exists:
- Read the file to recall existing assumption analysis
- Note what assumptions were identified and validated
- Note risk classifications (SOLID/WORKING/RISKY)
- Note any mitigations or validations performed
- You're updating/adding to this work based on new discoveries
- Build upon what exists, don't start fresh

If the file doesn't exist, this is your first exploration of Stage 4.

**Follow Stage Execution Pattern** with these specifics:

**Position (Stage 4 of 6 - Validating Foundation):**
- Building on validated use cases (Stage 1), constraints (Stage 2), technical approach (Stage 3)
- This reveals invisible assumptions underlying earlier decisions
- Validates whether we're building on solid ground or quicksand
- High-risk assumptions may require reverting to earlier stages

**Think like a skeptic, not an optimist.** Question everything you've taken for granted.

**Review Stage 1 (use cases) - what did you assume about user behavior?**
- Do users actually work this way, or did you imagine an ideal workflow?
- Is the information you assume users have actually available to them?
- Are the system capabilities you assumed actually implemented and working?

**Review Stage 2 (NFRs) - what did you assume about constraints?**
- Is "fast enough" actually achievable, or did you guess based on wishes?
- Is the security threat model realistic, or did you assume best/worst case?
- Is the operational environment what you think it is? (Cloud? On-prem? Mixed?)

**Review Stage 3 (architecture) - what did you assume about the technical world?**
- Does the existing system actually behave the way you think it does?
- Are those dependencies stable and maintained, or abandoned?
- Do the integration points work as documented, or are the docs outdated?

**Review Stage 3 (tooling) - validate your tooling choices:**
- Are the discovered MCP servers actually available and functional?
- Do the identified subagents have the capabilities you assumed?
- Are the external APIs accessible and do they work as documented?
- Are there better tooling options you missed during Stage 3 discovery?
- **If tooling assumptions are invalid:** Update `tooling.md` with corrections

**Validate each assumption - gather evidence, don't just hope:**

For each assumption you've identified, ask yourself:
- **Is this reasonable?** Given everything I know, does this make sense?
- **What supports it?** Do I have evidence (docs, code, tests) or is this a guess?
- **What would invalidate it?** What discovery would prove this wrong?
- **How risky is it?** If I'm wrong, does everything fall apart or is it a minor adjustment?

**Classify by risk level - be honest about uncertainty:**
- **SOLID**: Well-supported by evidence, low risk if wrong (e.g., "The standard library has this function")
- **WORKING**: Reasonable but should be validated, medium risk (e.g., "The API probably handles retries")
- **RISKY**: Needs explicit user confirmation, high risk if wrong (e.g., "Users have stable 10Mbps connections")

**Document** to `<worktree>/planning/assumptions.md`:
- List all assumptions with classification (SOLID/WORKING/RISKY)
- Supporting evidence (or lack thereof)
- Risk assessment: What happens if wrong?
- Mitigation: How to adapt if invalidated?

**Present conversationally:**
"🎯 **Stage 4: Assumptions & Risk Assessment** (Progress: 4/6)

[Present: SOLID Assumptions (count), WORKING Assumptions (count), RISKY Assumptions (count)]

**Quality Gate:** Are these assumptions reasonable? What did I get wrong?"

→ Follow Stage Execution Pattern for confirmation/feedback processing
→ Update GUIDE.md per standard protocol
→ If assumptions invalidated, may cascade back to Stage 1/2/3 depending on what assumption supports

---

### Stage 5: Second-Order Effects & Anti-Cases

**📥 Input Files:**
- All previous stage outputs: `use-cases.md`, `requirements.md`, `architecture.md`, `tooling.md`, `assumptions.md`
- `<worktree>/planning/GUIDE.md` (session state and Stage 1-4 confirmations)

**📤 Output Files:**
- `<worktree>/planning/effects-boundaries.md` (knowledge file - second-order effects, scope limits, anti-cases)
- `<worktree>/planning/p1-stage5-journal.md` (journal file - effects analysis process, boundary discussions)
- `<worktree>/planning/GUIDE.md` (updated with Stage 5 confirmation and transition log)

---

**Rehydrate Stage Context (if file exists):**

Check for `<worktree>/planning/effects-boundaries.md`. If it exists:
- Read the file to recall existing effects analysis
- Note what impacts and ripple effects were identified
- Note what anti-cases and boundaries were defined
- Note what operational implications were documented
- You're updating/adding to this work based on new insights
- Build upon what exists, don't start fresh

If the file doesn't exist, this is your first exploration of Stage 5.

**Follow Stage Execution Pattern** with these specifics:

**Position (Stage 5 of 6 - Thinking Ahead):**
- Building on validated use cases (Stage 1), constraints (Stage 2), approach (Stage 3), assumptions (Stage 4)
- This reveals ripple effects, consequences of consequences, and necessary boundaries
- Extends validated work into future and broader context
- Ripple effects may reveal new use cases or invalidate assumptions

**Think like a systems thinker, not a feature builder.** Every action has reactions.

**Think about impacts on existing use cases - what else is affected?**
- Which current workflows will be affected? (Adding a step? Changing behavior? Breaking assumptions?)
- Will existing functionality need modification? (Does old code expect the old way?)
- Are there performance implications for other features? (Shared resources? New bottlenecks?)
- What might break? What needs adjustment to stay working?

**Consider operational impacts - how does this change the system's life?**
- How does this change deployment? (New dependencies? Database migrations? Configuration?)
- What monitoring or logging is needed? (How will you know if it's working? Breaking?)
- Are there support implications? (Will users need help? Will errors be confusing?)
- What training might be needed? (For users? For operators? For future developers?)

**Evaluate future flexibility - what doors are opening or closing?**
- Does this enable future work? (New capabilities? New integrations?)
- Does this constrain future work? (Commitments? Technical debt? Locked-in patterns?)
- What doors does it open that you didn't intend? (Can this be misused? Abused?)
- How reversible is this approach? (If we learn it's wrong, can we undo it?)

**Define anti-cases - what must NOT happen:**

**Identify misuse scenarios - think adversarially:**
- How could this be misused? (What if someone uses it in ways you didn't intend?)
- What would constitute abuse? (Excessive load? Security violations? Data exposure?)
- What should be explicitly prevented? (Input validation? Rate limiting? Access controls?)

**Recognize anti-patterns to avoid - learn from others' mistakes:**
- What implementation approaches should we reject? (What's been tried and failed?)
- What architectural decisions would be mistakes? (What creates technical debt?)
- What tempting shortcuts should we resist? (What's fast now but painful later?)

**Set out-of-scope boundaries - say no to feature creep:**
- What problems will we explicitly NOT solve? (What's tempting but out of scope?)
- What features should we defer? (What's "nice to have" but not "must have"?)
- What complexity should we avoid? (What makes this harder without proportional value?)

**Document** to `<worktree>/planning/effects-boundaries.md`:
- Impacts: Existing use cases, operations, future work (what changes?)
- Anti-cases: Misuse, anti-patterns, out-of-scope (what must NOT happen?)
- Reasoning: Why these boundaries? What risks managed?

**Present conversationally:**
"🔄 **Stage 5: Second-Order Effects & Anti-Cases** (Progress: 5/6)

[Present: Impacts on Existing Systems, Operational Implications, Future Considerations, Anti-Cases]

**Quality Gate:** Have I thought through the consequences? Are the boundaries right?"

→ Follow Stage Execution Pattern for confirmation/feedback processing
→ Update GUIDE.md per standard protocol
→ If ripple effects reveal missing use cases or challenge assumptions, may need to revert to affected stage

---

### Stage 6: Complete Synthesis & Final Confirmation

**📥 Input Files:**
- All 5 previous stage outputs: `use-cases.md`, `requirements.md`, `architecture.md`, `tooling.md`, `assumptions.md`, `effects-boundaries.md`
- All 5 previous stage journals: `p1-stage1-journal.md` through `p1-stage5-journal.md`
- `<worktree>/planning/GUIDE.md` (complete session state and all Stage 1-5 confirmations)

**📤 Output Files:**
- `<worktree>/planning/task-definition.md` (knowledge file - complete synthesized understanding, ready for implementation)
- `<worktree>/planning/p1-stage6-journal.md` (journal file - synthesis process, integration challenges resolved)
- `<worktree>/planning/GUIDE.md` (updated with Stage 6 confirmation, Phase 1 complete transition log)

---

**Rehydrate Stage Context (if file exists):**

Check for `<worktree>/planning/task-definition.md`. If it exists:
- Read the file to recall existing synthesis work
- Note what integrations were made across all stages
- Note what coherence or gaps were identified
- Note any open questions or tensions documented
- You're updating/adding to this work based on new understanding
- Build upon what exists, don't start fresh

If the file doesn't exist, this is your first exploration of Stage 6.

**Follow Stage Execution Pattern** with these specifics:

**Position (Stage 6 of 6 - Integration & Readiness):**
- Building on all five validated stages - complete progressive understanding
- This reveals coherence (or gaps/contradictions) across all stages
- Foundation for all implementation work (quality criteria, tests, code)
- Last chance to resolve tensions before coding begins

**Think like an integrator, not a compiler.** You're creating coherence, not concatenating sections.

**Pull together the validated components from all confirmed layers:**
- Use cases from Stage 1 (confirmed)
- NFRs from Stage 2 (confirmed)
- Architecture from Stage 3 (confirmed)
- Assumptions from Stage 4 (confirmed)
- Effects and boundaries from Stage 5 (confirmed)

**Create the comprehensive task definition** at `<worktree>/planning/task-definition.md`:

```markdown
# Task Definition: [Task Name]

## Primary Use Cases
[Confirmed use cases from Stage 1]

## Non-Functional Requirements
[Confirmed NFRs from Stage 2]

## Architectural Context
[Summary from Stage 3 with reference to detailed architecture doc]

## Validated Assumptions
[Confirmed assumptions from Stage 4]

## Second-Order Effects
[Confirmed impacts from Stage 5]

## Anti-Cases & Boundaries
[Confirmed boundaries from Stage 5]

## Open Questions
[Anything still uncertain after 5 layers]
```

**Document** to `<worktree>/planning/task-definition.md`:
A readable narrative integrating all confirmed stages into complete understanding

**Present conversationally:**
"✨ **Stage 6: Complete Synthesis** (Progress: 6/6)

[Present: The Vision, Core Capabilities (Stage 1), Quality Constraints (Stage 2), Technical Approach (Stage 3), Confidence Level (Stage 4), Boundaries (Stage 5)]

**Complete Documentation:**
- Task definition: `<worktree>/planning/task-definition.md`
- All 6 stage confirmations: Knowledge files in `<worktree>/planning/` and journals in `<worktree>/planning/p1-*.md`

---

**🚦 FINAL QUALITY GATE**

This is the shared understanding I'll implement against. All 6 layers validated progressively.

**To proceed:** Type "PROCEED" or indicate readiness to move forward.
**If anything needs adjustment:** Tell me what to revisit."

**[WAIT for EXPLICIT user confirmation]**

→ IF "PROCEED": Document final confirmation, update GUIDE.md with Phase 1→II transition, announce completion, move to Phase 2
→ IF issues: Determine which stage needs revision, revert to that stage, progress forward again through subsequent stages

---

## Phase 2: Criteria Definition

**📥 Input Files:**
- `<worktree>/planning/task-definition.md` (Phase 1 Stage 6 output - complete synthesized understanding)
- `<worktree>/planning/requirements.md` (quality attributes and functional requirements)
- `<worktree>/planning/GUIDE.md` (Phase 1 complete confirmation)

**📤 Output Files:**
- `<worktree>/planning/quality-criteria.md` (knowledge file - measurable success criteria, exit thresholds)
- `<worktree>/planning/p2-planning-journal.md` (journal file - criteria definition process, scoring decisions)
- `<worktree>/planning/GUIDE.md` (updated with Phase 2 confirmation and transition log)

**📝 Documentation Output:**
- **Files Created:** `<worktree>/planning/quality-criteria.md`
- **Purpose:** Define measurable success criteria across functional completeness, code quality, and integration dimensions
- **Referenced By:** Phase 2-B (test planning), Phase 3 (quality verification in each task), Phase 4 (final validation)

---

Now that we know WHAT we're building, define HOW we'll know it's complete and high-quality.

**Think dimensionally about success:**

**Functional completeness:**
- What specific capabilities must exist?
- What inputs must be handled?
- What outputs must be produced?
- What edge cases must work?

For each requirement, define a **falsifiable criterion**:
- BAD: "Handle errors gracefully" (subjective)
- GOOD: "All error paths return structured error objects with message, code, and context" (measurable)

**Code quality dimensions:**
- Test coverage (what percentage?)
- Code review standards (what to check?)
- Documentation completeness (what needs docs?)
- Pattern adherence (what patterns apply?)

**Integration verification:**
- State transition completion (current → future state verified)
- Dependency integration (all dependencies work as expected)
- System compatibility (works with existing systems)
- Backward compatibility (doesn't break existing functionality)

**Anti-criteria - what must NOT be present:**
- Security vulnerabilities (specify what to check)
- Performance regressions (specify thresholds)
- Code smells (specify which ones)
- Unintended side effects (reference Phase 4 impacts)

**Define measurement methods:**
For each criterion, specify HOW to verify:
- "Run test suite" → mocha test/**/*.test.js passes
- "Code review" → code-reviewer subagent reports no blocking issues
- "Performance check" → [specific benchmark command]
- "Integration test" → [specific validation steps]

**Set exit thresholds:**
- **Primary criteria**: Must be 100% complete (all functional requirements met)
- **Quality score**: Must be ≥80 (weighted: functional 40% + code review 35% + completeness 25%)
- **Blocking issues**: Must be zero (no critical bugs, security issues, or architectural violations)

**Document criteria** to `<worktree>/planning/quality-criteria.md`:

```markdown
# Quality Criteria for [Task Name]

## Primary Criteria (Must be 100%)
1. [Criterion with measurement method]
2. [Criterion with measurement method]
...

## Quality Scoring (Target ≥80)

### Functional Completeness (40% weight)
- [Specific requirement: measurement method]
...

### Code Review Quality (35% weight)
- [Review dimension: measurement method]
...

### Integration Completeness (25% weight)
- [Integration point: verification method]
...

## Anti-Criteria (Must be 0)
- [What must not exist: how to check]
...

## Exit Thresholds
- Primary criteria: 100%
- Quality score: ≥80
- Blocking issues: 0
```

**Present the quality criteria to the user:**

"I've defined the quality criteria for this task. Here's how we'll measure success:

**Primary Criteria (must be 100%):**
[List the primary criteria with measurement methods]

**Quality Scoring (target ≥80):**
- Functional Completeness: 40% weight
- Code Review Quality: 35% weight
- Integration Completeness: 25% weight

**Exit Thresholds:**
- All primary criteria must be met
- Quality score must be ≥80
- Zero blocking issues

**Crafting Process:**
I'll work through up to 10 iterations, with each iteration:
1. Setting clear intentions
2. Implementing code and tests
3. Verifying quality against criteria
4. Learning and adapting

The complete criteria document is at `<worktree>/planning/quality-criteria.md`.

**May I proceed with the crafting iterations?**"

[WAIT for user confirmation]

If the user requests changes to the criteria, update `<worktree>/planning/quality-criteria.md` and repeat the presentation until confirmed.

If the user declines or wants to stop, exit gracefully and preserve the worktree for manual work.

---

## Phase 2-B: Understanding Through Test Design

**📥 Input Files:**
- `<worktree>/planning/task-definition.md` (Phase 1 complete understanding)
- `<worktree>/planning/use-cases.md` + `requirements.md` (what to test)
- `<worktree>/planning/quality-criteria.md` (Phase 2 output - success criteria)
- `<worktree>/planning/GUIDE.md` (Phase 2 confirmation)

**📤 Output Files:**
- `<worktree>/planning/test-plan.md` (knowledge file - test specifications, categories, strategies)
- `<worktree>/planning/p2b-test-design-journal.md` (journal file - test design thinking, edge case discovery)
- `<worktree>/planning/GUIDE.md` (updated with Phase 2-B confirmation and transition log)

**📝 Documentation Output:**
- **Files Created:** `<worktree>/planning/test-plan.md`
- **Purpose:** Design tests as specifications of understanding before implementation; clarify requirements through test thinking
- **Referenced By:** Phase 2-D (task test requirements), Phase 3 (test implementation in each task), Phase 4 (test execution validation)

---

📖 **Context Reminder:** Before writing code, we clarify understanding through test design.
Review GUIDE.md section "Testing Philosophy: Specifications of Understanding"

**Where We Are in the Journey:**

We've defined WHAT to build (Phase 1) and HOW to measure success (Phase 2).
Now we design tests that express our understanding as specifications before writing
any implementation code.

**What This Phase Reveals:**

Tests aren't afterthoughts - they're specifications. By designing tests first, we
discover ambiguities in requirements, edge cases we haven't considered, and gaps
in our understanding. This saves massive rework later.

**Your Approach:**

Think through each requirement from Phase 2 criteria. For each one, ask:
"How would I know this works?" Then express that knowledge as a test case.

### Design Test Scenarios

**Start with happy path tests** - the canonical examples of success:

Think through the "expected journey" - the typical user scenario from Stage 1 that should work smoothly:

- **What's the typical input?**
  - Realistic data that matches actual user input patterns
  - Representative data volumes (not just single items - try 5, 10 items if lists are involved)
  - Common value ranges (typical numbers, typical string lengths, typical date ranges)

- **What's the expected behavior?**
  - Core workflow from start to finish
  - Expected transformations and processing steps
  - Expected interactions with external systems (mocked)

- **What's the expected output?**
  - Correct data structure and format
  - Expected values with proper transformations applied
  - Appropriate status codes or success indicators

**Example Happy Path Test:**
```javascript
it('should process invoice email and create ledger entry', () => {
  // Arrange: Set up realistic invoice data
  const invoiceEmail = {
    from: 'vendor@example.com',
    subject: 'Invoice #12345',
    body: 'Total: $150.00',
    date: '2024-01-15'
  };
  const expectedEntry = {
    vendor: 'vendor@example.com',
    invoiceNumber: '12345',
    amount: 150.00,
    date: '2024-01-15',
    status: 'processed'
  };

  // Act: Execute the workflow
  const result = processInvoice(invoiceEmail);

  // Assert: Verify expected outcome
  expect(result).to.deep.equal(expectedEntry);
  expect(result.status).to.equal('processed');
});
```

**Then corner cases** - boundary conditions that reveal understanding:

Think about edge cases, boundary values, and unusual-but-valid scenarios:

- **Empty and minimal inputs:**
  - Empty strings, empty arrays, empty objects
  - Single-item collections (when normally expecting multiple)
  - Minimal valid input (what's the smallest acceptable input?)

- **Boundary transitions:**
  - Zero, negative zero, positive zero
  - Off-by-one boundaries (0, 1, max-1, max, max+1)
  - Minimum and maximum values for numeric types
  - Very short and very long strings (1 char, 255 chars, 256 chars)

- **Format variations:**
  - Different date formats (ISO, US, European)
  - Case variations (uppercase, lowercase, mixed)
  - Whitespace variations (leading, trailing, internal)
  - Unicode and internationalization (emoji, accents, RTL text)
  - Encoding edge cases (special characters, escaping)

- **State-based scenarios:**
  - First-time execution vs. subsequent runs
  - Empty database/system vs. populated
  - System in different states (idle, busy, recovering)

**Example Corner Case Tests:**
```javascript
describe('corner cases', () => {
  it('should handle empty email body', () => {
    const email = { from: 'vendor@example.com', subject: 'Invoice', body: '' };
    expect(() => processInvoice(email)).to.throw('Email body cannot be empty');
  });

  it('should handle very large invoice amount', () => {
    const email = { body: 'Total: $999999.99' };
    const result = processInvoice(email);
    expect(result.amount).to.equal(999999.99);
  });

  it('should handle invoice number at max length', () => {
    const longInvoiceNum = 'INV-' + 'A'.repeat(50);
    const email = { subject: `Invoice ${longInvoiceNum}` };
    const result = processInvoice(email);
    expect(result.invoiceNumber).to.have.lengthOf.at.most(50);
  });
});
```

**Finally error paths** - what should NOT happen:

Think about validation, error handling, and security:

- **Invalid inputs that should be rejected:**
  - Wrong data types (string instead of number, object instead of array)
  - Malformed data (invalid JSON, broken structure)
  - Out-of-range values (negative when expecting positive, dates in future when expecting past)
  - Missing required fields
  - Invalid formats (malformed email addresses, invalid URLs)

- **Error conditions that should be handled gracefully:**
  - External service unavailable (network timeout, API down)
  - Database connection failures
  - Insufficient permissions or authentication failures
  - Rate limiting or quota exceeded
  - Partial failures (some items succeed, some fail in batch operations)

- **Security violations that must be prevented:**
  - SQL injection attempts in string inputs
  - XSS attempts in user-provided HTML/text
  - Path traversal attempts in file paths
  - Oversized inputs (denial-of-service attempts)
  - Unauthorized access attempts

**Example Error Path Tests:**
```javascript
describe('error paths', () => {
  it('should reject SQL injection attempt', () => {
    const malicious = { body: "'; DROP TABLE invoices; --" };
    expect(() => processInvoice(malicious))
      .to.throw('Invalid input: SQL injection detected');
  });

  it('should handle external API timeout gracefully', () => {
    const email = { from: 'vendor@example.com' };
    mockApi.setTimeout(5000); // Force timeout
    const result = processInvoice(email);
    expect(result.status).to.equal('pending_retry');
    expect(result.error).to.match(/timeout/i);
  });

  it('should reject unauthorized access attempt', () => {
    const email = { from: 'unauthorized@example.com' };
    expect(() => processInvoice(email))
      .to.throw('Unauthorized: vendor not in approved list');
  });
});
```

### Plan Test Setup and Test Data

**Test Setup Strategy:**

Think about what environment your tests need to run reliably:

- **Test fixtures and mock data:**
  - Create reusable test data objects (`testData.js`)
  - Define factory functions for generating test objects with variations
  - Document what each fixture represents and when to use it

- **Before/after hooks:**
  - `before()`: One-time setup (database connections, expensive resource initialization)
  - `beforeEach()`: Per-test setup (clean slate, reset mocks, fresh test data)
  - `afterEach()`: Per-test cleanup (restore mocks, clear caches)
  - `after()`: One-time teardown (close connections, cleanup resources)

- **Mocking external dependencies:**
  - Mock external APIs (use `sinon` stubs)
  - Mock database calls (in-memory SQLite or full mocks)
  - Mock file system operations
  - Mock date/time for deterministic tests
  - Mock random number generation if needed

**Example Test Setup:**
```javascript
describe('Invoice Processing', () => {
  let mockDatabase;
  let mockEmailService;

  before(() => {
    // One-time setup: Initialize test database
    mockDatabase = createInMemoryDatabase();
  });

  beforeEach(() => {
    // Per-test setup: Clean slate
    mockDatabase.clear();
    mockEmailService = createMockEmailService();

    // Seed with minimal required data
    mockDatabase.insert('vendors', [
      { email: 'vendor@example.com', approved: true },
      { email: 'partner@example.com', approved: true }
    ]);
  });

  afterEach(() => {
    // Per-test cleanup
    mockEmailService.restore();
  });

  after(() => {
    // One-time teardown
    mockDatabase.close();
  });

  // Tests use clean environment each time...
});
```

**Test Data Creation Guidance:**

- **Realistic data patterns:**
  - Use data that mirrors production (real vendor names, realistic amounts, actual date patterns)
  - Don't use obviously fake data like "test@test.com" or amount=123.45 everywhere
  - Vary data across tests to catch bugs that depend on specific values

- **Data factories for flexibility:**
```javascript
// test/helpers/testData.js
function createInvoiceEmail(overrides = {}) {
  const defaults = {
    from: 'vendor@example.com',
    subject: 'Invoice #12345',
    body: 'Amount: $100.00',
    date: '2024-01-15',
    attachments: []
  };
  return { ...defaults, ...overrides };
}

// Usage in tests:
const normalInvoice = createInvoiceEmail();
const largeInvoice = createInvoiceEmail({ body: 'Amount: $50000.00' });
const oldInvoice = createInvoiceEmail({ date: '2020-01-01' });
```

- **Deterministic test data:**
  - Avoid randomness unless testing random behavior
  - Use fixed dates, not `new Date()` (mock the clock)
  - Use sequential IDs or predictable patterns
  - Document any test data that has special meaning

### Document Test Plan

Write to `<worktree>/planning/test-plan.md`:
- Test categories (Unit, Integration, Edge Case, Error Path)
- For each test: name, setup, input, expected output, assertions

Use natural language first, not code:
"When user provides negative number, function should throw TypeError with message 'Must be positive'"

### Present Test Plan to User

[Present test design conversationally]

**Ask:**
- "Does this test plan cover all the scenarios you care about?"
- "Are there edge cases I'm missing?"
- "Do the error messages make sense?"

IF the user confirms the test plan:
  → Document confirmation to `<worktree>/planning/test-plan.md`
  → **Update GUIDE.md** with test plan completion:
     * Edit `<worktree>/planning/GUIDE.md` section "Current State of Understanding"
       Add: "Phase 2-B complete: Test plan confirmed with [X] test scenarios"
     * Add note about test categories to "The Story So Far"
  → Announce: "✓ Test plan confirmed. Writing actual tests..."
  → Proceed to implement tests

IF the user requests changes:
  → Revise test plan based on feedback
  → Re-present and get confirmation
  → Then proceed

### Implement Tests

Once test design is confirmed, write actual Mocha/Chai tests in `<worktree>/test/`.

These become your specification - implementation will make them pass.

**Test Structure:**
```javascript
describe('FeatureName', () => {
  describe('happy path', () => {
    it('should handle typical input correctly', () => {
      // Arrange, Act, Assert
    });
  });

  describe('edge cases', () => {
    it('should handle boundary condition X', () => {
      // Test
    });
  });

  describe('error paths', () => {
    it('should reject invalid input with clear message', () => {
      // Test error handling
    });
  });
});
```

**Verify tests fail initially** (no implementation yet):
Run: `cd "<worktree>" && npx mocha test/**/*.test.js --reporter spec`

All tests should fail with clear messages showing what's missing.

**Update GUIDE.md** with test implementation complete:
- Mark Phase 2-B fully complete in "Current State of Understanding"
- Note test file locations

Announce: "✓✓ Tests written and failing as expected. Ready for Phase 3 implementation..."

---

## Phase 2-C: Infrastructure Planning

**📥 Input Files:**
- `<worktree>/planning/architecture.md` + `tooling.md` (Phase 1 Stage 3 - technology decisions)
- `<worktree>/planning/test-plan.md` (Phase 2-B output - test requirements)
- `<worktree>/planning/GUIDE.md` (Phase 2-B confirmation)

**📤 Output Files:**
- `<worktree>/planning/project-structure.md` (knowledge file - directory layout, code organization)
- `<worktree>/planning/tech-relationships.md` (knowledge file - component dependencies, data flow)
- `<worktree>/planning/infrastructure-ids.md` (knowledge file - service IDs, endpoints, credentials, rate limits)
- `<worktree>/planning/tooling.md` (updated with integration workflow details)
- `<worktree>/planning/p2c-infra-planning-journal.md` (journal file - infrastructure decisions, tooling integration planning)
- `<worktree>/planning/GUIDE.md` (updated with Phase 2-C confirmation and transition log)

**📝 Documentation Output:**
- **Files Created:** `<worktree>/planning/project-structure.md`, `<worktree>/planning/tech-relationships.md`, `<worktree>/planning/infrastructure-ids.md`, `<worktree>/planning/tooling.md`
- **Purpose:** Establish code organization, component dependencies, infrastructure IDs/endpoints, and tooling integration strategy before task decomposition
- **Referenced By:** Phase 2-D (task dependencies and infrastructure refs), Phase 3 (implementation planning and tooling usage), Phase 4 (integration validation)

---

📖 **Context Reminder:** Before task decomposition, establish the infrastructure foundation.
Review GUIDE.md and reference `<worktree>/planning/architecture.md` for technical context.

**Where We Are in the Journey:**

We have understanding (Phase 1), quality criteria (Phase 2), and test specifications (Phase 2-B).
Now we establish the infrastructure foundation - project structure, technology relationships,
configuration identifiers, and tooling integration strategy.

**What This Phase Reveals:**

Infrastructure planning prevents chaos. By documenting project structure, integration patterns,
configuration needs, and tooling strategy upfront, we create a solid foundation for task-based
implementation. This phase answers "what infrastructure do we need?" before Phase 2-D answers
"what tasks do we build?"

**Your Planning Approach:**

Think through the infrastructure needed to support the complete journey from empty directory
to working, tested, integrated solution.

### Step 1: Define Project Structure

**Map out the directory structure** based on Stage 3 architecture:

**Consider the existing structure first:**
- Is there already a repository structure in place?
- What conventions are already established?
- What existing code or projects need to be integrated?
- Are we working within an existing codebase or starting fresh?

**Consider repository organization strategy:**

This project follows a **poly repo approach** (multiple related repositories, each focused and independent) rather than a monorepo. Think about:

- **Poly Repo Benefits:**
  - Independent deployment cycles per repository
  - Clearer ownership boundaries
  - Simpler CI/CD per project
  - Smaller, more focused codebases
  - Can use different tech stacks per repo

- **When to create separate repositories:**
  - Independently deployable services/components
  - Different release schedules or versioning needs
  - Different teams or ownership
  - Reusable libraries/packages
  - Frontend vs. backend separation

- **Within this specific repository (worktree):**
  - Where will source code live? (`src/`, `lib/`, language-specific conventions?)
  - How should modules be organized? (By feature? By layer? By component?)
  - Where do tests belong? (Alongside code? In separate `test/` tree?)
  - What configuration files are needed? (package.json, tsconfig.json, .env templates?)
  - What documentation structure makes sense? (README, API docs, architecture diagrams?)

- **Cross-repository considerations:**
  - How does this repository relate to other repositories in the poly repo structure?
  - What shared libraries or dependencies exist across repositories?
  - How will services communicate? (APIs, events, shared databases?)
  - What documentation lives in each repository vs. centralized?

**Document the structure** to `<worktree>/planning/project-structure.md`:

```markdown
# Project Structure

## Existing Structure Assessment
- [Describe any existing repository structure]
- [Note established conventions to follow]
- [Identify existing code/projects to integrate with]
- [Starting fresh or working within existing codebase?]

## Repository Organization (Poly Repo Context)
- **This Repository's Role**: [Describe what this specific repository handles in the poly repo architecture]
- **Related Repositories**: [List other repositories in the poly repo and how they relate]
- **Shared Dependencies**: [Libraries/packages shared across repositories]
- **Inter-Repository Communication**: [How services/components communicate: REST APIs, events, message queues, etc.]

## Directory Layout (This Repository)
\`\`\`
<worktree>/
├── src/                    # Implementation code
│   ├── core/              # Core business logic
│   ├── services/          # External service integrations
│   ├── utils/             # Shared utilities
│   └── index.js           # Main entry point
├── test/                   # Test suites
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── docs/                   # Documentation
├── config/                 # Configuration templates
└── planning/               # Craft planning artifacts
\`\`\`

## Module Organization
- [Explain the organizational principle: feature-based, layered, etc.]
- [Map which modules handle which responsibilities]
- [Note any modules/patterns inherited from existing structure]

## Key Entry Points
- [Main execution entry: src/index.js]
- [Test entry: test/index.test.js]
- [Configuration: config/*.json]

## Cross-Repository Integration Points
- [API endpoints consumed from other repositories]
- [API endpoints exposed to other repositories]
- [Shared data models or contracts]
- [Events published/subscribed across repositories]

## Task-Based Development Structure
\`\`\`
<worktree>/
├── planning/
│   ├── tasks-pending/      # End-to-end feature tasks awaiting implementation
│   ├── tasks-completed/    # Completed feature tasks with outcomes
│   └── learnings.md        # Cumulative lessons learned during implementation
\`\`\`

**Purpose:**
- Each task defines complete end-to-end feature work (UI/API/schema/service/DB/etc) with quality verification, testing, and fix loops until tests pass and quality gates met.
- `learnings.md` captures insights discovered during implementation that weren't apparent during planning, creating a feedback loop that improves subsequent tasks.
```

**Migration Planning (If Modifying Existing System):**

If working with an existing codebase, add a migration section to `project-structure.md`:

```markdown
## Migration from Current to New State

### Current State Assessment
**Examine existing system:**
```bash
# Review current directory structure
ls -la "<worktree>"

# Identify existing source files
find "<worktree>" -type f -name "*.js" -o -name "*.ts" -o -name "*.py" | head -20

# Check existing dependencies
cat "<worktree>/package.json" 2>/dev/null || echo "No package.json found"
```

**Document current state:**
- Existing directory structure and organization
- Current modules and their responsibilities
- Established patterns and conventions
- Existing tests and coverage
- Dependencies and integrations
- Known technical debt or issues

### Desired Future State
- Target directory structure (from Directory Layout above)
- New/refactored modules and organization
- Patterns to establish or improve
- Test strategy improvements
- Dependency updates or additions
- Technical debt to address

### Migration Strategy

**🔑 Critical Migration Classification:**

**FIRST: Determine if this is a one-time migration or repeatable migration:**

**One-Time Migration:**
- **Definition:** Migration runs once per environment (dev → staging → prod), then never again
- **Examples:**
  - Initial database schema creation
  - One-time data migration from legacy system
  - Refactoring existing code structure
  - One-time configuration updates
- **Approach:** Manual or scripted migration with verification, no framework needed
- **CI/CD Strategy:** Document migration steps in runbook, execute manually per environment

**Repeatable Migration:**
- **Definition:** Migration runs multiple times (per deploy, per environment, or on-demand)
- **Examples:**
  - Database schema migrations (new tables, columns, indexes)
  - Data transformations that must sync with code changes
  - Configuration updates tied to feature flags
  - Environment-specific setup that must stay synchronized
- **Approach:** **REQUIRES migration framework** with version tracking, rollback capability, idempotency
- **CI/CD Strategy:** Automated migration execution before deployment

**Decision Framework:**
Ask these questions to classify:
1. Will this migration need to run again when deploying to staging? prod? → If yes, REPEATABLE
2. Does this migration correspond to a code change that will be deployed multiple times? → If yes, REPEATABLE
3. Is this a structural change (schema, config) vs one-time data fix? → Structural = REPEATABLE
4. Could this migration fail and need to be re-run? → If yes, needs idempotency = REPEATABLE

**IF REPEATABLE: Select/Create Migration Framework:**

**Option A: Use Existing Framework (Preferred)**
- **Database:** Prisma Migrate, Flyway, Liquibase, Django migrations, Rails migrations
- **Infrastructure:** Terraform, CloudFormation, Ansible
- **Configuration:** Config management tools with version tracking

**Option B: Create Custom Framework (Only if no suitable existing framework)**
- **Requirements:**
  - Version tracking (migration history table/file)
  - Idempotency (safe to run multiple times)
  - Rollback capability (undo on failure)
  - Atomic execution (all or nothing)
  - Logging and audit trail
- **Implementation:** Create migration framework task in Phase 2-D, implement in Phase 3

**Document Migration Decision** in `project-structure.md`:
```markdown
## Migration Classification: [ONE-TIME | REPEATABLE]

**Reasoning:** [Explain why this migration is one-time or repeatable]

**IF ONE-TIME:**
- Migration steps documented in `docs/MIGRATION_RUNBOOK.md`
- Manual execution per environment with verification checklist
- No CI/CD automation needed

**IF REPEATABLE:**
- Migration framework: [Framework name, e.g., "Prisma Migrate"]
- Migration location: `<worktree>/migrations/` or `<worktree>/src/migrations/`
- Version tracking: [How migrations are tracked and ordered]
- Rollback strategy: [How to undo failed migrations]
- CI/CD integration: Migrations run automatically before deployment
```

**Incremental migration approach:**
- Which components can be migrated independently?
- What's the safest migration order? (least to most risky)
- How to maintain backward compatibility during transition?
- What rollback plan exists if migration fails?

**Migration phases (if complex):**
1. Phase 1: [e.g., Create new structure alongside old]
2. Phase 2: [e.g., Migrate core utilities first]
3. Phase 3: [e.g., Migrate features incrementally]
4. Phase 4: [e.g., Remove old structure, update references]

**Validation checkpoints:**
- How to verify each migration phase succeeded?
- What tests confirm old and new work equivalently?
- How to monitor for regressions during migration?

### Backward Compatibility Considerations
- What existing interfaces must remain stable?
- Which consumers depend on current structure/APIs?
- How long must old and new coexist?
- What deprecation strategy applies?

### Risk Assessment
- **High Risk Areas:** [Components where migration could break functionality]
- **Mitigation:** [How to test/validate these areas thoroughly]
- **Rollback Triggers:** [What conditions would require reverting migration]
```

**If starting fresh (no migration needed):**
Skip the migration section - you're building on a clean foundation.

### Step 1b: Establish Task-Based Development Workflow

**Create task folders and learnings file:**
```bash
mkdir -p "<worktree>/planning/tasks-pending"
mkdir -p "<worktree>/planning/tasks-completed"
touch "<worktree>/planning/learnings.md"
```

Initialize `<worktree>/planning/learnings.md` with:
```markdown
# Implementation Learnings

This file captures lessons learned during implementation that weren't apparent during planning.
Each task contributes insights that improve subsequent tasks, creating a continuous learning loop.

---
```

**Task-Based Development Philosophy:**

Instead of building everything in a linear sequence, break features into discrete end-to-end tasks.
Each task represents a complete vertical slice of functionality - from user interface through business
logic to data persistence - that can be implemented, tested, verified, and completed independently.

**What is a Task?**

A task is a self-contained feature implementation that includes:
- **UI Components** (if applicable): Frontend forms, displays, interactions
- **API Endpoints** (if applicable): Request handlers, routing, validation
- **Schema Changes** (if applicable): Database migrations, model updates
- **Service Logic**: Core business logic, data transformations, workflows
- **Data Access**: Repository methods, database queries, persistence
- **Quality Verification**: Code review, criteria checking, integration testing
- **Test Coverage**: Unit tests, integration tests, edge cases, error paths
- **Fix Loops**: Iterate until all tests pass and quality gates met

**Creating Task Files:**

For each feature from Stage 1 use cases, create a task file in `<worktree>/planning/tasks-pending/`:

`<worktree>/planning/tasks-pending/task-001-[feature-name].md`:
```markdown
# Task 001: [Feature Name]

## Feature Description
[Brief description from Stage 1 use case]

## Implementation Scope

### UI Components
- [ ] Component 1: [Description]
- [ ] Component 2: [Description]

### API Endpoints
- [ ] POST /api/endpoint1 - [Purpose]
- [ ] GET /api/endpoint2 - [Purpose]

### Schema Changes
- [ ] Migration: [Description]
- [ ] Model updates: [Fields to add/modify]

### Service Logic
- [ ] Service method 1: [Business logic description]
- [ ] Service method 2: [Workflow description]

### Data Access
- [ ] Repository method 1: [Query description]
- [ ] Repository method 2: [Persistence description]

### Quality Gates
- [ ] Code review passed (no blocking issues)
- [ ] Quality criteria score ≥ [threshold from Phase 2]
- [ ] All integration points tested
- [ ] Security validation complete

### Test Requirements
From `<worktree>/planning/test-plan.md` for this feature:
- [ ] Unit tests: [List key unit tests]
- [ ] Integration tests: [List integration test scenarios]
- [ ] Edge cases: [List edge cases to cover]
- [ ] Error paths: [List error scenarios]

## Dependencies
- Prerequisites: [Other tasks that must complete first]
- Blocks: [Tasks that depend on this one]

## Infrastructure References
From `<worktree>/planning/infrastructure-ids.md`:
- [List relevant IDs, endpoints, config values needed]

## Architecture References
From `<worktree>/planning/architecture.md`:
- [Relevant architectural decisions and patterns]

## Learnings References
From `<worktree>/planning/learnings.md` (if exists):
- [Relevant lessons from previous tasks]
- [Patterns that worked well]
- [Pitfalls to avoid]

## Implementation Plan (Pre-Implementation)
[To be filled at start of task execution - Step 3 of Task Execution Loop]
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
```

**Task Execution Loop:**

The implementation workflow operates as a task-driven loop:

```
WHILE tasks exist in tasks-pending/:
  1. SELECT next task from tasks-pending/ (respect dependencies)

  2. ANNOUNCE task start:
     "📋 Starting Task [N]: [Feature Name]"

  3. PLAN this specific task implementation:
     → Read `<worktree>/planning/learnings.md` if it exists
     → Consider lessons from previous tasks:
        * What patterns worked well?
        * What pitfalls were discovered?
        * What architectural insights emerged?
        * What testing strategies proved effective?
     → Review task requirements and dependencies
     → Form implementation hypothesis:
        * What's the approach for this task?
        * How does it build on previous learnings?
        * What risks are specific to this task?
        * What integration points need attention?
     → Document task-specific plan in task file under new section:
        "## Implementation Plan (Pre-Implementation)"

  4. IMPLEMENT task components:
     FOR EACH component in task scope:
       - Write implementation code
       - Write corresponding tests
       - Commit incremental progress
     END FOR

  5. QUALITY VERIFICATION LOOP:
     WHILE quality gates not met OR tests failing:
       - Run test suite for this task's code
       - Analyze failures and fix issues
       - Run code review for this task's code
       - Address code review feedback
       - Check quality criteria for this task
       - Refactor to improve quality if needed
       - Commit fixes
     END WHILE

  6. FINAL VALIDATION:
     - Verify all task checkboxes complete
     - Confirm all acceptance criteria met
     - Run full integration test for this feature

  7. COMPLETE task:
     - Fill "Completion Notes" section with:
        * Iterations required
        * Key learnings discovered during implementation
        * Issues encountered and solutions
        * Quality score achieved
     - Move task file from tasks-pending/ to tasks-completed/
     - Update iteration log
     - Commit final task completion

  8. CAPTURE learnings:
     → Review what was learned during this task
     → Check if architecture.md needs updates:
        * New architectural patterns discovered?
        * Integration approaches that worked well?
        * Technology choices that should be documented?
        * IF YES: Update `<worktree>/planning/architecture.md`
     → Check if new lessons emerged:
        * Insights not apparent when we started?
        * Patterns that would help future tasks?
        * Pitfalls to avoid in similar situations?
        * Testing strategies that proved valuable?
        * IF YES: Append to `<worktree>/planning/learnings.md`:

     ```markdown
     ## [Date] - Task [N]: [Feature Name]

     ### What We Learned
     - [Key insight 1 that wasn't obvious upfront]
     - [Pattern that worked particularly well]
     - [Pitfall discovered and how to avoid it]

     ### Impact on Future Work
     - [How this affects remaining tasks]
     - [What to watch out for in similar features]
     - [Recommendations for next implementer]

     ### Architectural Insights
     - [If any architectural patterns emerged]
     - [If integration approaches proved better than planned]
     ```

     → Commit learnings if captured:
        `git -C "<worktree>" commit -am "Learnings: Task [N] - [Brief insight]"`

  9. ANNOUNCE task completion:
     "✓ Task [N] Complete: [Feature Name] ([X] iterations, quality score [Y])"
     IF learnings captured:
       "📝 Key learnings documented for future tasks"

  10. Continue to next task
END WHILE

When tasks-pending/ is empty:
  → All features implemented
  → Review cumulative learnings in learnings.md
  → Proceed to Phase 3 final quality pass
  → Then Phase 4 delivery preparation
```

**Task Prioritization:**

When selecting next task from tasks-pending/:
1. **Dependencies first**: Tasks with no pending prerequisites
2. **Foundation before features**: Core utilities before features that use them
3. **High-risk first**: Complex or uncertain tasks tackled early
4. **User value**: Prioritize tasks that deliver visible user value

**Autonomous Iteration Within Tasks:**

During task execution (Step 4: Quality Verification Loop), iterate autonomously:
- Fix failing tests without prompting user
- Address code review feedback iteratively
- Refactor to meet quality criteria
- Debug implementation issues

Only prompt user when:
- Task's fundamental approach is broken (catastrophic failure)
- Critical architectural decision needed (affects other tasks)
- Clarification required on task requirements (ambiguity)
- Maximum reasonable iterations reached (e.g., 10+ iterations on single task)

**Benefits of Task-Based Approach:**

1. **Clear Progress**: Each completed task = tangible progress
2. **Parallel Potential**: Independent tasks could be parallelized (future enhancement)
3. **Isolated Quality**: Quality verification scoped to task, not entire codebase
4. **Manageable Scope**: Bite-sized work units prevent overwhelm
5. **Flexible Ordering**: Can adjust task priority as understanding evolves
6. **Complete Features**: Each task delivers working, tested, integrated functionality

**Integration with Implementation Steps:**

The serialized implementation steps from Step 4 inform task breakdown:
- Phase 1 (Foundation) → Tasks for core models and utilities
- Phase 2 (Service Integration) → Tasks for auth and external clients
- Phase 3 (Business Logic) → Tasks for each use case from Stage 1
- Phase 4 (Quality) → Cross-task quality improvements if needed
- Phase 5 (Finalization) → Documentation and polish tasks

### Step 2: Document Technology Relationships

**Map how technologies interact** based on Stage 3 research:

Think about:
- How does the application connect to external systems? (APIs, databases, services?)
- What authentication/authorization mechanisms are used?
- How do components communicate? (REST, events, direct calls?)
- What data flows between systems? (Format, validation, transformation?)
- What are the integration boundaries? (Network calls, database queries, file I/O?)

**Document technology relationships** to `<worktree>/planning/tech-relationships.md`:

```markdown
# Technology Relationships

## System Integration Map
[Diagram or description of how systems connect]

## Authentication & Authorization
- [How the app authenticates to external services]
- [What credentials are needed]
- [Where auth tokens are managed]

## Data Flow
- [Input sources → Processing → Output destinations]
- [Data transformation points]
- [Validation boundaries]

## Integration Patterns
- [Pattern used for API calls]
- [Pattern used for database access]
- [Error handling strategy at boundaries]
```

### Step 3: Document Infrastructure Identifiers

**⚠️ IMPORTANT:** Create `<worktree>/planning/infrastructure-ids.md` to centralize all IDs, credentials references, and configuration values.

This file serves as the single source of truth for infrastructure configuration that implementation phases will reference.

**Document all identifiers** to `<worktree>/planning/infrastructure-ids.md`:

```markdown
# Infrastructure Identifiers

**Purpose:** Central registry of all infrastructure IDs, endpoints, and configuration references needed during implementation.

**⚠️ Security Note:** This file contains REFERENCES to credentials, not actual secrets. Actual secrets go in environment variables or secure vaults.

## Service Identifiers
- **Script ID**: [Google Apps Script project ID, if applicable]
- **Project ID**: [GCP project ID, AWS account, etc.]
- **API Endpoints**: [Base URLs for external services]

## Authentication References
- **Environment Variables Needed**:
  - `API_KEY` - [Description of what this authorizes]
  - `SERVICE_ACCOUNT_EMAIL` - [For GCP service accounts]
  - `DATABASE_URL` - [Connection string pattern]

## Resource Identifiers
- **Database IDs**: [Database names, table names]
- **Storage Buckets**: [Cloud storage bucket names]
- **Queue Names**: [Message queue identifiers]

## Configuration Values
- **Timeouts**: [Default timeout values for various operations]
- **Rate Limits**: [API rate limits to respect]
- **Retry Policies**: [How many retries, backoff strategy]

## References
- See `architecture.md` for architectural context
- See `.env.template` for environment variable format
```

**During implementation:** Reference this file when writing code that needs infrastructure values.

### Step 3b: Plan Tooling Integration Strategy

**⚠️ IMPORTANT:** Reference the tooling discoveries from `<worktree>/planning/tooling.md` and plan their integration into the development workflow.

This step ensures discovered tools (MCP servers, subagents, APIs, quality tools) are intentionally
integrated rather than ad-hoc adopted.

**Review Discovered Tools:**

Read `<worktree>/planning/tooling.md` to identify what was discovered during Stage 3 tooling research.

**For Each Tool Category:**

**1. MCP Servers**
Review which MCP servers were discovered and documented:
- What operations do they provide?
- Which phases/iterations will use them?
- What setup is required? (installation, authentication, configuration)
- How will they be accessed? (direct protocol calls, wrapper functions)

**2. Claude Code Subagents**
Review which subagents match workflow needs:
- When will each subagent be invoked? (code review after implementation, testing support, deployment)
- What parameters/context will each need?
- Can any subagent work run in parallel?
- How will results be integrated back?

**3. External APIs & Services**
Review third-party integrations:
- Which APIs support use cases?
- What authentication is needed? (reference infrastructure-ids.md)
- What integration pattern? (direct API calls, abstraction layer, MCP server wrapper)
- What error handling and retry logic?

**4. Testing & Quality Tools**
Review automation tools for quality validation:
- Browser automation for UI testing?
- API testing tools for integration tests?
- Performance profiling for NFR validation?
- Security scanning for vulnerability detection?
- When in workflow will each run?

**Document Tooling Integration Plan** to `<worktree>/planning/tooling.md`:

```markdown
# Tooling Integration Plan

**Purpose:** How discovered tools from Stage 3 will be integrated into the development workflow.

## MCP Servers

### [Server Name 1]
- **Capabilities**: [What it provides]
- **When Used**: [Which phases/iterations]
- **Setup Required**:
  - Installation: [npm install command or instructions]
  - Configuration: [Config files, environment variables]
  - Authentication: [Reference to infrastructure-ids.md]
- **Integration Pattern**: [How accessed - direct calls, wrapper]
- **Example Usage**: [Brief code example or workflow description]

### [Server Name 2]
...

## Claude Code Subagents

### Code Review (code-reviewer)
- **When Invoked**: After implementation in each iteration, before considering code complete
- **Parameters Needed**: path to src/, iteration number, focus areas from criteria
- **Expected Output**: Review results with blocking/minor issues, file:line references
- **Integration**: Blocking issues must be resolved before proceeding to next iteration step

### [Other Subagents]
...

## External APIs & Services

### [API Name 1]
- **Purpose**: [What use case it supports]
- **Authentication**: [Reference to infrastructure-ids.md entry]
- **Integration Pattern**: [Direct/Abstraction/MCP wrapper - with reasoning]
- **Error Handling**: [Retry logic, fallback behavior]
- **Rate Limits**: [Limits to respect, throttling strategy]
- **When Used**: [Which implementation phases]

### [API Name 2]
...

## Testing & Quality Tools

### Unit Testing
- **Framework**: Mocha + Chai (already established)
- **When Run**: After each implementation, in verification loop
- **Coverage Target**: [Percentage from quality criteria]

### Integration Testing
- **Tools**: [Browser automation, API testing tools]
- **When Run**: [Which iterations, frequency]
- **Test Scope**: [What integration points covered]

### Performance Testing
- **Tools**: [Profiling tools if needed]
- **When Run**: [After implementation complete, or specific iterations]
- **Metrics**: [NFR thresholds from Stage 2]

### Security Scanning
- **Tools**: [Static analysis, dependency scanning]
- **When Run**: [Before final delivery, or continuously]
- **Focus**: [Vulnerability types from Stage 2 security requirements]

## Integration Workflow

**Phase 2-C (Planning):**
- Set up MCP servers: [Installation and configuration steps]
- Verify subagent availability: [Check Task tool subagent list]
- Configure external API access: [Auth setup, test connectivity]
- Install testing tools: [npm install commands]

**Phase 3 Iterations:**
- **Step 2 (Plan)**: Reference this document for tool usage in iteration
- **Step 3 (Craft)**:
  - Use MCP servers for: [Specific operations]
  - Call external APIs for: [Specific integrations]
- **Step 4 (Verify)**:
  - Run test suite (Mocha/Chai)
  - Invoke code-reviewer subagent
  - Run integration tests if applicable
  - Run performance/security tools if applicable

**Phase 4 (Delivery):**
- Final quality tool runs
- Complete integration validation
- Performance verification against NFRs

## Setup Checklist

Before starting Phase 3 implementation, verify:
- [ ] All MCP servers installed and configured
- [ ] MCP server authentication tested (if required)
- [ ] Subagent availability confirmed
- [ ] External API credentials in environment (per infrastructure-ids.md)
- [ ] External API connectivity tested
- [ ] Testing tools installed (npm packages)
- [ ] Tooling integration documented in this file

## References
- Stage 3 Architecture: `<worktree>/planning/architecture.md` (technical decisions)
- Stage 3 Tooling: `<worktree>/planning/tooling.md` (discovered tools)
- Infrastructure IDs: `<worktree>/planning/infrastructure-ids.md` (credentials, endpoints)
- Quality Criteria: `<worktree>/planning/quality-criteria.md` (quality thresholds, tool targets)
```

**Present Tooling Plan to User:**

As part of Phase 2-C presentation (Step 6), include tooling integration summary:

"**Tooling Integration Strategy:**
I've documented how the tools discovered in Stage 3 will be integrated:

**MCP Servers:** [List servers and when they'll be used]
**Subagents:** [List subagents and their roles (code review, testing, etc.)]
**External APIs:** [List APIs and integration patterns]
**Quality Tools:** [List testing/validation tools and when they run]

Setup checklist created in `<worktree>/planning/tooling.md` to verify readiness before Phase 3."

### Step 4: Present Planning to User

**Present the complete infrastructure planning:**

"📋 **Phase 2-C: Infrastructure Planning Complete**

I've documented the complete infrastructure foundation for development:

**Project Structure:**
[Summarize directory organization and module layout]

**Technology Integration:**
[Summarize how systems connect and authenticate]

**Infrastructure Setup:**
All configuration identifiers documented in `<worktree>/planning/infrastructure-ids.md`
- Reference this file during implementation for IDs, endpoints, credentials

**Tooling Integration Strategy:**
[Summarize MCP servers, subagents, APIs, quality tools and when they'll be used]

**Key Infrastructure Documents:**
- `<worktree>/planning/project-structure.md` - Directory layout and organization
- `<worktree>/planning/tech-relationships.md` - System integration map
- `<worktree>/planning/infrastructure-ids.md` - Central ID/config registry
- `<worktree>/planning/tooling.md` - How discovered tools will be integrated

**Ready to proceed to task decomposition?**"

**[WAIT for user confirmation]**

IF the user confirms:
  → **Update GUIDE.md** with infrastructure planning completion:
     * Edit `<worktree>/planning/GUIDE.md` section "Current State of Understanding"
       Add: "Phase 2-C complete: Infrastructure planning established"
     * Update "Key Documents Reference" to include infrastructure docs

  → Announce: "✓ Infrastructure planning complete. Moving to Phase 2-D: Task Decomposition..."
  → Move to Phase 2-D

IF the user requests changes:
  → Revise specific infrastructure documents based on feedback
  → Re-present and get confirmation
  → Then proceed to Phase 2-D

---

## Phase 2-D: Feature Task Decomposition

**📥 Input Files:**
- `<worktree>/planning/use-cases.md` (Phase 1 Stage 1 - features to decompose)
- `<worktree>/planning/requirements.md` (Phase 1 Stage 2 - functional requirements)
- `<worktree>/planning/task-definition.md` (Phase 1 Stage 6 - synthesized understanding)
- `<worktree>/planning/project-structure.md` + `tech-relationships.md` + `infrastructure-ids.md` (Phase 2-C - infrastructure context)
- `<worktree>/planning/GUIDE.md` (Phase 2-C confirmation)

**📤 Output Files:**
- `<worktree>/planning/implementation-steps.md` (knowledge file - task ordering, dependency phases, prioritization)
- `<worktree>/planning/tasks-pending/task-NNN-[name].md` (multiple task files - one per atomic feature)
- `<worktree>/planning/p2d-task-breakdown-journal.md` (journal file - decomposition process, dependency analysis)
- `<worktree>/planning/GUIDE.md` (updated with Phase 2-D confirmation and transition log)

**📝 Documentation Output:**
- **Files Created:** `<worktree>/planning/implementation-steps.md`, `<worktree>/planning/tasks-pending/task-NNN-[name].md` (one per feature)
- **Purpose:** Decompose use cases into discrete, implementable tasks with dependencies, scope, quality gates, and test requirements
- **Referenced By:** Phase 3 (task selection and execution order), Phase 4 (retrospective on completed tasks)

---

📖 **Context Reminder:** With infrastructure planned, now decompose features into implementable tasks.
Review GUIDE.md and reference Phase 1 use cases plus infrastructure documents from Phase 2-C.

**Where We Are in the Journey:**

We have understanding (Phase 1), quality criteria (Phase 2), test specifications (Phase 2-B), and
infrastructure foundation (Phase 2-C). Now we break features from Stage 1 use cases into discrete,
implementable tasks that can be executed independently with clear completion criteria.

**What This Phase Reveals:**

Task decomposition transforms abstract use cases into concrete work units. Each task represents a
complete end-to-end vertical slice of functionality that can be implemented, tested, verified, and
completed independently. By creating all task files upfront, we can see the complete scope, estimate
effort, identify dependencies, and present a clear roadmap before implementation begins.

**Your Decomposition Approach:**

Transform each use case into one or more tasks, ensuring each task is independently testable and
delivers tangible user value.

### Step 1: Review Use Cases and Plan Implementation Order

**Read Stage 1 use cases** from `<worktree>/planning/task-definition.md`:

Review the primary and alternative use cases identified during understanding phase:
- What are the core user workflows?
- What features support those workflows?
- What are the dependencies between features?
- What order makes sense for implementation?

**Consider implementation phases:**

Think about logical groupings and dependencies:
- What must exist before other things can be built?
- What's the foundation that everything depends on?
- What can be built independently?
- What requires integration testing?

**Plan serialized implementation order** - document phases to `<worktree>/planning/implementation-steps.md`:

```markdown
# Implementation Steps

**Purpose:** Define the serialized order for implementing tasks, grouping them into logical phases
based on dependencies and complexity.

## Phase 1: Foundation (Tasks 001-NNN)
**Goal:** Establish core data structures and utilities

**Tasks:**
- Task 001: Core data models with validation
- Task 002: Shared utility functions and error handling
- Task 003: Logging infrastructure

**Exit Criteria:** Core models tested and validated, utilities available for use

**Rationale:** Foundation must exist before building features that depend on it

## Phase 2: Service Integration (Tasks NNN-NNN)
**Goal:** Connect to external systems

**Tasks:**
- Task NNN: Authentication setup and credential management
- Task NNN: External service client implementations
- Task NNN: Database connection and error handling

**Exit Criteria:** Can authenticate and make basic API calls to all required services

**Rationale:** Service integration provides the external connections needed for business logic

## Phase 3: Business Logic (Tasks NNN-NNN)
**Goal:** Implement core use cases from Stage 1

**Tasks:**
- Task NNN: Primary use case - [Use case name from Stage 1]
- Task NNN: Alternative flow - [Alternative scenario]
- Task NNN: Error handling - [Exception flows from Stage 1]

**Exit Criteria:** All use cases working with passing tests

**Rationale:** Business logic delivers user value and fulfills project requirements

## Phase 4: Quality & Integration (Tasks NNN-NNN)
**Goal:** Achieve quality criteria and full integration

**Tasks:**
- Task NNN: Code quality refactoring based on reviews
- Task NNN: End-to-end integration testing
- Task NNN: Performance optimization for NFRs

**Exit Criteria:** Quality score ≥ [threshold from Phase 2], all integration points working

**Rationale:** Quality work ensures maintainability and production readiness

## Phase 5: Finalization (Tasks NNN-NNN)
**Goal:** Polish and delivery preparation

**Tasks:**
- Task NNN: Edge case coverage and error path validation
- Task NNN: Documentation (usage guide, API docs, deployment)
- Task NNN: Final integration validation

**Exit Criteria:** All tests passing, documentation complete, ready for deployment

**Rationale:** Finalization ensures complete delivery with no loose ends

## Task Prioritization Principles

When implementing tasks in Phase 3:
1. **Dependencies first**: Tasks with no pending prerequisites
2. **Foundation before features**: Core utilities before features that use them
3. **High-risk first**: Complex or uncertain tasks tackled early
4. **User value**: Prioritize tasks that deliver visible user value

## References
- Use Cases: `<worktree>/planning/task-definition.md`
- Architecture: `<worktree>/planning/architecture.md`
- Infrastructure: `<worktree>/planning/infrastructure-ids.md`
- Quality Criteria: `<worktree>/planning/quality-criteria.md`
```

### Step 2: Create Task Files for Each Feature

**For each feature/use case from Stage 1**, create a task file in `<worktree>/planning/tasks-pending/`.

**Task File Naming Convention:** `task-NNN-[feature-name].md` where:
- NNN is zero-padded task number (001, 002, 003...)
- feature-name is kebab-case description (e.g., "user-authentication", "data-export")

**Task File Template Structure:**

Each task file should follow this comprehensive structure (reference the template from Phase 2-C Step 1b):

`<worktree>/planning/tasks-pending/task-001-[feature-name].md`:
```markdown
# Task 001: [Feature Name]

## Feature Description
[Brief description from Stage 1 use case - what user value does this deliver?]

## Implementation Scope

### UI Components (if applicable)
- [ ] Component 1: [Description]
- [ ] Component 2: [Description]

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

### Quality Gates
- [ ] Code review passed (no blocking issues)
- [ ] Quality criteria score ≥ [threshold from Phase 2]
- [ ] All integration points tested
- [ ] Security validation complete

### Test Requirements
From `<worktree>/planning/test-plan.md` for this feature:
- [ ] Unit tests: [List key unit tests]
- [ ] Integration tests: [List integration test scenarios]
- [ ] Edge cases: [List edge cases to cover]
- [ ] Error paths: [List error scenarios]

## Dependencies
- Prerequisites: [Other tasks that must complete first, if any]
- Blocks: [Tasks that depend on this one completing]

## Infrastructure References
From `<worktree>/planning/infrastructure-ids.md`:
- [List relevant IDs, endpoints, config values needed]

## Architecture References
From `<worktree>/planning/architecture.md`:
- [Relevant architectural decisions and patterns]

## Learnings References
From `<worktree>/planning/learnings.md` (if exists from previous tasks):
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
```

**Create task files systematically:**

Work through use cases from task-definition.md:
1. Primary use case → Task 001
2. Related features → Tasks 002, 003, etc.
3. Alternative flows → Additional tasks
4. Quality/polish work → Final phase tasks

**Example task creation process:**

```bash
# Create first task for primary use case
cat > "<worktree>/planning/tasks-pending/task-001-user-authentication.md" << 'EOF'
# Task 001: User Authentication

## Feature Description
Implement user login/logout functionality with OAuth integration.
From Stage 1 primary use case: "User authenticates to access protected features"

## Implementation Scope
...
EOF

# Create second task for dependent feature
cat > "<worktree>/planning/tasks-pending/task-002-session-management.md" << 'EOF'
# Task 002: Session Management

## Feature Description
Manage user session lifecycle with token refresh.
Depends on Task 001 (authentication) being complete.

## Dependencies
- Prerequisites: Task 001 (user-authentication)
...
EOF
```

**🔄 CI/CD and Migration Task Creation:**

**IF migrations exist (from Phase 2-C Migration Strategy):**

Create CI/CD tasks to handle migration and deployment automation. The CI/CD task loop ensures migrations run before deployment in every environment.

**Task Creation Based on Migration Type:**

**For ONE-TIME Migrations:**
```bash
# Create runbook documentation task (no automation needed)
cat > "<worktree>/planning/tasks-pending/task-[NNN]-migration-runbook.md" << 'EOF'
# Task [NNN]: Migration Runbook Documentation

## Feature Description
Document one-time migration steps for manual execution per environment.
Migration will run once in dev, once in staging, once in prod.

## Implementation Scope
- [ ] Document current state assessment steps
- [ ] Document migration execution steps with verification
- [ ] Document rollback procedures
- [ ] Create verification checklist
- [ ] Document environment-specific considerations

## Deliverables
- `<worktree>/docs/MIGRATION_RUNBOOK.md` with complete instructions
- Verification scripts for each migration phase
- Rollback scripts if migration fails

## Acceptance Criteria
- [ ] Runbook tested in development environment
- [ ] All steps documented with expected outcomes
- [ ] Rollback procedures verified
- [ ] Team reviewed and approved runbook
EOF
```

**For REPEATABLE Migrations:**
```bash
# Create migration framework task (if custom framework needed)
cat > "<worktree>/planning/tasks-pending/task-[NNN]-migration-framework.md" << 'EOF'
# Task [NNN]: Migration Framework Implementation

## Feature Description
Build migration framework with version tracking, idempotency, and rollback.
Framework will run automatically before every deployment via CI/CD.

## Implementation Scope
- [ ] Migration version tracking system (history table/file)
- [ ] Migration execution engine (run pending migrations)
- [ ] Idempotency checks (safe to run multiple times)
- [ ] Rollback mechanism (undo on failure)
- [ ] Atomic execution (all or nothing per migration)
- [ ] Logging and audit trail

## Test Requirements
- [ ] Unit tests for migration engine
- [ ] Integration tests with sample migration
- [ ] Rollback tests (verify undo works)
- [ ] Idempotency tests (running twice produces same result)
- [ ] Edge case: partial failure recovery

## Dependencies
- Prerequisites: Database/infrastructure setup
- Blocks: All feature tasks requiring migrations

## Infrastructure References
From `<worktree>/planning/infrastructure-ids.md`:
- Database connection configuration
- Migration history storage location

## Acceptance Criteria
- [ ] Framework handles version tracking
- [ ] Migrations run idempotently
- [ ] Rollback works on failure
- [ ] All tests passing
- [ ] Documentation complete
EOF

# Create first migration task using the framework
cat > "<worktree>/planning/tasks-pending/task-[NNN+1]-initial-schema-migration.md" << 'EOF'
# Task [NNN+1]: Initial Schema Migration

## Feature Description
Create first migration using migration framework: initial database schema.
This migration demonstrates the framework working with a real use case.

## Implementation Scope
- [ ] Create migration file: `001_initial_schema`
- [ ] Define schema structure (tables, columns, indexes)
- [ ] Write forward migration (create tables)
- [ ] Write rollback migration (drop tables)
- [ ] Test migration execution
- [ ] Test rollback

## Dependencies
- Prerequisites: Task [NNN] (migration-framework)

## Test Requirements
- [ ] Migration runs successfully
- [ ] Rollback works correctly
- [ ] Idempotency verified (running twice safe)
- [ ] Schema matches expected structure

## Acceptance Criteria
- [ ] Migration file follows framework conventions
- [ ] Forward and rollback tested
- [ ] Schema created matches design
- [ ] Migration history tracked
EOF

# Create CI/CD pipeline task
cat > "<worktree>/planning/tasks-pending/task-[NNN+2]-cicd-pipeline.md" << 'EOF'
# Task [NNN+2]: CI/CD Pipeline with Migration Integration

## Feature Description
Automate deployment pipeline: run migrations before deployment in every environment.
CI/CD loop: migration (if any) → deployment → verification.

## Implementation Scope

### Pipeline Stages
1. **Build Stage**
   - [ ] Compile/bundle application
   - [ ] Run unit tests
   - [ ] Generate artifacts

2. **Migration Stage** (RUNS BEFORE DEPLOYMENT)
   - [ ] Check for pending migrations
   - [ ] Execute migrations in order
   - [ ] Verify migration success
   - [ ] Rollback on migration failure (BLOCK DEPLOYMENT)

3. **Deployment Stage** (ONLY IF MIGRATIONS SUCCEED)
   - [ ] Deploy application to target environment
   - [ ] Update configuration
   - [ ] Restart services

4. **Verification Stage**
   - [ ] Health checks
   - [ ] Smoke tests
   - [ ] Integration tests
   - [ ] Rollback deployment if verification fails

### Environment-Specific Configurations
- [ ] Development: Auto-deploy on commit to main
- [ ] Staging: Manual trigger or tag-based deploy
- [ ] Production: Manual approval + tag-based deploy

### Migration Safety
- [ ] Migration runs BEFORE deployment
- [ ] Migration failure BLOCKS deployment
- [ ] Rollback available if deployment fails after migration
- [ ] Migration history logged per environment

## Dependencies
- Prerequisites: Task [NNN] (migration-framework), Task [NNN+1] (initial-migration)
- Blocks: All deployment workflows

## Infrastructure References
From `<worktree>/planning/infrastructure-ids.md`:
- CI/CD platform (GitHub Actions, GitLab CI, Jenkins)
- Deployment targets per environment
- Migration execution credentials

## Test Requirements
- [ ] Test pipeline in development environment
- [ ] Test migration failure blocks deployment
- [ ] Test rollback on deployment failure
- [ ] Test manual approval for production

## Acceptance Criteria
- [ ] Pipeline runs migrations before deployment
- [ ] Migration failure blocks deployment
- [ ] All environments have working pipeline
- [ ] Documentation for triggering deploys
- [ ] Team trained on pipeline usage
EOF
```

**Task Numbering:**
- Assign sequential task numbers (NNN, NNN+1, NNN+2)
- Migration framework comes EARLY (it blocks feature tasks)
- CI/CD pipeline comes AFTER initial migration verified
- Feature tasks come AFTER migration infrastructure exists

**Dependencies:**
- Migration framework → Initial migration → CI/CD pipeline → Feature tasks
- Feature tasks can reference migration framework for schema changes

### Step 3: Validate Task Completeness

**Review all created task files** to ensure:

1. **Coverage:** Every use case from Stage 1 has corresponding task(s)
2. **Granularity:** Each task is independently implementable (1-3 days of work)
3. **Dependencies:** Task prerequisites are clearly documented
4. **Testability:** Each task has clear test requirements from Phase 2-B
5. **Quality gates:** Each task references quality criteria thresholds
6. **Infrastructure:** Each task references needed IDs/config from Phase 2-C

**Count and verify tasks:**
```bash
# Count total tasks
ls "<worktree>/planning/tasks-pending/" | wc -l

# Verify numbering is sequential
ls "<worktree>/planning/tasks-pending/" | sort
```

**Check for gaps:**
- Are there use cases from Stage 1 without corresponding tasks?
- Are there infrastructure components from Phase 2-C not covered by any task?
- Are there test scenarios from Phase 2-B not assigned to tasks?

**🔒 CRITICAL TASK GENERATION QUALITY GATE:**

**BEFORE user presentation, perform task completeness validation:**

1. **Verify ALL use cases from Stage 1 are covered by tasks:**
   - Read `<worktree>/planning/use-cases.md`
   - For each use case, identify which task(s) implement it
   - Document verification: "Use case [X] → Task(s) [NNN, NNN] → Implementation covered"

2. **Verify ALL requirements from Stage 2 are addressed:**
   - Read `<worktree>/planning/requirements.md`
   - Check functional requirements: Each requirement mapped to at least one task
   - Check non-functional requirements: Each NFR mapped to specific task(s) or implementation approach

3. **IF GAPS FOUND:**
   - Document gap: "Use case/Requirement [X] not covered by any task because [reason]"
   - Options:
     - **Option A:** Create additional tasks to cover missing use cases/requirements
     - **Option B:** Revise use cases/requirements if over-specified (requires user agreement)
     - **Option C:** Explicitly document as future enhancement (requires user agreement)
   - **LOOP:** Update task files, re-verify coverage, iterate until complete
   - **DO NOT PROCEED** to user presentation until all use cases/requirements are covered

4. **IF NO GAPS:** Proceed to user presentation with verification summary

**Coverage Verification Format:**
```
✓ Use Case 1: [Name] → Tasks [001, 003]
✓ Use Case 2: [Name] → Task [002]
✓ Use Case 3: [Name] → Tasks [004, 005, 006]
...
✓ Functional Req 1: [Name] → Task [001]
✓ Functional Req 2: [Name] → Tasks [002, 003]
✓ NFR 1 (Performance): → Tasks [001, 007] + Architecture decision [caching]
✓ NFR 2 (Security): → All tasks + Infrastructure [auth tokens in Phase 2-C]
...
```

### Step 4: Present Task Roadmap to User

**Present the complete task decomposition:**

"📋 **Phase 2-D: Task Decomposition Complete**

I've broken down all features into [N] implementable tasks:

**Implementation Phases:**

**Phase 1: Foundation ([X] tasks)**
[List task numbers and names]

**Phase 2: Service Integration ([Y] tasks)**
[List task numbers and names]

**Phase 3: Business Logic ([Z] tasks)**
[List task numbers and names]

**Phase 4: Quality & Integration ([W] tasks)**
[List task numbers and names]

**Phase 5: Finalization ([V] tasks)**
[List task numbers and names]

**Total: [N] tasks to implement**

**Task Files Created:**
All [N] task files are in `<worktree>/planning/tasks-pending/`:
- Each task is a complete end-to-end vertical slice
- Each has clear acceptance criteria and test requirements
- Dependencies are documented for proper ordering
- Quality gates ensure standards are met

**Implementation Order:**
`<worktree>/planning/implementation-steps.md` defines the serialized execution order
across 5 phases, respecting dependencies and building from foundation to features.

**Ready to begin Phase 3 task execution?**"

**[WAIT for user confirmation]**

IF the user confirms:
  → **Update GUIDE.md** with task decomposition completion:
     * Edit `<worktree>/planning/GUIDE.md` section "Current State of Understanding"
       Add: "Phase 2-D complete: [N] tasks created and ordered for implementation"
     * Update "Key Documents Reference" to include implementation-steps.md and task files location

  → **Update GUIDE.md** for Phase 2 → Phase 3 transition:
     * Edit `<worktree>/planning/GUIDE.md` section "Current State of Understanding"
       Add: "Phase 2 complete - quality criteria defined, tests written, infrastructure planned, tasks decomposed"
     * Edit `<worktree>/planning/GUIDE.md` section "The Story So Far"
       Add: "**Phase 2 → Phase 3 Transition**: Planning complete. We have [N] tasks ready for execution. Each task is a complete vertical slice with tests, quality gates, and acceptance criteria. Now we execute tasks one by one until pending folder is empty."
     * Reference implementation-steps.md in "Key Documents Reference"

  → Announce: "✓✓✓ All planning complete. Beginning Phase 3: Task Execution..."
  → Move to Phase 3

IF the user requests changes:
  → Revise task files or implementation-steps.md based on feedback
  → Re-present and get confirmation
  → Then proceed to Phase 3

---

## Phase 3: Task Execution Loop

**📥 Input Files (per task iteration):**
- `<worktree>/planning/tasks-pending/task-NNN-[name].md` (current task specification)
- `<worktree>/planning/quality-criteria.md` (Phase 2 - success criteria)
- `<worktree>/planning/test-plan.md` (Phase 2-B - test specifications)
- `<worktree>/planning/architecture.md` + `tooling.md` (Phase 1 Stage 3 - technical decisions)
- `<worktree>/planning/infrastructure-ids.md` (Phase 2-C - IDs, endpoints, credentials)
- `<worktree>/planning/learnings.md` (cumulative insights from previous tasks)
- `<worktree>/planning/GUIDE.md` (session state)

**📤 Output Files (per task iteration):**
- `<worktree>/src/[implementation-files]` (code implementing the feature)
- `<worktree>/test/[test-files]` (tests for the feature)
- `<worktree>/README.md` (ALWAYS updated with feature summary)
- `<worktree>/planning/learnings.md` (updated with new insights)
- `<worktree>/planning/tasks-completed/task-NNN-[name].md` (moved from pending with completion notes)
- `<worktree>/planning/GUIDE.md` (updated with task completion and transition log)

**📝 Documentation Output:**
- **Files Created:** `<worktree>/planning/learnings.md`, `<worktree>/planning/tasks-completed/task-NNN-[name].md` (moved from pending after completion)
- **Purpose:** Execute each task with quality verification, capture learnings, and move completed tasks from pending to completed folder
- **Referenced By:** Phase 4 (retrospective analysis, final validation, delivery summary)

---

This is where the work happens. We execute tasks one by one until `<worktree>/planning/tasks-pending/` is empty.

**⚠️ CRITICAL LOOP CONDITION:**
Phase 3 continues WHILE tasks exist in `<worktree>/planning/tasks-pending/`.
The phase only completes when the pending folder is empty (all tasks moved to completed).

**Initialize execution state:**
- tasks_completed_count = 0
- tasks_total_count = [count from Phase 2-D]
- cumulative_learnings = []

### The Task Execution Loop

WHILE tasks exist in `<worktree>/planning/tasks-pending/`:

**⚠️  PATH DISCIPLINE REMINDER:**
All file operations MUST use `<worktree>` as the path prefix.
All git operations MUST use: `git -C "<worktree>" [command]`

Never use relative paths. Never use `cd`. Always specify full paths with `<worktree>`.

**📖 Context Reminder at start of each task:**
If you've lost context during task execution, read `<worktree>/planning/GUIDE.md` to understand:
- What we're building (check task-definition.md)
- What quality criteria we're meeting (check quality-criteria.md)
- What tasks are completed (check tasks-completed/)
- What learnings have been captured (check learnings.md)
- Layer dependencies and decisions made in Phase 1

---

#### Step 1: Select Next Task

**List pending tasks:**
```bash
ls "<worktree>/planning/tasks-pending/" | sort
```

**Choose next task respecting dependencies:**

Review `<worktree>/planning/implementation-steps.md` to understand task ordering and phases:
- **Dependencies first**: Select tasks with no pending prerequisites
- **Foundation before features**: Core utilities before features that use them
- **High-risk first**: Complex or uncertain tasks tackled early (within phase)
- **User value**: Prioritize tasks that deliver visible user value

**Select task file:**
```bash
# Identify next task from pending folder
TASK_FILE="<worktree>/planning/tasks-pending/task-NNN-[name].md"
```

**Read the selected task file** to understand:
- Feature description and user value
- Implementation scope (UI/API/Schema/Service/Data)
- Quality gates and test requirements
- Dependencies and prerequisites
- Infrastructure references needed
- Architecture patterns to apply

#### Stage 2: Plan the Work

**Determine what files to create or modify:**
- Implementation files in `<worktree>/src/`
- Test files in `<worktree>/test/`
- Documentation files in `<worktree>/docs/`

**Decide your approach:**
- What pattern will you use?
- What dependencies do you need?
- What's the implementation order?

**📋 Bring Prior Knowledge Into Context:**
Before planning implementation details, review these authorized materials:

**1. Architecture Reference:**
Read `<worktree>/planning/architecture.md` to recall:
- Technology decisions and rationale
- Integration patterns discovered in codebase
- System dependencies and failure modes
- State transition requirements

**2. Tooling Integration Plan:**
Read `<worktree>/planning/tooling.md` to understand:
- Which MCP servers are available for this iteration's work?
- Which subagents should be invoked? (code review, testing support)
- How are external APIs integrated? (direct vs. abstraction patterns)
- What testing/quality tools verify this iteration?

**3. Infrastructure Identifiers:**
Reference `<worktree>/planning/infrastructure-ids.md` for:
- Service IDs, endpoints, and configuration values
- Environment variables and credential references
- Rate limits and timeout values

**4. Evaluate Existing Code and Tools:**

Before planning this task's implementation, evaluate what already exists in the worktree:

**Examine existing source code structure:**
```bash
# Review existing folder structure
ls -la "<worktree>/src/"

# Find existing modules and utilities
find "<worktree>/src/" -name "*.js" -o -name "*.ts"
```

**Analyze existing code patterns:**
- What modules/utilities already exist that this task can leverage?
- What patterns are established? (naming conventions, error handling, data structures)
- What existing functions can be reused vs. need to be created?
- Are there similar features already implemented that can serve as templates?

**Review existing tooling:**
- What npm packages are already installed? (check `<worktree>/package.json`)
- What testing utilities exist? (check `<worktree>/test/` for helpers, mocks, fixtures)
- What configuration is already set up? (build tools, linters, formatters)

**Identify reuse opportunities:**
- Can existing code be extended rather than duplicated?
- Are there utility functions that handle similar operations?
- Can existing test patterns be adapted for this task?
- What integration points already exist that this task can connect to?

**Document reuse plan:**
In the task file's "Implementation Plan (Pre-Implementation)" section, note:
- Existing code to leverage: [List modules/functions to reuse]
- Existing patterns to follow: [List conventions to maintain]
- Existing tools to use: [List npm packages, test utilities, helpers]
- New code needed: [What must be created from scratch and why]

This evaluation prevents duplication, maintains consistency, and accelerates implementation.

Include architecture patterns and tool usage in your implementation plan.

**Explain your plan:**
"I will:
1. [First step with file references]
2. [Second step with file references]
3. [Third step with file references]
4. [Tooling: Which tools will be used and when]
..."

#### Stage 3: Craft the Solution

**🔧 Apply Progressive Knowledge - Architecture & Tooling:**

**Reference Stage 3 Architecture (Confirmed Knowledge):**
Before writing code, recall `<worktree>/planning/architecture.md`:
- What technology decisions guide this implementation?
- What integration patterns exist in the codebase?
- What are the system dependencies and their failure modes?
- What state transitions must this code handle?

**Leverage Discovered Tools (From Tooling Integration Plan):**
Reference `<worktree>/planning/tooling.md` for tool usage:

- **MCP Servers**: Use for domain operations documented in the plan
  - File operations → use discovered filesystem MCP server
  - Database queries → use discovered database MCP server
  - Browser testing → use discovered browser automation MCP server
  - API calls → use discovered API MCP servers

- **External APIs**: Follow integration patterns from the plan
  - Direct API calls for simple, stable integrations
  - Abstraction layer for testability and flexibility
  - Use authentication from infrastructure-ids.md

- **Subagents**: Can be invoked for specialized help
  - Note: Code review typically happens in Stage 4, but other subagents available if needed

**Write implementation code** in `<worktree>/src/`:
- Follow architectural patterns from Stage 3 (confirmed during Phase 1)
- Apply integration patterns discovered in codebase research
- Use MCP servers and APIs per tooling integration plan
- Apply learned wisdom from previous iterations (if iteration > 1)
- Include clear comments for complex logic
- Structure code for maintainability and testability

**Write Mocha/Chai tests** in `<worktree>/test/`:

Use this pattern:
```javascript
const { expect } = require('chai');
const { ModuleUnderTest } = require('../src/module-name');

describe('Module Name', () => {
  describe('functionName', () => {

    it('should handle typical case correctly', () => {
      // Arrange
      const input = 'test input';
      const expectedOutput = 'expected output';

      // Act
      const result = ModuleUnderTest.functionName(input);

      // Assert
      expect(result).to.equal(expectedOutput);
    });

    it('should handle edge case: null input', () => {
      // Arrange
      const input = null;

      // Act & Assert
      expect(() => ModuleUnderTest.functionName(input))
        .to.throw('Must provide valid input');
    });

    it('should handle edge case: empty input', () => {
      // Arrange
      const input = '';

      // Act
      const result = ModuleUnderTest.functionName(input);

      // Assert
      expect(result).to.equal('');
    });

  });
});
```

**Write documentation** in `<worktree>/docs/` if needed:
- README for overall usage
- API documentation for public interfaces
- Architecture notes for complex designs

**Commit your work** to the worktree:
```bash
git -C "<worktree>" add .
git -C "<worktree>" commit -m "Iteration {iteration_number}: [brief description of work]"
```

#### Stage 4: Verify Quality - Iterative Until Right

**The Philosophy:**

You're not checking boxes - you're confirming your implementation matches your understanding,
and your understanding matches requirements. Quality checks are learning opportunities.
Iterate autonomously until everything makes sense. Don't proceed until quality is achieved.

**⚠️ AUTONOMOUS ITERATION:**
Work through all quality issues without prompting the user. Fix failing tests, address code review feedback, refactor to meet criteria, and debug implementation problems independently. Only prompt the user for catastrophic failures, critical architectural decisions, or requirement clarifications. See GUIDE.md "Autonomous Iteration During Implementation" for details.

**Build Verification (if applicable):**

IF there's a build step:
  Run: `cd "<worktree>" && npm run build`

  WHILE build fails:
    1. Analyze build errors - what do they reveal about your code?
    2. Fix syntax, import, or type issues
    3. Rebuild
    4. Commit fix: `git -C "<worktree>" commit -am "Fix: [what you fixed and why]"`
  END WHILE

  Only proceed when build succeeds without errors or warnings.

**Test Iteration Loop:**

Run test suite: `cd "<worktree>" && npx mocha test/**/*.test.js --reporter spec`
Save results: `cd "<worktree>" && npx mocha test/**/*.test.js --reporter json > planning/test-results/tests-iteration-{iteration_number}.json`

WHILE tests are failing:
  1. **Analyze failures**: What do they teach you?
     - Is your implementation wrong?
     - Is your understanding incomplete?
     - Did you miss an edge case?
     - Is there a logical flaw?

  2. **Fix the underlying issue** (not just the symptom):
     - Address the root cause
     - Consider related code that might have the same issue
     - Ensure the fix is correct, not just making the test pass

  3. **Re-run tests**: Verify the fix worked and didn't break anything else

  4. **Commit the fix**:
     `git -C "<worktree>" commit -am "Fix: [what you learned and fixed]"`

  5. **Continue iterating** until all tests pass
END WHILE

Only proceed when all tests pass. Green tests = specifications met.

**Code Review Iteration:**

Ask code-reviewer subagent to review `<worktree>/src/`

Provide these parameters:
- path: `<worktree>/src/`
- iteration: {iteration_number}
- focus: [quality dimensions from criteria]

Tell the subagent to be verbose - we need specific issues with file:line references and severity.

[WAIT for code-reviewer completion]

WHILE blocking issues exist:
  1. **Review the feedback**: What patterns or principles did you miss?
     - Are there architectural violations?
     - Security vulnerabilities?
     - Maintainability problems?
     - Performance concerns?

  2. **Refactor code** to address blocking issues:
     - Don't just patch - improve the design
     - Consider how to prevent similar issues
     - Maintain test coverage during refactoring

  3. **Re-run tests**: Ensure refactoring didn't break functionality

  4. **Commit the refactor**:
     `git -C "<worktree>" commit -am "Refactor: [what you improved and why]"`

  5. **Re-run code-reviewer**: Verify issues are resolved
END WHILE

Save final review to `<worktree>/planning/reviews/review-iteration-{iteration_number}.json`.

Only proceed when no blocking issues remain. Minor issues can be noted for later.

**Criteria Verification:**

Read `<worktree>/planning/quality-criteria.md` and evaluate each criterion objectively.

For each primary criterion:
- Is it complete? (yes/no)
- What evidence supports this?
- If incomplete, what's missing?

Calculate the quality score:
- Functional completeness: [percentage] × 0.40 = [subscore]
- Code review quality: [percentage] × 0.35 = [subscore]
- Integration completeness: [percentage] × 0.25 = [subscore]
- **Total quality score**: [sum of subscores]

IF quality_score < 80 OR primary_criteria incomplete:
  Identify specific gaps:
  - Which requirements are not met?
  - Which quality dimensions are weak?
  - What needs more work?

  **Return to Step 3 (Craft the Solution)** to address gaps:
  - Implement missing functionality
  - Improve code quality
  - Add missing tests
  - Then return here to Step 4 to verify again

  Iterate between Step 3 and Step 4 until criteria are met.
END IF

Only proceed when quality score ≥80 AND all primary criteria complete.

**Integration Verification:**

Test each integration point from `<worktree>/planning/architecture.md`:

For each external system integration:
- Test successful interaction (happy path)
- Test error handling at boundaries
- Confirm data format conversions work correctly
- Validate performance is acceptable per NFRs

IF integration issues found:
  1. Fix integration code
  2. Re-test integrations
  3. Commit fix
  4. Re-verify all integrations work
END IF

**State Transition Verification:**

Review state transition plan from `<worktree>/planning/architecture.md`:
- Has system transitioned from current → future state?
- Are all migration steps complete?
- Does old functionality still work? (backward compatibility)
- Does new functionality work as expected?

**You're Done with Step 4 When:**
- Build succeeds (if applicable)
- All tests pass
- No blocking code review issues
- Quality score ≥80
- All primary criteria met
- Integrations verified
- State transition complete
- Your confidence is high

Only then proceed to Step 5: Complete This Task.

#### Step 5: Complete This Task

**Fill out task completion section** in the task file (`<worktree>/planning/tasks-pending/task-NNN-[name].md`):

Update the "## Completion Notes (Post-Implementation)" section:

```markdown
## Completion Notes (Post-Implementation)

### Implementation Summary
[Brief overview of what was implemented]

### Files Created/Modified
- `<worktree>/src/[file]` - [Purpose]
- `<worktree>/test/[file]` - [Test coverage]
- [Additional files...]

### Quality Verification Results
- All tests passing: [Yes/No - details if needed]
- Code review: [Blocking issues resolved, minor issues noted]
- Integration verified: [Yes/No - details if needed]
- Quality score: [N/100 - functional + code + integration]

### Existing Code Leveraged
[What existing modules/utilities/patterns were reused]

### New Patterns Established
[What new conventions/utilities were created for future tasks]

### Challenges Encountered
[What was harder than expected and how it was resolved]

### Completion Date
[YYYY-MM-DD]
```

**Update project documentation (if needed):**

**Evaluate if documentation updates are required:**
- Did this task add new user-facing features? → Update README.md usage examples
- Did this task add new API endpoints/functions? → Update API documentation
- Did this task change configuration? → Update config documentation
- Did this task establish new patterns? → Document in architecture docs
- Did this task add new dependencies? → Update setup/installation docs

**If README.md update needed:**
```bash
# Read current README
cat "<worktree>/README.md"

# Update relevant sections (examples below)
```

**Common README sections to update:**
- **Usage Examples:** Add examples showing new feature
- **API Reference:** Document new functions/endpoints
- **Configuration:** Note new config options
- **Installation/Setup:** Add new dependencies or setup steps
- **Features:** List new capabilities
- **Breaking Changes:** Note any API changes (if applicable)

**Example README update:**
```markdown
## Features
- [Existing feature 1]
- [Existing feature 2]
- **NEW: [Task feature name]** - [Brief description of what users can now do]

## Usage

### [New Feature Name]
\`\`\`javascript
// Example code showing how to use the new feature
const result = newFeature(params);
\`\`\`
```

**Update other documentation if needed:**
- `<worktree>/docs/API.md` - For API changes
- `<worktree>/docs/ARCHITECTURE.md` - For architectural patterns
- `<worktree>/docs/CONFIGURATION.md` - For config changes
- Task file itself documents implementation details (already done above)

**Commit documentation updates:**
```bash
git -C "<worktree>" add README.md docs/
git -C "<worktree>" commit -m "docs: Update documentation for [task-name]"
```

**If no documentation update needed:**
Skip this step - not every task requires user-facing documentation changes.

**Move task file to completed folder:**
```bash
mv "<worktree>/planning/tasks-pending/task-NNN-[name].md" \
   "<worktree>/planning/tasks-completed/task-NNN-[name].md"
```

**Increment completion counter:**
```bash
tasks_completed_count = tasks_completed_count + 1
```

#### Step 6: Capture Learnings

**Read** `<worktree>/planning/learnings.md` (create if doesn't exist).

**Append new learnings** from this task:

```markdown
## Task NNN: [Task Name] (Completed YYYY-MM-DD)

### Technical Insights
- [What you learned about the technology/architecture]
- [Patterns that worked well]
- [Approaches that didn't work and why]

### Reusable Patterns
- [New utility functions created that other tasks can use]
- [Design patterns established that should be followed]
- [Testing approaches that worked well]

### Architecture Updates
- [Any discoveries that affect system architecture]
- [Integration patterns learned]
- [Performance characteristics discovered]

### Recommendations for Future Tasks
- [Advice for similar implementations]
- [Pitfalls to avoid]
- [Helpful resources or tools discovered]
```

**IF significant architectural insights emerged:**
Also update `<worktree>/planning/architecture.md` to reflect new understanding.

#### Step 7: Announce Task Completion

**Report progress to user:**

"✅ Task {task_number} Complete: {task_name}

**Progress:** {tasks_completed_count}/{tasks_total_count} tasks completed

**User Value:** {brief description of feature delivered}

**Implementation:**
- {N} files created/modified
- {M} tests passing
- Quality score: {score}/100

**Key Learnings:**
- {Most significant insight from this task}

**Next:** {tasks_total_count - tasks_completed_count} tasks remaining"

---

**⚠️ LOOP CONTINUATION CHECK:**

Check if more tasks remain:
```bash
REMAINING_TASKS=$(ls "<worktree>/planning/tasks-pending/" | wc -l)
```

**IF REMAINING_TASKS > 0:**
  Continue to next task. Go back to Step 1: Select Next Task.

**ELSE (tasks-pending/ is empty):**
  All tasks complete!
  → **Update GUIDE.md** for Phase 3 → Phase 4 transition:
     * Edit `<worktree>/planning/GUIDE.md` section "Current State of Understanding"
       Add: "Phase 3 complete - all {tasks_total_count} tasks implemented successfully"
     * Edit `<worktree>/planning/GUIDE.md` section "The Story So Far"
       Add: "**Phase 3 → Phase 4 Transition**: All feature tasks complete. {tasks_total_count} vertical slices delivered with quality verification. Captured learnings in learnings.md. Now we reflect on the overall journey and prepare final delivery."

  Exit the Task Execution Loop. Proceed to Phase 4: Reflection & Delivery.

**END WHILE** (tasks exist in tasks-pending/)

---

## Phase 4: Reflection & Delivery

**📥 Input Files:**
- All `<worktree>/planning/tasks-completed/*.md` (all completed tasks)
- `<worktree>/planning/learnings.md` (cumulative insights)
- `<worktree>/planning/quality-criteria.md` (Phase 2 - success criteria to validate against)
- `<worktree>/src/` + `<worktree>/test/` (all implementation and tests)
- `<worktree>/planning/GUIDE.md` (complete session history and decisions)

**📤 Output Files:**
- `<worktree>/docs/DELIVERY_SUMMARY.md` (delivery package - what was built, how it works, key decisions)
- `<worktree>/docs/CRAFTING_WISDOM.md` (lessons learned, reusable patterns, recommendations)
- `<worktree>/planning/GUIDE.md` (final Phase 4 confirmation and completion transition log)

**📝 Documentation Output:**
- **Files Created:** `<worktree>/docs/DELIVERY_SUMMARY.md`, `<worktree>/docs/CRAFTING_WISDOM.md`
- **Purpose:** Retrospective analysis, final validation, and delivery package with lessons learned
- **Referenced By:** User (delivery documentation), future projects (wisdom and patterns)

---

The crafting is complete. Now we consolidate, validate, and deliver.

### Step 1: Retrospective Analysis

**Review the journey:**
Read all completed task files from `<worktree>/planning/tasks-completed/` and learnings from `<worktree>/planning/learnings.md`.

**Synthesize the learning:**
- What patterns emerged across tasks?
- What was the biggest challenge?
- What was the most important insight?
- What would you do differently next time?
- What reusable patterns were established?

### Step 2: Final Validation

**Run the complete test suite one final time:**
```bash
cd "<worktree>" && npx mocha test/**/*.test.js --reporter spec
```

**Verify all criteria:**
Go through `<worktree>/planning/quality-criteria.md` one more time:
- Every primary criterion: ✓
- Quality score: {final_score}
- Blocking issues: 0

**Run any additional verification:**
If there are integration tests, performance tests, or other validation steps, run them now.

### Step 3: Assemble Delivery Package

**Create a summary document** at `<worktree>/docs/DELIVERY_SUMMARY.md`:

```markdown
# Delivery Summary: [Task Name]

## What Was Built
[High-level description]

## Implementation Highlights
- [Key technical decision 1]
- [Key technical decision 2]
...

## File Structure
[List of files created with brief descriptions]

## Test Coverage
- Total tests: {count}
- All tests passing: ✓
- Coverage: {percentage}%

## Quality Metrics
- Primary criteria: 100% complete
- Quality score: {final_score}
- Code review: {assessment}

## Usage Guide
[How to use what was built]

## Integration Points
[What this connects to and how]

## Future Considerations
[What could be enhanced later]
```

### Step 4: Capture Wisdom

**Distill the most important lessons** to `<worktree>/docs/CRAFTING_WISDOM.md`:

```markdown
# Crafting Wisdom: [Task Name]

## Key Insights
[The most important things learned]

## Patterns That Worked
[Approaches that were successful]

## Pitfalls Avoided
[Things that could have gone wrong]

## Recommendations for Similar Work
[Advice for future related tasks]
```

### Step 5: Present to User

**ALWAYS Update README.md:**

Before presenting to the user, **ALWAYS** update `<worktree>/README.md` with:
- Feature/task summary added to appropriate section
- Usage examples if user-facing
- Setup/configuration changes if any
- Known limitations or future enhancements
- Updated table of contents if significant additions

This is REQUIRED for every completed task - README.md must reflect the current state of the project.

**Show the completion:**

"✨ Crafting complete! Here's what was delivered:

**Implementation:**
- [Brief summary of what was built]
- Location: `<worktree>/src/`
- Tests: `<worktree>/test/` ({test_count} tests, all passing)

**Quality achieved:**
- Primary criteria: 100% complete ✓
- Quality score: {final_score} ✓
- All tests passing ✓
- Code review: {assessment} ✓

**Key files:**
- Implementation: [list main files]
- Tests: [list test files]
- Docs: `<worktree>/docs/DELIVERY_SUMMARY.md`
- **README.md updated** ✓

**Notable decisions:**
- [Highlight 1-2 important technical decisions]

The complete work is in the isolated worktree at `<worktree>`. Would you like me to merge this back to `{original_location}` now?"

[WAIT for user confirmation]

---

## Global End - Consolidation

**Merge the crafted work** back to the original location.

Use the Task tool to invoke the merge-worktree subagent:

```
Task tool parameters:
{
  "subagent_type": "merge-worktree",
  "description": "Merge worktree to source branch",
  "prompt": "Merge the worktree at `<worktree>` back to the source branch with a squash commit.

  Worktree path: `<worktree>`
  Target branch: {original branch from original_location}
  Squash commits: yes (consolidate all iteration commits into one)
  Commit message: 'feat: [task name] - crafted over {iteration_number} iterations'

  Please provide detailed output including:
  - Merge success status
  - Any conflicts encountered
  - List of files changed
  - Final commit hash
  - Worktree cleanup status"
}
```

[WAIT for merge-worktree agent completion]

The merge-worktree agent will report:
- Merge status (success/conflicts/failure)
- Conflict details if any (specific files and locations)
- Files changed (complete list)
- Commit hash (for successful merge)
- Cleanup status (worktree removed or preserved)

**Handle the merge result:**

IF merge was successful:
"✅ Successfully merged crafted work to `{original_location}`.
- Files changed: {count}
- Commit: {commit_hash}
- Worktree cleaned up: ✓

Your changes are now in the main branch and ready to push."

ELSE IF conflicts occurred:
"⚠️  Merge completed with conflicts. The following files need manual resolution:
{list of conflicted files}

The worktree at `<worktree>` has been preserved so you can resolve conflicts.

To resolve:
1. Edit the conflicted files in `{original_location}`
2. Run: git add {files}
3. Run: git commit
4. The worktree can then be removed with: git worktree remove <worktree>"

ELSE (merge failed):
"❌ Merge failed: {error_message}

The worktree at `<worktree>` has been preserved with all your work.

To manually merge:
1. cd {original_location}
2. git merge {worktree_branch}
3. Resolve any issues
4. git worktree remove <worktree> when done"

**Final summary:**
"🎯 Crafting session complete.

**Journey:**
- Iterations: {iteration_number}
- Quality score: {final_score}
- Tests: {test_count} (all passing)

**Artifacts:**
- Implementation: {file_count} files
- Tests: {test_file_count} files
- Documentation: DELIVERY_SUMMARY.md, CRAFTING_WISDOM.md

Thank you for crafting with intention. 🎨"
