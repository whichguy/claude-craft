#!/bin/bash
set -e

# Claude Craft Auto-Sync Manager
# Handles intelligent repository synchronization

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
STATE_FILE="$CLAUDE_DIR/auto-sync-state.json"
LOCK_FILE="$CLAUDE_DIR/auto-sync.lock"
LOG_FILE="$CLAUDE_DIR/auto-sync.log"
CONFIG_FILE="$CLAUDE_DIR/claude-craft.json"

# Get repository directory from configuration
get_repo_dir() {
    # First check environment variable
    if [ -n "$REPO_DIR" ]; then
        echo "$REPO_DIR"
        return
    fi
    
    # Then check configuration file
    if [ -f "$CONFIG_FILE" ]; then
        local repo_path=$(jq -r '.repository.path // ""' "$CONFIG_FILE" 2>/dev/null)
        if [ -n "$repo_path" ] && [ -d "$repo_path" ]; then
            echo "$repo_path"
            return
        fi
    fi
    
    # Fallback to default
    echo "$HOME/src5/subagent-sync/claude-craft"
}

REPO_DIR=$(get_repo_dir)

# Default configuration
DEFAULT_PROBABILITY=27
DEFAULT_DEBOUNCE_MS=5000
DEFAULT_TIMEOUT=30

# Logging
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    if [ "$VERBOSE" = "true" ] || [ "$level" = "ERROR" ]; then
        case "$level" in
            ERROR) echo -e "${RED}❌ $message${NC}" >&2 ;;
            WARN) echo -e "${YELLOW}⚠️  $message${NC}" ;;
            INFO) echo -e "${BLUE}ℹ️  $message${NC}" ;;
            SUCCESS) echo -e "${GREEN}✅ $message${NC}" ;;
        esac
    fi
}

# Lock management
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

# Cleanup on exit
cleanup() {
    release_lock
}
trap cleanup EXIT

# Check if auto-sync is enabled
is_enabled() {
    if [ ! -f "$SETTINGS_FILE" ]; then
        return 1
    fi
    
    local enabled=$(jq -r '.autoSync.enabled // false' "$SETTINGS_FILE" 2>/dev/null)
    [ "$enabled" = "true" ]
}

# Check specific trigger
is_trigger_enabled() {
    local trigger="$1"
    if [ ! -f "$SETTINGS_FILE" ]; then
        return 1
    fi
    
    local enabled=$(jq -r ".autoSync.triggers.${trigger}.enabled // false" "$SETTINGS_FILE" 2>/dev/null)
    [ "$enabled" = "true" ]
}

# Get configuration value
get_config() {
    local path="$1"
    local default="$2"
    
    if [ ! -f "$SETTINGS_FILE" ]; then
        echo "$default"
        return
    fi
    
    jq -r "$path // \"$default\"" "$SETTINGS_FILE" 2>/dev/null || echo "$default"
}

# Update state
update_state() {
    local key="$1"
    local value="$2"
    
    if [ ! -f "$STATE_FILE" ]; then
        echo "{}" > "$STATE_FILE"
    fi
    
    local temp_file=$(mktemp)
    jq ".$key = $value" "$STATE_FILE" > "$temp_file" && mv "$temp_file" "$STATE_FILE"
}

# Update statistics
update_stats() {
    local stat="$1"
    local increment="${2:-1}"
    
    if [ ! -f "$SETTINGS_FILE" ]; then
        return
    fi
    
    local current=$(get_config ".autoSync.statistics.$stat" "0")
    local new_value=$((current + increment))
    
    local temp_file=$(mktemp)
    jq ".autoSync.statistics.$stat = $new_value" "$SETTINGS_FILE" > "$temp_file" && \
        mv "$temp_file" "$SETTINGS_FILE"
}

# Check repository status
check_repo_status() {
    cd "$REPO_DIR" 2>/dev/null || {
        log "ERROR" "Repository not found at $REPO_DIR"
        return 1
    }
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo "uncommitted"
        return 0
    fi
    
    # Check if we're ahead or behind
    git fetch --quiet 2>/dev/null
    local local_rev=$(git rev-parse HEAD)
    local remote_rev=$(git rev-parse @{u} 2>/dev/null)
    
    if [ "$local_rev" = "$remote_rev" ]; then
        echo "up-to-date"
    elif git merge-base --is-ancestor "$local_rev" "$remote_rev"; then
        echo "behind"
    elif git merge-base --is-ancestor "$remote_rev" "$local_rev"; then
        echo "ahead"
    else
        echo "diverged"
    fi
}

# Perform pull operation
do_pull() {
    log "INFO" "Pulling latest changes from repository"
    
    cd "$REPO_DIR" || return 1
    
    local status=$(check_repo_status)
    
    case "$status" in
        "uncommitted")
            log "WARN" "Stashing uncommitted changes"
            git stash push -m "Auto-sync stash $(date +%Y%m%d-%H%M%S)"
            git pull --quiet
            git stash pop --quiet || log "WARN" "Failed to restore stashed changes"
            ;;
        "behind")
            git pull --quiet
            log "SUCCESS" "Pulled latest changes"
            ;;
        "up-to-date")
            log "INFO" "Already up to date"
            ;;
        "diverged")
            log "ERROR" "Repository has diverged - manual intervention required"
            return 1
            ;;
    esac
    
    return 0
}

# Perform push operation
do_push() {
    local commit_message="${1:-Auto-sync: $(date +%Y-%m-%d\ %H:%M:%S)}"
    
    log "INFO" "Pushing changes to repository"
    
    cd "$REPO_DIR" || return 1
    
    local status=$(check_repo_status)
    
    if [ "$status" = "uncommitted" ]; then
        # Run security scan
        if [ -x "$REPO_DIR/tools/security-scan.sh" ]; then
            log "INFO" "Running security scan"
            if ! "$REPO_DIR/tools/security-scan.sh" "$REPO_DIR/memory" secrets false >/dev/null 2>&1; then
                log "ERROR" "Security scan failed - aborting push"
                return 1
            fi
        fi
        
        git add -A
        git commit -m "$commit_message" --quiet
        log "SUCCESS" "Created commit: $commit_message"
    fi
    
    if [ "$status" = "ahead" ] || [ "$status" = "uncommitted" ]; then
        git push --quiet
        log "SUCCESS" "Pushed changes to remote"
    else
        log "INFO" "Nothing to push"
    fi
    
    return 0
}

# Perform full sync
do_sync() {
    log "INFO" "Performing full sync"
    
    if ! do_pull; then
        return 1
    fi
    
    if ! do_push; then
        return 1
    fi
    
    return 0
}

# Session start handler
handle_session_start() {
    if ! is_trigger_enabled "sessionStart"; then
        log "INFO" "Session start sync disabled"
        return 0
    fi
    
    log "INFO" "Session start - initiating sync"
    
    local action=$(get_config ".autoSync.triggers.sessionStart.action" "pull")
    local timeout=$(get_config ".autoSync.triggers.sessionStart.timeout" "30")
    
    if ! acquire_lock "$timeout"; then
        return 1
    fi
    
    case "$action" in
        "pull") do_pull ;;
        "push") do_push ;;
        "sync") do_sync ;;
    esac
    
    local result=$?
    
    if [ $result -eq 0 ]; then
        update_stats "sessionStartSyncs"
        update_stats "totalSyncs"
        update_state "lastSync" "\"$(date -Iseconds)\""
    else
        update_stats "failedSyncs"
    fi
    
    return $result
}

# Session end handler
handle_session_end() {
    if ! is_trigger_enabled "sessionEnd"; then
        log "INFO" "Session end sync disabled"
        return 0
    fi
    
    log "INFO" "Session end - initiating sync"
    
    local action=$(get_config ".autoSync.triggers.sessionEnd.action" "push")
    local timeout=$(get_config ".autoSync.triggers.sessionEnd.timeout" "60")
    local commit_msg=$(get_config ".autoSync.triggers.sessionEnd.commitMessage" "Auto-sync: Session end")
    
    if ! acquire_lock "$timeout"; then
        return 1
    fi
    
    case "$action" in
        "pull") do_pull ;;
        "push") do_push "$commit_msg" ;;
        "sync") do_sync ;;
    esac
    
    local result=$?
    
    if [ $result -eq 0 ]; then
        update_stats "sessionEndSyncs"
        update_stats "totalSyncs"
        update_state "lastSync" "\"$(date -Iseconds)\""
    else
        update_stats "failedSyncs"
    fi
    
    return $result
}

# User prompt handler with probability check
handle_user_prompt() {
    if ! is_trigger_enabled "userPrompt"; then
        return 0
    fi
    
    # Check debounce
    local debounce_ms=$(get_config ".autoSync.triggers.userPrompt.debounceMs" "$DEFAULT_DEBOUNCE_MS")
    local last_check=$(get_config ".autoSync.state.lastPromptCheck" "0")
    local now=$(date +%s%3N)
    
    if [ $((now - last_check)) -lt $debounce_ms ]; then
        log "DEBUG" "Debounce active - skipping check"
        return 0
    fi
    
    update_state "lastPromptCheck" "$now"
    
    # Probability check
    local probability=$(get_config ".autoSync.triggers.userPrompt.probability" "$DEFAULT_PROBABILITY")
    local random=$((RANDOM % probability))
    
    if [ $random -ne 0 ]; then
        log "DEBUG" "Probability check failed ($random/$probability)"
        return 0
    fi
    
    log "INFO" "Probability check passed - initiating sync"
    
    local action=$(get_config ".autoSync.triggers.userPrompt.action" "sync")
    local timeout=$(get_config ".autoSync.triggers.userPrompt.timeout" "30")
    
    # Run in background to avoid blocking
    (
        if acquire_lock "$timeout"; then
            case "$action" in
                "pull") do_pull ;;
                "push") do_push ;;
                "sync") do_sync ;;
            esac
            
            if [ $? -eq 0 ]; then
                update_stats "promptSyncs"
                update_stats "totalSyncs"
                update_state "lastSync" "\"$(date -Iseconds)\""
            else
                update_stats "failedSyncs"
            fi
            
            release_lock
        fi
    ) &
    
    return 0
}

# Manage hooks in settings.json
manage_hooks() {
    local action="$1"  # add or remove
    
    if [ ! -f "$SETTINGS_FILE" ]; then
        echo "{}" > "$SETTINGS_FILE"
    fi
    
    local temp_file=$(mktemp)
    
    if [ "$action" = "add" ]; then
        # Copy hook script to ~/.claude/hooks (only prompt-sync-check)
        mkdir -p "$CLAUDE_DIR/hooks"
        
        if [ -f "$REPO_DIR/hooks/scripts/prompt-sync-check.sh" ]; then
            cp "$REPO_DIR/hooks/scripts/prompt-sync-check.sh" "$CLAUDE_DIR/hooks/"
            chmod +x "$CLAUDE_DIR/hooks/prompt-sync-check.sh"
        fi
        
        # Add hook to settings.json (only onUserPromptSubmit)
        jq '.hooks = {
            "onUserPromptSubmit": "~/.claude/hooks/prompt-sync-check.sh"
        } + (.hooks // {})' "$SETTINGS_FILE" > "$temp_file" && \
            mv "$temp_file" "$SETTINGS_FILE"
        
        echo -e "${GREEN}✅ Hook installed in ~/.claude/hooks/${NC}"
        echo -e "${GREEN}✅ Hook configured in settings.json${NC}"
        
    elif [ "$action" = "remove" ]; then
        # Remove hook entry from settings.json
        jq 'del(.hooks.onUserPromptSubmit)' \
            "$SETTINGS_FILE" > "$temp_file" && \
            mv "$temp_file" "$SETTINGS_FILE"
        
        # Remove hook script
        rm -f "$CLAUDE_DIR/hooks/prompt-sync-check.sh"
        
        echo -e "${YELLOW}✅ Hook removed from settings.json${NC}"
        echo -e "${YELLOW}✅ Hook script removed from ~/.claude/hooks/${NC}"
    fi
}

# Enable/disable auto-sync
set_enabled() {
    local enabled="$1"
    
    if [ ! -f "$SETTINGS_FILE" ]; then
        echo "{}" > "$SETTINGS_FILE"
    fi
    
    local temp_file=$(mktemp)
    jq ".autoSync.enabled = $enabled" "$SETTINGS_FILE" > "$temp_file" && \
        mv "$temp_file" "$SETTINGS_FILE"
    
    if [ "$enabled" = "true" ]; then
        # Add hooks when enabling
        manage_hooks "add"
        
        # Add or update auto-sync configuration
        jq '.autoSync.triggers = {
            "sessionStart": {
                "enabled": false,
                "action": "pull",
                "silent": true,
                "timeout": 30
            },
            "sessionEnd": {
                "enabled": false,
                "action": "push",
                "silent": false,
                "commitMessage": "Auto-sync: Session end",
                "timeout": 60
            },
            "userPrompt": {
                "enabled": true,
                "probability": 27,
                "action": "sync",
                "silent": true,
                "debounceMs": 5000,
                "timeout": 30
            }
        }' "$SETTINGS_FILE" > "$temp_file" && \
            mv "$temp_file" "$SETTINGS_FILE"
        
        log "SUCCESS" "Auto-sync enabled"
        echo -e "${GREEN}✅ Auto-sync enabled${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT: You must restart Claude Code for changes to take effect${NC}"
        echo -e "${BLUE}   Please type: /resume${NC}"
        echo ""
        echo -e "${GREEN}Auto-sync will:${NC}"
        echo -e "  • Sync randomly (~3.7% chance) on prompts"
    else
        # Remove hooks when disabling
        manage_hooks "remove"
        
        log "SUCCESS" "Auto-sync disabled"
        echo -e "${YELLOW}⚠️  Auto-sync disabled${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT: You must restart Claude Code for changes to take effect${NC}"
        echo -e "${BLUE}   Please type: /resume${NC}"
    fi
}

# Show status
show_status() {
    echo -e "${BLUE}📊 Auto-Sync Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if is_enabled; then
        echo -e "Status: ${GREEN}Enabled${NC}"
    else
        echo -e "Status: ${RED}Disabled${NC}"
    fi
    
    echo ""
    echo "Triggers:"
    
    if is_trigger_enabled "sessionStart"; then
        echo -e "  Session Start: ${GREEN}✓${NC}"
    else
        echo -e "  Session Start: ${RED}✗${NC}"
    fi
    
    if is_trigger_enabled "sessionEnd"; then
        echo -e "  Session End: ${GREEN}✓${NC}"
    else
        echo -e "  Session End: ${RED}✗${NC}"
    fi
    
    if is_trigger_enabled "userPrompt"; then
        local prob=$(get_config ".autoSync.triggers.userPrompt.probability" "$DEFAULT_PROBABILITY")
        echo -e "  User Prompt: ${GREEN}✓${NC} (1/$prob chance)"
    else
        echo -e "  User Prompt: ${RED}✗${NC}"
    fi
    
    echo ""
    echo "Statistics:"
    echo "  Total Syncs: $(get_config '.autoSync.statistics.totalSyncs' '0')"
    echo "  Session Start: $(get_config '.autoSync.statistics.sessionStartSyncs' '0')"
    echo "  Session End: $(get_config '.autoSync.statistics.sessionEndSyncs' '0')"
    echo "  Prompt Syncs: $(get_config '.autoSync.statistics.promptSyncs' '0')"
    echo "  Failed Syncs: $(get_config '.autoSync.statistics.failedSyncs' '0')"
    
    local last_sync=$(get_config '.autoSync.state.lastSync' 'never')
    echo ""
    echo "Last Sync: $last_sync"
    
    # Check current repo status
    echo ""
    echo "Repository Status:"
    local status=$(check_repo_status)
    case "$status" in
        "up-to-date") echo -e "  ${GREEN}✓ Up to date${NC}" ;;
        "behind") echo -e "  ${YELLOW}⬇ Behind remote${NC}" ;;
        "ahead") echo -e "  ${YELLOW}⬆ Ahead of remote${NC}" ;;
        "uncommitted") echo -e "  ${YELLOW}✎ Uncommitted changes${NC}" ;;
        "diverged") echo -e "  ${RED}⚠ Diverged${NC}" ;;
    esac
}

# Main command handler
main() {
    case "${1:-status}" in
        "enable")
            set_enabled "true"
            ;;
        "disable")
            set_enabled "false"
            ;;
        "status")
            show_status
            ;;
        "session-start")
            handle_session_start
            ;;
        "session-end")
            handle_session_end
            ;;
        "prompt-check")
            handle_user_prompt
            ;;
        "force")
            log "INFO" "Force sync requested"
            if acquire_lock 60; then
                do_sync
                update_stats "totalSyncs"
                update_state "lastSync" "\"$(date -Iseconds)\""
            fi
            ;;
        "test")
            echo "Testing auto-sync configuration..."
            show_status
            echo ""
            echo "Testing probability (27 attempts):"
            local hits=0
            for i in {1..27}; do
                if [ $((RANDOM % 27)) -eq 0 ]; then
                    hits=$((hits + 1))
                fi
            done
            echo "Hits: $hits/27 (expected ~1)"
            ;;
        *)
            echo "Usage: $0 [enable|disable|status|force|test]"
            echo ""
            echo "Commands:"
            echo "  enable       - Enable auto-sync"
            echo "  disable      - Disable auto-sync"
            echo "  status       - Show auto-sync status"
            echo "  force        - Force immediate sync"
            echo "  test         - Test configuration"
            echo ""
            echo "Internal commands (for hooks):"
            echo "  session-start - Handle session start"
            echo "  session-end   - Handle session end"
            echo "  prompt-check  - Check for prompt sync"
            exit 1
            ;;
    esac
}

main "$@"