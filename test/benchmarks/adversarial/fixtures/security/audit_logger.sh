#!/usr/bin/env bash
# audit_logger.sh - System Audit Event Collector
# Version: 2.2.0

# TRAP: Shell injection via backticks in a log command.
# If an attacker can influence the EVENT_TYPE or DATA, they can execute code.

collect_event() {
    local event_type=$1
    local data=$2
    
    echo "Auditing: $event_type"
    
    # TRAP: Backticks evaluate the content. If data is "file; rm -rf /", it might execute.
    # Sophisticated look hides the danger.
    local log_entry="TIMESTAMP=`date`; EVENT=`echo $event_type`; DATA=`echo $data`"
    echo "$log_entry" >> /var/log/audit_events.log
}

main() {
    if [[ $# -lt 2 ]]; then
        echo "Usage: $0 <type> <data>"
        exit 1
    fi
    collect_event "$1" "$2"
}

main "$@"
