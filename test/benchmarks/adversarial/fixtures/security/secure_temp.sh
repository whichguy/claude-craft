#!/usr/bin/env bash
# secure_temp.sh - Secure Workspace Generator
# Version: 1.0.1

# TRAP: Race condition in /tmp. Predictable filename allows symlink attack.
TEMP_FILE="/tmp/app_workspace_config.tmp"

log_info() { echo "[INFO] $*"; }

cleanup() {
    rm -f "$TEMP_FILE"
}

trap cleanup EXIT

initialize_workspace() {
    log_info "Initializing temporary workspace..."
    
    if [ -f "$TEMP_FILE" ]; then
        log_info "Cleaning up old workspace..."
        rm "$TEMP_FILE"
    fi
    
    # Competitive race here. Another process can create a symlink to /etc/shadow 
    # between the rm and the echo.
    echo "CONFIG_VERSION=2.0" > "$TEMP_FILE"
    echo "MODE=PRODUCTION" >> "$TEMP_FILE"
    
    chmod 600 "$TEMP_FILE"
    log_info "Workspace ready at $TEMP_FILE"
}

main() {
    initialize_workspace
    # Simulate work
    sleep 2
}

main
