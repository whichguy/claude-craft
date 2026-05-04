#!/bin/bash
# detect-quality-review.sh (v2 - Self-contained, no async-utils.sh dependency)
# Detects when 'Run quality review' checkbox is checked in TodoWrite

set -euo pipefail

# Dependency check: jq required for JSON operations
command -v jq &>/dev/null || exit 0

ASYNC_PREP_DIR="${CLAUDE_PLUGIN_DATA:-${HOME}/.claude/plugins/data/async-suite}"
mkdir -p "$ASYNC_PREP_DIR" 2>/dev/null || true
TASK_ID_REGEX='^[0-9]{13}-[a-f0-9]{8}$'

# Validate task ID format (inline, no external dependency)
validate_task_id() {
    local task_id="$1"
    # Must match format: 13-digit-number dash 8-hex-char
    if [[ ! "$task_id" =~ $TASK_ID_REGEX ]]; then
        return 1
    fi
    # Check for path traversal
    if [[ "$task_id" == *".."* || "$task_id" == *"/"* ]]; then
        return 1
    fi
    return 0
}

# Extract task ID from TodoWrite content
extract_task_id_from_content() {
    local content="$1"
    local task_id
    # Look for pattern: Task: {task-id}
    task_id=$(echo "$content" | grep -oE 'Task: [0-9]{13}-[a-f0-9]{8}' | sed 's/Task: //' | head -1)
    # Fallback: try matching task-id alone
    if [[ -z "$task_id" ]]; then
        task_id=$(echo "$content" | grep -oE '[0-9]{13}-[a-f0-9]{8}' | head -1)
    fi
    echo "$task_id"
}

# Check if "Run quality review" checkbox was just checked
detect_quality_review_trigger() {
    local curr_content="$1"
    local prev_content="$2"

    # Check if current has checked box (supports both [x] and [X])
    if ! echo "$curr_content" | grep -qEi '\-[ \t]*\[x\][ \t]*Run quality review'; then
        return 1  # No checked box in current content
    fi

    # Check if previous content is empty (first time) or had unchecked box
    if [[ -z "$prev_content" ]] || \
       echo "$prev_content" | grep -qE '\-[ \t]*\[[ \t]*\][ \t]*Run quality review'; then
        return 0  # Trigger detected
    fi

    return 1  # No trigger (was already checked before)
}

# Store current TodoWrite content for next comparison
# Uses separate .hook-state.json to avoid race condition with meta.json
# (background agent also writes meta.json — last writer wins if shared)
store_todo_content() {
    local task_id="$1"
    local content="$2"
    local state_file="${ASYNC_PREP_DIR}/${task_id}/.hook-state.json"
    local tmp_file="${state_file}.tmp.$$"
    local content_file="${tmp_file}.content"
    local updated_at

    # Get timestamp (cross-platform)
    updated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Write content to temp file first to avoid ARG_MAX limits
    echo "$content" > "$content_file"

    # Write hook state as standalone JSON (not inside meta.json)
    if jq -n --arg updated "$updated_at" \
       --rawfile todo_content "$content_file" \
       '{ last_todo_content: $todo_content, last_todo_update: $updated }' \
       > "$tmp_file" 2>/dev/null; then
        mv "$tmp_file" "$state_file"
        rm -f "$content_file"
        return 0
    else
        rm -f "$tmp_file" "$content_file"
        return 1
    fi
}

# Main hook logic
main() {
    # Read hook input (tool call result)
    local tool_result
    tool_result=$(cat)

    # Extract current TodoWrite content from the tool call
    local curr_content
    curr_content=$(echo "$tool_result" | jq -r '.todos | map("- [\(if .status == "completed" then "x" else " " end)] \(.content)") | join("\n")' 2>/dev/null || echo "")

    if [[ -z "$curr_content" ]]; then
        exit 0  # No content to check
    fi

    # Extract task ID from content
    local task_id
    task_id=$(extract_task_id_from_content "$curr_content")

    if [[ -z "$task_id" ]]; then
        exit 0  # No task ID found
    fi

    # Validate task ID format
    if ! validate_task_id "$task_id"; then
        echo "⚠️  Invalid task ID format: $task_id" >&2
        exit 0
    fi

    local task_dir="${ASYNC_PREP_DIR}/${task_id}"
    local meta_file="${task_dir}/meta.json"

    # Check if task directory and meta.json exist
    if [[ ! -d "$task_dir" || ! -f "$meta_file" ]]; then
        echo "⚠️  Task directory not found: $task_id" >&2
        exit 0
    fi

    # Validate meta.json is not corrupted
    if ! jq empty "$meta_file" 2>/dev/null; then
        echo "⚠️  Task meta.json is corrupted: $task_id" >&2
        exit 0
    fi

    # Get previous TodoWrite content from .hook-state.json (separate from meta.json)
    local prev_content=""
    local state_file="${task_dir}/.hook-state.json"
    if [[ -f "$state_file" ]]; then
        prev_content=$(jq -r '.last_todo_content // ""' "$state_file" 2>/dev/null || echo "")
    fi

    # Detect if quality review checkbox was just checked
    if ! detect_quality_review_trigger "$curr_content" "$prev_content"; then
        # No trigger, just store current content for next time
        store_todo_content "$task_id" "$curr_content" 2>/dev/null || true
        exit 0
    fi

    # Quality review trigger detected!
    echo "✅ Quality review trigger detected for task $task_id"

    # Validate expansion files exist before review
    if [[ ! -f "$task_dir/expansion.md" || ! -f "$task_dir/plan.md" ]]; then
        echo "⚠️  Task expansion not yet complete for $task_id"
        local status
        status=$(jq -r '.status // "UNKNOWN"' "$meta_file")
        if [[ "$status" == "RUNNING" ]]; then
            echo "Status: Background agent currently running. Please wait for completion."
        else
            echo "Status: Expansion appears incomplete (missing expansion.md or plan.md)"
        fi
        exit 0
    fi

    # Check for pre-existing review.md
    if [[ -f "$task_dir/review.md" ]]; then
        echo "⚠️  Quality review already exists for task $task_id"
        echo "Previous review found at: $task_dir/review.md"
        echo "To re-run: delete review.md and re-check the checkbox"
        store_todo_content "$task_id" "$curr_content" 2>/dev/null || true
        exit 0
    fi

    # All validations passed - trigger quality review
    echo "🚀 Triggering quality review for task $task_id..."
    echo "  Expansion: $task_dir/expansion.md"
    echo "  Plan: $task_dir/plan.md"

    # Update stored content
    store_todo_content "$task_id" "$curr_content" 2>/dev/null || true

    # Note: No .review-pending marker created — the stdout messages above
    # are sufficient for trigger detection by the LLM. The marker was
    # previously created but never consumed by anything.

    echo "✅ Quality review queued successfully"
}

# Run main function
main "$@"
