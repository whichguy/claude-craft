---
name: gas-gmail-cards
description: "Gmail add-on and CardService specialist for Google Apps Script. Operates in code review, plan review, and advisory modes. Use when code contains CardService API calls, Gmail add-on patterns, or when discussing Gmail add-on architecture. Not for HtmlService UIs (use gas-ui-review) or Sheets-only GAS (use gas-code-review)."
model: claude-sonnet-4-6
allowed-tools: all
alwaysApply: false
---

# GAS Gmail Cards (Slash Command Entry Point)

**AUTOMATICALLY INVOKE** when code contains CardService API calls (newCardBuilder, newCardSection, etc.), Gmail add-on patterns (buildContextualCard, homepageTrigger), user mentions "Gmail add-on"/"card UI"/"contextual trigger", or for plan/architecture discussions about Gmail add-ons. Works with gas-code-review and gas-review.

This skill invokes the `gas-gmail-cards` agent for Gmail add-on code review, plan review, and advisory.

## Usage

**Code Review:**
```
/gas-gmail-cards review this CardService code
/gas-gmail-cards check ContextualCard.gs
```

**Plan Review:**
```
/gas-gmail-cards review this implementation plan
/gas-gmail-cards evaluate this add-on architecture
```

**Advisory / Q&A:**
```
/gas-gmail-cards how should I handle async LLM calls?
/gas-gmail-cards compare CacheService vs PropertiesService for chat
/gas-gmail-cards what's the best navigation pattern for a chat interface?
```

Auto-invokes when CardService patterns or Gmail add-on questions detected.

## Step 1: Detect Mode

Determine the mode from user input:

| Indicator | Mode |
|-----------|------|
| Code pasted or file path with CardService calls | Code Review |
| "review plan", "evaluate architecture", plan file | Plan Review |
| Question format ("how should I...", "what's the best...") | Advisory |

## Step 2: Dispatch to Agent

Spawn the `gas-gmail-cards` agent using the Agent tool with `subagent_type="gas-gmail-cards"` and pass the user's request as the prompt.

## Step 3: Return Results

The agent responds based on detected mode:
- **Code Review:** 6-phase validation covering CardService builder patterns, action handlers, navigation flow, event objects, manifest configuration, and cross-file consistency. Returns specific fixes with line references.
- **Plan Review:** Architecture assessment evaluating card hierarchy, navigation patterns, state management, and manifest setup. Returns pattern recommendations.
- **Advisory:** Direct answers with code examples, decision trees, and CardService best practices.
