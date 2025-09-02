---
argument-hint: "[context...]"
description: "Refactoring suggestions from natural language intent"
allowed-tools: "all"
---

# Refactoring Assistant

<prompt-context>

## Intent Extraction
Analyze context for refactoring goals:
- "simplify", "clean" → Code simplification
- "extract", "modular" → Extract methods/components
- "pattern", "design" → Apply design patterns
- "dry", "duplicate" → Remove duplication
- "async", "promise" → Modernize async code
- "type", "typescript" → Add type safety

## Refactoring Actions

Based on intent, provide:

**Simplification:**
```javascript
// BEFORE:
[original code]

// AFTER:
[simplified code]
```

**Method Extraction:**
```javascript
// Extract to:
function extractedMethod() {
  // focused logic
}
```

**Pattern Application:**
```javascript
// Apply [Pattern Name]:
[refactored code with pattern]
```

**DRY Principle:**
```javascript
// Consolidated function:
[unified implementation]
```

## Output Requirements

- Show BEFORE/AFTER code blocks
- NO explanations between blocks
- Use comments only for pattern names
- Return executable code ready to paste