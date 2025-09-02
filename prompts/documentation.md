---
argument-hint: "[context...]"
description: "Generate documentation from intent"
allowed-tools: "all"
---

# Documentation Generator

<prompt-context>

## Intent Detection
Analyze for documentation type:
- "api" → API documentation
- "readme" → README file
- "jsdoc", "docstring" → Inline documentation
- "usage", "example" → Usage examples
- "architecture" → System design docs

## Documentation Output

Based on intent:

**API Documentation:**
```markdown
## `functionName(param1, param2)`

**Parameters:**
- `param1` (Type): Description
- `param2` (Type): Description

**Returns:** Type - Description

**Example:**
\```javascript
const result = functionName(value1, value2);
\```
```

**JSDoc Format:**
```javascript
/**
 * Brief description
 * @param {Type} param1 - Description
 * @param {Type} param2 - Description
 * @returns {Type} Description
 * @example
 * functionName(arg1, arg2);
 */
```

**README Section:**
```markdown
## Installation
\```bash
npm install package-name
\```

## Usage
\```javascript
const pkg = require('package-name');
pkg.method();
\```
```

## Output Rules

- Raw markdown or code comments only
- NO wrapper text like "Here's the documentation"
- NO code block fences around JSDoc (already in comment format)
- Include code examples inline
- Format ready for direct insertion
- Start immediately with the documentation content