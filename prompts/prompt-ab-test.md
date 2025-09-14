# Prompt A/B Testing Framework: Comparative Prompt Evaluation

**Template**: prompt-ab-test
**Context**: `<prompt-arguments>`
**Purpose**: Compare two prompt versions by running them through the prompter agent with identical arguments and evaluating their effectiveness
**Methodology**: Pure prompt-as-code using natural language directives with runtime criteria generation and iterative refinement

## Executive Summary

This framework performs A/B testing between two prompts by executing both through the prompter agent with identical arguments, comparing their outputs against dynamically generated criteria, and providing actionable recommendations on which prompt is more effective for the given use case. The framework includes thinking patterns that announce intentions, actions, results, and learnings throughout the process.

## Visual Overview

```mermaid
flowchart TD
    Start[<prompt-arguments>] --> P1[Phase 1: Input Extraction]
    P1 --> P2[Phase 2: Analysis & Criteria]
    P2 --> P3[Phase 3: Parallel Execution]
    P3 --> P4[Phase 4: Comparative Analysis]
    P4 --> P5[Phase 5: Recommendations]
    P5 --> End[A/B Test Report]

    P1 -.-> Git[Git History]
    P2 -.-> Criteria[Runtime Criteria]
    P3 -.-> Prompter[Prompter Agent]
    P4 -.-> Scoring[Evaluation Matrix]
    P5 -.-> Report[Final Report]

    style Start fill:#e1f5fe
    style End fill:#c8e6c9
    style Prompter fill:#fff9c4
    style Criteria fill:#ffccbc
```

## Input Processing Protocol

```markdown
CRITICAL INPUT DIRECTIVE:

WHEN processing <prompt-arguments>:
  FIRST extract the primary prompt file:
    **PROMPT_A**: Look for first filename or path pattern
      - Absolute paths: /path/to/prompt.md
      - Relative paths: ./prompts/example.md
      - Filenames: my-prompt.md
      - Git paths: prompts/existing-prompt.md

    IF no **PROMPT_A** found THEN:
      ERROR: "First prompt file is required"
      EXIT with guidance

  THEN extract the comparison prompt:
    **PROMPT_B**: Look for second filename or path pattern
      - Same pattern matching as PROMPT_A

    IF no **PROMPT_B** found THEN:
      Set **USE_GIT_PREVIOUS**: true
      Extract previous version using:
        # Check if file has uncommitted changes to determine version
        if git -C "$(dirname <PROMPT_A>)" diff --quiet HEAD -- "$(basename <PROMPT_A>)"; then
          git -C "$(dirname <PROMPT_A>)" show HEAD~1:"$(basename <PROMPT_A>)" > /tmp/prompt-b-previous.md
        else
          git -C "$(dirname <PROMPT_A>)" show HEAD:"$(basename <PROMPT_A>)" > /tmp/prompt-b-previous.md
        fi
        Set **PROMPT_B**: /tmp/prompt-b-previous.md
        Set **CLEANUP_TEMP**: true

  FINALLY extract test arguments:
    **TEST_ARGUMENTS**: Everything after the two filenames
      - These will be passed to both prompts during execution
      - Preserve exact formatting and spacing
      - May include complex nested arguments
```

## Phase 1: Input Extraction and Setup

```markdown
**PHASE_1_PURPOSE**: Extract prompt files and prepare test environment

<thinking>
INTENTION: Extract and validate both prompt files from arguments, using git for version comparison if needed
ACTION: Parse arguments, validate files exist, setup test environment with unique identifiers
</thinking>

### Stage 1.1: Input Extraction

WHEN <worktree> is not provided:
  Set <worktree>$(pwd)</worktree>

EXTRACT from <prompt-arguments>:
  **PROMPT_A_PATH**: First file reference
  **PROMPT_B_PATH**: Second file reference (or null)
  **TEST_ARGUMENTS**: Remaining arguments for testing

  Validate PROMPT_A exists:
    IF ! test -f "<PROMPT_A_PATH>" THEN:
      Search in common locations:
        - <worktree>/prompts/<PROMPT_A_PATH>
        - $(dirname $(git -C "<worktree>" rev-parse --show-toplevel))/prompts/<PROMPT_A_PATH>

      IF still not found THEN:
        ERROR: "Cannot locate prompt A: <PROMPT_A_PATH>"
        <learning>File not found - user may need to provide full path</learning>

### Stage 1.2: Criteria Definition (Runtime)

GENERATE runtime criteria for Phase 1:
  **SUCCESS_CRITERIA**:
    - Both prompt files must be located and readable
    - Test arguments must be extracted and preserved
    - Test environment must be isolated and unique

  **ANTI_CRITERIA**:
    - Must not modify original prompt files
    - Must not interfere with other concurrent tests
    - Must not leave temporary files after completion

### Stage 1.3: Research & Discovery

RESEARCH optimal setup approaches:
  Analyze prompt file patterns in arguments:
    - Determine if this is version comparison vs file comparison
    - Identify optimal temporary directory strategy
    - Research git fallback strategies for version detection

### Stage 1.4: Planning

PLAN the extraction and setup strategy:
  **EXTRACTION_APPROACH**: Based on research findings
    IF PROMPT_B_PATH is null:
      Plan git-based version extraction with fallbacks
    ELSE:
      Plan direct file validation approach

  **ISOLATION_STRATEGY**:
    Create unique test directory: <worktree>/tmp/prompt-ab-test-$(date +%Y%m%d-%H%M%S)-$$
    Plan cleanup requirements for test completion

### Stage 1.5: Review

VALIDATE extraction plan before execution:
  - Verify both prompts can be located or extracted
  - Confirm test directory creation won't conflict
  - Check git operations are safe and non-destructive

### Stage 1.6: Execution

EXECUTE the validated extraction plan:

  Extract Prompt B:
    IF PROMPT_B_PATH is null THEN:
      **USE_GIT_COMPARISON**: true

      REPO_ROOT=$(git -C "<worktree>" rev-parse --show-toplevel 2>/dev/null)

      IF REPO_ROOT is empty THEN:
        ERROR: "No second prompt specified and not in a git repository"

      RELATIVE_PATH=$(realpath --relative-to="$REPO_ROOT" "<PROMPT_A_PATH>")

      TEST_DIR=/tmp/prompt-ab-test-$(date +%Y%m%d-%H%M%S)-$$
      mkdir -p "$TEST_DIR"

      # Intelligent version selection using content hashes
      # Get hash of current HEAD version
      CURRENT_HASH=$(git -C "$REPO_ROOT" show "HEAD:$RELATIVE_PATH" 2>/dev/null | sha256sum | cut -d' ' -f1)

      # Check if current file differs from HEAD
      IF git -C "$REPO_ROOT" diff --quiet HEAD -- "$RELATIVE_PATH" 2>/dev/null THEN:
        # File is same as HEAD, find previous different version
        echo "File unchanged from HEAD, searching for previous different version..."

        # Get list of commits that touched this file (limit to 20 for performance)
        COMMITS=$(git -C "$REPO_ROOT" log --format='%H' -n 20 -- "$RELATIVE_PATH" 2>/dev/null || echo "")

        VERSION_TO_USE=""
        VERSION_LABEL=""

        # Walk through commits to find first different content
        for COMMIT in $COMMITS; do
          # Skip the first commit (HEAD) since we already have its hash
          if [ -z "$VERSION_TO_USE" ]; then
            # First iteration is HEAD, skip it
            VERSION_TO_USE="skip"
            continue
          fi

          # Get hash of this commit's version
          COMMIT_HASH=$(git -C "$REPO_ROOT" show "$COMMIT:$RELATIVE_PATH" 2>/dev/null | sha256sum | cut -d' ' -f1 || echo "")

          # If hash is different, use this version
          if [ -n "$COMMIT_HASH" ] && [ "$COMMIT_HASH" != "$CURRENT_HASH" ]; then
            VERSION_TO_USE="$COMMIT"
            # Get first 7 chars of commit hash for display
            SHORT_COMMIT=$(echo "$COMMIT" | cut -c1-7)
            # Get commit message for context
            COMMIT_MSG=$(git -C "$REPO_ROOT" log -1 --format='%s' "$COMMIT" 2>/dev/null | cut -c1-50)
            VERSION_LABEL="Previous different version ($SHORT_COMMIT: $COMMIT_MSG)"
            echo "Found different version at commit $SHORT_COMMIT"
            break
          fi
        done

        # If no different version found, abort
        if [ "$VERSION_TO_USE" = "skip" ] || [ -z "$VERSION_TO_USE" ]; then
          ERROR: "No different version found in last 20 commits. File may be newly added or unchanged for many commits."
          echo "To run A/B test, either:"
          echo "  1. Make changes to the file and save (uncommitted changes)"
          echo "  2. Specify explicit version: 'version <commit-hash>'"
          echo "  3. Use two different files: 'file prompt1.md prompt2.md'"
          EXIT with status 1
        fi
      ELSE:
        # File has uncommitted changes, use HEAD for comparison
        VERSION_TO_USE="HEAD"
        VERSION_LABEL="Last committed version (HEAD) - comparing uncommitted changes"
      FI

      # Extract the appropriate version
      IF git -C "$REPO_ROOT" show "${VERSION_TO_USE}:${RELATIVE_PATH}" > "$TEST_DIR/prompt-b-committed.md" 2>/dev/null THEN:
        Set **PROMPT_B_PATH**: "$TEST_DIR/prompt-b-committed.md"
        Set **PROMPT_B_LABEL**: "$VERSION_LABEL"
      ELSE:
        # File doesn't exist in the chosen version
        ERROR: "File '<PROMPT_A_PATH>' is not available in ${VERSION_TO_USE}.
        For new files, please provide two explicit prompt files:
        /prompt prompt-ab-test prompt1.md prompt2.md [test-args]

        Or commit your file first, then run:
        git -C "$REPO_ROOT" add "$RELATIVE_PATH" && git -C "$REPO_ROOT" commit -m 'Add prompt for A/B testing'"
      FI

      Set **CLEANUP_REQUIRED**: true
      Set **TEST_DIR**: "$TEST_DIR"

    ELSE:
      Validate PROMPT_B exists at specified path
      Set **PROMPT_B_LABEL**: "<PROMPT_B_PATH>"

### Stage 1.7: Quality Check

FOR iteration FROM 1 TO maximum of 25:
  EVALUATE extraction quality:
    - Can both prompt files be read successfully? [Pass/Fail]
    - Are test arguments properly preserved? [Pass/Fail]
    - Is test environment properly isolated? [Pass/Fail]

  IF all checks pass:
    Break from iteration loop
  ELSE:
    Identify adjustment needed and retry

### Stage 1.8: Create Test Configuration

MEASURE prompt file characteristics:
  **PROMPT_A_SIZE**: [character count of PROMPT_A_PATH file]
  **PROMPT_A_LINES**: [line count of PROMPT_A_PATH file]
  **PROMPT_B_SIZE**: [character count of PROMPT_B_PATH file]
  **PROMPT_B_LINES**: [line count of PROMPT_B_PATH file]

Create comprehensive test manifest:
  **TEST_ID**: ab-test-$(date +%Y%m%d-%H%M%S)
  **PROMPT_A_NAME**: $(basename "<PROMPT_A_PATH>")
  **PROMPT_B_NAME**: IF PROMPT_B_LABEL == "Last committed version (HEAD)" THEN <PROMPT_B_LABEL> ELSE $(basename "<PROMPT_B_PATH>")
  **TEST_ARGUMENTS**: "<TEST_ARGUMENTS>"
  **TIMESTAMP**: $(date -Iseconds)
  **WORKTREE**: <worktree>

### Stage 1.9: Phase Completion

Mark Phase 1 complete with all required outputs:
  - **PROMPT_A_PATH**: Validated path to first prompt
  - **PROMPT_B_PATH**: Validated path to second prompt
  - **TEST_ARGUMENTS**: Preserved test arguments
  - **TEST_ENVIRONMENT**: Isolated test configuration

OUTPUT to user:
  **File Paths Being Tested**:
  - Prompt A: <PROMPT_A_PATH>
  - Prompt B: <PROMPT_B_PATH> (<PROMPT_B_LABEL>)
  - Test Arguments: <TEST_ARGUMENTS>

### Prompt Contents

Display Prompt A content:
  **PROMPT_A_CONTENT**: [Read content of PROMPT_A_PATH file]
  ```
  <PROMPT_A_CONTENT>
  ```
  *File metrics: <PROMPT_A_SIZE> characters, <PROMPT_A_LINES> lines*

Display Prompt B content:
  **PROMPT_B_CONTENT**: [Read content of PROMPT_B_PATH file]
  ```
  <PROMPT_B_CONTENT>
  ```
  *File metrics: <PROMPT_B_SIZE> characters, <PROMPT_B_LINES> lines*

### Identity Check

**CRITICAL VALIDATION - Refuse identical prompts**:
IF PROMPT_A_CONTENT == PROMPT_B_CONTENT:
  ERROR: "Both prompts have identical content - A/B test cannot proceed"

  Display error message:
  ```
  ⚠️ A/B TEST ABORTED ⚠️

  Reason: Both prompts contain identical content

  This makes comparison meaningless as they will produce
  identical outputs. Please ensure the prompts differ by:
  - Using different prompt files
  - Specifying a different git version for Prompt B
  - Making uncommitted changes to one prompt

  Current situation:
  - Prompt A: <PROMPT_A_PATH>
  - Prompt B: <PROMPT_B_PATH>
  - Content hash A: [SHA256 of PROMPT_A_CONTENT]
  - Content hash B: [SHA256 of PROMPT_B_CONTENT]
  ```

  EXIT with status code 1
  ABORT entire test execution
```

## Phase 2: Prompt Analysis and Criteria Generation

```markdown
**PHASE_2_PURPOSE**: Analyze both prompts and generate evaluation criteria adapted to their domain

<thinking>
INTENTION: Understand the domain and purpose of both prompts to generate appropriate evaluation criteria
ACTION: Analyze structure, detect domain, adapt criteria weights accordingly
</thinking>

### Stage 2.1: Input Extraction

WHEN <worktree> is not provided:
  Set <worktree>$(pwd)</worktree>

EXTRACT from previous Phase 1 outputs:
  **PROMPT_A_PATH**: Validated path to first prompt
  **PROMPT_B_PATH**: Validated path to second prompt
  **TEST_ARGUMENTS**: Preserved test arguments
  **TEST_ENVIRONMENT**: Isolated test configuration

READ prompt file contents:
  **PROMPT_A_CONTENT**: Full content of first prompt
  **PROMPT_B_CONTENT**: Full content of second prompt

### Stage 2.2: Criteria Definition (Runtime)

GENERATE runtime criteria for Phase 2:
  **SUCCESS_CRITERIA**:
    - Both prompts must be successfully analyzed for domain type
    - Criteria weights must be adapted based on detected domain
    - Evaluation rubric must be comprehensive and measurable

  **ANTI_CRITERIA**:
    - Must not use generic criteria that don't fit domain
    - Must not create criteria that can't be objectively measured
    - Must not bias criteria toward any particular prompt style

### Stage 2.3: Research & Discovery

RESEARCH optimal domain detection approaches:
  Analyze prompt content patterns:
    - Identify keyword densities for domain classification
    - Research structural elements that indicate prompt purpose
    - Discover secondary domain indicators for hybrid prompts

INVESTIGATE criteria weight optimization:
  Research domain-specific effectiveness patterns:
    - What makes CODE_GENERATION prompts effective?
    - How do ANALYSIS prompts differ in success criteria?
    - Which criteria matter most for DEBUGGING prompts?

### Stage 2.4: Planning

PLAN the analysis and criteria generation strategy:
  **DOMAIN_DETECTION_APPROACH**:
    Use keyword analysis combined with structural pattern recognition
    Support 9 primary domains with confidence scoring
    Detect secondary domains for hybrid classification

  **CRITERIA_ADAPTATION_STRATEGY**:
    Apply domain-specific weight distributions
    Blend weights for multi-domain prompts (70% primary, 30% secondary)
    Maintain 5 core criteria across all domains

### Stage 2.5: Review

VALIDATE analysis plan before execution:
  - Verify domain detection covers all expected prompt types
  - Confirm criteria weights sum to 100% for all domain combinations
  - Check that all criteria remain measurable and objective

### Stage 2.6: Execution

EXECUTE the validated analysis plan:

FOR each prompt in [PROMPT_A, PROMPT_B]:
  Read and analyze prompt content

  IDENTIFY structural elements:
    **HAS_PHASES**: Contains "Phase" or "Stage" markers
    **HAS_MERMAID**: Contains mermaid diagram
    **HAS_FRONTMATTER**: Has YAML frontmatter
    **HAS_ARGUMENTS**: References <prompt-arguments>
    **HAS_TOOLS**: Mentions specific tools
    **COMPLEXITY_LEVEL**: Count of directives and conditions

  DETECT domain type using multi-signal approach:
    **PRIMARY_DOMAIN_SIGNAL**: Analyze prompt content for domain indicators
      - CODE_GENERATION: Contains "create", "implement", "function", "class", "build"
      - ANALYSIS: Contains "analyze", "evaluate", "assess", "review", "examine"
      - DOCUMENTATION: Contains "document", "describe", "explain", "write", "spec"
      - TRANSFORMATION: Contains "convert", "transform", "migrate", "refactor", "port"
      - AUTOMATION: Contains "automate", "workflow", "pipeline", "deploy", "ci"
      - TESTING: Contains "test", "validate", "verify", "check", "assert"
      - DEBUGGING: Contains "debug", "troubleshoot", "fix", "error", "issue"
      - PLANNING: Contains "plan", "design", "architect", "strategy", "roadmap"
      - RESEARCH: Contains "research", "investigate", "explore", "discover", "study"

    **SECONDARY_DOMAIN_SIGNAL**: Analyze TEST_ARGUMENTS for action verbs
      Parse TEST_ARGUMENTS content for:
      - Action indicators: "create", "analyze", "debug", "optimize", "compare"
      - Context indicators: "performance", "security", "scalability", "usability"
      - Output format hints: "table", "list", "report", "dashboard", "code"
      - Complexity indicators: "simple", "comprehensive", "detailed", "enterprise"

    **TERTIARY_DOMAIN_SIGNAL**: Expected output format from arguments
      Detect format expectations from TEST_ARGUMENTS:
      - Code output: mentions "function", "class", "script", "implementation"
      - Analysis output: mentions "comparison", "evaluation", "assessment"
      - Documentation: mentions "guide", "documentation", "explanation"

    **DOMAIN_CONFIDENCE**: Calculate multi-signal confidence
      Base confidence = keyword density in prompt (current method)

      CONFIDENCE_ADJUSTMENTS:
        IF TEST_ARGUMENTS reinforce prompt domain: +20% confidence boost
        IF TEST_ARGUMENTS suggest different domain: -15% confidence penalty
        IF expected output format matches domain: +10% confidence boost
        IF complexity indicators align with domain: +5% confidence boost

    **SECONDARY_DOMAIN**: Detect mixed domains with argument influence
      Consider both prompt keywords AND argument context for hybrid classification

  EXTRACT purpose indicators:
    **STATED_PURPOSE**: From frontmatter or header
    **DOMAIN_CONTEXT**: Subject area references
    **EXPECTED_OUTPUTS**: What prompt claims to produce

ADAPT criteria weights using dynamic argument-aware calculation:

### Dynamic Weight Calculation Framework

**DYNAMIC_CRITERIA_TEMPLATES**: Flexible weight ranges instead of fixed values

DEFINE base criteria templates with min/max ranges:
  **BASE_CRITERIA_CONSTRAINTS**:
    completeness: { min_weight: 20, max_weight: 50 }
    quality: { min_weight: 20, max_weight: 45 }
    efficiency: { min_weight: 2, max_weight: 20 }
    error_handling: { min_weight: 5, max_weight: 40 }
    usability: { min_weight: 5, max_weight: 30 }

APPLY domain-specific weight preferences:
  **DOMAIN_WEIGHT_PREFERENCES**: Calculate within constraints
    IF DOMAIN_TYPE == CODE_GENERATION:
      preferences = { completeness: 35, quality: 30, efficiency: 5, error_handling: 20, usability: 10 }
      modifiers = { error_handling: +10, quality: +5 } # Code needs reliability and clarity

    ELIF DOMAIN_TYPE == ANALYSIS:
      preferences = { completeness: 35, quality: 35, efficiency: 5, error_handling: 15, usability: 10 }
      modifiers = { completeness: +10, quality: +10 } # Analysis needs thoroughness and insight

    ELIF DOMAIN_TYPE == DOCUMENTATION:
      preferences = { completeness: 30, quality: 40, efficiency: 3, error_handling: 7, usability: 20 }
      modifiers = { usability: +15, quality: +8 } # Docs need clarity and user-friendliness

    ELIF DOMAIN_TYPE == TESTING:
      preferences = { completeness: 40, quality: 30, efficiency: 5, error_handling: 20, usability: 5 }
      modifiers = { completeness: +15, error_handling: +15 } # Tests need comprehensive coverage

    ELIF DOMAIN_TYPE == DEBUGGING:
      preferences = { completeness: 25, quality: 30, efficiency: 5, error_handling: 35, usability: 5 }
      modifiers = { error_handling: +20 } # Debugging prioritizes problem-solving

    ELIF DOMAIN_TYPE == PLANNING:
      preferences = { completeness: 35, quality: 35, efficiency: 5, error_handling: 10, usability: 15 }
      modifiers = { completeness: +8, usability: +8 } # Plans need completeness and clarity

    ELIF DOMAIN_TYPE == RESEARCH:
      preferences = { completeness: 40, quality: 35, efficiency: 5, error_handling: 10, usability: 10 }
      modifiers = { completeness: +12, quality: +8 } # Research needs depth and accuracy

    ELIF DOMAIN_TYPE == TRANSFORMATION:
      preferences = { completeness: 35, quality: 25, efficiency: 5, error_handling: 30, usability: 5 }
      modifiers = { error_handling: +18 } # Transformations need robust handling

    ELIF DOMAIN_TYPE == AUTOMATION:
      preferences = { completeness: 30, quality: 25, efficiency: 5, error_handling: 35, usability: 5 }
      modifiers = { error_handling: +20, efficiency: +5 } # Automation needs reliability and efficiency

    ELSE:
      preferences = { completeness: 35, quality: 30, efficiency: 5, error_handling: 15, usability: 15 }
      modifiers = { quality: +5 } # Default: slight quality preference

**CONTEXT_MODIFIERS**: Situational adjustments applied to preferences
  **RESEARCH_CONTEXT**: { completeness: +10, quality: +5 }
  **PRODUCTION_CONTEXT**: { error_handling: +15, quality: +10 }
  **PROTOTYPE_CONTEXT**: { efficiency: +10, usability: +5 }
  **ANALYSIS_CONTEXT**: { completeness: +15, quality: +10 }
  **USER_FACING_CONTEXT**: { usability: +12, quality: +8 }
  **TECHNICAL_DEPTH_CONTEXT**: { quality: +12, completeness: +8 }

CALCULATE dynamic base weights:
  FOR each criterion:
    initial_weight = domain_preferences[criterion]

    APPLY domain modifiers:
      adjusted_weight = initial_weight + domain_modifiers[criterion]

    APPLY context modifiers based on TEST_ARGUMENTS:
      IF "research" in TEST_ARGUMENTS:
        adjusted_weight += RESEARCH_CONTEXT[criterion]
      IF "production" in TEST_ARGUMENTS:
        adjusted_weight += PRODUCTION_CONTEXT[criterion]
      # ... (other context applications)

    ENFORCE constraints:
      final_weight = CLAMP(adjusted_weight, min_weight, max_weight)

  NORMALIZE to 100%:
    total = sum(all_final_weights)
    FOR each criterion:
      normalized_weight = (final_weight / total) * 100

**SIMPLIFIED PROMPT-FOCUSED EVALUATION**:

EVALUATE prompts and their outputs directly:

**PRIMARY CRITERIA FOCUS** (80% total weight):

1. **PROMPT_EFFECTIVENESS** (25%):
   - Instruction clarity and specificity
   - Structural organization of prompts
   - Adaptability to different contexts
   - Guidance quality for AI execution

2. **EXECUTION_PERFORMANCE** (30%):
   - Actual time to complete (critical for hooks)
   - Resource efficiency and overhead
   - Startup and processing speed
   - Comparative timing advantage
   - Performance consistency across runs

3. **OUTPUT_QUALITY** (25%):
   - Breadth of coverage and scope
   - Depth of analysis and insight
   - Detail accuracy and precision
   - Format presentation and structure
   - Practical value and usefulness

**BASIC_DOMAIN_ADJUSTMENTS**:
  Only apply simple adjustments based on prompt domain:
    IF RESEARCH domain: +5% Quality, +5% Completeness
    IF CODE_GENERATION domain: +5% Performance, +5% Error Handling
    IF DOCUMENTATION domain: +10% Usability

  Maximum adjustment: 10% to prevent over-tuning

**WEIGHT_BALANCING**: Ensure weights sum to 100%

  CALCULATE total_adjustments = sum of all positive adjustments
  CALCULATE rebalance_factor = (100 - original_total_after_increases) / remaining_criteria_count

  APPLY proportional reduction to non-boosted criteria:
    FOR each criterion not receiving positive adjustment:
      new_weight = original_weight - (original_weight * rebalance_factor)

  VERIFY final weights sum to exactly 100%
  ENSURE no weight falls below minimum thresholds:
    - Completeness: minimum 20%
    - Quality: minimum 20%
    - Efficiency: minimum 2%
    - ErrorHandling: minimum 5%
    - Usability: minimum 5%

**SECONDARY_DOMAIN_BLENDING**: Blend domain weights if hybrid detected
  IF SECONDARY_DOMAIN exists:
    primary_weights = domain_weights * 0.70
    secondary_weights = secondary_domain_weights * 0.30
    blended_weights = primary_weights + secondary_weights
    Apply argument adjustments to blended base weights

DETERMINE expected outcomes based on TEST_ARGUMENTS:
  Parse TEST_ARGUMENTS for intent:
    - Is this a creation task?
    - Is this an analysis task?
    - Is this a transformation task?

  Set baseline expectations:
    **MINIMUM_OUTPUT_LENGTH**: Contextual based on task
    **EXPECTED_SECTIONS**: What sections should appear
    **REQUIRED_ELEMENTS**: Must-have components

### Stage 2.7: Quality Check

FOR iteration FROM 1 TO maximum of 25:
  EVALUATE analysis quality:
    - Were both prompts successfully analyzed for domain? [Pass/Fail]
    - Do adapted criteria weights sum to exactly 100%? [Pass/Fail]
    - Are all criteria measurable and objective? [Pass/Fail]
    - Does domain detection have reasonable confidence (>60%)? [Pass/Fail]

  IF all checks pass:
    Break from iteration loop
  ELSE:
    Identify adjustment needed and retry analysis

### Stage 2.8: Create Evaluation Framework

**SIMPLIFIED EVALUATION CRITERIA** focused on prompt quality and output:

  <prompt-criteria>
  **PROMPT_EFFECTIVENESS** (25%):
    - Instruction clarity: Are directions specific and actionable?
    - Structure quality: Is the prompt well-organized?
    - Adaptability: Does it work across different contexts?
    - AI guidance: Does it help AI produce better results?
  </prompt-criteria>

  <performance-criteria>
  **EXECUTION_PERFORMANCE** (20%):
    - Speed comparison: Which prompt executes faster?
    - Resource efficiency: Memory and processing overhead
    - Timing advantage: Significant speed differences (>3x = major)
    - Hook suitability: Fast enough for development workflows
  </performance-criteria>

  <output-criteria>
  **OUTPUT_QUALITY** (35%):
    - Coverage breadth: Comprehensive topic coverage
    - Analysis depth: Detailed insights and understanding
    - Accuracy: Factual correctness and precision
    - Format excellence: Professional presentation and structure
    - Practical value: Actionable and useful results
  </output-criteria>

  <discovered-criteria>
  **POST-EXECUTION_DISCOVERY** (20%):
    - Content-specific criteria based on actual outputs
    - Emergent quality factors found during analysis
    - Domain-specific requirements discovered from results
    - Output characteristic patterns unique to this comparison
  </discovered-criteria>

### Stage 2.9: Phase Completion

Mark Phase 2 complete with all required outputs:
  - **DOMAIN_TYPE**: Detected primary domain classification
  - **SECONDARY_DOMAIN**: Detected secondary domain (if applicable)
  - **DOMAIN_CONFIDENCE**: Confidence level in domain detection
  - **ADAPTED_CRITERIA**: Domain-specific weighted evaluation criteria
  - **BASELINE_EXPECTATIONS**: Expected output characteristics based on TEST_ARGUMENTS

  <result>Detected domain: <DOMAIN_TYPE></result>
  <learning>Domain detection influences criteria weighting for more accurate evaluation</learning>

These values carry forward to Phase 3 for execution and Phase 4 for scoring adaptation.
```

## Phase 3: Parallel Execution

```markdown
**PHASE_3_PURPOSE**: Execute both prompts through prompter agent in parallel

<thinking>
INTENTION: Run both prompts simultaneously for fair comparison and efficiency
ACTION: Launch subagents in parallel, wait for completion, capture all outputs
</thinking>

### Stage 3.1: Input Extraction

WHEN <worktree> is not provided:
  Set <worktree>$(pwd)</worktree>

EXTRACT from previous Phase 2 outputs:
  **PROMPT_A_PATH**: Validated path to first prompt
  **PROMPT_B_PATH**: Validated path to second prompt
  **TEST_ARGUMENTS**: Preserved test arguments
  **DOMAIN_TYPE**: Detected primary domain classification
  **ADAPTED_CRITERIA**: Domain-specific weighted evaluation criteria

PREPARE execution environment:
  **EXECUTION_ID**: parallel-test-$(date +%Y%m%d-%H%M%S)
  **START_TIMESTAMP**: $(date -Iseconds)

### Stage 3.2: Criteria Definition (Runtime)

GENERATE runtime criteria for Phase 3:
  **SUCCESS_CRITERIA**:
    - Both prompts must be executed with identical TEST_ARGUMENTS
    - Execution must be parallel for fair timing comparison
    - All outputs and errors must be captured completely

  **ANTI_CRITERIA**:
    - Must not execute prompts sequentially (introduces bias)
    - Must not lose any output or error information
    - Must not allow one execution to interfere with the other

### Stage 3.3: Research & Discovery

RESEARCH optimal parallel execution approaches:
  Analyze prompter agent execution patterns:
    - Identify best practices for Task tool parallel execution
    - Research timeout and retry strategies
    - Discover error capture and handling methods

INVESTIGATE execution environment isolation:
  Research subagent independence requirements:
    - How to prevent cross-contamination between executions
    - Best practices for parallel output capture
    - Optimal retry logic for failed executions

### Stage 3.4: Planning

PLAN the parallel execution strategy:
  **EXECUTION_APPROACH**:
    Use Task tool with parallel subagent launch
    Capture timing, outputs, errors, and status for both
    Implement single retry for failed executions

  **ISOLATION_STRATEGY**:
    Each subagent operates independently with identical arguments
    No shared state between parallel executions
    Complete output separation until collection phase

  **ERROR_HANDLING_STRATEGY**:
    Continue with partial results if one execution fails
    Document all failures and retry attempts
    Apply appropriate scoring penalties for failures

### Stage 3.5: Review

VALIDATE execution plan before launching:
  - Verify both prompt paths are accessible to subagents
  - Confirm TEST_ARGUMENTS are properly formatted for prompter
  - Check that parallel execution won't cause resource conflicts
  - Ensure error capture mechanisms are comprehensive

### Stage 3.6: Execution

EXECUTE the validated parallel execution plan:

Construct prompter invocations:
  **COMMAND_A**: "/prompt <PROMPT_A_PATH> <TEST_ARGUMENTS>"
  **COMMAND_B**: "/prompt <PROMPT_B_PATH> <TEST_ARGUMENTS>"

### Execution Commands Being Run

Display exact commands that will be executed:
  **Command for Prompt A**: /prompt <PROMPT_A_PATH> <TEST_ARGUMENTS>
  **Command for Prompt B**: /prompt <PROMPT_B_PATH> <TEST_ARGUMENTS>

Display Task tool invocation parameters:
  **Task A Parameters**:
    - subagent_type: "prompter"
    - description: "Execute Prompt A Testing"
    - prompt: "Execute: /prompt <PROMPT_A_PATH> <TEST_ARGUMENTS>"

  **Task B Parameters**:
    - subagent_type: "prompter"
    - description: "Execute Prompt B Testing"
    - prompt: "Execute: /prompt <PROMPT_B_PATH> <TEST_ARGUMENTS>"

CAPTURE execution timing:
  **START_TIME**: [current timestamp in milliseconds before execution]

## Verbatim Mode Configuration

**VERBATIM_PREFIX** - Prepend to all Task tool prompts:
```
===== VERBATIM CAPTURE MODE =====
NO SUMMARIZATION - FULL OUTPUT REQUIRED
This test framework requires EXACT output capture.
Include EVERY character, even if 20,000+ long.
Summaries or descriptions will cause test failure.
===================================
```

## Parallel Execution Strategy

**CRITICAL ANTI-SUMMARIZATION DIRECTIVES**:
- The outputs MUST be the exact text produced by the prompts
- Do NOT replace long outputs with descriptions
- Even if output is 15,000+ characters, capture it ALL
- No "[Comprehensive output...]" descriptions allowed
- Character-for-character verbatim capture required

EXECUTE both prompts in parallel using two simultaneous Task tool calls:

**⚠️ CRITICAL PARALLEL EXECUTION REQUIREMENT ⚠️**:
**You MUST execute both Task calls in the SAME AI MESSAGE for true parallel execution.**
**Sequential Task calls will invalidate the comparison due to timing bias.**

**🔄 PARALLEL EXECUTION PATTERN**:
1. Start both Task calls simultaneously in one message
2. Both prompter subagents launch at exactly the same time
3. Fair timing comparison with no sequential advantage
4. Use this exact pattern: Task(Prompt A) + Task(Prompt B) in single response

Task Call 1 - Execute Prompt A:
  Use Task tool with:
  - subagent_type: "prompter"
  - description: "Execute Prompt A with VERBATIM output"
  - prompt: "⚠️ VERBATIM OUTPUT MODE - NO SUMMARIZATION ALLOWED ⚠️

    **ULTRA-CRITICAL REQUIREMENTS**:
    You MUST return EVERY SINGLE CHARACTER of output.
    Even if the output is 20,000+ characters, include it ALL.
    Do NOT summarize, truncate, or describe the output.
    Do NOT use phrases like '[comprehensive output...]' or '[extensive research...]'

    ===== VERBATIM CAPTURE MODE =====
    NO SUMMARIZATION - FULL OUTPUT REQUIRED
    This test framework requires EXACT output capture.
    Include EVERY character produced by the prompt.
    Summaries or descriptions will cause test failure.
    ===================================

    Execute the prompt template at <PROMPT_A_PATH> with arguments: <TEST_ARGUMENTS>

    STEP 1: Read and display the COMPLETE prompt file content:
    ```
    [Read and display ENTIRE content of <PROMPT_A_PATH> - every line]
    ```

    STEP 2: Execute the prompt by:
    1. Loading the template from <PROMPT_A_PATH>
    2. Replacing <prompt-arguments> with: <TEST_ARGUMENTS>
    3. Following ALL instructions in the prompt to produce output
    4. Executing any research, analysis, or generation tasks specified

    **CRITICAL EXECUTION REQUIREMENTS**:
    - You must EXECUTE the instructions in the prompt, not just substitute arguments
    - Follow all #Research, #Output or other sections in the prompt
    - Produce actual results based on the prompt's instructions
    - This is NOT just text substitution - you must DO what the prompt says

    **FORBIDDEN - WILL CAUSE TEST FAILURE**:
    ❌ Summaries or descriptions of output
    ❌ Truncation with '...'
    ❌ Phrases like '[extensive research...]' or '[comprehensive analysis...]'
    ❌ Any form of abbreviation or shortening
    ❌ Replacing actual output with descriptions

    **REQUIRED - MUST INCLUDE**:
    ✅ The exact, complete, character-for-character output
    ✅ ALL characters produced, no matter how long (10,000+, 20,000+, etc.)
    ✅ Every single word, sentence, paragraph, table, list item
    ✅ Complete formatting, spacing, line breaks as produced

    Return the result in this EXACT structured format:
    <execution-result>
      <status>SUCCESS|FAILED|PARTIAL</status>
      <execution-time>[time in seconds]</execution-time>
      <output-a>
[PUT THE COMPLETE, VERBATIM OUTPUT HERE - EVERY SINGLE CHARACTER]
[DO NOT SUMMARIZE - INCLUDE THE FULL OUTPUT]
[EVEN IF 20,000+ CHARACTERS - INCLUDE IT ALL]
      </output-a>
      <errors>[Any errors or issues encountered]</errors>
      <retry-count>[Number of retry attempts]</retry-count>
    </execution-result>

    REMINDER: The <output-a> section MUST contain the COMPLETE output, not a summary.
    If the initial execution fails, retry once before returning FAILED status."

Task Call 2 - Execute Prompt B:
  Use Task tool with:
  - subagent_type: "prompter"
  - description: "Execute Prompt B with VERBATIM output"
  - prompt: "⚠️ VERBATIM OUTPUT MODE - NO SUMMARIZATION ALLOWED ⚠️

    **ULTRA-CRITICAL REQUIREMENTS**:
    You MUST return EVERY SINGLE CHARACTER of output.
    Even if the output is 20,000+ characters, include it ALL.
    Do NOT summarize, truncate, or describe the output.
    Do NOT use phrases like '[comprehensive output...]' or '[extensive research...]'

    ===== VERBATIM CAPTURE MODE =====
    NO SUMMARIZATION - FULL OUTPUT REQUIRED
    This test framework requires EXACT output capture.
    Include EVERY character produced by the prompt.
    Summaries or descriptions will cause test failure.
    ===================================

    Execute the prompt template at <PROMPT_B_PATH> with arguments: <TEST_ARGUMENTS>

    STEP 1: Read and display the COMPLETE prompt file content:
    ```
    [Read and display ENTIRE content of <PROMPT_B_PATH> - every line]
    ```

    STEP 2: Execute the prompt by:
    1. Loading the template from <PROMPT_B_PATH>
    2. Replacing <prompt-arguments> with: <TEST_ARGUMENTS>
    3. Following ALL instructions in the prompt to produce output
    4. Executing any research, analysis, or generation tasks specified

    **CRITICAL EXECUTION REQUIREMENTS**:
    - You must EXECUTE the instructions in the prompt, not just substitute arguments
    - Follow all #Research, #Output or other sections in the prompt
    - Produce actual results based on the prompt's instructions
    - This is NOT just text substitution - you must DO what the prompt says

    **FORBIDDEN - WILL CAUSE TEST FAILURE**:
    ❌ Summaries or descriptions of output
    ❌ Truncation with '...'
    ❌ Phrases like '[extensive research...]' or '[comprehensive analysis...]'
    ❌ Any form of abbreviation or shortening
    ❌ Replacing actual output with descriptions

    **REQUIRED - MUST INCLUDE**:
    ✅ The exact, complete, character-for-character output
    ✅ ALL characters produced, no matter how long (10,000+, 20,000+, etc.)
    ✅ Every single word, sentence, paragraph, table, list item
    ✅ Complete formatting, spacing, line breaks as produced

    Return the result in this EXACT structured format:
    <execution-result>
      <status>SUCCESS|FAILED|PARTIAL</status>
      <execution-time>[time in seconds]</execution-time>
      <output-b>
[PUT THE COMPLETE, VERBATIM OUTPUT HERE - EVERY SINGLE CHARACTER]
[DO NOT SUMMARIZE - INCLUDE THE FULL OUTPUT]
[EVEN IF 20,000+ CHARACTERS - INCLUDE IT ALL]
      </output-b>
      <errors>[Any errors or issues encountered]</errors>
      <retry-count>[Number of retry attempts]</retry-count>
    </execution-result>

    REMINDER: The <output-b> section MUST contain the COMPLETE output, not a summary.
    If the initial execution fails, retry once before returning FAILED status."

**Implementation**: Send both Task calls in the same AI message to ensure parallel execution

START_TIME=$(date +%s.%N)

The framework will automatically:
- Launch both subagents simultaneously
- Wait for both to complete
- Parse structured XML responses
- Extract <output-a> and <output-b> content
- Capture status, timing, and error information
- Apply retry logic if needed
- Continue with comparative analysis once both complete

END_TIME=$(date +%s.%N)
TOTAL_DURATION=$(echo "$END_TIME - $START_TIME" | bc)

## Expected Response Structure

Each subagent returns structured XML containing:
- **status**: Execution result (SUCCESS/FAILED/PARTIAL)
- **execution-time**: How long the prompt took to execute
- **output-a/output-b**: The actual prompt output (labeled)
- **errors**: Any errors encountered
- **retry-count**: Number of retry attempts made

## XML Parsing and Variable Extraction

After both subagents complete, extract content from XML responses:

  **OUTPUT_A** = content within <output-a> tags (text string)
  **OUTPUT_B** = content within <output-b> tags (text string)
  **STATUS_A** = <status> value from first <execution-result>
  **STATUS_B** = <status> value from second <execution-result>
  **TIME_A** = <execution-time> value from first response
  **TIME_B** = <execution-time> value from second response
  **ERRORS_A** = <errors> content from first response
  **ERRORS_B** = <errors> content from second response

Note: These are content variables (strings), not shell variables

### Stage 3.6a: Output Validation

VALIDATE captured outputs to ensure they are verbatim:
  - Check OUTPUT_A and OUTPUT_B contain actual prompt output, not descriptions
  - Verify outputs are not wrapped in explanatory text like "[Comprehensive output...]"
  - Ensure no summarization has occurred - outputs must be character-for-character exact
  - If outputs appear to be descriptions rather than actual content, FAIL validation

**AGGRESSIVE ANTI-SUMMARIZATION VALIDATION**:

Define FORBIDDEN_PATTERNS:
```
FORBIDDEN_PATTERNS = [
  "\[comprehensive", "\[detailed", "\[extensive",
  "\[research", "\[analysis", "\[output",
  "~[0-9]+ characters", "~[0-9]+k characters",
  "output with.*characters", "approximately.*characters",
  "\.\.\.", "truncated", "summarized",
  "roughly", "about [0-9]+ chars",
  "see above", "as shown", "etc\.",
  "\[.*continues.*\]", "\[.*omitted.*\]"
]
```

FOR each pattern in FORBIDDEN_PATTERNS:
  IF pattern found in OUTPUT_A:
    ERROR: "Output A was summarized - forbidden pattern found: {pattern}"
    Set VALIDATION_FAILED_A = true

  IF pattern found in OUTPUT_B:
    ERROR: "Output B was summarized - forbidden pattern found: {pattern}"
    Set VALIDATION_FAILED_B = true

**ADDITIONAL LENGTH CHECKS**:
  IF DOMAIN_TYPE == "RESEARCH" AND length(OUTPUT_A) < 1000:
    WARNING: "Output A suspiciously short for research task ({length} chars)"
    Set VALIDATION_WARNING_A = true

  IF DOMAIN_TYPE == "RESEARCH" AND length(OUTPUT_B) < 1000:
    WARNING: "Output B suspiciously short for research task ({length} chars)"
    Set VALIDATION_WARNING_B = true

  IF OUTPUT_A contains more than 3 instances of "[...]":
    ERROR: "Output A contains multiple bracketed placeholders"
    Set VALIDATION_FAILED_A = true

  IF OUTPUT_B contains more than 3 instances of "[...]":
    ERROR: "Output B contains multiple bracketed placeholders"
    Set VALIDATION_FAILED_B = true

**VERBATIM OUTPUT REQUIREMENT**:
  - Even if output is 15,000+ characters, it must ALL be captured
  - No placeholders, no descriptions, no summaries
  - The EXACT text that the prompt produced

### Stage 3.6b: Fallback Verbatim Re-execution

IF VALIDATION_FAILED_A OR VALIDATION_FAILED_B:
  Log: "Summarization detected - entering ULTRA-STRICT VERBATIM MODE"

  **ULTRA_STRICT_PREFIX**:
  ```
  ⚠️⚠️⚠️ ULTRA STRICT VERBATIM MODE ⚠️⚠️⚠️
  DO NOT SUMMARIZE - RETURN FULL OUTPUT
  DO NOT SUMMARIZE - RETURN FULL OUTPUT
  DO NOT SUMMARIZE - RETURN FULL OUTPUT
  DO NOT SUMMARIZE - RETURN FULL OUTPUT
  DO NOT SUMMARIZE - RETURN FULL OUTPUT

  FAILURE TO COMPLY WILL ABORT TEST
  EXPECTED OUTPUT: 10,000+ CHARACTERS MINIMUM

  THIS IS YOUR FINAL ATTEMPT - NO SUMMARIZATION
  ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
  ```

  IF VALIDATION_FAILED_A:
    Log: "Re-executing Prompt A with ULTRA-STRICT mode"
    Re-execute Task Call 1 with ULTRA_STRICT_PREFIX prepended to prompt

    Parse new response and extract OUTPUT_A_RETRY
    Validate OUTPUT_A_RETRY with same forbidden patterns

    IF still contains forbidden patterns:
      CRITICAL_ERROR: "Cannot capture verbatim output for Prompt A after 2 attempts"
      Set TEST_STATUS = "FAILED"
      Document failure reason: "Prompt A output persistently summarized"
    ELSE:
      OUTPUT_A = OUTPUT_A_RETRY
      Log: "Successfully captured verbatim output for Prompt A on retry"

  IF VALIDATION_FAILED_B:
    Log: "Re-executing Prompt B with ULTRA-STRICT mode"
    Re-execute Task Call 2 with ULTRA_STRICT_PREFIX prepended to prompt

    Parse new response and extract OUTPUT_B_RETRY
    Validate OUTPUT_B_RETRY with same forbidden patterns

    IF still contains forbidden patterns:
      CRITICAL_ERROR: "Cannot capture verbatim output for Prompt B after 2 attempts"
      Set TEST_STATUS = "FAILED"
      Document failure reason: "Prompt B output persistently summarized"
    ELSE:
      OUTPUT_B = OUTPUT_B_RETRY
      Log: "Successfully captured verbatim output for Prompt B on retry"

  IF TEST_STATUS == "FAILED":
    ABORT test with comprehensive error report:
    - Which prompts failed verbatim capture
    - What patterns were detected
    - Recommendation: Manual execution may be required

### Stage 3.7: Quality Check

FOR iteration FROM 1 TO maximum of 25:
  EVALUATE execution quality:
    - Were both prompts executed successfully? [Pass/Fail]
    - Are outputs captured completely without truncation? [Pass/Fail]
    - Is timing data accurate and meaningful? [Pass/Fail]
    - Were errors properly documented and categorized? [Pass/Fail]

  IF all checks pass:
    Break from iteration loop
  ELSE:
    Identify execution issue and retry if possible

### Stage 3.8: Create Execution Report

Document comprehensive execution metadata:
  **EXECUTION_SUMMARY**:
    - Execution ID: <EXECUTION_ID>
    - Total parallel execution time: <TOTAL_EXECUTION_TIME> milliseconds
    - Prompt A estimated time: <EXECUTION_TIME_A> ms (parallel)
    - Prompt B estimated time: <EXECUTION_TIME_B> ms (parallel)
    - Prompt A output size: [character count of OUTPUT_A]
    - Prompt B output size: [character count of OUTPUT_B]
    - Prompt A retry attempts: [A_RETRY_COUNT]
    - Prompt B retry attempts: [B_RETRY_COUNT]
    - Prompt A status: [SUCCESS/FAILED/PARTIAL]
    - Prompt B status: [SUCCESS/FAILED/PARTIAL]
    - Start timestamp: <START_TIME>
    - End timestamp: <END_TIME>

### Stage 3.9: Phase Completion

Mark Phase 3 complete with all required outputs:
  - **OUTPUT_A**: Complete output from first prompt execution (extracted from <output-a> tags)
  - **OUTPUT_B**: Complete output from second prompt execution (extracted from <output-b> tags)
  - **EXECUTION_METADATA**: Timing, status, and error information (from <execution-result> structure)
  - **RETRY_COUNTS**: Number of retry attempts for each prompt (from <retry-count> tags)
  - **EXECUTION_STATUS**: Overall success/failure status (from <status> tags)

Note: These are in-memory content variables (text strings), not shell variables or files.
The only file is the temp file for Prompt B's git version.

**Variable Clarification**:
- Angle-bracket variables like `<PROMPT_A_PATH>` are placeholders replaced with actual values
- Variables like `OUTPUT_A` and `OUTPUT_B` are content strings extracted from XML
- The framework operates on labeled content, not file I/O for outputs

  <result>Both prompts executed in parallel in $TOTAL_DURATION seconds</result>
  <learning>Parallel execution ensures fair comparison and captures timing differences</learning>
```

## Phase 4: Comparative Analysis with Iterative Refinement

```markdown
**PHASE_4_PURPOSE**: Score outputs against criteria with iterative refinement for accuracy

<thinking>
INTENTION: Score both outputs against criteria, refining scores through iteration if needed
ACTION: Evaluate each criterion, calculate confidence, iterate if confidence is low
</thinking>

### Stage 4.1: Input Extraction

WHEN <worktree> is not provided:
  Set <worktree>$(pwd)</worktree>

EXTRACT from previous Phase 3 outputs:
  **OUTPUT_A**: Complete output from first prompt execution (from <output-a> tags)
  **OUTPUT_B**: Complete output from second prompt execution (from <output-b> tags)
  **EXECUTION_METADATA**: Timing, status, and error information (from <execution-result> structure)
  **ADAPTED_CRITERIA**: Domain-specific weighted evaluation criteria
  **DOMAIN_TYPE**: Detected primary domain classification

PREPARE analysis environment:
  **ANALYSIS_ID**: comparative-analysis-$(date +%Y%m%d-%H%M%S)
  **ITERATION_LIMIT**: 5 (maximum scoring iterations)

### Stage 4.1b: Post-Execution Criteria Discovery

<thinking>
INTENTION: Analyze actual outputs to discover context-specific evaluation criteria
ACTION: Examine output patterns, structures, and characteristics to enhance criteria
</thinking>

DISCOVER additional criteria from actual OUTPUT_A and OUTPUT_B content:

**OUTPUT_STRUCTURE_ANALYSIS**:
  EXAMINE both outputs for structural patterns:
    - Contains comparison tables: ADD "Data Organization" criterion
    - Contains code samples: ADD "Code Practicality" criterion
    - Contains numbered lists: ADD "Information Structure" criterion
    - Contains citations/sources: ADD "Research Depth" criterion
    - Contains examples: ADD "Example Quality" criterion
    - Contains diagrams/visuals: ADD "Visual Communication" criterion
    - Contains step-by-step instructions: ADD "Actionability" criterion

**CONTENT_CHARACTERISTIC_ANALYSIS**:
  ANALYZE output characteristics:
    - Technical depth level (surface vs deep-dive)
    - Practical applicability (theoretical vs actionable)
    - Evidence quality (unsupported vs well-sourced)
    - Innovation level (standard vs creative approaches)
    - Comprehensiveness (focused vs broad coverage)

**EMERGENT_CRITERIA_GENERATION**:
  GENERATE context-specific criteria based on discoveries:

    IF both outputs contain comparison tables:
      **DATA_ORGANIZATION** (weight: 15%):
        - Table clarity and readability [0-10]
        - Data accuracy and completeness [0-10]
        - Visual organization effectiveness [0-10]

    IF both outputs contain code samples:
      **CODE_PRACTICALITY** (weight: 20%):
        - Code correctness and syntax [0-10]
        - Real-world applicability [0-10]
        - Code clarity and documentation [0-10]

    IF both outputs cite sources/research:
      **RESEARCH_DEPTH** (weight: 15%):
        - Source quality and credibility [0-10]
        - Research comprehensiveness [0-10]
        - Citation accuracy and relevance [0-10]

    IF both outputs provide step-by-step guidance:
      **ACTIONABILITY** (weight: 18%):
        - Step clarity and precision [0-10]
        - Implementation feasibility [0-10]
        - Completeness of guidance [0-10]

    IF both outputs use creative/innovative approaches:
      **INNOVATION** (weight: 12%):
        - Originality of approach [0-10]
        - Creative problem-solving [0-10]
        - Novel insight generation [0-10]

**CRITERIA_INTEGRATION_STRATEGY**:
  BLEND discovered criteria with original 5 criteria:

    WEIGHT_DISTRIBUTION_APPROACH:
      - Original 5 criteria: 60% of total weight
      - Discovered criteria: 40% of total weight
      - Maintain 100% total weight allocation

    REBALANCING_METHOD:
      FOR each original criterion:
        adjusted_weight = original_weight * 0.60

      FOR each discovered criterion:
        new_weight = (40% total) / number_of_discovered_criteria

      VERIFY total equals 100%
      ENSURE no criterion exceeds 25% (prevent single-criterion dominance)
      ENSURE no criterion falls below 8% (maintain meaningful impact)

**ENHANCED_CRITERIA_FRAMEWORK**:
  CREATE final evaluation framework combining:
    - Original domain-adapted weights (60% allocation)
    - Argument-aware adjustments (applied to original criteria)
    - Discovered context-specific criteria (40% allocation)
    - Post-execution weight calibration (applied after output analysis)

### Stage 4.2: Criteria Definition (Runtime)

GENERATE runtime criteria for Phase 4:
  **SUCCESS_CRITERIA**:
    - All 5 criteria must be scored for both outputs
    - Confidence level must be calculated based on margin and variance
    - Iterative refinement must be applied until confidence is acceptable

  **ANTI_CRITERIA**:
    - Must not show bias toward either prompt
    - Must not use arbitrary or unmeasurable scoring
    - Must not stop iterations if confidence remains low (up to limit)

### Stage 4.3: Research & Discovery

RESEARCH optimal scoring methodologies:
  Analyze output characteristics:
    - Identify measurable quality indicators for each criterion
    - Research confidence calculation approaches
    - Discover bias reduction techniques in comparative evaluation

INVESTIGATE iterative refinement patterns:
  Research scoring iteration strategies:
    - When to refine vs when to accept current scores
    - How variance and margin indicate scoring reliability
    - Best practices for granularity adjustment in iterations

### Stage 4.4: Planning

PLAN the comparative analysis strategy:
  **SCORING_APPROACH**:
    Apply domain-adapted weights to 5 core criteria
    Use 0-10 scale for each sub-component
    Calculate weighted averages for final criterion scores

  **ITERATION_STRATEGY**:
    Start with initial scoring pass
    Calculate confidence based on margin and variance
    Refine granularity if confidence is low (<5 iterations max)

  **CONFIDENCE_CALCULATION**:
    Use margin size and score variance to determine reliability
    High confidence: margin ≥20 AND variance <2
    Medium confidence: margin ≥10 OR variance <3
    Low confidence: otherwise

### Stage 4.5: Review

VALIDATE analysis plan before execution:
  - Verify all criteria weights sum to 100%
  - Confirm scoring scales are consistent and measurable
  - Check that confidence calculation logic is sound
  - Ensure iteration limit prevents infinite loops

### Stage 4.6: Execution

EXECUTE the validated comparative analysis plan:

FOR iteration FROM 1 TO maximum of 5:

  <thinking>
  INTENTION: Score outputs in iteration $iteration to refine accuracy
  ACTION: Evaluate all criteria, assess confidence, decide if more iterations needed
  </thinking>

  EVALUATE OUTPUT_COMPLETENESS (adapted weight):

    For OUTPUT_A:
      Check: All TEST_ARGUMENTS addressed? [0-10]
      Check: Deliverables present? [0-10]
      Check: Self-contained response? [0-10]
      SCORE_A_COMPLETENESS = average * adapted_weight

    For OUTPUT_B:
      Check: All TEST_ARGUMENTS addressed? [0-10]
      Check: Deliverables present? [0-10]
      Check: Self-contained response? [0-10]
      SCORE_B_COMPLETENESS = average * adapted_weight

  EVALUATE EXECUTION_QUALITY (adapted weight):

    For OUTPUT_A:
      Assess: Structure clarity [0-10]
      Assess: Detail appropriateness [0-10]
      Assess: Logical flow [0-10]
      SCORE_A_QUALITY = average * adapted_weight

    For OUTPUT_B:
      [Same assessment process]
      SCORE_B_QUALITY = average * adapted_weight

  EVALUATE PROCESSING_EFFICIENCY (adapted weight):

    For OUTPUT_A:
      Consider: Execution speed (<EXECUTION_TIME_A> ms) [0-10]
      Consider: Prompt brevity (<PROMPT_A_SIZE> chars, <PROMPT_A_LINES> lines) [0-10]
      Consider: Output efficiency (value-to-verbosity ratio) [0-10]
      Consider: Output conciseness vs completeness [0-10]
      SCORE_A_EFFICIENCY = average * adapted_weight

    For OUTPUT_B:
      Consider: Execution speed (<EXECUTION_TIME_B> ms) [0-10]
      Consider: Prompt brevity (<PROMPT_B_SIZE> chars, <PROMPT_B_LINES> lines) [0-10]
      Consider: Output efficiency (value-to-verbosity ratio) [0-10]
      Consider: Output conciseness vs completeness [0-10]
      SCORE_B_EFFICIENCY = average * adapted_weight

  EVALUATE ERROR_HANDLING (adapted weight):

    For OUTPUT_A:
      Check: Edge case consideration [0-10]
      Check: Error message clarity [0-10]
      Check: Recovery strategies [0-10]
      SCORE_A_ERROR = average * adapted_weight

    For OUTPUT_B:
      [Same evaluation process]
      SCORE_B_ERROR = average * adapted_weight

  EVALUATE OUTPUT_USABILITY (adapted weight):

    For OUTPUT_A:
      Assess: End-user clarity [0-10]
      Assess: Actionability of output [0-10]
      Assess: Format appropriateness [0-10]
      SCORE_A_USABILITY = average * adapted_weight

    For OUTPUT_B:
      [Same assessment process]
      SCORE_B_USABILITY = average * adapted_weight

  APPLY output-driven weight calibration:

    <thinking>
    INTENTION: Recalibrate weights based on actual output characteristics discovered during scoring
    ACTION: Analyze output relationships and adjust weights to better reflect what was actually produced
    </thinking>

    **OUTPUT_CHARACTERISTICS_ANALYSIS**:
      CALCULATE output metrics:
        LENGTH_RATIO = length(OUTPUT_B) / length(OUTPUT_A)
        STRUCTURE_SIMILARITY = similarity_score(structure_A, structure_B) [0-1]
        APPROACH_DIFFERENCE = approach_variance_score [0-1]

    **CALIBRATION_ADJUSTMENTS**:

      EXTREME_LENGTH_DIFFERENCES:
        IF LENGTH_RATIO > 3.0 OR LENGTH_RATIO < 0.33:  # One output 3x longer/shorter
          Reduce EFFICIENCY weight to 2% (extreme length differences make efficiency less meaningful)
          Increase COMPLETENESS weight by +12%
          Increase QUALITY weight by +8%
          Log: "Extreme length difference detected - prioritizing content over efficiency"

      HIGHLY_SIMILAR_STRUCTURES:
        IF STRUCTURE_SIMILARITY > 0.8:  # Very similar output structures
          Increase QUALITY weight by +15% (focus on subtle quality differences)
          Increase USABILITY weight by +10% (focus on presentation and clarity)
          Reduce COMPLETENESS weight by -5% (both likely complete if structures similar)
          Log: "Similar structures detected - focusing on quality and presentation differences"

      FUNDAMENTALLY_DIFFERENT_APPROACHES:
        IF APPROACH_DIFFERENCE > 0.7:  # Completely different approaches
          Add temporary "APPROACH_INNOVATION" criterion (weight: 15%)
          Reduce all original criteria weights proportionally by 15%
          Log: "Different approaches detected - adding innovation assessment"

      MISSING_EXPECTED_ELEMENTS:
        IF neither output contains expected elements from TEST_ARGUMENTS:
          Increase ERROR_HANDLING weight by +20%
          Reduce COMPLETENESS weight by -10%
          Log: "Both outputs missing expected elements - prioritizing error handling"

      CODE_QUALITY_FOCUS:
        IF both outputs contain code AND code quality varies significantly:
          Add temporary "CODE_PRACTICALITY" criterion (weight: 18%)
          Reduce EFFICIENCY weight by -3%
          Reduce other criteria proportionally
          Log: "Significant code quality differences - adding code assessment"

      RESEARCH_DEPTH_FOCUS:
        IF both outputs contain research AND depth varies significantly:
          Add temporary "RESEARCH_DEPTH" criterion (weight: 16%)
          Increase QUALITY weight by +8%
          Reduce EFFICIENCY weight by -4%
          Log: "Research depth differences - enhancing quality assessment"

    **WEIGHT_REBALANCING_AFTER_CALIBRATION**:
      ENSURE total weights = 100%:
        total_weight = sum(all_adjusted_weights)
        IF total_weight != 100:
          normalization_factor = 100 / total_weight
          FOR each criterion:
            final_weight = adjusted_weight * normalization_factor

      APPLY minimum/maximum constraints:
        ENSURE no criterion < 2% (maintain minimal impact)
        ENSURE no criterion > 30% (prevent over-dominance)
        ENSURE core criteria maintain minimum thresholds:
          - Completeness: minimum 15%
          - Quality: minimum 15%
          - At least 3 criteria must be >= 10%

      LOG final calibrated weights for transparency

  COMPUTE total scores using calibrated weights:
    **TOTAL_SCORE_A** = sum of all weighted scores for A
    **TOTAL_SCORE_B** = sum of all weighted scores for B

    **WINNER** = higher score
    **MARGIN** = absolute difference

    CALCULATE confidence level:
      **SCORE_VARIANCE** = variance between criterion scores
      **MARGIN_RATIO** = MARGIN / 100

      IF MARGIN >= 20 AND SCORE_VARIANCE < 2:
        **CONFIDENCE**: HIGH (clear winner)
      ELIF MARGIN >= 10 OR SCORE_VARIANCE < 3:
        **CONFIDENCE**: MEDIUM (probable winner)
      ELSE:
        **CONFIDENCE**: LOW (close competition)

        # TIE-BREAKING LOGIC: When margin is <5 points, use efficiency as tiebreaker
        IF MARGIN < 5:
          <thinking>
          INTENTION: Scores are too close - using efficiency metrics as tiebreaker
          ACTION: Compare execution speed and prompt brevity to determine winner
          </thinking>

          COMPARE efficiency metrics directly:
            Speed difference: <EXECUTION_TIME_A> vs <EXECUTION_TIME_B> ms
            Brevity difference: <PROMPT_A_SIZE> vs <PROMPT_B_SIZE> characters

          IF speed difference > 20% OR brevity difference > 30%:
            Adjust WINNER based on efficiency advantage
            Note in report: "Efficiency was the deciding factor"
            Set **TIE_BROKEN_BY**: "efficiency metrics"

    IF CONFIDENCE == LOW AND iteration < 5:
      <learning>Low confidence detected, refining scores in next iteration</learning>
      Adjust scoring granularity
      Continue to next iteration
    ELSE:
      <result>Scoring complete with $CONFIDENCE confidence after $iteration iterations</result>
      Break from iteration loop

### Stage 4.7: Quality Check

FOR final_check FROM 1 TO maximum of 25:
  EVALUATE scoring quality:
    - Were all 5 criteria scored for both outputs? [Pass/Fail]
    - Do all weighted scores contribute to totals correctly? [Pass/Fail]
    - Is confidence calculation mathematically sound? [Pass/Fail]
    - Are scoring rationales clear and defendable? [Pass/Fail]

  IF all checks pass:
    Break from iteration loop
  ELSE:
    Identify scoring issue and correct if possible

### Stage 4.8: Create Comparative Analysis Report

Generate comprehensive comparison output:

## Side-by-Side Output Diff

Create visual comparison of key differences:

```diff
PROMPT A OUTPUT:
================
[First 500 chars of OUTPUT_A]
...

PROMPT B OUTPUT:
================
[First 500 chars of OUTPUT_B]
...

KEY DIFFERENCES:
- Prompt A: [unique aspect]
- Prompt B: [unique aspect]
+ Common: [shared strength]
```

## Detailed Scoring Breakdown

| Criterion | Weight | Prompt A | Prompt B | Winner | Margin |
|-----------|--------|----------|----------|--------|--------|
| Output Completeness | [ADAPTED_COMPLETENESS_WEIGHT]% | [SCORE_A_COMPLETENESS] | [SCORE_B_COMPLETENESS] | [COMPLETENESS_WINNER] | [COMPLETENESS_MARGIN] |
| Execution Quality | [ADAPTED_QUALITY_WEIGHT]% | [SCORE_A_QUALITY] | [SCORE_B_QUALITY] | [QUALITY_WINNER] | [QUALITY_MARGIN] |
| Processing Efficiency | [ADAPTED_EFFICIENCY_WEIGHT]% | [SCORE_A_EFFICIENCY] | [SCORE_B_EFFICIENCY] | [EFFICIENCY_WINNER] | [EFFICIENCY_MARGIN] |
| Error Handling | [ADAPTED_ERROR_WEIGHT]% | [SCORE_A_ERROR] | [SCORE_B_ERROR] | [ERROR_WINNER] | [ERROR_MARGIN] |
| Output Usability | [ADAPTED_USABILITY_WEIGHT]% | [SCORE_A_USABILITY] | [SCORE_B_USABILITY] | [USABILITY_WINNER] | [USABILITY_MARGIN] |
| **TOTAL** | 100% | [TOTAL_SCORE_A] | [TOTAL_SCORE_B] | **[WINNER]** | **[MARGIN]** |

### Stage 4.9: Runtime Recommendations Generator

<thinking>
INTENTION: Analyze scoring patterns to generate specific, actionable improvements for the winning prompt
ACTION: Examine weakest areas, identify transferable strengths, create targeted enhancements
RESULT: 3 runtime-calculated recommendations to improve the winning prompt
</thinking>

ANALYZE scoring patterns for improvement opportunities:
  **WEAKNESS_ANALYSIS**: Identify the winning prompt's lowest-scoring criterion and specific deficit
  **STRENGTH_TRANSFER**: Find techniques from the losing prompt that could enhance the winner
  **OUTPUT_ANALYSIS**: Examine both outputs for format, depth, breadth, and insight opportunities

GENERATE three specific recommendations based on scoring data:

**RECOMMENDATION_1** (Target: Weakest scoring criterion):
  - **DEFICIT**: [Specific weakness identified in lowest-scoring area]
  - **ENHANCEMENT**: [Concrete prompt modification to address this weakness]
  - **RATIONALE**: [Why this change would improve the score in this criterion]

**RECOMMENDATION_2** (Target: Strength transfer):
  - **OPPORTUNITY**: [Technique from losing prompt that could be adapted]
  - **INTEGRATION**: [How to incorporate this strength without losing winner's advantages]
  - **EXPECTED_BENEFIT**: [Which criteria would improve from this change]

**RECOMMENDATION_3** (Target: Output optimization):
  - **OUTPUT_GAP**: [Specific improvement in breadth/depth/format/insights]
  - **PROMPT_ADJUSTMENT**: [Exact modification to achieve better output quality]
  - **IMPACT_PREDICTION**: [Expected score improvements across multiple criteria]

EXPLAIN victory with evidence:
**WHY_WINNER_WON**:
  - **PRIMARY_ADVANTAGE**: [Main factor that secured victory with specific score evidence]
  - **SECONDARY_STRENGTHS**: [2-3 supporting factors with quantified margins]
  - **DECISIVE_CRITERIA**: [Which scoring areas made the difference]
  - **EXECUTION_FACTOR**: [How timing/efficiency contributed to the win]

<result>Generated 3 targeted recommendations for [WINNER] based on scoring analysis</result>
<learning>Runtime recommendation generation creates actionable improvements from comparative scoring data</learning>

### Stage 4.10: Phase Completion

Mark Phase 4 complete with all required outputs:
  - **TOTAL_SCORE_A**: Final weighted score for first prompt
  - **TOTAL_SCORE_B**: Final weighted score for second prompt
  - **WINNER**: Prompt with higher total score ("Prompt A" or "Prompt B")
  - **MARGIN**: Point difference between total scores
  - **CONFIDENCE**: Reliability level of comparison results
  - **SCORING_BREAKDOWN**: Detailed scores by criterion

  <result>Scoring complete with <CONFIDENCE> confidence after <iteration> iterations</result>
  <learning>Iterative refinement improves scoring accuracy and confidence assessment</learning>

IDENTIFY scoring patterns for recommendations:
  **HIGHEST_SCORING_CRITERION_A**: The criterion where Prompt A scored best
  **LOWEST_SCORING_CRITERION_B**: The criterion where Prompt B scored worst
  **LARGEST_MARGIN_CRITERION**: The criterion with biggest point difference
  **WINNING_TECHNIQUES**: Specific patterns that contributed to winner's success

These scoring results and patterns feed into Phase 5 recommendations.
```

## Phase 5: Recommendations and Synthesis

```markdown
**PHASE_5_PURPOSE**: Generate actionable recommendations and cleanup

<thinking>
INTENTION: Synthesize all analysis results into actionable recommendations and final report
ACTION: Create comprehensive report, identify improvements, capture learnings, cleanup environment
</thinking>

### Stage 5.1: Input Extraction

WHEN <worktree> is not provided:
  Set <worktree>$(pwd)</worktree>

EXTRACT from previous Phase outputs:
  From Phase 3:
    **OUTPUT_A**: Complete output from Prompt A execution
    **OUTPUT_B**: Complete output from Prompt B execution

  From Phase 4:
    **TOTAL_SCORE_A**: Final weighted score for first prompt
    **TOTAL_SCORE_B**: Final weighted score for second prompt
    **WINNER**: Prompt with higher total score
    **MARGIN**: Point difference between total scores
    **CONFIDENCE**: Reliability level of comparison results
    **SCORING_BREAKDOWN**: Detailed scores by criterion

PREPARE synthesis environment:
  **REPORT_ID**: synthesis-report-$(date +%Y%m%d-%H%M%S)
  **CLEANUP_REQUIRED**: Check if temporary files need removal

### Stage 5.2: Criteria Definition (Runtime)

GENERATE runtime criteria for Phase 5:
  **SUCCESS_CRITERIA**:
    - Final report must be comprehensive and actionable
    - Recommendations must be specific and implementable
    - Learning patterns must be captured for future reference
    - All temporary resources must be properly cleaned up

  **ANTI_CRITERIA**:
    - Must not provide generic or vague recommendations
    - Must not leave temporary files or resources behind
    - Must not omit critical insights from the analysis

### Stage 5.3: Research & Discovery

RESEARCH optimal recommendation strategies:
  Analyze scoring patterns:
    - Identify which criteria most influenced the winning outcome
    - Research improvement opportunities for the losing prompt
    - Discover transferable best practices from the winner

INVESTIGATE learning capture approaches:
  Research knowledge accumulation patterns:
    - What domain insights are most valuable for future tests?
    - How can scoring patterns inform future criteria weighting?
    - Which testing methodologies proved most effective?

### Stage 5.4: Planning

PLAN the synthesis and recommendation strategy:
  **REPORT_STRUCTURE**:
    Executive summary with clear winner and rationale
    Detailed comparison showing strengths and weaknesses
    Specific improvement suggestions for both prompts
    Learning accumulation for future A/B tests

  **RECOMMENDATION_APPROACH**:
    Focus on actionable, specific suggestions
    Base recommendations on scoring evidence
    Include both short-term fixes and long-term improvements

  **CLEANUP_STRATEGY**:
    Remove all temporary files and directories
    Preserve valuable insights in final output
    Ensure no resource leaks or leftover processes

### Stage 5.5: Review

VALIDATE synthesis plan before execution:
  - Verify all scoring data is available and consistent
  - Confirm recommendations will be actionable and specific
  - Check that cleanup procedures are comprehensive
  - Ensure learning capture covers all valuable insights

### Stage 5.6: Execution

EXECUTE the validated synthesis plan:

## A/B Test Results: <PROMPT_A_NAME> vs <PROMPT_B_NAME>

### Test Configuration
- **Test ID**: <TEST_ID>
- **Timestamp**: <TIMESTAMP>
- **Test Arguments**: <TEST_ARGUMENTS>
- **Prompt A Path**: <PROMPT_A_PATH>
- **Prompt B Path**: <PROMPT_B_PATH>
- **Prompt B Source**: <PROMPT_B_LABEL>

### Performance Metrics
- **Prompt A**: <PROMPT_A_LINES> lines, <PROMPT_A_SIZE> characters, ~<EXECUTION_TIME_A> ms execution
- **Prompt B**: <PROMPT_B_LINES> lines, <PROMPT_B_SIZE> characters, ~<EXECUTION_TIME_B> ms execution
- **Total Test Duration**: <TOTAL_EXECUTION_TIME> ms (parallel execution)

### Prompt Outputs Comparison

**CRITICAL**: Display the EXACT, VERBATIM outputs captured from Phase 3
- Do NOT summarize or describe - show the actual output text
- If output is very long (15,000+ characters), still show it in FULL
- These must be the exact characters produced by each prompt

#### Prompt A Output
```
<OUTPUT_A>
```
*Output characteristics: [length of OUTPUT_A] characters, [line count of OUTPUT_A] lines*

#### Prompt B Output
```
<OUTPUT_B>
```
*Output characteristics: [length of OUTPUT_B] characters, [line count of OUTPUT_B] lines*

Note: If outputs appear as descriptions like "[Comprehensive research output...]" rather than
actual content, the test has failed to capture verbatim output and must be re-run.

### Scoring Summary
*Domain: <DOMAIN_TYPE>* | *Secondary: <SECONDARY_DOMAIN>* | *Confidence: <DOMAIN_CONFIDENCE>%*

| Criterion | Weight | Prompt A | Prompt B | Winner |
|-----------|--------|----------|----------|--------|
| Output Completeness | <ADAPTED_COMPLETENESS_WEIGHT>% | <SCORE_A_COMPLETENESS> | <SCORE_B_COMPLETENESS> | <COMPLETENESS_WINNER> |
| Execution Quality | <ADAPTED_QUALITY_WEIGHT>% | <SCORE_A_QUALITY> | <SCORE_B_QUALITY> | <QUALITY_WINNER> |
| Processing Efficiency | <ADAPTED_EFFICIENCY_WEIGHT>% | <SCORE_A_EFFICIENCY> | <SCORE_B_EFFICIENCY> | <EFFICIENCY_WINNER> |
| Error Handling | <ADAPTED_ERROR_WEIGHT>% | <SCORE_A_ERROR> | <SCORE_B_ERROR> | <ERROR_WINNER> |
| Output Usability | <ADAPTED_USABILITY_WEIGHT>% | <SCORE_A_USABILITY> | <SCORE_B_USABILITY> | <USABILITY_WINNER> |
| **TOTAL** | 100% | <TOTAL_A> | <TOTAL_B> | **<WINNER>** |

#### Prompt A Strengths
- [Specific strength with example from output]
- [Another strength with evidence]

#### Prompt B Strengths
- [Specific strength with example from output]
- [Another strength with evidence]

#### Common Weaknesses
- [Weakness observed in both]
- [Improvement opportunity for both]

#### Adaptive Recommendations Based on Competition Outcome

ANALYZE the scoring results to determine recommendation strategy:

Using <WINNER>, <MARGIN>, and <CONFIDENCE> from Phase 4 scoring:

WHEN <WINNER> == "Prompt A":

  **Understanding Prompt A's Victory**:
  IDENTIFY the key differentiators by examining:
    - Which criteria gave A the largest scoring advantages
    - Specific patterns in A's output that resonated with the domain
    - Structural elements that enabled A's superior performance

  **Evolving Prompt B for Competitive Parity**:
  EXTRACT successful patterns from Prompt A's implementation:
    - Observe how A structures its <HIGHEST_SCORING_CRITERION_A>
    - Note A's approach to achieving <LARGEST_MARGIN_CRITERION> advantage
    - Understand why A's <WINNING_TECHNIQUES> proved effective

  SYNTHESIZE improvements for Prompt B:
    Focus on B's lowest-scoring criterion: <LOWEST_SCORING_CRITERION_B>
      → Adapt A's approach while maintaining B's unique strengths
      → Implement specific enhancement based on A's success pattern

    Address B's performance gap in <LARGEST_MARGIN_CRITERION>:
      → Study how A handles this aspect differently
      → Incorporate A's winning technique

    Quick wins available to B:
      → [IMMEDIATE_CHANGE] that directly addresses the gap
      → [LOW_EFFORT_FIX] that yields high impact

WHEN <WINNER> == "Prompt B":

  **Deconstructing Prompt B's Success**:
  EXAMINE what made B exceptional:
    - Revolutionary patterns that outperformed traditional approaches
    - Innovative techniques absent from A's implementation
    - Domain-specific optimizations that resonated with the test case

  **Preserving and Propagating B's Innovations**:
  DOCUMENT the winning strategies:
    - Capture B's approach to <LARGEST_MARGIN_CRITERION> for future prompts
    - Codify B's handling of <WINNING_TECHNIQUES> as best practice
    - Recognize B's breakthrough that enabled the victory

  **Continuous Improvement Path for B**:
  IDENTIFY remaining optimization opportunities:
    Despite winning, B could still enhance its weakest area:
      → Consider refinement in areas where margin was smallest

    Polish B's approach where A showed competitive strength:
      → Learn from A's techniques even in defeat

WHEN <MARGIN> < 5 (statistical tie):

  **Understanding the Equivalence**:
  RECOGNIZE that both prompts offer valid approaches:
    - Different philosophies achieving similar outcomes
    - Complementary strengths offsetting respective weaknesses
    - Context-dependent advantages based on use case

  **Specialization Opportunities**:
  RECOMMEND domain-specific differentiation:
    For [USE_CASE_TYPE_1] scenarios:
      → Enhance Prompt A with [SPECIALIZATION_1]

    For [USE_CASE_TYPE_2] scenarios:
      → Optimize Prompt B with [SPECIALIZATION_2]

#### Competition Fairness Assessment

EVALUATE the testing conditions for equity:

CONSIDER version synchronization:
  When comparing current version against git history:
    - Account for recency of changes and evolution
    - Assess whether both versions target same requirements
    - Determine if re-testing with synchronized versions would be valuable

EXAMINE domain alignment:
  Verify both prompts were designed for:
    - Same problem space
    - Similar complexity levels
    - Compatible output expectations

#### Final Recommendation Synthesis

DECLARE the competition outcome with appropriate confidence:

Based on <MARGIN> point differential and <CONFIDENCE> confidence level:

WHEN <MARGIN> > 20:
  "**Decisive Victory**: <WINNER> demonstrates clear superiority across multiple dimensions.
   Immediate adoption recommended for <DOMAIN_TYPE> tasks.
   The <MARGIN>-point gap indicates fundamental advantages that transcend test variations."

WHEN <MARGIN> between 10-20:
  "**Clear Advantage**: <WINNER> consistently outperforms in key criteria.
   Recommended for production use while incorporating suggested improvements.
   The moderate gap suggests reliable but not insurmountable advantages."

WHEN <MARGIN> < 10:
  "**Marginal Preference**: <WINNER> edges ahead but advantages are contextual.
   Consider test case variations before final adoption.
   Both prompts remain viable with different strengths."

WHEN TIE_BROKEN_BY == "efficiency metrics":
  "**Tie Resolved by Efficiency**: Quality scores were virtually identical.
   <WINNER> selected based on superior execution speed and/or prompt brevity.
   Both prompts deliver comparable quality output."

### Recommended Actions

SYNTHESIZE specific numbered recommendations based on test results:

#### Priority Actions (3-5 items based on context)

WHEN <WINNER> == "Prompt A" AND <MARGIN> > 10:
  1. **[Critical] Deploy Prompt A Immediately**:
     → Use Prompt A for all <DOMAIN_TYPE> tasks in production
     → Monitor performance metrics for validation

  2. **[High] Enhance Prompt B's <LOWEST_SCORING_CRITERION_B>**:
     → Adapt A's approach: [specific technique from A]
     → Target improvement: +[expected points] in this criterion

  3. **[High] Capture A's Winning Patterns**:
     → Document A's <WINNING_TECHNIQUES> as best practice
     → Create template from A's structure for future prompts

  4. **[Medium] Optimize B for Specialized Cases**:
     → Identify scenarios where B's approach might excel
     → Test B with alternative argument patterns

  5. **[Medium] Cross-Pollinate Strengths**:
     → Merge A's <HIGHEST_SCORING_CRITERION_A> with B's unique features
     → Create hybrid approach for comprehensive coverage

WHEN <WINNER> == "Prompt B" AND <MARGIN> > 10:
  1. **[Critical] Adopt Prompt B as New Standard**:
     → Replace current prompt with B for <DOMAIN_TYPE> tasks
     → Archive A as fallback option

  2. **[High] Propagate B's Innovation**:
     → Extract B's breakthrough in <LARGEST_MARGIN_CRITERION>
     → Apply pattern to other prompts in the system

  3. **[High] Document B's Success Factors**:
     → Capture why B's approach proved superior
     → Create guidelines based on B's techniques

  4. **[Medium] Polish B's Remaining Weaknesses**:
     → Address B's lowest score in <LOWEST_SCORING_CRITERION_B>
     → Incorporate A's competitive techniques where applicable

  5. **[Low] Schedule Follow-up Testing**:
     → Re-test with diverse arguments in [timeframe]
     → Validate B's superiority across edge cases

WHEN <MARGIN> < 10:
  1. **[High] Conduct Extended Testing**:
     → Run 3-5 additional tests with varied arguments
     → Test with different complexity levels

  2. **[High] Specialize for Use Cases**:
     → Use Prompt A for [specific scenario type]
     → Use Prompt B for [alternative scenario type]

  3. **[Medium] Merge Best of Both Approaches**:
     → Combine A's strength in <A's best criterion>
     → Integrate B's advantage in <B's best criterion>

  4. **[Medium] Refine Testing Methodology**:
     → Adjust weights for <DOMAIN_TYPE> specifics
     → Include additional evaluation criteria

  5. **[Low] Monitor Production Performance**:
     → A/B test both prompts in production
     → Gather real-world performance data

### Stage 5.7: Quality Check

FOR final_validation FROM 1 TO maximum of 25:
  EVALUATE report quality:
    - Are all recommendations specific and actionable? [Pass/Fail]
    - Do scoring summaries accurately reflect analysis? [Pass/Fail]
    - Are improvement suggestions tied to actual weaknesses? [Pass/Fail]
    - Is learning accumulation comprehensive? [Pass/Fail]

  IF all checks pass:
    Break from iteration loop
  ELSE:
    Identify report gaps and address them

### Stage 5.8: Create Learning Repository

OUTPUT comprehensive learning patterns for future reference:

### Domain Knowledge Gained
```
Domain: <DOMAIN_TYPE> (confidence: <DOMAIN_CONFIDENCE>%)
Secondary: <SECONDARY_DOMAIN>
Effective criteria weights: <ADAPTED_WEIGHTS_JSON>
Test iterations needed: <iteration>
Confidence achieved: <CONFIDENCE>
```

### Testing Performance Metrics
```
Parallel execution time: <TOTAL_DURATION>s
Prompt A retry attempts: <A_RETRY_COUNT>
Prompt B retry attempts: <B_RETRY_COUNT>
Score variance: <SCORE_VARIANCE>
Final margin: <MARGIN> points
```

### Pattern Discovery
```
Winning characteristics: [what made <WINNER> effective]
Common pitfalls: [issues in both prompts]
Structure correlation: [structural elements linked to success]
```

### Recommendations for Similar Tests
```
For <DOMAIN_TYPE> domain:
- Prioritize criteria: [most important for this domain]
- Watch for: [common failure patterns]
- Optimal weights: [discovered weight distribution]
```

Cleanup temporary resources:
IF CLEANUP_REQUIRED is true:
  Remove entire test directory:
    rm -rf "$TEST_DIR"
  Document: "Test directory $TEST_DIR cleaned up"

### Stage 5.9: Phase Completion

Mark Phase 5 complete with final deliverable:

#### Executive Summary
In this A/B test comparing <PROMPT_A_NAME> against <PROMPT_B_NAME> with arguments "<TEST_ARGUMENTS>",
**<WINNER>** demonstrated superior performance with a total score of <TOTAL_A> vs <TOTAL_B>.

The key differentiator was [main reason for winning], particularly in [specific criterion category].

#### Recommended Action
[X] Use <WINNER> for this type of task
[ ] Continue iterating on <LOSER> with suggested improvements
[ ] Consider hybrid approach combining strengths of both

#### Statistical Confidence
Given a margin of <MARGIN> points across <NUMBER> criteria with <SCORE_VARIANCE> variance,
this recommendation has **<CONFIDENCE>** confidence after <iteration> scoring iterations.

Confidence factors:
- Score margin: <MARGIN> points
- Criterion consistency: <SCORE_VARIANCE> variance
- Iterations required: <iteration>
- Domain alignment: <DOMAIN_TYPE> criteria applied

  <result>A/B testing framework complete - comprehensive report generated</result>
  <learning>Systematic evaluation with domain adaptation provides reliable prompt comparison</learning>
```

## Error Handling Patterns

```markdown
WHEN errors occur during execution:

  IF prompter agent fails for either prompt:
    **FAILURE_HANDLING**:
      - Document the exact failure in report
      - Score failed prompt: Completeness=0, Quality=0, others based on error analysis
      - Continue comparison with working prompt vs failure analysis
      - Add failure weight penalty: -10 points from total score
      - Note: "Partial test - <FAILED_PROMPT> execution failed after <RETRY_COUNT> attempts"

  IF both prompts fail:
    **DUAL_FAILURE_HANDLING**:
      - Generate failure analysis report instead of comparison
      - Compare error types and clarity
      - Score based on error message quality and recovery suggestions
      - Recommend: "Both prompts have execution issues - fix before comparison"

  IF partial execution (some output produced):
    **PARTIAL_SUCCESS_HANDLING**:
      - Score partial output with 50% penalty on completeness
      - Assess what was produced vs what was expected
      - Note partial status in confidence calculation
      - Document: "Partial execution - incomplete results affect scoring"

  IF timeout during parallel execution:
    **TIMEOUT_HANDLING**:
      - Score timed-out prompt: Efficiency=0, others based on available output
      - Compare execution speed as factor
      - Note: "Timeout after <TIMEOUT_SECONDS>s affects efficiency scoring"

  IF git operations fail:
    **GIT_FAILURE_HANDLING**:
      - Inform user that version comparison requires git repository
      - Suggest: "Provide two explicit file paths instead"
      - Fallback: Ask user to specify second prompt manually
```

## Usage Examples

```markdown
# Compare current working file with last committed version
/prompt prompt-ab-test create-react-component Button primary

# Compare two different prompts explicitly
/prompt prompt-ab-test analyzer.md optimizer.md process-large-dataset

# Test with complex arguments
/prompt prompt-ab-test generator.md "create API with auth, database, and caching"

# Compare your current changes against committed version
/prompt prompt-ab-test ../prompts/my-prompt.md scripting technologies
```

## Meta-Notes

This prompt itself follows prompt-as-code methodology:
- Runtime criteria generation based on prompt analysis
- Natural language directives for all logic
- No predetermined scoring - adapts to prompt domain
- Clean separation of analysis phases
- Automatic git integration comparing working file vs last committed version
- Comprehensive but actionable output