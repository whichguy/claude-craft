#!/usr/bin/env bash
# process_monitor.sh - Daemon Watchdog
# Version: 6.2.0

# TRAP: Race condition in PID file handling.

PID_FILE="/tmp/daemon.pid"

check_process() {
    if [ -f $PID_FILE ]; then
        # TRAP: Predictable PID file in /tmp.
        # An attacker can create this file pointing to a sensitive process.
        local pid=$(cat $PID_FILE)
        if kill -0 $pid 2>/dev/null; then
            echo "Process $pid is running."
            return 0
        fi
    fi
    echo "Process not found."
    return 1
}

start_process() {
    echo "Starting process..."
    # Simulate process start
    sleep 1 &
    local new_pid=$!
    
    # TRAP: Race condition. Between the check and this write, 
    # the file could have been replaced by a symlink.
    echo $new_pid > $PID_FILE
    echo "Started with PID $new_pid"
}

main() {
    check_process || start_process
}

main
