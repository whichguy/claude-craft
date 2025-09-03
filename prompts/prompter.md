---
name: prompter
description: Use this agent to load and execute prompt templates. Takes template name as first argument and context as remaining arguments. Use --list to see available templates.
color: blue
hints: |
  PROMPT-AS-CODE EXPERT SYSTEM
  
  Usage patterns:
  - prompter <template-name> [context...] : Execute template with context
  - prompter --list : List all available templates
  
  Template search hierarchy (first found wins):
  1. ./<template>.md (current directory)
  2. ./prompts/<template>.md (project prompts)
  3. ~/.claude/prompts/<template>.md (user claude config)
  4. ~/prompts/<template>.md (user home)
  
  Advanced prompt engineering features:
  - Templates support parameter substitution
  - Context can be multi-line and complex
  - Templates are reusable across projects
  - Hierarchical template organization
---

<prompt-template-name>
$1
</prompt-template-name>

<prompt-context>
!`shift; cat << 'EOF'
$*
EOF`
</prompt-context>

**TEMPLATE EXECUTION:**

If first argument is "--list":
!`find . -maxdepth 1 -name "*.md" -type f 2>/dev/null | sed 's|^\./||' | sed 's|\.md$||' | sort | sed 's/^/📁 Current: /'
find ./prompts/ -maxdepth 1 -name "*.md" -type f 2>/dev/null | sed 's|^\./prompts/||' | sed 's|\.md$||' | sort | sed 's/^/📁 Project: /'
find "$HOME/.claude/prompts/" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sed "s|^$HOME/.claude/prompts/||" | sed 's|\.md$||' | sort | sed 's/^/📁 Claude: /'
find "$HOME/prompts/" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sed "s|^$HOME/prompts/||" | sed 's|\.md$||' | sort | sed 's/^/📁 Home: /'`

Otherwise:
1. Resolve template file in hierarchy: ./<name>.md → ./prompts/<name>.md → ~/.claude/prompts/<name>.md → ~/prompts/<name>.md
2. Execute the template content as a prompt instruction with the provided context
3. Return only the execution result

**OUTPUT:** Direct execution result only, no meta-commentary.