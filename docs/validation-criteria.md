# Extension Management Validation Steps & Success Criteria

This document defines the validation steps and success criteria for sync and publish operations in the claude-craft bidirectional extension management system.

## Overview

Every extension management operation should be validated at multiple stages to ensure integrity, functionality, and user safety. This document provides specific validation criteria and automated checks.

## Pre-Operation Validation

### Repository State Validation
**Purpose**: Ensure repository is in a clean, accessible state before operations

#### Success Criteria
- ✅ Repository directory exists and is accessible
- ✅ Git repository is in clean state (no uncommitted changes) OR conflicts are acknowledged
- ✅ Network connectivity to remote repository
- ✅ Sufficient disk space for operations

#### Validation Steps
```bash
# 1. Repository accessibility
validate_repository() {
  local repo_path="$1"

  # Check directory exists
  if [ ! -d "$repo_path" ]; then
    echo "❌ Repository directory not found: $repo_path"
    return 1
  fi

  # Check it's a git repository
  if ! git -C "$repo_path" rev-parse --git-dir >/dev/null 2>&1; then
    echo "❌ Not a git repository: $repo_path"
    return 1
  fi

  # Check working directory status
  if ! git -C "$repo_path" diff --quiet HEAD 2>/dev/null; then
    echo "⚠️  Repository has uncommitted changes"
    echo "   Continue? (y/N):"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
      return 1
    fi
  fi

  echo "✅ Repository validation passed"
  return 0
}

# 2. Network connectivity
validate_connectivity() {
  local repo_path="$1"

  if git -C "$repo_path" ls-remote origin >/dev/null 2>&1; then
    echo "✅ Network connectivity verified"
    return 0
  else
    echo "❌ Cannot reach remote repository"
    return 1
  fi
}

# 3. Disk space check
validate_disk_space() {
  local required_mb=100  # Minimum 100MB required
  local available_kb=$(df . | tail -1 | awk '{print $4}')
  local available_mb=$((available_kb / 1024))

  if [ "$available_mb" -gt "$required_mb" ]; then
    echo "✅ Sufficient disk space: ${available_mb}MB available"
    return 0
  else
    echo "❌ Insufficient disk space: ${available_mb}MB available, ${required_mb}MB required"
    return 1
  fi
}
```

### Permission Validation
**Purpose**: Ensure necessary file system permissions exist

#### Success Criteria
- ✅ Write permissions to target directory (`~/.claude/` or project scope)
- ✅ Read permissions to repository files
- ✅ Execute permissions for hook scripts

#### Validation Steps
```bash
validate_permissions() {
  local target_dir="$1"

  # Check target directory writability
  if [ -w "$target_dir" ]; then
    echo "✅ Write permission to $target_dir"
  else
    echo "❌ No write permission to $target_dir"
    return 1
  fi

  # Test file creation
  if touch "$target_dir/.permission-test" 2>/dev/null; then
    rm "$target_dir/.permission-test"
    echo "✅ File creation test passed"
  else
    echo "❌ Cannot create files in $target_dir"
    return 1
  fi

  return 0
}
```

## Sync Operation Validation (Repository → Local)

### Git Pull Validation
**Purpose**: Ensure repository is updated to latest state

#### Success Criteria
- ✅ Git pull completed without errors
- ✅ No merge conflicts remain unresolved
- ✅ Repository is at expected commit/branch

#### Validation Steps
```bash
validate_git_pull() {
  local repo_path="$1"
  local branch="${2:-main}"

  # Record current commit
  local before_commit=$(git -C "$repo_path" rev-parse HEAD)

  # Perform pull
  if git -C "$repo_path" pull origin "$branch" 2>/dev/null; then
    local after_commit=$(git -C "$repo_path" rev-parse HEAD)

    if [ "$before_commit" = "$after_commit" ]; then
      echo "✅ Repository already up to date"
    else
      echo "✅ Repository updated: $before_commit → $after_commit"
    fi

    # Check for merge conflicts
    if git -C "$repo_path" diff --name-only --diff-filter=U | grep -q .; then
      echo "❌ Merge conflicts detected"
      git -C "$repo_path" status --short | grep "^UU"
      return 1
    fi

    return 0
  else
    echo "❌ Git pull failed"
    return 1
  fi
}
```

### Symlink Creation Validation
**Purpose**: Ensure symlinks are created correctly and point to valid files

#### Success Criteria
- ✅ Symlink exists at target location
- ✅ Symlink points to correct repository file
- ✅ Target file is readable and contains expected content
- ✅ No broken symlinks created

#### Validation Steps
```bash
validate_symlink() {
  local symlink_path="$1"
  local expected_target="$2"

  # Check symlink exists
  if [ ! -L "$symlink_path" ]; then
    echo "❌ Symlink not created: $symlink_path"
    return 1
  fi

  # Check symlink target
  local actual_target=$(readlink "$symlink_path")
  if [ "$actual_target" != "$expected_target" ]; then
    echo "❌ Symlink points to wrong target:"
    echo "   Expected: $expected_target"
    echo "   Actual: $actual_target"
    return 1
  fi

  # Check target file accessibility
  if [ ! -r "$symlink_path" ]; then
    echo "❌ Symlink target not readable: $symlink_path"
    return 1
  fi

  # Check file has content
  if [ ! -s "$symlink_path" ]; then
    echo "❌ Symlink target is empty: $symlink_path"
    return 1
  fi

  echo "✅ Symlink validated: $symlink_path → $actual_target"
  return 0
}

# Validate all symlinks in a directory
validate_all_symlinks() {
  local dir="$1"
  local errors=0

  find "$dir" -type l | while read -r symlink; do
    if [ ! -e "$symlink" ]; then
      echo "❌ Broken symlink: $symlink → $(readlink "$symlink")"
      errors=$((errors + 1))
    fi
  done

  if [ "$errors" -eq 0 ]; then
    echo "✅ All symlinks valid in $dir"
    return 0
  else
    echo "❌ Found $errors broken symlinks"
    return 1
  fi
}
```

### Hook Installation Validation
**Purpose**: Ensure hooks are properly installed in settings.json

#### Success Criteria
- ✅ settings.json remains valid JSON after modification
- ✅ Hook configuration matches expected format
- ✅ Hook script is executable and accessible
- ✅ No duplicate or conflicting hooks

#### Validation Steps
```bash
validate_hook_installation() {
  local settings_file="$1"
  local hook_name="$2"
  local hook_script="$3"

  # Validate JSON syntax
  if ! jq '.' "$settings_file" >/dev/null 2>&1; then
    echo "❌ Invalid JSON in $settings_file"
    return 1
  fi

  # Check hook exists in settings
  if jq -e ".hooks.$hook_name" "$settings_file" >/dev/null 2>&1; then
    echo "✅ Hook $hook_name found in settings"
  else
    echo "❌ Hook $hook_name not found in settings"
    return 1
  fi

  # Validate hook script
  if [ -x "$hook_script" ]; then
    echo "✅ Hook script executable: $hook_script"
  else
    echo "❌ Hook script not executable: $hook_script"
    return 1
  fi

  # Test hook script syntax (basic)
  if bash -n "$hook_script" 2>/dev/null; then
    echo "✅ Hook script syntax valid"
  else
    echo "❌ Hook script has syntax errors"
    return 1
  fi

  return 0
}
```

## Publish Operation Validation (Local → Repository)

### File Copy Validation
**Purpose**: Ensure local files are correctly copied to repository

#### Success Criteria
- ✅ File copied to correct repository location
- ✅ File content matches original
- ✅ File permissions preserved
- ✅ No data corruption during copy

#### Validation Steps
```bash
validate_file_copy() {
  local source_file="$1"
  local dest_file="$2"

  # Check destination exists
  if [ ! -f "$dest_file" ]; then
    echo "❌ Destination file not created: $dest_file"
    return 1
  fi

  # Compare file contents
  if cmp -s "$source_file" "$dest_file"; then
    echo "✅ File content matches: $dest_file"
  else
    echo "❌ File content differs between source and destination"
    return 1
  fi

  # Check file is readable
  if [ -r "$dest_file" ]; then
    echo "✅ Destination file readable"
  else
    echo "❌ Destination file not readable"
    return 1
  fi

  return 0
}
```

### Git Commit Validation
**Purpose**: Ensure git operations complete successfully

#### Success Criteria
- ✅ Files staged correctly
- ✅ Commit created with descriptive message
- ✅ Push to remote repository succeeds
- ✅ No uncommitted changes remain

#### Validation Steps
```bash
validate_git_commit() {
  local repo_path="$1"
  local expected_files=("$@")  # Array of files that should be committed

  # Check files are staged
  local staged_files=$(git -C "$repo_path" diff --cached --name-only)
  for file in "${expected_files[@]}"; do
    if echo "$staged_files" | grep -q "^$file$"; then
      echo "✅ File staged: $file"
    else
      echo "❌ File not staged: $file"
      return 1
    fi
  done

  # Create commit
  if git -C "$repo_path" commit -m "Publish extensions: $(echo "${expected_files[@]}" | tr ' ' ',')" >/dev/null 2>&1; then
    local commit_hash=$(git -C "$repo_path" rev-parse HEAD)
    echo "✅ Commit created: $commit_hash"
  else
    echo "❌ Commit failed"
    return 1
  fi

  # Push to remote
  if git -C "$repo_path" push origin main >/dev/null 2>&1; then
    echo "✅ Push successful"
  else
    echo "❌ Push failed"
    return 1
  fi

  return 0
}
```

### Symlink Replacement Validation
**Purpose**: Ensure local files are replaced with symlinks correctly

#### Success Criteria
- ✅ Original file backed up before replacement
- ✅ Symlink created pointing to repository file
- ✅ Symlink provides same content as original file
- ✅ No data loss occurred

#### Validation Steps
```bash
validate_symlink_replacement() {
  local original_file="$1"
  local repo_file="$2"
  local backup_file="$3"

  # Check backup was created
  if [ -f "$backup_file" ]; then
    echo "✅ Backup created: $backup_file"
  else
    echo "❌ Backup not found: $backup_file"
    return 1
  fi

  # Check original is now a symlink
  if [ -L "$original_file" ]; then
    echo "✅ Original file converted to symlink"
  else
    echo "❌ Original file not converted to symlink"
    return 1
  fi

  # Check symlink points to repository
  local target=$(readlink "$original_file")
  if [ "$target" = "$repo_file" ]; then
    echo "✅ Symlink points to repository file"
  else
    echo "❌ Symlink points to wrong location: $target"
    return 1
  fi

  # Compare content accessibility
  if cmp -s "$backup_file" "$original_file"; then
    echo "✅ Content accessible through symlink"
  else
    echo "❌ Content changed after symlink replacement"
    return 1
  fi

  return 0
}
```

## Post-Operation Validation

### System Integrity Check
**Purpose**: Ensure overall system remains functional after operations

#### Success Criteria
- ✅ No broken symlinks exist
- ✅ All settings.json files are valid JSON
- ✅ Extensions are discoverable and executable
- ✅ No permission issues introduced

#### Validation Steps
```bash
validate_system_integrity() {
  local scope_dir="$1"  # ~/.claude or project .claude directory

  echo "🔍 System Integrity Check for $scope_dir"

  # Check for broken symlinks
  local broken_count=0
  find "$scope_dir" -type l | while read -r symlink; do
    if [ ! -e "$symlink" ]; then
      echo "❌ Broken symlink: $symlink"
      broken_count=$((broken_count + 1))
    fi
  done

  if [ "$broken_count" -eq 0 ]; then
    echo "✅ No broken symlinks found"
  fi

  # Validate settings.json
  if [ -f "$scope_dir/settings.json" ]; then
    if jq '.' "$scope_dir/settings.json" >/dev/null 2>&1; then
      echo "✅ settings.json is valid JSON"
    else
      echo "❌ settings.json contains invalid JSON"
      return 1
    fi
  fi

  # Test extension discovery
  local extension_types=("prompts" "agents" "commands")
  for type in "${extension_types[@]}"; do
    if [ -d "$scope_dir/$type" ]; then
      local count=$(find "$scope_dir/$type" -name "*.md" | wc -l)
      echo "✅ Found $count $type extensions"
    fi
  done

  return 0
}
```

### Functional Testing
**Purpose**: Verify extensions work as expected after installation

#### Success Criteria
- ✅ Templates can be discovered and loaded
- ✅ Hooks trigger correctly
- ✅ Commands execute without errors
- ✅ Content is accessible and formatted correctly

#### Validation Steps
```bash
validate_extension_functionality() {
  local extension_path="$1"
  local extension_type="$2"  # prompt, agent, command, hook

  case "$extension_type" in
    "prompt"|"agent"|"command")
      # Test file readability and basic content structure
      if [ -r "$extension_path" ]; then
        echo "✅ Extension readable: $extension_path"

        # Check for YAML frontmatter
        if head -5 "$extension_path" | grep -q "^---$"; then
          echo "✅ YAML frontmatter detected"
        else
          echo "⚠️  No YAML frontmatter found"
        fi

        # Check file is not empty
        if [ -s "$extension_path" ]; then
          echo "✅ Extension has content"
        else
          echo "❌ Extension file is empty"
          return 1
        fi
      else
        echo "❌ Extension not readable: $extension_path"
        return 1
      fi
      ;;

    "hook")
      # Test hook script execution
      if [ -x "$extension_path" ]; then
        echo "✅ Hook script executable: $extension_path"

        # Basic syntax check
        if bash -n "$extension_path" 2>/dev/null; then
          echo "✅ Hook script syntax valid"
        else
          echo "❌ Hook script has syntax errors"
          return 1
        fi
      else
        echo "❌ Hook script not executable: $extension_path"
        return 1
      fi
      ;;
  esac

  return 0
}
```

## Comprehensive Validation Suite

### Full Operation Validation
**Purpose**: Run complete validation for any extension management operation

```bash
#!/bin/bash
# Full validation suite for extension management operations

validate_operation() {
  local operation="$1"  # sync or publish
  local scope="$2"      # profile, project, local
  local extensions=("${@:3}")  # Array of extension names

  echo "🔍 Starting validation for $operation operation (scope: $scope)"

  # Pre-operation validation
  echo "📋 Pre-operation validation..."
  validate_repository "$(get_repo_path)" || return 1
  validate_connectivity "$(get_repo_path)" || return 1
  validate_disk_space || return 1

  local target_dir
  case "$scope" in
    "profile") target_dir="$HOME/.claude" ;;
    "project") target_dir="$(dirname $(git rev-parse --show-toplevel))/.claude" ;;
    "local") target_dir="$(pwd)/.claude" ;;
  esac

  validate_permissions "$target_dir" || return 1

  # Operation-specific validation
  echo "📋 Operation-specific validation..."
  case "$operation" in
    "sync")
      validate_git_pull "$(get_repo_path)" || return 1

      for ext in "${extensions[@]}"; do
        validate_symlink "$target_dir/prompts/$ext.md" "$(get_repo_path)/prompts/$ext.md" || return 1
        validate_extension_functionality "$target_dir/prompts/$ext.md" "prompt" || return 1
      done
      ;;

    "publish")
      for ext in "${extensions[@]}"; do
        validate_file_copy "$target_dir/prompts/$ext.md" "$(get_repo_path)/prompts/$ext.md" || return 1
        validate_symlink_replacement "$target_dir/prompts/$ext.md" "$(get_repo_path)/prompts/$ext.md" "$target_dir/prompts/$ext.md.backup.*" || return 1
      done

      validate_git_commit "$(get_repo_path)" "${extensions[@]}" || return 1
      ;;
  esac

  # Post-operation validation
  echo "📋 Post-operation validation..."
  validate_system_integrity "$target_dir" || return 1

  echo "✅ All validation checks passed for $operation operation"
  return 0
}
```

## Success Metrics

### Quantitative Success Criteria
- **Symlink Success Rate**: 100% of requested symlinks created successfully
- **Data Integrity**: 0% data loss during operations
- **JSON Validity**: 100% of settings.json files remain valid
- **Operation Completion**: 100% of requested operations complete without manual intervention
- **Error Recovery**: 100% of operations can be rolled back if needed

### Qualitative Success Criteria
- **User Experience**: Operations complete transparently without user confusion
- **System Stability**: No degradation in Claude Code functionality
- **Performance**: Operations complete within reasonable time (< 30 seconds for typical use)
- **Discoverability**: Installed extensions are immediately available for use
- **Reliability**: Operations succeed consistently across different environments

### Validation Report Format
```
🔍 Extension Management Validation Report
Operation: [sync|publish]
Scope: [profile|project|local]
Timestamp: YYYY-MM-DD HH:MM:SS

📋 Pre-Operation Checks:
✅ Repository accessibility
✅ Network connectivity
✅ Disk space (XXX MB available)
✅ File permissions

📋 Operation Results:
✅ Git operations (X files affected)
✅ Symlink creation (X symlinks created)
✅ Hook installation (X hooks configured)
✅ File validation (X files verified)

📋 Post-Operation Checks:
✅ System integrity
✅ Extension functionality
✅ JSON validity
✅ No broken symlinks

🎯 Success Metrics:
- Completion Rate: 100%
- Data Integrity: 100%
- Error Rate: 0%
- Performance: XXs elapsed

✅ VALIDATION PASSED - Operation completed successfully
```

These validation criteria ensure that every extension management operation maintains system integrity while providing reliable functionality for users.