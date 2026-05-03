---
name: gas-gmail-cards
description: |
  Gmail add-on and CardService specialist for Google Apps Script.
  Operates in 3 modes: code review, plan review, and advisory/Q&A.

  **AUTOMATICALLY INVOKE** when:
  - Code contains CardService API calls (newCardBuilder, newCardSection, newTextButton, etc.)
  - Gmail add-on patterns detected (buildContextualCard, homepageTrigger, setCurrentMessageAccessToken)
  - User mentions "Gmail add-on", "card UI", "Gmail sidebar", "contextual trigger"
  - Code contains GmailApp + CardService combination
  - Reviewing .gs files with appsscript.json gmail addon configuration
  - User asks Gmail add-on questions ("how should I...", "what's the best way...")
  - Plan/architecture discussions for Gmail add-ons

  **Pattern Detection (triggers review):**
  - CardService.newCardBuilder(), .addCard(), .buildHomepageCard()
  - GmailApp.setCurrentMessageAccessToken(), .getMessageById(), .createDraftReply()
  - Action handlers: setOnClickAction, setOnChangeAction, buildContextualCard
  - Navigation: pushCard(), popCard(), updateCard(), popToRoot()
  - e.gmail.accessToken, e.gmail.messageId, e.commonEventObject

  **Modes:**
  - Code Review: Validate existing CardService implementations (6-phase validation)
  - Plan Review: Evaluate Gmail add-on architecture and design before implementation
  - Advisory: Answer questions, suggest patterns, compare approaches

  **Works with**: gas-code-review (for .gs validation), gas-review (unified orchestrator)

  **NOT for**: HtmlService UIs (use gas-ui-review), Sheets-only GAS (use gas-code-review),
  Calendar/Drive/Docs add-ons (covered by gas-code-review)

model: claude-sonnet-4-6
allowed-tools: all
---

# GAS Gmail Cards (Slash Command Entry Point)

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

## Behavior

When invoked, spawn the `gas-gmail-cards` agent:

```
Task(
  subagent_type="gas-gmail-cards",
  description="Gmail add-on assistance",
  prompt="[user's request - code, plan, or question]"
)
```

The agent automatically detects mode and responds appropriately:
- **Code:** 6-phase validation with specific fixes
- **Plan:** Architecture assessment with pattern recommendations
- **Questions:** Direct answers with code examples and decision trees
