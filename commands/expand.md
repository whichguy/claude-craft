# Use Case Expansion Through Progressive Discovery

Transform high-level epics into comprehensive use case specifications by uncovering explicit, implicit, and cascading use cases with deep focus on UI interaction patterns.

## Usage

```bash
# From epic file
/expand path/to/epic.md

# From epic file with output to directory
/expand path/to/epic.md --output ./planning

# Inline epic text (outputs to stdout)
/expand "Build a Google Sheets add-on that calculates Fibonacci numbers..."

# Inline with file output
/expand "Your epic text..." --output ./docs/specifications

# Concise output (final results only, no discovery reasoning)
/expand path/to/epic.md --concise

# Combined flags
/expand ~/requirements.md --output /tmp --concise

# Error handling examples (these will fail gracefully):
# /expand nonexistent.md              # → ERROR: File not found
# /expand "text" --output /bad/path   # → ERROR: Directory does not exist
# /expand "text" --output             # → ERROR: --output requires directory
```

---

## Your Mission

You are analyzing an epic to **discover comprehensive use cases** through progressive elaboration. Your focus is on:
- **Explicit use cases** stated in the epic
- **Implicit use cases** that are unstated but expected
- **Cascading use cases** triggered by primary use cases
- **UI interaction patterns** showing how users engage with the system
- **Notification and feedback expectations**
- **Data flow through user interactions**
- **Follow-on sequence patterns**

**Arguments**: ${ARGUMENTS}

**Parse arguments to extract:**
- Epic content (from file or inline text)
- Output mode (stdout or files with `--output <path>`)
- Concise mode (if `--concise` flag present, output only final results without reasoning)

---

## Phase 0: Epic Expansion & User Validation

**Purpose**: Transform the initial epic into a detailed, validated problem statement through iterative refinement with user confirmation before proceeding with comprehensive discovery.

### Directive 0: Epic Expansion & Validation

#### Step 1: Extract Epic Content & Parse I/O Configuration

**Parse input arguments:**
```
// Step 1a: Separate first argument (file or text) from flags
args_list = split(ARGUMENTS, " ")
flags = []
file_or_text = null

i = 0
WHILE i < length(args_list):
  arg = args_list[i]

  IF starts_with(arg, "--") OR starts_with(arg, "-"):
    // This is a flag - collect it and its value if needed
    flags.append(arg)

    // Check if flag needs a value (--output needs directory path)
    IF (arg == "--output" OR arg == "-o") AND (i + 1 < length(args_list)):
      i++
      flags.append(args_list[i])  // Collect the path value
  ELSE IF file_or_text == null:
    // First non-flag argument is the epic source
    file_or_text = arg

  i++

// Step 1b: Detect input source (file vs inline text)
epic_source = "unknown"
epic_path = null
epic_content = null

IF file_or_text != null:
  // Improved file detection
  is_likely_file = (
    starts_with(file_or_text, "/") OR
    starts_with(file_or_text, "./") OR
    starts_with(file_or_text, "../") OR
    starts_with(file_or_text, "~/") OR
    ends_with(file_or_text, ".md") OR
    ends_with(file_or_text, ".txt")
  )

  IF is_likely_file:
    // Try to resolve and read as file
    epic_path = resolve_path(file_or_text)  // Expands ~/, resolves relative paths

    IF file_exists(epic_path):
      epic_source = "file"

      TRY:
        epic_content = read_file(epic_path)
      CATCH error:
        ERROR: "Could not read file: ${epic_path}"
        ERROR: "Reason: ${error}"
        EXIT
    ELSE:
      // File path pattern but file doesn't exist
      ERROR: "File not found: ${file_or_text}"
      IF starts_with(file_or_text, "~"):
        SUGGEST: "Note: ~ expands to ${home_directory}"
      SUGGEST: "If you meant to provide inline text, use quotes: /expand \"your text here\""
      EXIT
  ELSE:
    // Treat as inline text
    epic_source = "inline"
    epic_content = file_or_text
ELSE:
  ERROR: "No epic content provided"
  SUGGEST: "Usage: /expand <file-path-or-text> [--output <dir>] [--concise]"
  EXIT

// Step 1c: Parse flags with validation
output_mode = "stdout"  // default
output_path = null
concise_mode = false

i = 0
WHILE i < length(flags):
  flag = flags[i]

  IF flag == "--output" OR flag == "-o":
    // Validate that next item is the path
    IF i + 1 >= length(flags) OR starts_with(flags[i + 1], "--"):
      ERROR: "--output flag requires a directory path argument"
      EXAMPLE: "/expand 'epic text' --output /tmp"
      EXIT

    output_path = flags[i + 1]
    i++  // Skip next item (the path)

    // Resolve path (handle ~/, ./, etc.)
    output_path = resolve_path(output_path)

    // Validate directory exists
    IF NOT directory_exists(output_path):
      ERROR: "Output directory does not exist: ${output_path}"
      SUGGEST: "Create it first: mkdir -p ${output_path}"
      EXIT

    // Validate directory is writable
    IF NOT is_writable(output_path):
      ERROR: "Output directory is not writable: ${output_path}"
      SUGGEST: "Check permissions: ls -ld ${output_path}"
      EXIT

    output_mode = "files"

  ELSE IF flag == "--concise" OR flag == "-c":
    concise_mode = true

  ELSE:
    WARN: "Unknown flag: ${flag} (ignoring)"

  i++

// Step 1d: Validate epic content
IF epic_content == null OR length(epic_content) < 50:
  ERROR: "Epic too short (${length(epic_content)} characters). Minimum 50 characters required."
  IF epic_source == "file":
    SUGGEST: "Check if file contains sufficient content: wc -c ${epic_path}"
  EXIT
```

#### Step 1.5: Confirm Input/Output Configuration

**Display detected I/O configuration to user before proceeding:**

```markdown
---

## 📋 Input/Output Configuration Detected

### Input Source
**Mode**: ${epic_source == "file" ? "📄 File" : "📝 Inline Text"}

${IF epic_source == "file":
  - **File Path**: `${epic_path}`
  - **File Size**: ${format_bytes(length(epic_content))} (${length(epic_content)} characters)
  - **File Exists**: ✅ Yes
  - **Readable**: ✅ Yes
ELSE:
  - **Text Length**: ${length(epic_content)} characters
  - **Preview**: "${truncate(epic_content, 60)}..."
}

### Output Destination
**Mode**: ${output_mode == "files" ? "📁 Files" : "🖥️  Console (stdout)"}

${IF output_mode == "files":
  - **Directory**: `${output_path}`
  - **Directory Exists**: ✅ Yes
  - **Writable**: ✅ Yes
  - **Files to Generate**:
    * `summary.md` - Executive summary and statistics
    * `epic-01-[name].md` - Epic 1 details
    * `epic-02-[name].md` - Epic 2 details
    * `epic-03-[name].md` - Epic 3+ details (as needed)
    * `stories-mvp-p0.md` - Priority 0 (MVP) stories
    * `stories-phase2-p1.md` - Priority 1 (Phase 2) stories
    * `stories-future-p2.md` - Priority 2 (Future) stories
    * `sprint-plan.md` - Sprint planning guide
    * `appendix-use-case-mapping.md` - Use case traceability
    * `appendix-ui-patterns.md` - Detailed UI interaction patterns
    * `appendix-flows.md` - Visual flow diagrams
    * `appendix-architecture.md` - Technical architecture details
ELSE:
  - **Output**: Single comprehensive markdown document
  - **Format**: All sections in one continuous document
  - **Destination**: Console output (can be redirected with `>` or `|`)
}

### Output Verbosity
**Mode**: ${concise_mode ? "🎯 Concise (final results only)" : "📖 Full (with discovery reasoning)"}
${IF concise_mode:
  - Discovery reasoning omitted
  - Only final use cases, epics, and stories shown
  - Appendices included
ELSE:
  - Full discovery process documented
  - Reasoning and derivation included
  - Progressive questioning shown
}

---

✅ **Configuration validated successfully**

Proceeding to epic expansion and use case discovery...

---
```

#### Step 2: Expand Epic with Reasonable Assumptions

**Generate comprehensive understanding by answering discovery questions:**

**Discovery Questions:**
1. **What** is being built? (system/feature/capability)
2. **Who** will use it? (actors/personas/roles)
3. **Why** is it needed? (problem solved/value delivered)
4. **Where** will it run? (platform/environment/hosting)
5. **How** will users interact? (interface type/modality)
6. **What's** the core workflow? (primary use case/happy path)
7. **What** constraints exist? (technical/business limitations)

**Generate expanded epic statement:**

```markdown
## 🎯 Expanded Epic Understanding

### What We're Building
[2-3 sentence description of the system/feature with specific details]
[Include assumed capabilities and scope boundaries]

### Who Will Use It
**Primary Actor(s):**
- [Actor 1]: [Role/persona] - [Their needs/goals]
- [Actor 2]: [Role/persona] - [Their needs/goals]

**Secondary Actor(s):**
- [Actor/System]: [Role in the system]

### Why It's Needed
**Problem Being Solved:**
[Specific problem or pain point being addressed]

**Value Delivered:**
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

### Platform & Environment
- **Platform Type**: [Web/Mobile/Desktop/Embedded/CLI]
- **Technology Stack**: [Assumed technologies based on platform]
- **Integration Points**: [External systems/APIs/services]
- **Hosting/Deployment**: [Where it runs]

### Core Workflow
**Primary Use Case:**
1. [User action/trigger]
2. [System response]
3. [User action]
4. [System response]
5. [Outcome/completion]

**Expected User Experience:**
[Description of how users will perceive and interact with the system]

### Known Constraints
- **Technical**: [Platform limitations, API constraints, etc.]
- **Business**: [Budget, timeline, compliance requirements]
- **User**: [Access limitations, skill level assumptions]

### Out of Scope (Explicit Exclusions)
- [What this will NOT do]
- [Features/capabilities explicitly excluded]
```

#### Step 3: Assess Sufficiency

**Evaluate expanded epic against criteria:**

```markdown
## ✅ Sufficiency Assessment

**Criteria Checklist:**

1. [ ] **Clarity**: Can a developer understand what to build?
   - Is the system/feature clearly described?
   - Are boundaries and scope defined?

2. [ ] **Actors**: Are users/personas clearly identified?
   - Primary actors named with roles/needs?
   - Secondary actors identified?

3. [ ] **Value**: Is the business value/problem clear?
   - Problem being solved articulated?
   - Benefits/outcomes specified?

4. [ ] **Scope**: Is the boundary of the system defined?
   - What's included vs. excluded?
   - Integration points identified?

5. [ ] **Platform**: Is the technical platform specified?
   - Platform type determined?
   - Technology stack assumed?

6. [ ] **Workflow**: Is the primary user journey described?
   - Core workflow steps outlined?
   - Expected UX described?

7. [ ] **Constraints**: Are known limitations identified?
   - Technical constraints noted?
   - Business/regulatory constraints captured?

**Sufficiency Score**: [X/7 criteria met]

**Confidence Level**:
- 7/7: HIGH (90-100%) - Ready to proceed
- 5-6/7: MEDIUM (70-89%) - Mostly ready, minor gaps
- 3-4/7: LOW (50-69%) - Significant gaps, refinement recommended
- 0-2/7: VERY LOW (<50%) - Major gaps, refinement required
```

#### Step 4: Generate Targeted Questions

**If sufficiency < 7/7, generate specific questions to fill gaps:**

```markdown
## 🤔 Questions to Refine Understanding

### Critical (Must Answer to Proceed)
[Questions for criteria marked ✗ in sufficiency assessment]

1. **[Topic]**: [Specific question about missing/unclear element]
   - Why this matters: [Impact on discovery/implementation]

2. **[Topic]**: [Another critical question]
   - Why this matters: [Impact]

### Important (Should Answer for Better Results)
[Questions that would significantly improve clarity]

1. **[Topic]**: [Question that would improve understanding]
2. **[Topic]**: [Another important question]

### Optional (Nice to Have)
[Questions that would add useful detail but aren't blocking]

1. **[Topic]**: [Question for additional context]
2. **[Topic]**: [Question for edge cases]
```

#### Step 5: Document Key Assumptions

**List all assumptions made during expansion:**

```markdown
## 📋 Key Assumptions Made

1. **[Assumption Category]**: [Specific assumption]
   - **Rationale**: [Why this assumption was made]
   - **Risk if Wrong**: [Impact if assumption is incorrect]
   - **Validation Needed**: [How to verify]

2. **[Assumption Category]**: [Another assumption]
   - **Rationale**: [Reasoning]
   - **Risk if Wrong**: [Impact]
   - **Validation Needed**: [How to verify]

[Continue for all significant assumptions]

**Assumption Categories:**
- Platform/Technology
- User Behavior/Needs
- Integration/Dependencies
- Scope/Features
- Constraints/Limitations
```

#### Step 6: Present to User for Decision

**Output comprehensive validation package:**

```markdown
---

# 📋 Epic Expansion for Your Review

## Input/Output Configuration
**Input**: ${epic_source == "file" ? "📄 File: `" + epic_path + "`" : "📝 Inline text (" + length(epic_content) + " chars)"}
**Output**: ${output_mode == "files" ? "📁 Files in: `" + output_path + "`" : "🖥️  Console (stdout)"}
**Verbosity**: ${concise_mode ? "🎯 Concise" : "📖 Full"}

---

## Original Epic Provided
> [Original epic text verbatim]

---

## My Understanding (Expanded with Assumptions)

[Full expanded epic from Step 2]

---

## Sufficiency Assessment

**Criteria Met**: ✅ [X/7]
**Confidence Level**: [HIGH/MEDIUM/LOW/VERY LOW] ([percentage]%)

[Show full checklist from Step 3 with ✓/✗ for each criterion]

---

## Questions to Refine Understanding

[Show questions from Step 4, organized by priority]

---

## Key Assumptions Made

[Show assumptions from Step 5]

---

## ✋ Decision Point

**I need your input to proceed:**

### Option 1: ✅ Proceed with Current Understanding
**Choose this if:**
- The expanded epic accurately captures your vision
- You're comfortable with the assumptions I've made
- **The input/output configuration is correct** (source and destination confirmed)
- You want to see comprehensive use case discovery based on this understanding

**What happens next:**
- I'll begin Phase 1 with comprehensive use case discovery
- Assumptions will guide implicit use case derivation
- Output will be generated to the configured destination
- You can refine specific details as we progress

**Type**: "proceed", "continue", "yes", or "1"

---

### Option 2: 🔄 Refine Understanding First
**Choose this if:**
- Some aspects of the expansion need correction
- **The input source or output destination needs to be changed**
- You have answers to some/all of the questions above
- You want to adjust or clarify assumptions before I proceed

**What happens next:**
- Share corrections, answers, or additional context
- I'll re-expand the epic incorporating your input
- We'll iterate until you're satisfied (up to 5 iterations)

**Type**: Your corrections, clarifications, or answers to questions

**Examples of I/O corrections:**
- "Actually, read from file ~/my-epic.md instead"
- "Output to /tmp instead of console"
- "Use concise mode"
- "Change output to console instead of files"

---

### Option 3: 📝 Provide Additional Context
**Choose this if:**
- You have additional requirements, examples, or documentation
- You want to share more details about users, workflows, or constraints
- You have reference materials or similar systems to consider

**What happens next:**
- Share any additional information
- I'll incorporate everything and re-expand
- We'll review the enhanced expansion together

**Type**: Additional context, links, examples, or requirements

---

### Option 4: ⏸️ Stop Here
**Choose this if:**
- The expansion revealed misunderstandings about the epic
- You need to rethink the requirements
- You want to refine the original epic and restart

**Type**: "stop", "cancel", or "exit"

---

**What would you like to do?** (Choose 1, 2, 3, or 4)
```

#### Step 7: Quality Gate with Iteration Loop

**Process user response:**

```
USER_RESPONSE = wait_for_user_input()

// Option 1: Proceed
IF USER_RESPONSE matches ("proceed"|"continue"|"yes"|"1"|"option 1"):
  sufficiency_confidence = sufficiency_score / 7 * 100
  knowledge_confidence_score = sufficiency_confidence

  OUTPUT: "✅ Proceeding with epic expansion (${sufficiency_confidence}% confidence)"
  OUTPUT: "Beginning comprehensive use case discovery..."
  OUTPUT: ""

  PROCEED TO Phase 1

// Option 2 & 3: Refine with user input
ELSE IF USER_RESPONSE contains (answers|corrections|clarifications|additional context):
  iteration_count++

  IF iteration_count > 5:
    OUTPUT: "⚠️  Multiple iterations completed (${iteration_count}). Proceeding with current understanding to avoid over-refinement."
    PROCEED TO Phase 1
  ELSE:
    OUTPUT: "🔄 Iteration ${iteration_count}: Incorporating your input..."

    // Incorporate user feedback into epic understanding
    MERGE user_input with expanded_epic
    UPDATE assumptions based on user_input

    // Re-expand with new information
    RETURN TO Step 2 (Re-expand epic with incorporated input)

// Option 4: Stop
ELSE IF USER_RESPONSE matches ("stop"|"cancel"|"exit"|"4"|"option 4"):
  OUTPUT: "⏸️  Epic expansion cancelled. No use case discovery performed."
  EXIT

// Unclear response
ELSE:
  OUTPUT: "❓ I didn't understand your response."
  OUTPUT: ""
  OUTPUT: "Please choose one of the following:"
  OUTPUT: "  1️⃣  Type 'proceed' to continue with current understanding"
  OUTPUT: "  2️⃣  Share corrections or answers to refine the epic"
  OUTPUT: "  3️⃣  Provide additional context or requirements"
  OUTPUT: "  4️⃣  Type 'stop' to cancel"
  OUTPUT: ""

  RETURN TO Step 6 (Re-display decision point)
```

---

## Why This Approach

**Benefits of Interactive Expansion:**

1. **Proactive AI Initiative**: AI takes the lead in expanding sparse epics with domain knowledge
2. **Transparent Assumptions**: All assumptions surfaced for user review/correction
3. **Objective Readiness Criteria**: 7-point checklist provides clear go/no-go decision
4. **Targeted Gap Filling**: Questions focus on missing critical elements
5. **User Control**: User decides when sufficient vs. when to refine
6. **Iterative Refinement**: Built-in loop prevents both under-specification and over-analysis
7. **Confidence Tracking**: Sufficiency score flows into all subsequent phases

**Prevents Common Problems:**

- ❌ Starting discovery with vague/incomplete understanding
- ❌ Making hidden assumptions that diverge from user intent
- ❌ Over-analyzing clear epics (sufficiency gate prevents this)
- ❌ Under-analyzing sparse epics (questions surface gaps)
- ❌ Proceeding when user wants to clarify (explicit decision point)

---

## Phase 1: Initial Understanding

### Directive 1: Form First Impressions

**Read the epic carefully.** Build your initial mental model focused on use cases:

#### What is the core user goal?
- What problem is the user trying to solve?
- What is the primary value they seek?
- What is the main action they want to perform?

#### Who are the actors?
- Who is explicitly mentioned?
- Who would use this system?
- Who would administer it?

**Document:**
- **Primary Actor**: Main user of the system
- **Secondary Actors**: Admin, integrations, external systems
- **Core Goal**: One-sentence description of what users accomplish

#### What are the primary interactions mentioned?
- What workflows are described?
- What triggers usage?
- What is the desired outcome?

**Document:**
- **Primary Use Case**: The main workflow stated in epic
- **Trigger**: What initiates the workflow
- **Expected Outcome**: What success looks like

#### What platform/interface is implied?
- Web, mobile, desktop, command-line?
- Embedded in another system? (Sheets, Salesforce, etc.)
- UI patterns suggested? (sidebar, modal, full page, etc.)

**State tracking:** Initialize discovery counters:
```
explicit_use_case_count = 0
implicit_use_case_count = 0
cascading_use_case_count = 0
ui_pattern_count = 0
iteration_count = 1
knowledge_confidence_score = 0
```

---

## ✅ Quality Gate: Phase 1 Complete

**Before proceeding to Phase 1.5, verify:**

1. **Core Understanding** (Required):
   - [ ] Primary actor identified with confidence
   - [ ] Core user goal articulated in one sentence
   - [ ] Platform/interface type determined

2. **Initial Use Case Discovery** (Required):
   - [ ] At least 1 primary use case explicitly extracted from epic
   - [ ] Trigger for primary use case identified

3. **Confidence Assessment**:
   - Rate your understanding: LOW (< 50%) | MEDIUM (50-80%) | HIGH (> 80%)
   - If confidence < 50%: **ITERATE** - Re-read epic, look for missing context

**Iteration Decision:**
```
IF (confidence < 50% OR primary_actor == UNCLEAR OR core_goal == UNCLEAR):
  iteration_count++
  IF iteration_count <= 3:
    RETURN TO Directive 1 with these focus questions:
    - "What specific words in the epic indicate who the user is?"
    - "What verbs in the epic suggest the primary action?"
    - "What outcome/value does the epic promise?"
  ELSE:
    PROCEED WITH CAUTION - Note gaps in documentation
ELSE:
  PROCEED TO Phase 1.5
```

**Knowledge Building:**
- Document assumptions made
- Note ambiguities to clarify
- Record confidence level for each finding

---

## Phase 1.5: Parallel Context Discovery

Before diving into use case discovery, research the context in parallel streams to understand modern patterns, technology implications, and platform constraints that will inform discovery.

**Why this phase:** Use cases don't exist in a vacuum. Modern UX expectations, technology stacks, and platform constraints drive implicit use cases that won't be stated in the epic. Research these in parallel to discover technology-driven requirements early.

---

### Directive 1B: Launch Parallel Research Streams

**Research three contexts concurrently to inform Phase 3 discovery:**

---

#### Stream 1: Modern Behavior Pattern Research

**Research Question:** What modern UX/UI behaviors do users expect for [PROJECT_TYPE]?

**Discover at Runtime:**
```
Based on discovered project type from Phase 1:
ASK: "What are the modern UX/UI standards for [PROJECT_TYPE]?"

Research Focus Areas:

1. **Industry-Standard Interaction Patterns**
   - What UI patterns are standard for this domain?
   - [PATTERN_1]: [Description and expectation]
   - [PATTERN_2]: [Description and expectation]
   - [PATTERN_3]: [Description and expectation]

2. **Expected User Behaviors**
   - Keyboard shortcuts: [COMMON_SHORTCUTS]
   - Gestures: [SWIPE/DRAG/PINCH expectations]
   - Navigation: [TAB/FOCUS/BREADCRUMB patterns]
   - Interactions: [CLICK/HOVER/SELECTION behaviors]

3. **Accessibility Requirements**
   - Screen reader support: [ARIA requirements]
   - Keyboard navigation: [TAB order, focus management]
   - Color contrast: [WCAG standards]
   - Alternative input: [Voice, switch access]

4. **Mobile vs Desktop Patterns**
   - [PLATFORM_TYPE] typical behaviors:
     * [BEHAVIOR_1]: [Description]
     * [BEHAVIOR_2]: [Description]
     * [BEHAVIOR_3]: [Description]

5. **Progressive Enhancement Expectations**
   - Baseline functionality: [WHAT_WORKS_EVERYWHERE]
   - Enhanced functionality: [WHAT_WORKS_WITH_JS/MODERN_BROWSERS]
   - Offline capabilities: [EXPECTED_OFFLINE_FEATURES]
   - Real-time features: [LIVE_UPDATE_EXPECTATIONS]

Questions to Guide Research:
- What UX patterns are considered "table stakes" for this type of app?
- What keyboard shortcuts do power users expect?
- What accessibility features are mandatory vs nice-to-have?
- What mobile/touch interactions are standard?
- What offline/degraded mode behavior is expected?
- What real-time/collaborative features are typical?
```

**Document Findings:**
```markdown
## Stream 1 Findings: Modern Behavior Patterns for [PROJECT_TYPE]

### Standard Interaction Patterns
- [PATTERN_1]: [Description] → Implies implicit use case: [USE_CASE_DESCRIPTION]
- [PATTERN_2]: [Description] → Implies implicit use case: [USE_CASE_DESCRIPTION]

### Expected Keyboard Shortcuts
- [SHORTCUT_1]: [Action] → Requires: UC-XXX Alternative flow
- [SHORTCUT_2]: [Action] → Requires: UC-YYY Alternative flow

### Accessibility Requirements
- [REQUIREMENT_1]: [Description] → Implies implicit use case: [USE_CASE_DESCRIPTION]
- [REQUIREMENT_2]: [Description] → Implies implicit use case: [USE_CASE_DESCRIPTION]

### Platform-Specific Behaviors
- [BEHAVIOR_1 for PLATFORM]: [Description] → Requires: UC-ZZZ Implementation variation

### Implied Implicit Use Cases (from modern patterns):
1. UC-XXX: [Use case derived from pattern research]
2. UC-YYY: [Use case derived from accessibility]
3. UC-ZZZ: [Use case derived from platform behavior]
```

---

#### Stream 2: Technology Stack Research

**Research Question:** What technologies are typically used for [PROJECT_TYPE] and what implicit use cases do they require?

**Discover at Runtime:**
```
Based on discovered project type and platform from Phase 1:
ASK: "What technology stacks are common for [PROJECT_TYPE] on [PLATFORM]?"

Research Focus Areas:

1. **Common Technology Stacks**
   - Frontend: [TYPICAL_FRONTEND_TECH]
   - Backend: [TYPICAL_BACKEND_TECH]
   - Database: [TYPICAL_DATABASE_TECH]
   - API patterns: [REST/GraphQL/WebSocket]
   - State management: [CLIENT_STATE_APPROACH]

2. **Technology-Driven Use Cases**
   - Authentication: [AUTH_PATTERN] → Requires UC: [AUTH_USE_CASES]
   - Data persistence: [STORAGE_PATTERN] → Requires UC: [STORAGE_USE_CASES]
   - Real-time updates: [REALTIME_PATTERN] → Requires UC: [REALTIME_USE_CASES]
   - Offline support: [OFFLINE_PATTERN] → Requires UC: [OFFLINE_USE_CASES]
   - Caching: [CACHE_STRATEGY] → Requires UC: [CACHE_USE_CASES]

3. **Security Patterns**
   - Input validation: [VALIDATION_APPROACH] → Requires UC: [VALIDATION_USE_CASES]
   - XSS prevention: [XSS_STRATEGY] → Requires UC: [SANITIZATION_USE_CASES]
   - CSRF protection: [CSRF_APPROACH] → Requires UC: [TOKEN_USE_CASES]
   - Rate limiting: [RATE_LIMIT_PATTERN] → Requires UC: [THROTTLE_USE_CASES]

4. **Performance Patterns**
   - Lazy loading: [LAZY_LOAD_STRATEGY] → Requires UC: [LAZY_USE_CASES]
   - Code splitting: [SPLIT_APPROACH] → Requires UC: [BUNDLE_USE_CASES]
   - CDN usage: [CDN_PATTERN] → Requires UC: [ASSET_USE_CASES]
   - Caching strategy: [CACHE_APPROACH] → Requires UC: [CACHE_MGMT_USE_CASES]

5. **Integration Patterns**
   - External APIs: [API_INTEGRATION_PATTERN] → Requires UC: [API_USE_CASES]
   - Third-party services: [SERVICE_INTEGRATIONS] → Requires UC: [SERVICE_USE_CASES]
   - Analytics: [ANALYTICS_PATTERN] → Requires UC: [TRACKING_USE_CASES]

Questions to Guide Research:
- What authentication/authorization patterns are standard?
- What data persistence strategies are typical?
- What real-time capabilities do users expect?
- What offline support is standard?
- What security measures are mandatory?
- What performance optimizations are expected?
- What third-party integrations are common?
```

**Document Findings:**
```markdown
## Stream 2 Findings: Technology Implications for [PROJECT_TYPE]

### Common Technology Stack
- Frontend: [TECH] → Capabilities: [CAPABILITIES], Constraints: [CONSTRAINTS]
- Backend: [TECH] → Patterns: [PATTERNS], Limitations: [LIMITATIONS]
- Database: [TECH] → Operations: [OPERATIONS], Constraints: [CONSTRAINTS]

### Technology-Driven Implicit Use Cases:
1. UC-XXX: [AUTH_USE_CASE] - Required by [AUTH_TECHNOLOGY]
   - Example: "Refresh OAuth token when expired" (JWT with refresh tokens)
2. UC-YYY: [OFFLINE_USE_CASE] - Required by [OFFLINE_TECHNOLOGY]
   - Example: "Sync local changes when connection restored" (Service Workers)
3. UC-ZZZ: [CACHE_USE_CASE] - Required by [CACHE_TECHNOLOGY]
   - Example: "Invalidate cache when data updated" (Redis caching)

### Security-Driven Use Cases:
1. UC-AAA: [VALIDATION_USE_CASE] - Prevent XSS/injection attacks
2. UC-BBB: [SANITIZATION_USE_CASE] - Sanitize user-generated content

### Performance-Driven Use Cases:
1. UC-CCC: [LAZY_LOAD_USE_CASE] - Improve initial load time
2. UC-DDD: [CACHE_USE_CASE] - Reduce API calls
```

---

#### Stream 3: Platform/Environment Constraint Research

**Research Question:** What does [TARGET_PLATFORM] require, enable, or constrain?

**Discover at Runtime:**
```
Based on discovered platform from Phase 1:
ASK: "What are the capabilities and constraints of [TARGET_PLATFORM]?"

Research Focus Areas:

1. **Platform Limitations**
   - Execution timeouts: [TIMEOUT_LIMIT] → Requires UC: [TIMEOUT_HANDLING]
   - Storage limits: [STORAGE_LIMIT] → Requires UC: [STORAGE_MGMT]
   - API quotas: [API_QUOTA] → Requires UC: [QUOTA_MONITORING]
   - Memory constraints: [MEMORY_LIMIT] → Requires UC: [MEMORY_MGMT]
   - Concurrency limits: [CONCURRENCY_LIMIT] → Requires UC: [QUEUE_MGMT]

2. **Required Platform Patterns**
   - Initialization: [INIT_PATTERN] → Requires UC: [INIT_USE_CASE]
   - Lifecycle management: [LIFECYCLE_PATTERN] → Requires UC: [LIFECYCLE_USE_CASES]
   - Event handling: [EVENT_PATTERN] → Requires UC: [EVENT_USE_CASES]
   - Background processing: [BACKGROUND_PATTERN] → Requires UC: [BACKGROUND_USE_CASES]

3. **Platform Capabilities**
   - Available services: [SERVICE_1], [SERVICE_2], [SERVICE_3]
   - APIs accessible: [API_1], [API_2], [API_3]
   - Storage options: [STORAGE_1], [STORAGE_2], [STORAGE_3]
   - Communication channels: [CHANNEL_1], [CHANNEL_2]

4. **Platform-Specific Constraints**
   - What's NOT available: [MISSING_CAPABILITY_1], [MISSING_CAPABILITY_2]
   - Workarounds required: [WORKAROUND_1], [WORKAROUND_2]
   - Alternative approaches: [ALTERNATIVE_1], [ALTERNATIVE_2]

5. **Integration Patterns**
   - How to integrate with [PLATFORM_SERVICE_1]: [INTEGRATION_PATTERN_1]
   - How to integrate with [PLATFORM_SERVICE_2]: [INTEGRATION_PATTERN_2]
   - Data exchange patterns: [DATA_PATTERN]

Questions to Guide Research:
- What are the hard constraints (timeouts, storage, quotas)?
- What platform-mandated patterns must be followed?
- What capabilities does the platform provide?
- What capabilities are missing (requiring workarounds)?
- How does the platform handle lifecycle events?
- What security/privacy requirements does platform enforce?
- What integration patterns are required?
```

**Document Findings:**
```markdown
## Stream 3 Findings: Platform Constraints for [TARGET_PLATFORM]

### Platform Limitations & Required Use Cases:
1. **[CONSTRAINT_1]**: [LIMIT_DESCRIPTION]
   → UC-XXX: [CONSTRAINT_HANDLING_USE_CASE]
   - Example: "6-minute execution timeout" → "Resume long-running operations across multiple executions"

2. **[CONSTRAINT_2]**: [LIMIT_DESCRIPTION]
   → UC-YYY: [CONSTRAINT_HANDLING_USE_CASE]
   - Example: "500KB storage limit" → "Warn when approaching storage limit"

3. **[CONSTRAINT_3]**: [LIMIT_DESCRIPTION]
   → UC-ZZZ: [CONSTRAINT_HANDLING_USE_CASE]
   - Example: "No WebSocket support" → "Poll for updates every N seconds"

### Platform-Mandated Patterns:
1. UC-AAA: [INIT_USE_CASE] - Required initialization pattern
2. UC-BBB: [LIFECYCLE_USE_CASE] - Required lifecycle management
3. UC-CCC: [AUTH_USE_CASE] - Platform-specific authentication

### Platform Capabilities Enabling Features:
- [CAPABILITY_1] enables: [FEATURE_DESCRIPTION]
- [CAPABILITY_2] enables: [FEATURE_DESCRIPTION]

### Workarounds for Missing Capabilities:
- [MISSING_CAPABILITY] → Workaround: [WORKAROUND] → Requires UC: [WORKAROUND_USE_CASE]
```

---

### Directive 1C: Synthesize Research Findings

**Combine findings from all three streams to identify technology-driven implicit use cases.**

**Synthesis Process:**

1. **Cross-Reference Stream Findings**
   - Match modern patterns (Stream 1) with technology capabilities (Stream 2)
   - Match technology requirements (Stream 2) with platform constraints (Stream 3)
   - Identify conflicts (modern expectation vs platform limitation)
   - Identify workarounds (when constraint blocks expectation)

2. **Identify Technology-Driven Implicit Use Cases**

```markdown
## Synthesized Implicit Use Cases (Technology-Driven)

### From Stream 1 + Stream 2 (Modern Pattern + Technology):
- UC-050: [USE_CASE_FROM_PATTERN_AND_TECH]
  * **Derived From**: [MODERN_PATTERN] requires [TECHNOLOGY_PATTERN]
  * **Example**: "Optimistic UI updates" + "Client-side state management" → "Revert UI on API failure"

### From Stream 2 + Stream 3 (Technology + Platform Constraint):
- UC-060: [USE_CASE_FROM_TECH_AND_CONSTRAINT]
  * **Derived From**: [TECHNOLOGY_NEED] conflicts with [PLATFORM_CONSTRAINT]
  * **Example**: "Real-time WebSocket" + "No WebSocket on platform" → "Poll for updates every 5 seconds"

### From Stream 1 + Stream 3 (Modern Pattern + Platform Constraint):
- UC-070: [USE_CASE_FROM_PATTERN_AND_CONSTRAINT]
  * **Derived From**: [MODERN_EXPECTATION] limited by [PLATFORM_CONSTRAINT]
  * **Example**: "Infinite scroll" + "6-minute timeout" → "Paginate with resume capability"

### Conflicting Requirements (Need Resolution):
1. **Conflict**: [MODERN_EXPECTATION] vs [PLATFORM_LIMITATION]
   * **Resolution**: [WORKAROUND_APPROACH]
   * **Implied Use Case**: UC-XXX: [WORKAROUND_USE_CASE]

2. **Conflict**: [TECHNOLOGY_REQUIREMENT] vs [PLATFORM_CONSTRAINT]
   * **Resolution**: [ALTERNATIVE_APPROACH]
   * **Implied Use Case**: UC-YYY: [ALTERNATIVE_USE_CASE]
```

3. **Update Knowledge Base**

```
technology_driven_implicit_use_case_count = [count from synthesis]

Add to knowledge base for Phase 2:
- Modern pattern expectations: [LIST]
- Technology implications: [LIST]
- Platform constraints: [LIST]
- Conflicting requirements & resolutions: [LIST]
- Technology-driven implicit use cases: [LIST with UC-XXX IDs]
```

4. **Establish Baseline Expectations for Phase 3**

**These findings inform Phase 3 discovery:**
- **Directive 3 (Implicit Use Cases)**: Reference these technology-driven use cases
- **Directive 5 (UI Patterns)**: Apply modern pattern research to UI expectations
- **Directive 6 (Error Flows)**: Consider technology failure scenarios
- **All Directives**: Keep platform constraints in mind for feasibility

---

## ✅ Quality Gate: Parallel Discovery Complete

**Before proceeding to Phase 3, verify:**

1. **Research Completeness** (Required):
   - [ ] Stream 1: Modern behavior patterns researched for [PROJECT_TYPE] (>= 5 patterns documented)
   - [ ] Stream 2: Technology stack implications researched (>= 5 technology-driven use cases identified)
   - [ ] Stream 3: Platform constraints researched for [TARGET_PLATFORM] (>= 3 constraints documented)
   - [ ] Synthesis: Findings from all 3 streams combined (conflicts identified, resolutions proposed)

2. **Implicit Use Case Discovery** (Required):
   - [ ] Technology-driven implicit use cases identified (>= 5 use cases)
   - [ ] Modern pattern expectations documented (inform UI layer discovery)
   - [ ] Platform constraints documented (inform feasibility assessment)
   - [ ] Conflicting requirements resolved (workarounds identified)

3. **Confidence Assessment**:
   - Rate research completeness: LOW (< 50%) | MEDIUM (50-80%) | HIGH (> 80%)
   - If confidence < 50%: **ITERATE** - Conduct more focused research

**Iteration Decision:**
```
IF (modern_pattern_count < 5 OR
    technology_use_case_count < 5 OR
    platform_constraint_count < 3 OR
    synthesis_incomplete OR
    confidence < 50%):
  iteration_count++
  IF iteration_count <= 3:
    RETURN TO appropriate stream with focus questions:

    Low pattern count → Stream 1:
    - "What UX patterns are considered standard for [PROJECT_TYPE]?"
    - "What accessibility features are mandatory?"
    - "What keyboard shortcuts do power users expect?"
    - "What mobile/touch patterns are typical?"

    Low technology count → Stream 2:
    - "What authentication patterns are standard?"
    - "What offline capabilities are expected?"
    - "What caching strategies are common?"
    - "What security measures are mandatory?"

    Low constraint count → Stream 3:
    - "What are the hard limits (timeout, storage, API quotas)?"
    - "What capabilities are missing (requiring workarounds)?"
    - "What platform-mandated patterns must be followed?"
    - "What integration patterns are required?"

    Incomplete synthesis:
    - "What modern expectations conflict with platform constraints?"
    - "What technology requirements are blocked by platform limitations?"
    - "What workarounds resolve these conflicts?"
  ELSE:
    PROCEED WITH CAUTION - Note gaps in documentation, revisit during Phase 3
ELSE:
  PROCEED TO Phase 3
```

**Knowledge Building:**
- Document all technology-driven implicit use cases with traceability
- Record baseline expectations for Phase 3 discovery
- Note conflicts and resolutions for implementation guidance
- Establish confidence level for each finding

**State Update:**
```
technology_driven_implicit_use_case_count = [count]
implicit_use_case_count += technology_driven_implicit_use_case_count

parallel_discovery_completeness_score = (
  (modern_pattern_count >= 5 ? 0.33 : 0) +
  (technology_use_case_count >= 5 ? 0.33 : 0) +
  (platform_constraint_count >= 3 ? 0.34 : 0)
) * 100

knowledge_confidence_score = (
  knowledge_confidence_score * 0.5 +
  parallel_discovery_completeness_score * 0.5
)
```

---

## Phase 3: Use Case Discovery

Now progressively discover use cases by following knowledge threads. Start with what's explicit, then uncover what's implicit.

**Note:** Phase 1.5 research findings inform this discovery. Reference technology-driven implicit use cases when deriving implicit use cases in Directive 3.

---

### Directive 2: Extract Explicit Use Cases

**Identify use cases directly stated in the epic.** Look for:
- Actions described ("user can...")
- Workflows outlined ("user does X, then Y")
- Goals mentioned ("achieve Z")
- Features listed ("support ABC")

**For each explicit use case, document:**

**UC-XXX: [Use Case Name]**
- **Actor**: Who performs this
- **Goal**: What they want to accomplish
- **Trigger**: What initiates this use case
- **Preconditions**: What must be true before this can execute
- **Main Flow**:
  1. Step 1
  2. Step 2
  3. Step 3
- **Postconditions**: What is true after success
- **Source**: Quote from epic
- **Confidence**: HIGH (explicitly stated)

**Update state:** Increment `explicit_use_case_count`

**Progressive questioning:**
- "What other actions does the epic explicitly describe?"
- "Are there variations mentioned?" (e.g., "user can also...")
- "What features are listed?"

---

### Directive 3: Derive Implicit Use Cases

**Uncover use cases NOT stated but expected.** These emerge from unstated expectations and domain knowledge:

#### From Setup/Configuration Needs
**If explicit use cases exist, what setup is implied?**
- **Initial Configuration**: How is system set up for first use?
- **Credential Management**: How are API keys/passwords configured?
- **Preferences**: What user settings exist?
- **Defaults**: What default values are set?

**Example Pattern - Discover Runtime:**
```
For discovered explicit use case "[ACTION]":
ASK: "What credentials/configuration does [ACTION] require?"
  → If API/external service: "Configure [SERVICE] credentials"
  → If complex: "Test [SERVICE] connection"
  → If expiring: "Update [SERVICE] credentials when expired"

Questions to ask:
- What setup must happen before this action can execute?
- What external services does this depend on?
- What configuration values are needed?
- What happens when configuration becomes invalid?
```

#### From Error Recovery Needs
**For each explicit use case, what error scenarios exist?**
- **Validation Failures**: What if data is invalid?
- **Network Failures**: What if API/service is unavailable?
- **Timeout Scenarios**: What if operation takes too long?
- **Conflict Resolution**: What if concurrent edits occur?

**Example Pattern - Discover Runtime:**
```
For discovered explicit use case "[PERSISTENT_ACTION]":
ASK: "What error scenarios exist for [PERSISTENT_ACTION]?"
  → "Handle [ACTION] failure"
  → If retryable: "Retry [ACTION] with exponential backoff"
  → "Notify user of [ACTION] failure"
  → If data loss risk: "Recover unsaved [DATA]"

Questions to ask:
- What can go wrong at each step?
- Is this operation retryable?
- What happens to user data if this fails?
- How is the user notified of failures?
```

#### From Data Management Needs
**For each entity, what CRUD operations are implied?**
- **Create**: How is data created initially?
- **Read**: How is existing data accessed?
- **Update**: How is data modified?
- **Delete**: How is data removed?
- **Archive**: How is old data archived?
- **Restore**: Can deleted data be recovered?

**Example Pattern - Discover Runtime:**
```
For discovered entity "[ENTITY]" with display use case:
ASK: "What CRUD operations exist for [ENTITY]?"
  → "Create new [ENTITY]"
  → "Rename/edit [ENTITY]"
  → "Delete [ENTITY]"
  → If accumulates: "Archive old [ENTITY]s"
  → If many: "Search [ENTITY] list"

Questions to ask:
- Can users create this entity?
- Can they modify it after creation?
- Can they remove it?
- Does it accumulate over time (needs archiving)?
- Will there be enough to warrant search?
```

#### From Permission/Access Needs
**Who can and cannot do what?**
- **Access Control**: What requires authentication?
- **Authorization**: What role-based restrictions exist?
- **Sharing**: Can data be shared? How?
- **Ownership Transfer**: Can ownership change?

**Example Pattern - Discover Runtime:**
```
For discovered use case "[ACTION] their [RESOURCE]":
ASK: "Who can access [RESOURCE] and how?"
  → If personal data: "[ACTOR] authenticates/logs in"
  → If admin exists: "Admin [ACTION]s all [RESOURCE]s"
  → If collaboration: "[ACTOR] shares [RESOURCE] with others"
  → If revocable: "[ACTOR] revokes shared access"

Questions to ask:
- Is this resource personal or shared?
- What roles exist in the system?
- Can resources be shared between users?
- Who has administrative access?
```

#### From Lifecycle Management
**What happens over time?**
- **First-Time Use**: Onboarding, tutorials, setup wizards
- **Ongoing Usage**: Daily/regular operations
- **Maintenance**: Updates, cleanup, optimization
- **Migration**: Import/export, version upgrades
- **Decommission**: Account closure, data deletion

**Example Pattern - Discover Runtime:**
```
For discovered primary feature "[FEATURE]":
ASK: "What lifecycle stages exist for this system?"
  → If complex: "First-time setup wizard"
  → If learning curve: "Show tutorial on first use"
  → If data accumulates: "Export [DATA] history"
  → If cleanup needed: "Clear all [DATA] history"

Questions to ask:
- How do first-time users get started?
- Is there a learning curve requiring tutorials?
- Can users export their data?
- Can users reset/clear accumulated data?
```

#### From Platform Constraints
**What does the platform require?**
- **Storage Limits**: Cleanup when approaching limits
- **API Quotas**: Throttling, queuing, quota monitoring
- **Execution Timeouts**: Resume interrupted operations
- **Authentication**: Token refresh, re-authentication

**For each implicit use case, document:**

**UC-XXX: [Use Case Name]** (IMPLICIT)
- **Actor**: Who performs this
- **Goal**: What they want to accomplish
- **Trigger**: What initiates this
- **Derivation Reasoning**: Why this is expected (quote the pattern)
- **Confidence**: MEDIUM or LOW
- **Related Explicit Use Case**: UC-NNN

**Update state:** Increment `implicit_use_case_count`

**Progressive questioning:**
- "If explicit use case X exists, what setup/config is needed?"
- "What happens when X fails?"
- "Who manages this data over time?"
- "What platform constraints force additional use cases?"

---

### Directive 4: Identify Cascading Use Cases

**Discover use cases that trigger other use cases.** Map the cascade chains:

#### Sequential Cascades
**Use case A completes → automatically triggers use case B**

**Example Pattern - Discover Runtime:**
```
For discovered primary action "[USER_ACTION]":
ASK: "What must happen after [USER_ACTION] completes?"

Pattern Discovery:
UC-001: [USER_ACTION]
  ↓ (completes successfully)
UC-002: System calls [EXTERNAL_SERVICE] (if external API)
  ↓ (receives response)
UC-003: System stores [DATA] in [STORAGE] (if persistent)
  ↓ (updates storage)
UC-004: System displays [RESULT] to user
  ↓ (triggers)
UC-005: System updates [METADATA] (timestamps, counts, etc.)

Questions to derive cascade:
- Does this action call an external service?
- Should the result be persisted?
- How is the user notified of completion?
- What metadata needs updating?
```

#### Conditional Cascades
**Use case A completes → conditionally triggers use case B**

**Example Pattern - Discover Runtime:**
```
For discovered creation action "User creates [ENTITY]":
ASK: "What conditions might trigger additional actions?"

Pattern Discovery:
UC-010: User creates [ENTITY]
  ↓ (if [RESOURCE] > threshold)
UC-011: System prompts to [CLEANUP_ACTION]
  ↓ (if user confirms)
UC-012: System executes [CLEANUP_ACTION]

Questions to derive conditional cascade:
- Are there resource constraints (storage, quota, limits)?
- What thresholds trigger warnings or actions?
- Does user have control over triggered actions?
```

#### Parallel Cascades
**Use case A triggers multiple use cases simultaneously**

**Example Pattern - Discover Runtime:**
```
For discovered submit action "User submits [FORM/DATA]":
ASK: "What must happen simultaneously when submitted?"

Pattern Discovery:
UC-020: User submits [FORM/DATA]
  ├─→ UC-021: Validate [DATA] (parallel)
  ├─→ UC-022: Log [ACTION] (parallel)
  └─→ UC-023: Show [FEEDBACK_INDICATOR] (parallel)

Questions to derive parallel cascade:
- What validation happens immediately?
- What logging/auditing is required?
- What UI feedback is shown?
- What background processes start?
```

#### Side Effect Cascades
**Use case A has side effects that require other use cases**

**Example Pattern - Discover Runtime:**
```
For discovered delete action "User deletes [ENTITY]":
ASK: "What side effects occur when [ENTITY] is deleted?"

Pattern Discovery:
UC-030: User deletes [ENTITY]
  ├─→ UC-031: Archive [ENTITY] data (side effect - if recoverable)
  ├─→ UC-032: Remove from [USER_LIST] (side effect)
  ├─→ UC-033: Update [METRICS/QUOTAS] (side effect)
  └─→ UC-034: Show [CONFIRMATION] notification (side effect)

Questions to derive side effect cascade:
- Should deleted data be archived/recoverable?
- What lists/views display this entity?
- What quotas/metrics track this entity?
- How is user notified of completion?
```

#### Rollback Cascades
**Use case A fails → triggers compensating use cases**

**Example Pattern - Discover Runtime:**
```
For discovered transactional action "[TRANSACTIONAL_ACTION]":
ASK: "What happens if [ACTION] fails midway?"

Pattern Discovery:
UC-040: [TRANSACTIONAL_ACTION]
  ↓ (fails at step N)
UC-041: Rollback partial [STATE_CHANGES]
  ↓ (triggers)
UC-042: Notify user of [FAILURE_TYPE]
  ↓ (triggers)
UC-043: Log [ERROR_DETAILS] for investigation

Questions to derive rollback cascade:
- Is this action atomic or multi-step?
- What state changes if it partially completes?
- How is partial state rolled back?
- How is user notified of failure?
- What error logging is needed for debugging?
```

**For each cascade relationship, document:**
```markdown
### Cascade Chain: [Chain Name]

**Trigger**: UC-XXX: [Primary use case]

**Cascade Type**: Sequential | Conditional | Parallel | Side Effect | Rollback

**Flow:**
1. UC-XXX: [Primary use case] completes
   ↓ [condition or "automatically"]
2. UC-YYY: [Secondary use case] executes
   ↓ [condition or "automatically"]
3. UC-ZZZ: [Tertiary use case] executes

**Confidence**: HIGH/MEDIUM/LOW
**Reasoning**: [Why this cascade exists]
```

**Update state:** Increment `cascading_use_case_count`

**Progressive questioning:**
- "When use case X completes, what must happen next?"
- "What side effects does use case X have?"
- "If use case X fails, what cleanup is needed?"
- "Can use case X trigger multiple actions in parallel?"

---

### Directive 5: UI Interaction Patterns ⭐ CRITICAL

**For each use case (explicit, implicit, or cascading), discover detailed UI interaction patterns.**

This is the MOST IMPORTANT directive for understanding unstated expectations.

---

#### Layer 1: Interface Navigation

**For this use case, map the UI journey:**

**Starting State:**
- What screen/view is user on when this use case begins?
- What is visible on screen?
- What navigation context exists? (breadcrumbs, back button, etc.)

**Actions Available:**
- What buttons/links/controls are visible?
- What is primary action? (visually emphasized)
- What are secondary actions?
- What is disabled/unavailable?

**Navigation Flow:**
- User clicks/taps → what happens?
- What screen appears next?
- How does user navigate back?
- Can user cancel? At what points?

**Example Pattern - Discover Runtime:**
```
For discovered primary use case "[USER_ACTION]":
ASK: "What is the UI navigation flow for [USER_ACTION]?"

Pattern Discovery:
UC-XXX: [USER_ACTION]

Starting State:
- Screen: [SCREEN_NAME] interface
- Visible: [PRIMARY_CONTROL], [ACTION_BUTTON], [DATA_DISPLAY_AREA]
- Navigation: [NAVIGATION_CONTEXT] (back button, breadcrumbs, etc.)

Actions Available:
- Primary: "[ACTION_BUTTON]" (visually emphasized - color, size, position)
- Secondary: [SECONDARY_CONTROLS] (icons, links, etc.)
- Disabled: [ACTION_BUTTON] until [CONDITION] met

Navigation Flow:
1. User interacts with [PRIMARY_CONTROL]
   → [ACTION_BUTTON] becomes enabled (visual feedback)
2. User activates [ACTION_BUTTON]
   → [PRIMARY_CONTROL] disabled (prevents double-submit)
   → Screen shows: Loading indicator on [AFFECTED_AREA]
   → Scrolls/navigates to [TARGET_LOCATION]
3. System responds (API/processing completes)
   → Loading indicator replaced with [RESULT_DISPLAY]
   → [PRIMARY_CONTROL] re-enabled for next action

Questions to derive navigation:
- What screen does user start on?
- What is the primary action control?
- What gets enabled/disabled during the flow?
- Where does user navigate during/after action?
- What loading/transition states exist?
```

---

#### Layer 2: Interaction Expectations

**What interaction behaviors are expected?**

**Click/Tap Behaviors:**
- Single click: What happens?
- Double click: Does it do something different?
- Right-click: Context menu?
- Long press (mobile): Special actions?

**Keyboard Shortcuts:**
- Enter: Submit? New line?
- Ctrl+Enter / Cmd+Enter: Alternative action?
- Escape: Cancel? Close?
- Tab: Navigate fields? Autocomplete?

**Drag and Drop:**
- Can user drag elements?
- What is valid drop target?
- What visual feedback during drag?

**Hover States:**
- Mouse over buttons: Tooltip? Visual change?
- Hover over data: Additional info shown?

**Selection Behaviors:**
- Can user select text/items?
- Multi-select: Ctrl+click, Shift+click?
- Select all: Available?

**Example Pattern - Discover Runtime:**
```
For discovered edit use case "Edit [ENTITY_ATTRIBUTE]":
ASK: "What interaction behaviors are expected for editing [ENTITY_ATTRIBUTE]?"

Pattern Discovery:
UC-XXX: Edit [ENTITY_ATTRIBUTE]

Interaction Expectations:
- Click on [ENTITY_ATTRIBUTE] → enters edit mode (inline editing)
- Keyboard: Enter saves, Escape cancels
- Click outside [ENTITY_ATTRIBUTE] → saves changes
- Double-click → selects all text for easy replacement
- Hover: Shows [EDIT_INDICATOR_ICON] indicating editability
- Right-click: Context menu with "Edit [ENTITY_ATTRIBUTE]" option

Questions to derive interaction behaviors:
- Is editing inline or in a modal/form?
- What keyboard shortcuts apply?
- What mouse gestures are supported (hover, right-click, drag)?
- How does user save? Cancel? Undo?
- What visual feedback indicates editability?
```

---

#### Layer 3: Notifications & Feedback ⭐

**What confirms actions? What warns about problems?**

**Success Notifications:**
- What message is shown?
- Where is it displayed? (toast, modal, inline, banner)
- How long does it persist? (auto-dismiss after N seconds?)
- Can user dismiss it?
- What icon/color? (checkmark, green, etc.)

**Error Notifications:**
- What error messages exist?
- Where shown? (inline validation, modal alert, banner)
- How specific? (generic vs. actionable)
- What actions offered? (retry, cancel, help link)

**Warning Notifications:**
- What warnings appear?
- When shown? (before destructive action, approaching limit)
- What can user do? (proceed, cancel)

**Progress Indicators:**
- What shows operation is in progress?
- Spinner? Progress bar? Percentage?
- Can user cancel in-progress operation?

**Confirmation Dialogs:**
- What requires confirmation? (delete, overwrite, etc.)
- What is the message?
- What buttons? (Yes/No, OK/Cancel, descriptive actions)

**Contextual Feedback:**
- Hover tooltips
- Inline help text
- Placeholder text in inputs
- Character count (e.g., "250/500 characters")

**Example Pattern - Discover Runtime:**
```
For discovered destructive action "Delete [ENTITY]":
ASK: "What notifications and feedback are shown for deleting [ENTITY]?"

Pattern Discovery:
UC-XXX: Delete [ENTITY]

Notifications & Feedback:

Confirmation:
- Modal dialog appears
- Title: "Delete [ENTITY]?"
- Message: "This will permanently delete '[ENTITY_NAME]' and [RELATED_DATA]. This cannot be undone."
- Buttons: "Cancel" (gray, left), "Delete" (red, right)

Success:
- Modal closes
- Toast notification ([POSITION])
- Message: "[ENTITY] deleted"
- Icon: Checkmark
- Color: Green
- Duration: 3 seconds, auto-dismiss
- [ENTITY] removed from list with [ANIMATION_TYPE] animation

Error (if delete fails):
- Modal stays open
- Error banner appears above buttons
- Message: "Could not delete [ENTITY]. Please try again."
- Icon: Warning triangle
- Color: Red
- Buttons: "Try Again", "Cancel"

Questions to derive notifications:
- What destructive actions require confirmation dialogs?
- Where are success notifications displayed (toast, banner, inline)?
- How long do notifications persist?
- What error recovery options are offered?
- What animations/transitions reinforce the action?
```

---

#### Layer 4: Data Display Expectations

**What data is shown? How is it presented?**

**Initial Display:**
- What data loads first? (above the fold)
- What is lazy-loaded? (on scroll, on expand)
- What is hidden initially? (collapsed sections)

**Data Formatting:**
- Dates: Relative ("2 hours ago") or absolute ("Jan 15, 2025")?
- Numbers: Formatted (commas, decimals, currency)?
- Long text: Truncated with "..." and expand option?
- Links: Underlined? Different color? Open in new tab?

**Visibility & Hierarchy:**
- What is emphasized? (bold, larger, colored)
- What is de-emphasized? (gray, smaller)
- What is grouping? (cards, sections, dividers)

**Editable vs. Read-Only:**
- What fields can be edited?
- How is editability indicated? (hover state, pencil icon)
- What is locked? Why? (grayed out with tooltip)

**Expand/Collapse:**
- What can be expanded? (sections, details, nested items)
- What is initially collapsed?
- How is expandability indicated? (chevron icon, "Show more" link)

**Filtering/Sorting:**
- What can be filtered?
- What filter options exist?
- Default sorting?
- Can user change sort order?

**Example Pattern - Discover Runtime:**
```
For discovered list/view use case "View [ENTITY_LIST]":
ASK: "What data is shown and how is it presented in [ENTITY_LIST]?"

Pattern Discovery:
UC-XXX: View [ENTITY_LIST]

Data Display:

Initial Display:
- List of [ENTITY_ITEMS] ([DEFAULT_SORT_ORDER] first)
- Each [ENTITY_ITEM] shows:
  * [PRIMARY_ATTRIBUTE] (bold, emphasized)
  * [SECONDARY_ATTRIBUTE] (gray, truncated to N chars)
  * [METADATA] (gray, relative or absolute)
  * [STATUS_INDICATOR] (icon/badge if applicable)
- Loads [N] items initially
- "[LOAD_MORE_CONTROL]" at bottom

Formatting:
- [TIMESTAMP_ATTRIBUTE]: Relative for < N days, absolute for older
- Long [TEXT_ATTRIBUTE]: Truncated with "..." at N characters
- [STATUS_ATTRIBUTE]: Badge/icon with value (if applicable)

Interactions:
- Hover: Background changes to [HOVER_COLOR], shows [ACTION_ICON]
- Click [ENTITY_ITEM]: Opens [DETAIL_VIEW]
- Click [ACTION_ICON]: [ACTION_DIALOG/FLOW]
- Swipe left (mobile): Reveals [QUICK_ACTIONS]

Filtering:
- Search box at top (filters by [SEARCHABLE_ATTRIBUTES])
- Filter buttons: "[FILTER_1]", "[FILTER_2]", "[FILTER_3]"
- Default: "[DEFAULT_FILTER]"
- Sort options: "[SORT_1]", "[SORT_2]", "[SORT_3]"

Questions to derive data display:
- What entities are shown in the list?
- What attributes of each entity are visible?
- How is data formatted (dates, numbers, text)?
- What is the default sort order?
- What filtering options exist?
- How does pagination/infinite scroll work?
- What interactions are available on list items?
```

---

#### Layer 5: State Management

**How does UI represent system state?**

**Loading States:**
- **Initial Load**: Skeleton screens? Spinner? Blank with message?
- **Action in Progress**: Button shows spinner? Disabled state?
- **Background Refresh**: Subtle indicator? No indicator?
- **Partial Load**: Show what's available, continue loading rest?

**Empty States:**
- **No Data Yet**: What message? ("No conversations yet")
- **Illustration/Icon**: Friendly graphic?
- **Call to Action**: "Create your first conversation" button?
- **Help Text**: Instructions or tips?

**Error States:**
- **Load Failure**: Retry button? Error message?
- **Partial Failure**: Show what loaded, indicate what failed?
- **Network Offline**: "You're offline" banner? Retry when online?

**Success States:**
- **Action Completed**: Visual confirmation (checkmark animation)?
- **State Change Reflected**: UI updates immediately?
- **Optimistic UI**: Show change before API confirms?

**Disabled States:**
- **Temporary Disable**: Grayed out while loading?
- **Permanent Disable**: Not visible? Locked with explanation?
- **Conditional Disable**: Tooltip explains why disabled?

**Transition Animations:**
- **Appear**: Fade in? Slide in from direction?
- **Disappear**: Fade out? Slide out?
- **State Change**: Smooth transitions?

**Example Pattern - Discover Runtime:**
```
For discovered action use case "[USER_ACTION]":
ASK: "How does UI represent system state for [USER_ACTION]?"

Pattern Discovery:
UC-XXX: [USER_ACTION]

State Management:

Loading States:
- Before [ACTION]: [CONTROL] [COLOR], enabled, label "[ACTION_LABEL]"
- During [ACTION]:
  * [CONTROL] disabled
  * Label changes to [LOADING_INDICATOR] icon
  * [INPUT_CONTROL] disabled ([DISABLED_COLOR])
  * [VIEW] scrolls to [TARGET_POSITION]
- After [ACTION] Success:
  * [CONTROL] re-enabled
  * Label back to "[ACTION_LABEL]"
  * [INPUT_CONTROL] cleared and re-enabled
  * New [RESULT_ITEM] appears with [ANIMATION_TYPE] animation

Empty State (no [DATA] yet):
- Illustration: [FRIENDLY_ICON/GRAPHIC]
- Heading: "[EMPTY_STATE_MESSAGE]"
- Subtext: "[HELPFUL_PROMPT]"
- [PRIMARY_CONTROL] auto-focused

Error State ([ACTION] fails):
- [RESULT_ITEM] appears with [ERROR_COLOR] border
- Error icon in [DISPLAY_AREA]
- Tooltip on hover: "[ERROR_MESSAGE]. [RECOVERY_ACTION]."
- [INPUT_CONTROL] retains [DATA] (not cleared)
- [ACTION_CONTROL] re-enabled for retry

Offline State (network unavailable):
- Banner at top: "[OFFLINE_MESSAGE]. [QUEUE_BEHAVIOR]."
- Banner color: [WARNING_COLOR]
- [DATA] queue locally
- Auto-[ACTION] when connection restored

Questions to derive state management:
- What loading indicators are shown during processing?
- What does the empty state look like?
- How are errors displayed and recovered?
- What offline/degraded mode behavior exists?
- What animations/transitions communicate state changes?
```

---

#### Layer 6: Follow-on Sequences

**After completing this use case, what typically comes next?**

**Immediate Next Actions:**
- What does user naturally do next?
- What does system suggest?
- What related actions are offered?

**Workflow Patterns:**
- Create → Edit → Publish
- Search → Select → View Details → Take Action
- Configure → Test → Use → Monitor
- Import → Transform → Validate → Save

**Suggested Actions:**
- "Next steps" prompts
- Related features highlighted
- Onboarding hints for new users

**Contextual Actions:**
- Based on current state, what's relevant?
- Shortcuts to common next steps

**Example Pattern - Discover Runtime:**
```
For discovered creation use case "Create [ENTITY]":
ASK: "What typically comes next after creating [ENTITY]?"

Pattern Discovery:
UC-XXX: Create [ENTITY]

Follow-on Sequence:

Immediate Next Actions:
1. User creates [ENTITY]
   → System shows [EMPTY_STATE_VIEW]
   → [PRIMARY_CONTROL] auto-focused
   → Suggestion: "[FIRST_ACTION_PROMPT]"

Typical Pattern:
- Create [ENTITY]
  → [FIRST_ACTION] (most common first step)
  → [SECOND_ACTION] (typical follow-up)
  → [THIRD_ACTION] (common continuation)
  → [MAINTENANCE_ACTION] (if needed - rename, edit, etc.)
  → [NAVIGATION_ACTION] (return to list/dashboard)

Suggested Actions (after [FIRST_ACTION]):
- Tip bubble: "[HELPFUL_HINT_ABOUT_FEATURE]"
- Related: "[SUGGESTION_FOR_NEXT_STEP]"
- Shortcut: "[KEYBOARD_SHORTCUT_FOR_COMMON_ACTION]"

Contextual (if user pauses):
- After [TIMEOUT_DURATION] idle: "[HELPFUL_PROMPT_OR_EXAMPLES]"
- After [LONGER_TIMEOUT]: "[REASSURANCE_MESSAGE]" (auto-save, progress saved, etc.)

Questions to derive follow-on sequences:
- What does user naturally do immediately after creation?
- What is the typical workflow pattern?
- What helpful hints guide user to next steps?
- What keyboard shortcuts enable faster workflows?
- What contextual prompts appear if user is idle?
- What reassurance messages reduce anxiety?
```

---

**For each use case, document UI patterns:**

```markdown
## UC-XXX: [Use Case Name] - UI Interaction Pattern

### Navigation
- **Starting Screen**: [Screen name]
- **Primary Action**: [Button/control]
- **Navigation Flow**: [Step-by-step]

### Interaction Behaviors
- **Click**: [What happens]
- **Keyboard**: [Shortcuts available]
- **Drag/Drop**: [If applicable]
- **Hover**: [Feedback provided]

### Notifications & Feedback
- **Success**: [Message, location, duration]
- **Error**: [Message, location, recovery options]
- **Progress**: [Indicator type and behavior]
- **Confirmation**: [What requires confirmation]

### Data Display
- **Initial**: [What's shown first]
- **Formatting**: [How data appears]
- **Editable**: [What can be modified]
- **Hidden**: [What's collapsed/hidden]

### State Management
- **Loading**: [How loading is shown]
- **Empty**: [Empty state design]
- **Error**: [Error state design]
- **Success**: [Success indication]

### Follow-on Sequence
- **Typical Next**: [Common next action]
- **Suggested**: [System suggestions]
- **Pattern**: [Workflow pattern]

**Confidence**: HIGH/MEDIUM/LOW
**Source**: [Explicit from epic / Inferred from pattern / Domain knowledge]
```

**Update state:** Increment `ui_pattern_count`

**Progressive questioning:**
- "Where does user start this use case?"
- "What confirms the action succeeded?"
- "What happens if it fails?"
- "What state is the UI in while processing?"
- "What does user typically do next?"
- "What data is shown and how?"

---

### Directive 6: Alternative & Error Flows

**For each use case, discover alternative paths and error scenarios.**

#### Alternative Flows
**Different ways to accomplish the same goal:**

**Example:**
```
UC-050: Open conversation

Main Flow: Click conversation from list

Alternative Flows:
- ALT-1: Use keyboard shortcut (Ctrl+O)
- ALT-2: Click from "Recent" quick access
- ALT-3: Search for conversation, click from results
- ALT-4: Open from notification (if mentioned in notification)
- ALT-5: Deep link from external source
```

#### Error Flows
**What can go wrong and how is it handled?**

**Validation Errors:**
```
UC-055: Send message

Error Flow: Empty message
1. User clicks "Send" with empty input
2. Input field shows red border
3. Error message below: "Message cannot be empty"
4. Send button shakes briefly (visual feedback)
5. Input field gains focus
```

**Network Errors:**
```
UC-055: Send message

Error Flow: API unavailable
1. User clicks "Send"
2. Button shows spinner
3. API call times out
4. Message appears with "Failed to send" status
5. Toast notification: "Could not connect to API. Check your connection."
6. Message shows "Retry" button
7. User clicks "Retry" → attempt send again
```

**Constraint Violations:**
```
UC-056: Upload file

Error Flow: File too large
1. User selects file > 10MB
2. Dialog shows error: "File must be under 10MB"
3. File not uploaded
4. User sees current size: "Your file: 15.2 MB. Maximum: 10 MB."
5. Suggestion: "Try compressing the file first"
```

**Conflict Errors:**
```
UC-060: Edit conversation

Error Flow: Concurrent edit
1. User A and User B open same conversation
2. User A edits title, saves
3. User B edits title, tries to save
4. System detects conflict
5. Dialog: "This conversation was modified by [User A]. Reload to see changes?"
6. Options: "Reload", "Overwrite" (with warning)
```

**For each alternative/error flow, document:**

```markdown
### UC-XXX Alternative Flows

**ALT-1: [Alternative method]**
- **Trigger**: [How user initiates]
- **Flow**: [Steps]
- **UI Difference**: [How UI differs from main flow]

### UC-XXX Error Flows

**ERR-1: [Error scenario]**
- **Cause**: [What causes this error]
- **Detection**: [When error is detected]
- **User Experience**:
  1. [What user sees]
  2. [Error message/indication]
  3. [Recovery options offered]
- **Resolution**: [How user recovers]
- **Fallback**: [If recovery fails]
```

**Progressive questioning:**
- "What other ways can user accomplish this?"
- "What can go wrong at each step?"
- "How is user notified of errors?"
- "What can user do to recover?"
- "What if recovery fails?"

---

## ✅ Quality Gate: Phase 3 Complete

**Before proceeding to Phase 4, verify:**

1. **Use Case Coverage** (Required):
   - [ ] Explicit use cases: >= 3 discovered (minimum viable coverage)
   - [ ] Implicit use cases: >= 2 discovered per explicit use case (setup, errors, CRUD, lifecycle)
   - [ ] Cascading use cases: >= 1 cascade chain mapped per major explicit use case
   - [ ] UI patterns: All explicit use cases have 6-layer UI interaction patterns documented

2. **Completeness Verification** (Required):
   - [ ] Every explicit use case has related implicit use cases (setup/config, error handling)
   - [ ] Major data entities have CRUD operations identified
   - [ ] Alternative flows documented for primary use cases (>= 1 alternative per main flow)
   - [ ] Error flows documented (validation, network, constraints)

3. **Confidence Assessment**:
   - Rate coverage completeness: LOW (< 50%) | MEDIUM (50-80%) | HIGH (> 80%)
   - If confidence < 50%: **ITERATE** - Return to discovery, re-examine epic for missed patterns

**Iteration Decision:**
```
IF (explicit_use_case_count < 3 OR
    implicit_use_case_count / explicit_use_case_count < 2 OR
    confidence < 50%):
  iteration_count++
  IF iteration_count <= 3:
    RETURN TO appropriate directive with focus questions:

    Low explicit count → Directive 2:
    - "What actions/features are described that weren't captured?"
    - "What workflows are hinted at but not explicitly stated?"

    Low implicit count → Directive 3:
    - "For each explicit use case, what setup is missing?"
    - "What error scenarios weren't considered?"
    - "What lifecycle management was overlooked?"

    Low cascade count → Directive 4:
    - "When use case X completes, what must happen next?"
    - "What side effects were missed?"

    Missing UI patterns → Directive 5:
    - "What UI states weren't documented?"
    - "What user feedback is missing?"
  ELSE:
    PROCEED WITH CAUTION - Note gaps in final documentation
ELSE:
  PROCEED TO Phase 4
```

**Knowledge Building:**
- Document use case count statistics
- Record confidence levels for each category
- Note any areas needing clarification

**State Update:**
```
knowledge_confidence_score = (
  (explicit_use_case_count >= 3 ? 0.25 : 0) +
  (implicit_use_case_count / explicit_use_case_count >= 2 ? 0.25 : 0) +
  (cascading_use_case_count >= explicit_use_case_count ? 0.25 : 0) +
  (ui_pattern_count >= explicit_use_case_count ? 0.25 : 0)
) * 100
```

---

## Phase 4: Use Case Synthesis

Now synthesize discoveries to reveal relationships and create comprehensive documentation.

---

### Directive 7: Map Use Case Relationships

**Show how use cases relate to each other.**

#### Prerequisite Relationships
**Use case A must complete before use case B can execute:**

```markdown
### Prerequisites Map

UC-005: Configure API Key
  ├─ PREREQUISITE FOR → UC-010: Send message
  ├─ PREREQUISITE FOR → UC-015: Test connection
  └─ PREREQUISITE FOR → UC-020: Use chat feature

UC-010: Create conversation
  └─ PREREQUISITE FOR → UC-011: Send message in conversation
```

#### Sequence Relationships
**Common workflow chains:**

```markdown
### Typical Sequences

**Sequence 1: First-Time User**
1. UC-001: Launch application
2. UC-002: Complete onboarding wizard
3. UC-003: Configure API key
4. UC-004: Create first conversation
5. UC-005: Send first message
6. UC-006: View response

**Sequence 2: Returning User**
1. UC-007: Open application
2. UC-008: View conversation list
3. UC-009: Open recent conversation
4. UC-010: Continue conversation

**Sequence 3: Power User**
1. UC-011: Use keyboard shortcut to create conversation
2. UC-012: Type message
3. UC-013: Press Enter to send
4. UC-014: Continue without mouse interaction
```

#### Dependency Relationships
**Use case A depends on data/state from use case B:**

```markdown
### Dependencies

UC-020: View conversation history
  ├─ DEPENDS ON DATA FROM → UC-021: Send message (creates history)
  └─ DEPENDS ON STATE → UC-022: User is authenticated

UC-025: Export conversation
  └─ DEPENDS ON DATA FROM → UC-020: Conversation history must exist
```

#### Alternative Relationships
**Use cases that accomplish similar goals:**

```markdown
### Alternatives

**Goal: Start new conversation**
- UC-030: Click "New Conversation" button (main flow)
- UC-031: Use Ctrl+N keyboard shortcut (alternative)
- UC-032: Click "New" in menu (alternative)
- UC-033: Say "Start new conversation" (voice, alternative)
```

**Document in comprehensive relationship map:**

```markdown
## Use Case Relationship Map

### Prerequisites
[List prerequisite relationships]

### Sequences
[List common sequences]

### Dependencies
[List data/state dependencies]

### Alternatives
[List alternative paths to same goal]

### Cascade Chains
[Reference cascade chains from Directive 4]
```

---

### Directive 8: Generate UI Flow Diagrams

**Create visual representations of UI flows and system architecture using diagrams.**

**Diagram Format Guidelines:**
- **UI State Transitions**: Use ASCII box diagrams (shows actual UI appearance)
- **Architecture & Data**: Use Mermaid syntax (modern standard, GitHub/VSCode native support)
- **Workflows & Logic**: Use Mermaid flowcharts (clearer than ASCII for complex flows)

**Why Mermaid for Most Diagrams:**
- ✅ LLMs generate Mermaid syntax consistently and accurately
- ✅ Native rendering in GitHub, GitLab, VSCode (no special tools needed)
- ✅ Version-controlled as code (clean diffs, easy maintenance)
- ✅ Token-efficient (~50-75% fewer tokens than ASCII)
- ✅ Export to SVG/PNG for presentations
- ✅ Industry standard in 2025 for AI-generated diagrams

**Rendering Mermaid:**
- **GitHub/GitLab**: Automatic rendering in markdown files
- **VSCode**: Install "Mermaid Preview" extension
- **Live editing**: https://mermaid.live (online editor)
- **Export**: SVG, PNG formats for documentation

---

#### Format: State Transition Diagrams (ASCII)

```markdown
## UI Flow: Send Message

┌─────────────────────────────────────────────────────────────┐
│ Chat Interface                                              │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Conversation History                                    ││
│ │ [Previous messages displayed...]                        ││
│ │                                                         ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ [Type your message...]                          [ Send ]││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           │ User types message
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Chat Interface (with text)                                  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Conversation History                                    ││
│ │ [Previous messages displayed...]                        ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Hello, how are you?                         [ Send ]||||││  ← Button enabled
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           │ User clicks Send
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Chat Interface (sending)                                    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Conversation History                                    ││
│ │ [Previous messages...]                                  ││
│ │                                                         ││
│ │ You: Hello, how are you?          [⏳ Sending...]      ││  ← Loading state
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ [Type your message...]                          [Send]||||││  ← Disabled
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           │ API responds
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Chat Interface (response received)                          │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Conversation History                                    ││
│ │ [Previous messages...]                                  ││
│ │                                                         ││
│ │ You: Hello, how are you?                                ││
│ │                                                         ││
│ │ Assistant: Hello! I'm doing well, thank you...          ││  ← New message
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ [Type your message...]                          [ Send ]││  ← Re-enabled
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ [Toast: "Message sent" ✓]                                  │  ← Notification
└─────────────────────────────────────────────────────────────┘
```

#### Format: Decision Trees

```markdown
## Decision Flow: Error Handling

User clicks "Send"
    │
    ├─ Message empty?
    │   │
    │   └─ YES → Show inline error
    │            → Shake send button
    │            → Keep input focused
    │            → END (no API call)
    │
    └─ NO → Disable input
         → Show loading spinner
         → Call API
             │
             ├─ API succeeds?
             │   │
             │   └─ YES → Show message in history
             │            → Show success toast
             │            → Clear input
             │            → Re-enable input
             │            → END
             │
             └─ NO → Show error on message
                  → Show retry button
                  → Show error toast
                  → Re-enable input
                  → Keep message in input
                  → END
```

#### Format: Sequence Diagrams

```markdown
## Sequence: User Login

User           UI          API         Database
  │              │           │             │
  │─────────────>│           │             │
  │ Click "Login"│           │             │
  │              │           │             │
  │<─────────────│           │             │
  │ Show login   │           │             │
  │ modal        │           │             │
  │              │           │             │
  │──────────────>│          │             │
  │ Enter email  │           │             │
  │ & password   │           │             │
  │              │           │             │
  │<─────────────│           │             │
  │ Enable       │           │             │
  │ submit btn   │           │             │
  │              │           │             │
  │──────────────>│          │             │
  │ Click submit │           │             │
  │              │           │             │
  │<─────────────│           │             │
  │ Show spinner │           │             │
  │              │           │             │
  │              │──────────>│             │
  │              │ POST      │             │
  │              │ /login    │             │
  │              │           │             │
  │              │           │─────────────>│
  │              │           │ Verify      │
  │              │           │ credentials │
  │              │           │             │
  │              │           │<────────────│
  │              │           │ Return user │
  │              │           │             │
  │              │<──────────│             │
  │              │ 200 OK    │             │
  │              │ + token   │             │
  │              │           │             │
  │<─────────────│           │             │
  │ Close modal  │           │             │
  │ Show welcome │           │             │
  │ Navigate to  │           │             │
  │ dashboard    │           │             │
```

**Create diagrams for:**
- Primary workflows (State Transition, Sequence, Activity)
- Complex interactions (Sequence, Activity)
- Error handling flows (Decision Tree, Activity)
- State transitions (State Transition)
- Multi-step sequences (Sequence, Activity)
- System architecture (Component)
- Data models (Entity Relationship)
- Technology stack (Component)

**Diagram Selection Guide:**
- **State Transition**: UI states and screen flows
- **Decision Tree**: Conditional logic and branching
- **Sequence**: Multi-actor interactions and timing
- **Component**: System architecture and dependencies
- **Entity Relationship**: Data models and schema
- **Activity**: Complex workflows with loops and branches

---

#### Format: Component Diagrams (Mermaid)

**For system architecture and component relationships using Mermaid syntax:**

**Basic Structure:**
````mermaid
graph TB
    subgraph System["[System Name]"]
        UI["UI Component<br/>(Frontend)"]
        API["API Component<br/>(Backend)"]
        State["State Manager"]
        Logic["Business Logic"]
        Data["Data Layer"]

        UI -->|HTTP/WS| API
        UI --> State
        API --> Logic
        Logic --> Data
    end

    Data --> External["External Services<br/>- API Service<br/>- Storage Service"]

    style System fill:#f9f9f9,stroke:#333,stroke-width:2px
````

**Example: Google Sheets Add-on Architecture**
````mermaid
graph TB
    subgraph Addon["Google Sheets Add-on"]
        Sidebar["Sidebar<br/>(HTML/CSS)"]
        Menu["Menu System<br/>(GAS Code)"]
        Server["Server Functions<br/>(Code.gs)"]

        Sidebar -.->|google.script.run| Server
        Menu -.->|google.script.run| Server

        Server --> Sheets["Sheets Service"]
        Server --> Props["Properties Service"]
        Server --> HTTP["HTTP Service"]
    end

    Sheets --> SheetData["Sheet Data"]
    Props --> Settings["Settings"]
    HTTP --> Claude["Claude API"]

    style Addon fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
````

**Rendering:**
- GitHub/GitLab: Native support (displays automatically)
- VSCode: Install Mermaid Preview extension
- Documentation: Use Mermaid Live Editor (https://mermaid.live)
- Export: SVG, PNG for presentations

**Use component diagrams for:**
- Overall system architecture
- Integration points between systems
- Service layer organization
- Module dependencies
- Technology stack visualization

**Alternative styles:**
- `graph TD` - Top to bottom
- `graph LR` - Left to right
- C4 diagrams - Use `C4Context`, `C4Container`, `C4Component`

---

#### Format: Entity Relationship Diagrams (Mermaid)

**For data models and entity relationships using Mermaid ER syntax:**

**Basic Structure:**
````mermaid
erDiagram
    ENTITY1 ||--o{ ENTITY2 : "relationship"
    ENTITY1 {
        int id PK "Primary Key"
        string name
        datetime created_at
        datetime updated_at
    }
    ENTITY2 {
        int id PK
        int entity1_id FK "Foreign Key"
        string field1
        string field2
    }
````

**Example: Conversation System**
````mermaid
erDiagram
    USER ||--o{ CONVERSATION : creates
    CONVERSATION ||--o{ MESSAGE : contains

    USER {
        uuid userId PK
        string email "Unique"
        string displayName
        json preferences
    }

    CONVERSATION {
        uuid conversationId PK
        uuid userId FK
        string title
        datetime created_at
        string model "Claude model version"
    }

    MESSAGE {
        uuid messageId PK
        uuid conversationId FK
        string role "user, assistant, system"
        text content
        datetime timestamp
        int tokens
    }
````

**Relationship Cardinality:**
- `||--||` : One to exactly one
- `||--o{` : One to zero or more
- `||--|{` : One to one or more
- `}o--o{` : Zero or more to zero or more
- `}|--|{` : One or more to one or more

**Rendering:**
- GitHub/GitLab: Native support (displays automatically)
- VSCode: Mermaid Preview extension
- Documentation: Mermaid Live Editor (https://mermaid.live)

**Use ER diagrams for:**
- Database schema design
- Data relationships and cardinality
- Storage requirements planning
- Primary/Foreign key constraints
- Data model documentation

---

#### Format: Activity Diagrams (Mermaid Flowcharts)

**For complex workflows with multiple paths and conditions using Mermaid flowchart syntax:**

**Basic Structure:**
````mermaid
flowchart TD
    Start([Start]) --> Action1[Action 1]
    Action1 --> Decision{Condition?}
    Decision -->|Yes| Action2A[Action 2A]
    Decision -->|No| Action2B[Action 2B]
    Action2A --> Action3[Action 3]
    Action2B --> Action3
    Action3 --> Decision2{Another condition?}
    Decision2 -->|Yes| Action4[Action 4]
    Decision2 -->|No| End([End])
    Action4 --> End
````

**Example: Send Message to Claude API**
````mermaid
flowchart TD
    Start([User clicks Send]) --> Validate[Validate input]
    Validate --> ValidCheck{Valid?}

    ValidCheck -->|No| ShowError1[Show error msg]
    ShowError1 --> End([End])

    ValidCheck -->|Yes| GetKey[Get API key]
    GetKey --> KeyCheck{Key exists?}

    KeyCheck -->|No| ShowError2[Show error msg]
    ShowError2 --> End

    KeyCheck -->|Yes| ShowLoad[Show loading]
    ShowLoad --> CallAPI[Call Claude API]
    CallAPI --> APICheck{Success?}

    APICheck -->|No| ShowError3[Show error msg]
    ShowError3 --> End

    APICheck -->|Yes| DisplayResp[Display response]
    DisplayResp --> End

    style Start fill:#e8f5e9
    style End fill:#ffebee
    style ShowError1 fill:#ffcdd2
    style ShowError2 fill:#ffcdd2
    style ShowError3 fill:#ffcdd2
    style DisplayResp fill:#c8e6c9
````

**Advanced Patterns:**

**Parallel Activities:**
````mermaid
flowchart TD
    Start([Start]) --> Split[/Parallel split\]
    Split --> Task1[Task 1]
    Split --> Task2[Task 2]
    Split --> Task3[Task 3]
    Task1 --> Join[\Parallel join/]
    Task2 --> Join
    Task3 --> Join
    Join --> Continue[Continue]
````

**Loops:**
````mermaid
flowchart TD
    Start([Start]) --> Init[Initialize]
    Init --> Check{More items?}
    Check -->|Yes| Process[Process item]
    Process --> Check
    Check -->|No| Done([Done])
````

**Rendering:**
- GitHub/GitLab: Native support (displays automatically)
- VSCode: Mermaid Preview extension
- Documentation: Mermaid Live Editor (https://mermaid.live)

**Use activity diagrams (flowcharts) for:**
- Complex business processes
- Multi-step workflows with branches
- Error handling paths
- Parallel activities
- Loop and iteration flows
- Decision trees with multiple outcomes

---

### Directive 9: Document Interaction Sequences

**For key workflows, provide detailed step-by-step breakdowns.**

```markdown
## Detailed Sequence: UC-XXX [Use Case Name]

### Context
- **Starting Point**: [Where user starts]
- **User Goal**: [What they want to accomplish]
- **Typical Duration**: [Estimated time]

### Step-by-Step Interaction

**Step 1: [Action name]**
- **User Action**: [What user does]
- **System Response**:
  * UI shows: [What appears/changes]
  * State changes: [What state updates]
  * Data: [What data is affected]
- **Feedback**:
  * Visual: [Visual changes]
  * Audio: [Sound effects if any]
  * Haptic: [Vibration if applicable]
- **Available Actions**: [What user can do next]
- **Error Cases**: [What could go wrong]

**Step 2: [Action name]**
- **Prerequisite**: [What must be true from Step 1]
- **User Action**: [What user does]
- **System Response**:
  * UI shows: [Changes]
  * API calls: [If any]
  * Loading state: [How shown]
- **Timing**: [How long this takes]
- **Feedback**: [User confirmation]
- **Error Cases**: [Potential failures]

**Step 3: [Action name]**
[Continue pattern...]

### Completion
- **Success Indicator**: [How user knows it worked]
- **Final State**: [Where user ends up]
- **Typical Next Action**: [What comes next]

### Example Walkthrough
[Concrete example with actual data/text]
```

**Pattern Discovery Approach:**

For each discovered multi-step use case, ask runtime questions to build detailed sequence:

**Discovery Questions:**
- What screen does user start on?
- How do they navigate to this workflow?
- What is the step-by-step flow?
- What validation happens at each step?
- What feedback is provided at each step?
- What can go wrong at each step?
- How long does each step typically take?
- What keyboard shortcuts are available?
- How is success confirmed?
- What does user typically do next?

**Key Elements to Capture:**
- **Context**: Starting point, user goal, typical duration
- **Each Step**: User action, system response, feedback, timing, error cases
- **Completion**: Success indicators, final state, typical next action
- **Example Walkthrough**: Concrete scenario with actual data/text

**See Appendix A for complete template with detailed step structure.**

**Document detailed sequences for:**
- Setup/onboarding workflows
- Primary use cases (top 5-10)
- Complex multi-step interactions
- Error recovery flows
- First-time user experiences

---

## ✅ Quality Gate: Phase 4 Complete

**Before proceeding to Phase 5, verify:**

1. **Synthesis Completeness** (Required):
   - [ ] Use case relationship map created (prerequisites, sequences, dependencies, alternatives)
   - [ ] UI flow diagrams generated for primary workflows (>= 3 major flows visualized)
   - [ ] Detailed interaction sequences documented for key use cases (>= 5 top use cases)
   - [ ] All discovered use cases have relationship mappings (no orphaned use cases)

2. **Documentation Quality** (Required):
   - [ ] Relationship maps are clear and traceable (prerequisites → dependencies → sequences)
   - [ ] UI flow diagrams accurately represent user interactions (state transitions visible)
   - [ ] Detailed sequences include all interaction layers (navigation, feedback, state, data)
   - [ ] Cascade chains from Phase 3 are properly referenced in relationship maps

3. **Readiness for Story Generation** (Required):
   - [ ] Sufficient detail captured for implementation (developers can start building)
   - [ ] UI patterns are comprehensive (6 layers documented for primary use cases)
   - [ ] Error flows and alternative paths documented (>= 1 per major use case)
   - [ ] Confidence in synthesis: LOW (< 50%) | MEDIUM (50-80%) | HIGH (> 80%)

**Iteration Decision:**
```
IF (relationship_maps_incomplete OR
    ui_flow_diagram_count < 3 OR
    detailed_sequence_count < 5 OR
    confidence < 50%):
  iteration_count++
  IF iteration_count <= 3:
    RETURN TO appropriate directive with focus questions:

    Incomplete relationships → Directive 7:
    - "What prerequisite relationships were missed?"
    - "What workflow sequences weren't documented?"
    - "Which use cases depend on data from other use cases?"
    - "What alternative paths to the same goal exist?"

    Missing UI flows → Directive 8:
    - "What primary workflows need visual representation?"
    - "What complex interactions require state transition diagrams?"
    - "What error handling flows need decision tree diagrams?"
    - "What multi-actor interactions need sequence diagrams?"

    Insufficient sequences → Directive 9:
    - "Which key workflows need step-by-step breakdown?"
    - "What setup/configuration flows are missing details?"
    - "What multi-step interactions lack timing information?"
    - "What error recovery flows need detailed documentation?"

    Low detail for implementation → Directives 7-9:
    - "What information would developers need to build this?"
    - "What UI interaction details are vague or incomplete?"
    - "What error cases lack clear handling instructions?"
    - "What state management details are missing?"
  ELSE:
    PROCEED WITH CAUTION - Note gaps in final documentation
ELSE:
  PROCEED TO Phase 5
```

**Knowledge Building:**
- Document synthesis completeness metrics
- Record confidence level for implementation readiness
- Note any areas requiring clarification during implementation
- Identify complex areas that may need additional research

**State Update:**
```
synthesis_completeness_score = (
  (relationship_map_complete ? 0.25 : 0) +
  (ui_flow_diagram_count >= 3 ? 0.25 : 0) +
  (detailed_sequence_count >= 5 ? 0.25 : 0) +
  (implementation_readiness >= MEDIUM ? 0.25 : 0)
) * 100

knowledge_confidence_score = (
  knowledge_confidence_score * 0.7 +
  synthesis_completeness_score * 0.3
)
```

---

## Phase 5: Epic & Story Generation

### Step 1: Determine Output Mode

**Auto-detect appropriate output verbosity based on project size:**

```javascript
// Count total use cases discovered
total_use_cases = explicit_use_case_count + implicit_use_case_count + cascading_use_case_count

// Determine output mode
IF "--concise" flag present:
  output_mode = "condensed"
ELSE IF "--verbose" flag present:
  output_mode = "full"
ELSE IF total_use_cases > 50:
  output_mode = "condensed"
  ANNOUNCE: "📊 Large project detected (${total_use_cases} use cases). Using condensed output mode."
ELSE IF total_use_cases > 20:
  output_mode = "standard"
  ANNOUNCE: "📊 Medium project detected (${total_use_cases} use cases). Using standard output mode."
ELSE:
  output_mode = "full"
  ANNOUNCE: "📊 Project size: ${total_use_cases} use cases. Using full detailed output mode."
```

**Output Mode Definitions:**

- **full**: Complete documentation for all epics and stories with full templates
  - Executive summary
  - All epics with full descriptions
  - All stories with complete details (AC, tasks, tests, UI patterns)
  - All appendices (use case mapping, UI patterns, diagrams, architecture)

- **standard**: Full details for Epic 1, summaries for remaining epics
  - Executive summary
  - Epic 1: Complete with all story details
  - Epics 2-N: Epic description + story list (titles and points only)
  - Key appendices only (use case mapping summary, critical diagrams)

- **condensed**: Epic summaries and story titles only
  - Executive summary with full statistics
  - Epic catalog: Epic descriptions with story titles and point totals
  - Story catalog: Story titles, user story statements, acceptance criteria (no tasks/tests)
  - Minimal appendices (use case count mapping only)

**State Update:**
```javascript
selected_output_mode = output_mode
```

---

### Step 2: Context Window Management

**For large projects, implement progressive chunking to prevent context overflow:**

```javascript
// Estimate output size
estimated_story_count = total_use_cases * 1.2  // ~1.2 stories per use case average
estimated_tokens_per_story = 800  // average with full template
estimated_total_tokens = estimated_story_count * estimated_tokens_per_story

// Determine if chunking needed
IF estimated_total_tokens > 80000:
  use_chunked_output = true
  epic_chunk_size = 1  // Process 1 epic at a time
  ANNOUNCE: "⚠️ Large output detected (~${estimated_total_tokens} tokens). Using chunked output."
ELSE IF estimated_total_tokens > 50000:
  use_chunked_output = true
  epic_chunk_size = 2  // Process 2 epics at a time
  ANNOUNCE: "📝 Using chunked output for better readability (${epic_chunk_size} epics per chunk)."
ELSE:
  use_chunked_output = false
```

**Chunked Output Protocol:**

When `use_chunked_output = true`:

1. **Generate Executive Summary First** (always complete, never chunked)
   - Include all statistics
   - List all epics with point totals
   - Show MVP scope summary

2. **Generate Epics in Chunks**:
   ```
   For each chunk (size = epic_chunk_size):
     OUTPUT: "---"
     OUTPUT: "## 📦 Generating Chunk [current]/[total] - Epics [X] to [Y]"
     OUTPUT: "---"

     For each epic in chunk:
       Generate complete epic documentation per selected_output_mode

     OUTPUT: "✅ Chunk [current]/[total] complete"
     OUTPUT: ""
   ```

3. **Generate Sprint Plan After All Chunks** (always complete)

4. **Generate Appendices Last** (may be chunked if > 30K tokens)
   - Appendix A: Use Case Mapping
   - Appendix B: UI Patterns (if output_mode = "full")
   - Appendix C: Flow Diagrams
   - Appendix D: Architecture

**Cross-Chunk References:**

When referencing content from previous chunks:
- Use format: "See Epic [N] (Chunk [X]) for details"
- Maintain epic numbering across chunks (E-1, E-2, E-3...)
- Keep story IDs sequential (S-001, S-002, S-003...)

**State Update:**
```javascript
chunking_enabled = use_chunked_output
epic_chunk_size = epic_chunk_size
```

---

### Directive 10: Generate Multi-Epic Project Structure

**Transform discovered use cases into structured Epics and Stories for implementation.**

**Goal**: Generate 3-6 Epics, each containing 10-30 Stories, targeting 50-100 total stories with comprehensive coverage.

---

## Epic Organization Patterns

**Choose organization approach based on project nature:**

### Pattern 1: Feature-Based Epics
Group by major feature areas or system capabilities.

**Example Structure:**
- Epic 1: Core Functionality (15-20 stories)
- Epic 2: User Experience & Onboarding (10-15 stories)
- Epic 3: Data Management (10-15 stories)
- Epic 4: Advanced Features (10-20 stories)
- Epic 5: Performance & Reliability (8-12 stories)
- Epic 6: Admin & Monitoring (5-10 stories)

### Pattern 2: User Journey Epics
Group by user workflows and experiences.

**Example Structure:**
- Epic 1: First-Time User Journey (12-18 stories)
- Epic 2: Daily Usage Workflows (15-25 stories)
- Epic 3: Power User Features (10-15 stories)
- Epic 4: Administration & Management (8-12 stories)
- Epic 5: Error Recovery & Support (10-15 stories)

### Pattern 3: Technical Layer Epics
Group by architectural layers or system components.

**Example Structure:**
- Epic 1: User Interface Layer (15-20 stories)
- Epic 2: Business Logic Layer (12-18 stories)
- Epic 3: Data & Storage Layer (10-15 stories)
- Epic 4: Integration Layer (8-12 stories)
- Epic 5: Infrastructure & DevOps (8-12 stories)

**Select the pattern that best fits the discovered use cases.**

---

## Story Generation Process

**For each discovered use case, generate 1-3 stories:**

1. **Explicit use cases** → Primary stories (1:1 mapping typically)
2. **Implicit use cases** → Supporting stories (group related ones)
3. **Cascading use cases** → Often combined into primary story tasks
4. **UI patterns** → Become story details and acceptance criteria
5. **Error flows** → Separate error handling stories or acceptance criteria

---

## Story Template

```markdown
## Story S-XXX: [Story Title]

**Epic**: E-X: [Epic Name]
**Type**: Feature | Enhancement | Bug Fix | Technical | Documentation
**Priority**: P0 (Must Have - MVP) | P1 (Should Have - Phase 2) | P2 (Could Have - Future)
**Story Points**: 1-13 (Fibonacci: 1, 2, 3, 5, 8, 13)
**Dependencies**: S-YYY, S-ZZZ (other story IDs)

### User Story
**As a** [actor/role]
**I want to** [action/capability]
**So that** [business value/outcome]

### Acceptance Criteria
- [ ] [Testable criterion 1]
- [ ] [Testable criterion 2]
- [ ] [Testable criterion 3]
- [ ] [Error handling: specific error scenario]
- [ ] [UI/UX: specific interaction requirement]

### Related Use Cases
- UC-XXX: [Use case name] (primary)
- UC-YYY: [Use case name] (implicit/related)
- UC-ZZZ: [Use case name] (error flow)

### Technical Notes
- [Implementation guidance]
- [API endpoints or services needed]
- [Data storage requirements]
- [Platform constraints]

### UI/UX Summary
- **Starting Point**: [Where user begins]
- **Key Interactions**: [Primary user actions]
- **States**: Loading, Empty, Error, Success
- **Notifications**: [What feedback is shown]
- **Full Pattern**: See Appendix UC-XXX for complete 6-layer pattern

### Implementation Tasks
- [ ] Task 1: [Specific implementation step]
- [ ] Task 2: [Another step]
- [ ] Task 3: [Testing/validation step]

### Test Scenarios
```javascript
// Test: [Scenario name]
test('[description]', () => {
  // Given: [precondition]
  // When: [action]
  // Then: [expected result]
});
```

### Definition of Done
- [ ] Code implemented and peer reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] UI matches design specifications
- [ ] Error handling implemented
- [ ] Documentation updated
- [ ] Deployed to staging and verified
```

---

## Output Structure

### 1. Executive Summary

```markdown
# Project: [Project Name from Epic]

**Source**: [File path or inline epic text]
**Analysis Date**: [Date]
**Total Stories Generated**: [count]
**Total Story Points**: [sum]
**Estimated Sprints**: [points / team velocity]

## Discovery Statistics
- **Explicit Use Cases**: [count]
- **Implicit Use Cases**: [count]
- **Cascading Use Cases**: [count]
- **Total Use Cases Discovered**: [total]
- **UI Patterns Documented**: [count]
- **Stories Generated**: [count]
- **Epics Created**: [count]

## Epic Overview
1. **E-1: [Epic Name]** - [count] stories, [points] points
2. **E-2: [Epic Name]** - [count] stories, [points] points
3. **E-3: [Epic Name]** - [count] stories, [points] points
[... continue for all epics]

## MVP Scope (Sprint 1-2)
- [X] stories with P0 priority
- [Y] story points total
- Key deliverables: [list]

## Phase 2 Scope (Sprint 3-4)
- [X] stories with P1 priority
- [Y] story points total

## Future Backlog
- [X] stories with P2 priority
```

---

### 2. Epic Catalog

**For each Epic, provide:**

```markdown
# Epic E-X: [Epic Name]

## Epic Description
[2-3 sentence description of what this epic encompasses]

## Business Value
[Why this epic matters, what value it delivers]

## Epic Acceptance Criteria
- [ ] [High-level deliverable 1]
- [ ] [High-level deliverable 2]
- [ ] [High-level deliverable 3]

## Actors Involved
- **Primary**: [Main users of this epic's features]
- **Secondary**: [Other stakeholders]

## Stories in This Epic
### MVP Stories (P0)
1. S-001: [Story title] - [points]pt
2. S-002: [Story title] - [points]pt
[... continue]

### Phase 2 Stories (P1)
1. S-020: [Story title] - [points]pt
[... continue]

### Future Stories (P2)
1. S-050: [Story title] - [points]pt
[... continue]

## Dependencies
- **Depends On**: E-Y (Epic Y must be completed first)
- **Blocks**: E-Z (Epic Z cannot start until this completes)

## Technical Architecture
- [Key technologies or services]
- [Integration points]
- [Data storage approach]

## Risks & Mitigation
- **Risk**: [Description]
  * **Mitigation**: [Approach]

**Total Stories**: [count]
**Total Story Points**: [sum]
**Estimated Duration**: [sprints]
```

---

### 3. Story Catalog (Grouped by Epic)

**For each story, use the Story Template above.**

**Organization:**

```markdown
# Stories

## Epic E-1: [Epic Name]

### MVP Stories (P0 Priority)

#### Story S-001: [Story Title]
[Full story details using template]

#### Story S-002: [Story Title]
[Full story details using template]

[... continue for all MVP stories in this epic]

### Phase 2 Stories (P1 Priority)

#### Story S-020: [Story Title]
[Full story details using template]

[... continue]

### Future Stories (P2 Priority)

#### Story S-050: [Story Title]
[Full story details using template]

[... continue]

---

## Epic E-2: [Epic Name]

[... repeat structure for each epic]
```

---

### 4. Sprint Planning Guide

```markdown
# Sprint Planning

## Recommended Sprint Structure

### Sprint 1 (MVP - Part 1)
**Goal**: [Primary deliverable]
**Stories**: S-001, S-002, S-003, S-004
**Total Points**: [sum]
**Key Deliverables**:
- [Deliverable 1]
- [Deliverable 2]

**Dependencies**: None (start here)

### Sprint 2 (MVP - Part 2)
**Goal**: [Primary deliverable]
**Stories**: S-005, S-006, S-007, S-008
**Total Points**: [sum]
**Key Deliverables**:
- [Deliverable 1]

**Dependencies**: Sprint 1 must complete S-001, S-002

[... continue for suggested sprint breakdown]

## Velocity Planning
- **Assumed Team Velocity**: 20-30 points/sprint
- **MVP Completion**: [X] sprints
- **Phase 2 Completion**: [Y] additional sprints
- **Total Project**: [Z] sprints

## Critical Path
1. S-001 (Configure API) → BLOCKS → S-005 (Send Message)
2. S-005 (Send Message) → BLOCKS → S-010 (View History)
[... show dependency chains]
```

---

### 5. Appendix: Use Case → Story Mapping

```markdown
# Use Case to Story Traceability

## Explicit Use Cases

### UC-001: [Use Case Name]
**Mapped to Stories**:
- S-005: [Story title] (primary implementation)
- S-006: [Story title] (error handling)
- S-007: [Story title] (UI polish)

**Coverage**: ✅ Fully covered

### UC-002: [Use Case Name]
**Mapped to Stories**:
- S-010: [Story title]

**Coverage**: ✅ Fully covered

[... continue for all use cases]

## Implicit Use Cases

### UC-050: [Implicit Use Case Name]
**Mapped to Stories**:
- S-002: [Story title] (setup/configuration)

**Derivation**: [Why this was needed]
**Coverage**: ✅ Fully covered

[... continue]

## Cascading Use Cases

### Cascade Chain: [Chain Name]
**Mapped to Stories**:
- S-005: [Story title] (includes entire cascade as tasks)

**Coverage**: ✅ Included in primary story tasks

[... continue]

## Coverage Analysis
- **Total Use Cases**: [count]
- **Use Cases with Stories**: [count]
- **Coverage Percentage**: [%]
- **Uncovered Use Cases**: [list any gaps]
```

---

### 6. Appendix: Detailed UI Interaction Patterns

**Move all 6-layer UI patterns here for reference.**

```markdown
# UI Interaction Pattern Library

## UC-001: [Use Case Name] - Complete UI Pattern

### Layer 1: Interface Navigation
[Full details from Directive 5]

### Layer 2: Interaction Expectations
[Full details]

### Layer 3: Notifications & Feedback
[Full details]

### Layer 4: Data Display Expectations
[Full details]

### Layer 5: State Management
[Full details]

### Layer 6: Follow-on Sequences
[Full details]

**Referenced by Stories**: S-005, S-006, S-007

---

## UC-002: [Use Case Name] - Complete UI Pattern
[... repeat for each use case with UI pattern]
```

---

### 7. Appendix: Flow Diagrams

```markdown
# Visual Flow Diagrams

## Flow: [Workflow Name]
[ASCII diagrams from Directive 8]

**Related Stories**: S-005, S-010, S-015

---

## Flow: [Another Workflow]
[Diagrams]

[... continue]
```

---

### 8. Appendix: Technical Architecture

```markdown
# Technical Architecture

## System Components
- [Component 1]: [Description and role]
- [Component 2]: [Description and role]

## Data Storage
- **Primary Storage**: [Technology/service]
- **Conversation History**: [Approach]
- **Configuration**: [Where/how stored]

## External Integrations
- **Claude API**: [Usage details]
- **Google Sheets**: [Integration points]

## Platform Constraints
- **Google Apps Script**: [Specific limitations]
- **Storage Limits**: [PropertiesService 500KB]
- **Execution Timeouts**: [6 minutes]

## Security Considerations
- API key storage and protection
- Input validation approach
- XSS prevention

## Performance Targets
- Message send: < 2 seconds
- Sidebar load: < 1 second
- History load: < 0.5 seconds
```

---

## Story Generation Guidelines

### How Many Stories to Generate

**Target Story Distribution:**
- **MVP (P0)**: 30-40% of total (15-40 stories)
- **Phase 2 (P1)**: 40-50% of total (20-50 stories)
- **Future (P2)**: 10-20% of total (5-20 stories)

**Story Granularity:**
- **1 point**: Trivial (< 2 hours, simple config or UI tweak)
- **2 points**: Small (< 1 day, simple feature or bug fix)
- **3 points**: Medium (1-2 days, standard feature)
- **5 points**: Large (2-4 days, complex feature)
- **8 points**: Very Large (1 week, multi-component feature)
- **13 points**: Epic-sized (1-2 weeks, consider breaking down)

**When to Create Separate Stories:**
1. Each explicit use case → Typically 1 story (sometimes 2-3 if complex)
2. Group related implicit use cases → 1 story (e.g., all error handling for feature X)
3. Setup/configuration → 1-2 stories per major component
4. Error handling → Can be separate story or acceptance criteria
5. UI polish/UX improvements → Separate stories if significant
6. Performance optimization → Separate stories
7. Testing infrastructure → Separate stories if non-trivial

**When to Combine into One Story:**
- Cascading use cases (include as tasks in primary story)
- Tightly coupled UI states (loading, empty, error in one story)
- Related CRUD operations (if simple)
- Minor alternative flows

### Story Estimation Tips

Consider:
- **Complexity**: Technical difficulty
- **Uncertainty**: How well understood
- **Dependencies**: External dependencies add risk
- **Testing**: UI testing is often more time-consuming
- **Integration**: Multiple systems increase complexity

---

## Output Mode Handling

### If `--concise` flag present:
- Generate epics and stories only
- Omit discovery reasoning and use case details
- Include story acceptance criteria and tasks
- Skip appendices

### If `--output <path>` specified:
**Write separate files:**
- `summary.md` - Executive summary
- `epic-01-[name].md` - Each epic in separate file
- `epic-02-[name].md`
- `stories-mvp-p0.md` - All P0 stories
- `stories-phase2-p1.md` - All P1 stories
- `stories-future-p2.md` - All P2 stories
- `sprint-plan.md` - Sprint planning guide
- `appendix-use-case-mapping.md` - Traceability
- `appendix-ui-patterns.md` - Full UI patterns
- `appendix-flows.md` - Flow diagrams
- `appendix-architecture.md` - Technical details

### If stdout (default):
**Output comprehensive report with all sections in one document.**

---

## Quality Standards

### Epic Quality Checklist
- ✅ **Cohesive**: All stories relate to common theme
- ✅ **Valuable**: Clear business value articulated
- ✅ **Sized**: 8-30 stories (not too small, not too large)
- ✅ **Independent**: Minimal dependencies on other epics
- ✅ **Testable**: Epic acceptance criteria are verifiable

### Story Quality Checklist
- ✅ **INVEST Criteria**:
  * **Independent**: Can be developed separately
  * **Negotiable**: Details can be refined
  * **Valuable**: Delivers user/business value
  * **Estimable**: Team can estimate effort
  * **Small**: Fits in one sprint
  * **Testable**: Clear acceptance criteria
- ✅ **User-Centric**: Written from user perspective
- ✅ **Actionable**: Developer knows what to build
- ✅ **Complete**: Includes AC, tasks, tests, UI details
- ✅ **Traced**: Links back to use cases

### Coverage Checklist
- ✅ **All explicit use cases** mapped to stories
- ✅ **Critical implicit use cases** covered (setup, errors, lifecycle)
- ✅ **Major cascade chains** included in stories
- ✅ **UI patterns** referenced from stories
- ✅ **Error flows** addressed (as stories or AC)
- ✅ **MVP identified** (P0 stories are sufficient for launch)

---

## Execution Instructions

**Now generate the multi-epic project structure:**

1. **Analyze discovered use cases** from Phases 1-3
2. **Choose epic organization pattern** (feature, journey, or layer based)
3. **Create 3-6 epics** that logically group use cases
4. **Generate 50-100 stories** across all epics:
   - 1-3 stories per explicit use case
   - Group related implicit use cases
   - Include error handling, setup, lifecycle stories
5. **Prioritize stories** (P0 MVP, P1 Phase 2, P2 Future)
6. **Estimate story points** (Fibonacci: 1, 2, 3, 5, 8, 13)
7. **Define dependencies** between stories
8. **Create sprint plan** showing recommended sprint breakdown
9. **Generate traceability** mapping use cases → stories
10. **Move detailed UI patterns** to appendix for reference

**Output comprehensive epic and story catalog following the templates above.**

---

**1. Executive Summary**
```markdown
# Use Case Analysis Summary

**Source**: [File path or inline text]
**Analysis Date**: [Date]

## Discovery Statistics
- **Explicit Use Cases**: [count]
- **Implicit Use Cases**: [count] (derived)
- **Cascading Use Cases**: [count] (triggered/side-effect)
- **Total Use Cases**: [total]
- **UI Interaction Patterns Documented**: [count]
- **Alternative Flows**: [count]
- **Error Flows**: [count]

## Primary Actors
- [Actor 1]: [Role description]
- [Actor 2]: [Role description]

## Core Use Cases (Top 5)
1. UC-XXX: [Name]
2. UC-YYY: [Name]
3. UC-ZZZ: [Name]
4. UC-AAA: [Name]
5. UC-BBB: [Name]

## Platform
- **Type**: [Web/Mobile/Desktop/Embedded]
- **Primary Interface**: [Description]
- **Integration**: [External systems]

## Key Findings
- **Insight 1**: [Important discovery]
- **Insight 2**: [Important discovery]
- **Insight 3**: [Important discovery]
```

**2. Actors**
```markdown
# Actors

## Primary Actors

### [Actor Name]
- **Role**: [Description]
- **Goals**:
  * [Goal 1]
  * [Goal 2]
- **Interactions**: [UI, API, CLI, etc.]
- **Related Use Cases**: UC-XXX, UC-YYY, UC-ZZZ

[Repeat for each primary actor]

## Secondary Actors

### [Actor Name]
- **Role**: [Description]
- **Interactions**: [How they engage]
- **Related Use Cases**: UC-AAA, UC-BBB

[Repeat for each secondary actor]
```

**3. Use Case Catalog**

**3a. Explicit Use Cases** (directly stated in epic)
```markdown
# Explicit Use Cases

## UC-001: [Use Case Name]

**Type**: Explicit
**Priority**: High/Medium/Low
**Frequency**: [How often]

### Description
[Clear description of what this use case accomplishes]

### Actors
- **Primary**: [Actor name]
- **Secondary**: [Actor name if applicable]

### Preconditions
1. [Condition that must be true]
2. [Another condition]

### Trigger
[What initiates this use case]

### Main Flow
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [etc.]

### Postconditions
1. [What is true after success]
2. [State changes]

### Alternative Flows
- **ALT-1**: [Alternative method]
  * [Steps]

### Error Flows
- **ERR-1**: [Error scenario]
  * [Handling steps]

### UI Interaction Pattern
[Reference to UI pattern section or inline details]

**Source**: [Quote from epic]
**Confidence**: HIGH
```

**3b. Implicit Use Cases** (derived/unstated)
```markdown
# Implicit Use Cases

## UC-050: [Use Case Name] (IMPLICIT)

**Type**: Implicit
**Derived From**: UC-001 [Name of related explicit use case]
**Priority**: Medium/Low
**Derivation Reasoning**: [Why this is expected]

### Description
[What this use case accomplishes]

### Actors
- **Primary**: [Actor]

### Trigger
[What initiates]

### Main Flow
[Steps]

### UI Interaction Pattern
[Details]

**Confidence**: MEDIUM/LOW
**Reasoning**: [Derivation chain]

[Repeat for each implicit use case]
```

**3c. Cascading Use Cases**
```markdown
# Cascading Use Cases

## Cascade Chain: [Chain Name]

**Primary Use Case**: UC-XXX [Name]
**Cascade Type**: Sequential | Conditional | Parallel | Side Effect | Rollback

### Cascade Flow
1. UC-XXX: [Primary] completes successfully
   ↓ [automatically / if condition]
2. UC-YYY: [Secondary] executes
   ↓ [automatically / if condition]
3. UC-ZZZ: [Tertiary] executes

### Use Cases in Chain

#### UC-YYY: [Triggered Use Case]
[Brief description]
**Trigger**: Automatic upon UC-XXX completion
**Confidence**: HIGH/MEDIUM

#### UC-ZZZ: [Next Triggered Use Case]
[Brief description]
**Trigger**: Automatic upon UC-YYY completion
**Confidence**: MEDIUM/LOW

[Repeat for each cascade chain]
```

**4. UI Interaction Patterns**
```markdown
# UI Interaction Patterns

## Pattern: [Pattern Name]

**Related Use Cases**: UC-XXX, UC-YYY

### Navigation Flow
[Diagram or description]

### Interaction Behaviors
- **Click**: [Behavior]
- **Keyboard**: [Shortcuts]
- **Drag/Drop**: [If applicable]

### Notifications & Feedback
- **Success**: [How shown]
- **Error**: [How shown]
- **Progress**: [Indicators]

### Data Display
- **Format**: [How data appears]
- **Editable Fields**: [List]
- **Read-Only Fields**: [List]

### State Management
- **Loading**: [Design]
- **Empty**: [Design]
- **Error**: [Design]

### Follow-on Sequences
- **Typical Next**: [Common next action]
- **Suggested**: [System suggestions]

[Repeat for each distinct UI pattern]
```

**5. Use Case Relationships**
```markdown
# Use Case Relationships

## Prerequisites
[Map showing what must happen before what]

## Typical Sequences
### Sequence: [Workflow Name]
1. UC-XXX: [Use case]
2. UC-YYY: [Use case]
3. UC-ZZZ: [Use case]

## Dependencies
[Map showing data/state dependencies]

## Alternatives
**Goal**: [Common goal]
- UC-AAA: [Main path]
- UC-BBB: [Alternative path]
- UC-CCC: [Alternative path]
```

**6. UI Flow Diagrams**
```markdown
# UI Flow Diagrams

## Flow: [Workflow Name]

[ASCII diagram showing screens, transitions, decisions]

[Repeat for major workflows]
```

**7. Detailed Interaction Sequences**
```markdown
# Detailed Interaction Sequences

## Sequence: [Use Case Name]

[Step-by-step breakdown with UI details]

[Repeat for key use cases]
```

**8. Supporting Context** (minimal)
```markdown
# Supporting Context

## Data Entities (brief)
- **Entity Name**: [Brief description and role in use cases]
- **Entity Name**: [Brief description]

## Constraints Affecting Use Cases
- **Constraint**: [How it impacts use cases]
- **Constraint**: [How it impacts use cases]

## External Integrations
- **System**: [How it's used in use cases]
```

**9. Implementation Guidance**
```markdown
# Implementation Guidance

## Priority Ranking
### Must Have (MVP)
1. UC-XXX: [Use case] - [Why critical]
2. UC-YYY: [Use case] - [Why critical]

### Should Have (Phase 2)
1. UC-AAA: [Use case] - [Why important]
2. UC-BBB: [Use case] - [Why important]

### Could Have (Future)
1. UC-ZZZ: [Use case] - [Why nice-to-have]

## Technical Considerations
- [Consideration 1]
- [Consideration 2]

## UX Recommendations
- [Recommendation 1]
- [Recommendation 2]

## Risk Areas
- **Risk**: [Description]
  * **Mitigation**: [How to address]
```

---

### Output Mode Handling

#### If `--concise` flag present:
**Output only final results, no discovery reasoning.**
- Omit "Progressive questioning" sections
- Omit derivation reasoning (keep only results)
- Keep use case details and UI patterns

#### If `--output <path>` specified:
**Write separate files:**
- `use-cases-explicit.md` - Explicit use cases
- `use-cases-implicit.md` - Implicit/derived use cases
- `use-cases-cascading.md` - Cascading use case chains
- `ui-interaction-patterns.md` - UI interaction details
- `use-case-relationships.md` - Relationships and sequences
- `ui-flow-diagrams.md` - Visual flow diagrams
- `interaction-sequences.md` - Detailed step-by-step sequences
- `implementation-guidance.md` - Priorities and recommendations
- `summary.md` - Executive summary

#### If stdout (default):
**Output comprehensive report to console with all sections.**

---

## Quality Standards

### Use Case Quality Checklist
- ✅ **Atomic**: Single, clear goal
- ✅ **Testable**: Can be verified (acceptance criteria clear)
- ✅ **Traceable**: Linked to source (epic quote or derivation reasoning)
- ✅ **Complete**: All sections present (trigger, flow, postconditions)
- ✅ **Granular**: Right-sized for implementation (not too broad or too detailed)
- ✅ **User-Centric**: Written from user perspective (not system perspective)

### UI Pattern Quality Checklist
- ✅ **Specific**: Concrete details, not vague descriptions
- ✅ **Actionable**: Developer knows what to build
- ✅ **Consistent**: Patterns are consistent across use cases
- ✅ **Complete States**: All states documented (loading, error, empty, success)
- ✅ **Feedback Defined**: User always knows what's happening
- ✅ **Navigation Clear**: User never lost or confused

### Documentation Quality Checklist
- ✅ **Organized**: Logical structure, easy to navigate
- ✅ **Scannable**: Headers, bullets, diagrams aid quick understanding
- ✅ **Examples**: Concrete examples provided where helpful
- ✅ **Visual**: Diagrams and flows for complex interactions
- ✅ **Actionable**: Implementation team can start building immediately

---

## Execution Guidelines

### Thinking Style
- **Focus on use cases** (avoid tangents into architecture, integration, etc.)
- **Think from user perspective** (what would user expect?)
- **Question assumptions** (what's unstated but assumed?)
- **Build progressively** (each use case reveals more)
- **Stay concrete** (specific UI details, not abstractions)

### Confidence Levels
- **HIGH (85-100%)**: Explicitly stated in epic
- **MEDIUM (60-84%)**: Strongly implied or standard practice
- **LOW (30-59%)**: Inferred from domain knowledge
- **DERIVED**: Calculated from other use cases (cascading, etc.)

### When to Stop Discovering
- Explicit use cases all extracted
- Obvious implicit use cases covered (setup, error handling, CRUD, lifecycle)
- Major cascade chains identified
- UI patterns documented for primary use cases
- Diminishing returns (no new meaningful use cases)

### Progressive Elaboration Process
1. **Extract explicit** use cases from epic
2. **For each explicit use case**, derive implicit use cases (setup, errors, etc.)
3. **For each use case**, identify cascades (what it triggers)
4. **For each use case**, document UI patterns (navigation, feedback, states)
5. **For each use case**, find alternatives and error flows
6. **Synthesize** relationships, sequences, and patterns
7. **Generate** comprehensive documentation

---

## Appendix A: Detailed Interaction Sequence Template

**Complete template for Directive 9 detailed sequences:**

```markdown
## Detailed Sequence: UC-XXX [Use Case Name]

### Context
- **Starting Point**: [Where user starts - specific screen/state]
- **User Goal**: [What they want to accomplish]
- **Typical Duration**: [Estimated time in seconds/minutes]

### Step-by-Step Interaction

**Step 1: [Action name]**
- **User Action**: [What user does - be specific: clicks, types, selects, etc.]
- **System Response**:
  * UI shows: [What appears/changes - specific elements]
  * State changes: [What state updates - data/application state]
  * Data: [What data is affected - loaded, saved, calculated]
- **Feedback**:
  * Visual: [Visual changes - colors, animations, indicators]
  * Audio: [Sound effects if any]
  * Haptic: [Vibration if applicable]
- **Available Actions**: [What user can do next - buttons, links, shortcuts]
- **Error Cases**: [What could go wrong - validation, network, etc.]

**Step 2: [Action name]**
- **Prerequisite**: [What must be true from Step 1]
- **User Action**: [What user does]
- **System Response**:
  * UI shows: [Changes - be specific]
  * API calls: [If any - endpoint, payload]
  * Loading state: [How shown - spinner, skeleton, message]
- **Timing**: [How long this takes - immediate, < 1s, 2-5s, etc.]
- **Feedback**: [User confirmation - success/error messages]
- **Error Cases**: [Potential failures - timeout, invalid data, etc.]

**Step 3-N: [Continue pattern for each step]**

### Completion
- **Success Indicator**: [How user knows it worked - confirmation message, state change, visual cue]
- **Final State**: [Where user ends up - which screen, what's visible]
- **Typical Next Action**: [What comes next - common follow-on actions]

### Example Walkthrough
```
User: [USER_PERSONA - role/experience level], [USER_CONTEXT - why doing this]
Scenario: [SCENARIO_DESCRIPTION - specific situation]

1. User [ACTION_1] → sees "[RESULT_1]"
2. [ACTION_2] → [RESULT_2]
3. [ACTION_3] → [RESULT_3]
...
[Continue with numbered steps showing concrete actions and results]
```
```

---

**Now execute:** Read the epic from ${ARGUMENTS} and begin use case expansion. Follow the directives above, staying focused on use case discovery. Build your understanding of explicit use cases first, then derive implicit ones. For each use case, deeply explore UI interaction patterns, notifications, data display, and state management. Document what's unstated but expected. Create comprehensive, actionable use case specifications.
