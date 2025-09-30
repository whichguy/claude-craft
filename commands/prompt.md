---
argument-hint: "[list|sync|publish|template-name] [context/arguments...]"
description: "Manage and execute Claude Code extensions - pass template name + unlimited context"
allowed-tools: "all"
---

# Prompt Template Executor

*Unified Claude Code Extension Manager - Discovers and executes agents, commands, prompts, and hooks*

## Argument Capture

First argument (command/template): $1
Remaining context: $ARGUMENTS

## Execution Flow

Execute this bash script to handle all commands and template loading:

```bash
#!/bin/bash
set -euo pipefail

# Capture arguments
FIRST_ARG="$1"
ALL_ARGS="$2"

# Extract content by removing first argument + space
if [ -n "$FIRST_ARG" ] && [ -n "$ALL_ARGS" ]; then
    FIRST_LEN=${#FIRST_ARG}
    CONTENT="${ALL_ARGS:$((FIRST_LEN + 1))}"
else
    CONTENT=""
fi

# Display template and context information
echo "<prompt-template-name>$FIRST_ARG</prompt-template-name>"
echo "<prompt-arguments><![CDATA["
echo "$CONTENT"
echo "]]></prompt-arguments>"

# Validate template name
if [ -z "$FIRST_ARG" ]; then
    echo "❌ Error: No template name provided"
    echo ""
    echo "**Usage**: \`/prompt <template-name> [arguments...]\`"
    echo ""
    echo "**Examples**:"
    echo "  \`/prompt ideal-sti-v3 <your requirements>\`"
    echo "  \`/prompt weather New York\`"
    echo "  \`/prompt list\` - Show all available templates"
    echo ""
    echo "**Available Commands**:"
    echo "  • \`list\` - List all templates"
    echo "  • \`sync\` - Install templates from repository"
    echo "  • \`publish\` - Publish local templates to repository"
    exit 1
fi

# Repository discovery
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
REPO_DIR=$(jq -r '."claude-craft.repo" // .repository.path // empty' ~/.claude/settings.json 2>/dev/null | sed "s|\$HOME|$HOME|g" | sed "s|^~|$HOME|")

# Validate repository path
if [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/prompts" ]; then
    echo "📦 Repository: $REPO_DIR"
else
    # Fallback to common locations
    for check_path in "$HOME/claude-craft" "$HOME/repos/claude-craft"; do
        if [ -d "$check_path/prompts" ]; then
            REPO_DIR="$check_path"
            echo "📦 Repository: $REPO_DIR (fallback)"
            break
        fi
    done
fi

# Handle commands
case "$FIRST_ARG" in
    list|--list|status)
        # List all extensions
        echo "## 🧩 Claude Code Extensions"
        echo ""

        # List profile prompts
        if [ -d "$HOME/.claude/prompts" ]; then
            echo "### 📝 Prompts (Profile)"
            find "$HOME/.claude/prompts" -name "*.md" -type f | sort | while read -r file; do
                name=$(basename "$file" .md)
                printf "  • %s\n" "$name"
            done
            echo ""
        fi

        # List repository prompts
        if [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/prompts" ]; then
            echo "### 📦 Prompts (Repository)"
            find "$REPO_DIR/prompts" -name "*.md" -type f | sort | while read -r file; do
                name=$(basename "$file" .md)
                if [ -f "$HOME/.claude/prompts/$name.md" ]; then
                    printf "  • %s ✓ synced\n" "$name"
                else
                    printf "  • %s (available)\n" "$name"
                fi
            done
            echo ""
        fi

        # List agents
        if [ -d "$HOME/.claude/agents" ]; then
            echo "### 🤖 Agents"
            find "$HOME/.claude/agents" -name "*.md" -type f | sort | while read -r file; do
                name=$(basename "$file" .md)
                printf "  • %s\n" "$name"
            done
            echo ""
        fi

        # List commands
        if [ -d "$HOME/.claude/commands" ]; then
            echo "### ⚡ Commands"
            find "$HOME/.claude/commands" -name "*.md" -type f | sort | while read -r file; do
                name=$(basename "$file" .md)
                printf "  • /%s\n" "$name"
            done
            echo ""
        fi

        exit 0
        ;;

    sync|add|link|install)
        # Sync from repository
        if [ -z "$REPO_DIR" ]; then
            echo "❌ Error: Repository not found"
            echo ""
            echo "Configure repository path in ~/.claude/settings.json:"
            echo '```json'
            echo "{"
            printf '  "claude-craft.repo": "%s/claude-craft"\n' "$HOME"
            echo "}"
            echo '```'
            exit 1
        fi

        echo "## 📦 Sync from Repository"
        echo ""
        printf "**Repository**: %s\n" "$REPO_DIR"
        echo ""

        # Sync all prompts
        if [ -d "$REPO_DIR/prompts" ]; then
            mkdir -p "$HOME/.claude/prompts"
            synced=0
            find "$REPO_DIR/prompts" -name "*.md" -type f | while read -r file; do
                name=$(basename "$file")
                cp "$file" "$HOME/.claude/prompts/$name"
                printf "✓ Synced %s\n" "$name"
                synced=$((synced + 1))
            done
            echo ""
            echo "Synced $synced prompt templates"
        fi

        exit 0
        ;;

    publish|share|contribute)
        # Publish to repository
        if [ -z "$REPO_DIR" ]; then
            echo "❌ Error: Repository not found"
            exit 1
        fi

        echo "## 📤 Publish to Repository"
        echo ""
        echo "**Instructions**: Use git commands to publish templates:"
        echo ""
        echo '```bash'
        printf "cd %s\n" "$REPO_DIR"
        echo "git add prompts/"
        echo "git commit -m 'Add new prompt templates'"
        echo "git push"
        echo '```'

        exit 0
        ;;

    *)
        # Template discovery
        TEMPLATE_PATH=""

        # 1. Check for explicit file path
        if [ -f "$FIRST_ARG" ]; then
            TEMPLATE_PATH="$FIRST_ARG"
        elif [ -f "$FIRST_ARG.md" ]; then
            TEMPLATE_PATH="$FIRST_ARG.md"
        fi

        # 2. Check git repo parent prompts
        if [ -z "$TEMPLATE_PATH" ] && [ -n "$GIT_ROOT" ] && [ -d "$GIT_ROOT/../prompts" ]; then
            if [ -f "$GIT_ROOT/../prompts/$FIRST_ARG.md" ]; then
                TEMPLATE_PATH="$GIT_ROOT/../prompts/$FIRST_ARG.md"
            fi
        fi

        # 3. Check repository prompts
        if [ -z "$TEMPLATE_PATH" ] && [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/prompts" ]; then
            if [ -f "$REPO_DIR/prompts/$FIRST_ARG.md" ]; then
                TEMPLATE_PATH="$REPO_DIR/prompts/$FIRST_ARG.md"
            fi
        fi

        # 4. Check profile prompts
        if [ -z "$TEMPLATE_PATH" ] && [ -f "$HOME/.claude/prompts/$FIRST_ARG.md" ]; then
            TEMPLATE_PATH="$HOME/.claude/prompts/$FIRST_ARG.md"
        fi

        # 5. Check current directory
        if [ -z "$TEMPLATE_PATH" ] && [ -f "./$FIRST_ARG.md" ]; then
            TEMPLATE_PATH="./$FIRST_ARG.md"
        fi

        # Error if not found
        if [ -z "$TEMPLATE_PATH" ]; then
            printf "❌ Error: Template '%s' not found\n" "$FIRST_ARG"
            echo ""
            echo "**Searched locations**:"
            [ -n "$GIT_ROOT" ] && printf "  • %s/../prompts/\n" "$GIT_ROOT"
            [ -n "$REPO_DIR" ] && printf "  • %s/prompts/\n" "$REPO_DIR"
            printf "  • %s/.claude/prompts/\n" "$HOME"
            echo "  • ./"
            echo ""
            echo "Use /prompt list to see available templates"
            echo "Use /prompt sync to install from repository"
            exit 1
        fi

        printf "📄 Template: %s\n" "$TEMPLATE_PATH"

        # Read template content
        TEMPLATE_CONTENT=$(cat "$TEMPLATE_PATH")

        # Replace <prompt-arguments> placeholder with actual content
        TEMPLATE_CONTENT="${TEMPLATE_CONTENT//<prompt-arguments>/$CONTENT}"

        # Output template instructions
        echo "<prompt-instructions>"
        echo "$TEMPLATE_CONTENT"
        echo "</prompt-instructions>"
        ;;
esac
```

## Template Execution Instructions

**Execution Mode**: Silent - suppress all bash command echoing and intermediate output.

**Process**: Extract content from `<prompt-instructions>` tags and execute as natural language instructions.

**Output**: Direct execution result only - no meta-commentary about loading or executing templates.

**Display**: Always show complete output without collapsing. Do not truncate or summarize results.

**Silent Execution Guidelines**:
- Do not show the bash script execution details
- Do not echo commands being run
- Only display the final result of executing the template instructions
- Suppress tool call summaries and intermediate processing steps