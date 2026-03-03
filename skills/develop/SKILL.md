---
name: develop
description: |
  Implement features end-to-end. Dispatches to feature-developer agent for complex
  multi-file features requiring planning, testing, and documentation.

  AUTOMATICALLY INVOKE when:
  - "build this", "implement this", "develop", "create this feature"
  - "add functionality", "new feature", "feature request"
  - Multi-file implementation tasks

  NOT for: Bug fixes (fix directly), refactoring (use /refactor), test generation (use /test)
allowed-tools: all
---

# /develop — Feature Development

Implement features from description to working code. Handles single-file additions
inline; dispatches to feature-developer agent for complex multi-file features.

## Step 0 — Parse Arguments

From the invocation args, extract:
- **feature**: Description of what to build
- **target**: Directory or module where the feature belongs
- **--plan-only**: Generate implementation plan without coding

If no feature description, ask what to build.

## Step 1 — Context Gathering

Before triaging, gather project context:
1. Check for existing architecture docs or task breakdowns
2. Scan target directory for existing patterns and conventions
3. Identify related existing code that the feature should integrate with

## Step 2 — Triage

**Fast path** (inline implementation):
- Single file addition or modification
- Clear requirements, no ambiguity
- No cross-file dependencies to manage
- Proceed to Step 3a

**Agent path** (full feature development):
- Multi-file feature spanning UI + backend
- Feature requiring tests, documentation updates
- Complex integration with existing systems
- Proceed to Step 3b

## Step 3a — Inline Implementation

1. Design the implementation approach (brief)
2. Write the code, matching existing codebase style
3. Run tests if they exist
4. Summarize what was built

## Step 3b — Agent Dispatch

```
Use the Agent tool:
  subagent_type: "feature-developer"
  prompt: "Implement feature: [feature description].
           Target: [target directory/module].
           Existing patterns: [patterns found in context gathering].
           [If --plan-only: generate implementation plan only, do not write code.]"
```

## Step 4 — Post-Processing

After implementation:
- Summarize what was built and where
- List files created/modified
- Run tests and report results
- Suggest: "Run /review to check quality" or "Run /test to add coverage"
