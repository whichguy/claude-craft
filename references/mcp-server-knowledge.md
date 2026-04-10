---
description: MCP server implementation best practices, spec features, and review checklist
alwaysApply: false
---

# MCP Server Knowledge

Quick reference for MCP server implementation patterns, SDK features, and review criteria.

## MCP SDK v1.26.0 Feature Catalog

### Tool Annotations
Per-tool metadata hints for client behavior. ~20 tokens/tool — always add.

```typescript
annotations: {
  readOnlyHint: true,      // No side effects (reads, searches, status)
  destructiveHint: true,   // Deletes or overwrites data irreversibly
  idempotentHint: true,    // Safe to retry (same input = same result)
  openWorldHint: true      // Interacts with external systems
}
```

**Classification rules:**
- `readOnlyHint: true` — ls, cat, grep, find, status, deps, list operations
- `destructiveHint: true` — rm, overwrite without backup, deploy to prod
- `idempotentHint: true` — write (same content = same result), config set
- `openWorldHint: true` — API calls, exec, deploy, anything hitting network

### outputSchema
Structured JSON Schema for tool responses. ~200-800 tokens/tool — add selectively for complex responses.

```typescript
outputSchema: {
  type: "object",
  properties: {
    files: { type: "array", items: { type: "string" } },
    count: { type: "integer" }
  }
}
```

**When to add:** Complex structured responses, responses parsed programmatically, high-frequency tools where accuracy matters.
**When to skip:** Simple text responses, tools returning human-readable messages, low-frequency tools.

### Resources
Read-only data endpoints exposed via `resources/list` and `resources/read`. Cost: ~0 tokens on ListTools (separate endpoint).

- Static resources: config files, documentation, schemas
- Dynamic resources with URI templates: `gas://project/{scriptId}/files`
- Suitable for data that changes infrequently and is consumed by reference

### Resource Subscriptions
Clients subscribe to resource URIs for change notifications via `notifications/resources/updated`.

**Prerequisite:** A client must actually consume subscriptions — otherwise dead code.

### Prompts
Reusable prompt templates exposed via `prompts/list` and `prompts/get`. Useful for standardized workflows (e.g., "review this GAS project", "debug this execution error").

### Logging
`server.sendLoggingMessage()` — structured log messages to client with severity levels (debug, info, warning, error, critical).

### Progress Notifications
Long-running operations report progress via `notifications/progress` with `progressToken`, `progress`, and `total` fields. Use for operations >2s (deploys, bulk syncs).

### Experimental: Tasks
Server-initiated background tasks with status tracking. Spec is not yet stable — avoid in production.

## Best Practices

### Tool Naming
- **snake_case** for all tool names: `file_status`, `cloud_logs`, `git_feature`
- Namespace with category prefix for large servers: `fs_read`, `fs_write`, `git_commit`

### Description Format
```
[CATEGORY] Purpose. WHEN: use cases. AVOID: alternatives. Example: usage
```

Example:
```
[FILE] Read file contents with CommonJS unwrapping. WHEN: viewing/editing GAS source files. AVOID: raw_cat (shows system wrappers). Example: cat({scriptId, path: "Code.js"})
```

Keep descriptions 50-100 tokens. High accuracy value per token.

### Shared Patterns
- **SchemaFragments** — reuse common parameter definitions (scriptId, path, options) across tools
- **GuidanceFragments** — share llmGuidance blocks for tool groups (file tools, git tools)

### llmGuidance
Compress aggressively. Include only accuracy-critical signals:
- When to choose this tool over alternatives
- Required parameter combinations
- Response interpretation hints
- Common error recovery steps

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Declared capability, no implementation | `logging: {}` in capabilities but no tool logs | Only declare what you use |
| outputSchema on everything | +200-800 tokens/tool on ListTools | Add only for complex/high-frequency responses |
| Resource subscriptions without consumers | Dead code, wasted capability declaration | Verify client support first |
| Verbose llmGuidance restating description | Token waste, no accuracy gain | Only add info not in description |
| `scriptTypeCompatibility: 'Full Support'` everywhere | Noise, no signal | Only note exceptions/limitations |
| Returning sensitive data in tool responses | Tokens, credentials in context | Mask tokens, redact secrets |

## Decision Tree: Adding MCP Features

```
Want to add an MCP feature?
  |
  +-- Does a consumer exist? (Client must support it)
  |     NO --> Don't add. Dead code.
  |     YES |
  |         +-- What's the token impact on ListTools?
  |         |     HIGH (>100 tokens/tool) --> Is accuracy gain worth it?
  |         |     LOW (<50 tokens/tool)   --> Likely worth adding
  |         |
  |         +-- Does it improve accuracy?
  |         |     YES --> Add it (tool selection, usage, or response parsing)
  |         |     NO  --> Skip unless zero-cost
  |         |
  |         +-- Is there a simpler alternative?
  |               Description text sufficient? --> Use description
  |               Need structured data?        --> Use outputSchema
  |               Need typed hints?             --> Use annotations
```

## Token Budget Per Feature

| Feature | Tokens/Tool | On ListTools? | Recommendation |
|---|---|---|---|
| annotations | ~20 | Yes | Always add |
| description | ~50-100 | Yes | Always add, compress |
| llmGuidance | ~50-500 | Yes | Compress aggressively |
| outputSchema | ~200-800 | Yes | Selective — complex/high-frequency only |
| resources | ~0 | No (separate) | Add freely when useful |
| prompts | ~0 | No (separate) | Add freely when useful |

## Review Checklist

### Required
- [ ] All tools have annotations (readOnlyHint at minimum)
- [ ] Tool names are snake_case
- [ ] Descriptions follow structured format (50-100 tokens)
- [ ] Input validation on all required parameters
- [ ] Error hierarchy with user-friendly messages
- [ ] No sensitive data in tool responses (token masking)

### Recommended
- [ ] High-frequency tools have outputSchema
- [ ] Declared capabilities are actually implemented
- [ ] llmGuidance adds info not already in description
- [ ] SchemaFragments used for repeated parameter patterns
- [ ] Progress notifications for operations >2s
- [ ] Logging used for debugging, not just declared
