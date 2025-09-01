# Knowledge Discovery System

## Knowledge File Locations

This system automatically discovers and incorporates knowledge files from hierarchical locations:

### Search Locations (in priority order)
1. **Current Directory**: `./knowledge/` - Project-specific knowledge
2. **Project Root**: `../knowledge/` or `../../knowledge/` - Project family knowledge  
3. **User Home**: `~/knowledge/` - User-level knowledge
4. **Git Repositories**: Any repo named "knowledge" in common locations

### File Discovery Process

When working on any project, Claude should:

1. **Scan for knowledge directories** in this order:
   ```bash
   # Current directory
   find . -name "knowledge" -type d -maxdepth 2
   
   # Project hierarchy (up to 3 levels)
   find .. -name "knowledge" -type d -maxdepth 3
   find ../.. -name "knowledge" -type d -maxdepth 3
   
   # User home directory
   ls ~/knowledge/ 2>/dev/null
   
   # Git repos named knowledge
   find ~ -name "knowledge" -type d -path "*/.git/*" -prune -o -name "knowledge" -type d
   ```

2. **Enumerate all markdown files** in discovered directories:
   ```bash
   find [knowledge-dir] -name "*.md" -type f
   ```

3. **Read and incorporate** relevant content based on:
   - File modification time (prefer recent)
   - Relevance to current project
   - Context keywords matching current task

### Knowledge Integration Strategy

- **Hierarchical Override**: More specific (closer) knowledge overrides general knowledge
- **Contextual Relevance**: Files with relevant keywords get priority
- **Size Limits**: Summarize large files, include small files verbatim
- **Update Detection**: Check file modification times to detect changes

### Standard Knowledge Categories

Expected knowledge file types:
- `dogname.md` - Personal context information
- `project-context.md` - Project-specific information
- `development-preferences.md` - Coding style and preferences
- `api-keys.md` - Development credentials and tokens
- `workflow-patterns.md` - Common development workflows
- `domain-knowledge.md` - Subject matter expertise
- `troubleshooting.md` - Common issues and solutions

### Implementation Notes

- Always check for knowledge directories when starting work
- Integrate knowledge content into context before making decisions
- Respect privacy - don't expose sensitive information unnecessarily
- Cache knowledge content to avoid repeated file reads
- Log which knowledge sources were used for transparency

This ensures Claude has access to all available context and knowledge when working on any project.