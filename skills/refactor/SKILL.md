---
name: refactor
description: |
  Refactor code for improved quality and structure. Dispatches to code-refactor agent
  for large multi-file refactoring operations.

  AUTOMATICALLY INVOKE when:
  - "refactor this", "clean up", "reduce duplication", "DRY this up"
  - "simplify", "modernize", "restructure"
  - When detecting code duplication or technical debt

  NOT for: Bug fixes (fix the bug directly), feature additions (use superpowers:executing-plans)
allowed-tools: all
---

# /refactor — Code Refactoring

Improve code quality and structure without changing behavior. Supports targeted
single-file cleanup and large multi-file restructuring.

## Step 0 — Parse Arguments

From the invocation args, extract:
- **target_files**: Files or directories to refactor
- **focus**: What to improve — one of:
  - `naming` — improve variable/function names
  - `duplication` — extract shared logic, DRY up
  - `structure` — reorganize modules, improve cohesion
  - `modernize` — update to current language idioms
  - `all` — comprehensive refactoring (default)
- **--dry-run**: Show proposed changes without applying

If no target specified, ask what to refactor.

## Step 1 — Triage

**Fast path** (inline refactoring):
- Single file < 100 lines
- Clear focus area (naming, one duplication instance)
- Proceed to Step 2a

**Agent path** (dispatch):
- Multiple files or directory-level refactoring
- Large file (> 100 lines) with structural changes
- Cross-file duplication extraction
- Proceed to Step 2b

## Step 2a — Inline Refactoring

1. Read the target file completely
2. Identify refactoring opportunities based on focus:
   - **naming**: Inconsistent conventions, unclear abbreviations, misleading names
   - **duplication**: Copy-pasted blocks, similar functions that differ slightly
   - **structure**: God functions, mixed concerns, deep nesting
   - **modernize**: Outdated patterns, deprecated APIs, verbose constructs
3. Apply changes, preserving all existing behavior
4. If --dry-run: show diff without writing

## Step 2b — Agent Dispatch

When taking the agent path, create a tracking task:
```
TaskCreate({
  subject: "Refactor [target] — [focus]",
  description: "Multi-file refactoring via code-refactor agent. Focus: [focus].",
  activeForm: "Refactoring [target]"
})
```
Mark in_progress on dispatch, completed when agent returns and tests pass.

```
Use the Agent tool:
  subagent_type: "code-refactor"
  prompt: "Refactor [target_files] with focus on [focus].
           Preserve all existing behavior. Run tests after each change.
           [If --dry-run: report proposed changes without applying.]"
```

## Step 3 — Post-Processing

After refactoring:
- Summarize what changed and why
- Run tests to verify behavior is preserved
- If tests fail, revert and report the issue
