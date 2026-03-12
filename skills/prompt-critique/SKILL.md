---
name: prompt-critique
description: |
  Fast prompt critique tool with technique library. Analyzes any prompt against 7 technique
  categories and 14 anti-patterns, producing a scorecard with prioritized recommendations.

  **AUTOMATICALLY INVOKE** when:
  - User says "critique prompt", "score this prompt", "improve this prompt"
  - User asks "what techniques should I use", "prompt best practices"
  - User pastes a system prompt, agent prompt, or skill definition for feedback
  - User mentions "prompt anti-patterns", "prompt quality", "score this prompt"
  - User asks about instructional style, quality gates, or compression techniques

  **NOT for:**
  - Exhaustive multi-phase analysis (use /prompt-reviewer)
  - A/B prompt comparison with execution (use compare-prompts)
  - GAS-specific system prompt optimization (use /optimize-system-prompt)
model: claude-sonnet-4-6
allowed-tools: all
---

# Prompt Critique

Fast, practical prompt analysis. Produces a technique scorecard, anti-pattern flags, and prioritized recommendations with before/after examples.

## Technique Index

7 categories with model-specific guidance (Opus 4.6, Sonnet 4.5). Full examples and tradeoffs in `references/technique-library.md`.

| # | Category | Key Question | Sub-techniques |
|---|----------|-------------|----------------|
| 1 | **Structural** | Is the prompt well-organized? | XML tags, prompt-as-code, hierarchical structure, information architecture, modular composition |
| 2 | **Instructional Style** | Is the right style used for each concern? | Instructive, directional, imperative, declarative, motivated instructions (explain WHY), affirmative framing |
| 3 | **Quality Gates** | Are there checkpoints for output quality? | Hard gates (binary), soft gates (threshold), self-validation, progressive gates, gate placement |
| 4 | **Context Management** | Is dynamic context handled correctly? | Context injection, context priming, usage instructions, long context placement, budget priority |
| 5 | **Compression** | Is the prompt token-efficient? | Prose→directives, examples→snippets, narrative→tables, remove known knowledge, merge redundant |
| 6 | **Cognitive** | Does it leverage LLM reasoning well? | Extended/adaptive thinking, CoT scaffolding, few-shot examples, quote extraction, metacognitive prompts |
| 7 | **Anti-patterns** | Is anything actively hurting the prompt? | 14 cataloged anti-patterns (see `references/anti-patterns.md`) |

### Style Selection Quick Reference

| Context | Best Style | Why |
|---------|-----------|-----|
| Safety-critical rules | Imperative | Non-negotiable, memorable |
| Complex procedures | Instructive | Steps prevent skipping |
| Creative/flexible tasks | Directional | Room for judgment |
| Output specifications | Declarative | Contract-style clarity |
| Mixed concerns | Layer: imperative for rules, directional for approach | Match style to concern |

## Critique Workflow

When given a prompt to critique, follow these 5 steps:

### Step 1: Classify
Determine prompt type using the classification rules in `references/critique-rubric.md`:
- **Agent Prompt**: Has YAML frontmatter with `name:` field
- **Template**: Has `{{variables}}` or `<prompt-arguments>` placeholders
- **System Prompt**: Starts with "You are" or defines persistent role/behavior
- **Task Prompt**: Everything else

### Step 2: Scan
Read the prompt and identify which techniques from each category are currently used. Note specific text that demonstrates each technique (or its absence). Load `references/technique-library.md` for comparison.

### Step 3: Score
Apply the relevance matrix from `references/critique-rubric.md` to weight categories by prompt type. For each category with weight >= 2:
- **GREEN**: Technique present and correctly applied
- **YELLOW**: Missing but would improve the prompt (note expected impact)
- **RED**: Anti-pattern detected (load `references/anti-patterns.md` to identify)

Calculate composite score using the rubric's scoring algorithm.

### Step 4: Recommend
Select the top 3-5 improvements ordered by impact (weight x improvement potential). For each:
- Quote the current text
- Provide a concrete rewrite
- State why it's better in one sentence

### Step 5: Flag
List any anti-patterns found with severity (CRITICAL/WARNING/INFO) and fixes.

## Output Format

Every critique MUST follow this template:

```markdown
## Prompt Critique: [filename or first 50 chars]

**Type**: [System/Agent/Task/Template] | **Size**: [X chars / ~Y tokens] | **Rating**: [STRONG/ADEQUATE/WEAK/POOR] ([Z]%)

### Technique Scorecard

| Category | Weight | Status | Notes |
|----------|--------|--------|-------|
| Structural | [0-3] | [GREEN/YELLOW/RED] | [one-line finding] |
| Instructional Style | [0-3] | [GREEN/YELLOW/RED] | [one-line finding] |
| Quality Gates | [0-3] | [GREEN/YELLOW/RED] | [one-line finding] |
| Context Management | [0-3] | [GREEN/YELLOW/RED] | [one-line finding] |
| Compression | [0-3] | [GREEN/YELLOW/RED] | [one-line finding] |
| Cognitive | [0-3] | [GREEN/YELLOW/RED] | [one-line finding] |
| Anti-patterns | [0-3] | [GREEN/YELLOW/RED] | [one-line finding] |

### Top Recommendations

1. **[Technique]** | Impact: [HIGH/MED/LOW]
   Current: `[quote relevant section]`
   Recommended: `[concrete rewrite]`
   Why: [one sentence]

### Anti-patterns Found

- **[SEVERITY]** [Name]: [specific text that triggered] → [fix]

### Token Analysis

Current: ~X tokens | After recommendations: ~Y tokens | Change: [±Z%]
```

## Rating Scale

| Rating | Score | Meaning |
|--------|-------|---------|
| STRONG | >= 80% | Minor improvements possible, well-crafted |
| ADEQUATE | 60-79% | Meaningful improvements available |
| WEAK | 40-59% | Significant technique gaps |
| POOR | < 40% | Major rework recommended |

## When to Use What

| Need | Tool |
|------|------|
| Quick technique check + recommendations | `/prompt-critique` (this skill) |
| Exhaustive 9-phase deep analysis | `/prompt-reviewer` |
| Compare two prompt versions with scoring | `compare-prompts` |
| GAS system prompt refinement, compression + A/B testing | `/optimize-system-prompt` |

## References

- `references/technique-library.md` - Full technique catalog with before/after examples
- `references/anti-patterns.md` - 14 anti-patterns with detection, examples, and fixes
- `references/critique-rubric.md` - Classification rules, scoring algorithm, output template
