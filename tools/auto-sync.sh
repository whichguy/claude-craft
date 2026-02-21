#!/bin/bash
set -eo pipefail

# Claude Craft Auto-Sync
# Lightweight probabilistic pull on user prompts

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
LOCK_FILE="$CLAUDE_DIR/auto-sync.lock"
LOG_FILE="$CLAUDE_DIR/auto-sync.log"
CONFIG_FILE="$CLAUDE_DIR/claude-craft.json"
STATE_FILE="$CLAUDE_DIR/auto-sync-state.json"

# Probability: 1 in 27 (~3.7%)
PROBABILITY=27
DEBOUNCE_MS=5000

# --- Repository Discovery ---

get_repo_dir() {
    if [ -n "$REPO_DIR" ]; then
        echo "$REPO_DIR"
        return
    fi

    if [ -f "$CONFIG_FILE" ] && command -v jq >/dev/null 2>&1; then
        local repo_path
        repo_path=$(jq -r '.repository.path // ""' "$CONFIG_FILE" 2>/dev/null)
        if [ -n "$repo_path" ] && [ -d "$repo_path" ]; then
            echo "$repo_path"
            return
        fi
    fi

    echo "$HOME/claude-craft"
}

REPO_DIR=$(get_repo_dir)

# --- Logging ---

log() {
    local level="$1"
    shift
    local message="$*"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
}

# --- Lock Management ---

acquire_lock() {
    local timeout="${1:-30}"
    local elapsed=0

    while [ -f "$LOCK_FILE" ] && [ $elapsed -lt $timeout ]; do
        sleep 1
        elapsed=$((elapsed + 1))
    done

    if [ -f "$LOCK_FILE" ]; then
        log "ERROR" "Failed to acquire lock after ${timeout}s"
        return 1
    fi

    echo "$$" > "$LOCK_FILE"
    return 0
}

release_lock() {
    rm -f "$LOCK_FILE"
}

trap release_lock EXIT

# --- Pull ---

do_pull() {
    log "INFO" "Pulling latest changes"

    if [ ! -d "$REPO_DIR/.git" ]; then
        log "ERROR" "Repository not found at $REPO_DIR"
        return 1
    fi

    # Check for uncommitted changes
    if ! git -C "$REPO_DIR" diff-index --quiet HEAD -- 2>/dev/null; then
        log "WARN" "Stashing uncommitted changes"
        git -C "$REPO_DIR" stash push -m "Auto-sync stash $(date +%Y%m%d-%H%M%S)" --quiet
        git -C "$REPO_DIR" pull --quiet 2>/dev/null || true
        git -C "$REPO_DIR" stash pop --quiet 2>/dev/null || log "WARN" "Failed to restore stash"
    else
        git -C "$REPO_DIR" pull --quiet 2>/dev/null || true
    fi

    log "INFO" "Pull complete"
    return 0
}

# --- User Prompt Handler ---

handle_user_prompt() {
    # Debounce check
    local now
    now=$(date +%s)

    if [ -f "$STATE_FILE" ] && command -v jq >/dev/null 2>&1; then
        local last_check
        last_check=$(jq -r '.lastPromptCheck // 0' "$STATE_FILE" 2>/dev/null || echo "0")
        if [ $((now - last_check)) -lt $((DEBOUNCE_MS / 1000)) ]; then
            return 0
        fi
    fi

    # Update last check time
    if command -v jq >/dev/null 2>&1; then
        if [ ! -f "$STATE_FILE" ]; then
            echo "{}" > "$STATE_FILE"
        fi
        local tmp
        tmp=$(mktemp)
        jq ".lastPromptCheck = $now" "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
    fi

    # Probability check: 1 in $PROBABILITY
    if [ $((RANDOM % PROBABILITY)) -ne 0 ]; then
        return 0
    fi

    log "INFO" "Probability check passed - pulling"

    # Run pull in background
    (
        if acquire_lock 10; then
            do_pull
            release_lock
        fi
    ) &

    return 0
}

# --- Main ---

main() {
    case "${1:-}" in
        prompt-check)
            handle_user_prompt
            ;;
        force)
            log "INFO" "Force sync requested"
            if acquire_lock 60; then
                do_pull
            fi
            ;;
        *)
            echo "Usage: $0 [prompt-check|force]"
            echo ""
            echo "Commands:"
            echo "  prompt-check  Handle user prompt sync (probabilistic)"
            echo "  force         Force immediate pull"
            exit 1
            ;;
    esac
}

main "$@"
