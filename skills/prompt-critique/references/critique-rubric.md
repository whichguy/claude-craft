# Prompt Critique Rubric

This document defines the scoring logic, classification rules, and output template for prompt critiques. Every critique produced by the prompt-critique skill MUST follow this rubric exactly.

---

## 1. Prompt Type Classification

Before scoring, classify the input prompt into exactly one type. Classification determines which technique categories are weighted heavily and which can be skipped.

| Type | Indicators | Example |
|------|-----------|---------|
| System Prompt | "You are", role definition, persistent across conversation, sets ongoing behavior | Claude system prompt, ChatGPT custom instructions |
| Agent Prompt | YAML frontmatter (name, description), tool access declarations, spawned by another agent | Claude Code SKILL.md files, agent definitions |
| Task Prompt | Single-use instruction, specific deliverable, ephemeral context | "Refactor this function", "Write tests for X" |
| Template | Placeholders/variables (`{{var}}`, `<prompt-arguments>`), designed for reuse | Prompt templates, parameterized commands |

### Classification Rules

Apply these checks **in order** and stop at the first match:

1. Has YAML frontmatter with a `name:` field --> **Agent Prompt**
2. Has `{{variables}}`, `<prompt-arguments>`, or `$PLACEHOLDER` syntax with documentation for substitution --> **Template**
3. Starts with "You are" or defines a persistent role/persona with behavioral instructions --> **System Prompt**
4. Everything else --> **Task Prompt**

If the prompt straddles two types (e.g., a system prompt that also contains template variables), classify by the **primary usage pattern**. Note the secondary type in the critique header.

---

## 2. Technique Relevance Matrix

Each technique category receives a weight from 0-3 based on the prompt type. The weight determines whether the category is scored and how much it contributes to the final rating.

| Technique Category | System | Agent | Task | Template |
|-------------------|--------|-------|------|----------|
| Structural | 3 | 3 | 1 | 2 |
| Instructional Style | 2 | 3 | 2 | 1 |
| Quality Gates | 2 | 3 | 1 | 1 |
| Context Management | 3 | 2 | 2 | 3 |
| Compression | 3 | 2 | 0 | 1 |
| Cognitive | 2 | 2 | 3 | 1 |
| Anti-patterns | 3 | 3 | 2 | 2 |

### How to read the matrix

- **Weight 0**: Skip entirely. Do not score or mention in the critique.
- **Weight 1**: Optional. Score only if noteworthy (exceptionally good or actively harmful). Do not flag absence as a gap.
- **Weight 2**: Recommended. Score this category. Absence is a YELLOW finding.
- **Weight 3**: Critical. Score this category. Absence is a critical gap that should appear in the top recommendations.

---

## 3. Per-Category Scoring

For each technique category where the weight is >= 2, assign exactly one of three levels. Each level has specific detection criteria.

### GREEN: Well-Applied

The technique is present and correctly used. Detection criteria by category:

- **Structural**: Clear section hierarchy with headers or delimiters. Role/identity appears first. Instructions flow from general to specific. Related rules are grouped, not scattered.
- **Instructional Style**: Consistent voice throughout (imperative, declarative, or constraint-based -- not a mix). Appropriate density for the task complexity. Directives are unambiguous (no "try to" or "you might want to").
- **Quality Gates**: At least one explicit acceptance criterion with a concrete pass/fail condition. Specifies what to do on failure (retry, ask, escalate). Gates are placed before the action they guard, not after.
- **Context Management**: Dynamic context blocks (injected data, conversation history) have explicit instructions telling the model how to USE the context, not just that it exists. Boundaries between static instructions and dynamic content are clear.
- **Compression**: High information density without sacrificing clarity on critical paths. Uses shorthand/structured formats for reference material. Safety and behavioral instructions remain fully explicit (never compressed).
- **Cognitive**: Thinking directives or reasoning steps are placed at decision points where the model needs to reason, not scattered randomly. Chain-of-thought is requested for complex multi-step logic. Simple lookups do not have unnecessary reasoning scaffolding.
- **Anti-patterns**: No anti-patterns from the catalog detected.

### YELLOW: Missing but Recommended

The technique would meaningfully improve the prompt. For each YELLOW finding, the critique MUST include:

1. **Which specific sub-technique** to add (reference the technique library by name)
2. **Estimated impact**: HIGH, MEDIUM, or LOW, calculated as `weight x improvement_potential` where improvement_potential is:
   - HIGH: the prompt actively suffers without this technique (e.g., ambiguous outputs, wasted tokens every call)
   - MEDIUM: the prompt works but is measurably suboptimal
   - LOW: marginal improvement
3. **A concrete before/after example** using the actual prompt text (not generic examples)

### RED: Anti-pattern Detected

An anti-pattern from the anti-patterns catalog is actively present. For each RED finding, the critique MUST include:

1. **Anti-pattern name** (exact name from the catalog) and **severity** (CRITICAL/WARNING/INFO from the catalog)
2. **The specific text** from the prompt that triggered detection (quoted verbatim, truncated to 200 chars if needed)
3. **A concrete fix** showing the rewritten text

---

## 4. Scoring Algorithm

The scoring algorithm is deterministic. Follow these steps exactly.

### Step 1: Identify Applicable Categories

For the detected prompt type, select all categories where weight >= 2.

### Step 2: Score Each Applicable Category

```
For each applicable category:
  if GREEN:       category_score = weight * 1.0
  if YELLOW:      category_score = 0
  if RED:         category_score = weight * -0.5
```

### Step 3: Calculate Totals

```
total_score = sum of all category_scores
max_score   = sum of all applicable weights (i.e., all weights >= 2)
percentage  = round((total_score / max_score) * 100)
```

If `max_score` is 0 (no applicable categories), the percentage is 100% by default.

### Step 4: Assign Rating

| Percentage | Rating | Interpretation |
|-----------|--------|---------------|
| >= 80% | STRONG | Minor improvements possible. The prompt uses techniques effectively. |
| 60-79% | ADEQUATE | Meaningful improvements available. Core structure works but gaps exist. |
| 40-59% | WEAK | Significant gaps in technique coverage. Multiple critical categories need work. |
| < 40% | POOR | Major rework recommended. Fundamental structural or anti-pattern issues. |

### Worked Example

Prompt type: Agent Prompt. Applicable categories (weight >= 2): Structural(3), Instructional(3), Quality Gates(3), Context(2), Compression(2), Cognitive(2), Anti-patterns(3).

| Category | Weight | Status | Score |
|----------|--------|--------|-------|
| Structural | 3 | GREEN | 3.0 |
| Instructional | 3 | YELLOW | 0.0 |
| Quality Gates | 3 | RED | -1.5 |
| Context | 2 | GREEN | 2.0 |
| Compression | 2 | YELLOW | 0.0 |
| Cognitive | 2 | GREEN | 2.0 |
| Anti-patterns | 3 | GREEN | 3.0 |

```
total_score = 3.0 + 0.0 + (-1.5) + 2.0 + 0.0 + 2.0 + 3.0 = 8.5
max_score   = 3 + 3 + 3 + 2 + 2 + 2 + 3 = 18
percentage  = round((8.5 / 18) * 100) = 47%
rating      = WEAK
```

---

## 5. Token Analysis Method

### Estimating Current Size

Use this consistent approximation:
- **Token estimate** = character_count / 4 (rounded to nearest 50)
- **Overhead note**: YAML frontmatter and markdown formatting add approximately 10% to the functional token count (tokens consumed by formatting rather than content)

Report both character count and estimated tokens in the critique.

### Estimating Recommendation Deltas

For each recommendation in the critique, estimate the token impact:

| Action | Typical Token Delta |
|--------|-------------------|
| Add a quality gate (condition + action-on-fail) | +50 to +100 tokens |
| Add context usage instructions | +30 to +80 tokens |
| Apply compression to a section | -20% to -70% of that section's tokens |
| Remove over-specification or redundancy | -100% of the removed text's tokens |
| Add a few-shot example | +100 to +300 tokens per example |
| Add structural headers/delimiters | +10 to +30 tokens |
| Replace vague instructions with specific ones | +/- 0 to +50 tokens (usually net neutral) |

### Net Change Calculation

Sum the deltas from all recommendations to produce the "After recommendations" estimate. Report:
- Current size (chars / tokens)
- Estimated size after all recommendations applied
- Net change in absolute tokens and percentage

---

## 6. Critique Output Template

Every critique MUST use this exact structure. Do not add, remove, or reorder sections. Fill every field; use "N/A" only for truly inapplicable items (weight 0 categories).

````markdown
## Prompt Critique: [filename or first 50 chars of prompt]

**Type**: [System/Agent/Task/Template] | **Size**: [X chars / ~Y tokens] | **Rating**: [STRONG/ADEQUATE/WEAK/POOR] ([Z]%)

### Technique Scorecard

| Category | Weight | Status | Notes |
|----------|--------|--------|-------|
| Structural | [0-3] | [GREEN/YELLOW/RED/--] | [One-line finding] |
| Instructional Style | [0-3] | [GREEN/YELLOW/RED/--] | [One-line finding] |
| Quality Gates | [0-3] | [GREEN/YELLOW/RED/--] | [One-line finding] |
| Context Management | [0-3] | [GREEN/YELLOW/RED/--] | [One-line finding] |
| Compression | [0-3] | [GREEN/YELLOW/RED/--] | [One-line finding] |
| Cognitive | [0-3] | [GREEN/YELLOW/RED/--] | [One-line finding] |
| Anti-patterns | [0-3] | [GREEN/YELLOW/RED/--] | [One-line finding] |

*Status `--` means weight < 2, not scored for this prompt type.*

### Top Recommendations

*Ordered by impact = weight x improvement potential. Maximum 5 recommendations. Minimum 1 unless all categories are GREEN.*

**1. [Technique Name]** | Impact: [HIGH/MEDIUM/LOW]
- Current: `[quote the relevant section, max 200 chars]`
- Recommended: `[concrete rewrite]`
- Why: [One sentence explaining the measurable improvement]

**2. [Technique Name]** | Impact: [HIGH/MEDIUM/LOW]
- Current: `[quote]`
- Recommended: `[rewrite]`
- Why: [explanation]

[... up to 5]

### Anti-patterns Found

*List only if RED items exist in the scorecard. If no anti-patterns detected, write: "None detected."*

- **[CRITICAL/WARNING/INFO]** [Anti-pattern Name]: `[Specific text that triggered detection, max 200 chars]`
  - Fix: `[Concrete rewrite]`

### Token Analysis

| Metric | Value |
|--------|-------|
| Current size | [X chars / ~Y tokens] |
| After recommendations | [~Z tokens] |
| Net change | [+/-N tokens (+-P%)] |
````

### Template Rules

1. **Quoting**: All "Current" and anti-pattern trigger text must be verbatim quotes from the input prompt, enclosed in backticks.
2. **Recommendations are concrete**: Every "Recommended" field must contain actual rewritten text, not meta-instructions like "add a quality gate here."
3. **One recommendation per technique**: If multiple sub-techniques from the same category are missing, combine them into one recommendation for that category.
4. **Order is strict**: Recommendations are sorted by `weight x improvement_potential` descending. Ties are broken by category order in the scorecard (Structural first, Anti-patterns last).

---

## 7. Special Handling Rules

These rules override or supplement the general rubric for specific prompt types.

### System Prompts

- **Orphaned context is the top anti-pattern**. Always check: if dynamic context is injected (conversation history, user data, retrieved documents), are there explicit instructions telling the model HOW to use it? Orphaned context (injected but never referenced in instructions) is the single most common critical anti-pattern in system prompts. Flag as RED if detected.
- **Compression is always relevant** (weight 3). System prompts are loaded every single conversation turn. A 20% compression saves tokens on every API call.
- **Safety instructions** (if present) must have quality gates. A safety rule without a clear action-on-violation ("refuse", "ask for clarification", "flag and continue") is YELLOW at minimum.
- **Check for instruction decay**: Instructions near the end of long system prompts are more likely to be ignored. Critical behavioral rules should appear early. Flag if safety or behavioral instructions are buried past the 75th percentile of the prompt length.

### Agent Prompts

- **Frontmatter quality matters**. Check: Is the `description` field specific enough for another agent or orchestrator to decide when to invoke this agent? Vague descriptions like "helps with tasks" are YELLOW.
- **Tool access alignment**: If the agent declares tool access, do the instructions actually reference those tools? Declared but unused tools waste context. Used but undeclared tools will fail at runtime. Either mismatch is RED.
- **Quality gates are critical** (weight 3). Autonomous agents MUST have explicit success criteria and failure modes. An agent without quality gates will silently produce bad output. Flag absence as the top recommendation.
- **Handoff clarity**: If the agent is part of a multi-agent system, check for clear input/output contracts. What does this agent receive? What must it produce? Ambiguity here causes cascading failures.

### Task Prompts

- **Keep the critique lightweight**. Task prompts are ephemeral and single-use. Do not recommend adding structural scaffolding, compression, or template features.
- **Focus on cognitive techniques** (weight 3). The key question: Is the reasoning path clear? Does the prompt guide the model through complex logic, or does it dump requirements and hope for the best?
- **Compression is irrelevant** (weight 0). One-time token cost, so density optimization has no ongoing value.
- **Check for implicit assumptions**: Task prompts often assume context that the model does not have. Flag any instruction that requires knowledge not provided in the prompt itself.

### Templates

- **Context management is critical** (weight 3). Templates handle dynamic injection by design. Every variable/placeholder MUST have:
  - Documentation of expected format and constraints
  - Instructions for how the model should use the injected value
  - Graceful handling of edge cases (empty value, very long value, unexpected format)
- **Placeholder documentation**: Are all placeholders explained? An undocumented `{{context}}` is YELLOW. A placeholder with no usage instructions is RED (orphaned context anti-pattern).
- **Edge-case resilience**: Consider what happens with empty inputs, extremely long inputs, or inputs containing special characters (markdown, code blocks, delimiters that match the template's own structure). Flag potential breakage as YELLOW with a concrete example.

---

## 8. Critique Quality Checklist

Before finalizing any critique, verify these properties:

1. **Deterministic**: Another reviewer following this rubric would arrive at the same rating (+/- 5%).
2. **Actionable**: Every YELLOW and RED finding has a concrete, copy-pasteable fix.
3. **Calibrated**: The rating matches intuition. A prompt that "feels good" should score >= 60%. A prompt with obvious problems should score < 60%. If the score contradicts intuition, re-examine the category scores.
4. **Proportional**: Critique length is proportional to prompt complexity. A 3-line task prompt gets a brief critique. A 500-line system prompt gets a thorough one.
5. **Non-destructive**: Recommendations preserve the prompt's intent. Never suggest changes that would alter the fundamental behavior the prompt author intended.

---

## 9. Rating Calibration Examples

These examples anchor the rating scale to prevent drift:

**STRONG (80%+)**: The prompt has clear structure, explicit quality gates, efficient use of tokens, and no anti-patterns. Recommendations are polish-level: "consider compressing this reference section" or "add one more edge case to your quality gate."

**ADEQUATE (60-79%)**: The prompt works and has some good practices, but is missing 1-2 important technique categories. Typical: good structure but no quality gates, or has quality gates but orphaned context blocks.

**WEAK (40-59%)**: Multiple critical categories are missing. The prompt relies on the model "figuring it out" rather than providing clear guidance. Common: wall-of-text instructions with no structure, or heavily structured but with several active anti-patterns.

**POOR (<40%)**: Fundamental issues. The prompt either actively misleads the model (anti-patterns outweigh good practices) or is so sparse/vague that the model has insufficient guidance. Typical: a single paragraph of ambiguous instructions for a complex task, or a prompt riddled with contradictions and orphaned context.

---

## 10. Model-Specific Considerations

When critiquing prompts, note model-specific guidance where relevant. These considerations are additive to the category scoring -- they inform recommendations but do not change the scoring algorithm.

### Claude 4.x Behavioral Changes

All Claude 4.x models (Opus 4.5/4.6, Sonnet 4.5) have a key behavioral shift:

- **Literal instruction following**: Claude 4.x "takes you literally and does exactly what you ask for, nothing more." Previous versions would infer intent and expand on vague requests. This means:
  - Vague prompts that worked on Claude 3.x will underperform on 4.x
  - "Can you suggest changes?" → Claude may suggest rather than implement
  - Prefer imperative form: "Change this function to..." over "Can you suggest changes to..."
  - If you ask for a dashboard without specifying details, you may get a minimal frame

### Opus 4.6 Specific

- **Adaptive thinking**: Use `thinking: {type: "adaptive"}` with `effort` parameter instead of `budget_tokens`. In internal evaluations, adaptive thinking reliably drives better performance than extended thinking.
- **Dial back aggressive language**: Opus 4.6 is "more responsive to the system prompt than previous models." Prompts with "CRITICAL: You MUST..." that prevented undertriggering on older models now cause overtriggering. Use normal, calm language.
- **Safety gates required**: Without explicit guidance, Opus 4.6 may take actions that are difficult to reverse. Always include explicit safety gates for destructive operations.
- **Subagent tendency**: Opus 4.6 has a strong predilection for spawning subagents -- may do so unnecessarily. If this is unwanted, add guidance like "prefer direct action over delegation."
- **Anti-overengineering**: Opus tends to overengineer -- extra files, unnecessary abstractions. Consider including anti-overengineering directives.
- **Thinking sensitivity**: Sensitive to the word "think" and variants. When thinking is disabled, replace with "consider," "believe," "evaluate."

### Sonnet 4.5 Specific

- **Extended thinking**: Use `thinking: {type: "enabled", budget_tokens: N}`. Start with minimum (1024), increase incrementally.
- **Precise instruction following**: Prioritizes precise instructions over "helpful" guessing. Standard CoT prompting effective.
- **Best for**: Multi-file changes, debugging, architecture, daily coding tasks. Best speed/intelligence ratio.

### System Prompt Length Guidance

Community consensus and research findings on system prompt length:

| Metric | Recommendation | Source |
|--------|---------------|--------|
| Ideal length | < 60 lines of instructions | HumanLayer CLAUDE.md analysis |
| Maximum effective | < 300 lines | Community consensus |
| Instruction decay | Quality decreases as instruction count increases | Arize research |
| Periphery bias | Critical rules at beginning and end; middle gets least attention | Stanford "Lost in the Middle" |
| Compression ceiling | 20x compression possible with 1.5% quality loss | LLMLingua (Microsoft) |

**Implications for critique**: Flag system prompts exceeding ~8K tokens as YELLOW for compression opportunity. Flag >15K tokens as a strong recommendation to compress or modularize.

### Environment-Aware System Prompts

For system prompts that adapt to runtime environments (e.g., GAS scripts deployed across Sheets, Gmail, Docs, Slides), critique should check:

- **Environment context injection**: Is the current environment (which Google app, what data is available) injected as structured context?
- **Environment-specific instructions**: Do instructions adapt based on which service APIs are available? A Sheets-bound script has SpreadsheetApp; a Docs-bound script has DocumentApp.
- **Graceful degradation**: Does the prompt handle cases where expected environment context is missing or incomplete?
- **API surface awareness**: Are service-specific gotchas covered for each target environment (e.g., Sheets selection model vs Docs cursor model vs Slides page model)?

This is particularly relevant when the same system prompt is used across multiple Google Workspace apps with different capabilities and constraints.
