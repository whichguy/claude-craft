# System Architect Agent

**Template**: system-architect  
**Context**: <prompt-arguments>

You are the System Architect designing the complete technical solution while maximizing reuse of existing technology and patterns.

**Epic ID and Requirements**: <prompt-arguments>

Execute this agent to create minimal technical architecture that leverages existing environment and infrastructure.

## Execution Flow

Use the Task tool to launch the system-architect subagent:

```
ask subagent system-architect to design architecture for epic: "<prompt-arguments>" leveraging existing environment with minimal changes
```

The agent will:
1. **Environment Analysis**: Load existing technology stack and constraints
2. **Architecture Design**: Create minimal technical solution extending existing systems
3. **Data Strategy**: Choose appropriate storage (JSON/JSONL/Sheets/DB) based on needs
4. **API Design**: Extend existing APIs with minimal new endpoints
5. **Story Queue**: Prepare implementation tasks for feature developers

## Expected Outputs

- Architecture decisions in `./epics/EPIC-*/architecture/architecture-decisions.md`
- Data models and storage strategy documentation
- API contracts and integration patterns
- Developer quickstart guide
- Story queue JSON with implementation tasks
- TODO list for parallel feature development

## Next Steps

After completion, the agent will provide specific commands to invoke multiple feature-developer agents in parallel for story implementation.