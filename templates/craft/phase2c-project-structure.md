# Project Structure

## Technology Convention Alignment

**CRITICAL: This structure implements conventions documented in:**
`<WT>/planning/architecture.md` § Source Code Layout Conventions

**Before implementing tasks, review architecture.md for:**
- Official and community conventions researched
- Technology-specific directory organization decisions
- File naming conventions and rationale
- Import/module patterns
- Poly repo integration strategies
- Any deviations from standard conventions with rationale

This project structure follows [framework/language] conventions with specific adaptations for poly repo architecture.

---

## Existing Structure Assessment
- [Describe any existing repository structure]
- [Note established conventions to follow]
- [Identify existing code/projects to integrate with]
- [Starting fresh or working within existing codebase?]

## Repository Organization (Poly Repo Context)
- **This Repository's Role**: [Describe what this specific repository handles in the poly repo architecture]
- **Related Repositories**: [List other repositories in the poly repo and how they relate]
- **Shared Dependencies**: [Libraries/packages shared across repositories]
- **Inter-Repository Communication**: [How services/components communicate: REST APIs, events, message queues, etc.]

## Directory Layout (This Repository)
```
<WT>/
├── src/                    # Implementation code
│   ├── core/              # Core business logic
│   ├── services/          # External service integrations
│   ├── utils/             # Shared utilities
│   └── index.js           # Main entry point
├── test/                   # Test suites
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── docs/                   # Documentation
├── config/                 # Configuration templates
└── planning/               # Craft planning artifacts
```

## Module Organization
- [Explain the organizational principle: feature-based, layered, etc.]
- [Map which modules handle which responsibilities]
- [Note any modules/patterns inherited from existing structure]

## Key Entry Points
- [Main execution entry: src/index.js]
- [Test entry: test/index.test.js]
- [Configuration: config/*.json]

## Cross-Repository Integration Points
- [API endpoints consumed from other repositories]
- [API endpoints exposed to other repositories]
- [Shared data models or contracts]
- [Events published/subscribed across repositories]

## MCP Server Organization

**MCP Server Strategy:** [Co-located | Standalone | Shared]

**Rationale:** [Why this organization chosen - development workflow, deployment needs, reusability, team ownership]

**MCP Server Location (if co-located):**
```
<WT>/
├── src/                    # Service implementation code
├── mcp/                    # MCP server code (if co-located)
│   ├── server.js          # MCP server entry point
│   ├── tools/             # MCP tool implementations
│   │   ├── tool-one.js
│   │   └── tool-two.js
│   ├── config/            # MCP server configuration
│   └── README.md          # MCP server documentation
├── test/                   # Tests (including MCP tool tests)
└── ...
```

**Related MCP Server Repositories (if standalone/shared):**
- [Repository name]: [Purpose and capabilities]
- [How this service integrates with MCP servers in other repos]

**MCP Server Integration Points:**
- [Which operations this service exposes via MCP tools]
- [Which MCP tools in other repos this service uses]
- [Versioning strategy for MCP server APIs]
- [Authentication/authorization for MCP tool access]

## Task-Based Development Structure
```
<WT>/
├── planning/
│   ├── tasks-pending/      # End-to-end feature tasks awaiting implementation
│   ├── tasks-completed/    # Completed feature tasks with outcomes
│   └── learnings.md        # Cumulative lessons learned during implementation
```

**Purpose:**
- Each task defines complete end-to-end feature work (UI/API/schema/service/DB/etc) with quality verification, testing, and fix loops until tests pass and quality gates met.
- `learnings.md` captures insights discovered during implementation that weren't apparent during planning, creating a feedback loop that improves subsequent tasks.
