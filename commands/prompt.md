---
argument-hint: "[template] [context...]"
description: "Load and execute a prompt template"
allowed-tools: "all"
---

<prompt-template-name>
$1
</prompt-template-name>

<prompt-context>
!`shift; echo "$*"`
</prompt-context>

!`# Load template with precedence: current → project → user-claude → user-home
TEMPLATE="$1"
if [ -f "./${TEMPLATE}.md" ]; then
  cat "./${TEMPLATE}.md"
elif [ -f "./prompts/${TEMPLATE}.md" ]; then
  cat "./prompts/${TEMPLATE}.md"
elif [ -f "$HOME/.claude/prompts/${TEMPLATE}.md" ]; then
  cat "$HOME/.claude/prompts/${TEMPLATE}.md"
elif [ -f "$HOME/prompts/${TEMPLATE}.md" ]; then
  cat "$HOME/prompts/${TEMPLATE}.md"
else
  echo "ERROR: Template '${TEMPLATE}.md' not found in any search location:" >&2
  echo "  - ./${TEMPLATE}.md" >&2
  echo "  - ./prompts/${TEMPLATE}.md" >&2
  echo "  - $HOME/.claude/prompts/${TEMPLATE}.md" >&2
  echo "  - $HOME/prompts/${TEMPLATE}.md" >&2
  exit 1
fi`

**Apply the template above to the context in \`<prompt-context>\` tags and template name in \`<prompt-template-name>\` tags.**