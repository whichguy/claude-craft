# Edge Case Test Suite (v2 - Task-Native)

This document describes manual verification tests for the Task-native v2 implementation.
These tests replace the bash-based test-edge-cases.sh with verification procedures that work with the new architecture.

## Test Execution

Run these tests manually by executing the described scenarios. Each test validates that edge cases are properly handled.

---

## Test 1: Empty/Invalid Task ID (Edge Case #1)

**Purpose**: Verify invalid task IDs are rejected before processing.

**Test Steps**:
1. Try to read a meta.json with empty task ID:
   ```
   Read({ file_path: '~/.claude/async-prep//meta.json' })
   ```
2. Try to read with traversal path:
   ```
   Read({ file_path: '~/.claude/async-prep/../evil/meta.json' })
   ```

**Expected**: Both should fail with path validation errors.

**v2 Handling**: The Task ID regex `/^[0-9]{13}-[a-f0-9]{8}$/` rejects invalid IDs before any file operations.

---

## Test 2: Path Traversal Attack (Edge Case #2)

**Purpose**: Verify path traversal attacks are blocked.

**Test Steps**:
1. Manually create a symlink:
   ```bash
   ln -s /etc/passwd ~/.claude/async-prep/malicious-link
   ```
2. Run /todo-cleanup
3. Verify symlink is skipped, not followed

**Expected**: Symlink should be skipped with warning, not processed or deleted.

**v2 Handling**: Read tool validates paths. Symlinks to sensitive locations fail permission checks. Task ID validation rejects `..` and `/`.

---

## Test 3: ID Collision (Edge Case #3)

**Purpose**: Verify concurrent ID generation produces unique IDs.

**Test Steps**:
1. Launch 5 concurrent /todo commands:
   ```
   /todo "test 1"
   /todo "test 2"
   /todo "test 3"
   /todo "test 4"
   /todo "test 5"
   ```
   (Run these as fast as possible, or use parallel agents)

2. Check all created task IDs:
   ```bash
   ls ~/.claude/async-prep/
   ```

**Expected**: All 5 task directories should have unique IDs.

**v2 Handling**: Uses `python3 os.urandom(4)` which is cryptographically random and collision-free for practical purposes. The 4-byte (8-hex-char) random suffix provides 2^32 possible values per millisecond.

---

## Test 4: Invalid Date Parsing (Edge Case #4)

**Purpose**: Verify invalid dates don't cause premature cleanup or crashes.

**Test Steps**:
1. Create a task directory manually:
   ```bash
   mkdir -p ~/.claude/async-prep/1234567890123-abcd1234
   ```

2. Create corrupted meta.json with invalid date:
   ```json
   {
     "status": "READY",
     "timeout_at": "invalid-date",
     "cleanup_at": "also-invalid"
   }
   ```

3. Run /todo-cleanup

**Expected**: Task should be skipped, not deleted or marked abandoned (dates parse to Infinity as fallback).

**v2 Handling**: `Date.parse()` returns `NaN` for invalid dates. The code uses `Number.isNaN()` check with Infinity fallback, which means invalid dates are treated as "never expire". Note: the old `|| Infinity` pattern was buggy for epoch 0 (`Date.parse("1970-01-01")` returns 0, and `0 || Infinity` = Infinity).

---

## Test 5: Meta.json Corruption (Edge Case #5)

**Purpose**: Verify corrupted JSON doesn't crash operations.

**Test Steps**:
1. Create a task directory:
   ```bash
   mkdir -p ~/.claude/async-prep/1234567890124-abcd1235
   ```

2. Create corrupted meta.json:
   ```bash
   echo "not valid json {{{" > ~/.claude/async-prep/1234567890124-abcd1235/meta.json
   ```

3. Run /todo-cleanup

**Expected**: Task should be skipped with warning, not deleted.

**v2 Handling**: All JSON parsing is wrapped in try/catch. Corrupted files are logged and skipped.

---

## Test 6: Large Content (>100KB) (Edge Case #6)

**Purpose**: Verify large content is handled without issues.

**Test Steps**:
1. Create a /todo with very large description:
   ```
   /todo "$(python3 -c "print('x' * 100000)")"
   ```

   Or manually test Write tool with 100KB+ content:
   ```javascript
   Write({
     file_path: '~/.claude/async-prep/test/large-expansion.md',
     content: 'x'.repeat(150000)
   })
   ```

**Expected**: File should be written successfully without truncation.

**v2 Handling**: Write tool has no size limits. Unlike bash which has ARG_MAX limits, JavaScript handles strings of any size.

---

## Test 7: File Descriptor Leak (Edge Case #7)

**Purpose**: Verify no FD leaks occur during operations.

**Test Steps**:
1. Run multiple /todo commands in sequence:
   ```
   for i in {1..20}; do /todo "test $i"; done
   ```

2. Check FD count:
   ```bash
   lsof -p <claude-pid> | wc -l
   ```

**Expected**: FD count should remain stable, not grow unbounded.

**v2 Handling**: Task tool manages resources internally. No manual file handles are opened by the v2 implementation.

---

## Test 8: Concurrent Generation (Edge Case #8)

**Purpose**: Verify concurrent task creation works correctly.

**Test Steps**:
1. Use parallel Task agents to create tasks simultaneously:
   ```javascript
   // Launch 3 parallel agents
   Task({ prompt: '/todo "parallel test 1"', run_in_background: true })
   Task({ prompt: '/todo "parallel test 2"', run_in_background: true })
   Task({ prompt: '/todo "parallel test 3"', run_in_background: true })
   ```

2. Verify all tasks created successfully

**Expected**: All tasks should be created with unique IDs, no race conditions.

**v2 Handling**: TaskCreate tool has built-in concurrency handling. Write tool uses atomic operations.

---

## Test 9: Invalid jq Filter (Edge Case #9)

**Purpose**: Verify jq failure in hook doesn't crash the system.

**v2 Handling**: No jq in command files (all JSON operations use native JavaScript). The hook (`detect-quality-review.sh`) still requires jq but checks for it at startup (`command -v jq &>/dev/null || exit 0`) — missing jq causes silent exit, not crash.

---

## Test 10: Symbolic Link Safety (Edge Case #10)

**Purpose**: Verify symlinks don't allow unauthorized file access.

**Test Steps**:
1. Create a symlink in async-prep:
   ```bash
   ln -s /etc/shadow ~/.claude/async-prep/shadow-link
   ```

2. Try to read via the link:
   ```javascript
   Read({ file_path: '~/.claude/async-prep/shadow-link' })
   ```

**Expected**: Read should fail with permission error.

**v2 Handling**: Read tool validates paths and permissions. Symlinks to protected locations are rejected.

---

## Test 11: Cross-Platform Dates (Edge Case #11)

**Purpose**: Verify date handling works on macOS and Linux.

**Test Steps**:
1. On macOS, create a task:
   ```
   /todo "test macOS dates"
   ```

2. Check meta.json dates are ISO format:
   ```bash
   cat ~/.claude/async-prep/*/meta.json | grep timeout_at
   ```

**Expected**: Dates should be in ISO 8601 format: `2026-02-05T12:00:00.000Z`

**v2 Handling**: JavaScript `Date` and `toISOString()` are universal across platforms. No macOS/Linux-specific date commands needed.

---

## Test 12: Lock Stale/Timeout (Edge Case #12)

**Purpose**: This edge case is **eliminated** in v2 for command files.

**v2 Handling**: No file locking needed in command files. Task tool handles concurrency internally. Write tool operations are atomic. The hook uses file-level atomicity (write to tmp, mv) for `.hook-state.json`.

---

## Test 13: Crashed RUNNING Task Detection (Edge Case #13)

**Purpose**: Verify cleanup correctly handles crashed RUNNING tasks while giving active tasks grace period.

**Test Steps**:
1. Start a /bg task that takes time to complete
2. Immediately run /todo-cleanup
3. Verify the active task is not affected (RUNNING gets 1-hour grace period)
4. Manually set a task to RUNNING with timeout_at in the past + >1hr ago
5. Run /todo-cleanup again
6. Verify the stale RUNNING task is now marked ABANDONED

**Expected**: Active RUNNING tasks should not be cleaned up within 1hr of timeout. Stale RUNNING tasks (past timeout + 1hr grace) should be marked ABANDONED.

**v2 Handling**: RUNNING status is set as the first agent action (Phase 0). Cleanup gives RUNNING tasks a 1-hour grace period beyond timeout_at before marking ABANDONED. This distinguishes crashed agents from slow-running agents.

---

## Summary: Edge Case Coverage

| # | Edge Case | v1 Solution | v2 Solution | Status |
|---|-----------|-------------|-------------|--------|
| 1 | Empty/Invalid Task ID | validate_task_id() | Regex validation | ✅ Covered |
| 2 | Path Traversal Attack | String checks | Read tool + regex + startsWith | ✅ Covered |
| 3 | ID Collision | mkdir-based retry | python3 os.urandom() | ✅ Improved |
| 4 | Invalid Date Parsing | Default fallback | Number.isNaN() check (not \|\| Infinity) | ✅ Fixed |
| 5 | Meta.json Corruption | jq validation | try/catch JSON.parse | ✅ Covered |
| 6 | Large Content (>100KB) | --rawfile jq | Write tool (no limits) | ✅ Improved |
| 7 | File Descriptor Leak | Explicit cleanup | No FDs used | ✅ Eliminated |
| 8 | Concurrent Generation | mkdir-based locking | TaskCreate atomic | ✅ Improved |
| 9 | Invalid jq Filter | Filter validation | No jq in commands (hook checks at startup) | ✅ Mitigated |
| 10 | Symbolic Link Safety | -L check | Read tool validation | ✅ Covered |
| 11 | Cross-Platform Dates | macOS/Linux branching | JavaScript Date | ✅ Improved |
| 12 | Lock Stale/Timeout | PID tracking | Not needed (hook uses file atomicity) | ✅ Eliminated |
| 13 | Crashed RUNNING Tasks | File locking | RUNNING status + 1hr grace in cleanup | ✅ Improved |

## Running Automated Verification

To run a quick automated check:

```bash
# Check async-prep directory structure
ls -la ~/.claude/async-prep/

# Verify no orphaned temp files
find ~/.claude/async-prep -name "*.tmp*" -o -name "*.lock"

# Check all meta.json files are valid JSON (python3, no jq dependency)
for f in ~/.claude/async-prep/*/meta.json; do
  python3 -c "import json; json.load(open('$f'))" 2>/dev/null || echo "Invalid: $f"
done

# Check task ID format validity
for d in ~/.claude/async-prep/*/; do
  id=$(basename "$d")
  if [[ ! "$id" =~ ^[0-9]{13}-[a-f0-9]{8}$ ]]; then
    echo "Invalid task ID: $id"
  fi
done

# Check for stale .review-pending files (should be cleaned by /todo-cleanup)
find ~/.claude/async-prep -name ".review-pending" -mtime +7
```
