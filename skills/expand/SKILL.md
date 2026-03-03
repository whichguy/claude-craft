---
name: expand
description: |
  Transform epics into comprehensive use case specifications via progressive discovery.
  Dispatches to use-case-expander agent for complex epics.

  AUTOMATICALLY INVOKE when:
  - "expand use cases", "discover scenarios", "edge cases", "what are we missing"
  - "expand this epic", "use case expansion", "scenario discovery"
  - Use case analysis or scenario planning

  NOT for: Task breakdown (use /tasks), architecture (use /architect)
argument-hint: "<epic-file-or-text> [--output <dir>] [--concise]"
allowed-tools: all
---

# /expand — Use Case Expansion

Transform high-level epics into comprehensive use case specifications by uncovering
explicit, implicit, and cascading use cases.

## Step 0 — Parse Arguments

From the invocation args, extract:
- **epic**: File path to epic document OR inline epic text
- **--output <dir>**: Directory to write output files (default: stdout)
- **--concise**: Final results only, skip discovery reasoning

Validate:
- If file path: verify it exists with Read tool
- If --output: verify directory exists
- If neither file nor text: ask for the epic

## Step 1 — Triage

Estimate epic complexity:

**Fast path** (inline expansion):
- Short epic (< 500 words)
- Single user role, clear scope
- Proceed to Step 2a

**Agent path** (full expansion):
- Long epic or multi-role system
- Complex domain with regulatory/compliance needs
- Multiple integration points
- Proceed to Step 2b

## Step 2a — Inline Expansion

For the epic, discover use cases in three layers:

1. **Explicit**: Directly stated requirements and user actions
2. **Implicit**: Unstated but necessary (auth, error handling, data validation, empty states)
3. **Cascading**: Second-order effects (what happens when X fails? what if concurrent users?)

Format each use case:
```
### UC-[N]: [Name]
**Actor**: [who]
**Trigger**: [what starts this]
**Flow**: [numbered steps]
**Alternatives**: [error paths, edge cases]
```

## Step 2b — Agent Dispatch

```
Use the Agent tool:
  subagent_type: "use-case-expander"
  prompt: "Expand this epic into comprehensive use cases: [epic content].
           [If --output: write results to [dir]]
           [If --concise: final results only, skip discovery reasoning]"
```

## Step 3 — Output

After expansion:
- If --output: write to specified directory
- If --concise: present only the final use case list
- Otherwise: include discovery reasoning and the use case list
- Summarize: "[N] use cases discovered ([X] explicit, [Y] implicit, [Z] cascading)"
