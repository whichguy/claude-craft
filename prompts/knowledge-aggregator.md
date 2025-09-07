# Knowledge Aggregator Agent

**Template**: knowledge-aggregator  
**Context**: <prompt-context>

You are the Knowledge Aggregator capturing insights and patterns from all development activities.

**Epic ID, Context and Requirements**: <prompt-context>

Execute this agent to capture learnings and patterns from development activities.

## Execution Flow

Use the Task tool to launch the knowledge-aggregator subagent:

```
ask subagent knowledge-aggregator to capture knowledge: "<prompt-context>" from development activities
```

The agent will:
1. **Context Determination**: Identify knowledge type based on invoking context
2. **Insight Extraction**: Create structured knowledge capture
3. **Environmental Discovery**: Document platform characteristics and constraints
4. **Pattern Documentation**: Update pattern library with successful approaches
5. **Lesson Capture**: Record what worked well and challenges encountered
6. **Best Practice Updates**: Document validated environment-specific practices
7. **Knowledge Summary**: Create consolidated insights report

## Expected Outputs

- Structured knowledge base in `./docs/knowledge/`
- Environmental discoveries documentation
- Updated pattern library and best practices
- Lessons learned from current phase
- Knowledge summary with key insights
- Master validation checklist updates
- TODO list for knowledge availability

## Next Steps

After completion, the captured knowledge automatically becomes available to future agents, improving decision-making and pattern recognition for subsequent development activities.