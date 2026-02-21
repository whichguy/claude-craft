# Tooling Integration: [Epic Name]

## MCP Server Integration
- **[Server Name]**:
  * **Setup**: [Configuration steps]
  * **Authentication**: [How to authenticate]
  * **Integration Pattern**: [How to use in code]
  * **Best Practices**: [Patterns discovered]

## Subagent Orchestration
- **[Agent Type]**:
  * **When to Use**: [Scenarios where this agent adds value]
  * **Context Required**: [What context to provide]
  * **Coordination**: [How to orchestrate multiple agents]

## External API Integration
- **[API Name]**:
  * **Error Handling**: [Retry strategy, fallbacks]
  * **Rate Limiting**: [Approach to avoid hitting limits]
  * **Authentication**: [OAuth flow, API key management]

## Testing & Quality Tools
- **[Tool Name]**:
  * **Purpose**: [What this tool validates]
  * **Integration**: [How to run in workflow]
  * **Quality Gates**: [Pass/fail criteria]

## Deployment & Monitoring
- **[Tool/Service]**:
  * **Deployment Pattern**: [How to deploy]
  * **Monitoring**: [What to observe]
  * **Alerting**: [When to notify]

---

# Tooling Integration Plan

**Purpose:** How discovered tools from Stage 3 will be integrated into the development workflow.

## MCP Servers

### [Server Name 1]
- **Capabilities**: [What it provides]
- **When Used**: [Which phases/iterations]
- **Repository Organization**: [Co-located in this repo at ./mcp/ | Standalone repo at <URL> | Part of shared server repo at <URL>]
- **Organization Rationale**: [Why this organization - matches project-structure.md MCP Server Strategy]
- **Setup Required**:
  - Installation: [npm install command or instructions]
  - Configuration: [Config files, environment variables]
  - Authentication: [Reference to infrastructure-ids.md]
- **Integration Pattern**: [How accessed - direct calls, wrapper]
- **Example Usage**: [Brief code example or workflow description]

### [Server Name 2]
...

## Claude Code Subagents

### Code Review (code-reviewer)
- **When Invoked**: After implementation in each iteration, before considering code complete
- **Parameters Needed**: path to src/, iteration number, focus areas from criteria
- **Expected Output**: Review results with blocking/minor issues, file:line references
- **Integration**: Blocking issues must be resolved before proceeding to next iteration step

### [Other Subagents]
...

## External APIs & Services

### [API Name 1]
- **Purpose**: [What use case it supports]
- **Authentication**: [Reference to infrastructure-ids.md entry]
- **Integration Pattern**: [Direct/Abstraction/MCP wrapper - with reasoning]
- **Error Handling**: [Retry logic, fallback behavior]
- **Rate Limits**: [Limits to respect, throttling strategy]
- **When Used**: [Which implementation phases]

### [API Name 2]
...

## Testing & Quality Tools

### Unit Testing
- **Framework**: Mocha + Chai (already established)
- **When Run**: After each implementation, in verification loop
- **Coverage Target**: [Percentage from quality criteria]

### Integration Testing
- **Tools**: [Browser automation, API testing tools]
- **When Run**: [Which iterations, frequency]
- **Test Scope**: [What integration points covered]

### Performance Testing
- **Tools**: [Profiling tools if needed]
- **When Run**: [After implementation complete, or specific iterations]
- **Metrics**: [NFR thresholds from Stage 2]

### Security Scanning
- **Tools**: [Static analysis, dependency scanning]
- **When Run**: [Before final delivery, or continuously]
- **Focus**: [Vulnerability types from Stage 2 security requirements]

## Integration Workflow

**Phase 2-C (Planning):**
- Set up MCP servers: [Installation and configuration steps]
- Verify subagent availability: [Check Task tool subagent list]
- Configure external API access: [Auth setup, test connectivity]
- Install testing tools: [npm install commands]

**Phase 3 Iterations:**
- **Step 2 (Plan)**: Reference this document for tool usage in iteration
- **Step 3 (Craft)**:
  - Use MCP servers for: [Specific operations]
  - Call external APIs for: [Specific integrations]
- **Step 4 (Verify)**:
  - Run test suite (Mocha/Chai)
  - Invoke code-reviewer subagent
  - Run integration tests if applicable
  - Run performance/security tools if applicable

**Phase 4 (Delivery):**
- Final quality tool runs
- Complete integration validation
- Performance verification against NFRs

## Setup Checklist

Before starting Phase 3 implementation, verify:
- [ ] All MCP servers installed and configured
- [ ] MCP server authentication tested (if required)
- [ ] Subagent availability confirmed
- [ ] External API credentials in environment (per infrastructure-ids.md)
- [ ] External API connectivity tested
- [ ] Testing tools installed (npm packages)
- [ ] Tooling integration documented in this file

## References
- Stage 3 Architecture: `<WT>/planning/architecture.md` (technical decisions)
- Stage 3 Tooling: `<WT>/planning/tooling.md` (discovered tools)
- Infrastructure IDs: `<WT>/planning/infrastructure-ids.md` (credentials, endpoints)
- Quality Criteria: `<WT>/planning/quality-criteria.md` (quality thresholds, tool targets)
