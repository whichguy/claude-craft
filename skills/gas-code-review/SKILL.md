---
name: gas-code-review
description: |
  **PREFER OVER code-reviewer** for GAS/Apps Script projects. Fast syntax and pattern validator.

  **AUTOMATICALLY INVOKE** when:
  - Code review, quality review, or validation in GAS context (scriptId present)
  - Reviewing .gs files in Apps Script projects
  - Detecting high-risk patterns: __events__, __global__, doGet/doPost/onOpen/onEdit
  - Before commits on GAS projects
  - User says "review", "check", "validate", "quality" with GAS code
  - Code snippet pasted containing: _main, __defineModule__, require(), module.exports

  **ALWAYS PAIR WITH:** gas-ui-review when .html files are also present (or use /gas-review for both)

  **NOT for:** General JS/TS (use code-reviewer), deep audit (use gas-quality-check), HTML patterns (use gas-ui-review)
model: claude-sonnet-4-6
allowed-tools: all
alwaysApply: false
---

# GAS Code Review (Slash Command Entry Point)

This skill invokes the `gas-code-review` agent. The full review logic lives in `~/.claude/agents/gas-code-review.md`.

## Usage

Invoke via `/gas-code-review` or by spawning the `gas-code-review` agent via Task tool.

## Behavior

When invoked as a slash command, spawn the `gas-code-review` agent with the provided code or file context:

```
Task(
  subagent_type="gas-code-review",
  description="Review GAS .gs files",
  prompt="Review these GAS JavaScript files for errors and suggestions:\n[file content or paths from context]"
)
```

The agent handles all phases: syntax errors → function usage errors → suggestions.
