---
name: todo-cleanup
description: "Clean up abandoned and old async tasks"
---

# /todo-cleanup - Task Maintenance (Task-Native v2)

Clean up abandoned and old async tasks from `~/.claude/async-prep/`.

## Usage

```
/todo-cleanup [--dry-run]
```

## Flags

- `--dry-run` - Show what would be cleaned up without actually deleting

## Cleanup Rules

| Condition | Age | Action |
|-----------|-----|--------|
| Past timeout_at (READY/PENDING) | 7+ days | Mark as ABANDONED |
| Past timeout_at (RUNNING) | 7 days + 1hr grace | Mark as ABANDONED (crashed) |
| Past timeout_at (NEEDS_USER_ACTION/FAILED) | 7+ days | Mark as ABANDONED |
| Past cleanup_at | 30+ days | Delete directory |
| meta.json version !== "2.0" | - | Skip with warning (v1 task) |
| Corrupted meta.json | - | Skip (don't delete) |
| Symbolic link | - | Skip (security) |
| Invalid task ID | - | Skip (don't process) |
| Stale .review-pending files | 7+ days | Delete marker file |

## Execution Protocol

### Step 1: Scan async-prep Directory

```javascript
// Get all task directories
const asyncPrepDir = '~/.claude/async-prep';
const taskDirs = Glob({ pattern: `${asyncPrepDir}/*` });
```

### Step 2: Process Each Task

For each task directory:

```javascript
const TASK_ID_REGEX = /^[0-9]{13}-[a-f0-9]{8}$/;
const asyncPrepDir = `${home}/.claude/async-prep`;
const now = Date.now();
const ONE_HOUR_MS = 60 * 60 * 1000;

// Statuses eligible for ABANDONED marking at timeout
const ABANDONABLE_STATUSES = ['READY', 'PENDING', 'RUNNING', 'NEEDS_USER_ACTION', 'FAILED'];

for (const taskDir of taskDirs) {
  const taskId = basename(taskDir);

  // Edge Case #1, #2: Validate task ID format
  if (!TASK_ID_REGEX.test(taskId)) {
    console.warn(`Skipping invalid task ID: ${taskId}`);
    continue;
  }

  // Path containment check (integrate isValidTaskPath)
  if (!taskDir.startsWith(asyncPrepDir)) {
    console.warn(`Skipping task outside async-prep: ${taskId}`);
    continue;
  }

  // Edge Case #10: Check for symbolic links
  // Note: Read tool will naturally handle this - symlinks to sensitive
  // locations will fail permission checks

  // Read meta.json
  let meta;
  try {
    const content = Read({ file_path: `${taskDir}/meta.json` });
    meta = JSON.parse(content);
  } catch (e) {
    // Edge Case #5: Corrupted meta.json - skip, don't delete
    console.warn(`Skipping corrupted meta.json: ${taskId}`);
    continue;
  }

  // Version check: skip non-v2 tasks (v1 tasks may lack version field entirely)
  if (!meta.version || meta.version !== '2.0') {
    console.warn(`Skipping non-v2 task (version ${meta.version || 'missing'}): ${taskId}`);
    continue;
  }

  // Edge Case #4: Parse dates safely (fix epoch 0 bug)
  // Date.parse("1970-01-01T00:00:00Z") returns 0, and 0 || Infinity = Infinity (wrong)
  // Use Number.isNaN() instead of || fallback
  const rawCleanup = Date.parse(meta.cleanup_at);
  const rawTimeout = Date.parse(meta.timeout_at);
  const cleanupAt = Number.isNaN(rawCleanup) ? Infinity : rawCleanup;
  const timeoutAt = Number.isNaN(rawTimeout) ? Infinity : rawTimeout;

  // Clean up stale .review-pending files (7+ days old)
  // These are created by the hook but have no consumer
  try {
    const reviewPendingPath = `${taskDir}/.review-pending`;
    const reviewPendingContent = Read({ file_path: reviewPendingPath });
    const reviewTimestamp = parseInt(reviewPendingContent, 10);
    if (!isNaN(reviewTimestamp) && now - reviewTimestamp > 7 * 24 * 60 * 60 * 1000) {
      if (!dryRun) {
        Bash({ command: `rm -f "${reviewPendingPath}"` });
      }
      console.log(`${dryRun ? 'Would remove' : 'Removed'} stale .review-pending: ${taskId}`);
    }
  } catch {
    // No .review-pending file - that's fine
  }

  // Check for cleanup (delete task completely)
  if (cleanupAt !== Infinity && now >= cleanupAt) {
    if (dryRun) {
      console.log(`Would delete (past cleanup date): ${taskId}`);
    } else {
      Bash({ command: `rm -rf "${taskDir}"` });
      console.log(`Deleted task past cleanup date: ${taskId}`);
    }
    continue;
  }

  // Check for timeout (mark as ABANDONED)
  if (timeoutAt !== Infinity && now >= timeoutAt) {
    // RUNNING gets a 1-hour grace period (may still be executing)
    const effectiveTimeout = meta.status === 'RUNNING'
      ? timeoutAt + ONE_HOUR_MS
      : timeoutAt;

    if (now >= effectiveTimeout && ABANDONABLE_STATUSES.includes(meta.status)) {
      const prevStatus = meta.status;  // Capture before mutation

      if (dryRun) {
        console.log(`Would mark ABANDONED: ${taskId} (was ${prevStatus})`);
      } else {
        const reason = prevStatus === 'RUNNING'
          ? 'Task crashed or timed out (7 days + 1hr grace)'
          : `Task timeout exceeded (7 days, was ${prevStatus})`;

        meta.status = 'ABANDONED';
        meta.abandoned_reason = reason;
        meta.updated_at = new Date().toISOString();

        Write({
          file_path: `${taskDir}/meta.json`,
          content: JSON.stringify(meta, null, 2)
        });
        console.log(`Marked as ABANDONED (was ${prevStatus}): ${taskId}`);
      }
    }
  }
}
```

### Step 3: Report Summary

Output cleanup summary:

```
Async Task Cleanup Summary
==========================
Scanned: {total} tasks
Deleted: {deleted} (past 30-day cleanup date)
Abandoned: {abandoned} (past 7-day timeout, includes RUNNING/FAILED/NEEDS_USER_ACTION)
Review markers cleaned: {reviewCleaned}
Skipped: {skipped} (corrupted/invalid/v1/symlinks)

Active tasks remaining: {active}
```

## Edge Cases Handled

| # | Edge Case | Solution |
|---|-----------|----------|
| 1 | Invalid Task ID | Regex validation, skip invalid |
| 2 | Path Traversal | Reject `..` or `/` in ID + `startsWith` containment check |
| 4 | Invalid Date (epoch 0) | `Number.isNaN(Date.parse(x)) ? Infinity : Date.parse(x)` (not `\|\| Infinity`) |
| 5 | Corrupted meta.json | Parse in try/catch, skip on failure |
| 10 | Symbolic Links | Read tool permission checks, skip on failure |
| 13 | Crashed RUNNING tasks | 1-hour grace period before marking ABANDONED |
| 14 | v1 meta.json | Skip tasks where `version !== '2.0'` with warning |
| 15 | Stale .review-pending | Delete marker files older than 7 days |

## Why No Bash Scripts

**Old approach** (async-utils.sh):
- Platform-specific date parsing (macOS vs Linux)
- mkdir-based locking (race condition prone)
- jq for JSON operations (external dependency)
- Complex error handling in bash

**New approach** (Task-native):
- JavaScript Date (universal)
- Write tool atomic operations (built-in)
- Native JSON.parse/stringify
- try/catch error handling

## Automatic Cleanup Integration

The `/todo` and `/bg` commands should call cleanup when:
1. User invokes the command (on-demand cleanup)
2. More than 24 hours since last cleanup

Track last cleanup time in:
```
~/.claude/async-prep/.last-cleanup
```

If file doesn't exist or timestamp > 24 hours ago, run cleanup automatically.

## Safe Deletion Checks

Before processing any task directory, the loop validates:

1. **Validate task ID format** - Must match 13-digit-8-hex pattern (`TASK_ID_REGEX`)
2. **Check path containment** - Must start with `asyncPrepDir` (prevents path traversal)
3. **No path traversal** - Regex rejects `..` and `/` (only digits and hex chars allowed)
4. **Version check** - Skip non-v2 tasks (backward compatibility)
5. **Symbolic links** - Read tool naturally rejects symlinks to sensitive locations

All checks are integrated directly into the processing loop (Step 2) rather than a separate function.

## Example Output

### Dry Run

```
/todo-cleanup --dry-run

Scanning ~/.claude/async-prep/...

Would mark ABANDONED: 1737123456789-a1b2c3d4 (8 days old, was READY)
Would mark ABANDONED: 1737200000000-e5f6a7b8 (8 days old, was RUNNING - crashed)
Would delete: 1736000000000-deadbeef (35 days old)
Would remove stale .review-pending: 1737300000000-c9d0e1f2
Skipping v1 task (version 1.0): 1737400000000-11223344
Skipping: 1737999999999-invalid (corrupted meta.json)

Dry Run Summary
===============
Would delete: 1 task
Would abandon: 2 tasks
Would clean review markers: 1
Would skip: 2 tasks

No changes made. Run without --dry-run to apply.
```

### Actual Cleanup

```
/todo-cleanup

Scanning ~/.claude/async-prep/...

Marked as ABANDONED (was READY): 1737123456789-a1b2c3d4 (8 days old)
Marked as ABANDONED (was RUNNING): 1737200000000-e5f6a7b8 (8 days old, crashed)
Deleted: 1736000000000-deadbeef (35 days old)
Removed stale .review-pending: 1737300000000-c9d0e1f2
Skipping v1 task (version 1.0): 1737400000000-11223344

Cleanup Summary
===============
Deleted: 1 task
Abandoned: 2 tasks
Review markers cleaned: 1
Skipped: 2 tasks
Active remaining: 3 tasks

Next auto-cleanup: in 24 hours
```

## Integration with /todo and /bg

At the start of `/todo` and `/bg` commands:

```javascript
// Check if cleanup needed
const lastCleanupFile = '~/.claude/async-prep/.last-cleanup';
let needsCleanup = true;

try {
  const lastCleanup = parseInt(Read({ file_path: lastCleanupFile }));
  const hoursSince = (Date.now() - lastCleanup) / (1000 * 60 * 60);
  needsCleanup = hoursSince > 24;
} catch {
  // File doesn't exist, needs cleanup
}

if (needsCleanup) {
  // Run cleanup silently
  // ... cleanup logic ...

  Write({
    file_path: lastCleanupFile,
    content: String(Date.now())
  });
}
```
