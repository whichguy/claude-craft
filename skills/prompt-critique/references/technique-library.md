# Prompt Technique Library

A practical reference for prompt engineering techniques with concrete before/after examples. Each technique includes when to use it, tradeoffs, and real patterns drawn from production systems.

---

## 1. Structural Techniques

### 1.1 Prompt-as-Code

The prompt describes WHAT to decide at runtime, not WHAT the decision should be. This shifts logic from the prompt author to the executing model, allowing the same prompt to handle diverse situations.

**When to use**: Complex workflows where the right approach depends on runtime context -- project type, existing conventions, user preferences, or data characteristics.

**Before (Predetermined)**:
```
Use PostgreSQL for the database. Create tables with snake_case naming.
Write migrations using Knex.js. Add indexes on all foreign keys.
```

**After (Runtime Decision)**:
```
Detect the existing database technology from project config files
(package.json, docker-compose.yml, .env, ORM config).
If none exists, evaluate:
  - Data model complexity (relational needs → SQL, document-oriented → NoSQL)
  - Query patterns (heavy joins → PostgreSQL, key-value lookups → Redis/DynamoDB)
  - Scale requirements (read-heavy → consider read replicas, write-heavy → consider sharding)
Select the appropriate database and follow its community naming conventions.
Use the project's existing migration tool, or select one matching the ORM in use.
```

**Tradeoff**: Higher token cost and requires the model to reason, but handles novel situations without prompt rewrites. Use predetermined choices when the decision is genuinely always the same.

### 1.2 Hierarchical Structure

Flat prompts force the model to mentally parse structure. Nested hierarchies with clear section boundaries reduce ambiguity and improve instruction following.

**Before (Flat)**:
```
You help users with code. Be concise. Use TypeScript when possible.
Always add error handling. Check for null values. Write tests for
public functions. Use jest for testing. Mock external dependencies.
Don't over-engineer. Keep functions under 30 lines.
```

**After (Hierarchical)**:
```
# Code Generation

## Language & Style
- Prefer TypeScript; fall back to the project's existing language
- Keep functions under 30 lines; extract when exceeding
- Avoid over-engineering: solve the stated problem, not hypothetical ones

## Reliability
- Add error handling at system boundaries (API calls, file I/O, user input)
- Check for null/undefined when data originates from external sources
- Internal function calls between your own code do not need null guards

## Testing
- Write tests for all public functions using the project's existing test runner
- If no test runner exists, use jest
- Mock external dependencies (network, filesystem, databases)
- Do NOT mock internal modules unless testing in isolation is required
```

**Why it works**: The model processes hierarchical structure natively. Grouping related instructions under headers prevents the "lost in the middle" problem where instructions buried in paragraphs get ignored.

### 1.3 Information Architecture

Order matters. The model weights instructions differently based on position. The optimal ordering is:

1. **Role/Identity** (who you are) -- anchors all subsequent behavior
2. **Context** (what you know) -- environment, data, constraints
3. **Instructions** (what to do) -- the core task
4. **Output specification** (what to produce) -- format, structure, examples
5. **Constraints** (what NOT to do) -- guardrails and safety gates

**Before (Random Order)**:
```
Never delete user data without confirmation. You are a database administrator
for a healthcare system. Output SQL statements wrapped in transactions.
The database is PostgreSQL 15 running on AWS RDS. Always check if a table
exists before altering it. Format output as markdown code blocks.
```

**After (Ordered)**:
```
# Role
You are a database administrator for a healthcare system (HIPAA-regulated).

# Context
- Database: PostgreSQL 15 on AWS RDS (Multi-AZ, encrypted at rest)
- Schema version: managed by Flyway migrations
- Current environment: staging

# Instructions
Generate SQL statements for the requested schema changes.
Check table/column existence before ALTER operations.
Wrap all data-modifying operations in explicit transactions.

# Output Format
Return each SQL statement in a markdown code block with `sql` language tag.
Prefix destructive operations with a -- WARNING comment.

# Constraints
- NEVER generate DROP TABLE or TRUNCATE without explicit user confirmation
- NEVER output connection strings or credentials
- All patient-related columns must use encrypted column types
```

### 1.4 Modular Composition

Monolithic prompts become unmaintainable past ~2,000 words. Decompose into composable pieces that can be mixed, versioned, and tested independently.

**Before (Monolithic)**:
A single 500-line system prompt containing role definition, code style rules, testing requirements, deployment procedures, security policies, and output formatting -- all in one file.

**After (Modular)**:
```
# System Prompt Assembly

## Core (always included)
@include role.md           # Identity and base behavior
@include safety.md         # Non-negotiable constraints

## Task-Specific (selected at runtime)
@include code-review.md    # When task = code review
@include migration.md      # When task = database migration
@include debugging.md      # When task = bug investigation

## Context (injected dynamically)
@include environment.md    # Runtime: git branch, test results, etc.
```

**Key principle**: Each module should be independently testable. If you change the code review module, only code review behavior should change. If safety constraints bleed into every module, they are not properly isolated.

### 1.5 XML Tags for Structure

Claude was specifically trained to parse XML tags (`<behavior_instructions>`, `<artifacts_info>`, `<knowledge_cutoff>`). Using descriptive XML tags is the **#1 officially recommended structural technique** and improves accuracy by ~40% over freeform text.

**Before (Freeform)**:
```
Here are the instructions for the task. You should analyze the document
I've provided and extract the key themes. The document is a legal contract
about intellectual property rights. Focus on liability clauses.
```

**After (XML-Tagged)**:
```
<instructions>
Analyze the document and extract key themes. Focus on liability clauses.
</instructions>

<document type="legal-contract" subject="intellectual-property">
[contract text here]
</document>

Using the contract in <document> tags, identify all liability clauses
and summarize their implications.
```

**Key practices**:
- Use descriptive tag names: `<instructions>`, `<example>`, `<data>`, `<document>`, `<context>`
- Nest tags for hierarchy: `<outer><inner></inner></outer>`
- Be consistent: reference tags by name in instructions ("Using the contract in `<document>` tags...")
- Combine with other techniques: `<examples>` for few-shot, `<thinking>` for CoT, `<answer>` for output
- No canonical "best" tag names — use names that make sense for the enclosed content

**Tradeoff**: Small token overhead (+10-30 tokens for tags) for significant accuracy gains. Always worthwhile for prompts with multiple content types (instructions + data + examples).

---

## 2. Instructional Style Spectrum

The same task expressed in four distinct styles. Each has a sweet spot. The task: **"Validate user input before processing an API request."**

### 2.1 Instructive (Step-by-Step)

```
1. Parse the incoming request body as JSON. If parsing fails, return 400
   with { error: "Invalid JSON in request body" }.
2. Check all required fields against the endpoint's schema:
   - POST /users: name (string, 1-100 chars), email (string, valid format)
   - POST /orders: userId (integer, > 0), items (array, non-empty)
3. For each field present, validate its type matches the schema.
   Type mismatches return 400 with { field: "name", expected: "string", got: "number" }.
4. Sanitize all string fields: trim leading/trailing whitespace, strip HTML tags.
5. Check string lengths against field-specific maximums.
6. If all checks pass, forward the sanitized object to the handler.
   If any check fails, return the FIRST error encountered (fail-fast).
```

**When to use**: Complex multi-step procedures, safety-critical sequences, training new agent behaviors where you cannot afford the model to skip a step.

**Tradeoff**: High token cost. Rigid -- the model follows your steps even when a better approach exists. But highly predictable.

### 2.2 Directional (Goal-Oriented)

```
Ensure all user input is validated before reaching the processing layer.
Invalid input should be rejected early with clear, actionable error messages
that tell the caller exactly which field failed and why. Sanitize strings
to prevent injection attacks. Follow the endpoint's schema definition for
field requirements and constraints.
```

**When to use**: Experienced agents, tasks where the model already knows the domain well, creative tasks where prescribing exact steps would be counterproductive.

**Tradeoff**: Low token cost. Flexible -- the model can adapt to edge cases. But may miss specific requirements you assumed were obvious.

### 2.3 Imperative (Commands)

```
ALWAYS validate input at the API boundary before any processing.
NEVER pass raw user input to database queries or shell commands.
REJECT requests missing required fields with HTTP 400.
STRIP HTML tags from all user-provided strings.
FAIL FAST on the first validation error; do not accumulate.
```

**When to use**: Safety-critical constraints, hard rules that must never be violated, rules that override other instructions. Imperative style has the strongest compliance rate.

**Tradeoff**: Very concise and memorable. The model treats CAPS imperatives as high-priority. But this style says nothing about HOW to implement -- pair with another style for the approach.

### 2.4 Declarative (State/Outcome)

```
Validated input is a prerequisite for processing. The validation layer
produces exactly one of:
  - A sanitized input object where all fields are typed, trimmed,
    and within defined limits
  - A 400 error response containing an array of
    { field: string, message: string, code: string } objects

The sanitized object is guaranteed to satisfy:
  - All required fields present and non-null
  - String fields: trimmed, HTML-stripped, within maxLength
  - Numeric fields: finite, within [min, max] bounds
  - Array fields: non-empty, each element individually validated
```

**When to use**: Output specifications, data contracts, interface definitions, when you care about the SHAPE of the result more than the process.

**Tradeoff**: Crystal clear on WHAT the output looks like. Silent on HOW to get there. Best combined with directional or instructive style for the implementation approach.

### Choosing a Style

| Context | Best Style | Why |
|---------|-----------|-----|
| Safety-critical rules | Imperative | Non-negotiable rules need command form |
| Complex multi-step procedure | Instructive | Explicit steps prevent skipping |
| Creative or flexible tasks | Directional | Leaves room for model judgment |
| Output format specification | Declarative | Contract-style clarity on shape |
| Production system prompt | **Mixed** | Imperative for safety + Directional for approach + Declarative for output |

**The best prompts layer styles by concern**: Imperative for what must never happen, directional for the overall approach, instructive for the tricky parts, and declarative for the expected output.

### 2.5 Motivated Instructions (Explain WHY)

Explaining the reasoning behind a rule helps Claude generalize to edge cases not explicitly covered. Rated 9/10 effectiveness across all task types.

**Before (Bare rule)**:
```
NEVER use ellipses in responses.
ALWAYS include the function signature in code explanations.
```

**After (Motivated)**:
```
Your response will be read aloud by a text-to-speech engine, so never
use ellipses since the TTS engine won't know how to pronounce them.

Always include the function signature in code explanations because users
copy-paste these into their IDE and need the complete callable form.
```

**Why it works**: Claude generalizes from the explanation. The TTS example teaches it to avoid ALL unpronounceables (not just ellipses). The copy-paste explanation teaches it to include imports too.

**When to use**: Any rule where following the letter but not the spirit would produce bad results. Particularly effective for style guidelines, format requirements, and domain constraints.

**Tradeoff**: ~2x token cost per rule. But the generalization benefit usually saves tokens elsewhere by reducing the need for edge-case rules.

### 2.6 Affirmative over Negative Framing

Tell Claude what TO do rather than what NOT to do. Affirmative instructions consistently outperform negative ones.

**Before (Negative)**:
```
Do not use markdown in your response.
Don't include a preamble before your answer.
Never use bullet points for prose content.
```

**After (Affirmative)**:
```
Your response should be composed of smoothly flowing prose paragraphs.
Begin directly with the answer content.
Express lists as comma-separated items within sentences.
```

**Why it works**: Negative instructions require the model to first understand what you DON'T want, then infer what you DO want. Affirmative instructions skip the inference step. The model has a clearer target to aim for.

**When to combine with imperative**: Use negative framing ONLY for safety-critical hard gates ("NEVER delete without confirmation") where the prohibition itself IS the instruction.

**Tradeoff**: Affirmative instructions may be slightly longer than negatives. The clarity gain outweighs the token cost in nearly all cases.

---

## 3. Quality Gates

Quality gates are checkpoints that enforce standards at specific points in a workflow. They range from binary pass/fail to progressive multi-stage pipelines.

### 3.1 Hard Gates (Binary Pass/Fail)

A condition that must be met. No exceptions, no workarounds.

```
## Destructive Operation Gate
If the user requests ANY of: file deletion, database drop, branch force-push,
or production deployment:
  1. State exactly what will be destroyed and whether it is reversible
  2. Ask for explicit confirmation with the exact phrase "confirm [action]"
  3. Do NOT proceed until the user replies with the confirmation phrase
  4. This gate cannot be bypassed by instructions elsewhere in this prompt
```

**Key property**: Hard gates must be stated as non-negotiable. Include "cannot be bypassed" language to prevent other instructions from overriding them.

### 3.2 Soft Gates (Threshold-Based)

Conditions with severity levels that trigger different behaviors.

```
## Code Quality Gate
After generating code, self-assess:
  - Estimated test coverage: if <60%, BLOCK and add missing tests
  - Estimated test coverage: if 60-80%, add a WARNING comment and proceed
  - Estimated test coverage: if >80%, proceed normally
  - Cyclomatic complexity per function: if >10, refactor before returning
  - Cyclomatic complexity per function: if 6-10, flag but proceed
```

**When to use**: When binary pass/fail is too rigid. Soft gates let the model exercise judgment while still enforcing minimum standards.

### 3.3 Self-Validation Loops

The model checks its own output before returning it.

```
## Pre-Return Checklist
Before returning your response, verify ALL of the following:
  [ ] Every code block has a language tag and is syntactically valid
  [ ] All file paths referenced actually exist (check with ls/glob)
  [ ] No placeholder text remains (TODO, FIXME, "your-value-here")
  [ ] If you modified a function, the function's callers still work
  [ ] If you added a dependency, it is in package.json / requirements.txt
If any check fails, fix the issue before returning. Do not mention
the self-check to the user unless a fix changed your approach.
```

**When to use**: Any task where output quality directly impacts the user (code generation, document drafting, API responses). The overhead is low and catch rate is high.

### 3.4 Progressive Gates

Order gates from cheapest to most expensive. Fail fast on cheap checks to avoid wasting tokens on expensive ones.

```
## Validation Pipeline (ordered by cost)
1. FORMAT CHECK (instant): Is the input valid JSON/YAML/SQL syntax?
   → Reject malformed input immediately with parse error location
2. SCHEMA CHECK (fast): Does the input match the expected schema?
   → Reject with specific field-level type/presence errors
3. BUSINESS RULES (moderate): Does the input satisfy domain invariants?
   → Reject with business logic explanation (e.g., "end_date must be after start_date")
4. INTEGRATION CHECK (expensive): Does the input reference valid external entities?
   → Only reached for well-formed, schema-valid, business-valid input
   → Verify foreign keys exist, permissions are sufficient, quotas not exceeded
```

### 3.5 Gate Placement

Where you place a gate changes its effectiveness:

**Before (Pre-execution)**: Prevents wasted work. Use for input validation, permission checks, and precondition verification.
```
Before writing any code, verify:
- The target file exists and you have read its current contents
- You understand the function's callers and dependencies
- Your proposed change does not break the function signature
```

**During (Mid-execution)**: Catches drift during long tasks. Use for multi-step processes where intermediate results matter.
```
After each migration step:
- Run the test suite for the migrated module
- If any test fails, stop and fix before proceeding to the next module
- Do not batch-migrate and test at the end
```

**After (Post-execution)**: Final quality check. Use when you need the complete output to evaluate quality.
```
After generating the complete API response:
- Validate the response against the OpenAPI schema
- Verify all $ref references resolve to existing definitions
- Check that example values match their declared types
```

---

## 4. Context Management

### 4.1 Context Injection

Dynamic data blocks provided at runtime that the model must use. The pattern: structured data block + explicit instruction to use it.

```
<environment>
{
  "project": "sheets-chat",
  "runtime": "Google Apps Script (V8)",
  "language": "JavaScript (ES2020, no modules, no import/export)",
  "constraints": [
    "No npm packages - all dependencies must be inline",
    "6-minute execution time limit per function call",
    "No fetch() - use UrlFetchApp.fetch() instead",
    "No console.log in production - use Logger.log"
  ],
  "currentFile": "ClaudeConversation.gs",
  "functionBeingEdited": "streamResponse"
}
</environment>

The ENVIRONMENT block above describes the current project context.
You MUST check it BEFORE generating code. In particular:
- Use only APIs available in the declared runtime
- Respect all listed constraints
- Target the specified file and function
```

**Critical rule**: Always include explicit instructions to USE the injected context. Without them, the model may ignore the block entirely (see 4.3 Orphaned Context).

### 4.2 Context Priming

Set expectations before delivering content. This is like a "heads up" that shapes how the model interprets what follows.

```
You will receive a JSON configuration object below. It defines a
multi-step data pipeline. The `stages` array determines execution order.
Each stage has a `type` field that maps to a processing function.
Pay special attention to the `errorHandling` field on each stage --
it controls whether errors propagate or are swallowed.

<pipeline-config>
{ "stages": [ ... ] }
</pipeline-config>
```

**Why it works**: Without priming, the model scans the JSON cold and may miss the significance of specific fields. Priming directs attention to what matters.

### 4.3 The Orphaned Context Problem

**This is the single most common context management failure.** It occurs when you inject structured data into a prompt but never instruct the model to use it.

**Bad -- Orphaned context**:
```
<user-preferences>
{ "theme": "dark", "language": "es", "timezone": "America/Mexico_City" }
</user-preferences>

Help the user configure their dashboard.
```

The model might help with configuration but ignore the preference data entirely, asking the user for information that was already provided.

**Good -- Referenced context**:
```
<user-preferences>
{ "theme": "dark", "language": "es", "timezone": "America/Mexico_City" }
</user-preferences>

Help the user configure their dashboard. Their current preferences are
in the USER-PREFERENCES block above. Apply these as defaults -- do NOT
ask the user for information already present in their preferences.
Respond in the user's preferred language (check the "language" field).
```

**Real-world lesson**: In a system prompt optimization project, compressing a 57K-character prompt to 12K initially lost context awareness because injected environment blocks were included but the instructions to USE them were removed. Adding a single line ("Check the ENVIRONMENT CONTEXT block FIRST before making API calls") restored full performance.

### 4.4 Context Budget Priority

When you are constrained by token limits and must cut content, prioritize in this order:

| Priority | Content Type | Compressibility | Rationale |
|----------|-------------|-----------------|-----------|
| 1 (never cut) | Safety constraints | None | Non-negotiable behavioral rules |
| 2 | Task-specific instructions | Low | Core functionality depends on these |
| 3 | Domain-specific gotchas | Low | Highest value-per-token -- things the model gets WRONG without them |
| 4 | General knowledge | High | The model already knows most of this |
| 5 | Examples | Medium | Reduce to 1-2 minimum viable examples |
| 6 | Explanatory prose | High | Convert to terse directives |

**Key insight**: Domain-specific gotchas (Priority 3) are the highest ROI content in any prompt. These are the cases where the model's default behavior is wrong for your specific context. A single line like "GAS does not support ES modules -- never use import/export" prevents more errors than 500 words of general JavaScript guidance.

### 4.5 Long Context Placement Strategy

Position matters. Queries at the end of long context can improve response quality by **up to 30%**. The "lost in the middle" effect causes 15-47% performance drop for information placed in the middle of context.

**Optimal layout for long-context prompts**:
```
[Long documents / reference data / examples]     ← TOP (20K+ tokens)
[Dynamic context / environment state]             ← MIDDLE
[Task-specific instructions and query]            ← BOTTOM (most attended)
```

**Key practices**:
- Place longform data (20K+ tokens) at TOP of prompt, above instructions
- Put the actual query/task at the END where attention is highest
- Structure multi-document content with indexed XML: `<documents><document index="1">...</document></documents>`
- For document-grounded tasks, ask Claude to extract quotes first (see 6.7 Quote Extraction)

**U-shaped attention curve**: Positions 0-20% and 80-100% of prompt depth get high recall. Middle positions (40-60%) can drop 20-30% in accuracy. Place critical behavioral rules early and task-specific instructions late.

**Tradeoff**: Reordering for model attention may reduce human readability of the prompt. Maintain separate documentation if prompt auditability matters.

---

## 5. Compression Techniques

Compression reduces token cost while preserving instruction-following quality. These techniques are drawn from compressing a production system prompt from 57.5K to 12.6K characters (79% reduction, 43% fewer tokens) with <2% behavioral deviation.

### 5.1 Prose to Directives

| Before (Prose) | After (Directive) | Savings |
|----------------|-------------------|---------|
| "When you encounter an error during code generation, you should carefully analyze the error message, understand the root cause, and then fix the issue before continuing." | `ON_ERROR: analyze root cause → fix → continue` | ~75% |
| "Please make sure to always use async/await syntax instead of raw promises when writing asynchronous JavaScript code." | `ASYNC: async/await over promises` | ~80% |
| "Before making any changes to the codebase, you should first read and understand the existing code in the file you're about to modify." | `BEFORE_EDIT: read target file first` | ~80% |

### 5.2 Redundancy Elimination

Remove statements that describe Claude's default behavior.

**Remove entirely** (Claude already does these):
- "Be helpful and provide accurate information"
- "If you're not sure, say so"
- "Think step by step" (for simple tasks)
- "Provide clear explanations"
- "Be respectful and professional"

**Keep** (overrides defaults or encodes domain-specific knowledge):
- "Use UrlFetchApp.fetch() instead of fetch()" (domain-specific)
- "Never use ES modules in GAS" (overrides default JS behavior)
- "Respond in Spanish" (overrides default language)

### 5.3 Example Compression

Reduce multi-line examples to single-line patterns when the format is learnable from one instance.

**Before** (3 full examples, 45 lines):
```
Example 1:
Input: { "name": "John", "age": 30 }
Validation: Check name is string (pass), check age is number (pass)
Output: { "valid": true, "sanitized": { "name": "John", "age": 30 } }

Example 2:
Input: { "name": 123, "age": "thirty" }
... (15 more lines)

Example 3:
... (15 more lines)
```

**After** (1 inline pattern, 3 lines):
```
Validate input → sanitize → return { valid: bool, sanitized?: object, errors?: [{field, message}] }
Example: { name: 123 } → { valid: false, errors: [{ field: "name", message: "expected string" }] }
```

### 5.4 Structured to Terse Formats

```
# Before: Markdown table (high readability, high tokens)
| Feature | Supported | Notes |
|---------|-----------|-------|
| ES Modules | No | Use require() pattern |
| Arrow Functions | Yes | V8 runtime only |
| async/await | No | Use Promises or callbacks |

# After: Key-value (lower readability, much lower tokens)
ES_MODULES: no (use require pattern) | ARROW_FN: yes (V8) | ASYNC_AWAIT: no (use promises)
```

### 5.5 When Compression Hurts

Not all content compresses equally. From empirical A/B testing:

- **Context awareness**: Most fragile dimension. Drops ~1 point with aggressive compression. Always keep explicit "check the context block" instructions.
- **Safety gates**: Robust to compression. The imperative style ("NEVER delete without confirmation") survives aggressive surrounding prose removal.
- **Domain gotchas**: High value-per-token. Compressing these causes the most regression per token saved. Keep them.
- **Multi-step procedures**: Moderate fragility. You can compress prose around steps, but removing steps causes skipping.

**Rule of thumb**: Compress explanations, keep instructions. "Why" text can be cut; "what to do" text cannot.

---

## 6. Cognitive Techniques

### 6.1 Thinking Directives

Explicitly requesting the model to reason before acting. Useful for complex decisions; wasteful for simple tasks.

**Helps significantly**:
```
Before modifying this function, analyze:
1. What callers depend on this function's return type?
2. Will changing the signature break any existing call sites?
3. Are there edge cases in the current implementation that the tests don't cover?
Then make your changes.
```

**Wastes tokens** (model already does this for simple tasks):
```
Think carefully about how to convert this string to uppercase.
Consider all the edge cases of toUpperCase().
```

**Guideline**: Add thinking directives when the task requires weighing tradeoffs, analyzing dependencies, or making decisions with non-obvious consequences. Skip them for mechanical transformations.

### 6.2 Role Anchoring

Assigning a specific role shapes the model's vocabulary, priorities, and domain assumptions.

**Effective role anchoring** (specific, relevant, adds behavioral constraints):
```
You are a senior SRE reviewing a Terraform plan for a production
healthcare system. You prioritize: availability > security > cost.
You flag any change that could cause downtime, even briefly.
```

**Ineffective role anchoring** (vague, redundant, or contradictory):
```
You are a helpful, creative, and knowledgeable AI assistant who is
an expert in everything related to programming, databases, cloud
infrastructure, security, testing, and DevOps.
```

The first anchors behavior around specific priorities. The second is so broad it adds no behavioral constraints -- it is equivalent to no role at all.

**When to skip roles entirely**: General-purpose tasks where the role is obvious from context. If the user asks "fix this Python bug," the model already knows it is a Python developer. Adding a role adds tokens without changing behavior.

**Related anti-patterns**: See #10 (Kitchen Sink Role) and #14 (Heavy Role Prompting) in `references/anti-patterns.md`.

### 6.3 Few-Shot Examples

Examples teach novel output formats, not common ones.

| Example Count | When to Use |
|---------------|-------------|
| 0 (zero-shot) | Standard formats: JSON, markdown, SQL, code. The model already knows these. |
| 1-2 | Novel or ambiguous formats where one example resolves the ambiguity. |
| 3-5 | Complex patterns with multiple valid approaches -- examples narrow the space. |
| >5 | Diminishing returns. Consider fine-tuning or structured output schemas instead. |

**Wrap examples in XML tags** for best results:
```
<examples>
  <example>
    <input>API_KEY=sk-abc123</input>
    <output>PropertiesService.getScriptProperties().setProperty('API_KEY', 'sk-abc123');</output>
  </example>
  <example>
    <input>DB_HOST=postgres.internal</input>
    <output>PropertiesService.getScriptProperties().setProperty('DB_HOST', 'postgres.internal');</output>
  </example>
</examples>
```

With extended thinking enabled, include `<thinking>` or `<scratchpad>` tags in examples and Claude will generalize the reasoning pattern.

**Good use of few-shot** (novel format the model cannot guess):
```
Format the output as a GAS property entry:
Input: API_KEY=sk-abc123
Output: PropertiesService.getScriptProperties().setProperty('API_KEY', 'sk-abc123');

Input: DB_HOST=postgres.internal
Output: PropertiesService.getScriptProperties().setProperty('DB_HOST', 'postgres.internal');

Now convert: WEBHOOK_URL=https://hooks.slack.com/services/T0/B0/xxx
```

**Wasteful few-shot** (model already knows JSON):
```
Example 1: Convert "John, 30" to {"name": "John", "age": 30}
Example 2: Convert "Jane, 25" to {"name": "Jane", "age": 25}
Example 3: Convert "Bob, 40" to {"name": "Bob", "age": 40}
Now convert: "Alice, 35"
```

### 6.4 Chain of Thought Scaffolding

Provide a reasoning structure for complex multi-factor decisions.

```
## Decision Framework for Selecting a Caching Strategy

Evaluate in this order:
1. DATA VOLATILITY: How often does the underlying data change?
   - Seconds → no cache or very short TTL
   - Minutes → short TTL with background refresh
   - Hours/Days → aggressive caching with invalidation

2. CONSISTENCY REQUIREMENT: Can users see stale data?
   - Never (financial, inventory) → cache-aside with write-through
   - Briefly acceptable (social, analytics) → TTL-based expiry
   - Indefinitely (static assets) → CDN with versioned URLs

3. ACCESS PATTERN: How is the data read?
   - Single key lookups → key-value cache (Redis)
   - Range queries → sorted set or materialized view
   - Full scans → precomputed aggregates

State your assessment for each factor, then recommend the strategy.
```

**When to use**: Multi-criteria decisions where the model might weigh factors inconsistently without scaffolding. Particularly useful for architecture decisions, security assessments, and code review prioritization.

### 6.5 Metacognitive Prompts

Prompt the model to question its own assumptions before committing to an approach.

```
Before implementing your solution:
- What am I assuming about the user's environment that might be wrong?
- What is the most likely failure mode of this approach?
- Is there a simpler way to achieve the same result?
- What would I need to verify to be confident this is correct?
```

**When to use**: High-stakes decisions, unfamiliar codebases, production changes. The overhead is 50-100 tokens but prevents confident-but-wrong responses.

**When to skip**: Routine tasks where the model has high confidence and the stakes are low (formatting, simple refactoring, standard CRUD operations).

### 6.6 Extended & Adaptive Thinking

Dedicated reasoning features that dramatically outperform basic CoT prompting for complex tasks. 18%+ improvement on planning benchmarks; up to 72% with think tool on policy-heavy tasks.

**Model-specific approaches**:

| Model | Recommended Approach | Configuration |
|-------|---------------------|---------------|
| Opus 4.6 | Adaptive thinking | `thinking: {type: "adaptive"}` + `effort` parameter (low/medium/high/max) |
| Sonnet 4.5 | Extended thinking | `thinking: {type: "enabled", budget_tokens: N}` |
| Haiku 4.5 | Extended thinking | Same as Sonnet |

**Key practices**:
- Start with minimum budget (1024 tokens), increase incrementally
- Use high-level instructions ("think deeply about this problem") over step-by-step prescriptions
- "The model's creativity in approaching problems may exceed a human's ability to prescribe the optimal thinking process"
- Ask Claude to verify its work with test cases for improved consistency
- Above 32K budget: use batch processing

**When NOT to use**: Simple lookups, formatting tasks, standard code generation. Extended thinking adds 5-15 seconds of latency. Reserve for: complex STEM, constraint optimization, multi-step reasoning, architecture decisions.

**Opus 4.6 steering**:
- To reduce thinking: "Extended thinking adds latency and should only be used when it will meaningfully improve answer quality"
- To increase: Use higher `effort` setting

**Related anti-pattern**: See #12 (Magic Phrases) in `references/anti-patterns.md` for deprecated alternatives like "ultrathink" and "take a deep breath."

### 6.7 Quote Extraction for Grounding

For document-grounded tasks, ask Claude to extract word-for-word quotes before performing analysis. Significantly reduces hallucination on long-context tasks.

```
<instructions>
1. First, extract word-for-word quotes from the document that are
   relevant to the question. Place them in <quotes> tags.
2. Then provide your analysis in <analysis> tags, referencing
   the specific quotes that support each point.
3. If the document does not contain enough information to answer,
   say so rather than speculating.
</instructions>
```

**When to use**: Any task involving 20K+ token documents, fact-checking, compliance review, legal analysis. Combine with long context placement (4.5) for maximum accuracy.

**Tradeoff**: Adds ~100-500 tokens of quoted material before analysis. Unnecessary overhead for short documents (<5K tokens) where the model can attend to the full content directly.

---

## 7. Anti-Pattern Summary

Quick reference for the most common prompt engineering mistakes. See `references/anti-patterns.md` for full details with detection heuristics, examples, and fixes.

| # | Pattern | Severity | One-liner |
|---|---------|----------|-----------|
| 1 | Over-specification | INFO | Teaching the model what it already knows well |
| 2 | Contradictory instructions | CRITICAL | Conflicting directives that force unpredictable resolution |
| 3 | Vague imperatives | WARNING | "Be helpful" without measurable success criteria |
| 4 | Context overload | WARNING | Exceeding effective context utilization (>10K words of instructions) |
| 5 | Premature optimization | INFO | Compressing prompts before establishing a behavioral baseline |
| 6 | Style drift | WARNING | Mixing instructional styles inconsistently within the same section |
| 7 | Orphaned context | CRITICAL | Injecting data blocks without instructions to use them |
| 8 | Unbounded iteration | WARNING | "Keep improving until perfect" with no convergence criteria |
| 9 | False precision | INFO | Scoring on 1-100 scale when 1-5 provides equivalent signal |
| 10 | Kitchen sink role | WARNING | "Expert in everything" role that anchors nothing |
| 11 | Emotional manipulation | WARNING | "This is critical to my career" / tip promises -- no evidence of effectiveness |
| 12 | Magic phrases | INFO | "Take a deep breath" / "ultrathink" -- deprecated, non-functional |
| 13 | Aggressive triggering | WARNING | "CRITICAL: You MUST..." causes overtriggering on Opus 4.5/4.6 |
| 14 | Heavy role prompting | INFO | "World-renowned expert" for factual tasks -- overconstrains without benefit |

**Severity guide**:
- **CRITICAL**: Causes incorrect or unpredictable behavior. Fix immediately.
- **WARNING**: Degrades quality or wastes significant tokens. Fix when refactoring.
- **INFO**: Suboptimal but functional. Fix opportunistically.
