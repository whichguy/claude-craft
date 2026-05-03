---
argument-hint: "[--list] | [new-command-name] [--global] [command-to-run...]"
description: "Create slash command aliases or list existing aliases"
allowed-tools: "Write, Bash, Read, Glob"
---

# Alias Command

Create or list slash command aliases that act as shortcuts to other commands.

## Usage
- `/alias --list` - List all aliases  
- `/alias name command...` - Create local alias
- `/alias name --global command...` - Create global alias

## Implementation Steps

### Step 1: Parse Arguments

Given arguments: $1, $2, $3, $4, $5, $6, $7, $8, $9

1. If $1 is "--list", go to LIST MODE
2. Otherwise, continue to CREATE MODE

### LIST MODE (Optimized with Ripgrep)

1. **Find local aliases**: Use Grep tool with pattern "alias-generated: true", glob "*.md", path ".claude/commands", output_mode "files_with_matches"
2. If local alias files found:
   - Use Grep tool with pattern "alias-command:", same glob/path, output_mode "content", -n true to get filenames and commands
   - Parse each result line: extract filename (remove path and .md extension) and command value (after colon, trim quotes/spaces)
   - Store as LOCAL_ALIAS entries

3. **Find global aliases**: Use Grep tool with pattern "alias-generated: true", glob "*.md", path "~/.claude/commands", output_mode "files_with_matches"  
4. If global alias files found:
   - Use Grep tool with pattern "alias-command:", same glob/path, output_mode "content", -n true to get filenames and commands
   - Parse each result line: extract filename (remove path and .md extension) and command value (after colon, trim quotes/spaces)
   - Skip if filename already exists in LOCAL_ALIAS list (local overrides global)
   - Store remaining as GLOBAL_ALIAS entries

5. **Display results**:
   - Show "**Local Aliases:**" header if any LOCAL_ALIAS entries
   - For each LOCAL_ALIAS: Show `/name → command`
   - Show "**Global Aliases:**" header if any GLOBAL_ALIAS entries  
   - For each GLOBAL_ALIAS: Show `/name → command`
   - If no aliases found: Show "No aliases defined"
   - Always show note: "💡 Local aliases override global aliases with the same name"

Then STOP execution.

### CREATE MODE

1. Store $1 as ALIAS_NAME
2. Check if $2 equals "--global":
   - If YES: Set IS_GLOBAL=true, TARGET_DIR="~/.claude/commands", and COMMAND is all arguments from $3 onwards joined with spaces
   - If NO: Set IS_GLOBAL=false, TARGET_DIR=".claude/commands", and COMMAND is all arguments from $2 onwards joined with spaces

### Step 2: Validate Alias Name

1. Use Bash tool to validate ALIAS_NAME (pass ALIAS_NAME as argument $1):
```bash
#!/bin/bash
NAME="$1"  # This receives ALIAS_NAME from Step 1
# Check if empty or whitespace
if [ -z "${NAME// }" ]; then
  echo "ERROR: No alias name provided"
  exit 1
fi
# Check length
if [ ${#NAME} -gt 50 ]; then
  echo "ERROR: Alias name too long (max 50 characters)"
  exit 1  
fi
# Check for path traversal
if [[ "$NAME" == *".."* ]] || [[ "$NAME" == *"/"* ]]; then
  echo "ERROR: Alias name cannot contain path separators"
  exit 1
fi
# Check format (alphanumeric, dash, underscore only, must start with letter/number)
if ! [[ "$NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]]; then
  echo "ERROR: Invalid alias name (must start with letter/number, contain only letters, numbers, dash, underscore)"
  exit 1
fi
# Convert to lowercase first (compatible with sh/bash)
NAME_LOWER=$(echo "$NAME" | tr '[:upper:]' '[:lower:]')
# Check reserved names (case-insensitive)
set -- help exit clear alias unalias prompt task
for word in "$@"; do
  if [ "$NAME_LOWER" = "$word" ]; then
    echo "ERROR: Cannot use reserved name '$NAME'"
    exit 1
  fi
done
echo "$NAME_LOWER"  # Output the lowercase name for next steps
```

Store the output as ALIAS_NAME_LOWER

### Step 3: Validate Command

Check if COMMAND (constructed from remaining arguments) is empty:
- If COMMAND is empty or only whitespace: Display ERROR: "No command specified. Usage: /alias name [--global] command"
- STOP execution

Additional validation:
- If $2 is empty (no arguments after alias name): Display ERROR: "No command specified. Usage: /alias name [--global] command"
- If $2 equals "--global" but $3 is empty: Display ERROR: "No command specified after --global flag. Usage: /alias name --global command"
- STOP execution for both cases

### Step 4: Check for Existing Files

1. Construct target path: If IS_GLOBAL, use `~/.claude/commands/ALIAS_NAME_LOWER.md`, else use `.claude/commands/ALIAS_NAME_LOWER.md`
2. Use Read tool to attempt reading the target file
3. If file exists:
   - Check if content contains "alias-generated: true"
   - If YES: 
     - Display INFO "Alias /ALIAS_NAME_LOWER already exists. Removing existing alias first..."
     - Use Bash tool to remove the existing file: `rm "TARGET_FILE_PATH"`
     - Display INFO "Existing alias removed. Creating new alias..."
     - Continue to Step 5
   - If NO: Display ERROR "/ALIAS_NAME_LOWER is a core command and cannot be overridden"
   - STOP execution
4. If creating local alias, also check if `~/.claude/commands/ALIAS_NAME_LOWER.md` exists:
   - If exists: Display WARNING "Note: This will shadow the global alias /ALIAS_NAME_LOWER"
   - Continue (shadowing is allowed)

### Step 5: Create Directory

Use Bash tool based on IS_GLOBAL flag:
```bash
#!/bin/bash
# Note: This receives the IS_GLOBAL decision, not original arguments
if [ "$1" = "true" ]; then
  mkdir -p "$HOME/.claude/commands"
else
  mkdir -p ".claude/commands"
fi
```

### Step 6: Generate Timestamp

Use Bash tool:
```bash
#!/bin/bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

Store output as TIMESTAMP

### Step 7: Create Alias File

Determine file path:
- If IS_GLOBAL: `~/.claude/commands/ALIAS_NAME_LOWER.md`
- Otherwise: `.claude/commands/ALIAS_NAME_LOWER.md`

Use Write tool to create the file with content:
```
---
argument-hint: "[additional-args...]"
description: "Alias: COMMAND"
allowed-tools: "all"
alias-generated: true
alias-type: "TYPE"
alias-created: "TIMESTAMP"
alias-command: "COMMAND"
---

# Alias: ALIAS_NAME_LOWER

**This is an auto-generated alias**
**Type**: TYPE
**Executes**: COMMAND $@

## Execute Command

Execute: COMMAND $@

## Output Requirements
- Direct execution result only
- No preamble about executing the alias
- No meta-commentary about what happened
- Just the actual output from running the command
```

Where:
- TYPE is "global" if IS_GLOBAL, otherwise "local"
- TIMESTAMP is the generated timestamp
- COMMAND is the full command string
- ALIAS_NAME_LOWER is the lowercase alias name

### Step 8: Success Message

Display:
```
✅ Created TYPE alias: /ALIAS_NAME_LOWER
Executes: COMMAND
Location: PATH

📝 TODO: Restart Claude Code to activate the new /ALIAS_NAME_LOWER command
```

Where PATH is the full file path created.