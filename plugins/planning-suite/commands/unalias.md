---
argument-hint: "[command-name] [--global] [--force]"
description: "Remove slash command aliases"
allowed-tools: "Bash, Read, Glob"
---

# Unalias Command

Remove slash command aliases with safety checks.

## Usage
- `/unalias name` - Remove alias (requires confirmation)
- `/unalias name --force` - Remove without confirmation
- `/unalias name --global` - Only check global location
- `/unalias name --global --force` - Remove global alias without confirmation

## Implementation Steps

### Step 1: Parse Arguments

Given arguments: $1, $2, $3

1. Store $1 as ALIAS_NAME
2. Check if $2 or $3 equals "--global": Set IS_GLOBAL flag
3. Check if $2 or $3 equals "--force": Set IS_FORCE flag

### Step 2: Validate Alias Name

Use Bash tool to validate (pass ALIAS_NAME as argument $1):
```bash
#!/bin/bash
NAME="$1"  # This receives ALIAS_NAME from Step 1
# Check if empty or whitespace only
if [ -z "${NAME// }" ]; then
  echo "ERROR: No alias name provided. Usage: /unalias name [--global] [--force]"
  exit 1
fi

# Check for path traversal attempts
if [[ "$NAME" == *".."* ]] || [[ "$NAME" == *"/"* ]]; then
  echo "ERROR: Invalid alias name (cannot contain path separators)"
  exit 1
fi

# Check format - must start with letter/number, contain only letters, numbers, dash, underscore
if ! [[ "$NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]]; then
  echo "ERROR: Invalid alias name format"
  exit 1
fi

# Convert to lowercase for consistent file naming
echo "$NAME" | tr '[:upper:]' '[:lower:]'
```

Store output as ALIAS_NAME_LOWER

### Step 3: Locate Alias File

1. If IS_GLOBAL flag is set:
   - Check only `~/.claude/commands/ALIAS_NAME_LOWER.md`
   - Store as TARGET_FILE if exists
   - Set LOCATION="global"

2. Otherwise:
   - First check `.claude/commands/ALIAS_NAME_LOWER.md`
   - If exists, store as TARGET_FILE and set LOCATION="local"
   - If not exists, check `~/.claude/commands/ALIAS_NAME_LOWER.md`
   - If exists, store as TARGET_FILE and set LOCATION="global"

3. Use Read tool to attempt reading TARGET_FILE
4. If file doesn't exist:
   - Display ERROR: "Alias /ALIAS_NAME_LOWER not found"
   - STOP execution

### Step 4: Verify It's an Alias

1. After reading TARGET_FILE content, search for "alias-generated: true"
2. If NOT found:
   - Display ERROR: "/ALIAS_NAME_LOWER is not an alias (it's a core command)"
   - STOP execution
3. If found, extract from the file:
   - Line containing "alias-command:" - extract value after colon, trim quotes and spaces as ALIAS_COMMAND
   - Line containing "alias-created:" - extract value after colon, trim quotes and spaces as ALIAS_CREATED

### Step 5: Confirmation Check

If IS_FORCE flag is NOT set:

Display:
```
╔════════════════════════════════════════════════════╗
║           ⚠️  CONFIRM ALIAS REMOVAL                 ║
╚════════════════════════════════════════════════════╝

About to remove LOCATION alias: /ALIAS_NAME_LOWER
  Executes: ALIAS_COMMAND
  Created: ALIAS_CREATED
  Location: TARGET_FILE

⚠️  This will be permanently removed!

To confirm, use: /unalias ALIAS_NAME_LOWER --force (add --global if IS_GLOBAL flag is set)
To cancel, do nothing.
```

Then STOP execution.

If IS_FORCE flag IS set:
- Display: "🔥 Force mode - removing LOCATION alias: /ALIAS_NAME_LOWER"
- Continue to next step

### Step 6: Remove Alias File

Use Bash tool to remove (passing the TARGET_FILE path as argument):
```bash
#!/bin/bash
# Receives the full path to the target file
FILE="$1"

# Final safety check - verify it's still an alias before removal
if [ -f "$FILE" ] && grep -q "alias-generated: true" "$FILE"; then
    # Remove the alias file with error checking
    rm "$FILE" || { echo "ERROR: Failed to remove file"; exit 1; }
    echo "REMOVED"  # Signal successful removal
else
    # File was modified or deleted between checks
    echo "ERROR: File changed or no longer exists"
    exit 1
fi
```

### Step 7: Success Message

Display:
```
✅ Successfully removed LOCATION alias: /ALIAS_NAME_LOWER
Command was: ALIAS_COMMAND

📝 TODO: Restart Claude Code to apply changes
```

## Output Requirements
- Direct execution result only
- No preamble about executing unalias
- No meta-commentary about what happened  
- Just the actual output from the removal process