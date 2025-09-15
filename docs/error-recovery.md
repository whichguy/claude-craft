# Extension Management Error Recovery & Rollback Procedures

This document provides specific procedures for recovering from errors during sync and publish operations in the claude-craft bidirectional extension management system.

## Overview

Extension management operations can fail at various stages. This guide provides step-by-step recovery procedures for each type of failure, ensuring system integrity and data safety.

## Error Categories

### 🔄 Sync Operation Errors (Repository → Local)

#### Git Pull Failures
**Symptoms**: Repository update fails, stale data warnings
**Causes**: Network issues, repository conflicts, authentication problems

**Recovery Procedure**:
```bash
# 1. Check repository accessibility
cd ~/claude-craft  # or your repository path
git status

# 2. If repository has uncommitted changes
git stash push -m "Emergency stash before sync recovery"

# 3. Force pull with conflict resolution
git fetch origin
git reset --hard origin/main  # or your main branch

# 4. Retry sync operation
/prompt sync [original-selection]

# 5. If recovery successful, restore stashed changes
git stash pop  # Only if you had uncommitted changes
```

**Prevention**: Always run sync operations in clean repository state

#### Symlink Creation Failures
**Symptoms**: Permission denied, file system errors, broken symlinks
**Causes**: Permission issues, file system limitations, existing files

**Recovery Procedure**:
```bash
# 1. Identify failed symlinks
find ~/.claude -type l ! -e  # Find broken symlinks

# 2. Remove broken symlinks
find ~/.claude -type l ! -e -delete

# 3. Check permissions
ls -la ~/.claude/prompts/  # Check directory permissions
chmod 755 ~/.claude/prompts/  # Fix if needed

# 4. Backup existing files that might conflict
for file in ~/.claude/prompts/conflicting-extension.md; do
  if [ -f "$file" ] && [ ! -L "$file" ]; then
    mv "$file" "$file.backup.$(date +%s)"
  fi
done

# 5. Retry symlink creation
ln -sf ~/claude-craft/prompts/extension.md ~/.claude/prompts/extension.md

# 6. Verify symlink integrity
ls -la ~/.claude/prompts/extension.md
cat ~/.claude/prompts/extension.md  # Should show content
```

#### Hook Installation Failures
**Symptoms**: settings.json corruption, invalid JSON, hook not triggered
**Causes**: Malformed JSON, permission issues, syntax errors

**Recovery Procedure**:
```bash
# 1. Backup current settings.json
cp ~/.claude/settings.json ~/.claude/settings.json.backup.$(date +%s)

# 2. Validate JSON syntax
jq '.' ~/.claude/settings.json

# 3. If JSON is invalid, restore from backup
ls -la ~/.claude/settings.json.backup.*  # List available backups
cp ~/.claude/settings.json.backup.NEWEST ~/.claude/settings.json

# 4. If no backup available, extract hooks section
jq '.hooks' ~/.claude/settings.json.backup.NEWEST > /tmp/hooks-backup.json

# 5. Restore hooks to working settings.json
jq '.hooks = {}' ~/.claude/settings.json > /tmp/settings-clean.json
cp /tmp/settings-clean.json ~/.claude/settings.json

# 6. Manually re-add hooks from backup
# Edit ~/.claude/settings.json and integrate hooks from /tmp/hooks-backup.json

# 7. Validate final result
jq '.hooks' ~/.claude/settings.json
```

### 📤 Publish Operation Errors (Local → Repository)

#### Git Operation Failures
**Symptoms**: Commit fails, push rejected, repository conflicts
**Causes**: Merge conflicts, authentication issues, repository protection

**Recovery Procedure**:
```bash
# 1. Check repository status
cd ~/claude-craft
git status

# 2. If there are merge conflicts
git status | grep "both modified"  # Identify conflicted files

# For each conflicted file:
git show HEAD:prompts/conflicted-file.md > /tmp/repo-version.md
cp prompts/conflicted-file.md /tmp/local-version.md

# 3. Resolve conflicts manually
# Edit prompts/conflicted-file.md to resolve conflicts
# Or choose one version:
git checkout --theirs prompts/conflicted-file.md  # Keep repository version
# OR
git checkout --ours prompts/conflicted-file.md    # Keep local version

# 4. Complete merge
git add prompts/conflicted-file.md
git commit -m "Resolve merge conflict in conflicted-file.md"

# 5. Retry push
git push origin main

# 6. If push still fails, force push (DANGEROUS - use with caution)
git push --force-with-lease origin main
```

#### Symlink Replacement Failures
**Symptoms**: Original file lost, symlink points nowhere, content mismatch
**Causes**: File operation race conditions, permission issues

**Recovery Procedure**:
```bash
# 1. Check if original file exists in repository
ls -la ~/claude-craft/prompts/extension.md

# 2. If repository file exists but symlink broken
rm ~/.claude/prompts/extension.md  # Remove broken symlink
ln -sf ~/claude-craft/prompts/extension.md ~/.claude/prompts/extension.md

# 3. If repository file missing, restore from backup
ls -la ~/.claude/prompts/extension.md.backup.*
cp ~/.claude/prompts/extension.md.backup.NEWEST ~/claude-craft/prompts/extension.md

# 4. If no backup, recreate file from content
# Use git history to restore
cd ~/claude-craft
git log --oneline prompts/extension.md  # Find last good commit
git show COMMIT_HASH:prompts/extension.md > prompts/extension.md

# 5. Re-establish symlink
rm ~/.claude/prompts/extension.md
ln -sf ~/claude-craft/prompts/extension.md ~/.claude/prompts/extension.md

# 6. Commit restoration
git add prompts/extension.md
git commit -m "Restore extension.md from backup"
git push origin main
```

### 🗂️ File System Errors

#### Permission Denied
**Symptoms**: Cannot create symlinks, cannot write to directories
**Causes**: Insufficient permissions, directory ownership issues

**Recovery Procedure**:
```bash
# 1. Check directory ownership
ls -la ~/.claude/
ls -la ~/claude-craft/

# 2. Fix ownership if needed
sudo chown -R $(whoami):$(id -gn) ~/.claude/
sudo chown -R $(whoami):$(id -gn) ~/claude-craft/

# 3. Fix permissions
chmod -R 755 ~/.claude/
chmod -R 755 ~/claude-craft/

# 4. Retry operation
/prompt sync [original-selection]
```

#### Disk Space Issues
**Symptoms**: No space left on device, operation incomplete
**Causes**: Full disk, large backup files

**Recovery Procedure**:
```bash
# 1. Check disk space
df -h ~/.claude
df -h ~/claude-craft

# 2. Clean up backup files
find ~/.claude -name "*.backup.*" -mtime +7 -delete  # Remove week-old backups
find ~/claude-craft -name "*.backup.*" -mtime +7 -delete

# 3. Clean up git repository
cd ~/claude-craft
git gc --aggressive --prune=now

# 4. Check for large files
find ~/.claude -size +10M -ls
find ~/claude-craft -size +10M -ls

# 5. Remove unnecessary files and retry
```

## Complete Rollback Procedures

### Full Sync Rollback
**When**: Sync operation caused system instability
**Procedure**:
```bash
# 1. Document current state
find ~/.claude -type l > /tmp/current-symlinks.txt

# 2. Remove all symlinks created during sync
while IFS= read -r symlink; do
  if [ -L "$symlink" ]; then
    target=$(readlink "$symlink")
    if [[ "$target" == */claude-craft/* ]]; then
      rm "$symlink"
      echo "Removed symlink: $symlink"
    fi
  fi
done < /tmp/current-symlinks.txt

# 3. Restore from backups
find ~/.claude -name "*.backup.*" | while read backup; do
  original="${backup%.backup.*}"
  if [ ! -e "$original" ]; then
    cp "$backup" "$original"
    echo "Restored: $original"
  fi
done

# 4. Restore settings.json
if [ -f ~/.claude/settings.json.backup.* ]; then
  newest_backup=$(ls -t ~/.claude/settings.json.backup.* | head -1)
  cp "$newest_backup" ~/.claude/settings.json
  echo "Restored settings.json from: $newest_backup"
fi

# 5. Verify system state
jq '.' ~/.claude/settings.json  # Validate JSON
ls -la ~/.claude/prompts/      # Check prompt files
```

### Full Publish Rollback
**When**: Publish operation corrupted repository
**Procedure**:
```bash
# 1. Revert repository to previous state
cd ~/claude-craft
git log --oneline -10  # Find commit before publish

# 2. Create recovery branch
git checkout -b recovery-$(date +%s)

# 3. Reset to previous state (choose one):
# Option A: Soft reset (keeps changes in working directory)
git reset --soft HEAD~1

# Option B: Hard reset (removes all changes)
git reset --hard HEAD~1

# 4. Force push if necessary (DANGEROUS)
git push --force-with-lease origin main

# 5. Restore local files from backups
find ~/.claude -name "*.backup.*" | while read backup; do
  original="${backup%.backup.*}"
  if [ -L "$original" ]; then
    rm "$original"  # Remove symlink
    cp "$backup" "$original"  # Restore original file
    echo "Restored local file: $original"
  fi
done

# 6. Clean up symlinks pointing to reverted content
find ~/.claude -type l | while read symlink; do
  if [ ! -e "$symlink" ]; then
    rm "$symlink"
    echo "Removed broken symlink: $symlink"
  fi
done
```

## Prevention Strategies

### Pre-Operation Checklist
1. **Repository State**: Ensure clean working directory
2. **Backup Creation**: Automatic backups of settings.json and local files
3. **Permission Check**: Verify write permissions to target directories
4. **Disk Space**: Ensure adequate space for operations
5. **Network Connectivity**: Verify git repository accessibility

### Automatic Backup Strategy
```bash
# Backup function (should be integrated into sync/publish operations)
create_backup() {
  local file="$1"
  local backup_dir="$(dirname "$file")"
  local backup_file="$file.backup.$(date +%s)"

  if [ -f "$file" ]; then
    cp "$file" "$backup_file"
    echo "Created backup: $backup_file"
  fi
}

# Clean old backups (run periodically)
cleanup_old_backups() {
  find ~/.claude -name "*.backup.*" -mtime +30 -delete
  find ~/claude-craft -name "*.backup.*" -mtime +30 -delete
}
```

### Health Check Function
```bash
# System health check
check_system_health() {
  echo "🔍 Claude Code Extension System Health Check"

  # Check symlinks
  broken_symlinks=$(find ~/.claude -type l ! -e | wc -l)
  echo "Broken symlinks: $broken_symlinks"

  # Check JSON validity
  if jq '.' ~/.claude/settings.json >/dev/null 2>&1; then
    echo "✅ settings.json is valid"
  else
    echo "❌ settings.json is invalid"
  fi

  # Check repository status
  if cd ~/claude-craft && git status --porcelain | grep -q .; then
    echo "⚠️  Repository has uncommitted changes"
  else
    echo "✅ Repository is clean"
  fi

  # Check disk space
  available=$(df -h ~/.claude | tail -1 | awk '{print $4}')
  echo "Available space: $available"
}
```

By following these procedures, users can safely recover from any errors encountered during extension management operations while preserving data integrity and system functionality.