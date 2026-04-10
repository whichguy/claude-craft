# GAS Code Quality Checker - Usage Guide

## Quick Start

The GAS Code Quality Checker is a Claude Code skill for analyzing Google Apps Script files. It validates CommonJS modules, event handlers, configuration management, and GAS best practices.

### Basic Usage

```bash
# Single file analysis
Analyze MyModule.gs for code quality issues

# With specific script ID
Analyze script YOUR_SCRIPT_ID file MyModule.gs

# Batch analysis
Analyze all .gs files in src/ directory for code quality

# Show only critical issues
Analyze Calculator.gs showing only critical severity issues

# With auto-fix suggestions
Analyze DataProcessor.gs and provide fix suggestions for all issues
```

---

## Usage Modes

### 1. Interactive Single File

Analyze a specific file and get detailed feedback:

```
Analyze src/EventHandlers.gs for code quality issues
```

**Output includes:**
- File type detection (utility, event handler, web app, etc.)
- Issue summary by severity
- Line-specific issues with explanations
- Fix suggestions with reasoning
- Detected patterns and dependencies

### 2. Batch Mode

Analyze multiple files at once:

```
Analyze all .gs files in src/ directory for issues
```

**Useful for:**
- Project-wide quality checks
- Pre-release validation
- Finding patterns across multiple files

### 3. Filtered by Severity

Focus on specific issue types:

```
# Critical only (blocking issues)
Analyze Menu.gs showing only critical issues

# Warnings only (runtime issues)
Analyze Utils.gs showing only warning severity issues

# Info only (best practices)
Analyze StringHelpers.gs showing only info level suggestions
```

### 4. With Auto-Fix

Get specific fix suggestions:

```
Analyze ConfigHelper.gs and provide fix suggestions
```

**Fix suggestions include:**
- Before/after code snippets
- Step-by-step instructions
- Reasoning for the change

---

## Integration Examples

### Pre-Commit Hook

Automatically check code quality before commits:

**`.git/hooks/pre-commit`:**
```bash
#!/bin/bash

# Get list of staged .gs files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.gs$')

if [ -z "$STAGED_FILES" ]; then
  echo "No .gs files to check"
  exit 0
fi

echo "Running GAS code quality checks..."

# Analyze each staged file
for FILE in $STAGED_FILES; do
  echo "Checking $FILE..."

  # Use Claude Code to analyze (requires Claude Code CLI or API)
  RESULT=$(claude-code "Analyze $FILE showing only critical and warning issues" --json)

  # Check if critical issues exist
  CRITICAL_COUNT=$(echo "$RESULT" | jq '.summary.critical')

  if [ "$CRITICAL_COUNT" -gt 0 ]; then
    echo "❌ CRITICAL ISSUES FOUND in $FILE"
    echo "$RESULT" | jq '.issues[] | select(.severity == "critical")'
    echo ""
    echo "Fix critical issues before committing."
    exit 1
  fi
done

echo "✅ All checks passed!"
exit 0
```

**Make it executable:**
```bash
chmod +x .git/hooks/pre-commit
```

### CI/CD Pipeline

**GitHub Actions Example:**

```yaml
name: GAS Code Quality

on: [push, pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Install Claude Code
        run: npm install -g @anthropic/claude-code

      - name: Run GAS Quality Checks
        run: |
          # Analyze all .gs files
          claude-code "Analyze all .gs files in src/ showing critical and warning issues" --json > quality-report.json

          # Check for critical issues
          CRITICAL=$(jq '.summary.critical' quality-report.json)

          if [ "$CRITICAL" -gt 0 ]; then
            echo "Critical issues found:"
            jq '.issues[] | select(.severity == "critical")' quality-report.json
            exit 1
          fi

      - name: Upload Report
        uses: actions/upload-artifact@v2
        with:
          name: quality-report
          path: quality-report.json
```

### VS Code Task

**`.vscode/tasks.json`:**
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Check GAS Code Quality",
      "type": "shell",
      "command": "claude-code",
      "args": [
        "Analyze ${file} and show all issues"
      ],
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Fix GAS Code Issues",
      "type": "shell",
      "command": "claude-code",
      "args": [
        "Analyze ${file} and provide fix suggestions for all issues"
      ],
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    }
  ]
}
```

**Usage:** `Cmd/Ctrl + Shift + P` → "Tasks: Run Task" → Select task

---

## Output Interpretation

### JSON Output Structure

```json
{
  "file": "src/EventHandlers.gs",
  "fileType": "event_handler",
  "summary": {
    "critical": 0,
    "warning": 2,
    "info": 1,
    "passed": true
  },
  "issues": [
    {
      "tier": "Tier 7: Module Loading",
      "severity": "warning",
      "line": 15,
      "column": 0,
      "message": "Event handler module should have loadNow: true",
      "code": "__defineModule__('Menu', _main, {});",
      "suggestion": "__defineModule__('Menu', _main, { loadNow: true });",
      "reasoning": "Event handlers must be registered at script startup"
    }
  ],
  "patterns": {
    "detected": ["event_handlers", "commonjs_exports"],
    "dependencies": ["ConfigManager"],
    "exports": ["onOpen"],
    "events": {
      "hasEventHandlers": true,
      "handlers": ["onOpen"],
      "loadNow": false,
      "eventsObject": false
    }
  },
  "recommendations": [
    "Set loadNow: true for event handler module"
  ]
}
```

### Severity Levels

**🔴 Critical** - Prevents execution, must fix:
- Syntax errors
- Missing module definitions
- Code outside _main wrapper
- Event handlers without loadNow: true

**⚠️ Warning** - Can cause runtime issues:
- Missing error handling
- Using PropertiesService instead of ConfigManager
- Inefficient GAS API usage
- Global variables

**ℹ️ Info** - Best practices and style:
- Using var instead of const/let
- Old function syntax vs arrow functions
- Missing destructuring opportunities

---

## Common Scenarios

### Scenario 1: New File Review

**Task:** Review a newly created module

```
Analyze src/UserValidator.gs for code quality issues
```

**Expected checks:**
- Module structure (_main, __defineModule__)
- Export validation
- Dependencies properly required
- ES6 syntax usage
- Error handling

### Scenario 2: Event Handler Validation

**Task:** Verify event handler is properly configured

```
Analyze src/MenuHandlers.gs focusing on event handler configuration
```

**Expected checks:**
- loadNow: true setting
- Event functions exported
- Proper function names (onOpen, onEdit, etc.)
- Return types for doGet/doPost

### Scenario 3: Migration to ConfigManager

**Task:** Check if all PropertiesService usage is migrated

```
Analyze all files in src/ for PropertiesService usage
```

**Expected findings:**
- Flag all PropertiesService calls
- Suggest ConfigManager alternatives
- Show before/after examples

### Scenario 4: Performance Review

**Task:** Find performance anti-patterns

```
Analyze src/SpreadsheetProcessor.gs for performance issues
```

**Expected checks:**
- Loops with GAS API calls
- Missing batch operations
- Inefficient data access patterns
- Quota-heavy operations

### Scenario 5: Pre-Release Validation

**Task:** Comprehensive check before deployment

```
Analyze all .gs files showing critical and warning issues only
```

**Checks all:**
- Module integrity
- Event handler configuration
- Error handling
- Configuration management
- Async operation patterns

---

## Tips & Best Practices

### 1. Run Early and Often

Run quality checks during development, not just before commits:
```
# After writing new function
Analyze current file for issues

# Before committing
Analyze all changed files for issues
```

### 2. Address Critical First

Focus on fixing critical issues before warnings:
```
# See what's blocking
Analyze MyModule.gs showing only critical issues

# Then handle warnings
Analyze MyModule.gs showing only warnings
```

### 3. Use Fix Suggestions

Let the tool guide refactoring:
```
# Get specific fixes
Analyze Calculator.gs and provide fix suggestions

# Apply fixes one at a time
# Verify each change works before moving to next
```

### 4. Batch Analysis for Consistency

Check multiple files for consistent patterns:
```
# Find all ConfigManager issues
Analyze all .gs files for ConfigManager usage patterns

# Find all event handler issues
Analyze all .gs files for event handler configuration
```

### 5. Integrate with Workflow

Make quality checks automatic:
- Pre-commit hooks
- CI/CD pipelines
- Editor tasks
- Code review checklists

---

## Troubleshooting

### Issue: Skill Not Found

**Error:** "Skill 'gas-quality-check' not found"

**Solution:**
1. Verify file exists: `ls ~/.claude/skills/gas-quality-check.md`
2. Restart Claude Code to reload skills
3. Check file permissions: `chmod 644 ~/.claude/skills/gas-quality-check.md`

### Issue: False Positives

**Problem:** Skill flags correct code as issues

**Solutions:**
1. Check if code matches project patterns
2. Verify pattern library is up to date
3. File issue with specific example
4. Use pattern reference to understand rules

### Issue: Missing Issues

**Problem:** Skill doesn't catch known problems

**Solutions:**
1. Ensure all 11 validation tiers are checking
2. Verify file type detection is correct
3. Check if issue is outside current scope
4. Update skill to add missing patterns

### Issue: Slow Performance

**Problem:** Analysis takes too long

**Solutions:**
1. Analyze files individually instead of batch
2. Filter by severity to reduce output
3. Check file size (very large files take longer)
4. Split large modules into smaller ones

---

## FAQ

**Q: Does this replace manual code review?**
A: No, it complements manual review by catching common patterns and anti-patterns automatically.

**Q: Can it auto-fix issues?**
A: It provides fix suggestions, but you should manually apply and verify changes.

**Q: Does it work with container-bound scripts?**
A: Yes, it validates all GAS scripts (standalone and container-bound).

**Q: What about HTML and JSON files?**
A: Currently focused on .gs files. HTML and JSON validation may be added later.

**Q: Can I customize validation rules?**
A: You can edit the skill file to adjust patterns, but test thoroughly after changes.

**Q: How often should I run checks?**
A: During development, before commits, and in CI/CD pipelines for comprehensive coverage.

**Q: Does it check for security issues?**
A: It flags some security anti-patterns (hardcoded secrets, missing error handling) but isn't a dedicated security scanner.

**Q: Can it validate cross-file dependencies?**
A: It detects require() dependencies but doesn't validate the full dependency graph yet.

---

## Next Steps

1. **Try it out:** Analyze a file from your current project
2. **Review output:** Understand the issues flagged
3. **Apply fixes:** Start with critical issues
4. **Integrate:** Add to your development workflow
5. **Share feedback:** Help improve the tool with real-world examples

---

## Support & Feedback

- **Pattern Reference:** See `gas-patterns-reference.md` for quick pattern lookup
- **Skill Source:** `~/.claude/skills/gas-quality-check.md`
- **Report Issues:** Share examples of false positives or missed patterns
- **Suggest Patterns:** Help expand validation coverage

---

**Last Updated:** 2025-01-24
