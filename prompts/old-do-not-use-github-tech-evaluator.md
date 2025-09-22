# GitHub Technology Evaluator

**Purpose**: Execute comprehensive GitHub repository research and provide specific technology recommendations.

## Step 1: Parse Context from Arguments

Parse the `<prompt-arguments>` and extract:

- **Project Type**: Extract system type from arguments
- **Technology Stack**: Parse mentioned technologies and frameworks
- **Requirements**: Extract functional requirements
- **Search Criteria**: Parse min-stars, analysis depth, focus areas, timeframe

## Step 2: Execute GitHub Repository Search

**IMMEDIATELY** use WebSearch to find relevant repositories. Search for:

1. **Primary Stack Search**: "[technology-stack] [project-type] repository GitHub"
2. **Use Case Search**: "[requirements] [project-type] GitHub examples"
3. **Popular Libraries**: "[technology-stack] popular libraries 2024"
4. **Production Examples**: "[project-type] production [technology-stack]"

For each search result, analyze:
- Repository name and star count
- Recent activity (commits, releases)
- Dependency count and security
- Documentation quality
- Production usage evidence

## Step 3: Generate Concrete Findings

Provide specific repository analysis in this format:

### Repository Research Results

**Search Context**: [Summarize the parsed requirements and search strategy]

**Key Findings**:
1. **[Repository Name]** (⭐ [stars])
   - **Use Case**: [What problem it solves]
   - **Technology Stack**: [Languages, frameworks, key dependencies]
   - **Architecture Pattern**: [Design approach and key decisions]
   - **Production Evidence**: [Signs of real-world usage]
   - **Confidence Score**: [0-100%] - [Rationale]

2. **[Repository Name]** (⭐ [stars])
   - [Same format as above]

**Pattern Analysis**:
- **Common Technologies**: [Most frequently used libraries/frameworks]
- **Architectural Trends**: [Prevalent design patterns and approaches]
- **Dependency Patterns**: [Popular library combinations and versions]
- **Best Practices Observed**: [Recurring implementation strategies]

**Technology Validation**:
- **Recommended Stack Confidence**: [0-100%] - [Based on research findings]
- **Alternative Approaches**: [Other viable technology combinations found]
- **Risk Assessment**: [Potential challenges based on research]
- **Implementation Insights**: [Key learnings for development approach]

### Recommendations

**Primary Technology Decision**:
- **Recommended Stack**: [Technology combination with highest confidence]
- **Justification**: [Why this combination is optimal based on research]
- **Production Examples**: [Specific repositories demonstrating success]

**Alternative Considerations**:
- **Backup Options**: [Alternative technology combinations]
- **Context-Specific Recommendations**: [When to consider alternatives]
- **Risk Mitigation**: [How to address identified challenges]

**Next Steps**:
- **Further Research Needed**: [Areas requiring additional investigation]
- **Proof of Concept Priorities**: [Key aspects to validate early]
- **Implementation Strategy**: [Recommended development approach]

## Quality Assurance

**Step 6: Validate Research Quality**
Ensure comprehensive analysis by checking:

- ✅ **Coverage**: Analyzed multiple implementation approaches
- ✅ **Depth**: Examined both quantitative metrics and qualitative factors
- ✅ **Relevance**: Findings directly address the specified requirements
- ✅ **Currency**: Included recent and actively maintained repositories
- ✅ **Balance**: Considered both popular and emerging solutions
- ✅ **Practicality**: Recommendations are actionable and implementable

**Confidence Calibration**:
- **High Confidence (80-100%)**: Multiple production examples, strong community adoption
- **Medium Confidence (60-79%)**: Some production evidence, moderate community adoption
- **Low Confidence (40-59%)**: Limited evidence, emerging or niche solutions
- **Insufficient Data (<40%)**: Recommend additional research before proceeding

Execute this research framework to provide comprehensive, actionable technology recommendations based on real-world GitHub evidence and community validation.